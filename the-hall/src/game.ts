// Game rules: objectives, interactions, the stalker, scares, death/ending, demo tour.
import * as THREE from 'three/webgpu';
import { Level, type AABB } from './corridorBuilder';
import { BodycamRig, EYE } from './bodycamRig';
import { Entity, zoneOf } from './entity';
import { AudioSystem } from './audioSystem';
import { Hud } from './hud';
import { postUniforms } from './postProcessing';

type State = 'title' | 'play' | 'paused' | 'dying' | 'dead' | 'ending' | 'tour';

interface Interactable {
  pos: THREE.Vector3;
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
];

export class Game {
  state: State = 'title';
  fusesHeld = 0;
  fusesFound = 0;
  fusesInstalled = 0;
  vendingGaveFuse = false;
  vendingUses = 0;
  powerRestored = false;
  battery = 92;
  flashOn = false;
  flashlight: THREE.SpotLight;
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
  private gateOpenT = -1;
  private tourIdx = 0;
  private tourT = 0;
  private tourFrom: { pos: THREE.Vector3; yaw: number; pitch: number } | null = null;
  private rolling: { obj: THREE.Object3D; vel: THREE.Vector3; t: number }[] = [];
  private wetData: ImageData | null = null;
  private frozenShot = -1;
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
    this.hud.setObjective('OBJECTIVE: FIND SPARE FUSES (0/3) — RESTORE THE BREAKER');
  }

  isWet(x: number, z: number) {
    if (!this.wetData) return false;
    const u = (x + 2.6) / 11.2, v = (0.8 - z) / 43.4;
    const px = Math.floor(u * this.wetData.width), py = Math.floor(v * this.wetData.height);
    if (px < 0 || py < 0 || px >= this.wetData.width || py >= this.wetData.height) return false;
    return this.wetData.data[(py * this.wetData.width + px) * 4] / 255 > 0.56;
  }

  // ------------------------------------------------------------------ interactions
  buildInteractables() {
    const L = this.level;
    L.fuses.forEach((f) => {
      this.interactables.push({
        pos: f.position, radius: 1.6,
        label: () => (f.visible ? '[E] PICK UP FUSE' : null),
        action: () => this.takeFuse(f),
      });
    });
    L.notes.forEach((n) => {
      this.interactables.push({ pos: n.mesh.position, radius: 1.5, label: () => '[E] READ NOTE', action: () => { this.hud.showNote(n.lines); this.audio.click(0.6); } });
    });
    this.interactables.push({
      pos: L.vendingPos, radius: 2.2,
      label: () => '[E] YORU COLA (¥150)',
      action: () => this.useVending(),
    });
    this.interactables.push({
      pos: L.breakerPos, radius: 1.8,
      label: () => {
        if (this.powerRestored) return 'BREAKER — ONLINE';
        if (this.fusesHeld > 0) return `[E] INSERT FUSE (${this.fusesInstalled}/3)`;
        return `BREAKER PANEL — ${3 - this.fusesInstalled} FUSE${3 - this.fusesInstalled === 1 ? '' : 'S'} MISSING`;
      },
      action: () => this.insertFuse(),
    });
    this.interactables.push({
      pos: new THREE.Vector3(0, 1.2, -36), radius: 2.0,
      label: () => (this.powerRestored ? null : 'SERVICE GATE — LOCKED (NO POWER)'),
      action: () => { this.audio.click(0.4); this.rig.shake = 0.3; },
    });
  }

  takeFuse(f: THREE.Object3D) {
    if (!f.visible) return;
    f.visible = false;
    this.fusesHeld++; this.fusesFound++;
    this.audio.pickup();
    this.hud.message(`FUSE ACQUIRED (${this.fusesFound}/3)`);
    this.updateObjective();
    if (!this.entity.active) {
      // first fuse wakes it up
      setTimeout(() => {
        if (this.state !== 'play') return;
        this.spawnEntityFar(14);
        this.level.powerTarget = 0; this.blackoutLeft = 1.2;
        this.audio.distantBang();
        this.hud.message('...did you hear that?', 3.5);
      }, 1500);
    }
    this.entity.speed = 1.25 + this.fusesFound * 0.45;
  }

  useVending() {
    this.audio.clunk();
    this.vendingUses++;
    const tray = this.level.vendingTray;
    let obj: THREE.Object3D;
    if (!this.vendingGaveFuse && this.fusesFound >= 1) {
      this.vendingGaveFuse = true;
      obj = this.level.makeFuse(tray.x, tray.y, tray.z);
      this.level.fuses.push(obj);
      this.interactables.push({ pos: obj.position, radius: 1.6, label: () => (obj.visible ? '[E] PICK UP FUSE' : null), action: () => this.takeFuse(obj) });
      setTimeout(() => this.hud.message('That was not a drink.', 3), 1100);
    } else {
      obj = this.level.can(tray.x, tray.y - 0.03, tray.z, true, [0xb3261e, 0x1f4fb0, 0xd8c12a][this.vendingUses % 3]);
      setTimeout(() => this.hud.message(this.vendingUses === 1 ? 'Ice cold. The machine is still humming.' : 'Another one rolls out.', 3), 1100);
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
    else {
      // every insertion stresses the grid
      this.level.powerTarget = 0; this.blackoutLeft = 0.7;
      this.audio.distantBang();
    }
  }

  restorePower() {
    this.powerRestored = true;
    this.level.powerTarget = 0; this.blackoutLeft = 1.6;
    this.audio.powerUp();
    this.hud.message('POWER RESTORED — SERVICE GATE UNLOCKED', 4);
    this.gateOpenT = 0;
    this.level.gateCollider.enabled = false;
    ((this.level.gate.userData.led as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setRGB(0.1, 3, 0.3);
    this.level.gateLight.intensity = 10;
    this.entity.speed = 2.9;
    // it appears behind you
    setTimeout(() => {
      const p = this.rig.pos;
      const z = Math.min(-1.5, p.z + 9);
      this.entity.spawnAt(0.3, z);
      this.audio.stinger(0.7);
    }, 1800);
    this.updateObjective();
  }

  updateObjective() {
    if (this.powerRestored) this.hud.setObjective('OBJECTIVE: REACH LIFT B — END OF THE HALL');
    else if (this.fusesHeld > 0) this.hud.setObjective(`OBJECTIVE: INSERT FUSES INTO THE BREAKER (${this.fusesInstalled}/3 INSTALLED)`);
    else this.hud.setObjective(`OBJECTIVE: FIND SPARE FUSES (${this.fusesFound}/3) — RESTORE THE BREAKER`);
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
      if (this.entity.active) this.entity.group.visible = true;
      this.hud.setCamLabel('CAM 02 / CORRIDOR A');
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
    this.hud.setCamLabel(s.label);
  }

  // ------------------------------------------------------------------ main update
  update(dt: number, t: number) {
    const L = this.level;
    if (this.state === 'tour') this.updateTour(dt);
    if (this.frozenShot >= 0) this.freezeShot(this.frozenShot);

    // blackout timer
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

    // flashlight follows chest with lag
    const cam = this.rig.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.flashDir.lerp(fwd, 1 - Math.exp(-dt * 8)).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    this.flashlight.position.copy(cam.position).addScaledVector(right, 0.12).add(new THREE.Vector3(0, -0.18, 0));
    this.flashlight.target.position.copy(this.flashlight.position).addScaledVector(this.flashDir, 5);
    if (this.flashOn) { this.battery = Math.max(0, this.battery - dt * 0.25); if (this.battery <= 0) this.flashOn = false; }
    const flick = this.battery < 15 && Math.random() < 0.08 ? 0.3 : 1;
    this.flashlight.intensity = this.flashOn ? 38 * flick : 0;

    // rolling items from the vending machine
    for (const r of this.rolling) {
      if (r.t > 1.2) continue;
      r.t += dt;
      r.obj.position.addScaledVector(r.vel, dt);
      r.obj.position.y = Math.max(0.035, r.obj.position.y - dt * 0.6);
      r.vel.multiplyScalar(Math.exp(-dt * 2));
      r.obj.rotation.x += dt * 6;
    }

    // gate opening
    if (this.gateOpenT >= 0 && this.gateOpenT < 1) {
      if (this.gateOpenT === 0) setTimeout(() => this.audio.gateCreak(), 1700);
      this.gateOpenT = Math.min(1, this.gateOpenT + dt * 0.35);
      const k = Math.max(0, (this.gateOpenT - 0.45) / 0.55);
      L.gate.rotation.y = -(1 - Math.pow(1 - k, 3)) * 1.75;
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
      if (b.tag === 'gate') continue; // chain link is see-through
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

  private spawnEntityFar(minDist: number) {
    const p = this.rig.pos;
    const candidates: [number, number][] = [];
    for (let z = -2; z >= -35; z -= 1.5) candidates.push([(Math.random() - 0.5) * 2, z]);
    candidates.push([6, -9], [5, -26], [7, -7], [6.5, -23]);
    const ok = candidates.filter(([x, z]) => Math.hypot(x - p.x, z - p.z) > minDist && !this.canSee(new THREE.Vector3(x, 1.6, z)));
    const pick = ok.length ? ok[Math.floor(Math.random() * ok.length)] : [0, -34];
    this.entity.spawnAt(pick[0], pick[1]);
  }

  private updatePlay(dt: number) {
    const L = this.level, E = this.entity, rig = this.rig;
    // interaction target
    let best: Interactable | null = null, bestScore = Infinity;
    const cam = rig.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    for (const it of this.interactables) {
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
      const head = E.pos.clone().setY(2.0), chest = E.pos.clone().setY(1.2), feet = E.pos.clone().setY(0.4);
      const inView = this.canSee(head) || this.canSee(chest) || this.canSee(feet);
      const dist = E.distanceTo(rig.pos);
      // flashlight pinning
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
        for (let tries = 0; tries < 8; tries++) {
          const d = 8 + Math.random() * 3;
          const x = THREE.MathUtils.clamp(rig.pos.x + back.x * d, -1.6, 1.6);
          const z = THREE.MathUtils.clamp(rig.pos.z + back.z * d, -35, -1.2);
          if (zoneOf(x, z) === 'corridor' && !this.canSee(new THREE.Vector3(x, 1.6, z)) && Math.hypot(x - rig.pos.x, z - rig.pos.z) > 6) {
            E.pos.set(x, 0, z); break;
          }
        }
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

    // ending
    if (this.powerRestored && rig.pos.z < L.exitZ) this.startEnding();

    // pointer lock lost -> pause
    if (!rig.locked && !this.hud.noteOpen && this.frozenShot < 0) this.pause();
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.showOverlay('<h1>PAUSED</h1><p>CLICK TO RESUME</p>');
  }

  resume() {
    this.state = 'play';
    this.hideOverlay();
    this.rig.lock();
  }

  die() {
    this.state = 'dying';
    this.dyingT = 0;
    this.rig.enabled = false;
    this.audio.scream();
    this.rig.shake = 2;
    // snap it into the lens
    const cam = this.rig.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).normalize();
    this.entity.pos.set(cam.position.x + fwd.x * 0.55, 0, cam.position.z + fwd.z * 0.55);
    this.entity.pos.y = EYE - 2.06 + 0.05;
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
    this.entity.pos.y = 0;
    this.rig.reset(0, -1.5, 0);
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
      this.showOverlay(`<h1>END OF RECORDING</h1><p>CAM 02 / CORRIDOR A — 03:${String(10 + Math.floor(performance.now() / 1000) % 49).padStart(2, '0')}</p>
        <p class="small">UNIT 4417 ENTERED LIFT B.<br>LIFT B HAS NOT BEEN IN SERVICE SINCE 2019.</p><p class="small">CLICK TO PLAY AGAIN</p>`);
    }
  }

  private updateTour(dt: number) {
    const shot = SHOTS[this.tourIdx];
    const from = this.tourFrom!;
    this.tourT += dt;
    const moveT = 3.2, holdT = 3.0;
    const k = Math.min(1, this.tourT / moveT);
    const e = k * k * (3 - 2 * k);
    const to = new THREE.Vector3(...shot.pos);
    const pos = from.pos.clone().lerp(to, e);
    pos.y += Math.sin(this.tourT * 7) * 0.012 * (1 - Math.abs(2 * e - 1));
    let dy = shot.yaw - from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.rig.override = { pos, yaw: from.yaw + dy * e, pitch: from.pitch + (shot.pitch - from.pitch) * e };
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
