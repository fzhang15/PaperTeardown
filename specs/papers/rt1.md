---
id: rt1
arxiv: https://arxiv.org/abs/2212.06817
repo: https://github.com/google-research/robotics_transformer
detail_level: detailed
status: draft
---

# Paper: RT-1: Robotics Transformer for Real-World Control at Scale

**Authors**: Anthony Brohan, Noah Brown, Justice Carbajal, Yevgen Chebotar, et al.
**Venue**: RSS 2023

## Why this paper

RT-1 is a foundational robotics model that applies transformer-based sequence modeling to real-world robot manipulation. It uses EfficientNet image tokenization combined with a Transformer to map 6 image frames + natural language instruction → 11-dimensional discretized robot actions. Trained on 130,000 real robot episodes, it demonstrates remarkable generalization across 700+ tasks.

## Expected modules

- `RT1` — main model
- `TokenLearner` — compresses image tokens from 81 to 8
- `EfficientNetEncoder` — image feature extractor
- `TransformerNetwork` — action prediction transformer

## Notes for ingestion

- Main model file is at `robotics_transformer/robotics_transformer.py`
- TokenLearner is at `robotics_transformer/film_efficientnet/token_learner.py`
- EfficientNet with FiLM conditioning at `robotics_transformer/film_efficientnet/`
- Note: repo uses TensorFlow/Keras, not PyTorch — adapt analysis accordingly
