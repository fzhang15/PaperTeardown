# Spec: Data Schema

**Status**: `draft`
**ID**: 08-data-schema
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

Defines the static JSON file formats written by the ingest pipeline and read by the frontend. No database — all data lives as files under `data/papers/<id>/`.

## Directory Layout

```
data/
└── papers/
    ├── index.json              # master list of all ingested papers
    └── <paper-id>/
        ├── meta.json           # paper metadata
        ├── analysis.json       # module analysis results
        └── paper.pdf           # original PDF
```

## `data/papers/index.json`

Global index maintained by the ingest pipeline. Updated (appended/replaced) on every successful ingest run.

```json
[
  {
    "id": "dinov2",
    "title": "DINOv2: Learning Robust Visual Features without Supervision",
    "authors": ["Maxime Oquab", "Timothée Darcet", "et al."],
    "arxiv_url": "https://arxiv.org/abs/2304.07193",
    "repo_url": "https://github.com/facebookresearch/dinov2",
    "abstract": "...",
    "module_count": 5,
    "ingested_at": "2026-03-29T18:00:00Z"
  }
]
```

Fields:
- `id` — matches folder name, from spec frontmatter
- `title` — extracted from arXiv API or PDF
- `authors` — list of author name strings
- `arxiv_url` — canonical arXiv URL
- `repo_url` — GitHub repo URL
- `abstract` — full abstract text
- `module_count` — number of `nn.Module` classes found
- `ingested_at` — ISO 8601 timestamp

## `data/papers/<id>/meta.json`

Full metadata for a single paper. Superset of the index entry.

```json
{
  "id": "dinov2",
  "title": "DINOv2: ...",
  "authors": ["..."],
  "arxiv_url": "https://arxiv.org/abs/2304.07193",
  "repo_url": "https://github.com/facebookresearch/dinov2",
  "abstract": "...",
  "introduction_excerpt": "First 1500 chars of introduction used as LLM context...",
  "module_count": 5,
  "pytorch_file_count": 12,
  "ingested_at": "2026-03-29T18:00:00Z"
}
```

Additional fields beyond the index entry:
- `introduction_excerpt` — text extracted from intro section (used as LLM context, also displayed in UI)
- `pytorch_file_count` — number of `.py` files with torch imports

## `data/papers/<id>/analysis.json`

Full analysis output from `CodeAnalyzer`. Shape mirrors `AnalysisResult` from spec 03.

```json
{
  "analyzed_modules": [
    {
      "module_name": "DinoVisionTransformer",
      "file_path": "dinov2/models/vision_transformer.py",
      "overview": "Main ViT model. Takes image patches...",
      "annotations": [
        {
          "start_line": 142,
          "end_line": 144,
          "explanation": "Embeds input patches using a learned projection...",
          "concept_tag": "embedding"
        }
      ],
      "error": null
    }
  ],
  "analyzed_loops": [],
  "summary": "DINOv2 implements a Vision Transformer..."
}
```

## Acceptance Criteria

- [ ] `index.json` is valid JSON array, each entry has all required fields
- [ ] `meta.json` passes schema validation (all required fields present)
- [ ] `analysis.json` shape matches `AnalysisResult` from spec 03
- [ ] Re-running ingest for an existing paper replaces (not duplicates) its entry in `index.json`
- [ ] `paper.pdf` is a valid PDF file readable by browsers

## Dependencies

- Spec 06 (ingest pipeline writes these files)
- Spec 03 (AnalysisResult shape)
