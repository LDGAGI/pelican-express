/* ============================================================================
   J · UI — DOM wiring for the loader, gate, HUD, dock and keyboard
   ========================================================================== */

const $ = (s) => document.querySelector(s);

const UI = {
  h: {},
  toastT: 0,
  lastSpeed: -1,

  init(handlers) {
    this.h = {
      loader: $('#loader'), bar: $('#barFill'), loadMsg: $('#loadMsg'),
      gate: $('#gate'), start: $('#startBtn'),
      hud: $('#hud'), sSpeed: $('#sSpeed'), sCad: $('#sCad'), sDist: $('#sDist'), sFish: $('#sFish'),
      speed: $('#speed'), speedOut: $('#speedOut'), cams: $('#cams'),
      btnPhase: $('#btnPhase'), btnShades: $('#btnShades'), btnBell: $('#btnBell'),
      btnSound: $('#btnSound'), btnMusic: $('#btnMusic'), btnBrake: $('#btnBrake'),
      helpTab: $('#helpTab'), helpSheet: $('#helpSheet'), hint: $('#hint'), toast: $('#toast'),
    };
    const H = this.h;
    this.handlers = handlers;

    H.start.addEventListener('click', () => handlers.start());
    H.speed.addEventListener('input', () => {
      const v = +H.speed.value;
      H.speed.style.setProperty('--pct', v + '%');
      H.speedOut.textContent = (v * 0.26).toFixed(1);
      handlers.speed(v / 100);
    });
    H.cams.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cam]');
      if (!b) return;
      handlers.camera(+b.dataset.cam);
      this.setCam(+b.dataset.cam);
    });
    const tgl = (el, fn) => el.addEventListener('click', () => fn(el));
    tgl(H.btnPhase, () => handlers.phase());
    tgl(H.btnShades, () => handlers.shades());
    H.btnBell.addEventListener('click', () => { handlers.bell(); this.ring(H.btnBell); });
    tgl(H.btnSound, () => handlers.sound());
    tgl(H.btnMusic, () => handlers.music());
    tgl(H.btnBrake, () => handlers.brake());

    H.helpTab.addEventListener('click', () => {
      const open = H.helpSheet.hidden;
      H.helpSheet.hidden = !open;
      H.helpTab.setAttribute('aria-expanded', String(open));
    });

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const map = {
        '1': () => this.pick(0), '2': () => this.pick(1), '3': () => this.pick(2),
        '4': () => this.pick(3), '5': () => this.pick(4),
        ' ': () => { handlers.brake(); e.preventDefault(); },
        'arrowup': () => handlers.nudge(6), 'arrowdown': () => handlers.nudge(-6),
        'n': () => handlers.phase(), 'b': () => { handlers.bell(); this.ring(H.btnBell); },
        's': () => handlers.shades(), 'm': () => handlers.sound(),
        'l': () => handlers.music(), 'h': () => H.hud.classList.toggle('hidden-ui'),
        'r': () => handlers.reset(),
      };
      if (map[k]) { map[k](); }
      if (k === '?' || k === '/') H.helpTab.click();
    });

    this.setSpeedDefault(46);
  },

  setSpeedDefault(v) {
    this.h.speed.value = v;
    this.h.speed.style.setProperty('--pct', v + '%');
    this.h.speedOut.textContent = (v * 0.26).toFixed(1);
  },
  setSpeed(v) {
    const el = this.h.speed;
    el.value = Math.round(v * 100);
    el.style.setProperty('--pct', Math.round(v * 100) + '%');
    this.h.speedOut.textContent = (v * 26).toFixed(1);
  },
  pick(i) {
    const b = this.h.cams.querySelector(`button[data-cam="${i}"]`);
    if (b) b.click();
  },
  setCam(i) {
    for (const b of this.h.cams.querySelectorAll('button')) {
      const on = +b.dataset.cam === i;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
  },
  pressed(el, v) { el.setAttribute('aria-pressed', String(v)); },
  ring(el) {
    el.classList.remove('ring');
    void el.offsetWidth;
    el.classList.add('ring');
  },
  progress(p, msg) {
    this.h.bar.style.width = Math.round(p * 100) + '%';
    if (msg) this.h.loadMsg.textContent = msg;
  },
  async finishLoading() {
    await nextFrame();
    this.progress(1, '准备就绪');
    await new Promise((r) => setTimeout(r, 260));
    this.h.loader.classList.add('out');
    this.h.gate.hidden = false;
    setTimeout(() => { this.h.loader.hidden = true; }, 800);
  },
  dismissGate() {
    this.h.gate.classList.add('out');
    this.h.hud.hidden = false;
    setTimeout(() => { this.h.gate.hidden = true; }, 800);
  },
  hideHint() { this.h.hint.classList.add('gone'); },
  stats(s) {
    const H = this.h;
    H.sSpeed.textContent = s.kmh.toFixed(1);
    H.sCad.textContent = Math.round(s.cad);
    H.sDist.textContent = (s.dist / 1000).toFixed(2);
    H.sFish.textContent = s.fish;
    if (s.kmh > (this.lastSpeed + 2.2)) {
      this.lastSpeed = s.kmh;
      H.sSpeed.parentElement.parentElement.classList.remove('bump');
      void H.sSpeed.offsetWidth;
      H.sSpeed.parentElement.parentElement.classList.add('bump');
    }
    if (s.kmh < this.lastSpeed - 1) this.lastSpeed = s.kmh;
  },
  toast(msg, ms = 1700) {
    const t = this.h.toast;
    t.hidden = false;
    t.innerHTML = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.hidden = true; }, 320);
    }, ms);
  },
};
