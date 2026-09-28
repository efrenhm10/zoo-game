// Staffing: departments, workload requirements, hiring delays, morale, turnover.
(function (ZG) {
  const U = ZG.U;
  const St = (ZG.Staff = {});

  St.DEPTS = [
    { id: 'keepers', name: 'Animal Care (Keepers)', icon: '🧑‍🌾', desc: 'Daily husbandry, enrichment and training. Drives animal welfare and safety.' },
    { id: 'vets', name: 'Veterinary Team', icon: '🩺', desc: 'Vets and techs. Drives health, illness recovery and infant survival.' },
    { id: 'maintenance', name: 'Facilities & Maintenance', icon: '🔧', desc: 'Slows decay of habitats and infrastructure.' },
    { id: 'guest', name: 'Guest Services', icon: '🎟️', desc: 'Admissions, food, retail, cleanliness. Drives guest satisfaction and spending.' },
    { id: 'education', name: 'Education & Programs', icon: '🎓', desc: 'Camps, school programs, interpretation. Required by AZA; helps grants.' },
    { id: 'development', name: 'Development & Marketing', icon: '🤝', desc: 'Fundraisers and partnership staff. More donors, gifts and sponsors.' },
    { id: 'admin', name: 'Administration', icon: '🗂️', desc: 'Finance, HR, IT, legal. Keeps the lights on.' },
  ];

  St.init = function (s) {
    const Z = ZG.zoo(s);
    s.staff = {};
    for (const d of St.DEPTS) {
      const [n, salary] = Z.staff[d.id];
      s.staff[d.id] = { n, salary };
    }
    // Required-per-load factors so the starting staffing ratio matches the zoo's reality.
    s.req = {};
    for (const d of St.DEPTS) {
      const load = St.load(s, d.id);
      const factor = (Z.understaffed && Z.understaffed[d.id]) || 1;
      s.req[d.id] = s.staff[d.id].n / factor / Math.max(0.001, load);
    }
  };

  St.load = function (s, dept) {
    const Z = ZG.zoo(s);
    switch (dept) {
      case 'keepers':
        return ZG.Animals.careLoad(s);
      case 'vets':
        return ZG.Animals.careLoad(s) * 0.6 + s.animals.length * 0.02 + Z.supporting.care * 0.4;
      case 'maintenance': {
        let l = 0;
        for (const k in s.infra) l += s.infra[k].cost / 1e6;
        for (const h of s.habitats) if (!h.construction) l += h.area / 1000;
        return l;
      }
      case 'guest':
        return Math.max(0.3, s.att.avg30 / (Z.baseAttendance / 365));
      case 'education':
        return 0.5 + 0.5 * Math.max(0.3, s.att.avg30 / (Z.baseAttendance / 365));
      case 'development':
        return 1;
      case 'admin':
        return St.total(s) / 100;
    }
    return 1;
  };

  St.total = function (s) {
    let t = 0;
    for (const k in s.staff) t += s.staff[k].n;
    return t;
  };
  St.required = (s, dept) => Math.max(1, Math.round(s.req[dept] * St.load(s, dept)));
  St.ratio = function (s, dept) {
    if (!s.staff || !s.staff[dept]) return 1;
    const req = s.req[dept] * St.load(s, dept);
    let r = s.staff[dept].n / Math.max(0.5, req);
    if (dept !== 'development') r *= 0.75 + 0.25 * (s.morale / 70);
    if (s.gov && s.gov.shutdown && dept !== 'keepers' && dept !== 'vets') r *= 0.3;
    return U.clamp(r, 0, 2);
  };
  St.annualCost = function (s) {
    const Z = ZG.zoo(s);
    let c = 0;
    for (const k in s.staff) c += s.staff[k].n * s.staff[k].salary * Z.benefits;
    return c;
  };
  St.pending = (s, dept) => s.pendingHires.filter((p) => p.dept === dept).reduce((a, p) => a + p.n, 0);

  St.hire = function (s, dept, n) {
    const Z = ZG.zoo(s);
    if (s.flags.hiringFreeze && s.flags.hiringFreeze > s.day) {
      return { ok: false, msg: 'A hiring freeze is in effect — you cannot hire right now.' };
    }
    const delay = Z.hireDelay + U.ri(s, -10, 20);
    s.pendingHires.push({ dept, n, day: s.day + delay });
    ZG.Econ.spend(s, 'admin', n * 2500);
    return { ok: true, msg: `Posted ${n} position${n > 1 ? 's' : ''}. Expected start in ~${Math.round(delay / 30)} month${delay > 45 ? 's' : ''}${Z.hireDelay > 60 ? ' (civil-service hiring)' : ''}.` };
  };

  St.layoff = function (s, dept, n) {
    const st = s.staff[dept];
    n = Math.min(n, st.n - 1);
    if (n <= 0) return { ok: false, msg: 'You cannot lay off everyone.' };
    st.n -= n;
    const sev = n * st.salary * 0.15;
    ZG.Econ.spend(s, 'salaries', sev);
    s.morale = U.clamp(s.morale - Math.min(20, (n / Math.max(10, St.total(s))) * 120), 0, 100);
    if (ZG.zoo(s).governance === 'city' || ZG.zoo(s).governance === 'federal') {
      s.gov.relationship = U.clamp(s.gov.relationship - Math.min(10, n), 0, 100);
    }
    s.flags.laidOff = s.day + 180;
    s.rep = U.clamp(s.rep - Math.min(4, n * 0.3), 0, 100);
    ZG.Sim.news(s, `✂️ ${n} ${St.DEPTS.find((d) => d.id === dept).name} position${n > 1 ? 's' : ''} eliminated (severance ${U.money(sev)}). Staff morale drops.`, 'bad');
    return { ok: true, msg: `Laid off ${n}. Severance ${U.money(sev)}.` };
  };

  St.daily = function (s) {
    for (let i = s.pendingHires.length - 1; i >= 0; i--) {
      const p = s.pendingHires[i];
      if (s.day >= p.day) {
        s.staff[p.dept].n += p.n;
        s.pendingHires.splice(i, 1);
        ZG.Sim.news(s, `👋 ${p.n} new ${St.DEPTS.find((d) => d.id === p.dept).name} hire${p.n > 1 ? 's' : ''} started work.`, 'info');
      }
    }
    // Morale drifts toward a target driven by workload and pay.
    let over = 0;
    for (const d of ['keepers', 'vets', 'maintenance', 'guest']) over += Math.max(0, 1 - St.ratio(s, d));
    const target = U.clamp(72 - over * 40 + (s.flags.payBump || 0) - (s.gov.shutdown ? 20 : 0) + (s.rep - 60) * 0.15 + ZG.mod(s, 'morale'), 5, 95);
    s.morale += (target - s.morale) * 0.01;
    // Turnover when morale is low
    if (s.morale < 50 && U.rand(s) < (50 - s.morale) / 50 * 0.04) {
      const dept = U.pick(s, ['keepers', 'keepers', 'guest', 'maintenance', 'vets', 'education']);
      if (s.staff[dept].n > 1) {
        s.staff[dept].n--;
        ZG.Sim.news(s, `🚪 A ${St.DEPTS.find((d) => d.id === dept).name.toLowerCase()} staffer resigned — they cited burnout.`, 'bad');
      }
    }
  };
})((globalThis.ZG = globalThis.ZG || {}));
