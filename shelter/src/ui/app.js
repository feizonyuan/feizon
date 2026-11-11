// 主程序：首页，以及可以到处走动的游戏画面。
import {
  RULES,
  ITEMS,
  CROPS,
  ASSETS,
  LUXURY,
  SHOP,
  newState,
  price,
  clockText,
  earn,
  spend,
  rentNow,
  passiveIncome,
  livingCost,
  netWorth,
  daysToRent,
  addItem,
  takeItem,
  energyCost,
  useEnergy,
  addMood,
  eat,
  buy,
  sell,
  buyAsset,
  buyLuxury,
  borrow,
  repay,
  doJob,
  cropStage,
  till,
  water,
  plant,
  harvest,
  endDay,
} from '../game/state.js';
import { T, art } from '../game/art.js';
import { WATER, PATH, CONCRETE, GARDEN, PADS, HOME_DOOR, key, buildWorld, buildRoom } from '../game/map.js';
import { ICONS } from './icons.js';

const SAVE_KEY = 'flat.save.v1';
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
  world: null,
  room: null,
  where: 'out',
  p: { x: HOME_DOOR.x, y: HOME_DOOR.y, dir: 0, step: 0 },
  keys: new Set(),
  stick: null,
  hover: null, // 鼠标指着的格子
  paused: false,
  target: null,
  floats: [],
  dogs: [],
  fishing: null,
  swing: 0,
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

/* ---------- 声音：用振荡器合成的短音 ---------- */

let audio = null;
function sfx(kind) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const [freq, to, len, type] = {
      step: [180, 120, 0.05, 'triangle'],
      dig: [150, 70, 0.12, 'square'],
      water: [500, 900, 0.14, 'sine'],
      pick: [520, 880, 0.1, 'triangle'],
      coin: [880, 1320, 0.14, 'square'],
      bad: [200, 110, 0.2, 'sawtooth'],
      ok: [440, 660, 0.12, 'triangle'],
      bite: [1200, 1200, 0.08, 'square'],
    }[kind];
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(to, audio.currentTime + len);
    g.gain.setValueAtTime(0.06, audio.currentTime);
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
  if (app.s && app.s.v !== 1) app.s = null;
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
      <p class="stamp">末日后第三年 · 幸存者营地</p>
      <h1>末日躺平指南</h1>
      <p class="lede">世界完了，房租还在。你在营地边上租了一间铁皮屋，房东老周每五天来收一次租。种菜、钓鱼、翻废墟、打零工、喝奶茶、躺吊床，想怎么过都行。没有通关，也没有失败。</p>
    </header>
    <div class="stack">
      ${
        s
          ? `<button class="resume" data-act="continue"><span><b>接着过日子</b><small>第 ${s.day} 天 · 手里有 ${s.money}${s.debt ? ` · 欠款 ${s.debt}` : ''}</small></span><i>${ICONS.arrow}</i></button>`
          : ''
      }
      <button class="btn ${s ? '' : 'primary'} wide big-btn" data-act="start">${s ? '重新开始' : '搬进铁皮屋'}</button>
    </div>
    <section class="rules">
      <h2 class="label">怎么玩</h2>
      <ol>
        <li><span><b>走动。</b>电脑用 WASD 或方向键；手机按住屏幕左半边拖动。</span></li>
        <li><span><b>选东西。</b>屏幕下方是随身物品，电脑按数字键 1 到 0 切换，手机直接点。</span></li>
        <li><span><b>动手。</b>面对着一格地或一个人，按空格、点鼠标，或点右下角的按钮。拿着锄头就是翻地，拿着种子就是播种，拿着吃的就是吃掉。</span></li>
        <li><span><b>睡觉。</b>回铁皮屋上床，一天就过去了。熬到半夜会直接倒下。</span></li>
      </ol>
    </section>
    <p class="fine">进度自动保存在这台设备的浏览器里。</p>
  </div>`;
}

function mountGame() {
  const s = app.s;
  root.innerHTML = `<div class="play">
    <canvas id="view" aria-label="游戏画面"></canvas>
    <div class="hud-l" id="hud-l"></div>
    <div class="hud-r" id="hud-r"></div>
    <div class="hint" id="hint" hidden></div>
    <div class="bar" id="bar"></div>
    <button class="act" id="act" data-act="use" hidden></button>
    <div id="layer"></div>
  </div>`;
  rt.world = buildWorld(s.seed);
  rt.room = buildRoom(!!s.owned.console);
  rt.where = 'out';
  rt.p = { x: HOME_DOOR.x, y: HOME_DOOR.y, dir: 0, step: 0 };
  rt.dogs = rt.world.dens.map((d) => ({ x: d.x, y: d.y, hx: d.x, hy: d.y, tx: d.x, ty: d.y, wait: 0, chasing: false, face: 1, step: 0 }));
  rt.floats = [];
  rt.fishing = null;
  rt.keys.clear();
  rt.stick = null;
  bindCanvas(document.getElementById('view'));
  hud();
  rt.last = performance.now();
  rt.raf = requestAnimationFrame(frame);
  if (s.day === 1 && s.minutes === 0) layer(introHtml());
  else layer('');
}

/* ---------- HUD ---------- */

const iconUrls = {};
function iconUrl(id) {
  iconUrls[id] ??= art().icons[id].toDataURL();
  return iconUrls[id];
}

function meter(label, value, cls) {
  return `<div class="meter ${cls} ${value < 25 ? 'low' : ''}"><span>${label}</span><div><i style="width:${Math.round(value)}%"></i></div></div>`;
}

function hud() {
  const s = app.s;
  if (!s || app.screen !== 'game') return;
  const left = document.getElementById('hud-l');
  if (!left) return;
  const passive = passiveIncome(s);
  const cost = livingCost(s);
  const toRent = daysToRent(s);
  left.innerHTML = `
    <div class="when"><b>第 ${s.day} 天</b><span id="clock">${clockText(s)}</span></div>
    <div class="purse"><img alt="" src="${iconUrl('coin')}"><b>${s.money}</b>${s.debt ? `<span class="owe">欠 ${s.debt}</span>` : ''}</div>
    <div class="rentline ${toRent === 1 && s.money < rentNow(s) ? 'warn' : ''}">${toRent === 1 ? '明早' : `${toRent} 天后`}交租 ${rentNow(s)}</div>
    <div class="flow" title="设备每天自己赚的 / 每天最少要花的">
      <div class="track"><div class="fill ${passive >= cost ? 'full' : ''}" style="width:${Math.min(100, (passive / cost) * 100).toFixed(0)}%"></div></div>
      <span>躺着赚 ${passive} / 每天开销 ${cost}</span>
    </div>`;
  document.getElementById('hud-r').innerHTML = `
    ${meter('体力', s.energy, 'en')}${meter('饱食', s.food, 'fo')}${meter('心情', s.mood, 'mo')}
    <div class="hud-btns">
      <button class="btn small" data-act="ledger">账本</button>
      <button class="icon-btn" data-act="menu" aria-label="菜单">${ICONS.menu}</button>
    </div>`;
  document.getElementById('bar').innerHTML = s.inv
    .map((slot, i) => {
      const on = i === s.sel ? 'on' : '';
      const num = (i + 1) % 10;
      if (!slot) return `<button class="slot ${on}" data-act="slot" data-i="${i}" aria-label="空格子"><kbd>${num}</kbd></button>`;
      return `<button class="slot ${on}" data-act="slot" data-i="${i}" title="${ITEMS[slot.id].name}">
        <kbd>${num}</kbd><img alt="${ITEMS[slot.id].name}" src="${iconUrl(slot.id)}">${slot.n > 1 ? `<b>${slot.n}</b>` : ''}
      </button>`;
    })
    .join('');
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function float(text, color = '#f3efe6', x = rt.p.x, y = rt.p.y - 1) {
  rt.floats.push({ x, y, text, color, t: 0 });
}

/* ---------- 地图查询 ---------- */

const here = () => (rt.where === 'in' ? rt.room : rt.world);

function padAsset(x, y) {
  const i = PADS.findIndex((p) => x >= p.x && x <= p.x + 1 && y >= p.y && y <= p.y + 1);
  return i >= 0 && app.s.assets[i] ? i : -1;
}

function solidAt(x, y) {
  const m = here();
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  if (m.solid[y * m.w + x]) return true;
  return rt.where === 'out' && padAsset(x, y) >= 0;
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

const inGarden = (x, y) => x >= GARDEN.x0 && x <= GARDEN.x1 && y >= GARDEN.y0 && y <= GARDEN.y1;

function facingTile() {
  const p = rt.p;
  if (rt.hover) {
    const d = Math.hypot(rt.hover.x + 0.5 - p.x, rt.hover.y + 0.5 - (p.y + 0.1));
    if (d < 1.7) return rt.hover;
  }
  const [dx, dy] = DIRS[p.dir];
  return { x: Math.floor(p.x + dx * 0.8), y: Math.floor(p.y + 0.12 + dy * 0.8) };
}

/* ---------- 面前这一格能做什么 ---------- */

function findTarget() {
  const s = app.s;
  const tile = facingTile();
  const k = key(tile.x, tile.y);
  const it = here().inter.get(k);
  const held = s.inv[s.sel];
  const heldItem = held && ITEMS[held.id];
  const make = (label, run, mark = true) => ({ ...tile, label, run, mark });

  if (rt.where === 'in') {
    if (!it) return heldItem?.food ? make(`吃${heldItem.name}`, eatHeld, false) : null;
    if (it.type === 'bed') return make('睡觉', () => layer(sleepHtml()));
    if (it.type === 'console') return make('打游戏', playConsole);
    if (it.type === 'stand') return make('看看柜子', () => toast('空柜子。阿梅那儿有游戏机卖，放这儿正合适。'));
    if (it.type === 'exit') return make('出门', leaveRoom);
    return null;
  }

  if (it) {
    switch (it.type) {
      case 'door':
        return make('进屋', enterRoom);
      case 'npc':
        return make(it.label, () => talk(it.id));
      case 'pad': {
        const owned = s.assets[it.index];
        return make(owned ? ASSETS[owned].name : '添置设备', () => layer(sheet(padSheet(it.index))));
      }
      case 'hammock':
        return make('躺一会儿', restHammock);
      case 'board':
        return make('看账本', () => layer(sheet(ledgerSheet())));
      case 'sign':
        return make('看路牌', () => toast(it.text));
      case 'node':
        if (s.cool[it.id]) return make('已经翻空了', () => toast('这里翻空了，过两天再来。'), false);
        return make('翻找', () => scavenge(it));
      case 'forage':
        if (s.cool[it.id]) return null;
        return make(it.label, () => pick(it));
      case 'water':
        return held?.id === 'rod' ? make('甩竿', castRod) : make('这里能钓鱼', () => toast('先在下面选中鱼竿。'), false);
    }
  }

  if (inGarden(tile.x, tile.y)) {
    const soil = s.soil[k];
    if (cropStage(soil) === 3) return make(`收${CROPS[soil.crop].name}`, () => doHarvest(k, tile));
    if (held?.id === 'hoe' && !soil) return make('翻地', () => doSoil(till(s, k), 'dig', tile));
    if (held?.id === 'can' && soil && !soil.wet) return make('浇水', () => doSoil(water(s, k), 'water', tile));
    if (heldItem?.crop && soil && !soil.crop) return make(`种${CROPS[heldItem.crop].name}`, () => doSoil(plant(s, k, s.sel), 'pick', tile));
  }
  if (heldItem?.food) return make(`吃${heldItem.name}`, eatHeld, false);
  return null;
}

function doSoil(error, sound, tile) {
  if (error) {
    sfx('bad');
    return toast(error);
  }
  sfx(sound);
  rt.swing = 0.18;
  if (sound === 'water') float('~', '#7cc0ea', tile.x + 0.5, tile.y);
  hud();
}

function doHarvest(k, tile) {
  const got = harvest(app.s, k);
  if (!got) return;
  if (got.error) return toast(got.error);
  sfx('pick');
  float(`+1 ${ITEMS[got.id].name}`, '#8cc66a', tile.x + 0.5, tile.y);
  hud();
}

function eatHeld() {
  const s = app.s;
  const result = eat(s, s.sel);
  if (!result) return;
  if (result.full) return toast('已经吃饱了。');
  sfx('ok');
  float(`饱食 +${result.item.food}`, '#f2c14e');
  hud();
}

function roll(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function scavenge(it) {
  const s = app.s;
  if (!useEnergy(s, RULES.energy.scavenge)) return toast('没力气了，吃点东西或者回去睡觉。');
  const loot = [];
  if (it.kind === 'crate') {
    if (Math.random() < 0.6) loot.push(['scrap', roll(1, 2)]);
    else loot.push(['tin', 1]);
  } else if (it.kind === 'car') {
    loot.push(['scrap', roll(2, 3)]);
    if (Math.random() < 0.4) loot.push(['battery', 1]);
  } else {
    loot.push(['tin', roll(1, 2)]);
    if (Math.random() < 0.3) loot.push(['battery', 1]);
  }
  let line = 0;
  for (const [id, n] of loot) {
    if (!addItem(s, id, n)) {
      toast('背包满了，装不下了。');
      continue;
    }
    float(`+${n} ${ITEMS[id].name}`, '#f2c14e', rt.p.x, rt.p.y - 1 - line++ * 0.6);
  }
  s.cool[it.id] = it.zone === 'far' ? 3 : 2;
  rt.swing = 0.18;
  sfx('pick');
  hud();
}

function pick(it) {
  const s = app.s;
  if (!useEnergy(s, RULES.energy.forage)) return toast('没力气了。');
  if (!addItem(s, it.kind, 1)) return toast('背包满了。');
  s.cool[it.id] = 2;
  float(`+1 ${ITEMS[it.kind].name}`, '#8cc66a');
  sfx('pick');
  hud();
}

function castRod() {
  const s = app.s;
  if (rt.fishing) return;
  if (!useEnergy(s, RULES.energy.fish)) return toast('没力气了。');
  rt.fishing = { phase: 'wait', t: 0, biteAt: 1.4 + Math.random() * 3.2, tile: facingTile() };
  sfx('water');
  hud();
}

function reelIn() {
  const f = rt.fishing;
  rt.fishing = null;
  if (f.phase !== 'bite') {
    sfx('bad');
    return toast('收竿太早，什么也没有。');
  }
  if (!addItem(app.s, 'fish', 1)) return toast('背包满了，鱼又放回去了。');
  sfx('coin');
  float('+1 鱼', '#7cc0ea');
  addMood(app.s, 2);
  hud();
}

function spendTime(minutes) {
  app.s.minutes += minutes;
}

function restHammock() {
  const s = app.s;
  spendTime(120);
  addMood(s, 12);
  s.energy = Math.min(100, s.energy + 12);
  sfx('ok');
  toast('你在吊床上晃了两个钟头。心情好多了。');
  hud();
}

function playConsole() {
  const s = app.s;
  spendTime(120);
  addMood(s, 25);
  sfx('ok');
  toast('打了两个钟头游戏。心情大好。');
  hud();
}

function enterRoom() {
  rt.fishing = null;
  rt.where = 'in';
  rt.room = buildRoom(!!app.s.owned.console);
  rt.p.x = rt.room.spawn.x;
  rt.p.y = rt.room.spawn.y;
  rt.p.dir = 1;
  rt.hover = null;
}

function leaveRoom() {
  rt.fishing = null;
  rt.where = 'out';
  rt.p.x = HOME_DOOR.x;
  rt.p.y = HOME_DOOR.y;
  rt.p.dir = 0;
  rt.hover = null;
}

function use() {
  if (rt.paused) return;
  if (rt.fishing) return reelIn();
  const t = findTarget();
  if (t) t.run();
}

/* ---------- 一天结束 ---------- */

function sleep(passedOut = false) {
  layer('<div class="fade night"></div>');
  setTimeout(() => {
    const report = endDay(app.s, passedOut);
    rt.where = 'in';
    rt.room = buildRoom(!!app.s.owned.console);
    rt.p.x = rt.room.bedside.x;
    rt.p.y = rt.room.bedside.y;
    rt.p.dir = 0;
    rt.fishing = null;
    rt.dogs.forEach((d) => {
      d.x = d.hx;
      d.y = d.hy;
      d.chasing = false;
    });
    save();
    layer(morningHtml(report));
  }, 600);
}

function dogBite() {
  const s = app.s;
  const fee = Math.min(s.money, Math.max(8, Math.round(s.money * RULES.dogFee)));
  spend(s, fee, 'other');
  s.energy = Math.max(0, s.energy - 35);
  addMood(s, -10);
  spendTime(120);
  leaveRoom();
  rt.dogs.forEach((d) => (d.chasing = false));
  sfx('bad');
  layer(dialog('被野狗咬了', `<p>你一路跑回营地，找人包扎花了 ${fee}，还耽误了两个钟头。</p><p class="hint">废墟深处东西值钱，但这种意外的开销说来就来。手里一分钱都不留的话，下次只能去借。</p>`, [['回去歇会儿', 'close', 'primary']]));
}

/* ---------- 对话 ---------- */

const sheet = (body) => `<div class="overlay" data-act="close"><div class="sheet" role="dialog" aria-modal="true">
  <button class="icon-btn close" data-act="close" data-close aria-label="关闭">${ICONS.close}</button>${body}</div></div>`;

function dialog(title, body, buttons, stamp = '') {
  return `<div class="overlay"><div class="dialog" role="dialog" aria-modal="true">
    ${stamp ? `<p class="stamp">${stamp}</p>` : ''}<h2>${title}</h2>${body}
    <div class="stack">${buttons.map(([label, actName, cls = '', extra = '']) => `<button class="btn wide ${cls}" data-act="${actName}" ${extra} ${actName === 'close' ? 'data-close' : ''}>${label}</button>`).join('')}</div>
  </div></div>`;
}

function introHtml() {
  return dialog(
    '搬进铁皮屋',
    `<p>末日后第三年。你不想当英雄，也不想重建文明，只想找个地方躺着。</p>
     <p>房东老周把营地边上这间铁皮屋租给了你，<b>每五天收一次租，${rentNow(app.s)} 块</b>。你兜里有 ${app.s.money} 块、几包青菜种子、两个罐头。</p>
     <p class="hint">屋子右边围起来的那块地可以种菜。往东是营地广场，有小卖部和奶茶摊。怎么过，随你。</p>`,
    [['先转转看', 'close', 'primary']],
    '第 1 天 · 早晨',
  );
}

function sleepHtml() {
  const s = app.s;
  const early = s.minutes < 8 * 60;
  return dialog(
    '睡觉',
    `<p>睡一觉就到明天早上。${s.food < 30 ? '你现在饿着肚子，睡醒体力只能恢复一部分。' : ''}</p>${early ? '<p class="hint">天还早。不过想睡就睡，没人管你。</p>' : ''}`,
    [
      ['睡到明天', 'sleep', 'primary'],
      ['再等等', 'close'],
    ],
    `第 ${s.day} 天 · ${clockText(s)}`,
  );
}

function entries(lines) {
  if (!lines.length) return '';
  return `<ul class="feed">${lines.map((e) => `<li class="entry ${e.tone}"><span>${e.text}</span>${e.delta ? `<b>${signed(e.delta)}</b>` : ''}</li>`).join('')}</ul>`;
}

function reviewHtml(r) {
  const row = (label, n, tone) => (n ? `<div><dt>${label}</dt><dd class="${tone}">${n}</dd></div>` : '');
  return `<section class="review">
    <p class="stamp">过去 ${r.days} 天，你是</p>
    <h3>${r.title}</h3>
    <p>${r.text}</p>
    <p class="real">${r.real}</p>
    <dl class="tally">
      ${row('打零工赚的', r.income.wage, 'good')}${row('卖东西赚的', r.income.sales, 'good')}${row('设备自己赚的', r.income.passive, 'good')}
      ${row('房租', r.spent.rent, 'bad')}${row('吃的', r.spent.food, 'bad')}${row('享受', r.spent.fun, 'bad')}${row('种子', r.spent.biz, 'bad')}${row('买设备', r.spent.invest, 'bad')}${row('利息', r.spent.interest, 'bad')}${row('意外', r.spent.other, 'bad')}
    </dl>
  </section>`;
}

function morningHtml(report) {
  const s = app.s;
  const free = report.freed
    ? `<section class="review free"><p class="stamp">从今天起</p><h3>财富自由</h3>
        <p>院子里的设备每天自己赚 ${passiveIncome(s)}，你每天最少只需要花 ${livingCost(s)}。不干活也饿不着、住得起了。</p>
        <p class="real">现实里的财富自由也是这个意思：被动收入盖过了生活开支。日子还长，接下来想干什么都行。</p></section>`
    : '';
  return `<div class="overlay"><div class="dialog morning" role="dialog" aria-modal="true">
    <p class="stamp">早晨</p><h2>第 ${s.day} 天</h2>
    ${entries(report.lines)}
    <p class="stockline">手里有 <b>${s.money}</b>${s.debt ? `，欠款 <b class="owe-text">${s.debt}</b>` : ''}</p>
    ${free}${report.review ? reviewHtml(report.review) : ''}
    <button class="btn primary wide" data-act="close" data-close>起床</button>
  </div></div>`;
}

function talk(id) {
  const s = app.s;
  if (id === 'zhou') {
    const toRent = daysToRent(s);
    const tips = [];
    if (s.debt > 0) tips.push('欠金老板的钱每天涨半成，能还就先还。');
    else if (s.money < rentNow(s) && toRent <= 2) tips.push('房租还没凑够吧？交不上的话，差的部分加两成记账。');
    else if (s.assets.length === 0 && s.money >= 100) tips.push('手里有闲钱了？院子里的空地可以添设备，它们每天自己赚钱。');
    else if (s.mood < RULES.lowMood) tips.push('你脸色不好。心情差的时候干活更费劲，去喝杯奶茶、躺会儿吊床吧。');
    else tips.push('物价每五天涨一回。钱光攒着会越来越不值钱。');
    return layer(
      dialog(
        '房东老周',
        `<p class="say">${toRent === 1 ? '明天一早' : `还有 ${toRent} 天`}收租，${rentNow(s)} 块。${tips[0]}</p>
         <p class="hint">搬砖：干 ${RULES.job.hours} 个钟头，花 ${energyCost(s, RULES.job.energy)} 体力，挣 ${price(s, RULES.job.pay)}。一天只能干一次。</p>`,
        [
          [`搬砖挣 ${price(s, RULES.job.pay)}`, 'job', 'primary'],
          ['回头再说', 'close'],
        ],
      ),
    );
  }
  if (id === 'mei') return layer(sheet(shopSheet('buy')));
  if (id === 'jin') return layer(sheet(loanSheet()));
  if (id === 'tea') {
    const cost = price(s, ITEMS.tea.buy);
    return layer(
      dialog('奶茶摊小桃', `<p class="say">末日也得喝点甜的。一杯 ${cost} 块，现做现喝。</p><p class="hint">喝了心情 +${ITEMS.tea.mood}。心情太差的时候，干什么都更费体力。</p>`, [
        [`来一杯（${cost}）`, 'tea', 'primary'],
        ['不了', 'close'],
      ]),
    );
  }
}

function shopSheet(tab) {
  const s = app.s;
  const tabs = `<div class="tabs"><button class="btn small ${tab === 'buy' ? 'primary' : ''}" data-act="shop" data-tab="buy">买</button><button class="btn small ${tab === 'sell' ? 'primary' : ''}" data-act="shop" data-tab="sell">卖</button></div>`;
  if (tab === 'sell') {
    const rows = s.inv
      .map((slot, i) => {
        const item = slot && ITEMS[slot.id];
        if (!item?.sell) return '';
        const each = price(s, item.sell);
        return `<li><img class="thumb" alt="" src="${iconUrl(slot.id)}"><div class="what"><b>${item.name} ×${slot.n}</b><small>每个 ${each}</small></div>
          <div class="pair"><button class="btn small" data-act="sell" data-i="${i}">卖 1</button><button class="btn small primary" data-act="sell" data-i="${i}" data-all="1">全卖 ${each * slot.n}</button></div></li>`;
      })
      .join('');
    return `<p class="stamp">小卖部阿梅</p><h2>卖东西</h2>${tabs}<ul class="catalog">${rows || '<li class="none">你身上没有她收的东西。菜、鱼、废铁、电池她都要。</li>'}</ul>`;
  }
  const goods = SHOP.map((id) => {
    const item = ITEMS[id];
    const cost = price(s, item.buy);
    const note = item.crop ? `${CROPS[item.crop].days} 天成熟，能卖 ${price(s, ITEMS[item.crop].sell)}${CROPS[item.crop].regrow ? '，之后每 2 天再结一次' : ''}` : `吃了饱食 +${item.food}`;
    return `<li><img class="thumb" alt="" src="${iconUrl(id)}"><div class="what"><b>${item.name}</b><small>${note}</small></div>
      <button class="btn primary" data-act="buy" data-id="${id}" ${s.money < cost ? 'disabled' : ''}><span>${cost}</span><small>买</small></button></li>`;
  }).join('');
  const lux = Object.entries(LUXURY)
    .map(([id, l]) => {
      const cost = price(s, l.cost);
      return `<li><img class="thumb" alt="" src="${(id === 'bike' ? art().bike : art().tv[0]).toDataURL()}"><div class="what"><b>${l.name}</b><small>${l.note}</small></div>
        <button class="btn primary" data-act="lux" data-id="${id}" ${s.owned[id] || s.money < cost ? 'disabled' : ''}><span>${cost}</span><small>${s.owned[id] ? '已有' : '买'}</small></button></li>`;
    })
    .join('');
  return `<p class="stamp">小卖部阿梅</p><h2>买东西</h2>${tabs}<ul class="catalog">${goods}${lux}</ul><p class="hint">你有 ${s.money}。</p>`;
}

function padSheet(index) {
  const s = app.s;
  const owned = s.assets[index];
  if (owned) {
    const a = ASSETS[owned];
    const back = Math.floor(a.cost / 2);
    return `<p class="stamp">院子里的设备</p><h2>${a.name}</h2><p>${a.note}。每天早上自动进账 <b class="good">${price(s, a.income)}</b>，物价涨它也跟着涨。</p>
      <p class="hint">当初花钱买的，转手只能卖 ${back}。</p>
      <button class="btn wide danger" data-act="sell-asset" data-i="${index}">卖掉，换回 ${back}</button>`;
  }
  const rows = Object.entries(ASSETS)
    .map(([id, a]) => {
      const cost = price(s, a.cost);
      return `<li><img class="thumb" alt="" src="${art().asset[id][0].toDataURL()}"><div class="what"><b>${a.name}</b><small>${a.note}</small><small class="pay">每天 +${price(s, a.income)}，约 ${Math.ceil(a.cost / a.income)} 天回本</small></div>
        <button class="btn primary" data-act="asset" data-id="${id}" ${s.money < cost ? 'disabled' : ''}><span>${cost}</span><small>${s.money < cost ? `差 ${cost - s.money}` : '买'}</small></button></li>`;
    })
    .join('');
  return `<p class="stamp">买下来，它就每天自己赚钱</p><h2>添置设备</h2><ul class="catalog">${rows}</ul>
    <p class="hint">你有 ${s.money}。现在每天最少要花 ${livingCost(s)}，设备每天自己赚 ${passiveIncome(s)}。</p>`;
}

function loanSheet() {
  const s = app.s;
  const room = RULES.borrowMax - s.debt;
  const can = Math.min(s.debt, s.money);
  return `<p class="stamp">金老板 · 每天利息半成</p><h2>${s.debt ? `欠款 ${s.debt}` : '借钱'}</h2>
    <p class="say">${s.debt ? `不还的话明天就是 ${s.debt + Math.ceil(s.debt * RULES.interest)}。利息还会再生利息。` : '缺钱？我这儿随借随有。每天只收半成利息，很公道。'}</p>
    <p class="hint">欠到超过 ${RULES.debtCap}，他会派人搬走你院子里最值钱的设备。</p>
    ${s.debt ? `<div class="steps"><span class="label">还钱</span>${[50].filter((n) => n < can).map((n) => `<button class="btn" data-act="repay" data-n="${n}">还 ${n}</button>`).join('')}<button class="btn primary" data-act="repay" data-n="${can}" ${can ? '' : 'disabled'}>${can >= s.debt ? `还清 ${s.debt}` : can ? `能还 ${can}` : '没钱可还'}</button></div>` : ''}
    <div class="steps"><span class="label">借钱</span>${[50, 100].filter((n) => n <= room).map((n) => `<button class="btn" data-act="borrow" data-n="${n}">借 ${n}</button>`).join('') || '<span class="hint">他不肯再借了。</span>'}</div>`;
}

function ledgerSheet() {
  const s = app.s;
  const p = s.period;
  const passive = passiveIncome(s);
  const cost = livingCost(s);
  const row = (label, n, tone = '') => `<div><dt>${label}</dt><dd class="${tone}">${n}</dd></div>`;
  return `<p class="stamp">第 ${s.day} 天 · 我的账本</p><h2>身家 ${netWorth(s)}</h2>
    <div class="flow big"><div class="track"><div class="fill ${passive >= cost ? 'full' : ''}" style="width:${Math.min(100, (passive / cost) * 100).toFixed(0)}%"></div></div>
      <span>设备每天自己赚 <b class="good">${passive}</b>，每天最少要花 <b class="bad">${cost}</b>${s.free ? '。你已经财富自由了。' : passive >= cost && s.debt ? '。还清欠款就自由了。' : `，还差 ${Math.max(0, cost - passive)}。`}</span></div>
    <h3 class="label">这次交租以来</h3>
    <dl class="tally">
      ${row('打零工赚的', p.wage, 'good')}${row('卖东西赚的', p.sales, 'good')}${row('设备自己赚的', p.passive, 'good')}
      ${row('吃的', p.food, 'bad')}${row('享受', p.fun, 'bad')}${row('种子', p.biz, 'bad')}${row('买设备', p.invest, 'bad')}${row('利息', p.interest, 'bad')}
    </dl>
    <p class="hint">${daysToRent(s)} 天后交租 ${rentNow(s)}。每天最少要花的钱 = 房租摊到每天 + 两顿饭 + 电费。${s.free ? '' : '设备赚的钱盖过它，而且不欠债，就算财富自由。'}</p>`;
}

function menuSheet() {
  return `<p class="stamp">第 ${app.s.day} 天</p><h2>歇一下</h2><p>进度会自动保存。</p>
    <div class="stack"><button class="btn primary wide" data-act="close" data-close>接着过</button><button class="btn wide" data-act="home">回到首页</button></div>`;
}

/* ---------- 点击与按键 ---------- */

function refresh(html) {
  save();
  hud();
  layer(html);
}

root.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const s = app.s;
  const d = el.dataset;
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
    case 'ledger':
      return layer(sheet(ledgerSheet()));
    case 'use':
      return use();
    case 'slot':
      s.sel = Number(d.i);
      return hud();
    case 'close':
      if (event.target.closest('.sheet, .dialog') && !event.target.closest('[data-close]')) return;
      return layer('');
    case 'sleep':
      return sleep(false);
    case 'job': {
      const error = doJob(s);
      if (error) {
        sfx('bad');
        toast(error);
      } else {
        sfx('coin');
        toast(`搬了一下午砖，挣了 ${price(s, RULES.job.pay)}。`);
      }
      save();
      return layer('');
    }
    case 'tea': {
      const cost = price(s, ITEMS.tea.buy);
      if (!spend(s, cost, 'fun')) return toast('钱不够。');
      addMood(s, ITEMS.tea.mood);
      s.food = Math.min(100, s.food + ITEMS.tea.food);
      sfx('ok');
      toast('甜。心情好多了。');
      save();
      return layer('');
    }
    case 'shop':
      return layer(sheet(shopSheet(d.tab)));
    case 'buy': {
      const error = buy(s, d.id);
      if (error) toast(error);
      else sfx('coin');
      return refresh(sheet(shopSheet('buy')));
    }
    case 'lux': {
      const error = buyLuxury(s, d.id);
      if (error) toast(error);
      else {
        sfx('coin');
        toast(d.id === 'console' ? '游戏机送到屋里了。' : '电动车停在门口了，走路快多了。');
      }
      return refresh(sheet(shopSheet('buy')));
    }
    case 'sell': {
      const got = sell(s, Number(d.i), !!d.all);
      if (got) sfx('coin');
      return refresh(sheet(shopSheet('sell')));
    }
    case 'asset': {
      const error = buyAsset(s, d.id, PADS.length);
      if (error) {
        toast(error);
        return;
      }
      sfx('coin');
      toast(`${ASSETS[d.id].name}装好了，明早开始进账。`);
      unstick();
      save();
      return layer('');
    }
    case 'sell-asset': {
      const id = s.assets[Number(d.i)];
      s.assets.splice(Number(d.i), 1);
      earn(s, Math.floor(ASSETS[id].cost / 2), 'sales');
      save();
      return layer('');
    }
    case 'borrow': {
      const error = borrow(s, Number(d.n));
      if (error) toast(error);
      else sfx('coin');
      return refresh(sheet(loanSheet()));
    }
    case 'repay':
      repay(s, Number(d.n));
      sfx('ok');
      return refresh(sheet(loanSheet()));
  }
});

// 设备装在脚下时，把人挪开，免得卡在里面。
function unstick() {
  const p = rt.p;
  for (let i = 0; i < 8 && blocked(p.x, p.y); i++) p.y += 0.5;
  if (blocked(p.x, p.y)) {
    p.x = HOME_DOOR.x;
    p.y = HOME_DOOR.y;
  }
}

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
    if (rt.paused) {
      if (document.querySelector('#layer [data-close]')) layer('');
    } else layer(sheet(menuSheet()));
    return;
  }
  if (rt.paused) {
    if ((k === ' ' || k === 'Enter') && !event.repeat) {
      const btn = document.querySelector('#layer .dialog .btn.primary, #layer .sheet .btn.wide.primary');
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
  } else if (/^[0-9]$/.test(k)) {
    app.s.sel = (Number(k) + 9) % 10;
    hud();
  } else if (k === 'Tab') {
    event.preventDefault();
    layer(sheet(ledgerSheet()));
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

function updateDogs(dt) {
  const p = rt.p;
  for (const d of rt.dogs) {
    const toP = Math.hypot(p.x - d.x, p.y - d.y);
    const fromHome = Math.hypot(d.x - d.hx, d.y - d.hy);
    if (!d.chasing && toP < 5) d.chasing = true;
    if (d.chasing && (toP > 8 || fromHome > 12)) {
      d.chasing = false;
      d.tx = d.hx;
      d.ty = d.hy;
    }
    let speed = 3.5;
    if (d.chasing) {
      d.tx = p.x;
      d.ty = p.y;
    } else {
      speed = 1.3;
      d.wait -= dt;
      if (d.wait <= 0 && Math.hypot(d.tx - d.x, d.ty - d.y) < 0.3) {
        d.wait = 1 + Math.random() * 2;
        d.tx = d.hx + (Math.random() - 0.5) * 5;
        d.ty = d.hy + (Math.random() - 0.5) * 5;
      }
    }
    const dx = d.tx - d.x;
    const dy = d.ty - d.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.1) {
      const before = d.x + d.y;
      moveBody(d, (dx / len) * speed * dt, (dy / len) * speed * dt);
      if (Math.abs(dx) > 0.2) d.face = dx > 0 ? 1 : -1;
      if (before !== d.x + d.y) d.step += dt * (d.chasing ? 10 : 5);
      else if (!d.chasing) {
        d.tx = d.x;
        d.ty = d.y;
      }
    }
    if (toP < 0.6) return true;
  }
  return false;
}

function update(dt) {
  rt.time += dt;
  rt.floats.forEach((f) => (f.t += dt));
  rt.floats = rt.floats.filter((f) => f.t < 1.3);
  if (rt.swing > 0) rt.swing -= dt;
  if (rt.paused) return;
  const s = app.s;
  const p = rt.p;

  s.minutes += (dt * RULES.dayHours * 60) / RULES.daySeconds;
  if (s.minutes >= RULES.dayHours * 60) {
    toast('熬到半夜，你一头栽倒了。');
    return sleep(true);
  }

  const [vx, vy, dir] = inputVector();
  if (vx || vy) {
    if (rt.fishing) rt.fishing = null;
    const speed = 4.3 * (s.owned.bike && rt.where === 'out' ? 1.45 : 1);
    moveBody(p, vx * speed * dt, vy * speed * dt);
    p.dir = dir;
    const before = Math.floor(p.step);
    p.step += dt * 8;
    if (Math.floor(p.step) !== before && Math.floor(p.step) % 2 === 0) sfx('step');
  } else p.step = 0;

  if (rt.fishing) {
    const f = rt.fishing;
    f.t += dt;
    if (f.phase === 'wait' && f.t >= f.biteAt) {
      f.phase = 'bite';
      f.t = 0;
      sfx('bite');
    } else if (f.phase === 'bite' && f.t > 0.85) {
      rt.fishing = null;
      toast('鱼跑了。看到感叹号就马上收竿。');
    }
  }

  if (rt.where === 'out' && updateDogs(dt)) return dogBite();

  const target = rt.fishing ? { label: rt.fishing.phase === 'bite' ? '收竿！' : '等鱼上钩…', mark: false } : findTarget();
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
      clock.classList.toggle('late', s.minutes > 16 * 60);
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

function spriteFor(A, thing, frameNo) {
  const name = thing.art;
  if (name === 'tree') return A.tree[thing.variant ?? 0];
  if (name === 'bush') return A.bush[app.s.cool[thing.forage] ? 0 : 1];
  if (name === 'mushroom') return app.s.cool[thing.forage] ? null : A.mushroom;
  if (name.startsWith('node:')) return A.node[name.slice(5)][app.s.cool[thing.node] ? 1 : 0];
  if (name === 'tv') return A.tv[frameNo];
  return A[name];
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
  // 电脑上大约看到 520 格，手机上 200 格；取整数倍放大，像素才不会糊
  const tiles = canvas.clientWidth > 700 ? 520 : 200;
  const zoom = Math.max(2, Math.round(Math.sqrt((cw * ch) / tiles) / T));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const A = art();
  const m = here();
  const inRoom = rt.where === 'in';
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
        const inside = x >= 1 && y >= 2 && x < m.w - 1 && y < m.h - 1;
        const wall = y === 1 && x >= 1 && x < m.w - 1;
        ctx.drawImage(inside ? A.plank : wall ? A.wall : A.roof, px, py);
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
      else if (g === CONCRETE) ctx.drawImage(A.concrete[hash(x, y) % 3], px, py);
      else ctx.drawImage(A.grass[hash(x, y) % 8], px, py);
      const soil = s.soil[key(x, y)];
      if (soil) {
        ctx.drawImage(A.soil[soil.wet ? 1 : 0], px, py);
        const stage = cropStage(soil);
        if (stage >= 0) ctx.drawImage(A.crops[soil.crop][stage], px, py - 2);
      }
    }
  }

  /* 立着的东西，按底边从上到下画 */
  const list = [];
  const seen = (t) => t.x + t.fw + 1 >= x0 && t.x - 2 <= x1 && t.y + t.fh >= y0 && t.y - 3 <= y1;
  for (const t of m.things) {
    if (!seen(t)) continue;
    const sprite = spriteFor(A, t, frameNo);
    if (!sprite) continue;
    const dx = Math.round((t.x + t.fw / 2) * T - sprite.width / 2);
    const dy = (t.y + t.fh) * T - sprite.height;
    if (t.flat) ctx.drawImage(sprite, dx, dy);
    else list.push([(t.y + t.fh) * T, () => ctx.drawImage(sprite, dx, dy)]);
  }
  if (!inRoom) {
    PADS.forEach((pad, i) => {
      const id = s.assets[i];
      if (!id) return ctx.drawImage(A.pad, pad.x * T, pad.y * T);
      const sprite = A.asset[id][frameNo];
      list.push([(pad.y + 2) * T, () => ctx.drawImage(sprite, pad.x * T + 16 - sprite.width / 2, (pad.y + 2) * T - sprite.height)]);
    });
    if (s.owned.bike) list.push([11 * T, () => ctx.drawImage(A.bike, 11 * T, 10 * T)]);
    for (const n of m.npcs) {
      list.push([
        (n.y + 1) * T,
        () => {
          shadow(ctx, (n.x + 0.5) * T, (n.y + 1) * T - 2);
          ctx.drawImage(A.people[n.id][n.face][0], n.x * T, n.y * T - 7);
        },
      ]);
    }
    for (const d of rt.dogs) {
      list.push([
        d.y * T + 6,
        () => {
          shadow(ctx, d.x * T, d.y * T + 5);
          ctx.drawImage((d.face > 0 ? A.dogR : A.dogL)[Math.floor(d.step) % 2], Math.round(d.x * T) - 9, Math.round(d.y * T) - 9);
          if (d.chasing) {
            ctx.fillStyle = '#d2583f';
            ctx.fillRect(Math.round(d.x * T) - 1, Math.round(d.y * T) - 16, 2, 4);
            ctx.fillRect(Math.round(d.x * T) - 1, Math.round(d.y * T) - 11, 2, 2);
          }
        },
      ]);
    }
  }
  list.push([
    p.y * T + 7,
    () => {
      const walking = p.step > 0;
      const f = walking ? 1 + (Math.floor(p.step) % 2) : 0;
      const lean = rt.swing > 0 ? 1 : 0;
      shadow(ctx, p.x * T, p.y * T + 6);
      ctx.drawImage(A.people.player[p.dir][f], Math.round(p.x * T) - 8 + DIRS[p.dir][0] * lean, Math.round(p.y * T) - 15 + DIRS[p.dir][1] * lean);
    },
  ]);
  list.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());

  /* 面前那一格的框 */
  const t = rt.target;
  if (t && t.mark && !rt.paused) {
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

  /* 钓鱼的浮标 */
  if (rt.fishing) {
    const f = rt.fishing;
    const bx = (f.tile.x + 0.5) * T;
    const by = (f.tile.y + 0.5) * T + (f.phase === 'bite' ? 2 : Math.round(Math.sin(rt.time * 4)));
    ctx.strokeStyle = '#f3efe6';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(p.x * T, p.y * T - 8);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.fillStyle = '#d2583f';
    ctx.fillRect(bx - 1, by - 1, 3, 3);
    if (f.phase === 'bite') {
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(Math.round(p.x * T) - 1, Math.round(p.y * T) - 26, 3, 6);
      ctx.fillRect(Math.round(p.x * T) - 1, Math.round(p.y * T) - 18, 3, 2);
    }
  }

  /* 飘字 */
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  for (const f of rt.floats) {
    const y = f.y * T - f.t * 14;
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.3);
    ctx.fillStyle = '#2b2437';
    ctx.fillText(f.text, f.x * T + 0.5, y + 0.5);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x * T, y);
  }
  ctx.globalAlpha = 1;

  /* 天色 */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!inRoom) {
    const late = Math.max(0, (s.minutes - 11.5 * 60) / (6.5 * 60));
    if (late > 0) {
      ctx.fillStyle = late < 0.35 ? `rgba(255, 150, 80, ${(late * 0.3).toFixed(3)})` : `rgba(24, 20, 60, ${Math.min(0.6, (late - 0.25) * 0.8).toFixed(3)})`;
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

function shadow(ctx, x, y) {
  ctx.fillStyle = 'rgba(43,36,55,0.25)';
  ctx.fillRect(Math.round(x) - 5, Math.round(y), 10, 2);
  ctx.fillRect(Math.round(x) - 4, Math.round(y) + 2, 8, 1);
}

/* ---------- 启动 ---------- */

// 调试用：地址以 #debug 结尾时，把内部状态挂到 window 上，方便自动化测试。
if (location.hash === '#debug') window.__game = { app, rt, hud, layer, sleep, use, takeItem };

const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ s: app.s }));
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
