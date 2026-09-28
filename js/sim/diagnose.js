// Habitat diagnostics: explain in plain words why a habitat is in trouble and
// offer the fixes that would actually help, with their prices.
(function (ZG) {
  const U = ZG.U;
  const D = (ZG.Diagnose = {});
  const $ = (n) => U.money(n);
  const fix = (label, act, data) => ({ label, act, data: data || {} });

  // Best other habitat an animal of this species could move into (right biome, room, compatible).
  D.bestHome = function (s, spId, exceptHab, n) {
    const sp = ZG.SPECIES[spId];
    let best = null, bestScore = -1;
    for (const h of s.habitats) {
      if (h.id === exceptHab || h.construction || h.renovation || !sp.biomes.includes(h.biome)) continue;
      const res = s.animals.filter((a) => a.hab === h.id);
      const spIds = new Set(res.map((a) => a.sp));
      spIds.add(spId);
      const mixOk = spIds.size <= 1 || [...spIds].every((id) => ZG.SPECIES[id].mix && ZG.SPECIES[id].mix === sp.mix);
      if (!mixOk) continue;
      const need = res.reduce((t, a) => t + ZG.SPECIES[a.sp].space, 0) + sp.space * (n || 1);
      const ratio = h.area / need;
      if (ratio < 1.05) continue;
      const score = ratio + (res.some((a) => a.sp === spId) ? 2 : 0);
      if (score > bestScore) (best = h), (bestScore = score);
    }
    return best;
  };

  // Which animal to let go first when a group is too big: non-star, lowest genetic value, then oldest.
  D.surplusAnimal = function (s, hid, spId) {
    const gvRank = { Low: 0, Medium: 1, High: 2 };
    const list = s.animals.filter((a) => a.hab === hid && a.sp === spId && !a.star && !a.preg && a.age > 365);
    list.sort((a, b) => (gvRank[a.gv] || 1) - (gvRank[b.gv] || 1) || b.age - a.age);
    return list[0] || null;
  };

  D.habitat = function (s, h) {
    const issues = [];
    if (!h || h.construction) return { level: 'ok', issues, summary: '' };
    const Z = ZG.zoo(s);
    const f = (s._hf && s._hf[h.id]) || ZG.Animals.habitatFactors(s, h);
    const animals = s.animals.filter((a) => a.hab === h.id);
    const add = (sev, icon, short, text, fixes) => issues.push({ sev, icon, short, text, fixes: fixes || [] });

    if (h.renovation) {
      add('info', '🛠️', 'Renovating', `Closed for ${h.renovation.biome ? 're-landscaping' : 'renovation'}. Reopens in about ${Math.ceil(h.renovation.days / 30)} month(s). The animals are in off-exhibit holding.`);
      return { level: 'info', issues, summary: 'Renovating' };
    }

    // Physical condition
    if (h.condition < 55) {
      const ren = ZG.Habitats.renovateCost(s, h);
      add(h.condition < 40 ? 'bad' : 'warn', '🪵', 'Worn out',
        `Condition is ${Math.round(h.condition)}/100. Rotting logs, cracked moat walls and leaking pools lower welfare, guest ratings and your USDA and AZA inspection scores.${h.condition < 40 ? ' It will keep getting worse until it is renovated.' : ''}`,
        [fix(`Renovate (${$(ren)})`, 'renovate', { hab: h.id }), fix(`Raise the maintenance budget`, 'bumpPolicy', { key: 'maintenance', f: 1.25 })]);
    }
    if (!animals.length) {
      add('warn', '🪧', 'Empty', 'There are no animals here. Guests walk past an empty exhibit.', [fix('Find animals in the Animal Exchange', 'tab', { tab: 'animals' })]);
    }

    if (f && animals.length) {
      // Space
      if (f.spaceRatio < 1) {
        const bySp = {};
        for (const a of animals) bySp[a.sp] = (bySp[a.sp] || 0) + 1;
        const big = Object.keys(bySp).sort((a, b) => ZG.SPECIES[b].space * bySp[b] - ZG.SPECIES[a].space * bySp[a])[0];
        const fixes = [];
        const extra = D.surplusAnimal(s, h.id, big);
        const home = D.bestHome(s, big, h.id);
        if (extra && home) fixes.push(fix(`Move ${extra.name} to ${home.name}`, 'moveAnimal', { aid: extra.id, hab: home.id }));
        if (extra) fixes.push(fix(`Transfer ${extra.name} to another zoo`, 'sendOut', { aid: extra.id }));
        add('bad', '📏', 'Overcrowded',
          `The animals have only ${Math.round(f.spaceRatio * 100)}% of the minimum space they need (${U.num(h.area)} m² for ${animals.length} animals). Crowding causes fighting and stress.`, fixes);
      }
      // Mixing
      if (!f.mixOk) {
        const spIds = [...new Set(animals.map((a) => a.sp))];
        const fixes = [];
        for (const id of spIds.slice(1)) {
          const n = animals.filter((a) => a.sp === id).length;
          const home = D.bestHome(s, id, h.id, n);
          if (home) fixes.push(fix(`Move all ${ZG.SPECIES[id].name}s to ${home.name}`, 'moveSpecies', { sp: id, from: h.id, hab: home.id }));
        }
        add('bad', '⚔️', 'Species clash', `${spIds.map((id) => ZG.SPECIES[id].name).join(' and ')} should not share a habitat. Keepers are separating them every day.`, fixes.length ? fixes : [fix('Open the collection to move animals', 'tab', { tab: 'animals' })]);
      }
      // Keeper care
      if (f.care < 70) {
        const kr = ZG.Staff.ratio(s, 'keepers');
        const er = s.policy.enrichment / Math.max(1, Z.refs.enrichment);
        const need = Math.max(1, ZG.Staff.required(s, 'keepers') - s.staff.keepers.n - ZG.Staff.pending(s, 'keepers'));
        const fixes = [];
        if (kr < 0.95) fixes.push(fix(`Hire ${Math.min(need, 5)} keeper${need > 1 ? 's' : ''}`, 'hire', { dept: 'keepers', n: Math.min(need, 5) }));
        if (er < 1) fixes.push(fix('Restore the enrichment budget', 'bumpPolicy', { key: 'enrichment', to: Z.refs.enrichment }));
        add(f.care < 55 ? 'bad' : 'warn', '🧑‍🌾', 'Short on care',
          `Keeper care is ${Math.round(f.care)}/100. ${kr < 0.95 ? `Keepers are at ${Math.round(kr * 100)}% of the staff they need, so training and enrichment get skipped.` : ''} ${er < 1 ? 'The enrichment budget is below what the collection needs.' : ''}`.trim(), fixes);
      }
      // Per-species problems
      for (const id of Object.keys(f.per)) {
        const x = f.per[id];
        const sp = ZG.SPECIES[id];
        if (x.biome < 100) {
          const b = sp.biomes[0];
          const home = D.bestHome(s, id, h.id, x.n);
          const fixes = [fix(`Re-landscape as ${ZG.BIOMES[b].name} (${$(ZG.Habitats.relandscapeCost(s, h))})`, 'relandscape', { hab: h.id, biome: b })];
          if (home) fixes.unshift(fix(`Move the ${sp.name}s to ${home.name}`, 'moveSpecies', { sp: id, from: h.id, hab: home.id }));
          add('bad', '🌵', 'Wrong landscape', `${sp.name}s need ${sp.biomes.map((k) => ZG.BIOMES[k].name).join(' or ')}, but this is ${ZG.BIOMES[h.biome].name}.`, fixes);
        }
        if (x.climate < 85) {
          const hot = s.today.temp > sp.climate[1];
          const type = hot ? 'chilled' : 'heated';
          const cost = Math.round(1.2e6 * Z.costMult + h.area * 250);
          add(x.climate < 60 ? 'bad' : 'warn', hot ? '🥵' : '🥶', hot ? 'Too hot' : 'Too cold',
            `Today's ${s.today.temp}°F is ${Math.round(x.tempDiff)}°F ${hot ? 'above' : 'below'} what ${sp.name}s tolerate (${sp.climate[0]}–${sp.climate[1]}°F).`,
            h.climate === 'none' ? [fix(`Add a ${type} building (${$(cost)})`, 'climate', { hab: h.id, type })] : []);
        }
        if (x.social < 90) {
          const small = x.n < sp.group[0];
          const fixes = [];
          if (small && sp.program !== 'Loan') {
            const males = animals.filter((a) => a.sp === id && a.sex === 'M').length;
            const sex = males * 2 < x.n ? 'M' : 'F';
            fixes.push(fix(`Bring in a ${sex === 'M' ? 'male' : 'female'} ${sp.name} (${$(ZG.AZA.requestCost(s, id))} transport)`, 'requestAnimal', { sp: id, hab: h.id, sex }));
          } else if (!small) {
            const extra = D.surplusAnimal(s, h.id, id);
            if (extra) fixes.push(fix(`Transfer ${extra.name} to another zoo`, 'sendOut', { aid: extra.id }));
          }
          add(x.social < 70 ? 'bad' : 'warn', '👥', small ? 'Lonely' : 'Group too big',
            small ? `${x.n === 1 ? 'A lone' : `Only ${x.n}`} ${sp.name}${x.n === 1 ? '' : 's'}. This species lives in groups of ${sp.group[0]}–${sp.group[1]}.` : `${x.n} ${sp.name}s is more than the natural group size of ${sp.group[0]}–${sp.group[1]}. Expect squabbles.`, fixes);
        }
      }
    }
    // Health
    const sick = animals.filter((a) => a.sick && a.sick.sev >= 2);
    if (sick.length) {
      const vr = ZG.Staff.ratio(s, 'vets');
      add('warn', '🤒', 'Sick animals', `${sick.map((a) => `${a.name} (${a.sick.name})`).join(', ')}.${vr < 0.9 ? ' The vet team is stretched thin.' : ''}`, vr < 0.9 ? [fix('Hire a veterinarian', 'hire', { dept: 'vets', n: 1 })] : []);
    }
    if (h.theming < 35) {
      add('warn', '🎨', 'Dated look', `Theming is ${Math.round(h.theming)}/100: faded signs, bare concrete and no viewing blinds. Guests rate it poorly.`, [fix(`Improve theming (${$(Math.round(h.area * 220 * Z.costMult))})`, 'theming', { hab: h.id })]);
    }
    const rank = { bad: 3, warn: 2, info: 1 };
    issues.sort((a, b) => rank[b.sev] - rank[a.sev]);
    const level = issues.some((i) => i.sev === 'bad') ? 'bad' : issues.some((i) => i.sev === 'warn') ? 'warn' : 'ok';
    return { level, issues, summary: issues.filter((i) => i.sev !== 'info').map((i) => i.short).slice(0, 3).join(' · ') };
  };
})((globalThis.ZG = globalThis.ZG || {}));
