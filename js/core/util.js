// Core helpers: seeded RNG, formatting, calendar.
(function (ZG) {
  const U = (ZG.U = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;

  // Seeded RNG (mulberry32) that keeps its state inside the save game.
  U.rand = function (s) {
    s.rng = (s.rng + 0x6d2b79f5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  U.ri = (s, a, b) => a + Math.floor(U.rand(s) * (b - a + 1));
  U.rf = (s, a, b) => a + U.rand(s) * (b - a);
  U.pick = (s, arr) => arr[Math.floor(U.rand(s) * arr.length)];
  U.chance = (s, p) => U.rand(s) < p;
  U.gauss = (s) => {
    let u = 0;
    for (let i = 0; i < 4; i++) u += U.rand(s);
    return (u - 2) / 0.577;
  };
  U.weighted = function (s, items, wfn) {
    let total = 0;
    const ws = items.map((it) => {
      const w = Math.max(0, wfn(it) || 0);
      total += w;
      return w;
    });
    if (total <= 0) return null;
    let r = U.rand(s) * total;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };
  U.shuffle = function (s, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(U.rand(s) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  U.annualToDaily = (p) => 1 - Math.pow(1 - U.clamp(p, 0, 0.999), 1 / 365);

  U.money = function (n) {
    const neg = n < 0;
    n = Math.abs(n);
    let str;
    if (n >= 1e9) str = (n / 1e9).toFixed(2) + 'B';
    else if (n >= 1e7) str = (n / 1e6).toFixed(1) + 'M';
    else if (n >= 1e6) str = (n / 1e6).toFixed(2) + 'M';
    else if (n >= 1e4) str = (n / 1e3).toFixed(0) + 'K';
    else if (n >= 1e3) str = (n / 1e3).toFixed(1) + 'K';
    else str = n.toFixed(0);
    return (neg ? '−$' : '$') + str;
  };
  U.num = (n) => Math.round(n).toLocaleString('en-US');
  U.pct = (n) => Math.round(n) + '%';
  U.esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Sex badges: a colored ♂ / ♀ that is easy to spot, and "2♂ 1♀" counts for a group.
  U.sexTag = (sex) => (sex === 'M' ? '<span class="sex m" title="Male">♂ male</span>' : '<span class="sex f" title="Female">♀ female</span>');
  U.sexIcon = (sex) => (sex === 'M' ? '<span class="sex m" title="Male">♂</span>' : '<span class="sex f" title="Female">♀</span>');
  U.sexCount = (list) => {
    const m = list.filter((a) => a.sex === 'M').length;
    return `<span class="sexcount"><span class="sex m">${m}♂</span> <span class="sex f">${list.length - m}♀</span></span>`;
  };
  U.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  U.DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const START = Date.UTC(2027, 0, 1);
  U.dateOf = function (day) {
    const d = new Date(START + day * 86400000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay() };
  };
  U.dayOf = (y, m, d) => Math.round((Date.UTC(y, m, d) - START) / 86400000);
  U.fmtDate = (day) => {
    const t = U.dateOf(day);
    return `${U.MONTHS[t.m]} ${t.d}, ${t.y}`;
  };
  U.fmtMonth = (day) => {
    const t = U.dateOf(day);
    return `${U.MONTHS_LONG[t.m]} ${t.y}`;
  };
  U.daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  U.years = (days) => days / 365.25;
  U.ageStr = function (days) {
    const y = Math.floor(days / 365.25);
    if (y >= 1) return y + ' yr';
    const mo = Math.floor(days / 30.4);
    if (mo >= 1) return mo + ' mo';
    return Math.max(0, Math.floor(days)) + ' days';
  };
})((globalThis.ZG = globalThis.ZG || {}));
