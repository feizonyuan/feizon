#!/usr/bin/env bash
# Contact sheet of the rendered stills: out/sheet.png
cd "$(dirname "$0")/.."
ffmpeg -y -loglevel error -pattern_type glob -i 'out/stills/t_*.png' -vf "scale=270:480,tile=${1:-6}x${2:-2}:padding=6:color=white" -frames:v 1 out/sheet.png
