// Special events you host at the zoo: adult nights, concerts, Boo at the Zoo, holiday
// lights, fun runs, free community days. You book a date; the weather, the hype and
// a bit of luck decide how it goes.
(function (ZG) {
  const U = ZG.U;
  const ZE = (ZG.ZooEvents = {});
  const $ = (n) => U.money(n);

  // turnout = share of an average day's attendance. fixed/perHead scale with the zoo's cost level.
  ZE.TYPES = {
    adult: { icon: '🍹', name: 'Sips & Safari (21+ night)', desc: 'Evening event with cocktails, beer, DJs and keeper chats. Adults only.', turnout: 0.7, cap: 0.9, max: 3000, ticket: 45, spend: 22, fixed: 22000, perHead: 11, lead: 21, cool: 30, alcohol: true, noise: 1, joins: 0.03 },
    brew: { icon: '🍺', name: 'Brew at the Zoo', desc: 'A craft-beer festival with local breweries and food trucks. 21+.', turnout: 1.1, cap: 1.3, max: 4500, ticket: 55, spend: 18, fixed: 45000, perHead: 13, lead: 45, cool: 120, alcohol: true, noise: 1.5, joins: 0.02 },
    concert: { icon: '🎸', name: 'Concert on the lawn', desc: 'A touring band on a temporary stage. Big money, loud, and neighbors will call.', turnout: 1.4, cap: 1.6, max: 5000, ticket: 60, spend: 20, fixed: 95000, perHead: 12, lead: 45, cool: 45, noise: 3, months: [4, 5, 6, 7, 8, 9], joins: 0.01 },
    boo: { icon: '🎃', name: 'Boo at the Zoo', desc: 'Trick-or-treat trails and costumes for families. October only.', turnout: 0.9, cap: 1.2, max: 9000, ticket: 16, spend: 12, fixed: 30000, perHead: 4, lead: 14, cool: 20, months: [9], family: true, joins: 0.04 },
    lights: { icon: '🎄', name: 'Zoo Lights holiday festival', desc: 'Six weeks of light displays every evening, late November to early January.', festival: true, fixed: 260000, lead: 30, cool: 300, months: [8, 9, 10], family: true },
    run: { icon: '🏃', name: 'Zoo 5K fun run', desc: 'A morning race through the grounds. Healthy, wholesome, sponsor-friendly.', turnout: 0.35, cap: 0.5, max: 2500, ticket: 40, spend: 6, fixed: 15000, perHead: 9, lead: 30, cool: 150, joins: 0.02 },
    science: { icon: '🔬', name: 'Family science night', desc: 'Keeper talks, vet demos and hands-on stations for kids. Helps education grants.', turnout: 0.45, cap: 0.6, max: 1500, ticket: 18, spend: 8, fixed: 9000, perHead: 5, lead: 14, cool: 45, family: true, joins: 0.03 },
    free: { icon: '🎟️', name: 'Free community day', desc: 'Free admission for everyone. You lose a day of ticket revenue and win a lot of goodwill.', free: true, fixed: 12000, lead: 14, cool: 90 },
  };

  ZE.init = (s) => (s.zooEvents = { booked: [], history: [], last: {} });
  ZE.scale = (s) => ZG.zoo(s).costMult;

  ZE.available = function (s, type) {
    const T = ZE.TYPES[type];
    const t = U.dateOf(s.day);
    if (T.months && !T.months.includes(t.m) && !(T.lead && T.months.includes(U.dateOf(s.day + T.lead).m))) return `Only bookable ${T.festival ? 'in September–November' : `for ${T.months.map((m) => U.MONTHS[m]).join(', ')}`}.`;
    const last = s.zooEvents.last[type];
    if (last != null && s.day - last < T.cool) return `Too soon: the last one was ${U.fmtDate(last)}.`;
    if (s.zooEvents.booked.some((e) => e.type === type)) return 'Already booked.';
    if (s.zooEvents.booked.length >= 3) return 'Your events team can handle three bookings at a time.';
    return null;
  };

  // Estimated numbers for the booking card (average weather, current hype).
  ZE.estimate = function (s, type, hype) {
    const T = ZE.TYPES[type], Z = ZG.zoo(s);
    const day = Z.baseAttendance / 365;
    if (T.festival) return { people: Math.round(Z.baseAttendance * 0.05), revenue: Math.round(Z.baseAttendance * 0.05 * (Z.refs.admission || 10) * 0.8), cost: Math.round(T.fixed * ZE.scale(s)) };
    if (T.free) {
      const lost = Math.round(day * (1 - 0.3) * (s.policy.admission || 0) * Z.yieldAdm);
      return { people: Math.round(day * 2.2), revenue: 0, cost: Math.round(T.fixed * ZE.scale(s)) + lost, lost };
    }
    const rep = U.clamp(s.rep / 70, 0.6, 1.3);
    const people = Math.round(Math.min(day * T.cap, T.max, day * T.turnout * rep * (hype || 1) * ZG.Econ.marketingFactor(s)));
    const price = T.ticket * Math.max(0.6, ZE.scale(s) * 0.9);
    return { people, revenue: Math.round(people * (price + T.spend)), cost: Math.round(T.fixed * ZE.scale(s) + people * T.perHead), price: Math.round(price) };
  };

  ZE.book = function (s, type, weeks) {
    const T = ZE.TYPES[type];
    if (!T) return { ok: false, msg: 'Unknown event.' };
    const why = ZE.available(s, type);
    if (why) return { ok: false, msg: why };
    let day = s.day + Math.max(T.lead, (+weeks || 4) * 7);
    if (T.festival) {
      const t = U.dateOf(s.day);
      day = U.dayOf(t.y, 10, 22);
      if (day - s.day < T.lead) return { ok: false, msg: 'Too late to build a lights festival this year.' };
    } else {
      while (![5, 6].includes(U.dateOf(day).dow)) day++; // Fridays & Saturdays
      if (T.months && !T.months.includes(U.dateOf(day).m)) return { ok: false, msg: `That date falls outside ${T.months.map((m) => U.MONTHS[m]).join('/')}.` };
    }
    const est = ZE.estimate(s, type, 1);
    const deposit = Math.round(T.fixed * ZE.scale(s) * 0.5);
    if (!ZG.Econ.canAfford(s, deposit)) return { ok: false, msg: `You can't cover the ${$(deposit)} deposit.` };
    ZG.Econ.spend(s, 'events', deposit);
    const e = { id: s.nextId++, type, day, hype: 1, deposit };
    s.zooEvents.booked.push(e);
    s.zooEvents.booked.sort((a, b) => a.day - b.day);
    const notes = [];
    if (T.alcohol && s.gov.type === 'city') notes.push('As a City facility you need a special liquor permit. Some councilmembers will have opinions.');
    if (T.noise >= 3 && s.zooId === 'honolulu') notes.push('The Waikīkī Shell is next door. The neighbors are used to concerts, but not on weeknights.');
    ZG.Sim.news(s, `${T.icon} Booked: ${T.name} on ${U.fmtDate(day)} (${$(deposit)} deposit).`, 'info');
    void est;
    return { ok: true, msg: `${T.name} booked for ${U.fmtDate(day)}. ${notes.join(' ')}`.trim() };
  };

  ZE.cancel = function (s, id) {
    const e = s.zooEvents.booked.find((x) => x.id === id);
    if (!e) return { ok: false, msg: 'Not found.' };
    s.zooEvents.booked.splice(s.zooEvents.booked.indexOf(e), 1);
    return { ok: true, msg: `Cancelled. The ${$(e.deposit)} deposit is lost.` };
  };

  ZE.daily = function (s) {
    const due = s.zooEvents.booked.filter((e) => e.day <= s.day);
    for (const e of due) {
      s.zooEvents.booked.splice(s.zooEvents.booked.indexOf(e), 1);
      ZE.run(s, e);
    }
  };

  ZE.run = function (s, e) {
    const T = ZE.TYPES[e.type], Z = ZG.zoo(s);
    s.zooEvents.last[e.type] = s.day;
    const scale = ZE.scale(s);
    const rest = Math.round(T.fixed * scale - e.deposit);
    ZG.Econ.spend(s, 'events', rest);
    const lines = [];
    let net = -T.fixed * scale;
    const w = s.today.weather;
    if (T.festival) {
      s.flags.lights = { until: s.day + 45, mult: 1.3 * (e.hype || 1) };
      ZG.Econ.spend(s, 'utilities', 40000 * scale);
      lines.push('The lights are up. Evening crowds will run through early January.');
      ZE.finish(s, e, lines, null, 0);
      return;
    }
    if (T.free) {
      s.flags.freeDay = s.day;
      s.flags.communityDay = s.day + 120;
      const est = ZE.estimate(s, 'free');
      s.rep = U.clamp(s.rep + 2, 0, 100);
      ZG.Officials.shiftAll(s, s.gov.type === 'federal' ? 'federal' : 'local', 3);
      s.members += Math.round(s.members * 0.004);
      lines.push(`About ${U.num(est.people)} people came, many for their first visit. Council offices and local papers noticed.`);
      ZE.finish(s, e, lines, -(T.fixed * scale + est.lost), est.people);
      return;
    }
    const est = ZE.estimate(s, e.type, e.hype || 1);
    let people = est.people;
    const wf = { sunny: 1.05, cloudy: 1, fog: 0.9, rain: 0.55, heat: 0.75, snow: 0.4, smoke: 0.3, storm: 0 }[w] ?? 1;
    if (w === 'storm') {
      lines.push('⛈️ A storm rolled in and you had to cancel. Most tickets were refunded; the vendors still got paid.');
      people = Math.round(people * 0.15);
    } else {
      people = Math.round(people * wf * U.rf(s, 0.88, 1.12));
      if (wf < 0.8) lines.push(`The ${w === 'rain' ? 'rain' : w} kept a lot of people home.`);
    }
    const revenue = Math.round(people * ((est.price || T.ticket) + T.spend));
    const varCost = Math.round(people * T.perHead);
    ZG.Econ.earn(s, 'events', revenue);
    ZG.Econ.spend(s, 'events', varCost);
    net += revenue - varCost;
    lines.push(`${U.num(people)} guests came. Tickets, food and drinks brought in ${$(revenue)}.`);
    if (e.hype > 1.1) lines.push('The media push paid off.');
    // Side effects
    if (T.noise) {
      s.flags.stress = { until: s.day + Math.ceil(T.noise * 2), amt: T.noise * 2.5 };
      if (T.noise >= 1.5) s.flags.noiseComplaints = s.day + 60;
      if (T.noise >= 3) lines.push('Keepers reported stressed animals near the stage, and neighbors filed noise complaints.');
    }
    if (T.alcohol && U.chance(s, 0.08)) {
      s.rep = U.clamp(s.rep - 2, 0, 100);
      ZG.Econ.spend(s, 'other', 15000);
      lines.push('🚑 An intoxicated guest climbed a barrier near the lion exhibit. Security got them out safely, but it made the evening news.');
    }
    if (T.alcohol && s.gov.type === 'city') for (const o of s.officials) if (o.trait === 'neighbors' || o.trait === 'welfare') o.off -= 1.5;
    if (T.family || e.type === 'science') s.rep = U.clamp(s.rep + 0.8, 0, 100);
    if (e.type === 'science') s.flags.eduBoost = s.day + 180;
    if (T.joins) {
      const n = Math.round(people * T.joins);
      s.members += n;
      if (n > 20) lines.push(`${U.num(n)} guests signed up for memberships.`);
    }
    ZE.finish(s, e, lines, net, people);
  };

  ZE.finish = function (s, e, lines, net, people) {
    const T = ZE.TYPES[e.type];
    s.zooEvents.history.unshift({ type: e.type, day: s.day, net, people });
    if (s.zooEvents.history.length > 30) s.zooEvents.history.pop();
    const html = `<p>${lines.join('</p><p>')}</p>${net != null ? `<p><b>Net result: <span class="${net >= 0 ? 'good' : 'bad'}">${$(net)}</span></b></p>` : ''}`;
    ZG.Events.queue(s, 'zoo_event_result', { icon: T.icon, title: T.name, html });
    ZG.Sim.news(s, `${T.icon} ${T.name}: ${people ? U.num(people) + ' guests, ' : ''}net ${net != null ? $(net) : 'n/a'}.`, net == null || net >= 0 ? 'good' : 'bad');
  };
})((globalThis.ZG = globalThis.ZG || {}));
