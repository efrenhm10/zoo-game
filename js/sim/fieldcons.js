// Field conservation partners: nonprofit organizations the zoo funds and works with.
// Your field-conservation budget is shared among up to three partners; together you
// run projects (ranger teams, vet expeditions, releases, conservation days, research)
// and get field reports back.
(function (ZG) {
  const U = ZG.U;
  const F = (ZG.Field = {});
  const $ = (n) => U.money(n);

  F.PARTNERS = {
    rainforest: { icon: '🌧️', name: 'Rainforest Keepers Alliance', region: 'Borneo & Sumatra', species: ['orangutan', 'sumatran_orangutan', 'sumatran_tiger', 'malayan_tiger', 'siamang', 'sun_bear', 'clouded_leopard', 'water_monitor'], work: 'protects peat-swamp forest from palm-oil clearing and runs orangutan rescue centers' },
    savanna: { icon: '🦁', name: 'Savanna Guardians Trust', region: 'East & Southern Africa', species: ['lion', 'cheetah', 'giraffe', 'masai_giraffe', 'grevys_zebra', 'plains_zebra', 'african_wild_dog', 'spotted_hyena', 'african_leopard', 'ostrich', 'warthog', 'african_buffalo', 'greater_kudu'], work: 'pays community scouts, builds predator-proof livestock bomas and counts wildlife on the plains' },
    elephants: { icon: '🐘', name: 'Elephant Range Partnership', region: 'African & Asian elephant ranges', species: ['african_elephant', 'asian_elephant'], work: 'tracks herds with GPS collars, reduces human–elephant conflict and funds EEHV research' },
    rhinos: { icon: '🦏', name: 'Rhino Horizons', region: 'Kenya, South Africa & Namibia', species: ['white_rhino', 'black_rhino'], work: 'funds anti-poaching units and moves rhinos into safe sanctuaries' },
    bigcats: { icon: '🐯', name: 'Big Cat Corridors Fund', region: 'Russian Far East to South America', species: ['amur_tiger', 'amur_leopard', 'snow_leopard', 'jaguar', 'mountain_lion', 'sumatran_tiger', 'malayan_tiger'], work: 'keeps wildlife corridors open between protected areas and monitors cats with camera traps' },
    apes: { icon: '🦍', name: 'Great Ape Sanctuary Network', region: 'Central Africa', species: ['gorilla', 'chimpanzee', 'bonobo'], work: 'runs orphan sanctuaries and trains wildlife-health vets' },
    pacific: { icon: '🌺', name: 'Pacific Islands Bird Recovery', region: 'Hawaiʻi & the Pacific', species: ['nene', 'california_condor', 'flamingo', 'chilean_flamingo'], release: ['nene', 'california_condor'], work: 'breeds endangered native birds for release and controls invasive predators' },
    oceans: { icon: '🌊', name: 'Ocean & Shore Rescue Network', region: 'Coasts of the Americas & Africa', species: ['african_penguin', 'humboldt_penguin', 'sea_lion', 'gray_seal', 'river_otter', 'nile_crocodile', 'alligator'], work: 'rescues oiled and stranded animals and protects seabird nesting colonies' },
    northamerica: { icon: '🦬', name: 'North American Wildlife Recovery', region: 'Western U.S. & Mexico', species: ['mexican_wolf', 'bison', 'grizzly_bear', 'black_bear', 'moose', 'california_condor', 'mountain_lion'], release: ['mexican_wolf', 'bison', 'california_condor'], work: 'restores wolves, bison and condors to their historic range' },
    bamboo: { icon: '🎋', name: 'Bamboo Forest Conservancy', region: 'Sichuan & the Himalayas', species: ['giant_panda', 'red_panda'], work: 'plants bamboo corridors and pays forest guardians in panda country' },
  };

  F.PROJECTS = {
    rangers: { icon: '🚙', name: 'Fund a ranger team', days: 180, cost: (s) => F.target(s) * 0.4, desc: 'Six months of scouts and rangers on patrol.' },
    vets: { icon: '🩺', name: 'Send your vet team to the field', days: 60, cost: (s) => 25000 * ZG.zoo(s).costMult, desc: 'Two of your vets work in the field for two months. You’re short-handed at home, but morale and skills go up.' },
    release: { icon: '🕊️', name: 'Release an animal to the wild', days: 30, cost: () => 12000, desc: 'Send one of your animals home to the wild. Only a few species qualify.' },
    day: { icon: '🎟️', name: 'Host a conservation day at the zoo', days: 10, cost: () => 8000, desc: 'Talks, activities and a donation drive with the partner’s field staff.' },
    research: { icon: '🔬', name: 'Joint research study', days: 120, cost: () => 15000, desc: 'Your keepers collect behavior and health data for the partner’s scientists.' },
  };

  F.MAX = 3;
  F.target = (s) => Math.max(40000, ZG.zoo(s).refs.conservation * 0.5); // full funding per partner
  F.init = (s) => {
    if (!s.field) s.field = { partners: [], roundUp: false, roundUpYtd: 0, stats: { rangers: 0, released: 0, vetTrips: 0, days: 0, studies: 0 }, reports: [] };
  };
  F.held = (s, id) => F.PARTNERS[id].species.filter((sp) => s.animals.some((a) => a.sp === sp));
  F.funding = (s) => (s.field.partners.length ? s.policy.conservation / s.field.partners.length : 0);
  F.report = (s, id, text) => {
    s.field.reports.unshift({ day: s.day, id, text });
    if (s.field.reports.length > 25) s.field.reports.pop();
  };

  // Partners that fit your collection first.
  F.suggest = (s) => Object.keys(F.PARTNERS).sort((a, b) => F.held(s, b).length - F.held(s, a).length);

  F.join = function (s, id) {
    const P = F.PARTNERS[id];
    if (!P) return { ok: false, msg: 'Unknown partner.' };
    if (s.field.partners.some((p) => p.id === id)) return { ok: false, msg: 'Already a partner.' };
    if (s.field.partners.length >= F.MAX) return { ok: false, msg: `You can support ${F.MAX} partners well. End one partnership first.` };
    s.field.partners.push({ id, joined: s.day, impact: 0, milestones: 0, project: null });
    const held = F.held(s, id);
    ZG.Sim.news(s, `🌍 New field partnership: ${P.name} (${P.region}).${held.length ? ` Guests will see the link to your ${held.map((x) => ZG.SPECIES[x].name).join(', ')}.` : ''}`, 'good');
    return { ok: true, msg: `Partnership signed with ${P.name}. Your field-conservation budget is now shared among ${s.field.partners.length} partner${s.field.partners.length > 1 ? 's' : ''}.` };
  };
  F.leave = function (s, id) {
    const i = s.field.partners.findIndex((p) => p.id === id);
    if (i < 0) return { ok: false, msg: 'Not a partner.' };
    const p = s.field.partners[i];
    if (p.project && p.project.type === 'vets') s.staff.vets.n += p.project.away || 0;
    s.field.partners.splice(i, 1);
    s.rep = U.clamp(s.rep - 1, 0, 100);
    s.aza = U.clamp(s.aza - 1, 0, 100);
    return { ok: true, msg: `Partnership with ${F.PARTNERS[id].name} ended. Field staff were disappointed.` };
  };

  F.releaseCandidates = function (s, id) {
    const rel = F.PARTNERS[id].release || [];
    return s.animals.filter((a) => rel.includes(a.sp) && !a.star && a.loc === 'hab' && a.age > ZG.SPECIES[a.sp].mature * 365 && a.age < ZG.SPECIES[a.sp].life * 365 * 0.6);
  };

  F.start = function (s, id, type) {
    const p = s.field.partners.find((x) => x.id === id);
    const T = F.PROJECTS[type];
    if (!p || !T) return { ok: false, msg: 'Not available.' };
    if (p.project) return { ok: false, msg: 'A project with this partner is already underway.' };
    const cost = Math.round(T.cost(s) / 1000) * 1000;
    if (!ZG.Econ.canAfford(s, cost)) return { ok: false, msg: `Not enough funds (${$(cost)}).` };
    const proj = { type, start: s.day, end: s.day + T.days, cost };
    if (type === 'vets') {
      if (s.staff.vets.n < 4) return { ok: false, msg: 'You need at least 4 veterinarians to spare two for the field.' };
      s.staff.vets.n -= 2;
      proj.away = 2;
    }
    if (type === 'release') {
      const a = F.releaseCandidates(s, id)[0];
      if (!a) return { ok: false, msg: `None of your animals qualify. ${F.PARTNERS[id].name} releases ${(F.PARTNERS[id].release || []).map((x) => ZG.SPECIES[x].name).join(', ') || 'no species from zoos'}.` };
      proj.aid = a.id;
      proj.name = a.name;
      proj.sp = a.sp;
      a.loc = 'quarantine';
      a.qDays = T.days + 5;
    }
    ZG.Econ.spend(s, 'conservation', cost);
    p.project = proj;
    return { ok: true, msg: `${T.icon} ${T.name} with ${F.PARTNERS[id].name} (${$(cost)}). Results in about ${Math.round(T.days / 30) || 1} month(s).` };
  };

  const an = (w) => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
  const FIELD_NEWS = [
    (P, sp) => `Camera traps funded by the zoo caught ${an(sp)} with young in ${P.region}.`,
    (P, sp) => `${P.name} scouts reported the first poaching-free quarter in their area.`,
    (P, sp) => `A school program run with ${P.name} reached 1,200 children in ${P.region}.`,
    (P, sp) => `${P.name} restored another 300 acres of habitat with your support.`,
    (P, sp) => `${an(sp).replace(/^a/, 'A')} with a satellite collar crossed a corridor ${P.name} protects, a first in years.`,
  ];

  F.finish = function (s, p) {
    const P = F.PARTNERS[p.id], pr = p.project, T = F.PROJECTS[pr.type];
    let html = '';
    if (pr.type === 'rangers') {
      const n = U.ri(s, 4, 12);
      s.field.stats.rangers += n;
      p.impact += 8;
      s.rep = U.clamp(s.rep + 1, 0, 100);
      html = `<p>The ${n}-person ranger team you funded finished six months on patrol. They removed ${U.ri(s, 40, 300)} snares and helped arrest ${U.ri(s, 1, 6)} poachers.</p>`;
    } else if (pr.type === 'vets') {
      s.staff.vets.n += pr.away;
      s.field.stats.vetTrips++;
      p.impact += 6;
      s.aza = U.clamp(s.aza + 3, 0, 100);
      s.morale = U.clamp(s.morale + 4, 0, 100);
      html = `<p>Your two vets are home from ${P.region}. They treated wild animals, trained local vets, and came back full of stories. The whole team is energized.</p>`;
    } else if (pr.type === 'release') {
      const a = ZG.Animals.byId(s, pr.aid);
      if (a) ZG.Animals.remove(s, a);
      s.field.stats.released++;
      s.stats.releases = (s.stats.releases || 0) + 1;
      p.impact += 12;
      s.aza = U.clamp(s.aza + 6, 0, 100);
      s.rep = U.clamp(s.rep + 4, 0, 100);
      html = `<p><b>${U.esc(pr.name)}</b> the ${ZG.SPECIES[pr.sp].name} was released into the wild in ${P.region}. Keepers watched the livestream through happy tears, and the story went national.</p>`;
    } else if (pr.type === 'day') {
      const raised = Math.round(s.att.avg30 * U.rf(s, 0.8, 1.6) * 2);
      s.field.stats.days++;
      p.impact += 3 + raised / F.target(s) * 4;
      s.rep = U.clamp(s.rep + 1, 0, 100);
      if (s.donors) ZG.Donors.react(s, 2, (d) => d.interest.kind === 'conservation');
      html = `<p>Guests met ${P.name}’s field staff and donated <b>${$(raised)}</b> straight to the partner. Conservation-minded donors noticed.</p>`;
    } else if (pr.type === 'research') {
      s.field.stats.studies++;
      p.impact += 5;
      s.aza = U.clamp(s.aza + 2, 0, 100);
      s.flags.researchBoost = s.day + 365;
      html = `<p>The joint study with ${P.name} was accepted for publication. It strengthens your conservation grant applications for a year.</p>`;
    }
    F.report(s, p.id, `${T.icon} ${T.name}: done.`);
    p.project = null;
    ZG.Events.queue(s, 'zoo_event_result', { icon: P.icon, title: `${P.name}: ${T.name.toLowerCase()}`, html });
  };

  F.daily = function (s) {
    for (const p of s.field.partners) if (p.project && s.day >= p.project.end) F.finish(s, p);
    if (s.field.roundUp && !s.closure) {
      const r = s.today.paying * 0.35; // share of paying guests who round up ~$1
      s.field.roundUpYtd += r;
      s.field.pool = (s.field.pool || 0) + r;
    }
  };

  F.monthly = function (s, t) {
    if (t && t.m === 0) s.field.roundUpYtd = 0;
    const ps = s.field.partners;
    if (!ps.length) return;
    const each = F.funding(s) + (s.field.pool || 0) / ps.length;
    s.field.pool = 0;
    for (const p of ps) {
      const P = F.PARTNERS[p.id];
      const held = F.held(s, p.id);
      p.impact += Math.min(2, (each / F.target(s)) * 1) * (held.length ? 1.25 : 1);
      if (Math.floor(p.impact / 12) > p.milestones) {
        p.milestones = Math.floor(p.impact / 12);
        const sp = held.length ? ZG.SPECIES[U.pick(s, held)].name.toLowerCase() : ZG.SPECIES[U.pick(s, P.species)].name.toLowerCase();
        const text = U.pick(s, FIELD_NEWS)(P, sp);
        F.report(s, p.id, text);
        s.aza = U.clamp(s.aza + 1, 0, 100);
        s.rep = U.clamp(s.rep + 0.7, 0, 100);
        if (s.donors) ZG.Donors.react(s, 1, (d) => d.interest.kind === 'conservation');
        ZG.Sim.news(s, `${P.icon} Field report: ${text}`, 'good');
      }
    }
    if (s.field.roundUp) s.rep = U.clamp(s.rep + 0.1, 0, 100);
  };
})((globalThis.ZG = globalThis.ZG || {}));
