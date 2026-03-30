---
id: dit
arxiv: https://arxiv.org/abs/2212.09748
repo: https://github.com/facebookresearch/dit
detail_level: detailed
status: draft
---

# Paper: Scalable Diffusion Models with Transformers (DiT)

**Authors**: William Peebles, Saining Xie
**Venue**: ICCV 2023

## Why this paper

DiT replaces the U-Net backbone in latent diffusion models with a Vision Transformer, demonstrating that transformer scaling laws apply directly to diffusion. The key innovation — adaptive layer norm zero (adaLN-Zero) conditioning — elegantly injects timestep and class information into every block. DiT-XL/2 achieves state-of-the-art FID on class-conditional ImageNet, validating that compute-efficient transformers outperform convolutional architectures as a backbone for diffusion.

## Expected modules

- `DiT` — main diffusion transformer model
- `DiTBlock` — transformer block with adaLN-Zero conditioning
- `TimestepEmbedder` — sinusoidal timestep → vector
- `LabelEmbedder` — class label → vector (with CFG dropout)
- `FinalLayer` — final adaLN + linear projection to patch pixels

## Notes for ingestion

- All model code is in a single file: `models.py`
- Diffusion scheduler is in `diffusion/` (adapted from OpenAI's guided-diffusion)
- Training loop with VAE encoding is in `train.py`
- Main model file: `models.py`
