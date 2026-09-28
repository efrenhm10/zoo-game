// Sidebar panels (HTML string renderers) and the player actions they trigger.
(function (ZG) {
  const U = ZG.U;
  const P = (ZG.Panels = {});
  const $ = U.money;
  const esc = U.esc;

  P.ui = { tab: 'overview', build: null, animalFilter: 'all', moveFor: null };

  P.TABS = [
    { id: 'overview', icon: '🏠', name: 'Overview' },
    { id: 'habitats', icon: '🏞️', name: 'Habitats & Build' },
    { id: 'animals', icon: '🦒', name: 'Collection' },
    { id: 'conservation', icon: '🧬', name: 'AZA & SSP' },
    { id: 'facilities', icon: '🔧', name: 'Infrastructure' },
    { id: 'finance', icon: '💰', name: 'Budget' },
    { id: 'staff', icon: '👥', name: 'Staff' },
    { id: 'fundraising', icon: '🤝', name: 'Fundraising' },
    { id: 'government', icon: '🏛️', name: 'Government' },
    { id: 'news', icon: '📰', name: 'News' },
  ];

  // ---------- small builders ----------
  const cls = (v, good = 70, ok = 50) => (v >= good ? 'good' : v >= ok ? 'warn' : 'bad');
  const bar = (v, max = 100, c) => `<div class="bar"><i class="${c || cls((v / max) * 100)}" style="width:${U.clamp((v / max) * 100, 0, 100)}%"></i></div>`;
  const meter = (label, v, hint) => `<div class="meter" title="${esc(hint || '')}"><span>${label}</span>${bar(v)}<b class="${cls(v)}">${Math.round(v)}</b></div>`;
  const btn = (label, act, data = {}, extra = '') => {
    const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    return `<button class="btn ${extra}" data-act="${act}" ${attrs}>${label}</button>`;
  };
  const dis = (label, why) => `<button class="btn" disabled title="${esc(why)}">${label}</button>`;
  const ratioTxt = (r) => `<b class="${cls(r * 100, 95, 80)}">${Math.round(r * 100)}%</b>`;
  const spn = (id) => ZG.SPECIES[id];
  const habName = (s, id) => (s.habitatsById[id] ? s.habitatsById[id].name : '—');
  P.helpers = { bar, meter, btn, cls };

  P.render = function (s) {
    const f = P['tab_' + P.ui.tab];
    return f ? f(s) : '';
  };

  // =====================================================================
  P.tab_overview = function (s) {
    const Z = ZG.zoo(s);
    const lm = s.ledger.months[s.ledger.months.length - 1];
    const alerts = P.alerts(s);
    const d = s.director;
    const objs = Z.objectives
      .map((o) => {
        const st = s.objectives.find((x) => x.id === o.id);
        return `<li class="${st.done ? 'done' : ''}">${st.done ? '✅' : '⬜'} ${esc(o.text)}</li>`;
      })
      .join('');
    return `
      <h2>${Z.emoji} ${esc(Z.name)}</h2>
      <p class="sub">Director ${esc(d.name)} · ${esc(ZG.DIRECTOR.careers.find((c) => c.id === d.career).name)} · ${esc(ZG.DIRECTOR.levels.find((l) => l.id === d.level).name)} in ${esc(ZG.DIRECTOR.fields.find((f) => f.id === d.field).name)}</p>
      <div class="kpis">
        <div><small>Guests today</small><b>${U.num(s.today.guests)}</b></div>
        <div><small>Operating cash</small><b class="${s.cash < 0 ? 'bad' : ''}">${$(s.cash)}</b></div>
        <div><small>Capital fund</small><b>${$(s.capital)}</b></div>
        <div><small>Members</small><b>${U.num(s.members)}</b></div>
        <div><small>Last month</small><b class="${lm && lm.net < 0 ? 'bad' : 'good'}">${lm ? $(lm.net) : '—'}</b></div>
        <div><small>Animals</small><b>${s.animals.length}</b></div>
      </div>
      ${meter('Animal welfare', ZG.Animals.avgWelfare(s), 'Average welfare across the collection')}
      ${meter('Guest satisfaction', s.satisfaction)}
      ${meter('Public reputation', s.rep)}
      ${meter('AZA standing', s.aza)}
      ${meter(Z.governance === 'city' ? 'City Hall confidence' : Z.governance === 'federal' ? 'Smithsonian confidence' : 'Board confidence', s.board, 'If this reaches zero you will be replaced')}
      ${meter('Staff morale', s.morale)}
      ${alerts.length ? `<h3>⚠️ Needs attention</h3><ul class="alerts">${alerts.map((a) => `<li data-act="tab" data-tab="${a.tab}">${a.text}</li>`).join('')}</ul>` : ''}
      <h3>🎯 Goals (by end of ${ZG.OBJ_DEADLINE})</h3><ul class="objs">${objs}</ul>
      <h3>Accreditation</h3>
      <p>Status: <b class="${s.acc.status === 'accredited' ? 'good' : 'bad'}">${s.acc.status.toUpperCase()}</b> · next inspection ${U.fmtMonth(s.acc.next)} (${Math.max(0, Math.round((s.acc.next - s.day) / 30))} months)</p>
      <p class="tip">💡 Press <b>🚶 Walk</b> (or <kbd>Tab</kbd>) to walk the grounds as your director, meet the animals and overhear guests.</p>`;
  };

  P.alerts = function (s) {
    const a = [];
    const Z = ZG.zoo(s);
    const open = s.ssp.recs.filter((r) => r.status === 'open').length;
    if (open) a.push({ tab: 'conservation', text: `${open} SSP recommendation${open > 1 ? 's' : ''} awaiting your response` });
    for (const d of ['keepers', 'vets', 'maintenance', 'guest']) {
      const r = ZG.Staff.ratio(s, d);
      if (r < 0.85) a.push({ tab: 'staff', text: `${ZG.Staff.DEPTS.find((x) => x.id === d).name} understaffed (${Math.round(r * 100)}%)` });
    }
    if (s.cash < 0) a.push({ tab: 'finance', text: `Operating cash is negative — you're paying interest on the credit line` });
    const crit = Object.entries(s.infra).filter(([, v]) => v.cond < 35 && !v.repair);
    if (crit.length) a.push({ tab: 'facilities', text: `${crit.length} infrastructure system${crit.length > 1 ? 's' : ''} in critical condition` });
    const worn = s.habitats.filter((h) => !h.construction && !h.renovation && h.condition < 40);
    if (worn.length) a.push({ tab: 'habitats', text: `${worn.length} habitat${worn.length > 1 ? 's' : ''} badly worn` });
    const empty = s.habitats.filter((h) => !h.construction && !s.animals.some((x) => x.hab === h.id));
    if (empty.length) a.push({ tab: 'animals', text: `${empty.map((h) => h.name).join(', ')} has no animals — visit the Animal Exchange` });
    if (s.acc.next - s.day < 120) a.push({ tab: 'conservation', text: `AZA inspection in ${Math.round((s.acc.next - s.day) / 30)} months` });
    const sick = s.animals.filter((x) => x.sick && x.sick.sev >= 2).length;
    if (sick) a.push({ tab: 'animals', text: `${sick} animal${sick > 1 ? 's' : ''} seriously ill` });
    if (s.sponsorOffers.length) a.push({ tab: 'fundraising', text: `${s.sponsorOffers.length} sponsorship offer${s.sponsorOffers.length > 1 ? 's' : ''} on the table` });
    if (Z.governance === 'federal' && s.gov.shutdown) a.push({ tab: 'government', text: 'Government shutdown in progress' });
    return a;
  };

  // =====================================================================
  P.tab_habitats = function (s) {
    const R = ZG.Render.state;
    let top = '';
    if (R.selected != null) top = P.inspector(s, s.plots[R.selected]);
    else top = '<p class="tip">Click a habitat or an <b>Available lot</b> on the map to inspect or build.</p>';
    const rows = s.plots
      .filter((p) => p.kind === 'habitat')
      .map((p) => {
        const h = p.hab ? s.habitatsById[p.hab] : null;
        if (!h) return `<tr data-act="select" data-plot="${p.id}" class="click"><td>🪧 <i>Available lot</i></td><td>${U.num(p.area)} m²</td><td colspan="2">${btn('Plan a habitat', 'select', { plot: p.id }, 'sm')}</td></tr>`;
        const n = s.animals.filter((a) => a.hab === h.id).length;
        return `<tr data-act="select" data-plot="${p.id}" class="click"><td>${esc(h.name)}${h.construction ? ' 🏗️' : h.renovation ? ' 🛠️' : ''}</td><td>${n} animals</td><td style="width:90px">${h.construction ? `${Math.round((1 - h.construction.days / h.construction.total) * 100)}% built` : bar(h.condition)}</td><td>${Math.round(ZG.Habitats.appeal(s, h))}★</td></tr>`;
      })
      .join('');
    return `<h2>🏞️ Habitats & Construction</h2>${top}<h3>All plots</h3><table class="list">${rows}</table>`;
  };

  P.inspector = function (s, p) {
    if (!p) return '';
    const Z = ZG.zoo(s);
    if (p.kind === 'vet') {
      const q = s.animals.filter((a) => a.loc === 'quarantine');
      return `<div class="card"><h3>🏥 Animal Hospital & Quarantine</h3><p>Condition: ${bar(s.infra.hospital.cond)}</p><p>Vet team staffing: ${ratioTxt(ZG.Staff.ratio(s, 'vets'))}</p>
        <p><b>In quarantine:</b> ${q.length ? q.map((a) => `${spn(a.sp).emoji} ${esc(a.name)} (${a.qDays}d left → ${esc(habName(s, a.hab))})`).join('<br>') : 'none'}</p></div>`;
    }
    if (p.kind === 'cafe') {
      const lm = s.ledger.months[s.ledger.months.length - 1];
      return `<div class="card"><h3>🍔 Food Court</h3><p>Food & retail revenue last month: <b>${lm ? $(lm.rev.concessions || 0) : '—'}</b></p><p>Guest services staffing: ${ratioTxt(ZG.Staff.ratio(s, 'guest'))} — more staff means shorter lines and higher spending per guest.</p></div>`;
    }
    const h = p.hab ? s.habitatsById[p.hab] : null;
    if (!h) return P.buildForm(s, p);
    const f = s._hf && s._hf[h.id];
    const animals = s.animals.filter((a) => a.hab === h.id);
    const spList = [...new Set(animals.map((a) => a.sp))];
    let html = `<div class="card"><h3>${esc(h.sponsor ? h.sponsor + ' ' + h.name : h.name)}</h3>
      <p class="sub">${ZG.BIOMES[h.biome].name} · ${U.num(h.area)} m² · ${ZG.Habitats.TIERS[h.tier].name}${h.climate !== 'none' ? ' · ' + (h.climate === 'chilled' ? '❄️ chilled building' : '🔥 heated building') : ''}</p>`;
    if (h.construction) {
      html += `<p>🏗️ Under construction — ${Math.round((1 - h.construction.days / h.construction.total) * 100)}% complete, opens in ~${Math.ceil(h.construction.days / 30)} months.</p></div>`;
      return html;
    }
    html += `<div class="grid2"><div>Condition ${bar(h.condition)}</div><div>Theming ${bar(h.theming)}</div></div>`;
    if (f) {
      html += `<div class="grid2"><div>Space ${bar(f.space)}</div><div>Keeper care ${bar(f.care)}</div></div>`;
      html += `<p class="sub">Space ratio ${f.spaceRatio.toFixed(1)}× minimum${f.mixOk ? '' : ' · <span class="bad">incompatible species mix!</span>'}</p>`;
      for (const id of spList) {
        const x = f.per[id];
        if (!x) continue;
        const sp = spn(id);
        const notes = [];
        if (x.biome < 100) notes.push('wrong biome');
        if (x.climate < 80) notes.push(`climate stress (${Math.round(x.tempDiff)}°F outside range)`);
        if (x.social < 90) notes.push(x.n < sp.group[0] ? `group too small (ideal ${sp.group[0]}–${sp.group[1]})` : 'group too large');
        html += `<p>${sp.emoji} <b>${sp.name}</b> ×${x.n} — habitat welfare <b class="${cls(x.w)}">${Math.round(x.w)}</b>${notes.length ? ` <span class="warn">(${notes.join(', ')})</span>` : ''}</p>`;
      }
    }
    if (!animals.length) html += `<p class="warn">No animals here. Get some from the Animal Exchange (Collection tab) or SSP recommendations.</p>`;
    const ren = ZG.Habitats.renovateCost(s, h);
    const them = Math.round(h.area * 220 * Z.costMult);
    html += `<div class="actions">
      ${h.renovation ? `<span>🛠️ Renovating (${Math.ceil(h.renovation.days / 30)} mo left)</span>` : btn(`Renovate (${$(ren)})`, 'renovate', { hab: h.id })}
      ${h.theming < 95 && !h.renovation ? btn(`Improve theming (${$(them)})`, 'theming', { hab: h.id }) : ''}
      ${h.climate === 'none' ? btn(`Add heated building (${$(1.2e6 * Z.costMult + h.area * 250)})`, 'climate', { hab: h.id, type: 'heated' }) + btn(`Add chilled building (${$(1.2e6 * Z.costMult + h.area * 250)})`, 'climate', { hab: h.id, type: 'chilled' }) : ''}
      ${!animals.length ? btn('Demolish', 'demolish', { hab: h.id }, 'danger') : ''}
    </div>
    <p class="sub">Capital work draws on the capital fund first, then operating cash.</p></div>`;
    return html;
  };

  P.buildForm = function (s, p) {
    const Z = ZG.zoo(s);
    const b = P.ui.build && P.ui.build.plot === p.id ? P.ui.build : (P.ui.build = { plot: p.id, name: 'New Habitat', biome: 'savanna', tier: 'standard', climate: 'none' });
    const cost = ZG.Habitats.buildCost(s, p, b.tier, b.climate);
    const days = ZG.Habitats.TIERS[b.tier].days * (Z.governance === 'city' || Z.governance === 'federal' ? 1.25 : 1);
    const fits = Object.values(ZG.SPECIES).filter((sp) => sp.biomes.includes(b.biome) && sp.program !== 'Loan');
    const cap = (sp) => Math.floor(p.area / sp.space);
    const opt = (arr, cur) => arr.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('');
    return `<div class="card"><h3>🪧 Plan a new habitat</h3><p class="sub">Lot size ${U.num(p.area)} m²</p>
      <label>Name <input data-build="name" value="${esc(b.name)}" maxlength="40"></label>
      <label>Biome <select data-build="biome">${opt(Object.entries(ZG.BIOMES).map(([k, v]) => [k, v.name]), b.biome)}</select></label>
      <label>Design tier <select data-build="tier">${opt(Object.entries(ZG.Habitats.TIERS).map(([k, v]) => [k, `${v.name} (${$(v.perM2 * Z.costMult)}/m², theming ${v.theming})`]), b.tier)}</select></label>
      <label>Climate control <select data-build="climate">${opt([['none', 'None (outdoor)'], ['heated', 'Heated building'], ['chilled', 'Chilled building']], b.climate)}</select></label>
      <p><b>Cost: ${$(cost)}</b> · build time ~${Math.round(days / 30)} months${Z.governance === 'city' || Z.governance === 'federal' ? ' (public procurement adds time)' : ''}</p>
      <p class="sub">Funds available: capital ${$(s.capital)} + cash ${$(s.cash)} + credit line ${$(ZG.Econ.creditLimit(s))}</p>
      <p class="sub">Suitable species (max group by space): ${fits.map((sp) => `${sp.emoji} ${sp.name} (${cap(sp)})`).join(', ')}</p>
      <div class="actions">${btn('🏗️ Break ground', 'build', { plot: p.id }, 'primary')}${!s.dev.campaign ? btn(`Launch capital campaign for it (${$(cost)})`, 'campaign', { goal: cost, label: b.name }) : ''}</div></div>`;
  };

  // =====================================================================
  P.tab_animals = function (s) {
    const habs = s.habitats.filter((h) => !h.construction);
    const byHab = {};
    for (const a of s.animals) (byHab[a.loc === 'quarantine' ? 'q' : a.hab] = byHab[a.loc === 'quarantine' ? 'q' : a.hab] || []).push(a);
    const row = (a) => {
      const sp = spn(a.sp);
      const flags = [a.star ? '⭐' : '', a.preg ? '🤰' : '', a.sick ? `<span title="${esc(a.sick.name)}">🤒</span>` : '', a.inbred ? '<span title="Inbred">⚠️</span>' : '', a.age < 365 ? '🍼' : ''].join('');
      const breedable = sp.breeds && ZG.Animals.isMature(a);
      const moving = P.ui.moveFor === a.id;
      return `<tr><td>${sp.emoji}</td><td><b>${esc(a.name)}</b> ${a.sex === 'M' ? '♂' : '♀'} ${flags}<br><small>${sp.name} · ${U.ageStr(a.age)} · GV ${a.gv}</small></td>
        <td style="width:70px"><small>W</small>${bar(a.welfare)}<small>H</small>${bar(a.health)}</td>
        <td class="acts">${breedable ? btn(a.contra ? '💊 Contracepted' : '💞 Breeding', 'contra', { aid: a.id }, 'sm ' + (a.contra ? '' : 'on')) : ''}
        ${moving ? `<select data-move="${a.id}"><option value="">Move to…</option>${habs.filter((h) => h.id !== a.hab).map((h) => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select>` : btn('Move', 'moveOpen', { aid: a.id }, 'sm')}
        ${sp.program !== 'Loan' ? btn('Transfer out', 'sendOut', { aid: a.id }, 'sm') : ''}</td></tr>`;
    };
    let html = `<h2>🦒 Collection (${s.animals.length} animals)</h2><p class="sub">Plus a supporting collection of birds, reptiles & invertebrates. 💊 = on contraception; 💞 = allowed to breed. Follow SSP recommendations to avoid unplanned births.</p>`;
    if (byHab.q) html += `<h3>🏥 Quarantine</h3><table class="list animals">${byHab.q.map(row).join('')}</table>`;
    for (const h of habs) {
      const list = byHab[h.id];
      html += `<h3 data-act="select" data-plot="${h.plot}" class="click">${esc(h.name)} <small>(${list ? list.length : 0})</small></h3>`;
      html += list ? `<table class="list animals">${list.map(row).join('')}</table>` : '<p class="sub">Empty.</p>';
    }
    html += P.market(s);
    return html;
  };

  P.market = function (s) {
    const habs = s.habitats.filter((h) => !h.construction);
    const rows = s.market
      .map((o) => {
        const sp = spn(o.sp);
        const good = habs.filter((h) => sp.biomes.includes(h.biome));
        const opts = habs.map((h) => `<option value="${h.id}" ${good.includes(h) && s.animals.some((a) => a.hab === h.id && a.sp === o.sp) ? 'selected' : ''}>${sp.biomes.includes(h.biome) ? '✓ ' : '✗ '}${esc(h.name)}</option>`).join('');
        return `<div class="card offer"><div>${sp.emoji} <b>${o.count > 1 ? o.count + '× ' : ''}${sp.name}</b> <small>${o.count === 1 ? (o.sex === 'M' ? '♂' : '♀') + ' · ' : ''}${U.ageStr(o.age)} · GV ${o.gv} · ${sp.iucn}${sp.program === 'SSP' ? ' · SSP' : ''}</small><br><small>From ${esc(o.from)} · ${o.kind === 'rescue' ? 'rescue' : 'AZA loan (no purchase price)'} · expires ${U.fmtDate(o.expires)}</small></div>
          <div class="actions"><select data-acq="${o.id}"><option value="">Choose habitat…</option>${opts}</select>${btn(`Accept (${$(o.cost)} transport)`, 'acquire', { oid: o.id }, 'sm primary')}</div></div>`;
      })
      .join('');
    return `<h3>🔄 Animal Exchange</h3><p class="sub">Accredited zoos don't buy and sell animals — they move them on breeding loans. You pay transport and quarantine.${ZG.AZA.accredited(s) ? '' : ' <b class="bad">Without accreditation, SSP animals are unavailable.</b>'}</p>${rows || '<p>No animals available this month.</p>'}`;
  };

  // =====================================================================
  P.tab_conservation = function (s) {
    const sc = ZG.AZA.inspectionScore(s);
    const recs = s.ssp.recs.slice().sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1));
    const recHtml = recs
      .map((r) => {
        const sp = spn(r.sp);
        const typeName = { breed: '💞 Breed', nobreed: '🚫 Do not breed', send: '📤 Send out', receive: '📥 Receive', hold: '🏠 Space request' }[r.type];
        let acts = '';
        if (r.status === 'open') {
          if (r.type === 'receive') {
            const habs = s.habitats.filter((h) => !h.construction && sp.biomes.includes(h.biome));
            acts = `<select data-rechab="${r.id}">${habs.map((h) => `<option value="${h.id}" ${s.animals.some((a) => a.hab === h.id && a.sp === r.sp) ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>`;
            acts += habs.length ? btn(`Accept (${$(ZG.AZA.transportCost(s, r.sp))})`, 'ssp', { rid: r.id, yes: 1 }, 'sm primary') : dis('Accept', 'Build a suitable habitat first');
          } else acts = btn(r.type === 'nobreed' ? 'Acknowledge' : 'Accept', 'ssp', { rid: r.id, yes: 1 }, 'sm primary');
          acts += btn('Decline', 'ssp', { rid: r.id, yes: 0 }, 'sm');
        }
        return `<div class="card rec ${r.status}"><div><b>${typeName}</b> · ${sp.emoji} ${sp.name} <small>(${sp.iucn})</small> <span class="pill">${r.status}</span></div><p>${esc(r.text)}</p><small>${esc(r.partner)} · respond by ${U.fmtDate(r.deadline)}</small><div class="actions">${acts}</div></div>`;
      })
      .join('');
    const parts = Object.entries(sc.parts).map(([k, v]) => `<tr><td>${k}</td><td style="width:110px">${bar(v)}</td><td>${Math.round(v)}</td></tr>`).join('');
    return `<h2>🧬 AZA & Species Survival Plans</h2>
      <div class="card"><h3>Accreditation: <span class="${s.acc.status === 'accredited' ? 'good' : 'bad'}">${s.acc.status.toUpperCase()}</span></h3>
      <p>Next inspection: <b>${U.fmtDate(s.acc.next)}</b>. Estimated score today: <b class="${sc.total >= 68 ? 'good' : sc.total >= 56 ? 'warn' : 'bad'}">${Math.round(sc.total)}</b> (need 68)</p>
      <table class="list">${parts}</table></div>
      ${meter('AZA standing', s.aza, 'How the AZA and SSP coordinators view your zoo')}
      <h3>Breeding & Transfer Plan recommendations</h3>
      <p class="sub">SSP coordinators manage each species as one North American population to keep it genetically healthy. New plans are published every February.</p>
      ${recHtml || '<p>No current recommendations.</p>'}
      <h3>Field conservation</h3>
      ${P.slider(s, 'conservation', 'Annual field-conservation contribution', 0, ZG.zoo(s).refs.conservation * 3)}`;
  };

  // =====================================================================
  P.tab_facilities = function (s) {
    const rows = ZG.Infra.SYSTEMS.map((x) => {
      const st = s.infra[x.id];
      const c80 = ZG.Infra.repairCost(s, x.id, 80), c95 = ZG.Infra.repairCost(s, x.id, 95);
      return `<div class="card"><div class="row"><span>${x.icon} <b>${x.name}</b></span><b class="${cls(st.cond)}">${Math.round(st.cond)}</b></div>${bar(st.cond)}
        <small>Replacement value ${$(st.cost)}</small>
        <div class="actions">${st.repair ? `🏗️ Repair underway — ${Math.ceil(st.repair.days / 30)} mo left` : `${st.cond < 80 ? btn(`Repair → 80 (${$(c80)})`, 'repair', { sys: x.id, to: 80 }, 'sm') : ''}${st.cond < 95 ? btn(`Rebuild → 95 (${$(c95)})`, 'repair', { sys: x.id, to: 95 }, 'sm') : ''}`}</div></div>`;
    }).join('');
    const eff = ZG.Infra.maintEffect(s);
    return `<h2>🔧 Infrastructure & Deferred Maintenance</h2>
      <div class="kpis"><div><small>Deferred backlog</small><b class="bad">${$(ZG.Infra.backlog(s))}</b></div><div><small>At start</small><b>${$(s.stats.backlogStart)}</b></div><div><small>Upkeep effectiveness</small><b class="${cls(eff * 80)}">${Math.round(eff * 100)}%</b></div></div>
      <p class="sub">Every system decays each year. Routine maintenance budget and facilities staff slow the decay; below ~50 condition, systems start failing — and emergency repairs cost far more than planned ones.</p>
      ${P.slider(s, 'maintenance', 'Routine maintenance budget / yr', 0, ZG.zoo(s).refs.maintenance * 2.5)}
      ${rows}`;
  };

  // =====================================================================
  P.slider = function (s, key, label, min, max, step) {
    const v = s.policy[key];
    step = step || (max > 1e6 ? 50000 : max > 1e5 ? 5000 : max > 200 ? 5 : 1);
    const fmt = key === 'admission' || key === 'memberPrice' || key === 'parkingFee' ? `$${v}` : $(v);
    return `<label class="slider">${label}: <b data-lbl="${key}">${fmt}</b><input type="range" data-policy="${key}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
  };

  function svgChart(months) {
    if (!months.length) return '<p class="sub">Charts appear after your first month.</p>';
    const ms = months.slice(-24);
    const max = Math.max(...ms.map((m) => Math.max(m.revTotal, m.expTotal)), 1);
    const w = 340, h = 120, bw = w / ms.length;
    let bars = '';
    ms.forEach((m, i) => {
      const rh = (m.revTotal / max) * (h - 10), eh = (m.expTotal / max) * (h - 10);
      bars += `<rect x="${i * bw + 1}" y="${h - rh}" width="${bw / 2 - 1}" height="${rh}" fill="#4caf50"><title>${U.MONTHS[m.m]} ${m.y} revenue ${$(m.revTotal)}</title></rect>`;
      bars += `<rect x="${i * bw + bw / 2}" y="${h - eh}" width="${bw / 2 - 1}" height="${eh}" fill="#e57373"><title>${U.MONTHS[m.m]} ${m.y} expenses ${$(m.expTotal)}</title></rect>`;
    });
    const cmin = Math.min(...ms.map((m) => m.cash), 0), cmax = Math.max(...ms.map((m) => m.cash), 1);
    const pts = ms.map((m, i) => `${i * bw + bw / 2},${h - ((m.cash - cmin) / (cmax - cmin || 1)) * (h - 10) - 5}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h + 14}" class="chart"><g>${bars}</g><polyline points="${pts}" fill="none" stroke="#ffd54f" stroke-width="2"/><text x="0" y="${h + 12}" font-size="9" fill="currentColor">${U.MONTHS[ms[0].m]} ${ms[0].y}</text><text x="${w}" y="${h + 12}" font-size="9" text-anchor="end" fill="currentColor">${U.MONTHS[ms[ms.length - 1].m]} ${ms[ms.length - 1].y}</text></svg><p class="legend"><span class="g">■</span> revenue <span class="r">■</span> expenses <span class="y">—</span> cash</p>`;
  }

  P.tab_finance = function (s) {
    const Z = ZG.zoo(s);
    const t = U.dateOf(s.day);
    const y = ZG.Econ.yearTotals(s, t.y);
    // include current partial month
    const cur = s.ledger.cur;
    const rev = Object.assign({}, y.rev), exp = Object.assign({}, y.exp);
    for (const k in cur.rev) rev[k] = (rev[k] || 0) + cur.rev[k];
    for (const k in cur.exp) exp[k] = (exp[k] || 0) + cur.exp[k];
    const rt = Object.values(rev).reduce((a, b) => a + b, 0);
    let et = 0, capex = 0;
    for (const k in exp) ZG.Econ.CAPEX.includes(k) ? (capex += exp[k]) : (et += exp[k]);
    const line = (obj, names, skipCapex) =>
      Object.entries(obj)
        .filter(([k]) => !skipCapex || !ZG.Econ.CAPEX.includes(k))
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<tr><td>${names[k] || k}</td><td>${$(v)}</td></tr>`)
        .join('');
    const admission = Z.priceLocked
      ? `<p>🎟️ Admission: <b>FREE</b> (Smithsonian tradition — not adjustable)</p>${P.slider(s, 'parkingFee', 'Parking fee', 0, 60, 1)}`
      : Z.priceNeedsVote
        ? `${P.slider(s, 'admission', 'Proposed admission (requires City Council ordinance)', 5, 80, 1)}${s.gov.feeProposal ? `<p class="warn">Ordinance for $${s.gov.feeProposal.price} pending — vote ${U.fmtDate(s.gov.feeProposal.day)}</p>` : ''}`
        : P.slider(s, 'admission', 'Adult admission', 5, Math.round(Z.refs.admission * 2), 1);
    return `<h2>💰 Budget & Finances</h2>
      <div class="kpis"><div><small>Operating cash</small><b class="${s.cash < 0 ? 'bad' : ''}">${$(s.cash)}</b></div><div><small>Capital fund (restricted)</small><b>${$(s.capital)}</b></div><div><small>Credit line</small><b>${$(ZG.Econ.creditLimit(s))}</b></div><div><small>Annual op. budget</small><b>${$(ZG.Econ.annualBudget(s))}</b></div></div>
      <h3>Revenue policy</h3>${admission}
      ${P.slider(s, 'memberPrice', 'Family membership price', 30, Math.round(Z.refs.memberPrice * 2), 1)}
      <h3>Spending policy</h3>
      ${P.slider(s, 'marketing', 'Marketing / yr', 0, Z.refs.marketing * 3)}
      ${P.slider(s, 'maintenance', 'Routine maintenance / yr', 0, Z.refs.maintenance * 2.5)}
      ${P.slider(s, 'enrichment', 'Animal enrichment & supplies / yr', 0, Z.refs.enrichment * 3)}
      ${P.slider(s, 'conservation', 'Field conservation / yr', 0, Z.refs.conservation * 3)}
      <h3>Last 24 months</h3>${svgChart(s.ledger.months)}
      <h3>${t.y} year-to-date</h3>
      <div><table class="list fin"><tr><th>Revenue</th><th>${$(rt)}</th></tr>${line(rev, ZG.Econ.REV)}</table>
      <table class="list fin"><tr><th>Operating expenses</th><th>${$(et)}</th></tr>${line(exp, ZG.Econ.EXP, true)}</table></div>
      <p>Operating result: <b class="${rt - et >= 0 ? 'good' : 'bad'}">${$(rt - et)}</b> · Capital spending: <b>${$(capex)}</b></p>`;
  };

  // =====================================================================
  P.tab_staff = function (s) {
    const Z = ZG.zoo(s);
    const rows = ZG.Staff.DEPTS.map((d) => {
      const st = s.staff[d.id];
      const req = ZG.Staff.required(s, d.id);
      const pend = ZG.Staff.pending(s, d.id);
      const r = ZG.Staff.ratio(s, d.id);
      return `<div class="card"><div class="row"><span>${d.icon} <b>${d.name}</b></span><span>${st.n} / ${req} needed · ${ratioTxt(r)}</span></div>
        <small>${d.desc} Avg salary ${$(st.salary)} (+${Math.round((Z.benefits - 1) * 100)}% benefits).${pend ? ` <b>${pend} hire${pend > 1 ? 's' : ''} in the pipeline.</b>` : ''}</small>
        <div class="actions">${btn('Hire +1', 'hire', { dept: d.id, n: 1 }, 'sm')}${btn('Hire +5', 'hire', { dept: d.id, n: 5 }, 'sm')}${btn('Lay off −1', 'layoff', { dept: d.id, n: 1 }, 'sm danger')}${btn('Lay off −5', 'layoff', { dept: d.id, n: 5 }, 'sm danger')}</div></div>`;
    }).join('');
    return `<h2>👥 Staff (${ZG.Staff.total(s)} FTE)</h2>
      <div class="kpis"><div><small>Payroll + benefits</small><b>${$(ZG.Staff.annualCost(s))}/yr</b></div><div><small>Morale</small><b class="${cls(s.morale)}">${Math.round(s.morale)}</b></div><div><small>Hiring time</small><b>~${Math.round(Z.hireDelay / 30)} mo</b></div></div>
      ${s.flags.hiringFreeze > s.day ? `<p class="bad">Hiring freeze until ${U.fmtDate(s.flags.hiringFreeze)}.</p>` : ''}
      <p class="sub">"Needed" scales with your collection, facilities and attendance. Overworked staff burn out and quit; layoffs hurt morale${Z.governance === 'city' || Z.governance === 'federal' ? ' and anger the unions' : ''}.</p>${rows}`;
  };

  // =====================================================================
  P.tab_fundraising = function (s) {
    const Z = ZG.zoo(s);
    const D = ZG.Dev;
    const pros = s.dev.prospects
      .map((p) => `<div class="card"><div class="row"><b>${esc(p.name)}</b><span>capacity ~${$(p.cap)}</span></div><small>${D.passionText(p.passion)} · readiness</small>${bar(p.ready)}
        <div class="actions">${btn(p.cultivating ? '☕ Cultivating ($1.5K/mo)' : 'Start cultivating', 'cultivate', { pid: p.id }, 'sm ' + (p.cultivating ? 'on' : ''))}${btn(`Ask ${$(p.cap * 0.5)}`, 'ask', { pid: p.id, lvl: 'low' }, 'sm')}${btn(`Ask ${$(p.cap)}`, 'ask', { pid: p.id, lvl: 'mid' }, 'sm')}${btn(`Ask ${$(p.cap * 1.6)}`, 'ask', { pid: p.id, lvl: 'high' }, 'sm')}</div></div>`)
      .join('');
    const c = s.dev.campaign;
    const camp = c
      ? `<div class="card"><b>📣 ${esc(c.label)}</b> — ${$(c.raised)} of ${$(c.goal)}${bar(c.raised, c.goal)}<small>Ends ${U.fmtDate(c.end)}</small></div>`
      : `<p>No active campaign. ${btn(`Launch campaign to cut backlog (${$(ZG.Infra.backlog(s) * 0.5)})`, 'campaign', { goal: Math.round(ZG.Infra.backlog(s) * 0.5), label: 'Renew Our Zoo' })} <br><small>Or launch one for a specific new habitat from the build panel.</small></p>`;
    const offers = s.sponsorOffers
      .map((o) => `<div class="card ${o.risk > 0.5 ? 'risky' : ''}"><div class="row"><b>${esc(o.name)}</b><span>${$(o.amount)}/yr × ${o.years} yrs</span></div><small>${esc(o.ind)} · ${esc(D.sponsorKindText(o, s))} · reputational risk: <b class="${o.risk > 0.5 ? 'bad' : o.risk > 0.25 ? 'warn' : 'good'}">${o.risk > 0.5 ? 'HIGH' : o.risk > 0.25 ? 'medium' : 'low'}</b> · expires ${U.fmtDate(o.expires)}</small>
        <div class="actions">${btn('Sign', 'sponsorYes', { oid: o.id }, 'sm primary')}${btn('Decline', 'sponsorNo', { oid: o.id }, 'sm')}</div></div>`)
      .join('');
    const active = s.sponsors.map((x) => `<li>${esc(x.name)} — ${$(x.amount)}/yr until ${U.fmtDate(x.end)} ${btn('End', 'sponsorDrop', { name: x.name }, 'sm danger')}</li>`).join('');
    const grants = ZG.NAMES.grants.map((g, i) => `<li>${esc(g.name)} <small>(${$(g.amt[0])}–${$(g.amt[1])})</small> ${btn('Apply', 'grant', { idx: i }, 'sm')}</li>`).join('');
    const pend = s.dev.grants.map((g) => `<li>⏳ ${esc(g.name)} — decision ${U.fmtDate(g.day)}</li>`).join('');
    const galaReady = s.day - s.dev.lastGala >= 300;
    return `<h2>🤝 Fundraising & Partnerships</h2>
      <p class="sub">Annual-fund giving arrives monthly (strongest in December) and scales with your development staff, reputation and the economy. ${esc(Z.partner)} supports the zoo.</p>
      <h3>Major-gift prospects</h3>${pros || '<p>No prospects right now — more development staff finds more.</p>'}
      <h3>Capital campaign</h3>${camp}
      <h3>Events</h3><p>${galaReady ? btn(`🥂 Host the annual gala (${$(Z.donorBase * 0.06)})`, 'gala') : `Next gala available ${U.fmtDate(s.dev.lastGala + 300)}`}</p>
      <h3>Grants</h3><ul class="plain">${grants}${pend}</ul>
      <h3>Corporate sponsorship offers</h3>${offers || '<p class="sub">No offers right now.</p>'}
      ${active ? `<h3>Active sponsors</h3><ul class="plain">${active}</ul>` : ''}`;
  };

  // =====================================================================
  P.tab_government = function (s) {
    const Z = ZG.zoo(s);
    const g = s.gov;
    const type = {
      city: 'Your zoo is a City department. The Mayor proposes the budget in spring; the Council votes. Fee changes require an ordinance. Staff are city employees with union contracts and civil-service hiring.',
      federal: 'Your zoo is part of the Smithsonian. Congress appropriates funds for a fiscal year starting October 1. If Congress misses the deadline, the government shuts down and so do your gates.',
      contract: 'A nonprofit runs the zoo under a management agreement with the City, which owns the land and animals and pays an annual fee that escalates under the contract.',
      nonprofit_tax: 'A private nonprofit runs the zoo, but a City Charter provision still dedicates a small property-tax levy to it. Revenue tracks property values.',
      private: 'No government funding at all. Every dollar comes from guests, members, donors and sponsors. Your Board of Trustees is your only boss.',
    }[g.type];
    return `<h2>🏛️ Government & Governance</h2>
      <div class="card"><b>${esc(Z.govName)}</b><p>${type}</p></div>
      <div class="kpis"><div><small>Public funding</small><b>${$(g.appropriation)}/yr</b></div><div><small>Local economy</small><b class="${s.economy >= 1 ? 'good' : 'warn'}">${Math.round(s.economy * 100)}</b></div><div><small>Your boss</small><b>${esc(Z.bossName)}</b></div></div>
      ${g.type !== 'private' ? meter('Political relationship', g.relationship, 'Affects budget requests, votes and bailouts') : ''}
      ${meter('Confidence in you', s.board)}
      ${g.request ? `<p>📨 Budget request pending: asking ${$(g.request.ask)}${g.request.capital ? ` + ${$(g.request.capital)} capital` : ''} — about ${Math.round(g.request.p * 100)}% odds.</p>` : ''}
      ${g.nextApprop ? `<p>📅 Next fiscal year funding set at ${$(g.nextApprop)}.</p>` : ''}
      ${g.shutdown ? `<p class="bad">🚫 Government shutdown in progress. Funding owed: ${$(g.owed)}.</p>` : ''}
      ${g.feeProposal ? `<p>📜 Fee ordinance ($${g.feeProposal.price}) before Council — vote ${U.fmtDate(g.feeProposal.day)}.</p>` : ''}
      ${g.mayor !== 'neutral' ? `<p>Current leadership stance toward the zoo: <b>${g.mayor}</b>.</p>` : ''}
      ${g.type === 'city' || g.type === 'federal' ? `<p class="sub">Budget requests happen every ${g.type === 'city' ? 'February (decision in May, effective July 1)' : 'March (testimony) with appropriations due October 1'}.</p>` : ''}
      ${g.type === 'contract' ? `<p class="sub">Management agreement renewal due in ${g.contractYear}.</p>` : ''}
      ${g.type !== 'private' ? `<p>${btn('🤝 Lobby officials (tours & meetings, $15K)', 'lobby')}</p>` : ''}
      <h3>Your career</h3>${P.directorCard(s)}`;
  };

  P.directorCard = function (s) {
    const d = s.director, D = ZG.DIRECTOR;
    const car = D.careers.find((c) => c.id === d.career);
    return `<div class="card"><b>${esc(d.name)}</b>, age ${d.age}<br><small>${esc(D.levels.find((l) => l.id === d.level).name)} in ${esc(D.fields.find((f) => f.id === d.field).name)}, ${esc(d.school)}<br>Former ${esc(car.name)}</small>
      <p><span class="good">Strengths:</span> ${car.strengths.join(', ')} · ${esc(D.fields.find((f) => f.id === d.field).text)}</p><p><span class="bad">Weaknesses:</span> ${car.weaknesses.join(', ')}</p>
      <p class="sub">Annual reviews: ${s.reviews.map((r) => `${r.year}: <b>${r.grade}</b>`).join(' · ') || 'none yet'}</p></div>`;
  };

  // =====================================================================
  P.tab_news = function (s) {
    const news = s.news.slice(0, 60).map((n) => `<li class="${n.kind}"><small>${U.fmtDate(n.day)}</small> ${esc(n.text)}</li>`).join('');
    const log = s.log.slice(0, 30).map((l) => `<li><small>${U.fmtDate(l.day)}</small> ${l.icon} <b>${esc(l.title)}</b> → ${esc(l.choice)}${l.result ? `<br><small>${esc(l.result)}</small>` : ''}</li>`).join('');
    return `<h2>📰 News & Decisions</h2><h3>News feed</h3><ul class="news">${news}</ul><h3>Your decisions</h3><ul class="news">${log || '<li>None yet.</li>'}</ul>`;
  };

  // =====================================================================
  // ACTIONS
  // =====================================================================
  const A = (ZG.Actions = {});
  A.hire = (s, d) => ZG.Staff.hire(s, d.dept, +d.n);
  A.layoff = (s, d) => ZG.Staff.layoff(s, d.dept, +d.n);
  A.ssp = (s, d, el) => {
    let hab = null;
    const sel = document.querySelector(`[data-rechab="${d.rid}"]`);
    if (sel) hab = +sel.value;
    return ZG.AZA.respond(s, +d.rid, d.yes === '1', hab);
  };
  A.acquire = (s, d) => {
    const sel = document.querySelector(`[data-acq="${d.oid}"]`);
    if (!sel || !sel.value) return { ok: false, msg: 'Choose a habitat for the new arrivals first.' };
    return ZG.AZA.acquire(s, +d.oid, +sel.value);
  };
  A.contra = (s, d) => {
    const a = ZG.Animals.byId(s, +d.aid);
    if (!a) return;
    a.contra = !a.contra;
    return { ok: true, msg: `${a.name} is now ${a.contra ? 'on contraception' : 'allowed to breed'}.` };
  };
  A.moveOpen = (s, d) => {
    P.ui.moveFor = +d.aid;
    return null;
  };
  A.sendOut = (s, d) => {
    const a = ZG.Animals.byId(s, +d.aid);
    if (!a || !confirm(`Transfer ${a.name} to another zoo? This can't be undone.`)) return null;
    return ZG.AZA.sendOut(s, +d.aid);
  };
  A.repair = (s, d) => ZG.Infra.startRepair(s, d.sys, +d.to);
  A.renovate = (s, d) => ZG.Habitats.startRenovation(s, +d.hab);
  A.theming = (s, d) => ZG.Habitats.upgradeTheming(s, +d.hab);
  A.demolish = (s, d) => (confirm('Demolish this habitat?') ? ZG.Habitats.demolish(s, +d.hab) : null);
  A.climate = (s, d) => {
    const h = s.habitatsById[+d.hab];
    const Z = ZG.zoo(s);
    const cost = Math.round(1.2e6 * Z.costMult + h.area * 250);
    if (!ZG.Econ.canAfford(s, cost, true)) return { ok: false, msg: 'Not enough funds.' };
    ZG.Econ.spendCapital(s, 'construction', cost);
    h.climate = d.type;
    ZG.Sim.news(s, `${d.type === 'chilled' ? '❄️' : '🔥'} ${h.name} now has a ${d.type} indoor building (${$(cost)}).`, 'info');
    return { ok: true, msg: 'Climate control installed. Watch your utility bills.' };
  };
  A.select = (s, d) => {
    ZG.Render.state.selected = +d.plot;
    P.ui.tab = 'habitats';
    return null;
  };
  A.build = (s, d) => {
    const b = P.ui.build;
    if (!b || b.plot !== +d.plot) return { ok: false, msg: 'Fill in the plan first.' };
    const r = ZG.Habitats.startBuild(s, +d.plot, { name: b.name || 'New Habitat', biome: b.biome, tier: b.tier, climate: b.climate });
    if (r.ok) P.ui.build = null;
    return r;
  };
  A.cultivate = (s, d) => {
    const p = s.dev.prospects.find((x) => x.id === +d.pid);
    if (p) p.cultivating = !p.cultivating;
    return null;
  };
  A.ask = (s, d) => ZG.Dev.ask(s, +d.pid, d.lvl);
  A.campaign = (s, d) => ZG.Dev.startCampaign(s, +d.goal, d.label);
  A.gala = (s) => ZG.Dev.gala(s);
  A.grant = (s, d) => ZG.Dev.applyGrant(s, +d.idx);
  A.sponsorYes = (s, d) => ZG.Dev.acceptSponsor(s, +d.oid);
  A.sponsorNo = (s, d) => {
    s.sponsorOffers = s.sponsorOffers.filter((o) => o.id !== +d.oid);
    return { ok: true, msg: 'Declined.' };
  };
  A.sponsorDrop = (s, d) => {
    if (!confirm('End this sponsorship early? You lose the remaining payments.')) return null;
    ZG.Dev.dropSponsor(s, d.name);
    return { ok: true, msg: 'Sponsorship ended.' };
  };
  A.lobby = (s) => {
    if (s.cooldowns.lobby > s.day) return { ok: false, msg: `You lobbied recently — try again after ${U.fmtDate(s.cooldowns.lobby)}.` };
    s.cooldowns.lobby = s.day + 60;
    ZG.Econ.spend(s, 'events', 15000);
    const gain = 3 + Math.max(0, ZG.mod(s, 'politics')) / 4;
    s.gov.relationship = U.clamp(s.gov.relationship + gain, 0, 100);
    return { ok: true, msg: `Officials toured the zoo. Relationship +${Math.round(gain)}.` };
  };
  A.tab = (s, d) => {
    P.ui.tab = d.tab;
    return null;
  };

  A.setPolicy = function (s, key, value) {
    const Z = ZG.zoo(s);
    if (key === 'admission' && Z.priceNeedsVote) {
      if (value === s.policy.admission) return null;
      return ZG.Politics.proposeFee(s, value);
    }
    s.policy[key] = value;
    return null;
  };
})((globalThis.ZG = globalThis.ZG || {}));
