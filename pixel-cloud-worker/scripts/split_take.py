"""Split audio/full_take.wav into per-line clips using Gemini timestamps snapped to detected silences."""
import base64, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts

ROOT = tts.ROOT
lines = json.load(open(os.path.join(ROOT, "script.json")))
full = os.path.join(ROOT, "audio", "full_take.wav")
total = tts.duration(full)
cache = os.path.join(ROOT, "audio", "timestamps.json")

if not os.path.exists(cache):
    listing = "\n".join(f'{l["id"]}: {l["zh"]}' for l in lines)
    body = {"contents": [{"parts": [
        {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(open(full, "rb").read()).decode()}},
        {"text": "这段音频依次朗读了以下几句话（最后一句可能中间有停顿）：\n" + listing +
                 "\n请给出每句话在音频中开始和结束的时间（秒，精确到0.01）。只输出 JSON 数组，格式 [{\"id\":\"s1\",\"start\":0.00,\"end\":0.00}, ...]。"}]}],
        "generationConfig": {"responseMimeType": "application/json"}}
    for m in ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-latest"]:
        try:
            txt = tts.call(m, body)["candidates"][0]["content"]["parts"][0]["text"]; break
        except Exception as e:
            print("asr", m, "failed:", e)
    json.dump(json.loads(txt), open(cache, "w"), indent=1)
ts = {t["id"]: t for t in json.load(open(cache))}
print("timestamps:", [(k, v["start"], v["end"]) for k, v in ts.items()])

out = subprocess.run(["ffmpeg", "-i", full, "-af", "silencedetect=n=-42dB:d=0.25", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
sil = list(zip(map(float, re.findall(r"silence_start: ([\d.]+)", out)), map(float, re.findall(r"silence_end: ([\d.]+)", out))))
mids = [(s + e) / 2 for s, e in sil]

bounds = [0.0]
for a, b in zip(lines, lines[1:]):
    guess = (ts[a["id"]]["end"] + ts[b["id"]]["start"]) / 2
    snap = min(mids, key=lambda m: abs(m - guess))
    bounds.append(snap if abs(snap - guess) < 1.0 else guess)
bounds.append(total)
print("cuts:", [round(x, 2) for x in bounds])
trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
dur = {}
for i, ln in enumerate(lines):
    wav = os.path.join(ROOT, "audio", ln["id"] + ".wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", full, "-ss", f"{bounds[i]:.3f}", "-to", f"{bounds[i+1]:.3f}",
                    "-af", trim, wav], check=True)
    dur[ln["id"]] = {"dur": round(tts.duration(wav), 3)}
json.dump(dur, open(os.path.join(ROOT, "audio", "durations.json"), "w"), indent=1)
print(json.dumps(dur))
