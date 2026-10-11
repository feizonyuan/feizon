"""Synthesize the music bed + SFX from timeline.json and mix them with the voice-over.
Output: out/mix.wav (48 kHz stereo), out/mix_novoice.wav. Pure numpy, no samples."""
import json, os, wave
import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "timeline.json")))
DUR = TL["duration"]
N = int(SR * DUR)
rng = np.random.default_rng(7)
SC = {s["id"]: s for s in TL["scenes"]}
LN = {l["id"]: l for s in TL["scenes"] for l in s["lines"]}
def wordT(i, sub):  # same rule as src/scenes.js
    l = LN[i]; k = l["zh"].find(sub)
    return l["at"] + l["dur"] * (max(k, 0) / len(l["zh"]))
QUEST_SCENES = ["ai", "map", "free", "body"]
clearT = lambda s: SC[s]["end"] - 1.05

def tt(d): return np.arange(int(SR * d)) / SR
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_ad(n, a=0.005, d=0.2, sustain=0.0, curve=4.0):
    t = np.arange(n) / SR
    att = np.clip(t / max(a, 1e-4), 0, 1)
    dec = sustain + (1 - sustain) * np.exp(-np.maximum(t - a, 0) * curve / max(d, 1e-4))
    return att * dec
def square(f, t, duty=0.5):
    ph = np.cumsum(np.broadcast_to(f, t.shape) / SR) if np.ndim(f) else f * t
    return np.where((ph % 1.0) < duty, 1.0, -1.0)
def saw(f, t):
    ph = np.cumsum(np.broadcast_to(f, t.shape) / SR) if np.ndim(f) else f * t
    return 2 * (ph % 1.0) - 1
def tri(f, t):
    ph = np.cumsum(np.broadcast_to(f, t.shape) / SR) if np.ndim(f) else f * t
    return 2 * np.abs(2 * (ph % 1.0) - 1) - 1
def sine(f, t):
    ph = np.cumsum(np.broadcast_to(f, t.shape) / SR) if np.ndim(f) else f * t
    return np.sin(2 * np.pi * ph)
def noise(n): return rng.uniform(-1, 1, n)
def band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4) if lo > 0 else 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))

class Track:
    def __init__(self): self.L = np.zeros(N + SR * 2); self.R = np.zeros(N + SR * 2)
    def add(self, t0, x, gain=1.0, pan=0.0):
        i = int(t0 * SR)
        if i < 0: x = x[-i:]; i = 0
        x = x[: len(self.L) - i] * gain
        self.L[i:i + len(x)] += x * np.sqrt((1 - pan) / 2) * 1.414
        self.R[i:i + len(x)] += x * np.sqrt((1 + pan) / 2) * 1.414

# ---------------------------------------------------------------- SFX library
def s_click(f=2500, d=0.012):
    n = int(SR * d); return band(noise(n), f * 0.5, f * 2) * env_ad(n, 0.0005, d, curve=6) * 0.8
def s_blip(m=84, d=0.07, duty=0.25):
    t = tt(d); return square(mtof(m), t, duty) * env_ad(len(t), 0.002, d, curve=5) * 0.35
def s_bell(freqs=(1568, 2352, 3136, 4186), d=1.4):
    t = tt(d); x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * (2 + i * 1.5)) / (i + 1) for i, f in enumerate(freqs))
    return x * env_ad(len(t), 0.002, d, sustain=1) * 0.6
def s_whoosh(d=0.5, lo=300, hi=4000, rise=True):
    n = int(SR * d); t = np.arange(n) / n
    x = band(noise(n), lo, hi)
    e = np.sin(np.pi * t) ** 2 if rise is None else (t ** 2 if rise else (1 - t) ** 2)
    return x * e * 0.8
def s_sweep(f0, f1, d, wave=sine, gain=0.4, curve='exp'):
    t = tt(d); k = np.linspace(0, 1, len(t))
    f = f0 * (f1 / f0) ** k if curve == 'exp' else f0 + (f1 - f0) * k
    return wave(f, t) * env_ad(len(t), 0.005, d, sustain=1) * np.linspace(1, 0.2, len(t)) * gain
def s_clang(base=220, d=1.2, bright=1.0):
    t = tt(d)
    ratios = [1, 2.56, 4.05, 5.77, 7.6, 9.9]
    x = sum(np.sin(2 * np.pi * base * r * t + i) * np.exp(-t * (3 + i * 2.2)) / (1 + i * 0.6) for i, r in enumerate(ratios))
    hit = band(noise(len(t)), 1500, 9000) * np.exp(-t * 40) * bright
    return (x * 0.45 + hit * 0.5) * 0.8
def s_boom(d=1.0, f0=110, f1=35, gain=1.0):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * 8)
    x = sine(f, t) * np.exp(-t * 3.5)
    x += band(noise(len(t)), 40, 400) * np.exp(-t * 6) * 0.7
    return np.tanh(x * 1.6) * 0.8 * gain
def s_thud(d=0.3): return s_boom(d, 160, 50, 0.6)
def s_pop(f=900, d=0.08):
    t = tt(d); return sine(f * (1 + 2 * np.exp(-t * 60)), t) * np.exp(-t * 40) * 0.6
def s_boing(f=180, d=0.5):
    t = tt(d); f = f * (1 + 0.8 * t / d) * (1 + 0.12 * np.sin(2 * np.pi * 14 * t) * np.exp(-t * 3))
    return square(f, t, 0.3) * env_ad(len(t), 0.003, d * 0.6, curve=3) * 0.28
def s_hiss(d=0.6, gain=0.5):
    n = int(SR * d); t = np.arange(n) / SR
    return band(noise(n), 3000, 12000) * np.exp(-t * 3 / d) * env_ad(n, 0.01, d, sustain=1) * gain
def s_zap(d=0.25):
    t = tt(d); f = 2400 * np.exp(-t * 14) + 120
    x = square(f, t, 0.5) * 0.3 + band(noise(len(t)), 2000, 10000) * 0.25
    gate = (np.sin(2 * np.pi * 70 * t) > -0.2).astype(float)
    return x * gate * np.exp(-t * 9)
def s_shutter():
    a = s_click(4000, 0.008); b = s_click(2500, 0.02)
    out = np.zeros(int(SR * 0.08)); out[:len(a)] += a; i = int(SR * 0.035); out[i:i + len(b)] += b * 0.9
    out += s_sweep(3000, 6000, 0.08, sine, 0.05)[:len(out)]
    return out
def s_chime_up(notes=(72, 76, 79, 84), step=0.06, d=0.6):
    out = np.zeros(int(SR * (step * len(notes) + d)))
    for i, m in enumerate(notes):
        t = tt(d); x = (tri(mtof(m), t) * 0.5 + np.sin(2 * np.pi * mtof(m + 12) * t) * 0.3) * np.exp(-t * 6)
        j = int(SR * i * step); out[j:j + len(x)] += x * 0.4
    return out
def s_rumble(d, gain=0.6):
    n = int(SR * d); return band(noise(n), 30, 500) * gain
def s_crackle(d=0.8, density=60):
    n = int(SR * d); out = np.zeros(n)
    for _ in range(int(density * d)):
        i = rng.integers(0, n - 2000); c = s_click(rng.uniform(1500, 6000), rng.uniform(0.003, 0.012))
        out[i:i + len(c)] += c * rng.uniform(0.3, 1) * np.exp(-i / n * 2)
    return out
def s_crash(d=2.0):
    t = tt(d); return band(noise(len(t)), 4000, 16000) * np.exp(-t * 2.2) * 0.45
def s_creak(d=0.4):
    t = tt(d); f = 90 + 30 * np.sin(2 * np.pi * 7 * t)
    return saw(f, t) * env_ad(len(t), 0.03, d, sustain=0.6) * np.sin(np.pi * t / d) * 0.18
def s_step():
    x = s_thud(0.12) * 0.5; c = s_click(1200, 0.02) * 0.3; x[:len(c)] += c; return x

# ---------------------------------------------------------------- SFX (subtle, editorial)
def s_tick(f=2200, d=0.05, g=0.35):
    t = tt(d); return np.sin(2 * np.pi * f * t) * np.exp(-t * 90) * g
def s_soft(d=0.4, lo=500, hi=5000, g=0.35):
    return s_whoosh(d, lo, hi, None) * g
def s_low(d=0.9, g=0.5):
    t = tt(d); return np.sin(2 * np.pi * (48 + 30 * np.exp(-t * 10)) * t) * np.exp(-t * 4) * g
def s_chime(notes=(84, 88, 91), d=1.4, step=0.07, g=0.25):
    out = np.zeros(int(SR * (d + step * len(notes))))
    for i, m in enumerate(notes):
        t = tt(d); f = mtof(m)
        x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3)) * np.exp(-t * 3.5)
        j = int(SR * i * step); out[j:j + len(x)] += x * g
    return out
def s_type(n=6, step=0.05):
    out = np.zeros(int(SR * (n * step + 0.1)))
    for i in range(n):
        x = s_click(rng.uniform(1800, 3200), 0.012) * 0.5; j = int(SR * i * step); out[j:j + len(x)] += x
    return out

sfx = Track()
def at(t, x, g=1.0, pan=0.0): sfx.add(t, x, g, pan)

at(0.0, s_low(1.2, 0.7)); at(0.0, s_soft(0.6, 300, 3000, 0.25))
for w, p in [("一部手机", -0.2), ("1000块", 0.2)]: at(wordT("l01", w), s_tick(1800), 0.9, p)
at(0.2, s_tick(1500), 0.6); at(0.5, s_tick(1500), 0.6)
at(wordT("l01", "怎么翻身"), s_low(1.0, 0.8)); at(wordT("l01", "怎么翻身"), s_soft(0.5, 800, 6000, 0.3))
tA, tB = LN["l02"]["at"], wordT("l02", "邵艾伦")
at(tA - 0.1, s_soft(0.35, 1000, 7000, 0.25), 1, -0.4); at(tB - 0.1, s_soft(0.35, 1000, 7000, 0.25), 1, 0.4)
tH, tC, tF = wordT("l02", "4个多小时"), wordT("l02", "我压成"), wordT("l02", "4个反常识")
at(tH, s_sweep(200, 600, 0.6, sine, 0.12)); at(tC + 0.1, s_sweep(900, 300, 0.4, sine, 0.1))
for i in range(4): at(tF + 0.15 + i * 0.12, s_tick(1600 + 200 * i), 0.7)
for s in TL["scenes"][1:]:
    at(s["start"] - 0.2, s_soft(0.45, 400, 6000, 0.35))
for q in QUEST_SCENES:
    at(SC[q]["start"] + 0.05, s_low(0.8, 0.45)); at(SC[q]["start"] + 0.1, s_type(5, 0.045), 0.6)
# section 1
at(wordT("l03", "AI化"), s_tick(1200), 0.8)
for w in ["饮食", "训练", "开销", "全部记下来"]: at(wordT("l04", w), s_tick(2000), 0.6, -0.3)
for i in range(4): at(wordT("l04", "存成") + i * 0.08 + 0.3, s_tick(2600), 0.35, 0.3)
for i in range(4): at(LN["l05"]["at"] + i * 0.62 + 0.45, s_soft(0.25, 1500, 8000, 0.2))
at(LN["l05"]["at"] + 0.3, s_low(0.6, 0.35))
# section 2
tLook, tAI2, tD = wordT("l06", "先看"), wordT("l07", "先用AI"), wordT("l07", "再做决定")
t = tLook; k = 0
while t < tAI2 - 0.4: at(t, s_tick(2400 + (k % 3) * 200, 0.03, 0.18), 1, -0.3 + 0.3 * (k % 3)); t += 0.06; k += 1
at(tAI2, s_sweep(300, 1200, max(0.5, tD - tAI2), sine, 0.05))
at(tD, s_chime((79, 83, 86)), 0.8)
# section 3
tFlip = wordT("l08", "先自由")
at(tFlip, s_soft(0.5, 300, 4000, 0.4)); at(tFlip + 0.25, s_tick(1400), 0.7)
for w in ["房贷", "车贷", "锁死"]: at(wordT("l09", w), s_low(0.5, 0.5)); at(wordT("l09", w), s_tick(900), 0.7)
for i in range(4): at(LN["l10"]["at"] + i * 0.55, s_tick(1800 + i * 150), 0.6, -0.4 + 0.27 * i)
# section 4
tAI4 = wordT("l11", "AI越强")
for i in range(20): at(tAI4 + i / 22, s_tick(2600, 0.03, 0.15), 1, -0.5)
at(wordT("l11", "身体"), s_low(0.7, 0.5))
at(wordT("l12", "寿命") - 0.15, s_chime((76, 81, 84, 88)), 0.8)
for i in range(3): at(LN["l13"]["at"] + 0.15 + i * 0.3, s_tick(2000), 0.6)
at(LN["l13"]["at"] + 1.0, s_sweep(300, 900, 1.0, sine, 0.08))
# end
at(wordT("l14", "多创造"), s_low(1.0, 0.6)); at(wordT("l14", "少消费"), s_low(1.0, 0.5))
ask = LN["l15"]["at"] - 0.2
for i in range(4): at(ask + 0.2 + i * 0.12, s_tick(1700 + i * 150), 0.6)
at(wordT("l15", "评论区"), s_chime((84, 88, 91, 96), 1.6, 0.06), 0.7)

# ---------------------------------------------------------------- BGM: calm, modern news-feature bed (96 BPM)
BPM = 96.0; BEAT = 60 / BPM; BAR = BEAT * 4
# (bass root, chord voicing) : Fmaj7 – G6 – Em7 – Am7
PROG = [(41, [57, 60, 64, 69]), (43, [59, 62, 64, 67]), (40, [55, 59, 62, 67]), (45, [55, 60, 64, 67])]
music = Track()
END_HIT = SC["end"]["start"]
def epiano(m, d):
    t = tt(d); f = mtof(m)
    mod = np.sin(2 * np.pi * f * t) * 1.2 * np.exp(-t * 6)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.6)
    return x * env_ad(len(t), 0.004, d, sustain=1)
def soft_kick():
    t = tt(0.3); f = 42 + 70 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * 0.9
def shaker():
    n = int(SR * 0.06); t = np.arange(n) / SR
    return band(noise(n), 6000, 14000) * np.exp(-t * 60) * 0.25
def level(t):
    if t < SC["intro"]["end"]: return 1
    if t < END_HIT: return 2
    if t < DUR - 1.6: return 3
    return 0
nbeats = int(DUR / BEAT) + 1
for b in range(nbeats):
    tb = b * BEAT; L = level(tb)
    if L == 0: continue
    bar, bi = b // 4, b % 4
    root, ch = PROG[bar % 4]
    if bi in (0, 2) and L >= 1: music.add(tb, soft_kick(), 0.55 if L >= 2 else 0.4)
    if L >= 2:
        for h in range(2): music.add(tb + h * BEAT / 2 + BEAT / 4, shaker(), 0.5 if h else 0.3, 0.3)
    if bi == 0:
        t_ = tt(BAR)
        sub = np.sin(2 * np.pi * mtof(root - 12 + 12) * t_) * env_ad(len(t_), 0.05, BAR, 1) * np.linspace(1, 0.6, len(t_))
        music.add(tb, sub, 0.28)
        for i, m in enumerate(ch): music.add(tb + i * 0.012, epiano(m, BAR * 0.98), 0.06, -0.3 + 0.2 * i)
        pad = sum(saw(mtof(m) * (1 + d), t_) for m in ch[1:] for d in (-0.003, 0.003))
        music.add(tb, band(pad, 0, 1100) * env_ad(len(t_), 0.6, BAR, 1), 0.012)
    # sparse pluck arpeggio on the off-beats
    if L >= 2:
        for h in range(2):
            m = ch[(b * 2 + h) % 4] + 12
            t_ = tt(0.5); x = np.sin(2 * np.pi * mtof(m) * t_) * np.exp(-t_ * 9)
            music.add(tb + h * BEAT / 2 + BEAT / 2 * 0.5 * h, x, 0.05 if L == 2 else 0.065, 0.4 if h else -0.4)
t_ = tt(3.0)
music.add(DUR - 1.6, sum(epiano(m, 3.0) for m in (53, 57, 60, 64, 69)) * 0.07, 1.0)
music.add(DUR - 1.6, np.sin(2 * np.pi * mtof(29) * t_) * np.exp(-t_ * 1.2) * 0.25, 1.0)


# ---------------------------------------------------------------- voice + mix
voice = Track()
vmask = np.zeros(len(voice.L))
for s in TL["scenes"]:
    for l in s["lines"]:
        w = wave.open(os.path.join(ROOT, "audio", l["id"] + ".wav"))
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
        assert w.getframerate() == SR and w.getnchannels() == 1
        x = x / (np.max(np.abs(x)) + 1e-9) * 0.85
        voice.add(l["at"], x, 1.0)
        i = int(l["at"] * SR); vmask[i:i + len(x)] = 1
k = int(SR * 0.15)
duck = np.convolve(vmask, np.ones(k) / k, mode="same")

def write(path, L_, R_):
    mix = np.stack([L_, R_], 1)[:N]
    fade = int(SR * 0.35); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix = mix / (np.percentile(np.abs(mix), 99.9) + 1e-9) * 0.8
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
mg = 1 - 0.55 * duck
write(os.path.join(ROOT, "out", "mix.wav"), music.L * mg * 0.7 + sfx.L * (1 - 0.4 * duck) * 0.5 + voice.L,
      music.R * mg * 0.7 + sfx.R * (1 - 0.4 * duck) * 0.5 + voice.R)
# music + SFX only, for re-voicing in CapCut / Douyin's own TTS
write(os.path.join(ROOT, "out", "mix_novoice.wav"), music.L * 0.8 + sfx.L * 0.7, music.R * 0.8 + sfx.R * 0.7)
print("wrote out/mix.wav, out/mix_novoice.wav", DUR, "s")
