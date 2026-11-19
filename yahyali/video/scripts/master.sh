#!/bin/bash
# Loudness-master the premix (YouTube: -14 LUFS, -2.5 dBTP) and mux it with the rendered picture.
# usage: scripts/master.sh audio/out/premix.wav out/video_noaudio.mp4 yahyali.mp4
set -e
IN=$1; VID=$2; OUT=$3; TMP=$(mktemp -d)
ffmpeg -hide_banner -y -loglevel error -i "$IN" -af "volume=4dB,alimiter=limit=0.75:attack=4:release=60:level=false" -ar 48000 $TMP/lim.wav
M=$(ffmpeg -hide_banner -nostats -i $TMP/lim.wav -af loudnorm=I=-14:TP=-2.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
ARGS=$(echo "$M" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
ffmpeg -hide_banner -y -loglevel error -i $TMP/lim.wav -af "loudnorm=I=-14:TP=-2.5:LRA=11:$ARGS:linear=true" -ar 48000 $TMP/master.wav
ffmpeg -hide_banner -y -loglevel error -i "$VID" -i $TMP/master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$OUT"
rm -rf $TMP
