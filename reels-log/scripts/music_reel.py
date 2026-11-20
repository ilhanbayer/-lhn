# Original 15 s score for the canyon reel: felt piano, strings and a soft swell on the third line (9.0 s).
# A minor, 80 BPM (one bar = 3 s): Am | F | C G | F (swell) | C G -> loops back to Am.
# Also a faint river/wind bed. Writes work/music.wav (48 kHz stereo float).
import os, numpy as np, soundfile as sf
from scipy import signal
SR = 48000; D = 15.0; N = int(D * SR)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'work', 'music.wav')
rng = np.random.default_rng(21)
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f, o=2): b, a = signal.butter(o, f, fs=SR); return signal.lfilter(b, a, x, axis=0)
def hp(x, f, o=2): b, a = signal.butter(o, f, 'high', fs=SR); return signal.lfilter(b, a, x, axis=0)
def bp(x, lo, hi, o=2): b, a = signal.butter(o, [lo, hi], 'band', fs=SR); return signal.lfilter(b, a, x, axis=0)
def st(x, pan=0.0): return np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)], 1) * 1.414
def put(buf, x, t0, g=1.0):
    i = int(t0 * SR); n = min(len(x), len(buf) - i)
    if n > 0: buf[i:i + n] += g * x[:n]

def felt_piano(m, dur=3.5, vel=0.6):
    """Soft 'felt' piano: inharmonic partials, two detuned strings, quick velocity-dependent brightness, felt thump."""
    f = midi(m); n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n); B = 0.00032
    for k in range(1, 16):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 9000: break
        amp = (1 / k ** (1.6 - 0.5 * vel)) * (1 if k < 7 else 0.6)
        dec = dur * 0.55 / (1 + 0.45 * (k - 1))
        for det in (-0.0009, 0.0011):
            x += amp * 0.5 * np.sin(2 * np.pi * fk * (1 + det) * t + rng.uniform(0, 6.28)) * np.exp(-t / dec)
    thump = lp(rng.standard_normal(n) * np.exp(-t / 0.012), 700) * 0.25 * vel
    y = (x + thump) * (1 - np.exp(-t / 0.004))
    y = lp(y, 1800 + 2600 * vel)
    return y * vel * 0.32 * (1 - np.exp(-(dur - t).clip(0) / 0.25))

def strings(notes, dur, amp, a=1.2, r=1.5, bright=2400):
    n = int((dur + r) * SR); t = np.arange(n) / SR; out = np.zeros((n, 2))
    for m in notes:
        for k, det in enumerate((-0.004, -0.0013, 0.0016, 0.0042)):
            vib = 1 + 0.003 * np.sin(2 * np.pi * (4.8 + 0.3 * k) * t + rng.uniform(0, 6.3))
            ph = np.cumsum(midi(m) * (1 + det) * vib) / SR
            saw = 2 * (ph % 1) - 1
            out += st(saw, -0.7 + 0.47 * k)
    env = np.clip(t / a, 0, 1) ** 1.5 * np.clip((dur + r - t) / r, 0, 1)
    out = lp(lp(out, bright), bright * 1.4) * env[:, None]
    return out * amp / (4 * len(notes))

def pad(notes, dur, amp):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros((n, 2))
    for m in notes:
        for det in (-0.006, 0.006):
            out += st(np.sin(2 * np.pi * midi(m) * (1 + det) * t) + 0.3 * np.sin(4 * np.pi * midi(m) * (1 + det) * t), det * 100)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8
    return lp(out, 1500) * env[:, None] * amp / len(notes)

def boom(amp=0.5):
    n = int(2.5 * SR); t = np.arange(n) / SR; f = 34 + 30 * np.exp(-t / 0.18)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9) * (1 - np.exp(-t / 0.006))
    x += lp(rng.standard_normal(n) * np.exp(-t / 0.05), 300) * 0.3
    return st(x) * amp

def riser(dur, amp):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur; out = np.zeros((n, 2)); x = rng.standard_normal((n, 2))
    for i0 in range(0, n, 4096):
        i1 = min(n, i0 + 8192); f = 400 + 4200 * u[i0] ** 2
        out[i0:i1] += bp(x[i0:i1], f * 0.8, f * 1.25) * np.hanning(i1 - i0)[:, None]
    return out * (u ** 2.2)[:, None] * amp

def make_ir(t60=2.6, pre=0.02):
    n = int(t60 * SR); t = np.arange(n) / SR; r = rng.standard_normal((n, 2)) * np.exp(-6.91 * t / t60)[:, None]
    r = lp(hp(r, 120), 5200); r = np.concatenate([np.zeros((int(pre * SR), 2)), r]); return r / np.sqrt((r ** 2).sum() / 2)
def conv(x, ir): return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in (0, 1)], 1)

mus = np.zeros((N + 3 * SR, 2))
BAR = 3.0; BEAT = 0.75
# chords (midi): Am(add9) | Fmaj7 | C  G | F(add9) | C/E  G
CH = [(0.0, [45, 52, 57, 59, 64]), (3.0, [41, 48, 57, 60, 64]), (6.0, [48, 55, 60, 64, 67]), (7.5, [43, 50, 55, 59, 62]),
      (9.0, [41, 48, 55, 57, 60, 67]), (12.0, [40, 48, 55, 60, 64]), (13.5, [43, 50, 55, 59, 62, 67])]
# piano: broken-chord arpeggios (eighths) on the low/mid notes, softer in the intro
for i, (t0, notes) in enumerate(CH):
    t1 = CH[i + 1][0] if i + 1 < len(CH) else D
    seq = notes[:4] + notes[2:4][::-1]; k = 0; t = t0
    vel0 = 0.36 if t0 < 6 else 0.46 if t0 < 9 else 0.55
    while t < t1 - 0.05:
        m = seq[k % len(seq)]; put(mus, st(felt_piano(m, 3.0, vel0 * rng.uniform(0.85, 1.05)), -0.25 + 0.1 * (k % 4)), t)
        t += BEAT / 2; k += 1
    put(mus, st(felt_piano(notes[0] - 12, 4.0, vel0 * 0.8), -0.1), t0)            # bass note under each chord
# melody (right hand, higher): enters with line 2 (3.0 s), lifts an octave at the swell (9.0 s)
MEL = [(3.0, 72, 0.9), (3.75, 76, 0.7), (4.5, 74, 0.9), (5.25, 72, 0.7), (6.0, 76, 1.2), (7.5, 74, 0.9), (8.25, 71, 0.6),
       (9.0, 81, 1.2), (9.75, 79, 0.7), (10.5, 76, 0.7), (11.25, 77, 0.6), (12.0, 76, 1.0), (12.75, 74, 0.6), (13.5, 74, 1.4), (14.25, 71, 0.8)]
for t0, m, d in MEL: put(mus, st(felt_piano(m, 2.6 + d, 0.62 if t0 < 9 else 0.72), 0.2), t0)
# strings: low from 3 s, swelling into 9 s, full section after
put(mus, strings([45, 52], 3.0, 0.10, a=1.5, r=0.6), 3.0)
put(mus, strings([48, 55, 60], 1.5, 0.14, a=0.9, r=0.3), 6.0)
put(mus, strings([43, 50, 55, 62], 1.5, 0.20, a=1.2, r=0.15), 7.5)
put(mus, strings([41, 48, 57, 60, 65, 69], 3.0, 0.34, a=0.35, r=0.4), 9.0)
put(mus, strings([40, 48, 55, 64, 67, 72], 1.5, 0.30, a=0.4, r=0.3), 12.0)
put(mus, strings([43, 50, 59, 62, 67, 71], 1.5, 0.24, a=0.4, r=1.6), 13.5)
put(mus, pad([57, 64, 69], 9.0, 0.035), 0.0)
put(mus, pad([53, 60, 65, 69], 6.5, 0.05), 8.5)
# the swell: riser into 9.0, a breath of silence, then a soft boom
put(mus, riser(2.4, 0.05), 9.0 - 2.4)
put(mus, boom(0.42), 9.0)
dip = np.ones(len(mus)); i0, i1 = int(8.86 * SR), int(9.0 * SR); dip[i0:i1] = np.linspace(1, 0.25, i1 - i0)
mus *= dip[:, None]
wet = conv(mus, make_ir()); mus = mus * 0.82 + wet * 0.30
# river and wind bed (very faint): louder once the river opens up
n = len(mus); t = np.arange(n) / SR
river = bp(rng.standard_normal((n, 2)), 300, 4500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * t))[:, None]
wind = lp(np.cumsum(rng.standard_normal((n, 2)), 0) * 0.002, 400); wind -= lp(wind, 20)
lvl = np.interp(t, [0, 4, 9, 15, 18], [0.006, 0.006, 0.010, 0.012, 0.0])
mus += (river * 0.6 + wind * 3.0) * lvl[:, None]
mus = mus[:N]
fade = np.ones(N); fade[:int(0.25 * SR)] = np.linspace(0, 1, int(0.25 * SR)) ** 2; fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR)) ** 1.5
mus *= fade[:, None]
os.makedirs(os.path.dirname(OUT), exist_ok=True); sf.write(OUT, (mus / np.abs(mus).max() * 0.7).astype(np.float32), SR)
print('music', round(D, 2), 's')
