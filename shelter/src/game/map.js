// 地图：一张连续的小世界（院子、营地广场、池塘、树林、废墟），外加铁皮屋的室内。
// 只有布局数据，不涉及绘制。

export const W = 72;
export const H = 46;
export const GRASS = 0;
export const PATH = 1;
export const CONCRETE = 2;
export const WATER = 3;

export const GARDEN = { x0: 14, y0: 8, x1: 21, y1: 13 };
export const PADS = [
  { x: 4, y: 13 },
  { x: 4, y: 16 },
  { x: 11, y: 16 },
  { x: 11, y: 19 },
];
export const HOME_DOOR = { x: 8.5, y: 11.6 }; // 出门后站的位置

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const key = (x, y) => `${x},${y}`;

export function buildWorld(seed) {
  const rand = rng(seed ^ 0x51ed270b);
  const ground = new Uint8Array(W * H);
  const solid = new Uint8Array(W * H);
  const reserved = new Uint8Array(W * H);
  const things = []; // { art, x, y, fw, fh, frame? }：占 fw×fh 格，图片底边对齐占地底边
  const inter = new Map(); // "x,y" → 可以互动的东西
  const at = (x, y) => y * W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  const fill = (arr, x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) arr[at(x, y)] = v;
  };
  const road = (x0, y0, x1, y1) => {
    fill(ground, x0, y0, x1, y1, PATH);
    fill(reserved, x0, y0, x1, y1, 1);
  };
  const put = (art, x, y, fw = 1, fh = 1, extra = {}) => {
    const thing = { art, x, y, fw, fh, ...extra };
    things.push(thing);
    if (!extra.walk) fill(solid, x, y, x + fw - 1, y + fh - 1, 1);
    fill(reserved, x, y, x + fw - 1, y + fh - 1, 1);
    return thing;
  };
  const touch = (x0, y0, x1, y1, what) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) inter.set(key(x, y), what);
  };

  /* 道路 */
  road(3, 22, 68, 23); // 主路
  road(34, 9, 35, 36); // 广场南北
  road(8, 11, 9, 22); // 家门口
  road(50, 13, 51, 22); // 去池塘
  road(56, 23, 57, 31); // 去废墟
  road(14, 24, 15, 30); // 去树林

  /* 家 */
  fill(reserved, 3, 6, 23, 21, 1);
  put('shack', 7, 8, 4, 3);
  touch(8, 10, 9, 10, { type: 'door', label: '进屋' });
  for (let x = 13; x <= 22; x++) {
    put('fence', x, 7);
    if (x !== 17 && x !== 18) put('fence', x, 14);
  }
  for (let y = 8; y <= 13; y++) {
    put('fence', 13, y);
    put('fence', 22, y);
  }
  PADS.forEach((p, i) => touch(p.x, p.y, p.x + 1, p.y + 1, { type: 'pad', index: i, label: '看看这块空地' }));
  put('hammock', 15, 17, 2, 1);
  touch(15, 17, 16, 17, { type: 'hammock', label: '躺一会儿' });
  put('sign', 6, 21);
  touch(6, 21, 6, 21, { type: 'sign', label: '看路牌', text: '← 我的铁皮屋　营地广场 →　往南：树林　往东：池塘和废墟' });

  /* 营地广场 */
  fill(ground, 27, 16, 42, 29, CONCRETE);
  fill(reserved, 26, 14, 43, 30, 1);
  road(27, 22, 42, 23);
  road(34, 16, 35, 29);
  put('office', 28, 17, 4, 3);
  put('stall', 37, 17, 3, 2);
  put('loanBooth', 28, 26, 2, 2);
  put('teaCart', 38, 26, 2, 2);
  put('well', 32, 26);
  put('board', 31, 20, 2, 1);
  touch(31, 20, 32, 20, { type: 'board', label: '看公告' });
  put('lamp', 26, 21);
  put('lamp', 43, 21);
  put('lamp', 33, 15);
  const npcs = [
    { id: 'zhou', name: '房东老周', x: 30, y: 20, face: 0 },
    { id: 'mei', name: '小卖部阿梅', x: 38, y: 19, face: 0 },
    { id: 'jin', name: '金老板', x: 30, y: 27, face: 3 },
    { id: 'tea', name: '奶茶摊小桃', x: 40, y: 27, face: 2 },
  ];
  for (const n of npcs) {
    solid[at(n.x, n.y)] = 1;
    reserved[at(n.x, n.y)] = 1;
    inter.set(key(n.x, n.y), { type: 'npc', id: n.id, label: `和${n.name.slice(-2)}说话` });
  }

  /* 池塘 */
  for (let y = 2; y <= 14; y++) {
    for (let x = 42; x <= 62; x++) {
      const d = ((x - 52) / 8.2) ** 2 + ((y - 8) / 4.6) ** 2;
      if (d <= 1) {
        ground[at(x, y)] = WATER;
        solid[at(x, y)] = 1;
        inter.set(key(x, y), { type: 'water', label: '钓鱼' });
      }
      if (d <= 1.9) reserved[at(x, y)] = 1;
    }
  }

  /* 废墟 */
  for (let y = 25; y <= 43; y++) {
    for (let x = 45; x <= 69; x++) {
      const n = Math.sin(x * 0.9) + Math.cos(y * 0.7) + Math.sin((x + y) * 0.35);
      if (n > -0.4 && ground[at(x, y)] === GRASS) ground[at(x, y)] = CONCRETE;
    }
  }
  const free = (x, y, pad = 0) => {
    for (let j = y - pad; j <= y + pad; j++) {
      for (let i = x - pad; i <= x + pad; i++) if (!inside(i, j) || solid[at(i, j)] || reserved[at(i, j)]) return false;
    }
    return true;
  };
  const nodes = [];
  const scatter = (count, x0, y0, x1, y1, fn, pad = 1, tries = 6000) => {
    let placed = 0;
    while (placed < count && tries-- > 0) {
      const x = x0 + Math.floor(rand() * (x1 - x0 + 1));
      const y = y0 + Math.floor(rand() * (y1 - y0 + 1));
      if (!free(x, y, pad)) continue;
      fn(x, y, placed);
      placed += 1;
    }
  };
  const addNode = (kind, x, y, zone, fw = 1) => {
    const id = `n${nodes.length}`;
    const thing = put(`node:${kind}`, x, y, fw, 1, { node: id });
    nodes.push({ id, kind, x, y, zone, thing });
    touch(x, y, x + fw - 1, y, { type: 'node', id, kind, zone, label: '翻找' });
  };
  scatter(9, 46, 26, 56, 42, (x, y) => addNode('crate', x, y, 'near'));
  scatter(5, 58, 26, 67, 42, (x, y) => addNode('car', x, y, 'far', 2), 2);
  scatter(5, 58, 26, 68, 42, (x, y) => addNode('fridge', x, y, 'far'));
  scatter(26, 45, 25, 69, 43, (x, y) => put('ruinWall', x, y));
  scatter(10, 45, 25, 69, 43, (x, y) => put('deadTree', x, y));
  const dens = [];
  scatter(4, 59, 28, 68, 42, (x, y) => dens.push({ x: x + 0.5, y: y + 0.5 }), 2);

  /* 树林 */
  const forage = [];
  scatter(
    9,
    4,
    28,
    26,
    42,
    (x, y) => {
      const id = `f${forage.length}`;
      const thing = put('bush', x, y, 1, 1, { forage: id });
      forage.push({ id, kind: 'berry', x, y, thing });
      touch(x, y, x, y, { type: 'forage', id, kind: 'berry', label: '摘野莓' });
    },
    1,
  );
  scatter(
    7,
    4,
    28,
    26,
    42,
    (x, y) => {
      const id = `f${forage.length}`;
      const thing = put('mushroom', x, y, 1, 1, { forage: id });
      forage.push({ id, kind: 'mushroom', x, y, thing });
      touch(x, y, x, y, { type: 'forage', id, kind: 'mushroom', label: '采蘑菇' });
    },
    1,
  );
  scatter(95, 3, 27, 27, 43, (x, y) => put('tree', x, y, 1, 1, { variant: Math.floor(rand() * 3) }));

  /* 其余地方零星的树和石头 */
  scatter(60, 2, 2, W - 3, H - 3, (x, y) => put('tree', x, y, 1, 1, { variant: Math.floor(rand() * 3) }), 1, 9000);
  scatter(24, 2, 2, W - 3, H - 3, (x, y) => put('rock', x, y), 1);

  /* 四周一圈树，挡住地图边缘 */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= 2 && y >= 2 && x < W - 2 && y < H - 2) continue;
      solid[at(x, y)] = 1;
      if ((x + y) % 2 === 0) things.push({ art: 'tree', x, y, fw: 1, fh: 1, variant: (x * 7 + y * 3) % 3 });
    }
  }

  return { w: W, h: H, ground, solid, things, inter, npcs, nodes, forage, dens, spawn: { ...HOME_DOOR } };
}

/* ---------- 室内 ---------- */

export const ROOM = { w: 12, h: 9 };

export function buildRoom(hasConsole) {
  const { w, h } = ROOM;
  const solid = new Uint8Array(w * h);
  const inter = new Map();
  const things = [];
  const fill = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) solid[y * w + x] = 1;
  };
  fill(0, 0, w - 1, 1);
  fill(0, h - 1, w - 1, h - 1);
  fill(0, 0, 0, h - 1);
  fill(w - 1, 0, w - 1, h - 1);
  const put = (art, x, y, fw, fh, what) => {
    things.push({ art, x, y, fw, fh });
    fill(x, y, x + fw - 1, y + fh - 1);
    if (what) for (let j = y; j < y + fh; j++) for (let i = x; i < x + fw; i++) inter.set(key(i, j), what);
  };
  put('bed', 1, 2, 1, 2, { type: 'bed', label: '睡觉' });
  put(hasConsole ? 'tv' : 'tvStand', 7, 2, 2, 1, hasConsole ? { type: 'console', label: '打游戏' } : { type: 'stand', label: '看看柜子' });
  things.push({ art: 'rug', x: 4, y: 4, fw: 2, fh: 1, flat: true });
  things.push({ art: 'window', x: 3, y: 1, fw: 1, fh: 1, flat: true });
  things.push({ art: 'window', x: 10, y: 1, fw: 1, fh: 1, flat: true });
  things.push({ art: 'mat', x: 5, y: 7, fw: 1, fh: 1, flat: true });
  inter.set(key(5, 8), { type: 'exit', label: '出门' });
  inter.set(key(6, 8), { type: 'exit', label: '出门' });
  return { w, h, solid, things, inter, spawn: { x: 5.5, y: 7.4 }, bedside: { x: 2.5, y: 3.4 } };
}
