// Event engine + the library of dilemmas, disasters and notices.
(function (ZG) {
  const U = ZG.U;
  const EV = (ZG.Events = { defs: {} });
  const def = (id, o) => (EV.defs[id] = Object.assign({ id, cat: 'general', weight: null, cooldown: 120 }, o));

  // ---------- helpers ----------
  const Z = (s) => ZG.zoo(s);
  const SP = (id) => ZG.SPECIES[id];
  const clamp = U.clamp;
  const rep = (s, d) => {
    if (d < 0) d = (d * (s.zooId === 'sandiego' ? 1.4 : 1)) / ZG.mod(s, 'media');
    s.rep = clamp(s.rep + d, 0, 100);
  };
  const board = (s, d) => (s.board = clamp(s.board + d, 0, 100));
  const aza = (s, d) => (s.aza = clamp(s.aza + d, 0, 100));
  const pol = (s, d) => (s.gov.relationship = clamp(s.gov.relationship + d, 0, 100));
  const morale = (s, d) => (s.morale = clamp(s.morale + d, 0, 100));
  const scale = (s) => Z(s).infraScale; // 1 (Honolulu) … 4 (San Diego)
  const $ = (n) => U.money(n);
  const close = (s, days, reason) => {
    if (!s.closure || s.closure.days < days) s.closure = { reason, days };
  };
  const pay = (s, cat, amt) => ZG.Econ.spend(s, cat, Math.round(amt));
  const payCap = (s, cat, amt) => ZG.Econ.spendCapital(s, cat, Math.round(amt));
  const living = (s, id) => ZG.Animals.byId(s, id);
  const hasSp = (s, test) => s.animals.some((a) => test(a.sp));
  const govIsPublic = (s) => ['city', 'federal', 'contract'].includes(s.gov.type);
  const damageHabitats = (s, amt, frac) => {
    for (const h of s.habitats) if (!h.construction && U.chance(s, frac)) h.condition = Math.max(0, h.condition - amt * U.rf(s, 0.5, 1.3));
  };
  const hurtAnimals = (s, amt, filter) => {
    for (const a of s.animals) if (!filter || filter(a)) a.health = Math.max(5, a.health - amt * U.rf(s, 0.3, 1.2));
  };

  // ---------- engine ----------
  EV.queue = function (s, id, ctx) {
    if (!EV.defs[id]) return;
    s.eventQueue.push({ id, ctx: ctx || {}, day: s.day });
  };
  EV.pending = (s) => s.eventQueue.length > 0;
  EV.view = function (s) {
    const e = s.eventQueue[0];
    if (!e) return null;
    const d = EV.defs[e.id];
    const v = d.make(s, e.ctx) || { title: 'Resolved', text: 'This situation resolved itself.', choices: [{ label: 'OK', apply: () => '' }] };
    v.cat = d.cat;
    for (const c of v.choices) {
      if (c.cost && !c.disabled && !ZG.Econ.canAfford(s, c.cost - ZG.Reserve.available(s), c.capital)) {
        c.disabled = true;
        c.why = 'Not enough funds (incl. credit line)';
      }
    }
    // Never leave the player stuck: if nothing is affordable, the cheapest option can
    // still be taken on emergency credit, at a cost to your boss's confidence.
    if (v.choices.every((c) => c.disabled)) {
      const cheapest = v.choices.slice().sort((a, b) => (a.cost || 0) - (b.cost || 0))[0];
      const apply = cheapest.apply;
      v.choices.push(Object.assign({}, cheapest, {
        label: `${cheapest.label} — on emergency credit`,
        detail: 'You are past your credit limit. The bank charges interest and your boss will hear about it.',
        disabled: false, why: '',
        apply: (s, ctx) => { board(s, -4); return ((apply && apply(s, ctx)) || '') + ' Finance had to go past the credit limit to pay for it.'; },
      }));
    }
    return v;
  };
  EV.choose = function (s, idx) {
    const e = s.eventQueue[0];
    if (!e) return null;
    const v = EV.view(s);
    const c = v.choices[idx] || v.choices[0];
    s.eventQueue.shift();
    if (c.cost) (c.capital ? payCap : pay)(s, c.costCat || 'other', c.cost);
    const result = (c.apply && c.apply(s, e.ctx)) || '';
    ZG.Reserve.afterEvent(s, e.id, v.title || '', c.cost || 0);
    s.log.unshift({ day: s.day, title: v.title, choice: c.label, result, icon: v.icon || '📌' });
    if (s.log.length > 120) s.log.pop();
    return { title: v.title, icon: v.icon, result, choice: c.label, open: c.open, sub: c.sub };
  };
  EV.autoChoose = function (s) {
    const v = EV.view(s);
    let idx = v.choices.findIndex((c) => !c.disabled);
    if (v.choices.length > 1 && U.rand(s) < 0.5) {
      const ok = v.choices.map((c, i) => (c.disabled ? -1 : i)).filter((i) => i >= 0);
      idx = ok[Math.floor(U.rand(s) * ok.length)];
    }
    return EV.choose(s, Math.max(0, idx));
  };

  const HAZARD_MONTHS = {
    hurricane: { honolulu: [6, 7, 8, 9, 10], houston: [5, 6, 7, 8, 8, 9, 9, 10] },
    heatwave: { honolulu: [7, 8, 9], default: [5, 6, 7, 8] },
    wildfire: { cheyenne: [4, 5, 6, 7, 8, 9], sandiego: [7, 8, 9, 10] },
    blizzard: { cheyenne: [0, 1, 2, 3, 9, 10, 11], national: [0, 1, 11] },
    freeze: { default: [0, 1, 11] },
    hail: { default: [4, 5, 6, 7] },
    drought: { default: [5, 6, 7, 8] },
    derecho: { default: [5, 6, 7] },
  };
  EV.daily = function (s, t) {
    // Natural hazards
    const hz = Z(s).hazards;
    for (const k in hz) {
      const months = HAZARD_MONTHS[k] ? HAZARD_MONTHS[k][s.zooId] || HAZARD_MONTHS[k].default : null;
      if (months && !months.includes(t.m)) continue;
      const frac = months ? new Set(months).size / 12 : 1;
      const key = 'hz_' + k;
      if (s.cooldowns[key] && s.day < s.cooldowns[key]) continue;
      const bump = months ? months.filter((m) => m === t.m).length : 1;
      if (U.rand(s) < U.annualToDaily(hz[k] / frac) * bump) {
        s.cooldowns[key] = s.day + 45;
        EV.queue(s, k, EV.defs[k].prep ? EV.defs[k].prep(s) : {});
      }
    }
    // Random dilemmas: about one every ~12 days
    if (s.eventQueue.length || U.rand(s) > 1 / 12) return;
    const pool = Object.values(EV.defs).filter((d) => d.weight && !(s.cooldowns[d.id] > s.day));
    const d = U.weighted(s, pool, (d) => d.weight(s, t));
    if (!d) return;
    s.cooldowns[d.id] = s.day + (d.cooldown || 120);
    EV.queue(s, d.id, d.prep ? d.prep(s) : {});
  };

  // =====================================================================
  // TRIGGERED EVENTS
  // =====================================================================
  def('zoo_event_result', {
    cat: 'guest',
    make: (s, c) => ({ icon: c.icon, title: c.title, text: c.html, choices: [{ label: 'OK', apply: () => '' }] }),
  });

  def('ssp_plan', {
    cat: 'aza',
    make: (s, c) => {
      const open = s.ssp.recs.filter((r) => r.status === 'open');
      if (!open.length) return null;
      const icon = { breed: '💞 Breed', nobreed: '🚫 Do not breed', send: '📤 Send out', receive: '📥 Receive', hold: '🏠 Hold space for' };
      const rows = open.map((r) => `<li><b>${icon[r.type]}</b> ${SP(r.sp).name}: ${U.esc(r.text)} <small>(respond by ${U.fmtDate(r.deadline)})</small></li>`).join('');
      return { icon: '🧬', title: `${c.year} SSP Breeding & Transfer Plans`,
        text: `<p>Species Survival Plan coordinators manage each species as one North American population, pairing animals across zoos to keep them genetically healthy. This year they have <b>${open.length} recommendation${open.length > 1 ? 's' : ''}</b> for you:</p><ul>${rows}</ul><p class="sub">Accepting earns AZA standing. Declining is allowed but noticed. Births from recommended pairings earn the biggest bonus.</p>`,
        choices: [
          { label: 'Review and respond now', detail: 'Opens Conservation → SSP plans', open: 'conservation', sub: 'ssp', apply: () => '' },
          { label: 'Later', apply: () => '' },
        ] };
    },
  });

  def('intro', {
    cat: 'story',
    make: (s) => {
      const z = Z(s);
      const d = s.director;
      const from = z.governance === 'city' ? 'Office of the Mayor' : z.governance === 'federal' ? 'Office of the Secretary, Smithsonian Institution' : 'Chair, Board of Trustees';
      return {
        icon: '✉️', title: `Welcome, Director ${d.name.split(' ').slice(-1)[0]}`,
        text: `<p><em>From the ${from}:</em></p><p>Dear ${ZG.pronoun(s).title} ${d.name.split(' ').slice(-1)[0]},</p><p>Congratulations on your appointment as Director of the <b>${z.name}</b>. ${z.blurb}</p><p>Your performance will be judged on these goals by the end of ${ZG.OBJ_DEADLINE}:</p><ul>${z.objectives.map((o) => `<li>${o.text}</li>`).join('')}</ul><p>Walk the grounds, get to know the animals, and remember: every decision echoes through the budget.</p>`,
        choices: [{ label: 'Get to work', apply: () => 'Your first day begins.' }],
      };
    },
  });

  def('illness', {
    cat: 'animal',
    make: (s, c) => {
      const a = living(s, c.aid);
      if (!a || !a.sick) return null;
      const sp = SP(a.sp);
      const eehv = /EEHV/.test(a.sick.name);
      const heart = /Cardiac/.test(a.sick.name);
      const sevTxt = ['mild', 'moderate', 'serious'][a.sick.sev - 1];
      const old = a.age / (sp.life * 365) > 0.85;
      const extra = eehv
        ? '<p>EEHV is the leading killer of young elephants in human care. Treatment means round-the-clock care, antivirals and plasma transfusions from other elephants — and even then, it can move frighteningly fast.</p>'
        : heart
          ? '<p>Heart disease is the leading cause of death in adult male gorillas. Cardiologists can volunteer for an echo under anesthesia; treatment is lifelong medication.</p>'
          : '';
      const ch = [
        { label: 'Aggressive treatment', detail: 'Specialists, advanced diagnostics, 24/7 monitoring', cost: c.cost * 2.4, costCat: 'vetcare',
          apply: (s) => {
            a.sick.treated = true;
            a.sick.plan = 'aggressive';
            a.sick.sev = Math.max(1, a.sick.sev - 1);
            a.sick.days = Math.ceil(a.sick.days * 0.6);
            morale(s, 2);
            return `The team threw everything at it. ${a.name}'s prognosis improved.`;
          } },
        { label: 'Standard treatment', detail: 'Your vet team manages it in-house', cost: c.cost, costCat: 'vetcare',
          apply: (s) => {
            a.sick.treated = true;
            a.sick.plan = 'standard';
            return `${a.name} is being treated. Recovery will take time.`;
          } },
        { label: 'Monitor and wait', detail: 'Save money, accept the risk',
          apply: (s) => {
            morale(s, -3);
            return `Keepers are uneasy, but you're watching ${a.name} closely.`;
          } },
      ];
      if (a.sick.sev === 3 && old)
        ch.push({ label: 'Humane euthanasia', detail: 'End suffering for an elderly animal',
          apply: (s) => {
            ZG.Animals.die(s, a, a.sick.name + ' (humane euthanasia)');
            return `A painful, compassionate decision. Keepers gathered to say goodbye to ${a.name}.`;
          } });
      return { icon: '🩺', title: `${a.name} the ${sp.name} is sick`,
        text: `<p>Diagnosis: <b>${a.sick.name}</b> (${sevTxt}). ${a.name} is ${U.ageStr(a.age)} old; health ${Math.round(a.health)}/100.</p>${extra}${old ? `<p>${a.name} is elderly for the species.</p>` : ''}`,
        choices: ch };
    },
  });

  def('death', {
    cat: 'animal',
    make: (s, c) => {
      const sp = SP(c.sp);
      const scaleCost = 15000 * scale(s);
      return { icon: '🕊️', title: `Loss: ${c.name} the ${sp.name}`,
        text: `<p>${c.name}${c.hab ? ` of ${c.hab}` : ''} died at ${U.ageStr(c.age)} (${c.cause}). ${c.star ? '<b>This was one of the most beloved animals in the zoo.</b> Local news is already calling.' : 'Keepers who cared for them every day are grieving.'}</p><p>A necropsy will be performed. How do you tell the public?</p>`,
        choices: [
          { label: 'Heartfelt public statement & memorial', detail: 'Tribute on site, keeper stories, grief resources', cost: scaleCost, costCat: 'events',
            apply: (s) => { rep(s, c.star ? 3 : 1); morale(s, 3); return 'The community responded with an outpouring of love and memories.'; } },
          { label: 'Brief announcement on social media', apply: (s) => { if (c.star) rep(s, -2); return 'Short and factual. Some fans felt it was cold.'; } },
          { label: 'Publish full necropsy findings for science', detail: 'Transparency and research value', apply: (s) => { aza(s, 1.5); rep(s, 0.5); return 'Researchers and the SSP thanked you for the data.'; } },
        ] };
    },
  });

  def('birth', {
    cat: 'animal',
    make: (s, c) => {
      const babies = c.aids.map((id) => living(s, id)).filter(Boolean);
      if (!babies.length) return null;
      const mom = living(s, c.mom);
      const sp = SP(babies[0].sp);
      const val = Math.round(sp.appeal * 6000 * Math.sqrt(scale(s)) * (babies.length > 1 ? 1.4 : 1));
      const sspTxt = c.ssp === 'recommended' ? '<p class="good">✅ This was an SSP-recommended pairing — a genuine conservation win.</p>' : c.ssp === 'unplanned' ? '<p class="bad">⚠️ This birth was not recommended by the SSP.</p>' : '';
      return { icon: '🍼', title: `It's a ${babies.length > 1 ? babies.length + '-baby litter' : babies[0].sex === 'F' ? 'girl' : 'boy'}! ${sp.name} born`,
        text: `<p>${mom ? mom.name : 'The mother'} delivered ${babies.length > 1 ? babies.length + ' healthy babies' : 'a healthy baby'}${c.lost ? ` (${c.lost} did not survive)` : ''}. Keepers watched on the barn cameras all night.</p>${sspTxt}<p>How do you introduce ${babies.length > 1 ? 'them' : 'the baby'} to the world?</p>`,
        choices: [
          { label: 'Public naming contest fundraiser', detail: `Pay-to-vote naming (~${$(val)})`, apply: (s) => {
            ZG.Econ.earn(s, 'donations', val * U.rf(s, 0.7, 1.3));
            rep(s, 1.5);
            s.novelty = Math.min(0.8, s.novelty + 0.04);
            babies[0].name = U.pick(s, ZG.NAMES.animal.misc.concat(ZG.NAMES.animal.african, ZG.NAMES.animal.asian));
            return `Thousands voted! The winning name: ${babies[0].name}.`;
          } },
          { label: 'Let the keepers name it', detail: 'A morale boost for the animal-care team', apply: (s) => { morale(s, 5); return `The keepers chose "${babies[0].name}". They were thrilled to be asked.`; } },
          { label: 'Auction naming rights to a donor', detail: 'Bigger money, some grumbling', apply: (s) => {
            ZG.Econ.earn(s, 'donations', val * 1.8);
            rep(s, -0.5);
            return `A donor paid handsomely to name the baby "${babies[0].name}".`;
          } },
          { label: 'Launch a 24/7 baby cam', detail: 'Marketing push', cost: 25000 * Math.sqrt(scale(s)), costCat: 'marketing', apply: (s) => {
            s.novelty = Math.min(0.8, s.novelty + 0.1);
            rep(s, 1);
            return 'The baby cam racked up millions of views.';
          } },
        ] };
    },
  });

  def('rejection', {
    cat: 'animal',
    make: (s, c) => {
      const b = living(s, c.aid);
      if (!b) return null;
      const sp = SP(b.sp);
      const foster = s.animals.find((a) => a.sp === b.sp && a.sex === 'F' && a.id !== b.dam && ZG.Animals.isMature(a) && a.hab === b.hab);
      const ch = [
        { label: 'Hand-rear in the animal hospital', detail: 'Round-the-clock bottle feeding by staff', cost: 20000 + sp.food * 0.5, costCat: 'vetcare', apply: (s) => {
          morale(s, -2);
          if (U.chance(s, 0.85)) { b.health = 80; aza(s, -0.5); return `${b.name} is thriving on the bottle. Reintroduction to the group will take patience.`; }
          ZG.Animals.die(s, b, 'complications while hand-rearing');
          return 'Despite heroic efforts, the infant did not make it.';
        } },
        { label: 'Assisted mother-rearing', detail: 'Keep the baby with the group; supplement feeds', cost: 8000, costCat: 'vetcare', apply: (s) => {
          if (U.chance(s, 0.55)) { aza(s, 1); return 'It worked — the infant is nursing and bonding with the group.'; }
          ZG.Animals.die(s, b, 'failure to thrive');
          return 'The infant weakened and could not be saved.';
        } },
      ];
      if (foster && sp.cls === 'mammal')
        ch.unshift({ label: `Try fostering with ${foster.name}`, detail: 'Best outcome for social development — if it works', apply: (s) => {
          if (U.chance(s, 0.65)) { aza(s, 2); rep(s, 1); return `${foster.name} accepted the infant! Keepers cried happy tears.`; }
          b.health -= 20;
          return `${foster.name} was not interested. The team switches to bottle-feeding as a backup.`;
        } });
      return { icon: '🍼', title: c.orphan ? `Orphaned ${sp.name} infant` : `${sp.name} mother rejected her baby`,
        text: `<p>${c.orphan ? `${b.name}'s mother has died, leaving a dependent infant.` : `The mother is not nursing ${b.name}. Without intervention the baby will not survive.`}</p>`,
        choices: ch };
    },
  });

  def('breakdown', {
    cat: 'infra',
    make: (s, c) => {
      const sys = ZG.Infra.sys(c.sys);
      const st = s.infra[c.sys];
      const emergency = Math.round(st.cost * U.rf(s, 0.05, 0.08));
      const full = Math.round(ZG.Infra.repairCost(s, c.sys, 92) * 1.15);
      const consequences = {
        water: 'Parts of the zoo have no water — restrooms are closed and keepers are hauling water to animals.',
        power: 'Several animal buildings are on generator power, and the generators are old.',
        life: 'Pool filtration and climate control failed in at least one habitat. Water quality is dropping.',
        visitor: 'Restrooms are closed and a section of boardwalk is roped off. Guests are complaining.',
        hospital: 'The animal hospital is running at half capacity. Surgeries are postponed.',
        commissary: 'Thousands of dollars of animal food is spoiling. Staff are scrambling to buy replacements.',
        perimeter: 'There is a gap in the perimeter fence. Security is patrolling around the clock.',
        admin: 'Water is dripping onto the education center floor. Summer camp starts soon.',
      }[c.sys];
      return { icon: sys.icon, title: `${sys.fail}!`,
        text: `<p>${consequences}</p><p>Condition of <b>${sys.name}</b>: ${Math.round(st.cond)}/100. Deferred maintenance has a way of coming due all at once.</p>`,
        choices: [
          { label: 'Emergency repair', detail: 'Fix it now at premium contractor rates (+15 condition)', cost: emergency, costCat: 'emergency', apply: (s) => {
            st.cond = Math.min(100, st.cond + 15);
            if (c.sys === 'water' || c.sys === 'power') close(s, 1, sys.name + ' repair');
            return 'Crews worked through the night. Fixed — for now.';
          } },
          { label: 'Full replacement', detail: 'Draw on capital funds; rebuild the system properly (→ 92)', cost: full, capital: true, costCat: 'capitalRepairs', apply: (s) => {
            st.cond = 92;
            pol(s, 1);
            close(s, c.sys === 'water' || c.sys === 'power' ? 3 : 0, sys.name + ' replacement');
            return 'A painful check, but this system should be reliable for decades.';
          } },
          { label: 'Patch it and move on', detail: 'Cheapest; it will break again', cost: Math.round(emergency * 0.25), costCat: 'emergency', apply: (s) => {
            st.cond = Math.min(100, st.cond + 3);
            st.lastFail = s.day - 60;
            if (c.sys === 'life') hurtAnimals(s, 15, (a) => ['aquatic', 'arctic', 'wetland'].some((b) => SP(a.sp).biomes.includes(b)));
            if (c.sys === 'visitor') s.satisfaction -= 8;
            if (c.sys === 'commissary') pay(s, 'animalcare', emergency * 0.3);
            morale(s, -2);
            return 'Duct tape and prayers. Your maintenance chief is not happy.';
          } },
        ] };
    },
  });

  def('habitat_open', {
    cat: 'story',
    make: (s, c) => {
      const h = s.habitatsById[c.hid];
      if (!h) return null;
      return { icon: '🎉', title: `${h.name} is finished!`,
        text: `<p>The contractors have handed over the keys. Now you need animals: check the <b>Animal Exchange</b> and any SSP "receive" recommendations to populate it. How do you open it?</p>`,
        choices: [
          { label: 'Ribbon-cutting donor gala', detail: 'Thank donors, court new ones', cost: 60000 * scale(s), costCat: 'events', apply: (s) => { ZG.Dev.newProspect(s); ZG.Dev.newProspect(s); ZG.Econ.earn(s, 'donations', 150000 * scale(s) * U.rf(s, 0.6, 1.4)); board(s, 3); return 'Donors loved the sneak peek. Two new prospects are interested in giving.'; } },
          { label: 'Members-only preview week', apply: (s) => { s.members = Math.round(s.members * 1.02); return 'Membership sign-ups spiked.'; } },
          { label: 'Just open the gates', apply: () => 'The public streamed in.' },
        ] };
    },
  });

  def('inspection_warning', {
    cat: 'aza',
    make: (s) => {
      const sc = ZG.AZA.inspectionScore(s);
      return { icon: '📋', title: 'AZA inspection in 90 days',
        text: `<p>The AZA Accreditation Commission's inspection team visits in three months. They'll look at animal welfare, staffing, safety, facilities, finances, conservation, SSP participation and education.</p><p>Your internal pre-check estimates a score of <b>${Math.round(sc.total)}</b> (68+ needed for accreditation; 56–68 means "tabled").</p>`,
        choices: [
          { label: 'Hire consultants for a mock inspection', detail: 'Find and fix problems early', cost: 40000 * Math.sqrt(scale(s)), costCat: 'admin', apply: (s) => { aza(s, 3); return 'The mock inspection flagged a dozen issues; the team is fixing them.'; } },
          { label: 'Crash cosmetic fix-up of habitats', detail: 'Paint, plantings, signage everywhere', cost: 25000 * s.habitats.length * Math.sqrt(scale(s)), costCat: 'maintenance', apply: (s) => { for (const h of s.habitats) h.condition = Math.min(100, h.condition + 6); return 'The zoo looks fresh. Inspectors know the difference, but it helps.'; } },
          { label: 'Business as usual', apply: () => 'You trust your team.' },
        ] };
    },
  });

  def('inspection', {
    cat: 'aza',
    make: (s, c) => {
      const rows = Object.entries(c.parts).map(([k, v]) => `<tr><td>${k}</td><td class="${v >= 68 ? 'good' : v >= 55 ? 'warn' : 'bad'}">${Math.round(v)}</td></tr>`).join('');
      const head = { accredited: '✅ Accreditation granted for five years', tabled: '⏸️ Accreditation TABLED — fix the problems within one year', lost: '❌ Accreditation DENIED' }[c.result];
      const body = { accredited: 'The Commission praised your team. The board and donors are relieved.', tabled: 'You keep participating in SSPs for now, but you must pass a re-inspection in a year.', lost: 'You can no longer participate in AZA Species Survival Plans. Partner zoos will recall loaned animals, donors are nervous and the press is brutal. You may re-apply in a year.' }[c.result];
      return { icon: '📋', title: head, text: `<p>Overall score: <b>${Math.round(c.score)}</b></p><table class="mini">${rows}</table><p>${body}</p>`, choices: [{ label: 'Continue', apply: () => '' }] };
    },
  });

  def('budget_request', {
    cat: 'politics',
    make: (s) => {
      const fed = s.gov.type === 'federal';
      const P = ZG.Politics;
      const g = s.gov;
      const o = (k) => Math.round(P.odds(s, { flat: 0.45, modest: 0.18, bold: -0.08, campaign: 0.1 }[k]) * 100);
      const campaignCost = Math.round(60000 * Math.sqrt(scale(s)));
      const backlog = ZG.Infra.backlog(s);
      return { icon: '🏛️', title: fed ? 'Congressional budget testimony' : 'Budget request to the Mayor & City Council',
        text: `<p>${fed ? 'The Smithsonian is assembling its request to Congress, and you will testify before the appropriations subcommittee.' : 'Departments must submit budget requests for next fiscal year. Council hearings are in April and May.'}</p><p>Current funding: <b>${$(g.appropriation)}/yr</b>. Deferred-maintenance backlog: <b>${$(backlog)}</b>. Relationship: <b>${Math.round(g.relationship)}/100</b>. Local economy: <b>${s.economy >= 1 ? 'healthy' : 'soft'}</b>.</p>`,
        choices: [
          { label: 'Hold the line (flat request)', detail: `~${o('flat')}% chance of avoiding cuts`, apply: (s) => { P.makeRequest(s, 'flat'); return 'A cautious request. Officials appreciated the restraint.'; } },
          { label: 'Modest increase (+6%)', detail: `~${o('modest')}% odds`, apply: (s) => { P.makeRequest(s, 'modest'); return 'Request submitted.'; } },
          { label: `Bold: +15% and ${$(backlog * 0.25)} capital for repairs`, detail: `~${o('bold')}% odds — risky`, apply: (s) => { P.makeRequest(s, 'bold'); return 'An ambitious ask. Council members raised eyebrows.'; } },
          { label: 'Bold ask + public advocacy campaign', detail: `Rally members & media (~${o('campaign')}% odds)`, cost: campaignCost, costCat: 'marketing', apply: (s) => { P.makeRequest(s, 'campaign'); pol(s, -1); rep(s, 1); return 'Members packed the hearing room in zoo T-shirts.'; } },
        ] };
    },
  });

  def('budget_decision', {
    cat: 'politics',
    make: (s, c) => {
      const txt = { full: 'You got what you asked for.', partial: 'A partial win — some of your request survived.', cut: 'Bad news: the zoo\'s funding was cut.' }[c.outcome];
      return { icon: c.outcome === 'cut' ? '📉' : '🏛️', title: `Budget decision: ${c.outcome === 'full' ? 'Approved' : c.outcome === 'partial' ? 'Partially approved' : 'Cut'}`,
        text: `<p>${txt}</p><p>Next year's operating funding: <b>${$(c.approp)}</b> (was ${$(c.base)}).${c.capital ? ` Plus <b>${$(c.capital)}</b> in capital funds for repairs.` : ''}</p>`,
        choices: [{ label: 'Continue', apply: (s) => { if (c.outcome === 'cut') board(s, -3); else if (c.approp > c.base) board(s, 3); return ''; } }] };
    },
  });

  def('election', {
    cat: 'politics',
    make: (s, c) => {
      const fed = s.gov.type === 'federal';
      const stance = U.pick(s, ['supportive', 'neutral', 'austerity']);
      if (!c || !c.done) { ZG.Officials.election(s, fed ? 'federal' : 'local'); if (c) c.done = true; }
      const who = fed ? 'The new Congress' : 'The new Mayor';
      const txt = { supportive: `${who} grew up visiting the zoo and wants to be seen supporting it.`, neutral: `${who} has no strong views on the zoo.`, austerity: `${who} campaigned on cutting spending and "non-essential" services.` }[stance];
      return { icon: '🗳️', title: fed ? 'Election shakes up Congress' : 'A new Mayor takes office', text: `<p>${txt}</p>`,
        choices: [
          { label: 'Invite them for a behind-the-scenes tour', cost: 5000, costCat: 'events', apply: (s) => { s.gov.mayor = stance; pol(s, stance === 'austerity' ? 4 : 8); return 'They fed a giraffe and posted about it. A good start.'; } },
          { label: 'Wait and see', apply: (s) => { s.gov.mayor = stance; return 'You keep your head down.'; } },
        ] };
    },
  });

  def('shutdown', {
    cat: 'politics',
    make: (s, c) => ({ icon: '🚫', title: 'Government shutdown — the zoo is closed',
      text: `<p>Congress missed the October 1 deadline. The gates are closed and furloughed staff are home. Keepers and vets are "excepted" employees: they must keep caring for the animals — without pay until it ends. Estimated length: unknown (insiders guess ~${c.days} days).</p>`,
      choices: [
        { label: 'Keep essential care only', apply: (s) => { morale(s, -6); return 'The animals are fed and safe. Staff are anxious.'; } },
        { label: 'FONZ-funded staff support & social media', detail: 'Food pantry for staff, keep the Panda Cam story alive', cost: 80000, costCat: 'events', apply: (s) => { morale(s, 2); rep(s, 3); return 'Staff felt supported, and the public rallied behind "the animals still need care."'; } },
        { label: 'Speak out publicly about the shutdown', apply: (s) => { rep(s, 2); pol(s, -6); return 'Great press. Some members of Congress were not amused.'; } },
      ] }),
  });

  def('contract_renewal', {
    cat: 'politics',
    make: (s) => {
      const g = s.gov;
      const p = Math.round(ZG.Politics.odds(s, 0.05, 'contract') * 100);
      return { icon: '📜', title: 'City management agreement up for renewal',
        text: `<p>The City of Houston's agreement to fund zoo operations expires soon. The City is proposing to keep the fee flat for 10 years (no escalator). Current fee: <b>${$(g.appropriation)}/yr</b>.</p>`,
        choices: [
          { label: 'Accept the City\'s terms', apply: (s) => { ZG.Officials.clear(s, 'contract'); s.stats.contractRenewed = true; pol(s, 5); g.contractYear += 10; ZG.Sim.flag(s, 'noEscalator', true); return 'Signed. Stable, if unexciting.'; } },
          { label: 'Negotiate: escalators + capital commitment', detail: `~${p}% chance of success`, apply: (s) => {
            s.stats.contractRenewed = true;
            g.contractYear += 10;
            ZG.Officials.clear(s, 'contract');
            if (U.rand(s) < p / 100) { g.appropriation = Math.round(g.appropriation * 1.08); ZG.Econ.earn(s, 'government', 3e6 * scale(s) / 2, true); s.stats.budgetWins++; return 'Big win: +8% fee and a capital commitment!'; }
            g.appropriation = Math.round(g.appropriation * 0.96); pol(s, -5); return 'Talks got tense. You signed, but at a 4% lower fee.';
          } },
        ] };
    },
  });

  def('campaign_done', {
    cat: 'story',
    make: (s, c) => ({ icon: '🏆', title: `Campaign complete: "${c.label}"`, text: `<p>You raised <b>${$(c.raised)}</b>. The money is in your capital fund, ready to build.</p>`, choices: [{ label: 'Celebrate', apply: () => '' }] }),
  });

  def('year_review', {
    cat: 'story',
    make: (s, c) => ({ icon: '📊', title: `${c.year} Annual Review`, text: c.html, choices: [{ label: 'On to ' + (c.year + 1), apply: () => '' }] }),
  });

  def('objective', {
    cat: 'story',
    make: (s, c) => ({ icon: '🎯', title: 'Goal achieved!', text: `<p><b>${c.text}</b></p><p>The ${Z(s).bossName} took notice.</p>`, choices: [{ label: 'Excellent', apply: () => '' }] }),
  });

  def('board_warning', {
    cat: 'story',
    make: (s) => ({ icon: '⚠️', title: `The ${Z(s).bossName} is losing confidence`,
      text: '<p>You\'ve been called into a closed-door meeting. Finances, animal welfare, and the zoo\'s public image are all under scrutiny. If confidence keeps falling, you will be replaced.</p>',
      choices: [
        { label: 'Present a turnaround plan', apply: (s) => { board(s, 6); return 'They gave you a few more months.'; } },
        { label: 'Offer to take a pay cut in solidarity', apply: (s) => { board(s, 4); morale(s, 3); return 'Symbolic, but noticed.'; } },
      ] }),
  });

  def('fired', {
    cat: 'story',
    make: (s) => ({ icon: '📦', title: 'You have been replaced',
      text: `<p>The ${Z(s).bossName} has decided to go in a different direction. Security walks you to your car; a keeper you hired years ago gives you a hug by the flamingo pond.</p><p>You can keep watching this zoo as an observer, or start a new career.</p>`,
      choices: [{ label: 'Keep playing (sandbox)', apply: (s) => { s.board = 30; s.flags.sandbox = true; return 'You negotiated to stay on as interim director.'; } }] }),
  });

  // =====================================================================
  // RANDOM DILEMMAS
  // =====================================================================
  def('viral_baby', {
    cat: 'guest', cooldown: 200,
    weight: (s) => (s.animals.some((a) => a.age < 150 && SP(a.sp).appeal >= 5) ? 1.4 : 0),
    prep: (s) => {
      const b = U.pick(s, s.animals.filter((a) => a.age < 150 && SP(a.sp).appeal >= 5));
      return { aid: b.id };
    },
    make: (s, c) => {
      const b = living(s, c.aid);
      if (!b) return null;
      const sp = SP(b.sp);
      return { icon: '📱', title: `${b.name} the baby ${sp.name} went viral!`,
        text: `<p>A keeper's 12-second clip of ${b.name} ${U.pick(s, sp.behaviors)} has 40 million views. News vans are in the parking lot and guests are lining up at the exhibit.</p>`,
        choices: [
          { label: 'Lean in: merch, timed viewing, press', cost: 60000 * Math.sqrt(scale(s)), costCat: 'marketing', apply: (s) => { s.novelty = Math.min(0.9, s.novelty + 0.3); ZG.Econ.earn(s, 'concessions', 150000 * scale(s)); rep(s, 3); return 'Plush toys sold out in a day. Attendance is booming.'; } },
          { label: 'Enjoy it, but change nothing', apply: (s) => { s.novelty = Math.min(0.9, s.novelty + 0.15); return 'The internet moves on eventually. The bump was nice.'; } },
          { label: 'Limit crowds to protect the baby', detail: 'Welfare first', apply: (s) => { s.novelty = Math.min(0.9, s.novelty + 0.08); aza(s, 2); rep(s, 1); return 'Some guests grumbled, but welfare advocates praised you.'; } },
        ] };
    },
  });

  def('activist_elephants', {
    cat: 'guest', cooldown: 500,
    weight: (s) => (hasSp(s, (id) => id.includes('elephant')) ? 0.5 : 0),
    make: (s) => {
      const els = s.animals.filter((a) => a.sp.includes('elephant'));
      const avgW = els.reduce((x, a) => x + a.welfare, 0) / els.length;
      return { icon: '📣', title: 'Activists demand you "free the elephants"',
        text: `<p>An animal-rights group is protesting at the gate and has flown a banner over the zoo. They want your ${els.length} elephant${els.length > 1 ? 's' : ''} sent to a sanctuary. A city council member is asking questions.</p><p>Your elephants' average welfare score: <b>${Math.round(avgW)}</b>.</p>`,
        choices: [
          { label: 'Commission an independent welfare review', cost: 50000, costCat: 'admin', apply: (s) => { if (avgW >= 68) { rep(s, 4); aza(s, 2); return 'The review praised your program. The story died down.'; } rep(s, -4); return 'The review found real problems. The activists have new ammunition.'; } },
          { label: 'Hold firm and defend the program publicly', apply: (s) => { if (avgW >= 70) { rep(s, 1); return 'Your keepers\' passion won the day.'; } rep(s, -5); pol(s, -3); return 'The press found your defense unconvincing.'; } },
          { label: 'Agree to send the elephants to a sanctuary', detail: 'You lose your elephants', apply: (s) => {
            for (const a of els) ZG.Animals.remove(s, a);
            rep(s, 2); aza(s, -6); board(s, -4);
            return 'Activists celebrated. AZA and many longtime members were dismayed — and the elephant barn now sits empty.';
          } },
        ] };
    },
  });

  def('donor_mismatch', {
    cat: 'money', cooldown: 400,
    weight: () => 0.45,
    prep: (s) => {
      const hot = Math.max(...Z(s).climate.hi) > 88;
      return { sp: hot ? 'polar_bear' : U.pick(s, ['giant_panda', 'polar_bear', 'koala']), amt: Math.round(Z(s).majorGiftScale * U.rf(s, 2, 4) / 1000) * 1000 };
    },
    make: (s, c) => {
      const sp = SP(c.sp);
      const donor = `${U.pick(s, ZG.NAMES.donorFirst)} ${U.pick(s, ZG.NAMES.donorLast)}`;
      return { icon: '💰', title: `A wealthy donor wants ${sp.name}s`,
        text: `<p>${donor} is offering <b>${$(c.amt)}</b> — on the condition that you build a habitat for ${sp.name}s. ${c.sp === 'polar_bear' ? 'Your climate would require an expensive chilled building and huge ongoing energy costs.' : c.sp === 'giant_panda' ? 'Pandas require a loan agreement with China and roughly $1M/yr in fees.' : 'Koalas eat enormous amounts of imported eucalyptus.'}</p>`,
        choices: [
          { label: 'Accept the gift and the condition', apply: (s) => { ZG.Econ.earn(s, 'donations', c.amt, true); s.flags.promisedSpecies = c.sp; s.flags.promisedDay = s.day; board(s, 3); return `The money is in your capital fund. You've promised to bring ${sp.name}s here.`; } },
          { label: 'Redirect them to your SSP priorities', apply: (s) => { if (U.chance(s, 0.45 * ZG.mod(s, 'fundraising'))) { ZG.Econ.earn(s, 'donations', c.amt * 0.7, true); aza(s, 2); return 'They agreed to fund your conservation plan instead — at 70%.'; } return 'They walked away, offended.'; } },
          { label: 'Politely decline', apply: (s) => { board(s, -1); return 'Some trustees thought you left money on the table.'; } },
        ] };
    },
  });

  def('sponsor_backlash', {
    cat: 'money', cooldown: 300,
    weight: (s) => (s.sponsors.some((x) => x.risk > 0.5) ? 1.6 : 0),
    prep: (s) => ({ name: U.pick(s, s.sponsors.filter((x) => x.risk > 0.5)).name }),
    make: (s, c) => {
      const sp = s.sponsors.find((x) => x.name === c.name);
      if (!sp) return null;
      return { icon: '🔥', title: `Backlash over ${sp.name} sponsorship`,
        text: `<p>Conservation groups and a viral thread are calling your partnership with ${sp.name} (${sp.ind}) "greenwashing." A petition has 30,000 signatures.</p>`,
        choices: [
          { label: 'End the sponsorship', detail: `Lose ${$(sp.amount)}/yr`, apply: (s) => { ZG.Dev.dropSponsor(s, sp.name); rep(s, 2); aza(s, 1); return 'You ended the deal. Critics applauded; your CFO sighed.'; } },
          { label: 'Negotiate a sustainability commitment', apply: (s) => { sp.amount = Math.round(sp.amount * 0.8); sp.risk = 0.3; rep(s, 0.5); return 'They agreed to fund habitat restoration and cut their fee 20%.'; } },
          { label: 'Defend the partnership', apply: (s) => { rep(s, -4); aza(s, -1.5); return 'The story dragged on for weeks.'; } },
        ] };
    },
  });

  def('keeper_injury', {
    cat: 'staff', cooldown: 300,
    weight: (s) => (hasSp(s, (id) => SP(id).danger >= 3) ? Math.max(0.15, (1 - ZG.Staff.ratio(s, 'keepers')) * 5 + (s.morale < 50 ? 0.4 : 0)) : 0),
    prep: (s) => ({ sp: U.pick(s, s.animals.filter((a) => SP(a.sp).danger >= 3)).sp }),
    make: (s, c) => {
      const sp = SP(c.sp);
      return { icon: '🚑', title: `Keeper injured by a ${sp.name}`,
        text: `<p>A keeper was hurt during a routine shift at the ${sp.name} habitat — a lock-out procedure was skipped. They'll recover, but OSHA has opened an investigation and staff are shaken. Short-staffing came up in every interview.</p>`,
        choices: [
          { label: 'Full safety overhaul + hire 2 keepers', cost: 60000 * Math.sqrt(scale(s)), costCat: 'admin', apply: (s) => { ZG.Staff.hire(s, 'keepers', 2); morale(s, 4); aza(s, 1); return 'New protocols, new locks, and reinforcements on the way.'; } },
          { label: 'Retrain staff on protocols', cost: 15000, costCat: 'admin', apply: (s) => { morale(s, 1); return 'Everyone completed retraining.'; } },
          { label: 'Contest OSHA\'s findings', apply: (s) => { pay(s, 'admin', 25000 + 40000 * U.rand(s)); morale(s, -6); rep(s, -2); return 'Legal fees mounted, and staff felt unheard.'; } },
        ] };
    },
  });

  def('guest_injury', {
    cat: 'guest', cooldown: 300,
    weight: (s) => Math.max(0, (60 - s.infra.visitor.cond) / 20),
    make: (s) => {
      const amt = Math.round(U.rf(s, 80000, 350000));
      return { icon: '⚖️', title: 'Guest injured on a broken boardwalk',
        text: `<p>A visitor fell through a rotted boardwalk plank and broke an ankle. Their lawyer is demanding <b>${$(amt)}</b>. Photos of the "crumbling zoo" are on the evening news.</p>`,
        choices: [
          { label: 'Settle quietly', cost: amt * 0.6, costCat: 'overhead', apply: (s) => 'Settled. The story faded.' },
          { label: 'Fight it in court', apply: (s) => { if (U.chance(s, 0.5)) { pay(s, 'overhead', 60000); return 'You won — but legal fees were steep.'; } pay(s, 'overhead', amt * 1.3); rep(s, -3); return 'You lost, and the judgment plus fees exceeded the original demand.'; } },
          { label: 'Settle and fix every boardwalk', cost: amt * 0.6 + 0.08 * s.infra.visitor.cost, costCat: 'emergency', apply: (s) => { s.infra.visitor.cond = Math.min(100, s.infra.visitor.cond + 10); rep(s, 1); return 'Settled, and crews replaced boardwalks zoo-wide.'; } },
        ] };
    },
  });

  def('escape', {
    cat: 'animal', cooldown: 400,
    weight: (s) => {
      const bad = s.habitats.some((h) => !h.construction && h.condition < 40 && ZG.Animals.inHab(s, h.id).some((a) => SP(a.sp).danger >= 2));
      return (bad ? 1.2 : s.infra.perimeter.cond < 35 ? 0.4 : 0) * (1 - 0.3 * ZG.Infra.bonus(s, 'perimeter'));
    },
    prep: (s) => {
      const hs = s.habitats.filter((h) => !h.construction && ZG.Animals.inHab(s, h.id).some((a) => SP(a.sp).danger >= 2)).sort((a, b) => a.condition - b.condition);
      const h = hs[0];
      const a = h ? U.pick(s, ZG.Animals.inHab(s, h.id).filter((a) => SP(a.sp).danger >= 2)) : null;
      return { aid: a ? a.id : null };
    },
    make: (s, c) => {
      const a = living(s, c.aid);
      if (!a) return null;
      const sp = SP(a.sp);
      const h = s.habitatsById[a.hab];
      return { icon: '🚨', title: `CODE RED: ${a.name} the ${sp.name} is out!`,
        text: `<p>${a.name} got through a failing barrier at ${h ? h.name : 'the habitat'} and is loose in a ${sp.danger >= 3 ? 'keeper-only service area — dangerously close to a guest path' : 'service yard'}. Guests are being sheltered in buildings.</p>`,
        choices: [
          { label: 'Lockdown + dart team', detail: 'Safest for people; anesthesia carries risk to the animal', apply: (s) => {
            close(s, 1, 'Animal escape lockdown');
            rep(s, -3); aza(s, -2);
            if (U.chance(s, 0.12)) { ZG.Animals.die(s, a, 'anesthesia complications during recapture'); return 'Guests were safe, but the animal did not survive the anesthesia.'; }
            if (h) h.condition = Math.min(100, h.condition + 20);
            return `${a.name} was darted and safely returned. Emergency barrier repairs followed.`;
          } },
          { label: 'Let keepers coax the animal back', detail: 'Trusting relationships — or a disaster', apply: (s) => {
            if (U.chance(s, 0.7)) { rep(s, 1); if (h) h.condition = Math.min(100, h.condition + 20); return `A keeper shook a food bucket and ${a.name} walked right back in. Hero keeper story everywhere.`; }
            rep(s, -10); board(s, -10); pol(s, -8); ZG.Animals.die(s, a, 'shot to protect human life');
            return 'The situation deteriorated and the animal had to be killed to protect people. National headlines. Investigations will follow.';
          } },
        ] };
    },
  });

  def('hpai', {
    cat: 'animal', cooldown: 365,
    weight: (s, t) => (s.animals.some((a) => SP(a.sp).cls === 'bird') && [0, 1, 2, 3, 9, 10, 11].includes(t.m) ? 0.7 : 0),
    make: (s) => {
      const birds = s.animals.filter((a) => SP(a.sp).cls === 'bird');
      return { icon: '🦠', title: 'Avian influenza detected in wild birds nearby',
        text: `<p>Highly pathogenic avian influenza (HPAI) has been found in wild waterfowl a few miles away. You have ${birds.length} birds in outdoor habitats. The state veterinarian recommends moving birds indoors.</p>`,
        choices: [
          { label: 'Move birds indoors & close aviaries', cost: 20000 * Math.sqrt(scale(s)), costCat: 'vetcare', apply: (s) => { for (const b of birds) b.welfare -= 8; return 'Birds are crowded but safe. Guests miss the flamingos.'; } },
          { label: 'Vaccinate under USDA conditional approval', cost: 45000 * Math.sqrt(scale(s)), costCat: 'vetcare', apply: (s) => { aza(s, 1); return 'Your vets vaccinated the collection. Other zoos are asking for your protocol.'; } },
          { label: 'Biosecurity footbaths only', apply: (s) => {
            if (U.chance(s, 0.35)) { const lost = birds.filter(() => U.chance(s, 0.35)); for (const b of lost) ZG.Animals.die(s, b, 'avian influenza'); rep(s, -4); aza(s, -3); return `HPAI got in. ${lost.length} birds died or were euthanized.`; }
            return 'You got lucky this time.';
          } },
        ] };
    },
  });

  def('pay_petition', {
    cat: 'staff', cooldown: 330,
    weight: (s) => 0.35 + (s.morale < 55 ? 0.4 : 0),
    make: (s) => {
      const city = govIsPublic(s) && s.gov.type !== 'contract';
      const kc = s.staff.keepers.n * s.staff.keepers.salary * Z(s).benefits;
      if (city)
        return { icon: '🧾', title: 'Union contract settlement',
          text: `<p>The City has settled with the public-employee unions: a <b>4% raise</b> for all zoo staff, effective immediately. Your budget was not adjusted to cover it.</p>`,
          choices: [
            { label: 'Absorb it', apply: (s) => { for (const k in s.staff) s.staff[k].salary *= 1.04; morale(s, 5); return 'Staff are happier. Your budget is tighter.'; } },
            { label: 'Ask the Council for a supplemental appropriation', apply: (s) => { for (const k in s.staff) s.staff[k].salary *= 1.04; morale(s, 5); if (U.rand(s) < ZG.Politics.odds(s, 0)) { s.gov.appropriation += Math.round(ZG.Staff.annualCost(s) * 0.03); return 'Council covered most of it!'; } pol(s, -1); return 'Denied. You\'ll have to absorb it.'; } },
          ] };
      return { icon: '🧾', title: 'Keepers petition for a raise',
        text: `<p>Keepers say they can't afford rent on current pay (average ${$(s.staff.keepers.salary)}). Several are interviewing elsewhere.</p>`,
        choices: [
          { label: 'Give keepers a 6% raise', detail: `≈ ${$(kc * 0.06)}/yr`, apply: (s) => { s.staff.keepers.salary *= 1.06; morale(s, 10); return 'Relief and gratitude. Retention should improve.'; } },
          { label: 'Give everyone a 3% raise', detail: `≈ ${$(ZG.Staff.annualCost(s) * 0.03)}/yr`, apply: (s) => { for (const k in s.staff) s.staff[k].salary *= 1.03; morale(s, 7); return 'A fair compromise.'; } },
          { label: 'Not this year', apply: (s) => { morale(s, -10); return 'Two senior keepers handed in notices.'; } },
        ] };
    },
  });

  def('vet_quits', {
    cat: 'staff', cooldown: 500,
    weight: (s) => (ZG.Staff.ratio(s, 'vets') < 0.95 || s.morale < 50 ? 0.6 : 0.1),
    make: (s) => ({ icon: '🩺', title: 'Your head veterinarian has an offer elsewhere',
      text: '<p>A larger zoo has offered your head vet 25% more. Losing them would leave your vet team badly stretched — zoo vets are notoriously hard to hire.</p>',
      choices: [
        { label: 'Match the offer', apply: (s) => { s.staff.vets.salary *= 1.08; morale(s, 3); return 'They\'re staying.'; } },
        { label: 'Contract a relief vet while you recruit', cost: 90000, costCat: 'vetcare', apply: (s) => { s.staff.vets.n = Math.max(1, s.staff.vets.n - 1); ZG.Staff.hire(s, 'vets', 1); return 'A relief vet covers the gap. Recruiting has begun.'; } },
        { label: 'Let them go', apply: (s) => { s.staff.vets.n = Math.max(1, s.staff.vets.n - 1); morale(s, -4); return 'A farewell party in the hospital break room.'; } },
      ] }),
  });

  def('recession', {
    cat: 'money', cooldown: 1100,
    weight: (s) => (s.economy > 0.97 && s.day > 300 ? 0.25 : 0),
    make: (s) => ({ icon: '📉', title: 'Economic downturn hits the region',
      text: `<p>Layoffs at major employers and falling tax receipts. Expect softer attendance, fewer donations${govIsPublic(s) ? ', and pressure on government funding' : ''}.</p>`,
      choices: [
        { label: 'Freeze non-essential spending now', apply: (s) => { s.economyTarget = 0.88; s.policy.marketing *= 0.85; s.policy.maintenance *= 0.9; board(s, 2); return 'Marketing and maintenance budgets trimmed.'; } },
        { label: 'Offer discount days to keep families coming', apply: (s) => { s.economyTarget = 0.88; rep(s, 3); s.flags.attendanceMult = 1.06; s.flags.attendanceMultUntil = s.day + 180; return 'Community goodwill — and more guests at lower yields.'; } },
        { label: 'Ride it out', apply: (s) => { s.economyTarget = 0.88; return 'Buckle up.'; } },
      ] }),
  });

  def('mid_year_cut', {
    cat: 'politics', cooldown: 500,
    weight: (s) => (govIsPublic(s) && s.economy < 0.97 ? 1.0 : 0),
    make: (s) => {
      const cut = Math.round(s.gov.appropriation * 0.05);
      return { icon: '✂️', title: `${s.gov.type === 'federal' ? 'Rescission' : 'Mid-year budget cut'}: ${$(cut)}`,
        text: `<p>Revenues are down and ${s.gov.type === 'federal' ? 'Congress rescinded part of your funding' : 'the Mayor ordered every department to cut 5% immediately'}. How do you absorb it?</p>`,
        choices: [
          { label: 'Cut maintenance (defer it again)', apply: (s) => { s.gov.appropriation -= cut; s.policy.maintenance = Math.max(0, s.policy.maintenance - cut); return 'The backlog grows quietly.'; } },
          { label: 'Hiring freeze & leave vacancies open', apply: (s) => { s.gov.appropriation -= cut; s.flags.hiringFreeze = s.day + 240; const n = Math.max(1, Math.round(cut / (s.staff.guest.salary * Z(s).benefits))); s.staff.guest.n = Math.max(2, s.staff.guest.n - n); morale(s, -4); return `${n} vacant guest-services positions eliminated. No hiring for 8 months.`; } },
          { label: 'Close one day a week in the off-season', apply: (s) => { s.gov.appropriation -= Math.round(cut * 0.5); s.gov.shortHours = true; s.gov.shortHoursUntil = s.day + 365; rep(s, -4); return 'Families were furious. You saved half the cut in staffing.'; } },
          { label: 'Fight it at the Council / on the Hill', apply: (s) => { if (U.rand(s) < ZG.Politics.odds(s, -0.1)) { pol(s, -2); return 'You won an exemption!'; } s.gov.appropriation -= cut; pol(s, -5); return 'You lost — and burned political capital.'; } },
        ] };
    },
  });

  def('media_audit', {
    cat: 'guest', cooldown: 600,
    weight: (s) => (ZG.Infra.avgCond(s) < 50 ? 0.7 : 0),
    make: (s) => ({ icon: '📰', title: 'Investigative report: "The Crumbling Zoo"',
      text: `<p>A newspaper series documents leaking roofs, rusted fences and a ${$(ZG.Infra.backlog(s))} maintenance backlog, quoting anonymous staff.</p>`,
      choices: [
        { label: 'Open the gates to reporters — own the problem', apply: (s) => { rep(s, -1); pol(s, 4); return 'Candor earned respect, and officials felt pressure to help.'; } },
        { label: 'Use it to demand more funding', apply: (s) => { rep(s, -2); if (govIsPublic(s)) { pol(s, U.chance(s, 0.5) ? 5 : -5); } board(s, -2); return 'The story became a funding debate.'; } },
        { label: 'Dismiss the report', apply: (s) => { rep(s, -6); morale(s, -4); return 'Readers didn\'t buy it, and staff felt thrown under the bus.'; } },
      ] }),
  });

  def('celebrity_visit', {
    cat: 'guest', cooldown: 400, weight: () => 0.3,
    make: (s) => ({ icon: '🌟', title: 'A celebrity wants a private tour',
      text: '<p>A famous actor with 80 million followers wants a behind-the-scenes tour for their kids — and to feed the giraffes.</p>',
      choices: [
        { label: 'Roll out the red carpet', cost: 8000, costCat: 'events', apply: (s) => { s.novelty = Math.min(0.9, s.novelty + 0.06); rep(s, 2); return 'Their post went viral. Attendance ticked up.'; } },
        { label: 'Ask them to film a PSA for conservation', apply: (s) => { aza(s, 1); rep(s, 1.5); return 'They agreed! Your SSP work got national attention.'; } },
      ] }),
  });

  def('panda_diplomacy', {
    cat: 'animal', cooldown: 1400,
    weight: (s) => (hasSp(s, (id) => id === 'giant_panda') ? 0 : ['sandiego', 'national'].includes(s.zooId) ? 0.5 : 0.06),
    make: (s) => {
      const build = Math.round(1.8e7 * ZG.zoo(s).costMult);
      return { icon: '🐼', title: 'China offers a giant panda loan',
        text: `<p>After quiet diplomacy, the China Wildlife Conservation Association is willing to loan a pair of giant pandas for 10 years. Terms: about <b>$1M/yr</b> in conservation fees and a state-of-the-art habitat (~${$(build)} unless you have a suitable one). Pandas are the ultimate attendance magnet.</p>`,
        choices: [
          { label: 'Sign the agreement', apply: (s) => {
            const h = s.habitats.find((h) => !h.construction && ['forest', 'temperate'].includes(h.biome) && !s.animals.some((a) => a.hab === h.id));
            let hab = h;
            if (!hab) {
              const plot = s.plots.find((p) => p.kind === 'habitat' && !p.hab);
              if (!plot) return 'You have no space for a panda habitat! The deal fell through.';
              if (!ZG.Econ.canAfford(s, build, true)) return 'You couldn\'t finance the habitat. China chose another zoo.';
              payCap(s, 'construction', build);
              hab = ZG.Habitats.create(s, plot, { name: 'Panda Forest', biome: 'temperate', tier: 'premium', theming: 95, condition: 100, construction: { days: 420, total: 420, cost: build } });
            }
            s.flags.pandaFee = 1000000;
            s.flags.pandaHab = hab.id;
            s.flags.pandaArrive = s.day + (hab.construction ? hab.construction.days + 20 : 120);
            rep(s, 5); board(s, 5);
            return 'Signed! The pandas will arrive once the habitat is ready.';
          } },
          { label: 'Decline — invest in other species', apply: (s) => { aza(s, 1); return 'You passed. Some trustees were stunned.'; } },
        ] };
    },
  });

  def('surplus_males', {
    cat: 'animal', cooldown: 400,
    weight: (s) => {
      for (const h of s.habitats) {
        const by = {};
        for (const a of ZG.Animals.inHab(s, h.id)) if (a.sex === 'M' && ZG.Animals.isMature(a) && SP(a.sp).group[1] < 20) by[a.sp] = (by[a.sp] || 0) + 1;
        if (Object.values(by).some((n) => n >= 3)) return 0.9;
      }
      return 0;
    },
    make: (s) => {
      let found = null;
      for (const h of s.habitats) {
        const by = {};
        for (const a of ZG.Animals.inHab(s, h.id)) if (a.sex === 'M' && ZG.Animals.isMature(a) && SP(a.sp).group[1] < 20) (by[a.sp] = by[a.sp] || []).push(a);
        for (const k in by) if (by[k].length >= 3) found = { h, list: by[k] };
      }
      if (!found) return null;
      const sp = SP(found.list[0].sp);
      return { icon: '♂️', title: `Too many male ${sp.name}s at ${found.h.name}`,
        text: `<p>${found.list.length} mature males share the habitat. Fights are breaking out and keepers are worried about injuries. The SSP has no space for them right now.</p>`,
        choices: [
          { label: 'Transfer two to a non-AZA facility', detail: 'Solves it fast, but AZA disapproves', apply: (s) => { for (const a of found.list.slice(0, 2)) ZG.Animals.remove(s, a); aza(s, -4); return 'They left for a private facility. The SSP coordinator was unhappy.'; } },
          { label: 'Split them into bachelor groups in holding', cost: 30000, costCat: 'maintenance', apply: (s) => { for (const a of found.list.slice(1)) a.welfare -= 10; return 'A temporary fix while you wait for SSP placements.'; } },
          { label: 'Keep them together and hope', apply: (s) => { const a = found.list[1]; a.health -= 35; ZG.Animals.fallIll(s, a); return `${a.name} was injured in a fight.`; } },
        ] };
    },
  });

  def('zoo_lights', {
    cat: 'money', cooldown: 330,
    weight: (s, t) => (t.m === 9 ? 3 : 0),
    make: (s) => {
      const cost = Math.round(Z(s).baseAttendance * 0.35);
      return { icon: '🎄', title: 'Holiday lights festival?',
        text: `<p>Other zoos make serious money with winter lights festivals. A good one costs about <b>${$(cost)}</b> in lights, power and staffing — and brings crowds in your slowest months.</p>`,
        choices: [
          { label: 'Go big', cost, costCat: 'events', apply: (s) => { s.flags.lights = { until: s.day + 90, mult: 1.35 }; ZG.Econ.earn(s, 'events', cost * U.rf(s, 1.3, 2.3)); return 'A million LEDs and hot cocoa. Families flocked in.'; } },
          { label: 'Modest version', cost: cost * 0.4, costCat: 'events', apply: (s) => { s.flags.lights = { until: s.day + 90, mult: 1.12 }; ZG.Econ.earn(s, 'events', cost * 0.4 * U.rf(s, 1.1, 1.8)); return 'Charming and cheap.'; } },
          { label: 'Skip it this year', apply: () => 'Quiet winter nights for the animals.' },
        ] };
    },
  });

  def('adult_night', {
    cat: 'money', cooldown: 330,
    weight: (s, t) => ([3, 4, 5, 6, 7, 8].includes(t.m) ? 0.4 : 0),
    make: (s) => ({ icon: '🍺', title: '"Brew at the Zoo" adults-only night',
      text: '<p>A local brewery wants to co-host a 21+ evening event: live music, craft beer, keeper talks. Big money — but loud music near sensitive animals worries your curators.</p>',
      choices: [
        { label: 'Host it', apply: (s) => { ZG.Econ.earn(s, 'events', Z(s).baseAttendance * U.rf(s, 0.15, 0.3)); for (const a of s.animals) a.welfare -= 3; return 'Sold out. A few animals were stressed by the noise.'; } },
        { label: 'Host a quieter version away from animals', apply: (s) => { ZG.Econ.earn(s, 'events', Z(s).baseAttendance * U.rf(s, 0.07, 0.14)); return 'Smaller, calmer, still profitable.'; } },
        { label: 'Decline', apply: () => 'The animals get a quiet night.' },
      ] }),
  });

  def('usda_inspection', {
    cat: 'aza', cooldown: 300,
    weight: () => 0.45,
    make: (s) => {
      const w = ZG.Animals.avgWelfare(s);
      const bad = s.habitats.filter((h) => !h.construction && h.condition < 45).length;
      const citations = Math.max(0, Math.round((70 - w) / 8 + bad * 0.7 + (s.infra.commissary.cond < 45 ? 1 : 0)));
      return { icon: '🔍', title: 'Unannounced USDA inspection',
        text: `<p>A USDA Animal Care inspector arrived this morning. Result: <b>${citations === 0 ? 'no non-compliant items' : citations + ' citation' + (citations > 1 ? 's' : '')}</b>. Inspection reports are public.</p>`,
        choices: [{ label: citations ? 'Correct the items' : 'Thank the team', cost: citations * 12000 * Math.sqrt(scale(s)), costCat: 'maintenance', apply: (s) => { if (citations) { rep(s, -citations); aza(s, -citations * 0.7); return 'Items corrected; a reporter still wrote it up.'; } morale(s, 3); aza(s, 1); return 'A clean report. Keepers celebrated.'; } }] };
    },
  });

  def('wild_release', {
    cat: 'animal', cooldown: 500,
    weight: (s) => (hasSp(s, (id) => ['california_condor', 'mexican_wolf', 'nene'].includes(id)) ? 0.6 : 0),
    make: (s) => {
      const cand = s.animals.filter((a) => ['california_condor', 'mexican_wolf', 'nene'].includes(a.sp) && a.age < SP(a.sp).life * 365 * 0.5);
      if (!cand.length) return null;
      const a = cand[0];
      const sp = SP(a.sp);
      return { icon: '🌄', title: `Wildlife agency requests ${a.name} for release`,
        text: `<p>The recovery program for the ${sp.name} wants ${a.name} for release into the wild. This is exactly what SSPs exist for — but it's one less animal for guests to see.</p>`,
        choices: [
          { label: 'Yes — send them home', cost: 8000, costCat: 'transport', apply: (s) => { ZG.Animals.remove(s, a); aza(s, 6); rep(s, 4); s.stats.releases = (s.stats.releases || 0) + 1; return `${a.name} was released in the wild. Your staff watched the live feed with tears in their eyes.`; } },
          { label: 'Not this year', apply: (s) => { aza(s, -2); return 'The recovery team was disappointed.'; } },
        ] };
    },
  });

  def('bequest', {
    cat: 'money', cooldown: 900, weight: () => 0.18,
    make: (s) => {
      const amt = Math.round(Z(s).majorGiftScale * U.rf(s, 0.5, 2.5) / 1000) * 1000;
      return { icon: '📜', title: 'A surprise bequest',
        text: `<p>A longtime member who visited every Sunday for 40 years left the zoo <b>${$(amt)}</b> in their will, unrestricted.</p>`,
        choices: [
          { label: 'Put it toward operations', apply: (s) => { ZG.Econ.earn(s, 'donations', amt); return 'The operating budget breathes a little easier.'; } },
          { label: 'Put it in the capital fund', apply: (s) => { ZG.Econ.earn(s, 'donations', amt, true); return 'Earmarked for repairs and new habitats.'; } },
          { label: 'Name a bench & put it in capital', cost: 3000, costCat: 'events', apply: (s) => { ZG.Econ.earn(s, 'donations', amt, true); rep(s, 1); morale(s, 1); return 'A bench overlooks their favorite exhibit now.'; } },
        ] };
    },
  });

  def('parking_dispute', {
    cat: 'politics', cooldown: 700,
    weight: (s) => (['sandiego', 'honolulu', 'houston'].includes(s.zooId) ? 0.3 : 0),
    make: (s) => ({ icon: '🅿️', title: 'The City wants to charge for park parking',
      text: `<p>To close a budget gap, the City proposes paid parking in the park around the zoo. Your guests would pay $10–$16 to park. Attendance could drop.</p>`,
      choices: [
        { label: 'Lobby against it', apply: (s) => { if (U.rand(s) < ZG.Politics.odds(s, 0)) { pol(s, -2); return 'The proposal died in committee.'; } s.flags.attendanceMult = 0.95; s.flags.attendanceMultUntil = s.day + 730; pol(s, -3); return 'It passed anyway. Attendance will take a hit.'; } },
        { label: 'Negotiate free parking for members', apply: (s) => { s.flags.attendanceMult = 0.97; s.flags.attendanceMultUntil = s.day + 730; s.members = Math.round(s.members * 1.03); return 'Members park free — a nice membership perk.'; } },
        { label: 'Subsidize guest parking yourself', cost: Z(s).baseAttendance * 0.25, costCat: 'overhead', apply: () => 'Guests park free on your dime this year.' },
      ] }),
  });

  def('food_spike', {
    cat: 'money', cooldown: 700, weight: () => 0.25,
    make: (s) => {
      const panda = hasSp(s, (id) => id === 'giant_panda' || id === 'koala');
      return { icon: '🥬', title: panda ? 'Bamboo & eucalyptus prices surge' : 'Hay and produce prices spike',
        text: `<p>${panda ? 'A grower lost crops to frost; specialty browse prices are up sharply.' : 'Drought in the West has pushed hay prices up 40%.'} Animal food costs will rise ~15% for a year.</p>`,
        choices: [
          { label: 'Absorb the cost', apply: (s) => { s.flags.foodMult = 1.15; s.flags.foodUntil = s.day + 365; return 'Food costs up for a year.'; } },
          { label: 'Plant an on-site browse garden', cost: 90000 * Math.sqrt(scale(s)), costCat: 'construction', apply: (s) => { s.flags.foodMult = 1.07; s.flags.foodUntil = s.day + 365; aza(s, 0.5); return 'Volunteers planted browse. It cuts costs a bit — and guests love it.'; } },
        ] };
    },
  });

  def('insurance_hike', {
    cat: 'money', cooldown: 700,
    weight: (s) => (s.flags.recentDisaster && s.day - s.flags.recentDisaster < 365 ? 1.2 : 0),
    make: (s) => ({ icon: '📑', title: 'Insurance premiums jump 25%',
      text: '<p>After recent disasters, your insurer is raising premiums sharply — or you can raise your deductible and self-insure more risk.</p>',
      choices: [
        { label: 'Pay the higher premium', apply: (s) => { s.flags.insuranceMult = (s.flags.insuranceMult || 1) * 1.08; return 'Overhead costs up.'; } },
        { label: 'Raise the deductible', apply: (s) => { s.flags.insuranceMult = (s.flags.insuranceMult || 1) * 1.02; s.flags.bigDeductible = true; return 'Cheaper now; the next disaster will cost you more.'; } },
      ] }),
  });

  def('research_partner', {
    cat: 'aza', cooldown: 500, weight: () => 0.3,
    make: (s) => {
      const sp = SP(U.pick(s, s.animals).sp);
      return { icon: '🔬', title: 'University research partnership',
        text: `<p>A university lab wants to study ${sp.name} cognition and hormones using non-invasive methods, with grad students on site. They'll bring a small grant.</p>`,
        choices: [
          { label: 'Partner with them', apply: (s) => { ZG.Econ.earn(s, 'grants', 40000 * Math.sqrt(scale(s))); aza(s, 2); return 'Science! Two papers are expected.'; } },
          { label: 'Decline — keepers are stretched', apply: () => 'Maybe another time.' },
        ] };
    },
  });

  def('confiscation', {
    cat: 'animal', cooldown: 900, weight: () => 0.2,
    make: (s) => {
      const h = s.habitats.find((h) => !h.construction && ['tropical', 'forest', 'temperate'].includes(h.biome) && ZG.Animals.inHab(s, h.id).every((a) => a.sp === 'sumatran_tiger' || a.sp === 'amur_tiger'));
      return { icon: '🐯', title: 'Federal agents seized two tiger cubs',
        text: '<p>US Fish & Wildlife confiscated two tiger cubs from an illegal roadside "cub petting" operation. They need a permanent home — and they are not SSP-managed (unknown genetics).</p>',
        choices: [
          { label: 'Take them in', apply: (s) => {
            if (!h) return 'You had no suitable habitat, so they went to an accredited sanctuary instead.';
            for (let i = 0; i < 2; i++) ZG.Animals.create(s, 'sumatran_tiger', i ? 'M' : 'F', 120, { hab: h.id, loc: 'quarantine', qDays: 30, gv: 'Low', contra: true });
            rep(s, 5); pay(s, 'vetcare', 20000); return 'The cubs are recovering in quarantine. The story made national news.';
          } },
          { label: 'Refer them to a sanctuary', apply: () => 'They went to an accredited sanctuary.' },
        ] };
    },
  });

  def('bullhook_video', {
    cat: 'guest', cooldown: 900,
    weight: (s) => (hasSp(s, (id) => id.includes('elephant')) ? 0.2 : 0),
    make: (s) => ({ icon: '🎥', title: 'Video of elephant management sparks outrage',
      text: '<p>A guest filmed a keeper using a guide (bullhook) during a foot-care session. It\'s being shared with the caption "ABUSE." AZA standards now emphasize protected-contact management.</p>',
      choices: [
        { label: 'Transition fully to protected contact', cost: 250000 * scale(s), costCat: 'construction', capital: true, apply: (s) => { aza(s, 4); rep(s, 3); return 'New training walls and protected-contact systems are going in.'; } },
        { label: 'Explain the husbandry publicly', apply: (s) => { rep(s, U.chance(s, 0.4 * ZG.mod(s, 'media')) ? 1 : -4); return 'Mixed reactions online.'; } },
      ] }),
  });

  def('tb_test', {
    cat: 'animal', cooldown: 1000,
    weight: (s) => (hasSp(s, (id) => id.includes('elephant')) ? 0.2 : 0),
    make: (s) => ({ icon: '🧪', title: 'Elephant tests positive for tuberculosis',
      text: '<p>A routine trunk wash came back positive for TB — which can spread to people. State health officials require testing of every keeper and months of treatment for the elephant.</p>',
      choices: [
        { label: 'Full treatment & staff testing', cost: 150000 * Math.sqrt(scale(s)), costCat: 'vetcare', apply: (s) => { aza(s, 1); return 'Months of daily medication hidden in treats. No staff infections.'; } },
        { label: 'Minimal protocol', cost: 30000, costCat: 'vetcare', apply: (s) => { if (U.chance(s, 0.3)) { rep(s, -6); morale(s, -8); return 'Two keepers converted to positive TB tests. The news was ugly.'; } return 'It worked out, this time.'; } },
      ] }),
  });

  def('conservation_crisis', {
    cat: 'aza', cooldown: 500, weight: () => 0.3,
    make: (s) => {
      const sp = SP(U.pick(s, s.animals.filter((a) => SP(a.sp).program === 'SSP').concat(s.animals)).sp);
      const amt = Math.round(40000 * scale(s));
      return { icon: '🌍', title: `Emergency appeal: wild ${sp.name}s`,
        text: `<p>A field partner reports a surge in poaching/habitat loss threatening wild ${sp.name}s. They're asking zoos for emergency funds for rangers and monitoring.</p>`,
        choices: [
          { label: `Send ${$(amt)} now`, cost: amt, costCat: 'conservation', apply: (s) => { aza(s, 3); rep(s, 2); return 'Your gift funded rangers for a year. Donors loved the story.'; } },
          { label: 'Run a guest "round-up" campaign', apply: (s) => { ZG.Econ.spend(s, 'conservation', amt * 0.5); aza(s, 2); rep(s, 1); return 'Guests rounded up their purchases and covered half.'; } },
          { label: 'Not in the budget', apply: (s) => { aza(s, -1); return 'Understood, but noted.'; } },
        ] };
    },
  });

  def('animal_fight', {
    cat: 'animal', cooldown: 200,
    weight: (s) => (s._hf && Object.values(s._hf).some((f) => f.spaceRatio < 0.75 && f.count > 1) ? 1 : 0),
    make: (s) => {
      const hid = Object.keys(s._hf).find((k) => s._hf[k].spaceRatio < 0.75 && s._hf[k].count > 1);
      const h = s.habitatsById[hid];
      if (!h) return null;
      const a = U.pick(s, ZG.Animals.inHab(s, h.id));
      if (!a) return null;
      return { icon: '⚔️', title: `Fight at ${h.name}`,
        text: `<p>Overcrowding at ${h.name} boiled over — ${a.name} the ${SP(a.sp).name} was injured in a squabble. Your curators say the habitat is too small for this many animals.</p>`,
        choices: [
          { label: 'Treat and reduce the group (transfer one out)', apply: (s) => { a.health -= 15; const others = ZG.Animals.inHab(s, h.id).filter((x) => x !== a && !x.star && SP(x.sp).program !== 'Loan'); if (others.length) ZG.AZA.sendOut(s, U.pick(s, others).id); return 'One animal transferred out; tension eased.'; } },
          { label: 'Treat and add visual barriers', cost: 20000, costCat: 'maintenance', apply: (s) => { a.health -= 15; return 'Extra logs and rock piles help, a little.'; } },
        ] };
    },
  });

  def('volunteers', {
    cat: 'staff', cooldown: 900, weight: () => 0.2,
    make: (s) => ({ icon: '🙋', title: 'Docent & volunteer program proposal',
      text: '<p>Your education team wants to expand the docent program — hundreds of trained volunteers at exhibits. Costs a coordinator and training, pays back in guest experience.</p>',
      choices: [
        { label: 'Fund it', cost: 70000 * Math.sqrt(scale(s)), costCat: 'admin', apply: (s) => { s.flags.docents = true; s.satisfaction += 4; rep(s, 1); ZG.Staff.hire(s, 'education', 1); return 'Docents in blue vests are everywhere now.'; } },
        { label: 'Not now', apply: () => 'Maybe next year.' },
      ] }),
  });

  // =====================================================================
  // NATURAL HAZARDS
  // =====================================================================
  const disasterCost = (s, base) => Math.round(base * scale(s) * ZG.mod(s, 'crisis') * (s.flags.bigDeductible ? 1.4 : 1));
  const insured = (s, amt) => {
    const reimb = govIsPublic(s) ? 0.55 : 0.4;
    ZG.Econ.earn(s, 'other', amt * reimb);
    return reimb;
  };
  function disaster(s, dmg, closeDays, reason) {
    const cost = disasterCost(s, dmg);
    pay(s, 'emergency', cost);
    const r = insured(s, cost);
    s.flags.recentDisaster = s.day;
    s.stats.disastersWeathered = (s.stats.disastersWeathered || 0) + 1;
    if (closeDays) close(s, closeDays, reason);
    return ` Damage: ${$(cost)} (insurance/${govIsPublic(s) ? 'FEMA' : 'insurers'} will cover ~${Math.round(r * 100)}%).${closeDays ? ` Closed ${closeDays} days.` : ''}`;
  }

  def('hurricane', {
    cat: 'disaster',
    prep: (s) => ({ name: U.pick(s, ZG.NAMES.storms), cat: U.weighted(s, [1, 2, 3, 4], (x) => [0.4, 0.3, 0.2, 0.1][x - 1]) }),
    make: (s, c) => ({ icon: '🌀', title: `Hurricane ${c.name} is forecast to hit (Category ${c.cat})`,
      text: `<p>The National Hurricane Center puts your zoo in the cone. Landfall in ~72 hours. Your hurricane plan calls for securing animals in hardened buildings, stocking 7 days of food, fuel for generators, and a "ride-out team" of keepers who will sleep at the zoo.</p>`,
      choices: [
        { label: 'Full hurricane plan', detail: 'Ride-out crew, pre-positioned supplies, generator fuel', cost: disasterCost(s, 90000), costCat: 'emergency', apply: (s) => {
          const hit = U.rand(s);
          if (hit < 0.35) { close(s, 2, 'Hurricane prep'); return `${c.name} turned away at the last minute. Better safe than sorry.`; }
          ZG.Infra.damage(s, 4 * c.cat); damageHabitats(s, 3 * c.cat, 0.5); morale(s, 3);
          s.weatherOverride = { type: 'storm', days: 2 };
          return `${c.name} hit hard, but every animal and every staffer came through safely.` + disaster(s, 150000 * c.cat, 2 + c.cat * 2, 'Hurricane ' + c.name);
        } },
        { label: 'Basic preparations', cost: disasterCost(s, 25000), costCat: 'emergency', apply: (s) => {
          const hit = U.rand(s);
          if (hit < 0.35) return `${c.name} missed. Whew.`;
          ZG.Infra.damage(s, 7 * c.cat); damageHabitats(s, 6 * c.cat, 0.7); hurtAnimals(s, 4 * c.cat);
          s.weatherOverride = { type: 'storm', days: 2 };
          if (c.cat >= 3) { const victim = U.pick(s, s.animals.filter((a) => SP(a.sp).cls !== 'mammal' || SP(a.sp).appeal < 5)); if (victim) ZG.Animals.die(s, victim, 'injuries during the hurricane'); rep(s, -3); }
          return `${c.name} caused serious damage.` + disaster(s, 300000 * c.cat, 3 + c.cat * 3, 'Hurricane ' + c.name);
        } },
      ] }),
  });

  def('tsunami', {
    cat: 'disaster',
    make: (s) => ({ icon: '🌊', title: 'Tsunami warning for Waikīkī',
      text: '<p>An earthquake off Alaska triggered a tsunami warning. The zoo sits in the evacuation zone near the shoreline. Sirens are sounding across Honolulu.</p>',
      choices: [
        { label: 'Evacuate guests & move animals to high holding', cost: 40000, costCat: 'emergency', apply: (s) => { close(s, 1, 'Tsunami warning'); if (U.chance(s, 0.85)) return 'The waves were small. The drill went smoothly.'; ZG.Infra.damage(s, 10, ['water', 'power', 'perimeter']); return 'Minor inundation reached the lower zoo.' + disaster(s, 250000, 4, 'Tsunami damage'); } },
        { label: 'Evacuate guests only', apply: (s) => { close(s, 1, 'Tsunami warning'); if (U.chance(s, 0.85)) return 'The warning was cancelled.'; ZG.Infra.damage(s, 14, ['water', 'power', 'perimeter']); hurtAnimals(s, 10); return 'Seawater flooded lower exhibits.' + disaster(s, 400000, 6, 'Tsunami damage'); } },
      ] }),
  });

  def('flood', {
    cat: 'disaster',
    make: (s) => ({ icon: '🌧️', title: 'Flash flood warning — record rainfall',
      text: `<p>${s.zooId === 'houston' ? 'Brays Bayou is rising fast' : s.zooId === 'national' ? 'Rock Creek is over its banks' : 'Streets are flooding'}, and forecasters expect several more inches overnight.</p>`,
      choices: [
        { label: 'Sandbag, pump, and move animals from low areas', cost: disasterCost(s, 50000), costCat: 'emergency', apply: (s) => { s.weatherOverride = { type: 'storm', days: 2 }; ZG.Infra.damage(s, 4, ['water', 'power', 'visitor']); return 'Water got in, but your prep limited the damage.' + disaster(s, 80000, 2, 'Flooding'); } },
        { label: 'Hope the drains hold', apply: (s) => { s.weatherOverride = { type: 'storm', days: 2 }; ZG.Infra.damage(s, 10, ['water', 'power', 'visitor', 'commissary']); damageHabitats(s, 10, 0.4); hurtAnimals(s, 6, (a) => SP(a.sp).cls === 'reptile' || SP(a.sp).cls === 'bird'); return 'Floodwaters swamped the commissary and several exhibits.' + disaster(s, 250000, 4, 'Flooding'); } },
      ] }),
  });

  def('heatwave', {
    cat: 'disaster',
    make: (s) => ({ icon: '🥵', title: 'Extreme heat wave',
      text: '<p>A heat dome will push temperatures past 100°F for over a week. Heat stress risk for guests, staff, and cold-adapted animals.</p>',
      choices: [
        { label: 'Misters, shade sails, cooling for animals', cost: disasterCost(s, 40000), costCat: 'emergency', apply: (s) => { s.weatherOverride = { type: 'heat', days: 8, temp: Math.max(...Z(s).climate.hi) + 12 }; s.satisfaction += 3; return 'Frozen fish-sicles, misters, and ice blocks everywhere. Guests appreciated the effort.'; } },
        { label: 'Open early, close at 1 p.m.', apply: (s) => { s.weatherOverride = { type: 'heat', days: 8, temp: Math.max(...Z(s).climate.hi) + 12 }; s.flags.attendanceMult = 0.8; s.flags.attendanceMultUntil = s.day + 8; return 'Shorter hours, lower attendance, safer staff.'; } },
        { label: 'Business as usual', apply: (s) => { s.weatherOverride = { type: 'heat', days: 8, temp: Math.max(...Z(s).climate.hi) + 12 }; hurtAnimals(s, 8, (a) => SP(a.sp).climate[1] < 90); morale(s, -3); return 'A guest and two staffers needed treatment for heat exhaustion.'; } },
      ] }),
  });

  def('wildfire', {
    cat: 'disaster',
    make: (s) => ({ icon: '🔥', title: 'Wildfire on the mountain',
      text: `<p>A fast-moving wildfire is ${U.pick(s, ['8 miles', '5 miles', '12 miles'])} away and winds are gusting. Smoke is thick. Evacuating a zoo is almost impossible — many animals can't be crated quickly — so most zoos shelter in place.</p>`,
      choices: [
        { label: 'Close, shelter-in-place, fire crews on standby', cost: disasterCost(s, 60000), costCat: 'emergency', apply: (s) => { s.weatherOverride = { type: 'smoke', days: 5 }; close(s, 4, 'Wildfire'); if (U.chance(s, 0.85)) return 'Firefighters held the line. The smoke cleared after a few days.'; ZG.Infra.damage(s, 12, ['perimeter', 'power', 'admin']); return 'Embers ignited brush along the perimeter.' + disaster(s, 350000, 4, 'Wildfire damage'); } },
        { label: 'Partial evacuation of small, crateable animals', cost: disasterCost(s, 120000), costCat: 'emergency', apply: (s) => { s.weatherOverride = { type: 'smoke', days: 5 }; close(s, 6, 'Wildfire'); for (const a of s.animals) a.welfare -= 6; rep(s, 3); return 'Keepers crated hundreds of animals overnight. A national story of heroism.'; } },
        { label: 'Stay open and monitor', apply: (s) => { s.weatherOverride = { type: 'smoke', days: 5 }; hurtAnimals(s, 6); if (U.chance(s, 0.3)) { rep(s, -6); close(s, 5, 'Wildfire'); return 'You had to order a chaotic mid-day evacuation. Terrible optics.'; } return 'The fire stayed away, but smoke hurt attendance.'; } },
      ] }),
  });

  def('blizzard', {
    cat: 'disaster',
    make: (s) => ({ icon: '❄️', title: 'Blizzard warning',
      text: '<p>Two feet of snow and high winds are forecast. Roads up to the zoo will be impassable. Keepers need to be on site to care for the animals.</p>',
      choices: [
        { label: 'Snow crew sleeps on site; extra heating', cost: disasterCost(s, 30000), costCat: 'emergency', apply: (s) => { s.weatherOverride = { type: 'snow', days: 3, temp: 20 }; close(s, 3, 'Blizzard'); morale(s, 3); return 'Keepers made snow angels with the grizzlies (from a safe distance).'; } },
        { label: 'Skeleton crew', apply: (s) => { s.weatherOverride = { type: 'snow', days: 3, temp: 20 }; close(s, 3, 'Blizzard'); if (U.chance(s, 0.3)) { ZG.Infra.damage(s, 8, ['commissary', 'admin', 'life']); return 'A barn roof partially collapsed under snow load.' + disaster(s, 150000, 2, 'Snow damage'); } return 'Everyone made it through.'; } },
      ] }),
  });

  def('freeze', {
    cat: 'disaster',
    make: (s) => ({ icon: '🥶', title: 'Arctic freeze threatens the power grid',
      text: '<p>Temperatures will fall into the teens for days, and the state grid operator is warning of rolling blackouts. Tropical animals can die in hours without heat.</p>',
      choices: [
        { label: 'Rent generators & fuel; keepers stay overnight', cost: disasterCost(s, 120000), costCat: 'emergency', apply: (s) => { s.weatherOverride = { type: 'snow', days: 4, temp: 22 }; close(s, 4, 'Winter storm'); ZG.Infra.damage(s, 5, ['water']); return 'The grid failed for 60 hours, but your generators kept every animal warm. Pipes burst, though.' + disaster(s, 60000, 0); } },
        { label: 'Rely on existing backup power', apply: (s) => { s.weatherOverride = { type: 'snow', days: 4, temp: 22 }; close(s, 4, 'Winter storm'); if (s.infra.power.cond < 60 || U.chance(s, 0.4)) { hurtAnimals(s, 20, (a) => SP(a.sp).climate[0] > 50); const v = s.animals.filter((a) => SP(a.sp).climate[0] > 60); if (v.length) ZG.Animals.die(s, U.pick(s, v), 'hypothermia during the freeze'); rep(s, -5); ZG.Infra.damage(s, 10, ['water', 'power']); return 'The old generators failed. It was a horrific night.' + disaster(s, 150000, 0); } return 'The backups held.'; } },
      ] }),
  });

  def('earthquake', {
    cat: 'disaster',
    make: (s) => ({ icon: '🫨', title: 'Earthquake!',
      text: `<p>A magnitude ${U.rf(s, 5.1, 6.2).toFixed(1)} quake struck nearby. Some keepers noticed the great apes reacting minutes before it hit.</p>`,
      choices: [{ label: 'Inspect everything', cost: 20000 * scale(s), costCat: 'emergency', apply: (s) => { ZG.Infra.damage(s, 8); damageHabitats(s, 6, 0.5); return 'Cracked moats, broken pipes, rattled nerves.' + disaster(s, 200000, 2, 'Earthquake inspections'); } }] }),
  });

  def('hail', {
    cat: 'disaster',
    make: (s) => ({ icon: '🧊', title: 'Hailstorm!',
      text: '<p>Golf-ball-sized hail pummeled the zoo for twenty minutes, shredding shade structures and skylights.</p>',
      choices: [{ label: 'Clean up and repair', apply: (s) => { ZG.Infra.damage(s, 5, ['visitor', 'admin', 'commissary']); damageHabitats(s, 4, 0.6); return 'Crews cleared ice and broken glass.' + disaster(s, 90000, 1, 'Hail cleanup'); } }] }),
  });

  def('drought', {
    cat: 'disaster',
    make: (s) => ({ icon: '🏜️', title: 'Drought: water restrictions ordered',
      text: '<p>The water utility ordered mandatory cuts of 20%. Pools, moats and landscaping use huge amounts of water.</p>',
      choices: [
        { label: 'Invest in water recycling for life-support', cost: 0.04 * s.infra.life.cost, costCat: 'capitalRepairs', capital: true, apply: (s) => { s.infra.life.cond = Math.min(100, s.infra.life.cond + 6); aza(s, 1); return 'Recycled water keeps pools full. A sustainability win.'; } },
        { label: 'Let landscaping go brown', apply: (s) => { for (const h of s.habitats) h.theming = Math.max(0, h.theming - 5); s.satisfaction -= 4; return 'The zoo looks parched this summer.'; } },
      ] }),
  });

  def('derecho', {
    cat: 'disaster',
    make: (s) => ({ icon: '🌪️', title: 'Derecho windstorm',
      text: '<p>A line of 80-mph straight-line winds tore through the region, dropping huge trees across paths and fences.</p>',
      choices: [{ label: 'Close and clear the damage', apply: (s) => { ZG.Infra.damage(s, 6, ['perimeter', 'power', 'visitor']); damageHabitats(s, 6, 0.5); return 'Arborists worked for days.' + disaster(s, 120000, 2, 'Storm cleanup'); } }] }),
  });
})((globalThis.ZG = globalThis.ZG || {}));
