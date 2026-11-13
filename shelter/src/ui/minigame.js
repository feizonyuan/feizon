// 打工、上课、修东西时的小操作。每个十来秒，做完回调一个 0 到 1 的成绩。
// 可以不玩：点“直接干完”，成绩按 0.5 算，拿基础的结果。

const ARROWS = [
  ['ArrowUp', 'w', '↑'],
  ['ArrowDown', 's', '↓'],
  ['ArrowLeft', 'a', '←'],
  ['ArrowRight', 'd', '→'],
];

let cleanup = null;

function mount(host, html) {
  cleanup?.();
  host.innerHTML = `<div class="overlay"><div class="mini" role="dialog" aria-modal="true">${html}</div></div>`;
  return host.querySelector('.mini');
}

function finish(done, score) {
  cleanup?.();
  cleanup = null;
  done(Math.max(0, Math.min(1, score)));
}

// 出餐：照着单子上的方向键按，限时内出完六单。
export function playOrders(host, { title, intro, orders = 6, seconds = 14 }, done) {
  const box = mount(
    host,
    `<p class="stamp">${title}</p><h2>照着单子按方向键</h2><p class="hint">${intro}</p>
     <div class="mini-keys" id="mini-keys"></div>
     <div class="mini-bar"><i id="mini-time"></i></div>
     <p class="mini-count" id="mini-count"></p>
     <button class="btn wide" id="mini-skip">不玩，直接干完</button>`,
  );
  const keysEl = box.querySelector('#mini-keys');
  const timeEl = box.querySelector('#mini-time');
  const countEl = box.querySelector('#mini-count');
  let served = 0;
  let order = [];
  let at = 0;
  let ended = false;
  const started = performance.now();

  const newOrder = () => {
    order = Array.from({ length: 4 }, () => ARROWS[Math.floor(Math.random() * 4)]);
    at = 0;
  };
  const paint = () => {
    keysEl.innerHTML = order.map((a, i) => `<kbd class="${i < at ? 'hit' : i === at ? 'now' : ''}">${a[2]}</kbd>`).join('');
    countEl.textContent = `出了 ${served} / ${orders} 单`;
  };
  const end = () => {
    if (ended) return;
    ended = true;
    finish(done, served / orders);
  };
  const onKey = (event) => {
    const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const hit = ARROWS.find((a) => a[0] === k || a[1] === k);
    if (!hit) return;
    event.preventDefault();
    if (hit === order[at]) {
      at += 1;
      if (at === order.length) {
        served += 1;
        if (served >= orders) return end();
        newOrder();
      }
    } else {
      at = 0;
      keysEl.classList.remove('shake');
      void keysEl.offsetWidth;
      keysEl.classList.add('shake');
    }
    paint();
  };
  let raf = 0;
  const tick = () => {
    const left = 1 - (performance.now() - started) / (seconds * 1000);
    timeEl.style.width = `${Math.max(0, left) * 100}%`;
    if (left <= 0) return end();
    raf = requestAnimationFrame(tick);
  };
  document.addEventListener('keydown', onKey);
  box.querySelector('#mini-skip').addEventListener('click', () => {
    ended = true;
    finish(done, 0.5);
  });
  cleanup = () => {
    document.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
  };
  newOrder();
  paint();
  raf = requestAnimationFrame(tick);
}

// 找准时机：游标来回扫，扫进绿色那一段时按空格。一共五次，绿色越来越窄。
export function playTiming(host, { title, heading, intro, rounds = 5 }, done) {
  const box = mount(
    host,
    `<p class="stamp">${title}</p><h2>${heading}</h2><p class="hint">${intro}</p>
     <div class="mini-track" id="mini-track"><i class="zone" id="mini-zone"></i><i class="cursor" id="mini-cursor"></i></div>
     <p class="mini-count" id="mini-count"></p>
     <button class="btn wide" id="mini-skip">不玩，直接干完</button>`,
  );
  const zoneEl = box.querySelector('#mini-zone');
  const cursorEl = box.querySelector('#mini-cursor');
  const countEl = box.querySelector('#mini-count');
  let round = 0;
  let hits = 0;
  let zone = [0, 0];
  let pos = 0;
  let ended = false;
  let lock = 0;
  const started = performance.now();

  const newZone = () => {
    const width = 0.24 - round * 0.025;
    const start = 0.08 + Math.random() * (0.84 - width);
    zone = [start, start + width];
    zoneEl.style.left = `${start * 100}%`;
    zoneEl.style.width = `${width * 100}%`;
    countEl.textContent = `第 ${round + 1} / ${rounds} 次，按中了 ${hits} 次`;
  };
  const onKey = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (event.repeat || ended || performance.now() < lock) return;
    const ok = pos >= zone[0] && pos <= zone[1];
    if (ok) hits += 1;
    zoneEl.classList.toggle('ok', ok);
    zoneEl.classList.toggle('miss', !ok);
    lock = performance.now() + 320;
    round += 1;
    if (round >= rounds) {
      ended = true;
      countEl.textContent = `按中了 ${hits} / ${rounds} 次`;
      return setTimeout(() => finish(done, hits / rounds), 380);
    }
    setTimeout(() => {
      zoneEl.classList.remove('ok', 'miss');
      newZone();
    }, 300);
  };
  let raf = 0;
  const tick = () => {
    const t = ((performance.now() - started) / 1000) * (0.75 + round * 0.06);
    pos = 0.5 - 0.5 * Math.cos(t * Math.PI);
    cursorEl.style.left = `${pos * 100}%`;
    raf = requestAnimationFrame(tick);
  };
  document.addEventListener('keydown', onKey);
  box.querySelector('#mini-skip').addEventListener('click', () => {
    ended = true;
    finish(done, 0.5);
  });
  cleanup = () => {
    document.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
  };
  newZone();
  raf = requestAnimationFrame(tick);
}

export function stopMinigame() {
  cleanup?.();
  cleanup = null;
}
