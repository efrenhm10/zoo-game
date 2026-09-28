// Character creation (identity → education → career) and zoo selection.
(function (ZG) {
  const U = ZG.U;
  const esc = U.esc;
  const C = (ZG.Creator = {});
  const D = () => ZG.DIRECTOR;

  const st = {
    step: 0,
    d: { name: '', age: 38, look: { skin: '#d4a17a', hair: '#4a2f1f', hairStyle: 'short', outfit: '#2f6b3f', hat: 'safari' }, school: 'UC Davis', field: 'zoology', level: 'ba', career: null },
    zoo: null,
    profiles: null,
  };
  let root;

  C.open = function (el) {
    root = el;
    st.step = 0;
    render();
  };

  function render() {
    const steps = [title, identity, education, career, zooPick];
    root.innerHTML = `<div class="creator">${steps[st.step]()}</div>`;
    bind();
    if (st.step === 1) drawPreview();
  }

  function stepper() {
    const names = ['You', 'Education', 'Career', 'Zoo'];
    return `<div class="stepper">${names.map((n, i) => `<span class="${i + 1 === st.step ? 'cur' : i + 1 < st.step ? 'done' : ''}">${i + 1}. ${n}</span>`).join('')}</div>`;
  }

  function title() {
    const has = ZG.App.hasSave();
    return `<div class="title-screen">
      <div class="logo">🦒🐘🦍</div>
      <h1>Zoo Director</h1>
      <p class="tag">Run a real American zoo — the budgets, the politics, the animals, the disasters.</p>
      <div class="big-actions">
        <button class="btn primary big" data-c="next">Start a new career</button>
        ${has ? '<button class="btn big" data-c="continue">Continue saved game</button>' : ''}
      </div>
      <p class="sub">Choose from Honolulu, San Diego, the Smithsonian's National Zoo, Houston, and Cheyenne Mountain.</p>
    </div>`;
  }

  function swatches(key, list, isColor) {
    return `<div class="swatches">${list
      .map((v) => (isColor ? `<button class="sw ${st.d.look[key] === v ? 'on' : ''}" style="background:${v}" data-look="${key}" data-v="${v}" title="${v}"></button>` : `<button class="chip ${st.d.look[key] === v ? 'on' : ''}" data-look="${key}" data-v="${v}">${v}</button>`))
      .join('')}</div>`;
  }

  function identity() {
    const L = D().looks;
    return `${stepper()}<h2>Who are you?</h2>
      <div class="two">
        <div>
          <label>Name <input id="c-name" value="${esc(st.d.name)}" placeholder="e.g. Jordan Kealoha" maxlength="32"></label>
          <label>Age: <b id="c-age-l">${st.d.age}</b><input id="c-age" type="range" min="22" max="70" value="${st.d.age}"></label>
          <p class="sub">Age decides which careers you could realistically have had — and how much experience you bring.</p>
          <h4>Skin tone</h4>${swatches('skin', L.skin, true)}
          <h4>Hair color</h4>${swatches('hair', L.hair, true)}
          <h4>Hair style</h4>${swatches('hairStyle', L.hairStyle)}
          <h4>Outfit</h4>${swatches('outfit', L.outfit, true)}
          <h4>Hat</h4>${swatches('hat', L.hat)}
        </div>
        <div class="preview"><canvas id="c-prev" width="220" height="260"></canvas><p id="c-prev-name">${esc(st.d.name || 'Your Name')}</p></div>
      </div>
      <div class="nav"><button class="btn" data-c="back">Back</button><button class="btn primary" data-c="next" ${st.d.name.trim() ? '' : 'disabled'} id="c-next">Next: Education →</button></div>`;
  }

  function drawPreview() {
    const c = document.getElementById('c-prev');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const g = ctx.createRadialGradient(110, 150, 10, 110, 150, 130);
    g.addColorStop(0, '#cfe6b8');
    g.addColorStop(1, '#8fb870');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ZG.Render.emoji(ctx, '🌳', 40, 60, 40);
    ZG.Render.emoji(ctx, '🦒', 180, 70, 44);
    ZG.drawAvatar(ctx, 110, 175, 5, st.d.look, 1, 0);
  }

  function education() {
    const d = st.d;
    const lvl = D().levels.find((l) => l.id === d.level);
    return `${stepper()}<h2>Education</h2>
      <label>School <select id="c-school">${D().schools.map((s) => `<option ${s === d.school ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <h4>Field of study</h4>
      <div class="cards">${D().fields.map((f) => `<button class="card pick ${f.id === d.field ? 'on' : ''}" data-field="${f.id}"><b>${f.name}</b><small>${f.text}</small></button>`).join('')}</div>
      <h4>Highest degree</h4>
      <div class="cards small">${D().levels.map((l) => `<button class="card pick ${l.id === d.level ? 'on' : ''}" data-level="${l.id}"><b>${l.name}</b><small>${l.text} (field bonus ×${l.mult})</small></button>`).join('')}</div>
      <p class="sub">Your degree field's bonus is multiplied by your degree level. ${lvl.board ? `Boards react to credentials: ${lvl.board > 0 ? '+' : ''}${lvl.board} starting confidence.` : ''}</p>
      <div class="nav"><button class="btn" data-c="back">← Back</button><button class="btn primary" data-c="next">Next: Career →</button></div>`;
  }

  function career() {
    const d = st.d;
    const list = D().careers.filter((c) => d.age >= c.minAge && (!c.maxAge || d.age <= c.maxAge));
    if (!list.find((c) => c.id === d.career)) d.career = list[0].id;
    const locked = D().careers.filter((c) => !list.includes(c));
    return `${stepper()}<h2>Your background</h2><p class="sub">At ${d.age}, these are the careers you could have had. Experience beyond the minimum age strengthens your bonuses.</p>
      <div class="cards">${list
        .map((c) => {
          const yrs = Math.max(0, Math.min(25, d.age - c.minAge));
          return `<button class="card pick career ${c.id === d.career ? 'on' : ''}" data-career="${c.id}"><b>${c.name}</b> <small class="yrs">${yrs ? `~${yrs} yrs experience` : 'entry level'}</small><small>${c.desc}</small>
          <small class="good">+ ${c.strengths.join(' · ')}</small><small class="bad">− ${c.weaknesses.join(' · ')}</small></button>`;
        })
        .join('')}</div>
      ${locked.length ? `<p class="sub">Locked at your age: ${locked.map((c) => `${c.name} (${c.maxAge && d.age > c.maxAge ? `≤${c.maxAge}` : `${c.minAge}+`})`).join(', ')}</p>` : ''}
      <h4>Your resulting profile</h4>${modsTable(ZG.buildDirectorMods(d))}
      <div class="nav"><button class="btn" data-c="back">← Back</button><button class="btn primary" data-c="next">Next: Choose your zoo →</button></div>`;
  }

  const MOD_NAMES = { welfare: 'Animal welfare', vet: 'Veterinary care', fundraising: 'Fundraising', sponsors: 'Sponsorships', politics: 'Politics', construction: 'Construction cost', maintenance: 'Maintenance', guest: 'Guest experience', marketing: 'Marketing', aza: 'AZA credibility', morale: 'Staff morale', board: 'Board confidence', crisis: 'Disaster damage', media: 'Media & PR', finance: 'Overhead cost' };
  const LOWER_BETTER = ['construction', 'crisis', 'finance'];
  function modsTable(m) {
    const items = [];
    for (const k in m) {
      const mult = ['vet', 'fundraising', 'sponsors', 'construction', 'maintenance', 'marketing', 'crisis', 'media', 'finance'].includes(k);
      const v = m[k];
      if (mult ? Math.abs(v - 1) < 0.005 : Math.abs(v) < 0.5) continue;
      const good = mult ? (LOWER_BETTER.includes(k) ? v < 1 : v > 1) : v > 0;
      const txt = mult ? `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%` : `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v))}`;
      items.push(`<span class="mod ${good ? 'good' : 'bad'}">${MOD_NAMES[k]} ${txt}</span>`);
    }
    return `<div class="mods">${items.join('') || '<span class="sub">Balanced — no strong strengths or weaknesses.</span>'}</div>`;
  }

  function profiles() {
    if (st.profiles) return st.profiles;
    st.profiles = {};
    const neutral = { name: 'X', age: 40, look: st.d.look, school: '', field: 'zoology', level: 'none', career: 'grad' };
    for (const id of ZG.ZOO_ORDER) {
      const s = ZG.Sim.newGame(neutral, id, 99);
      const Z = ZG.ZOOS[id];
      const memberShare = Math.min(0.6, (Z.members * Z.memberVisits) / Z.baseAttendance);
      const adm = Z.priceLocked ? 0 : Z.baseAttendance * (1 - memberShare) * Z.policy.admission * Z.yieldAdm;
      const mix = {
        Admissions: adm,
        'Food & retail': Z.baseAttendance * Z.perCap * (1 - Z.cogs),
        Memberships: Z.members * Z.policy.memberPrice * 0.75,
        Government: Z.appropriation,
        Donations: Z.donorBase,
        'Parking & encounters': Z.baseAttendance * (Z.parkingPerCap + Z.giraffeFeed),
      };
      s.stats.species = new Set(s.animals.map((a) => a.sp)).size;
      st.profiles[id] = { s, mix, budget: ZG.Econ.annualBudget(s) };
    }
    return st.profiles;
  }

  function fitNotes(id) {
    const m = ZG.buildDirectorMods(st.d);
    const Z = ZG.ZOOS[id];
    const out = [];
    const pub = ['city', 'federal', 'contract'].includes(Z.governance);
    if (pub && m.politics >= 8) out.push(['good', 'Your political skills matter a lot here.']);
    if (pub && m.politics < 0) out.push(['bad', 'Government relations are central here — a weak spot for you.']);
    if (Z.governance === 'private' && m.fundraising > 1.05) out.push(['good', 'With no tax support, your fundraising chops shine.']);
    if (Z.governance === 'private' && m.fundraising < 0.95) out.push(['bad', 'No tax support + weak fundraising is a dangerous combo.']);
    if (Z.infraCond[0] < 40 && (m.maintenance > 1.05 || m.construction < 0.95)) out.push(['good', 'Your facilities background fits this crumbling infrastructure.']);
    if (Z.inspectionInMonths < 20 && m.aza >= 5) out.push(['good', 'Your AZA credibility helps with the looming inspection.']);
    if (Z.inspectionInMonths < 20 && m.aza < 0) out.push(['bad', 'An AZA inspection is coming soon and your credibility is low.']);
    if (Object.keys(Z.hazards).length >= 4 && m.crisis < 0.9) out.push(['good', 'Disaster-prone — your crisis experience will be tested.']);
    if (id === 'sandiego' && m.media > 1.1) out.push(['good', 'Media savvy helps manage a global spotlight.']);
    if (id === 'sandiego' && m.aza < 0) out.push(['bad', 'The world\'s top conservation zoo will expect scientific credibility.']);
    return out;
  }

  function zooPick() {
    const P = profiles();
    const cards = ZG.ZOO_ORDER.map((id) => {
      const Z = ZG.ZOOS[id];
      return `<button class="card pick zoo ${st.zoo === id ? 'on' : ''}" data-zoo="${id}"><span class="zemo">${Z.emoji}</span><b>${Z.name}</b><small>${Z.city}</small><small class="diff">${Z.difficulty}</small></button>`;
    }).join('');
    let detail = '<p class="sub">Select a zoo to see its full profile.</p>';
    if (st.zoo) {
      const Z = ZG.ZOOS[st.zoo];
      const p = P[st.zoo];
      const s = p.s;
      const tot = Object.values(p.mix).reduce((a, b) => a + b, 0);
      const mixRows = Object.entries(p.mix)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<div class="mixrow"><span>${k}</span><div class="bar"><i class="good" style="width:${(v / tot) * 100}%"></i></div><b>${Math.round((v / tot) * 100)}%</b></div>`)
        .join('');
      const hz = { hurricane: '🌀 Hurricanes', tsunami: '🌊 Tsunamis', flood: '🌧️ Floods', heatwave: '🥵 Heat waves', wildfire: '🔥 Wildfire', blizzard: '❄️ Blizzards', freeze: '🥶 Grid-failing freezes', earthquake: '🫨 Earthquakes', hail: '🧊 Hail', drought: '🏜️ Drought', derecho: '🌪️ Windstorms' };
      const stars = s.animals.filter((a) => a.star).map((a) => `${ZG.SPECIES[a.sp].emoji} ${a.name}`).join(', ');
      const fit = fitNotes(st.zoo);
      detail = `<div class="zoo-profile">
        <h2>${Z.emoji} ${Z.name}</h2><p class="tagline">${Z.tagline}</p>
        <div class="kpis">
          <div><small>Annual attendance</small><b>${U.num(Z.baseAttendance)}</b></div>
          <div><small>Operating budget</small><b>${U.money(p.budget)}</b></div>
          <div><small>Collection</small><b>${Z.collection}</b></div>
          <div><small>Signature animals (modeled)</small><b>${s.animals.length} animals, ${s.stats.species} species</b></div>
          <div><small>Staff</small><b>${U.num(ZG.Staff.total(s))} FTE</b></div>
          <div><small>Member households</small><b>${U.num(Z.members)}</b></div>
          <div><small>Adult admission</small><b>${Z.priceLocked ? 'FREE' : '$' + Z.policy.admission}</b></div>
          <div><small>Public funding</small><b>${Z.appropriation ? U.money(Z.appropriation) + '/yr' : 'None'}</b></div>
          <div><small>Deferred maintenance</small><b class="bad">${U.money(s.stats.backlogStart)}</b></div>
          <div><small>Next AZA inspection</small><b>${Z.inspectionInMonths} months</b></div>
          <div><small>Founded · size</small><b>${Z.founded} · ${Z.acres} acres</b></div>
          <div><small>Difficulty</small><b>${Z.difficulty}</b></div>
        </div>
        <p><b>Governance:</b> ${Z.govName}. You answer to the <b>${Z.bossName}</b>.</p>
        <p>${Z.blurb}</p>
        <div class="two"><div><h4 class="good">Strengths</h4><ul>${Z.strengths.map((x) => `<li>${x}</li>`).join('')}</ul></div>
        <div><h4 class="bad">Weaknesses</h4><ul>${Z.weaknesses.map((x) => `<li>${x}</li>`).join('')}</ul></div></div>
        <div class="two"><div><h4>Where the money comes from (est.)</h4>${mixRows}</div>
        <div><h4>Natural hazards</h4><p>${Object.keys(Z.hazards).map((k) => hz[k]).join(' · ')}${Z.governance === 'federal' ? ' · 🚫 Government shutdowns' : ''}</p>
        ${stars ? `<h4>Beloved residents</h4><p>${stars}</p>` : ''}
        <h4>Your 5-year goals</h4><ul>${Z.objectives.map((o) => `<li>${o.text}</li>`).join('')}</ul></div></div>
        ${fit.length ? `<h4>How you fit</h4><ul>${fit.map(([c, t]) => `<li class="${c}">${t}</li>`).join('')}</ul>` : ''}
      </div>`;
    }
    return `${stepper()}<h2>Choose your zoo</h2><div class="cards zoos">${cards}</div>${detail}
      <div class="nav"><button class="btn" data-c="back">← Back</button><button class="btn primary big" data-c="start" ${st.zoo ? '' : 'disabled'}>Accept the job offer ${st.zoo ? 'at ' + ZG.ZOOS[st.zoo].name : ''} →</button></div>`;
  }

  function bind() {
    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.c === 'next') st.step++;
      else if (d.c === 'back') st.step = Math.max(0, st.step - 1);
      else if (d.c === 'continue') return ZG.App.loadGame();
      else if (d.c === 'start') {
        const seed = (Math.random() * 2 ** 31) | 0;
        const s = ZG.Sim.newGame(Object.assign({}, st.d, { name: st.d.name.trim() }), st.zoo, seed);
        return ZG.App.start(s);
      } else if (d.look) st.d.look[d.look] = d.v;
      else if (d.field) st.d.field = d.field;
      else if (d.level) st.d.level = d.level;
      else if (d.career) st.d.career = d.career;
      else if (d.zoo) st.zoo = d.zoo;
      else return;
      render();
      if (d.zoo) root.querySelector('.zoo-profile') && root.querySelector('.zoo-profile').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    const name = document.getElementById('c-name');
    if (name) {
      name.oninput = () => {
        st.d.name = name.value;
        document.getElementById('c-next').disabled = !name.value.trim();
        document.getElementById('c-prev-name').textContent = name.value || 'Your Name';
      };
      name.focus();
    }
    const age = document.getElementById('c-age');
    if (age)
      age.oninput = () => {
        st.d.age = +age.value;
        document.getElementById('c-age-l').textContent = age.value;
      };
    const school = document.getElementById('c-school');
    if (school) school.onchange = () => (st.d.school = school.value);
  }
})((globalThis.ZG = globalThis.ZG || {}));
