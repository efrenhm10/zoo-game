// App shell: screens, game loop, top bar, sidebar, modals, input, walk mode, save/load.
(function (ZG) {
  const U = ZG.U;
  const esc = U.esc;
  const App = (ZG.App = {});
  const SAVE_KEY = 'zoodirector_save_v1';
  const SPEEDS = [0, 1, 3, 8, 25]; // multiples of 1 day per 2.5 real seconds
  const DAY_SECONDS = 2.5;

  let s = null;
  let speedIdx = 1;
  let acc = 0;
  let last = 0;
  let panelDirty = true;
  let lastPanel = 0;
  let modalOpen = false;
  let pendingResult = null;
  const el = {};

  App.getState = () => s;
  App.showModal = function (html) {
    modalOpen = true;
    el['modal-root'].innerHTML = html;
  };
  App.hideModal = () => closeModal();

  App.hasSave = () => {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return false;
    }
  };

  // Short description of the saved game for the title screen.
  App.saveInfo = function () {
    try {
      const str = localStorage.getItem(SAVE_KEY);
      if (!str) return null;
      const s = JSON.parse(str);
      const Z = ZG.ZOOS[s.zooId];
      return `${Z ? Z.name : 'Your zoo'} · ${U.fmtDate(s.day)} · Director ${s.director.name}`;
    } catch (e) {
      return null;
    }
  };

  App.boot = function () {
    for (const id of ['start-screen', 'game', 'map', 'overlay', 'panel', 'window', 'wintitle', 'toolbar', 'statsbar', 'controls', 'clock', 'badge', 'ticker', 'modal-root', 'tooltip', 'toast', 'walkhud'])
      el[id] = document.getElementById(id);
    if (!ZG.Render.supported()) {
      el['start-screen'].innerHTML = '<div class="creator"><div class="title-screen"><h1>Zoo Director</h1><p>This game needs WebGL (3D graphics). Please use a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.</p></div></div>';
      return;
    }
    ZG.Render.init(el.map, el.overlay);
    ZG.Render.bindInput(() => s, {
      hover: (p, x, y) => tooltip(p, x, y),
      select: (p) => {
        ZG.Actions.select(s, { plot: p.id });
        openWindow('habitats');
      },
      observe: (p) => openObserve(p),
    });
    ZG.Creator.open(el['start-screen']);
    bindInput();
    requestAnimationFrame(loop);
  };

  App.start = function (state) {
    s = state;
    ZG.Render.reset();
    el['start-screen'].classList.add('hidden');
    el.game.classList.remove('hidden');
    ZG.Render.resize();
    speedIdx = 1;
    openWindow('overview');
    App.save(true);
  };

  App.loadGame = function () {
    try {
      const str = localStorage.getItem(SAVE_KEY);
      if (!str) return;
      App.start(ZG.Sim.deserialize(str));
      toast('Game loaded.');
    } catch (e) {
      toast('Could not load the save: ' + e.message, true);
    }
  };
  App.save = function (quiet) {
    if (!s) return;
    try {
      localStorage.setItem(SAVE_KEY, ZG.Sim.serialize(s));
      if (!quiet) toast('💾 Game saved.');
    } catch (e) {
      if (!quiet) toast('Could not save (storage unavailable).');
    }
  };

  // ------------------------------------------------------------------
  function loop(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0);
    last = ts;
    if (s) {
      if (!modalOpen && ZG.Events.pending(s)) openEventModal();
      const speed = SPEEDS[speedIdx];
      if (!modalOpen && speed > 0) {
        acc += (dt * speed) / DAY_SECONDS;
        let n = 0;
        while (acc >= 1 && n < 8) {
          acc -= 1;
          n++;
          const before = U.dateOf(s.day).m;
          ZG.Sim.tickDay(s);
          if (U.dateOf(s.day).m !== before) {
            App.save(true);
            panelDirty = true;
          }
          if (ZG.Events.pending(s)) {
            acc = 0;
            break;
          }
        }
        if (n) panelDirty = true;
      }
      ZG.Render.frame(s, modalOpen ? 0 : dt);
      renderTopbar();
      if (ts - lastPanel > 700 && panelDirty) renderPanel();
      renderWalkHud();
    }
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------
  const WEATHER_ICON = { sunny: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️', snow: '🌨️', heat: '🥵', smoke: '🌫️' };
  const stars = (v) => {
    const n = Math.round((v / 100) * 10) / 2;
    let out = '';
    for (let i = 1; i <= 5; i++) out += n >= i ? '★' : n >= i - 0.5 ? '⯪' : '☆';
    return out;
  };
  function setHTML(e, html) {
    if (e._last !== html) {
      e.innerHTML = html;
      e._last = html;
    }
  }
  function renderTopbar() {
    const Z = ZG.zoo(s);
    const t = U.dateOf(s.day);
    const alerts = ZG.Panels.alerts(s).length;
    setHTML(el.badge, `<span class="zemo">${Z.emoji}</span><div><b>${esc(Z.name)}</b><small>Director ${esc(s.director.name)}</small></div>${alerts ? `<button class="alert-btn" data-open="overview" title="Needs attention">⚠️ ${alerts}</button>` : ''}`);
    const w = ZG.Animals.avgWelfare(s);
    setHTML(el.statsbar, `
      <span title="Operating cash"><i>💵</i><b class="${s.cash < 0 ? 'bad' : ''}">${U.money(s.cash)}</b></span>
      <span title="Capital fund (restricted)"><i>🏗️</i><b>${U.money(s.capital)}</b></span>
      <span title="Guests today"><i>👥</i><b>${U.num(s.today.guests)}</b></span>
      <span title="Public reputation ${Math.round(s.rep)}/100" class="stars">${stars(s.rep)}</span>
      <span title="Animal welfare"><i>🐾</i><b class="${cl(w)}">${Math.round(w)}</b></span>
      <span title="Guest satisfaction"><i>🙂</i><b class="${cl(s.satisfaction)}">${Math.round(s.satisfaction)}</b></span>
      <span title="AZA standing"><i>🧬</i><b class="${cl(s.aza)}">${Math.round(s.aza)}</b></span>
      <span title="Your boss's confidence in you"><i>💼</i><b class="${cl(s.board)}">${Math.round(s.board)}</b></span>`);
    setHTML(el.clock, `<span class="wx" title="Weather">${WEATHER_ICON[s.today.weather] || ''} ${s.today.temp}°F</span>
      <span class="date">${U.DOW[t.dow]} ${U.fmtDate(s.day)}</span>
      <span class="speeds">${['⏸', '▶', '▶▶', '▶▶▶', '⏩'].map((l, i) => `<button class="spd ${i === speedIdx ? 'on' : ''}" data-speed="${i}" title="${i ? SPEEDS[i] + '× speed' : 'Pause'} (key ${i === 0 ? 'Space' : i})">${l}</button>`).join('')}</span>`);
    setHTML(el.controls, `<button class="ctl walk ${ZG.Render.state.walk ? 'on' : ''}" data-top="walk" title="Walk the grounds (Tab)">🚶 ${ZG.Render.state.walk ? 'Manage' : 'Walk'}</button>
      <button class="ctl" data-top="help" title="How to play">?</button><button class="ctl" data-top="save" title="Save">💾</button><button class="ctl" data-top="menu" title="Main menu">☰</button>`);
    const n = s.news[0];
    setHTML(el.ticker, n ? `<span class="${n.kind}">${esc(n.text)}</span>` : '');
  }
  const cl = (v) => (v >= 70 ? 'good' : v >= 50 ? 'warn' : 'bad');

  function renderTabs() {
    const cur = winOpen ? ZG.Panels.ui.tab : null;
    el.toolbar.innerHTML = ZG.Panels.TABS.map((t) => `<button class="tool ${cur === t.id ? 'on' : ''}" data-open="${t.id}" title="${t.name}"><span>${t.icon}</span>${t.name}</button>`).join('');
  }
  let winOpen = false;
  function openWindow(tab) {
    if (winOpen && ZG.Panels.ui.tab === tab && tab !== 'habitats') return closeWindow();
    ZG.Panels.ui.tab = tab;
    winOpen = true;
    el.window.classList.remove('hidden');
    const t = ZG.Panels.TABS.find((x) => x.id === tab);
    el.wintitle.textContent = `${t.icon} ${t.name}`;
    el.panel.scrollTop = 0;
    renderTabs();
    renderPanel(true);
  }
  function closeWindow() {
    winOpen = false;
    el.window.classList.add('hidden');
    renderTabs();
  }
  function renderPanel(force) {
    if (!s || !winOpen) return;
    const active = document.activeElement;
    if (!force && active && el.panel.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) return;
    const scroll = el.panel.scrollTop;
    el.panel.innerHTML = ZG.Panels.render(s);
    el.panel.scrollTop = scroll;
    lastPanel = performance.now();
    panelDirty = false;
  }
  App.refresh = function () {
    const t = ZG.Panels.TABS.find((x) => x.id === ZG.Panels.ui.tab);
    if (winOpen && t) el.wintitle.textContent = `${t.icon} ${t.name}`;
    renderTabs();
    renderPanel(true);
    if (ZG.Panels.ui.scrollTo) {
      const target = el.panel.querySelector('#' + ZG.Panels.ui.scrollTo);
      ZG.Panels.ui.scrollTo = null;
      if (target) el.panel.scrollTop = target.offsetTop - 10;
    }
  };

  // ------------------------------------------------------------------
  function openEventModal() {
    const v = ZG.Events.view(s);
    if (!v) return;
    modalOpen = true;
    const Z = ZG.zoo(s);
    el['modal-root'].innerHTML = `<div class="modal-back"><div class="modal event ${v.cat || ''}">
      <div class="m-head"><span class="m-icon">${v.icon || '📌'}</span><div><small>${U.fmtDate(s.day)} · ${esc(Z.name)}</small><h2>${v.title}</h2></div><button class="m-menu" data-top="menu" title="Save and return to the main menu">☰ Menu</button></div>
      <div class="m-body">${v.text}</div>
      <div class="m-choices">${v.choices
        .map((c, i) => `<button class="choice" data-choice="${i}" ${c.disabled ? `disabled title="${esc(c.why || '')}"` : ''}><b>${c.label}</b>${c.detail ? `<small>${c.detail}</small>` : ''}${c.cost ? `<span class="cost">${U.money(c.cost)}${c.capital ? ' (capital)' : ''}</span>` : ''}</button>`)
        .join('')}</div></div></div>`;
  }
  function chooseEvent(i) {
    const r = ZG.Events.choose(s, i);
    panelDirty = true;
    if (r && r.result) {
      el['modal-root'].innerHTML = `<div class="modal-back"><div class="modal result"><div class="m-head"><span class="m-icon">${r.icon || '📌'}</span><h2>${r.title}</h2></div><div class="m-body"><p><i>You chose: ${esc(r.choice)}</i></p><p>${esc(r.result)}</p></div><div class="m-choices"><button class="choice" data-close="1"><b>Continue</b></button></div></div></div>`;
    } else closeModal();
  }
  function showResult(m) {
    modalOpen = true;
    el['modal-root'].innerHTML = `<div class="modal-back"><div class="modal result"><div class="m-head"><span class="m-icon">${m.icon || '📌'}</span><h2>${esc(m.title)}</h2></div><div class="m-body">${m.html}</div><div class="m-choices"><button class="choice" data-close="1"><b>Continue</b></button></div></div></div>`;
  }
  App.showResult = showResult;
  function closeModal() {
    el['modal-root'].innerHTML = '';
    modalOpen = false;
  }

  // Observation modal from walk mode
  function openObserve(plot) {
    if (!plot) return;
    const h = plot.hab ? s.habitatsById[plot.hab] : null;
    let body;
    let title;
    if (plot.kind === 'vet') {
      title = '🏥 Animal Hospital';
      const q = s.animals.filter((a) => a.loc === 'quarantine');
      const sick = s.animals.filter((a) => a.sick);
      body = `<p>The vet team (${s.staff.vets.n} people) is ${ZG.Staff.ratio(s, 'vets') < 0.9 ? 'visibly stretched thin' : 'busy but on top of things'}.</p>
        <p><b>In quarantine:</b> ${q.map((a) => `${ZG.SPECIES[a.sp].emoji} ${esc(a.name)} (${a.qDays} days left)`).join(', ') || 'nobody right now'}</p>
        <p><b>Current patients:</b><br>${sick.map((a) => `${ZG.SPECIES[a.sp].emoji} <b>${esc(a.name)}</b> the ${ZG.SPECIES[a.sp].name}: ${esc(a.sick.name)} (${['mild', 'moderate', 'serious'][a.sick.sev - 1]}, ${a.sick.plan === 'aggressive' ? 'specialist care' : a.sick.treated ? 'being treated' : 'monitoring only'}, ~${a.sick.days} days to go)`).join('<br>') || 'none'}</p>
        <button class="btn" data-manage="${plot.id}">Open the patient chart</button>`;
    } else if (plot.kind === 'cafe') {
      title = '🍔 Food Court';
      body = `<p>${ZG.Staff.ratio(s, 'guest') < 0.85 ? 'The lines are long and the trash cans are overflowing.' : 'Families are eating lunch at the umbrella tables.'}</p><p>Guest satisfaction today: <b>${Math.round(s.satisfaction)}</b>.</p>`;
    } else if (!h) {
      title = '🪧 Available lot';
      body = `<p>${U.num(plot.area)} m² of open ground. You can imagine what could go here.</p><button class="btn primary" data-plan="${plot.id}">Plan a habitat here</button>`;
    } else if (h.construction) {
      title = `🏗️ ${esc(h.name)}`;
      body = `<p>Hard hats, cranes and the smell of fresh concrete. About ${Math.round((1 - h.construction.days / h.construction.total) * 100)}% complete.</p>`;
    } else {
      title = `${esc(h.sponsor ? h.sponsor + ' ' + h.name : h.name)}`;
      const an = s.animals.filter((a) => a.hab === h.id);
      const cards = an
        .map((a) => {
          const sp = ZG.SPECIES[a.sp];
          const notes = [];
          if (a.star) notes.push('⭐ Crowd favorite');
          if (a.age < 365) notes.push('🍼 Baby');
          if (a.preg) notes.push('🤰 Expecting');
          if (a.sick) notes.push('🤒 ' + a.sick.name);
          if (a.loc === 'quarantine') notes.push('In quarantine at the hospital');
          if (a.welfare < 55) notes.push('Keepers are worried about stress behaviors');
          else if (a.welfare > 82) notes.push('Thriving');
          return `<div class="acard">${ZG.Portraits.img(a.sp, 'portrait md')}<div><b>${esc(a.name)}</b> ${U.sexTag(a.sex)} <small>${sp.name}, ${U.ageStr(a.age)}</small><br><i>${a.loc === 'hab' ? 'Currently ' + esc(a.mood) : 'Not on exhibit'}</i><br><small>Welfare ${Math.round(a.welfare)} · Health ${Math.round(a.health)} · ${sp.iucn} ${sp.program === 'SSP' ? '· SSP' : ''}</small>${notes.length ? `<br><small>${notes.join(' · ')}</small>` : ''}</div></div>`;
        })
        .join('');
      const f = s._hf && s._hf[h.id];
      const keeperNote = !an.length
        ? 'The exhibit is empty. Guests keep asking where the animals are.'
        : h.condition < 45
          ? 'A keeper points out rotting logs, a cracked moat wall and a leaky pool: "We\'ve put in work orders for years."'
          : f && f.spaceRatio < 1
            ? '"They need more room," the lead keeper tells you. "We\'re seeing squabbles."'
            : f && f.care < 70
              ? '"We\'re short-handed — enrichment keeps getting skipped," a keeper admits.'
              : '"They\'re doing great," says the keeper, tossing a scatter-feed.';
      body = `<p class="sub">${ZG.BIOMES[h.biome].name} · condition ${Math.round(h.condition)} · theming ${Math.round(h.theming)}</p><p>🧑‍🌾 ${keeperNote}</p><div class="acards">${cards || ''}</div><p class="sub">💭 A guest nearby: “${esc(ZG.Render.guestThought(s, plot.id))}”</p><button class="btn" data-manage="${plot.id}">Manage this habitat</button>`;
    }
    modalOpen = true;
    el['modal-root'].innerHTML = `<div class="modal-back"><div class="modal observe"><div class="m-head"><span class="m-icon">👀</span><h2>${title}</h2></div><div class="m-body">${body}</div><div class="m-choices"><button class="choice" data-close="1"><b>Keep walking</b></button></div></div></div>`;
  }

  function openHelp() {
    modalOpen = true;
    el['modal-root'].innerHTML = `<div class="modal-back"><div class="modal observe"><div class="m-head"><span class="m-icon">❓</span><h2>How to run a zoo</h2></div><div class="m-body">
      <p><b>Time.</b> ⏸ ▶ ▶▶ ▶▶▶ ⏩ (or <kbd>Space</kbd>, <kbd>1</kbd>–<kbd>4</kbd>). The game pauses automatically when something needs a decision.</p>
      <p><b>Walk the grounds.</b> Press <kbd>Tab</kbd> or 🚶 Walk. Move with <kbd>WASD</kbd>/arrows (hold <kbd>Shift</kbd> to jog) or click where to go. Stand next to a habitat and press <kbd>E</kbd> to observe the animals, hear from keepers and overhear guests.</p>
      <p><b>The map.</b> Drag to pan, scroll to zoom, click a habitat or an 🪧 Available lot to manage or build. Fence color shows condition (brown good → red failing).</p>
      <p><b>Money.</b> Operating cash pays daily bills. The <i>capital fund</i> holds restricted money (grants, campaign gifts, capital appropriations) and pays for construction and repairs first. You can borrow on a credit line — at interest.</p>
      <p><b>Animals.</b> Welfare comes from space, social group size, habitat quality, climate and keeper care. Animals are on contraception by default — follow the SSP's Breeding & Transfer Plans (🧬 tab) to breed the right pairs. Unplanned or inbred births hurt your AZA standing.</p>
      <p><b>Deferred maintenance.</b> Every system decays. Underfund maintenance and it fails — at emergency prices, at the worst moment.</p>
      <p><b>People.</b> Keep your boss confident (the Job meter). City and federal zoos live and die by budget votes; nonprofits by donors and members. Hiring takes time; layoffs hurt morale.</p>
      <p><b>Goals.</b> Five-year goals are on the Overview tab. Each December you get a graded annual review.</p>
      </div><div class="m-choices"><button class="choice" data-close="1"><b>Got it</b></button></div></div></div>`;
  }

  function renderWalkHud() {
    const R = ZG.Render.state;
    if (!R.walk) {
      if (el.walkhud.innerHTML) el.walkhud.innerHTML = '';
      return;
    }
    const p = ZG.Render.nearbyPlot(s);
    let label = '';
    if (p) {
      const h = p.hab ? s.habitatsById[p.hab] : null;
      const name = p.kind === 'vet' ? 'Animal Hospital' : p.kind === 'cafe' ? 'Food Court' : h ? h.name : 'Available lot';
      label = `<b>${esc(name)}</b> — press <kbd>E</kbd> to observe`;
    }
    const html = `<div class="hud">🚶 <kbd>WASD</kbd>/<kbd>arrows</kbd> to walk · <kbd>Shift</kbd> jog · click to walk there · <kbd>Tab</kbd> overview${label ? '<br>' + label : ''}</div>`;
    if (html !== el.walkhud._last) {
      el.walkhud.innerHTML = html;
      el.walkhud._last = html;
    }
  }

  function toast(msg, bad) {
    const t = el.toast;
    t.textContent = msg;
    t.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.className = ''), 3200);
  }
  App.toast = toast;

  // In-page confirmation: the first click warns, a second click within 4 s confirms.
  // (Browser confirm() dialogs are blocked in embedded viewers.)
  let pendingConfirm = null;
  App.confirm = function (key, msg) {
    const now = Date.now();
    if (pendingConfirm && pendingConfirm.key === key && now - pendingConfirm.at < 4000) {
      pendingConfirm = null;
      return true;
    }
    pendingConfirm = { key, at: now };
    toast(msg + ' Click again to confirm.', true);
    return false;
  };

  function setWalk(on) {
    ZG.Render.setWalk(s, on);
    if (on && speedIdx > 2) speedIdx = 1;
    if (on) closeWindow();
    document.body.classList.toggle('walking', on);
  }

  // ------------------------------------------------------------------
  function bindInput() {
    document.addEventListener('click', (e) => {
      if (!s) return;
      const t = e.target;
      const sp = t.closest('[data-speed]');
      if (sp) {
        speedIdx = +sp.dataset.speed;
        return;
      }
      const op = t.closest('[data-open]');
      if (op) {
        openWindow(op.dataset.open);
        return;
      }
      if (t.closest('[data-winclose]')) return closeWindow();
      const top = t.closest('[data-top]');
      if (top) {
        const a = top.dataset.top;
        if (a === 'walk') setWalk(!ZG.Render.state.walk);
        if (a === 'walk') return;
        if (a === 'save') App.save();
        if (a === 'help') openHelp();
        if (a === 'menu') {
          App.save(true);
          if (App.confirm('menu', 'Return to the main menu? Your game is saved.')) {
            closeModal();
            s = null;
            ZG.Render.reset();
            closeWindow();
            el.game.classList.add('hidden');
            el['start-screen'].classList.remove('hidden');
            ZG.Creator.open(el['start-screen']);
          }
        }
        return;
      }
      const ch = t.closest('[data-choice]');
      if (ch && !ch.disabled) return chooseEvent(+ch.dataset.choice);
      if (t.closest('[data-close]')) return closeModal();
      const man = t.closest('[data-manage]');
      if (man) {
        closeModal();
        ZG.Actions.select(s, { plot: man.dataset.manage });
        setWalk(false);
        openWindow('habitats');
        return;
      }
      const plan = t.closest('[data-plan]');
      if (plan) {
        closeModal();
        ZG.Actions.select(s, { plot: plan.dataset.plan });
        setWalk(false);
        openWindow('habitats');
        return;
      }
      const act = t.closest('[data-act]');
      if (act && el.panel.contains(act)) {
        const fn = ZG.Actions[act.dataset.act];
        if (!fn) return;
        const r = fn(s, act.dataset, act);
        if (r && r.modal) showResult(r.modal);
        else if (r && r.msg) toast(r.msg, !r.ok);
        if (act.dataset.act === 'select' && act.dataset.plot != null) ZG.Render.focusPlot(s, +act.dataset.plot);
        App.refresh();
      }
    });
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.policy) {
        const k = t.dataset.policy;
        const lbl = el.panel.querySelector(`[data-lbl="${k}"]`);
        const v = +t.value;
        if (lbl) lbl.textContent = ['admission', 'memberPrice', 'parkingFee'].includes(k) ? `$${v}` : U.money(v);
        const proj = el.panel.querySelector('#budget-proj');
        if (proj && s) proj.innerHTML = ZG.Panels.budgetProjection(s, { [k]: v });
      }
      if (t.dataset && t.dataset.build) {
        ZG.Panels.ui.build[t.dataset.build] = t.value;
        if (t.tagName === 'SELECT') renderPanel(true);
      }
    });
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (!s) return;
      if (t.dataset && t.dataset.policy) {
        const r = ZG.Actions.setPolicy(s, t.dataset.policy, +t.value);
        if (r && r.msg) toast(r.msg, !r.ok);
        t.blur();
        renderPanel(true);
      }
      if (t.dataset && t.dataset.move) {
        if (t.value) {
          const r = ZG.AZA.move(s, +t.dataset.move, +t.value);
          if (r && r.msg) toast(r.msg, !r.ok);
        }
        ZG.Panels.ui.moveFor = null;
        t.blur();
        renderPanel(true);
      }
      if (t.dataset && (t.dataset.acq || t.dataset.rechab)) t.blur();
      if (t.dataset && t.dataset.req) {
        const R = (ZG.Panels.ui.req = ZG.Panels.ui.req || {});
        R[t.dataset.req] = t.dataset.req === 'sp' ? t.value : +t.value;
        if (t.dataset.req === 'hab') R.sp = null;
        t.blur();
        renderPanel(true);
      }
      if (t.dataset && t.dataset.mtopic) {
        ZG.Panels.ui.mediaTopic = t.value;
        t.blur();
        renderPanel(true);
      }
    });

    const R = ZG.Render.state;
    window.addEventListener('keydown', (e) => {
      if (!s) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (document.activeElement && document.activeElement.id === 'rename-input' && (e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        const bt = el.panel.querySelector(e.key === 'Enter' ? '[data-act="renameSave"]' : '[data-act="renameCancel"]');
        if (bt) bt.click();
        return;
      }
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (modalOpen) {
        if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') {
          if (el['modal-root'].querySelector('.observe, .result') && e.key !== 'e' && e.key !== 'E' || el['modal-root'].querySelector('.observe')) closeModal();
        }
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.key === 'Tab') {
        e.preventDefault();
        setWalk(!R.walk);
        return;
      }
      if (R.walk && k === 'e') {
        openObserve(ZG.Render.nearbyPlot(s));
        return;
      }
      if (e.key === 'Escape' && winOpen) return closeWindow();
      if (['w', 'a', 's', 'd', 'q', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(k)) {
        R.keys[k] = true;
        e.preventDefault();
        return;
      }
      if (k === ' ') {
        e.preventDefault();
        speedIdx = speedIdx === 0 ? 1 : 0;
      }
      if (['1', '2', '3', '4'].includes(k)) speedIdx = +k;
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      R.keys[k] = false;
    });
    window.addEventListener('blur', () => (R.keys = {}));
  }

  function tooltip(p, x, y) {
    const t = el.tooltip;
    if (!p || ZG.Render.state.walk) {
      t.style.display = 'none';
      return;
    }
    let html;
    if (p.kind === 'vet') html = `<b>🏥 Animal Hospital</b><br>${s.animals.filter((a) => a.loc === 'quarantine').length} in quarantine`;
    else if (p.kind === 'cafe') html = '<b>🍔 Food Court</b>';
    else if (!p.hab) html = `<b>🪧 Available lot</b><br>${U.num(p.area)} m² — click to plan`;
    else {
      const h = s.habitatsById[p.hab];
      const an = s.animals.filter((a) => a.hab === h.id && a.loc === 'hab');
      const sps = [...new Set(an.map((a) => a.sp))].map((id) => `${ZG.SPECIES[id].emoji} ${ZG.SPECIES[id].name} ×${an.filter((a) => a.sp === id).length}`).join('<br>');
      const w = an.length ? an.reduce((a, b) => a + b.welfare, 0) / an.length : 0;
      html = `<b>${esc(h.name)}</b>${h.construction ? '<br>🏗️ under construction' : `<br>${sps || '<i>empty</i>'}<br>Condition ${Math.round(h.condition)}${an.length ? ` · Welfare ${Math.round(w)}` : ''}`}`;
    }
    t.innerHTML = html;
    t.style.display = 'block';
    t.style.left = x + 14 + 'px';
    t.style.top = y + 14 + 'px';
  }

  window.addEventListener('DOMContentLoaded', App.boot);
})((globalThis.ZG = globalThis.ZG || {}));
