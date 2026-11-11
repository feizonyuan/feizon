import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, production, expenses, isWinter, buildCost, legalActions, RULES } from '../src/engine/engine.js';
import { FACILITIES } from '../src/data/facilities.js';
import { STRATEGIES, playOne } from '../scripts/simulate.js';

const with_ = (patch) => ({ ...newGame(1), ...patch });

test('同一种子得到同样的对局', () => {
  const run = (seed) => playOne(STRATEGIES.稳健留存粮, seed);
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
  assert.equal(production(s), 4);
  assert.equal(s.week, 1);
  assert.throws(() => act(s, { type: 'build', facility: 'solar' }), /物资不足/);
});

test('寒冬：农场减半，设施七折', () => {
  assert.equal(isWinter(9), false);
  assert.equal(isWinter(10), true);
  assert.equal(isWinter(13), false);
  const s = with_({ week: 10, facilities: ['farm', 'purifier'] });
  assert.equal(production(s), FACILITIES.farm.produce / 2 + FACILITIES.purifier.produce);
  assert.equal(buildCost(s, 'solar'), Math.floor(FACILITIES.solar.cost * RULES.winterDiscount));
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

test('借粮有上限，每周计息', () => {
  let s = act(newGame(1), { type: 'borrow', amount: 30 });
  assert.equal(s.supplies, 50);
  assert.throws(() => act(s, { type: 'borrow', amount: 31 }), /上限/);
  s = act(s, { type: 'rest' });
  assert.equal(s.history[0].debt, 33);
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

test('断粮即死亡，并给出死因', () => {
  assert.equal(act(with_({ supplies: 0 }), { type: 'rest' }).cause, 'noPassive');
  assert.equal(act(with_({ supplies: 0, facilities: ['farm'] }), { type: 'rest' }).cause, 'noReserve');
  assert.equal(act(with_({ supplies: 0, people: 5, facilities: ['solar'] }), { type: 'rest' }).cause, 'liquidity');
  assert.equal(act(with_({ supplies: 0, debt: 40 }), { type: 'rest' }).cause, 'debt');
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
  assert.deepEqual(legalActions(with_({ pending, supplies: 5 })), [{ type: 'resolve', choice: 'decline' }]);
  const after = act(with_({ pending, supplies: 20 }), { type: 'resolve', choice: 'invest' });
  assert.ok(after.supplies === 0 || after.supplies === RULES.scamPayout);
});

test('只搜刮不建设永远赢不了', () => {
  for (let seed = 1; seed <= 200; seed++) {
    assert.notEqual(playOne(STRATEGIES.只搜刮不建设, seed).status, 'won');
  }
});
