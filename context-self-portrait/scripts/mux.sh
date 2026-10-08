#!/usr/bin/env bash
# Combine picture and score into the final teaser.
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -y -loglevel error -i out/picture.mp4 -i out/score.wav -c:v copy -c:a aac -b:a 256k \
  -movflags +faststart -shortest final/context-teaser.mp4
echo final/context-teaser.mp4
