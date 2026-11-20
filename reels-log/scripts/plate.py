# Darkening plate for the reel (1080x1920 RGBA): a cool gradient over the sky and behind the quote, and a soft
# one at the bottom for Instagram's caption area. Writes work/plate.png.
import os, numpy as np
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'work', 'plate.png')
H, W = 1920, 1080; y = np.linspace(0, 1, H)[:, None]
a = 0.40 * np.clip(1 - y / 0.46, 0, 1) ** 1.5 + 0.28 * np.clip((y - 0.80) / 0.20, 0, 1) ** 1.8
rgba = np.zeros((H, W, 4), np.uint8); rgba[..., 0], rgba[..., 1], rgba[..., 2] = 14, 24, 36
rgba[..., 3] = (np.repeat(a, W, 1) * 255).astype(np.uint8)
os.makedirs(os.path.dirname(OUT), exist_ok=True); Image.fromarray(rgba, 'RGBA').save(OUT); print('wrote', OUT)
