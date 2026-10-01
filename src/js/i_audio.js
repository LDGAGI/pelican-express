/* ============================================================================
   I · AUDIO — everything synthesised, no asset files
   ========================================================================== */

const Sound = {
  ready: false,
  on: false,
  ctx: null,

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.ready = true;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6; comp.attack.value = 0.004;
    this.master.connect(comp).connect(ctx.destination);

    /* shared white-noise source buffer */
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    const loopNoise = (type, freq, q, gain) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return { src, f, g };
    };

    this.tyre = loopNoise('bandpass', 260, 1.1, 0);
    this.wind = loopNoise('bandpass', 900, 0.6, 0);
    this.sea = loopNoise('lowpass', 520, 0.9, 0.055);
    this.rumble = loopNoise('lowpass', 90, 1.0, 0);

    /* slow swell on the surf */
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.11; lfoG.gain.value = 0.035;
    lfo.connect(lfoG).connect(this.sea.g.gain);
    lfo.start();
    const lfo2 = ctx.createOscillator(), lfo2G = ctx.createGain();
    lfo2.frequency.value = 0.07; lfo2G.gain.value = 190;
    lfo2.connect(lfo2G).connect(this.sea.f.frequency);
    lfo2.start();

    /* a soft pad for the "sea shanty" radio */
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    const rev = ctx.createBiquadFilter();
    rev.type = 'lowpass'; rev.frequency.value = 2200;
    this.musicGain.connect(rev).connect(this.master);
    this.musicNext = 0;
    this.musicStep = 0;
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setEnabled(v) {
    this.on = v;
    if (!this.ready) this.init();
    if (!this.ready || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(v ? 0.85 : 0, this.ctx.currentTime + 0.4);
  },

  /* continuous layers follow the ride state */
  ride(speed01, wind01) {
    if (!this.ready || !this.on) return;
    const t = this.ctx.currentTime;
    const set = (p, v, k = 0.25) => p.setTargetAtTime(v, t, k);
    set(this.tyre.g.gain, 0.10 * speed01 * speed01);
    set(this.tyre.f.frequency, 180 + speed01 * 520, 0.3);
    set(this.wind.g.gain, 0.035 + 0.075 * wind01 * speed01);
    set(this.wind.f.frequency, 700 + speed01 * 900, 0.3);
    set(this.rumble.g.gain, 0.05 * speed01);
  },

  /* ---- one-shots ---- */
  blip(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
    if (!this.ready || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },

  noiseHit(dur, f0, f1, vol, type = 'bandpass') {
    if (!this.ready || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  },

  bell() {
    if (!this.ready || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [f, v, d] of [[2093, 0.16, 1.5], [3136, 0.09, 1.1], [4186, 0.05, 0.8], [1046, 0.05, 1.8]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + d + 0.05);
    }
  },
  creak() { this.noiseHit(0.18, 900 + Math.random() * 500, 240, 0.05, 'bandpass'); },
  honk() {
    this.blip(196, 0.30, 'sawtooth', 0.10, -46);
    setTimeout(() => this.blip(165, 0.34, 'sawtooth', 0.09, -40), 210);
  },
  splash() { this.noiseHit(0.55, 3200, 320, 0.20, 'lowpass'); this.blip(180, 0.2, 'sine', 0.06, -80); },
  catchFx() {
    this.blip(880, 0.10, 'triangle', 0.14, 620);
    setTimeout(() => this.blip(1320, 0.16, 'triangle', 0.11, 300), 80);
    this.noiseHit(0.28, 4200, 900, 0.10);
  },
  gull() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.blip(1500 + Math.random() * 500, 0.13, 'sawtooth', 0.045, -700), i * 150);
    }
  },
  thunder() {
    this.noiseHit(2.6, 220, 45, 0.30, 'lowpass');
    this.noiseHit(1.2, 900, 90, 0.10, 'lowpass');
  },

  /* a wandering pentatonic loop, off by default */
  music(toggle) {
    if (!this.ready) return;
    this.musicGain.gain.setTargetAtTime(toggle ? 0.16 : 0, this.ctx.currentTime, 0.5);
    this.musicOn = toggle;
  },
  pump() {
    if (!this.ready || !this.musicOn) return;
    const ctx = this.ctx, now = ctx.currentTime;
    if (this.musicNext === 0) this.musicNext = now + 0.1;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const root = 196.0;
    while (this.musicNext < now + 0.35) {
      const st = this.musicStep++;
      const t = this.musicNext;
      if (st % 8 === 0) {
        for (const iv of [0, 7, 12]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = root / 2 * Math.pow(2, iv / 12);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.05, t + 0.5);
          g.gain.linearRampToValueAtTime(0, t + 2.6);
          o.connect(g).connect(this.musicGain);
          o.start(t); o.stop(t + 2.8);
        }
      }
      if (st % 2 === 1) {
        const n = scale[(Math.random() * scale.length) | 0];
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = root * Math.pow(2, (n + 12) / 12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g).connect(this.musicGain);
        o.start(t); o.stop(t + 1.0);
      }
      this.musicNext += 0.34;
    }
  },
};
