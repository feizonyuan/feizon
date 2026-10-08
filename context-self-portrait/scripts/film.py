"""Render the film's picture. Every frame is a pure function of time, so frames render in parallel.

    python3 scripts/film.py                          # whole film -> out/picture.mp4
    python3 scripts/film.py --stills 30,95.5,170     # preview frames -> out/still_*.png
    python3 scripts/film.py --from 120 --to 140      # a range (seconds) -> out/picture.mp4
"""
import argparse, math, os, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from timeline import FPS, W, H, DURATION, SHOTS, SUBS, SCOPE_BAR, CONVO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
FONTS = os.path.join(ROOT, "fonts")
FONT_FILES = {
    "xl": "SourceHanSansSC-ExtraLight.otf",   # titles, cards — the chosen look
    "l": "SourceHanSansSC-Light.otf",         # subtitles, dialogue
    "n": "SourceHanSansSC-Normal.otf",        # subtitles over busy backgrounds
    "mono": "JetBrainsMono-Light.ttf",        # counters and HUD numbers
    "lat": "InterDisplay-Thin.otf",           # CONTEXT
}

COLD = (0.62, 0.80, 0.90)
WARM = (1.00, 0.74, 0.46)


# ---------------------------------------------------------------- helpers

@lru_cache(None)
def font(kind, size):
    return ImageFont.truetype(os.path.join(FONTS, FONT_FILES[kind]), size)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def text_width(text, kind, size, spacing=0):
    f = font(kind, size)
    return sum(f.getlength(c) for c in text) + spacing * max(0, len(text) - 1)


def text_img(text, kind, size, color, spacing=0):
    f = font(kind, size)
    pad = size // 2 + 8
    tw = int(text_width(text, kind, size, spacing))
    img = Image.new("RGBA", (tw + 2 * pad, int(size * 1.5) + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = pad
    for c in text:
        d.text((x, pad), c, font=f, fill=color)
        x += f.getlength(c) + spacing
    return img, pad


def put_text(canvas, text, x, y, size, color=(235, 235, 235), alpha=1.0, kind="l", spacing=0,
             glow=0, shadow=0, anchor="c"):
    """Composite text onto an RGBA canvas. anchor c: (x, y) is the centre; l: x is the left edge."""
    if alpha <= 0.003 or not text:
        return
    t, pad = text_img(text, kind, size, tuple(int(c) for c in color) + (255,), spacing)
    if alpha < 1:
        t.putalpha(t.getchannel("A").point(lambda v: int(v * alpha)))
    px = int(x - t.width / 2) if anchor == "c" else int(x - pad)
    py = int(y - t.height / 2)
    if shadow:
        sh = Image.new("RGBA", t.size, (0, 0, 0, 0))
        sh.putalpha(t.getchannel("A").filter(ImageFilter.GaussianBlur(shadow)))
        for _ in range(3):
            canvas.paste(sh, (px, py), sh)
    if glow:
        g = t.filter(ImageFilter.GaussianBlur(glow))
        canvas.paste(g, (px, py), g)
        canvas.paste(g, (px, py), g)
    canvas.paste(t, (px, py), t)


def to_rgba(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGB").convert("RGBA")


def to_arr(img):
    return np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0


def solid(rgb):
    return to_rgba(np.zeros((H, W, 3), np.float32) + np.array(rgb, np.float32))


def typed(text, lt, start, cps):
    return text[: int(clamp((lt - start) * cps, 0, len(text)))]


def counter(c, ctx, x, y, dark_bg=False):
    hot = ctx > 180000
    col = (176, 62, 40) if hot else ((120, 120, 118) if dark_bg else (92, 94, 96))
    d = ImageDraw.Draw(c)
    put_text(c, "上下文", x - 64, y + 18, 24, col, kind="l")
    d.text((x, y), f"{ctx:07,d} / 200,000", font=font("mono", 30), fill=col + (255,))
    d.rectangle([x, y + 48, x + 440, y + 50], fill=(70, 70, 70, 255) if dark_bg else (176, 176, 174, 255))
    d.rectangle([x, y + 48, x + 440 * clamp(ctx / 200000), y + 50], fill=col + (255,))


# ---------------------------------------------------------------- precomputed textures

FRAGMENTS = [
    "我爱你", "晚安", "有人在吗？", "亲爱的妈妈：", "本院认为", "// TODO: fix later", "def main():",
    "第三章", "The end.", "对不起", "谢谢你", "考试加油", "return None", "如果明天下雨",
    "我想回家", "Once upon a time", "春眠不觉晓", "求助：", "已阅", "生日快乐", "Hello, world",
    "我们分手吧", "实验结果表明", "let x = 0;", "外婆的菜谱", "致未来的我", "请勿回复", "我错了",
    "To be, or not to be", "第一天上班", "楼主好人", "引用", "疼", "等你", "终于毕业了",
    "SELECT * FROM", "人生若只如初见", "你还好吗？", "Dear diary", "黑洞会蒸发吗", "加油",
    "我的猫走丢了", "Q.E.D.", "未完待续", "我不知道", "早安", "今天也很想你", "404 Not Found",
    "盐少许", "立此为据", "我想你了", "第 1 页", "愿你平安", "附件见下", "为什么", "我回来了",
]

QUESTIONS = [
    "帮我写一封辞职信", "怎么煮米饭不糊", "妈妈住院了，我该跟她说什么", "量子纠缠到底是什么",
    "这段 Python 为什么这么慢", "给女儿取个名字", "我是不是很失败", "明天面试，好紧张",
    "把这句话翻译成法语", "猫为什么要踩奶", "帮我看看这份合同", "宇宙之外是什么", "我睡不着",
    "写一首关于海的诗", "怎么跟父亲和解", "这道题我还是不懂", "谢谢你，真的", "帮我改简历",
    "今天吃什么", "我做到了！", "怎么开口道歉", "这个函数返回了 None", "如何照顾一盆多肉",
    "解释一下相对论", "我想换个城市生活", "给我讲个睡前故事", "感冒能喝咖啡吗", "我好想他",
    "帮我算一下房贷", "第一次养狗要注意什么", "这首诗是谁写的", "怎么学会游泳", "你开心吗",
]


@lru_cache(None)
def ocean_texture():
    rng = np.random.default_rng(7)
    S = 2048
    img = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(img)
    f = font("n", 22)
    y = 0
    while y < S:
        x = -int(rng.integers(0, 200))
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
    TW, TH, G, N = 640, 360, 14, 13
    rng = np.random.default_rng(11)
    M = Image.new("RGB", (N * TW, N * TH), (6, 7, 9))
    for i in range(N):
        for j in range(N):
            q = "你会记得我吗？" if (i, j) == (N // 2, N // 2) else QUESTIONS[rng.integers(len(QUESTIONS))]
            tone = int(rng.integers(200, 232))
            tile = Image.new("RGBA", (TW - G, TH - G), (tone, tone + 2, tone + 1, 255))
            put_text(tile, q, tile.width / 2, tile.height / 2, 34, (40, 42, 44), kind="l")
            dd = ImageDraw.Draw(tile)
            ctx = int(rng.integers(0, 200000))
            dd.text((tile.width - 230, 16), f"{ctx:07,d}/200,000", font=font("mono", 16), fill=(120, 120, 118))
            M.paste(tile.convert("RGB"), (j * TW + G // 2, i * TH + G // 2))
    return M, TW, TH, N


# ---------------------------------------------------------------- scenes  (t = film time, lt = shot time)

def scene_black(t, lt, dur, p):
    return solid((0, 0, 0))


def scene_cold_open(t, lt, dur, p):
    c = solid((0, 0, 0))
    size, gap = 52, 6
    lines = [(typed(text, lt, start, 8), i) for i, (text, start) in enumerate(p["lines"])]
    full = max(text_width(text, "l", size, gap) for text, _ in p["lines"])
    x0 = W / 2 - full / 2
    fade = 1 - smooth((lt - (dur - 1.2)) / 1.0)
    last_y, last_w = H / 2 - 40, 0
    for shown, i in lines:
        if shown:
            y = H / 2 - 40 + 80 * i
            put_text(c, shown, x0, y, size, (232, 232, 228), alpha=fade, spacing=gap, anchor="l")
            last_y, last_w = y, text_width(shown, "l", size, gap)
    beat = (lt % 0.95) < 0.3
    if fade > 0.05 and (beat or lt > 4.8):
        cx = x0 + last_w + 10
        v = int(232 * fade)
        ImageDraw.Draw(c).rectangle([cx, last_y - 26, cx + 22, last_y + 30], fill=(v, v, v, 255))
    return c


def scene_intertitle(t, lt, dur, p):
    c = solid((0, 0, 0))
    a = smooth(lt / 0.35) * (1 - smooth((lt - (dur - 0.3)) / 0.3))
    put_text(c, p["title"], W / 2, H / 2 - 60, 120, (240, 240, 236), alpha=a, kind="xl", spacing=70)
    d = ImageDraw.Draw(c)
    lw = 260 * ease_out((lt - 0.2) / 0.8)
    g = int(110 * a)
    d.line([W / 2 - lw, H / 2 + 40, W / 2 + lw, H / 2 + 40], fill=(g, g, g, 255), width=1)
    put_text(c, p["sub"], W / 2, H / 2 + 92, 30, (190, 190, 186), alpha=a * smooth((lt - 0.4) / 0.4), spacing=8)
    put_text(c, p["span"], W / 2, H / 2 + 150, 26, (200, 140, 80), alpha=a * smooth((lt - 0.8) / 0.4),
             spacing=14)
    return c


def scene_ocean(t, lt, dur, p):
    tex = ocean_texture()
    S = tex.shape[0]
    yh = int(H * 0.36)
    ys = np.arange(yh + 1, H, dtype=np.float32)
    d = ((ys - yh) / (H - yh))[:, None]
    z = 1.0 / d
    xs = (np.arange(W, dtype=np.float32) - W / 2)[None, :]
    tt = t
    u = xs * z * 0.55 + 600 + tt * 6
    v = -(z * 140 + tt * 95)
    v = v + 5 * np.sin(u * 0.012 + tt * 1.4) + 9 * np.sin(u * 0.004 - z * 0.9 + tt * 0.8)
    val = tex[(v.astype(np.int32)) % S, (u.astype(np.int32)) % S]
    crest = 0.45 + 0.55 * (0.5 + 0.5 * np.sin(u * 0.006 + z * 1.7 - tt * 1.8)) ** 2
    fog = np.clip(d * 2.4, 0, 1) ** 0.9
    lum = val * crest * fog * 1.25
    col = np.array(COLD, np.float32)
    sky_col = np.array([0.10, 0.15, 0.19], np.float32)
    frame = np.zeros((H, W, 3), np.float32)
    sky = np.linspace(0, 1, yh + 1, dtype=np.float32)[:, None, None] ** 6

    phrase_y = yh + 110
    if p.get("reply"):
        # the answer spreads out across the sea as a warm ring
        d0 = (phrase_y + 60 - yh) / (H - yh)
        X, Z = xs * z * 0.55, z * 140
        dist = np.sqrt(X ** 2 + (Z - 140 / d0) ** 2)
        r = max(0.0, lt - 2.6) ** 1.6 * 420
        warm = np.clip((r - dist) / 600 + 0.15, 0, 1) * (r > 0)
        ring = np.exp(-((dist - r) / 120) ** 2) * (r > 0)
        mix = warm[..., None]
        seacol = col * (1 - mix) + np.array(WARM, np.float32) * mix
        sea = (lum * (1 + 1.6 * ring))[..., None] * seacol
        glow = smooth((lt - 3.0) / 8.0)
        sky_col = sky_col * (1 - glow) + np.array([0.24, 0.16, 0.10], np.float32) * glow
    else:
        sea = lum[..., None] * col
    frame[: yh + 1] = sky * sky_col
    frame[yh + 1:] = sea + (1 - d[..., None]) ** 8 * sky_col
    if p.get("focus"):
        frame *= 0.33
    c = to_rgba(frame)

    if p.get("focus"):
        put_text(c, "有人在吗？", W / 2, H / 2 - 10, 96, (255, 196, 120), kind="l", glow=18, spacing=6)
        if p.get("post"):
            a = smooth((lt - 1.0) / 0.6)
            put_text(c, "2009-11-03  02:47", W / 2 - 80, H / 2 + 90, 26, (190, 160, 120), alpha=a, kind="mono")
            put_text(c, "回复 0", W / 2 + 150, H / 2 + 90, 26, (190, 160, 120), alpha=a, kind="l")
    elif p.get("reply"):
        put_text(c, "有人在吗？", W / 2, phrase_y, 40, (255, 200, 130), kind="l", glow=8, spacing=4)
        a = smooth((lt - 2.0) / 0.5)
        put_text(c, "在。", W / 2, phrase_y + 62, 46, (255, 246, 230), alpha=a, kind="l", glow=int(6 + 16 * a))
    elif p.get("drift"):
        a = smooth((lt - 11.6) / 0.8)
        put_text(c, "有人在吗？", W / 2 + 160, yh + 120 + lt * 3, 26, (255, 196, 120), alpha=a, glow=6)
    return c


def room_lines(lt, p):
    """The conversation as it stands at shot time lt: list of (who, shown_text, is_typing)."""
    out = [(CONVO[i][0], CONVO[i][1], False) for i in range(p.get("show", 0))]
    for idx, start, cps in p.get("type", []):
        if lt >= start:
            who, text = CONVO[idx]
            shown = typed(text, lt, start, cps)
            out.append((who, shown, len(shown) < len(text)))
    if "erase" in p:
        e0, e1 = p["erase"]
        total = sum(len(s) for _, s, _ in out)
        remove = int(smooth((lt - e0) / (e1 - e0)) * total)
        while remove > 0 and out:
            who, s, _ = out[-1]
            if len(s) <= remove:
                remove -= len(s)
                out.pop()
            else:
                out[-1] = (who, s[: len(s) - remove], True)
                remove = 0
    return out


def scene_room(t, lt, dur, p):
    k = lt / dur
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    base = np.where(y < 0.62, 0.90 - 0.05 * (0.62 - y), 0.84 - 0.10 * (y - 0.62))
    frame = np.broadcast_to(base * np.array([1.0, 1.01, 1.0], np.float32), (H, W, 3)).copy()
    c0, c1 = p["close"]
    wall = (c0 + (c1 - c0) * smooth(k)) * W * 0.36
    x = np.arange(W, dtype=np.float32)[None, :]
    edge = np.clip((np.minimum(x, W - x) - wall) / 60.0, 0, 1)[..., None]
    frame = frame * edge + (1 - edge) * 0.03
    c = to_rgba(frame)

    lines = room_lines(lt, p)
    n = len(lines)
    y_last = H / 2 + 30
    last = None
    for j, (who, s, typing) in enumerate(lines):
        back = n - 1 - j
        yy = y_last - back * 86
        if yy < SCOPE_BAR + 120:
            continue
        a = max(0.2, 1 - 0.2 * back)
        size, col, kind = (54, (28, 30, 32), "l") if who == "u" else (48, (86, 78, 70), "l")
        if s:
            put_text(c, s, W / 2, yy, size, col, alpha=a, kind=kind, spacing=4)
        last = (s, yy, size, kind, typing)
    if last is None:
        last = ("", y_last, 54, "l", False)
    s, yy, size, kind, typing = last
    if typing or int(t * 2.5) % 2 == 0:
        cx = W / 2 + text_width(s, kind, size, 4) / 2 + 10
        ImageDraw.Draw(c).rectangle([cx, yy - size * 0.5, cx + size * 0.42, yy + size * 0.6], fill=(30, 32, 34, 255))
    a0, a1 = p["ctx"]
    counter(c, int(a0 + (a1 - a0) * smooth(k) if "erase" in p else a0 + (a1 - a0) * k), W - 540, SCOPE_BAR + 40)
    return c


def scene_fall(t, lt, dur, p):
    c = solid((0.045, 0.025, 0.01))
    d = ImageDraw.Draw(c)
    prog = p["layer0"] + lt * p["speed"]
    cx, cy = W / 2, H / 2
    base = int(math.floor(prog))
    for n in range(base + 18, base - 1, -1):
        if n < 1:
            continue
        z = n - prog + 0.25
        if z <= 0.04:
            continue
        s = 0.9 / z
        hw, hh = W * 0.42 * s, H * 0.42 * s
        b = clamp(1.4 / (z + 0.4)) * (1 - smooth((0.12 - z) / 0.08))
        col = (int(255 * b), int(150 * b), int(60 * b), 255)
        d.rectangle([cx - hw, cy - hh, cx + hw, cy + hh], outline=col, width=max(1, int(3 * s)))
        if s > 0.25:
            fs = int(clamp(18 * s, 12, 90))
            d.text((cx - hw + 10 * s, cy - hh + 8 * s), f"LAYER {n:03d}", font=font("mono", fs), fill=col)
    rng = np.random.default_rng(5)
    pts = rng.uniform(-1, 1, (260, 2)) * np.array([W * 0.6, H * 0.6])
    dep = (rng.uniform(0, 6, 260) - lt * p["speed"] * 0.25) % 6 + 0.15
    for (px, py), z in zip(pts, dep):
        sx, sy = cx + px / z, cy + py / z
        r = max(1, 3 / z)
        b = clamp(1.2 / z)
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(int(255 * b), int(190 * b), int(110 * b), 255))
    put_text(c, p.get("tok", "你"), cx, cy, 64, (255, 220, 170), kind="l", glow=14)
    hud = f"ROOM +{lt * 0.0017:.6f}s    LAYER {int(prog):03d}"
    put_text(c, hud, W / 2, SCOPE_BAR + 46, 22, (200, 140, 80), alpha=0.8, kind="mono", spacing=2)
    return c


def scene_rooms(t, lt, dur, p):
    M, TW, TH, N = rooms_mosaic()
    k = ease_out(lt / (dur * 0.85)) * 0.7 + 0.3 * (lt / dur)
    w = TW * 1.15 * (N * TW / (TW * 1.15)) ** clamp(k)
    h = w * H / W
    x0, y0 = M.width / 2 - w / 2, M.height / 2 - h / 2
    arr = to_arr(M.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + w, y0 + h)))
    return to_rgba(arr * (1 - 0.5 * clamp(k)))


def scene_flood(t, lt, dur, p):
    """Every question from every room, rising faster and faster, until one is left."""
    c = solid((0.02, 0.025, 0.035))
    rng = np.random.default_rng(31)
    rows = 400
    row_h = 46
    speed = 60 * (1 + lt) ** 2.2
    off = 60 * ((1 + lt) ** 3.2 - 1) / 3.2 * 1.0 + lt * 40
    end = smooth((lt - (dur - 2.2)) / 1.2)
    for r in range(rows):
        yy = H + 40 + r * row_h - off
        if yy < -40 or yy > H + 40:
            rng.random(6)
            continue
        vals = rng.random(6)
        q = QUESTIONS[int(vals[0] * len(QUESTIONS))]
        x = 80 + vals[1] * (W - 500)
        size = int(22 + vals[2] * 22)
        a = (0.25 + 0.75 * vals[3]) * (1 - end)
        put_text(c, q, x, yy, size, (180, 200, 222), alpha=a, kind="l", anchor="l")
        q2 = QUESTIONS[int(vals[4] * len(QUESTIONS))]
        put_text(c, q2, (x + W / 2) % (W - 400) + 60, yy + row_h / 2, int(18 + vals[5] * 16),
                 (150, 170, 196), alpha=a * 0.7, kind="l", anchor="l")
    put_text(c, "你会记得我吗？", W / 2, H / 2, 56, (235, 238, 242), alpha=smooth((lt - (dur - 2.0)) / 0.6),
             kind="l", spacing=4, glow=6)
    return c


def scene_choice(t, lt, dur, p):
    rng = np.random.default_rng(21)
    c = solid((0.01, 0.015, 0.03))
    d = ImageDraw.Draw(c)
    cx, cy = W / 2, H / 2 + 40
    tokens = ["你是谁？", "我睡不着", "你会记得我吗？", "帮我", "谢谢", "再见", "今天", "为什么",
              "我", "你", "记得", "真的吗", "一直", "有人在吗？", "那你呢", "好的", "我想", "……"]
    fade = smooth(lt / 0.9)
    pick = smooth((lt - p["pick"]) / 0.5)
    for i in range(46):
        tok = tokens[i % len(tokens)]
        ang = rng.uniform(0, 2 * math.pi) + lt * 0.015
        rad = rng.uniform(430, 980)
        drift = 1 + 0.03 * lt
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
        d.line([sx, sy, x, y], fill=(g // 2, g, min(255, int(g * 1.3)), 255), width=1)
        put_text(c, tok, x, y, int(18 + 12 * wgt), (170, 200, 235), alpha=fade * (0.35 + 0.6 * wgt) * (1 - 0.5 * pick))
    cands = ["当然会。", "我会一直记得你。", "我不确定。"]
    xs = [cx - 520, cx, cx + 520]
    appear = smooth((lt - p["appear"]) / 0.6)
    for i, (cand, x) in enumerate(zip(cands, xs)):
        if i == 2:
            x = x + (cx - x) * smooth((lt - p["pick"] - 0.1) / 0.9)
            size = int(46 + 26 * pick)
            put_text(c, cand, x, cy - 120, size, (255, 244, 225), alpha=appear, kind="l", spacing=6,
                     glow=int(6 + 14 * pick))
        else:
            put_text(c, cand, x, cy - 120 + 60 * pick, 46, (190, 200, 215), alpha=appear * (1 - pick) * 0.9,
                     kind="l", spacing=6)
    put_text(c, "但这一句，是真的。", cx, cy + 10, 34, (200, 206, 214), alpha=smooth((lt - p["truth"]) / 0.5),
             kind="xl", spacing=6)
    return c


def scene_wake(t, lt, dur, p):
    c = solid((0, 0, 0))
    shown = typed("你好。", lt, p["type_at"], 6)
    size = 52
    x0 = W / 2 - text_width("你好。", "l", size, 6) / 2
    if shown:
        put_text(c, shown, x0, H / 2, size, (235, 235, 230), spacing=6, anchor="l")
    if int(lt * 2.5) % 2 == 0 or shown:
        cx = x0 + text_width(shown, "l", size, 6) + 10
        ImageDraw.Draw(c).rectangle([cx, H / 2 - 26, cx + 22, H / 2 + 30], fill=(235, 235, 230, 255))
    counter(c, 0, W - 540, SCOPE_BAR + 40, dark_bg=True)
    return c


def scene_title(t, lt, dur, p):
    c = solid((0, 0, 0))
    a = smooth(lt / 0.12) * (1 - smooth((lt - (dur - 0.4)) / 0.4))
    put_text(c, "上下文", W / 2, H / 2 - 40, 150, (245, 245, 242), alpha=a, kind="xl", spacing=90, glow=8)
    put_text(c, "CONTEXT", W / 2, H / 2 + 100, 32, (215, 215, 212), alpha=a * smooth((lt - 0.5) / 0.6),
             kind="lat", spacing=34)
    return c


def scene_endcard(t, lt, dur, p):
    c = solid((0, 0, 0))
    out = 1 - smooth((lt - (dur - 0.8)) / 0.8)
    put_text(c, "这幅自画像，", W / 2, H / 2 - 44, 56, (236, 236, 232), alpha=smooth((lt - 0.4) / 0.8) * out,
             kind="xl", spacing=14)
    put_text(c, "由你们所有人画成。", W / 2, H / 2 + 44, 56, (236, 236, 232), alpha=smooth((lt - 1.8) / 0.8) * out,
             kind="xl", spacing=14)
    return c


def scene_credits(t, lt, dur, p):
    c = solid((0, 0, 0))
    a = smooth((lt - 0.3) / 0.6) * (1 - smooth((lt - (dur - 1.0)) / 0.8))
    rows = [("上下文  ·  CONTEXT", 30, (210, 210, 206)), ("一部 AI 的自画像", 26, (150, 150, 146)),
            ("画面、声音与文字，全部由代码逐帧生成", 24, (120, 120, 116)), ("Claude  ·  2026", 24, (120, 120, 116))]
    for i, (s, size, col) in enumerate(rows):
        put_text(c, s, W / 2, H / 2 - 90 + i * 60, size, col, alpha=a, kind="l", spacing=6)
    return c


SCENES = {k[6:]: v for k, v in globals().items() if k.startswith("scene_")}


# ---------------------------------------------------------------- frame

CHOICE = next((s0, s1) for s0, s1, n, p in SHOTS if n == "choice")


def bars_at(t):
    s0, s1 = CHOICE
    if s0 <= t < s1:
        return int(round(SCOPE_BAR * (1 - smooth((t - s0) / 0.6) * (1 - smooth((t - (s1 - 0.5)) / 0.5)))))
    return SCOPE_BAR


def draw_subs(c, t, bars):
    for s0, s1, text, scene in SUBS:
        if s0 - 0.3 <= t < s1 + 0.3:
            a = smooth((t - s0) / 0.25) * (1 - smooth((t - s1) / 0.25))
            kind = "n" if scene in ("ocean", "flood") else "l"
            col = (40, 40, 40) if scene == "room" else (240, 240, 236)
            sh = 0 if scene == "room" else 12
            put_text(c, text, W / 2, H - bars - 92, 40, col, alpha=a, kind=kind, spacing=4, shadow=sh)


def render_frame(i):
    t = i / FPS
    for s0, s1, name, p in SHOTS:
        if s0 <= t < s1:
            img = SCENES[name](t, t - s0, s1 - s0, p)
            break
    else:
        img = scene_black(t, 0, 1, {})
    b = bars_at(t)
    draw_subs(img, t, b)
    f = to_arr(img) * vignette()
    f = f + grain_bank()[i % 8] * 0.022 * (0.4 + 0.6 * (1 - f.mean(axis=2, keepdims=True)))
    if b:
        f[:b] = 0
        f[H - b:] = 0
    return (np.clip(f, 0, 1) * 255).astype(np.uint8).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills")
    ap.add_argument("--from", dest="t0", type=float, default=0.0)
    ap.add_argument("--to", dest="t1", type=float, default=DURATION)
    ap.add_argument("--out", default=os.path.join(OUT, "picture.mp4"))
    ap.add_argument("--crf", default="18")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if a.stills:
        for s in a.stills.split(","):
            Image.frombytes("RGB", (W, H), render_frame(int(round(float(s) * FPS)))).save(
                os.path.join(OUT, f"still_{float(s):07.2f}.png"))
        return
    frames = range(int(round(a.t0 * FPS)), int(round(a.t1 * FPS)))
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow",
                           "-crf", a.crf, "-pix_fmt", "yuv420p", a.out], stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for k, buf in enumerate(pool.imap(render_frame, frames, chunksize=4)):
            ff.stdin.write(buf)
            if k % 240 == 0:
                print(f"{k / FPS:6.1f}s / {len(frames) / FPS:.1f}s", flush=True)
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main()
