"""Voice-over with Gemini TTS: one request per line, text only (this model reads any
instructions aloud), optional inline [style] tag. Key comes from the proxy or GEMINI_KEY_FILE.
  python3 scripts/tts.py            -> audio/raw/lines/<id>.wav for every dialogue + rap line
  python3 scripts/tts.py l03 r2     -> regenerate only those ids
  python3 scripts/tts.py --say Voice "text" out.wav"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = open(os.environ["GEMINI_KEY_FILE"]).read().strip() if os.environ.get("GEMINI_KEY_FILE") else "dummy"
MODEL = os.environ.get("TTS_MODEL", "gemini-3.8-flash-tts")

def call(body, model=MODEL):
    for a in range(6):
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
              data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
        try: return json.load(urllib.request.urlopen(req, timeout=300))
        except urllib.error.HTTPError as e:
            print(e.code, e.read().decode()[:300].replace("\n", " "))
            if e.code in (429, 500, 503) and a < 5: time.sleep(15 * (a + 1)); continue
            raise

def say(voice, text, wav, model=MODEL):
    body = {"contents": [{"parts": [{"text": text}]}], "generationConfig": {"responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    part = call(body, model)["candidates"][0]["content"]["parts"][0]["inlineData"]
    rate = 24000
    for kv in part.get("mimeType", "").split(";"):
        if kv.strip().startswith("rate="): rate = int(kv.split("=")[1])
    raw = wav + ".pcm"; open(raw, "wb").write(base64.b64decode(part["data"]))
    trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", raw, "-af", trim, "-ar", "48000", wav], check=True)
    os.remove(raw)

def dur(w): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", w], capture_output=True, text=True).stdout)

if __name__ == "__main__":
    if sys.argv[1:2] == ["--say"]:
        say(sys.argv[2], sys.argv[3], sys.argv[4]); print(dur(sys.argv[4])); sys.exit()
    S = json.load(open(os.path.join(ROOT, "script.json")))
    d = os.path.join(ROOT, "audio", "raw", "lines"); os.makedirs(d, exist_ok=True)
    only = set(sys.argv[1:])
    for l in S["lines"]:
        w = os.path.join(d, l["id"] + ".wav")
        if "reuse" in l or (os.path.exists(w) and l["id"] not in only) or (only and l["id"] not in only): continue
        say(S["speakers"][l["who"]], l.get("tts", l["say"]), w, S["models"][l["who"]]); print(l["id"], round(dur(w), 2), l["say"])
    # rap: one take, all four lines, split on the three longest pauses
    w = os.path.join(d, "rap_take.wav")
    if not os.path.exists(w) or "rap" in only:
        say(S["speakers"]["Shiba"], "\n".join(r["say"] for r in S["rap"]), w, S["models"]["Shiba"]); print("rap", round(dur(w), 2))
