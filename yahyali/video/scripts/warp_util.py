import json, numpy as np
from scipy.interpolate import PchipInterpolator
def load(path):
    w = json.load(open(path)); a = np.array(w['anchors'])
    f = PchipInterpolator(a[:, 0], a[:, 1])                       # new time -> old (designed) time, smooth & monotone
    tn = np.linspace(0, w['duration'], 400001); to = f(tn)
    g = lambda t: float(np.interp(t, to, tn))                      # old -> new
    return w, f, g
