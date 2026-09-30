// Habitats: layout plots, appeal, wear, construction, renovation.
(function (ZG) {
  const U = ZG.U;
  const H = (ZG.Habitats = {});

  H.TIERS = {
    basic: { name: 'Basic', perM2: 900, theming: 35, days: 240, appeal: 0.9 },
    standard: { name: 'Standard', perM2: 1600, theming: 65, days: 330, appeal: 1.0 },
    premium: { name: 'Premium / Immersive', perM2: 2800, theming: 92, days: 450, appeal: 1.15 },
  };

  H.W = 1600;
  H.H = 1000;

  // Grid of plots separated by paths. Entrance at bottom centre.
  H.genLayout = function (s) {
    const Z = ZG.zoo(s);
    const cols = 6, rows = 3;
    const M = 60, P = 46, top = 70, bottom = H.H - 120;
    const cw = [], rh = [];
    for (let i = 0; i < cols; i++) cw.push(U.rf(s, 0.8, 1.25));
    for (let i = 0; i < rows; i++) rh.push(U.rf(s, 0.85, 1.2));
    const norm = (arr, total) => {
      const sum = arr.reduce((a, b) => a + b, 0);
      return arr.map((x) => (x / sum) * total);
    };
    const W2 = norm(cw, H.W - 2 * M);
    const H2 = norm(rh, bottom - top);
    // keep the middle vertical path exactly between col 2 and 3 for the entrance
    const xs = [M];
    for (let i = 0; i < cols; i++) xs.push(xs[i] + W2[i]);
    const ys = [top];
    for (let i = 0; i < rows; i++) ys.push(ys[i] + H2[i]);
    s.layout = { xs, ys, P, cols, rows, entrance: { x: xs[3], y: H.H - 40 } };
    s.plots = [];
    let pxTotal = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = xs[c] + P / 2, y = ys[r] + P / 2;
        const w = xs[c + 1] - xs[c] - P, h = ys[r + 1] - ys[r] - P;
        const kind = r === 0 && c === 0 ? 'vet' : r === 1 && c === 2 ? 'cafe' : 'habitat';
        s.plots.push({ id: s.plots.length, c, r, x, y, w, h, kind, px: w * h, area: 0, hab: null });
        if (kind === 'habitat') pxTotal += w * h;
      }
    const habPlots = s.plots.filter((p) => p.kind === 'habitat');
    const scale = Z.avgPlot / (pxTotal / habPlots.length);
    for (const p of habPlots) p.area = Math.round((p.px * scale) / 50) * 50;
  };

  H.create = function (s, plot, o) {
    const h = {
      id: s.nextId++,
      plot: plot.id,
      name: o.name,
      biome: o.biome,
      area: plot.area,
      site: plot.site || null,
      condition: o.condition != null ? o.condition : 95,
      theming: o.theming != null ? o.theming : 60,
      tier: o.tier || 'standard',
      climate: o.climate || 'none',
      construction: o.construction || null,
      renovation: null,
      sponsor: null,
      features: o.features ? o.features.slice() : [],
      brief: o.brief || null,
      opened: s.day,
      seed: U.ri(s, 1, 1e9),
    };
    plot.hab = h.id;
    s.habitats.push(h);
    s.habitatsById[h.id] = h;
    return h;
  };

  H.replaceCost = function (s, h) {
    const tier = H.TIERS[h.tier] || H.TIERS.standard;
    return h.area * tier.perM2 * ZG.zoo(s).costMult;
  };

  H.buildCost = function (s, plot, tier, climate) {
    const t = H.TIERS[tier];
    let c = plot.area * t.perM2 * ZG.zoo(s).costMult * ZG.mod(s, 'construction');
    if (climate !== 'none') c += 1.2e6 * ZG.zoo(s).costMult + plot.area * 250;
    return Math.round(c / 1000) * 1000;
  };

  H.startBuild = function (s, plotId, o) {
    const plot = s.plots[plotId];
    if (plot.hab) return { ok: false, msg: 'That plot is already in use.' };
    const features = o.features || [];
    let cost = o.cost || H.buildCost(s, plot, o.tier, o.climate);
    if (!o.cost) for (const f of features) cost += ZG.Design.featureCost(s, f);
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: `You need ${U.money(cost)} in capital funds + cash (incl. credit line).` };
    const Z = ZG.zoo(s);
    const days = Math.round((o.days || H.TIERS[o.tier].days * (Z.governance === 'city' || Z.governance === 'federal' ? 1.25 : 1)) * U.rf(s, 0.95, 1.12));
    ZG.Econ.spendCapital(s, 'construction', cost);
    const h = H.create(s, plot, { name: o.name, biome: o.biome, tier: o.tier, climate: o.climate, features, brief: o.brief, theming: Math.min(100, H.TIERS[o.tier].theming + features.length * 3), condition: 100, construction: { days, total: days, cost } });
    if (o.species) h.intent = o.species.slice();
    plot.savedDesign = null;
    if (plot.naming) {
      h.namedBy = plot.naming.name;
      if (plot.naming.kind === 'corp') h.sponsor = plot.naming.name;
      else (h.donorName = plot.naming.name), (h.name = `${plot.naming.short} ${h.name}`);
      plot.naming = null;
    }
    ZG.Sim.news(s, `🏗️ Groundbreaking! ${h.name} (${H.TIERS[o.tier].name}, ${ZG.BIOMES[o.biome].name}${features.length ? ', ' + features.length + ' special features' : ''}) — ${U.money(cost)}, opening in ~${Math.round(days / 30)} months.`, 'info');
    s.rep = U.clamp(s.rep + 1, 0, 100);
    return { ok: true, msg: 'Construction started.', hab: h };
  };

  H.renovateCost = function (s, h) {
    return Math.round(H.replaceCost(s, h) * (Math.max(0, 95 - h.condition) / 100) * 0.7 + 50000);
  };
  H.startRenovation = function (s, hid) {
    const h = s.habitatsById[hid];
    if (!h || h.construction || h.renovation) return { ok: false, msg: 'Not available.' };
    const cost = H.renovateCost(s, h);
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: 'Not enough funds.' };
    ZG.Econ.spendCapital(s, 'capitalRepairs', cost);
    const days = Math.round(45 + (95 - h.condition) * 1.5);
    h.renovation = { days, total: days };
    ZG.Sim.news(s, `🛠️ ${h.name} closed for renovation (${U.money(cost)}, ~${Math.round(days / 30)} months). Animals are in off-exhibit holding.`, 'info');
    return { ok: true, msg: 'Renovation started.' };
  };

  // Expand a habitat: an adjoining off-exhibit yard and a bigger night house (+30% space, up to twice).
  H.MAX_EXPANSIONS = 2;
  H.expandCost = function (s, h) {
    const tier = H.TIERS[h.tier] || H.TIERS.standard;
    return Math.round(h.area * 0.3 * tier.perM2 * ZG.zoo(s).costMult * 0.8 + 150000 * ZG.zoo(s).costMult);
  };
  H.expand = function (s, hid) {
    const h = s.habitatsById[hid];
    if (!h || h.construction || h.renovation || h.expanding) return { ok: false, msg: 'Not available right now.' };
    if ((h.expansions || 0) >= H.MAX_EXPANSIONS) return { ok: false, msg: `${h.name} has already been expanded as far as the site allows.` };
    const cost = H.expandCost(s, h);
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: `Not enough funds (${U.money(cost)}).` };
    ZG.Econ.spendCapital(s, 'construction', cost);
    const days = ZG.zoo(s).governance === 'city' || ZG.zoo(s).governance === 'federal' ? 110 : 90;
    h.expanding = { days, total: days };
    ZG.Sim.news(s, `📐 Expanding ${h.name}: a new adjoining yard and bigger night house (${U.money(cost)}, ~${Math.round(days / 30)} months). The animals stay on exhibit.`, 'info');
    return { ok: true, msg: `Expansion started. ${h.name} gets 30% more space in about ${Math.round(days / 30)} months.` };
  };

  // Rename a habitat, unless a sponsor or donor holds its naming rights.
  H.renameLock = function (s, h) {
    if (h.sponsor) return `${h.sponsor} holds the naming rights under its sponsorship.`;
    if (h.donorName) return `It is named in honor of ${h.donorName}, who paid for the naming rights.`;
    return null;
  };
  H.rename = function (s, hid, name) {
    const h = s.habitatsById[hid];
    if (!h) return { ok: false, msg: 'Not found.' };
    const lock = H.renameLock(s, h);
    if (lock) return { ok: false, msg: `You can't rename this habitat: ${lock}` };
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (name.length < 2) return { ok: false, msg: 'Type a name (at least 2 characters).' };
    if (name === h.name) return { ok: true, msg: 'Name unchanged.' };
    const old = h.name;
    h.name = name;
    ZG.Sim.news(s, `🪧 “${old}” has been renamed “${name}.” New signs are going up.`, 'info');
    return { ok: true, msg: `Renamed to “${name}.”` };
  };

  // Re-landscape a habitat for a different biome (a bigger renovation).
  H.relandscapeCost = function (s, h) {
    return Math.round(H.replaceCost(s, h) * 0.45 + 80000);
  };
  H.relandscape = function (s, hid, biome) {
    const h = s.habitatsById[hid];
    if (!h || h.construction || h.renovation || !ZG.BIOMES[biome]) return { ok: false, msg: 'Not available.' };
    const cost = H.relandscapeCost(s, h);
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: 'Not enough funds.' };
    ZG.Econ.spendCapital(s, 'capitalRepairs', cost);
    const days = 120;
    h.renovation = { days, total: days, biome };
    ZG.Sim.news(s, `🌿 ${h.name} is being re-landscaped as ${ZG.BIOMES[biome].name} (${U.money(cost)}, ~4 months).`, 'info');
    return { ok: true, msg: 'Re-landscaping started.' };
  };

  H.upgradeTheming = function (s, hid) {
    const h = s.habitatsById[hid];
    const cost = Math.round(h.area * 220 * ZG.zoo(s).costMult);
    if (h.theming >= 95) return { ok: false, msg: 'Already fully themed.' };
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: 'Not enough funds.' };
    ZG.Econ.spendCapital(s, 'construction', cost);
    h.theming = Math.min(100, h.theming + 20);
    ZG.Sim.news(s, `🎨 New interpretive graphics, viewing blinds and plantings at ${h.name} (${U.money(cost)}).`, 'info');
    return { ok: true, msg: 'Theming improved.' };
  };

  H.demolish = function (s, hid) {
    const h = s.habitatsById[hid];
    if (ZG.Animals.inHab(s, hid).length || s.animals.some((a) => a.hab === hid)) return { ok: false, msg: 'Move or transfer all animals first.' };
    const cost = Math.round(h.area * 60 * ZG.zoo(s).costMult);
    ZG.Econ.spend(s, 'construction', cost);
    s.plots[h.plot].hab = null;
    s.habitats.splice(s.habitats.indexOf(h), 1);
    delete s.habitatsById[hid];
    ZG.Sim.news(s, `🚜 ${h.name} was demolished (${U.money(cost)}). The plot is ready for a new project.`, 'info');
    return { ok: true, msg: 'Demolished.' };
  };

  H.appeal = function (s, h) {
    if (h.construction || h.renovation) return 0;
    const animals = ZG.Animals.inHab(s, h.id);
    const bySp = {};
    for (const a of animals) (bySp[a.sp] = bySp[a.sp] || []).push(a);
    let ap = 0;
    for (const id in bySp) {
      const sp = ZG.SPECIES[id];
      const list = bySp[id];
      const babies = list.filter((a) => a.age < 365).length;
      const avgW = list.reduce((x, a) => x + a.welfare, 0) / list.length;
      ap += sp.appeal * Math.pow(list.length, 0.7) * (0.6 + 0.4 * avgW / 100) + babies * sp.appeal * 0.5;
    }
    const tier = H.TIERS[h.tier] || H.TIERS.standard;
    return ap * (0.55 + 0.45 * h.condition / 100) * (0.7 + 0.3 * h.theming / 100) * tier.appeal * ZG.Design.appealMult(h);
  };
  H.totalAppeal = function (s) {
    let a = ZG.zoo(s).supporting.appeal;
    for (const h of s.habitats) if (!h.site) a += H.appeal(s, h); // a second site draws its own guests
    return a;
  };

  H.daily = function (s) {
    const eff = ZG.Infra.maintEffect(s);
    for (const h of s.habitats) {
      if (h.expanding) {
        h.expanding.days--;
        if (h.expanding.days <= 0) {
          const before = h.area;
          h.area = Math.round(h.area * 1.3);
          h.expansions = (h.expansions || 0) + 1;
          h.expanding = null;
          ZG.Sim.news(s, `📐 ${h.name} expansion finished: ${U.num(before)} → ${U.num(h.area)} m². There's room for more animals now.`, 'good');
        }
      }
      if (h.construction) {
        h.construction.days--;
        if (h.construction.days <= 0) {
          h.construction = null;
          h.opened = s.day;
          s.stats.habitatsOpened++;
          s.novelty = Math.min(0.8, s.novelty + 0.18);
          s.rep = U.clamp(s.rep + 3, 0, 100);
          s.board = U.clamp(s.board + 4, 0, 100);
          ZG.fx(s, 'open', h.id);
          ZG.Events.queue(s, 'habitat_open', { hid: h.id });
        }
        continue;
      }
      if (h.renovation) {
        h.renovation.days--;
        if (h.renovation.days <= 0) {
          if (h.renovation.biome) h.biome = h.renovation.biome;
          h.renovation = null;
          h.condition = 95;
          s.novelty = Math.min(0.8, s.novelty + 0.05);
          ZG.Sim.news(s, `🎉 ${h.name} has reopened after renovation!`, 'good');
        }
        continue;
      }
      let wear = 0;
      for (const a of ZG.Animals.inHab(s, h.id)) wear += ZG.SPECIES[a.sp].heavy * 0.25;
      const decay = (4.5 + wear) * (1.8 - eff) / 365;
      h.condition = Math.max(0, h.condition - decay);
    }
  };
})((globalThis.ZG = globalThis.ZG || {}));
