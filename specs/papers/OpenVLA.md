---
id: OpenVLA
arxiv: https://arxiv.org/abs/2406.09246
repo: https://github.com/openvla/openvla
detail_level: detailed
status: draft
---

# Paper: OpenVLA: An Open-Source Vision-Language-Action Model

**Authors**: Moo Jin Kim, Karl Pertsch, Siddharth Karamcheti, Ted Xiao, Ashwin Balakrishna, Suraj Nair, Rafael Rafailov, Ethan Paul Foster, Grace Lim, Pannag Sanketi, Quan Vuong, Thomas Kollar, Benjamin Burchfiel, Russ Tedrake, Dorsa Sadigh, Sergey Levine, Percy Liang, Chelsea Finn
**Venue**: NeurIPS 2024 / CoRL 2024

## Why this paper

OpenVLA is the first widely-adopted open-source 7B VLA model. It fine-tunes Prismatic-7B (SigLIP + DINOv2 vision encoders + Llama 2 LLM) on 970k+ robot trajectories from Open X-Embodiment. Actions are tokenized into discrete language tokens, framing robot control as next-token prediction. The key architectural novelty is dual vision encoding (SigLIP for semantics + DINOv2 for spatial features) fused before injection into the LLM.

## Expected modules

- `OpenVLAForActionPrediction` — main model wrapping PrismaticVLM
- `PrismaticVLM` — VLM with fused dual vision encoders
- `PrismaticProjector` — projects fused vision features to LLM embedding dimension
- `ActionTokenizer` — maps continuous actions to/from discrete tokens in LLM vocabulary

## Notes for ingestion

- Main model code is in `prismatic/` package
- Action tokenizer is at `prismatic/vla/action_tokenizer.py`
- Model definition: `prismatic/models/vlms/prismatic.py`
- Dataset/training: `prismatic/vla/datasets/`
