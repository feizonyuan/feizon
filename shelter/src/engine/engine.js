// 规则引擎。act(state, action) 返回新状态，不修改传入的状态。
import { FACILITIES } from '../data/facilities.js';
import { EVENTS } from '../data/events.js';
import { CHAPTERS, chapterById } from '../data/chapters.js';

export const RULES = {
  startSupplies: 20,
  startPeople: 2,
  eatPerPerson: 5,
  yearWeeks: 12,
  winterWeeks: 3,
  winterScavenge: 0.8,
  winterDiscount: 0.7,
  scavenge: {
    safe: { min: 8, max: 13, injury: 0.08, injuryWeeks: 2 },
    deep: { min: 14, max: 21, injury: 0.35, injuryWeeks: 3 },
  },
  crewBonus: 0.5,
  depletion: 0.004, // 附近的废墟越搜越空：每天少 0.4%
  depletionFloor: 0.5,
  truckBonus: 0.3,
  blightWeeks: 2,
  spoilFree: 30,
  spoilRate: 0.05,
  interest: 0.1,
  debtCap: 60,
  crisisPremium: 0.5, // 断粮时赊粮，隔壁据点趁机多记五成
  dismantleRefund: 0.5,
  fireSaleRefund: 0.25, // 断粮时急着拆卖，只能当废铁价
  eventChance: 0.6,
  raidLoss: 0.15,
  breakdownCost: 6,
  windfall: 8,
  scamStake: 20,
  scamPayout: 40,
  scamWinChance: 0.15,
};

export function newGame(seed = 1, chapter = CHAPTERS.length) {
  return {
    rng: seed >>> 0,
    seed: seed >>> 0,
    chapter: chapterById(chapter).id,
    week: 1,
    supplies: RULES.startSupplies,
    people: RULES.startPeople,
    injuredWeeks: 0,
    injuredBy: null,
    gathered: 0,
    blightWeeks: 0,
    partsShortage: false,
    facilities: [],
    debt: 0,
    pending: null,
    status: 'playing',
    cause: null,
    log: [],
    lastWeek: null,
    history: [],
    seen: {},
    stats: {
      scavenged: 0,
      produced: 0,
      eaten: 0,
      interest: 0,
      spoiled: 0,
      raided: 0,
      scamLost: 0,
      injuries: 0,
      borrowed: 0,
      built: 0,
      fireSaleLoss: 0,
    },
  };
}

// mulberry32：随机数状态保存在 state.rng 里，保证同一种子可重放。
function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let r = s.rng;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}

const cfg = (state) => chapterById(state.chapter);

function note(s, text, tone = 'info', delta = null) {
  s.log.push({ text, tone, delta });
}

export function isWinter(state, week = state.week) {
  return cfg(state).winter && (week - 1) % RULES.yearWeeks >= RULES.yearWeeks - RULES.winterWeeks;
}

// 距离下一个寒冬还有几天；正处于寒冬时为 0，本章没有寒冬时为 null。
export function weeksToWinter(state) {
  if (!cfg(state).winter) return null;
  for (let i = 0; i < RULES.yearWeeks; i++) if (isWinter(state, state.week + i)) return i;
  return null;
}

export function facilityOutput(state, id) {
  if (id === 'farm') {
    if (state.blightWeeks > 0) return 0;
    return isWinter(state) ? FACILITIES.farm.produce / 2 : FACILITIES.farm.produce;
  }
  if (id === 'tradepost') return FACILITIES.tradepost.produce + new Set(state.facilities).size - 1;
  return FACILITIES[id].produce;
}

export function production(state) {
  return state.facilities.reduce((sum, id) => sum + facilityOutput(state, id), 0);
}

export function upkeep(state) {
  return state.facilities.reduce((sum, id) => sum + FACILITIES[id].upkeep, 0);
}

export function expenses(state) {
  return state.people * RULES.eatPerPerson + upkeep(state);
}

export function buildCost(state, id) {
  const cost = FACILITIES[id].cost;
  return isWinter(state) ? Math.floor(cost * RULES.winterDiscount) : cost;
}

export function dismantleValue(state, id) {
  return Math.floor(FACILITIES[id].cost * (state.partsShortage ? 1 : RULES.dismantleRefund));
}

// 废墟剩余的丰富程度，1 为刚开局，随天数下降到下限。
export function depletion(state) {
  return Math.max(RULES.depletionFloor, 1 - RULES.depletion * (state.week - 1));
}

// 一次搜刮可能带回的数量范围 [最少, 最多]。
export function scavengeRange(state, depth) {
  const spec = RULES.scavenge[depth];
  let k = 1 + RULES.crewBonus * (state.people - 1);
  if (state.facilities.includes('truck')) k *= 1 + RULES.truckBonus;
  if (isWinter(state)) k *= RULES.winterScavenge;
  k *= depletion(state);
  return [Math.floor(spec.min * k), Math.floor(spec.max * k)];
}

// 当前可执行的动作，供界面和模拟脚本使用。
export function legalActions(state) {
  if (state.status !== 'playing') return [];
  if (state.pending) {
    return state.pending.choices
      .filter((c) => !(c.id === 'invest' && state.supplies < RULES.scamStake))
      .map((c) => ({ type: 'resolve', choice: c.id }));
  }
  const chapter = cfg(state);
  const actions = [{ type: 'rest' }];
  if (state.injuredWeeks === 0) {
    actions.push({ type: 'scavenge', depth: 'safe' }, { type: 'scavenge', depth: 'deep' });
  }
  for (const id of chapter.facilities) {
    if (state.supplies >= buildCost(state, id)) actions.push({ type: 'build', facility: id });
  }
  for (const id of new Set(state.facilities)) actions.push({ type: 'dismantle', facility: id });
  if (chapter.borrow && state.debt < RULES.debtCap) {
    actions.push({ type: 'borrow', max: RULES.debtCap - state.debt });
  }
  if (state.debt > 0 && state.supplies > 0) {
    actions.push({ type: 'repay', max: Math.min(state.debt, state.supplies) });
  }
  return actions;
}

export function act(state, action) {
  if (state.status !== 'playing') throw new Error('对局已结束');
  const s = structuredClone(state);
  s.log = [];

  if (s.pending) {
    if (action.type !== 'resolve') throw new Error('需要先处理当前事件');
    resolveEvent(s, action.choice);
    return s;
  }

  const chapter = cfg(s);
  switch (action.type) {
    case 'build': {
      const id = need(action.facility);
      if (!chapter.facilities.includes(id)) throw new Error('本章还不能建这个设施');
      const cost = buildCost(s, id);
      if (s.supplies < cost) throw new Error('物资不足');
      s.supplies -= cost;
      s.facilities.push(id);
      s.stats.built += 1;
      s.seen[id] = true;
      if (isWinter(s)) s.seen.winterDeal = true;
      note(s, `建成${FACILITIES[id].name}`, 'info', -cost);
      return s;
    }
    case 'dismantle': {
      const id = need(action.facility);
      const i = s.facilities.indexOf(id);
      if (i < 0) throw new Error('没有这个设施');
      const value = dismantleValue(s, id);
      s.facilities.splice(i, 1);
      s.supplies += value;
      s.seen.dismantle = true;
      note(s, `拆卖${FACILITIES[id].name}`, 'info', value);
      return s;
    }
    case 'borrow': {
      if (!chapter.borrow) throw new Error('本章还不能借粮');
      const amount = positiveInt(action.amount);
      if (s.debt + amount > RULES.debtCap) throw new Error('超过可借上限');
      borrow(s, amount);
      note(s, '向隔壁据点借粮', 'debt', amount);
      return s;
    }
    case 'repay': {
      const amount = Math.min(positiveInt(action.amount), s.debt, s.supplies);
      s.debt -= amount;
      s.supplies -= amount;
      note(s, s.debt === 0 ? '欠粮还清了' : '还粮', 'info', -amount);
      return s;
    }
    case 'scavenge': {
      if (s.injuredWeeks > 0) throw new Error('受伤期间不能出门');
      const spec = RULES.scavenge[action.depth];
      if (!spec) throw new Error('未知的搜刮方式');
      const [lo, hi] = scavengeRange(s, action.depth);
      const gain = Math.floor(lo + rand(s) * (hi - lo + 1));
      s.supplies += gain;
      s.stats.scavenged += gain;
      if (s.facilities.includes('truck')) s.seen.truck = true;
      note(s, action.depth === 'deep' ? '深入废墟搜刮' : '在附近搜刮', 'good', gain);
      if (rand(s) < spec.injury) {
        s.injuredWeeks = spec.injuryWeeks + 1; // 本天结算会先减 1
        s.injuredBy = action.depth;
        s.stats.injuries += 1;
        s.seen.injury = true;
        note(s, `你受伤了，接下来 ${spec.injuryWeeks} 天不能出门`, 'bad');
      }
      endWeek(s, gain);
      return s;
    }
    case 'gather': {
      // 把背包里的东西放进仓库。不推进天数。
      const amount = positiveInt(action.amount);
      s.supplies += amount;
      s.gathered += amount;
      s.stats.scavenged += amount;
      if (s.facilities.includes('truck')) s.seen.truck = true;
      note(s, '搜刮带回', 'good', amount);
      return s;
    }
    case 'hurt': {
      // 在外面受伤：当天结束，之后 days 天不能出门。
      const days = positiveInt(action.days);
      s.injuredWeeks = days + 1; // 当晚结算会先减 1
      s.injuredBy = action.by === 'night' ? 'night' : 'deep';
      s.stats.injuries += 1;
      s.seen.injury = true;
      note(s, `你受伤了，接下来 ${days} 天不能出门`, 'bad');
      endWeek(s, s.gathered);
      return s;
    }
    case 'rest':
      if (s.injuredWeeks > 0) note(s, '养伤', 'info');
      endWeek(s, s.gathered);
      return s;
    default:
      throw new Error('未知动作');
  }
}

function need(id) {
  if (!FACILITIES[id]) throw new Error('未知设施');
  return id;
}

function positiveInt(n) {
  if (!Number.isInteger(n) || n <= 0) throw new Error('数量必须是正整数');
  return n;
}

function borrow(s, amount) {
  s.debt += amount;
  s.supplies += amount;
  s.stats.borrowed += amount;
  s.seen.debt = true;
}

// 天末结算的前半段：自产、消耗、利息。断粮时进入“断粮”事件，等玩家决定。
function endWeek(s, scavenged) {
  s.gathered = 0;
  const produced = production(s);
  const eaten = s.people * RULES.eatPerPerson;
  const maintain = upkeep(s);
  s.supplies += produced - eaten - maintain;
  s.stats.produced += produced;
  s.stats.eaten += eaten + maintain;

  let interest = 0;
  if (s.debt > 0) {
    interest = Math.ceil(s.debt * RULES.interest);
    s.debt += interest;
    s.stats.interest += interest;
  }
  s.lastWeek = { week: s.week, scavenged, produced, eaten, upkeep: maintain, interest, spoiled: 0 };

  if (s.supplies < 0) return crisis(s);
  finishWeek(s);
}

const fireSaleValue = (s, id) =>
  s.partsShortage ? FACILITIES[id].cost : Math.floor(FACILITIES[id].cost * RULES.fireSaleRefund);

const crisisDebt = (short) => Math.ceil(short * (1 + RULES.crisisPremium));

function crisis(s) {
  const short = -s.supplies;
  const choices = [];
  const owed = crisisDebt(short);
  if (cfg(s).borrow && s.debt + owed <= RULES.debtCap) {
    choices.push({ id: 'borrow', label: `向隔壁赊 ${short} 份粮`, hint: `趁火打劫：记账 ${owed}，另加每天一成利息` });
  }
  for (const id of new Set(s.facilities)) {
    const value = fireSaleValue(s, id);
    choices.push({
      id: `sell:${id}`,
      label: `拆卖${FACILITIES[id].name}，换 ${value}`,
      hint: value < FACILITIES[id].cost ? `来不及找买家，只能当废铁卖。建它花了 ${FACILITIES[id].cost}` : '零件紧缺，能卖全价',
    });
  }
  if (choices.length === 0) return die(s);
  s.seen.crisis = true;
  s.pending = {
    id: 'crisis',
    name: '断粮了',
    text: `仓库还差 ${short} 份物资，今晚有人要饿肚子。`,
    choices,
  };
}

// 天末结算的后半段：抵债、胜负、变质、进入下一天并抽事件。
function finishWeek(s) {
  if (s.debt > RULES.debtCap) {
    if (s.facilities.length === 0) return die(s, 'debt');
    const taken = s.facilities.reduce((a, b) => (FACILITIES[b].cost > FACILITIES[a].cost ? b : a));
    s.facilities.splice(s.facilities.indexOf(taken), 1);
    s.debt = Math.max(0, s.debt - FACILITIES[taken].cost);
    s.seen.seized = true;
    note(s, `还不上粮，隔壁据点拆走了你的${FACILITIES[taken].name}`, 'bad');
  }

  const produced = production(s);
  const cost = expenses(s);
  record(s);

  if (produced >= cost && s.debt === 0) {
    s.status = 'won';
    note(s, '自产已经够吃，你再也不用出门了', 'good');
    return;
  }

  const spoiled = Math.floor(Math.max(0, s.supplies - RULES.spoilFree) * RULES.spoilRate);
  if (spoiled > 0) {
    s.supplies -= spoiled;
    s.stats.spoiled += spoiled;
    s.lastWeek.spoiled = spoiled;
    s.seen.spoil = true;
  }

  if (s.injuredWeeks > 0) s.injuredWeeks -= 1;
  if (s.injuredWeeks === 0) s.injuredBy = null;
  if (s.blightWeeks > 0) s.blightWeeks -= 1;
  s.partsShortage = false;
  s.week += 1;
  if (isWinter(s) && !isWinter(s, s.week - 1)) {
    s.seen.winter = true;
    note(s, '寒冬来了：搜刮变难，农场减产，设施打七折', 'event');
  }

  if (rand(s) < RULES.eventChance) drawEvent(s);
}

function record(s) {
  s.history.push({
    week: s.lastWeek.week,
    supplies: s.supplies,
    production: production(s),
    expenses: expenses(s),
    debt: s.debt,
  });
}

function drawEvent(s) {
  const pool = EVENTS.filter((e) => cfg(s).events.includes(e.id));
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = rand(s) * total;
  const event = pool.find((e) => (roll -= e.weight) < 0) ?? pool[0];
  if (event.id === 'quiet') return;
  if (!event.choices) note(s, `${event.name}：${event.text}`, 'event');

  switch (event.id) {
    case 'raid': {
      s.seen.raid = true;
      if (s.facilities.includes('wall')) {
        s.seen.wallHeld = true;
        note(s, '围墙挡住了他们', 'good');
      } else {
        const lost = Math.ceil(s.supplies * RULES.raidLoss);
        s.supplies -= lost;
        s.stats.raided += lost;
        note(s, '仓库被抢', 'bad', -lost);
      }
      break;
    }
    case 'blight':
      s.blightWeeks = RULES.blightWeeks;
      if (s.facilities.includes('farm')) s.seen.blight = true;
      break;
    case 'breakdown': {
      const paid = Math.min(s.supplies, RULES.breakdownCost);
      const owed = cfg(s).borrow ? RULES.breakdownCost - paid : 0;
      s.supplies -= paid;
      s.seen.breakdown = true;
      if (paid > 0) note(s, '修理发电机', 'bad', -paid);
      if (owed > 0) {
        s.debt += owed;
        s.stats.borrowed += owed;
        s.seen.debt = true;
        note(s, `存粮不够，剩下的 ${owed} 只能赊账`, 'debt');
      }
      break;
    }
    case 'windfall':
      s.supplies += RULES.windfall;
      note(s, '收下谢礼', 'good', RULES.windfall);
      break;
    case 'shortage':
      s.partsShortage = true;
      break;
    case 'refugee':
    case 'scam':
      s.pending = { id: event.id, name: event.name, text: event.text, choices: event.choices };
      break;
  }
}

function resolveEvent(s, choice) {
  const { id, choices } = s.pending;
  if (!choices.some((c) => c.id === choice)) throw new Error('无效的选择');
  s.pending = null;

  if (id === 'crisis') {
    if (choice === 'borrow') {
      const short = -s.supplies;
      borrow(s, short);
      s.debt += crisisDebt(short) - short;
      note(s, '赊粮渡过难关', 'debt', short);
    } else {
      const fid = choice.slice('sell:'.length);
      const value = fireSaleValue(s, fid);
      s.facilities.splice(s.facilities.indexOf(fid), 1);
      s.supplies += value;
      s.stats.fireSaleLoss += FACILITIES[fid].cost - value;
      s.seen.fireSale = true;
      note(s, `急着用粮，拆卖了${FACILITIES[fid].name}`, 'bad', value);
    }
    if (s.supplies < 0) return crisis(s);
    return finishWeek(s);
  }

  if (id === 'refugee') {
    if (choice === 'accept') {
      s.people += 1;
      s.seen.refugee = true;
      note(s, '避难所多了一个人：搜刮更多，口粮也更多', 'info');
    } else {
      note(s, '你婉拒了他', 'info');
    }
  } else if (id === 'scam') {
    s.seen.scam = true;
    if (choice === 'invest') {
      if (s.supplies < RULES.scamStake) throw new Error('物资不足');
      s.supplies -= RULES.scamStake;
      note(s, '交给商队入伙', 'info', -RULES.scamStake);
      if (rand(s) < RULES.scamWinChance) {
        s.supplies += RULES.scamPayout;
        note(s, '商队居然守信', 'good', RULES.scamPayout);
      } else {
        s.stats.scamLost += RULES.scamStake;
        note(s, '商队连夜消失，物资打了水漂', 'bad');
      }
    } else {
      note(s, '你没有理会那支商队', 'info');
    }
  }
}

function die(s, cause) {
  s.status = 'dead';
  s.pending = null;
  s.cause = cause ?? diagnose(s);
  if (s.lastWeek && s.history.at(-1)?.week !== s.lastWeek.week) record(s);
  note(s, '避难所没能撑下去', 'bad');
}

// 判断最主要的死因，用于死因报告。
function diagnose(s) {
  if (s.debt >= RULES.debtCap / 2) return 'debt';
  if (s.stats.fireSaleLoss > 0) return 'liquidity';
  if (s.injuredWeeks > 0 && s.injuredBy === 'deep') return 'risk';
  if (s.stats.scamLost > 0 && s.stats.built === 0) return 'scam';
  if (s.stats.built === 0) return 'noPassive';
  return 'noReserve';
}
