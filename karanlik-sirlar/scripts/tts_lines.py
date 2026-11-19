# Generates every narration line with Chatterbox Multilingual (MIT), checks it with Whisper and
# retries with another seed when the transcript drifts from the script. Writes lines/<id>.wav + manifest.json
import json, sys, os, time, re, subprocess, difflib, torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
P, OUT, REF = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(f'{OUT}/lines', exist_ok=True); torch.set_num_threads(4)
lines = json.load(open(f'{P}/narration.json'))
model = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
ASR = '/tmp/claude-0/-home-user--lhn/c040e163-37bd-54fb-bc70-aaa2423d6eef/scratchpad/work/asr/sherpa-onnx-whisper-small'
def asr(path):
    code = f'''
import sherpa_onnx, soundfile as sf, numpy as np, scipy.signal as ss
r=sherpa_onnx.OfflineRecognizer.from_whisper(encoder="{ASR}/small-encoder.int8.onnx",decoder="{ASR}/small-decoder.int8.onnx",tokens="{ASR}/small-tokens.txt",language="tr",task="transcribe",num_threads=2)
x,sr=sf.read("{path}"); x=x if x.ndim==1 else x.mean(1); x=ss.resample_poly(x,16000,sr)
s=r.create_stream(); s.accept_waveform(16000,x.astype(np.float32)); r.decode_stream(s); print(s.result.text)'''
    o = subprocess.run(['python3', '-c', code], capture_output=True, text=True).stdout.strip().splitlines()
    return o[-1] if o else ''
norm = lambda s: re.sub(r'[^a-zçğıöşüâî ]', '', s.lower().replace('â', 'a').replace('î', 'i').replace("'", '')).split()
man = {}
if os.path.exists(f'{OUT}/manifest.json'): man = json.load(open(f'{OUT}/manifest.json'))
for L in lines:
    if L['id'] in man and man[L['id']].get('ok'): continue
    best = None
    for k, seed in enumerate([11, 23, 37, 51]):
        torch.manual_seed(seed); t0 = time.time()
        wav = model.generate(L['text'], language_id='tr', audio_prompt_path=REF, exaggeration=L['exag'], cfg_weight=L['cfg'], temperature=0.8)
        path = f"{OUT}/lines/{L['id']}_s{seed}.wav"; ta.save(path, wav, model.sr)
        hyp = asr(path); sim = difflib.SequenceMatcher(None, ' '.join(norm(L['text'])), ' '.join(norm(hyp))).ratio()
        dur = wav.shape[-1] / model.sr
        print(f"{L['id']} seed {seed}: {dur:4.1f}s sim {sim:.2f} ({time.time()-t0:.0f}s) | {hyp}", flush=True)
        if best is None or sim > best[1]: best = (path, sim, dur, hyp, seed)
        if sim >= 0.86: break
    man[L['id']] = {'file': best[0], 'sim': round(best[1], 3), 'dur': round(best[2], 3), 'asr': best[3], 'seed': best[4], 'ok': best[1] >= 0.7}
    json.dump(man, open(f'{OUT}/manifest.json', 'w'), ensure_ascii=False, indent=1)
print('DONE', sum(1 for v in man.values() if v['ok']), '/', len(lines))
