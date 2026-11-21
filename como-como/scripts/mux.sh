#!/usr/bin/env bash
# Join rendered segments and add the mixed soundtrack -> final/como-como.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
ls out/seg*.mp4 | sort -V | sed "s|^out/|file '|; s|$|'|" > out/segs.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/segs.txt -c copy out/video.mp4
ffmpeg -y -loglevel error -i out/video.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart final/como-como.mp4
ffprobe -v error -show_entries format=duration,size -of default=nw=1 final/como-como.mp4
