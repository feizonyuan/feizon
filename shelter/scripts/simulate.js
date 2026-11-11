// 用几种固定的过法各过若干个月，看每个月能剩多少钱，用来校准数值。
// 用法：node scripts/simulate.js [月数] [每种过法跑几遍]
import {
  RULES,
  newState,
  work,
  repairJob,
  study,
  buyBento,
  buyGroceries,
  cook,
  buyTea,
  sitBench,
  buyVending,
  skilled,
  hoursLeft,
  endDay,
} from '../src/game/state.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 吃到不饿为止：自己做饭或者买便当
function eat(s, cooking) {
  while (s.fullness <= 50 && hoursLeft(s) >= 1) {
    if (cooking) {
      if (s.groceries < 1 && buyGroceries(s, 4)) break;
      if (cook(s)) break;
    } else if (buyBento(s)) break;
  }
}

// 心力低就去公园坐着（不花钱）或者喝奶茶（花钱）
function recover(s, tea, floor) {
  while (s.sanity < floor && hoursLeft(s) >= 1) {
    if (tea ? buyTea(s) : sitBench(s)) break;
  }
}

export const WAYS = {
  '打两班工，吃便当，喝奶茶解压': { shifts: 2, cooking: false, tea: true },
  '打两班工，吃便当，去公园坐着': { shifts: 2, cooking: false },
  '打两班工，自己做饭': { shifts: 2, cooking: true },
  '打三班工，吃便当': { shifts: 3, cooking: false },
  '做饭 + 下班去夜校，学成后接维修单': { shifts: 2, cooking: true, study: true },
  '做饭 + 夜校 + 攒钱买售货机': { shifts: 2, cooking: true, study: true, invest: true },
};

export function live(way, months, seed) {
  const s = newState(seed);
  const rand = rng(seed);
  const rows = [];
  while (rows.length < months) {
    eat(s, way.cooking);
    s.minutes += 20; // 走到店里
    if (way.study && skilled(s)) {
      while (!repairJob(s));
    }
    let shifts = way.study && skilled(s) ? 1 : way.shifts;
    while (shifts-- > 0 && s.sanity >= 14 && !work(s));
    eat(s, way.cooking);
    recover(s, way.tea, way.study && !skilled(s) ? RULES.lowSanity + 6 : 26);
    if (way.study && !skilled(s)) study(s);
    // 留出下个账单日要交的钱和一点备用金，多出来的才拿去买售货机
    if (way.invest) while (s.cash >= RULES.vending.cost + s.rent + 150 && !buyVending(s));
    const report = endDay(s, rand);
    if (report.bill) rows.push(report.bill);
  }
  return { s, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const months = Number(process.argv[2]) || 10;
  const runs = Number(process.argv[3]) || 200;
  for (const [name, way] of Object.entries(WAYS)) {
    const cash = Array(months).fill(0);
    const passive = Array(months).fill(0);
    let bankrupt = 0;
    let won = 0;
    let wonMonth = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const { s, rows } = live(way, months, seed);
      rows.forEach((r, i) => {
        cash[i] += r.cash - r.debt;
        passive[i] += r.passive;
      });
      if (rows.some((r) => r.bankrupt)) bankrupt += 1;
      const w = rows.findIndex((r) => r.won);
      if (w >= 0) {
        won += 1;
        wonMonth += w + 1;
      }
      void s;
    }
    const avg = (a) => a.map((v) => Math.round(v / runs)).join(' ');
    console.log(`\n${name}`);
    console.log(`  每月底的现金减欠款：${avg(cash)}`);
    if (passive.some(Boolean)) console.log(`  每月的被动收入：    ${avg(passive)}`);
    console.log(`  破产过：${((100 * bankrupt) / runs).toFixed(0)}%　赎回时间：${((100 * won) / runs).toFixed(0)}%${won ? `（平均第 ${(wonMonth / won).toFixed(1)} 个月）` : ''}`);
  }
}
