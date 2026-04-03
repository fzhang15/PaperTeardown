---
id: MAE
arxiv: https://arxiv.org/abs/2111.06377
repo: https://github.com/facebookresearch/mae
detail_level: detailed
status: draft
---

# Paper: Masked Autoencoders Are Scalable Vision Learners

**Authors**: Kaiming He, Xinlei Chen, Saining Xie, Yanghao Li, Piotr Dollár, Ross Girshick
**Venue**: CVPR 2022

## Why this paper

MAE is a foundational self-supervised vision pre-training method that achieves strong transfer learning by masking 75% of image patches and reconstructing pixel values from the remaining 25%. Its asymmetric encoder-decoder design — a heavy ViT encoder that only sees visible patches, paired with a lightweight decoder that reconstructs masked patches — makes pre-training extremely efficient while learning rich representations. MAE directly preceded and influenced DINOv2 and modern large vision models.

## Expected modules

- `MaskedAutoencoderViT` — full MAE model (encoder + decoder)
- `PatchEmbed` — patchify input images
- Various ViT blocks — standard attention + MLP layers

## Notes for ingestion

- Main model file is at `models_mae.py`
- Encoder is a standard ViT that only processes unmasked patches
- Decoder is a narrow transformer that predicts pixel values for masked patches
- Key novelty: high masking ratio (75%), pixel reconstruction loss, asymmetric encoder-decoder
