'use strict';
// Compositor: renders the pixel world, upscales it to 1920x1080, then adds
// transitions, screen shake, flashes, bilingual subtitles and a light CRT finish.

const OUT_W = 1920, OUT_H = 1080, SCALE = OUT_W / W;
const main = document.getElementById('c');
const M = main.getContext('2d');
const off = document.createElement('canvas');
off.width = W + MARGIN * 2; off.height = H + MARGIN * 2;
const og = off.getContext('2d');
og.imageSmoothingEnabled = false; M.imageSmoothingEnabled = false;

const TL = window.TL, EV = TL.events;

// [time, amplitude(world px), decay/s]
const SHAKES = [
  [EV.containerLand, 6, 6], [EV.hopLand, 2, 10], [EV.pipeClank, 3, 10], [EV.cratePop + 0.45, 4, 8], [EV.crateBurst, 3, 8],
  ...EV.tugs.map(x => [x, 1.5, 10]), ...EV.sparks.map(x => [x, 1.2, 14]), ...EV.presses.map(x => [x, 6, 7]),
  [EV.liftoff, 4, 3], [EV.rocketHit, 6, 5], [EV.bigBurst, 4, 4], [54.5, 2, 10], [EV.reelOut, 2, 8],
];
// [time, peak alpha, decay/s, color]
const FLASHES = [
  [EV.ding, 0.25, 6, '#fff1c2'], [EV.containerLand, 0.35, 8, '#ffffff'], ...EV.snaps.map(x => [x, 0.55, 14, '#ffffff']),
  ...EV.presses.map(x => [x, 0.35, 10, '#fff1c2']), [EV.miniRobot, 0.3, 8, '#ffffff'], [EV.audioZap, 0.3, 8, '#a6e3d9'],
  [EV.crateBurst, 0.3, 8, '#ffffff'], [EV.rocketHit, 1.0, 3, '#ffffff'], [EV.eyesOn + 0.3, 0.2, 8, '#fff1c2'],
];

function shakeAt(t) {
  let a = 0;
  for (const [t0, amp, k] of SHAKES) if (t >= t0 && t - t0 < 1.5) a += amp * Math.exp(-(t - t0) * k);
  if (t > EV.ignite && t < EV.liftoff + 0.6) a += 1.5;
  if (a < 0.4) return [0, 0];
  const f = Math.floor(t * 30);
  return [Math.round((rnd(f) - 0.5) * 2 * a), Math.round((rnd(f + 999) - 0.5) * 2 * a)];
}

function flashes(t) {
  for (const [t0, a, k, c] of FLASHES) {
    if (t < t0 || t - t0 > 1.5) continue;
    const v = a * Math.exp(-(t - t0) * k);
    if (v > 0.01) { M.globalAlpha = v; M.fillStyle = c; M.fillRect(0, 0, OUT_W, OUT_H); M.globalAlpha = 1; }
  }
  // zoom-into-monitor whiteout around 25.6s
  const z = 1 - Math.abs(t - 25.6) / 0.22;
  if (z > 0) { M.globalAlpha = clamp(z * 1.3); M.fillStyle = '#ffffff'; M.fillRect(0, 0, OUT_W, OUT_H); M.globalAlpha = 1; }
  // big flash into the finale
  const b = 1 - Math.abs(t - 45.5) / 0.35;
  if (b > 0) { M.globalAlpha = clamp(b * 1.4); M.fillStyle = '#fff6e0'; M.fillRect(0, 0, OUT_W, OUT_H); M.globalAlpha = 1; }
}

// pixel-block transitions
const TRANS = [[13.2, 'diag'], [19.4, 'iris'], [32.4, 'dissolve'], [38.8, 'diagR'], [49.6, 'dissolve']];
function transitions(t) {
  const half = 0.3, B = 60, ni = OUT_W / B, nj = OUT_H / B;
  for (const [b, kind] of TRANS) {
    if (t < b - half || t > b + half) continue;
    const p = t < b ? seg(t, b - half, b) : 1 - seg(t, b, b + half);
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      let o;
      if (kind === 'diag') o = (i + j) / (ni + nj - 2);
      else if (kind === 'diagR') o = ((ni - 1 - i) + j) / (ni + nj - 2);
      else if (kind === 'iris') { const dx = i - ni / 2 + 0.5, dy = (j - nj / 2 + 0.5) * 1.3; o = 1 - Math.sqrt(dx * dx + dy * dy) / 13; }
      else o = rnd(i * 97 + j * 13);
      const k = clamp((p * 1.25 - o * 0.95) * 5);
      if (k <= 0) continue;
      const s = Math.round(B * k / 4) * 4;
      M.fillStyle = (i + j) % 7 === 0 ? P.clay : P.ink;
      M.fillRect(i * B + (B - s) / 2, j * B + (B - s) / 2, s, s);
    }
  }
}

// bilingual subtitles
function subtitles(t) {
  for (const s of window.SUBS) {
    const t0 = s.at - 0.05, t1 = s.at + s.dur + 0.35;
    if (t < t0 || t > t1) continue;
    const kin = easeOutBack(seg(t, t0, t0 + 0.22)), kout = 1 - seg(t, t1 - 0.18, t1);
    const zh = pixelTextCanvas(s.zh, 20, P.paper, null);
    const en = pixelTextCanvas(s.en, 12, P.gold, null, '"DejaVu Sans Mono", monospace', 'bold');
    const zs = 2, es = 2;
    const bw = Math.max(zh.width * zs, en.width * es) + 120, bh = zh.height * zs + en.height * es + 24;
    const cx = OUT_W / 2, by = OUT_H - 24 - bh;
    M.save();
    M.globalAlpha = kout;
    M.translate(cx, by + bh / 2); M.scale(lerp(0.85, 1, kin), lerp(0.6, 1, kin)); M.translate(-cx, -(by + bh / 2));
    const x0 = Math.round((cx - bw / 2) / 4) * 4, y0 = Math.round(by / 4) * 4;
    // stepped-corner pixel box
    M.fillStyle = P.ink;
    M.fillRect(x0 + 8, y0, bw - 16, bh); M.fillRect(x0, y0 + 8, bw, bh - 16); M.fillRect(x0 + 4, y0 + 4, bw - 8, bh - 8);
    M.fillStyle = P.clay;
    M.fillRect(x0 + 12, y0 + 4, bw - 24, 4); M.fillRect(x0 + 12, y0 + bh - 8, bw - 24, 4);
    M.fillRect(x0 + 4, y0 + 12, 4, bh - 24); M.fillRect(x0 + bw - 8, y0 + 12, 4, bh - 24);
    M.fillRect(x0 + 8, y0 + 8, 4, 4); M.fillRect(x0 + bw - 12, y0 + 8, 4, 4); M.fillRect(x0 + 8, y0 + bh - 12, 4, 4); M.fillRect(x0 + bw - 12, y0 + bh - 12, 4, 4);
    // speaker spark icon
    const ix = x0 + 40, iy = y0 + bh / 2;
    const pulse = 1 + 0.2 * Math.sin(t * 20);
    M.fillStyle = P.gold;
    M.fillRect(ix - 4 * pulse * 4 | 0, iy - 4, 32 * pulse | 0, 8); M.fillRect(ix - 4, iy - 16 * pulse | 0, 8, 32 * pulse | 0);
    M.fillStyle = P.white; M.fillRect(ix - 4, iy - 4, 8, 8);
    // text (zh typed in quickly)
    const zx = Math.round((cx - (zh.width * zs) / 2 + 30) / 2) * 2, zy = y0 + 12;
    M.drawImage(zh, zx, zy, zh.width * zs, zh.height * zs);
    const ex = Math.round((cx - (en.width * es) / 2 + 30) / 2) * 2, ey = zy + zh.height * zs - 2;
    M.drawImage(en, ex, ey, en.width * es, en.height * es);
    M.restore();
  }
}

let _vignette = null;
function finish() {
  // CRT scanlines
  M.fillStyle = 'rgba(0,0,0,0.07)';
  for (let y = 3; y < OUT_H; y += 4) M.fillRect(0, y, OUT_W, 1);
  if (!_vignette) {
    _vignette = M.createRadialGradient(OUT_W / 2, OUT_H / 2, OUT_H * 0.45, OUT_W / 2, OUT_H / 2, OUT_H * 1.05);
    _vignette.addColorStop(0, 'rgba(20,16,12,0)'); _vignette.addColorStop(1, 'rgba(20,16,12,0.38)');
  }
  M.fillStyle = _vignette; M.fillRect(0, 0, OUT_W, OUT_H);
}

function sceneAt(t) {
  for (const s of TL.scenes) if (t >= s.start && t < s.end) return s;
  return TL.scenes[TL.scenes.length - 1];
}

function renderFrame(t) {
  resetCam();
  setCtx(og);
  og.setTransform(1, 0, 0, 1, 0, 0);
  og.fillStyle = P.night1; og.fillRect(0, 0, off.width, off.height);
  og.translate(MARGIN, MARGIN);
  const sc = sceneAt(t);
  SCENE_FN[sc.id](t);
  og.setTransform(1, 0, 0, 1, 0, 0);

  const cam = getCam();
  const [shx, shy] = shakeAt(t);
  const z = cam.zoom;
  const sw = W / z, sh = H / z;
  let sx = MARGIN + cam.x - sw / 2 + shx, sy = MARGIN + cam.y - sh / 2 + shy;
  sx = clamp(sx, 0, off.width - sw); sy = clamp(sy, 0, off.height - sh);
  M.imageSmoothingEnabled = false;
  M.fillStyle = P.night1; M.fillRect(0, 0, OUT_W, OUT_H);
  M.drawImage(off, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);

  setCtx(M);
  transitions(t);
  flashes(t);
  subtitles(t);
  finish();
  // global fade in/out
  const fin = 1 - seg(t, 0, 0.25), fout = seg(t, TL.duration - 0.5, TL.duration);
  const fa = Math.max(fin, fout);
  if (fa > 0) { M.globalAlpha = fa; M.fillStyle = '#000'; M.fillRect(0, 0, OUT_W, OUT_H); M.globalAlpha = 1; }
}

window.renderFrame = renderFrame;
window.renderReady = document.fonts ? document.fonts.ready.then(() => true) : Promise.resolve(true);
