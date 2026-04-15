---
id: stable-diffusion
arxiv: https://arxiv.org/abs/2112.10752
repo: https://github.com/compvis/stable-diffusion
detail_level: detailed
status: draft
---

# Paper: High-Resolution Image Synthesis with Latent Diffusion Models

**Authors**: Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer
**Venue**: CVPR 2022

## Why this paper

LDM (Latent Diffusion Models) is the foundational paper behind Stable Diffusion — one of the most widely used generative models ever built. The key insight is deceptively simple: instead of running the expensive diffusion process directly in pixel space, compress the image into a learned latent space first, then diffuse there. This reduces compute by ~50x while preserving perceptual quality. DiT (already in the gallery) directly builds on LDM, replacing the U-Net denoiser with a transformer. Understanding LDM is essential for understanding the entire modern generative vision stack.

## Expected modules

- `AutoencoderKL` — VAE encoder/decoder that compresses images to latent space
- `LatentDiffusion` — main model class; wraps VAE + U-Net + conditioning
- `UNetModel` — the denoising backbone operating in latent space
- `AttentionBlock` / `SpatialTransformer` — cross-attention for text conditioning
- `DDPM` — base diffusion process (noise schedule, forward/reverse)
- `OpenAIWrapper` / `FrozenCLIPEmbedder` — text encoder for conditioning

## Notes for ingestion

- Main model files: `ldm/models/autoencoder.py`, `ldm/models/diffusion/ddpm.py`, `ldm/modules/diffusionmodules/openaimodel.py`
- Conditioning: `ldm/modules/encoders/modules.py`
- Attention: `ldm/modules/attention.py`
- Skip `scripts/` (inference utilities, not architecture)
