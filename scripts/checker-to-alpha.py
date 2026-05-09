#!/usr/bin/env python3
"""
Convert PNGs that have a checker-pattern transparency indicator baked
into their RGB pixels into PNGs with a real alpha channel.

The diffusion model used to generate the landing backdrop assets
returned 8-bit RGB PNGs (no alpha channel) where the "transparent"
background was painted as the canonical checkered transparency
indicator (alternating squares of two near-white colors). The browser
correctly composited those pixels as opaque, which exposed the
checker pattern in the rendered page.

This script reverses that:

  1. Sample the four corner regions of each input image. Those regions
     are guaranteed to be pure background (the model paints the subject
     in the centre of the canvas), which gives a clean estimate of the
     checker's two colours.
  2. For every pixel, compute its distance in RGB space to whichever
     of those two checker colours is closer.
  3. Map that distance to alpha: pixels close to either checker colour
     become fully transparent, pixels far from both stay fully opaque,
     and the band in between (the diffusion model's soft brush edges)
     gets a smoothly interpolated alpha. The brush colours themselves
     pass through unchanged in RGB; only the alpha channel is added.

Run: python3 scripts/checker-to-alpha.py public/landing/*.png
The script overwrites each input file with an RGBA version.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

CORNER_FRACTION = 0.04
DISTANCE_TO_ALPHA_GAIN = 4.5
ANCHOR_OPAQUE_DISTANCE = 60.0


def estimate_checker_colors(arr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    height, width, _ = arr.shape
    cy = max(8, int(height * CORNER_FRACTION))
    cx = max(8, int(width * CORNER_FRACTION))
    corners = np.concatenate(
        [
            arr[:cy, :cx].reshape(-1, 3),
            arr[:cy, -cx:].reshape(-1, 3),
            arr[-cy:, :cx].reshape(-1, 3),
            arr[-cy:, -cx:].reshape(-1, 3),
        ],
        axis=0,
    ).astype(np.float32)

    luminance = (
        0.299 * corners[:, 0] + 0.587 * corners[:, 1] + 0.114 * corners[:, 2]
    )
    order = np.argsort(luminance)
    quartile = max(1, len(order) // 4)
    dark_color = corners[order[:quartile]].mean(axis=0)
    bright_color = corners[order[-quartile:]].mean(axis=0)
    return dark_color, bright_color


def alpha_from_checker(arr: np.ndarray) -> np.ndarray:
    dark_color, bright_color = estimate_checker_colors(arr)
    pixels = arr.astype(np.float32)
    dist_dark = np.linalg.norm(pixels - dark_color, axis=2)
    dist_bright = np.linalg.norm(pixels - bright_color, axis=2)
    min_dist = np.minimum(dist_dark, dist_bright)
    alpha = np.clip(min_dist * DISTANCE_TO_ALPHA_GAIN, 0.0, 255.0)
    alpha[min_dist >= ANCHOR_OPAQUE_DISTANCE] = 255.0
    return alpha.astype(np.uint8)


def convert(path: Path) -> None:
    image = Image.open(path).convert("RGB")
    arr = np.array(image)
    alpha = alpha_from_checker(arr)
    rgba = np.dstack([arr, alpha])
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)
    transparent_pct = float((alpha == 0).mean()) * 100.0
    opaque_pct = float((alpha == 255).mean()) * 100.0
    print(
        f"{path.name}: alpha added "
        f"(transparent {transparent_pct:.1f}%, opaque {opaque_pct:.1f}%)"
    )


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: checker-to-alpha.py <png> [<png> ...]", file=sys.stderr)
        return 1
    for raw in argv[1:]:
        path = Path(raw)
        if not path.exists():
            print(f"skip: {path} does not exist", file=sys.stderr)
            continue
        convert(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
