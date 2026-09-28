// Procedural low-poly 3D models: animals (every species), people, the director
// avatar, trees, rocks and props. Everything is built from primitives at runtime.
(function (ZG) {
  const T = THREE;
  const M = (ZG.Models = {});
  const U = ZG.U;

  // ---------------------------------------------------------------------
  // Materials & textures
  // ---------------------------------------------------------------------
  const matCache = new Map();
  M.mat = function (color, o) {
    o = o || {};
    const key = color + '|' + (o.map ? o.map.uuid : '') + '|' + (o.rough || 0.85) + '|' + (o.opacity || 1) + '|' + (o.emissive || '') + '|' + (o.smooth ? 1 : 0);
    if (matCache.has(key)) return matCache.get(key);
    const m = new T.MeshStandardMaterial({
      color: o.map ? 0xffffff : color,
      map: o.map || null,
      roughness: o.rough != null ? o.rough : 0.85,
      metalness: o.metal || 0,
      flatShading: !o.smooth,
      transparent: (o.opacity || 1) < 1,
      opacity: o.opacity || 1,
      emissive: o.emissive || 0x000000,
      side: o.double ? T.DoubleSide : T.FrontSide,
    });
    matCache.set(key, m);
    return m;
  };
  M.vcMat = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });

  const texCache = new Map();
  function canvasTex(key, w, h, draw, repeat) {
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 4;
    texCache.set(key, t);
    return t;
  }
  M.canvasTex = canvasTex;
  let seedN = 1;
  const rnd = () => {
    seedN = (seedN * 16807) % 2147483647;
    return (seedN - 1) / 2147483646;
  };

  M.tex = {
    stripes: (base, stripe, n) =>
      canvasTex(`str${base}${stripe}${n}`, 256, 128, (g, w, h) => {
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);
        g.fillStyle = stripe;
        for (let i = 0; i < n; i++) {
          const x = (i / n) * w;
          g.beginPath();
          g.moveTo(x, 0);
          for (let y = 0; y <= h; y += 8) g.lineTo(x + Math.sin(y * 0.09 + i) * 5 + (w / n) * 0.18, y);
          for (let y = h; y >= 0; y -= 8) g.lineTo(x + Math.sin(y * 0.09 + i) * 5 - (w / n) * 0.18 + (w / n) * 0.35 * (0.6 + 0.4 * Math.sin(y * 0.05)), y);
          g.fill();
        }
      }),
    spots: (base, spot, rosette) =>
      canvasTex(`spt${base}${spot}${rosette}`, 256, 128, (g, w, h) => {
        seedN = 7;
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 220; i++) {
          const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 3.5;
          g.fillStyle = spot;
          if (rosette) {
            g.strokeStyle = spot;
            g.lineWidth = 2;
            g.beginPath();
            g.arc(x, y, r + 1.5, 0, Math.PI * 2);
            g.stroke();
          } else {
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
          }
        }
      }),
    patches: (base, line) =>
      canvasTex(`pat${base}${line}`, 256, 128, (g, w, h) => {
        seedN = 3;
        g.fillStyle = line;
        g.fillRect(0, 0, w, h);
        g.fillStyle = base;
        for (let y = 0; y < h; y += 22)
          for (let x = (y / 22) % 2 ? 11 : 0; x < w; x += 24) {
            g.beginPath();
            const cx = x + rnd() * 4, cy = y + rnd() * 4;
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * Math.PI * 2, r = 8 + rnd() * 3;
              g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
            g.fill();
          }
      }),
    rings: (a, b, n) =>
      canvasTex(`rng${a}${b}${n}`, 32, 128, (g, w, h) => {
        for (let i = 0; i < n * 2; i++) {
          g.fillStyle = i % 2 ? b : a;
          g.fillRect(0, (i / (n * 2)) * h, w, h / (n * 2) + 1);
        }
      }),
    wildDog: () =>
      canvasTex('wilddog', 256, 128, (g, w, h) => {
        seedN = 11;
        g.fillStyle = '#6a5436';
        g.fillRect(0, 0, w, h);
        const cols = ['#d9c08a', '#1f1a14', '#f2ead8', '#8a6a3a'];
        for (let i = 0; i < 90; i++) {
          g.fillStyle = cols[Math.floor(rnd() * cols.length)];
          g.beginPath();
          g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 12, 4 + rnd() * 8, rnd() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }),
  };

  // ---------------------------------------------------------------------
  // Geometry helpers
  // ---------------------------------------------------------------------
  const G = {
    sphere: new T.SphereGeometry(1, 14, 10),
    lowSphere: new T.IcosahedronGeometry(1, 1),
    cyl: new T.CylinderGeometry(1, 1, 1, 8),
    taper: new T.CylinderGeometry(0.6, 1, 1, 8),
    cone: new T.ConeGeometry(1, 1, 8),
    box: new T.BoxGeometry(1, 1, 1),
  };
  M.G = G;

  function mesh(geo, mat, p, s, r) {
    const m = new T.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (s) m.scale.set(s[0], s[1], s[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    m.castShadow = true;
    return m;
  }
  M.mesh = mesh;

  // Merge several (geometry, color, matrix) parts into one vertex-colored geometry.
  M.merge = function (parts) {
    const pos = [], nor = [], col = [];
    const c = new T.Color();
    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      if (p.matrix) g.applyMatrix4(p.matrix);
      if (!g.attributes.normal) g.computeVertexNormals();
      const a = g.attributes.position.array, n = g.attributes.normal.array;
      c.set(p.color);
      for (let i = 0; i < a.length; i += 3) {
        pos.push(a[i], a[i + 1], a[i + 2]);
        nor.push(n[i], n[i + 1], n[i + 2]);
        const j = p.jitter ? 1 + (Math.random() - 0.5) * p.jitter : 1;
        col.push(c.r * j, c.g * j, c.b * j);
      }
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return out;
  };
  const mtx = (x, y, z, sx, sy, sz, rx, ry, rz) => {
    const m = new T.Matrix4();
    m.compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sx, sy == null ? sx : sy, sz == null ? sx : sz));
    return m;
  };
  M.mtx = mtx;

  // ---------------------------------------------------------------------
  // Scenery geometries (merged, vertex colored; used with InstancedMesh)
  // ---------------------------------------------------------------------
  M.scenery = {};
  M.buildScenery = function () {
    const S = M.scenery;
    const trunk = '#6b4a2b';
    S.deciduous = M.merge([
      { geo: G.taper, color: trunk, matrix: mtx(0, 1.5, 0, 0.35, 3, 0.35) },
      { geo: G.lowSphere, color: '#4f8a3a', matrix: mtx(0, 4.2, 0, 2.4, 2.1, 2.4), jitter: 0.25 },
      { geo: G.lowSphere, color: '#5a9a42', matrix: mtx(0.9, 5.2, 0.4, 1.6, 1.5, 1.6), jitter: 0.25 },
      { geo: G.lowSphere, color: '#467d33', matrix: mtx(-1, 4.9, -0.5, 1.5, 1.4, 1.5), jitter: 0.25 },
    ]);
    const low = new T.IcosahedronGeometry(1, 0);
    S.deciduousLow = M.merge([
      { geo: G.taper, color: trunk, matrix: mtx(0, 1.5, 0, 0.35, 3, 0.35) },
      { geo: low, color: '#4f8a3a', matrix: mtx(0, 4.4, 0, 2.6, 2.3, 2.6), jitter: 0.25 },
      { geo: low, color: '#5a9a42', matrix: mtx(0.8, 5.4, 0.3, 1.7, 1.5, 1.7), jitter: 0.25 },
    ]);
    S.banyan = M.merge([
      { geo: G.taper, color: '#7a6a58', matrix: mtx(0, 1.8, 0, 0.9, 3.6, 0.9) },
      { geo: G.cyl, color: '#7a6a58', matrix: mtx(1.8, 1.6, 0.6, 0.12, 3.2, 0.12) },
      { geo: G.cyl, color: '#7a6a58', matrix: mtx(-1.6, 1.6, -0.8, 0.12, 3.2, 0.12) },
      { geo: G.cyl, color: '#7a6a58', matrix: mtx(0.4, 1.6, -2, 0.12, 3.2, 0.12) },
      { geo: low, color: '#3f7a35', matrix: mtx(0, 5.2, 0, 6.5, 2.4, 6), jitter: 0.25 },
      { geo: low, color: '#4a8a3c', matrix: mtx(2.5, 6.2, 1, 3.5, 1.8, 3.5), jitter: 0.25 },
      { geo: low, color: '#35702e', matrix: mtx(-2.5, 6, -1.4, 3.5, 1.8, 3.5), jitter: 0.25 },
    ]);
    S.oak = M.merge([
      { geo: G.taper, color: '#5d4a38', matrix: mtx(0, 1.6, 0, 0.55, 3.2, 0.55) },
      { geo: G.cyl, color: '#5d4a38', matrix: mtx(1.3, 3.2, 0, 0.18, 2.8, 0.18, 0, 0, -0.9) },
      { geo: low, color: '#46703a', matrix: mtx(0, 4.8, 0, 4.8, 2.2, 4.4), jitter: 0.25 },
      { geo: low, color: '#52803f', matrix: mtx(2.4, 4.5, 0.6, 2.8, 1.7, 2.8), jitter: 0.25 },
    ]);
    S.eucalyptus = M.merge([
      { geo: G.taper, color: '#d9d2c2', matrix: mtx(0, 4, 0, 0.35, 8, 0.35) },
      { geo: low, color: '#7d9a6a', matrix: mtx(0.4, 9, 0, 2.2, 3, 2.2), jitter: 0.2 },
      { geo: low, color: '#8aa878', matrix: mtx(-0.6, 7.2, 0.5, 1.6, 2, 1.6), jitter: 0.2 },
    ]);
    S.jacaranda = M.merge([
      { geo: G.taper, color: '#5d4a38', matrix: mtx(0, 1.6, 0, 0.3, 3.2, 0.3) },
      { geo: low, color: '#9b7fd4', matrix: mtx(0, 4.2, 0, 3, 1.8, 3), jitter: 0.15 },
      { geo: low, color: '#a98ee0', matrix: mtx(1, 4.8, 0.5, 1.8, 1.3, 1.8), jitter: 0.15 },
    ]);
    S.autumn = M.merge([
      { geo: G.taper, color: trunk, matrix: mtx(0, 1.5, 0, 0.35, 3, 0.35) },
      { geo: low, color: '#c9762e', matrix: mtx(0, 4.4, 0, 2.6, 2.3, 2.6), jitter: 0.3 },
      { geo: low, color: '#b8452a', matrix: mtx(0.8, 5.4, 0.3, 1.7, 1.5, 1.7), jitter: 0.3 },
    ]);
    S.car = M.merge([
      { geo: G.box, color: '#ffffff', matrix: mtx(0, 0.55, 0, 1.8, 0.7, 4.2) },
      { geo: G.box, color: '#ffffff', matrix: mtx(0, 1.15, -0.2, 1.6, 0.55, 2.2) },
      { geo: G.box, color: '#22303a', matrix: mtx(0, 1.15, -0.2, 1.64, 0.4, 2.0) },
    ]);
    S.bus = M.merge([
      { geo: G.box, color: '#ffffff', matrix: mtx(0, 1.6, 0, 2.5, 2.9, 11) },
      { geo: G.box, color: '#22303a', matrix: mtx(0, 2.1, 0, 2.55, 0.9, 10.2) },
    ]);
    S.catamaran = M.merge([
      { geo: G.box, color: '#ffffff', matrix: mtx(-1.6, 0.4, 0, 0.9, 0.8, 10) },
      { geo: G.box, color: '#ffffff', matrix: mtx(1.6, 0.4, 0, 0.9, 0.8, 10) },
      { geo: G.box, color: '#e8e2d0', matrix: mtx(0, 0.9, 0, 4, 0.2, 7) },
      { geo: G.cone, color: '#f5f5f5', matrix: mtx(0, 6, -0.5, 0.15, 10, 3, 0, 0, 0) },
    ]);
    S.sail = M.merge([
      { geo: G.box, color: '#ffffff', matrix: mtx(0, 0.5, 0, 2.2, 1, 8) },
      { geo: G.cyl, color: '#888', matrix: mtx(0, 6, 0.5, 0.08, 11, 0.08) },
      { geo: G.cone, color: '#f7f7f2', matrix: mtx(0, 6, -0.6, 0.1, 9, 2.6) },
    ]);
    S.pedal = M.merge([
      { geo: G.box, color: '#ffffff', matrix: mtx(0, 0.35, 0, 1.6, 0.6, 2.4) },
      { geo: G.box, color: '#ffffff', matrix: mtx(0, 0.95, -0.2, 1.5, 0.08, 1.4) },
      { geo: G.cyl, color: '#ffffff', matrix: mtx(0, 1.0, 1.1, 0.15, 1.2, 0.15, 0.4, 0, 0) },
    ]);
    S.tram = M.merge([
      { geo: G.box, color: '#ffffff', matrix: mtx(0, 1.9, 0, 2.6, 3.2, 28) },
      { geo: G.box, color: '#22303a', matrix: mtx(0, 2.4, 0, 2.65, 1.0, 27) },
    ]);
    S.chair = M.merge([
      { geo: G.cyl, color: '#333', matrix: mtx(0, -1.2, 0, 0.04, 2.4, 0.04) },
      { geo: G.box, color: '#2d6db5', matrix: mtx(0, -2.5, 0, 1.6, 0.15, 0.8) },
      { geo: G.box, color: '#2d6db5', matrix: mtx(0, -2.1, -0.35, 1.6, 0.8, 0.12) },
    ]);
    S.conifer = M.merge([
      { geo: G.taper, color: trunk, matrix: mtx(0, 0.8, 0, 0.3, 1.6, 0.3) },
      { geo: G.cone, color: '#2f6b3a', matrix: mtx(0, 2.6, 0, 2.2, 2.8, 2.2), jitter: 0.2 },
      { geo: G.cone, color: '#35763f', matrix: mtx(0, 4.2, 0, 1.7, 2.4, 1.7), jitter: 0.2 },
      { geo: G.cone, color: '#3b8045', matrix: mtx(0, 5.6, 0, 1.1, 2, 1.1), jitter: 0.2 },
    ]);
    const palmParts = [];
    for (let i = 0; i < 5; i++) palmParts.push({ geo: G.cyl, color: '#8a6a45', matrix: mtx(i * 0.12, 0.6 + i * 1.1, 0, 0.22, 1.15, 0.22, 0, 0, -0.05) });
    const leaf = new T.BoxGeometry(2.8, 0.06, 0.6).translate(1.4, 0, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      palmParts.push({ geo: leaf, color: i % 2 ? '#4c9a3c' : '#5aa845', matrix: mtx(0.6, 5.9, 0, 1, 1, 1, 0, a, -0.45), jitter: 0.15 });
    }
    palmParts.push({ geo: G.sphere, color: '#6b5a2a', matrix: mtx(0.6, 5.8, 0, 0.35, 0.3, 0.35) });
    S.palm = M.merge(palmParts);
    S.acacia = M.merge([
      { geo: G.taper, color: '#6b5236', matrix: mtx(0, 1.6, 0, 0.3, 3.2, 0.3) },
      { geo: G.cyl, color: '#6b5236', matrix: mtx(0.6, 3.3, 0, 0.15, 1.3, 0.15, 0, 0, -0.6) },
      { geo: G.lowSphere, color: '#7f9a3e', matrix: mtx(0.3, 4.1, 0, 3.6, 0.7, 3.2), jitter: 0.25 },
    ]);
    S.bush = M.merge([{ geo: G.lowSphere, color: '#4e8a3c', matrix: mtx(0, 0.5, 0, 1.2, 0.9, 1.2), jitter: 0.3 }, { geo: G.lowSphere, color: '#5a9644', matrix: mtx(0.6, 0.4, 0.3, 0.8, 0.7, 0.8), jitter: 0.3 }]);
    S.rock = M.merge([{ geo: new T.DodecahedronGeometry(1, 0), color: '#8d8a82', matrix: mtx(0, 0.3, 0, 1.4, 0.9, 1.1), jitter: 0.2 }]);
    S.bigRock = M.merge([
      { geo: new T.DodecahedronGeometry(1, 0), color: '#9a948a', matrix: mtx(0, 0.8, 0, 3, 2.2, 2.4), jitter: 0.15 },
      { geo: new T.DodecahedronGeometry(1, 0), color: '#8a857c', matrix: mtx(1.8, 0.5, 1, 1.8, 1.4, 1.6), jitter: 0.15 },
    ]);
    S.ice = M.merge([{ geo: new T.DodecahedronGeometry(1, 0), color: '#dff1fa', matrix: mtx(0, 0.4, 0, 1.3, 0.8, 1.1) }]);
    S.grass = M.merge([0, 1, 2, 3].map((i) => ({ geo: G.cone, color: '#8fae55', matrix: mtx(Math.cos(i * 1.6) * 0.3, 0.45, Math.sin(i * 1.6) * 0.3, 0.12, 0.9, 0.12, Math.cos(i) * 0.3, 0, Math.sin(i) * 0.3), jitter: 0.3 })));
    S.bamboo = M.merge([0, 1, 2, 3, 4].map((i) => ({ geo: G.cyl, color: '#7fae4a', matrix: mtx(Math.cos(i * 1.3) * 0.5, 2.5, Math.sin(i * 1.3) * 0.5, 0.09, 5, 0.09, Math.cos(i) * 0.1, 0, Math.sin(i) * 0.1), jitter: 0.2 })).concat([{ geo: G.lowSphere, color: '#6ea83f', matrix: mtx(0, 4.6, 0, 1.2, 1, 1.2), jitter: 0.3 }]));
    S.log = M.merge([{ geo: G.cyl, color: '#7a5634', matrix: mtx(0, 0.35, 0, 0.35, 3.5, 0.35, 0, 0, Math.PI / 2) }]);
    // People (for InstancedMesh)
    S.personLegs = new T.CylinderGeometry(0.16, 0.14, 0.85, 6);
    S.personLegs.translate(0, 0.42, 0);
    S.personBody = new T.CapsuleGeometry(0.24, 0.45, 3, 8);
    S.personBody.translate(0, 1.15, 0);
    S.personHead = new T.SphereGeometry(0.17, 8, 6);
    S.personHead.translate(0, 1.66, 0);
  };

  // ---------------------------------------------------------------------
  // Animals
  // ---------------------------------------------------------------------
  // Generic quadruped. Length along +Z (forward), feet at y=0.
  function quad(o) {
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const mb = M.mat(o.color, { map: o.map });
    const ml = M.mat(o.legColor || o.color, { map: o.legMap });
    const mh = M.mat(o.headColor || o.color, { map: o.headMap });
    const fl = o.frontLeg || o.leg, bl = o.backLeg || o.leg;
    const bodyY = Math.max(fl, bl) + o.H * 0.4;
    const torso = mesh(G.sphere, mb, [0, bodyY, 0], [o.W / 2, o.H / 2, o.L / 2]);
    if (o.pitch) torso.rotation.x = o.pitch;
    body.add(torso);
    if (o.belly) body.add(mesh(G.sphere, M.mat(o.belly), [0, bodyY - o.H * 0.18, 0], [o.W * 0.42, o.H * 0.35, o.L * 0.42]));
    if (o.hump) body.add(mesh(G.sphere, mb, [0, bodyY + o.H * 0.45, o.hump.z * o.L], [o.W * 0.38, o.hump.h, o.L * 0.22]));
    const legs = [];
    const lr = o.legR || o.W * 0.12;
    for (const fz of [1, -1])
      for (const sx of [1, -1]) {
        const len = fz > 0 ? fl : bl;
        const pivot = new T.Group();
        const topY = len + o.H * 0.12;
        pivot.position.set(sx * o.W * (o.splay || 0.3), topY, fz * o.L * (o.legZ || 0.32));
        const leg = mesh(G.taper, ml, [0, -topY / 2, 0], [lr, topY, lr]);
        leg.rotation.x = Math.PI;
        pivot.add(leg);
        if (o.hoof) pivot.add(mesh(G.cyl, M.mat(o.hoof), [0, -topY + 0.05 * topY, 0], [lr * 1.05, topY * 0.1, lr * 1.05]));
        if (o.splayOut) pivot.rotation.z = sx * o.splayOut;
        pivot.userData = { phase: (fz > 0) === (sx > 0) ? 0 : Math.PI, base: pivot.rotation.z };
        body.add(pivot);
        legs.push(pivot);
      }
    const neck = new T.Group();
    neck.position.set(0, bodyY + o.H * (o.neckY || 0.15), o.L * 0.4);
    neck.rotation.x = o.neckAngle != null ? o.neckAngle : 0.9;
    body.add(neck);
    const nl = o.neckLen || o.H * 0.4;
    const nr = o.neckR || o.W * 0.22;
    neck.add(mesh(G.taper, o.neckMap ? M.mat(o.color, { map: o.neckMap }) : mb, [0, nl / 2, 0], [nr, nl, nr]));
    const head = new T.Group();
    head.position.set(0, nl, 0);
    head.rotation.x = -(o.neckAngle != null ? o.neckAngle : 0.9) + (o.headPitch || 0.25);
    neck.add(head);
    const hs = o.head || [o.W * 0.4, o.W * 0.4, o.W * 0.55];
    head.add(mesh(G.sphere, mh, [0, 0, hs[2] * 0.3], [hs[0], hs[1], hs[2]]));
    if (o.snout) head.add(mesh(G.sphere, M.mat(o.snoutColor || o.headColor || o.color), [0, -hs[1] * 0.25, hs[2] * 0.3 + o.snout * 0.8], [hs[0] * 0.6, hs[1] * 0.55, o.snout]));
    if (o.nose !== false) head.add(mesh(G.sphere, M.mat('#1d1a18'), [0, -hs[1] * 0.1, hs[2] * 0.3 + (o.snout ? o.snout * 1.7 : hs[2] * 0.95)], [hs[0] * 0.18, hs[1] * 0.14, hs[0] * 0.1]));
    for (const sx of [1, -1]) {
      head.add(mesh(G.sphere, M.mat('#111'), [sx * hs[0] * 0.65, hs[1] * 0.25, hs[2] * 0.65], [hs[0] * 0.11, hs[0] * 0.11, hs[0] * 0.08]));
      if (o.ears) head.add(mesh(o.ears.round ? G.sphere : G.cone, M.mat(o.ears.color || o.headColor || o.color), [sx * hs[0] * 0.6, hs[1] * 0.9, -hs[2] * 0.05], [o.ears.w, o.ears.h, o.ears.d || o.ears.w * 0.4], [0, 0, -sx * (o.ears.tilt || 0.3)]));
    }
    let tail = null;
    if (o.tail) {
      tail = new T.Group();
      tail.position.set(0, bodyY + o.H * 0.2, -o.L * 0.48);
      tail.rotation.x = o.tail.angle != null ? o.tail.angle : -2.6;
      tail.add(mesh(o.tail.taper === false ? G.cyl : G.taper, M.mat(o.tail.color || o.color, { map: o.tail.map }), [0, o.tail.len / 2, 0], [o.tail.r, o.tail.len, o.tail.r], [Math.PI, 0, 0]));
      if (o.tail.tuft) tail.add(mesh(G.sphere, M.mat(o.tail.tuft), [0, o.tail.len, 0], [o.tail.r * 2.2, o.tail.r * 3, o.tail.r * 2.2]));
      body.add(tail);
    }
    const model = { root, body, legs, neck, head, tail, height: bodyY + o.H * 0.5 + (o.neckLen || 0) * Math.cos(neck.rotation.x), bodyY, gait: o.gait || 1, stride: o.stride || 0.45, headMesh: hs };
    if (o.extra) o.extra(model, { mb, mh, hs, bodyY, o });
    return model;
  }

  // Upright biped (birds, kangaroo, penguins)
  function biped(o) {
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const bodyY = o.leg + o.H * 0.4;
    const mb = M.mat(o.color, { map: o.map });
    const torso = mesh(G.sphere, mb, [0, bodyY, 0], [o.W / 2, o.H / 2, o.L / 2]);
    torso.rotation.x = o.pitch || 0;
    body.add(torso);
    if (o.belly) body.add(mesh(G.sphere, M.mat(o.belly), [0, bodyY - o.H * 0.05, o.L * 0.12], [o.W * 0.42, o.H * 0.45, o.L * 0.4], [o.pitch || 0, 0, 0]));
    const legs = [];
    for (const sx of [1, -1]) {
      const pivot = new T.Group();
      pivot.position.set(sx * o.W * 0.2, o.leg, 0);
      const lg = mesh(G.cyl, M.mat(o.legColor || '#444'), [0, -o.leg / 2, 0], [o.legR || 0.05, o.leg, o.legR || 0.05]);
      pivot.add(lg);
      pivot.add(mesh(G.box, M.mat(o.legColor || '#444'), [0, -o.leg + 0.02, 0.08], [o.legR * 3 || 0.15, 0.04, o.legR * 5 || 0.25]));
      pivot.userData = { phase: sx > 0 ? 0 : Math.PI, base: 0 };
      body.add(pivot);
      legs.push(pivot);
    }
    const neck = new T.Group();
    neck.position.set(0, bodyY + o.H * 0.3, o.L * 0.3);
    neck.rotation.x = o.neckAngle || 0.2;
    body.add(neck);
    const nl = o.neckLen || 0.1;
    neck.add(mesh(G.cyl, M.mat(o.neckColor || o.color), [0, nl / 2, 0], [o.neckR || 0.06, nl, o.neckR || 0.06]));
    const head = new T.Group();
    head.position.set(0, nl, 0);
    head.rotation.x = -(o.neckAngle || 0.2);
    neck.add(head);
    const hs = o.head;
    head.add(mesh(G.sphere, M.mat(o.headColor || o.color), [0, 0, 0], hs));
    head.add(mesh(G.cone, M.mat(o.beak || '#e0a030'), [0, -hs[1] * 0.2, hs[2] + (o.beakLen || 0.1) / 2], [hs[0] * 0.35, o.beakLen || 0.1, hs[0] * 0.35], [Math.PI / 2 + (o.beakDown || 0), 0, 0]));
    for (const sx of [1, -1]) head.add(mesh(G.sphere, M.mat('#111'), [sx * hs[0] * 0.7, hs[1] * 0.2, hs[2] * 0.4], [hs[0] * 0.15, hs[0] * 0.15, hs[0] * 0.1]));
    const model = { root, body, legs, neck, head, tail: null, height: bodyY + o.H / 2 + nl, bodyY, gait: o.gait || 1.6, stride: 0.5, biped: true };
    if (o.extra) o.extra(model, { mb, hs, bodyY, o });
    return model;
  }

  const V = {}; // species visual builders
  const addTusks = (m, len, col) => {
    for (const sx of [1, -1]) m.head.add(mesh(G.cone, M.mat(col || '#f3ecd6'), [sx * 0.25, -0.35, 0.75], [0.07, len, 0.07], [Math.PI / 2 + 0.5, 0, 0]));
  };
  const elephant = (color, earSize, tusks) => () =>
    quad({ L: 3.2, H: 2.2, W: 1.9, leg: 1.6, legR: 0.3, color, neckLen: 0.95, neckAngle: 1.05, neckR: 0.62, head: [0.72, 0.78, 0.72], headPitch: 0.1, nose: false, stride: 0.35, gait: 0.7,
      tail: { len: 1, r: 0.06, angle: -2.9, tuft: '#333' },
      extra: (m) => {
        for (const sx of [1, -1]) m.head.add(mesh(G.sphere, M.mat(color), [sx * 0.75, 0.05, 0.05], [0.12, earSize, earSize * 0.85], [0, sx * 0.3, 0]));
        let seg = m.head, y = -0.2;
        for (let i = 0; i < 4; i++) {
          const g = new T.Group();
          g.position.set(0, i === 0 ? -0.2 : -0.45, i === 0 ? 0.7 : 0);
          g.rotation.x = i === 0 ? 0.1 : 0.12;
          g.add(mesh(G.taper, M.mat(color), [0, -0.22, 0], [0.18 - i * 0.03, 0.5, 0.18 - i * 0.03], [Math.PI, 0, 0]));
          seg.add(g);
          seg = g;
          m.trunk = m.trunk || [];
          m.trunk.push(g);
        }
        void y;
        if (tusks) addTusks(m, 0.8);
      },
    });
  V.african_elephant = elephant('#8e8a84', 0.95, true);
  V.asian_elephant = elephant('#7d7670', 0.6, false);
  V.giraffe = () =>
    quad({ L: 2.2, H: 1.3, W: 1.0, frontLeg: 2.0, backLeg: 1.8, legR: 0.12, color: '#e8c996', map: M.tex.patches('#a5622c', '#f3e3c3'), legMap: M.tex.patches('#a5622c', '#f3e3c3'),
      neckMap: M.tex.patches('#a5622c', '#f3e3c3'), neckLen: 2.3, neckAngle: 0.35, neckR: 0.22, head: [0.22, 0.25, 0.45], headColor: '#c28a4f', headPitch: 0.3, snout: 0.25, stride: 0.5, gait: 0.8,
      ears: { w: 0.08, h: 0.2 }, tail: { len: 0.9, r: 0.04, tuft: '#2a1d12' },
      extra: (m) => {
        for (const sx of [1, -1]) m.head.add(mesh(G.cyl, M.mat('#5c3b1e'), [sx * 0.1, 0.32, 0.05], [0.04, 0.25, 0.04]));
      },
    });
  const zebraLike = (map, color, headColor) => () =>
    quad({ L: 1.9, H: 1.0, W: 0.75, leg: 0.85, legR: 0.1, color, map, legMap: map, neckLen: 0.8, neckAngle: 0.7, neckR: 0.2, head: [0.22, 0.25, 0.5], headColor: headColor || color, headMap: map, snout: 0.25, snoutColor: '#2b2b2b',
      ears: { w: 0.08, h: 0.25 }, tail: { len: 0.8, r: 0.04, tuft: '#222' }, hoof: '#222',
      extra: (m) => m.neck.add(mesh(G.box, M.mat('#222'), [0, 0.45, -0.18], [0.06, 0.8, 0.12])) });
  V.grevys_zebra = zebraLike(M.tex.stripes('#f4f1ea', '#1b1b1b', 22), '#f4f1ea');
  V.donkey = () => quad({ L: 1.5, H: 0.85, W: 0.62, leg: 0.7, legR: 0.08, color: '#6e645c', belly: '#bdb3a6', neckLen: 0.6, neckAngle: 0.8, neckR: 0.18, head: [0.2, 0.22, 0.45], snout: 0.2, snoutColor: '#d9d2c7', ears: { w: 0.07, h: 0.45 }, tail: { len: 0.6, r: 0.03, tuft: '#222' }, hoof: '#222' });
  V.okapi = () => quad({ L: 1.9, H: 1.0, W: 0.75, leg: 1.1, legR: 0.1, color: '#4a2a1e', legMap: M.tex.stripes('#f1e9dc', '#3a2016', 10), neckLen: 0.9, neckAngle: 0.6, neckR: 0.2, head: [0.2, 0.24, 0.5], headColor: '#d8c8b0', snout: 0.22, ears: { w: 0.1, h: 0.3 }, tail: { len: 0.6, r: 0.04, tuft: '#222' } });
  V.white_rhino = () =>
    quad({ L: 3.2, H: 1.5, W: 1.5, leg: 0.8, legR: 0.22, color: '#9b958d', neckLen: 0.75, neckAngle: 1.35, neckR: 0.5, head: [0.45, 0.45, 0.8], headPitch: -0.3, nose: false, stride: 0.3, gait: 0.8,
      ears: { w: 0.12, h: 0.28 }, tail: { len: 0.5, r: 0.04, tuft: '#333' },
      extra: (m) => {
        m.head.add(mesh(G.cone, M.mat('#b5aa98'), [0, 0.2, 1.15], [0.14, 0.7, 0.14], [0.4, 0, 0]));
        m.head.add(mesh(G.cone, M.mat('#b5aa98'), [0, 0.25, 0.75], [0.1, 0.35, 0.1], [0.2, 0, 0]));
      } });
  V.hippo = () => quad({ L: 3.0, H: 1.4, W: 1.6, leg: 0.5, legR: 0.25, color: '#7a6a6e', belly: '#c79c96', neckLen: 0.7, neckAngle: 1.45, neckR: 0.55, head: [0.65, 0.5, 0.8], headPitch: 0, snout: 0.45, snoutColor: '#8a7478', ears: { w: 0.08, h: 0.12, round: true }, tail: { len: 0.35, r: 0.06 }, stride: 0.3, gait: 0.8, swims: true });
  V.pygmy_hippo = () => quad({ L: 1.5, H: 0.75, W: 0.8, leg: 0.3, legR: 0.14, color: '#4a4046', belly: '#9c7f80', neckLen: 0.35, neckAngle: 1.45, neckR: 0.28, head: [0.32, 0.26, 0.4], headPitch: 0, snout: 0.22, ears: { w: 0.05, h: 0.07, round: true }, tail: { len: 0.2, r: 0.04 } });
  V.african_buffalo = () =>
    quad({ L: 2.4, H: 1.3, W: 1.1, leg: 0.8, legR: 0.14, color: '#2b2522', neckLen: 0.7, neckAngle: 1.2, neckR: 0.42, head: [0.35, 0.38, 0.6], headPitch: -0.3, snout: 0.25, ears: { w: 0.15, h: 0.12, tilt: 1.3 }, tail: { len: 0.8, r: 0.04, tuft: '#111' },
      extra: (m) => {
        for (const sx of [1, -1]) {
          m.head.add(mesh(G.cyl, M.mat('#3a3530'), [sx * 0.35, 0.35, 0.1], [0.1, 0.55, 0.1], [0, 0, sx * 1.3]));
          m.head.add(mesh(G.cone, M.mat('#3a3530'), [sx * 0.62, 0.25, 0.15], [0.08, 0.4, 0.08], [0.3, 0, -sx * 0.6]));
        }
      } });
  V.bison = () =>
    quad({ L: 2.6, H: 1.5, W: 1.2, frontLeg: 0.8, backLeg: 0.7, legR: 0.15, color: '#4d3423', hump: { z: 0.25, h: 0.55 }, neckLen: 0.75, neckAngle: 1.35, neckR: 0.45, head: [0.38, 0.42, 0.55], headPitch: -0.4, headColor: '#2f1f15', snout: 0.2, tail: { len: 0.6, r: 0.04, tuft: '#222' },
      extra: (m, c) => {
        m.body.add(mesh(G.sphere, M.mat('#6e4d31'), [0, c.bodyY + 0.2, 0.55], [0.7, 0.85, 0.75]));
        for (const sx of [1, -1]) m.head.add(mesh(G.cone, M.mat('#222'), [sx * 0.38, 0.25, 0.1], [0.06, 0.3, 0.06], [0, 0, -sx * 0.9]));
      } });
  V.moose = () =>
    quad({ L: 2.4, H: 1.3, W: 1.0, leg: 1.4, legR: 0.12, color: '#3e2c1f', legColor: '#8a7560', hump: { z: 0.3, h: 0.35 }, neckLen: 0.5, neckAngle: 1.0, neckR: 0.3, head: [0.28, 0.3, 0.7], headPitch: -0.2, snout: 0.35, ears: { w: 0.1, h: 0.28 }, tail: { len: 0.2, r: 0.05 },
      extra: (m) => {
        for (const sx of [1, -1]) m.head.add(mesh(G.box, M.mat('#c9b48a'), [sx * 0.55, 0.45, 0], [0.8, 0.06, 0.45], [0, 0, sx * 0.4]));
      } });
  V.bongo = () =>
    quad({ L: 1.9, H: 1.0, W: 0.75, leg: 0.9, legR: 0.09, color: '#a64a1f', map: M.tex.stripes('#a64a1f', '#f3ead8', 12), neckLen: 0.6, neckAngle: 0.8, neckR: 0.2, head: [0.2, 0.23, 0.48], snout: 0.2, ears: { w: 0.12, h: 0.25 }, tail: { len: 0.5, r: 0.03, tuft: '#222' },
      extra: (m) => {
        for (const sx of [1, -1]) m.head.add(mesh(G.cone, M.mat('#3a2b1e'), [sx * 0.12, 0.55, -0.15], [0.05, 0.9, 0.05], [-0.5, 0, sx * 0.15]));
      } });
  V.warthog = () =>
    quad({ L: 1.2, H: 0.65, W: 0.55, leg: 0.4, legR: 0.07, color: '#6a5b4d', neckLen: 0.38, neckAngle: 1.25, neckR: 0.2, head: [0.25, 0.25, 0.4], headPitch: -0.2, snout: 0.25, ears: { w: 0.08, h: 0.15 }, tail: { len: 0.4, r: 0.02, tuft: '#222', angle: -0.6 },
      extra: (m) => addTusks(m, 0.25, '#efe6cf') });
  V.bactrian_camel = () =>
    quad({ L: 2.4, H: 1.2, W: 0.9, leg: 1.4, legR: 0.12, color: '#b08857', neckLen: 1.0, neckAngle: 0.5, neckR: 0.22, head: [0.22, 0.25, 0.55], headPitch: 1.0, snout: 0.25, ears: { w: 0.06, h: 0.12 }, tail: { len: 0.6, r: 0.04 },
      extra: (m, c) => {
        m.body.add(mesh(G.sphere, c.mb, [0, c.bodyY + 0.6, 0.4], [0.35, 0.45, 0.35]));
        m.body.add(mesh(G.sphere, c.mb, [0, c.bodyY + 0.6, -0.4], [0.35, 0.45, 0.35]));
      } });
  V.alpaca = () => quad({ L: 1.2, H: 0.8, W: 0.6, leg: 0.7, legR: 0.08, color: '#e4d2b0', neckLen: 0.8, neckAngle: 0.25, neckR: 0.18, head: [0.18, 0.2, 0.35], headPitch: 0.1, snout: 0.15, ears: { w: 0.06, h: 0.22 }, tail: { len: 0.25, r: 0.06 } });
  const goat = (color, horns, big) => () =>
    quad({ L: 1.1 * big, H: 0.6 * big, W: 0.5 * big, leg: 0.55 * big, legR: 0.06 * big, color, neckLen: 0.35 * big, neckAngle: 0.7, neckR: 0.12 * big, head: [0.14 * big, 0.16 * big, 0.3 * big], snout: 0.12 * big, ears: { w: 0.05, h: 0.15, tilt: 1.2 }, tail: { len: 0.15, r: 0.04, angle: -0.7 },
      extra: (m) => {
        for (const sx of [1, -1]) m.head.add(mesh(G.cone, M.mat('#5a4a3a'), [sx * 0.07 * big, 0.25 * big, -0.1 * big], [0.05 * big, horns * big, 0.05 * big], [-0.9, 0, sx * 0.1]));
      } });
  V.alpine_goat = goat('#8a6b4d', 0.25, 1);
  V.alpine_ibex = goat('#7a6a55', 0.9, 1.25);
  const cat = (L, color, map, headMap, extra, tailMap) => () =>
    quad({ L, H: L * 0.42, W: L * 0.3, leg: L * 0.38, legR: L * 0.05, color, map, legMap: map, headMap: headMap || map, neckLen: L * 0.12, neckAngle: 1.1, neckR: L * 0.1, head: [L * 0.14, L * 0.13, L * 0.15], headPitch: 0.1, snout: L * 0.06, snoutColor: '#e9dcc6',
      ears: { w: L * 0.045, h: L * 0.05, round: true }, tail: { len: L * 0.55, r: L * 0.03, angle: -2.2, map: tailMap || map, taper: false }, stride: 0.55, gait: 1.1, extra });
  V.lion = cat(2.0, '#c9a060', null, null, (m, c) => {
    m.head.add(mesh(G.lowSphere, M.mat('#7a4c22'), [0, 0.02, -0.02], [c.hs[0] * 1.7, c.hs[1] * 1.8, c.hs[2] * 1.2]));
    if (m.tail) m.tail.add(mesh(G.sphere, M.mat('#5a3a1c'), [0, 1.1, 0], [0.08, 0.14, 0.08]));
  });
  V.lioness = cat(1.8, '#caa46a');
  V.amur_tiger = cat(2.1, '#d9822b', M.tex.stripes('#d9822b', '#1c140e', 18), null, null, M.tex.rings('#d9822b', '#1c140e', 5));
  V.sumatran_tiger = cat(1.8, '#c46a1f', M.tex.stripes('#c46a1f', '#18100a', 22), null, null, M.tex.rings('#c46a1f', '#18100a', 5));
  V.cheetah = () => {
    const m = cat(1.7, '#dcb46a', M.tex.spots('#dcb46a', '#1d1a14', false))();
    m.legs.forEach((l) => l.scale.set(0.9, 1.15, 0.9));
    return m;
  };
  V.african_leopard = cat(1.7, '#d7a95c', M.tex.spots('#d7a95c', '#2a1d10', true));
  V.jaguar = cat(1.9, '#cf9a4a', M.tex.spots('#cf9a4a', '#1f150b', true));
  V.snow_leopard = cat(1.5, '#d8d6cc', M.tex.spots('#d8d6cc', '#5a5a58', true), null, null, M.tex.rings('#d8d6cc', '#555', 6));
  V.clouded_leopard = cat(1.4, '#b89a6a', M.tex.spots('#b89a6a', '#4a3a2a', true));
  V.mountain_lion = cat(1.7, '#b58a5a');
  const bear = (L, color, extra, headColor) => () =>
    quad({ L, H: L * 0.55, W: L * 0.45, leg: L * 0.28, legR: L * 0.09, color, headColor, neckLen: L * 0.3, neckAngle: 1.15, neckR: L * 0.16, head: [L * 0.16, L * 0.15, L * 0.18], headPitch: 0.1, snout: L * 0.08, snoutColor: '#8a7a64',
      ears: { w: L * 0.05, h: L * 0.05, round: true }, stride: 0.35, gait: 0.8, extra, swims: true });
  V.grizzly_bear = bear(2.2, '#6b4a2e');
  V.black_bear = bear(1.7, '#1d1a18');
  V.sun_bear = bear(1.3, '#1a1714', (m, c) => m.body.add(mesh(G.sphere, M.mat('#e0b24a'), [0, c.bodyY + 0.05, c.o.L * 0.42], [0.2, 0.12, 0.06])));
  V.andean_bear = bear(1.6, '#1c1916', (m, c) => {
    for (const sx of [1, -1]) m.head.add(mesh(G.sphere, M.mat('#e8d9b0'), [sx * 0.12, 0.08, c.hs[2] * 0.7], [0.08, 0.1, 0.05]));
  });
  V.polar_bear = bear(2.3, '#f1ede1', null, '#f1ede1');
  V.giant_panda = bear(1.6, '#f2f0ea', (m, c) => {
    m.legs.forEach((l) => l.children.forEach((ch) => (ch.material = M.mat('#161616'))));
    m.body.add(mesh(G.sphere, M.mat('#161616'), [0, c.bodyY + 0.1, c.o.L * 0.22], [c.o.W * 0.52, c.o.H * 0.3, c.o.L * 0.2]));
    for (const sx of [1, -1]) m.head.add(mesh(G.sphere, M.mat('#161616'), [sx * 0.11, 0.05, c.hs[2] * 0.72], [0.08, 0.1, 0.05], [0, 0, sx * 0.4]));
  });
  M.panda_ears = true;
  const canid = (L, color, map, ears, tail, extra) => () =>
    quad({ L, H: L * 0.38, W: L * 0.28, leg: L * 0.42, legR: L * 0.045, color, map, legMap: map, headMap: map, neckLen: L * 0.18, neckAngle: 0.9, neckR: L * 0.08, head: [L * 0.1, L * 0.1, L * 0.14], headPitch: 0.2, snout: L * 0.12, snoutColor: '#3a2e24',
      ears: { w: L * ears[0], h: L * ears[1] }, tail: tail, stride: 0.6, gait: 1.3, extra });
  V.mexican_wolf = canid(1.4, '#8f8170', null, [0.05, 0.1], { len: 0.55, r: 0.07, angle: -2.4, color: '#6f6252', taper: false });
  V.african_wild_dog = canid(1.2, '#6a5436', M.tex.wildDog(), [0.08, 0.14, 0], { len: 0.45, r: 0.05, angle: -2.3, tuft: '#f2ead8' });
  V.arctic_fox = canid(0.8, '#f4f2ec', null, [0.05, 0.06], { len: 0.45, r: 0.1, angle: -2.2, color: '#f4f2ec', taper: false });
  V.red_panda = () =>
    quad({ L: 0.75, H: 0.32, W: 0.28, leg: 0.2, legR: 0.05, color: '#b0482a', legColor: '#2a1812', neckLen: 0.08, neckAngle: 1.2, neckR: 0.1, head: [0.13, 0.12, 0.12], headColor: '#c65a32', snout: 0.05, snoutColor: '#f2ead8',
      ears: { w: 0.05, h: 0.06, color: '#f2ead8' }, tail: { len: 0.5, r: 0.07, angle: -2.0, map: M.tex.rings('#b0482a', '#e0a070', 5), taper: false } });
  // Primates
  const ape = (L, color, face, arms, extra) => () =>
    quad({ L, H: L * 0.75, W: L * 0.6, frontLeg: L * arms, backLeg: L * 0.42, legR: L * 0.09, pitch: -0.5, color, neckLen: L * 0.28, neckAngle: 0.9, neckR: L * 0.16, head: [L * 0.2, L * 0.22, L * 0.2], headPitch: -0.1, snout: L * 0.08, snoutColor: face, legZ: 0.3,
      ears: { w: L * 0.05, h: L * 0.05, round: true, color: face }, stride: 0.4, gait: 0.9, extra });
  V.gorilla = ape(1.5, '#232323', '#3a3a3a', 0.85, (m, c) => m.body.add(mesh(G.sphere, M.mat('#8a8a88'), [0, c.bodyY + 0.2, -0.25], [0.45, 0.3, 0.4])));
  V.chimpanzee = ape(1.1, '#1d1b1a', '#c9a98a', 0.8);
  V.orangutan = ape(1.3, '#b0521f', '#5a3a2a', 1.0, (m, c) => {
    for (const sx of [1, -1]) m.head.add(mesh(G.sphere, M.mat('#8a4a2a'), [sx * 0.28, 0, c.hs[2] * 0.4], [0.12, 0.2, 0.05]));
  });
  V.ring_tailed_lemur = () =>
    quad({ L: 0.55, H: 0.25, W: 0.22, leg: 0.25, legR: 0.03, color: '#9a9690', belly: '#e6e1d6', neckLen: 0.05, neckAngle: 1.2, neckR: 0.07, head: [0.08, 0.08, 0.1], headColor: '#e6e1d6', snout: 0.05, snoutColor: '#222', ears: { w: 0.03, h: 0.04 },
      tail: { len: 0.7, r: 0.035, angle: -0.4, map: M.tex.rings('#f2f2ee', '#1a1a1a', 7), taper: false } });
  V.sloth = () => quad({ L: 0.7, H: 0.4, W: 0.35, frontLeg: 0.45, backLeg: 0.35, legR: 0.05, color: '#8a7358', neckLen: 0.05, neckAngle: 1.3, neckR: 0.1, head: [0.12, 0.12, 0.12], headColor: '#b8a48a', snout: 0.04, gait: 0.2, stride: 0.3 });
  V.koala = () => {
    const m = quad({ L: 0.6, H: 0.55, W: 0.45, leg: 0.15, legR: 0.07, pitch: -0.9, color: '#8e8e8c', belly: '#e8e4dc', neckLen: 0.05, neckAngle: 1.3, neckR: 0.12, head: [0.2, 0.18, 0.16], headPitch: -0.2, nose: false,
      ears: { w: 0.12, h: 0.12, d: 0.05, round: true, color: '#b5b3ae', tilt: 0.6 }, gait: 0.3, stride: 0.2 });
    m.head.add(mesh(G.sphere, M.mat('#1a1a1a'), [0, -0.02, 0.2], [0.06, 0.08, 0.05]));
    return m;
  };
  V.red_kangaroo = () =>
    biped({ L: 0.6, H: 0.9, W: 0.5, leg: 0.55, legR: 0.08, legColor: '#b5603a', color: '#b5603a', belly: '#e8cfb0', pitch: 0.4, neckLen: 0.3, neckAngle: 0.3, neckR: 0.1, head: [0.13, 0.15, 0.22], headColor: '#b5603a', beak: '#2a1a14', beakLen: 0.05, gait: 1.8,
      extra: (m, c) => {
        m.body.add(mesh(G.taper, M.mat('#b5603a'), [0, 0.35, -0.55], [0.1, 1.1, 0.1], [-1.2, 0, 0]));
        for (const sx of [1, -1]) m.head.add(mesh(G.cone, M.mat('#b5603a'), [sx * 0.08, 0.18, -0.05], [0.05, 0.18, 0.03]));
        m.hops = true;
      } });
  // Birds
  V.flamingo = () =>
    biped({ L: 0.55, H: 0.35, W: 0.3, leg: 0.85, legR: 0.025, legColor: '#e9788a', color: '#f28aa0', neckLen: 0.7, neckAngle: 0.15, neckR: 0.035, head: [0.07, 0.07, 0.09], beak: '#222', beakLen: 0.14, beakDown: 0.8, gait: 1.2,
      extra: (m) => m.body.add(mesh(G.cone, M.mat('#1a1a1a'), [0, 1.0, -0.3], [0.08, 0.2, 0.08], [-1.8, 0, 0])) });
  V.african_penguin = () =>
    biped({ L: 0.3, H: 0.55, W: 0.3, leg: 0.06, legR: 0.03, legColor: '#222', color: '#1c1c1e', belly: '#f4f4ef', pitch: -0.15, neckLen: 0.02, neckAngle: 0, head: [0.1, 0.1, 0.11], headColor: '#1c1c1e', beak: '#222', beakLen: 0.08, gait: 2.2,
      extra: (m, c) => {
        for (const sx of [1, -1]) m.body.add(mesh(G.sphere, M.mat('#1c1c1e'), [sx * 0.16, c.bodyY, 0], [0.03, 0.2, 0.08], [0, 0, sx * 0.2]));
        m.head.add(mesh(G.sphere, M.mat('#f4f4ef'), [0, 0, 0.03], [0.09, 0.05, 0.09]));
        m.swims = true;
      } });
  V.nene = () => biped({ L: 0.55, H: 0.32, W: 0.3, leg: 0.22, legR: 0.03, legColor: '#222', color: '#8f7b63', neckLen: 0.3, neckAngle: 0.2, neckR: 0.045, neckColor: '#d8cdb0', head: [0.07, 0.07, 0.09], headColor: '#1c1c1c', beak: '#1c1c1c', beakLen: 0.06, gait: 1.4 });
  V.california_condor = () =>
    biped({ L: 0.7, H: 0.5, W: 0.5, leg: 0.3, legR: 0.04, legColor: '#666', color: '#1d1d1d', pitch: -0.5, neckLen: 0.15, neckAngle: 0.5, neckR: 0.05, neckColor: '#c96a55', head: [0.08, 0.08, 0.1], headColor: '#e08066', beak: '#e8d9b0', beakLen: 0.07, beakDown: 0.5, gait: 1,
      extra: (m, c) => {
        for (const sx of [1, -1]) m.body.add(mesh(G.box, M.mat('#1d1d1d'), [sx * 0.3, c.bodyY + 0.05, -0.1], [0.08, 0.45, 0.7], [-0.4, 0, sx * 0.2]));
        m.body.add(mesh(G.box, M.mat('#e8e8e2'), [0, c.bodyY - 0.1, -0.05], [0.66, 0.08, 0.3]));
      } });
  V.ostrich = () =>
    biped({ L: 1.0, H: 0.8, W: 0.75, leg: 1.1, legR: 0.07, legColor: '#d9b5a0', color: '#1a1a1a', neckLen: 0.95, neckAngle: 0.1, neckR: 0.06, neckColor: '#d9b5a0', head: [0.09, 0.09, 0.12], headColor: '#d9b5a0', beak: '#d9b5a0', beakLen: 0.1, gait: 1.2,
      extra: (m, c) => m.body.add(mesh(G.sphere, M.mat('#f4f1e8'), [0, c.bodyY, -0.45], [0.35, 0.25, 0.2])) });
  // Reptiles
  const lizard = (L, color, map) => () =>
    quad({ L, H: L * 0.18, W: L * 0.22, leg: L * 0.12, legR: L * 0.035, color, map, legMap: map, splay: 0.45, splayOut: 0.6, neckLen: L * 0.08, neckAngle: 1.3, neckR: L * 0.07, head: [L * 0.07, L * 0.05, L * 0.12], headPitch: 0, snout: L * 0.06,
      tail: { len: L * 0.9, r: L * 0.07, angle: -1.75 }, stride: 0.5, gait: 0.9, swims: true });
  V.komodo = lizard(2.6, '#6b6450', M.tex.spots('#6b6450', '#5a533f', false));
  V.water_monitor = lizard(1.8, '#3b3a30', M.tex.spots('#3b3a30', '#c9b870', false));
  V.alligator = () => {
    const m = lizard(3.2, '#39402c', M.tex.spots('#39402c', '#2a301f', false))();
    m.head.scale.set(1.1, 0.8, 1.8);
    return m;
  };
  const tortoise = (s, shell) => () => {
    const m = quad({ L: 1.1 * s, H: 0.3 * s, W: 0.8 * s, leg: 0.25 * s, legR: 0.09 * s, color: '#5f5a4d', splay: 0.4, neckLen: 0.7 * s, neckAngle: 0.9, neckR: 0.07 * s, head: [0.1 * s, 0.09 * s, 0.14 * s], headPitch: 0.3, stride: 0.2, gait: 0.25 });
    const dome = mesh(new T.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.mat(shell), [0, 0.3 * s, 0], [0.62 * s, 0.55 * s, 0.75 * s]);
    m.body.add(dome);
    return m;
  };
  V.galapagos_tortoise = tortoise(1.3, '#3f3a31');
  V.aldabra_tortoise = tortoise(1.1, '#4f4639');
  // Marine & others
  V.sea_lion = () => {
    const m = quad({ L: 1.9, H: 0.6, W: 0.55, leg: 0.12, legR: 0.12, color: '#6b5440', pitch: -0.25, splay: 0.6, splayOut: 0.9, neckLen: 0.45, neckAngle: 0.5, neckR: 0.18, head: [0.16, 0.16, 0.22], snout: 0.12, ears: { w: 0.02, h: 0.04 }, stride: 0.2, gait: 1.5 });
    m.swims = true;
    return m;
  };
  V.river_otter = () => {
    const m = quad({ L: 1.0, H: 0.25, W: 0.25, leg: 0.12, legR: 0.04, color: '#5a3e2a', belly: '#9c8468', neckLen: 0.12, neckAngle: 1.0, neckR: 0.09, head: [0.09, 0.08, 0.11], snout: 0.05, tail: { len: 0.5, r: 0.06, angle: -1.8 }, stride: 0.5, gait: 1.8 });
    m.swims = true;
    return m;
  };
  // --- Species added for the real collections ---
  V.black_rhino = () =>
    quad({ L: 2.9, H: 1.4, W: 1.3, leg: 0.8, legR: 0.2, color: '#6f6862', neckLen: 0.7, neckAngle: 1.2, neckR: 0.45, head: [0.4, 0.42, 0.6], headPitch: 0.1, nose: false, stride: 0.32, gait: 0.9,
      ears: { w: 0.1, h: 0.25 }, tail: { len: 0.5, r: 0.04, tuft: '#333' },
      extra: (m) => {
        m.head.add(mesh(G.cone, M.mat('#8a7f72'), [0, 0.25, 0.85], [0.11, 0.55, 0.11], [0.2, 0, 0]));
        m.head.add(mesh(G.cone, M.mat('#8a7f72'), [0, 0.3, 0.5], [0.09, 0.35, 0.09], [0.1, 0, 0]));
      } });
  V.plains_zebra = zebraLike(M.tex.stripes('#f2efe6', '#161616', 14), '#f2efe6');
  V.masai_giraffe = () => {
    const tex = M.tex.patches('#6b3a1c', '#efe0c0');
    return quad({ L: 2.2, H: 1.3, W: 1.0, frontLeg: 2.0, backLeg: 1.8, legR: 0.12, color: '#e8c996', map: tex, legMap: tex, neckMap: tex, neckLen: 2.3, neckAngle: 0.35, neckR: 0.22,
      head: [0.22, 0.25, 0.45], headColor: '#9a6a3f', headPitch: 0.3, snout: 0.25, stride: 0.5, gait: 0.8, ears: { w: 0.08, h: 0.2 }, tail: { len: 0.9, r: 0.04, tuft: '#2a1d12' },
      extra: (m) => { for (const sx of [1, -1]) m.head.add(mesh(G.cyl, M.mat('#3a2616'), [sx * 0.1, 0.32, 0.05], [0.04, 0.25, 0.04])); } });
  };
  V.spotted_hyena = () =>
    quad({ L: 1.4, H: 0.6, W: 0.45, frontLeg: 0.75, backLeg: 0.55, legR: 0.07, pitch: 0.15, color: '#b8a07a', map: M.tex.spots('#b8a07a', '#4a3a2a', false), legMap: M.tex.spots('#b8a07a', '#4a3a2a', false),
      neckLen: 0.35, neckAngle: 0.9, neckR: 0.16, head: [0.17, 0.17, 0.24], headColor: '#a88f6a', snout: 0.15, snoutColor: '#2a2420', ears: { w: 0.07, h: 0.1, round: true }, tail: { len: 0.4, r: 0.04, tuft: '#222' }, gait: 1.1 });
  V.greater_kudu = () =>
    quad({ L: 1.9, H: 1.0, W: 0.7, leg: 1.0, legR: 0.08, color: '#8a7a68', map: M.tex.stripes('#8a7a68', '#f0eadc', 8), neckLen: 0.7, neckAngle: 0.7, neckR: 0.18, head: [0.18, 0.22, 0.5], snout: 0.2,
      ears: { w: 0.14, h: 0.28 }, tail: { len: 0.5, r: 0.03, tuft: '#222' },
      extra: (m) => {
        for (const sx of [1, -1]) {
          m.head.add(mesh(G.cone, M.mat('#3a2e22'), [sx * 0.16, 0.5, -0.12], [0.06, 0.8, 0.06], [-0.45, 0, sx * 0.35]));
          m.head.add(mesh(G.cone, M.mat('#3a2e22'), [sx * 0.3, 0.95, -0.35], [0.045, 0.55, 0.045], [-0.2, 0, -sx * 0.3]));
        }
      } });
  V.nile_crocodile = () => {
    const m = lizard(3.6, '#6e6a44', M.tex.spots('#6e6a44', '#3e3a24', false))();
    m.head.scale.set(1.1, 0.8, 1.9);
    return m;
  };
  V.siamang = ape(0.9, '#141414', '#2a2a2a', 1.25);
  V.malayan_tiger = cat(1.8, '#c86e22', M.tex.stripes('#c86e22', '#150e08', 20), null, null, M.tex.rings('#c86e22', '#150e08', 5));
  V.humboldt_penguin = () =>
    biped({ L: 0.3, H: 0.55, W: 0.3, leg: 0.06, legR: 0.03, legColor: '#222', color: '#26262a', belly: '#f4f4ef', pitch: -0.15, neckLen: 0.02, neckAngle: 0, head: [0.1, 0.1, 0.11], headColor: '#26262a', beak: '#e89a8a', beakLen: 0.09, gait: 2.2,
      extra: (m, c) => {
        for (const sx of [1, -1]) m.body.add(mesh(G.sphere, M.mat('#26262a'), [sx * 0.16, c.bodyY, 0], [0.03, 0.2, 0.08], [0, 0, sx * 0.2]));
        m.swims = true;
      } });
  V.chilean_flamingo = () =>
    biped({ L: 0.55, H: 0.35, W: 0.3, leg: 0.8, legR: 0.025, legColor: '#9aa0a8', color: '#f4bfc8', neckLen: 0.65, neckAngle: 0.15, neckR: 0.035, head: [0.07, 0.07, 0.09], beak: '#222', beakLen: 0.14, beakDown: 0.8, gait: 1.2,
      extra: (m) => m.body.add(mesh(G.cone, M.mat('#1a1a1a'), [0, 0.95, -0.3], [0.08, 0.2, 0.08], [-1.8, 0, 0])) });
  V.bonobo = ape(1.0, '#161413', '#3a2e2a', 0.8, (m, c) => m.head.add(mesh(G.sphere, M.mat('#161413'), [0, c.hs[1] * 0.6, -0.02], [c.hs[0] * 1.05, c.hs[1] * 0.5, c.hs[2]])));
  V.amur_leopard = cat(1.6, '#e3c9a0', M.tex.spots('#e3c9a0', '#2a1d10', true));
  V.hamadryas_baboon = () =>
    quad({ L: 0.9, H: 0.45, W: 0.36, frontLeg: 0.5, backLeg: 0.42, legR: 0.05, color: '#76705f', legColor: '#5c5649', neckLen: 0.14, neckAngle: 1.0, neckR: 0.11, head: [0.12, 0.12, 0.16], headColor: '#8a8474', snout: 0.14, snoutColor: '#d98a7a',
      tail: { len: 0.55, r: 0.035, angle: -1.3, taper: false, color: '#6f685c' }, gait: 1.2, pitch: 0.2,
      extra: (m, c) => m.body.add(mesh(G.lowSphere, M.mat('#958f80'), [0, c.bodyY + 0.1, 0.25], [0.24, 0.2, 0.22])) });
  V.sloth_bear = bear(1.6, '#141210', (m, c) => {
    m.body.add(mesh(G.cone, M.mat('#e8e0cc'), [0, c.bodyY + 0.05, c.o.L * 0.43], [0.14, 0.2, 0.04], [Math.PI, 0, 0]));
    m.body.add(mesh(G.lowSphere, M.mat('#141210'), [0, c.bodyY + 0.3, c.o.L * 0.25], [0.55, 0.35, 0.4]));
  });
  V.gray_seal = () => {
    const m = quad({ L: 2.0, H: 0.65, W: 0.6, leg: 0.1, legR: 0.12, color: '#8a8a88', map: M.tex.spots('#8a8a88', '#5a5a5a', false), pitch: -0.1, splay: 0.6, splayOut: 0.9, neckLen: 0.3, neckAngle: 0.7, neckR: 0.2, head: [0.18, 0.17, 0.24], snout: 0.14, stride: 0.2, gait: 1.2 });
    m.swims = true;
    return m;
  };
  V.sumatran_orangutan = ape(1.2, '#c9682e', '#6a4a3a', 1.0);

  const SWIMMERS = ['humboldt_penguin', 'gray_seal', 'nile_crocodile', 'malayan_tiger', 'hippo', 'sea_lion', 'river_otter', 'african_penguin', 'polar_bear', 'alligator', 'jaguar', 'water_monitor', 'pygmy_hippo', 'asian_elephant', 'flamingo', 'nene'];
  M.swims = (id) => SWIMMERS.includes(id);
  M.SIZE = { african_elephant: 1, asian_elephant: 0.92 };

  // Merge sibling meshes that share a material into one mesh per group
  // (keeps animation pivots intact, cuts draw calls ~3-4x).
  function collapse(group) {
    const byMat = new Map();
    for (const ch of group.children.slice()) {
      if (ch.isMesh && !ch.material.map) {
        if (!byMat.has(ch.material)) byMat.set(ch.material, []);
        byMat.get(ch.material).push(ch);
      } else if (ch.isGroup || ch.type === 'Object3D') collapse(ch);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const pos = [], nor = [];
      for (const m of list) {
        m.updateMatrix();
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
        pos.push(...g.attributes.position.array);
        nor.push(...g.attributes.normal.array);
        group.remove(m);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      const merged = new T.Mesh(geo, mat);
      merged.castShadow = true;
      merged.userData.merged = true;
      group.add(merged);
    }
  }
  M.collapse = collapse;

  M.animal = function (spId, sex, baby) {
    let f = V[spId];
    if (spId === 'lion' && sex === 'F') f = V.lioness;
    if (!f) f = V.alpaca;
    const m = f();
    m.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    if (sex === 'M' && ['gorilla', 'orangutan', 'sumatran_orangutan', 'african_elephant', 'asian_elephant', 'giraffe', 'masai_giraffe', 'hippo'].includes(spId)) m.root.scale.setScalar(1.1);
    if (baby) {
      m.root.scale.multiplyScalar(0.45);
      m.head.scale.multiplyScalar(1.25);
    }
    collapse(m.root);
    m.phase = Math.random() * 6;
    m.sp = spId;
    return m;
  };

  // Animate a model: speed in world units/sec (0 = idle)
  M.animate = function (m, dt, speed, t) {
    const moving = speed > 0.05;
    m.phase += dt * (moving ? 3 + speed * 2.2 : 1) * m.gait;
    const amp = moving ? m.stride : 0;
    for (const l of m.legs) l.rotation.x += (Math.sin(m.phase + l.userData.phase) * amp - l.rotation.x) * Math.min(1, dt * 12);
    if (m.hops && moving) m.body.position.y = Math.abs(Math.sin(m.phase)) * 0.4;
    else m.body.position.y = moving ? Math.abs(Math.sin(m.phase * 2)) * 0.03 : 0;
    if (m.head) m.head.rotation.y = moving ? 0 : Math.sin(t * 0.5 + m.phase * 0.1) * 0.35;
    if (m.tail) m.tail.rotation.z = Math.sin(t * 2 + m.phase) * 0.25;
    if (m.trunk) m.trunk.forEach((g, i) => (g.rotation.z = Math.sin(t * 1.2 + i * 0.7 + m.phase) * 0.12));
    if (m.biped && !moving) m.neck.rotation.x = (m.neck.userData.base == null ? (m.neck.userData.base = m.neck.rotation.x) : m.neck.userData.base) + Math.max(0, Math.sin(t * 0.7 + m.phase)) * 0.4;
  };

  // ---------------------------------------------------------------------
  // Director avatar
  // ---------------------------------------------------------------------
  M.avatar = function (look) {
    const root = new T.Group();
    const skin = M.mat(look.skin), outfit = M.mat(look.outfit), pants = M.mat('#3b3a36'), hair = M.mat(look.hair);
    const legs = [], arms = [];
    for (const sx of [1, -1]) {
      const p = new T.Group();
      p.position.set(sx * 0.13, 0.9, 0);
      p.add(mesh(G.cyl, pants, [0, -0.45, 0], [0.1, 0.9, 0.1]));
      p.add(mesh(G.box, M.mat('#4a3322'), [0, -0.87, 0.06], [0.14, 0.1, 0.28]));
      p.userData = { phase: sx > 0 ? 0 : Math.PI };
      root.add(p);
      legs.push(p);
      const a = new T.Group();
      a.position.set(sx * 0.32, 1.45, 0);
      a.add(mesh(G.cyl, outfit, [0, -0.2, 0], [0.075, 0.4, 0.075]));
      a.add(mesh(G.cyl, skin, [0, -0.52, 0], [0.065, 0.28, 0.065]));
      a.userData = { phase: sx > 0 ? Math.PI : 0 };
      root.add(a);
      arms.push(a);
    }
    const build = look.build || 'average';
    if (build === 'narrow') {
      root.add(mesh(G.box, outfit, [0, 1.26, 0], [0.44, 0.54, 0.26]));
      root.add(mesh(G.box, outfit, [0, 0.98, 0], [0.5, 0.2, 0.29]));
    } else root.add(mesh(G.box, outfit, [0, 1.22, 0], [build === 'broad' ? 0.56 : 0.5, 0.62, build === 'broad' ? 0.3 : 0.28]));
    root.add(mesh(G.box, M.mat('#f5f0dc'), [0.12, 1.3, 0.15], [0.08, 0.1, 0.02]));
    root.add(mesh(G.sphere, skin, [0, 1.78, 0], [0.19, 0.22, 0.2]));
    for (const sx of [1, -1]) root.add(mesh(G.sphere, M.mat('#1a1a1a'), [sx * 0.07, 1.8, 0.18], [0.025, 0.03, 0.02]));
    const hs = look.hairStyle;
    if (hs !== 'bald') {
      root.add(mesh(new T.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, [0, 1.82, -0.01], [0.205, 0.2, 0.215]));
      if (hs === 'long') root.add(mesh(G.box, hair, [0, 1.62, -0.12], [0.38, 0.4, 0.08]));
      if (hs === 'bun') root.add(mesh(G.sphere, hair, [0, 2.0, -0.12], [0.1, 0.1, 0.1]));
      if (hs === 'ponytail') root.add(mesh(G.sphere, hair, [0, 1.72, -0.25], [0.07, 0.18, 0.07], [0.5, 0, 0]));
      if (hs === 'curly') for (let i = 0; i < 7; i++) root.add(mesh(G.sphere, hair, [Math.cos(i) * 0.15, 1.95 + Math.sin(i * 3) * 0.02, Math.sin(i) * 0.12 - 0.03], [0.08, 0.08, 0.08]));
    }
    if (look.hat === 'safari') {
      root.add(mesh(G.cyl, M.mat('#c8b27a'), [0, 1.95, 0], [0.34, 0.03, 0.34]));
      root.add(mesh(G.sphere, M.mat('#c8b27a'), [0, 1.96, 0], [0.2, 0.15, 0.21]));
    } else if (look.hat === 'cap') {
      root.add(mesh(G.sphere, outfit, [0, 1.9, 0], [0.21, 0.13, 0.22]));
      root.add(mesh(G.box, outfit, [0, 1.88, 0.2], [0.24, 0.02, 0.18]));
    } else if (look.hat === 'bucket') {
      root.add(mesh(G.taper, M.mat('#6d7a4f'), [0, 1.95, 0], [0.24, 0.18, 0.24], [Math.PI, 0, 0]));
      root.add(mesh(G.cyl, M.mat('#6d7a4f'), [0, 1.88, 0], [0.3, 0.02, 0.3]));
    }
    root.traverse((o) => o.isMesh && (o.castShadow = true));
    collapse(root);
    return { root, legs, arms, phase: 0 };
  };
  M.animateAvatar = function (a, dt, speed) {
    const moving = speed > 0.1;
    a.phase += dt * (moving ? 4 + speed * 0.8 : 0);
    const amp = moving ? 0.6 : 0;
    for (const l of a.legs) l.rotation.x += (Math.sin(a.phase + l.userData.phase) * amp - l.rotation.x) * Math.min(1, dt * 12);
    for (const l of a.arms) l.rotation.x += (Math.sin(a.phase + l.userData.phase) * amp * 0.7 - l.rotation.x) * Math.min(1, dt * 12);
  };
})((globalThis.ZG = globalThis.ZG || {}));
