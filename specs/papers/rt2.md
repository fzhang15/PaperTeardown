---
id: rt2
arxiv: https://arxiv.org/abs/2307.15818
repo: https://github.com/kyegomez/RT-2
detail_level: detailed
status: draft
---

# Paper: RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control

**Authors**: Anthony Brohan, Noah Brown, et al. (Google DeepMind)
**Venue**: CoRL 2023

## Why this paper

RT-2 is a landmark result showing that a large vision-language model (VLM) pretrained on web data can be fine-tuned to directly output robot actions as tokens — no separate action head needed. The key insight is that web-scale visual-language pretraining transfers emergent reasoning capabilities (chain-of-thought, symbol understanding, novel object generalization) directly to robotic manipulation.

## Expected modules

- `RT2` — main vision-language-action model
- `RTX` / transformer backbone — token sequence processing
- Action tokenizer — converts continuous actions to discrete tokens and back

## Notes for ingestion

- Third-party implementation by kyegomez (not official Google code)
- Main model file likely at `RT2/model.py` or similar
- Focus on how VLM outputs are re-purposed as action tokens
