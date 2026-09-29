// Panels for people and business: top donors, the partner organization, officials
// (city, state, Congress, board), media appearances, special events and merchandise.
(function (ZG) {
  const U = ZG.U;
  const P = ZG.Panels;
  const A = ZG.Actions;
  const $ = U.money;
  const esc = U.esc;
  const { bar, meter, btn } = P.helpers;
  const dis = (label, why) => `<button class="btn sm" disabled title="${esc(why)}">${label}</button>`;
  const since = (s, day) => {
    const d = s.day - day;
    if (d > 3000) return 'never';
    if (d < 1) return 'today';
    if (d < 45) return `${d} days ago`;
    return `${Math.round(d / 30)} months ago`;
  };
  const face = (name, hue) => {
    const ini = name.replace(/^The /, '').split(/\s+/).filter((w) => /^[A-ZĀĒĪŌŪʻ]/.test(w)).slice(0, 2).map((w) => w.replace('ʻ', '')[0]).join('');
    return `<span class="pface" style="--h:${hue}">${esc(ini)}</span>`;
  };
  const hueOf = (str) => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  P.ui.sub = P.ui.sub || {};
  const subtabs = (tab, list) => {
    const cur = P.ui.sub[tab] || list[0][0];
    return { cur, html: `<div class="subtabs">${list.map(([id, label]) => `<button class="stab ${id === cur ? 'on' : ''}" data-act="sub" data-tab="${tab}" data-sub="${id}">${label}</button>`).join('')}</div>` };
  };

  // Insert new toolbar tabs.
  const insertAfter = (id, tab) => {
    const i = P.TABS.findIndex((t) => t.id === id);
    P.TABS.splice(i + 1, 0, tab);
  };
  insertAfter('fundraising', { id: 'media', icon: '📺', name: 'Media' });
  insertAfter('finance', { id: 'business', icon: '🎪', name: 'Events & Shop' });

  // =====================================================================
  // CONSERVATION (SSP plans, field partners, accreditation)
  // =====================================================================
  P.tab_conservation = function (s) {
    const st = subtabs('conservation', [['ssp', '🧬 SSP plans'], ['field', '🌍 Field partners'], ['accred', '🏅 Accreditation']]);
    const body = st.cur === 'field' ? P.fieldView(s) : st.cur === 'accred' ? P.accredView(s) : P.sspView(s);
    return `<h2>🧬 Conservation</h2>${st.html}${body}`;
  };

  P.sspView = function (s) {
    const spn = (id) => ZG.SPECIES[id];
    const recs = s.ssp.recs.slice().sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.created - a.created);
    const typeName = { breed: '💞 Breed', nobreed: '🚫 Do not breed', send: '📤 Send out', receive: '📥 Receive', hold: '🏠 Space request' };
    const recHtml = recs
      .map((r) => {
        const sp = spn(r.sp);
        let acts = '';
        if (r.status === 'open') {
          if (r.type === 'receive') {
            const habs = s.habitats.filter((h) => !h.construction && sp.biomes.includes(h.biome));
            acts = `<select data-rechab="${r.id}">${habs.map((h) => `<option value="${h.id}" ${s.animals.some((a) => a.hab === h.id && a.sp === r.sp) ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>`;
            acts += habs.length ? btn(`Accept (${$(ZG.AZA.transportCost(s, r.sp))})`, 'ssp', { rid: r.id, yes: 1 }, 'sm primary') : dis('Accept', 'Build a suitable habitat first');
          } else if (r.type === 'hold') acts = btn('Commit space', 'ssp', { rid: r.id, yes: 1 }, 'sm primary') + btn('📨 Request them', 'reqForSp', { sp: r.sp }, 'sm');
          else acts = btn(r.type === 'nobreed' ? 'Acknowledge' : 'Accept', 'ssp', { rid: r.id, yes: 1 }, 'sm primary');
          acts += btn('Decline', 'ssp', { rid: r.id, yes: 0 }, 'sm');
        }
        const who = (r.aids || []).map((id) => ZG.Animals.byId(s, id)).filter(Boolean).map((a) => `${esc(a.name)} ${U.sexIcon(a.sex)}`).join(' × ');
        return `<div class="card rec ${r.status}"><div class="offer-top">${ZG.Portraits.img(r.sp, 'portrait sm')}<div><b>${typeName[r.type]}</b> · ${sp.name} <small>(${sp.iucn})</small> <span class="pill">${r.status}</span>${who ? `<br><small>${who}</small>` : ''}</div></div><p>${esc(r.text)}</p><small>${esc(r.partner)} · respond by ${U.fmtDate(r.deadline)}</small><div class="actions">${acts}</div></div>`;
      })
      .join('');
    const goal = ZG.zoo(s).objectives.find((o) => o.id.startsWith('ssp'));
    const open = recs.filter((r) => r.status === 'open').length;
    return `<div class="card"><p>Each <b>Species Survival Plan</b> manages one species as a single North American population. Every February the coordinators publish <b>Breeding & Transfer Plans</b>: which of your animals should breed, which should move to another zoo, and which species need space.</p>
      <p class="sub">💞 Accepting a breed recommendation takes that pair off contraception. Births from recommended pairs give the biggest AZA boost. Other healthy births of SSP species still count toward your goals, but births under a do-not-breed order don't.</p>
      <div class="kpis"><div><small>Open recommendations</small><b class="${open ? 'warn' : ''}">${open}</b></div><div><small>SSP births (career)</small><b>${s.stats.sspBirths}</b></div>${goal ? `<div><small>Goal</small><b>${Math.min(s.stats.sspBirths, goal.prog(s)[1])} / ${goal.prog(s)[1]}</b></div>` : ''}</div>
      ${meter('AZA standing', s.aza, 'How the AZA and SSP coordinators view your zoo')}</div>
      <h3>Recommendations</h3>${recHtml || '<p class="sub">No recommendations yet. New plans are published every February.</p>'}`;
  };

  P.accredView = function (s) {
    const sc = ZG.AZA.inspectionScore(s);
    const parts = Object.entries(sc.parts).map(([k, v]) => `<tr><td>${k}</td><td style="width:110px">${bar(v)}</td><td>${Math.round(v)}</td></tr>`).join('');
    return `<div class="card"><h3 style="margin-top:0">Accreditation: <span class="${s.acc.status === 'accredited' ? 'good' : 'bad'}">${s.acc.status.toUpperCase()}</span></h3>
      <p>Next inspection: <b>${U.fmtDate(s.acc.next)}</b>. Estimated score today: <b class="${sc.total >= 68 ? 'good' : sc.total >= 56 ? 'warn' : 'bad'}">${Math.round(sc.total)}</b> (need 68)</p>
      <table class="list">${parts}</table></div>${meter('AZA standing', s.aza)}`;
  };

  P.fieldView = function (s) {
    const F = ZG.Field, fs = s.field;
    const each = F.funding(s);
    const cards = fs.partners
      .map((p) => {
        const Pd = F.PARTNERS[p.id];
        const held = F.held(s, p.id);
        const pr = p.project;
        const projHtml = pr
          ? `<p>${F.PROJECTS[pr.type].icon} <b>${F.PROJECTS[pr.type].name}</b>${pr.name ? ` (${esc(pr.name)})` : ''}: done ${U.fmtDate(pr.end)}</p>${bar(((s.day - pr.start) / Math.max(1, pr.end - pr.start)) * 100)}`
          : `<div class="actions">${Object.entries(F.PROJECTS)
              .filter(([k]) => k !== 'release' || (Pd.release || []).length)
              .map(([k, T]) => btn(`${T.icon} ${T.name} (${$(Math.round(T.cost(s) / 1000) * 1000)})`, 'fieldProj', { id: p.id, type: k }, 'sm'))
              .join('')}</div>`;
        const fund = each / F.target(s);
        return `<div class="card partner"><div class="donor-top"><span class="picon">${Pd.icon}</span><div class="dmeta"><b>${esc(Pd.name)}</b><small>${esc(Pd.region)} · ${esc(Pd.work)}</small></div></div>
          <div class="rel"><span>Funding</span>${bar(Math.min(100, fund * 100))}<b class="${fund >= 1 ? 'good' : fund >= 0.5 ? 'warn' : 'bad'}">${$(each)}/yr</b></div>
          <div class="rel"><span>Next field report</span>${bar(((p.impact % 12) / 12) * 100)}<b>${p.milestones} so far</b></div>
          ${held.length ? `<p class="sub">⭐ Signature program: your ${held.map((x) => `${ZG.Portraits.img(x, 'portrait xs')} ${ZG.SPECIES[x].name}`).join(', ')} tell this story to guests (+25% impact).</p>` : '<p class="sub">You hold none of their species. Programs with a species guests can see have more impact.</p>'}
          ${projHtml}<div class="actions">${btn('End partnership', 'fieldLeave', { id: p.id }, 'sm danger')}</div></div>`;
      })
      .join('');
    const avail = F.suggest(s)
      .filter((id) => !fs.partners.some((p) => p.id === id))
      .map((id) => {
        const Pd = F.PARTNERS[id];
        const held = F.held(s, id);
        return `<div class="card"><div class="row"><b>${Pd.icon} ${esc(Pd.name)}</b><span class="sub">${esc(Pd.region)}</span></div><small>${esc(Pd.work)}.</small>
          <p class="sub">${held.length ? `⭐ Matches your ${held.map((x) => ZG.SPECIES[x].name).join(', ')}` : 'No matching species in your collection'}${(Pd.release || []).length ? ` · 🕊️ can release ${(Pd.release || []).map((x) => ZG.SPECIES[x].name).join(', ')}` : ''}</p>
          <div class="actions">${fs.partners.length < F.MAX ? btn('🤝 Partner with them', 'fieldJoin', { id }, 'sm primary') : dis('Partner with them', `You already have ${F.MAX} partners`)}</div></div>`;
      })
      .join('');
    const rep = fs.reports.slice(0, 8).map((r) => `<li><small>${U.fmtDate(r.day)}</small> ${F.PARTNERS[r.id] ? F.PARTNERS[r.id].icon : '🌍'} ${esc(r.text)}</li>`).join('');
    return `<div class="card"><p>Zoos fund and work with conservation nonprofits in the wild. Choose up to <b>${F.MAX} partners</b>; your field-conservation budget is shared among them. Run projects together, and field reports come back as your support makes a difference.</p>
      <div class="kpis"><div><small>Partners</small><b>${fs.partners.length} / ${F.MAX}</b></div><div><small>Rangers funded</small><b>${fs.stats.rangers}</b></div><div><small>Animals released</small><b>${fs.stats.released}</b></div><div><small>Round-up this year</small><b>${$(fs.roundUpYtd)}</b></div></div>
      ${P.slider(s, 'conservation', 'Field-conservation budget / yr', 0, ZG.zoo(s).refs.conservation * 3)}
      <p class="sub">Each partner is fully funded at about ${$(F.target(s))}/yr.</p>
      <div class="actions">${btn(fs.roundUp ? '✅ “Round Up for Wildlife” at checkout: on' : '⬜ “Round Up for Wildlife” at checkout: off', 'fieldRound', {}, 'sm ' + (fs.roundUp ? 'on' : ''))}<span class="sub">Guests round up their purchase and the change goes to your partners.</span></div></div>
      ${cards ? `<h3>Your partners</h3>${cards}` : ''}
      ${rep ? `<h3>Field reports</h3><ul class="news">${rep}</ul>` : ''}
      <h3>Potential partners</h3>${avail}`;
  };

  // =====================================================================
  // GROW THE ZOO (strategic plan, land, second site)
  // =====================================================================
  const habitatsList = P.tab_habitats;
  P.tab_habitats = function (s) {
    const st = subtabs('habitats', [['list', '🏞️ Habitats'], ['grow', '🗺️ Grow the zoo']]);
    if (st.cur === 'grow') return `<h2>🗺️ Grow the Zoo</h2>${st.html}${P.growView(s)}`;
    return habitatsList(s).replace('</h2>', '</h2>' + st.html);
  };

  P.growView = function (s) {
    const G = ZG.Growth;
    const p = s.plan;
    const pr = (k) => G.PRIORITIES[k];
    let plan = '';
    if (p.status === 'none' || p.status === 'rejected') {
      const pick = (P.ui.planPick = P.ui.planPick || []);
      const chips = Object.entries(G.PRIORITIES)
        .filter(([k]) => k !== 'second' || G.SECOND[s.zooId])
        .map(([k, v]) => `<button class="chip ${pick.includes(k) ? 'on' : ''}" data-act="planPick" data-k="${k}" title="${esc(v.goal)}">${v.icon} ${esc(v.name)}</button>`)
        .join('');
      const cost = p.status === 'rejected' ? Math.round(G.planCost(s) * 0.3) : G.planCost(s);
      plan = `<div class="card plan"><h3 style="margin-top:0">📜 Strategic master plan</h3>
        <p>Before a zoo can buy land or open a new campus, it needs an adopted master plan. Planners draft it (about ${p.status === 'rejected' ? 2 : 5} months), the public comments on it, and then <b>${G.voteBody(s)}</b> votes.</p>
        ${p.status === 'rejected' ? '<p class="bad">Your last plan was voted down. A revision costs 30% as much.</p>' : ''}
        <p><b>Pick three priorities</b> (${pick.length}/3):</p><div class="swatches chips">${chips}</div>
        ${pick.length ? `<ul class="bnotes">${pick.map((k) => `<li>${pr(k).icon} <b>${pr(k).name}</b>: goal “${esc(pr(k).goal)}”${pr(k).unlock ? ` · <b>${pr(k).unlock}</b>` : ''}</li>`).join('')}</ul>` : ''}
        <p class="sub">Growing the footprint or adding a second site makes the vote harder. Fixing what you have and financial sustainability make it easier.</p>
        <div class="actions">${pick.length === 3 ? btn(`📜 Hire the planners (${$(cost)})`, 'planCommission', {}, 'primary') : dis('Hire the planners', 'Pick three priorities first')}</div></div>`;
    } else if (p.status === 'drafting') {
      const pct = ((s.day - p.started) / Math.max(1, p.ready - p.started)) * 100;
      plan = `<div class="card plan"><h3 style="margin-top:0">📜 Master plan: drafting</h3><p>Planners are working on ${p.priorities.map((k) => `${pr(k).icon} ${pr(k).name}`).join(', ')}.</p>${bar(pct)}<p class="sub">Draft due ${U.fmtDate(p.ready)}.</p></div>`;
    } else if (p.status === 'review') {
      const grp = G.voteGroup(s);
      const w = ZG.Officials.whip(s, grp, 'plan');
      plan = `<div class="card plan"><h3 style="margin-top:0">📜 Master plan: public comment</h3>
        <p>Priorities: ${p.priorities.map((k) => `${pr(k).icon} ${pr(k).name}`).join(', ')}. <b>${G.voteBody(s)}</b> votes on ${U.fmtDate(p.reviewEnd)}.</p>
        <div class="rel"><span>Public support</span>${bar(p.support)}<b>${Math.round(p.support)}</b></div>
        <div class="whip"><b>Whip count:</b> <span class="good">${w.yes} yes</span> · <span class="warn">${w.lean} undecided</span> · <span class="bad">${w.no} no</span></div>
        <div class="actions">${btn('🗣️ Host a community meeting ($12K)', 'planMeeting', {}, 'sm primary')}${btn('📺 Pitch it on air', 'tab', { tab: 'media' }, 'sm')}${btn('🏛️ Ask for votes', 'govGo', { sub: grp }, 'sm')}</div></div>`;
    } else if (p.status === 'adopted') {
      const goals = G.goalProgress(s)
        .map((g) => `<div class="rel"><span>${pr(g.k).icon} ${esc(pr(g.k).goal)}</span>${bar(g.pct * 100)}<b>${g.done ? '✅' : Math.round(g.pct * 100) + '%'}</b></div>`)
        .join('');
      plan = `<div class="card plan adopted"><h3 style="margin-top:0">📜 Strategic plan: adopted ✅</h3><p class="sub">Adopted ${U.fmtDate(p.adopted)}, guides the zoo until ${U.fmtDate(p.expires)}. Having a plan helps campaigns, grants, state requests and budget asks.</p>${goals}</div>`;
    }
    // Land
    const L = G.LAND[s.zooId];
    const land = s.growth.land;
    const lcost = G.landCost(s);
    let landActs = '';
    if (!land) {
      if (!G.has(s, 'grow')) landActs = `<p class="sub">🔒 Needs an adopted plan that includes 🗺️ Grow the footprint.</p>`;
      else {
        const can = ZG.Econ.canAfford(s, lcost, true);
        landActs = `<div class="actions">${can ? btn(`🗺️ Buy the land (${$(lcost)})`, 'buyLand', {}, 'primary') : dis(`Buy the land (${$(lcost)})`, 'Not enough funds')}${!can && !s.dev.campaign ? btn(`Launch a capital campaign (${$(lcost)})`, 'campaign', { goal: lcost, label: L.name }, 'sm') : ''}</div>${can ? '' : '<p class="sub">Raise it with a capital campaign, a state request, a donor ask or your partner organization.</p>'}`;
      }
    } else if (land.status === 'acquiring') {
      landActs = `<p>🚧 Permits, demolition and grading underway. Ready ${U.fmtDate(land.done)}.</p>${bar(((s.day - land.started) / (land.done - land.started)) * 100)}`;
    } else landActs = `<p class="good">✅ Opened ${U.fmtDate(land.opened)}: three new habitat lots at the back of the zoo.</p>`;
    const landCard = `<div class="card"><h3 style="margin-top:0">🗺️ Buy land: ${esc(L.name)}</h3><p>${esc(L.story)}</p><p class="sub">Adds <b>three large habitat lots</b> (about ${U.num(Math.round(ZG.zoo(s).avgPlot * 1.4))} m² each) · ${$(lcost)} · about ${Math.round(L.days / 30)} months</p>${landActs}</div>`;
    // Second site
    const opts = G.secondOptions(s);
    let second = '';
    if (!opts) second = `<div class="card"><h3 style="margin-top:0">🏞️ Second site</h3><p class="sub">In this game a second campus is an option for the city- and federally-run zoos (Honolulu, Houston and the National Zoo).</p></div>`;
    else {
      const S2 = s.growth.second;
      if (S2 && S2.status === 'building') second = `<div class="card"><h3 style="margin-top:0">🏗️ ${esc(S2.name)}</h3><p>Under construction, opening ${U.fmtDate(S2.done)}.</p>${bar(((s.day - S2.started) / (S2.done - S2.started)) * 100)}</div>`;
      else if (S2 && S2.status === 'open') {
        const site = s.sites.find((x) => x.name === S2.name);
        const habs = s.habitats.filter((h) => site && h.site === site.id);
        second = `<div class="card adopted"><h3 style="margin-top:0">🏞️ ${esc(S2.name)} ✅</h3><p>${S2.kind === 'public' ? `Open to the public · ${U.num(site.ytd || 0)} visitors this year` : 'Conservation & breeding center (off-exhibit), boosting your AZA standing every month'} · ${habs.length} habitat${habs.length === 1 ? '' : 's'} built, ${habs.filter((h) => s.animals.some((a) => a.hab === h.id)).length} stocked.</p><p class="sub">Its lots are listed in the Habitats tab. Click one to plan a habitat with the architect.</p></div>`;
      } else {
        const locked = !G.has(s, 'second');
        second = `<h3>🏞️ Open a second site</h3>${locked ? '<p class="sub">🔒 Needs an adopted plan that includes 🏞️ Open a second site.</p>' : ''}` +
          Object.entries(opts)
            .map(([k, o]) => {
              const can = ZG.Econ.canAfford(s, o.cost, true);
              return `<div class="card"><div class="row"><b>${k === 'public' ? '🦓' : '🧬'} ${esc(o.name)}</b><span>${$(o.cost)}</span></div><p>${esc(o.story)}</p><p class="sub">${k === 'public' ? '4 large habitat sites with their own visitors, admissions and costs' : '3 off-exhibit breeding complexes: no visitors, lower running costs, a steady AZA boost'} · about ${Math.round(o.days / 30)} months to build</p>
                <div class="actions">${locked ? '' : can ? btn('Break ground', 'startSecond', { kind: k }, 'primary') : dis('Break ground', 'Not enough funds')}${!locked && !can && !s.dev.campaign ? btn(`Launch a capital campaign (${$(o.cost)})`, 'campaign', { goal: o.cost, label: o.name }, 'sm') : ''}</div></div>`;
            })
            .join('');
      }
    }
    return `${plan}${landCard}${second}`;
  };

  // =====================================================================
  // FUNDRAISING
  // =====================================================================
  P.tab_fundraising = function (s) {
    const Z = ZG.zoo(s);
    const pd = ZG.Partner.def(s);
    const st = subtabs('fundraising', [['donors', '💎 Top donors'], ['partner', `🤝 ${pd.kind === 'society' ? pd.name.replace(/ \(.*\)/, '') : 'Endowment'}`], ['pipeline', '🌱 Prospects & campaign'], ['grants', '📑 Grants & sponsors']]);
    let body = '';
    if (st.cur === 'donors') body = P.donorsView(s);
    else if (st.cur === 'partner') body = P.partnerView(s);
    else if (st.cur === 'pipeline') body = P.pipelineView(s);
    else body = P.grantsView(s);
    return `<h2>🤝 Fundraising & Partnerships</h2><p class="sub">${esc(Z.partner)} supports the zoo. General annual-fund giving arrives monthly. Your top donors and partner give in proportion to how well you treat them.</p>${st.html}${body}`;
  };

  P.donorsView = function (s) {
    const DN = ZG.Donors;
    const top = DN.top(s);
    const total = top.reduce((a, d) => a + d.annual, 0);
    const cards = top
      .map((d, i) => {
        const can = DN.canContact(s, d);
        const touches = Object.entries(DN.TOUCHES)
          .map(([k, T]) => (can ? btn(`${T.icon} ${T.name}${T.cost ? ` (${$(T.cost)})` : ''}`, 'donorTouch', { id: d.id, type: k }, 'sm') : ''))
          .join('');
        const purposes = Object.entries(DN.PURPOSES)
          .filter(([k]) => (k !== 'campaign' || s.dev.campaign) && (k !== 'planned' || !d.planned))
          .map(([k, v]) => `<option value="${k}">${esc(v)}</option>`)
          .join('');
        const askReady = s.day - d.lastAsk >= 90;
        const levels = DN.askLevels(d)
          .map((l) => (askReady ? btn(`Ask ${$(l.amt)}`, 'donorAsk', { id: d.id, lvl: l.lvl }, 'sm ' + (l.lvl === 'major' ? 'primary' : '')) : ''))
          .join('');
        const odds = Math.round(DN.odds(s, d, d.cap, 'operating') * 100);
        const overdue = s.day - d.lastContact > 60;
        return `<div class="card donor ${d.rel < 35 ? 'cool' : ''}">
          <div class="donor-top">${face(d.name, hueOf(d.name))}<div class="dmeta"><b>${i + 1}. ${esc(d.name)}</b><small>Supporter since ${d.since} · lifetime ${$(d.lifetime)} · annual gift ${$(d.annual)} · can give ~${$(d.cap)}</small></div></div>
          <div class="rel"><span>Relationship</span>${bar(d.rel)}<b class="${d.rel >= 65 ? 'good' : d.rel >= 45 ? 'warn' : 'bad'}">${DN.mood(d.rel)}</b></div>
          <p class="dnotes">💡 ${esc(DN.interestText(d))} · <span title="${esc(DN.TRAITS[d.trait].tip)}"><b>${DN.TRAITS[d.trait].name}</b>: ${esc(DN.TRAITS[d.trait].tip)}</span></p>
          <p class="sub">Last contact ${since(s, d.lastContact)}${overdue ? ' <b class="bad">· overdue for a visit</b>' : ''}${d.lastGiftDay > -9000 ? ` · last gift ${$(d.lastGift)} ${since(s, d.lastGiftDay)}` : ''}${d.planned ? ' · 📜 zoo is in their will' : ''}</p>
          ${!d.thanked ? `<div class="warnbox">They haven't been thanked for their last gift. ${btn('💌 Send a thank-you', 'donorThank', { id: d.id }, 'sm primary')}</div>` : ''}
          <div class="actions">${can ? touches : `<span class="sub">Next visit after ${U.fmtDate(d.lastContact + DN.GAP)}</span>`}</div>
          <div class="actions ask">${askReady ? `<select data-dpurpose="${d.id}">${purposes}</select>${levels}<span class="sub">~${odds}% odds for a ${$(d.cap)} ask</span>` : `<span class="sub">Next ask after ${U.fmtDate(d.lastAsk + 90)}</span>`}</div>
        </div>`;
      })
      .join('');
    return `<p class="sub">Your ten most important donors give about <b>${$(total)}</b> a year between them. Their December gifts rise and fall with your relationship. Visit them, thank them and learn what they care about before you ask for more.</p>${cards}`;
  };

  P.partnerView = function (s) {
    const PT = ZG.Partner, p = s.partner, d = PT.def(s);
    const builds = Object.entries(PT.BUILD)
      .map(([k, B]) => btn(`${B.icon} ${k === 'meet' ? `Meet the ${d.head}` : B.name}${B.cost ? ` (${$(B.cost)})` : ''}`, 'partnerBuild', { kind: k }, 'sm'))
      .join('');
    const canMeet = s.day - p.lastMet >= PT.GAP;
    const asks = PT.asks(s)
      .map((a) => {
        const odds = Math.round(PT.odds(s, a) * 100);
        const ready = s.day - p.lastAsk >= 60 && a.amount > 0 && !(a.id === 'appeal' && p.appeal);
        return `<div class="card ask-card"><div class="row"><b>“${esc(a.name)}”</b><span>${$(a.amount)}</span></div><small>${esc(a.text)} About <b>${odds}%</b> likely. Costs goodwill if they say yes.</small>
          <div class="actions">${ready ? btn('Ask', 'partnerAsk', { id: a.id }, 'sm primary') : dis('Ask', p.appeal && a.id === 'appeal' ? 'Appeal already running' : `Wait until ${U.fmtDate(p.lastAsk + 60)}`)}</div></div>`;
      })
      .join('');
    return `<div class="card"><div class="donor-top">${face(d.name, 140)}<div class="dmeta"><b>${esc(d.name)}</b><small>${esc(d.head)}: ${esc(p.headName)} · ${d.kind === 'society' ? 'reserves' : 'endowment'} ≈ ${$(p.reserves)} · annual support ${$(p.annual)}</small></div></div>
      <div class="rel"><span>Relationship</span>${bar(p.rel)}<b class="${p.rel >= 60 ? 'good' : p.rel >= 45 ? 'warn' : 'bad'}">${PT.mood(p.rel)}</b></div>
      <p class="sub">${esc(d.tension)}</p>
      ${p.appeal ? `<p>📬 Appeal underway. Results about ${U.fmtDate(p.appeal.day)}.</p>` : ''}
      <div class="actions">${canMeet ? builds : `<span class="sub">Next meeting after ${U.fmtDate(p.lastMet + PT.GAP)}</span>`}</div></div>
      <h3>Ask them for help</h3>${asks}`;
  };

  P.pipelineView = function (s) {
    const D = ZG.Dev;
    const pros = s.dev.prospects
      .map((p) => `<div class="card"><div class="row"><b>${esc(p.name)}</b><span>capacity ~${$(p.cap)}</span></div><small>${D.passionText(p.passion)} · readiness</small>${bar(p.ready)}
        <div class="actions">${btn(p.cultivating ? '☕ Cultivating ($1.5K/mo)' : 'Start cultivating', 'cultivate', { pid: p.id }, 'sm ' + (p.cultivating ? 'on' : ''))}${btn(`Ask ${$(p.cap * 0.5)}`, 'ask', { pid: p.id, lvl: 'low' }, 'sm')}${btn(`Ask ${$(p.cap)}`, 'ask', { pid: p.id, lvl: 'mid' }, 'sm')}${btn(`Ask ${$(p.cap * 1.6)}`, 'ask', { pid: p.id, lvl: 'high' }, 'sm')}</div></div>`)
      .join('');
    const c = s.dev.campaign;
    const camp = c
      ? `<div class="card"><b>📣 ${esc(c.label)}</b> — ${$(c.raised)} of ${$(c.goal)}${bar(c.raised, c.goal)}<small>Ends ${U.fmtDate(c.end)} · momentum ${Math.round((c.momentum || 0) * 100)}% ${c.momentum > 0.05 ? '🔥' : ''}</small>
         <p class="sub">Go on the news or the radio (📺 Media tab) to build momentum and bring in pledges.</p><div class="actions">${btn('📺 Go on air for the campaign', 'tab', { tab: 'media' }, 'sm primary')}</div></div>`
      : `<p>No active campaign. ${btn(`Launch campaign to cut backlog (${$(ZG.Infra.backlog(s) * 0.5)})`, 'campaign', { goal: Math.round(ZG.Infra.backlog(s) * 0.5), label: 'Renew Our Zoo' })} <br><small>Or launch one for a specific new habitat from the build panel.</small></p>`;
    const galaReady = s.day - s.dev.lastGala >= 300;
    return `<h3>Capital campaign</h3>${camp}
      <h3>Annual gala</h3><p>${galaReady ? btn(`🥂 Host the annual gala (${$(ZG.zoo(s).donorBase * 0.06)})`, 'gala') : `Next gala available ${U.fmtDate(s.dev.lastGala + 300)}`}</p>
      <h3>New major-gift prospects</h3><p class="sub">People who give become part of your donor roster.</p>${pros || '<p>No prospects right now. More development staff finds more.</p>'}`;
  };

  P.grantsView = function (s) {
    const D = ZG.Dev;
    const offers = s.sponsorOffers
      .map((o) => `<div class="card ${o.risk > 0.5 ? 'risky' : ''}"><div class="row"><b>${esc(o.name)}</b><span>${$(o.amount)}/yr × ${o.years} yrs</span></div><small>${esc(o.ind)} · ${esc(D.sponsorKindText(o, s))} · reputational risk: <b class="${o.risk > 0.5 ? 'bad' : o.risk > 0.25 ? 'warn' : 'good'}">${o.risk > 0.5 ? 'HIGH' : o.risk > 0.25 ? 'medium' : 'low'}</b> · expires ${U.fmtDate(o.expires)}</small>
        <div class="actions">${btn('Sign', 'sponsorYes', { oid: o.id }, 'sm primary')}${btn('Decline', 'sponsorNo', { oid: o.id }, 'sm')}</div></div>`)
      .join('');
    const active = s.sponsors.map((x) => `<li>${esc(x.name)} — ${$(x.amount)}/yr until ${U.fmtDate(x.end)} ${btn('End', 'sponsorDrop', { name: x.name }, 'sm danger')}</li>`).join('');
    const grants = ZG.NAMES.grants.map((g, i) => `<li>${esc(g.name)} <small>(${$(g.amt[0])}–${$(g.amt[1])})</small> ${btn('Apply', 'grant', { idx: i }, 'sm')}</li>`).join('');
    const pend = s.dev.grants.map((g) => `<li>⏳ ${esc(g.name)} — decision ${U.fmtDate(g.day)}</li>`).join('');
    return `<h3>Grants</h3><ul class="plain">${grants}${pend}</ul>
      <h3>Corporate sponsorship offers</h3><p class="sub">Risky sponsors pay more but upset conservation-minded donors.</p>${offers || '<p class="sub">No offers right now.</p>'}
      ${active ? `<h3>Active sponsors</h3><ul class="plain">${active}</ul>` : ''}`;
  };

  // =====================================================================
  // GOVERNMENT
  // =====================================================================
  P.tab_government = function (s) {
    const Z = ZG.zoo(s);
    const g = s.gov;
    const ros = ZG.Officials.ROSTERS[s.zooId];
    const tabs = [['overview', '🏛️ Overview']];
    const sti = ZG.Officials.stateInfo(s);
    const labels = { local: '🏙️ City Hall', state: `🏛️ ${sti ? sti.name : 'State'} Legislature`, federal: '🇺🇸 Congress', board: s.zooId === 'national' ? '💼 Smithsonian' : '💼 Board' };
    for (const k of Object.keys(ros.groups)) tabs.push([k, labels[k]]);
    const st = subtabs('government', tabs);
    let body;
    if (st.cur === 'overview') {
      const type = {
        city: 'Your zoo is a City department. The Mayor proposes the budget in spring; the Council votes. Fee changes require an ordinance. Staff are city employees with union contracts and civil-service hiring.',
        federal: 'Your zoo is part of the Smithsonian. Congress appropriates funds for a fiscal year starting October 1. If Congress misses the deadline, the government shuts down and so do your gates.',
        contract: 'A nonprofit runs the zoo under a management agreement with the City, which owns the land and animals and pays an annual fee that escalates under the contract.',
        nonprofit_tax: 'A private nonprofit runs the zoo, but a City Charter provision still dedicates a small property-tax levy to it. Revenue tracks property values.',
        private: 'No city funding at all. Every dollar comes from guests, members, donors and sponsors. Your Board of Trustees is your boss, but the state can still fund capital projects.',
      }[g.type];
      body = `<div class="card"><b>${esc(Z.govName)}</b><p>${type}</p></div>
        <div class="kpis"><div><small>Public funding</small><b>${$(g.appropriation)}/yr</b></div><div><small>Local economy</small><b class="${s.economy >= 1 ? 'good' : 'warn'}">${Math.round(s.economy * 100)}</b></div><div><small>Your boss</small><b>${esc(Z.bossName)}</b></div></div>
        ${g.type !== 'private' ? meter(g.type === 'federal' ? 'Standing with Congress' : 'Standing with City Hall', g.relationship, 'Affects budget requests, votes and bailouts') : ''}
        ${sti ? meter(`Standing in ${sti.name}'s capitol`, g.stateRel, 'Affects state funding requests') : ''}
        ${meter('Confidence in you', s.board)}
        ${g.request ? `<p>📨 Budget request pending: asking ${$(g.request.ask)}${g.request.capital ? ` + ${$(g.request.capital)} capital` : ''} — about ${Math.round(ZG.Politics.odds(s, g.request.bump || 0, 'budget') * 100)}% odds. Line up supporters in the ${g.type === 'federal' ? 'Congress' : 'City'} tab.</p>` : ''}
        ${g.nextApprop ? `<p>📅 Next fiscal year funding set at ${$(g.nextApprop)}.</p>` : ''}
        ${g.shutdown ? `<p class="bad">🚫 Government shutdown in progress. Funding owed: ${$(g.owed)}.</p>` : ''}
        ${g.feeProposal ? `<p>📜 Fee ordinance ($${g.feeProposal.price}) before Council — vote ${U.fmtDate(g.feeProposal.day)}.</p>` : ''}
        ${g.stateReq ? `<p>🏛️ State request “${esc(g.stateReq.name)}” (${$(g.stateReq.amount)}) ${g.stateReq.passed ? 'passed the Legislature and is on the Governor’s desk' : 'is before the Legislature'}.</p>` : ''}
        ${g.type === 'city' || g.type === 'federal' ? `<p class="sub">Budget requests happen every ${g.type === 'city' ? 'February (decision in May, effective July 1)' : 'March (testimony) with appropriations due October 1'}.</p>` : ''}
        ${g.type === 'contract' ? `<p class="sub">Management agreement renewal due in ${g.contractYear}.</p>` : ''}
        ${ros.noState ? `<p class="sub">${esc(ros.noState)}</p>` : ''}
        <p class="tip">💡 Meeting officials is free. Talk to them about what <i>they</i> care about, then ask them to back your requests before the vote. You can also go on the news or talk radio to build public pressure (📺 Media).</p>
        <h3>Your career</h3>${P.directorCard(s)}`;
    } else body = P.officialsView(s, st.cur);
    return `<h2>🏛️ Government & Governance</h2>${st.html}${body}`;
  };

  P.officialsView = function (s, group) {
    const O = ZG.Officials;
    const item = O.pendingItem(s, group);
    const list = O.list(s, group);
    const w = item ? O.whip(s, group, item.key) : null;
    let head = '';
    if (group === 'state') {
      const sti = O.stateInfo(s);
      const r = s.gov.stateReq;
      const opts = O.stateOptions(s)
        .map((o) => `<div class="card ask-card"><div class="row"><b>${esc(o.name)}</b><span>${$(o.amount)}</span></div><small>${esc(o.text)}</small><div class="actions">${O.stateWindow(s) && !r ? btn('File this request ($8K)', 'stateSubmit', { kind: o.kind }, 'sm primary') : ''}</div></div>`)
        .join('');
      head = `<div class="card"><b>🏛️ Ask the State of ${esc(sti.name)} for money</b><p class="sub">${esc(sti.note)} Your request is a ${esc(sti.program)}. Money goes to the capital fund.</p>
        ${r ? `<p>Your request: <b>${esc(r.name)}</b> for ${$(r.amount)}. ${r.passed ? 'Passed the Legislature, now waiting on the Governor.' : `The Legislature decides in ${U.MONTHS_LONG[sti.decide]}.`}</p>` : O.stateWindow(s) ? '<p class="good">The session is open. File one request this year.</p>' : `<p class="sub">Requests are taken in ${sti.open.map((m) => U.MONTHS_LONG[m]).join(', ')}${sti.odd ? ' of odd-numbered years' : ''}. ${s.gov.stateYear === U.dateOf(s.day).y ? 'You already filed this year.' : ''} Build relationships now so they are ready when the session opens.</p>`}</div>
        ${!r && O.stateWindow(s) ? opts : ''}`;
    }
    if (group === 'local' && s.gov.type === 'private') head = '';
    const whip = w ? `<div class="whip"><b>Whip count on ${esc(item.text)}:</b> <span class="good">${w.yes} yes</span> · <span class="warn">${w.lean} undecided</span> · <span class="bad">${w.no} no</span></div>` : '';
    const cards = list
      .map((o) => {
        const stc = O.stance(s, o);
        const T = O.TRAITS[o.trait];
        const canMeet = s.day - o.lastMet >= O.GAP;
        const canAsk = item && s.day - o.lastAsk >= O.GAP && o.committed !== item.key;
        const acts = canMeet
          ? btn(o.group === 'board' ? '☕ One-on-one' : '🤝 Office meeting', 'offMeet', { id: o.id, kind: 'meet' }, 'sm') + btn('🦒 Private zoo tour ($400)', 'offMeet', { id: o.id, kind: 'tour' }, 'sm')
          : `<span class="sub">Next meeting after ${U.fmtDate(o.lastMet + O.GAP)}</span>`;
        return `<div class="card person ${o.exec ? 'exec' : ''}"><div class="donor-top">${face(o.name, hueOf(o.role))}<div class="dmeta"><b>${esc(o.name)}</b><small>${esc(o.role)}${o.exec && group !== 'board' ? ' · signs or vetoes' : ''}${o.fresh && s.day - o.fresh < 365 ? ' · newly elected' : ''}</small></div>
          <span class="lean ${stc >= 62 ? 'good' : stc >= 42 ? 'warn' : 'bad'}">${O.lean(stc)}</span></div>
          <div class="rel"><span>Stance</span>${bar(stc)}<b>${Math.round(stc)}</b></div>
          <p class="dnotes"><b>${T.name}</b>: wants ${esc(T.wants)}.${o.committed ? ' <b class="good">✅ Committed to support you.</b>' : ''} <span class="sub">Last met ${since(s, o.lastMet)}.</span></p>
          <div class="actions">${acts}${canAsk ? btn(`📋 Ask for their vote`, 'offAsk', { id: o.id }, 'sm primary') : ''}</div></div>`;
      })
      .join('');
    return `<p class="sub"><b>${esc(ZG.Officials.ROSTERS[s.zooId].groups[group])}</b></p>${head}${whip}${cards}`;
  };

  // =====================================================================
  // MEDIA
  // =====================================================================
  P.tab_media = function (s) {
    const MD = ZG.Media;
    const topics = MD.topics(s);
    const cur = P.ui.mediaTopic && topics.some((t) => t.id === P.ui.mediaTopic) ? P.ui.mediaTopic : topics[0].id;
    const tsel = `<select id="media-topic" data-mtopic="1">${topics.map((t) => `<option value="${t.id}" ${t.id === cur ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
    const why = topics.find((t) => t.id === cur).why;
    const outlets = Object.entries(MD.OUTLETS)
      .map(([k, o]) => {
        const ok = MD.canUse(s, k);
        return `<div class="card outlet"><div class="row"><b>${o.icon} ${esc(o.name)}</b><span class="sub">reach ${'●'.repeat(Math.round(o.reach * 4))}${'○'.repeat(4 - Math.round(o.reach * 4))} · risk ${o.risk > 0.2 ? '<b class="bad">high</b>' : o.risk > 0.08 ? '<b class="warn">medium</b>' : '<b class="good">low</b>'}</span></div>
          <small>${esc(o.desc)}</small><div class="actions">${ok ? btn('Book it', 'media', { outlet: k }, 'sm primary') : `<span class="sub">Available again ${U.fmtDate(s.media.last[k] + MD.GAP)}</span>`}</div></div>`;
      })
      .join('');
    const hist = s.media.history.slice(0, 6).map((h) => `<li><small>${U.fmtDate(h.day)}</small> ${MD.OUTLETS[h.outlet].icon} ${esc(h.verdict)}</li>`).join('');
    return `<h2>📺 Media & Public Affairs</h2>
      <p class="sub">Pick your message, then pick where to say it. Big audiences move the needle more, but live shows can go badly. Your background affects how well you do on camera.</p>
      <label><b>Your message:</b> ${tsel}</label><p class="sub">${esc(why)}</p>
      ${outlets}${hist ? `<h3>Recent appearances</h3><ul class="news">${hist}</ul>` : ''}`;
  };

  // =====================================================================
  // EVENTS & SHOP
  // =====================================================================
  P.tab_business = function (s) {
    const st = subtabs('business', [['events', '🎉 Special events'], ['merch', '🛍️ Gift shop & merch']]);
    return `<h2>🎪 Events & Shop</h2>${st.html}${st.cur === 'events' ? P.eventsView(s) : P.merchView(s)}`;
  };

  P.eventsView = function (s) {
    const ZE = ZG.ZooEvents;
    const booked = s.zooEvents.booked
      .map((e) => {
        const T = ZE.TYPES[e.type];
        return `<li>${T.icon} <b>${esc(T.name)}</b> — ${U.fmtDate(e.day)}${e.hype > 1.05 ? ` · buzz +${Math.round((e.hype - 1) * 100)}%` : ''} ${btn('Promote on air', 'tab', { tab: 'media' }, 'sm')} ${btn('Cancel', 'zcancel', { id: e.id }, 'sm danger')}</li>`;
      })
      .join('');
    const cards = Object.entries(ZE.TYPES)
      .map(([k, T]) => {
        const why = ZE.available(s, k);
        const est = ZE.estimate(s, k, 1);
        const numbers = T.free
          ? `~${U.num(est.people)} guests · lost ticket revenue ~${$(est.lost)} · goodwill with City Hall and the community`
          : T.festival
            ? `~${$(est.cost)} to build · lifts evening attendance ~30% for six weeks`
            : `~${U.num(est.people)} guests at ~$${est.price} · revenue ~${$(est.revenue)} · costs ~${$(est.cost)} · <b class="${est.revenue - est.cost >= 0 ? 'good' : 'bad'}">net ~${$(est.revenue - est.cost)}</b>`;
        const when = T.festival ? '' : `<select data-zweeks="${k}">${[2, 3, 4, 6, 8, 12].filter((w) => w * 7 >= T.lead).map((w) => `<option value="${w}" ${w === 4 ? 'selected' : ''}>in ${w} weeks</option>`).join('')}</select>`;
        const risks = [T.alcohol ? '🍺 alcohol: small chance of an incident' : '', T.noise >= 1.5 ? '🔊 noise stresses animals & neighbors' : '', T.family ? '👨‍👩‍👧 family-friendly' : ''].filter(Boolean).join(' · ');
        return `<div class="card zev"><div class="row"><b>${T.icon} ${esc(T.name)}</b></div><small>${esc(T.desc)}</small><p class="sub">${numbers}${risks ? `<br>${risks}` : ''}</p>
          <div class="actions">${why ? `<span class="sub">${esc(why)}</span>` : `${when}${btn(`Book (${$(Math.round(T.fixed * ZE.scale(s) * 0.5))} deposit)`, 'zbook', { type: k }, 'sm primary')}`}</div></div>`;
      })
      .join('');
    const hist = s.zooEvents.history.slice(0, 6).map((h) => `<li><small>${U.fmtDate(h.day)}</small> ${ZE.TYPES[h.type].icon} ${esc(ZE.TYPES[h.type].name)}${h.people ? ` · ${U.num(h.people)} guests` : ''}${h.net != null ? ` · <b class="${h.net >= 0 ? 'good' : 'bad'}">${$(h.net)}</b>` : ''}</li>`).join('');
    return `<p class="sub">Evening and seasonal events bring in money and new members, and win community goodwill. Weather on the night matters, and so does promoting them on air.</p>
      ${booked ? `<h3>On the calendar</h3><ul class="plain">${booked}</ul>` : ''}<h3>Book an event</h3>${cards}${hist ? `<h3>Past events</h3><ul class="news">${hist}</ul>` : ''}`;
  };

  P.merchView = function (s) {
    const MR = ZG.Merch, m = s.merch;
    const t = U.dateOf(s.day);
    const y = ZG.Econ.yearTotals(s, t.y);
    const ytd = (y.rev.retail || 0) + (s.ledger.cur.rev.retail || 0);
    const prices = Object.entries(MR.PRICES).map(([k, p]) => `<button class="btn sm ${m.price === k ? 'on' : ''}" data-act="merchPrice" data-p="${k}" title="${esc(p.desc)}">${p.name}</button>`).join('');
    const lines = Object.entries(MR.LINES)
      .map(([k, L]) => {
        const on = !!m.lines[k];
        const setup = !m.owned[k] && L.setup ? ` (${$(L.setup)} setup)` : '';
        return `<div class="line ${on ? 'on' : ''}"><div><b>${L.icon} ${esc(L.name)}</b><br><small>${esc(L.desc)}${L.monthly ? ` Runs ${$(L.monthly)}/mo.` : ''}</small></div>${btn(on ? 'Stop selling' : `Add${setup}`, 'merchLine', { k }, 'sm ' + (on ? '' : 'primary'))}</div>`;
      })
      .join('');
    const next = MR.STORES[m.store + 1];
    const store = `<p>Store: <b>${MR.STORES[m.store].name}</b> (sales ×${MR.STORES[m.store].mult.toFixed(2)}) ${next ? btn(`Upgrade to ${next.name} (${$(Math.round(next.cost * ZG.zoo(s).costMult))})`, 'merchStore', {}, 'sm') : ''}</p>`;
    const collab = m.collab && m.collab.until > s.day
      ? `<div class="card saved"><b>🏷️ ${esc(m.collab.name)} × ${esc(ZG.zoo(s).name)}</b><p class="sub">Co-branded ${esc(m.collab.ind)} line until ${U.fmtDate(m.collab.until)} · sales +${Math.round(m.collab.boost * 100)}% · they received a 4% royalty.</p></div>`
      : MR.brands(s).map((b) => `<div class="card"><div class="row"><b>${esc(b.name)}</b><span class="sub">${esc(b.ind)}</span></div><small>A one-year co-branded line. They pay a licensing fee (~${$(b.fee)}) and take a royalty. Sales up about ${Math.round(b.boost * 100)}%.${b.adult ? ' Alcohol brand: some officials may object.' : ''}</small><div class="actions">${btn('Pitch a collaboration', 'merchCollab', { name: b.name }, 'sm primary')}</div></div>`).join('');
    const drops = MR.dropOptions(s);
    const drop = m.drop && m.drop.until > s.day
      ? `<p>🧸 The <b>${esc(m.drop.name)}</b> limited edition is on shelves until ${U.fmtDate(m.drop.until)}.</p>`
      : drops.length
        ? `<p class="sub">Feature a star animal in a 90-day limited edition. Babies sell best.</p><div class="actions">${drops.map((d) => btn(`${ZG.SPECIES[d.sp].emoji} “${esc(d.name)}” edition (${$(d.cost)})`, 'merchDrop', { aid: d.aid }, 'sm')).join('')}</div>`
        : '<p class="sub">No star animals to feature right now.</p>';
    return `<div class="kpis"><div><small>Merch sales this year</small><b>${$(ytd)}</b></div><div><small>Buzz</small><b>${Math.round((m.hype || 0) * 100)}%</b></div></div>
      <h3>Pricing</h3><div class="actions">${prices}</div><p class="sub">${esc(MR.PRICES[m.price].desc)}</p>
      <h3>Product lines</h3><div class="lines">${lines}</div>
      <h3>The store</h3>${store}
      <h3>Local brand collaboration</h3>${collab}
      <h3>Limited editions</h3>${drop}`;
  };

  // =====================================================================
  // ACTIONS
  // =====================================================================
  A.sub = (s, d) => {
    P.ui.sub[d.tab] = d.sub;
    return null;
  };
  A.donorTouch = (s, d) => ZG.Donors.touch(s, +d.id, d.type);
  A.donorThank = (s, d) => ZG.Donors.thank(s, +d.id);
  A.donorAsk = (s, d) => {
    const sel = document.querySelector(`[data-dpurpose="${d.id}"]`);
    return ZG.Donors.ask(s, +d.id, d.lvl, sel ? sel.value : 'operating');
  };
  A.partnerBuild = (s, d) => ZG.Partner.build(s, d.kind);
  A.partnerAsk = (s, d) => ZG.Partner.ask(s, d.id);
  A.offMeet = (s, d) => ZG.Officials.meet(s, +d.id, d.kind);
  A.offAsk = (s, d) => ZG.Officials.askSupport(s, +d.id);
  A.stateSubmit = (s, d) => ZG.Officials.submitState(s, d.kind);
  A.media = (s, d) => {
    const sel = document.getElementById('media-topic');
    return ZG.Media.appear(s, d.outlet, sel ? sel.value : 'membership');
  };
  A.zbook = (s, d) => {
    const sel = document.querySelector(`[data-zweeks="${d.type}"]`);
    return ZG.ZooEvents.book(s, d.type, sel ? +sel.value : 4);
  };
  A.zcancel = (s, d) => (ZG.App.confirm('zc' + d.id, 'Cancel this event? You lose the deposit.') ? ZG.ZooEvents.cancel(s, +d.id) : null);
  A.merchPrice = (s, d) => ZG.Merch.setPrice(s, d.p);
  A.merchLine = (s, d) => ZG.Merch.toggleLine(s, d.k);
  A.merchStore = (s) => ZG.Merch.upgradeStore(s);
  A.merchCollab = (s, d) => ZG.Merch.collab(s, d.name);
  A.merchDrop = (s, d) => ZG.Merch.launchDrop(s, +d.aid);

  A.reqFor = (s, d) => {
    const h = s.habitatsById[+d.hab];
    P.ui.req = { hab: +d.hab, sp: h ? (s.animals.find((a) => a.hab === h.id) || {}).sp : null, m: 0, f: 1 };
    P.ui.tab = 'animals';
    P.ui.scrollTo = 'req-card';
    return null;
  };
  A.reqSend = (s) => {
    const r = P.ui.req || {};
    return ZG.Requests.submit(s, r.sp, r.m, r.f, r.hab);
  };
  A.reqQuick = (s, d) => ZG.Requests.submit(s, d.sp, +d.m, +d.f, +d.hab);
  A.acquireInto = (s, d) => ZG.AZA.acquire(s, +d.oid, +d.hab);
  A.expand = (s, d) => ZG.Habitats.expand(s, +d.hab);
  A.reqCancel = (s, d) => ZG.Requests.cancel(s, +d.id);
  A.renameStart = (s, d) => {
    P.ui.renaming = +d.hab;
    P.ui.renameDraft = s.habitatsById[+d.hab] ? s.habitatsById[+d.hab].name : '';
    setTimeout(() => {
      const i = document.getElementById('rename-input');
      if (i) (i.focus(), i.select());
    }, 30);
    return null;
  };
  A.renameCancel = () => {
    P.ui.renaming = null;
    P.ui.renameDraft = null;
    return null;
  };
  A.renameSave = (s, d) => {
    const i = document.getElementById('rename-input');
    const r = ZG.Habitats.rename(s, +d.hab, i ? i.value : P.ui.renameDraft);
    if (r.ok) (P.ui.renaming = null), (P.ui.renameDraft = null);
    return r;
  };
  A.planPick = (s, d) => {
    const pick = (P.ui.planPick = P.ui.planPick || []);
    const i = pick.indexOf(d.k);
    if (i >= 0) pick.splice(i, 1);
    else if (pick.length < 3) pick.push(d.k);
    else return { ok: false, msg: 'Three priorities max. Unselect one first.' };
    return null;
  };
  A.planCommission = (s) => {
    const r = ZG.Growth.commission(s, P.ui.planPick || []);
    if (r.ok) P.ui.planPick = [];
    return r;
  };
  A.planMeeting = (s) => ZG.Growth.meeting(s);
  A.buyLand = (s) => ZG.Growth.buyLand(s);
  A.startSecond = (s, d) => ZG.Growth.startSecond(s, d.kind);
  A.govGo = (s, d) => {
    P.ui.tab = 'government';
    P.ui.sub.government = d.sub;
    return null;
  };
  A.reserveIn = (s, d) => ZG.Reserve.deposit(s, +d.amt);
  A.reserveOut = (s, d) => ZG.Reserve.withdraw(s, +d.amt);
  A.reserveCover = (s) => {
    s.reserve.autoCover = !s.reserve.autoCover;
    return { ok: true, msg: `Auto-cover ${s.reserve.autoCover ? 'on' : 'off'}.` };
  };
  A.fieldJoin = (s, d) => ZG.Field.join(s, d.id);
  A.fieldLeave = (s, d) => (ZG.App.confirm('fl' + d.id, 'End this partnership?') ? ZG.Field.leave(s, d.id) : null);
  A.fieldProj = (s, d) => ZG.Field.start(s, d.id, d.type);
  A.fieldRound = (s) => {
    s.field.roundUp = !s.field.roundUp;
    return { ok: true, msg: s.field.roundUp ? 'Round Up for Wildlife is on at every register.' : 'Round-up turned off.' };
  };
  A.reqForSp = (s, d) => {
    const sp = ZG.SPECIES[d.sp];
    const h = s.habitats.find((x) => !x.construction && sp.biomes.includes(x.biome) && !s.animals.some((a) => a.hab === x.id)) || s.habitats.find((x) => sp.biomes.includes(x.biome));
    P.ui.req = { hab: h ? h.id : null, sp: d.sp, m: 1, f: 1 };
    P.ui.tab = 'animals';
    P.ui.scrollTo = 'req-card';
    return h ? null : { ok: false, msg: `You need a ${sp.biomes.map((b) => ZG.BIOMES[b].name).join(' or ')} habitat first.` };
  };
  A.treat = (s, d) => ZG.Animals.treat(s, +d.aid, d.lvl);

  // Habitat fixes
  A.bumpPolicy = (s, d) => {
    const cur = s.policy[d.key];
    const v = d.to ? Math.max(cur, +d.to) : Math.round(cur * +d.f);
    s.policy[d.key] = v;
    return { ok: true, msg: `${d.key === 'maintenance' ? 'Maintenance' : 'Enrichment'} budget set to ${$(v)}/yr.` };
  };
  A.moveAnimal = (s, d) => ZG.AZA.move(s, +d.aid, +d.hab);
  A.moveSpecies = (s, d) => {
    const list = s.animals.filter((a) => a.hab === +d.from && a.sp === d.sp);
    for (const a of list) ZG.AZA.move(s, a.id, +d.hab);
    return { ok: true, msg: `Moved ${list.length} ${ZG.SPECIES[d.sp].name}${list.length > 1 ? 's' : ''} to ${s.habitatsById[+d.hab].name}.` };
  };
  A.relandscape = (s, d) => ZG.Habitats.relandscape(s, +d.hab, d.biome);
  A.requestAnimal = (s, d) => ZG.AZA.requestAnimal(s, d.sp, +d.hab, d.sex);
})((globalThis.ZG = globalThis.ZG || {}));
