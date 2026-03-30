# Spec: PDF Extractor

**Status**: `draft`
**ID**: 07-pdf-extractor
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

Downloads an arXiv PDF given a URL, saves it to disk, and extracts title, authors, abstract, and an introduction excerpt (first ~1500 characters) for use as LLM context during code analysis.

## Goals

- Download and save the PDF from an arXiv URL
- Extract paper metadata via the arXiv API (title, authors, abstract) — more reliable than PDF parsing
- Extract introduction text from the PDF using `pypdf` (first 3 pages)
- Return structured metadata ready for `meta.json`

## Non-Goals

- Full-text PDF parsing beyond the first 3 pages
- Figure/table extraction
- Citation parsing
- Non-arXiv PDFs (deferred)

## Inputs & Outputs

**Input:**
- `arxiv_url: str` — e.g. `https://arxiv.org/abs/2304.07193`
- `output_dir: Path` — where to save `paper.pdf`

**Output:**
```python
@dataclass
class PaperMeta:
    title: str
    authors: list[str]
    abstract: str
    introduction_excerpt: str   # first ~1500 chars of intro text from PDF
    arxiv_url: str
    arxiv_id: str               # e.g. "2304.07193"
    pdf_path: str               # absolute path to saved PDF
```

## Detailed Behavior

### arXiv ID extraction

Parse the arXiv ID from the URL:
- `https://arxiv.org/abs/2304.07193` → `2304.07193`
- `https://arxiv.org/abs/2304.07193v2` → `2304.07193` (strip version suffix)

### Metadata via arXiv API

Call `https://export.arxiv.org/api/query?id_list=<arxiv_id>` — returns Atom XML.

Parse:
- `<title>` → paper title (strip newlines/extra whitespace)
- `<author><name>` → list of author names
- `<summary>` → abstract text

This is preferred over PDF parsing for metadata as it's structured and reliable.

### PDF Download

Construct PDF URL: `https://arxiv.org/pdf/<arxiv_id>.pdf`

Download with `httpx` (async), stream to file. Save as `<output_dir>/paper.pdf`.

Timeout: 120 seconds (PDFs can be large).

### Introduction Excerpt via pypdf

Open the saved PDF with `pypdf.PdfReader`. Extract text from pages 1–3 (0-indexed: 0, 1, 2).

Find the start of the introduction:
1. Look for the string "Introduction" (case-insensitive) in the extracted text
2. Take text from that point forward, up to 1500 characters
3. If "Introduction" not found, use the first 1500 characters of extracted text

Clean the excerpt: strip excessive whitespace, remove hyphenation artifacts.

### Error Cases

| Condition | Behavior |
|-----------|----------|
| Invalid arXiv URL | Raise `InvalidArxivURLError` |
| arXiv API returns no results | Raise `PaperNotFoundError` |
| PDF download fails (404, timeout) | Raise `PDFDownloadError` |
| pypdf can't parse PDF | Log warning; set `introduction_excerpt` to `""` |
| PDF text extraction returns empty | Set `introduction_excerpt` to abstract text |

## Interface / API Contract

```python
class PdfExtractor:
    async def extract(self, arxiv_url: str, output_dir: Path) -> PaperMeta: ...

class InvalidArxivURLError(ValueError): ...
class PaperNotFoundError(RuntimeError): ...
class PDFDownloadError(RuntimeError): ...
```

## Acceptance Criteria

- [ ] Correctly parses arXiv ID from URL (with and without version suffix)
- [ ] Returns title, authors, abstract from arXiv API
- [ ] Saves PDF to `output_dir/paper.pdf`
- [ ] Extracts introduction excerpt starting from "Introduction" heading
- [ ] Falls back to first 1500 chars if introduction not found
- [ ] `pypdf` parse failure does not crash — returns empty excerpt
- [ ] Invalid URLs raise `InvalidArxivURLError`

## Dependencies

- `httpx` (async HTTP)
- `pypdf` — add to `requirements.txt`
- `xml.etree.ElementTree` (stdlib, for arXiv API XML)
