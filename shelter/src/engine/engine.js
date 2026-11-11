// 规则引擎。act(state, action) 返回新状态，不修改传入的状态。
import { FACILITIES } from '../data/facilities.js';
import { EVENTS } from '../data/events.js';

export const RULES = {
  startSupplies: 20,
  startPeople: 2,
  eatPerPerson: 5,
  yearWeeks: 12,
  winterWeeks: 3,
  winterScavenge: 0.6,
  winterDiscount: 0.7,
  scavenge: {
    safe: { min: 10, max: 15, injury: 0.05 },
    deep: { min: 16, max: 26, injury: 0.35 },
  },
  crewBonus: 0.25,
  truckBonus: 0.3,
  injuryWeeks: 2,
  blightWeeks: 2,
  spoilFree: 30,
  spoilRate: 0.05,
  interest: 0.1,
  debtCap: 60,
  dismantleRefund: 0.5,
  eventChance: 0.6,
  raidLoss: 0.2,
  breakdownCost: 6,
  windfall: 8,
  scamStake: 20,
  scamPayout: 40,
  scamWinChance: 0.15,
};

export function newGame(seed = 1) {
  return {
    rng: seed >>> 0,
    week: 1,
    supplies: RULES.startSupplies,
    people: RULES.startPeople,
    injuredWeeks: 0,
    blightWeeks: 0,
    partsShortage: false,
    facilities: [],
    debt: 0,
    pending: null,
    status: 'playing',
    cause: null,
    log: [],
    history: [],
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

export function isWinter(week) {
  return (week - 1) % RULES.yearWeeks >= RULES.yearWeeks - RULES.winterWeeks;
}

export function production(state) {
  const kinds = new Set(state.facilities);
  let total = 0;
  for (const id of state.facilities) {
    if (id === 'farm') {
      if (state.blightWeeks > 0) continue;
      total += isWinter(state.week) ? FACILITIES.farm.produce / 2 : FACILITIES.farm.produce;
    } else if (id === 'tradepost') {
      total += FACILITIES.tradepost.produce + kinds.size - 1;
    } else {
      total += FACILITIES[id].produce;
    }
  }
  return total;
}

export function expenses(state) {
  const upkeep = state.facilities.reduce((sum, id) => sum + FACILITIES[id].upkeep, 0);
  return state.people * RULES.eatPerPerson + upkeep;
}

export function buildCost(state, id) {
  const cost = FACILITIES[id].cost;
  return isWinter(state.week) ? Math.floor(cost * RULES.winterDiscount) : cost;
}

export function dismantleValue(state, id) {
  return Math.floor(FACILITIES[id].cost * (state.partsShortage ? 1 : RULES.dismantleRefund));
}

// 当前可执行的动作，供界面和模拟脚本使用。
export function legalActions(state) {
  if (state.status !== 'playing') return [];
  if (state.pending) {
    return state.pending.choices
      .filter((c) => !(c.id === 'invest' && state.supplies < RULES.scamStake))
      .map((c) => ({ type: 'resolve', choice: c.id }));
  }
  const actions = [{ type: 'rest' }];
  if (state.injuredWeeks === 0) {
    actions.push({ type: 'scavenge', depth: 'safe' }, { type: 'scavenge', depth: 'deep' });
  }
  for (const id of Object.keys(FACILITIES)) {
    if (state.supplies >= buildCost(state, id)) actions.push({ type: 'build', facility: id });
  }
  for (const id of new Set(state.facilities)) actions.push({ type: 'dismantle', facility: id });
  if (state.debt < RULES.debtCap) actions.push({ type: 'borrow', max: RULES.debtCap - state.debt });
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

  switch (action.type) {
    case 'build': {
      const cost = buildCost(s, need(action.facility));
      if (s.supplies < cost) throw new Error('物资不足');
      s.supplies -= cost;
      s.facilities.push(action.facility);
      s.log.push(`建成${FACILITIES[action.facility].name}，花费 ${cost}`);
      return s;
    }
    case 'dismantle': {
      const i = s.facilities.indexOf(need(action.facility));
      if (i < 0) throw new Error('没有这个设施');
      const value = dismantleValue(s, action.facility);
      s.facilities.splice(i, 1);
      s.supplies += value;
      s.log.push(`拆卖${FACILITIES[action.facility].name}，换回 ${value}`);
      return s;
    }
    case 'borrow': {
      const amount = positiveInt(action.amount);
      if (s.debt + amount > RULES.debtCap) throw new Error('超过可借上限');
      s.debt += amount;
      s.supplies += amount;
      s.log.push(`向隔壁据点借粮 ${amount}`);
      return s;
    }
    case 'repay': {
      const amount = Math.min(positiveInt(action.amount), s.debt, s.supplies);
      s.debt -= amount;
      s.supplies -= amount;
      s.log.push(`还粮 ${amount}`);
      return s;
    }
    case 'scavenge': {
      if (s.injuredWeeks > 0) throw new Error('受伤期间不能出门');
      const spec = RULES.scavenge[action.depth];
      if (!spec) throw new Error('未知的搜刮方式');
      let gain = spec.min + rand(s) * (spec.max - spec.min);
      gain *= 1 + RULES.crewBonus * (s.people - 1);
      if (s.facilities.includes('truck')) gain *= 1 + RULES.truckBonus;
      if (isWinter(s.week)) gain *= RULES.winterScavenge;
      gain = Math.floor(gain);
      s.supplies += gain;
      s.log.push(`出门搜刮，带回 ${gain}`);
      if (rand(s) < spec.injury) {
        s.injuredWeeks = RULES.injuryWeeks + 1; // 本周结算会先减 1
        s.log.push(`你受伤了，接下来 ${RULES.injuryWeeks} 周不能出门`);
      }
      break;
    }
    case 'rest':
      s.log.push('留守一周');
      break;
    default:
      throw new Error('未知动作');
  }

  endWeek(s);
  return s;
}

function need(id) {
  if (!FACILITIES[id]) throw new Error('未知设施');
  return id;
}

function positiveInt(n) {
  if (!Number.isInteger(n) || n <= 0) throw new Error('数量必须是正整数');
  return n;
}

function endWeek(s) {
  const prod = production(s);
  const cost = expenses(s);
  s.supplies += prod - cost;
  s.log.push(`本周自产 ${prod}，消耗 ${cost}`);

  if (s.debt > 0) {
    const interest = Math.ceil(s.debt * RULES.interest);
    s.debt += interest;
    s.log.push(`欠粮利息 +${interest}`);
  }

  s.history.push({ week: s.week, supplies: s.supplies, production: prod, expenses: cost, debt: s.debt });

  if (s.supplies < 0) return die(s);

  if (s.debt > RULES.debtCap) {
    if (s.facilities.length === 0) return die(s, 'debt');
    const taken = s.facilities.reduce((a, b) => (FACILITIES[b].cost > FACILITIES[a].cost ? b : a));
    s.facilities.splice(s.facilities.indexOf(taken), 1);
    s.debt = Math.max(0, s.debt - FACILITIES[taken].cost);
    s.log.push(`还不上粮，隔壁据点拆走了你的${FACILITIES[taken].name}`);
  }

  if (prod >= cost && s.debt === 0) {
    s.status = 'won';
    s.log.push('自产已经够吃，你再也不用出门了');
    return;
  }

  const spoiled = Math.floor(Math.max(0, s.supplies - RULES.spoilFree) * RULES.spoilRate);
  if (spoiled > 0) {
    s.supplies -= spoiled;
    s.log.push(`存粮变质 ${spoiled}`);
  }

  if (s.injuredWeeks > 0) s.injuredWeeks -= 1;
  if (s.blightWeeks > 0) s.blightWeeks -= 1;
  s.partsShortage = false;
  s.week += 1;
  if (isWinter(s.week) && !isWinter(s.week - 1)) s.log.push('寒冬来了：搜刮变难，农场减产，设施打七折');

  if (rand(s) < RULES.eventChance) drawEvent(s);
}

function drawEvent(s) {
  const total = EVENTS.reduce((sum, e) => sum + e.weight, 0);
  let roll = rand(s) * total;
  const event = EVENTS.find((e) => (roll -= e.weight) < 0) ?? EVENTS[0];
  s.log.push(`【${event.name}】${event.text}`);

  switch (event.id) {
    case 'raid': {
      if (s.facilities.includes('wall')) {
        s.log.push('围墙挡住了他们');
      } else {
        const lost = Math.ceil(s.supplies * RULES.raidLoss);
        s.supplies -= lost;
        s.log.push(`被抢走 ${lost}`);
      }
      break;
    }
    case 'blight':
      s.blightWeeks = RULES.blightWeeks;
      break;
    case 'breakdown': {
      const paid = Math.min(s.supplies, RULES.breakdownCost);
      s.supplies -= paid;
      s.debt += RULES.breakdownCost - paid;
      break;
    }
    case 'windfall':
      s.supplies += RULES.windfall;
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
  if (id === 'refugee' && choice === 'accept') {
    s.people += 1;
    s.log.push('避难所多了一个人');
  } else if (id === 'scam' && choice === 'invest') {
    if (s.supplies < RULES.scamStake) throw new Error('物资不足');
    s.supplies -= RULES.scamStake;
    if (rand(s) < RULES.scamWinChance) {
      s.supplies += RULES.scamPayout;
      s.log.push(`商队居然守信，还了 ${RULES.scamPayout}`);
    } else {
      s.log.push('商队连夜消失，物资打了水漂');
    }
  } else {
    s.log.push('你拒绝了');
  }
  s.pending = null;
}

function die(s, cause) {
  s.status = 'dead';
  s.cause = cause ?? diagnose(s);
}

// 判断最主要的死因，用于死因报告。
function diagnose(s) {
  const assetValue = s.facilities.reduce((sum, id) => sum + FACILITIES[id].cost, 0);
  if (s.debt >= RULES.debtCap / 2) return 'debt';
  if (assetValue >= 80) return 'liquidity';
  if (s.facilities.every((id) => FACILITIES[id].produce === 0)) return 'noPassive';
  return 'noReserve';
}
