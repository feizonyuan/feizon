// 界面：首页、对局、结算三个画面，加上底部抽屉和事件卡。
import {
  RULES,
  newGame,
  act,
  production,
  expenses,
  facilityOutput,
  buildCost,
  dismantleValue,
  scavengeRange,
  isWinter,
  weeksToWinter,
} from '../engine/engine.js';
import { FACILITIES } from '../data/facilities.js';
import { CHAPTERS, chapterById } from '../data/chapters.js';
import { ICONS } from './icons.js';
import { advise, runway } from './advisor.js';
import { reportHtml, shareText } from './report.js';

const SAVE_KEY = 'shelter.save.v1';
const META_KEY = 'shelter.meta.v1';
const FEED_LIMIT = 40;

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
  feed: [],
  sheet: null, // { type, ... }
  meta: { unlocked: 1, best: {}, ...store.read(META_KEY, {}) },
  shown: { supplies: null, ratio: 0 },
  fresh: 0, // 本次渲染中新出现的记录条数，用于入场动画
};

function boot(data = {}) {
  const saved = data.game ? data : store.read(SAVE_KEY, null);
  if (saved?.game) {
    app.game = saved.game;
    app.feed = saved.feed ?? [];
    if (data.game) app.screen = data.screen ?? 'game';
  }
  render();
}

function persist() {
  if (app.game && app.game.status === 'playing') store.write(SAVE_KEY, { game: app.game, feed: app.feed });
  else store.write(SAVE_KEY, null);
  store.write(META_KEY, app.meta);
}

/* ---------- 动作 ---------- */

function start(chapterId) {
  const seed = (Math.floor(Math.random() * 0xffffffff) || 1) >>> 0;
  app.game = newGame(seed, chapterId);
  app.feed = [];
  app.shown = { supplies: null, ratio: 0 };
  app.screen = 'game';
  app.sheet = { type: 'intro' };
  persist();
  render();
}

function play(action) {
  const before = app.game;
  let next;
  try {
    next = act(before, action);
  } catch (err) {
    toast(err.message);
    return;
  }
  const entries = next.log.map((e) => ({ ...e, week: before.week }));
  const weekClosed = next.week !== before.week || next.status !== 'playing';
  if (weekClosed && next.lastWeek?.week === before.week) {
    entries.push({ kind: 'settle', week: before.week, ...next.lastWeek });
  }
  app.fresh = entries.length;
  app.feed = [...entries.reverse(), ...app.feed].slice(0, FEED_LIMIT);
  app.game = next;
  app.sheet = null;

  if (next.status !== 'playing') {
    if (next.status === 'won') {
      const id = next.chapter;
      app.meta.unlocked = Math.max(app.meta.unlocked, Math.min(CHAPTERS.length, id + 1));
      if (!app.meta.best[id] || next.week < app.meta.best[id]) app.meta.best[id] = next.week;
    }
    persist();
    render();
    setTimeout(() => {
      app.screen = 'end';
      render();
    }, 1100);
    return;
  }
  persist();
  render();
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

root.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const { act: name, id, amount, chapter, choice, depth } = el.dataset;
  switch (name) {
    case 'start':
      return start(Number(chapter));
    case 'continue':
      app.screen = 'game';
      return render();
    case 'home':
      app.screen = 'home';
      app.sheet = null;
      if (app.game && app.game.status !== 'playing') app.game = null;
      return render();
    case 'sheet':
      app.sheet = { type: el.dataset.sheet, id };
      return render();
    case 'close':
      if (event.target.closest('.sheet') && !event.target.closest('[data-close]')) return;
      app.sheet = null;
      return render();
    case 'scavenge':
      return play({ type: 'scavenge', depth });
    case 'rest':
      return play({ type: 'rest' });
    case 'build':
      return play({ type: 'build', facility: id });
    case 'dismantle':
      return play({ type: 'dismantle', facility: id });
    case 'borrow':
      return play({ type: 'borrow', amount: Number(amount) });
    case 'repay':
      return play({ type: 'repay', amount: Number(amount) });
    case 'resolve':
      return play({ type: 'resolve', choice });
    case 'abandon':
      app.game = null;
      app.feed = [];
      app.sheet = null;
      app.screen = 'home';
      persist();
      return render();
    case 'share':
      return share();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && app.sheet && !app.game?.pending) {
    app.sheet = null;
    render();
  }
});

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

/* ---------- 渲染 ---------- */

const signed = (n) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));

function render() {
  const html =
    app.screen === 'home' ? homeHtml() : app.screen === 'end' ? reportHtml(app.game, app.meta) : gameHtml();
  const moved = root.className !== `screen-${app.screen}`;
  root.className = `screen-${app.screen}`;
  root.innerHTML = html;
  if (moved) window.scrollTo(0, 0);
  if (app.screen === 'game') afterGameRender();
  app.fresh = 0;
}

function homeHtml() {
  const saved = app.game && app.game.status === 'playing';
  return `<div class="home">
    <header class="masthead">
      <div class="hazard" aria-hidden="true"></div>
      <p class="stamp">B-07 号避难所 · 值班手册</p>
      <h1>避难所<span>不再出门</span></h1>
      <p class="lede">每周大家都要吃饭，物资只能靠你出门去找，而外面一天比一天危险。让避难所自己产出的东西够吃，你就再也不用出门了。</p>
    </header>

    ${
      saved
        ? `<button class="resume" data-act="continue">
            <span><b>继续上次的对局</b><small>第 ${app.game.chapter} 章「${chapterById(app.game.chapter).name}」· 第 ${app.game.week} 周 · 存粮 ${app.game.supplies}</small></span>
            <i>${ICONS.arrow}</i>
          </button>`
        : ''
    }

    <section class="chapters">
      <h2 class="label">选择章节</h2>
      ${CHAPTERS.map((c) => {
        const open = c.id <= app.meta.unlocked;
        const best = app.meta.best[c.id];
        return `<button class="chapter" data-act="start" data-chapter="${c.id}" ${open ? '' : 'disabled'}>
          <span class="no">${c.id}</span>
          <span class="body"><b>${c.name}</b><small>${open ? c.tagline : `通关第 ${c.id - 1} 章后解锁`}</small></span>
          <span class="side">${open ? (best ? `最快 ${best} 周` : '未通关') : ICONS.lock}</span>
        </button>`;
      }).join('')}
    </section>

    <section class="rules">
      <h2 class="label">三条规矩</h2>
      <ol>
        <li><span><b>出门才有进账。</b>搜刮或留守都会过完一周，每周结束时所有人要吃饭。</span></li>
        <li><span><b>设施自己会产出。</b>建造、拆卖不花时间，建好后每周自动出粮。</span></li>
        <li><span><b>自产够吃就算赢。</b>每周自产不低于消耗，而且不欠粮，你就自由了。</span></li>
      </ol>
    </section>
    <p class="fine">一局大约十分钟。进度保存在这台设备的浏览器里。</p>
  </div>`;
}

function yearStrip(g) {
  if (!chapterById(g.chapter).winter) return '';
  const pos = (g.week - 1) % RULES.yearWeeks;
  const cells = Array.from({ length: RULES.yearWeeks }, (_, i) => {
    const cold = i >= RULES.yearWeeks - RULES.winterWeeks;
    return `<i class="${cold ? 'cold' : ''} ${i === pos ? 'now' : ''} ${i < pos ? 'past' : ''}"></i>`;
  }).join('');
  const to = weeksToWinter(g);
  const text = to === 0 ? `寒冬 · 还剩 ${RULES.yearWeeks - pos} 周` : `${to} 周后入冬`;
  return `<div class="year ${to === 0 ? 'is-winter' : ''}" aria-label="${text}"><div class="cells">${cells}</div><span>${to === 0 ? ICONS.snow : ''}${text}</span></div>`;
}

function facilityTiles(g) {
  const kinds = [...new Set(g.facilities)];
  if (kinds.length === 0) {
    return `<p class="empty">还没有任何设施。存粮够了，就建一座能自己产粮的。</p>`;
  }
  return `<div class="tiles">${kinds
    .map((id) => {
      const count = g.facilities.filter((f) => f === id).length;
      const out = facilityOutput(g, id) * count;
      const cost = FACILITIES[id].upkeep * count;
      const stalled = id === 'farm' && g.blightWeeks > 0;
      const figure = out > 0 ? `<b class="good">+${out}</b>` : cost > 0 ? `<b class="bad">−${cost}</b>` : `<b class="bad">停产</b>`;
      return `<button class="tile ${stalled ? 'stalled' : ''}" data-act="sheet" data-sheet="facility" data-id="${id}">
        <i>${ICONS[id]}</i>
        <span>${FACILITIES[id].name}${count > 1 ? ` ×${count}` : ''}</span>
        ${figure}<small>每周</small>
      </button>`;
    })
    .join('')}</div>`;
}

function settleRow(e) {
  const chips = [];
  if (e.scavenged) chips.push(['搜刮', e.scavenged]);
  if (e.produced) chips.push(['自产', e.produced]);
  chips.push(['口粮', -e.eaten]);
  if (e.upkeep) chips.push(['维护', -e.upkeep]);
  if (e.spoiled) chips.push(['变质', -e.spoiled]);
  const net = chips.reduce((sum, [, v]) => sum + v, 0);
  return `<li class="settle">
    <div class="chips">${chips.map(([k, v]) => `<span class="${v > 0 ? 'good' : 'bad'}">${k} ${signed(v)}</span>`).join('')}</div>
    <div class="net"><span>这一周净变化</span><b class="${net >= 0 ? 'good' : 'bad'}">${signed(net)}</b></div>
    ${e.interest ? `<div class="net debt"><span>欠粮又滚出利息</span><b>+${e.interest}</b></div>` : ''}
  </li>`;
}

function feedHtml() {
  if (app.feed.length === 0) {
    return `<p class="empty">这里会记下每周发生的事，以及物资是怎么进来、怎么出去的。</p>`;
  }
  let week = null;
  let out = '';
  app.feed.forEach((e, i) => {
    if (e.week !== week) {
      week = e.week;
      out += `<li class="week-mark">第 ${week} 周</li>`;
    }
    const fresh = i < app.fresh ? ` fresh" style="--i:${app.fresh - 1 - i}` : '';
    if (e.kind === 'settle') out += settleRow(e).replace('class="settle"', `class="settle${fresh}"`);
    else {
      out += `<li class="entry ${e.tone}${fresh}"><span>${e.text}</span>${
        e.delta ? `<b>${signed(e.delta)}</b>` : ''
      }</li>`;
    }
  });
  return `<ul class="feed">${out}</ul>`;
}

function gameHtml() {
  const g = app.game;
  const chapter = chapterById(g.chapter);
  const made = production(g);
  const used = expenses(g);
  const ratio = Math.min(1, made / used);
  const left = runway(g);
  const tip = g.status === 'playing' && !g.pending ? advise(g) : null;
  const hurt = g.injuredWeeks > 0;
  const [safeLo, safeHi] = scavengeRange(g, 'safe');
  const [deepLo, deepHi] = scavengeRange(g, 'deep');
  const over = g.status !== 'playing';

  return `<div class="game ${isWinter(g) ? 'winter' : ''} ${over ? `over ${g.status}` : ''}">
    <header class="bar">
      <div><p class="stamp">第 ${chapter.id} 章 · ${chapter.name}</p><h1>第 ${g.week} 周</h1></div>
      ${yearStrip(g)}
      <button class="icon-btn" data-act="sheet" data-sheet="menu" aria-label="菜单">${ICONS.menu}</button>
    </header>

    <main>
      <section class="vault">
        <div class="stock">
          <p class="label">仓库存粮</p>
          <p class="big" id="supplies">${g.supplies}</p>
          <p class="sub">${
            g.supplies < 0
              ? '<b class="bad">已经断粮</b>'
              : left === Infinity
                ? '自产已经够吃'
                : left < 1
                  ? '不出门的话，<b class="bad">撑不过这一周</b>'
                  : `不出门的话还能撑 <b>${left}</b> 周`
          }</p>
        </div>
        <ul class="facts">
          <li><i>${ICONS.people}</i><span>${g.people} 人</span></li>
          ${hurt ? `<li class="bad"><i>${ICONS.hurt}</i><span>养伤 ${g.injuredWeeks} 周</span></li>` : ''}
          ${g.debt > 0 ? `<li class="debt"><i>${ICONS.ledger}</i><span>欠粮 ${g.debt}</span></li>` : ''}
          ${g.blightWeeks > 0 ? `<li class="bad"><i>${ICONS.farm}</i><span>病害 ${g.blightWeeks} 周</span></li>` : ''}
        </ul>
      </section>

      <section class="gauge" aria-label="自给进度">
        <div class="gauge-head"><p class="label">自给进度</p><p class="figures"><b class="good">自产 ${made}</b> / 每周消耗 ${used}</p></div>
        <div class="track"><div class="fill ${ratio >= 1 ? 'full' : ''}" id="fill" style="--from:${(app.shown.ratio * 100).toFixed(1)}%;--to:${(ratio * 100).toFixed(1)}%"></div><span class="goal">自由</span></div>
        ${ratio >= 1 && g.debt > 0 ? `<p class="gauge-note">自产已经够吃，但要先还清欠粮才算脱身。</p>` : ''}
      </section>

      ${tip ? `<aside class="tip"><b>老周</b><p>${tip}</p></aside>` : ''}

      <section>
        <h2 class="label">设施</h2>
        ${facilityTiles(g)}
      </section>

      <section>
        <h2 class="label">值班记录</h2>
        ${feedHtml()}
      </section>
    </main>

    <footer class="dock">
      <div class="moves">
        <button class="move" data-act="scavenge" data-depth="safe" ${hurt || over ? 'disabled' : ''}>
          <i>${ICONS.near}</i><b>附近搜刮</b><small>带回 ${safeLo}–${safeHi} · 很少受伤</small>
        </button>
        <button class="move risky" data-act="scavenge" data-depth="deep" ${hurt || over ? 'disabled' : ''}>
          <i>${ICONS.deep}</i><b>深入废墟</b><small>带回 ${deepLo}–${deepHi} · 35% 会受伤</small>
        </button>
        <button class="move quiet" data-act="rest" ${over ? 'disabled' : ''}>
          <i>${ICONS.rest}</i><b>${hurt ? '养伤' : '留守'}</b><small>过完这一周</small>
        </button>
      </div>
      <div class="tools">
        <button class="btn" data-act="sheet" data-sheet="build" ${over ? 'disabled' : ''}>${ICONS.build}建造</button>
        ${
          chapter.borrow
            ? `<button class="btn ${g.debt > 0 ? 'owing' : ''}" data-act="sheet" data-sheet="debt" ${over ? 'disabled' : ''}>${ICONS.ledger}${g.debt > 0 ? `欠粮 ${g.debt}` : '借粮'}</button>`
            : ''
        }
      </div>
    </footer>
    ${g.pending ? eventHtml(g) : sheetHtml(g)}
  </div>`;
}

function eventHtml(g) {
  const p = g.pending;
  const crisis = p.id === 'crisis';
  return `<div class="overlay">
    <div class="dialog ${crisis ? 'crisis' : ''}" role="dialog" aria-modal="true" aria-labelledby="event-title">
      ${crisis ? '<div class="hazard" aria-hidden="true"></div>' : ''}
      <p class="stamp">${crisis ? '紧急' : `第 ${g.week} 周 · 有人敲门`}</p>
      <h2 id="event-title">${p.name}</h2>
      <p>${p.text}</p>
      <div class="choices">${p.choices
        .map((c) => {
          const blocked = c.id === 'invest' && g.supplies < RULES.scamStake;
          return `<button class="btn ${c.id === 'decline' ? '' : 'primary'}" data-act="resolve" data-choice="${c.id}" ${blocked ? 'disabled' : ''}>
            <span>${c.label}</span>${c.hint || blocked ? `<small>${blocked ? '存粮不够' : c.hint}</small>` : ''}
          </button>`;
        })
        .join('')}</div>
    </div>
  </div>`;
}

function sheetHtml(g) {
  if (!app.sheet) return '';
  const body = { intro: introSheet, build: buildSheet, debt: debtSheet, facility: facilitySheet, menu: menuSheet }[
    app.sheet.type
  ]?.(g);
  if (!body) return '';
  return `<div class="overlay" data-act="close">
    <div class="sheet" role="dialog" aria-modal="true">
      <button class="icon-btn close" data-act="close" data-close aria-label="关闭">${ICONS.close}</button>
      ${body}
    </div>
  </div>`;
}

function introSheet(g) {
  const c = chapterById(g.chapter);
  return `<p class="stamp">第 ${c.id} 章</p>
    <h2>${c.name}</h2>
    <p>${c.intro}</p>
    <p class="hint">目标：每周自产不低于消耗${c.borrow ? '，并且不欠粮' : ''}。</p>
    <button class="btn primary wide" data-act="close" data-close>开始值班</button>`;
}

function effectLine(g, id) {
  const f = FACILITIES[id];
  if (id === 'wall') return `挡住掠夺者 · 每周维护 ${f.upkeep}`;
  if (id === 'truck') return `搜刮多带回三成 · 每周烧油 ${f.upkeep}`;
  if (id === 'tradepost') return `每周 +${f.produce}，每多一种别的设施再 +1`;
  if (id === 'farm') return `每周 +${f.produce} · 寒冬减半，怕病害`;
  return `每周 +${f.produce} · 不受季节影响`;
}

function buildSheet(g) {
  const chapter = chapterById(g.chapter);
  const winter = isWinter(g);
  return `<p class="stamp">不花时间，建好当周就开始产出</p>
    <h2>建造</h2>
    ${winter ? `<p class="hint frost">${ICONS.snow}寒冬里设备打七折。</p>` : ''}
    <ul class="catalog">${chapter.facilities
      .map((id) => {
        const f = FACILITIES[id];
        const cost = buildCost(g, id);
        const short = cost - g.supplies;
        const payback = f.produce > 0 ? `约 ${Math.ceil(cost / f.produce)} 周回本` : '';
        return `<li>
          <i>${ICONS[id]}</i>
          <div class="what"><b>${f.name}</b><small>${effectLine(g, id)}</small>${payback ? `<small class="pay">${payback}</small>` : ''}</div>
          <button class="btn primary" data-act="build" data-id="${id}" ${short > 0 ? 'disabled' : ''}>
            <span>${winter ? `<s>${f.cost}</s> ` : ''}${cost}</span><small>${short > 0 ? `还差 ${short}` : '建造'}</small>
          </button>
        </li>`;
      })
      .join('')}</ul>
    <p class="hint">你现在有 ${g.supplies} 份存粮，每周要吃掉 ${expenses(g)}。</p>`;
}

function debtSheet(g) {
  const room = RULES.debtCap - g.debt;
  const canRepay = Math.min(g.debt, g.supplies);
  const borrowSteps = [10, 20].filter((n) => n < room);
  const repaySteps = [10, 20].filter((n) => n < canRepay);
  const nextDebt = g.debt + Math.ceil(g.debt * RULES.interest);
  return `<p class="stamp">隔壁据点 · 每周利息一成</p>
    <h2>${g.debt > 0 ? `欠粮 ${g.debt}` : '借粮'}</h2>
    <p>${
      g.debt > 0
        ? `不还的话，过完这周就是 ${nextDebt}，利息还会接着生利息。欠到超过 ${RULES.debtCap}，他们会上门拆走你最值钱的设施。`
        : `借来的粮马上到手，但每周要多记一成利息。最多能欠 ${RULES.debtCap}，欠着粮就不算脱身。`
    }</p>
    ${
      g.debt > 0
        ? `<div class="steps">
            <span class="label">还粮</span>
            ${repaySteps.map((n) => `<button class="btn" data-act="repay" data-amount="${n}">还 ${n}</button>`).join('')}
            <button class="btn primary" data-act="repay" data-amount="${canRepay}" ${canRepay > 0 ? '' : 'disabled'}>${canRepay >= g.debt ? `还清 ${g.debt}` : canRepay > 0 ? `能还 ${canRepay}` : '没有存粮可还'}</button>
          </div>`
        : ''
    }
    <div class="steps">
      <span class="label">借粮</span>
      ${borrowSteps.map((n) => `<button class="btn" data-act="borrow" data-amount="${n}">借 ${n}</button>`).join('')}
      <button class="btn" data-act="borrow" data-amount="${room}" ${room > 0 ? '' : 'disabled'}>${room > 0 ? `借满 ${room}` : '已经借到上限'}</button>
    </div>`;
}

function facilitySheet(g) {
  const id = app.sheet.id;
  if (!g.facilities.includes(id)) return null;
  const f = FACILITIES[id];
  const count = g.facilities.filter((x) => x === id).length;
  const value = dismantleValue(g, id);
  return `<p class="stamp">你有 ${count} 座</p>
    <h2>${f.name}</h2>
    <p>${effectLine(g, id)}。</p>
    <p class="hint">${
      g.partsShortage
        ? `这周零件紧缺，拆卖能拿回全价 ${value}。`
        : `建一座要 ${f.cost}，拆卖只能换回 ${value}。等到真断粮再卖，只值废铁价 ${Math.floor(f.cost * RULES.fireSaleRefund)}。`
    }</p>
    <button class="btn wide danger" data-act="dismantle" data-id="${id}">拆卖一座，换回 ${value}</button>`;
}

function menuSheet(g) {
  return `<p class="stamp">第 ${g.chapter} 章 · 第 ${g.week} 周</p>
    <h2>暂停</h2>
    <p>进度已经自动保存，随时可以回来接着玩。</p>
    <div class="stack">
      <button class="btn primary wide" data-act="close" data-close>继续值班</button>
      <button class="btn wide" data-act="home">回到首页</button>
      <button class="btn wide danger" data-act="abandon">放弃这一局</button>
    </div>`;
}

/* ---------- 渲染后的动画 ---------- */

function afterGameRender() {
  const g = app.game;
  const el = document.getElementById('supplies');
  const from = app.shown.supplies;
  const to = g.supplies;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (el && from !== null && from !== to && !reduce) {
    el.classList.add(to > from ? 'up' : 'down');
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 450);
      const eased = 1 - (1 - k) ** 3;
      el.textContent = Math.round(from + (to - from) * eased);
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    el.textContent = from;
    requestAnimationFrame(step);
  }
  app.shown.supplies = to;
  app.shown.ratio = Math.min(1, production(g) / expenses(g));
}

/* ---------- 启动 ---------- */

const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ game: app.game, feed: app.feed, screen: app.screen }));
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
