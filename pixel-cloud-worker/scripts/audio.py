"""Synthesize the chiptune BGM + all SFX from timeline.json, then mix with the voice-over.
Output: out/mix.wav (48 kHz stereo). Pure numpy, no samples, no external assets."""
import json, os, wave
import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "timeline.json")))
EV = TL["events"]
DUR = TL["duration"]
N = int(SR * DUR)
rng = np.random.default_rng(7)

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

sfx = Track()
def at(t, x, g=1.0, pan=0.0): sfx.add(t, x, g, pan)

# 1 boot
for i in range(15): at(EV["termType"][0] + i * (EV["termType"][1] - EV["termType"][0]) / 15, s_click(3000), 0.35, -0.5)
for i in range(19): at(1.4 + i * 0.6 / 19, s_click(2800), 0.3, -0.5)
at(0.0, s_sweep(40, 90, 1.6, sine, 0.25))
at(EV["ding"], s_bell(), 0.9)
at(EV["cloudForm"], s_whoosh(0.8, 200, 3000, None), 0.5)
at(EV["containerDrop"], s_sweep(1400, 300, 0.5, sine, 0.25))
at(EV["containerLand"], s_clang(150, 1.6), 1.0); at(EV["containerLand"], s_boom(1.2), 0.9)
for i, m in enumerate([81, 84, 88]): at(3.3 + i * 0.3, s_blip(m, 0.12), 0.8, -0.4 + i * 0.4)
# 2 wake
at(EV["doorOpen"], s_hiss(0.8), 0.7); at(EV["doorOpen"], s_sweep(90, 200, 0.45, square, 0.12))
at(EV["eyesOn"], s_sweep(200, 1400, 0.45, square, 0.15))
for i in range(5): at(EV["eyesOn"] + i * 0.07, s_blip(96 - i * 2, 0.03), 0.5)
at(EV["hop"], s_boing(220, 0.45), 0.9); at(EV["hopLand"], s_thud(), 0.8)
at(EV["bubbleIn"], s_whoosh(0.35, 800, 6000, True), 0.6); at(EV["bubbleIn"] + 0.35, s_pop(700), 0.8)
for i in range(10): at(EV["bubbleIn"] + 0.4 + i * 0.1, s_blip(88 + (i % 3) * 2, 0.04, 0.5), 0.45, -0.3)
at(EV["exclaim"], s_blip(84, 0.08), 0.8); at(EV["exclaim"] + 0.08, s_blip(91, 0.12), 0.8)
at(EV["salute"], s_chime_up((84, 88, 91, 96)), 1.0); at(EV["salute"], s_crackle(0.6, 30), 0.4)
# 3 clone
at(EV["pipeDown"], s_whoosh(0.5, 200, 2500, True), 0.6)
at(EV["pipeClank"], s_clang(330, 0.9), 0.8, 0.5)
for i, tg in enumerate(EV["tugs"]):
    at(tg - 0.05, s_creak(0.45), 1.0, 0.2); at(tg, s_boing(110 + i * 25, 0.3), 0.5); at(tg, s_thud(0.15), 0.4)
at(EV["cratePop"] - 0.35, s_sweep(100, 500, 0.35, square, 0.12), 1, 0.5)
at(EV["cratePop"], s_pop(400, 0.15), 1.0, 0.4); at(EV["cratePop"] + 0.45, s_thud(0.4), 1.0, 0.3)
at(EV["crateBurst"], s_boom(0.6, 200, 60, 0.6), 0.8); at(EV["crateBurst"], s_crackle(1.0, 80), 0.5)
at(EV["crateBurst"] + 0.3, s_chime_up((79, 84, 88, 91, 96), 0.05), 0.9)
at(18.95, s_whoosh(0.45, 80, 2500, True), 0.8); at(19.4, s_boom(0.6, 90, 40, 0.5), 0.8)
# 4 code
t = EV["typing"][0]
while t < EV["typing"][1]:
    at(t, s_click(rng.uniform(1800, 3200), 0.015), rng.uniform(0.25, 0.5), rng.uniform(-0.6, 0.0))
    t += rng.uniform(0.035, 0.075) * (1 - 0.5 * (t - EV["typing"][0]) / 4.6)
for st in EV["sparks"]: at(st, s_zap(0.25), 0.7, -0.3); at(st, s_crackle(0.3, 50), 0.4, -0.3)
at(EV["miniRobot"], s_sweep(300, 1200, 0.15, square, 0.12), 1, 0.4); at(EV["miniRobot"] + 0.12, s_chime_up((84, 91, 96), 0.05), 0.7, 0.4)
at(EV["sparks"][4], s_hiss(1.2, 0.35), 1.0, -0.2)
at(EV["zoomIn"] - 0.1, s_whoosh(0.8, 300, 8000, True), 1.0)
at(25.55, s_sweep(800, 3000, 0.25, sine, 0.25))
# 5 camera
# HEADLESS letters rise, then the HEAD gets sliced off and drops
at(25.65, s_whoosh(0.45, 400, 6000, True), 0.6)
for i in range(8): at(25.7 + i * 0.04 + 0.12, s_click(2200 + i * 150, 0.015), 0.5, -0.5 + i * 0.14)
at(27.18, s_sweep(1800, 7000, 0.14, sine, 0.15), 1.0); at(27.3, s_whoosh(0.25, 3000, 12000, None), 0.9)
at(27.3, s_click(5000, 0.02), 1.0)
for i in range(4): at(27.62 + i * 0.07, s_thud(0.25), 0.7, -0.4 + i * 0.1)
at(27.75, s_boing(320, 0.5), 0.7, 0.4); at(27.75, s_pop(1100), 0.6, 0.4)
for i, s in enumerate(EV["snaps"]):
    at(s, s_shutter(), 1.0, 0.25); at(s + 0.02, s_sweep(2000, 5000, 0.12, sine, 0.06), 1.0, 0.25)
    at(s + 0.05, s_whoosh(0.3, 2000, 9000, None), 0.18, 0.6)
# 6 ffmpeg
at(EV["conveyor"], s_rumble(1.4, 0.18) * np.sin(np.linspace(0, np.pi, int(SR * 1.4))), 1.0, -0.5)
for i, p in enumerate(EV["presses"]):
    at(p - 0.25, s_hiss(0.25, 0.4), 1.0)
    at(p, s_clang(110 + i * 20, 1.4, 1.2), 1.0); at(p, s_boom(0.9, 120, 40), 1.0)
    at(p + 0.1, s_hiss(0.6, 0.4), 0.8)
at(EV["reelOut"], s_pop(600, 0.12), 0.8); at(EV["reelOut"] + 0.05, s_chime_up((76, 81, 84, 88), 0.05), 0.8)
at(EV["audioZap"] - 0.35, s_sweep(200, 3000, 0.35, sine, 0.25), 1, -0.6); at(EV["audioZap"], s_zap(0.4), 0.8)
at(EV["audioZap"], s_bell((1046, 1568, 2093), 1.0), 0.6)
# 7 push
at(EV["reelLoad"], s_whoosh(0.35, 500, 5000, None), 0.6); at(EV["reelLoad"] + 0.35, s_clang(600, 0.4), 0.5, 0.4)
for c in EV["countdown"]: at(c, s_blip(81, 0.18, 0.5), 0.9)
at(EV["countdown"][-1] + 0.6, s_blip(93, 0.25, 0.5), 0.9)
riser_d = EV["liftoff"] - EV["countdown"][0]
at(EV["countdown"][0], s_whoosh(riser_d, 400, 8000, True), 0.5)
at(EV["countdown"][0], s_sweep(100, 800, riser_d, saw, 0.06))
at(EV["ignite"], s_click(1500, 0.03), 1.0, -0.3); at(EV["ignite"], s_pop(300, 0.1), 0.8, -0.3)
ign = s_rumble(EV["liftoff"] - EV["ignite"] + 0.2, 0.5) * np.linspace(0.2, 1, int(SR * (EV["liftoff"] - EV["ignite"] + 0.2)))
at(EV["ignite"], ign, 1.0, 0.2)
at(EV["liftoff"], s_boom(1.5, 90, 30, 1.2), 1.0)
roar_d = EV["rocketHit"] - EV["liftoff"]
roar = band(noise(int(SR * roar_d)), 40, 2500) * np.linspace(1, 0.5, int(SR * roar_d)) * 0.8
roar += band(noise(int(SR * roar_d)), 2000, 9000) * np.linspace(0.1, 0.4, int(SR * roar_d)) * 0.5
at(EV["liftoff"], roar, 0.9)
at(EV["liftoff"] + 0.5, s_sweep(200, 1600, roar_d - 0.5, saw, 0.04))
# 8 finale
at(EV["rocketHit"], s_boom(2.0, 120, 30, 1.3), 1.0); at(EV["rocketHit"], s_crash(2.5), 1.0)
at(EV["bigBurst"], s_bell((523, 784, 1046, 1568, 2093), 2.5), 0.9); at(EV["bigBurst"], s_crackle(1.5, 70), 0.6)
for i, (ft, fx) in enumerate([(45.9, -0.6), (46.5, 0.6), (47.1, -0.3), (47.7, 0.4), (48.3, 0.0), (48.8, -0.7), (49.2, 0.7)]):
    at(ft - 0.4, s_sweep(600, 2400, 0.4, sine, 0.05), 1, fx)
    at(ft, s_pop(200, 0.2), 0.8, fx); at(ft, s_crackle(1.0, 40), 0.35, fx)
for i in range(18): at(EV["title"] + i * 0.05, s_blip(84 + [0, 4, 7, 12][i % 4], 0.05), 0.3)
at(EV["wave"], s_chime_up((88, 84, 88, 91), 0.1, 0.5), 0.7)
for i, lo in enumerate(EV["lightsOff"]):
    at(lo, s_click(900, 0.03), 1.0, -0.4 + i * 0.4); at(lo + 0.02, s_blip(76 - i * 4, 0.12, 0.5), 0.6, -0.4 + i * 0.4)
at(52.8, s_sweep(500, 250, 0.6, tri, 0.12))  # yawn
at(53.8, s_boing(200, 0.35), 0.6); at(54.3, s_clang(260, 0.5, 0.5), 0.6); at(54.3, s_thud(0.2), 0.6)
at(EV["antennaFade"], s_sweep(1200, 80, 0.9, square, 0.1))
at(EV["endCard"] + 0.1, s_bell((523, 659, 784, 1175, 1568), 2.5), 0.7)

# ---------------------------------------------------------------- BGM
BPM = 128.0; BEAT = 60 / BPM; OFF = 0.0925; BAR = BEAT * 4
PROG = [  # (bass root, arp notes)
    (36, [72, 76, 79, 84]), (43, [71, 74, 79, 83]), (45, [69, 72, 76, 81]), (41, [69, 72, 77, 81])]
HOOK = [[79, None, 76, 79, 81, 79, 76, 72], [74, None, 71, 74, 79, None, 74, None],
        [76, None, 72, 76, 81, 79, 76, None], [77, 76, 74, 72, 74, None, None, None]]
music = Track()
def on(t, a, b): return a <= t < b
def level(t):
    if t < 1.0: return 0
    if t < 6.4: return 1         # intro
    if t < 13.2: return 2        # groove
    if t < 38.8: return 3        # full
    if t < EV["liftoff"]: return 4  # countdown breakdown
    if t < 49.6: return 5        # drop / finale
    if t < 52.8: return 6        # outro
    return 0

def note_sq(m, d, duty=0.25, a=0.004, dec=0.15, sus=0.3):
    t = tt(d); return square(mtof(m), t, duty) * env_ad(len(t), a, dec, sus)
def kick():
    t = tt(0.22); f = 45 + 140 * np.exp(-t * 30)
    return np.tanh(sine(f, t) * np.exp(-t * 14) * 2.2) * 0.9
def clap():
    n = int(SR * 0.18); t = np.arange(n) / SR
    x = band(noise(n), 900, 5000)
    e = np.exp(-t * 25) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) * 25) * (t > 0.012) + 0.5 * np.exp(-np.maximum(t - 0.024, 0) * 18) * (t > 0.024)
    return x * e * 0.5
def hat(open_=False):
    d = 0.18 if open_ else 0.04; n = int(SR * d); t = np.arange(n) / SR
    return band(noise(n), 7000, 16000) * np.exp(-t * (14 if open_ else 80)) * 0.35

nbeats = int((DUR - OFF) / BEAT) + 1
for b in range(nbeats):
    tb = OFF + b * BEAT
    L = level(tb)
    if L == 0: continue
    bar = int((tb - OFF) // BAR); beat_in_bar = b % 4
    root, arp = PROG[bar % 4]
    # drums
    if L in (2, 3, 5) or (L == 6 and beat_in_bar in (0, 2)):
        music.add(tb, kick(), 0.95)
    if L == 4 and beat_in_bar == 0: music.add(tb, kick(), 0.6)
    if L in (3, 5) and beat_in_bar in (1, 3): music.add(tb, clap(), 0.8, 0.1)
    if L in (1, 2, 3, 5, 6):
        for h in range(2 if L != 3 or tb < 25.6 or tb > 32.4 else 4):
            sub = BEAT / (2 if L != 3 or tb < 25.6 or tb > 32.4 else 4)
            music.add(tb + h * sub, hat(open_=(h % 2 == 1 and L >= 2 and sub > 0.2)), 0.5 if L > 1 else 0.3, 0.35)
    # bass (8ths, octave bounce)
    if L in (2, 3, 5, 6):
        for h in range(2):
            m = root + (12 if h == 1 else 0)
            x = note_sq(m, BEAT / 2 * 0.9, 0.5, 0.003, 0.12, 0.5)
            x = band(x, 0, 1800)
            music.add(tb + h * BEAT / 2, x, 0.38)
    # arpeggio (16ths)
    if L in (1, 2, 3, 4, 5, 6):
        for h in range(4):
            m = arp[(b * 4 + h) % 4] + (12 if L in (3, 5) and h == 3 else 0)
            g = {1: 0.10, 2: 0.13, 3: 0.12, 4: 0.12, 5: 0.13, 6: 0.10}[L]
            music.add(tb + h * BEAT / 4, note_sq(m, BEAT / 4 * 0.8, 0.125, 0.002, 0.06, 0.2), g, -0.3 if h % 2 else 0.3)
    # pad (bar starts)
    if beat_in_bar == 0 and L in (1, 2, 3, 4, 5, 6):
        d = BAR; t_ = tt(d)
        pad = sum(saw(mtof(m - 12) * (1 + dt), t_) for m in arp[:3] for dt in (-0.004, 0.004))
        pad = band(pad, 0, 1400 if L != 4 else 900) * env_ad(len(t_), 0.25, d, 1) * np.linspace(1, 0.85, len(t_))
        music.add(tb, pad, {1: 0.05, 4: 0.07}.get(L, 0.035))
    # melody hook
    if (L == 3 and (13.2 <= tb < 25.6 or 32.4 <= tb < 38.8)) or L == 5:
        mel = HOOK[bar % 4]
        for h in range(2):
            m = mel[(beat_in_bar * 2 + h) % 8]
            if m is None: continue
            x = note_sq(m + 12, BEAT / 2 * 0.85, 0.5, 0.004, 0.2, 0.45)
            x *= 1 + 0.004 * np.sin(2 * np.pi * 6 * np.arange(len(x)) / SR)
            music.add(tb + h * BEAT / 2, x, 0.12, 0.0)
            music.add(tb + h * BEAT / 2 + BEAT * 0.75, x, 0.04, 0.5)  # echo
# finale crash + final chord after tape stop
music.add(EV["liftoff"], s_crash(2.0), 0.9)
music.add(EV["bigBurst"], s_crash(2.5), 0.8)

# tape-stop the music at the first lights-off
def tape_stop(ch, ts, d):
    i0, n = int(ts * SR), int(d * SR)
    u = np.arange(n) / SR
    pos = ts + u - u ** 2 / (2 * d)
    seg = np.interp(pos * SR, np.arange(len(ch)), ch) * np.linspace(1, 0, n) ** 0.5
    ch[i0:i0 + n] = seg; ch[i0 + n:] = 0
for ch in (music.L, music.R): tape_stop(ch, EV["lightsOff"][0], 1.2)
t_ = tt(3.0)
chord = sum(tri(mtof(m), t_) for m in (60, 64, 67, 72, 74)) * np.exp(-t_ * 1.2) * 0.06
music.add(EV["endCard"], chord, 1.0)

# ---------------------------------------------------------------- voice + mix
voice = Track()
vmask = np.zeros(len(voice.L))
dur = json.load(open(os.path.join(ROOT, "audio", "durations.json")))
for v in TL["voice"]:
    w = wave.open(os.path.join(ROOT, "audio", v["id"] + ".wav"))
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
    if w.getnchannels() == 2: x = x[::2]
    assert w.getframerate() == SR
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.85
    voice.add(v["at"], x, 1.0)
    i = int(v["at"] * SR); vmask[i:i + len(x)] = 1
# smooth ducking envelope
k = int(SR * 0.12)
duck = np.convolve(vmask, np.ones(k) / k, mode="same")
duck_gain = 1 - 0.5 * duck

mixL = music.L * duck_gain * 0.9 + sfx.L * (1 - 0.25 * duck) * 0.75 + voice.L * 1.0
mixR = music.R * duck_gain * 0.9 + sfx.R * (1 - 0.25 * duck) * 0.75 + voice.R * 1.0
mix = np.stack([mixL, mixR], 1)[:N]
# fades + soft limiter
fade = int(SR * 0.4); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix = mix / (np.percentile(np.abs(mix), 99.9) + 1e-9) * 0.8
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
out = os.path.join(ROOT, "out", "mix.wav"); os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
# stems for inspection
for name, tr in (("music", music), ("sfx", sfx)):
    s = np.stack([tr.L, tr.R], 1)[:N]; s = s / (np.max(np.abs(s)) + 1e-9) * 0.9
    with wave.open(os.path.join(ROOT, "out", f"stem_{name}.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((s * 32767).astype(np.int16).tobytes())
print("wrote", out, mix.shape[0] / SR, "s")
