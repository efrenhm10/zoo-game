// Gift shops & merchandise: pricing, product lines, the store itself, local-brand
// collaborations and limited-edition drops.
(function (ZG) {
  const U = ZG.U;
  const MR = (ZG.Merch = {});
  const $ = (n) => U.money(n);

  MR.RETAIL_SHARE = 0.35; // share of the zoo's per-capita spend that is retail rather than food

  MR.PRICES = {
    value: { name: 'Value', rev: 0.94, cogs: 1.1, sat: 1, desc: 'Cheaper souvenirs. Families are happy, margins are thin.' },
    standard: { name: 'Standard', rev: 1, cogs: 1, sat: 0, desc: 'Typical zoo gift-shop pricing.' },
    premium: { name: 'Premium', rev: 1.08, cogs: 0.84, sat: -1.5, desc: 'Higher prices and better margins. Some guests grumble.' },
  };

  // share = part of baseline retail; setup = one-time cost; monthly = running cost.
  MR.LINES = {
    plush: { icon: '🧸', name: 'Plush animals', share: 0.42, cogs: 1, desc: 'The best seller. Sales spike when there is a new baby.' },
    apparel: { icon: '👕', name: 'T-shirts & hats', share: 0.33, cogs: 1, desc: 'Steady sellers with the zoo logo.' },
    toys: { icon: '🪀', name: 'Kids’ toys & books', share: 0.25, cogs: 1, desc: 'Impulse buys at the checkout.' },
    local: { icon: '🌺', name: 'Local artisan goods', share: 0.1, cogs: 1.2, setup: 20000, rep: 0.3, desc: 'Crafts from local makers. Good for the community and your reputation.' },
    eco: { icon: '♻️', name: 'Eco & conservation line', share: 0.07, cogs: 1.1, setup: 25000, rep: 0.2, aza: 0.2, desc: 'Recycled materials, with a share going to field conservation.' },
    photo: { icon: '📸', name: 'Souvenir photos', share: 0.08, cogs: 0.4, setup: 40000, desc: 'Keeper-encounter photos and green-screen shots. High margin.' },
    online: { icon: '🛒', name: 'Online store', share: 0, setup: 60000, monthly: 3500, desc: 'Sells to members and fans who aren’t visiting today.' },
  };

  MR.STORES = [
    { name: 'Tired gift shop', mult: 1, cost: 0 },
    { name: 'Renovated gift shop', mult: 1.15, cost: 450000 },
    { name: 'Flagship store', mult: 1.32, cost: 1400000 },
  ];

  const BRANDS = {
    honolulu: [
      { name: 'Aloha Print Works', ind: 'aloha shirts & prints', fee: 30000, boost: 0.14 },
      { name: 'Kapahulu Surf Supply', ind: 'surf & beachwear', fee: 25000, boost: 0.11 },
      { name: 'Kona Bean Roasters', ind: 'coffee', fee: 20000, boost: 0.08 },
    ],
    sandiego: [
      { name: 'Pacific Swell Surfwear', ind: 'surfwear', fee: 180000, boost: 0.12 },
      { name: 'North Park Coffee Roasters', ind: 'coffee', fee: 90000, boost: 0.07 },
      { name: 'Mission Bay Brewing', ind: 'craft beer', fee: 120000, boost: 0.09, adult: true },
    ],
    national: [
      { name: 'Potomac Print Shop', ind: 'posters & stationery', fee: 60000, boost: 0.1 },
      { name: 'Rock Creek Coffee', ind: 'coffee', fee: 50000, boost: 0.07 },
      { name: 'Capitol Hill Candle Co.', ind: 'candles & gifts', fee: 40000, boost: 0.06 },
    ],
    houston: [
      { name: 'Bayou City Outfitters', ind: 'apparel', fee: 80000, boost: 0.12 },
      { name: 'H-Town Hot Sauce Co.', ind: 'hot sauce', fee: 40000, boost: 0.07 },
      { name: 'Third Coast Brewing', ind: 'craft beer', fee: 70000, boost: 0.09, adult: true },
    ],
    cheyenne: [
      { name: 'Pikes Peak Outdoor Co.', ind: 'outdoor gear', fee: 50000, boost: 0.13 },
      { name: 'Front Range Roasters', ind: 'coffee', fee: 30000, boost: 0.07 },
      { name: 'Manitou Mountain Tees', ind: 'graphic tees', fee: 25000, boost: 0.09 },
    ],
  };
  MR.brands = (s) => BRANDS[s.zooId] || [];

  MR.init = function (s) {
    s.merch = { price: 'standard', lines: { plush: true, apparel: true, toys: true }, store: 0, collab: null, drop: null, hype: 0, owned: {} };
  };

  MR.mult = function (s) {
    const m = s.merch;
    let share = 0, cogsW = 0;
    for (const k in m.lines) {
      if (!m.lines[k]) continue;
      const L = MR.LINES[k];
      let sh = L.share;
      if (k === 'plush' && (s.flags.plushBoost > s.day || s.animals.some((a) => a.age < 180 && ZG.SPECIES[a.sp].appeal >= 6))) sh *= 1.35;
      share += sh;
      cogsW += sh * (L.cogs || 1);
    }
    const P = MR.PRICES[m.price];
    const collab = m.collab && m.collab.until > s.day ? m.collab.boost : 0;
    const drop = m.drop && m.drop.until > s.day ? m.drop.boost : 0;
    const rev = share * P.rev * MR.STORES[m.store].mult * (1 + collab + drop + (m.hype || 0));
    const cogs = (share ? cogsW / share : 1) * P.cogs;
    return { rev, cogs };
  };

  // Called from the daily economy with that day's retail base (guests × per-cap × spend factor × retail share).
  MR.daily = function (s, base, zooCogs) {
    const m = s.merch;
    const x = MR.mult(s);
    const rev = base * x.rev;
    ZG.Econ.earn(s, 'retail', rev);
    ZG.Econ.spend(s, 'cogs', rev * zooCogs * x.cogs);
    if (m.collab && m.collab.until > s.day) ZG.Econ.spend(s, 'cogs', rev * 0.04); // royalty to the brand
    if (m.hype) m.hype = Math.max(0, m.hype - 0.004);
  };

  MR.monthly = function (s) {
    const m = s.merch, Z = ZG.zoo(s);
    if (m.lines.online) {
      ZG.Econ.spend(s, 'cogs', MR.LINES.online.monthly);
      const orders = s.members * 0.05 * (1 + (m.hype || 0) * 2) * MR.PRICES[m.price].rev;
      const avg = 38;
      ZG.Econ.earn(s, 'retail', orders * avg);
      ZG.Econ.spend(s, 'cogs', orders * avg * Z.cogs);
    }
    if (m.lines.eco) ZG.Econ.spend(s, 'conservation', 800);
    for (const k of ['local', 'eco']) if (m.lines[k]) s.rep = U.clamp(s.rep + (MR.LINES[k].rep || 0) * 0.2, 0, 100);
    if (m.collab && m.collab.until <= s.day) {
      ZG.Sim.news(s, `🏷️ The ${m.collab.name} collaboration has ended.`, 'info');
      m.collab = null;
    }
    if (m.drop && m.drop.until <= s.day) m.drop = null;
    m.pendingCollab = null;
  };

  MR.setPrice = function (s, p) {
    if (!MR.PRICES[p]) return null;
    s.merch.price = p;
    return { ok: true, msg: `Merchandise pricing set to ${MR.PRICES[p].name}.` };
  };

  MR.toggleLine = function (s, k) {
    const L = MR.LINES[k], m = s.merch;
    if (!L) return null;
    if (m.lines[k]) {
      m.lines[k] = false;
      return { ok: true, msg: `${L.name} discontinued.` };
    }
    const setup = m.owned[k] ? 0 : L.setup || 0;
    if (setup && !ZG.Econ.canAfford(s, setup)) return { ok: false, msg: `You can't afford the ${$(setup)} setup.` };
    if (setup) ZG.Econ.spend(s, 'cogs', setup);
    m.owned[k] = true;
    m.lines[k] = true;
    return { ok: true, msg: `${L.icon} ${L.name} added${setup ? ` (${$(setup)} setup)` : ''}.` };
  };

  MR.upgradeStore = function (s) {
    const m = s.merch;
    const next = MR.STORES[m.store + 1];
    if (!next) return { ok: false, msg: 'Already the flagship store.' };
    const cost = Math.round(next.cost * ZG.zoo(s).costMult);
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: 'Not enough funds.' };
    ZG.Econ.spendCapital(s, 'construction', cost);
    m.store++;
    ZG.Sim.news(s, `🛍️ The new ${next.name.toLowerCase()} is open (${$(cost)}).`, 'good');
    return { ok: true, msg: `${next.name} opened.` };
  };

  MR.collab = function (s, name) {
    const m = s.merch;
    const b = MR.brands(s).find((x) => x.name === name);
    if (!b) return { ok: false, msg: 'Not found.' };
    if (m.collab && m.collab.until > s.day) return { ok: false, msg: `You already have a collaboration with ${m.collab.name}.` };
    if (m.cooldownCollab > s.day) return { ok: false, msg: `Brands want a break between collaborations. Try after ${U.fmtDate(m.cooldownCollab)}.` };
    // Odds the brand says yes depend on your reputation and attendance.
    const p = U.clamp(0.45 + (s.rep - 55) / 80, 0.15, 0.95);
    m.cooldownCollab = s.day + 60;
    if (U.rand(s) > p) return { ok: true, msg: `${b.name} passed for now: “We don’t think the timing is right.” (${Math.round(p * 100)}% odds)` };
    const fee = Math.round(b.fee * U.rf(s, 0.85, 1.2));
    ZG.Econ.earn(s, 'retail', fee);
    m.collab = { name: b.name, ind: b.ind, boost: b.boost, until: s.day + 365, fee };
    m.hype = Math.min(0.4, (m.hype || 0) + 0.12);
    if (b.adult && s.gov.type === 'city') s.gov.relationship = U.clamp(s.gov.relationship - 1, 0, 100);
    ZG.Sim.news(s, `🏷️ Signed a one-year collaboration with ${b.name} (${b.ind}): ${$(fee)} licensing fee plus a co-branded line.`, 'good');
    return { ok: true, msg: `${b.name} signed! ${$(fee)} licensing fee, and the co-branded line hits shelves now.` };
  };

  MR.dropOptions = function (s) {
    const stars = s.animals.filter((a) => a.star || (a.age < 365 && ZG.SPECIES[a.sp].appeal >= 6));
    return stars.slice(0, 4).map((a) => ({ aid: a.id, name: a.name, sp: a.sp, cost: Math.round(25000 * Math.max(0.8, ZG.zoo(s).costMult)) }));
  };
  MR.launchDrop = function (s, aid) {
    const m = s.merch;
    const a = ZG.Animals.byId(s, aid);
    if (!a) return { ok: false, msg: 'Not found.' };
    if (m.drop && m.drop.until > s.day) return { ok: false, msg: 'A limited edition is already on shelves.' };
    const o = MR.dropOptions(s).find((x) => x.aid === aid);
    if (!ZG.Econ.canAfford(s, o.cost)) return { ok: false, msg: 'Not enough cash for the production run.' };
    ZG.Econ.spend(s, 'cogs', o.cost);
    const baby = a.age < 365;
    m.drop = { name: a.name, until: s.day + 90, boost: (baby ? 0.22 : 0.12) * U.rf(s, 0.7, 1.3) };
    m.hype = Math.min(0.4, (m.hype || 0) + 0.08);
    ZG.Sim.news(s, `🧸 Limited edition: the “${a.name}” collection is in the gift shop.`, 'good');
    return { ok: true, msg: `The ${a.name} limited edition is on shelves for 90 days. Promote it on social media to sell more.` };
  };
})((globalThis.ZG = globalThis.ZG || {}));
