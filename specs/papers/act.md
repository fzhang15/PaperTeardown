---
id: act
arxiv: https://arxiv.org/abs/2304.13705
repo: https://github.com/tonyzhaozh/act
detail_level: detailed
status: draft
---

# Paper: Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware (ACT)

**Authors**: Tony Z. Zhao, Vikash Kumar, Sergey Levine, Chelsea Finn
**Venue**: RSS 2023

## Why this paper

ACT (Action Chunking with Transformers) is a foundational imitation learning method for robot manipulation. It introduced two key ideas: (1) action chunking — predicting a sequence of future actions to reduce compounding errors, and (2) a CVAE (Conditional Variational Autoencoder) training objective that captures multimodal action distributions. The architecture uses a transformer encoder-decoder with joint and image observations, directly influencing later works like Diffusion Policy and pi0.

## Expected modules

- `ACTPolicy` — main policy wrapper (CVAE + transformer)
- `DETRVAE` — the core model: DETR-style transformer with VAE latent
- Backbone (ResNet18) for image encoding
- Transformer encoder/decoder
- Position embeddings

## Notes for ingestion

- Main model file is at `detr/models/detr_vae.py`
- Policy wrapper at `policy.py`
- Uses DETR-style architecture adapted for action prediction
- Key innovation: CVAE latent z for style conditioning + action chunking
