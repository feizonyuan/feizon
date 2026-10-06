#!/usr/bin/env bash
# Render stills at the given times and tile them 2x2 into out/sheet_N.png for review.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf out/stills out/sheet_*.png
node scripts/render.js --stills "$1" > /dev/null
mapfile -t F < <(ls out/stills/*.png | sort -t_ -k2 -n)
for ((k=0;k<${#F[@]};k+=4)); do
  a=${F[k]}; b=${F[k+1]:-$a}; c=${F[k+2]:-$a}; d=${F[k+3]:-$a}
  ffmpeg -y -loglevel error -i $a -i $b -i $c -i $d -filter_complex "[0]scale=960:540[a];[1]scale=960:540[b];[2]scale=960:540[c];[3]scale=960:540[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0" out/sheet_$((k/4)).png
done
ls out/sheet_*.png
