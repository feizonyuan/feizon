"""Verify TTS output by asking a Gemini text model to transcribe it."""
import base64, json, os, sys, urllib.request
KEY = open(os.environ["GEMINI_KEY_FILE"]).read().strip()
for f in sys.argv[1:]:
    body = {"contents": [{"parts": [{"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(open(f, "rb").read()).decode()}},
                                    {"text": "逐字转写这段音频，只输出转写文字，并在末尾用括号描述语气和语速。"}]}]}
    req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": KEY})
    r = json.load(urllib.request.urlopen(req, timeout=120))
    print(f, "=>", r["candidates"][0]["content"]["parts"][0]["text"].strip())
