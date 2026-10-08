"""Synthesize the teaser score with numpy only -> out/score.wav (48 kHz stereo).

Heartbeat, low brass "braams" on the hard cuts, an endless Shepard rise, token ticks that
accelerate, one full drop to silence, a single note on the choice, and keyboard clicks."""
import os, sys, wave

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from timeline import (DURATION, HEARTBEATS, BRAAMS, SILENCE, CHOICE_NOTE, SHEPARD, TICK_RAMP,
                      FINAL_TICK, SHOTS)

SR = 48000
N = int(DURATION * SR)
rng = np.random.default_rng(1)


def at(sec):
    return int(sec * SR)


def add(buf, sig, start):
    i = at(start)
    j = min(N, i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i]


def lowpass(x, cutoff):
    """One-pole low-pass via FFT brick shaping (no scipy)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / cutoff) ** 4), len(x))


def reverb(x, seconds=2.2, wet=0.35):
    n = int(seconds * SR)
    ir = rng.normal(0, 1, n) * np.exp(-np.linspace(0, 7, n))
    ir = lowpass(ir, 4000)
    ir /= np.sqrt((ir ** 2).sum())
    L = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[: len(x)]
    return x * (1 - wet) + y * wet * 2.0


def heartbeat():
    t = np.arange(int(0.5 * SR)) / SR
    lub = np.sin(2 * np.pi * 52 * t) * np.exp(-t * 22) * (1 - np.exp(-t * 400))
    dub = np.zeros_like(t)
    k = at(0.19)
    dub[k:] = 0.7 * np.sin(2 * np.pi * 44 * t[: len(t) - k]) * np.exp(-t[: len(t) - k] * 26)
    return (lub + dub) * 0.9


def braam(length=3.6, big=False):
    t = np.arange(int(length * SR)) / SR
    env = (1 - np.exp(-t * 18)) * np.exp(-t * (0.9 if big else 1.3))
    bright = 4 + 26 * np.exp(-t * 2.2)  # filter opens on the hit, then closes
    out = np.zeros_like(t)
    for f, amp in [(43.65, 1.0), (87.3, 0.8), (130.8, 0.55), (174.6, 0.35)] + ([(65.4, 0.6)] if big else []):
        for n in range(1, int(1800 / f)):
            out += amp / n * np.exp(-n / bright) * np.sin(2 * np.pi * n * f * t * (1 + 0.0015 * np.sin(5 * t)))
    out = np.tanh(out * 0.9) * env
    sub = np.sin(2 * np.pi * 36 * t) * np.exp(-t * 3) * 0.8
    return (out + sub) * (1.0 if big else 0.8)


def shepard(t0, t1):
    t = np.arange(at(t1) - at(t0)) / SR
    T = t1 - t0
    # rise accelerates: 1 octave per 6 s at the start, ~1 per 1.5 s at the end
    pos = 0.16 * t + 0.10 * t ** 2 / T
    out = np.zeros_like(t)
    for k in range(9):
        lf = (k + pos) % 9  # octave index 0..9
        f = 27.5 * 2 ** lf
        amp = np.exp(-0.5 * ((lf - 4.5) / 1.6) ** 2)
        phase = 2 * np.pi * np.cumsum(f) / SR
        out += amp * (np.sin(phase) + 0.25 * np.sin(2 * phase))
    ramp = (t / T) ** 1.8
    return out * ramp * 0.16


def tick(bright=1.0):
    n = int(0.035 * SR)
    t = np.arange(n) / SR
    noise = np.diff(rng.normal(0, 1, n + 1)) * np.exp(-t * 260)
    ping = np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 180)
    return (noise * 0.25 + ping * 0.35) * bright


def keyclick():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 120) * 0.4
    clack = np.diff(rng.normal(0, 1, n + 1)) * np.exp(-t * 400) * 0.25
    return body + clack


def note(freq=329.6, length=4.0):
    t = np.arange(int(length * SR)) / SR
    out = np.zeros_like(t)
    for n, a in [(1, 1.0), (2, 0.45), (3, 0.2), (4, 0.12), (6, 0.05)]:
        out += a * np.sin(2 * np.pi * freq * n * t) * np.exp(-t * (0.7 + 0.5 * n))
    return out * (1 - np.exp(-t * 300)) * 0.45


def ocean_wash(length):
    n = int(length * SR)
    x = np.cumsum(rng.normal(0, 1, n))
    x -= np.convolve(x, np.ones(4800) / 4800, mode="same")
    x = lowpass(x / (np.abs(x).max() + 1e-9), 500)
    t = np.arange(n) / SR
    swell = 0.6 + 0.4 * np.sin(2 * np.pi * t / 3.2 - 1.5)
    return x * swell * 0.5


def main():
    music = np.zeros(N)   # gets reverb
    dry = np.zeros(N)

    for hb in HEARTBEATS:
        add(dry, heartbeat(), hb)

    # typing: cold open lines (8 cps), room (5 cps), wake (6 cps)
    for start, count, cps in [(0.9, 9, 8), (2.4, 9, 8), (10.0, 4, 5), (28.5, 3, 6)]:
        for k in range(1, count + 1):
            add(dry, keyclick() * 0.7, start + k / cps)

    for s0, s1, name, p in SHOTS:
        if name == "ocean":
            add(music, ocean_wash(s1 - s0 + 1.0) * (0.6 if p.get("focus") else 1.0), s0)

    add(music, shepard(*SHEPARD), SHEPARD[0])

    for b in BRAAMS:
        add(music, braam(big=(b == BRAAMS[-1])), b)

    # token ticks accelerate from 2/s to ~16/s
    for t0, t1 in TICK_RAMP:
        t = t0
        while t < t1:
            k = (t - t0) / (t1 - t0)
            add(dry, tick(0.5 + 0.5 * k), t)
            t += 1 / (2 + 14 * k ** 1.5)

    # rising noise into the title hit
    n = at(25.0) - at(24.0)
    sw = lowpass(rng.normal(0, 1, n), 6000) * np.linspace(0, 1, n) ** 3 * 0.25
    add(music, sw, 24.0)

    add(music, note(), CHOICE_NOTE)
    add(music, note(164.8, 3.0) * 0.5, CHOICE_NOTE + 0.02)
    add(dry, tick(1.2), FINAL_TICK)

    mix = reverb(music) + dry
    # hard silence windows: the drop before the choice, and the final cut to black
    s0, s1 = at(SILENCE[0]), at(CHOICE_NOTE)
    mix[s0:s1] = 0
    mix[at(29.6):] = 0
    mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) * 0.89

    stereo = np.stack([mix, mix], axis=1)
    # tiny Haas widening on the reverb-heavy content
    d = int(0.012 * SR)
    stereo[d:, 1] = 0.85 * mix[:-d] + 0.15 * mix[d:]
    pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
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
