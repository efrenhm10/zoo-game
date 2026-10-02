// Prospecting: researching new individual donors and corporate partners, building
// relationships with companies, and pitching them a specific sponsorship deal.
(function (ZG) {
  const U = ZG.U;
  const CP = (ZG.Corps = {});
  const $ = (n) => U.money(n);

  CP.INTERESTS = {
    visibility: { name: 'Brand visibility', fits: ['exhibit', 'presenting'] },
    community: { name: 'Community goodwill', fits: ['program', 'presenting'] },
    employees: { name: 'Employee engagement', fits: ['employees'] },
    sustainability: { name: 'Sustainability image', fits: ['program'] },
    sales: { name: 'Selling to your guests', fits: ['pouring'] },
  };
  CP.DEALS = {
    exhibit: { name: 'Exhibit naming sponsorship', mult: 1.3, desc: 'Their name on a habitat for the length of the deal.' },
    presenting: { name: 'Presenting sponsor of zoo events', mult: 1.0, desc: 'Their logo on Zoo Lights, Boo at the Zoo and summer nights.' },
    pouring: { name: 'Exclusive vendor / pouring rights', mult: 0.9, desc: 'Only their drinks or products sold at the zoo. Boosts concessions.' },
    program: { name: 'Education or conservation program sponsor', mult: 0.7, desc: 'Funds field trips or a conservation program. Good for reputation.' },
    employees: { name: 'Employee giving & volunteer partnership', mult: 0.45, desc: 'Their staff volunteer and the company matches employee gifts.' },
  };

  CP.init = (s) => {
    if (!s.dev.corps) s.dev.corps = [];
    if (s.dev.lastResearch == null) s.dev.lastResearch = -999;
    if (s.dev.lastCorpResearch == null) s.dev.lastCorpResearch = -999;
  };

  // Individuals: research turns up new major-gift prospects.
  CP.researchPeople = function (s) {
    if (s.day - s.dev.lastResearch < 30) return { ok: false, msg: `Your prospect researcher is still working. Try after ${U.fmtDate(s.dev.lastResearch + 30)}.` };
    if (s.dev.prospects.length >= 8) return { ok: false, msg: 'You have 8 prospects already. Cultivate or ask some first.' };
    s.dev.lastResearch = s.day;
    const cost = Math.round(4000 * ZG.zoo(s).costMult);
    ZG.Econ.spend(s, 'admin', cost);
    const n = U.chance(s, 0.4 * Math.min(1.3, ZG.Staff.ratio(s, 'development'))) ? 2 : 1;
    for (let i = 0; i < n; i++) ZG.Dev.newProspect(s);
    const found = s.dev.prospects.slice(-n).map((p) => p.name).join(' and ');
    return { ok: true, msg: `🔍 Wealth screening and board introductions turned up ${found} (${$(cost)}).` };
  };
  CP.meetPerson = function (s, pid) {
    const p = s.dev.prospects.find((x) => x.id === pid);
    if (!p) return { ok: false, msg: 'Gone.' };
    if (s.day - (p.lastMeet || -999) < 21) return { ok: false, msg: `You met recently. Try after ${U.fmtDate(p.lastMeet + 21)}.` };
    p.lastMeet = s.day;
    ZG.Econ.spend(s, 'events', 600);
    const g = Math.round(U.ri(s, 6, 14) * ZG.mod(s, 'fundraising') + (p.passion.kind === 'species' && s.animals.some((a) => a.sp === p.passion.sp) ? 4 : 0));
    p.ready = Math.min(100, p.ready + g);
    return { ok: true, msg: `☕ Personal visit with ${p.name}. Readiness +${g} (now ${Math.round(p.ready)}).` };
  };

  // Corporations
  CP.researchCorps = function (s) {
    if (s.day - s.dev.lastCorpResearch < 30) return { ok: false, msg: `Your corporate-relations team is still researching. Try after ${U.fmtDate(s.dev.lastCorpResearch + 30)}.` };
    if (s.dev.corps.length >= 6) return { ok: false, msg: 'You have 6 corporate prospects already.' };
    const taken = new Set(s.sponsors.map((x) => x.name).concat(s.sponsorOffers.map((x) => x.name), s.dev.corps.map((x) => x.name)));
    const pool = ZG.NAMES.companies.filter((c) => !taken.has(c.name));
    if (!pool.length) return { ok: false, msg: 'You have already approached every major company in town.' };
    s.dev.lastCorpResearch = s.day;
    ZG.Econ.spend(s, 'admin', Math.round(3000 * ZG.zoo(s).costMult));
    const Z = ZG.zoo(s);
    const found = [];
    for (let i = 0; i < 2 && pool.length; i++) {
      const c = pool.splice(Math.floor(U.rand(s) * pool.length), 1)[0];
      const interest = c.ind === 'Beverages' || c.ind === 'Fast food' || c.ind === 'Grocery' ? 'sales' : U.pick(s, Object.keys(CP.INTERESTS));
      s.dev.corps.push({ id: s.nextId++, name: c.name, ind: c.ind, risk: c.risk, budget: Math.round((Z.sponsorScale * U.rf(s, 0.5, 2) * (0.7 + 0.6 * c.risk)) / 1000) * 1000, ready: U.ri(s, 15, 40), interest, lastMeet: -999, lastAsk: -999 });
      found.push(c.name);
    }
    return { ok: true, msg: `🔍 New corporate prospects: ${found.join(' and ')}.` };
  };

  CP.TOUCHES = {
    meet: { icon: '☕', name: 'Meet their community-relations team', cost: 800, gain: [6, 12] },
    volunteer: { icon: '🧤', name: 'Host an employee volunteer day', cost: 4000, gain: [8, 16] },
    vip: { icon: '🎟️', name: 'VIP behind-the-scenes evening for executives', cost: 9000, gain: [10, 20] },
  };
  CP.touch = function (s, id, type) {
    const c = s.dev.corps.find((x) => x.id === id);
    const T = CP.TOUCHES[type];
    if (!c || !T) return { ok: false, msg: 'Not available.' };
    if (s.day - c.lastMeet < 21) return { ok: false, msg: `You met recently. Try after ${U.fmtDate(c.lastMeet + 21)}.` };
    c.lastMeet = s.day;
    ZG.Econ.spend(s, 'events', Math.round(T.cost * ZG.zoo(s).costMult));
    let g = U.ri(s, T.gain[0], T.gain[1]) * ZG.mod(s, 'sponsors');
    const notes = [];
    if (type === 'volunteer' && c.interest === 'employees') (g += 6), notes.push('Their HR director loved it.');
    if (type === 'vip' && c.interest === 'visibility') (g += 5), notes.push('Their CMO is already picturing the signage.');
    if (type === 'volunteer') s.morale = U.clamp(s.morale + 1, 0, 100);
    g = Math.round(g);
    c.ready = Math.min(100, c.ready + g);
    return { ok: true, msg: `${T.icon} ${T.name} with ${c.name}. Readiness +${g} (now ${c.ready}). ${notes.join(' ')}`.trim() };
  };

  CP.amount = (s, c, deal) => Math.round((c.budget * CP.DEALS[deal].mult) / 1000) * 1000;
  CP.odds = function (s, c, deal) {
    let o = (c.ready / 100) * 1.0 - 0.1 + (s.rep - 60) / 200 + (ZG.mod(s, 'sponsors') - 1) * 0.5;
    if (CP.INTERESTS[c.interest].fits.includes(deal)) o += 0.15;
    if (deal === 'program' && c.risk > 0.5) o += 0.05; // risky firms like the halo
    if (deal === 'exhibit' && !s.habitats.some((h) => !h.construction && !h.sponsor && !h.donorName)) o = 0;
    return U.clamp(o, 0.02, 0.9);
  };

  CP.ask = function (s, id, deal, habId) {
    const c = s.dev.corps.find((x) => x.id === id);
    if (!c || !CP.DEALS[deal]) return { ok: false, msg: 'Not available.' };
    if (s.day - c.lastAsk < 120) return { ok: false, msg: `They turned you down recently. Try after ${U.fmtDate(c.lastAsk + 120)}.` };
    let hab = null;
    if (deal === 'exhibit') {
      hab = s.habitatsById[habId];
      if (!hab || hab.sponsor || hab.donorName || hab.construction) return { ok: false, msg: 'Pick a habitat that has no sponsor or donor name yet.' };
    }
    const p = CP.odds(s, c, deal);
    c.lastAsk = s.day;
    const amount = CP.amount(s, c, deal);
    if (U.rand(s) >= p) {
      c.ready = Math.max(0, c.ready - 15);
      return { ok: true, msg: `${c.name} passed on the ${CP.DEALS[deal].name.toLowerCase()} (odds were ${Math.round(p * 100)}%). Keep building the relationship.` };
    }
    const years = U.ri(s, 3, 5);
    const kind = deal === 'program' || deal === 'employees' ? 'general' : deal;
    const offer = { id: s.nextId++, name: c.name, ind: c.ind, risk: c.risk, kind, hab: hab ? hab.id : null, amount, years, expires: s.day + 1, program: deal };
    s.sponsorOffers.push(offer);
    ZG.Dev.acceptSponsor(s, offer.id);
    if (deal === 'program') s.rep = U.clamp(s.rep + 1.5, 0, 100);
    if (deal === 'employees') (s.morale = U.clamp(s.morale + 2, 0, 100)), (s.flags.volunteers = (s.flags.volunteers || 0) + 1);
    s.dev.corps.splice(s.dev.corps.indexOf(c), 1);
    return { ok: true, msg: `🤝 ${c.name} signed! ${CP.DEALS[deal].name}: ${$(amount)}/yr for ${years} years. (Odds were ${Math.round(p * 100)}%.)` };
  };

  CP.monthly = function (s) {
    for (const c of s.dev.corps) if (s.day - c.lastMeet > 90) c.ready = Math.max(0, c.ready - 2);
  };
})((globalThis.ZG = globalThis.ZG || {}));
