# Synthesizes score, ambience, SFX and processed narration on the shared timeline; writes stems + premix.
import numpy as np, soundfile as sf, json, os
from scipy import signal
SR = 48000
W = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TL = json.load(open(f'{W}/timeline.json'))
T = TL['duration']; S = TL['sections']
# optional time-warp (provided narration): events are designed on the original 60 s timeline and mapped to the new one
WARP = None
if os.path.exists(f'{W}/warp.json'):
    import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import warp_util
    WARP, _f, G = warp_util.load(f'{W}/warp.json'); T = WARP['duration']
else:
    G = lambda t: t
N = int(SR * T)
BEAT = 60 / TL['bpm']; BAR = 4 * BEAT; A0 = TL['barAnchor']
rng = np.random.default_rng(11)

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def bus(): return np.zeros((N, 2))
def put(buf, x, t0, g=1.0, pan=0.0, warp=True):
    if warp: t0 = G(t0)
    if x.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4) * 1.41421; r = np.sin((pan + 1) * np.pi / 4) * 1.41421
        x = np.stack([x * l, x * r], 1)
    i = int(round(t0 * SR))
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i)
    if n > 0: buf[i:i + n] += g * x[:n]
def smooth_env(n, a, r, hold=None):
    """0->1 over a s (sin^2), hold, 1->0 over last r s."""
    e = np.ones(n); na = min(n, max(1, int(a * SR))); nr = min(n, max(1, int(r * SR)))
    e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    e[n - nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e
def lp(x, fc, order=2): b, a = signal.butter(order, fc, fs=SR); return signal.lfilter(b, a, x, axis=0)
def hp(x, fc, order=2): b, a = signal.butter(order, fc, 'high', fs=SR); return signal.lfilter(b, a, x, axis=0)
def bp(x, lo, hi, order=2): b, a = signal.butter(order, [lo, hi], 'band', fs=SR); return signal.lfilter(b, a, x, axis=0)
def peq(x, f0, gain_db, q=1.0):
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / SR; al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return signal.lfilter(b, a, x, axis=0)

# ---------- oscillators ----------
_tab = {}
def saw_tab(f, maxf=7000, size=8192):
    k = (round(f, 2), maxf)
    if k not in _tab:
        nh = max(1, int(maxf / f)); ph = np.arange(size) / size; tab = np.zeros(size)
        for h in range(1, nh + 1): tab += np.sin(2 * np.pi * h * ph) / h * (0.97 ** h)
        _tab[k] = tab * 2 / np.pi
    return _tab[k]
def osc(tab, f, n, ph0=0.0, vib=None):
    inc = np.full(n, f / SR) if vib is None else f * (1 + vib) / SR
    ph = (ph0 + np.cumsum(inc)) % 1.0
    idx = ph * len(tab); i0 = idx.astype(np.int64); fr = idx - i0
    return tab[i0] * (1 - fr) + tab[(i0 + 1) % len(tab)] * fr

def pad(notes, dur, fc=1600, amp=0.07, a=0.8, r=1.8):
    n = int((dur + r) * SR); out = np.zeros((n, 2)); t = np.arange(n) / SR
    for m in notes:
        f = midi(m); tab = saw_tab(f)
        for ch in (0, 1):
            for det in (-0.006, 0.0, 0.0065):
                vib = 0.0018 * np.sin(2 * np.pi * rng.uniform(3.8, 5.2) * t + rng.uniform(0, 6.3))
                out[:, ch] += osc(tab, f * (1 + det + (0.0015 if ch else -0.0015)), n, rng.random(), vib)
    sweep = lp(out, fc)
    e = smooth_env(n, a, r)
    return sweep * e[:, None] * amp / np.sqrt(len(notes) * 3)

def strings_low(m, dur, amp):
    f = midi(m); n = int((dur + 0.25) * SR); t = np.arange(n) / SR
    tab = saw_tab(f, 2500)
    x = osc(tab, f, n, rng.random()) + 0.6 * osc(tab, f * 1.004, n, rng.random()) + 0.4 * osc(tab, f * 2.002, n, rng.random())
    x = lp(x, 900)
    e = (1 - np.exp(-t / 0.008)) * np.exp(-t / max(0.08, dur * 0.7))
    return x * e * amp

def piano(m, dur=4.0, amp=0.25):
    f = midi(m); n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n); B = 0.00025
    for h in range(1, 14):
        fh = h * f * np.sqrt(1 + B * h * h)
        if fh > 12000: break
        x += (1 / h ** 1.25) * np.sin(2 * np.pi * fh * t + rng.random() * 6.28) * np.exp(-t / (dur * 0.42 / (1 + 0.35 * (h - 1))))
    ham = lp(rng.standard_normal(n) * np.exp(-t / 0.003), 2500) * 0.15
    return (x + ham) * (1 - np.exp(-t / 0.0015)) * amp

def bell(m, dur=3.0, amp=0.12):
    f = midi(m); n = int(dur * SR); t = np.arange(n) / SR
    I = 1.6 * np.exp(-t / 0.25)
    return np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / 1.1) * (1 - np.exp(-t / 0.002)) * amp

def ks(m, dur=1.8, amp=0.3, g=0.997, bright=6000):
    f = midi(m); n = int(dur * SR); p = int(round(SR / f))
    exc = np.zeros(n); burst = lp(rng.uniform(-1, 1, p * 2), bright); exc[:p] = burst[:p] * np.hanning(p) ** 0.3
    a = np.zeros(p + 2); a[0] = 1; a[p] = -g / 2; a[p + 1] = -g / 2
    y = signal.lfilter([1.0], a, exc)
    t = np.arange(n) / SR
    return y / (np.abs(y).max() + 1e-9) * amp * np.exp(-t / (dur * 0.8))
def baglama(m, dur=1.6, amp=0.3):
    # double course: string + octave string, slightly strummed -> Anatolian saz colour
    x = ks(m, dur, amp, 0.996, 7000); y = ks(m + 12, dur, amp * 0.55, 0.995, 8000)
    d = int(0.012 * SR); y = np.concatenate([np.zeros(d), y[:-d]])
    z = x + y; return peq(z, 2500, 3, 1.2)

# ---------- percussion & fx ----------
def tom(f1=140, f0=55, decay=0.42, amp=0.55):
    n = int(decay * 6 * SR); t = np.arange(n) / SR
    f = f0 + (f1 - f0) * np.exp(-t / 0.035); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    nz = lp(rng.standard_normal(n) * np.exp(-t / 0.012), 1500)
    return np.tanh(1.3 * (x + 0.4 * nz)) * amp * 0.6
def boom(amp=1.0, tail=1.2):
    n = int(4.5 * SR); t = np.arange(n) / SR
    f = 36 + 120 * np.exp(-t / 0.08); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tail)
    nz = lp(rng.standard_normal(n) * np.exp(-t / 0.06), 1100)
    body = np.sin(2 * np.pi * 92 * t) * np.exp(-t / 0.25) * 0.4
    return np.tanh(1.6 * (x + 0.5 * nz + body)) * amp * 0.5
def frame_drum(low=True, amp=0.25):
    n = int(0.6 * SR); t = np.arange(n) / SR
    if low:
        x = np.sin(2 * np.pi * (95 + 40 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.16) + 0.3 * bp(rng.standard_normal(n), 150, 600) * np.exp(-t / 0.03)
    else:
        x = bp(rng.standard_normal(n), 700, 4000) * np.exp(-t / 0.035) + 0.3 * np.sin(2 * np.pi * 320 * t) * np.exp(-t / 0.04)
    return x * amp
def knock(amp=0.25):  # kirkit (loom comb) thump
    n = int(0.35 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * (170 + 60 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05) + 0.6 * bp(rng.standard_normal(n), 250, 1800) * np.exp(-t / 0.012)
    return x * amp
def sweep_noise(dur, f_start, f_end, env, amp, stereo=True, bw=0.35):
    n = int(dur * SR); x = rng.standard_normal((n, 2) if stereo else n)
    nper = 2048
    def proc(sig):
        f, tt, Z = signal.stft(sig, SR, nperseg=nper)
        fc = f_start * (f_end / f_start) ** np.clip(tt / dur, 0, 1)
        lf = np.log(np.maximum(f, 20))[:, None]
        Z *= np.exp(-0.5 * ((lf - np.log(fc)[None, :]) / bw) ** 2)
        return signal.istft(Z, SR, nperseg=nper)[1][:n]
    y = np.stack([proc(x[:, 0]), proc(x[:, 1])], 1) if stereo else proc(x)
    e = env(np.arange(len(y)) / SR / dur)
    y = y * (e[:, None] if stereo else e)
    return y / (np.abs(y).max() + 1e-9) * amp
def whoosh(dur=1.0, amp=0.35, up=True):
    env = lambda u: np.sin(np.pi * np.clip(u, 0, 1)) ** 2 * (u ** 0.5)
    y = sweep_noise(dur, 250 if up else 3000, 3500 if up else 300, env, amp)
    pan = np.linspace(-0.7, 0.7, len(y)); y[:, 0] *= (1 - pan) * 0.8; y[:, 1] *= (1 + pan) * 0.8
    return y
def riser(dur=2.0, amp=0.3):
    y = sweep_noise(dur, 200, 7000, lambda u: np.clip(u, 0, 1) ** 2.2, amp, bw=0.25)
    t = np.arange(len(y)) / SR; f = 110 * 2 ** (2.5 * t / dur)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2 * amp * 0.35
    return y + tone[:, None]
def rev_cym(dur=1.6, amp=0.22):
    n = int(dur * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal((n, 2)), 3500) * ((t / dur) ** 3)[:, None]
    return x * amp
def ping(m=86, amp=0.18):
    a = bell(m, 2.2, amp); b = bell(m + 12, 1.2, amp * 0.5); a[:len(b)] += b; return a

# ---------- ambience ----------
def pink(n, ch=2):
    X = np.fft.rfft(rng.standard_normal((n, ch)), axis=0); f = np.fft.rfftfreq(n, 1 / SR); f[0] = 1
    X /= np.sqrt(f)[:, None]; x = np.fft.irfft(X, n, axis=0); return x / np.abs(x).max()
def brown(n, ch=2):
    x = np.cumsum(rng.standard_normal((n, ch)), 0); x = hp(x, 25); return x / np.abs(x).max()
def lfo_noise(n, rate=0.25, depth=0.4):
    k = max(4, int(n / SR * rate) + 4); pts = rng.uniform(1 - depth, 1, k)
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)
def region_env(t0, t1, fade_in, fade_out):
    n = int((G(t1) - G(t0)) * SR); return smooth_env(n, fade_in, fade_out)
def water(t0, t1, level, roar=True, fi=0.6, fo=0.8):
    n = int((G(t1) - G(t0)) * SR)
    if roar: x = 0.7 * bp(pink(n), 250, 6000) + 0.5 * lp(brown(n), 220)
    else: x = 0.8 * hp(pink(n), 600) * lfo_noise(n, 3.0, 0.5)[:, None] + 0.2 * lp(brown(n), 300)
    x = x / np.abs(x).max() * lfo_noise(n, 0.4, 0.25)[:, None]
    return x * region_env(t0, t1, fi, fo)[:, None] * level
def wind(t0, t1, level, fi=1.0, fo=1.0):
    n = int((G(t1) - G(t0)) * SR); x = np.zeros((n, 2))
    for ch in (0, 1):
        base = pink(n, 1)[:, 0]; mod = lfo_noise(n, 0.35, 0.8)
        x[:, ch] = bp(base, 250, 1400) * mod + 0.4 * lp(brown(n, 1)[:, 0], 180)
    x /= np.abs(x).max()
    return x * region_env(t0, t1, fi, fo)[:, None] * level

# =============== SCORE ===============
music = bus(); fx = bus(); amb = bus(); voice = bus()
bar = lambda k: A0 + (k - 4) * BAR   # bar 4 == barAnchor (25.3s)
CH = {
 'Dm': (38, [50, 57, 62, 65, 69]), 'Bb': (34, [46, 53, 58, 62, 65]), 'F': (41, [53, 60, 65, 69, 72]),
 'C': (36, [48, 55, 60, 64, 67]), 'Gm': (43, [55, 62, 67, 70]), 'A': (33, [45, 57, 61, 64, 69]),
 'D': (38, [50, 57, 62, 66, 69, 74]),
}
# intro drone + piano motif (0 - 7.4)
d_n = int(9.0 * SR); t = np.arange(d_n) / SR
drone = sum(osc(saw_tab(midi(m), 1200), midi(m) * (1 + det), d_n, rng.random()) for m in (26, 38) for det in (-0.003, 0.003))
drone = lp(drone, 400) * smooth_env(d_n, 3.0, 2.5) * 0.035
put(music, drone, 0.0)
put(music, pad([62, 69, 74, 77], 6.4, fc=1100, amp=0.025, a=2.5, r=2.0), 0.8)
for tt, m in [(1.0, 74), (1.75, 69), (2.5, 77), (3.6, 76), (4.4, 72), (5.2, 74), (6.0, 69), (6.8, 62)]:
    put(music, piano(m, 4.5, 0.16), tt, pan=rng.uniform(-0.3, 0.3))
# map (7.4 - 11.6): soft pulse + riser into title hit
for k in range(7):
    put(music, strings_low(38, 0.25, 0.10), 7.6 + k * BEAT)
put(music, pad(CH['Dm'][1], 3.6, fc=900, amp=0.05, a=1.0, r=0.6), 7.6)
put(fx, riser(1.3, 0.16), G(S['title']) - 1.3, warp=False)
put(fx, rev_cym(1.2, 0.14), G(S['title']) - 1.2, warp=False)
put(fx, ping(86, 0.16), 8.6, pan=-0.2)          # Kayseri pin
put(fx, ping(81, 0.2), 10.55, pan=0.2)          # Yahyali pin
put(fx, boom(0.5, 0.55), S['title'])
put(music, pad(CH['Dm'][1] + [74], 3.0, fc=1800, amp=0.032, a=0.05, r=2.2), S['title'])
put(music, strings_low(26, 2.5, 0.10), S['title'])
# mountains: chords bars 0..3 (Dm Bb F C) soft
prog = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'Dm', 'Bb', 'A']
for k, c in enumerate(prog):
    t0 = bar(k); dur = BAR if c != 'A' else (S['break'] - t0)
    if k <= 3: amp, fc = 0.055, 1300
    elif k <= 7: amp, fc = 0.07, 2600
    elif k <= 9: amp, fc = 0.06, 1800
    else: amp, fc = 0.05, 1500
    put(music, pad(CH[c][1], dur, fc=fc, amp=amp, a=0.35 if k else 0.9, r=1.4 if k < 12 else 0.4), t0)
    root = CH[c][0]
    if 1 <= k <= 3:      # quarter-note heartbeat
        for b in range(4): put(music, strings_low(root, BEAT * 0.9, 0.09 if b else 0.12), t0 + b * BEAT)
    if 4 <= k <= 7:      # driving 8th ostinato
        for e in range(8):
            mm = root + (12 if e in (3, 6) else 0)
            put(music, strings_low(mm, BEAT * 0.45, 0.11 if e % 2 == 0 else 0.08), t0 + e * BEAT / 2)
    if 8 <= k <= 9:
        for b in range(4): put(music, strings_low(root, BEAT * 0.8, 0.10), t0 + b * BEAT)
    if k >= 10:
        put(music, strings_low(root, BAR * 0.95, 0.08), t0)
# snow bells (C arpeggio) 21.7 - 25.3
for i, m in enumerate([84, 88, 91, 96, 91, 88, 84, 79, 84, 88]):
    put(music, bell(m, 2.5, 0.07), S['snow'] + 0.15 + i * BEAT / 2 * 1.05, pan=np.sin(i) * 0.5)
# big hit into Kapuzbasi
put(fx, rev_cym(2.0, 0.2), G(S['kapuzbasi']) - 2.0, warp=False)
put(fx, riser(1.6, 0.14), G(S['kapuzbasi']) - 1.6, warp=False)
put(fx, boom(0.6, 0.9), S['kapuzbasi'])
# drums 25.3 - 35.97 epic, 35.97 - 41.3 lighter
for k in range(4, 10):
    t0 = bar(k)
    if k <= 7:
        for b, a in [(0, 0.6), (1.5, 0.35), (2, 0.5), (3, 0.4), (3.5, 0.32)]:
            put(music, tom(150, 58, 0.4, a * 0.6), t0 + b * BEAT, pan=rng.uniform(-0.25, 0.25))
        for e in range(8): put(music, frame_drum(False, 0.035 if e % 2 else 0.055), t0 + e * BEAT / 2, pan=0.35)
        if k == 7:
            for s in range(4): put(music, tom(190, 70, 0.25, 0.25 + 0.08 * s), t0 + 3 * BEAT + s * BEAT / 4)
    else:
        for b, a in [(0, 0.45), (2, 0.35)]: put(music, tom(140, 55, 0.4, a), t0 + b * BEAT)
        for b in (0, 1.5, 2, 3): put(music, frame_drum(True, 0.14), t0 + b * BEAT, pan=-0.2)
# zamanti arpeggio (harp-like plucks) 31 - 37.5
arp = {'F': [65, 69, 72, 77], 'C': [64, 67, 72, 76], 'Dm': [62, 65, 69, 74], 'Gm': [62, 67, 70, 74]}
for k in (6, 7, 8, 9):
    c = prog[k]; notes = arp[c]
    for e in range(8):
        tt = bar(k) + e * BEAT / 2
        if S['zamanti'] - 0.1 <= tt < S['hali'] - 0.2:
            put(music, ks(notes[e % 4] + (12 if e >= 4 else 0), 1.4, 0.06, 0.995, 9000), tt, pan=(-0.4 if e % 2 else 0.4))
# hali: baglama melody + frame drum (duum-tek) + loom knocks
mel = [(0, 69, .5), (.5, 67, .25), (.75, 69, .25), (1, 65, .5), (1.5, 64, .5), (2, 62, 1.0), (3.25, 64, .25), (3.5, 65, .5),
       (4, 62, .5), (4.5, 65, .5), (5, 67, .5), (5.5, 69, .5), (6, 70, .5), (6.5, 69, .25), (6.75, 67, .25), (7, 65, .5), (7.5, 64, .5),
       (8, 64, .5), (8.5, 65, .25), (8.75, 64, .25), (9, 62, .5), (9.5, 61, .5), (10, 62, .5), (10.5, 64, 1.0)]
for b, m, d in mel:
    tt = bar(10) + b * BEAT
    if tt < S['break'] - 0.05:
        put(music, baglama(m, max(0.9, d * BEAT * 3), 0.16), tt, pan=0.15)
        if d >= 0.5 and b not in (0, 4, 8): put(music, baglama(m + 1 if m in (64, 69) else m + 2, 0.25, 0.05), tt - 0.06, pan=0.15)  # grace note
for k in (10, 11, 12):
    for b, low in [(0, True), (1.5, False), (2, True), (3, False), (3.5, False)]:
        tt = bar(k) + b * BEAT
        if tt < S['break'] - 0.1: put(music, frame_drum(low, 0.18 if low else 0.1), tt, pan=-0.25)
for i in range(10):   # weaving: comb knocks in rhythm with animation
    put(fx, knock(0.18), S['hali'] + 0.35 + i * BEAT / 2 * (1.0 if i < 6 else 1.2), pan=0.1)
# break + three hits (DAG / SU / EMEK)
put(fx, rev_cym(0.45, 0.25), G(S['dag']) - 0.45, warp=False)
for key, c, extra in [('dag', 'Dm', 0), ('su', 'Bb', 0), ('emek', 'C', 0)]:
    tt = S[key]
    put(fx, boom(0.42, 0.45), tt)
    put(music, pad(CH[c][1], 0.6, fc=2200, amp=0.035, a=0.01, r=0.6), tt)
    put(music, strings_low(CH[c][0], 0.6, 0.14), tt)
put(fx, sweep_noise(1.2, 3000, 300, lambda u: np.exp(-4 * u) * np.clip(u * 30, 0, 1), 0.2), S['su'])   # splash
# final: swell to D major (Picardy) and end card
put(fx, riser(1.3, 0.12), G(S['final']) - 0.8, warp=False)
put(music, pad(CH['D'][1], T - G(S['final']) - 1.6, fc=2200, amp=0.075, a=1.0, r=2.6), S['final'])
put(music, strings_low(26, 6.0, 0.16), 52.4)
put(fx, boom(0.4, 1.2), S['final'])
for tt, m in [(55.2, 74), (55.9, 69), (56.6, 78), (57.4, 81), (58.3, 74)]:
    put(music, piano(m, 4.0, 0.15), tt, pan=rng.uniform(-0.25, 0.25))
# transitions whooshes
for tt in [S['map'], S['aladaglar'], S['snow'], S['zamanti'], S['derebag'], S['hali'], S['final'], S['endcard']]:
    put(fx, whoosh(1.0, 0.22), G(tt) - 0.6, warp=False)
# ambience
put(amb, water(0.0, 7.9, 0.10, True, 2.0, 0.8), 0.0)
put(amb, wind(7.2, 11.8, 0.05), 7.2)
put(amb, wind(14.4, 22.2, 0.08, 1.2, 1.0), 14.4)
put(amb, water(21.5, 25.5, 0.05, False), 21.5)
put(amb, water(25.1, 31.4, 0.09, True, 0.2, 0.8), 25.1)
put(amb, water(30.8, 37.8, 0.08, False, 0.6, 0.8), 30.8)
put(amb, wind(37.3, 41.6, 0.05, 0.6, 0.8), 37.3)
put(amb, water(49.5, 51.0, 0.12, True, 0.05, 1.0), 49.5)
put(amb, water(51.7, 56.0, 0.06, True, 0.8, 1.8), 51.7)
put(amb, wind(54.5, 60.0, 0.04, 1.0, 3.0), 54.5)

# =============== VOICE ===============
if WARP:
    x, sr = sf.read(f'{W}/voice2/voice_edit48.wav')
    x = hp(x, 70); x = peq(x, 3000, 1.0, 1.0)
    fr = int(0.05 * SR); e = np.sqrt(np.convolve(x ** 2, np.ones(fr) / fr, 'same')); act = e > e.max() * 0.08
    x = x / (np.sqrt(np.mean(x[act] ** 2)) + 1e-9) * 0.085
    put(voice, x, WARP['voiceOffset'], warp=False)
else:
    for nid, t0 in TL['narration'].items():
        x, sr = sf.read(f'{W}/audio/fahrettin/{nid}.wav')
        x = signal.resample_poly(x, 320, 147)
        x = hp(x, 75); x = peq(x, 180, 1.5, 0.8); x = peq(x, 3200, 2.5, 1.0); x = peq(x, 7000, -2.0, 1.0)
        x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.085
        put(voice, x, t0)
# gentle compression on voice bus
env = np.sqrt(np.maximum(lp(voice.mean(1) ** 2, 12), 0) + 1e-12); thr = 0.06
g = np.where(env > thr, (thr / env) ** (1 - 1 / 2.5), 1.0); voice *= g[:, None]

# =============== REVERB & DUCKING ===============
def make_ir(t60, pre=0.02):
    n = int(t60 * SR); tt = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-6.91 * tt / t60)[:, None]
    ir = hp(lp(ir, 5500, 1), 180, 1)
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir]); return ir / np.sqrt((ir ** 2).sum(0))
def conv(x, ir): return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in (0, 1)], 1)
music = music + 0.35 * conv(music, make_ir(3.2))
fx = fx + 0.25 * conv(fx, make_ir(2.4))
voice = voice + 0.06 * conv(voice, make_ir(0.9, 0.01))
vact = np.sqrt(lp(np.abs(voice.mean(1)), 8) ** 2) > 0.004
a_c = np.exp(-1 / (0.06 * SR)); r_c = np.exp(-1 / (0.45 * SR))
sm = signal.lfilter([1 - r_c], [1, -r_c], vact.astype(float))   # release-ish smoothing
sm = np.maximum(sm, signal.lfilter([1 - a_c], [1, -a_c], vact.astype(float)))
duck = 1 - 0.62 * np.clip(sm * 1.6, 0, 1)
music *= duck[:, None]; amb *= (1 - 0.35 * np.clip(sm * 1.6, 0, 1))[:, None]; fx *= (1 - 0.45 * np.clip(sm * 1.6, 0, 1))[:, None]

mix = music * 0.5 + fx * 0.6 + amb * 1.4 + voice * 1.0
fade = np.ones(N); nf = int(1.2 * SR); fade[-nf:] = np.linspace(1, 0, nf) ** 2
mix *= fade[:, None]
peak = np.abs(mix).max(); print('peak before norm', round(peak, 3))
mix = mix / peak * 0.89
os.makedirs(f'{W}/audio/out', exist_ok=True)
sf.write(f'{W}/audio/out/premix.wav', mix.astype(np.float32), SR)
for name, b in [('music', music * 0.5), ('fx', fx * 0.6), ('amb', amb * 1.4), ('voice', voice)]:
    sf.write(f'{W}/audio/out/stem_{name}.wav', (b / peak * 0.89).astype(np.float32), SR)
print('ok', mix.shape)
