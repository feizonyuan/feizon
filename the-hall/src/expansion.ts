// Corridor B and everything beyond the junction: locker room, security office, storage,
// stairwell and the B2 boiler room. All procedural.
import * as THREE from 'three/webgpu';
import type { Level, AABB } from './corridorBuilder';
import * as T from './proceduralTextures';
import { BASEMENT_Y, STAIR_X0, STAIR_X1 } from './nav';

const PI = Math.PI;

function sign(L: Level, lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, bg?: string, fg?: string) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: T.signTex(lines, bg, fg), roughness: 0.8 }));
  m.position.set(x, y, z); m.rotation.y = rotY; L.root.add(m);
  return m;
}

function fixture(L: Level, x: number, y: number, z: number, color: string, intensity: number, mode: 'steady' | 'flicker' | 'buzz' | 'fire', alongX = true, dead = false) {
  const mat = new THREE.MeshBasicMaterial({ color: dead ? new THREE.Color(0.02, 0.02, 0.02) : new THREE.Color(color).multiplyScalar(4) });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8), mat);
  tube.rotation.z = alongX ? PI / 2 : 0; tube.rotation.x = alongX ? 0 : PI / 2;
  tube.position.set(x, y - 0.08, z); L.root.add(tube);
  const hous = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 1.3 : 0.14, 0.05, alongX ? 0.14 : 1.3), L.mats.darkMetal);
  hous.position.set(x, y, z); L.root.add(hous);
  if (dead) return null;
  const l = new THREE.PointLight(color, intensity, 11, 2);
  l.position.set(x, y - 0.3, z);
  return L.addLight(l, mode, mat);
}

export function buildExpansion(L: Level) {
  const c2 = L.mats.concrete2, c = L.mats.concrete, dm = L.mats.darkMetal;

  // ================================================================ junction side walls
  L.wall(c2, 2.2, 2.6, -36.3, -38.1);
  L.wall(c2, 2.2, 2.6, -42.9, -44.7);

  // ================================================================ corridor B shell
  // north wall (door holes: security 16..18, storage 26.5..28.5)
  L.wall(c2, 2.2, 16, -38.1, -38.5);
  L.wall(c2, 18, 26.5, -38.1, -38.5);
  L.wall(c2, 28.5, STAIR_X0, -38.1, -38.5);
  L.box(c2, 16, 18, 2.4, 3.6, -38.1, -38.5);
  L.box(c2, 26.5, 28.5, 2.4, 3.6, -38.1, -38.5);
  // south wall (door hole: lockers 10..12)
  L.wall(c2, 2.2, 10, -42.5, -42.9);
  L.wall(L.mats.brick, 12, 18, -42.5, -42.9);
  L.wall(c2, 18, STAIR_X0, -42.5, -42.9);
  L.box(c2, 10, 12, 2.4, 3.6, -42.5, -42.9);
  // door frames
  for (const [x0, x1, zw] of [[16, 18, -38.3], [26.5, 28.5, -38.3], [10, 12, -42.7]] as const) {
    L.box(dm, x0 - 0.08, x0, 0, 2.45, zw - 0.26, zw + 0.26);
    L.box(dm, x1, x1 + 0.08, 0, 2.45, zw - 0.26, zw + 0.26);
    L.box(dm, x0 - 0.08, x1 + 0.08, 2.38, 2.46, zw - 0.26, zw + 0.26);
  }
  // pipes along the ceiling
  for (const [z, y, r] of [[-38.75, 3.35, 0.09], [-38.95, 3.42, 0.05], [-42.25, 3.3, 0.12]] as const) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, STAIR_X1 - 2.2, 10), dm);
    p.rotation.z = PI / 2; p.position.set((STAIR_X1 + 2.2) / 2, y, z); L.root.add(p);
  }
  // lights: one flickering, one buzzing, one dead
  fixture(L, 7, 3.5, -40.5, '#cfe8ff', 15, 'flicker');
  fixture(L, 15, 3.5, -40.5, '#d8f0ff', 12, 'buzz');
  fixture(L, 23, 3.5, -40.5, '#ffffff', 0, 'steady', true, true);
  fixture(L, 31.5, 3.5, -40.5, '#c8dcff', 11, 'flicker');
  // signs
  sign(L, ['CORRIDOR B', 'B 通路 · SECTOR 4'], 1.1, 0.55, 3.2, 2.0, -38.49, PI, '#d8b21c');
  sign(L, ['警備室 →', 'SECURITY'], 0.8, 0.4, 14.8, 1.8, -38.49, PI);
  sign(L, ['← 更衣室', 'LOCKER ROOM'], 0.8, 0.4, 13.0, 1.8, -42.49, 0);
  sign(L, ['倉庫', 'STORAGE'], 0.6, 0.3, 29.4, 1.9, -38.49, PI);
  sign(L, ['B2 ↓', 'BOILER · ボイラー室'], 0.9, 0.45, 34.4, 1.9, -42.49, 0, '#b8281e', '#f4f0e8');
  // debris & a toppled chair
  for (let i = 0; i < 30; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + L.rnd() * 0.08, 0), c2);
    r.position.set(3 + L.rnd() * 32, 0.03, L.rnd() < 0.5 ? -38.7 - L.rnd() * 0.4 : -42.3 + L.rnd() * 0.4);
    r.rotation.set(L.rnd() * 3, L.rnd() * 3, 0); L.root.add(r);
  }
  const chair = new THREE.Group();
  chair.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), dm));
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.04), dm); back.position.set(0, 0.24, -0.2); chair.add(back);
  chair.rotation.set(PI / 2.2, 0.6, 0); chair.position.set(20.5, 0.22, -41.8); L.root.add(chair);
  L.colliders.push({ x0: 20.1, x1: 20.9, z0: -42.3, z1: -41.3 });
  L.can(24.3, 0, -39.0, true); L.can(8.2, 0, -42.1, true);

  // ================================================================ locker room (flooded)
  L.wall(c2, 7.6, 8, -42.9, -50.9);
  L.wall(c2, 16, 16.4, -42.9, -50.9);
  L.wall(L.mats.brickOnly, 7.6, 16.4, -50.5, -50.9);
  {
    const front = new THREE.MeshStandardMaterial({ map: T.lockerTex(81), roughness: 0.5, metalness: 0.6 });
    const side = new THREE.MeshStandardMaterial({ color: 0x4a5450, roughness: 0.55, metalness: 0.6 });
    const geo = new THREE.BoxGeometry(0.45, 1.85, 0.5);
    geo.translate(0, 0.925, 0);
    const places: [number, number, number, number][] = []; // x, z, rotY, tilt
    for (let i = 0; i < 12; i++) {
      places.push([9.0 + i * 0.49, -46.0 + 0.25, 0, 0]);
      places.push([9.0 + i * 0.49, -47.0 - 0.25 + 0.5, PI, 0]);
    }
    for (let i = 0; i < 15; i++) places.push([8.4 + i * 0.49, -50.25, 0, 0]);
    const inst = new THREE.InstancedMesh(geo, [side, side, side, side, front, side], places.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    places.forEach(([x, z, r], i) => {
      q.setFromEuler(new THREE.Euler(0, r + (L.rnd() - 0.5) * 0.04, 0));
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m);
    });
    L.root.add(inst);
    const rowA: AABB = { x0: 8.7, x1: 14.6, z0: -47.05, z1: -45.45 };
    const rowB: AABB = { x0: 8.1, x1: 15.6, z0: -50.5, z1: -49.95 };
    L.colliders.push(rowA, rowB); L.occluders.push(rowA);
    // one locker fallen over
    const fallen = new THREE.Mesh(geo, [side, side, side, side, front, side]);
    fallen.rotation.set(0, 0.12, PI / 2); fallen.position.set(15.6, 0.23, -44.4); L.root.add(fallen);
    L.colliders.push({ x0: 13.6, x1: 15.8, z0: -44.75, z1: -44.05 });
  }
  // bench
  L.box(L.mats.wood, 9.4, 13.2, 0.42, 0.47, -43.95, -44.35, { collide: true });
  for (const x of [9.6, 13.0]) L.box(dm, x - 0.04, x + 0.04, 0, 0.42, -44.1, -44.2);
  L.addPickup('fuse', L.makeFuse(12.6, 0.47, -44.15));
  L.addPickup('battery', L.makeBattery(9.8, 0.47, -44.15));
  L.notes.push({ mesh: L.makeNote(11.2, 0.475, -44.15, 0.2), lines: [
    'SHIFT CHANGE — 11/20', '', 'Took one fuse home by', 'mistake. Left it on the', 'bench. Sorry.', '',
    'The last spare is locked in', 'Security. Tanaka has the', 'card. Tanaka went down to', 'the boiler room on Tuesday.', '', 'Nobody has seen Tanaka.' ] });
  fixture(L, 12, 3.5, -46.5, '#c8ffe8', 15, 'buzz', true);

  // ================================================================ security office (keycard door)
  L.wall(c2, 13.6, 14, -32, -38.1);
  L.wall(c2, 20, 20.4, -32, -38.1);
  L.wall(c2, 13.6, 20.4, -31.6, -32);
  {
    const doorMat = new THREE.MeshStandardMaterial({ map: L.tex.darkMetal, color: 0x8a9096, roughness: 0.35, metalness: 0.85 });
    L.secDoor = L.box(doorMat, 16, 18, 0, 2.38, -38.22, -38.38);
    L.secCollider = { x0: 16, x1: 18, z0: -38.5, z1: -38.1, enabled: true, tag: 'door' };
    L.colliders.push(L.secCollider); L.wallColliders.push(L.secCollider); L.occluders.push(L.secCollider);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.12), new THREE.MeshStandardMaterial({ map: T.warningSign('', ''), roughness: 0.7 }));
    stripe.rotation.y = PI; stripe.position.set(17, 1.0, -38.39); L.secDoor.add(stripe);
    // reader
    L.box(L.mats.black, 18.35, 18.55, 1.18, 1.42, -38.5, -38.56);
    L.secLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.1, 0.05) });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), L.secLed);
    led.position.set(18.45, 1.38, -38.565); L.root.add(led);
  }
  // desk + monitor bank facing the door
  L.box(L.mats.wood, 14.4, 19.6, 0.74, 0.78, -32.1, -33.0, { collide: true });
  L.box(dm, 14.45, 14.55, 0, 0.74, -32.2, -32.9); L.box(dm, 19.45, 19.55, 0, 0.74, -32.2, -32.9);
  {
    const bezel = L.mats.black;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
      const x = 16.0 + k * 0.62, y = 1.05 + r * 0.47;
      L.box(bezel, x - 0.29, x + 0.29, y - 0.22, y + 0.22, -32.15, -32.5);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshBasicMaterial({ color: 0x050805 }));
      scr.rotation.y = PI; scr.position.set(x, y, -32.505); L.root.add(scr);
      L.cctvScreens.push(scr);
    }
  }
  L.box(dm, 16.6, 17.1, 0.44, 0.48, -33.6, -34.1); // chair
  L.box(dm, 16.6, 17.1, 0.48, 0.95, -34.06, -34.1);
  L.box(dm, 19.4, 19.95, 0, 2.1, -34.5, -36.5, { collide: true }); // filing cabinets
  L.addPickup('fuse', L.makeFuse(15.0, 0.79, -32.6));
  L.notes.push({ mesh: L.makeNote(18.6, 0.785, -32.5, -0.2), lines: [
    'CCTV — INCIDENT LOG', '', '02:13 CAM 04: figure in B.', '02:14 CAM 04: figure gone.', '02:14 CAM 01: figure in A.',
    '', 'That is 40 meters in', 'under a minute.', '', 'It never shows up on the', 'same camera you are', 'watching.' ] });
  {
    const l = new THREE.PointLight('#b8c8ff', 18, 11, 2); l.position.set(17, 2.8, -34.2);
    L.addLight(l, 'buzz');
  }

  // ================================================================ storage
  L.wall(c2, 23.6, 24, -32, -38.1);
  L.wall(c2, 31, 31.4, -32, -38.1);
  L.wall(L.mats.brickOnly, 23.6, 31.4, -31.6, -32);
  {
    const cb = new THREE.MeshStandardMaterial({ map: T.cardboardTex(), roughness: 0.95 });
    const stacks: [number, number, number][] = [[24.7, -33.0, 4], [25.5, -33.1, 3], [24.7, -34.0, 2], [30.2, -32.9, 5], [30.3, -34.0, 3], [29.4, -33.0, 2], [25.0, -36.6, 3], [30.1, -36.8, 4], [29.2, -35.6, 1]];
    for (const [x, z, n] of stacks) {
      for (let i = 0; i < n; i++) {
        const s = 0.55 + L.rnd() * 0.15;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, s, 0.6), cb);
        b.position.set(x + (L.rnd() - 0.5) * 0.1, i * 0.58 + s / 2, z + (L.rnd() - 0.5) * 0.1);
        b.rotation.y = (L.rnd() - 0.5) * 0.3; L.root.add(b);
      }
      const bb: AABB = { x0: x - 0.42, x1: x + 0.42, z0: z - 0.38, z1: z + 0.38 };
      L.colliders.push(bb); if (n >= 3) L.occluders.push(bb);
    }
    // metal shelving along the back wall
    L.box(dm, 26.2, 28.8, 0, 2.2, -32.05, -32.6, { collide: true });
    for (let s = 0; s < 4; s++) L.box(L.mats.black, 26.22, 28.78, 0.3 + s * 0.6, 0.33 + s * 0.6, -32.06, -32.58);
  }
  L.addPickup('battery', L.makeBattery(27.0, 0.93, -32.35));
  L.notes.push({ mesh: L.makeNote(28.0, 0.335, -32.32, 0.1), lines: [
    'If you are reading this,', 'the lift still works.', '', 'Power it from the breaker', 'in A. Three fuses.', '',
    'Then RUN to the junction.', 'It gets faster when the', 'lights come back.' ] });
  {
    // a bare bulb swinging on its cord
    const pivot = new THREE.Group(); pivot.position.set(27.4, 3.6, -35.2); L.root.add(pivot);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.1, 4), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    cord.position.y = -0.55; pivot.add(cord);
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(6) });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bulbMat); bulb.position.y = -1.13; pivot.add(bulb);
    const l = new THREE.PointLight('#ffcf8a', 10, 10, 2);
    L.addLight(l, 'steady', bulbMat);
    L.swing = { pivot, light: l, bulb };
  }

  // ================================================================ stairwell
  L.wall(c2, STAIR_X0, STAIR_X1, -38.1, -38.5, BASEMENT_Y, 3.6);
  L.wall(c2, STAIR_X0, STAIR_X1, -42.5, -42.9, BASEMENT_Y, 3.6);
  const steps = 18, run = (STAIR_X1 - STAIR_X0) / steps;
  for (let i = 0; i < steps; i++) {
    const top = ((i + 1) / steps) * BASEMENT_Y;
    L.box(c, STAIR_X0 + i * run, STAIR_X0 + (i + 1) * run, BASEMENT_Y, top, -38.5, -42.5);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 3.9), new THREE.MeshStandardMaterial({ color: 0x8a7a2a, metalness: 0.6, roughness: 0.5 }));
    nose.position.set(STAIR_X0 + i * run + 0.02, top + 0.01, -40.5); L.root.add(nose);
  }
  {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(STAIR_X1 - STAIR_X0, BASEMENT_Y), 8), dm);
    rail.position.set((STAIR_X0 + STAIR_X1) / 2, BASEMENT_Y / 2 + 0.95, -42.4);
    rail.rotation.z = PI / 2 + Math.atan2(-BASEMENT_Y, STAIR_X1 - STAIR_X0); L.root.add(rail);
  }
  // red emergency lamp at the bottom
  {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.1) });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.1), mat); lamp.position.set(42.5, -0.8, -38.6); L.root.add(lamp);
    const l = new THREE.PointLight('#ff2a1f', 8, 11, 2); l.position.set(42.3, -1.0, -39.0);
    L.addLight(l, 'steady', mat);
  }
  sign(L, ['B2', 'ボイラー室 BOILER ROOM'], 0.8, 0.4, 37.2, 1.9, -38.49, PI, '#b8281e', '#f4f0e8');

  // ================================================================ boiler room (B2)
  const Y = BASEMENT_Y;
  L.wall(c, 43.6, 44, -32.6, -38.5, Y, -0.1);
  L.wall(c, 43.6, 44, -42.5, -48.4, Y, -0.1);
  L.box(c, 43.6, 44, -0.1, 3.6, -38.5, -42.5);
  L.wall(L.mats.brickOnly, 56, 56.4, -32.6, -48.4, Y, -0.1);
  L.wall(c, 43.6, 56.4, -32.6, -33, Y, -0.1);
  L.wall(c, 43.6, 56.4, -48, -48.4, Y, -0.1);
  {
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 15), L.mats.ceiling);
    ceil.rotation.x = PI / 2; ceil.position.set(50, -0.1, -40.5); L.root.add(ceil);
    const floorMat = new THREE.MeshStandardMaterial({ map: L.tex.floorDetail, color: 0x7a8486, roughness: 0.12, metalness: 0.1 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(12, 15), floorMat);
    fl.rotation.x = -PI / 2; fl.position.set(50, Y, -40.5); L.root.add(fl);
  }
  // boiler tank
  {
    const g = new THREE.Group(); g.position.set(51.5, Y + 1.85, -40.5); L.root.add(g);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 6.4, 32), L.mats.metal);
    tank.rotation.x = PI / 2; g.add(tank);
    for (let i = 0; i < 6; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.04, 6, 32), dm); band.position.z = -2.8 + i * 1.12; g.add(band);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 12, 0, PI * 2, 0, PI / 2), L.mats.metal);
    cap.rotation.x = PI / 2; cap.scale.set(1, 0.35, 1); cap.position.z = 3.2; g.add(cap);
    // firebox door (glowing grate)
    const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.6, 0.4) });
    const grate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), fireMat);
    grate.position.set(0, -0.7, 3.62); g.add(grate);
    for (let i = 0; i < 6; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.47, 0.03), L.mats.black); bar.position.set(-0.3 + i * 0.12, -0.7, 3.64); g.add(bar); }
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.08), dm); doorFrame.position.set(0, -0.7, 3.55); g.add(doorFrame);
    for (const z of [-2.6, 2.6]) for (const x of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.3), dm); leg.position.set(x, -1.4, z); g.add(leg);
    }
    // stacks to the ceiling
    for (const z of [-1.8, 1.4]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2, 12), L.mats.metal); p.position.set(0, 2.2, z); g.add(p);
    }
    // valve wheels on the side
    for (const z of [-1.5, 0, 1.5]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 18), new THREE.MeshStandardMaterial({ color: 0x8a1a12, roughness: 0.5, metalness: 0.5 }));
      w.rotation.y = PI / 2; w.position.set(-1.45, 0.4, z); g.add(w);
    }
    L.colliders.push({ x0: 50.0, x1: 53.0, z0: -43.9, z1: -36.9 });
    L.occluders.push({ x0: 50.2, x1: 52.8, z0: -43.7, z1: -37.3 });
    const fire = new THREE.PointLight('#ff7a2a', 26, 15, 2); fire.position.set(51.5, Y + 1.0, -36.1);
    L.addLight(fire, 'fire', fireMat);
    L.boilerPos.set(51.5, Y + 1.5, -40.5);
  }
  // pipes running along the walls
  for (const [x, z, len, alongX] of [[50, -33.3, 12, true], [55.7, -40.5, 15, false]] as const) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, len, 10), dm);
    if (alongX) p.rotation.z = PI / 2; else p.rotation.x = PI / 2;
    p.position.set(x, -0.5, z); L.root.add(p);
  }
  // workbench with the keycard
  L.box(L.mats.wood, 53.4, 55.8, Y + 0.8, Y + 0.85, -46.9, -47.8, { collide: true });
  for (const x of [53.5, 55.7]) L.box(dm, x - 0.04, x + 0.04, Y, Y + 0.8, -47.0, -47.7);
  L.addPickup('keycard', L.makeKeycard(54.8, Y + 0.855, -47.3));
  L.notes.push({ mesh: L.makeNote(54.0, Y + 0.855, -47.4, 0.4), lines: [
    'TANAKA —', '', 'I am leaving the card', 'here. I am not going', 'back up those stairs.', '',
    'It stood at the top', 'for an hour. Watching.', '', 'When the furnace dims,', 'it is already down here.' ] });
  fixture(L, 47, -0.15, -45.5, '#9fd4ff', 12, 'buzz', true);
  fixture(L, 53.5, -0.15, -46.2, '#cfe4ff', 9, 'flicker', true);
  sign(L, ['危険', 'HIGH TEMPERATURE'], 0.7, 0.35, 47.0, Y + 1.8, -32.99, 0, '#d8b21c');
}
