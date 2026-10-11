"""Cut lines l01-l10 out of audio/full_take.wav at hand-measured pauses and re-verify them.
The batch take (scripts/tts_gemini_batch.py) began by reading the prompt's instructions aloud, so the
narration only starts at 38.19 s and the automatic longest-pause split was off by four; l11-l15 were fine.
  GEMINI_KEY_FILE=/path/to/key python3 scripts/resplit_take.py"""
import json, os, subprocess, sys, difflib
sys.argv = sys.argv[:1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
src = open('scripts/tts_gemini.py').read().replace("\nmain()\n", "\n")
g = {"__file__": os.path.join(ROOT, 'scripts/tts_gemini.py')}; exec(src, g)
lines = {l['id']: l for l in json.load(open('script.json'))}
B = [38.19, 42.70, 48.55, 50.93, 55.31, 58.54, 61.41, 66.72, 69.43, 73.40, 75.35]
trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
durs = json.load(open('audio/durations.json'))
for i in range(10):
    lid = f"l{i+1:02d}"; wav = f"audio/{lid}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "audio/full_take.wav", "-ss", f"{B[i]:.3f}", "-to", f"{B[i+1]:.3f}",
                    "-af", trim, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav], check=True)
    heard = g['transcribe'](wav)
    sim = difflib.SequenceMatcher(None, g['norm'](heard), g['norm'](lines[lid]['zh'])).ratio()
    durs[lid] = {"dur": round(g['duration'](wav), 3), "ok": sim >= 0.8, "heard": heard}
    print(lid, durs[lid]['dur'], round(sim, 2), heard, flush=True)
json.dump(durs, open('audio/durations.json', 'w'), ensure_ascii=False, indent=1)
print('total', round(sum(v['dur'] for v in durs.values()), 2))
