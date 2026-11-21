// "¿Cómo como?" — every frame is a pure function of t (seconds).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const D = window.DATA, TL = D.tl;
const W = 1920, H = 1080, SS = window.SS || 1;           // SS = supersampling of the 3D layer
const out = document.getElementById('out'); const ctx = out.getContext('2d');

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
const easeInOut = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const backOut = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const springPop = (dt, f = 9, d = 7) => dt < 0 ? 0 : Math.exp(-d * dt) * Math.sin(f * dt * Math.PI);
function envAt(who, t) {
  const a = D.env[who]; const x = t * D.envFps; const i = Math.floor(x);
  if (i < 0 || i + 1 >= a.length) return 0;
  return lerp(a[i], a[i + 1], x - i);
}
const envS = (who, t) => Math.max(envAt(who, t), 0.8 * envAt(who, t - 0.03), 0.6 * envAt(who, t - 0.06));
const col = h => new THREE.Color(h);
// fonts first: canvas textures below draw text at build time
{ const allText = JSON.stringify(TL) + '¿Cómo como?¡Como como como!我怎么吃？我就这么吃！大约十个como diez PIPAS MIEL OLIVAS PIMIENTO AJO CAFÉ';
  await Promise.all(['900 46px "Noto Sans SC"', '700 80px Fredoka', '600 80px Fredoka'].map(f => document.fonts.load(f, allText))); }

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W * SS, H * SS, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = col('#2a1a12');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 60);

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const woodTex = (base, dark, seed = 1) => canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const y = hash(i * 3.1 + seed) * h, a = 0.05 + 0.12 * hash(i + seed * 9);
    g.strokeStyle = dark; g.globalAlpha = a; g.lineWidth = 1 + 3 * hash(i * 7 + seed);
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + 6 * Math.sin(x * 0.006 + i) + 3 * Math.sin(x * 0.02 + i * 2));
    g.stroke();
  }
  g.globalAlpha = 1;
});
const tileTex = canvasTex(512, 512, (g, w) => {          // hand-painted azulejo, 2x2 tiles
  const s = w / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = i * s, y = j * s;
    g.fillStyle = '#d8ccb2'; g.fillRect(x, y, s, s);
    g.strokeStyle = '#1f4e8c'; g.fillStyle = '#2a63a8'; g.lineWidth = 6;
    g.save(); g.translate(x + s / 2, y + s / 2);
    for (let k = 0; k < 4; k++) {
      g.rotate(Math.PI / 2);
      g.beginPath(); g.ellipse(0, -s * 0.22, s * 0.07, s * 0.17, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(s / 2, s / 2, s * 0.2, Math.PI, Math.PI * 1.5); g.stroke();
    }
    g.fillStyle = '#e8a93a'; g.beginPath(); g.arc(0, 0, s * 0.07, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(120,100,80,.5)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
  }
}, [10, 3]);
const plasterTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#7a4a2c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${hash(i) > .5 ? '255,220,180' : '90,50,30'},${0.04 * hash(i * 3)})`;
    const r = 4 + 30 * hash(i * 5); g.beginPath(); g.arc(hash(i * 7) * w, hash(i * 11) * h, r, 0, 7); g.fill(); }
}, [4, 2]);
function labelTex(text, bg, fg) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 40); g.fill();
    g.strokeStyle = fg; g.lineWidth = 8; g.beginPath(); g.roundRect(24, 24, w - 48, h - 48, 28); g.stroke();
    g.fillStyle = fg; g.font = '700 110px Fredoka'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 6);
  });
}

// ---------------------------------------------------------------- materials
const plush = (opts = {}) => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, sheen: 0.8, sheenRoughness: 0.5,
  sheenColor: col('#fff1dd'), clearcoat: 0.12, clearcoatRoughness: 0.6, ...opts });
const gloss = c => new THREE.MeshPhysicalMaterial({ color: col(c), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
const matte = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: col(c), roughness: r });

// ellipsoid with per-vertex colour from a function of the unit-sphere direction
function blob(r, colorFn, mat, seg = 64) {
  let g = new THREE.SphereGeometry(1, seg, seg / 2 | 0);
  const p = g.attributes.position, cs = new Float32Array(p.count * 3), v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); colorFn(v, c); cs.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(cs, 3));
  g.scale(r[0], r[1], r[2]);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
const mixC = (a, b, k, out) => out.copy(a).lerp(b, clamp(k));
const solid = (r, hex, mat) => blob(r, (v, c) => c.set(hex), mat || plush());
function eye(r = 0.055) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), gloss('#120c0a')); g.add(ball);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 16, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  hl.position.set(r * 0.35, r * 0.4, r * 0.75); g.add(hl);
  const hl2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.14, 12, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  hl2.position.set(-r * 0.3, -r * 0.35, r * 0.85); g.add(hl2);
  return g;
}
const onE = (c, r, d) => { const n = new THREE.Vector3(...d).normalize(); return new THREE.Vector3(c[0] + n.x * r[0], c[1] + n.y * r[1], c[2] + n.z * r[2]); };

// ---------------------------------------------------------------- set
const set = new THREE.Group(); scene.add(set);
const wood = woodTex('#8a4f2a', '#3b1d0c', 1); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 1);
const counterMat = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 });
const counter = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 3.2), counterMat);
counter.position.set(0, -0.15, -0.1); counter.receiveShadow = true; set.add(counter);
const front = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 0.2), new THREE.MeshStandardMaterial({ map: woodTex('#6e3a1c', '#2c1307', 4), roughness: 0.6 }));
front.position.set(0, -1.1, 1.45); set.add(front);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 9), new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95 }));
wall.position.set(0, 2.2, -4.2); wall.receiveShadow = true; set.add(wall);
const tiles = new THREE.Mesh(new THREE.PlaneGeometry(24, 2.4), new THREE.MeshPhysicalMaterial({ map: tileTex, roughness: 0.25, clearcoat: 0.8 }));
tiles.position.set(0, 0.6, -4.19); set.add(tiles);
// back bar + shelves
const backBar = new THREE.Mesh(new THREE.BoxGeometry(24, 1.1, 0.9), new THREE.MeshStandardMaterial({ map: woodTex('#5c2f16', '#24100a', 7), roughness: 0.55 }));
backBar.position.set(0, -0.35, -3.7); backBar.receiveShadow = true; set.add(backBar);
const shelfMat = new THREE.MeshStandardMaterial({ map: woodTex('#7a4321', '#2f160a', 3), roughness: 0.5 });
for (const y of [1.55, 2.6]) { const s = new THREE.Mesh(new THREE.BoxGeometry(24, 0.08, 0.5), shelfMat); s.position.set(0, y, -3.95); s.castShadow = s.receiveShadow = true; set.add(s); }
// jars / bottles / props on shelves and back bar
const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.28, clearcoat: 1 });
function jar(x, y, z, h, r, fill, label) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true), glass); body.position.y = h / 2; g.add(body);
  const stuff = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.93, r * 0.93, h * 0.72, 32), matte(fill, 0.8)); stuff.position.y = h * 0.37; g.add(stuff);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, h * 0.12, 32), gloss('#b5452c')); lid.position.y = h + h * 0.05; g.add(lid);
  if (label) { const l = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.005, r * 1.005, h * 0.35, 40, 1, true, -Math.PI / 2.2, Math.PI / 1.1),
      new THREE.MeshStandardMaterial({ map: labelTex(label, '#f4e6c8', '#8c2f1c'), roughness: 0.8 })); l.position.y = h * 0.45; g.add(l); }
  g.position.set(x, y, z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); set.add(g); return g;
}
function bottle(x, y, z, h, c) {
  const pts = [[0, 0], [0.14, 0], [0.15, 0.05], [0.15, 0.55], [0.12, 0.66], [0.05, 0.78], [0.045, 1.0], [0.05, 1.02], [0, 1.02]].map(([a, b]) => new THREE.Vector2(a * h * 0.9, b * h));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.85 }));
  m.position.set(x, y, z); m.castShadow = true; set.add(m);
}
const shelfProps = [[-5.5, 'b', '#2f5a2a'], [-4.7, 'j', '#c9a25a', 'MIEL'], [-3.6, 'b', '#6b1f1f'], [-2.8, 'b', '#c79a3b'], [-1.9, 'j', '#57702f', 'OLIVAS'],
  [-0.6, 'b', '#264b2a'], [0.3, 'j', '#b8401f', 'PIMIENTO'], [1.4, 'b', '#6b1f1f'], [2.2, 'b', '#d8c9a0'], [3.2, 'j', '#e3d4a8', 'AJO'], [4.3, 'b', '#2f5a2a'], [5.2, 'j', '#9a5a2a', 'CAFÉ']];
for (const [x, k, c, lb] of shelfProps) k === 'b' ? bottle(x, 1.59, -3.95, 0.7 + 0.2 * hash(x), c) : jar(x, 1.59, -3.95, 0.55, 0.22, c, lb);
for (let i = 0; i < 10; i++) { const x = -5.5 + i * 1.2; i % 3 === 1 ? jar(x, 2.64, -3.95, 0.45, 0.18, ['#d9b36a', '#7b4a2a', '#c43a2a'][i % 3], null) : bottle(x, 2.64, -3.95, 0.5 + 0.15 * hash(i), ['#3d5f2c', '#7c2424', '#caa64a'][i % 3]); }
for (let i = 0; i < 7; i++) bottle(-4.5 + i * 1.5, 0.2, -3.5, 0.55, ['#5a2a1a', '#2c4d2a', '#a8783a'][i % 3]);
// hanging chorizo / peppers strings for flavour, top corners
for (const sx of [-3.3, 3.6]) for (let k = 0; k < 4; k++) {
  const p = solid([0.07, 0.22, 0.07], k % 2 ? '#a8261b' : '#c0392b', new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.7 }));
  p.position.set(sx + k * 0.16, 3.35 - 0.05 * k, -3.2); p.rotation.z = 0.2 * (k - 1.5); set.add(p);
}
// seed jar on the counter next to Hammy — "PIPAS" (sunflower seeds)
const seedJar = jar(-1.85, 0, -0.35, 0.62, 0.24, '#3b3835', 'PIPAS');
seedJar.rotation.y = 0.35;
// a little plant and a saucer on the counter, right side
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 32), new THREE.MeshPhysicalMaterial({ color: '#c46a3c', roughness: 0.7 }));
pot.position.set(2.3, 0.16, -0.7); pot.castShadow = true; set.add(pot);
for (let i = 0; i < 9; i++) { const lf = solid([0.07, 0.2, 0.03], '#4f8a3a'); const a = i / 9 * Math.PI * 2;
  lf.position.set(2.3 + 0.08 * Math.cos(a), 0.45 + 0.06 * hash(i), -0.7 + 0.08 * Math.sin(a)); lf.rotation.set(0.5 * Math.sin(a), a, 0.5 * Math.cos(a)); set.add(lf); }
const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.04, 40), gloss('#f2ecdf')); saucer.position.set(1.95, 0.02, 0.55); saucer.receiveShadow = true; set.add(saucer);

// ---------------------------------------------------------------- lights
const hemi = new THREE.HemisphereLight('#ffd9b0', '#2a160c', 0.35); scene.add(hemi);
const key = new THREE.DirectionalLight('#ffd09a', 2.1); key.position.set(-3, 6, 5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -2;
key.shadow.radius = 6; key.shadow.bias = -0.0004; scene.add(key);
const rim = new THREE.DirectionalLight('#ffc89a', 1.6); rim.position.set(3, 3, -4); scene.add(rim);
const lamp = new THREE.PointLight('#ffb36b', 9, 9, 1.6); lamp.position.set(0, 3.0, -0.2); scene.add(lamp);
const wallGlow = new THREE.PointLight('#ff9a4a', 6, 7, 1.5); wallGlow.position.set(-2, 2.2, -3.2); scene.add(wallGlow);
const disco = ['#ff2d95', '#22d3ee', '#ffb020'].map((c, i) => {
  const s = new THREE.SpotLight(c, 0, 14, 0.42, 0.6, 1.2); s.position.set(-3 + i * 3, 4.5, 2.5); s.target.position.set(0, 0.5, -1); scene.add(s, s.target); return s;
});

// ---------------------------------------------------------------- Hammy (hamster)
const HAM = { gold: col('#e08a3c'), deep: col('#b8622a'), white: col('#fff6ea'), pink: col('#ff9fae') };
const hammy = new THREE.Group(); scene.add(hammy);
const hamBody = new THREE.Group(); hammy.add(hamBody);
const hC = [0, 0.43, 0], hR = [0.47, 0.43, 0.45];
const hamBlob = blob(hR, (v, c) => {
  const belly = smooth(0.0, 0.3, -v.y * 0.9 + v.z * 0.35 - 0.05) * smooth(-0.2, 0.3, v.z);
  const muzzle = smooth(0.3, 0.12, Math.hypot(v.x * 1.1, v.y - 0.02) ) * smooth(0.6, 0.8, v.z);
  mixC(HAM.gold, HAM.white, Math.max(belly, muzzle), c);
  if (v.y > 0.55) c.lerp(HAM.deep, smooth(0.55, 0.95, v.y) * 0.35);
}, plush()); hamBlob.position.set(...hC); hamBody.add(hamBlob);
const hamFace = new THREE.Group(); hamBody.add(hamFace);
const hamEyes = [-1, 1].map(s => { const e = eye(0.058); e.position.copy(onE(hC, hR, [s * 0.36, 0.3, 0.88])); e.position.z -= 0.012; hamFace.add(e); return e; });
const hamNose = solid([0.035, 0.026, 0.03], '#ff7f95', gloss('#ff7f95')); hamNose.position.copy(onE(hC, hR, [0, 0.12, 1])); hamFace.add(hamNose);
const hamMouth = solid([0.04, 0.03, 0.02], '#6b1f2a', matte('#5a1822', 0.5)); hamMouth.position.copy(onE(hC, hR, [0, 0.0, 1])); hamMouth.position.z -= 0.01; hamFace.add(hamMouth);
const hamTeeth = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.01), matte('#ffffff', 0.3)); hamTeeth.position.copy(hamMouth.position).add(new THREE.Vector3(0, 0.012, 0.012)); hamFace.add(hamTeeth);
const blushMat = new THREE.MeshBasicMaterial({ color: '#ff8fa0', transparent: true, opacity: 0.55, depthWrite: false });
const hamBlush = [-1, 1].map(s => { const b = new THREE.Mesh(new THREE.CircleGeometry(0.055, 32), blushMat); b.position.copy(onE(hC, hR, [s * 0.58, 0.1, 0.8])).multiplyScalar(1); b.position.z += 0.005; b.lookAt(b.position.clone().add(new THREE.Vector3(s * 0.6, 0.1, 0.8))); hamFace.add(b); return b; });
const hamCheeks = [-1, 1].map(s => { const ch = blob([0.13, 0.12, 0.12], (v, c) => mixC(HAM.gold, HAM.white, smooth(0.0, 0.7, v.z - v.y * 0.6), c), plush());
  ch.position.copy(onE(hC, hR, [s * 0.62, -0.08, 0.72])).add(new THREE.Vector3(-s * 0.1, 0.02, -0.12)); hamBody.add(ch); return ch; });
const hamEars = [-1, 1].map(s => { const g = new THREE.Group(); const o = solid([0.11, 0.11, 0.05], '#d98c4a'); const i = solid([0.07, 0.07, 0.03], '#ffb3bd'); i.position.z = 0.03; g.add(o, i);
  g.position.copy(onE(hC, hR, [s * 0.55, 0.78, 0.05])); g.rotation.set(-0.2, 0, -s * 0.5); hamBody.add(g); return g; });
const hamHands = [-1, 1].map(s => { const p = solid([0.055, 0.045, 0.05], '#ffc8bd'); p.position.copy(onE(hC, hR, [s * 0.36, -0.5, 0.95])).add(new THREE.Vector3(0, 0, 0.0)); hamBody.add(p); return p; });
const hamFeet = [-1, 1].map(s => { const p = solid([0.08, 0.045, 0.1], '#ffc8bd'); p.position.set(s * 0.2, 0.04, 0.3); hammy.add(p); return p; });
// red beret
const beret = new THREE.Group(); const bm = new THREE.MeshPhysicalMaterial({ color: '#d63a32', roughness: 0.85, sheen: 1, sheenColor: col('#ff9a8a') });
const bTop = new THREE.Mesh(new THREE.SphereGeometry(0.27, 48, 24), bm); bTop.scale.set(1, 0.32, 1); beret.add(bTop);
const bStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.06, 12), bm); bStem.position.y = 0.09; beret.add(bStem);
beret.position.copy(onE(hC, hR, [0.15, 1, 0])).add(new THREE.Vector3(0.02, -0.02, 0)); beret.rotation.set(-0.15, 0, -0.32);
beret.traverse(o => { if (o.isMesh) o.castShadow = true; }); hamBody.add(beret);
hammy.position.set(-0.8, 0, 0.15); hammy.rotation.y = 0.38;

// ---------------------------------------------------------------- Shiba
const SH = { tan: col('#d97a2b'), deep: col('#a9531c'), cream: col('#fbe9cf') };
const shiba = new THREE.Group(); scene.add(shiba);
const shBody = new THREE.Group(); shiba.add(shBody);
const sbC = [0, 0.5, 0], sbR = [0.56, 0.52, 0.5];
const shTorso = blob(sbR, (v, c) => { mixC(SH.tan, SH.cream, smooth(0.15, 0.0, Math.hypot(v.x * 1.4, 0) - 0.25) * smooth(0.55, 0.8, v.z) * smooth(0.6, 0.1, v.y), c); }, plush()); shTorso.position.set(...sbC); shBody.add(shTorso);
const shHead = new THREE.Group(); shHead.position.set(0, 1.25, 0.03); shBody.add(shHead);
const hdR = [0.52, 0.45, 0.46];
const shSkull = blob(hdR, (v, c) => {
  const cheek = smooth(0.05, 0.3, -v.y + 0.15 - 0.15 * (1 - v.z)) * smooth(0.1, 0.5, v.z);
  mixC(SH.tan, SH.cream, cheek, c); if (v.y > 0.4) c.lerp(SH.deep, smooth(0.4, 1, v.y) * 0.25);
}, plush()); shHead.add(shSkull);
const muzzle = blob([0.21, 0.15, 0.17], (v, c) => c.copy(SH.cream), plush()); muzzle.position.set(0, -0.12, 0.36); shHead.add(muzzle);
const shNose = solid([0.06, 0.045, 0.04], '#1a1210', gloss('#1a1210')); shNose.position.set(0, -0.05, 0.52); shHead.add(shNose);
const shMouth = solid([0.06, 0.04, 0.03], '#4a1a1a', matte('#4a1a1a', 0.5)); shMouth.position.set(0, -0.2, 0.5); shHead.add(shMouth);
const shTongue = solid([0.035, 0.02, 0.03], '#ff7b8b', matte('#ff7b8b', 0.4)); shTongue.position.set(0, -0.215, 0.515); shHead.add(shTongue);
const shEyes = [-1, 1].map(s => { const g = new THREE.Group(); const e = eye(0.05); g.add(e);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.058, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), plush({ vertexColors: false, color: SH.tan }));
  lid.name = 'lid'; g.add(lid); g.position.copy(onE([0, 0, 0], hdR, [s * 0.38, 0.12, 0.9])); g.position.z -= 0.015; shHead.add(g); return g; });
const brows = [-1, 1].map(s => { const b = solid([0.045, 0.03, 0.015], '#fbecd4'); b.position.copy(onE([0, 0, 0], hdR, [s * 0.3, 0.42, 0.85])); b.lookAt(b.position.clone().multiplyScalar(2)); shHead.add(b); return b; });
const shEars = [-1, 1].map(s => { const g = new THREE.Group();
  const o = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 24), plush({ vertexColors: false, color: SH.tan })); o.scale.z = 0.55; o.castShadow = true;
  const i = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 24), plush({ vertexColors: false, color: SH.cream })); i.scale.z = 0.3; i.position.set(0, -0.03, 0.05);
  g.add(o, i); g.position.set(s * 0.3, 0.42, -0.02); g.rotation.set(0.1, 0, -s * 0.35); shHead.add(g); return g; });
const blushS = [-1, 1].map(s => { const b = new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), blushMat); b.position.copy(onE([0, 0, 0], hdR, [s * 0.62, -0.08, 0.76])); b.position.z += 0.004; b.lookAt(b.position.clone().multiplyScalar(2)); shHead.add(b); return b; });
const legs = [-1, 1].map(s => { const g = new THREE.Group(); const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 8, 24), plush({ vertexColors: false, color: SH.tan })); l.castShadow = true;
  const f = solid([0.12, 0.08, 0.14], '#fbecd4'); f.position.set(0, -0.2, 0.04); g.add(l, f); g.position.set(s * 0.22, 0.26, 0.36); shBody.add(g); return g; });
const tail = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.075, 16, 48, Math.PI * 1.6), plush({ vertexColors: false, color: SH.tan })); tail.position.set(0.05, 0.85, -0.45); tail.rotation.set(0.3, 0.5, 0.6); tail.castShadow = true; shBody.add(tail);
const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.075, 20, 64), new THREE.MeshPhysicalMaterial({ color: '#c8322b', roughness: 0.8, sheen: 1, sheenColor: col('#ff8a7a') }));
scarf.rotation.x = Math.PI / 2 - 0.1; scarf.position.set(0, 0.88, 0.02); scarf.scale.set(1.05, 1, 0.95); scarf.castShadow = true; shBody.add(scarf);
const knot = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 3), scarf.material); knot.rotation.set(Math.PI, 0, 0); knot.scale.z = 0.35; knot.position.set(0, 0.74, 0.44); shBody.add(knot);
const dots = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const d = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), matte('#fff3e0')); d.position.set(Math.cos(a) * 0.42, 0.86 + 0.02 * Math.sin(a * 3), Math.sin(a) * 0.4); shBody.add(d); dots.push(d); }
// sunglasses (rap)
const shades = new THREE.Group(); const lensM = new THREE.MeshPhysicalMaterial({ color: '#0b0b10', roughness: 0.05, clearcoat: 1, metalness: 0.3 });
for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.03, 32), lensM); l.rotation.x = Math.PI / 2; l.scale.set(1.15, 1, 0.85); l.position.set(s * 0.17, 0, 0); shades.add(l); }
const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.025), lensM); bridge.position.y = 0.03; shades.add(bridge);
const shine = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })); shine.rotation.z = 0.6; shine.position.set(-0.2, 0.0, 0.02); shades.add(shine);
shHead.add(shades);
shiba.position.set(0.85, 0, -0.05); shiba.rotation.y = -0.38;

// seeds for the gag
const seedMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.5 });
const seeds = TL.seeds.map((_, i) => { const s = blob([0.028, 0.06, 0.018], (v, c) => c.set(Math.abs(v.x) > 0.55 ? '#f1ead8' : (Math.abs(v.x) > 0.25 ? '#3a3633' : '#1d1b1a')), seedMat, 24); scene.add(s); return s; });

// rotating ring of rap text around Shiba's head
const ringTex = canvasTex(4096, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.font = '700 150px Fredoka'; g.textBaseline = 'middle'; g.fillStyle = '#fff8ec';
  g.shadowColor = 'rgba(255,170,80,.9)'; g.shadowBlur = 18;
  const txt = TL.ring_text + '  ·  '; let x = 0; while (x < w) { g.fillText(txt, x, h / 2 + 8); x += g.measureText(txt).width; }
});
ringTex.wrapS = THREE.RepeatWrapping;
const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.24, 128, 1, true), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
ring.rotation.z = 0.12; scene.add(ring);

// ---------------------------------------------------------------- post
const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W * SS, H * SS);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.0035, maxblur: 0.008 }); composer.addPass(bokeh);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- timeline helpers
const lines = TL.lines; const raps = TL.rap;
const lineAt = t => lines.find(l => t >= l.start - 0.05 && t < l.end + 0.35);
function speakerAt(t) { // who is "on" (for camera), holds until next line starts
  let cur = lines[0]; for (const l of lines) if (t >= l.start - 0.12) cur = l; return cur;
}
const inRap = t => t >= TL.drop && t < TL.rap_end + 0.2;
const beatPhase = t => ((t - TL.drop) / TL.beat);

// ---------------------------------------------------------------- shots
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HPOS = () => hammy.position, SPOS = () => shiba.position;
function shotFor(t) {
  // returns {pos, tgt, fov, focus, t0}
  if (t < TL.establish + 0.0 || t < lines[0].start) {
    const k = easeInOut(t / (lines[0].start + 0.1));
    return { pos: V(lerp(-1.2, 0.0, k), lerp(2.6, 1.15, k), lerp(8.5, 4.9, k)), tgt: V(0, lerp(1.2, 0.7, k), 0), fov: 32, t0: 0 };
  }
  if (t >= TL.end_card) { const k = easeInOut((t - TL.end_card) / 3); return { pos: V(lerp(0, 0.2, k), lerp(1.1, 1.5, k), lerp(4.8, 6.2, k)), tgt: V(0, lerp(0.7, 0.9, k), 0), fov: 32, t0: TL.end_card }; }
  if (t >= TL.boing - 0.25) return { pos: V(-0.3, 0.95, 4.2), tgt: V(-0.1, 0.65, 0), fov: 31, t0: TL.boing - 0.25 };
  if (t >= TL.rap_end) { // gag: Hammy close-up, slow push
    const k = (t - TL.rap_end) / 3; return { pos: V(-0.55 + 0.1 * k, 0.85, lerp(3.0, 2.7, k)), tgt: V(-1.15, 0.55, 0.1), fov: 30, t0: TL.rap_end };
  }
  if (t >= TL.drop) {
    const bar = Math.floor((t - TL.drop) / TL.bar), tb = TL.drop + bar * TL.bar, k = (t - tb) / TL.bar;
    if (bar === 0) { // hero reveal: low angle dolly-in on Shiba with shades
      return { pos: V(lerp(1.6, 1.25, easeOut(k)), lerp(0.55, 0.75, k), lerp(3.4, 2.7, easeOut(k))), tgt: V(0.85, 1.05, 0), fov: 33, t0: tb };
    }
    const mode = bar % 2;
    if (mode === 1) { // orbit around Shiba
      const a = lerp(-0.55, 0.35, k) + (bar === 3 ? 0.6 : 0); const s = SPOS();
      return { pos: V(s.x + 2.5 * Math.sin(a), 0.75, s.z + 2.5 * Math.cos(a)), tgt: V(s.x, 1.0, s.z), fov: 34, t0: tb };
    }
    return { pos: V(lerp(-0.6, 0.4, k), 1.05, lerp(5.0, 4.6, k)), tgt: V(0.1, 0.8, 0), fov: 33, t0: tb };
  }
  if (t >= TL.scratch - 0.05) { // snap zoom on Shiba before the drop
    const k = easeOut((t - TL.scratch) / 0.35); const s = SPOS();
    return { pos: V(s.x - 0.1, 1.35, lerp(4.0, 2.9, k)), tgt: V(s.x - 0.1, 1.1, 0), fov: 30, t0: TL.scratch };
  }
  const l = speakerAt(t);
  const dt = t - (l.start - 0.12);
  if (l.id === 'l01') return { pos: V(0.0, 1.15, lerp(4.9, 4.6, clamp(dt / 3))), tgt: V(0.05, 0.72, 0), fov: 32, t0: l.start - 0.12 };
  if (l.who === 'Shiba') { const s = SPOS(); const push = clamp(dt / 2) * 0.15;
    return { pos: V(s.x + 0.25, 1.5, 3.0 - push), tgt: V(s.x - 0.42, 1.12, 0), fov: 30, t0: l.start - 0.12 }; }
  const h = HPOS(); const push = clamp(dt / (l.id === 'l16' ? 8 : 2)) * (l.id === 'l16' ? 0.5 : 0.12);
  return { pos: V(h.x + 0.15, 0.82, 3.0 - push), tgt: V(h.x - 0.5, 0.48, 0), fov: 30, t0: l.start - 0.12 };
}

// ---------------------------------------------------------------- subtitles (2D overlay)
function drawText(txt, x, y, font, fill, stroke, sw, align = 'center') {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.strokeText(txt, x, y); ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}
function project(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; }
function subtitle(t) {
  if (t >= TL.drop - 0.05 && t < TL.rap_end + 0.1) return rapSubs(t);
  if (t >= TL.end_card) return;
  if (t >= TL.rap_end) { // gag caption
    const k = clamp((t - TL.seeds[9] - 0.25) / 0.2) * (1 - clamp((t - TL.boing + 0.3) / 0.2)); if (k <= 0) return;
    const s = backOut(k); ctx.save(); ctx.translate(W * 0.3, H * 0.36); ctx.scale(s, s);
    drawText('大约十个', 0, -70, '900 46px "Noto Sans SC"', '#ffd84a', 'rgba(40,20,5,.85)', 9);
    drawText('como diez', 0, 10, '700 84px Fredoka', '#ffffff', 'rgba(40,20,5,.85)', 12); ctx.restore(); return;
  }
  const l = lineAt(t); if (!l) return;
  let zh = l.zh, fg = l.fg, t0 = l.start;
  if (l.chunks) { const tot = l.chunks.reduce((a, c) => a + c.fg.length, 0); let acc = 0;
    for (const c of l.chunks) { const s = l.start + (l.end - l.start) * acc / tot; if (t >= s - 0.05) { zh = c.zh; fg = c.fg; t0 = s; } acc += c.fg.length; } }
  const head = l.who === 'Shiba' ? shHead.getWorldPosition(new THREE.Vector3()) : hamBlob.getWorldPosition(new THREE.Vector3()).add(V(0, 0.15, 0));
  let [hx, hy] = project(head);
  const x = clamp(hx - 560, 360, W - 360), y = clamp(hy - 60, 220, H - 200);
  const k = clamp((t - t0 + 0.05) / 0.16), s = backOut(k);
  const fade = 1 - clamp((t - l.end - 0.2) / 0.15);
  ctx.save(); ctx.globalAlpha = Math.min(k * 2, 1) * fade; ctx.translate(x, y); ctx.scale(s, s);
  const big = fg.length > 22 ? 64 : 84;
  drawText(zh, 0, -big * 0.95, '900 46px "Noto Sans SC"', '#ffd84a', 'rgba(40,20,5,.85)', 9);
  drawText(fg, 0, 0, `700 ${big}px Fredoka`, '#ffffff', 'rgba(40,20,5,.85)', 12);
  ctx.restore();
}
function rapSubs(t) {
  const r = raps.find(r => t >= r.start - 0.1 && t < r.end + 0.4) ; if (!r) return;
  const words = r.say.split(' '); const n = words.length;
  const k = clamp((t - r.start + 0.1) / 0.15);
  ctx.save(); ctx.globalAlpha = k;
  ctx.font = '700 92px Fredoka'; const widths = words.map(w => ctx.measureText(w + ' ').width); const total = widths.reduce((a, b) => a + b, 0);
  let x = W / 2 - total / 2; const y = H - 130;
  words.forEach((w, i) => {
    const wt = r.start + (r.end - r.start) * i / n; const on = t >= wt - 0.03;
    const pop = on ? 1 + 0.25 * springPop(t - wt, 6, 10) : 1;
    ctx.save(); ctx.translate(x + widths[i] / 2, y); ctx.scale(pop, pop);
    drawText(w, 0, 0, '700 92px Fredoka', on ? '#ffd84a' : '#ffffff', 'rgba(30,10,30,.9)', 13); ctx.restore(); x += widths[i];
  });
  drawText(r.zh, W / 2, H - 245, '900 44px "Noto Sans SC"', '#ffffff', 'rgba(30,10,30,.9)', 9);
  ctx.restore();
}
function endCard(t) {
  const k = clamp((t - TL.end_card) / 0.5); if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = 0.72 * k; ctx.fillStyle = '#1b0f08'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const s1 = backOut(clamp((t - TL.end_card - 0.1) / 0.35)), s2 = backOut(clamp((t - TL.end_card - 0.45) / 0.35)), s3 = clamp((t - TL.end_card - 0.8) / 0.4);
  ctx.save(); ctx.translate(W / 2, H * 0.43); ctx.scale(s1, s1); drawText('¿Cómo como?', 0, 0, '700 150px Fredoka', '#ffd84a', '#3a1a08', 18); ctx.restore();
  ctx.save(); ctx.translate(W / 2, H * 0.58); ctx.scale(s2, s2); drawText('¡Como como como!', 0, 0, '700 96px Fredoka', '#ffffff', '#3a1a08', 14); ctx.restore();
  ctx.save(); ctx.globalAlpha = s3; drawText('我怎么吃？我就这么吃！', W / 2, H * 0.69, '900 50px "Noto Sans SC"', '#ffe9c4', '#3a1a08', 10); ctx.restore();
}

// ---------------------------------------------------------------- animate characters
function animate(t) {
  const eS = envS('Shiba', t), eH = envS('Hammy', t);
  const rap = inRap(t), bp = beatPhase(t);
  // line-start pops
  let popS = 0, popH = 0;
  for (const l of lines) { const p = springPop(t - l.start + 0.04, 7, 6) * 0.06; if (l.who === 'Shiba') popS += p; else popH += p; }

  // ---- Hammy
  const breathe = Math.sin(t * 2.4) * 0.012;
  let hy = 0, hsq = 1 + breathe + 0.07 * eH + popH, hrz = 0.04 * Math.sin(t * 1.3), hry = 0.38, hrx = -0.05 * eH;
  if (rap) { const b = bp % 1; hy = 0.12 * Math.abs(Math.sin(Math.PI * bp)); hrz = 0.18 * Math.sin(Math.PI * bp); hsq += 0.06 * Math.cos(2 * Math.PI * b); hry = 0.15; }
  const lean = lines.find(l => l.id === 'l16'); if (t > lean.start && t < TL.scratch) hrx = -0.1 - 0.05 * eH;
  // gag: cheeks fill with ~ten seeds
  const eaten = TL.seeds.filter(s => t >= s + 0.18).length;
  const cheek = 0.85 + 0.095 * eaten + (t >= TL.boing ? 0.15 * springPop(t - TL.boing, 5, 4) : 0);
  if (t >= TL.boing) { const db = t - TL.boing; hy = Math.max(hy, 0.55 * Math.max(0, Math.sin(Math.min(db, 0.6) / 0.6 * Math.PI)) ); hsq += 0.12 * springPop(db - 0.55, 6, 6); }
  hamCheeks.forEach((c, i) => { c.scale.setScalar(cheek); c.position.z = hamCheeks[i].userData.z0 ??= c.position.z; c.position.z = c.userData.z0 + 0.06 * Math.max(0, cheek - 0.85); });
  hamBody.scale.set(1 / Math.sqrt(hsq) * (1 + 0.03 * Math.max(0, cheek - 0.85)), hsq, 1 / Math.sqrt(hsq));
  hammy.position.y = hy; hammy.rotation.set(hrx, hry, hrz);
  const hamOpen = clamp(eH * 1.3);
  hamMouth.scale.set(1 + 0.3 * hamOpen, 0.4 + 1.8 * hamOpen, 1); hamTeeth.visible = hamOpen > 0.15;
  const blinkH = blink(t, 3); hamEyes.forEach(e => e.scale.set(1, 1 - 0.9 * blinkH, 1));
  hamEars.forEach((e, i) => e.rotation.z = (i ? -1 : 1) * (0.5 + 0.08 * Math.sin(t * 3 + i) + 0.2 * springPop(t - (popH > 0 ? t : 0), 8, 8)));
  hamHands.forEach((p, i) => { p.position.y = (p.userData.y0 ??= p.position.y) + (rap ? 0.12 * Math.max(0, Math.sin(Math.PI * bp + i * Math.PI)) : 0.02 * eH); });
  if (t >= TL.gag && t < TL.boing) hamHands.forEach(p => p.position.y = p.userData.y0 + 0.1 + 0.03 * Math.sin(t * 20));

  // ---- Shiba
  let sy = 0, ssq = 1 + Math.sin(t * 1.9 + 1) * 0.008 + 0.035 * eS + popS * 0.6, srz = 0, sry = -0.38, hx = 0, hz = 0.03 * Math.sin(t * 0.9);
  // deadpan nod on each answer
  for (const l of lines) if (l.who === 'Shiba') { const d = t - l.start; if (d > 0 && d < 0.6) hx += 0.1 * Math.sin(d / 0.6 * Math.PI); }
  if (t >= TL.scratch && t < TL.drop) { const k = easeInOut((t - TL.scratch) / 0.6); sry = lerp(-0.38, -0.12, k); } // turns to camera
  if (rap) { const b = bp % 1; hx = 0.16 * Math.pow(Math.abs(Math.sin(Math.PI * bp)), 2) - 0.05; sy = 0.03 * Math.abs(Math.sin(Math.PI * bp)); srz = 0.05 * Math.sin(Math.PI * bp / 2); sry = -0.12 + 0.12 * Math.sin(Math.PI * bp / 4); ssq += 0.03 * Math.cos(2 * Math.PI * b); }
  if (t >= TL.rap_end) sry = lerp(-0.12, -0.5, easeInOut((t - TL.rap_end) / 0.8)); // looks at Hammy during gag
  shBody.scale.set(1 / Math.sqrt(ssq), ssq, 1 / Math.sqrt(ssq));
  shiba.position.y = sy; shiba.rotation.set(0, sry, srz); shHead.rotation.set(hx, 0, hz);
  const shOpen = clamp(eS * 1.25);
  shMouth.scale.set(1 + 0.2 * shOpen, 0.25 + 1.9 * shOpen, 1); shTongue.visible = shOpen > 0.25; shTongue.position.y = -0.2 - 0.05 * shOpen;
  const lidBase = rap ? 0.45 : 0.5; const blinkS = blink(t, 11);
  shEyes.forEach(g => { const lid = g.getObjectByName('lid'); const k = Math.max(lidBase, blinkS);
    lid.rotation.x = lerp(-0.2, 1.05, 1 - k) ; lid.scale.setScalar(1.0); });
  shEars.forEach((e, i) => e.rotation.z = (i ? 1 : -1) * -0.35 + 0.05 * Math.sin(t * 2 + i) + (rap ? 0.08 * Math.sin(Math.PI * bp) : 0));
  tail.rotation.z = 0.6 + 0.15 * Math.sin(t * (rap ? Math.PI / TL.beat : 2.5));

  // sunglasses drop just before the beat drop, stay through the rap
  const gIn = TL.drop - 0.45, gOut = TL.rap_end + 0.6;
  if (t < gIn - 0.4 || t > gOut + 0.5) shades.visible = false;
  else { shades.visible = true; const k = clamp((t - (gIn - 0.4)) / 0.4); let y = lerp(1.6, 0.065, easeOut(k)) + (k >= 1 ? 0.03 * springPop(t - gIn, 5, 7) : 0);
    if (t > gOut) y = lerp(0.065, -0.5, clamp((t - gOut) / 0.35)); shades.position.set(0, y, 0.455); shades.rotation.set(-0.05, 0, 0); }
  // ring text
  const rk = clamp((t - (TL.drop - 0.5)) / 0.5), rk2 = 1 - clamp((t - TL.rap_end) / 0.4);
  ring.visible = rk > 0 && rk2 > 0; const ringS = easeOut(rk) * rk2;
  ring.scale.set(ringS, 1, ringS); ring.material.opacity = ringS;
  const hp = shHead.getWorldPosition(new THREE.Vector3()); ring.position.set(hp.x, hp.y + 0.05, hp.z);
  ring.rotation.y = -(t - TL.drop) * 0.9;

  // seeds: fly from the PIPAS jar to Hammy's mouth
  const jarTop = seedJar.position.clone().add(V(0, 0.72, 0));
  const mouth = hamMouth.getWorldPosition(new THREE.Vector3());
  seeds.forEach((s, i) => { const s0 = TL.seeds[i] - 0.25, k = (t - s0) / 0.42;
    if (k < 0 || k > 1) { s.visible = false; return; } s.visible = true;
    s.position.lerpVectors(jarTop, mouth, k); s.position.y += 0.45 * Math.sin(Math.PI * k); s.rotation.set(t * 14 + i, t * 9, i);
    s.scale.setScalar(1 - 0.5 * smooth(0.8, 1, k)); });

  // lights: warm bar <-> party
  const party = smooth(TL.drop - 0.1, TL.drop + 0.1, t) * (1 - smooth(TL.rap_end, TL.rap_end + 0.5, t));
  const pulse = rap ? Math.pow(1 - (bp % 1), 3) : 0;
  key.intensity = lerp(2.1, 0.9, party); hemi.intensity = lerp(0.35, 0.15, party); lamp.intensity = lerp(9, 3, party) ; wallGlow.intensity = lerp(3, 0.6, party);
  disco.forEach((d, i) => { d.intensity = party * (7 + 16 * (Math.floor(bp) % 3 === i ? pulse : 0.15));
    d.target.position.set(Math.sin(t * 1.3 + i * 2) * 2, 0.5, -1 + Math.cos(t * 1.1 + i) * 1.2); });
  scene.background.set('#2a1a12').lerp(col('#1a0f22'), party);
  // lamp sway
  lamp.position.x = 0.15 * Math.sin(t * 0.8);
  return { party, pulse };
}
function blink(t, seed) {
  // deterministic blinks every ~2.5-4s
  let tt = 0.7 + hash(seed) * 1.5, i = 0;
  while (tt < t + 1) { const d = t - tt; if (d >= 0 && d < 0.16) return Math.sin(d / 0.16 * Math.PI); tt += 2.4 + 1.8 * hash(seed + ++i); }
  return 0;
}

// ---------------------------------------------------------------- frame
function renderFrame(t) {
  const st = animate(t);
  const s = shotFor(t);
  // handheld drift
  const dr = 0.012, n = t - (s.t0 || 0);
  s.pos.x += dr * Math.sin(t * 0.7) + 0.006 * Math.sin(t * 1.9); s.pos.y += dr * Math.sin(t * 0.9 + 1); s.tgt.x += 0.006 * Math.sin(t * 1.1);
  if (inRap(t)) { s.pos.y += 0.02 * st.pulse; }
  camera.position.copy(s.pos); camera.fov = s.fov; camera.updateProjectionMatrix(); camera.lookAt(s.tgt);
  const focusDist = camera.position.distanceTo(s.tgt);
  bokeh.uniforms.focus.value = focusDist; bokeh.uniforms.aperture.value = 0.009; bokeh.uniforms.maxblur.value = 0.012;
  composer.render();
  ctx.drawImage(renderer.domElement, 0, 0, W, H);
  // warm vignette + beat flash
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(20,8,2,${0.45 + 0.1 * st.party})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (st.pulse > 0) { ctx.fillStyle = `rgba(255,120,200,${0.05 * st.pulse * st.party})`; ctx.fillRect(0, 0, W, H); }
  const fin = clamp(t / 0.35); if (fin < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fin})`; ctx.fillRect(0, 0, W, H); }
  subtitle(t); endCard(t);
  const fo = clamp((TL.duration - t) / 0.4); if (fo < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fo})`; ctx.fillRect(0, 0, W, H); }
}
window.renderFrame = renderFrame;
window.renderReady = 'ready ' + TL.duration;
export { renderFrame };
