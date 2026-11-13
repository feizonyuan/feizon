// 全部像素画都用代码画出来，不依赖外部图片。题材：城市边缘的老街。
export const T = 16;

const INK = '#2b2437'; // 描边色：偏紫的深色，比纯黑柔和
const FONT = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

const C = {
  grass: '#74b356',
  grassD: '#62a04a',
  grassL: '#8cc66a',
  path: '#d2b17a',
  pathD: '#b99861',
  pave: '#c2c5c1',
  paveD: '#a9adaa',
  paveL: '#d4d6d2',
  road: '#5b5f6a',
  roadD: '#4e525c',
  roadL: '#6a6e79',
  water: '#4f9fd6',
  waterL: '#7cc0ea',
  waterD: '#3c85bd',
  stone: '#a3acaf',
  stoneD: '#8a9498',
  stoneL: '#bcc4c6',
  wood: '#b98552',
  woodD: '#96683c',
  woodL: '#d3a36e',
  leaf: '#4d9a4f',
  leafD: '#377a41',
  leafL: '#6fbb62',
  trunk: '#7d5536',
  red: '#d2583f',
  redD: '#aa4331',
  blue: '#4c7fb5',
  blueD: '#3a648f',
  tin: '#b4bec2',
  tinD: '#93a0a5',
  yellow: '#f2c14e',
  yellowD: '#d19a2e',
  pink: '#ee9fb8',
  pinkD: '#d77b99',
  purple: '#6b5a8e',
  purpleD: '#4f416d',
  white: '#f3efe6',
  cream: '#e6dcc6',
  creamD: '#cdbf9f',
  skin: '#f1c7a0',
  skinD: '#d9a67e',
  brick: '#b86a52',
  brickD: '#98523f',
  green: '#5fae6b',
  greenD: '#458a52',
  orange: '#e98b3a',
  glass: '#a9dcef',
  glassD: '#7fb9d2',
  lit: '#f6dc8a',
  night: '#3b3550',
  grey: '#8d8a94',
  greyD: '#716e7a',
  greyL: '#a9a6ae',
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 给不透明像素的外沿加一圈描边，让东西从背景里跳出来。
function addOutline(c) {
  const ctx = c.getContext('2d');
  const { width: w, height: h } = c;
  const src = ctx.getImageData(0, 0, w, h).data.slice();
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  ctx.fillStyle = INK;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// r(颜色, x, y, 宽, 高) 画矩形；e(颜色, 中心x, 中心y, 半径x, 半径y) 画实心椭圆；
// w(文字, 中心x, 基线y, 颜色, 字号) 写招牌上的字。
function make(w, h, draw, outline = true) {
  const [c, ctx] = canvas(w, h);
  const r = (color, x, y, rw = 1, rh = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh));
  };
  const e = (color, cx, cy, rx, ry) => {
    ctx.fillStyle = color;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const k = 1 - ((y + 0.5 - cy) / ry) ** 2;
      if (k <= 0) continue;
      const half = rx * Math.sqrt(k);
      const x0 = Math.round(cx - half);
      ctx.fillRect(x0, y, Math.max(1, Math.round(cx + half) - x0), 1);
    }
  };
  const texts = [];
  const write = (text, cx, y, color, size = 10) => texts.push([text, cx, y, color, size]);
  draw(r, e, write);
  if (outline) addOutline(c);
  for (const [text, cx, y, color, size] of texts) {
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, cx, y);
  }
  return c;
}

function flip(src) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

/* ---------- 地面 ---------- */

function grassTile(seed) {
  return make(
    T,
    T,
    (r) => {
      const rnd = rng(seed);
      r(C.grass, 0, 0, T, T);
      for (let i = 0; i < 5; i++) {
        const x = 1 + Math.floor(rnd() * 13);
        const y = 2 + Math.floor(rnd() * 12);
        r(C.grassD, x, y, 1, 2);
        r(C.grassD, x + 1, y + 1, 1, 1);
        if (rnd() > 0.5) r(C.grassL, x + 2, y, 1, 1);
      }
      if (seed % 5 === 0) {
        const x = 4 + Math.floor(rnd() * 8);
        const y = 4 + Math.floor(rnd() * 8);
        const petal = [C.white, C.yellow, C.pink][seed % 3];
        r(petal, x, y - 1);
        r(petal, x - 1, y);
        r(petal, x + 1, y);
        r(petal, x, y + 1);
        r(C.yellowD, x, y);
      }
    },
    false,
  );
}

function speckled(seed, base, dots, count) {
  return make(
    T,
    T,
    (r) => {
      const rnd = rng(seed);
      r(base, 0, 0, T, T);
      for (let i = 0; i < count; i++) r(dots[i % dots.length], Math.floor(rnd() * 15), Math.floor(rnd() * 15), rnd() > 0.5 ? 2 : 1, 1);
    },
    false,
  );
}

// 人行道：两块错缝的地砖
function paveTile(seed) {
  return make(
    T,
    T,
    (r) => {
      const rnd = rng(seed);
      r(C.pave, 0, 0, T, T);
      r(C.paveD, 0, 7, T, 1);
      r(C.paveD, 0, 15, T, 1);
      r(C.paveD, 7, 0, 1, 7);
      r(C.paveD, 15, 8, 1, 7);
      r(C.paveL, 1, 1, 5, 1);
      r(C.paveL, 9, 9, 5, 1);
      if (rnd() > 0.6) r(C.paveD, 2 + Math.floor(rnd() * 10), 3 + Math.floor(rnd() * 3), 2, 1);
    },
    false,
  );
}

function waterTile(frame) {
  return make(
    T,
    T,
    (r) => {
      r(C.water, 0, 0, T, T);
      const s = frame * 3;
      r(C.waterL, (2 + s) % 16, 3, 4, 1);
      r(C.waterL, (10 + s) % 16, 7, 3, 1);
      r(C.waterD, (5 + s) % 16, 11, 5, 1);
      r(C.waterL, (13 + s) % 16, 13, 2, 1);
    },
    false,
  );
}

/* ---------- 植物和街上的小东西 ---------- */

const tree = (seed) =>
  make(32, 48, (r, e) => {
    const rnd = rng(seed);
    r(C.trunk, 13, 30, 6, 16);
    r('#694529', 13, 30, 2, 16);
    r('#694529', 11, 44, 10, 2);
    e(C.leafD, 16, 26, 13, 9);
    e(C.leaf, 16, 19, 12, 10);
    e(C.leaf, 16, 12, 9, 8);
    e(C.leafL, 13, 10, 5, 4);
    e(C.leafL, 10, 19, 4, 3);
    for (let i = 0; i < 9; i++) r(C.leafD, 6 + rnd() * 20, 8 + rnd() * 22, 2, 1);
    for (let i = 0; i < 6; i++) r(C.leafL, 6 + rnd() * 18, 6 + rnd() * 18, 2, 1);
  });

const hedge = make(T, 18, (r, e) => {
  e(C.leafD, 8, 11, 8, 6);
  e(C.leaf, 8, 9, 7.5, 5);
  r(C.leafL, 3, 6, 3, 1);
  r(C.leafL, 9, 5, 3, 1);
  r(C.leafD, 6, 11, 2, 1);
});

const flowerbed = make(T, 14, (r) => {
  r(C.brickD, 0, 6, T, 8);
  r(C.brick, 0, 6, T, 2);
  r(C.leaf, 1, 3, 14, 4);
  [
    [2, 2, C.pink],
    [6, 1, C.yellow],
    [10, 2, C.white],
    [13, 1, C.pink],
  ].forEach(([x, y, c]) => r(c, x, y, 2, 2));
});

const bench = make(32, 18, (r) => {
  r(C.woodL, 2, 2, 28, 3);
  r(C.wood, 2, 6, 28, 2);
  r(C.woodL, 1, 9, 30, 4);
  r(C.woodD, 1, 12, 30, 1);
  r(C.night, 4, 13, 2, 5);
  r(C.night, 26, 13, 2, 5);
  r(C.night, 3, 2, 2, 8);
  r(C.night, 27, 2, 2, 8);
});

const lamp = make(T, 40, (r) => {
  r(C.night, 7, 10, 2, 28);
  r(C.night, 5, 37, 6, 2);
  r(C.night, 2, 6, 12, 2);
  r(C.night, 7, 2, 2, 5);
  r(C.lit, 2, 8, 4, 3);
  r(C.lit, 10, 8, 4, 3);
});

const bin = make(T, 18, (r) => {
  r(C.greenD, 3, 4, 10, 13);
  r(C.green, 4, 5, 8, 11);
  r(C.night, 3, 2, 10, 3);
  r(C.white, 6, 8, 4, 4);
  r(C.greenD, 7, 9, 2, 2);
});

const hydrant = make(T, 16, (r) => {
  r(C.red, 6, 4, 4, 11);
  r(C.redD, 6, 12, 4, 3);
  r(C.red, 5, 2, 6, 3);
  r(C.red, 3, 7, 3, 3);
  r(C.red, 10, 7, 3, 3);
  r(C.white, 7, 6, 1, 2);
});

const busStop = make(T, 40, (r, e, w) => {
  r(C.tinD, 7, 12, 2, 27);
  r(C.night, 5, 37, 6, 2);
  r(C.blue, 1, 1, 14, 12);
  r(C.white, 2, 2, 12, 10);
  r(C.blue, 3, 3, 10, 4);
  w('站', 8, 12, C.blueD, 7);
});

// 街边的自动售货机：占一格，比人高
const vending = (f) =>
  make(T, 30, (r) => {
    r(C.red, 1, 1, 14, 28);
    r(C.redD, 1, 1, 2, 28);
    r(C.night, 4, 3, 9, 13);
    for (let y = 4; y < 15; y += 4) {
      r(C.yellow, 5, y, 2, 3);
      r(C.blue, 8, y, 2, 3);
      r(C.green, 11, y, 1, 3);
    }
    r(f ? C.lit : C.white, 12, 18, 2, 3);
    r(C.night, 4, 22, 9, 4);
    r(C.tinD, 5, 23, 7, 2);
  });

const vendingSpot = make(
  T,
  T,
  (r) => {
    for (let i = 2; i < 14; i += 4) {
      r(C.yellow, i, 2, 2, 1);
      r(C.yellow, i, 13, 2, 1);
      r(C.yellow, 2, i, 1, 2);
      r(C.yellow, 13, i, 1, 2);
    }
  },
  false,
);

const tableSet = make(32, 22, (r, e) => {
  e(C.white, 16, 8, 8, 4);
  e(C.cream, 16, 9, 8, 3);
  r(C.night, 15, 11, 2, 9);
  r(C.night, 12, 19, 8, 2);
  r(C.pink, 2, 10, 6, 3);
  r(C.night, 3, 13, 1, 7);
  r(C.night, 6, 13, 1, 7);
  r(C.pink, 24, 10, 6, 3);
  r(C.night, 25, 13, 1, 7);
  r(C.night, 28, 13, 1, 7);
  r(C.white, 14, 3, 3, 4);
  r('#c79a6b', 14, 5, 3, 2);
});

const salesBooth = make(40, 44, (r, e, w) => {
  r(C.red, 0, 0, 40, 12);
  r(C.redD, 0, 10, 40, 2);
  r(C.night, 3, 12, 2, 16);
  r(C.night, 35, 12, 2, 16);
  r(C.white, 2, 26, 36, 16);
  r(C.cream, 2, 38, 36, 4);
  r(C.red, 2, 26, 36, 3);
  // 桌上的手机
  r(C.night, 8, 19, 5, 8);
  r(C.glass, 9, 20, 3, 5);
  r(C.night, 16, 20, 5, 7);
  r(C.lit, 17, 21, 3, 4);
  r(C.night, 26, 19, 5, 8);
  r(C.pink, 27, 20, 3, 5);
  w('0首付', 20, 9, C.lit, 9);
  w('分期', 20, 37, C.red, 9);
});

const kiosk = make(34, 40, (r, e, w) => {
  r(C.greenD, 0, 0, 34, 10);
  r(C.green, 1, 1, 32, 7);
  w('报刊', 17, 8, C.white, 7);
  r(C.creamD, 2, 10, 30, 28);
  r(C.night, 5, 13, 24, 11);
  r(C.lit, 6, 14, 22, 9);
  [C.red, C.blue, C.yellow, C.pink, C.white].forEach((c, i) => r(c, 7 + i * 4, 16, 3, 5));
  r(C.woodL, 2, 24, 30, 3);
  [C.white, C.cream, C.white].forEach((c, i) => r(c, 5 + i * 9, 29, 7, 6));
  r(C.red, 6, 30, 5, 1);
  r(C.blue, 15, 30, 5, 1);
});

const ebike = make(22, 16, (r) => {
  r(C.night, 1, 9, 6, 6);
  r(C.night, 15, 9, 6, 6);
  r(C.stone, 3, 11, 2, 2);
  r(C.stone, 17, 11, 2, 2);
  r(C.green, 5, 8, 12, 3);
  r(C.greenD, 5, 10, 12, 1);
  r(C.green, 14, 3, 2, 6);
  r(C.night, 12, 2, 6, 1);
  r(C.night, 4, 5, 6, 2);
  r(C.lit, 18, 5, 1, 2);
});

function car(body, bodyD) {
  return make(40, 22, (r) => {
    r(body, 2, 9, 36, 9);
    r(bodyD, 2, 15, 36, 3);
    r(body, 10, 2, 18, 8);
    r(C.glass, 12, 4, 6, 5);
    r(C.glassD, 20, 4, 6, 5);
    r(C.lit, 36, 11, 2, 2);
    r(C.red, 2, 11, 1, 2);
    r(C.night, 6, 16, 7, 5);
    r(C.night, 27, 16, 7, 5);
    r(C.stone, 8, 18, 3, 2);
    r(C.stone, 29, 18, 3, 2);
  });
}

/* ---------- 楼房 ---------- */

// 一扇窗：亮着灯、拉着帘子，或者晾着衣服
function win(r, x, y, kind) {
  r(C.greyD, x, y, 12, 12);
  r(kind === 'lit' ? C.lit : kind === 'dark' ? '#5d6a7c' : C.glass, x + 1, y + 1, 10, 10);
  r(C.greyD, x + 5, y + 1, 1, 10);
  if (kind === 'curtain') r(C.pink, x + 1, y + 1, 4, 10);
  if (kind === 'plain') r(C.white, x + 2, y + 2, 2, 2);
  r(C.greyL, x - 1, y + 12, 14, 2);
  if (kind === 'laundry') {
    r(C.white, x + 1, y + 14, 3, 4);
    r(C.blue, x + 5, y + 14, 3, 5);
    r(C.red, x + 9, y + 14, 2, 3);
  }
}

const apartment = make(128, 118, (r, e, w) => {
  r(C.greyD, 0, 0, 128, 6);
  r(C.grey, 2, 6, 124, 110);
  r(C.greyL, 2, 6, 124, 2);
  for (let x = 2; x < 126; x += 31) r(C.greyD, x, 8, 1, 108);
  r(C.greyD, 2, 42, 124, 1);
  r(C.greyD, 2, 76, 124, 1);
  const kinds = ['plain', 'lit', 'laundry', 'dark', 'curtain', 'plain', 'laundry', 'lit'];
  for (let floor = 0; floor < 2; floor++) {
    for (let i = 0; i < 4; i++) win(r, 12 + i * 31, 14 + floor * 34, kinds[floor * 4 + i]);
  }
  win(r, 12, 84, 'dark');
  win(r, 105, 84, 'curtain');
  // 空调外机
  r(C.white, 30, 62, 9, 6);
  r(C.tinD, 32, 63, 5, 4);
  r(C.white, 92, 28, 9, 6);
  r(C.tinD, 94, 29, 5, 4);
  // 单元门
  r(C.greyD, 50, 82, 28, 34);
  r('#4a4458', 53, 86, 22, 30);
  r(C.glassD, 55, 88, 8, 12);
  r(C.glassD, 65, 88, 8, 12);
  r(C.lit, 73, 103, 1, 3);
  r(C.night, 40, 72, 48, 11);
  w('幸福公寓', 64, 81, C.lit, 9);
  r(C.rust ?? '#a5563a', 110, 100, 6, 2);
});

function shop({ width, height, wall, wallD, band, bandD, sign, signColor, signSize = 11, front }) {
  return make(width, height, (r, e, w) => {
    r(wallD, 0, 0, width, 5);
    r(wall, 2, 5, width - 4, height - 7);
    for (let x = 8; x < width - 4; x += 9) r(wallD, x, 5, 1, 14);
    r(band, 0, 18, width, 16);
    r(bandD, 0, 32, width, 2);
    w(sign, width / 2, 30, signColor, signSize);
    r(wallD, 2, height - 4, width - 4, 2);
    front(r, e, w);
  });
}

// 橱窗：玻璃后面摆着东西
function showcase(r, x, y, w, h, items) {
  r(C.greyD, x, y, w, h);
  r(C.glass, x + 1, y + 1, w - 2, h - 2);
  r(C.white, x + 2, y + 2, 4, 2);
  r(C.glassD, x + 1, y + h - 5, w - 2, 1);
  items.forEach((c, i) => r(c, x + 3 + i * 5, y + h - 9, 3, 4));
}

function door(r, x, y, color = C.glass) {
  r(C.greyD, x, y, 16, 26);
  r(color, x + 1, y + 1, 6, 24);
  r(color, x + 9, y + 1, 6, 24);
  r(C.white, x + 2, y + 3, 2, 4);
  r(C.night, x + 6, y + 13, 1, 3);
  r(C.night, x + 9, y + 13, 1, 3);
}

const store = shop({
  width: 128,
  height: 84,
  wall: C.white,
  wallD: C.cream,
  band: C.green,
  bandD: C.greenD,
  sign: '便利店 24H',
  signColor: C.white,
  front: (r) => {
    r(C.orange, 0, 18, 128, 3);
    showcase(r, 8, 40, 44, 34, [C.red, C.yellow, C.blue, C.green, C.pink, C.orange, C.red]);
    door(r, 56, 56);
    showcase(r, 76, 40, 44, 34, [C.blue, C.white, C.yellow, C.red, C.green, C.pink, C.blue]);
  },
});

const diner = shop({
  width: 144,
  height: 84,
  wall: C.cream,
  wallD: C.creamD,
  band: C.red,
  bandD: C.redD,
  sign: '阿福快餐',
  signColor: C.lit,
  front: (r, e) => {
    r(C.yellow, 0, 18, 144, 2);
    for (const x of [8, 96]) {
      r(C.greyD, x, 42, 40, 30);
      r(C.lit, x + 1, 43, 38, 28);
      r(C.woodD, x + 6, 60, 12, 2);
      r(C.woodD, x + 22, 60, 12, 2);
      r(C.red, x + 8, 55, 3, 5);
      r(C.red, x + 26, 55, 3, 5);
      r(C.white, x + 3, 45, 5, 3);
    }
    door(r, 64, 56, C.lit);
    e(C.yellow, 72, 46, 7, 6);
    e(C.red, 72, 46, 4, 3);
  },
});

const teaShop = shop({
  width: 112,
  height: 84,
  wall: C.white,
  wallD: '#f1dfe5',
  band: C.pink,
  bandD: C.pinkD,
  sign: '一口甜 奶茶',
  signColor: C.white,
  signSize: 10,
  front: (r) => {
    for (let x = 0; x < 112; x += 14) r(C.white, x, 34, 7, 6);
    for (let x = 7; x < 112; x += 14) r(C.pink, x, 34, 7, 6);
    r(C.greyD, 10, 46, 56, 24);
    r('#fff7ea', 11, 47, 54, 22);
    r(C.woodL, 8, 68, 60, 4);
    [16, 28, 40, 52].forEach((x, i) => {
      r(C.white, x, 56, 6, 10);
      r(['#c79a6b', C.pink, '#b6d98a', '#c79a6b'][i], x + 1, 59, 4, 7);
      r(C.purpleD, x + 3, 52, 1, 5);
    });
    door(r, 82, 56, '#fbe3ea');
  },
});

const school = make(144, 100, (r, e, w) => {
  r(C.brickD, 0, 0, 144, 6);
  r(C.brick, 2, 6, 140, 92);
  for (let y = 10; y < 96; y += 6) {
    r(C.brickD, 2, y, 140, 1);
    for (let x = (y / 6) % 2 ? 8 : 14; x < 140; x += 12) r(C.brickD, x, y - 5, 1, 5);
  }
  r(C.blue, 22, 12, 100, 18);
  r(C.blueD, 22, 28, 100, 2);
  w('社区夜校', 72, 26, C.white, 12);
  for (const x of [10, 40, 92, 122]) win(r, x, 42, x === 40 || x === 92 ? 'lit' : 'plain');
  r(C.creamD, 54, 60, 36, 38);
  r(C.woodD, 58, 66, 28, 32);
  r(C.wood, 59, 67, 12, 31);
  r(C.wood, 73, 67, 12, 31);
  r(C.lit, 70, 82, 1, 3);
  r(C.lit, 73, 82, 1, 3);
  r(C.white, 10, 74, 22, 16);
  r(C.blue, 12, 76, 18, 3);
  r(C.greyD, 12, 81, 14, 1);
  r(C.greyD, 12, 84, 16, 1);
});

const bunkHouse = make(96, 84, (r, e, w) => {
  r('#4f4a5a', 0, 0, 96, 6);
  r('#7b7482', 2, 6, 92, 76);
  r('#6a6372', 2, 6, 92, 3);
  for (let x = 10; x < 92; x += 11) r('#6a6372', x, 9, 1, 73);
  r('#8f6a4a', 14, 20, 20, 9);
  r('#a5563a', 60, 36, 16, 10);
  r(C.night, 8, 14, 46, 14);
  w('床位 日租', 31, 25, C.lit, 9);
  win(r, 62, 14, 'dark');
  win(r, 10, 44, 'lit');
  r('#4a4458', 40, 50, 18, 32);
  r('#3b3550', 42, 52, 14, 30);
  r(C.lit, 53, 66, 1, 3);
  r(C.tinD, 70, 62, 14, 20);
  r(C.tin, 70, 62, 14, 3);
});

/* ---------- 人物 ---------- */

// 生成一个角色的全部帧：[朝向][帧]，朝向 0 下 1 上 2 左 3 右，帧 0 站立 1/2 迈步。
function human({ hair, top, topD, bottom, skin = C.skin, hat, shorts }) {
  const frame = (dir, step) =>
    make(T, 22, (r) => {
      const bob = step ? 1 : 0;
      const leg = shorts ? skin : bottom;
      const lx = step === 1 ? -1 : 0;
      const rx = step === 2 ? 1 : 0;
      if (dir < 2) {
        r(leg, 5, 16, 2, step === 1 ? 3 : 4);
        r(leg, 9, 16, 2, step === 2 ? 3 : 4);
        if (shorts) r(bottom, 5, 16, 6, 2);
        r(INK, 5, step === 1 ? 19 : 20, 2, 1);
        r(INK, 9, step === 2 ? 19 : 20, 2, 1);
      } else {
        r(leg, 6 + lx * 2, 16, 2, 4);
        r(leg, 8 + rx * 2, 16, 2, 4);
        if (shorts) r(bottom, 6, 16, 4, 2);
        r(INK, 6 + lx * 2, 20, 2, 1);
        r(INK, 8 + rx * 2, 20, 2, 1);
      }
      r(top, 4, 10 + bob, 8, 7 - bob);
      r(topD, 4, 15, 8, 1);
      if (dir === 0) {
        r(topD, 7, 11 + bob, 2, 3);
        r(skin, 3, 12 + bob, 1, 3);
        r(skin, 12, 12 + bob, 1, 3);
      } else if (dir === 1) {
        r(skin, 3, 12 + bob, 1, 3);
        r(skin, 12, 12 + bob, 1, 3);
      } else {
        r(topD, 7, 11 + bob, 2, 4);
        r(skin, 7, 14 + bob, 2, 1);
      }
      r(skin, 4, 3 + bob, 8, 7);
      r(hair, 4, 2 + bob, 8, 3);
      if (dir === 0) {
        r(hair, 4, 4 + bob, 1, 2);
        r(hair, 11, 4 + bob, 1, 2);
        r(INK, 6, 6 + bob, 1, 2);
        r(INK, 9, 6 + bob, 1, 2);
        r(C.skinD, 7, 9 + bob, 2, 1);
      } else if (dir === 1) {
        r(hair, 4, 4 + bob, 8, 5);
      } else {
        r(hair, 4, 4 + bob, 3, 4);
        r(INK, 9, 6 + bob, 1, 2);
      }
      if (hat) {
        r(hat, 3, 1 + bob, 10, 3);
        if (dir === 0) r(hat, 2, 4 + bob, 12, 1);
      }
    });
  const right = [0, 1, 2].map((s) => frame(3, s));
  return [[0, 1, 2].map((s) => frame(0, s)), [0, 1, 2].map((s) => frame(1, s)), right.map(flip), right];
}

const coin = make(T, T, (r, e) => {
  e(C.yellowD, 8, 8.5, 5.5, 5.5);
  e(C.yellow, 8, 8, 5, 5);
  r(C.yellowD, 5, 6, 6, 1);
  r(C.yellowD, 5, 9, 6, 1);
  r(C.yellowD, 7, 6, 2, 6);
});

export { make, C, INK, human };

let cache = null;

export function art() {
  if (cache) return cache;
  cache = {
    grass: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => grassTile(100 + i)),
    path: [0, 1, 2].map((i) => speckled(200 + i, C.path, [C.pathD, '#dfc391'], 7)),
    pave: [0, 1, 2].map((i) => paveTile(300 + i)),
    road: [0, 1, 2].map((i) => speckled(400 + i, C.road, [C.roadD, C.roadL], 6)),
    water: [waterTile(0), waterTile(1), waterTile(2)],
    tree: [tree(1), tree(2), tree(3)],
    hedge,
    flowerbed,
    bench,
    lamp,
    bin,
    hydrant,
    busStop,
    vending: [vending(0), vending(1)],
    vendingSpot,
    tableSet,
    salesBooth,
    kiosk,
    ebike,
    cars: [car(C.blue, C.blueD), car(C.red, C.redD), car(C.cream, C.creamD), car(C.green, C.greenD)].map((c) => [c, flip(c)]),
    apartment,
    store,
    diner,
    teaShop,
    school,
    bunkHouse,
    coin,
    people: {
      player: human({ hair: '#3a2d2a', top: '#8a93a8', topD: '#6f778c', bottom: '#454a5c' }),
      chen: human({ hair: '#c9c9c9', top: '#f3efe6', topD: '#d8d2c4', bottom: '#5f8f6a', hat: '#d9b56a', shorts: true }),
      qiang: human({ hair: '#22202a', top: '#d2583f', topD: '#aa4331', bottom: '#3d3a4a', hat: '#d2583f' }),
      lili: human({ hair: '#5a3a2c', top: '#2f3550', topD: '#232842', bottom: '#2f3550' }),
      sales: human({ hair: '#22202a', top: '#f2c14e', topD: '#d19a2e', bottom: '#3d3a4a' }),
      guru: human({ hair: '#22202a', top: '#6b5a8e', topD: '#4f416d', bottom: '#2b2437' }),
      walkers: [
        human({ hair: '#7a3f2c', top: '#5fae6b', topD: '#458a52', bottom: '#4a5f86' }),
        human({ hair: '#22202a', top: '#ee9fb8', topD: '#d77b99', bottom: '#716e7a' }),
        human({ hair: '#b9b9b9', top: '#4c7fb5', topD: '#3a648f', bottom: '#5a5248' }),
      ],
    },
  };
  return cache;
}
