---
id: mobile-aloha
arxiv: https://arxiv.org/abs/2401.02117
repo: https://github.com/MarkFzp/mobile-aloha
detail_level: detailed
status: draft
---

# Paper: Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation

**Authors**: Zipeng Fu, Tony Z. Zhao, Chelsea Finn
**Venue**: arXiv 2024

## Why this paper

Mobile ALOHA demonstrates that high-quality whole-body bimanual manipulation can be learned from as few as 50 demonstrations collected via teleoperation — no simulation, no pretraining on million-sample datasets. It combines a low-cost mobile base with ALOHA's dual-arm setup, then shows that co-training on existing static ALOHA data dramatically boosts performance. A strong imitation learning baseline (ACT) drives the policy.

## Expected modules

- `ACTPolicy` — Action Chunking with Transformers policy
- `DETRVAE` — DETR-style encoder + VAE latent
- `BackboneWithPositionalEncoding` — ResNet image encoder
- Training loop with co-training mixing strategy

## Notes for ingestion

- Main policy/model code is likely in `act/` or similar directory
- Focus on ACT policy architecture (the core ML contribution)
- Hardware setup chapters can be narrative-only (no code)
