// 《躺平计划》的规则：时间、体力、心力、打工、学习、吃饭、资产、负债、账单日。
// 这里只有数据和计算，不碰画面，可以直接用 node 测试和模拟。

export const RULES = {
  wakeHour: 7,
  dayHours: 16, // 7:00 到 23:00，其余 8 小时睡觉
  daySeconds: 190, // 醒着的一天对应的真实秒数
  monthDays: 5, // 一个账单周期
  start: { cash: 300, sanity: 40, fullness: 60, credit: 60 },
  rent: 400,
  rentHike: 0.15,
  rentHikeMonth: 3, // 第 3 个月开始时通知涨租
  bunkRent: 200,
  deposit: 300,
  job: { hours: 4, pay: 60, energy: 30, sanity: 12, open: 7, close: 22 },
  repair: { hours: 2, pay: 80, energy: 22, sanity: 5, perDay: 3 },
  course: { classes: 8, hours: 2, fee: 30, energy: 10, sanity: 6 },
  bento: { price: 15, fullness: 50, hours: 0.5 },
  grocery: { price: 5 },
  cook: { hours: 1, fullness: 50, sanity: 4 },
  tea: { price: 18, sanity: 25, hours: 0.5 },
  bench: { hours: 1, sanity: 10 },
  fishing: { hours: 2, sanity: 22, lessons: 3 },
  lesson: { hours: 0.5, sanity: 5, count: 6 },
  fullnessPerDay: 50,
  sanityPerNight: 8,
  vending: { cost: 600, income: 110, resale: 300, max: 6 },
  phone: { months: 6, pay: 90, sanityNow: 30, nightly: 3 },
  ebike: { months: 8, pay: 150, upkeep: 20, speed: 1.45 },
  loan: { rate: 0.1, perCredit: 8 },
  sick: { fee: 260, energyCap: 50, sanity: 8, base: 0.02, tired: 0.15, overwork: 0.35 },
  scam: { rate: 0.3, minCash: 400, fromMonth: 2, iq: 4, stakes: [300, 500] },
  lowSanity: 30,
  winStreak: 3,
};

const HOURS = () => ({ work: 0, study: 0, rest: 0, fun: 0, chores: 0 });
const INCOME = () => ({ wage: 0, repair: 0, passive: 0, scam: 0 });
const SPEND = () => ({ rent: 0, installments: 0, upkeep: 0, interest: 0, food: 0, fun: 0, study: 0, medical: 0, invest: 0 });
const MONTH = () => ({ hours: HOURS(), income: INCOME(), spend: SPEND(), days: 0 });

export function newState(seed = 1) {
  return {
    v: 2,
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
    phone: { owned: false, left: 0 },
    ebike: { owned: false, left: 0 },
    scam: null, // { amount, age }
    scamGone: false,
    ledger: false, // 老陈给的旧账本，解锁手机里的两张表
    lessons: 0,
    lessonDay: 0,
    today: { ...HOURS(), repairs: 0, worked: 0 },
    month: MONTH(),
    total: { income: INCOME(), spend: SPEND() },
    streak: 0,
    won: false,
    statements: [],
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

export const monthOf = (s) => Math.floor((s.day - 1) / RULES.monthDays) + 1;
export const daysToBill = (s) => RULES.monthDays - ((s.day - 1) % RULES.monthDays);
export const hoursLeft = (s) => RULES.dayHours - s.minutes / 60;
export const hourNow = (s) => RULES.wakeHour + s.minutes / 60;
export const skilled = (s) => s.classes >= RULES.course.classes;
export const loanLimit = (s) => Math.round(s.credit * RULES.loan.perCredit);
export const rentNow = (s) => (s.home === 'room' ? s.rent : RULES.bunkRent);

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

function spendHours(s, hours, kind) {
  s.minutes += hours * 60;
  s.today[kind] += hours;
  s.month.hours[kind] += hours;
}

const tooLate = (s, hours) => (hoursLeft(s) < hours ? '太晚了，今天来不及了。' : null);

/* ---------- 每天能做的事 ---------- */

export function work(s) {
  const j = RULES.job;
  if (hourNow(s) < j.open) return `店里 ${j.open} 点才开门。`;
  if (hourNow(s) + j.hours > j.close) return '这个点排不上班了，明天再来。';
  if (s.energy < j.energy) return '你累得站不住了，干不动。';
  spendHours(s, j.hours, 'work');
  s.today.worked += j.hours;
  s.energy -= j.energy;
  s.sanity = clamp(s.sanity - j.sanity);
  earn(s, j.pay, 'wage');
  return null;
}

export function repairJob(s) {
  const r = RULES.repair;
  if (!skilled(s)) return '你还不会修。';
  if (s.today.repairs >= r.perDay) return '今天的单子接完了。';
  if (tooLate(s, r.hours)) return tooLate(s, r.hours);
  if (s.energy < r.energy) return '你累得拿不稳螺丝刀了。';
  spendHours(s, r.hours, 'work');
  s.today.worked += r.hours;
  s.today.repairs += 1;
  s.energy -= r.energy;
  s.sanity = clamp(s.sanity - r.sanity);
  earn(s, r.pay, 'repair');
  return null;
}

export function study(s) {
  const c = RULES.course;
  if (skilled(s)) return '这门课你已经学完了。';
  if (tooLate(s, c.hours)) return tooLate(s, c.hours);
  if (s.sanity < RULES.lowSanity) return '脑子是木的，一个字也看不进去。先歇一歇。';
  if (s.energy < c.energy) return '太累了，坐下就会睡着。';
  if (!pay(s, c.fee, 'study')) return '学费不够。';
  spendHours(s, c.hours, 'study');
  s.energy -= c.energy;
  s.sanity = clamp(s.sanity - c.sanity);
  s.classes += 1;
  return null;
}

export function buyBento(s) {
  const b = RULES.bento;
  if (s.fullness >= 100) return '你现在不饿。';
  if (!pay(s, b.price, 'food')) return '钱不够。';
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
  if (s.groceries < 1) return '没有食材了。便利店有卖。';
  if (s.fullness >= 100) return '你现在不饿。';
  if (tooLate(s, c.hours)) return tooLate(s, c.hours);
  s.groceries -= 1;
  spendHours(s, c.hours, 'chores');
  s.fullness = clamp(s.fullness + c.fullness);
  s.sanity = clamp(s.sanity + c.sanity);
  return null;
}

export function buyTea(s) {
  const t = RULES.tea;
  if (!pay(s, t.price, 'fun')) return '钱不够。';
  spendHours(s, t.hours, 'fun');
  s.sanity = clamp(s.sanity + t.sanity);
  return null;
}

export function sitBench(s) {
  const b = RULES.bench;
  if (tooLate(s, b.hours)) return tooLate(s, b.hours);
  spendHours(s, b.hours, 'rest');
  s.sanity = clamp(s.sanity + b.sanity);
  return null;
}

export function fishWithChen(s) {
  const f = RULES.fishing;
  if (s.lessons < f.lessons) return '老陈还没打算把备用的鱼竿借给你。';
  if (tooLate(s, f.hours)) return tooLate(s, f.hours);
  spendHours(s, f.hours, 'rest');
  s.sanity = clamp(s.sanity + f.sanity);
  return null;
}

// 和老陈聊天：一天一课，一共六课。第一课拿到旧账本。
export function lesson(s) {
  const l = RULES.lesson;
  if (s.lessons >= l.count) return { done: true };
  if (s.lessonDay === s.day) return { wait: true };
  spendHours(s, l.hours, 'rest');
  s.lessonDay = s.day;
  s.lessons += 1;
  s.iq += 1;
  s.sanity = clamp(s.sanity + l.sanity);
  if (s.lessons === 1) s.ledger = true;
  return { index: s.lessons };
}

/* ---------- 资产与负债 ---------- */

export function buyVending(s) {
  const v = RULES.vending;
  if (s.machines >= v.max) return '这条街上已经没有空位了。';
  if (!pay(s, v.cost, 'invest')) return '钱不够。';
  s.machines += 1;
  return null;
}

export function sellVending(s) {
  if (s.machines < 1) return '你没有售货机。';
  s.machines -= 1;
  s.cash += RULES.vending.resale;
  return null;
}

export function takePhone(s) {
  if (s.phone.owned) return '你已经有一台了。';
  s.phone = { owned: true, left: RULES.phone.months };
  s.sanity = clamp(s.sanity + RULES.phone.sanityNow);
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

export const passiveIncome = (s) => s.machines * RULES.vending.income;

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
    assets.push({ name: `自动售货机 ×${s.machines}`, value: s.machines * RULES.vending.resale, flow: passiveIncome(s) });
  }
  if (s.scam) assets.push({ name: '稳盈宝', value: s.scam.amount, flow: Math.round(s.scam.amount * RULES.scam.rate), doubt: true });
  if (s.phone.left > 0) {
    liabilities.push({ name: '分期手机', value: s.phone.left * RULES.phone.pay, flow: -RULES.phone.pay, left: s.phone.left });
  }
  if (s.ebike.owned) {
    const pay = s.ebike.left > 0 ? RULES.ebike.pay : 0;
    liabilities.push({ name: '电动车', value: s.ebike.left * RULES.ebike.pay, flow: -(pay + RULES.ebike.upkeep), left: s.ebike.left });
  }
  if (s.debt > 0) liabilities.push({ name: '闪电贷', value: s.debt, flow: -Math.ceil(s.debt * RULES.loan.rate) });
  return { cash: s.cash, assets, liabilities };
}

/* ---------- 一天结束 ---------- */

// 睡觉后调用。rand 可以替换，方便测试。返回早晨要告诉玩家的事。
export function endDay(s, rand = Math.random) {
  const report = { day: s.day + 1, lines: [], sick: false, bill: null, won: false };
  const line = (text, delta = 0, tone = 'info') => report.lines.push({ text, delta, tone });

  const worked = s.today.worked;
  const exhausted = s.energy < 20;
  const hungry = s.fullness < 30;

  // 身体
  const bunk = s.home === 'bunk';
  s.energy = hungry ? 65 : bunk ? 80 : 100;
  s.fullness = clamp(s.fullness - RULES.fullnessPerDay);
  let rest = RULES.sanityPerNight + (s.phone.owned ? RULES.phone.nightly : 0);
  if (hungry) rest -= 6;
  if (bunk) rest -= 5;
  s.sanity = clamp(s.sanity + rest);
  if (hungry) line('昨晚饿着肚子睡的，体力没恢复过来', 0, 'bad');
  if (bunk) line('八个人一间的床位，睡不踏实', 0, 'bad');

  s.day += 1;
  s.minutes = 0;
  s.today = { ...HOURS(), repairs: 0, worked: 0 };
  s.month.days += 1;

  // 生病：越累越容易中招
  const k = RULES.sick;
  const chance = worked >= 10 ? k.overwork : worked >= 8 && exhausted ? k.tired : k.base;
  if (rand() < chance) {
    report.sick = true;
    s.energy = Math.min(s.energy, k.energyCap);
    s.sanity = clamp(s.sanity - k.sanity);
    const fromCash = Math.min(s.cash, k.fee);
    s.cash -= fromCash;
    record(s, k.fee, 'medical');
    line('累出病来了，去了趟医院', -k.fee, 'bad');
    if (fromCash < k.fee) {
      s.debt += k.fee - fromCash;
      line('手里的钱不够，剩下的只能用闪电贷垫上', k.fee - fromCash, 'debt');
    }
  }

  if ((s.day - 1) % RULES.monthDays === 0) {
    report.bill = bill(s);
    if (report.bill.won) report.won = true;
  }
  return report;
}

// 账单日：被动收入进账，房租和各种分期扣款，生成这个月的两张表。
function bill(s) {
  const ended = monthOf(s) - 1;
  const notes = [];

  // 骗局：第一个月按时“分红”，第二个月人去楼空
  let scamPayout = 0;
  let scamLost = 0;
  if (s.scam) {
    if (s.scam.age === 0) {
      scamPayout = Math.round(s.scam.amount * RULES.scam.rate);
      s.scam.age = 1;
      earn(s, scamPayout, 'scam');
      notes.push({ text: `稳盈宝的“分红”到账了，一分不少`, tone: 'good' });
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
