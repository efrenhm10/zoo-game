// Rainy-day fund: an operating reserve you pay into on purpose. It earns interest,
// reassures your boss, and can only be drawn on in an emergency.
(function (ZG) {
  const U = ZG.U;
  const RF = (ZG.Reserve = {});
  const $ = (n) => U.money(n);

  RF.NAMES = {
    honolulu: 'Honolulu Zoo Special Fund reserve',
    national: 'Emergency operating reserve (FONZ-held)',
    houston: 'Board-designated operating reserve',
    sandiego: 'Board-designated operating reserve',
    cheyenne: 'Board-designated operating reserve',
  };
  RF.RATE = 0.035; // yearly interest on invested reserves
  // Events that count as emergencies and open the fund for 90 days.
  RF.EMERGENCY_EVENTS = ['breakdown', 'illness', 'mid_year_cut', 'recession', 'shutdown', 'hpai', 'escape', 'insurance_hike', 'food_spike', 'tb_test', 'budget_decision'];

  RF.init = (s) => {
    if (!s.reserve) s.reserve = { bal: 0, auto: 0, autoCover: true, log: [] };
  };
  RF.monthCost = (s) => ZG.Econ.annualBudget(s) / 12;
  RF.months = (s) => s.reserve.bal / Math.max(1, RF.monthCost(s));

  // Why the fund is open right now (null if it's not an emergency).
  RF.emergency = function (s) {
    if (s.gov.shutdown) return 'the government shutdown';
    if (s.closure) return `a closure (${s.closure.reason})`;
    if (s.flags.emergencyUntil > s.day) return s.flags.emergencyWhy || 'a recent emergency';
    if (s.economy < 0.93) return 'a regional recession';
    if (s.cash < -ZG.Econ.creditLimit(s) * 0.5) return 'a cash crisis (deep into the credit line)';
    return null;
  };

  RF.log = (s, text) => {
    s.reserve.log.unshift({ day: s.day, text });
    if (s.reserve.log.length > 12) s.reserve.log.pop();
  };

  RF.deposit = function (s, amt) {
    amt = Math.round(amt);
    if (!(amt > 0)) return { ok: false, msg: 'Nothing to deposit.' };
    if (s.cash - amt < 0) return { ok: false, msg: `You only have ${$(Math.max(0, s.cash))} in operating cash. Don't borrow to save.` };
    s.cash -= amt;
    s.reserve.bal += amt;
    RF.log(s, `Deposited ${$(amt)}`);
    return { ok: true, msg: `🌧️ ${$(amt)} moved into the rainy-day fund. Balance ${$(s.reserve.bal)} (${RF.months(s).toFixed(1)} months of expenses).` };
  };

  RF.withdraw = function (s, amt, why) {
    const reason = why || RF.emergency(s);
    if (!reason) return { ok: false, msg: 'The rainy-day fund is for emergencies only. It opens during disasters, breakdowns, outbreaks, budget cuts, shutdowns, recessions or a cash crisis.' };
    amt = Math.round(Math.min(amt, s.reserve.bal));
    if (!(amt > 0)) return { ok: false, msg: 'The fund is empty.' };
    s.reserve.bal -= amt;
    s.cash += amt;
    RF.log(s, `Drew ${$(amt)} for ${reason}`);
    return { ok: true, msg: `🌧️ Drew ${$(amt)} from the rainy-day fund to deal with ${reason}.` };
  };

  // Called when an event is resolved: emergencies open the fund, and if auto-cover is on
  // the fund pays whatever pushed operating cash below zero.
  RF.afterEvent = function (s, id, title, cost) {
    if (RF.EMERGENCY_EVENTS.includes(id) || (ZG.Events.defs[id] && ZG.Events.defs[id].cat === 'disaster')) {
      s.flags.emergencyUntil = s.day + 90;
      s.flags.emergencyWhy = title.replace(/<[^>]+>/g, '').toLowerCase();
    }
    if (cost > 0 && s.reserve.autoCover && s.cash < 0 && RF.emergency(s) && s.reserve.bal > 0) {
      const r = RF.withdraw(s, Math.min(-s.cash, cost));
      if (r.ok) ZG.Sim.news(s, r.msg, 'info');
    }
  };

  // How much the fund could add to what you can afford right now.
  RF.available = (s) => (s.reserve && s.reserve.autoCover && RF.emergency(s) ? s.reserve.bal : 0);

  RF.monthly = function (s) {
    const r = s.reserve;
    if (r.bal > 0) {
      const interest = r.bal * (RF.RATE / 12) * (0.6 + 0.4 * s.economy);
      r.bal += interest; // interest stays in the fund
    }
    if (r.auto > 0) {
      if (s.cash - r.auto >= 0) {
        s.cash -= r.auto;
        r.bal += r.auto;
      } else if (!r.skipNote || s.day - r.skipNote > 90) {
        r.skipNote = s.day;
        ZG.Sim.news(s, `🌧️ Skipped this month's ${$(r.auto)} rainy-day deposit: not enough operating cash.`, 'info');
      }
    }
    // In an emergency with auto-cover on, keep operating cash from going negative.
    if (r.autoCover && s.cash < 0 && r.bal > 0 && RF.emergency(s)) {
      const res = RF.withdraw(s, -s.cash);
      if (res.ok) ZG.Sim.news(s, res.msg, 'info');
    }
  };
})((globalThis.ZG = globalThis.ZG || {}));
