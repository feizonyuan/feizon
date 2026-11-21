"""Voice post-processing + timeline + music + SFX + mix.
Inputs : script.json, audio/raw/lines/*.wav (from tts.py)
Outputs: audio/voice/*.wav, timeline.json, src/data.js (timeline + lip-sync envelopes), audio/mix.wav"""
import json, os, re, subprocess, sys
import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
S = json.load(open(os.path.join(ROOT, "script.json")))
RAW = os.path.join(ROOT, "audio", "raw", "lines")
VOX = os.path.join(ROOT, "audio", "voice"); os.makedirs(VOX, exist_ok=True)
rng = np.random.default_rng(7)

def ff(*a): subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)
def read(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()

# ---------------------------------------------------------------- voices
SHIFT = {"Shiba": -2.2, "Hammy": 7.0}       # semitones; raw takes are steady (Shiba male ~110-140 Hz)
TEMPO = {"Shiba": 0.97, "Hammy": 1.10}
EQ = {"Shiba": "bass=g=3:f=140,treble=g=-2:f=6000",            # warm, round
      "Hammy": "highpass=f=180,equalizer=f=4800:t=q:w=1.2:g=-4,equalizer=f=8000:t=q:w=1:g=-2"}              # small, bright

def shape(src, dst, who, tempo=None, eq=None):
    r = 2 ** (SHIFT[who] / 12)
    t = tempo or TEMPO[who]
    ff("-i", src, "-af", f"rubberband=pitch={r:.4f}:tempo={t:.4f}:formant=shifted:pitchq=quality,{eq or EQ[who]},"
       "acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", str(SR), "-ac", "1", dst)
    return r

ratios = {}
for l in S["lines"]:
    src = os.path.join(RAW, l.get("reuse", l["id"]) + ".wav")
    ratios[l["id"]] = shape(src, os.path.join(VOX, l["id"] + ".wav"), l["who"])

# rap: split the single take on its 3 longest pauses, then shape each phrase
take = os.path.join(RAW, "rap_take.wav")
out = subprocess.run(["ffmpeg", "-i", take, "-af", "silencedetect=n=-38dB:d=0.12", "-f", "null", "-"], capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", out)]; en = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", out)]
D = len(read(take)) / SR
# choose the 3 pauses whose split best matches each phrase's syllable count
import itertools
gaps = [(s, e) for s, e in zip(st, en) if 0.3 < s and e < D - 0.2 and e - s > 0.3]
syl = np.array([7, 8, 5, 10], float); syl /= syl.sum()
def speech(a, b): return (b - a) - sum(max(0, min(e, b) - max(s, a)) for s, e in gaps)
best = min(itertools.combinations(gaps, 3), key=lambda c: (lambda b: sum((speech(b[i], b[i+1]) / speech(0, D) - syl[i]) ** 2 for i in range(4)))([0] + [(s + e) / 2 for s, e in c] + [D]))
cuts = [0] + [(s + e) / 2 for s, e in best] + [D]
print("rap cuts", [round(c, 2) for c in cuts])
for i, r in enumerate(S["rap"]):
    tmp = os.path.join(VOX, r["id"] + "_cut.wav")
    ff("-i", take, "-ss", f"{cuts[i]:.3f}", "-to", f"{cuts[i+1]:.3f}", "-af",
       "silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse", tmp)
    shape(tmp, os.path.join(VOX, r["id"] + ".wav"), "Shiba", 1.0, "highpass=f=110,equalizer=f=2600:t=q:w=1:g=4,bass=g=-2:f=120"); os.remove(tmp)

vox = {k[:-4]: read(os.path.join(VOX, k)) for k in os.listdir(VOX) if k.endswith(".wav")}
dur = {k: len(v) / SR for k, v in vox.items()}

# ---------------------------------------------------------------- timeline
BPM = 96.0; BEAT = 60 / BPM; BAR = 4 * BEAT
GAP = {"l01": 0.45, "l02": 0.35, "l15": 0.55}
events, t = [], 0.9                       # 0.9 s establishing push-in
for l in S["lines"]:
    events.append(dict(id=l["id"], who=l["who"], start=round(t, 3), end=round(t + dur[l["id"]], 3), zh=l["zh"], fg=l["fg"], say=l["say"], chunks=l.get("chunks")))
    t += dur[l["id"]] + GAP.get(l["id"], 0.22 if l["id"] in ("l03", "l04", "l05", "l06", "l07", "l08", "l09", "l10") else 0.3)
scratch = t - 0.1                         # record scratch right after the challenge
drop = np.ceil((t + 0.35) / BAR) * BAR    # beat drop on the next bar line
rap_start = drop + BAR                    # one bar of groove, then 4 bars of rap
raps = []
for i, r in enumerate(S["rap"]):
    s0 = rap_start + i * BAR
    # stretch each phrase to sit inside its bar (leave a beat of air at most)
    want = min(max(dur[r["id"]], 2.4 * BEAT), 3.6 * BEAT)
    raps.append(dict(id=r["id"], start=round(s0, 3), end=round(s0 + want, 3), say=r["say"], zh=r["zh"], stretch=round(dur[r["id"]] / want, 4)))
rap_end = rap_start + 4 * BAR
gag = rap_end + 0.25                      # hamster stuffs ~ten seeds
boing = gag + 2.6
end_card = boing + 0.5
total = round(end_card + 3.2, 2)

# re-render rap phrases at their fitted length
for r in raps:
    if abs(r["stretch"] - 1) > 0.01:
        p = os.path.join(VOX, r["id"] + ".wav"); tmp = p + ".tmp.wav"
        ff("-i", p, "-af", f"rubberband=tempo={r['stretch']:.4f}:pitchq=quality", tmp); os.replace(tmp, p)
        vox[r["id"]] = read(p)

N = int(total * SR) + SR
tracks = {"Shiba": np.zeros(N, np.float32), "Hammy": np.zeros(N, np.float32)}
def put(buf, x, t0, g=1.0):
    i = int(t0 * SR); n = min(len(x), len(buf) - i); buf[i:i + n] += g * x[:n]
for e in events: put(tracks[e["who"]], vox[e["id"]], e["start"])
for r in raps: put(tracks["Shiba"], vox[r["id"]], r["start"])

# ---------------------------------------------------------------- instruments
def env(n, a=0.003, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)
def lp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, "low", fs=SR, output="sos"), x)
def hp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi): return signal.sosfilt(signal.butter(2, [lo, hi], "band", fs=SR, output="sos"), x)
def hz(m): return 440 * 2 ** ((m - 69) / 12)

def pluck(freq, dur=1.4, bright=0.5):          # Karplus-Strong nylon string
    n = int(dur * SR); P = int(SR / freq); y = np.zeros(n + P)
    y[:P] = lp(rng.uniform(-1, 1, P), 1500 + 5000 * bright)
    k = P
    while k < n + P:
        m = min(P, n + P - k)
        prev = y[k - P:k - P + m]; prev2 = y[k - P - 1:k - P - 1 + m] if k - P - 1 >= 0 else np.concatenate([[0], prev[:-1]])
        y[k:k + m] = 0.996 * 0.5 * (prev + prev2[:m]); k += m
    out = y[P:]
    return lp(out, 4200) * env(n, 0.001, dur * 0.6)
def kick(n=0.35):
    t = np.arange(int(n * SR)) / SR
    f = 46 + 110 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16) * 1.0
def snare(n=0.18):
    t = np.arange(int(n * SR)) / SR
    noise = bp(rng.uniform(-1, 1, len(t)), 900, 7000) * np.exp(-t / 0.05)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03)
    return 0.7 * noise + 0.35 * tone
def hat(n=0.05, o=False):
    t = np.arange(int((0.18 if o else n) * SR)) / SR
    return hp(rng.uniform(-1, 1, len(t)), 7000) * np.exp(-t / (0.06 if o else 0.012)) * 0.35
def shaker():
    t = np.arange(int(0.09 * SR)) / SR
    return bp(rng.uniform(-1, 1, len(t)), 4000, 11000) * np.sin(np.pi * t / t[-1]) ** 2 * 0.25
def bass(freq, n):
    t = np.arange(int(n * SR)) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.35 * signal.sawtooth(2 * np.pi * freq * t)
    return lp(x, 600) * env(len(t), 0.005, n * 0.7) * 0.8
def stab(freqs, n=0.22):
    t = np.arange(int(n * SR)) / SR
    x = sum(signal.sawtooth(2 * np.pi * f * d * t) for f in freqs for d in (0.997, 1.003))
    return lp(x / (2 * len(freqs)), 2600) * env(len(t), 0.004, 0.09)

# Andalusian cadence Am - G - F - E (one chord per bar)
CH = [[57, 60, 64, 69], [55, 59, 62, 67], [53, 57, 60, 65], [52, 56, 59, 64]]
ROOTS = [45, 43, 41, 40]
music = np.zeros(N, np.float32)
def mput(x, t0, g):
    put(music, x.astype(np.float32), t0, g)

# section A: soft fingerpicked guitar + shaker, from 0 to drop
nb = int(drop / BAR)
for b in range(nb):
    c = CH[b % 4]; t0 = b * BAR
    pattern = [c[0] - 12, c[2], c[1], c[3], c[2], c[1], c[3], c[2]]
    for k, m in enumerate(pattern):
        mput(pluck(hz(m), 1.3, 0.35 + 0.1 * (k == 0)), t0 + k * BEAT / 2, 0.30 if k else 0.4)
    for k in range(8):
        mput(shaker(), t0 + k * BEAT / 2 + (0.02 if k % 2 else 0), 0.5 if k % 2 else 0.3)
    if b % 2 == 1: mput(kick(0.25), t0, 0.25)
# scratch -> silence gap until drop is handled by SFX; fade section A out before drop
fade_i0, fade_i1 = int(scratch * SR), int((scratch + 0.15) * SR)
music[fade_i0:fade_i1] *= np.linspace(1, 0, fade_i1 - fade_i0)
music[fade_i1:int(drop * SR)] = 0

# section B: reggaeton dembow, drop -> rap_end + 1 bar tail
nbB = int(round((rap_end - drop) / BAR))
for b in range(nbB):
    t0 = drop + b * BAR; c = CH[b % 4]; rt = ROOTS[b % 4]
    for half in (0, 2):
        h0 = t0 + half * BEAT
        mput(kick(), h0, 0.9); mput(kick(), h0 + BEAT, 0.9)
        mput(snare(), h0 + 0.75 * BEAT, 0.55); mput(snare(), h0 + 1.5 * BEAT, 0.55)
    for k in range(8): mput(hat(o=(k % 4 == 3)), t0 + k * BEAT / 2, 0.8)
    for k, (o, l) in enumerate([(0, 0.7), (0.75, 0.25), (1.5, 0.45), (2, 0.7), (2.75, 0.25), (3.5, 0.45)]):
        mput(bass(hz(rt), l * BEAT * 1.3), t0 + o * BEAT, 0.55)
    for o in (0.75, 1.5, 2.75, 3.5):
        mput(stab([hz(m) for m in c[1:]], 0.2), t0 + o * BEAT, 0.20)
    # flamenco-ish guitar strum on the downbeat
    for j, m in enumerate(c): mput(pluck(hz(m), 1.2, 0.6), t0 + j * 0.012, 0.22)
# final hit
mput(kick(0.5), rap_end, 1.0); mput(stab([hz(m) for m in [57, 60, 64, 69]], 0.6), rap_end, 0.35)
for j, m in enumerate([45, 57, 60, 64, 69]): mput(pluck(hz(m), 2.5, 0.7), rap_end + j * 0.015, 0.3)

# outro: gentle guitar under the gag + end card
for k, m in enumerate([69, 72, 76, 81, 76, 72, 69, 64]):
    mput(pluck(hz(m), 1.6, 0.4), end_card - 0.2 + k * BEAT / 2, 0.22)

# ---------------------------------------------------------------- SFX
sfx = np.zeros(N, np.float32)
def sput(x, t0, g=1.0): put(sfx, x.astype(np.float32), t0, g)
def sweep(f0_, f1, n, shape_=np.sin):
    t = np.arange(int(n * SR)) / SR
    f = f0_ * (f1 / f0_) ** (t / n)
    return shape_(2 * np.pi * np.cumsum(f) / SR)
def boing_fx(n=0.7):
    t = np.arange(int(n * SR)) / SR
    f = 180 + 260 * np.exp(-t / 0.25) * (1 + 0.35 * np.sin(2 * np.pi * 14 * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.25) * 0.8
def pop(n=0.09, f=900):
    return sweep(f, f * 0.4, n) * env(int(n * SR), 0.001, 0.03) * 0.5
def scratch_fx(n=0.55):
    t = np.arange(int(n * SR)) / SR
    rate = 1 + 0.9 * np.sin(2 * np.pi * 3.2 * t)            # back-and-forth platter
    ph = np.cumsum(rate) / SR
    tone = np.sin(2 * np.pi * 300 * ph * (1 + 0.5 * np.sin(2 * np.pi * 7 * ph)))
    noise = bp(rng.uniform(-1, 1, len(t)), 800, 5000)
    return (0.6 * tone + 0.5 * noise * np.abs(rate - 1)) * env(len(t), 0.005, 0.3)
def munch(n=0.07):
    t = np.arange(int(n * SR)) / SR
    return bp(rng.uniform(-1, 1, len(t)), 1500, 6000) * env(len(t), 0.001, 0.015) * 0.6
def whoosh(n=0.6):
    t = np.arange(int(n * SR)) / SR
    x = rng.uniform(-1, 1, len(t)); y = np.zeros_like(x)
    for i, (lo, hi) in enumerate([(300, 900), (900, 2500), (2500, 6000)]):
        y += bp(x, lo, hi) * np.sin(np.pi * np.clip(t / n * 3 - i, 0, 1)) ** 2
    return y * 0.35
def ding(f=1320, n=1.2):
    t = np.arange(int(n * SR)) / SR
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t)) * env(len(t), 0.001, 0.35) * 0.25

sput(whoosh(0.8), 0.0, 0.5)                         # establishing push-in
sput(scratch_fx(), scratch, 0.6)
sput(whoosh(), drop - 0.55, 0.6)                    # ring of text flies in
seeds = [gag + 0.25 + i * 0.2 for i in range(10)]   # ~ten seeds, "como diez"
for i, s0 in enumerate(seeds):
    sput(pop(0.08, 700 + 60 * i), s0, 0.5); sput(munch(), s0 + 0.06, 0.6)
sput(boing_fx(), boing, 0.9)
sput(ding(), end_card + 0.1, 0.8)
# quick-fire: a soft tick on each Shiba "como" answer for rhythm
for e in events:
    if e["id"] in ("l03", "l05", "l07", "l09", "l11"): sput(pop(0.05, 1600), e["start"] - 0.02, 0.18)

# ---------------------------------------------------------------- mix
voice = tracks["Shiba"] + tracks["Hammy"]
venv = np.abs(signal.hilbert(voice[: len(voice) // 4096 * 4096])) if False else None
# sidechain duck: smooth voice envelope
a = np.abs(voice); k = int(0.08 * SR)
sm = np.convolve(a, np.ones(k) / k, "same")
duck = 1 - 0.55 * np.clip(sm / 0.05, 0, 1)
sect_b = (np.arange(N) / SR >= drop) & (np.arange(N) / SR < rap_end + 0.3)
duck = np.where(sect_b, 1 - 0.45 * np.clip(sm / 0.05, 0, 1), duck)
music_g = np.where(sect_b, 0.36, 0.42)
mb = hp(music, 70)                                   # keep the kick, trim mud below it
vocal_hole = signal.sosfilt(signal.butter(2, [180, 1200], "band", fs=SR, output="sos"), mb)
music = np.where(sect_b, mb - 0.5 * vocal_hole * np.clip(sm / 0.05, 0, 1), music)
mix = voice * 1.0 + music * music_g * duck + sfx * 0.9
mix = mix[: int(total * SR)]
mix = mix / max(1e-6, np.abs(mix).max()) * 0.95
pcm = (mix * 32767).astype(np.int16)
tmpw = os.path.join(ROOT, "audio", "mix_raw.wav")
import wave
with wave.open(tmpw, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
ff("-i", tmpw, "-af", "loudnorm=I=-14:TP=-1:LRA=9", "-ar", str(SR), "-ac", "2", os.path.join(ROOT, "audio", "mix.wav"))
os.remove(tmpw)

# ---------------------------------------------------------------- lip-sync envelopes (60 Hz)
FPS_ENV = 60
def envelope(x):
    hop = SR // FPS_ENV
    n = len(x) // hop
    r = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1))
    r = np.clip(r / 0.12, 0, 1) ** 0.7
    return [round(float(v), 3) for v in r]
tl = dict(fps=30, duration=total, bpm=BPM, beat=BEAT, bar=BAR, establish=0.9, scratch=round(scratch, 3), drop=round(drop, 3),
          rap_start=round(rap_start, 3), rap_end=round(rap_end, 3), gag=round(gag, 3), seeds=[round(s, 3) for s in seeds],
          boing=round(boing, 3), end_card=round(end_card, 3), lines=events, rap=raps,
          ring_text=" · ".join(r["say"] for r in S["rap"]))
json.dump(tl, open(os.path.join(ROOT, "timeline.json"), "w"), ensure_ascii=False, indent=1)
data = dict(tl=tl, env={k: envelope(v) for k, v in tracks.items()}, envFps=FPS_ENV)
open(os.path.join(ROOT, "src", "data.js"), "w").write("window.DATA = " + json.dumps(data, ensure_ascii=False) + ";\n")
print(json.dumps({k: tl[k] for k in ("duration", "drop", "rap_start", "rap_end", "gag", "boing", "end_card")}))
print("pitch ratios", {k: round(v, 2) for k, v in ratios.items()})
print("rap", [(r["id"], r["stretch"]) for r in raps])
