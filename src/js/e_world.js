/* ============================================================================
   E · WORLD — sky dome, ocean, coast, lighting, and the recycling scenery band
   ========================================================================== */

const SEA_PERIOD = 144;   // LCM of the Gerstner wavelengths (72/36/18/9/4.5)

const World = {
  movers: [],
  lamps: [],
  gulls: [],
  fishJump: [],
  _scroll: 0,

  /* ------------------------------------------------------------ textures */
  tex() {
    const T = {};
    T.road = canvasTex(512, 512, (g, w, h) => {
      noiseFill(g, w, h, { cell: 4, oct: 5, base: 0.42, amp: 0.20, seed: 11 });
      g.globalCompositeOperation = 'source-over';
      /* worn wheel tracks */
      const tr = g.createLinearGradient(0, 0, 0, h);
      tr.addColorStop(0.00, 'rgba(255,255,255,0.00)');
      tr.addColorStop(0.16, 'rgba(255,255,255,0.045)');
      tr.addColorStop(0.30, 'rgba(255,255,255,0.00)');
      tr.addColorStop(0.70, 'rgba(255,255,255,0.00)');
      tr.addColorStop(0.84, 'rgba(255,255,255,0.045)');
      tr.addColorStop(1.00, 'rgba(255,255,255,0.00)');
      g.fillStyle = tr; g.fillRect(0, 0, w, h);
      /* edge lines */
      g.fillStyle = 'rgba(238,238,230,0.82)';
      g.fillRect(0, h * 0.055, w, h * 0.022);
      g.fillRect(0, h * 0.923, w, h * 0.022);
      /* centre dashes: 3 m paint / 5 m gap over an 8 m tile */
      g.fillStyle = 'rgba(240,225,180,0.78)';
      g.fillRect(0, h * 0.489, w * (3 / 8), h * 0.022);
      /* aggregate speckle */
      for (let i = 0; i < 2600; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 1.6 + 0.3;
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    }, { rx: 52, ry: 1 });

    T.sand = canvasTex(256, 256, (g, w, h) => {
      noiseFill(g, w, h, { cell: 3, oct: 5, base: 0.80, amp: 0.16, seed: 23, tint: [1, 0.95, 0.82] });
      /* v = 0 is the waterline (wet, dark) → v = 1 is the road (dry, bright) */
      const gr = g.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0.00, 'rgba(90,74,58,0.10)');
      gr.addColorStop(0.22, 'rgba(120,98,74,0.22)');
      gr.addColorStop(0.45, 'rgba(190,160,120,0.10)');
      gr.addColorStop(1.00, 'rgba(255,246,225,0.34)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * w, y = h * Math.pow(Math.random(), 0.5), r = Math.random() * 1.1 + 0.2;
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.30})`;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    }, { rx: 40, ry: 1 });

    T.grass = canvasTex(256, 256, (g, w, h) => {
      noiseFill(g, w, h, { cell: 4, oct: 5, base: 0.55, amp: 0.30, seed: 41, tint: [0.72, 1.0, 0.62] });
      for (let i = 0; i < 5200; i++) {
        const x = Math.random() * w, y = Math.random() * h, l = Math.random() * 6 + 2;
        g.strokeStyle = `rgba(${120 + Math.random() * 90 | 0},${150 + Math.random() * 80 | 0},${80 + Math.random() * 50 | 0},${0.12 + Math.random() * 0.3})`;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - l); g.stroke();
      }
      /* v=0 far inland dark, v=1 near the road brighter */
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(24,44,30,0.55)');
      gr.addColorStop(0.55, 'rgba(40,60,36,0.12)');
      gr.addColorStop(1, 'rgba(120,110,66,0.30)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { rx: 46, ry: 1 });

    T.frond = canvasTex(256, 64, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2f6b34'); gr.addColorStop(0.5, '#59a444'); gr.addColorStop(1, '#2f6b34');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(20,48,24,0.55)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      g.lineWidth = 1.4; g.strokeStyle = 'rgba(22,54,28,0.35)';
      for (let i = 0; i < 40; i++) {
        const x = (i / 40) * w;
        g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + w / 44, 2); g.stroke();
        g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + w / 44, h - 2); g.stroke();
      }
    }, { rx: 1, ry: 1 });

    T.bark = canvasTex(64, 256, (g, w, h) => {
      noiseFill(g, w, h, { cell: 2, oct: 4, base: 0.42, amp: 0.22, seed: 77, tint: [1, 0.92, 0.78] });
      for (let i = 0; i < 70; i++) {
        const y = Math.random() * h;
        g.strokeStyle = `rgba(40,30,20,${0.10 + Math.random() * 0.22})`;
        g.lineWidth = 1 + Math.random() * 2.4;
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (Math.random() - 0.5) * 5); g.stroke();
      }
    }, { rx: 1, ry: 5 });

    T.stripe = canvasTex(128, 64, (g, w, h) => {
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? '#f3ece0' : '#ff6a45';
        g.fillRect((i / 10) * w, 0, w / 10 + 1, h);
      }
    }, { rx: 1, ry: 1 });

    T.flag = canvasTex(128, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#2ec4c9';
      g.beginPath();
      g.ellipse(w * 0.42, h * 0.5, w * 0.30, h * 0.26, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(w * 0.70, h * 0.5); g.lineTo(w * 0.97, h * 0.24);
      g.lineTo(w * 0.97, h * 0.76); g.closePath(); g.fill();
      g.fillStyle = '#0d3b45';
      g.beginPath(); g.arc(w * 0.33, h * 0.44, h * 0.045, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath(); g.arc(w * 0.35, h * 0.41, h * 0.018, 0, TAU); g.fill();
    }, { rx: 1, ry: 1 });
    T.flag.wrapS = T.flag.wrapT = THREE.ClampToEdgeWrapping;

    T.sail = canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#f6f1e4';
      g.beginPath();
      g.moveTo(w * 0.12, h * 0.96); g.lineTo(w * 0.12, h * 0.06);
      g.quadraticCurveTo(w * 0.74, h * 0.34, w * 0.95, h * 0.96);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,130,140,0.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(w * 0.12, h * 0.5); g.lineTo(w * 0.92, h * 0.5); g.stroke();
    }, { rx: 1, ry: 1 });

    T.lighthouse = canvasTex(64, 128, (g, w, h) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#f4efe4' : '#d9463c';
        g.fillRect(0, (i / 8) * h, w, h / 8 + 1);
      }
    }, { rx: 1, ry: 1 });
    return T;
  },

  /* -------------------------------------------------------------- props */
  frondGeo(len, wid) {
    const N = 11, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = t * len;
      const y = Math.sin(t * Math.PI * 0.9) * len * 0.14 - Math.pow(t, 2.3) * len * 0.46;
      const w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.7) * wid * (0.84 + 0.16 * Math.abs(Math.sin(t * Math.PI * 11)));
      pos.push(x, y, -w, x, y + w * 0.26, 0, x, y, w);
      uv.push(t, 0, t, 0.5, t, 1);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 3, b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  },

  palm(mat, barkMat, rnd) {
    const grp = new THREE.Group();
    const h = rand(4.2, 6.4, rnd);
    const lean = rand(-0.28, 0.28, rnd);
    const secs = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      secs.push({
        p: new THREE.Vector3(Math.pow(t, 1.7) * lean * h * 0.30, t * h, 0),
        rx: lerp(0.20, 0.11, t), ry: lerp(0.20, 0.11, t),
      });
    }
    const trunk = new THREE.Mesh(loft(smoothSections(secs, 16), 10), barkMat);
    trunk.castShadow = true;
    grp.add(trunk);

    const top = new THREE.Vector3(Math.pow(1, 1.7) * lean * h * 0.30, h, 0);
    const nF = 8;
    for (let i = 0; i < nF; i++) {
      const f = new THREE.Mesh(this.frondGeo(lerp(1.9, 2.9, rnd()), 0.30), mat);
      const a = (i / nF) * TAU + rnd(-0.16, 0.16);
      const droop = rand(0.30, 0.95);
      f.position.copy(top);
      f.rotation.order = 'YXZ';
      f.rotation.y = a;
      f.rotation.x = -rand(0.15, 0.62) + droop * 0.35;
      f.rotation.z = droop * 0.30;
      f.castShadow = true;
      grp.add(f);
    }
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), mat);
      c.position.copy(top).add(new THREE.Vector3(rand(-0.2, 0.2), -0.12, rand(-0.2, 0.2)));
      grp.add(c);
    }
    return grp;
  },

  umbrella(mat, poleMat) {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.52, 12, 1, true), mat);
    cone.position.y = 1.86; cone.castShadow = true;
    const pole = new THREE.Mesh(tubeGeo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.14, 0), 0.032), poleMat);
    g.add(cone, pole);
    return g;
  },

  rock(mat, rnd) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    sculpt(g, (v) => {
      const n = 0.30 * Math.sin(v.x * 3.1 + v.y * 2.3) * Math.cos(v.z * 2.7 - v.y * 1.9);
      return v.clone().multiplyScalar(n);
    });
    g.scale(rand(0.4, 1.5, rnd), rand(0.3, 1.0, rnd), rand(0.4, 1.4, rnd));
    g.rotateY(rnd(0, TAU, rnd));
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  },

  buoy(mat, topMat) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.30, 14, 10), mat);
    b.scale.y = 1.25; b.position.y = 0.16;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 10), topMat);
    t.position.y = 0.60;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), topMat);
    p.position.y = 0.95;
    g.add(b, t, p);
    g.userData.bob = rand(0, TAU);
    return g;
  },

  sailboat(mat, sailMat, rnd) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(loft(smoothSections([
      { p: new THREE.Vector3(-1.5, 0, 0), rx: 0.04, ry: 0.05 },
      { p: new THREE.Vector3(-0.7, 0.10, 0), rx: 0.30, ry: 0.26 },
      { p: new THREE.Vector3(0.5, 0.12, 0), rx: 0.34, ry: 0.30 },
      { p: new THREE.Vector3(1.5, 0.16, 0), rx: 0.05, ry: 0.07 },
    ], 12), 10), mat);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.6, 6), mat);
    mast.position.y = 1.4;
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.4), sailMat);
    sail.position.set(0.05, 1.42, 0.03);
    sail.material.side = THREE.DoubleSide;
    g.add(hull, mast, sail);
    g.rotation.y = rand(0, TAU, rnd);
    return g;
  },

  lampPost(metalMat, glassMat) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(tubeGeo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3.5, 0), 0.055, 0.042), metalMat);
    const arm = new THREE.Mesh(tubeGeo(new THREE.Vector3(0, 3.5, 0), new THREE.Vector3(-0.85, 3.78, 0), 0.042, 0.032), metalMat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 8), glassMat);
    head.position.set(-0.95, 3.70, 0);
    head.scale.set(1.25, 0.72, 1.0);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.18, 12), metalMat);
    hood.position.set(-0.95, 3.88, 0);
    g.add(pole, arm, head, hood);
    g.userData.glass = head;
    return g;
  },

  reflector(metalMat, reflMat) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.09), metalMat);
    p.position.y = 0.31;
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.10), reflMat);
    r.position.set(0, 0.52, 0.048);
    g.add(p, r);
    g.userData.r = r;
    return g;
  },

  gull(mat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(loft(smoothSections([
      { p: new THREE.Vector3(-0.24, 0, 0), rx: 0.02, ry: 0.02 },
      { p: new THREE.Vector3(0, 0.02, 0), rx: 0.07, ry: 0.07 },
      { p: new THREE.Vector3(0.24, 0, 0), rx: 0.02, ry: 0.02 },
    ], 8), 8), mat);
    const wing = new THREE.PlaneGeometry(0.62, 0.20, 3, 1);
    wing.translate(0.31, 0, 0);
    const wl = new THREE.Mesh(wing, mat), wr = new THREE.Mesh(wing, mat);
    wr.scale.z = -1;
    wl.position.set(0.02, 0.03, 0.06);
    wr.position.set(0.02, 0.03, -0.06);
    g.add(body, wl, wr);
    g.userData = { wl, wr, ph: rand(0, TAU), sp: rand(0.5, 1.1) };
    return g;
  },

  /* --------------------------------------------------------------- build */
  build(scene, renderer) {
    const T = this.tex();
    const rnd = mulberry(20261002);
    const rand = (a, b, r = Math.random) => a + r() * (b - a);

    scene.background = null;
    scene.fog = new THREE.FogExp2(0xcfe4ea, 0.0175);

    /* ---- sky dome */
    this.skyU = {
      uTop: { value: SKY.day.top.clone() }, uMid: { value: SKY.day.mid.clone() },
      uHor: { value: SKY.day.horizon.clone() }, uGround: { value: SKY.day.ground.clone() },
      uSunCol: { value: SKY.day.sun.clone() }, uSunDir: { value: SKY.day.sunDir.clone() },
      uTime: { value: 0 }, uStars: { value: 0 }, uSunSize: { value: SKY.day.sunSize },
      uMoon: { value: 0 }, uCloud: { value: 0.5 }, uFlash: { value: 0 },
    };
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.skyU,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 32), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    scene.add(this.sky);

    /* ---- lights */
    this.sun = new THREE.DirectionalLight(0xfff2d8, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -2.6; sc.right = 2.6; sc.top = 2.6; sc.bottom = -2.6; sc.near = 0.5; sc.far = 22;
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.022;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x9fc4e8, 0x6a5a44, 0.62);
    scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight(0x88b8e0, 0.42);
    this.fill.position.set(-1, 0.6, 1.2);
    scene.add(this.fill);

    /* ---- ocean */
    this.seaU = {
      uTime: { value: 0 }, uScroll: { value: 0 }, uDetail: { value: 1 },
      uSea: { value: SKY.day.sea.clone() }, uSeaDeep: { value: SKY.day.seaDeep.clone() },
      uSunCol: { value: SKY.day.sun.clone() }, uSunDir: { value: SKY.day.sunDir.clone() },
      uFogCol: { value: SKY.day.fog.clone() },
      uHor: { value: SKY.day.horizon.clone() }, uMid: { value: SKY.day.mid.clone() },
      uTop: { value: SKY.day.top.clone() },
      uFogD: { value: SKY.day.fogD }, uShoreZ: { value: W.shoreZ }, uNight: { value: 0 },
    };
    const seaMat = new THREE.ShaderMaterial({
      vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: this.seaU, fog: false,
    });
    this.seaUfar = { ...this.seaU, uDetail: { value: 0 } };
    const seaMatFar = new THREE.ShaderMaterial({
      vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: this.seaUfar, fog: false,
    });
    const near = new THREE.PlaneGeometry(400, 300, 250, 190);
    near.rotateX(-Math.PI / 2);
    this.seaNear = new THREE.Mesh(near, seaMat);
    this.seaNear.position.set(0, W.seaY, 154);
    this.seaNear.frustumCulled = false;
    const far = new THREE.PlaneGeometry(2400, 1200, 2, 2);
    far.rotateX(-Math.PI / 2);
    this.seaFar = new THREE.Mesh(far, seaMatFar);
    this.seaFar.position.set(0, W.seaY, 850);
    this.seaFar.frustumCulled = false;
    scene.add(this.seaNear, this.seaFar);

    /* ---- road, sand, grass */
    const strip = (len, z0, z1, segZ, hfn) => {
      const g = new THREE.PlaneGeometry(len, Math.abs(z1 - z0), 1, segZ);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, cz = (z0 + z1) / 2;
      for (let i = 0; i < p.count; i++) {
        const z = -p.getY(i) + cz;
        p.setZ(i, z);
        p.setY(i, hfn(z, p.getX(i)));
      }
      p.needsUpdate = true;
      g.computeVertexNormals();
      return g;
    };
    const duneH = (z, x) => {
      const d = Math.max(0, -z - 2.15);
      return 0.04 + 0.09 * smoothstep(0, 4, d) + 0.055 * d + 0.90 * smoothstep(14, 34, d)
        + 0.22 * Math.sin(x * 0.031 + d * 0.11) * smoothstep(3, 16, d)
        + 0.10 * Math.sin(x * 0.083 - d * 0.27) * smoothstep(6, 22, d);
    };
    const sandH = (z) => {
      const t = clamp((z - 2.15) / (9.8 - 2.15), 0, 1);
      return -0.98 * t * t * (3 - 2 * t) - 0.02;
    };

    const roadMat = new THREE.MeshStandardMaterial({
      map: T.road, roughness: 0.92, metalness: 0.0, color: 0xffffff,
    });
    T.road.repeat.set(52, 1);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(416, W.roadW), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.005;
    road.receiveShadow = true;
    road.frustumCulled = false;
    scene.add(road);
    this.roadTex = T.road;

    const sandMat = new THREE.MeshStandardMaterial({ map: T.sand, roughness: 1.0, metalness: 0 });
    T.sand.repeat.set(46, 1);
    const sand = new THREE.Mesh(strip(416, 2.15, 9.9, 28, sandH), sandMat);
    sand.receiveShadow = true; sand.frustumCulled = false;
    scene.add(sand);
    this.sandTex = T.sand;

    const grassMat = new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1.0, metalness: 0 });
    T.grass.repeat.set(46, 1);
    const grass = new THREE.Mesh(strip(416, -2.15, -46, 54, duneH), grassMat);
    grass.receiveShadow = true; grass.frustumCulled = false;
    scene.add(grass);
    this.grassTex = T.grass;

    /* dune grass blades (instanced, wind-swayed) */
    const blade = new THREE.PlaneGeometry(0.055, 0.52, 1, 3);
    blade.translate(0, 0.26, 0);
    const bladeMat = swayMaterial(new THREE.MeshStandardMaterial({
      color: 0x8fae5c, roughness: 1, side: THREE.DoubleSide,
    }), 0.52, 1.0);
    const N = 900;
    const im = new THREE.InstancedMesh(blade, bladeMat, N);
    im.frustumCulled = false;
    const bM4 = new THREE.Matrix4(), bQ = new THREE.Quaternion(), bS = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const x = rand(-70, 70), side = Math.random() < 0.68 ? -1 : 1;
      const d = 2.6 + Math.pow(Math.random(), 0.6) * 16;
      const z = side < 0 ? -d : 2.9 + Math.random() * 1.1;
      const y = side < 0 ? duneH(z, x) : sandH(z) + 0.01;
      bQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU));
      bS.set(rand(0.7, 1.5), rand(0.7, 1.9), 1);
      bM4.compose(new THREE.Vector3(x, y, z), bQ, bS);
      im.setMatrixAt(i, bM4);
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    this.bladeMat = bladeMat;

    /* ---- shared prop materials */
    const M = {
      frond: new THREE.MeshStandardMaterial({ map: T.frond, roughness: 0.86, side: THREE.DoubleSide }),
      bark: new THREE.MeshStandardMaterial({ map: T.bark, roughness: 0.95 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x8b8477, roughness: 0.95, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.42, metalness: 0.75 }),
      pole: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xfff0cf, emissive: 0xffc46a, emissiveIntensity: 0, roughness: 0.3 }),
      refl: new THREE.MeshStandardMaterial({ color: 0xffb257, emissive: 0xff8a2a, emissiveIntensity: 0.15, roughness: 0.4 }),
      hull: new THREE.MeshStandardMaterial({ color: 0xf2ede0, roughness: 0.6 }),
      buoy: new THREE.MeshStandardMaterial({ color: 0xff6a45, roughness: 0.55 }),
      buoyTop: new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.55 }),
      sail: new THREE.MeshStandardMaterial({ map: T.sail, transparent: true, side: THREE.DoubleSide, roughness: 0.9 }),
      stripe: new THREE.MeshStandardMaterial({ map: T.stripe, roughness: 0.8, side: THREE.DoubleSide }),
      lh: new THREE.MeshStandardMaterial({ map: T.lighthouse, roughness: 0.8 }),
      gull: new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 0.7, side: THREE.DoubleSide }),
    };
    this.M = M;
    this.T = T;
    this.lampGlow = new THREE.PointLight(0xffb867, 0, 9, 2);
    scene.add(this.lampGlow);

    /* ---- scenery band (everything here recycles) */
    const band = new THREE.Group();
    scene.add(band);
    this.band = band;
    const span = W.span, wrapX = W.wrapFar;
    const add = (obj, x, par = 1) => {
      obj.position.x = x;
      band.add(obj);
      this.movers.push({ o: obj, par, span });
      return obj;
    };
    /* n props laid out evenly across exactly one recycling period */
    const at = (i, n) => -wrapX + ((i + 0.5) / n) * span;

    for (let i = 0; i < 9; i++) {
      const p = this.palm(M.frond, M.bark, rnd);
      const x = at(i, 9);
      p.position.set(x, duneH(-7 - rnd(0, 12), x), -6.2 - rnd(0, 7));
      p.rotation.y = rnd(0, TAU);
      p.scale.setScalar(rand(0.85, 1.25));
      add(p, x);
    }
    for (let i = 0; i < 5; i++) {
      const u = this.umbrella(M.stripe, M.pole);
      const x = at(i, 5);
      u.position.set(x, sandH(6.6), 5.2 + rnd(0, 1.4));
      u.rotation.y = rnd(0, TAU);
      add(u, x);
    }
    for (let i = 0; i < 16; i++) {
      const r = this.rock(M.rock, rnd);
      const x = at(i, 16);
      const onLand = Math.random() < 0.55;
      const z = onLand ? -3.4 - rnd(0, 5) : 3.0 + rnd(0, 3.6);
      const y = onLand ? duneH(z, x) : sandH(z);
      r.position.set(x, y + 0.12, z);
      add(r, x);
    }
    for (let i = 0; i < 7; i++) {
      const b = this.buoy(M.buoy, M.buoyTop);
      const x = at(i, 7);
      b.position.set(x, W.seaY, 10 + rnd(0, 22));
      add(b, x);
    }
    for (let i = 0; i < 4; i++) {
      const s = this.sailboat(M.hull, M.sail, rnd);
      const x = at(i, 4);
      s.position.set(x, W.seaY - 0.16, 30 + rnd(0, 44));
      add(s, x);
    }
    for (let i = 0; i < 8; i++) {
      const l = this.lampPost(M.metal, M.glass);
      const x = at(i, 8);
      l.position.set(x, 0, -2.85);
      l.rotation.y = 0;
      add(l, x);
      this.lamps.push(l);
    }
    for (let i = 0; i < 40; i++) {
      const x = at(i, 40);
      const r = this.reflector(M.pole, M.refl);
      r.position.set(x, 0, W.roadW / 2 + 0.45);
      r.rotation.y = Math.PI;
      add(r, x);
      const r2 = this.reflector(M.pole, M.refl);
      r2.position.set(x, 0, -(W.roadW / 2 + 0.45));
      add(r2, x);
    }

    /* landmark lighthouse: slow parallax, long loop */
    const lh = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.6, 15, 18, 1, true), M.lh);
    tower.position.y = 7.5;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 1.1, 18), M.metal);
    cap.position.y = 15.4;
    const lampM = new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.3 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), lampM);
    bulb.position.y = 16.2;
    const rockB = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 7.0, 2.2, 14), M.rock);
    rockB.position.y = -0.6;
    lh.add(tower, cap, bulb, rockB);
    lh.position.set(96, W.seaY, 132);
    band.add(lh);
    this.movers.push({ o: lh, par: 0.30, span: 620 });
    this.lighthouseLamp = lampM;
    this.lighthouse = lh;

    /* gulls */
    for (let i = 0; i < 7; i++) {
      const g = this.gull(M.gull);
      g.userData.home = new THREE.Vector3(rand(-40, 40), rand(4.5, 15), rand(6, 40));
      g.userData.rad = rand(6, 20);
      g.userData.spd = rand(0.12, 0.30) * (Math.random() < 0.5 ? 1 : -1);
      g.userData.ph = rand(0, TAU);
      scene.add(g);
      this.gulls.push(g);
    }

    this.phase = 'day';
    this.ambC = new THREE.Color();
    this.fogC = new THREE.Color();
    this._blendSky(SKY.day, SKY.day, 1);
    this.phaseTarget = 'day';
    this.phaseT = 1;
    this.from = null;
    this.flashT = -1;
    return this;
  },

  _blendSky(a, b, t) {
    const u = this.skyU, s = this.seaU;
    u.uTop.value.copy(a.top).lerp(b.top, t);
    u.uMid.value.copy(a.mid).lerp(b.mid, t);
    u.uHor.value.copy(a.horizon).lerp(b.horizon, t);
    u.uGround.value.copy(a.ground).lerp(b.ground, t);
    u.uSunCol.value.copy(a.sun).lerp(b.sun, t);
    u.uSunDir.value.copy(a.sunDir).lerp(b.sunDir, t).normalize();
    s.uSea.value.copy(a.sea).lerp(b.sea, t);
    s.uSeaDeep.value.copy(a.seaDeep).lerp(b.seaDeep, t);
    s.uSunCol.value.copy(u.uSunCol.value);
    s.uSunDir.value.copy(u.uSunDir.value);
    s.uFogCol.value.copy(a.fog).lerp(b.fog, t);
    s.uHor.value.copy(u.uHor.value);
    s.uMid.value.copy(u.uMid.value);
    s.uTop.value.copy(u.uTop.value);
    s.uFogD.value = lerp(a.fogD, b.fogD, t);
    u.uSunSize.value = lerp(a.sunSize, b.sunSize, t);
    u.uStars.value = lerp(a.starA, b.starA, t);
    u.uMoon.value = b === SKY.night ? t : 0;
    this.sunI = lerp(a.sunI, b.sunI, t);
    this.ambI = lerp(a.ambI, b.ambI, t);
    this.ambC.copy(a.ambC).lerp(b.ambC, t);
    this.fogC.copy(a.fog).lerp(b.fog, t);
    this.nightT = lerp(a.starA, b.starA, t);
  },

  setPhase(name) {
    if (name === this.phaseTarget) return;
    this.from = this.phaseTarget;
    this.phaseTarget = name;
    this.phaseT = 0;
  },
  cyclePhase() {
    const order = ['day', 'dusk', 'night'];
    this.setPhase(order[(order.indexOf(this.phaseTarget) + 1) % 3]);
  },

  update(dt, t, dist, state) {
    /* day / night cross-fade */
    if (this.phaseT < 1) {
      this.phaseT = Math.min(1, this.phaseT + dt / 2.2);
      this._blendSky(SKY[this.from], SKY[this.phaseTarget], easeInOut(this.phaseT));
      if (this.phaseT >= 1) this.phase = this.phaseTarget;
    }

    /* lightning: rare, dusk only, paired with a low rumble */
    if (this.phaseTarget === 'dusk' && this.phase === 'dusk' && this.flashT < 0 && Math.random() < dt / 42) {
      this.flashT = 0;
    }
    let flash = 0;
    if (this.flashT >= 0) {
      this.flashT += dt;
      const f = this.flashT;
      flash = Math.max(0, 1 - f * 3.2) * (f < 0.06 ? 1 : Math.max(0, 0.55 - Math.abs(f - 0.18) * 4));
      if (f > 0.6) { this.flashT = -1; flash = 0; if (this.onThunder) this.onThunder(); }
    }
    this.skyU.uFlash.value = flash;

    /* scroll */
    this._scroll = (this._scroll + dist) % SEA_PERIOD;
    this.seaU.uScroll.value = this._scroll;
    this.seaUfar.uScroll.value = this._scroll;
    this.seaU.uTime.value = t; this.seaUfar.uTime.value = t;
    this.seaU.uNight.value = this.nightT;
    this.seaUfar.uNight.value = this.nightT;
    this.skyU.uTime.value = t;

    const dsc = -(dist % 65536);
    this.roadTex.offset.x = dsc / 8;
    this.sandTex.offset.x = dsc / (416 / 46);
    this.grassTex.offset.x = dsc / (416 / 46);

    for (const m of this.movers) {
      m.o.position.x -= dist * m.par;
      if (m.o.position.x < -W.wrapFar - 10) m.o.position.x += m.span;
    }

    /* lights follow the (static) bike, and the sun tracks the sky */
    this.sun.position.copy(this.skyU.uSunDir.value).multiplyScalar(11).add(new THREE.Vector3(0, 0, 0));
    this.sun.target.position.set(0, 0.6, 0);
    this.sun.color.copy(this.skyU.uSunCol.value);
    this.sun.intensity = this.sunI;
    this.hemi.intensity = this.ambI;
    this.hemi.color.copy(this.ambC);
    this.hemi.groundColor.copy(this.fogC).multiplyScalar(0.55);
    this.fill.intensity = 0.18 + this.nightT * 0.25;
    this.fill.color.copy(this.ambC);

    /* lamps + lighthouse come alive after dusk */
    const lampOn = smoothstep(0.10, 0.65, this.nightT);
    this.M.glass.emissiveIntensity = lampOn * 2.0;
    this.M.refl.emissiveIntensity = 0.12 + lampOn * 1.4;
    this.lighthouseLamp.emissiveIntensity = lampOn * 3.0 + 0.15;
    this.lighthouseLamp.emissiveIntensity *= 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 0.9)), 12);
    this.lampGlow.intensity = lampOn * 1.1;
    if (lampOn > 0.02) {
      const l = this.lamps.reduce((b, o) => (Math.abs(o.position.x) < Math.abs(b.position.x) ? o : b), this.lamps[0]);
      this.lampGlow.position.copy(l.userData.glass.getWorldPosition(new THREE.Vector3()));
    }

    /* gulls */
    for (const g of this.gulls) {
      const a = t * g.userData.spd + g.userData.ph;
      g.position.set(
        g.userData.home.x + Math.cos(a) * g.userData.rad,
        g.userData.home.y + Math.sin(a * 1.7) * 1.1,
        g.userData.home.z + Math.sin(a) * g.userData.rad * 0.7);
      g.rotation.y = -a + (g.userData.spd > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.rotation.z = 0.25 * g.userData.spd * Math.sign(g.userData.spd);
      const f = Math.sin(t * 7.5 * g.userData.sp + g.userData.ph);
      g.userData.wl.rotation.x = f * 0.55;
      g.userData.wr.rotation.x = -f * 0.55;
    }

    this.bladeMat.userData.uTime.value = t;
    this.bladeMat.userData.uWind.value = 0.6 + state.wind * 1.6;
  },
};
