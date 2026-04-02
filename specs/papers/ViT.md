---
id: ViT
arxiv: https://arxiv.org/abs/2010.11929
repo: https://github.com/google-research/vision_transformer
detail_level: detailed
status: draft
---

# Paper: An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale

**Authors**: Alexey Dosovitskiy, Lucas Beyer, Alexander Kolesnikov, et al.
**Venue**: ICLR 2021

## Why this paper

ViT is the foundational work that proved pure Transformers (without convolutions) can achieve state-of-the-art image classification when pre-trained on large datasets. It introduced the patch embedding paradigm that nearly all subsequent vision models build upon, including DINOv3, RT-1/RT-2, and VLA architectures.

## Expected modules

- `VisionTransformer` — main model: patch embed + Transformer encoder + classification head
- `Encoder` — stack of Transformer blocks
- `Encoder1DBlock` — single Transformer block (MHSA + MLP + residual)
- `AddPositionEmbs` — learned positional embeddings
- Patch embedding (Conv or linear projection)

## Notes for ingestion

- Original implementation is in JAX/Flax, not PyTorch — code in `vit_jax/`
- Key model file: `vit_jax/models_vit.py`
- Config file: `vit_jax/configs/`
- This is a JAX codebase — note this in the chapters but the architecture concepts transfer directly
