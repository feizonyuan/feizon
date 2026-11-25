// Builds the corridor, side rooms, props and lights. Everything is procedural geometry.
import * as THREE from 'three/webgpu';
import {
  texture, uv, vec2, vec3, float, mix, smoothstep, uniform, reflector, time, sin, oneMinus,
} from 'three/tsl';
import * as T from './proceduralTextures';
import { mulberry32 } from './proceduralTextures';
import { buildExpansion } from './expansion';

export interface AABB { x0: number; x1: number; z0: number; z1: number; enabled?: boolean; tag?: string }

export interface FlickerLight {
  light: THREE.PointLight | THREE.SpotLight;
  base: number;
  emissive?: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  emissiveBase?: THREE.Color;
  mode: 'steady' | 'flicker' | 'buzz' | 'fire';
  seed: number;
  value: number;
}

export const worldUniforms = {
  wetThreshold: uniform(0.585),
  reflectStrength: uniform(0.9),
  rippleAmount: uniform(0.004),
};

const DEG = Math.PI / 180;

// ------------------------------------------------------------------ helpers
type Tile = { u: number; v: number };

export function boxGeo(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tile: Tile) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const g = new THREE.BoxGeometry(w, h, d);
  const uvA = g.attributes.uv as THREE.BufferAttribute;
  const xm = Math.min(x0, x1), ym = Math.min(y0, y1), zm = Math.min(z0, z1);
  // faces: +x, -x, +y, -y, +z, -z
  const dims = [[d, h, -zm, ym], [d, h, zm, ym], [w, d, xm, zm], [w, d, xm, zm], [w, h, xm, ym], [w, h, -xm, ym]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      const [du, dv, ou, ov] = dims[f];
      uvA.setXY(idx, (uvA.getX(idx) * du + ou) / tile.u, (uvA.getY(idx) * dv + ov) / tile.v);
    }
  }
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

export class Level {
  scene: THREE.Scene;
  root = new THREE.Group();
  colliders: AABB[] = [];
  /** colliders the entity uses (walls only) */
  wallColliders: AABB[] = [];
  occluders: AABB[] = [];
  lights: FlickerLight[] = [];
  power = 1; // global power multiplier (blackouts)
  powerTarget = 1;
  rnd = mulberry32(7);
  tex: Record<string, THREE.Texture> = {};
  mats: Record<string, THREE.Material> = {};

  // gameplay hooks
  pickups: { obj: THREE.Object3D; kind: 'fuse' | 'battery' | 'keycard' }[] = [];
  fuseSlots: THREE.Mesh[] = [];
  gate!: THREE.Group;
  gateCollider!: AABB;
  liftDoor!: THREE.Mesh;
  liftCollider!: AABB;
  liftLight!: THREE.PointLight;
  liftLed!: THREE.MeshBasicMaterial;
  liftPos = new THREE.Vector3(-0.6, 1.2, -44.2);
  liftOpen = 0;
  steadyLights = false;
  secDoor!: THREE.Mesh;
  secCollider!: AABB;
  secLed!: THREE.MeshBasicMaterial;
  secReaderPos = new THREE.Vector3(18.45, 1.3, -38.5);
  secOpen = 0;
  secOpening = false;
  liftOpening = false;
  cctvScreens: THREE.Mesh[] = [];
  swing?: { pivot: THREE.Object3D; light: THREE.PointLight; bulb: THREE.Object3D };
  boilerPos = new THREE.Vector3();
  vendingTray!: THREE.Vector3;
  vendingSignMat!: THREE.MeshBasicMaterial;
  notes: { mesh: THREE.Object3D; lines: string[] }[] = [];
  breakerPos = new THREE.Vector3(2.08, 1.45, -15.6);
  vendingPos = new THREE.Vector3(1.4, 1.0, -18.5);
  ledMats: THREE.MeshBasicMaterial[] = [];
  floorMat!: THREE.MeshStandardNodeMaterial;
  floorRect = { X0: 0, Z0: 0, W: 1, D: 1 };
  fanBlade?: THREE.Object3D;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.add(this.root);
    this.makeMaterials();
    this.buildShell();
    this.buildFloor();
    this.buildWindows();
    this.buildCeilingDetails();
    this.buildPendants();
    this.buildRoom1();
    this.buildBrickSection();
    this.buildVending();
    this.buildRoom2();
    this.buildEnd();
    this.buildSpawn();
    buildExpansion(this);
    this.buildDebris();
    this.buildAmbient();
  }

  // ---------------------------------------------------------------- materials
  makeMaterials() {
    const t = this.tex;
    t.concrete = T.concreteWall(1);
    t.concrete2 = T.concreteWall(3, [100, 104, 104]);
    t.ceiling = T.ceilingTex(5);
    t.brick = T.brickWall(41);
    t.brickOnly = T.brickOnly(43);
    t.metal = T.rustyMetal(51);
    t.darkMetal = T.rustyMetal(53, [34, 36, 38]);
    t.wood = T.woodTex(61);
    const std = (map: THREE.Texture | null, tile: Tile, rough = 0.92, metal = 0, color = 0xffffff) => {
      const m = new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: metal, color });
      m.userData.tile = tile;
      return m;
    };
    this.mats.concrete = std(t.concrete, { u: 4, v: 3.6 });
    this.mats.concrete2 = std(t.concrete2, { u: 4, v: 3.6 });
    this.mats.ceiling = std(t.ceiling, { u: 4, v: 4 }, 0.95);
    this.mats.brick = std(t.brick, { u: 6, v: 3.6 }, 0.9);
    this.mats.brickOnly = std(t.brickOnly, { u: 2.6, v: 1.56 }, 0.88);
    this.mats.metal = std(t.metal, { u: 1, v: 1 }, 0.55, 0.6);
    this.mats.darkMetal = std(t.darkMetal, { u: 1, v: 1 }, 0.45, 0.7);
    this.mats.black = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.5, metalness: 0.6 });
    this.mats.wood = std(t.wood, { u: 1.2, v: 0.15 }, 0.95);
    this.mats.wet = new THREE.MeshStandardMaterial({ color: 0x1c2224, roughness: 0.25, metalness: 0.2 });
  }

  box(mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, opts: { collide?: boolean; wall?: boolean; occlude?: boolean; parent?: THREE.Object3D } = {}) {
    const tile: Tile = (mat.userData && mat.userData.tile) || { u: 1, v: 1 };
    const mesh = new THREE.Mesh(boxGeo(x0, x1, y0, y1, z0, z1, tile), mat);
    (opts.parent ?? this.root).add(mesh);
    const bb: AABB = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) };
    if (opts.collide) this.colliders.push(bb);
    if (opts.wall) this.wallColliders.push(bb);
    if (opts.occlude) this.occluders.push(bb);
    return mesh;
  }

  wall(mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = 3.6) {
    return this.box(mat, x0, x1, y0, y1, z0, z1, { collide: y0 < 1.8, wall: y0 < 1.8, occlude: y0 < 0.5 && y1 > 2 });
  }

  addLight(light: THREE.PointLight | THREE.SpotLight, mode: FlickerLight['mode'] = 'steady', emissive?: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial) {
    this.root.add(light);
    const fl: FlickerLight = { light, base: light.intensity, mode, seed: this.rnd() * 100, value: 1, emissive };
    if (emissive) fl.emissiveBase = ('emissive' in emissive ? (emissive as THREE.MeshStandardMaterial).emissive : emissive.color).clone();
    this.lights.push(fl);
    return fl;
  }

  // ---------------------------------------------------------------- shell
  buildShell() {
    const c = this.mats.concrete, c2 = this.mats.concrete2;
    // right wall segments (door holes for room 1 and room 2)
    this.wall(c, 2.2, 2.6, 0.8, -6.2);
    this.wall(c, 2.2, 2.6, -8.2, -11);
    this.wall(this.mats.brick, 2.2, 2.6, -11, -17);
    this.wall(c, 2.2, 2.6, -17, -23);
    this.wall(c, 2.2, 2.6, -25, -36.3);
    // lintels
    this.box(c, 2.2, 2.6, 2.4, 3.6, -6.2, -8.2);
    this.box(c, 2.2, 2.6, 2.4, 3.6, -23, -25);
    // door frames (chipped)
    for (const [za, zb] of [[-6.2, -8.2], [-23, -25]]) {
      this.box(this.mats.concrete, 2.12, 2.68, 0, 2.48, za + 0.08, za - 0.02);
      this.box(this.mats.concrete, 2.12, 2.68, 0, 2.48, zb + 0.02, zb - 0.08);
      this.box(this.mats.concrete, 2.12, 2.68, 2.4, 2.5, za, zb);
    }
    // room 1 shell: X[2.6,8.2] Z[-11,-5]
    this.wall(c2, 2.6, 8.6, -4.6, -5);
    this.wall(c2, 2.6, 8.6, -11, -11.4);
    this.wall(c2, 8.2, 8.6, -5, -11);
    // room 2 shell: X[2.6,8.2] Z[-28,-22]
    this.wall(this.mats.brickOnly, 2.6, 8.6, -21.6, -22);
    this.wall(c2, 2.6, 8.6, -28, -28.4);
    this.wall(c2, 8.2, 8.6, -22, -28);
    // left wall collider (window band) – visuals are built in buildWindows
    this.colliders.push({ x0: -3, x1: -1.95, z0: -36.3, z1: 0.8 });
    this.wallColliders.push({ x0: -3, x1: -1.95, z0: -36.3, z1: 0.8 });
    // ceiling (one plane covering everything)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(46.6, 52), this.mats.ceiling);
    const tex = this.tex.ceiling; tex.repeat.set(46.6 / 4, 52 / 4);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(20.7, 3.6, -25.2);
    this.root.add(ceil);
  }

  buildFloor() {
    const X0 = -2.6, X1 = 36, Z0 = 0.8, Z1 = -51.2;
    const W = X1 - X0, D = Z0 - Z1;
    this.floorRect = { X0, Z0, W, D };
    const macro = T.floorMacro(448, 600, (u) => X0 + u * W, (v) => Z0 - v * D);
    const detail = T.floorDetail(11);
    const noise = T.noiseTex(31);
    this.tex.floorMacro = macro; this.tex.floorDetail = detail; this.tex.noise = noise;

    const mat = new THREE.MeshStandardNodeMaterial();
    // plane uv: u along +X, v along +Z (after rotation v=1 at Z0). Flip v so v=0 at Z0.
    const uvM = vec2(uv().x, oneMinus(uv().y));
    const m = texture(macro, uvM);
    const det = texture(detail, uv().mul(vec2(W / 2, D / 2)));
    const ripple = texture(noise, uv().mul(vec2(W / 1.5, D / 1.5)).add(vec2(time.mul(0.01), time.mul(0.006))));
    const wet = smoothstep(worldUniforms.wetThreshold, worldUniforms.wetThreshold.add(0.07), m.r);
    const grime = m.g.mul(1.2);
    const refl = reflector({ resolutionScale: 0.5, bounces: false });
    refl.target.rotateX(-Math.PI / 2);
    refl.target.position.y = 0.001;
    this.scene.add(refl.target);
    refl.uvNode = refl.uvNode!.add(ripple.rg.sub(0.5).mul(worldUniforms.rippleAmount));
    const dryCol = det.rgb.mul(grime);
    mat.colorNode = mix(dryCol, dryCol.mul(0.22), wet);
    mat.roughnessNode = mix(float(0.9).add(det.r.mul(0.08)), float(0.08), wet);
    mat.metalnessNode = float(0);
    mat.emissiveNode = refl.rgb.mul(wet).mul(worldUniforms.reflectStrength);
    this.floorMat = mat;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    this.root.add(floor);
  }

  // ---------------------------------------------------------------- left windows
  buildWindows() {
    const c = this.mats.concrete;
    const bars: THREE.Matrix4[] = [];
    const bar = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      bars.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
    };
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x8aa0b0, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.1, depthWrite: false });
    const sillMat = this.mats.concrete2;
    const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9AEBFF').multiplyScalar(3.2) });
    const ledDead = new THREE.MeshBasicMaterial({ color: 0x0c1012 });
    for (let i = 0; i <= 9; i++) {
      const z = -i * 4;
      // pillar
      this.box(c, -2.75, -2.0, 0, 3.6, z + 0.28, z - 0.28, { occlude: true });
      if (i === 9) break;
      const zA = z - 0.28, zB = z - 4 + 0.28;
      // lower wall / upper wall
      this.box(c, -2.6, -2.2, 0, 0.88, zA, zB);
      this.box(c, -2.6, -2.2, 3.25, 3.6, zA, zB);
      // sill
      this.box(sillMat, -2.45, -1.95, 0.88, 0.97, zA, zB);
      // glass
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(zA - zB, 2.28), glassMat);
      glass.rotation.y = Math.PI / 2; glass.position.set(-2.38, 2.1, (zA + zB) / 2);
      this.root.add(glass);
      // steel grid
      const span = zA - zB;
      const cols = 6, rows = 5;
      for (let k = 0; k <= cols; k++) bar(-2.38, 2.1, zA - (span * k) / cols, 0.06, 2.3, k === 0 || k === cols ? 0.1 : 0.035);
      for (let r = 0; r <= rows; r++) bar(-2.38, 0.97 + (2.28 * r) / rows, (zA + zB) / 2, 0.06, r === 0 || r === rows ? 0.08 : 0.035, span);
      // LED strip under the sill (some dead, one flickering)
      const dead = i === 3 || i === 6;
      const led = this.box(dead ? ledDead : ledMat, -2.2, -2.17, 0.42, 0.48, (zA + zB) / 2 + 0.7, (zA + zB) / 2 - 0.7);
      if (!dead && i === 5) {
        const fm = ledMat.clone(); led.material = fm; this.ledMats.push(fm);
      }
      // cans on the sill
      if (i === 1 || i === 4 || i === 7) this.can(-2.15, 0.97, zA - 0.8 - this.rnd() * 1.5, i === 4);
    }
    const barGeo = new THREE.BoxGeometry(1, 1, 1);
    const inst = new THREE.InstancedMesh(barGeo, this.mats.black, bars.length);
    bars.forEach((m, i) => inst.setMatrixAt(i, m));
    this.root.add(inst);

    // cold fill lights near LED strips
    for (const z of [-6, -26]) {
      const l = new THREE.PointLight('#9AEBFF', 1.6, 7, 2);
      l.position.set(-1.9, 0.5, z);
      this.addLight(l);
    }
  }

  can(x: number, y: number, z: number, fallen = false, color?: number) {
    const colors = [0xb3261e, 0x1f4fb0, 0xb8bcc0, 0x2f8a3a, 0xd8c12a];
    const mat = new THREE.MeshStandardMaterial({ color: color ?? colors[Math.floor(this.rnd() * colors.length)], roughness: 0.35, metalness: 0.7 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.122, 12), mat);
    if (fallen) { m.rotation.z = Math.PI / 2; m.rotation.y = this.rnd() * 6; m.position.set(x, y + 0.033, z); }
    else m.position.set(x, y + 0.061, z);
    this.root.add(m);
    return m;
  }

  // ---------------------------------------------------------------- ceiling
  buildCeilingDetails() {
    // cable trays along both top corners
    const pipeMat = this.mats.darkMetal;
    for (const x of [-1.95, 1.95]) {
      for (const [dy, r] of [[0, 0.05], [0.12, 0.035], [-0.1, 0.03]] as const) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 36.5, 8), pipeMat);
        p.rotation.x = Math.PI / 2; p.position.set(x + dy * 0.4, 3.38 + dy, -18);
        this.root.add(p);
      }
    }
    const brackets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), pipeMat, 38);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 19; i++) {
      m.makeTranslation(-1.95, 3.44, -i * 2 - 0.5); brackets.setMatrixAt(i * 2, m);
      m.makeTranslation(1.95, 3.44, -i * 2 - 0.5); brackets.setMatrixAt(i * 2 + 1, m);
    }
    this.root.add(brackets);
  }

  buildPendants() {
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2a2c2a, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide });
    const cordMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const zs = [-3, -9, -15, -21, -27, -33];
    zs.forEach((z, i) => {
      const g = new THREE.Group();
      g.position.set(0, 0, z);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 4), cordMat);
      cord.position.y = 3.6 - 0.375; g.add(cord);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.3, 0.2, 20, 1, true), shadeMat);
      shade.position.y = 2.78; g.add(shade);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 12), shadeMat);
      cap.position.y = 2.89; g.add(cap);
      const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD28A').multiplyScalar(6) });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), bulbMat);
      bulb.position.y = 2.68; g.add(bulb);
      this.root.add(g);
      const l = new THREE.PointLight('#FFD28A', 16, 14, 2);
      l.position.set(0, 2.6, z);
      this.addLight(l, i === 3 ? 'flicker' : 'steady', bulbMat);
    });
  }

  // ---------------------------------------------------------------- room 1 (VOLT)
  buildRoom1() {
    const zc = -8;
    // graffiti on the back wall
    const volt = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({ map: T.graffitiVolt(), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    volt.rotation.y = -Math.PI / 2; volt.position.set(8.19, 1.75, zc);
    this.root.add(volt);
    // fluorescent tube
    const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#4CE8DC').multiplyScalar(5) });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), tubeMat);
    tube.rotation.x = Math.PI / 2; tube.position.set(5.4, 3.25, zc);
    this.root.add(tube);
    const hous = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.4), this.mats.darkMetal);
    hous.position.set(5.4, 3.3, zc); this.root.add(hous);
    for (const dz of [-0.5, 0.5]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 3), this.mats.black); w.position.set(5.4, 3.45, zc + dz); this.root.add(w); }
    const l = new THREE.PointLight('#4CE8DC', 14, 12, 2);
    l.position.set(5.4, 3.0, zc);
    this.addLight(l, 'buzz', tubeMat);
    // desk + chair + stool + shelf in the shadowed left corner (toward Z=-5)
    const dm = this.mats.darkMetal;
    this.box(this.mats.wood, 4.2, 5.8, 0.74, 0.78, -5.2, -6.0, { collide: true });
    for (const [x, z] of [[4.25, -5.25], [5.75, -5.25], [4.25, -5.95], [5.75, -5.95]]) this.box(dm, x - 0.03, x + 0.03, 0, 0.74, z - 0.03, z + 0.03);
    this.box(dm, 4.6, 5.0, 0.44, 0.48, -6.3, -6.7); // chair seat
    this.box(dm, 4.6, 5.0, 0.48, 0.95, -6.66, -6.7);
    for (const [x, z] of [[4.62, -6.32], [4.98, -6.32], [4.62, -6.68], [4.98, -6.68]]) this.box(dm, x - 0.015, x + 0.015, 0, 0.44, z - 0.015, z + 0.015);
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.5, 14), dm); stool.position.set(6.8, 0.25, -6.0); this.root.add(stool);
    // shelf
    this.box(dm, 7.2, 8.15, 0, 2.0, -5.05, -5.5, { collide: true });
    for (let s = 0; s < 4; s++) this.box(this.mats.black, 7.22, 8.13, 0.35 + s * 0.5, 0.37 + s * 0.5, -5.06, -5.48);
    for (let s = 0; s < 6; s++) this.box(this.mats.metal, 7.3 + this.rnd() * 0.6, 7.45 + this.rnd() * 0.6, 0.37 + (s % 3) * 0.5, 0.55 + (s % 3) * 0.5, -5.15, -5.4);
    // fallen ceiling slab near the door
    const slab = this.box(this.mats.concrete2, -0.9, 0.9, -0.08, 0.08, -0.6, 0.6);
    slab.position.set(3.7, 0.16, -9.1); slab.rotation.set(0.15, 0.5, 0.08);
    this.colliders.push({ x0: 3.0, x1: 4.4, z0: -9.8, z1: -8.4 });
    for (let i = 0; i < 18; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04 + this.rnd() * 0.07, 0), this.mats.concrete2);
      r.position.set(3.0 + this.rnd() * 1.8, 0.03, -8.3 - this.rnd() * 1.8); r.rotation.set(this.rnd() * 3, this.rnd() * 3, 0);
      this.root.add(r);
    }
    // fuse 1 on the desk
    this.addPickup('fuse', this.makeFuse(5.3, 0.79, -5.6));
    this.notes.push({ mesh: this.makeNote(4.6, 0.785, -5.55, 0.3), lines: [
      'NIGHT LOG — 11/19', '', 'The breaker blew again.', 'Needs 3 fuses. Spares are', 'somewhere in B. Gate at the', 'end of A is open.',
      '', 'Something stands at the', 'end of the hall when the', 'lights dip. It only moves', 'when nobody is looking.' ] });
  }

  makeFuse(x: number, y: number, z: number) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.13, 12), new THREE.MeshStandardMaterial({ color: 0xd8cfa0, roughness: 0.6, emissive: new THREE.Color('#ff8a2a'), emissiveIntensity: 0.6 }));
    const capMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.3, metalness: 1 });
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 12), capMat); c1.position.y = 0.07;
    const c2 = c1.clone(); c2.position.y = -0.07;
    g.add(body, c1, c2);
    g.rotation.z = Math.PI / 2; g.rotation.y = this.rnd() * 3;
    g.position.set(x, y + 0.035, z);
    this.root.add(g);
    return g;
  }

  addPickup(kind: 'fuse' | 'battery' | 'keycard', obj: THREE.Object3D) {
    this.pickups.push({ obj, kind });
    return obj;
  }

  makeBattery(x: number, y: number, z: number) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.4, metalness: 0.3, emissive: new THREE.Color('#3fff8a'), emissiveIntensity: 0.25 }));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0175, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xd4a020, roughness: 0.3, metalness: 0.8 }));
    top.position.y = 0.05; g.add(body, top);
    g.rotation.z = Math.PI / 2; g.position.set(x, y + 0.018, z);
    const g2 = g.clone(); g2.position.z += 0.045; g2.rotation.y = 0.3;
    const pack = new THREE.Group(); pack.add(g, g2);
    this.root.add(pack);
    return pack;
  }

  makeKeycard(x: number, y: number, z: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.003, 0.054), [
      this.mats.black, this.mats.black, new THREE.MeshStandardMaterial({ map: T.keycardTex(), roughness: 0.4, emissive: new THREE.Color(0.25, 0.08, 0.06) }), this.mats.black, this.mats.black, this.mats.black,
    ]);
    m.position.set(x, y + 0.002, z); m.rotation.y = 0.5;
    this.root.add(m);
    return m;
  }

  makeNote(x: number, y: number, z: number, rot: number) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.27), new THREE.MeshStandardMaterial({ color: 0xd9d4c2, roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, y, z);
    this.root.add(m);
    return m;
  }

  // ---------------------------------------------------------------- brick section
  buildBrickSection() {
    // wooden pallet leaning on the wall
    const pallet = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(boxGeo(-0.6, 0.6, -0.045, 0.045, -0.011, 0.011, { u: 1.2, v: 0.15 }), this.mats.wood);
      s.position.set(0, -0.5 + i * 0.2, 0.02); pallet.add(s);
    }
    for (const x of [-0.55, 0, 0.55]) {
      const r = new THREE.Mesh(boxGeo(-0.05, 0.05, -0.6, 0.6, -0.05, 0.05, { u: 1.2, v: 0.15 }), this.mats.wood);
      r.position.set(x, 0, -0.06); pallet.add(r);
    }
    pallet.rotation.y = -Math.PI / 2; pallet.rotation.x = -0.0;
    pallet.rotation.order = 'YXZ'; pallet.rotation.x = 0.28;
    pallet.position.set(1.96, 0.6, -12.8);
    this.root.add(pallet);
    this.colliders.push({ x0: 1.6, x1: 2.2, z0: -13.45, z1: -12.15 });

    // bulkhead cage lamp
    const bh = new THREE.Group();
    bh.position.set(2.14, 2.25, -14.2);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16), this.mats.darkMetal);
    base.rotation.z = Math.PI / 2; bh.add(base);
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFB866').multiplyScalar(5) });
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10, 0, Math.PI), glow);
    glass.rotation.y = -Math.PI / 2; glass.position.x = -0.02; bh.add(glass);
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 4, 16, Math.PI), this.mats.black);
      ring.rotation.set(0, Math.PI / 2, (k - 1) * 0.7 + Math.PI / 2); ring.position.x = -0.02; bh.add(ring);
    }
    this.root.add(bh);
    const bl = new THREE.PointLight('#FFB866', 9, 9, 2);
    bl.position.set(1.9, 2.15, -14.2);
    this.addLight(bl, 'steady', glow);

    // breaker / distribution box (fuse panel — gameplay)
    const bx = this.breakerPos;
    this.box(this.mats.metal, 2.0, 2.2, bx.y - 0.4, bx.y + 0.4, bx.z + 0.32, bx.z - 0.32);
    this.box(this.mats.darkMetal, 1.985, 2.0, bx.y - 0.36, bx.y + 0.36, bx.z + 0.28, bx.z - 0.28);
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: T.warningSign('DANGER', '高電圧 400V'), roughness: 0.7 }));
    warn.rotation.y = -Math.PI / 2; warn.position.set(1.98, bx.y + 0.22, bx.z); this.root.add(warn);
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.08, 0.05) }));
      s.position.set(1.975, bx.y - 0.12, bx.z - 0.16 + k * 0.16);
      this.root.add(s); this.fuseSlots.push(s);
    }
    // conduits to ceiling
    for (const dz of [-0.2, 0.0, 0.2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.6 - bx.y - 0.4, 6), this.mats.darkMetal);
      p.position.set(2.17, (3.6 + bx.y + 0.4) / 2, bx.z + dz); this.root.add(p);
      const q = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, bx.y - 0.4, 6), this.mats.darkMetal);
      q.position.set(2.17, (bx.y - 0.4) / 2, bx.z + dz * 0.5); if (dz === 0) this.root.add(q);
    }
    this.colliders.push({ x0: 1.95, x1: 2.2, z0: bx.z - 0.35, z1: bx.z + 0.35 });
  }

  // ---------------------------------------------------------------- vending machine
  buildVending() {
    const g = new THREE.Group();
    // local frame: x = depth (toward -X is front), z = width
    const W = 1.15, H = 1.95, D = 0.8;
    g.position.set(2.2 - D / 2 - 0.02, 0, -18.5);
    this.root.add(g);
    const bodyMat = new THREE.MeshStandardMaterial({ map: T.vendingBody(), roughness: 0.42, metalness: 0.75 });
    const frontMat = new THREE.MeshStandardMaterial({ map: this.tex.darkMetal, color: 0x6a6e72, roughness: 0.4, metalness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(D - 0.2, H, W), [frontMat, frontMat, frontMat, frontMat, bodyMat, bodyMat]);
    body.position.set(0.1, H / 2, 0); g.add(body);
    const front = -D / 2 - 0.001;
    {
      // front plates framing the display window (hollow so the lit shelves show)
      const wW = 0.78, wH = 1.0, wY = 1.12, wZ = -0.14, x0 = -D / 2, x1 = -D / 2 + 0.2;
      this.box(frontMat, x0, x1, wY + wH / 2, H, -W / 2, W / 2, { parent: g });
      this.box(frontMat, x0, x1, 0, wY - wH / 2, -W / 2, W / 2, { parent: g });
      this.box(frontMat, x0, x1, wY - wH / 2, wY + wH / 2, -W / 2, wZ - wW / 2, { parent: g });
      this.box(frontMat, x0, x1, wY - wH / 2, wY + wH / 2, wZ + wW / 2, W / 2, { parent: g });
    }
    // sign
    const signMat = new THREE.MeshBasicMaterial({ map: T.vendingSign(), color: new THREE.Color(2.6, 2.6, 2.6) });
    this.vendingSignMat = signMat;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 0.27), signMat);
    sign.rotation.y = -Math.PI / 2; sign.position.set(front - 0.01, H - 0.2, 0); g.add(sign);
    // display window (bright backlit box)
    const winW = 0.78, winH = 1.0, winY = 1.12, winZ = -0.14;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.3, 1.38) }));
    back.rotation.y = -Math.PI / 2; back.position.set(front + 0.18, winY, winZ); g.add(back);
    // recessed walls of the window
    const rim = new THREE.MeshStandardMaterial({ color: 0xcfd6da, roughness: 0.3, emissive: new THREE.Color(0.6, 0.62, 0.65) });
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.18, winH), rim);
      sw.position.set(front + 0.09, winY, winZ + s * winW / 2); g.add(sw);
    }
    // shelves + cans (instanced)
    const shelves = 5, perRow = 7;
    const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10);
    const canMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5, emissive: new THREE.Color(0.15, 0.15, 0.15) });
    const cans = new THREE.InstancedMesh(canGeo, canMat, shelves * perRow);
    const palette = ['#d4202a', '#f2c418', '#1f5fd8', '#2fa84a', '#111111', '#f4f4f0', '#ff7a1a', '#9a2fd8'].map((c) => new THREE.Color(c));
    const m = new THREE.Matrix4();
    let k = 0;
    for (let r = 0; r < shelves; r++) {
      const y = winY - winH / 2 + 0.05 + r * (winH / shelves);
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, winW), rim);
      shelf.position.set(front + 0.1, y - 0.006, winZ); g.add(shelf);
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(winW - 0.04, 0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8) }));
      tag.rotation.y = -Math.PI / 2; tag.position.set(front + 0.02, y - 0.02, winZ); g.add(tag);
      for (let c = 0; c < perRow; c++) {
        const zz = winZ - winW / 2 + 0.06 + (c * (winW - 0.12)) / (perRow - 1);
        m.makeTranslation(front + 0.1, y + 0.06, zz);
        cans.setMatrixAt(k, m);
        cans.setColorAt(k, palette[(r * 3 + c * 5) % palette.length]);
        // buttons
        const btn = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.03), new THREE.MeshBasicMaterial({ color: (r + c) % 4 === 0 ? new THREE.Color(0.2, 0.2, 0.2) : new THREE.Color(2.5, 0.6, 0.2) }));
        btn.position.set(front + 0.015, y - 0.02, zz); g.add(btn);
        k++;
      }
    }
    g.add(cans);
    // glass
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.04, winH + 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.5, depthWrite: false }));
    glass.rotation.y = -Math.PI / 2; glass.position.set(front - 0.004, winY, winZ); g.add(glass);
    // control panel
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.75), new THREE.MeshStandardMaterial({ map: T.vendingPanel(), roughness: 0.5, emissive: new THREE.Color(1, 1, 1), emissiveMap: null, emissiveIntensity: 0.0 }));
    (panel.material as THREE.MeshStandardMaterial).emissiveMap = (panel.material as THREE.MeshStandardMaterial).map;
    (panel.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
    panel.rotation.y = -Math.PI / 2; panel.position.set(front - 0.003, 1.15, 0.4); g.add(panel);
    // pickup slot
    const slot = this.box(this.mats.black, front + 0.0, front + 0.15, 0.18, 0.4, -0.45, 0.25, { parent: g });
    slot.position.x -= 0.001;
    const push = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.09), new THREE.MeshBasicMaterial({ map: T.pushStrip(), color: new THREE.Color(2.2, 2.2, 2.2) }));
    push.rotation.y = -Math.PI / 2; push.position.set(front - 0.004, 0.47, -0.1); g.add(push);
    this.vendingTray = new THREE.Vector3(g.position.x + front + 0.08, 0.22, g.position.z - 0.1);
    this.colliders.push({ x0: 1.36, x1: 2.2, z0: -18.5 - W / 2 - 0.02, z1: -18.5 + W / 2 + 0.02 });
    // lights
    const warm = new THREE.PointLight('#FF8A4C', 3.5, 6, 2); warm.position.set(1.0, 1.9, -18.5);
    this.addLight(warm, 'steady', signMat);
    const cool = new THREE.PointLight('#e8f4ff', 5, 7, 2); cool.position.set(0.85, 1.1, -18.6);
    this.addLight(cool);

  }

  // ---------------------------------------------------------------- room 2 (pump)
  buildRoom2() {
    const zc = -25;
    // 07 stencil on the corridor side of the right wall, before the door
    const s07 = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshStandardMaterial({ map: T.stencil07(), transparent: true, roughness: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    s07.rotation.y = -Math.PI / 2; s07.position.set(2.185, 1.7, -21.9);
    this.root.add(s07);
    // old whitewash patch behind the stencil so the dark paint reads
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), new THREE.MeshStandardMaterial({ map: T.concreteWall(9, [215, 210, 196]), roughness: 0.9 }));
    patch.rotation.y = -Math.PI / 2; patch.position.set(2.195, 1.65, -21.9); this.root.add(patch);
    // small caged lamp above the pump-room door
    const dlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9AEBFF').multiplyScalar(4) });
    const dl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.3), dlMat); dl.position.set(2.16, 2.62, -24); this.root.add(dl);
    const dlL = new THREE.PointLight('#9AEBFF', 3.5, 6, 2); dlL.position.set(1.8, 2.5, -23.2);
    this.addLight(dlL, 'flicker', dlMat);
    // tube light
    const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#52F2C8').multiplyScalar(5) });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), tubeMat);
    tube.rotation.z = Math.PI / 2; tube.position.set(5.4, 3.25, zc + 1.4);
    this.root.add(tube);
    const l = new THREE.PointLight('#52F2C8', 24, 13, 2);
    l.position.set(5.4, 3.0, zc + 1.2);
    this.addLight(l, 'buzz', tubeMat);
    // pump base
    this.box(this.mats.concrete2, 4.2, 6.8, 0, 0.35, zc + 1.0, zc - 1.0, { collide: true });
    const pump = new THREE.Group(); pump.position.set(5.5, 0.95, zc);
    const pm = this.mats.darkMetal;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 28), pm);
    motor.rotation.x = Math.PI / 2; pump.add(motor);
    for (let i = 0; i < 12; i++) {
      const fin = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.018, 4, 28), pm);
      fin.position.z = -0.6 + i * 0.11; pump.add(fin);
    }
    for (const z of [-0.85, 0.85]) {
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 28), this.mats.metal);
      fl.rotation.x = Math.PI / 2; fl.position.z = z; pump.add(fl);
    }
    const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 24), this.mats.metal);
    volute.rotation.x = Math.PI / 2; volute.position.set(0, 0, -1.2); pump.add(volute);
    for (const [x, z] of [[-0.45, 0.6], [0.45, 0.6], [-0.45, -0.6], [0.45, -0.6]]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2), pm); foot.position.set(x, -0.45, z); pump.add(foot);
    }
    this.root.add(pump);
    // discharge pipe up to ceiling then into the back wall
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5.5, 1.1, zc - 1.2), new THREE.Vector3(5.5, 1.9, zc - 1.3), new THREE.Vector3(5.6, 2.9, zc - 1.0),
      new THREE.Vector3(6.4, 3.25, zc - 0.6), new THREE.Vector3(8.3, 3.25, zc - 0.6),
    ]);
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.16, 14, false), this.mats.metal);
    this.root.add(pipe);
    for (const t of [0.15, 0.45, 0.85]) {
      const p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18), this.mats.darkMetal);
      fl.position.copy(p); fl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tg); this.root.add(fl);
    }
    // crate with a spare battery
    this.box(this.mats.wood, 7.3, 8.1, 0, 0.7, -26.9, -27.8, { collide: true });
    this.addPickup('battery', this.makeBattery(7.7, 0.7, -27.35));
    // puddle-side props
    this.box(this.mats.darkMetal, 7.6, 8.15, 0, 1.6, -22.2, -23.0, { collide: true }); // cabinet
    this.notes.push({ mesh: this.makeNote(7.55, 0.705, -27.0, -0.5), lines: [
      'PUMP 07 — MAINT.', '', 'Pump runs on its own.', 'Nobody switched it on.', '', 'If the lights die,', 'keep your torch on it.', 'Walk backwards.', 'Do not turn around.' ] });
    // hum source position
    this.pumpPos = new THREE.Vector3(5.5, 1, zc);
  }
  pumpPos = new THREE.Vector3();

  // ---------------------------------------------------------------- end gate + junction + lift B
  buildEnd() {
    const c = this.mats.concrete, c2 = this.mats.concrete2;
    this.wall(c, -2.6, -0.9, -36.0, -36.3);
    this.wall(c, 0.9, 2.6, -36.0, -36.3);
    this.box(c, -0.9, 0.9, 2.6, 3.6, -36.0, -36.3);
    // junction left wall + far wall with the lift opening (X -1.6..0.4)
    this.wall(c2, -2.6, -2.2, -36.3, -44.7);
    this.wall(c2, -2.6, -1.6, -44.3, -44.7);
    this.wall(c2, 0.4, 2.6, -44.3, -44.7);
    this.box(c2, -1.6, 0.4, 2.4, 3.6, -44.3, -44.7);
    // gate frame + chain-link gate, already forced open
    const frameMat = this.mats.darkMetal;
    this.box(frameMat, -0.95, -0.85, 0, 2.6, -36.05, -36.25);
    this.box(frameMat, 0.85, 0.95, 0, 2.6, -36.05, -36.25);
    const gate = new THREE.Group();
    gate.position.set(-0.88, 0, -36.15);
    const link = T.chainLink(); link.repeat.set(1.7 / 0.35, 2.5 / 0.35);
    const meshMat = new THREE.MeshStandardMaterial({ map: link, alphaMap: link, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.5, color: 0x9aa0a0 });
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.5), meshMat);
    leaf.position.set(0.88, 1.28, 0); gate.add(leaf);
    for (const [x0, x1, y0, y1] of [[0, 1.76, 0.02, 0.06], [0, 1.76, 2.5, 2.54], [0, 0.04, 0, 2.55], [1.72, 1.76, 0, 2.55], [0, 1.76, 1.25, 1.29]]) {
      const b = new THREE.Mesh(boxGeo(x0, x1, y0, y1, -0.02, 0.02, { u: 1, v: 1 }), frameMat); gate.add(b);
    }
    gate.rotation.y = -1.35;
    this.root.add(gate);
    this.gate = gate;
    this.gateCollider = { x0: -0.9, x1: 0.9, z0: -36.3, z1: -36.0, enabled: false, tag: 'gate' };
    // a broken padlock on the floor
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0x9a7a2a, metalness: 1, roughness: 0.4 }));
    lock.position.set(0.5, 0.03, -36.6); lock.rotation.set(Math.PI / 2, 0, 0.7); this.root.add(lock);
    // shelving along the junction's left wall
    for (const z of [-37.2, -38.4, -39.6, -40.8]) {
      this.box(this.mats.darkMetal, -2.15, -1.5, 0, 2.2, z, z - 0.06);
      for (let s = 0; s < 4; s++) this.box(this.mats.black, -2.15, -1.5, 0.3 + s * 0.6, 0.33 + s * 0.6, z + 0.5, z - 0.6);
    }
    this.colliders.push({ x0: -2.2, x1: -1.45, z0: -41.4, z1: -36.6 });
    this.occluders.push({ x0: -2.2, x1: -1.45, z0: -41.4, z1: -36.6 });
    // lift car
    this.wall(this.mats.darkMetal, -2.0, -1.6, -44.7, -47.6);
    this.wall(this.mats.darkMetal, 0.4, 0.8, -44.7, -47.6);
    this.wall(this.mats.darkMetal, -2.0, 0.8, -47.2, -47.6);
    this.box(this.mats.metal, -1.6, 0.4, 0, 0.04, -44.7, -47.2);
    const carMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#A8C96A').multiplyScalar(2.5) });
    const carLamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.3), carMat); carLamp.position.set(-0.6, 2.5, -46.0); this.root.add(carLamp);
    // rolling shutter (opens when power is restored)
    const shutterMat = new THREE.MeshStandardMaterial({ map: this.tex.metal, color: 0x7a7e80, roughness: 0.5, metalness: 0.8 });
    this.liftDoor = this.box(shutterMat, -1.6, 0.4, 0, 2.4, -44.35, -44.55);
    for (let i = 0; i < 12; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 0.02), this.mats.black);
      slat.position.set(-0.6, 0.15 + i * 0.19, -44.33); this.liftDoor.add(slat);
    }
    this.liftCollider = { x0: -1.6, x1: 0.4, z0: -44.7, z1: -44.3, enabled: true, tag: 'door' };
    this.colliders.push(this.liftCollider); this.wallColliders.push(this.liftCollider); this.occluders.push(this.liftCollider);
    // call panel
    this.box(this.mats.black, 0.6, 0.8, 1.15, 1.45, -44.26, -44.3);
    this.liftLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.1, 0.05) });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), this.liftLed); led.position.set(0.7, 1.38, -44.25); this.root.add(led);
    // sickly lamp over the lift
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#A8C96A').multiplyScalar(3) });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), lampMat); lamp.position.set(-0.6, 2.8, -44.22); this.root.add(lamp);
    this.liftLight = new THREE.PointLight('#A8C96A', 5, 9, 2);
    this.liftLight.position.set(-0.6, 2.5, -43.4);
    this.addLight(this.liftLight, 'flicker', lampMat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: T.warningSign('LIFT B', '関係者以外立入禁止'), roughness: 0.7 }));
    sign.position.set(1.4, 2.0, -44.29); this.root.add(sign);
    void carMat;
  }

  buildSpawn() {
    // back wall with a sealed steel door
    this.wall(this.mats.concrete, -2.6, 2.6, 0.8, 0.4);
    this.box(this.mats.darkMetal, -0.6, 0.6, 0, 2.2, 0.42, 0.36);
    const exitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.02, 0.02) });
    const exit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.05), exitMat);
    exit.position.set(0, 2.45, 0.38); this.root.add(exit);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: T.warningSign('CORRIDOR A', 'SECTOR 4 — 夜間巡回'), roughness: 0.7 }));
    sign.rotation.y = 0; sign.position.set(-1.4, 1.7, 0.39); this.root.add(sign);
  }

  // ---------------------------------------------------------------- scattered debris
  buildDebris() {
    const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), this.mats.concrete2, 120);
    const paper = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xb8b4a6, roughness: 1 }), 24);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const r = this.rnd;
    for (let i = 0; i < 120; i++) {
      const side = r() < 0.5 ? -1.85 + r() * 0.35 : 1.75 + r() * 0.4;
      const s = 0.02 + Math.pow(r(), 3) * 0.12;
      q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3));
      m.compose(new THREE.Vector3(side, s * 0.5, -1 - r() * 34), q, new THREE.Vector3(s, s * 0.6, s));
      rubble.setMatrixAt(i, m);
    }
    for (let i = 0; i < 24; i++) {
      const s = 0.04 + r() * 0.05;
      q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3));
      m.compose(new THREE.Vector3(-1.9 + r() * 3.8, s * 0.6, -1 - r() * 34), q, new THREE.Vector3(s, s * 0.8, s));
      paper.setMatrixAt(i, m);
    }
    this.root.add(rubble, paper);
    // floor cans
    for (let i = 0; i < 9; i++) this.can(r() < 0.5 ? -1.8 + r() * 0.3 : 1.6 + r() * 0.4, 0, -2 - r() * 33, true);
  }

  buildAmbient() {
    const hemi = new THREE.HemisphereLight('#1d3350', '#0a0c0c', 0.55);
    this.root.add(hemi);
    const moon = new THREE.DirectionalLight('#5d86c4', 0.45);
    moon.position.set(-20, 10, -10); moon.target.position.set(0, 0, -15);
    this.root.add(moon, moon.target);
  }

  // ---------------------------------------------------------------- per-frame
  update(dt: number, t: number) {
    // power follows its target smoothly-ish (blackouts are abrupt)
    const k = this.powerTarget < this.power ? 1 : Math.min(1, dt * 3);
    this.power += (this.powerTarget - this.power) * k;
    for (const L of this.lights) {
      let v = 1;
      if (L.mode === 'flicker') {
        const n = Math.sin(t * 13.1 + L.seed) * Math.sin(t * 7.3 + L.seed * 2) + Math.sin(t * 0.7 + L.seed);
        v = n > 1.45 ? 0.05 : n > 1.2 ? 0.5 + Math.random() * 0.5 : 1;
      } else if (L.mode === 'fire') {
        v = 0.75 + Math.sin(t * 7.1 + L.seed) * 0.1 + Math.sin(t * 17.3) * 0.08 + Math.random() * 0.1;
      } else if (L.mode === 'buzz') {
        v = 0.93 + Math.random() * 0.07;
        if (Math.sin(t * 0.37 + L.seed) > 0.985) v = Math.random() < 0.5 ? 0.1 : 1;
      }
      if (this.steadyLights) v = 1;
      L.value = v * this.power;
      L.light.intensity = L.base * L.value;
      if (L.emissive && L.emissiveBase) {
        const target = 'emissive' in L.emissive ? (L.emissive as THREE.MeshStandardMaterial).emissive : (L.emissive as THREE.MeshBasicMaterial).color;
        target.copy(L.emissiveBase).multiplyScalar(Math.max(0.03, L.value));
      }
    }
    for (const lm of this.ledMats) {
      const on = Math.sin(t * 9) * Math.sin(t * 2.3) > -0.3 ? 1 : 0.05;
      lm.color.set('#9AEBFF').multiplyScalar(3.2 * on * this.power + 0.02);
    }
    // fuses bob/glow
    for (const p of this.pickups) if (p.obj.visible && p.kind === 'fuse') p.obj.rotation.y += dt * 1.2;
    if (this.swing) {
      const a = Math.sin(t * 1.25) * 0.32 + Math.sin(t * 0.37) * 0.08;
      this.swing.pivot.rotation.z = a;
      this.swing.pivot.updateMatrixWorld();
      this.swing.bulb.getWorldPosition(this.swing.light.position);
    }
    if (this.secOpening && this.secOpen < 1) {
      this.secOpen = Math.min(1, this.secOpen + dt * 0.8);
      this.secDoor.position.x = this.secOpen * 1.95;
      if (this.secOpen > 0.6) this.secCollider.enabled = false;
    }
    if (this.liftOpening && this.liftOpen < 1) {
      this.liftOpen = Math.min(1, this.liftOpen + dt * 0.4);
      this.liftDoor.position.y = this.liftOpen * 2.3;
      if (this.liftOpen > 0.7) this.liftCollider.enabled = false;
    }
    void sin;
  }
}

export { DEG, vec3 };
