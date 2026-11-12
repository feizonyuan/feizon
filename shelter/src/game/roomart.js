// 出租屋里的像素画：十平米，住了一阵子的样子。
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
  };
  return cache;
}
