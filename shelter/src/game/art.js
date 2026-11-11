// 全部像素画都用代码画出来，不依赖外部图片。
export const T = 16;

const INK = '#2b2437'; // 描边色：偏紫的深色，比纯黑柔和

const C = {
  grass: '#74b356',
  grassD: '#62a04a',
  grassL: '#8cc66a',
  path: '#d2b17a',
  pathD: '#b99861',
  soil: '#a6744a',
  soilD: '#8a5c38',
  wet: '#6e4a31',
  wetD: '#5a3b27',
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
  skin: '#f1c7a0',
  skinD: '#d9a67e',
  rust: '#a5563a',
  green: '#5fae6b',
  glass: '#a9dcef',
  night: '#3b3550',
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
  const img = ctx.getImageData(0, 0, w, h);
  const src = img.data.slice();
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

// r(颜色, x, y, 宽, 高) 画矩形；e(颜色, 中心x, 中心y, 半径x, 半径y) 画实心椭圆。
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
  draw(r, e);
  return outline ? addOutline(c) : c;
}

function flip(src) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function dim(src, alpha = 0.45) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.globalAlpha = alpha;
  ctx.drawImage(src, 0, 0);
  return c;
}

/* ---------- 地面 ---------- */

function speckled(seed, base, dots, count, long = false) {
  return make(
    T,
    T,
    (r) => {
      const rnd = rng(seed);
      r(base, 0, 0, T, T);
      for (let i = 0; i < count; i++) {
        r(dots[i % dots.length], Math.floor(rnd() * 15), Math.floor(rnd() * 15), long && rnd() > 0.5 ? 2 : 1, 1);
      }
    },
    false,
  );
}

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

function soilTile(wet) {
  return make(
    T,
    T,
    (r) => {
      r(wet ? C.wet : C.soil, 0, 0, T, T);
      for (let y = 2; y < T; y += 4) r(wet ? C.wetD : C.soilD, 1, y, 14, 1);
      r(wet ? C.wetD : C.soilD, 0, 0, T, 1);
      r(wet ? C.wetD : C.soilD, 0, 0, 1, T);
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

function plankTile() {
  return make(
    T,
    T,
    (r) => {
      r(C.wood, 0, 0, T, T);
      r(C.woodD, 0, 7, T, 1);
      r(C.woodD, 0, 15, T, 1);
      r(C.woodD, 5, 0, 1, 7);
      r(C.woodD, 11, 8, 1, 7);
      r(C.woodL, 1, 2, 3, 1);
      r(C.woodL, 7, 10, 3, 1);
    },
    false,
  );
}

/* ---------- 植物和石头 ---------- */

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

const deadTree = make(32, 48, (r) => {
  r('#6d5a4c', 14, 16, 4, 30);
  r('#57463a', 14, 16, 1, 30);
  r('#6d5a4c', 8, 20, 6, 2);
  r('#6d5a4c', 8, 14, 2, 7);
  r('#6d5a4c', 18, 24, 7, 2);
  r('#6d5a4c', 23, 16, 2, 9);
  r('#6d5a4c', 15, 8, 2, 9);
  r('#6d5a4c', 11, 44, 10, 2);
});

const bush = (berries) =>
  make(T, T, (r, e) => {
    e(C.leafD, 8, 10, 7, 5);
    e(C.leaf, 8, 8, 6, 5);
    e(C.leafL, 6, 6, 2, 1.5);
    if (berries) {
      [
        [4, 9],
        [9, 7],
        [11, 11],
        [7, 12],
      ].forEach(([x, y]) => {
        r('#c8405a', x, y, 2, 2);
        r('#f08aa0', x, y, 1, 1);
      });
    }
  });

const mushroom = make(T, T, (r, e) => {
  r(C.cream, 7, 9, 3, 5);
  e('#c96a4a', 8.5, 8, 5, 3);
  r(C.white, 6, 6, 1, 1);
  r(C.white, 10, 7, 1, 1);
  r(C.cream, 3, 12, 2, 3);
  e('#c96a4a', 4, 11.5, 2.5, 1.5);
});

const rock = make(T, T, (r, e) => {
  e(C.stoneD, 8, 11, 6, 4);
  e(C.stone, 8, 9, 5, 4);
  r(C.stoneL, 5, 7, 3, 1);
  r(C.stoneD, 9, 11, 3, 1);
});

const fence = make(T, T, (r) => {
  r(C.woodL, 0, 6, T, 2);
  r(C.woodL, 0, 11, T, 2);
  r(C.wood, 3, 3, 3, 12);
  r(C.wood, 11, 3, 3, 12);
  r(C.woodD, 3, 13, 3, 2);
  r(C.woodD, 11, 13, 3, 2);
});

/* ---------- 建筑 ---------- */

function house(wall, wallD, roof, roofD, sign) {
  return make(64, 60, (r) => {
    // 屋顶
    for (let i = 0; i < 22; i++) {
      const inset = Math.max(0, 10 - i);
      r(i % 4 === 3 ? roofD : roof, 2 + inset, 4 + i, 60 - inset * 2, 1);
    }
    r(roofD, 2, 26, 60, 2);
    r(C.stoneD, 46, 2, 6, 8);
    r(C.stone, 46, 2, 6, 2);
    // 墙
    r(wall, 5, 28, 54, 30);
    for (let x = 9; x < 58; x += 5) r(wallD, x, 28, 1, 30);
    r(wallD, 5, 56, 54, 2);
    // 门
    r(C.woodD, 26, 38, 12, 20);
    r(C.wood, 28, 40, 8, 18);
    r(C.yellow, 34, 49, 1, 2);
    // 窗
    for (const x of [10, 44]) {
      r(C.woodD, x, 36, 11, 10);
      r(C.glass, x + 1, 37, 9, 8);
      r(C.white, x + 2, 38, 3, 2);
      r(C.woodD, x + 5, 37, 1, 8);
    }
    if (sign) sign(r);
  });
}

const shack = house(C.tin, C.tinD, C.rust, '#8a4530');
const office = house(C.cream, '#cdbf9f', C.green, '#4a9057', (r) => {
  r(C.woodD, 22, 30, 20, 7);
  r(C.yellow, 24, 32, 16, 3);
});

const stall = make(48, 44, (r) => {
  for (let x = 0; x < 48; x += 8) {
    r(C.red, x, 2, 4, 12);
    r(C.white, x + 4, 2, 4, 12);
  }
  r(C.redD, 0, 12, 48, 2);
  r(C.woodD, 3, 14, 3, 14);
  r(C.woodD, 42, 14, 3, 14);
  r(C.wood, 1, 26, 46, 16);
  r(C.woodL, 1, 26, 46, 3);
  r(C.woodD, 1, 39, 46, 3);
  // 货
  r('#c8405a', 6, 20, 5, 6);
  r(C.green, 13, 21, 5, 5);
  r(C.yellow, 20, 20, 4, 6);
  r(C.tin, 27, 19, 4, 7);
  r(C.tinD, 27, 21, 4, 1);
  r(C.blue, 34, 21, 6, 5);
});

const teaCart = make(32, 40, (r) => {
  r(C.pink, 1, 2, 30, 8);
  for (let x = 1; x < 31; x += 6) r(C.white, x, 2, 3, 8);
  r(C.pinkD, 1, 9, 30, 2);
  r(C.woodD, 3, 11, 2, 12);
  r(C.woodD, 27, 11, 2, 12);
  r(C.cream, 2, 22, 28, 12);
  r(C.pinkD, 2, 22, 28, 2);
  r(C.white, 12, 14, 7, 8);
  r('#c79a6b', 13, 17, 5, 5);
  r(C.purpleD, 15, 11, 1, 4);
  r(C.night, 5, 34, 5, 5);
  r(C.night, 22, 34, 5, 5);
  r(C.stone, 6, 36, 3, 2);
  r(C.stone, 23, 36, 3, 2);
});

const loanBooth = make(32, 44, (r) => {
  r(C.purpleD, 2, 2, 28, 8);
  r(C.yellow, 12, 3, 8, 6);
  r(C.yellowD, 15, 4, 2, 4);
  r(C.purple, 3, 10, 26, 32);
  r(C.purpleD, 3, 10, 26, 2);
  r(C.night, 8, 16, 16, 10);
  r(C.glass, 9, 17, 14, 8);
  r(C.purpleD, 6, 28, 20, 3);
  r(C.yellow, 13, 33, 6, 6);
  r(C.yellowD, 15, 35, 2, 2);
});

const well = make(T, 28, (r, e) => {
  r(C.woodD, 2, 2, 2, 14);
  r(C.woodD, 12, 2, 2, 14);
  r(C.red, 0, 0, T, 4);
  r(C.redD, 0, 3, T, 1);
  e(C.stoneD, 8, 21, 7, 5);
  e(C.stone, 8, 19, 7, 4);
  e(C.waterD, 8, 19, 4, 2);
  r(C.stoneL, 3, 17, 3, 1);
});

const board = make(32, 28, (r) => {
  r(C.woodD, 4, 14, 3, 14);
  r(C.woodD, 25, 14, 3, 14);
  r(C.wood, 1, 2, 30, 16);
  r(C.woodL, 1, 2, 30, 2);
  r(C.white, 4, 6, 8, 9);
  r(C.yellow, 14, 6, 6, 6);
  r(C.pink, 22, 7, 6, 8);
  r(C.red, 7, 6, 1, 1);
  r(C.red, 16, 6, 1, 1);
});

const hammock = make(32, 20, (r) => {
  r(C.woodD, 1, 2, 3, 18);
  r(C.woodD, 28, 2, 3, 18);
  for (let x = 4; x < 28; x++) {
    const sag = Math.round(5 * Math.sin(((x - 4) / 24) * Math.PI));
    r(x % 4 < 2 ? C.blue : C.white, x, 5 + sag, 1, 4);
  }
});

const lamp = make(T, 32, (r) => {
  r(C.night, 7, 8, 2, 22);
  r(C.night, 5, 29, 6, 2);
  r(C.night, 4, 2, 8, 2);
  r(C.yellow, 5, 4, 6, 5);
  r(C.white, 6, 5, 2, 2);
});

const sign = make(T, 20, (r) => {
  r(C.woodD, 7, 8, 2, 12);
  r(C.wood, 1, 1, 14, 9);
  r(C.woodL, 1, 1, 14, 2);
  r(C.woodD, 4, 5, 8, 1);
  r(C.woodD, 4, 7, 5, 1);
});

/* ---------- 院子里的设备 ---------- */

const pad = make(
  32,
  32,
  (r) => {
    for (let i = 3; i < 29; i += 6) {
      r(C.cream, i, 2, 3, 1);
      r(C.cream, i, 29, 3, 1);
      r(C.cream, 2, i, 1, 3);
      r(C.cream, 29, i, 1, 3);
    }
    r(C.cream, 15, 12, 2, 8);
    r(C.cream, 12, 15, 8, 2);
  },
  false,
);

const assetArt = {
  rain: (f) =>
    make(32, 36, (r, e) => {
      r(C.tinD, 4, 2, 24, 3);
      r(C.tin, 6, 5, 20, 2);
      r(C.tin, 10, 7, 12, 2);
      r(C.tinD, 14, 9, 4, 4);
      r(C.blue, 7, 13, 18, 20);
      r(C.blueD, 7, 13, 3, 20);
      r(C.tin, 7, 17, 18, 2);
      r(C.tin, 7, 27, 18, 2);
      e(C.waterL, 16, 13, 8, 2);
      r(C.white, 13 + f * 4, 12, 2, 1);
    }),
  coop: (f) =>
    make(32, 36, (r) => {
      for (let i = 0; i < 10; i++) r(i % 3 === 2 ? C.redD : C.red, 2 + i, 12 - i, 28 - i * 2, 1);
      r(C.redD, 2, 13, 28, 2);
      r(C.wood, 4, 15, 24, 18);
      r(C.woodD, 4, 31, 24, 2);
      r(C.night, 12, 21, 8, 12);
      // 鸡
      const x = 20 + f * 2;
      r(C.white, x, 26, 6, 5);
      r(C.white, x + 4, 23, 3, 4);
      r(C.red, x + 5, 22, 2, 1);
      r(C.yellow, x + 7, 25, 1, 1);
      r(C.yellowD, x + 1, 31, 1, 2);
      r(C.yellowD, x + 4, 31, 1, 2);
    }),
  solar: (f) =>
    make(32, 36, (r) => {
      r(C.blueD, 2, 4, 28, 16);
      for (let x = 2; x < 30; x += 7) r(C.glass, x, 4, 1, 16);
      r(C.glass, 2, 11, 28, 1);
      r(C.white, 5 + f * 14, 6, 4, 2);
      r(C.night, 14, 20, 4, 6);
      r(C.tinD, 6, 26, 20, 8);
      r(C.tin, 6, 26, 20, 2);
      r(f ? C.yellow : C.green, 9, 29, 3, 3);
      r(C.green, 14, 29, 3, 3);
      r(C.green, 19, 29, 3, 3);
    }),
  vending: (f) =>
    make(32, 40, (r) => {
      r(C.red, 6, 2, 20, 36);
      r(C.redD, 6, 2, 3, 36);
      r(C.night, 10, 5, 12, 18);
      for (let y = 6; y < 22; y += 6) {
        r(C.yellow, 11, y, 2, 4);
        r(C.blue, 14, y, 2, 4);
        r(C.green, 17, y, 2, 4);
        r(C.white, 20, y, 1, 4);
      }
      r(f ? C.yellow : C.white, 22, 25, 2, 3);
      r(C.night, 10, 30, 12, 5);
      r(C.tinD, 11, 31, 10, 3);
    }),
};

/* ---------- 废墟 ---------- */

const ruinWall = make(T, 32, (r) => {
  r('#8b9194', 1, 6, 14, 25);
  for (let y = 10; y < 30; y += 5) r('#70777b', 1, y, 14, 1);
  r('#70777b', 6, 6, 1, 4);
  r('#70777b', 11, 11, 1, 4);
  r('#8b9194', 1, 2, 4, 5);
  r('#8b9194', 9, 4, 4, 3);
  r(C.night, 5, 17, 6, 8);
});

const crate = make(T, T, (r) => {
  r(C.wood, 2, 3, 12, 11);
  r(C.woodD, 2, 3, 12, 2);
  r(C.woodD, 2, 12, 12, 2);
  r(C.woodD, 2, 3, 2, 11);
  r(C.woodD, 12, 3, 2, 11);
  r(C.yellow, 7, 7, 2, 3);
});

const car = make(32, 22, (r) => {
  r(C.rust, 2, 9, 28, 9);
  r('#8a4530', 2, 15, 28, 3);
  r(C.rust, 8, 2, 14, 8);
  r(C.glass, 10, 4, 5, 5);
  r('#84b5c6', 16, 4, 4, 5);
  r(C.yellowD, 3, 11, 2, 2);
  r(C.night, 5, 16, 6, 5);
  r(C.night, 21, 16, 6, 5);
  r(C.stone, 7, 18, 2, 2);
  r(C.stone, 23, 18, 2, 2);
});

const fridge = make(T, 26, (r) => {
  r(C.white, 2, 1, 12, 23);
  r(C.cream, 2, 1, 2, 23);
  r(C.tinD, 2, 9, 12, 1);
  r(C.tinD, 11, 4, 1, 3);
  r(C.tinD, 11, 12, 1, 5);
  r(C.rust, 4, 19, 3, 2);
  r(C.night, 3, 24, 2, 2);
  r(C.night, 11, 24, 2, 2);
});

/* ---------- 屋里 ---------- */

const bed = make(T, 32, (r) => {
  r(C.woodD, 1, 1, 14, 30);
  r(C.white, 3, 4, 10, 7);
  r(C.cream, 3, 9, 10, 2);
  r(C.blue, 3, 12, 10, 17);
  r(C.blueD, 3, 12, 10, 2);
  r('#6f9bc8', 5, 18, 6, 1);
  r('#6f9bc8', 5, 23, 6, 1);
});

const tv = (f) =>
  make(32, 28, (r) => {
    r(C.woodD, 2, 16, 28, 10);
    r(C.wood, 2, 16, 28, 2);
    r(C.night, 6, 1, 20, 15);
    r(f ? '#7fd0a8' : '#6dbbe6', 8, 3, 16, 11);
    r(C.white, 10 + f * 6, 5, 3, 3);
    r(C.yellow, 16 - f * 4, 9, 4, 3);
    r(C.tinD, 5, 20, 8, 4);
    r(C.red, 7, 21, 1, 1);
    r(C.tinD, 19, 20, 8, 4);
  });

const tvStand = make(32, 28, (r) => {
  r(C.woodD, 2, 16, 28, 10);
  r(C.wood, 2, 16, 28, 2);
  r(C.cream, 12, 10, 8, 6);
  r(C.green, 14, 5, 4, 6);
  r(C.leafL, 12, 3, 3, 3);
  r(C.leafL, 18, 4, 3, 3);
});

const rug = make(
  32,
  T,
  (r) => {
    r(C.redD, 1, 1, 30, 14);
    r(C.red, 3, 3, 26, 10);
    r(C.yellow, 6, 6, 20, 1);
    r(C.yellow, 6, 9, 20, 1);
  },
  false,
);

const wallTile = make(
  T,
  T,
  (r) => {
    r(C.cream, 0, 0, T, T);
    r('#d1c4a8', 0, 12, T, 4);
    r('#d1c4a8', 7, 0, 1, 12);
    r(C.woodD, 0, 15, T, 1);
  },
  false,
);

const roofTile = make(
  T,
  T,
  (r) => {
    r('#3a3346', 0, 0, T, T);
    r('#322c3d', 0, 7, T, 1);
    r('#322c3d', 0, 15, T, 1);
    r('#322c3d', 4, 0, 1, 7);
    r('#322c3d', 12, 8, 1, 7);
  },
  false,
);

const windowArt = make(T, T, (r) => {
  r(C.woodD, 2, 2, 12, 11);
  r(C.glass, 3, 3, 10, 9);
  r(C.white, 4, 4, 3, 2);
  r(C.woodD, 7, 3, 1, 9);
});

const mat = make(
  T,
  T,
  (r) => {
    r(C.yellowD, 2, 6, 12, 8);
    r(C.yellow, 3, 7, 10, 6);
  },
  false,
);

const bike = make(T, T, (r) => {
  r(C.night, 1, 9, 5, 5);
  r(C.night, 10, 9, 5, 5);
  r(C.stone, 3, 11, 1, 1);
  r(C.stone, 12, 11, 1, 1);
  r(C.green, 4, 7, 9, 2);
  r(C.green, 10, 4, 2, 5);
  r(C.night, 9, 3, 4, 1);
  r(C.night, 3, 5, 4, 2);
});

/* ---------- 作物 ---------- */

function crop(kind, stage) {
  return make(T, T, (r, e) => {
    if (stage === 0) {
      r(C.leafL, 7, 10, 1, 3);
      r(C.leafL, 6, 9, 1, 1);
      r(C.leafL, 8, 9, 1, 1);
      return;
    }
    if (stage === 1) {
      r(C.leaf, 7, 7, 2, 6);
      r(C.leafL, 4, 8, 3, 2);
      r(C.leafL, 9, 6, 3, 2);
      return;
    }
    if (kind === 'cabbage') {
      e(C.leafD, 8, 10, 6, 4);
      e(stage === 3 ? '#9fd67a' : C.leaf, 8, 8.5, 5, 4);
      if (stage === 3) e('#c5ec9f', 7.5, 7.5, 2.5, 2);
    } else if (kind === 'potato') {
      e(C.leafD, 8, 9, 6, 4);
      e(C.leaf, 8, 7, 5, 3);
      r(C.leafL, 5, 5, 2, 1);
      if (stage === 3) {
        e('#c9a06a', 4.5, 12.5, 2.5, 1.8);
        e('#c9a06a', 11.5, 12.5, 2.5, 1.8);
      }
    } else {
      r(C.woodD, 8, 2, 1, 12);
      e(C.leafD, 8, 9, 5, 5);
      e(C.leaf, 8, 7, 4, 4);
      if (stage === 3) {
        [
          [4, 8],
          [10, 6],
          [9, 11],
        ].forEach(([x, y]) => {
          r('#e0503c', x, y, 3, 3);
          r('#f58a72', x, y, 1, 1);
        });
      }
    }
  });
}

/* ---------- 物品图标 ---------- */

const icons = {
  hoe: make(T, T, (r) => {
    for (let i = 0; i < 10; i++) r(C.wood, 4 + i, 13 - i, 2, 1);
    r(C.tin, 9, 2, 5, 2);
    r(C.tinD, 9, 4, 2, 3);
  }),
  can: make(T, T, (r) => {
    r(C.blue, 4, 6, 8, 8);
    r(C.blueD, 4, 12, 8, 2);
    r(C.blue, 12, 7, 3, 2);
    r(C.blue, 13, 5, 2, 2);
    r(C.blueD, 2, 7, 2, 5);
    r(C.waterL, 5, 6, 6, 1);
  }),
  rod: make(T, T, (r) => {
    for (let i = 0; i < 12; i++) r(C.woodD, 2 + i, 13 - i, 1, 2);
    r(C.white, 13, 2, 1, 8);
    r(C.red, 12, 10, 3, 2);
  }),
  seedCabbage: seedBag('#9fd67a'),
  seedPotato: seedBag('#c9a06a'),
  seedTomato: seedBag('#e0503c'),
  cabbage: make(T, T, (r, e) => {
    e(C.leafD, 8, 9, 6, 5);
    e('#9fd67a', 8, 8, 5, 4);
    e('#c5ec9f', 7, 7, 2.5, 2);
  }),
  potato: make(T, T, (r, e) => {
    e('#b88c58', 8, 9, 6, 4.5);
    e('#c9a06a', 7.5, 8, 5, 3.5);
    r('#9a7445', 5, 8, 1, 1);
    r('#9a7445', 10, 10, 1, 1);
  }),
  tomato: make(T, T, (r, e) => {
    e('#c8402e', 8, 9.5, 5.5, 5);
    e('#e0503c', 7.5, 9, 4.5, 4);
    r('#f58a72', 5, 7, 2, 1);
    r(C.leaf, 6, 3, 5, 2);
    r(C.leaf, 8, 2, 1, 2);
  }),
  tin: make(T, T, (r) => {
    r(C.tin, 4, 3, 8, 11);
    r(C.tinD, 4, 3, 8, 2);
    r(C.tinD, 4, 12, 8, 2);
    r(C.red, 4, 6, 8, 5);
    r(C.white, 6, 8, 4, 1);
  }),
  scrap: make(T, T, (r) => {
    r(C.tinD, 3, 8, 7, 5);
    r(C.tin, 6, 4, 6, 6);
    r(C.rust, 9, 9, 4, 4);
    r(C.night, 8, 6, 2, 2);
  }),
  battery: make(T, T, (r) => {
    r(C.night, 5, 4, 7, 10);
    r(C.yellow, 5, 4, 7, 4);
    r(C.tin, 7, 2, 3, 2);
    r(C.white, 8, 9, 1, 3);
    r(C.white, 7, 10, 3, 1);
  }),
  berry: make(T, T, (r, e) => {
    e('#c8405a', 6, 10, 3, 3);
    e('#c8405a', 11, 9, 2.5, 2.5);
    r('#f08aa0', 5, 8, 1, 1);
    r(C.leaf, 7, 4, 4, 2);
    r(C.leafD, 8, 5, 1, 3);
  }),
  mushroom: mushroom,
  fish: make(T, T, (r, e) => {
    e(C.blueD, 7, 9, 5.5, 3.5);
    e('#6fa3d6', 7, 8, 4.5, 2.5);
    r(C.blueD, 12, 6, 3, 2);
    r(C.blueD, 12, 10, 3, 2);
    r(C.white, 4, 8, 1, 1);
  }),
  tea: make(T, T, (r) => {
    r(C.white, 5, 5, 6, 9);
    r('#c79a6b', 6, 8, 4, 6);
    r(C.night, 6, 12, 1, 1);
    r(C.night, 8, 13, 1, 1);
    r(C.pink, 4, 4, 8, 2);
    r(C.purpleD, 9, 1, 1, 4);
  }),
  coin: make(T, T, (r, e) => {
    e(C.yellowD, 8, 8.5, 5.5, 5.5);
    e(C.yellow, 8, 8, 5, 5);
    r(C.yellowD, 7, 5, 2, 6);
    r(C.white, 5, 5, 1, 2);
  }),
};

function seedBag(color) {
  return make(T, T, (r) => {
    r(C.cream, 4, 4, 8, 10);
    r('#cdbf9f', 4, 12, 8, 2);
    r(C.woodD, 5, 3, 6, 1);
    r(color, 6, 7, 4, 4);
  });
}

/* ---------- 人物 ---------- */

// 生成一个角色的全部帧：[朝向][帧]，朝向 0 下 1 上 2 左 3 右，帧 0 站立 1/2 迈步。
function human({ hair, top, topD, bottom, skin = C.skin, hat }) {
  const frame = (dir, step) =>
    make(T, 22, (r) => {
      const bob = step ? 1 : 0;
      // 腿
      const lx = step === 1 ? -1 : 0;
      const rx = step === 2 ? 1 : 0;
      if (dir < 2) {
        r(bottom, 5, 16, 2, step === 1 ? 3 : 4);
        r(bottom, 9, 16, 2, step === 2 ? 3 : 4);
        r(INK, 5, step === 1 ? 19 : 20, 2, 1);
        r(INK, 9, step === 2 ? 19 : 20, 2, 1);
      } else {
        r(bottom, 6 + lx * 2, 16, 2, 4);
        r(bottom, 8 + rx * 2, 16, 2, 4);
        r(INK, 6 + lx * 2, 20, 2, 1);
        r(INK, 8 + rx * 2, 20, 2, 1);
      }
      // 身体
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
      // 头
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
        if (dir === 0) r(hat, 3, 4 + bob, 10, 1);
      }
    });
  const right = [0, 1, 2].map((s) => frame(3, s));
  return [[0, 1, 2].map((s) => frame(0, s)), [0, 1, 2].map((s) => frame(1, s)), right.map(flip), right];
}

function dog(step) {
  return make(18, 14, (r) => {
    r('#7a6252', 2, 5, 11, 5);
    r('#63503f', 2, 9, 11, 1);
    r('#7a6252', 11, 2, 5, 6);
    r('#7a6252', 11, 0, 2, 2);
    r('#7a6252', 14, 0, 2, 2);
    r(INK, 14, 4, 1, 1);
    r(C.white, 15, 6, 2, 1);
    r('#7a6252', 0, 3, 2, 3);
    const a = step ? 0 : 1;
    r('#63503f', 3 + a, 10, 2, 3);
    r('#63503f', 10 - a, 10, 2, 3);
  });
}

let cache = null;

export function art() {
  if (cache) return cache;
  const d = [dog(0), dog(1)];
  const crops = {};
  for (const kind of ['cabbage', 'potato', 'tomato']) crops[kind] = [0, 1, 2, 3].map((s) => crop(kind, s));
  cache = {
    grass: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => grassTile(100 + i)),
    path: [0, 1, 2].map((i) => speckled(200 + i, C.path, [C.pathD, '#dfc391'], 7, true)),
    concrete: [0, 1, 2].map((i) => speckled(300 + i, C.stone, [C.stoneD, C.stoneL], 6, true)),
    soil: [soilTile(false), soilTile(true)],
    water: [waterTile(0), waterTile(1), waterTile(2)],
    plank: plankTile(),
    wall: wallTile,
    roof: roofTile,
    tree: [tree(1), tree(2), tree(3)],
    deadTree,
    bush: [bush(false), bush(true)],
    mushroom,
    rock,
    fence,
    shack,
    office,
    stall,
    teaCart,
    loanBooth,
    well,
    board,
    hammock,
    lamp,
    sign,
    pad,
    asset: Object.fromEntries(Object.entries(assetArt).map(([id, f]) => [id, [f(0), f(1)]])),
    ruinWall,
    node: { crate: [crate, dim(crate)], car: [car, dim(car)], fridge: [fridge, dim(fridge)] },
    bed,
    tv: [tv(0), tv(1)],
    tvStand,
    rug,
    window: windowArt,
    mat,
    bike,
    crops,
    icons,
    people: {
      player: human({ hair: '#3a2d2a', top: '#e8b54a', topD: '#c8922f', bottom: '#4a5f86' }),
      zhou: human({ hair: '#b9b9b9', top: '#5f8f6a', topD: '#4a7355', bottom: '#5a5248', hat: '#4a7355' }),
      mei: human({ hair: '#7a3f2c', top: '#d2583f', topD: '#aa4331', bottom: '#3d3a4a' }),
      jin: human({ hair: '#22202a', top: '#4f416d', topD: '#3b3052', bottom: '#22202a' }),
      tea: human({ hair: '#e7a8c0', top: '#f3efe6', topD: '#d8d2c4', bottom: '#d77b99' }),
    },
    dogR: d,
    dogL: d.map(flip),
  };
  return cache;
}
