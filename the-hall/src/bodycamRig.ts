// First-person chest-mounted camera: pointer lock look, damped turning, footstep bob, AABB collision.
import * as THREE from 'three/webgpu';
import type { AABB } from './corridorBuilder';

export const EYE = 1.42;
const RADIUS = 0.35;

export class BodycamRig {
  camera: THREE.PerspectiveCamera;
  pos = new THREE.Vector3(0, 0, -1.5);
  vel = new THREE.Vector3();
  yaw = 0; pitch = -0.02;
  targetYaw = 0; targetPitch = -0.02;
  bobPhase = 0;
  bobAmp = 0;
  keys = new Set<string>();
  locked = false;
  enabled = true;
  sensitivity = 0.0022;
  speed = 0;
  sprinting = false;
  onStep: (intensity: number) => void = () => {};
  private lastStepIdx = 0;
  // external camera override (demo tour)
  override: { pos: THREE.Vector3; yaw: number; pitch: number } | null = null;
  shake = 0;

  constructor(camera: THREE.PerspectiveCamera, private dom: HTMLElement, private colliders: () => AABB[]) {
    this.camera = camera;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.targetYaw -= e.movementX * this.sensitivity;
      this.targetPitch -= e.movementY * this.sensitivity;
      this.targetPitch = Math.max(-1.35, Math.min(1.35, this.targetPitch));
    });
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  lock() { this.dom.requestPointerLock?.(); }

  reset(x: number, z: number, yaw: number) {
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0);
    this.yaw = this.targetYaw = yaw; this.pitch = this.targetPitch = -0.02;
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  update(dt: number) {
    // damped look: simulates the weight of a chest rig
    const lk = 1 - Math.exp(-dt * 11);
    this.yaw += (this.targetYaw - this.yaw) * lk;
    this.pitch += (this.targetPitch - this.pitch) * lk;

    let ix = 0, iz = 0;
    if (this.enabled) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
    }
    this.sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const maxSpeed = this.sprinting ? 3.2 : 2.0;
    const len = Math.hypot(ix, iz) || 1;
    ix /= len; iz /= len;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const wx = ix * c + iz * s;
    const wz = -ix * s + iz * c;
    const target = new THREE.Vector3(wx * maxSpeed, 0, wz * maxSpeed);
    const acc = (ix || iz) ? 7 : 9;
    this.vel.lerp(target, 1 - Math.exp(-dt * acc));

    // collide per axis (slide along walls)
    const cols = this.colliders();
    const nx = this.pos.x + this.vel.x * dt;
    if (!this.hits(nx, this.pos.z, cols)) this.pos.x = nx; else this.vel.x = 0;
    const nz = this.pos.z + this.vel.z * dt;
    if (!this.hits(this.pos.x, nz, cols)) this.pos.z = nz; else this.vel.z = 0;

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    const moving = this.speed > 0.15;
    this.bobAmp += ((moving ? Math.min(1, this.speed / 2) : 0) - this.bobAmp) * Math.min(1, dt * 6);
    this.bobPhase += dt * (moving ? 4.0 + this.speed * 1.9 : 0);
    const stepIdx = Math.floor(this.bobPhase / Math.PI);
    if (stepIdx !== this.lastStepIdx) {
      this.lastStepIdx = stepIdx;
      if (moving) this.onStep(Math.min(1, this.speed / 3));
    }

    this.shake *= Math.exp(-dt * 3);
    if (this.override) {
      this.camera.position.copy(this.override.pos);
      this.camera.rotation.set(this.override.pitch, this.override.yaw, 0, 'YXZ');
      return;
    }
    const bobY = -Math.abs(Math.sin(this.bobPhase)) * 0.035 * this.bobAmp;
    const sway = Math.sin(this.bobPhase) * 0.012 * this.bobAmp;
    const roll = Math.sin(this.bobPhase) * 0.8 * (Math.PI / 180) * this.bobAmp;
    const idle = Math.sin(performance.now() * 0.0011) * 0.004;
    const sh = this.shake;
    this.camera.position.set(this.pos.x + Math.cos(this.yaw) * sway + (Math.random() - 0.5) * sh * 0.03, EYE + bobY + idle + (Math.random() - 0.5) * sh * 0.03, this.pos.z - Math.sin(this.yaw) * sway);
    this.camera.rotation.set(this.pitch + (Math.random() - 0.5) * sh * 0.02, this.yaw + (Math.random() - 0.5) * sh * 0.02, roll, 'YXZ');
  }

  hits(x: number, z: number, cols: AABB[]) {
    for (const b of cols) {
      if (b.enabled === false) continue;
      if (x + RADIUS > b.x0 && x - RADIUS < b.x1 && z + RADIUS > b.z0 && z - RADIUS < b.z1) return true;
    }
    return false;
  }
}

/** Shared helper for any agent: slide-move a circle-ish square through AABBs. */
export function slideMove(pos: THREE.Vector3, dx: number, dz: number, r: number, cols: AABB[]) {
  const hit = (x: number, z: number) => cols.some((b) => b.enabled !== false && x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1);
  if (!hit(pos.x + dx, pos.z)) pos.x += dx;
  if (!hit(pos.x, pos.z + dz)) pos.z += dz;
}
