"""Offline Mandarin voice-over with zhtts (FastSpeech2 + MB-MelGAN, Baker voice).
Run with a Python 3.11 venv that has: tensorflow-cpu==2.15.1 "numpy<2" zhtts.
Writes audio/lXX.wav (48 kHz mono, trimmed) and audio/durations.json."""
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile
import zhtts
from zhtts.tts import split_sens

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEED = float(os.environ.get("TTS_SPEED", "0.84"))   # duration multiplier (<1 = faster)
PITCH = float(os.environ.get("TTS_F0", "1.04"))
PAUSE = 0.12                                          # seconds between comma phrases

class FastTTS(zhtts.TTS):
    def prepare_input(self, input_ids):
        ids = np.expand_dims(np.array(input_ids, np.int32), 0)
        return (ids, np.array([0], np.int32), np.array([SPEED], np.float32),
                np.array([PITCH], np.float32), np.array([1.0], np.float32))

def main():
    lines = json.load(open(os.path.join(ROOT, "script.json")))
    only = set(sys.argv[1:])
    tts = FastTTS()
    out = os.path.join(ROOT, "audio")
    durs_path = os.path.join(out, "durations.json")
    durs = json.load(open(durs_path)) if os.path.exists(durs_path) else {}
    for l in lines:
        if only and l["id"] not in only:
            continue
        parts = []
        for s in split_sens(l["tts"]):
            print(l["id"], tts.frontend(s))
            a = tts.mel2audio(tts.text2mel(s))
            parts += [a, np.zeros(int(PAUSE * 24000), np.float32)]
        audio = np.concatenate(parts[:-1])
        raw = os.path.join(out, l["id"] + ".raw.wav")
        wavfile.write(raw, 24000, audio.astype(np.float32))
        wav = os.path.join(out, l["id"] + ".wav")
        trim = ("silenceremove=start_periods=1:start_threshold=-48dB,areverse,"
                "silenceremove=start_periods=1:start_threshold=-48dB,areverse")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", trim,
                        "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav], check=True)
        os.remove(raw)
        d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                  "-of", "csv=p=0", wav], capture_output=True, text=True).stdout)
        durs[l["id"]] = {"dur": round(d, 3)}
        print(l["id"], f"{d:.2f}s")
    json.dump(durs, open(durs_path, "w"), ensure_ascii=False, indent=1)
    print("total", round(sum(v["dur"] for v in durs.values()), 2))

main()
