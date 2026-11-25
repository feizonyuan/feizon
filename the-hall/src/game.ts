// Game rules: objectives, pickups, doors, the stalker, scares, death/ending, demo tour.
import * as THREE from 'three/webgpu';
import { Level, worldUniforms, type AABB } from './corridorBuilder';
import { BodycamRig, EYE } from './bodycamRig';
import { Entity } from './entity';
import { AudioSystem } from './audioSystem';
import { Hud } from './hud';
import { postUniforms } from './postProcessing';
import { zoneOf, groundY, candidatePoints, setPortal, BASEMENT_Y } from './nav';

type State = 'title' | 'play' | 'paused' | 'dying' | 'dead' | 'ending' | 'tour';

interface Interactable {
  pos: THREE.Vector3;
  obj?: THREE.Object3D; // dynamic position source
  radius: number;
  label: () => string | null;
  action: () => void;
}

export const SHOTS: { pos: [number, number, number]; yaw: number; pitch: number; label: string }[] = [
  { pos: [0, EYE, -1.5], yaw: 0, pitch: -0.02, label: 'CAM 02 / CORRIDOR A' },
  { pos: [1.0, EYE, -7.2], yaw: -Math.PI / 2, pitch: 0.04, label: 'CAM 02 / ROOM 1' },
  { pos: [-0.9, EYE, -11.0], yaw: -0.72, pitch: 0.06, label: 'CAM 02 / SECTION B' },
  { pos: [-1.1, EYE, -13.6], yaw: 1.2, pitch: 0.1, label: 'CAM 02 / WINDOW BAY 4' },
  { pos: [-0.85, EYE, -18.5], yaw: -Math.PI / 2, pitch: -0.06, label: 'CAM 02 / VENDING' },
  { pos: [0.2, EYE, -20.6], yaw: -1.12, pitch: 0.05, label: 'CAM 02 / PUMP ROOM 07' },
  { pos: [0.6, EYE, -40.5], yaw: -Math.PI / 2, pitch: 0.0, label: 'CAM 02 / CORRIDOR B' },
  { pos: [11, EYE, -43.3], yaw: -0.25, pitch: -0.08, label: 'CAM 02 / LOCKER ROOM' },
  { pos: [17, EYE, -37.2], yaw: Math.PI, pitch: -0.08, label: 'CAM 02 / SECURITY' },
  { pos: [45.2, BASEMENT_Y + EYE, -40.5], yaw: -Math.PI / 2 + 0.35, pitch: 0.08, label: 'CAM 02 / BOILER ROOM B2' },
];

// bodycam auto-gain: darker zones get more sensor gain (and visibly more noise)
const GAIN: Record<string, number> = { A: 1, R1: 1.05, R2: 1.1, J: 1.35, B: 1.4, LOCK: 1.4, SEC: 1.3, STOR: 1.4, STAIR: 1.5, BOIL: 1.45 };
const FOG: Record<string, number> = { A: 0.032, R1: 0.032, R2: 0.034, J: 0.04, B: 0.042, LOCK: 0.046, SEC: 0.03, STOR: 0.04, STAIR: 0.045, BOIL: 0.052 };

export class Game {
  state: State = 'title';
  fusesHeld = 0;
  fusesFound = 0;
  fusesInstalled = 0;
  hasKeycard = false;
  vendingUses = 0;
  powerRestored = false;
  battery = 92;
  flashOn = false;
  flashlight: THREE.SpotLight;
  checkpoint = { x: 0, z: -1.5, yaw: 0 };
  lockGrace = 0;
  exposureGain = 1;
  private flashDir = new THREE.Vector3(0, 0, -1);
  private interactables: Interactable[] = [];
  private current: Interactable | null = null;
  private seenPrev = false;
  private stingerCd = 0;
  private blackoutTimer = 30;
  private blackoutLeft = 0;
  private teleportCd = 0;
  private dyingT = 0;
  private endingT = 0;
  private tourIdx = 0;
  private tourT = 0;
  private tourFrom: { pos: THREE.Vector3; yaw: number; pitch: number } | null = null;
  private rolling: { obj: THREE.Object3D; vel: THREE.Vector3; t: number }[] = [];
  private wetData: ImageData | null = null;
  private frozenShot = -1;
  private lastZone = 'A';
  overlay: HTMLElement;

  constructor(
    public level: Level,
    public rig: BodycamRig,
    public entity: Entity,
    public audio: AudioSystem,
    public hud: Hud,
    public scene: THREE.Scene,
  ) {
    this.overlay = document.getElementById('overlay')!;
    // chest flashlight
    const fl = new THREE.SpotLight('#eef6ff', 0, 22, 0.42, 0.45, 1.6);
    fl.castShadow = true; fl.shadow.mapSize.set(1024, 1024); fl.shadow.bias = -0.0004; fl.shadow.camera.near = 0.2;
    scene.add(fl, fl.target);
    this.flashlight = fl;
    this.buildInteractables();
    this.rig.onStep = (i) => this.audio.footstep(i, this.isWet(this.rig.pos.x, this.rig.pos.z));
    const img = level.tex.floorMacro.image as HTMLCanvasElement;
    try { this.wetData = img.getContext('2d')!.getImageData(0, 0, img.width, img.height); } catch { this.wetData = null; }

    window.addEventListener('keydown', (e) => this.onKey(e));
    this.updateObjective();
  }

  isWet(x: number, z: number) {
    if (x >= 44) return true; // basement floor is soaked
    if (x > 36) return false; // stairs
    if (!this.wetData) return false;
    const r = this.level.floorRect;
    const u = (x - r.X0) / r.W, v = (r.Z0 - z) / r.D;
    const px = Math.floor(u * this.wetData.width), py = Math.floor(v * this.wetData.height);
    if (px < 0 || py < 0 || px >= this.wetData.width || py >= this.wetData.height) return false;
    return this.wetData.data[(py * this.wetData.width + px) * 4] / 255 > (worldUniforms.wetThreshold.value as number) + 0.03;
  }

  // ------------------------------------------------------------------ interactions
  private centerOf(o: THREE.Object3D) {
    return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  }

  private addPickupInteractable(obj: THREE.Object3D, kind: 'fuse' | 'battery' | 'keycard') {
    const names = { fuse: 'FUSE', battery: 'BATTERIES', keycard: 'KEYCARD' };
    this.interactables.push({
      pos: this.centerOf(obj), obj, radius: 1.6,
      label: () => (obj.visible ? `[E] PICK UP ${names[kind]}` : null),
      action: () => this.take(obj, kind),
    });
  }

  buildInteractables() {
    const L = this.level;
    L.pickups.forEach((p) => this.addPickupInteractable(p.obj, p.kind));
    L.notes.forEach((n) => {
      this.interactables.push({ pos: n.mesh.position, radius: 1.5, label: () => '[E] READ NOTE', action: () => { this.hud.showNote(n.lines); this.audio.click(0.6); } });
    });
    this.interactables.push({ pos: L.vendingPos, radius: 2.2, label: () => '[E] YORU COLA (¥150)', action: () => this.useVending() });
    this.interactables.push({
      pos: L.breakerPos, radius: 1.8,
      label: () => {
        if (this.powerRestored) return 'BREAKER — ONLINE';
        if (this.fusesHeld > 0) return `[E] INSERT FUSE (${this.fusesInstalled}/3)`;
        const m = 3 - this.fusesInstalled;
        return `BREAKER PANEL — ${m} FUSE${m === 1 ? '' : 'S'} MISSING`;
      },
      action: () => this.insertFuse(),
    });
    this.interactables.push({
      pos: L.secReaderPos, radius: 1.8,
      label: () => (L.secOpening ? null : this.hasKeycard ? '[E] SWIPE KEYCARD' : 'SECURITY — ACCESS DENIED (KEYCARD REQUIRED)'),
      action: () => this.swipeCard(),
    });
    this.interactables.push({
      pos: L.liftPos, radius: 2.0,
      label: () => (this.powerRestored ? null : 'LIFT B — NO POWER'),
      action: () => { this.audio.click(0.4); this.rig.shake = 0.2; },
    });
  }

  take(obj: THREE.Object3D, kind: 'fuse' | 'battery' | 'keycard') {
    if (!obj.visible) return;
    obj.visible = false;
    this.audio.pickup();
    if (kind === 'battery') {
      this.battery = Math.min(100, this.battery + 40);
      this.hud.message('BATTERIES — FLASHLIGHT +40%');
      return;
    }
    if (kind === 'keycard') {
      this.hasKeycard = true;
      this.hud.message('KEYCARD — SECURITY / TANAKA K.');
      this.updateObjective();
      // the trip back up is meant to hurt
      if (this.entity.active) { this.level.powerTarget = 0; this.blackoutLeft = 2.0; this.audio.distantBang(); }
      return;
    }
    this.fusesHeld++; this.fusesFound++;
    this.hud.message(`FUSE ACQUIRED (${this.fusesFound}/3)`);
    this.updateObjective();
    if (!this.entity.active) {
      // the first fuse wakes it up
      setTimeout(() => {
        if (this.state !== 'play') return;
        this.spawnEntityFar(14);
        this.level.powerTarget = 0; this.blackoutLeft = 1.2;
        this.audio.distantBang();
        this.hud.message('...did you hear that?', 3.5);
      }, 1500);
    }
    this.entity.speed = 1.25 + this.fusesFound * 0.4;
  }

  swipeCard() {
    const L = this.level;
    if (L.secOpening) return;
    if (!this.hasKeycard) { this.audio.click(0.35); setTimeout(() => this.audio.click(0.35), 120); return; }
    this.audio.click(1.4); this.audio.pickup();
    L.secLed.color.setRGB(0.1, 3, 0.3);
    L.secOpening = true;
    setPortal('SEC', true);
    this.hud.message('ACCESS GRANTED', 2);
    this.updateObjective();
  }

  useVending() {
    this.audio.clunk();
    this.vendingUses++;
    const tray = this.level.vendingTray;
    let obj: THREE.Object3D;
    if (this.vendingUses === 1) {
      obj = this.level.makeBattery(tray.x, tray.y, tray.z);
      this.level.addPickup('battery', obj);
      this.addPickupInteractable(obj, 'battery');
      setTimeout(() => this.hud.message('That was not a drink.', 3), 1100);
    } else {
      obj = this.level.can(tray.x, tray.y - 0.03, tray.z, true, [0xb3261e, 0x1f4fb0, 0xd8c12a][this.vendingUses % 3]);
      setTimeout(() => this.hud.message(this.vendingUses === 2 ? 'Ice cold. The machine is still humming.' : 'Another one rolls out.', 3), 1100);
    }
    obj.visible = false;
    setTimeout(() => { obj.visible = true; this.rolling.push({ obj, vel: new THREE.Vector3(-0.9, 0, (Math.random() - 0.5) * 0.3), t: 0 }); }, 900);
  }

  insertFuse() {
    if (this.powerRestored || this.fusesHeld <= 0) { this.audio.click(0.5); return; }
    this.fusesHeld--; this.fusesInstalled++;
    const slot = this.level.fuseSlots[this.fusesInstalled - 1];
    (slot.material as THREE.MeshBasicMaterial).color.setRGB(0.1, 2.2, 0.4);
    this.audio.click(1); this.audio.click(0.7);
    this.rig.shake = 0.25;
    this.updateObjective();
    if (this.fusesInstalled >= 3) this.restorePower();
    else { this.level.powerTarget = 0; this.blackoutLeft = 0.7; this.audio.distantBang(); }
  }

  restorePower() {
    const L = this.level;
    this.powerRestored = true;
    L.powerTarget = 0; this.blackoutLeft = 1.6;
    this.audio.powerUp();
    this.hud.message('POWER RESTORED — LIFT B IS OPEN (JUNCTION)', 4.5);
    setTimeout(() => { L.liftOpening = true; this.audio.gateCreak(); }, 1800);
    L.liftLed.color.setRGB(0.1, 3, 0.3);
    L.liftLight.intensity = 9;
    this.entity.speed = 2.9;
    // it appears behind you
    setTimeout(() => {
      const p = this.rig.pos;
      this.entity.spawnAt(0.3, Math.min(-1.5, p.z + 9));
      this.audio.stinger(0.7);
    }, 1800);
    this.updateObjective();
  }

  updateObjective() {
    let main: string;
    if (this.powerRestored) main = 'OBJECTIVE: REACH LIFT B — JUNCTION, END OF CORRIDOR A';
    else if (this.fusesHeld > 0) main = `OBJECTIVE: INSERT FUSES AT THE BREAKER IN CORRIDOR A (${this.fusesInstalled}/3)`;
    else if (this.fusesFound >= 2 && !this.hasKeycard && !this.level.secOpening) main = 'OBJECTIVE: LAST FUSE IS IN SECURITY — FIND THE KEYCARD';
    else main = `OBJECTIVE: FIND SPARE FUSES (${this.fusesFound}/3) — RESTORE THE BREAKER`;
    const inv = `FUSES ×${this.fusesHeld} · INSTALLED ${this.fusesInstalled}/3 · KEYCARD ${this.hasKeycard ? '✓' : '—'}`;
    this.hud.setObjective(`${main}\n${inv}`);
  }

  // ------------------------------------------------------------------ input
  onKey(e: KeyboardEvent) {
    if (this.state === 'play') {
      if (e.code === 'KeyE') {
        if (this.hud.noteOpen) { this.hud.showNote(null); return; }
        if (this.current) this.current.action();
      } else if (e.code === 'KeyF') {
        if (this.battery <= 0) { this.hud.message('BATTERY DEPLETED', 2); return; }
        this.flashOn = !this.flashOn; this.audio.click(this.flashOn ? 1.2 : 0.8);
      } else if (e.code === 'Escape') {
        this.hud.showNote(null);
      }
    }
    if (e.code === 'KeyC' && (this.state === 'play' || this.state === 'tour')) this.toggleTour();
  }

  toggleTour() {
    if (this.state === 'tour') {
      this.state = 'play';
      this.rig.override = null;
      this.rig.enabled = true;
      this.rig.ground = groundY(this.rig.pos.x, this.rig.pos.z);
      if (this.entity.active) this.entity.group.visible = true;
      this.hud.message('MANUAL CONTROL', 1.5);
    } else {
      this.state = 'tour';
      this.rig.enabled = false;
      this.entity.group.visible = false;
      this.tourIdx = 0; this.tourT = 0;
      this.tourFrom = { pos: this.rig.camera.position.clone(), yaw: this.rig.yaw, pitch: this.rig.pitch };
      this.hud.message('AUTO PATROL — PRESS C TO TAKE CONTROL', 2.5);
    }
  }

  /** Freeze the camera at a reference shot (used for ?shot=N screenshots). */
  freezeShot(i: number) {
    this.frozenShot = i;
    const s = SHOTS[i];
    this.rig.override = { pos: new THREE.Vector3(...s.pos), yaw: s.yaw, pitch: s.pitch };
    this.rig.pos.set(s.pos[0], 0, s.pos[2]);
    this.hud.setCamLabel(s.label);
  }

  // ------------------------------------------------------------------ main update
  update(dt: number, t: number) {
    const L = this.level;
    if (this.state === 'tour') this.updateTour(dt);
    if (this.frozenShot >= 0) this.freezeShot(this.frozenShot);

    // blackouts
    if (this.blackoutLeft > 0) {
      this.blackoutLeft -= dt;
      if (this.blackoutLeft <= 0) L.powerTarget = 1;
    } else if (this.entity.active && this.state === 'play') {
      this.blackoutTimer -= dt;
      if (this.blackoutTimer <= 0) {
        this.blackoutTimer = (this.powerRestored ? 10 : 22) + Math.random() * 20;
        L.powerTarget = 0.0; this.blackoutLeft = 0.9 + Math.random() * 1.3;
        if (Math.random() < 0.5) this.audio.distantBang();
      }
    }

    // zone mood: camera label, fog, rain level, checkpoint
    const zone = zoneOf(this.rig.pos.x, this.rig.pos.z);
    if (this.state !== 'tour' && this.frozenShot < 0 && zone.id !== this.lastZone) {
      this.lastZone = zone.id;
      this.hud.setCamLabel(`CAM 02 / ${zone.label}`);
      if (['B', 'LOCK', 'SEC', 'STOR', 'STAIR', 'BOIL'].includes(zone.id)) this.checkpoint = { x: 0.6, z: -40.5, yaw: -Math.PI / 2 };
    }
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density += ((FOG[zone.id] ?? 0.035) - fog.density) * Math.min(1, dt * 1.5);
    this.exposureGain += ((GAIN[zone.id] ?? 1) - this.exposureGain) * Math.min(1, dt * 0.8);
    postUniforms.grain.value = 0.075 * (0.6 + this.exposureGain * 0.4);
    const nearWindow = zone.id === 'A' ? 0.05 + Math.max(0, (-this.rig.pos.x + 0.5) / 2.7) * 0.08 : ['R1', 'R2', 'J'].includes(zone.id) ? 0.02 : 0.003;
    this.audio.rainLevel = nearWindow;

    // flashlight follows the chest with lag
    const cam = this.rig.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.flashDir.lerp(fwd, 1 - Math.exp(-dt * 8)).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    this.flashlight.position.copy(cam.position).addScaledVector(right, 0.12).add(new THREE.Vector3(0, -0.18, 0));
    this.flashlight.target.position.copy(this.flashlight.position).addScaledVector(this.flashDir, 5);
    if (this.flashOn) { this.battery = Math.max(0, this.battery - dt * 0.3); if (this.battery <= 0) this.flashOn = false; }
    const flick = this.battery < 15 && Math.random() < 0.08 ? 0.3 : 1;
    this.flashlight.intensity = this.flashOn ? 38 * flick : 0;

    // rolling items from the vending machine
    for (const r of this.rolling) {
      if (r.t > 1.2) continue;
      r.t += dt;
      r.obj.position.addScaledVector(r.vel, dt);
      r.vel.multiplyScalar(Math.exp(-dt * 2));
    }

    if (this.state === 'play') this.updatePlay(dt);
    if (this.state === 'dying') this.updateDying(dt);
    if (this.state === 'ending') this.updateEnding(dt);
    void t;
  }

  private canSee(pt: THREE.Vector3) {
    const cam = this.rig.camera;
    const v = pt.clone().project(cam);
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.08 || Math.abs(v.y) > 1.08) return false;
    return this.lineOfSight(cam.position.x, cam.position.z, pt.x, pt.z);
  }

  private lineOfSight(ax: number, az: number, bx: number, bz: number) {
    const boxes: AABB[] = [...this.level.wallColliders, ...this.level.occluders];
    const dx = bx - ax, dz = bz - az;
    for (const b of boxes) {
      if (b.tag === 'gate' || b.enabled === false) continue;
      let t0 = 0, t1 = 1;
      const clip = (p: number, q: number) => {
        if (Math.abs(p) < 1e-9) return q >= 0;
        const r = q / p;
        if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
        else { if (r < t0) return false; if (r < t1) t1 = r; }
        return true;
      };
      if (clip(-dx, ax - b.x0) && clip(dx, b.x1 - ax) && clip(-dz, az - b.z0) && clip(dz, b.z1 - az) && t0 < t1) return false;
    }
    return true;
  }

  private hiddenPoint(x: number, z: number) {
    const y = groundY(x, z);
    return !this.canSee(new THREE.Vector3(x, y + 1.6, z)) && !this.canSee(new THREE.Vector3(x, y + 0.4, z));
  }

  private spawnEntityFar(minDist: number) {
    const p = this.rig.pos;
    const ok = candidatePoints().filter((c) => (c.zone !== 'SEC' || this.level.secOpening) && Math.hypot(c.x - p.x, c.z - p.z) > minDist && this.hiddenPoint(c.x, c.z));
    const near = ok.filter((c) => Math.hypot(c.x - p.x, c.z - p.z) < minDist + 14);
    const pool = near.length ? near : ok;
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : { x: 0, z: -34 };
    this.entity.spawnAt(pick.x, pick.z);
  }

  private updatePlay(dt: number) {
    const L = this.level, E = this.entity, rig = this.rig;
    // interaction target
    let best: Interactable | null = null, bestScore = Infinity;
    const cam = rig.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    for (const it of this.interactables) {
      if (it.obj) { if (!it.obj.visible) continue; it.pos.copy(this.centerOf(it.obj)); }
      const d = it.pos.distanceTo(cam.position);
      if (d > it.radius) continue;
      if (!it.label()) continue;
      const dir = it.pos.clone().sub(cam.position).normalize();
      const dot = dir.dot(fwd);
      if (dot < 0.55) continue;
      const score = d * (1.6 - dot);
      if (score < bestScore) { bestScore = score; best = it; }
    }
    this.current = best;
    this.hud.setPrompt(this.hud.noteOpen ? null : best ? best.label() : null);

    // the visitor
    if (E.active) {
      const gy = E.pos.y;
      const head = E.pos.clone().setY(gy + 2.0), chest = E.pos.clone().setY(gy + 1.2), feet = E.pos.clone().setY(gy + 0.4);
      const inView = this.canSee(head) || this.canSee(chest) || this.canSee(feet);
      const dist = E.distanceTo(rig.pos) + Math.abs(gy - rig.ground) * 0.5;
      let lit = false;
      if (this.flashOn && dist < 16) {
        const toE = chest.clone().sub(this.flashlight.position).normalize();
        lit = toE.dot(this.flashDir) > Math.cos(0.42) && inView;
      }
      const dark = L.power < 0.35;
      const seen = inView && (!dark || lit);
      E.update(dt, rig.pos, !seen, L.wallColliders);

      if (inView && !this.seenPrev && this.stingerCd <= 0 && dist < 22) {
        this.audio.stinger(dist < 8 ? 0.7 : 0.4);
        this.stingerCd = 9;
        rig.shake = Math.max(rig.shake, dist < 8 ? 0.6 : 0.2);
      }
      this.seenPrev = inView;
      this.stingerCd -= dt;

      // relocate behind the player if it has been lost for too long
      this.teleportCd -= dt;
      if (!inView && E.unseenTime > 9 && dist > 13 && this.teleportCd <= 0) {
        this.teleportCd = 12;
        const back = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw));
        const opts = candidatePoints().filter((c) => {
          if (c.zone === 'SEC' && !L.secOpening) return false;
          const dx = c.x - rig.pos.x, dz = c.z - rig.pos.z, d = Math.hypot(dx, dz);
          return d > 7 && d < 12 && (dx * back.x + dz * back.z) / d > 0.3 && this.hiddenPoint(c.x, c.z);
        });
        if (opts.length) { const o = opts[Math.floor(Math.random() * opts.length)]; E.pos.set(o.x, groundY(o.x, o.z), o.z); }
      }

      const presence = THREE.MathUtils.clamp(1 - (dist - 1) / 9, 0, 1);
      this.audio.presence = presence;
      postUniforms.glitch.value = presence * presence * 0.5 + (inView && dist < 5 ? 0.25 : 0) + (dark ? 0.15 : 0);
      postUniforms.staticAmt.value = Math.pow(presence, 4) * 0.12;
      postUniforms.redTint.value = Math.pow(presence, 2) * 0.35;
      E.eyeMat.color.setScalar(dark ? 3 : 1.4);

      if (dist < 0.85) this.die();
    } else {
      this.audio.presence = 0;
      postUniforms.glitch.value = L.power < 0.35 ? 0.15 : 0;
      postUniforms.staticAmt.value = 0; postUniforms.redTint.value = 0;
    }

    // ending: walk into the lift car
    if (this.powerRestored && L.liftOpen > 0.7 && rig.pos.z < -45.3 && rig.pos.x > -1.6 && rig.pos.x < 0.4) this.startEnding();

    // pointer lock lost -> pause
    this.lockGrace -= dt;
    if (!rig.locked && !this.hud.noteOpen && this.frozenShot < 0 && this.lockGrace <= 0) this.pause();
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.showOverlay('<h1>PAUSED</h1><p>CLICK TO RESUME</p>');
  }

  /** Ask for pointer lock; the game only resumes once the browser actually grants it. */
  resume() {
    if (this.state !== 'paused') return;
    this.showOverlay('<h1>PAUSED</h1><p>RESUMING…</p>');
    this.rig.lock();
  }

  onLockChange(locked: boolean) {
    if (locked && this.state === 'paused') {
      this.state = 'play';
      this.hideOverlay();
      this.lockGrace = 0.5;
    }
  }

  onLockError() {
    if (this.state === 'paused') this.showOverlay('<h1>PAUSED</h1><p>CLICK TO RESUME</p><p class="small">浏览器需要约 1 秒冷却，请稍后再点击</p>');
  }

  die() {
    this.state = 'dying';
    this.dyingT = 0;
    this.rig.enabled = false;
    this.audio.scream();
    this.rig.shake = 2;
    const cam = this.rig.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).normalize();
    this.entity.pos.set(cam.position.x + fwd.x * 0.55, this.rig.ground + EYE - 2.01, cam.position.z + fwd.z * 0.55);
    this.entity.group.position.copy(this.entity.pos);
    this.entity.group.visible = true;
    this.entity.eyeMat.color.setScalar(6);
  }

  private updateDying(dt: number) {
    this.dyingT += dt;
    const t = this.dyingT;
    const cam = this.rig.camera;
    this.entity.group.lookAt(cam.position.x, this.entity.group.position.y, cam.position.z);
    this.entity.group.rotateY(Math.PI);
    postUniforms.glitch.value = 1;
    postUniforms.staticAmt.value = Math.min(1, t * 0.7);
    postUniforms.redTint.value = 0.6;
    if (t > 1.4) {
      postUniforms.blackout.value = 1;
      if (this.state === 'dying') {
        this.state = 'dead';
        document.exitPointerLock?.();
        this.audio.presence = 0;
        this.showOverlay(`<h1 class="glitch">SIGNAL LOST</h1><p>UNIT 4417 — NO RESPONSE</p><p class="small">CLICK TO REWIND TAPE</p>`);
      }
    }
  }

  respawn() {
    postUniforms.blackout.value = 0; postUniforms.glitch.value = 0; postUniforms.staticAmt.value = 0; postUniforms.redTint.value = 0;
    this.entity.group.rotation.set(0, 0, 0);
    const cp = this.checkpoint;
    this.rig.reset(cp.x, cp.z, cp.yaw);
    this.rig.enabled = true;
    this.battery = Math.max(this.battery, 40);
    this.level.powerTarget = 1; this.blackoutLeft = 0; this.blackoutTimer = 25;
    if (this.fusesFound > 0) {
      this.entity.hide();
      setTimeout(() => { if (this.state === 'play') this.spawnEntityFar(16); }, 6000);
    }
    this.state = 'play';
    this.hideOverlay();
    this.hud.message('TAPE REWOUND', 2);
    this.lockGrace = 1.5;
    this.rig.lock();
  }

  startEnding() {
    this.state = 'ending';
    this.endingT = 0;
    this.rig.enabled = false;
    this.entity.hide();
    this.audio.presence = 0;
  }

  private updateEnding(dt: number) {
    this.endingT += dt;
    const t = this.endingT;
    postUniforms.glitch.value = Math.min(1, t * 0.4);
    postUniforms.staticAmt.value = Math.max(0, (t - 2) * 0.4);
    if (t > 4 && this.overlay.style.display !== 'flex') {
      postUniforms.blackout.value = 1;
      document.exitPointerLock?.();
      this.showOverlay(`<h1>END OF RECORDING</h1><p>CAM 02 / LIFT B — 03:${String(10 + Math.floor(performance.now() / 1000) % 49).padStart(2, '0')}</p>
        <p class="small">UNIT 4417 ENTERED LIFT B.<br>LIFT B HAS NOT BEEN IN SERVICE SINCE 2019.<br>TANAKA K. — STILL MISSING.</p><p class="small">CLICK TO PLAY AGAIN</p>`);
    }
  }

  private updateTour(dt: number) {
    const shot = SHOTS[this.tourIdx];
    const from = this.tourFrom!;
    this.tourT += dt;
    const to = new THREE.Vector3(...shot.pos);
    const cut = from.pos.distanceTo(to) > 14; // hard cut between distant areas
    const moveT = cut ? 0.01 : 3.2, holdT = 3.0;
    const k = Math.min(1, this.tourT / moveT);
    const e = k * k * (3 - 2 * k);
    const pos = from.pos.clone().lerp(to, e);
    pos.y += Math.sin(this.tourT * 7) * 0.012 * (1 - Math.abs(2 * e - 1));
    let dy = shot.yaw - from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.rig.override = { pos, yaw: from.yaw + dy * e, pitch: from.pitch + (shot.pitch - from.pitch) * e };
    if (cut && this.tourT < 0.25) postUniforms.staticAmt.value = 0.6; else if (this.state === 'tour') postUniforms.staticAmt.value = 0;
    if (k >= 1) this.hud.setCamLabel(shot.label);
    if (this.tourT > moveT + holdT) {
      this.tourFrom = { pos: to, yaw: shot.yaw, pitch: shot.pitch };
      this.tourIdx = (this.tourIdx + 1) % SHOTS.length;
      this.tourT = 0;
      this.rig.yaw = this.rig.targetYaw = shot.yaw; this.rig.pitch = this.rig.targetPitch = shot.pitch;
      this.rig.pos.set(to.x, 0, to.z);
    }
  }

  showOverlay(html: string) { this.overlay.innerHTML = html; this.overlay.style.display = 'flex'; }
  hideOverlay() { this.overlay.style.display = 'none'; }
}
