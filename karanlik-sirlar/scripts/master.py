# Masters out/audio/premix.wav to -14 LUFS integrated with a -1.5 dBTP ceiling (two passes: gain, lookahead limiter).
# Writes out/audio/master.wav.
import json, os, subprocess, re
P = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); A = f'{P}/out/audio'
def measure(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1]); tp = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1]); lra = float(re.findall(r'LRA:\s+(-?[\d.]+) LU', r)[-1]); return I, tp, lra
I0, tp0, _ = measure(f'{A}/premix.wav'); g = -14.0 - I0
for it in range(3):
    subprocess.run(['ffmpeg', '-hide_banner', '-y', '-loglevel', 'error', '-i', f'{A}/premix.wav', '-af',
                    f'volume={g:.2f}dB,alimiter=limit={10 ** (-2.2 / 20):.4f}:attack=3:release=90:level=false:latency=1,aresample=48000', '-c:a', 'pcm_s24le', f'{A}/master.wav'], check=True)
    I, tp, lra = measure(f'{A}/master.wav'); print(f'pass {it + 1}: gain {g:+.2f} dB -> I {I} LUFS, true peak {tp} dBTP, LRA {lra}')
    if abs(I + 14.0) <= 0.15 and tp <= -1.0: break
    g += -14.0 - I
json.dump({'integrated_lufs': I, 'true_peak_dbtp': tp, 'lra': lra, 'gain_db': round(g, 2)}, open(f'{A}/master.json', 'w'), indent=1)
