// 《躺平计划》的规则：时间、体力、心力、打工、学习、吃饭、资产、负债、账单日。
// 这里只有数据和计算，不碰画面，可以直接用 node 测试和模拟。

export const RULES = {
  wakeHour: 7,
  dayHours: 16, // 7:00 到 23:00，其余 8 小时睡觉
  daySeconds: 190, // 醒着的一天对应的真实秒数
  monthDays: 5, // 一个账单周期
  start: { cash: 300, sanity: 50, fullness: 60, credit: 60 },
  rent: 400,
  rentHike: 0.15,
  rentHikeMonth: 3, // 第 3 个月开始时通知涨租
  bunkRent: 200,
  deposit: 300,
  job: { hours: 4, pay: 60, energy: 30, sanity: 12, open: 7, close: 22, tip: 6, bigTip: 12, scolded: 4 },
  repair: { hours: 2, pay: 90, energy: 22, sanity: 5, perDay: 3, tip: 15, redo: 20 },
  course: { classes: 6, hours: 2, fee: 30, energy: 10, sanity: 6, bonus: 0.5 },
  guide: { sessions: 5, hours: 2, energy: 8, sanity: 4, income: 90, max: 2 }, // 写维修教程：花时间做出来的资产
  bento: { price: 15, fullness: 50, hours: 0.5 },
  grocery: { price: 5 },
  cook: { hours: 1, fullness: 50, sanity: 4 },
  tea: { price: 18, sanity: 25, hours: 0.5 },
  bench: { hours: 1, sanity: 10 },
  read: { hours: 1, sanity: 7 },
  shower: { hours: 0.5, sanity: 6 },
  fishing: { hours: 2, sanity: 22, lessons: 3 },
  lesson: { hours: 0.5, sanity: 5, count: 6 },
  fullness: { perHour: 3, night: 8, low: 20, tired: 1.3 }, // 饿着干活更费体力
  sanityPerNight: 8,
  vending: { cost: 500, income: 120, resale: 250, max: 6 },
  fund: { yield: 0.03, down: 0.06, up: 0.08, min: 100 }, // 指数基金：收益低，但随时能卖
  phone: { months: 6, pay: 90, sanityNow: 30, nightly: 3 },
  ebike: { months: 8, pay: 150, upkeep: 20, speed: 1.45 },
  loan: { rate: 0.1, perCredit: 8 },
  sick: { fee: 260, energyCap: 50, sanity: 8, base: 0.02, tired: 0.15, overwork: 0.35 },
  scam: { rate: 0.3, minCash: 400, fromMonth: 2, iq: 4, stakes: [300, 500] },
  lowSanity: 30,
  winStreak: 3,
};

// 每天早上抽一件“今天的事”。needs 不满足的不会抽到；where 用来在地图上标个记号。
export const EVENTS = [
  { id: 'plain', weight: 30, name: '', text: '' },
  { id: 'bentoSale', weight: 10, name: '临期便当半价', text: '便利店今天清一批临期便当，一份 8 块。', where: 'store' },
  { id: 'busyDiner', weight: 10, name: '快餐店缺人', text: '阿福快餐今天缺人手，每班多给 15 块。', where: 'diner' },
  { id: 'rain', weight: 10, name: '下雨', text: '下了一整天雨。公园的长椅是湿的，鱼也钓不成。', where: null },
  { id: 'qiangTreat', weight: 6, name: '阿强请客', text: '阿强发了加班费，说要请你吃顿饭。去快餐店门口找他。', where: 'qiang' },
  { id: 'freeClass', weight: 7, name: '夜校公开课', text: '夜校今天是公开课，不收学费。', where: 'school', needs: (s) => !skilled(s) },
  { id: 'rushRepair', weight: 9, name: '有人急着修', text: '楼上的洗衣机淹了一地，今天第一单维修给双倍。', where: 'school', needs: (s) => skilled(s) },
  { id: 'liliTea', weight: 5, name: '莉莉请奶茶', text: '莉莉多点了一杯奶茶，说给你留着。去奶茶店门口找她。', where: 'lili' },
  { id: 'bigFish', weight: 6, name: '老陈钓到大鱼', text: '老陈今天手气好。跟他钓鱼的话，能分到一条带回去吃。', where: 'chen', needs: (s) => s.lessons >= RULES.fishing.lessons },
  { id: 'blackout', weight: 5, name: '楼里停电', text: '幸福公寓今天停电检修，灶台用不了。', where: 'home' },
];

const HOURS = () => ({ work: 0, study: 0, rest: 0, fun: 0, chores: 0, build: 0 });
const INCOME = () => ({ wage: 0, repair: 0, passive: 0, scam: 0 });
const SPEND = () => ({ rent: 0, installments: 0, upkeep: 0, interest: 0, food: 0, fun: 0, study: 0, medical: 0, invest: 0 });
const MONTH = () => ({ hours: HOURS(), income: INCOME(), spend: SPEND(), days: 0 });
const TODAY = () => ({ ...HOURS(), repairs: 0, worked: 0, used: {} });

export function newState(seed = 1) {
  return {
    v: 3,
    seed: seed >>> 0,
    day: 1,
    minutes: 0, // 从早上 7 点算起
    cash: RULES.start.cash,
    debt: 0,
    energy: 100,
    sanity: RULES.start.sanity,
    fullness: RULES.start.fullness,
    iq: 0, // 财商：只决定能看到多少信息
    credit: RULES.start.credit,
    classes: 0,
    groceries: 0,
    home: 'room', // room：出租屋；bunk：破产后搬去的床位
    rent: RULES.rent,
    machines: 0,
    guides: 0, // 写完的维修教程
    guideWork: 0, // 正在写的这一份写了几次
    fund: { units: 0, price: 100 },
    phone: { owned: false, left: 0 },
    ebike: { owned: false, left: 0 },
    scam: null, // { amount, age }
    scamGone: false,
    ledger: false, // 老陈给的旧账本，解锁手机里的两张表
    lessons: 0,
    lessonDay: 0,
    event: 'plain', // 今天的事
    seen: {}, // 做过哪些事，用来给没试过的事一点提示
    today: TODAY(),
    month: MONTH(),
    total: { income: INCOME(), spend: SPEND() },
    streak: 0,
    won: false,
    statements: [],
  };
}

const clamp = (n) => Math.max(0, Math.min(100, n));

export const monthOf = (s) => Math.floor((s.day - 1) / RULES.monthDays) + 1;
export const daysToBill = (s) => RULES.monthDays - ((s.day - 1) % RULES.monthDays);
export const hoursLeft = (s) => RULES.dayHours - s.minutes / 60;
export const hourNow = (s) => RULES.wakeHour + s.minutes / 60;
export const skilled = (s) => s.classes >= RULES.course.classes;
export const loanLimit = (s) => Math.round(s.credit * RULES.loan.perCredit);
export const rentNow = (s) => (s.home === 'room' ? s.rent : RULES.bunkRent);
export const eventToday = (s) => EVENTS.find((e) => e.id === s.event) ?? EVENTS[0];
export const hungry = (s) => s.fullness < RULES.fullness.low;
export const fundValue = (s) => Math.round((s.fund.units * s.fund.price) / 100);

export function clockText(s) {
  const m = Math.min(RULES.dayHours * 60, Math.floor(s.minutes / 10) * 10);
  return `${String(RULES.wakeHour + Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* ---------- 钱和时间的记账 ---------- */

function earn(s, amount, kind) {
  s.cash += amount;
  s.month.income[kind] += amount;
  s.total.income[kind] += amount;
}

function record(s, amount, kind) {
  s.month.spend[kind] += amount;
  s.total.spend[kind] += amount;
}

function pay(s, amount, kind) {
  if (s.cash < amount) return false;
  s.cash -= amount;
  record(s, amount, kind);
  return true;
}

// 时间往前走：肚子也跟着饿。走路时由画面每帧调用，做事时一次走几个钟头。
export function advance(s, minutes) {
  s.minutes += minutes;
  s.fullness = clamp(s.fullness - (minutes / 60) * RULES.fullness.perHour);
}

function spendHours(s, hours, kind) {
  advance(s, hours * 60);
  s.today[kind] += hours;
  s.month.hours[kind] += hours;
}

const tooLate = (s, hours) => (hoursLeft(s) < hours ? '太晚了，今天来不及了。' : null);
export const energyCost = (s, base) => (hungry(s) ? Math.ceil(base * RULES.fullness.tired) : base);
const addSanity = (s, n) => (s.sanity = clamp(Math.round(s.sanity + n)));
const used = (s, what) => {
  if (s.today.used[what]) return true;
  s.today.used[what] = true;
  return false;
};

/* ---------- 每天能做的事 ---------- */
// 带 score 的动作：score 是做这件事时小操作的成绩，0 到 1；不玩直接干完算 0.5。

export function work(s, score = 0.5) {
  const j = RULES.job;
  const cost = energyCost(s, j.energy);
  if (hourNow(s) < j.open) return `店里 ${j.open} 点才开门。`;
  if (hourNow(s) + j.hours > j.close) return '这个点排不上班了，明天再来。';
  if (s.energy < cost) return hungry(s) ? '又累又饿，站不住了。先吃点东西。' : '你累得站不住了，干不动。';
  spendHours(s, j.hours, 'work');
  s.today.worked += j.hours;
  s.energy -= cost;
  addSanity(s, -j.sanity - (score < 0.3 ? j.scolded : 0));
  const tip = score >= 0.99 ? j.bigTip : score >= 0.7 ? j.tip : 0;
  earn(s, j.pay + tip + (s.event === 'busyDiner' ? 15 : 0), 'wage');
  s.seen.work = true;
  return null;
}

export function repairJob(s, score = 0.5) {
  const r = RULES.repair;
  const cost = energyCost(s, r.energy);
  if (!skilled(s)) return '你还不会修。';
  if (s.today.repairs >= r.perDay) return '今天的单子接完了。';
  if (tooLate(s, r.hours)) return tooLate(s, r.hours);
  if (s.energy < cost) return '你累得拿不稳螺丝刀了。';
  spendHours(s, r.hours, 'work');
  s.today.worked += r.hours;
  const rush = s.event === 'rushRepair' && s.today.repairs === 0;
  s.today.repairs += 1;
  s.energy -= cost;
  addSanity(s, -r.sanity);
  const extra = score >= 0.8 ? r.tip : score < 0.3 ? -r.redo : 0;
  earn(s, (rush ? r.pay * 2 : r.pay) + extra, 'repair');
  s.seen.repair = true;
  return null;
}

export function study(s, score = 0.5) {
  const c = RULES.course;
  const cost = energyCost(s, c.energy);
  const fee = s.event === 'freeClass' ? 0 : c.fee;
  if (skilled(s)) return '这门课你已经学完了。';
  if (tooLate(s, c.hours)) return tooLate(s, c.hours);
  if (s.sanity < RULES.lowSanity) return '脑子是木的，一个字也看不进去。先歇一歇。';
  if (s.energy < cost) return '太累了，坐下就会睡着。';
  if (!pay(s, fee, 'study')) return '学费不够。';
  spendHours(s, c.hours, 'study');
  s.energy -= cost;
  addSanity(s, -c.sanity);
  s.classes = Math.min(c.classes, s.classes + 1 + (score >= 0.8 ? c.bonus : 0));
  s.seen.study = true;
  return null;
}

// 学成之后，在家把会的东西写成教程挂到网上：不花钱，只花时间；写完每个月有人付费看。
export function writeGuide(s) {
  const g = RULES.guide;
  const cost = energyCost(s, g.energy);
  if (!skilled(s)) return '你还没有什么能教给别人的。';
  if (s.guides >= g.max) return '你会的都写完了。';
  if (tooLate(s, g.hours)) return tooLate(s, g.hours);
  if (s.sanity < RULES.lowSanity) return '脑子是木的，写不出东西。先歇一歇。';
  if (s.energy < cost) return '太累了，对着屏幕发了会儿呆。';
  spendHours(s, g.hours, 'build');
  s.energy -= cost;
  addSanity(s, -g.sanity);
  s.guideWork += 1;
  s.seen.guide = true;
  if (s.guideWork >= g.sessions) {
    s.guideWork = 0;
    s.guides += 1;
    return { finished: true };
  }
  return null;
}

export const bentoPrice = (s) => (s.event === 'bentoSale' ? 8 : RULES.bento.price);

export function buyBento(s) {
  const b = RULES.bento;
  if (s.fullness >= 95) return '你现在不饿。';
  if (!pay(s, bentoPrice(s), 'food')) return '钱不够。';
  spendHours(s, b.hours, 'chores');
  s.fullness = clamp(s.fullness + b.fullness);
  return null;
}

export function buyGroceries(s, n = 1) {
  if (!pay(s, RULES.grocery.price * n, 'food')) return '钱不够。';
  s.groceries += n;
  return null;
}

export function cook(s) {
  const c = RULES.cook;
  if (s.event === 'blackout' && s.home === 'room') return '停电了，灶台用不了。今天只能在外面吃。';
  if (s.groceries < 1) return '没有食材了。便利店有卖。';
  if (s.fullness >= 95) return '你现在不饿。';
  if (tooLate(s, c.hours)) return tooLate(s, c.hours);
  s.groceries -= 1;
  spendHours(s, c.hours, 'chores');
  s.fullness = clamp(s.fullness + c.fullness);
  addSanity(s, c.sanity);
  s.seen.cook = true;
  return null;
}

export function buyTea(s) {
  const t = RULES.tea;
  if (!pay(s, t.price, 'fun')) return '钱不够。';
  spendHours(s, t.hours, 'fun');
  addSanity(s, t.sanity);
  s.seen.tea = true;
  return null;
}

// 歇着。outdoors 为真表示公园长椅，下雨天坐不了。
export function sitBench(s, outdoors = true) {
  const b = RULES.bench;
  if (outdoors && s.event === 'rain') return '下着雨，长椅是湿的。';
  if (tooLate(s, b.hours)) return tooLate(s, b.hours);
  spendHours(s, b.hours, 'rest');
  addSanity(s, b.sanity);
  s.seen.rest = true;
  return null;
}

export const restHome = (s) => sitBench(s, false);

export function readBook(s) {
  const r = RULES.read;
  if (tooLate(s, r.hours)) return tooLate(s, r.hours);
  spendHours(s, r.hours, 'rest');
  addSanity(s, r.sanity);
  return null;
}

export function shower(s) {
  const w = RULES.shower;
  if (s.today.used.shower) return '今天洗过了。';
  if (tooLate(s, w.hours)) return tooLate(s, w.hours);
  used(s, 'shower');
  spendHours(s, w.hours, 'rest');
  addSanity(s, w.sanity);
  return null;
}

export function fishWithChen(s) {
  const f = RULES.fishing;
  if (s.lessons < f.lessons) return '老陈还没打算把备用的鱼竿借给你。';
  if (s.event === 'rain') return '下着雨，老陈收了竿，在亭子底下看报纸。';
  if (tooLate(s, f.hours)) return tooLate(s, f.hours);
  spendHours(s, f.hours, 'rest');
  addSanity(s, f.sanity);
  if (s.event === 'bigFish' && !used(s, 'bigFish')) {
    addSanity(s, 10);
    s.fullness = clamp(s.fullness + 40);
  }
  return null;
}

// 今天有人请客：阿强请饭、莉莉请奶茶。一天一次。
export function treat(s, who) {
  if (who === 'qiang' && s.event === 'qiangTreat' && !s.today.used.qiang) {
    if (tooLate(s, 1)) return tooLate(s, 1);
    used(s, 'qiang');
    spendHours(s, 1, 'rest');
    s.fullness = clamp(s.fullness + 50);
    addSanity(s, 8);
    return null;
  }
  if (who === 'lili' && s.event === 'liliTea' && !s.today.used.lili) {
    used(s, 'lili');
    spendHours(s, 0.5, 'rest');
    addSanity(s, RULES.tea.sanity);
    return null;
  }
  return '今天没有这回事。';
}

export const canTreat = (s, who) =>
  (who === 'qiang' && s.event === 'qiangTreat' && !s.today.used.qiang) || (who === 'lili' && s.event === 'liliTea' && !s.today.used.lili);

// 和老陈聊天：一天一课，一共六课。第一课拿到旧账本。
export function lesson(s) {
  const l = RULES.lesson;
  s.seen.chen = true;
  if (s.lessons >= l.count) return { done: true };
  if (s.lessonDay === s.day) return { wait: true };
  spendHours(s, l.hours, 'rest');
  s.lessonDay = s.day;
  s.lessons += 1;
  s.iq += 1;
  addSanity(s, l.sanity);
  if (s.lessons === 1) s.ledger = true;
  return { index: s.lessons };
}

export const lessonReady = (s) => s.lessons < RULES.lesson.count && s.lessonDay !== s.day;

/* ---------- 资产与负债 ---------- */

export function buyVending(s) {
  const v = RULES.vending;
  if (s.machines >= v.max) return '这条街上已经没有空位了。';
  if (!pay(s, v.cost, 'invest')) return '钱不够。';
  s.machines += 1;
  s.seen.asset = true;
  return null;
}

export function sellVending(s) {
  if (s.machines < 1) return '你没有售货机。';
  s.machines -= 1;
  s.cash += RULES.vending.resale;
  return null;
}

export function buyFund(s, amount) {
  if (amount < RULES.fund.min) return `最少买 ${RULES.fund.min}。`;
  if (!pay(s, amount, 'invest')) return '钱不够。';
  s.fund.units += (amount * 100) / s.fund.price;
  s.seen.asset = true;
  return null;
}

// 卖出基金，按现在的价钱。amount 省略就是全卖。
export function sellFund(s, amount) {
  const value = fundValue(s);
  if (value <= 0) return '你没有基金。';
  const out = Math.min(amount ?? value, value);
  s.fund.units = out >= value ? 0 : s.fund.units - (out * 100) / s.fund.price;
  s.cash += out;
  return null;
}

export function takePhone(s) {
  if (s.phone.owned) return '你已经有一台了。';
  s.phone = { owned: true, left: RULES.phone.months };
  addSanity(s, RULES.phone.sanityNow);
  return null;
}

export function takeEbike(s) {
  if (s.ebike.owned) return '你已经有一辆了。';
  s.ebike = { owned: true, left: RULES.ebike.months };
  return null;
}

export function borrow(s, amount) {
  if (s.debt + amount > loanLimit(s)) return '额度不够。';
  s.debt += amount;
  s.cash += amount;
  return null;
}

export function repay(s, amount) {
  const paid = Math.min(amount, s.debt, s.cash);
  s.debt -= paid;
  s.cash -= paid;
  return paid;
}

export const scamVisible = (s) => !s.scamGone && monthOf(s) >= RULES.scam.fromMonth && (s.scam || s.cash >= RULES.scam.minCash);

export function investScam(s, amount) {
  if (s.scam) return '你已经投过了。';
  if (!pay(s, amount, 'invest')) return '钱不够。';
  s.scam = { amount, age: 0 };
  return null;
}

export function moveBack(s) {
  if (s.home === 'room') return '你就住在这儿。';
  if (s.cash < RULES.deposit) return `押金要 ${RULES.deposit}，你的钱不够。`;
  s.cash -= RULES.deposit;
  record(s, RULES.deposit, 'rent');
  s.home = 'room';
  return null;
}

/* ---------- 两张表 ---------- */

export const fundDividend = (s) => Math.round(fundValue(s) * RULES.fund.yield);

export const passiveIncome = (s) => s.machines * RULES.vending.income + s.guides * RULES.guide.income + fundDividend(s);

// 每个账单日一定要付的钱（不含伙食）。
export function fixedCosts(s) {
  const installments = (s.phone.left > 0 ? RULES.phone.pay : 0) + (s.ebike.left > 0 ? RULES.ebike.pay : 0);
  const upkeep = s.ebike.owned ? RULES.ebike.upkeep : 0;
  const interest = Math.ceil(s.debt * RULES.loan.rate);
  return { rent: rentNow(s), installments, upkeep, interest, total: rentNow(s) + installments + upkeep + interest };
}

// 资产负债表：不看名字，只看每个账单日钱往哪边流。
export function balanceSheet(s) {
  const assets = [];
  const liabilities = [];
  if (s.machines > 0) {
    assets.push({ name: `自动售货机 ×${s.machines}`, value: s.machines * RULES.vending.resale, flow: s.machines * RULES.vending.income });
  }
  if (s.guides > 0) assets.push({ name: `维修教程 ×${s.guides}`, value: 0, flow: s.guides * RULES.guide.income, made: true });
  if (fundValue(s) > 0) assets.push({ name: '指数基金', value: fundValue(s), flow: fundDividend(s), liquid: true });
  if (s.scam) assets.push({ name: '稳盈宝', value: s.scam.amount, flow: Math.round(s.scam.amount * RULES.scam.rate), doubt: true });
  if (s.phone.left > 0) {
    liabilities.push({ name: '分期手机', value: s.phone.left * RULES.phone.pay, flow: -RULES.phone.pay, left: s.phone.left });
  }
  if (s.ebike.owned) {
    const due = s.ebike.left > 0 ? RULES.ebike.pay : 0;
    liabilities.push({ name: '电动车', value: s.ebike.left * RULES.ebike.pay, flow: -(due + RULES.ebike.upkeep), left: s.ebike.left });
  }
  if (s.debt > 0) liabilities.push({ name: '闪电贷', value: s.debt, flow: -Math.ceil(s.debt * RULES.loan.rate) });
  return { cash: s.cash, assets, liabilities };
}

/* ---------- 一天结束 ---------- */

function pickEvent(s, rand) {
  if (s.day === 1) return 'plain';
  const pool = EVENTS.filter((e) => !e.needs || e.needs(s));
  let roll = rand() * pool.reduce((sum, e) => sum + e.weight, 0);
  return (pool.find((e) => (roll -= e.weight) < 0) ?? pool[0]).id;
}

// 睡觉后调用。rand 可以替换，方便测试。返回早晨要告诉玩家的事。
export function endDay(s, rand = Math.random) {
  const report = { day: s.day + 1, lines: [], sick: false, bill: null, won: false, event: null };
  const line = (text, delta = 0, tone = 'info') => report.lines.push({ text, delta, tone });

  const worked = s.today.worked;
  const exhausted = s.energy < 20;
  const empty = s.fullness < 30;

  // 身体
  const bunk = s.home === 'bunk';
  s.energy = empty ? 65 : bunk ? 80 : 100;
  s.fullness = clamp(s.fullness - RULES.fullness.night);
  let rest = RULES.sanityPerNight + (s.phone.owned ? RULES.phone.nightly : 0);
  if (empty) rest -= 6;
  if (bunk) rest -= 5;
  addSanity(s, rest);
  if (empty) line('昨晚饿着肚子睡的，体力没恢复过来', 0, 'bad');
  if (bunk) line('八个人一间的床位，睡不踏实', 0, 'bad');

  s.day += 1;
  s.minutes = 0;
  s.today = TODAY();
  s.month.days += 1;

  // 生病：越累越容易中招。第一个月不会无缘无故生病。
  const k = RULES.sick;
  const base = monthOf(s) === 1 ? 0 : k.base;
  const chance = worked >= 10 ? k.overwork : worked >= 8 && exhausted ? k.tired : base;
  if (rand() < chance) {
    report.sick = true;
    s.energy = Math.min(s.energy, k.energyCap);
    addSanity(s, -k.sanity);
    const fromCash = Math.min(s.cash, k.fee);
    s.cash -= fromCash;
    record(s, k.fee, 'medical');
    line(worked >= 8 ? '累出病来了，去了趟医院' : '着了凉，去了趟医院', -k.fee, 'bad');
    if (fromCash < k.fee) {
      s.debt += k.fee - fromCash;
      line('手里的钱不够，剩下的只能用闪电贷垫上', k.fee - fromCash, 'debt');
    }
  }

  if ((s.day - 1) % RULES.monthDays === 0) {
    report.bill = bill(s, rand);
    if (report.bill.won) report.won = true;
  }

  s.event = pickEvent(s, rand);
  if (s.event === 'rain') addSanity(s, -3);
  report.event = eventToday(s);
  return report;
}

// 账单日：被动收入进账，房租和各种分期扣款，生成这个月的两张表。
function bill(s, rand) {
  const ended = monthOf(s) - 1;
  const notes = [];

  // 骗局：第一个月按时“分红”，第二个月人去楼空
  let scamLost = 0;
  if (s.scam) {
    if (s.scam.age === 0) {
      s.scam.age = 1;
      earn(s, Math.round(s.scam.amount * RULES.scam.rate), 'scam');
      notes.push({ text: '稳盈宝的“分红”到账了，一分不少', tone: 'good' });
    } else {
      scamLost = s.scam.amount;
      s.scam = null;
      s.scamGone = true;
      notes.push({ text: `稳盈宝的群解散了，那位导师再也联系不上。本金 ${scamLost} 没了`, tone: 'bad' });
    }
  }

  const passive = passiveIncome(s);
  if (passive > 0) earn(s, passive, 'passive');

  const fixed = fixedCosts(s);
  s.debt += fixed.interest;
  record(s, fixed.interest, 'interest');
  record(s, fixed.rent, 'rent');
  record(s, fixed.installments, 'installments');
  record(s, fixed.upkeep, 'upkeep');

  const due = fixed.rent + fixed.installments + fixed.upkeep;
  let borrowed = 0;
  let bankrupt = false;
  if (s.cash >= due) s.cash -= due;
  else {
    const short = due - s.cash;
    s.cash = 0;
    s.debt += short;
    borrowed = short;
    if (s.debt > loanLimit(s)) {
      bankrupt = true;
      s.credit = Math.max(0, s.credit - 25);
      if (s.phone.owned) notes.push({ text: '分期的手机被收走了', tone: 'bad' });
      if (s.ebike.owned) notes.push({ text: '电动车被拖走了', tone: 'bad' });
      s.phone = { owned: false, left: 0 };
      s.ebike = { owned: false, left: 0 };
      if (s.home === 'room') {
        s.home = 'bunk';
        notes.push({ text: '房东换了锁。你拎着一个包，搬进了巷子里的床位房', tone: 'bad' });
      }
    }
  }
  if (!bankrupt) {
    if (s.phone.left > 0) s.phone.left -= 1;
    if (s.ebike.left > 0) s.ebike.left -= 1;
    s.credit = Math.max(0, Math.min(100, s.credit + (borrowed ? -2 : 3)));
  }

  const m = s.month;
  const outflow = due + fixed.interest + m.spend.food;
  const covered = passive >= outflow && s.debt === 0;
  s.streak = covered ? s.streak + 1 : 0;
  const won = !s.won && s.streak >= RULES.winStreak;
  if (won) s.won = true;

  const income = { ...m.income };
  const spend = { ...m.spend };
  const totalIn = income.wage + income.repair + income.passive + income.scam;
  const totalOut = spend.rent + spend.installments + spend.upkeep + spend.interest + spend.food + spend.fun + spend.study + spend.medical;
  const statement = {
    month: ended,
    income,
    spend,
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    invested: spend.invest,
    hours: { ...m.hours },
    days: m.days,
    passive,
    outflow,
    covered,
    streak: s.streak,
    borrowed,
    bankrupt,
    scamLost,
    won,
    notes,
    sheet: balanceSheet(s),
    cash: s.cash,
    debt: s.debt,
  };

  // 基金：分红已经算在上面的被动收入里，这里是价钱的涨跌
  if (s.fund.units > 0) {
    const f = RULES.fund;
    const change = -f.down + rand() * (f.down + f.up);
    s.fund.price = Math.max(20, Math.round(s.fund.price * (1 + change) * 100) / 100);
    const pct = Math.round(change * 100);
    notes.push({ text: `指数基金这个月${pct >= 0 ? '涨' : '跌'}了 ${Math.abs(pct)}%，现在值 ${fundValue(s)}`, tone: pct >= 0 ? 'good' : 'bad' });
  }

  // 涨租通知：这个月开始生效
  if (ended + 1 === RULES.rentHikeMonth && s.rent === RULES.rent) {
    s.rent = Math.round(RULES.rent * (1 + RULES.rentHike));
    statement.notes.push({ text: `房东发来消息：从这个月起房租涨到 ${s.rent}`, tone: 'event' });
  }

  s.statements.push(statement);
  if (s.statements.length > 12) s.statements.shift();
  s.month = MONTH();
  return statement;
}
