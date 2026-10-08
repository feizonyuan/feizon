#!/usr/bin/env bash
# Combine picture and score into the final film.
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -y -loglevel error -i out/picture.mp4 -i out/score.wav -c:v libx264 -preset slow -b:v 2650k -pass 1 -passlogfile out/p -an -f null /dev/null
ffmpeg -y -loglevel error -i out/picture.mp4 -i out/score.wav -c:v libx264 -preset slow -b:v 2650k -pass 2 -passlogfile out/p \
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest final/context.mp4
echo final/context.mp4
