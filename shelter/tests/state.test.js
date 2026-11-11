import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES,
  newState,
  monthOf,
  daysToBill,
  hoursLeft,
  skilled,
  loanLimit,
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
} from '../src/game/state.js';
import { WAYS, live } from '../scripts/simulate.js';

const fresh = (patch = {}) => Object.assign(newState(1), patch);
const never = () => 0.999; // 不生病
const always = () => 0; // 一定生病
const month = (s, rand = never) => {
  let report;
  do report = endDay(s, rand);
  while (!report.bill);
  return report.bill;
};

test('开局：300 块，心力很低，五天后交 400 房租', () => {
  const s = fresh();
  assert.equal(s.cash, 300);
  assert.equal(s.sanity, 40);
  assert.equal(daysToBill(s), 5);
  assert.equal(fixedCosts(s).total, 400);
  assert.equal(hoursLeft(s), 16);
});

test('打工：换来工钱，花掉时间、体力和心力，做多久都是这个价', () => {
  const s = fresh();
  assert.equal(work(s), null);
  assert.equal(s.cash, 360);
  assert.equal(s.minutes, 240);
  assert.equal(s.energy, 70);
  assert.equal(s.sanity, 28);
  assert.equal(s.month.hours.work, 4);
  assert.equal(s.month.income.wage, 60);
  assert.equal(work(fresh({ energy: 20 })), '你累得站不住了，干不动。');
  assert.equal(work(fresh({ minutes: 12 * 60 })), '这个点排不上班了，明天再来。');
});

test('吃饭：便当省时间，自己做饭省钱还回一点心力', () => {
  const a = fresh({ fullness: 0 });
  assert.equal(buyBento(a), null);
  assert.equal(a.cash, 285);
  assert.equal(a.minutes, 30);
  const b = fresh({ fullness: 0 });
  assert.equal(cook(b), '没有食材了。便利店有卖。');
  buyGroceries(b, 4);
  assert.equal(b.cash, 280);
  assert.equal(cook(b), null);
  assert.equal(b.groceries, 3);
  assert.equal(b.minutes, 60);
  assert.equal(b.fullness, 50);
  assert.equal(b.sanity, 44);
  assert.equal(b.month.spend.food, 20);
  assert.equal(buyBento(fresh({ fullness: 100 })), '你现在不饿。');
});

test('回心力：奶茶快但花钱，长椅慢但不要钱', () => {
  const a = fresh();
  buyTea(a);
  assert.equal(a.sanity, 65);
  assert.equal(a.cash, 282);
  assert.equal(a.month.spend.fun, 18);
  const b = fresh();
  sitBench(b);
  assert.equal(b.sanity, 50);
  assert.equal(b.cash, 300);
  assert.equal(b.month.hours.rest, 1);
});

test('夜校：心力太低学不进去；八节课后能接维修单', () => {
  assert.match(study(fresh({ sanity: 20 })), /看不进去/);
  const s = fresh({ cash: 1000, sanity: 100 });
  for (let i = 0; i < 8; i++) {
    assert.equal(study(s), null, `第 ${i + 1} 节`);
    s.minutes = 0;
    s.energy = 100;
    s.sanity = 100;
  }
  assert.ok(skilled(s));
  assert.equal(s.total.spend.study, 240);
  assert.equal(study(s), '这门课你已经学完了。');
  assert.equal(repairJob(fresh()), '你还不会修。');
  assert.equal(repairJob(s), null);
  assert.equal(s.month.income.repair, 80);
  repairJob(s);
  repairJob(s);
  assert.equal(repairJob(s), '今天的单子接完了。');
});

test('老陈：一天一课，第一课给账本，第三课之后能一起钓鱼', () => {
  const s = fresh();
  assert.match(fishWithChen(s), /鱼竿/);
  assert.deepEqual(lesson(s), { index: 1 });
  assert.ok(s.ledger);
  assert.equal(s.iq, 1);
  assert.deepEqual(lesson(s), { wait: true });
  for (let i = 2; i <= 6; i++) {
    endDay(s, never);
    assert.deepEqual(lesson(s), { index: i });
  }
  endDay(s, never);
  assert.deepEqual(lesson(s), { done: true });
  assert.equal(fishWithChen(s), null);
});

test('售货机：买的钱不算花掉，账单日自己进账', () => {
  const s = fresh({ cash: 1300 });
  assert.equal(buyVending(s), null);
  assert.equal(buyVending(s), null);
  assert.equal(buyVending(s), '钱不够。');
  assert.equal(passiveIncome(s), 220);
  const b = month(s);
  assert.equal(b.income.passive, 220);
  assert.equal(b.invested, 1200);
  assert.equal(b.totalOut, 400);
  assert.equal(s.cash, 0, '100 + 220 不够交 400 的房租');
  assert.equal(s.debt, 80);
  assert.deepEqual(balanceSheet(s).assets[0], { name: '自动售货机 ×2', value: 600, flow: 220 });
  assert.equal(sellVending(s), null);
  assert.equal(s.machines, 1);
});

test('分期手机和电动车：到手时有好处，之后每个账单日扣钱', () => {
  const s = fresh({ cash: 2000 });
  takePhone(s);
  takeEbike(s);
  assert.equal(s.sanity, 70);
  assert.equal(s.cash, 2000);
  assert.deepEqual(fixedCosts(s), { rent: 400, installments: 240, upkeep: 20, interest: 0, total: 660 });
  const b = month(s);
  assert.equal(b.spend.installments, 240);
  assert.equal(s.phone.left, 5);
  assert.equal(s.ebike.left, 7);
  const flows = balanceSheet(s).liabilities.map((l) => l.flow);
  assert.deepEqual(flows, [-90, -170]);
  for (let i = 0; i < 8; i++) month(Object.assign(s, { cash: 3000 }));
  assert.equal(fixedCosts(s).installments, 0);
  assert.equal(fixedCosts(s).upkeep, 20, '车贷还完了，充电保养还要一直付');
});

test('账单日钱不够：自动借闪电贷，信用下降', () => {
  const s = fresh({ cash: 250 });
  const b = month(s);
  assert.equal(b.borrowed, 150);
  assert.equal(b.bankrupt, false);
  assert.equal(s.cash, 0);
  assert.equal(s.debt, 150);
  assert.equal(s.credit, 58);
  const next = month(Object.assign(s, { cash: 1000 }));
  assert.equal(next.spend.interest, 15);
  assert.equal(s.debt, 165);
});

test('按时付账信用上涨，额度跟着涨', () => {
  const s = fresh({ cash: 1000 });
  assert.equal(loanLimit(s), 480);
  month(s);
  assert.equal(s.credit, 63);
  assert.equal(loanLimit(s), 504);
  assert.equal(borrow(s, 600), '额度不够。');
  assert.equal(borrow(s, 200), null);
  assert.equal(repay(s, 999), 200);
});

test('借也借不到：搬去床位，分期的东西被收走，但日子继续', () => {
  const s = fresh({ cash: 0, debt: 400 });
  takePhone(s);
  takeEbike(s);
  const b = month(s);
  assert.ok(b.bankrupt);
  assert.equal(s.home, 'bunk');
  assert.equal(s.phone.owned, false);
  assert.equal(s.ebike.owned, false);
  assert.equal(fixedCosts(s).rent, RULES.bunkRent);
  s.fullness = 100;
  endDay(s, never);
  assert.equal(s.energy, 80, '床位睡不好');
  assert.match(moveBack(s), /押金/);
  s.cash = 500;
  assert.equal(moveBack(s), null);
  assert.equal(s.home, 'room');
  assert.equal(s.cash, 200);
});

test('生病：没有闲钱就只能借', () => {
  const rich = fresh({ cash: 1000 });
  const a = endDay(rich, always);
  assert.ok(a.sick);
  assert.equal(rich.cash, 740);
  assert.equal(rich.energy, 50);
  const poor = fresh({ cash: 100 });
  endDay(poor, always);
  assert.equal(poor.cash, 0);
  assert.equal(poor.debt, 160);
  assert.equal(poor.month.spend.medical, 260);
});

test('连着干三班，第二天更容易病', () => {
  const sickAfter = (shifts) => {
    let n = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s = fresh();
      for (let i = 0; i < shifts; i++) work(s);
      let k = seed;
      if (endDay(s, () => ((k = (k * 9301 + 49297) % 233280), k / 233280)).sick) n += 1;
    }
    return n / 400;
  };
  assert.ok(sickAfter(3) > 0.25);
  assert.ok(sickAfter(1) < 0.08);
});

test('饿着睡，体力恢复不过来', () => {
  const s = fresh({ fullness: 10 });
  endDay(s, never);
  assert.equal(s.energy, 65);
  const fed = fresh({ fullness: 80 });
  endDay(fed, never);
  assert.equal(fed.energy, 100);
  assert.equal(fed.fullness, 30);
});

test('第三个月开始涨房租', () => {
  const s = fresh({ cash: 5000 });
  month(s);
  assert.equal(s.rent, 400);
  const b = month(s);
  assert.equal(s.rent, 460);
  assert.ok(b.notes.some((n) => n.text.includes('460')));
  assert.equal(month(s).spend.rent, 460);
});

test('稳盈宝：第一个月准时分红，第二个月本金全没', () => {
  const s = fresh({ cash: 3000 });
  assert.equal(scamVisible(s), false, '第一个月不出现');
  month(s);
  assert.equal(scamVisible(s), true);
  assert.equal(investScam(s, 500), null);
  assert.equal(balanceSheet(s).assets[0].doubt, true);
  const first = month(s);
  assert.equal(first.income.scam, 150);
  const second = month(s);
  assert.equal(second.scamLost, 500);
  assert.equal(s.scam, null);
  assert.equal(scamVisible(s), false);
  assert.equal(s.total.income.scam, 150);
});

test('被动收入连续三个月盖过不得不花的钱，并且不欠债，才算赎回时间', () => {
  const s = fresh({ cash: 2000, machines: 5 });
  assert.equal(month(s).covered, true);
  assert.equal(month(s).won, false);
  const third = month(s);
  assert.equal(third.streak, 3);
  assert.ok(third.won);
  assert.ok(s.won);
  assert.equal(month(s).won, false, '只宣布一次');
  const owing = fresh({ cash: 2000, machines: 5, debt: 50 });
  assert.equal(month(owing).covered, false);
  const eating = fresh({ cash: 2000, machines: 4 });
  for (let i = 0; i < 4; i++) buyBento(Object.assign(eating, { fullness: 0 }));
  assert.equal(month(eating).covered, false, '吃饭的钱也算在里面');
});

test('账单里的时间分配按实际发生的记', () => {
  const s = fresh();
  work(s);
  sitBench(s);
  buyTea(s);
  const b = month(s);
  assert.deepEqual(b.hours, { work: 4, study: 0, rest: 1, fun: 0.5, chores: 0 });
  assert.equal(b.days, 5);
  assert.equal(monthOf(s), 2);
});

test('几种过法的结果符合设计意图', () => {
  const avg = (name, months) => {
    let cash = 0;
    let won = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { rows } = live(WAYS[name], months, seed);
      cash += rows.at(-1).cash - rows.at(-1).debt;
      if (rows.some((r) => r.won)) won += 1;
    }
    return { cash: cash / 60, won: won / 60 };
  };
  const tea = avg('打两班工，吃便当，喝奶茶解压', 6);
  const cookHome = avg('打两班工，自己做饭', 6);
  const skilledWay = avg('做饭 + 下班去夜校，学成后接维修单', 6);
  assert.ok(tea.cash < 450, `喝奶茶的攒不下钱：${tea.cash}`);
  assert.ok(cookHome.cash > tea.cash + 300, '自己做饭能攒下一些');
  assert.ok(skilledWay.cash > cookHome.cash + 800, '学了手艺攒得快得多');
  assert.equal(tea.won, 0);
  assert.ok(avg('做饭 + 夜校 + 攒钱买售货机', 12).won > 0.8);
});
