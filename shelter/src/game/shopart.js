// 便利店、快餐店、夜校教室里的像素画。
import { T, C, make, human } from './art.js';

const wood = '#8a6a48';
const woodD = '#6f5338';
const woodL = '#a07c56';

/* ---------- 地面和墙 ---------- */

const shopFloor = (v) =>
  make(
    T,
    T,
    (r) => {
      r('#e4e2da', 0, 0, T, T);
      r('#d2d0c6', 0, 15, T, 1);
      r('#d2d0c6', 15, 0, 1, T);
      if (v === 1) r('#d8d6cc', 3, 4, 6, 1);
      if (v === 2) r('#cfcdc2', 9, 10, 3, 2);
    },
    false,
  );

const checker = (v) =>
  make(
    T,
    T,
    (r) => {
      r('#ead9c0', 0, 0, T, T);
      r('#c9694f', 0, 0, 8, 8);
      r('#c9694f', 8, 8, 8, 8);
      r('#b85a42', 0, 7, 8, 1);
      r('#b85a42', 8, 15, 8, 1);
      if (v) r('#d9c8ae', 10, 2, 3, 2);
    },
    false,
  );

const classFloor = (v) =>
  make(
    T,
    T,
    (r) => {
      r('#b9a07a', 0, 0, T, T);
      r('#a58c68', 0, 15, T, 1);
      r('#a58c68', v ? 5 : 11, 0, 1, 15);
      r('#c8b08a', 1, 1, 6, 1);
    },
    false,
  );

// 墙：上半截一个颜色，下半截刷了一道色带
function wall(base, band, low) {
  return make(
    T,
    T,
    (r) => {
      r(base, 0, 0, T, T);
      if (low) {
        r(band, 0, 4, T, 8);
        r('#00000022', 0, 11, T, 1);
        r(woodD, 0, 13, T, 3);
      }
    },
    false,
  );
}

/* ---------- 便利店 ---------- */

const GOODS = [C.red, C.yellow, C.blue, C.green, C.pink, C.orange, C.white, C.purple];

const shelf = (seed) =>
  make(32, 36, (r) => {
    r('#9aa3a6', 0, 0, 32, 35);
    r('#c9d0d2', 1, 1, 30, 2);
    for (let row = 0; row < 3; row++) {
      const y = 4 + row * 10;
      r('#6f777a', 1, y + 7, 30, 2);
      for (let i = 0; i < 9; i++) {
        const c = GOODS[(seed * 3 + row * 5 + i * 7) % GOODS.length];
        const h = 4 + ((seed + i + row) % 3);
        r(c, 2 + i * 3 + (i > 4 ? 1 : 0), y + 7 - h, 2, h);
      }
      r(C.yellow, 3 + row * 9, y + 7, 4, 2); // 价签
    }
    r('#6f777a', 0, 33, 32, 2);
  });

const cooler = make(32, 46, (r) => {
  r('#dfe6e8', 0, 0, 32, 45);
  r(C.blue, 0, 0, 32, 5);
  r(C.white, 4, 1, 10, 2);
  r('#2f3f55', 2, 6, 13, 35);
  r('#2f3f55', 17, 6, 13, 35);
  for (let door = 0; door < 2; door++) {
    for (let row = 0; row < 4; row++) {
      const y = 8 + row * 8;
      for (let i = 0; i < 4; i++) {
        r(GOODS[(door * 3 + row * 2 + i) % GOODS.length], 3 + door * 15 + i * 3, y, 2, 6);
        r(C.white, 3 + door * 15 + i * 3, y, 2, 1);
      }
      r('#8fa3b5', 2 + door * 15, y + 6, 13, 1);
    }
    r('#a9dcef55', 3 + door * 15, 7, 3, 32);
    r(C.tinD, 13 + door * 15, 18, 1, 10);
  }
  r(C.tinD, 0, 41, 32, 4);
});

const register = make(48, 34, (r) => {
  // 柜台
  r('#e6e2d8', 0, 12, 48, 21);
  r(C.green, 0, 12, 48, 3);
  r(C.orange, 0, 15, 48, 1);
  r('#cfcabd', 0, 30, 48, 3);
  r('#d8d3c6', 12, 18, 1, 12);
  r('#d8d3c6', 34, 18, 1, 12);
  // 收银机
  r(C.night, 4, 3, 14, 9);
  r('#7fb9d2', 5, 4, 12, 5);
  r(C.tinD, 3, 9, 16, 3);
  // 便当保温柜
  r(C.tin, 24, 1, 20, 11);
  r('#f6dc8a', 25, 2, 18, 9);
  r(C.red, 27, 6, 4, 4);
  r(C.white, 32, 6, 4, 4);
  r(C.green, 37, 6, 4, 4);
  r(C.tinD, 25, 5, 18, 1);
});

const atm = make(T, 36, (r) => {
  r('#3d5072', 1, 0, 14, 35);
  r('#4a5f86', 1, 0, 14, 4);
  r(C.night, 3, 6, 10, 9);
  r('#8fd0a0', 4, 7, 8, 7);
  r(C.tinD, 3, 17, 10, 6);
  for (let y = 18; y < 22; y += 2) for (let x = 4; x < 12; x += 3) r(C.white, x, y, 2, 1);
  r(C.night, 4, 26, 8, 2);
  r(C.yellow, 5, 30, 6, 2);
});

/* ---------- 快餐店 ---------- */

const dinerCounter = make(64, 34, (r) => {
  r('#e9dcc4', 0, 12, 64, 21);
  r(C.red, 0, 12, 64, 4);
  r(C.yellow, 0, 16, 64, 1);
  r('#d1c3a8', 0, 30, 64, 3);
  for (let x = 15; x < 64; x += 16) r('#d8cbb0', x, 19, 1, 11);
  // 收银机和托盘
  r(C.night, 6, 3, 13, 9);
  r('#7fb9d2', 7, 4, 11, 5);
  r(C.tinD, 5, 9, 15, 3);
  r('#8a6a48', 28, 8, 14, 4);
  r(C.yellow, 30, 4, 5, 4);
  r(C.red, 36, 5, 4, 3);
  r('#8a6a48', 46, 8, 14, 4);
  r(C.white, 48, 3, 4, 5);
  r(C.red, 48, 4, 4, 1);
  r(C.yellow, 54, 5, 4, 3);
});

const fryer = make(32, 40, (r) => {
  r(C.tin, 0, 6, 32, 33);
  r(C.white, 0, 6, 32, 2);
  r(C.tinD, 0, 36, 32, 3);
  r(C.night, 3, 10, 11, 9);
  r('#d19a2e', 4, 11, 9, 7);
  r('#f2c14e', 5, 12, 3, 2);
  r('#f2c14e', 9, 14, 3, 2);
  r(C.night, 18, 10, 11, 9);
  r('#6f5338', 19, 11, 9, 7);
  r(C.tinD, 6, 2, 1, 9);
  r(C.tinD, 22, 2, 1, 9);
  r(C.red, 6, 24, 2, 2);
  r(C.green, 22, 24, 2, 2);
  r(C.tinD, 3, 29, 26, 5);
  // 抽油烟机
  r('#93a0a5', 2, 0, 28, 4);
});

const menuBoard = make(64, 20, (r, e, w) => {
  r(C.night, 0, 0, 64, 20);
  r('#3d3a4a', 1, 1, 62, 18);
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * 20;
    r([C.yellow, C.red, '#c9a06a'][i], x, 3, 8, 7);
    r(C.white, x + 10, 4, 7, 1);
    r(C.creamD, x + 10, 7, 5, 1);
    r(C.lit, x, 13, 12, 2);
    r(C.creamD, x, 16, 8, 1);
  }
});

const dinerTable = make(32, 30, (r, e) => {
  // 两把椅子，一张桌
  r(C.red, 2, 2, 8, 6);
  r(C.redD, 2, 7, 8, 2);
  r(C.red, 22, 2, 8, 6);
  r(C.redD, 22, 7, 8, 2);
  e('#e9dcc4', 16, 15, 14, 8);
  e(C.white, 16, 14, 13, 7);
  r(C.night, 15, 21, 2, 8);
  r(C.night, 11, 28, 10, 2);
  // 桌上的调料和一个没收的托盘
  r(C.red, 8, 11, 2, 4);
  r(C.yellow, 11, 11, 2, 4);
  r('#8a6a48', 17, 12, 8, 4);
  r(C.creamD, 18, 12, 4, 2);
});

/* ---------- 夜校教室 ---------- */

const blackboard = make(80, 26, (r, e, w) => {
  r(woodD, 0, 0, 80, 26);
  r('#2f4f45', 2, 2, 76, 19);
  r('#3d6156', 3, 3, 74, 1);
  // 板书：电路图
  r('#dfe6e0', 8, 8, 14, 1);
  r('#dfe6e0', 22, 6, 1, 5);
  r('#dfe6e0', 24, 7, 1, 3);
  r('#dfe6e0', 25, 8, 12, 1);
  r('#dfe6e0', 37, 8, 1, 8);
  r('#dfe6e0', 8, 16, 30, 1);
  r('#dfe6e0', 8, 8, 1, 8);
  r(C.yellow, 16, 11, 5, 3);
  r('#dfe6e0', 46, 7, 22, 1);
  r('#b9c9bf', 46, 11, 26, 1);
  r('#b9c9bf', 46, 15, 16, 1);
  r(woodL, 2, 21, 76, 3);
  r(C.white, 10, 21, 4, 1);
  r(C.pink, 18, 21, 3, 1);
});

const teacherDesk = make(32, 28, (r) => {
  r(wood, 0, 8, 32, 19);
  r(woodL, 0, 8, 32, 2);
  r(woodD, 0, 24, 32, 3);
  r(woodD, 15, 12, 1, 12);
  // 一台拆开的电风扇和工具
  r(C.tinD, 4, 2, 10, 7);
  r('#dfe6e8', 5, 3, 8, 5);
  r(C.blue, 8, 5, 2, 2);
  r(C.red, 18, 5, 8, 3);
  r(C.night, 20, 3, 1, 3);
  r(C.yellow, 27, 4, 3, 4);
});

const studentDesk = make(T, 26, (r) => {
  // 桌
  r(wood, 0, 2, 16, 9);
  r(woodL, 0, 2, 16, 2);
  r(woodD, 0, 10, 16, 2);
  r(C.night, 1, 12, 2, 6);
  r(C.night, 13, 12, 2, 6);
  r(C.white, 3, 4, 5, 4);
  r(C.creamD, 4, 5, 3, 1);
  r(C.blue, 10, 5, 1, 4);
  // 椅
  r('#4f79a8', 3, 17, 10, 6);
  r('#3a648f', 3, 22, 10, 2);
  r(C.night, 3, 24, 2, 2);
  r(C.night, 11, 24, 2, 2);
});

const noticeBoard = make(48, 24, (r, e, w) => {
  r(woodD, 0, 0, 48, 24);
  r('#b9824f', 2, 2, 44, 20);
  const notes = [
    [4, 4, C.white],
    [14, 5, C.yellow],
    [24, 4, C.pink],
    [34, 5, C.white],
    [6, 13, C.yellow],
    [18, 14, C.white],
    [30, 13, '#b6d98a'],
  ];
  for (const [x, y, c] of notes) {
    r(c, x, y, 8, 7);
    r(C.creamD, x + 1, y + 2, 5, 1);
    r(C.creamD, x + 1, y + 4, 4, 1);
    r(C.red, x + 3, y, 2, 1);
  }
});

const toolRack = make(T, 44, (r) => {
  r(woodD, 0, 0, 16, 43);
  r('#3a3346', 2, 2, 12, 39);
  for (let row = 0; row < 3; row++) {
    const y = 4 + row * 13;
    r(wood, 1, y + 10, 14, 2);
    r([C.red, C.blue, C.tinD][row], 3, y + 3, 5, 7);
    r([C.yellow, C.tin, C.green][row], 9, y + 5, 4, 5);
  }
});

let cache = null;

export function shopArt() {
  cache ??= {
    shopFloor: [0, 1, 2].map(shopFloor),
    checker: [checker(0), checker(1)],
    classFloor: [classFloor(0), classFloor(1)],
    storeWall: [wall('#f0ece2', C.green, false), wall('#f0ece2', C.green, true)],
    dinerWall: [wall('#f1e3c8', C.red, false), wall('#f1e3c8', C.red, true)],
    classWall: [wall('#e3e0d2', '#7fa58f', false), wall('#e3e0d2', '#7fa58f', true)],
    shelf: [shelf(1), shelf(2), shelf(3)],
    cooler,
    register,
    atm,
    dinerCounter,
    fryer,
    menuBoard,
    dinerTable,
    blackboard,
    teacherDesk,
    studentDesk,
    noticeBoard,
    toolRack,
    people: {
      clerk: human({ hair: '#5a3a2c', top: '#5fae6b', topD: '#458a52', bottom: '#3d3a4a' }),
      manager: human({ hair: '#22202a', top: '#d2583f', topD: '#aa4331', bottom: '#22202a', hat: '#f2c14e' }),
      teacher: human({ hair: '#8d8a94', top: '#4c7fb5', topD: '#3a648f', bottom: '#5a5248' }),
    },
  };
  return cache;
}
