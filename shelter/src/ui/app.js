// 主程序：首页，以及可以到处走动的游戏画面。
import {
  RULES,
  newState,
  monthOf,
  daysToBill,
  hourNow,
  skilled,
  loanLimit,
  clockText,
  work,
  repairJob,
  study,
  buyBento,
  buyGroceries,
  cook,
  buyTea,
  sitBench,
  fishWithChen,
  lesson,
  buyVending,
  sellVending,
  takePhone,
  takeEbike,
  borrow,
  repay,
  scamVisible,
  investScam,
  moveBack,
  passiveIncome,
  fixedCosts,
  balanceSheet,
  endDay,
} from '../game/state.js';
import { T, art } from '../game/art.js';
import { roomArt } from '../game/roomart.js';
import { WATER, PATH, PAVE, ROAD, ROAD_Y, CROSSINGS, HOME_DOOR, BUNK_DOOR, GURU, VENDING_SPOTS, ROOM_ZONES, ROOM_PARTITION, key, buildStreet, buildRoom } from '../game/map.js';
import { LESSONS, CHEN_IDLE, CHEN_DONE, INTRO, qiangLine, liliLine } from '../game/story.js';
import { ICONS } from './icons.js';

const SAVE_KEY = 'plan.save.v2';
const root = document.getElementById('app');

const store = {
  read(k) {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  write(k, value) {
    try {
      if (value === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(value));
    } catch {
      /* 存不了就不存，游戏照常进行 */
    }
  },
};

const app = { screen: 'home', s: null };

// 运行时状态，不存档
const rt = {
  street: null,
  room: null,
  where: 'out',
  p: { x: HOME_DOOR.x, y: HOME_DOOR.y, dir: 0, step: 0 },
  keys: new Set(),
  stick: null,
  hover: null,
  paused: false,
  target: null,
  floats: [],
  cars: [],
  walkers: [],
  time: 0,
  last: 0,
  raf: 0,
  hudAt: 0,
  saveAt: 0,
  view: { cx: 0, cy: 0, zoom: 3, w: 0, h: 0 },
};

const DIRS = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
];
const signed = (n) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));
const pick = (list, n) => list[Math.abs(n) % list.length];

/* ---------- 声音：用振荡器合成的短音 ---------- */

let audio = null;
function sfx(kind) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const [freq, to, len, type] = {
      step: [170, 120, 0.04, 'triangle'],
      pick: [520, 880, 0.1, 'triangle'],
      coin: [880, 1320, 0.14, 'square'],
      bad: [200, 110, 0.2, 'sawtooth'],
      ok: [440, 660, 0.12, 'triangle'],
      tick: [900, 900, 0.03, 'square'],
    }[kind];
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(to, audio.currentTime + len);
    g.gain.setValueAtTime(0.05, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + len);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + len);
  } catch {
    /* 没有声音也能玩 */
  }
}

/* ---------- 存档与画面切换 ---------- */

function save() {
  if (app.s) store.write(SAVE_KEY, app.s);
}

function boot(data = {}) {
  app.s = data.s ?? store.read(SAVE_KEY);
  if (app.s && app.s.v !== 2) app.s = null;
  show('home');
}

function show(screen) {
  cancelAnimationFrame(rt.raf);
  app.screen = screen;
  root.className = `screen-${screen}`;
  if (screen === 'home') root.innerHTML = homeHtml();
  else mountGame();
}

function homeHtml() {
  const s = app.s;
  return `<div class="home">
    <header class="masthead">
      <p class="stamp">城市边上的老街 · 一套老旧的出租屋</p>
      <h1>躺平计划<span>现金流物语</span></h1>
      <p class="lede">没有文凭，没有手艺，没有人托底。你唯一能拿去换钱的，是自己的时间。这个游戏没有“奋斗”或“躺平”的路线可选，只有每一天：这十六个钟头，你拿去做什么。</p>
    </header>
    <div class="stack">
      ${
        s
          ? `<button class="resume" data-act="continue"><span><b>接着过日子</b><small>第 ${monthOf(s)} 个月 · 第 ${s.day} 天 · 手里有 ${s.cash} 元${s.debt ? ` · 欠 ${s.debt}` : ''}</small></span><i>${ICONS.arrow}</i></button>`
          : ''
      }
      <button class="btn ${s ? '' : 'primary'} wide big-btn" data-act="start">${s ? '重新开始' : '闹钟响了'}</button>
    </div>
    <section class="rules">
      <h2 class="label">怎么玩</h2>
      <ol>
        <li><span><b>走动。</b>电脑用 WASD 或方向键；手机按住屏幕拖动。</span></li>
        <li><span><b>动手。</b>走到门口、人或东西跟前，按空格、点鼠标，或点右下角的按钮。</span></li>
        <li><span><b>时间。</b>每天从 7 点到 23 点。打工、上课、吃饭都要花掉几个钟头，走路也在走表。</span></li>
        <li><span><b>账单日。</b>每 5 天算一个月。月底交房租，各种分期一起扣款。</span></li>
        <li><span><b>手机。</b>按 Tab 或点“手机”，看账本、借钱、看这个月的时间花在了哪儿。</span></li>
      </ol>
    </section>
    <p class="fine">进度自动保存在这台设备的浏览器里。画面一开始是灰的，这是有意的。</p>
  </div>`;
}

function mountGame() {
  const s = app.s;
  root.innerHTML = `<div class="play">
    <canvas id="view" aria-label="游戏画面"></canvas>
    <div class="hud-l" id="hud-l"></div>
    <div class="hud-r" id="hud-r"></div>
    <div class="keyhint" id="hint" hidden></div>
    <button class="act" id="act" data-act="use" hidden></button>
    <div id="layer"></div>
  </div>`;
  rt.street = buildStreet(s.seed);
  rt.room = buildRoom();
  rt.floats = [];
  rt.keys.clear();
  rt.stick = null;
  rt.cars = [0, 1, 2, 3, 4].map((i) => ({ x: (i * 17) % 66, lane: i % 2, kind: i % 4, speed: 5 + (i % 3) }));
  rt.walkers = [0, 1, 2].map((i) => ({ x: 6 + i * 21, y: i === 1 ? 16.6 : 10.6, dir: i % 2 ? 1 : -1, kind: i, step: 0, pause: 0 }));
  if (s.minutes === 0) wakeUp();
  else goOutside();
  bindCanvas(document.getElementById('view'));
  hud();
  rt.last = performance.now();
  rt.raf = requestAnimationFrame(frame);
  if (s.day === 1 && s.minutes === 0) layer(introHtml());
  else layer('');
}

// 早上醒来的位置：出租屋的床边，或者床位房门口。
function wakeUp() {
  if (app.s.home === 'room') {
    rt.where = 'in';
    rt.p.x = rt.room.bedside.x;
    rt.p.y = rt.room.bedside.y;
    rt.p.dir = 0;
  } else {
    rt.where = 'out';
    rt.p.x = BUNK_DOOR.x;
    rt.p.y = BUNK_DOOR.y;
    rt.p.dir = 0;
  }
  rt.hover = null;
}

function goOutside() {
  rt.where = 'out';
  rt.p.x = HOME_DOOR.x;
  rt.p.y = HOME_DOOR.y;
  rt.p.dir = 0;
  rt.hover = null;
}

function enterRoom() {
  rt.where = 'in';
  rt.p.x = rt.room.spawn.x;
  rt.p.y = rt.room.spawn.y;
  rt.p.dir = 1;
  rt.hover = null;
}

/* ---------- HUD ---------- */

function meter(label, value, cls) {
  return `<div class="meter ${cls} ${value < 30 ? 'low' : ''}"><span>${label}</span><div><i style="width:${Math.round(value)}%"></i></div></div>`;
}

// 画面的鲜艳程度：跟着心力和“被动收入盖住固定开销的比例”走。
function colour(s) {
  if (s.won) return 1;
  const cover = Math.min(1, passiveIncome(s) / fixedCosts(s).total);
  return 0.3 + 0.7 * (0.62 * (s.sanity / 100) + 0.38 * cover);
}

function hud() {
  const s = app.s;
  const left = document.getElementById('hud-l');
  if (!s || !left) return;
  const fixed = fixedCosts(s);
  const toBill = daysToBill(s);
  const short = s.cash < fixed.total - fixed.interest;
  left.innerHTML = `
    <div class="when"><b>第 ${s.day} 天</b><span id="clock">${clockText(s)}</span></div>
    <div class="purse"><img alt="" src="${art().coin.toDataURL()}"><b>${s.cash}</b>${s.debt ? `<span class="owe">欠 ${s.debt}</span>` : ''}</div>
    <div class="rentline ${toBill <= 2 && short ? 'warn' : ''}">${toBill === 1 ? '明早' : `${toBill} 天后`}是账单日，要付 ${fixed.total - fixed.interest}</div>`;
  document.getElementById('hud-r').innerHTML = `
    ${meter('体力', s.energy, 'en')}${meter('饱食', s.fullness, 'fo')}${meter('心力', s.sanity, 'mo')}
    ${s.groceries ? `<div class="pantry">食材 ×${s.groceries}</div>` : ''}
    <div class="hud-btns">
      <button class="btn small" data-act="phone">手机</button>
      <button class="icon-btn" data-act="menu" aria-label="菜单">${ICONS.menu}</button>
    </div>`;
  const view = document.getElementById('view');
  if (view) view.style.filter = `saturate(${colour(s).toFixed(2)})`;
}

function layer(html) {
  const el = document.getElementById('layer');
  if (!el) return;
  el.innerHTML = html;
  rt.paused = html !== '';
  rt.keys.clear();
  rt.stick = null;
  if (!rt.paused) hud();
}

let toastTimer;
function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---------- 花时间做一件事 ---------- */

// 执行一个规则里的动作。成功的话让画面暗一下表示时间过去，再报出变化。
function spend(fn, title, after) {
  const s = app.s;
  const before = { cash: s.cash, energy: s.energy, sanity: s.sanity, fullness: s.fullness, minutes: s.minutes };
  const error = fn(s);
  if (typeof error === 'string') {
    sfx('bad');
    toast(error);
    return false;
  }
  const hours = (s.minutes - before.minutes) / 60;
  const parts = [];
  if (s.cash !== before.cash) parts.push(`${signed(s.cash - before.cash)} 元`);
  if (s.energy !== before.energy) parts.push(`体力 ${signed(s.energy - before.energy)}`);
  if (s.sanity !== before.sanity) parts.push(`心力 ${signed(s.sanity - before.sanity)}`);
  if (s.fullness !== before.fullness) parts.push(`饱食 ${signed(s.fullness - before.fullness)}`);
  const summary = parts.join(' · ');
  save();
  if (hours >= 1) {
    layer(`<div class="pass"><div><p class="pass-title">${title}</p><p class="pass-time">${hours} 个钟头过去了</p><p class="pass-sum">${summary}</p></div></div>`);
    sfx('tick');
    setTimeout(() => {
      layer('');
      sfx(s.cash > before.cash ? 'coin' : 'ok');
      after?.();
    }, 1100);
  } else {
    layer('');
    sfx(s.cash > before.cash ? 'coin' : 'ok');
    toast(`${title}　${summary}`);
    after?.();
  }
  return true;
}

/* ---------- 地图查询 ---------- */

const here = () => (rt.where === 'in' ? rt.room : rt.street);
const guruHere = () => scamVisible(app.s);

function solidAt(x, y) {
  const m = here();
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  if (m.solid[y * m.w + x]) return true;
  if (rt.where === 'in') return false;
  if (x === GURU.x && y === GURU.y && guruHere()) return true;
  return VENDING_SPOTS.slice(0, app.s.machines).some((v) => v.x === x && v.y === y);
}

function blocked(x, y) {
  for (const [dx, dy] of [
    [-0.28, -0.1],
    [0.28, -0.1],
    [-0.28, 0.38],
    [0.28, 0.38],
  ]) {
    if (solidAt(Math.floor(x + dx), Math.floor(y + dy))) return true;
  }
  return false;
}

function moveBody(b, dx, dy) {
  if (dx && !blocked(b.x + dx, b.y)) b.x += dx;
  if (dy && !blocked(b.x, b.y + dy)) b.y += dy;
}

function facingTile() {
  const p = rt.p;
  if (rt.hover) {
    const d = Math.hypot(rt.hover.x + 0.5 - p.x, rt.hover.y + 0.5 - (p.y + 0.1));
    if (d < 1.8) return rt.hover;
  }
  const [dx, dy] = DIRS[p.dir];
  return { x: Math.floor(p.x + dx * 0.8), y: Math.floor(p.y + 0.12 + dy * 0.8) };
}

/* ---------- 面前这一格能做什么 ---------- */

function findTarget() {
  const s = app.s;
  const tile = facingTile();
  const it = here().inter.get(key(tile.x, tile.y));
  if (!it) return null;
  const make = (label, run) => ({ ...tile, label, run });
  switch (it.type) {
    case 'bed':
      return make('睡觉', () => layer(sleepHtml()));
    case 'stove':
      return make(s.groceries ? '做饭' : '灶台（没有食材）', () => spend(cook, '自己做了顿饭'));
    case 'desk':
      return make('坐下发会儿呆', () => spend(sitBench, '对着窗户坐了一会儿'));
    case 'sofa':
      return make('在沙发上瘫一会儿', () => spend(sitBench, '在沙发上瘫了一会儿'));
    case 'fridge':
      return make('看冰箱', () => toast(s.groceries ? `冰箱里有 ${s.groceries} 份食材。门上贴着一张便签：记得交房租。` : '冰箱是空的，只有半瓶老干妈。门上贴着一张便签：记得交房租。'));
    case 'look':
      return make(it.label, () => toast(it.text));
    case 'exit':
      return make('出门', goOutside);
    case 'home':
      return s.home === 'room' ? make('回出租屋', enterRoom) : make('找房东', () => layer(landlordHtml()));
    case 'bunk':
      return s.home === 'bunk' ? make('回床位睡觉', () => layer(sleepHtml())) : make('床位房', () => toast('八个人一间，按天收钱。门口的人打量了你一眼。希望你用不上这儿。'));
    case 'store':
      return make('进便利店', () => layer(sheet(storeSheet())));
    case 'diner':
      return make('进快餐店', () => layer(dinerHtml()));
    case 'tea':
      return make(s.sanity < RULES.lowSanity ? '来一杯！' : '买奶茶', () => layer(teaHtml()));
    case 'school':
      return make('进夜校', () => layer(schoolHtml()));
    case 'bench':
      return make('坐一会儿', () => spend(sitBench, '在长椅上坐了一会儿'));
    case 'pond':
      return make(s.lessons >= RULES.fishing.lessons ? '钓鱼' : '池塘', () => {
        if (s.lessons < RULES.fishing.lessons) return toast('水很清。老陈的浮标一动不动。');
        spend(fishWithChen, '和老陈钓了一下午鱼');
      });
    case 'sign':
      return make(it.label, () => toast(it.text));
    case 'npc':
      if (it.id === 'guru' && !guruHere()) return null;
      return make(it.label, () => talk(it.id));
  }
  return null;
}

function use() {
  if (rt.paused) return;
  const t = findTarget();
  if (t) t.run();
}

/* ---------- 睡觉与早晨 ---------- */

function sleep(forced = false) {
  layer('<div class="fade night"></div>');
  setTimeout(() => {
    const s = app.s;
    const report = endDay(s);
    wakeUp();
    save();
    hud();
    layer(morningHtml(report, forced));
  }, 650);
}

/* ---------- 对话框 ---------- */

const sheet = (body) => `<div class="overlay" data-act="close"><div class="sheet" role="dialog" aria-modal="true">
  <button class="icon-btn close" data-act="close" data-close aria-label="关闭">${ICONS.close}</button>${body}</div></div>`;

function dialog(title, body, buttons, stamp = '') {
  return `<div class="overlay"><div class="dialog" role="dialog" aria-modal="true">
    ${stamp ? `<p class="stamp">${stamp}</p>` : ''}<h2>${title}</h2>${body}
    <div class="stack">${buttons
      .map(([label, actName, cls = '', extra = '']) => `<button class="btn wide ${cls}" data-act="${actName}" ${extra} ${actName === 'close' ? 'data-close' : ''}>${label}</button>`)
      .join('')}</div>
  </div></div>`;
}

const lines = (list) => list.map((t) => `<p class="say">${t}</p>`).join('');

function introHtml() {
  return dialog('7:00', lines(INTRO) + '<p class="hint">出了楼门往右走，先是便利店，再是快餐店。马路对面是公园。</p>', [['起床', 'close', 'primary']], '第 1 天');
}

function sleepHtml() {
  const s = app.s;
  const early = hourNow(s) < 20;
  return dialog(
    '睡觉',
    `<p>睡一觉就到明天早上 7 点。${s.fullness < 30 ? '你现在饿着肚子，睡醒体力恢复不过来。' : ''}</p>
     ${early ? `<p class="hint">现在才 ${clockText(s)}，今天还剩 ${Math.floor(RULES.dayHours - s.minutes / 60)} 个钟头。睡了，它们就没了。</p>` : ''}`,
    [
      ['睡到明天', 'sleep', 'primary'],
      ['再等等', 'close'],
    ],
    `第 ${s.day} 天 · ${clockText(s)}`,
  );
}

function entries(list) {
  if (!list.length) return '';
  return `<ul class="feed">${list.map((e) => `<li class="entry ${e.tone}"><span>${e.text}</span>${e.delta ? `<b>${signed(e.delta)}</b>` : ''}</li>`).join('')}</ul>`;
}

const row = (label, n, tone = '') => (n ? `<div><dt>${label}</dt><dd class="${tone}">${n}</dd></div>` : '');

function flowRows(list, sign) {
  if (!list.length) return `<li class="none">${sign > 0 ? '还没有每个月往里流钱的东西' : '没有每个月往外流钱的东西'}</li>`;
  return list
    .map(
      (a) => `<li><span>${a.name}${a.left ? `<small>还剩 ${a.left} 期</small>` : ''}${a.doubt ? '<small>他说的</small>' : ''}</span>
        <b class="${a.flow >= 0 ? 'good' : 'bad'}">每月 ${signed(a.flow)}</b></li>`,
    )
    .join('');
}

function sheetHtml(sheetData) {
  return `<div class="two">
    <div><h4>往里流钱的</h4><ul class="flows">${flowRows(sheetData.assets, 1)}</ul></div>
    <div><h4>往外流钱的</h4><ul class="flows">${flowRows(sheetData.liabilities, -1)}</ul></div>
  </div>`;
}

const HOUR_KINDS = [
  ['work', '打工', 'h-work'],
  ['study', '上课', 'h-study'],
  ['rest', '歇着', 'h-rest'],
  ['fun', '花钱找乐子', 'h-fun'],
  ['chores', '吃饭做饭', 'h-chores'],
];

function hoursHtml(hours, days) {
  const total = Math.max(1, days) * RULES.dayHours;
  const used = HOUR_KINDS.reduce((sum, [k]) => sum + hours[k], 0);
  const other = Math.max(0, total - used);
  const bar = [...HOUR_KINDS.map(([k, , cls]) => [hours[k], cls]), [other, 'h-other']]
    .filter(([n]) => n > 0)
    .map(([n, cls]) => `<i class="${cls}" style="flex:${n}"></i>`)
    .join('');
  const legend = [...HOUR_KINDS.map(([k, label, cls]) => [hours[k], label, cls]), [other, '走路和别的', 'h-other']]
    .filter(([n]) => n > 0)
    .map(([n, label, cls]) => `<li><i class="${cls}"></i>${label} <b>${Math.round(n * 10) / 10}</b> 小时</li>`)
    .join('');
  return `<div class="hours"><div class="hbar">${bar}</div><ul>${legend}</ul></div>`;
}

function billHtml(b) {
  const s = app.s;
  if (!s.ledger) {
    return `<section class="review">
      <p class="stamp">第 ${b.month} 个月过完了</p>
      <h3>${b.bankrupt ? `房租没交上，欠 ${b.debt}` : b.borrowed ? `借了 ${b.borrowed} 才交上房租` : `交完房租，还剩 ${b.cash}`}</h3>
      <p>这个月的钱是怎么来的、花到哪儿去了，你说不上来。只知道月底又差不多见底。</p>
      ${entries(b.notes)}
    </section>`;
  }
  const i = b.income;
  const x = b.spend;
  return `<section class="review">
    <p class="stamp">第 ${b.month} 个月的账</p>
    <h3 class="${b.net >= 0 ? 'pos' : 'neg'}">这个月净${b.net >= 0 ? '剩' : '亏'} ${Math.abs(b.net)}</h3>
    <dl class="tally">
      ${row('快餐店的工钱', i.wage, 'good')}${row('修东西挣的', i.repair, 'good')}${row('售货机自己挣的', i.passive, 'good')}${row('稳盈宝的“分红”', i.scam, 'good')}
      ${row('房租', x.rent, 'bad')}${row('分期还款', x.installments, 'bad')}${row('电动车充电保养', x.upkeep, 'bad')}${row('闪电贷利息', x.interest, 'bad')}
      ${row('吃饭', x.food, 'bad')}${row('奶茶', x.fun, 'bad')}${row('学费', x.study, 'bad')}${row('看病', x.medical, 'bad')}
    </dl>
    ${b.invested ? `<p class="hint">另外有 ${b.invested} 拿去换了别的东西，记在下面这张表里，不算花掉。</p>` : ''}
    ${sheetHtml(b.sheet)}
    <h4>这个月的 ${b.days * RULES.dayHours} 个钟头</h4>
    ${hoursHtml(b.hours, b.days)}
    <div class="flow big"><div class="track"><div class="fill ${b.covered ? 'full' : ''}" style="width:${Math.min(100, (b.passive / Math.max(1, b.outflow)) * 100).toFixed(0)}%"></div></div>
      <span>不干活也会进来的钱 <b class="good">${b.passive}</b>，这个月不得不花的钱 <b class="bad">${b.outflow}</b>${b.covered ? `。已经连续 ${b.streak} 个月盖住了。` : ''}</span></div>
    ${entries(b.notes)}
  </section>`;
}

function morningHtml(report, forced) {
  const s = app.s;
  const b = report.bill;
  const won = report.won
    ? `<section class="review free"><p class="stamp">连续三个月</p><h3>你把时间赎回来了</h3>
        <p>售货机每个月自己挣的钱，已经连续三个月盖过了你不得不花的钱。从今天起，闹钟可以关了。去不去上班，由你定。</p>
        <p class="real">这不等于有很多钱。它的意思是：你不必再为了活下去而出卖时间。日子还在继续，接下来的每一天仍然是你自己的。</p></section>`
    : '';
  const bust = b?.bankrupt
    ? `<section class="review bust"><p class="stamp">账单日</p><h3>钱不够，也借不到了</h3>
        <p>你现在住在巷子里的床位房，一个月 ${RULES.bunkRent}。欠的钱还在账上，利息照算。</p>
        <p class="real">日子没有结束。攒够 ${RULES.deposit} 的押金，可以去找房东搬回来。</p></section>`
    : '';
  return `<div class="overlay"><div class="dialog morning" role="dialog" aria-modal="true">
    <p class="stamp">${b ? '账单日 · ' : ''}早上 7:00</p><h2>第 ${s.day} 天</h2>
    ${forced ? '<p class="hint">昨晚 11 点你还在外面晃，回去倒头就睡了。</p>' : ''}
    ${entries(report.lines)}
    ${won}${bust}${b ? billHtml(b) : ''}
    <p class="stockline">手里有 <b>${s.cash}</b> 元${s.debt ? `，欠 <b class="owe-text">${s.debt}</b>` : ''}</p>
    <button class="btn primary wide" data-act="close" data-close>起床</button>
  </div></div>`;
}

/* ---------- 各个地方 ---------- */

function storeSheet() {
  const s = app.s;
  const v = RULES.vending;
  const rows = [
    ['bento', '便当', `现成的，吃了饱食 +${RULES.bento.fullness}，花半个钟头`, RULES.bento.price, s.cash < RULES.bento.price],
    ['grocery', '一份食材', `回屋自己做，要花 1 个钟头，饱食 +${RULES.cook.fullness}，心力 +${RULES.cook.sanity}`, RULES.grocery.price, s.cash < RULES.grocery.price],
    ['grocery4', '四份食材', '够吃两天', RULES.grocery.price * 4, s.cash < RULES.grocery.price * 4],
  ]
    .map(
      ([id, name, note, cost, off]) => `<li><div class="what"><b>${name}</b><small>${note}</small></div>
        <button class="btn primary" data-act="store" data-id="${id}" ${off ? 'disabled' : ''}><span>${cost}</span><small>买</small></button></li>`,
    )
    .join('');
  const full = s.machines >= v.max;
  return `<p class="stamp">便利店 · 24 小时</p><h2>买点什么</h2>
    <ul class="catalog">${rows}</ul>
    <h3 class="label">老板说</h3>
    <p class="say">${full ? '这条街能摆机器的地方，都让你占了。' : '门口有块空地。你要是出钱买台二手售货机摆着，货我来补，卖的钱咱们分。'}</p>
    <ul class="catalog"><li><img class="thumb tall" alt="" src="${art().vending[0].toDataURL()}"><div class="what"><b>二手自动售货机</b><small>每个账单日分给你 ${v.income}，不用你管。你现在有 ${s.machines} 台。</small><small class="pay">约 ${Math.ceil(v.cost / v.income)} 个月回本；急用钱时只能卖 ${v.resale}</small></div>
      <button class="btn primary" data-act="vending" ${full || s.cash < v.cost ? 'disabled' : ''}><span>${v.cost}</span><small>${full ? '没位置' : s.cash < v.cost ? `差 ${v.cost - s.cash}` : '买'}</small></button></li></ul>
    <p class="hint">你有 ${s.cash} 元${s.groceries ? `，屋里还有 ${s.groceries} 份食材` : ''}。</p>`;
}

function dinerHtml() {
  const s = app.s;
  const j = RULES.job;
  return dialog(
    '阿福快餐',
    `<p class="say">店长头也不抬：“排班表在墙上。一班 ${j.hours} 个钟头，${j.pay} 块，当天结。”</p>
     <p class="hint">体力 −${j.energy}，心力 −${j.sanity}。干多久都是这个价。今天已经干了 ${s.today.work} 个钟头。</p>`,
    [
      [`上一班（${j.hours} 小时，+${j.pay}）`, 'work', 'primary'],
      ['先不干', 'close'],
    ],
    `${clockText(s)} · 营业到 ${j.close}:00`,
  );
}

function teaHtml() {
  const s = app.s;
  const t = RULES.tea;
  const low = s.sanity < RULES.lowSanity;
  return dialog(
    '一口甜',
    `<p class="say">${low ? '招牌上的灯好像比平时亮。甜味隔着玻璃都闻得到。' : '店员在摇杯子。'}</p>
     <p class="hint">一杯 ${t.price} 元，心力立刻 +${t.sanity}。公园的长椅不要钱，坐 1 个钟头心力 +${RULES.bench.sanity}。</p>`,
    [
      [`来一杯（${t.price}）`, 'tea', 'primary'],
      ['算了', 'close'],
    ],
  );
}

function schoolHtml() {
  const s = app.s;
  const c = RULES.course;
  const r = RULES.repair;
  if (skilled(s)) {
    return dialog(
      '社区夜校',
      `<p class="say">门口的公告栏上贴满了报修的条子：洗衣机不转了、空调不制冷、电饭煲跳闸。</p>
       <p class="hint">接一单 ${r.hours} 个钟头，挣 ${r.pay}，体力 −${r.energy}，心力 −${r.sanity}。今天接了 ${s.today.repairs} / ${r.perDay} 单。</p>`,
      [
        [`接一单（${r.hours} 小时，+${r.pay}）`, 'repair', 'primary'],
        ['回头再说', 'close'],
      ],
      '家电维修 · 已结业',
    );
  }
  return dialog(
    '社区夜校',
    `<p class="say">“家电维修班，一共 ${c.classes} 节。学完了街坊的活儿都能接，一个钟头比端盘子挣得多。”</p>
     <p class="hint">一节课 ${c.hours} 个钟头，学费 ${c.fee}，体力 −${c.energy}，心力 −${c.sanity}。心力低于 ${RULES.lowSanity} 时学不进去。</p>
     <div class="progress"><div style="width:${(s.classes / c.classes) * 100}%"></div></div><p class="hint">已经上了 ${s.classes} / ${c.classes} 节。</p>`,
    [
      [`上一节课（${c.hours} 小时，${c.fee} 元）`, 'study', 'primary'],
      ['回头再说', 'close'],
    ],
    '家电维修班',
  );
}

function landlordHtml() {
  return dialog('房东', `<p class="say">“想搬回来？行啊，押金 ${RULES.deposit}，房租还是老规矩，一个月 ${app.s.rent}。”</p>`, [
    [`交押金搬回去（${RULES.deposit}）`, 'moveback', 'primary'],
    ['再说', 'close'],
  ]);
}

function salesSheet() {
  const s = app.s;
  const p = RULES.phone;
  const e = RULES.ebike;
  const sees = s.iq >= 2;
  const item = (id, name, pitch, monthly, truth, owned) => `<li><div class="what"><b>${name}</b><small>${pitch}</small>
      <small class="${sees ? 'bad' : ''}">${sees ? truth : `每个账单日 ${monthly}`}</small></div>
    <button class="btn primary" data-act="sales" data-id="${id}" ${owned ? 'disabled' : ''}><span>0</span><small>${owned ? '已有' : '拿走'}</small></button></li>`;
  return `<p class="stamp">推销员</p><h2>今天拿走，一分钱不用掏</h2>
    <p class="say">“帅哥，看看新款手机？零首付，今天就能拿走。出门没个像样的手机怎么行。电动车也有，上班再也不用走路。”</p>
    <ul class="catalog">
      ${item('phone', '最新款手机', `拿到手心力立刻 +${p.sanityNow}，以后每晚多恢复 ${p.nightly}`, p.pay, `每个账单日 −${p.pay}，一共 ${p.months} 期，总共要付 ${p.pay * p.months}`, s.phone.owned)}
      ${item('ebike', '电动车', '走路快将近一半', e.pay + e.upkeep, `每个账单日 −${e.pay + e.upkeep}（车贷 ${e.pay} 共 ${e.months} 期，另加充电保养 ${e.upkeep}，还完贷也要一直付）`, s.ebike.owned)}
    </ul>
    <p class="hint">${sees ? '老陈教过你：别看它叫什么，只看月底钱往哪边流。' : '他只说了每个月付多少。'}</p>`;
}

function guruHtml() {
  const s = app.s;
  const c = RULES.scam;
  if (s.scam) {
    return dialog(
      '财富导师',
      s.scam.age === 0
        ? `<p class="say">“放心，月底分红准时到账。到时候你就知道了，别人上班挣钱，你躺着挣钱。”</p>`
        : `<p class="say">“分红收到了吧？我没骗你吧！趁现在额度还有，再加点？……提现？哎呀，系统这几天在升级，过阵子就好。”</p>`,
      [['走开', 'close', 'primary']],
      `稳盈宝 · 已投 ${s.scam.amount}`,
    );
  }
  const truth =
    s.iq >= c.iq
      ? `<div class="truth"><p class="stamp">你想起老陈的话，多问了几句</p>
          <p>这门“生意”不卖任何东西，也没有任何进账。每个月分给老客户的钱，全部来自新客户交的本金。</p>
          <p>新人一旦变少，它就付不出钱了。</p></div>`
      : '<p class="hint">他讲得很热闹，但你听不出这钱到底是怎么赚出来的。</p>';
  return dialog(
    '财富导师',
    `<p class="say">“兄弟，看你就是个有想法的人。稳盈宝听过没有？每个月固定分红三成，保本，随时能取。我带的学员，三个月就不用上班了。”</p>${truth}`,
    [...c.stakes.map((n) => [`投 ${n}（每月“分红” ${Math.round(n * c.rate)}）`, 'scam', s.cash < n ? '' : '', `data-n="${n}" ${s.cash < n ? 'disabled' : ''}`]), ['不了', 'close', 'primary']],
    '稳盈宝 · 月息 30%',
  );
}

function talk(id) {
  const s = app.s;
  const month = monthOf(s);
  if (id === 'chen') {
    const result = lesson(s);
    if (result.index) {
      const l = LESSONS[result.index - 1];
      save();
      sfx('ok');
      return layer(dialog(l.title, lines(l.say) + `<p class="hint got">${l.got}</p>`, [['记下了', 'close', 'primary']], `老陈 · 第 ${result.index} 课`));
    }
    const text = pick(result.done ? CHEN_DONE : CHEN_IDLE, s.day + s.lessons);
    const buttons = s.lessons >= RULES.fishing.lessons ? [[`一起钓会儿鱼（${RULES.fishing.hours} 小时）`, 'fish', 'primary'], ['不打扰了', 'close']] : [['不打扰了', 'close', 'primary']];
    return layer(dialog('老陈', `<p class="say">${text}</p>`, buttons, result.done ? '' : '明天再来，他还有话说'));
  }
  if (id === 'qiang') return layer(dialog('阿强', `<p class="say">${qiangLine(month, s)}</p>`, [['嗯', 'close', 'primary']], '快餐店后厨 · 一天两份工'));
  if (id === 'lili') return layer(dialog('莉莉', `<p class="say">${liliLine(month, s)}</p>`, [['嗯', 'close', 'primary']], '市中心写字楼 · 周末回来'));
  if (id === 'sales') return layer(sheet(salesSheet()));
  if (id === 'guru') return layer(guruHtml());
}

/* ---------- 手机 ---------- */

function phoneSheet(tab = 'ledger') {
  const s = app.s;
  const tabs = [
    ['ledger', '账本'],
    ['loan', '闪电贷'],
    ['time', '时间'],
  ]
    .map(([id, label]) => `<button class="btn small ${tab === id ? 'primary' : ''}" data-act="phone" data-tab="${id}">${label}</button>`)
    .join('');
  const head = `<p class="stamp">第 ${monthOf(s)} 个月 · 第 ${s.day} 天 · ${clockText(s)}</p><div class="tabs">${tabs}</div>`;

  if (tab === 'loan') {
    const room = loanLimit(s) - s.debt;
    const can = Math.min(s.debt, s.cash);
    return `${head}<h2>${s.debt ? `欠款 ${s.debt}` : '闪电贷'}</h2>
      <p>“三秒到账，无需抵押。”每个账单日利息一成，利息会并进欠款里接着算。</p>
      <p class="hint">你的额度是 ${loanLimit(s)}，还能借 ${Math.max(0, room)}。按时付账，额度会慢慢涨；账单日钱不够，系统会自动替你借。</p>
      ${
        s.debt
          ? `<div class="steps"><span class="label">还款</span>${[100].filter((n) => n < can).map((n) => `<button class="btn" data-act="repay" data-n="${n}">还 ${n}</button>`).join('')}
              <button class="btn primary" data-act="repay" data-n="${can}" ${can ? '' : 'disabled'}>${can >= s.debt ? `还清 ${s.debt}` : can ? `能还 ${can}` : '没钱可还'}</button></div>`
          : ''
      }
      <div class="steps"><span class="label">借款</span>${[100, 200].filter((n) => n <= room).map((n) => `<button class="btn" data-act="borrow" data-n="${n}">借 ${n}</button>`).join('') || '<span class="hint">没有额度了。</span>'}</div>`;
  }

  if (tab === 'time') {
    return `${head}<h2>这个月的时间</h2>
      <p class="hint">这个月过了 ${s.month.days} 天，今天是第 ${s.month.days + 1} 天。每天醒着 ${RULES.dayHours} 个钟头。</p>
      <h4>今天</h4>${hoursHtml(s.today, 1)}
      <h4>这个月到昨天为止</h4>${s.month.days ? hoursHtml({ work: s.month.hours.work - s.today.work, study: s.month.hours.study - s.today.study, rest: s.month.hours.rest - s.today.rest, fun: s.month.hours.fun - s.today.fun, chores: s.month.hours.chores - s.today.chores }, s.month.days) : '<p class="hint">这个月才刚开始。</p>'}`;
  }

  if (!s.ledger) {
    return `${head}<h2>手里有 ${s.cash} 元</h2>
      <p>你只知道兜里现在有多少。这个月挣了多少、花了多少、花在哪儿，没有记。</p>
      <p class="hint">公园池塘边有个钓鱼的大爷，天天在那儿。</p>`;
  }
  const i = s.month.income;
  const x = s.month.spend;
  const fixed = fixedCosts(s);
  const passive = passiveIncome(s);
  const out = fixed.total + x.food;
  return `${head}<h2>旧账本</h2>
    <h4>这个月到现在</h4>
    <dl class="tally">
      ${row('快餐店的工钱', i.wage, 'good')}${row('修东西挣的', i.repair, 'good')}
      ${row('吃饭', x.food, 'bad')}${row('奶茶', x.fun, 'bad')}${row('学费', x.study, 'bad')}${row('看病', x.medical, 'bad')}
    </dl>
    ${i.wage + i.repair + x.food + x.fun + x.study + x.medical === 0 ? '<p class="hint">这个月还没有进出。</p>' : ''}
    <h4>账单日那天</h4>
    <dl class="tally">
      ${row('售货机会进账', passive, 'good')}
      ${row('房租', fixed.rent, 'bad')}${row('分期还款', fixed.installments, 'bad')}${row('电动车充电保养', fixed.upkeep, 'bad')}${row('闪电贷利息（并入欠款）', fixed.interest, 'bad')}
    </dl>
    <h4>我手里的东西</h4>
    ${sheetHtml(balanceSheet(s))}
    ${s.machines ? `<button class="btn wide danger" data-act="sell-vending">卖掉一台售货机，换 ${RULES.vending.resale}</button>` : ''}
    <div class="flow big"><div class="track"><div class="fill ${passive >= out ? 'full' : ''}" style="width:${Math.min(100, (passive / Math.max(1, out)) * 100).toFixed(0)}%"></div></div>
      <span>不干活也会进来的钱 <b class="good">${passive}</b>，每个月不得不花的钱大约 <b class="bad">${out}</b>。${s.won ? '你已经把时间赎回来了。' : `连续 ${RULES.winStreak} 个月前者盖过后者、并且不欠钱，你就不必再为了活着去上班。现在连续 ${s.streak} 个月。`}</span></div>`;
}

function menuSheet() {
  return `<p class="stamp">第 ${app.s.day} 天</p><h2>歇一下</h2><p>进度会自动保存。</p>
    <div class="stack"><button class="btn primary wide" data-act="close" data-close>接着过</button><button class="btn wide" data-act="home">回到首页</button></div>`;
}

/* ---------- 点击与按键 ---------- */

root.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const s = app.s;
  const d = el.dataset;
  const reopen = (html, error) => {
    if (error) {
      sfx('bad');
      toast(error);
    } else sfx('coin');
    save();
    hud();
    layer(html);
  };
  switch (d.act) {
    case 'start':
      app.s = newState((Math.floor(Math.random() * 0xffffffff) || 1) >>> 0);
      save();
      return show('game');
    case 'continue':
      return show('game');
    case 'home':
      save();
      return show('home');
    case 'menu':
      return layer(sheet(menuSheet()));
    case 'phone':
      return layer(sheet(phoneSheet(d.tab)));
    case 'use':
      return use();
    case 'close':
      if (event.target.closest('.sheet, .dialog') && !event.target.closest('[data-close]')) return;
      return layer('');
    case 'sleep':
      return sleep(false);
    case 'work':
      return spend(work, '在快餐店站了一班');
    case 'repair':
      return spend(repairJob, '上门修好了一台家电');
    case 'study':
      return spend(study, '在夜校上了一节课', () => {
        if (skilled(s)) layer(dialog('结业了', '<p>老师把一张结业证拍在你手里：“以后街坊的洗衣机坏了，就找你。”</p><p class="hint">夜校门口的公告栏上可以接维修单了，一个钟头挣的是端盘子的两倍多。</p>', [['好', 'close', 'primary']], '家电维修班'));
      });
    case 'fish':
      return spend(fishWithChen, '和老陈钓了一下午鱼');
    case 'tea':
      return spend(buyTea, '喝了一杯奶茶');
    case 'store': {
      if (d.id === 'bento') return spend(buyBento, '吃了一份便当');
      return reopen(sheet(storeSheet()), buyGroceries(s, d.id === 'grocery4' ? 4 : 1));
    }
    case 'vending': {
      const error = buyVending(s);
      if (error) return reopen(sheet(storeSheet()), error);
      sfx('coin');
      save();
      layer(dialog('售货机摆上了', `<p>老板帮你把机器推到了位置上，插上电，灯亮了。</p><p class="hint">它不用你管。下个账单日，会有 ${RULES.vending.income} 自己进到你的账上。${s.ledger ? '打开手机里的账本看看，“往里流钱的”那一栏有东西了。' : ''}</p>`, [['好', 'close', 'primary']], '第一次，有东西替你挣钱'));
      return;
    }
    case 'sell-vending':
      return reopen(sheet(phoneSheet('ledger')), sellVending(s));
    case 'sales': {
      const error = d.id === 'phone' ? takePhone(s) : takeEbike(s);
      if (error) return reopen(sheet(salesSheet()), error);
      sfx('coin');
      save();
      toast(d.id === 'phone' ? '新手机到手了。屏幕真亮。' : '电动车骑上了，风从耳边过。');
      return layer('');
    }
    case 'scam': {
      const error = investScam(s, Number(d.n));
      if (error) return reopen(guruHtml(), error);
      sfx('coin');
      save();
      toast('钱转过去了。他把你拉进了一个群。');
      return layer('');
    }
    case 'moveback': {
      const error = moveBack(s);
      if (error) return reopen(landlordHtml(), error);
      sfx('ok');
      save();
      toast('你搬回了出租屋。');
      return layer('');
    }
    case 'borrow':
      return reopen(sheet(phoneSheet('loan')), borrow(s, Number(d.n)));
    case 'repay':
      repay(s, Number(d.n));
      return reopen(sheet(phoneSheet('loan')), null);
  }
});

const MOVE_KEYS = {
  ArrowUp: [0, -1, 1],
  ArrowDown: [0, 1, 0],
  ArrowLeft: [-1, 0, 2],
  ArrowRight: [1, 0, 3],
  w: [0, -1, 1],
  s: [0, 1, 0],
  a: [-1, 0, 2],
  d: [1, 0, 3],
};

document.addEventListener('keydown', (event) => {
  if (app.screen !== 'game') return;
  const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (k === 'Escape') {
    if (!rt.paused) layer(sheet(menuSheet()));
    else if (document.querySelector('#layer [data-close]')) layer('');
    return;
  }
  if (k === 'Tab') {
    event.preventDefault();
    if (!rt.paused) layer(sheet(phoneSheet()));
    else if (document.querySelector('#layer .sheet')) layer('');
    return;
  }
  if (rt.paused) {
    if ((k === ' ' || k === 'Enter') && !event.repeat) {
      const btn = document.querySelector('#layer .dialog .btn.primary:not([disabled])');
      if (btn) {
        event.preventDefault();
        btn.click();
      }
    }
    return;
  }
  if (MOVE_KEYS[k]) {
    rt.keys.add(k);
    rt.hover = null;
    event.preventDefault();
  } else if (k === ' ' || k === 'e' || k === 'Enter') {
    event.preventDefault();
    if (!event.repeat) use();
  }
});

document.addEventListener('keyup', (event) => {
  rt.keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});
window.addEventListener('blur', () => rt.keys.clear());

function bindCanvas(canvas) {
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const tileAt = (e) => {
    const [x, y] = point(e);
    const v = rt.view;
    const dpr = v.w / canvas.clientWidth;
    return { x: Math.floor(((x * dpr) / v.zoom + v.cx) / T), y: Math.floor(((y * dpr) / v.zoom + v.cy) / T) };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (rt.paused) return;
    if (e.pointerType === 'mouse') {
      const tile = tileAt(e);
      const dx = tile.x + 0.5 - rt.p.x;
      const dy = tile.y + 0.5 - rt.p.y;
      rt.p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : dy > 0 ? 0 : 1;
      rt.hover = tile;
      return use();
    }
    canvas.setPointerCapture?.(e.pointerId);
    const [x, y] = point(e);
    rt.stick = { id: e.pointerId, ox: x, oy: y, x, y };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      rt.hover = rt.paused ? null : tileAt(e);
      return;
    }
    if (rt.stick?.id === e.pointerId) [rt.stick.x, rt.stick.y] = point(e);
  });
  const end = (e) => {
    if (rt.stick?.id === e.pointerId) rt.stick = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => (rt.hover = null));
}

/* ---------- 每一帧 ---------- */

function inputVector() {
  let x = 0;
  let y = 0;
  let dir = -1;
  for (const k of rt.keys) {
    x += MOVE_KEYS[k][0];
    y += MOVE_KEYS[k][1];
    dir = MOVE_KEYS[k][2];
  }
  if (rt.stick) {
    const dx = rt.stick.x - rt.stick.ox;
    const dy = rt.stick.y - rt.stick.oy;
    if (Math.hypot(dx, dy) > 10) {
      x = dx;
      y = dy;
      dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : dy > 0 ? 0 : 1;
    }
  }
  const len = Math.hypot(x, y);
  return len ? [x / len, y / len, dir] : [0, 0, -1];
}

// 街上的车和路人：只是让街道活起来。车看到人在前面会停下。
function updateTraffic(dt) {
  const p = rt.p;
  for (const c of rt.cars) {
    const y = c.lane ? ROAD_Y[0] + 2.6 : ROAD_Y[0] + 0.9;
    const dirX = c.lane ? 1 : -1;
    const ahead = (p.x - c.x) * dirX;
    const inLane = rt.where === 'out' && Math.abs(p.y - y) < 1.3;
    const blockedByPlayer = inLane && ahead > 0 && ahead < 4.5;
    const other = rt.cars.some((o) => o !== c && o.lane === c.lane && (o.x - c.x) * dirX > 0 && (o.x - c.x) * dirX < 4.2);
    if (!blockedByPlayer && !other) c.x += dirX * c.speed * dt;
    if (c.x > 72) c.x = -6;
    if (c.x < -6) c.x = 72;
  }
  for (const w of rt.walkers) {
    if (w.pause > 0) {
      w.pause -= dt;
      continue;
    }
    w.x += w.dir * 1.6 * dt;
    w.step += dt * 6;
    if (w.x > 63 || w.x < 2) w.dir *= -1;
    else if (Math.random() < dt * 0.05) w.pause = 1 + Math.random() * 3;
  }
}

function update(dt) {
  rt.time += dt;
  rt.floats.forEach((f) => (f.t += dt));
  rt.floats = rt.floats.filter((f) => f.t < 1.3);
  updateTraffic(dt);
  if (rt.paused) return;
  const s = app.s;
  const p = rt.p;

  s.minutes += (dt * RULES.dayHours * 60) / RULES.daySeconds;
  if (s.minutes >= RULES.dayHours * 60) return sleep(true);

  const [vx, vy, dir] = inputVector();
  if (vx || vy) {
    let speed = 4.4;
    if (s.sanity < RULES.lowSanity) speed *= 0.62;
    if (s.ebike.owned && rt.where === 'out') speed *= RULES.ebike.speed;
    moveBody(p, vx * speed * dt, vy * speed * dt);
    p.dir = dir;
    const before = Math.floor(p.step);
    p.step += dt * (s.sanity < RULES.lowSanity ? 5 : 8);
    if (Math.floor(p.step) !== before && Math.floor(p.step) % 2 === 0) sfx('step');
  } else p.step = 0;

  const target = findTarget();
  if (target?.label !== rt.target?.label) {
    const btn = document.getElementById('act');
    const hint = document.getElementById('hint');
    if (btn) {
      btn.hidden = !target;
      hint.hidden = !target;
      if (target) {
        btn.textContent = target.label;
        hint.textContent = target.label;
      }
    }
  }
  rt.target = target;

  if (rt.time - rt.hudAt > 0.5) {
    rt.hudAt = rt.time;
    const clock = document.getElementById('clock');
    if (clock) {
      clock.textContent = clockText(s);
      clock.classList.toggle('late', hourNow(s) >= 21);
    }
  }
  if (rt.time - rt.saveAt > 20) {
    rt.saveAt = rt.time;
    save();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - rt.last) / 1000);
  rt.last = now;
  update(dt);
  draw();
  if (app.screen === 'game') rt.raf = requestAnimationFrame(frame);
}

/* ---------- 绘制 ---------- */

const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

// 出租屋里随日子变化的摆设
const DECOR_WHEN = {
  skilled: (s) => skilled(s),
  low: (s) => s.sanity < RULES.lowSanity,
  ebike: (s) => s.ebike.owned,
  groceries: (s) => s.groceries > 0,
  classes: (s) => s.classes > 0,
  ledger: (s) => s.ledger,
  phone: (s) => s.phone.owned,
};

function drawDecor(ctx, room, list) {
  const s = app.s;
  const R = roomArt();
  const hour = hourNow(s);
  for (const d of room.decor) {
    if (d.when && !DECOR_WHEN[d.when](s)) continue;
    let sprite = R[d.art];
    if (d.art === 'window') sprite = R.window[hour >= 19 ? 'night' : hour >= 17 ? 'dusk' : 'day'];
    if (d.art === 'plant') sprite = R.plant[s.sanity < RULES.lowSanity ? 0 : s.sanity >= 60 ? 2 : 1];
    if (d.base) list.push([d.base, () => ctx.drawImage(sprite, d.px, d.py)]);
    else ctx.drawImage(sprite, d.px, d.py);
  }
}

// 屋里的光：白天窗户照进来一块亮，傍晚发黄，晚上只有一盏灯
function roomLight(ctx, room) {
  const hour = hourNow(app.s);
  const w = room.w * T;
  const h = room.h * T;
  if (hour < 19) {
    ctx.fillStyle = hour >= 17 ? 'rgba(255, 170, 90, 0.16)' : 'rgba(255, 246, 205, 0.14)';
    for (const x of [18, 192]) {
      ctx.beginPath();
      ctx.moveTo(x, 32);
      ctx.lineTo(x + 28, 32);
      ctx.lineTo(x + 66, 120);
      ctx.lineTo(x + 22, 120);
      ctx.closePath();
      ctx.fill();
    }
    if (hour >= 17) {
      ctx.fillStyle = 'rgba(255, 150, 80, 0.07)';
      ctx.fillRect(T, 0, w - 2 * T, h - T);
    }
    return;
  }
  // 中间一盏灯：越靠边越暗
  const dim = ctx.createRadialGradient(w / 2 - 20, 96, 14, w / 2 - 20, 96, 190);
  dim.addColorStop(0, 'rgba(40, 26, 30, 0.06)');
  dim.addColorStop(0.55, 'rgba(26, 20, 48, 0.34)');
  dim.addColorStop(1, 'rgba(16, 12, 40, 0.62)');
  ctx.fillStyle = dim;
  ctx.fillRect(T, 0, w - 2 * T, h - T);
  const warm = ctx.createRadialGradient(w / 2 - 20, 96, 4, w / 2 - 20, 96, 110);
  warm.addColorStop(0, 'rgba(255, 196, 110, 0.16)');
  warm.addColorStop(1, 'rgba(255, 196, 110, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(T, 0, w - 2 * T, h - T);
  // 桌上的台灯和电脑屏幕
  ctx.fillStyle = 'rgba(255, 230, 160, 0.5)';
  ctx.fillRect(75, 20, 3, 1);
  ctx.fillStyle = 'rgba(160, 200, 240, 0.18)';
  ctx.fillRect(60, 28, 18, 8);
}

function shadow(ctx, x, y) {
  ctx.fillStyle = 'rgba(43,36,55,0.25)';
  ctx.fillRect(Math.round(x) - 5, Math.round(y), 10, 2);
  ctx.fillRect(Math.round(x) - 4, Math.round(y) + 2, 8, 1);
}

function person(ctx, frames, x, y, dir, step) {
  const f = step > 0 ? 1 + (Math.floor(step) % 2) : 0;
  shadow(ctx, x * T, y * T + 6);
  ctx.drawImage(frames[dir][f], Math.round(x * T) - 8, Math.round(y * T) - 15);
}

function draw() {
  const canvas = document.getElementById('view');
  if (!canvas) return;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const cw = Math.round(canvas.clientWidth * dpr);
  const ch = Math.round(canvas.clientHeight * dpr);
  if (!cw || !ch) return;
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const A = art();
  const m = here();
  const inRoom = rt.where === 'in';
  // 取整数倍放大，像素才不会糊。放大到至少能把整条街的高度铺满屏幕，这样四周不会露出空白。
  const tiles = canvas.clientWidth > 700 ? 420 : 190;
  let zoom = Math.max(2, Math.round(Math.sqrt((cw * ch) / tiles) / T));
  if (!inRoom) zoom = Math.max(zoom, Math.ceil(ch / (m.h * T)), Math.ceil(cw / (m.w * T)));
  // 屋里：放大到铺满屏幕，镜头跟着人走；竖屏时至少看得到 7 格宽
  else zoom = Math.max(2, Math.min(Math.ceil(Math.max(cw / (m.w * T), ch / (m.h * T))), Math.floor(cw / (7 * T))));
  const vw = cw / zoom;
  const vh = ch / zoom;
  const p = rt.p;
  const mw = m.w * T;
  const mh = m.h * T;
  let cx = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, p.x * T - vw / 2));
  let cy = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, p.y * T - vh / 2));
  cx = Math.round(cx * zoom) / zoom;
  cy = Math.round(cy * zoom) / zoom;
  rt.view = { cx, cy, zoom, w: cw, h: ch };
  ctx.setTransform(zoom, 0, 0, zoom, -cx * zoom, -cy * zoom);

  const x0 = Math.floor(cx / T);
  const y0 = Math.floor(cy / T);
  const x1 = Math.ceil((cx + vw) / T);
  const y1 = Math.ceil((cy + vh) / T);
  const frameNo = Math.floor(rt.time * 2) % 2;
  const s = app.s;

  /* 地面 */
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x * T;
      const py = y * T;
      if (inRoom) {
        const R = roomArt();
        const inner = x >= 1 && x < m.w - 1;
        let tile = R.dark;
        const within = (z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
        const bathCol = x >= ROOM_ZONES.bath.x0 && x <= ROOM_ZONES.bath.x1;
        if (inner && y >= 2 && y < m.h - 1) {
          if (ROOM_PARTITION.some(([px2, py2]) => px2 === x && py2 === y)) tile = y === 6 ? R.partition : R.wallTop;
          else if (within(ROOM_ZONES.bath)) tile = R.bathTile;
          else tile = within(ROOM_ZONES.kitchen) ? R.lino[hash(x, y) % 2] : R.floor[hash(x, y) % 6];
        } else if (inner && y === 0) tile = bathCol ? R.tileWall[0] : x === 14 ? R.wallTop : R.wallHi[hash(x, 3) % 4];
        else if (inner && y === 1) tile = bathCol ? R.tileWall[1] : x === 14 ? R.wallTop : R.wallLo[x === 2 || x === 6 ? 1 : hash(x, 9) % 3 === 0 ? 2 : 0];
        else if (x >= 0 && x < m.w && y >= 0 && y < m.h) tile = R.wallTop;
        ctx.drawImage(tile, px, py);
        continue;
      }
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) {
        ctx.drawImage(A.grass[hash(x, y) % 8], px, py);
        continue;
      }
      const g = m.ground[y * m.w + x];
      if (g === WATER) {
        ctx.drawImage(A.water[(Math.floor(rt.time * 1.5) + x + y) % 3], px, py);
        if (m.ground[(y - 1) * m.w + x] !== WATER) {
          ctx.fillStyle = '#3c85bd';
          ctx.fillRect(px, py, T, 3);
          ctx.fillStyle = '#5a8f4a';
          ctx.fillRect(px, py, T, 1);
        }
      } else if (g === PATH) ctx.drawImage(A.path[hash(x, y) % 3], px, py);
      else if (g === PAVE) ctx.drawImage(A.pave[hash(x, y) % 3], px, py);
      else if (g === ROAD) ctx.drawImage(A.road[hash(x, y) % 3], px, py);
      else ctx.drawImage(A.grass[hash(x, y) % 8], px, py);
    }
  }

  if (!inRoom) {
    /* 马路上的线 */
    const top = ROAD_Y[0] * T;
    const bottom = (ROAD_Y[1] + 1) * T;
    ctx.fillStyle = '#9b9ea6';
    ctx.fillRect(x0 * T, top - 2, (x1 - x0 + 1) * T, 2);
    ctx.fillRect(x0 * T, bottom, (x1 - x0 + 1) * T, 2);
    ctx.fillStyle = '#e8e2c8';
    for (let x = x0 - (x0 % 2); x <= x1; x += 2) {
      if (CROSSINGS.includes(x) || CROSSINGS.includes(x + 1)) continue;
      ctx.fillRect(x * T + 3, (top + bottom) / 2 - 1, 10, 2);
    }
    for (const x of CROSSINGS) {
      if (x < x0 - 1 || x > x1 + 1) continue;
      for (let y = top + 3; y < bottom - 3; y += 6) ctx.fillRect(x * T, y, T, 3);
    }
    /* 下一台售货机可以摆的位置 */
    const next = VENDING_SPOTS[s.machines];
    if (next && s.machines > 0) ctx.drawImage(A.vendingSpot, next.x * T, next.y * T);
  }

  /* 立着的东西，按底边从上到下画 */
  const list = [];
  const seen = (t) => t.x + t.fw + 1 >= x0 && t.x - 2 <= x1 && t.y + t.fh >= y0 && t.y - 8 <= y1;
  for (const t of m.things) {
    if (!seen(t)) continue;
    const sprite = t.art === 'tree' ? A.tree[t.variant ?? 0] : inRoom ? roomArt()[t.art] : A[t.art];
    if (!sprite) continue;
    const dx = Math.round((t.x + t.fw / 2) * T - sprite.width / 2);
    const dy = (t.y + t.fh) * T - sprite.height;
    if (t.flat) ctx.drawImage(sprite, dx, dy);
    else list.push([(t.y + t.fh) * T, () => ctx.drawImage(sprite, dx, dy)]);
  }
  if (inRoom) drawDecor(ctx, m, list);
  if (!inRoom) {
    VENDING_SPOTS.slice(0, s.machines).forEach((v) => {
      const sprite = A.vending[frameNo];
      list.push([(v.y + 1) * T, () => ctx.drawImage(sprite, v.x * T, (v.y + 1) * T - sprite.height)]);
    });
    for (const n of m.npcs) {
      if (n.conditional && !guruHere()) continue;
      list.push([(n.y + 1) * T - 2, () => person(ctx, A.people[n.id], n.x + 0.5, n.y + 0.55, n.face, 0)]);
    }
    for (const w of rt.walkers) list.push([w.y * T + 7, () => person(ctx, A.people.walkers[w.kind], w.x, w.y, w.dir > 0 ? 3 : 2, w.pause > 0 ? 0 : w.step)]);
    for (const c of rt.cars) {
      const y = c.lane ? ROAD_Y[0] + 2.6 : ROAD_Y[0] + 0.9;
      const sprite = A.cars[c.kind][c.lane ? 0 : 1];
      list.push([
        y * T + 8,
        () => {
          ctx.fillStyle = 'rgba(43,36,55,0.25)';
          ctx.fillRect(Math.round(c.x * T) - 18, Math.round(y * T) + 6, 36, 3);
          ctx.drawImage(sprite, Math.round(c.x * T) - 20, Math.round(y * T) - 14);
        },
      ]);
    }
  }
  list.push([p.y * T + 7, () => person(ctx, A.people.player, p.x, p.y, p.dir, p.step)]);
  list.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());

  /* 老陈的鱼线 */
  if (!inRoom) {
    const chen = m.npcs[0];
    const fx = (chen.x + 0.5) * T;
    const fy = (chen.y + 2.2) * T + Math.round(Math.sin(rt.time * 2));
    ctx.strokeStyle = 'rgba(243,239,230,0.8)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(fx + 4, chen.y * T);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.fillStyle = '#d2583f';
    ctx.fillRect(fx - 1, fy - 1, 2, 2);
  }

  /* 面前那一格的框；心力低时奶茶店的框会跳 */
  const t = rt.target;
  if (t && !rt.paused) {
    const px = t.x * T;
    const py = t.y * T;
    ctx.fillStyle = 'rgba(243,239,230,0.95)';
    for (const [ax, ay, bw, bh] of [
      [0, 0, 5, 1],
      [0, 0, 1, 5],
      [11, 0, 5, 1],
      [15, 0, 1, 5],
      [0, 15, 5, 1],
      [0, 11, 1, 5],
      [11, 15, 5, 1],
      [15, 11, 1, 5],
    ]) {
      ctx.fillRect(px + ax, py + ay, bw, bh);
    }
  }

  if (inRoom) roomLight(ctx, m);

  /* 天色 */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!inRoom) {
    const late = Math.max(0, (s.minutes - 10 * 60) / (6 * 60));
    if (late > 0) {
      ctx.fillStyle = late < 0.35 ? `rgba(255, 150, 80, ${(late * 0.3).toFixed(3)})` : `rgba(24, 20, 60, ${Math.min(0.55, (late - 0.25) * 0.75).toFixed(3)})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  if (rt.stick && !rt.paused) {
    const st = rt.stick;
    const dx = st.x - st.ox;
    const dy = st.y - st.oy;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, 36 / len);
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = 'rgba(243,239,230,0.45)';
    ctx.beginPath();
    ctx.arc(st.ox * dpr, st.oy * dpr, 36 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(243,239,230,0.7)';
    ctx.beginPath();
    ctx.arc((st.ox + dx * k) * dpr, (st.oy + dy * k) * dpr, 14 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- 启动 ---------- */

// 调试用：地址以 #debug 结尾时，把内部状态挂到 window 上，方便自动化测试。
if (location.hash === '#debug') window.__game = { app, rt, hud, layer, sleep, use };

const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ s: app.s }));
const begin = () => (hot?.ready ? hot.ready(boot) : boot(hot?.data ?? {}));
// 招牌上的字要等字体就绪再画，最多等一秒半
Promise.race([document.fonts?.load?.('bold 12px "Noto Sans SC"', '便利店夜校') ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(begin, begin);
