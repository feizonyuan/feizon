// 出租屋里的像素画：一套老旧的小套间，住了一阵子的样子。
import { T, C, make } from './art.js';

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = {
  plaster: '#ddd5c1',
  plasterD: '#cdc4ae',
  plasterL: '#e8e1d0',
  stain: '#c4b99f',
  board: '#8a6a48',
  boardD: '#6f5338',
  floor: '#b48c60',
  floorD: '#9c774e',
  floorL: '#c6a074',
  lino: '#d6cdb6',
  linoD: '#c3b99f',
  wallTop: '#4b4459',
  wallTopL: '#5d5570',
  card: '#c49a6c',
  cardD: '#a57f55',
  duvet: '#6f86a8',
  duvetD: '#586e8f',
  duvetL: '#8aa0c0',
};

/* ---------- 地板和墙 ---------- */

function floorTile(seed) {
  return make(
    T,
    T,
    (r) => {
      const rnd = rng(seed);
      r(W.floor, 0, 0, T, T);
      r(W.floorD, 0, 7, T, 1);
      r(W.floorD, 0, 15, T, 1);
      const a = 3 + Math.floor(rnd() * 9);
      const b = 3 + Math.floor(rnd() * 9);
      r(W.floorD, a, 0, 1, 7);
      r(W.floorD, b, 8, 1, 7);
      r(W.floorL, 1, 1, 4 + Math.floor(rnd() * 4), 1);
      r(W.floorL, 8, 9, 3 + Math.floor(rnd() * 4), 1);
      if (rnd() > 0.6) r(W.floorD, 2 + Math.floor(rnd() * 11), 3 + Math.floor(rnd() * 2), 2, 1); // 木节
      if (rnd() > 0.7) r('#a8825a', 4 + Math.floor(rnd() * 8), 10 + Math.floor(rnd() * 3), 3, 1); // 磨痕
    },
    false,
  );
}

const lino = (dirty) =>
  make(
    T,
    T,
    (r) => {
      r(W.lino, 0, 0, T, T);
      r(W.linoD, 0, 0, 8, 8);
      r(W.linoD, 8, 8, 8, 8);
      r('#b9af96', 0, 15, T, 1);
      r('#b9af96', 15, 0, 1, T);
      if (dirty) {
        r('#b3a88c', 4, 10, 3, 2);
        r('#b3a88c', 10, 4, 2, 1);
      }
    },
    false,
  );

function wallHi(kind) {
  return make(
    T,
    T,
    (r) => {
      r(W.plaster, 0, 0, T, T);
      r(W.plasterL, 0, 0, T, 2);
      if (kind === 1) {
        // 一道裂纹
        r(W.plasterD, 6, 3, 1, 4);
        r(W.plasterD, 7, 6, 1, 4);
        r(W.plasterD, 6, 9, 1, 3);
      } else if (kind === 2) {
        // 渗水的印子
        r(W.stain, 3, 2, 8, 3);
        r(W.stain, 4, 5, 5, 3);
        r(W.stain, 6, 8, 2, 3);
      } else if (kind === 3) {
        r(W.plasterD, 10, 8, 3, 1);
        r(W.plasterD, 2, 12, 2, 1);
      }
    },
    false,
  );
}

function wallLo(kind) {
  return make(
    T,
    T,
    (r) => {
      r(W.plaster, 0, 0, T, T);
      r(W.plasterD, 0, 9, T, 3);
      r(W.board, 0, 12, T, 4);
      r(W.boardD, 0, 15, T, 1);
      r('#a07c56', 0, 12, T, 1);
      if (kind === 1) {
        // 插座
        r(C.white, 6, 3, 5, 5);
        r(C.creamD, 6, 7, 5, 1);
        r(C.night, 7, 5, 1, 1);
        r(C.night, 9, 5, 1, 1);
      } else if (kind === 2) {
        r(W.stain, 2, 6, 6, 3);
        r(W.stain, 4, 4, 3, 2);
      }
    },
    false,
  );
}

const wallTop = make(
  T,
  T,
  (r) => {
    r(W.wallTop, 0, 0, T, T);
    r(W.wallTopL, 0, 0, T, 2);
    r('#3d3749', 0, 14, T, 2);
  },
  false,
);

const dark = make(
  T,
  T,
  (r) => {
    r('#24202d', 0, 0, T, T);
    r('#201c28', 0, 7, T, 1);
    r('#201c28', 0, 15, T, 1);
    r('#201c28', 4, 0, 1, 7);
    r('#201c28', 12, 8, 1, 7);
  },
  false,
);

/* ---------- 家具 ---------- */

const bed = make(T, 40, (r) => {
  // 床头板
  r(W.board, 0, 0, 16, 9);
  r('#a07c56', 0, 0, 16, 2);
  r(W.boardD, 0, 8, 16, 1);
  // 床架
  r(W.boardD, 0, 9, 16, 31);
  r('#e9e4d8', 1, 9, 14, 29);
  // 枕头
  r(C.white, 2, 10, 12, 7);
  r('#dcd6c8', 2, 15, 12, 2);
  r('#dcd6c8', 7, 11, 2, 3);
  // 被子：格子纹，掀开一角
  r(W.duvet, 1, 18, 14, 20);
  r(W.duvetD, 1, 36, 14, 2);
  for (let y = 21; y < 36; y += 5) r(W.duvetL, 1, y, 14, 1);
  for (let x = 4; x < 15; x += 5) r(W.duvetL, x, 18, 1, 18);
  r('#e9e4d8', 10, 18, 5, 4);
  r(W.duvetD, 9, 18, 1, 5);
  r(W.duvetD, 10, 22, 5, 1);
  r(W.boardD, 0, 38, 16, 2);
});

const nightstand = make(T, 22, (r) => {
  r(W.board, 1, 8, 14, 13);
  r('#a07c56', 1, 8, 14, 2);
  r(W.boardD, 2, 12, 12, 1);
  r(W.boardD, 2, 17, 12, 1);
  r(C.yellow, 7, 14, 2, 1);
  r(C.yellow, 7, 19, 2, 1);
  // 闹钟
  r(C.red, 3, 2, 6, 6);
  r(C.white, 4, 3, 4, 4);
  r(C.night, 6, 4, 1, 2);
  r(C.night, 6, 5, 2, 1);
  r(C.redD, 3, 1, 2, 1);
  r(C.redD, 7, 1, 2, 1);
  // 水杯
  r(C.glass, 11, 4, 3, 4);
  r(C.white, 11, 4, 3, 1);
});

const desk = make(32, 34, (r) => {
  // 桌面
  r(W.board, 0, 12, 32, 8);
  r('#a07c56', 0, 12, 32, 2);
  r(W.boardD, 0, 19, 32, 1);
  // 桌腿和抽屉
  r(W.boardD, 1, 20, 3, 13);
  r(W.boardD, 28, 20, 3, 13);
  r(W.board, 17, 20, 11, 9);
  r(W.boardD, 17, 24, 11, 1);
  r(C.yellow, 22, 22, 2, 1);
  r(C.yellow, 22, 26, 2, 1);
  r('#3a3346', 4, 20, 13, 13);
  // 旧笔记本电脑
  r(C.night, 13, 2, 14, 10);
  r('#6f8fb0', 14, 3, 12, 8);
  r('#9fc0de', 15, 4, 7, 1);
  r('#9fc0de', 15, 6, 9, 1);
  r('#9fc0de', 15, 8, 5, 1);
  r(C.tinD, 12, 12, 16, 3);
  r(C.night, 13, 13, 14, 1);
  // 台灯
  r(C.night, 29, 6, 1, 7);
  r(C.yellow, 26, 3, 5, 4);
  r(C.lit, 27, 6, 3, 1);
  // 马克杯
  r(C.white, 8, 9, 3, 4);
  r(C.red, 8, 10, 3, 1);
});

const wardrobe = make(T, 46, (r) => {
  // 顶上的编织袋
  r('#c95f5f', 2, 0, 12, 7);
  r(C.white, 2, 2, 12, 1);
  r('#4f79a8', 2, 4, 12, 1);
  // 柜体
  r(W.board, 0, 7, 16, 38);
  r('#a07c56', 0, 7, 16, 2);
  r(W.boardD, 7, 9, 2, 33);
  r(W.boardD, 1, 10, 6, 30);
  r(W.boardD, 9, 10, 6, 30);
  r(W.board, 2, 11, 4, 28);
  r(W.board, 10, 11, 4, 28);
  r(C.yellow, 5, 25, 1, 3);
  r(C.yellow, 10, 25, 1, 3);
  r(W.boardD, 0, 42, 16, 3);
  // 门缝里夹着的衣角
  r(C.red, 7, 30, 1, 4);
});

const fridge = make(T, 38, (r) => {
  r(C.white, 1, 0, 14, 37);
  r(C.cream, 1, 0, 2, 37);
  r(C.creamD, 1, 13, 14, 1);
  r(C.tinD, 13, 4, 1, 6);
  r(C.tinD, 13, 17, 1, 9);
  // 冰箱贴和便签
  r(C.yellow, 5, 3, 4, 4);
  r(C.yellowD, 6, 5, 2, 1);
  r(C.red, 10, 6, 2, 2);
  r(C.blue, 4, 9, 2, 2);
  r(C.white, 5, 17, 6, 7);
  r(C.creamD, 6, 19, 4, 1);
  r(C.creamD, 6, 21, 3, 1);
  r(C.red, 7, 17, 2, 1);
  // 底下的锈
  r('#b98a6a', 3, 33, 4, 2);
  r(C.night, 2, 37, 3, 1);
  r(C.night, 11, 37, 3, 1);
});

const kitchen = make(32, 36, (r, e) => {
  // 墙上贴的白瓷砖
  r(C.white, 0, 0, 32, 12);
  for (let x = 0; x < 32; x += 6) r(C.creamD, x, 0, 1, 12);
  r(C.creamD, 0, 6, 32, 1);
  r('#c9b98f', 8, 7, 4, 3); // 油渍
  // 台面
  r(C.tin, 0, 12, 32, 7);
  r(C.white, 0, 12, 32, 1);
  r(C.tinD, 0, 18, 32, 1);
  // 单头煤气灶和锅
  r(C.night, 2, 13, 12, 5);
  r(C.tinD, 4, 14, 8, 3);
  e(C.night, 8, 11, 5, 3);
  e('#55506a', 8, 10.5, 4, 2);
  r(C.night, 12, 10, 5, 1);
  // 水槽和龙头
  r(C.tinD, 18, 13, 11, 5);
  r('#7d8a8f', 19, 14, 9, 3);
  r(C.tinD, 23, 6, 1, 7);
  r(C.tinD, 23, 6, 4, 1);
  r(C.tinD, 26, 7, 1, 2);
  // 洗洁精
  r(C.green, 29, 8, 2, 5);
  r(C.white, 29, 7, 2, 1);
  // 柜门
  r(W.board, 0, 19, 32, 16);
  r(W.boardD, 15, 19, 2, 16);
  r(W.boardD, 1, 21, 13, 12);
  r(W.boardD, 18, 21, 13, 12);
  r(W.board, 2, 22, 11, 10);
  r(W.board, 19, 22, 11, 10);
  r(C.yellow, 11, 26, 1, 3);
  r(C.yellow, 20, 26, 1, 3);
  r(W.boardD, 0, 33, 32, 2);
});

const cart = make(T, 30, (r, e) => {
  // 电饭煲
  e(C.white, 8, 6, 6, 5);
  r(C.creamD, 2, 8, 12, 1);
  r(C.red, 7, 9, 2, 1);
  r(C.night, 6, 0, 4, 2);
  // 小推车
  r(C.tinD, 1, 11, 14, 2);
  r(C.tinD, 1, 20, 14, 2);
  r(C.tinD, 1, 11, 1, 17);
  r(C.tinD, 14, 11, 1, 17);
  // 下层：米袋和油
  r(C.cream, 3, 14, 7, 6);
  r(C.red, 4, 16, 5, 2);
  r(C.yellow, 11, 14, 2, 6);
  r(C.night, 1, 28, 2, 2);
  r(C.night, 13, 28, 2, 2);
});

const rack = make(T, 42, (r) => {
  // 晾衣架
  r(C.tinD, 0, 2, 16, 1);
  r(C.tinD, 1, 2, 1, 38);
  r(C.tinD, 14, 2, 1, 38);
  r(C.tinD, 0, 40, 4, 1);
  r(C.tinD, 12, 40, 4, 1);
  r(C.tinD, 1, 20, 14, 1);
  // 快餐店的工服
  r(C.red, 3, 3, 10, 11);
  r(C.redD, 3, 12, 10, 2);
  r(C.red, 2, 4, 1, 5);
  r(C.red, 13, 4, 1, 5);
  r(C.yellow, 5, 5, 2, 2);
  // 毛巾和袜子
  r(C.white, 3, 21, 6, 10);
  r(C.blue, 3, 28, 6, 1);
  r('#8d8a94', 10, 21, 2, 6);
  r('#8d8a94', 12, 21, 2, 5);
});

const boxes = make(T, 26, (r) => {
  r(W.card, 1, 12, 14, 13);
  r(W.cardD, 1, 23, 14, 2);
  r(W.cardD, 1, 12, 14, 1);
  r('#e6dcc6', 7, 12, 2, 13);
  r(W.card, 3, 2, 11, 10);
  r(W.cardD, 3, 10, 11, 2);
  r('#e6dcc6', 8, 2, 2, 10);
  r(C.night, 4, 5, 3, 1);
  r(C.night, 4, 7, 2, 1);
  r(C.red, 11, 15, 3, 3);
});

const lowTable = make(T, 16, (r, e) => {
  e(W.boardD, 8, 8, 8, 5);
  e(W.board, 8, 6.5, 8, 4.5);
  e('#a07c56', 8, 6, 6, 3);
  r(W.boardD, 3, 11, 2, 4);
  r(W.boardD, 11, 11, 2, 4);
  // 一只碗和筷子
  e(C.white, 6, 5.5, 3, 2);
  e(C.creamD, 6, 5, 2, 1);
  r(W.boardD, 10, 3, 1, 5);
  r(W.boardD, 12, 3, 1, 5);
});

const stool = make(12, 10, (r, e) => {
  e(C.blueD, 6, 5, 6, 4);
  e(C.blue, 6, 4, 5, 3);
  r('#6f9bc8', 4, 3, 3, 1);
});

const rug = make(
  48,
  32,
  (r) => {
    r('#7a4f4a', 1, 1, 46, 30);
    r('#9a625c', 3, 3, 42, 26);
    r('#c9a36a', 5, 5, 38, 1);
    r('#c9a36a', 5, 26, 38, 1);
    r('#c9a36a', 5, 5, 1, 22);
    r('#c9a36a', 42, 5, 1, 22);
    for (let x = 9; x < 40; x += 6) {
      r('#c9a36a', x, 13, 2, 2);
      r('#e6dcc6', x + 1, 16, 2, 2);
      r('#c9a36a', x, 19, 2, 2);
    }
    for (let y = 2; y < 30; y += 3) {
      r('#c9a36a', 0, y, 1, 1);
      r('#c9a36a', 47, y, 1, 1);
    }
    r('#8a5852', 30, 9, 5, 3); // 一块洗不掉的印子
  },
  false,
);

const shoes = make(T, 12, (r) => {
  r(C.yellowD, 0, 3, 16, 9);
  r(C.yellow, 1, 4, 14, 7);
  r(C.white, 2, 5, 4, 6);
  r(C.creamD, 2, 9, 4, 2);
  r(C.night, 3, 6, 2, 1);
  r(C.white, 7, 6, 4, 5);
  r(C.creamD, 7, 9, 4, 2);
  r(C.blue, 12, 6, 3, 5);
});

const doorway = make(
  T,
  T,
  (r) => {
    r(W.boardD, 0, 0, 16, 16);
    r('#2a2433', 2, 2, 12, 14);
    r(W.board, 2, 2, 3, 14);
    r('#a07c56', 2, 2, 1, 14);
    r(C.yellow, 4, 9, 1, 2);
    r(W.board, 0, 0, 16, 2);
  },
  false,
);

/* ---------- 墙上的东西 ---------- */

// 小高窗：外面的天色随时间变；晚上拉上帘子
function windowArt(kind) {
  const sky = { day: '#a9dcef', dusk: '#f0b27a', night: '#2c2f4a' }[kind];
  const far = { day: '#8fb9c9', dusk: '#b9785a', night: '#1f2138' }[kind];
  return make(32, 22, (r) => {
    r(W.boardD, 0, 1, 32, 19);
    r(sky, 2, 3, 28, 15);
    // 对面的楼
    r(far, 2, 11, 9, 7);
    r(far, 13, 8, 7, 10);
    r(far, 22, 12, 8, 6);
    if (kind === 'night') {
      r(C.lit, 15, 10, 1, 1);
      r(C.lit, 17, 13, 1, 1);
      r(C.lit, 5, 13, 1, 1);
      r(C.lit, 25, 14, 1, 1);
    } else if (kind === 'day') {
      r(C.white, 5, 5, 6, 2);
      r(C.white, 20, 4, 5, 1);
    }
    r(W.boardD, 15, 3, 2, 15);
    r(W.board, 0, 18, 32, 3);
    r('#a07c56', 0, 18, 32, 1);
    // 窗帘
    const cloth = '#c9b48a';
    const fold = '#b09a70';
    if (kind === 'night') {
      r(cloth, 1, 1, 30, 17);
      for (let x = 4; x < 30; x += 5) r(fold, x, 2, 1, 16);
    } else {
      r(cloth, 1, 1, 5, 17);
      r(fold, 3, 2, 1, 16);
      r(cloth, 26, 1, 5, 17);
      r(fold, 28, 2, 1, 16);
    }
    r(C.night, 0, 0, 32, 1);
  });
}

const poster = make(14, 20, (r) => {
  r('#2f3550', 0, 0, 14, 20);
  r('#f0b27a', 1, 1, 12, 9);
  r('#e98b3a', 1, 7, 12, 3);
  r(C.lit, 8, 3, 3, 3);
  r('#22263c', 1, 10, 12, 5);
  r('#3d4468', 3, 8, 3, 7);
  r('#3d4468', 8, 9, 4, 6);
  r(C.white, 2, 16, 10, 1);
  r(C.creamD, 4, 18, 6, 1);
  // 右下角翘起来了
  r(W.plaster, 12, 18, 2, 2);
  r('#454c70', 11, 17, 2, 2);
});

const calendar = make(10, 13, (r) => {
  r(C.white, 0, 0, 10, 13);
  r(C.red, 0, 0, 10, 4);
  r(C.white, 2, 1, 1, 1);
  r(C.white, 7, 1, 1, 1);
  for (let y = 6; y < 12; y += 2) for (let x = 1; x < 9; x += 2) r(C.creamD, x, y, 1, 1);
  r(C.red, 5, 8, 1, 1);
});

const clock = make(10, 10, (r, e) => {
  e(C.night, 5, 5, 5, 5);
  e(C.white, 5, 5, 4, 4);
  r(C.night, 5, 2, 1, 4);
  r(C.night, 5, 5, 3, 1);
});

const shelf = make(32, 16, (r, e) => {
  r(W.board, 0, 11, 32, 3);
  r('#a07c56', 0, 11, 32, 1);
  r(W.boardD, 3, 14, 2, 2);
  r(W.boardD, 27, 14, 2, 2);
  // 一摞碗
  e(C.white, 6, 9, 4, 2);
  e(C.white, 6, 7, 4, 2);
  r(C.creamD, 2, 8, 8, 1);
  // 酱油、盐罐、筷子筒
  r('#3a2d2a', 13, 4, 3, 7);
  r(C.red, 13, 6, 3, 2);
  r(C.night, 14, 2, 1, 2);
  r(C.white, 18, 6, 3, 5);
  r(C.blue, 18, 7, 3, 1);
  r(C.tinD, 24, 5, 4, 6);
  r(W.boardD, 25, 1, 1, 5);
  r(W.boardD, 27, 2, 1, 4);
});

const certificate = make(14, 11, (r) => {
  r(W.boardD, 0, 0, 14, 11);
  r(C.cream, 1, 1, 12, 9);
  r(C.night, 3, 3, 8, 1);
  r(C.creamD, 3, 5, 6, 1);
  r(C.red, 9, 6, 3, 3);
});

/* ---------- 会随日子变化的小东西 ---------- */

const plant = (state) =>
  make(10, 14, (r) => {
    r('#b86a52', 2, 9, 6, 5);
    r('#98523f', 2, 12, 6, 2);
    r('#c97f66', 1, 8, 8, 2);
    if (state === 0) {
      // 蔫了
      r('#8a7a4a', 4, 5, 1, 4);
      r('#8a7a4a', 2, 6, 2, 1);
      r('#8a7a4a', 6, 7, 2, 1);
    } else {
      r(C.leaf, 4, 2, 2, 7);
      r(C.leafL, 1, 3, 3, 2);
      r(C.leafL, 6, 1, 3, 2);
      r(C.leafD, 2, 6, 2, 2);
      r(C.leafD, 6, 5, 2, 2);
      if (state === 2) {
        r(C.pink, 4, 0, 2, 2);
        r(C.yellow, 4, 0, 1, 1);
      }
    }
  });

const ledger = make(9, 7, (r) => {
  r('#6b4a36', 0, 0, 9, 7);
  r('#8a6548', 1, 1, 7, 5);
  r(C.cream, 2, 2, 5, 1);
  r(C.red, 7, 0, 1, 7);
});

const textbook = make(9, 6, (r) => {
  r(C.blueD, 0, 0, 9, 6);
  r(C.blue, 1, 1, 7, 4);
  r(C.white, 2, 2, 4, 1);
});

const phone = make(5, 7, (r) => {
  r(C.night, 0, 0, 5, 7);
  r('#9fc0de', 1, 1, 3, 5);
  r(C.white, 1, 1, 3, 1);
});

const groceryBag = make(12, 13, (r) => {
  r(C.white, 1, 5, 10, 8);
  r(C.creamD, 1, 11, 10, 2);
  r(C.green, 2, 6, 8, 3);
  r(C.leafL, 7, 0, 2, 6);
  r(C.leaf, 9, 1, 1, 4);
  r(C.red, 3, 3, 3, 3);
  r(C.creamD, 3, 4, 1, 2);
  r(C.creamD, 8, 4, 1, 2);
});

const noodles = make(22, 12, (r, e) => {
  // 泡面桶、易拉罐、揉成团的纸
  r(C.red, 1, 3, 7, 7);
  r(C.white, 1, 3, 7, 2);
  r(C.yellow, 3, 6, 3, 2);
  r(W.boardD, 6, 0, 1, 4);
  r(C.tinD, 11, 6, 4, 5);
  r(C.blue, 11, 7, 4, 2);
  e(C.white, 19, 8, 2.5, 2.5);
  r(C.creamD, 18, 8, 2, 1);
});

const helmet = make(11, 9, (r, e) => {
  e(C.greenD, 5.5, 6, 5.5, 4);
  e(C.green, 5.5, 4.5, 5, 3.5);
  r(C.white, 3, 3, 3, 1);
  r(C.night, 1, 7, 9, 1);
});

const toolbox = make(15, 10, (r) => {
  r(C.redD, 0, 3, 15, 7);
  r(C.red, 1, 4, 13, 5);
  r(C.night, 5, 0, 5, 1);
  r(C.night, 5, 0, 1, 3);
  r(C.night, 9, 0, 1, 3);
  r(C.yellow, 6, 5, 3, 2);
});

/* ---------- 套间里多出来的东西 ---------- */

const bathTile = make(
  T,
  T,
  (r) => {
    r('#cfe0e4', 0, 0, T, T);
    for (let i = 0; i < T; i += 4) {
      r('#b4c9cf', i, 0, 1, T);
      r('#b4c9cf', 0, i, T, 1);
    }
    r('#e2eef0', 5, 5, 2, 2);
    r('#e2eef0', 13, 9, 2, 2);
  },
  false,
);

const tileWall = (low) =>
  make(
    T,
    T,
    (r) => {
      r('#e9eef0', 0, 0, T, T);
      for (let x = 0; x < T; x += 8) r('#c9d4d8', x, 0, 1, T);
      r('#c9d4d8', 0, 7, T, 1);
      r('#c9d4d8', 0, 15, T, 1);
      if (low) {
        r('#8fb7c4', 0, 4, T, 2);
        r('#a9a59a', 3, 11, 4, 2); // 水垢
      }
    },
    false,
  );

// 隔墙：上面是墙顶，下面露出一截墙面
const partition = make(
  T,
  T,
  (r) => {
    r(W.wallTop, 0, 0, T, T);
    r(W.wallTopL, 0, 0, T, 2);
    r(W.plasterD, 0, 10, T, 6);
    r(W.board, 0, 14, T, 2);
  },
  false,
);

const bookshelf = make(T, 46, (r) => {
  r(W.boardD, 0, 0, 16, 45);
  r('#3a3346', 2, 2, 12, 41);
  const rows = [
    [C.red, C.blue, C.cream, C.green, C.yellow],
    [C.blueD, C.cream, C.pink, C.red],
    [C.green, C.yellow, C.blue, C.cream, C.redD],
  ];
  rows.forEach((books, i) => {
    const y = 3 + i * 11;
    let x = 2;
    books.forEach((c, j) => {
      const w = j % 2 ? 2 : 3;
      const h = 8 - (j % 3);
      r(c, x, y + 8 - h, w, h);
      x += w;
    });
    r(W.board, 1, y + 8, 14, 2);
  });
  // 最下面一层：一个纸盒和游戏手柄
  r(W.card, 3, 37, 6, 5);
  r(C.night, 10, 39, 4, 3);
  r(C.red, 11, 40, 1, 1);
  r(W.board, 1, 42, 14, 2);
});

const sofa = make(32, 26, (r) => {
  // 靠背在下，朝着屋子里面坐
  r('#5f7a66', 0, 2, 32, 22);
  r('#4c6453', 0, 20, 32, 4);
  r('#6f8d77', 3, 4, 12, 11);
  r('#6f8d77', 17, 4, 12, 11);
  r('#4c6453', 15, 4, 2, 12);
  r('#4c6453', 0, 2, 3, 16);
  r('#4c6453', 29, 2, 3, 16);
  r('#7fa088', 4, 5, 6, 1);
  r('#7fa088', 18, 5, 6, 1);
  // 一个抱枕，一块补丁
  r(C.yellow, 20, 7, 7, 6);
  r(C.yellowD, 20, 12, 7, 1);
  r('#8d6a4a', 6, 10, 4, 3);
  r(C.night, 1, 24, 3, 2);
  r(C.night, 28, 24, 3, 2);
});

const fan = make(T, 36, (r, e) => {
  e(C.tinD, 8, 9, 7.5, 8);
  e('#dfe6e8', 8, 9, 6, 6.5);
  r(C.tinD, 7, 3, 2, 12);
  r(C.tinD, 2, 8, 12, 2);
  e(C.blue, 8, 9, 2, 2);
  r(C.tinD, 7, 17, 2, 15);
  r(C.night, 3, 32, 10, 3);
  r(C.white, 6, 22, 4, 3);
});

const toilet = make(T, 26, (r, e) => {
  r(C.white, 3, 0, 10, 9);
  r(C.creamD, 3, 7, 10, 2);
  r(C.tinD, 11, 2, 1, 2);
  e(C.creamD, 8, 17, 6, 8);
  e(C.white, 8, 16, 5.5, 7);
  e('#cfe0e4', 8, 16, 3, 4.5);
});

const basin = make(T, 26, (r, e) => {
  r(C.tinD, 7, 0, 2, 5);
  r(C.tinD, 6, 0, 4, 1);
  e(C.creamD, 8, 9, 7.5, 5);
  e(C.white, 8, 8, 7, 4.5);
  e('#cfe0e4', 8, 8, 4, 2.5);
  r(C.white, 5, 12, 6, 12);
  r(C.creamD, 5, 22, 6, 2);
  // 牙刷杯
  r(C.blue, 13, 2, 2, 4);
  r(C.red, 13, 0, 1, 2);
});

const shower = make(32, 42, (r) => {
  // 花洒和水管
  r(C.tinD, 26, 0, 2, 24);
  r(C.tinD, 18, 0, 10, 2);
  r(C.tinD, 16, 2, 6, 2);
  r(C.red, 25, 22, 2, 2);
  r(C.blue, 28, 22, 2, 2);
  // 浴帘
  r(C.tinD, 0, 6, 32, 1);
  for (let x = 0; x < 14; x += 2) r(x % 4 ? '#9fc7d6' : '#b9dbe6', x, 7, 2, 30);
  r('#8ab3c2', 0, 35, 14, 2);
  // 地上的塑料盆和拖鞋
  r(C.pink, 16, 32, 10, 6);
  r(C.pinkD, 16, 36, 10, 2);
  r(C.blue, 27, 36, 4, 3);
  r(C.blue, 27, 31, 4, 3);
});

const washer = make(T, 30, (r, e) => {
  r(C.white, 1, 2, 14, 27);
  r(C.creamD, 1, 2, 14, 5);
  r(C.night, 3, 4, 4, 1);
  r(C.green, 12, 4, 1, 1);
  r(C.red, 10, 4, 1, 1);
  e(C.tinD, 8, 17, 5.5, 5.5);
  e('#4f6f86', 8, 17, 4, 4);
  r('#7fa3bb', 6, 15, 2, 1);
  r(C.creamD, 1, 27, 14, 2);
  // 上面搭着一条毛巾
  r(C.yellow, 2, 0, 9, 3);
});

const mirror = make(10, 13, (r) => {
  r(C.tinD, 0, 0, 10, 13);
  r('#b9dbe6', 1, 1, 8, 11);
  r(C.white, 2, 2, 2, 5);
  r('#9fc7d6', 5, 6, 3, 4);
});

const mop = make(12, 26, (r) => {
  r(W.boardD, 8, 0, 1, 18);
  r(C.creamD, 6, 17, 5, 5);
  r(C.cream, 6, 17, 5, 2);
  r(C.blue, 0, 15, 7, 10);
  r(C.blueD, 0, 23, 7, 2);
  r('#7fa3bb', 1, 16, 5, 2);
});

const hooks = make(22, 16, (r) => {
  r(W.boardD, 0, 0, 22, 3);
  r(C.tinD, 3, 3, 1, 2);
  r(C.tinD, 11, 3, 1, 2);
  r(C.tinD, 18, 3, 1, 2);
  // 一件外套，一个帆布包
  r('#4a5f86', 0, 4, 7, 12);
  r('#3d5072', 0, 14, 7, 2);
  r('#3d5072', 3, 4, 1, 10);
  r(C.cream, 15, 6, 7, 8);
  r(C.creamD, 15, 12, 7, 2);
  r(C.creamD, 17, 4, 1, 3);
  r(C.creamD, 20, 4, 1, 3);
});

let cache = null;

export function roomArt() {
  cache ??= {
    floor: [0, 1, 2, 3, 4, 5].map((i) => floorTile(700 + i)),
    lino: [lino(false), lino(true)],
    wallHi: [0, 1, 2, 3].map(wallHi),
    wallLo: [0, 1, 2].map(wallLo),
    wallTop,
    dark,
    bed,
    nightstand,
    desk,
    wardrobe,
    fridge,
    kitchen,
    cart,
    rack,
    boxes,
    lowTable,
    stool,
    rug,
    shoes,
    doorway,
    window: { day: windowArt('day'), dusk: windowArt('dusk'), night: windowArt('night') },
    poster,
    calendar,
    clock,
    shelf,
    certificate,
    plant: [plant(0), plant(1), plant(2)],
    ledger,
    textbook,
    phone,
    groceryBag,
    noodles,
    helmet,
    toolbox,
    bathTile,
    tileWall: [tileWall(false), tileWall(true)],
    partition,
    bookshelf,
    sofa,
    fan,
    toilet,
    basin,
    shower,
    washer,
    mirror,
    mop,
    hooks,
  };
  return cache;
}
