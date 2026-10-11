'use strict';
// Vertical (1080x1920) editorial motion-graphics engine: warm paper background,
// ink type, one red accent, serif headlines, thin rules and data-graphics.
// Every draw call is a pure function of time t.

const OW = 1080, OH = 1920, CX = 540;
const MX = 80, MW = OW - 2 * MX; // page margins
const C = {
  PAPER: '#f3efe6', PAPER2: '#e8e2d5', INK: '#141414', INK2: '#3a3733', GREY: '#7a746a', LIGHT: '#c8c0b1',
  FAINT: '#ddd6c8', RED: '#c8231b', RED2: '#f2d4cf', BLUE: '#24527a',
};
const FAM = {
  serif: '"Noto Serif SC", serif',
  sans: '"Noto Sans SC", sans-serif',
  num: '"Inter", "Noto Sans SC", sans-serif',
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
const quartOut = t => 1 - Math.pow(1 - t, 4);
function rnd(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---------- primitives ----------
function bgFill(col) { c.fillStyle = col; c.fillRect(-300, -300, OW + 600, OH + 600); }
function rect(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function strokeRect(x, y, w, h, col, lw = 2) { c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(x, y, w, h); }
function circle(x, y, r, col) { if (r <= 0) return; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function ring(x, y, r, col, lw = 2) { if (r <= 0) return; c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
function line(x0, y0, x1, y1, col, lw = 2, dash) {
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'butt'; c.setLineDash(dash || []);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
}
// Horizontal rule that draws in from the left.
function rule(x, y, w, k, col = C.INK, lw = 2) { if (k > 0) rect(x, y - lw / 2, w * clamp(k), lw, col); }
function withAlpha(a, fn) { if (a <= 0) return; const o = c.globalAlpha; c.globalAlpha = o * clamp(a); fn(); c.globalAlpha = o; }
function push(fn) { c.save(); fn(); c.restore(); }
// Polyline drawn progressively, k in 0..1 of total length.
function path(pts, k, col, lw = 3, dash) {
  if (k <= 0 || pts.length < 2) return;
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
  let rem = tot * clamp(k);
  c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.setLineDash(dash || []);
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  let end = pts[0];
  for (let i = 1; i < pts.length && rem > 0; i++) {
    const f = Math.min(1, rem / L[i - 1]);
    end = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
    c.lineTo(end[0], end[1]); rem -= L[i - 1];
  }
  c.stroke(); c.setLineDash([]);
  return end;
}
function arrow(x0, y0, x1, y1, k, col = C.INK, lw = 3) {
  if (k <= 0) return;
  const x = lerp(x0, x1, k), y = lerp(y0, y1, k), a = Math.atan2(y1 - y0, x1 - x0);
  line(x0, y0, x, y, col, lw);
  c.fillStyle = col; c.beginPath();
  c.moveTo(x, y); c.lineTo(x - 18 * Math.cos(a - 0.4), y - 18 * Math.sin(a - 0.4)); c.lineTo(x - 18 * Math.cos(a + 0.4), y - 18 * Math.sin(a + 0.4)); c.fill();
}

function fontStr(fam, size, w = 400) { return `${w} ${size}px ${FAM[fam]}`; }
function setFont(fam, size, w) { c.font = fontStr(fam, size, w); }

// Plain text; o: {fam,size,w,color(i)|color,align,track}
function text(str, x, y, o = {}) {
  const size = o.size || 40, track = o.track || 0;
  setFont(o.fam || 'sans', size, o.w || 400);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const chars = [...String(str)];
  const ws = chars.map(ch => c.measureText(ch).width + track * size);
  const W = ws.reduce((a, b) => a + b, 0) - (chars.length ? track * size : 0);
  let xx = x - (o.align === 'center' ? W / 2 : o.align === 'right' ? W : 0);
  if (!track && typeof o.color !== 'function') { c.fillStyle = o.color || C.INK; c.fillText(String(str), xx, y); return W; }
  for (let i = 0; i < chars.length; i++) {
    c.fillStyle = typeof o.color === 'function' ? o.color(i) : (o.color || C.INK);
    c.fillText(chars[i], xx, y); xx += ws[i];
  }
  return W;
}
function measure(str, fam, size, w = 400, track = 0) {
  setFont(fam, size, w);
  const chars = [...String(str)];
  return chars.reduce((a, ch) => a + c.measureText(ch).width + track * size, 0) - (chars.length ? track * size : 0);
}

// Editorial reveal: each glyph rises out of a mask line; optional exit upward.
// o: {fam,w,size,color,t,t0,stagger,dur,align,track,out}
function ktext(str, x, y, o) {
  const size = o.size, track = o.track || 0, t = o.t;
  setFont(o.fam || 'serif', size, o.w || 900);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const chars = [...str];
  const ws = chars.map(ch => c.measureText(ch).width + track * size);
  const W = ws.reduce((a, b) => a + b, 0) - track * size;
  let xx = x - (o.align === 'center' ? W / 2 : o.align === 'right' ? W : 0);
  const st = o.stagger == null ? 0.025 : o.stagger, dur = o.dur || 0.55;
  const top = y - size * 1.0, hgt = size * 1.28;
  for (let i = 0; i < chars.length; i++) {
    const k = clamp((t - o.t0 - i * st) / dur);
    if (k <= 0) { xx += ws[i]; continue; }
    let off = (1 - quartOut(k)) * size * 1.1;
    if (o.out != null) {
      const q = clamp((t - o.out - i * st * 0.5) / 0.35);
      if (q >= 1) { xx += ws[i]; continue; }
      off -= expoIn(q) * size * 1.2;
    }
    c.save(); c.beginPath(); c.rect(xx - size * 0.1, top, ws[i] + size * 0.2, hgt); c.clip();
    c.fillStyle = typeof o.color === 'function' ? o.color(i) : (o.color || C.INK);
    c.fillText(chars[i], xx, y + off);
    c.restore();
    xx += ws[i];
  }
  return W;
}

// Wrap text into lines that fit width (CJK: break anywhere, prefer punctuation).
function wrap(str, fam, size, w, maxW) {
  const out = []; let cur = '';
  for (const ch of str) {
    if (measure(cur + ch, fam, size, w) > maxW && cur) {
      // keep closing punctuation with the previous line
      if ('，。、：；！？”）'.includes(ch)) { cur += ch; out.push(cur); cur = ''; continue; }
      out.push(cur); cur = ch;
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

// Rolling odometer digits (Inter). Returns width.
function odometer(value, digits, x, y, o) {
  const size = o.size;
  setFont('num', size, o.w || 700);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const dw = c.measureText('0').width;
  for (let k = digits - 1, i = 0; k >= 0; k--, i++) {
    const p = Math.pow(10, k);
    const dk = Math.floor(value / p) % 10;
    let shift = k === 0 ? value - Math.floor(value) : clamp(((value % p) / p - 0.85) / 0.15);
    shift = cubicInOut(shift);
    const xx = x + i * dw;
    c.save(); c.beginPath(); c.rect(xx - 2, y - size * 0.95, dw + 4, size * 1.15); c.clip();
    c.fillStyle = o.color || C.INK;
    c.fillText(String(dk), xx, y - shift * size * 1.15);
    c.fillText(String((dk + 1) % 10), xx, y + (1 - shift) * size * 1.15);
    c.restore();
  }
  return dw * digits;
}

// ---------- page furniture ----------
function paper(t) {
  bgFill(C.PAPER);
  // faint baseline grid, like a layout sheet
  c.fillStyle = 'rgba(20,20,20,0.035)';
  for (let y = 0; y < OH; y += 48) c.fillRect(0, y, OW, 1);
}

// ---------- line icons (stroke) ----------
function iconPerson(x, y, s, col = C.INK, lw = 4) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = col; c.lineWidth = lw / s;
  c.beginPath(); c.arc(0, -70, 26, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(-48, 0); c.quadraticCurveTo(-48, -36, 0, -36); c.quadraticCurveTo(48, -36, 48, 0); c.stroke();
  c.restore();
}
function iconDoc(x, y, s, col = C.INK, lw = 4) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = col; c.lineWidth = lw / s; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-50, -66); c.lineTo(22, -66); c.lineTo(50, -38); c.lineTo(50, 66); c.lineTo(-50, 66); c.closePath(); c.stroke();
  c.beginPath(); c.moveTo(22, -66); c.lineTo(22, -38); c.lineTo(50, -38); c.stroke();
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-30, -14 + i * 20); c.lineTo(i === 3 ? 6 : 30, -14 + i * 20); c.stroke(); }
  c.restore();
}
function iconHeart(x, y, r, col) {
  c.fillStyle = col; c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  c.fill();
}

Object.assign(window, {
  OW, OH, CX, MX, MW, C, FAM, setCtx, clamp, lerp, seg, expoOut, expoIn, cubicOut, cubicInOut, quartOut, rnd,
  bgFill, rect, strokeRect, circle, ring, line, rule, withAlpha, push, path, arrow, fontStr, setFont, text, measure, ktext, wrap,
  odometer, paper, iconPerson, iconDoc, iconHeart,
});
Object.defineProperty(window, 'ctx', { get: () => c });
