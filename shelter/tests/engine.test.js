import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame,
  act,
  production,
  expenses,
  isWinter,
  weeksToWinter,
  buildCost,
  scavengeRange,
  legalActions,
  RULES,
} from '../src/engine/engine.js';
import { FACILITIES } from '../src/data/facilities.js';
import { STRATEGIES, playOne } from '../scripts/simulate.js';

const with_ = (patch, chapter = 3) => ({ ...newGame(1, chapter), ...patch });
const choiceIds = (s) => legalActions(s).map((a) => a.choice);

test('同一种子得到同样的对局', () => {
  const run = (seed) => playOne(STRATEGIES.稳健留存粮, seed, 3);
  assert.deepEqual(run(7), run(7));
  assert.notDeepEqual(run(7).history, run(8).history);
});

test('act 不修改传入的状态', () => {
  const s = newGame(3);
  const copy = structuredClone(s);
  act(s, { type: 'scavenge', depth: 'deep' });
  assert.deepEqual(s, copy);
});

test('建造是自由动作：扣物资、加产出、不推进周数', () => {
  const s = act(with_({ supplies: 50 }), { type: 'build', facility: 'farm' });
  assert.equal(s.supplies, 50 - FACILITIES.farm.cost);
  assert.equal(production(s), FACILITIES.farm.produce);
  assert.equal(s.week, 1);
  assert.throws(() => act(s, { type: 'build', facility: 'solar' }), /物资不足/);
});

test('寒冬：农场减半，设施七折，搜刮变少', () => {
  assert.equal(isWinter(with_({ week: 9 })), false);
  assert.equal(isWinter(with_({ week: 10 })), true);
  assert.equal(isWinter(with_({ week: 13 })), false);
  assert.equal(weeksToWinter(with_({ week: 7 })), 3);
  assert.equal(weeksToWinter(with_({ week: 11 })), 0);
  const s = with_({ week: 10, facilities: ['farm', 'purifier'] });
  assert.equal(production(s), FACILITIES.farm.produce / 2 + FACILITIES.purifier.produce);
  assert.equal(buildCost(s, 'solar'), Math.floor(FACILITIES.solar.cost * RULES.winterDiscount));
  assert.ok(scavengeRange(with_({ week: 10 }), 'safe')[1] < scavengeRange(with_({ week: 9 }), 'safe')[1]);
});

test('前两章没有寒冬', () => {
  assert.equal(isWinter(with_({ week: 10 }, 1)), false);
  assert.equal(weeksToWinter(with_({ week: 10 }, 2)), null);
});

test('废墟越搜越空，但有下限', () => {
  const early = scavengeRange(with_({ week: 1 }, 1), 'safe');
  const late = scavengeRange(with_({ week: 60 }, 1), 'safe');
  const veryLate = scavengeRange(with_({ week: 5000 }, 1), 'safe');
  assert.ok(late[1] < early[1]);
  assert.ok(veryLate[0] > 0);
});

test('搜刮收获落在给出的范围内', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = newGame(seed, 1);
    const [lo, hi] = scavengeRange(s, 'deep');
    const gain = act(s, { type: 'scavenge', depth: 'deep' }).lastWeek.scavenged;
    assert.ok(gain >= lo && gain <= hi, `${gain} 不在 ${lo}..${hi}`);
  }
});

test('病害期间农场不产出', () => {
  assert.equal(production(with_({ facilities: ['farm', 'farm'], blightWeeks: 1 })), 0);
});

test('交易站按其他设施种类加成', () => {
  assert.equal(production(with_({ facilities: ['tradepost'] })), 3);
  assert.equal(production(with_({ facilities: ['tradepost', 'farm', 'farm', 'wall'] })), 5 + 8);
});

test('装甲车和围墙增加每周消耗', () => {
  assert.equal(expenses(with_({ facilities: ['truck', 'wall'] })), 2 * RULES.eatPerPerson + 3 + 1);
});

test('章节限制可用的设施和借粮', () => {
  assert.throws(() => act(with_({ supplies: 200 }, 1), { type: 'build', facility: 'solar' }), /本章/);
  assert.throws(() => act(with_({}, 1), { type: 'borrow', amount: 10 }), /本章/);
  assert.ok(!legalActions(with_({}, 1)).some((a) => a.type === 'borrow'));
  assert.ok(legalActions(with_({}, 2)).some((a) => a.type === 'borrow'));
});

test('借粮有上限，每周计息', () => {
  let s = act(newGame(1), { type: 'borrow', amount: 30 });
  assert.equal(s.supplies, RULES.startSupplies + 30);
  assert.throws(() => act(s, { type: 'borrow', amount: 31 }), /上限/);
  s = act(s, { type: 'rest' });
  assert.equal(s.history[0].debt, 33);
  assert.equal(s.lastWeek.interest, 3);
});

test('还粮不会超过欠粮和现有物资', () => {
  const s = act(with_({ supplies: 5, debt: 20 }), { type: 'repay', amount: 50 });
  assert.equal(s.supplies, 0);
  assert.equal(s.debt, 15);
});

test('自产不低于消耗且无欠粮时获胜', () => {
  const s = act(with_({ facilities: ['solar', 'purifier'] }), { type: 'rest' });
  assert.equal(s.status, 'won');
});

test('有欠粮时即使自产够吃也不算赢', () => {
  const s = act(with_({ facilities: ['solar', 'purifier'], debt: 10 }), { type: 'rest' });
  assert.equal(s.status, 'playing');
});

test('断粮且无路可走时死亡，并给出死因', () => {
  assert.equal(act(with_({ supplies: 0 }, 1), { type: 'rest' }).cause, 'noPassive');
  assert.equal(act(with_({ supplies: 0, stats: { ...newGame().stats, built: 1 } }, 1), { type: 'rest' }).cause, 'noReserve');
  assert.equal(act(with_({ supplies: 0, debt: 58 }), { type: 'rest' }).cause, 'debt');
  const hurt = with_({ supplies: 0, injuredWeeks: 2, injuredBy: 'deep', stats: { ...newGame().stats, built: 1 } }, 1);
  assert.equal(act(hurt, { type: 'rest' }).cause, 'risk');
});

test('断粮时可以赊粮：记账比拿到的多', () => {
  let s = act(with_({ supplies: 4 }), { type: 'rest' });
  assert.equal(s.pending.id, 'crisis');
  assert.equal(s.week, 1);
  assert.deepEqual(choiceIds(s), ['borrow']);
  s = act(s, { type: 'resolve', choice: 'borrow' });
  assert.equal(s.supplies, 0);
  assert.equal(s.debt, Math.ceil(6 * (1 + RULES.crisisPremium)));
  assert.equal(s.week, 2);
});

test('断粮时拆卖设施只值废铁价，不够就继续断粮', () => {
  let s = act(with_({ supplies: 0, people: 8, facilities: ['farm', 'purifier'] }, 1), { type: 'rest' });
  assert.deepEqual(choiceIds(s).sort(), ['sell:farm', 'sell:purifier']);
  s = act(s, { type: 'resolve', choice: 'sell:farm' });
  assert.equal(s.pending.id, 'crisis');
  s = act(s, { type: 'resolve', choice: 'sell:purifier' });
  assert.equal(s.status, 'dead');
  assert.equal(s.cause, 'liquidity');
  assert.equal(s.stats.fireSaleLoss, (40 - 10) + (60 - 15));
});

test('欠粮超过上限时设施被拆走', () => {
  const s = act(with_({ supplies: 40, debt: 60, facilities: ['farm', 'solar'] }), { type: 'rest' });
  assert.deepEqual(s.facilities, ['farm']);
  assert.equal(s.debt, Math.max(0, 66 - FACILITIES.solar.cost));
});

test('受伤期间不能搜刮', () => {
  const s = with_({ injuredWeeks: 1 });
  assert.throws(() => act(s, { type: 'scavenge', depth: 'safe' }), /受伤/);
  assert.ok(!legalActions(s).some((a) => a.type === 'scavenge'));
});

test('有待处理事件时只能做选择', () => {
  const pending = { id: 'refugee', name: '', text: '', choices: [{ id: 'accept' }, { id: 'decline' }] };
  const s = with_({ pending });
  assert.throws(() => act(s, { type: 'rest' }), /先处理/);
  const after = act(s, { type: 'resolve', choice: 'accept' });
  assert.equal(after.people, 3);
  assert.equal(after.pending, null);
});

test('骗局：物资不足时不能入伙，入伙必先扣本金', () => {
  const pending = { id: 'scam', name: '', text: '', choices: [{ id: 'invest' }, { id: 'decline' }] };
  assert.deepEqual(choiceIds(with_({ pending, supplies: 5 })), ['decline']);
  const after = act(with_({ pending, supplies: 20 }), { type: 'resolve', choice: 'invest' });
  assert.ok(after.supplies === 0 || after.supplies === RULES.scamPayout);
});

test('每一周都记入历史，结束的那一周也在内', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = playOne(STRATEGIES.不留粮且冒险深入, seed, 3);
    const weeks = s.history.map((h) => h.week);
    assert.deepEqual(weeks, weeks.map((_, i) => i + 1));
  }
});

test('只搜刮不建设永远赢不了', () => {
  for (let seed = 1; seed <= 200; seed++) {
    assert.notEqual(playOne(STRATEGIES.只搜刮不建设, seed, 1).status, 'won');
  }
});

test('每一章用稳健打法都能通关', () => {
  for (const chapter of [1, 2, 3]) {
    let won = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (playOne(STRATEGIES.稳健留存粮, seed, chapter).status === 'won') won += 1;
    }
    assert.ok(won >= 120, `第 ${chapter} 章 200 局只赢了 ${won} 局`);
  }
});
