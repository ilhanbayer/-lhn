#!/bin/bash
# Joins the rendered frames, the mastered audio and the Turkish subtitles into the delivery MP4.
set -e
cd "$(dirname "$0")/.."
ffmpeg -hide_banner -y -loglevel error -framerate 30 -i out/frames/f%05d.jpg -i out/audio/master.wav -i out/yahyalinin-karanlik-sirlari.srt \
  -map 0:v -map 1:a -map 2:s -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -r 30 \
  -c:a aac -b:a 256k -ar 48000 -c:s mov_text -metadata:s:s:0 language=tur -metadata:s:a:0 language=tur \
  -metadata title="Yahyalı'nın Karanlık Sırları: Kanlı Ardıç" -movflags +faststart -shortest out/yahyalinin-karanlik-sirlari.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact out/yahyalinin-karanlik-sirlari.mp4
