# Creative grade as one 3D LUT: HLG (BT.2020) code values -> graded Rec.709 display.
# Technical part from loglut.py (HLG -> scene linear -> Rec.709 -> filmic); creative part in display space:
# contrast around a pivot, a deeper black point, teal shadows / warm highlights, hue-selective saturation
# (pines deeper, river turquoise, limestone warmer, haze and sky calmer).
# usage: python3 grade.py <out.cube> [--size 65] [--exposure 0.1]
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import loglut

def rgb2hsv(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]; mx = c.max(-1); mn = c.min(-1); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 1e-6, (mx - mn) / (mx + 1e-9), 0); return h, s, mx
def hsv2rgb(h, s, v):
    c = v * s; x = c * (1 - np.abs((h / 60) % 2 - 1)); m = v - c; k = (h // 60).astype(int) % 6
    z = np.zeros_like(h); r = np.choose(k, [c, x, z, z, x, c]); g = np.choose(k, [x, c, c, x, z, z]); b = np.choose(k, [z, z, x, c, c, x])
    return np.stack([r + m, g + m, b + m], -1)
def bump(h, center, width):            # smooth hue window (degrees)
    d = np.abs(((h - center + 180) % 360) - 180); return np.clip(1 - d / width, 0, 1) ** 2 * (3 - 2 * np.clip(1 - d / width, 0, 1))
def creative(rgb):
    x = rgb.copy()
    # tone: black point, pivot contrast with soft toe/shoulder
    x = np.clip((x - 0.025) / 0.975, 0, 1)
    p, k = 0.40, 1.22
    y = p + (x - p) * k; y = np.where(x < p, p * (y / p).clip(0, None) ** 1.0, y)
    y = 1 - (1 - np.clip(y, 0, 1.2)) ** 1.0
    x = np.clip(y, 0, 1)
    x = x + 0.06 * np.sin(np.pi * x) * (x - 0.5) * 2 * 0.5          # gentle S
    l = (x @ np.array([0.2126, 0.7152, 0.0722]))[..., None]
    # split toning: teal shadows, warm highlights
    sh = np.clip(1 - l / 0.45, 0, 1) ** 1.5; hi = np.clip((l - 0.55) / 0.45, 0, 1) ** 1.2
    x = x + sh * np.array([-0.022, 0.008, 0.020]) + hi * np.array([0.020, 0.008, -0.022])
    # hue-selective saturation / hue
    h, s, v = rgb2hsv(np.clip(x, 0, 1))
    # hue is meaningless on near-neutral pixels (overcast sky, haze): fade every hue-based change out there,
    # otherwise noise flips the hue window and draws contour lines in the clouds
    ws = np.clip((s - 0.035) / 0.11, 0, 1) ** 2 * (3 - 2 * np.clip((s - 0.035) / 0.11, 0, 1))
    g = bump(h, 105, 55) * ws; cy = bump(h, 180, 32) * ws; org = bump(h, 32, 26) * ws; bl = bump(h, 225, 35) * ws; yl = bump(h, 52, 12) * ws
    h = h + 9 * g * (h < 140)                                             # pines lean teal-green
    s = s * (1 + 0.55 * g + 0.70 * cy + 0.36 * org + 0.22 * yl - 0.25 * bl + 0.16 * ws)
    v = v * (1 - 0.09 * g * np.clip((v - 0.15) / 0.2, 0, 1))              # deeper greens
    s = np.clip(s, 0, 0.92)
    x = hsv2rgb(h % 360, s, v)
    return np.clip(x, 0, 1)
def build(size=65, exposure=0.1):
    curve, gamut = loglut.PROFILES['hlg']
    M = np.linalg.inv(loglut.rgb2xyz(loglut.PRIM['rec709'])) @ loglut.rgb2xyz(loglut.PRIM[gamut])
    g = np.linspace(0, 1, size); b, gg, r = np.meshgrid(g, g, g, indexing='ij')
    rgb = np.stack([r, gg, b], -1).reshape(-1, 3)
    lin = np.maximum((curve(rgb) * 2 ** exposure) @ M.T, 0)
    disp = loglut.oetf709(loglut.filmic(lin))
    return creative(disp)
if __name__ == '__main__':
    out = sys.argv[1]; a = sys.argv[2:]
    n = int(a[a.index('--size') + 1]) if '--size' in a else 65; ex = float(a[a.index('--exposure') + 1]) if '--exposure' in a else 0.22
    v = build(n, ex)
    with open(out, 'w') as f:
        f.write(f'TITLE "HLG cinematic canyon"\nLUT_3D_SIZE {n}\n'); np.savetxt(f, v, fmt='%.6f')
    print('wrote', out)
