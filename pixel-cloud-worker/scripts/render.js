// Render frames with headless Chromium and pipe them into ffmpeg.
//   node render.js --stills 1.0,7.5,...   -> out/stills/t_XX.png
//   node render.js --from 0 --to 300 --out seg0.mp4  (frame range)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
require('./build_data.js');
const tl = JSON.parse(fs.readFileSync(path.join(root, 'timeline.json')));

(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const scale = +(args.scale || 1);
  await page.addInitScript(sc => { window.SCALE = sc; }, scale);
  await page.goto('file://' + path.join(root, 'src', 'index.html'));
  console.log(await page.evaluate(() => window.renderReady));
  if (errors.length) { console.error(errors); process.exit(1); }
  const grab = async t => {
    const url = await page.evaluate(t => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/png'); }, t);
    if (errors.length) { console.error('t=' + t, errors); process.exit(1); }
    return Buffer.from(url.split(',')[1], 'base64');
  };
  if (args.stills) {
    const dir = path.join(root, 'out', 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const s of args.stills.split(',')) fs.writeFileSync(path.join(dir, `t_${(+s).toFixed(2)}.png`), await grab(+s));
  } else {
    const fps = tl.fps, total = Math.round(tl.duration * fps);
    const from = +(args.from || 0), to = Math.min(+(args.to || total), total);
    const out = path.join(root, 'out', args.out || 'video.mp4');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', args.crf || '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = from; f < to; f++) {
      const buf = await grab(f / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - from) % 150 === 0) console.log(`${out}: frame ${f}/${to} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
