"""
Tests for RepoCloner — derived from specs/01-repo-cloner.md acceptance criteria.
All git operations are mocked; no real network calls are made.
"""
import asyncio
import shutil
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cloner.repo_cloner import (
    CloneResult,
    ClonerTimeoutError,
    InvalidURLError,
    RepoCloner,
    RepoNotFoundError,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_repo(tmp_path: Path, py_files: dict[str, str]) -> None:
    """Write .py files into a directory to simulate a cloned repo."""
    for rel, content in py_files.items():
        dest = tmp_path / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content)


# ---------------------------------------------------------------------------
# URL validation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_valid_github_url_is_accepted(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    with patch.object(cloner, "_do_clone") as mock_clone:
        mock_clone.return_value = None
        _make_fake_repo(tmp_path / "repo", {})
        with patch.object(cloner, "_resolve_clone_path", return_value=tmp_path / "repo"):
            result = await cloner.clone("https://github.com/user/repo")
    assert result.clone_id is not None


@pytest.mark.asyncio
async def test_github_url_with_dot_git_suffix_is_accepted(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    with patch.object(cloner, "_do_clone") as mock_clone:
        mock_clone.return_value = None
        _make_fake_repo(tmp_path / "repo", {})
        with patch.object(cloner, "_resolve_clone_path", return_value=tmp_path / "repo"):
            result = await cloner.clone("https://github.com/user/repo.git")
    assert result.clone_id is not None


@pytest.mark.asyncio
async def test_non_github_url_raises_invalid_url_error(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    with pytest.raises(InvalidURLError):
        await cloner.clone("https://gitlab.com/user/repo")


@pytest.mark.asyncio
async def test_github_user_only_url_raises_invalid_url_error(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    with pytest.raises(InvalidURLError):
        await cloner.clone("https://github.com/user")


@pytest.mark.asyncio
async def test_empty_url_raises_invalid_url_error(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    with pytest.raises(InvalidURLError):
        await cloner.clone("")


# ---------------------------------------------------------------------------
# Python file discovery
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_returns_list_of_py_files(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {
        "model.py": "x = 1",
        "train.py": "y = 2",
        "subdir/utils.py": "z = 3",
    })
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            result = await cloner.clone("https://github.com/user/repo")
    assert sorted(result.python_files) == sorted(["model.py", "train.py", "subdir/utils.py"])


@pytest.mark.asyncio
async def test_no_py_files_returns_empty_list_and_has_pytorch_false(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {"README.md": "hello"})
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            result = await cloner.clone("https://github.com/user/repo")
    assert result.python_files == []
    assert result.has_pytorch is False


# ---------------------------------------------------------------------------
# PyTorch detection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_detects_import_torch(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {"model.py": "import torch\nx = torch.tensor([1])"})
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            result = await cloner.clone("https://github.com/user/repo")
    assert result.has_pytorch is True
    assert "model.py" in result.pytorch_files


@pytest.mark.asyncio
async def test_detects_from_torch_import(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {"model.py": "from torch.nn import Linear\n"})
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            result = await cloner.clone("https://github.com/user/repo")
    assert result.has_pytorch is True
    assert "model.py" in result.pytorch_files


@pytest.mark.asyncio
async def test_non_pytorch_repo_has_pytorch_false_but_no_error(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {"app.py": "import os\nprint('hello')"})
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            result = await cloner.clone("https://github.com/user/repo")
    assert result.has_pytorch is False
    assert result.pytorch_files == []
    assert isinstance(result, CloneResult)  # no exception raised


@pytest.mark.asyncio
async def test_pytorch_files_subset_of_python_files(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {
        "model.py": "import torch",
        "utils.py": "import os",
    })
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            result = await cloner.clone("https://github.com/user/repo")
    assert set(result.pytorch_files).issubset(set(result.python_files))


# ---------------------------------------------------------------------------
# Clone errors
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_repo_not_found_raises_repo_not_found_error(tmp_path):
    import git
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    with patch.object(cloner, "_do_clone", side_effect=git.GitCommandError("clone", "not found")):
        with pytest.raises(RepoNotFoundError):
            await cloner.clone("https://github.com/user/definitely-does-not-exist-xyz")


@pytest.mark.asyncio
async def test_clone_timeout_raises_cloner_timeout_error(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path), timeout_secs=1)
    async def slow_clone(*args, **kwargs):
        await asyncio.sleep(10)
    with patch.object(cloner, "_do_clone", side_effect=slow_clone):
        with pytest.raises(ClonerTimeoutError):
            await cloner.clone("https://github.com/user/repo")


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cleanup_removes_directory_from_disk(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {"model.py": "import torch"})
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            result = await cloner.clone("https://github.com/user/repo")
    assert repo_dir.exists()
    await cloner.cleanup(result.clone_id)
    assert not repo_dir.exists()


@pytest.mark.asyncio
async def test_cleanup_all_expired_removes_old_clones(tmp_path):
    import time
    cloner = RepoCloner(clone_base_dir=str(tmp_path), ttl_hours=0)
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {"model.py": "import torch"})
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            await cloner.clone("https://github.com/user/repo")
    count = await cloner.cleanup_all_expired()
    assert count >= 1


@pytest.mark.asyncio
async def test_clone_result_has_expected_fields(tmp_path):
    cloner = RepoCloner(clone_base_dir=str(tmp_path))
    repo_dir = tmp_path / "repo"
    _make_fake_repo(repo_dir, {"model.py": "import torch"})
    with patch.object(cloner, "_do_clone", return_value=None):
        with patch.object(cloner, "_resolve_clone_path", return_value=repo_dir):
            result = await cloner.clone("https://github.com/user/repo")
    assert result.clone_id
    assert result.local_path
    assert isinstance(result.python_files, list)
    assert isinstance(result.has_pytorch, bool)
    assert isinstance(result.pytorch_files, list)
