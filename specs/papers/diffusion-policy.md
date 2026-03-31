---
id: diffusion-policy
arxiv: https://arxiv.org/abs/2303.04137
repo: https://github.com/real-stanford/diffusion_policy
detail_level: detailed
status: draft
---

# Paper: Diffusion Policy: Visuomotor Policy Learning via Action Diffusion

**Authors**: Cheng Chi, Siyuan Feng, Yilun Du, Zhenjia Xu, Eric Cousineau, Benjamin Burchfiel, Shuran Song
**Venue**: RSS 2023 / arXiv 2023

## Why this paper

Diffusion Policy is the foundational paper that established using DDPM-style diffusion models as robot action policies. It directly precedes pi0 and GR00T (both use flow matching, the successor to DDPM). Understanding Diffusion Policy makes the design choices in those papers clear.

## Expected modules

- `ConditionalUnet1D` — 1D UNet denoiser for action sequences
- `DDPMScheduler` / `DDIMScheduler` — noise schedulers
- `DiffusionUnetLowdimPolicy` — full policy with UNet denoiser
- `DiffusionTransformerLowdimPolicy` — transformer-based denoiser variant
- Observation encoders (visual + lowdim)

## Notes for ingestion

- Main policy files in `diffusion_policy/policy/`
- Two denoiser variants: UNet and Transformer
- Heavily uses HuggingFace diffusers schedulers
