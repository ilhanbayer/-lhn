# Contact sheet: python3 scripts/sheet.py <dir> <out.jpg> [cols]
import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
fs = sorted(glob.glob(f'{d}/t*.jpg'), key=lambda f: float(os.path.basename(f)[1:-4]))
w, h = 640, 268; S = Image.new('RGB', (w * cols, h * ((len(fs) + cols - 1) // cols)), 'black'); D = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    im = Image.open(f).crop((0, 138, 1920, 942)).resize((w, h)); S.paste(im, ((i % cols) * w, (i // cols) * h))
    D.text(((i % cols) * w + 6, (i // cols) * h + 4), os.path.basename(f)[1:-4], fill=(255, 255, 0))
S.save(out, quality=85)
