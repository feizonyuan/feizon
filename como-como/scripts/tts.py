"""Voice takes with Gemini TTS. One request per take, plain text only (these models read any
instructions aloud). Multi-word takes are split on pauses into clips.
  python3 scripts/tts.py            -> audio/raw/takes/<take>.wav + audio/raw/clips/<clip>.wav
  python3 scripts/tts.py s_ans      -> regenerate that take
  python3 scripts/tts.py --split    -> only re-split existing takes
Key: proxy-injected, or GEMINI_KEY_FILE."""
import base64, itertools, json, os, re, subprocess, sys, time, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = open(os.environ["GEMINI_KEY_FILE"]).read().strip() if os.environ.get("GEMINI_KEY_FILE") else "dummy"
TRIM = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"

def call(body, model):
    for a in range(6):
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
              data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
        try: return json.load(urllib.request.urlopen(req, timeout=300))
        except urllib.error.HTTPError as e:
            msg = e.read().decode()
            print(e.code, re.findall(r'quotaId": "([^"]+)', msg) or msg[:200].replace("\n", " "))
            if "PerDay" in msg: raise SystemExit(f"daily quota exhausted for {model}")
            if e.code in (429, 500, 503) and a < 5: time.sleep(15 * (a + 1)); continue
            raise

def say(voice, text, wav, model):
    body = {"contents": [{"parts": [{"text": text}]}], "generationConfig": {"responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    part = call(body, model)["candidates"][0]["content"]["parts"][0]["inlineData"]
    rate = 24000
    for kv in part.get("mimeType", "").split(";"):
        if kv.strip().lower().startswith("rate="): rate = int(kv.split("=")[1])
    raw = wav + ".pcm"; open(raw, "wb").write(base64.b64decode(part["data"]))
    fmt = [] if "wav" in part.get("mimeType", "") else ["-f", "s16le", "-ar", str(rate), "-ac", "1"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *fmt, "-i", raw, "-af", TRIM, "-ar", "48000", "-ac", "1", wav], check=True)
    os.remove(raw)

def dur(w): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", w], capture_output=True, text=True).stdout)

def split(take, clips, weights, outdir):
    D = dur(take)
    if len(clips) == 1:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", take, "-c", "copy", os.path.join(outdir, clips[0] + ".wav")], check=True); return
    out = subprocess.run(["ffmpeg", "-i", take, "-af", "silencedetect=n=-40dB:d=0.1", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", out)]; en = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", out)]
    gaps = [(s, e) for s, e in zip(st, en) if 0.15 < s and e < D - 0.1]
    w = [x / sum(weights) for x in weights]
    def speech(a, b): return (b - a) - sum(max(0, min(e, b) - max(s, a)) for s, e in gaps)
    tot = speech(0, D)
    def cost(c):   # prefer long pauses whose split matches the expected word lengths
        b = [0] + [(s + e) / 2 for s, e in c] + [D]
        return sum((speech(b[i], b[i + 1]) / tot - w[i]) ** 2 for i in range(len(w))) - 0.02 * sum(e - s for s, e in c)
    best = min(itertools.combinations(gaps, len(clips) - 1), key=cost)
    b = [0] + [(s + e) / 2 for s, e in best] + [D]
    for i, c in enumerate(clips):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", take, "-ss", f"{b[i]:.3f}", "-to", f"{b[i+1]:.3f}", "-af", TRIM,
                        os.path.join(outdir, c + ".wav")], check=True)
    print(f"  split {os.path.basename(take)}:", " ".join(f"{c}={dur(os.path.join(outdir, c + '.wav')):.2f}" for c in clips))

if __name__ == "__main__":
    S = json.load(open(os.path.join(ROOT, "script.json")))
    td = os.path.join(ROOT, "audio", "raw", "takes"); cd = os.path.join(ROOT, "audio", "raw", "clips")
    os.makedirs(td, exist_ok=True); os.makedirs(cd, exist_ok=True)
    only = {a for a in sys.argv[1:] if not a.startswith("--")}
    for t in S["takes"]:
        w = os.path.join(td, t["id"] + ".wav")
        if "--split" not in sys.argv and (not os.path.exists(w) or t["id"] in only):
            say(S["speakers"][t["who"]], t["text"], w, S["models"][t["who"]]); print(t["id"], round(dur(w), 2))
        if os.path.exists(w): split(w, t["clips"], t.get("weights", [1] * len(t["clips"])), cd)
    for k, p in S.get("reuse", {}).items():
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(ROOT, p), "-c", "copy", os.path.join(cd, k + ".wav")], check=True)
