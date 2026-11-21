"""Transcribe a wav with timestamps via Gemini (verification only)."""
import base64, json, sys, urllib.request
w = sys.argv[1]; model = sys.argv[2] if len(sys.argv) > 2 else "gemini-3-flash-preview"
body = {"contents": [{"parts": [{"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(open(w, "rb").read()).decode()}},
        {"text": "Transcribe verbatim with start timestamps (mm:ss.s) per utterance and speaker voice (high/low). Then one line rating Spanish pronunciation of the low voice."}]}]}
req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", data=json.dumps(body).encode(),
      headers={"Content-Type": "application/json", "x-goog-api-key": "dummy"})
print(json.load(urllib.request.urlopen(req, timeout=300))["candidates"][0]["content"]["parts"][-1]["text"])
