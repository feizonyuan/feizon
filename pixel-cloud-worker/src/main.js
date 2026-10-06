'use strict';
// Compositor: renders each scene with temporal supersampling (real motion blur),
// then draws the sharp HUD frame and bilingual subtitles on top.

const TL = window.TL, EV = TL.events, FPS = TL.fps;
const SUBSAMPLES = window.SUBSAMPLES || 6, SHUTTER = 0.5; // 180° shutter
const main = document.getElementById('c');
const M = main.getContext('2d');
const layer = document.createElement('canvas'); layer.width = OW; layer.height = OH;
const L = layer.getContext('2d');
const acc = document.createElement('canvas'); acc.width = OW; acc.height = OH;
const A = acc.getContext('2d');

// [time, amplitude px, decay/s]
const SHAKES = [
  [EV.containerLand, 22, 6], [EV.hopLand, 10, 9], [EV.pipeClank, 6, 10], [EV.cratePop, 10, 8], [EV.crateBurst, 12, 7],
  ...EV.tugs.map(x => [x, 6, 10]), ...EV.sparks.map(x => [x, 6, 14]), ...EV.presses.map(x => [x, 26, 7]),
  [EV.liftoff, 16, 3], [EV.rocketHit, 26, 5], [54.5, 8, 10], [EV.reelOut, 8, 8], [EV.salute, 10, 8],
];
// [time, peak alpha, decay/s, colour]
const FLASHES = [
  [EV.ding, 0.18, 6, '#ffffff'], [EV.containerLand, 0.25, 8, '#ece7dd'], ...EV.presses.map(x => [x, 0.25, 10, '#ffffff']),
  [EV.crateBurst, 0.2, 8, '#ffffff'], [EV.rocketHit, 1.0, 2.6, '#ece7dd'], [EV.eyesOn + 0.3, 0.12, 8, '#ff3d1f'],
];

function shakeAt(t) {
  let a = 0;
  for (const [t0, amp, k] of SHAKES) if (t >= t0 && t - t0 < 1.5) a += amp * Math.exp(-(t - t0) * k);
  if (t > EV.ignite && t < EV.liftoff + 0.8) a += 5;
  if (a < 0.5) return [0, 0];
  return [Math.sin(t * 91.7) * a, Math.cos(t * 77.3) * a];
}

function sceneAt(t) {
  for (let i = 0; i < TL.scenes.length; i++) { const s = TL.scenes[i]; if (t >= s.start && t < s.end) return [s, i]; }
  return [TL.scenes[TL.scenes.length - 1], TL.scenes.length - 1];
}

function drawWorld(ctx, t) {
  setCtx(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  const [sx, sy] = shakeAt(t);
  ctx.translate(sx, sy);
  const [s] = sceneAt(t);
  SCENE_FN[s.id](t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [t0, a, k, col] of FLASHES) {
    if (t < t0 || t - t0 > 2) continue;
    const v = a * Math.exp(-(t - t0) * k);
    if (v > 0.01) { ctx.globalAlpha = v; ctx.fillStyle = col; ctx.fillRect(0, 0, OW, OH); ctx.globalAlpha = 1; }
  }
  // whiteout at the end of the droste zoom
  const z = 1 - Math.abs(t - 25.6) / 0.12;
  if (z > 0) { ctx.globalAlpha = clamp(z); ctx.fillStyle = C.CR; ctx.fillRect(0, 0, OW, OH); ctx.globalAlpha = 1; }
}

const THEME = { dark: [C.CR, C.RED, C.MUTE], light: [C.INK, C.RED, C.GREY], red: [C.INK, C.CR, '#5a1a0e'] };

function subtitles(t) {
  const theme = THEME[themeAt(t)];
  for (const s of window.SUBS) {
    const t0 = s.at - 0.05, t1 = s.at + s.dur + 0.35;
    if (t < t0 || t > t1) continue;
    const fade = 1 - seg(t, t1 - 0.2, t1);
    withAlpha(fade, () => {
      const r = ktext(s.zh, CX + 14, 948, { fam: 'zh', w: 500, size: 40, color: theme[0], t, t0, stagger: 0.018, dur: 0.35, align: 'center', track: 0.02 });
      circle(r.x0 - 22, 934, 6, theme[1]);
      withAlpha(seg(t, t0 + 0.15, t0 + 0.4), () => text(s.en, CX, 990, { fam: 'mono', size: 19, color: theme[2], align: 'center', track: 0.02 }));
    });
  }
}

function renderFrame(t) {
  const dt = SHUTTER / FPS;
  A.setTransform(1, 0, 0, 1, 0, 0);
  A.globalAlpha = 1; A.fillStyle = C.K; A.fillRect(0, 0, OW, OH);
  for (let k = 0; k < SUBSAMPLES; k++) {
    const tk = SUBSAMPLES === 1 ? t : t - dt / 2 + (dt * k) / (SUBSAMPLES - 1);
    drawWorld(L, Math.max(0, tk));
    A.globalAlpha = 1 / (k + 1);
    A.drawImage(layer, 0, 0);
  }
  M.setTransform(1, 0, 0, 1, 0, 0);
  M.globalAlpha = 1;
  M.drawImage(acc, 0, 0);
  setCtx(M);
  const [, idx] = sceneAt(t);
  const th = THEME[themeAt(t)];
  const dim = t > 49.6 ? 1 - EV.lightsOff.filter(x => t >= x).length * 0.28 : 1;
  hud(t, idx, th[0], th[1], t > EV.endCard ? 0.5 : dim, FPS);
  subtitles(t);
  // film grain-free global fades
  const fin = 1 - seg(t, 0, 0.3), fout = seg(t, TL.duration - 0.5, TL.duration);
  const fa = Math.max(fin, fout);
  if (fa > 0) { M.globalAlpha = fa; M.fillStyle = '#000'; M.fillRect(0, 0, OW, OH); M.globalAlpha = 1; }
}

const FONTS = ['900 100px "Inter Display"', 'italic 400 100px "Newsreader"', '400 20px "JetBrains Mono"', '600 20px "JetBrains Mono"',
  '900 100px "Noto Sans SC"', '500 40px "Noto Sans SC"', '700 40px "Noto Serif SC"'];
window.renderFrame = renderFrame;
window.renderReady = Promise.all(FONTS.map(f => document.fonts.load(f, 'Aa帮我做个像素风视频'))).then(() => document.fonts.ready).then(() =>
  FONTS.map(f => f + ':' + document.fonts.check(f, '帮A')));
