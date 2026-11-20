# Sound design for "Kanlı Ardıç": synthesized ambience (mountain wind, fire, birds, owls, a distant dog howl),
# foley (axe, footsteps, branch cracks, cloth), a low-frequency tension score (drones, clusters, heartbeat, ney and
# bağlama lines in Hicaz) and CC0 cinematic hits from video-toolkit/sfx. Everything is placed on the narration
# timeline (timeline.json); music and ambience duck under the voice and drop out before the critical lines.
# Writes out/audio/{ambience,music,sfx}.wav and out/audio/premix.wav (48 kHz stereo float).
import json, os, numpy as np, soundfile as sf
from scipy import signal

P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(os.path.dirname(P), 'video-toolkit', 'sfx')
SR = 48000
TL = json.load(open(f'{P}/timeline.json')); T = TL['duration']; N = int(T * SR) + SR
L = {l['id']: l for l in TL['lines']}
rng = np.random.default_rng(7)
os.makedirs(f'{P}/out/audio', exist_ok=True)

# ------------------------------------------------------------------ helpers
def bus(): return np.zeros((N, 2))
def st(x, pan=0.0):
    if x.ndim == 2: return x
    return np.stack([x * np.cos((pan + 1) * np.pi / 4) * 1.414, x * np.sin((pan + 1) * np.pi / 4) * 1.414], 1)
def put(buf, x, t0, g=1.0, pan=0.0):
    x = st(x, pan); i = int(round(t0 * SR))
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i)
    if n > 0: buf[i:i + n] += g * x[:n]
def lp(x, f, o=2): b, a = signal.butter(o, f, fs=SR); return signal.lfilter(b, a, x, axis=0)
def hp(x, f, o=2): b, a = signal.butter(o, f, 'high', fs=SR); return signal.lfilter(b, a, x, axis=0)
def bp(x, lo, hi, o=2): b, a = signal.butter(o, [lo, hi], 'band', fs=SR); return signal.lfilter(b, a, x, axis=0)
def reson(x, f, q):                                     # resonant band (2-pole)
    w = 2 * np.pi * f / SR; r = np.exp(-w / (2 * q)); return signal.lfilter([1 - r], [1, -2 * r * np.cos(w), r * r], x, axis=0)
def env_adsr(n, a, r):
    e = np.ones(n); na = max(1, min(n, int(a * SR))); nr = max(1, min(n, int(r * SR)))
    e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2; e[n - nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2; return e
def curve(points, n=N):                                  # piecewise-linear automation over the timeline: [(t, v), ...]
    t = np.arange(n) / SR; ts, vs = zip(*points); return np.interp(t, ts, vs)
def smooth(x, sec):
    k = max(1, int(sec * SR)); return signal.lfilter([1 / k], [1, -(1 - 1 / k)], x)
def noise(n, ch=2): return rng.standard_normal((n, ch)) if ch > 1 else rng.standard_normal(n)
def brown(n, ch=2):
    x = np.cumsum(rng.standard_normal((n, ch)), 0); x = hp(x, 20); return x / (np.abs(x).max() + 1e-9)
def pink(n, ch=2):
    X = np.fft.rfft(rng.standard_normal((n, ch)), axis=0); f = np.arange(X.shape[0]); f[0] = 1
    return np.fft.irfft(X / np.sqrt(f)[:, None], n, axis=0) / 30
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def at_peak(x, db): return x / (np.abs(x).max() + 1e-12) * 10 ** (db / 20)
def at_rms(x, db):                                      # RMS over the active part (above -30 dB of peak)
    a = np.abs(x).reshape(len(x), -1).max(1); m = a > a.max() * 0.03; r = np.sqrt(np.mean(x[m] ** 2)) if m.any() else 1e-9
    return x / (r + 1e-12) * 10 ** (db / 20)
def load(name, gain_db=0.0):
    import glob
    f = glob.glob(f'{KIT}/sounds/*/{name}.ogg')[0]; x, sr = sf.read(f); x = st(x)
    if sr != SR: x = signal.resample_poly(x, SR, sr, axis=0)
    return x * 10 ** (gain_db / 20)
def make_ir(t60, pre=0.02, bright=4500, er=None, seed=3):
    r = np.random.default_rng(seed); n = int(t60 * SR); t = np.arange(n) / SR
    x = r.standard_normal((n, 2)) * np.exp(-6.91 * t / t60)[:, None]; x = lp(x, bright); x = hp(x, 80)
    x = np.concatenate([np.zeros((int(pre * SR), 2)), x])
    for (d, g) in (er or []): i = int(d * SR); x[i:i + 200] += lp(r.standard_normal((200, 2)), 2500) * g
    return x / np.sqrt((x ** 2).sum() / 2)
def conv(x, ir): return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in (0, 1)], 1)
VALLEY = make_ir(3.2, 0.03, 3500, er=[(0.45, 0.5), (0.82, 0.35), (1.3, 0.22)])     # echoing mountain valley
NEAR = make_ir(0.9, 0.008, 6000)

# ------------------------------------------------------------------ sound sources
def wind_layer(level, gust_rate=0.12, whistle=True):
    """level: automation array (0..1.5). Low rumble + whistling band + grass hiss, with gusts."""
    g = smooth(np.abs(rng.standard_normal(N)), 1 / gust_rate) ; g = (g - g.min()) / (g.max() - g.min()); gust = 0.55 + 0.9 * g ** 1.6
    a = lp(brown(N), 220) * 2.2
    out = a * (level * gust)[:, None]
    if whistle:
        w = np.zeros((N, 2)); src = noise(N)
        fc = smooth(rng.standard_normal(N), 2.5); fc = 600 + 180 * fc / (fc.std() + 1e-12)
        for i0 in range(0, N, SR // 4):                        # slowly moving resonance (block-wise)
            i1 = min(N, i0 + SR // 4 + 4096); f = float(np.clip(fc[i0], 300, 950))
            seg = reson(src[i0:i1], f, 9) * 0.5
            w[i0:i1] += seg * np.hanning(i1 - i0)[:, None]
        out += w * 0.55 * (level * gust ** 1.5)[:, None]
    hiss = bp(noise(N), 2500, 8000) * 0.12
    out += hiss * (level * gust ** 3)[:, None]
    return out

def fire_layer(level):
    out = bus(); lam = 14.0; t = 0.0
    while t < T:
        t += rng.exponential(1 / lam); i = int(t * SR)
        if i >= N - 2000: break
        lv = level[i]
        if lv < 0.02 or rng.random() > lv: continue
        n = int(rng.uniform(0.0006, 0.004) * SR); x = rng.standard_normal(n) * np.exp(-np.arange(n) / (n / 4))
        x = bp(x, 900, 7000) * rng.lognormal(-1.2, 0.8)
        if rng.random() < 0.08: x = np.concatenate([x, reson(rng.standard_normal(1500) * np.exp(-np.arange(1500) / 300), rng.uniform(250, 600), 6) * 0.4])
        put(out, x, t, 0.5, rng.uniform(-0.3, 0.3))
    m = smooth(rng.standard_normal(N), 0.4); m = m / (m.std() + 1e-12)
    roar = lp(pink(N), 500) * 6.0 * np.clip(0.8 + 0.25 * m, 0.3, 1.5)[:, None]
    return out + roar * level[:, None] * 0.6

def chirp_bird(base=3200):
    n = int(rng.uniform(0.05, 0.14) * SR); t = np.arange(n) / SR
    f = base * (1 + rng.uniform(-0.15, 0.25) * np.sin(np.pi * t / t[-1]) + rng.uniform(-0.2, 0.2) * t / t[-1])
    ph = 2 * np.pi * np.cumsum(f) / SR; x = np.sin(ph) * np.sin(np.pi * t / t[-1]) ** 2
    return x * (1 + 0.3 * np.sin(2 * np.pi * 60 * t))
def birds(t0, t1, density=2.5, level=0.06, base=3400):
    out = bus(); t = t0
    while t < t1:
        t += rng.exponential(1 / density); k = int(rng.integers(2, 7)); pan = rng.uniform(-0.8, 0.8); b = base * rng.uniform(0.85, 1.25)
        for j in range(k): put(out, chirp_bird(b), t + j * rng.uniform(0.07, 0.16), level * rng.uniform(0.5, 1), pan)
    return out

def owl(level=0.08):
    seg = []
    for (dur, f0, f1, gap) in ((0.38, 330, 300, 0.32), (0.55, 335, 290, 0)):
        n = int(dur * SR); t = np.arange(n) / SR; f = np.linspace(f0, f1, n); x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.15 * np.sin(4 * np.pi * np.cumsum(f) / SR)
        x = x * env_adsr(n, 0.07, 0.18) + bp(rng.standard_normal(n), 200, 900) * 0.05 * env_adsr(n, 0.02, 0.1)
        seg += [x, np.zeros(int(gap * SR))]
    return lp(np.concatenate(seg), 1200) * level

def howl(dur=3.2, f_lo=430, f_hi=640, level=0.1, seed=0):
    r = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    f = f_lo + (f_hi - f_lo) * np.clip(u / 0.22, 0, 1) ** 0.7 - (f_hi - f_lo) * 0.55 * np.clip((u - 0.8) / 0.2, 0, 1) ** 1.5
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 5.2 * t) * np.clip(u * 2, 0, 1) + 0.006 * smooth(r.standard_normal(n), 0.15) * 20)
    ph = 2 * np.pi * np.cumsum(f) / SR; x = sum(a * np.sin(k * ph) for k, a in ((1, 1), (2, 0.42), (3, 0.2), (4, 0.09), (5, 0.04)))
    x += bp(r.standard_normal(n), 900, 2600) * 0.06
    x = reson(x, 1050, 2.5) * 0.6 + x * 0.4; x *= env_adsr(n, 0.35, 0.7)
    return lp(hp(x, 280), 2300) * level

def crack(level=0.3, seed=None):
    r = np.random.default_rng(seed); out = np.zeros(int(0.45 * SR))
    for j in range(r.integers(2, 6)):
        i = int(r.uniform(0, 0.05) * SR); n = int(r.uniform(0.002, 0.007) * SR)
        b = r.standard_normal(n) * np.exp(-np.arange(n) / (n / 5)); out[i:i + n] += bp(b, 700, 6000) * r.uniform(0.4, 1)
    body = sum(reson(out, f, 12) * g for f, g in ((310, 0.8), (760, 0.5), (1650, 0.35)))
    tail = bp(r.standard_normal(len(out)), 1500, 6000) * np.exp(-np.arange(len(out)) / (0.06 * SR)) * 0.08
    return (out * 0.8 + body * 0.6 + tail) * level

def axe_chop(level=0.5):
    n = int(0.6 * SR); t = np.arange(n) / SR
    click = bp(rng.standard_normal(n), 2000, 7000) * np.exp(-t / 0.003)
    thunk = np.sin(2 * np.pi * 165 * t) * np.exp(-t / 0.05) + 0.6 * np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.08)
    wood = sum(reson(rng.standard_normal(n) * np.exp(-t / 0.004), f, 10) * g for f, g in ((420, 1.0), (930, 0.6), (1900, 0.35)))
    split = bp(rng.standard_normal(n), 900, 4000) * np.exp(-t / 0.025) * 0.25
    return (click * 0.6 + thunk * 0.9 + wood * 0.35 + split) * level

def step(level=0.12, soft=False):
    n = int(0.25 * SR); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * 75 * t) * np.exp(-t / 0.03)
    rustle = bp(rng.standard_normal(n), 1800, 7500) * np.exp(-t / 0.07) * (1 - np.exp(-t / 0.008)) * (0.5 if soft else 0.8)
    return (thump * 0.5 + rustle) * level * rng.uniform(0.75, 1.15)

def heartbeat(t0, t1, bpm0, bpm1, level=0.25):
    out = bus(); t = t0
    while t < t1:
        bpm = bpm0 + (bpm1 - bpm0) * (t - t0) / max(1e-6, t1 - t0)
        for d, g in ((0, 1.0), (0.17, 0.6)):
            n = int(0.25 * SR); tt = np.arange(n) / SR; f = 58 - 18 * tt / 0.25
            x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.06) * (1 - np.exp(-tt / 0.004))
            put(out, x, t + d, level * g)
        t += 60 / bpm
    return out

def flutter(t0, t1, level=0.05):                          # cloth strips snapping in the wind
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    am = (0.5 + 0.5 * np.sin(2 * np.pi * (9 + 3 * np.sin(2 * np.pi * 0.3 * t)) * t)) ** 3
    x = bp(noise(n), 350, 2400) * am[:, None] * (0.4 + 0.6 * smooth(np.abs(rng.standard_normal(n)), 0.6)[:, None] * 2)
    return x * env_adsr(n, 0.6, 0.8)[:, None] * level

def breath_swell(dur, level=0.12):                        # an unseen breath moving through the fog (no source shown)
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    x = bp(noise(n, 1), 500, 3000); x = reson(x, 1150, 3) * 0.5 + x * 0.3
    pan = -0.8 + 1.6 * u; e = np.sin(np.pi * u) ** 2
    return np.stack([x * e * np.cos((pan + 1) * np.pi / 4), x * e * np.sin((pan + 1) * np.pi / 4)], 1) * level * 1.4

# ------------------------------------------------------------------ music sources
def drone(f, dur, amp, detune=0.004, fc=420, a=2.0, r=3.0):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros((n, 2))
    for k, (d, pan) in enumerate(((-detune, -0.6), (0, 0), (detune, 0.6))):
        ph = 2 * np.pi * f * (1 + d) * t + k
        x = np.sin(ph) + 0.35 * np.sin(2 * ph + 0.3) + 0.18 * np.sin(3 * ph) + 0.08 * np.sign(np.sin(ph)) * 0.5
        out += st(x, pan)
    out = lp(out, fc) * env_adsr(n, a, r)[:, None]; return out * amp / 3
def saw(f, n, ph0=0.0, vib=None):
    t = np.arange(n) / SR; inc = f * (1 + (vib if vib is not None else 0)) / SR; ph = (ph0 + np.cumsum(inc * np.ones(n))) % 1.0
    return 2 * ph - 1
def cluster(notes, dur, amp, fc=700, a=2.5, r=3.0, seed=1):
    n = int(dur * SR); out = np.zeros((n, 2)); r_ = np.random.default_rng(seed)
    for m in notes:
        for d in (-0.003, 0.0, 0.0035):
            vib = 0.002 * np.sin(2 * np.pi * r_.uniform(0.15, 0.4) * np.arange(n) / SR + r_.uniform(0, 6))
            out += st(saw(midi(m) * (1 + d), n, r_.uniform(), vib), r_.uniform(-0.7, 0.7))
    out = lp(lp(out, fc), fc * 1.5) * env_adsr(n, a, r)[:, None]; return out * amp / (3 * len(notes))
def choir(notes, dur, amp, a=3.0, r=3.0):             # formant-filtered "aah"
    x = cluster(notes, dur, 1.0, fc=3000, a=a, r=r, seed=5)
    y = sum(reson(x, f, q) * g for f, q, g in ((700, 6, 1.0), (1150, 7, 0.55), (2600, 8, 0.25)))
    return lp(y, 3200) * amp * 3
def ney(phrase, amp=0.1, vib=0.006):                   # phrase: [(midi, dur), ...] with glides between notes
    fs, durs = [], []
    for m, d in phrase: fs.append(midi(m)); durs.append(d)
    n = int(sum(durs) * SR); f = np.zeros(n); i = 0
    for k, (fv, d) in enumerate(zip(fs, durs)):
        m = int(d * SR); g = min(int(0.09 * SR), m // 3); f[i:i + m] = fv
        if k: f[i:i + g] = np.linspace(fs[k - 1], fv, g)
        i += m
    t = np.arange(n) / SR; f = f * (1 + vib * np.sin(2 * np.pi * 5.0 * t) * np.clip(t * 1.5, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR; tone = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    breath = bp(rng.standard_normal(n), 800, 4000) * 0.22 * (0.6 + 0.4 * np.abs(np.sin(ph / 2)))
    x = (tone + breath) * env_adsr(n, 0.25, 0.6); y = st(lp(x, 4500)) * amp; return y + conv(y, NEAR) * 0.5
def ks(m, dur=1.4, amp=0.3, g=0.996, bright=5000):     # Karplus-Strong pluck (bağlama-like)
    f = midi(m); per = int(SR / f); n = int(dur * SR); x = np.zeros(n); x[:per] = lp(rng.uniform(-1, 1, per), bright)
    a = np.zeros(per + 2); a[0] = 1; a[per] = -g * 0.5; a[per + 1] = -g * 0.5
    return signal.lfilter([1.0], a, x) * amp
def subdrop(f0=60, f1=28, dur=2.5, amp=0.6):
    n = int(dur * SR); t = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-t / 0.5)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur / 3)) * (1 - np.exp(-t / 0.005)) * amp
def riser(dur, amp=0.2):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur; x = noise(n)
    out = np.zeros((n, 2))
    for i0 in range(0, n, 2048):
        i1 = min(n, i0 + 4096); f = 300 + 5000 * u[i0] ** 2; out[i0:i1] += reson(x[i0:i1], f, 4) * np.hanning(i1 - i0)[:, None] * 0.5
    tone = np.sin(2 * np.pi * np.cumsum(110 + 330 * u ** 2) / SR) * 0.15
    return (out + st(tone)) * (u ** 2)[:, None] * amp

# ================================================================== build the stems
amb, mus, fx = bus(), bus(), bus()
t_ = lambda i: L[i]['start']

# ---- wind: level automation following the picture (day calm, night strong, a gust when the fog rolls in)
wind_lv = curve([(0, 0), (1.6, 0.5), (3.6, 0.55), (4.5, 0.2), (7.1, 0.25), (9.3, 0.6), (9.46, 1.1), (12, 0.8), (16, 0.7), (21.6, 0.55),
                 (26.6, 0.7), (33, 0.55), (38.9, 0.6), (41.6, 0.55), (47.3, 0.9), (49.9, 0.75), (56.9, 0.8), (62.0, 0.7), (62.2, 0.3), (70.6, 0.3),
                 (72.4, 0.35), (74.0, 0.08), (75.0, 0.15), (76.6, 0.12), (78.6, 0.1), (78.7, 0.35), (83, 0.3), (97.15, 0.5), (97.6, 1.3), (98.8, 0.9),
                 (99.0, 0.35), (104, 0.4), (108.6, 0.5), (110.6, 0.75), (113.4, 0.8), (120.6, 0.5), (126.0, 0.25), (126.47, 0.5), (129, 0.35),
                 (132.0, 0.3), (134.2, 0.55), (140, 0.7), (146.0, 0.3), (T, 0)])
amb += wind_layer(wind_lv) * 0.16
# ---- fire (camp) when it is on screen or near
fire_lv = curve([(0, 0), (21.6, 0), (22.2, 0.35), (26.4, 0.35), (26.6, 0), (67.7, 0), (68.2, 0.3), (70.6, 0.6), (72.8, 0.6), (74.9, 0.1), (75, 0.05),
                 (76.0, 0.0), (86.6, 0), (87.0, 0.35), (88.9, 0.35), (89.0, 0.03), (90.9, 0), (96.3, 0), (96.5, 0.35), (97.15, 0.35), (97.3, 0.25),
                 (98.9, 0.0), (140.0, 0), (141.0, 0.12), (146, 0.05), (T, 0)])
amb += fire_layer(fire_lv) * 0.9
# ---- birds by day, at golden hour and at dawn (thin, distant)
amb += conv(birds(3.8, 7.0, 3.0, 0.05, 3600), VALLEY) * 0.25 + birds(3.8, 7.0, 3.0, 0.04, 3600) * 0.6
amb += birds(62.6, 70.0, 1.0, 0.025, 2900) * 0.7 + birds(83.1, 88.6, 0.8, 0.02, 3000) * 0.7 + birds(75.6, 76.6, 0.8, 0.018, 2600) * 0.6
# ---- owls and the distant dog
for t0, db, pan in ((18.4, -42, -0.5), (114.2, -44, 0.6)):
    o = st(at_rms(owl(), db), pan); put(fx, conv(o, VALLEY) * 0.7 + o * 0.5, t0)
for (t0, dur, lo, hi, db, pan, seed) in ((10.75, 3.2, 430, 640, -35, -0.5, 1), (11.9, 2.6, 470, 700, -41, 0.6, 2),
                                         (115.9, 3.0, 440, 650, -37, 0.55, 3), (141.3, 3.4, 420, 630, -36, -0.4, 4), (142.6, 2.6, 480, 690, -42, 0.5, 5)):
    h = st(at_rms(howl(dur, lo, hi, 1.0, seed), db), pan); put(fx, conv(h, VALLEY) * 0.9 + h * 0.35, t0)
# ---- branch cracks (unseen), cloth strips, the unseen breath in the fog
for (t0, db, pan) in ((29.25, -27, 0.5), (102.55, -21, -0.6), (118.35, -19, -0.7), (119.2, -27, 0.6), (131.95, -31, 0.4)):
    c = st(at_peak(crack(1.0, int(t0 * 10)), db), pan); put(fx, conv(c, VALLEY) * 0.5 + c, t0)
fx[int(49.9 * SR):int(49.9 * SR) + int(7.0 * SR)] += at_rms(flutter(49.9, 56.9, 1.0), -44)
put(fx, at_rms(breath_swell(1.7, 1.0), -36), 97.25)
# ---- the woodcutter: axe chops, footsteps
for tc in (65.2375, 66.4875, 83.3875, 84.6375, 85.4375, 95.9535):
    a = st(at_peak(axe_chop(1.0), -15), 0.15); put(fx, conv(a, VALLEY) * 0.3 + a, tc)
STRIDE = 1.45
def steps_for(t0, t1, pts, u0, u1, ph0=0.0, level=0.07, carry=False):
    seg = [np.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1)]; Ltot = sum(seg)
    ts = np.arange(int((t1 - t0) * SR)) / SR + t0; u = u0 + (u1 - u0) * (ts - t0) / (t1 - t0); ph = u * Ltot / STRIDE + ph0
    k = np.floor((ph - 0.25) * 2); idx = np.where(np.diff(k) > 0)[0]
    for j, i in enumerate(idx): put(fx, at_peak(step(1.0), -29 + (2 if carry else 0) + rng.uniform(-1.5, 1.5)), ts[i], 1.0, -0.2 + 0.4 * (j % 2))
steps_for(62.2, 64.7, [[-1.5, 13.5], [8.58, 5.25]], 0.08, 0.42, 0, 0.05)
steps_for(67.7, 70.6, [[11.5, 7.6], [15.6, 10.4]], 0, 1, 0, 0.08, True)
steps_for(86.6, 88.95, [[13.2, 9.6], [16.9, 13.3]], 0, 1, 0.3, 0.08, True)
steps_for(96.3, 97.15, [[15.2, 12.3], [17.0, 14.7]], 0, 1, 0.6, 0.08, True)
for tc in (75.2, 75.8, 76.4, 77.0, 92.76, 93.49): put(fx, at_peak(step(1.0), -30), tc, 1.0, 0.1)
def ad_phase(t):                                           # shot AD: the walk slows while he looks back
    k = np.clip(((t - 104.0) - 0.55 * np.clip((t - 106.2) / 2.2, 0, 1) * 2.2) / 5.3, 0, 1); return k * 10.32 / STRIDE
tt = np.arange(104.0, 110.6, 0.001); kk = np.floor((ad_phase(tt) - 0.25) * 2)
for i in np.where(np.diff(kk) > 0)[0]: put(fx, at_peak(step(1.0, True), -33), tt[i], 1.0, 0.25)
for k in range(9): put(fx, at_peak(step(1.0), -27), 113.4 + 0.873 * k, 1.0, -0.15 + 0.3 * (k % 2))

# ---- music: drones, clusters, heartbeat, ney, bağlama, choir
D1, A1, D2 = midi(26), midi(33), midi(38)
put(mus, drone(D1, 5.5, 0.22, fc=180, a=2.5, r=1.0), 0.0)                          # cold open
put(mus, cluster([62, 66, 69, 74], 4.2, 0.10, fc=1800, a=1.2, r=1.2), 3.7)           # "Gündüzü cennet": warm, open D major
put(mus, ney([(74, 0.45), (76, 0.35), (78, 0.9), (76, 0.4), (74, 1.2)], 0.05), 4.1)
put(mus, cluster([50, 51, 57], 2.6, 0.13, fc=500, a=1.6, r=0.4), 7.0)               # "Ama gecesi": the light curdles
put(mus, riser(2.2, 0.14), 7.25)
put(mus, drone(D1, 31.0, 0.34, fc=160, a=0.05, r=4.0), 9.456)                      # the night drone (9.46 - ~40)
put(mus, cluster([38, 39, 45], 29.5, 0.16, fc=420, a=3.0, r=4.0, seed=3), 9.8)
put(mus, cluster([62, 63, 70], 6.0, 0.05, fc=2500, a=2.0, r=2.5, seed=8), 33.0)     # glassy shimmer over the star timelapse
mus += heartbeat(26.9, 33.0, 52, 56, 0.20)
put(mus, riser(2.6, 0.16), 35.9)
put(mus, drone(D1, 20.0, 0.30, fc=170, a=1.5, r=3.5), 41.4)                         # Kanlı Ardıç chapter
put(mus, cluster([38, 41, 44], 20.0, 0.15, fc=480, a=3.0, r=3.0, seed=4), 41.6)
put(mus, ney([(62, 0.6), (63, 0.5), (66, 0.9), (67, 0.5), (69, 1.4), (67, 0.4), (66, 0.5), (63, 0.6), (62, 1.6)], 0.075), 41.9)
put(mus, riser(2.1, 0.18), 45.2)
put(mus, choir([50, 51, 57, 62], 8.0, 0.05, a=2.5, r=2.5), 49.6)                     # the makam
put(mus, cluster([26, 27], 6.0, 0.22, fc=150, a=1.5, r=1.0, seed=6), 56.4)             # push into the dark
mus += heartbeat(57.0, 61.7, 58, 66, 0.22)
put(mus, riser(2.2, 0.2), 59.66 - 2.2 + 0.05)
# the legend: a memory-like bağlama ostinato in Hicaz (D Eb F# G A Bb C), low-passed with a slow wow
def ostinato(t0, t1, bpm, level, notes=(50, 51, 54, 55, 57, 55, 54, 51)):
    out = bus(); beat = 60 / bpm; t = t0; k = 0
    while t < t1:
        m = notes[k % len(notes)]; put(out, ks(m, 1.2, 0.3), t, level, -0.25); put(out, ks(m + 12, 0.8, 0.12), t + 0.01, level, 0.3)
        if k % 4 == 0: put(out, ks(38, 1.8, 0.35), t, level * 0.8, 0)
        t += beat / 2; k += 1
    return lp(out, 2600)
mus += ostinato(62.4, 74.5, 84, 0.55) * curve([(0, 0), (62.4, 0), (63.4, 1), (72.0, 1), (74.4, 0), (T, 0)])[:, None]
put(mus, drone(D1, 16.0, 0.20, fc=150, a=3.0, r=3.0), 62.2)
put(mus, cluster([50, 51, 54], 5.5, 0.07, fc=600, a=1.0, r=2.0, seed=9), 81.2)       # "Önce şaşırır"
mus += ostinato(83.0, 89.0, 98, 0.55, (50, 51, 54, 55, 57, 58, 57, 55)) * curve([(0, 0), (83.0, 0), (83.4, 1), (88.4, 1), (88.95, 0), (T, 0)])[:, None]
put(mus, drone(D1, 13.0, 0.26, fc=170, a=0.5, r=2.0), 88.9)
put(mus, cluster([38, 39, 44], 12.0, 0.15, fc=520, a=1.0, r=2.5, seed=10), 89.5)
mus += ostinato(95.4, 97.2, 112, 0.5, (50, 51, 54, 51)) * curve([(0, 0), (95.4, 0), (95.6, 1), (97.0, 1), (97.2, 0), (T, 0)])[:, None]
mus += heartbeat(101.6, 106.0, 70, 78, 0.24)
put(mus, cluster([50, 51, 57], 9.0, 0.08, fc=700, a=2.0, r=3.5, seed=11), 103.8)
put(mus, ney([(69, 1.2), (67, 0.6), (66, 0.7), (63, 0.7), (62, 2.4)], 0.06), 108.7)  # the long pause: a lone ney
put(mus, drone(D1, 16.0, 0.20, fc=130, a=2.0, r=3.0), 111.0)                         # "Şimdi bir düşünün": music almost gone
put(mus, cluster([38, 39], 13.5, 0.10, fc=380, a=4.0, r=1.0, seed=12), 113.0)
put(mus, riser(3.6, 0.17), 126.47 - 3.6 - 0.35)
put(mus, drone(D1, 6.0, 0.16, fc=110, a=1.0, r=3.0), 128.2)                           # under the whisper
put(mus, drone(D1, 14.0, 0.30, fc=170, a=1.2, r=4.0), 133.9)                        # the ending
put(mus, cluster([38, 41, 45, 50], 13.0, 0.14, fc=520, a=2.0, r=4.0, seed=13), 134.0)
put(mus, ney([(62, 0.5), (63, 0.5), (66, 0.8), (67, 0.6), (69, 1.0), (70, 0.6), (69, 0.6), (67, 0.5), (66, 0.6), (63, 0.7), (62, 2.8)], 0.07), 136.4)
put(mus, choir([38, 45, 50, 57], 7.5, 0.05, a=2.0, r=3.5), 139.6)

# ---- hits (CC0 sfx kit + synthesized sub drops), each after a short silence
HITS = [  # time, [(sample, gain dB)], sub drop amp
    (9.456, [('cinematic-drum-massive', -6), ('bass-sub-drop-long', -6)], 0.35),
    (11.15, [('boom-hit-soft', -14)], 0.0),
    (39.1, [('cinematic-drum-big', -8), ('boom-hit-strong', -10)], 0.3),
    (47.312, [('cinematic-drum-massive', -4), ('cinematic-thunder-big', -14), ('bass-sub-drop-long', -6)], 0.45),
    (59.66, [('boom-hit-strong', -9)], 0.25),
    (78.669, [('impact-deep-hard', -6), ('boom-hit-strong', -8)], 0.35),
    (90.938, [('cinematic-drum-big', -8), ('impact-deep-hard', -10)], 0.3),
    (99.005, [('cinematic-drum-massive', -6), ('bass-sub-drop-long', -8)], 0.4),
    (126.47, [('cinematic-drum-massive', -4), ('impact-deep-hard', -8), ('bass-sub-drop-long', -6)], 0.45),
    (139.95, [('boom-drop-strong', -9)], 0.25),
]
for t0, samples, sub in HITS:
    for name, g in samples: put(fx, load(name, g), t0 - 0.01)
    if sub: put(fx, st(subdrop(amp=sub * 0.5)), t0)
for t0 in (9.456, 47.312):                                                          # air drawn in before the two reveals
    rw = load('reverse-whoosh-long-soft', -15); put(fx, rw, t0 - 1.192)
put(fx, load('whoosh-slow-soft', -14), 62.2 - 0.45)                                 # into the memory
put(fx, load('whoosh-slow-soft', -14), 110.6 - 0.45)                                # back to the present
put(fx, load('riser-4s-soft', -16), 139.95 - 3.945)

# ================================================================== mix
narr, sr = sf.read(f'{P}/out/narration.wav'); narr = narr if narr.ndim == 1 else narr.mean(1)
narr = np.pad(narr, (0, max(0, N - len(narr))))[:N]
# voice envelope -> ducking (fast attack, slow release)
e = np.sqrt(signal.lfilter([1 / 2400], [1, -(1 - 1 / 2400)], narr ** 2)); act = np.clip((20 * np.log10(e + 1e-9) + 50) / 18, 0, 1)
duck = np.zeros(N); a_up, a_dn = 1 - np.exp(-1 / (0.03 * SR)), 1 - np.exp(-1 / (0.45 * SR)); y = 0.0
for i in range(0, N, 48):                                  # per millisecond
    v = act[i]; y += (v - y) * (1 - (1 - (a_up if v > y else a_dn)) ** 48); duck[i:i + 48] = y
mus_g = 10 ** (-7.5 * duck / 20); amb_g = 10 ** (-4.0 * duck / 20)
# silences before the critical lines (everything but the voice drops away), and the music "softens" at "Şimdi bir düşünün"
dip = curve([(0, 1), (9.0, 1), (9.35, 0.25), (9.456, 1),
             (46.9, 1), (47.2, 0.3), (47.312, 1),
             (76.4, 1), (77.2, 0.12), (78.66, 0.12), (78.669, 1),
             (90.5, 1), (90.85, 0.35), (90.938, 1),
             (98.6, 1), (98.95, 0.3), (99.005, 1),
             (125.6, 1), (126.1, 0.08), (126.46, 0.08), (126.47, 1),
             (131.9, 1), (132.6, 0.25), (133.9, 0.25), (134.3, 1), (T, 1)])
music_soft = curve([(0, 1), (110.6, 1), (111.6, 0.45), (126.0, 0.6), (133.9, 0.6), (134.4, 1), (T, 1)])
amb_m = amb * (amb_g * dip)[:, None]; mus_m = mus * (mus_g * dip * music_soft)[:, None]; fx_m = fx * (0.35 + 0.65 * dip)[:, None]
voice = st(narr) * 0.70710678
def limit(x, thr_db, win=0.012):                       # lookahead peak limiter (min-filtered, smoothed gain)
    from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
    w = int(win * SR); a = np.abs(x).max(1); pk = maximum_filter1d(a, 2 * w + 1)
    g = np.minimum(1.0, 10 ** (thr_db / 20) / (pk + 1e-12)); g = uniform_filter1d(minimum_filter1d(g, 2 * w + 1), w)
    return x * g[:, None]
AMB_TRIM, MUS_TRIM, FX_TRIM = 10 ** (-4 / 20), 10 ** (-7 / 20), 10 ** (1 / 20)
amb_m *= AMB_TRIM; mus_m *= MUS_TRIM; fx_m *= FX_TRIM
voice = limit(voice, -11.0, 0.008); fx_m = limit(fx_m, -9.0, 0.015)
premix = voice + amb_m + mus_m + fx_m
fade = curve([(0, 1), (T - 1.6, 1), (T, 0)]); premix *= fade[:, None]
for name, x in (('ambience', amb_m), ('music', mus_m), ('sfx', fx_m), ('premix', premix)):
    sf.write(f'{P}/out/audio/{name}.wav', x[:int(T * SR)].astype(np.float32), SR)
pk = np.abs(premix).max(); print('premix peak', round(float(pk), 3), 'duration', round(T, 2))
