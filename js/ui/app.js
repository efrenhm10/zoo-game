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

  App.hasSave = () => {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return false;
    }
  };

  App.boot = function () {
    for (const id of ['start-screen', 'game', 'map', 'panel', 'tabs', 'topbar', 'ticker', 'modal-root', 'tooltip', 'toast', 'walkhud'])
      el[id] = document.getElementById(id);
    ZG.Creator.open(el['start-screen']);
    ZG.Render.init(el.map);
    bindInput();
    requestAnimationFrame(loop);
  };

  App.start = function (state) {
    s = state;
    ZG.Render.reset();
    el['start-screen'].classList.add('hidden');
    el.game.classList.remove('hidden');
    ZG.Render.resize();
    ZG.Render.fitCamera();
    ZG.Panels.ui.tab = 'overview';
    speedIdx = 1;
    renderTabs();
    panelDirty = true;
    App.save(true);
  };

  App.loadGame = function () {
    try {
      const str = localStorage.getItem(SAVE_KEY);
      if (!str) return;
      App.start(ZG.Sim.deserialize(str));
      toast('Game loaded.');
    } catch (e) {
      alert('Could not load the save: ' + e.message);
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
  function renderTopbar() {
    const Z = ZG.zoo(s);
    const t = U.dateOf(s.day);
    const html = `<div class="tb-left"><b class="zname">${Z.emoji} ${esc(Z.name)}</b><span class="date">${U.DOW[t.dow]} ${U.fmtDate(s.day)}</span><span class="wx">${WEATHER_ICON[s.today.weather] || ''} ${s.today.temp}°F</span></div>
      <div class="tb-speed">${['⏸', '▶', '▶▶', '▶▶▶', '⏩'].map((l, i) => `<button class="spd ${i === speedIdx ? 'on' : ''}" data-speed="${i}" title="${i ? SPEEDS[i] + '× speed' : 'Pause'} (key ${i === 0 ? 'Space' : i})">${l}</button>`).join('')}</div>
      <div class="tb-stats">
        <span title="Operating cash"><small>Cash</small><b class="${s.cash < 0 ? 'bad' : ''}">${U.money(s.cash)}</b></span>
        <span title="Capital fund (restricted)"><small>Capital</small><b>${U.money(s.capital)}</b></span>
        <span title="Guests today"><small>Guests</small><b>${U.num(s.today.guests)}</b></span>
        <span title="Animal welfare"><small>Welfare</small><b class="${cl(ZG.Animals.avgWelfare(s))}">${Math.round(ZG.Animals.avgWelfare(s))}</b></span>
        <span title="Guest satisfaction"><small>Guests ☺</small><b class="${cl(s.satisfaction)}">${Math.round(s.satisfaction)}</b></span>
        <span title="AZA standing"><small>AZA</small><b class="${cl(s.aza)}">${Math.round(s.aza)}</b></span>
        <span title="Confidence of your boss"><small>Job</small><b class="${cl(s.board)}">${Math.round(s.board)}</b></span>
      </div>
      <div class="tb-right"><button class="btn walk ${ZG.Render.state.walk ? 'on' : ''}" data-top="walk" title="Walk the grounds (Tab)">🚶 ${ZG.Render.state.walk ? 'Overview' : 'Walk'}</button><button class="btn" data-top="help" title="How to play">❓</button><button class="btn" data-top="save" title="Save">💾</button><button class="btn" data-top="menu" title="Main menu">☰</button></div>`;
    if (html !== el.topbar._last) {
      el.topbar.innerHTML = html;
      el.topbar._last = html;
    }
    const n = s.news[0];
    const tk = n ? `<span class="${n.kind}">${esc(n.text)}</span>` : '';
    if (tk !== el.ticker._last) {
      el.ticker.innerHTML = tk;
      el.ticker._last = tk;
    }
  }
  const cl = (v) => (v >= 70 ? 'good' : v >= 50 ? 'warn' : 'bad');

  function renderTabs() {
    el.tabs.innerHTML = ZG.Panels.TABS.map((t) => `<button class="tab ${ZG.Panels.ui.tab === t.id ? 'on' : ''}" data-act="tab" data-tab="${t.id}" title="${t.name}">${t.icon}<span>${t.name}</span></button>`).join('');
  }
  function renderPanel(force) {
    if (!s) return;
    const active = document.activeElement;
    if (!force && active && el.panel.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) return;
    const scroll = el.panel.scrollTop;
    el.panel.innerHTML = ZG.Panels.render(s);
    el.panel.scrollTop = scroll;
    lastPanel = performance.now();
    panelDirty = false;
  }
  App.refresh = function () {
    renderTabs();
    renderPanel(true);
  };

  // ------------------------------------------------------------------
  function openEventModal() {
    const v = ZG.Events.view(s);
    if (!v) return;
    modalOpen = true;
    const Z = ZG.zoo(s);
    el['modal-root'].innerHTML = `<div class="modal-back"><div class="modal event ${v.cat || ''}">
      <div class="m-head"><span class="m-icon">${v.icon || '📌'}</span><div><small>${U.fmtDate(s.day)} · ${esc(Z.name)}</small><h2>${v.title}</h2></div></div>
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
        <p><b>Current patients:</b> ${sick.map((a) => `${ZG.SPECIES[a.sp].emoji} ${esc(a.name)} — ${esc(a.sick.name)}`).join('<br>') || 'none'}</p>`;
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
          return `<div class="acard"><div class="aemo">${sp.emoji}</div><div><b>${esc(a.name)}</b> ${a.sex === 'M' ? '♂' : '♀'} <small>${sp.name}, ${U.ageStr(a.age)}</small><br><i>${a.loc === 'hab' ? 'Currently ' + esc(a.mood) : 'Not on exhibit'}</i><br><small>Welfare ${Math.round(a.welfare)} · Health ${Math.round(a.health)} · ${sp.iucn} ${sp.program === 'SSP' ? '· SSP' : ''}</small>${notes.length ? `<br><small>${notes.join(' · ')}</small>` : ''}</div></div>`;
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

  function setWalk(on) {
    ZG.Render.setWalk(s, on);
    if (on && speedIdx > 2) speedIdx = 1;
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
      const top = t.closest('[data-top]');
      if (top) {
        const a = top.dataset.top;
        if (a === 'walk') setWalk(!ZG.Render.state.walk);
        if (a === 'save') App.save();
        if (a === 'help') openHelp();
        if (a === 'menu') {
          App.save(true);
          if (confirm('Return to the main menu? Your game is saved.')) {
            s = null;
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
        App.refresh();
        return;
      }
      const plan = t.closest('[data-plan]');
      if (plan) {
        closeModal();
        ZG.Actions.select(s, { plot: plan.dataset.plan });
        App.refresh();
        return;
      }
      const act = t.closest('[data-act]');
      if (act && (el.panel.contains(act) || el.tabs.contains(act))) {
        const fn = ZG.Actions[act.dataset.act];
        if (!fn) return;
        const r = fn(s, act.dataset, act);
        if (r && r.msg) toast(r.msg, !r.ok);
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
    });

    // Map interactions
    const cv = el.map;
    const R = ZG.Render.state;
    cv.addEventListener('mousemove', (e) => {
      if (!s) return;
      const r = cv.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      if (R.drag) {
        R.cam.x = R.drag.cx - (sx - R.drag.sx) / R.cam.zoom;
        R.cam.y = R.drag.cy - (sy - R.drag.sy) / R.cam.zoom;
        R.drag.moved = R.drag.moved || Math.hypot(sx - R.drag.sx, sy - R.drag.sy) > 4;
        return;
      }
      const w = ZG.Render.screenToWorld(sx, sy);
      const p = ZG.Render.plotAt(s, w.x, w.y);
      R.hover = p ? p.id : null;
      tooltip(p, e.clientX - r.left, e.clientY - r.top);
    });
    cv.addEventListener('mouseleave', () => {
      R.hover = null;
      el.tooltip.style.display = 'none';
      R.drag = null;
    });
    cv.addEventListener('mousedown', (e) => {
      const r = cv.getBoundingClientRect();
      R.drag = { sx: e.clientX - r.left, sy: e.clientY - r.top, cx: R.cam.x, cy: R.cam.y, moved: false };
    });
    cv.addEventListener('mouseup', (e) => {
      if (!s) return;
      const moved = R.drag && R.drag.moved;
      R.drag = null;
      if (moved) return;
      const r = cv.getBoundingClientRect();
      const w = ZG.Render.screenToWorld(e.clientX - r.left, e.clientY - r.top);
      const p = ZG.Render.plotAt(s, w.x, w.y);
      if (R.walk) {
        if (p && Math.hypot(w.x - R.avatar.x, w.y - R.avatar.y) < 220 && ZG.Render.nearbyPlot(s) === p) openObserve(p);
        else R.avatar.target = { x: w.x, y: w.y };
        return;
      }
      if (p) {
        ZG.Actions.select(s, { plot: p.id });
        App.refresh();
      }
    });
    cv.addEventListener(
      'wheel',
      (e) => {
        if (!s) return;
        e.preventDefault();
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        R.cam.zoom = U.clamp(R.cam.zoom * f, ZG.Render.minZoom(), 4);
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      if (!s) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
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
      if (R.walk && ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(k)) {
        R.keys[k] = true;
        e.preventDefault();
        return;
      }
      if (R.walk && k === 'e') {
        openObserve(ZG.Render.nearbyPlot(s));
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
