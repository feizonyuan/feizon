// 全部像素画都在这里用代码画出来，不依赖任何外部图片。
export const T = 16;

const PAL = {
  k: '#14181c',
  s: '#eab88f',
  h: '#3a2a22',
  y: '#f6b445',
  o: '#c4842c',
  b: '#3f5d82',
  w: '#e7eeec',
  g: '#93a4a6',
  d: '#4b5b61',
  r: '#e86a55',
  n: '#8a6540',
  m: '#57402b',
  G: '#7ed6a0',
  e: '#3f8f63',
  c: '#8fd0ea',
  p: '#e993bd',
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// 把字符网格画成精灵。每个字符是一个像素，'.' 为透明。
function grid(rows) {
  const [c, ctx] = canvas(T, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length && x < T; x++) {
      const color = PAL[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

function flip(src) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function paint(w, h, draw) {
  const [c, ctx] = canvas(w, h);
  const r = (color, x, y, rw = 1, rh = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, rw, rh);
  };
  draw(r, ctx);
  return c;
}

// 固定种子的小随机数，让地面的碎点每次都一样。
function speckle(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function person(hair, coat, shade, step) {
  const legs = step
    ? ['....kbbkkbbk....', '....kbbk.kkk....', '....kkk.........']
    : ['....kbbkkbbk....', '....kbbkkbbk....', '....kkk..kkk....'];
  return grid(
    [
      '................',
      '.....kkkkkk.....',
      '....kHHHHHHk....',
      '....kHHHHHHk....',
      '....kHssssHk....',
      '....kskssksk....',
      '....kssssssk....',
      '.....kkkkkk.....',
      '....kCCCCCCk....',
      '...kCCDCCDCCk...',
      '...ksCCCCCCsk...',
      '...kkCCCCCCkk...',
      '....kCCCCCCk....',
      ...legs,
    ].map((row) => row.replaceAll('H', hair).replaceAll('C', coat).replaceAll('D', shade)),
  );
}

function dog(step) {
  return grid([
    '................',
    '................',
    '................',
    '..........kk.kk.',
    '.........kmmkmmk',
    '.k.......kmmmmmk',
    'kmk.....kmmkrmmk',
    'kmkkkkkkkmmmmwwk',
    '.kmmmmmmmmmmmkk.',
    '.kmmmmmmmmmmk...',
    '.kmmmmmmmmmmk...',
    step ? '.kmkkmkkkmkkmk..' : '.kmmkkkkkkmmk...',
    step ? '.kmk.kmk.kmkkmk.' : '..kmk....kmk....',
    step ? '.kk...kk..kk.kk.' : '..kk.....kk.....',
    '................',
    '................',
  ]);
}

const crate = grid([
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '..knnnnnnnnnnk..',
  '..knmmmmmmmmnk..',
  '..knmnnnnnnmnk..',
  '..knmnnyynnmnk..',
  '..knmnnyynnmnk..',
  '..knmnnnnnnmnk..',
  '..knmmmmmmmmnk..',
  '..knnnnnnnnnnk..',
  '..kkkkkkkkkkkk..',
  '...kk......kk...',
  '................',
  '................',
  '................',
]);

const car = paint(T, T, (r) => {
  r('#14181c', 1, 6, 14, 7);
  r('#a34b3c', 2, 7, 12, 5);
  r('#7c382d', 2, 10, 12, 2);
  r('#14181c', 4, 3, 8, 4);
  r('#8fd0ea', 5, 4, 3, 3);
  r('#5d8ea3', 9, 4, 2, 3);
  r('#c4842c', 3, 8, 2, 1);
  r('#57402b', 7, 8, 3, 1);
  r('#14181c', 3, 12, 3, 3);
  r('#14181c', 10, 12, 3, 3);
  r('#4b5b61', 4, 13, 1, 1);
  r('#4b5b61', 11, 13, 1, 1);
});

const container = paint(T, T, (r) => {
  r('#14181c', 1, 3, 14, 12);
  r('#3f5d82', 2, 4, 12, 10);
  for (let x = 3; x < 14; x += 2) r('#2f4868', x, 4, 1, 10);
  r('#f6b445', 6, 7, 4, 4);
  r('#14181c', 7, 8, 2, 2);
  r('#93a4a6', 2, 4, 12, 1);
});

function ground(seed, base, dots) {
  return paint(T, T, (r) => {
    const rnd = speckle(seed);
    r(base, 0, 0, T, T);
    for (let i = 0; i < 9; i++) r(dots[i % dots.length], Math.floor(rnd() * T), Math.floor(rnd() * T), 1 + (rnd() > 0.7), 1);
  });
}

const rubble = paint(T, T, (r) => {
  r('#14181c', 2, 7, 12, 8);
  r('#6f7c7f', 3, 8, 6, 6);
  r('#93a4a6', 3, 8, 6, 1);
  r('#4b5b61', 9, 10, 4, 4);
  r('#6f7c7f', 9, 10, 4, 1);
  r('#14181c', 6, 4, 6, 4);
  r('#86959a', 7, 5, 4, 3);
});

const tree = paint(T, T * 2, (r) => {
  r('#14181c', 6, 14, 4, 17);
  r('#57402b', 7, 14, 2, 16);
  r('#14181c', 2, 8, 5, 2);
  r('#57402b', 3, 9, 4, 1);
  r('#14181c', 9, 5, 5, 2);
  r('#57402b', 9, 6, 4, 1);
  r('#14181c', 4, 2, 2, 8);
  r('#57402b', 5, 3, 1, 12);
  r('#14181c', 10, 3, 2, 11);
  r('#57402b', 10, 4, 1, 11);
  r('#14181c', 7, 1, 2, 14);
  r('#57402b', 8, 2, 1, 12);
});

const ruin = paint(T, T * 2, (r) => {
  r('#14181c', 0, 6, T, 26);
  r('#5c686b', 1, 7, 14, 24);
  for (let y = 9; y < 31; y += 5) r('#454f52', 1, y, 14, 1);
  for (let y = 7; y < 31; y += 10) {
    r('#454f52', 5, y, 1, 3);
    r('#454f52', 11, y + 5, 1, 3);
  }
  r('#14181c', 0, 2, 5, 5);
  r('#5c686b', 1, 3, 3, 4);
  r('#14181c', 9, 4, 4, 3);
  r('#5c686b', 10, 5, 2, 2);
  r('#14181c', 5, 16, 6, 8);
  r('#22292c', 6, 17, 4, 7);
});

const hatch = paint(T * 2, T * 2, (r) => {
  r('#14181c', 2, 4, 28, 27);
  r('#4b5b61', 3, 5, 26, 25);
  r('#6f7c7f', 3, 5, 26, 2);
  r('#14181c', 8, 10, 16, 20);
  r('#22292c', 9, 11, 14, 19);
  r('#f6b445', 9, 11, 14, 2);
  for (let x = 9; x < 23; x += 4) r('#14181c', x, 11, 2, 2);
  r('#93a4a6', 20, 20, 2, 3);
  r('#e86a55', 14, 1, 4, 3);
  r('#14181c', 13, 0, 6, 1);
});

/* ---------- 避难所内部 ---------- */

const floor = (seed) =>
  paint(T, T, (r) => {
    const rnd = speckle(seed);
    r('#26343a', 0, 0, T, T);
    r('#2c3c43', 1, 1, 14, 14);
    r('#22302f', 0, 15, T, 1);
    r('#22302f', 15, 0, 1, T);
    if (rnd() > 0.5) r('#34464d', 3 + Math.floor(rnd() * 8), 3 + Math.floor(rnd() * 8), 2, 1);
  });

const wallTop = paint(T, T, (r) => {
  r('#0d1214', 0, 0, T, T);
  r('#161d20', 0, 13, T, 3);
});

const wallFace = paint(T, T, (r) => {
  r('#3a4b52', 0, 0, T, T);
  r('#44575f', 0, 0, T, 2);
  r('#2c3a40', 0, 13, T, 3);
  r('#2c3a40', 7, 2, 1, 11);
  r('#4f646d', 2, 5, 1, 1);
  r('#4f646d', 12, 9, 1, 1);
});

const stripe = paint(T, T, (r) => {
  r('#3a4b52', 0, 0, T, T);
  for (let i = -T; i < T; i += 6) {
    for (let y = 0; y < 4; y++) r('#f6b445', i + y + 6, 12 + y, 3, 1);
  }
  r('#2c3a40', 0, 11, T, 1);
});

const bed = paint(T, T * 2, (r) => {
  r('#14181c', 1, 2, 14, 29);
  r('#57402b', 2, 3, 12, 27);
  r('#e7eeec', 3, 5, 10, 7);
  r('#c9d3d2', 3, 10, 10, 2);
  r('#3f5d82', 3, 13, 10, 16);
  r('#2f4868', 3, 13, 10, 2);
  r('#4f73a0', 5, 18, 6, 1);
  r('#4f73a0', 5, 23, 6, 1);
});

const radio = paint(T, T * 2, (r) => {
  r('#14181c', 0, 14, T, 17);
  r('#57402b', 1, 15, 14, 5);
  r('#8a6540', 1, 15, 14, 1);
  r('#3d2e1f', 2, 20, 2, 10);
  r('#3d2e1f', 12, 20, 2, 10);
  r('#14181c', 3, 5, 10, 10);
  r('#4b5b61', 4, 6, 8, 8);
  r('#7ed6a0', 5, 7, 4, 3);
  r('#f6b445', 10, 8, 1, 1);
  r('#e86a55', 10, 11, 1, 1);
  r('#93a4a6', 5, 11, 4, 2);
  r('#14181c', 11, 0, 1, 6);
});

const ladder = paint(T, T * 2, (r) => {
  r('#0d1214', 2, 0, 12, 30);
  r('#1b2428', 3, 0, 10, 29);
  r('#93a4a6', 4, 0, 1, 31);
  r('#93a4a6', 11, 0, 1, 31);
  for (let y = 3; y < 30; y += 5) r('#c9d3d2', 4, y, 8, 1);
  r('#f6b445', 2, 30, 12, 2);
});

function stock(level) {
  return paint(T * 2, T * 2, (r) => {
    const box = (x, y) => {
      r('#14181c', x, y, 10, 9);
      r('#8a6540', x + 1, y + 1, 8, 7);
      r('#57402b', x + 1, y + 4, 8, 1);
      r('#f6b445', x + 4, y + 2, 2, 1);
    };
    r('#1b2428', 1, 27, 30, 4);
    const spots = [
      [2, 20],
      [11, 20],
      [20, 20],
      [6, 12],
      [15, 12],
      [11, 4],
    ];
    spots.slice(0, level).forEach(([x, y]) => box(x, y));
  });
}

const pad = paint(T * 2, T * 2, (r) => {
  const c = '#51666e';
  for (let i = 2; i < 30; i += 5) {
    r(c, i, 2, 3, 1);
    r(c, i, 29, 3, 1);
    r(c, 2, i, 1, 3);
    r(c, 29, i, 1, 3);
  }
  r('#f6b445', 15, 12, 2, 8);
  r('#f6b445', 12, 15, 8, 2);
});

const facility = {
  farm: (f) =>
    paint(T * 2, T * 2, (r) => {
      r('#14181c', 2, 2, 28, 29);
      r('#33444b', 3, 3, 26, 27);
      for (let i = 0; i < 3; i++) {
        const y = 5 + i * 9;
        r('#8fd0ea', 4, y + 5, 24, 2);
        r('#5d8ea3', 4, y + 6, 24, 1);
        for (let x = 5; x < 27; x += 5) {
          const tall = (x + i + f) % 2;
          r('#3f8f63', x + 1, y + 2 - tall, 1, 3 + tall);
          r('#7ed6a0', x, y + 1 - tall, 3, 2);
          r('#7ed6a0', x + 1, y - tall, 1, 1);
        }
      }
      r('#93a4a6', 3, 3, 1, 27);
      r('#93a4a6', 28, 3, 1, 27);
    }),
  purifier: (f) =>
    paint(T * 2, T * 2, (r) => {
      r('#14181c', 7, 2, 18, 29);
      r('#4b5b61', 8, 3, 16, 27);
      r('#93a4a6', 8, 3, 16, 2);
      r('#14181c', 10, 8, 12, 15);
      r('#5d8ea3', 11, 9, 10, 13);
      r('#8fd0ea', 11, 11 + f * 2, 10, 11 - f * 2);
      r('#e7eeec', 13 + f * 3, 15, 1, 1);
      r('#e7eeec', 17 - f * 2, 19, 1, 1);
      r('#14181c', 2, 20, 6, 4);
      r('#93a4a6', 3, 21, 5, 2);
      r('#14181c', 24, 12, 6, 4);
      r('#93a4a6', 24, 13, 5, 2);
      r('#f6b445', 12, 25, 3, 2);
      r('#7ed6a0', 17, 25, 3, 2);
    }),
  solar: (f) =>
    paint(T * 2, T * 2, (r) => {
      r('#14181c', 2, 3, 28, 15);
      r('#2f4868', 3, 4, 26, 13);
      for (let x = 3; x < 29; x += 7) r('#8fd0ea', x, 4, 1, 13);
      r('#8fd0ea', 3, 10, 26, 1);
      r(f ? '#e7eeec' : '#8fd0ea', 6 + f * 12, 6, 3, 2);
      r('#14181c', 14, 18, 4, 4);
      r('#14181c', 5, 21, 22, 10);
      r('#4b5b61', 6, 22, 20, 8);
      r('#f6b445', 9, 24, 3, 4);
      r('#f6b445', 14, 24, 3, 4);
      r(f ? '#f6b445' : '#c4842c', 19, 24, 3, 4);
    }),
  tradepost: () =>
    paint(T * 2, T * 2, (r) => {
      r('#14181c', 1, 3, 30, 9);
      for (let x = 2; x < 30; x += 7) {
        r('#f6b445', x, 4, 4, 7);
        r('#e7eeec', x + 4, 4, 3, 7);
      }
      r('#14181c', 4, 12, 2, 8);
      r('#14181c', 26, 12, 2, 8);
      r('#14181c', 2, 19, 28, 12);
      r('#8a6540', 3, 20, 26, 10);
      r('#57402b', 3, 23, 26, 1);
      r('#14181c', 8, 14, 7, 6);
      r('#e86a55', 9, 15, 5, 4);
      r('#14181c', 17, 13, 7, 7);
      r('#7ed6a0', 18, 14, 5, 5);
    }),
  wall: () =>
    paint(T * 2, T * 2, (r) => {
      r('#14181c', 2, 4, 28, 27);
      r('#6f7c7f', 3, 5, 26, 25);
      r('#93a4a6', 3, 5, 26, 2);
      r('#4b5b61', 3, 16, 26, 2);
      r('#4b5b61', 15, 5, 2, 25);
      [
        [5, 8],
        [25, 8],
        [5, 26],
        [25, 26],
        [11, 12],
        [20, 22],
      ].forEach(([x, y]) => r('#14181c', x, y, 2, 2));
      r('#f6b445', 3, 28, 26, 2);
      for (let x = 4; x < 28; x += 6) r('#14181c', x, 28, 3, 2);
    }),
  truck: () =>
    paint(T * 2, T * 2, (r) => {
      r('#14181c', 1, 10, 30, 15);
      r('#4f6b4a', 2, 11, 19, 13);
      r('#5f7f58', 2, 11, 19, 2);
      r('#3d5539', 2, 20, 19, 2);
      r('#4f6b4a', 21, 14, 9, 10);
      r('#8fd0ea', 23, 15, 5, 4);
      r('#f6b445', 29, 21, 1, 2);
      r('#14181c', 5, 14, 4, 3);
      r('#14181c', 12, 14, 4, 3);
      [5, 22].forEach((x) => {
        r('#14181c', x, 22, 7, 7);
        r('#4b5b61', x + 2, 24, 3, 3);
      });
    }),
};

const zhou = person('g', 'e', 'G', 0);

let cache = null;

export function sprites() {
  if (cache) return cache;
  const p0 = person('h', 'y', 'o', 0);
  const p1 = person('h', 'y', 'o', 1);
  const d0 = dog(0);
  const d1 = dog(1);
  cache = {
    player: [p0, p1],
    zhou,
    dogR: [d0, d1],
    dogL: [flip(d0), flip(d1)],
    node: { near: crate, mid: car, deep: container },
    dirt: [0, 1, 2, 3].map((i) => ground(11 + i, '#5a4a3a', ['#6b5947', '#4c3e31', '#73614d'])),
    snow: [0, 1, 2, 3].map((i) => ground(31 + i, '#b9c7cc', ['#d6e0e3', '#a3b3b9', '#e7eeec'])),
    road: [0, 1].map((i) => ground(51 + i, '#454a4c', ['#51575a', '#3a3f41'])),
    rubble,
    tree,
    ruin,
    hatch,
    floor: [0, 1, 2, 3].map((i) => floor(71 + i)),
    wallTop,
    wallFace,
    stripe,
    bed,
    radio,
    ladder,
    stock: [0, 1, 2, 3, 4, 5, 6].map(stock),
    pad,
    facility: Object.fromEntries(Object.entries(facility).map(([id, make]) => [id, [make(0), make(1)]])),
  };
  return cache;
}
