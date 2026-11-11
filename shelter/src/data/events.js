// 每周事件。weight 是抽取权重；choices 存在时需要玩家做决定。
export const EVENTS = [
  { id: 'quiet', weight: 30, name: '平静的一周', text: '什么都没发生。' },
  {
    id: 'raid',
    weight: 12,
    name: '掠夺者',
    text: '一伙人盯上了你的仓库。',
    concept: '没有保险时，一次意外就能拿走一大块积蓄',
  },
  {
    id: 'blight',
    weight: 8,
    name: '作物病害',
    text: '所有水培农场停产两周。',
    concept: '收入来源单一时，会一次归零',
  },
  {
    id: 'breakdown',
    weight: 12,
    name: '设备故障',
    text: '发电机坏了，必须马上修。',
    concept: '没有应急储备时，意外支出会直接变成债务',
  },
  {
    id: 'windfall',
    weight: 10,
    name: '路过的商队',
    text: '他们借宿一晚，留下了谢礼。',
  },
  {
    id: 'shortage',
    weight: 8,
    name: '零件紧缺',
    text: '本周拆卖设施可以拿回全价，而不是半价。',
    concept: '市场行情：同一件资产，不同时候卖价不同',
  },
  {
    id: 'refugee',
    weight: 10,
    name: '敲门的幸存者',
    text: '有人请求加入。多一个人搜刮得更多，但每周也多一张嘴。',
    concept: '收入增加时，支出往往跟着增加',
    choices: [
      { id: 'accept', label: '收留' },
      { id: 'decline', label: '婉拒' },
    ],
  },
  {
    id: 'scam',
    weight: 10,
    name: '“稳赚”的商队',
    text: '陌生商队说：交 20 物资入伙，下周还你 40，稳赚不赔。',
    concept: '承诺高回报又零风险的，多半是骗局',
    choices: [
      { id: 'invest', label: '交 20 物资入伙' },
      { id: 'decline', label: '不信' },
    ],
  },
];
