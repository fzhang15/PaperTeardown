# Spec: Ingest Pipeline

**Status**: `draft`
**ID**: 06-ingest-pipeline
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

CLI script that orchestrates the full ingestion of one paper: reads a paper spec file, downloads the PDF, clones the GitHub repo, parses PyTorch code, runs LLM analysis, and writes the results as static JSON + PDF into `data/papers/<id>/`.

## Goals

- Single command to ingest a paper from a spec file
- Idempotent: re-running replaces existing output cleanly
- Rich console progress output
- Updates `data/papers/index.json` after successful ingest

## Non-Goals

- Batch ingestion of multiple papers in one command (run the command multiple times)
- Background/async job system (synchronous CLI only)
- Admin UI

## Usage

```bash
# From repo root
python -m backend.ingest --spec specs/papers/dinov2.md

# Or with inline args (no spec file)
python -m backend.ingest --id dinov2 \
  --arxiv https://arxiv.org/abs/2304.07193 \
  --repo https://github.com/facebookresearch/dinov2 \
  --detail detailed
```

## Paper Spec File Format

YAML frontmatter in a Markdown file under `specs/papers/`:

```markdown
---
id: dinov2
arxiv: https://arxiv.org/abs/2304.07193
repo: https://github.com/facebookresearch/dinov2
detail_level: detailed
status: draft
---

# Paper: DINOv2

Notes about the paper...
```

Required frontmatter fields: `id`, `arxiv`, `repo`
Optional: `detail_level` (default: `detailed`), `status`

## Pipeline Steps

```
Step 1: Validate inputs
  └─ Parse spec file or CLI args
  └─ Validate arXiv URL format
  └─ Validate GitHub URL format

Step 2: Setup output directory
  └─ Create data/papers/<id>/
  └─ If exists: warn user, continue (overwrite mode)

Step 3: Download PDF + extract metadata [PdfExtractor]
  └─ Fetch title, authors, abstract from arXiv API
  └─ Download PDF to data/papers/<id>/paper.pdf
  └─ Extract introduction excerpt (first 3 pages)

Step 4: Clone repo [RepoCloner]
  └─ Shallow clone to tmp/clones/<id>/
  └─ Detect PyTorch files

Step 5: Parse PyTorch code [PyTorchParser]
  └─ Extract nn.Module classes + forward() methods
  └─ Extract training loops

Step 6: Analyze with LLM [CodeAnalyzer]
  └─ Pass abstract + introduction as context
  └─ Analyze each module at specified detail_level
  └─ Print progress per module

Step 7: Write output files
  └─ data/papers/<id>/meta.json
  └─ data/papers/<id>/analysis.json
  └─ (paper.pdf already written in step 3)

Step 8: Update index
  └─ Load data/papers/index.json (or create if missing)
  └─ Replace existing entry for this id (or append)
  └─ Write back

Step 9: Cleanup
  └─ Delete cloned repo from tmp/

Step 10: Update spec status
  └─ Set status: implemented in the spec frontmatter
```

## Console Output Format

```
[1/8] Fetching paper metadata from arXiv...
      Title: DINOv2: Learning Robust Visual Features without Supervision
      Authors: Maxime Oquab, Timothée Darcet, et al.

[2/8] Downloading PDF...
      Saved to data/papers/dinov2/paper.pdf (4.2 MB)

[3/8] Cloning repository...
      https://github.com/facebookresearch/dinov2
      Found 23 Python files, 8 with PyTorch imports

[4/8] Parsing PyTorch code...
      Found 6 nn.Module classes, 1 training loop

[5/8] Analyzing modules (detailed)...
      [1/6] DinoVisionTransformer... done
      [2/6] BlockChunk... done
      [3/6] Attention... done
      [4/6] Mlp... done
      [5/6] MemEffAttention... done
      [6/6] NestedTensorBlock... done

[6/8] Writing output files...
      data/papers/dinov2/meta.json
      data/papers/dinov2/analysis.json

[7/8] Updating index...
      data/papers/index.json (3 papers total)

[8/8] Done! ✓
      Ingested dinov2 in 47.3s
```

## Error Handling

- Any step failure prints a clear error message and exits with code 1
- Partially written files are cleaned up on failure (no corrupt state)
- `--force` flag skips the "already exists" warning

## Interface / API Contract

```python
# Entry point
python -m backend.ingest [--spec PATH] [--id ID --arxiv URL --repo URL] [--detail LEVEL] [--force]

# Importable for testing
from ingest.pipeline import IngestPipeline

@dataclass
class IngestConfig:
    id: str
    arxiv_url: str
    repo_url: str
    detail_level: str = "detailed"
    force: bool = False

class IngestPipeline:
    async def run(self, config: IngestConfig) -> None: ...
```

## Acceptance Criteria

- [ ] `python -m backend.ingest --spec specs/papers/dinov2.md` runs end-to-end
- [ ] `data/papers/<id>/meta.json`, `analysis.json`, `paper.pdf` all created
- [ ] `data/papers/index.json` updated with new entry
- [ ] Re-running replaces existing entry in index (no duplicates)
- [ ] Console shows step-by-step progress
- [ ] Failure in any step exits with code 1 and cleans up partial output
- [ ] Spec frontmatter `status` updated to `implemented` on success

## Dependencies

- Spec 07 (PdfExtractor)
- Spec 01 (RepoCloner)
- Spec 02 (PyTorchParser)
- Spec 03 (CodeAnalyzer)
- Spec 08 (data schema / output formats)
- `pyyaml` — add to `requirements.txt` (for spec frontmatter parsing)
