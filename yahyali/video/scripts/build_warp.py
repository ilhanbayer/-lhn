# Aligns the provided narration to the designed timeline: finds speech onsets, inserts two short pauses,
# builds a smooth monotone time-warp (new -> old) and writes warp.json + the edited voice track.
import numpy as np, soundfile as sf, json, sys
sys.path.insert(0, __file__.rsplit('/', 1)[0]); import warp_util
import os; W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
x, sr = sf.read(f'{W}/voice2/ses44.wav')
approx = [0.0, 3.35, 6.95, 9.97, 11.34, 15.99, 19.79, 22.52, 28.55, 33.66, 36.53, 38.52, 40.01, 43.87, 47.08, 47.79, 48.47, 49.57]
def refine(a):
    s0 = max(0, a - 0.2); seg = x[int(s0 * sr):int((a + 0.7) * sr)]; w = int(0.005 * sr)
    rms = np.sqrt(np.convolve(seg ** 2, np.ones(w) / w, 'same')); return s0 + int(np.argmax(rms > 0.08 * rms.max())) / sr
on = [refine(a) for a in approx]
gaps = [(11.0, 1.3), (36.25, 0.6)]                     # (cut point in the recording, seconds of pause inserted)
f2e = lambda t: t + sum(g for c, g in gaps if t >= c)
O = 1.448 - on[0]
new_on = [round(O + f2e(t), 4) for t in on]
old_on = [1.448, 4.237, 8.305, 12.25, 15.242, 18.728, 21.938, 26.075, 31.262, 35.00, 39.6, 41.951, 42.96, 45.748, 48.85, 49.882, 50.864, 52.4]
end_new = new_on[-1] + (60.0 - old_on[-1])
anchors = [[0.0, 0.0]] + [[n, o] for n, o in zip(new_on, old_on)] + [[round(end_new, 4), 60.0]]
# edited voice: insert silence at the cut points (10 ms fades) and resample to 48 kHz
pieces, prev = [], 0
for c, g in gaps:
    i = int(c * sr); a = x[prev:i].copy(); fl = int(0.01 * sr); a[-fl:] *= np.linspace(1, 0, fl); pieces += [a, np.zeros(int(g * sr))]; prev = i
b = x[prev:].copy(); fl = int(0.01 * sr); b[:fl] *= np.linspace(0, 1, fl); pieces.append(b)
from scipy import signal
v = signal.resample_poly(np.concatenate(pieces), 160, 147)
sf.write(f'{W}/voice2/voice_edit48.wav', v.astype(np.float32), 48000)
fps = 30; nfr = int(np.ceil(end_new * fps))
json.dump({'duration': round(end_new, 4), 'fps': fps, 'voiceOffset': round(O, 4), 'gaps': gaps, 'onsets_file': [round(t, 3) for t in on],
           'anchors': anchors}, open(f'{W}/warp.json', 'w'), indent=1)
w, f, g = warp_util.load(f'{W}/warp.json')
w['frames_old'] = [round(float(f(k / fps)), 5) for k in range(nfr)]
json.dump(w, open(f'{W}/warp.json', 'w'))
print('voice offset', round(O, 3), 'duration', round(end_new, 2), 'frames', nfr)
for (n0, o0), (n1, o1) in zip(anchors[:-1], anchors[1:]):
    print(f'new {n0:6.2f}-{n1:6.2f}  old {o0:6.2f}-{o1:6.2f}  speed x{(o1 - o0) / (n1 - n0):.2f}')
