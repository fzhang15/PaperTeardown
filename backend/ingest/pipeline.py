"""
IngestPipeline — spec 06-ingest-pipeline
Clones repo, parses PyTorch modules, downloads PDF metadata, and writes
static JSON files. Analysis (overview/annotations) is filled in manually.
"""
import asyncio
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from cloner.repo_cloner import RepoCloner
from ingest.pdf_extractor import PdfExtractor
from parser.pytorch_parser import PyTorchParser


DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "papers"
INDEX_PATH = DATA_DIR / "index.json"


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class IngestConfig:
    id: str
    arxiv_url: str
    repo_url: str
    detail_level: str = "detailed"
    force: bool = False


# ---------------------------------------------------------------------------
# Console helpers
# ---------------------------------------------------------------------------

def _step(n: int, total: int, msg: str) -> None:
    print(f"\n[{n}/{total}] {msg}", flush=True)

def _info(msg: str) -> None:
    print(f"      {msg}", flush=True)

def _ok(msg: str) -> None:
    print(f"\n[✓] {msg}", flush=True)

def _fail(msg: str) -> None:
    print(f"\n[✗] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Index management
# ---------------------------------------------------------------------------

def _load_index() -> list[dict]:
    if INDEX_PATH.exists():
        return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    return []


def _save_index(entries: list[dict]) -> None:
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")


def _upsert_index(entry: dict) -> int:
    entries = _load_index()
    existing = next((i for i, e in enumerate(entries) if e["id"] == entry["id"]), None)
    if existing is not None:
        entries[existing] = entry
    else:
        entries.append(entry)
    _save_index(entries)
    return len(entries)


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

TOTAL_STEPS = 6


class IngestPipeline:
    async def run(self, config: IngestConfig) -> None:
        paper_dir = DATA_DIR / config.id
        start = datetime.now()

        if paper_dir.exists() and not config.force:
            print(f"Warning: {paper_dir} already exists. Use --force to overwrite.")

        paper_dir.mkdir(parents=True, exist_ok=True)

        # --- Step 1: arXiv metadata + PDF ---
        _step(1, TOTAL_STEPS, "Fetching paper metadata from arXiv...")
        extractor = PdfExtractor()
        paper_meta = await extractor.extract(config.arxiv_url, paper_dir)
        _info(f"Title: {paper_meta.title}")
        authors_display = ", ".join(paper_meta.authors[:2])
        if len(paper_meta.authors) > 2:
            authors_display += ", et al."
        _info(f"Authors: {authors_display}")

        # --- Step 2: PDF size ---
        pdf_path = Path(paper_meta.pdf_path)
        _step(2, TOTAL_STEPS, "Downloading PDF...")
        size_mb = pdf_path.stat().st_size / 1_048_576
        _info(f"Saved to {pdf_path} ({size_mb:.1f} MB)")

        # --- Step 3: Clone ---
        _step(3, TOTAL_STEPS, "Cloning repository...")
        _info(config.repo_url)
        cloner = RepoCloner()
        clone_result = await cloner.clone(config.repo_url)
        _info(f"Found {len(clone_result.python_files)} Python files, "
              f"{len(clone_result.pytorch_files)} with PyTorch imports")

        # --- Step 4: Parse ---
        _step(4, TOTAL_STEPS, "Parsing PyTorch code...")
        parser = PyTorchParser()
        parse_result = parser.parse(clone_result)
        _info(f"Found {len(parse_result.modules)} nn.Module classes, "
              f"{len(parse_result.training_loops)} training loop(s)")
        if parse_result.parse_errors:
            _info(f"({len(parse_result.parse_errors)} files had parse errors — skipped)")

        # --- Step 5: Write output files ---
        _step(5, TOTAL_STEPS, "Writing output files...")
        ingested_at = datetime.now(timezone.utc).isoformat()

        meta_dict = {
            "id": config.id,
            "title": paper_meta.title,
            "authors": paper_meta.authors,
            "arxiv_url": paper_meta.arxiv_url,
            "repo_url": config.repo_url,
            "abstract": paper_meta.abstract,
            "introduction_excerpt": paper_meta.introduction_excerpt,
            "module_count": len(parse_result.modules),
            "pytorch_file_count": len(clone_result.pytorch_files),
            "ingested_at": ingested_at,
        }

        meta_path = paper_dir / "meta.json"
        meta_path.write_text(json.dumps(meta_dict, indent=2, ensure_ascii=False), encoding="utf-8")
        _info(str(meta_path))

        # Skeleton analysis.json — module names/paths from parser, explanations empty
        skeleton = {
            "analyzed_modules": [
                {
                    "module_name": m.class_name,
                    "file_path": m.file_path,
                    "overview": "",
                    "annotations": [],
                }
                for m in parse_result.modules
            ],
            "analyzed_loops": [
                {
                    "function_name": lp.function_name,
                    "file_path": lp.file_path,
                    "overview": "",
                    "annotations": [],
                }
                for lp in parse_result.training_loops
            ],
            "summary": "",
        }

        analysis_path = paper_dir / "analysis.json"
        analysis_path.write_text(
            json.dumps(skeleton, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        _info(str(analysis_path))

        # --- Step 6: Update index + cleanup ---
        _step(6, TOTAL_STEPS, "Updating index and cleaning up...")
        index_entry = {k: meta_dict[k] for k in
                       ("id", "title", "authors", "arxiv_url", "repo_url",
                        "abstract", "module_count", "ingested_at")}
        total_papers = _upsert_index(index_entry)
        _info(f"{INDEX_PATH} ({total_papers} paper(s) total)")
        await cloner.cleanup(clone_result.clone_id)

        elapsed = (datetime.now() - start).total_seconds()
        _ok(f"Ingested '{config.id}' in {elapsed:.1f}s — ready for manual analysis")
        _info(f"Edit {analysis_path} to add overviews and annotations.")
