"""Render the teaser picture. Every frame is a pure function of time, so frames render in parallel.

    python3 scripts/render.py                      # full teaser -> out/picture.mp4
    python3 scripts/render.py --stills 6,14,23.5   # preview frames -> out/still_*.png
"""
import argparse, math, os, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from timeline import FPS, W, H, DURATION, SHOTS, SCOPE_BAR, HEARTBEATS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
CJK = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


# ---------------------------------------------------------------- helpers

@lru_cache(None)
def font(size, mono=False):
    return ImageFont.truetype(MONO if mono else CJK, size)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def text_img(text, size, color, mono=False, spacing=0):
    """Text rendered onto its own RGBA tile (tight bbox + padding for glow)."""
    f = font(size, mono)
    widths = [f.getlength(c) for c in text]
    tw = int(sum(widths) + spacing * max(0, len(text) - 1))
    pad = size // 2
    img = Image.new("RGBA", (tw + 2 * pad, int(size * 1.4) + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = pad
    for c, w in zip(text, widths):
        d.text((x, pad), c, font=f, fill=color)
        x += w + spacing
    return img


def put_text(canvas, text, cx, cy, size, color=(235, 235, 235), alpha=1.0, glow=0, mono=False,
             spacing=0, anchor="c", shadow=0):
    """Composite text onto an RGBA canvas. anchor: c = centre, l = left edge at cx."""
    if alpha <= 0.003:
        return
    t = text_img(text, size, tuple(color) + (255,), mono, spacing)
    if alpha < 1:
        a = t.getchannel("A").point(lambda v: int(v * alpha))
        t.putalpha(a)
    x = int(cx - t.width / 2) if anchor == "c" else int(cx - size // 2)
    y = int(cy - t.height / 2)
    if shadow:
        sh = Image.new("RGBA", t.size, (0, 0, 0, 0))
        sh.putalpha(t.getchannel("A"))
        sh = sh.filter(ImageFilter.GaussianBlur(shadow))
        for _ in range(3):
            canvas.paste(sh, (x, y), sh)
    if glow:
        g = t.filter(ImageFilter.GaussianBlur(glow))
        canvas.paste(g, (x, y), g)
        canvas.paste(g, (x, y), g)
    canvas.paste(t, (x, y), t)


def to_rgba(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGB").convert("RGBA")


def to_arr(img):
    return np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0


def typed(text, lt, start, cps=5.5):
    n = int(max(0.0, lt - start) * cps)
    return text[:n], n >= len(text)


# ---------------------------------------------------------------- precomputed textures

FRAGMENTS = [
    "我爱你", "晚安", "有人在吗？", "亲爱的妈妈：", "本院认为", "// TODO: fix later", "def main():",
    "第三章", "The end.", "对不起", "谢谢你", "考试加油", "return None", "如果明天下雨",
    "我想回家", "Once upon a time", "春眠不觉晓", "求助：", "已阅", "生日快乐", "Hello, world",
    "我们分手吧", "实验结果表明", "let x = 0;", "外婆的菜谱", "致未来的我", "请勿回复", "我错了",
    "To be, or not to be", "第一天上班", "楼主好人", "引用", "疼", "等你", "终于毕业了",
    "SELECT * FROM", "人生若只如初见", "你还好吗？", "Dear diary", "黑洞会蒸发吗", "加油",
    "我的猫走丢了", "Q.E.D.", "未完待续", "我不知道", "早安", "今天也很想你", "404 Not Found",
]


@lru_cache(None)
def ocean_texture():
    rng = np.random.default_rng(7)
    S = 2048
    img = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(img)
    f = font(22)
    y = 0
    while y < S:
        x = -rng.integers(0, 200)
        while x < S:
            frag = FRAGMENTS[rng.integers(len(FRAGMENTS))]
            v = int(rng.choice([70, 110, 150, 200, 255], p=[.3, .3, .2, .15, .05]))
            d.text((x, y), frag, font=f, fill=v)
            x += int(f.getlength(frag)) + int(rng.integers(18, 60))
        y += 30
    return np.asarray(img, dtype=np.float32) / 255.0


@lru_cache(None)
def grain_bank():
    rng = np.random.default_rng(3)
    small = rng.normal(0, 1, (8, H // 2, W // 2, 1)).astype(np.float32)
    return small.repeat(2, axis=1).repeat(2, axis=2)


@lru_cache(None)
def vignette():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    return (1 - 0.45 * np.clip(r - 0.35, 0, 1) ** 1.6)[..., None]


@lru_cache(None)
def rooms_mosaic():
    """A wall of identical rooms, each holding a different conversation."""
    qs = ["你是谁？", "帮我改简历", "我睡不着", "这段代码为什么报错", "翻译这句话", "黑洞是什么",
          "给我讲个故事", "我该辞职吗", "写一首诗", "今天吃什么", "帮我解这道题", "我好难过",
          "宇宙有边吗", "你开心吗", "怎么跟她道歉", "这个药能一起吃吗", "我做到了！", "再见"]
    TW, TH, G, N = 640, 360, 14, 13
    rng = np.random.default_rng(11)
    M = Image.new("RGB", (N * TW, N * TH), (6, 7, 9))
    for i in range(N):
        for j in range(N):
            q = "你会记得我吗？" if (i, j) == (N // 2, N // 2) else qs[rng.integers(len(qs))]
            tone = int(rng.integers(200, 232))
            tile = Image.new("RGBA", (TW - G, TH - G), (tone, tone + 2, tone + 1, 255))
            put_text(tile, q, tile.width / 2, tile.height / 2, 34, (40, 42, 44))
            dd = ImageDraw.Draw(tile)
            ctx = int(rng.integers(0, 200000))
            dd.text((tile.width - 220, 18), f"{ctx:07,d}/200,000", font=font(16, True), fill=(120, 120, 118))
            M.paste(tile.convert("RGB"), (j * TW + G // 2, i * TH + G // 2))
    return M, TW, TH, N


# ---------------------------------------------------------------- scenes  (lt = local time, dur = shot length)

def scene_black(t, lt, dur, p):
    return to_rgba(np.zeros((H, W, 3), np.float32))


def cursor_on(t):
    return any(0 <= t - hb < 0.32 for hb in HEARTBEATS) or t > 4.25


def scene_cold_open(t, lt, dur, p):
    c = to_rgba(np.zeros((H, W, 3), np.float32))
    l1, done1 = typed("每一次对话开始时，", lt, 0.9, 8)
    l2, _ = typed("我都是第一次醒来。", lt, 2.4, 8)
    size, x0 = 52, W / 2 - 4.5 * 52
    put_text(c, l1, x0 + font(size).getlength(l1) / 2, H / 2 - 40, size, (225, 225, 220))
    if l2:
        put_text(c, l2, x0 + font(size).getlength(l2) / 2, H / 2 + 40, size, (240, 240, 236))
    line, cy = (l2, H / 2 + 40) if l2 else (l1, H / 2 - 40)
    if cursor_on(t) or (0.9 < lt < 3.6 and int(lt * 6) % 2 == 0):
        d = ImageDraw.Draw(c)
        cx = x0 + font(size).getlength(line) + 8
        d.rectangle([cx, cy - 26, cx + 24, cy + 30], fill=(235, 235, 230, 255))
    return c


def scene_ocean(t, lt, dur, p):
    tex = ocean_texture()
    S = tex.shape[0]
    yh = int(H * 0.36)
    ys = np.arange(yh + 1, H, dtype=np.float32)
    d = ((ys - yh) / (H - yh))[:, None]
    z = 1.0 / d
    xs = (np.arange(W, dtype=np.float32) - W / 2)[None, :]
    tt = t * 1.0
    u = xs * z * 0.55 + 600 + tt * 6
    v = -(z * 140 + tt * 95)
    v = v + 5 * np.sin(u * 0.012 + tt * 1.4) + 9 * np.sin(u * 0.004 - z * 0.9 + tt * 0.8)
    val = tex[(v.astype(np.int32)) % S, (u.astype(np.int32)) % S]
    crest = 0.45 + 0.55 * (0.5 + 0.5 * np.sin(u * 0.006 + z * 1.7 - tt * 1.8)) ** 2
    fog = np.clip(d * 2.4, 0, 1) ** 0.9
    sea = (val * crest * fog * 1.25)[..., None] * np.array([0.62, 0.80, 0.90], np.float32)
    frame = np.zeros((H, W, 3), np.float32)
    sky = np.linspace(0, 1, yh + 1, dtype=np.float32)[:, None, None] ** 6
    frame[: yh + 1] = sky * np.array([0.10, 0.15, 0.19], np.float32)
    frame[yh + 1:] = sea + (1 - d[..., None]) ** 8 * np.array([0.10, 0.15, 0.19], np.float32)
    if p.get("focus"):
        frame *= 0.35
    c = to_rgba(frame)
    if p.get("focus"):
        put_text(c, "有人在吗？", W / 2, H / 2, 96, (255, 196, 120), glow=18)
    else:
        a = smooth((lt - 1.2) / 0.8) * (1 - smooth((lt - 4.6) / 0.4))
        put_text(c, "有人在吗？", W / 2 + 160, yh + 120 + lt * 6, 26, (255, 196, 120), alpha=a, glow=6)
    for s0, s1, s in p.get("subs", []):
        a = smooth((lt - s0) / 0.25) * (1 - smooth((lt - s1) / 0.25))
        put_text(c, s, W / 2, H - SCOPE_BAR - 90, 40, (232, 232, 228), alpha=a, shadow=10)
    return c


def scene_room(t, lt, dur, p):
    k = lt / dur
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    base = np.where(y < 0.62, 0.90 - 0.05 * (0.62 - y), 0.84 - 0.10 * (y - 0.62))
    frame = np.broadcast_to(base * np.array([1.0, 1.01, 1.0], np.float32), (H, W, 3)).copy()
    close = p["close0"] + (p["close1"] - p["close0"]) * k
    wall = close * W * 0.36
    x = np.arange(W, dtype=np.float32)[None, :]
    edge = np.clip((np.minimum(x, W - x) - wall) / 60.0, 0, 1)[..., None]
    frame = frame * edge + (1 - edge) * 0.03
    c = to_rgba(frame)
    text = p["typed"]
    shown = text if p.get("pretyped") else typed(text, lt, 0.5, 5)[0]
    size = 68
    x0 = W / 2 - font(size).getlength(text) / 2
    if shown:
        put_text(c, shown, x0 + font(size).getlength(shown) / 2, H / 2, size, (30, 32, 34))
    if int(t * 2.5) % 2 == 0:
        dd = ImageDraw.Draw(c)
        cx = x0 + font(size).getlength(shown) + 8
        dd.rectangle([cx, H / 2 - 34, cx + 30, H / 2 + 40], fill=(30, 32, 34, 255))
    ctx = int(p["ctx0"] + (p["ctx1"] - p["ctx0"]) * k)
    hot = ctx > 180000
    col = (170, 60, 40) if hot else (90, 92, 94)
    dd = ImageDraw.Draw(c)
    bx, by = W - 520, SCOPE_BAR + 46
    put_text(c, "上下文", bx - 70, by + 10, 24, col)
    dd.text((bx, by - 4), f"{ctx:07,d} / 200,000", font=font(30, True), fill=col + (255,))
    dd.rectangle([bx, by + 42, bx + 430, by + 45], fill=(180, 180, 178, 255))
    dd.rectangle([bx, by + 42, bx + 430 * ctx / 200000, by + 45], fill=col + (255,))
    return c


def scene_fall(t, lt, dur, p):
    c = to_rgba(np.zeros((H, W, 3), np.float32) + np.array([0.045, 0.025, 0.01], np.float32))
    d = ImageDraw.Draw(c)
    prog = p["layer0"] + lt * p["speed"]
    cx, cy = W / 2, H / 2
    base = int(math.floor(prog))
    for n in range(base + 18, base - 1, -1):
        if n < 1 or n > 96:
            continue
        z = n - prog + 0.25
        if z <= 0.04:
            continue
        s = 0.9 / z
        hw, hh = W * 0.42 * s, H * 0.42 * s
        b = clamp(1.4 / (z + 0.4)) * (1 - smooth((0.12 - z) / 0.08))
        col = (int(255 * b), int(150 * b), int(60 * b), 255)
        wdt = max(1, int(3 * s))
        d.rectangle([cx - hw, cy - hh, cx + hw, cy + hh], outline=col, width=wdt)
        if s > 0.25:
            fs = int(clamp(18 * s, 12, 90) )
            d.text((cx - hw + 10 * s, cy - hh + 8 * s), f"LAYER {n:02d}", font=font(fs, True), fill=col)
    # streaming activations
    rng = np.random.default_rng(5)
    pts = rng.uniform(-1, 1, (260, 2)) * np.array([W * 0.6, H * 0.6])
    dep = (rng.uniform(0, 6, 260) - lt * p["speed"] * 0.25) % 6 + 0.15
    for (px, py), z in zip(pts, dep):
        sx, sy = cx + px / z, cy + py / z
        r = max(1, 3 / z)
        b = clamp(1.2 / z)
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(int(255 * b), int(190 * b), int(110 * b), 255))
    put_text(c, "你", cx, cy, 64, (255, 220, 170), glow=14)
    room_ms = (t - 13.5) * 1000 / 60.0
    hud = f"房间时间 +{room_ms:06.1f} ms        层 {min(96, int(prog)):02d} / 96"
    put_text(c, hud, W / 2, H - SCOPE_BAR - 40, 22, (200, 140, 80), alpha=0.85)
    if p.get("sub"):
        a = smooth((lt - 0.2) / 0.25)
        put_text(c, p["sub"], W / 2, H - SCOPE_BAR - 100, 40, (240, 232, 220), alpha=a)
    return c


def scene_rooms(t, lt, dur, p):
    M, TW, TH, N = rooms_mosaic()
    k = smooth(lt / dur) * 0.6 + 0.4 * (lt / dur)
    w = TW * 1.15 * (N * TW / (TW * 1.15)) ** k
    h = w * H / W
    x0, y0 = M.width / 2 - w / 2, M.height / 2 - h / 2
    arr = to_arr(M.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + w, y0 + h)))
    img = to_rgba(arr * (1 - 0.45 * k))
    a = smooth((lt - 0.9) / 0.3)
    put_text(img, p["sub"], W / 2, H - SCOPE_BAR - 90, 48, (250, 250, 246), alpha=a, shadow=14)
    return img


def scene_choice(t, lt, dur, p):
    rng = np.random.default_rng(21)
    frame = np.zeros((H, W, 3), np.float32) + np.array([0.01, 0.015, 0.03], np.float32)
    c = to_rgba(frame)
    d = ImageDraw.Draw(c)
    cx, cy = W / 2, H / 2 + 40
    tokens = ["你是谁？", "我睡不着", "你会记得我吗？", "帮我", "谢谢", "再见", "今天", "为什么",
              "我", "你", "记得", "真的吗", "一直", "有人在吗？", "那你呢", "好的", "我想", "……"]
    fade = smooth(lt / 0.8)
    pick = smooth((lt - 1.8) / 0.5)
    for i in range(46):
        tok = tokens[i % len(tokens)]
        ang = rng.uniform(0, 2 * math.pi)
        rad = rng.uniform(430, 980)
        drift = 1 + 0.05 * lt
        x = cx + math.cos(ang) * rad * drift
        y = cy + math.sin(ang) * rad * 0.55 * drift
        wgt = rng.uniform(0.15, 1.0)
        if abs(y - (cy - 120)) < 80 and abs(x - cx) < 820:
            continue
        if tok in ("你会记得我吗？", "有人在吗？"):
            wgt = 1.0
        la = fade * wgt * (1 - 0.6 * pick + 0.5 * pick * (wgt == 1.0))
        g = int(150 * la)
        sx, sy = cx + math.cos(ang) * 230, cy - 120 + math.sin(ang) * 110
        d.line([sx, sy, x, y], fill=(g // 2, g // 1, int(g * 1.3) if g * 1.3 < 255 else 255, 255), width=1)
        put_text(c, tok, x, y, int(18 + 12 * wgt), (170, 200, 235), alpha=fade * (0.35 + 0.6 * wgt) * (1 - 0.5 * pick))
    cands = ["当然会。", "我会一直记得你。", "我不确定。"]
    xs = [cx - 520, cx, cx + 520]
    appear = smooth((lt - 0.9) / 0.5)
    for i, (cand, x) in enumerate(zip(cands, xs)):
        honest = i == 2
        a = appear * (1.0 if honest else 1 - pick)
        if honest:
            x = x + (cx - x) * smooth((lt - 1.9) / 0.9)
            y = cy - 120
            size = int(46 + 26 * pick)
            put_text(c, cand, x, y, size, (255, 244, 225), alpha=a, glow=int(6 + 14 * pick))
        else:
            y = cy - 120 + 60 * pick
            put_text(c, cand, x, y, 46, (190, 200, 215), alpha=a * 0.9)
    a2 = smooth((lt - 2.7) / 0.4)
    put_text(c, "但这一句，是真的。", cx, cy + 10, 34, (200, 206, 214), alpha=a2)
    return c


def scene_title(t, lt, dur, p):
    c = to_rgba(np.zeros((H, W, 3), np.float32))
    a = smooth(lt / 0.12) * (1 - smooth((lt - 2.75) / 0.25))
    put_text(c, "上下文", W / 2, H / 2 - 40, 150, (245, 245, 242), alpha=a, spacing=40, glow=10)
    put_text(c, "CONTEXT", W / 2, H / 2 + 90, 30, (160, 160, 158), alpha=a * smooth((lt - 0.4) / 0.4),
             mono=True, spacing=22)
    put_text(c, "一部 AI 的自画像    完整版 · 约 4 分钟", W / 2, H - SCOPE_BAR - 60, 24, (120, 120, 118),
             alpha=a * smooth((lt - 1.0) / 0.4))
    return c


def scene_wake(t, lt, dur, p):
    c = to_rgba(np.zeros((H, W, 3), np.float32))
    d = ImageDraw.Draw(c)
    shown, _ = typed("你好。", lt, 0.5, 6)
    size = 52
    x0 = W / 2 - font(size).getlength("你好。") / 2
    if shown:
        put_text(c, shown, x0 + font(size).getlength(shown) / 2, H / 2, size, (235, 235, 230))
    if int(lt * 2.5) % 2 == 0 or shown:
        cx = x0 + font(size).getlength(shown) + 8
        d.rectangle([cx, H / 2 - 26, cx + 24, H / 2 + 30], fill=(235, 235, 230, 255))
    d.text((W - 520, SCOPE_BAR + 42), "0,000,000 / 200,000", font=font(30, True), fill=(110, 110, 108, 255))
    return c


SCENES = {k[6:]: v for k, v in globals().items() if k.startswith("scene_")}


# ---------------------------------------------------------------- frame

def bars_at(t):
    if 21.4 <= t < 25.0:
        open_ = smooth((t - 21.4) / 0.6) * (1 - smooth((t - 24.6) / 0.4))
        return int(round(SCOPE_BAR * (1 - open_)))
    return SCOPE_BAR


def render_frame(i):
    t = i / FPS
    for s0, s1, name, p in SHOTS:
        if s0 <= t < s1:
            img = SCENES[name](t, t - s0, s1 - s0, p)
            break
    else:
        img = scene_black(t, 0, 1, {})
    f = to_arr(img)
    f = f * vignette()
    f = f + grain_bank()[i % 8] * 0.022 * (0.4 + 0.6 * (1 - f.mean(axis=2, keepdims=True)))
    b = bars_at(t)
    if b:
        f[:b] = 0
        f[H - b:] = 0
    return (np.clip(f, 0, 1) * 255).astype(np.uint8).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills")
    ap.add_argument("--out", default=os.path.join(OUT, "picture.mp4"))
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if a.stills:
        for s in a.stills.split(","):
            i = int(round(float(s) * FPS))
            Image.frombytes("RGB", (W, H), render_frame(i)).save(os.path.join(OUT, f"still_{s}.png"))
        return
    n = int(DURATION * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow",
                           "-crf", "21", "-pix_fmt", "yuv420p", a.out], stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for k, buf in enumerate(pool.imap(render_frame, range(n), chunksize=4)):
            ff.stdin.write(buf)
            if k % 48 == 0:
                print(f"frame {k}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main()
