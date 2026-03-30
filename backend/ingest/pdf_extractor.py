"""
PdfExtractor — spec 07-pdf-extractor
Downloads arXiv PDFs and extracts paper metadata + introduction excerpt.
"""
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

import httpx
import pypdf


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class InvalidArxivURLError(ValueError):
    pass

class PaperNotFoundError(RuntimeError):
    pass

class PDFDownloadError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

@dataclass
class PaperMeta:
    title: str
    authors: list[str]
    abstract: str
    introduction_excerpt: str
    arxiv_url: str
    arxiv_id: str
    pdf_path: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ARXIV_ID_RE = re.compile(r'arxiv\.org/abs/([\d.]+?)(?:v\d+)?/?$', re.IGNORECASE)
_NS = {'atom': 'http://www.w3.org/2005/Atom'}


def _parse_arxiv_id(url: str) -> str:
    m = _ARXIV_ID_RE.search(url)
    if not m:
        raise InvalidArxivURLError(f"Cannot parse arXiv ID from URL: {url!r}")
    return m.group(1)


def _clean_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def _extract_intro(text: str, max_chars: int = 1500) -> str:
    idx = text.lower().find('introduction')
    if idx != -1:
        excerpt = text[idx + len('introduction'):].lstrip(' \n\t:')
    else:
        excerpt = text
    # Basic cleanup: remove hyphenation artifacts
    excerpt = re.sub(r'-\n', '', excerpt)
    excerpt = re.sub(r'\s+', ' ', excerpt)
    return excerpt[:max_chars].strip()


# ---------------------------------------------------------------------------
# PdfExtractor
# ---------------------------------------------------------------------------

class PdfExtractor:
    ARXIV_API = "https://export.arxiv.org/api/query?id_list={arxiv_id}"
    PDF_URL = "https://arxiv.org/pdf/{arxiv_id}.pdf"
    TIMEOUT = 120.0

    async def extract(self, arxiv_url: str, output_dir: Path) -> PaperMeta:
        arxiv_id = _parse_arxiv_id(arxiv_url)
        output_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = output_dir / "paper.pdf"

        async with httpx.AsyncClient(timeout=self.TIMEOUT, follow_redirects=True) as client:
            meta = await self._fetch_metadata(client, arxiv_id, arxiv_url)
            await self._download_pdf(client, arxiv_id, pdf_path)

        intro = self._extract_intro_from_pdf(pdf_path, meta.abstract)
        meta.introduction_excerpt = intro
        meta.pdf_path = str(pdf_path)
        return meta

    async def _fetch_metadata(
        self, client: httpx.AsyncClient, arxiv_id: str, arxiv_url: str
    ) -> PaperMeta:
        url = self.ARXIV_API.format(arxiv_id=arxiv_id)
        resp = await client.get(url)
        resp.raise_for_status()

        root = ET.fromstring(resp.text)
        entries = root.findall('atom:entry', _NS)
        if not entries:
            raise PaperNotFoundError(f"No paper found for arXiv ID: {arxiv_id}")

        entry = entries[0]

        title_el = entry.find('atom:title', _NS)
        title = _clean_text(title_el.text or "") if title_el is not None else ""

        summary_el = entry.find('atom:summary', _NS)
        abstract = _clean_text(summary_el.text or "") if summary_el is not None else ""

        authors = [
            _clean_text(n.text or "")
            for author in entry.findall('atom:author', _NS)
            if (n := author.find('atom:name', _NS)) is not None
        ]

        return PaperMeta(
            title=title,
            authors=authors,
            abstract=abstract,
            introduction_excerpt="",  # filled after PDF download
            arxiv_url=arxiv_url,
            arxiv_id=arxiv_id,
            pdf_path="",
        )

    async def _download_pdf(
        self, client: httpx.AsyncClient, arxiv_id: str, dest: Path
    ) -> None:
        url = self.PDF_URL.format(arxiv_id=arxiv_id)
        try:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                with dest.open("wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=65536):
                        f.write(chunk)
        except httpx.HTTPError as exc:
            raise PDFDownloadError(f"Failed to download PDF: {exc}") from exc

    def _extract_intro_from_pdf(self, pdf_path: Path, abstract: str) -> str:
        try:
            reader = pypdf.PdfReader(str(pdf_path))
            pages_text = ""
            for page in reader.pages[:3]:
                pages_text += page.extract_text() or ""
            if not pages_text.strip():
                return abstract[:1500]
            return _extract_intro(pages_text)
        except Exception:
            return abstract[:1500]
