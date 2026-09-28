// Top donors: a roster of named major donors. Their loyalty is a relationship you
// keep up in person (calls, coffee, tours, dinners, thank-yous) and spend when you ask.
(function (ZG) {
  const U = ZG.U;
  const DN = (ZG.Donors = {});
  const $ = (n) => U.money(n);

  DN.TRAITS = {
    recognition: { name: 'Likes recognition', tip: 'Naming rights and public thanks go a long way.' },
    private: { name: 'Very private', tip: 'Hates publicity. Never put their name on anything without asking.' },
    handsOn: { name: 'Hands-on', tip: 'Wants to be consulted. Feels forgotten fast if you don’t check in.' },
    impact: { name: 'Data-driven', tip: 'Wants proof: numbers, outcomes and impact reports.' },
    social: { name: 'Social butterfly', tip: 'Loves dinners, galas and zoo events.' },
    legacy: { name: 'Thinking about legacy', tip: 'Could be open to a gift in their will.' },
  };

  // Contact options. rel = base relationship gain.
  DN.TOUCHES = {
    call: { icon: '📞', name: 'Check-in call', cost: 0, rel: 3 },
    coffee: { icon: '☕', name: 'Coffee', cost: 120, rel: 5 },
    tour: { icon: '🦒', name: 'Behind-the-scenes tour', cost: 700, rel: 6 },
    dinner: { icon: '🍽️', name: 'Dinner', cost: 2200, rel: 8 },
    report: { icon: '📊', name: 'Send an impact report', cost: 0, rel: 2 },
  };
  DN.GAP = 14; // days between personal contacts with the same donor

  const WEIGHTS = [3, 2.2, 1.8, 1.5, 1.25, 1.05, 0.9, 0.8, 0.7, 0.6];

  DN.make = function (s, opts) {
    const N = ZG.NAMES;
    const kind = opts.kind || U.pick(s, ['family', 'family', 'individual', 'foundation', 'couple']);
    const last = U.pick(s, N.donorLast);
    const name = kind === 'foundation' ? `The ${last} ${U.pick(s, N.foundations)}` : kind === 'couple' ? `${U.pick(s, N.donorFirst)} & ${U.pick(s, N.donorFirst)} ${last}` : kind === 'family' ? `The ${last} Family` : `${U.pick(s, N.donorFirst)} ${last}`;
    const held = [...new Set(s.animals.map((a) => a.sp))].filter((id) => ZG.SPECIES[id].appeal >= 5);
    const interest = U.chance(s, 0.55) && held.length ? { kind: 'species', sp: U.pick(s, held) } : { kind: U.pick(s, ['conservation', 'education', 'capital', 'welfare']) };
    return Object.assign({
      id: s.nextId++, name, kind, rel: U.ri(s, 45, 80), cap: 0, annual: 0, lifetime: 0,
      lastGift: 0, lastGiftDay: -9999, lastAsk: -9999, lastContact: -U.ri(s, 10, 120),
      thanked: true, interest, trait: U.pick(s, Object.keys(DN.TRAITS)), since: U.ri(s, 1985, 2022), planned: false,
    }, opts);
  };

  DN.init = function (s) {
    const Z = ZG.zoo(s);
    const pool = Z.donorBase * 0.3;
    const wsum = WEIGHTS.reduce((a, b) => a + b, 0);
    s.donors = WEIGHTS.map((w) => {
      const d = DN.make(s, {});
      d.cap = Math.round((Z.donorBase * 0.4 * (w / wsum) * U.rf(s, 0.75, 1.25)) / 1000) * 1000;
      d.annual = Math.round((pool * w) / wsum / 100) * 100;
      d.lifetime = Math.round((d.annual * (2027 - d.since) * U.rf(s, 0.6, 1) + (U.chance(s, 0.5) ? d.cap * U.rf(s, 0.3, 1) : 0)) / 1000) * 1000;
      return d;
    });
    DN.sort(s);
  };

  DN.sort = (s) => s.donors.sort((a, b) => b.lifetime - a.lifetime);
  DN.top = (s) => s.donors.slice(0, 10);
  DN.mood = (rel) => (rel >= 80 ? 'Devoted' : rel >= 65 ? 'Warm' : rel >= 50 ? 'Cordial' : rel >= 35 ? 'Cooling' : 'Frustrated');
  DN.interestText = function (d) {
    const i = d.interest;
    if (i.kind === 'species') return `loves the ${ZG.SPECIES[i.sp].name}s`;
    return { conservation: 'cares about saving species in the wild', education: 'cares about kids & education', capital: 'wants to build something lasting', welfare: 'cares most about animal welfare' }[i.kind];
  };
  DN.canContact = (s, d) => s.day - d.lastContact >= DN.GAP;
  const bump = (d, v) => (d.rel = U.clamp(d.rel + v, 0, 100));

  DN.touch = function (s, id, type) {
    const d = s.donors.find((x) => x.id === id);
    const T = DN.TOUCHES[type];
    if (!d || !T) return { ok: false, msg: 'Not available.' };
    if (!DN.canContact(s, d)) return { ok: false, msg: `You saw ${d.name} recently. Give it until ${U.fmtDate(d.lastContact + DN.GAP)}.` };
    if (T.cost) ZG.Econ.spend(s, 'events', T.cost);
    d.lastContact = s.day;
    let g = T.rel * ZG.mod(s, 'fundraising');
    const notes = [];
    if (type === 'call' && d.trait === 'handsOn') (g += 3), notes.push('They had opinions, and loved being asked.');
    if (type === 'report') {
      if (d.trait === 'impact') (g += 6), notes.push('They read every page.');
      if (d.interest.kind === 'conservation') g += s.policy.conservation >= ZG.zoo(s).refs.conservation ? 3 : -2;
    }
    if (type === 'dinner' && d.trait === 'social') (g += 4), notes.push('They stayed until the restaurant closed.');
    if (type === 'tour') {
      const i = d.interest;
      if (i.kind === 'species') {
        const has = s.animals.filter((a) => a.sp === i.sp);
        if (has.length) {
          g += 5;
          notes.push(`They got to meet the ${ZG.SPECIES[i.sp].name}s up close.`);
          if (has.some((a) => a.age < 200)) (g += 4), notes.push('Seeing the baby made their year.');
        } else (g -= 3), notes.push(`They asked where the ${ZG.SPECIES[i.sp].name}s went.`);
      }
      const w = ZG.Animals.avgWelfare(s);
      if (w < 55) (g -= 4), notes.push('They noticed stressed animals and worn exhibits.');
      if (i.kind === 'welfare' && w > 75) (g += 3), notes.push('They were impressed by how well the animals look.');
      if (d.trait === 'private' || d.trait === 'handsOn') g += 2;
    }
    g = Math.round(g * U.rf(s, 0.8, 1.2));
    bump(d, g);
    return { ok: true, msg: `${T.icon} ${T.name} with ${d.name}: relationship ${g >= 0 ? '+' : ''}${g}. ${notes.join(' ')}`.trim() };
  };

  DN.thank = function (s, id) {
    const d = s.donors.find((x) => x.id === id);
    if (!d || d.thanked) return { ok: false, msg: 'Nothing to thank them for right now.' };
    d.thanked = true;
    const g = d.trait === 'recognition' ? 9 : 6;
    bump(d, g);
    return { ok: true, msg: `💌 A handwritten note and a photo from the keepers went to ${d.name}. Relationship +${g}.` };
  };

  DN.PURPOSES = {
    operating: 'Unrestricted (operations)',
    capital: 'Capital fund (repairs & new habitats)',
    conservation: 'Field conservation',
    naming: 'Name a habitat after them',
    campaign: 'The capital campaign',
    planned: 'A gift in their will',
  };
  DN.askLevels = (d) => [
    { lvl: 'modest', amt: Math.round((d.cap * 0.5) / 1000) * 1000 },
    { lvl: 'major', amt: Math.round(d.cap / 1000) * 1000 },
    { lvl: 'stretch', amt: Math.round((d.cap * 2) / 1000) * 1000 },
  ];

  DN.odds = function (s, d, amt, purpose) {
    let o = (d.rel / 100) * 1.1 - 0.18 - Math.max(0, amt / d.cap - 0.5) * 0.38;
    const i = d.interest;
    if (purpose === 'capital' && i.kind === 'capital') o += 0.12;
    if (purpose === 'conservation' && i.kind === 'conservation') o += 0.15;
    if (purpose === 'naming') o += d.trait === 'recognition' ? 0.15 : d.trait === 'private' ? -0.3 : 0;
    if (purpose === 'campaign') o += s.dev.campaign ? 0.05 + (s.dev.campaign.momentum || 0) * 0.1 : -1;
    if (purpose === 'planned') o += d.trait === 'legacy' ? 0.25 : -0.1;
    if (i.kind === 'species' && !s.animals.some((a) => a.sp === i.sp)) o -= 0.15;
    if (i.kind === 'welfare') o += (ZG.Animals.avgWelfare(s) - 70) / 150;
    if (s.day - d.lastGiftDay < 365 && purpose !== 'planned') o -= 0.25;
    if (!d.thanked) o -= 0.2;
    o += (s.rep - 60) / 300 + (ZG.mod(s, 'fundraising') - 1) * 0.5;
    return U.clamp(o, 0.02, 0.93);
  };

  DN.ask = function (s, id, lvl, purpose) {
    const d = s.donors.find((x) => x.id === id);
    if (!d) return { ok: false, msg: 'Not found.' };
    if (s.day - d.lastAsk < 90) return { ok: false, msg: `You asked ${d.name} recently. Wait until ${U.fmtDate(d.lastAsk + 90)}.` };
    const lv = DN.askLevels(d).find((x) => x.lvl === lvl);
    if (!lv) return { ok: false, msg: 'Pick an amount.' };
    let amt = lv.amt;
    if (purpose === 'planned') amt = Math.round(d.cap * 3 / 1000) * 1000;
    const p = DN.odds(s, d, amt, purpose);
    d.lastAsk = s.day;
    d.lastContact = s.day;
    const pct = Math.round(p * 100);
    if (U.rand(s) < p) {
      if (purpose === 'planned') {
        d.planned = true;
        s.flags.plannedGifts = (s.flags.plannedGifts || 0) + amt;
        s.board = U.clamp(s.board + 3, 0, 100);
        bump(d, 4);
        ZG.Sim.news(s, `📜 ${d.name} added the zoo to their estate plans (about ${$(amt)} someday).`, 'good');
        return { ok: true, msg: `${d.name} will leave the zoo about ${$(amt)} in their will (odds were ${pct}%).`, won: true };
      }
      const restricted = purpose === 'capital' || purpose === 'campaign' || purpose === 'naming';
      ZG.Econ.earn(s, 'donations', amt, restricted);
      if (purpose === 'conservation') ZG.Econ.spend(s, 'conservation', 0);
      if (s.dev.campaign && (purpose === 'campaign' || restricted)) s.dev.campaign.raised += amt;
      if (purpose === 'naming') {
        const h = s.habitats.filter((x) => !x.construction && !x.donorName).sort((a, b) => ZG.Habitats.appeal(s, b) - ZG.Habitats.appeal(s, a))[0];
        if (h) h.donorName = d.name.replace(/^The /, '');
        s.rep = U.clamp(s.rep + 0.5, 0, 100);
      }
      d.lifetime += amt;
      d.lastGift = amt;
      d.lastGiftDay = s.day;
      d.thanked = false;
      d.cap = Math.round(d.cap * 1.05);
      bump(d, 2);
      s.board = U.clamp(s.board + Math.min(6, (amt / ZG.zoo(s).majorGiftScale) * 2), 0, 100);
      DN.sort(s);
      ZG.Sim.news(s, `🎁 ${d.name} said yes: ${$(amt)} for ${DN.PURPOSES[purpose].toLowerCase()}.`, 'good');
      return { ok: true, msg: `Yes! ${d.name} gave ${$(amt)} (odds were ${pct}%). Don’t forget to thank them.`, won: true };
    }
    const over = Math.max(0, amt / d.cap - 1);
    const hurt = Math.round(4 + over * 8 + (purpose === 'naming' && d.trait === 'private' ? 8 : 0));
    bump(d, -hurt);
    const partial = purpose !== 'planned' && U.chance(s, 0.35) ? Math.round((amt * 0.2) / 1000) * 1000 : 0;
    if (partial) {
      ZG.Econ.earn(s, 'donations', partial);
      d.lifetime += partial;
      d.lastGiftDay = s.day;
      d.thanked = false;
    }
    ZG.Sim.news(s, `🙁 ${d.name} turned down the ${$(amt)} ask${partial ? ` but sent ${$(partial)}` : ''}.`, 'bad');
    return { ok: true, msg: `${d.name} said “not right now”${partial ? ` and sent ${$(partial)} instead` : ''}. Relationship −${hurt}. (Odds were ${pct}%.)`, won: false };
  };

  // A prospect who gives becomes part of the donor roster.
  DN.addFromProspect = function (s, p, amt) {
    const d = DN.make(s, { name: p.name, kind: /Foundation|Trust|Fund/.test(p.name) ? 'foundation' : 'couple' });
    d.cap = p.cap;
    d.annual = Math.round((amt * 0.08) / 100) * 100;
    d.lifetime = amt;
    d.lastGift = amt;
    d.lastGiftDay = s.day;
    d.thanked = false;
    d.rel = 68;
    d.since = U.dateOf(s.day).y;
    if (p.passion.kind === 'species') d.interest = { kind: 'species', sp: p.passion.sp };
    else d.interest = { kind: p.passion.kind };
    s.donors.push(d);
    DN.sort(s);
    if (s.donors.length > 14) s.donors.length = 14;
  };

  DN.monthly = function (s, t) {
    const Z = ZG.zoo(s);
    for (const d of s.donors) {
      const since = s.day - d.lastContact;
      if (since > 60) bump(d, -(d.trait === 'handsOn' ? 2.5 : 1.3) * (since > 150 ? 1.6 : 1));
      bump(d, (s.rep - s.rep0) * 0.03);
      if (!d.thanked && s.day - d.lastGiftDay > 45) {
        d.thanked = true;
        bump(d, -10);
        ZG.Sim.news(s, `😒 ${d.name} never got a thank-you for their last gift, and they noticed.`, 'bad');
      }
      // Devoted donors sometimes give without being asked.
      if (d.rel > 85 && U.chance(s, 0.025)) {
        const amt = Math.round((d.cap * U.rf(s, 0.15, 0.35)) / 1000) * 1000;
        ZG.Econ.earn(s, 'donations', amt);
        d.lifetime += amt;
        d.lastGiftDay = s.day;
        d.thanked = false;
        ZG.Sim.news(s, `💝 ${d.name} sent an unsolicited gift of ${$(amt)} “because you’re doing great work.”`, 'good');
      }
    }
    // December: annual gifts renew in proportion to how the relationship feels.
    if (t.m === 11) {
      let total = 0;
      for (const d of s.donors.slice()) {
        if (d.rel < 20 && U.chance(s, 0.5)) {
          s.donors.splice(s.donors.indexOf(d), 1);
          ZG.Sim.news(s, `💔 ${d.name} stopped giving to the zoo after ${U.dateOf(s.day).y - d.since} years.`, 'bad');
          s.board = U.clamp(s.board - 2, 0, 100);
          continue;
        }
        const f = U.clamp(0.3 + d.rel / 100, 0.35, 1.3) * s.economy;
        const gift = Math.round(d.annual * f);
        if (gift > 0) {
          total += gift;
          d.lifetime += gift;
        }
        d.annual = Math.round(d.annual * (d.rel > 75 ? 1.05 : d.rel < 40 ? 0.92 : 1));
      }
      if (total) {
        ZG.Econ.earn(s, 'donations', total);
        ZG.Sim.news(s, `🎄 Year-end gifts from your top donors: ${$(total)}.`, 'good');
      }
      DN.sort(s);
      // Replenish the roster from new supporters.
      while (s.donors.length < 10) {
        const d = DN.make(s, {});
        d.cap = Math.round((Z.donorBase * U.rf(s, 0.03, 0.06)) / 1000) * 1000;
        d.annual = Math.round((Z.donorBase * 0.3 * 0.05) / 100) * 100;
        d.lifetime = d.annual;
        d.rel = 55;
        d.since = U.dateOf(s.day).y;
        s.donors.push(d);
      }
    }
  };

  // Something the donor base reacts to as a group (a risky sponsor, a scandal, a triumph).
  DN.react = function (s, amount, filter) {
    for (const d of s.donors) if (!filter || filter(d)) bump(d, amount);
  };
})((globalThis.ZG = globalThis.ZG || {}));
