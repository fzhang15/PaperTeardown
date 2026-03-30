# Spec: Repo Cloner

**Status**: `implemented`
**ID**: 01-repo-cloner
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

Accepts a GitHub repository URL from the user, clones it to a temporary local directory, validates that it contains meaningful PyTorch code, and returns a structured representation of the repo's file tree for downstream parsing.

## Goals

- Clone any public GitHub repo given a URL
- Validate the repo contains PyTorch usage (imports `torch` or `torch.nn`)
- Return file paths of all `.py` files for the parser
- Clean up temporary clones after a session or on demand

## Non-Goals

- Private repos requiring authentication (deferred)
- Non-GitHub hosts (GitLab, Bitbucket) — deferred
- Partial/shallow clones of very large repos — deferred

## Inputs & Outputs

**Input:**
- `repo_url: str` — a GitHub URL (e.g. `https://github.com/user/repo`)
- `target_dir: str | None` — optional override for clone destination

**Output:**
```python
{
  "clone_id": str,          # unique ID for this clone session
  "local_path": str,        # absolute path to cloned repo
  "python_files": list[str],# relative paths to all .py files
  "has_pytorch": bool,      # whether PyTorch was detected
  "pytorch_files": list[str]# .py files that import torch
}
```

## Detailed Behavior

### URL Validation

1. Accept `https://github.com/<owner>/<repo>` format
2. Also accept trailing `.git`
3. Reject non-GitHub URLs with a clear error message
4. Reject URLs that are obviously not repos (e.g. github.com/user only)

### Cloning

1. Clone to a temp directory under `./tmp/clones/<clone_id>/`
2. Use `git clone --depth=1` (shallow) to minimize download size
3. Timeout after 60 seconds; raise `ClonerTimeoutError` if exceeded
4. On success, record the clone in an in-memory registry keyed by `clone_id`

### PyTorch Detection

1. Scan all `.py` files for `import torch` or `from torch` at the top level
2. A repo is considered valid if at least one `.py` file imports torch
3. Surface `has_pytorch: false` as a warning, not a hard error — let the user proceed

### Cleanup

1. Expose a `cleanup(clone_id)` method that deletes the cloned directory
2. Auto-cleanup all clones older than 1 hour via a background task

### Error Cases

| Condition | Expected Behavior |
|-----------|-------------------|
| Invalid URL format | Return `400` with `"Invalid GitHub URL"` |
| Repo not found / private | Return `404` with `"Repository not found or private"` |
| Clone timeout | Return `504` with `"Clone timed out"` |
| No `.py` files found | Return success with empty `python_files`, `has_pytorch: false` |

## Interface / API Contract

```python
class RepoCloner:
    async def clone(self, repo_url: str) -> CloneResult: ...
    async def cleanup(self, clone_id: str) -> None: ...
    async def cleanup_all_expired(self) -> int: ...  # returns count cleaned

class CloneResult:
    clone_id: str
    local_path: str
    python_files: list[str]
    has_pytorch: bool
    pytorch_files: list[str]
```

## Acceptance Criteria

- [x] Clones a public GitHub repo successfully
- [x] Returns correct list of `.py` files
- [x] Correctly detects `import torch` and `from torch.nn import ...`
- [x] Returns `has_pytorch: false` for a non-PyTorch repo (does not crash)
- [x] Raises appropriate errors for invalid URLs and missing repos
- [x] Cleanup removes the directory from disk
- [x] Clone times out after 60s and returns error

## Dependencies

- `gitpython` or subprocess `git clone`
- `os`, `pathlib` (stdlib)
- No other specs required

## Open Questions

- Should we support SSH URLs or only HTTPS?
- Max repo size limit before refusing to clone?
- Should `cleanup` be automatic after analysis or manual per session?
