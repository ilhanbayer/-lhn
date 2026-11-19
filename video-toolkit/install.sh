#!/bin/bash
# Video araç takımını kurar: npm ve pip paketleri, Rhubarb Lip Sync ikili dosyası ve referans depolar (vendor/).
# Kullanım: video-toolkit/install.sh [--no-vendor]
set -e
cd "$(dirname "$0")"
mkdir -p vendor
echo "== npm paketleri"; npm install --no-audit --no-fund --silent
echo "== pip paketleri (vendor/venv, sistem paketlerini bozmamak için ayrı ortam)"
[ -x vendor/venv/bin/python ] || python3 -m venv --system-site-packages vendor/venv
vendor/venv/bin/pip install -q -r requirements.txt
mkdir -p vendor
RHUBARB=1.14.0
if [ ! -x vendor/rhubarb/rhubarb ]; then
  echo "== Rhubarb Lip Sync $RHUBARB"
  curl -sSL -o vendor/rhubarb.zip "https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v$RHUBARB/Rhubarb-Lip-Sync-$RHUBARB-Linux.zip"
  python3 -c "import zipfile; zipfile.ZipFile('vendor/rhubarb.zip').extractall('vendor/rhubarb_tmp')"
  rm -rf vendor/rhubarb && mv vendor/rhubarb_tmp/Rhubarb-Lip-Sync-$RHUBARB-Linux vendor/rhubarb && rm -rf vendor/rhubarb_tmp vendor/rhubarb.zip
  chmod +x vendor/rhubarb/rhubarb
fi
if [ "$1" != "--no-vendor" ]; then
  echo "== referans depolar (vendor/)"
  if [ ! -d vendor/noto-emoji/2D/svg ]; then
    echo "== Noto emoji SVG (yalnızca 2D/svg, ~48 MB)"
    git clone -q --depth 1 --filter=blob:none --sparse https://github.com/googlefonts/noto-emoji vendor/noto-emoji
    git -C vendor/noto-emoji sparse-checkout set 2D/svg
  fi
  for r in harry0703/MoneyPrinterTurbo RayVentura/ShortGPT nicolaigaina/ai-video-captions unconv/captacity diffusionstudio/lottie romainsimon/uisfx wyzowl/sfx-kit; do
    d=vendor/$(basename $r); [ -d "$d" ] || GIT_LFS_SKIP_SMUDGE=1 git clone -q --depth 1 "https://github.com/$r" "$d"
  done
fi
echo "Kurulum tamam. Python: video-toolkit/vendor/venv/bin/python  Rhubarb: video-toolkit/vendor/rhubarb/rhubarb"
