#!/usr/bin/env bash
# Concatenate rendered segments, master the audio and mux the final films:
#   final/cloud-shift-4k.mp4  3840x2160 master (segments rendered with --scale 2)
#   final/cloud-shift.mp4     1920x1080, Lanczos-downsampled from the master
set -euo pipefail
cd "$(dirname "$0")/.."
ls out/seg*.mp4 | sort -V | sed "s#^#file '$PWD/#; s#\$#'#" > out/segments.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/segments.txt -c copy out/video.mp4
ffmpeg -y -loglevel error -i out/mix.wav \
  -af "equalizer=f=6000:t=q:w=1.2:g=-2,loudnorm=I=-14:TP=-1.5:LRA=9" -ar 48000 -c:a aac -b:a 256k out/audio.m4a
mkdir -p final
W=$(ffprobe -v error -select_streams v -show_entries stream=width -of csv=p=0 out/video.mp4)
if [ "$W" -gt 1920 ]; then
  ffmpeg -y -loglevel error -i out/video.mp4 -i out/audio.m4a -map 0:v -map 1:a -c copy -shortest -movflags +faststart final/cloud-shift-4k.mp4
  ffmpeg -y -loglevel error -i out/video.mp4 -i out/audio.m4a -map 0:v -map 1:a \
    -vf "scale=1920:1080:flags=lanczos" -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p \
    -c:a copy -shortest -movflags +faststart final/cloud-shift.mp4
else
  ffmpeg -y -loglevel error -i out/video.mp4 -i out/audio.m4a -map 0:v -map 1:a -c copy -shortest -movflags +faststart final/cloud-shift.mp4
fi
for f in final/*.mp4; do
  echo "$f"; ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_name,width,height,r_frame_rate -of compact "$f"
done
