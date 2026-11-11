// 把游戏打包成单个 HTML 文件（dist/shelter.html），方便直接分享或发布。
// 用法：npm run bundle（需要能运行 npx esbuild）
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = execFileSync(
  'npx',
  ['--yes', 'esbuild@0.21.5', 'src/ui/app.js', '--bundle', '--format=iife', '--minify', '--charset=utf8', '--target=es2022'],
  { cwd: here, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
);
const css = readFileSync(join(here, 'src/ui/styles.css'), 'utf8');

const html = `<title>避难所：不再出门</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=ZCOOL+QingKe+HuangYou&display=swap">
<style>
${css}
</style>
<div id="app"></div>
<script>
${js.replaceAll('</script', '<\\/script')}
</script>
`;

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist/shelter.html'), html);
console.log(`dist/shelter.html ${(html.length / 1024).toFixed(1)} KB`);
