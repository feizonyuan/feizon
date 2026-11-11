// 主程序：首页、可以走动的游戏画面、结算页。
import {
  RULES,
  newGame,
  act,
  production,
  expenses,
  buildCost,
  dismantleValue,
  isWinter,
  weeksToWinter,
} from '../engine/engine.js';
import { FACILITIES } from '../data/facilities.js';
import { chapterById } from '../data/chapters.js';
import { ICONS } from './icons.js';
import { advise, runway } from './advisor.js';
import { reportHtml, shareText } from './report.js';
import { T, sprites } from '../game/sprites.js';
import {
  WORLD,
  IN_W,
  IN_H,
  PADS,
  FIXTURES,
  makeOutside,
  spawnDogs,
  insideSolid,
  move,
  packCapacity,
  lootRoll,
  updateDogs,
} from '../game/world.js';

const SAVE_KEY = 'shelter.save.v2';
const META_KEY = 'shelter.meta.v2';
const CHAPTER = 3;

const root = document.getElementById('app');

const store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 存不了就不存，游戏照常进行 */
    }
  },
};

const app = {
  screen: 'home',
  game: null,
  cools: [], // 每个物资点还要几天才会重新有东西
  meta: { best: null, wins: 0, ...store.read(META_KEY, {}) },
  dayLog: [],
  morning: false,
  greeted: false,
};

// 只在游戏画面存在的运行时状态，不存档
const rt = {
  mode: 'inside',
  outside: null,
  dogs: [],
  solid: null,
  player: { x: 2.4, y: 4.4, face: 1, step: 0 },
  clock: 0,
  pack: 0,
  search: null,
  floats: [],
  shake: 0,
  paused: false,
  target: null,
  keys: new Set(),
  stick: null,
  duskWarned: false,
  time: 0,
  raf: 0,
  last: 0,
};

/* ---------- 存档与流程 ---------- */

function persist() {
  if (app.game && app.game.status === 'playing') {
    store.write(SAVE_KEY, { game: app.game, cools: app.cools, greeted: app.greeted });
  } else store.write(SAVE_KEY, null);
  store.write(META_KEY, app.meta);
}

function boot(data = {}) {
  const saved = data.game ? data : store.read(SAVE_KEY, null);
  if (saved?.game?.status === 'playing') {
    app.game = saved.game;
    app.cools = saved.cools ?? [];
    app.greeted = saved.greeted ?? true;
  }
  show('home');
}

function startNew() {
  const seed = (Math.floor(Math.random() * 0xffffffff) || 1) >>> 0;
  app.game = newGame(seed, CHAPTER);
  app.cools = [];
  app.dayLog = [];
  app.morning = false;
  app.greeted = false;
  persist();
  show('game');
}

function show(screen) {
  cancelAnimationFrame(rt.raf);
  app.screen = screen;
  root.className = `screen-${screen}`;
  window.scrollTo(0, 0);
  if (screen === 'home') root.innerHTML = homeHtml();
  else if (screen === 'end') root.innerHTML = reportHtml(app.game, app.meta);
  else mountGame();
}

// 执行一个引擎动作，记下它产生的记录。返回是否成功。
function play(action) {
  const before = app.game;
  let next;
  try {
    next = act(before, action);
  } catch (err) {
    toast(err.message);
    return false;
  }
  app.game = next;
  app.dayLog.push(...next.log);
  if (next.week !== before.week) startDay();
  if (next.status !== 'playing') {
    if (next.status === 'won') {
      app.meta.wins += 1;
      if (!app.meta.best || next.week < app.meta.best) app.meta.best = next.week;
    }
  }
  persist();
  updateHud();
  return true;
}

function startDay() {
  app.cools = app.cools.map((c) => Math.max(0, c - 1));
  app.morning = true;
  rt.clock = 0;
  rt.pack = 0;
  rt.duskWarned = false;
  goInside(false);
  rt.player.x = 2.4;
  rt.player.y = 4.4;
}

// 决定接下来该弹出什么：结局、事件、早晨的账，或者什么都不弹。
function flow() {
  const g = app.game;
  if (g.status !== 'playing') {
    rt.paused = true;
    layer(`<div class="fade ${g.status}"></div>`);
    setTimeout(() => show('end'), 1200);
    return;
  }
  if (g.pending?.id === 'crisis') return layer(eventHtml(g));
  if (app.morning) return layer(morningHtml(g));
  if (g.pending) return layer(eventHtml(g));
  if (!app.greeted) return layer(greetHtml());
  layer('');
}

/* ---------- 首页 ---------- */

function homeHtml() {
  const saved = app.game && app.game.status === 'playing';
  return `<div class="home">
    <header class="masthead">
      <div class="hazard" aria-hidden="true"></div>
      <p class="stamp">B-07 号避难所 · 值班手册</p>
      <h1>避难所<span>不再出门</span></h1>
      <p class="lede">每天大家都要吃饭，物资只能靠你出门去废墟里找，天黑前还得赶回来。在避难所里建起能自己产粮的设施，等自产够吃，你就再也不用出门了。</p>
    </header>

    <div class="stack">
      ${
        saved
          ? `<button class="resume" data-act="continue">
              <span><b>继续上次的对局</b><small>第 ${app.game.week} 天 · 存粮 ${app.game.supplies}</small></span><i>${ICONS.arrow}</i>
            </button>`
          : ''
      }
      <button class="btn ${saved ? '' : 'primary'} wide big-btn" data-act="start">${saved ? '重新开始' : '开始值班'}</button>
      ${app.meta.best ? `<p class="fine">你最快用 ${app.meta.best} 天让避难所自给自足。</p>` : ''}
    </div>

    <section class="rules">
      <h2 class="label">怎么玩</h2>
      <ol>
        <li><span><b>走动。</b>手机上按住屏幕拖动，电脑上用方向键或 WASD。</span></li>
        <li><span><b>互动。</b>走到东西旁边，点右下角的按钮，或按空格键。</span></li>
        <li><span><b>白天出门搜刮。</b>爬梯子出去，搜箱子和废车，背包满了就回来。越远东西越多，野狗也越多。</span></li>
        <li><span><b>天黑前回来睡觉。</b>睡一觉过一天，所有人吃掉一天的口粮。</span></li>
        <li><span><b>建设施。</b>设施每天自己产粮，不用你出门。自产够吃而且不欠粮，就赢了。</span></li>
      </ol>
    </section>
    <p class="fine">一局大约十五分钟。进度在每天早晨保存到这台设备的浏览器里。</p>
  </div>`;
}

/* ---------- 游戏画面 ---------- */

function mountGame() {
  root.innerHTML = `<div class="play">
    <canvas id="view" aria-label="游戏画面"></canvas>
    <div class="hud" id="hud"></div>
    <button class="act" id="act" data-act="interact" hidden></button>
    <div id="layer"></div>
  </div>`;
  rt.outside = makeOutside(app.game.seed);
  if (app.cools.length !== rt.outside.nodes.length) app.cools = rt.outside.nodes.map(() => 0);
  rt.clock = 0;
  rt.pack = 0;
  rt.floats = [];
  rt.search = null;
  rt.keys.clear();
  rt.stick = null;
  goInside(false);
  rt.player.x = 2.4;
  rt.player.y = 4.4;
  bindCanvas(document.getElementById('view'));
  updateHud();
  rt.last = performance.now();
  rt.raf = requestAnimationFrame(frame);
  flow();
}

function goInside(deposit) {
  rt.mode = 'inside';
  rt.search = null;
  rt.solid = insideSolid(Math.min(app.game.facilities.length, PADS.length));
  rt.player.x = FIXTURES.ladder.x + 0.5;
  rt.player.y = 2.5;
  if (deposit && rt.pack > 0) {
    const amount = rt.pack;
    rt.pack = 0;
    play({ type: 'gather', amount });
    float(FIXTURES.stock.x + 1, FIXTURES.stock.y, `+${amount}`, '#7ed6a0');
  }
}

function goOutside() {
  const g = app.game;
  if (g.injuredWeeks > 0) return toast(`伤还没好，还得躺 ${g.injuredWeeks} 天。去床上睡觉吧。`);
  rt.mode = 'outside';
  rt.dogs = spawnDogs(rt.outside);
  rt.player.x = rt.outside.spawn.x;
  rt.player.y = rt.outside.spawn.y;
  updateHud();
}

function layer(html) {
  const el = document.getElementById('layer');
  if (!el) return;
  el.innerHTML = html;
  rt.paused = html !== '';
  rt.keys.clear();
  rt.stick = null;
}

function float(x, y, text, color) {
  rt.floats.push({ x, y, text, color, t: 0 });
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const signed = (n) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));

function clockText() {
  const minutes = 6 * 60 + Math.floor(Math.min(1, rt.clock) * 14 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor((minutes % 60) / 10) * 10).padStart(2, '0')}`;
}

function updateHud() {
  const hud = document.getElementById('hud');
  if (!hud || !app.game) return;
  const g = app.game;
  const made = production(g);
  const used = expenses(g);
  const ratio = Math.min(1, made / used);
  const to = weeksToWinter(g);
  const season = to === 0 ? '寒冬' : to !== null && to <= 3 ? `${to} 天后入冬` : '';
  hud.innerHTML = `
    <div class="hud-row">
      <div class="hud-day ${to === 0 ? 'cold' : ''}"><b>第 ${g.week} 天</b>${season ? `<small>${season}</small>` : ''}</div>
      <div class="hud-clock" id="clock">${clockText()}</div>
      <button class="icon-btn" data-act="menu" aria-label="菜单">${ICONS.menu}</button>
    </div>
    <div class="hud-row">
      <div class="pill stock"><small>仓库</small><b>${g.supplies}</b></div>
      ${rt.mode === 'outside' ? `<div class="pill pack"><small>背包</small><b id="pack">${rt.pack}</b><small>/ ${packCapacity(g)}</small></div>` : ''}
      ${g.debt > 0 ? `<div class="pill owe"><small>欠粮</small><b>${g.debt}</b></div>` : ''}
      ${g.injuredWeeks > 0 ? `<div class="pill hurt"><small>养伤</small><b>${g.injuredWeeks}</b><small>天</small></div>` : ''}
    </div>
    <div class="hud-gauge">
      <div class="track"><div class="fill ${ratio >= 1 ? 'full' : ''}" style="width:${(ratio * 100).toFixed(1)}%"></div></div>
      <span>自产 <b class="good">${made}</b> / 每天吃 ${used}</span>
    </div>`;
}

/* ---------- 互动目标 ---------- */

function rectDistance(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

function findTarget() {
  const p = rt.player;
  const g = app.game;
  let best = null;
  const consider = (dist, target) => {
    if (dist <= WORLD.reach && (!best || dist < best.dist)) best = { dist, ...target };
  };
  if (rt.mode === 'inside') {
    consider(rectDistance(p.x, p.y, FIXTURES.bed), { kind: 'bed', label: '睡觉', mark: [FIXTURES.bed.x + 0.5, 2] });
    consider(rectDistance(p.x, p.y, FIXTURES.zhou), { kind: 'zhou', label: '找老周', mark: [FIXTURES.zhou.x + 0.5, 2] });
    consider(rectDistance(p.x, p.y, FIXTURES.radio), { kind: 'radio', label: '对讲机', mark: [FIXTURES.radio.x + 0.5, 1.4] });
    consider(rectDistance(p.x, p.y, FIXTURES.stock), { kind: 'stock', label: '看账本', mark: [FIXTURES.stock.x + 1, 2] });
    consider(rectDistance(p.x, p.y, { ...FIXTURES.ladder, h: 1.6 }), { kind: 'ladder', label: '出门', mark: [FIXTURES.ladder.x + 0.5, 1] });
    PADS.forEach((pad, i) => {
      const built = i < g.facilities.length;
      const dist = rectDistance(p.x, p.y, { x: pad.x, y: pad.y, w: 2, h: 2 });
      if (built) consider(dist, { kind: 'facility', id: g.facilities[i], label: FIXTURES_LABEL(g.facilities[i]), mark: [pad.x + 1, pad.y] });
      else consider(dist + 0.01, { kind: 'pad', label: '建造', mark: [pad.x + 1, pad.y + 0.4] });
    });
  } else {
    const h = rt.outside.hatch;
    consider(rectDistance(p.x, p.y, { x: h.x, y: h.y, w: 2, h: 2 }), { kind: 'hatch', label: rt.pack > 0 ? '回去放下物资' : '回避难所', mark: [h.x + 1, h.y] });
    for (const n of rt.outside.nodes) {
      if (app.cools[n.id] > 0) continue;
      consider(rectDistance(p.x, p.y, { x: n.x, y: n.y, w: 1, h: 1 }), { kind: 'node', node: n, label: '搜刮', mark: [n.x + 0.5, n.y] });
    }
  }
  return best;
}

const FIXTURES_LABEL = (id) => FACILITIES[id].name;

function interact() {
  const t = rt.target;
  if (!t || rt.paused || rt.search) return;
  const g = app.game;
  switch (t.kind) {
    case 'bed':
      return layer(sleepHtml(g));
    case 'zhou':
      return layer(talkHtml(advise(g) ?? '没什么要紧事。趁天亮多跑一趟，天黑前回来。'));
    case 'radio':
      return layer(sheet(debtSheet(g)));
    case 'stock':
      return layer(sheet(ledgerSheet(g)));
    case 'ladder':
      return goOutside();
    case 'pad':
      return layer(sheet(buildSheet(g)));
    case 'facility':
      return layer(sheet(facilitySheet(g, t.id)));
    case 'hatch':
      goInside(true);
      return updateHud();
    case 'node': {
      if (rt.pack >= packCapacity(g)) return toast('背包满了，先回避难所放下。');
      rt.search = { node: t.node, t: 0 };
      return;
    }
  }
}

function finishSearch(node) {
  const g = app.game;
  const cap = packCapacity(g);
  const found = lootRoll(node.zone, isWinter(g));
  const took = Math.min(found, cap - rt.pack);
  rt.pack += took;
  app.cools[node.id] = WORLD.zones[node.zone].respawn;
  float(node.x + 0.5, node.y, `+${took}`, '#f6b445');
  const el = document.getElementById('pack');
  if (el) el.textContent = rt.pack;
  if (rt.pack >= cap) toast('背包满了，回避难所放下吧。');
}

function hurt(by) {
  rt.paused = true;
  rt.shake = 0.4;
  rt.search = null;
  const lost = rt.pack - Math.floor(rt.pack / 2);
  const days = WORLD.hurtDays[by];
  const text =
    by === 'dog'
      ? `野狗咬伤了你的腿。同伴把你拖回了避难所${lost > 0 ? `，背包里的东西掉了 ${lost} 份` : ''}。`
      : `天黑了你还在外面，回来的路上摔伤了${lost > 0 ? `，背包里的东西掉了 ${lost} 份` : ''}。`;
  setTimeout(() => {
    layer(`<div class="overlay"><div class="dialog crisis" role="dialog" aria-modal="true">
      <div class="hazard" aria-hidden="true"></div>
      <p class="stamp">受伤</p>
      <h2>${by === 'dog' ? '被野狗咬了' : '天黑了'}</h2>
      <p>${text}</p>
      <p class="hint">接下来 ${days} 天你出不了门。这几天没有进账，大家照样要吃饭。</p>
      <button class="btn primary wide" data-act="hurt-ok" data-by="${by}">躺下养伤</button>
    </div></div>`);
  }, 450);
}

function afterHurt(by) {
  const keep = Math.floor(rt.pack / 2);
  rt.pack = 0;
  if (keep > 0) play({ type: 'gather', amount: keep });
  play({ type: 'hurt', days: WORLD.hurtDays[by], by });
  if (rt.mode === 'outside') goInside(false);
  rt.player.x = 2.4;
  rt.player.y = 4.4;
  flow();
}

/* ---------- 对话与抽屉 ---------- */

const sheet = (body) => `<div class="overlay" data-act="close">
  <div class="sheet" role="dialog" aria-modal="true">
    <button class="icon-btn close" data-act="close" data-close aria-label="关闭">${ICONS.close}</button>
    ${body}
  </div>
</div>`;

function greetHtml() {
  const used = expenses(app.game);
  return `<div class="overlay"><div class="dialog" role="dialog" aria-modal="true">
    <p class="stamp">老周 · 管仓库的</p>
    <h2>你来值班了</h2>
    <p>咱们这儿每天要吃掉 ${used} 份物资，仓库里只剩 ${app.game.supplies}。爬右边的梯子出去，附近的箱子里还能翻出点东西，背包满了就回来。</p>
    <p>走远些东西多，可是有野狗。天黑前一定得回来。</p>
    <p class="hint">攒够了粮，就在地上的空位建设施。它们每天自己产粮，不用你出门。</p>
    <button class="btn primary wide" data-act="greet-ok">知道了</button>
  </div></div>`;
}

function talkHtml(text) {
  return `<div class="overlay" data-act="close"><div class="dialog" role="dialog" aria-modal="true">
    <p class="stamp">老周</p>
    <p class="say">${text}</p>
    <button class="btn primary wide" data-act="close" data-close>好</button>
  </div></div>`;
}

function sleepHtml(g) {
  const used = expenses(g);
  const made = production(g);
  const after = g.supplies + made - used;
  const early = rt.clock < 0.4 && g.injuredWeeks === 0;
  return `<div class="overlay" data-act="close"><div class="dialog" role="dialog" aria-modal="true">
    <p class="stamp">第 ${g.week} 天 · ${clockText()}</p>
    <h2>睡觉</h2>
    <p>睡一觉就到明天。今晚大家要吃掉 ${used}${made ? `，设施会产出 ${made}` : ''}，明早仓库会剩 <b class="${after < 0 ? 'bad' : ''}">${after}</b>。</p>
    ${after < 0 ? '<p class="hint bad">存粮不够今晚吃的。</p>' : early ? '<p class="hint">天还早，还来得及再出去一趟。</p>' : ''}
    <div class="stack">
      <button class="btn primary wide" data-act="sleep">睡到明天</button>
      <button class="btn wide" data-act="close" data-close>再等等</button>
    </div>
  </div></div>`;
}

function settleChips(e) {
  const chips = [];
  if (e.scavenged) chips.push(['搜刮', e.scavenged]);
  if (e.produced) chips.push(['设施自产', e.produced]);
  chips.push(['口粮', -e.eaten]);
  if (e.upkeep) chips.push(['维护', -e.upkeep]);
  if (e.spoiled) chips.push(['变质', -e.spoiled]);
  const net = chips.reduce((sum, [, v]) => sum + v, 0);
  return `<div class="settle">
    <div class="chips">${chips.map(([k, v]) => `<span class="${v > 0 ? 'good' : 'bad'}">${k} ${signed(v)}</span>`).join('')}</div>
    <div class="net"><span>昨天净变化</span><b class="${net >= 0 ? 'good' : 'bad'}">${signed(net)}</b></div>
    ${e.interest ? `<div class="net debt"><span>欠粮又滚出利息</span><b>+${e.interest}</b></div>` : ''}
  </div>`;
}

function morningHtml(g) {
  const news = app.dayLog.filter((e) => e.tone !== 'good' || e.delta === null || !e.text.startsWith('搜刮带回'));
  const tip = advise(g);
  return `<div class="overlay"><div class="dialog morning" role="dialog" aria-modal="true">
    <p class="stamp">${isWinter(g) ? '寒冬 · ' : ''}早晨</p>
    <h2>第 ${g.week} 天</h2>
    ${g.lastWeek ? settleChips(g.lastWeek) : ''}
    ${
      news.length
        ? `<ul class="feed">${news.map((e) => `<li class="entry ${e.tone}"><span>${e.text}</span>${e.delta ? `<b>${signed(e.delta)}</b>` : ''}</li>`).join('')}</ul>`
        : ''
    }
    <p class="stockline">仓库现在有 <b>${g.supplies}</b>${g.debt > 0 ? `，欠粮 <b class="owe-text">${g.debt}</b>` : ''}</p>
    ${tip ? `<aside class="tip"><b>老周</b><p>${tip}</p></aside>` : ''}
    <button class="btn primary wide" data-act="morning-ok">起床</button>
  </div></div>`;
}

function eventHtml(g) {
  const p = g.pending;
  const crisis = p.id === 'crisis';
  return `<div class="overlay"><div class="dialog ${crisis ? 'crisis' : ''}" role="dialog" aria-modal="true">
    ${crisis ? '<div class="hazard" aria-hidden="true"></div>' : ''}
    <p class="stamp">${crisis ? '紧急' : '有人敲门'}</p>
    <h2>${p.name}</h2>
    <p>${p.text}</p>
    <div class="choices">${p.choices
      .map((c) => {
        const blocked = c.id === 'invest' && g.supplies < RULES.scamStake;
        return `<button class="btn ${c.id === 'decline' ? '' : 'primary'}" data-act="resolve" data-choice="${c.id}" ${blocked ? 'disabled' : ''}>
          <span>${c.label}</span>${c.hint || blocked ? `<small>${blocked ? '存粮不够' : c.hint}</small>` : ''}
        </button>`;
      })
      .join('')}</div>
  </div></div>`;
}

function effectLine(id) {
  const f = FACILITIES[id];
  if (id === 'wall') return `挡住掠夺者 · 每天维护 ${f.upkeep}`;
  if (id === 'truck') return `背包多装五成 · 每天烧油 ${f.upkeep}`;
  if (id === 'tradepost') return `每天 +${f.produce}，每多一种别的设施再 +1`;
  if (id === 'farm') return `每天 +${f.produce} · 寒冬减半，怕病害`;
  return `每天 +${f.produce} · 不受季节影响`;
}

function buildSheet(g) {
  if (g.facilities.length >= PADS.length) {
    return `<h2>建造</h2><p>地方都占满了。想建新的，得先拆掉一座。</p>`;
  }
  const winter = isWinter(g);
  return `<p class="stamp">不花时间，今晚就开始产出</p>
    <h2>建造</h2>
    ${winter ? `<p class="hint frost">${ICONS.snow}寒冬里设备打七折。</p>` : ''}
    <ul class="catalog">${chapterById(g.chapter)
      .facilities.map((id) => {
        const f = FACILITIES[id];
        const cost = buildCost(g, id);
        const short = cost - g.supplies;
        const payback = f.produce > 0 ? `约 ${Math.ceil(cost / f.produce)} 天回本` : '';
        return `<li>
          <img class="thumb" alt="" src="${sprites().facility[id][0].toDataURL()}">
          <div class="what"><b>${f.name}</b><small>${effectLine(id)}</small>${payback ? `<small class="pay">${payback}</small>` : ''}</div>
          <button class="btn primary" data-act="build" data-id="${id}" ${short > 0 ? 'disabled' : ''}>
            <span>${winter ? `<s>${f.cost}</s> ` : ''}${cost}</span><small>${short > 0 ? `还差 ${short}` : '建造'}</small>
          </button>
        </li>`;
      })
      .join('')}</ul>
    <p class="hint">仓库有 ${g.supplies}，每天要吃掉 ${expenses(g)}。别把口粮也花光了。</p>`;
}

function debtSheet(g) {
  const room = RULES.debtCap - g.debt;
  const canRepay = Math.min(g.debt, g.supplies);
  const borrowSteps = [10, 20].filter((n) => n < room);
  const repaySteps = [10, 20].filter((n) => n < canRepay);
  const nextDebt = g.debt + Math.ceil(g.debt * RULES.interest);
  return `<p class="stamp">对讲机 · 隔壁据点 · 每天利息一成</p>
    <h2>${g.debt > 0 ? `欠粮 ${g.debt}` : '借粮'}</h2>
    <p>${
      g.debt > 0
        ? `不还的话，明天就是 ${nextDebt}，利息还会接着生利息。欠到超过 ${RULES.debtCap}，他们会上门拆走你最值钱的设施。`
        : `借来的粮马上到手，但每天要多记一成利息。最多能欠 ${RULES.debtCap}，欠着粮就不算自给自足。`
    }</p>
    ${
      g.debt > 0
        ? `<div class="steps"><span class="label">还粮</span>
            ${repaySteps.map((n) => `<button class="btn" data-act="repay" data-amount="${n}">还 ${n}</button>`).join('')}
            <button class="btn primary" data-act="repay" data-amount="${canRepay}" ${canRepay > 0 ? '' : 'disabled'}>${canRepay >= g.debt ? `还清 ${g.debt}` : canRepay > 0 ? `能还 ${canRepay}` : '没有存粮可还'}</button>
          </div>`
        : ''
    }
    <div class="steps"><span class="label">借粮</span>
      ${borrowSteps.map((n) => `<button class="btn" data-act="borrow" data-amount="${n}">借 ${n}</button>`).join('')}
      <button class="btn" data-act="borrow" data-amount="${room}" ${room > 0 ? '' : 'disabled'}>${room > 0 ? `借满 ${room}` : '已经借到上限'}</button>
    </div>`;
}

function facilitySheet(g, id) {
  const f = FACILITIES[id];
  const count = g.facilities.filter((x) => x === id).length;
  const value = dismantleValue(g, id);
  return `<p class="stamp">你有 ${count} 座</p>
    <h2>${f.name}</h2>
    <p>${effectLine(id)}。</p>
    <p class="hint">${
      g.partsShortage
        ? `今天零件紧缺，拆卖能拿回全价 ${value}。`
        : `建一座要 ${f.cost}，拆卖只能换回 ${value}。等到真断粮再卖，只值废铁价 ${Math.floor(f.cost * RULES.fireSaleRefund)}。`
    }</p>
    <button class="btn wide danger" data-act="dismantle" data-id="${id}">拆卖一座，换回 ${value}</button>`;
}

function ledgerSheet(g) {
  const made = production(g);
  const used = expenses(g);
  const left = runway(g);
  return `<p class="stamp">仓库账本</p>
    <h2>存粮 ${g.supplies}</h2>
    <dl class="tally">
      <div><dt>设施每天自产</dt><dd class="good">+${made}</dd></div>
      <div><dt>${g.people} 个人每天吃</dt><dd class="bad">−${g.people * RULES.eatPerPerson}</dd></div>
      ${used > g.people * RULES.eatPerPerson ? `<div><dt>设施每天维护</dt><dd class="bad">−${used - g.people * RULES.eatPerPerson}</dd></div>` : ''}
      ${g.debt > 0 ? `<div><dt>欠隔壁的粮</dt><dd class="owe-text">${g.debt}</dd></div>` : ''}
    </dl>
    <p class="hint">${
      left === Infinity
        ? '自产已经够吃了。'
        : `不出门的话，存粮还能撑 ${left} 天。存粮超过 ${RULES.spoilFree} 的部分，每天会坏掉一些。`
    }</p>`;
}

function menuSheet(g) {
  return `<p class="stamp">第 ${g.week} 天</p>
    <h2>暂停</h2>
    <p>进度在每天早晨保存。现在退出的话，今天要重新过。</p>
    <div class="stack">
      <button class="btn primary wide" data-act="close" data-close>继续</button>
      <button class="btn wide" data-act="home">回到首页</button>
      <button class="btn wide danger" data-act="abandon">放弃这一局</button>
    </div>`;
}

/* ---------- 点击与按键 ---------- */

function freeAction(action) {
  const before = app.dayLog.length;
  if (!play(action)) return;
  const entry = app.dayLog[before];
  if (entry) toast(`${entry.text}${entry.delta ? ` ${signed(entry.delta)}` : ''}`);
  rt.solid = insideSolid(Math.min(app.game.facilities.length, PADS.length));
  nudgeOutOfWalls();
  layer('');
}

// 设施建在脚下时，把人挪到旁边，免得卡在里面。
function nudgeOutOfWalls() {
  const p = rt.player;
  const stuck = () => rt.solid[Math.floor(p.y) * IN_W + Math.floor(p.x)];
  for (let i = 0; i < 6 && stuck(); i++) p.y -= 0.5;
  if (stuck()) {
    p.x = 5.5;
    p.y = 4.4;
  }
}

root.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const { act: name, id, amount, choice, by } = el.dataset;
  switch (name) {
    case 'start':
      return startNew();
    case 'continue':
      return show('game');
    case 'home':
      if (app.game && app.game.status !== 'playing') app.game = null;
      return show('home');
    case 'abandon':
      app.game = null;
      persist();
      return show('home');
    case 'menu':
      return layer(sheet(menuSheet(app.game)));
    case 'interact':
      return interact();
    case 'close':
      if (event.target.closest('.sheet, .dialog') && !event.target.closest('[data-close]')) return;
      return layer('');
    case 'greet-ok':
      app.greeted = true;
      persist();
      return flow();
    case 'morning-ok':
      app.morning = false;
      app.dayLog = [];
      return flow();
    case 'sleep':
      layer('<div class="fade night"></div>');
      return setTimeout(() => {
        play({ type: 'rest' });
        flow();
      }, 650);
    case 'hurt-ok':
      return afterHurt(by);
    case 'resolve':
      play({ type: 'resolve', choice });
      return flow();
    case 'build':
      return freeAction({ type: 'build', facility: id });
    case 'dismantle':
      return freeAction({ type: 'dismantle', facility: id });
    case 'borrow':
      return freeAction({ type: 'borrow', amount: Number(amount) });
    case 'repay':
      return freeAction({ type: 'repay', amount: Number(amount) });
    case 'share':
      return share();
  }
});

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

document.addEventListener('keydown', (event) => {
  if (app.screen !== 'game') return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'Escape' && rt.paused && !app.game.pending && !app.morning && app.greeted) return layer('');
  if (rt.paused) return;
  if (MOVE_KEYS[key]) {
    rt.keys.add(key);
    event.preventDefault();
  } else if (key === ' ' || key === 'e' || key === 'Enter') {
    event.preventDefault();
    interact();
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
  canvas.addEventListener('pointerdown', (e) => {
    if (rt.paused) return;
    canvas.setPointerCapture?.(e.pointerId);
    const [x, y] = point(e);
    rt.stick = { id: e.pointerId, ox: x, oy: y, x, y };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!rt.stick || rt.stick.id !== e.pointerId) return;
    [rt.stick.x, rt.stick.y] = point(e);
  });
  const end = (e) => {
    if (rt.stick?.id === e.pointerId) rt.stick = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function share() {
  const text = shareText(app.game);
  const fallback = () => {
    const box = document.getElementById('share-fallback');
    box.hidden = false;
    box.textContent = text;
    const range = document.createRange();
    range.selectNodeContents(box);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };
  if (!navigator.clipboard?.writeText) return fallback();
  navigator.clipboard.writeText(text).then(() => toast('战报已复制'), fallback);
}

/* ---------- 每一帧 ---------- */

function inputVector() {
  let x = 0;
  let y = 0;
  for (const key of rt.keys) {
    x += MOVE_KEYS[key][0];
    y += MOVE_KEYS[key][1];
  }
  if (rt.stick) {
    const dx = rt.stick.x - rt.stick.ox;
    const dy = rt.stick.y - rt.stick.oy;
    if (Math.hypot(dx, dy) > 10) {
      x = dx;
      y = dy;
    }
  }
  const len = Math.hypot(x, y);
  return len ? [x / len, y / len] : [0, 0];
}

function update(dt) {
  rt.time += dt;
  rt.floats.forEach((f) => (f.t += dt));
  rt.floats = rt.floats.filter((f) => f.t < 1.1);
  if (rt.shake > 0) rt.shake -= dt;
  if (rt.paused) return;

  const p = rt.player;
  const [vx, vy] = rt.search ? [0, 0] : inputVector();
  if (vx || vy) {
    const w = rt.mode === 'inside' ? IN_W : rt.outside.w;
    const h = rt.mode === 'inside' ? IN_H : rt.outside.h;
    const solid = rt.mode === 'inside' ? rt.solid : rt.outside.solid;
    move(p, vx * WORLD.playerSpeed * dt, vy * WORLD.playerSpeed * dt, solid, w, h);
    if (Math.abs(vx) > 0.2) p.face = vx > 0 ? 1 : -1;
    p.step += dt * 9;
  } else p.step = 0;

  if (rt.search) {
    rt.search.t += dt;
    if (rt.search.t >= WORLD.searchSeconds) {
      const node = rt.search.node;
      rt.search = null;
      finishSearch(node);
    }
  }

  if (rt.mode === 'outside') {
    rt.clock += dt / WORLD.daySeconds;
    const clock = document.getElementById('clock');
    if (clock) {
      clock.textContent = clockText();
      clock.classList.toggle('late', rt.clock > WORLD.duskAt);
    }
    if (!rt.duskWarned && rt.clock > WORLD.duskAt) {
      rt.duskWarned = true;
      toast('天快黑了，该往回走了。');
    }
    if (rt.clock >= 1) return hurt('night');
    if (updateDogs(rt.dogs, p, rt.outside, dt)) return hurt('dog');
  }

  const target = findTarget();
  if (target?.kind !== rt.target?.kind || target?.label !== rt.target?.label || target?.node !== rt.target?.node) {
    const btn = document.getElementById('act');
    if (btn) {
      btn.hidden = !target;
      if (target) btn.textContent = target.label;
    }
  }
  rt.target = target;
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
  const across = canvas.clientWidth < 560 ? 10.5 : 18;
  const zoom = Math.max(1, Math.round(cw / (across * T)));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = rt.mode === 'inside' ? '#0d1214' : '#080c0d';
  ctx.fillRect(0, 0, cw, ch);

  const vw = cw / zoom;
  const vh = ch / zoom;
  const inside = rt.mode === 'inside';
  const mw = (inside ? IN_W : rt.outside.w) * T;
  const mh = (inside ? IN_H : rt.outside.h) * T;
  const p = rt.player;
  // HUD 盖住了画面顶部，所以把镜头中心往下偏一点
  const hudPx = (108 * dpr) / zoom;
  const open = vh - hudPx; // 没被 HUD 盖住的高度
  let cx = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, p.x * T - vw / 2));
  let cy = mh <= open ? -hudPx - (open - mh) / 2 : Math.max(-hudPx, Math.min(mh - vh, p.y * T - hudPx - open / 2));
  if (rt.shake > 0) {
    cx += (Math.random() - 0.5) * 6;
    cy += (Math.random() - 0.5) * 6;
  }
  cx = Math.round(cx * zoom) / zoom;
  cy = Math.round(cy * zoom) / zoom;
  ctx.setTransform(zoom, 0, 0, zoom, -cx * zoom, -cy * zoom);

  const S = sprites();
  const x0 = Math.max(0, Math.floor(cx / T));
  const y0 = Math.max(0, Math.floor(cy / T));
  const x1 = Math.min((inside ? IN_W : rt.outside.w) - 1, Math.ceil((cx + vw) / T));
  const y1 = Math.min((inside ? IN_H : rt.outside.h) - 1, Math.ceil((cy + vh) / T));
  const things = []; // [底边 y, 绘制函数]
  const frameNo = Math.floor(rt.time * 2) % 2;

  if (inside) drawInside(ctx, S, things, frameNo);
  else drawOutside(ctx, S, things, x0, y0, x1, y1);

  const walking = p.step > 0 && Math.floor(p.step) % 2 === 1;
  things.push([
    p.y * T + 6,
    () => {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(Math.round(p.x * T) - 5, Math.round(p.y * T) + 5, 10, 3);
      const sprite = S.player[walking ? 1 : 0];
      const px = Math.round(p.x * T) - 8;
      const py = Math.round(p.y * T) - 10;
      if (p.face < 0) {
        ctx.save();
        ctx.translate(px + 16, py);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0);
        ctx.restore();
      } else ctx.drawImage(sprite, px, py);
    },
  ]);

  things.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());

  if (rt.target && !rt.paused) {
    const [mx, my] = rt.target.mark;
    const bob = Math.round(Math.sin(rt.time * 6) * 1.5);
    ctx.fillStyle = '#14181c';
    ctx.fillRect(mx * T - 4, my * T - 10 + bob, 8, 5);
    ctx.fillStyle = '#f6b445';
    ctx.fillRect(mx * T - 3, my * T - 9 + bob, 6, 2);
    ctx.fillRect(mx * T - 2, my * T - 7 + bob, 4, 1);
    ctx.fillRect(mx * T - 1, my * T - 6 + bob, 2, 1);
  }

  if (rt.search) {
    const k = rt.search.t / WORLD.searchSeconds;
    const bx = Math.round(p.x * T) - 9;
    const by = Math.round(p.y * T) - 17;
    ctx.fillStyle = '#14181c';
    ctx.fillRect(bx, by, 18, 4);
    ctx.fillStyle = '#f6b445';
    ctx.fillRect(bx + 1, by + 1, Math.round(16 * k), 2);
  }

  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  for (const f of rt.floats) {
    const y = f.y * T - 6 - f.t * 16;
    ctx.globalAlpha = Math.max(0, 1 - f.t);
    ctx.fillStyle = '#14181c';
    ctx.fillText(f.text, f.x * T + 1, y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x * T, y);
  }
  ctx.globalAlpha = 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!inside) {
    const dusk = Math.max(0, (rt.clock - WORLD.duskAt) / (1 - WORLD.duskAt));
    if (dusk > 0) {
      ctx.fillStyle = `rgba(12, 16, 48, ${(dusk * 0.62).toFixed(3)})`;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (isWinter(app.game)) drawSnow(ctx, cw, ch, dpr);
  }

  if (rt.stick && !rt.paused) {
    const s = rt.stick;
    const dx = s.x - s.ox;
    const dy = s.y - s.oy;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, 36 / len);
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = 'rgba(231,238,236,0.35)';
    ctx.beginPath();
    ctx.arc(s.ox * dpr, s.oy * dpr, 36 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(246,180,69,0.75)';
    ctx.beginPath();
    ctx.arc((s.ox + dx * k) * dpr, (s.oy + dy * k) * dpr, 14 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnow(ctx, cw, ch, dpr) {
  ctx.fillStyle = 'rgba(231,238,236,0.8)';
  for (let i = 0; i < 46; i++) {
    const speed = 30 + (i % 5) * 14;
    const x = (hash(i, 7) % cw) + Math.sin(rt.time + i) * 12 * dpr;
    const y = ((hash(i, 13) % ch) + rt.time * speed * dpr) % ch;
    const size = (1 + (i % 2)) * dpr;
    ctx.fillRect(x, y, size, size);
  }
}

function drawInside(ctx, S, things, frameNo) {
  const g = app.game;
  for (let y = 0; y < IN_H; y++) {
    for (let x = 0; x < IN_W; x++) {
      const edge = x === 0 || x === IN_W - 1 || y === IN_H - 1;
      let tile;
      if (y === 0 || edge) tile = S.wallTop;
      else if (y === 1) tile = x % 4 === 2 ? S.stripe : S.wallFace;
      else tile = S.floor[hash(x, y) % 4];
      ctx.drawImage(tile, x * T, y * T);
    }
  }
  const level = Math.min(6, Math.ceil(Math.max(0, g.supplies) / 10));
  const put = (sprite, x, y, baseY) => things.push([baseY * T, () => ctx.drawImage(sprite, x * T, y * T)]);
  put(S.ladder, FIXTURES.ladder.x, 0, 2);
  put(S.bed, FIXTURES.bed.x, FIXTURES.bed.y, 4);
  put(S.radio, FIXTURES.radio.x, 1, 3);
  put(S.stock[level], FIXTURES.stock.x, FIXTURES.stock.y, 4);
  things.push([
    3 * T,
    () => {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(FIXTURES.zhou.x * T + 3, FIXTURES.zhou.y * T + 14, 10, 3);
      ctx.drawImage(S.zhou, FIXTURES.zhou.x * T, FIXTURES.zhou.y * T - 1);
    },
  ]);
  PADS.forEach((pad, i) => {
    const id = g.facilities[i];
    if (!id) return ctx.drawImage(S.pad, pad.x * T, pad.y * T);
    const stalled = id === 'farm' && g.blightWeeks > 0;
    things.push([
      (pad.y + 2) * T,
      () => {
        if (stalled) ctx.globalAlpha = 0.5;
        ctx.drawImage(S.facility[id][stalled ? 0 : frameNo], pad.x * T, pad.y * T);
        ctx.globalAlpha = 1;
      },
    ]);
  });
}

function drawOutside(ctx, S, things, x0, y0, x1, y1) {
  const o = rt.outside;
  const winter = isWinter(app.game);
  const groundTiles = winter ? S.snow : S.dirt;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const road = y === o.roadY || y === o.roadY + 1;
      ctx.drawImage(road ? S.road[hash(x, y) % 2] : groundTiles[hash(x, y) % 4], x * T, y * T);
    }
  }
  // 路中间的虚线，顺着它一直走就是深处
  ctx.fillStyle = 'rgba(246,180,69,0.5)';
  for (let x = x0 - (x0 % 3); x <= x1; x += 3) ctx.fillRect(x * T + 4, (o.roadY + 1) * T - 1, 8, 2);

  const seen = (x, y) => x >= x0 - 2 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 2;
  for (const pr of o.props) {
    if (!seen(pr.x, pr.y)) continue;
    const tall = pr.kind !== 'rubble';
    things.push([(pr.y + 1) * T, () => ctx.drawImage(S[pr.kind], pr.x * T, (pr.y - (tall ? 1 : 0)) * T)]);
  }
  for (const n of o.nodes) {
    if (!seen(n.x, n.y)) continue;
    const empty = app.cools[n.id] > 0;
    things.push([
      (n.y + 1) * T,
      () => {
        ctx.globalAlpha = empty ? 0.32 : 1;
        ctx.drawImage(S.node[n.zone], n.x * T, n.y * T);
        ctx.globalAlpha = 1;
      },
    ]);
  }
  things.push([(o.hatch.y + 2) * T, () => ctx.drawImage(S.hatch, o.hatch.x * T, o.hatch.y * T)]);
  for (const d of rt.dogs) {
    if (!seen(d.x, d.y)) continue;
    things.push([
      d.y * T + 6,
      () => {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(Math.round(d.x * T) - 6, Math.round(d.y * T) + 4, 12, 3);
        const set = d.face > 0 ? S.dogR : S.dogL;
        ctx.drawImage(set[Math.floor(d.step) % 2], Math.round(d.x * T) - 8, Math.round(d.y * T) - 10);
        if (d.chasing) {
          ctx.fillStyle = '#e86a55';
          ctx.fillRect(Math.round(d.x * T) - 1, Math.round(d.y * T) - 15, 2, 4);
          ctx.fillRect(Math.round(d.x * T) - 1, Math.round(d.y * T) - 10, 2, 2);
        }
      },
    ]);
  }
}

/* ---------- 启动 ---------- */

// 调试用：地址以 #debug 结尾时，把内部状态挂到 window 上，方便自动化测试。
if (location.hash === '#debug') window.__shelter = { app, rt, play, flow, updateHud };

const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ game: app.game, cools: app.cools, greeted: app.greeted }));
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
