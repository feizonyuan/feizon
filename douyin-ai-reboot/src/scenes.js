'use strict';
// Scene functions for the editorial cut. Each takes the global time t.
// Timing comes from window.TL (built from the voice-over durations).

const SC = Object.fromEntries(TL.scenes.map(s => [s.id, s]));
const LINES = Object.fromEntries(TL.scenes.flatMap(s => s.lines.map(l => [l.id, l])));
const LN = id => LINES[id];
const lineEnd = id => LINES[id].at + LINES[id].dur;
// Approximate time a substring is spoken, by its character position in the subtitle.
function wordT(id, sub) {
  const l = LINES[id], i = l.zh.indexOf(sub);
  const k = i < 0 ? 0 : [...l.zh.slice(0, i)].length / [...l.zh].length;
  return l.at + l.dur * k;
}
const SECTIONS = [
  { scene: 'ai', title: '先把自己AI化' },
  { scene: 'map', title: '先探图，再决定' },
  { scene: 'free', title: '先自由，后财富' },
  { scene: 'body', title: 'AI越强，身体越值钱' },
];

const TAKE_Y = 1336;

// Section opener: red serif numeral, kicker, headline and a rule.
function sectionHead(t, i) {
  const s = SC[SECTIONS[i].scene], t0 = s.start + 0.05;
  ktext(`0${i + 1}`, MX - 6, 528, { fam: 'num', w: 800, size: 168, t, t0, color: C.RED, stagger: 0.05 });
  ktext(`反常识 · 0${i + 1} / 04`, 304, 402, { fam: 'sans', w: 500, size: 28, t, t0: t0 + 0.1, color: C.GREY, stagger: 0.012 });
  let sz = 74;
  while (measure(SECTIONS[i].title, 'serif', sz, 900) > 690) sz -= 2;
  ktext(SECTIONS[i].title, 304, 494, { size: sz, t, t0: t0 + 0.12, stagger: 0.03 });
  rule(MX, 572, MW, cubicInOut(seg(t, t0 + 0.1, t0 + 0.7)), C.INK, 2);
}

// Takeaway line under the figure: red bar + serif headline, highlighted parts in red.
function takeaway(str, hl, t, t0, out) {
  if (t < t0 || (out != null && t > out + 0.5)) return;
  const chars = [...str], idx = new Set();
  for (const h of hl) { const i0 = str.indexOf(h); if (i0 >= 0) { const s0 = [...str.slice(0, i0)].length; for (let k = 0; k < [...h].length; k++) idx.add(s0 + k); } }
  let sz = 66;
  while (measure(str, 'serif', sz, 900) > MW - 40) sz -= 2;
  const barK = cubicOut(seg(t, t0, t0 + 0.3)) * (out != null ? 1 - seg(t, out, out + 0.3) : 1);
  rect(MX, TAKE_Y - sz * 0.92, 8, sz * 1.08 * barK, C.RED);
  ktext(str, MX + 32, TAKE_Y, { size: sz, t, t0, out, stagger: 0.03, color: i => (idx.has(i) ? C.RED : C.INK) });
}

// Attributed quotation block at the foot of the figure area.
function quote(str, who, t, t0, t1) {
  const a = seg(t, t0, t0 + 0.35) * (1 - seg(t, t1 - 0.25, t1));
  if (a <= 0) return;
  withAlpha(a, () => {
    const rows = wrap(str, 'serif', 31, 700, MW - 56);
    const y0 = 1218 - (rows.length - 1) * 22;
    text('“', MX - 14, y0 + 20, { fam: 'serif', w: 900, size: 64, color: C.RED });
    rows.forEach((r, i) => text(r, MX + 66, y0 + i * 44 - 10 + (1 - cubicOut(a)) * 10, { fam: 'serif', w: 700, size: 31, color: C.INK2 }));
    text(`—— ${who}`, OW - MX, y0 + rows.length * 44 - 4, { fam: 'sans', w: 500, size: 26, color: C.GREY, align: 'right' });
  });
}
// Small grey label.
function label(str, x, y, o = {}) { return text(str, x, y, { fam: 'sans', w: o.w || 500, size: o.size || 28, color: o.color || C.GREY, align: o.align }); }

// ---------------------------------------------------------------- HOOK
function sceneHook(t) {
  paper(t);
  const tPhone = wordT('l01', '一部手机'), tCash = wordT('l01', '1000块'), tQ = wordT('l01', '怎么翻身');
  ktext('一个假设：重新回到', MX, 392, { fam: 'sans', w: 500, size: 32, t, t0: -0.4, color: C.RED, stagger: 0.01 });
  ktext('20岁', MX - 8, 640, { size: 270, t, t0: -0.45, stagger: 0.06 });
  rule(MX, 700, 330, cubicOut(seg(t, 0.05, 0.5)), C.RED, 8);
  // asset ledger
  label('你的全部资产', MX, 790, { size: 30 });
  rule(MX, 812, MW, cubicInOut(seg(t, 0.1, 0.6)), C.INK, 3);
  const rows = [['人脉', '0', 0.2, true], ['资源', '0', 0.5, true], ['手机', '1 部', tPhone, false], ['现金', '¥1,000', tCash, false]];
  rows.forEach(([k, v, ta, zero], i) => {
    const y = 896 + i * 98, a = cubicOut(seg(t, ta, ta + 0.35));
    if (a <= 0) return;
    withAlpha(a, () => {
      const dy = (1 - a) * 16;
      text(k, MX, y + dy, { fam: 'sans', w: 500, size: 46 });
      const vw = measure(v, 'num', 54, 700);
      text(v, OW - MX, y + dy, { fam: 'num', w: 700, size: 54, color: zero ? C.RED : C.INK, align: 'right' });
      line(MX + 120, y - 12, OW - MX - vw - 24, y - 12, C.LIGHT, 2, [3, 9]);
      rule(MX, y + 34, MW, a, C.FAINT, 2);
    });
  });
  if (t > tQ) ktext('怎么翻身？', MX - 4, 1336, { size: 128, t, t0: tQ, color: C.RED, stagger: 0.05 });
}

// ---------------------------------------------------------------- INTRO
function sceneIntro(t) {
  paper(t);
  const s = SC.intro, l = LN('l02');
  const tA = l.at - 0.1, tB = wordT('l02', '邵艾伦'), tH = wordT('l02', '4个多小时'), tC = wordT('l02', '我压成'), tF = wordT('l02', '4个反常识');
  label('对谈双方', MX, 396, { color: C.RED, size: 30 });
  ktext('孙宇晨', MX - 4, 508, { size: 86, t, t0: tA });
  withAlpha(seg(t, tA + 0.2, tA + 0.5), () => label('加密行业创业者', MX, 560, { size: 30 }));
  line(530, 430, 530, lerp(430, 580, cubicOut(seg(t, tA, tA + 0.5))), C.INK, 2);
  ktext('邵艾伦', 570, 508, { size: 86, t, t0: tB });
  withAlpha(seg(t, tB + 0.2, tB + 0.5), () => label('千万粉丝英语博主', 574, 560, { size: 30 }));
  rule(MX, 620, MW, cubicInOut(seg(t, tA, tA + 0.8)), C.INK, 2);
  // duration bars
  if (t > tH) {
    const k1 = cubicInOut(seg(t, tH, tH + 0.7));
    label('原对谈', MX, 712, { size: 32, color: C.INK });
    withAlpha(seg(t, tH + 0.3, tH + 0.6), () => text('4小时22分', OW - MX, 712, { fam: 'num', w: 700, size: 36, align: 'right' }));
    rect(MX, 734, MW * k1, 46, C.INK);
  }
  if (t > tC) {
    const k2 = seg(t, tC + 0.1, tC + 0.4);
    label('本片', MX, 850, { size: 32, color: C.INK });
    withAlpha(k2, () => text('1分钟', OW - MX, 850, { fam: 'num', w: 700, size: 36, align: 'right', color: C.RED }));
    rect(MX, 872, Math.max(6, MW * 60 / 15720) * k2, 46, C.RED);
    withAlpha(seg(t, tC + 0.5, tC + 0.8), () => {
      line(MX + 14, 895, MX + 54, 895, C.RED, 2);
      text('压缩到原来的 0.4%，只留结论', MX + 66, 906, { fam: 'sans', w: 500, size: 30, color: C.RED });
    });
  }
  // table of contents
  if (t > tF - 0.1) {
    ktext('4个反常识', MX - 4, 1046, { size: 60, t, t0: tF - 0.1 });
    rule(MX, 1074, MW, cubicInOut(seg(t, tF, tF + 0.5)), C.INK, 3);
    SECTIONS.forEach((sec, i) => {
      const ti = tF + 0.15 + i * 0.12, y = 1146 + i * 80;
      if (t < ti) return;
      withAlpha(cubicOut(seg(t, ti, ti + 0.3)), () => {
        text(`0${i + 1}`, MX, y, { fam: 'num', w: 800, size: 34, color: C.RED });
        text(sec.title, MX + 84, y, { fam: 'serif', w: 700, size: 42 });
        rule(MX, y + 26, MW, cubicOut(seg(t, ti, ti + 0.5)), C.FAINT, 2);
      });
    });
  }
}

// ---------------------------------------------------------------- 01 AI化
function sceneAI(t) {
  paper(t);
  const l3 = LN('l03'), l4 = LN('l04'), l5 = LN('l05');
  sectionHead(t, 0);
  // definition card (l03)
  const aDef = seg(t, l3.at, l3.at + 0.3) * (1 - seg(t, l4.at - 0.15, l4.at + 0.1));
  withAlpha(aDef, () => {
    label('什么叫“AI化”', MX, 680, { color: C.RED, size: 30 });
    const tx = wordT('l03', 'AI化');
    text('偶尔问 AI 几个问题', MX, 800, { fam: 'serif', w: 700, size: 52, color: C.GREY });
    rule(MX - 6, 784, measure('偶尔问 AI 几个问题', 'serif', 52, 700) + 12, cubicOut(seg(t, tx, tx + 0.35)), C.RED, 4);
    text('✕', OW - MX, 800, { fam: 'sans', w: 700, size: 52, color: C.RED, align: 'right' });
    rule(MX, 850, MW, 1, C.FAINT, 2);
    withAlpha(seg(t, tx + 0.15, tx + 0.45), () => {
      const rows = ['让 AI 进入生活和工作的', '完整流程'];
      rows.forEach((r, i) => text(r, MX, 950 + i * 70, { fam: 'serif', w: 900, size: 56 }));
      text('✓', OW - MX, 950, { fam: 'sans', w: 700, size: 52, color: C.INK, align: 'right' });
    });
  });
  // data rows -> local archive (l04)
  const aRows = seg(t, l4.at - 0.1, l4.at + 0.2) * (1 - seg(t, l5.at - 0.2, l5.at + 0.1));
  const tStore = wordT('l04', '存成');
  withAlpha(aRows, () => {
    label('每天记录', MX, 680, { color: C.RED, size: 30 });
    const rows = [['饮食', '1850', 'kcal', '饮食'], ['训练', '45', 'min', '训练'], ['开销', '32', '元', '开销'], ['睡眠', '7.5', 'h', '全部记下来']];
    rows.forEach(([k, v, u, w], i) => {
      const ta = wordT('l04', w), y = 780 + i * 104, a = cubicOut(seg(t, ta, ta + 0.35));
      if (a <= 0) return;
      withAlpha(a, () => {
        text(k, MX, y, { fam: 'sans', w: 700, size: 40 });
        const pts = []; for (let q = 0; q < 9; q++) pts.push([200 + q * 28, y - 14 - 26 * rnd(i * 13 + q)]);
        path(pts, seg(t, ta, ta + 0.6), C.INK, 3);
        text(v, 548, y, { fam: 'num', w: 700, size: 36, align: 'right' });
        label(u, 556, y, { size: 24 });
        rule(MX, y + 30, 540, a, C.FAINT, 2);
        arrow(626, y - 14, 780, 900, cubicInOut(seg(t, tStore + i * 0.08, tStore + i * 0.08 + 0.35)), C.LIGHT, 2);
      });
    });
    const kd = cubicOut(seg(t, l4.at, l4.at + 0.4));
    withAlpha(kd, () => {
      iconDoc(880, 900, 1.15, C.INK, 4);
      text('个人档案.md', 880, 1020, { fam: 'sans', w: 700, size: 32, align: 'center' });
      label('保存在本地', 880, 1060, { align: 'center', size: 26 });
      if (t > tStore + 0.4) withAlpha(seg(t, tStore + 0.4, tStore + 0.7), () => ring(880, 900, 105, C.RED, 3));
    });
  });
  // architecture: replaceable model layer on top of a permanent data layer (l05)
  const aArch = seg(t, l5.at - 0.1, l5.at + 0.25);
  withAlpha(aArch, () => {
    const by = 670;
    label('模型层', MX, by - 14, { size: 26 });
    strokeRect(MX, by, MW, 130, C.INK, 3);
    const names = ['模型 A', '模型 B', '模型 C', '模型 D'], per = 0.62;
    const u = Math.max(0, t - l5.at) / per, i0 = Math.min(names.length - 1, Math.floor(u)), f = i0 === names.length - 1 ? 0 : cubicInOut(clamp((u - i0 - 0.7) / 0.3));
    push(() => {
      c.beginPath(); c.rect(MX, by, MW, 130); c.clip();
      text(names[i0], CX, by + 86 - f * 130, { fam: 'serif', w: 900, size: 58, align: 'center' });
      if (i0 + 1 < names.length) text(names[i0 + 1], CX, by + 86 + (1 - f) * 130, { fam: 'serif', w: 900, size: 58, align: 'center' });
    });
    text('随时可换 ⇄', OW - MX - 20, by + 80, { fam: 'sans', w: 700, size: 30, color: C.RED, align: 'right' });
    // API connector
    const ka = cubicOut(seg(t, l5.at + 0.2, l5.at + 0.6));
    line(CX, by + 130, CX, lerp(by + 130, by + 230, ka), C.INK, 3);
    withAlpha(ka, () => text('API', CX + 18, by + 192, { fam: 'num', w: 700, size: 28, color: C.GREY }));
    // data layer
    const kd = cubicOut(seg(t, l5.at + 0.3, l5.at + 0.7));
    rect(MX, by + 230, MW * kd, 150, C.INK);
    withAlpha(seg(t, l5.at + 0.5, l5.at + 0.8), () => {
      text('数据层：你的个人档案', CX, by + 300, { fam: 'serif', w: 900, size: 48, color: C.PAPER, align: 'center' });
      text('本地保存 · 长期积累 · 归你所有', CX, by + 350, { fam: 'sans', w: 500, size: 28, color: C.LIGHT, align: 'center' });
    });
  });
  quote('可视化、数据化、可总结化，然后全部搞成Markdown文档。', '孙宇晨', t, l5.at + 0.4, SC.ai.end);
  takeaway('先把自己AI化', ['AI化'], t, wordT('l03', '先把') - 0.1, l5.at - 0.25);
  takeaway('模型可换，数据归你', ['数据归你'], t, l5.at - 0.05, null);
}

// ---------------------------------------------------------------- 02 探图
const DOTS = Array.from({ length: 42 }, (_, i) => [0.05 + 0.9 * rnd(i * 3.3 + 1), 0.08 + 0.84 * rnd(i * 5.1 + 2)]);
const PICKS = [['专业', 0.22, 0.38], ['岗位', 0.45, 0.72], ['行业', 0.64, 0.24], ['城市', 0.84, 0.58]];
function sceneMap(t) {
  paper(t);
  const l6 = LN('l06'), l7 = LN('l07');
  sectionHead(t, 1);
  const tLook = wordT('l06', '先看'), tAI = wordT('l07', '先用AI'), tD = wordT('l07', '再做决定');
  // waffle: 100 houses
  const aW = seg(t, l6.at, l6.at + 0.3) * (1 - seg(t, tAI - 0.25, tAI));
  withAlpha(aW, () => {
    label('买房之前，先看 100 套', MX, 680, { color: C.RED, size: 30 });
    const cell = 44, gap = 7, x0 = MX, y0 = 712;
    const n = Math.floor(100 * cubicInOut(seg(t, tLook, tAI - 0.4)));
    for (let i = 0; i < 100; i++) {
      const q = i % 10, r = Math.floor(i / 10), x = x0 + q * (cell + gap), y = y0 + r * (cell + gap);
      if (i < n) rect(x, y, cell, cell, i === n - 1 ? C.RED : C.INK);
      else strokeRect(x + 1, y + 1, cell - 2, cell - 2, C.LIGHT, 2);
    }
    label('已看', 660, 790, { size: 32 });
    text(String(n), 652, 930, { fam: 'num', w: 800, size: 132 });
    label('/ 100 套', 664, 990, { size: 32 });
    rule(660, 1030, 340, 1, C.FAINT, 2);
    ['样本够多，', '才知道什么叫“好”'].forEach((r, i) => text(r, 660, 1086 + i * 44, { fam: 'sans', w: 500, size: 30, color: C.INK2 }));
  });
  // scatter: scan the whole map, then decide
  const aS = seg(t, tAI - 0.1, tAI + 0.2);
  withAlpha(aS, () => {
    const px = 150, py = 690, pw = 830, ph = 400;
    label('先把选项全部“探”一遍', MX, 680 - 2, { color: C.RED, size: 30 });
    line(px, py + 30, px, py + ph, C.INK, 2); line(px, py + ph, px + pw, py + ph, C.INK, 2);
    label('长期回报 ↑', px + 12, py + 58, { size: 26 });
    label('进入门槛 →', px + pw, py + ph + 40, { size: 26, align: 'right' });
    const scan = px + pw * cubicInOut(seg(t, tAI, tD - 0.05));
    if (t < tD + 0.2) withAlpha(1 - seg(t, tD, tD + 0.2), () => { rect(px, py + 30, scan - px, ph - 30, 'rgba(36,82,122,0.06)'); line(scan, py + 30, scan, py + ph, C.BLUE, 2); });
    for (const [u, v] of DOTS) { const x = px + u * pw, y = py + 30 + v * (ph - 30); if (x < scan) circle(x, y, 7, C.LIGHT); }
    PICKS.forEach(([name, u, v], i) => {
      const x = px + u * pw, y = py + 30 + v * (ph - 30);
      if (x > scan) return;
      const chosen = i === 2 && t > tD;
      circle(x, y, 13, chosen ? C.RED : C.INK);
      text(name, x + 24, y + 12, { fam: 'sans', w: 700, size: 32, color: chosen ? C.RED : C.INK });
      if (chosen) {
        ring(x, y, 26 + 10 * Math.sin((t - tD) * 6) * Math.exp(-(t - tD) * 2), C.RED, 3);
        withAlpha(seg(t, tD + 0.1, tD + 0.4), () => { line(x, y + 30, x, y + 96, C.RED, 2); text('决定', x, y + 134, { fam: 'serif', w: 900, size: 40, color: C.RED, align: 'center' }); });
      }
    });
  });
  quote('做这个决定前先看100套房。你别买，你就看。', '孙宇晨', t, tAI + 0.3, SC.map.end);
  takeaway('买房前，先看100套', ['100套'], t, tLook - 0.1, tAI - 0.25);
  takeaway('先探图，再决定', ['探图'], t, tAI - 0.05, null);
}

// ---------------------------------------------------------------- 03 自由
const CITIES = Array.from({ length: 14 }, (_, i) => [MX + 40 + (MW - 260) * rnd(i * 7.7 + 3), 720 + 380 * rnd(i * 2.9 + 5)]);
const STOPS = [[170, 1050], [400, 800], [640, 990], [840, 760]];
function sceneFree(t) {
  paper(t);
  const l8 = LN('l08'), l9 = LN('l09'), l10 = LN('l10');
  sectionHead(t, 2);
  const tFlip = wordT('l08', '先自由');
  // order flip (l08)
  const aO = seg(t, l8.at - 0.1, l8.at + 0.2) * (1 - seg(t, l9.at - 0.2, l9.at + 0.05));
  withAlpha(aO, () => {
    label('通常的顺序', MX, 690, { size: 30 });
    text('财富 → 自由', MX - 4, 820, { fam: 'serif', w: 900, size: 112, color: t > tFlip ? C.LIGHT : C.INK });
    rule(MX - 6, 784, measure('财富 → 自由', 'serif', 112, 900) + 12, cubicOut(seg(t, tFlip + 0.2, tFlip + 0.5)), C.RED, 5);
    if (t > tFlip) {
      withAlpha(seg(t, tFlip, tFlip + 0.3), () => label('孙宇晨的顺序', MX, 950, { color: C.RED, size: 30 }));
      ktext('自由 → 财富', MX - 4, 1080, { size: 112, t, t0: tFlip, color: i => (i < 2 ? C.RED : C.INK) });
      withAlpha(seg(t, tFlip + 0.5, tFlip + 0.8), () => label('财富只是伴生品', MX, 1140, { size: 30, color: C.INK2 }));
    }
  });
  // option value step chart (l09)
  const aStep = seg(t, l9.at - 0.1, l9.at + 0.2) * (1 - seg(t, l10.at - 0.2, l10.at + 0.05));
  withAlpha(aStep, () => {
    const px = 150, py = 700, pw = 830, ph = 400;
    label('你的选择权', MX, 680, { color: C.RED, size: 30 });
    line(px, py, px, py + ph, C.INK, 2); line(px, py + ph, px + pw, py + ph, C.INK, 2);
    label('高', px - 18, py + 24, { size: 24, align: 'right' }); label('低', px - 18, py + ph, { size: 24, align: 'right' });
    label('人生承诺越来越多 →', px + pw, py + ph + 40, { size: 26, align: 'right' });
    const steps = [['房贷', wordT('l09', '房贷'), 0.42], ['车贷', wordT('l09', '车贷'), 0.62], ['锁死在一地', wordT('l09', '锁死'), 0.82]];
    const pts = [[px, py + ph * 0.1]];
    let lvl = 0.1, xcur = px;
    steps.forEach(([, ts, nl], i) => {
      const x = px + pw * (0.22 + i * 0.28);
      pts.push([x, py + ph * lvl]); pts.push([x, py + ph * nl]); lvl = nl;
    });
    pts.push([px + pw, py + ph * lvl]);
    // progress along the path follows the spoken words
    const tl = [l9.at, ...steps.map(s => s[1]), lineEnd('l09')];
    let k = 0;
    for (let i = 0; i < tl.length - 1; i++) k += seg(t, tl[i], tl[i + 1] - 0.05) / (tl.length - 1);
    path(pts, k, C.INK, 4);
    steps.forEach(([name, ts, nl], i) => {
      if (t < ts) return;
      const x = px + pw * (0.22 + i * 0.28), y = py + ph * nl;
      circle(x, y, 10, C.RED);
      withAlpha(seg(t, ts, ts + 0.25), () => text(name, x + 18, y + 46, { fam: 'sans', w: 700, size: 32, color: C.RED }));
    });
  });
  // follow water and grass (l10)
  const aMap = seg(t, l10.at - 0.1, l10.at + 0.2);
  withAlpha(aMap, () => {
    label('哪里有机会，就去哪里', MX, 680, { color: C.RED, size: 30 });
    for (const [x, y] of CITIES) circle(x, y, 8, C.LIGHT);
    const prog = Math.max(0, t - l10.at) / 0.55;
    const tags = ['新需求', '新技术', '新机会', '新市场'];
    for (let i = 0; i < STOPS.length; i++) {
      const [x, y] = STOPS[i];
      if (i > 0 && prog > i - 1) {
        const [x0, y0] = STOPS[i - 1];
        path([[x0, y0], [x, y]], clamp(prog - (i - 1)), C.RED, 3, [10, 10]);
      }
      if (prog >= i) {
        ring(x, y, 18, C.RED, 3);
        withAlpha(seg(prog, i, i + 0.4), () => text(tags[i], x + 28, y + 10, { fam: 'sans', w: 700, size: 30, color: C.INK }));
      }
    }
    const i0 = Math.min(STOPS.length - 1, Math.floor(prog)), f = clamp(prog - i0);
    const a = STOPS[i0], b = STOPS[Math.min(STOPS.length - 1, i0 + 1)];
    circle(lerp(a[0], b[0], cubicInOut(f)), lerp(a[1], b[1], cubicInOut(f)), 12, C.RED);
  });
  quote('财富自由，其实还是先自由、后财富。财富是一个伴生品。', '孙宇晨', t, l9.at + 0.3, SC.free.end);
  takeaway('先自由，后财富', ['自由'], t, tFlip - 0.1, l9.at - 0.25);
  takeaway('别太早把自己锁死', ['锁死'], t, l9.at - 0.05, l10.at - 0.25);
  takeaway('逐水草而居', ['水草'], t, l10.at - 0.05, null);
}

// ---------------------------------------------------------------- 04 身体
function sceneBody(t) {
  paper(t);
  const l11 = LN('l11'), l12 = LN('l12'), l13 = LN('l13');
  sectionHead(t, 3);
  const tAI = wordT('l11', 'AI越强'), tBody = wordT('l11', '身体');
  // silicon team vs carbon server (l11)
  const a1 = seg(t, l11.at - 0.1, l11.at + 0.2) * (1 - seg(t, l12.at - 0.2, l12.at + 0.05));
  withAlpha(a1, () => {
    text('硅基团队', MX, 700, { fam: 'serif', w: 900, size: 48 });
    const n = Math.min(20, Math.floor(Math.max(0, t - tAI) * 22));
    for (let i = 0; i < 20; i++) {
      const q = i % 5, r = Math.floor(i / 5), x = MX + q * 84, y = 750 + r * 76;
      if (i < n) { rect(x, y, 66, 58, C.INK); text('AI', x + 33, y + 39, { fam: 'num', w: 700, size: 24, color: C.PAPER, align: 'center' }); }
      else strokeRect(x + 1, y + 1, 64, 56, C.FAINT, 2);
    }
    label('可以同时调度几十个', MX, 1088, { size: 28 });
    line(540, 650, 540, 1110, C.FAINT, 2);
    text('碳基服务器', 600, 700, { fam: 'serif', w: 900, size: 48 });
    iconPerson(790, 1010, 1.9, C.INK, 5);
    if (t > tBody) {
      const p = 1 + 0.08 * Math.sin((t - tBody) * 9) * Math.exp(-(t - tBody) * 2);
      iconHeart(790, 950, 22 * p, C.RED);
    }
    withAlpha(seg(t, tBody, tBody + 0.3), () => label('只有一台，不能宕机', 600, 1088, { size: 28, color: C.RED, w: 700 }));
  });
  // everything gets cheaper, lifespan doesn't (l12)
  const tCheap = wordT('l12', '变便宜'), tLife = wordT('l12', '寿命') - 0.15;
  const a2 = seg(t, l12.at - 0.1, l12.at + 0.2) * (1 - seg(t, l13.at - 0.2, l13.at + 0.05));
  withAlpha(a2, () => {
    const px = 170, py = 690, pw = 800, ph = 420;
    label('价值随 AI 普及的变化（示意）', MX, 680, { color: C.RED, size: 30 });
    line(px, py + 20, px, py + ph, C.INK, 2); line(px, py + ph, px + pw, py + ph, C.INK, 2);
    label('现在', px, py + ph + 40, { size: 26 }); label('AI 时代', px + pw, py + ph + 40, { size: 26, align: 'right' });
    const names = ['翻译', '设计', '写代码', '文案'];
    names.forEach((nm, i) => {
      const y0 = py + 130 + i * 56, y1 = py + ph - 30 - i * 18;
      const pts = []; for (let q = 0; q <= 12; q++) { const u = q / 12; pts.push([px + u * pw, lerp(y0, y1, 1 - Math.pow(1 - u, 2.2))]); }
      path(pts, seg(t, l12.at + i * 0.1, tCheap + 0.6 + i * 0.1), C.LIGHT, 4);
      withAlpha(seg(t, l12.at + i * 0.1, l12.at + i * 0.1 + 0.3), () => label(nm, px - 14, y0 + 9, { size: 26, align: 'right', color: C.INK2 }));
    });
    if (t > tLife) {
      path([[px, py + 70], [px + pw, py + 70]], cubicOut(seg(t, tLife, tLife + 0.6)), C.RED, 6);
      withAlpha(seg(t, tLife + 0.2, tLife + 0.5), () => {
        label('寿命', px - 14, py + 79, { size: 30, align: 'right', color: C.RED, w: 700 });
        text('唯一越来越稀缺的', px + pw, py + 50, { fam: 'sans', w: 700, size: 30, color: C.RED, align: 'right' });
      });
    }
  });
  // muscle = the body's bank account (l13)
  const a3 = seg(t, l13.at - 0.1, l13.at + 0.2);
  withAlpha(a3, () => {
    text('肌肉账户 · 对账单', MX, 700, { fam: 'serif', w: 900, size: 52 });
    rule(MX, 730, MW, a3, C.INK, 3);
    const rows = ['力量训练', '合理饮食', '睡眠恢复'];
    rows.forEach((r, i) => {
      const ti = l13.at + 0.15 + i * 0.3, y = 806 + i * 82;
      if (t < ti) return;
      withAlpha(cubicOut(seg(t, ti, ti + 0.3)), () => {
        text(r, MX, y, { fam: 'sans', w: 500, size: 38 });
        text('存入', OW - MX, y, { fam: 'sans', w: 700, size: 36, color: C.RED, align: 'right' });
        rule(MX, y + 28, MW, 1, C.FAINT, 2);
      });
    });
    const tb = l13.at + 1.0;
    if (t > tb) {
      text('余额', MX, 1076, { fam: 'sans', w: 700, size: 40 });
      rect(220, 1044, 780 * cubicOut(seg(t, tb, tb + 1.2)), 40, C.RED);
    }
  });
  quote('物质上可能是个富人，但是身体上是个穷人。', '孙宇晨', t, l12.at + 0.3, SC.body.end);
  takeaway('AI越强，身体越值钱', ['身体越值钱'], t, tAI - 0.1, l12.at - 0.25);
  takeaway('唯一稀缺的，是寿命', ['寿命'], t, l12.at - 0.05, l13.at - 0.25);
  takeaway('肌肉是身体的银行账户', ['银行账户'], t, l13.at - 0.05, null);
}

// ---------------------------------------------------------------- END
function sceneEnd(t) {
  paper(t);
  const s = SC.end, l14 = LN('l14'), l15 = LN('l15');
  const tA = wordT('l14', '多创造'), tB = wordT('l14', '少消费');
  const a1 = 1 - seg(t, l15.at - 0.3, l15.at);
  withAlpha(a1, () => {
    label('一句话总结', MX, 520, { color: C.RED, size: 32 });
    rule(MX, 548, MW, cubicInOut(seg(t, l14.at, l14.at + 0.6)), C.INK, 3);
    ktext('多创造，', MX - 8, 790, { size: 180, t, t0: tA - 0.05, stagger: 0.05 });
    ktext('少消费。', MX - 8, 1010, { size: 180, t, t0: tB - 0.05, stagger: 0.05, color: C.RED });
    quote('多创造，少消费，然后你做什么基本上都是对的。', '孙宇晨', t, tB + 0.3, l15.at);
  });
  if (t > l15.at - 0.25) {
    const ask = l15.at - 0.2;
    ktext('你最不同意哪一条？', MX - 4, 520, { size: 76, t, t0: ask, color: i => (i >= 1 && i <= 4 ? C.RED : C.INK) });
    rule(MX, 560, MW, cubicInOut(seg(t, ask, ask + 0.6)), C.INK, 3);
    SECTIONS.forEach((sec, i) => {
      const ti = ask + 0.2 + i * 0.12, y = 664 + i * 118;
      if (t < ti) return;
      const hot = t > ask + 1.0 && Math.floor((t - ask - 1.0) * 1.6) % 4 === i;
      withAlpha(cubicOut(seg(t, ti, ti + 0.3)), () => {
        if (hot) rect(MX - 16, y - 66, MW + 32, 100, C.PAPER2);
        strokeRect(MX, y - 42, 44, 44, hot ? C.RED : C.INK, 3);
        if (hot) { rect(MX + 8, y - 34, 28, 28, C.RED); }
        text(`0${i + 1}`, MX + 72, y, { fam: 'num', w: 800, size: 34, color: C.RED });
        text(sec.title, MX + 144, y, { fam: 'serif', w: 900, size: 50 });
        rule(MX, y + 34, MW, 1, C.FAINT, 2);
      });
    });
    const tc = wordT('l15', '评论区');
    if (t > tc) {
      ktext('评论区聊聊', MX - 2, 1200, { fam: 'sans', w: 900, size: 64, t, t0: tc, color: C.RED });
      withAlpha(seg(t, tc + 0.2, tc + 0.4), () => arrow(MX + 360, 1178, MX + 460 + 12 * Math.sin(t * 6), 1178, 1, C.RED, 5));
    }
  }
  withAlpha(seg(t, s.start + 0.6, s.start + 1.1), () =>
    label('内容整理自邵艾伦×孙宇晨对谈 · 观点仅供参考，不构成任何建议', MX, 1290, { size: 26 }));
}

// ---------------------------------------------------------------- masthead
function masthead(t) {
  rect(MX, 206, 12, 40, C.RED);
  text('精读', MX + 28, 240, { fam: 'sans', w: 900, size: 34 });
  text('BRIEFING', MX + 106, 238, { fam: 'num', w: 700, size: 22, color: C.GREY, track: 0.12 });
  text('邵艾伦 × 孙宇晨 · 4小时对谈', OW - MX, 238, { fam: 'sans', w: 500, size: 26, color: C.GREY, align: 'right' });
  rect(MX, 268, MW, 3, C.INK);
  // section progress
  const w = (MW - 3 * 12) / 4;
  SECTIONS.forEach((sec, i) => {
    const s = SC[sec.scene], x = MX + i * (w + 12);
    const k = seg(t, s.start, s.end);
    rect(x, 292, w, 6, C.FAINT);
    if (k > 0) rect(x, 292, w * k, 6, k >= 1 ? C.INK : C.RED);
  });
}

const SCENE_FN = { hook: sceneHook, intro: sceneIntro, ai: sceneAI, map: sceneMap, free: sceneFree, body: sceneBody, end: sceneEnd };
Object.assign(window, { SC, LN, wordT, SCENE_FN, masthead, SECTIONS });
