// Live CCTV feeds for the security office monitors. Each screen shows a low-res, low-fps render
// from a fixed camera elsewhere in the building — only rendered while the player is nearby.
import * as THREE from 'three/webgpu';
import { texture, uv, vec3, float, sin, time, hash, floor, screenUV, mix } from 'three/tsl';

const FEEDS: { label: string; pos: [number, number, number]; look: [number, number, number] }[] = [
  { label: 'CAM 01  CORRIDOR A', pos: [1.8, 3.3, -0.2], look: [-0.5, 0.5, -20] },
  { label: 'CAM 03  JUNCTION', pos: [2.0, 3.2, -36.6], look: [-0.8, 0.4, -43] },
  { label: 'CAM 04  CORRIDOR B', pos: [3.0, 3.2, -39.0], look: [20, 0.5, -41] },
  { label: 'CAM 05  LOCKERS', pos: [15.6, 3.2, -43.2], look: [9, 0.3, -48] },
  { label: 'CAM 06  STAIRS B2', pos: [35.6, 3.3, -39], look: [44, -3.2, -41.5] },
  { label: 'CAM 07  BOILER', pos: [44.6, -0.5, -47.5], look: [52, -3.2, -36] },
];

export class Cctv {
  private targets: THREE.RenderTarget[] = [];
  private cams: THREE.PerspectiveCamera[] = [];
  private acc = 0;
  private next = 0;
  private screens: THREE.Mesh[];
  active = false;

  constructor(screens: THREE.Mesh[]) {
    this.screens = screens;
    screens.forEach((scr, i) => {
      const f = FEEDS[i % FEEDS.length];
      const rt = new THREE.RenderTarget(256, 192);
      const cam = new THREE.PerspectiveCamera(78, 4 / 3, 0.1, 80);
      cam.position.set(...f.pos); cam.lookAt(...f.look);
      this.targets.push(rt); this.cams.push(cam);
      const m = new THREE.MeshBasicNodeMaterial();
      const img = texture(rt.texture, uv());
      const lum = img.r.mul(0.3).add(img.g.mul(0.59)).add(img.b.mul(0.11));
      const scan = sin(uv().y.mul(420).add(time.mul(6))).mul(0.08).add(0.92);
      const noise = hash(floor(uv().x.mul(256)).add(floor(uv().y.mul(192)).mul(313)).add(floor(time.mul(24)).mul(7.7))).mul(0.045);
      const roll = float(1).sub(sin(uv().y.mul(3).sub(time.mul(0.8))).mul(0.06));
      m.colorNode = mix(vec3(lum), img.rgb, 0.25).mul(vec3(0.85, 1.15, 0.9)).mul(scan).mul(roll).add(noise).mul(2.2);
      scr.material = m;
      // label strip
      const c = document.createElement('canvas'); c.width = 256; c.height = 24;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 256, 24);
      ctx.fillStyle = '#e8ffe8'; ctx.font = '700 14px monospace'; ctx.fillText(f.label, 6, 17);
      ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(244, 12, 5, 0, 7); ctx.fill();
      const lt = new THREE.CanvasTexture(c); lt.colorSpace = THREE.SRGBColorSpace;
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.047), new THREE.MeshBasicMaterial({ map: lt, transparent: true, color: new THREE.Color(1.5, 1.5, 1.5) }));
      lab.position.set(0, 0.16, 0.002); scr.add(lab);
    });
    void screenUV;
  }

  /** Render one feed per tick (round-robin) while the player is near the office. */
  update(dt: number, renderer: THREE.WebGPURenderer, scene: THREE.Scene, playerPos: THREE.Vector3) {
    this.active = playerPos.x > 12 && playerPos.x < 22 && playerPos.z > -43 && playerPos.z < -31;
    if (!this.active || !this.cams.length) return;
    this.acc += dt;
    if (this.acc < 0.09) return;
    this.acc = 0;
    const i = this.next; this.next = (this.next + 1) % this.cams.length;
    const prev = renderer.getRenderTarget();
    for (const s of this.screens) s.visible = false; // avoid sampling a texture while drawing into it
    renderer.setRenderTarget(this.targets[i]);
    renderer.render(scene, this.cams[i]);
    renderer.setRenderTarget(prev);
    for (const s of this.screens) s.visible = true;
  }
}
