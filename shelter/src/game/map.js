// 地图：城市边缘的一条老街，外加十平米的出租屋。只有布局数据，不涉及绘制。
//
// 从北到南：一排楼（公寓、便利店、快餐店、奶茶店、夜校）→ 人行道 → 马路 → 人行道
// → 公园（老陈在池塘边钓鱼）。东南角的巷子里是床位房。

export const W = 66;
export const H = 30;
export const GRASS = 0;
export const PATH = 1;
export const PAVE = 2;
export const ROAD = 3;
export const WATER = 4;

export const ROAD_Y = [12, 15]; // 马路占的行
export const CROSSINGS = [23, 24, 47, 48]; // 斑马线所在的列
export const HOME_DOOR = { x: 7, y: 9.5 };
export const BUNK_DOOR = { x: 58, y: 23.5 };
export const GURU = { x: 12, y: 19 };

// 可以摆自动售货机的六个位置，按购买顺序占用
export const VENDING_SPOTS = [
  { x: 12, y: 8 },
  { x: 23, y: 8 },
  { x: 35, y: 8 },
  { x: 27, y: 18 },
  { x: 45, y: 18 },
  { x: 60, y: 8 },
];

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

export function buildStreet(seed) {
  const rand = rng(seed ^ 0x51ed270b);
  const ground = new Uint8Array(W * H);
  const solid = new Uint8Array(W * H);
  const reserved = new Uint8Array(W * H);
  const things = []; // { art, x, y, fw, fh }：占 fw×fh 格，图片底边对齐占地底边
  const inter = new Map(); // "x,y" → 可以互动的东西
  const at = (x, y) => y * W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const fill = (arr, x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) arr[at(x, y)] = v;
  };
  const put = (art, x, y, fw = 1, fh = 1, extra = {}) => {
    things.push({ art, x, y, fw, fh, ...extra });
    if (!extra.walk) fill(solid, x, y, x + fw - 1, y + fh - 1, 1);
    fill(reserved, x, y, x + fw - 1, y + fh - 1, 1);
  };
  const touch = (x0, y0, x1, y1, what) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) inter.set(key(x, y), what);
  };

  /* 地面 */
  fill(ground, 0, 6, W - 1, 11, PAVE);
  fill(ground, 0, ROAD_Y[0], W - 1, ROAD_Y[1], ROAD);
  fill(ground, 0, 16, W - 1, 17, PAVE);
  fill(reserved, 0, 0, W - 1, 17, 1);
  fill(solid, 0, 0, W - 1, 5, 1); // 楼后面进不去

  /* 北侧的一排楼：占地都是最下面三行 */
  const building = (art, x, tiles, doors, what) => {
    put(art, x, 6, tiles, 3);
    for (const dx of doors) inter.set(key(x + dx, 8), what);
  };
  building('apartment', 3, 8, [3, 4], { type: 'home', label: '回出租屋' });
  building('store', 14, 8, [3, 4], { type: 'store', label: '进便利店' });
  building('diner', 25, 9, [4], { type: 'diner', label: '进快餐店' });
  building('teaShop', 37, 7, [0, 1, 2, 3, 5], { type: 'tea', label: '买奶茶' });
  building('school', 50, 9, [3, 4, 5], { type: 'school', label: '进夜校' });

  put('salesBooth', 45, 8, 3, 1);
  put('ebike', 48, 8, 1, 1, { walk: true });
  put('tableSet', 38, 10, 2, 1);
  put('bin', 11, 8);
  put('bin', 34, 8);
  put('hydrant', 22, 9);
  put('flowerbed', 36, 8);
  put('flowerbed', 59, 8);
  put('hedge', 61, 8);
  put('hedge', 62, 8);
  for (const x of [2, 13, 24, 36, 49, 61]) put('lamp', x, 11);
  for (const x of [8, 19, 32, 43, 55]) put('lamp', x, 16);

  /* 西南：公交站和一小块空地 */
  fill(ground, 3, 18, 17, 20, PAVE);
  fill(reserved, 3, 18, 17, 21, 1);
  put('busStop', 6, 18);
  touch(6, 18, 6, 18, { type: 'sign', label: '看站牌', text: '城郊 7 路　首班 6:30　末班 21:00　去市中心：单程 4 元，1 小时 20 分' });
  put('bench', 8, 18, 2, 1);
  touch(8, 18, 9, 18, { type: 'bench', label: '坐一会儿' });
  inter.set(key(GURU.x, GURU.y), { type: 'npc', id: 'guru', label: '听听他说什么' });
  reserved[at(GURU.x, GURU.y)] = 1;

  /* 公园 */
  fill(ground, 21, 22, 49, 22, PATH);
  fill(ground, 24, 18, 25, 22, PATH);
  fill(ground, 47, 18, 48, 22, PATH);
  fill(reserved, 21, 22, 49, 22, 1);
  fill(reserved, 24, 18, 25, 22, 1);
  fill(reserved, 47, 18, 48, 22, 1);
  for (let x = 20; x <= 50; x++) {
    if ((x >= 24 && x <= 25) || (x >= 47 && x <= 48) || x === 27 || x === 45) continue;
    put(x % 5 === 0 ? 'flowerbed' : 'hedge', x, 18);
  }
  for (let y = 23; y <= 27; y++) {
    for (let x = 27; x <= 45; x++) {
      const d = ((x - 36) / 7.6) ** 2 + ((y - 25.3) / 2.5) ** 2;
      if (d <= 1) {
        ground[at(x, y)] = WATER;
        solid[at(x, y)] = 1;
        inter.set(key(x, y), { type: 'pond', label: '钓鱼' });
      }
      if (d <= 2) reserved[at(x, y)] = 1;
    }
  }
  put('kiosk', 21, 20, 2, 1);
  touch(21, 20, 22, 20, { type: 'sign', label: '看报刊亭', text: '报刊亭开着，却没人看店。玻璃上贴着一张纸：自取，钱放铁盒里。' });
  fill(reserved, 20, 19, 23, 21, 1);
  put('bench', 29, 20, 2, 1);
  put('bench', 41, 20, 2, 1);
  touch(29, 20, 30, 20, { type: 'bench', label: '坐一会儿' });
  touch(41, 20, 42, 20, { type: 'bench', label: '坐一会儿' });
  fill(reserved, 28, 19, 43, 21, 1);

  /* 东南：巷子里的床位房 */
  fill(ground, 53, 18, 63, 25, PAVE);
  fill(reserved, 52, 18, 63, 26, 1);
  put('bunkHouse', 55, 20, 6, 3);
  touch(57, 22, 58, 22, { type: 'bunk', label: '进床位房' });
  put('bin', 54, 22);
  put('bin', 62, 22);

  /* 站在街上的人 */
  const npcs = [
    { id: 'chen', name: '老陈', x: 36, y: 22, face: 0 },
    { id: 'qiang', name: '阿强', x: 31, y: 9, face: 0 },
    { id: 'lili', name: '莉莉', x: 40, y: 10, face: 2 },
    { id: 'sales', name: '推销员', x: 46, y: 9, face: 0 },
  ];
  for (const n of npcs) {
    solid[at(n.x, n.y)] = 1;
    reserved[at(n.x, n.y)] = 1;
    inter.set(key(n.x, n.y), { type: 'npc', id: n.id, label: `和${n.name}说话` });
  }
  npcs.push({ id: 'guru', name: '财富导师', x: GURU.x, y: GURU.y, face: 0, conditional: true });

  for (const spot of VENDING_SPOTS) {
    reserved[at(spot.x, spot.y)] = 1;
    solid[at(spot.x, spot.y)] = 0;
  }

  /* 树：公园和空地上随机种一些，互相不挨着 */
  const free = (x, y) => {
    for (let j = y - 1; j <= y + 1; j++) {
      for (let i = x - 1; i <= x + 1; i++) if (!inside(i, j) || solid[at(i, j)] || reserved[at(i, j)]) return false;
    }
    return true;
  };
  let tries = 4000;
  let planted = 0;
  while (planted < 46 && tries-- > 0) {
    const x = 2 + Math.floor(rand() * (W - 4));
    const y = 19 + Math.floor(rand() * 9);
    if (!free(x, y)) continue;
    put('tree', x, y, 1, 1, { variant: Math.floor(rand() * 3) });
    planted += 1;
  }

  /* 四周一圈树，挡住地图边缘 */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x < 2 || x >= W - 2 || y >= H - 2;
      if (!edge) continue;
      if (ground[at(x, y)] !== GRASS) continue;
      solid[at(x, y)] = 1;
      if ((x + y) % 2 === 0) things.push({ art: 'tree', x, y, fw: 1, fh: 1, variant: (x * 7 + y * 3) % 3 });
    }
  }
  // 街道两头：人行道和马路一直通到画面外，但走不出去
  for (let y = 6; y <= 17; y++) {
    solid[at(0, y)] = 1;
    solid[at(W - 1, y)] = 1;
  }
  // 楼顶后面那几行种满树
  for (let x = 0; x < W; x += 2) things.push({ art: 'tree', x, y: 3, fw: 1, fh: 1, variant: (x / 2) % 3 });

  return { w: W, h: H, ground, solid, things, inter, npcs };
}

/* ---------- 出租屋 ---------- */

// 一套老旧的小套间：左边睡觉和书桌，中间起居，右边厨房，右上角隔出卫生间，右下角放洗衣机。
export const ROOM_ZONES = {
  kitchen: { x0: 9, y0: 2, x1: 13, y1: 3 },
  bath: { x0: 15, y0: 2, x1: 18, y1: 5 },
};
export const ROOM_PARTITION = [
  [14, 2],
  [14, 3],
  [14, 4],
  [14, 6],
  [15, 6],
  [16, 6],
  [17, 6],
  [18, 6],
];

export function buildRoom() {
  const w = 20;
  const h = 12;
  const solid = new Uint8Array(w * h);
  const inter = new Map();
  const things = []; // 家具：占地格子，图片底边对齐占地底边
  const decor = []; // 墙上和地上的摆设：直接给像素坐标；when 决定出不出现，base 决定前后遮挡
  const fill = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) solid[y * w + x] = 1;
  };
  fill(0, 0, w - 1, 1);
  fill(0, h - 1, w - 1, h - 1);
  fill(0, 0, 0, h - 1);
  fill(w - 1, 0, w - 1, h - 1);
  for (const [x, y] of ROOM_PARTITION) fill(x, y, x, y);
  const put = (art, x, y, fw, fh, what) => {
    things.push({ art, x, y, fw, fh });
    fill(x, y, x + fw - 1, y + fh - 1);
    for (let j = y; j < y + fh; j++) for (let i = x; i < x + fw; i++) inter.set(key(i, j), what);
  };
  const say = (label, text) => ({ type: 'look', label, text });

  /* 靠北墙一排 */
  put('bed', 1, 2, 1, 2, { type: 'bed', label: '睡觉' });
  put('nightstand', 2, 2, 1, 1, say('床头柜', '闹钟定在 7:00。旁边是半杯昨天的水。'));
  put('desk', 3, 2, 2, 1, { type: 'desk', label: '坐下发会儿呆' });
  put('bookshelf', 5, 2, 1, 1, say('书架', '几本高中课本、几本别人送的小说，最下面一层是落了灰的游戏手柄。'));
  put('wardrobe', 7, 2, 1, 1, say('衣柜', '三件 T 恤、两条裤子、一件冬天的外套。柜顶的编织袋是搬来那天用的。'));
  put('fridge', 9, 2, 1, 1, { type: 'fridge', label: '看冰箱' });
  put('kitchen', 10, 2, 2, 1, { type: 'stove', label: '做饭' });
  put('cart', 12, 2, 1, 1, { type: 'stove', label: '做饭' });

  /* 卫生间 */
  put('toilet', 15, 2, 1, 1, say('马桶', '水箱有点漏，夜里能听见滴水声。'));
  put('basin', 16, 2, 1, 1, say('洗手池', '镜子里的人看着有点累。'));
  put('shower', 17, 2, 2, 1, say('淋浴', '热水要放两分钟才来。房东说热水器“还能用”。'));

  /* 起居 */
  put('lowTable', 8, 5, 1, 1, say('小矮桌', '吃饭、放东西都在这张桌上。'));
  put('sofa', 7, 8, 2, 1, { type: 'sofa', label: '在沙发上瘫一会儿' });
  put('fan', 11, 8, 1, 1, say('落地扇', '前一个租客留下的。开到三档会抖。'));
  put('boxes', 1, 9, 1, 1, say('纸箱', '搬来时的纸箱，一直没拆完。里面是课本和一些舍不得扔的东西。'));

  /* 右下角 */
  put('washer', 18, 7, 1, 1, say('洗衣机', '二手的，脱水时会自己往前走。'));
  put('rack', 16, 8, 1, 2, say('晾衣架', '快餐店的工服，洗了三天还没干透。'));

  // 墙上
  decor.push({ art: 'window', px: 16, py: 1 });
  decor.push({ art: 'certificate', px: 50, py: 2, when: 'skilled' });
  decor.push({ art: 'calendar', px: 68, py: 1 });
  decor.push({ art: 'clock', px: 97, py: 1 });
  decor.push({ art: 'poster', px: 129, py: 2 });
  decor.push({ art: 'shelf', px: 160, py: 0 });
  decor.push({ art: 'window', px: 190, py: 1 });
  decor.push({ art: 'mirror', px: 259, py: 3 });
  decor.push({ art: 'hooks', px: 101, py: 13 });
  // 地上
  decor.push({ art: 'rug', px: 112, py: 80 });
  decor.push({ art: 'shoes', px: 144, py: 164 });
  decor.push({ art: 'doorway', px: 152, py: 176 });
  decor.push({ art: 'stool', px: 114, py: 84, base: 92 });
  decor.push({ art: 'stool', px: 148, py: 86, base: 94 });
  decor.push({ art: 'noodles', px: 34, py: 54, when: 'low' });
  decor.push({ art: 'helmet', px: 166, py: 164, when: 'ebike', base: 173 });
  decor.push({ art: 'toolbox', px: 122, py: 164, when: 'skilled', base: 174 });
  decor.push({ art: 'groceryBag', px: 146, py: 44, when: 'groceries', base: 57 });
  decor.push({ art: 'mop', px: 290, py: 134, base: 160 });
  decor.push({ art: 'boxes', px: 34, py: 150, base: 176 });
  // 家具上面
  decor.push({ art: 'plant', px: 49, py: 12, base: 48.4 });
  decor.push({ art: 'textbook', px: 51, py: 23, when: 'classes', base: 48.5 });
  decor.push({ art: 'ledger', px: 53, py: 20, when: 'ledger', base: 48.6 });
  decor.push({ art: 'phone', px: 44, py: 28, when: 'phone', base: 48.5 });

  inter.set(key(9, 11), { type: 'exit', label: '出门' });
  inter.set(key(10, 11), { type: 'exit', label: '出门' });
  return { w, h, solid, things, decor, inter, npcs: [], spawn: { x: 10, y: 10.4 }, bedside: { x: 2.5, y: 3.6 } };
}
