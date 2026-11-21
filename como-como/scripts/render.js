// Render frames with headless Chromium (WebGL via SwiftShader) and pipe PNGs into ffmpeg.
//   node scripts/render.js --stills 1.0,7.5        -> out/stills/t_X.png
//   node scripts/render.js --from 0 --to 300 --out seg0.mp4   (frame range at tl.fps)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const tl = JSON.parse(fs.readFileSync(path.join(root, 'timeline.json')));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.addInitScript(ss => { window.SS = ss; }, +(args.ss || 1));
  await page.goto(`http://127.0.0.1:${port}/src/index.html`);
  await page.waitForFunction(() => window.renderReady, null, { timeout: 120000 }).catch(() => {});
  console.log(await page.evaluate(() => window.renderReady));
  if (errors.length) console.error(errors.slice(0, 10));
  const grab = async t => {
    const url = await page.evaluate(t => { window.renderFrame(t); return document.getElementById('out').toDataURL('image/png'); }, t);
    return Buffer.from(url.split(',')[1], 'base64');
  };
  if (args.stills) {
    const dir = path.join(root, 'out', 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const s of args.stills.split(',')) { const t0 = Date.now(); fs.writeFileSync(path.join(dir, `t_${(+s).toFixed(2)}.png`), await grab(+s)); console.log(s, Date.now() - t0, 'ms'); }
  } else {
    const fps = +(args.fps || tl.fps), total = Math.round(tl.duration * fps);
    const from = +(args.from || 0), to = Math.min(+(args.to || total), total);
    const out = path.join(root, 'out', args.out || 'video.mp4');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', args.crf || '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = from; f < to; f++) {
      const buf = await grab(f / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - from) % 60 === 0) console.log(`${path.basename(out)}: frame ${f}/${to} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  if (errors.length) console.error('errors:', errors.slice(0, 10));
  await browser.close(); server.close();
})();
