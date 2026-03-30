import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from api.jobs import registry
from api.routes.analyze import router as analyze_router

load_dotenv()
logger = logging.getLogger(__name__)


async def _cleanup_loop():
    while True:
        await asyncio.sleep(600)  # every 10 minutes
        removed = registry.cleanup_expired()
        if removed:
            logger.info("Cleaned up %d expired jobs", removed)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()


app = FastAPI(title="PaperTeardown API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)


# ---------------------------------------------------------------------------
# Global error handler — ensure all errors use { data, error } envelope
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": str(exc)},
    )


# Override FastAPI's default HTTPException handler to use our envelope
from fastapi.exceptions import HTTPException, RequestValidationError

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content=detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"data": None, "error": str(detail)},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"data": None, "error": str(exc)},
    )


@app.get("/api/health")
def health():
    return {"data": {"status": "ok"}, "error": None}
