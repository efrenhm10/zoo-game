// AZA: Species Survival Plans (breeding & transfer recommendations), the animal
// exchange market, collection moves, and the 5-year accreditation cycle.
(function (ZG) {
  const U = ZG.U;
  const Z_ = ZG.AZA = {};

  Z_.accredited = (s) => s.acc.status !== 'lost';

  Z_.partner = (s) => U.pick(s, ZG.NAMES.partnerZoos);

  Z_.generatePlan = function (s) {
    // Expire stale recommendations
    for (const r of s.ssp.recs) {
      if ((r.status === 'open' || r.status === 'accepted') && s.day > r.deadline) {
        r.status = 'expired';
      }
    }
    s.ssp.recs = s.ssp.recs.filter((r) => s.day - r.created < 900);
    if (!Z_.accredited(s)) {
      ZG.Sim.news(s, '📋 AZA published this year\'s Breeding & Transfer Plans — but as a non-accredited facility you were left out.', 'bad');
      return;
    }
    const bySp = {};
    for (const a of s.animals) if (ZG.SPECIES[a.sp].program !== 'none') (bySp[a.sp] = bySp[a.sp] || []).push(a);
    let made = 0;
    for (const spId in bySp) {
      const sp = ZG.SPECIES[spId];
      if (s.ssp.recs.some((r) => r.sp === spId && (r.status === 'open' || r.status === 'accepted'))) continue;
      if (made >= 6 || (ZG.SPECIES[spId].program !== 'Loan' && U.chance(s, 0.3))) continue;
      const list = bySp[spId].filter((a) => !a.preg);
      const lifeOk = (a) => a.age / (sp.life * 365) < 0.8;
      const fem = list.filter((a) => a.sex === 'F' && ZG.Animals.isMature(a) && lifeOk(a));
      const mal = list.filter((a) => a.sex === 'M' && ZG.Animals.isMature(a) && lifeOk(a));
      const total = bySp[spId].length;
      const r = { id: s.nextId++, sp: spId, created: s.day, deadline: s.day + 730, status: 'open', partner: Z_.partner(s) };
      const bornHereAdults = list.filter((a) => a.bornHere && a.age > sp.mature * 365 * 0.8);
      if ((total > sp.group[1] || bornHereAdults.length) && U.chance(s, 0.6)) {
        const cand = bornHereAdults.length ? bornHereAdults : list.filter((a) => a.gv === 'Low' || a.sex === 'M');
        if (cand.length) {
          const a = U.pick(s, cand);
          Object.assign(r, { type: 'send', aids: [a.id], text: `Send ${a.name} (${a.sex === 'M' ? 'male' : 'female'}, ${U.ageStr(a.age)}) to ${r.partner} to join a breeding group.` });
          s.ssp.recs.push(r);
          made++;
          continue;
        }
      }
      let pair = null;
      for (const f of U.shuffle(s, fem)) {
        const m = mal.find((m) => m.hab === f.hab && !ZG.Animals.related(s, f, m)) || mal.find((m) => !ZG.Animals.related(s, f, m));
        if (m) {
          pair = [f, m];
          break;
        }
      }
      if (pair && (U.chance(s, sp.program === 'Loan' ? 1 : 0.62))) {
        const [f, m] = pair;
        const sameHab = f.hab === m.hab;
        (s.ssp.status = s.ssp.status || {})[sp.id] = 'grow';
        Object.assign(r, { type: 'breed', aids: [f.id, m.id], text: `Breed ${f.name} ♀ × ${m.name} ♂. Genetically valuable pairing.${sameHab ? '' : ' (They are in different habitats — house them together.)'}` });
      } else if (pair) {
        (s.ssp.status = s.ssp.status || {})[sp.id] = 'hold';
        Object.assign(r, { type: 'nobreed', aids: [], text: `Do NOT breed — the North American population is at target size. Keep all ${sp.name}s on contraception.` });
      } else if (sp.program === 'Loan') {
        continue;
      } else if (!fem.length || !mal.length) {
        const need = !fem.length ? 'F' : 'M';
        const age = Math.round(U.rf(s, sp.mature, sp.mature + 6) * 365);
        Object.assign(r, { type: 'receive', aids: [], offer: { sex: need, age, gv: U.pick(s, ['High', 'Medium']) }, text: `Receive a ${need === 'F' ? 'female' : 'male'} (${U.ageStr(age)}) from ${r.partner} to form a breeding pair.` });
      } else continue;
      s.ssp.recs.push(r);
      made++;
    }
    // Space request from a Taxon Advisory Group for a species you don't hold
    const held = new Set(s.animals.map((a) => a.sp));
    const Z = ZG.zoo(s);
    const cands = Object.values(ZG.SPECIES).filter((sp) => sp.program === 'SSP' && !held.has(sp.id) && sp.climate[0] <= Math.min(...Z.climate.hi) - 10 + 25 && sp.climate[1] >= Math.max(...Z.climate.hi) - 5);
    if (cands.length && U.chance(s, 0.7)) {
      const sp = U.pick(s, cands);
      s.ssp.recs.push({ id: s.nextId++, sp: sp.id, type: 'hold', created: s.day, deadline: s.day + 1095, status: 'open', aids: [], partner: `${sp.cls === 'bird' ? 'Avian' : sp.cls === 'reptile' ? 'Reptile' : 'Mammal'} Taxon Advisory Group`, text: `The TAG is asking zoos to commit space for ${sp.name}s (IUCN: ${sp.iucn}). Build or dedicate a habitat and acquire them within 3 years.` });
      made++;
    }
    ZG.Sim.news(s, `📋 AZA published new Breeding & Transfer Plans: ${made} recommendation${made === 1 ? '' : 's'} for your zoo. See 🧬 Conservation → SSP plans.`, 'info');
    if (made) ZG.Events.queue(s, 'ssp_plan', { year: U.dateOf(s.day).y });
  };

  Z_.respond = function (s, rid, accept, habId) {
    const r = s.ssp.recs.find((x) => x.id === rid);
    if (!r || r.status !== 'open') return { ok: false, msg: 'Not available.' };
    const sp = ZG.SPECIES[r.sp];
    if (!accept) {
      r.status = 'declined';
      s.aza = U.clamp(s.aza - (r.type === 'hold' ? 0.5 : 2.5), 0, 100);
      return { ok: true, msg: 'Declined. The SSP coordinator noted it.' };
    }
    if (r.type === 'breed') {
      for (const id of r.aids) {
        const a = ZG.Animals.byId(s, id);
        if (a) a.contra = false;
      }
      r.status = 'accepted';
      s.aza = U.clamp(s.aza + 1, 0, 100);
      return { ok: true, msg: 'Contraception removed for the pair. Make sure they share a habitat!' };
    }
    if (r.type === 'nobreed') {
      for (const a of s.animals) if (a.sp === r.sp) a.contra = true;
      r.status = 'accepted';
      s.aza = U.clamp(s.aza + 0.5, 0, 100);
      return { ok: true, msg: `All ${sp.name}s placed on contraception.` };
    }
    if (r.type === 'send') {
      const a = ZG.Animals.byId(s, r.aids[0]);
      if (!a) {
        r.status = 'expired';
        return { ok: false, msg: 'That animal is no longer here.' };
      }
      ZG.Animals.remove(s, a);
      r.status = 'done';
      s.aza = U.clamp(s.aza + 3, 0, 100);
      ZG.Econ.spend(s, 'transport', Math.round(sp.transport * 0.3));
      if (a.star) s.rep = U.clamp(s.rep - 3, 0, 100);
      ZG.Sim.news(s, `🚚 ${a.name} the ${sp.name} departed for ${r.partner} under an SSP recommendation.`, 'info');
      return { ok: true, msg: `${a.name} is on the way to ${r.partner}.` };
    }
    if (r.type === 'receive') {
      const h = habId ? s.habitatsById[habId] : Z_.bestHabitatFor(s, r.sp);
      if (!h) return { ok: false, msg: `You need a habitat for ${sp.name}s first.` };
      const cost = Z_.transportCost(s, r.sp);
      if (!ZG.Econ.canAfford(s, cost)) return { ok: false, msg: 'Not enough cash for transport.' };
      ZG.Econ.spend(s, 'transport', cost);
      const a = ZG.Animals.create(s, r.sp, r.offer.sex, r.offer.age, { hab: h.id, loc: 'quarantine', qDays: Z_.quarantineDays(s), gv: r.offer.gv, contra: true });
      r.status = 'done';
      Z_.advise(s, a, 'arrival');
      s.aza = U.clamp(s.aza + 2, 0, 100);
      ZG.Sim.news(s, `🚚 ${a.name}, a ${sp.name} from ${r.partner}, arrived and entered quarantine (${U.money(cost)} transport).`, 'good');
      return { ok: true, msg: `${a.name} arrives into quarantine.` };
    }
    if (r.type === 'contra') {
      for (const id of r.aids) {
        const a = ZG.Animals.byId(s, id);
        if (a) a.contra = true;
      }
      r.status = 'done';
      s.aza = U.clamp(s.aza + 0.5, 0, 100);
      return { ok: true, msg: 'Kept on contraception, as the SSP asked.' };
    }
    if (r.type === 'separate') {
      const a = ZG.Animals.byId(s, r.aids[0]);
      if (!a) {
        r.status = 'done';
        return { ok: true, msg: 'Already resolved.' };
      }
      ZG.Animals.remove(s, a);
      r.status = 'done';
      s.aza = U.clamp(s.aza + 3, 0, 100);
      ZG.Econ.spend(s, 'transport', Math.round(sp.transport * 0.3));
      ZG.Sim.news(s, `🚚 ${a.name} the ${sp.name} left for ${r.partner}, where the SSP has an unrelated mate waiting.`, 'info');
      return { ok: true, msg: `${a.name} is on the way to ${r.partner}. No inbreeding risk now.` };
    }
    if (r.type === 'hold') {
      r.status = 'accepted';
      s.aza = U.clamp(s.aza + 1, 0, 100);
      return { ok: true, msg: `Committed. Build a ${sp.biomes.map((b) => ZG.BIOMES[b].name).join(' / ')} habitat and look for ${sp.name}s in the Animal Exchange.` };
    }
  };

  Z_.quarantineDays = (s) => (s.zooId === 'honolulu' ? 60 : 30);
  Z_.transportCost = (s, spId) => Math.round(ZG.SPECIES[spId].transport * ZG.zoo(s).costMult * (s.zooId === 'honolulu' ? 1.4 : 1));

  Z_.bestHabitatFor = function (s, spId) {
    const sp = ZG.SPECIES[spId];
    const withSp = s.habitats.find((h) => !h.construction && s.animals.some((a) => a.hab === h.id && a.sp === spId));
    if (withSp) return withSp;
    return s.habitats.find((h) => !h.construction && sp.biomes.includes(h.biome) && !s.animals.some((a) => a.hab === h.id)) || null;
  };

  Z_.onBirth = function (s, mom, sireId, babies, inbred) {
    const sp = ZG.SPECIES[mom.sp];
    if (sp.program === 'none') return 'none';
    if (inbred) {
      s.aza = U.clamp(s.aza - 6, 0, 100);
      ZG.Sim.news(s, `⚠️ The ${sp.name} birth was an inbred pairing. The SSP coordinator is not pleased.`, 'bad');
      return 'inbred';
    }
    const rec = s.ssp.recs.find((r) => r.type === 'breed' && (r.status === 'accepted' || r.status === 'open') && r.aids[0] === mom.id);
    if (rec) {
      rec.status = 'done';
      if (babies.length) s.stats.sspBirths++;
      s.aza = U.clamp(s.aza + 5, 0, 100);
      return 'recommended';
    }
    const nb = s.ssp.recs.find((r) => r.sp === mom.sp && r.type === 'nobreed' && (r.status === 'open' || r.status === 'accepted')) ||
      s.ssp.recs.find((r) => r.type === 'contra' && r.status !== 'expired' && s.day - r.created < 730 && (r.aids.includes(mom.id) || r.aids.includes(sireId)));
    if (nb) {
      s.aza = U.clamp(s.aza - 5, 0, 100);
      ZG.Sim.news(s, `⚠️ ${sp.name} birth despite the SSP's do-not-breed order. The coordinator is not happy, and it won't count toward your breeding goals.`, 'bad');
      return 'unplanned';
    }
    // Not on this year's plan, but the population can use it: it counts, with a small ding for not coordinating.
    if (babies.length) s.stats.sspBirths++;
    s.aza = U.clamp(s.aza - 1, 0, 100);
    ZG.Sim.news(s, `🍼 ${sp.name} birth. It wasn't on the SSP's plan, but it's a healthy addition to the population. Next time, follow a breeding recommendation for a bigger AZA boost.`, 'info');
    return 'unplanned';
  };

  // ---------- Animal exchange (acquisitions) ----------
  const RESCUE = ['grizzly_bear', 'mountain_lion', 'moose', 'sea_lion', 'river_otter', 'alligator', 'black_bear'];
  Z_.refreshMarket = function (s) {
    s.market = s.market.filter((o) => o.expires > s.day);
    const Z = ZG.zoo(s);
    const held = new Set(s.animals.map((a) => a.sp));
    const pool = Object.values(ZG.SPECIES).filter((sp) => sp.program !== 'Loan');
    const n = U.ri(s, 2, 4);
    for (let i = 0; i < n && s.market.length < 8; i++) {
      const sp = U.weighted(s, pool, (sp) => {
        if (sp.program === 'SSP' && !Z_.accredited(s)) return 0;
        let w = held.has(sp.id) ? 3 : 1;
        if (RESCUE.includes(sp.id)) w *= 0.8;
        const hot = Math.max(...Z.climate.hi), cold = Math.min(...Z.climate.hi) - 20;
        if (sp.climate[1] < hot - 8 || sp.climate[0] > cold + 25) w *= 0.3;
        return w;
      });
      if (!sp) continue;
      const rescue = RESCUE.includes(sp.id);
      const count = sp.group[0] >= 10 ? U.ri(s, 6, 12) : rescue && U.chance(s, 0.5) ? 2 : 1;
      const sex = U.chance(s, 0.5) ? 'M' : 'F';
      const age = rescue ? U.ri(s, 60, 400) : Math.round(U.rf(s, sp.mature * 0.8, sp.mature + 8) * 365);
      s.market.push({
        id: s.nextId++, sp: sp.id, count, sex, age, gv: U.pick(s, ['High', 'Medium', 'Medium', 'Low']),
        from: rescue ? U.pick(s, ['State Fish & Wildlife (orphaned)', 'NOAA stranding network (non-releasable)', 'Federal confiscation', 'Wildlife rehab center']) : U.pick(s, ZG.NAMES.partnerZoos),
        kind: rescue ? 'rescue' : sp.program === 'SSP' ? 'ssp' : 'institution',
        cost: Math.round(Z_.transportCost(s, sp.id) * (count > 1 ? 1 + count * 0.15 : 1) + (rescue ? 0 : 5000)),
        expires: s.day + U.ri(s, 45, 120),
      });
    }
  };

  Z_.acquire = function (s, oid, hid) {
    const o = s.market.find((x) => x.id === oid);
    const h = s.habitatsById[hid];
    if (!o || !h || h.construction) return { ok: false, msg: 'Pick a finished habitat.' };
    if (!ZG.Econ.canAfford(s, o.cost)) return { ok: false, msg: 'Not enough cash.' };
    const sp = ZG.SPECIES[o.sp];
    ZG.Econ.spend(s, 'transport', o.cost);
    const names = [];
    for (let i = 0; i < o.count; i++) {
      const sex = o.count > 1 ? (i % 2 ? 'M' : 'F') : o.sex;
      const a = ZG.Animals.create(s, o.sp, sex, o.age + U.ri(s, -60, 60), { hab: h.id, loc: 'quarantine', qDays: Z_.quarantineDays(s), gv: o.gv });
      names.push(a.name);
    }
    s.market.splice(s.market.indexOf(o), 1);
    for (const a of s.animals.slice(-o.count)) if (a.sp === o.sp && a.loc === 'quarantine') Z_.advise(s, a, 'arrival');
    const first = !s.stats.speciesSeen.includes(o.sp);
    if (first) {
      s.stats.speciesSeen.push(o.sp);
      s.stats.speciesAdded++;
      s.novelty = Math.min(0.8, s.novelty + 0.04 * sp.appeal / 5);
    }
    if (o.kind === 'rescue') s.rep = U.clamp(s.rep + 2, 0, 100);
    const hold = s.ssp.recs.find((r) => r.type === 'hold' && r.sp === o.sp && (r.status === 'accepted' || r.status === 'open'));
    if (hold) {
      hold.status = 'done';
      s.aza = U.clamp(s.aza + 5, 0, 100);
      ZG.Sim.news(s, `🌍 You fulfilled the TAG space request for ${sp.name}s. AZA standing up.`, 'good');
    }
    ZG.Sim.news(s, `🚚 ${names.join(', ')} (${sp.name}) arriving from ${o.from} — ${Z_.quarantineDays(s)}-day quarantine at the animal hospital.`, 'good');
    return { ok: true, msg: `Acquired ${o.count} ${sp.name}${o.count > 1 ? 's' : ''}.` };
  };

  // Ask the SSP / partner zoos for one specific animal (a companion or mate) for a habitat.
  Z_.requestCost = (s, spId) => Math.round(Z_.transportCost(s, spId) + 5000);
  Z_.requestAnimal = function (s, spId, hid, sex) {
    const sp = ZG.SPECIES[spId];
    if (!sp || sp.program === 'Loan') return { ok: false, msg: 'Panda loans are negotiated government-to-government.' };
    if (sp.program === 'SSP' && !Z_.accredited(s)) return { ok: false, msg: "Without AZA accreditation the SSP won't place animals with you." };
    const o = {
      id: s.nextId++, sp: spId, count: 1, sex: sex || (U.chance(s, 0.5) ? 'M' : 'F'), age: Math.round(U.rf(s, sp.mature, sp.mature + 6) * 365),
      gv: U.pick(s, ['High', 'Medium', 'Medium']), from: U.pick(s, ZG.NAMES.partnerZoos), kind: sp.program === 'SSP' ? 'ssp' : 'institution',
      cost: Z_.requestCost(s, spId), expires: s.day + 60,
    };
    s.market.push(o);
    const r = Z_.acquire(s, o.id, hid);
    if (!r.ok) s.market = s.market.filter((x) => x.id !== o.id);
    return r;
  };

  Z_.move = function (s, aid, hid) {
    const a = ZG.Animals.byId(s, aid);
    const h = s.habitatsById[hid];
    if (!a || !h || h.construction) return { ok: false, msg: 'Invalid move.' };
    a.hab = h.id;
    a.welfare -= 8;
    ZG.Econ.spend(s, 'transport', 1500);
    return { ok: true, msg: `${a.name} moved to ${h.name}.` };
  };

  Z_.sendOut = function (s, aid) {
    const a = ZG.Animals.byId(s, aid);
    if (!a) return { ok: false, msg: 'Not found.' };
    const sp = ZG.SPECIES[a.sp];
    const rec = s.ssp.recs.find((r) => r.type === 'send' && r.status === 'open' && r.aids[0] === a.id);
    if (rec) return Z_.respond(s, rec.id, true);
    if (sp.program === 'Loan') return { ok: false, msg: 'Pandas are on loan from China — you can\'t send them anywhere.' };
    ZG.Animals.remove(s, a);
    if (sp.program === 'SSP') s.aza = U.clamp(s.aza - 1, 0, 100);
    if (a.star) s.rep = U.clamp(s.rep - 4, 0, 100);
    ZG.Econ.spend(s, 'transport', Math.round(sp.transport * 0.3));
    const dest = Z_.partner(s);
    ZG.Sim.news(s, `🚚 ${a.name} the ${sp.name} was transferred to ${dest}.`, 'info');
    return { ok: true, msg: `${a.name} transferred to ${dest}.` };
  };

  // ---------- Accreditation ----------
  Z_.inspectionScore = function (s) {
    const Z = ZG.zoo(s);
    const welfare = ZG.Animals.avgWelfare(s);
    const staff = 100 * Math.min(1, (ZG.Staff.ratio(s, 'keepers') + ZG.Staff.ratio(s, 'vets')) / 2);
    const inf = s.infra;
    const infra = 0.4 * ZG.Infra.avgCond(s) + 0.2 * inf.perimeter.cond + 0.2 * inf.hospital.cond + 0.2 * inf.life.cond;
    const monthlyExp = ZG.Econ.annualBudget(s) / 12;
    const fin = U.clamp(45 + (s.cash / monthlyExp) * 12, 0, 100);
    const cons = U.clamp(100 * s.policy.conservation / Math.max(1, Z.refs.conservation), 0, 110);
    const edu = 100 * Math.min(1, ZG.Staff.ratio(s, 'education'));
    const parts = { 'Animal welfare': welfare, 'Staffing (keepers & vets)': staff, 'Facilities & safety': infra, 'Financial stability': fin, 'Conservation commitment': cons, 'SSP participation': s.aza, 'Education programs': edu };
    const total = 0.26 * welfare + 0.14 * staff + 0.2 * infra + 0.1 * fin + 0.1 * cons + 0.14 * s.aza + 0.06 * edu + ZG.mod(s, 'aza') * 0.5;
    return { total, parts };
  };

  Z_.composite = function (s) {
    const Z = ZG.zoo(s);
    const welfare = ZG.Animals.avgWelfare(s);
    const cons = U.clamp(100 * s.policy.conservation / Math.max(1, Z.refs.conservation), 0, 110);
    const staff = 100 * Math.min(1.05, (ZG.Staff.ratio(s, 'keepers') + ZG.Staff.ratio(s, 'vets')) / 2);
    return 0.45 * welfare + 0.25 * cons + 0.3 * staff;
  };

  // ---------- Individual SSP guidance ----------
  // Unrelated opposite-sex mates for an animal at this zoo (same habitat first).
  Z_.findMate = function (s, a) {
    const sp = ZG.SPECIES[a.sp];
    const soon = (x) => x.age >= sp.mature * 365 - 180 && x.age / (sp.life * 365) < 0.8;
    const c = s.animals.filter((m) => m.sp === a.sp && m.sex !== a.sex && m.id !== a.id && soon(m) && !ZG.Animals.related(s, a, m) && !m.inbred);
    c.sort((x, y) => (y.hab === a.hab) - (x.hab === a.hab) || ({ High: 2, Medium: 1, Low: 0 }[y.gv] || 1) - ({ High: 2, Medium: 1, Low: 0 }[x.gv] || 1));
    return c[0] || null;
  };
  const hasOpen = (s, type, ids) => s.ssp.recs.some((r) => r.type === type && (r.status === 'open' || r.status === 'accepted') && ids.every((id) => r.aids.includes(id)));
  const coordinator = (sp) => `${sp.name} SSP coordinator`;

  // Guidance for one animal: when it arrives, or as a youngster nears maturity.
  Z_.advise = function (s, a, why) {
    const sp = ZG.SPECIES[a.sp];
    if (!a || sp.program !== 'SSP' || !sp.breeds || a.advised) return;
    a.advised = s.day;
    const st = (s.ssp.status = s.ssp.status || {});
    if (!st[a.sp]) st[a.sp] = U.chance(s, 0.65) ? 'grow' : 'hold';
    const base = { id: s.nextId++, sp: a.sp, created: s.day, deadline: s.day + 180, status: 'open', partner: coordinator(sp) };
    const intro = why === 'arrival' ? `${a.name} ${U.dateOf(s.day).y === U.dateOf(a.arrived || s.day).y ? 'has arrived' : 'is new'}.` : `${a.name} is nearly mature.`;
    const mate = st[a.sp] === 'grow' ? Z_.findMate(s, a) : null;
    if (mate && !hasOpen(s, 'breed', [a.id, mate.id])) {
      const f = a.sex === 'F' ? a : mate, m = a.sex === 'M' ? a : mate;
      const sameHab = f.hab === m.hab;
      s.ssp.recs.push(Object.assign(base, { type: 'breed', aids: [f.id, m.id], text: `${intro} The SSP recommends breeding ${f.name} ♀ × ${m.name} ♂: an unrelated, genetically valuable pair.${sameHab ? '' : ' They are in different habitats, so house them together first.'}` }));
      ZG.Sim.news(s, `🧬 SSP guidance for ${a.name} the ${sp.name}: breed with ${mate.name}. See Conservation → SSP plans.`, 'info');
      return;
    }
    s.ssp.recs.push(Object.assign(base, { type: 'contra', aids: [a.id], text: `${intro} ${st[a.sp] === 'hold' ? `The ${sp.name} population is at its target size, so` : `There is no unrelated mate for ${a.sex === 'M' ? 'him' : 'her'} here, so`} the SSP recommends keeping ${a.name} on contraception for now.` }));
    ZG.Sim.news(s, `🧬 SSP guidance for ${a.name} the ${sp.name}: keep on contraception. See Conservation → SSP plans.`, 'info');
  };

  // Related opposite-sex animals living together, one of them close to maturity or older.
  Z_.inbreedingScan = function (s) {
    const bySpHab = {};
    for (const a of s.animals) {
      const sp = ZG.SPECIES[a.sp];
      if (!sp.breeds || sp.group[0] >= 10) continue;
      (bySpHab[a.sp + ':' + a.hab] = bySpHab[a.sp + ':' + a.hab] || []).push(a);
    }
    for (const list of Object.values(bySpHab)) {
      if (list.length < 2) continue;
      const sp = ZG.SPECIES[list[0].sp];
      const near = (x) => x.age >= sp.mature * 365 - 120;
      for (const a of list)
        for (const b of list) {
          if (a.sex !== 'F' || b.sex !== 'M' || !near(a) || !near(b) || !ZG.Animals.related(s, a, b)) continue;
          if (hasOpen(s, 'separate', [a.id, b.id])) continue;
          const young = a.age < b.age ? a : b, elder = young === a ? b : a;
          const kin = young.dam === elder.id || young.sire === elder.id ? (elder.sex === 'F' ? 'mother' : 'father') : 'close relative';
          s.ssp.recs.push({
            id: s.nextId++, sp: a.sp, type: 'separate', aids: [young.id, elder.id], created: s.day, deadline: s.day + 120, status: 'open', partner: Z_.partner(s),
            text: `${young.name} is ${near(young) && young.age >= sp.mature * 365 ? 'now' : 'almost'} mature and lives with ${young.sex === 'M' ? 'his' : 'her'} ${kin} ${elder.name}. To prevent inbreeding, the SSP recommends transferring ${young.name} to ${'another zoo'} with an unrelated mate, or moving ${young.sex === 'M' ? 'him' : 'her'} to a different habitat before ${U.fmtDate(s.day + 120)}.`,
          });
          ZG.Sim.news(s, `🧬 Inbreeding risk: ${young.name} and ${elder.name} (${sp.name}s) are related and share a habitat. See Conservation → SSP plans.`, 'bad');
        }
    }
    // Resolve or expire guidance that no longer applies.
    for (const r of s.ssp.recs) {
      if (r.status !== 'open' && r.status !== 'accepted') continue;
      const an = r.aids.map((id) => ZG.Animals.byId(s, id));
      if (r.type === 'separate') {
        if (an.some((x) => !x) || an[0].hab !== an[1].hab) {
          r.status = 'done';
          s.aza = U.clamp(s.aza + 2, 0, 100);
          ZG.Sim.news(s, `🧬 The ${ZG.SPECIES[r.sp].name} inbreeding risk is resolved. The SSP coordinator thanks you.`, 'good');
        }
      } else if ((r.type === 'breed' || r.type === 'contra') && an.some((x) => !x)) r.status = 'expired';
    }
  };

  Z_.monthly = function (s, t) {
    Z_.inbreedingScan(s);
    // Youngsters born here get their own guidance as they approach maturity.
    for (const a of s.animals) {
      const sp = ZG.SPECIES[a.sp];
      if (a.bornHere && !a.advised && sp.program === 'SSP' && a.age >= sp.mature * 365 - 90) Z_.advise(s, a, 'maturity');
    }
    const target = s.anchor.aza0 + 0.8 * (Z_.composite(s) - s.anchor.aza) + ZG.mod(s, 'aza') * 0.3;
    s.aza += (target - s.aza) * 0.04;
    s.aza = U.clamp(s.aza, 0, 100);
    const acc = s.acc;
    if (!acc.warned && s.day >= acc.next - 90) {
      acc.warned = true;
      ZG.Events.queue(s, 'inspection_warning', {});
    }
    if (s.day >= acc.next) Z_.inspect(s);
  };

  Z_.inspect = function (s) {
    const acc = s.acc;
    const sc = Z_.inspectionScore(s);
    const prev = acc.status;
    let result;
    if (sc.total >= 68) result = 'accredited';
    else if (sc.total >= 56 && prev !== 'tabled') result = 'tabled';
    else result = 'lost';
    if (prev === 'lost' && sc.total >= 68) result = 'accredited';
    acc.status = result;
    acc.lastScore = sc.total;
    acc.warned = false;
    acc.next = s.day + (result === 'accredited' ? 365 * 5 : 365);
    acc.history.push({ day: s.day, score: sc.total, result });
    if (result === 'accredited') {
      s.stats.inspectionsPassed++;
      s.board = U.clamp(s.board + 8, 0, 100);
      s.rep = U.clamp(s.rep + 3, 0, 100);
      s.aza = U.clamp(s.aza + 5, 0, 100);
    } else if (result === 'tabled') {
      s.board = U.clamp(s.board - 6, 0, 100);
      s.rep = U.clamp(s.rep - 3, 0, 100);
    } else {
      s.board = U.clamp(s.board - 22, 0, 100);
      s.rep = U.clamp(s.rep - 12, 0, 100);
      s.aza = U.clamp(s.aza - 15, 0, 100);
      for (const r of s.ssp.recs) if (r.status === 'open') r.status = 'expired';
      // Partner zoos recall some animals that were on breeding loan.
      const loaned = s.animals.filter((a) => ZG.SPECIES[a.sp].program === 'SSP' && !a.bornHere && !a.star);
      const recalled = loaned.filter(() => U.chance(s, 0.25));
      for (const a of recalled) ZG.Animals.remove(s, a);
      if (recalled.length) ZG.Sim.news(s, `🚚 Partner zoos recalled ${recalled.length} animals on breeding loan: ${recalled.map((a) => a.name).join(', ')}.`, 'bad');
    }
    ZG.Events.queue(s, 'inspection', { score: sc.total, parts: sc.parts, result, prev });
  };
})((globalThis.ZG = globalThis.ZG || {}));
