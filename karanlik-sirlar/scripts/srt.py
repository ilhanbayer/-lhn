# Turkish subtitles from timeline.json: one cue per narration line, two balanced rows when a line is long.
import json, os
P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = json.load(open(f'{P}/timeline.json'))['lines']
def ts(t): h, r = divmod(t, 3600); m, s = divmod(r, 60); return f'{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'.replace(',1000', ',999')
def rows(text, maxc=42):
    if len(text) <= maxc: return text
    words = text.split(); best = None
    for i in range(1, len(words)):
        a, b = ' '.join(words[:i]), ' '.join(words[i:]); score = max(len(a), len(b))
        if best is None or score < best[0]: best = (score, a + '\n' + b)
    return best[1]
out = []
for k, L in enumerate(lines):
    start = L['start']; end = max(L['end'] + 0.35, start + 1.0)
    if k + 1 < len(lines): end = min(end, lines[k + 1]['start'] - 0.06)
    out.append(f"{k + 1}\n{ts(start)} --> {ts(end)}\n{rows(L['text'])}\n")
open(f'{P}/out/yahyalinin-karanlik-sirlari.srt', 'w', encoding='utf-8').write('\n'.join(out))
print(len(out), 'cues')
