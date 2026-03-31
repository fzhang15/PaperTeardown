---
id: pi0
arxiv: https://arxiv.org/abs/2410.24164
repo: https://github.com/Physical-Intelligence/openpi
detail_level: detailed
status: draft
---

# Paper: pi0 — A Vision-Language-Action Flow Model for General Robot Control

**Authors**: Kevin Black, Noah Brown, Danny Driess, Adnan Esmail, Michael Equi, Chelsea Finn, Niccolo Fusai, Lachy Groom, Karol Hausman, Brian Ichter, Szymon Jakubczak, Tim Jones, Liyiming Ke, Sergey Levine, Adrian Li-Bell, Mohith Mothukuri, Suraj Nair, Karl Pertsch, Lucy Xiaoyang Shi, James Tanner, Quan Vuong, Anna Walling, Haohuan Wang, Ury Zhilinsky
**Venue**: Physical Intelligence, 2024

## Why this paper

pi0 is a foundation model for robotics: it uses a pre-trained vision-language model (PaliGemma) as a backbone and adds a flow-matching action head that generates continuous robot actions. It introduces a novel architecture that conditions action generation on both visual observations and language instructions, trained on diverse robot manipulation data. Key contributions: flow-matching diffusion head, VLA (vision-language-action) architecture, and cross-embodiment pre-training.

## Expected modules

- `Pi0` — main VLA model combining PaliGemma + flow matching action expert
- `PaliGemmaWithExpert` — PaliGemma backbone with an interleaved action expert transformer
- `ActionExpert` — transformer that processes robot state + action tokens
- `FlowMatchingLoss` — flow matching training objective
- `EfficientPiZeroInference` — optimized inference with KV cache

## Notes for ingestion

- Main model file is likely at `src/openpi/models/pi0.py`
- Training infrastructure in `src/openpi/training/`
- The action expert interleaves with PaliGemma layers — focus on this novel architecture
