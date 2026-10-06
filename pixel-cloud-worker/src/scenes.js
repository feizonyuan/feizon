'use strict';
// "Claude Code: Cloud Shift" — eight editorial motion-graphics scenes.
// Each scene paints the full 1920x1080 frame for global time t. Event times: window.TL.events.

const E = window.TL.events;
const GY = 700; // ground line used by the container scenes
const lab = (color, size = 22) => ({ fam: 'mono', size, color, track: 0.04 });

// container: two sliding halves; open 0..1 slides them apart.
function container(x0, y0, w, h, o = {}) {
  const open = o.open || 0, t = o.t || 0;
  const halves = [[x0, -1], [x0 + w / 2, 1]];
  for (const [hx, dir] of halves) {
    c.save();
    c.translate(dir * open * w * 0.36, 0);
    c.beginPath(); c.rect(hx, y0, w / 2, h); c.clip();
    rect(x0, y0, w, h, C.CR);
    // content
    ktext('CC-01', x0 + w / 2, y0 + h * 0.66, { fam: 'disp', w: 900, size: 170, color: C.INK, t, t0: o.textT0 == null ? -1 : o.textT0, align: 'center', stagger: 0.05, track: -0.04 });
    text('CONTAINER', x0 + 28, y0 + 44, lab(C.INK, 16));
    text('4 vCPU · 15 GB · LINUX', x0 + w - 28, y0 + h - 26, { ...lab(C.INK, 16), align: 'right' });
    lineS(x0 + w / 2, y0 + 18, x0 + w / 2, y0 + h - 18, 'rgba(17,17,17,0.35)', 2);
    c.restore();
  }
  // roof lamps
  const lamps = o.lamps || [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const lx = x0 + w * (0.25 + i * 0.25), ly = y0 - 34;
    const s = lamps[i];
    if (s > 0) { withAlpha(0.25 * s, () => circle(lx, ly, 30 * s, C.RED)); rect(lx - 10 * s, ly - 10 * s, 20 * s, 20 * s, C.RED); }
    else { c.strokeStyle = 'rgba(236,231,221,0.35)'; c.lineWidth = 1.5; c.strokeRect(lx - 9, ly - 9, 18, 18); }
  }
}

// ---------------------------------------------------------------- 1. BOOT
function sBoot(t) {
  bg(C.K);
  const z = 1 + 0.045 * cubicInOut(seg(t, 3.2, 6.4));
  c.translate(CX, CY); c.scale(z, z); c.translate(-CX, -CY);
  // measuring axes
  const ax = expoOut(seg(t, 0.05, 1.0)), axA = 1 - seg(t, 1.7, 2.3);
  if (axA > 0) withAlpha(axA, () => {
    lineS(CX - 920 * ax, CY, CX + 920 * ax, CY, C.DIMK, 1.5);
    lineS(CX, CY - 500 * ax, CX, CY + 500 * ax, C.DIMK, 1.5);
    for (let i = -7; i <= 7; i++) {
      if (!i) continue;
      const k = expoOut(seg(t, 0.15 + Math.abs(i) * 0.04, 0.45 + Math.abs(i) * 0.04));
      const hh = (i % 4 === 0 ? 30 : 14) * k;
      lineS(CX + i * 120, CY - hh / 2, CX + i * 120, CY + hh / 2, 'rgba(236,231,221,0.32)', 1.5);
    }
  });
  // labels
  if (t < E.ding) typed('> session start', CX + 60, CY - 44, t, E.termType[0], 14, lab(C.CR));
  else if (t < 1.75) {
    text('(a) POINT', CX + 60, CY - 44, lab(C.CR));
    text('r = ' + (20 * clamp(spring(t - E.ding, 2.4, 6), 0, 1.3)).toFixed(2) + 'px', CX + 60, CY - 12, lab(C.GREY));
  }
  // the point
  const r = 20 * spring(t - E.ding, 2.4, 6);
  let dy = CY, sx = 1, sy = 1;
  if (t > 1.6) {
    const k = seg(t, 1.6, 1.95);
    dy = lerp(CY, GY - 20, cubicIn(k));
    if (k < 1) { sy = 1 + 0.3 * k; sx = 1 - 0.18 * k; }
    else { const w = wobble(t - 1.95, 2.6, 6); sy = 1 - 0.4 * w; sx = 1 + 0.35 * w; dy = GY - 20 + 8 * w; }
  }
  if (t > E.ding && t < 2.4) withAlpha(0.7 * (1 - seg(t, 1.6, 2.2)), () => ringS(CX, CY, 290 * expoOut(seg(t, E.ding, E.ding + 1.0)), C.RED, 1.5));
  for (let k = 0; k < 3; k++) {
    const d = t - E.ding - k * 0.12;
    if (d > 0 && d < 0.9) withAlpha(1 - d / 0.9, () => ringS(CX, CY, 30 + d * 700, k ? C.CR : C.RED, 2 - k * 0.4));
  }
  if (t > E.ding && t < 1.6) withAlpha(0.18, () => circle(CX, CY, 38, C.CR));
  if (t > E.ding && t < 3.0) push(() => { c.translate(CX, dy); c.scale(sx, sy); circle(0, 0, r, C.RED); });
  // the line
  if (t > 1.95) {
    const k = expoOut(seg(t, 1.95, 2.55));
    lineS(CX - 860 * k, GY, CX + 860 * k, GY, C.RED, 3);
    if (t < 2.9) withAlpha(1 - seg(t, 2.6, 2.9), () => text('(b) LINE', CX - 860 * k, GY - 22, lab(C.CR)));
  }
  burst(t, 1.95, { n: 26, x: CX, y: GY, spd: [200, 700], ang: [Math.PI * 1.05, Math.PI * 1.95], life: 0.7, size: 7, colors: [C.RED, C.CR], seed: 3 });
  // the plane: container drops
  if (t > E.containerDrop) {
    const k = seg(t, E.containerDrop, E.containerLand);
    const w = 760, h = 320;
    let y0 = lerp(-420, GY - h, cubicIn(k));
    let sq = 0;
    if (t > E.containerLand) sq = wobble(t - E.containerLand, 2.4, 6) * 0.08;
    push(() => {
      c.translate(CX, GY); c.scale(1 + sq, 1 - sq); c.translate(-CX, -GY);
      const lamps = [0, 1, 2].map(i => clamp(spring(t - (3.3 + i * 0.3), 3, 7), 0, 1.4));
      container(CX - w / 2, y0, w, h, { t, textT0: 3.05, lamps });
    });
    if (t > E.containerLand && t < 4.2) withAlpha(1 - seg(t, 3.8, 4.2), () => text('(c) PLANE', CX - w / 2, GY - h - 70, lab(C.CR)));
    burst(t, E.containerLand, { n: 60, x: CX, y: GY, jx: 760, spd: [100, 520], ang: [Math.PI * 1.08, Math.PI * 1.92], grav: 900, life: 0.9, size: 8, colors: [C.CR, C.CR, C.RED], shape: 'sq', seed: 7 });
    burst(t, E.containerLand, { n: 30, x: CX, y: GY, jx: 700, spd: [300, 900], ang: [Math.PI * 1.1, Math.PI * 1.9], life: 0.5, size: 10, colors: [C.CR], shape: 'line', seed: 8 });
  }
  // status readout
  const rows = [['STATUS', 'READY'], ['REGION', 'CLOUD'], ['UPTIME', '00:00:0' + Math.max(0, Math.floor(t - 3))]];
  rows.forEach(([k, v], i) => {
    const t0 = 4.1 + i * 0.18;
    if (t < t0) return;
    const s = `${k} ${'.'.repeat(12)} ${v}`;
    typed(s, 150, 800 + i * 32, t, t0, 60, lab(i === 0 ? C.CR : C.GREY, 18));
  });
}

// ---------------------------------------------------------------- 2. WAKE
function sWake(t) {
  if (t < E.bubbleIn) {
    bg(C.K);
    const z = 1.045 + 0.13 * cubicOut(seg(t, 6.4, 8.4));
    c.translate(CX, 600); c.scale(z, z); c.translate(-CX, -600);
    lineS(CX - 860, GY, CX + 860, GY, C.RED, 3);
    const open = expoInOut(seg(t, E.doorOpen, E.doorOpen + 0.55));
    const hop = seg(t, E.hop, E.hopLand);
    const inside = t < E.hop;
    const eyesOff = t < E.eyesOn || (t < E.eyesOn + 0.3 && Math.floor(t * 30) % 2 === 0);
    if (inside) {
      if (t > E.eyesOn) withAlpha(0.25 * (0.6 + 0.4 * Math.sin(t * 10)), () => circle(CX, 640, 70, C.RED));
      hero(CX, 640, 40, { t, eyesOff });
    }
    container(CX - 380, GY - 320, 760, 320, { t, open, lamps: [1, 1, 1], textT0: -1 });
    burst(t, E.doorOpen + 0.1, { n: 40, x: CX, y: 420, jx: 120, spd: [60, 260], ang: [Math.PI * 1.2, Math.PI * 1.8], life: 1.1, size: 12, colors: [C.CR], seed: 21 });
    burst(t, E.eyesOn + 0.3, { n: 24, x: CX, y: 640, spd: [200, 500], life: 0.6, size: 5, colors: [C.RED, C.CR], shape: 'line', seed: 22 });
    if (!inside) {
      const y = lerp(640, 820, hop) - Math.sin(hop * Math.PI) * 170;
      const r = lerp(40, 86, cubicOut(hop));
      let sx = 1, sy = 1;
      if (hop < 1) { sy = 1.2; sx = 0.85; }
      else { const w = wobble(t - E.hopLand, 2.5, 6); sy = 1 - 0.35 * w; sx = 1 + 0.3 * w; }
      hero(CX, y + (hop >= 1 ? r * (1 - sy) : 0), r, { t, sx, sy, face: t > E.hopLand + 0.1 ? 'happy' : 'normal' });
      burst(t, E.hopLand, { n: 40, x: CX, y: 900, jx: 160, spd: [150, 500], ang: [Math.PI * 1.05, Math.PI * 1.95], grav: 700, life: 0.7, size: 9, colors: [C.CR, C.RED], shape: 'sq', seed: 23 });
    }
    return;
  }
  // ---- the request, full red
  bg(C.RED);
  if (t < E.salute) typed('NEW TASK · FROM: USER', 150, 230, t, E.bubbleIn + 0.05, 40, lab(C.INK, 20));
  const out = E.salute - 0.5;
  ktext('帮我做个', 150, 470, { fam: 'zh', w: 900, size: 200, color: C.INK, t, t0: E.bubbleIn + 0.12, stagger: 0.06, out, outDur: 0.25, track: 0 });
  ktext('像素风视频！', 150, 700, { fam: 'zh', w: 900, size: 200, color: C.INK, t, t0: E.bubbleIn + 0.32, stagger: 0.06, out: out + 0.05, outDur: 0.25, track: 0 });
  ktext('make me a pixel video, please.', 158, 800, { fam: 'serif', w: 400, size: 56, color: C.INK, t, t0: E.bubbleIn + 0.9, stagger: 0.012, dur: 0.5, track: 0, out: out + 0.1, outDur: 0.25 });
  // hero reacting
  const ex = t - E.exclaim;
  let hx = 1580, hy = 600 + Math.sin(t * 3) * 6, hr = 80, face = 'normal', look = -1, sx = 1, sy = 1;
  if (ex > 0) { face = 'surprise'; look = 0; hy -= Math.sin(clamp(ex / 0.4) * Math.PI) * 90; const w = wobble(ex - 0.4, 2.5, 6); if (ex > 0.4) { sy = 1 - 0.3 * w; sx = 1 + 0.25 * w; } }
  const sal = t - E.salute;
  // OK.
  if (sal > -0.02) {
    const ok = ktext('OK', 300, 800, { fam: 'disp', w: 900, size: 600, color: C.INK, t, t0: E.salute, stagger: 0.07, dur: 0.5, track: -0.05 });
    const px = ok.x0 + ok.w + 70, py = 800 - 52;
    const k = expoOut(seg(t, E.salute + 0.05, E.salute + 0.5));
    hx = lerp(1580, px, k); hy = lerp(hy, py, k); hr = lerp(80, 56, k);
    face = 'happy'; look = 0;
    const w = wobble(t - E.salute - 0.5, 2.5, 6); sx = 1 + 0.3 * w; sy = 1 - 0.3 * w;
    for (let i = 0; i < 10; i++) {
      const d = t - E.salute - 0.45;
      if (d < 0 || d > 0.5) continue;
      const a = (i / 10) * Math.PI * 2, r0 = 80 + d * 300, r1 = r0 + 50 * (1 - d / 0.5);
      lineS(px + Math.cos(a) * r0, py + Math.sin(a) * r0, px + Math.cos(a) * r1, py + Math.sin(a) * r1, C.INK, 5);
    }
    typed('ACCEPTED · 1 TASK QUEUED', 150, 230 + 0, t, E.salute + 0.6, 40, lab(C.INK, 20));
  }
  if (ex > 0 && sal < 0) {
    const k = spring(ex, 2.6, 6);
    push(() => { c.translate(1580, 400); c.scale(k, k); text('!', 0, 0, { fam: 'disp', w: 900, size: 300, color: C.INK, align: 'center' }); });
  }
  hero(hx, hy, hr, { t, color: C.INK, eye: C.RED, face, look, sx, sy });
}

// ---------------------------------------------------------------- 3. GIT CLONE
const G = { cols: 10, rows: 6, cell: 40, sq: 26, x: 1300, y: 380 };
const BIG = { cols: 30, rows: 8, cell: 40, sq: 26, x: 560, y: 340 };
function sClone(t) {
  bg(C.CR);
  // wipe in (cream panel sweeps over the red)
  if (t < 13.5) { bg(C.RED); rect(OW * (1 - expoOut(seg(t, 13.2, 13.5))), 0, OW, OH, C.CR); }
  // heading
  const head = ktext('Step one,', 150, 250, { fam: 'serif', w: 400, size: 100, color: C.INK, t, t0: 13.3, stagger: 0.02, track: 0 });
  const h1 = ktext('GIT CLONE', 150 + 380, 250, { fam: 'disp', w: 900, size: 116, color: C.INK, t, t0: 13.42, out: 17.7, track: -0.045 });
  const h2 = ktext('ACQUIRED', 150 + 380, 250, { fam: 'disp', w: 900, size: 116, color: C.INK, t, t0: 17.85, track: -0.045 });
  const dotx = t > 17.8 ? 530 + h2.w + 26 : 530 + h1.w + 26;
  if (t > 13.7) circle(dotx, 238, 13 * clamp(spring(t - 13.7, 3, 7), 0, 1.3), C.RED);
  // ground
  const gk = expoOut(seg(t, 13.3, 13.9));
  lineS(150, 780, 150 + 1620 * gk, 780, C.INK, 2);
  // hero pulls
  let pulled = 0, strain = 0;
  E.tugs.forEach(tg => { pulled += clamp(spring(t - tg, 2.2, 7), 0, 1.2); if (t > tg && t < tg + 0.5) strain = 1; });
  const flown = t > E.cratePop;
  let hx = 560 - 26 * pulled, hy = 734, sx = 1, sy = 1, face = strain ? 'strain' : 'normal';
  E.tugs.forEach(tg => { const w = wobble(t - tg, 2.6, 7); sx += 0.28 * w; sy -= 0.28 * w; });
  if (flown) { const w = wobble(t - E.cratePop, 2.2, 5); sx = 1 + 0.3 * w; sy = 1 - 0.3 * w; face = 'surprise'; }
  if (t > E.crateBurst) { face = 'happy'; hy -= Math.abs(Math.sin((t - E.crateBurst) * 9)) * 40 * Math.exp(-(t - E.crateBurst) * 1.2); }
  // remote grid offset (ripples column by column on each tug)
  const gridShift = col => {
    let s = 0;
    E.tugs.forEach(tg => { s += 60 * clamp(spring(t - tg - col * 0.025, 2.4, 7), 0, 1.3); });
    return s;
  };
  // dashed remote box
  if (!flown || t < E.cratePop + 0.6) withAlpha(1 - seg(t, E.cratePop, E.cratePop + 0.4), () => {
    c.setLineDash([8, 8]); c.strokeStyle = 'rgba(17,17,17,0.45)'; c.lineWidth = 1.5;
    c.strokeRect(G.x - 30, G.y - 30, G.cols * G.cell + 40, G.rows * G.cell + 40); c.setLineDash([]);
    text('origin / feizon · remote', G.x - 30, G.y - 46, lab(C.INK, 16));
  });
  // rope
  if (t > E.pipeDown && !flown) {
    const tip = expoOut(seg(t, E.pipeDown, E.pipeClank));
    const gx = G.x - gridShift(0), gy = G.y + G.rows * G.cell / 2;
    const x0 = hx + 46 * sx, y0 = hy;
    const x1 = lerp(x0, gx - 10, tip), y1 = lerp(y0, gy, tip);
    const sag = (1 - strain * 0.9) * 40 * tip + wobble(t - E.pipeClank, 4, 5) * 30;
    c.strokeStyle = C.INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0);
    c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1); c.stroke();
    circle(x1, y1, 7, C.RED);
  }
  // squares
  const n = G.cols * G.rows;
  for (let i = 0; i < n; i++) {
    const col = i % G.cols, row = Math.floor(i / G.cols);
    let x = G.x + col * G.cell - gridShift(col), y = G.y + row * G.cell, rot = 0;
    if (flown) {
      const tx = BIG.x + (col + 10) * BIG.cell, ty = BIG.y + (row + 1) * BIG.cell;
      const k = expoInOut(clamp((t - E.cratePop - (col + row) * 0.018) / 0.55));
      const ax = lerp(x, tx, k), ay = lerp(y, ty, k) - Math.sin(k * Math.PI) * 220;
      rot = (1 - k) * k * 4 * (rnd(i) - 0.5) * 3;
      x = ax; y = ay;
    }
    const red = rnd(i * 3) < 0.14;
    push(() => { c.translate(x + G.sq / 2, y + G.sq / 2); c.rotate(rot); rect(-G.sq / 2, -G.sq / 2, G.sq, G.sq, red ? C.RED : C.INK); });
  }
  // unpacked file grid
  if (t > E.crateBurst) {
    const d = t - E.crateBurst;
    for (let row = 0; row < BIG.rows; row++) for (let col = 0; col < BIG.cols; col++) {
      if (col >= 10 && col < 20 && row >= 1 && row < 7) continue;
      const dist = Math.hypot(col - 14.5, (row - 3.5) * 1.6);
      const k = clamp(spring(d - dist * 0.025, 2.4, 6), 0, 1.25);
      if (k <= 0) continue;
      const s = BIG.sq * k;
      const wave = Math.sin(col * 0.5 - d * 9 + row * 0.3);
      const red = wave > 0.93 || rnd(col * 31 + row) < 0.06;
      const x = BIG.x + col * BIG.cell + BIG.sq / 2, y = BIG.y + row * BIG.cell + BIG.sq / 2;
      rect(x - s / 2, y - s / 2, s, s, red ? C.RED : C.INK);
    }
    burst(t, E.crateBurst, { n: 50, x: BIG.x + 15 * BIG.cell, y: BIG.y + 4 * BIG.cell, spd: [300, 1100], life: 0.8, size: 12, colors: [C.RED, C.INK], shape: 'line', seed: 37 });
    const files = 1248 * expoOut(seg(t, E.crateBurst, E.crateBurst + 1.2));
    text('FILES', 1330, 750, lab(C.GREY, 16));
    odometer(Math.floor(files), 4, 1410, 752, { size: 46, color: C.INK });
    text('32.4 MB · 214 COMMITS', 1770, 750, { ...lab(C.GREY, 16), align: 'right' });
  }
  // tug labels
  E.tugs.forEach((tg, i) => {
    const d = t - tg;
    if (d < 0 || d > 0.6) return;
    withAlpha(1 - seg(d, 0.4, 0.6), () => text(`TUG 0${i + 1}/03`, hx - 50, hy - 90 - d * 60, lab(C.INK, 18)));
  });
  hero(hx, hy, 46, { t, sx, sy, face, look: flown ? 1 : 0.5 });
  // black ball transition into the code scene (grows from the hero)
  if (t > 18.95) circle(hx, hy, 2400 * expoIn(seg(t, 18.95, 19.4)), C.K);
}

// ---------------------------------------------------------------- 4. CODE
function sCode(t) {
  bg(C.K);
  const t0 = E.typing[0], phaseB = t > E.miniRobot;
  const outK = expoIn(seg(t, E.miniRobot, E.miniRobot + 0.35));
  if (!phaseB || outK < 1) push(() => {
    c.translate(0, -outK * 900);
    // editor
    c.save(); c.beginPath(); c.rect(140, 170, 940, 660); c.clip();
    const dt = Math.max(0, t - t0 + 0.4);
    const scroll = 40 * dt + 70 * Math.pow(dt, 2.6);
    const rowH = 34, first = Math.floor(scroll / rowH);
    const cols = [C.CR, C.RED, C.GREY, 'rgba(236,231,221,0.4)'];
    for (let i = first - 2; i < first + 22; i++) {
      if (i < 0) continue;
      const y = 830 - (scroll - i * rowH) * -1 - (first + 20) * rowH + scroll * 0 ;
      const yy = 170 + i * rowH - scroll + 300;
      if (yy < 150 || yy > 850) continue;
      text(String(i + 1).padStart(3, '0'), 150, yy + 11, lab('rgba(236,231,221,0.3)', 15));
      let x = 230 + Math.floor(rnd(i * 3) * 4) * 36;
      const parts = 1 + Math.floor(rnd(i * 7) * 4);
      for (let p = 0; p < parts; p++) {
        const w = 40 + Math.floor(rnd(i * 11 + p) * 200);
        if (x + w > 1070) break;
        rrect(x, yy, w, 12, 6, cols[Math.floor(rnd(i * 5 + p) * cols.length)]);
        x += w + 16;
      }
    }
    c.restore();
    lineS(140, 170, 140, 830, C.DIMK, 1.5);
    // WPM odometer + meter
    const v = lerp(60, 9999, cubicIn(seg(t, t0, E.typing[1])));
    text('WPM', 1240, 300, lab(C.GREY, 18));
    odometer(Math.floor(v), 4, 1232, 540, { size: 250, color: C.CR });
    const segs = 16, on = Math.round((v / 9999) * segs);
    for (let i = 0; i < segs; i++) rect(1240 + i * 32, 590, 24, 12, i < on ? C.RED : 'rgba(236,231,221,0.15)');
    text(v > 8000 ? 'wpm ' + Math.floor(v) + ' · OVERHEAT' : 'wpm ' + Math.floor(v), 1240, 640, lab(v > 8000 ? C.RED : C.GREY, 16));
    // keyboard
    for (let r = 0; r < 3; r++) for (let k = 0; k < 13; k++) {
      const hot = t > t0 && t < E.typing[1] && rnd(k * 13 + r * 7 + Math.floor(t * 26) * 3) > 0.82;
      const x = 1240 + k * 40 + r * 10, y = 700 + r * 30 + (hot ? 3 : 0);
      rrect(x, y, 32, 22, 4, hot ? C.RED : 'rgba(236,231,221,0.85)');
    }
    // hero typing
    const b = t > t0 && t < E.typing[1] ? Math.abs(Math.sin(t * 22)) * 12 : 0;
    hero(1160, 740 - b, 34, { t, look: 1, lookY: 0.6, face: t > E.sparks[4] ? 'strain' : 'normal' });
    stream(t, E.sparks[4], 25.6, 8, 1.2, (age, bt, j) => withAlpha(0.6 * (1 - age / 1.2), () => circle(1150 + rnd(j) * 30 + age * 20, 690 - age * 120, 6 + age * 14, C.CR)));
    E.sparks.forEach((st, i) => burst(t, st, { n: 30, x: 1240 + rnd(i * 5) * 500, y: 700, spd: [400, 1100], ang: [Math.PI * 1.05, Math.PI * 1.95], grav: 1800, life: 0.5, size: 10, colors: [C.RED, C.CR, '#ffd29a'], shape: 'line', seed: 42 + i }));
  });
  // ---- phase B: frame inside frame inside frame (droste), then zoom through
  if (phaseB) {
    const s = 0.42, w0 = 1000, h0 = 562, fx = CX, fy = 560;
    const zk = expoIn(seg(t, E.zoomIn, 25.6));
    const Z = Math.pow(1 / s, 3 * zk);
    for (let k = 0; k < 9; k++) {
      const pk = clamp(spring(t - E.miniRobot - 0.1 - k * 0.09, 2.2, 6), 0, 1.15);
      if (pk <= 0) continue;
      const sc = Z * Math.pow(s, k) * pk;
      const w = w0 * sc, h = h0 * sc;
      if (w > 12000 || w < 4) continue;
      c.strokeStyle = k % 2 ? C.RED : C.CR; c.lineWidth = Math.max(1, 3 * Math.min(1, sc * 2));
      c.strokeRect(fx - w / 2, fy - h / 2, w, h);
      if (sc > 0.08) {
        const hy = fy + h * 0.28, hxx = fx - w * 0.3;
        hero(hxx, hy - Math.abs(Math.sin(t * 6 + k)) * 30 * sc, 70 * sc, { t: t + k * 0.3, face: 'happy', rot: Math.sin(t * 7 + k) * 0.25 });
        if (sc > 0.2) text(`FRAME ${String(k).padStart(2, '0')}`, fx - w / 2 + 16 * sc, fy - h / 2 + 34 * sc, lab(k % 2 ? C.RED : C.CR, 20 * sc));
      }
    }
    ktext('Every frame, drawn in code.', CX, 200, { fam: 'serif', w: 400, size: 66, color: C.CR, t, t0: 23.0, stagger: 0.014, align: 'center', track: 0, out: E.zoomIn - 0.1 });
  }
}

// ---------------------------------------------------------------- 5. HEADLESS
const SNAPPOS = [[620, 560], [820, 500], [520, 620], [760, 640], [900, 560], [600, 480], [700, 560], [860, 620], [540, 540], [780, 470], [650, 650], [880, 520], [720, 600], [740, 540]];
const SNAPFACE = ['happy', 'surprise', 'normal', 'happy', 'strain', 'happy', 'surprise', 'happy', 'normal', 'happy', 'surprise', 'happy', 'sleepy', 'happy'];
function sCamera(t) {
  bg(C.CR);
  const chop = 27.3;
  // ---- part 1: the literal gag
  if (t < 28.25) push(() => {
    const exitK = expoIn(seg(t, 28.0, 28.25));
    c.translate(0, -exitK * 900);
    typed('(e) HEADLESS BROWSER · CHROMIUM', 300, 330, t, 25.75, 50, lab(C.INK, 20));
    const size = 300, word = 'HEADLESS', base = 640;
    setFont('disp', size, 900);
    const ws = [...word].map(ch => c.measureText(ch).width - 0.045 * size);
    const total = ws.reduce((a, b) => a + b, 0);
    const headW = ws.slice(0, 4).reduce((a, b) => a + b, 0);
    let x = CX - total / 2;
    const slide = expoOut(seg(t, chop + 0.15, chop + 0.6)) * (headW / 2 + 40);
    for (let i = 0; i < word.length; i++) {
      const k = clamp((t - 25.7 - i * 0.04) / 0.55);
      if (k > 0) {
        let dx = 0, dy = (1 - expoOut(k)) * size * 1.05, rot = 0;
        const fall = t - chop - i * 0.03;
        if (i < 4 && fall > 0) { dy += 0.5 * 4200 * fall * fall - 300 * fall; dx = (rnd(i) - 0.3) * 500 * fall; rot = (rnd(i + 3) - 0.5) * 7 * fall; }
        if (i >= 4) dx = -slide;
        c.save();
        if (fall <= 0 || i >= 4) { c.beginPath(); c.rect(x - 40 + dx, base - size * 0.86, ws[i] + 80, size * 1.2); c.clip(); }
        c.translate(x + dx + ws[i] / 2, base + dy - size * 0.35); c.rotate(rot);
        c.fillStyle = C.INK; c.fillText(word[i], -ws[i] / 2, size * 0.35);
        c.restore();
      }
      x += ws[i];
    }
    // the slice
    const sk = seg(t, chop - 0.12, chop + 0.02);
    if (sk > 0 && t < chop + 0.4) withAlpha(1 - seg(t, chop + 0.1, chop + 0.4), () => rect(0, base - size * 0.35 - 3, OW * expoOut(sk), 6, C.RED));
    burst(t, chop, { n: 30, x: CX - total / 2 + headW, y: base - 100, spd: [300, 900], life: 0.5, size: 10, colors: [C.RED, C.INK], shape: 'line', seed: 51 });
    if (t > chop + 0.45) {
      const q = clamp(spring(t - chop - 0.45, 2.4, 6), 0, 1.3);
      const qx = CX - total / 2 + total - slide + 50;
      push(() => { c.translate(qx + 90, base - 110 + Math.sin(t * 5) * 10); c.scale(q, q); text('?', 0, 110, { fam: 'disp', w: 900, size: 300, color: C.RED, align: 'center' }); });
    }
  });
  // ---- part 2: viewfinder + contact sheet
  if (t > 28.0) {
    const k = expoOut(seg(t, 28.0, 28.35));
    const vx = 200, vy = 230, vw = 1100, vh = 620;
    withAlpha(k, () => {
      c.strokeStyle = C.INK; c.lineWidth = 3; const L = 46;
      for (const [x, y, sx, sy] of [[vx, vy, 1, 1], [vx + vw, vy, -1, 1], [vx, vy + vh, 1, -1], [vx + vw, vy + vh, -1, -1]]) {
        c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke();
      }
      lineS(vx + vw / 2 - 18, vy + vh / 2, vx + vw / 2 + 18, vy + vh / 2, C.DIMC, 2);
      lineS(vx + vw / 2, vy + vh / 2 - 18, vx + vw / 2, vy + vh / 2 + 18, C.DIMC, 2);
      if (Math.floor(t * 2) % 2 === 0) circle(vx + 40, vy + 44, 9, C.RED);
      text('REC · 1080P60 · HEADLESS', vx + 60, vy + 51, lab(C.INK, 16));
      text('FRAMES', vx + vw - 300, vy + 51, lab(C.GREY, 16));
      const fc = 1710 * clamp(Math.pow(seg(t, E.snaps[0], E.snaps[E.snaps.length - 1] + 0.35), 1.6));
      odometer(Math.floor(fc), 4, vx + vw - 210, vy + 62, { size: 54, color: C.INK });
    });
    // hero poses
    let si = -1;
    E.snaps.forEach((s, i) => { if (t >= s) si = i; });
    const prev = si > 0 ? SNAPPOS[si - 1] : [700, 560], cur = si >= 0 ? SNAPPOS[si] : [700, 560];
    const mk = si >= 0 ? expoOut(seg(t, E.snaps[si], E.snaps[si] + 0.12)) : 1;
    const hx = lerp(prev[0], cur[0], mk), hy = lerp(prev[1], cur[1], mk);
    const w = si >= 0 ? wobble(t - E.snaps[si], 3, 7) : 0;
    if (t > 28.15) hero(hx, hy, 90 * clamp(spring(t - 28.15, 2.4, 6), 0, 1.2), { t, face: si >= 0 ? SNAPFACE[si] : 'normal', sx: 1 + 0.3 * w, sy: 1 - 0.3 * w, rot: si >= 0 ? (rnd(si) - 0.5) * 0.5 : 0 });
    // contact sheet
    const slot = i => [1400 + (i % 2) * 190, 230 + Math.floor(i / 2) * 90];
    for (let i = 0; i < E.snaps.length; i++) {
      const d = t - E.snaps[i];
      if (d < 0) { const [sx_, sy_] = slot(i); c.strokeStyle = 'rgba(17,17,17,0.18)'; c.lineWidth = 1.5; c.strokeRect(sx_, sy_, 170, 76); continue; }
      const f = expoOut(clamp(d / 0.4));
      const [sx_, sy_] = slot(i);
      const x = lerp(vx, sx_, f), y = lerp(vy, sy_, f), w2 = lerp(vw, 170, f), h2 = lerp(vh, 76, f);
      push(() => {
        c.translate(x + w2 / 2, y + h2 / 2); c.rotate((1 - f) * (rnd(i) - 0.5) * 0.6);
        withAlpha(lerp(0.25, 1, f), () => { rect(-w2 / 2, -h2 / 2, w2, h2, C.INK); });
        const p = SNAPPOS[i];
        hero(((p[0] - vx) / vw - 0.5) * w2, ((p[1] - vy) / vh - 0.5) * h2, 90 * w2 / vw, { t, face: SNAPFACE[i], eye: C.CR });
      });
    }
  }
  // camera flash (invert)
  E.snaps.forEach(s => { const d = t - s; if (d >= 0 && d < 0.1) withAlpha(0.55 * (1 - d / 0.1), () => bg(C.INK)); });
}

// ---------------------------------------------------------------- 6. FFMPEG
function sFF(t) {
  bg(C.RED);
  if (t < 32.7) { bg(C.CR); rect(0, 0, OW * expoOut(seg(t, 32.4, 32.7)), OH, C.RED); }
  typed('(f) ENCODE · H.264 · 60 FPS', 150, 230, t, 32.55, 40, lab(C.INK, 20));
  lineS(150, 780, 1770, 780, C.INK, 2);
  // ram
  let ram = 0;
  E.presses.forEach(p => {
    const d = t - p;
    if (d > -0.09 && d < 0) ram = Math.max(ram, expoIn((d + 0.09) / 0.09));
    else if (d >= 0 && d < 0.12) ram = 1;
    else if (d >= 0.12 && d < 0.6) ram = Math.max(ram, 1 - cubicOut((d - 0.12) / 0.48));
  });
  const nPress = E.presses.filter(p => t >= p - 0.02).length;
  const Hs = [330, 220, 130, 46];
  const Hc = lerp(Hs[Math.max(0, nPress - 1)], Hs[nPress], nPress ? expoOut(seg(t, E.presses[nPress - 1] - 0.02, E.presses[nPress - 1] + 0.05)) : 0);
  const reel = t > E.reelOut;
  // stack of frames on the belt
  const sx = lerp(-300, CX, expoOut(seg(t, E.conveyor, E.presses[0] - 0.3)));
  if (!reel) {
    const n = 14, ch = Math.max(6, Hc * 0.42), gap = (Hc - ch) / (n - 1);
    for (let i = 0; i < n; i++) {
      const y = 780 - ch - i * gap, x = sx - 180 + (i % 2 ? 8 : -8) * (Hc / 330);
      rect(x - 2, y - 2, 364, ch + 4, C.INK);
      rect(x, y, 360, ch, i % 3 === 0 ? C.CR : '#f6d9cf');
    }
    for (let i = 0; i < 16; i++) { const x = ((i * 120 + t * 400) % 1680) + 150; rect(x, 790, 40, 4, 'rgba(17,17,17,0.35)'); }
  }
  // slab
  const slabUp = expoIn(seg(t, E.reelOut - 0.2, E.reelOut + 0.2));
  const slabBottom = lerp(320, 780 - Hc, ram) - slabUp * 600;
  rect(CX - 400, slabBottom - 200, 800, 200, C.INK);
  rect(CX - 400, slabBottom - 200, 800, 6, C.CR);
  text('FFMPEG', CX, slabBottom - 52, { fam: 'disp', w: 900, size: 130, color: C.RED, align: 'center', track: -0.03 });
  lineS(CX, slabBottom - 200, CX, -50, C.INK, 18);
  E.presses.forEach((p, i) => {
    burst(t, p, { n: 50, x: CX, y: 780, jx: 360, spd: [300, 1100], ang: [Math.PI * 1.05, Math.PI * 1.95], grav: 2200, life: 0.6, size: 12, colors: [C.CR, C.INK, '#ffd29a'], shape: 'line', seed: 61 + i });
    burst(t, p, { n: 24, x: CX, y: 770, jx: 700, spd: [60, 200], ang: [Math.PI * 1.1, Math.PI * 1.9], life: 1.0, size: 26, colors: [C.CR], seed: 64 + i });
    const word = ['BANG.', 'CLANG.', 'BOOM.'][i], left = i !== 1;
    ktext(word, left ? 150 : 1770, 640, {
      fam: 'disp', w: 900, size: 210, color: C.INK, t, t0: p, stagger: 0.03, dur: 0.35, out: p + 0.5, outDur: 0.3, align: left ? 'left' : 'right',
      dy: (j, tt) => -Math.abs(Math.sin((tt - p) * 14 + j * 0.9)) * 40 * Math.exp(-(tt - p) * 4), mask: false, track: -0.05,
    });
  });
  // reel
  if (reel) {
    const k = expoOut(seg(t, E.reelOut, E.reelOut + 0.5));
    const cy = lerp(780 - 23, 520, k), w = lerp(360, 260, k), h = lerp(46, 260, k), rr = lerp(4, 130, k);
    const zap = t > E.audioZap;
    if (zap) for (let i = 0; i < 4; i++) { const r0 = 140 + ((t - E.audioZap) * 260 + i * 60) % 240; withAlpha(1 - (r0 - 140) / 240, () => ringS(CX, cy, r0, C.CR, 3)); }
    push(() => {
      c.translate(CX, cy); c.rotate(k * 1.5 + Math.max(0, t - E.reelOut - 0.5) * 2.4);
      rrect(-w / 2, -h / 2, w, h, rr, C.INK);
      if (k > 0.6) withAlpha(seg(k, 0.6, 1), () => {
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; circle(Math.cos(a) * 72, Math.sin(a) * 72, 30, C.RED); }
        circle(0, 0, 18, C.CR);
      });
    });
    text('MP4 · H.264 · 57.000 s', CX, cy + 190, { ...lab(C.INK, 20), align: 'center' });
    burst(t, E.reelOut, { n: 40, x: CX, y: 640, spd: [300, 900], life: 0.7, size: 12, colors: [C.CR, C.INK], shape: 'line', seed: 70 });
    // waveform zips into the reel
    const zk = seg(t, E.audioZap - 0.4, E.audioZap);
    if (zk > 0) {
      const fade = 1 - seg(t, E.audioZap + 0.2, E.audioZap + 0.6);
      withAlpha(fade, () => {
        c.strokeStyle = C.CR; c.lineWidth = 4; c.beginPath();
        const x1 = lerp(0, CX - 130, expoOut(zk));
        for (let x = 0; x <= x1; x += 6) {
          const f = x / (CX - 130);
          const y = cy + Math.sin(x * 0.045 - t * 30) * 90 * (1 - f) * (0.6 + 0.4 * Math.sin(x * 0.011));
          x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
      });
    }
    if (zap) typed('+ AUDIO · AAC 48 kHz', CX - 140, cy - 200, t, E.audioZap + 0.05, 50, lab(C.INK, 20));
  }
}

// ---------------------------------------------------------------- 7. GIT PUSH
function sPush(t) {
  const cd = E.countdown;
  if (t < cd[0]) {
    bg(C.K);
    typed('$ git push origin main', CX - 300, CY, t, 38.85, 40, lab(C.CR, 36));
    hero(CX, 820, 40, { t, look: 0, lookY: -1 });
    return;
  }
  if (t < E.ignite) {
    const idx = cd.filter(x => t >= x).length - 1;
    const scheme = [[C.K, C.CR], [C.CR, C.INK], [C.RED, C.INK]];
    if (idx > 0) bg(scheme[idx - 1][0]); else bg(C.K);
    const wk = expoOut(seg(t, cd[idx], cd[idx] + 0.16));
    rect(0, 0, OW * wk, OH, scheme[idx][0]);
    if (idx > 0 && wk < 1) {
      // old digit exiting
      push(() => { c.beginPath(); c.rect(OW * wk, 0, OW, OH); c.clip(); text(String(3 - idx + 1), CX, 810, { fam: 'disp', w: 900, size: 820, color: scheme[idx - 1][1], align: 'center' }); });
    }
    const d = t - cd[idx];
    const sc = 1 + 0.25 * (1 - expoOut(clamp(d / 0.4))) + 0.03 * d;
    push(() => {
      c.beginPath(); c.rect(0, 0, OW * wk, OH); c.clip();
      c.translate(CX, CY); c.scale(sc, sc); c.translate(-CX, -CY);
      text(String(3 - idx), CX, 810, { fam: 'disp', w: 900, size: 820, color: scheme[idx][1], align: 'center' });
    });
    text('T-MINUS', 150, 230, lab(scheme[idx][1], 20));
    text(`00:00:0${3 - idx}`, 150, 262, lab(scheme[idx][1], 20));
    return;
  }
  bg(C.K);
  const fly = Math.max(0, t - E.liftoff);
  const heroWorldY = 820 - (420 * fly * fly * fly + 260 * fly * fly);
  const cam = Math.max(0, (820 - heroWorldY) - 360);
  // speed lines
  const sp = clamp(fly / 1.2);
  for (let i = 0; i < 40; i++) {
    if (rnd(i * 7) > sp) continue;
    const x = rnd(i * 13) * OW, len = 80 + rnd(i * 3) * 300 * sp;
    const y = ((t * (1800 + rnd(i) * 1600) + rnd(i * 5) * 3000) % (OH + len * 2)) - len;
    rect(x, y, 2, len, 'rgba(236,231,221,0.35)');
  }
  // terminal (world space)
  push(() => {
    c.translate(0, cam);
    const lines = ['$ git push origin main', 'Enumerating objects: 1248, done.', 'Writing objects: 100% (1248/1248), 32.4 MiB', 'To github.com:feizon/cloud-shift.git', '   main -> main'];
    lines.forEach((l, i) => typed(l, CX - 430, 300 + i * 44, t, E.ignite + 0.05 + i * 0.16, 70, lab(i === 0 ? C.CR : C.GREY, 26)));
    lineS(CX - 600, 880, CX + 600, 880, C.DIMK, 1.5);
  });
  // sphere = origin
  const form = seg(t, 43.8, 44.9), ex = expoOut(seg(t, E.rocketHit, E.rocketHit + 1.2));
  if (form > 0) {
    sphere(CX, 330, { R: 240, rotY: t * 0.9, rotX: 0.35, form, explode: ex, ring: form * (1 - ex) * 0.9 });
    withAlpha(form * (1 - ex), () => {
      ['PARTICLES  2,400', 'STATE      ORIGIN', 'REMOTE     github'].forEach((s, i) => text(s, 1380, 260 + i * 30, lab(i === 1 ? C.RED : C.MUTE, 16)));
    });
  }
  // hero rocket
  let hy = heroWorldY + cam, hx = CX;
  if (t > 44.4) hy = lerp(hy, 330, expoIn(seg(t, 44.4, E.rocketHit)));
  if (t < E.liftoff) hx += (rnd(Math.floor(t * 60)) - 0.5) * 8 * seg(t, E.ignite, E.liftoff);
  if (t < E.rocketHit) {
    // flame
    stream(t, E.ignite, E.rocketHit, 140, 0.5, (age, bt, j) => {
      const by = (bt < E.liftoff ? 820 : 820 - (420 * Math.pow(bt - E.liftoff, 3) + 260 * Math.pow(bt - E.liftoff, 2))) + cam;
      const x = hx + (rnd(j) - 0.5) * (20 + age * 160), y = by + 40 + age * (500 + rnd(j + 1) * 400);
      withAlpha(1 - age / 0.5, () => circle(x, y, (1 - age / 0.5) * 12 + 2, rnd(j + 2) < 0.6 ? C.RED : C.CR));
    });
    if (fly > 0) withAlpha(0.6, () => rect(hx - 4, hy, 8, Math.min(900, 120 + fly * 500), C.RED));
    const st = fly > 0 ? 1 + Math.min(0.6, fly * 0.5) : 1;
    hero(hx, hy, 40, { t, sx: 1 / Math.sqrt(st), sy: st, face: fly > 0 ? 'happy' : 'strain', lookY: -1 });
  }
}

// ---------------------------------------------------------------- 8. SIGNATURE / CLOCK OUT
function sEnd(t) {
  if (t < 49.6) {
    bg(C.K);
    const ex = expoOut(seg(t, E.rocketHit, E.rocketHit + 1.6)) + (t - E.rocketHit) * 0.05;
    sphere(CX, 330, { R: 240, rotY: t * 0.5, rotX: 0.35, form: 1, explode: ex, alpha: lerp(1, 0.35, seg(t, 45.6, 47)) });
    const fw = [[45.9, 300, 260], [46.5, 1600, 220], [47.1, 520, 160], [47.7, 1450, 380], [48.3, 960, 140], [48.8, 260, 420], [49.2, 1700, 520]];
    fw.forEach(([ft, x, y], i) => burst(t, ft, { n: 60, x, y, spd: [200, 700], life: 1.2, size: 10, grav: 300, colors: [C.RED, C.CR], shape: 'line', seed: 80 + i }));
    const x0 = 300;
    const s1 = ktext('Made in the cloud', x0, 480, { fam: 'serif', w: 400, size: 160, color: C.CR, t, t0: E.title, stagger: 0.025, track: -0.01 });
    if (t > E.title + 0.55) hero(x0 + s1.w + 46, 456, 24 * clamp(spring(t - E.title - 0.55, 2.6, 6), 0, 1.3), { t, face: 'happy', eye: C.K });
    ktext('CLAUDE CODE', x0, 630, { fam: 'disp', w: 900, size: 130, color: C.CR, t, t0: E.title + 0.25, stagger: 0.03, track: -0.04 });
    const rk = expoOut(seg(t, E.title + 0.6, E.title + 1.2));
    lineS(x0, 680, x0 + 1320 * rk, 680, 'rgba(236,231,221,0.3)', 1.5);
    if (t > E.title + 0.9) {
      text('SHORT FILM 2026', x0, 724, lab(C.CR, 16));
      text('CODE · RENDER · VOICE · MIX', x0 + 660, 724, { ...lab(C.CR, 16), align: 'center' });
      typed('EVERY FRAME, IN THE CLOUD.', x0 + 1320 - 330, 724, t, E.title + 1.0, 40, lab(C.RED, 16));
    }
    const stats = [['FILM', '57.000 s'], ['SCENES', '08'], ['FRAMES', '3,420'], ['VOICE', 'GEMINI TTS'], ['BUGS', '00']];
    stats.forEach(([k, v], i) => {
      const tt0 = E.title + 0.4 + i * 0.12;
      if (t < tt0) return;
      const col = i === 4 ? C.RED : C.MUTE;
      withAlpha(seg(t, tt0, tt0 + 0.2), () => {
        text(k, 1310, 190 + i * 28, lab(col, 15));
        text('.'.repeat(12), 1400, 190 + i * 28, lab('rgba(236,231,221,0.3)', 15));
        text(v, 1620, 190 + i * 28, { ...lab(col, 15), align: 'right' });
      });
    });
    return;
  }
  // ---- clock out
  bg(C.K);
  const dark = E.lightsOff.filter(x => t >= x).length;
  lineS(CX - 860, GY, CX + 860, GY, C.RED, 3);
  const goIn = seg(t, 53.8, 54.2), close = expoInOut(seg(t, 54.25, 54.5));
  const lamps = [dark > 0 ? 0 : 1, dark > 1 ? 0 : 1, dark > 2 ? 0 : 1];
  const inside = goIn >= 1;
  if (inside && close < 1) hero(CX, 640, 40, { t, face: 'sleepy' });
  container(CX - 380, GY - 320, 760, 320, { t, open: 1 - close, lamps, textT0: -1 });
  if (close >= 1) withAlpha(1 - seg(t, E.antennaFade, E.antennaFade + 0.6), () => circle(CX, 560, 8, C.RED));
  burst(t, 54.5, { n: 30, x: CX, y: GY, jx: 700, spd: [60, 260], ang: [Math.PI * 1.1, Math.PI * 1.9], grav: 500, life: 0.6, size: 7, colors: [C.CR], shape: 'sq', seed: 91 });
  if (!inside) {
    const waving = t > E.wave && t < E.lightsOff[0];
    const y = lerp(820, 640, goIn) - Math.sin(goIn * Math.PI) * 120 - (waving ? Math.abs(Math.sin((t - E.wave) * 7)) * 30 : 0);
    const r = lerp(76, 40, goIn);
    hero(CX, y, r, { t, face: t > E.lightsOff[0] ? 'sleepy' : 'happy', rot: waving ? Math.sin((t - E.wave) * 7) * 0.2 : 0 });
    ktext('bye~', CX + 120, 800, { fam: 'serif', w: 400, size: 96, color: C.CR, t, t0: E.wave + 0.05, stagger: 0.05, track: 0, out: E.lightsOff[0] - 0.1 });
  }
  if (inside) stream(t, 54.6, 57, 1.6, 2.2, (age, bt, j) => withAlpha(1 - age / 2.2, () => text('z', CX + 40 + age * 60, 330 - age * 80, { fam: 'serif', size: 40 + (j % 2) * 20, color: C.CR })));
  withAlpha(dark * 0.16, () => bg('#000'));
  if (t > E.endCard) {
    const k = seg(t, E.endCard, E.endCard + 0.4);
    withAlpha(k, () => {
      bg(C.K);
      const shrink = 1 - expoIn(seg(t, 56.2, 56.8));
      ringS(CX, CY, 290 * expoOut(seg(t, E.endCard, E.endCard + 1)) * shrink, 'rgba(255,61,31,0.45)', 1.5);
      hero(CX, CY, 22 * shrink, { t, face: 'sleepy', eye: C.K });
      text('(z) END', CX + 60, CY - 44, lab(C.CR));
      text('CLAUDE CODE / CLOUD SHIFT', CX, CY + 380, { ...lab(C.GREY, 16), align: 'center' });
    });
  }
}

const SCENE_FN = { boot: sBoot, wake: sWake, clone: sClone, code: sCode, camera: sCamera, ffmpeg: sFF, push: sPush, end: sEnd };

// Foreground colour scheme for HUD/subtitles at time t.
function themeAt(t) {
  if (t < E.bubbleIn) return 'dark';
  if (t < 13.35) return 'red';
  if (t < 19.25) return 'light';
  if (t < 25.62) return 'dark';
  if (t < 32.55) return 'light';
  if (t < 38.8) return 'red';
  const cd = E.countdown;
  if (t < cd[1]) return 'dark';
  if (t < cd[2]) return 'light';
  if (t < E.ignite) return 'red';
  return 'dark';
}
Object.assign(window, { SCENE_FN, themeAt });
