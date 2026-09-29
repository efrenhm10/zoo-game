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
      ${alerts.length ? `<h3>⚠️ Needs attention</h3><ul class="alerts">${alerts.map((a) => (a.plot != null ? `<li data-act="select" data-plot="${a.plot}">${esc(a.text)} →</li>` : `<li data-act="tab" data-tab="${a.tab}">${a.text}</li>`)).join('')}</ul>` : ''}
      <h3>🎯 Goals (by end of ${ZG.OBJ_DEADLINE})</h3><ul class="objs">${objs}</ul>
      <h3>Accreditation</h3>
      <p>Status: <b class="${s.acc.status === 'accredited' ? 'good' : 'bad'}">${s.acc.status.toUpperCase()}</b> · next inspection ${U.fmtMonth(s.acc.next)} (${Math.max(0, Math.round((s.acc.next - s.day) / 30))} months)</p>
      <p class="tip">💡 Press <b>🚶 Walk</b> (or <kbd>Tab</kbd>) to walk the grounds as your director, meet the animals and overhear guests. In manage mode: drag to pan, right-drag to rotate, scroll to zoom, <kbd>WASD</kbd>/<kbd>Q</kbd><kbd>E</kbd> to move the camera.</p>`;
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
    for (const h of s.habitats) {
      if (h.construction || h.renovation) continue;
      const dg = ZG.Diagnose.habitat(s, h);
      if (dg.level === 'bad') a.push({ tab: 'habitats', plot: h.plot, text: `${h.name}: ${dg.summary}` });
    }
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
        const dg = h.construction ? null : ZG.Diagnose.habitat(s, h);
        const chip = dg && dg.summary ? `<br><span class="dchip ${dg.level}">${dg.level === 'bad' ? '⛔' : '⚠️'} ${esc(dg.summary)}</span>` : '';
        return `<tr data-act="select" data-plot="${p.id}" class="click ${dg ? 'lvl-' + dg.level : ''}"><td>${esc(h.name)}${h.construction ? ' 🏗️' : h.renovation ? ' 🛠️' : ''}${chip}</td><td>${n} animals</td><td style="width:90px">${h.construction ? `${Math.round((1 - h.construction.days / h.construction.total) * 100)}% built` : bar(h.condition)}</td><td>${Math.round(ZG.Habitats.appeal(s, h))}★</td></tr>`;
      })
      .join('');
    return `<h2>🏞️ Habitats & Construction</h2>${top}<h3>All plots</h3><table class="list">${rows}</table>`;
  };

  P.inspector = function (s, p) {
    if (!p) return '';
    const Z = ZG.zoo(s);
    if (p.kind === 'vet') return P.hospital(s);
    if (p.kind === 'cafe') {
      const lm = s.ledger.months[s.ledger.months.length - 1];
      return `<div class="card"><h3>🍔 Food Court</h3><p>Food & retail revenue last month: <b>${lm ? $(lm.rev.concessions || 0) : '—'}</b></p><p>Guest services staffing: ${ratioTxt(ZG.Staff.ratio(s, 'guest'))} — more staff means shorter lines and higher spending per guest.</p></div>`;
    }
    const h = p.hab ? s.habitatsById[p.hab] : null;
    if (!h) return P.buildForm(s, p);
    const f = s._hf && s._hf[h.id];
    const animals = s.animals.filter((a) => a.hab === h.id);
    const spList = [...new Set(animals.map((a) => a.sp))];
    const lock = ZG.Habitats.renameLock(s, h);
    const title = P.ui.renaming === h.id && !lock
      ? `<div class="rename"><input id="rename-input" data-rename="${h.id}" value="${esc(h.name)}" maxlength="40" aria-label="New habitat name">${btn('Save', 'renameSave', { hab: h.id }, 'sm primary')}${btn('Cancel', 'renameCancel', {}, 'sm')}</div>`
      : `<div class="htitle"><h3>${esc(h.sponsor ? h.sponsor + ' ' + h.name : h.name)}</h3>${lock ? `<span class="sub" title="${esc(lock)}">🔒 Sponsor-named</span>` : btn('✏️ Rename', 'renameStart', { hab: h.id }, 'sm')}</div>`;
    let html = `<div class="card">${title}${h.donorName ? `<p class="sub">Named in honor of ${esc(h.donorName)}</p>` : ''}
      <p class="sub">${ZG.BIOMES[h.biome].name} · ${U.num(h.area)} m² · ${ZG.Habitats.TIERS[h.tier].name}${h.climate !== 'none' ? ' · ' + (h.climate === 'chilled' ? '❄️ chilled building' : '🔥 heated building') : ''}</p>`;
    if (h.construction) {
      html += `<p>🏗️ Under construction — ${Math.round((1 - h.construction.days / h.construction.total) * 100)}% complete, opens in ~${Math.ceil(h.construction.days / 30)} months.</p><div class="actions">${btn('📨 Reserve animals for opening day', 'reqFor', { hab: h.id }, 'primary')}</div></div>`;
      return html;
    }
    html += P.diagnosis(s, h);
    html += `<div class="grid2"><div>Condition ${bar(h.condition)}</div><div>Theming ${bar(h.theming)}</div></div>`;
    if (h.features && h.features.length) html += `<div class="feats">${h.features.map((f) => `<span class="feat" title="${esc(ZG.Design.FEATURES[f].line)}">${ZG.Design.FEATURES[f].icon} ${esc(ZG.Design.FEATURES[f].name)}</span>`).join('')}</div>`;
    if (h.brief) html += `<p class="sub">Design brief: “${esc(h.brief)}”</p>`;
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
        html += `<p class="sprow">${ZG.Portraits.img(id, 'portrait xs')} <b>${sp.name}</b> ×${x.n} ${U.sexCount(animals.filter((a) => a.sp === id))} — habitat welfare <b class="${cls(x.w)}">${Math.round(x.w)}</b>${notes.length ? ` <span class="warn">(${notes.join(', ')})</span>` : ''}</p>`;
      }
    }
    html += P.addAnimals(s, h);
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

  // "What's wrong and how to fix it" for a habitat.
  P.diagnosis = function (s, h) {
    const dg = ZG.Diagnose.habitat(s, h);
    if (!dg.issues.length) return `<div class="diag ok"><b>✅ No problems.</b> <span class="sub">The animals here are doing well.</span></div>`;
    const rows = dg.issues
      .map((i) => `<div class="issue ${i.sev}"><div class="itext"><b>${i.icon} ${esc(i.short)}</b> ${esc(i.text)}</div>${i.fixes.length ? `<div class="actions">${i.fixes.map((f) => btn(f.label, f.act, f.data, 'sm ' + (i.sev === 'bad' ? 'primary' : ''))).join('')}</div>` : ''}</div>`)
      .join('');
    return `<div class="diag ${dg.level}"><b>${dg.level === 'bad' ? '⛔ Needs fixing' : dg.level === 'warn' ? '⚠️ Could be better' : 'ℹ️ Status'}</b>${rows}</div>`;
  };

  // Animal hospital: patient chart, quarantine, expecting mothers.
  P.hospital = function (s) {
    const vr = ZG.Staff.ratio(s, 'vets');
    const sick = s.animals.filter((a) => a.sick).sort((a, b) => b.sick.sev - a.sick.sev || a.health - b.health);
    const PLAN = { aggressive: '🩺 Specialist care', standard: '💊 Standard treatment', monitor: '👀 Monitoring only' };
    const SEV = ['Mild', 'Moderate', 'Serious'];
    const patients = sick
      .map((a) => {
        const sp = spn(a.sp);
        const x = a.sick;
        const plan = x.plan || (x.treated ? 'standard' : 'monitor');
        const prog = x.total ? Math.round((1 - x.days / x.total) * 100) : null;
        const cost = ZG.Animals.treatCost(s, a);
        const outlook = a.health < 30 ? '<b class="bad">Critical</b>' : a.health < 55 ? '<b class="warn">Guarded</b>' : '<span class="good">Stable</span>';
        const acts = [];
        if (!x.treated) acts.push(btn(`Start treatment (${$(cost)})`, 'treat', { aid: a.id, lvl: 'standard' }, 'sm primary'));
        if (plan !== 'aggressive' && x.sev >= 2) acts.push(btn(`Bring in specialists (${$(Math.round(cost * 2.4))})`, 'treat', { aid: a.id, lvl: 'aggressive' }, 'sm'));
        return `<div class="patient sev${x.sev}"><div class="offer-top">${ZG.Portraits.img(a.sp, 'portrait sm')}<div><b>${esc(a.name)}</b> ${U.sexIcon(a.sex)} <small>${sp.name} · ${U.ageStr(a.age)}${a.star ? ' · ⭐' : ''}</small><br>
          <b>${esc(x.name)}</b> <span class="pill sev${x.sev}">${SEV[x.sev - 1]}</span></div></div>
          <div class="mini2"><span>Health</span>${bar(a.health)}${prog != null ? `<span>Recovery</span>${bar(prog)}` : ''}</div>
          <small>${PLAN[plan]} · outlook ${outlook} · ~${x.days} days to go · ${a.loc === 'quarantine' ? 'in quarantine' : `treated in ${esc(habName(s, a.hab))}`}${x.since != null ? ` · since ${U.fmtDate(x.since)}` : ''}</small>
          ${!x.treated && x.sev >= 3 ? '<p class="bad"><small>Untreated serious illness: high risk of death.</small></p>' : ''}
          ${acts.length ? `<div class="actions">${acts.join('')}</div>` : ''}</div>`;
      })
      .join('');
    const q = s.animals.filter((a) => a.loc === 'quarantine');
    const preg = s.animals.filter((a) => a.preg);
    const newborns = s.animals.filter((a) => a.age < 60);
    const vetCost = s.ledger.months.slice(-3).reduce((t, m) => t + (m.exp.vetcare || 0), 0);
    return `<div class="card"><h3>🏥 Animal Hospital & Quarantine</h3>
      <div class="kpis"><div><small>Patients</small><b class="${sick.some((a) => a.sick.sev >= 3) ? 'bad' : ''}">${sick.length}</b></div><div><small>In quarantine</small><b>${q.length}</b></div><div><small>Vet staffing</small><b>${Math.round(vr * 100)}%</b></div><div><small>Vet bills (3 mo)</small><b>${$(vetCost)}</b></div></div>
      <div class="grid2"><div>Building ${bar(s.infra.hospital.cond)}</div><div>Vet team ${bar(vr * 100)}</div></div>
      ${vr < 0.9 ? `<p class="warn">The vet team is stretched thin: illnesses last longer and hit harder. ${btn('Hire a veterinarian', 'hire', { dept: 'vets', n: 1 }, 'sm')}</p>` : ''}
      <h3>🩺 Patients</h3>${patients || '<p class="sub">No animals are sick right now. 🎉</p>'}
      <h3>🧳 Quarantine</h3>${q.length ? `<ul class="plain">${q.map((a) => `<li>${ZG.Portraits.img(a.sp, 'portrait xs')} ${esc(a.name)} the ${spn(a.sp).name}: ${a.qDays} days left, then to ${esc(habName(s, a.hab))}</li>`).join('')}</ul>` : '<p class="sub">Nobody in quarantine.</p>'}
      ${preg.length ? `<h3>🤰 Expecting</h3><ul class="plain">${preg.map((a) => `<li>${ZG.Portraits.img(a.sp, 'portrait xs')} ${esc(a.name)} the ${spn(a.sp).name}: due ${U.fmtDate(s.day + a.preg.days)}</li>`).join('')}</ul>` : ''}
      ${newborns.length ? `<h3>🍼 Newborn checks</h3><ul class="plain">${newborns.map((a) => `<li>${ZG.Portraits.img(a.sp, 'portrait xs')} ${esc(a.name)} the ${spn(a.sp).name}, ${a.age} days old. Health ${Math.round(a.health)}</li>`).join('')}</ul>` : ''}</div>`;
  };

  P.buildForm = function (s, p) {
    const Z = ZG.zoo(s);
    const b = P.ui.build && P.ui.build.plot === p.id ? P.ui.build : (P.ui.build = { plot: p.id, name: 'New Habitat', biome: 'savanna', tier: 'standard', climate: 'none' });
    const cost = ZG.Habitats.buildCost(s, p, b.tier, b.climate);
    const days = ZG.Habitats.TIERS[b.tier].days * (Z.governance === 'city' || Z.governance === 'federal' ? 1.25 : 1);
    const fits = Object.values(ZG.SPECIES).filter((sp) => sp.biomes.includes(b.biome) && sp.program !== 'Loan');
    const cap = (sp) => Math.floor(p.area / sp.space);
    const opt = (arr, cur) => arr.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('');
    const sd = p.savedDesign;
    const saved = sd
      ? `<div class="card saved"><h3>📁 Saved design: “${esc(sd.name)}”</h3><p class="sub">${esc(sd.title)} · ${ZG.BIOMES[sd.biome].name} · ${sd.features.map((f) => ZG.Design.FEATURES[f].icon).join(' ')}</p>
        <p>Cost <b>${$(sd.cost)}</b> · ~${Math.round(sd.days / 30)} months</p><div class="actions">${btn('🏗️ Build saved design', 'buildSaved', { plot: p.id }, 'primary')}${btn('Discard', 'discardSaved', { plot: p.id }, 'sm')}</div></div>`
      : '';
    return `<div class="card architect-cta"><h3>📐 Design a new habitat</h3>
      <p>Sit down with your exhibit architect, describe what you want in your own words, and get <b>three rendered concepts</b> with costs, timelines and welfare estimates.</p>
      <div class="actions">${btn('🧑‍💼 Meet with the architect', 'architect', { plot: p.id }, 'primary')}</div></div>
      ${saved}
      <details class="card"><summary><b>Quick build from a template</b> <span class="sub">(skip the architect)</span></summary>
      <label>Name <input data-build="name" value="${esc(b.name)}" maxlength="40"></label>
      <label>Biome <select data-build="biome">${opt(Object.entries(ZG.BIOMES).map(([k, v]) => [k, v.name]), b.biome)}</select></label>
      <label>Design tier <select data-build="tier">${opt(Object.entries(ZG.Habitats.TIERS).map(([k, v]) => [k, `${v.name} (${$(v.perM2 * Z.costMult)}/m², theming ${v.theming})`]), b.tier)}</select></label>
      <label>Climate control <select data-build="climate">${opt([['none', 'None (outdoor)'], ['heated', 'Heated building'], ['chilled', 'Chilled building']], b.climate)}</select></label>
      <p><b>Cost: ${$(cost)}</b> · build time ~${Math.round(days / 30)} months${Z.governance === 'city' || Z.governance === 'federal' ? ' (public procurement adds time)' : ''}</p>
      <p class="sub">Funds available: capital ${$(s.capital)} + cash ${$(s.cash)} + credit line ${$(ZG.Econ.creditLimit(s))}</p>
      <p class="sub">Suitable species (max group by space): ${fits.map((sp) => `${sp.emoji} ${sp.name} (${cap(sp)})`).join(', ')}</p>
      <div class="actions">${btn('🏗️ Break ground', 'build', { plot: p.id })}${!s.dev.campaign ? btn(`Launch capital campaign for it (${$(cost)})`, 'campaign', { goal: cost, label: b.name }) : ''}</div></details>`;
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
      return `<div class="acard2">
        <div class="round">${ZG.Portraits.img(a.sp, 'portrait md')}<span class="banner">${esc(a.name)}</span></div>
        <div class="ainfo">${U.sexTag(a.sex)} <small>${sp.name} · ${U.ageStr(a.age)} · GV ${a.gv} ${flags}</small>
          <div class="mini2"><span>Welfare</span>${bar(a.welfare)}<span>Health</span>${bar(a.health)}</div>
          <div class="acts">${breedable ? btn(a.contra ? '💊 Contracepted' : '💞 Breeding', 'contra', { aid: a.id }, 'sm ' + (a.contra ? '' : 'on')) : ''}
          ${moving ? `<select data-move="${a.id}"><option value="">Move to…</option>${habs.filter((h) => h.id !== a.hab).map((h) => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select>` : btn('Move', 'moveOpen', { aid: a.id }, 'sm')}
          ${sp.program !== 'Loan' ? btn('Transfer', 'sendOut', { aid: a.id }, 'sm') : ''}</div></div></div>`;
    };
    let html = `<h2>🦒 Collection (${s.animals.length} animals)</h2><p class="sub">Plus a supporting collection of birds, reptiles & invertebrates. 💊 = on contraception; 💞 = allowed to breed. Follow SSP recommendations to avoid unplanned births.</p>${P.requestCard(s)}`;
    if (byHab.q) html += `<h3>🏥 Quarantine</h3><div class="agrid">${byHab.q.map(row).join('')}</div>`;
    for (const h of habs) {
      const list = byHab[h.id];
      const bySp = {};
      for (const a of list || []) (bySp[a.sp] = bySp[a.sp] || []).push(a);
      const mix = Object.entries(bySp).map(([id, l]) => `${spn(id).name} ${U.sexCount(l)}`).join(' · ');
      html += `<h3 data-act="select" data-plot="${h.plot}" class="click">${esc(h.name)} <small>(${list ? list.length : 0})</small></h3>${mix ? `<p class="sub groupmix">${mix}</p>` : ''}`;
      html += list ? `<div class="agrid">${list.map(row).join('')}</div>` : '<p class="sub">Empty.</p>';
    }
    html += P.market(s);
    return html;
  };

  // "Add animals" section inside a habitat: room left, quick requests, offers available now, expansion.
  P.addAnimals = function (s, h) {
    const RQ = ZG.Requests;
    const res = s.animals.filter((a) => a.hab === h.id);
    const spIds = [...new Set(res.map((a) => a.sp))];
    const used = res.reduce((t, a) => t + spn(a.sp).space, 0);
    const mixOk = (id) => spIds.every((x) => x === id || (spn(x).mix && spn(x).mix === spn(id).mix));
    const quick = (id, m, f) => {
      const e = RQ.estimate(s, id, m, f, h.id);
      const label = m && f ? `+${m + f} (${m}♂ ${f}♀)` : `+${m + f} ${m ? '♂' : '♀'}`;
      return e.ok ? btn(`${label} <small>${Math.round(e.odds * 100)}%</small>`, 'reqQuick', { hab: h.id, sp: id, m, f }, 'sm') : `<button class="btn sm" disabled title="${esc(e.block)}">${label}</button>`;
    };
    const rows = spIds
      .map((id) => {
        const sp = spn(id);
        const n = res.filter((a) => a.sp === id).length;
        const room = RQ.room(s, h, id);
        return `<div class="addrow">${ZG.Portraits.img(id, 'portrait xs')}<div class="addinfo"><b>${sp.name}</b> ${U.sexCount(res.filter((a) => a.sp === id))} <small>×${n} now · ${room ? `room for <b>${room}</b> more` : '<span class="bad">no room</span>'} · natural group ${sp.group[0]}–${sp.group[1]}</small></div>
          <div class="actions">${sp.program === 'Loan' ? '<small class="sub">Loan animals only</small>' : quick(id, 0, 1) + quick(id, 1, 0) + (room >= 2 ? quick(id, 0, 2) : '') + (sp.group[0] >= 6 && room >= 6 ? quick(id, 2, 4) : '')}</div></div>`;
      })
      .join('');
    const pend = s.ssp.requests.filter((r) => r.hab === h.id && (r.status === 'pending' || r.status === 'waitlist'));
    const pendHtml = pend.length ? `<p class="sub">📨 Waiting on the AZA: ${pend.map((r) => `${r.males}♂ ${r.females}♀ ${spn(r.sp).name} (${r.status === 'waitlist' ? 'waitlisted' : 'decision'} ~${U.fmtDate(r.decide)})`).join(', ')}</p>` : '';
    const offers = s.market
      .filter((o) => spn(o.sp).biomes.includes(h.biome) && mixOk(o.sp) && RQ.room(s, h, o.sp) >= o.count)
      .map((o) => `<div class="addrow">${ZG.Portraits.img(o.sp, 'portrait xs')}<div class="addinfo"><b>${o.count > 1 ? o.count + '× ' : ''}${spn(o.sp).name}</b> <small>${o.count === 1 ? (o.sex === 'M' ? '♂ · ' : '♀ · ') : ''}${U.ageStr(o.age)} · from ${esc(o.from)} · offer ends ${U.fmtDate(o.expires)}</small></div>
        <div class="actions">${btn(`Accept now (${$(o.cost)})`, 'acquireInto', { oid: o.id, hab: h.id }, 'sm primary')}</div></div>`)
      .join('');
    const exp = h.expansions || 0;
    const expand = h.expanding
      ? `<p>📐 Expansion underway: about ${Math.ceil(h.expanding.days / 30)} month(s) left. The habitat grows to ${U.num(Math.round(h.area * 1.3))} m².</p>`
      : exp < ZG.Habitats.MAX_EXPANSIONS
        ? `<div class="actions">${btn(`📐 Expand habitat +30% (${$(ZG.Habitats.expandCost(s, h))}, ~3 months)`, 'expand', { hab: h.id })}<small class="sub">Adds an adjoining yard and a bigger night house. ${exp ? 'One more expansion possible.' : 'Up to two expansions.'}</small></div>`
        : '<p class="sub">📐 Fully expanded: the site has no more room.</p>';
    return `<div class="card addcard"><h3 style="margin-top:0">➕ Add animals</h3>
      <div class="rel"><span>Space used</span>${bar(Math.min(100, (used / h.area) * 100), 100, used > h.area ? 'bad' : used > h.area * 0.85 ? 'warn' : 'good')}<b>${U.num(Math.round(used))} / ${U.num(h.area)} m²</b></div>
      ${rows || '<p class="sub">No animals here yet.</p>'}
      ${spIds.length ? '<p class="sub">Quick requests go to the AZA/SSP coordinator. The % is the chance of approval, and the decision takes 1–3 months.</p>' : ''}
      ${pendHtml}
      ${offers ? `<h4>Available right now</h4>${offers}` : ''}
      <div class="actions">${btn(spIds.length ? '➕ Add a different species…' : '📨 Choose species to request…', 'reqFor', { hab: h.id }, spIds.length ? '' : 'primary')}</div>
      ${expand}</div>`;
  };

  // Ask the AZA / SSP coordinators for specific animals.
  P.requestCard = function (s) {
    const RQ = ZG.Requests;
    const habs = s.habitats.filter((h) => !h.renovation);
    if (!habs.length) return '';
    const st = (P.ui.req = P.ui.req || {});
    if (!s.habitatsById[st.hab]) st.hab = habs[0].id;
    const h = s.habitatsById[st.hab];
    const here = [...new Set(s.animals.filter((a) => a.hab === h.id).map((a) => a.sp))];
    const holds = new Set(s.ssp.recs.filter((r) => r.type === 'hold' && (r.status === 'open' || r.status === 'accepted')).map((r) => r.sp));
    const held = new Set(s.animals.map((a) => a.sp));
    const fits = Object.values(ZG.SPECIES)
      .filter((sp) => sp.biomes.includes(h.biome) && sp.program !== 'Loan')
      .sort((a, b) => (here.includes(b.id) - here.includes(a.id)) || (holds.has(b.id) - holds.has(a.id)) || a.name.localeCompare(b.name));
    if (!fits.some((sp) => sp.id === st.sp)) st.sp = fits.length ? fits[0].id : null;
    if (st.m == null) st.m = 0;
    if (st.f == null) st.f = 1;
    const opt = (v, label, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
    const habSel = habs.map((x) => opt(x.id, `${x.construction ? '🏗️ ' : ''}${esc(x.name)} (${ZG.BIOMES[x.biome].name})`, st.hab)).join('');
    const spSel = fits.map((sp) => opt(sp.id, `${sp.name}${here.includes(sp.id) ? ' · here now' : held.has(sp.id) ? ' · in collection' : ''}${holds.has(sp.id) ? ' · SSP wants space' : ''}${sp.program === 'SSP' ? ' · SSP' : ''}`, st.sp)).join('');
    const num = (k) => `<select data-req="${k}">${[0, 1, 2, 3, 4, 5, 6, 8, 10].map((n) => opt(n, n, st[k])).join('')}</select>`;
    let est = '';
    if (st.sp) {
      const e = RQ.estimate(s, st.sp, st.m, st.f, st.hab);
      est = e.ok
        ? `<p>${h ? `${esc(h.name)} now has <b>${e.sexNow}</b> ${spn(st.sp).name}s. After this request: <b>${e.sexAfter}</b>.<br>` : ''}Chance of approval: <b class="${e.odds >= 0.6 ? 'good' : e.odds >= 0.35 ? 'warn' : 'bad'}">${Math.round(e.odds * 100)}%</b> · answer in ${e.wait} · transport about <b>${$(e.cost)}</b> when they arrive (no purchase price: it's a breeding loan)</p>${e.notes.length ? `<ul class="bnotes">${e.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}<div class="actions">${btn('📨 Send request', 'reqSend', {}, 'primary')}</div>`
        : `<p class="bad">⛔ ${esc(e.block)}</p>`;
    }
    const open = s.ssp.requests
      .slice(0, 8)
      .map((r) => {
        const sp = spn(r.sp);
        const label = { pending: `⏳ decision ~${U.fmtDate(r.decide)}`, waitlist: `🕒 waitlisted, ${U.fmtDate(r.decide)}`, approved: '✅ approved', partial: '🟡 partly approved', declined: '❌ declined', withdrawn: 'withdrawn' }[r.status];
        return `<li>${ZG.Portraits.img(r.sp, 'portrait xs')} ${r.males}♂ ${r.females}♀ ${sp.name} → ${esc(habName(s, r.hab))}: <b>${label}</b>${r.note && r.status !== 'pending' ? ` <small class="sub">${esc(r.note)}</small>` : ''} ${r.status === 'pending' || r.status === 'waitlist' ? btn('Withdraw', 'reqCancel', { id: r.id }, 'sm') : ''}</li>`;
      })
      .join('');
    return `<div class="card reqcard" id="req-card"><h3 style="margin-top:0">📨 Request animals from the AZA</h3>
      <p class="sub">Ask the Species Survival Plan coordinators for animals for an existing habitat, or reserve them for one still under construction. They decide based on space, habitat standards, your AZA standing and whether animals are available.</p>
      <div class="reqform"><label>For habitat <select data-req="hab">${habSel}</select></label>
      <label>Species <select data-req="sp">${spSel || '<option>No species suit this habitat</option>'}</select></label>
      <label>Males ${num('m')}</label><label>Females ${num('f')}</label></div>
      ${est}${open ? `<h4>Your requests</h4><ul class="plain reqs">${open}</ul>` : ''}</div>`;
  };

  P.market = function (s) {
    const habs = s.habitats.filter((h) => !h.construction);
    const rows = s.market
      .map((o) => {
        const sp = spn(o.sp);
        const good = habs.filter((h) => sp.biomes.includes(h.biome));
        const opts = habs.map((h) => `<option value="${h.id}" ${good.includes(h) && s.animals.some((a) => a.hab === h.id && a.sp === o.sp) ? 'selected' : ''}>${sp.biomes.includes(h.biome) ? '✓ ' : '✗ '}${esc(h.name)}</option>`).join('');
        return `<div class="card offer"><div class="offer-top">${ZG.Portraits.img(o.sp, 'portrait sm')}<div><b>${o.count > 1 ? o.count + '× ' : ''}${sp.name}</b> ${o.count === 1 ? U.sexTag(o.sex) + ' ' : ''}<small>${U.ageStr(o.age)} · GV ${o.gv} · ${sp.iucn}${sp.program === 'SSP' ? ' · SSP' : ''}</small><br><small>From ${esc(o.from)} · ${o.kind === 'rescue' ? 'rescue' : 'AZA loan (no purchase price)'} · expires ${U.fmtDate(o.expires)}</small></div></div>
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
        return `<div class="card rec ${r.status}"><div class="offer-top">${ZG.Portraits.img(r.sp, 'portrait sm')}<div><b>${typeName}</b> · ${sp.name} <small>(${sp.iucn})</small> <span class="pill">${r.status}</span></div></div><p>${esc(r.text)}</p><small>${esc(r.partner)} · respond by ${U.fmtDate(r.deadline)}</small><div class="actions">${acts}</div></div>`;
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
      <div class="kpis"><div><small>Operating cash</small><b class="${s.cash < 0 ? 'bad' : ''}">${$(s.cash)}</b></div><div><small>Capital fund (restricted)</small><b>${$(s.capital)}</b></div><div><small>Credit line</small><b>${$(ZG.Econ.creditLimit(s))}</b></div></div>
      <div id="budget-proj">${P.budgetProjection(s)}</div>
      <p class="sub">Drag a slider to see the effect on next year's budget. Changes take effect when you let go.</p>
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
  // The 12-month budget plan. `over` holds slider values being dragged but not yet committed.
  P.budgetProjection = function (s, over) {
    const Z = ZG.zoo(s);
    const base = ZG.Econ.project(s);
    const pr = over ? ZG.Econ.project(s, over) : base;
    const p = Object.assign({}, s.policy, over || {});
    const d = pr.net - base.net;
    const lines = (obj, bobj, names) =>
      Object.entries(obj)
        .filter(([, v]) => Math.abs(v) >= 500)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => {
          const ch = v - (bobj[k] || 0);
          return `<tr class="${Math.abs(ch) >= 1000 ? 'changed' : ''}"><td>${names[k] || k}</td><td>${$(v)}${Math.abs(ch) >= 1000 ? ` <small class="${(names === ZG.Econ.EXP ? -ch : ch) > 0 ? 'good' : 'bad'}">${ch > 0 ? '+' : '−'}${$(Math.abs(ch))}</small>` : ''}</td></tr>`;
        })
        .join('');
    // Plain-language consequences of the settings, relative to what this zoo needs.
    const notes = [];
    const ref = Z.refs;
    const rel = (k) => p[k] / Math.max(1, ref[k]);
    const gd = pr.guests - base.guests;
    if (Math.abs(gd) >= 500) notes.push(`${gd > 0 ? '📈' : '📉'} About <b>${U.num(Math.abs(Math.round(gd)))} ${gd > 0 ? 'more' : 'fewer'} visitors</b> a year.`);
    if (rel('marketing') < 0.7) notes.push('📣 Marketing is well below normal. Fewer people will hear about the zoo, and new members will slow.');
    if (rel('maintenance') < 0.8) {
      const eff = ZG.Infra.maintEffect(Object.assign({}, s, { policy: p }));
      notes.push(`🔧 Maintenance is underfunded (upkeep effectiveness ${Math.round(eff * 100)}%). Pipes, fences and habitats will wear out faster, and breakdowns cost far more than upkeep.`);
    }
    if (rel('enrichment') < 0.8) notes.push('🧩 Enrichment is below what the collection needs. Keeper care and animal welfare will slip.');
    if (rel('conservation') < 0.6) notes.push('🌍 Field conservation is low. AZA standing, reputation and conservation-minded donors will notice.');
    if (rel('maintenance') > 1.3) notes.push('🔧 Generous maintenance slows decay and the deferred backlog.');
    if (rel('marketing') > 1.5) notes.push('📣 Heavy marketing has diminishing returns. Each extra dollar brings fewer visitors.');
    if (Z.priceNeedsVote && p.admission !== s.policy.admission) notes.push('🏛️ Admission changes need a City Council vote before they take effect.');
    const lm = s.ledger.months.slice(-12);
    const actual = lm.length ? lm.reduce((a, m) => a + m.net, 0) * (12 / lm.length) : null;
    return `<div class="card budget"><h3 style="margin-top:0">📊 Budget plan: next 12 months</h3>
      <div class="kpis"><div><small>Projected revenue</small><b>${$(pr.revTotal)}</b></div><div><small>Projected spending</small><b>${$(pr.expTotal)}</b></div>
      <div><small>Projected ${pr.net >= 0 ? 'surplus' : 'deficit'}</small><b class="${pr.net >= 0 ? 'good' : 'bad'}">${$(pr.net)}</b></div>
      ${over && Math.abs(d) >= 1000 ? `<div class="delta"><small>This change</small><b class="${d >= 0 ? 'good' : 'bad'}">${d >= 0 ? '+' : '−'}${$(Math.abs(d))}/yr</b></div>` : ''}</div>
      ${notes.length ? `<ul class="bnotes">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}
      <details ${over ? 'open' : ''}><summary>Line by line</summary><div class="grid2"><table class="list fin"><tr><th>Revenue</th><th></th></tr>${lines(pr.rev, base.rev, ZG.Econ.REV)}</table>
      <table class="list fin"><tr><th>Spending</th><th></th></tr>${lines(pr.exp, base.exp, ZG.Econ.EXP)}</table></div></details>
      ${actual != null ? `<p class="sub">For comparison, the last ${lm.length} month${lm.length > 1 ? 's' : ''} actually ran at ${$(actual)}/yr. Weather, events and emergencies move the real number around.</p>` : ''}</div>`;
  };

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
    if (!a || !ZG.App.confirm('send' + a.id, `Transfer ${a.name} to another zoo? This can't be undone.`)) return null;
    return ZG.AZA.sendOut(s, +d.aid);
  };
  A.repair = (s, d) => ZG.Infra.startRepair(s, d.sys, +d.to);
  A.renovate = (s, d) => ZG.Habitats.startRenovation(s, +d.hab);
  A.theming = (s, d) => ZG.Habitats.upgradeTheming(s, +d.hab);
  A.demolish = (s, d) => (ZG.App.confirm('demolish' + d.hab, 'Demolish this habitat?') ? ZG.Habitats.demolish(s, +d.hab) : null);
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
  A.architect = (s, d) => {
    ZG.Architect.open(s, +d.plot);
    return null;
  };
  A.buildSaved = (s, d) => {
    const p = s.plots[+d.plot];
    const o = p.savedDesign;
    if (!o) return null;
    const r = ZG.Habitats.startBuild(s, p.id, { name: o.name, biome: o.biome, tier: o.tier, climate: o.climate, features: o.features, brief: o.brief, species: o.species, cost: o.cost, days: o.days });
    return r;
  };
  A.discardSaved = (s, d) => {
    s.plots[+d.plot].savedDesign = null;
    return { ok: true, msg: 'Design discarded.' };
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
    if (!ZG.App.confirm('drop' + d.name, 'End this sponsorship early? You lose the remaining payments.')) return null;
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
