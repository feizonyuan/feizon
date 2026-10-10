'use strict';
// Compositor: scene with temporal supersampling (motion blur), then the sharp HUD,
// pixel-block scene transitions and the subtitles on top.

const FPS = TL.fps;
const SUBSAMPLES = window.SUBSAMPLES || 4, SHUTTER = 0.5;
const main = document.getElementById('c');
main.width = OW; main.height = OH;
const M = main.getContext('2d');
const layer = document.createElement('canvas'); layer.width = OW; layer.height = OH;
const Lc = layer.getContext('2d');
const acc = document.createElement('canvas'); acc.width = OW; acc.height = OH;
const A = acc.getContext('2d');

// [time, amplitude px, decay/s]
const SHAKES = [
  [wordT('l01', '一部手机') + 0.15, 18, 7], [wordT('l01', '怎么翻身'), 26, 6],
  ...QUESTS.map(q => [SC[q.scene].end - 1.05, 12, 8]),
  [LN('l10').at + 0.05, 22, 6], [wordT('l12', '寿命') - 0.15, 12, 8], [wordT('l14', '多创造'), 14, 7],
];
function shakeAt(t) {
  let a = 0;
  for (const [t0, amp, k] of SHAKES) if (t >= t0 && t - t0 < 1.2) a += amp * Math.exp(-(t - t0) * k);
  return a < 0.5 ? [0, 0] : [Math.sin(t * 91.7) * a, Math.cos(t * 77.3) * a];
}
function sceneAt(t) {
  for (const s of TL.scenes) if (t >= s.start && t < s.end) return s;
  return TL.scenes[TL.scenes.length - 1];
}
function drawWorld(ctx, t) {
  setCtx(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  const [sx, sy] = shakeAt(t);
  ctx.translate(sx, sy);
  SCENE_FN[sceneAt(t).id](t);
}

// Pixel-block wipe across every scene cut.
function transitions(t) {
  const B = 120;
  for (const s of TL.scenes.slice(1)) {
    const b = s.start;
    if (Math.abs(t - b) > 0.3) continue;
    for (let y = 0; y < OH; y += B) for (let x = 0; x < OW; x += B) {
      const r = rnd(x * 0.37 + y * 1.13 + b);
      const w = 0.06 + 0.2 * r;
      if (Math.abs(t - b) < w) { rect(x, y, B, B, r > 0.85 ? C.Y : '#1a2456'); }
    }
  }
}

// Subtitles: dark pill, white text, keywords in yellow; wrap to two lines if wide.
const SUB_Y = 1488, SUB_SIZE = 50, SUB_MAX = 880;
function splitLine(str) {
  if (measure(str, 'zh', SUB_SIZE, 700) <= SUB_MAX) return [str];
  const chars = [...str], mid = chars.length / 2;
  let best = Math.round(mid), bd = 1e9;
  chars.forEach((ch, i) => { if ('，、：；'.includes(ch) && Math.abs(i + 1 - mid) < bd) { bd = Math.abs(i + 1 - mid); best = i + 1; } });
  return [chars.slice(0, best).join(''), chars.slice(best).join('')];
}
function subtitles(t) {
  const all = TL.scenes.flatMap(s => s.lines);
  all.forEach((l, i) => {
    const next = all[i + 1];
    const t0 = l.at - 0.04, t1 = Math.min(l.at + l.dur + 0.25, next ? next.at - 0.04 : 1e9);
    if (t < t0 || t > t1) return;
    const k = expoOut(seg(t, t0, t0 + 0.12));
    const rows = splitLine(l.zh);
    const hlIdx = new Set();
    const chars = [...l.zh];
    for (const h of l.hl) { const i0 = l.zh.indexOf(h); if (i0 >= 0) { const s0 = [...l.zh.slice(0, i0)].length; for (let q = 0; q < [...h].length; q++) hlIdx.add(s0 + q); } }
    let offset = 0;
    const lh = SUB_SIZE * 1.32, top = SUB_Y - (rows.length - 1) * lh / 2;
    withAlpha(k, () => {
      const wmax = Math.max(...rows.map(r => measure(r, 'zh', SUB_SIZE, 700)));
      rrect(CX - wmax / 2 - 30, top - SUB_SIZE * 0.98, wmax + 60, lh * rows.length + SUB_SIZE * 0.22, 18, 'rgba(6,9,24,0.72)');
      rows.forEach((r, ri) => {
        const base = offset;
        text(r, CX, top + ri * lh + (1 - k) * 12, { fam: 'zh', size: SUB_SIZE, w: 700, align: 'center', color: j => (hlIdx.has(base + j) ? C.Y : C.W) });
        offset += [...r].length;
      });
    });
  });
}

function renderFrame(t) {
  const dt = SHUTTER / FPS;
  A.setTransform(1, 0, 0, 1, 0, 0);
  A.globalAlpha = 1; A.fillStyle = C.BG; A.fillRect(0, 0, OW, OH);
  for (let k = 0; k < SUBSAMPLES; k++) {
    const tk = SUBSAMPLES === 1 ? t : t - dt / 2 + (dt * k) / (SUBSAMPLES - 1);
    drawWorld(Lc, Math.max(0, tk));
    A.globalAlpha = 1 / (k + 1);
    A.drawImage(layer, 0, 0);
  }
  M.setTransform(1, 0, 0, 1, 0, 0);
  M.globalAlpha = 1;
  M.drawImage(acc, 0, 0);
  setCtx(M);
  hud(t);
  transitions(t);
  subtitles(t);
  const fout = seg(t, TL.duration - 0.35, TL.duration);
  if (fout > 0) { M.globalAlpha = fout; M.fillStyle = '#000'; M.fillRect(0, 0, OW, OH); M.globalAlpha = 1; }
}

const FONTS = ['900 100px "Noto Sans SC"', '700 50px "Noto Sans SC"', '500 30px "Noto Sans SC"', '400 50px "ZCOOL QingKe HuangYou"', '400 30px "Press Start 2P"'];
const SAMPLE = [...new Set(TL.scenes.flatMap(s => s.lines.map(l => l.zh)).join('') + (window.CORPUS || ''))].join('');
window.renderFrame = renderFrame;
window.renderReady = Promise.all(FONTS.map(f => document.fonts.load(f, SAMPLE))).then(() => document.fonts.ready).then(() =>
  FONTS.map(f => f + ':' + document.fonts.check(f, '20岁A')));
