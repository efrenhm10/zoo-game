// Canvas renderer: the zoo map, animals, guests, keepers, the director avatar,
// weather and effects. Also owns the camera and walk-mode movement.
(function (ZG) {
  const U = ZG.U;
  const R = (ZG.Render = {});
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const W = 1600, H = 1000;

  const st = {
    canvas: null, ctx: null, dpr: 1, cw: 0, ch: 0,
    cam: { x: W / 2, y: H / 2, zoom: 1 },
    staticCanvas: null, staticKey: '',
    sprites: new Map(), guests: [], keepers: [], fx: [], bubbles: [],
    avatar: { x: 800, y: 950, dir: 1, phase: 0, moving: false, target: null },
    walk: false, keys: {}, hover: null, selected: null, drag: null, lastT: 0, rngSeed: 1,
  };
  R.state = st;

  const rnd = () => Math.random();
  const seeded = (seed) => {
    let t = seed >>> 0;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };

  R.init = function (canvas) {
    st.canvas = canvas;
    st.ctx = canvas.getContext('2d');
    R.resize();
    window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    const c = st.canvas;
    if (!c) return;
    const r = c.getBoundingClientRect();
    st.dpr = Math.min(2, window.devicePixelRatio || 1);
    st.cw = Math.max(200, r.width);
    st.ch = Math.max(200, r.height);
    c.width = st.cw * st.dpr;
    c.height = st.ch * st.dpr;
    if (!st.walk) R.fitCamera();
  };
  R.fitCamera = function () {
    st.cam.zoom = Math.min(st.cw / W, st.ch / H) * 0.98;
    st.cam.x = W / 2;
    st.cam.y = H / 2;
  };
  R.minZoom = () => Math.min(st.cw / W, st.ch / H) * 0.9;
  R.screenToWorld = (sx, sy) => ({ x: (sx - st.cw / 2) / st.cam.zoom + st.cam.x, y: (sy - st.ch / 2) / st.cam.zoom + st.cam.y });

  R.plotAt = function (s, x, y) {
    return s.plots.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) || null;
  };

  // ---------------------------------------------------------------------
  // Avatar (shared with the character creator)
  // ---------------------------------------------------------------------
  ZG.drawAvatar = function (ctx, x, y, sc, look, dir, phase, label) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    const legSwing = Math.sin(phase) * 3;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // legs
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, 4);
    ctx.lineTo(-3 + legSwing, 11);
    ctx.moveTo(3, 4);
    ctx.lineTo(3 - legSwing, 11);
    ctx.stroke();
    // body
    ctx.fillStyle = look.outfit;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-7, -8, 14, 14, 5) : ctx.rect(-7, -8, 14, 14);
    ctx.fill();
    // arms
    ctx.strokeStyle = look.skin;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-7, -5);
    ctx.lineTo(-9 - legSwing * 0.5, 3);
    ctx.moveTo(7, -5);
    ctx.lineTo(9 + legSwing * 0.5, 3);
    ctx.stroke();
    // lanyard / badge
    ctx.fillStyle = '#f5f0dc';
    ctx.fillRect(dir > 0 ? 1 : -4, -4, 3, 4);
    // head
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(0, -14, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // hair
    ctx.fillStyle = look.hair;
    const hs = look.hairStyle;
    if (hs !== 'bald') {
      ctx.beginPath();
      ctx.arc(0, -15.5, 6.6, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
      if (hs === 'long') ctx.fillRect(-6.6, -16, 3, 11), ctx.fillRect(3.6, -16, 3, 11);
      if (hs === 'bun') {
        ctx.beginPath();
        ctx.arc(0, -22, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (hs === 'ponytail') {
        ctx.beginPath();
        ctx.ellipse(-dir * 7, -12, 2.2, 5, dir * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (hs === 'curly')
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(i * 2.8, -19.5, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
    }
    // eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(dir * 1.5 - 2, -14, 0.9, 0, Math.PI * 2);
    ctx.arc(dir * 1.5 + 2, -14, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // hat
    if (look.hat === 'safari') {
      ctx.fillStyle = '#c8b27a';
      ctx.beginPath();
      ctx.ellipse(0, -18.5, 10, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -19, 5.5, Math.PI, 0);
      ctx.fill();
    } else if (look.hat === 'cap') {
      ctx.fillStyle = look.outfit;
      ctx.beginPath();
      ctx.arc(0, -17.5, 6.4, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(dir > 0 ? 2 : -9, -18, 7, 2);
    } else if (look.hat === 'bucket') {
      ctx.fillStyle = '#6d7a4f';
      ctx.beginPath();
      ctx.moveTo(-8, -17);
      ctx.lineTo(8, -17);
      ctx.lineTo(5, -23);
      ctx.lineTo(-5, -23);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (label) {
      ctx.save();
      ctx.font = `bold ${Math.max(9, 10 * sc * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(20,30,20,0.75)';
      ctx.fillRect(x - tw / 2 - 4, y - 30 * sc - 8, tw + 8, 13);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y - 30 * sc + 2);
      ctx.restore();
    }
  };

  // ---------------------------------------------------------------------
  // Static layer (terrain, paths, habitats, buildings)
  // ---------------------------------------------------------------------
  function staticKey(s) {
    return s.zooId + '|' + s.habitats.map((h) => `${h.id}:${h.biome}:${h.construction ? 'c' : ''}${h.renovation ? 'r' : ''}:${Math.round(h.condition / 10)}:${Math.round(h.theming / 20)}:${h.climate}:${h.sponsor || ''}`).join(',');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  R.roundRect = roundRect;

  function emoji(ctx, ch, x, y, size, flip) {
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; // color emoji inherit the fill alpha
    if (flip) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    } else ctx.fillText(ch, x, y);
  }
  R.emoji = emoji;

  function buildStatic(s) {
    const SC = 2;
    const c = st.staticCanvas || document.createElement('canvas');
    c.width = W * SC;
    c.height = H * SC;
    const ctx = c.getContext('2d');
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
    const Z = ZG.zoo(s);
    const T = Z.theme;
    const r = seeded(s.seed);
    // grass
    ctx.fillStyle = T.grass;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.5 ? T.grass2 : 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.arc(r() * W, r() * H, 4 + r() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    const L = s.layout;
    // perimeter fence
    ctx.strokeStyle = 'rgba(70,55,35,0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(L.xs[0] - 40, L.ys[0] - 45, L.xs[L.cols] - L.xs[0] + 80, H - L.ys[0] + 25);
    ctx.setLineDash([]);
    // paths
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const drawPaths = (width, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (const x of L.xs) {
        ctx.beginPath();
        ctx.moveTo(x, L.ys[0]);
        ctx.lineTo(x, L.ys[L.rows]);
        ctx.stroke();
      }
      for (const y of L.ys) {
        ctx.beginPath();
        ctx.moveTo(L.xs[0], y);
        ctx.lineTo(L.xs[L.cols], y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(L.xs[3], L.ys[L.rows]);
      ctx.lineTo(L.entrance.x, H);
      ctx.stroke();
    };
    drawPaths(L.P + 6, 'rgba(120,100,70,0.35)');
    drawPaths(L.P - 4, T.path);
    // entrance plaza
    ctx.fillStyle = T.path;
    roundRect(ctx, L.entrance.x - 150, L.ys[L.rows] + 10, 300, H - L.ys[L.rows] - 10, 20);
    ctx.fill();
    // plaza pavers
    ctx.strokeStyle = 'rgba(150,130,100,0.25)';
    ctx.lineWidth = 1;
    for (let x = L.entrance.x - 140; x < L.entrance.x + 150; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, L.ys[L.rows] + 16);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    // Trees along paths & margins
    ctx.globalAlpha = 1;
    for (let i = 0; i < 170; i++) {
      const x = r() * W, y = r() * H;
      if (s.plots.some((p) => x > p.x - 8 && x < p.x + p.w + 8 && y > p.y - 8 && y < p.y + p.h + 8)) continue;
      const nearPath = L.xs.some((px) => Math.abs(px - x) < L.P / 2 + 4) || L.ys.some((py) => Math.abs(py - y) < L.P / 2 + 4);
      if (nearPath) continue;
      if (y > L.ys[L.rows] && Math.abs(x - L.entrance.x) < 160) continue;
      emoji(ctx, T.trees[Math.floor(r() * T.trees.length)], x, y, 16 + r() * 12);
    }
    // plots
    for (const p of s.plots) {
      const h = p.hab ? s.habitatsById[p.hab] : null;
      if (p.kind === 'vet') drawBuilding(ctx, p, '#dfe3e6', '#8b99a6', '🏥', 'Animal Hospital & Quarantine', r);
      else if (p.kind === 'cafe') drawCafe(ctx, p, r);
      else if (!h) drawEmptyLot(ctx, p, r);
      else drawHabitat(ctx, s, p, h);
    }
    // entrance gate & gift shop
    const ex = L.entrance.x, ey = H - 45;
    ctx.fillStyle = '#6b4b2a';
    ctx.fillRect(ex - 90, ey - 30, 14, 40);
    ctx.fillRect(ex + 76, ey - 30, 14, 40);
    ctx.fillStyle = '#8b5e34';
    roundRect(ctx, ex - 100, ey - 50, 200, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#fff5dc';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Z.name.toUpperCase(), ex, ey - 37);
    emoji(ctx, '🎟️', ex - 120, ey, 22);
    drawMiniBuilding(ctx, ex + 110, ey - 18, 56, 36, '#f3d9a4', '#b5652b', '🎁', 'Gift Shop');
    return c;
  }

  function drawMiniBuilding(ctx, x, y, w, h, wall, roof, icon, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    roundRect(ctx, x + 3, y + 4, w, h, 5);
    ctx.fill();
    ctx.fillStyle = wall;
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.fillStyle = roof;
    roundRect(ctx, x - 3, y - 6, w + 6, 12, 4);
    ctx.fill();
    emoji(ctx, icon, x + w / 2, y + h / 2 + 3, 18);
    if (label) {
      ctx.fillStyle = '#3b2f22';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + w / 2, y + h + 9);
    }
  }

  function drawBuilding(ctx, p, wall, roof, icon, label, r) {
    ctx.fillStyle = '#b9c7a3';
    roundRect(ctx, p.x, p.y, p.w, p.h, 14);
    ctx.fill();
    const bw = p.w * 0.62, bh = p.h * 0.45;
    const bx = p.x + (p.w - bw) / 2, by = p.y + 22;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    roundRect(ctx, bx + 5, by + 6, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = wall;
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = roof;
    roundRect(ctx, bx - 4, by - 8, bw + 8, 16, 6);
    ctx.fill();
    emoji(ctx, icon, bx + bw / 2, by + bh / 2 + 4, 30);
    // quarantine pens
    ctx.strokeStyle = '#7d8a70';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const px = p.x + 14 + i * ((p.w - 28) / 3), py = p.y + p.h * 0.62;
      ctx.strokeRect(px, py, (p.w - 28) / 3 - 8, p.h * 0.3);
    }
    label && labelSign(ctx, p.x + p.w / 2, p.y + p.h - 6, label, '#5b6b7a');
  }

  function drawCafe(ctx, p, r) {
    ctx.fillStyle = '#e8dcc2';
    roundRect(ctx, p.x, p.y, p.w, p.h, 14);
    ctx.fill();
    drawMiniBuilding(ctx, p.x + p.w / 2 - 50, p.y + 26, 100, 56, '#f6e3b8', '#c0392b', '🍔', null);
    for (let i = 0; i < 8; i++) {
      const x = p.x + 24 + (i % 4) * ((p.w - 48) / 3), y = p.y + p.h * 0.6 + Math.floor(i / 4) * 34;
      ctx.fillStyle = '#9c6b3f';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      emoji(ctx, '⛱️', x, y - 6, 16);
    }
    labelSign(ctx, p.x + p.w / 2, p.y + p.h - 6, 'Food Court', '#8a5a2b');
  }

  function drawEmptyLot(ctx, p, r) {
    ctx.fillStyle = 'rgba(160,140,90,0.35)';
    roundRect(ctx, p.x, p.y, p.w, p.h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,40,0.6)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    roundRect(ctx, p.x + 4, p.y + 4, p.w - 8, p.h - 8, 12);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 6; i++) emoji(ctx, r() < 0.5 ? '🌾' : '🌿', p.x + 20 + r() * (p.w - 40), p.y + 20 + r() * (p.h - 40), 14);
    emoji(ctx, '🪧', p.x + p.w / 2, p.y + p.h / 2 - 8, 26);
    ctx.fillStyle = '#4a3b22';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Available lot', p.x + p.w / 2, p.y + p.h / 2 + 18);
    ctx.font = '10px system-ui';
    ctx.fillText(U.num(p.area) + ' m²', p.x + p.w / 2, p.y + p.h / 2 + 32);
  }

  function labelSign(ctx, x, y, text, color) {
    ctx.font = 'bold 10px system-ui, sans-serif';
    const tw = Math.min(ctx.measureText(text).width, 190);
    ctx.fillStyle = color || '#6b4b2a';
    roundRect(ctx, x - tw / 2 - 6, y - 8, tw + 12, 15, 4);
    ctx.fill();
    ctx.fillStyle = '#fff8e6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y, 190);
  }

  function drawHabitat(ctx, s, p, h) {
    const B = ZG.BIOMES[h.biome];
    const r = seeded(h.seed);
    if (h.construction) {
      ctx.fillStyle = '#b89968';
      roundRect(ctx, p.x, p.y, p.w, p.h, 14);
      ctx.fill();
      ctx.strokeStyle = '#e0a526';
      ctx.setLineDash([12, 8]);
      ctx.lineWidth = 4;
      roundRect(ctx, p.x + 3, p.y + 3, p.w - 6, p.h - 6, 12);
      ctx.stroke();
      ctx.setLineDash([]);
      emoji(ctx, '🏗️', p.x + p.w * 0.35, p.y + p.h * 0.45, 40);
      emoji(ctx, '🚜', p.x + p.w * 0.7, p.y + p.h * 0.62, 26);
      emoji(ctx, '🚧', p.x + p.w * 0.2, p.y + p.h * 0.8, 20);
      labelSign(ctx, p.x + p.w / 2, p.y + p.h - 6, h.name + ' (under construction)', '#a8741a');
      return;
    }
    ctx.fillStyle = B.ground;
    roundRect(ctx, p.x, p.y, p.w, p.h, 14);
    ctx.fill();
    // texture
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() < 0.5 ? B.dark : 'rgba(255,255,255,0.12)';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(p.x + r() * p.w, p.y + r() * p.h, 6 + r() * 16, 4 + r() * 10, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // water features
    const water = ['aquatic', 'wetland', 'arctic'].includes(h.biome) ? 0.42 : 0.16;
    ctx.fillStyle = h.biome === 'arctic' ? '#9fd3ea' : ZG.zoo(s).theme.water;
    ctx.beginPath();
    ctx.ellipse(p.x + p.w * (0.3 + r() * 0.4), p.y + p.h * (0.35 + r() * 0.3), p.w * water, p.h * water * 0.7, r() * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // decorations scale with theming
    const n = 4 + Math.round(h.theming / 8);
    for (let i = 0; i < n; i++) emoji(ctx, B.deco[Math.floor(r() * B.deco.length)], p.x + 14 + r() * (p.w - 28), p.y + 14 + r() * (p.h - 40), 13 + r() * 12);
    // wear overlay when in poor condition
    if (h.condition < 70) {
      ctx.fillStyle = `rgba(110,80,40,${(70 - h.condition) / 70 * 0.45})`;
      roundRect(ctx, p.x, p.y, p.w, p.h, 14);
      ctx.fill();
      for (let i = 0; i < (70 - h.condition) / 6; i++) {
        ctx.strokeStyle = 'rgba(60,40,20,0.5)';
        ctx.lineWidth = 1.5;
        const x = p.x + r() * p.w, y = p.y + r() * p.h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8 - r() * 16, y + 6 + r() * 6);
        ctx.lineTo(x + 12 - r() * 24, y + 10 + r() * 8);
        ctx.stroke();
      }
    }
    // climate-control building
    if (h.climate !== 'none') {
      ctx.fillStyle = h.climate === 'chilled' ? '#cfe8f5' : '#f5d9cf';
      roundRect(ctx, p.x + p.w - 58, p.y + 10, 48, 30, 5);
      ctx.fill();
      emoji(ctx, h.climate === 'chilled' ? '❄️' : '🔥', p.x + p.w - 34, p.y + 25, 14);
    }
    // fence colored by condition
    const c = h.condition;
    ctx.strokeStyle = c > 70 ? '#5a4128' : c > 45 ? '#b07a2a' : '#b8412c';
    ctx.lineWidth = 4;
    if (c < 45) ctx.setLineDash([14, 4, 4, 4]);
    roundRect(ctx, p.x + 2, p.y + 2, p.w - 4, p.h - 4, 13);
    ctx.stroke();
    ctx.setLineDash([]);
    const name = h.sponsor ? `${h.sponsor} ${h.name}` : h.name;
    labelSign(ctx, p.x + p.w / 2, p.y + p.h - 6, name, h.renovation ? '#8a6d3b' : '#6b4b2a');
    if (h.renovation) {
      ctx.fillStyle = 'rgba(80,60,30,0.35)';
      roundRect(ctx, p.x, p.y, p.w, p.h, 14);
      ctx.fill();
      emoji(ctx, '🛠️', p.x + p.w / 2, p.y + p.h / 2, 36);
    }
  }

  // ---------------------------------------------------------------------
  // Dynamic agents
  // ---------------------------------------------------------------------
  function animalBounds(s, a) {
    let p;
    if (a.loc === 'quarantine') {
      p = s.plots.find((x) => x.kind === 'vet');
      return { x: p.x + 20, y: p.y + p.h * 0.64, w: p.w - 40, h: p.h * 0.26 };
    }
    const h = s.habitatsById[a.hab];
    if (!h) return null;
    p = s.plots[h.plot];
    return { x: p.x + 16, y: p.y + 18, w: p.w - 32, h: p.h - 44 };
  }

  function syncSprites(s) {
    const seen = new Set();
    for (const a of s.animals) {
      const h = s.habitatsById[a.hab];
      if (a.loc === 'hab' && (!h || h.construction || h.renovation)) continue;
      seen.add(a.id);
      let sp = st.sprites.get(a.id);
      const b = animalBounds(s, a);
      if (!b) continue;
      if (!sp || sp.loc !== a.loc || sp.hab !== a.hab) {
        sp = { x: b.x + rnd() * b.w, y: b.y + rnd() * b.h, tx: 0, ty: 0, wait: rnd() * 3, flip: rnd() < 0.5, loc: a.loc, hab: a.hab, bob: rnd() * 6 };
        sp.tx = sp.x;
        sp.ty = sp.y;
        st.sprites.set(a.id, sp);
      }
      sp.b = b;
    }
    for (const id of st.sprites.keys()) if (!seen.has(id)) st.sprites.delete(id);
  }

  function updateSprites(s, dt) {
    for (const a of s.animals) {
      const sp = st.sprites.get(a.id);
      if (!sp || !sp.b) continue;
      const spd = ZG.SPECIES[a.sp].cls === 'reptile' || a.sp === 'sloth' || a.sp === 'galapagos_tortoise' ? 5 : 18;
      if (sp.wait > 0) {
        sp.wait -= dt;
        if (sp.wait <= 0) {
          const b = sp.b;
          sp.tx = U.clamp(sp.x + (rnd() - 0.5) * 120, b.x, b.x + b.w);
          sp.ty = U.clamp(sp.y + (rnd() - 0.5) * 90, b.y, b.y + b.h);
        }
        continue;
      }
      const dx = sp.tx - sp.x, dy = sp.ty - sp.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) {
        sp.wait = 1.5 + rnd() * 6;
        continue;
      }
      const m = Math.min(d, spd * dt * (a.sick ? 0.4 : 1));
      sp.x += (dx / d) * m;
      sp.y += (dy / d) * m;
      sp.flip = dx > 0;
    }
  }

  // Path graph helpers for guests
  function nodePos(s, i, j) {
    return { x: s.layout.xs[i], y: s.layout.ys[j] };
  }
  function lRoute(s, from, to) {
    // from/to are {i,j} nodes on the grid; all grid lines are walkable
    const pts = [];
    if (rnd() < 0.5) {
      pts.push(nodePos(s, to.i, from.j));
    } else {
      pts.push(nodePos(s, from.i, to.j));
    }
    pts.push(nodePos(s, to.i, to.j));
    return pts;
  }
  function planGuest(s, g) {
    const habPlots = s.plots.filter((p) => p.kind === 'habitat' && p.hab);
    let target = null;
    if (habPlots.length) {
      target = habPlots[Math.floor(rnd() * habPlots.length)];
      // weight by appeal
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
      // leave
      g.leaving = true;
      const n = { i: 3, j: s.layout.rows };
      g.path = lRoute(s, g.node, n).concat([{ x: s.layout.entrance.x, y: H + 10 }]);
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
    const t = 0.2 + rnd() * 0.6;
    const off = (rnd() - 0.5) * 16;
    const vx = pa.x + (pb.x - pa.x) * t + (side >= 2 ? off : 0), vy = pa.y + (pb.y - pa.y) * t + (side < 2 ? off : 0);
    g.path = lRoute(s, g.node, A).concat([{ x: vx, y: vy, dwell: 2 + rnd() * 5, plot: target.id }, nodePos(s, A.i, A.j)]);
    g.node = A;
    g.visits++;
  }

  const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50', '#ff7eb6', '#7bed9f'];
  function spawnGuest(s) {
    const L = s.layout;
    const g = { x: L.entrance.x + (rnd() - 0.5) * 30, y: H + 5, color: SHIRTS[Math.floor(rnd() * SHIRTS.length)], kid: rnd() < 0.3, speed: 22 + rnd() * 14, node: { i: 3, j: L.rows }, path: [], visits: 0, dwell: 0, lane: (rnd() - 0.5) * 18 };
    g.path = [{ x: L.xs[3] + g.lane, y: L.ys[L.rows] }];
    st.guests.push(g);
  }

  function updateGuests(s, dt) {
    const Z = ZG.zoo(s);
    const avgDay = Z.baseAttendance / 365;
    let target = s.closure ? 0 : Math.round(U.clamp((s.today.guests / avgDay) * 110, 0, 320));
    if (st.guests.length < target && rnd() < dt * 6) spawnGuest(s);
    if (st.guests.length > target + 10) for (const g of st.guests) if (!g.leaving && rnd() < 0.01) g.leaving = true;
    for (let k = st.guests.length - 1; k >= 0; k--) {
      const g = st.guests[k];
      if (g.dwell > 0) {
        g.dwell -= dt;
        continue;
      }
      if (!g.path.length) {
        if (g.node) planGuest(s, g);
        else {
          st.guests.splice(k, 1);
          continue;
        }
        if (!g.path.length) continue;
      }
      const p = g.path[0];
      const tx = p.x + (p.dwell ? 0 : g.lane * 0.6), ty = p.y + (p.dwell ? 0 : g.lane * 0.6);
      const dx = tx - g.x, dy = ty - g.y;
      const d = Math.hypot(dx, dy);
      const m = g.speed * dt;
      if (d <= m) {
        g.x = tx;
        g.y = ty;
        g.path.shift();
        if (p.dwell) {
          g.dwell = p.dwell;
          g.watch = p.plot;
        }
      } else {
        g.x += (dx / d) * m;
        g.y += (dy / d) * m;
      }
      if (g.y > H + 5 && g.leaving) st.guests.splice(k, 1);
    }
  }

  function updateKeepers(s, dt) {
    const want = Math.min(8, Math.round(s.staff.keepers.n / Math.max(1, s.req.keepers * ZG.Staff.load(s, 'keepers')) * 5));
    while (st.keepers.length < want) st.keepers.push({ x: s.layout.xs[0], y: s.layout.ys[0], node: { i: 0, j: 0 }, path: [], speed: 30, color: '#2f6b3f', lane: 0, visits: 0, dwell: 0, keeper: true });
    while (st.keepers.length > want) st.keepers.pop();
    for (const g of st.keepers) {
      if (g.dwell > 0) {
        g.dwell -= dt;
        continue;
      }
      if (!g.path.length) {
        g.visits = 0;
        g.leaving = false;
        planGuest(s, g);
        if (g.leaving || !g.node) {
          g.path = [];
          g.node = { i: Math.floor(rnd() * (s.layout.cols + 1)), j: Math.floor(rnd() * (s.layout.rows + 1)) };
          const p = nodePos(s, g.node.i, g.node.j);
          g.path = [p];
          g.leaving = false;
        }
      }
      const p = g.path[0];
      const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy), m = g.speed * dt;
      if (d <= m) {
        g.x = p.x;
        g.y = p.y;
        g.path.shift();
        if (p.dwell) g.dwell = p.dwell * 2;
      } else {
        g.x += (dx / d) * m;
        g.y += (dy / d) * m;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Walk mode
  // ---------------------------------------------------------------------
  function blocked(s, x, y) {
    if (x < 10 || x > W - 10 || y < 10 || y > H - 5) return true;
    for (const p of s.plots) if (x > p.x + 4 && x < p.x + p.w - 4 && y > p.y + 4 && y < p.y + p.h - 4) return true;
    return false;
  }
  R.setWalk = function (s, on) {
    st.walk = on;
    if (on) {
      const L = s.layout;
      if (blocked(s, st.avatar.x, st.avatar.y) || st.avatar.x === 800) {
        st.avatar.x = L.entrance.x;
        st.avatar.y = L.ys[L.rows] + 30;
      }
      st.cam.zoom = Math.max(2.1, R.minZoom() * 2.5);
    } else R.fitCamera();
  };
  R.nearbyPlot = function (s) {
    const a = st.avatar;
    let best = null, bd = 60;
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
    let vx = 0, vy = 0;
    const k = st.keys;
    if (k.ArrowLeft || k.a) vx -= 1;
    if (k.ArrowRight || k.d) vx += 1;
    if (k.ArrowUp || k.w) vy -= 1;
    if (k.ArrowDown || k.s) vy += 1;
    if (vx || vy) a.target = null;
    else if (a.target) {
      const dx = a.target.x - a.x, dy = a.target.y - a.y, d = Math.hypot(dx, dy);
      if (d < 3) a.target = null;
      else {
        vx = dx / d;
        vy = dy / d;
      }
    }
    const len = Math.hypot(vx, vy);
    a.moving = len > 0;
    if (a.moving) {
      const sp = (k.Shift ? 150 : 85) * dt;
      vx = (vx / len) * sp;
      vy = (vy / len) * sp;
      if (!blocked(s, a.x + vx, a.y)) a.x += vx;
      else if (a.target) a.target = null;
      if (!blocked(s, a.x, a.y + vy)) a.y += vy;
      else if (a.target) a.target = null;
      if (vx) a.dir = vx > 0 ? 1 : -1;
      a.phase += dt * 12;
    }
    st.cam.x += (a.x - st.cam.x) * Math.min(1, dt * 6);
    st.cam.y += (a.y - st.cam.y) * Math.min(1, dt * 6);
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
  // Frame
  // ---------------------------------------------------------------------
  R.frame = function (s, dt) {
    const ctx = st.ctx;
    if (!ctx || !s) return;
    const key = staticKey(s);
    if (key !== st.staticKey) {
      st.staticCanvas = buildStatic(s);
      st.staticKey = key;
    }
    syncSprites(s);
    updateSprites(s, dt);
    updateGuests(s, dt);
    updateKeepers(s, dt);
    if (st.walk) updateAvatar(s, dt);
    // pull effects from sim
    if (s._fx && s._fx.length) {
      for (const f of s._fx) {
        const h = s.habitatsById[f.hab];
        const p = h ? s.plots[h.plot] : null;
        if (p) st.fx.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, t: 0, icon: { birth: '🍼', death: '🕊️', open: '🎉' }[f.type] || '✨' });
      }
      s._fx.length = 0;
    }

    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.fillStyle = '#4f6b3c';
    ctx.fillRect(0, 0, st.cw, st.ch);
    const z = st.cam.zoom;
    // clamp camera
    const halfW = st.cw / 2 / z, halfH = st.ch / 2 / z;
    if (halfW * 2 < W) st.cam.x = U.clamp(st.cam.x, halfW, W - halfW);
    else st.cam.x = W / 2;
    if (halfH * 2 < H) st.cam.y = U.clamp(st.cam.y, halfH, H - halfH);
    else st.cam.y = H / 2;
    ctx.translate(st.cw / 2, st.ch / 2);
    ctx.scale(z, z);
    ctx.translate(-st.cam.x, -st.cam.y);
    ctx.drawImage(st.staticCanvas, 0, 0, W, H);

    const t = performance.now() / 1000;
    // selection/hover highlight
    for (const pid of [st.hover, st.selected]) {
      if (pid == null) continue;
      const p = s.plots[pid];
      if (!p) continue;
      ctx.strokeStyle = pid === st.selected ? '#ffe066' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = pid === st.selected ? 4 : 3;
      roundRect(ctx, p.x - 3, p.y - 3, p.w + 6, p.h + 6, 16);
      ctx.stroke();
    }
    // construction progress bars
    for (const h of s.habitats) {
      const job = h.construction || h.renovation;
      if (!job) continue;
      const p = s.plots[h.plot];
      const frac = 1 - job.days / job.total;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x + 20, p.y + 12, p.w - 40, 10);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(p.x + 21, p.y + 13, (p.w - 42) * frac, 8);
    }
    // agents sorted by y for depth
    const drawables = [];
    for (const a of s.animals) {
      const sp = st.sprites.get(a.id);
      if (sp) drawables.push({ y: sp.y, a, sp });
    }
    for (const g of st.guests) drawables.push({ y: g.y, g });
    for (const g of st.keepers) drawables.push({ y: g.y, g });
    if (st.walk) drawables.push({ y: st.avatar.y, me: true });
    drawables.sort((a, b) => a.y - b.y);
    const detail = z > 1.4;
    for (const d of drawables) {
      if (d.a) {
        const spc = ZG.SPECIES[d.a.sp];
        let size = spc.size * (d.a.age < 365 ? 0.55 : 1) * 0.85;
        const bob = d.sp.wait > 0 ? 0 : Math.sin(t * 8 + d.sp.bob) * 1.2;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(d.sp.x, d.sp.y + size * 0.38, size * 0.38, size * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        emoji(ctx, spc.emoji, d.sp.x, d.sp.y + bob, size, d.sp.flip);
        if (d.a.sick) emoji(ctx, '🤒', d.sp.x + size * 0.4, d.sp.y - size * 0.45, 9);
        if (d.a.star && detail) emoji(ctx, '⭐', d.sp.x - size * 0.4, d.sp.y - size * 0.45, 8);
        if (detail && z > 2.3) {
          ctx.font = 'bold 6px system-ui';
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.textAlign = 'center';
          ctx.fillText(d.a.name, d.sp.x, d.sp.y + size * 0.62);
        }
      } else if (d.g) {
        const g = d.g;
        const r = g.keeper ? 3.4 : g.kid ? 2.2 : 2.9;
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.keeper ? '#c8b27a' : '#f2d2b6';
        ctx.beginPath();
        ctx.arc(g.x, g.y - r * 0.9, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.me) {
        ZG.drawAvatar(ctx, st.avatar.x, st.avatar.y, 0.75, s.director.look, st.avatar.dir, st.avatar.moving ? st.avatar.phase : 0, s.director.name);
      }
    }
    // Thought bubbles (walk mode shows guest opinions near you)
    if (st.walk) {
      if (rnd() < dt * 0.9) {
        const near = st.guests.filter((g) => Math.hypot(g.x - st.avatar.x, g.y - st.avatar.y) < 140);
        if (near.length) {
          const g = near[Math.floor(rnd() * near.length)];
          st.bubbles.push({ g, text: R.guestThought(s, g.watch != null ? g.watch : null), t: 0 });
          if (st.bubbles.length > 3) st.bubbles.shift();
        }
      }
      for (let i = st.bubbles.length - 1; i >= 0; i--) {
        const b = st.bubbles[i];
        b.t += dt;
        if (b.t > 4.5) {
          st.bubbles.splice(i, 1);
          continue;
        }
        ctx.font = '7px system-ui, sans-serif';
        const tw = ctx.measureText(b.text).width;
        const bx = b.g.x, by = b.g.y - 12;
        ctx.globalAlpha = Math.min(1, (4.5 - b.t) * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        roundRect(ctx, bx - tw / 2 - 4, by - 12, tw + 8, 11, 4);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bx - 2, by - 1);
        ctx.lineTo(bx + 2, by - 1);
        ctx.lineTo(bx, by + 3);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.text, bx, by - 6.5);
        ctx.globalAlpha = 1;
      }
    }
    // floating fx
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const f = st.fx[i];
      f.t += dt;
      if (f.t > 3) {
        st.fx.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - f.t / 3;
      emoji(ctx, f.icon, f.x, f.y - f.t * 25, 30);
      ctx.globalAlpha = 1;
    }
    // weather overlay (screen space)
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    const w = s.today.weather;
    if (w === 'rain' || w === 'storm') {
      ctx.fillStyle = w === 'storm' ? 'rgba(20,30,50,0.3)' : 'rgba(40,60,90,0.12)';
      ctx.fillRect(0, 0, st.cw, st.ch);
      ctx.strokeStyle = 'rgba(200,220,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const n = w === 'storm' ? 220 : 120;
      for (let i = 0; i < n; i++) {
        const x = (i * 97.3 + t * 400) % st.cw, y = (i * 53.7 + t * 900 + i * 13) % st.ch;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 12);
      }
      ctx.stroke();
    } else if (w === 'snow') {
      ctx.fillStyle = 'rgba(230,240,255,0.18)';
      ctx.fillRect(0, 0, st.cw, st.ch);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 160; i++) {
        const x = (i * 71.3 + Math.sin(t + i) * 20) % st.cw, y = (i * 37.1 + t * 60) % st.ch;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (w === 'heat') {
      ctx.fillStyle = 'rgba(255,140,40,0.1)';
      ctx.fillRect(0, 0, st.cw, st.ch);
    } else if (w === 'smoke') {
      ctx.fillStyle = 'rgba(140,110,80,0.35)';
      ctx.fillRect(0, 0, st.cw, st.ch);
    }
    if (s.closure) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, st.cw, 34);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🚫 ZOO CLOSED — ${s.closure.reason}`, st.cw / 2, 17);
    }
  };

  R.reset = function () {
    st.sprites.clear();
    st.guests.length = 0;
    st.keepers.length = 0;
    st.fx.length = 0;
    st.bubbles.length = 0;
    st.staticKey = '';
    st.selected = null;
    st.hover = null;
    st.avatar = { x: 800, y: 950, dir: 1, phase: 0, moving: false, target: null };
  };
})((globalThis.ZG = globalThis.ZG || {}));
