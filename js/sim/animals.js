// Animals: creation, welfare, health, illness, aging, breeding, births, deaths.
(function (ZG) {
  const U = ZG.U;
  const A = (ZG.Animals = {});

  const POOL_BY_SPECIES = {
    african: ['african_elephant', 'giraffe', 'grevys_zebra', 'white_rhino', 'hippo', 'pygmy_hippo', 'lion', 'cheetah', 'gorilla', 'chimpanzee', 'african_penguin', 'bongo', 'warthog', 'ring_tailed_lemur', 'flamingo', 'african_buffalo', 'african_leopard', 'african_wild_dog', 'ostrich', 'okapi'],
    asian: ['asian_elephant', 'amur_tiger', 'sumatran_tiger', 'snow_leopard', 'clouded_leopard', 'orangutan', 'giant_panda', 'red_panda', 'sun_bear', 'komodo', 'water_monitor', 'bactrian_camel'],
    american: ['mountain_lion', 'grizzly_bear', 'mexican_wolf', 'moose', 'bison', 'sea_lion', 'river_otter', 'california_condor', 'alligator', 'andean_bear', 'sloth', 'galapagos_tortoise', 'polar_bear', 'koala', 'red_kangaroo', 'black_bear', 'alpaca', 'jaguar', 'arctic_fox'],
  };

  A.nameFor = function (s, spId) {
    const N = ZG.NAMES.animal;
    let pool = N.misc;
    if (s.zooId === 'honolulu' && U.chance(s, 0.35)) pool = N.hawaiian;
    else if (spId === 'nene') pool = N.hawaiian;
    else if (POOL_BY_SPECIES.african.includes(spId)) pool = N.african;
    else if (POOL_BY_SPECIES.asian.includes(spId)) pool = N.asian;
    else if (POOL_BY_SPECIES.american.includes(spId)) pool = N.american;
    if (U.chance(s, 0.15)) pool = N.misc;
    const living = new Set(s.animals.map((a) => a.name));
    for (let i = 0; i < 12; i++) {
      const n = U.pick(s, pool);
      if (!living.has(n)) return n;
    }
    return U.pick(s, pool) + ' ' + ['II', 'Jr.', 'III'][U.ri(s, 0, 2)];
  };

  A.create = function (s, spId, sex, ageDays, extra) {
    const sp = ZG.SPECIES[spId];
    const a = Object.assign(
      {
        id: s.nextId++,
        name: A.nameFor(s, spId),
        sp: spId,
        sex,
        age: Math.max(0, Math.round(ageDays)),
        hab: null,
        loc: 'hab',
        qDays: 0,
        health: U.ri(s, 82, 98),
        welfare: 72,
        contra: true,
        preg: null,
        lastBirth: -99999,
        sick: null,
        dam: null,
        sire: null,
        gv: U.pick(s, ['High', 'Medium', 'Medium', 'Low']),
        born: s.day - Math.round(ageDays),
        bornHere: false,
        star: false,
        inbred: false,
        mood: U.pick(s, sp.behaviors),
        arrived: s.day,
      },
      extra || {}
    );
    s.ped[a.id] = [a.dam, a.sire];
    s.animals.push(a);
    return a;
  };

  A.byId = (s, id) => s.animals.find((a) => a.id === id);
  A.inHab = (s, hid) => s.animals.filter((a) => a.hab === hid && a.loc === 'hab');
  A.isMature = (a) => a.age >= ZG.SPECIES[a.sp].mature * 365;
  A.isInfant = (a) => a.age < 365;
  A.notable = (a) => ZG.SPECIES[a.sp].appeal >= 6 || a.star;

  function ancestors(s, id, depth, out) {
    out.add(id);
    if (depth <= 0) return out;
    const p = s.ped[id];
    if (!p) return out;
    for (const pid of p) if (pid != null) ancestors(s, pid, depth - 1, out);
    return out;
  }
  A.related = function (s, a, b) {
    const sa = ancestors(s, a.id, 2, new Set());
    const sb = ancestors(s, b.id, 2, new Set());
    for (const x of sa) if (sb.has(x)) return true;
    return false;
  };

  // ---------- Welfare ----------
  A.habitatFactors = function (s, h) {
    const temp = s.today ? s.today.temp : 70;
    const animals = A.inHab(s, h.id);
    const bySp = {};
    for (const a of animals) (bySp[a.sp] = bySp[a.sp] || []).push(a);
    const spIds = Object.keys(bySp);
    let need = 0;
    for (const id of spIds) need += ZG.SPECIES[id].space * bySp[id].length;
    const spaceRatio = need > 0 ? h.area / need : 2;
    // Meeting the minimum is adequate (60); generous space (3x) is excellent (100).
    const space = spaceRatio < 1 ? spaceRatio * 35 : U.clamp(35 + 25 * Math.log2(spaceRatio), 0, 100);
    const mixOk = spIds.length <= 1 || spIds.every((id) => ZG.SPECIES[id].mix && ZG.SPECIES[id].mix === ZG.SPECIES[spIds[0]].mix);
    const kr = ZG.Staff.ratio(s, 'keepers');
    const er = s.policy.enrichment / Math.max(1, ZG.zoo(s).refs.enrichment);
    const care = U.clamp(100 * (0.65 * Math.pow(Math.min(1.1, kr), 1.5) + 0.35 * Math.min(1.2, er)), 0, 100);
    const complexity = 0.3 * h.theming + 0.7 * h.condition; // habitat quality
    const per = {};
    for (const id of spIds) {
      const sp = ZG.SPECIES[id];
      const n = bySp[id].length;
      const biome = sp.biomes.includes(h.biome) ? 100 : 55;
      let diff = 0;
      if (temp < sp.climate[0] && h.climate !== 'heated') diff = sp.climate[0] - temp;
      if (temp > sp.climate[1] && h.climate !== 'chilled') diff = temp - sp.climate[1];
      const climate = U.clamp(100 - diff * 3.5, 10, 100);
      let social = 100;
      if (n < sp.group[0]) social = 100 - (sp.group[0] - n) * (sp.group[0] <= 2 ? 15 : 12);
      if (n > sp.group[1]) social = 100 - (n - sp.group[1]) * 6;
      social = U.clamp(social, 20, 100);
      const cond = h.condition;
      // Core welfare, then multiplicative penalties for wrong biome/climate/mixing.
      let w = 0.15 * space + 0.1 * social + 0.45 * complexity + 0.3 * care - 3;
      w *= (biome === 100 ? 1 : 0.82) * (0.55 + 0.45 * climate / 100) * (mixOk ? 1 : 0.75);
      per[id] = { n, biome, climate, social, w, tempDiff: diff };
      void cond;
    }
    return { spaceRatio, space, mixOk, care, complexity, per, count: animals.length };
  };

  A.updateWelfare = function (s) {
    const hf = {};
    for (const h of s.habitats) if (!h.construction) hf[h.id] = A.habitatFactors(s, h);
    for (const a of s.animals) {
      let target = 60;
      if (a.loc === 'hab' && hf[a.hab]) {
        const f = hf[a.hab].per[a.sp];
        target = f ? f.w : 60;
        const h = s.habitatsById[a.hab];
        if (h && h.renovation) target -= 8;
      } else if (a.loc === 'quarantine') target = 62;
      target = 0.9 * target + 0.1 * a.health + ZG.mod(s, 'welfare');
      if (a.sick) target -= 6 * a.sick.sev;
      a.welfare += (target - a.welfare) * 0.06;
    }
    s._hf = hf;
  };

  // ---------- Daily life ----------
  A.daily = function (s, t) {
    A.updateWelfare(s);
    const vr = ZG.Staff.ratio(s, 'vets');
    const vetF = U.clamp(vr * ZG.mod(s, 'vet'), 0.3, 1.3);
    const dead = [];
    for (const a of s.animals) {
      const sp = ZG.SPECIES[a.sp];
      a.age++;
      const lifeFrac = a.age / (sp.life * 365);

      if (a.loc === 'quarantine') {
        a.qDays--;
        if (a.qDays <= 0) {
          const h = s.habitatsById[a.hab];
          if (h && !h.construction) {
            a.loc = 'hab';
            ZG.Sim.news(s, `${sp.emoji} ${a.name} the ${sp.name} cleared quarantine and moved into ${h.name}.`, 'animal');
            s.novelty = Math.min(0.6, s.novelty + 0.015 * sp.appeal / 5);
          } else a.qDays = 7;
        }
      }

      // Health
      if (a.sick) {
        a.sick.days--;
        const dmg = a.sick.sev * 0.7 * (a.sick.treated ? 0.45 : 1) * (1.35 - 0.35 * vetF);
        a.health -= dmg;
        if (a.sick.days <= 0) {
          ZG.Sim.news(s, `${sp.emoji} ${a.name} has recovered from ${a.sick.name.toLowerCase()}.`, 'animal');
          a.sick = null;
        }
      } else {
        let cap = 100 - (lifeFrac > 0.8 ? (lifeFrac - 0.8) * 110 : 0) - (a.welfare < 55 ? (55 - a.welfare) * 0.6 : 0) - (a.inbred ? 15 : 0);
        a.health += (cap - a.health) * 0.02 * vetF;
      }
      a.health = U.clamp(a.health, 0, 100);

      // Illness onset
      if (!a.sick) {
        const pYear = 0.1 * sp.vetRisk * (1.8 - a.welfare / 100) * (1 + Math.max(0, lifeFrac - 0.6) * 2.5) / Math.min(1.2, vetF + 0.2) * (s.flags.diseaseMult || 1);
        if (U.rand(s) < U.annualToDaily(pYear)) A.fallIll(s, a);
      }

      // Mortality
      let mYear = 0.006 + 0.3 * Math.pow(Math.max(0, lifeFrac - 0.72) / 0.28, 2);
      if (a.health < 30) mYear += (30 - a.health) / 30 * 1.5;
      if (a.sick && a.sick.sev === 3 && !a.sick.treated) mYear += 0.6;
      if (a.age < 60) mYear += 0.1 / Math.max(0.5, vetF);
      if (U.rand(s) < U.annualToDaily(mYear)) dead.push(a);

      // Pregnancy
      if (a.preg) {
        a.preg.days--;
        if (a.preg.days <= 0) A.giveBirth(s, a);
      } else if (a.sex === 'F' && !a.contra && sp.breeds && a.loc === 'hab' && A.isMature(a) && lifeFrac < 0.85 && s.day - a.lastBirth >= sp.interbirth) {
        const mates = s.animals.filter((m) => m.sp === a.sp && m.sex === 'M' && m.hab === a.hab && m.loc === 'hab' && !m.contra && A.isMature(m) && m.age / (sp.life * 365) < 0.9);
        if (mates.length) {
          let p = sp.fert * Math.pow(U.clamp(a.welfare / 80, 0.2, 1.2), 2);
          if (a.sp === 'giant_panda') p = t.m >= 2 && t.m <= 4 ? p * 4 : 0;
          if (U.rand(s) < p) {
            const sire = U.pick(s, mates);
            a.preg = { days: sp.gestation + U.ri(s, -5, 5), sire: sire.id };
            if (A.notable(a)) ZG.Sim.news(s, `${sp.emoji} Ultrasound confirms ${a.name} the ${sp.name} is expecting! Due in about ${Math.round(sp.gestation / 30)} months.`, 'good');
          }
        }
      }
      if (U.rand(s) < 0.02) a.mood = U.pick(s, sp.behaviors);
    }
    for (const a of dead) A.die(s, a, a.sick ? a.sick.name : a.age / (ZG.SPECIES[a.sp].life * 365) > 0.8 ? 'age-related decline' : 'sudden illness');
  };

  A.fallIll = function (s, a) {
    const sp = ZG.SPECIES[a.sp];
    const pool = sp.diseases.length && U.chance(s, 0.55) ? sp.diseases : ZG.GENERIC_ILLNESS[sp.cls];
    let name = U.pick(s, pool);
    let sev = U.weighted(s, [1, 2, 3], (x) => [0.55, 0.32, 0.13][x - 1]);
    if (/EEHV|Cardiac|cancer|lymphoma|Tuberculosis/i.test(name)) sev = Math.max(sev, 2);
    if (/EEHV/.test(name) && a.age > 12 * 365) name = 'Foot abscess';
    a.sick = { name, sev, days: U.ri(s, 10, 25) * sev, treated: false };
    const cost = Math.round(sev * sev * (1500 + sp.food * 0.25) * ZG.zoo(s).costMult);
    if (A.notable(a) && sev >= 2) {
      ZG.Events.queue(s, 'illness', { aid: a.id, cost });
    } else {
      a.sick.treated = true;
      ZG.Econ.spend(s, 'vetcare', cost);
      if (sev >= 2 || A.notable(a)) ZG.Sim.news(s, `${sp.emoji} Vet team treating ${a.name} (${sp.name}) for ${name.toLowerCase()} — ${U.money(cost)}.`, 'animal');
    }
  };

  A.remove = function (s, a) {
    const i = s.animals.indexOf(a);
    if (i >= 0) s.animals.splice(i, 1);
  };

  A.die = function (s, a, cause) {
    const sp = ZG.SPECIES[a.sp];
    A.remove(s, a);
    s.stats.deaths++;
    const h = s.habitatsById[a.hab];
    ZG.fx(s, 'death', a.hab);
    const notable = A.notable(a);
    const hit = a.star ? 5 : notable ? 1.5 : 0.2;
    s.rep = U.clamp(s.rep - hit, 0, 100);
    if (notable && a.age > 60) ZG.Events.queue(s, 'death', { name: a.name, sp: a.sp, age: a.age, cause, star: a.star, hab: h ? h.name : '' });
    else if (a.age <= 60 && notable) ZG.Sim.news(s, `💔 ${sp.name} infant ${a.name} died at ${a.age} days old. Neonatal loss is heartbreakingly common.`, 'bad');
    else ZG.Sim.news(s, `🕊️ ${a.name} the ${sp.name} (${U.ageStr(a.age)}) died of ${cause}.`, 'bad');
    // Dependent infants whose mother died may need hand-rearing
    if (a.sex === 'F') {
      const orphan = s.animals.find((b) => b.dam === a.id && b.age < 180);
      if (orphan) ZG.Events.queue(s, 'rejection', { aid: orphan.id, orphan: true });
    }
  };

  A.giveBirth = function (s, mom) {
    const sp = ZG.SPECIES[mom.sp];
    const sire = s.ped[mom.preg.sire] ? A.byId(s, mom.preg.sire) : null;
    const sireId = mom.preg.sire;
    mom.preg = null;
    mom.lastBirth = s.day;
    const n = U.ri(s, sp.litter[0], sp.litter[1]);
    const vr = U.clamp(ZG.Staff.ratio(s, 'vets') * ZG.mod(s, 'vet'), 0.3, 1.25);
    const babies = [];
    const inbred = sire ? A.related(s, mom, sire) : false;
    for (let i = 0; i < n; i++) {
      const p = sp.infantSurv * (0.72 + 0.25 * vr) * (0.75 + 0.25 * mom.welfare / 100) * (inbred ? 0.8 : 1);
      if (U.rand(s) < p) {
        const b = A.create(s, mom.sp, U.chance(s, 0.5) ? 'M' : 'F', 0, {
          hab: mom.hab, dam: mom.id, sire: sireId, bornHere: true, inbred, gv: inbred ? 'Low' : U.pick(s, ['High', 'Medium', 'Medium']),
          health: 90, welfare: mom.welfare,
        });
        s.ped[b.id] = [mom.id, sireId];
        babies.push(b);
      }
    }
    const lost = n - babies.length;
    s.stats.births += babies.length;
    if (mom.sp === 'giraffe') s.stats.giraffeBirths += babies.length;
    if (mom.sp.includes('elephant')) s.stats.elephantBirths += babies.length;
    if (mom.sp === 'giant_panda') s.stats.pandaCubs += babies.length;
    ZG.fx(s, 'birth', mom.hab);
    const sspResult = ZG.AZA.onBirth(s, mom, sireId, babies, inbred);
    if (!babies.length) {
      ZG.Sim.news(s, `💔 ${mom.name} the ${sp.name} gave birth, but ${n > 1 ? 'none of the ' + n + ' offspring' : 'the baby'} survived.`, 'bad');
      return;
    }
    s.novelty = Math.min(0.7, s.novelty + 0.03 * Math.min(3, babies.length) * Math.max(0.3, sp.appeal / 5));
    s.rep = U.clamp(s.rep + Math.min(1.2, sp.appeal / 8), 0, 100);
    const big = sp.appeal >= 5 && !sp.flock;
    if (big) ZG.Events.queue(s, 'birth', { aids: babies.map((b) => b.id), mom: mom.id, lost, ssp: sspResult });
    else ZG.Sim.news(s, `🐣 ${babies.length} ${sp.name} ${babies.length > 1 ? 'babies' : 'baby'} born to ${mom.name}!${lost ? ` (${lost} lost)` : ''}`, 'good');
    // Maternal rejection
    if (U.rand(s) < sp.rejectRisk * (mom.bornHere ? 1 : 1.3) && big) {
      ZG.Events.queue(s, 'rejection', { aid: babies[0].id });
    }
  };

  // Care-load used for keeper requirements
  A.careLoad = function (s) {
    let c = ZG.zoo(s).supporting.care;
    for (const a of s.animals) c += ZG.SPECIES[a.sp].care * (A.isInfant(a) ? 0.6 : 1);
    return c;
  };
  A.avgWelfare = function (s) {
    if (!s.animals.length) return 70;
    let w = 0, n = 0;
    for (const a of s.animals) {
      const k = ZG.SPECIES[a.sp].appeal >= 3 ? 2 : 1;
      w += a.welfare * k;
      n += k;
    }
    return w / n;
  };
})((globalThis.ZG = globalThis.ZG || {}));
