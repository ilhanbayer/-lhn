# Speed ramp for the reel: 2.35x at the start, easing to real time (1x) between 4 s and 10 s of output.
# Writes work/select.txt (an ffmpeg select expression) and work/ramp.json (source frame per output frame).
import json, os, numpy as np
W = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'work'); os.makedirs(W, exist_ok=True)
fps_out, D, src_fps = 30, 15.0, 60000 / 1001
ss = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
t = np.arange(int(D * fps_out)) / fps_out
fine = np.linspace(0, D, 150001); speed = 1 + 1.35 * (1 - ss(4, 10, fine))
s_fine = np.concatenate([[0], np.cumsum((speed[1:] + speed[:-1]) / 2 * np.diff(fine))])
idx = np.round(np.interp(t, fine, s_fine) * src_fps).astype(int); assert np.all(np.diff(idx) > 0)
open(f'{W}/select.txt', 'w').write('+'.join(f'eq(n\\,{i})' for i in idx)); json.dump({'idx': idx.tolist()}, open(f'{W}/ramp.json', 'w'))
print('frames', len(idx), 'source', round(idx[-1] / src_fps, 2), 's')
