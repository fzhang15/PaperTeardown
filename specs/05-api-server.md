# Spec: API Server

**Status**: `implemented`
**ID**: 05-api-server
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

A FastAPI backend that exposes HTTP endpoints connecting the Repo Cloner, PyTorch Parser, and Code Analyzer into a single pipeline. Manages async jobs so the frontend can poll or stream progress while long-running analysis completes.

## Goals

- Single `POST /api/analyze` endpoint kicks off the full pipeline
- Job system with status polling and SSE streaming
- Serve the React frontend in production (static files)
- CORS configured for local dev (frontend on :5173, backend on :8000)

## Non-Goals

- User authentication (deferred)
- Persistent job storage across server restarts (in-memory only for now)
- Horizontal scaling / distributed job queue (deferred)

## Inputs & Outputs

**Input:**
- HTTP requests from the React frontend (or API clients)

**Output:**
- JSON responses following `{ "data": ..., "error": null }` envelope
- SSE stream for job progress

## Detailed Behavior

### Endpoints

#### `POST /api/analyze`
Starts the full pipeline for a given repo URL.

Request:
```json
{ "repo_url": "https://github.com/...", "detail_level": "detailed", "context": "optional paper title" }
```

Response:
```json
{ "data": { "job_id": "abc123" }, "error": null }
```

#### `GET /api/status/{job_id}`
Returns current job status. Supports SSE if `Accept: text/event-stream` header present.

Polling response:
```json
{
  "data": {
    "job_id": "abc123",
    "status": "cloning" | "parsing" | "analyzing" | "done" | "error",
    "progress": { "current_module": "ResNet", "modules_done": 2, "modules_total": 5 },
    "error": null
  }
}
```

SSE events:
```
event: progress
data: {"step": "analyzing", "current_module": "ResNet"}

event: done
data: {"job_id": "abc123"}

event: error
data: {"message": "..."}
```

#### `GET /api/result/{job_id}`
Returns the full `AnalysisResult` once the job is complete.

```json
{ "data": { ...AnalysisResult }, "error": null }
```

#### `DELETE /api/job/{job_id}`
Cancels a running job and cleans up cloned files.

#### `GET /api/health`
Returns `{ "status": "ok" }`. Used for readiness checks.

### Job Lifecycle

1. `POST /api/analyze` creates a job with `status: "queued"`, returns `job_id`
2. Background task runs pipeline stages sequentially
3. Each stage updates job status
4. On completion, result stored in memory; job status set to `"done"`
5. Jobs expire after 1 hour (cleanup task runs every 10 minutes)

### Error Handling

- All exceptions in the pipeline are caught, logged, and stored on the job as `error`
- Job status set to `"error"` with the error message
- Individual module analysis errors do NOT fail the whole job

### Response Envelope

All endpoints return:
```json
{ "data": <payload or null>, "error": <error string or null> }
```

HTTP status codes:
- `200` success
- `400` bad request (invalid URL, missing fields)
- `404` job not found
- `500` unexpected server error

### Error Cases

| Condition | Behavior |
|-----------|----------|
| Invalid `repo_url` | `400` immediately, no job created |
| Job ID not found | `404` |
| Pipeline error mid-run | Job status = `"error"`, result endpoint returns error |
| Duplicate analyze request (same URL) | Create a new job; no deduplication |

## Interface / API Contract

```python
# FastAPI app structure
app = FastAPI()

@app.post("/api/analyze") -> JobCreated
@app.get("/api/status/{job_id}") -> JobStatus | SSE
@app.get("/api/result/{job_id}") -> AnalysisResult
@app.delete("/api/job/{job_id}") -> None
@app.get("/api/health") -> dict
```

## Acceptance Criteria

- [x] `POST /api/analyze` returns a `job_id` within 200ms (pipeline runs async)
- [x] `GET /api/status/:id` reflects each pipeline stage as it progresses
- [x] SSE stream delivers `progress`, `done`, and `error` events correctly
- [x] `GET /api/result/:id` returns full analysis when done
- [x] CORS allows requests from `http://localhost:5173`
- [x] All 4xx/5xx errors use the standard error envelope
- [x] Job cleanup runs and removes expired entries
- [x] `/api/health` returns 200

## Dependencies

- `fastapi`, `uvicorn`, `pydantic`
- `asyncio` (stdlib)
- Spec 01 (RepoCloner)
- Spec 02 (PyTorchParser)
- Spec 03 (CodeAnalyzer)

## Decisions

- **Job deduplication**: No deduplication — parallel jobs for the same URL are allowed; simpler to implement
- **SSE vs WebSocket**: SSE for progress streaming; `GET /api/status/{job_id}` with `Accept: text/event-stream` header
- **`/api/clone` removed**: RepoCloner is an internal module only; not exposed as a public endpoint
- **Frontend serving**: Out of scope for this spec; deferred

## Open Questions

- Do we need authentication even for a local/demo deployment?
