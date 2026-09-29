// Simulation orchestrator: new game, daily/monthly/yearly ticks, board confidence,
// objectives, news feed, save/load.
(function (ZG) {
  const U = ZG.U;
  const Sim = (ZG.Sim = {});

  ZG.fx = function (s, type, habId) {
    (s._fx = s._fx || []).push({ type, hab: habId, t: 0 });
  };

  Sim.news = function (s, text, kind) {
    s.news.unshift({ day: s.day, text, kind: kind || 'info' });
    if (s.news.length > 150) s.news.pop();
  };
  Sim.flag = (s, k, v) => (s.flags[k] = v);

  Sim.newGame = function (director, zooId, seed) {
    const Z = ZG.ZOOS[zooId];
    const s = {
      v: 1, zooId, seed, rng: seed >>> 0, day: 0, nextId: 1,
      director: Object.assign({}, director, { mods: ZG.buildDirectorMods(director) }),
      cash: Z.startCash, capital: Z.startCapital,
      policy: Object.assign({}, Z.policy),
      staff: {}, req: {}, pendingHires: [],
      plots: [], habitats: [], habitatsById: {}, animals: [], ped: {},
      infra: {},
      rep: Z.startRep, rep0: Z.startRep, aza: Z.startAza, board: Z.startBoard, morale: 70, satisfaction: 70,
      novelty: 0.05, economy: 1.0, economyTarget: 1.0,
      members: Z.members, joinRate: 0,
      ledger: { cur: ZG.Econ.newLedger(), months: [] },
      today: { guests: 0, paying: 0, weather: 'sunny', temp: Z.climate.hi[0], appeal: 0 },
      att: { ytd: 0, lastYear: Z.baseAttendance, avg30: Z.baseAttendance / 365, rolling: 0 },
      acc: { status: 'accredited', next: Math.round(Z.inspectionInMonths * 30.4), lastScore: null, warned: false, history: [] },
      ssp: { recs: [] }, market: [],
      eventQueue: [], log: [], news: [], cooldowns: {}, flags: {},
      closure: null, weatherOverride: null,
      objectives: Z.objectives.map((o) => ({ id: o.id, done: false, day: null })),
      stats: { births: 0, sspBirths: 0, deaths: 0, habitatsOpened: 0, budgetWins: 0, capitalWins: 0, inspectionsPassed: 0, giraffeBirths: 0, elephantBirths: 0, pandaCubs: 0, sponsorsSigned: 0, campaignsDone: 0, speciesAdded: 0, speciesSeen: [], surplusYears: 0, backlogStart: 0, maxMembers: Z.members, disastersWeathered: 0 },
      reviews: [],
    };
    s.board = U.clamp(s.board + ZG.mod(s, 'board'), 5, 95);
    s.aza = U.clamp(s.aza + ZG.mod(s, 'aza') * 0.5, 0, 100);
    s.morale = U.clamp(s.morale + ZG.mod(s, 'morale'), 0, 100);

    ZG.Habitats.genLayout(s);
    ZG.Infra.init(s);
    ZG.Politics.init(s);

    // Place exhibits: largest space needs get the largest plots; keep one big lot free.
    const habPlots = s.plots.filter((p) => p.kind === 'habitat').sort((a, b) => b.area - a.area);
    const reserved = habPlots.length > Z.exhibits.length ? habPlots.splice(2, 1) : [];
    const need = (ex) => ex.sp.reduce((sum, [id, m, f]) => sum + ZG.SPECIES[id].space * (m + f), 0);
    const exhibits = Z.exhibits.slice().sort((a, b) => need(b) - need(a));
    exhibits.forEach((ex, i) => {
      const plot = habPlots[i];
      if (!plot) return;
      const h = ZG.Habitats.create(s, plot, {
        name: ex.name, biome: ex.biome, climate: ex.climate || 'none', tier: 'standard',
        condition: ex.cond != null ? ex.cond : U.ri(s, Z.habCond[0], Z.habCond[1]),
        theming: ex.theming != null ? ex.theming : U.ri(s, 40, 75),
      });
      h.opened = -U.ri(s, 500, 9000);
      for (const [spId, m, f, ageR, names] of ex.sp) {
        const sp = ZG.SPECIES[spId];
        for (let k = 0; k < m + f; k++) {
          const yrs = ageR ? U.rf(s, ageR[0], ageR[1]) : U.rf(s, sp.mature, Math.max(sp.mature + 1, sp.life * 0.6));
          const extra = { hab: h.id, arrived: -U.ri(s, 100, 4000) };
          if (names && names[k]) Object.assign(extra, { name: names[k], star: true, lifeMult: yrs / sp.life > 0.8 ? 1.3 : 1 });
          const a = ZG.Animals.create(s, spId, k < m ? 'M' : 'F', yrs * 365, extra);
          if (ageR && !names && k === m) a.star = true;
        }
      }
    });
    void reserved;
    for (const h of s.habitats) h.features = ZG.Design.defaultsFor(s, h);
    // A beloved "star" animal in the most appealing habitat
    const cands = s.animals.filter((a) => ZG.SPECIES[a.sp].appeal >= 7 && !a.star);
    if (cands.length) U.pick(s, cands).star = true;

    ZG.Staff.init(s);
    ZG.Dev.init(s);
    Sim.initSystems(s);
    s.appeal0 = ZG.Habitats.totalAppeal(s);
    // Membership join rate calibrated so membership is roughly stable at the start
    const paying = (Z.baseAttendance - Math.min(0.6 * Z.baseAttendance, s.members * Z.memberVisits)) / 12;
    s.joinRate = ((s.members / 12) * 0.3) / Math.max(1, paying);
    s.stats.backlogStart = ZG.Infra.backlog(s);
    for (const a of s.animals) a.welfare = 70;
    ZG.Econ.weather(s, U.dateOf(0));
    for (let i = 0; i < 120; i++) ZG.Animals.updateWelfare(s);
    s.today.appeal = s.appeal0;
    s.satisfaction = ZG.Econ.satisfactionTarget(s, Z.baseAttendance / 365);
    s.anchor = { rep: Sim.repComposite(s), aza: ZG.AZA.composite(s), aza0: s.aza };
    ZG.AZA.generatePlan(s);
    ZG.AZA.refreshMarket(s);
    ZG.Dev.newSponsorOffer(s);
    s.news = [];
    Sim.news(s, `🏁 ${s.director.name} begins as Director of the ${Z.name}.`, 'info');
    ZG.Events.queue(s, 'intro', {});
    return s;
  };

  // Systems added after the first release; also used to upgrade older saves.
  Sim.initSystems = function (s) {
    if (!s.donors) ZG.Donors.init(s);
    if (!s.officials) ZG.Officials.init(s);
    if (!s.partner) ZG.Partner.init(s);
    if (!s.media) ZG.Media.init(s);
    if (!s.zooEvents) ZG.ZooEvents.init(s);
    if (!s.merch) ZG.Merch.init(s);
    ZG.Requests.init(s);
    ZG.Growth.init(s);
    ZG.Reserve.init(s);
    ZG.Field.init(s);
    // Older saves only counted SSP-recommended births; credit healthy SSP births already on the grounds.
    if (!s.stats.birthsV2) {
      s.stats.birthsV2 = true;
      const litters = new Set();
      let giraffes = 0;
      for (const a of s.animals) {
        if (!a.bornHere) continue;
        if (ZG.SPECIES[a.sp].program !== 'none' && !a.inbred) litters.add(a.dam + ':' + Math.round(a.age / 30));
        if (a.sp.includes('giraffe') && a.sp !== 'giraffe') giraffes++;
      }
      s.stats.sspBirths = Math.max(s.stats.sspBirths || 0, litters.size);
      s.stats.giraffeBirths = (s.stats.giraffeBirths || 0) + giraffes;
    }
  };

  Sim.reindex = function (s) {
    s.habitatsById = {};
    for (const h of s.habitats) s.habitatsById[h.id] = h;
  };

  Sim.tickDay = function (s) {
    s.day++;
    const t = U.dateOf(s.day);
    if (t.d === 1) Sim.monthStart(s, t);
    ZG.Econ.weather(s, t);
    ZG.ZooEvents.daily(s);
    ZG.Requests.daily(s);
    ZG.Growth.daily(s);
    ZG.Field.daily(s);
    if (s.closure) {
      s.closure.days--;
      if (s.closure.days <= 0) {
        Sim.news(s, `🔓 The zoo has reopened (${s.closure.reason}).`, 'good');
        s.closure = null;
      }
    }
    // Temporary flags
    const f = s.flags;
    if (f.foodUntil && s.day > f.foodUntil) { f.foodMult = 1; f.foodUntil = 0; }
    if (f.pandaArrive && s.day >= f.pandaArrive) Sim.pandasArrive(s);

    ZG.Staff.daily(s);
    ZG.Econ.daily(s, t);
    ZG.Growth.siteDaily(s, t);
    ZG.Animals.daily(s, t);
    ZG.Habitats.daily(s);
    ZG.Infra.daily(s, t);
    ZG.Politics.daily(s);
    ZG.Dev.daily(s);
    ZG.Events.daily(s, t);
    s.novelty = Math.max(0, s.novelty * 0.993);
    const dim = U.daysInMonth(t.y, t.m);
    if (t.d === dim) Sim.monthEnd(s, t);
  };

  Sim.pandasArrive = function (s) {
    const h = s.habitatsById[s.flags.pandaHab];
    if (!h || h.construction) {
      s.flags.pandaArrive = s.day + 30;
      return;
    }
    s.flags.pandaArrive = 0;
    ZG.Animals.create(s, 'giant_panda', 'M', 5 * 365, { hab: h.id, loc: 'quarantine', qDays: 30, gv: 'High' });
    ZG.Animals.create(s, 'giant_panda', 'F', 4.5 * 365, { hab: h.id, loc: 'quarantine', qDays: 30, gv: 'High' });
    s.novelty = Math.min(1, s.novelty + 0.4);
    s.rep = U.clamp(s.rep + 6, 0, 100);
    Sim.news(s, '🐼 THE PANDAS HAVE LANDED! A FedEx "Panda Express" jet delivered them to quarantine. The city is losing its mind.', 'good');
  };

  Sim.monthStart = function (s, t) {
    // Economy random walk (regional economic conditions)
    s.economyTarget += (1 - s.economyTarget) * 0.04;
    s.economy += (s.economyTarget - s.economy) * 0.2 + U.gauss(s) * 0.006;
    s.economy = U.clamp(s.economy, 0.8, 1.15);
    if (s.flags.pandaFee && s.animals.some((a) => a.sp === 'giant_panda')) ZG.Econ.spend(s, 'conservation', s.flags.pandaFee / 12);
    if (!s.flags.pandaFee && s.animals.some((a) => a.sp === 'giant_panda')) s.flags.pandaFee = 1000000;
    ZG.Econ.monthStart(s, t);
    ZG.Politics.monthly(s, t);
    ZG.Dev.monthly(s, t);
    ZG.Donors.monthly(s, t);
    ZG.Officials.monthly(s, t);
    ZG.Partner.monthly(s, t);
    ZG.Merch.monthly(s, t);
    ZG.Growth.monthly(s, t);
    ZG.Reserve.monthly(s, t);
    ZG.Field.monthly(s, t);
    ZG.AZA.monthly(s, t);
    ZG.AZA.refreshMarket(s);
    if (t.m === 1 && s.day > 60) ZG.AZA.generatePlan(s);
    // Reputation drifts toward what guests and the animal world see
    // Anchored to the zoo's real-world starting reputation; moves with performance.
    const target = s.rep0 + 0.7 * (Sim.repComposite(s) - s.anchor.rep);
    s.rep += (target - s.rep) * 0.1;
    s.rep = U.clamp(s.rep, 0, 100);
    Sim.checkObjectives(s);
  };

  Sim.repComposite = function (s) {
    const Z = ZG.zoo(s);
    const cons = U.clamp((100 * s.policy.conservation) / Math.max(1, Z.refs.conservation), 0, 110);
    return 0.4 * s.satisfaction + 0.3 * ZG.Animals.avgWelfare(s) + 0.2 * s.aza + 0.1 * cons;
  };

  Sim.boardTarget = function (s) {
    const Z = ZG.zoo(s);
    const months = s.ledger.months.slice(-6);
    const net = months.reduce((a, m) => a + m.net, 0);
    const budget = ZG.Econ.annualBudget(s) / 2;
    const margin = net / Math.max(1, budget);
    // Boards like reserves: operating cash plus the rainy-day fund, in months of expenses.
    const reserve = (s.cash + (s.reserve ? s.reserve.bal : 0)) / Math.max(1, ZG.Econ.annualBudget(s) / 12);
    let t = 55 + margin * 150 + U.clamp(reserve, -3, 4) * 3 + (s.rep - s.rep0) * 0.6 + (ZG.Animals.avgWelfare(s) - 70) * 0.4;
    if (s.acc.status === 'tabled') t -= 10;
    if (s.acc.status === 'lost') t -= 25;
    if (Z.governance === 'city' || Z.governance === 'federal') t += (s.gov.relationship - 50) * 0.3;
    return U.clamp(t, 0, 100);
  };

  Sim.monthEnd = function (s, t) {
    ZG.Econ.monthClose(s, t);
    s.board += (Sim.boardTarget(s) - s.board) * 0.08;
    s.board = U.clamp(s.board, 0, 100);
    if (!s.flags.sandbox) {
      if (s.board < 18 && !(s.cooldowns.board_warning > s.day)) {
        s.cooldowns.board_warning = s.day + 240;
        ZG.Events.queue(s, 'board_warning', {});
      }
      if (s.board <= 3) ZG.Events.queue(s, 'fired', {});
    }
    if (t.m === 11) Sim.yearEnd(s, t);
  };

  Sim.checkObjectives = function (s) {
    const Z = ZG.zoo(s);
    for (const o of s.objectives) {
      if (o.done) continue;
      const def = Z.objectives.find((x) => x.id === o.id);
      if (def && def.check(s)) {
        o.done = true;
        o.day = s.day;
        s.board = U.clamp(s.board + 5, 0, 100);
        ZG.Events.queue(s, 'objective', { text: def.text });
      }
    }
  };

  Sim.grade = function (score) {
    return score >= 90 ? 'A+' : score >= 82 ? 'A' : score >= 75 ? 'B+' : score >= 68 ? 'B' : score >= 60 ? 'C+' : score >= 52 ? 'C' : score >= 44 ? 'D' : 'F';
  };

  Sim.yearEnd = function (s, t) {
    const Z = ZG.zoo(s);
    const y = ZG.Econ.yearTotals(s, t.y);
    if (y.net > 0) s.stats.surplusYears++;
    const lastYearAtt = s.att.ytd;
    s.att.lastYear = Math.max(Z.baseAttendance * 0.3, s.att.ytd * (12 / Math.max(1, y.months)));
    s.att.ytd = 0;
    const welfare = ZG.Animals.avgWelfare(s);
    const fin = U.clamp(60 + (y.net / Math.max(1, y.expTotal)) * 300, 0, 100);
    const score = 0.25 * welfare + 0.2 * fin + 0.2 * s.rep + 0.15 * s.aza + 0.2 * s.board;
    const grade = Sim.grade(score);
    s.reviews.push({ year: t.y, score, grade, net: y.net, guests: lastYearAtt });
    const done = s.objectives.filter((o) => o.done).length;
    let html = `<p><b>Director's grade: <span class="grade">${grade}</span></b> (score ${Math.round(score)})</p>
      <table class="mini">
      <tr><td>Attendance</td><td>${U.num(lastYearAtt)}</td></tr>
      <tr><td>Operating revenue</td><td>${U.money(y.revTotal)}</td></tr>
      <tr><td>Operating expenses</td><td>${U.money(y.expTotal)}</td></tr>
      <tr><td>Operating result</td><td class="${y.net >= 0 ? 'good' : 'bad'}">${U.money(y.net)}</td></tr>
      <tr><td>Capital spending</td><td>${U.money(y.capex)}</td></tr>
      <tr><td>Animal welfare</td><td>${Math.round(welfare)}</td></tr>
      <tr><td>Reputation</td><td>${Math.round(s.rep)}</td></tr>
      <tr><td>AZA standing</td><td>${Math.round(s.aza)}</td></tr>
      <tr><td>Births / deaths</td><td>${s.stats.births} / ${s.stats.deaths} (career)</td></tr>
      <tr><td>Deferred maintenance</td><td>${U.money(ZG.Infra.backlog(s))}</td></tr>
      <tr><td>Goals achieved</td><td>${done} / ${s.objectives.length}</td></tr></table>`;
    const comments = [];
    if (y.net < 0) comments.push(`"We cannot keep running deficits like ${U.money(y.net)}."`);
    if (welfare > 78) comments.push('"The animals have never looked better."');
    if (welfare < 60) comments.push('"We are hearing troubling things about animal care."');
    if (s.rep > s.rep0 + 5) comments.push('"The public loves what you are doing."');
    if (ZG.Infra.backlog(s) > s.stats.backlogStart * 1.1) comments.push('"The maintenance backlog keeps growing. When does this get fixed?"');
    if (comments.length) html += `<p><em>From the ${Z.bossName}:</em> ${comments.join(' ')}</p>`;
    if (t.y === ZG.OBJ_DEADLINE) {
      html += `<h4>Five-year verdict</h4><p>You achieved <b>${done} of ${s.objectives.length}</b> goals. ${done >= 4 ? 'The board extends your contract with a raise — you are one of the most respected directors in the country.' : done >= 2 ? 'The board renews your contract with some reservations.' : 'The board is openly discussing your replacement.'}</p><p>The zoo continues — keep playing as long as you like.</p>`;
      s.board = U.clamp(s.board + (done - 2.5) * 6, 0, 100);
    }
    const ps = s.flags.promisedSpecies;
    if (ps) {
      if (s.animals.some((a) => a.sp === ps)) {
        s.flags.promisedSpecies = null;
        s.board = U.clamp(s.board + 4, 0, 100);
        Sim.news(s, `🎁 You kept your promise: ${ZG.SPECIES[ps].name}s are here. The donor is delighted.`, 'good');
      } else if (s.day - (s.flags.promisedDay || 0) > 1095) {
        s.flags.promisedSpecies = null;
        s.board = U.clamp(s.board - 8, 0, 100);
        s.rep = U.clamp(s.rep - 3, 0, 100);
        Sim.news(s, `😠 Three years on, there are still no ${ZG.SPECIES[ps].name}s. The donor went to the press about the broken promise.`, 'bad');
      }
    }
    ZG.Events.queue(s, 'year_review', { year: t.y, html });
    s.board = U.clamp(s.board + (score - 60) * 0.15, 0, 100);
  };

  // ---------- Save / load ----------
  Sim.serialize = function (s) {
    return JSON.stringify(s, (k, v) => (k === 'habitatsById' || k === '_fx' || k === '_hf' ? undefined : v));
  };
  Sim.deserialize = function (str) {
    const s = JSON.parse(str);
    for (const h of s.habitats) h.features = h.features || [];
    Sim.reindex(s);
    Sim.initSystems(s);
    s._fx = [];
    return s;
  };
})((globalThis.ZG = globalThis.ZG || {}));
