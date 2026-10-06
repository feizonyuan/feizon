"""Generate voice-over lines with Gemini TTS, then verify each by transcription.
The API key is read from GEMINI_KEY_FILE and is never stored in the repo."""
import difflib, base64, json, os, re, sys, subprocess, urllib.request, urllib.error, time

KEY = open(os.environ["GEMINI_KEY_FILE"]).read().strip()
TTS_MODEL = os.environ.get("TTS_MODEL", "gemini-3.8-flash-tts")
ASR_MODEL = os.environ.get("ASR_MODEL", "gemini-3.5-flash")
VOICE = os.environ.get("TTS_VOICE", "Puck")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://generativelanguage.googleapis.com/v1beta/models/"

PROMPT = """Read the TRANSCRIPT below aloud in Mandarin Chinese, word for word.
Do not add, drop or change any words. No greetings, no acknowledgements, nothing before or after it.
Voice direction: a cheerful, playful, high-energy cartoon robot sidekick; quick, bouncy rhythm; big smile in the voice.

TRANSCRIPT:
"""

def call(model, body):
    for attempt in range(5):
        req = urllib.request.Request(BASE + model + ":generateContent", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
        try:
            return json.load(urllib.request.urlopen(req, timeout=180))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 4:
                time.sleep(15 * (attempt + 1)); continue
            raise

def norm(s):
    s = re.sub(r"[（(].*?[)）]", "", s)
    return re.sub(r"[\W_]+", "", s).lower()

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
    trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *fmt, "-i", raw, "-af", trim, "-ar", "48000", "-ac", "1", wav], check=True)
    os.remove(raw)

def transcribe(wav):
    body = {"contents": [{"parts": [
        {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(open(wav, "rb").read()).decode()}},
        {"text": "逐字转写这段音频（英文单词保持英文），只输出转写文字，不要任何说明。"}]}]}
    return call(ASR_MODEL, body)["candidates"][0]["content"]["parts"][0]["text"].strip()

def duration(wav):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
                                capture_output=True, text=True).stdout)

if __name__ == "__main__":
    lines = json.load(open(os.path.join(ROOT, "script.json")))
    only = set(sys.argv[1:])
    for ln in lines:
        if only and ln["id"] not in only:
            continue
        wav = os.path.join(ROOT, "audio", ln["id"] + ".wav")
        for attempt in range(4):
            synth(ln["zh"], wav)
            heard = transcribe(wav)
            sim = difflib.SequenceMatcher(None, norm(heard), norm(ln["zh"])).ratio()
            ok = sim >= 0.85 and duration(wav) < 1.2 + 0.35 * len(norm(ln["zh"]))
            time.sleep(6)
            print(f'{ln["id"]} try{attempt} {duration(wav):.2f}s ok={ok} heard={heard}', flush=True)
            if ok:
                break
        path = os.path.join(ROOT, "audio", "durations.json")
        old = json.load(open(path)) if os.path.exists(path) else {}
        old[ln["id"]] = {"dur": round(duration(wav), 3), "ok": ok, "heard": heard}
        json.dump(old, open(path, "w"), ensure_ascii=False, indent=1)
