"""Synthesize the chiptune BGM + SFX from timeline.json and mix them with the voice-over.
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

def s_coin():
    a = s_blip(88, 0.05, 0.5); b = s_blip(95, 0.18, 0.5)
    out = np.zeros(len(a) + len(b)); out[:len(a)] += a; out[len(a):] += b; return out
def s_fanfare():
    out = np.zeros(int(SR * 1.3))
    for i, (m, d) in enumerate([(72, 0.09), (76, 0.09), (79, 0.09), (84, 0.5)]):
        x = note_sq(m, d + 0.25, 0.5, 0.003, 0.25, 0.4) * 0.5 + note_sq(m + 12, d + 0.25, 0.25, 0.003, 0.2, 0.2) * 0.25
        j = int(SR * i * 0.09); out[j:j + len(x)] += x
    return out
def s_wipe():
    x = s_whoosh(0.35, 400, 6000, None) * 0.6
    bl = s_blip(79, 0.06, 0.5); i = int(SR * 0.12); x[i:i + len(bl)] += bl * 0.6
    return x
def s_buzz(d=0.35):
    t = tt(d); return square(110, t, 0.5) * 0.25 * env_ad(len(t), 0.005, d, sustain=0.8) * (np.sin(2 * np.pi * 9 * t) > 0)
def note_sq(m, d, duty=0.25, a=0.004, dec=0.15, sus=0.3):
    t = tt(d); return square(mtof(m), t, duty) * env_ad(len(t), a, dec, sus)

sfx = Track()
def at(t, x, g=1.0, pan=0.0): sfx.add(t, x, g, pan)

# ---- hook
at(0.0, s_boom(0.8, 140, 45, 0.7), 0.9); at(0.0, s_crash(1.2), 0.35)
tPhone = wordT("l01", "一部手机") - 0.25
at(tPhone, s_sweep(1600, 300, 0.3, sine, 0.25)); at(tPhone + 0.3, s_thud(0.3), 1.0); at(tPhone + 0.3, s_clang(400, 0.4, 0.4), 0.4)
tCash = wordT("l01", "1000块")
for i in range(5): at(tCash + 0.08 * i, s_coin(), 0.45, -0.6 + 0.3 * i)
tQ = wordT("l01", "怎么翻身")
at(tQ, s_boom(0.9), 1.0); at(tQ, s_zap(0.25), 0.6)
boot = SC["hook"]["end"] - 0.25
for i, m in enumerate([72, 79, 84]): at(boot + i * 0.07, s_blip(m, 0.08), 0.6)
# ---- intro
tA, tB = LN["l02"]["at"], wordT("l02", "邵艾伦")
at(tA - 0.1, s_whoosh(0.35, 500, 5000, True), 0.6, -0.5); at(tB - 0.1, s_whoosh(0.35, 500, 5000, True), 0.6, 0.5)
at(tB + 0.15, s_pop(800), 0.8)
tH, tC = wordT("l02", "4个多小时"), wordT("l02", "我压成")
at(tH, s_blip(84, 0.06), 0.6)
at(tC, s_sweep(1800, 200, 1.0, square, 0.08))
for i in range(20): at(tC + i * 0.05, s_click(3000), 0.35)
at(tC + 1.0, s_chime_up((84, 88, 91)), 0.7)
tF = wordT("l02", "4个反常识")
for i in range(4): at(tF + 0.1 + i * 0.09, s_pop(600 + 150 * i), 0.8, -0.45 + 0.3 * i)
at(SC["intro"]["end"] - 0.45, s_whoosh(0.4, 600, 7000, True), 0.6)
# ---- scene cuts + quest bands
for s in TL["scenes"][1:]:
    at(s["start"] - 0.15, s_wipe(), 0.7)
for q in QUEST_SCENES:
    at(SC[q]["start"] + 0.05, s_whoosh(0.3, 800, 6000, False), 0.45, -0.4)
    at(clearT(q), s_fanfare(), 0.9); at(clearT(q), s_crackle(0.6, 30), 0.35)
    at(clearT(q) + 0.15, s_sweep(600, 2000, 0.45, tri, 0.12))
    at(clearT(q) + 0.6, s_bell((1568, 2352, 3136), 0.8), 0.5)
# ---- quest 1
tAI = wordT("l03", "AI化")
at(tAI, s_chime_up((79, 84, 88, 91), 0.05), 0.8); at(tAI, s_boing(260, 0.35), 0.4)
for w in ["饮食", "训练", "开销"]: at(wordT("l04", w), s_blip(81, 0.07), 0.6, -0.4)
at(wordT("l04", "全部记下来") + 0.15, s_blip(81, 0.07), 0.6, -0.4)
tStore = wordT("l04", "存成")
at(tStore - 0.3, s_creak(0.35), 0.8, 0.4)
for i in range(4): at(tStore + i * 0.12 + 0.42, s_pop(500 + 80 * i), 0.7, 0.4)
tL5 = LN["l05"]["at"]
for i in range(4): at(tL5 + i * 0.75 + 0.28, s_click(1500, 0.03), 1.0); at(tL5 + i * 0.75 + 0.28, s_blip(76 + i * 2, 0.05), 0.4)
at(wordT("l05", "数据"), s_bell((1047, 1568, 2093), 1.0), 0.45)
# ---- quest 2
t0m, t1m = LN["l06"]["at"] + 0.5, wordT("l07", "再做决定") - 0.1
k = 0
t = t0m
while t < t1m:
    at(t, s_blip(72 + (k % 2) * 3, 0.03, 0.5), 0.25, -0.3 + 0.6 * (k % 2)); t += 0.18; k += 1
for w in ["选专业", "选行业", "也一样", "地图"]: at(wordT("l07", w), s_pop(900), 0.7)
at(wordT("l07", "再做决定"), s_chime_up((76, 81, 84, 88)), 0.8)
# ---- quest 3
tFlip = wordT("l08", "先自由")
at(tFlip - 0.05, s_whoosh(0.5, 300, 5000, None), 0.7); at(tFlip + 0.5, s_pop(700), 0.7)
for w, p in [("房贷", -0.6), ("车贷", 0.6)]:
    tw = wordT("l09", w); at(tw, s_clang(500, 0.5, 0.6), 0.6, p); at(tw + 0.1, s_clang(560, 0.4, 0.5), 0.4, p)
tLock = wordT("l09", "锁死")
at(tLock, s_clang(180, 0.8), 0.7); at(tLock + 0.05, s_buzz(), 0.6)
tBreak = LN["l10"]["at"] + 0.05
at(tBreak, s_crash(1.6), 0.6); at(tBreak, s_boom(0.6, 200, 60, 0.6), 0.8); at(tBreak, s_chime_up((84, 88, 91, 96), 0.05), 0.6)
for i in range(8): at(tBreak + 0.25 + i * 0.19, s_step(), 0.5, -0.2 + 0.4 * (i % 2))
# ---- quest 4
tAI4 = wordT("l11", "AI越强")
for i in range(12): at(tAI4 + i * 0.07, s_blip(84 + (i % 4) * 2, 0.04, 0.25), 0.35, -0.6)
tBody = wordT("l11", "身体")
for i in range(3): at(tBody + i * 0.17, s_blip(90, 0.09, 0.5), 0.45, 0.5)
tCheap = wordT("l12", "变便宜")
for i in range(4): at(tCheap - 0.15 + i * 0.12, s_zap(0.15), 0.4, -0.4 + 0.27 * i); at(tCheap - 0.05 + i * 0.12, s_coin(), 0.25)
tLife = wordT("l12", "寿命") - 0.15
at(tLife, s_bell((784, 1175, 1568, 2349), 1.6), 0.8); at(tLife, s_boom(0.6, 120, 50, 0.4), 0.6)
t13 = LN["l13"]["at"]
for i in range(6):
    tr = t13 + (i + 0.5) / 2.2 + 0.11 - 0.11
    if tr > SC["body"]["end"] - 1.1: break
    at(tr, s_thud(0.15), 0.5); at(tr + 0.05, s_coin(), 0.35, 0.3)
# ---- end
ta = wordT("l14", "多创造")
at(ta, s_boom(0.8), 0.8); at(ta + 0.1, s_chime_up((72, 76, 79, 84, 88), 0.05), 0.8)
at(wordT("l14", "少消费"), s_pop(500, 0.12), 0.8)
ask = LN["l15"]["at"] - 0.1
for i in range(4): at(ask + 0.25 + i * 0.12, s_blip(76 + i * 3, 0.06), 0.5)
at(wordT("l15", "评论区"), s_pop(900), 0.8); at(wordT("l15", "评论区") + 0.1, s_blip(91, 0.12), 0.5)

# ---------------------------------------------------------------- BGM (128 BPM chiptune, I–V–vi–IV)
BPM = 128.0; BEAT = 60 / BPM; BAR = BEAT * 4; OFF = 0.0
PROG = [(36, [72, 76, 79, 84]), (43, [71, 74, 79, 83]), (45, [69, 72, 76, 81]), (41, [69, 72, 77, 81])]
HOOK = [[79, None, 76, 79, 81, 79, 76, 72], [74, None, 71, 74, 79, None, 74, None],
        [76, None, 72, 76, 81, 79, 76, None], [77, 76, 74, 72, 74, None, None, None]]
music = Track()
END_HIT = SC["end"]["start"]
def level(t):
    if t < SC["intro"]["start"]: return 2
    if t < SC["intro"]["end"]: return 1
    if t < END_HIT: return 3
    if t < DUR - 1.2: return 5
    return 0
def kick():
    t = tt(0.22); f = 45 + 140 * np.exp(-t * 30)
    return np.tanh(sine(f, t) * np.exp(-t * 14) * 2.2) * 0.9
def clap():
    n = int(SR * 0.18); t = np.arange(n) / SR
    x = band(noise(n), 900, 5000)
    e = np.exp(-t * 25) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) * 25) * (t > 0.012)
    return x * e * 0.5
def hat(open_=False):
    d = 0.18 if open_ else 0.04; n = int(SR * d); t = np.arange(n) / SR
    return band(noise(n), 7000, 16000) * np.exp(-t * (14 if open_ else 80)) * 0.35
nbeats = int(DUR / BEAT) + 1
for b in range(nbeats):
    tb = OFF + b * BEAT
    L = level(tb)
    if L == 0: continue
    bar = b // 4; bi = b % 4
    root, arp = PROG[bar % 4]
    if L in (2, 3, 5) or bi == 0: music.add(tb, kick(), 0.9 if L != 1 else 0.6)
    if L in (3, 5) and bi in (1, 3): music.add(tb, clap(), 0.7, 0.1)
    for h in range(2): music.add(tb + h * BEAT / 2, hat(open_=(h == 1 and L >= 3)), 0.4, 0.35)
    if L in (2, 3, 5):
        for h in range(2):
            x = band(note_sq(root + (12 if h else 0), BEAT / 2 * 0.9, 0.5, 0.003, 0.12, 0.5), 0, 1800)
            music.add(tb + h * BEAT / 2, x, 0.34)
    for h in range(4):
        m = arp[(b * 4 + h) % 4] + (12 if L == 5 and h == 3 else 0)
        music.add(tb + h * BEAT / 4, note_sq(m, BEAT / 4 * 0.8, 0.125, 0.002, 0.06, 0.2), 0.10, -0.3 if h % 2 else 0.3)
    if bi == 0:
        t_ = tt(BAR)
        pad = sum(saw(mtof(m - 12) * (1 + d), t_) for m in arp[:3] for d in (-0.004, 0.004))
        pad = band(pad, 0, 1400) * env_ad(len(t_), 0.25, BAR, 1)
        music.add(tb, pad, 0.035)
    if L == 5:
        mel = HOOK[bar % 4]
        for h in range(2):
            m = mel[(bi * 2 + h) % 8]
            if m is None: continue
            x = note_sq(m + 12, BEAT / 2 * 0.85, 0.5, 0.004, 0.2, 0.45)
            music.add(tb + h * BEAT / 2, x, 0.10); music.add(tb + h * BEAT / 2 + BEAT * 0.75, x, 0.035, 0.5)
music.add(END_HIT, s_crash(2.0), 0.7)
t_ = tt(2.5)
music.add(DUR - 1.2, sum(tri(mtof(m), t_) for m in (60, 64, 67, 72, 76)) * np.exp(-t_ * 1.5) * 0.08, 1.0)

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
mg = 1 - 0.7 * duck
write(os.path.join(ROOT, "out", "mix.wav"), music.L * mg * 0.45 + sfx.L * (1 - 0.4 * duck) * 0.5 + voice.L,
      music.R * mg * 0.45 + sfx.R * (1 - 0.4 * duck) * 0.5 + voice.R)
# music + SFX only, for re-voicing in CapCut / Douyin's own TTS
write(os.path.join(ROOT, "out", "mix_novoice.wav"), music.L * 0.8 + sfx.L * 0.7, music.R * 0.8 + sfx.R * 0.7)
print("wrote out/mix.wav, out/mix_novoice.wav", DUR, "s")
