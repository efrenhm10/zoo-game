// 3D world renderer (Three.js): terrain, habitats, buildings, animals, guests,
// keepers, the director avatar, weather, cameras, walk mode and map input.
// Simulation layout coordinates (1600×1000) map to world metres via K.
(function (ZG) {
  const T = THREE;
  const U = ZG.U;
  const Mo = ZG.Models;
  const R = (ZG.Render = {});
  const K = 0.25;
  const SW = 1600, SH = 1000;
  const toW = (x, y) => [(x - SW / 2) * K, (y - SH / 2) * K];
  const toS = (X, Z) => [X / K + SW / 2, Z / K + SH / 2];

  const st = {
    renderer: null, scene: null, camera: null, canvas: null, overlay: null,
    cam: { tx: 0, tz: 10, dist: 250, yaw: 0, pitch: 0.95 },
    walkCam: { yaw: 0, pitch: 0.32, dist: 9 },
    zooKey: '', habKeys: new Map(), habGroups: new Map(), plotGroups: new Map(), ponds: new Map(),
    animals: new Map(), guests: [], keepers: [], bubbles: [], fx: [],
    avatar: { x: 800, y: 950, heading: 0, moving: false, target: null, model: null, speed: 0 },
    walk: false, keys: {}, hover: null, selected: null, drag: null, time: 0,
    labels: new Map(), pools: {},
  };
  R.state = st;
  const rnd = Math.random;

  // ---------------------------------------------------------------------
  R.supported = function () {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      return false;
    }
  };

  R.init = function (canvas, overlay) {
    st.canvas = canvas;
    st.overlay = overlay;
    const r = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    r.outputEncoding = T.LinearEncoding; // colors are authored as display colors
    r.toneMapping = T.NoToneMapping;
    st.renderer = r;
    st.camera = new T.PerspectiveCamera(42, 1, 0.3, 3000);
    Mo.buildScenery();
    R.resize();
    window.addEventListener('resize', R.resize);
  };

  R.resize = function () {
    if (!st.renderer) return;
    const rect = st.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(200, rect.width), h = Math.max(200, rect.height);
    st.renderer.setSize(w, h, false);
    st.camera.aspect = w / h;
    st.camera.updateProjectionMatrix();
    st.w = w;
    st.h = h;
  };

  // ---------------------------------------------------------------------
  // Noise helpers
  // ---------------------------------------------------------------------
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;

  // ---------------------------------------------------------------------
  // Scene construction
  // ---------------------------------------------------------------------
  function buildScene(s) {
    const scene = new T.Scene();
    st.scene = scene;
    const Z = ZG.zoo(s);
    const sky = new T.Color(s.zooId === 'cheyenne' ? '#9cc6e8' : '#a9d3ef');
    scene.background = sky;
    scene.fog = new T.Fog(sky, 380, 1100);
    st.skyColor = sky.clone();
    // Sky dome gradient
    const skyGeo = new T.SphereGeometry(1500, 24, 12);
    const skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color('#5b9bd5') }, bottom: { value: new T.Color('#dcecf5') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bottom, top, clamp(h*1.8,0.0,1.0)),1.0); }',
    });
    st.skyMat = skyMat;
    scene.add(new T.Mesh(skyGeo, skyMat));

    st.hemi = new T.HemisphereLight('#e8f3ff', '#6b7a45', 0.62);
    scene.add(st.hemi);
    const sun = new T.DirectionalLight('#fff4e0', 0.95);
    sun.position.set(-160, 260, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -230;
    sc.right = 230;
    sc.top = 170;
    sc.bottom = -170;
    sc.near = 50;
    sc.far = 700;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.4;
    scene.add(sun);
    scene.add(sun.target);
    st.sun = sun;

    buildTerrain(s, scene, Z);
    buildPaths(s, scene, Z);
    buildEntrance(s, scene, Z);
    buildPeople(scene);
    // Weather particles
    const n = 2500;
    const rp = new Float32Array(n * 6);
    const rg = new T.BufferGeometry();
    rg.setAttribute('position', new T.BufferAttribute(rp, 3));
    st.rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: '#cfe0f5', transparent: true, opacity: 0.55 }));
    st.rain.frustumCulled = false;
    st.rain.visible = false;
    st.rainSeeds = Array.from({ length: n }, () => [rnd() * 240 - 120, rnd() * 80, rnd() * 240 - 120]);
    scene.add(st.rain);
    const sp = new Float32Array(n * 3);
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.BufferAttribute(sp, 3));
    st.snow = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 0.5, transparent: true, opacity: 0.9 }));
    st.snow.frustumCulled = false;
    st.snow.visible = false;
    scene.add(st.snow);
    // Selection ring
    st.selMat = new T.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.9 });
    st.hovMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 });
    st.habRoot = new T.Group();
    scene.add(st.habRoot);
  }

  function terrainHeight(X, Z, s) {
    const L = s.layout;
    const [x0, z0] = toW(L.xs[0] - 55, L.ys[0] - 60);
    const [x1, z1] = toW(L.xs[L.cols] + 55, SH + 10);
    const dx = Math.max(x0 - X, 0, X - x1), dz = Math.max(z0 - Z, 0, Z - z1);
    const d = Math.hypot(dx, dz);
    if (d <= 0) return 0;
    const t = Math.min(1, d / 40);
    let h = t * t * (fbm(X * 0.012, Z * 0.012, 3) * 14 - 2);
    // lakes beyond the zoo, like the island in the reference
    const lake = fbm(X * 0.004 + 10, Z * 0.004 - 4, 9);
    const far = Math.min(1, Math.max(0, (d - 70) / 120));
    h -= far * Math.max(0, lake - 0.35) * 60;
    return h;
  }

  function buildTerrain(s, scene, Z) {
    const size = 1400, seg = 160;
    const geo = new T.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const g1 = new T.Color(Z.theme.grass), g2 = new T.Color(Z.theme.grass2), sand = new T.Color('#cbbd8c'), dark = new T.Color('#3f6a33'), c = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i), Zc = pos.getZ(i);
      const h = terrainHeight(X, Zc, s);
      pos.setY(i, h);
      const n = fbm(X * 0.05, Zc * 0.05, 1);
      c.copy(g1).lerp(g2, n);
      if (h > 3) c.lerp(dark, Math.min(0.6, (h - 3) / 10));
      if (h < -0.6) c.copy(sand);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const ground = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }));
    ground.receiveShadow = true;
    scene.add(ground);
    // Water
    const water = new T.Mesh(new T.PlaneGeometry(3000, 3000), new T.MeshStandardMaterial({ color: Z.theme.water, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.6;
    scene.add(water);
    // Forest outside the perimeter & trees along paths
    const L = s.layout;
    const r0 = fbmSeed(s.seed);
    const kinds = treeKinds(s.zooId);
    const places = {};
    kinds.forEach((k) => (places[k] = []));
    for (let i = 0; i < 4200; i++) {
      const X = (r0() - 0.5) * 1300, Zc = (r0() - 0.5) * 1300;
      const h = terrainHeight(X, Zc, s);
      if (h < -0.4) continue;
      const [sx, sy] = toS(X, Zc);
      const inside = sx > L.xs[0] - 50 && sx < L.xs[L.cols] + 50 && sy > L.ys[0] - 55 && sy < SH + 5;
      if (inside) continue;
      if (fbm(X * 0.01, Zc * 0.01, 21) < 0.42 && r0() < 0.7) continue;
      places[kinds[Math.floor(r0() * kinds.length)]].push([X, h, Zc, 0.8 + r0() * 0.7, 'far']);
    }
    // Trees between plots inside the zoo
    for (let i = 0; i < 700; i++) {
      const sx = L.xs[0] - 45 + r0() * (L.xs[L.cols] - L.xs[0] + 90), sy = L.ys[0] - 50 + r0() * (SH - L.ys[0]);
      if (s.plots.some((p) => sx > p.x - 6 && sx < p.x + p.w + 6 && sy > p.y - 6 && sy < p.y + p.h + 6)) continue;
      if (L.xs.some((px) => Math.abs(px - sx) < L.P / 2 + 8) || L.ys.some((py) => Math.abs(py - sy) < L.P / 2 + 8)) continue;
      if (sy > L.ys[L.rows] && Math.abs(sx - L.entrance.x) < 170) continue;
      const [X, Zc] = toW(sx, sy);
      places[kinds[Math.floor(r0() * kinds.length)]].push([X, 0, Zc, 0.6 + r0() * 0.5]);
    }
    for (const k of kinds) {
      const far = places[k].filter((p) => p[4] === 'far');
      const near = places[k].filter((p) => p[4] !== 'far');
      addInstances(scene, Mo.scenery[k], near, true);
      const im = addInstances(scene, k === 'deciduous' ? Mo.scenery.deciduousLow : Mo.scenery[k], far.map((p) => [p[0], p[1], p[2], p[3]]), true);
      if (im) im.castShadow = false;
    }
    // Perimeter fence
    const [fx0, fz0] = toW(L.xs[0] - 50, L.ys[0] - 55);
    const [fx1, fz1] = toW(L.xs[L.cols] + 50, SH);
    const posts = [];
    const add = (a, b) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= len; t += 3) posts.push([a[0] + ((b[0] - a[0]) * t) / len, 0, a[1] + ((b[1] - a[1]) * t) / len, 1]);
    };
    add([fx0, fz0], [fx1, fz0]);
    add([fx1, fz0], [fx1, fz1]);
    add([fx0, fz1], [fx0, fz0]);
    const [ex] = toW(L.entrance.x, 0);
    add([fx0, fz1], [ex - 22, fz1]);
    add([ex + 22, fz1], [fx1, fz1]);
    const postGeo = new T.CylinderGeometry(0.08, 0.08, 2.2, 5);
    postGeo.translate(0, 1.1, 0);
    addInstances(scene, postGeo, posts, false, Mo.mat('#4d4a44'));
    const railMat = Mo.mat('#6b665c');
    const rail = (a, b) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (const y of [0.8, 2.0]) {
        const m = new T.Mesh(Mo.G.box, railMat);
        m.scale.set(len, 0.06, 0.06);
        m.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
        m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
        scene.add(m);
      }
    };
    rail([fx0, fz0], [fx1, fz0]);
    rail([fx1, fz0], [fx1, fz1]);
    rail([fx0, fz1], [fx0, fz0]);
    rail([fx0, fz1], [ex - 22, fz1]);
    rail([ex + 22, fz1], [fx1, fz1]);
  }
  function fbmSeed(seed) {
    let t = seed >>> 0 || 1;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function treeKinds(zooId) {
    return {
      honolulu: ['palm', 'palm', 'deciduous', 'bush'],
      sandiego: ['palm', 'deciduous', 'acacia', 'bush'],
      national: ['deciduous', 'deciduous', 'conifer', 'bush'],
      houston: ['deciduous', 'deciduous', 'conifer', 'bush'],
      cheyenne: ['conifer', 'conifer', 'conifer', 'deciduous', 'rock'],
    }[zooId] || ['deciduous', 'conifer'];
  }
  function addInstances(parent, geo, list, randRot, mat) {
    if (!list.length) return null;
    const im = new T.InstancedMesh(geo, mat || Mo.vcMat, list.length);
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
    list.forEach((p, i) => {
      e.set(0, randRot ? Math.random() * 6.28 : p[4] || 0, 0);
      q.setFromEuler(e);
      v.set(p[0], p[1], p[2]);
      sc.setScalar(p[3]);
      if (p[5]) sc.set(p[3], p[3] * p[5], p[3]);
      m.compose(v, q, sc);
      im.setMatrixAt(i, m);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  }

  function pathTexture(Z) {
    return Mo.canvasTex('path' + Z.theme.path, 128, 128, (g, w, h) => {
      g.fillStyle = Z.theme.path;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = `rgba(${90 + Math.random() * 60},${80 + Math.random() * 50},${60 + Math.random() * 40},${0.08 + Math.random() * 0.1})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3);
      }
      g.strokeStyle = 'rgba(120,100,70,0.25)';
      for (let y = 0; y < h; y += 16) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
        for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 16);
          g.stroke();
        }
      }
    });
  }

  function buildPaths(s, scene, Z) {
    const L = s.layout;
    const tex = pathTexture(Z);
    const edgeMat = Mo.mat('#8a7a5c');
    const add = (x0, y0, x1, y1, wpx) => {
      const [a, b] = toW(x0, y0), [c, d] = toW(x1, y1);
      const len = Math.hypot(c - a, d - b) + wpx * K;
      const w = wpx * K;
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(len / 6, w / 6);
      const m = new T.Mesh(new T.PlaneGeometry(len, w), new T.MeshStandardMaterial({ map: t, roughness: 0.95 }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(d - b, c - a);
      m.position.set((a + c) / 2, 0.04, (b + d) / 2);
      m.receiveShadow = true;
      scene.add(m);
      const e = new T.Mesh(new T.PlaneGeometry(len + 0.6, w + 0.6), edgeMat);
      e.rotation.copy(m.rotation);
      e.position.set(m.position.x, 0.025, m.position.z);
      e.receiveShadow = true;
      scene.add(e);
    };
    for (const x of L.xs) add(x, L.ys[0], x, L.ys[L.rows], L.P - 6);
    for (const y of L.ys) add(L.xs[0], y, L.xs[L.cols], y, L.P - 6);
    add(L.xs[3], L.ys[L.rows], L.entrance.x, SH, L.P - 6);
    // plaza
    const [px, pz] = toW(L.entrance.x, (L.ys[L.rows] + SH) / 2 + 8);
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(12, 5);
    const plaza = new T.Mesh(new T.PlaneGeometry(300 * K, (SH - L.ys[L.rows]) * K), new T.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(px, 0.045, pz);
    plaza.receiveShadow = true;
    scene.add(plaza);
    // benches & lamps along paths
    const lamps = [], benches = [];
    for (const x of L.xs)
      for (let j = 0; j < L.rows; j++) {
        const y = (L.ys[j] + L.ys[j + 1]) / 2;
        const [X, Zc] = toW(x + L.P / 2 - 3, y);
        lamps.push([X, 0, Zc, 1]);
        const [bx, bz] = toW(x - L.P / 2 + 3, y + 18);
        benches.push([bx, 0, bz, 1, Math.PI / 2]);
      }
    const lampGeo = Mo.merge([
      { geo: Mo.G.cyl, color: '#3b3b38', matrix: Mo.mtx(0, 1.8, 0, 0.06, 3.6, 0.06) },
      { geo: Mo.G.sphere, color: '#fff3c8', matrix: Mo.mtx(0, 3.7, 0, 0.22, 0.22, 0.22) },
    ]);
    addInstances(scene, lampGeo, lamps, false);
    const benchGeo = Mo.merge([
      { geo: Mo.G.box, color: '#8a5a32', matrix: Mo.mtx(0, 0.45, 0, 1.6, 0.08, 0.45) },
      { geo: Mo.G.box, color: '#8a5a32', matrix: Mo.mtx(0, 0.75, -0.2, 1.6, 0.4, 0.06) },
      { geo: Mo.G.box, color: '#333', matrix: Mo.mtx(-0.7, 0.22, 0, 0.06, 0.45, 0.4) },
      { geo: Mo.G.box, color: '#333', matrix: Mo.mtx(0.7, 0.22, 0, 0.06, 0.45, 0.4) },
    ]);
    addInstances(scene, benchGeo, benches, false);
  }

  function textTexture(text, bg, fg, w, h, font) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = font || `bold ${Math.round(h * 0.5)}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2, w - 20);
    const t = new T.CanvasTexture(c);
    return t;
  }

  function building(w, h, d, wall, roof, roofH) {
    const g = new T.Group();
    const b = Mo.mesh(Mo.G.box, Mo.mat(wall), [0, h / 2, 0], [w, h, d]);
    b.receiveShadow = true;
    g.add(b);
    const rh = Math.min(3.2, Math.max(roofH || 1.5, Math.min(w, d) * 0.22));
    const rg = new T.Group();
    rg.position.set(0, h + rh / 2, 0);
    rg.scale.set((w / 2 / 0.707) * 1.08, rh, (d / 2 / 0.707) * 1.08);
    rg.add(Mo.mesh(new T.ConeGeometry(1, 1, 4), Mo.mat(roof), null, null, [0, Math.PI / 4, 0]));
    g.add(rg);
    // windows
    for (let i = -1; i <= 1; i++) g.add(Mo.mesh(Mo.G.box, Mo.mat('#6fa4c7', { rough: 0.2 }), [(i * w) / 3.2, h * 0.55, d / 2 + 0.01], [w / 6, h * 0.35, 0.05]));
    return g;
  }

  function buildEntrance(s, scene, Z) {
    const L = s.layout;
    const [ex, ez] = toW(L.entrance.x, SH - 30);
    const g = new T.Group();
    g.position.set(ex, 0, ez);
    const stone = Mo.mat('#8a7560');
    for (const sx of [-1, 1]) {
      g.add(Mo.mesh(Mo.G.box, stone, [sx * 9, 3, 0], [1.6, 6, 1.6]));
      g.add(Mo.mesh(Mo.G.cone, Mo.mat('#5a3d28'), [sx * 9, 6.8, 0], [1.4, 1.6, 1.4]));
    }
    const signTex = textTexture(Z.name.toUpperCase(), '#6b4726', '#fff3d6', 1024, 128);
    const sign = new T.Mesh(new T.BoxGeometry(17, 1.8, 0.4), [Mo.mat('#5a3a1f'), Mo.mat('#5a3a1f'), Mo.mat('#5a3a1f'), Mo.mat('#5a3a1f'), new T.MeshStandardMaterial({ map: signTex }), new T.MeshStandardMaterial({ map: signTex })]);
    sign.position.set(0, 5.6, 0);
    sign.castShadow = true;
    g.add(sign);
    // ticket booths & gift shop
    const booth = building(3, 2.6, 2.4, '#f1e2c0', '#b5652b', 1.2);
    booth.position.set(-14, 0, 2);
    g.add(booth);
    const shop = building(9, 3.6, 6, '#f3d9a4', '#c0392b', 2);
    shop.position.set(20, 0, -2);
    g.add(shop);
    const shopSign = new T.Mesh(new T.PlaneGeometry(5, 1), new T.MeshStandardMaterial({ map: textTexture('GIFT SHOP', '#c0392b', '#fff', 512, 100) }));
    shopSign.position.set(20, 3.2, 1.05);
    g.add(shopSign);
    // flower planters
    const fl = [];
    for (let i = -3; i <= 3; i++) fl.push([i * 3.2, 0, 6, 0.8]);
    addInstances(g, Mo.scenery.bush, fl, true);
    flattenGroup(g);
    scene.add(g);
    // parking lot beyond gate
    const lot = new T.Mesh(new T.PlaneGeometry(120, 30), Mo.mat('#6f6f6a', { rough: 1 }));
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(ex, 0.03, ez + 30);
    lot.receiveShadow = true;
    scene.add(lot);
    const cars = [];
    const carGeo = Mo.merge([
      { geo: Mo.G.box, color: '#ffffff', matrix: Mo.mtx(0, 0.55, 0, 1.8, 0.7, 4) },
      { geo: Mo.G.box, color: '#ffffff', matrix: Mo.mtx(0, 1.15, -0.2, 1.6, 0.55, 2.2) },
    ]);
    const im = new T.InstancedMesh(carGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, flatShading: true }), 40);
    const m = new T.Matrix4(), cc = new T.Color();
    const carCols = ['#c0392b', '#2c3e50', '#ecf0f1', '#7f8c8d', '#2980b9', '#16a085', '#f1c40f', '#111'];
    for (let i = 0; i < 40; i++) {
      m.makeTranslation(ex - 55 + (i % 20) * 5.5, 0, ez + 22 + Math.floor(i / 20) * 12);
      im.setMatrixAt(i, m);
      im.setColorAt(i, cc.set(carCols[i % carCols.length]));
    }
    im.castShadow = true;
    st.cars = im;
    scene.add(im);
  }

  function buildPeople(scene) {
    const S = Mo.scenery;
    const N = 420;
    const mk = (geo) => {
      const im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ roughness: 0.8 }), N);
      im.instanceMatrix.setUsage(T.DynamicDrawUsage);
      im.castShadow = true;
      im.count = 0;
      im.frustumCulled = false;
      scene.add(im);
      return im;
    };
    st.pLegs = mk(S.personLegs);
    st.pBody = mk(S.personBody);
    st.pHead = mk(S.personHead);
    const c = new T.Color('#fff');
    for (let i = 0; i < N; i++) {
      st.pLegs.setColorAt(i, c);
      st.pBody.setColorAt(i, c);
      st.pHead.setColorAt(i, c);
    }
  }

  // ---------------------------------------------------------------------
  // Plots: habitats, buildings, lots
  // ---------------------------------------------------------------------
  function plotWorld(p) {
    const [cx, cz] = toW(p.x + p.w / 2, p.y + p.h / 2);
    return { cx, cz, w: p.w * K, d: p.h * K };
  }
  function pondFor(h, p) {
    const r = fbmSeed(h.seed);
    const water = ['aquatic', 'wetland', 'arctic'].includes(h.biome) ? 0.34 : 0.15;
    return { x: p.x + p.w * (0.3 + r() * 0.4), y: p.y + p.h * (0.35 + r() * 0.3), rx: p.w * water, ry: p.h * water * 0.75, rot: r() * 0.8 };
  }
  function inPond(pd, x, y, pad) {
    const dx = x - pd.x, dy = y - pd.y;
    const c = Math.cos(-pd.rot), sn = Math.sin(-pd.rot);
    const u = dx * c - dy * sn, v = dx * sn + dy * c;
    return (u * u) / Math.pow(pd.rx + (pad || 0), 2) + (v * v) / Math.pow(pd.ry + (pad || 0), 2) < 1;
  }
  function habHeight(h, p, x, y) {
    const r = fbmSeed(h.seed + 5);
    let z = 0;
    const amp = h.biome === 'mountain' ? 3.2 : h.biome === 'arctic' ? 1.6 : h.biome === 'savanna' ? 0.8 : 1.2;
    for (let i = 0; i < 4; i++) {
      const bx = p.x + p.w * (0.15 + r() * 0.7), by = p.y + p.h * (0.15 + r() * 0.7), rad = 20 + r() * 35;
      z += amp * (0.5 + r()) * Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (rad * rad));
    }
    const edge = Math.min(x - p.x, p.x + p.w - x, y - p.y, p.y + p.h - y);
    z *= U.clamp(edge / 18, 0, 1);
    const pd = st.ponds.get(h.id);
    if (pd && inPond(pd, x, y, 8)) z *= 0.2;
    return z;
  }
  R._habHeight = habHeight;

  function habitatKey(h) {
    return `${h.biome}|${h.construction ? 'c' : ''}${h.renovation ? 'r' : ''}|${Math.round(h.condition / 10)}|${Math.round(h.theming / 15)}|${h.climate}|${h.sponsor || ''}`;
  }

  function buildHabitat(s, p, h) {
    const g = new T.Group();
    const { cx, cz, w, d } = plotWorld(p);
    const B = ZG.BIOMES[h.biome];
    if (h.construction) return buildConstruction(p, h, g);
    const pd = pondFor(h, p);
    st.ponds.set(h.id, pd);
    // ground
    const segX = 28, segZ = 28;
    const geo = new T.PlaneGeometry(w, d, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const base = new T.Color(B.ground), dark = new T.Color(B.dark), mud = new T.Color('#6e5a3e'), worn = new T.Color('#8a7250'), c = new T.Color();
    const wear = U.clamp((70 - h.condition) / 70, 0, 1);
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i) + cx, Zc = pos.getZ(i) + cz;
      const [sx, sy] = toS(X, Zc);
      const y = habHeight(h, p, sx, sy);
      pos.setY(i, y + 0.08);
      c.copy(base).lerp(dark, fbm(sx * 0.05, sy * 0.05, h.seed % 100) * 0.8);
      if (inPond(pd, sx, sy, 5)) c.lerp(mud, 0.6);
      if (wear > 0) c.lerp(worn, wear * 0.6 * fbm(sx * 0.03, sy * 0.03, 4));
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const ground = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    ground.position.set(cx, 0, cz);
    ground.receiveShadow = true;
    g.add(ground);
    // pond
    const [px, pz] = toW(pd.x, pd.y);
    const water = new T.Mesh(new T.CircleGeometry(1, 28), new T.MeshStandardMaterial({ color: h.biome === 'arctic' ? '#8fd0ea' : ZG.zoo(s).theme.water, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.88 }));
    water.rotation.x = -Math.PI / 2;
    water.rotation.z = -pd.rot;
    water.scale.set(pd.rx * K, pd.ry * K, 1);
    water.position.set(px, 0.22, pz);
    water.receiveShadow = true;
    g.add(water);
    // scenery by biome
    const rr = fbmSeed(h.seed + 9);
    const kinds = {
      savanna: ['acacia', 'grass', 'grass', 'rock', 'bigRock', 'log'],
      forest: ['deciduous', 'deciduous', 'bush', 'bush', 'log', 'rock', 'grass'],
      tropical: ['palm', 'bush', 'bush', 'deciduous', 'rock', 'log', 'grass'],
      temperate: ['conifer', 'deciduous', 'bush', 'rock', 'log'],
      mountain: ['bigRock', 'bigRock', 'conifer', 'rock', 'rock'],
      wetland: ['grass', 'grass', 'bush', 'deciduous', 'log'],
      aquatic: ['rock', 'bigRock', 'rock', 'grass'],
      arctic: ['ice', 'ice', 'bigRock', 'rock'],
      australian: ['deciduous', 'grass', 'rock', 'log', 'bush'],
    }[h.biome];
    const places = {};
    const pandas = s.animals.some((a) => a.hab === h.id && (a.sp === 'giant_panda' || a.sp === 'red_panda'));
    const n = 16 + Math.round(h.theming / 3.5);
    for (let i = 0; i < n; i++) {
      const k = pandas && rr() < 0.3 ? 'bamboo' : kinds[Math.floor(rr() * kinds.length)];
      const sx = p.x + 14 + rr() * (p.w - 28), sy = p.y + 14 + rr() * (p.h - 28);
      if (inPond(pd, sx, sy, 6)) continue;
      const [X, Zc] = toW(sx, sy);
      (places[k] = places[k] || []).push([X, habHeight(h, p, sx, sy), Zc, (k === 'grass' ? 1.2 : 0.7) + rr() * 0.5]);
    }
    for (const k in places) addInstances(g, Mo.scenery[k], places[k], true);
    // barrier: posts + rails (wood → rusty as condition drops) or glass for dangerous animals
    const cond = h.condition;
    const fenceCol = cond > 70 ? '#6b4a2b' : cond > 45 ? '#8a6a3a' : '#8a4a32';
    const posts = [];
    const x0 = cx - w / 2 + 0.6, x1 = cx + w / 2 - 0.6, z0 = cz - d / 2 + 0.6, z1 = cz + d / 2 - 0.6;
    const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
    for (const [a, b, c2, d2] of edges) {
      const len = Math.hypot(c2 - a, d2 - b);
      for (let t = 0; t < len; t += 2.5) {
        if (cond < 40 && rr() < (40 - cond) / 120) continue;
        posts.push([a + ((c2 - a) * t) / len, 0, b + ((d2 - b) * t) / len, 1, 0, cond < 45 && rr() < 0.3 ? 0.7 : 1]);
      }
      for (const y of [0.55, 1.35]) {
        const rail = Mo.mesh(Mo.G.box, Mo.mat(fenceCol), [(a + c2) / 2, y, (b + d2) / 2], [len, 0.12, 0.12]);
        rail.rotation.y = -Math.atan2(d2 - b, c2 - a);
        g.add(rail);
      }
      // glass viewing panel on the path side
      const glass = Mo.mesh(Mo.G.box, Mo.mat('#bfe3f2', { opacity: 0.25, rough: 0.05 }), [(a + c2) / 2, 1.1, (b + d2) / 2], [len, 2.2, 0.05]);
      glass.rotation.y = -Math.atan2(d2 - b, c2 - a);
      glass.castShadow = false;
      g.add(glass);
    }
    const postGeo = new T.CylinderGeometry(0.12, 0.14, 1.8, 6);
    postGeo.translate(0, 0.9, 0);
    addInstances(g, postGeo, posts, false, Mo.mat(fenceCol));
    // climate-control building / glasshouse
    if (h.climate !== 'none') {
      const bx = x1 - 6, bz = z0 + 5;
      if (h.climate === 'heated') {
        const gh = new T.Group();
        gh.add(Mo.mesh(Mo.G.box, Mo.mat('#d9f0e6', { opacity: 0.35, rough: 0.05 }), [0, 2.5, 0], [9, 5, 7]));
        const frame = Mo.mat('#e8e8e2');
        for (let i = -2; i <= 2; i++) gh.add(Mo.mesh(Mo.G.box, frame, [i * 2.2, 2.5, 3.5], [0.12, 5, 0.12]));
        for (let i = -2; i <= 2; i++) gh.add(Mo.mesh(Mo.G.box, frame, [i * 2.2, 5.05, 0], [0.12, 0.12, 7]));
        gh.add(Mo.mesh(new T.CylinderGeometry(1, 1, 1, 4, 1, false, 0, Math.PI), Mo.mat('#d9f0e6', { opacity: 0.4, rough: 0.05, double: true }), [0, 5, 0], [4.5, 9, 3.5], [0, 0, Math.PI / 2]));
        gh.position.set(bx, 0, bz);
        g.add(gh);
      } else {
        const bld = building(9, 4, 7, '#e3f1f8', '#6aa6c8', 1.4);
        bld.position.set(bx, 0, bz);
        g.add(bld);
      }
    }
    // aviary net for condors
    if (s.animals.some((a) => a.hab === h.id && a.sp === 'california_condor')) {
      const net = Mo.mesh(new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: '#dfe6ea', wireframe: true, transparent: true, opacity: 0.35 }), [cx, 0, cz], [w / 2, 14, d / 2]);
      net.castShadow = false;
      g.add(net);
    }
    // viewing boardwalk on the path side (south edge)
    const bw = Mo.mesh(Mo.G.box, Mo.mat('#9a7048'), [cx, 0.25, z1 + 1.8], [8, 0.3, 2.5]);
    bw.receiveShadow = true;
    g.add(bw);
    // keeper holding barn (back corner)
    const barn = building(5, 3, 4, '#c9b79a', '#6b4a2b', 1.2);
    barn.position.set(x0 + 4, 0, z0 + 3.5);
    g.add(barn);
    if (h.renovation) {
      g.add(Mo.mesh(Mo.G.box, Mo.mat('#e0a526'), [cx, 0.6, cz], [w * 0.4, 1.2, 0.3]));
      addInstances(g, Mo.scenery.rock, [[cx - 4, 0, cz, 1.5], [cx + 3, 0, cz + 2, 1.2]], true);
    }
    return g;
  }

  function buildConstruction(p, h, g) {
    const { cx, cz, w, d } = plotWorld(p);
    const dirt = Mo.mesh(Mo.G.box, Mo.mat('#9b7a4e'), [cx, 0.05, cz], [w, 0.1, d]);
    dirt.receiveShadow = true;
    g.add(dirt);
    const orange = Mo.mat('#e8891a');
    for (let t = 0; t < 1; t += 0.04) {
      g.add(Mo.mesh(Mo.G.box, orange, [cx - w / 2 + w * t, 0.5, cz + d / 2 - 0.5], [1.2, 1, 0.1]));
      g.add(Mo.mesh(Mo.G.box, orange, [cx - w / 2 + w * t, 0.5, cz - d / 2 + 0.5], [1.2, 1, 0.1]));
    }
    // crane
    const crane = new T.Group();
    const yel = Mo.mat('#f2b705');
    crane.add(Mo.mesh(Mo.G.box, yel, [0, 11, 0], [0.8, 22, 0.8]));
    crane.add(Mo.mesh(Mo.G.box, yel, [5, 22, 0], [16, 0.6, 0.6]));
    crane.add(Mo.mesh(Mo.G.box, Mo.mat('#666'), [-2.5, 21.5, 0], [2, 1.5, 1.2]));
    crane.add(Mo.mesh(Mo.G.cyl, Mo.mat('#333'), [10, 16, 0], [0.04, 12, 0.04]));
    crane.add(Mo.mesh(Mo.G.box, Mo.mat('#8a8a8a'), [10, 9.8, 0], [1.5, 0.5, 1.5]));
    crane.position.set(cx - w * 0.2, 0, cz);
    g.add(crane);
    st.cranes = st.cranes || [];
    st.cranes.push(crane);
    // excavator & materials
    const ex = new T.Group();
    ex.add(Mo.mesh(Mo.G.box, Mo.mat('#333'), [0, 0.5, 0], [2.4, 0.8, 3.4]));
    ex.add(Mo.mesh(Mo.G.box, yel, [0, 1.6, 0], [2.2, 1.4, 2.2]));
    ex.add(Mo.mesh(Mo.G.box, yel, [0, 2.5, 2.2], [0.4, 0.4, 3.5], [-0.5, 0, 0]));
    ex.position.set(cx + w * 0.2, 0, cz + d * 0.15);
    g.add(ex);
    for (let i = 0; i < 4; i++) g.add(Mo.mesh(Mo.G.box, Mo.mat('#b8b2a4'), [cx + w * 0.25 - i * 1.3, 0.35, cz - d * 0.25], [1.1, 0.7, 2.4]));
    // partial concrete walls rising with progress
    const prog = 1 - h.construction.days / h.construction.total;
    g.add(Mo.mesh(Mo.G.box, Mo.mat('#bdbab2'), [cx, (prog * 3) / 2, cz - d * 0.1], [w * 0.5, prog * 3 + 0.01, 0.5]));
    return g;
  }

  function buildLot(p) {
    const g = new T.Group();
    const { cx, cz, w, d } = plotWorld(p);
    const lot = Mo.mesh(Mo.G.box, Mo.mat('#8fa860'), [cx, 0.03, cz], [w, 0.06, d]);
    lot.receiveShadow = true;
    g.add(lot);
    const grass = [];
    for (let i = 0; i < 40; i++) grass.push([cx + (Math.random() - 0.5) * w * 0.9, 0, cz + (Math.random() - 0.5) * d * 0.9, 1 + Math.random()]);
    addInstances(g, Mo.scenery.grass, grass, true);
    const sign = new T.Group();
    sign.add(Mo.mesh(Mo.G.box, Mo.mat('#6b4a2b'), [0, 1, 0], [0.15, 2, 0.15]));
    const board = new T.Mesh(new T.BoxGeometry(3, 1.4, 0.12), [Mo.mat('#8a5a32'), Mo.mat('#8a5a32'), Mo.mat('#8a5a32'), Mo.mat('#8a5a32'), new T.MeshStandardMaterial({ map: textTexture('AVAILABLE', '#f3e6c4', '#5a3a1f', 256, 110) }), Mo.mat('#8a5a32')]);
    board.position.y = 2.3;
    sign.add(board);
    sign.position.set(cx, 0, cz + d / 2 - 3);
    g.add(sign);
    // stakes
    const stakes = [];
    for (let t = 0; t < 1; t += 0.1) {
      stakes.push([cx - w / 2 + w * t, 0, cz - d / 2 + 1, 0.4]);
      stakes.push([cx - w / 2 + w * t, 0, cz + d / 2 - 1, 0.4]);
    }
    addInstances(g, new T.CylinderGeometry(0.1, 0.1, 1.5, 4).translate(0, 0.75, 0), stakes, false, Mo.mat('#e8891a'));
    return g;
  }

  function buildVet(p) {
    const g = new T.Group();
    const { cx, cz, w, d } = plotWorld(p);
    g.add(Mo.mesh(Mo.G.box, Mo.mat('#b9c7a3'), [cx, 0.03, cz], [w, 0.06, d]));
    const b = building(w * 0.6, 5, d * 0.35, '#eef0f0', '#7c8a96', 1.6);
    b.position.set(cx, 0, cz - d * 0.2);
    g.add(b);
    g.add(Mo.mesh(Mo.G.box, Mo.mat('#d63b3b'), [cx, 4, cz - d * 0.2 + d * 0.175 + 0.05], [1.4, 0.4, 0.05]));
    g.add(Mo.mesh(Mo.G.box, Mo.mat('#d63b3b'), [cx, 4, cz - d * 0.2 + d * 0.175 + 0.05], [0.4, 1.4, 0.05]));
    // quarantine pens
    for (let i = 0; i < 3; i++) {
      const px = cx - w * 0.33 + i * w * 0.33;
      const pen = Mo.mesh(Mo.G.box, Mo.mat('#a9b88f'), [px, 0.07, cz + d * 0.28], [w * 0.28, 0.05, d * 0.3]);
      pen.receiveShadow = true;
      g.add(pen);
      for (const sz of [-1, 1]) g.add(Mo.mesh(Mo.G.box, Mo.mat('#777'), [px, 0.8, cz + d * 0.28 + (sz * d * 0.3) / 2], [w * 0.28, 1.6, 0.06]));
    }
    return g;
  }

  function buildCafe(p) {
    const g = new T.Group();
    const { cx, cz, w, d } = plotWorld(p);
    const floor = Mo.mesh(Mo.G.box, Mo.mat('#e8dcc2'), [cx, 0.04, cz], [w, 0.08, d]);
    floor.receiveShadow = true;
    g.add(floor);
    const b = building(w * 0.55, 4, d * 0.3, '#f6e3b8', '#c0392b', 1.6);
    b.position.set(cx, 0, cz - d * 0.25);
    g.add(b);
    const sign = new T.Mesh(new T.PlaneGeometry(6, 1.1), new T.MeshStandardMaterial({ map: textTexture('FOOD COURT', '#c0392b', '#fff', 512, 100) }));
    sign.position.set(cx, 3.4, cz - d * 0.25 + d * 0.15 + 0.06);
    g.add(sign);
    const cols = ['#e74c3c', '#f1c40f', '#27ae60', '#3498db'];
    for (let i = 0; i < 10; i++) {
      const tx = cx - w * 0.38 + (i % 5) * (w * 0.19), tz = cz + d * 0.1 + Math.floor(i / 5) * d * 0.22;
      g.add(Mo.mesh(Mo.G.cyl, Mo.mat('#8a5a32'), [tx, 0.4, tz], [0.6, 0.08, 0.6]));
      g.add(Mo.mesh(Mo.G.cyl, Mo.mat('#666'), [tx, 1.3, tz], [0.04, 2.6, 0.04]));
      g.add(Mo.mesh(Mo.G.cone, Mo.mat(cols[i % 4]), [tx, 2.7, tz], [1.3, 0.6, 1.3]));
    }
    return g;
  }

  // Bake nested static groups into world-space meshes, then merge by material.
  function flattenGroup(group) {
    const meshes = [];
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh && !o.material.map && !o.material.transparent && o !== group && !Array.isArray(o.material)) meshes.push(o);
    });
    const byMat = new Map();
    for (const m of meshes) {
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(m);
    }
    const inv = new T.Matrix4().copy(group.matrixWorld).invert();
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const pos = [], nor = [], col = [];
      const hasCol = list.every((m) => m.geometry.attributes.color);
      if (list.some((m) => m.geometry.attributes.color) && !hasCol) continue;
      for (const m of list) {
        const mx = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld);
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(mx);
        if (!g.attributes.normal) g.computeVertexNormals();
        pos.push(...g.attributes.position.array);
        nor.push(...g.attributes.normal.array);
        if (hasCol) col.push(...g.attributes.color.array);
        m.parent.remove(m);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      if (hasCol) geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      const merged = new T.Mesh(geo, mat);
      merged.castShadow = true;
      merged.receiveShadow = true;
      group.add(merged);
    }
  }

  function syncPlots(s) {
    for (const p of s.plots) {
      const h = p.hab ? s.habitatsById[p.hab] : null;
      const key = p.kind === 'habitat' ? (h ? h.id + '|' + habitatKey(h) + '|' + (s.animals.some((a) => a.hab === h.id && a.sp === 'california_condor') ? 'n' : '') : 'lot') : p.kind;
      if (st.plotGroups.get(p.id) && st.plotGroups.get(p.id).key === key) continue;
      const old = st.plotGroups.get(p.id);
      if (old) {
        st.habRoot.remove(old.group);
        old.group.traverse((o) => {
          if (o.geometry && !Object.values(Mo.G).includes(o.geometry) && !Object.values(Mo.scenery).includes(o.geometry)) o.geometry.dispose();
        });
      }
      let group;
      if (p.kind === 'vet') group = buildVet(p);
      else if (p.kind === 'cafe') group = buildCafe(p);
      else if (!h) group = buildLot(p);
      else group = buildHabitat(s, p, h);
      flattenGroup(group);
      st.habRoot.add(group);
      st.plotGroups.set(p.id, { key, group });
    }
  }

  // ---------------------------------------------------------------------
  // Agents
  // ---------------------------------------------------------------------
  function animalBounds(s, a) {
    if (a.loc === 'quarantine') {
      const p = s.plots.find((x) => x.kind === 'vet');
      return { x: p.x + 14, y: p.y + p.h * 0.62, w: p.w - 28, h: p.h * 0.26, plot: p, q: true };
    }
    const h = s.habitatsById[a.hab];
    if (!h) return null;
    const p = s.plots[h.plot];
    return { x: p.x + 12, y: p.y + 12, w: p.w - 24, h: p.h - 24, plot: p, hab: h };
  }

  function pickTarget(s, a, ag) {
    const b = ag.b;
    const pd = b.hab ? st.ponds.get(b.hab.id) : null;
    const swims = Mo.swims(a.sp);
    for (let i = 0; i < 10; i++) {
      let x, y;
      if (pd && swims && rnd() < 0.45) {
        const ang = rnd() * 6.28, rr = Math.sqrt(rnd()) * 0.8;
        x = pd.x + Math.cos(ang) * pd.rx * rr;
        y = pd.y + Math.sin(ang) * pd.ry * rr;
      } else {
        x = U.clamp(ag.x + (rnd() - 0.5) * 90, b.x, b.x + b.w);
        y = U.clamp(ag.y + (rnd() - 0.5) * 70, b.y, b.y + b.h);
      }
      if (pd && !swims && inPond(pd, x, y, 4)) continue;
      ag.tx = x;
      ag.ty = y;
      return;
    }
  }

  function syncAnimals(s) {
    const seen = new Set();
    for (const a of s.animals) {
      const h = s.habitatsById[a.hab];
      if (a.loc === 'hab' && (!h || h.construction || h.renovation)) continue;
      const b = animalBounds(s, a);
      if (!b) continue;
      seen.add(a.id);
      let ag = st.animals.get(a.id);
      const baby = a.age < 365;
      if (ag && (ag.loc !== a.loc || ag.hab !== a.hab || ag.baby !== baby)) {
        st.scene.remove(ag.model.root);
        ag = null;
      }
      if (!ag) {
        const model = Mo.animal(a.sp, a.sex, baby);
        if (ZG.SPECIES[a.sp].size <= 18 || baby) model.root.traverse((o) => (o.castShadow = false));
        ag = { model, x: b.x + rnd() * b.w, y: b.y + rnd() * b.h, tx: 0, ty: 0, wait: rnd() * 4, heading: rnd() * 6.28, loc: a.loc, hab: a.hab, baby, b, speed: 0 };
        if (b.hab) {
          const pd = st.ponds.get(b.hab.id);
          for (let i = 0; i < 8 && pd && inPond(pd, ag.x, ag.y, 4) && !Mo.swims(a.sp); i++) {
            ag.x = b.x + rnd() * b.w;
            ag.y = b.y + rnd() * b.h;
          }
        }
        ag.tx = ag.x;
        ag.ty = ag.y;
        st.scene.add(model.root);
        st.animals.set(a.id, ag);
      }
      ag.b = b;
      ag.a = a;
    }
    for (const [id, ag] of st.animals)
      if (!seen.has(id)) {
        st.scene.remove(ag.model.root);
        st.animals.delete(id);
      }
  }

  const SLOW = ['galapagos_tortoise', 'aldabra_tortoise', 'sloth', 'koala', 'komodo', 'alligator'];
  function updateAnimals(s, dt, t) {
    for (const ag of st.animals.values()) {
      const a = ag.a;
      const sp = ZG.SPECIES[a.sp];
      const baseSpeed = (SLOW.includes(a.sp) ? 0.5 : sp.size > 28 ? 1.4 : 2) / K; // sim px/s
      let speed = 0;
      if (ag.wait > 0) ag.wait -= dt;
      else {
        const dx = ag.tx - ag.x, dy = ag.ty - ag.y, d = Math.hypot(dx, dy);
        if (d < 1.5) {
          ag.wait = 2 + rnd() * 8;
          pickTarget(s, a, ag);
        } else {
          const m = Math.min(d, baseSpeed * dt * (a.sick ? 0.4 : 1));
          ag.x += (dx / d) * m;
          ag.y += (dy / d) * m;
          const want = Math.atan2(dx, dy);
          let diff = want - ag.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ag.heading += diff * Math.min(1, dt * 4);
          speed = (m / dt) * K;
        }
      }
      const [X, Zc] = toW(ag.x, ag.y);
      let y = 0.08;
      let swimming = false;
      if (ag.b.hab) {
        y = habHeight(ag.b.hab, ag.b.plot, ag.x, ag.y) + 0.08;
        const pd = st.ponds.get(ag.b.hab.id);
        if (pd && inPond(pd, ag.x, ag.y, 0)) {
          swimming = true;
          const deep = ['flamingo', 'nene', 'asian_elephant'].includes(a.sp) ? 0.25 : 0.55;
          y = 0.25 - ag.model.height * deep * ag.model.root.scale.y;
        }
      }
      ag.model.root.visible = st.camera.position.distanceToSquared(_v.set(X, y, Zc)) < 330 * 330;
      ag.model.root.position.set(X, y, Zc);
      ag.model.root.rotation.y = ag.heading;
      Mo.animate(ag.model, dt, swimming ? speed * 0.5 : speed, t);
      ag.speed = speed;
    }
  }

  // Guests & keepers walk the path grid (sim coordinates)
  function nodePos(s, i, j) {
    return { x: s.layout.xs[i], y: s.layout.ys[j] };
  }
  function lRoute(s, from, to) {
    const pts = [];
    pts.push(rnd() < 0.5 ? nodePos(s, to.i, from.j) : nodePos(s, from.i, to.j));
    pts.push(nodePos(s, to.i, to.j));
    return pts;
  }
  function planGuest(s, g) {
    const habPlots = s.plots.filter((p) => p.kind === 'habitat' && p.hab);
    let target = null;
    if (habPlots.length) {
      const ws = habPlots.map((p) => 1 + ZG.Habitats.appeal(s, s.habitatsById[p.hab]));
      let tot = ws.reduce((a, b) => a + b, 0), x = rnd() * tot;
      for (let i = 0; i < habPlots.length; i++) {
        x -= ws[i];
        if (x <= 0) {
          target = habPlots[i];
          break;
        }
      }
    }
    if (rnd() < 0.12) target = s.plots.find((p) => p.kind === 'cafe');
    if (!target || g.visits > 4 + rnd() * 5 || g.leaving) {
      g.leaving = true;
      g.path = lRoute(s, g.node, { i: 3, j: s.layout.rows }).concat([{ x: s.layout.entrance.x + (rnd() - 0.5) * 40, y: SH + 30 }]);
      g.node = null;
      return;
    }
    const side = Math.floor(rnd() * 4);
    const { c, r } = target;
    const sides = [
      [{ i: c, j: r + 1 }, { i: c + 1, j: r + 1 }],
      [{ i: c, j: r }, { i: c + 1, j: r }],
      [{ i: c, j: r }, { i: c, j: r + 1 }],
      [{ i: c + 1, j: r }, { i: c + 1, j: r + 1 }],
    ][side];
    const A = sides[rnd() < 0.5 ? 0 : 1];
    const pa = nodePos(s, sides[0].i, sides[0].j), pb = nodePos(s, sides[1].i, sides[1].j);
    const tt = 0.2 + rnd() * 0.6;
    const toward = side === 0 ? -1 : side === 1 ? 1 : side === 2 ? 1 : -1;
    const off = (s.layout.P / 2 - 7) * toward;
    const vx = pa.x + (pb.x - pa.x) * tt + (side >= 2 ? off : 0), vy = pa.y + (pb.y - pa.y) * tt + (side < 2 ? off : 0);
    g.path = lRoute(s, g.node, A).concat([{ x: vx, y: vy, dwell: 3 + rnd() * 7, plot: target.id, face: side }, nodePos(s, A.i, A.j)]);
    g.node = A;
    g.visits++;
  }
  const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50', '#ff7eb6', '#7bed9f', '#ff6b35', '#5f27cd'];
  const SKINS = ['#f6d7c3', '#eac09a', '#d4a17a', '#b07a55', '#8a5a3c', '#5e3b26'];
  const PANTS = ['#2d3436', '#34495e', '#6d4c41', '#1e3799', '#636e72', '#b2bec3'];
  function spawnGuest(s) {
    const L = s.layout;
    const g = { x: L.entrance.x + (rnd() - 0.5) * 30, y: SH + 30, shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)], skin: SKINS[Math.floor(rnd() * SKINS.length)], pants: PANTS[Math.floor(rnd() * PANTS.length)], kid: rnd() < 0.28, speed: 4.5 + rnd() * 2.5, node: { i: 3, j: L.rows }, visits: 0, dwell: 0, lane: (rnd() - 0.5) * 22, heading: Math.PI, phase: rnd() * 6 };
    g.path = [{ x: L.xs[3] + g.lane, y: L.ys[L.rows] }];
    st.guests.push(g);
  }
  function stepWalker(g, dt) {
    if (g.dwell > 0) {
      g.dwell -= dt;
      g.moving = false;
      return;
    }
    const p = g.path[0];
    const tx = p.x + (p.dwell ? 0 : g.lane * 0.5), ty = p.y + (p.dwell ? 0 : g.lane * 0.5);
    const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy), m = (g.speed / K) * dt * 0.25;
    if (d <= m) {
      g.x = tx;
      g.y = ty;
      g.path.shift();
      if (p.dwell) {
        g.dwell = p.dwell;
        g.watch = p.plot;
        g.heading = [Math.PI, 0, Math.PI / 2, -Math.PI / 2][p.face] || 0;
      }
    } else {
      g.x += (dx / d) * m;
      g.y += (dy / d) * m;
      g.heading = Math.atan2(dx, dy);
      g.moving = true;
      g.phase += dt * 9;
    }
  }
  function updateGuests(s, dt) {
    const Z = ZG.zoo(s);
    const avgDay = Z.baseAttendance / 365;
    const target = s.closure ? 0 : Math.round(U.clamp((s.today.guests / avgDay) * 150, 0, 380));
    if (st.guests.length < target && rnd() < dt * 8) spawnGuest(s);
    if (st.guests.length > target + 10) for (const g of st.guests) if (!g.leaving && rnd() < 0.01) g.leaving = true;
    for (let k = st.guests.length - 1; k >= 0; k--) {
      const g = st.guests[k];
      if (!g.path.length && g.dwell <= 0) {
        if (g.node) planGuest(s, g);
        else {
          st.guests.splice(k, 1);
          continue;
        }
      }
      if (g.path.length || g.dwell > 0) stepWalker(g, dt);
    }
  }
  function updateKeepers(s, dt) {
    const want = Math.min(10, Math.round((s.staff.keepers.n / Math.max(1, s.req.keepers * ZG.Staff.load(s, 'keepers'))) * 6));
    while (st.keepers.length < want) st.keepers.push({ x: s.layout.xs[0], y: s.layout.ys[0], node: { i: 0, j: 0 }, path: [], speed: 5, shirt: '#2f6b3f', skin: SKINS[Math.floor(rnd() * 6)], pants: '#c8b27a', lane: 0, visits: 0, dwell: 0, keeper: true, heading: 0, phase: 0 });
    while (st.keepers.length > want) st.keepers.pop();
    for (const g of st.keepers) {
      if (!g.path.length && g.dwell <= 0) {
        g.visits = 0;
        g.leaving = false;
        planGuest(s, g);
        if (g.leaving || !g.node) {
          g.node = { i: Math.floor(rnd() * (s.layout.cols + 1)), j: Math.floor(rnd() * (s.layout.rows + 1)) };
          g.path = [nodePos(s, g.node.i, g.node.j)];
          g.leaving = false;
        }
      }
      stepWalker(g, dt);
    }
  }
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _v = new T.Vector3(), _s = new T.Vector3(), _e = new T.Euler(), _c = new T.Color();
  function drawPeople() {
    const all = st.guests.concat(st.keepers);
    const n = Math.min(all.length, 420);
    for (let i = 0; i < n; i++) {
      const g = all[i];
      const [X, Zc] = toW(g.x, g.y);
      const sc = g.kid ? 0.62 : 1;
      const bob = g.moving ? Math.abs(Math.sin(g.phase)) * 0.06 : 0;
      _e.set(0, g.heading, g.moving ? Math.sin(g.phase) * 0.05 : 0);
      _q.setFromEuler(_e);
      _v.set(X, bob, Zc);
      _s.set(sc, sc, sc);
      _m.compose(_v, _q, _s);
      st.pLegs.setMatrixAt(i, _m);
      st.pBody.setMatrixAt(i, _m);
      st.pHead.setMatrixAt(i, _m);
      st.pLegs.setColorAt(i, _c.set(g.pants));
      st.pBody.setColorAt(i, _c.set(g.shirt));
      st.pHead.setColorAt(i, _c.set(g.keeper ? '#c8b27a' : g.skin));
    }
    for (const im of [st.pLegs, st.pBody, st.pHead]) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------------
  // Avatar / walk mode
  // ---------------------------------------------------------------------
  function blocked(s, x, y) {
    const L = s.layout;
    if (x < L.xs[0] - 45 || x > L.xs[L.cols] + 45 || y < L.ys[0] - 50 || y > SH + 60) return true;
    for (const p of s.plots) if (x > p.x + 3 && x < p.x + p.w - 3 && y > p.y + 3 && y < p.y + p.h - 3) return true;
    return false;
  }
  R.setWalk = function (s, on) {
    st.walk = on;
    const a = st.avatar;
    if (on) {
      const L = s.layout;
      if (blocked(s, a.x, a.y) || a.x === 800) {
        a.x = L.entrance.x;
        a.y = L.ys[L.rows] + 25;
      }
      st.walkCam.yaw = 0;
      if (!a.model || a.lookKey !== JSON.stringify(s.director.look)) {
        if (a.model) st.scene.remove(a.model.root);
        a.model = Mo.avatar(s.director.look);
        a.lookKey = JSON.stringify(s.director.look);
        st.scene.add(a.model.root);
      }
      a.model.root.visible = true;
    } else if (a.model) a.model.root.visible = false;
  };
  R.nearbyPlot = function (s) {
    const a = st.avatar;
    let best = null, bd = 50;
    for (const p of s.plots) {
      const dx = Math.max(p.x - a.x, 0, a.x - (p.x + p.w));
      const dy = Math.max(p.y - a.y, 0, a.y - (p.y + p.h));
      const d = Math.hypot(dx, dy);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };
  function updateAvatar(s, dt) {
    const a = st.avatar;
    if (!a.model) return;
    const k = st.keys;
    let f = 0, r = 0;
    if (k.w || k.ArrowUp) f += 1;
    if (k.s || k.ArrowDown) f -= 1;
    if (k.d || k.ArrowRight) r += 1;
    if (k.a || k.ArrowLeft) r -= 1;
    const yaw = st.walkCam.yaw;
    let vx = 0, vz = 0;
    if (f || r) {
      a.target = null;
      // camera looks along -(sin yaw, cos yaw)
      vx = -Math.sin(yaw) * f + Math.cos(yaw) * r;
      vz = -Math.cos(yaw) * f - Math.sin(yaw) * r;
    } else if (a.target) {
      const dx = a.target.x - a.x, dy = a.target.y - a.y, d = Math.hypot(dx, dy);
      if (d < 2) a.target = null;
      else {
        vx = dx / d;
        vz = dy / d;
      }
    }
    const len = Math.hypot(vx, vz);
    const spd = k.Shift ? 9 : 4.6; // m/s
    a.speed = 0;
    if (len > 0) {
      const mx = ((vx / len) * spd * dt) / K, my = ((vz / len) * spd * dt) / K;
      let moved = false;
      if (!blocked(s, a.x + mx, a.y)) {
        a.x += mx;
        moved = true;
      }
      if (!blocked(s, a.x, a.y + my)) {
        a.y += my;
        moved = true;
      }
      if (!moved) a.target = null;
      const want = Math.atan2(vx, vz);
      let diff = want - a.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.heading += diff * Math.min(1, dt * 10);
      a.speed = spd;
    }
    const [X, Zc] = toW(a.x, a.y);
    a.model.root.position.set(X, 0.05, Zc);
    a.model.root.rotation.y = a.heading;
    Mo.animateAvatar(a.model, dt, a.speed);
  }

  // ---------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------
  function updateCamera(dt) {
    const cam = st.camera;
    if (st.walk && st.avatar.model) {
      const w = st.walkCam;
      const p = st.avatar.model.root.position;
      const tx = p.x, ty = p.y + 1.7, tz = p.z;
      const want = new T.Vector3(tx + Math.sin(w.yaw) * Math.cos(w.pitch) * w.dist, ty + Math.sin(w.pitch) * w.dist, tz + Math.cos(w.yaw) * Math.cos(w.pitch) * w.dist);
      cam.position.lerp(want, Math.min(1, dt * 8));
      cam.lookAt(tx, ty, tz);
    } else {
      const c = st.cam;
      c.pitch = U.clamp(c.pitch, 0.25, 1.45);
      c.dist = U.clamp(c.dist, 18, 520);
      c.tx = U.clamp(c.tx, -260, 260);
      c.tz = U.clamp(c.tz, -200, 220);
      const want = new T.Vector3(c.tx + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, Math.sin(c.pitch) * c.dist, c.tz + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist);
      cam.position.lerp(want, Math.min(1, dt * 10));
      cam.lookAt(c.tx, 0, c.tz);
    }
  }
  R.fitCamera = function () {
    Object.assign(st.cam, { tx: 0, tz: 10, dist: 300, yaw: 0, pitch: 0.95 });
  };
  R.focusPlot = function (s, pid) {
    const p = s.plots[pid];
    if (!p) return;
    const [X, Zc] = toW(p.x + p.w / 2, p.y + p.h / 2);
    Object.assign(st.cam, { tx: X, tz: Zc, dist: Math.min(st.cam.dist, 110) });
  };

  // ---------------------------------------------------------------------
  // Overlay labels (habitat signs, animal names, thoughts, fx)
  // ---------------------------------------------------------------------
  const _p = new T.Vector3();
  function project(x, y, z) {
    _p.set(x, y, z).project(st.camera);
    if (_p.z > 1 || _p.z < -1) return null;
    return [(_p.x * 0.5 + 0.5) * st.w, (-_p.y * 0.5 + 0.5) * st.h];
  }
  function pool(name, cls) {
    const p = (st.pools[name] = st.pools[name] || { els: [], used: 0 });
    return {
      get() {
        let e = p.els[p.used];
        if (!e) {
          e = document.createElement('div');
          e.className = cls;
          st.overlay.appendChild(e);
          p.els.push(e);
        }
        p.used++;
        e.style.display = '';
        return e;
      },
      begin() {
        p.used = 0;
      },
      end() {
        for (let i = p.used; i < p.els.length; i++) p.els[i].style.display = 'none';
      },
    };
  }
  function place(e, xy, html) {
    if (e._html !== html) {
      e.innerHTML = html;
      e._html = html;
    }
    e.style.transform = `translate(${xy[0]}px, ${xy[1]}px) translate(-50%, -100%)`;
  }
  function updateOverlay(s, dt) {
    const signs = pool('sign', 'lbl sign');
    const names = pool('name', 'lbl aname');
    const bubbles = pool('bub', 'lbl bubble');
    const fxp = pool('fx', 'lbl fx');
    signs.begin();
    names.begin();
    bubbles.begin();
    fxp.begin();
    const camPos = st.camera.position;
    // habitat signs
    for (const p of s.plots) {
      const h = p.hab ? s.habitatsById[p.hab] : null;
      let text = null;
      if (p.kind === 'vet') text = '🏥 Animal Hospital';
      else if (p.kind === 'cafe') text = '🍔 Food Court';
      else if (h) {
        const an = s.animals.filter((a) => a.hab === h.id && a.loc === 'hab');
        const sps = [...new Set(an.map((a) => a.sp))];
        text = `${h.construction ? '🏗️ ' : ''}${U.esc(h.sponsor ? h.sponsor + ' ' + h.name : h.name)}${sps.length ? `<small>${sps.map((x) => ZG.SPECIES[x].name).join(' · ')}</small>` : ''}`;
        if (h.construction) text += `<i class="prog"><b style="width:${Math.round((1 - h.construction.days / h.construction.total) * 100)}%"></b></i>`;
      } else text = '🪧 Available lot';
      const [X, Zc] = toW(p.x + p.w / 2, p.y + p.h);
      const dist = camPos.distanceTo(_v.set(X, 0, Zc));
      if (st.walk ? dist > 70 : dist > 420) continue;
      const xy = project(X, 3.2, Zc);
      if (!xy) continue;
      const e = signs.get();
      e.classList.toggle('sel', st.selected === p.id);
      place(e, xy, text);
    }
    // animal names when close
    for (const ag of st.animals.values()) {
      const pos = ag.model.root.position;
      const dist = camPos.distanceTo(pos);
      if (dist > (st.walk ? 26 : 45)) continue;
      const xy = project(pos.x, pos.y + ag.model.height * ag.model.root.scale.y + 0.5, pos.z);
      if (!xy) continue;
      const a = ag.a;
      place(names.get(), xy, `${U.esc(a.name)}${a.age < 365 ? ' 🍼' : ''}${a.sick ? ' 🤒' : ''}${a.star ? ' ⭐' : ''}`);
    }
    // avatar name
    if (st.walk && st.avatar.model) {
      const p = st.avatar.model.root.position;
      const xy = project(p.x, 2.5, p.z);
      if (xy) place(names.get(), xy, `<b>${U.esc(s.director.name)}</b>`);
      // thought bubbles from nearby guests
      if (rnd() < dt * 0.9) {
        const near = st.guests.filter((g) => Math.hypot(g.x - st.avatar.x, g.y - st.avatar.y) < 120);
        if (near.length) {
          const g = near[Math.floor(rnd() * near.length)];
          st.bubbles.push({ g, text: R.guestThought(s, g.watch != null ? g.watch : null), t: 0 });
          if (st.bubbles.length > 3) st.bubbles.shift();
        }
      }
    }
    for (let i = st.bubbles.length - 1; i >= 0; i--) {
      const b = st.bubbles[i];
      b.t += dt;
      if (b.t > 5 || !st.walk) {
        st.bubbles.splice(i, 1);
        continue;
      }
      const [X, Zc] = toW(b.g.x, b.g.y);
      const xy = project(X, 2.3, Zc);
      if (xy) {
        const e = bubbles.get();
        e.style.opacity = Math.min(1, (5 - b.t) * 2);
        place(e, xy, U.esc(b.text));
      }
    }
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const f = st.fx[i];
      f.t += dt;
      if (f.t > 3) {
        st.fx.splice(i, 1);
        continue;
      }
      const xy = project(f.x, 4 + f.t * 3, f.z);
      if (xy) {
        const e = fxp.get();
        e.style.opacity = 1 - f.t / 3;
        place(e, xy, f.icon);
      }
    }
    signs.end();
    names.end();
    bubbles.end();
    fxp.end();
  }

  // Guest thought bubbles reflect the actual simulation state.
  R.guestThought = function (s, plotId) {
    const Z = ZG.zoo(s);
    const opts = [];
    const add = (w, t) => opts.push([w, t]);
    const p = plotId != null ? s.plots[plotId] : null;
    const h = p && p.hab ? s.habitatsById[p.hab] : null;
    if (h) {
      const an = ZG.Animals.inHab(s, h.id);
      const sp = an.length ? ZG.SPECIES[an[0].sp] : null;
      if (!an.length) add(4, `Where are the animals in ${h.name}? 🤔`);
      if (an.some((a) => a.age < 365)) add(6, `Awww, a baby ${ZG.SPECIES[an.find((a) => a.age < 365).sp].name.toLowerCase()}! 😍`);
      if (h.condition < 45) add(4, `${h.name} looks really run-down 😕`);
      if (h.theming > 80) add(3, 'This habitat feels like the real wild! 🌿');
      if (sp && an.length) {
        const a = an[Math.floor(rnd() * an.length)];
        add(3, `Look! ${a.name} is ${a.mood}!`);
        if (a.welfare < 55) add(4, `That ${sp.name.toLowerCase()} seems stressed… 😟`);
        if (sp.appeal >= 9) add(2, `I came all this way to see the ${sp.name.toLowerCase()}s! 🤩`);
      }
    }
    if (!Z.priceLocked && s.policy.admission > Z.refs.admission * 1.2) add(3, `$${s.policy.admission} for tickets?! That's steep 💸`);
    if (Z.priceLocked) add(1, 'I love that this zoo is free! 🇺🇸');
    if (s.infra.visitor.cond < 45) add(3, 'Ugh, the restrooms are closed again 🚻');
    if (s.today.weather === 'heat') add(4, 'So hot… where is the shade? 🥵');
    if (s.today.weather === 'rain') add(3, 'At least the animals like the rain ☔');
    if (s.today.guests > (Z.baseAttendance / 365) * 2.3) add(3, 'It is SO crowded today 😩');
    if (ZG.Staff.ratio(s, 'guest') < 0.8) add(3, 'The food line took 40 minutes 🍔⏳');
    if (s.satisfaction > 80) add(2, 'Best zoo day ever! ⭐');
    add(1, 'Can we get ice cream? 🍦');
    add(1, 'Which way to the gift shop? 🎁');
    let tot = opts.reduce((a, o) => a + o[0], 0), x = rnd() * tot;
    for (const o of opts) {
      x -= o[0];
      if (x <= 0) return o[1];
    }
    return opts[0][1];
  };

  // ---------------------------------------------------------------------
  // Weather & lighting
  // ---------------------------------------------------------------------
  function updateWeather(s, dt) {
    const w = s.today.weather;
    const rainy = w === 'rain' || w === 'storm';
    st.rain.visible = rainy;
    st.snow.visible = w === 'snow';
    const center = st.walk && st.avatar.model ? st.avatar.model.root.position : new T.Vector3(st.cam.tx, 0, st.cam.tz);
    if (rainy) {
      const a = st.rain.geometry.attributes.position.array;
      for (let i = 0; i < st.rainSeeds.length; i++) {
        const sd = st.rainSeeds[i];
        sd[1] -= dt * 45;
        if (sd[1] < 0) sd[1] += 80;
        a[i * 6] = center.x + sd[0];
        a[i * 6 + 1] = sd[1];
        a[i * 6 + 2] = center.z + sd[2];
        a[i * 6 + 3] = center.x + sd[0] + 0.1;
        a[i * 6 + 4] = sd[1] - 1.2;
        a[i * 6 + 5] = center.z + sd[2];
      }
      st.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (w === 'snow') {
      const a = st.snow.geometry.attributes.position.array;
      for (let i = 0; i < st.rainSeeds.length; i++) {
        const sd = st.rainSeeds[i];
        sd[1] -= dt * 4;
        if (sd[1] < 0) sd[1] += 80;
        a[i * 3] = center.x + sd[0] + Math.sin(st.time + i) * 0.8;
        a[i * 3 + 1] = sd[1];
        a[i * 3 + 2] = center.z + sd[2];
      }
      st.snow.geometry.attributes.position.needsUpdate = true;
    }
    const target = { sun: 0.95, hemi: 0.62, fog: st.skyColor, top: '#5b9bd5', bottom: '#dcecf5' };
    if (rainy) Object.assign(target, { sun: w === 'storm' ? 0.25 : 0.45, hemi: 0.5, top: '#6f7f8e', bottom: '#b7c2cc' });
    if (w === 'snow') Object.assign(target, { sun: 0.55, hemi: 0.7, top: '#b9c6d2', bottom: '#eef2f5' });
    if (w === 'cloudy') Object.assign(target, { sun: 0.65, hemi: 0.66, top: '#8fb0cc', bottom: '#e0e8ee' });
    if (w === 'smoke') Object.assign(target, { sun: 0.45, hemi: 0.5, top: '#a08466', bottom: '#d8c0a0' });
    if (w === 'heat') Object.assign(target, { sun: 1.1, top: '#6aa7d8', bottom: '#f5e6c8' });
    const k = Math.min(1, dt * 1.5);
    st.sun.intensity += (target.sun - st.sun.intensity) * k;
    st.hemi.intensity += (target.hemi - st.hemi.intensity) * k;
    st.skyMat.uniforms.top.value.lerp(_c.set(target.top), k);
    st.skyMat.uniforms.bottom.value.lerp(_c.set(target.bottom), k);
    st.scene.fog.color.copy(st.skyMat.uniforms.bottom.value);
    st.scene.fog.near = w === 'smoke' ? 60 : rainy ? 200 : 380;
    st.scene.fog.far = w === 'smoke' ? 400 : rainy ? 800 : 1100;
    // shadow camera follows focus when walking for crisper shadows
    const f = st.walk && st.avatar.model ? st.avatar.model.root.position : new T.Vector3(0, 0, 10);
    st.sun.position.set(f.x - 160, 260, f.z + 120);
    st.sun.target.position.set(f.x, 0, f.z);
    const ext = st.walk ? 60 : 230;
    const sc = st.sun.shadow.camera;
    if (sc.right !== ext) {
      sc.left = -ext;
      sc.right = ext;
      sc.top = ext * 0.75;
      sc.bottom = -ext * 0.75;
      sc.updateProjectionMatrix();
    }
  }

  // ---------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------
  R.frame = function (s, dt) {
    if (!st.renderer || !s) return;
    const key = s.zooId + s.seed;
    if (key !== st.zooKey) {
      R.reset();
      buildScene(s);
      st.zooKey = key;
      R.fitCamera();
      st.camera.position.set(0, 400, 300);
    }
    st.time += dt;
    syncPlots(s);
    syncAnimals(s);
    updateAnimals(s, dt, st.time);
    updateGuests(s, dt);
    updateKeepers(s, dt);
    drawPeople();
    if (st.walk) updateAvatar(s, dt);
    if (st.cranes) for (const c of st.cranes) c.rotation.y += dt * 0.15;
    if (s._fx && s._fx.length) {
      for (const f of s._fx) {
        const h = s.habitatsById[f.hab];
        const p = h ? s.plots[h.plot] : null;
        if (p) {
          const [X, Zc] = toW(p.x + p.w / 2, p.y + p.h / 2);
          st.fx.push({ x: X, z: Zc, t: 0, icon: { birth: '🍼', death: '🕊️', open: '🎉' }[f.type] || '✨' });
        }
      }
      s._fx.length = 0;
    }
    // overview keyboard panning
    if (!st.walk) {
      const k = st.keys, c = st.cam, sp = c.dist * 0.9 * dt;
      let f = 0, r = 0;
      if (k.w || k.ArrowUp) f += 1;
      if (k.s || k.ArrowDown) f -= 1;
      if (k.d || k.ArrowRight) r += 1;
      if (k.a || k.ArrowLeft) r -= 1;
      c.tx += (-Math.sin(c.yaw) * f + Math.cos(c.yaw) * r) * sp;
      c.tz += (-Math.cos(c.yaw) * f - Math.sin(c.yaw) * r) * sp;
      if (k.q) c.yaw -= dt * 1.2;
      if (k.e) c.yaw += dt * 1.2;
    }
    updateCamera(dt);
    updateWeather(s, dt);
    updateSelection(s);
    st.renderer.render(st.scene, st.camera);
    updateOverlay(s, dt);
  };

  function updateSelection(s) {
    for (const [key, mat] of [['selected', st.selMat], ['hover', st.hovMat]]) {
      const pid = st[key];
      const holder = '_' + key + 'Ring';
      if (pid == null) {
        if (st[holder]) st[holder].visible = false;
        continue;
      }
      const p = s.plots[pid];
      if (!p) continue;
      if (!st[holder]) {
        st[holder] = new T.Mesh(new T.RingGeometry(0.985, 1, 4, 1), mat);
        st[holder].rotation.x = -Math.PI / 2;
        st.scene.add(st[holder]);
      }
      const r = st[holder];
      const { cx, cz, w, d } = plotWorld(p);
      r.geometry.dispose();
      r.geometry = rectRing(w + 2, d + 2, 0.7);
      r.position.set(cx, 0.35, cz);
      r.rotation.set(-Math.PI / 2, 0, 0);
      r.visible = !st.walk;
    }
  }
  function rectRing(w, d, t) {
    const shape = new T.Shape();
    shape.moveTo(-w / 2, -d / 2);
    shape.lineTo(w / 2, -d / 2);
    shape.lineTo(w / 2, d / 2);
    shape.lineTo(-w / 2, d / 2);
    shape.lineTo(-w / 2, -d / 2);
    const hole = new T.Path();
    hole.moveTo(-w / 2 + t, -d / 2 + t);
    hole.lineTo(-w / 2 + t, d / 2 - t);
    hole.lineTo(w / 2 - t, d / 2 - t);
    hole.lineTo(w / 2 - t, -d / 2 + t);
    hole.lineTo(-w / 2 + t, -d / 2 + t);
    shape.holes.push(hole);
    return new T.ShapeGeometry(shape);
  }

  R.reset = function () {
    if (st.scene) {
      st.scene.traverse((o) => {
        if (o.geometry && !Object.values(Mo.G).includes(o.geometry) && !Object.values(Mo.scenery).includes(o.geometry)) o.geometry.dispose();
      });
    }
    st.scene = null;
    st.zooKey = '';
    st.plotGroups.clear();
    st.ponds.clear();
    st.animals.clear();
    st.guests.length = 0;
    st.keepers.length = 0;
    st.fx.length = 0;
    st.bubbles.length = 0;
    st.cranes = [];
    st.selected = null;
    st.hover = null;
    st._selectedRing = null;
    st._hoverRing = null;
    st.avatar = { x: 800, y: 950, heading: Math.PI, moving: false, target: null, model: null, speed: 0 };
    st.walk = false;
    if (st.overlay) st.overlay.innerHTML = '';
    st.pools = {};
  };

  // ---------------------------------------------------------------------
  // Input (mouse/keyboard on the 3D view)
  // ---------------------------------------------------------------------
  const ray = new T.Raycaster();
  const ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
  R.pick = function (sx, sy) {
    const ndc = new T.Vector2((sx / st.w) * 2 - 1, -(sy / st.h) * 2 + 1);
    ray.setFromCamera(ndc, st.camera);
    const hit = new T.Vector3();
    if (!ray.ray.intersectPlane(ground, hit)) return null;
    const [x, y] = toS(hit.x, hit.z);
    return { x, y };
  };
  R.plotAt = (s, x, y) => s.plots.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) || null;

  R.bindInput = function (getState, cb) {
    const cv = st.canvas;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      st.drag = { x: e.clientX, y: e.clientY, btn: e.button, moved: false, shift: e.shiftKey };
    });
    cv.addEventListener('pointermove', (e) => {
      const s = getState();
      if (!s) return;
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (st.drag) {
        const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) st.drag.moved = true;
        st.drag.x = e.clientX;
        st.drag.y = e.clientY;
        if (st.walk) {
          st.walkCam.yaw -= dx * 0.006;
          st.walkCam.pitch = U.clamp(st.walkCam.pitch + dy * 0.004, 0.05, 1.2);
        } else if (st.drag.btn === 2 || st.drag.shift) {
          st.cam.yaw -= dx * 0.005;
          st.cam.pitch += dy * 0.004;
        } else {
          const k = st.cam.dist * 0.0022;
          const c = st.cam;
          c.tx += (-Math.cos(c.yaw) * dx - Math.sin(c.yaw) * dy) * k;
          c.tz += (Math.sin(c.yaw) * dx - Math.cos(c.yaw) * dy) * k;
        }
        cb.hover(null);
        return;
      }
      const w = R.pick(sx, sy);
      const p = w ? R.plotAt(s, w.x, w.y) : null;
      st.hover = p && !st.walk ? p.id : null;
      cb.hover(p, sx, sy);
    });
    cv.addEventListener('pointerup', (e) => {
      const s = getState();
      const d = st.drag;
      st.drag = null;
      if (!s || !d || d.moved || d.btn !== 0) return;
      const rect = cv.getBoundingClientRect();
      const w = R.pick(e.clientX - rect.left, e.clientY - rect.top);
      if (!w) return;
      const p = R.plotAt(s, w.x, w.y);
      if (st.walk) {
        if (p && R.nearbyPlot(s) === p) cb.observe(p);
        else st.avatar.target = { x: w.x, y: w.y };
        return;
      }
      if (p) cb.select(p);
    });
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
        if (st.walk) st.walkCam.dist = U.clamp(st.walkCam.dist * f, 3.5, 30);
        else st.cam.dist *= f;
      },
      { passive: false }
    );
  };
})((globalThis.ZG = globalThis.ZG || {}));
