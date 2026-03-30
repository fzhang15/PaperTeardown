"""
In-memory job registry for the analysis pipeline.
"""
import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Job:
    job_id: str
    repo_url: str
    detail_level: str
    context: str | None
    status: str = "queued"          # queued | cloning | parsing | analyzing | done | error
    error: str | None = None
    result: Any = None
    current_module: str | None = None
    modules_done: int = 0
    modules_total: int = 0
    created_at: float = field(default_factory=time.time)
    # SSE subscribers: list of asyncio.Queue
    _subscribers: list = field(default_factory=list, repr=False)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    def push_event(self, event: dict) -> None:
        for q in list(self._subscribers):
            q.put_nowait(event)


class JobRegistry:
    TTL_SECONDS = 3600  # 1 hour

    def __init__(self):
        self._jobs: dict[str, Job] = {}

    def create(self, repo_url: str, detail_level: str, context: str | None) -> Job:
        job_id = uuid.uuid4().hex
        job = Job(job_id=job_id, repo_url=repo_url, detail_level=detail_level, context=context)
        self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def delete(self, job_id: str) -> Job | None:
        return self._jobs.pop(job_id, None)

    def cleanup_expired(self) -> int:
        now = time.time()
        expired = [
            jid for jid, job in self._jobs.items()
            if (now - job.created_at) >= self.TTL_SECONDS
        ]
        for jid in expired:
            del self._jobs[jid]
        return len(expired)


# Singleton used by routes and background tasks
registry = JobRegistry()
