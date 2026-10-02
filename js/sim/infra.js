// Infrastructure systems, decay, capital repairs, breakdowns and the deferred-maintenance backlog.
(function (ZG) {
  const U = ZG.U;
  const I = (ZG.Infra = {});

  I.SYSTEMS = [
    { id: 'water', name: 'Water & Sewer Mains', icon: '🚰', base: 6e6, decay: 3.2, fail: 'A water main ruptured' },
    { id: 'power', name: 'Electrical & Backup Generators', icon: '⚡', base: 5e6, decay: 3.5, fail: 'A transformer failed and part of the zoo lost power' },
    { id: 'life', name: 'Life-Support (pools, filtration, HVAC)', icon: '💧', base: 8e6, decay: 4.2, fail: 'A life-support system failed' },
    { id: 'visitor', name: 'Paths, Restrooms & Visitor Amenities', icon: '🚻', base: 5e6, decay: 3.8, fail: 'Restroom plumbing and a boardwalk section failed' },
    { id: 'hospital', name: 'Animal Hospital & Quarantine', icon: '🏥', base: 7e6, decay: 2.8, fail: 'The animal hospital\'s HVAC and surgical suite went down' },
    { id: 'commissary', name: 'Commissary, Barns & Holding', icon: '🏚️', base: 6e6, decay: 3.2, fail: 'The commissary walk-in coolers failed' },
    { id: 'perimeter', name: 'Perimeter Fence & Security', icon: '🚧', base: 2.5e6, decay: 3.6, fail: 'A section of perimeter fence collapsed' },
    { id: 'admin', name: 'Admin & Education Buildings', icon: '🏫', base: 4e6, decay: 2.5, fail: 'The education center roof started leaking badly' },
  ];
  I.sys = (id) => I.SYSTEMS.find((x) => x.id === id);

  // Upgrade levels: 1 = original, 2 = upgraded, 3 = state of the art.
  I.LEVELS = ['', 'Original', 'Upgraded', 'State of the art'];
  I.BENEFITS = {
    water: 'Low-flow fixtures and leak detection cut utility bills 4% per level.',
    power: 'Efficient lighting, solar and battery backup cut utility bills 6% per level.',
    life: 'Better filtration and climate control: +2 welfare per level for animals in pools and heated or chilled buildings.',
    visitor: 'Shaded paths, more restrooms and seating: guest satisfaction +2.5 per level.',
    hospital: 'New imaging and surgical suites: vet care 10% more effective per level.',
    commissary: 'Bulk cold storage and on-site food prep: animal food costs −4% per level.',
    perimeter: 'Cameras and stronger barriers: escapes 30% less likely per level.',
    admin: 'Modern offices and classrooms: overhead −2% and education grant odds +10% per level.',
  };
  I.level = (s, id) => (s.infra[id] && s.infra[id].level) || 1;
  I.bonus = (s, id) => I.level(s, id) - 1;

  I.init = function (s) {
    const Z = ZG.zoo(s);
    s.infra = {};
    for (const x of I.SYSTEMS) {
      s.infra[x.id] = { cond: U.ri(s, Z.infraCond[0], Z.infraCond[1]), cost: Math.round(x.base * Z.infraScale), repair: null, lastFail: -999 };
    }
  };

  I.maintEffect = function (s) {
    const Z = ZG.zoo(s);
    const budget = s.policy.maintenance / Math.max(1, Z.refs.maintenance);
    const staff = ZG.Staff.ratio(s, 'maintenance');
    return U.clamp((0.5 * Math.min(1.3, staff) + 0.5 * Math.min(1.4, budget)) * ZG.mod(s, 'maintenance'), 0, 1.4);
  };

  I.backlog = function (s) {
    let b = 0;
    for (const k in s.infra) {
      const x = s.infra[k];
      b += x.cost * Math.max(0, 85 - x.cond) / 100;
    }
    for (const h of s.habitats) {
      if (h.construction) continue;
      b += ZG.Habitats.replaceCost(s, h) * Math.max(0, 85 - h.condition) / 100 * 0.6;
    }
    return b;
  };
  I.avgCond = function (s) {
    let c = 0, n = 0;
    for (const k in s.infra) {
      c += s.infra[k].cond;
      n++;
    }
    return c / n;
  };

  I.repairCost = function (s, id, target) {
    const x = s.infra[id];
    return Math.round(x.cost * Math.max(0, target - x.cond) / 100 * 1.1 * ZG.mod(s, 'construction'));
  };
  I.startRepair = function (s, id, target) {
    const x = s.infra[id];
    if (x.repair) return { ok: false, msg: 'Already under repair.' };
    const cost = I.repairCost(s, id, target);
    if (cost <= 0) return { ok: false, msg: 'Nothing to repair.' };
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: 'Not enough capital funds or cash (including your credit line).' };
    ZG.Econ.spendCapital(s, 'capitalRepairs', cost);
    const days = Math.round(30 + (target - x.cond) * 2.2 / Math.max(0.5, ZG.Staff.ratio(s, 'maintenance')));
    x.repair = { target, days, total: days };
    ZG.Sim.news(s, `🏗️ Capital repair started: ${I.sys(id).name} (${U.money(cost)}, ~${Math.round(days / 30)} months).`, 'info');
    return { ok: true, msg: `Repair funded: ${U.money(cost)}.` };
  };

  // A quick patch: cheap and fast, but it doesn't last.
  I.patchCost = (s, id) => Math.round(I.repairCost(s, id, Math.min(70, s.infra[id].cond + 15)) * 0.35);
  I.patch = function (s, id) {
    const x = s.infra[id];
    if (x.repair) return { ok: false, msg: 'Work is already underway.' };
    if (x.cond >= 70) return { ok: false, msg: 'It’s in decent shape. A patch won’t help much.' };
    const cost = I.patchCost(s, id);
    if (!ZG.Econ.canAfford(s, cost)) return { ok: false, msg: 'Not enough cash.' };
    ZG.Econ.spend(s, 'maintenance', cost);
    x.repair = { target: Math.min(70, x.cond + 15), days: 10, total: 10, patch: true };
    return { ok: true, msg: `🩹 Crews are patching the ${I.sys(id).name.toLowerCase()} (${U.money(cost)}). It will wear out faster than a proper repair.` };
  };
  I.upgradeCost = (s, id) => Math.round(s.infra[id].cost * 0.55 * I.level(s, id) * ZG.mod(s, 'construction'));
  I.upgrade = function (s, id) {
    const x = s.infra[id];
    if (x.repair) return { ok: false, msg: 'Work is already underway.' };
    if (I.level(s, id) >= 3) return { ok: false, msg: 'Already state of the art.' };
    const cost = I.upgradeCost(s, id);
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: 'Not enough capital funds or cash (including your credit line).' };
    ZG.Econ.spendCapital(s, 'capitalRepairs', cost);
    const days = Math.round((150 + 90 * I.level(s, id)) * (['city', 'federal'].includes(s.gov.type) ? 1.2 : 1));
    x.repair = { target: 100, days, total: days, upgrade: true };
    ZG.Sim.news(s, `⬆️ Upgrade started: ${I.sys(id).name} to “${I.LEVELS[I.level(s, id) + 1]}” (${U.money(cost)}, ~${Math.round(days / 30)} months).`, 'info');
    return { ok: true, msg: `Upgrade funded: ${U.money(cost)}. ${I.BENEFITS[id]}` };
  };

  I.daily = function (s, t) {
    const eff = I.maintEffect(s);
    for (const x of I.SYSTEMS) {
      const st = s.infra[x.id];
      if (st.repair) {
        st.repair.days--;
        if (st.repair.days <= 0) {
          const r = st.repair;
          st.cond = r.target;
          st.repair = null;
          if (r.patch) {
            st.patchedUntil = s.day + 365;
            ZG.Sim.news(s, `🩹 ${x.name} patched. Condition ${Math.round(st.cond)}, for now.`, 'info');
          } else if (r.upgrade) {
            st.level = I.level(s, x.id) + 1;
            st.cost = Math.round(st.cost * 1.15);
            st.patchedUntil = 0;
            ZG.Sim.news(s, `⬆️ ${x.name} upgrade complete: now “${I.LEVELS[st.level]}”. ${I.BENEFITS[x.id]}`, 'good');
            s.gov.relationship = U.clamp(s.gov.relationship + 1, 0, 100);
          } else {
            st.patchedUntil = 0;
            ZG.Sim.news(s, `✅ ${x.name} repair complete — condition now ${Math.round(st.cond)}.`, 'good');
            s.gov.relationship = U.clamp(s.gov.relationship + 1, 0, 100);
          }
        }
        continue;
      }
      // Patches wear out fast; upgraded systems age more slowly.
      const decay = x.decay * (1.8 - eff) / 365 * (st.cond > 80 ? 0.8 : 1) * (st.patchedUntil > s.day ? 1.7 : 1) * (1 - 0.2 * I.bonus(s, x.id));
      st.cond = Math.max(0, st.cond - decay);
      if (st.cond < 50 && s.day - st.lastFail > 120) {
        const pYear = Math.pow((50 - st.cond) / 50, 1.4) * 1.2;
        if (U.rand(s) < U.annualToDaily(pYear)) {
          st.lastFail = s.day;
          ZG.Events.queue(s, 'breakdown', { sys: x.id });
        }
      }
    }
  };

  // Disaster damage helper
  I.damage = function (s, amount, ids) {
    const list = ids || Object.keys(s.infra);
    for (const id of list) {
      const st = s.infra[id];
      if (st) st.cond = Math.max(0, st.cond - amount * U.rf(s, 0.5, 1.3));
    }
  };
})((globalThis.ZG = globalThis.ZG || {}));
