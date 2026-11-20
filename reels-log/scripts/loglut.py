# Builds a 3D LUT (.cube) that turns camera log footage into a graded Rec.709 image:
# log curve -> scene linear -> camera gamut to Rec.709 -> exposure -> filmic tone curve -> Rec.709 OETF.
# usage: python3 loglut.py <profile> <out.cube> [--exposure 0.0] [--size 33]
# profiles: slog3 (S-Gamut3.Cine), vlog (V-Gamut), applelog (Rec.2020), clog3 (Cinema Gamut), flog2 (F-Gamut),
#           dlog (D-Gamut), hlg (Rec.2020 HLG, for phone HDR clips)
import sys, numpy as np

def slog3(x):
    x = x * 1023
    return np.where(x >= 171.2102946929, (10 ** ((x - 420) / 261.5)) * 0.19 - 0.01, (x - 95) * 0.01125 / (171.2102946929 - 95))
def vlog(x):
    return np.where(x < 0.181, (x - 0.125) / 5.6, 10 ** ((x - 0.598206) / 0.241514) - 0.00873)
def applelog(x):
    R0, Rt, c, b, g, d = -0.05641088, 0.01, 47.28711236, 0.00964052, 0.08550479, 0.69336945
    Pt = c * (Rt - R0) ** 2
    return np.where(x >= Pt, 2 ** ((x - d) / g) - b, np.where(x >= 0, np.sqrt(np.maximum(x, 0) / c) + R0, R0))
def clog3(x):
    return np.where(x < 0.097465473, -(10 ** ((0.12783901 - x) / 0.36726845) - 1) / 14.98325,
           np.where(x <= 0.15277891, (x - 0.12512219) / 1.9754798, (10 ** ((x - 0.12240537) / 0.36726845) - 1) / 14.98325))
def flog2(x):
    a, b, c, d, e, f, cut = 5.555556, 0.064829, 0.245281, 0.384316, 8.799461, 0.092864, 0.100686685
    return np.where(x >= cut, (10 ** ((x - d) / c) - b) / a, (x - f) / e)
def dlog(x):
    return np.where(x <= 0.14, (x - 0.0929) / 6.025, (10 ** (3.89616 * x - 2.27752) - 0.0108) / 0.9892)
def hlg(x):
    a, b, c = 0.17883277, 0.28466892, 0.55991073
    return np.where(x <= 0.5, x * x / 3, (np.exp((x - c) / a) + b) / 12) * 3.0   # scene light, 1.0 ~ diffuse white
PRIM = {  # xy of R, G, B; white D65
    'rec709': [(0.640, 0.330), (0.300, 0.600), (0.150, 0.060)],
    'rec2020': [(0.708, 0.292), (0.170, 0.797), (0.131, 0.046)],
    'sgamut3cine': [(0.766, 0.275), (0.225, 0.800), (0.089, -0.087)],
    'vgamut': [(0.730, 0.280), (0.165, 0.840), (0.100, -0.030)],
    'cinemagamut': [(0.740, 0.270), (0.170, 1.140), (0.080, -0.100)],
    'fgamut': [(0.708, 0.292), (0.170, 0.797), (0.131, 0.046)],
    'dgamut': [(0.710, 0.310), (0.210, 0.880), (0.090, -0.080)],
}
D65 = (0.3127, 0.3290)
def rgb2xyz(prims):
    xyz = lambda x, y: np.array([x / y, 1.0, (1 - x - y) / y])
    P = np.stack([xyz(*p) for p in prims], 1); S = np.linalg.solve(P, xyz(*D65)); return P * S
PROFILES = {'slog3': (slog3, 'sgamut3cine'), 'vlog': (vlog, 'vgamut'), 'applelog': (applelog, 'rec2020'), 'clog3': (clog3, 'cinemagamut'),
            'flog2': (flog2, 'fgamut'), 'dlog': (dlog, 'dgamut'), 'hlg': (hlg, 'rec2020')}
def filmic(x, white=10.0):            # Hable-style shoulder, normalised so mid grey stays near 0.18 -> ~0.42 display
    A, B, C, D, E, F = 0.22, 0.30, 0.10, 0.20, 0.01, 0.30
    h = lambda v: ((v * (A * v + C * B) + D * E) / (v * (A * v + B) + D * F)) - E / F
    return h(x * 2.0) / h(np.array(white))
def oetf709(L): L = np.clip(L, 0, 1); return np.where(L < 0.018, 4.5 * L, 1.099 * L ** 0.45 - 0.099)
def build(profile, size=33, exposure=0.0):
    curve, gamut = PROFILES[profile]
    M = np.linalg.inv(rgb2xyz(PRIM['rec709'])) @ rgb2xyz(PRIM[gamut])
    g = np.linspace(0, 1, size); b, gg, r = np.meshgrid(g, g, g, indexing='ij')       # .cube order: red fastest
    rgb = np.stack([r, gg, b], -1).reshape(-1, 3)
    lin = curve(rgb) * (2 ** exposure)
    lin709 = lin @ M.T
    lin709 = np.maximum(lin709, 0)
    out = oetf709(filmic(lin709))
    return out
if __name__ == '__main__':
    prof, out = sys.argv[1], sys.argv[2]; a = sys.argv[3:]
    ex = float(a[a.index('--exposure') + 1]) if '--exposure' in a else 0.0; n = int(a[a.index('--size') + 1]) if '--size' in a else 33
    v = build(prof, n, ex)
    with open(out, 'w') as f:
        f.write(f'TITLE "{prof} to Rec709"\nLUT_3D_SIZE {n}\n')
        for row in v: f.write(f'{row[0]:.6f} {row[1]:.6f} {row[2]:.6f}\n')
    print('wrote', out, 'mid-grey check:', build(prof, 2, ex).shape)
