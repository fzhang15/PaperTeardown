"""
Tests for API Server — derived from specs/05-api-server.md acceptance criteria.
Uses httpx AsyncClient against the FastAPI app; all pipeline modules are mocked.
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from api.main import app
from analyzer.code_analyzer import AnalysisResult, AnalyzedModule
from cloner.repo_cloner import CloneResult, InvalidURLError, RepoNotFoundError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_clone_result():
    return CloneResult(
        clone_id="abc",
        local_path="/tmp/abc",
        python_files=["model.py"],
        has_pytorch=True,
        pytorch_files=["model.py"],
    )


def _mock_parse_result():
    from parser.pytorch_parser import ParseResult
    return ParseResult(modules=[], training_loops=[], parse_errors=[])


def _mock_analysis_result():
    return AnalysisResult(
        analyzed_modules=[
            AnalyzedModule(module_name="Net", file_path="model.py", overview="A simple net.", annotations=[])
        ],
        analyzed_loops=[],
        summary="",
    )


async def _patched_client(clone_result=None, parse_result=None, analysis_result=None,
                           clone_side_effect=None):
    """Return an AsyncClient with the full pipeline mocked."""
    cr = clone_result or _mock_clone_result()
    pr = parse_result or _mock_parse_result()
    ar = analysis_result or _mock_analysis_result()

    with patch("api.routes.analyze.RepoCloner") as MockCloner, \
         patch("api.routes.analyze.PyTorchParser") as MockParser, \
         patch("api.routes.analyze.CodeAnalyzer") as MockAnalyzer:

        cloner_instance = AsyncMock()
        if clone_side_effect:
            cloner_instance.clone.side_effect = clone_side_effect
        else:
            cloner_instance.clone.return_value = cr
        cloner_instance.cleanup = AsyncMock()
        MockCloner.return_value = cloner_instance

        parser_instance = MagicMock()
        parser_instance.parse.return_value = pr
        MockParser.return_value = parser_instance

        analyzer_instance = AsyncMock()
        analyzer_instance.analyze.return_value = ar
        MockAnalyzer.return_value = analyzer_instance

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, MockCloner, MockParser, MockAnalyzer


# ---------------------------------------------------------------------------
# /api/health
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_returns_200():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ok"


# ---------------------------------------------------------------------------
# POST /api/analyze
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_analyze_returns_job_id_immediately():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.routes.analyze.RepoCloner"), \
             patch("api.routes.analyze.PyTorchParser"), \
             patch("api.routes.analyze.CodeAnalyzer"):
            resp = await client.post("/api/analyze", json={
                "repo_url": "https://github.com/user/repo",
                "detail_level": "overview",
            })
    assert resp.status_code == 200
    body = resp.json()
    assert body["error"] is None
    assert "job_id" in body["data"]


@pytest.mark.asyncio
async def test_analyze_invalid_url_returns_400():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/analyze", json={"repo_url": "not-a-url"})
    assert resp.status_code == 400
    body = resp.json()
    assert body["error"] is not None
    assert body["data"] is None


@pytest.mark.asyncio
async def test_analyze_missing_repo_url_returns_422():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/analyze", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_detail_level_defaults_to_overview():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.routes.analyze.RepoCloner"), \
             patch("api.routes.analyze.PyTorchParser"), \
             patch("api.routes.analyze.CodeAnalyzer"):
            resp = await client.post("/api/analyze", json={"repo_url": "https://github.com/user/repo"})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/status/{job_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_status_unknown_job_returns_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/status/nonexistent-job-id")
    assert resp.status_code == 404
    assert resp.json()["error"] is not None


@pytest.mark.asyncio
async def test_status_reflects_done_after_pipeline_completes():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.routes.analyze.RepoCloner") as MockCloner, \
             patch("api.routes.analyze.PyTorchParser") as MockParser, \
             patch("api.routes.analyze.CodeAnalyzer") as MockAnalyzer:
            cloner_inst = AsyncMock()
            cloner_inst.clone.return_value = _mock_clone_result()
            cloner_inst.cleanup = AsyncMock()
            MockCloner.return_value = cloner_inst
            MockParser.return_value.parse.return_value = _mock_parse_result()
            analyzer_inst = AsyncMock()
            analyzer_inst.analyze.return_value = _mock_analysis_result()
            MockAnalyzer.return_value = analyzer_inst

            resp = await client.post("/api/analyze", json={"repo_url": "https://github.com/user/repo"})
            job_id = resp.json()["data"]["job_id"]

            # Poll until done (max 3s)
            for _ in range(30):
                status_resp = await client.get(f"/api/status/{job_id}")
                if status_resp.json()["data"]["status"] in ("done", "error"):
                    break
                await asyncio.sleep(0.1)

            assert status_resp.json()["data"]["status"] == "done"


@pytest.mark.asyncio
async def test_status_reflects_error_when_clone_fails():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.routes.analyze.RepoCloner") as MockCloner, \
             patch("api.routes.analyze.PyTorchParser"), \
             patch("api.routes.analyze.CodeAnalyzer"):
            cloner_inst = AsyncMock()
            cloner_inst.clone.side_effect = RepoNotFoundError("not found")
            MockCloner.return_value = cloner_inst

            resp = await client.post("/api/analyze", json={"repo_url": "https://github.com/user/repo"})
            job_id = resp.json()["data"]["job_id"]

            for _ in range(30):
                status_resp = await client.get(f"/api/status/{job_id}")
                if status_resp.json()["data"]["status"] in ("done", "error"):
                    break
                await asyncio.sleep(0.1)

            assert status_resp.json()["data"]["status"] == "error"
            assert status_resp.json()["data"]["error"] is not None


# ---------------------------------------------------------------------------
# GET /api/result/{job_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_result_returns_analysis_when_done():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.routes.analyze.RepoCloner") as MockCloner, \
             patch("api.routes.analyze.PyTorchParser") as MockParser, \
             patch("api.routes.analyze.CodeAnalyzer") as MockAnalyzer:
            cloner_inst = AsyncMock()
            cloner_inst.clone.return_value = _mock_clone_result()
            cloner_inst.cleanup = AsyncMock()
            MockCloner.return_value = cloner_inst
            MockParser.return_value.parse.return_value = _mock_parse_result()
            analyzer_inst = AsyncMock()
            analyzer_inst.analyze.return_value = _mock_analysis_result()
            MockAnalyzer.return_value = analyzer_inst

            resp = await client.post("/api/analyze", json={"repo_url": "https://github.com/user/repo"})
            job_id = resp.json()["data"]["job_id"]

            for _ in range(30):
                s = await client.get(f"/api/status/{job_id}")
                if s.json()["data"]["status"] in ("done", "error"):
                    break
                await asyncio.sleep(0.1)

            result_resp = await client.get(f"/api/result/{job_id}")
    assert result_resp.status_code == 200
    body = result_resp.json()
    assert body["error"] is None
    assert "analyzed_modules" in body["data"]


@pytest.mark.asyncio
async def test_result_unknown_job_returns_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/result/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_result_pending_job_returns_404():
    """A job that hasn't finished yet should return 404 on /result."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.routes.analyze.RepoCloner") as MockCloner, \
             patch("api.routes.analyze.PyTorchParser"), \
             patch("api.routes.analyze.CodeAnalyzer"):
            # Make clone hang so job stays in progress
            async def slow_clone(*a, **kw):
                await asyncio.sleep(60)
            cloner_inst = AsyncMock()
            cloner_inst.clone.side_effect = slow_clone
            MockCloner.return_value = cloner_inst

            resp = await client.post("/api/analyze", json={"repo_url": "https://github.com/user/repo"})
            job_id = resp.json()["data"]["job_id"]

            result_resp = await client.get(f"/api/result/{job_id}")
    assert result_resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/job/{job_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_job_returns_200():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.routes.analyze.RepoCloner") as MockCloner, \
             patch("api.routes.analyze.PyTorchParser") as MockParser, \
             patch("api.routes.analyze.CodeAnalyzer") as MockAnalyzer:
            cloner_inst = AsyncMock()
            cloner_inst.clone.return_value = _mock_clone_result()
            cloner_inst.cleanup = AsyncMock()
            MockCloner.return_value = cloner_inst
            MockParser.return_value.parse.return_value = _mock_parse_result()
            analyzer_inst = AsyncMock()
            analyzer_inst.analyze.return_value = _mock_analysis_result()
            MockAnalyzer.return_value = analyzer_inst

            create_resp = await client.post("/api/analyze", json={"repo_url": "https://github.com/user/repo"})
            job_id = create_resp.json()["data"]["job_id"]

            del_resp = await client.delete(f"/api/job/{job_id}")
    assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_unknown_job_returns_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.delete("/api/job/nonexistent")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Error envelope
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_all_errors_use_standard_envelope():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.post("/api/analyze", json={"repo_url": "bad-url"})
        r2 = await client.get("/api/status/missing")
        r3 = await client.get("/api/result/missing")
        r4 = await client.delete("/api/job/missing")

    for r in (r1, r2, r3, r4):
        body = r.json()
        assert "data" in body
        assert "error" in body
