---
id: sam3
arxiv: https://arxiv.org/abs/2511.16719
repo: https://github.com/facebookresearch/sam3
detail_level: detailed
status: draft
---

# Paper: SAM 3 — Segment Anything in Images, Videos, and 3D

**Authors**: Meta FAIR
**Venue**: arXiv 2025

## Why this paper

SAM3 extends the Segment Anything line (SAM → SAM2 → SAM3) to unified image, video, and 3D segmentation. It represents the frontier of prompt-based segmentation models with a single architecture handling multiple modalities.

## Expected modules

- `Sam3Model` — main model
- `ImageEncoder` — image/frame encoder (likely ViT-based)
- `PromptEncoder` — encodes points, boxes, masks
- `MaskDecoder` — decodes masks from embeddings + prompts
- Memory/temporal modules for video
- 3D-specific modules

## Notes for ingestion

- Main model files likely in `sam3/` or `segment_anything_3/`
- Look for video and 3D extensions beyond SAM2
- Skip demo/notebook files
