// 用几种固定的过法各过若干个月，看每个月能剩多少钱，用来校准数值。
// 小操作环节一律按“不玩、直接干完”算。
// 用法：node scripts/simulate.js [月数] [每种过法跑几遍]
import {
  RULES,
  newState,
  advance,
  work,
  repairJob,
  study,
  writeGuide,
  buyBento,
  buyGroceries,
  cook,
  buyTea,
  sitBench,
  restHome,
  buyVending,
  buyFund,
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

// 饿了就吃：自己做饭（停电时改吃便当）或者买便当
function eat(s, cooking) {
  while (s.fullness <= 45 && hoursLeft(s) >= 1) {
    if (cooking) {
      if (s.groceries < 1 && buyGroceries(s, 4)) break;
      if (!cook(s)) continue;
    }
    if (buyBento(s)) break;
  }
}

// 心力低就歇着（不花钱）或者喝奶茶（花钱）
function recover(s, tea, floor) {
  while (s.sanity < floor && hoursLeft(s) >= 1) {
    if (tea ? buyTea(s) : sitBench(s) && restHome(s)) break;
  }
}

export const WAYS = {
  '打两班工，吃便当，喝奶茶解压': { shifts: 2, cooking: false, tea: true },
  '打两班工，吃便当，不花钱歇着': { shifts: 2, cooking: false },
  '打两班工，自己做饭': { shifts: 2, cooking: true },
  '打三班工，吃便当': { shifts: 3, cooking: false },
  '做饭 + 夜校，学成后接维修单': { shifts: 2, cooking: true, study: true },
  '再加上攒钱买售货机': { shifts: 2, cooking: true, study: true, vending: true },
  '再加上写教程': { shifts: 2, cooking: true, study: true, vending: true, guide: true },
  '不买售货机，余钱全买基金': { shifts: 2, cooking: true, study: true, fund: true },
};

export function live(way, months, seed) {
  const s = newState(seed);
  const rand = rng(seed);
  const rows = [];
  while (rows.length < months) {
    eat(s, way.cooking);
    advance(s, 20); // 走到店里
    const pro = way.study && skilled(s);
    if (pro) while (!repairJob(s));
    let shifts = pro ? 0 : way.shifts;
    while (shifts-- > 0 && s.sanity >= 14 && !work(s));
    eat(s, way.cooking);
    recover(s, way.tea, way.study ? RULES.lowSanity + 6 : 26);
    if (way.study && !skilled(s)) study(s);
    if (way.guide && pro) writeGuide(s);
    eat(s, way.cooking);
    // 留出下个账单日要交的钱和一点备用金，多出来的才拿去投
    const spare = () => s.cash - s.rent - 150;
    if (way.vending) while (spare() >= RULES.vending.cost && !buyVending(s));
    if (way.fund && spare() >= RULES.fund.min) buyFund(s, Math.floor(spare()));
    const report = endDay(s, rand);
    if (report.bill) rows.push(report.bill);
  }
  return { s, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const months = Number(process.argv[2]) || 8;
  const runs = Number(process.argv[3]) || 200;
  for (const [name, way] of Object.entries(WAYS)) {
    const worth = Array(months).fill(0);
    const passive = Array(months).fill(0);
    let bankrupt = 0;
    let won = 0;
    let wonMonth = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const { rows } = live(way, months, seed);
      rows.forEach((r, i) => {
        worth[i] += r.cash - r.debt + r.sheet.assets.reduce((sum, a) => sum + (a.doubt ? 0 : a.value), 0);
        passive[i] += r.passive;
      });
      if (rows.some((r) => r.bankrupt)) bankrupt += 1;
      const w = rows.findIndex((r) => r.won);
      if (w >= 0) {
        won += 1;
        wonMonth += w + 1;
      }
    }
    const avg = (a) => a.map((v) => Math.round(v / runs)).join(' ');
    console.log(`\n${name}`);
    console.log(`  每月底的身家（现金 + 能卖的东西 − 欠款）：${avg(worth)}`);
    if (passive.some(Boolean)) console.log(`  每月的被动收入：${avg(passive)}`);
    console.log(`  破产过：${((100 * bankrupt) / runs).toFixed(0)}%　赎回时间：${((100 * won) / runs).toFixed(0)}%${won ? `（平均第 ${(wonMonth / won).toFixed(1)} 个月）` : ''}`);
  }
}
