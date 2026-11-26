"""Voice processing + beat-grid timeline + music + SFX + mix for "Perro, pero, pelo, pera".
Inputs : script.json, audio/raw/clips/*.wav (from tts.py)
Outputs: timeline.json, src/data.js (timeline + lip-sync envelopes), audio/mix.wav, audio/stems/*.wav
Everything sits on a 100 BPM grid: questions on beat 1, answers on beat 3, the verse one line
per bar, and the hook is built from the answer clips, re-timed to one word per beat and pitched
onto a melody (plus a channel-vocoder double for the sung sheen)."""
import json, os, subprocess, wave
import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
S = json.load(open(os.path.join(ROOT, "script.json")))
CLIPS = os.path.join(ROOT, "audio", "raw", "clips")
TMP = os.path.join(ROOT, "out", "vox"); os.makedirs(TMP, exist_ok=True)
rng = np.random.default_rng(7)

def ff(*a): subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)
def read(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def write(p, x, ch=1):
    x = np.clip(x, -1, 1)
    with wave.open(p, "wb") as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())

# ---------------------------------------------------------------- voices
CHAR = {"Shiba": -2.2, "Hammy": 7.0}          # semitones: deeper dog, cartoon hamster
TEMPO = {"Shiba": 0.97, "Hammy": 1.10}
EQ = {"Shiba": "bass=g=2:f=140,equalizer=f=2600:t=q:w=1:g=2",
      "Hammy": "highpass=f=180,equalizer=f=3500:t=q:w=1:g=-2.5,equalizer=f=4800:t=q:w=1.2:g=-4,equalizer=f=8000:t=q:w=1:g=-2"}
TRIM = "silenceremove=start_periods=1:start_threshold=-38dB,areverse,silenceremove=start_periods=1:start_threshold=-38dB,areverse"
_cache = {}
def voice(clip, who, fit=None, semis=0.0, tag=""):
    """Character pitch/EQ, optional melody shift (formant kept) and time-fit to `fit` seconds (only shortens)."""
    key = (clip, who, fit, semis)
    if key in _cache: return _cache[key]
    a = os.path.join(TMP, f"{clip}_{who}{tag}_a.wav")
    ff("-i", os.path.join(CLIPS, clip + ".wav"), "-af",
       f"{TRIM},rubberband=pitch={2 ** (CHAR[who] / 12):.5f}:tempo={TEMPO[who]:.4f}:formant=shifted:pitchq=quality,{EQ[who]},"
       "acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", str(SR), "-ac", "1", a)
    d = len(read(a)) / SR
    tempo = max(1.0, d / fit) if fit else 1.0
    if tempo > 1.001 or abs(semis) > 0.01:
        b = a.replace("_a.wav", f"_{semis:+.1f}_{fit}.wav")
        ff("-i", a, "-af", f"rubberband=pitch={2 ** (semis / 12):.5f}:tempo={tempo:.4f}:formant=preserved:pitchq=quality", b)
        a = b
    x = read(a)
    n = int(0.008 * SR); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n)
    _cache[key] = x
    return x

# ---------------------------------------------------------------- grid
BPM = 100.0; BEAT = 60 / BPM; BAR = 4 * BEAT; G0 = 0.55
bar = lambda b, beat=0.0: G0 + b * BAR + beat * BEAT
N = int(70 * SR)
tracks = {"Shiba": np.zeros(N, np.float32), "Hammy": np.zeros(N, np.float32)}
def put(buf, x, t0, g=1.0):
    i = int(round(t0 * SR)); n = min(len(x), len(buf) - i); buf[i:i + n] += g * x[:n]

lines = []
def line(clip, who, t0, fit=None, sub=None, **kw):
    x = voice(clip, who, fit); put(tracks[who], x, t0)
    zh, fg = sub or S["subs"][clip]
    lines.append(dict(id=clip, who=who, start=round(t0, 3), end=round(t0 + len(x) / SR, 3), zh=zh, fg=fg, **kw))
    return t0 + len(x) / SR

# intro + Q&A ---------------------------------------------------------------
line("l01", "Shiba", bar(0, 0.15), sub=S["subs"]["l01"])
line("h_dog", "Hammy", bar(1, 0.0))
answers = []
line("a_perro", "Shiba", bar(2, 0.0), fit=1.15); answers.append(bar(2, 0.0))
pairs = [("q_but", "a_pero"), ("q_fur", "a_pelo"), ("q_pear", "a_pera"), ("q_hill", "a_cerro"),
         ("q_iron", "a_hierro"), ("q_leek", "a_puerro"), ("q_mud", "a_barro")]
for i, (q, a) in enumerate(pairs):
    if i < 3:   # one pair per bar: question on beat 1, answer on beat 3
        b = 3 + i; tq, ta, fq, fa = bar(b, 0), bar(b, 2), 1.1, 1.15
    else:       # double time: two pairs per bar
        b = 6 + (i - 3) // 2; o = 2 * ((i - 3) % 2); tq, ta, fq, fa = bar(b, o), bar(b, o + 1), 0.58, 0.62
    line(q, "Hammy", tq, fit=fq, shot="two" if i >= 3 else None)
    line(a, "Shiba", ta, fit=fa, shot="two" if i >= 3 else None); answers.append(ta)

# challenge -------------------------------------------------------------------
ch_start = bar(8, 0.0)
xch = voice("h_challenge", "Hammy"); put(tracks["Hammy"], xch, ch_start)
ch_end = ch_start + len(xch) / SR
chunks = [{"zh": z, "fg": f} for z, f in S["challenge_chunks"]]
lines.append(dict(id="h_challenge", who="Hammy", start=round(ch_start, 3), end=round(ch_end, 3), zh=chunks[0]["zh"], fg=chunks[0]["fg"], chunks=chunks))
drop_bar = int(np.ceil((ch_end + 0.9 - G0) / BAR))
drop = bar(drop_bar); scratch = ch_end + 0.1

# verse: one line per bar, Hammy echoes the last word on beat 4 -----------------
verse, adlibs = [], []
echo = {"v1": "k_cerro", "v2": "k_hierro", "v4": "k_barro"}
for i, v in enumerate(S["verse"]):
    t0 = bar(drop_bar + i)
    x = voice(v["id"], "Shiba", fit=1.95, tag="v"); put(tracks["Shiba"], x, t0, 1.05)
    verse.append(dict(id=v["id"], start=round(t0, 3), end=round(t0 + len(x) / SR, 3), say=v["say"], zh=v["zh"]))
    if v["id"] in echo:
        te = bar(drop_bar + i, 3.15); y = voice(echo[v["id"]], "Hammy", fit=0.55, tag="e"); put(tracks["Hammy"], y, te, 0.8)
        adlibs.append(dict(start=round(te, 3), end=round(te + len(y) / SR, 3), word="¡" + v["say"].rstrip(",.").split()[-1] + "!"))

# hook: one word per beat, pitched onto the melody -----------------------------
hook_bar = drop_bar + 4
MEL = {"Shiba": [48, 47, 45, 44], "Hammy": [64, 62, 60, 59]}   # C B | A G#   and   E D | C B
BASE = {"Shiba": 45, "Hammy": 64}
CL = {"Shiba": ["a_perro", "a_pero", "a_pelo", "a_pera"], "Hammy": ["k_cerro", "k_hierro", "k_puerro", "k_barro"]}
CL_BOTH = {"Shiba": ["a_cerro", "a_hierro", "a_puerro", "a_barro"], "Hammy": CL["Hammy"]}
vocoder_notes = []                       # (t0, dur, midi, who)
hook = []
for h, hk in enumerate(S["hook"]):
    b0 = bar(hook_bar + h); whos = ["Shiba", "Hammy"] if hk["who"] == "Both" else [hk["who"]]
    words = []
    for k in range(4):
        tw = b0 + k * BEAT
        for w in whos:
            clip = (CL_BOTH if hk["who"] == "Both" else CL)[w][k]
            if hk["who"] == "Both": mel = MEL["Hammy"][k] - (12 if w == "Shiba" else 0)   # unison, Shiba an octave down
            else: mel = MEL[w][k]
            x = voice(clip, w, fit=0.56, semis=float(np.clip(mel - BASE[w], -7, 7))); put(tracks[w], x, tw, 1.0)
            vocoder_notes.append((tw, len(x) / SR, mel + 12, w, x))
        words.append(dict(w=hk["words"][k], zh=hk["zh"][k], t=round(tw, 3)))
    hook.append(dict(who=hk["who"], start=round(b0, 3), words=words))
hook_end = bar(hook_bar + 4)

# ending -----------------------------------------------------------------------
t = hook_end + 0.55
t = line("e_donkey", "Hammy", t) + 0.35
burro_t = t; t = line("e_burro", "Shiba", t) + 0.85
turn_t = t - 0.45
tu_t = t; t = line("e_tu", "Shiba", t) + 0.25
puff_t = t
t = line("e_oye", "Hammy", t + 0.15)
boing = t + 0.05
end_card = boing + 0.75
total = round(end_card + 3.6, 2)
N = int(total * SR) + SR
for k in tracks: tracks[k] = tracks[k][:N]

# ---------------------------------------------------------------- instruments
def env(n, a=0.003, d=0.2):
    tt = np.arange(n) / SR
    return np.minimum(tt / a, 1) * np.exp(-tt / d)
def sos(kind, fc, order=2): return signal.butter(order, fc, kind, fs=SR, output="sos")
def lp(x, fc, order=2): return signal.sosfilt(sos("low", fc, order), x)
def hp(x, fc, order=2): return signal.sosfilt(sos("high", fc, order), x)
def bp(x, lo, hi, order=2): return signal.sosfilt(sos("band", [lo, hi], order), x)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def pluck(freq, dur=1.4, bright=0.5):          # Karplus-Strong nylon string
    n = int(dur * SR); P = max(2, int(SR / freq)); y = np.zeros(n + P)
    y[:P] = lp(rng.uniform(-1, 1, P), 1500 + 5000 * bright)
    k = P
    while k < n + P:
        m = min(P, n + P - k); prev = y[k - P:k - P + m]
        prev2 = y[k - P - 1:k - P - 1 + m] if k - P - 1 >= 0 else np.concatenate([[0], prev[:-1]])
        y[k:k + m] = 0.996 * 0.5 * (prev + prev2[:m]); k += m
    return lp(y[P:], 4200) * env(n, 0.001, dur * 0.6)
def kick(n=0.35):
    tt = np.arange(int(n * SR)) / SR; f = 46 + 110 * np.exp(-tt / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.16)
def snare(n=0.18):
    tt = np.arange(int(n * SR)) / SR
    return 0.7 * bp(rng.uniform(-1, 1, len(tt)), 900, 7000) * np.exp(-tt / 0.05) + 0.35 * np.sin(2 * np.pi * 190 * tt) * np.exp(-tt / 0.03)
def rim(n=0.06):
    tt = np.arange(int(n * SR)) / SR
    return (np.sin(2 * np.pi * 1700 * tt) + 0.5 * bp(rng.uniform(-1, 1, len(tt)), 2000, 6000)) * np.exp(-tt / 0.012) * 0.5
def hat(o=False):
    tt = np.arange(int((0.18 if o else 0.05) * SR)) / SR
    return hp(rng.uniform(-1, 1, len(tt)), 7000) * np.exp(-tt / (0.06 if o else 0.012)) * 0.35
def shaker():
    tt = np.arange(int(0.09 * SR)) / SR
    return bp(rng.uniform(-1, 1, len(tt)), 4000, 11000) * np.sin(np.pi * tt / tt[-1]) ** 2 * 0.25
def clap():
    tt = np.arange(int(0.22 * SR)) / SR; x = bp(rng.uniform(-1, 1, len(tt)), 1000, 5000)
    e = sum(np.exp(-np.clip(tt - d, 0, None) / 0.01) * (tt >= d) for d in (0, 0.012, 0.024)) + 0.6 * np.exp(-tt / 0.08)
    return x * e * 0.5
def bass(freq, n):
    tt = np.arange(int(n * SR)) / SR
    x = np.sin(2 * np.pi * freq * tt) + 0.35 * signal.sawtooth(2 * np.pi * freq * tt)
    return lp(x, 600) * env(len(tt), 0.005, n * 0.7) * 0.8
def saw_chord(freqs, n, cut=2600, dec=0.09):
    tt = np.arange(int(n * SR)) / SR
    x = sum(signal.sawtooth(2 * np.pi * f * d * tt) for f in freqs for d in (0.996, 1.004))
    return lp(x / (2 * len(freqs)), cut) * env(len(tt), 0.004, dec)
def marimba(freq, n=0.6):
    tt = np.arange(int(n * SR)) / SR
    return (np.sin(2 * np.pi * freq * tt) + 0.25 * np.sin(2 * np.pi * freq * 4 * tt) * np.exp(-tt / 0.02)) * env(len(tt), 0.001, 0.18) * 0.6
def lead(freq, n):                               # soft square lead that doubles the hook
    tt = np.arange(int(n * SR)) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * tt) * np.clip(tt / 0.15, 0, 1)
    x = signal.square(2 * np.pi * freq * np.cumsum(vib) / SR / (1 / 1), 0.5)
    return lp(x, 2200) * np.minimum(tt / 0.01, 1) * np.clip((n - tt) / 0.05, 0, 1) * 0.35

music = np.zeros(N, np.float32)
def m(x, t0, g): put(music, x.astype(np.float32), t0, g)

AND = [[45, [57, 60, 64]], [43, [55, 59, 62]], [41, [53, 57, 60]], [40, [52, 56, 59]]]   # Am G F E
# intro + Q&A: fingerpicked guitar, soft kick + rim on 2/4, shaker
for b in range(0, 8):
    rt, ch = AND[b % 4]; t0 = bar(b)
    pat = [rt + 12, ch[1] + 12, ch[2], ch[1] + 12, ch[0] + 12, ch[1] + 12, ch[2], ch[1] + 12]
    for k, n_ in enumerate(pat): m(pluck(hz(n_), 1.2, 0.35), t0 + k * BEAT / 2, 0.32 if k else 0.42)
    for k in range(8): m(shaker(), t0 + k * BEAT / 2 + (0.015 if k % 2 else 0), 0.45 if k % 2 else 0.25)
    if b >= 1:
        m(kick(0.3), t0, 0.5); m(kick(0.3), t0 + 2 * BEAT, 0.45)
        m(rim(), t0 + BEAT, 0.35); m(rim(), t0 + 3 * BEAT, 0.35)
    if b >= 6:   # double-time energy
        for k in range(16): m(hat(), t0 + k * BEAT / 4, 0.35 if k % 2 else 0.6)
# rising marimba on every answer
for i, ta in enumerate(answers):
    m(marimba(hz([69, 71, 72, 74, 76, 77, 80, 81][i])), ta, 0.5)
# challenge: tension — sustained Dm -> E tremolo guitar, no drums
for b in range(8, drop_bar):
    rt, ch = ([38, [50, 53, 57]] if (b - 8) % 2 == 0 else [40, [52, 56, 59]])
    for k in range(16): m(pluck(hz(ch[k % 3] + 12), 0.5, 0.3), bar(b) + k * BEAT / 4, 0.12)
    m(pluck(hz(rt + 12), 2.4, 0.4), bar(b), 0.3)
fade0, fade1 = int(scratch * SR), int((scratch + 0.12) * SR)
music[fade0:fade1] *= np.linspace(1, 0, fade1 - fade0); music[fade1:int(drop * SR)] = 0

# song: dembow, verse on Andalusian cadence, hook on Am|E Dm|E
song_bars = list(range(drop_bar, hook_bar + 4))
for b in song_bars:
    t0 = bar(b); hookbar = b >= hook_bar
    if hookbar: chords = [[45, [57, 60, 64]], [40, [52, 56, 59]]] if (b - hook_bar) % 2 == 0 else [[38, [50, 53, 57]], [40, [52, 56, 59]]]
    else: chords = [AND[(b - drop_bar) % 4]] * 2
    for half in (0, 2):
        h0 = t0 + half * BEAT
        m(kick(), h0, 0.9); m(kick(), h0 + BEAT, 0.9)
        m(snare(), h0 + 0.75 * BEAT, 0.5); m(snare(), h0 + 1.5 * BEAT, 0.5)
        rt, ch = chords[half // 2]
        for o, l in [(0, 0.7), (0.75, 0.25), (1.5, 0.45)]: m(bass(hz(rt), l * BEAT * 1.3), h0 + o * BEAT, 0.55)
        for o in (0.75, 1.5): m(saw_chord([hz(n_) for n_ in ch], 0.2), h0 + o * BEAT, 0.2)
        for j, n_ in enumerate(ch): m(pluck(hz(n_), 1.0, 0.6), h0 + j * 0.012, 0.16)
    for k in range(8): m(hat(o=(k % 4 == 3)), t0 + k * BEAT / 2, 0.8)
    if hookbar:
        m(clap(), t0 + BEAT, 0.5); m(clap(), t0 + 3 * BEAT, 0.5)
        mel = MEL["Shiba"] if (b - hook_bar) % 2 == 0 else MEL["Hammy"]
        for k, n_ in enumerate(mel):
            m(lead(hz(n_ + (24 if n_ < 55 else 12)), BEAT * 0.9), t0 + k * BEAT, 0.18)
# snare roll into the drop
for k in range(8): m(snare(0.12), drop - 2 * BEAT + k * BEAT / 4, 0.15 + 0.06 * k)
# 808 sub on beats 1 and 3 of the hook
def sub808(freq, n=0.55):
    tt = np.arange(int(n * SR)) / SR; f = freq * (1 + 0.6 * np.exp(-tt / 0.03))
    return np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-tt / 0.35)
for b in range(hook_bar, hook_bar + 4):
    roots = [45, 40] if (b - hook_bar) % 2 == 0 else [38, 40]
    for half, rt in enumerate(roots): m(sub808(hz(rt - 12) * 2), bar(b, 2 * half), 0.5)
# riser into the hook, final hit
tt = np.arange(int(BAR * SR)) / SR
m(hp(rng.uniform(-1, 1, len(tt)), 2000) * (tt / tt[-1]) ** 2 * 0.25, bar(hook_bar) - BAR, 1.0)
m(kick(0.6), hook_end, 1.0); m(saw_chord([hz(n_) for n_ in [57, 60, 64, 69]], 0.9, 3000, 0.35), hook_end, 0.45)
for j, n_ in enumerate([45, 57, 60, 64, 69]): m(pluck(hz(n_), 2.5, 0.7), hook_end + j * 0.015, 0.3)
# outro guitar under the end card
for k, n_ in enumerate([69, 72, 76, 81, 76, 72, 69, 64]): m(pluck(hz(n_), 1.6, 0.4), end_card - 0.1 + k * BEAT / 2, 0.22)

# ---------------------------------------------------------------- vocoder double for the hook
def vocoder(mod, f0, n):
    tt = np.arange(n) / SR
    car = sum(signal.sawtooth(2 * np.pi * f0 * d * tt) for d in (0.995, 1.0, 1.005)) / 3 + 0.08 * rng.uniform(-1, 1, n)
    edges = np.geomspace(120, 7000, 21); outv = np.zeros(n)
    els = sos("low", 40)
    for lo, hi in zip(edges[:-1], edges[1:]):
        s_ = sos("band", [lo, hi])
        e = signal.sosfilt(els, np.abs(signal.sosfilt(s_, mod)))
        outv += signal.sosfilt(s_, car) * e
    return outv / (np.abs(outv).max() + 1e-6)
vox_fx = np.zeros(N, np.float32)
for tw, d, midi, w, x in vocoder_notes:
    put(vox_fx, vocoder(x, hz(midi), len(x)).astype(np.float32), tw, 0.22 if w == "Shiba" else 0.18)

# ---------------------------------------------------------------- SFX
sfx = np.zeros(N, np.float32)
def s(x, t0, g=1.0): put(sfx, x.astype(np.float32), t0, g)
def sweep(f0_, f1, n):
    tt = np.arange(int(n * SR)) / SR; f = f0_ * (f1 / f0_) ** (tt / n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def boing_fx(n=0.7):
    tt = np.arange(int(n * SR)) / SR; f = 180 + 260 * np.exp(-tt / 0.25) * (1 + 0.35 * np.sin(2 * np.pi * 14 * tt))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(tt), 0.002, 0.25) * 0.8
def pop(n=0.09, f=900): return sweep(f, f * 0.4, n) * env(int(n * SR), 0.001, 0.03) * 0.5
def scratch_fx(n=0.55):
    tt = np.arange(int(n * SR)) / SR; rate = 1 + 0.9 * np.sin(2 * np.pi * 3.2 * tt); ph = np.cumsum(rate) / SR
    tone = np.sin(2 * np.pi * 300 * ph * (1 + 0.5 * np.sin(2 * np.pi * 7 * ph)))
    return (0.6 * tone + 0.5 * bp(rng.uniform(-1, 1, len(tt)), 800, 5000) * np.abs(rate - 1)) * env(len(tt), 0.005, 0.3)
def whoosh(n=0.6):
    tt = np.arange(int(n * SR)) / SR; x = rng.uniform(-1, 1, len(tt)); y = np.zeros_like(x)
    for i, (lo, hi) in enumerate([(300, 900), (900, 2500), (2500, 6000)]): y += bp(x, lo, hi) * np.sin(np.pi * np.clip(tt / n * 3 - i, 0, 1)) ** 2
    return y * 0.35
def ding(f=1320, n=1.2):
    tt = np.arange(int(n * SR)) / SR
    return (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.76 * tt)) * env(len(tt), 0.001, 0.35) * 0.25
def puff_fx(n=0.35):   # cheeks inflating
    tt = np.arange(int(n * SR)) / SR; f = 200 * (3.5 ** (tt / n))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / n) * 0.35
s(whoosh(0.8), 0.0, 0.5)
s(scratch_fx(), scratch, 0.6)
s(whoosh(), drop - 0.55, 0.6)
s(sweep(900, 300, 0.25) * env(int(0.25 * SR), 0.002, 0.1), turn_t, 0.25)     # head-turn "zip"
s(puff_fx(), puff_t, 0.8)
xt = lp(voice("e_tu", "Shiba"), 2500)
for i, g in enumerate([0.32, 0.18, 0.1, 0.05]): s(xt, tu_t + 0.28 * (i + 1), g)       # echo tail on "eres tú"
s(boing_fx(), boing, 0.9)
s(ding(), end_card + 0.1, 0.8)

# ---------------------------------------------------------------- mix
voice_mix = tracks["Shiba"] + tracks["Hammy"]
a_ = np.abs(voice_mix); k = int(0.08 * SR); sm = np.convolve(a_, np.ones(k) / k, "same")
tax = np.arange(N) / SR
song = (tax >= drop) & (tax < hook_end + 0.3)
duck = np.where(song, 1 - 0.4 * np.clip(sm / 0.05, 0, 1), 1 - 0.5 * np.clip(sm / 0.05, 0, 1))
mb = hp(music, 60)
hole = bp(mb, 250, 2500)
music2 = np.where(song, mb - 0.45 * hole * np.clip(sm / 0.05, 0, 1), music)
mix = voice_mix + music2 * np.where(song, 0.4, 0.45) * duck + vox_fx + sfx * 0.9
mix = mix[: int(total * SR)]; mix = mix / max(1e-6, np.abs(mix).max()) * 0.95
os.makedirs(os.path.join(ROOT, "audio", "stems"), exist_ok=True)
tmpw = os.path.join(ROOT, "audio", "mix_raw.wav"); write(tmpw, mix)
ff("-i", tmpw, "-af", "loudnorm=I=-14:TP=-1:LRA=9", "-ar", str(SR), "-ac", "2", os.path.join(ROOT, "audio", "mix.wav")); os.remove(tmpw)
for nme, x in [("voices", voice_mix), ("music", music2 * 0.4), ("vocoder", vox_fx)]:
    write(os.path.join(ROOT, "audio", "stems", nme + ".wav"), x[: int(total * SR)] / max(1e-6, np.abs(x).max()) * 0.9)

# ---------------------------------------------------------------- timeline + lip-sync
FPS_ENV = 60
def envelope(x):
    hop = SR // FPS_ENV; n = len(x) // hop
    r = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1))
    return [round(float(v), 3) for v in np.clip(r / 0.12, 0, 1) ** 0.7]
tl = dict(fps=30, duration=total, bpm=BPM, beat=BEAT, bar=BAR, grid0=G0, establish=lines[0]["start"],
          lines=lines, answers=[round(a, 3) for a in answers], challenge=dict(start=round(ch_start, 3), end=round(ch_end, 3)),
          scratch=round(scratch, 3), drop=round(drop, 3), verse=verse, adlibs=adlibs, hook=hook, hook_start=round(bar(hook_bar), 3),
          rap_end=round(hook_end, 3), burro=round(burro_t, 3), turn=round(turn_t, 3), tu=round(tu_t, 3), puff=round(puff_t, 3),
          boing=round(boing, 3), end_card=round(end_card, 3), burro_note=S["burro_note"],
          ring_text="Pero el perro del cerro tiene pelo de hierro, se come la pera y el puerro en el barro",
          end_lines=["Perro, pero, pelo, pera", "Cerro, hierro, puerro, barro", "狗、但是、毛、梨 · 山丘、铁、韭葱、泥巴"])
json.dump(tl, open(os.path.join(ROOT, "timeline.json"), "w"), ensure_ascii=False, indent=1)
data = dict(tl=tl, env={k: envelope(v) for k, v in tracks.items()}, envFps=FPS_ENV)
open(os.path.join(ROOT, "src", "data.js"), "w").write("window.DATA = " + json.dumps(data, ensure_ascii=False) + ";\n")
print(json.dumps({k: tl[k] for k in ("duration", "drop", "hook_start", "rap_end", "burro", "tu", "boing", "end_card")}))
print("challenge", tl["challenge"], "drop_bar", drop_bar)
