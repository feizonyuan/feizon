// "The Visitor": a tall, thin silhouette that only moves while it is not being watched.
import * as THREE from 'three/webgpu';
import type { AABB } from './corridorBuilder';
import { slideMove } from './bodycamRig';

type Zone = 'corridor' | 'room1' | 'room2' | 'cage';
export function zoneOf(x: number, z: number): Zone {
  if (z < -36.15) return 'cage';
  if (x > 2.4) return z > -16 ? 'room1' : 'room2';
  return 'corridor';
}
const DOORS: Record<'room1' | 'room2', number> = { room1: -7.2, room2: -24 };

export class Entity {
  group = new THREE.Group();
  pos = new THREE.Vector3(0, 0, -34);
  active = false;
  speed = 1.6;
  seenTime = 0;
  unseenTime = 0;
  private head: THREE.Object3D;
  private armL: THREE.Object3D;
  private armR: THREE.Object3D;
  private twitchT = 0;
  eyeMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    const skin = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.96, metalness: 0 });
    const cap = (r: number, len: number) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), skin);
    const g = this.group;
    // legs
    for (const s of [-1, 1]) {
      const leg = cap(0.045, 1.0); leg.position.set(s * 0.09, 0.55, 0); leg.rotation.z = s * 0.03; g.add(leg);
    }
    // torso (narrow, slightly hunched)
    const torso = cap(0.12, 0.62); torso.scale.set(1, 1, 0.6); torso.position.set(0, 1.42, 0.02); torso.rotation.x = 0.12; g.add(torso);
    const shoulders = cap(0.06, 0.34); shoulders.rotation.z = Math.PI / 2; shoulders.position.set(0, 1.8, 0.05); g.add(shoulders);
    // arms: too long, reaching past the knees
    const mkArm = (s: number) => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.22, 1.8, 0.05);
      const upper = cap(0.035, 0.55); upper.position.y = -0.32; pivot.add(upper);
      const lower = cap(0.03, 0.55); lower.position.y = -0.9; pivot.add(lower);
      for (let f = 0; f < 3; f++) { const fi = cap(0.008, 0.16); fi.position.set((f - 1) * 0.02, -1.28, 0); fi.rotation.z = (f - 1) * 0.15; pivot.add(fi); }
      pivot.rotation.z = s * 0.06;
      g.add(pivot);
      return pivot;
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    // neck + head
    const neck = cap(0.03, 0.14); neck.position.set(0, 1.93, 0.04); g.add(neck);
    const head = new THREE.Group(); head.position.set(0, 2.06, 0.05);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin); skull.scale.set(0.85, 1.3, 0.9); head.add(skull);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.3) });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4), this.eyeMat); e.position.set(s * 0.035, 0.02, -0.088); head.add(e); }
    g.add(head);
    this.head = head;
    g.visible = false;
    scene.add(g);
  }

  spawnAt(x: number, z: number) {
    this.pos.set(x, 0, z);
    this.active = true;
    this.group.visible = true;
    this.seenTime = 0; this.unseenTime = 0;
  }

  hide() { this.active = false; this.group.visible = false; }

  /** Pick the next waypoint toward the player through door gaps. */
  private waypoint(px: number, pz: number) {
    const ez = zoneOf(this.pos.x, this.pos.z), pzone = zoneOf(px, pz);
    if (ez === pzone) return new THREE.Vector2(px, pz);
    const ex = this.pos.x, ezz = this.pos.z;
    if (ez === 'room1' || ez === 'room2') {
      const dz = DOORS[ez];
      if (Math.abs(ezz - dz) > 0.5 && ex > 2.9) return new THREE.Vector2(3.2, dz);
      return new THREE.Vector2(1.2, dz);
    }
    if (ez === 'cage') return new THREE.Vector2(0, -35);
    // in corridor, heading somewhere else
    if (pzone === 'room1' || pzone === 'room2') {
      const dz = DOORS[pzone];
      if (Math.abs(ezz - dz) > 0.5 && ex < 1.8) return new THREE.Vector2(1.4, dz);
      return new THREE.Vector2(3.6, dz);
    }
    if (pzone === 'cage') return new THREE.Vector2(0, -37.5);
    return new THREE.Vector2(px, pz);
  }

  /**
   * @param canMove true when the thing is unobserved (or lights are out)
   */
  update(dt: number, player: THREE.Vector3, canMove: boolean, walls: AABB[]) {
    if (!this.active) return;
    if (canMove) {
      this.unseenTime += dt; this.seenTime = 0;
      const wp = this.waypoint(player.x, player.z);
      const dx = wp.x - this.pos.x, dz = wp.y - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const step = Math.min(d, this.speed * dt);
        slideMove(this.pos, (dx / d) * step, (dz / d) * step, 0.25, walls);
      }
    } else {
      this.seenTime += dt; this.unseenTime = 0;
    }
    this.group.position.copy(this.pos);
    // always faces the camera
    const ang = Math.atan2(player.x - this.pos.x, player.z - this.pos.z);
    this.group.rotation.y = ang + Math.PI;
    // unsettling micro twitches
    this.twitchT -= dt;
    if (this.twitchT <= 0) {
      this.twitchT = 0.15 + Math.random() * (canMove ? 0.3 : 1.6);
      this.head.rotation.z = (Math.random() - 0.5) * (Math.random() < 0.2 ? 1.4 : 0.3);
      this.head.rotation.x = (Math.random() - 0.5) * 0.4;
      this.armL.rotation.x = (Math.random() - 0.5) * 0.2;
      this.armR.rotation.x = (Math.random() - 0.5) * 0.2;
    }
  }

  distanceTo(p: THREE.Vector3) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }
}
