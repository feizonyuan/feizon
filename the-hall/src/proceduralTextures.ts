// All textures are drawn at runtime on offscreen 2D canvases. No external assets.
import * as THREE from 'three/webgpu';

// ---------------------------------------------------------------- utilities
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value-noise field. `period` = lattice cells across the tile. */
function makeNoise(seed: number, period: number) {
  const rnd = mulberry32(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    // x,y in [0,1) tile space
    const fx = x * period, fy = y * period;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = s(fx - ix), ty = s(fy - iy);
    const x0 = ((ix % period) + period) % period, y0 = ((iy % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = grid[y0 * period + x0], b = grid[y0 * period + x1];
    const c = grid[y1 * period + x0], d = grid[y1 * period + x1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

function makeFbm(seed: number, basePeriod: number, octaves = 5) {
  const layers = Array.from({ length: octaves }, (_, i) => makeNoise(seed + i * 101, basePeriod << i));
  return (x: number, y: number) => {
    let v = 0, amp = 0.5, norm = 0;
    for (const n of layers) { v += n(x, y) * amp; norm += amp; amp *= 0.5; }
    return v / norm;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat !== false) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 8;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const clamp = (v: number, a = 0, b = 255) => (v < a ? a : v > b ? b : v);

/** Per-pixel painter helper. fn returns [r,g,b] (0..255) and optional alpha. */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, fn: (u: number, v: number, x: number, y: number) => number[]) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      d[i] = clamp(p[0]); d[i + 1] = clamp(p[1]); d[i + 2] = clamp(p[2]); d[i + 3] = p.length > 3 ? clamp(p[3]) : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function crack(ctx: CanvasRenderingContext2D, rnd: () => number, x: number, y: number, len: number, w: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y);
  let a = rnd() * Math.PI * 2;
  for (let i = 0; i < len; i++) {
    a += (rnd() - 0.5) * 0.9;
    x += Math.cos(a) * 4; y += Math.sin(a) * 4;
    ctx.lineTo(x, y);
    if (rnd() < 0.05) crack(ctx, rnd, x, y, len * 0.4, w * 0.6, color);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------- surfaces

/** Concrete wall: covers 4m (u) x 3.6m (v). Damp at the bottom, leak streaks from the top. */
export function concreteWall(seed = 1, tint: [number, number, number] = [118, 116, 110]) {
  const W = 512, H = 512;
  const { c, ctx } = canvas(W, H);
  const f = makeFbm(seed, 4, 6), g = makeFbm(seed + 7, 16, 3), streak = makeNoise(seed + 3, 64);
  paint(ctx, W, H, (u, v) => {
    const vv = 1 - v; // 0 bottom, 1 top
    const n = f(u, v), m = g(u, v);
    let k = 0.55 + (n - 0.5) * 0.7 + (m - 0.5) * 0.25;
    // leak streaks from ceiling
    const s = streak(u, 0.5);
    const reach = 0.35 + streak(u * 0.37 % 1, 0.8) * 0.65; // each streak runs a different length
    const leak = Math.max(0, s - 0.7) * 2.4 * Math.max(0, (vv - (1 - reach)) / reach);
    k -= leak * 0.4;
    // damp band at the floor
    const damp = Math.pow(1 - Math.min(1, vv / 0.28), 1.7) * (0.6 + 0.4 * n);
    k -= damp * 0.5;
    const grain = (Math.random() - 0.5) * 0.08;
    k += grain;
    return [tint[0] * k, tint[1] * k, tint[2] * k * (1 - damp * 0.15)];
  });
  const rnd = mulberry32(seed * 13);
  for (let i = 0; i < 7; i++) crack(ctx, rnd, rnd() * W, rnd() * H, 20 + rnd() * 40, 1.2, 'rgba(25,24,22,0.7)');
  // blotches
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '20,22,20' : '160,155,140'},${0.05 + rnd() * 0.08})`;
    ctx.beginPath(); ctx.ellipse(rnd() * W, rnd() * H, 5 + rnd() * 40, 5 + rnd() * 30, rnd() * 3, 0, 7); ctx.fill();
  }
  // formwork seam
  ctx.fillStyle = 'rgba(30,30,28,0.35)'; ctx.fillRect(0, H * 0.33, W, 2); ctx.fillRect(W * 0.5, 0, 2, H);
  return toTexture(c);
}

export function ceilingTex(seed = 5) {
  const W = 512, H = 512;
  const { c, ctx } = canvas(W, H);
  const f = makeFbm(seed, 4, 6), st = makeFbm(seed + 9, 3, 4);
  paint(ctx, W, H, (u, v) => {
    const n = f(u, v), s = st(u, v);
    let k = 0.42 + (n - 0.5) * 0.5;
    // water stain rings
    const ring = Math.abs(s - 0.55);
    if (s > 0.55) k -= 0.18 + (s - 0.55) * 0.6;
    if (ring < 0.012) k -= 0.12;
    k += (Math.random() - 0.5) * 0.06;
    return [92 * k, 90 * k, 86 * k];
  });
  ctx.fillStyle = 'rgba(15,15,15,0.55)';
  ctx.fillRect(0, 0, W, 3); ctx.fillRect(0, 0, 3, H);
  return toTexture(c);
}

/** Tileable floor detail (2m x 2m): terrazzo / worn concrete. */
export function floorDetail(seed = 11) {
  const W = 512, H = 512;
  const { c, ctx } = canvas(W, H);
  const f = makeFbm(seed, 4, 6);
  paint(ctx, W, H, (u, v) => {
    const n = f(u, v);
    let k = 0.5 + (n - 0.5) * 0.6;
    const r = Math.random();
    if (r < 0.03) k += 0.35; else if (r < 0.06) k -= 0.25;
    return [80 * k, 88 * k, 90 * k];
  });
  const rnd = mulberry32(seed);
  for (let i = 0; i < 60; i++) { // scratches
    ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '200,200,195' : '10,12,12'},${0.05 + rnd() * 0.12})`;
    ctx.lineWidth = 0.6 + rnd();
    const x = rnd() * W, y = rnd() * H, a = rnd() * 6.28, l = 10 + rnd() * 60;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  for (let i = 0; i < 4; i++) crack(ctx, rnd, rnd() * W, rnd() * H, 30, 1, 'rgba(15,15,15,0.6)');
  return toTexture(c);
}

/**
 * Floor macro mask spanning the whole level floor.
 * R = wetness (puddles), G = grime/dryness brightness, B = random.
 * Covers X in [xMin,xMax], Z in [zMax(0.5) .. zMin]. u -> x, v -> z (v=0 at zStart).
 */
export function floorMacro(w: number, h: number, mapX: (u: number) => number, mapZ: (v: number) => number, seed = 21) {
  const { c, ctx } = canvas(w, h);
  const f = makeFbm(seed, 6, 5), f2 = makeFbm(seed + 5, 24, 3);
  const aspect = h / w;
  paint(ctx, w, h, (u, v) => {
    const x = mapX(u), z = mapZ(v);
    // noise sampled in roughly isotropic world space
    const n = f(u * 0.9, (v * aspect * 0.9) % 1);
    const n2 = f2(u, (v * aspect) % 1);
    let wet = n * 0.8 + n2 * 0.25;
    // more water on corridor center and under windows / in front of doors
    if (x > -2.2 && x < 2.2) {
      wet += 0.12 * Math.exp(-x * x / 1.2);
      wet += 0.15 * Math.exp(-Math.pow(x + 1.9, 2) / 0.08);
    }
    wet += 0.12 * Math.exp(-Math.pow(z + 7.2, 2) / 3) * Math.exp(-Math.pow(x - 2, 2) / 2);
    wet += 0.12 * Math.exp(-Math.pow(z + 24, 2) / 3) * Math.exp(-Math.pow(x - 2, 2) / 2);
    wet += 0.1 * Math.exp(-Math.pow(z + 18.5, 2) / 2) * Math.exp(-Math.pow(x - 1, 2) / 1);
    if (z > -1.2) wet -= 0.25; // dry spawn area
    // grime near wall bases
    const edge = Math.min(Math.abs(x + 1.95), Math.abs(x - 2.2));
    const grime = 0.75 + n2 * 0.4 - Math.exp(-edge * edge / 0.05) * 0.35;
    return [wet * 255, grime * 200, Math.random() * 255];
  });
  const t = toTexture(c, { repeat: false, srgb: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Tileable RGB noise used for ripple distortion / normal jitter. */
export function noiseTex(seed = 31) {
  const W = 256, H = 256;
  const { c, ctx } = canvas(W, H);
  const a = makeFbm(seed, 8, 3), b = makeFbm(seed + 3, 8, 3), d = makeFbm(seed + 6, 32, 2);
  paint(ctx, W, H, (u, v) => [a(u, v) * 255, b(u, v) * 255, d(u, v) * 255]);
  return toTexture(c, { srgb: false });
}

/** Peeled plaster revealing red brick. Covers 6m x 3.6m. */
export function brickWall(seed = 41) {
  const W = 1024, H = 616;
  const { c, ctx } = canvas(W, H);
  const f = makeFbm(seed, 5, 6), fine = makeFbm(seed + 2, 40, 2), leak = makeNoise(seed + 9, 48);
  const bw = 0.215 * (W / 6), bh = 0.065 * (H / 3.6); // brick in px
  const brickRnd = mulberry32(seed + 77);
  const brickShade: number[] = [];
  for (let i = 0; i < 4000; i++) brickShade.push(brickRnd());
  paint(ctx, W, H, (u, v, x, y) => {
    const vv = 1 - v;
    const row = Math.floor(y / bh);
    const off = (row % 2) * bw * 0.5;
    const col = Math.floor((x + off) / bw);
    const bx = (x + off) - col * bw, by = y - row * bh;
    const mortar = bx < 3 || by < 3;
    const sh = brickShade[(row * 61 + col * 7) % brickShade.length];
    const fn = fine(u, v);
    let br: number[];
    if (mortar) br = [70 + fn * 30, 66 + fn * 28, 60 + fn * 25];
    else {
      const k = 0.6 + sh * 0.45 + (fn - 0.5) * 0.4;
      br = [120 * k, 48 * k, 36 * k];
    }
    // plaster mask
    const m = f(u, v);
    const plasterAmt = m - 0.47 + (vv > 0.85 ? 0.1 : 0) + (vv < 0.12 ? 0.08 : 0);
    let col3: number[];
    if (plasterAmt > 0.02) {
      const k = 0.5 + (fine(u * 2 % 1, v) - 0.5) * 0.4 + (m - 0.5) * 0.4;
      col3 = [112 * k, 110 * k, 104 * k];
    } else if (plasterAmt > -0.01) {
      col3 = [30, 27, 25]; // thickness edge shadow
    } else col3 = br;
    // rust leaks
    const l = Math.max(0, leak(u, 0.3) - 0.6) * 2.6 * Math.pow(vv, 0.9);
    col3 = [col3[0] * (1 - l * 0.5) + 70 * l * 0.5, col3[1] * (1 - l * 0.7) + 32 * l * 0.3, col3[2] * (1 - l * 0.8) + 12 * l * 0.2];
    const damp = Math.pow(1 - Math.min(1, vv / 0.25), 1.5);
    const k = 1 - damp * 0.5;
    return [col3[0] * k, col3[1] * k, col3[2] * k];
  });
  return toTexture(c);
}

export function brickOnly(seed = 43) {
  const W = 512, H = 512;
  const { c, ctx } = canvas(W, H);
  const fine = makeFbm(seed, 16, 3), big = makeFbm(seed + 1, 3, 3);
  const bw = 512 / 12, bh = 512 / 24;
  const rnd = mulberry32(seed);
  const sh: number[] = []; for (let i = 0; i < 2000; i++) sh.push(rnd());
  paint(ctx, W, H, (u, v, x, y) => {
    const row = Math.floor(y / bh), off = (row % 2) * bw * 0.5;
    const col = Math.floor(((x + off) % W) / bw);
    const bx = ((x + off) % W) - col * bw, by = y - row * bh;
    const fn = fine(u, v), bg = big(u, v);
    if (bx < 2.5 || by < 2.5) return [60 + fn * 25, 57 + fn * 22, 52 + fn * 20];
    const k = (0.55 + sh[(row * 37 + col) % 2000] * 0.45 + (fn - 0.5) * 0.4) * (0.7 + bg * 0.5);
    const damp = Math.pow(Math.max(0, v - 0.75) / 0.25, 1.5);
    return [110 * k * (1 - damp * 0.4), 44 * k * (1 - damp * 0.4), 34 * k * (1 - damp * 0.4)];
  });
  return toTexture(c);
}

export function rustyMetal(seed = 51, base: [number, number, number] = [60, 62, 60]) {
  const W = 256, H = 256;
  const { c, ctx } = canvas(W, H);
  const f = makeFbm(seed, 4, 5), r = makeFbm(seed + 4, 8, 4);
  paint(ctx, W, H, (u, v) => {
    const n = f(u, v), rr = r(u, v);
    const rust = Math.max(0, rr - 0.55) * 3.5 + Math.max(0, v - 0.7) * 0.8 * rr;
    const k = 0.7 + (n - 0.5) * 0.5 + (Math.random() - 0.5) * 0.08;
    return [
      base[0] * k * (1 - rust) + 105 * rust * k,
      base[1] * k * (1 - rust) + 52 * rust * k,
      base[2] * k * (1 - rust) + 24 * rust * k,
    ];
  });
  const rnd = mulberry32(seed);
  for (let i = 0; i < 50; i++) {
    ctx.strokeStyle = `rgba(190,190,185,${0.05 + rnd() * 0.15})`; ctx.lineWidth = 0.6;
    const x = rnd() * W, y = rnd() * H;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 12); ctx.stroke();
  }
  return toTexture(c);
}

export function woodTex(seed = 61) {
  const W = 256, H = 64;
  const { c, ctx } = canvas(W, H);
  const f = makeFbm(seed, 4, 4);
  paint(ctx, W, H, (u, v) => {
    const n = f(u, v);
    const grain = Math.sin((v * 40 + n * 12) * 1.0) * 0.5 + 0.5;
    const k = 0.45 + grain * 0.18 + (n - 0.5) * 0.3;
    return [128 * k, 108 * k, 84 * k];
  });
  return toTexture(c);
}

// ---------------------------------------------------------------- decals and signs

export function graffitiVolt() {
  const W = 1024, H = 512;
  const { c, ctx } = canvas(W, H);
  const rnd = mulberry32(99);
  ctx.translate(W / 2, H / 2); ctx.rotate(-0.06);
  ctx.font = 'italic 900 250px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // outline / shadow
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = 'rgba(12,12,14,0.95)'; ctx.lineWidth = 34; ctx.strokeText('VOLT', 10, 14);
  const grad = ctx.createLinearGradient(0, -120, 0, 120);
  grad.addColorStop(0, '#e8ece9'); grad.addColorStop(0.55, '#9ea3a4'); grad.addColorStop(1, '#5d6264');
  ctx.fillStyle = grad; ctx.fillText('VOLT', 0, 0);
  ctx.strokeStyle = '#f4f6f4'; ctx.lineWidth = 5; ctx.strokeText('VOLT', 0, 0);
  // drips
  ctx.fillStyle = 'rgba(200,205,205,0.85)';
  for (let i = 0; i < 14; i++) {
    const x = -330 + rnd() * 660, y = 70 + rnd() * 40, l = 20 + rnd() * 110;
    ctx.fillRect(x, y, 3 + rnd() * 3, l);
    ctx.beginPath(); ctx.arc(x + 2.5, y + l, 3.5, 0, 7); ctx.fill();
  }
  // stars
  const star = (x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.25 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = '#f2f4f2';
  star(-400, -120, 38); star(390, -140, 26); star(420, 110, 18); star(-360, 140, 14);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // overspray speckle + erosion
  const img = ctx.getImageData(0, 0, W, H); const d = img.data;
  const er = makeFbm(5, 8, 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const e = er(x / W, y / H);
    if (d[i + 3] > 0) d[i + 3] *= Math.min(1, Math.max(0.15, (e - 0.25) * 2.2)) * (0.85 + Math.random() * 0.15);
    else if (Math.random() < 0.004) { d[i] = d[i + 1] = d[i + 2] = 210; d[i + 3] = 120; }
  }
  ctx.putImageData(img, 0, 0);
  // a scrawled warning underneath
  ctx.font = '600 34px "Courier New", monospace';
  ctx.fillStyle = 'rgba(150,20,18,0.85)';
  ctx.save(); ctx.translate(560, 470); ctx.rotate(0.03); ctx.fillText("DON'T LOOK AWAY", 0, 0); ctx.restore();
  return toTexture(c, { repeat: false });
}

export function stencil07() {
  const W = 512, H = 512;
  const { c, ctx } = canvas(W, H);
  ctx.font = '900 360px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(22,24,24,0.92)';
  ctx.fillText('07', W / 2, H / 2 + 10);
  // stencil bridges
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(W / 2 - 115, H / 2 - 160, 16, 340);
  ctx.fillRect(W / 2 + 70, H / 2 - 160, 16, 120);
  ctx.globalCompositeOperation = 'source-over';
  const img = ctx.getImageData(0, 0, W, H); const d = img.data;
  const er = makeFbm(17, 6, 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i + 3] > 0) {
      d[i + 3] *= Math.min(1, Math.max(0, (er(x / W, y / H) - 0.28) * 2.5));
      if (y > 5 && Math.random() < 0.0015) for (let k = 1; k < 40; k++) { const j = ((y + k) * W + x) * 4; if (j < d.length) { d[j] = 22; d[j + 1] = 24; d[j + 2] = 24; d[j + 3] = Math.max(d[j + 3], 160 - k * 4); } }
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { repeat: false });
}

export function vendingSign() {
  const W = 1024, H = 256;
  const { c, ctx } = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffb45a'); g.addColorStop(0.5, '#ff9a3c'); g.addColorStop(1, '#e8701e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,240,200,0.25)';
  for (let i = 0; i < 8; i++) ctx.fillRect(0, i * 32, W, 2);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3a0d04';
  ctx.font = '900 118px "Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","Noto Sans CJK JP",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ヨルコーラ', 40, 112);
  ctx.font = 'italic 900 74px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('YORU', W - 40, 82);
  ctx.fillText('COLA', W - 40, 170);
  ctx.font = '700 28px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('つめた〜い  ICE COLD  夜の味', 46, 210);
  ctx.strokeStyle = '#fff2d0'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, W - 20, H - 20);
  return toTexture(c, { repeat: false });
}

export function vendingPanel() {
  const W = 256, H = 768;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#0d0f10'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8e8e4'; ctx.textAlign = 'center';
  ctx.font = '900 64px "Arial Black", sans-serif'; ctx.fillText('¥150', W / 2, 90);
  // IC reader
  ctx.fillStyle = '#123b52'; ctx.fillRect(48, 140, 160, 120);
  ctx.strokeStyle = '#59d6ff'; ctx.lineWidth = 5; ctx.strokeRect(48, 140, 160, 120);
  ctx.fillStyle = '#9cecff'; ctx.font = '900 70px Arial, sans-serif'; ctx.fillText('IC', W / 2, 225);
  // coin slot
  ctx.fillStyle = '#8b8f93'; ctx.fillRect(78, 300, 100, 60);
  ctx.fillStyle = '#050505'; ctx.fillRect(122, 308, 12, 44);
  // return lever
  ctx.fillStyle = '#a9adb0'; ctx.beginPath(); ctx.arc(W / 2, 410, 26, 0, 7); ctx.fill();
  ctx.fillStyle = '#e0e0e0'; ctx.font = '700 20px Arial'; ctx.fillText('返却 RETURN', W / 2, 462);
  // keypad
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
    ctx.fillStyle = '#24292c'; ctx.fillRect(52 + k * 54, 500 + r * 54, 44, 44);
    ctx.fillStyle = '#ff6a2f'; ctx.font = '700 22px "Courier New"';
    ctx.fillText(String(r * 3 + k + 1).slice(-1), 74 + k * 54, 530 + r * 54);
  }
  ctx.fillStyle = '#55ff88'; ctx.font = '700 26px "Courier New"'; ctx.fillText('-- 0 --', W / 2, 735);
  return toTexture(c, { repeat: false });
}

export function pushStrip() {
  const W = 512, H = 96;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#1a0503'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#ff3b2f'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = '#ff7b4c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 46px "Arial Black", sans-serif'; ctx.fillText('PUSH', 140, H / 2);
  ctx.font = '900 44px "Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif'; ctx.fillText('取出口', 370, H / 2 + 2);
  return toTexture(c, { repeat: false });
}

export function vendingBody(seed = 71) {
  const W = 512, H = 512;
  const { c, ctx } = canvas(W, H);
  const f = makeFbm(seed, 4, 5);
  paint(ctx, W, H, (u, v) => {
    const k = 0.75 + (f(u, v) - 0.5) * 0.5 + (Math.random() - 0.5) * 0.06;
    const drip = Math.max(0, v - 0.75) * 0.8;
    return [40 * k * (1 - drip * 0.3), 42 * k, 44 * k];
  });
  const rnd = mulberry32(seed);
  for (let i = 0; i < 120; i++) {
    ctx.strokeStyle = `rgba(200,200,200,${0.04 + rnd() * 0.12})`; ctx.lineWidth = 0.7;
    const x = rnd() * W, y = rnd() * H;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 20); ctx.stroke();
  }
  // stickers
  const colors = ['#d8d24a', '#e05a7a', '#5ab4e0', '#f0f0ea', '#ff7a2a'];
  for (let i = 0; i < 9; i++) {
    ctx.save(); ctx.translate(rnd() * W, 150 + rnd() * 300); ctx.rotate((rnd() - 0.5) * 0.6);
    ctx.fillStyle = colors[i % colors.length]; ctx.globalAlpha = 0.55 + rnd() * 0.3;
    const w = 30 + rnd() * 60, h = 20 + rnd() * 40;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#111'; ctx.font = '700 12px monospace'; ctx.fillText(['NO SIGNAL', '夜', 'K7', 'HELP', '404'][i % 5], -w / 2 + 4, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
  ctx.font = '24px "Comic Sans MS", cursive'; ctx.fillStyle = 'rgba(230,230,230,0.6)';
  ctx.fillText('it watches', 60, 460);
  return toTexture(c, { repeat: false });
}

export function chainLink() {
  const W = 256, H = 256;
  const { c, ctx } = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(150,155,150,1)'; ctx.lineWidth = 5;
  const s = 64;
  for (let i = -4; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s + H, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * s + H, 0); ctx.lineTo(i * s, H); ctx.stroke();
  }
  return toTexture(c);
}

export function paperNote(lines: string[]) {
  const W = 256, H = 320;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#d9d4c2'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2a2a33'; ctx.font = '18px "Courier New", monospace';
  lines.forEach((l, i) => ctx.fillText(l, 16, 40 + i * 26));
  return toTexture(c, { repeat: false });
}

export function warningSign(text: string, sub: string) {
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#d8b21c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#111';
  for (let i = -4; i < 20; i++) { ctx.beginPath(); ctx.moveTo(i * 40, 0); ctx.lineTo(i * 40 + 20, 0); ctx.lineTo(i * 40 - 20, 40); ctx.lineTo(i * 40 - 40, 40); ctx.fill(); }
  ctx.font = '900 64px "Arial Black", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, 130);
  ctx.font = '700 30px Arial'; ctx.fillText(sub, W / 2, 200);
  const img = ctx.getImageData(0, 0, W, H); const d = img.data; const er = makeFbm(3, 5, 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const k = 0.55 + er(x / W, y / H) * 0.6; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { repeat: false });
}
