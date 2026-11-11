// 结算页：死因报告或通关复盘，以及两张走势图。
import { CAUSES } from '../data/causes.js';
import { CONCEPTS } from '../data/concepts.js';
import { FACILITIES } from '../data/facilities.js';
import { chapterById, CHAPTERS } from '../data/chapters.js';
import { production, expenses } from '../engine/engine.js';
import { ICONS } from './icons.js';

const W = 328;
const PAD = { l: 26, r: 52, t: 10, b: 18 };

function scale(history, maxY, height) {
  const n = history.length;
  const x = (i) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const y = (v) => PAD.t + (1 - Math.max(0, v) / maxY) * (height - PAD.t - PAD.b);
  return { x, y };
}

const points = (history, key, s) => history.map((h, i) => `${s.x(i).toFixed(1)},${s.y(h[key]).toFixed(1)}`).join(' ');

function frame(history, maxY, height, s) {
  const mid = Math.round(maxY / 2);
  const last = history.length;
  return `
    <line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${s.y(maxY)}" y2="${s.y(maxY)}"/>
    <line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${s.y(mid)}" y2="${s.y(mid)}"/>
    <line class="axis" x1="${PAD.l}" x2="${W - PAD.r}" y1="${s.y(0)}" y2="${s.y(0)}"/>
    <text class="tick" x="${PAD.l - 6}" y="${s.y(maxY) + 3}" text-anchor="end">${maxY}</text>
    <text class="tick" x="${PAD.l - 6}" y="${s.y(mid) + 3}" text-anchor="end">${mid}</text>
    <text class="tick" x="${PAD.l - 6}" y="${s.y(0) + 3}" text-anchor="end">0</text>
    <text class="tick" x="${PAD.l}" y="${height - 4}">第 1 天</text>
    ${last > 1 ? `<text class="tick" x="${W - PAD.r}" y="${height - 4}" text-anchor="end">第 ${last} 天</text>` : ''}`;
}

const niceMax = (v) => Math.max(10, Math.ceil(v / 10) * 10);

function flowChart(history) {
  const H = 132;
  const maxY = niceMax(Math.max(...history.map((h) => Math.max(h.production, h.expenses))));
  const s = scale(history, maxY, H);
  const end = history.at(-1);
  const i = history.length - 1;
  let yMade = s.y(end.production);
  let yUsed = s.y(end.expenses);
  if (Math.abs(yMade - yUsed) < 13) {
    const mid = (yMade + yUsed) / 2;
    const up = end.production >= end.expenses;
    yMade = mid + (up ? -7 : 7);
    yUsed = mid + (up ? 7 : -7);
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="每天自产与消耗走势">
    ${frame(history, maxY, H, s)}
    <polyline class="line used" points="${points(history, 'expenses', s)}"/>
    <polyline class="line made" points="${points(history, 'production', s)}"/>
    <circle class="dot used" cx="${s.x(i)}" cy="${s.y(end.expenses)}" r="3"/>
    <circle class="dot made" cx="${s.x(i)}" cy="${s.y(end.production)}" r="3"/>
    <text class="end used" x="${s.x(i) + 7}" y="${yUsed + 4}">消耗 ${end.expenses}</text>
    <text class="end made" x="${s.x(i) + 7}" y="${yMade + 4}">自产 ${end.production}</text>
  </svg>`;
}

function stockChart(history) {
  const H = 112;
  const maxY = niceMax(Math.max(...history.map((h) => h.supplies)));
  const s = scale(history, maxY, H);
  const i = history.length - 1;
  const end = history.at(-1);
  const line = points(history, 'supplies', s);
  const area = `${s.x(0)},${s.y(0)} ${line} ${s.x(i)},${s.y(0)}`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="仓库存粮走势">
    ${frame(history, maxY, H, s)}
    <polygon class="area" points="${area}"/>
    <polyline class="line stock" points="${line}"/>
    <circle class="dot stock" cx="${s.x(i)}" cy="${s.y(end.supplies)}" r="3"/>
    <text class="end stock" x="${s.x(i) + 7}" y="${s.y(end.supplies) + 4}">存粮 ${Math.max(0, end.supplies)}</text>
  </svg>`;
}

function charts(state) {
  if (state.history.length === 0) return '';
  return `
    <section class="block">
      <h3 class="label">自产追上消耗了吗</h3>
      ${flowChart(state.history)}
      <h3 class="label">仓库存粮</h3>
      ${stockChart(state.history)}
    </section>`;
}

function tally(state) {
  const t = state.stats;
  const rows = [
    ['出门搜刮带回', t.scavenged, 'good'],
    ['设施自己产出', t.produced, 'good'],
    ['吃掉和维护', t.eaten, 'bad'],
  ];
  if (t.interest) rows.push(['付给隔壁的利息', t.interest, 'bad']);
  if (t.spoiled) rows.push(['放坏的存粮', t.spoiled, 'bad']);
  if (t.raided) rows.push(['被抢走', t.raided, 'bad']);
  if (t.scamLost) rows.push(['被商队骗走', t.scamLost, 'bad']);
  if (t.fireSaleLoss) rows.push(['贱卖设施的损失', t.fireSaleLoss, 'bad']);
  return `<section class="block">
    <h3 class="label">这一局的总账</h3>
    <dl class="tally">${rows.map(([k, v, tone]) => `<div><dt>${k}</dt><dd class="${tone}">${v}</dd></div>`).join('')}</dl>
  </section>`;
}

function encounters(state) {
  const rows = Object.keys(CONCEPTS).filter((k) => state.seen[k]);
  if (rows.length === 0) return '';
  return `<section class="block">
    <h3 class="label">你在这一局里碰到的事，放到现实里</h3>
    <ul class="pairs">${rows
      .map((k) => `<li><span>${CONCEPTS[k][0]}</span><i>${ICONS.arrow}</i><span>${CONCEPTS[k][1]}</span></li>`)
      .join('')}</ul>
  </section>`;
}

function wonLedger(state) {
  const made = production(state);
  const used = expenses(state);
  const kinds = [...new Set(state.facilities)];
  const assets = kinds
    .map((id) => `${FACILITIES[id].name}${state.facilities.filter((f) => f === id).length > 1 ? ` ×${state.facilities.filter((f) => f === id).length}` : ''}`)
    .join('、');
  return `<section class="block">
    <h3 class="label">把避难所的账本翻成现实</h3>
    <table class="ledger">
      <thead><tr><th>避难所</th><th>现实里叫</th><th>你的数字</th></tr></thead>
      <tbody>
        <tr><td>出门搜刮</td><td>工资（主动收入）</td><td>共 ${state.stats.scavenged}</td></tr>
        <tr><td>设施自产</td><td>被动收入</td><td class="good">每天 ${made}</td></tr>
        <tr><td>口粮和维护</td><td>生活开支</td><td class="bad">每天 ${used}</td></tr>
        <tr><td>${assets || '设施'}</td><td>资产</td><td>${state.facilities.length} 座</td></tr>
        <tr><td>欠隔壁的粮</td><td>负债</td><td>0</td></tr>
      </tbody>
    </table>
    <p class="moral">被动收入不低于开支的那一刻，出门工作就从“必须”变成了“可以选”。这就是你刚才做到的事。</p>
  </section>`;
}

export function shareText(state) {
  if (state.status === 'won') {
    return `《避难所：不再出门》：我用了 ${state.week} 天，让避难所自己养活了自己。`;
  }
  return `《避难所：不再出门》：我撑到了第 ${state.week} 天，死因是“${CAUSES[state.cause].title}”。`;
}

export function reportHtml(state, meta) {
  const chapter = chapterById(state.chapter);
  const won = state.status === 'won';
  const cause = CAUSES[state.cause];
  const next = CHAPTERS.find((c) => c.id === chapter.id + 1);
  const best = meta.best;

  const head = won
    ? `<header class="verdict won">
        <p class="stamp">B-07 号避难所 · 值班总结</p>
        <h1>第 ${state.week} 天，<br>你不用再出门了</h1>
        <p class="lede">避难所每天自产 ${production(state)}，消耗 ${expenses(state)}。从今天起，出不出门由你决定。${best === state.week ? '这是你最快的一次。' : ''}</p>
      </header>`
    : `<header class="verdict dead">
        <p class="stamp">B-07 号避难所 · 值班总结</p>
        <h1>第 ${state.week} 天，<br>避难所没能撑下去</h1>
        <div class="cause">
          <p class="cause-kicker">死因</p>
          <h2>${cause.title}</h2>
          <p>${cause.inGame}</p>
          <p class="real">${cause.realWorld}</p>
          <p class="tip">${cause.tip}</p>
        </div>
      </header>`;

  return `<div class="report">
    ${head}
    ${won ? wonLedger(state) : ''}
    ${charts(state)}
    ${tally(state)}
    ${encounters(state)}
    <div class="report-actions">
      ${won && next ? `<button class="btn primary" data-act="start" data-chapter="${next.id}">进入第 ${next.id} 章「${next.name}」</button>` : ''}
      <button class="btn ${won && next ? '' : 'primary'}" data-act="start" data-chapter="${chapter.id}">${won ? '再玩一次' : '再来一局'}</button>
      <button class="btn" data-act="share">复制战报</button>
      <button class="btn ghost" data-act="home">回到首页</button>
    </div>
    <p class="share-fallback" id="share-fallback" hidden></p>
  </div>`;
}
