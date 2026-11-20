# Processes the narration takes (EQ, intensity, near-whisper layers, reverb) and joins them with the
# scripted silences into one narration track. Writes out/narration.wav and timeline.json (line timings).
import json, os, sys, numpy as np, soundfile as sf
from scipy import signal
P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000; LEAD = 2.0              # the first line starts after 2 s of black + wind
rng = np.random.default_rng(3)
lines = json.load(open(f'{P}/narration.json')); man = json.load(open(f'{P}/voice/manifest.json'))

def peq(x, f0, g, q=1.0):
    A = 10 ** (g / 40); w = 2 * np.pi * f0 / SR; al = np.sin(w) / (2 * q)
    return signal.lfilter([1 + al * A, -2 * np.cos(w), 1 - al * A], [1 + al / A, -2 * np.cos(w), 1 - al / A], x)
def shelf(x, f0, g, high=False):
    A = 10 ** (g / 40); w = 2 * np.pi * f0 / SR; c, s = np.cos(w), np.sin(w); al = s / 2 * np.sqrt(2); k = 2 * np.sqrt(A) * al
    if high: b = [A * ((A + 1) + (A - 1) * c + k), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - k)]; a = [(A + 1) - (A - 1) * c + k, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - k]
    else: b = [A * ((A + 1) - (A - 1) * c + k), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - k)]; a = [(A + 1) + (A - 1) * c + k, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - k]
    return signal.lfilter(b, a, x)
def bfilt(x, f, kind): b, a = signal.butter(2, f, kind, fs=SR); return signal.lfilter(b, a, x)
def env(x, ms=30): w = int(SR * ms / 1000); return np.sqrt(np.convolve(x ** 2, np.ones(w) / w, 'same') + 1e-12)
def active_rms(x): e = env(x); m = e > e.max() * 0.1; return np.sqrt(np.mean(x[m] ** 2)) if m.any() else 1e-6
def trim(x, thr_db=-42):
    e = env(x, 10); idx = np.where(e > e.max() * 10 ** (thr_db / 20))[0]
    a, b = max(0, idx[0] - int(0.03 * SR)), min(len(x), idx[-1] + int(0.06 * SR)); return x[a:b]
def whisper_layer(x):
    # noise-excited copy: keep the spectral envelope (smoothed across frequency), drop the pitch harmonics
    f, t, Z = signal.stft(x, SR, nperseg=1024, noverlap=768)
    mag = np.abs(Z); k = np.ones(13) / 13
    sm = np.apply_along_axis(lambda c: np.convolve(c, k, 'same'), 0, mag)
    ph = np.exp(1j * rng.uniform(0, 2 * np.pi, Z.shape))
    y = signal.istft(sm * ph, SR, nperseg=1024, noverlap=768)[1][:len(x)]
    y = bfilt(bfilt(y, 280, 'high'), 9000, 'low'); return y / (active_rms(y) + 1e-9) * active_rms(x)
def comp(x, thr_db=-24, ratio=2.5):
    e = env(x, 15); thr = 10 ** (thr_db / 20); g = np.where(e > thr, (thr / e) ** (1 - 1 / ratio), 1.0); return x * g
def ir(t60=1.6, pre=0.025):
    n = int(t60 * SR); t = np.arange(n) / SR; r = rng.standard_normal(n) * np.exp(-6.91 * t / t60)
    r = bfilt(bfilt(r, 5500, 'low'), 200, 'high'); r = np.concatenate([np.zeros(int(pre * SR)), r]); return r / np.sqrt(np.sum(r ** 2))
IR = ir()
STYLE = {   # level dB, reverb wet, whisper mix, voiced mix, extra
    'normal': (0, 0.10, 0, 1), 'warm': (0.5, 0.08, 0, 1), 'dark': (-1, 0.14, 0, 1), 'low': (-2.5, 0.08, 0, 1),
    'strong': (2.0, 0.11, 0, 1), 'lowbreath': (-1.5, 0.13, 0.45, 0.8), 'nearwhisper': (-3, 0.07, 0.75, 0.5), 'whisper': (-4, 0.05, 1.0, 0.28),
}
TARGET = 10 ** (-20 / 20)
segs, t = [], LEAD
for L in lines:
    x, sr = sf.read(f"{P}/out/trim/{L['id']}.wav") if os.path.exists(f"{P}/out/trim/{L['id']}.wav") else sf.read(f"{P}/{man[L['id']]['file']}"); x = x if x.ndim == 1 else x.mean(1)
    x = signal.resample_poly(x, SR, sr); x = trim(x)
    lvl, wet, wmix, vmix = STYLE[L['post']]
    x = bfilt(x, 70, 'high'); x = shelf(x, 130, 2.0); x = peq(x, 320, -1.5, 1.0); x = peq(x, 3500, 1.5, 1.0)
    if L['post'] == 'warm': x = peq(x, 2200, 1.0, 0.8)
    if L['post'] == 'dark': x = bfilt(x, 6500, 'low')
    if wmix: x = vmix * x + wmix * whisper_layer(x)
    if L['post'] == 'strong': x = np.tanh(x / (active_rms(x) * 6)) * active_rms(x) * 6
    x = comp(x); x = x / active_rms(x) * TARGET * 10 ** (lvl / 20)
    y = np.convolve(x, IR)[:len(x) + int(1.2 * SR)]; x = np.concatenate([x, np.zeros(len(y) - len(x))]) + wet * y
    segs.append((t, x)); dur = (len(x) - int(1.2 * SR)) / SR
    L['start'], L['end'] = round(t, 3), round(t + dur, 3); t += dur + L['gap']
total = t + 7.0
out = np.zeros(int(total * SR) + SR)
for st, x in segs: i = int(st * SR); out[i:i + len(x)] += x
os.makedirs(f'{P}/out', exist_ok=True); sf.write(f'{P}/out/narration.wav', out.astype(np.float32), SR)
json.dump({'duration': round(total, 2), 'lines': [{k: L[k] for k in ('id', 'text', 'start', 'end', 'post')} for L in lines]},
          open(f'{P}/timeline.json', 'w'), ensure_ascii=False, indent=1)
print('narration', round(t, 1), 's; video', round(total, 1), 's; peak', round(float(np.abs(out).max()), 3))
