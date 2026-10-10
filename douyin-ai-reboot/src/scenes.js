'use strict';
// Scene functions. Each takes the global time t and draws the stage for its scene.
// Timing comes from window.TL (built from the voice-over durations), so audio and
// picture stay in sync if a line is re-recorded.

const SC = Object.fromEntries(TL.scenes.map(s => [s.id, s]));
const LINES = Object.fromEntries(TL.scenes.flatMap(s => s.lines.map(l => [l.id, l])));
const LN = id => LINES[id];
// Approximate time a substring is spoken, by its character position in the subtitle.
function wordT(id, sub) {
  const l = LINES[id], chars = [...l.zh], i = l.zh.indexOf(sub);
  const k = i < 0 ? 0 : [...l.zh.slice(0, i)].length / chars.length;
  return l.at + l.dur * k;
}
const QUESTS = [
  { scene: 'ai', title: '先把自己AI化', reward: '+1 外接大脑' },
  { scene: 'map', title: '先探图，再决定', reward: '+1 视野' },
  { scene: 'free', title: '先自由，后财富', reward: '+1 选择权' },
  { scene: 'body', title: 'AI越强，身体越值钱', reward: '+1 寿命' },
];
const clearT = q => SC[q.scene].end - 1.05;

const KEY_Y = 1318;

// Big keyword under the stage: white with ink outline, highlighted parts in yellow.
function keyword(str, hl, t, t0, out, size = 104) {
  if (t < t0 || (out != null && t > out + 0.6)) return;
  const idx = new Set();
  for (const h of hl) { const i = [...str].findIndex((_, k) => [...str].slice(k, k + [...h].length).join('') === h); if (i >= 0) for (let k = 0; k < [...h].length; k++) idx.add(i + k); }
  let sz = size;
  while (measure(str, 'zh', sz, 900) > 940) sz -= 4;
  pop(str, CX, KEY_Y, { size: sz, w: 900, t, t0, out, stagger: 0.035, stroke: C.INK, strokeW: sz * 0.2, color: i => (idx.has(i) ? C.Y : C.W) });
}

// Pixel-style quest title band under the HUD.
function questBand(t, qi) {
  const s = SC[QUESTS[qi].scene];
  const k = expoOut(seg(t, s.start + 0.05, s.start + 0.45));
  const x = lerp(-900, 90, k);
  pixPanel(x, 352, 900, 104, 'rgba(18,26,58,0.92)', C.CY, 6);
  text(`QUEST 0${qi + 1}`, x + 36, 420, { fam: 'px', size: 30, color: C.CY });
  text(QUESTS[qi].title, x + 330, 424, { fam: 'pix', size: 54, color: C.W });
}

// "Quest clear" pop-up near the end of each quest scene.
function questClear(t, qi) {
  const t0 = clearT(QUESTS[qi]);
  if (t < t0 || t > t0 + 1.2) return;
  const dt = t - t0, s = spring(dt, 2.2, 7) * (1 - expoIn(seg(t, t0 + 0.85, t0 + 1.1)));
  burst(t, t0, { x: CX, y: 860, n: 26, spd: [500, 1300], life: 0.9, size: 22, colors: [C.Y, C.CY, C.W, C.PINK], shape: 'star', seed: qi + 3 });
  withAlpha(0.45 * s, () => rect(0, 0, OW, OH, '#050816'));
  xform(CX, 860, s, wobble(dt, 3, 6) * 0.05, () => {
    pixPanel(-380, -130, 760, 260, 'rgba(11,16,38,0.96)', C.Y, 8);
    text('QUEST CLEAR!', 0, -36, { fam: 'px', size: 48, color: C.Y, align: 'center' });
    text(`任务完成  ${QUESTS[qi].reward}`, 0, 74, { fam: 'pix', size: 62, color: C.W, align: 'center' });
  });
}

// ---------------------------------------------------------------- HOOK
function sceneHook(t) {
  backdrop(t);
  const l = LN('l01');
  const tPhone = wordT('l01', '一部手机') - 0.25, tCash = wordT('l01', '1000块'), tQ = wordT('l01', '怎么翻身');
  // "20岁" is on screen from frame 0 (no blank first frame on the feed).
  const s0 = 1 + 0.15 * (1 - expoOut(seg(t, 0, 0.35)));
  xform(CX, 580, s0, 0, () => {
    text('20岁', 10, 10, { size: 250, w: 900, color: C.CY, align: 'center' });
    text('20岁', 0, 0, { size: 250, w: 900, color: C.Y, align: 'center', stroke: C.INK, strokeW: 34 });
  });
  withAlpha(1 - seg(t, SC.hook.end - 0.5, SC.hook.end - 0.3), () => {
    pixPanel(170, 196, 740, 100, 'rgba(11,16,38,0.92)', C.CY, 5);
    text('孙宇晨 × 邵艾伦 · 4小时精华', CX, 264, { fam: 'pix', size: 50, color: C.W, align: 'center' });
  });
  text('LV.20  新手村', CX, 660, { fam: 'pix', size: 46, color: C.MUTE, align: 'center' });
  // phone drops in
  const kp = seg(t, tPhone, tPhone + 0.4);
  if (kp > 0) {
    const py = lerp(-700, 710, backOut(kp, 1.4));
    phone(410, py, 260, 440, t, seg(t, tCash, tCash + 0.2) * (1 - seg(t, tCash + 0.6, tCash + 1.2)));
    if (t > tCash) {
      const k = spring(t - tCash, 2.5, 8);
      xform(540, py + 210, k, 0, () => {
        text('余额', 0, -40, { fam: 'pix', size: 40, color: C.MUTE, align: 'center' });
        text('¥1000', 0, 40, { fam: 'px', size: 44, color: C.Y, align: 'center' });
      });
      for (let i = 0; i < 5; i++) {
        const ct = tCash + 0.08 * i, a = t - ct;
        if (a > 0 && a < 1.4) coin(540 + (i - 2) * 140 + Math.sin(i * 3) * 20, py + 460 - 900 * a + 1100 * a * a * 0.9, 30, t + i);
      }
    }
  }
  // hero peeks in from the left
  const kh = spring(t - (tPhone + 0.3), 2, 7);
  if (t > tPhone + 0.3) hero(lerp(-150, 230, kh), 1150, { t, s: 1.05, face: t > tQ ? 'shock' : 'normal', look: 1 });
  // "怎么翻身？" slams in with an RGB glitch
  if (t > tQ) {
    const k = seg(t, tQ, tQ + 0.16), sc = lerp(2.4, 1, expoOut(k));
    const g = (1 - seg(t, tQ, tQ + 0.35)) * 14;
    xform(CX, 1335, sc, -0.03, () => {
      if (g > 0.5) { text('怎么翻身？', -g, 0, { size: 140, w: 900, color: C.PINK, align: 'center' }); text('怎么翻身？', g, 0, { size: 140, w: 900, color: C.CY, align: 'center' }); }
      text('怎么翻身？', 0, 0, { size: 140, w: 900, color: C.Y, align: 'center', stroke: C.INK, strokeW: 26 });
    });
    burst(t, tQ, { x: CX, y: 1260, n: 30, spd: [700, 1500], life: 0.7, size: 18, colors: [C.Y, C.W, C.CY], seed: 2 });
  }
}

// ---------------------------------------------------------------- INTRO
function guestCard(x, y, name, tag, col, k) {
  if (k <= 0) return;
  pixPanel(x, y, 420, 330, 'rgba(18,26,58,0.95)', col, 6);
  // abstract avatar (no likeness): head + shoulders silhouette
  circle(x + 210, y + 98, 52, col);
  c.fillStyle = col; c.beginPath(); c.ellipse(x + 210, y + 210, 92, 50, 0, Math.PI, 0); c.fill();
  text(name, x + 210, y + 286, { size: 60, w: 900, color: C.W, align: 'center' });
  text(tag, x + 210, y + 322 + 40, { fam: 'pix', size: 36, color: col, align: 'center' });
}
function sceneIntro(t) {
  backdrop(t);
  const s = SC.intro, l = LN('l02');
  const tA = l.at, tB = wordT('l02', '邵艾伦'), tH = wordT('l02', '4个多小时'), tC = wordT('l02', '我压成'), tF = wordT('l02', '4个反常识');
  const fade = 1 - seg(t, tF - 0.1, tF + 0.25);
  withAlpha(fade, () => {
    const ka = expoOut(seg(t, tA - 0.1, tA + 0.35)), kb = expoOut(seg(t, tB - 0.1, tB + 0.35));
    guestCard(lerp(-500, 80, ka), 520, '孙宇晨', '加密行业创业者', C.Y, ka);
    guestCard(lerp(1100, 580, kb), 520, '邵艾伦', '千万粉丝博主', C.CY, kb);
    if (t > tB) xform(CX, 690, spring(t - tB - 0.15, 2.5, 7), 0, () => text('×', 0, 30, { fam: 'px', size: 70, color: C.W, align: 'center', stroke: C.INK, strokeW: 14 }));
    // talk length counter compressing 4:22:00 -> 01:00
    if (t > tH) {
      const kk = expoOut(seg(t, tH, tH + 0.3));
      const comp = cubicInOut(seg(t, tC, tC + 1.0));
      const secs = Math.round(lerp(4 * 3600 + 22 * 60, 60, comp));
      const hh = String(Math.floor(secs / 3600)).padStart(2, '0'), mm = String(Math.floor(secs / 60) % 60).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0');
      withAlpha(kk, () => {
        pixPanel(140, 960, 800, 230, 'rgba(11,16,38,0.95)', comp > 0.99 ? C.GREEN : C.W, 6);
        text(`${hh}:${mm}:${ss}`, CX, 1060, { fam: 'px', size: 64, color: comp > 0.99 ? C.GREEN : C.W, align: 'center' });
        rect(200, 1110, 680, 34, C.DIM);
        rect(200, 1110, 680 * comp, 34, comp > 0.99 ? C.GREEN : C.PINK);
        text(comp > 0.99 ? '压缩完成：1分钟' : '压缩中…', CX, 1180 + 0, { fam: 'pix', size: 36, color: C.MUTE, align: 'center' });
      });
    }
  });
  // four empty quest slots appear, then fly up into the HUD
  if (t > tF - 0.05) {
    pop('4个反常识', CX, 600, { size: 120, w: 900, t, t0: tF - 0.05, stroke: C.INK, strokeW: 22, color: i => (i === 0 ? C.Y : C.W), out: s.end - 0.45 });
    for (let i = 0; i < 4; i++) {
      const k = spring(t - tF - 0.1 - i * 0.09, 2.3, 7);
      const fly = cubicInOut(seg(t, s.end - 0.45 + i * 0.04, s.end - 0.05 + i * 0.04));
      const [hx, hy, hs] = hudSlot(i);
      const x = lerp(165 + i * 250, hx, fly), y = lerp(860, hy, fly), sz = lerp(200, hs, fly);
      if (k > 0.01) xform(x, y, k, 0, () => slotBox(0, 0, sz, i, 0, t));
    }
  }
}

// ---------------------------------------------------------------- QUEST 1: AI化
function sceneAI(t) {
  backdrop(t);
  const s = SC.ai, l3 = LN('l03'), l4 = LN('l04'), l5 = LN('l05');
  questBand(t, 0);
  const tAI = wordT('l03', 'AI化');
  // part 1: hero + robot sidekick
  const p1 = 1 - seg(t, l4.at - 0.2, l4.at + 0.15);
  withAlpha(p1, () => {
    hero(CX - 60, 1180, { t, s: 1.35, face: t > tAI ? 'happy' : 'normal', look: t > tAI ? 1 : 0 });
    if (t > tAI) {
      const k = spring(t - tAI, 2.4, 7);
      xform(CX + 230, 760, k, 0, () => { robot(0, 0, 2.0, t); });
      burst(t, tAI, { x: CX + 230, y: 760, n: 18, spd: [400, 900], life: 0.6, size: 16, colors: [C.CY, C.Y, C.W], shape: 'star', seed: 4 });
      withAlpha(seg(t, tAI + 0.2, tAI + 0.4), () => text('AI 助理已加入队伍', CX + 230, 940, { fam: 'pix', size: 40, color: C.CY, align: 'center' }));
    }
  });
  // part 2: life data rows fly into the "my archive" chest
  const rows = [['饮食', '1850 kcal', '饮食'], ['训练', '45 min', '训练'], ['开销', '¥ 32', '开销'], ['睡眠', '7.5 h', '全部记下来']];
  const tStore = wordT('l04', '存成');
  const tL5 = l5.at;
  const chestK = expoOut(seg(t, l4.at, l4.at + 0.4));
  const chestX = lerp(820, CX, cubicInOut(seg(t, tL5 - 0.3, tL5 + 0.3)));
  const chestY = lerp(990, 1080, cubicInOut(seg(t, tL5 - 0.3, tL5 + 0.3)));
  if (t > l4.at - 0.1) {
    const open = cubicOut(seg(t, tStore - 0.3, tStore)) * (1 - seg(t, tStore + 1.4, tStore + 1.7));
    const glow = seg(t, wordT('l05', '数据'), wordT('l05', '数据') + 0.3);
    if (glow > 0) withAlpha(glow * (0.5 + 0.2 * pulse(t, 2)), () => circle(chestX, chestY + 10, 190, 'rgba(255,217,59,0.35)'));
    xform(chestX, chestY, chestK, 0, () => chest(0, 0, 1.1, open));
    withAlpha(chestK, () => text('我的档案.md', chestX, chestY + 135, { fam: 'pix', size: 44, color: C.Y, align: 'center' }));
    rows.forEach(([k, v, w], i) => {
      const ta = wordT('l04', w) + (i === 3 ? 0.15 : 0), tf = tStore + i * 0.12;
      if (t < ta || t > tf + 0.5) return;
      const kin = expoOut(seg(t, ta, ta + 0.3)), kf = cubicInOut(seg(t, tf, tf + 0.45));
      const x0 = lerp(-500, 90, kin), y0 = 560 + i * 130;
      const x = lerp(x0, chestX - 60, kf), y = lerp(y0, chestY - 40, kf), sc = lerp(1, 0.2, kf);
      xform(x, y, sc, 0, () => {
        pixPanel(0, 0, 520, 104, 'rgba(18,26,58,0.95)', C.CY, 5);
        rect(26, 34, 36, 36, [C.Y, C.PINK, C.GREEN, C.CY][i]);
        text(k, 86, 70, { size: 46, w: 900, color: C.W });
        text(v, 494, 68, { fam: 'px', size: 26, color: C.Y, align: 'right' });
      });
    });
  }
  // part 3: model cartridges plug in and out; the chest (data) stays put
  if (t > tL5 - 0.1) {
    const names = ['模型 A', '模型 B', '模型 C', '模型 D'];
    const per = 0.75;
    for (let i = 0; i < names.length; i++) {
      const t0 = tL5 + i * per;
      const kin = backOut(seg(t, t0, t0 + 0.3), 1.2), kout = expoIn(seg(t, t0 + per, t0 + per + 0.3));
      if (kin <= 0 || kout >= 1) continue;
      const x = lerp(1300, chestX, kin) + lerp(0, -800, kout), y = chestY - 300;
      push(() => {
        pixPanel(x - 140, y - 70, 280, 140, i % 2 ? '#24306a' : '#2b3b85', C.CY, 6);
        text(names[i], x, y + 16, { fam: 'pix', size: 48, color: C.W, align: 'center' });
        if (kin > 0.95 && kout <= 0) withAlpha(pulse(t, 3), () => line(x, y + 76, x, chestY - 110, C.CY, 6));
      });
    }
    withAlpha(seg(t, tL5 + 0.2, tL5 + 0.5), () => {
      text('模型：随时换', chestX - 250, chestY - 420, { fam: 'pix', size: 40, color: C.CY, align: 'center' });
    });
  }
  keyword('先把自己AI化', ['AI化'], t, tAI - 0.2, l5.at - 0.25);
  keyword('数据永远是你的', ['你的'], t, l5.at - 0.05, null);
  questClear(t, 0);
}

// ---------------------------------------------------------------- QUEST 2: 探图
const MAP = { cols: 8, rows: 7, tile: 88, x: 188, y: 590 };
const PATH = [];
for (let r = 0; r < MAP.rows; r++) for (let k = 0; k < MAP.cols; k++) PATH.push([r % 2 ? MAP.cols - 1 - k : k, r]);
function sceneMap(t) {
  backdrop(t);
  const s = SC.map, l6 = LN('l06'), l7 = LN('l07');
  questBand(t, 1);
  const t0 = l6.at + 0.5, t1 = wordT('l07', '再做决定') - 0.1;
  const u = clamp((t - t0) / (t1 - t0)) * (PATH.length - 1);
  const { cols, rows, tile, x: mx, y: my } = MAP;
  const appear = expoOut(seg(t, s.start + 0.1, s.start + 0.5));
  withAlpha(appear, () => {
    let seen = 0;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const id = r * cols + q, x = mx + q * tile, y = my + r * tile;
      const kind = rnd(id * 3.1) < 0.18 ? 'water' : 'grass';
      rect(x + 2, y + 2, tile - 4, tile - 4, kind === 'water' ? '#244c9e' : '#1f6b45');
      if (kind === 'grass') rect(x + 14 + rnd(id) * 40, y + 20 + rnd(id + 1) * 40, 10, 10, '#2f8f5c');
      const hasHouse = kind === 'grass' && rnd(id * 7.7) < 0.55;
      // fog clears when the scout gets within ~1.3 tiles
      const pi = PATH.findIndex(p => p[0] === q && p[1] === r);
      const near = Math.max(0, 1 - Math.max(0, pi - u - 0.4) / 1.6);
      const fogA = 1 - cubicOut(clamp(near));
      if (hasHouse) {
        withAlpha(1 - fogA, () => house(x + tile / 2, y + tile * 0.78, 0.8, C.W, [C.PINK, C.Y, C.CY][id % 3]));
        if (fogA < 0.5) seen++;
      }
      if (fogA > 0.01) withAlpha(fogA, () => { rect(x, y, tile, tile, '#0d1230'); rect(x + 30, y + 30, 8, 8, 'rgba(160,175,255,0.18)'); rect(x + 58, y + 56, 8, 8, 'rgba(160,175,255,0.12)'); });
    }
    strokeRect(mx - 6, my - 6, cols * tile + 12, rows * tile + 12, C.CY, 6);
    // pins for the choices being compared
    const pins = [['专业', 13, '选专业'], ['行业', 26, '选行业'], ['岗位', 35, '也一样'], ['城市', 50, '地图']];
    pins.forEach(([label, id, w], i) => {
      const tp = wordT('l07', w);
      if (t < tp) return;
      const q = id % cols, r = Math.floor(id / cols), x = mx + q * tile + tile / 2, y = my + r * tile + tile / 2;
      xform(x, y - 30, spring(t - tp, 2.4, 7), 0, () => {
        pixPanel(-74, -110, 148, 72, 'rgba(11,16,38,0.95)', C.Y, 4);
        text(label, 0, -56, { fam: 'pix', size: 44, color: C.Y, align: 'center' });
        c.fillStyle = C.Y; c.beginPath(); c.moveTo(-14, -40); c.lineTo(14, -40); c.lineTo(0, -16); c.fill();
      });
    });
    // the scout
    const i0 = Math.floor(u), f = u - i0, a = PATH[i0], b = PATH[Math.min(PATH.length - 1, i0 + 1)];
    const hx = mx + lerp(a[0], b[0], f) * tile + tile / 2, hy = my + lerp(a[1], b[1], f) * tile + tile * 0.85;
    if (t > t0 - 0.2) hero(hx, hy, { t, s: 0.5, walk: t < t1 ? t * 3 : null, face: t > t1 ? 'happy' : 'normal' });
    // decision flag
    const tD = wordT('l07', '再做决定');
    if (t > tD) {
      const id = 44, q = id % cols, r = Math.floor(id / cols), x = mx + q * tile + tile / 2, y = my + r * tile + tile * 0.8;
      ring(x, y - 30, 40 + (t - tD) * 160 % 120, C.Y, 5);
      xform(x, y, spring(t - tD, 2.2, 7), 0, () => { line(0, 0, 0, -120, C.W, 8); c.fillStyle = C.Y; c.beginPath(); c.moveTo(4, -120); c.lineTo(80, -96); c.lineTo(4, -72); c.fill(); });
    }
    // houses-seen counter
    pixPanel(560, 470, 440, 92, 'rgba(11,16,38,0.96)', C.Y, 5);
    text('已看', 600, 534, { fam: 'pix', size: 44, color: C.W });
    const seenV = Math.min(100, (seen / 26) * 100);
    odometer(seenV, 3, 720, 536, { size: 40, color: C.Y });
    text('/100 套', 850, 534, { fam: 'pix', size: 40, color: C.MUTE });
  });
  keyword('买房前，先看100套', ['100套'], t, wordT('l06', '先看') - 0.2, wordT('l07', '先用AI') - 0.2);
  keyword('先探图，再决定', ['探图'], t, wordT('l07', '先用AI'), null);
  questClear(t, 1);
}

// ---------------------------------------------------------------- QUEST 3: 自由
function chain(x0, y0, x1, y1, t, broken) {
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    let x = lerp(x0, x1, k), y = lerp(y0, y1, k) + Math.sin(k * Math.PI) * 30;
    if (broken > 0) { const sd = k < 0.5 ? -1 : 1; x += sd * broken * 140 * (0.5 + rnd(i)); y += broken * broken * 600 * rnd(i + 3); }
    withAlpha(1 - broken, () => { c.strokeStyle = C.PINK; c.lineWidth = 9; c.beginPath(); c.ellipse(x, y, 20, 12, Math.atan2(y1 - y0, x1 - x0) + (i % 2 ? Math.PI / 2 : 0) * 0.6, 0, Math.PI * 2); c.stroke(); });
  }
}
function sceneFree(t) {
  backdrop(t);
  const s = SC.free, l8 = LN('l08'), l9 = LN('l09'), l10 = LN('l10');
  questBand(t, 2);
  // part 1: 财富 → 自由 flips to 自由 → 财富
  const tFlip = wordT('l08', '先自由');
  const p1 = 1 - seg(t, l9.at - 0.25, l9.at + 0.1);
  withAlpha(p1 * expoOut(seg(t, s.start + 0.1, s.start + 0.4)), () => {
    const k = cubicInOut(seg(t, tFlip - 0.05, tFlip + 0.5));
    text(k < 0.5 ? '大多数人以为' : '孙宇晨说', CX, 640, { fam: 'pix', size: 52, color: k < 0.5 ? C.MUTE : C.CY, align: 'center' });
    const L = [CX - 250, 870], R = [CX + 250, 870];
    const arc = Math.sin(k * Math.PI) * 170;
    // 财富 travels left->right over the top; 自由 right->left underneath
    const wx = lerp(L[0], R[0], k), wy = L[1] - arc, fx = lerp(R[0], L[0], k), fy = R[1] + arc;
    text('→', CX, 880, { fam: 'px', size: 70, color: C.W, align: 'center' });
    text('财富', wx, wy + 50, { size: 150, w: 900, color: C.W, align: 'center', stroke: C.INK, strokeW: 24 });
    text('自由', fx, fy + 50, { size: 150, w: 900, color: k > 0.5 ? C.Y : C.W, align: 'center', stroke: C.INK, strokeW: 24 });
    if (t > tFlip + 0.5) burst(t, tFlip + 0.5, { x: L[0], y: 840, n: 18, spd: [400, 900], life: 0.6, size: 16, colors: [C.Y, C.W], shape: 'star', seed: 7 });
    withAlpha(seg(t, tFlip + 0.5, tFlip + 0.8), () => text('财富只是伴生品', CX, 1100, { fam: 'pix', size: 50, color: C.MUTE, align: 'center' }));
  });
  // part 2: chained to a mortgage and a car loan
  const tBreak = l10.at + 0.05;
  if (t > l9.at - 0.2) {
    const kin = expoOut(seg(t, l9.at - 0.2, l9.at + 0.2));
    const scroll = Math.max(0, t - tBreak) * 420;
    // ground strip with grass and water that scrolls once free
    withAlpha(kin, () => {
      for (let i = -1; i < 14; i++) {
        const x = i * 90 - (scroll % 90), id = i + Math.floor(scroll / 90);
        rect(x, 1110, 88, 60, rnd(id * 1.7) < 0.25 ? C.WATER : C.GRASS);
        if (rnd(id * 2.3) < 0.5) { rect(x + 20, 1096, 8, 14, '#7dffb0'); rect(x + 34, 1090, 8, 20, '#7dffb0'); }
      }
    });
    const tHouse = wordT('l09', '房贷'), tCar = wordT('l09', '车贷'), tLock = wordT('l09', '锁死');
    const brk = seg(t, tBreak, tBreak + 0.6);
    const objOut = seg(t, tBreak + 0.1, tBreak + 0.9);
    const hx = CX + Math.sin(Math.max(0, t - tBreak) * 2) * 0;
    // red vignette while locked
    const locked = seg(t, tLock, tLock + 0.2) * (1 - seg(t, tBreak, tBreak + 0.3));
    if (locked > 0) withAlpha(locked * 0.5, () => { const g = c.createRadialGradient(CX, 900, 200, CX, 900, 1000); g.addColorStop(0, 'rgba(255,79,123,0)'); g.addColorStop(1, 'rgba(255,79,123,0.7)'); c.fillStyle = g; c.fillRect(0, 0, OW, OH); });
    if (t > tHouse) withAlpha(1 - objOut, () => {
      const k = spring(t - tHouse, 2.3, 7), x = 200 - objOut * 400;
      xform(x, 860, k, 0, () => house(0, 0, 2.2, C.W, C.PINK));
      text('房贷', x, 950, { fam: 'pix', size: 52, color: C.PINK, align: 'center' });
      chain(hx - 40, 1030, x + 60, 880, t, brk);
    });
    if (t > tCar) withAlpha(1 - objOut, () => {
      const k = spring(t - tCar, 2.3, 7), x = 880 + objOut * 400;
      xform(x, 890, k, 0, () => car(0, 0, 2.0, C.CY));
      text('车贷', x, 980, { fam: 'pix', size: 52, color: C.PINK, align: 'center' });
      chain(hx + 40, 1030, x - 70, 900, t, brk);
    });
    if (t > tBreak) burst(t, tBreak, { x: hx, y: 1000, n: 34, spd: [500, 1400], life: 0.8, size: 18, colors: [C.PINK, C.W, C.Y], seed: 8, grav: 900 });
    withAlpha(kin, () => hero(hx, 1110, { t, s: 1.3, face: t > tBreak ? 'happy' : t > tLock ? 'strain' : 'normal', walk: t > tBreak + 0.2 ? (t - tBreak) * 2.6 : null, arm: t > tBreak && t < tBreak + 0.6 ? 1 : 0 }));
    if (t > tLock && t < tBreak + 0.5) {
      const open = seg(t, tBreak - 0.05, tBreak + 0.15);
      withAlpha(1 - seg(t, tBreak + 0.15, tBreak + 0.5), () => xform(hx, 640, spring(t - tLock, 2.5, 7), wobble(t - tLock, 4, 5) * 0.2, () => lockIcon(0, 0, 2.0, C.PINK, open)));
    }
    if (t > tBreak + 0.3) {
      withAlpha(seg(t, tBreak + 0.3, tBreak + 0.6), () => {
        // drifting grass & water pixels
        for (let i = 0; i < 10; i++) {
          const x = ((i * 137 + 1200 - (t - tBreak) * 300) % 1200) - 60, y = 640 + (i % 4) * 90 + Math.sin(t * 2 + i) * 12;
          rect(x, y, 22, 22, i % 3 ? C.GRASS : C.WATER);
        }
        pixPanel(170, 560, 740, 96, 'rgba(11,16,38,0.95)', C.Y, 5);
        warnSign(240, 610, 0.9);
        text('争议观点 · 你同意吗？', 580, 628, { fam: 'pix', size: 48, color: C.Y, align: 'center' });
      });
    }
  }
  keyword('先自由，后财富', ['自由'], t, tFlip - 0.1, l9.at - 0.25);
  keyword('别太早把自己锁死', ['锁死'], t, l9.at - 0.05, l10.at - 0.2);
  keyword('逐水草而居', ['水草'], t, l10.at, null);
  questClear(t, 2);
}

// ---------------------------------------------------------------- QUEST 4: 身体
function sceneBody(t) {
  backdrop(t);
  const s = SC.body, l11 = LN('l11'), l12 = LN('l12'), l13 = LN('l13');
  questBand(t, 3);
  // part 1: a silicon team multiplying vs one carbon server
  const p1 = 1 - seg(t, l12.at - 0.25, l12.at + 0.1);
  withAlpha(p1, () => {
    const tAI = wordT('l11', 'AI越强'), tBody = wordT('l11', '身体');
    const n = Math.min(12, Math.floor(1 + Math.max(0, t - tAI) * 14));
    for (let i = 0; i < n; i++) {
      const q = i % 3, r = Math.floor(i / 3), k = spring(t - tAI - i * 0.07, 2.5, 7);
      xform(150 + q * 140, 640 + r * 130, k, 0, () => robot(0, 0, 1.0, t + i));
    }
    if (t > tAI) {
      text('硅基团队', 290, 1110, { fam: 'pix', size: 46, color: C.CY, align: 'center' });
      text(`×${n}`, 290, 1166, { fam: 'px', size: 34, color: C.CY, align: 'center' });
    }
    if (t > l11.at) {
      const k = expoOut(seg(t, l11.at, l11.at + 0.4));
      withAlpha(k, () => {
        hero(800, 1060, { t, s: 1.2, face: t > tBody ? 'strain' : 'normal' });
        text('碳基服务器', 800, 1130, { fam: 'pix', size: 46, color: C.Y, align: 'center' });
        // HP bar
        pixPanel(640, 620, 320, 64, 'rgba(11,16,38,0.95)', C.W, 4);
        text('HP', 664, 666, { fam: 'px', size: 22, color: C.W });
        const hp = 1 - 0.55 * seg(t, tBody, tBody + 0.6) + 0.1 * pulse(t, 1.5) * seg(t, tBody, tBody + 0.6);
        rect(720, 638, 220 * hp, 28, hp < 0.6 ? C.PINK : C.GREEN);
        if (t > tBody) withAlpha(pulse(t, 3), () => text('别让它宕机！', 800, 760, { fam: 'pix', size: 44, color: C.PINK, align: 'center' }));
      });
    }
  });
  // part 2: everything gets cheap; lifespan is the only thing that isn't
  const p2 = seg(t, l12.at - 0.2, l12.at + 0.1) * (1 - seg(t, l13.at - 0.25, l13.at + 0.1));
  withAlpha(p2, () => {
    const items = ['翻译', '设计', '写代码', '文案'];
    const tCheap = wordT('l12', '变便宜'), tLife = wordT('l12', '寿命') - 0.15;
    const dim = 1 - 0.65 * seg(t, tLife, tLife + 0.3);
    items.forEach((name, i) => {
      const q = i % 2, r = Math.floor(i / 2), x = 110 + q * 450, y = 560 + r * 200;
      const k = spring(t - l12.at - i * 0.06, 2.3, 7), cut = seg(t, tCheap - 0.35 + i * 0.12, tCheap - 0.15 + i * 0.12);
      withAlpha(dim, () => xform(x + 200, y + 80, k, 0, () => {
        pixPanel(-200, -80, 400, 160, 'rgba(18,26,58,0.95)', C.LINE, 5);
        text(name, -170, -14, { size: 48, w: 900, color: C.W });
        text('¥999', 170, -14, { fam: 'px', size: 30, color: cut > 0 ? C.MUTE : C.W, align: 'right' });
        if (cut > 0) line(40, -26, lerp(40, 180, cut), -26, C.PINK, 6);
        if (cut >= 1) xform(120, 46, spring(t - (tCheap - 0.15 + i * 0.12), 2.6, 7), 0, () => text('¥9', 0, 14, { fam: 'px', size: 40, color: C.GREEN, align: 'center' }));
      }));
    });
    if (t > tLife) {
      const k = spring(t - tLife, 2.2, 7);
      xform(CX, 1040, k, 0, () => {
        withAlpha(0.35 + 0.25 * pulse(t, 2), () => circle(0, 0, 230, 'rgba(255,217,59,0.45)'));
        pixPanel(-240, -130, 480, 260, '#3a2a06', C.Y, 8);
        heart(-140, -10, 48, C.PINK);
        text('寿命', 40, 16, { size: 96, w: 900, color: C.Y, align: 'center' });
        text('唯一值钱', 40, 92, { fam: 'pix', size: 40, color: C.W, align: 'center' });
      });
      burst(t, tLife, { x: CX, y: 1040, n: 24, spd: [400, 1100], life: 0.9, size: 20, colors: [C.Y, C.W], shape: 'star', seed: 9 });
    }
  });
  // part 3: muscle = the body's bank account
  if (t > l13.at - 0.2) {
    const k = expoOut(seg(t, l13.at - 0.2, l13.at + 0.2));
    const sq = Math.max(0, Math.sin((t - l13.at) * Math.PI * 2.2));
    const reps = Math.max(0, Math.floor((t - l13.at) * 2.2 + 0.5));
    withAlpha(k, () => {
      pixPanel(140, 560, 800, 300, '#3a2a06', C.Y, 8);
      text('肌肉账户', 190, 650, { fam: 'pix', size: 58, color: C.Y });
      text('BANK', 890, 640, { fam: 'px', size: 26, color: C.Y2, align: 'right' });
      text('余额', 190, 780, { fam: 'pix', size: 44, color: C.W });
      const bal = 1000 + Math.min(1, Math.max(0, t - l13.at) / 2.6) * 8999;
      odometer(bal, 4, 330, 790, { size: 54, color: C.W });
      rect(190, 812, 700, 6, C.Y2);
      hero(CX, 1170, { t, s: 1.2, squat: sq, face: sq > 0.6 ? 'strain' : 'happy' });
      for (let i = 1; i <= reps; i++) {
        const tt = l13.at + (i - 0.5) / 2.2 + 0.11, a = t - tt;
        if (a > 0 && a < 0.8) withAlpha(1 - a / 0.8, () => text('+1', CX + 170, 940 - a * 160, { fam: 'px', size: 40, color: C.GREEN, align: 'center' }));
      }
    });
  }
  keyword('AI越强，身体越值钱', ['身体越值钱'], t, wordT('l11', 'AI越强') - 0.1, l12.at - 0.25);
  keyword('唯一值钱的：寿命', ['寿命'], t, l12.at - 0.05, l13.at - 0.25);
  keyword('肌肉 = 身体的银行账户', ['银行账户'], t, l13.at - 0.05, null);
  questClear(t, 3);
}

// ---------------------------------------------------------------- END
function sceneEnd(t) {
  backdrop(t);
  const s = SC.end, l14 = LN('l14'), l15 = LN('l15');
  const p1 = 1 - seg(t, l15.at - 0.3, l15.at);
  withAlpha(p1, () => {
    text('通关奖励', CX, 520, { fam: 'pix', size: 56, color: C.CY, align: 'center' });
    pop('多创造', CX, 780, { size: 200, w: 900, t, t0: wordT('l14', '多创造'), stroke: C.INK, strokeW: 30, color: C.Y, stagger: 0.06 });
    pop('少消费', CX, 1010, { size: 200, w: 900, t, t0: wordT('l14', '少消费'), stroke: C.INK, strokeW: 30, color: C.W, stagger: 0.06 });
    const ta = wordT('l14', '多创造');
    if (t > ta) burst(t, ta + 0.1, { x: CX, y: 720, n: 30, spd: [500, 1400], life: 1.0, size: 22, colors: [C.Y, C.CY, C.W, C.PINK], shape: 'star', seed: 11 });
    if (t > l14.at) hero(CX, 1240, { t, s: 0.95, face: 'happy', arm: 1 });
  });
  if (t > l15.at - 0.2) {
    const ask = l15.at - 0.1;
    pop('你最不同意哪一条？', CX, 560, { size: 92, w: 900, t, t0: ask, stagger: 0.03, stroke: C.INK, strokeW: 18, color: i => (i >= 1 && i <= 4 ? C.Y : C.W) });
    QUESTS.forEach((q, i) => {
      const ti = ask + 0.25 + i * 0.12;
      if (t < ti) return;
      const k = expoOut(seg(t, ti, ti + 0.35));
      const hot = Math.floor((t - ask) * 2.2) % 4 === i && t > ask + 0.8;
      const y = 640 + i * 132;
      push(() => {
        c.translate(lerp(-700, 0, k), 0);
        pixPanel(120, y, 760, 112, hot ? '#3a2a06' : 'rgba(18,26,58,0.95)', hot ? C.Y : C.CY, 6);
        text(String(i + 1), 186, y + 76, { fam: 'px', size: 40, color: hot ? C.Y : C.CY, align: 'center' });
        text(q.title, 250, y + 76, { size: 52, w: 900, color: C.W });
      });
    });
    const tc = wordT('l15', '评论区');
    if (t > tc) {
      const bx = Math.sin(t * 8) * 14;
      xform(CX, 1250, spring(t - tc, 2.3, 7), 0, () => {
        text('评论区聊聊', -40, 0, { size: 76, w: 900, color: C.Y, align: 'center', stroke: C.INK, strokeW: 16 });
        c.fillStyle = C.Y; c.beginPath(); c.moveTo(200 + bx, -60); c.lineTo(280 + bx, -26); c.lineTo(200 + bx, 8); c.fill();
      });
    }
  }
  withAlpha(seg(t, s.start + 0.5, s.start + 1.0), () =>
    text('整理自 邵艾伦×孙宇晨 对谈 · 观点仅供参考，不构成任何建议', CX, 1372, { fam: 'zh', size: 28, color: C.MUTE, align: 'center' }));
}

// ---------------------------------------------------------------- HUD
function hudSlot(i) { return [CX - 225 + i * 150, 250, 112]; }
function slotBox(x, y, sz, i, lit, t) {
  const h = sz / 2;
  pixPanel(x - h, y - h, sz, sz, lit ? '#3a2a06' : 'rgba(18,26,58,0.95)', lit ? C.Y : C.LINE, Math.max(3, sz / 28));
  if (lit) {
    text(String(i + 1), x, y + sz * 0.17, { fam: 'px', size: sz * 0.36, color: C.Y, align: 'center' });
  } else {
    text('?', x, y + sz * 0.17, { fam: 'px', size: sz * 0.36, color: C.MUTE, align: 'center' });
  }
}
function hud(t) {
  const bootT = SC.hook.end - 0.25;
  if (t < bootT) return;
  const k = expoOut(seg(t, bootT, bootT + 0.4));
  push(() => {
    c.translate(0, lerp(-200, 0, k));
    // left: level badge
    pixPanel(48, 196, 196, 108, 'rgba(11,16,38,0.92)', C.CY, 5);
    text('LV.20', 146, 246, { fam: 'px', size: 28, color: C.CY, align: 'center' });
    rect(76, 268, 140, 14, C.DIM);
    const xp = QUESTS.filter(q => t > clearT(q) + 0.6).length / 4;
    rect(76, 268, 140 * lerp(0.08, 1, xp), 14, C.GREEN);
    // right: coins
    pixPanel(836, 196, 196, 108, 'rgba(11,16,38,0.92)', C.Y, 5);
    coin(878, 250, 20, t);
    text('1000', 1008, 263, { fam: 'px', size: 24, color: C.Y, align: 'right' });
    // centre: quest slots (appear after the intro hands them over)
    if (t >= SC.intro.end - 0.01) {
      QUESTS.forEach((q, i) => {
        const [x, y, sz] = hudSlot(i);
        const tl = clearT(q) + 0.6;
        const lit = t > tl;
        const active = !lit && t > SC[q.scene].start && t < SC[q.scene].end;
        const bump = lit ? 1 + 0.35 * wobble(t - tl, 3, 6) : 1;
        xform(x, y, bump, 0, () => {
          if (active) withAlpha(0.4 + 0.4 * pulse(t, 2), () => rrect(-sz / 2 - 10, -sz / 2 - 10, sz + 20, sz + 20, 12, C.CY));
          slotBox(0, 0, sz, i, lit, t);
        });
        if (lit && t - tl < 0.8) burst(t, tl, { x, y, n: 14, spd: [200, 600], life: 0.6, size: 12, colors: [C.Y, C.W], shape: 'star', seed: 20 + i });
      });
    }
  });
  // a reward token flies from the pop-up to its slot
  QUESTS.forEach((q, i) => {
    const t0 = clearT(q) + 0.15, t1 = clearT(q) + 0.6;
    if (t < t0 || t > t1) return;
    const k = cubicInOut(seg(t, t0, t1)), [x, y] = hudSlot(i);
    const px = lerp(CX, x, k), py = lerp(860, y, k) - Math.sin(k * Math.PI) * 120;
    star(px, py, lerp(50, 26, k), C.Y, t * 6);
  });
}

const SCENE_FN = { hook: sceneHook, intro: sceneIntro, ai: sceneAI, map: sceneMap, free: sceneFree, body: sceneBody, end: sceneEnd };
Object.assign(window, { SC, LN, wordT, SCENE_FN, hud, QUESTS });
