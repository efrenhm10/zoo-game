// Real-world surroundings for each zoo: terrain, water, trees, city districts,
// roads with traffic and landmarks. World units are metres; the zoo sits in
// roughly X ∈ [-200, 200], Z ∈ [-125, 130] with its entrance to the south (+Z).
(function (ZG) {
  const T = THREE;
  const Mo = ZG.Models;
  const S = (ZG.Settings = {});

  // ---------------------------------------------------------------------
  // Noise
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
  const ridge = (x, y, s) => 1 - Math.abs(vnoise(x, y, s) * 2 - 1);
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  S.fbm = fbm;
  function rng(seed) {
    let t = seed >>> 0 || 1;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ellipse = (X, Z, cx, cz, rx, rz) => ((X - cx) / rx) ** 2 + ((Z - cz) / rz) ** 2;
  const inRect = (X, Z, x0, z0, x1, z1) => X > x0 && X < x1 && Z > z0 && Z < z1;
  // Keep-clear zone: the zoo, its entrance plaza and parking lot
  const nearZoo = (X, Z, pad) => inRect(X, Z, -205 - (pad || 0), -130 - (pad || 0), 205 + (pad || 0), 170 + (pad || 0));

  // ---------------------------------------------------------------------
  // Kit: buildings, roads, traffic, props
  // ---------------------------------------------------------------------
  const K = (S.kit = {});
  let winTex = null;
  function windowTexture() {
    if (winTex) return winTex;
    winTex = Mo.canvasTex('facade', 64, 64, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      const grd = g.createLinearGradient(0, 18, 0, 44);
      grd.addColorStop(0, '#a9c4da');
      grd.addColorStop(1, '#6d8aa3');
      g.fillStyle = grd;
      g.fillRect(16, 18, 32, 26);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(16, 18, 32, 4);
      g.fillStyle = '#e4e4e4';
      g.fillRect(0, 54, 64, 10);
    });
    return winTex;
  }

  // Merge a list of axis-aligned (optionally rotated) buildings into one mesh
  // with world-scaled window UVs. b = {x, z, y, w, d, h, color, roof, rot, windows}
  K.buildings = function (list, opts) {
    const pos = [], nor = [], uv = [], col = [];
    const c = new T.Color(), rc = new T.Color();
    const cellW = (opts && opts.cellW) || 4, cellH = (opts && opts.cellH) || 3.6;
    for (const b of list) {
      c.set(b.color);
      rc.set(b.roof || '#8a8a86');
      const cos = Math.cos(b.rot || 0), sin = Math.sin(b.rot || 0);
      const P = (lx, y, lz) => [b.x + lx * cos - lz * sin, (b.y || 0) + y, b.z + lx * sin + lz * cos];
      const hw = b.w / 2, hd = b.d / 2;
      const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      for (let i = 0; i < 4; i++) {
        const a = corners[i], bb = corners[(i + 1) % 4];
        const len = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
        const nx = (bb[1] - a[1]) / len, nz = -(bb[0] - a[0]) / len;
        const n = [nx * cos - nz * sin, 0, nx * sin + nz * cos];
        const p0 = P(a[0], -2, a[1]), p1 = P(bb[0], -2, bb[1]), p2 = P(bb[0], b.h, bb[1]), p3 = P(a[0], b.h, a[1]);
        const u1 = b.windows === false ? 0.02 : len / cellW, v1 = b.windows === false ? 0.02 : b.h / cellH;
        pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
        for (let k = 0; k < 6; k++) nor.push(...n), col.push(c.r, c.g, c.b);
        uv.push(0, 0, u1, 0, u1, v1, 0, 0, u1, v1, 0, v1);
      }
      const r0 = P(-hw, b.h, -hd), r1 = P(hw, b.h, -hd), r2 = P(hw, b.h, hd), r3 = P(-hw, b.h, hd);
      pos.push(...r0, ...r2, ...r1, ...r0, ...r3, ...r2);
      for (let k = 0; k < 6; k++) nor.push(0, 1, 0), col.push(rc.r, rc.g, rc.b), uv.push(0.02, 0.95);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ map: windowTexture(), vertexColors: true, roughness: 0.75 }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // Scatter buildings in a region on a jittered street grid
  K.district = function (ctx, o) {
    const r = rng(o.seed || 7);
    const list = [];
    const step = o.block || 34;
    for (let x = o.x0; x < o.x1; x += step)
      for (let z = o.z0; z < o.z1; z += step) {
        if (r() < (o.gaps || 0.12)) continue;
        const X = x + step / 2 + (r() - 0.5) * 4, Z = z + step / 2 + (r() - 0.5) * 4;
        if (o.avoid && o.avoid(X, Z)) continue;
        if (nearZoo(X, Z, 20)) continue;
        const dens = o.density ? o.density(X, Z) : 1;
        if (r() > dens) continue;
        const hMax = o.height ? o.height(X, Z, r) : o.hMin + r() * (o.hMax - o.hMin);
        const w = (o.wMin || 14) + r() * ((o.wMax || 26) - (o.wMin || 14)), d = (o.dMin || 14) + r() * ((o.dMax || 26) - (o.dMin || 14));
        list.push({ x: X, z: Z, y: ctx.h(X, Z), w: Math.min(w, step - 6), d: Math.min(d, step - 6), h: hMax, color: o.palette[Math.floor(r() * o.palette.length)], roof: o.roof || '#7d7a72', rot: o.rot || 0 });
      }
    if (list.length) ctx.scene.add(K.buildings(list));
    return list;
  };

  let roadTex = null;
  function roadTexture() {
    if (roadTex) return roadTex;
    roadTex = Mo.canvasTex('road', 64, 128, (g, w, h) => {
      g.fillStyle = '#4b4d4f';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = '#e9c341';
      g.fillRect(30, 0, 2, 64);
      g.fillRect(33, 0, 2, 64);
      g.fillStyle = '#e6e6e6';
      g.fillRect(3, 0, 2, h);
      g.fillRect(w - 5, 0, 2, h);
    });
    return roadTex;
  }
  // Roads that follow the terrain; pts are [X, Z] polylines
  K.roads = function (ctx, roads) {
    const pos = [], nor = [], uv = [];
    for (const rd of roads) {
      const pts = densify(rd.pts, 8);
      let vAcc = 0;
      const w = rd.w || 14;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        const ya = ctx.h(ax, az) + 0.12, yb = ctx.h(bx, bz) + 0.12;
        const a1 = [ax + (nx * w) / 2, ya, az + (nz * w) / 2], a2 = [ax - (nx * w) / 2, ya, az - (nz * w) / 2];
        const b1 = [bx + (nx * w) / 2, yb, bz + (nz * w) / 2], b2 = [bx - (nx * w) / 2, yb, bz - (nz * w) / 2];
        const v0 = vAcc / 12, v1 = (vAcc + len) / 12;
        pos.push(...a1, ...b2, ...b1, ...a1, ...a2, ...b2);
        uv.push(0, v0, 1, v1, 0, v1, 0, v0, 1, v0, 1, v1);
        for (let k = 0; k < 6; k++) nor.push(0, 1, 0);
        vAcc += len;
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ map: roadTexture(), roughness: 0.9, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true;
    ctx.scene.add(m);
    for (const rd of roads) if (rd.cars) ctx.traffic(rd.pts, rd.cars, rd.w || 14, rd.speed);
  };
  function densify(pts, step) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
      for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    return out;
  }
  K.densify = densify;

  // A generic prop helper
  const mat = (c, o) => Mo.mat(c, o);
  const box = (g, c, x, y, z, w, h, d, ry) => {
    const m = Mo.mesh(Mo.G.box, mat(c), [x, y + h / 2, z], [w, h, d], [0, ry || 0, 0]);
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  K.box = box;

  function obelisk(g, x, y, z, h, base) {
    const shaft = new T.CylinderGeometry(base * 0.62, base, h, 4, 1);
    const m = Mo.mesh(shaft, mat('#f1ede3'), [x, y + h / 2, z], null, [0, Math.PI / 4, 0]);
    g.add(m);
    g.add(Mo.mesh(new T.ConeGeometry(base * 0.62, base * 1.2, 4), mat('#f1ede3'), [x, y + h + base * 0.6, z], null, [0, Math.PI / 4, 0]));
  }
  function dome(g, x, y, z, s, color) {
    box(g, color, x, y, z, 70 * s, 22 * s, 36 * s);
    box(g, color, x - 55 * s, y, z, 40 * s, 18 * s, 30 * s);
    box(g, color, x + 55 * s, y, z, 40 * s, 18 * s, 30 * s);
    g.add(Mo.mesh(new T.CylinderGeometry(14 * s, 15 * s, 18 * s, 20), mat(color), [x, y + 31 * s, z]));
    g.add(Mo.mesh(new T.SphereGeometry(14 * s, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { smooth: true }), [x, y + 40 * s, z]));
    g.add(Mo.mesh(new T.CylinderGeometry(2.4 * s, 3 * s, 10 * s, 10), mat(color), [x, y + 58 * s, z]));
  }

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------

  // HONOLULU — Kapiʻolani Park in Waikīkī: Diamond Head to the east, the
  // beach and Pacific to the south, hotel towers to the west, Koʻolau
  // mountains far inland to the north.
  S.honolulu = {
    sky: { top: '#3f8fd8', bottom: '#d6ecf7', fogNear: 700, fogFar: 3200 },
    water: { level: -1.2, color: '#2f8fb8' },
    height(X, Z) {
      let h = 0;
      // Pacific Ocean to the south
      const shore = 330 + Math.sin(X * 0.004) * 30 + Math.sin(X * 0.013) * 8;
      if (Z > shore) h = -2 - Math.min(18, (Z - shore) * 0.08);
      // Diamond Head (Lēʻahi) tuff cone
      const dx = X - 1050, dz = Z - 330;
      const r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
      const rim = 360 + Math.sin(ang * 3) * 25;
      const lift = Math.exp(-(((r - rim) / 160) ** 2)) * (190 + 45 * Math.sin(ang + 0.8)) * (0.8 + 0.35 * ridge(ang * 5, r * 0.01, 3));
      const bowl = r < rim ? 40 * (r / rim) ** 2 : 0;
      const dh = lift + bowl - (r < rim - 60 ? 25 : 0);
      if (lift > 0.5) h = Math.max(h, dh);
      // Koʻolau Range far inland
      if (Z < -900) h = Math.max(h, (-900 - Z) * 0.5 * (0.6 + 0.6 * ridge(X * 0.004, Z * 0.004, 5)));
      return h;
    },
    ground(X, Z, h, c) {
      if (h < -0.6) return c.set('#e2d3a4');
      const shore = 330 + Math.sin(X * 0.004) * 30 + Math.sin(X * 0.013) * 8;
      if (Z > shore - 40 && h < 4) return c.set('#eadcb0').lerp(c.clone().set('#d8c690'), fbm(X * 0.05, Z * 0.05, 2) * 0.5);
      if (h > 12) return c.set('#9a8a5a').lerp(new T.Color('#6f7f3f'), Math.min(1, fbm(X * 0.02, Z * 0.02, 4) * 1.2));
      if (X < -330) return c.set('#9aa096');
      return c.set('#7fb35a').lerp(new T.Color('#6aa24a'), fbm(X * 0.03, Z * 0.03, 1));
    },
    tree(X, Z, h, r) {
      if (h < 0 || h > 60 || X < -330) return null;
      if (Z > 290) return r() < 0.35 ? 'palm' : null;
      if (h > 12) return r() < 0.3 ? 'bush' : null;
      return r() < 0.22 ? (r() < 0.5 ? 'palm' : 'banyan') : null;
    },
    build(ctx) {
      const g = new T.Group();
      ctx.scene.add(g);
      // Waikīkī hotel towers west of the zoo
      K.district(ctx, {
        x0: -1450, x1: -350, z0: -700, z1: 420, block: 44, gaps: 0.1, seed: 11, wMin: 20, wMax: 38, dMin: 14, dMax: 26,
        palette: ['#f3efe4', '#e8e1cf', '#f5f2ea', '#dcd6c8', '#efe6d6'], roof: '#bdb7a8',
        height: (X, Z, r) => {
          const beach = Math.max(0, 1 - Math.abs(Z - 250) / 500);
          return 18 + r() * 40 + beach * (40 + r() * 80);
        },
        avoid: (X, Z) => Z > 330 + Math.sin(X * 0.004) * 30 - 30,
      });
      // Low-rise residential (Kapahulu) to the north
      K.district(ctx, { x0: -350, x1: 700, z0: -900, z1: -210, block: 30, seed: 12, hMin: 6, hMax: 14, wMin: 10, wMax: 18, dMin: 10, dMax: 18, palette: ['#e6e0d0', '#d8e0d8', '#f0e4d0', '#cfd8e0'], roof: '#8a5a4a' });
      // Roads: Kapahulu Ave (west), Kalākaua Ave (south), Monsarrat Ave (east)
      K.roads(ctx, [
        { pts: [[-240, -900], [-240, 200]], w: 16, cars: 14 },
        { pts: [[-1450, 205], [-240, 205], [300, 215], [560, 240], [640, 300]], w: 16, cars: 18 },
        { pts: [[0, 205], [0, 165]], w: 12 },
        { pts: [[260, -900], [260, 215]], w: 12, cars: 6 },
      ]);
      // Waikīkī Shell bandshell in Kapiʻolani Park
      const shell = Mo.mesh(new T.SphereGeometry(18, 16, 8, 0, Math.PI, 0, Math.PI / 2), mat('#f7f5ee', { double: true }), [430, 0, -40], [1, 0.9, 1], [0, Math.PI / 2, 0]);
      g.add(shell);
      // Beach umbrellas, surfers, catamarans
      const beachProps = [];
      const r = rng(5);
      for (let i = 0; i < 160; i++) {
        const X = -1200 + r() * 1800, shore = 330 + Math.sin(X * 0.004) * 30 + Math.sin(X * 0.013) * 8;
        beachProps.push([X, 0, shore - 5 - r() * 25, 1]);
      }
      const umb = Mo.merge([
        { geo: Mo.G.cyl, color: '#eeeeee', matrix: Mo.mtx(0, 1.2, 0, 0.05, 2.4, 0.05) },
        { geo: Mo.G.cone, color: '#e8563a', matrix: Mo.mtx(0, 2.5, 0, 1.4, 0.6, 1.4) },
      ]);
      ctx.instances(umb, beachProps, true, null, true);
      ctx.boats(18, (rr) => {
        const X = -1300 + rr() * 2400;
        return [X, 440 + rr() * 500];
      }, 'catamaran');
      ctx.scene.add(g);
    },
  };

  // HOUSTON — Hermann Park: McGovern Lake to the west, the downtown skyline
  // to the north, the Texas Medical Center towers just south, flat bayou city.
  S.houston = {
    sky: { top: '#5d97c9', bottom: '#e4e6de', fogNear: 600, fogFar: 3000 },
    water: null,
    height(X, Z) {
      let h = 0;
      if (ellipse(X, Z, -470, 60, 200, 120) < 1) h = -2.5; // McGovern Lake
      if (inRect(X, Z, -520, -420, -440, -220)) h = -1.2; // reflection pool
      const bayou = Z - (720 + Math.sin(X * 0.003) * 60);
      if (Math.abs(bayou) < 26) h = -6 + Math.abs(bayou) * 0.12; // Brays Bayou
      return h + (fbm(X * 0.01, Z * 0.01, 3) - 0.5) * 1.2;
    },
    ground(X, Z, h, c) {
      if (h < -1) return c.set('#8a9a72');
      if (Z < -520 || Z > 780 || X > 330) return c.set('#9a9c96').lerp(new T.Color('#7a8a66'), fbm(X * 0.02, Z * 0.02, 1) * 0.6);
      return c.set('#6f9f4f').lerp(new T.Color('#5d8e42'), fbm(X * 0.03, Z * 0.03, 1));
    },
    waterBodies: [
      { type: 'ellipse', x: -470, z: 60, rx: 196, rz: 116, y: -0.6, color: '#557f86' },
      { type: 'rect', x0: -518, z0: -418, x1: -442, z1: -222, y: -0.4, color: '#6f9aa8' },
    ],
    tree(X, Z, h, r) {
      if (h < -0.5 || Z < -520 || Z > 780 || X > 330) return null;
      return r() < 0.35 ? (r() < 0.75 ? 'oak' : 'conifer') : null;
    },
    build(ctx) {
      const g = new T.Group();
      ctx.scene.add(g);
      // Downtown skyline (far north)
      const towers = [];
      const r = rng(21);
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 260;
        const X = 250 + Math.cos(a) * d, Z = -1250 + Math.sin(a) * d * 0.7;
        const tall = Math.max(0, 1 - d / 260);
        towers.push({ x: X, z: Z, y: 0, w: 28 + r() * 26, d: 28 + r() * 26, h: 60 + tall * (140 + r() * 140), color: ['#9fb4c7', '#b8c8d2', '#8aa0b0', '#c9ccc8', '#7d97a8', '#d8d2c2'][Math.floor(r() * 6)], roof: '#6c7278' });
      }
      ctx.scene.add(K.buildings(towers, { cellW: 3, cellH: 4 }));
      // Texas Medical Center (just south)
      K.district(ctx, { x0: 120, x1: 700, z0: 820, z1: 1250, block: 60, seed: 22, gaps: 0.2, hMin: 40, hMax: 150, wMin: 26, wMax: 48, dMin: 22, dMax: 40, palette: ['#e8e4dc', '#c9d4dc', '#d6cfc0', '#bcc8d0'], roof: '#8a8a86' });
      // Museum District & midtown low-rise
      K.district(ctx, { x0: -900, x1: 900, z0: -950, z1: -560, block: 40, seed: 23, hMin: 8, hMax: 30, palette: ['#d9cfbd', '#c7b8a2', '#e6dfd2', '#b9a58c'], roof: '#6d6a64' });
      K.district(ctx, { x0: 360, x1: 1400, z0: -560, z1: 820, block: 40, seed: 24, hMin: 8, hMax: 26, palette: ['#e2d9c8', '#cfc4b0', '#bfc7cc'], roof: '#6d6a64' });
      // Roads: Main St/Fannin (east, with light rail), Hermann Dr (north), N. MacGregor (south)
      K.roads(ctx, [
        { pts: [[300, -1500], [300, 1500]], w: 22, cars: 26 },
        { pts: [[-1500, -520], [1500, -520]], w: 16, cars: 18 },
        { pts: [[-1500, 690], [1500, 690]], w: 16, cars: 18 },
        { pts: [[-60, 205], [300, 205]], w: 12, cars: 5 },
        { pts: [[0, 205], [0, 165]], w: 12 },
      ]);
      ctx.train([[318, -1500], [318, 1500]], '#d8d8d8', '#cc2229');
      // Pedal boats on McGovern Lake + island
      ctx.boats(10, (rr) => {
        const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * 0.75;
        return [-470 + Math.cos(a) * 196 * d, 60 + Math.sin(a) * 116 * d];
      }, 'pedal');
      // Pioneer Memorial obelisk & Miller Outdoor Theatre canopy
      obelisk(g, -480, 0, -470, 20, 3);
      const canopy = Mo.mesh(new T.CylinderGeometry(26, 26, 1.2, 24, 1, false, 0, Math.PI), mat('#e9e9e4', { double: true }), [-720, 12, -150], null, [0, 0.4, 0]);
      g.add(canopy);
      box(g, '#bdb7ac', -720, 0, -150, 8, 12, 8);
    },
  };

  // SAN DIEGO — Balboa Park on a mesa cut by canyons: El Prado's Spanish
  // Colonial buildings and the California Tower to the west, downtown and
  // San Diego Bay to the southwest, eucalyptus everywhere.
  S.sandiego = {
    sky: { top: '#3d8fe0', bottom: '#dfeef8', fogNear: 700, fogFar: 3400 },
    water: { level: -60, color: '#3a7fa8' },
    height(X, Z) {
      let h = 0;
      // Florida Canyon (east) and Cabrillo Canyon (west, SR-163)
      const fc = X - (330 + Math.sin(Z * 0.006) * 40);
      h -= Math.exp(-((fc / 55) ** 2)) * 38;
      const cc = X - (-760 + Math.sin(Z * 0.005) * 50);
      h -= Math.exp(-((cc / 70) ** 2)) * 45;
      h -= Math.max(0, fbm(X * 0.006, Z * 0.006, 8) - 0.62) * 120;
      // falls away toward the bay (southwest)
      const bay = (-X * 0.55 + Z * 0.8) - 1100;
      if (bay > 0) h -= bay * 0.25;
      return h;
    },
    ground(X, Z, h, c) {
      if (h < -55) return c.set('#cdbf95');
      if (h < -8) return c.set('#9c9a6a').lerp(new T.Color('#7e8c55'), fbm(X * 0.03, Z * 0.03, 2));
      if (Z > 560 || X < -1000) return c.set('#a0a09a');
      return c.set('#86ab58').lerp(new T.Color('#9fae62'), fbm(X * 0.03, Z * 0.03, 1));
    },
    tree(X, Z, h, r) {
      if (h < -55 || Z > 560 || X < -1000) return null;
      if (h < -8) return r() < 0.25 ? 'bush' : null;
      const k = r();
      return k < 0.14 ? 'eucalyptus' : k < 0.22 ? 'palm' : k < 0.26 ? 'jacaranda' : null;
    },
    build(ctx) {
      const g = new T.Group();
      ctx.scene.add(g);
      // El Prado: Spanish Colonial Revival museums with tile roofs
      const prado = [];
      for (let i = 0; i < 9; i++) {
        const X = -620 + i * 48, side = i % 2 ? 1 : -1;
        prado.push({ x: X, z: 10 + side * 55, y: ctx.h(X, 10 + side * 55), w: 40, d: 34, h: 14 + (i % 3) * 3, color: '#efe2c8', roof: '#b75a35' });
      }
      ctx.scene.add(K.buildings(prado, { cellW: 6, cellH: 5 }));
      // California Tower
      const tx = -600, tz = -40, ty = ctx.h(tx, tz);
      box(g, '#efe2c8', tx, ty, tz, 12, 38, 12);
      box(g, '#e8d8b8', tx, ty + 38, tz, 9, 10, 9);
      box(g, '#efe2c8', tx, ty + 48, tz, 7, 7, 7);
      g.add(Mo.mesh(new T.SphereGeometry(4.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#3b7fb5', { smooth: true }), [tx, ty + 55, tz]));
      g.add(Mo.mesh(Mo.G.cyl, mat('#d9a441'), [tx, ty + 61, tz], [0.4, 3, 0.4]));
      // Museum of Man dome
      g.add(Mo.mesh(new T.SphereGeometry(10, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#3a78ae', { smooth: true }), [-560, ctx.h(-560, -30) + 16, -30]));
      // Cabrillo Bridge across the canyon
      const bz = 10;
      for (let i = 0; i < 7; i++) {
        const X = -860 + i * 30;
        const y0 = ctx.h(X, bz);
        box(g, '#d9d2c2', X, y0, bz, 5, -y0 + 2, 10);
      }
      box(g, '#e6dfd0', -770, 2, bz, 220, 2, 12);
      // Downtown & the bay
      const r = rng(31);
      const towers = [];
      for (let i = 0; i < 40; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 220;
        const X = -900 + Math.cos(a) * d, Z = 1050 + Math.sin(a) * d * 0.8;
        towers.push({ x: X, z: Z, y: ctx.h(X, Z), w: 24 + r() * 22, d: 24 + r() * 22, h: 40 + (1 - d / 220) * (80 + r() * 90), color: ['#cfd8de', '#9fb3c2', '#e6e2d8', '#b7c3c9'][Math.floor(r() * 4)], roof: '#6e7478' });
      }
      ctx.scene.add(K.buildings(towers, { cellW: 3, cellH: 4 }));
      K.district(ctx, { x0: -500, x1: 900, z0: 600, z1: 1400, block: 38, seed: 32, hMin: 8, hMax: 22, palette: ['#e8dcc4', '#d7c7ab', '#efe7d8', '#c9d1d4'], roof: '#a8563a', avoid: (X, Z) => ctx.h(X, Z) < -30 });
      K.district(ctx, { x0: -500, x1: 1400, z0: -1400, z1: -600, block: 34, seed: 33, hMin: 6, hMax: 14, palette: ['#efe7d8', '#e3d4bb', '#d9e0e2'], roof: '#a8563a', avoid: (X, Z) => ctx.h(X, Z) < -20 });
      K.roads(ctx, [
        { pts: [[-760, -1500], [-760, 1500]], w: 22, cars: 26 },
        { pts: [[-1000, 205], [-240, 205], [700, 205]], w: 14, cars: 12 },
        { pts: [[0, 205], [0, 165]], w: 12 },
      ]);
      ctx.boats(14, (rr) => [-1300 + rr() * 500, 1250 + rr() * 250], 'sail');
    },
  };

  // NATIONAL ZOO — Rock Creek Park: a deep wooded valley with the creek to
  // the west, Woodley Park rowhouses along Connecticut Ave to the east, and
  // the Washington Monument and Capitol dome on the horizon.
  S.national = {
    sky: { top: '#5a93cc', bottom: '#e2e8ec', fogNear: 650, fogFar: 3400 },
    water: null,
    height(X, Z) {
      let h = (fbm(X * 0.004, Z * 0.004, 12) - 0.35) * 70;
      const creekX = -330 + Math.sin(Z * 0.004) * 90;
      const dc = X - creekX;
      h -= Math.exp(-((dc / 90) ** 2)) * 42;
      h += Math.max(0, X - 300) * 0.05;
      return h;
    },
    creek: (Z) => -330 + Math.sin(Z * 0.004) * 90,
    ground(X, Z, h, c) {
      if (X > 480 && Z < 400) return c.set('#9b9890');
      return c.set('#557f3c').lerp(new T.Color('#6b8f45'), fbm(X * 0.02, Z * 0.02, 2)).lerp(new T.Color('#7a6a4a'), Math.max(0, -h - 30) / 20);
    },
    tree(X, Z, h, r) {
      if (X > 480 && Z < 400) return r() < 0.12 ? 'oak' : null;
      const k = r();
      return k < 0.55 ? (k < 0.35 ? 'oak' : k < 0.45 ? 'autumn' : 'conifer') : null;
    },
    build(ctx) {
      const g = new T.Group();
      ctx.scene.add(g);
      // Rock Creek
      const pts = [];
      for (let Z = -1500; Z <= 1500; Z += 20) pts.push([S.national.creek(Z), Z]);
      ctx.river(pts, 14, '#5f8a8f');
      // Rowhouses & apartments along Connecticut Ave (Woodley Park)
      K.district(ctx, { x0: 480, x1: 1450, z0: -1450, z1: 400, block: 26, seed: 41, gaps: 0.08, hMin: 10, hMax: 24, wMin: 8, wMax: 22, dMin: 14, dMax: 20, palette: ['#9c4f3c', '#b5654a', '#c9b8a0', '#8a4a3a', '#d8cbb4', '#a8604a'], roof: '#4a3f38' });
      K.roads(ctx, [
        { pts: [[470, -1500], [470, 1500]], w: 18, cars: 22 },
        { pts: [[-260, -1500], [-260, -300], [-240, 205], [300, 205], [470, 205]], w: 12, cars: 10 },
        { pts: [[0, 205], [0, 165]], w: 12 },
      ]);
      // Taft Bridge arches over the valley
      for (let i = 0; i < 5; i++) {
        const X = 470, Z = 520 + i * 26;
        box(g, '#cfc6b4', X - 12, ctx.h(X, Z), Z, 6, Math.max(2, -ctx.h(X, Z)), 6);
      }
      // National Mall on the horizon
      obelisk(g, 520, 0, 1450, 169, 17);
      dome(g, 1350, 0, 1480, 1.3, '#f3f0e8');
    },
  };

  // CHEYENNE MOUNTAIN — on the mountainside at 6,714 ft: peaks and pine
  // forest rising to the west, the Broadmoor resort below, and Colorado
  // Springs spread across the plains to the east.
  S.cheyenne = {
    sky: { top: '#2f7fd6', bottom: '#d9ebf7', fogNear: 900, fogFar: 4200 },
    water: null,
    height(X, Z) {
      let h = 0;
      if (X < -210) {
        const d = -210 - X;
        h = Math.min(900, d * 0.62 + d * d * 0.0004) * (0.75 + 0.5 * ridge(X * 0.003, Z * 0.003, 6));
      }
      if (X > 210) h = -Math.min(160, (X - 210) * 0.22);
      h += Math.max(0, Math.abs(Z) - 260) * 0.12 * (X < 400 ? 1 : 0.2);
      h += (fbm(X * 0.01, Z * 0.01, 9) - 0.5) * 6;
      if (ellipse(X, Z, 700, 420, 110, 70) < 1) h = Math.min(h, -120);
      return h;
    },
    ground(X, Z, h, c) {
      if (h > 620) return c.set('#eef2f5');
      if (h > 250) return c.set('#6b6a5e').lerp(new T.Color('#2f4a2c'), fbm(X * 0.01, Z * 0.01, 3) * 0.8);
      if (X > 900) return c.set('#a4a296');
      if (ellipse(X, Z, 640, 520, 260, 120) < 1) return c.set('#78b04a');
      return c.set('#7f8f55').lerp(new T.Color('#5d7040'), fbm(X * 0.02, Z * 0.02, 2));
    },
    waterBodies: [{ type: 'ellipse', x: 700, z: 420, rx: 108, rz: 68, y: -119, color: '#4f86a6' }],
    tree(X, Z, h, r) {
      if (h > 560 || X > 900) return null;
      if (ellipse(X, Z, 640, 520, 260, 120) < 1) return r() < 0.05 ? 'deciduous' : null;
      return r() < (h > 60 ? 0.6 : 0.35) ? (r() < 0.85 ? 'conifer' : 'rock') : null;
    },
    build(ctx) {
      const g = new T.Group();
      ctx.scene.add(g);
      // Colorado Springs on the plains
      K.district(ctx, { x0: 900, x1: 1480, z0: -1450, z1: 1450, block: 30, seed: 51, gaps: 0.15, hMin: 6, hMax: 16, palette: ['#d9cfbd', '#c7b8a2', '#e6dfd2', '#bdb4a4'], roof: '#6d6258' });
      const r = rng(52);
      const dt = [];
      for (let i = 0; i < 18; i++) dt.push({ x: 1300 + r() * 150, z: -300 + r() * 300, y: ctx.h(1300, 0), w: 22, d: 22, h: 30 + r() * 60, color: '#c9ccc8', roof: '#6c7278' });
      ctx.scene.add(K.buildings(dt));
      // The Broadmoor: pink stucco with red-tile roofs around Cheyenne Lake
      const bm = [];
      for (let i = 0; i < 7; i++) {
        const a = -0.6 + i * 0.35, X = 700 + Math.cos(a) * 140, Z = 420 - Math.sin(a) * 95;
        bm.push({ x: X, z: Z, y: ctx.h(X, Z), w: 40, d: 26, h: 18 + (i === 3 ? 16 : 0), color: '#e8b8a8', roof: '#a8483a', rot: a });
      }
      ctx.scene.add(K.buildings(bm, { cellW: 5, cellH: 4 }));
      // Will Rogers Shrine of the Sun, up the mountain
      const sx = -560, sz = -160, sy = ctx.h(sx, sz);
      box(g, '#8a7a66', sx, sy, sz, 9, 32, 9);
      box(g, '#7a6a58', sx, sy + 32, sz, 10.5, 3, 10.5);
      // Mountaineer Sky Ride chairlift
      ctx.chairlift([-150, -60], [-470, -300]);
      K.roads(ctx, [
        { pts: [[0, 205], [0, 165]], w: 12 },
        { pts: [[0, 205], [300, 230], [500, 300], [650, 330], [900, 360], [1500, 360]], w: 12, cars: 14 },
        { pts: [[900, -1500], [900, 1500]], w: 16, cars: 16 },
      ]);
    },
  };
})((globalThis.ZG = globalThis.ZG || {}));
