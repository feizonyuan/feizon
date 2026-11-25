// Fully synthesized audio with Web Audio: room tone, rain, hums, footsteps, stingers, L/R meters.
import * as THREE from 'three/webgpu';

export class AudioSystem {
  ctx!: AudioContext;
  master!: GainNode;
  reverb!: ConvolverNode;
  reverbSend!: GainNode;
  analyserL!: AnalyserNode;
  analyserR!: AnalyserNode;
  started = false;
  private noiseBuf!: AudioBuffer;
  private bufL = new Float32Array(1024);
  private bufR = new Float32Array(1024);
  heartbeatGain!: GainNode;
  staticGain!: GainNode;
  droneGain!: GainNode;
  rainGain!: GainNode;
  private hbTimer = 0;
  presence = 0; // 0..1 entity proximity
  rainLevel = 0.06;
  private positional: { panner: PannerNode; gain: GainNode }[] = [];

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp);
    // meters
    const split = ctx.createChannelSplitter(2);
    this.analyserL = ctx.createAnalyser(); this.analyserR = ctx.createAnalyser();
    this.analyserL.fftSize = this.analyserR.fftSize = 1024;
    comp.connect(split); split.connect(this.analyserL, 0); split.connect(this.analyserR, 1);
    comp.connect(ctx.destination);

    // noise buffer
    const len = ctx.sampleRate * 3;
    this.noiseBuf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = this.noiseBuf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }

    // concrete hall reverb impulse
    const irLen = ctx.sampleRate * 2.4;
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2) * (i < 900 ? i / 900 : 1);
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.45;
    this.reverbSend.connect(this.reverb); this.reverb.connect(this.master);

    // building drone: brown-ish noise + 50 Hz mains hum
    const drone = this.noise(true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0.55;
    drone.connect(lp).connect(this.droneGain).connect(this.master);
    const hum = ctx.createOscillator(); hum.frequency.value = 50;
    const hg = ctx.createGain(); hg.gain.value = 0.025;
    hum.connect(hg).connect(this.master); hum.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.2;
    lfo.connect(lfoG).connect(this.droneGain.gain); lfo.start();

    // rain against the windows (left side)
    const rain = this.noise(true);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0.09;
    const pan = ctx.createStereoPanner(); pan.pan.value = -0.55;
    rain.connect(bp).connect(hp).connect(this.rainGain).connect(pan).connect(this.master);
    this.rainPan = pan;

    // entity layers
    const st = this.noise(true);
    const sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 3500; sbp.Q.value = 0.7;
    this.staticGain = ctx.createGain(); this.staticGain.gain.value = 0;
    st.connect(sbp).connect(this.staticGain).connect(this.master);
    this.heartbeatGain = ctx.createGain(); this.heartbeatGain.gain.value = 0; this.heartbeatGain.connect(this.master);
  }
  rainPan?: StereoPannerNode;

  private noise(loop: boolean) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; s.start(0, Math.random() * 2);
    return s;
  }

  /** A spatial hum (vending machine compressor, pump motor, fluorescent buzz). */
  addHum(pos: THREE.Vector3, freq: number, type: OscillatorType, vol: number, lpFreq = 400) {
    const ctx = this.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 1.2; panner.rolloffFactor = 1.6;
    panner.positionX.value = pos.x; panner.positionY.value = pos.y; panner.positionZ.value = pos.z;
    const g = ctx.createGain(); g.gain.value = vol;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpFreq;
    for (const mult of [1, 2, 3.01]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * mult;
      const og = ctx.createGain(); og.gain.value = 1 / (mult * mult);
      o.connect(og).connect(lp); o.start();
    }
    lp.connect(g).connect(panner).connect(this.master);
    panner.connect(this.reverbSend);
    this.positional.push({ panner, gain: g });
    return g;
  }

  updateListener(cam: THREE.Camera, dt: number) {
    if (!this.started) return;
    const L = this.ctx.listener;
    const p = cam.position;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02);
      L.upX.setTargetAtTime(u.x, t, 0.02); L.upY.setTargetAtTime(u.y, t, 0.02); L.upZ.setTargetAtTime(u.z, t, 0.02);
    }
    // rain louder near the windows; pan relative to facing
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    if (this.rainPan) this.rainPan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, -right.x * 0.7)), this.ctx.currentTime, 0.1);
    this.rainGain.gain.setTargetAtTime(this.rainLevel, this.ctx.currentTime, 0.4);
    // deeper building rumble underground
    this.droneGain.gain.setTargetAtTime(p.y < -1 ? 0.95 : 0.55, this.ctx.currentTime, 0.8);

    // presence: static + heartbeat
    const pr = this.presence;
    this.staticGain.gain.setTargetAtTime(pr * pr * 0.18, this.ctx.currentTime, 0.08);
    this.hbTimer -= dt;
    if (pr > 0.15 && this.hbTimer <= 0) {
      this.hbTimer = 1.1 - pr * 0.6;
      this.thump(0.18 + pr * 0.5, 0); this.thump(0.12 + pr * 0.35, 0.18);
    }
  }

  private thump(vol: number, delay: number) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.15);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.3);
  }

  footstep(intensity: number, wet: boolean) {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = wet ? 1400 + Math.random() * 600 : 600 + Math.random() * 300; bp.Q.value = wet ? 1.2 : 0.9;
    const g = ctx.createGain();
    const v = (0.22 + intensity * 0.25) * (0.85 + Math.random() * 0.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + (wet ? 0.22 : 0.12));
    src.connect(bp).connect(g); g.connect(this.master); g.connect(this.reverbSend);
    src.start(t, Math.random() * 2, 0.3);
    // heel thump
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    const og = ctx.createGain(); og.gain.setValueAtTime(v * 0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.12);
    if (wet) { // splash
      const s2 = ctx.createBufferSource(); s2.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t + 0.02); g2.gain.linearRampToValueAtTime(v * 0.35, t + 0.04); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      s2.connect(hp).connect(g2).connect(this.master); s2.start(t, Math.random() * 2, 0.35);
    }
  }

  /** Generic one-shot noise/tone helpers used for events. */
  clunk() {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const tt = t + 0.25 + i * 0.18;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(140 - i * 25, tt); o.frequency.exponentialRampToValueAtTime(40, tt + 0.12);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.2);
      o.connect(lp).connect(g); g.connect(this.master); g.connect(this.reverbSend); o.start(tt); o.stop(tt + 0.25);
    }
    // motor whirr
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.linearRampToValueAtTime(140, t + 0.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.7);
    o.connect(lp).connect(g).connect(this.master); o.start(t); o.stop(t + 0.8);
    // can roll
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 6;
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0, t + 0.85); sg.gain.linearRampToValueAtTime(0.25, t + 0.9); sg.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    s.connect(bp).connect(sg).connect(this.master); s.start(t, 0, 1.6);
  }

  click(pitch = 1) {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 2200 * pitch;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.05);
  }

  pickup() {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [660, 990].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + i * 0.08); g.gain.linearRampToValueAtTime(0.12, t + i * 0.08 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.25);
      o.connect(g).connect(this.master); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.3);
    });
  }

  /** Low dissonant swell when the thing is first seen / gets close. */
  stinger(vol = 0.5) {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(vol, t + 0.05); out.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    out.connect(this.master); out.connect(this.reverbSend);
    for (const f of [55, 58.3, 82.4, 116.5, 233.1, 246.9]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.detune.setValueAtTime(0, t); o.detune.linearRampToValueAtTime(-60, t + 2.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(200, t + 2.5);
      const g = ctx.createGain(); g.gain.value = 0.12;
      o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 3);
    }
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const sg = ctx.createGain(); sg.gain.value = 0.18;
    s.connect(hp).connect(sg).connect(out); s.start(t, 0, 2.8);
  }

  scream() {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.setValueAtTime(0.9, t); out.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    out.connect(this.master);
    for (const f of [310, 333, 467, 621, 880]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 1.4);
      const vib = ctx.createOscillator(); vib.frequency.value = 23; const vg = ctx.createGain(); vg.gain.value = f * 0.06;
      vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + 1.6);
      const g = ctx.createGain(); g.gain.value = 0.1;
      o.connect(g).connect(out); o.start(t); o.stop(t + 1.6);
    }
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const g = ctx.createGain(); g.gain.value = 0.5;
    s.connect(g).connect(out); s.start(t, 0, 1.6);
  }

  powerUp() {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(30, t); o.frequency.exponentialRampToValueAtTime(120, t + 1.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 1.2); g.gain.exponentialRampToValueAtTime(0.001, t + 3);
    o.connect(lp).connect(g); g.connect(this.master); g.connect(this.reverbSend); o.start(t); o.stop(t + 3);
    // alarm beeps
    for (let i = 0; i < 6; i++) {
      const tt = t + 1.6 + i * 0.5;
      const b = ctx.createOscillator(); b.type = 'square'; b.frequency.value = i % 2 ? 740 : 988;
      const bg = ctx.createGain(); bg.gain.setValueAtTime(0.07, tt); bg.gain.setValueAtTime(0, tt + 0.3);
      b.connect(bg); bg.connect(this.master); bg.connect(this.reverbSend); b.start(tt); b.stop(tt + 0.32);
    }
  }

  gateCreak() {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t);
    for (let i = 0; i < 12; i++) o.frequency.setValueAtTime(150 + Math.random() * 120, t + i * 0.12);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.1); g.gain.linearRampToValueAtTime(0, t + 1.5);
    o.connect(bp).connect(g); g.connect(this.master); g.connect(this.reverbSend); o.start(t); o.stop(t + 1.6);
  }

  distantBang() {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    s.connect(lp).connect(g); g.connect(this.reverbSend); g.connect(this.master); s.start(t, 0, 0.7);
  }

  levels(): [number, number] {
    if (!this.started) return [0, 0];
    this.analyserL.getFloatTimeDomainData(this.bufL);
    this.analyserR.getFloatTimeDomainData(this.bufR);
    let a = 0, b = 0;
    for (let i = 0; i < 1024; i++) { a += this.bufL[i] * this.bufL[i]; b += this.bufR[i] * this.bufR[i]; }
    return [Math.sqrt(a / 1024), Math.sqrt(b / 1024)];
  }
}
