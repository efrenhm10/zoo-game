// Growing the zoo: a strategic master plan (drafted, put out for public comment and
// voted on), buying land for new habitat lots, and opening a second site.
(function (ZG) {
  const U = ZG.U;
  const G = (ZG.Growth = {});
  const $ = (n) => U.money(n);

  G.PRIORITIES = {
    grow: { icon: '🗺️', name: 'Grow the footprint', goal: 'Acquire new land and open it', unlock: 'Unlocks buying land' },
    second: { icon: '🏞️', name: 'Open a second site', goal: 'Open a second site', unlock: 'Unlocks a second campus' },
    backlog: { icon: '🔧', name: 'Fix what we have', goal: 'Cut deferred maintenance by 25%' },
    conservation: { icon: '🌍', name: 'Conservation leadership', goal: 'Fund field conservation at 1.5× the benchmark and reach AZA standing 85' },
    guest: { icon: '🎢', name: 'World-class guest experience', goal: 'Grow annual attendance by 10%' },
    education: { icon: '🎓', name: 'Community & education', goal: 'Host 4 family, science or free community events' },
    finance: { icon: '📈', name: 'Financial sustainability', goal: 'Post two surplus years' },
  };

  G.LAND = {
    honolulu: { name: 'Kapahulu service yard & old parking lot', story: 'The City owns the maintenance yard and overflow parking behind the zoo. Converting it means relocating the yard and replacing parking, and Kapahulu neighbors worry about traffic.', cost: 9e6, days: 300 },
    sandiego: { name: 'Park Boulevard canyon parcel', story: 'A canyon strip along Park Boulevard, added to the zoo through a Balboa Park lease amendment with the City. Steep canyon grading is expensive.', cost: 45e6, days: 360 },
    national: { name: 'Rock Creek hillside tract', story: 'A wooded hillside transferred from the National Park Service. Federal environmental review takes time.', cost: 30e6, days: 420 },
    houston: { name: 'Hermann Park acreage north of the zoo', story: 'Parkland added to the zoo under an amended agreement with the City and the Hermann Park Conservancy.', cost: 22e6, days: 300 },
    cheyenne: { name: 'Adjacent mountainside acreage', story: 'Private land on the mountainside next door. The zoo can buy it outright, but steep terrain makes site work costly.', cost: 16e6, days: 330 },
  };

  G.SECOND = {
    honolulu: {
      public: { name: 'Windward Oʻahu Wildlife Park', story: 'A second, larger campus on City land in Waimānalo with room for big herds, drawing tourists and residents away from crowded Waikīkī.', cost: 45e6, days: 540 },
      conservation: { name: 'Oʻahu Conservation & Breeding Center', story: 'An off-exhibit campus for endangered Hawaiian birds and SSP breeding groups, with no guests, but a big boost to AZA standing.', cost: 12e6, days: 365 },
    },
    houston: {
      public: { name: 'Houston Zoo North', story: 'A drive-through safari campus on the north side, built with the City on greenway land.', cost: 120e6, days: 540 },
      conservation: { name: 'Katy Prairie Conservation Center', story: 'An off-exhibit breeding center for Attwater’s prairie chickens, Houston toads and SSP species.', cost: 25e6, days: 365 },
    },
    national: {
      public: { name: 'Front Royal Safari Campus', story: 'Opening part of the Smithsonian’s Front Royal, Virginia campus to the public, with big herds in open pasture.', cost: 90e6, days: 600 },
      conservation: { name: 'Front Royal Breeding Center Expansion', story: 'New barns and pastures at Front Royal for cheetahs, Przewalski’s horses and other SSP breeding programs.', cost: 30e6, days: 420 },
    },
  };

  G.init = function (s) {
    if (!s.plan) s.plan = { status: 'none', priorities: [], support: 50, meetingLast: -999 };
    if (!s.growth) s.growth = { land: null, second: null };
    if (!s.sites) s.sites = [];
  };

  G.planCost = (s) => Math.round(Math.min(1.5e6, Math.max(250000, ZG.Econ.annualBudget(s) * 0.02)) / 10000) * 10000;
  G.adopted = (s) => s.plan && s.plan.status === 'adopted' && s.day < s.plan.expires;
  G.has = (s, k) => G.adopted(s) && s.plan.priorities.includes(k);
  G.voteGroup = (s) => (['city', 'contract'].includes(s.gov.type) ? 'local' : 'board');
  G.voteBody = (s) => ({ city: 'the City Council', contract: 'the City Council', federal: 'Smithsonian leadership', nonprofit_tax: 'the Board of Trustees', private: 'the Board of Trustees' })[s.gov.type];
  G.costMult = (s) => ZG.zoo(s).costMult;

  // ---------------- Master plan ----------------
  G.commission = function (s, priorities) {
    const p = s.plan;
    if (p.status === 'drafting' || p.status === 'review') return { ok: false, msg: 'A plan is already in progress.' };
    const pr = [...new Set(priorities)].filter((k) => G.PRIORITIES[k]);
    if (pr.length !== 3) return { ok: false, msg: 'Choose exactly three priorities.' };
    if (pr.includes('second') && !G.SECOND[s.zooId]) return { ok: false, msg: 'A second site is not an option for this zoo.' };
    const revise = p.status === 'rejected';
    const cost = revise ? Math.round(G.planCost(s) * 0.3) : G.planCost(s);
    if (!ZG.Econ.canAfford(s, cost)) return { ok: false, msg: `Not enough funds for the ${$(cost)} planning contract.` };
    ZG.Econ.spend(s, 'admin', cost);
    Object.assign(s.plan, { status: 'drafting', priorities: pr, started: s.day, ready: s.day + (revise ? 60 : 150), support: 50, meetingLast: -999, meetings: 0 });
    ZG.Sim.news(s, `🗺️ Planners hired (${$(cost)}) to draft a ${revise ? 'revised ' : ''}strategic master plan: ${pr.map((k) => G.PRIORITIES[k].name).join(', ')}.`, 'info');
    return { ok: true, msg: `Planning underway. A draft will be ready in about ${revise ? 2 : 5} months.` };
  };

  G.meeting = function (s) {
    const p = s.plan;
    if (p.status !== 'review') return { ok: false, msg: 'Community meetings happen during the public comment period.' };
    if (s.day - p.meetingLast < 15) return { ok: false, msg: `Your team is still writing up the last meeting. Try after ${U.fmtDate(p.meetingLast + 15)}.` };
    p.meetingLast = s.day;
    p.meetings = (p.meetings || 0) + 1;
    ZG.Econ.spend(s, 'events', 12000);
    const gain = Math.round(U.rf(s, 3, 8) * (p.meetings > 3 ? 0.5 : 1) * ZG.mod(s, 'media'));
    p.support = U.clamp(p.support + gain, 0, 100);
    const where = U.pick(s, ['a school cafeteria', 'the neighborhood board', 'a church hall', 'the community center', 'an online town hall']);
    const heard = p.priorities.includes('grow') ? 'Neighbors pressed you on traffic and parking.' : p.priorities.includes('second') ? 'People asked whether a second site will drain money from this one.' : 'Most questions were about ticket prices and free days.';
    return { ok: true, msg: `🗣️ Community meeting at ${where}. ${heard} Public support +${gain}.` };
  };

  G.lean = function (s) {
    const p = s.plan;
    let l = (p.support - 50) / 100 + (s.rep - 60) / 250;
    if (p.priorities.includes('grow')) l -= 0.06;
    if (p.priorities.includes('second')) l -= 0.05;
    if (p.priorities.includes('backlog')) l += 0.05;
    if (p.priorities.includes('finance')) l += 0.04;
    return l;
  };

  G.daily = function (s) {
    const p = s.plan;
    if (p.status === 'drafting' && s.day >= p.ready) {
      p.status = 'review';
      p.reviewEnd = s.day + 75;
      p.support = U.clamp(50 + (s.rep - s.rep0) * 0.8 + (s.gov.relationship - 50) * 0.2, 20, 80);
      ZG.Events.queue(s, 'zoo_event_result', { icon: '🗺️', title: 'Draft master plan released', html: `<p>The planners delivered a draft strategic plan built around <b>${p.priorities.map((k) => G.PRIORITIES[k].name).join(', ')}</b>.</p><p>It is now out for <b>public comment until ${U.fmtDate(p.reviewEnd)}</b>, then goes to ${G.voteBody(s)} for a vote. Hold community meetings and ask decision-makers for their support (Government tab) to improve your chances.</p>` });
    }
    if (p.status === 'review' && s.day >= p.reviewEnd) {
      const group = G.voteGroup(s);
      const v = ZG.Officials.vote(s, group, 'plan', G.lean(s));
      ZG.Officials.clear(s, 'plan');
      if (v.passed) {
        p.status = 'adopted';
        p.adopted = s.day;
        p.expires = s.day + 3650;
        p.base = { backlog: ZG.Infra.backlog(s), att: s.att.lastYear, surplus: s.stats.surplusYears, events: s.stats.communityEvents || 0 };
        p.done = {};
        s.board = U.clamp(s.board + 5, 0, 100);
        if (s.donors) ZG.Donors.react(s, 3);
        const unlock = p.priorities.filter((k) => G.PRIORITIES[k].unlock).map((k) => G.PRIORITIES[k].unlock).join(' and ');
        ZG.Events.queue(s, 'zoo_event_result', { icon: '✅', title: 'Strategic plan adopted', html: `<p>${G.voteBody(s)} voted <b>${v.yes}–${v.no}</b> to adopt your master plan. It guides the zoo for ten years.</p>${unlock ? `<p><b>${unlock}</b> (Habitats tab → Grow the zoo).</p>` : ''}<p>Donors, grant makers and politicians respond better to a zoo with a plan. Hit the plan's goals for extra confidence from your boss.</p>` });
        ZG.Sim.news(s, `✅ Strategic master plan adopted (${v.yes}–${v.no}).`, 'good');
      } else {
        p.status = 'rejected';
        s.board = U.clamp(s.board - 3, 0, 100);
        ZG.Events.queue(s, 'zoo_event_result', { icon: '❌', title: 'Master plan voted down', html: `<p>${G.voteBody(s)} rejected the plan <b>${v.yes}–${v.no}</b>. Critics called it ${p.priorities.includes('grow') || p.priorities.includes('second') ? 'too expensive and too ambitious' : 'vague'}.</p><p>You can commission a revision at 30% of the original cost, with different priorities if you like.</p>` });
        ZG.Sim.news(s, `❌ The master plan was voted down (${v.yes}–${v.no}).`, 'bad');
      }
    }
    // Land acquisition & second-site construction
    const L = s.growth.land;
    if (L && L.status === 'acquiring' && s.day >= L.done) G.finishLand(s);
    const S2 = s.growth.second;
    if (S2 && S2.status === 'building' && s.day >= S2.done) G.finishSecond(s);
  };

  G.goalProgress = function (s) {
    const p = s.plan;
    if (!G.adopted(s)) return [];
    const b = p.base || {};
    return p.priorities.map((k) => {
      let pct = 0;
      if (k === 'grow') pct = s.growth.land && s.growth.land.status === 'done' ? 1 : s.growth.land ? 0.5 : 0;
      if (k === 'second') pct = s.growth.second && s.growth.second.status === 'open' ? 1 : s.growth.second ? 0.5 : 0;
      if (k === 'backlog') pct = b.backlog ? U.clamp((b.backlog - ZG.Infra.backlog(s)) / (b.backlog * 0.25), 0, 1) : 0;
      if (k === 'conservation') pct = Math.min(1, s.policy.conservation / (ZG.zoo(s).refs.conservation * 1.5)) * 0.5 + Math.min(1, s.aza / 85) * 0.5;
      if (k === 'guest') pct = b.att ? U.clamp((s.att.lastYear / b.att - 1) / 0.1, 0, 1) : 0;
      if (k === 'education') pct = Math.min(1, ((s.stats.communityEvents || 0) - (b.events || 0)) / 4);
      if (k === 'finance') pct = Math.min(1, (s.stats.surplusYears - (b.surplus || 0)) / 2);
      return { k, pct, done: pct >= 1 };
    });
  };

  G.monthly = function (s, t) {
    if (t && t.m === 0) for (const site of s.sites) site.ytd = 0;
    if (!G.adopted(s)) {
      G.siteCosts(s);
      return;
    }
    const p = s.plan;
    for (const g of G.goalProgress(s)) {
      if (g.done && !p.done[g.k]) {
        p.done[g.k] = s.day;
        s.board = U.clamp(s.board + 3, 0, 100);
        s.rep = U.clamp(s.rep + 1, 0, 100);
        ZG.Sim.news(s, `🎯 Strategic plan goal met: ${G.PRIORITIES[g.k].goal}.`, 'good');
      }
    }
    G.siteCosts(s);
  };

  // Running costs (and the AZA boost) of a second site.
  G.siteCosts = function (s) {
    for (const site of s.sites) {
      const habs = s.habitats.filter((h) => h.site === site.id && !h.construction);
      const stocked = habs.filter((h) => s.animals.some((a) => a.hab === h.id)).length;
      if (site.kind === 'conservation') {
        s.aza = U.clamp(s.aza + 0.3 + stocked * 0.15, 0, 100);
        ZG.Econ.spend(s, 'overhead', ZG.Econ.annualBudget(s) * 0.025 / 12);
      } else {
        ZG.Econ.spend(s, 'overhead', ZG.Econ.annualBudget(s) * 0.06 / 12);
      }
    }
  };

  // Daily guests & revenue at a public second site.
  G.siteDaily = function (s, t) {
    const Z = ZG.zoo(s);
    for (const site of s.sites) {
      if (site.kind !== 'public' || s.closure) continue;
      const habs = s.habitats.filter((h) => h.site === site.id && !h.construction);
      let appeal = 0;
      for (const h of habs) appeal += ZG.Habitats.appeal(s, h);
      if (!appeal) continue;
      const seasonAvg = Z.season.reduce((a, b) => a + b, 0) / 12;
      const guests = Math.round((Z.baseAttendance / 365) * 0.35 * Math.min(1.4, appeal / Math.max(1, s.appeal0 * 0.3)) * (Z.season[t.m] / seasonAvg) * U.rf(s, 0.8, 1.2));
      site.today = guests;
      site.ytd = (site.ytd || 0) + guests;
      const price = Z.priceLocked ? 25 : s.policy.admission;
      ZG.Econ.earn(s, 'admissions', guests * price * Math.max(0.5, Z.yieldAdm || 0.6));
      ZG.Econ.earn(s, 'concessions', guests * Z.perCap * 0.8);
      ZG.Econ.spend(s, 'cogs', guests * Z.perCap * 0.8 * Z.cogs);
    }
  };

  // ---------------- Land ----------------
  G.landCost = (s) => Math.round(G.LAND[s.zooId].cost * (s.zooId === 'honolulu' ? 1 : 1) / 10000) * 10000;
  G.buyLand = function (s) {
    if (!G.has(s, 'grow')) return { ok: false, msg: 'Your adopted strategic plan must include “Grow the footprint.”' };
    if (s.growth.land) return { ok: false, msg: 'You have already expanded the grounds.' };
    const cost = G.landCost(s);
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: `Not enough funds: ${$(cost)} needed (capital fund, cash and credit). Launch a capital campaign or ask the state.` };
    ZG.Econ.spendCapital(s, 'construction', cost);
    const L = G.LAND[s.zooId];
    const days = Math.round(L.days * (['city', 'federal'].includes(s.gov.type) ? 1.15 : 1));
    s.growth.land = { status: 'acquiring', started: s.day, done: s.day + days, cost };
    ZG.Sim.news(s, `🗺️ Deal signed for the ${L.name} (${$(cost)}). Permits, demolition and grading will take about ${Math.round(days / 30)} months.`, 'info');
    return { ok: true, msg: `Land acquisition underway. Three new habitat lots open in about ${Math.round(days / 30)} months.` };
  };

  // Adds a new row of three large lots behind (north of) the existing grounds.
  G.finishLand = function (s) {
    const Lay = s.layout;
    const rowH = 250;
    const y0 = Lay.ys[0] - rowH;
    Lay.ext = { y0, y1: Lay.ys[0], xs: [Lay.xs[0], Lay.xs[2], Lay.xs[4], Lay.xs[6]] };
    const Z = ZG.zoo(s);
    for (let i = 0; i < 3; i++) {
      const x = Lay.ext.xs[i] + Lay.P / 2, y = y0 + Lay.P / 2;
      const w = Lay.ext.xs[i + 1] - Lay.ext.xs[i] - Lay.P, h = rowH - Lay.P;
      s.plots.push({ id: s.plots.length, c: i, r: -1, x, y, w, h, kind: 'habitat', px: w * h, area: Math.round((Z.avgPlot * 1.4) / 50) * 50, hab: null, ext: true });
    }
    s.layoutV = (s.layoutV || 0) + 1;
    s.growth.land.status = 'done';
    s.growth.land.opened = s.day;
    s.board = U.clamp(s.board + 4, 0, 100);
    s.novelty = Math.min(0.8, s.novelty + 0.05);
    ZG.Events.queue(s, 'zoo_event_result', { icon: '🗺️', title: 'New land is ready', html: `<p>The ${G.LAND[s.zooId].name} is graded, fenced and connected to the path network. <b>Three large new habitat lots</b> are open at the back of the zoo.</p><p>Click one on the map or in the Habitats tab to meet with the architect.</p>` });
  };

  // ---------------- Second site ----------------
  G.secondOptions = (s) => G.SECOND[s.zooId] || null;
  G.startSecond = function (s, kind) {
    if (!G.has(s, 'second')) return { ok: false, msg: 'Your adopted strategic plan must include “Open a second site.”' };
    if (s.growth.second) return { ok: false, msg: 'A second site is already underway.' };
    const o = (G.secondOptions(s) || {})[kind];
    if (!o) return { ok: false, msg: 'Not available.' };
    const cost = o.cost;
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: `Not enough funds: ${$(cost)} needed. Launch a capital campaign, ask the state or your partner organization.` };
    ZG.Econ.spendCapital(s, 'construction', cost);
    const days = Math.round(o.days * (['city', 'federal'].includes(s.gov.type) ? 1.15 : 1));
    s.growth.second = { status: 'building', kind, name: o.name, started: s.day, done: s.day + days, cost };
    ZG.Sim.news(s, `🏗️ Ground broken on ${o.name} (${$(cost)}), opening in about ${Math.round(days / 30)} months.`, 'good');
    return { ok: true, msg: `${o.name} is under construction. It opens in about ${Math.round(days / 30)} months.` };
  };

  G.finishSecond = function (s) {
    const S2 = s.growth.second;
    const Z = ZG.zoo(s);
    const site = { id: s.sites.length + 2, name: S2.name, kind: S2.kind, opened: s.day, ytd: 0 };
    s.sites.push(site);
    const n = S2.kind === 'public' ? 4 : 3;
    for (let i = 0; i < n; i++) {
      s.plots.push({ id: s.plots.length, c: i, r: -9, x: -9999, y: -9999, w: 220, h: 200, kind: 'habitat', px: 44000, area: Math.round((Z.avgPlot * (S2.kind === 'public' ? 2 : 1.3)) / 50) * 50, hab: null, site: site.id });
    }
    S2.status = 'open';
    s.board = U.clamp(s.board + 6, 0, 100);
    s.rep = U.clamp(s.rep + 3, 0, 100);
    if (S2.kind === 'conservation') s.aza = U.clamp(s.aza + 5, 0, 100);
    ZG.Events.queue(s, 'zoo_event_result', { icon: '🏞️', title: `${S2.name} is open`, html: `<p>Ribbon cut! ${S2.kind === 'public' ? `<b>${n} large habitat sites</b> are ready for animals. Guests come once they are stocked.` : `<b>${n} off-exhibit breeding complexes</b> are ready for SSP animals. Your AZA standing is up.`}</p><p>Find them in the Habitats tab under <b>${S2.name}</b>, and design habitats there with your architect.</p>` });
  };

  // Plan-driven boosts used elsewhere in the sim.
  G.fundBoost = (s) => (G.adopted(s) ? 1.15 : 1);
})((globalThis.ZG = globalThis.ZG || {}));
