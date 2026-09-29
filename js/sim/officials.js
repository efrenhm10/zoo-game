// The people who decide your public money: mayor & council, the state legislature
// & governor, Congress, and your board. Each has a name, a personal stance toward
// you and priorities you can speak to. Meeting them is free; it just takes a visit.
(function (ZG) {
  const U = ZG.U;
  const O = (ZG.Officials = {});
  const $ = (n) => U.money(n);

  const FIRST = ['Maria', 'James', 'Linda', 'Robert', 'Patricia', 'Michael', 'Angela', 'David', 'Keisha', 'Daniel', 'Susan', 'Anthony', 'Rachel', 'Kevin', 'Laura', 'Brian', 'Monica', 'Eric', 'Denise', 'Gregory', 'Teresa', 'Paul', 'Yolanda', 'Scott', 'Andrea', 'Victor', 'Helen', 'Raymond', 'Christine', 'Luis'];
  const LAST = ['Garcia', 'Johnson', 'Nguyen', 'Martinez', 'Thompson', 'Robinson', 'Lopez', 'Walker', 'Hernandez', 'Young', 'King', 'Wright', 'Scott', 'Torres', 'Hill', 'Flores', 'Green', 'Adams', 'Baker', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Phillips', 'Evans', 'Turner', 'Parker', 'Collins', 'Edwards', 'Stewart'];
  const HI_FIRST = ['Keola', 'Leilani', 'Kaleo', 'Malia', 'Kainoa', 'Noelani', 'Brandon', 'Lynn', 'Dean', 'Joy', 'Kyle', 'Carol', 'Glenn', 'Tamara', 'Wendell', 'Esther', 'Calvin', 'Pualani', 'Ikaika', 'Randall'];
  const HI_LAST = ['Kahananui', 'Nakamoto', 'Fujimoto', 'Kealoha', 'Yamashiro', 'Pang', 'Ching', 'Kaʻapana', 'Higa', 'Souza', 'Medeiros', 'Kaneshiro', 'Oshiro', 'Makuakāne', 'Ramos'];

  // Priorities an official cares about, and how they read your record.
  O.TRAITS = {
    hawk: { name: 'Fiscal hawk', wants: 'balanced budgets and no surprises', read: (s) => (O.recentNet(s) >= 0 ? 4 : -2) },
    parks: { name: 'Parks champion', wants: 'parks, open space and family attractions', read: () => 5 },
    welfare: { name: 'Animal-welfare advocate', wants: 'animals that are visibly thriving', read: (s) => (ZG.Animals.avgWelfare(s) >= 72 ? 5 : ZG.Animals.avgWelfare(s) < 60 ? -4 : 1) },
    tourism: { name: 'Tourism booster', wants: 'visitors, jobs and hotel-tax dollars', read: (s) => (s.att.avg30 * 365 >= ZG.zoo(s).baseAttendance ? 5 : 0) },
    neighbors: { name: 'Neighborhood advocate', wants: 'less traffic, noise and parking spillover', read: (s) => (s.flags.noiseComplaints > s.day ? -4 : 2) },
    labor: { name: 'Labor ally', wants: 'good jobs and respect for the union', read: (s) => (s.morale >= 60 && !(s.flags.laidOff > s.day) ? 4 : -3) },
    equity: { name: 'Access & equity advocate', wants: 'free days and programs for low-income families', read: (s) => (s.flags.communityDay > s.day ? 6 : 0) },
    pragmatist: { name: 'Pragmatist', wants: 'a well-run operation that stays out of the news', read: (s) => (s.rep >= s.rep0 ? 3 : 0) },
    science: { name: 'Science & education backer', wants: 'research, conservation and school programs', read: (s) => (s.policy.conservation >= ZG.zoo(s).refs.conservation ? 4 : 1) },
  };

  // Which number a group moves: the city/Congress relationship, the state relationship, or your board's confidence.
  const AGG = { local: 'relationship', federal: 'relationship', state: 'stateRel', board: 'board' };
  O.agg = (s, group) => (AGG[group] === 'board' ? s.board : s.gov[AGG[group]]);
  O.setAgg = (s, group, v) => {
    v = U.clamp(v, 0, 100);
    if (AGG[group] === 'board') s.board = v;
    else s.gov[AGG[group]] = v;
  };

  // ---- rosters -------------------------------------------------------------
  const R = (group, role, weight, trait, extra) => Object.assign({ group, role, weight, trait }, extra || {});
  O.ROSTERS = {
    honolulu: {
      names: 'hi',
      groups: { local: 'Mayor & Honolulu City Council', state: 'Hawaiʻi State Legislature & Governor' },
      people: [
        R('local', 'Mayor of Honolulu', 3, 'pragmatist', { exec: true }),
        R('local', 'Council Chair', 1.4, 'hawk'),
        R('local', 'Budget Committee Chair', 1.6, 'hawk'),
        R('local', 'Parks, Enterprise Services & Culture Chair', 1.3, 'parks'),
        R('local', 'Councilmember, District 4 (Waikīkī–Diamond Head)', 1.3, 'neighbors'),
        R('local', 'Councilmember, District 1 (Leeward)', 1, 'labor'),
        R('local', 'Councilmember, District 3 (Windward)', 1, 'welfare'),
        R('local', 'Councilmember, District 6 (Downtown–Kalihi)', 1, 'equity'),
        R('local', 'Councilmember, District 7 (Airport–Salt Lake)', 1, 'tourism'),
        R('local', 'Councilmember, District 9 (Waipahu–ʻEwa)', 1, 'pragmatist'),
        R('state', 'Governor of Hawaiʻi', 3, 'tourism', { exec: true }),
        R('state', 'Senate Ways & Means Chair', 1.8, 'hawk'),
        R('state', 'House Finance Chair', 1.8, 'hawk'),
        R('state', 'Speaker of the House', 1.4, 'pragmatist'),
        R('state', 'State Senator (Waikīkī–Kapahulu)', 1.2, 'parks'),
        R('state', 'State Representative (Waikīkī)', 1.1, 'neighbors'),
      ],
    },
    houston: {
      names: 'us',
      groups: { local: 'Mayor & Houston City Council', board: 'Houston Zoo Board of Directors', state: 'Texas Legislature & Governor' },
      people: [
        R('local', 'Mayor of Houston', 3, 'hawk', { exec: true }),
        R('local', 'City Controller', 1.3, 'hawk'),
        R('local', 'Councilmember, District D (Hermann Park)', 1.4, 'equity'),
        R('local', 'Budget & Fiscal Affairs Committee Chair', 1.5, 'hawk'),
        R('local', 'Quality of Life Committee Chair', 1.2, 'parks'),
        R('local', 'Councilmember, At-Large 1', 1, 'tourism'),
        R('local', 'Councilmember, At-Large 3', 1, 'labor'),
        R('local', 'Councilmember, District C', 1, 'neighbors'),
        R('board', 'Board Chair', 2.5, 'pragmatist'),
        R('board', 'Treasurer & Finance Committee Chair', 1.5, 'hawk'),
        R('board', 'Trustee (energy executive)', 1, 'tourism'),
        R('board', 'Trustee (Texas Medical Center physician)', 1, 'science'),
        R('state', 'Governor of Texas', 2.2, 'hawk', { exec: true }),
        R('state', 'Lieutenant Governor (presides over the Senate)', 2.4, 'hawk'),
        R('state', 'Speaker of the House', 1.6, 'pragmatist'),
        R('state', 'Senate Finance Committee Chair', 1.8, 'hawk'),
        R('state', 'House Appropriations Chair', 1.8, 'pragmatist'),
        R('state', 'State Senator (Museum District)', 1.1, 'science'),
        R('state', 'State Representative (Hermann Park area)', 1, 'equity'),
      ],
    },
    sandiego: {
      names: 'us',
      groups: { local: 'Mayor & San Diego City Council', board: 'Board of Trustees', state: 'California Legislature & Governor' },
      people: [
        R('local', 'Mayor of San Diego', 3, 'pragmatist', { exec: true }),
        R('local', 'Council President', 1.4, 'pragmatist'),
        R('local', 'Councilmember, District 3 (Balboa Park)', 1.5, 'neighbors'),
        R('local', 'Budget & Government Efficiency Chair', 1.5, 'hawk'),
        R('local', 'Councilmember, District 8 (South Bay)', 1, 'equity'),
        R('local', 'Councilmember, District 2 (Coastal)', 1, 'tourism'),
        R('local', 'Councilmember, District 9 (Mid-City)', 1, 'labor'),
        R('board', 'Board Chair', 2.5, 'pragmatist'),
        R('board', 'Treasurer', 1.5, 'hawk'),
        R('board', 'Trustee (biotech founder)', 1, 'science'),
        R('board', 'Trustee (philanthropist)', 1, 'welfare'),
        R('state', 'Governor of California', 2.5, 'science', { exec: true }),
        R('state', 'Senate Budget & Fiscal Review Chair', 1.8, 'hawk'),
        R('state', 'Assembly Budget Committee Chair', 1.8, 'pragmatist'),
        R('state', 'Speaker of the Assembly', 1.5, 'labor'),
        R('state', 'State Senator (San Diego)', 1.2, 'tourism'),
        R('state', 'Assemblymember (Balboa Park)', 1.1, 'parks'),
      ],
    },
    national: {
      names: 'us',
      groups: { federal: 'Congress (Interior–Environment appropriations)', board: 'Smithsonian leadership' },
      noState: 'Washington, D.C. is not a state. Your public money comes from Congress.',
      people: [
        R('federal', 'House Interior–Environment Appropriations Subcommittee Chair', 2.5, 'hawk'),
        R('federal', 'House Subcommittee Ranking Member', 1.6, 'science'),
        R('federal', 'Senate Interior–Environment Appropriations Subcommittee Chair', 2.5, 'pragmatist'),
        R('federal', 'Senate Subcommittee Ranking Member', 1.6, 'parks'),
        R('federal', 'Delegate for the District of Columbia', 1, 'equity'),
        R('federal', 'Congressional Regent of the Smithsonian', 1.4, 'science'),
        R('board', 'Secretary of the Smithsonian', 3, 'science', { exec: true }),
        R('board', 'Chair, Board of Regents', 2, 'pragmatist'),
        R('board', 'Under Secretary for Science & Research', 1.3, 'science'),
        R('board', 'Chair, Friends of the National Zoo (FONZ)', 1.2, 'welfare'),
      ],
    },
    cheyenne: {
      names: 'us',
      groups: { board: 'Board of Trustees', state: 'Colorado General Assembly & Governor' },
      people: [
        R('board', 'Board Chair', 3, 'pragmatist'),
        R('board', 'Vice Chair', 1.5, 'welfare'),
        R('board', 'Treasurer', 1.5, 'hawk'),
        R('board', 'Trustee (Broadmoor hospitality executive)', 1, 'tourism'),
        R('board', 'Trustee (Air Force Academy retiree)', 1, 'pragmatist'),
        R('board', 'Trustee (Colorado College professor)', 1, 'science'),
        R('state', 'Governor of Colorado', 2.5, 'parks', { exec: true }),
        R('state', 'Joint Budget Committee Chair', 2.4, 'hawk'),
        R('state', 'Senate President', 1.4, 'pragmatist'),
        R('state', 'Speaker of the House', 1.4, 'labor'),
        R('state', 'State Senator (Colorado Springs)', 1.2, 'hawk'),
        R('state', 'State Representative (Broadmoor area)', 1.1, 'tourism'),
      ],
    },
  };

  // State legislative calendars. m = month index (0 = January).
  O.STATE = {
    honolulu: { name: 'Hawaiʻi', program: 'Grant-in-Aid / capital improvement request', open: [0, 1, 2], decide: 4, sign: 6, note: 'The Legislature meets January–May. The Governor has until July to sign or line-item veto.', scale: 1 },
    houston: { name: 'Texas', program: 'budget rider / capital appropriation', open: [0, 1, 2], decide: 4, sign: 5, odd: true, note: 'Texas meets only in odd-numbered years (January–May). The Governor can line-item veto in June.', scale: 1.4 },
    sandiego: { name: 'California', program: 'member budget request (earmark)', open: [0, 1, 2, 3], decide: 5, sign: 5, note: 'The budget must pass by June 15, and the Governor signs by July 1.', scale: 1.6 },
    cheyenne: { name: 'Colorado', program: 'capital construction request', open: [0, 1], decide: 3, sign: 4, note: 'The Joint Budget Committee writes the “Long Bill” in the spring. The Governor signs in May.', scale: 0.8 },
  };

  O.recentNet = (s) => s.ledger.months.slice(-6).reduce((a, m) => a + m.net, 0);

  function personName(s, pool) {
    if (pool === 'hi') return `${U.pick(s, HI_FIRST)} ${U.pick(s, HI_LAST)}`;
    return `${U.pick(s, FIRST)} ${U.pick(s, LAST)}`;
  }

  O.init = function (s) {
    const ros = O.ROSTERS[s.zooId];
    s.gov.stateRel = s.gov.stateRel != null ? s.gov.stateRel : 45;
    s.gov.stateReq = null;
    const used = new Set();
    const uniqueName = () => {
      let n, tries = 0;
      do n = personName(s, ros.names);
      while ((used.has(n) || (tries < 40 && used.has(n.split(' ')[0]))) && tries++ < 200);
      used.add(n);
      used.add(n.split(' ')[0]);
      return n;
    };
    s.officials = ros.people.map((p) => {
      const off0 = U.ri(s, -14, 14) + (p.trait === 'parks' || p.trait === 'science' ? 6 : p.trait === 'hawk' ? -6 : 0);
      return Object.assign({ id: s.nextId++, name: uniqueName(), off: off0, off0, lastMet: -9999, committed: null, lastAsk: -9999 }, p);
    });
  };

  O.list = (s, group) => s.officials.filter((o) => o.group === group);
  O.stance = (s, o) => U.clamp(O.agg(s, o.group) + o.off, 0, 100);
  O.lean = (v) => (v >= 65 ? 'Ally' : v >= 50 ? 'Friendly' : v >= 38 ? 'Undecided' : 'Skeptical');
  O.weightOf = (s, group) => O.list(s, group).reduce((a, o) => a + o.weight, 0);
  O.GAP = 30;

  // Raise one official's stance by d; allies with clout pull the whole body along a little.
  function shift(s, o, d) {
    const W = O.weightOf(s, o.group);
    const share = o.weight / Math.max(1, W);
    o.off += d * (1 - share);
    O.setAgg(s, o.group, O.agg(s, o.group) + d * share);
  }

  // What's on the table right now that an official could back.
  O.pendingItem = function (s, group) {
    const g = s.gov;
    if (group === 'state' && g.stateReq && !g.stateReq.passed) return { key: 'state', text: `your ${$(g.stateReq.amount)} state request` };
    if (group === 'local' || group === 'federal') {
      if (g.request) return { key: 'budget', text: `your ${$(g.request.ask)} budget request` };
      if (g.feeProposal) return { key: 'fee', text: `the $${g.feeProposal.price} admission ordinance` };
      if (g.type === 'contract' && U.dateOf(s.day).y >= g.contractYear - 1) return { key: 'contract', text: 'renewing the management agreement' };
    }
    if (s.plan && s.plan.status === 'review' && ZG.Growth.voteGroup(s) === group) return { key: 'plan', text: 'adopting your strategic master plan' };
    if (group === 'board' && s.dev.campaign) return { key: 'campaign', text: `the “${s.dev.campaign.label}” campaign` };
    return null;
  };

  O.meet = function (s, id, kind) {
    const o = s.officials.find((x) => x.id === id);
    if (!o) return { ok: false, msg: 'Not found.' };
    if (s.day - o.lastMet < O.GAP) return { ok: false, msg: `You met with ${o.name} recently. Their scheduler says try after ${U.fmtDate(o.lastMet + O.GAP)}.` };
    o.lastMet = s.day;
    const T = O.TRAITS[o.trait];
    let d = kind === 'tour' ? 5 : 3;
    if (kind === 'tour') ZG.Econ.spend(s, 'events', 400);
    const read = T.read(s);
    d += read;
    d *= 1 + ZG.mod(s, 'politics') / 40;
    d = Math.round(d * U.rf(s, 0.8, 1.2));
    shift(s, o, d);
    const where = kind === 'tour' ? 'toured the zoo with you' : o.group === 'board' ? 'met with you' : 'met you at their office';
    const reaction = read > 2 ? `They liked what they heard about ${T.wants}.` : read < 0 ? `They pushed back: they care about ${T.wants}, and they aren’t seeing it.` : `They care about ${T.wants}.`;
    return { ok: true, msg: `${o.name} (${o.role}) ${where}. ${reaction} Stance ${d >= 0 ? '+' : ''}${d}.` };
  };

  O.askSupport = function (s, id) {
    const o = s.officials.find((x) => x.id === id);
    const item = o && O.pendingItem(s, o.group);
    if (!item) return { ok: false, msg: 'There is nothing up for a vote right now.' };
    if (s.day - o.lastAsk < O.GAP) return { ok: false, msg: `You already asked ${o.name}. Try again after ${U.fmtDate(o.lastAsk + O.GAP)}.` };
    o.lastAsk = s.day;
    o.lastMet = s.day;
    const st = O.stance(s, o);
    const p = U.clamp((st - 25) / 55, 0.05, 0.95);
    if (U.rand(s) < p) {
      o.committed = item.key;
      return { ok: true, msg: `✅ ${o.name} committed to support ${item.text}.` };
    }
    shift(s, o, -2);
    return { ok: true, msg: `${o.name} wouldn’t commit to ${item.text}. (${O.lean(st)}, about ${Math.round(p * 100)}% chance.)` };
  };

  // Weighted share of committed supporters for an item (0..1).
  O.support = function (s, group, key) {
    const list = O.list(s, group);
    const W = O.weightOf(s, group);
    return W ? list.filter((o) => o.committed === key).reduce((a, o) => a + o.weight, 0) / W : 0;
  };
  O.clear = (s, key) => s.officials.forEach((o) => o.committed === key && (o.committed = null));

  // A recorded vote among a group's voting members (executives don't vote).
  O.vote = function (s, group, key, lean) {
    let yes = 0, no = 0;
    for (const o of O.list(s, group)) {
      if (o.exec) continue;
      const p = o.committed === key ? 0.95 : U.clamp(O.stance(s, o) / 100 + (lean || 0), 0.03, 0.97);
      U.rand(s) < p ? yes++ : no++;
    }
    return { yes, no, passed: yes > no };
  };
  O.exec = (s, group) => O.list(s, group).find((o) => o.exec);

  // Whip count for the UI.
  O.whip = function (s, group, key) {
    const out = { yes: 0, lean: 0, no: 0 };
    for (const o of O.list(s, group)) {
      if (o.exec) continue;
      const st = O.stance(s, o);
      if (o.committed === key || st >= 62) out.yes++;
      else if (st >= 42) out.lean++;
      else out.no++;
    }
    return out;
  };

  // ---- State funding ---------------------------------------------------------
  O.stateInfo = (s) => O.STATE[s.zooId] || null;
  O.stateWindow = function (s) {
    const st = O.stateInfo(s);
    if (!st) return false;
    const t = U.dateOf(s.day);
    if (st.odd && t.y % 2 === 0) return false;
    return st.open.includes(t.m) && (s.gov.stateYear || 0) !== t.y;
  };
  O.stateOptions = function (s) {
    const st = O.stateInfo(s);
    const Z = ZG.zoo(s);
    const base = Z.majorGiftScale * st.scale;
    return [
      { kind: 'repairs', name: 'Critical repairs', amount: Math.round(Math.min(ZG.Infra.backlog(s) * 0.15, base * 1.2) / 10000) * 10000 || 250000, odds: 0.1, text: 'Fix failing infrastructure. Easy for legislators to support.' },
      { kind: 'education', name: 'School field-trip & education program', amount: Math.round(base * 0.4 / 10000) * 10000, odds: 0.15, text: 'Free field trips for public schools statewide.' },
      { kind: 'habitat', name: 'New habitat & conservation center', amount: Math.round(base * 2 / 10000) * 10000, odds: -0.15, text: 'A big capital project. Harder to win, bigger payoff.' },
    ];
  };
  O.submitState = function (s, kind) {
    if (!O.stateWindow(s)) return { ok: false, msg: 'The state legislature is not taking requests right now.' };
    const opt = O.stateOptions(s).find((o) => o.kind === kind);
    if (!opt) return { ok: false, msg: 'Choose a request.' };
    s.gov.stateReq = { kind, name: opt.name, amount: opt.amount, bump: opt.odds, day: s.day };
    s.gov.stateYear = U.dateOf(s.day).y;
    ZG.Econ.spend(s, 'admin', 8000);
    ZG.Sim.news(s, `🏛️ You submitted a ${$(opt.amount)} ${O.stateInfo(s).program} to the ${O.stateInfo(s).name} Legislature: “${opt.name}.”`, 'info');
    return { ok: true, msg: 'Request filed. Line up supporters before the session ends.' };
  };

  O.monthly = function (s, t) {
    for (const o of s.officials) o.off += (o.off0 - o.off) * 0.04; // relationships fade without attention
    if (s.gov.stateRel != null) s.gov.stateRel += ((45 + (s.rep - 60) * 0.3) - s.gov.stateRel) * 0.03;
    const st = O.stateInfo(s);
    const r = s.gov.stateReq;
    if (!st || !r) return;
    if (!r.passed && t.m === st.decide) {
      const lean = r.bump + O.support(s, 'state', 'state') * 0.25 + (s.economy - 1) * 0.8 - 0.05 + (ZG.Growth.adopted(s) ? 0.08 : 0);
      const v = O.vote(s, 'state', 'state', lean);
      if (v.passed) {
        r.passed = true;
        r.vote = v;
        ZG.Sim.news(s, `🏛️ The ${st.name} Legislature passed your “${r.name}” request (${v.yes}–${v.no} among key members). It goes to the Governor.`, 'good');
        if (st.sign === st.decide) O.governor(s);
      } else {
        ZG.Sim.news(s, `🏛️ Your “${r.name}” request died in committee (${v.yes}–${v.no} among key members).`, 'bad');
        s.gov.stateReq = null;
        O.clear(s, 'state');
      }
    } else if (r.passed && t.m === st.sign) O.governor(s);
  };

  O.governor = function (s) {
    const r = s.gov.stateReq;
    const gov = O.exec(s, 'state');
    const st = O.stateInfo(s);
    const p = gov.committed === 'state' ? 0.95 : U.clamp(O.stance(s, gov) / 100 + 0.25, 0.15, 0.95);
    const roll = U.rand(s);
    let amt = 0;
    if (roll < p) amt = r.amount;
    else if (roll < p + (1 - p) * 0.5) amt = Math.round(r.amount * 0.5 / 10000) * 10000;
    if (amt) {
      ZG.Econ.earn(s, 'government', amt, true);
      s.gov.stateRel = U.clamp(s.gov.stateRel + 2, 0, 100);
      s.stats.stateWins = (s.stats.stateWins || 0) + 1;
      ZG.Sim.news(s, amt === r.amount ? `✍️ The Governor of ${st.name} signed your ${$(amt)} “${r.name}” appropriation. It went to the capital fund.` : `✂️ The Governor line-item vetoed half your request. ${$(amt)} still went to the capital fund.`, 'good');
      if (r.kind === 'education') s.rep = U.clamp(s.rep + 2, 0, 100);
    } else ZG.Sim.news(s, `❌ The Governor of ${st.name} vetoed your “${r.name}” appropriation.`, 'bad');
    s.gov.stateReq = null;
    O.clear(s, 'state');
  };

  // Elections replace a few seats with newcomers who don't know you yet.
  O.election = function (s, group) {
    const ros = O.ROSTERS[s.zooId];
    for (const o of O.list(s, group)) {
      if (U.chance(s, o.exec ? 0.5 : 0.3)) {
        o.name = personName(s, ros.names);
        o.off0 = U.ri(s, -14, 14);
        o.off = o.off0;
        o.lastMet = -9999;
        o.committed = null;
        o.trait = U.pick(s, Object.keys(O.TRAITS));
        o.fresh = s.day;
      }
    }
  };

  // Shift everyone in the groups that fund you (for events that move "the politicians").
  O.shiftAll = function (s, group, d) {
    O.setAgg(s, group, O.agg(s, group) + d);
  };
})((globalThis.ZG = globalThis.ZG || {}));
