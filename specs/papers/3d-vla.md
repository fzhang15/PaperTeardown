---
id: 3d-vla
arxiv: https://arxiv.org/abs/2403.09631
repo: https://github.com/UMass-Embodied-AGI/3D-VLA
detail_level: detailed
status: draft
---

# Paper: 3D-VLA: A 3D Vision-Language-Action Generative World Model

**Authors**: Haoyu Zhen, Xiaowen Qiu, Peihao Chen, Jincheng Yang, Xin Yan, Yilun Du, Yining Hong, Chuang Gan
**Venue**: ICML 2024

## Why this paper

3D-VLA bridges 3D perception and embodied action generation by grounding a language model in 3D scene understanding. It uses a goal-conditioned generative world model that imagines future states, then executes actions — a novel combination of 3D-aware vision encoding, language reasoning, and diffusion-based action/image generation.

## Expected modules

- `ThreeDVLA` — main model integrating 3D encoder + LLM + action head
- `PointCloudEncoder` / `3D feature extractor` — encodes point clouds into tokens
- `EmbodiedLLM` — language model adapted for embodied tasks
- Action generation head — predicts robot actions conditioned on goal
- Goal image generation — diffusion-based future frame imagination

## Notes for ingestion

- Main model likely in `model/` or `models/` directory
- Focus on the 3D grounding tokens, the goal-conditioned generation, and action prediction head
- The paper bridges 3D scene understanding (from 3D-LLM lineage) with robot action generation
