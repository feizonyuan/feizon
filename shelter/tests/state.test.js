import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES,
  ITEMS,
  ASSETS,
  newState,
  price,
  rentNow,
  passiveIncome,
  livingCost,
  daysToRent,
  addItem,
  takeItem,
  count,
  useEnergy,
  eat,
  buy,
  sell,
  buyAsset,
  buyLuxury,
  borrow,
  repay,
  doJob,
  cropStage,
  till,
  water,
  plant,
  harvest,
  endDay,
  review,
} from '../src/game/state.js';

const fresh = (patch = {}) => Object.assign(newState(1), patch);
const days = (s, n) => {
  let last;
  for (let i = 0; i < n; i++) last = endDay(s);
  return last;
};

test('开局带着工具、种子和罐头', () => {
  const s = fresh();
  assert.deepEqual(
    s.inv.filter(Boolean).map((x) => x.id),
    ['hoe', 'can', 'rod', 'seedCabbage', 'tin'],
  );
  assert.equal(s.money, RULES.startMoney);
});

test('背包：同类叠在一起，满了放不进，工具拿不走', () => {
  const s = fresh();
  assert.ok(addItem(s, 'tin', 3));
  assert.equal(count(s, 'tin'), 5);
  for (const id of ['scrap', 'battery', 'berry', 'mushroom', 'fish']) assert.ok(addItem(s, id));
  assert.equal(addItem(s, 'potato'), false);
  assert.equal(takeItem(s, 0), false);
  assert.ok(takeItem(s, 4, 5));
  assert.equal(s.inv[4], null);
});

test('种地：翻地、播种、浇了水才长、成熟后收获', () => {
  const s = fresh();
  assert.equal(till(s, '1,1'), null);
  assert.equal(till(s, '1,1'), '这里已经翻过了');
  assert.equal(plant(s, '1,1', 3), null);
  assert.equal(count(s, 'seedCabbage'), 3);
  endDay(s); // 没浇水
  assert.equal(s.soil['1,1'].age, 0);
  for (let i = 0; i < 2; i++) {
    assert.equal(water(s, '1,1'), null);
    assert.equal(water(s, '1,1'), '已经浇过了');
    endDay(s);
  }
  assert.equal(cropStage(s.soil['1,1']), 3);
  assert.deepEqual(harvest(s, '1,1'), { id: 'cabbage' });
  assert.equal(s.soil['1,1'].crop, null);
  assert.equal(harvest(s, '1,1'), null);
});

test('番茄收过之后还会再结', () => {
  const s = fresh();
  addItem(s, 'seedTomato');
  till(s, '2,2');
  plant(s, '2,2', s.inv.findIndex((x) => x?.id === 'seedTomato'));
  for (let i = 0; i < 4; i++) {
    water(s, '2,2');
    endDay(s);
  }
  assert.deepEqual(harvest(s, '2,2'), { id: 'tomato' });
  assert.equal(s.soil['2,2'].crop, 'tomato');
  assert.equal(cropStage(s.soil['2,2']), 1);
  for (let i = 0; i < 2; i++) {
    water(s, '2,2');
    endDay(s);
  }
  assert.equal(cropStage(s.soil['2,2']), 3);
});

test('体力不够时干不了活；心情差时更费体力', () => {
  const s = fresh({ energy: 2 });
  assert.equal(till(s, '1,1'), '没力气了');
  const low = fresh({ mood: 10 });
  useEnergy(low, 10);
  assert.equal(low.energy, 85);
});

test('吃东西回饱食和体力；吃饱了不浪费', () => {
  const s = fresh({ food: 20, energy: 50 });
  assert.equal(eat(s, 4).item, ITEMS.tin);
  assert.equal(s.food, 60);
  assert.ok(s.energy > 50);
  assert.equal(count(s, 'tin'), 1);
  s.food = 100;
  assert.deepEqual(eat(s, 4), { full: true });
  assert.equal(count(s, 'tin'), 1);
  assert.equal(eat(s, 0), null);
});

test('买卖按物价指数计价，并记进账本', () => {
  const s = fresh({ money: 100 });
  assert.equal(buy(s, 'seedPotato'), null);
  assert.equal(s.money, 91);
  assert.equal(s.period.biz, 9);
  addItem(s, 'fish', 3);
  const slot = s.inv.findIndex((x) => x?.id === 'fish');
  assert.equal(sell(s, slot), 16);
  assert.equal(sell(s, slot, true), 32);
  assert.equal(s.period.sales, 48);
  assert.equal(buy(fresh({ money: 1 }), 'tin'), '钱不够');
  s.index = 1.5;
  assert.equal(price(s, 10), 15);
});

test('搬砖：一天一次，花体力和时间，挣工资', () => {
  const s = fresh();
  assert.equal(doJob(s), null);
  assert.equal(s.money, RULES.startMoney + RULES.job.pay);
  assert.equal(s.minutes, RULES.job.hours * 60);
  assert.equal(s.period.wage, RULES.job.pay);
  assert.equal(doJob(s), '今天的活已经干完了');
  endDay(s);
  assert.equal(doJob(fresh({ minutes: 15 * 60 })), '太晚了，明天再来');
  assert.equal(doJob(fresh({ energy: 10 })), '你累得搬不动了');
});

test('设备每天早上自动进账', () => {
  const s = fresh({ money: 500 });
  assert.equal(buyAsset(s, 'rain', 4), null);
  assert.equal(buyAsset(s, 'coop', 4), null);
  assert.equal(passiveIncome(s), 24);
  const before = s.money;
  const report = endDay(s);
  assert.equal(s.money, before + 24);
  assert.equal(s.period.passive, 24);
  assert.ok(report.lines.some((l) => l.delta === 24));
  assert.equal(buyAsset(s, 'vending', 4), '钱不够');
  assert.equal(buyAsset(fresh({ money: 999, assets: ['rain'] }), 'rain', 1), '院子里没有空位了');
});

test('游戏机和电动车买了之后每天都要花钱', () => {
  const s = fresh({ money: 400 });
  const base = livingCost(s);
  assert.equal(buyLuxury(s, 'console'), null);
  assert.equal(buyLuxury(s, 'console'), '已经有了');
  assert.equal(livingCost(s), base + 3);
  const before = s.money;
  endDay(s);
  assert.equal(s.money, before - 3);
});

test('每五天交一次租，之后物价上涨', () => {
  const s = fresh({ money: 200 });
  assert.equal(daysToRent(s), 5);
  const report = days(s, 5);
  assert.equal(s.day, 6);
  assert.equal(s.money, 140);
  assert.ok(report.review);
  assert.equal(s.index, 1.04);
  assert.equal(rentNow(s), 62);
  assert.equal(daysToRent(s), 5);
  assert.equal(s.period.rent, 0, '新周期的账本从零开始');
  assert.equal(s.total.rent, 60);
});

test('交不起租：差的部分加两成变成欠款', () => {
  const s = fresh({ money: 10 });
  days(s, 5);
  assert.equal(s.money, 0);
  assert.equal(s.debt, Math.ceil(50 * 1.2));
});

test('欠款每天利滚利，有借款上限', () => {
  const s = fresh();
  assert.equal(borrow(s, 100), null);
  assert.equal(s.money, RULES.startMoney + 100);
  endDay(s);
  assert.equal(s.debt, 105);
  endDay(s);
  assert.equal(s.debt, 111);
  assert.equal(borrow(s, 250), '他不肯再借了');
  assert.equal(repay(s, 500), 111);
  assert.equal(s.debt, 0);
  assert.equal(s.money, RULES.startMoney + 100 - 111);
});

test('欠得太多，最值钱的设备被搬走', () => {
  const s = fresh({ debt: 460, assets: ['rain', 'solar'] });
  const report = endDay(s);
  assert.equal(report.seized, 'solar');
  assert.deepEqual(s.assets, ['rain']);
  assert.equal(s.debt, Math.ceil(460 * 1.05) - ASSETS.solar.cost);
});

test('饿着睡或熬夜倒下，第二天体力不满', () => {
  const fed = fresh({ food: 80 });
  endDay(fed);
  assert.equal(fed.energy, 100);
  assert.equal(fed.food, 80 - RULES.foodPerDay);
  const hungry = fresh({ food: 10 });
  endDay(hungry);
  assert.equal(hungry.energy, 60);
  const out = fresh({ food: 80 });
  endDay(out, true);
  assert.equal(out.energy, 50);
});

test('被动收入盖过每天的开销且不欠债，就是财富自由', () => {
  const s = fresh({ money: 50, assets: ['solar'] });
  assert.ok(passiveIncome(s) >= livingCost(s));
  assert.equal(endDay(s).freed, true);
  assert.equal(s.free, true);
  assert.equal(endDay(s).freed, false, '只庆祝一次');
  const owing = fresh({ assets: ['solar'], debt: 50 });
  assert.equal(endDay(owing).freed, false);
});

test('生活评语', () => {
  const verdict = (patch, period = {}) => {
    const s = fresh(patch);
    Object.assign(s.period, { days: 5, moodSum: 5 * (patch.mood ?? 60) }, period);
    return review(s).key;
  };
  assert.equal(verdict({ assets: ['solar'] }), 'free');
  assert.equal(verdict({ debt: 200 }), 'debt');
  assert.equal(verdict({ assets: ['rain'], money: 300 }, { passive: 40, wage: 50 }), 'landlord');
  assert.equal(verdict({ money: 10 }, { wage: 200, fun: 90 }), 'spender');
  assert.equal(verdict({ money: 100, mood: 80 }, { sales: 40 }), 'flat');
  assert.equal(verdict({ money: 300, mood: 20 }, { wage: 170, sales: 100 }), 'grinder');
  assert.equal(verdict({ money: 300, mood: 50 }, { wage: 170, sales: 100 }), 'worker');
});
