// 章节：每章只多引入一组新规则。通关上一章后解锁下一章。
export const CHAPTERS = [
  {
    id: 1,
    name: '自给',
    tagline: '让避难所自己养活自己',
    intro: '每天大家都要吃饭，物资只能靠你出门去找。建起能自己产出的设施，直到自产够吃为止。',
    facilities: ['farm', 'purifier'],
    events: ['quiet', 'windfall', 'breakdown'],
    borrow: false,
    winter: false,
  },
  {
    id: 2,
    name: '赊账',
    tagline: '隔壁据点愿意借粮，但要利息',
    intro: '现在可以向隔壁据点借粮了，每天利息一成。外面也多了掠夺者，和一些话说得很好听的商队。',
    facilities: ['farm', 'purifier', 'wall'],
    events: ['quiet', 'windfall', 'breakdown', 'raid', 'scam'],
    borrow: true,
    winter: false,
  },
  {
    id: 3,
    name: '寒冬',
    tagline: '完整的世界，每十二天有三天寒冬',
    intro: '每十二天的最后三天是寒冬：搜刮变难，农场减产。但熬得住的人，能在寒冬里低价买到别人撑不下去卖掉的设备。',
    facilities: ['farm', 'purifier', 'solar', 'tradepost', 'wall', 'truck'],
    events: ['quiet', 'windfall', 'breakdown', 'raid', 'scam', 'blight', 'shortage', 'refugee'],
    borrow: true,
    winter: true,
  },
];

export function chapterById(id) {
  return CHAPTERS.find((c) => c.id === id) ?? CHAPTERS[CHAPTERS.length - 1];
}
