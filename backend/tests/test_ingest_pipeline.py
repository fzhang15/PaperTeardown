"""
Tests for IngestPipeline — spec 06-ingest-pipeline.
All external calls (HTTP, git, LLM) are mocked.
"""
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ingest.pipeline import IngestConfig, IngestPipeline, _upsert_index, _load_index


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_config(paper_id="testpaper", **kwargs) -> IngestConfig:
    return IngestConfig(
        id=paper_id,
        arxiv_url="https://arxiv.org/abs/2304.07193",
        repo_url="https://github.com/user/repo",
        **kwargs,
    )


def _make_paper_meta(tmp_path):
    from ingest.pdf_extractor import PaperMeta
    tmp_path.mkdir(parents=True, exist_ok=True)
    pdf = tmp_path / "paper.pdf"
    pdf.write_bytes(b"%PDF fake")
    return PaperMeta(
        title="Test Paper",
        authors=["Author A", "Author B"],
        abstract="An abstract.",
        introduction_excerpt="An introduction.",
        arxiv_url="https://arxiv.org/abs/2304.07193",
        arxiv_id="2304.07193",
        pdf_path=str(pdf),
    )


def _make_clone_result():
    from cloner.repo_cloner import CloneResult
    return CloneResult(
        clone_id="abc",
        local_path="/tmp/abc",
        python_files=["model.py"],
        has_pytorch=True,
        pytorch_files=["model.py"],
    )


def _make_parse_result():
    from parser.pytorch_parser import ParseResult
    return ParseResult(modules=[], training_loops=[], parse_errors=[])


def _make_analysis_result():
    from analyzer.code_analyzer import AnalysisResult
    return AnalysisResult(analyzed_modules=[], analyzed_loops=[], summary="")


# ---------------------------------------------------------------------------
# _upsert_index
# ---------------------------------------------------------------------------

def test_upsert_index_creates_index_file(tmp_path):
    with patch("ingest.pipeline.INDEX_PATH", tmp_path / "index.json"), \
         patch("ingest.pipeline.DATA_DIR", tmp_path):
        count = _upsert_index({"id": "paper1", "title": "Paper 1"})
    assert count == 1
    data = json.loads((tmp_path / "index.json").read_text())
    assert data[0]["id"] == "paper1"


def test_upsert_index_replaces_existing_entry(tmp_path):
    index_path = tmp_path / "index.json"
    index_path.write_text(json.dumps([{"id": "paper1", "title": "Old Title"}]))
    with patch("ingest.pipeline.INDEX_PATH", index_path), \
         patch("ingest.pipeline.DATA_DIR", tmp_path):
        count = _upsert_index({"id": "paper1", "title": "New Title"})
    assert count == 1
    data = json.loads(index_path.read_text())
    assert data[0]["title"] == "New Title"


def test_upsert_index_appends_new_entry(tmp_path):
    index_path = tmp_path / "index.json"
    index_path.write_text(json.dumps([{"id": "paper1", "title": "Paper 1"}]))
    with patch("ingest.pipeline.INDEX_PATH", index_path), \
         patch("ingest.pipeline.DATA_DIR", tmp_path):
        count = _upsert_index({"id": "paper2", "title": "Paper 2"})
    assert count == 2


# ---------------------------------------------------------------------------
# Full pipeline run
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pipeline_creates_output_files(tmp_path):
    config = _make_config()
    paper_dir = tmp_path / config.id

    with patch("ingest.pipeline.DATA_DIR", tmp_path), \
         patch("ingest.pipeline.INDEX_PATH", tmp_path / "index.json"), \
         patch("ingest.pipeline.PdfExtractor") as MockPdf, \
         patch("ingest.pipeline.RepoCloner") as MockCloner, \
         patch("ingest.pipeline.PyTorchParser") as MockParser, \
         patch("ingest.pipeline.CodeAnalyzer") as MockAnalyzer:

        MockPdf.return_value.extract = AsyncMock(return_value=_make_paper_meta(paper_dir))
        cloner = AsyncMock()
        cloner.clone.return_value = _make_clone_result()
        cloner.cleanup = AsyncMock()
        MockCloner.return_value = cloner
        MockParser.return_value.parse.return_value = _make_parse_result()
        analyzer = AsyncMock()
        analyzer.analyze.return_value = _make_analysis_result()
        MockAnalyzer.return_value = analyzer

        await IngestPipeline().run(config)

    assert (paper_dir / "meta.json").exists()
    assert (paper_dir / "analysis.json").exists()


@pytest.mark.asyncio
async def test_pipeline_writes_valid_meta_json(tmp_path):
    config = _make_config()
    paper_dir = tmp_path / config.id

    with patch("ingest.pipeline.DATA_DIR", tmp_path), \
         patch("ingest.pipeline.INDEX_PATH", tmp_path / "index.json"), \
         patch("ingest.pipeline.PdfExtractor") as MockPdf, \
         patch("ingest.pipeline.RepoCloner") as MockCloner, \
         patch("ingest.pipeline.PyTorchParser") as MockParser, \
         patch("ingest.pipeline.CodeAnalyzer") as MockAnalyzer:

        MockPdf.return_value.extract = AsyncMock(return_value=_make_paper_meta(paper_dir))
        cloner = AsyncMock()
        cloner.clone.return_value = _make_clone_result()
        cloner.cleanup = AsyncMock()
        MockCloner.return_value = cloner
        MockParser.return_value.parse.return_value = _make_parse_result()
        analyzer = AsyncMock()
        analyzer.analyze.return_value = _make_analysis_result()
        MockAnalyzer.return_value = analyzer

        await IngestPipeline().run(config)

    meta = json.loads((paper_dir / "meta.json").read_text())
    assert meta["id"] == config.id
    assert meta["title"] == "Test Paper"
    assert "ingested_at" in meta
    assert "abstract" in meta


@pytest.mark.asyncio
async def test_pipeline_updates_index_json(tmp_path):
    config = _make_config()
    paper_dir = tmp_path / config.id

    with patch("ingest.pipeline.DATA_DIR", tmp_path), \
         patch("ingest.pipeline.INDEX_PATH", tmp_path / "index.json"), \
         patch("ingest.pipeline.PdfExtractor") as MockPdf, \
         patch("ingest.pipeline.RepoCloner") as MockCloner, \
         patch("ingest.pipeline.PyTorchParser") as MockParser, \
         patch("ingest.pipeline.CodeAnalyzer") as MockAnalyzer:

        MockPdf.return_value.extract = AsyncMock(return_value=_make_paper_meta(paper_dir))
        cloner = AsyncMock()
        cloner.clone.return_value = _make_clone_result()
        cloner.cleanup = AsyncMock()
        MockCloner.return_value = cloner
        MockParser.return_value.parse.return_value = _make_parse_result()
        analyzer = AsyncMock()
        analyzer.analyze.return_value = _make_analysis_result()
        MockAnalyzer.return_value = analyzer

        await IngestPipeline().run(config)

    index = json.loads((tmp_path / "index.json").read_text())
    assert any(e["id"] == config.id for e in index)


@pytest.mark.asyncio
async def test_pipeline_cleans_up_clone_on_success(tmp_path):
    config = _make_config()
    paper_dir = tmp_path / config.id

    with patch("ingest.pipeline.DATA_DIR", tmp_path), \
         patch("ingest.pipeline.INDEX_PATH", tmp_path / "index.json"), \
         patch("ingest.pipeline.PdfExtractor") as MockPdf, \
         patch("ingest.pipeline.RepoCloner") as MockCloner, \
         patch("ingest.pipeline.PyTorchParser") as MockParser, \
         patch("ingest.pipeline.CodeAnalyzer") as MockAnalyzer:

        MockPdf.return_value.extract = AsyncMock(return_value=_make_paper_meta(paper_dir))
        cloner = AsyncMock()
        cloner.clone.return_value = _make_clone_result()
        cloner.cleanup = AsyncMock()
        MockCloner.return_value = cloner
        MockParser.return_value.parse.return_value = _make_parse_result()
        analyzer = AsyncMock()
        analyzer.analyze.return_value = _make_analysis_result()
        MockAnalyzer.return_value = analyzer

        await IngestPipeline().run(config)

    cloner.cleanup.assert_called_once()


@pytest.mark.asyncio
async def test_pipeline_re_run_replaces_index_entry(tmp_path):
    config = _make_config()
    paper_dir = tmp_path / config.id

    def run_pipeline():
        return IngestPipeline().run(config)

    patches = dict(
        DATA_DIR=tmp_path,
        INDEX_PATH=tmp_path / "index.json",
    )

    for _ in range(2):
        with patch("ingest.pipeline.DATA_DIR", tmp_path), \
             patch("ingest.pipeline.INDEX_PATH", tmp_path / "index.json"), \
             patch("ingest.pipeline.PdfExtractor") as MockPdf, \
             patch("ingest.pipeline.RepoCloner") as MockCloner, \
             patch("ingest.pipeline.PyTorchParser") as MockParser, \
             patch("ingest.pipeline.CodeAnalyzer") as MockAnalyzer:

            MockPdf.return_value.extract = AsyncMock(return_value=_make_paper_meta(paper_dir))
            cloner = AsyncMock()
            cloner.clone.return_value = _make_clone_result()
            cloner.cleanup = AsyncMock()
            MockCloner.return_value = cloner
            MockParser.return_value.parse.return_value = _make_parse_result()
            analyzer = AsyncMock()
            analyzer.analyze.return_value = _make_analysis_result()
            MockAnalyzer.return_value = analyzer

            await IngestPipeline().run(config)

    index = json.loads((tmp_path / "index.json").read_text())
    assert len([e for e in index if e["id"] == config.id]) == 1
