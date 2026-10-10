// Build the timeline from the voice-over durations and bundle it into src/data.js.
// Every scene starts with a short lead-in, lines follow each other with a small gap,
// and each quest scene keeps a tail for its "quest clear" pop-up.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const lines = JSON.parse(fs.readFileSync(path.join(root, 'script.json')));
const dur = JSON.parse(fs.readFileSync(path.join(root, 'audio', 'durations.json')));

const FPS = 60;
const LEAD = { hook: 0.15, intro: 0.25, ai: 0.3, map: 0.3, free: 0.3, body: 0.3, end: 0.3 };
const TAIL = { hook: 0.3, intro: 0.35, ai: 1.15, map: 1.15, free: 1.15, body: 1.15, end: 3.4 };
const GAP = 0.28;
// Subtitle words drawn in the accent colour.
const HL = {
  l01: ['一部手机', '1000块', '怎么翻身'], l02: ['4个反常识'], l03: ['AI化'], l04: ['全部记下来'],
  l05: ['数据永远是你的'], l06: ['先看100套'], l07: ['探一遍'], l08: ['先自由，后财富'], l09: ['锁死'],
  l10: ['水草'], l11: ['身体越值钱'], l12: ['寿命'], l13: ['银行账户'], l14: ['多创造，少消费'], l15: ['最不同意'],
};

const order = [...new Set(lines.map(l => l.scene))];
const scenes = [];
let t = 0;
for (const id of order) {
  const s = { id, start: +t.toFixed(3), lines: [] };
  t += LEAD[id];
  for (const l of lines.filter(x => x.scene === id)) {
    const d = dur[l.id].dur;
    s.lines.push({ id: l.id, at: +t.toFixed(3), dur: d, zh: l.zh, hl: HL[l.id] || [] });
    t += d + GAP;
  }
  t += TAIL[id] - GAP;
  s.end = +t.toFixed(3);
  scenes.push(s);
}
const tl = { fps: FPS, duration: +t.toFixed(3), scenes };
fs.writeFileSync(path.join(root, 'timeline.json'), JSON.stringify(tl, null, 1));
fs.writeFileSync(path.join(root, 'src', 'data.js'), `window.TL=${JSON.stringify(tl)};\n`);
if (require.main === module) {
  for (const s of scenes) console.log(s.id.padEnd(6), s.start.toFixed(2), '→', s.end.toFixed(2), s.lines.map(l => `${l.id}@${l.at.toFixed(2)}`).join(' '));
  console.log('duration', tl.duration);
}
