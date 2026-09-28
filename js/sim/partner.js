// Your partner organization: a zoological society / friends group, or the endowment
// and its finance committee. It has its own money, its own board and its own
// feelings about you. You can ask it to cover a gap, raise more, or fund a project.
(function (ZG) {
  const U = ZG.U;
  const PT = (ZG.Partner = {});
  const $ = (n) => U.money(n);

  PT.DEFS = {
    honolulu: { name: 'Honolulu Zoo Society', kind: 'society', head: 'Executive Director', reserves: 3.2e6, tension: 'The Society raises money for the zoo but answers to its own board. It has long wanted more say in how the City spends its donations.' },
    national: { name: 'Friends of the National Zoo (FONZ)', kind: 'society', head: 'Executive Director', reserves: 12e6, tension: 'FONZ runs membership and fundraising for the zoo. It is protective of its donors and its brand.' },
    houston: { name: 'Houston Zoo Endowment (Finance Committee)', kind: 'endowment', head: 'Finance Committee Chair', reserves: 60e6, tension: 'The endowment pays out a fixed share each year. Extra draws need the Finance Committee to agree, and they hate eroding principal.' },
    sandiego: { name: 'San Diego Zoo Wildlife Alliance Endowment', kind: 'endowment', head: 'Investment Committee Chair', reserves: 250e6, tension: 'A large endowment with strict payout rules. Special draws are rare and closely watched.' },
    cheyenne: { name: 'Cheyenne Mountain Zoo Endowment', kind: 'endowment', head: 'Finance Committee Chair', reserves: 25e6, tension: 'With no tax support, the endowment is the rainy-day fund. Trustees guard it closely.' },
  };
  PT.GAP = 30;

  PT.init = function (s) {
    const d = PT.DEFS[s.zooId];
    const Z = ZG.zoo(s);
    s.partner = { rel: U.ri(s, 50, 66), reserves: d.reserves, annual: Math.round(Z.donorBase * 0.15), lastMet: -9999, lastAsk: -9999, appeal: null, headName: `${U.pick(s, ZG.NAMES.donorFirst)} ${U.pick(s, ZG.NAMES.donorLast)}` };
  };
  PT.def = (s) => PT.DEFS[s.zooId];
  const bump = (s, v) => (s.partner.rel = U.clamp(s.partner.rel + v, 0, 100));
  PT.mood = (r) => (r >= 75 ? 'Close partners' : r >= 60 ? 'Good terms' : r >= 45 ? 'Businesslike' : r >= 30 ? 'Strained' : 'Hostile');

  PT.BUILD = {
    meet: { icon: '☕', name: 'Meet with the', cost: 0, rel: 4 },
    board: { icon: '📊', name: 'Present at their board meeting', cost: 0, rel: 6 },
    members: { icon: '🎉', name: 'Co-host a members’ night', cost: 15000, rel: 7 },
  };

  PT.build = function (s, kind) {
    const p = s.partner, B = PT.BUILD[kind], d = PT.def(s);
    if (!B) return { ok: false, msg: 'Not available.' };
    if (s.day - p.lastMet < PT.GAP) return { ok: false, msg: `You met with them recently. Try after ${U.fmtDate(p.lastMet + PT.GAP)}.` };
    p.lastMet = s.day;
    if (B.cost) ZG.Econ.spend(s, 'events', B.cost);
    let g = B.rel;
    const notes = [];
    if (kind === 'board') {
      const net = ZG.Officials.recentNet(s);
      if (net < 0) (g -= 3), notes.push('They grilled you about the deficit.');
      if (ZG.Animals.avgWelfare(s) > 72) (g += 2), notes.push('Your welfare numbers landed well.');
    }
    if (kind === 'members') {
      s.members += Math.round(s.members * 0.004);
      notes.push('A few hundred members came out, and some upgraded.');
    }
    g = Math.round(g * U.rf(s, 0.8, 1.2));
    bump(s, g);
    return { ok: true, msg: `${B.icon} ${kind === 'meet' ? `Met with ${p.headName}, ${d.head}` : B.name}. Relationship +${g}. ${notes.join(' ')}`.trim() };
  };

  // What you can ask for, and what it would take.
  PT.asks = function (s) {
    const p = s.partner, d = PT.def(s), Z = ZG.zoo(s);
    const month = ZG.Econ.annualBudget(s) / 12;
    const coverCap = d.kind === 'society' ? p.reserves * 0.35 : p.reserves * 0.04;
    const need = s.cash < 0 ? -s.cash : month * 0.5;
    return [
      { id: 'cover', name: s.cash < 0 ? 'Can you cover our cash shortfall?' : 'Can you cover an emergency expense?', amount: Math.round(Math.min(need, coverCap) / 1000) * 1000, text: d.kind === 'society' ? 'An emergency grant from their reserves.' : 'A special draw from the endowment beyond the normal payout.', rel: -7 },
      { id: 'appeal', name: 'Can you raise more money for us?', amount: Math.round(Z.donorBase * (d.kind === 'society' ? 0.12 : 0.05) / 1000) * 1000, text: 'They run a special appeal to their members and donors. The money arrives in about two months.', rel: -2 },
      { id: 'project', name: 'Will you fund a capital project?', amount: Math.round(Math.min(Z.majorGiftScale * 1.5, d.kind === 'society' ? p.reserves * 0.5 : p.reserves * 0.03) / 10000) * 10000, text: 'A restricted grant to the capital fund for repairs or a new habitat.', rel: -5 },
    ];
  };

  PT.odds = function (s, a) {
    const p = s.partner, d = PT.def(s);
    let o = p.rel / 100 - 0.1;
    if (a.id === 'cover') o += s.cash < 0 ? 0.1 : -0.1;
    if (a.id === 'appeal') o += 0.15;
    if (a.id === 'project') o -= 0.1;
    if (d.kind === 'endowment') o += (s.board - 55) / 150;
    if (a.amount > p.reserves * 0.5) o -= 0.4;
    if (s.day - p.lastAsk < 180) o -= 0.25;
    o += (s.rep - s.rep0) / 200;
    return U.clamp(o, 0.03, 0.92);
  };

  PT.ask = function (s, id) {
    const p = s.partner, d = PT.def(s);
    const a = PT.asks(s).find((x) => x.id === id);
    if (!a || a.amount <= 0) return { ok: false, msg: 'There is nothing to ask for.' };
    if (id === 'appeal' && p.appeal) return { ok: false, msg: 'They are already running an appeal for you.' };
    if (s.day - p.lastAsk < 60) return { ok: false, msg: `You asked them for money recently. Wait until ${U.fmtDate(p.lastAsk + 60)}.` };
    const odds = PT.odds(s, a);
    p.lastAsk = s.day;
    const pct = Math.round(odds * 100);
    if (U.rand(s) < odds) {
      bump(s, a.rel);
      if (id === 'appeal') {
        p.appeal = { day: s.day + U.ri(s, 50, 75), target: a.amount };
        ZG.Sim.news(s, `📬 ${d.name} agreed to run an emergency appeal for the zoo.`, 'good');
        return { ok: true, msg: `${d.name} will run an appeal. Results in about two months. (Odds were ${pct}%.)` };
      }
      p.reserves -= a.amount;
      ZG.Econ.earn(s, id === 'project' ? 'grants' : 'donations', a.amount, id === 'project');
      if (d.kind === 'endowment' && id === 'cover') s.board = U.clamp(s.board - 2, 0, 100);
      ZG.Sim.news(s, `🤝 ${d.name} came through with ${$(a.amount)}${id === 'project' ? ' for the capital fund' : ''}.`, 'good');
      return { ok: true, msg: `Yes: ${$(a.amount)} from ${d.name}. It cost some goodwill (relationship ${a.rel}). (Odds were ${pct}%.)` };
    }
    bump(s, -3);
    const why = p.rel < 45 ? 'They said their board “has concerns about how funds are being managed.”' : a.amount > p.reserves * 0.5 ? 'They said they simply don’t have that much to give.' : 'They said the timing is bad and to come back later.';
    return { ok: true, msg: `${d.name} said no. ${why} (Odds were ${pct}%.)` };
  };

  PT.monthly = function (s, t) {
    const p = s.partner, d = PT.def(s), Z = ZG.zoo(s);
    // Quarterly support grant, scaled by how the relationship feels.
    if (t.m % 3 === 0) {
      const f = U.clamp(0.35 + p.rel / 100, 0.4, 1.3);
      ZG.Econ.earn(s, 'donations', Math.round((p.annual / 4) * f));
    }
    // Their own fundraising refills reserves; endowments earn investment returns.
    p.reserves += d.kind === 'society' ? Z.donorBase * 0.01 * s.economy : p.reserves * (0.005 + (s.economy - 1) * 0.02);
    if (s.day - p.lastMet > 90) bump(s, -1);
    bump(s, (45 + (s.rep - s.rep0) * 0.5 - p.rel) * 0.02);
    if (p.appeal && s.day >= p.appeal.day) {
      const got = Math.round(p.appeal.target * U.rf(s, 0.6, 1.3) * U.clamp(s.rep / s.rep0, 0.6, 1.3) * s.economy / 1000) * 1000;
      ZG.Econ.earn(s, 'donations', got);
      if (s.dev.campaign) s.dev.campaign.raised += 0;
      ZG.Sim.news(s, `📬 ${d.name}'s appeal raised ${$(got)} for the zoo.`, 'good');
      p.appeal = null;
    }
    // A strained partner makes trouble.
    if (p.rel < 30 && U.chance(s, 0.08)) {
      ZG.Sim.news(s, `📰 ${d.name}'s board publicly questioned the zoo's leadership.`, 'bad');
      s.board = U.clamp(s.board - 3, 0, 100);
      s.rep = U.clamp(s.rep - 1, 0, 100);
    }
  };
})((globalThis.ZG = globalThis.ZG || {}));
