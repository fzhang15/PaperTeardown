---
id: sonic
arxiv: https://arxiv.org/abs/2511.07820
repo: https://github.com/NVlabs/GR00T-WholeBodyControl
detail_level: detailed
status: complete
---

# Paper: SONIC: Supersizing Motion Tracking for Natural Humanoid Whole-Body Control

**Authors**: Zhengyi Luo, Ye Yuan, Tingwu Wang, et al.
**Venue**: NVIDIA Research, 2025

## Why this paper

SONIC demonstrates that scaling motion-tracking—using motion-capture data as direct supervision—produces a generalist humanoid controller with natural whole-body motion. The key insight: instead of hand-crafted reward functions, use motion capture as the training target and scale aggressively.

## Expected modules

- `WarmupCosineScheduler` — LR schedule with linear warmup + cosine decay
- `MuJoCoFKHelper` — forward kinematics for G1 29-DOF robot
- `BodyStateProcessor` — reads low-level robot state (148-dim)
- `compute_episode_attnmask` — causal attention masking across episodes
- `interpolate_pose` / `slerp` — quaternion interpolation for motion resampling

## Notes for ingestion

- Training code not yet released; repo contains teleoperation and deployment stacks
- Core architecture: Transformer policy trained via motion tracking on SMPLX retargeted data
- Main model files: `gear_sonic/trl/utils/`, `decoupled_wbc/control/`
