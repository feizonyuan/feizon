#!/usr/bin/env bash
# Concatenate rendered segments, master the audio and mux the final films.
#   final/reboot-at-20.mp4           1080x1920 60fps, voice + music + SFX
#   final/reboot-at-20-novoice.mp4   same picture, music + SFX only (for re-voicing)
#   final/subtitles.srt              subtitle file (CapCut / 剪映 import)
set -euo pipefail
cd "$(dirname "$0")/.."
ls out/seg*.mp4 | sort -V | sed "s#^#file '$PWD/#; s#\$#'#" > out/segments.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/segments.txt -c copy out/video.mp4
for name in mix mix_novoice; do
  ffmpeg -y -loglevel error -i out/$name.wav \
    -af "highpass=f=60,equalizer=f=3000:t=q:w=1.0:g=1.5,loudnorm=I=-14:TP=-1.5:LRA=9" -ar 48000 -c:a aac -b:a 256k out/$name.m4a
done
mkdir -p final
ffmpeg -y -loglevel error -i out/video.mp4 -i out/mix.m4a -map 0:v -map 1:a -c copy -shortest -movflags +faststart final/reboot-at-20.mp4
ffmpeg -y -loglevel error -i out/video.mp4 -i out/mix_novoice.m4a -map 0:v -map 1:a -c copy -shortest -movflags +faststart final/reboot-at-20-novoice.mp4
node -e '
const tl = require("./timeline.json"), all = tl.scenes.flatMap(s => s.lines);
const ts = x => { const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
const out = all.map((l, i) => `${i + 1}\n${ts(l.at)} --> ${ts(Math.min(l.at + l.dur + 0.25, all[i + 1] ? all[i + 1].at - 0.04 : tl.duration))}\n${l.zh}\n`).join("\n");
require("fs").writeFileSync("final/subtitles.srt", out);'
for f in final/*.mp4; do
  echo "$f"; ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_name,width,height,r_frame_rate -of compact "$f"
done
