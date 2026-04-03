---
id: unet
arxiv: https://arxiv.org/abs/1505.04597
repo: https://github.com/milesial/pytorch-unet
detail_level: detailed
status: complete
---

# Paper: U-Net: Convolutional Networks for Biomedical Image Segmentation

**Authors**: Olaf Ronneberger, Philipp Fischer, Thomas Brox
**Venue**: MICCAI 2015

## Why this paper

U-Net defined the encoder-decoder architecture with skip connections that became the dominant paradigm for dense prediction tasks. Originally designed for biomedical image segmentation with very few labeled images (~30), it achieves full-image segmentation in a single forward pass. Its skip connections — copying encoder feature maps directly to the decoder — became the blueprint for virtually every segmentation and generation network that followed, including diffusion model U-Nets.

## Expected modules

- `DoubleConv` — two (Conv2d → BatchNorm → ReLU) pairs; the repeating unit
- `Down` — MaxPool2d downsampling then DoubleConv; the encoder step
- `Up` — upsampling (bilinear or ConvTranspose2d) + skip-connection concat + DoubleConv; the decoder step
- `OutConv` — final 1×1 conv mapping feature channels to class logits
- `UNet` — full encoder-decoder assembly

## Notes for ingestion

- Main model: `unet/unet_model.py` (assembly) and `unet/unet_parts.py` (building blocks)
- Loss: `utils/dice_score.py` — Dice coefficient and Dice loss
- Training: `train.py` — RMSprop + ReduceLROnPlateau + combined BCE/CE + Dice loss
