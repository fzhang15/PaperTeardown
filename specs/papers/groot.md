---
id: groot
arxiv: https://arxiv.org/abs/2503.14734
repo: https://github.com/NVIDIA/Isaac-GR00T
detail_level: detailed
status: draft
---

# Paper: GR00T N1: An Open Foundation Model for Generalist Humanoid Robots

**Authors**: NVIDIA et al.
**Venue**: arXiv 2025

## Why this paper

GR00T N1 is NVIDIA's open foundation model for generalist humanoid robots. It combines a vision-language backbone (Eagle2) with a novel dual-system architecture: System 2 (slow, language-reasoning) and System 1 (fast, diffusion-based action generation). Key contributions: cross-embodiment training across diverse robot morphologies, flow matching action generation, and embodiment-aware tokenization.

## Expected modules

- `GR00TPolicy` — main policy model combining System 1 and System 2
- `DiTActionDecoder` — diffusion transformer for action generation
- `EagleVisionEncoder` — visual encoder from Eagle2 VLM backbone
- `ActionTokenizer` — embodiment-aware action tokenization
- `FlowMatching` — flow matching denoising for continuous actions

## Notes for ingestion

- Main model files likely in `gr00t/model/` or similar
- Focus on the dual-system architecture and flow matching action decoder
- Cross-embodiment training pipeline is a key innovation
