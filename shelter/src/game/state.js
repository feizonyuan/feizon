// 游戏规则：物品、种植、钱、房租、借贷、每日结算和生活评语。
// 这里只有数据和计算，不碰画面，所以可以直接用 node 测试。

export const RULES = {
  dayStartHour: 6,
  dayHours: 18, // 6:00 到 24:00
  daySeconds: 170, // 一天的真实秒数
  startMoney: 40,
  rent: 60,
  rentEvery: 5,
  lateRentPenalty: 0.2,
  inflation: 0.04, // 每个交租周期物价上涨
  interest: 0.05, // 欠款每天的利息
  borrowMax: 300,
  debtCap: 450, // 欠到这个数，放贷的人会来搬东西
  foodPerDay: 45,
  moodPerDay: 8,
  job: { pay: 34, energy: 40, hours: 4 },
  energy: { till: 3, water: 1, plant: 1, scavenge: 3, fish: 4, forage: 1 },
  lowMood: 30,
  slots: 10,
  dogFee: 0.15,
};

export const ITEMS = {
  hoe: { name: '锄头', tool: true, hint: '对着院子里的土地用，翻出一块田' },
  can: { name: '水壶', tool: true, hint: '给田里的作物浇水，每天浇一次才会长' },
  rod: { name: '鱼竿', tool: true, hint: '站在池塘边对着水用' },
  seedCabbage: { name: '青菜种子', buy: 5, crop: 'cabbage' },
  seedPotato: { name: '土豆种子', buy: 9, crop: 'potato' },
  seedTomato: { name: '番茄种子', buy: 16, crop: 'tomato' },
  cabbage: { name: '青菜', sell: 11, food: 12 },
  potato: { name: '土豆', sell: 24, food: 22 },
  tomato: { name: '番茄', sell: 15, food: 14, mood: 2 },
  tin: { name: '罐头', buy: 9, sell: 5, food: 40 },
  scrap: { name: '废铁', sell: 6 },
  battery: { name: '电池', sell: 22 },
  berry: { name: '野莓', sell: 3, food: 8, mood: 3 },
  mushroom: { name: '蘑菇', sell: 7, food: 10 },
  fish: { name: '鱼', sell: 16, food: 30 },
  tea: { name: '奶茶', buy: 10, food: 5, mood: 18 },
};

export const CROPS = {
  cabbage: { name: '青菜', days: 2 },
  potato: { name: '土豆', days: 3 },
  tomato: { name: '番茄', days: 4, regrow: 2 },
};

// 能自己生钱的设备：买下来放在院子里，每天早上自动进账。
export const ASSETS = {
  rain: { name: '雨水收集器', cost: 120, income: 8, note: '接雨水卖给营地' },
  coop: { name: '鸡窝', cost: 220, income: 16, note: '每天下蛋，阿梅上门收' },
  solar: { name: '太阳能充电站', cost: 380, income: 30, note: '邻居来充电要付钱' },
  vending: { name: '自动售货机', cost: 650, income: 55, note: '摆在路口，自己卖货' },
};

// 让日子舒服的东西：买的时候花钱，之后每天还要花钱。
export const LUXURY = {
  console: { name: '游戏机', cost: 150, upkeep: 3, note: '在屋里打游戏，心情大涨。每天电费 3' },
  bike: { name: '电动车', cost: 200, upkeep: 5, note: '走得快很多。每天充电 5' },
};

export const SHOP = ['seedCabbage', 'seedPotato', 'seedTomato', 'tin'];

const LEDGER = () => ({ wage: 0, sales: 0, passive: 0, rent: 0, food: 0, fun: 0, biz: 0, invest: 0, interest: 0, other: 0 });

export function newState(seed = 1) {
  const inv = Array(RULES.slots).fill(null);
  [
    ['hoe', 1],
    ['can', 1],
    ['rod', 1],
    ['seedCabbage', 4],
    ['tin', 2],
  ].forEach(([id, n], i) => (inv[i] = { id, n }));
  return {
    v: 1,
    seed: seed >>> 0,
    day: 1,
    minutes: 0, // 从早上 6 点算起
    money: RULES.startMoney,
    debt: 0,
    energy: 100,
    food: 70,
    mood: 60,
    inv,
    sel: 0,
    soil: {}, // "x,y" → { wet, crop, age, grown }
    assets: [],
    owned: {},
    cool: {}, // 采集点 id → 还要几天才恢复
    index: 1, // 物价指数
    period: { ...LEDGER(), moodSum: 0, days: 0, lazyDays: 0 },
    total: LEDGER(),
    worked: 0, // 今天花掉的体力
    jobDay: 0,
    free: false,
    freeDay: 0,
    reviews: 0,
    history: [],
  };
}

export const price = (s, base) => Math.max(1, Math.round(base * s.index));

export function clockText(s) {
  const m = Math.min(RULES.dayHours * 60, Math.floor(s.minutes / 10) * 10);
  return `${String(RULES.dayStartHour + Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* ---------- 钱 ---------- */

export function earn(s, amount, kind) {
  s.money += amount;
  s.period[kind] += amount;
  s.total[kind] += amount;
}

export function spend(s, amount, kind) {
  if (s.money < amount) return false;
  s.money -= amount;
  s.period[kind] += amount;
  s.total[kind] += amount;
  return true;
}

export const rentNow = (s) => price(s, RULES.rent);

export function upkeep(s) {
  return Object.keys(s.owned).reduce((sum, id) => sum + price(s, LUXURY[id].upkeep), 0);
}

export function passiveIncome(s) {
  return s.assets.reduce((sum, id) => sum + price(s, ASSETS[id].income), 0);
}

// 什么都不干也要花掉的钱：房租摊到每天，加两顿饭，加各种电费。
export function livingCost(s) {
  return Math.ceil(rentNow(s) / RULES.rentEvery) + 2 * price(s, ITEMS.tin.buy) + upkeep(s);
}

export function netWorth(s) {
  return s.money - s.debt + s.assets.reduce((sum, id) => sum + ASSETS[id].cost, 0);
}

export const daysToRent = (s) => RULES.rentEvery - ((s.day - 1) % RULES.rentEvery);

/* ---------- 背包 ---------- */

export function addItem(s, id, n = 1) {
  const slot = s.inv.find((x) => x && x.id === id);
  if (slot) {
    slot.n += n;
    return true;
  }
  const empty = s.inv.indexOf(null);
  if (empty < 0) return false;
  s.inv[empty] = { id, n };
  return true;
}

export function takeItem(s, index, n = 1) {
  const slot = s.inv[index];
  if (!slot || slot.n < n || ITEMS[slot.id].tool) return false;
  slot.n -= n;
  if (slot.n === 0) s.inv[index] = null;
  return true;
}

export const count = (s, id) => s.inv.find((x) => x && x.id === id)?.n ?? 0;

/* ---------- 体力、吃喝 ---------- */

export function energyCost(s, base) {
  return s.mood < RULES.lowMood ? Math.ceil(base * 1.5) : base;
}

export function useEnergy(s, base) {
  const cost = energyCost(s, base);
  if (s.energy < cost) return false;
  s.energy -= cost;
  s.worked += cost;
  return true;
}

const clamp = (n) => Math.max(0, Math.min(100, n));

export function addMood(s, n) {
  s.mood = clamp(s.mood + n);
}

export function eat(s, index) {
  const slot = s.inv[index];
  const item = slot && ITEMS[slot.id];
  if (!item?.food) return null;
  if (s.food >= 100 && !item.mood) return { full: true };
  takeItem(s, index, 1);
  s.food = clamp(s.food + item.food);
  s.energy = clamp(s.energy + Math.round(item.food / 3));
  if (item.mood) addMood(s, item.mood);
  return { item };
}

/* ---------- 买卖 ---------- */

export function buy(s, id) {
  const item = ITEMS[id];
  const cost = price(s, item.buy);
  if (s.money < cost) return '钱不够';
  if (!s.inv.some((x) => x === null || x.id === id)) return '背包满了';
  spend(s, cost, item.crop ? 'biz' : id === 'tea' ? 'fun' : 'food');
  addItem(s, id, 1);
  return null;
}

export function sell(s, index, all = false) {
  const slot = s.inv[index];
  const item = slot && ITEMS[slot.id];
  if (!item?.sell) return 0;
  const n = all ? slot.n : 1;
  const got = price(s, item.sell) * n;
  takeItem(s, index, n);
  earn(s, got, 'sales');
  return got;
}

export function buyAsset(s, id, pads) {
  const cost = price(s, ASSETS[id].cost);
  if (s.assets.length >= pads) return '院子里没有空位了';
  if (!spend(s, cost, 'invest')) return '钱不够';
  s.assets.push(id);
  return null;
}

export function buyLuxury(s, id) {
  if (s.owned[id]) return '已经有了';
  if (!spend(s, price(s, LUXURY[id].cost), 'fun')) return '钱不够';
  s.owned[id] = true;
  return null;
}

export function borrow(s, amount) {
  if (s.debt + amount > RULES.borrowMax) return '他不肯再借了';
  s.debt += amount;
  s.money += amount;
  return null;
}

export function repay(s, amount) {
  const paid = Math.min(amount, s.debt, s.money);
  s.debt -= paid;
  s.money -= paid;
  return paid;
}

export function doJob(s) {
  if (s.jobDay === s.day) return '今天的活已经干完了';
  if (s.minutes + RULES.job.hours * 60 > RULES.dayHours * 60 - 60) return '太晚了，明天再来';
  if (!useEnergy(s, RULES.job.energy)) return '你累得搬不动了';
  s.jobDay = s.day;
  s.minutes += RULES.job.hours * 60;
  earn(s, price(s, RULES.job.pay), 'wage');
  addMood(s, -6);
  return null;
}

/* ---------- 种地 ---------- */

export function cropStage(tile) {
  if (!tile?.crop) return -1;
  const def = CROPS[tile.crop];
  if (tile.age >= def.days) return 3;
  return Math.min(2, Math.floor((tile.age / def.days) * 3));
}

export function till(s, key) {
  if (s.soil[key]) return '这里已经翻过了';
  if (!useEnergy(s, RULES.energy.till)) return '没力气了';
  s.soil[key] = { wet: false, crop: null, age: 0 };
  return null;
}

export function water(s, key) {
  const tile = s.soil[key];
  if (!tile) return '这里没有田';
  if (tile.wet) return '已经浇过了';
  if (!useEnergy(s, RULES.energy.water)) return '没力气了';
  tile.wet = true;
  return null;
}

export function plant(s, key, index) {
  const tile = s.soil[key];
  const slot = s.inv[index];
  const crop = slot && ITEMS[slot.id].crop;
  if (!tile) return '先用锄头翻地';
  if (!crop) return '这不是种子';
  if (tile.crop) return '这里已经种了东西';
  if (!useEnergy(s, RULES.energy.plant)) return '没力气了';
  takeItem(s, index, 1);
  tile.crop = crop;
  tile.age = 0;
  return null;
}

export function harvest(s, key) {
  const tile = s.soil[key];
  if (cropStage(tile) !== 3) return null;
  if (!addItem(s, tile.crop, 1)) return { error: '背包满了' };
  const id = tile.crop;
  const def = CROPS[id];
  if (def.regrow) tile.age = def.days - def.regrow;
  else {
    tile.crop = null;
    tile.age = 0;
  }
  return { id };
}

/* ---------- 一天结束 ---------- */

// 睡觉（或者熬到半夜倒下）之后调用。返回一份早晨的小结。
export function endDay(s, passedOut = false) {
  const report = { day: s.day + 1, lines: [], review: null, freed: false, seized: null };
  const line = (text, delta = 0, tone = 'info') => report.lines.push({ text, delta, tone });

  // 记下这一天过得怎么样
  s.period.days += 1;
  s.period.moodSum += s.mood;
  if (s.worked < 15) s.period.lazyDays += 1;

  // 作物：浇过水的长一天
  for (const tile of Object.values(s.soil)) {
    if (tile.crop && tile.wet && tile.age < CROPS[tile.crop].days) tile.age += 1;
    tile.wet = false;
  }
  for (const id of Object.keys(s.cool)) {
    s.cool[id] -= 1;
    if (s.cool[id] <= 0) delete s.cool[id];
  }

  // 被动收入和固定开销
  const passive = passiveIncome(s);
  if (passive > 0) {
    earn(s, passive, 'passive');
    line('院子里的设备自己赚的', passive, 'good');
  }
  const power = upkeep(s);
  if (power > 0) {
    const paid = Math.min(power, s.money);
    spend(s, paid, 'fun');
    if (paid < power) s.debt += power - paid;
    line('电费', -power, 'bad');
  }
  if (s.debt > 0) {
    const interest = Math.ceil(s.debt * RULES.interest);
    s.debt += interest;
    s.period.interest += interest;
    s.total.interest += interest;
    line('欠款又滚出利息', interest, 'debt');
  }

  // 身体
  const hungry = s.food < 30;
  s.energy = passedOut ? 50 : hungry ? 60 : 100;
  s.food = clamp(s.food - RULES.foodPerDay);
  addMood(s, -RULES.moodPerDay - (hungry ? 8 : 0) - (passedOut ? 10 : 0));
  if (passedOut) line('昨晚熬到半夜倒在路上，今天没什么精神', 0, 'bad');
  else if (hungry) line('昨晚饿着肚子睡的，今天体力只恢复了一部分', 0, 'bad');

  s.day += 1;
  s.minutes = 0;
  s.worked = 0;

  // 交租日
  if ((s.day - 1) % RULES.rentEvery === 0) {
    const rent = rentNow(s);
    const paid = Math.min(rent, s.money);
    spend(s, paid, 'rent');
    if (paid < rent) {
      const owed = Math.ceil((rent - paid) * (1 + RULES.lateRentPenalty));
      s.debt += owed;
      line(`房租 ${rent}，钱不够，差的部分加两成记在账上`, -paid, 'bad');
      line('新增欠款', owed, 'debt');
    } else line('交房租', -rent, 'bad');
    report.review = review(s);
    s.reviews += 1;
    s.period = { ...LEDGER(), moodSum: 0, days: 0, lazyDays: 0 };
    s.index = Math.round(s.index * (1 + RULES.inflation) * 1000) / 1000;
    line(`物价又涨了，现在房租是 ${rentNow(s)}`, 0, 'event');
  }

  // 欠太多：搬走最值钱的设备抵债
  if (s.debt > RULES.debtCap && s.assets.length > 0) {
    const best = s.assets.reduce((a, b) => (ASSETS[b].cost > ASSETS[a].cost ? b : a));
    s.assets.splice(s.assets.indexOf(best), 1);
    s.debt = Math.max(0, s.debt - ASSETS[best].cost);
    report.seized = best;
    line(`欠得太多，金老板的人搬走了你的${ASSETS[best].name}`, 0, 'bad');
  }

  if (!s.free && s.debt === 0 && passiveIncome(s) >= livingCost(s)) {
    s.free = true;
    s.freeDay = s.day;
    report.freed = true;
  }

  s.history.push({ day: s.day, money: s.money, debt: s.debt, passive: passiveIncome(s), cost: livingCost(s), mood: s.mood });
  if (s.history.length > 120) s.history.shift();
  return report;
}

/* ---------- 生活评语 ---------- */

export const VERDICTS = {
  free: {
    title: '财富自由',
    text: '设备每天自己赚的钱，已经够你吃住。干不干活，从今往后是你说了算。',
    real: '现实里这叫被动收入覆盖了生活开支。它不等于有很多钱，而是不必再为钱出卖时间。',
  },
  debt: {
    title: '负债青年',
    text: '欠金老板的钱在利滚利，你赚的有一部分是在替他打工。',
    real: '现实里是网贷、分期和信用卡循环利息：借的时候轻松，利息一天也不休息。先把欠款还掉，比什么投资都划算。',
  },
  landlord: {
    title: '在路上的包租公',
    text: '你的收入里已经有不小的一块是设备自己赚来的。',
    real: '现实里这是在积累能产生收入的资产。继续把余钱换成它们，工资就会慢慢变成可有可无。',
  },
  flat: {
    title: '躺平大师',
    text: '赚得不多，花得也不多，心情却很好。只要房租交得上，这也是一种活法。',
    real: '现实里这是低欲望生活：开支压得够低，需要的收入也就少。风险在于一点积蓄都没有时，一次意外就会打破平衡。',
  },
  spender: {
    title: '月光族',
    text: '这几天赚的钱基本都喝掉、玩掉了，到交租的时候手里没剩什么。',
    real: '现实里是收入一涨、消费跟着涨。享受没有错，但先留下一部分再花，和花剩了再存，结果差得很远。',
  },
  grinder: {
    title: '卷王',
    text: '你赚了不少，可心情一直很差。心情差的时候，干什么都更费力气。',
    real: '现实里这是只顾挣钱、不顾自己：效率会下降，最后往往用一次报复性消费还回去。给娱乐留一笔预算是合理的开支。',
  },
  worker: {
    title: '稳稳的打工人',
    text: '收支大致平衡，靠的主要是自己动手赚来的钱。',
    real: '现实里是靠工资生活：稳定，但一停工就没有进账。可以开始把余钱换成能自己赚钱的东西。',
  },
};

export function review(s) {
  const p = s.period;
  const income = p.wage + p.sales + p.passive;
  const moodAvg = p.days ? p.moodSum / p.days : s.mood;
  const cost = livingCost(s) * Math.max(1, p.days);
  let key = 'worker';
  if (s.free || (s.debt === 0 && passiveIncome(s) >= livingCost(s))) key = 'free';
  else if (s.debt > 120) key = 'debt';
  else if (income > 0 && p.passive / income >= 0.4) key = 'landlord';
  else if (income > 0 && p.fun / income >= 0.3 && s.money < rentNow(s)) key = 'spender';
  else if (income < cost * 0.9 && moodAvg >= 55) key = 'flat';
  else if (moodAvg < 35 && income >= cost) key = 'grinder';
  return {
    key,
    ...VERDICTS[key],
    income: { wage: p.wage, sales: p.sales, passive: p.passive },
    spent: { rent: p.rent, food: p.food, fun: p.fun, biz: p.biz, invest: p.invest, interest: p.interest, other: p.other },
    moodAvg: Math.round(moodAvg),
    days: p.days,
    money: s.money,
    debt: s.debt,
    worth: netWorth(s),
    passive: passiveIncome(s),
    cost: livingCost(s),
  };
}
