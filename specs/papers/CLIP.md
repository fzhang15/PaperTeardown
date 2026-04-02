---
id: CLIP
arxiv: https://arxiv.org/abs/2103.00020
repo: https://github.com/openai/CLIP
detail_level: detailed
status: draft
---

# Paper: Learning Transferable Visual Models From Natural Language Supervision (CLIP)

**Authors**: Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal, Girish Sastry, Amanda Askell, Pamela Mishkin, Jack Clark, Gretchen Krueger, Ilya Sutskever
**Venue**: ICML, 2021

## Why this paper

CLIP is a foundational model that learns visual representations from natural language supervision at internet scale. It introduced contrastive language-image pretraining, enabling zero-shot transfer to downstream vision tasks. CLIP's architecture (dual encoder with contrastive loss) has become a building block for many subsequent models including DALL-E, Stable Diffusion, and numerous VLMs.

## Expected modules

- `CLIP` — main model combining vision and text encoders
- `VisionTransformer` — ViT-based image encoder
- `ModifiedResNet` — ResNet-based image encoder variant
- `Transformer` — text encoder (GPT-2 style)
- `MultiheadAttention` — custom attention implementation

## Notes for ingestion

- Main model file is at `clip/model.py`
- Tokenizer at `clip/simple_tokenizer.py`
- Entry point at `clip/clip.py`
