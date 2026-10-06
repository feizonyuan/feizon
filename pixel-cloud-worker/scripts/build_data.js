// Bundle timeline + subtitle text + voice durations into src/data.js for the page.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const tl = JSON.parse(fs.readFileSync(path.join(root, 'timeline.json')));
const lines = JSON.parse(fs.readFileSync(path.join(root, 'script.json')));
const dur = JSON.parse(fs.readFileSync(path.join(root, 'audio', 'durations.json')));
const subs = tl.voice.map(v => { const l = lines.find(x => x.id === v.id); return { at: v.at, dur: dur[v.id].dur, zh: l.zh, en: l.en }; });
fs.writeFileSync(path.join(root, 'src', 'data.js'), `window.TL=${JSON.stringify(tl)};\nwindow.SUBS=${JSON.stringify(subs)};\n`);
