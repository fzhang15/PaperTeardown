"""
Tests for PdfExtractor — spec 07-pdf-extractor.
All HTTP calls and PDF reads are mocked.
"""
import textwrap
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch, mock_open

import pytest

from ingest.pdf_extractor import (
    InvalidArxivURLError,
    PDFDownloadError,
    PaperNotFoundError,
    PdfExtractor,
    _extract_intro,
    _parse_arxiv_id,
)

# ---------------------------------------------------------------------------
# _parse_arxiv_id
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("url,expected", [
    ("https://arxiv.org/abs/2304.07193", "2304.07193"),
    ("https://arxiv.org/abs/2304.07193v2", "2304.07193"),
    ("https://arxiv.org/abs/1706.03762", "1706.03762"),
    ("http://arxiv.org/abs/2304.07193/", "2304.07193"),
])
def test_parse_arxiv_id_valid(url, expected):
    assert _parse_arxiv_id(url) == expected

@pytest.mark.parametrize("url", [
    "https://arxiv.org/pdf/2304.07193",
    "https://github.com/user/repo",
    "not-a-url",
    "",
])
def test_parse_arxiv_id_invalid_raises(url):
    with pytest.raises(InvalidArxivURLError):
        _parse_arxiv_id(url)

# ---------------------------------------------------------------------------
# _extract_intro
# ---------------------------------------------------------------------------

def test_extract_intro_finds_introduction_heading():
    text = "Abstract: blah blah. Introduction This is the intro text. More text here."
    result = _extract_intro(text, max_chars=50)
    assert "intro text" in result
    assert "Abstract" not in result

def test_extract_intro_falls_back_to_start_if_no_heading():
    text = "No heading here, just plain text that goes on."
    result = _extract_intro(text, max_chars=20)
    assert len(result) <= 20

def test_extract_intro_respects_max_chars():
    text = "Introduction " + "x" * 2000
    result = _extract_intro(text, max_chars=100)
    assert len(result) <= 100

# ---------------------------------------------------------------------------
# PdfExtractor.extract — mocked HTTP
# ---------------------------------------------------------------------------

SAMPLE_ATOM = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>DINOv2: Learning Robust Visual Features</title>
    <author><name>Maxime Oquab</name></author>
    <author><name>Timothée Darcet</name></author>
    <summary>We present DINOv2, a method for self-supervised learning.</summary>
  </entry>
</feed>"""


def _make_mock_client(atom_xml=SAMPLE_ATOM, pdf_bytes=b"%PDF-1.4 fake"):
    client = AsyncMock()

    # GET for arXiv API
    api_resp = MagicMock()
    api_resp.text = atom_xml
    api_resp.raise_for_status = MagicMock()
    client.get.return_value = api_resp

    # stream context manager for PDF — must be a MagicMock so calling it returns the ctx directly
    stream_resp = AsyncMock()
    stream_resp.raise_for_status = MagicMock()

    async def aiter_bytes(chunk_size=65536):
        yield pdf_bytes

    stream_resp.aiter_bytes = aiter_bytes

    stream_ctx = MagicMock()
    stream_ctx.__aenter__ = AsyncMock(return_value=stream_resp)
    stream_ctx.__aexit__ = AsyncMock(return_value=False)

    # stream() must be a plain MagicMock so it returns stream_ctx directly (not a coroutine)
    client.stream = MagicMock(return_value=stream_ctx)

    return client


@pytest.mark.asyncio
async def test_extract_returns_correct_title(tmp_path):
    extractor = PdfExtractor()
    mock_client = _make_mock_client()
    with patch("ingest.pdf_extractor.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        with patch.object(extractor, "_extract_intro_from_pdf", return_value="intro text"):
            result = await extractor.extract("https://arxiv.org/abs/2304.07193", tmp_path)
    assert result.title == "DINOv2: Learning Robust Visual Features"


@pytest.mark.asyncio
async def test_extract_returns_authors(tmp_path):
    extractor = PdfExtractor()
    mock_client = _make_mock_client()
    with patch("ingest.pdf_extractor.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        with patch.object(extractor, "_extract_intro_from_pdf", return_value=""):
            result = await extractor.extract("https://arxiv.org/abs/2304.07193", tmp_path)
    assert "Maxime Oquab" in result.authors
    assert "Timothée Darcet" in result.authors


@pytest.mark.asyncio
async def test_extract_saves_pdf_to_output_dir(tmp_path):
    extractor = PdfExtractor()
    mock_client = _make_mock_client(pdf_bytes=b"%PDF-1.4 test")
    with patch("ingest.pdf_extractor.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        with patch.object(extractor, "_extract_intro_from_pdf", return_value=""):
            result = await extractor.extract("https://arxiv.org/abs/2304.07193", tmp_path)
    assert Path(result.pdf_path).exists()
    assert Path(result.pdf_path).name == "paper.pdf"


@pytest.mark.asyncio
async def test_extract_strips_version_from_arxiv_id(tmp_path):
    extractor = PdfExtractor()
    mock_client = _make_mock_client()
    with patch("ingest.pdf_extractor.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        with patch.object(extractor, "_extract_intro_from_pdf", return_value=""):
            result = await extractor.extract("https://arxiv.org/abs/2304.07193v3", tmp_path)
    assert result.arxiv_id == "2304.07193"


@pytest.mark.asyncio
async def test_invalid_arxiv_url_raises(tmp_path):
    extractor = PdfExtractor()
    with pytest.raises(InvalidArxivURLError):
        await extractor.extract("https://github.com/user/repo", tmp_path)


@pytest.mark.asyncio
async def test_empty_arxiv_api_response_raises_not_found(tmp_path):
    empty_atom = """<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>"""
    extractor = PdfExtractor()
    mock_client = _make_mock_client(atom_xml=empty_atom)
    with patch("ingest.pdf_extractor.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
        with pytest.raises(PaperNotFoundError):
            await extractor.extract("https://arxiv.org/abs/2304.07193", tmp_path)


def test_extract_intro_from_pdf_falls_back_on_pypdf_error(tmp_path):
    extractor = PdfExtractor()
    fake_pdf = tmp_path / "paper.pdf"
    fake_pdf.write_bytes(b"not a real pdf")
    result = extractor._extract_intro_from_pdf(fake_pdf, "fallback abstract text")
    assert result == "fallback abstract text"
