'use strict';
// Motion-graphics engine: 1920x1080 vector canvas, editorial palette, kinetic type,
// the red-dot hero, particles and the HUD frame. Every draw is a pure function of time t.

const OW = 1920, OH = 1080, CX = 960, CY = 540;
const C = {
  K: '#0b0b0b', RED: '#ff3d1f', CR: '#ece7dd', INK: '#111111',
  GREY: '#77716a', MUTE: '#a8a29a', DIMK: 'rgba(236,231,221,0.14)', DIMC: 'rgba(17,17,17,0.14)',
};
const FAM = {
  disp: '"Inter Display", "Inter", sans-serif', serif: '"Newsreader", serif', mono: '"JetBrains Mono", monospace',
  zh: '"Noto Sans SC", sans-serif', zhs: '"Noto Serif SC", serif',
};

let c = null;
function setCtx(x) { c = x; }

// ---------- math & easing ----------
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const expoOut = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const expoIn = t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
const expoInOut = t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
const cubicOut = t => 1 - Math.pow(1 - t, 3);
const cubicIn = t => t * t * t;
const cubicInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
// damped spring 0 -> 1 with overshoot; dt seconds since start
const spring = (dt, f = 2.2, d = 7) => (dt <= 0 ? 0 : 1 - Math.exp(-d * dt) * Math.cos(2 * Math.PI * f * dt));
// impulse wobble: 0 at start, rings and decays
const wobble = (dt, f = 3, d = 6) => (dt <= 0 ? 0 : Math.exp(-d * dt) * Math.sin(2 * Math.PI * f * dt));
function rnd(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---------- drawing primitives ----------
function bg(col) { c.fillStyle = col; c.fillRect(-200, -200, OW + 400, OH + 400); }
function rect(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function circle(x, y, r, col) { if (r <= 0) return; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function ringS(x, y, r, col, lw = 1.5) { if (r <= 0) return; c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
function lineS(x0, y0, x1, y1, col, lw = 1.5) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function rrect(x, y, w, h, r, col) { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
function withAlpha(a, fn) { const o = c.globalAlpha; c.globalAlpha = o * clamp(a); fn(); c.globalAlpha = o; }
function push(fn) { c.save(); fn(); c.restore(); }

function fontStr(fam, size, w = 400) {
  return `${fam === 'serif' ? 'italic ' : ''}${w} ${size}px ${FAM[fam]}`;
}
function setFont(fam, size, w) { c.font = fontStr(fam, size, w); }

// Plain text (optionally letter-spaced). Returns width.
function text(str, x, y, o = {}) {
  const size = o.size || 20, track = o.track || 0;
  setFont(o.fam || 'mono', size, o.w || 400);
  c.fillStyle = o.color || C.CR;
  c.textBaseline = o.base || 'alphabetic';
  const chars = [...String(str)];
  const ws = chars.map(ch => c.measureText(ch).width + track * size);
  const W = ws.reduce((a, b) => a + b, 0) - (chars.length ? track * size : 0);
  let xx = x - (o.align === 'center' ? W / 2 : o.align === 'right' ? W : 0);
  if (!track) { c.textAlign = 'left'; c.fillText(String(str), xx, y); return W; }
  for (let i = 0; i < chars.length; i++) { c.fillText(chars[i], xx, y); xx += ws[i]; }
  return W;
}
function measure(str, fam, size, w = 400, track = 0) {
  setFont(fam, size, w);
  const chars = [...String(str)];
  return chars.reduce((a, ch) => a + c.measureText(ch).width + track * size, 0) - (chars.length ? track * size : 0);
}

// Kinetic type: per-glyph masked reveal from below (and optional exit upward).
// o: {fam,w,size,color,t,t0,stagger,dur,align,track,out,outDur,mask,dy(i,t),scale}
function ktext(str, x, y, o) {
  const size = o.size, track = o.track == null ? -0.03 : o.track, t = o.t;
  setFont(o.fam, size, o.w || 900);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const chars = [...str];
  const ws = chars.map(ch => c.measureText(ch).width + track * size);
  const W = ws.reduce((a, b) => a + b, 0) - track * size;
  let xx = x - (o.align === 'center' ? W / 2 : o.align === 'right' ? W : 0);
  const st = o.stagger == null ? 0.035 : o.stagger, dur = o.dur || 0.6;
  const mask = o.mask !== false;
  const top = y - size * (o.fam === 'zh' || o.fam === 'zhs' ? 0.98 : 0.86), hgt = size * 1.18;
  for (let i = 0; i < chars.length; i++) {
    const k = clamp((t - o.t0 - i * st) / dur);
    if (k <= 0) { xx += ws[i]; continue; }
    let off = (1 - expoOut(k)) * size * 1.05;
    if (o.out != null) {
      const q = clamp((t - o.out - i * st * 0.6) / (o.outDur || 0.45));
      if (q >= 1) { xx += ws[i]; continue; }
      off -= expoIn(q) * size * 1.4;
    }
    const extra = o.dy ? o.dy(i, t) : 0;
    c.save();
    if (mask) { c.beginPath(); c.rect(xx - size * 0.2, top + (o.maskShift || 0), ws[i] + size * 0.4, hgt); c.clip(); }
    c.fillStyle = typeof o.color === 'function' ? o.color(i) : o.color;
    c.fillText(chars[i], xx, y + off + extra);
    c.restore();
    xx += ws[i];
  }
  return { x0: x - (o.align === 'center' ? W / 2 : o.align === 'right' ? W : 0), w: W };
}

// Typewriter mono text with block cursor.
function typed(str, x, y, t, t0, cps, o = {}) {
  const n = Math.max(0, Math.min(str.length, Math.floor((t - t0) * cps)));
  if (t < t0) return 0;
  const w = text(str.slice(0, n), x, y, o);
  const done = n >= str.length;
  if ((!done || o.keepCursor) && Math.floor(t * 3) % 2 === 0 || !done) {
    rect(x + w + 4, y - (o.size || 20) * 0.8, (o.size || 20) * 0.55, (o.size || 20) * 0.95, o.color || C.CR);
  }
  return w;
}

// Rolling odometer number.
function odometer(value, digits, x, y, o) {
  const size = o.size;
  setFont(o.fam || 'disp', size, o.w || 900);
  c.textBaseline = 'alphabetic';
  const dw = c.measureText('0').width * (o.adv || 1.0);
  const h = size * 1.0;
  for (let k = digits - 1, i = 0; k >= 0; k--, i++) {
    const p = Math.pow(10, k);
    const dk = Math.floor(value / p) % 10;
    let shift;
    if (k === 0) shift = value - Math.floor(value);
    else { const low = (value % p) / p; shift = clamp((low - 0.85) / 0.15); }
    shift = cubicInOut(shift);
    const xx = x + i * dw;
    c.save(); c.beginPath(); c.rect(xx - 4, y - size * 0.86, dw + 8, size * 1.0); c.clip();
    c.fillStyle = o.color;
    c.fillText(String(dk), xx, y - shift * h);
    c.fillText(String((dk + 1) % 10), xx, y + (1 - shift) * h);
    c.restore();
  }
  return dw * digits;
}

// ---------- particles ----------
function burst(t, t0, o) {
  const age = t - t0;
  if (age < 0 || age > (o.life || 1)) return;
  const n = o.n || 20, seed = (o.seed || 1) * 991;
  for (let i = 0; i < n; i++) {
    const s = seed + i * 17;
    const life = (o.life || 1) * (0.5 + 0.5 * rnd(s + 1));
    if (age > life) continue;
    const a = lerp(o.ang ? o.ang[0] : 0, o.ang ? o.ang[1] : Math.PI * 2, rnd(s + 2));
    const sp = lerp(o.spd[0], o.spd[1], rnd(s + 3));
    const k = o.drag || 3;
    const f = (1 - Math.exp(-k * age)) / k;
    const x = o.x + Math.cos(a) * sp * f + (o.jx || 0) * (rnd(s + 5) - 0.5);
    const y = o.y + Math.sin(a) * sp * f + 0.5 * (o.grav || 0) * age * age;
    const lt = age / life;
    const sz = (o.size || 6) * (1 - lt * 0.85);
    const col = o.colors[Math.floor(rnd(s + 4) * o.colors.length)];
    if (o.shape === 'line') {
      const vx = Math.cos(a) * sp * Math.exp(-k * age), vy = Math.sin(a) * sp * Math.exp(-k * age) + (o.grav || 0) * age;
      lineS(x, y, x - vx * 0.03, y - vy * 0.03, col, Math.max(1, sz * 0.4));
    } else if (o.shape === 'sq') rect(x - sz / 2, y - sz / 2, sz, sz, col);
    else circle(x, y, sz / 2, col);
  }
}
function stream(t, t0, t1, rate, life, fn) {
  if (t < t0) return;
  const j0 = Math.max(0, Math.floor((t - life - t0) * rate));
  const j1 = Math.floor((Math.min(t, t1) - t0) * rate);
  for (let j = j0; j <= j1; j++) { const bt = t0 + j / rate, age = t - bt; if (age >= 0 && age <= life) fn(age, bt, j); }
}

// 3D particle sphere (fibonacci), with burst-in / explode / cube morph.
const NP = 2400;
const SPH = [], CUBE = [], DIRS = [];
for (let i = 0; i < NP; i++) {
  const y = 1 - (i / (NP - 1)) * 2, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i;
  SPH.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  const f = Math.floor(rnd(i + 3) * 6), u = rnd(i + 5) * 2 - 1, v = rnd(i + 7) * 2 - 1, s = 0.75;
  const p = [[s, u * s, v * s], [-s, u * s, v * s], [u * s, s, v * s], [u * s, -s, v * s], [u * s, v * s, s], [u * s, v * s, -s]][f];
  CUBE.push(p);
  const a = rnd(i + 11) * Math.PI * 2, b = Math.acos(rnd(i + 13) * 2 - 1);
  DIRS.push([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)]);
}
// o: {R, rotY, rotX, form(0..1), explode(0..1+), cube(0..1), color, accent, ring, alpha}
function sphere(cx, cy, o) {
  const R = o.R, cy_ = Math.cos(o.rotY || 0), sy_ = Math.sin(o.rotY || 0), cx_ = Math.cos(o.rotX || 0), sx_ = Math.sin(o.rotX || 0);
  const form = o.form == null ? 1 : o.form, ex = o.explode || 0, cube = o.cube || 0;
  const focal = 3.2;
  c.globalAlpha = o.alpha == null ? 1 : o.alpha;
  for (let i = 0; i < NP; i++) {
    const s = SPH[i], q = CUBE[i], d = DIRS[i];
    let x = lerp(s[0], q[0], cube), y = lerp(s[1], q[1], cube), z = lerp(s[2], q[2], cube);
    const fr = expoOut(clamp(form * 1.3 - rnd(i + 1) * 0.3));
    x *= fr; y *= fr; z *= fr;
    x += d[0] * ex * (1.5 + rnd(i + 2) * 3); y += d[1] * ex * (1.5 + rnd(i + 2) * 3); z += d[2] * ex * (1.5 + rnd(i + 2) * 3);
    // rotate Y then X
    let x1 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_;
    let y1 = y * cx_ - z1 * sx_, z2 = y * sx_ + z1 * cx_;
    const sc = focal / (focal + z2);
    const px = cx + x1 * R * sc, py = cy + y1 * R * sc;
    const depth = clamp((1 - z2) / 2);
    const sz = 1.2 + 2.0 * sc * (0.5 + depth * 0.5);
    const isAcc = i % 37 === 0;
    c.fillStyle = isAcc ? (o.accent || C.RED) : (o.color || C.CR);
    c.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (0.25 + 0.75 * depth);
    c.fillRect(px - sz / 2, py - sz / 2, sz, sz);
  }
  c.globalAlpha = 1;
  if (o.ring) withAlpha(o.ring, () => {
    c.strokeStyle = C.RED; c.lineWidth = 1.6; c.beginPath();
    c.ellipse(cx, cy, R * 1.02, Math.max(1, Math.abs(Math.sin((o.rotX || 0) + 1.25)) * R * 0.38), 0.12, 0, Math.PI * 2); c.stroke();
  });
}

// ---------- the hero: a red dot with eyes ----------
// o: {t, color, eye, face, sx, sy, rot, look, lookY, blink}
function hero(x, y, r, o = {}) {
  const t = o.t || 0;
  c.save();
  c.translate(x, y);
  if (o.rot) c.rotate(o.rot);
  c.scale(o.sx || 1, o.sy || 1);
  circle(0, 0, r, o.color || C.RED);
  const face = o.face || 'normal', eye = o.eye || C.CR;
  const autoBlink = (t % 2.7) < 0.11;
  const blink = o.blink != null ? o.blink : autoBlink;
  const ex = r * 0.3, ey = -r * 0.1 + (o.lookY || 0) * r * 0.12, lx = (o.look || 0) * r * 0.16;
  const ew = r * 0.15, eh = r * 0.38;
  c.fillStyle = eye; c.strokeStyle = eye; c.lineCap = 'round'; c.lineWidth = Math.max(2, r * 0.11);
  if (o.eyesOff) { /* no eyes */ }
  else if (face === 'happy') {
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * ex + lx, ey + eh * 0.25, ew * 1.4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  } else if (face === 'sleepy') {
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * ex - ew + lx, ey + eh * 0.2); c.lineTo(s * ex + ew + lx, ey + eh * 0.2); c.stroke(); }
  } else if (face === 'strain') {
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * ex - s * ew + lx, ey - eh * 0.35); c.lineTo(s * ex + s * ew + lx, ey); c.lineTo(s * ex - s * ew + lx, ey + eh * 0.35); c.stroke(); }
  } else if (face === 'surprise') {
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * ex + lx, ey, ew * 1.35, 0, Math.PI * 2); c.fill(); }
  } else if (blink) {
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * ex - ew + lx, ey); c.lineTo(s * ex + ew + lx, ey); c.stroke(); }
  } else {
    for (const s of [-1, 1]) { c.beginPath(); c.roundRect(s * ex - ew / 2 + lx, ey - eh / 2, ew, eh, ew / 2); c.fill(); }
  }
  c.restore();
}

// ---------- HUD frame ----------
const SECTIONS = ['01 — BOOT · POINT', '02 — WAKE · NEW TASK', '03 — GIT CLONE · PULL', '04 — WRITE · CODE',
  '05 — CAPTURE · HEADLESS', '06 — ENCODE · FFMPEG', '07 — DEPLOY · GIT PUSH', '08 — SHIP · SIGNATURE'];
function hud(t, idx, fg, accent, a = 1, fps = 60) {
  withAlpha(a, () => {
    c.strokeStyle = fg; c.lineWidth = 1.5;
    const L = 16, m = 40;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [OW - m, m, -1, 1], [m, OH - m, 1, -1], [OW - m, OH - m, -1, -1]]) {
      c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke();
    }
    const o = { fam: 'mono', size: 15, track: 0.16, color: fg };
    text('CLAUDE CODE / CLOUD SHIFT — 2026', 72, 80, o);
    const s = Math.floor(t), f = Math.floor((t - s) * fps);
    text(`TC 00:00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`, OW - 72, 80, { ...o, align: 'right' });
    text(SECTIONS[idx], 72, OH - 66, o);
    text('128 BPM · 1080P60', OW - 72 - 8 * 18 - 14, OH - 66, { ...o, align: 'right' });
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i === idx ? accent : fg;
      withAlpha(i === idx ? 1 : 0.35, () => c.fillRect(OW - 72 - (8 - i) * 18 + 6, OH - 78, 11, 11));
    }
  });
}

Object.assign(window, {
  OW, OH, CX, CY, C, FAM, setCtx, clamp, lerp, seg, expoOut, expoIn, expoInOut, cubicOut, cubicIn, cubicInOut, backOut,
  spring, wobble, rnd, bg, rect, circle, ringS, lineS, rrect, withAlpha, push, fontStr, setFont, text, measure, ktext,
  typed, odometer, burst, stream, sphere, hero, hud, SECTIONS,
});
Object.defineProperty(window, 'ctx', { get: () => c });
