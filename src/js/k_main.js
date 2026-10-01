/* ============================================================================
   K · MAIN — renderer, camera director, ride dynamics, input, loop
   ========================================================================== */

const CAM_PRESETS = [
  { theta: -2.58, phi: 0.235, dist: 3.95, fov: 36, tx: 0.16, ty: 0.86, l: 2.3 },
  { theta: 1.10, phi: 0.300, dist: 4.60, fov: 34, tx: 0.02, ty: 0.92, l: 2.0, orbit: 0.125 },
  { theta: 0.36, phi: 0.115, dist: 1.70, fov: 34, tx: 0.52, ty: 1.52, l: 2.6, head: true },
  { theta: -2.05, phi: 0.160, dist: 8.60, fov: 21, tx: 0.10, ty: 1.05, l: 1.5, cine: true },
  { theta: -2.55, phi: 0.280, dist: 3.90, fov: 38, tx: 0.00, ty: 0.92, l: 14 },
];

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function main() {
  const canvas = document.getElementById('scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: 'high-performance',
      stencil: false, alpha: false,
    });
  } catch (e) {
    document.getElementById('loadMsg').textContent = '这台设备的浏览器不支持 WebGL，无法渲染。';
    return;
  }

  /* ═════════════════════════════ state ═════════════════════════════ */
  const S = {
    running: false, dprCap: 2,
    speed: 0, speedTarget: 2.2,
    dist: 0, crank: 0, wheel: 0,
    fish: 0, catchCount: 0, fishFill: 0,
    braking: false, night: 0, wind: 0.3,
    catchT: -1, catchFrom: new THREE.Vector3(),
    sound: true, music: false,
    bob: 0, lean: 0, steer: 0,
  };
  const state = {
    running: 0, speed: 0, crank: 0, mouth: 0, fishFill: 0,
    wind: 0, night: 0, bob: 0, lean: 0, steer: 0,
    kmh: 0, cad: 0, dist: 0, fish: 0,
  };

  let bike = null, pelican = null;
  let camera = null, scene = null, post = null;

  UI.init({
    start: () => start(),
    speed: (v) => { S.speedTarget = v * 6.9; },
    nudge: (d) => { S.speedTarget = clamp(S.speedTarget + d * 0.30, 0, 6.9); UI.setSpeed(S.speedTarget / 6.9); },
    camera: (i) => setCam(i),
    phase: () => {
      World.cyclePhase();
      UI.toast('时间 · ' + ({ day: '白天', dusk: '黄昏', night: '夜晚' })[World.phaseTarget]);
    },
    shades: () => {
      pelican.shades.visible = !pelican.shades.visible;
      UI.pressed(UI.h.btnShades, pelican.shades.visible);
      UI.toast(pelican.shades.visible ? '墨镜已戴上' : '墨镜已摘下');
    },
    bell: () => { Sound.bell(); UI.toast('叮—— 有人听见了吗？'); },
    sound: () => {
      S.sound = !S.sound;
      Sound.setEnabled(S.sound);
      UI.pressed(UI.h.btnSound, S.sound);
      UI.toast(S.sound ? '声音开' : '静音');
    },
    music: () => {
      S.music = !S.music;
      Sound.music(S.music);
      UI.pressed(UI.h.btnMusic, S.music);
      UI.toast(S.music ? '海风电台 · FM 92.4' : '电台关闭');
    },
    brake: () => { S.braking = !S.braking; UI.pressed(UI.h.btnBrake, S.braking); },
    reset: () => {
      S.dist = 0; S.fish = 0; S.catchCount = 0; S.fishFill = 0;
      S.speedTarget = 2.2; UI.setSpeed(2.2 / 6.9);
      UI.toast('重新出发');
    },
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x070c13, 1);

  const step = async (p, msg) => { UI.progress(p, msg); await nextFrame(); await nextFrame(); };

  await step(0.06, '正在发动三轮车…');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.08, 4200);
  post = new Post(renderer);

  await step(0.18, '正在铺开海岸线…');
  World.build(scene, renderer);

  await step(0.54, '正在组装二四速通勤车…');
  bike = buildBike(scene, World.T);

  await step(0.74, '正在叫醒鹈鹕…');
  pelican = buildPelican(scene);
  const rig = new THREE.Group();
  scene.add(rig);
  rig.add(bike.root);
  pelican.mount(rig);

  await step(0.87, '正在放鱼出海…');
  FX.build(scene, pelican);
  const catchFish = new THREE.Mesh(fishGeo(0.20), new THREE.MeshStandardMaterial({
    color: 0x7fd0dd, roughness: 0.25, metalness: 0.45, side: THREE.DoubleSide,
    emissive: 0x1d525c, emissiveIntensity: 0.6,
  }));
  catchFish.visible = false;
  scene.add(catchFish);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, S.dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(Math.max(2, Math.round(w * dpr)), Math.max(2, Math.round(h * dpr)));
  }
  window.addEventListener('resize', resize);

  await step(0.95, '正在编译着色器…');
  resize();
  camera.position.set(-3.2, 1.5, 1.8);
  camera.lookAt(0, 1, 0);
  renderer.compile(scene, camera);

  await UI.finishLoading();

  /* ═════════════════════════════ camera ═════════════════════════════ */
  let mode = 0;
  const Cam = {
    theta: CAM_PRESETS[0].theta, phi: CAM_PRESETS[0].phi, dist: 6.5,
    fov: 36, tgt: new THREE.Vector3(0, 0.86, 0), roll: 0,
  };
  function setCam(i) {
    mode = i;
    if (i === 4) {
      CAM_PRESETS[4].theta = Cam.theta;
      CAM_PRESETS[4].phi = Cam.phi;
      CAM_PRESETS[4].dist = Cam.dist;
    }
  }

  function start() {
    if (S.running) return;
    S.running = true;
    UI.dismissGate();
    Sound.init();
    Sound.setEnabled(S.sound);
    Sound.resume();
    setTimeout(() => UI.hideHint(), 11000);
    setTimeout(() => { if (S.running) UI.toast('拖动画面环视 · 滚轮推拉 · 点击鹈鹕接鱼', 4200); }, 1500);
  }

  World.onThunder = () => Sound.thunder();
  setInterval(() => { if (S.running && Math.random() < 0.30) Sound.gull(); }, 5400);

  /* ═════════════════════════════ input ═════════════════════════════ */
  let dragging = false, moved = 0, lx = 0, ly = 0, downT = 0, pid = null;
  const pinch = { d: 0 };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    pid = e.pointerId; dragging = true; moved = 0; downT = performance.now();
    lx = e.clientX; ly = e.clientY;
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pid) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 6) {
      if (mode !== 4) { setCam(4); UI.setCam(4); }
      CAM_PRESETS[4].theta -= dx * 0.0052;
      CAM_PRESETS[4].phi = clamp(CAM_PRESETS[4].phi - dy * 0.0042, -0.12, 1.30);
    }
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('dragging');
    if (moved < 10 && performance.now() - downT < 700 && e.type === 'pointerup') pickPelican(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('dragging'); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (mode !== 4) { setCam(4); UI.setCam(4); }
    CAM_PRESETS[4].dist = clamp(CAM_PRESETS[4].dist * (1 + Math.sign(e.deltaY) * 0.09), 0.85, 24);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch.d > 0) {
      if (mode !== 4) { setCam(4); UI.setCam(4); }
      CAM_PRESETS[4].dist = clamp(CAM_PRESETS[4].dist * (pinch.d / d), 0.85, 24);
    }
    pinch.d = d;
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pinch.d = 0; });

  function pickPelican(cx, cy) {
    ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(pelican.root, true).length) doCatch();
  }
  function doCatch() {
    if (S.catchT >= 0) return;
    S.catchT = 0;
    S.catchFrom.set(camera.position.x + 4.0, W.seaY + 0.5, W.shoreZ + 8);
    catchFish.visible = true;
    Sound.honk();
  }

  /* ═════════════════════════════ loop ═════════════════════════════ */
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const footV = new THREE.Vector3();
  const hipV = new THREE.Vector3(0, -0.095, 0);
  const pouchW = new THREE.Vector3();
  let t = 0, creak = 0, acc = 0, fn = 0;

  let frames = 0;
  function frame() {
    requestAnimationFrame(frame);
    frames++;
    const raw = clock.getDelta();
    const dt = (window.__PX && window.__PX.pause) ? 0 : Math.min(raw, 1 / 20);
    t += dt;

    /* ---- ride dynamics */
    const tgt = S.braking ? 0 : (S.running ? S.speedTarget : 0);
    S.speed = damp(S.speed, tgt, S.speed < tgt ? 1.15 : 2.4, dt);
    const running = clamp(S.speed / 1.2, 0, 1);
    S.dist += S.speed * dt;
    S.wheel -= (S.speed / W.wheelR) * dt;
    S.crank = S.wheel * (BIKE.cogR / BIKE.ringR);
    S.steer = Math.sin(t * 0.23) * 0.55 + Math.sin(t * 0.71 + 1.3) * 0.22;
    S.lean = damp(S.lean, -S.steer * 0.10 * running, 3, dt);
    S.wind = 0.25 + S.speed * 0.14;
    S.bob = Math.sin(t * 3.1) * 0.004 * (0.4 + running);
    state.crank = S.crank; state.speed = S.speed; state.running = running;
    state.wind = S.wind; state.bob = S.bob; state.lean = S.lean; state.steer = S.steer;

    /* ---- rig attitude */
    rig.position.y = Math.sin(S.crank * 2) * 0.009 * running + S.bob;
    rig.rotation.z = Math.sin(S.crank) * 0.017 * running + S.lean;
    rig.rotation.x = -0.012 * running + Math.sin(t * 2.3) * 0.004;
    rig.rotation.y = S.steer * 0.045 * running;

    /* ---- bike */
    bike.wheelR.rotation.z = S.wheel;
    bike.wheelF.rotation.z = S.wheel;
    bike.ring.rotation.z = S.crank;
    bike.cog.rotation.z = S.wheel;
    bike.crankGrp.rotation.z = S.crank;
    for (const p of bike.pedals) p.rotation.z = -S.crank;
    bike.chainStep(S.dist);

    /* ---- catch timing (the award fires after the pouch matrix is current) */
    let catchU = -1;
    if (S.catchT >= 0) {
      S.catchT += dt;
      catchU = clamp(S.catchT / 0.85, 0, 1);
      state.mouth = Math.sin(clamp(catchU * 1.55, 0, 1) * Math.PI);
    } else {
      state.mouth = 0;
    }

    /* ---- pelican (sets its own local transform) */
    pelican.update(dt, t, state);
    pelican.pouchFish.getWorldPosition(pouchW);

    /* matrices must be current before the legs reach for the pedals */
    rig.updateMatrixWorld(true);

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const th = S.crank + (i === 0 ? 0 : Math.PI);
      footV.set(
        BIKE.BB.x + Math.sin(th) * BIKE.crank,
        BIKE.BB.y - Math.cos(th) * BIKE.crank,
        BIKE.pedalZ * s);
      rig.localToWorld(footV);
      pelican.root.worldToLocal(footV);
      hipV.set(0, -0.095, 0.085 * s);
      pelican.solveLeg(pelican.legs[i], hipV, footV, 0.46, 0.46);
    }

    if (catchU >= 0) {
      catchFish.position.lerpVectors(S.catchFrom, pouchW, easeOut(catchU));
      catchFish.position.y += Math.sin(catchU * Math.PI) * 1.6;
      catchFish.rotation.set(0, 0.4, catchU * 9);
      catchFish.scale.setScalar(1 - catchU * 0.4);
      if (catchU >= 1) {
        S.catchT = -1;
        catchFish.visible = false;
        S.fish++;
        S.catchCount++;
        FX.burst(pouchW, 24);
        FX.splash(pouchW.x, pouchW.y, pouchW.z, 0.45, [1.0, 0.86, 0.62]);
        Sound.catchFx();
        state.fish = S.fish;
        UI.stats(state);
        UI.toast(`渔获 +1 · 今日第 <b>${S.fish}</b> 条`);
        UI.hideHint();
      }
    }
    S.fishFill = damp(S.fishFill, clamp(S.catchCount / 4, 0, 1), 1.6, dt);
    if (S.catchCount >= 4) S.catchCount = 0;
    state.fishFill = S.fishFill;
    state.fish = S.fish;
    state.dist = S.dist;
    state.kmh = S.speed * 3.6;
    state.cad = Math.abs(S.crank) * 60 / TAU;

    /* ---- world */
    World.update(dt, t, S.speed * dt, S);
    S.night = World.nightT;
    state.night = S.night;
    scene.fog.color.copy(World.fogC);
    scene.fog.density = World.seaU.uFogD.value;
    bike.setNight(S.night);
    bike.flagU.uTime.value = t;
    bike.flagU.uSpeed.value = S.speed / 6.9;
    bike.beamU.uTime.value = t;
    for (const f of bike.basketFish) {
      f.m.position.y = f.home.y + Math.sin(t * 3.1 + f.ph) * 0.012 * (0.3 + running);
      f.m.rotation.z = Math.sin(t * 2.2 + f.ph) * 0.16 * (0.2 + running);
    }
    FX.update(dt, t, S, camera.position);

    /* ---- camera director */
    const P0 = CAM_PRESETS[mode];
    let pTheta = P0.theta, pPhi = P0.phi, pDist = P0.dist, pFov = P0.fov;
    const pTgt = tmp.set(P0.tx, P0.ty, 0);
    if (P0.orbit) pTheta = t * P0.orbit + 1.1;
    if (P0.cine) { pTheta = -2.05 + Math.sin(t * 0.11) * 0.40; pDist = 8.2 + Math.sin(t * 0.07) * 1.5; }
    if (P0.head) { pTgt.copy(pelican.headG.getWorldPosition(new THREE.Vector3())); pTgt.x -= 0.08; }
    if (mode === 0) { pTgt.x += S.speed * 0.09; pTheta = -2.58 - S.steer * 0.11; }

    const L = P0.l;
    Cam.theta = damp(Cam.theta, pTheta, L, dt);
    Cam.phi = damp(Cam.phi, pPhi, L, dt);
    Cam.dist = damp(Cam.dist, pDist, L, dt);
    Cam.fov = damp(Cam.fov, pFov, L, dt);
    Cam.tgt.lerp(pTgt, 1 - Math.exp(-L * 0.9 * dt));

    const sh = reduced ? 0 : (P0.cine ? 1 : 0.45) * (0.35 + running * 0.65);
    const shx = Math.sin(t * 2.7) * 0.5 + Math.sin(t * 5.3) * 0.3;
    const shy = Math.cos(t * 3.1) * 0.5 + Math.cos(t * 6.7) * 0.25;
    const cp = Math.cos(Cam.phi);
    camera.position.set(
      Cam.tgt.x + Math.cos(Cam.theta) * cp * Cam.dist + shx * 0.013 * sh,
      Cam.tgt.y + Math.sin(Cam.phi) * Cam.dist + shy * 0.013 * sh,
      Cam.tgt.z + Math.sin(Cam.theta) * cp * Cam.dist + shy * 0.011 * sh);
    camera.lookAt(Cam.tgt.x + shx * 0.004, Cam.tgt.y + shy * 0.004, Cam.tgt.z);
    Cam.roll = damp(Cam.roll, (mode === 3 ? Math.sin(t * 0.23) * 0.026 : 0) + S.lean * 0.25, 2, dt);
    camera.rotateZ(Cam.roll);
    if (Math.abs(camera.fov - Cam.fov) > 0.01) { camera.fov = Cam.fov; camera.updateProjectionMatrix(); }
    World.sky.position.copy(camera.position);

    /* ---- post */
    const sp01 = clamp(S.speed / 6.9, 0, 1);
    const cu = post.mComp.uniforms;
    cu.uTime.value = t;
    cu.uSpeed.value = reduced ? 0 : sp01 * 0.9;
    cu.uBloom.value = 0.55 + S.night * 0.22;
    cu.uExposure.value = 1.02 + S.night * 0.34;
    cu.uVig.value = 0.50 + sp01 * 0.14;
    cu.uNight.value = S.night;
    cu.uSat.value = 1.10 - S.night * 0.12;
    cu.uPop.value = FX.pop;
    cu.uGrain.value = 0.024 + S.night * 0.006;

    /* ---- audio + hud */
    if (S.running) {
      Sound.ride(sp01, S.wind);
      creak += S.speed * dt * 0.75;
      if (creak > 1) { creak -= 1; if (running > 0.35) Sound.creak(); }
      Sound.pump();
    }
    if (fn % 6 === 0) UI.stats(state);

    post.render(scene, camera);

    /* ---- adaptive resolution */
    acc += dt; fn++;
    if (acc > 1.6) {
      const fps = fn / acc;
      acc = 0; fn = 0;
      if (fps < 42 && S.dprCap > 1) { S.dprCap = 1; resize(); }
      else if (fps < 32 && S.dprCap > 0.75) { S.dprCap = 0.75; resize(); }
    }
  }

  UI.pressed(UI.h.btnSound, true);
  requestAnimationFrame(frame);

  /* small live handle: handy for debugging and for the headless test harness */
  window.__PX = { THREE, frames: () => frames, S, state, World, bike, pelican, FX, Sound, renderer, scene, camera, post, pause: false, resize,
    api: { setCam, start, doCatch, pickCam: (i) => { setCam(i); UI.setCam(i); }, setDpr: (v) => { S.dprCap = v; resize(); } } };

  /* deep link: ?go=1&cam=0..4&phase=day|dusk|night&v=0..1  starts the ride immediately */
  const qp = new URLSearchParams(location.search);
  if (qp.has('go')) {
    if (qp.has('v')) { S.speedTarget = clamp(parseFloat(qp.get('v')) || 0, 0, 1) * 6.9; UI.setSpeed(S.speedTarget / 6.9); }
    start();
    if (qp.has('cam')) { const c = clamp(parseInt(qp.get('cam'), 10) || 0, 0, 4); setCam(c); UI.setCam(c); }
    const ph = qp.get('phase');
    if (ph && SKY[ph]) { World.setPhase(ph); if (ph === 'night') { World.phase = 'night'; World.phaseT = 1; World._blendSky(SKY.night, SKY.night, 1); } }
  }
}

main().catch((err) => {
  console.error(err);
  const m = document.getElementById('loadMsg');
  if (m) m.textContent = '初始化失败：' + (err && err.message ? err.message : err);
});
