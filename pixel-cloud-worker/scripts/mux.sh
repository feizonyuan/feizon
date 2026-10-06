#!/usr/bin/env bash
# Concatenate rendered segments, master the audio and mux the final film.
set -euo pipefail
cd "$(dirname "$0")/.."
ls out/seg*.mp4 | sort -V | sed "s#^#file '$PWD/#; s#\$#'#" > out/segments.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/segments.txt -c copy out/video.mp4
mkdir -p final
ffmpeg -y -loglevel error -i out/video.mp4 -i out/mix.wav \
  -af "equalizer=f=6000:t=q:w=1.2:g=-2,loudnorm=I=-14:TP=-1.5:LRA=9" -ar 48000 \
  -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart final/cloud-shift.mp4
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of compact final/cloud-shift.mp4
