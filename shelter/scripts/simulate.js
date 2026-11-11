// 用几种固定策略各跑多局，查看胜率和局长，用来调数值。
// 用法：node scripts/simulate.js [局数] [章节]
import { newGame, act, buildCost, legalActions } from '../src/engine/engine.js';
import { chapterById } from '../src/data/chapters.js';

const MAX_WEEKS = 80;
const PRODUCERS = ['solar', 'purifier', 'farm', 'tradepost'];

function buildWhileAbove(state, reserve) {
  const allowed = chapterById(state.chapter).facilities;
  for (;;) {
    const id = PRODUCERS.find((p) => allowed.includes(p) && state.supplies - buildCost(state, p) >= reserve);
    if (!id) return state;
    state = act(state, { type: 'build', facility: id });
  }
}

// reserve: 建设时保留的存粮（null 表示从不建设）；depth: 搜刮方式；
// crisis: 断粮时优先借粮还是拆卖。
export const STRATEGIES = {
  只搜刮不建设: { reserve: null, depth: 'safe', crisis: 'borrow' },
  稳健留存粮: { reserve: 20, depth: 'safe', crisis: 'sell' },
  全部投入不留粮: { reserve: 0, depth: 'safe', crisis: 'sell' },
  不留粮且缺粮就借: { reserve: 0, depth: 'safe', crisis: 'borrow' },
  不留粮且冒险深入: { reserve: 0, depth: 'deep', crisis: 'borrow' },
};

function resolvePending(s, strategy) {
  const ids = legalActions(s).map((a) => a.choice);
  if (s.pending.id !== 'crisis') return 'decline';
  const sell = ids.find((id) => id.startsWith('sell:'));
  if (strategy.crisis === 'borrow') return ids.includes('borrow') ? 'borrow' : sell;
  return sell ?? 'borrow';
}

export function playOne(strategy, seed, chapter) {
  let s = newGame(seed, chapter);
  while (s.status === 'playing' && s.week <= MAX_WEEKS) {
    if (s.pending) {
      s = act(s, { type: 'resolve', choice: resolvePending(s, strategy) });
      continue;
    }
    // 欠粮每周一成利息，所以先还粮，只留一点点应急。
    const surplus = s.supplies - Math.min(strategy.reserve ?? 0, 5);
    if (s.debt > 0 && surplus > 0) s = act(s, { type: 'repay', amount: Math.min(surplus, s.debt) });
    if (strategy.reserve !== null) s = buildWhileAbove(s, strategy.reserve);
    s = act(s, s.injuredWeeks > 0 ? { type: 'rest' } : { type: 'scavenge', depth: strategy.depth });
  }
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(process.argv[2]) || 2000;
  const chapters = process.argv[3] ? [Number(process.argv[3])] : [1, 2, 3];
  for (const chapter of chapters) {
    console.log(`\n第 ${chapter} 章「${chapterById(chapter).name}」`);
    for (const [name, strategy] of Object.entries(STRATEGIES)) {
      const tally = { won: 0, dead: 0, playing: 0 };
      const causes = {};
      let winWeeks = 0;
      for (let seed = 1; seed <= games; seed++) {
        const s = playOne(strategy, seed, chapter);
        tally[s.status] += 1;
        if (s.status === 'won') winWeeks += s.week;
        if (s.cause) causes[s.cause] = (causes[s.cause] ?? 0) + 1;
      }
      const pct = (n) => `${((100 * n) / games).toFixed(1)}%`;
      console.log(
        `  ${name}: 胜 ${pct(tally.won)}，亡 ${pct(tally.dead)}，未脱身 ${pct(tally.playing)}，` +
          `平均通关周数 ${tally.won ? (winWeeks / tally.won).toFixed(1) : '-'}，死因 ${JSON.stringify(causes)}`,
      );
    }
  }
}
