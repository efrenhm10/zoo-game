// Capital campaigns: up to three at once, each tied to a project, each with its own
// lead prospects. A gift of at least 70% of the goal buys naming rights on the project;
// a 25% leadership gift names the viewing plaza.
(function (ZG) {
  const U = ZG.U;
  const C = (ZG.Campaigns = {});
  const $ = (n) => U.money(n);

  C.MAX = 3;
  C.NAMING = 0.7;
  C.LEADERSHIP = 0.25;

  C.init = function (s) {
    if (!s.dev.campaigns) {
      s.dev.campaigns = [];
      if (s.dev.campaign) {
        const c = Object.assign({ id: s.nextId++, momentum: 0, target: { kind: 'general' }, naming: null, leads: [] }, s.dev.campaign);
        s.dev.campaigns.push(c);
        C.makeLeads(s, c);
      }
      s.dev.campaign = null;
    }
  };
  C.list = (s) => s.dev.campaigns || [];
  C.canStart = (s) => C.list(s).length < C.MAX;
  // Where general gifts (galas, prospects) go: the campaign with the most left to raise.
  C.primary = (s) => C.list(s).slice().sort((a, b) => b.goal - b.raised - (a.goal - a.raised))[0] || null;
  C.byId = (s, id) => C.list(s).find((c) => c.id === +id) || null;
  C.forPlot = (s, plotId) => C.list(s).find((c) => c.target.kind === 'plot' && c.target.id === plotId) || null;

  C.start = function (s, goal, label, target) {
    goal = Math.round(goal);
    if (!C.canStart(s)) return { ok: false, msg: `You can run ${C.MAX} campaigns at once. Finish one first.` };
    if (!(goal > 0)) return { ok: false, msg: 'Nothing to raise.' };
    target = target || { kind: 'general' };
    if (target.kind === 'plot' && C.forPlot(s, target.id)) return { ok: false, msg: 'That project already has a campaign.' };
    const c = { id: s.nextId++, goal, raised: 0, label, start: s.day, end: s.day + 365 * 3, momentum: 0.1, target, naming: null, plaza: null, leads: [] };
    s.dev.campaigns.push(c);
    ZG.Econ.spend(s, 'events', goal * 0.02);
    C.makeLeads(s, c);
    ZG.Sim.news(s, `📣 Capital campaign launched: “${label}”, goal ${$(goal)}. Your development team identified ${c.leads.length} lead prospects.`, 'info');
    return { ok: true, msg: `Campaign launched (2% of the goal spent on a feasibility study). Pitch the lead prospects in Fundraising → Campaigns; a gift of ${$(goal * C.NAMING)} or more earns naming rights.` };
  };

  const shortName = (name, kind) => {
    if (kind === 'corp') return name;
    const n = name.replace(/^The /, '');
    const m = n.match(/([A-ZĀĒĪŌŪ][\wʻ’'-]+) (Family|Charitable|Foundation|Fund|Trust)/);
    if (m) return `${m[1]} Family`;
    const last = n.split(' ').pop();
    return `${last} Family`;
  };
  C.shortName = shortName;

  // Lead prospects: new wealthy families/foundations, two top donors, and corporations.
  C.makeLeads = function (s, c) {
    const N = ZG.NAMES;
    // Local philanthropy scale: San Diego's donors can do far more than Honolulu's.
    const wealth = U.clamp(ZG.zoo(s).majorGiftScale / 3e6, 0.35, 1.25);
    const leads = [];
    const usedLast = new Set((s.donors || []).map((d) => d.name.split(' ').slice(-2)[0]));
    for (let i = 0; i < 3; i++) {
      let last = U.pick(s, N.donorLast);
      for (let t = 0; t < 20 && usedLast.has(last); t++) last = U.pick(s, N.donorLast);
      usedLast.add(last);
      const fdn = U.chance(s, 0.5);
      leads.push({ key: 'f' + i, kind: 'family', name: fdn ? `The ${last} ${U.pick(s, N.foundations)}` : `${U.pick(s, N.donorFirst)} & ${U.pick(s, N.donorFirst)} ${last}`, cap: Math.round((c.goal * U.rf(s, 0.45, 1.3) * wealth) / 10000) * 10000, ready: U.ri(s, 20, 45), trait: U.pick(s, ['recognition', 'recognition', 'private', 'legacy', 'impact']) });
    }
    for (const d of (s.donors || []).slice().sort((a, b) => b.rel - a.rel).slice(0, 2))
      leads.push({ key: 'd' + d.id, kind: 'donor', donorId: d.id, name: d.name, cap: Math.round((Math.max(d.cap * 4, c.goal * U.rf(s, 0.25, 0.8) * wealth)) / 10000) * 10000, ready: Math.round(d.rel * 0.7), trait: d.trait });
    const taken = new Set((s.sponsors || []).map((x) => x.name).concat(C.list(s).filter((x) => x.naming).map((x) => x.naming.name)));
    const corps = N.companies.filter((x) => !taken.has(x.name));
    for (let i = 0; i < 2 && corps.length; i++) {
      const co = corps.splice(Math.floor(U.rand(s) * corps.length), 1)[0];
      leads.push({ key: 'c' + i, kind: 'corp', name: co.name, ind: co.ind, risk: co.risk, cap: Math.round((c.goal * U.rf(s, 0.4, 1.2) * (0.75 + 0.6 * co.risk) * wealth) / 10000) * 10000, ready: U.ri(s, 25, 50) });
    }
    c.leads = leads;
  };

  C.pitch = function (s, cid, key) {
    const c = C.byId(s, cid);
    const L = c && c.leads.find((x) => x.key === key);
    if (!L) return { ok: false, msg: 'Not found.' };
    if (s.day - (L.lastPitch || -999) < 21) return { ok: false, msg: `You met recently. Try after ${U.fmtDate(L.lastPitch + 21)}.` };
    L.lastPitch = s.day;
    ZG.Econ.spend(s, 'events', L.kind === 'corp' ? 3000 : 1500);
    let g = U.ri(s, 8, 16) * ZG.mod(s, 'fundraising');
    const notes = [];
    if (L.trait === 'recognition') (g += 4), notes.push('The idea of their name on the exhibit clearly excites them.');
    if (L.trait === 'private') notes.push('They like the project but hate publicity.');
    if (L.kind === 'corp') notes.push(L.risk > 0.5 ? 'Their marketing team loves the visibility. Your conservation donors may not.' : 'Their community-relations team is interested.');
    if (ZG.Growth.adopted(s)) (g += 3), notes.push('Your strategic plan impressed them.');
    L.ready = Math.min(100, L.ready + Math.round(g));
    if (L.kind === 'donor') {
      const d = s.donors.find((x) => x.id === L.donorId);
      if (d) d.rel = U.clamp(d.rel + 2, 0, 100), (d.lastContact = s.day);
    }
    return { ok: true, msg: `☕ Pitched “${c.label}” to ${L.name}. Readiness ${L.ready}/100. ${notes.join(' ')}`.trim() };
  };

  C.odds = function (s, c, L, level) {
    const amt = c.goal * (level === 'naming' ? C.NAMING : C.LEADERSHIP);
    let o = L.ready / 100 * 1.05 - 0.15 - Math.max(0, amt / L.cap - 0.8) * 0.9;
    if (level === 'naming') o += L.trait === 'recognition' ? 0.12 : L.trait === 'private' ? -0.35 : 0;
    o += (s.rep - 60) / 250 + (c.momentum || 0) * 0.12 + (ZG.Growth.adopted(s) ? 0.05 : 0) + (ZG.mod(s, 'fundraising') - 1) * 0.4;
    return U.clamp(o, 0.02, 0.85);
  };

  C.ask = function (s, cid, key, level) {
    const c = C.byId(s, cid);
    const L = c && c.leads.find((x) => x.key === key);
    if (!L) return { ok: false, msg: 'Not found.' };
    if (L.done) return { ok: false, msg: 'They have already given to this campaign.' };
    if (s.day - (L.lastAsk || -999) < 180) return { ok: false, msg: `They said no recently. Try again after ${U.fmtDate(L.lastAsk + 180)}.` };
    if (level === 'naming' && c.naming) return { ok: false, msg: `Naming rights already belong to ${c.naming.name}.` };
    if (level === 'leadership' && c.plaza) return { ok: false, msg: 'The leadership gift is already taken.' };
    const amt = Math.round((c.goal * (level === 'naming' ? C.NAMING : C.LEADERSHIP)) / 10000) * 10000;
    const p = C.odds(s, c, L, level);
    L.lastAsk = s.day;
    const pct = Math.round(p * 100);
    if (U.rand(s) >= p) {
      L.ready = Math.max(0, L.ready - 15);
      const why = amt > L.cap ? 'said it is more than they can give' : L.ready < 40 ? 'said they are not ready for a gift that size' : 'said the timing is wrong';
      ZG.Sim.news(s, `🙁 ${L.name} ${why} (${$(amt)} for “${c.label}”).`, 'bad');
      return { ok: true, msg: `${L.name} ${why}. (Odds were ${pct}%.) Keep cultivating and try again later.` };
    }
    ZG.Econ.earn(s, L.kind === 'corp' ? 'sponsorships' : 'donations', amt, true);
    c.raised += amt;
    c.momentum = Math.min(1.5, (c.momentum || 0) + 0.4);
    L.done = level;
    const short = shortName(L.name, L.kind);
    if (L.kind === 'donor') {
      const d = s.donors.find((x) => x.id === L.donorId);
      if (d) (d.lifetime += amt), (d.lastGift = amt), (d.lastGiftDay = s.day), (d.thanked = false), ZG.Donors.sort(s);
    } else if (L.kind === 'family' && s.donors) {
      const d = ZG.Donors.make(s, { name: L.name, kind: /Foundation|Trust|Fund/.test(L.name) ? 'foundation' : 'couple' });
      Object.assign(d, { cap: Math.round(L.cap * 0.2), annual: Math.round(amt * 0.02), lifetime: amt, lastGift: amt, lastGiftDay: s.day, thanked: false, rel: 75, since: U.dateOf(s.day).y, trait: L.trait });
      s.donors.push(d);
      ZG.Donors.sort(s);
    }
    if (L.kind === 'corp' && L.risk > 0.5) {
      s.rep = U.clamp(s.rep - L.risk * 3, 0, 100);
      s.aza = U.clamp(s.aza - L.risk * 3, 0, 100);
      if (s.donors) ZG.Donors.react(s, -Math.round(L.risk * 8), (d) => d.interest.kind === 'conservation' || d.trait === 'impact');
    }
    s.board = U.clamp(s.board + Math.min(8, amt / ZG.zoo(s).majorGiftScale * 2), 0, 100);
    if (level === 'naming') {
      c.naming = { name: L.name, short, kind: L.kind, amount: amt };
      C.applyNaming(s, c);
      ZG.Sim.news(s, `🏷️ ${L.name} gave ${$(amt)} to “${c.label}”, earning naming rights.`, 'good');
      return { ok: true, msg: `YES! ${L.name} committed ${$(amt)} and the project will carry their name. (Odds were ${pct}%.)`, modal: { icon: '🏷️', title: 'A naming gift!', html: `<p><b>${U.esc(L.name)}</b> committed <b>${$(amt)}</b>, ${Math.round(C.NAMING * 100)}% of the “${U.esc(c.label)}” goal.</p><p>${U.esc(C.namingText(s, c))}</p><p class="sub">${L.kind === 'corp' ? (L.risk > 0.5 ? 'Some conservation-minded donors and AZA colleagues raised eyebrows at the corporate name.' : 'A clean corporate partner. No backlash.') : 'Don’t forget to thank them.'}</p>` } };
    }
    c.plaza = { name: L.name, short, amount: amt };
    ZG.Sim.news(s, `🎁 ${L.name} made a ${$(amt)} leadership gift to “${c.label}”. The viewing plaza will carry their name.`, 'good');
    return { ok: true, msg: `${L.name} gave ${$(amt)}. The viewing plaza will be the ${short} Plaza. (Odds were ${pct}%.)` };
  };

  C.namingText = function (s, c) {
    const n = c.naming;
    const t = c.target;
    if (t.kind === 'hab' && s.habitatsById[t.id]) return `The habitat is now the ${n.kind === 'corp' ? n.name + ' ' + s.habitatsById[t.id].name : s.habitatsById[t.id].name}.`;
    if (t.kind === 'plot') return `The new habitat will open as the ${n.kind === 'corp' ? n.name + ' ' + c.label : n.short + ' ' + c.label}.`;
    if (t.kind === 'second') return `The second site will be named the ${n.short} ${c.label}.`;
    if (t.kind === 'land') return `The new grounds will be called the ${n.short} Wildlands.`;
    return `The ${c.label} will be named for the ${n.short}.`;
  };

  // Put the name on the habitat (now or when it gets built).
  C.applyNaming = function (s, c, hab) {
    const n = c.naming;
    if (!n) return;
    if (c.target.kind === 'land') s.growth.landNaming = n;
    if (c.target.kind === 'second') s.growth.secondNaming = n;
    let h = hab || null;
    if (!h && c.target.kind === 'hab') h = s.habitatsById[c.target.id];
    if (!h && c.target.kind === 'plot') {
      const p = s.plots[c.target.id];
      if (p && p.hab) h = s.habitatsById[p.hab];
      else if (p) p.naming = { name: n.name, short: n.short, kind: n.kind };
    }
    if (!h || h.namedBy) return;
    h.namedBy = n.name;
    if (n.kind === 'corp') h.sponsor = n.name;
    else {
      h.donorName = n.name;
      if (!h.name.startsWith(n.short)) h.name = `${n.short} ${h.name}`;
    }
  };

  C.monthly = function (s) {
    const list = C.list(s);
    if (!list.length) return;
    const devR = ZG.Staff.ratio(s, 'development');
    const split = 1 / Math.sqrt(list.length); // donors get fatigued by many asks at once
    for (const c of list.slice()) {
      const trickle = c.goal * 0.012 * split * (1 + (c.momentum || 0)) * ZG.Growth.fundBoost(s) * devR * U.clamp(s.rep / 70, 0.5, 1.3) * s.economy * ZG.mod(s, 'fundraising');
      ZG.Econ.earn(s, 'donations', trickle, true);
      c.raised += trickle;
      c.momentum = Math.max(0, (c.momentum || 0) * 0.85);
      if (c.raised >= c.goal) {
        s.stats.campaignsDone++;
        s.board = U.clamp(s.board + 10, 0, 100);
        s.rep = U.clamp(s.rep + 3, 0, 100);
        ZG.Events.queue(s, 'campaign_done', { label: c.label, raised: c.raised });
        s.dev.campaigns.splice(s.dev.campaigns.indexOf(c), 1);
      } else if (s.day > c.end) {
        ZG.Sim.news(s, `📉 The “${c.label}” campaign closed at ${$(c.raised)} of ${$(c.goal)}.`, 'bad');
        s.board = U.clamp(s.board - 5, 0, 100);
        s.dev.campaigns.splice(s.dev.campaigns.indexOf(c), 1);
      }
    }
  };
})((globalThis.ZG = globalThis.ZG || {}));
