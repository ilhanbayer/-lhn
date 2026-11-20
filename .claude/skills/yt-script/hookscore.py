#!/usr/bin/env python3
"""hookscore.py - score a YouTube hook before you waste a take on it.

Five properties, 0-100 each, and a verdict that is 60% the mean and 40% the weakest one. The
weakest-link weighting is deliberate: a hook with four strong properties and one dead one is a hook
that leaks at the dead one, and averaging hides that.

    python3 hookscore.py hooks.txt            # one hook per line, ranked
    python3 hookscore.py --hook "one line"    # score a single hook
    python3 hookscore.py --json hooks.txt     # machine-readable

WHAT THIS CAN AND CANNOT TELL YOU. Measured against 74 real short-form hooks (first 15 seconds of
auto-captions, top-8 and bottom-8 by views across five channels): it separates deliberately bad
hooks from real ones well, and it separates a creator's own hits from their own misses barely at
all. Treat a low score as a reason to look again, never a high score as a promise.
"""
import json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
FORMULAS = json.load(open(os.path.join(HERE, "hooks.json")))["hooks"]

FILLER = {"basically","actually","literally","just","really","very","so","kind","sort","like",
          "guys","hey","welcome","today","video","subscribe","channel"}
VAGUE = {"amazing","incredible","insane","crazy","huge","massive","game","changer","secret",
         "powerful","ultimate","best","revolutionary","mind","blowing","unbelievable"}
CONCRETE = re.compile(r"\b(\d[\d,.]*\s?(%|k|m|x|s|m|h)?|\$\d|\d+\s?(second|minute|hour|day|week|month|year)s?)\b", re.I)
YOU = re.compile(r"\b(you|your|you're|youre|yourself)\b", re.I)
STAKE = re.compile(r"\b(lose|lost|wasting|waste|quit|fail|broke|cost|risk|before|stop|never|die|dying|dead)\b", re.I)
CURIOSITY = re.compile(r"\b(why|how|what|which|until|before|but|nobody|almost|except|reason|actually)\b", re.I)

# --- Turkish support (local addition): Turkish hooks are folded to ASCII (ş->s, ı->i, ğ->g, ç->c, ö->o, ü->u,
# â->a) so they tokenise, and get their own address/stakes/curiosity/filler lists. English scoring is unchanged.
def fold(t):
    t = t.replace("ı", "i").replace("İ", "I")
    return "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c)).lower()
TR_HINT = re.compile(r"[çğıöşüâîÇĞİÖŞÜÂÎ]|\b(ve|bir|bu|ama|icin|için|ile|gibi|da|de|mi|mu|ne|neden|nasil|nasıl|peki|sizce)\b", re.I)
def is_tr(t): return len(TR_HINT.findall(t)) >= 2
FILLER_TR = {"yani","aslinda","gercekten","sadece","cok","sey","iste","arkadaslar","merhaba","hosgeldiniz","bugun",
             "video","videoda","abone","kanal","kanalima","begen","begenmeyi","unutmayin"}
VAGUE_TR = {"inanilmaz","muhtesem","harika","cilgin","mutis","mukemmel","sok","devasa"}
CONCRETE_TR = re.compile(r"\b(iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|yirmi|otuz|kirk|elli|yuz|bin|milyon|"
                         r"birinci|ikinci|ucuncu|dorduncu|besinci)\b")
YOU_TR = re.compile(r"\b(sen|siz|sana|size|seni|sizi|senin|sizin|sizce|sence|kendin|kendiniz)\b"
                    r"|\b\w*(iniz|unuz|siniz|sunuz|diniz|dunuz|tiniz|tunuz)\w*"
                    r"|\b\w+(yin|yun)\b|\b(dusunun|bakin|dinleyin|izleyin|gorun|hayal edin)\b")
STAKE_TR = re.compile(r"\b(kaybet\w*|kayip\w*|kacir\w*|bedel\w*|asla|sakin|olum\w*|kanli|kani|kan|korku\w*|"
                      r"lanet\w*|tehlike\w*|yasak\w*|ceza\w*|bir daha|cesaret ede\w*|kaybol\w*)\b")
CURIOSITY_TR = re.compile(r"\b(neden|nicin|nasil|ne|hangi|kim|kimse\w*|ama|fakat|meger|aslinda|sir(ri|lari|li)?|"
                          r"gizem\w*|peki|acaba|yoksa|ta ki|hala|bilinmeyen|aciklanamayan|kayboldu\w*|yok)\b")
CLOSED_TR = re.compile(r"\b(cunku|bu yuzden|bu nedenle|demek ki)\b")

def words(t): return re.findall(r"[a-z0-9'%$.]+", fold(t))

def specificity(t):
    w = words(t)
    if not w: return 0
    tr = is_tr(t)
    nums = len(CONCRETE.findall(t)) + (len(CONCRETE_TR.findall(fold(t))) if tr else 0)
    vague = sum(1 for x in w if x in VAGUE or (tr and x in VAGUE_TR))
    filler = sum(1 for x in w if x in FILLER or (tr and x in FILLER_TR))
    s = 34 + nums * 22 - vague * 16 - filler * 5
    # proper nouns that are not sentence-initial read as named things
    s += min(18, 6 * sum(1 for x in t.split()[1:] if x[:1].isupper()))
    return max(0, min(100, s))

def address(t):
    tr = is_tr(t); head = " ".join(t.split()[:6])
    n = len(YOU.findall(t)) + (len(YOU_TR.findall(fold(t))) if tr else 0)
    first = 30 if (YOU.search(head) or (tr and YOU_TR.search(fold(head)))) else 0
    return max(0, min(100, 26 + n * 20 + first))

def stakes(t):
    tr = is_tr(t)
    n = len(STAKE.findall(t)) + (len(STAKE_TR.findall(fold(t))) if tr else 0)
    concrete = CONCRETE.search(t) or (tr and CONCRETE_TR.search(fold(t)))
    return max(0, min(100, 22 + n * 26 + (14 if concrete else 0)))

def curiosity(t):
    tr = is_tr(t)
    n = len(CURIOSITY.findall(t)) + (len(CURIOSITY_TR.findall(fold(t))) if tr else 0)
    q = 18 if t.strip().endswith("?") else 0
    # a hook that resolves itself has no gap left
    closed = -18 if (re.search(r"\b(because|so that|which means)\b", t, re.I) or (tr and CLOSED_TR.search(fold(t)))) else 0
    return max(0, min(100, 24 + n * 17 + q + closed))

def brevity(t):
    n = len(words(t))
    if n == 0: return 0
    # 9-24 words is the band a spoken hook lands in at ~150wpm inside 10 seconds
    if 9 <= n <= 24: return 100
    if n < 9:  return max(30, 100 - (9 - n) * 11)
    return max(10, 100 - (n - 24) * 7)

PROPS = [("SPECIFICITY", specificity), ("ADDRESS", address), ("STAKES", stakes),
         ("CURIOSITY", curiosity), ("BREVITY", brevity)]

def classify(t):
    best, hits = None, 0
    tr, ft = is_tr(t), fold(t)
    for f in FORMULAS:
        n = sum(1 for p in f["match"] if re.search(p, t, re.I))
        if tr: n += sum(1 for p in f.get("match_tr", []) if re.search(p, ft))
        if n > hits: best, hits = f, n
    return (best["name"] if best else "Unclassified"), hits

def score(t):
    parts = {n: fn(t) for n, fn in PROPS}
    vals = list(parts.values())
    verdict = round(0.6 * (sum(vals) / len(vals)) + 0.4 * min(vals))
    name, hits = classify(t)
    return parts, verdict, name, hits

def band(v): return "STRONG" if v >= 72 else "WORKABLE" if v >= 55 else "WEAK"

def report(t, parts, verdict, name, hits):
    print(f"\n  {t.strip()}")
    print(f"  {'-' * min(72, max(20, len(t.strip())))}")
    for k, v in parts.items():
        print(f"    {k:<12} {v:3d}  {'#' * (v // 5)}")
    print(f"    {'VERDICT':<12} {verdict:3d}  {band(verdict)}")
    print(f"    formula      {name}" + (f"  ({hits} pattern{'s' if hits != 1 else ''} matched)" if hits else "  (no formula matched - that is usually a summary, not a hook)"))
    low = min(parts, key=parts.get)
    print(f"    weakest      {low} - {(FIX_TR if is_tr(t) else FIX)[low]}")

FIX = {
 "SPECIFICITY": "swap one adjective for a number, a name or a date",
 "ADDRESS": "say 'you' in the first six words",
 "STAKES": "name what it costs them to keep doing it the current way",
 "CURIOSITY": "cut the half of the sentence that answers itself",
 "BREVITY": "9 to 24 words. Read it out loud and stop where you run out of breath",
}

FIX_TR = {
 "SPECIFICITY": "bir sıfatı bir sayı, isim ya da tarihle değiştir",
 "ADDRESS": "ilk altı kelimede izleyiciye seslen: 'siz', 'düşünün', 'sizce'",
 "STAKES": "bedeli söyle: ne kaybedilir, ne kaçırılır, neyin riski var",
 "CURIOSITY": "cümlenin kendini cevaplayan yarısını at; soruyu açık bırak",
 "BREVITY": "9-24 kelime. Sesli oku, nefesin bittiği yerde dur",
}

def main():
    a = sys.argv[1:]
    as_json = "--json" in a
    a = [x for x in a if x != "--json"]
    if "--hook" in a:
        lines = [a[a.index("--hook") + 1]]
    elif a and os.path.exists(a[0]):
        lines = [l for l in open(a[0]).read().splitlines() if l.strip()]
    else:
        print(__doc__); sys.exit(1 if not a else 0)
    out = []
    for t in lines:
        parts, verdict, name, hits = score(t)
        out.append({"hook": t.strip(), "properties": parts, "verdict": verdict,
                    "band": band(verdict), "formula": name, "matched": hits})
    out.sort(key=lambda r: -r["verdict"])
    if as_json:
        print(json.dumps([{k: v for k, v in r.items() if k != "matched"} for r in out], indent=1)); return
    for r in out:
        report(r["hook"], r["properties"], r["verdict"], r["formula"], r["matched"])
    if len(out) > 1:
        print(f"\n  winner: {out[0]['hook'].strip()}  ({out[0]['verdict']}, {out[0]['band']})\n")

if __name__ == "__main__":
    main()
