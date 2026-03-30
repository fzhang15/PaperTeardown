---
id: dinov2
arxiv: https://arxiv.org/abs/2304.07193
repo: https://github.com/facebookresearch/dinov2
detail_level: detailed
status: draft
---

# Paper: DINOv2: Learning Robust Visual Features without Supervision

**Authors**: Maxime Oquab, Timothée Darcet, Théo Moutakanni, et al.
**Venue**: TMLR, 2024

## Why this paper

DINOv2 is a landmark self-supervised learning method that produces universal visual features competitive with weakly-supervised models. It combines a ViT backbone with self-distillation (student-teacher), and its codebase is a clean example of production-quality PyTorch research code.

## Expected modules

- `DinoVisionTransformer` — main ViT backbone
- `BlockChunk` — wrapper for chunked attention blocks
- `Attention` / `MemEffAttention` — self-attention implementations
- `Mlp` — feed-forward network within transformer blocks
- `NestedTensorBlock` — block supporting nested tensors
- `DINOHead` — projection head for self-distillation
- `DINOLoss` — self-distillation loss function

## Notes for ingestion

- Main model files are in `dinov2/models/`
- Training code is in `dinov2/train/`
- Skip `hubconf.py` and setup files
- Use `detailed` analysis for attention and training loop
