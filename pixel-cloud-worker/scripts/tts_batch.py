"""Generate all voice-over lines in ONE Gemini TTS request (consistent voice, minimal quota),
split on the longest pauses, and verify with a single transcription call.
The API key is read from GEMINI_KEY_FILE and is never stored in the repo."""
import difflib, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts

tts.TTS_MODEL = os.environ.get("TTS_MODEL", "gemini-3.8-flash-lite-tts")
ROOT = tts.ROOT
lines = json.load(open(os.path.join(ROOT, "script.json")))
full = os.path.join(ROOT, "audio", "full_take.wav")

PROMPT = """Read the numbered lines below aloud in Mandarin Chinese, word for word, in order.
Do NOT read the numbers. Do not add any words before, between or after the lines.
Leave a clear pause of about 1.5 seconds between consecutive lines.
Voice direction: a cheerful, playful, high-energy cartoon robot sidekick; quick, bouncy rhythm; big smile in the voice.

"""

if not os.path.exists(full) or "--regen" in sys.argv:
    text = PROMPT + "\n".join(f"{i+1}. {ln['zh']}" for i, ln in enumerate(lines))
    tts.synth_raw = None
    body = {"contents": [{"parts": [{"text": text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": tts.VOICE}}}}}
    import base64
    part = tts.call(tts.TTS_MODEL, body)["candidates"][0]["content"]["parts"][0]["inlineData"]
    mime = part.get("mimeType", "")
    raw = full + ".raw"
    open(raw, "wb").write(base64.b64decode(part["data"]))
    fmt = [] if "wav" in mime else ["-f", "s16le", "-ar", "24000", "-ac", "1"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *fmt, "-i", raw, "-ar", "48000", "-ac", "1", full], check=True)
    os.remove(raw)
    print("generated", mime, tts.duration(full))

# find pauses
out = subprocess.run(["ffmpeg", "-i", full, "-af", "silencedetect=n=-42dB:d=0.35", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
gaps = [(e - s, s, e) for s, e in zip(starts, ends) if s > 0.2 and e < tts.duration(full) - 0.2]
print("gaps:", [(round(g, 2), round(s, 2)) for g, s, e in sorted(gaps, key=lambda x: x[1])])
need = len(lines) - 1
if len(gaps) < need:
    sys.exit(f"only {len(gaps)} pauses found, need {need}")
cuts = sorted(sorted(gaps, reverse=True)[:need], key=lambda x: x[1])
bounds = [0.0] + [(s + e) / 2 for _, s, e in cuts] + [tts.duration(full)]
trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
for i, ln in enumerate(lines):
    wav = os.path.join(ROOT, "audio", ln["id"] + ".wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", full, "-ss", f"{bounds[i]:.3f}", "-to", f"{bounds[i+1]:.3f}",
                    "-af", trim, wav], check=True)

# one transcription call over the whole take
import base64
body = {"contents": [{"parts": [
    {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(open(full, "rb").read()).decode()}},
    {"text": "逐字转写这段音频（英文单词保持英文）。每句话单独一行，只输出转写文字。"}]}]}
heard_all = None
for m in ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash"]:
    try:
        heard_all = tts.call(m, body)["candidates"][0]["content"]["parts"][0]["text"].strip(); break
    except Exception as e:
        print("asr", m, "failed:", e)
print("HEARD:\n" + str(heard_all))
dur = {}
for ln in lines:
    wav = os.path.join(ROOT, "audio", ln["id"] + ".wav")
    dur[ln["id"]] = {"dur": round(tts.duration(wav), 3)}
if heard_all:
    sim = difflib.SequenceMatcher(None, tts.norm(heard_all), tts.norm("".join(l["zh"] for l in lines))).ratio()
    print("overall similarity", round(sim, 3))
json.dump(dur, open(os.path.join(ROOT, "audio", "durations.json"), "w"), indent=1)
print(json.dumps(dur))
