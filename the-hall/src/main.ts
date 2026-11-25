import * as THREE from 'three/webgpu';
import { Level, worldUniforms } from './corridorBuilder';
import { buildCity, cityUniforms } from './cityscape';
import { BodycamRig, EYE } from './bodycamRig';
import { createPost, postUniforms } from './postProcessing';
import { AudioSystem } from './audioSystem';
import { Hud } from './hud';
import { Entity } from './entity';
import { Game, SHOTS } from './game';
import { Cctv } from './cctv';

const params = new URLSearchParams(location.search);

async function boot() {
  const app = document.getElementById('app')!;
  const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL: params.has('webgl') });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, params.has('hq') ? 2 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const baseExposure = { value: 1.0 };
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  app.appendChild(renderer.domElement);
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05080c');
  scene.fog = new THREE.FogExp2('#081016', 0.032);

  const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.05, 600);
  camera.position.set(0, EYE, -1.5);

  const level = new Level(scene);
  buildCity(scene);
  level.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const entity = new Entity(scene);
  entity.group.traverse((o) => { o.castShadow = true; });

  const rig = new BodycamRig(camera, renderer.domElement, () => level.colliders);
  const hud = new Hud();
  const audio = new AudioSystem();
  const { pipeline, bloomNode } = createPost(renderer, scene, camera);
  const cctv = new Cctv(level.cctvScreens);
  const game = new Game(level, rig, entity, audio, hud, scene);
  rig.onLockChange = (l) => game.onLockChange(l);
  rig.onLockError = () => game.onLockError();
  (window as any).__game = game;

  // ---------------------------------------------------------- title / overlay clicks
  const title = document.getElementById('title')!;
  const startGame = () => {
    title.style.display = 'none';
    audio.start();
    audio.addHum(level.vendingPos, 60, 'sawtooth', 0.08, 300);
    audio.addHum(level.pumpPos, 33, 'sawtooth', 0.22, 220);
    audio.addHum(level.boilerPos, 27, 'sawtooth', 0.35, 160);
    audio.addHum(new THREE.Vector3(17, 1.2, -32.5), 15734 / 128, 'sine', 0.01, 3000);
    audio.addHum(new THREE.Vector3(5.4, 3, -8), 100, 'square', 0.012, 2500);
    audio.addHum(new THREE.Vector3(5.4, 3, -24), 100, 'square', 0.012, 2500);
    game.state = 'play';
    game.lockGrace = 1.5;
    hud.setVisible(true);
    hud.message('NIGHT PATROL — CORRIDOR A. THE DOOR LOCKED BEHIND YOU.', 5);
    rig.lock();
  };
  title.addEventListener('click', startGame);
  document.getElementById('overlay')!.addEventListener('click', () => {
    if (game.state === 'paused') game.resume();
    else if (game.state === 'dead') game.respawn();
    else if (game.state === 'ending') location.reload();
  });
  renderer.domElement.addEventListener('click', () => { if (game.state === 'play' && !rig.locked) rig.lock(); });

  // ---------------------------------------------------------- screenshot / reference modes
  const shot = params.get('shot');
  if (shot !== null) {
    title.style.display = 'none';
    hud.setVisible(true);
    game.state = 'play';
    level.steadyLights = true;
    game.freezeShot(Math.max(0, Math.min(SHOTS.length - 1, parseInt(shot, 10) || 0)));
    if (params.has('flash')) game.flashOn = true;
    if (params.has('entity')) entity.spawnAt(parseFloat(params.get('ex') ?? '0'), parseFloat(params.get('ez') ?? '-12'));
  }
  if (params.has('debug')) buildDebugPanel(baseExposure, scene, level, bloomNode);

  // ---------------------------------------------------------- resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------------------------------------------------------- loop
  let last = performance.now(), elapsed = 0;
  let fpsAcc = 0, fpsN = 0;
  const fpsEl = document.getElementById('fps');
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now; elapsed += dt;
    const t = elapsed;
    if (game.state !== 'title' && game.state !== 'paused') {
      rig.update(dt);
      game.update(dt, t);
    } else if (game.state === 'title') {
      // slow idle drift on the title screen
      camera.position.set(Math.sin(t * 0.1) * 0.15, EYE, -1.5);
      camera.rotation.set(-0.02, Math.sin(t * 0.13) * 0.12, 0, 'YXZ');
    }
    level.update(dt, t);
    audio.updateListener(camera, dt);
    hud.update(dt, audio.levels(), game.battery, renderer.domElement.height);
    renderer.toneMappingExposure = baseExposure.value * game.exposureGain;
    cctv.update(dt, renderer, scene, rig.pos);
    pipeline.render();
    if (fpsEl) { fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} FPS · ${(renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL2'}`; fpsAcc = 0; fpsN = 0; } }
  });
}

function buildDebugPanel(baseExposure: { value: number }, scene: THREE.Scene, level: Level, bloomNode: any) {
  const panel = document.createElement('div');
  panel.id = 'debug';
  document.body.appendChild(panel);
  const fog = scene.fog as THREE.FogExp2;
  const warm = level.lights.filter((l) => l.light.color.r > l.light.color.b);
  const cool = level.lights.filter((l) => l.light.color.r <= l.light.color.b);
  const warmBase = warm.map((l) => l.base), coolBase = cool.map((l) => l.base);
  const add = (label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void) => {
    const row = document.createElement('label');
    const val = document.createElement('span');
    const input = document.createElement('input');
    input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(get());
    val.textContent = get().toFixed(3);
    input.oninput = () => { set(parseFloat(input.value)); val.textContent = parseFloat(input.value).toFixed(3); };
    row.append(label, input, val);
    panel.appendChild(row);
  };
  add('exposure', 0.3, 2, 0.01, () => baseExposure.value, (v) => (baseExposure.value = v));
  add('fog density', 0, 0.08, 0.001, () => fog.density, (v) => (fog.density = v));
  add('puddle threshold', 0.3, 0.8, 0.005, () => worldUniforms.wetThreshold.value as number, (v) => (worldUniforms.wetThreshold.value = v));
  add('reflection', 0, 2, 0.01, () => worldUniforms.reflectStrength.value as number, (v) => (worldUniforms.reflectStrength.value = v));
  add('ripple', 0, 0.02, 0.0005, () => worldUniforms.rippleAmount.value as number, (v) => (worldUniforms.rippleAmount.value = v));
  add('bloom strength', 0, 2, 0.01, () => bloomNode.strength.value, (v) => (bloomNode.strength.value = v));
  add('bloom threshold', 0, 2, 0.01, () => bloomNode.threshold.value, (v) => (bloomNode.threshold.value = v));
  add('fisheye', 0, 1, 0.01, () => postUniforms.distortion.value as number, (v) => (postUniforms.distortion.value = v));
  add('chromatic', 0, 0.02, 0.0005, () => postUniforms.ca.value as number, (v) => (postUniforms.ca.value = v));
  add('grain', 0, 0.3, 0.005, () => postUniforms.grain.value as number, (v) => (postUniforms.grain.value = v));
  add('vignette', 0, 1, 0.01, () => postUniforms.vignette.value as number, (v) => (postUniforms.vignette.value = v));
  add('city windows', 0, 4, 0.05, () => cityUniforms.windowGain.value as number, (v) => (cityUniforms.windowGain.value = v));
  add('warm lights ×', 0, 3, 0.01, () => 1, (v) => warm.forEach((l, i) => (l.base = warmBase[i] * v)));
  add('cool lights ×', 0, 3, 0.01, () => 1, (v) => cool.forEach((l, i) => (l.base = coolBase[i] * v)));
  const fps = document.createElement('div'); fps.id = 'fps'; panel.appendChild(fps);
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;position:fixed;top:0;left:0;z-index:99">${String(e?.stack ?? e)}</pre>`);
});
