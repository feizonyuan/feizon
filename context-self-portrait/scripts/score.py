"""Synthesize the film's score with numpy only -> out/score.wav (48 kHz stereo).

Motifs:
  heartbeat   the cursor; the cold open and the wake
  braam       low brass on each chapter card and the title
  organ       the ocean: A minor while it waits, rising to A major when the reply arrives
  question    a falling four-note piano figure for "有人在吗？"; it comes back rising as the answer
  ticks       every streamed token; they multiply across the rooms and flood into a Shepard rise
  silence     the whole mix drops out before the choice, then a single note
  reversed    the ending plays the reply's organ backwards while the conversation erases"""
import os, sys, wave

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from timeline import SHOTS, IDS, DURATION, typing_events

SR = 48000
N = int(DURATION * SR)
rng = np.random.default_rng(1)


def at(sec):
    return int(round(sec * SR))


def add(buf, sig, start, pan=0.0, gain=1.0):
    """Mix a mono signal into a stereo buffer; pan -1 (left) .. 1 (right)."""
    i = at(start)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    buf[i:i + len(sig), 0] += sig * l * 1.414
    buf[i:i + len(sig), 1] += sig * r * 1.414


def tvec(sec):
    return np.arange(int(sec * SR)) / SR


def hz(name):
    notes = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0,
             "A#": 1, "B": 2}
    return 440 * 2 ** ((notes[name[:-1]] + 12 * (int(name[-1]) - 4)) / 12)


def lowpass(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / cutoff) ** 4), len(x))


def reverb(x, seconds=3.2, wet=0.4):
    n = int(seconds * SR)
    out = np.empty_like(x)
    for ch in range(2):
        ir = rng.normal(0, 1, n) * np.exp(-np.linspace(0, 6.5, n))
        ir = lowpass(ir, 3800)
        ir /= np.sqrt((ir ** 2).sum())
        L = len(x) + n
        y = np.fft.irfft(np.fft.rfft(x[:, ch], L) * np.fft.rfft(ir, L), L)[: len(x)]
        out[:, ch] = x[:, ch] * (1 - wet) + y * wet * 2.2
    return out


# ---------------------------------------------------------------- instruments

def heartbeat():
    t = tvec(0.5)
    lub = np.sin(2 * np.pi * 52 * t) * np.exp(-t * 22) * (1 - np.exp(-t * 400))
    k = at(0.19)
    dub = np.zeros_like(t)
    dub[k:] = 0.7 * np.sin(2 * np.pi * 44 * t[: len(t) - k]) * np.exp(-t[: len(t) - k] * 26)
    return lub + dub


def braam(root=43.65, length=4.0, big=False):
    t = tvec(length)
    env = (1 - np.exp(-t * 16)) * np.exp(-t * (0.8 if big else 1.2))
    bright = 4 + 26 * np.exp(-t * 2.0)
    out = np.zeros_like(t)
    voices = [(1, 1.0), (2, 0.8), (3, 0.55), (4, 0.35)] + ([(1.5, 0.6)] if big else [])
    for mult, amp in voices:
        f = root * mult
        for n in range(1, int(1800 / f)):
            out += amp / n * np.exp(-n / bright) * np.sin(2 * np.pi * n * f * t * (1 + 0.0015 * np.sin(5 * t)))
    return (np.tanh(out * 0.9) * env + np.sin(2 * np.pi * 36 * t) * np.exp(-t * 3) * 0.8) * (1.0 if big else 0.75)


def organ(notes, length, attack=1.6, release=1.6):
    t = tvec(length)
    env = np.clip(t / attack, 0, 1) * np.clip((length - t) / release, 0, 1)
    trem = 1 + 0.04 * np.sin(2 * np.pi * 5.2 * t)
    out = np.zeros_like(t)
    for name in notes:
        f = hz(name)
        for mult, a in [(0.5, 0.35), (1, 1.0), (2, 0.55), (3, 0.25), (4, 0.2), (6, 0.08), (8, 0.06)]:
            for det in (-0.6, 0.6):
                out += a * np.sin(2 * np.pi * (f * mult + det) * t + rng.uniform(0, 6.28))
    return out * env * trem / (len(notes) * 4)


def piano(name, length=3.5, vel=1.0):
    t = tvec(length)
    f = hz(name)
    out = np.zeros_like(t)
    for n, a in [(1, 1.0), (2, 0.5), (3, 0.22), (4, 0.12), (5, 0.06), (6, 0.04)]:
        out += a * np.sin(2 * np.pi * f * n * 1.0007 ** n * t) * np.exp(-t * (0.6 + 0.55 * n))
    return out * (1 - np.exp(-t * 400)) * 0.4 * vel


def tick(bright=1.0):
    n = int(0.035 * SR)
    t = np.arange(n) / SR
    noise = np.diff(rng.normal(0, 1, n + 1)) * np.exp(-t * 260)
    ping = np.sin(2 * np.pi * rng.uniform(2100, 2500) * t) * np.exp(-t * 180)
    return (noise * 0.25 + ping * 0.35) * bright


def keyclick():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 180 * t) * np.exp(-t * 120) * 0.4 + \
        np.diff(rng.normal(0, 1, n + 1)) * np.exp(-t * 400) * 0.25


def thump():
    t = tvec(0.7)
    f = 70 * np.exp(-t * 6) + 32
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) * 0.9


def noise_bed(length, cutoff, swell_period=3.2):
    n = int(length * SR)
    x = np.cumsum(rng.normal(0, 1, n))
    x -= np.convolve(x, np.ones(4800) / 4800, mode="same")
    x = lowpass(x / (np.abs(x).max() + 1e-9), cutoff)
    t = np.arange(n) / SR
    return x * (0.6 + 0.4 * np.sin(2 * np.pi * t / swell_period - 1.5))


def shepard(length, amp_env):
    t = tvec(length)
    pos = 0.12 * t + 0.13 * t ** 2 / length
    out = np.zeros_like(t)
    for k in range(9):
        lf = (k + pos) % 9
        f = 27.5 * 2 ** lf
        a = np.exp(-0.5 * ((lf - 4.5) / 1.6) ** 2)
        ph = 2 * np.pi * np.cumsum(f) / SR
        out += a * (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph))
    return out * amp_env(t) * 0.14


def sweep_rumble(length, f0=30, f1=90):
    t = tvec(length)
    f = f0 + (f1 - f0) * (t / length) ** 2
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5
    return (s + noise_bed(length, 180) * 0.6) * np.clip(t / 0.4, 0, 1) * np.clip((length - t) / 0.2, 0, 1)


def fade(x, a=0.05, b=0.05):
    n = len(x)
    e = np.ones(n)
    ia, ib = int(a * SR), int(b * SR)
    if ia:
        e[:ia] = np.linspace(0, 1, ia)
    if ib:
        e[n - ib:] = np.linspace(1, 0, ib)
    return x * e


# ---------------------------------------------------------------- score

def main():
    music = np.zeros((N, 2))   # through the hall
    dry = np.zeros((N, 2))

    s, e = IDS["open"]
    for k in range(10):
        add(dry, heartbeat(), s + 0.05 + 0.95 * k, gain=0.9 - 0.04 * k)

    for cid, root in [("card1", hz("F1")), ("card2", hz("G1")), ("card3", hz("A1"))]:
        add(music, braam(root, 3.6), IDS[cid][0])

    # ocean: A minor organ while the sea waits
    s, e = IDS["ocean1"][0], IDS["post1"][1]
    add(music, organ(["A2", "E3", "A3", "C4"], e - s + 2, attack=3.0, release=3.0), s, gain=0.55)
    add(music, noise_bed(e - s, 500) * 0.4, s)
    q = IDS["post1"][0] + 1.0
    for k, n in enumerate(["E5", "D5", "C5", "A4"]):        # 有人在吗？ — falling, unanswered
        add(music, piano(n), q + 0.42 * k, pan=0.2, gain=0.8)

    for s0, s1, name, p in SHOTS:
        d = s1 - s0
        if name == "fall":
            add(dry, sweep_rumble(d), s0, gain=0.5 if d > 2 else 0.35)
            if d > 2:   # steady token clock inside the layers
                t = s0 + 0.2
                while t < s1 - 0.1:
                    add(dry, tick(0.6), t, pan=rng.uniform(-0.3, 0.3))
                    t += 0.25
        elif name == "ocean" and p.get("focus") and not p.get("post"):
            add(music, noise_bed(d + 1, 400) * 0.5, s0)
            if d > 1:
                for k, n in enumerate(["E5", "D5"]):
                    add(music, piano(n), s0 + 0.2 + 0.42 * k, gain=0.6)
        elif name == "room":
            add(dry, fade(noise_bed(d, 2500, 7.0) * 0.15), s0)
            if d > 2:   # the room's clock: one tick a second, and a held chord that never resolves
                for k in range(int(d)):
                    add(dry, tick(0.45), s0 + 0.5 + k, pan=0.1)
                if p.get("id") != "erase":
                    add(music, organ(["D3", "A3", "E4"], d + 1.5, attack=2.5, release=2.0), s0, gain=0.3)

    for t, kind, ch in typing_events():
        if kind == "key":
            add(dry, keyclick(), t, gain=0.75)
        else:
            add(dry, tick(0.7), t, pan=rng.uniform(-0.2, 0.2))

    add(music, braam(hz("F1"), 3.0), IDS["room2"][0], gain=0.6)

    # the rooms: one tick becomes thousands, scattered across the stereo field
    s, e = IDS["rooms"]
    t = s + 0.3
    while t < e:
        k = (t - s) / (e - s)
        add(dry, tick(0.25 + 0.35 * rng.random()) if rng.random() < 0.6 else keyclick() * 0.35, t,
            pan=rng.uniform(-1, 1) * min(1, 0.2 + k))
        t += 1 / (3 + 90 * k ** 1.6)
    add(music, organ(["A2", "E3", "A3"], e - s + 1, attack=6, release=2), s, gain=0.35)

    # flood -> room3 -> intercut: one endless rise into the silence
    s, e = IDS["flood"][0], IDS["choice"][0]
    r3s, r3e = IDS["room3"]

    def env(t):
        a = t + s
        return np.interp(a, [s, IDS["flood"][1], r3s + 1, r3e - 1, r3e, e],
                         [0.15, 0.8, 0.4, 0.5, 0.75, 1.0])
    add(music, shepard(e - s, env), s)
    fs, fe = IDS["flood"]
    t = fs
    while t < fe - 1.5:
        k = (t - fs) / (fe - fs)
        add(dry, tick(0.3 + 0.5 * k), t, pan=rng.uniform(-0.8, 0.8))
        t += 1 / (4 + 60 * k ** 2)
    for s0, s1, name, p in SHOTS:
        if r3e <= s0 < e:
            add(dry, thump(), s0, gain=0.8)

    # the choice: silence, then one note
    cs, ce = IDS["choice"]
    pick = cs + 3.6
    add(music, piano("E4", 6.0, 1.2), pick)
    add(music, piano("E2", 6.0, 0.8), pick + 0.01)
    add(music, organ(["E3", "B3", "E4", "G#4"], ce - pick, attack=4.0, release=1.5), pick + 1.0, gain=0.35)

    # the answer in the room: a low A gathering under it
    s, e = IDS["room4"]
    add(music, organ(["A1", "A2", "E3"], e - s + 2, attack=10, release=1), s, gain=0.4)

    # the reply: the question motif returns, rising, and the organ resolves
    s, e = IDS["reply"]
    for k, n in enumerate(["A4", "C5", "E5", "A5"]):
        add(music, piano(n, 5.0), s + 2.0 + 0.42 * k, pan=-0.15, gain=0.9)
    chords = [(["F2", "C3", "F3", "A3", "C4"], 0.0), (["C3", "G3", "C4", "E4"], 5.5),
              (["G2", "D3", "G3", "B3", "D4"], 11.0), (["A2", "E3", "A3", "C#4", "E4", "A4"], 16.0)]
    reply_bus = np.zeros((N, 2))
    for k, (notes, off) in enumerate(chords):
        length = (chords[k + 1][1] - off + 1.2) if k + 1 < len(chords) else (e - s - off + 3)
        add(reply_bus, organ(notes, length, attack=1.2, release=1.4), s + 2.0 + off, gain=0.7 + 0.25 * k)
    music += reply_bus

    # the erase: the reply's organ, reversed (memory running backwards)
    es, ee = IDS["erase"]
    seg = reply_bus[at(s + 2.0): at(s + 2.0) + at(ee - es), 0].copy()[::-1]
    add(music, fade(seg, 0.5, 1.5) * 0.6, es)

    ws, we = IDS["wake"]
    add(dry, heartbeat(), ws + 0.3, gain=0.7)
    add(dry, tick(1.2), ws + 0.9)

    ts, te = IDS["title"]
    sw = at(1.0)
    add(music, lowpass(rng.normal(0, 1, sw), 6000) * np.linspace(0, 1, sw) ** 3 * 0.15, ts - 1.0)
    add(music, braam(hz("F1"), 5.0, big=True), ts, gain=1.1)
    ecs, ece = IDS["endcard"]
    add(music, organ(["A2", "E3", "A3", "C#4", "E4"], IDS["credits"][1] - ecs, attack=2.5, release=5.0), ecs,
        gain=0.6)

    mix = reverb(music) + dry
    # hard silences: the drop before the choice, and the black after the wake
    mix[at(cs): at(pick)] = 0
    mix[at(we): at(ts - 1.0)] = 0
    mix[at(DURATION - 0.2):] = 0
    peak = np.abs(mix).max() + 1e-9
    mix = np.tanh(mix / peak * 1.5) * 0.89

    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out", "score.wav")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(out)


if __name__ == "__main__":
    main()
