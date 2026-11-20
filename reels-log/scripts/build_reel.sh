#!/bin/bash
# Builds the Instagram Reel: speed-ramped, graded drone shot + quote layer + mastered music (1080x1920, 30 fps, 15 s).
# Needs: in/source.mp4, work/grade_v2.cube, work/plate.png, work/text/t%05d.png, work/music.wav, work/select.txt
set -e
cd "$(dirname "$0")/.."
TEXT=${1:-work/text}; OUTF=${2:-out/reel.mp4}
mkdir -p out
# music -> -14 LUFS, true peak under -1.5 dBTP (two passes: gain, then a lookahead limiter)
measure() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}'; }
I0=$(measure work/music.wav); G=$(python3 -c "print(round(-14.0 - ($I0), 2))")
for pass in 1 2; do
  ffmpeg -hide_banner -y -loglevel error -i work/music.wav -af "volume=${G}dB,alimiter=limit=0.8:attack=4:release=80:level=false:latency=1" -c:a pcm_s24le work/music_master.wav
  I=$(measure work/music_master.wav); G=$(python3 -c "print(round($G + (-14.0 - ($I)), 2))")
done
SEL=$(cat work/select.txt)
ffmpeg -hide_banner -y -loglevel error -i in/source.mp4 -loop 1 -i work/plate.png -framerate 30 -i $TEXT/t%05d.png -i work/music_master.wav \
  -filter_complex "[0:v:0]select='${SEL}',setpts=N/30/TB,scale=1080:1920:flags=lanczos,format=rgb48le,lut3d=file=work/grade_v2.cube:interp=tetrahedral,format=rgb24[g];\
[g][1:v]overlay=0:0:shortest=1,vignette=angle=0.5,unsharp=5:5:0.5:5:5:0.0,noise=alls=2:allf=t[b];[b][2:v]overlay=0:0:format=auto,format=yuv420p,setsar=1[v]" \
  -map "[v]" -map 3:a -c:v libx264 -preset slow -crf 17 -maxrate 14M -bufsize 28M -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 320k -ar 48000 -t 15 -movflags +faststart $OUTF
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact $OUTF
ffmpeg -hide_banner -nostats -i $OUTF -map 0:a -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' '
