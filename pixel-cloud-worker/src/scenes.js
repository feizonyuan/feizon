'use strict';
// Eight scenes of "Claude Code: Cloud Shift". Each draw(t) paints the 480x270 world for global time t
// and may set CAM (zoom/pan). Event times come from timeline.json via window.TL.

const E = () => window.TL.events;
const GROUND = 196;
let CAM = { x: W / 2, y: H / 2, zoom: 1 };
function resetCam() { CAM = { x: W / 2, y: H / 2, zoom: 1 }; window.CAM = CAM; }

// ---------------------------------------------------------------- 1. boot
function sceneBoot(t) {
  const e = E();
  const dawn = easeInOut(seg(t, 1.6, 3.4));
  nightSky(t, 1);
  alpha(dawn, () => daySky(t));
  // terminal lines
  const term = 1 - seg(t, 3.0, 3.6);
  if (term > 0) alpha(term, () => {
    const l1 = '> SESSION START';
    const n1 = Math.floor(seg(t, e.termType[0], e.termType[1]) * l1.length);
    text5(l1.slice(0, n1), 14, 14, P.teal3, 1);
    if (t > 1.4) {
      const l2 = '> BOOTING CONTAINER';
      text5(l2.slice(0, Math.floor(seg(t, 1.4, 2.0) * l2.length)), 14, 26, P.teal3, 1);
      const pr = seg(t, 1.6, 2.8);
      R(14, 38, 82, 6, P.teal2); R(15, 39, Math.round(80 * pr), 4, P.teal3);
      text5(Math.round(pr * 100) + '%', 100, 38, P.teal3, 1);
    }
    if (Math.floor(t * 3) % 2 === 0) R(14 + textW(l1.slice(0, n1)) + 2, 14, 5, 7, P.teal3);
  });
  // DING: ping rings
  const d = t - e.ding;
  if (d > 0 && d < 1) {
    ring(240, 120, 6 + d * 120, 2, d < 0.5 ? P.gold : P.gold2);
    if (d < 0.6) ring(240, 120, 4 + d * 70, 1, P.white);
    star4(240, 120, Math.round(8 * (1 - d)), P.gold3, P.white);
  }
  burst(t, e.ding, { n: 18, x: 240, y: 120, spd: [40, 120], life: 0.8, size: 3, colors: [P.gold, P.gold3, P.white], shape: 'star', drag: 2, seed: 3 });
  // cloud platform forms
  const grow = seg(t, e.cloudForm, e.cloudForm + 0.9);
  burst(t, e.cloudForm, { n: 30, x: 240, y: GROUND + 20, spd: [60, 200], ang: [Math.PI, Math.PI * 2], life: 0.7, size: 5, colors: [P.paper, P.sand], shape: 'disc', drag: 4, seed: 5 });
  if (grow > 0) cloudGround(GROUND, grow, t);
  // container drop
  if (t > e.containerDrop) {
    const k = seg(t, e.containerDrop, e.containerLand);
    const y = lerp(-90, GROUND, easeInCubic(k));
    const land = t - e.containerLand;
    let sx = 1, sy = 1;
    if (land > 0) { const q = Math.exp(-land * 7) * Math.cos(land * 30); sy = 1 - 0.18 * q; sx = 1 + 0.12 * q; }
    else if (k > 0.3) { sy = 1.12; sx = 0.92; }
    if (k < 1) for (let i = 0; i < 6; i++) R(178 + i * 24, y - 140 - rnd(i) * 30, 2, 40 + rnd(i + 4) * 30, P.white);
    const lamps = [t > 3.3 ? 1 : 0, t > 3.6 ? 1 : 0, t > 3.9 ? 1 : 0];
    drawSquashed(240, y, sx, sy, () => container(240, y, { lamps, windowGlow: t > 4.2 ? 0.6 + 0.4 * Math.sin(t * 6) : 0 }));
    for (let i = 0; i < 3; i++) burst(t, 3.3 + i * 0.3, { n: 10, x: 195 + i * 45, y: GROUND - 75, spd: [30, 80], life: 0.5, size: 2, colors: [P.gold, P.white], shape: 'star', drag: 3, seed: 11 + i });
    // landing dust
    burst(t, e.containerLand, { n: 40, x: 240, y: GROUND, jx: 150, spd: [40, 160], ang: [Math.PI * 1.05, Math.PI * 1.95], grav: 140, life: 0.9, size: 6, colors: [P.paper, P.sand, P.sand2], shape: 'disc', drag: 3, seed: 7 });
    burst(t, e.containerLand, { n: 16, x: 240, y: GROUND - 10, jx: 140, spd: [80, 220], ang: [Math.PI * 1.1, Math.PI * 1.9], grav: 300, life: 0.7, size: 2, colors: [P.gold, P.clay3], seed: 8 });
  }
  // floating code glyphs
  if (t > 4.0) {
    const glyphs = ['{', '}', '<', '>', '/', '#', '*', '+'];
    for (let i = 0; i < 10; i++) {
      const a = seg(t, 4.0 + i * 0.12, 4.4 + i * 0.12);
      if (a <= 0) continue;
      const x = 40 + rnd(i) * 400, y = 60 + rnd(i + 9) * 70 + Math.sin(t * 2 + i) * 4;
      if (x > 150 && x < 330) continue;
      text5(glyphs[i % glyphs.length], x, y, i % 2 ? P.clay : P.teal, 2, { shadow: P.sand2 });
    }
  }
  CAM.zoom = 1 + 0.06 * easeInOut(seg(t, 3.2, 6.4));
  CAM.y = H / 2 + 8 * easeInOut(seg(t, 3.2, 6.4));
}

function drawSquashed(ax, ay, sx, sy, fn) {
  g.save(); g.translate(ax, ay); g.scale(sx, sy); g.translate(-ax, -ay); fn(); g.restore();
}

// ---------------------------------------------------------------- 2. wake
function sceneWake(t) {
  const e = E();
  daySky(t);
  cloudGround(GROUND, 1, t);
  const open = easeOutBounce(seg(t, e.doorOpen, e.doorOpen + 0.5));
  const lamps = [1, 1, 1];
  // robot timeline
  const hopK = seg(t, e.hop, e.hopLand);
  const inDoor = t < e.hop;
  const eyesOn = t < e.eyesOn ? 0 : (t < e.eyesOn + 0.35 ? (Math.floor(t * 25) % 2) : 1);
  let face = 'normal', pose = 'idle';
  if (t > e.bubbleIn + 0.4) face = 'focus';
  if (t > e.exclaim) face = 'surprise';
  if (t > e.salute) { face = 'happy'; pose = 'salute'; }
  const robotOpts = { t, eyes: eyesOn, spark: t < e.eyesOn ? 0 : clamp((t - e.eyesOn) * 3), face, pose, look: t > e.bubbleIn + 0.4 && t < e.exclaim ? -1 : 0 };

  container(240, GROUND, {
    open, lamps,
    interior: (dx, dy, dw, dh) => { if (inDoor) robot(240, dy + dh - 1, { ...robotOpts, shadow: false }); },
  });
  // steam on door open
  burst(t, e.doorOpen, { n: 24, x: 240, y: GROUND - 60, jx: 40, spd: [20, 60], ang: [Math.PI * 1.2, Math.PI * 1.8], life: 1.2, size: 6, colors: [P.white, P.cream], shape: 'disc', drag: 1.5, seed: 21 });
  // power-up burst
  burst(t, e.eyesOn + 0.3, { n: 14, x: 240, y: GROUND - 52, spd: [40, 100], life: 0.6, size: 3, colors: [P.gold, P.white], shape: 'star', drag: 3, seed: 22 });

  if (!inDoor) {
    const x = 240, y0 = GROUND - 1, y1 = 216;
    let y = lerp(y0, y1, hopK) - Math.sin(hopK * Math.PI) * 36;
    const land = t - e.hopLand;
    let sx = 1, sy = 1;
    if (hopK < 1) { sy = 1.15; sx = 0.88; }
    else if (land < 0.4) { const q = Math.exp(-land * 9) * Math.cos(land * 35); sy = 1 - 0.25 * q; sx = 1 + 0.2 * q; }
    // jump on exclaim
    const ex = t - e.exclaim;
    if (ex > 0 && ex < 0.35) y -= Math.sin((ex / 0.35) * Math.PI) * 12;
    const sal = t - e.salute;
    if (sal > 0 && sal < 0.3) y -= Math.sin((sal / 0.3) * Math.PI) * 8;
    robot(x, y, { ...robotOpts, sx, sy, scale: lerp(0.95, 1.15, hopK) });
    burst(t, e.hopLand, { n: 20, x, y: y1, jx: 30, spd: [30, 90], ang: [Math.PI * 1.05, Math.PI * 1.95], grav: 100, life: 0.6, size: 4, colors: [P.paper, P.sand], shape: 'disc', drag: 3, seed: 23 });
    // exclaim mark
    if (ex > 0 && t < e.salute) {
      const k = pop(t, e.exclaim, 0.25);
      const s = Math.max(1, Math.round(4 * k));
      text5('!', x + 22, y - 74 - Math.sin(t * 12) * 2, P.gold, s, { outline: P.ink });
      burst(t, e.exclaim, { n: 12, x: x + 26, y: y - 64, spd: [40, 90], life: 0.5, size: 2, colors: [P.gold, P.white], drag: 3, seed: 24 });
    }
    // salute: OK! + sparkle
    if (sal > 0) {
      const k = pop(t, e.salute, 0.3);
      const s = Math.max(1, Math.round(3 * k));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        line(x + 58 + Math.cos(a) * 18 * k, y - 58 + Math.sin(a) * 12 * k, x + 58 + Math.cos(a) * 26 * k, y - 58 + Math.sin(a) * 18 * k, P.gold, 2);
      }
      text5('OK!', x + 58, y - 68, P.paper, s, { align: 'center', outline: P.clay2 });
      burst(t, e.salute, { n: 30, x, y: y - 70, spd: [60, 160], life: 0.9, size: 3, colors: CONFETTI, shape: 'star', drag: 2.5, grav: 60, seed: 25 });
    }
  }
  // chat bubble from the user
  if (t > e.bubbleIn) {
    const k = easeOutBack(seg(t, e.bubbleIn, e.bubbleIn + 0.45));
    const bx = Math.round(lerp(-200, 44, k)), by = 40;
    const bw = 196, bh = 58;
    const wob = t < e.exclaim ? 0 : Math.round(Math.sin((t - e.exclaim) * 30) * Math.exp(-(t - e.exclaim) * 6) * 3);
    R(bx - 1 + wob, by - 1, bw + 2, bh + 2, P.ink);
    R(bx + wob, by, bw, bh, P.paper);
    R(bx + wob, by + bh - 4, bw, 4, P.sand);
    // tail toward robot
    for (let i = 0; i < 10; i++) R(bx + bw - 40 + i * 2 + wob, by + bh + i, 10 - i, 1, P.ink);
    for (let i = 0; i < 8; i++) R(bx + bw - 39 + i * 2 + wob, by + bh + i - 1, 8 - i, 1, P.paper);
    // header
    R(bx + 6 + wob, by + 6, 52, 11, P.clay);
    text5('NEW TASK', bx + 8 + wob, by + 8, P.paper, 1);
    disc(bx + bw - 14 + wob, by + 11, 5, P.teal2); disc(bx + bw - 14 + wob, by + 10, 2, P.teal3);
    const msg = '帮我做个像素风视频！';
    const n = Math.floor(seg(t, e.bubbleIn + 0.4, e.bubbleIn + 1.4) * msg.length);
    if (n > 0) ptext(msg.slice(0, n), bx + 8 + wob, by + 32, 16, P.ink);
    const en = 'MAKE ME A PIXEL VIDEO!';
    const m = Math.floor(seg(t, e.bubbleIn + 1.0, e.bubbleIn + 1.8) * en.length);
    text5(en.slice(0, m), bx + 8 + wob, by + 44, P.sand3, 1);
  }
  CAM.zoom = 1.06 + 0.06 * easeOutCubic(seg(t, 6.4, 8.5));
  CAM.y = H / 2 + 8 + 10 * easeOutCubic(seg(t, 6.4, 8.5));
  const pulse = t > e.salute ? Math.exp(-(t - e.salute) * 5) * 0.06 : 0;
  CAM.zoom += pulse;
}

// ---------------------------------------------------------------- 3. git clone
function sceneClone(t) {
  const e = E();
  daySky(t, [P.sky1, P.sky2, P.sky3, P.sky4]);
  // repo cloud (top right)
  const rcx = 372, rcy = 44;
  cloudBlob(rcx, rcy, 120, 40, P.steel3, P.steel, P.ink, 3);
  R(rcx - 30, rcy - 14, 60, 15, P.ink); R(rcx - 29, rcy - 13, 58, 13, P.ink2);
  text5('REPO', rcx + 6, rcy - 10, P.paper, 1, { align: 'center' });
  // git branch icon
  disc(rcx - 22, rcy - 11, 2, P.clay); disc(rcx - 22, rcy - 3, 2, P.clay); disc(rcx - 15, rcy - 7, 2, P.teal);
  line(rcx - 22, rcy - 11, rcx - 22, rcy - 3, P.clay, 1); line(rcx - 22, rcy - 6, rcx - 15, rcy - 7, P.teal, 1);
  cloudGround(GROUND + 18, 1, t);

  // pipe extends down
  const px0 = 360, py0 = rcy + 14;
  const pk = easeOutBounce(seg(t, e.pipeDown, e.pipeClank));
  const pyEnd = Math.round(lerp(py0, 150, pk));
  // bulge travelling down on each tug
  let bulgeY = -999, bulgeK = 0;
  for (const tg of e.tugs) { const q = seg(t, tg - 0.1, tg + 0.45); if (q > 0 && q < 1) { bulgeY = lerp(py0, pyEnd, q); bulgeK = Math.sin(q * Math.PI); } }
  const cq = seg(t, e.cratePop - 0.35, e.cratePop);
  if (cq > 0 && cq < 1) { bulgeY = lerp(py0, pyEnd, cq); bulgeK = 1.6; }
  for (let y = py0; y < pyEnd; y++) {
    const b = Math.round(Math.max(0, 1 - Math.abs(y - bulgeY) / 12) * 6 * bulgeK);
    R(px0 - 9 - b, y, 18 + b * 2, 1, P.ink);
    R(px0 - 8 - b, y, 16 + b * 2, 1, P.teal2);
    R(px0 - 5 - b, y, 4, 1, P.teal);
    R(px0 - 4 - b, y, 1, 1, P.teal3);
  }
  for (let y = py0 + 20; y < pyEnd - 8; y += 26) { R(px0 - 11, y, 22, 5, P.ink); R(px0 - 10, y + 1, 20, 3, P.steel); }
  // mouth flange
  R(px0 - 13, pyEnd - 2, 26, 8, P.ink); R(px0 - 12, pyEnd - 1, 24, 6, P.steel); R(px0 - 12, pyEnd - 1, 24, 2, P.steel3);
  R(px0 - 8, pyEnd + 4, 16, 2, P.night1);
  burst(t, e.pipeClank, { n: 14, x: px0, y: pyEnd + 4, spd: [60, 140], ang: [0, Math.PI], grav: 300, life: 0.5, size: 2, colors: [P.gold, P.white], seed: 31 });
  if (t > e.pipeClank && t < e.pipeClank + 0.5) bangText('CLANK!', px0 - 60, pyEnd - 10, t, e.pipeClank, 0.5, 2, P.paper, 2);

  // robot pulls
  const crateOut = t > e.cratePop;
  let lean = 0, rx = 290, slide = 0;
  for (const tg of e.tugs) {
    const q = t - tg;
    if (q > 0 && q < 0.5) lean = Math.max(lean, Math.sin(clamp(q / 0.5) * Math.PI));
    if (q > 0) slide += 3 * easeOutCubic(clamp(q / 0.25));
  }
  rx -= slide;
  const fallBack = t > e.cratePop ? easeOutCubic(seg(t, e.cratePop, e.cratePop + 0.3)) * (1 - seg(t, e.cratePop + 0.5, e.cratePop + 0.9)) : 0;
  const ry = 216;
  let pose = t > e.tugs[0] - 0.3 && !crateOut ? 'pull' : 'idle';
  let face = pose === 'pull' ? (lean > 0.2 ? 'strain' : 'focus') : 'normal';
  if (crateOut) face = 'surprise';
  if (t > e.crateBurst) { pose = 'cheer'; face = 'happy'; }
  const hand = [rx + 18, ry - 24];
  if (!crateOut && t > e.pipeClank) {
    // rope
    const sag = (1 - lean) * 6;
    let lx = px0, ly = pyEnd + 5;
    for (let i = 1; i <= 12; i++) {
      const f = i / 12;
      const x = lerp(px0, hand[0] - lean * 4, f), y = lerp(pyEnd + 5, hand[1], f) + Math.sin(f * Math.PI) * sag;
      line(lx, ly, x, y, P.ink, 3); line(lx, ly, x, y, P.gold2, 1);
      lx = x; ly = y;
    }
  }
  const tugSquash = lean * 0.12;
  robot(rx - fallBack * 14, ry, { t, pose, face, lean: -lean * 5 - fallBack * 4, sx: 1 + tugSquash, sy: 1 - tugSquash, scale: 1.1 });
  // sweat drops
  for (const tg of e.tugs) burst(t, tg, { n: 5, x: rx - 4, y: ry - 66, spd: [40, 70], ang: [Math.PI * 1.1, Math.PI * 1.6], grav: 250, life: 0.5, size: 2, colors: [P.teal3, P.white], seed: 33 + tg });
  const words = ['HEAVE!', 'HO!', 'HEAVE!!'];
  e.tugs.forEach((tg, i) => bangText(words[i], rx - 40 + i * 6, ry - 92 - i * 4, t, tg, 0.55, 2, P.paper, i + 4));

  // crate
  if (crateOut) {
    const k = seg(t, e.cratePop, e.cratePop + 0.45);
    const cx = lerp(px0, 340, k), cy = lerp(pyEnd + 10, 216, easeInQuad(k)) - Math.sin(k * Math.PI) * 40;
    const land = t - (e.cratePop + 0.45);
    let sq = 0;
    if (land > 0) sq = Math.exp(-land * 8) * Math.cos(land * 32) * 0.2;
    const burstT = t - e.crateBurst;
    drawSquashed(cx, cy, 1 + sq, 1 - sq, () => {
      R(cx - 19, cy - 30, 38, 30, P.ink);
      R(cx - 18, cy - 29, 36, 28, P.clay2);
      for (let i = 0; i < 4; i++) R(cx - 18, cy - 26 + i * 7, 36, 1, P.clay4);
      R(cx - 18, cy - 29, 3, 28, P.clay); R(cx + 15, cy - 29, 3, 28, P.clay);
      R(cx - 12, cy - 21, 24, 11, P.ink); R(cx - 11, cy - 20, 22, 9, P.paper);
      text5('GIT', cx, cy - 19, P.clay2, 1, { align: 'center' });
      if (burstT < 0) { R(cx - 21, cy - 33, 42, 5, P.ink); R(cx - 20, cy - 32, 40, 3, P.clay); }
    });
    burst(t, e.cratePop + 0.45, { n: 26, x: cx, y: 216, jx: 40, spd: [30, 110], ang: [Math.PI * 1.05, Math.PI * 1.95], grav: 120, life: 0.7, size: 5, colors: [P.paper, P.sand], shape: 'disc', drag: 3, seed: 35 });
    if (burstT > 0) {
      // lid flies off spinning
      const lk = burstT;
      g.save(); g.translate(Math.round(cx + lk * 90), Math.round(cy - 33 - lk * 160 + lk * lk * 260)); g.rotate(lk * 9);
      R(-21, -3, 42, 5, P.ink); R(-20, -2, 40, 3, P.clay); g.restore();
      // files erupt
      burst(t, e.crateBurst, {
        n: 34, x: cx, y: cy - 30, spd: [120, 260], ang: [Math.PI * 1.2, Math.PI * 1.8], grav: 260, drag: 1.2, life: 1.8, size: 1, shrink: 0, colors: CONFETTI, seed: 36,
        draw: (x, y, s, col, lt, i) => { R(x - 4, y - 5, 9, 11, P.ink); R(x - 3, y - 4, 7, 9, P.paper); R(x + 1, y - 4, 3, 3, P.sand2); R(x - 2, y - 1, 5, 1, col); R(x - 2, y + 1, 4, 1, col); R(x - 2, y + 3, 5, 1, P.sand2); },
      });
      burst(t, e.crateBurst, { n: 30, x: cx, y: cy - 30, spd: [60, 200], life: 1, size: 3, colors: [P.gold, P.white, P.gold3], shape: 'star', drag: 2.5, seed: 37 });
      const bk = pop(t, e.crateBurst + 0.3, 0.4);
      if (bk > 0) {
        const s = Math.max(1, Math.round(3 * bk));
        text5('REPO ACQUIRED!', 240, 92 + Math.sin(t * 8) * 2, P.gold, s, { align: 'center', outline: P.ink });
      }
    }
  }
  CAM.zoom = 1.04;
  const pk2 = t > e.cratePop ? Math.exp(-(t - e.cratePop) * 4) * 0.05 : 0;
  CAM.zoom += pk2;
}

// ---------------------------------------------------------------- 4. coding
function sceneCode(t) {
  const e = E();
  daySky(t, [P.sky1, P.sky2, P.sky3, P.sky4]);
  cloudGround(GROUND + 22, 1, t);
  // desk
  R(118, 190, 300, 8, P.ink); R(119, 191, 298, 6, P.clay2); R(119, 191, 298, 2, P.clay);
  R(130, 198, 8, 40, P.ink); R(398, 198, 8, 40, P.ink);
  // monitor
  const mx = 262, my = 70, mw = 132, mh = 104;
  const glow = 0.4 + 0.2 * Math.sin(t * 20);
  alpha(0.25, () => disc(mx + mw / 2, my + mh / 2, 90, P.teal3));
  R(mx - 2, my - 2, mw + 4, mh + 4, P.ink);
  R(mx, my, mw, mh, P.sand); R(mx, my, mw, 3, P.cream); R(mx + mw - 6, my, 6, mh, P.sand2);
  R(mx + mw / 2 - 12, my + mh + 2, 24, 8, P.ink); R(mx + mw / 2 - 20, my + mh + 8, 40, 4, P.ink);
  const sx = mx + 8, sy = my + 8, sw = mw - 20, sh = mh - 24;
  R(sx - 1, sy - 1, sw + 2, sh + 2, P.ink); R(sx, sy, sw, sh, P.night1);
  R(mx + 10, my + mh - 12, 6, 4, Math.sin(t * 7) > 0 ? P.green : P.teal2);
  g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip();
  if (t < e.miniRobot) {
    const speed = 30 + 120 * seg(t, e.typing[0], e.miniRobot);
    const scroll = (t - e.typing[0]) * speed;
    const lineH = 6, first = Math.floor(scroll / lineH);
    const cols = [P.clay, P.teal, P.gold, P.paper, P.purple, P.clay3, P.green];
    for (let i = first; i < first + Math.ceil(sh / lineH) + 2; i++) {
      const y = sy + sh - 6 - (scroll - i * lineH) * -1 - first * 0;
      const yy = sy + (i * lineH - scroll) + sh * 0.2;
      if (yy < sy - 6 || yy > sy + sh) continue;
      const ind = Math.floor(rnd(i * 3) * 4) * 6;
      let x = sx + 4 + ind;
      text5(String((i % 99) + 1).padStart(2, '0'), sx + 2, yy, P.ink3, 1);
      x += 14;
      const parts = 1 + Math.floor(rnd(i * 7) * 4);
      for (let p = 0; p < parts; p++) {
        const w = 6 + Math.floor(rnd(i * 11 + p) * 26);
        if (x + w > sx + sw - 2) break;
        R(x, yy + 1, w, 4, cols[Math.floor(rnd(i * 5 + p) * cols.length)]);
        x += w + 4;
      }
    }
    // cursor
    if (Math.floor(t * 8) % 2) R(sx + 20 + (Math.floor(t * 30) % 60), sy + sh * 0.2 + 2, 4, 6, P.paper);
  } else {
    // mini robot appears inside the screen (recursion gag)
    const k = seg(t, e.miniRobot, e.miniRobot + 0.3);
    ditherGradient(sy, sy + sh, [P.sky1, P.sky3]);
    alpha(1, () => R(sx, sy + sh - 14, sw, 14, P.paper));
    robot(sx + sw / 2, sy + sh - 6, { t, pose: 'wave', face: 'happy', scale: 0.7 * easeOutBack(k), shadow: false });
    text5('HELLO!', sx + sw / 2, sy + 6, P.clay2, 1, { align: 'center' });
    // scanline wipe
    if (k < 1) R(sx, sy + sh * k, sw, sh * (1 - k), P.night1);
    R(sx, sy + sh * k - 2, sw, 2, P.white);
  }
  // CRT lines
  for (let y = sy; y < sy + sh; y += 2) alpha(0.12, () => R(sx, y, sw, 1, P.ink));
  g.restore();
  burst(t, e.miniRobot, { n: 24, x: sx + sw / 2, y: sy + sh / 2, spd: [60, 160], life: 0.7, size: 3, colors: [P.gold, P.white, P.teal3], shape: 'star', drag: 2, seed: 41 });

  // robot + keyboard
  const typing = t > e.typing[0] - 0.2 && t < e.typing[1];
  const rx = 196, ry = 214;
  const bounce = typing ? Math.round(Math.abs(Math.sin(t * 20))) : 0;
  const face = t > e.miniRobot && t < e.miniRobot + 1.2 ? 'surprise' : typing ? 'focus' : 'happy';
  robot(rx, ry - bounce, { t, pose: typing ? 'type' : 'cheer', face, look: 1, scale: 1.1, shadow: false });
  // keyboard
  const kx = 160, ky = 182;
  R(kx - 1, ky - 1, 74, 14, P.ink); R(kx, ky, 72, 12, P.steel3); R(kx, ky + 10, 72, 2, P.steel);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 11; c++) {
    const on = typing && rnd(c * 13 + r * 7 + Math.floor(t * 24) * 3) > 0.8;
    R(kx + 2 + c * 6 + (r % 2), ky + 1 + r * 3, 5, 2, on ? P.gold : P.paper);
  }
  // steam from overheating
  stream(t, e.sparks[4], e.typing[1] + 0.6, 6, 1.2, (age, bt, j) => {
    smokePuff(rx - 10 + rnd(j) * 20 + age * 8, ry - 70 - age * 30, 3 + age * 5, P.white, 1 - age / 1.2);
  });
  // rising bits from keyboard
  if (typing) stream(t, e.typing[0], e.typing[1], 14, 1.4, (age, bt, j) => {
    const chars = ['0', '1', '{', '}', '<', '>', ';', '='];
    const x = kx + 10 + rnd(j) * 60 + Math.sin(age * 6 + j) * 4;
    const y = ky - 6 - age * 60;
    text5(chars[j % chars.length], x, y, [P.clay, P.teal, P.gold2, P.purple][j % 4], 1);
  });
  // sparks
  e.sparks.forEach((st, i) => {
    burst(t, st, { n: 22, x: kx + 20 + (i * 17) % 40, y: ky, spd: [80, 200], ang: [Math.PI * 1.05, Math.PI * 1.95], grav: 400, life: 0.5, size: 2, colors: [P.gold, P.gold3, P.white, P.clay3], seed: 42 + i });
    const d = t - st;
    if (d > 0 && d < 0.1) alpha(0.6, () => disc(kx + 20 + (i * 17) % 40, ky, 14, P.gold3));
  });
  // WPM meter
  const wpm = Math.floor(lerp(60, 9999, easeInCubic(seg(t, e.typing[0], e.typing[1]))));
  R(10, 10, 92, 15, P.ink); R(11, 11, 90, 13, P.ink2);
  text5('WPM ' + String(wpm).padStart(4, '0'), 16, 14, wpm > 5000 ? P.clay3 : P.gold, 1);
  const bar = seg(t, e.typing[0], e.typing[1]);
  R(10, 27, 92, 4, P.ink); R(11, 28, Math.round(90 * bar), 2, bar > 0.7 ? P.red : P.gold);
  if (wpm > 8000) bangText('ON FIRE!', 56, 50, t, 23.9, 0.8, 2, P.gold, 9);

  // zoom into the monitor
  const z = easeInCubic(seg(t, e.zoomIn, 25.6));
  CAM.x = lerp(W / 2, sx + sw / 2, z);
  CAM.y = lerp(H / 2, sy + sh / 2, z);
  CAM.zoom = lerp(1.02, 5, z);
}

// ---------------------------------------------------------------- 5. headless camera
function sceneCamera(t) {
  const e = E();
  daySky(t, [P.sky2, P.sky3, P.sky4, P.clay3]);
  const snapping = t > e.snaps[0] - 0.1 && t < e.snaps[e.snaps.length - 1] + 0.3;
  if (snapping) speedLines(t, 0.8, 140, 160, P.white);
  cloudGround(GROUND + 22, 1, t);
  // backdrop & spotlight
  R(52, 70, 176, 148, P.ink); R(54, 72, 172, 144, P.cream);
  for (let i = 0; i < 172; i += 12) R(54 + i, 72, 6, 144, P.sand);
  R(54, 72, 172, 6, P.clay); R(54, 78, 172, 2, P.clay2);
  text5('STUDIO', 140, 84, P.clay2, 1, { align: 'center' });
  alpha(0.35, () => { for (let y = 0; y < 140; y++) R(140 - y * 0.5, 76 + y, y + 1, 1, P.gold3); });

  // robot posing; each snap a new pose
  let si = -1;
  for (let i = 0; i < e.snaps.length; i++) if (t >= e.snaps[i]) si = i;
  const poses = ['salute', 'cheer', 'pose1', 'point', 'pose2', 'wave', 'cheer', 'pointL', 'salute', 'pose1', 'cheer', 'pose2', 'wave', 'cheer'];
  const faces = ['happy', 'surprise', 'happy', 'focus', 'happy', 'happy', 'surprise', 'happy', 'happy', 'focus', 'happy', 'surprise', 'happy', 'happy'];
  const pose = si >= 0 ? poses[si % poses.length] : 'idle';
  const face = si >= 0 ? faces[si % faces.length] : (t > e.camWalk[1] ? 'surprise' : 'normal');
  const hop = si >= 0 ? Math.round(Math.sin(clamp((t - e.snaps[si]) / 0.18) * Math.PI) * 5) : 0;
  robot(140, 214 - hop, { t, pose, face, flip: si % 2 === 1, scale: 1.25 });

  // headless camera walks in
  const wk = easeOutCubic(seg(t, e.camWalk[0], e.camWalk[1]));
  const cx = Math.round(lerp(540, 330, wk)), cyb = 214;
  const walking = t > e.camWalk[0] && t < e.camWalk[1];
  const step = walking ? Math.round(Math.abs(Math.sin(t * 18)) * 3) : 0;
  // legs
  const la = walking ? Math.sin(t * 18) * 5 : 0;
  line(cx - 12, cyb - 22, cx - 16 + la, cyb, P.ink, 3);
  line(cx + 12, cyb - 22, cx + 16 - la, cyb, P.ink, 3);
  R(cx - 21 + la, cyb - 2, 9, 3, P.ink); R(cx + 12 - la, cyb - 2, 9, 3, P.ink);
  const by = cyb - 52 - step;
  // body
  R(cx - 29, by - 1, 66, 34, P.ink);
  R(cx - 28, by, 64, 32, P.ink2);
  R(cx - 28, by, 64, 3, P.ink3);
  for (let i = 0; i < 64; i += 4) R(cx - 28 + i, by + 22, 2, 8, P.ink);
  text5('HEADLESS', cx + 10, by + 7, P.sand2, 1, { align: 'center' });
  // lens (pointing left at the robot)
  disc(cx - 30, by + 18, 12, P.ink); disc(cx - 30, by + 18, 10, P.steel2); disc(cx - 30, by + 18, 7, P.ink);
  disc(cx - 30, by + 18, 4, P.blue); px(cx - 33, by + 15, P.white); px(cx - 32, by + 15, P.white);
  // flash unit
  let flashOn = 0;
  for (const s of e.snaps) { const d = t - s; if (d >= 0 && d < 0.09) flashOn = 1; }
  R(cx - 22, by - 9, 16, 9, P.ink); R(cx - 21, by - 8, 14, 7, flashOn ? P.white : P.sand);
  if (flashOn) { alpha(0.5, () => disc(cx - 14, by - 4, 22, P.white)); spark(cx - 14, by - 4, 14, P.gold3, t * 4, 8); }
  // neck stump with spring and floating "?"
  const boing = t > e.camWalk[1] ? Math.sin((t - e.camWalk[1]) * 18) * Math.exp(-(t - e.camWalk[1]) * 3) * 8 : 0;
  const nx = cx + 12, ny = by;
  R(nx - 4, ny - 4, 8, 4, P.ink); R(nx - 3, ny - 3, 6, 3, P.steel);
  const top = ny - 18 - boing;
  for (let i = 0; i < 5; i++) { const yy = lerp(ny - 4, top, i / 5); line(nx - 4, yy, nx + 4, yy - 2, P.steel3, 1); }
  disc(nx, top, 2, P.steel3);
  if (t > e.camWalk[1] + 0.2) {
    const qk = pop(t, e.camWalk[1] + 0.2, 0.3);
    text5('?', nx + 2, top - 22 + Math.sin(t * 4) * 2, P.clay, Math.max(1, Math.round(3 * qk)), { align: 'center', outline: P.ink });
  }
  if (walking) for (let i = 0; i < 4; i++) burst(t, e.camWalk[0] + i * 0.28, { n: 6, x: cx + 14, y: cyb, spd: [20, 50], ang: [Math.PI * 1.1, Math.PI * 1.6], life: 0.4, size: 4, colors: [P.paper, P.sand], shape: 'disc', drag: 3, seed: 51 + i });

  // ejected photos fly to the stack
  const stackX = 420, stackBase = 214;
  let stacked = 0;
  e.snaps.forEach((s, i) => {
    const d = t - s;
    if (d < 0) return;
    const fly = clamp(d / 0.45);
    if (fly >= 1) { stacked++; return; }
    const x = lerp(cx - 2, stackX, easeOutCubic(fly));
    const y = lerp(by - 8, stackBase - 14 - stacked * 3, fly) - Math.sin(fly * Math.PI) * 50;
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate((1 - fly) * 6);
    photo(-7, -5, 14, 11, i); g.restore();
  });
  for (let i = 0; i < stacked; i++) photo(stackX - 7 + ((i * 3) % 4) - 2, stackBase - 12 - i * 3, 14, 11, i);
  if (stacked > 0) { R(stackX - 12, stackBase, 24, 3, P.ink); }

  // frame counter
  const fc = Math.floor(1710 * easeInQuad(seg(t, e.snaps[0], e.snaps[e.snaps.length - 1] + 0.3)));
  R(352, 10, 118, 15, P.ink); R(353, 11, 116, 13, P.ink2);
  disc(361, 17, 3, Math.floor(t * 4) % 2 ? P.red : P.red2);
  text5('FRAME ' + String(fc).padStart(4, '0'), 368, 14, P.paper, 1);
  e.snaps.forEach((s, i) => { if (i % 3 === 0) bangText(['SNAP!', 'CLICK!', 'SNAP!', 'CHEESE!', 'SNAP!'][i / 3], 250 + (i % 2) * 30, 60 + (i % 3) * 14, t, s, 0.4, 2, P.paper, i); });
  CAM.zoom = 1.02 + (snapping ? 0.03 * Math.sin(t * 25) * 0 + 0.04 : 0);
}

// ---------------------------------------------------------------- 6. ffmpeg press
function sceneFFmpeg(t) {
  const e = E();
  daySky(t, [P.sky2, P.sky3, P.sky4, P.clay3]);
  cloudGround(GROUND + 22, 1, t);
  // ram position
  let ramK = 0;
  e.presses.forEach(p => {
    const d = t - p;
    if (d > -0.08 && d < 0) ramK = Math.max(ramK, easeInCubic((d + 0.08) / 0.08));
    else if (d >= 0 && d < 0.12) ramK = 1;
    else if (d >= 0.12 && d < 0.55) ramK = Math.max(ramK, 1 - easeOutCubic((d - 0.12) / 0.43));
  });
  const pressCount = e.presses.filter(p => t >= p).length;
  // conveyor
  const belt = 194;
  R(10, belt, 184, 10, P.ink); R(11, belt + 1, 182, 8, P.ink3);
  for (let i = 0; i < 12; i++) { const rx = 18 + i * 15; disc(rx, belt + 5, 3, P.steel2); px(rx + Math.round(Math.cos(t * 12 + i) * 2), belt + 5 + Math.round(Math.sin(t * 12 + i) * 2), P.steel3); }
  for (let x = 12 + ((t * 40) % 8); x < 192; x += 8) R(x, belt + 1, 3, 1, P.grey);
  // press frame
  const fx0 = 186, fx1 = 296;
  R(fx0 - 1, 52, 14, 152, P.ink); R(fx0, 53, 12, 150, P.steel2); R(fx0 + 2, 53, 3, 150, P.steel3);
  R(fx1 - 1, 52, 14, 152, P.ink); R(fx1, 53, 12, 150, P.steel2); R(fx1 + 2, 53, 3, 150, P.steel3);
  for (let y = 62; y < 200; y += 16) { px(fx0 + 8, y, P.ink); px(fx1 + 8, y, P.ink); }
  R(fx0 - 10, 38, fx1 - fx0 + 32, 22, P.ink); R(fx0 - 9, 39, fx1 - fx0 + 30, 20, P.steel);
  R(fx0 - 9, 39, fx1 - fx0 + 30, 3, P.steel3);
  // sign
  R(214, 25, 64, 17, P.ink); R(215, 26, 62, 15, P.clay);
  text5('FFMPEG', 246, 30, P.paper, 1, { align: 'center', shadow: P.clay4 });
  if (Math.floor(t * 4) % 2) { disc(208, 33, 3, P.gold); disc(284, 33, 3, P.gold); } else { disc(208, 33, 3, P.clay4); disc(284, 33, 3, P.clay4); }
  // piston & ram
  const ramTop = Math.round(lerp(70, 146, ramK));
  R(234, 59, 24, ramTop - 59, P.ink); R(236, 59, 20, ramTop - 59, P.steel3); R(240, 59, 4, ramTop - 59, P.white);
  R(198, ramTop - 1, 98, 28, P.ink); R(199, ramTop, 96, 26, P.ink2); R(199, ramTop, 96, 4, P.ink3);
  for (let i = 0; i < 96; i += 10) R(199 + i, ramTop + 20, 5, 6, P.gold2);
  // gauge
  disc(178, 110, 9, P.ink); disc(178, 110, 7, P.paper);
  const ga = -2.4 + ramK * 3.6 + Math.sin(t * 30) * 0.05;
  line(178, 110, 178 + Math.cos(ga) * 6, 110 + Math.sin(ga) * 6, P.red, 1);
  // anvil
  R(196, 186, 100, 10, P.ink); R(197, 187, 98, 8, P.steel2);
  // stack of frames travelling, then being compressed
  const travel = easeInOut(seg(t, e.conveyor, e.presses[0] - 0.25));
  const stackH = [34, 20, 10, 4][pressCount];
  if (t < e.reelOut) {
    const sx = lerp(40, 246, travel);
    const sy = (travel < 1 ? belt : 186);
    const h = Math.min(stackH, travel < 1 ? 34 : Math.max(stackH, (ramTop + 26 < sy ? sy - ramTop - 26 : stackH)));
    const layers = Math.max(2, Math.floor(h / 3));
    for (let i = 0; i < layers; i++) {
      const lh = h / layers;
      R(sx - 15 + ((i * 5) % 3) - 1, sy - (i + 1) * lh, 30, Math.max(1, lh), P.ink);
      R(sx - 14 + ((i * 5) % 3) - 1, sy - (i + 1) * lh + (lh > 2 ? 1 : 0), 28, Math.max(1, lh - 1), [P.paper, P.sky3, P.teal3, P.clay3][i % 4]);
    }
  }
  // impacts
  e.presses.forEach((p, i) => {
    burst(t, p, { n: 36, x: 246, y: 184, jx: 90, spd: [100, 260], ang: [Math.PI * 1.05, Math.PI * 1.95], grav: 500, life: 0.6, size: 2, colors: [P.gold, P.gold3, P.white, P.clay3], seed: 61 + i });
    burst(t, p, { n: 14, x: 246, y: 60, jx: 120, spd: [20, 60], ang: [Math.PI * 1.2, Math.PI * 1.8], life: 1.0, size: 7, colors: [P.white, P.cream], shape: 'disc', drag: 1.5, seed: 64 + i });
    const d = t - p;
    if (d > 0 && d < 0.08) alpha(0.7, () => disc(246, 184, 40, P.gold3));
    bangText(['BANG!', 'CLANG!', 'BOOM!'][i], i === 1 ? 110 : 380, 110 - i * 10, t, p, 0.55, 3, P.gold, 10 + i);
  });
  // robot on the lever
  const rx = 380, ry = 216;
  let lever = 0;
  e.presses.forEach(p => { const d = t - p; if (d > -0.25 && d < 0.3) lever = Math.max(lever, 1 - Math.abs(d + 0.05) / 0.25); });
  R(398, 180, 30, 40, P.ink); R(399, 181, 28, 38, P.steel2); R(401, 183, 10, 5, P.red); R(414, 183, 10, 5, P.green);
  const la = -1.2 + lever * 1.4;
  line(406, 198, 406 + Math.cos(la) * 26, 198 + Math.sin(la) * 26, P.ink, 3);
  disc(406 + Math.cos(la) * 26, 198 + Math.sin(la) * 26, 4, P.red);
  const happy = t > e.reelOut;
  robot(rx, ry, { t, pose: happy ? 'cheer' : 'lever', lever, face: happy ? 'happy' : lever > 0.5 ? 'strain' : 'focus', scale: 1.1 });

  // reel pops out and gets audio
  if (t > e.reelOut) {
    const k = easeOutBack(seg(t, e.reelOut, e.reelOut + 0.5));
    const cx = 246, cy = lerp(176, 128, k);
    const r = Math.round(lerp(6, 24, k));
    const zap = t > e.audioZap;
    filmReel(cx, cy, r, t * 5, zap ? 1 : 0.4);
    // film strip tail
    for (let i = 0; i < 8; i++) {
      const fx = cx + r + i * 7, fy = cy + Math.sin(t * 6 + i) * 3 + i * 2;
      R(fx, fy - 4, 7, 9, P.ink); R(fx + 1, fy - 3, 5, 7, [P.sky3, P.clay3, P.teal3][i % 3]);
    }
    text5('MP4', cx, cy + r + 6, P.paper, 2, { align: 'center', outline: P.ink });
    burst(t, e.reelOut, { n: 30, x: cx, y: cy, spd: [60, 180], life: 0.9, size: 3, colors: CONFETTI, shape: 'star', drag: 2, seed: 70 });
    // audio waveform zap
    const zk = seg(t, e.audioZap - 0.35, e.audioZap);
    if (zk > 0 && zk < 1) {
      let lx = -10, ly = 40;
      for (let i = 0; i <= 40; i++) {
        const f = (i / 40) * zk;
        const x = lerp(-10, cx, f), y = lerp(40, cy, f) + Math.sin(f * 40) * 10 * (1 - f);
        line(lx, ly, x, y, P.teal, 3); line(lx, ly, x, y, P.teal3, 1);
        lx = x; ly = y;
      }
    }
    if (zap) {
      const d = t - e.audioZap;
      for (let i = 0; i < 3; i++) { const rr = r + 4 + ((d * 40 + i * 8) % 24); ring(cx, cy, rr, 1, i % 2 ? P.teal : P.teal3); }
      burst(t, e.audioZap, { n: 26, x: cx, y: cy, spd: [80, 200], life: 0.7, size: 3, colors: [P.teal, P.teal3, P.white], shape: 'star', drag: 2, seed: 71 });
      if (d < 1.2) text5('+ AUDIO', cx - 60, cy - 46, P.teal3, 2, { align: 'center', outline: P.ink });
    }
  }
  CAM.zoom = 1.03;
}

// ---------------------------------------------------------------- 7. git push rocket
function rocketDraw(x, y, t, fire, loaded) {
  // x,y = bottom center of rocket body
  x = Math.round(x); y = Math.round(y);
  // flames
  if (fire > 0) {
    const fl = 14 + fire * 26 + Math.sin(t * 50) * 4;
    for (let i = 0; i < 3; i++) {
      const w = [12, 8, 4][i], c = [P.clay, P.gold, P.white][i];
      for (let yy = 0; yy < fl * (1 - i * 0.25); yy++) {
        const ww = Math.max(1, Math.round(w * (1 - yy / (fl * (1 - i * 0.25))) + Math.sin(t * 60 + yy) * 1.2));
        R(x - ww, y + yy, ww * 2, 1, c);
      }
    }
  }
  // fins
  for (const s of [-1, 1]) {
    for (let i = 0; i < 16; i++) R(x + s * 13 + (s < 0 ? -i * 0.7 - 1 : 0), y - 18 + i, Math.ceil(i * 0.7) + 1, 1, P.ink);
    for (let i = 1; i < 15; i++) R(x + s * 13 + (s < 0 ? -i * 0.7 + 0 : 0), y - 17 + i, Math.max(1, Math.ceil(i * 0.7) - 1), 1, P.clay);
  }
  // body
  R(x - 14, y - 70, 28, 70, P.ink);
  R(x - 13, y - 69, 26, 68, P.paper);
  R(x + 6, y - 69, 7, 68, P.sand);
  R(x - 13, y - 6, 26, 5, P.clay2);
  // nose cone
  for (let i = 0; i < 22; i++) {
    const w = Math.round(14 * Math.sqrt(i / 22));
    R(x - w - 1, y - 92 + i, w * 2 + 2, 1, P.ink);
    if (w > 0) R(x - w, y - 92 + i, w * 2, 1, i < 4 ? P.clay3 : P.clay);
  }
  // porthole
  disc(x, y - 52, 7, P.ink); disc(x, y - 52, 6, P.steel3); disc(x, y - 52, 4, loaded ? P.ink2 : P.night2);
  if (loaded) { disc(x, y - 52, 3, P.steel2); px(x, y - 52, P.clay); alpha(0.4 + 0.3 * Math.sin(t * 8), () => disc(x, y - 52, 4, P.teal3)); }
  // vertical PUSH label
  'PUSH'.split('').forEach((c, i) => text5(c, x - 2, y - 40 + i * 8, P.clay2, 1));
}

function scenePush(t) {
  const e = E();
  // rocket world position: y measured in world px, launch at liftoff
  const fly = Math.max(0, t - e.liftoff);
  const rise = 40 * fly * fly * fly + 30 * fly * fly; // accelerating
  const padY = 206;
  const rocketY = padY - rise;
  const camY = Math.max(0, rise - 70); // camera follows once rocket climbs
  // sky: day -> deep -> space as we climb
  const up = clamp(camY / 900);
  daySky(t);
  alpha(easeInOut(clamp(up * 1.6)), () => ditherGradient(-MARGIN, H + MARGIN, [P.night1, P.night3, P.dusk2, P.dusk3]));
  alpha(clamp(up * 2 - 0.6), () => nightSky(t, 1));
  // passing clouds (parallax)
  for (let i = 0; i < 10; i++) {
    const cy = -200 - i * 160 + camY * 1.1;
    if (cy < -60 || cy > H + 60) continue;
    cloudBlob(60 + rnd(i * 5) * 360, cy, 70 + rnd(i) * 60, 22, P.white, P.sand, null, i);
  }
  g.save(); g.translate(0, Math.round(camY));
  cloudGround(GROUND + 22, 1, t);
  // launch tower
  R(250, 96, 6, 112, P.ink); R(274, 96, 6, 112, P.ink);
  for (let y = 100; y < 206; y += 12) { line(256, y, 274, y + 12, P.steel2, 1); line(274, y, 256, y + 12, P.steel2, 1); }
  R(244, 92, 42, 5, P.ink);
  // pad
  R(278, padY, 64, 8, P.ink); R(279, padY + 1, 62, 6, P.steel2);
  // console + robot
  const pressK = t > e.ignite - 0.1 && t < e.ignite + 0.4 ? Math.sin(clamp((t - e.ignite + 0.1) / 0.5) * Math.PI) : 0;
  R(150, 196, 40, 30, P.ink); R(151, 197, 38, 28, P.steel2);
  R(156, 201, 28, 6, P.ink2); R(157, 202, Math.round(26 * seg(t, 39.3, 41.3)), 4, P.green);
  disc(170, 196 - 2 + Math.round(pressK * 2), 7, P.ink); disc(170, 195 + Math.round(pressK * 2), 6, P.red); disc(168, 193 + Math.round(pressK * 2), 2, P.pink);
  const loading = t < e.reelLoad + 0.35;
  let pose = loading ? 'throw' : t > e.ignite - 0.3 && t < e.ignite + 0.6 ? 'press' : t > e.liftoff ? 'cheer' : 'idle';
  let face = t > e.liftoff ? 'happy' : t > e.countdown[0] ? 'focus' : 'happy';
  robot(140, 216, { t, pose, press: pressK, face, look: 1, scale: 1.1, sy: 1 - pressK * 0.1, sx: 1 + pressK * 0.08 });
  // reel thrown into porthole
  const lk = seg(t, e.reelLoad - 0.05, e.reelLoad + 0.35);
  if (lk > 0 && lk < 1) {
    const rx = lerp(158, 310, lk), ry = lerp(190, padY - 52, lk) - Math.sin(lk * Math.PI) * 60;
    filmReel(rx, ry, 7, t * 20, 0.5);
  }
  g.restore();
  // smoke billows on the pad
  if (t > e.ignite) {
    stream(t, e.ignite, 45.6, 28, 2.2, (age, bt, j) => {
      const side = j % 2 ? 1 : -1;
      const x0 = 310, y0 = padY + 6 + camY;
      const sp = 40 + rnd(j) * 90;
      const x = x0 + side * sp * (1 - Math.exp(-age * 2)) / 2 * 2.2;
      const y = y0 - rnd(j + 1) * 10 - age * 8;
      smokePuff(x, y, 5 + age * 9, j % 3 ? P.white : P.cream, clamp(1.2 - age / 2.2));
    });
  }
  // exhaust trail in world space (scrolls down with camera)
  if (fly > 0) {
    stream(t, e.liftoff, 45.6, 40, 1.6, (age, bt, j) => {
      const f = bt - e.liftoff;
      const ry = padY - (40 * f * f * f + 30 * f * f);
      const x = 310 + (rnd(j) - 0.5) * (4 + age * 30);
      const y = ry + 14 + camY + age * 20;
      smokePuff(x, y, 3 + age * 6, age < 0.15 ? P.gold3 : P.white, clamp(1 - age / 1.6));
    });
  }
  const shakeX = t > e.ignite && t < e.liftoff + 0.4 ? Math.round((rnd(Math.floor(t * 60)) - 0.5) * 2) : 0;
  const fire = t < e.ignite ? 0 : t < e.liftoff ? 0.4 + 0.2 * Math.sin(t * 40) : 1;
  rocketDraw(310 + shakeX, rocketY + camY, t, fire, t > e.reelLoad + 0.35);
  if (fly > 0.4) vSpeedLines(t, clamp((fly - 0.4) / 1.2) * 0.8, P.white);

  // countdown digits
  e.countdown.forEach((c, i) => {
    const d = t - c;
    if (d < 0 || d > 0.75) return;
    const k = pop(t, c, 0.25);
    const s = Math.max(1, Math.round(8 * k));
    alpha(1 - seg(d, 0.55, 0.75), () => {
      ring(240, 74, 18 + d * 80, 2, P.gold);
      text5(String(3 - i), 240, 74 - (7 * s) / 2, P.paper, s, { align: 'center', outline: P.clay2 });
    });
  });
  bangText('GIT PUSH!', 150, 120, t, e.ignite, 0.8, 2, P.paper, 20);
  if (fly > 0) bangText('LIFTOFF!', 120, 60, t, e.liftoff, 1.0, 3, P.gold, 21);
  // destination repo cloud arrives from above
  if (t > 44.2) {
    const k = easeOutCubic(seg(t, 44.2, e.rocketHit));
    const cy = lerp(-60, 40, k);
    cloudBlob(310, cy, 150, 44, P.steel3, P.steel, P.ink, 3);
    R(274, cy - 14, 72, 15, P.ink); R(275, cy - 13, 70, 13, P.ink2);
    text5('ORIGIN', 310, cy - 10, P.paper, 1, { align: 'center' });
  }
  CAM.zoom = 1.03 + (t > e.ignite && t < e.liftoff ? 0.03 * seg(t, e.ignite, e.liftoff) : 0);
}

// ---------------------------------------------------------------- 8. finale
function sceneEnd(t) {
  const e = E();
  const back = 49.6; // back to the container at dusk
  if (t < back) {
    ditherGradient(-MARGIN, H + MARGIN, [P.night2, P.dusk1, P.dusk2, P.dusk3, P.dusk4]);
    for (let i = 0; i < 40; i++) { const tw = Math.sin(t * 3 + i * 2); if (tw > 0) px(rnd(i) * W, rnd(i + 50) * 150, tw > 0.8 ? P.white : P.sand2); }
    // big spark
    const k = easeOutElastic(seg(t, e.bigBurst, e.bigBurst + 1.0));
    const cx = 240, cy = 104;
    const d = t - e.bigBurst;
    for (let i = 0; i < 3; i++) { const rr = d * (140 + i * 60); if (rr < 400) ring(cx, cy, rr, 3 - i, [P.gold3, P.gold, P.clay3][i]); }
    alpha(0.3, () => disc(cx, cy, 54 * k, P.clay3));
    spark(cx, cy, 46 * k, P.clay, t * 0.6, 12);
    spark(cx, cy, 20 * k, P.gold3, -t * 0.9, 8);
    // fireworks
    const fw = [[45.9, 90, 64], [46.5, 390, 54], [47.1, 150, 40], [47.7, 330, 84], [48.3, 240, 30], [48.8, 70, 100], [49.2, 420, 110]];
    fw.forEach(([ft, fx, fy], i) => {
      const rise = seg(t, ft - 0.4, ft);
      if (rise > 0 && rise < 1) { R(fx, lerp(270, fy, easeOutCubic(rise)), 2, 6, P.gold3); }
      burst(t, ft, { n: 46, x: fx, y: fy, spd: [50, 130], life: 1.3, size: 3, colors: [CONFETTI[i % 8], CONFETTI[(i + 3) % 8], P.white], shape: 'star', drag: 1.6, grav: 50, seed: 80 + i });
    });
    // confetti rain
    stream(t, 45.7, back, 50, 3, (age, bt, j) => {
      const x = rnd(j) * (W + 40) - 20 + Math.sin(age * 5 + j) * 8;
      const y = -10 + age * (60 + rnd(j + 1) * 50);
      const w = Math.sin(age * 10 + j) > 0 ? 3 : 1;
      R(x, y, w, 3, CONFETTI[j % 8]);
    });
    // title letters drop in
    const title = 'MADE IN THE CLOUD!';
    const s = 3, tw = textW(title, s);
    for (let i = 0; i < title.length; i++) {
      const lt = e.title + i * 0.05;
      if (t < lt) continue;
      const dk = easeOutBounce(seg(t, lt, lt + 0.5));
      const y = lerp(-30, 186, dk) + Math.sin(t * 5 + i * 0.6) * 3 * seg(t, lt + 0.5, lt + 0.8);
      const x = 240 - tw / 2 + i * 6 * s;
      text5(title[i], x, y, i % 2 ? P.gold : P.paper, s, { outline: P.ink });
    }
    return;
  }
  // dusk at the container, robot says bye, lights go off
  const dark = e.lightsOff.filter(x => t >= x).length;
  ditherGradient(-MARGIN, 220, [P.dusk1, P.dusk2, P.dusk3, P.dusk4]);
  R(-MARGIN, 220, W + 2 * MARGIN, 60, P.dusk4);
  for (let i = 0; i < 30; i++) { const tw = Math.sin(t * 3 + i * 2); if (tw > 0.3) px(rnd(i) * W, rnd(i + 50) * 120, P.white); }
  cloudGround(GROUND, 1, t, P.clay3, P.dusk3, P.ink);
  const lamps = [dark > 0 ? 0 : 1, dark > 1 ? 0 : 1, dark > 2 ? 0 : 1];
  const goIn = seg(t, 53.8, 54.2);
  const doorClose = seg(t, 54.25, 54.5);
  const inside = goIn >= 1;
  const glow = inside ? clamp(1 - seg(t, e.antennaFade, e.antennaFade + 0.6)) : 0;
  const rface = t > e.lightsOff[0] ? 'sleepy' : 'happy';
  const rpose = t > e.wave && t < e.lightsOff[0] ? 'wave' : t > e.lightsOff[0] && t < 53.6 ? 'yawn' : 'idle';
  container(240, GROUND, {
    open: 1 - easeOutBounce(doorClose), lamps, windowGlow: glow,
    interior: (dx, dy, dw, dh) => { if (inside && doorClose < 1) robot(240, dy + dh - 1, { t, face: 'sleepy', shadow: false }); },
  });
  burst(t, 54.5, { n: 12, x: 240, y: GROUND - 2, jx: 40, spd: [20, 50], ang: [Math.PI * 1.1, Math.PI * 1.9], life: 0.35, size: 3, colors: [P.sand, P.white], shape: 'disc', drag: 3, seed: 91 });
  if (!inside) {
    const y = lerp(216, GROUND - 1, goIn) - Math.sin(goIn * Math.PI) * 24;
    robot(240, y, { t, pose: rpose, face: rface, scale: lerp(1.15, 0.95, goIn) });
    if (t > e.wave && t < e.lightsOff[0]) {
      const k = pop(t, e.wave, 0.3);
      text5('BYE~', 296, 160 + Math.sin(t * 6) * 2, P.paper, Math.max(1, Math.round(3 * k)), { align: 'center', outline: P.clay2 });
      stream(t, e.wave, e.lightsOff[0], 4, 1.5, (age, bt, j) => {
        const x = 270 + rnd(j) * 40 + Math.sin(age * 4) * 4, y = 190 - age * 40;
        const c = P.pink;
        R(x, y, 2, 2, c); R(x + 3, y, 2, 2, c); R(x - 1, y + 1, 7, 2, c); R(x, y + 3, 5, 1, c); R(x + 1, y + 4, 3, 1, c); R(x + 2, y + 5, 1, 1, c);
      });
    }
  }
  // zzz from window
  if (inside) stream(t, 54.6, 57, 2.5, 2, (age, bt, j) => {
    text5('Z', 250 + age * 16 + Math.sin(age * 4) * 3, 140 - age * 30, P.paper, 1 + (j % 2), {});
  });
  // darkness steps
  alpha(dark * 0.16, () => R(-MARGIN, -MARGIN, W + 2 * MARGIN, H + 2 * MARGIN, P.night1));
  // end card
  if (t > e.endCard) {
    const k = seg(t, e.endCard, e.endCard + 0.4);
    alpha(k, () => {
      R(-MARGIN, -MARGIN, W + 2 * MARGIN, H + 2 * MARGIN, P.night1);
      spark(240, 92, 22 + Math.sin(t * 4) * 2, P.clay, t * 0.5, 12);
      text5('MADE IN THE CLOUD', 240, 132, P.paper, 2, { align: 'center' });
      text5('WITH CLAUDE CODE', 240, 154, P.clay3, 2, { align: 'center' });
      text5('FFMPEG + HEADLESS CHROMIUM + GEMINI TTS', 240, 186, P.ink3, 1, { align: 'center' });
    });
  }
}

const SCENE_FN = { boot: sceneBoot, wake: sceneWake, clone: sceneClone, code: sceneCode, camera: sceneCamera, ffmpeg: sceneFFmpeg, push: scenePush, end: sceneEnd };
Object.assign(window, { SCENE_FN, resetCam, getCam: () => CAM });
