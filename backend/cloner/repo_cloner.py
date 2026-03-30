"""
RepoCloner — spec 01-repo-cloner
Clones public GitHub repos, detects PyTorch usage, manages cleanup.
"""
import asyncio
import re
import shutil
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import git


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class InvalidURLError(ValueError):
    """Raised when the provided URL is not a valid GitHub repo URL."""


class RepoNotFoundError(RuntimeError):
    """Raised when git clone fails because the repo doesn't exist or is private."""


class ClonerTimeoutError(RuntimeError):
    """Raised when git clone exceeds the configured timeout."""


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

@dataclass
class CloneResult:
    clone_id: str
    local_path: str
    python_files: list[str]
    has_pytorch: bool
    pytorch_files: list[str]


@dataclass
class _CloneRecord:
    clone_id: str
    local_path: str
    cloned_at: float = field(default_factory=time.time)


# ---------------------------------------------------------------------------
# URL validation
# ---------------------------------------------------------------------------

_GITHUB_RE = re.compile(
    r'^https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$'
)


def _validate_url(url: str) -> str:
    """Validate and normalise a GitHub repo URL. Returns the canonical URL."""
    if not url:
        raise InvalidURLError("URL must not be empty")
    m = _GITHUB_RE.match(url.strip())
    if not m:
        raise InvalidURLError(
            f"Invalid GitHub URL: {url!r}. Expected https://github.com/<owner>/<repo>"
        )
    owner, repo = m.group(1), m.group(2)
    return f"https://github.com/{owner}/{repo}.git"


# ---------------------------------------------------------------------------
# PyTorch detection
# ---------------------------------------------------------------------------

_TORCH_IMPORT_RE = re.compile(r'^\s*(import torch|from torch[\s.])', re.MULTILINE)


def _has_torch_import(file_path: Path) -> bool:
    try:
        text = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            text = file_path.read_text(encoding="latin-1")
        except Exception:
            return False
    except Exception:
        return False
    return bool(_TORCH_IMPORT_RE.search(text))


# ---------------------------------------------------------------------------
# RepoCloner
# ---------------------------------------------------------------------------

class RepoCloner:
    def __init__(
        self,
        clone_base_dir: str = "./tmp/clones",
        timeout_secs: int = 60,
        ttl_hours: float = 1.0,
    ):
        self._base = Path(clone_base_dir)
        self._timeout = timeout_secs
        self._ttl = ttl_hours * 3600
        self._registry: dict[str, _CloneRecord] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def clone(self, repo_url: str) -> CloneResult:
        canonical_url = _validate_url(repo_url)
        clone_id = uuid.uuid4().hex
        dest = self._resolve_clone_path(clone_id)
        dest.mkdir(parents=True, exist_ok=True)

        try:
            await asyncio.wait_for(
                self._do_clone(canonical_url, dest),
                timeout=self._timeout,
            )
        except asyncio.TimeoutError:
            shutil.rmtree(dest, ignore_errors=True)
            raise ClonerTimeoutError(f"Clone timed out after {self._timeout}s")
        except git.GitCommandError as exc:
            shutil.rmtree(dest, ignore_errors=True)
            raise RepoNotFoundError(
                f"Repository not found or private: {repo_url}"
            ) from exc

        self._registry[clone_id] = _CloneRecord(
            clone_id=clone_id, local_path=str(dest)
        )

        python_files, pytorch_files = self._scan_files(dest)

        return CloneResult(
            clone_id=clone_id,
            local_path=str(dest),
            python_files=python_files,
            has_pytorch=bool(pytorch_files),
            pytorch_files=pytorch_files,
        )

    async def cleanup(self, clone_id: str) -> None:
        record = self._registry.pop(clone_id, None)
        if record:
            shutil.rmtree(record.local_path, ignore_errors=True)

    async def cleanup_all_expired(self) -> int:
        now = time.time()
        expired = [
            cid for cid, rec in self._registry.items()
            if (now - rec.cloned_at) >= self._ttl
        ]
        for cid in expired:
            await self.cleanup(cid)
        return len(expired)

    # ------------------------------------------------------------------
    # Internal helpers (separated to allow patching in tests)
    # ------------------------------------------------------------------

    def _resolve_clone_path(self, clone_id: str) -> Path:
        return self._base / clone_id

    async def _do_clone(self, url: str, dest: Path) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: git.Repo.clone_from(url, str(dest), depth=1),
        )

    def _scan_files(self, root: Path) -> tuple[list[str], list[str]]:
        python_files: list[str] = []
        pytorch_files: list[str] = []
        for p in root.rglob("*.py"):
            rel = p.relative_to(root).as_posix()
            python_files.append(rel)
            if _has_torch_import(p):
                pytorch_files.append(rel)
        return python_files, pytorch_files
