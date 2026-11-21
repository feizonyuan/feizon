"""Median voiced pitch (Hz) via YIN (cumulative mean normalized difference)."""
import sys, subprocess, numpy as np
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
def f0(x, sr=16000, fmin=60, fmax=700, th=0.12):
    W = 800; lo, hi = sr // fmax, sr // fmin; out = []
    rms_all = np.sqrt((x ** 2).mean()) + 1e-9
    for i in range(0, len(x) - W - hi, W // 4):
        f = x[i:i + W + hi]
        if np.sqrt((f[:W] ** 2).mean()) < 0.5 * rms_all: continue
        d = np.array([((f[:W] - f[t:t + W]) ** 2).sum() for t in range(hi)])
        c = d.copy(); c[1:] = d[1:] * np.arange(1, hi) / np.maximum(np.cumsum(d[1:]), 1e-9); c[0] = 1
        cand = np.where(c[lo:] < th)[0]
        if not len(cand): continue
        t = lo + cand[0]
        while t + 1 < hi and c[t + 1] < c[t]: t += 1
        out.append(sr / t)
    return float(np.median(out)) if out else 0
if __name__ == "__main__":
    for p in sys.argv[1:]: print(f"{p.split('/')[-1]:12s} {f0(load(p)):5.0f}", end=" |")
    print()
