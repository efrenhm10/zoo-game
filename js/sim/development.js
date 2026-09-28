// Development: major-gift prospects, capital campaigns, galas, grants and corporate sponsorships.
(function (ZG) {
  const U = ZG.U;
  const D = (ZG.Dev = {});

  D.init = function (s) {
    s.dev = { prospects: [], campaign: null, lastGala: -999, grants: [], lastGrant: -999 };
    s.sponsors = [];
    s.sponsorOffers = [];
    for (let i = 0; i < 2; i++) D.newProspect(s);
  };

  D.newProspect = function (s) {
    const Z = ZG.zoo(s);
    const N = ZG.NAMES;
    const isFdn = U.chance(s, 0.35);
    const last = U.pick(s, N.donorLast);
    const name = isFdn ? `The ${last} ${U.pick(s, N.foundations)}` : `${U.pick(s, N.donorFirst)} & ${U.pick(s, N.donorFirst)} ${last}`;
    const held = [...new Set(s.animals.map((a) => a.sp))];
    const passion = U.chance(s, 0.6) && held.length ? { kind: 'species', sp: U.pick(s, held) } : U.pick(s, [{ kind: 'conservation' }, { kind: 'education' }, { kind: 'capital' }]);
    const cap = Math.round(Z.majorGiftScale * U.rf(s, 0.15, 1.6) * (U.chance(s, 0.08) ? 4 : 1) / 1000) * 1000;
    s.dev.prospects.push({ id: s.nextId++, name, cap, ready: U.ri(s, 5, 30), cultivating: false, passion, cooled: 0, created: s.day });
  };

  D.passionText = function (p) {
    if (p.kind === 'species') return `loves the ${ZG.SPECIES[p.sp].name}s`;
    if (p.kind === 'conservation') return 'passionate about field conservation';
    if (p.kind === 'education') return 'cares about kids & education';
    return 'wants to build something lasting';
  };

  D.ask = function (s, pid, level) {
    const p = s.dev.prospects.find((x) => x.id === pid);
    if (!p) return { ok: false, msg: 'Gone.' };
    const mult = { low: 0.5, mid: 1, high: 1.6 }[level];
    const amt = Math.round(p.cap * mult / 1000) * 1000;
    let odds = U.clamp((p.ready / 100) * 1.05 - (mult - 0.5) * 0.35 + (s.rep - 60) / 250 + (ZG.mod(s, 'fundraising') - 1) * 0.6, 0.03, 0.95);
    if (p.passion.kind === 'species' && !s.animals.some((a) => a.sp === p.passion.sp)) odds *= 0.5;
    if (p.passion.kind === 'conservation') odds += (s.policy.conservation / ZG.zoo(s).refs.conservation - 1) * 0.2;
    s.dev.prospects.splice(s.dev.prospects.indexOf(p), 1);
    if (U.rand(s) < odds) {
      const toCapital = !!s.dev.campaign || p.passion.kind === 'capital';
      ZG.Econ.earn(s, 'donations', amt, toCapital);
      if (s.dev.campaign) s.dev.campaign.raised += amt;
      if (ZG.Donors && s.donors) ZG.Donors.addFromProspect(s, p, amt);
      s.board = U.clamp(s.board + Math.min(6, amt / ZG.zoo(s).majorGiftScale * 2), 0, 100);
      ZG.Sim.news(s, `🎁 ${p.name} committed ${U.money(amt)}${toCapital ? ' to the capital fund' : ''}!`, 'good');
      return { ok: true, msg: `Yes! ${p.name} gave ${U.money(amt)}.`, won: true };
    }
    const partial = U.chance(s, 0.4) ? Math.round(amt * 0.2 / 1000) * 1000 : 0;
    if (partial) ZG.Econ.earn(s, 'donations', partial);
    ZG.Sim.news(s, `🙁 ${p.name} declined the ${U.money(amt)} ask${partial ? ` but sent ${U.money(partial)}` : ''}.`, 'bad');
    return { ok: true, msg: partial ? `They declined, but gave ${U.money(partial)}.` : 'They declined.', won: false };
  };

  D.startCampaign = function (s, goal, label) {
    if (s.dev.campaign) return { ok: false, msg: 'A campaign is already running.' };
    s.dev.campaign = { goal, raised: 0, label, start: s.day, end: s.day + 365 * 3 };
    ZG.Econ.spend(s, 'events', goal * 0.02);
    ZG.Sim.news(s, `📣 Capital campaign launched: "${label}" — goal ${U.money(goal)}.`, 'info');
    return { ok: true, msg: 'Campaign launched (2% of goal spent on feasibility study & materials).' };
  };

  D.gala = function (s) {
    const Z = ZG.zoo(s);
    if (s.day - s.dev.lastGala < 300) return { ok: false, msg: 'You already held a gala this year.' };
    const cost = Math.round(Z.donorBase * 0.06);
    ZG.Econ.spend(s, 'events', cost);
    s.dev.lastGala = s.day;
    const net = cost * U.rf(s, 1.8, 3.6) * U.clamp(s.rep / 70, 0.5, 1.3) * s.economy * ZG.mod(s, 'fundraising');
    ZG.Econ.earn(s, 'events', net, !!s.dev.campaign);
    if (s.dev.campaign) s.dev.campaign.raised += net;
    s.board = U.clamp(s.board + 2, 0, 100);
    D.newProspect(s);
    ZG.Sim.news(s, `🥂 The annual gala raised ${U.money(net)} (cost ${U.money(cost)}). A new major-gift prospect surfaced.`, 'good');
    return { ok: true, msg: `Gala raised ${U.money(net)} on ${U.money(cost)} costs.` };
  };

  D.applyGrant = function (s, idx) {
    if (s.day - s.dev.lastGrant < 60) return { ok: false, msg: 'Your team is still finishing the last application (60-day cooldown).' };
    const g = ZG.NAMES.grants[idx];
    s.dev.lastGrant = s.day;
    ZG.Econ.spend(s, 'admin', 6000);
    let odds = g.odds;
    if (g.needs === 'education') odds *= U.clamp(ZG.Staff.ratio(s, 'education'), 0.4, 1.3) * (s.flags.eduBoost > s.day ? 1.25 : 1);
    if (g.needs === 'conservation') odds *= U.clamp(s.aza / 70, 0.4, 1.3);
    if (g.needs === 'infrastructure') odds *= ZG.Infra.avgCond(s) < 50 ? 1.3 : 0.7;
    odds *= ZG.mod(s, 'fundraising');
    s.dev.grants.push({ name: g.name, amt: U.ri(s, g.amt[0], g.amt[1]), odds: U.clamp(odds, 0.03, 0.9), day: s.day + U.ri(s, 75, 150), infra: g.needs === 'infrastructure' });
    return { ok: true, msg: `Application submitted. Decision in ~3–5 months.` };
  };

  D.newSponsorOffer = function (s) {
    const Z = ZG.zoo(s);
    const taken = new Set(s.sponsors.map((x) => x.name).concat(s.sponsorOffers.map((x) => x.name)));
    const pool = ZG.NAMES.companies.filter((c) => !taken.has(c.name));
    if (!pool.length) return;
    const c = U.pick(s, pool);
    const kind = U.pick(s, ['exhibit', 'exhibit', 'presenting', 'pouring', 'general']);
    const habs = s.habitats.filter((h) => !h.construction && !h.sponsor);
    let hab = null;
    if (kind === 'exhibit' && habs.length) hab = U.pick(s, habs).id;
    const base = Z.sponsorScale * U.rf(s, 0.4, 1.6) * (kind === 'exhibit' ? 1.2 : kind === 'pouring' ? 0.9 : 1) * (0.7 + 0.6 * c.risk) * ZG.mod(s, 'sponsors') * U.clamp(s.rep / 70, 0.6, 1.3);
    s.sponsorOffers.push({
      id: s.nextId++, name: c.name, ind: c.ind, risk: c.risk, kind: kind === 'exhibit' && !hab ? 'general' : kind, hab,
      amount: Math.round(base / 1000) * 1000, years: U.ri(s, 2, 5), expires: s.day + 60,
    });
  };
  D.sponsorKindText = function (o, s) {
    if (o.kind === 'exhibit') return `Naming rights: "${o.name} ${s.habitatsById[o.hab] ? s.habitatsById[o.hab].name : 'Exhibit'}"`;
    if (o.kind === 'presenting') return 'Presenting sponsor of the zoo\'s seasonal events';
    if (o.kind === 'pouring') return 'Exclusive pouring/vendor rights (boosts concessions)';
    return 'General corporate partnership';
  };
  D.acceptSponsor = function (s, oid) {
    const o = s.sponsorOffers.find((x) => x.id === oid);
    if (!o) return { ok: false, msg: 'Gone.' };
    s.sponsorOffers.splice(s.sponsorOffers.indexOf(o), 1);
    s.sponsors.push(Object.assign({}, o, { start: s.day, end: s.day + o.years * 365 }));
    s.stats.sponsorsSigned++;
    if (o.kind === 'exhibit' && s.habitatsById[o.hab]) s.habitatsById[o.hab].sponsor = o.name;
    if (o.kind === 'pouring') s.flags.pouringBoost = 1.04;
    if (o.risk > 0.4 && s.donors) ZG.Donors.react(s, -Math.round(o.risk * 8), (d) => d.trait === 'impact' || d.trait === 'private' || d.interest.kind === 'conservation');
    if (o.risk > 0.55) {
      s.aza = U.clamp(s.aza - o.risk * 4, 0, 100);
      s.rep = U.clamp(s.rep - o.risk * 2, 0, 100);
    }
    ZG.Sim.news(s, `🤝 Signed ${o.name} (${o.ind}) — ${U.money(o.amount)}/yr for ${o.years} years.`, 'good');
    return { ok: true, msg: 'Deal signed.' };
  };
  D.dropSponsor = function (s, name) {
    const sp = s.sponsors.find((x) => x.name === name);
    if (!sp) return;
    s.sponsors.splice(s.sponsors.indexOf(sp), 1);
    if (sp.hab && s.habitatsById[sp.hab]) s.habitatsById[sp.hab].sponsor = null;
    if (sp.kind === 'pouring') s.flags.pouringBoost = 1;
  };

  D.monthly = function (s, t) {
    const devR = ZG.Staff.ratio(s, 'development');
    // Sponsorship payments
    for (const sp of s.sponsors.slice()) {
      if (s.day >= sp.end) {
        D.dropSponsor(s, sp.name);
        ZG.Sim.news(s, `📄 The ${sp.name} sponsorship ended. The development team can look for a renewal.`, 'info');
        continue;
      }
      ZG.Econ.earn(s, 'sponsorships', sp.amount / 12);
    }
    s.sponsorOffers = s.sponsorOffers.filter((o) => o.expires > s.day);
    if (U.rand(s) < 0.3 * devR * ZG.mod(s, 'sponsors')) D.newSponsorOffer(s);
    // Prospects
    for (const p of s.dev.prospects) {
      if (p.cultivating) {
        p.ready = Math.min(100, p.ready + U.ri(s, 5, 11) * Math.min(1.3, devR) * ZG.mod(s, 'fundraising'));
        ZG.Econ.spend(s, 'events', 1500);
      } else p.ready = Math.max(0, p.ready - 1);
    }
    s.dev.prospects = s.dev.prospects.filter((p) => s.day - p.created < 900);
    if (s.dev.prospects.length < 6 && U.rand(s) < 0.22 * devR * ZG.mod(s, 'fundraising')) D.newProspect(s);
    // Campaign progress: ambient campaign giving
    const c = s.dev.campaign;
    if (c) {
      const trickle = c.goal * 0.012 * (1 + (c.momentum || 0)) * devR * U.clamp(s.rep / 70, 0.5, 1.3) * s.economy * ZG.mod(s, 'fundraising');
      ZG.Econ.earn(s, 'donations', trickle, true);
      c.raised += trickle;
      c.momentum = Math.max(0, (c.momentum || 0) * 0.85);
      if (c.raised >= c.goal) {
        s.stats.campaignsDone++;
        s.board = U.clamp(s.board + 10, 0, 100);
        s.rep = U.clamp(s.rep + 3, 0, 100);
        ZG.Events.queue(s, 'campaign_done', { label: c.label, raised: c.raised });
        s.dev.campaign = null;
      } else if (s.day > c.end) {
        ZG.Sim.news(s, `📉 The "${c.label}" campaign closed at ${U.money(c.raised)} of ${U.money(c.goal)}.`, 'bad');
        s.board = U.clamp(s.board - 5, 0, 100);
        s.dev.campaign = null;
      }
    }
  };

  D.daily = function (s) {
    for (let i = s.dev.grants.length - 1; i >= 0; i--) {
      const g = s.dev.grants[i];
      if (s.day >= g.day) {
        s.dev.grants.splice(i, 1);
        if (U.rand(s) < g.odds) {
          ZG.Econ.earn(s, 'grants', g.amt, g.infra);
          s.aza = U.clamp(s.aza + 1, 0, 100);
          ZG.Sim.news(s, `🏆 Awarded! ${g.name}: ${U.money(g.amt)}${g.infra ? ' (restricted to capital repairs)' : ''}.`, 'good');
        } else ZG.Sim.news(s, `📨 ${g.name} application was not funded this cycle.`, 'bad');
      }
    }
  };
})((globalThis.ZG = globalThis.ZG || {}));
