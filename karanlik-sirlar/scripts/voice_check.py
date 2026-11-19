# Objective checks for synthesized narration: Whisper transcript, median F0, pauses.
import sys, numpy as np, soundfile as sf, librosa, subprocess, json
def asr(path):
    out = subprocess.run(['python3', '-c', f'''
import sherpa_onnx, soundfile as sf, numpy as np
M="/tmp/claude-0/-home-user--lhn/c040e163-37bd-54fb-bc70-aaa2423d6eef/scratchpad/work/asr/sherpa-onnx-whisper-small"
r=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=M+"/small-encoder.int8.onnx",decoder=M+"/small-decoder.int8.onnx",tokens=M+"/small-tokens.txt",language="tr",task="transcribe",num_threads=4)
x,sr=sf.read("{path}"); x=x if x.ndim==1 else x.mean(1)
import scipy.signal as ss; x=ss.resample_poly(x,16000,sr) if sr!=16000 else x
s=r.create_stream(); s.accept_waveform(16000,x.astype(np.float32)); r.decode_stream(s); print(s.result.text)'''], capture_output=True, text=True)
    return out.stdout.strip().splitlines()[-1] if out.stdout.strip() else out.stderr[-200:]
for p in sys.argv[1:]:
    y, sr = librosa.load(p, sr=22050, mono=True)
    f0, vf, _ = librosa.pyin(y, fmin=60, fmax=300, sr=sr, frame_length=1024)
    f0 = f0[~np.isnan(f0)]
    print(f"{p.split('/')[-1]:14} dur {len(y)/sr:5.2f}s  F0 median {np.median(f0):5.1f} Hz  p10-p90 {np.percentile(f0,10):5.1f}-{np.percentile(f0,90):5.1f}")
    print('   ASR:', asr(p))
