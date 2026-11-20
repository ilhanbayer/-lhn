# Cuts trailing breaths/murmurs from narration takes: tries each pause as a cut point (earliest first) and keeps
# the first one where Whisper still hears the whole scripted line. Writes out/trim/<id>.wav and out/trim/trim.json.
import json, os, re, sys, difflib, numpy as np, soundfile as sf, sherpa_onnx
from scipy import signal
P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASR = sys.argv[1]
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{ASR}/small-encoder.int8.onnx', decoder=f'{ASR}/small-decoder.int8.onnx',
                                               tokens=f'{ASR}/small-tokens.txt', language='tr', task='transcribe', num_threads=4)
norm = lambda s: ' '.join(re.sub(r'[^a-zçğıöşüâî0-9 ]', '', s.lower().replace('â', 'a').replace('î', 'i').replace("'", '').replace('3.', 'üçüncü')).split())
def hear(x, sr):
    y = signal.resample_poly(x, 16000, sr).astype(np.float32)
    s = rec.create_stream(); s.accept_waveform(16000, y); rec.decode_stream(s); return s.result.text.strip()
lines = json.load(open(f'{P}/narration.json')); man = json.load(open(f'{P}/voice/manifest.json'))
os.makedirs(f'{P}/out/trim', exist_ok=True); res = {}
for L in lines:
    x, sr = sf.read(f"{P}/{man[L['id']]['file']}"); x = x if x.ndim == 1 else x.mean(1)
    w = int(sr * 0.01); e = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, 'same')); quiet = e < e.max() * 10 ** (-46 / 20)
    cuts, run = [], 0
    for i, q in enumerate(quiet):
        run = run + 1 if q else 0
        if run == int(0.15 * sr / 1) // 1 and i / sr > 0.25: cuts.append((i - run) / sr)   # start of a >=150 ms pause
    cuts = sorted(set(round(min(len(x) / sr, c + 0.12), 3) for c in cuts if c > 0.2)) + [len(x) / sr]
    target = norm(L['text']); full = difflib.SequenceMatcher(None, target, norm(hear(x, sr))).ratio()
    chosen, heard = len(x) / sr, ''
    for c in cuts:
        h = hear(x[:int(c * sr)], sr); sim = difflib.SequenceMatcher(None, target, norm(h)).ratio()
        lastw = target.split()[-1]; hw = norm(h).split()
        ends = bool(hw) and difflib.SequenceMatcher(None, lastw, hw[-1]).ratio() >= 0.7
        if sim >= max(0.8, full - 0.01) and ends: chosen, heard = c, h; break
    y = x[:int(chosen * sr)]; fade = int(0.04 * sr); y[-fade:] *= np.linspace(1, 0, fade)
    sf.write(f"{P}/out/trim/{L['id']}.wav", y, sr)
    res[L['id']] = {'orig': round(len(x) / sr, 2), 'cut': round(chosen, 2), 'heard': heard, 'full_sim': round(full, 2)}
    print(f"{L['id']} {len(x)/sr:5.2f} -> {chosen:5.2f}  {heard}", flush=True)
json.dump(res, open(f'{P}/out/trim/trim.json', 'w'), ensure_ascii=False, indent=1)
