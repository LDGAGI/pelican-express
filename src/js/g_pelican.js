/* ============================================================================
   G · PELICAN — lofted body, segmented S-neck, hinged bill with a sprung
   throat pouch, folded wings, webbed feet on the pedals, verlet scarf.
   ========================================================================== */

function buildPelican(scene) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const feather = rimPatch(new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.86 }), 0xffe4c0, 2.4, 0.40);
  const featherWarm = rimPatch(new THREE.MeshStandardMaterial({ color: 0xefe3cf, roughness: 0.88 }), 0xffd9a8, 2.6, 0.34);
  const beakMat = rimPatch(new THREE.MeshStandardMaterial({ color: 0xffa53d, roughness: 0.42 }), 0xfff0c0, 2.2, 0.55);
  const beakTip = rimPatch(new THREE.MeshStandardMaterial({ color: 0x5f6b52, roughness: 0.40 }), 0xdfe8c0, 2.4, 0.35);
  const pouchMat = rimPatch(new THREE.MeshStandardMaterial({ color: 0xf79a3c, roughness: 0.34 }), 0xffe3a8, 2.2, 0.34);
  const pouchInner = new THREE.MeshStandardMaterial({ color: 0xd95a34, roughness: 0.55, side: THREE.DoubleSide });
  const legMat = rimPatch(new THREE.MeshStandardMaterial({ color: 0xe0a463, roughness: 0.62 }), 0xffe0b0, 2.4, 0.30);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.12, metalness: 0.1 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xff6a45, roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b1f28, roughness: 0.08, metalness: 0.6 });
  const scarfMat = new THREE.MeshStandardMaterial({ color: 0x3fc9c0, roughness: 0.85, side: THREE.DoubleSide });

  const root = new THREE.Group();     // whole bird, positioned on the saddle
  scene.add(root);

  /* ---------------------------------------------------------- body */
  const profile = [
    [0.018, -0.310], [0.086, -0.268], [0.142, -0.214], [0.176, -0.150],
    [0.190, -0.072], [0.192, 0.000], [0.184, 0.062], [0.166, 0.116],
    [0.138, 0.162], [0.102, 0.202], [0.062, 0.234], [0.030, 0.256],
  ];
  const bodyPts = profile.map(([r, y]) => ({ p: V(y, 0, 0), rx: r, ry: r }));
  const body = new THREE.Mesh(loft(smoothSections(bodyPts, 30), 22), feather);
  body.rotation.z = -Math.PI / 2;   // long axis → +X
  body.scale.set(1, 1, 0.80);
  body.castShadow = true;
  root.add(body);

  /* tail */
  const tailGrp = new THREE.Group();
  tailGrp.position.set(-0.27, 0.045, 0);
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.008, 0.030), i < 5 ? feather : featherWarm);
    f.position.set(-0.10, -0.01, 0);
    f.rotation.z = 0.18 + i * 0.02;
    f.rotation.y = (i - 3) * 0.13;
    f.translateX(-0.10);
    tailGrp.add(f);
  }
  root.add(tailGrp);

  /* ------------------------------------------------------------ neck */
  const NECK_N = 11;
  const neckPts = [];
  const nodeGeo = new THREE.SphereGeometry(1, 12, 9);
  for (let i = 0; i < NECK_N; i++) {
    const t = i / (NECK_N - 1);
    const m = new THREE.Mesh(nodeGeo, i < 3 ? feather : featherWarm);
    m.scale.set(0.068 - 0.021 * t, 0.090, 0.060 - 0.018 * t);
    m.castShadow = true;
    root.add(m);
    neckPts.push({ m, t, r: 0.070 - 0.024 * t });
  }

  /* ------------------------------------------------------------ head */
  const headG = new THREE.Group();
  root.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.113, 20, 16), feather);
  head.scale.set(1.06, 0.98, 0.94);
  head.castShadow = true;
  headG.add(head);
  /* nape crest */
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.020, 0.10 + i * 0.012, 5), featherWarm);
    c.position.set(-0.06 - i * 0.012, 0.062 - i * 0.004, (i - 2) * 0.022);
    c.rotation.set(0, 0, 1.15 + i * 0.10);
    headG.add(c);
  }
  /* brow ridge */
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8), feather);
  brow.scale.set(1.3, 0.42, 1.15);
  brow.position.set(0.048, 0.060, 0);
  headG.add(brow);

  /* eyes */
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(0.032, 0.030, 0.076 * s);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0295, 14, 12), eyeMat);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x6fd0e0, roughness: 0.1, metalness: 0.2 }));
    iris.position.set(0.012, 0.004, 0.020 * s);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 8, 6), shineMat);
    hi.position.set(0.024, 0.014, 0.024 * s);
    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 6, 5), shineMat);
    hi2.position.set(0.020, -0.010, 0.026 * s);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0322, 14, 10, 0, TAU, 0, Math.PI * 0.52), feather);
    lid.position.copy(eg.position);
    lid.rotation.set(0, 0, -1.9);
    eg.add(ball, iris, hi, hi2);
    headG.add(eg, lid);
    eyes.push({ eg, lid, s, open: 1 });
  }

  /* headband */
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.0150, 8, 22), bandMat);
  band.rotation.y = Math.PI / 2;
  band.rotation.z = 0.20;
  band.position.set(-0.004, 0.058, 0);
  band.scale.set(1, 1, 0.98);
  headG.add(band);

  /* ------------------------------------------------------------ bill */
  const billPivot = new THREE.Group();       // upper mandible hinge
  billPivot.position.set(0.070, -0.012, 0);
  headG.add(billPivot);

  const upper = loft(smoothSections([
    { p: V(0.000, 0.000, 0), rx: 0.060, ry: 0.042 },
    { p: V(0.072, 0.005, 0), rx: 0.057, ry: 0.039 },
    { p: V(0.160, 0.003, 0), rx: 0.049, ry: 0.033 },
    { p: V(0.258, -0.005, 0), rx: 0.039, ry: 0.026 },
    { p: V(0.348, -0.018, 0), rx: 0.028, ry: 0.019 },
    { p: V(0.414, -0.036, 0), rx: 0.017, ry: 0.012 },
    { p: V(0.448, -0.052, 0), rx: 0.007, ry: 0.006 },
    { p: V(0.462, -0.068, 0), rx: 0.002, ry: 0.002 },
  ], 18), 14);
  const upperMesh = new THREE.Mesh(upper, beakMat);
  upperMesh.castShadow = true;
  billPivot.add(upperMesh);
  /* culmen ridge + tip */
  const tipMesh = new THREE.Mesh(new THREE.ConeGeometry(0.010, 0.042, 8), beakTip);
  tipMesh.position.set(0.452, -0.060, 0);
  tipMesh.rotation.z = -1.15;
  billPivot.add(tipMesh);
  /* gape: the dark mouth line along the underside of the upper mandible */
  const gape = new THREE.Mesh(new THREE.BoxGeometry(0.255, 0.006, 0.022), beakTip);
  gape.position.set(0.148, -0.024, 0);
  gape.rotation.z = -0.035;
  billPivot.add(gape);
  /* nostril */
  for (const s of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 5), beakTip);
    n.position.set(0.062, 0.024, 0.034 * s);
    n.scale.set(1.6, 0.7, 1);
    billPivot.add(n);
  }

  /* throat pouch (sprung) */
  const pouchPivot = new THREE.Group();
  pouchPivot.position.set(0.010, -0.022, 0);
  billPivot.add(pouchPivot);
  const pouch = new THREE.Mesh(loft(smoothSections([
    { p: V(0.040, -0.010, 0), rx: 0.056, ry: 0.022 },
    { p: V(0.018, -0.062, 0), rx: 0.090, ry: 0.056 },
    { p: V(-0.048, -0.104, 0), rx: 0.114, ry: 0.078 },
    { p: V(-0.132, -0.126, 0), rx: 0.108, ry: 0.074 },
    { p: V(-0.214, -0.124, 0), rx: 0.072, ry: 0.050 },
    { p: V(-0.278, -0.106, 0), rx: 0.024, ry: 0.020 },
  ], 20), 16), pouchMat);
  pouch.scale.set(1, 1, 0.86);
  pouch.castShadow = true;
  pouchPivot.add(pouch);
  const pouchIn = new THREE.Mesh(loft(smoothSections([
    { p: V(0.026, -0.026, 0), rx: 0.048, ry: 0.016 },
    { p: V(-0.026, -0.070, 0), rx: 0.076, ry: 0.040 },
    { p: V(-0.112, -0.100, 0), rx: 0.078, ry: 0.046 },
  ], 12), 10), pouchInner);
  pouchIn.scale.set(1, 1, 0.86);
  pouchPivot.add(pouchIn);
  /* fish visible inside the pouch */
  const pouchFish = new THREE.Mesh(fishGeo(0.17),
    new THREE.MeshStandardMaterial({ color: 0x59b7c9, roughness: 0.35, metalness: 0.25, side: THREE.DoubleSide }));
  pouchFish.position.set(-0.062, -0.062, 0);
  pouchFish.rotation.set(0, 0.3, -0.5);
  pouchFish.scale.setScalar(1.35);
  pouchFish.visible = false;
  pouchPivot.add(pouchFish);

  /* ------------------------------------------------------------ wings */
  const wings = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(0.10, 0.050, 0.140 * s);
    const cover = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 10), featherWarm);
    cover.scale.set(1.70, 0.36, 0.66);
    cover.position.set(-0.03, 0, 0);
    cover.castShadow = true;
    g.add(cover);
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.007, 0.026), i > 3 ? featherWarm : feather);
      f.position.set(-0.20, -0.012 - i * 0.004, -0.05 + i * 0.021);
      f.rotation.y = -0.10 - i * 0.05;
      f.rotation.z = 0.05;
      g.add(f);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), featherWarm);
    tip.scale.set(1.4, 0.5, 0.8);
    tip.position.set(-0.31, -0.030, 0.01);
    g.add(tip);
    root.add(g);
    wings.push({ g, s, base: 0 });
  }

  /* ---------------------------------------------------------- scarf */
  const SC = 9;
  const scarfRope = new Rope(SC, 0.042, { gravity: -6.2, damp: 0.955, stiff: 1 });
  const scarfGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(SC * 2 * 3), uv = new Float32Array(SC * 2 * 2), idx = [];
    for (let i = 0; i < SC; i++) {
      uv[(i * 2) * 2] = i / (SC - 1); uv[(i * 2) * 2 + 1] = 0;
      uv[(i * 2 + 1) * 2] = i / (SC - 1); uv[(i * 2 + 1) * 2 + 1] = 1;
    }
    for (let i = 0; i < SC - 1; i++) {
      const a = i * 2, b = a + 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    scarfGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scarfGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    scarfGeo.setIndex(idx);
  }
  const scarf = new THREE.Mesh(scarfGeo, scarfMat);
  scarf.frustumCulled = false;
  root.add(scarf);
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.019, 8, 14), scarfMat);
  knot.rotation.x = Math.PI / 2;
  knot.position.set(0.10, 0.135, 0);
  root.add(knot);

  /* ----------------------------------------------------------- legs */
  const legs = [];
  const footShape = new THREE.Shape();
  footShape.moveTo(0.095, 0.0);
  footShape.quadraticCurveTo(0.060, 0.062, -0.005, 0.055);
  footShape.quadraticCurveTo(-0.040, 0.050, -0.058, 0.026);
  footShape.quadraticCurveTo(-0.064, 0.0, -0.058, -0.026);
  footShape.quadraticCurveTo(-0.040, -0.050, -0.005, -0.055);
  footShape.quadraticCurveTo(0.060, -0.062, 0.095, 0.0);
  const footGeo = new THREE.ExtrudeGeometry(footShape, { depth: 0.013, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.005, bevelSegments: 2, curveSegments: 8 });
  footGeo.rotateX(-Math.PI / 2);
  footGeo.translate(0.02, 0, 0);
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 1, 9), legMat);
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 1, 9), legMat);
    const foot = new THREE.Mesh(footGeo, legMat);
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), legMat);
    thigh.castShadow = true; shank.castShadow = true; foot.castShadow = true;
    g.add(thigh, shank, foot, ankle);
    root.add(g);
    legs.push({ g, thigh, shank, foot, ankle, s });
  }

  /* ------------------------------------------------------ sunglasses */
  const shades = new THREE.Group();
  shades.position.set(0.086, 0.030, 0);
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0055, 6, 16), glassMat);
    rim.position.set(0, 0, 0.074 * s);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.033, 16), new THREE.MeshStandardMaterial({
      color: 0x141821, roughness: 0.05, metalness: 0.9,
    }));
    lens.position.set(0, 0, 0.074 * s);
    lens.rotation.y = s > 0 ? 0 : Math.PI;
    shades.add(rim, lens);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.005, 0.040), glassMat);
  shades.add(bridge);
  shades.visible = false;
  headG.add(shades);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  /* --------------------------------------------------------- state */
  const pouchSpring = new Spring(58, 7.5, 0);
  const pouchSpring2 = new Spring(70, 8.5, 0);
  const neckWave = new Spring(48, 8, 0);
  let blinkT = rand(1.5, 4);
  let headLookT = rand(3, 7);
  let headLook = 0, headLookTarget = 0;
  let wingT = rand(4, 9);
  let scarfInit = false;
  const scratch = new THREE.Vector3();
  const _nA = new THREE.Vector3(), _nB = new THREE.Vector3(), _nD = new THREE.Vector3();
  const _fwd = new THREE.Vector3(1, 0, 0);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const neckCurve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)]);

  return {
    root, headG, billPivot, pouchPivot, pouch, pouchFish, wings, legs, eyes,
    shades, scarfRope, scarf, knot, feathers: [feather, featherWarm, beakMat],

    /* place the whole bird on the saddle */
    mount(rig) {
      root.position.set(-0.19, 1.085, 0);
      rig.add(root);
    },

    update(dt, t, s) {
      /* ---- body: counter-bob + lean into the ride */
      const bob = Math.sin(s.crank * 2) * 0.011 * s.running + s.bob;
      root.position.y = 1.085 + bob;
      root.rotation.z = -0.05 * s.running - s.lean * 0.5 + Math.sin(s.crank * 2 + 1.1) * 0.016 * s.running;
      root.rotation.y = s.steer * 0.30 + Math.sin(t * 0.7) * 0.02;
      root.rotation.x = 0.03 * s.running;

      /* ---- neck: a travelling S, driven by cadence and head look */
      headLookT -= dt;
      if (headLookT < 0) { headLookTarget = rand(-0.55, 0.75); headLookT = rand(3.5, 8); }
      headLook = damp(headLook, headLookTarget, 1.1, dt);
      neckWave.step(Math.sin(t * 0.55) * 0.4 + s.running * Math.sin(s.crank) * 0.5, dt);

      const lean = root.rotation.z;
      const nA = _nA, nD = _nD;
      for (let i = 0; i < NECK_N; i++) {
        const u = i / (NECK_N - 1);
        const bend = Math.pow(u, 1.5);
        const sway = Math.sin(t * 1.6 - u * 3.1) * 0.014 * u * (0.4 + s.running);
        /* proper S: steep out of the shoulders, levelling off toward the head */
        nA.set(
          0.150 + u * 0.360 + neckWave.x * 0.034 * bend + headLook * 0.11 * bend,
          0.088 + Math.pow(u, 0.70) * 0.352 + neckWave.x * 0.020 * bend
            + Math.sin(t * 1.1 - u * 2) * 0.009 * u,
          sway * 3 + u * headLook * 0.075 + Math.sin(u * Math.PI) * 0.040 * (1 - u * 0.35));
        nA.applyAxisAngle(up, -lean * u * 0.55);
        neckPts[i].m.position.copy(nA);
      }
      for (let i = 0; i < NECK_N; i++) {
        const a = neckPts[i].m.position;
        if (i < NECK_N - 1) nD.subVectors(neckPts[i + 1].m.position, a);
        else nD.set(0.062, 0.048, 0);
        if (nD.lengthSq() < 1e-9) nD.set(1, 0, 0);
        nD.normalize();
        neckPts[i].m.quaternion.setFromUnitVectors(up, nD);
        const r = neckPts[i].r;
        neckPts[i].m.scale.set(r, r * 1.55, r * 0.90);
      }
      /* head rides at the top of the neck, bill roughly along the neck axis */
      const top = neckPts[NECK_N - 1].m.position;
      const below = neckPts[NECK_N - 3].m.position;
      headG.position.copy(top).add(_nB.set(0.062, 0.052, 0).applyQuaternion(neckPts[NECK_N - 1].m.quaternion));
      nD.subVectors(top, below);
      if (nD.lengthSq() < 1e-9) nD.set(1, 0.4, 0);
      nD.normalize();
      headG.quaternion.setFromUnitVectors(_fwd, nD);
      headG.rotateY(headLook * 0.9);
      headG.rotateZ(-0.40 + Math.sin(t * 1.35) * 0.03 * (0.3 + s.running) + s.lean * 0.4);
      headG.rotateX(Math.sin(t * 0.83) * 0.04);

      /* ---- bill: hinge, sprung pouch */
      const open = s.mouth;
      billPivot.rotation.z = -0.06 - open * 0.55 + Math.sin(t * 0.9) * 0.012;
      const target = -0.10 * s.wind - 0.16 * s.running - 0.9 * open + Math.sin(t * 2.3) * 0.05;
      pouchSpring.step(target, dt);
      pouchPivot.rotation.z = pouchSpring.x;
      const target2 = 0.55 * s.running + 0.35 * s.wind + 0.7 * open;
      pouchSpring2.step(target2, dt);
      const fill = clamp(s.fishFill, 0, 1);
      pouch.scale.set(1 + fill * 0.30, 1 + fill * 0.22 + pouchSpring2.x * 0.14, 0.86 + fill * 0.22);
      pouchIn.scale.copy(pouch.scale);
      pouchFish.visible = fill > 0.15;
      pouchFish.position.set(-0.06, -0.06 - fill * 0.02, 0);
      pouchFish.rotation.y = t * 0.6;

      /* ---- blink */
      blinkT -= dt;
      if (blinkT < 0) blinkT = rand(2.2, 5.5);
      const bl = clamp(1 - Math.abs(blinkT - 0.14) * 9, 0, 1);
      for (const e of eyes) {
        e.open = damp(e.open, 1 - bl, 22, dt);
        e.lid.rotation.z = lerp(-1.9, 0.35, e.open);
        e.eg.scale.setScalar(lerp(0.9, 1, e.open));
      }

      /* ---- wings: idle flutter + an occasional balancing stretch */
      wingT -= dt;
      if (wingT < 0) wingT = rand(5, 12);
      const stretch = clamp(1 - Math.abs(wingT - 0.5) * 1.1, 0, 1);
      for (const w of wings) {
        const flap = Math.sin(t * 2.1 + w.s) * 0.05 * (0.3 + s.running);
        const ext = stretch * (w.s > 0 ? 1 : 0.45);
        w.g.rotation.z = 0.10 + flap + ext * 0.55;
        w.g.rotation.y = w.s * (ext * 0.85 + Math.sin(t * 0.9) * 0.03);
        w.g.rotation.x = -0.05 - ext * 0.30;
        w.g.position.z = w.s * (0.140 + ext * 0.10);
      }

      /* ---- tail */
      tailGrp.rotation.z = Math.sin(t * 1.15) * 0.05 * (0.4 + s.running) - s.lean * 0.5;
      tailGrp.rotation.y = Math.sin(t * 0.8) * 0.06;

      /* ---- scarf (verlet ribbon) */
      const anchor = scratch.set(0.09, 0.145, 0.0);
      root.localToWorld(anchor);
      root.worldToLocal(anchor);
      if (!scarfInit) { scarfRope.place(anchor, V(0.35, -0.4, 0).normalize()); scarfInit = true; }
      const wind = new THREE.Vector3(
        -2.4 - s.speed * 1.5 + Math.sin(t * 3.1) * 0.9,
        Math.sin(t * 2.2) * 0.5 - 0.3,
        Math.sin(t * 1.7 + 1) * 0.8);
      scarfRope.step(Math.min(dt, 1 / 45), anchor, wind);
      const pa = scarfGeo.attributes.position;
      const side = new THREE.Vector3();
      for (let i = 0; i < SC; i++) {
        const p = scarfRope.p[i];
        const q2 = scarfRope.p[Math.min(i + 1, SC - 1)];
        side.set(-(q2.z - p.z), 0, q2.x - p.x);
        if (side.lengthSq() < 1e-8) side.set(0, 0, 1);
        side.normalize().multiplyScalar(0.040 * (1 - 0.35 * (i / (SC - 1))));
        pa.setXYZ(i * 2, p.x + side.x, p.y + side.y, p.z + side.z);
        pa.setXYZ(i * 2 + 1, p.x - side.x, p.y - side.y, p.z - side.z);
      }
      pa.needsUpdate = true;
      scarfGeo.computeVertexNormals();
    },

    /* two-bone IK from hip to pedal, knee forward */
    solveLeg(leg, hip, foot, thighL, shankL) {
      const u = scratch.copy(foot).sub(hip);
      let d = u.length();
      const maxD = (thighL + shankL) * 0.995, minD = Math.abs(thighL - shankL) * 1.02 + 0.02;
      d = clamp(d, minD, maxD);
      u.normalize();
      const a = (d * d + thighL * thighL - shankL * shankL) / (2 * d);
      const h = Math.sqrt(Math.max(0, thighL * thighL - a * a));
      const pole = new THREE.Vector3(1, 0.12, 0);
      const perp = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
      const knee = hip.clone().addScaledVector(u, a).addScaledVector(perp, h);
      leg.thigh.position.copy(hip).add(knee).multiplyScalar(0.5);
      leg.thigh.quaternion.setFromUnitVectors(up, scratch.copy(knee).sub(hip).normalize());
      leg.thigh.scale.set(1, hip.distanceTo(knee), 1);
      leg.shank.position.copy(knee).add(foot).multiplyScalar(0.5);
      leg.shank.quaternion.setFromUnitVectors(up, scratch.copy(foot).sub(knee).normalize());
      leg.shank.scale.set(1, knee.distanceTo(foot), 1);
      leg.ankle.position.copy(foot);
      const ang = Math.atan2(u.y, u.x);
      leg.foot.rotation.set(0, 0, -ang * 0.35);
      leg.foot.position.copy(foot).add(new THREE.Vector3(0, 0.028, 0));
    },
  };
}
