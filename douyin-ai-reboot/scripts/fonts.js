// Copy only the font chunks this film uses (from @fontsource packages unpacked in FONT_SRC)
// into src/fonts/, and write src/fonts.css + src/corpus.js.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const SRC = process.env.FONT_SRC;
const corpus = [...new Set(fs.readFileSync(path.join(root, 'src', 'scenes.js'), 'utf8') + fs.readFileSync(path.join(root, 'script.json'), 'utf8') +
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:;!?¥%+-=×/→()（）')].join('');
const cps = [...corpus].map(ch => ch.codePointAt(0));
const FACES = [
  ['noto-sans-sc', ['500.css', '700.css', '900.css']],
  ['zcool-qingke-huangyou', ['400.css']],
  ['press-start-2p', ['400.css']],
];
const out = [];
fs.rmSync(path.join(root, 'src', 'fonts'), { recursive: true, force: true });
fs.mkdirSync(path.join(root, 'src', 'fonts'), { recursive: true });
for (const [pkg, files] of FACES) {
  const dir = fs.readdirSync(SRC).find(d => d.startsWith('fontsource-' + pkg + '-') && !d.endsWith('.tgz'));
  for (const f of files) {
    const css = fs.readFileSync(path.join(SRC, dir, 'package', f), 'utf8');
    for (const block of css.match(/@font-face\s*{[^}]*}/g)) {
      const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
      const file = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1];
      const ranges = range ? range.split(',').map(r => r.trim().replace('U+', '').split('-').map(h => parseInt(h.replace(/\?/g, '0'), 16))) : [[0, 0x10ffff]];
      if (!cps.some(cp => ranges.some(([a, b = a]) => cp >= a && cp <= b))) continue;
      fs.copyFileSync(path.join(SRC, dir, 'package', 'files', file), path.join(root, 'src', 'fonts', file));
      out.push(block.replace(/src:[^;]+;/, `src: url(fonts/${file}) format("woff2");`).replace(/font-display:[^;]+;/, ''));
    }
  }
}
fs.writeFileSync(path.join(root, 'src', 'fonts.css'), out.join('\n') + '\n');
fs.writeFileSync(path.join(root, 'src', 'corpus.js'), `window.CORPUS=${JSON.stringify(corpus)};\n`);
console.log(out.length, 'font chunks');
