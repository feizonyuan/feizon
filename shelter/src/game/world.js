// 世界：避难所内部和外面的废墟。只有数据和规则，不涉及绘制。
export const WORLD = {
  daySeconds: 55, // 在外面从清晨到天黑的真实秒数
  duskAt: 0.72, // 天色开始变暗
  playerSpeed: 4.6, // 每秒走几格
  searchSeconds: 1.1,
  packBase: 14,
  packPerExtraPerson: 5,
  truckPack: 1.5,
  winterLoot: 0.8,
  reach: 1.25,
  zones: {
    near: { from: 6, to: 22, nodes: 8, loot: [1, 2], respawn: 2, dogs: 0 },
    mid: { from: 23, to: 42, nodes: 10, loot: [2, 4], respawn: 3, dogs: 3, dogSpeed: 2.7, sight: 4.2 },
    deep: { from: 43, to: 62, nodes: 12, loot: [4, 7], respawn: 3, dogs: 6, dogSpeed: 3.7, sight: 5.5 },
  },
  hurtDays: { dog: 3, night: 2 },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 外面 ---------- */

export const OUT_W = 64;
export const OUT_H = 30;
const ROAD_Y = 14;

export function zoneAt(x) {
  if (x < WORLD.zones.mid.from) return 'near';
  if (x < WORLD.zones.deep.from) return 'mid';
  return 'deep';
}

// 由种子生成废墟地图：障碍物、物资点、野狗的窝。同一种子得到同一张图。
export function makeOutside(seed) {
  const rand = rng(seed ^ 0x9e3779b9);
  const solid = new Uint8Array(OUT_W * OUT_H);
  const props = [];
  const at = (x, y) => y * OUT_W + x;
  const onRoad = (y) => y === ROAD_Y || y === ROAD_Y + 1;

  for (let y = 0; y < OUT_H; y++) {
    for (let x = 0; x < OUT_W; x++) {
      const edge = x === 0 || y === 0 || x === OUT_W - 1 || y === OUT_H - 1;
      if (edge) {
        solid[at(x, y)] = 1;
        continue;
      }
      if (onRoad(y) || (x < 7 && Math.abs(y - ROAD_Y) < 4)) continue;
      // 不让障碍物挨在一起，这样任何地方都走得通
      if (solid[at(x - 1, y)] || solid[at(x, y - 1)] || solid[at(x - 1, y - 1)] || solid[at(x + 1, y - 1)]) continue;
      const density = x < 23 ? 0.05 : x < 43 ? 0.08 : 0.11;
      if (rand() < density) {
        solid[at(x, y)] = 1;
        const roll = rand();
        props.push({ x, y, kind: roll < 0.45 ? 'rubble' : roll < 0.75 ? 'tree' : 'ruin' });
      }
    }
  }

  for (const [hx, hy] of [[2, ROAD_Y - 1], [3, ROAD_Y - 1], [2, ROAD_Y], [3, ROAD_Y]]) solid[at(hx, hy)] = 1;

  const nodes = [];
  const free = (x, y) => !solid[at(x, y)] && !onRoad(y) && nodes.every((n) => Math.hypot(n.x - x, n.y - y) > 3.2);
  for (const [zone, z] of Object.entries(WORLD.zones)) {
    let tries = 0;
    let placed = 0;
    while (placed < z.nodes && tries++ < 4000) {
      const x = z.from + Math.floor(rand() * (z.to - z.from));
      const y = 2 + Math.floor(rand() * (OUT_H - 4));
      if (!free(x, y)) continue;
      solid[at(x, y)] = 1;
      nodes.push({ id: nodes.length, x, y, zone, cool: 0 });
      placed += 1;
    }
  }

  const dens = [];
  for (const [zone, z] of Object.entries(WORLD.zones)) {
    let tries = 0;
    let placed = 0;
    while (placed < z.dogs && tries++ < 4000) {
      const x = z.from + 1 + Math.floor(rand() * (z.to - z.from - 2));
      const y = 2 + Math.floor(rand() * (OUT_H - 4));
      if (solid[at(x, y)] || onRoad(y) || dens.some((d) => Math.hypot(d.x - x, d.y - y) < 5)) continue;
      dens.push({ x: x + 0.5, y: y + 0.5, zone });
      placed += 1;
    }
  }

  return {
    w: OUT_W,
    h: OUT_H,
    solid,
    props,
    nodes,
    dens,
    roadY: ROAD_Y,
    hatch: { x: 2, y: ROAD_Y - 1 }, // 2×2 的出入口，左上角
    spawn: { x: 4.6, y: ROAD_Y + 1 },
  };
}

export function spawnDogs(outside) {
  return outside.dens.map((d) => ({ x: d.x, y: d.y, hx: d.x, hy: d.y, zone: d.zone, tx: d.x, ty: d.y, wait: 0, chasing: false, face: 1, step: 0 }));
}

/* ---------- 避难所内部 ---------- */

export const IN_W = 11;
export const IN_H = 15;
export const PADS = [5, 8, 11].flatMap((y) => [1, 4, 7].map((x) => ({ x, y })));

export const FIXTURES = {
  bed: { x: 1, y: 2, w: 1, h: 2 },
  zhou: { x: 3, y: 2, w: 1, h: 1 },
  radio: { x: 5, y: 2, w: 1, h: 1 },
  stock: { x: 6, y: 2, w: 2, h: 2 },
  ladder: { x: 9, y: 1, w: 1, h: 1 },
};

// 内部的碰撞：墙、固定物件、已经建成的设施。
export function insideSolid(builtCount) {
  const solid = new Uint8Array(IN_W * IN_H);
  const fill = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) solid[j * IN_W + i] = 1;
  };
  fill(0, 0, IN_W, 2);
  fill(0, IN_H - 1, IN_W, 1);
  fill(0, 0, 1, IN_H);
  fill(IN_W - 1, 0, 1, IN_H);
  for (const [name, f] of Object.entries(FIXTURES)) if (name !== 'ladder') fill(f.x, f.y, f.w, f.h);
  PADS.slice(0, builtCount).forEach((p) => fill(p.x, p.y, 2, 2));
  return solid;
}

/* ---------- 移动与碰撞 ---------- */

const HALF = 0.3; // 角色脚下碰撞盒的半宽

function blocked(solid, w, h, x, y) {
  for (const [dx, dy] of [
    [-HALF, -0.15],
    [HALF, -0.15],
    [-HALF, 0.35],
    [HALF, 0.35],
  ]) {
    const tx = Math.floor(x + dx);
    const ty = Math.floor(y + dy);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h || solid[ty * w + tx]) return true;
  }
  return false;
}

// 沿两个轴分别移动，这样贴着墙也能滑着走。
export function move(body, dx, dy, solid, w, h) {
  if (dx && !blocked(solid, w, h, body.x + dx, body.y)) body.x += dx;
  if (dy && !blocked(solid, w, h, body.x, body.y + dy)) body.y += dy;
}

export function packCapacity(game) {
  let cap = WORLD.packBase + WORLD.packPerExtraPerson * (game.people - 2);
  if (game.facilities.includes('truck')) cap *= WORLD.truckPack;
  return Math.floor(cap);
}

export function lootRoll(zone, winter) {
  const [lo, hi] = WORLD.zones[zone].loot;
  const amount = lo + Math.floor(Math.random() * (hi - lo + 1));
  return Math.max(1, Math.round(amount * (winter ? WORLD.winterLoot : 1)));
}

// 野狗：平时在窝附近转悠，看见人就追，追远了就回去。返回 true 表示咬到了人。
export function updateDogs(dogs, player, outside, dt) {
  let bitten = false;
  for (const d of dogs) {
    const z = WORLD.zones[d.zone];
    const toPlayer = Math.hypot(player.x - d.x, player.y - d.y);
    const fromHome = Math.hypot(d.x - d.hx, d.y - d.hy);
    if (!d.chasing && toPlayer < z.sight) d.chasing = true;
    if (d.chasing && (toPlayer > z.sight + 3 || fromHome > z.sight + 7)) {
      d.chasing = false;
      d.tx = d.hx;
      d.ty = d.hy;
    }

    let speed = z.dogSpeed;
    if (d.chasing) {
      d.tx = player.x;
      d.ty = player.y;
    } else {
      speed *= 0.4;
      d.wait -= dt;
      if (d.wait <= 0 && Math.hypot(d.tx - d.x, d.ty - d.y) < 0.3) {
        d.wait = 1 + Math.random() * 2;
        d.tx = d.hx + (Math.random() - 0.5) * 5;
        d.ty = d.hy + (Math.random() - 0.5) * 5;
      }
    }
    const dx = d.tx - d.x;
    const dy = d.ty - d.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.1) {
      const before = d.x + d.y;
      move(d, (dx / len) * speed * dt, (dy / len) * speed * dt, outside.solid, outside.w, outside.h);
      if (Math.abs(dx) > 0.2) d.face = dx > 0 ? 1 : -1;
      if (before !== d.x + d.y) d.step += dt * (d.chasing ? 10 : 5);
      else if (!d.chasing) {
        d.tx = d.x;
        d.ty = d.y;
      }
    }
    if (toPlayer < 0.62) bitten = true;
  }
  return bitten;
}
