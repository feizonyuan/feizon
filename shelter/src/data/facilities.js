// 设施数据。cost: 建造花费；produce: 每周产出；upkeep: 每周维护消耗。
// concept: 复盘页用来“翻译回现实”的财务概念。
export const FACILITIES = {
  farm: {
    name: '水培农场',
    cost: 40,
    produce: 4,
    upkeep: 0,
    note: '寒冬减半，遇病害停产',
    concept: '波动较大的收益型资产',
  },
  purifier: {
    name: '净水器',
    cost: 60,
    produce: 5,
    upkeep: 0,
    note: '稳定产出',
    concept: '稳健的收益型资产',
  },
  solar: {
    name: '太阳能板',
    cost: 90,
    produce: 8,
    upkeep: 0,
    note: '贵，但产出最高',
    concept: '门槛高、回报高的资产',
  },
  tradepost: {
    name: '交易站',
    cost: 55,
    produce: 3,
    upkeep: 0,
    note: '每多一种其他设施，产出 +1',
    concept: '组合带来的协同收益',
  },
  wall: {
    name: '围墙',
    cost: 25,
    produce: 0,
    upkeep: 1,
    note: '挡住掠夺者',
    concept: '保险：平时是成本，出事时保命',
  },
  truck: {
    name: '装甲车',
    cost: 40,
    produce: 0,
    upkeep: 3,
    note: '搜刮收获 +30%，但每周烧油',
    concept: '负债：看着像资产，其实每周在吃钱',
  },
};
