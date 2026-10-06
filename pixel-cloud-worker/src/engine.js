'use strict';
// Pixel-art engine: a 480x270 world drawn with integer rects, upscaled 4x to 1080p.
// Everything is a pure function of time t so any frame can be rendered independently.

const W = 480, H = 270, MARGIN = 8;

const P = {
  ink: '#2b2a27', ink2: '#45423c', ink3: '#5e5a55',
  paper: '#fbf8f1', cream: '#f0eee6', sand: '#e3dacc', sand2: '#cbbfae', sand3: '#a89d8d',
  clay: '#d97757', clay2: '#b85c3e', clay3: '#f2a283', clay4: '#8f4430',
  gold: '#f2c14e', gold2: '#e09b2d', gold3: '#fff1c2',
  teal: '#4fb3a9', teal2: '#2f7f78', teal3: '#a6e3d9',
  sky1: '#fbeedd', sky2: '#f7dfc4', sky3: '#f2cba6', sky4: '#eab48e',
  night1: '#17161c', night2: '#24212c', night3: '#3a3346',
  dusk1: '#3b2f4f', dusk2: '#6b4562', dusk3: '#b65f5f', dusk4: '#e48a62',
  white: '#ffffff', grey: '#9a948c', grey2: '#6d6862', steel: '#7f8a93', steel2: '#5b646c', steel3: '#b4bec6',
  red: '#e0503c', red2: '#a8322a', pink: '#f4a7a0', blue: '#6c9bd2', purple: '#8e6cc4', green: '#7cc47f',
};
const CONFETTI = [P.clay, P.gold, P.teal, P.paper, P.pink, P.blue, P.purple, P.green];

let g = null;
function setCtx(c) { g = c; }
function getCtx() { return g; }

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInCubic = t => t * t * t;
const easeInQuad = t => t * t;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutElastic = t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
function rnd(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
// Pop: 0 before t0, overshoots to 1 after.
const pop = (t, t0, d = 0.35) => (t < t0 ? 0 : easeOutBack(seg(t, t0, t0 + d)));

// ---------- primitives ----------
function R(x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function px(x, y, c) { R(x, y, 1, 1, c); }
function disc(cx, cy, r, c) {
  g.fillStyle = c;
  cx = Math.round(cx); cy = Math.round(cy); r = Math.max(0, Math.round(r));
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
    g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}
function ring(cx, cy, r, th, c) {
  const n = Math.max(12, Math.round(r * 7));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    R(cx + Math.cos(a) * r - th / 2, cy + Math.sin(a) * r - th / 2, th, th, c);
  }
}
function line(x0, y0, x1, y1, c, th = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, o = Math.floor(th / 2);
  g.fillStyle = c;
  for (let i = 0; i < 2000; i++) {
    g.fillRect(x0 - o, y0 - o, th, th);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// 4-point twinkle star; `size` = arm length.
function star4(cx, cy, size, c, core) {
  cx = Math.round(cx); cy = Math.round(cy); size = Math.round(size);
  R(cx - size, cy, size * 2 + 1, 1, c);
  R(cx, cy - size, 1, size * 2 + 1, c);
  if (size >= 3) { R(cx - 1, cy - 1, 3, 3, c); }
  if (core) px(cx, cy, core);
}
// The Claude-style spark: many tapered rays radiating from a center.
function spark(cx, cy, r, c, rot = 0, rays = 10) {
  for (let i = 0; i < rays; i++) {
    const a = rot + (i / rays) * Math.PI * 2;
    const len = r * (i % 2 ? 0.78 : 1);
    for (let s = 0; s <= len; s += 0.8) {
      const w = Math.max(1, Math.round((1 - s / len) * r * 0.28));
      R(cx + Math.cos(a) * s - w / 2, cy + Math.sin(a) * s - w / 2, w, w, c);
    }
  }
  disc(cx, cy, Math.max(1, r * 0.22), c);
}
function alpha(a, fn) { const o = g.globalAlpha; g.globalAlpha = o * clamp(a); fn(); g.globalAlpha = o; }

// Ordered-dither vertical gradient through a list of colors.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function ditherGradient(y0, y1, cols, x0 = -MARGIN, x1 = W + MARGIN) {
  const n = cols.length - 1, h = y1 - y0;
  for (let y = Math.floor(y0); y < y1; y++) {
    const f = clamp((y - y0) / h) * n;
    const i = Math.min(n - 1, Math.floor(f)), fr = f - i;
    // band body
    g.fillStyle = cols[i];
    g.fillRect(x0, y, x1 - x0, 1);
    if (fr > 0.02) {
      g.fillStyle = cols[i + 1];
      const th = fr * 16;
      for (let x = x0; x < x1; x++) if (BAYER[((y & 3) << 2) | (x & 3)] < th) g.fillRect(x, y, 1, 1);
    }
  }
}

// ---------- 5x7 bitmap font ----------
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '>': [8, 4, 2, 1, 2, 4, 8],
  '<': [2, 4, 8, 16, 8, 4, 2], '-': [0, 0, 0, 31, 0, 0, 0], '_': [0, 0, 0, 0, 0, 0, 31],
  ':': [0, 12, 12, 0, 12, 12, 0], '/': [1, 1, 2, 4, 8, 16, 16], '+': [0, 4, 4, 31, 4, 4, 0],
  '#': [10, 10, 31, 10, 31, 10, 10], '{': [6, 8, 8, 16, 8, 8, 6], '}': [12, 2, 2, 1, 2, 2, 12],
  '~': [0, 0, 8, 21, 2, 0, 0], "'": [4, 4, 8, 0, 0, 0, 0], '=': [0, 0, 31, 0, 31, 0, 0],
  '*': [0, 21, 14, 31, 14, 21, 0], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
  '&': [12, 18, 20, 8, 21, 18, 13], '%': [24, 25, 2, 4, 8, 19, 3],
};
function textW(str, s = 1) { return str.length * 6 * s - s; }
// Draw 5x7 text. opts: {align:'left'|'center'|'right', shadow:color, outline:color}
function text5(str, x, y, c, s = 1, opts = {}) {
  str = String(str).toUpperCase();
  let w = textW(str, s);
  if (opts.align === 'center') x -= w / 2; else if (opts.align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  const draw = (ox, oy, col) => {
    g.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const gl = FONT[str[i]] || FONT['?'];
      for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++)
        if (gl[r] & (16 >> b)) g.fillRect(x + ox + i * 6 * s + b * s, y + oy + r * s, s, s);
    }
  };
  if (opts.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) draw(dx * Math.max(1, s / 2 | 0), dy * Math.max(1, s / 2 | 0), opts.outline);
  if (opts.shadow) draw(s, s, opts.shadow);
  draw(0, 0, c);
}

// ---------- vector text rendered as hard pixels (for CJK) ----------
const _ptCache = new Map();
function pixelTextCanvas(str, size, color, outline, family = '"WenQuanYi Zen Hei", sans-serif', weight = '') {
  const key = [str, size, color, outline, family, weight].join('|');
  if (_ptCache.has(key)) return _ptCache.get(key);
  const font = `${weight} ${size}px ${family}`;
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const tw = Math.ceil(m.measureText(str).width) + 4, th = Math.ceil(size * 1.35) + 4;
  const c = document.createElement('canvas'); c.width = tw; c.height = th;
  const x = c.getContext('2d');
  x.font = font; x.textBaseline = 'middle'; x.fillStyle = '#000';
  x.fillText(str, 2, th / 2);
  const id = x.getImageData(0, 0, tw, th), d = id.data;
  const mask = new Uint8Array(tw * th);
  for (let i = 0; i < tw * th; i++) mask[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  const out = document.createElement('canvas'); out.width = tw + 2; out.height = th + 2;
  const o = out.getContext('2d');
  if (outline) {
    o.fillStyle = outline;
    for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) if (mask[yy * tw + xx]) o.fillRect(xx, yy, 3, 3);
  }
  o.fillStyle = color;
  for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) if (mask[yy * tw + xx]) o.fillRect(xx + 1, yy + 1, 1, 1);
  _ptCache.set(key, out);
  return out;
}
function ptext(str, x, y, size, color, opts = {}) {
  const c = pixelTextCanvas(str, size, color, opts.outline, opts.family, opts.weight);
  const s = opts.scale || 1;
  let dx = x;
  if (opts.align === 'center') dx -= (c.width * s) / 2; else if (opts.align === 'right') dx -= c.width * s;
  g.drawImage(c, Math.round(dx), Math.round(y - (c.height * s) / 2), c.width * s, c.height * s);
  return c.width * s;
}

// ---------- stateless particles ----------
// burst: n particles born at t0, each a pure function of age.
function burst(t, t0, o) {
  const age = t - t0;
  if (age < 0 || age > (o.life || 1)) return;
  const n = o.n || 20, seed = (o.seed || 1) * 977;
  for (let i = 0; i < n; i++) {
    const s = seed + i * 13;
    const life = (o.life || 1) * (0.55 + 0.45 * rnd(s + 1));
    if (age > life) continue;
    const a = lerp(o.ang ? o.ang[0] : 0, o.ang ? o.ang[1] : Math.PI * 2, rnd(s + 2));
    const sp = lerp(o.spd[0], o.spd[1], rnd(s + 3));
    const k = o.drag || 0;
    const f = k > 0 ? (1 - Math.exp(-k * age)) / k : age;
    const x = o.x + Math.cos(a) * sp * f + (o.jx || 0) * (rnd(s + 5) - 0.5);
    const y = o.y + Math.sin(a) * sp * f + 0.5 * (o.grav || 0) * age * age + (o.jy || 0) * (rnd(s + 6) - 0.5);
    const lt = age / life;
    const sz = Math.max(1, Math.round((o.size || 2) * (1 - lt * (o.shrink == null ? 0.8 : o.shrink))));
    const col = o.colors[Math.floor(rnd(s + 4) * o.colors.length)];
    if (o.draw) o.draw(x, y, sz, col, lt, i);
    else if (o.shape === 'star') star4(x, y, sz, col, P.white);
    else if (o.shape === 'disc') disc(x, y, sz, col);
    else R(x - sz / 2, y - sz / 2, sz, sz, col);
  }
}
// stream: continuous emitter between t0..t1 at `rate`/s. fn(age, birthTime, index)
function stream(t, t0, t1, rate, life, fn) {
  if (t < t0) return;
  const j0 = Math.max(0, Math.floor((t - life - t0) * rate));
  const j1 = Math.floor((Math.min(t, t1) - t0) * rate);
  for (let j = j0; j <= j1; j++) {
    const bt = t0 + j / rate, age = t - bt;
    if (age >= 0 && age <= life) fn(age, bt, j);
  }
}
function smokePuff(x, y, r, col, a = 1) {
  alpha(a, () => { disc(x, y, r, col); disc(x - r * 0.3, y - r * 0.3, r * 0.6, P.white); });
}

// ---------- shared scenery ----------
function cloudBlob(cx, cy, w, h, fill = P.paper, shade = P.sand, outline = P.ink, k = 0) {
  // a puffy cloud made of discs; k varies the lumps
  const n = Math.max(3, Math.round(w / 14));
  const lumps = [];
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0.5 : i / (n - 1);
    const r = h * (0.45 + 0.35 * Math.sin(f * Math.PI)) * (0.85 + 0.3 * rnd(k * 31 + i));
    lumps.push([cx - w / 2 + f * w, cy - r * 0.35, r]);
  }
  if (outline) { for (const [x, y, r] of lumps) disc(x, y, r + 1, outline); R(cx - w / 2 - 1, cy - 1, w + 2, h * 0.45 + 2, outline); }
  for (const [x, y, r] of lumps) disc(x, y, r, shade);
  R(cx - w / 2, cy, w, h * 0.45, shade);
  for (const [x, y, r] of lumps) disc(x - 1, y - 2, r - 2, fill);
  R(cx - w / 2 + 2, cy - 1, w - 4, h * 0.25, fill);
}

// Ground: a big cloud platform. grow 0..1 lets lumps pop in.
function cloudGround(y, grow = 1, t = 0, fill = P.paper, shade = P.sand, outline = P.ink) {
  const lumps = [];
  for (let i = 0; i < 16; i++) {
    const x = -20 + i * 34 + rnd(i * 7) * 10;
    const r = 22 + rnd(i * 3 + 1) * 16;
    const d = i * 0.035;
    const s = grow >= 1 ? 1 : easeOutElastic(clamp((grow - d) / 0.5));
    lumps.push([x, y + 8 - r * 0.4 + Math.sin(t * 1.3 + i) * 0.6, r * s]);
  }
  for (const [x, yy, r] of lumps) if (r > 0) disc(x, yy, r + 1, outline);
  if (grow >= 0.3) R(-MARGIN, y + 8, W + 2 * MARGIN, H - y + MARGIN, outline);
  for (const [x, yy, r] of lumps) if (r > 0) disc(x, yy, r, shade);
  if (grow >= 0.3) R(-MARGIN, y + 9, W + 2 * MARGIN, H - y + MARGIN, shade);
  for (const [x, yy, r] of lumps) if (r > 2) disc(x - 2, yy - 3, r - 3, fill);
  if (grow >= 0.3) {
    R(-MARGIN, y + 12, W + 2 * MARGIN, 34, fill);
  }
}

function daySky(t, cols = [P.sky1, P.sky2, P.sky3, P.sky4], horizon = 210) {
  ditherGradient(-MARGIN, horizon, cols);
  R(-MARGIN, horizon, W + 2 * MARGIN, H + MARGIN - horizon, cols[cols.length - 1]);
  // distant drifting clouds
  for (let i = 0; i < 6; i++) {
    const sp = 4 + rnd(i) * 6;
    const x = ((rnd(i + 9) * (W + 160) + t * sp) % (W + 160)) - 80;
    const y = 24 + rnd(i + 3) * 90;
    const w = 40 + rnd(i + 5) * 50;
    alpha(0.65, () => cloudBlob(x, y, w, 14 + rnd(i) * 8, P.white, cols[1], null, i));
  }
  // sparkles
  for (let i = 0; i < 14; i++) {
    const tw = Math.sin(t * (2 + rnd(i) * 3) + i * 4);
    if (tw > 0.55) star4(rnd(i + 40) * W, rnd(i + 70) * 150, tw > 0.85 ? 2 : 1, P.white);
  }
}

function nightSky(t, a = 1) {
  alpha(a, () => {
    ditherGradient(-MARGIN, H + MARGIN, [P.night1, P.night2, P.night3]);
    for (let i = 0; i < 70; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + rnd(i) * 4) + i);
      const c = tw > 0.8 ? P.white : tw > 0.4 ? P.sand2 : P.ink3;
      const x = rnd(i + 1) * W, y = rnd(i + 200) * H;
      if (tw > 0.93 && i % 3 === 0) star4(x, y, 2, P.white); else px(x, y, c);
    }
  });
}

// speed lines radiating from center or vertical
function speedLines(t, k, cx = W / 2, cy = H / 2, col = P.white) {
  if (k <= 0) return;
  for (let i = 0; i < 40; i++) {
    if (rnd(i + Math.floor(t * 20) * 50) > k) continue;
    const a = rnd(i * 3) * Math.PI * 2;
    const r0 = 120 + rnd(i * 5 + Math.floor(t * 20)) * 80;
    const len = 20 + rnd(i * 7) * 50;
    line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len), col, 1);
  }
}
function vSpeedLines(t, k, col = P.white) {
  for (let i = 0; i < 30; i++) {
    if (rnd(i * 11) > k) continue;
    const x = rnd(i * 17) * W;
    const len = 20 + rnd(i * 5) * 60;
    const y = ((t * (500 + rnd(i) * 400) + rnd(i * 3) * H * 2) % (H + len * 2)) - len;
    R(x, y, 1, len, col);
  }
}

// Comic impact text with burst backdrop
function bangText(str, x, y, t, t0, dur = 0.6, s = 3, col = P.gold, seed = 1) {
  if (t < t0 || t > t0 + dur) return;
  const k = pop(t, t0, 0.18), fade = seg(t, t0 + dur - 0.15, t0 + dur);
  if (fade >= 1) return;
  const ss = Math.max(1, Math.round(s * k));
  const w = textW(str, ss) + 16, h = 7 * ss + 14;
  // jagged burst
  const pts = 14;
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2 + seed;
    const r = (i % 2 ? 0.55 : 0.8) * Math.max(w, h) * 0.7 * k;
    line(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, i % 2 ? P.clay : P.paper, 3);
  }
  text5(str, x, y - (7 * ss) / 2, col, ss, { align: 'center', outline: P.ink });
}

// ---------- the robot ----------
const _rc = document.createElement('canvas'); _rc.width = 56; _rc.height = 64;
const _rg = _rc.getContext('2d'); _rg.imageSmoothingEnabled = false;
const RB = { ox: 28, oy: 60 }; // feet anchor inside sprite canvas

// o: {t, pose, face, eyes(0..1 power), spark(0..1), sx, sy, lean, walk, flip, scale, hold}
function robot(x, y, o = {}) {
  const t = o.t || 0, pose = o.pose || 'idle', face = o.face || 'normal';
  const saved = g; g = _rg; _rg.clearRect(0, 0, 56, 64);
  const ox = RB.ox, oy = RB.oy;
  const lean = Math.round(o.lean || 0);
  const breathe = pose === 'idle' || pose === 'wave' ? (Math.sin(t * 5) > 0.3 ? 1 : 0) : 0;
  const hy = oy - 38 + breathe; // head top-ish baseline

  // legs
  const walk = o.walk || 0;
  const la = walk ? Math.round(Math.sin(t * 16) * 2) : 0;
  R(ox - 7, oy - 7 - Math.max(0, la), 4, 6, P.ink2);
  R(ox + 3, oy - 7 - Math.max(0, -la), 4, 6, P.ink2);
  R(ox - 8, oy - 2 - Math.max(0, la), 6, 2, P.ink);
  R(ox + 2, oy - 2 - Math.max(0, -la), 6, 2, P.ink);

  // torso
  const tx = ox - 8 + Math.round(lean / 2), ty = oy - 19;
  R(tx, ty, 16, 13, P.ink);
  R(tx + 1, ty + 1, 14, 11, P.paper);
  R(tx + 11, ty + 1, 4, 11, P.sand);
  R(tx + 1, ty + 9, 14, 3, P.sand);
  R(tx + 4, ty + 3, 6, 4, P.clay2);
  R(tx + 5, ty + 4, 4, 2, Math.sin(t * 6) > 0 ? P.gold : P.clay);

  // arms (behind head layer but over torso)
  const sh = [[tx + 1, ty + 3], [tx + 14, ty + 3]];
  const hands = handPose(pose, t, ox + Math.round(lean / 2), oy, o);
  for (let i = 0; i < 2; i++) {
    line(sh[i][0], sh[i][1], hands[i][0], hands[i][1], P.ink, 3);
    line(sh[i][0], sh[i][1], hands[i][0], hands[i][1], P.sand2, 1);
  }
  for (let i = 0; i < 2; i++) { disc(hands[i][0], hands[i][1], 3, P.ink); disc(hands[i][0], hands[i][1], 2, P.paper); }

  // head
  const hx = ox - 12 + lean, hyy = hy - 4;
  // ear bolts
  R(hx - 3, hyy + 7, 4, 6, P.ink); R(hx - 2, hyy + 8, 2, 4, P.steel3);
  R(hx + 23, hyy + 7, 4, 6, P.ink); R(hx + 24, hyy + 8, 2, 4, P.steel3);
  R(hx + 2, hyy, 20, 20, P.ink); R(hx, hyy + 2, 24, 16, P.ink); R(hx + 1, hyy + 1, 22, 18, P.ink);
  R(hx + 2, hyy + 1, 20, 18, P.paper); R(hx + 1, hyy + 2, 22, 16, P.paper);
  R(hx + 1, hyy + 15, 22, 3, P.sand); R(hx + 2, hyy + 18, 20, 1, P.sand);
  R(hx + 19, hyy + 3, 3, 12, P.cream);
  // visor
  R(hx + 3, hyy + 4, 18, 10, P.ink);
  R(hx + 4, hyy + 5, 16, 8, P.clay);
  R(hx + 4, hyy + 5, 16, 1, P.clay3); R(hx + 4, hyy + 5, 1, 4, P.clay3);
  R(hx + 4, hyy + 12, 16, 1, P.clay2);
  // eyes
  const pw = o.eyes == null ? 1 : o.eyes;
  if (pw > 0.5) drawEyes(hx, hyy, face, t, o);
  // cheeks
  R(hx + 3, hyy + 15, 3, 1, P.pink); R(hx + 18, hyy + 15, 3, 1, P.pink);
  // antenna
  const ax = hx + 12, ay = hyy - 1;
  R(ax - 1, ay - 5, 2, 5, P.ink);
  const sp = o.spark == null ? 1 : o.spark;
  if (sp > 0) {
    const rot = Math.floor(t * 8) % 2;
    const sz = Math.round(2 + sp * 2 + (Math.sin(t * 9) > 0.6 ? 1 : 0));
    const ay2 = ay - 8;
    if (rot) { star4(ax, ay2, sz, sp > 0.5 ? P.gold : P.gold2, P.white); }
    else { for (let d = -sz + 1; d < sz; d++) { px(ax + d, ay2 + d, P.gold); px(ax + d, ay2 - d, P.gold); } R(ax - 1, ay2 - 1, 3, 3, P.gold); px(ax, ay2, P.white); }
  } else { R(ax - 2, ay - 8, 4, 4, P.ink2); }

  g = saved;
  const sc = o.scale || 1, sx = (o.sx || 1) * sc, sy = (o.sy || 1) * sc;
  // shadow
  if (o.shadow !== false) alpha(0.18, () => R(x - 11 * sc, y - 1, 22 * sc, 3, P.ink));
  const dw = Math.round(56 * sx), dh = Math.round(64 * sy);
  const dx = Math.round(x - ox * sx), dy = Math.round(y - oy * sy);
  if (o.flip) { g.save(); g.translate(Math.round(x) * 2, 0); g.scale(-1, 1); g.drawImage(_rc, dx, dy, dw, dh); g.restore(); }
  else g.drawImage(_rc, dx, dy, dw, dh);
}

function handPose(pose, t, ox, oy, o) {
  const sw = Math.round(Math.sin(t * 4) * 1);
  switch (pose) {
    case 'type': {
      const a = Math.sin(t * 40) > 0 ? 1 : 0, b = Math.sin(t * 40 + 1.7) > 0 ? 1 : 0;
      return [[ox - 6 + a * 2, oy - 8 - a], [ox + 6 - b * 2, oy - 8 - b]];
    }
    case 'pull': return [[ox + 16, oy - 22], [ox + 19, oy - 18]];
    case 'wave': { const w = Math.round(Math.sin(t * 14) * 4); return [[ox - 12, oy - 9 + sw], [ox + 17 + w, oy - 36]]; }
    case 'salute': return [[ox - 12, oy - 9], [ox + 15, oy - 36]];
    case 'cheer': { const b = Math.round(Math.abs(Math.sin(t * 10)) * 3); return [[ox - 17, oy - 38 - b], [ox + 17, oy - 38 - b]]; }
    case 'point': return [[ox - 12, oy - 9], [ox + 22, oy - 22]];
    case 'pointL': return [[ox - 22, oy - 22], [ox + 12, oy - 9]];
    case 'lever': { const d = Math.round((o.lever || 0) * 8); return [[ox - 12, oy - 9], [ox + 18, oy - 26 + d]]; }
    case 'press': { const d = Math.round((o.press || 0) * 6); return [[ox - 12, oy - 9], [ox + 18, oy - 14 + d]]; }
    case 'hold': return [[ox - 8, oy - 20], [ox + 8, oy - 20]];
    case 'throw': return [[ox - 12, oy - 9], [ox + 16, oy - 40]];
    case 'yawn': return [[ox - 10, oy - 30], [ox + 12, oy - 9]];
    case 'pose1': return [[ox - 17, oy - 18], [ox + 17, oy - 38]];
    case 'pose2': return [[ox - 6, oy - 14], [ox + 6, oy - 14]];
    default: return [[ox - 12, oy - 9 + sw], [ox + 12, oy - 9 - sw]];
  }
}

function drawEyes(hx, hy, face, t, o) {
  const E = P.gold3;
  const blink = o.blink != null ? o.blink : ((t % 3.1) < 0.12);
  const L = hx + 8, Rr = hx + 15, y = hy + 6;
  const look = Math.round(o.look || 0);
  if (face === 'happy') {
    for (const ex of [L, Rr]) { px(ex - 1, y + 3, E); px(ex, y + 2, E); px(ex + 1, y + 2, E); px(ex + 2, y + 3, E); }
  } else if (face === 'strain') {
    px(L - 1, y + 1, E); px(L, y + 2, E); px(L + 1, y + 3, E); px(L, y + 4, E); px(L - 1, y + 5, E);
    px(Rr + 2, y + 1, E); px(Rr + 1, y + 2, E); px(Rr, y + 3, E); px(Rr + 1, y + 4, E); px(Rr + 2, y + 5, E);
  } else if (face === 'surprise') {
    R(L - 1, y, 4, 5, E); R(Rr - 1, y, 4, 5, E); R(L, y + 1, 2, 3, P.ink); R(Rr, y + 1, 2, 3, P.ink);
  } else if (face === 'sleepy') {
    R(L - 1, y + 4, 4, 1, E); R(Rr - 1, y + 4, 4, 1, E);
  } else if (face === 'focus') {
    R(L + look, y + 2, 3, 3, E); R(Rr + look, y + 2, 3, 3, E);
  } else {
    if (blink) { R(L, y + 3, 3, 1, E); R(Rr, y + 3, 3, 1, E); }
    else { R(L + look, y + 1, 2, 5, E); R(Rr + look, y + 1, 2, 5, E); px(L + look, y + 1, P.white); px(Rr + look, y + 1, P.white); }
  }
}

// ---------- props ----------
function container(cx, by, o = {}) {
  // shipping container: 150x72, bottom-centered at (cx, by)
  const w = 150, h = 72, x = Math.round(cx - w / 2), y = Math.round(by - h);
  R(x - 1, y - 1, w + 2, h + 2, P.ink);
  R(x, y, w, h, P.clay);
  for (let i = 6; i < w; i += 7) R(x + i, y + 4, 2, h - 8, P.clay2);
  R(x, y, w, 4, P.clay3); R(x, y + h - 4, w, 4, P.clay4);
  R(x, y, 3, h, P.clay4); R(x + w - 3, y, 3, h, P.clay4);
  // label plate
  R(x + 10, y + 10, 34, 11, P.ink); R(x + 11, y + 11, 32, 9, P.paper);
  text5('CC-01', x + 13, y + 12, P.ink, 1);
  // door opening
  const dx = Math.round(cx - 22), dy = y + 12, dw = 44, dh = h - 12;
  R(dx - 2, dy - 2, dw + 4, dh + 2, P.ink);
  R(dx, dy, dw, dh, P.night2);
  R(dx, dy, dw, 4, P.night1);
  if (o.interior) o.interior(dx, dy, dw, dh);
  // sliding door (open 0..1 slides up)
  const open = o.open || 0;
  const doorY = dy - Math.round(open * (dh - 2));
  if (open < 1) {
    g.save(); g.beginPath(); g.rect(dx, dy, dw, dh); g.clip();
    R(dx, doorY, dw, dh, P.clay2);
    for (let i = 4; i < dw; i += 8) R(dx + i, doorY + 2, 2, dh - 4, P.clay4);
    R(dx + dw / 2 - 1, doorY, 2, dh, P.ink);
    // window
    R(dx + 14, doorY + 8, 16, 10, P.ink); R(dx + 15, doorY + 9, 14, 8, P.night2);
    if (o.windowGlow) alpha(o.windowGlow, () => { R(dx + 15, doorY + 9, 14, 8, P.gold2); star4(dx + 22, doorY + 13, 2, P.gold3); });
    R(dx + 4, doorY + dh / 2, 3, 8, P.steel3);
    g.restore();
  }
  // roof lamps
  const lamps = o.lamps || [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const lx = x + 30 + i * 45, ly = y - 6;
    R(lx - 4, ly, 9, 6, P.ink);
    R(lx - 3, ly + 1, 7, 4, lamps[i] ? P.gold : P.ink3);
    if (lamps[i]) {
      alpha(0.25 * lamps[i], () => disc(lx, ly + 2, 10, P.gold3));
      px(lx - 2, ly + 1, P.white);
    }
  }
  return { x, y, w, h, dx, dy, dw, dh };
}

function filmReel(cx, cy, r, rot, glow = 0) {
  if (glow > 0) alpha(0.35 * glow, () => disc(cx, cy, r + 6, P.teal3));
  disc(cx, cy, r + 1, P.ink);
  disc(cx, cy, r, P.ink2);
  disc(cx, cy, r - 2, P.steel2);
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * Math.PI * 2;
    disc(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, Math.max(1, r * 0.2), P.ink);
  }
  disc(cx, cy, Math.max(1, r * 0.18), P.clay);
}

function photo(x, y, w = 14, h = 11, seed = 0) {
  R(x - 1, y - 1, w + 2, h + 2, P.ink);
  R(x, y, w, h, P.paper);
  const ix = x + 1, iy = y + 1, iw = w - 2, ih = h - 3;
  R(ix, iy, iw, ih, [P.sky3, P.teal3, P.sky2, P.clay3][seed % 4]);
  R(ix, iy + ih - 2, iw, 2, P.white);
  R(ix + iw / 2 - 1, iy + ih - 5, 3, 3, P.clay);
}

// export
Object.assign(window, {
  W, H, MARGIN, P, CONFETTI, setCtx, getCtx, clamp, lerp, seg, easeOutCubic, easeInCubic, easeInQuad, easeInOut,
  easeOutBack, easeOutElastic, easeOutBounce, rnd, pop, R, px, disc, ring, line, star4, spark, alpha, ditherGradient,
  text5, textW, ptext, pixelTextCanvas, burst, stream, smokePuff, cloudBlob, cloudGround, daySky, nightSky,
  speedLines, vSpeedLines, bangText, robot, container, filmReel, photo,
});
