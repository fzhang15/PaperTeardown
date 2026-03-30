---
id: dinov3
arxiv: https://arxiv.org/abs/2508.10104
repo: https://github.com/facebookresearch/dinov3
detail_level: detailed
status: draft
---

# Paper: DINOv3: Self-Supervised Visual Representation Learning with Multi-Scale Vision Transformers

**Authors**: Facebook AI Research
**Venue**: arXiv, 2025

## Why this paper

DINOv3 extends the DINOv2 self-supervised learning framework with multi-scale vision transformers and improved training strategies. It represents the latest evolution of the DINO family of models.

## Expected modules

- `DINOv3` — main model wrapper
- `MultiScaleViT` — multi-scale vision transformer backbone
- `DINOHead` — projection head for self-distillation
- `MultiScaleBlock` — transformer block with multi-scale attention
- `CrossScaleAttention` — attention across different scales
- `DINOLoss` — self-distillation loss

## Notes for ingestion

- Main model files are in the repo root or `dinov3/` directory
- Focus on the multi-scale architecture components
- Use `detailed` analysis for the attention mechanisms
