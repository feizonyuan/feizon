// Bodycam optics: bloom -> tonemap -> barrel distortion + chromatic aberration -> vignette -> ISO grain.
// Also carries horror effects: signal glitch, static bursts, blackout.
import * as THREE from 'three/webgpu';
import {
  pass, uniform, Fn, screenUV, vec2, vec3, vec4, float, dot, floor, hash, time, step, mix, smoothstep,
  renderOutput, convertToTexture, screenCoordinate, fract, sin, length, clamp,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export const postUniforms = {
  distortion: uniform(0.32),
  ca: uniform(0.0035),
  vignette: uniform(0.95),
  grain: uniform(0.075),
  glitch: uniform(0),
  staticAmt: uniform(0),
  blackout: uniform(0),
  redTint: uniform(0),
};

export function createPost(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputColorTransform = false;
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const bloomNode = bloom(color, 0.55, 0.45, 0.85);
  const toned = renderOutput(color.add(bloomNode));
  const tex = convertToTexture(toned);
  const U = postUniforms;

  pipeline.outputNode = Fn(() => {
    const suv = screenUV;
    // horizontal tearing (signal glitch)
    const band = floor(suv.y.mul(48));
    const tick = floor(time.mul(24));
    const tear = hash(band.add(tick.mul(7.1))).sub(0.5).mul(step(0.72, hash(band.mul(1.37).add(tick)))).mul(U.glitch).mul(0.09);
    const roll = sin(suv.y.mul(3).add(time.mul(9))).mul(U.glitch).mul(0.004);
    const c = suv.sub(0.5).add(vec2(tear.add(roll), 0));
    const r2 = dot(c, c);
    const f = float(1).add(r2.mul(U.distortion)).div(float(1).add(U.distortion.mul(0.5)));
    const ca = U.ca.add(U.glitch.mul(0.012)).mul(r2).mul(6).add(U.glitch.mul(0.004));
    const uvR = c.mul(f).mul(float(1).add(ca)).add(0.5);
    const uvG = c.mul(f).add(0.5);
    const uvB = c.mul(f).mul(float(1).sub(ca)).add(0.5);
    const col = vec3(tex.sample(uvR).r, tex.sample(uvG).g, tex.sample(uvB).b).toVar();
    // vignette
    const v = smoothstep(float(0.95), float(0.18), length(c.mul(vec2(1.05, 1.25)))).mul(U.vignette).add(float(1).sub(U.vignette));
    col.mulAssign(v);
    // ISO grain, stronger in shadows
    const px = screenCoordinate.xy;
    const n = hash(px.x.add(px.y.mul(1931.7)).add(fract(time.mul(13.37)).mul(7919)));
    const lum = dot(col, vec3(0.299, 0.587, 0.114));
    const g = n.sub(0.5).mul(U.grain).mul(float(1.15).sub(lum.mul(0.7)));
    col.addAssign(vec3(g));
    // faint scanlines
    col.mulAssign(float(0.985).add(sin(px.y.mul(1.7)).mul(0.015)));
    // static burst
    const st = hash(px.x.mul(0.37).add(px.y.mul(113.1)).add(floor(time.mul(60)).mul(3.3)));
    const stLine = step(0.5, fract(suv.y.mul(240).add(time.mul(30)))).mul(0.15);
    col.assign(mix(col, vec3(st.add(stLine).mul(0.85)), U.staticAmt));
    // red danger tint
    col.assign(mix(col, col.mul(vec3(1.35, 0.55, 0.5)), U.redTint));
    // blackout (camera signal loss)
    col.mulAssign(float(1).sub(U.blackout));
    return vec4(clamp(col, 0, 1), 1);
  })();

  void THREE; void fract;
  return { pipeline, bloomNode };
}
