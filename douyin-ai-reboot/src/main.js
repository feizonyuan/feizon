'use strict';
// Compositor: scene with temporal supersampling (motion blur), then the sharp
// masthead, paper-fade scene cuts and the subtitles on top.

const FPS = TL.fps;
const SUBSAMPLES = window.SUBSAMPLES || 4, SHUTTER = 0.5;
const main = document.getElementById('c');
main.width = OW; main.height = OH;
const M = main.getContext('2d');
const layer = document.createElement('canvas'); layer.width = OW; layer.height = OH;
const Lc = layer.getContext('2d');
const acc = document.createElement('canvas'); acc.width = OW; acc.height = OH;
const A = acc.getContext('2d');

function sceneAt(t) {
  for (const s of TL.scenes) if (t >= s.start && t < s.end) return s;
  return TL.scenes[TL.scenes.length - 1];
}
function drawWorld(ctx, t) {
  setCtx(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  SCENE_FN[sceneAt(t).id](t);
}

// Cuts: the page fades to blank paper and the next one builds up (masthead stays).
function transitions(t) {
  for (const s of TL.scenes.slice(1)) {
    const d = Math.abs(t - s.start);
    if (d < 0.16) withAlpha(1 - d / 0.16, () => rect(0, 310, OW, OH - 310, C.PAPER));
  }
}

// Subtitles: ink on paper, keywords in red; two lines when wide.
const SUB_Y = 1494, SUB_SIZE = 46, SUB_MAX = 900;
function splitLine(str) {
  if (measure(str, 'sans', SUB_SIZE, 500) <= SUB_MAX) return [str];
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
    const k = cubicOut(seg(t, t0, t0 + 0.15));
    const rows = splitLine(l.zh);
    const hl = new Set();
    for (const h of l.hl) { const i0 = l.zh.indexOf(h); if (i0 >= 0) { const s0 = [...l.zh.slice(0, i0)].length; for (let q = 0; q < [...h].length; q++) hl.add(s0 + q); } }
    const lh = SUB_SIZE * 1.4, top = SUB_Y - (rows.length - 1) * lh / 2;
    let off = 0;
    withAlpha(k, () => {
      rows.forEach((r, ri) => {
        const base = off;
        text(r, CX, top + ri * lh + (1 - k) * 8, { fam: 'sans', size: SUB_SIZE, w: 500, align: 'center', color: j => (hl.has(base + j) ? C.RED : C.INK) });
        off += [...r].length;
      });
    });
  });
}

function renderFrame(t) {
  const dt = SHUTTER / FPS;
  A.setTransform(1, 0, 0, 1, 0, 0);
  A.globalAlpha = 1; A.fillStyle = C.PAPER; A.fillRect(0, 0, OW, OH);
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
  transitions(t);
  masthead(t);
  subtitles(t);
  const fout = seg(t, TL.duration - 0.35, TL.duration);
  if (fout > 0) withAlpha(fout, () => rect(0, 0, OW, OH, C.PAPER));
}

const FONTS = ['900 100px "Noto Serif SC"', '700 40px "Noto Serif SC"', '400 30px "Noto Sans SC"', '500 30px "Noto Sans SC"',
  '700 30px "Noto Sans SC"', '900 30px "Noto Sans SC"', '500 30px "Inter"', '700 30px "Inter"', '800 30px "Inter"'];
const SAMPLE = [...new Set(TL.scenes.flatMap(s => s.lines.map(l => l.zh)).join('') + (window.CORPUS || ''))].join('');
window.renderFrame = renderFrame;
window.renderReady = Promise.all(FONTS.map(f => document.fonts.load(f, SAMPLE))).then(() => document.fonts.ready).then(() =>
  FONTS.map(f => f + ':' + document.fonts.check(f, '20岁A')));
