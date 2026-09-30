// Headless simulation harness: runs each zoo for N years with auto-chosen events.
// Usage: node tools/headless.js [years] [zooId]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const files = ['js/core/util.js', 'js/data/species.js', 'js/data/names.js', 'js/data/zoos.js', 'js/data/director.js',
  'js/sim/animals.js', 'js/sim/staff.js', 'js/sim/infra.js', 'js/sim/habitats.js', 'js/sim/economy.js', 'js/sim/aza.js',
  'js/sim/politics.js', 'js/sim/development.js', 'js/sim/design.js', 'js/sim/events.js', 'js/sim/donors.js', 'js/sim/officials.js', 'js/sim/partner.js', 'js/sim/media.js', 'js/sim/zooevents.js', 'js/sim/merch.js', 'js/sim/diagnose.js', 'js/sim/requests.js', 'js/sim/growth.js', 'js/sim/reserve.js', 'js/sim/fieldcons.js', 'js/sim/campaigns.js', 'js/sim/sim.js'];
const ctx = { console, Math, JSON, Date };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const ZG = ctx.ZG;
const years = +(process.argv[2] || 3);
const only = process.argv[3];
const director = { name: 'Test Director', age: 40, field: 'zoology', level: 'ba', career: 'curator', school: 'UC Davis' };
for (const id of ZG.ZOO_ORDER) {
  if (only && id !== only) continue;
  const s = ZG.Sim.newGame(director, id, 12345);
  const U = ZG.U;
  console.log(`\n=== ${ZG.ZOOS[id].name}  animals=${s.animals.length} habitats=${s.habitats.length} appeal0=${s.appeal0.toFixed(0)} budget=${U.money(ZG.Econ.annualBudget(s))} backlog=${U.money(s.stats.backlogStart)}`);
  const ratios = ZG.Staff.DEPTS.map((d) => d.id + ':' + ZG.Staff.ratio(s, d.id).toFixed(2)).join(' ');
  console.log('  staff', ratios);
  let evCount = 0;
  const cats = {};
  for (let d = 0; d < 365 * years; d++) {
    ZG.Sim.tickDay(s);
    if (process.env.PLAY && s.day % 30 === 0) {
      for (const r of s.ssp.recs) if (r.status === 'open' && r.type !== 'hold') ZG.AZA.respond(s, r.id, true);
    }
    while (ZG.Events.pending(s)) {
      const id2 = s.eventQueue[0].id;
      cats[id2] = (cats[id2] || 0) + 1;
      ZG.Events.autoChoose(s);
      evCount++;
    }
    const t = U.dateOf(s.day);
    if (t.m === 11 && t.d === 31) {
      const y = ZG.Econ.yearTotals(s, t.y);
      console.log(`  ${t.y}: guests=${U.num(y.guests)} rev=${U.money(y.revTotal)} exp=${U.money(y.expTotal)} net=${U.money(y.net)} capex=${U.money(y.capex)} cash=${U.money(s.cash)} cap=${U.money(s.capital)} mem=${U.num(s.members)} rep=${s.rep.toFixed(0)} wel=${ZG.Animals.avgWelfare(s).toFixed(0)} sat=${s.satisfaction.toFixed(0)} aza=${s.aza.toFixed(0)} board=${s.board.toFixed(0)} animals=${s.animals.length} births=${s.stats.births} deaths=${s.stats.deaths} backlog=${U.money(ZG.Infra.backlog(s))} acc=${s.acc.status}`);
      if (only || process.env.V) {
        const rv = Object.entries(y.rev).map(([k, v]) => k + ':' + U.money(v)).join(' ');
        const ex = Object.entries(y.exp).map(([k, v]) => k + ':' + U.money(v)).join(' ');
        console.log('    REV', rv, '\n    EXP', ex);
      }
    }
  }
  console.log('  events:', evCount, JSON.stringify(cats));
  const str = ZG.Sim.serialize(s);
  const s2 = ZG.Sim.deserialize(str);
  ZG.Sim.tickDay(s2);
  console.log('  save size', (str.length / 1024).toFixed(0) + 'KB, reload OK');
}
