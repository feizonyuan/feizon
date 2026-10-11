"""Voice-over with Gemini TTS, one request per line, each verified by transcription.
The API key is read from GEMINI_KEY_FILE and is never stored in the repo.
Writes audio/lXX.wav (48 kHz mono, trimmed) and audio/durations.json.
  GEMINI_KEY_FILE=/path/to/key python3 scripts/tts_gemini.py [l03 l07 ...]"""
import base64, difflib, json, os, re, subprocess, sys, time, urllib.error, urllib.request

KEY = open(os.environ["GEMINI_KEY_FILE"]).read().strip()
TTS_MODEL = os.environ.get("TTS_MODEL", "gemini-3.8-flash-tts")
ASR_MODELS = os.environ.get("ASR_MODELS", "gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash").split(",")
VOICE = os.environ.get("TTS_VOICE", "Charon")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://generativelanguage.googleapis.com/v1beta/models/"

PROMPT = """Read the TRANSCRIPT below aloud in Mandarin Chinese (standard Putonghua), word for word.
Read it exactly ONCE - never repeat it. Do not add, drop or change any words. No greetings, nothing before or after it. Say "AI" as the English letters A-I.
Voice direction: a professional male narrator for a financial / knowledge documentary short.
Calm, confident and authoritative, warm but not salesy; crisp articulation; brisk pace suited to a 60-second
vertical video; slight emphasis on the key phrase; no exaggerated emotion.

TRANSCRIPT:
"""

def call(model, body, tries=6):
    for attempt in range(tries):
        req = urllib.request.Request(BASE + model + ":generateContent", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
        try:
            return json.load(urllib.request.urlopen(req, timeout=180))
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code in (429, 500, 503) and attempt < tries - 1:
                print(f"  {model} HTTP {e.code}, retrying: {msg}", flush=True)
                time.sleep(15 * (attempt + 1)); continue
            raise RuntimeError(f"{model} HTTP {e.code}: {msg}")

def norm(s):
    return re.sub(r"[\W_]+", "", s).lower()

def duration(wav):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
                                capture_output=True, text=True).stdout)

def synth(text, wav):
    body = {"contents": [{"parts": [{"text": PROMPT + text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
    part = call(TTS_MODEL, body)["candidates"][0]["content"]["parts"][0]["inlineData"]
    mime = part.get("mimeType", "")
    raw = wav + ".raw"
    open(raw, "wb").write(base64.b64decode(part["data"]))
    fmt = []
    if "wav" not in mime:
        rate = 24000
        for kv in mime.split(";"):
            if kv.strip().startswith("rate="): rate = int(kv.split("=")[1])
        fmt = ["-f", "s16le", "-ar", str(rate), "-ac", "1"]
    trim = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
            "silenceremove=start_periods=1:start_threshold=-45dB,areverse")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *fmt, "-i", raw, "-af", trim,
                    "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav], check=True)
    os.remove(raw)

def transcribe(wav):
    body = {"contents": [{"parts": [
        {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(open(wav, "rb").read()).decode()}},
        {"text": "逐字转写这段普通话音频（英文字母保持英文，数字用阿拉伯数字），只输出转写文字，不要任何说明。"}]}]}
    for m in ASR_MODELS:  # fall back across models when one is overloaded
        try:
            return call(m, body, tries=2)["candidates"][0]["content"]["parts"][0]["text"].strip()
        except RuntimeError as e:
            print("  asr fallback:", str(e)[:80], flush=True)
    raise RuntimeError("all transcription models failed")

def main():
    lines = json.load(open(os.path.join(ROOT, "script.json")))
    only = set(sys.argv[1:])
    path = os.path.join(ROOT, "audio", "durations.json")
    durs = json.load(open(path)) if os.path.exists(path) else {}
    for ln in lines:
        if only and ln["id"] not in only:
            continue
        wav = os.path.join(ROOT, "audio", ln["id"] + ".wav")
        best = None
        for attempt in range(int(os.environ.get("MAX_TRIES", "4"))):
            synth(ln["zh"], wav)
            heard = transcribe(wav)
            sim = difflib.SequenceMatcher(None, norm(heard), norm(ln["zh"])).ratio()
            d = duration(wav)
            ok = sim >= 0.8 and d < 1.0 + 0.3 * len(norm(ln["zh"]))
            print(f'{ln["id"]} try{attempt} {d:.2f}s sim={sim:.2f} ok={ok} heard={heard}', flush=True)
            if ok:
                break
        durs[ln["id"]] = {"dur": round(duration(wav), 3), "ok": ok, "heard": heard}
        json.dump(durs, open(path, "w"), ensure_ascii=False, indent=1)
    print("total", round(sum(v["dur"] for v in durs.values()), 2))

main()
