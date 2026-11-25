// Bodycam overlay HUD + game text layers.
export class Hud {
  root: HTMLElement;
  private recDot: HTMLElement;
  private clock: HTMLElement;
  private res: HTMLElement;
  private batt: HTMLElement;
  private battFill: HTMLElement;
  private meterL: HTMLElement;
  private meterR: HTMLElement;
  private prompt: HTMLElement;
  private objective: HTMLElement;
  private msg: HTMLElement;
  private note: HTMLElement;
  private camLabel: HTMLElement;
  private start = new Date(2026, 10, 21, 2, 51, 18).getTime();
  private t0 = performance.now();
  private msgTimer = 0;

  constructor() {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <div class="tl">BODYCAM V3.2.1<br>UNIT 4417</div>
      <div class="tr"><span class="rec"><i id="recdot"></i>REC</span><br><span id="clock"></span><br><span id="camlabel">CAM 02 / CORRIDOR A</span></div>
      <div class="bl"><span class="batt"><span class="battbody"><span id="battfill"></span></span><span class="battcap"></span></span> <span id="batt">92%</span><br><span id="res"></span><br>FOV 110°<br>ISO 800</div>
      <div class="br"><div>L <span id="meterL" class="meter"></span></div><div>R <span id="meterR" class="meter"></span></div></div>
      <div id="objective"></div>
      <div id="prompt"></div>
      <div id="msg"></div>
      <div id="note"></div>
      <div class="crosshair"></div>`;
    const q = (id: string) => document.getElementById(id)!;
    this.recDot = q('recdot'); this.clock = q('clock'); this.res = q('res'); this.batt = q('batt'); this.battFill = q('battfill');
    this.meterL = q('meterL'); this.meterR = q('meterR'); this.prompt = q('prompt'); this.objective = q('objective');
    this.msg = q('msg'); this.note = q('note'); this.camLabel = q('camlabel');
  }

  update(dt: number, levels: [number, number], battery: number, canvasH: number) {
    const now = performance.now();
    this.recDot.style.opacity = Math.floor(now / 500) % 2 ? '0.15' : '1';
    const d = new Date(this.start + (now - this.t0));
    const p = (n: number) => String(n).padStart(2, '0');
    this.clock.textContent = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    this.res.textContent = `${canvasH}P`;
    const b = Math.max(0, Math.round(battery));
    this.batt.textContent = `${b}%`;
    this.battFill.style.width = `${b}%`;
    this.battFill.style.background = b < 20 ? '#ff4a3a' : '#fff';
    const bar = (v: number) => {
      const n = Math.max(0, Math.min(10, Math.round(Math.sqrt(v) * 22)));
      return '█'.repeat(n) + '░'.repeat(10 - n);
    };
    this.meterL.textContent = bar(levels[0]);
    this.meterR.textContent = bar(levels[1]);
    if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) this.msg.classList.remove('show'); }
  }

  setPrompt(s: string | null) { this.prompt.textContent = s ?? ''; this.prompt.style.opacity = s ? '1' : '0'; }
  setObjective(s: string) { this.objective.textContent = s; }
  setCamLabel(s: string) { this.camLabel.textContent = s; }
  message(s: string, secs = 4) {
    this.msg.textContent = s; this.msg.classList.add('show'); this.msgTimer = secs;
  }
  showNote(lines: string[] | null) {
    if (!lines) { this.note.classList.remove('show'); return; }
    this.note.innerHTML = lines.map((l) => `<div>${l.replace(/</g, '&lt;') || '&nbsp;'}</div>`).join('') + '<div class="hint">[E] close</div>';
    this.note.classList.add('show');
  }
  get noteOpen() { return this.note.classList.contains('show'); }
  setVisible(v: boolean) { this.root.style.display = v ? 'block' : 'none'; }
}
