// Government relations: city budget cycles, federal appropriations & shutdowns,
// management-fee contracts, charter levies, fee ordinances and elections.
(function (ZG) {
  const U = ZG.U;
  const P = (ZG.Politics = {});

  P.init = function (s) {
    const Z = ZG.zoo(s);
    s.gov = {
      type: Z.governance,
      appropriation: Z.appropriation,
      relationship: Z.startRelationship,
      request: null,
      nextApprop: null,
      shutdown: false,
      owed: 0,
      feeProposal: null,
      contractYear: 2029,
      shortHours: false,
      mayor: 'neutral',
    };
  };

  P.odds = function (s, bump, key) {
    const g = s.gov;
    if (key && s.officials) bump += ZG.Officials.support(s, g.type === 'federal' ? 'federal' : 'local', key) * 0.3;
    if (ZG.Growth && ZG.Growth.adopted(s)) bump += 0.04; // a credible plan helps budget asks
    return U.clamp(0.35 + (g.relationship - 50) / 110 + (s.rep - 60) / 220 + (s.economy - 1) * 1.6 + ZG.mod(s, 'politics') / 100 + (g.mayor === 'supportive' ? 0.08 : g.mayor === 'austerity' ? -0.1 : 0) + bump, 0.04, 0.95);
  };

  P.monthly = function (s, t) {
    const g = s.gov;
    const Z = ZG.zoo(s);
    // Funding arrives monthly
    if (g.appropriation > 0) {
      if (g.type === 'federal' && g.shutdown) g.owed += g.appropriation / 12;
      else ZG.Econ.earn(s, 'government', g.appropriation / 12);
    }
    // Slow relationship drift toward neutral-ish, nudged by reputation
    g.relationship += ((45 + (s.rep - 60) * 0.4) - g.relationship) * 0.03;

    if (g.type === 'city') {
      if (t.m === 1) ZG.Events.queue(s, 'budget_request', {});
      if (t.m === 4 && g.request) P.resolveRequest(s);
      if (t.m === Z.fyStart && g.nextApprop != null) {
        g.appropriation = g.nextApprop;
        g.nextApprop = null;
        ZG.Sim.news(s, `🏛️ New fiscal year: the City's zoo subsidy is now ${U.money(g.appropriation)}/yr.`, 'info');
      }
      if (t.m === 10 && (t.y === 2028 || t.y === 2032)) ZG.Events.queue(s, 'election', {});
    } else if (g.type === 'federal') {
      if (t.m === 2) ZG.Events.queue(s, 'budget_request', {});
      if (t.m === 9) P.federalDeadline(s);
      if (t.m === 10 && (t.y === 2028 || t.y === 2030 || t.y === 2032)) ZG.Events.queue(s, 'election', {});
    } else if (g.type === 'contract') {
      if (t.m === Z.fyStart && !s.flags.noEscalator) {
        g.appropriation = Math.round(g.appropriation * 1.02);
        ZG.Sim.news(s, `🏛️ City management fee escalates 2% under the agreement: ${U.money(g.appropriation)}/yr.`, 'info');
      }
      if (t.m === 2 && t.y === g.contractYear) ZG.Events.queue(s, 'contract_renewal', {});
    } else if (g.type === 'nonprofit_tax') {
      if (t.m === Z.fyStart) {
        const growth = 0.015 + (s.economy - 1) * 0.5 + U.rf(s, -0.01, 0.02);
        g.appropriation = Math.round(g.appropriation * (1 + growth));
        ZG.Sim.news(s, `🏛️ Property values ${growth >= 0 ? 'rose' : 'fell'} — the Charter zoo levy will bring in ${U.money(g.appropriation)} this year.`, 'info');
      }
    }
    // Pending fee ordinance
    if (g.feeProposal && s.day >= g.feeProposal.day) P.resolveFee(s);
  };

  P.makeRequest = function (s, kind) {
    const g = s.gov;
    const backlog = ZG.Infra.backlog(s);
    const base = g.appropriation;
    const opts = {
      flat: { ask: base, capital: 0, bump: 0.45 },
      modest: { ask: base * 1.06, capital: 0, bump: 0.18 },
      bold: { ask: base * 1.15, capital: Math.round(backlog * 0.25), bump: -0.08 },
      campaign: { ask: base * 1.15, capital: Math.round(backlog * 0.25), bump: 0.1 },
    };
    const o = opts[kind];
    g.request = { kind, ask: Math.round(o.ask), capital: o.capital, p: P.odds(s, o.bump), base, bump: o.bump };
    return g.request;
  };

  P.resolveRequest = function (s) {
    const g = s.gov;
    const r = g.request;
    g.request = null;
    if (r.bump != null) r.p = P.odds(s, r.bump, 'budget'); // lining up supporters since filing counts
    ZG.Officials.clear(s, 'budget');
    const roll = U.rand(s);
    let outcome;
    if (roll < r.p) outcome = 'full';
    else if (roll < r.p + (1 - r.p) * 0.5) outcome = 'partial';
    else outcome = 'cut';
    if (r.kind === 'flat' && outcome !== 'cut') outcome = 'full';
    let approp = r.base, capital = 0;
    if (outcome === 'full') {
      approp = r.ask;
      capital = r.capital;
    } else if (outcome === 'partial') {
      approp = Math.round(r.base + (r.ask - r.base) * 0.4);
      capital = Math.round(r.capital * 0.3);
    } else {
      approp = Math.round(r.base * (s.economy < 0.95 ? 0.93 : 0.97));
    }
    if (approp > r.base * 1.01) s.stats.budgetWins++;
    if (capital > 0) {
      s.stats.capitalWins = (s.stats.capitalWins || 0) + 1;
      ZG.Econ.earn(s, 'government', capital, true);
    }
    if (s.gov.type === 'federal') g.pendingFederal = approp;
    else g.nextApprop = approp;
    g.relationship = U.clamp(g.relationship + (outcome === 'full' ? 3 : outcome === 'cut' ? -3 : 0), 0, 100);
    ZG.Events.queue(s, 'budget_decision', { outcome, approp, base: r.base, capital, kind: r.kind });
  };

  P.federalDeadline = function (s) {
    const g = s.gov;
    if (g.request) P.resolveRequest(s);
    const pShutdown = 0.2 + (s.economy < 0.95 ? 0.08 : 0);
    if (U.rand(s) < pShutdown) {
      const days = U.ri(s, 6, 38);
      g.shutdown = true;
      g.shutdownDays = days;
      s.closure = { reason: 'Federal government shutdown', days: 9999 };
      ZG.Events.queue(s, 'shutdown', { days });
    } else {
      const ap = g.pendingFederal;
      g.pendingFederal = null;
      if (ap != null) {
        if (U.chance(s, 0.35)) {
          ZG.Sim.news(s, '🏛️ Congress passed a Continuing Resolution — funding stays flat at last year\'s level for now.', 'info');
        } else {
          g.appropriation = ap;
          ZG.Sim.news(s, `🏛️ Full-year appropriation enacted: ${U.money(ap)}/yr.`, 'info');
        }
      }
    }
  };

  P.daily = function (s) {
    const g = s.gov;
    if (g.shutdown) {
      g.shutdownDays--;
      if (g.shutdownDays <= 0) {
        g.shutdown = false;
        s.closure = null;
        ZG.Econ.earn(s, 'government', g.owed);
        ZG.Sim.news(s, `🏛️ The shutdown is over! Gates reopen and back pay/funding (${U.money(g.owed)}) is restored.`, 'good');
        g.owed = 0;
        s.stats.shutdownsSurvived = (s.stats.shutdownsSurvived || 0) + 1;
        if (g.pendingFederal) {
          g.appropriation = g.pendingFederal;
          g.pendingFederal = null;
        }
        s.novelty = Math.min(0.8, s.novelty + 0.1);
      }
    }
  };

  P.proposeFee = function (s, price) {
    const g = s.gov;
    if (g.feeProposal) return { ok: false, msg: 'A fee ordinance is already before the Council.' };
    g.feeProposal = { price, day: s.day + U.ri(s, 50, 80), from: s.policy.admission };
    return { ok: true, msg: `Fee ordinance ($${price}) introduced at City Council. Vote in ~2 months.` };
  };
  P.resolveFee = function (s) {
    const g = s.gov;
    const f = g.feeProposal;
    g.feeProposal = null;
    const change = (f.price - f.from) / Math.max(1, f.from);
    // The Council votes member by member; price hikes cost votes.
    const v = ZG.Officials.vote(s, 'local', 'fee', 0.12 - Math.max(0, change) * 1.2);
    ZG.Officials.clear(s, 'fee');
    const tally = ` (vote ${v.yes}–${v.no})`;
    if (v.passed) {
      s.policy.admission = f.price;
      if (change > 0) g.relationship = U.clamp(g.relationship - 2, 0, 100);
      ZG.Sim.news(s, `🏛️ City Council approved the zoo fee ordinance${tally}: admission is now $${f.price}.`, 'good');
    } else {
      g.relationship = U.clamp(g.relationship - 1, 0, 100);
      ZG.Sim.news(s, `🏛️ City Council voted down the fee ordinance ($${f.price})${tally}. Admission stays at $${f.from}.`, 'bad');
    }
  };
})((globalThis.ZG = globalThis.ZG || {}));
