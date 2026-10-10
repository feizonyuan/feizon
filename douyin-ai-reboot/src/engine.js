'use strict';
// Vertical (1080x1920) motion-graphics engine, "light game HUD" style:
// navy background, neon yellow / cyan accents, pixel fonts for HUD labels.
// Every draw call is a pure function of time t.

const OW = 1080, OH = 1920, CX = 540;
const C = {
  BG: '#0b1026', BG2: '#121a3a', PANEL: 'rgba(120,140,255,0.08)', LINE: 'rgba(160,175,255,0.22)',
  Y: '#ffd93b', Y2: '#ffb21f', CY: '#38e8ff', W: '#f3f5ff', MUTE: '#8a93c2', DIM: '#3a4372',
  PINK: '#ff4f7b', GREEN: '#5cff9d', WATER: '#3b8cff', GRASS: '#3fcf6e', SKIN: '#ffd7b0', INK: '#0b1026',
};
const FAM = {
  zh: '"Noto Sans SC", sans-serif',
  pix: '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif',
  px: '"Press Start 2P", monospace',
};

let c = null;
function setCtx(x) { c = x; }

// ---------- math & easing ----------
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const expoOut = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const expoIn = t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
const cubicOut = t => 1 - Math.pow(1 - t, 3);
const cubicInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const spring = (dt, f = 2.2, d = 7) => (dt <= 0 ? 0 : 1 - Math.exp(-d * dt) * Math.cos(2 * Math.PI * f * dt));
const wobble = (dt, f = 3, d = 6) => (dt <= 0 ? 0 : Math.exp(-d * dt) * Math.sin(2 * Math.PI * f * dt));
const pulse = (t, f = 2) => 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * f);
function rnd(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---------- primitives ----------
function bgFill(col) { c.fillStyle = col; c.fillRect(-300, -300, OW + 600, OH + 600); }
function rect(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function strokeRect(x, y, w, h, col, lw = 3) { c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
function circle(x, y, r, col) { if (r <= 0) return; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function ring(x, y, r, col, lw = 3) { if (r <= 0) return; c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
function line(x0, y0, x1, y1, col, lw = 3) { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function rrect(x, y, w, h, r, col) { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
function rrectS(x, y, w, h, r, col, lw = 3) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.roundRect(x, y, w, h, r); c.stroke(); }
function withAlpha(a, fn) { if (a <= 0) return; const o = c.globalAlpha; c.globalAlpha = o * clamp(a); fn(); c.globalAlpha = o; }
function push(fn) { c.save(); fn(); c.restore(); }
// Draw fn() scaled/rotated around (x, y).
function xform(x, y, s, rot, fn) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(s, s); fn(); c.restore(); }
// Pixel-art panel: chunky stepped corners like a game dialog box.
function pixPanel(x, y, w, h, fill, edge, px = 6) {
  c.fillStyle = edge;
  c.fillRect(x + px, y, w - 2 * px, h); c.fillRect(x, y + px, w, h - 2 * px);
  c.fillStyle = fill;
  c.fillRect(x + px * 2, y + px, w - 4 * px, h - 2 * px); c.fillRect(x + px, y + px * 2, w - 2 * px, h - 4 * px);
}

function fontStr(fam, size, w = 400) { return `${w} ${size}px ${FAM[fam]}`; }
function setFont(fam, size, w) { c.font = fontStr(fam, size, w); }

// Plain text; o: {fam,size,w,color,align,base,track,stroke,strokeW}
function text(str, x, y, o = {}) {
  const size = o.size || 40, track = o.track || 0;
  setFont(o.fam || 'zh', size, o.w || 500);
  c.textBaseline = o.base || 'alphabetic';
  c.textAlign = 'left';
  const chars = [...String(str)];
  const ws = chars.map(ch => c.measureText(ch).width + track * size);
  const W = ws.reduce((a, b) => a + b, 0) - (chars.length ? track * size : 0);
  let xx = x - (o.align === 'center' ? W / 2 : o.align === 'right' ? W : 0);
  for (let i = 0; i < chars.length; i++) {
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.strokeW || size * 0.16; c.strokeText(chars[i], xx, y); }
    c.fillStyle = typeof o.color === 'function' ? o.color(i) : (o.color || C.W);
    c.fillText(chars[i], xx, y);
    xx += ws[i];
  }
  return W;
}
function measure(str, fam, size, w = 500, track = 0) {
  setFont(fam, size, w);
  const chars = [...String(str)];
  return chars.reduce((a, ch) => a + c.measureText(ch).width + track * size, 0) - (chars.length ? track * size : 0);
}

// Kinetic headline: each glyph pops in with a springy scale from its baseline centre.
// o: {fam,w,size,color,t,t0,stagger,align,track,stroke,out}
function pop(str, x, y, o) {
  const size = o.size, track = o.track == null ? 0 : o.track, t = o.t;
  setFont(o.fam || 'zh', size, o.w || 900);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const chars = [...str];
  const ws = chars.map(ch => c.measureText(ch).width + track * size);
  const W = ws.reduce((a, b) => a + b, 0) - track * size;
  let xx = x - (o.align === 'left' ? 0 : o.align === 'right' ? W : W / 2);
  const st = o.stagger == null ? 0.04 : o.stagger;
  for (let i = 0; i < chars.length; i++) {
    const dt = t - o.t0 - i * st;
    if (dt <= 0) { xx += ws[i]; continue; }
    let s = spring(dt, 2.4, 8);
    if (o.out != null) s *= 1 - expoIn(seg(t, o.out + i * st * 0.5, o.out + i * st * 0.5 + 0.3));
    if (s > 0.001) {
      c.save();
      c.translate(xx + ws[i] / 2, y - size * 0.35);
      c.scale(s, s);
      c.translate(-ws[i] / 2, size * 0.35);
      if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.strokeW || size * 0.14; c.strokeText(chars[i], 0, 0); }
      c.fillStyle = typeof o.color === 'function' ? o.color(i) : o.color;
      c.fillText(chars[i], 0, 0);
      c.restore();
    }
    xx += ws[i];
  }
  return W;
}

// Rolling odometer digits (pixel font). Returns width.
function odometer(value, digits, x, y, o) {
  const size = o.size;
  setFont(o.fam || 'px', size, 400);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const dw = c.measureText('0').width;
  for (let k = digits - 1, i = 0; k >= 0; k--, i++) {
    const p = Math.pow(10, k);
    const dk = Math.floor(value / p) % 10;
    let shift = k === 0 ? value - Math.floor(value) : clamp(((value % p) / p - 0.85) / 0.15);
    shift = cubicInOut(shift);
    const xx = x + i * dw;
    c.save(); c.beginPath(); c.rect(xx - 2, y - size * 1.05, dw + 4, size * 1.2); c.clip();
    c.fillStyle = o.color;
    c.fillText(String(dk), xx, y - shift * size * 1.2);
    c.fillText(String((dk + 1) % 10), xx, y + (1 - shift) * size * 1.2);
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
    const x = o.x + Math.cos(a) * sp * f;
    const y = o.y + Math.sin(a) * sp * f + 0.5 * (o.grav || 0) * age * age;
    const sz = (o.size || 10) * (1 - (age / life) * 0.8);
    const col = o.colors[Math.floor(rnd(s + 4) * o.colors.length)];
    if (o.shape === 'star') star(x, y, sz, col, age * 4 + i);
    else rect(x - sz / 2, y - sz / 2, sz, sz, col); // square "pixels" by default
  }
}
function star(x, y, r, col, rot = 0) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + (i * Math.PI) / 4, rr = i % 2 ? r * 0.38 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}

// ---------- background ----------
function backdrop(t, tint = C.BG) {
  bgFill(tint);
  const g = c.createRadialGradient(CX, 820, 100, CX, 820, 1200);
  g.addColorStop(0, 'rgba(70,90,200,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, OW, OH);
  // pixel dot grid drifting slowly upward
  const off = (t * 12) % 48;
  c.fillStyle = 'rgba(160,175,255,0.10)';
  for (let y = -48 + 24 - off; y < OH + 48; y += 48) for (let x = 24; x < OW; x += 48) c.fillRect(x - 2, y - 2, 4, 4);
}

// ---------- characters & icons ----------
// The hero: a chibi with spiky yellow hair ("黄毛") and a cyan hoodie. (x, y) = feet.
// o: {t, s, face, squat(0..1), walk(phase or null), look, arm}
function hero(x, y, o = {}) {
  const t = o.t || 0, s = o.s || 1, sq = o.squat || 0;
  c.save(); c.translate(x, y); c.scale(s, s);
  const bob = o.walk != null ? Math.abs(Math.sin(o.walk * Math.PI)) * 6 : Math.sin(t * 3) * 2;
  const legH = 46 * (1 - sq * 0.45), bodyY = -legH - 70 + bob * 0 - (o.walk != null ? bob : 0);
  // shadow
  withAlpha(0.35, () => { c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, 4, 50, 10, 0, 0, Math.PI * 2); c.fill(); });
  // legs
  const lp = o.walk != null ? Math.sin(o.walk * Math.PI * 2) * 12 : 0;
  rrect(-26 + lp * 0.5, -legH, 20, legH, 6, '#26306a');
  rrect(6 - lp * 0.5, -legH, 20, legH, 6, '#26306a');
  rrect(-32 + lp * 0.5, -10, 30, 12, 5, C.W); rrect(4 - lp * 0.5, -10, 30, 12, 5, C.W);
  // body (hoodie)
  rrect(-42, bodyY, 84, 74, 22, C.CY);
  rrect(-14, bodyY + 30, 28, 18, 6, 'rgba(11,16,38,0.25)');
  // arms
  const arm = o.arm || 0; // 0 = down, 1 = raised
  for (const sd of [-1, 1]) {
    c.save(); c.translate(sd * 40, bodyY + 16);
    c.rotate(sd * (0.25 + (o.walk != null ? Math.sin(o.walk * Math.PI * 2 + (sd > 0 ? Math.PI : 0)) * 0.3 : 0) + arm * (sd > 0 ? 2.4 : 0) + sq * 1.2 * (sd > 0 ? 1 : 1)));
    rrect(-10, 0, 20, 52, 10, '#2bc4dc'); circle(0, 54, 11, C.SKIN);
    c.restore();
  }
  // head
  const hy = bodyY - 52;
  circle(0, hy, 52, C.SKIN);
  // hair: spiky yellow crown
  c.fillStyle = C.Y; c.beginPath();
  c.moveTo(-56, hy - 4);
  const spikes = [[-58, -44], [-38, -34], [-30, -78], [-12, -46], [4, -86], [18, -48], [36, -76], [40, -38], [62, -40], [56, -4]];
  for (const [sx, sy] of spikes) c.lineTo(sx, hy + sy);
  c.quadraticCurveTo(30, hy - 30, -56, hy - 4); c.fill();
  // face
  const lk = (o.look || 0) * 8, face = o.face || 'normal', blink = (t % 3.1) < 0.1;
  c.fillStyle = C.INK; c.strokeStyle = C.INK; c.lineWidth = 6; c.lineCap = 'round';
  if (face === 'happy') {
    for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 18 + lk, hy + 8, 9, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  } else if (face === 'strain') {
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 26 + lk, hy - 2); c.lineTo(sd * 12 + lk, hy + 6); c.lineTo(sd * 26 + lk, hy + 14); c.stroke(); }
  } else if (face === 'shock') {
    for (const sd of [-1, 1]) circle(sd * 18 + lk, hy + 6, 9, C.INK);
  } else if (blink) {
    for (const sd of [-1, 1]) line(sd * 18 - 7 + lk, hy + 6, sd * 18 + 7 + lk, hy + 6, C.INK, 5);
  } else {
    for (const sd of [-1, 1]) rrect(sd * 18 - 5 + lk, hy - 4, 10, 18, 5, C.INK);
  }
  if (face === 'shock') { circle(lk, hy + 30, 8, C.INK); }
  else { c.beginPath(); c.arc(lk, hy + 22, 10, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  withAlpha(0.45, () => { circle(-32 + lk, hy + 20, 8, '#ff8fa3'); circle(32 + lk, hy + 20, 8, '#ff8fa3'); });
  c.restore();
}

// Small AI helper robot. (x, y) = centre.
function robot(x, y, s, t, col = C.CY) {
  c.save(); c.translate(x, y + Math.sin(t * 6 + x) * 3 * s); c.scale(s, s);
  line(0, -34, 0, -50, col, 4); circle(0, -54, 6, C.Y);
  rrect(-30, -34, 60, 48, 12, col);
  rrect(-22, -24, 44, 26, 8, C.INK);
  circle(-10, -11, 5, col); circle(10, -11, 5, col);
  rrect(-20, 18, 40, 22, 6, col);
  c.restore();
}

function phone(x, y, w, h, t, glow = 0) {
  if (glow > 0) withAlpha(glow * 0.5, () => rrect(x - 14, y - 14, w + 28, h + 28, 52, C.CY));
  rrect(x, y, w, h, 42, '#1b2350');
  rrectS(x, y, w, h, 42, C.W, 6);
  rrect(x + 16, y + 52, w - 32, h - 92, 14, '#0e1430');
  rrect(x + w / 2 - 50, y + 20, 100, 16, 8, '#0e1430');
}

function coin(x, y, r, t) {
  const sx = Math.abs(Math.cos(t * 3));
  c.save(); c.translate(x, y); c.scale(Math.max(0.15, sx), 1);
  circle(0, 0, r, C.Y2); circle(0, 0, r * 0.8, C.Y);
  text('¥', 0, r * 0.36, { fam: 'px', size: r, color: C.Y2, align: 'center' });
  c.restore();
}

function house(x, y, s, col = C.W, roof = C.PINK) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = roof; c.beginPath(); c.moveTo(-40, -30); c.lineTo(0, -64); c.lineTo(40, -30); c.closePath(); c.fill();
  rect(-32, -30, 64, 46, col); rect(-9, -6, 18, 22, C.INK); rect(16, -22, 10, 10, C.CY);
  c.restore();
}
function car(x, y, s, col = C.CY) {
  c.save(); c.translate(x, y); c.scale(s, s);
  rrect(-46, -26, 92, 28, 10, col); rrect(-28, -46, 52, 24, 10, col); rect(-20, -40, 16, 14, C.INK); rect(2, -40, 16, 14, C.INK);
  circle(-26, 4, 12, C.INK); circle(26, 4, 12, C.INK); circle(-26, 4, 5, C.MUTE); circle(26, 4, 5, C.MUTE);
  c.restore();
}
function chest(x, y, s, open, col = C.Y) {
  c.save(); c.translate(x, y); c.scale(s, s);
  rrect(-90, -20, 180, 100, 12, '#8a5a2b'); rect(-90, 10, 180, 14, col);
  c.save(); c.translate(-90, -20); c.rotate(-open * 0.9);
  rrect(0, -56, 180, 60, 14, '#a8703a'); rect(0, -16, 180, 12, col);
  c.restore();
  rrect(-16, -4, 32, 40, 6, col); circle(0, 12, 6, '#8a5a2b');
  c.restore();
}
function lockIcon(x, y, s, col, open = 0) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = col; c.lineWidth = 10; c.beginPath(); c.arc(0, -22 - open * 16, 22, Math.PI, 0); c.lineTo(22, -2 - open * 16); c.stroke();
  rrect(-32, -12, 64, 50, 10, col); rect(-4, 4, 8, 16, C.INK);
  c.restore();
}
function heart(x, y, r, col) {
  c.fillStyle = col; c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  c.fill();
}
function warnSign(x, y, s, col = C.Y) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col; c.beginPath(); c.moveTo(0, -30); c.lineTo(32, 26); c.lineTo(-32, 26); c.closePath(); c.fill();
  rect(-4, -12, 8, 22, C.INK); rect(-4, 14, 8, 7, C.INK);
  c.restore();
}

Object.assign(window, {
  OW, OH, CX, C, FAM, setCtx, clamp, lerp, seg, expoOut, expoIn, cubicOut, cubicInOut, backOut, spring, wobble, pulse, rnd,
  bgFill, rect, strokeRect, circle, ring, line, rrect, rrectS, withAlpha, push, xform, pixPanel, fontStr, setFont, text, measure,
  pop, odometer, burst, star, backdrop, hero, robot, phone, coin, house, car, chest, lockIcon, heart, warnSign,
});
Object.defineProperty(window, 'ctx', { get: () => c });
