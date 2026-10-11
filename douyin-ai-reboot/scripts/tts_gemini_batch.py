"""Voice-over in ONE Gemini TTS request (consistent voice, uses 1 of the free tier's 10 daily requests),
split on the longest pauses, then every piece is verified by transcription.
  GEMINI_KEY_FILE=/path/to/key python3 scripts/tts_gemini_batch.py [--regen]
The API key is read from GEMINI_KEY_FILE and is never stored in the repo."""
import base64, difflib, json, os, re, subprocess, sys
sys.argv, _args = sys.argv[:1], sys.argv[1:]   # tts_gemini parses argv as line ids; keep it empty
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("tg", os.path.join(os.path.dirname(os.path.abspath(__file__)), "tts_gemini.py"))
tg = importlib.util.module_from_spec(spec)
tg.main = None
src = open(spec.origin).read().replace("\nmain()\n", "\n")
exec(compile(src, spec.origin, "exec"), tg.__dict__)

MODEL = os.environ.get("TTS_MODEL", "gemini-3.8-flash-lite-tts")
ROOT = tg.ROOT
lines = json.load(open(os.path.join(ROOT, "script.json")))
full = os.path.join(ROOT, "audio", "full_take.wav")

PROMPT = """Read the numbered lines below aloud in Mandarin Chinese (standard Putonghua), word for word, in order, each exactly once.
Do NOT read the numbers. Do not add any words before, between or after the lines. Say "AI" as the English letters A-I.
Leave a clear silent pause of about 1.5 seconds between consecutive lines.
Voice direction: a professional male narrator for a financial / knowledge documentary short.
Calm, confident and authoritative, warm but not salesy; crisp articulation; brisk pace suited to a 60-second
vertical video; slight emphasis on the key phrase of each line; no exaggerated emotion.

"""

if not os.path.exists(full) or "--regen" in _args:
    text = PROMPT + "\n".join(f"{i + 1}. {ln['zh']}" for i, ln in enumerate(lines))
    body = {"contents": [{"parts": [{"text": text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": tg.VOICE}}}}}
    part = tg.call(MODEL, body, tries=3)["candidates"][0]["content"]["parts"][0]["inlineData"]
    mime = part.get("mimeType", "")
    raw = full + ".raw"
    open(raw, "wb").write(base64.b64decode(part["data"]))
    rate = 24000
    for kv in mime.split(";"):
        if kv.strip().startswith("rate="): rate = int(kv.split("=")[1])
    fmt = [] if "wav" in mime else ["-f", "s16le", "-ar", str(rate), "-ac", "1"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *fmt, "-i", raw, "-ar", "48000", "-ac", "1", full], check=True)
    os.remove(raw)
    print("generated", mime, round(tg.duration(full), 2), "s")

# split on the longest pauses
out = subprocess.run(["ffmpeg", "-i", full, "-af", "silencedetect=n=-42dB:d=0.3", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
total = tg.duration(full)
gaps = [(e - s, s, e) for s, e in zip(starts, ends) if s > 0.2 and e < total - 0.2]
need = len(lines) - 1
print("gaps:", [(round(g, 2), round(s, 2)) for g, s, e in sorted(gaps, key=lambda x: x[1])])
if len(gaps) < need:
    sys.exit(f"only {len(gaps)} pauses found, need {need}")
cuts = sorted(sorted(gaps, reverse=True)[:need], key=lambda x: x[1])
bounds = [0.0] + [(s + e) / 2 for _, s, e in cuts] + [total]
trim = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
        "silenceremove=start_periods=1:start_threshold=-45dB,areverse")
durs, bad = {}, []
for i, ln in enumerate(lines):
    wav = os.path.join(ROOT, "audio", ln["id"] + ".wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", full, "-ss", f"{bounds[i]:.3f}", "-to", f"{bounds[i + 1]:.3f}",
                    "-af", trim, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav], check=True)
    heard = tg.transcribe(wav)
    sim = difflib.SequenceMatcher(None, tg.norm(heard), tg.norm(ln["zh"])).ratio()
    d = tg.duration(wav)
    ok = sim >= 0.8
    if not ok: bad.append(ln["id"])
    durs[ln["id"]] = {"dur": round(d, 3), "ok": ok, "heard": heard}
    print(f'{ln["id"]} {d:.2f}s sim={sim:.2f} {"OK " if ok else "BAD"} {heard}', flush=True)
json.dump(durs, open(os.path.join(ROOT, "audio", "durations.json"), "w"), ensure_ascii=False, indent=1)
print("total", round(sum(v["dur"] for v in durs.values()), 2), "bad:", bad)
