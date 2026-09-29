// Asking the AZA for animals: request specific species (and sexes) for an existing
// habitat or one still under construction. SSP coordinators take weeks to decide,
// and they say no for real reasons: no space, wrong habitat, no surplus animals.
(function (ZG) {
  const U = ZG.U;
  const RQ = (ZG.Requests = {});
  const $ = (n) => U.money(n);
  const AZA = () => ZG.AZA;

  RQ.init = (s) => {
    if (!s.ssp.requests) s.ssp.requests = [];
  };

  // How many more animals of a species fit in a habitat (after residents and open requests).
  RQ.room = function (s, h, spId) {
    const used = s.animals.filter((a) => a.hab === h.id).reduce((t, a) => t + ZG.SPECIES[a.sp].space, 0) +
      s.ssp.requests.filter((r) => r.hab === h.id && (r.status === 'pending' || r.status === 'waitlist')).reduce((t, r) => t + ZG.SPECIES[r.sp].space * (r.males + r.females), 0);
    return Math.max(0, Math.floor((h.area - used) / ZG.SPECIES[spId].space));
  };

  RQ.cost = function (s, spId, n) {
    return Math.round(AZA().transportCost(s, spId) * (n > 1 ? 1 + n * 0.15 : 1) + 5000 * Math.min(n, 3));
  };

  // Everything the coordinator will weigh, shown to the player before they submit.
  RQ.estimate = function (s, spId, males, females, hid) {
    const sp = ZG.SPECIES[spId];
    const h = s.habitatsById[hid];
    const n = (+males || 0) + (+females || 0);
    const out = { ok: true, odds: 0, notes: [], block: null, cost: 0, wait: '' };
    if (!sp || !h) return Object.assign(out, { ok: false, block: 'Choose a habitat and a species.' });
    if (n < 1) return Object.assign(out, { ok: false, block: 'Ask for at least one animal.' });
    if (sp.program === 'Loan') return Object.assign(out, { ok: false, block: 'Giant pandas come only through a government-to-government loan agreement with China, not the SSP.' });
    if (sp.program === 'SSP' && !AZA().accredited(s)) return Object.assign(out, { ok: false, block: 'The SSP only places animals with AZA-accredited zoos. Regain accreditation first.' });
    if (!sp.biomes.includes(h.biome)) return Object.assign(out, { ok: false, block: `${sp.name}s need ${sp.biomes.map((b) => ZG.BIOMES[b].name).join(' or ')}. ${h.name} is ${ZG.BIOMES[h.biome].name}, so the coordinator would refuse.` });
    const res = s.animals.filter((a) => a.hab === h.id);
    const pending = s.ssp.requests.filter((r) => r.hab === h.id && (r.status === 'pending' || r.status === 'waitlist'));
    const spIds = new Set(res.map((a) => a.sp).concat(pending.map((r) => r.sp)));
    spIds.add(spId);
    if (spIds.size > 1 && ![...spIds].every((id) => ZG.SPECIES[id].mix && ZG.SPECIES[id].mix === sp.mix)) return Object.assign(out, { ok: false, block: `${sp.name}s can't be mixed with the species already in ${h.name}.` });
    const need = res.reduce((t, a) => t + ZG.SPECIES[a.sp].space, 0) + pending.reduce((t, r) => t + ZG.SPECIES[r.sp].space * (r.males + r.females), 0) + sp.space * n;
    if (need > h.area) return Object.assign(out, { ok: false, block: `Not enough room: ${h.name} has ${U.num(h.area)} m² and this would need ${U.num(Math.round(need))} m². Standards require more space per animal.${(h.expansions || 0) < ZG.Habitats.MAX_EXPANSIONS && !h.construction ? ' Expanding the habitat would make room.' : ''}` });

    let o = sp.program === 'SSP' ? 0.5 : 0.72;
    o += (s.aza - 60) / 120;
    if (s.aza < 50) out.notes.push('⚠️ Your AZA standing is low, so coordinators are wary of placing animals with you.');
    const hold = s.ssp.recs.find((r) => r.type === 'hold' && r.sp === spId && (r.status === 'open' || r.status === 'accepted'));
    if (hold) (o += 0.35), out.notes.push('✅ The SSP has asked zoos to hold space for this species. They want to say yes.');
    const have = res.filter((a) => a.sp === spId);
    if (have.length) {
      const m = have.filter((a) => a.sex === 'M').length, f = have.length - m;
      if ((m === 0 && males > 0) || (f === 0 && females > 0)) (o += 0.08), out.notes.push('💞 This would give your animals a potential mate.');
      if (have.length + n > sp.group[1]) (o -= 0.1), out.notes.push(`⚠️ That would make a bigger group than ${sp.name}s naturally live in (${sp.group[0]}–${sp.group[1]}).`);
    } else if (n < sp.group[0]) out.notes.push(`ℹ️ ${sp.name}s do best in groups of ${sp.group[0]}–${sp.group[1]}.`);
    if (['CR', 'EN'].includes(sp.iucn) && sp.program === 'SSP') (o -= 0.08), out.notes.push(`⚠️ ${sp.iucn === 'CR' ? 'Critically endangered' : 'Endangered'}: very few animals are available to place.`);
    if (sp.appeal >= 8) (o -= 0.08), out.notes.push('⚠️ A popular species. Many zoos are on the waitlist.');
    if (n >= 5 && sp.group[0] < 6) (o -= 0.1), out.notes.push('⚠️ A large request. You may get only part of it.');
    const Z = ZG.zoo(s);
    const hot = Math.max(...Z.climate.hi), cold = Math.min(...Z.climate.hi) - 20;
    if (h.climate === 'none' && (hot > sp.climate[1] + 3 || cold < sp.climate[0] - 3)) (o -= 0.15), out.notes.push(`⚠️ Your climate falls outside what ${sp.name}s tolerate (${sp.climate[0]}–${sp.climate[1]}°F) and this habitat has no climate control.`);
    if (h.condition < 45 && !h.construction) (o -= 0.12), out.notes.push('⚠️ The habitat is in poor condition. The coordinator may want it renovated first.');
    if (ZG.Staff.ratio(s, 'keepers') < 0.85) (o -= 0.08), out.notes.push('⚠️ You are short on keepers.');
    if (h.construction) out.notes.push(`🏗️ ${h.name} is still under construction. The animals will wait in quarantine until it opens.`);
    out.odds = U.clamp(o, 0.05, 0.92);
    out.cost = RQ.cost(s, spId, n);
    out.wait = sp.program === 'SSP' ? '1½–3 months' : '1–2 months';
    return out;
  };

  RQ.submit = function (s, spId, males, females, hid) {
    const e = RQ.estimate(s, spId, males, females, hid);
    if (!e.ok) return { ok: false, msg: e.block };
    if (s.ssp.requests.filter((r) => r.status === 'pending' || r.status === 'waitlist').length >= 5) return { ok: false, msg: 'You already have five requests open with the AZA. Wait for some decisions.' };
    const sp = ZG.SPECIES[spId];
    const wait = sp.program === 'SSP' ? U.ri(s, 45, 100) : U.ri(s, 25, 60);
    s.ssp.requests.unshift({ id: s.nextId++, sp: spId, males: +males || 0, females: +females || 0, hab: hid, day: s.day, decide: s.day + wait, status: 'pending', tries: 0, note: '' });
    if (s.ssp.requests.length > 30) s.ssp.requests.pop();
    ZG.Sim.news(s, `📨 Requested ${+males || 0}♂ ${+females || 0}♀ ${sp.name}${(+males || 0) + (+females || 0) > 1 ? 's' : ''} from the ${sp.program === 'SSP' ? `${sp.name} SSP coordinator` : 'AZA animal exchange'}.`, 'info');
    return { ok: true, msg: `Request sent. The coordinator will answer in about ${e.wait}.` };
  };

  RQ.cancel = function (s, id) {
    const r = s.ssp.requests.find((x) => x.id === id);
    if (!r || (r.status !== 'pending' && r.status !== 'waitlist')) return { ok: false, msg: 'Nothing to withdraw.' };
    r.status = 'withdrawn';
    return { ok: true, msg: 'Request withdrawn.' };
  };

  function deliver(s, r, males, females) {
    const sp = ZG.SPECIES[r.sp];
    const h = s.habitatsById[r.hab];
    const n = males + females;
    const cost = RQ.cost(s, r.sp, n);
    ZG.Econ.spend(s, 'transport', cost);
    const names = [];
    for (let i = 0; i < n; i++) {
      const sex = i < males ? 'M' : 'F';
      const age = Math.round(U.rf(s, sp.mature * 0.7, sp.mature + 6) * 365);
      const a = ZG.Animals.create(s, r.sp, sex, age, { hab: h.id, loc: 'quarantine', qDays: AZA().quarantineDays(s), gv: U.pick(s, ['High', 'Medium', 'Medium', 'Low']) });
      names.push(a.name);
    }
    if (!s.stats.speciesSeen.includes(r.sp)) {
      s.stats.speciesSeen.push(r.sp);
      s.stats.speciesAdded++;
      s.novelty = Math.min(0.8, s.novelty + 0.04 * sp.appeal / 5);
    }
    const hold = s.ssp.recs.find((x) => x.type === 'hold' && x.sp === r.sp && (x.status === 'accepted' || x.status === 'open'));
    if (hold) {
      hold.status = 'done';
      s.aza = U.clamp(s.aza + 5, 0, 100);
    }
    return { names, cost, from: U.pick(s, ZG.NAMES.partnerZoos) };
  }

  RQ.daily = function (s) {
    for (const r of s.ssp.requests) {
      if ((r.status !== 'pending' && r.status !== 'waitlist') || s.day < r.decide) continue;
      const sp = ZG.SPECIES[r.sp];
      const h = s.habitatsById[r.hab];
      const title = `${sp.program === 'SSP' ? 'SSP' : 'AZA'} decision: ${sp.name}s`;
      if (!h) {
        r.status = 'declined';
        r.note = 'The destination habitat no longer exists.';
        continue;
      }
      // Re-check hard rules now (things may have changed since you asked).
      const e = RQ.estimate(s, r.sp, 0, 0, r.hab);
      const e2 = RQ.estimate(s, r.sp, r.males, r.females, r.hab);
      void e;
      const odds = e2.ok ? e2.odds + r.tries * 0.1 : 0;
      const roll = U.rand(s);
      let html;
      if (!e2.ok) {
        r.status = 'declined';
        r.note = e2.block;
        html = `<p>The coordinator declined your request.</p><p><i>“${esc(e2.block)}”</i></p>`;
      } else if (roll < odds) {
        const d = deliver(s, r, r.males, r.females);
        r.status = 'approved';
        r.note = `From ${d.from}`;
        html = `<p>Approved! <b>${d.names.join(', ')}</b> ${d.names.length > 1 ? 'are' : 'is'} coming from ${esc(d.from)} on a breeding loan.</p><p>Transport cost ${$(d.cost)}. ${AZA().quarantineDays(s)} days of quarantine at your animal hospital first${h.construction ? `, then they wait for ${esc(h.name)} to open` : `, then into ${esc(h.name)}`}.</p>`;
        ZG.Sim.news(s, `🚚 Approved: ${d.names.join(', ')} (${sp.name}) coming from ${d.from}.`, 'good');
      } else if (r.males + r.females > 1 && roll < odds + (1 - odds) * 0.35) {
        const want = r.males + r.females;
        const k = Math.max(1, Math.floor(want / 2));
        let ff = Math.min(r.females, Math.ceil((k * r.females) / want));
        let mm = Math.min(r.males, k - ff);
        if (mm + ff === 0) r.females ? (ff = 1) : (mm = 1);
        const d = deliver(s, r, mm, ff);
        r.status = 'partial';
        r.note = `Got ${mm + ff} of ${r.males + r.females}`;
        html = `<p>Partly approved. There aren't enough surplus animals, but <b>${d.names.join(', ')}</b> ${d.names.length > 1 ? 'are' : 'is'} coming from ${esc(d.from)} (${$(d.cost)} transport).</p><p>You can ask again later for the rest.</p>`;
        ZG.Sim.news(s, `🚚 Partly approved: ${d.names.join(', ')} (${sp.name}) coming from ${d.from}.`, 'good');
      } else if (r.tries < 2 && U.chance(s, 0.55)) {
        r.status = 'waitlist';
        r.tries++;
        r.decide = s.day + U.ri(s, 90, 150);
        r.note = `Waitlisted until about ${U.fmtDate(r.decide)}`;
        html = `<p>You're on the waitlist. No suitable animals are available right now. The coordinator will look again around <b>${U.fmtDate(r.decide)}</b>.</p><p class="sub">Improving your AZA standing, keeper staffing and habitat condition helps your odds.</p>`;
      } else {
        r.status = 'declined';
        const why = U.pick(s, [
          'Other zoos with better genetic matches are ahead of you.',
          'No surplus animals of the right age and sex are available this year.',
          'The Species Survival Plan is limiting breeding and placements for now.',
          s.aza < 55 ? 'Frankly, your AZA standing makes coordinators hesitant.' : 'Their current plan sends these animals elsewhere.',
        ]);
        r.note = why;
        html = `<p>The coordinator declined your request.</p><p><i>“${esc(why)}”</i></p><p class="sub">You can ask again.</p>`;
        ZG.Sim.news(s, `📭 The AZA declined your ${sp.name} request.`, 'bad');
      }
      ZG.Events.queue(s, 'zoo_event_result', { icon: '📨', title, html });
    }
  };

  const esc = (t) => U.esc(t);
})((globalThis.ZG = globalThis.ZG || {}));
