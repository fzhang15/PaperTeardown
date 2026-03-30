"""
Analysis pipeline routes — POST /api/analyze, GET /api/status, GET /api/result, DELETE /api/job
"""
import asyncio
import dataclasses
import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from analyzer.code_analyzer import CodeAnalyzer
from api.jobs import registry
from cloner.repo_cloner import InvalidURLError, RepoCloner, RepoNotFoundError
from parser.pytorch_parser import PyTorchParser

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    repo_url: str
    detail_level: str = "overview"
    context: str | None = None


def _ok(data):
    return {"data": data, "error": None}


def _err(msg: str):
    return {"data": None, "error": msg}


# ---------------------------------------------------------------------------
# Pipeline runner
# ---------------------------------------------------------------------------

async def _run_pipeline(job_id: str) -> None:
    job = registry.get(job_id)
    if job is None:
        return

    cloner = RepoCloner()
    parser = PyTorchParser()
    analyzer = CodeAnalyzer()

    try:
        # --- Clone ---
        job.status = "cloning"
        job.push_event({"event": "progress", "data": {"step": "cloning"}})
        try:
            clone_result = await cloner.clone(job.repo_url)
        except (InvalidURLError, RepoNotFoundError) as exc:
            raise RuntimeError(str(exc)) from exc

        # --- Parse ---
        job.status = "parsing"
        job.push_event({"event": "progress", "data": {"step": "parsing"}})
        parse_result = parser.parse(clone_result)
        job.modules_total = len(parse_result.modules) + len(parse_result.training_loops)

        # --- Analyze ---
        job.status = "analyzing"

        def on_progress(name: str, done: int, total: int) -> None:
            job.current_module = name
            job.modules_done = done
            job.modules_total = total
            job.push_event({
                "event": "progress",
                "data": {"step": "analyzing", "current_module": name,
                         "modules_done": done, "modules_total": total},
            })

        analysis_result = await analyzer.analyze(
            parse_result,
            detail_level=job.detail_level,
            context=job.context,
            on_progress=on_progress,
        )

        # --- Done ---
        job.result = analysis_result
        job.status = "done"
        job.push_event({"event": "done", "data": {"job_id": job_id}})

    except Exception as exc:
        logger.exception("Pipeline error for job %s", job_id)
        job.status = "error"
        job.error = str(exc)
        job.push_event({"event": "error", "data": {"message": str(exc)}})
    finally:
        try:
            await cloner.cleanup(getattr(clone_result, "clone_id", ""))
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/api/analyze")
async def start_analysis(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    # Validate URL format early — raises InvalidURLError for bad URLs
    from cloner.repo_cloner import _validate_url
    try:
        _validate_url(req.repo_url)
    except InvalidURLError as exc:
        raise HTTPException(status_code=400, detail=_err(str(exc)))

    job = registry.create(req.repo_url, req.detail_level, req.context)
    background_tasks.add_task(_run_pipeline, job.job_id)
    return _ok({"job_id": job.job_id})


@router.get("/api/status/{job_id}")
async def get_status(job_id: str, request: Request):
    job = registry.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=_err("Job not found"))

    # SSE mode
    if request.headers.get("accept") == "text/event-stream":
        return StreamingResponse(
            _sse_generator(job_id),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Polling mode
    return _ok({
        "job_id": job.job_id,
        "status": job.status,
        "progress": {
            "current_module": job.current_module,
            "modules_done": job.modules_done,
            "modules_total": job.modules_total,
        },
        "error": job.error,
    })


async def _sse_generator(job_id: str) -> AsyncIterator[str]:
    job = registry.get(job_id)
    if job is None:
        yield _sse_event("error", {"message": "Job not found"})
        return

    # If already finished, send terminal event immediately
    if job.status == "done":
        yield _sse_event("done", {"job_id": job_id})
        return
    if job.status == "error":
        yield _sse_event("error", {"message": job.error or "Unknown error"})
        return

    q = job.subscribe()
    try:
        while True:
            try:
                evt = await asyncio.wait_for(q.get(), timeout=30.0)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue
            yield _sse_event(evt["event"], evt["data"])
            if evt["event"] in ("done", "error"):
                break
    finally:
        job.unsubscribe(q)


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/api/result/{job_id}")
async def get_result(job_id: str):
    job = registry.get(job_id)
    if job is None or job.result is None:
        raise HTTPException(status_code=404, detail=_err("Result not available"))

    # Serialize dataclasses to dict
    result_dict = dataclasses.asdict(job.result)
    return _ok(result_dict)


@router.delete("/api/job/{job_id}")
async def delete_job(job_id: str):
    job = registry.delete(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=_err("Job not found"))
    return _ok({"deleted": job_id})
