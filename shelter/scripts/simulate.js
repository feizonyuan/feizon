// 用几种固定策略各跑多局，查看胜率和局长，用来调数值。
// 用法：node scripts/simulate.js [局数]
import { newGame, act, buildCost, RULES } from '../src/engine/engine.js';

const MAX_WEEKS = 80;
const PRODUCERS = ['solar', 'purifier', 'farm', 'tradepost'];

function buildWhileAbove(state, reserve) {
  for (;;) {
    const id = PRODUCERS.find((p) => state.supplies - buildCost(state, p) >= reserve);
    if (!id) return state;
    state = act(state, { type: 'build', facility: id });
  }
}

// reserve: 建设时保留的存粮（null 表示从不建设）；depth: 搜刮方式；borrow: 开局是否借满。
export const STRATEGIES = {
  只搜刮不建设: { reserve: null, depth: 'safe' },
  稳健留存粮: { reserve: 20, depth: 'safe' },
  全部投入不留粮: { reserve: 0, depth: 'safe' },
  不留粮且冒险深入: { reserve: 0, depth: 'deep' },
  开局借满: { reserve: 20, depth: 'safe', borrow: true },
};

export function playOne(strategy, seed) {
  let s = newGame(seed);
  if (strategy.borrow) s = act(s, { type: 'borrow', amount: RULES.debtCap });
  while (s.status === 'playing' && s.week <= MAX_WEEKS) {
    if (s.pending) {
      s = act(s, { type: 'resolve', choice: 'decline' });
      continue;
    }
    if (strategy.reserve !== null) s = buildWhileAbove(s, strategy.reserve);
    const surplus = s.supplies - (strategy.reserve ?? 0);
    if (s.debt > 0 && surplus > 0) s = act(s, { type: 'repay', amount: Math.min(surplus, s.debt) });
    s = act(s, s.injuredWeeks > 0 ? { type: 'rest' } : { type: 'scavenge', depth: strategy.depth });
  }
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(process.argv[2]) || 2000;
  for (const [name, strategy] of Object.entries(STRATEGIES)) {
    const tally = { won: 0, dead: 0, playing: 0 };
    const causes = {};
    let winWeeks = 0;
    for (let seed = 1; seed <= games; seed++) {
      const s = playOne(strategy, seed);
      tally[s.status] += 1;
      if (s.status === 'won') winWeeks += s.week;
      if (s.cause) causes[s.cause] = (causes[s.cause] ?? 0) + 1;
    }
    const pct = (n) => `${((100 * n) / games).toFixed(1)}%`;
    console.log(
      `${name}: 胜 ${pct(tally.won)}，亡 ${pct(tally.dead)}，超时 ${pct(tally.playing)}，` +
        `平均通关周数 ${tally.won ? (winWeeks / tally.won).toFixed(1) : '-'}，死因 ${JSON.stringify(causes)}`,
    );
  }
}

