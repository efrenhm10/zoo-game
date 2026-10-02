// Weather, attendance, guest satisfaction, revenue, expenses, memberships and the ledger.
(function (ZG) {
  const U = ZG.U;
  const E = (ZG.Econ = {});

  E.REV = { admissions: 'Admissions', memberships: 'Memberships', concessions: 'Food & drink', retail: 'Gift shop & merch', parking: 'Parking', feeding: 'Animal encounters', government: 'Government funding', donations: 'Donations', grants: 'Grants', sponsorships: 'Sponsorships', events: 'Special events', other: 'Other' };
  E.EXP = { other: 'Other & irregular costs', salaries: 'Salaries & benefits', animalcare: 'Animal food & care', vetcare: 'Veterinary treatment', utilities: 'Utilities', maintenance: 'Routine maintenance', enrichment: 'Enrichment & supplies', marketing: 'Marketing', conservation: 'Field conservation', cogs: 'Cost of goods sold', overhead: 'Insurance & overhead', admin: 'Admin & recruiting', interest: 'Interest', emergency: 'Emergency repairs', transport: 'Animal transport', events: 'Event costs', capitalRepairs: 'Capital repairs', construction: 'Construction' };
  E.CAPEX = ['capitalRepairs', 'construction'];

  E.newLedger = () => ({ rev: {}, exp: {}, guests: 0, paying: 0 });

  E.earn = function (s, cat, amt, restricted) {
    if (!(amt > 0)) return;
    if (restricted) {
      // Restricted gifts/appropriations go to the capital fund, not operating revenue.
      s.capital += amt;
      s.ledger.cur.capIn = (s.ledger.cur.capIn || 0) + amt;
      return;
    }
    s.cash += amt;
    s.ledger.cur.rev[cat] = (s.ledger.cur.rev[cat] || 0) + amt;
  };
  E.spend = function (s, cat, amt) {
    if (!(amt > 0)) return;
    s.cash -= amt;
    s.ledger.cur.exp[cat] = (s.ledger.cur.exp[cat] || 0) + amt;
  };
  E.spendCapital = function (s, cat, amt) {
    const fromCap = Math.min(s.capital, amt);
    s.capital -= fromCap;
    s.cash -= amt - fromCap;
    s.ledger.cur.exp[cat] = (s.ledger.cur.exp[cat] || 0) + amt;
  };
  E.creditLimit = function (s) {
    return Math.max(1e6, E.annualBudget(s) * 0.12);
  };
  E.canAfford = function (s, amt, useCapital) {
    return s.cash + E.creditLimit(s) + (useCapital ? s.capital : 0) >= amt;
  };

  // Rough projected annual operating expenses (for display & credit line)
  E.annualBudget = function (s) {
    const Z = ZG.zoo(s);
    let animal = Z.supporting.cost;
    for (const a of s.animals) animal += ZG.SPECIES[a.sp].food;
    const p = s.policy;
    return ZG.Staff.annualCost(s) + animal * (s.flags.foodMult || 1) + Z.utilities + Z.overhead * (s.flags.insuranceMult || 1) * ZG.mod(s, 'finance') + p.maintenance + p.enrichment + p.marketing + p.conservation;
  };

  // Twelve-month budget projection from current settings. `pol` overrides policy values
  // (used while the player drags a slider) so spending and the bottom line react live.
  E.project = function (s, pol) {
    const Z = ZG.zoo(s);
    const cur = s.policy;
    const p = Object.assign({}, cur, pol || {});
    const mk = (m) => {
      const x = (m * ZG.mod(s, 'marketing')) / Math.max(1, Z.refs.marketing);
      return 0.85 + 0.075 * Math.log2(1 + 3 * x);
    };
    const pf = (a) => (Z.priceLocked || !Z.refs.admission ? 1 : Math.pow(Math.max(1, a) / Z.refs.admission, -0.4));
    const memberShare = U.clamp((s.members * Z.memberVisits) / Math.max(1, s.att.lastYear), 0, 0.6);
    const baseGuests = s.att.lastYear * U.clamp(s.rep / Math.max(1, s.rep0), 0.7, 1.3) ** 0.5;
    const guests = baseGuests * (mk(p.marketing) / mk(cur.marketing)) * (memberShare + (1 - memberShare) * (pf(p.admission) / pf(cur.admission)));
    const paying = guests * (1 - memberShare);
    const spendF = (0.75 + 0.35 * (s.satisfaction / 70)) * (0.8 + 0.2 * s.economy) * (0.7 + 0.3 * Math.min(1.1, ZG.Staff.ratio(s, 'guest')));
    const rev = {}, exp = {};
    if (!Z.priceLocked) rev.admissions = paying * p.admission * Z.yieldAdm;
    const foodRev = guests * Z.perCap * spendF * (1 - ZG.Merch.RETAIL_SHARE) * (s.flags.pouringBoost || 1);
    rev.concessions = foodRev;
    const mm = s.merch ? ZG.Merch.mult(s) : { rev: 1, cogs: 1 };
    let retail = guests * Z.perCap * spendF * ZG.Merch.RETAIL_SHARE * mm.rev;
    if (s.merch && s.merch.lines.online) retail += s.members * 0.05 * 12 * 38;
    rev.retail = retail;
    if (Z.parkingPerCap) {
      const pr = p.parkingFee / Math.max(1, Z.refs.parkingFee || 30);
      rev.parking = guests * Z.parkingPerCap * pr * Math.pow(pr, -0.25);
    }
    let decks = 0;
    for (const h of s.habitats) if (!h.construction && h.features && h.features.includes('feedingDeck')) decks++;
    rev.feeding = guests * spendF * ((Z.giraffeFeed && s.animals.some((a) => a.sp === 'giraffe')) ? Z.giraffeFeed : 0) + guests * 0.3 * Math.min(2, decks) * spendF;
    rev.memberships = s.members * p.memberPrice * (0.78 + 0.22 * Math.pow(Z.refs.memberPrice / Math.max(10, p.memberPrice), 0.9));
    const dev = 0.6 + 0.4 * Math.min(1.5, ZG.Staff.ratio(s, 'development'));
    let don = Z.donorBase * 0.55 * dev * U.clamp(s.rep / s.rep0, 0.5, 1.4) * Math.pow(s.economy, 1.5) * ZG.mod(s, 'fundraising');
    if (s.donors) for (const d of s.donors) don += d.annual * U.clamp(0.3 + d.rel / 100, 0.35, 1.3) * s.economy;
    if (s.partner) don += s.partner.annual * U.clamp(0.35 + s.partner.rel / 100, 0.4, 1.3);
    rev.donations = don;
    rev.government = s.gov.appropriation;
    rev.sponsorships = s.sponsors.reduce((a, x) => a + x.amount, 0);

    exp.salaries = ZG.Staff.annualCost(s);
    let food = Z.supporting.cost;
    for (const a of s.animals) food += ZG.SPECIES[a.sp].food * (a.age < 365 ? 0.4 : 1);
    exp.animalcare = food * (s.flags.foodMult || 1) * (1 - 0.04 * ZG.Infra.bonus(s, 'commissary'));
    let upkeep = 0;
    for (const h of s.habitats) if (!h.construction) upkeep += ZG.Design.upkeep(h);
    exp.utilities = Z.utilities * 1.08 * (1 - 0.04 * ZG.Infra.bonus(s, 'water') - 0.06 * ZG.Infra.bonus(s, 'power')) + Math.min(0, upkeep) + s.habitats.filter((h) => h.climate !== 'none' && !h.construction).length * 60000 * (Z.utilities > 4e6 ? 1.6 : 1);
    exp.maintenance = p.maintenance + Math.max(0, upkeep);
    exp.enrichment = p.enrichment;
    exp.marketing = p.marketing;
    exp.conservation = p.conservation + (s.animals.some((a) => a.sp === 'giant_panda') ? (s.flags.pandaFee || 1e6) : 0);
    exp.overhead = Z.overhead * (s.flags.insuranceMult || 1) * ZG.mod(s, 'finance') * (1 - 0.02 * ZG.Infra.bonus(s, 'admin'));
    exp.cogs = foodRev * Z.cogs + retail * Z.cogs * mm.cogs;
    if (s.cash < 0) exp.interest = -s.cash * 0.085;
    // Irregular costs (vet bills, emergencies, transport, events, admin): average of recent months.
    const recent = s.ledger.months.slice(-12);
    let irr = 0;
    for (const m of recent) for (const k of ['vetcare', 'emergency', 'transport', 'events', 'admin', 'other']) irr += m.exp[k] || 0;
    exp.other = recent.length ? (irr / recent.length) * 12 : ZG.Econ.annualBudget(s) * 0.02;
    const revTotal = Object.values(rev).reduce((a, b) => a + b, 0);
    const expTotal = Object.values(exp).reduce((a, b) => a + b, 0);
    return { rev, exp, revTotal, expTotal, net: revTotal - expTotal, guests };
  };

  // ---------- Weather ----------
  E.weather = function (s, t) {
    const Z = ZG.zoo(s);
    let temp = Z.climate.hi[t.m] + U.gauss(s) * 6;
    let w = 'sunny';
    if (U.rand(s) < Z.climate.rain[t.m]) w = temp < 35 ? 'snow' : U.rand(s) < 0.15 ? 'storm' : 'rain';
    else if (U.rand(s) < 0.3) w = 'cloudy';
    if (s.weatherOverride && s.weatherOverride.days > 0) {
      w = s.weatherOverride.type;
      if (s.weatherOverride.temp != null) temp = s.weatherOverride.temp + U.gauss(s) * 3;
      s.weatherOverride.days--;
    }
    if (temp >= 96 && (w === 'sunny' || w === 'cloudy')) w = 'heat';
    s.today.weather = w;
    s.today.temp = Math.round(temp);
  };

  const DOW = [1.45, 0.75, 0.7, 0.75, 0.8, 1.0, 1.55];
  const WEATHER_F = { sunny: 1.08, cloudy: 1.0, rain: 0.45, storm: 0.15, snow: 0.3, heat: 0.68, smoke: 0.3, fog: 0.85 };

  E.marketingFactor = function (s) {
    const Z = ZG.zoo(s);
    const m = (s.policy.marketing * ZG.mod(s, 'marketing')) / Math.max(1, Z.refs.marketing);
    return 0.85 + 0.075 * Math.log2(1 + 3 * m);
  };
  E.priceFactor = function (s) {
    const Z = ZG.zoo(s);
    if (Z.priceLocked || !Z.refs.admission) return 1;
    return Math.pow(Math.max(1, s.policy.admission) / Z.refs.admission, -0.4);
  };

  E.dailyAttendance = function (s, t) {
    const Z = ZG.zoo(s);
    if (s.closure) return 0;
    const seasonAvg = Z.season.reduce((a, b) => a + b, 0) / 12;
    let g = (Z.baseAttendance / 365) * (Z.season[t.m] / seasonAvg) * DOW[t.dow];
    // Normalize so a typical-weather day for this month averages out to the base.
    const rp = Z.climate.rain[t.m];
    const wexp = rp * (0.85 * WEATHER_F.rain + 0.15 * WEATHER_F.storm) + (1 - rp) * (0.7 * WEATHER_F.sunny + 0.3 * WEATHER_F.cloudy);
    g *= (WEATHER_F[s.today.weather] || 1) / wexp;
    const appeal = ZG.Habitats.totalAppeal(s);
    s.today.appeal = appeal;
    g *= Math.pow(appeal / s.appeal0, 0.6);
    g *= 1 + 0.5 * Math.min(1, s.novelty);
    g *= (0.7 + 0.6 * s.rep / 100) / (0.7 + 0.6 * s.rep0 / 100);
    g *= E.marketingFactor(s);
    g *= 0.8 + 0.2 * (s.satisfaction / 70);
    g *= 0.85 + 0.15 * s.economy;
    const memberShare = U.clamp((s.members * Z.memberVisits) / Math.max(1, s.att.lastYear), 0, 0.6);
    // price only affects non-member guests
    g = g * memberShare + g * (1 - memberShare) * E.priceFactor(s);
    if (s.flags.attendanceMult && s.flags.attendanceMultUntil > s.day) g *= s.flags.attendanceMult;
    if (s.flags.lights && s.flags.lights.until > s.day && (t.m >= 10 || t.m <= 0)) g *= s.flags.lights.mult;
    if (s.gov.shortHours && s.gov.shortHoursUntil > s.day) g *= 0.86;
    g *= U.rf(s, 0.9, 1.1);
    return Math.max(0, Math.round(g));
  };

  E.satisfactionTarget = function (s, guests) {
    const Z = ZG.zoo(s);
    let wsum = 0, csum = 0;
    for (const h of s.habitats) {
      if (h.construction) continue;
      const ap = Math.max(1, ZG.Habitats.appeal(s, h));
      wsum += ap;
      csum += ap * (h.renovation ? 55 : 0.7 * h.condition + 0.3 * h.theming);
    }
    const exhibits = wsum ? csum / wsum : 60;
    const amenities = s.infra.visitor.cond;
    const service = (100 * Math.min(1.1, ZG.Staff.ratio(s, 'guest'))) / 1.1;
    let value = 90;
    if (!Z.priceLocked && Z.refs.admission) {
      value = U.clamp(72 + ((Z.refs.admission - s.policy.admission) / Z.refs.admission) * 70 + (Math.pow(s.today.appeal / s.appeal0, 0.6) - 1) * 60, 0, 100);
    }
    const cap = (Z.baseAttendance / 365) * 2.4;
    const crowd = guests > cap ? Math.min(40, ((guests - cap) / cap) * 60) : 0;
    const wadj = { rain: -8, storm: -18, heat: -12, snow: -6, smoke: -15 }[s.today.weather] || 0;
    const welfare = ZG.Animals.avgWelfare(s);
    const shop = (s.merch ? ZG.Merch.PRICES[s.merch.price].sat : 0) + 2.5 * ZG.Infra.bonus(s, 'visitor');
    return U.clamp(0.25 * exhibits + 0.15 * amenities + 0.15 * service + 0.15 * value + 0.15 * welfare + 0.15 * (100 - crowd) + wadj + shop + ZG.mod(s, 'guest'), 0, 100);
  };

  E.daily = function (s, t) {
    const Z = ZG.zoo(s);
    let guests = E.dailyAttendance(s, t);
    if (s.flags.freeDay === s.day) guests = Math.round(guests * 2.2);
    const memberShare = U.clamp((s.members * Z.memberVisits) / Math.max(1, s.att.lastYear), 0, 0.6);
    const paying = Math.round(guests * (1 - memberShare));
    s.today.guests = guests;
    s.today.paying = paying;
    s.att.ytd += guests;
    s.att.rolling = (s.att.rolling || 0) + guests;
    s.att.avg30 += (guests - s.att.avg30) / 30;
    s.ledger.cur.guests += guests;
    s.ledger.cur.paying += paying;

    const satT = E.satisfactionTarget(s, guests);
    s.satisfaction += (satT - s.satisfaction) * 0.04;

    // Revenue
    const freeDay = s.flags.freeDay === s.day;
    if (!Z.priceLocked && !freeDay) E.earn(s, 'admissions', paying * s.policy.admission * Z.yieldAdm);
    const spendF = (0.75 + 0.35 * (s.satisfaction / 70)) * (0.8 + 0.2 * s.economy) * (0.7 + 0.3 * Math.min(1.1, ZG.Staff.ratio(s, 'guest')));
    const base = guests * Z.perCap * spendF;
    const foodRev = base * (1 - ZG.Merch.RETAIL_SHARE) * (s.flags.pouringBoost || 1);
    E.earn(s, 'concessions', foodRev);
    E.spend(s, 'cogs', foodRev * Z.cogs);
    ZG.Merch.daily(s, base * ZG.Merch.RETAIL_SHARE, Z.cogs);
    if (Z.parkingPerCap) {
      const pf = s.policy.parkingFee / Math.max(1, Z.refs.parkingFee || 30);
      E.earn(s, 'parking', guests * Z.parkingPerCap * pf * Math.pow(pf, -0.25));
    }
    if (Z.giraffeFeed && s.animals.some((a) => a.sp === 'giraffe' && a.loc === 'hab')) E.earn(s, 'feeding', guests * Z.giraffeFeed * spendF);

    // Expenses
    E.spend(s, 'salaries', ZG.Staff.annualCost(s) / 365);
    let food = Z.supporting.cost;
    for (const a of s.animals) food += ZG.SPECIES[a.sp].food * (a.age < 365 ? 0.4 : 1);
    E.spend(s, 'animalcare', (food * (s.flags.foodMult || 1) * (1 - 0.04 * ZG.Infra.bonus(s, 'commissary'))) / 365);
    let util = (Z.utilities / 365) * (1 + Math.abs(s.today.temp - 68) * 0.006) * (1 - 0.04 * ZG.Infra.bonus(s, 'water') - 0.06 * ZG.Infra.bonus(s, 'power'));
    for (const h of s.habitats) {
      if (h.climate === 'none' || h.construction) continue;
      let need = 0;
      for (const a of ZG.Animals.inHab(s, h.id)) {
        const sp = ZG.SPECIES[a.sp];
        if (h.climate === 'heated') need = Math.max(need, sp.climate[0] + 15 - s.today.temp);
        else need = Math.max(need, s.today.temp - (sp.climate[1] - 15));
      }
      util += (120 + Math.max(0, need) * 22) * (h.area / 5000) * (Z.utilities > 4e6 ? 1.6 : 1);
    }
    // Designed-feature upkeep (pumps, misters, planting) and encounter decks
    let upkeep = 0, decks = 0;
    for (const h of s.habitats) {
      if (h.construction || !h.features) continue;
      upkeep += ZG.Design.upkeep(h);
      if (h.features.includes('feedingDeck') && !h.renovation && s.animals.some((a) => a.hab === h.id && a.loc === 'hab')) decks++;
    }
    if (upkeep) upkeep > 0 ? E.spend(s, 'maintenance', upkeep / 365) : (util += upkeep / 365);
    if (decks) E.earn(s, 'feeding', guests * 0.3 * Math.min(2, decks) * spendF);
    E.spend(s, 'utilities', util);
    const p = s.policy;
    E.spend(s, 'maintenance', p.maintenance / 365);
    E.spend(s, 'enrichment', p.enrichment / 365);
    E.spend(s, 'marketing', p.marketing / 365);
    E.spend(s, 'conservation', p.conservation / 365);
    E.spend(s, 'overhead', (Z.overhead * (s.flags.insuranceMult || 1) * ZG.mod(s, 'finance') * (1 - 0.02 * ZG.Infra.bonus(s, 'admin'))) / 365);
    if (s.cash < 0) {
      E.spend(s, 'interest', (-s.cash * 0.085) / 365);
      s.stats.everBorrowed = true;
    }
  };

  // Monthly: memberships & annual-fund giving
  E.monthStart = function (s, t) {
    const Z = ZG.zoo(s);
    const last = s.ledger.months[s.ledger.months.length - 1];
    const payingMonth = last ? last.paying : (Z.baseAttendance / 12) * 0.8;
    const renewal = U.clamp(0.7 + (s.satisfaction - 70) / 250 + (s.rep - s.rep0) / 300, 0.45, 0.88);
    const lapsed = (s.members / 12) * (1 - renewal);
    const priceF = Math.pow(Z.refs.memberPrice / Math.max(10, s.policy.memberPrice), 0.9);
    const joins = payingMonth * s.joinRate * Math.pow(U.clamp(s.satisfaction / 70, 0.3, 1.4), 1.5) * priceF * E.marketingFactor(s);
    const revenue = (joins + (s.members / 12) * renewal) * s.policy.memberPrice;
    s.members = Math.max(0, Math.round(s.members + joins - lapsed));
    E.earn(s, 'memberships', revenue);
    s.stats.maxMembers = Math.max(s.stats.maxMembers || 0, s.members);

    const dev = 0.6 + 0.4 * Math.min(1.5, ZG.Staff.ratio(s, 'development'));
    const decMult = t.m === 11 ? 2.5 : (12 - 2.5) / 11;
    // 30% of giving comes through the top-donor roster and 15% through the partner organization.
    const gifts = (Z.donorBase * 0.55 / 12) * dev * U.clamp(s.rep / s.rep0, 0.5, 1.4) * Math.pow(s.economy, 1.5) * ZG.mod(s, 'fundraising') * decMult * U.rf(s, 0.85, 1.15);
    E.earn(s, 'donations', gifts);
  };

  E.monthClose = function (s, t) {
    const L = s.ledger.cur;
    let rev = 0, exp = 0, capex = 0;
    for (const k in L.rev) rev += L.rev[k];
    for (const k in L.exp) {
      if (E.CAPEX.includes(k)) capex += L.exp[k];
      else exp += L.exp[k];
    }
    s.ledger.months.push({ y: t.y, m: t.m, rev: L.rev, exp: L.exp, revTotal: rev, expTotal: exp, capex, capIn: L.capIn || 0, net: rev - exp, cash: s.cash, capital: s.capital, guests: L.guests, paying: L.paying, members: s.members, rep: s.rep, welfare: ZG.Animals.avgWelfare(s), sat: s.satisfaction, aza: s.aza, board: s.board, backlog: ZG.Infra.backlog(s) });
    if (s.ledger.months.length > 72) s.ledger.months.shift();
    s.ledger.cur = E.newLedger();
  };

  E.yearTotals = function (s, y) {
    const ms = s.ledger.months.filter((m) => m.y === y);
    const out = { rev: {}, exp: {}, revTotal: 0, expTotal: 0, capex: 0, guests: 0, months: ms.length };
    for (const m of ms) {
      for (const k in m.rev) out.rev[k] = (out.rev[k] || 0) + m.rev[k];
      for (const k in m.exp) out.exp[k] = (out.exp[k] || 0) + m.exp[k];
      out.revTotal += m.revTotal;
      out.expTotal += m.expTotal;
      out.capex += m.capex;
      out.capIn = (out.capIn || 0) + (m.capIn || 0);
      out.guests += m.guests;
    }
    out.net = out.revTotal - out.expTotal;
    return out;
  };
})((globalThis.ZG = globalThis.ZG || {}));
