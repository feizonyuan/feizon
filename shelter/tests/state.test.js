import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES,
  EVENTS,
  newState,
  monthOf,
  daysToBill,
  hoursLeft,
  skilled,
  loanLimit,
  eventToday,
  hungry,
  advance,
  energyCost,
  work,
  repairJob,
  study,
  writeGuide,
  bentoPrice,
  buyBento,
  buyGroceries,
  cook,
  buyTea,
  sitBench,
  restHome,
  readBook,
  shower,
  fishWithChen,
  treat,
  canTreat,
  lesson,
  lessonReady,
  buyVending,
  sellVending,
  buyFund,
  sellFund,
  fundValue,
  fundDividend,
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
const never = () => 0.999; // 不生病；事件抽到最后一个之前的普通日子由权重决定
const always = () => 0; // 一定生病
const month = (s, rand = never) => {
  let report;
  do {
    s.fullness = 100;
    report = endDay(s, rand);
  } while (!report.bill);
  return report.bill;
};
const pro = (patch = {}) => fresh({ classes: RULES.course.classes, sanity: 100, ...patch });

test('开局：300 块，心力 50，五天后交 400 房租', () => {
  const s = fresh();
  assert.equal(s.cash, 300);
  assert.equal(s.sanity, 50);
  assert.equal(daysToBill(s), 5);
  assert.equal(fixedCosts(s).total, 400);
  assert.equal(hoursLeft(s), 16);
  assert.equal(s.event, 'plain');
});

test('打一班工之后心力还在 30 以上，不会第一步就被惩罚', () => {
  const s = fresh();
  assert.equal(work(s), null);
  assert.equal(s.cash, 360);
  assert.equal(s.minutes, 240);
  assert.equal(s.energy, 70);
  assert.equal(s.sanity, 38);
  assert.ok(s.sanity >= RULES.lowSanity);
  assert.equal(s.month.hours.work, 4);
  assert.ok(s.seen.work);
  assert.equal(work(fresh({ energy: 20 })), '你累得站不住了，干不动。');
  assert.equal(work(fresh({ minutes: 12 * 60 })), '这个点排不上班了，明天再来。');
});

test('出餐的成绩影响小费和心力', () => {
  const pay = (score) => {
    const s = fresh();
    work(s, score);
    return [s.cash - 300, s.sanity];
  };
  assert.deepEqual(pay(1), [72, 38]);
  assert.deepEqual(pay(0.8), [66, 38]);
  assert.deepEqual(pay(0.5), [60, 38]);
  assert.deepEqual(pay(0.1), [60, 34]);
});

test('时间走，肚子就饿；饿着干活更费体力', () => {
  const s = fresh({ fullness: 60 });
  advance(s, 120);
  assert.equal(s.fullness, 54);
  const starving = fresh({ fullness: 10 });
  assert.ok(hungry(starving));
  assert.equal(energyCost(starving, 30), 39);
  work(starving);
  assert.equal(starving.energy, 61);
  assert.match(work(fresh({ fullness: 5, energy: 35 })), /又累又饿/);
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
  assert.equal(b.sanity, 54);
  assert.equal(b.month.spend.food, 20);
  assert.equal(buyBento(fresh({ fullness: 100 })), '你现在不饿。');
});

test('回心力的几种办法', () => {
  const after = (fn, patch) => {
    const s = fresh(patch);
    assert.equal(fn(s), null);
    return [s.sanity, s.cash, s.minutes];
  };
  assert.deepEqual(after(buyTea), [75, 282, 30]);
  assert.deepEqual(after(sitBench), [60, 300, 60]);
  assert.deepEqual(after(restHome), [60, 300, 60]);
  assert.deepEqual(after(readBook), [57, 300, 60]);
  assert.deepEqual(after(shower), [56, 300, 30]);
  const s = fresh();
  shower(s);
  assert.equal(shower(s), '今天洗过了。');
});

test('夜校：六节课；听得认真算一节半；心力太低学不进去', () => {
  assert.match(study(fresh({ sanity: 20 })), /看不进去/);
  const s = fresh({ cash: 1000, sanity: 100 });
  let n = 0;
  while (!skilled(s)) {
    assert.equal(study(s), null);
    Object.assign(s, { minutes: 0, energy: 100, sanity: 100 });
    n += 1;
  }
  assert.equal(n, 6);
  assert.equal(s.total.spend.study, 180);
  const keen = fresh({ cash: 1000, sanity: 100 });
  let m = 0;
  while (!skilled(keen)) {
    study(keen, 1);
    Object.assign(keen, { minutes: 0, energy: 100, sanity: 100 });
    m += 1;
  }
  assert.equal(m, 4);
  assert.equal(study(s), '这门课你已经学完了。');
});

test('维修：学完才能接，一天三单，修得好坏影响收入', () => {
  assert.equal(repairJob(fresh()), '你还不会修。');
  const got = (score) => {
    const s = pro();
    repairJob(s, score);
    return s.cash - 300;
  };
  assert.equal(got(0.5), 90);
  assert.equal(got(1), 105);
  assert.equal(got(0.1), 70);
  const s = pro();
  repairJob(s);
  repairJob(s);
  repairJob(s);
  assert.equal(repairJob(s), '今天的单子接完了。');
});

test('写教程：只花时间不花钱，写满五次变成每月进账的资产', () => {
  assert.match(writeGuide(fresh()), /教给别人/);
  const s = pro();
  for (let i = 0; i < 4; i++) {
    assert.equal(writeGuide(s), null);
    Object.assign(s, { minutes: 0, energy: 100, sanity: 100 });
  }
  assert.equal(s.guides, 0);
  assert.deepEqual(writeGuide(s), { finished: true });
  assert.equal(s.guides, 1);
  assert.equal(s.cash, 300);
  assert.equal(passiveIncome(s), 90);
  assert.equal(s.month.hours.build, 10);
  assert.ok(balanceSheet(s).assets[0].made);
  s.guides = 2;
  assert.equal(writeGuide(s), '你会的都写完了。');
});

test('老陈：一天一课，第一课给账本，第三课之后能一起钓鱼', () => {
  const s = fresh();
  assert.ok(lessonReady(s));
  assert.match(fishWithChen(s), /鱼竿/);
  assert.deepEqual(lesson(s), { index: 1 });
  assert.ok(s.ledger && s.seen.chen);
  assert.equal(lessonReady(s), false);
  assert.deepEqual(lesson(s), { wait: true });
  for (let i = 2; i <= 6; i++) {
    endDay(s, never);
    s.event = 'plain';
    assert.deepEqual(lesson(s), { index: i });
  }
  endDay(s, never);
  s.event = 'plain';
  assert.deepEqual(lesson(s), { done: true });
  assert.equal(fishWithChen(s), null);
});

test('售货机：买的钱不算花掉，账单日自己进账', () => {
  const s = fresh({ cash: 1100 });
  assert.equal(buyVending(s), null);
  assert.equal(buyVending(s), null);
  assert.equal(buyVending(s), '钱不够。');
  assert.equal(passiveIncome(s), 240);
  const b = month(s);
  assert.equal(b.income.passive, 240);
  assert.equal(b.invested, 1000);
  assert.equal(b.totalOut, 400);
  assert.equal(s.cash, 0, '100 + 240 不够交 400 的房租');
  assert.equal(s.debt, 60);
  assert.deepEqual(balanceSheet(s).assets[0], { name: '自动售货机 ×2', value: 500, flow: 240 });
  assert.equal(sellVending(s), null);
  assert.equal(s.cash, 250);
});

test('基金：收益低，但随时能按当时的价钱卖掉', () => {
  const s = fresh({ cash: 1500 });
  assert.equal(buyFund(s, 50), '最少买 100。');
  assert.equal(buyFund(s, 1000), null);
  assert.equal(fundValue(s), 1000);
  assert.equal(fundDividend(s), 30);
  assert.equal(passiveIncome(s), 30);
  assert.ok(balanceSheet(s).assets[0].liquid);
  assert.equal(sellFund(s, 400), null);
  assert.equal(s.cash, 900);
  assert.equal(fundValue(s), 600);
  const up = month(s, () => 0.999);
  assert.ok(up.notes.some((n) => n.text.includes('涨')));
  assert.ok(fundValue(s) > 600);
  const before = s.cash;
  sellFund(s);
  assert.equal(fundValue(s), 0);
  assert.ok(s.cash > before + 600);
  const down = fresh({ cash: 2000 });
  buyFund(down, 1000);
  month(down, (() => {
    let n = 0;
    return () => (n++ < 5 ? 0.999 : 0);
  })());
  assert.ok(fundValue(down) <= 1000);
});

test('分期手机和电动车：到手时有好处，之后每个账单日扣钱', () => {
  const s = fresh({ cash: 2000 });
  takePhone(s);
  takeEbike(s);
  assert.equal(s.sanity, 80);
  assert.equal(s.cash, 2000);
  assert.deepEqual(fixedCosts(s), { rent: 400, installments: 240, upkeep: 20, interest: 0, total: 660 });
  const b = month(s);
  assert.equal(b.spend.installments, 240);
  assert.equal(s.phone.left, 5);
  assert.deepEqual(
    balanceSheet(s).liabilities.map((l) => l.flow),
    [-90, -170],
  );
  for (let i = 0; i < 8; i++) month(Object.assign(s, { cash: 3000 }));
  assert.equal(fixedCosts(s).installments, 0);
  assert.equal(fixedCosts(s).upkeep, 20, '车贷还完了，充电保养还要一直付');
});

test('账单日钱不够：自动借闪电贷，信用下降；按时付账额度上涨', () => {
  const s = fresh({ cash: 250 });
  const b = month(s);
  assert.equal(b.borrowed, 150);
  assert.equal(b.bankrupt, false);
  assert.equal(s.debt, 150);
  assert.equal(s.credit, 58);
  assert.equal(month(Object.assign(s, { cash: 1000 })).spend.interest, 15);
  const good = fresh({ cash: 1000 });
  assert.equal(loanLimit(good), 480);
  month(good);
  assert.equal(loanLimit(good), 504);
  assert.equal(borrow(good, 600), '额度不够。');
  assert.equal(borrow(good, 200), null);
  assert.equal(repay(good, 999), 200);
});

test('借也借不到：搬去床位，分期的东西被收走，但日子继续', () => {
  const s = fresh({ cash: 0, debt: 400 });
  takePhone(s);
  takeEbike(s);
  const b = month(s);
  assert.ok(b.bankrupt);
  assert.equal(s.home, 'bunk');
  assert.equal(s.phone.owned, false);
  assert.equal(fixedCosts(s).rent, RULES.bunkRent);
  s.fullness = 100;
  endDay(s, never);
  assert.equal(s.energy, 80, '床位睡不好');
  assert.match(moveBack(s), /押金/);
  s.cash = 500;
  assert.equal(moveBack(s), null);
  assert.equal(s.home, 'room');
});

test('第一个月不会无缘无故生病，但连轴转照样会累病', () => {
  const lucky = fresh({ cash: 1000, fullness: 100 });
  assert.equal(endDay(lucky, () => 0.01).sick, false);
  const tired = fresh({ cash: 1000, fullness: 100 });
  work(tired);
  work(tired);
  work(Object.assign(tired, { energy: 100 }));
  assert.equal(endDay(tired, () => 0.3).sick, true);
  const later = fresh({ cash: 1000, day: 6, fullness: 100 });
  assert.equal(endDay(later, () => 0.01).sick, true);
});

test('生病：没有闲钱就只能借', () => {
  const rich = fresh({ cash: 1000, day: 6, fullness: 100 });
  endDay(rich, always);
  assert.equal(rich.cash, 740);
  assert.equal(rich.energy, 50);
  const poor = fresh({ cash: 100, day: 6, fullness: 100 });
  endDay(poor, always);
  assert.equal(poor.cash, 0);
  assert.equal(poor.debt, 160);
});

test('饿着睡，体力恢复不过来', () => {
  const s = fresh({ fullness: 10 });
  endDay(s, never);
  assert.equal(s.energy, 65);
  const fed = fresh({ fullness: 80 });
  endDay(fed, never);
  assert.equal(fed.energy, 100);
  assert.equal(fed.fullness, 72);
});

test('第三个月开始涨房租', () => {
  const s = fresh({ cash: 5000 });
  month(s);
  assert.equal(s.rent, 400);
  const b = month(s);
  assert.equal(s.rent, 460);
  assert.ok(b.notes.some((n) => n.text.includes('460')));
});

test('稳盈宝：第一个月准时分红，第二个月本金全没', () => {
  const s = fresh({ cash: 3000 });
  assert.equal(scamVisible(s), false);
  month(s);
  assert.equal(scamVisible(s), true);
  assert.equal(investScam(s, 500), null);
  assert.equal(month(s).income.scam, 150);
  assert.equal(month(s).scamLost, 500);
  assert.equal(scamVisible(s), false);
});

test('被动收入连续三个月盖过不得不花的钱，并且不欠债，才算赎回时间', () => {
  const s = fresh({ cash: 2000, machines: 4 });
  assert.equal(month(s).covered, true);
  assert.equal(month(s).won, false);
  const third = month(s);
  assert.equal(third.streak, 3);
  assert.ok(third.won && s.won);
  assert.equal(month(s).won, false, '只宣布一次');
  assert.equal(month(fresh({ cash: 2000, machines: 4, debt: 50 })).covered, false);
  const mixed = fresh({ cash: 2000, machines: 2, guides: 2 });
  assert.equal(passiveIncome(mixed), 420);
  assert.equal(month(mixed).covered, true, '售货机加教程一起也算');
});

test('每天的事：从第二天起才会有，条件不满足的抽不到', () => {
  const s = fresh();
  assert.equal(eventToday(s).id, 'plain');
  const ids = new Set();
  for (let i = 0; i < 400; i++) {
    const t = fresh({ fullness: 100 });
    let k = i * 7919;
    endDay(t, () => ((k = (k * 9301 + 49297) % 233280), k / 233280));
    ids.add(t.event);
  }
  assert.ok(ids.has('bentoSale') && ids.has('rain') && ids.has('freeClass'));
  assert.ok(!ids.has('rushRepair'), '没学完时不会有人找你急修');
  assert.ok(!ids.has('bigFish'), '老陈没借竿子时轮不到你钓大鱼');
  assert.equal(new Set(EVENTS.map((e) => e.id)).size, EVENTS.length);
});

test('每天的事各自的效果', () => {
  assert.equal(bentoPrice(fresh({ event: 'bentoSale' })), 8);
  const busy = fresh({ event: 'busyDiner' });
  work(busy);
  assert.equal(busy.cash, 375);
  assert.match(sitBench(fresh({ event: 'rain' })), /湿的/);
  assert.equal(restHome(fresh({ event: 'rain' })), null);
  assert.match(fishWithChen(fresh({ event: 'rain', lessons: 6 })), /下着雨/);
  const free = fresh({ event: 'freeClass', sanity: 100 });
  study(free);
  assert.equal(free.cash, 300);
  const rush = pro({ event: 'rushRepair' });
  repairJob(rush);
  repairJob(rush);
  assert.equal(rush.cash, 300 + 180 + 90, '只有第一单双倍');
  assert.match(cook(fresh({ event: 'blackout', groceries: 2, fullness: 0 })), /停电/);
  const fish = fresh({ event: 'bigFish', lessons: 6, fullness: 20 });
  fishWithChen(fish);
  assert.equal(fish.sanity, 82);
  assert.ok(fish.fullness > 50);
});

test('请客：阿强请饭、莉莉请奶茶，一天一次', () => {
  const q = fresh({ event: 'qiangTreat', fullness: 20 });
  assert.ok(canTreat(q, 'qiang'));
  assert.equal(treat(q, 'qiang'), null);
  assert.equal(q.cash, 300);
  assert.equal(q.sanity, 58);
  assert.ok(q.fullness > 60);
  assert.equal(canTreat(q, 'qiang'), false);
  assert.equal(treat(q, 'qiang'), '今天没有这回事。');
  const l = fresh({ event: 'liliTea' });
  treat(l, 'lili');
  assert.equal(l.sanity, 75);
  assert.equal(treat(fresh(), 'lili'), '今天没有这回事。');
});

test('账单里的时间分配按实际发生的记', () => {
  const s = fresh();
  work(s);
  sitBench(s);
  buyTea(s);
  const b = month(s);
  assert.deepEqual(b.hours, { work: 4, study: 0, rest: 1, fun: 0.5, chores: 0, build: 0 });
  assert.equal(monthOf(s), 2);
});

test('几种过法的结果符合设计意图', () => {
  const avg = (name, months) => {
    let worth = 0;
    let won = 0;
    let wonAt = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { rows } = live(WAYS[name], months, seed);
      const last = rows.at(-1);
      worth += last.cash - last.debt + last.sheet.assets.reduce((sum, a) => sum + (a.doubt ? 0 : a.value), 0);
      const w = rows.findIndex((r) => r.won);
      if (w >= 0) {
        won += 1;
        wonAt += w + 1;
      }
    }
    return { worth: worth / 60, won: won / 60, wonAt: won ? wonAt / won : 0 };
  };
  const tea = avg('打两班工，吃便当，喝奶茶解压', 6);
  const cookHome = avg('打两班工，自己做饭', 6);
  const skilledWay = avg('做饭 + 夜校，学成后接维修单', 6);
  assert.ok(tea.worth < 700, `喝奶茶的攒不下多少：${tea.worth}`);
  assert.ok(cookHome.worth > tea.worth + 300, '自己做饭能多攒下一些');
  assert.ok(skilledWay.worth > cookHome.worth + 2000, '学了手艺攒得快得多');
  assert.equal(tea.won, 0);
  const full = avg('再加上写教程', 8);
  assert.ok(full.won > 0.9);
  assert.ok(full.wonAt >= 4 && full.wonAt <= 6.5, `大约第五个月赎回时间：${full.wonAt}`);
  assert.equal(avg('不买售货机，余钱全买基金', 8).won, 0, '只靠基金的分红不够');
});
