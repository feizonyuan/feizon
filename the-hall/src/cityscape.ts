// Night city outside the left windows: layered instanced towers with procedural lit window grids.
import * as THREE from 'three/webgpu';
import {
  positionWorld, normalWorld, cameraPosition, instanceIndex, hash, float, vec2, vec3, floor, fract, step,
  abs, select, mix, exp, length, smoothstep, time, sin, positionLocal, normalize, uniform, max,
} from 'three/tsl';
import { mulberry32 } from './proceduralTextures';

export const cityUniforms = {
  fogDensity: uniform(0.017),
  windowGain: uniform(1.05),
};

export function buildCity(scene: THREE.Scene) {
  const group = new THREE.Group();
  scene.add(group);
  const rnd = mulberry32(2024);
  const sky = new THREE.Color('#0b1626');

  // ---- towers
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.fog = false;
  {
    const wp = positionWorld;
    const n = normalWorld;
    const horiz = select(abs(n.x).greaterThan(0.5), wp.z, wp.x);
    const id = float(instanceIndex);
    const ww = mix(float(0.9), float(1.5), hash(id.mul(3.7)));
    const fh = mix(float(2.6), float(3.3), hash(id.mul(5.3)));
    const g = vec2(horiz.div(ww), wp.y.div(fh));
    const cell = floor(g);
    const local = fract(g);
    const h = hash(cell.x.mul(13.13).add(cell.y.mul(71.71)).add(id.mul(17.3)));
    const rowH = hash(cell.y.mul(7.77).add(id.mul(31.1)));
    const density = hash(id.mul(9.1)).mul(0.4).add(0.12);
    const lit = max(step(float(1).sub(density), h), step(0.9, rowH).mul(step(0.25, h)));
    const winShape = step(0.2, local.x).mul(step(local.x, 0.8)).mul(step(0.3, local.y)).mul(step(local.y, 0.78));
    const tint = hash(cell.x.add(cell.y.mul(3.3)).add(id));
    const cWhite = vec3(0.85, 0.92, 1.0);
    const cBlue = vec3(0.45, 0.65, 1.0);
    const cCyan = vec3(0.35, 0.95, 0.95);
    const cWarm = vec3(1.0, 0.7, 0.4);
    const wc = select(tint.lessThan(0.45), cWhite, select(tint.lessThan(0.75), cBlue, select(tint.lessThan(0.95), cCyan, cWarm)));
    const flick = step(0.997, hash(cell.x.add(cell.y).add(floor(time.mul(2)).mul(0.13)).add(id)));
    const isSide = step(abs(n.y), 0.5);
    const winLight = wc.mul(lit.mul(winShape).mul(isSide).mul(float(1).sub(flick))).mul(hash(cell.x.mul(1.7).add(cell.y)).mul(0.6).add(0.5)).mul(cityUniforms.windowGain);
    const facade = vec3(0.025, 0.035, 0.055).mul(wp.y.div(120).add(0.6));
    const col = facade.add(winLight);
    const d = length(wp.sub(cameraPosition));
    const f = float(1).sub(exp(d.mul(cityUniforms.fogDensity).negate()));
    // haze grows toward the ground (city glow)
    const hz = smoothstep(60, 0, wp.y).mul(0.25);
    mat.colorNode = mix(col, vec3(sky.r, sky.g, sky.b).mul(1.15), f.add(hz).min(0.97));
  }

  type B = { x: number; z: number; w: number; d: number; h: number };
  const blds: B[] = [];
  // three layers: near / mid / far
  const layers = [
    { x0: -20, x1: -32, count: 16, h: [25, 70], w: [6, 12] },
    { x0: -38, x1: -70, count: 34, h: [40, 120], w: [8, 16] },
    { x0: -80, x1: -140, count: 46, h: [60, 190], w: [10, 22] },
  ];
  for (const L of layers) {
    for (let i = 0; i < L.count; i++) {
      const w = L.w[0] + rnd() * (L.w[1] - L.w[0]);
      const d = L.w[0] + rnd() * (L.w[1] - L.w[0]);
      blds.push({
        x: L.x0 + (L.x1 - L.x0) * rnd(),
        z: 40 - rnd() * 170,
        w, d,
        h: L.h[0] + rnd() * (L.h[1] - L.h[0]),
      });
    }
  }
  const inst = new THREE.InstancedMesh(geo, mat, blds.length);
  const m = new THREE.Matrix4();
  blds.forEach((b, i) => {
    m.compose(new THREE.Vector3(b.x, -30, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h + 30, b.d));
    inst.setMatrixAt(i, m);
  });
  inst.frustumCulled = false;
  group.add(inst);

  // ---- rooftop aviation beacons
  const beaconGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const beaconMat = new THREE.MeshBasicNodeMaterial();
  beaconMat.fog = false;
  beaconMat.colorNode = vec3(4, 0.25, 0.15).mul(step(0.0, sin(time.mul(2.6).add(float(instanceIndex).mul(1.7)))).mul(0.95).add(0.05));
  const tall = blds.filter((b) => b.h > 70);
  const beacons = new THREE.InstancedMesh(beaconGeo, beaconMat, tall.length);
  tall.forEach((b, i) => { m.makeTranslation(b.x, b.h + 0.5, b.z); beacons.setMatrixAt(i, m); });
  beacons.frustumCulled = false;
  group.add(beacons);

  // ---- a few neon billboards
  const signs: [string, string, number, number, number, number][] = [
    ['夜間営業', '#ff3fa4', -24, 30, -6, 9],
    ['ZAIBATSU', '#3fe8ff', -44, 62, -40, 18],
    ['薬 24H', '#7cff6b', -21, 18, -50, 6],
    ['HOTEL', '#ff5a3c', -60, 80, 12, 14],
  ];
  for (const [txt, color, x, y, z, w] of signs) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, 512, 160);
    ctx.font = '900 110px "Noto Sans JP","Hiragino Kaku Gothic ProN","Arial Black",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.fillStyle = color; ctx.fillText(txt, 256, 84);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6; ctx.fillText(txt, 256, 84);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(2.2, 2.2, 2.2) });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), sm);
    p.position.set(x, y, z); p.rotation.y = Math.PI / 2;
    group.add(p);
  }

  // ---- sky dome
  const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide });
  skyMat.fog = false;
  const dir = normalize(positionLocal);
  const top = vec3(0.004, 0.008, 0.016), horizon = vec3(0.05, 0.08, 0.13), glow = vec3(0.12, 0.1, 0.14);
  skyMat.colorNode = mix(horizon, top, smoothstep(0.0, 0.5, dir.y)).add(glow.mul(smoothstep(0.25, -0.05, dir.y)).mul(0.5));
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
  group.add(skyMesh);

  // ---- rain streaks outside the windows
  const rainCount = 1800;
  const rainGeo = new THREE.BoxGeometry(0.008, 0.55, 0.008);
  const rainMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  rainMat.fog = false;
  const rid = float(instanceIndex);
  const fallH = 14;
  const yOff = fract(time.mul(0.9).add(hash(rid))).mul(fallH);
  rainMat.positionNode = positionLocal.add(vec3(yOff.mul(-0.12), yOff.negate(), 0));
  rainMat.colorNode = vec3(0.55, 0.7, 0.85);
  rainMat.opacityNode = float(0.22);
  const rain = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  for (let i = 0; i < rainCount; i++) {
    m.makeTranslation(-2.9 - rnd() * 9, 4 + rnd() * 4 + 3, 6 - rnd() * 50);
    rain.setMatrixAt(i, m);
  }
  rain.frustumCulled = false;
  group.add(rain);

  return { group };
}
