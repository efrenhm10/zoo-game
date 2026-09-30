// Design meetings with the zoo's exhibit architect: type a brief, get three
// rendered concepts, pick one to build (or save it and fundraise for it).
(function (ZG) {
  const U = ZG.U;
  const esc = U.esc;
  const A = (ZG.Architect = {});
  const ARCH = {
    name: 'Marisol Vega',
    firm: 'Canopy & Stone Studio',
    look: { skin: '#b07a55', hair: '#1d1a18', hairStyle: 'bun', outfit: '#2d4e7a', hat: 'none' },
  };
  const CHIPS = [
    ['🐘', 'Asian elephants'], ['🦍', 'gorillas'], ['🐧', 'penguins'], ['🐅', 'tigers'], ['🦒', 'giraffes'],
    ['💦', 'a big waterfall'], ['🔭', 'an underwater viewing tunnel'], ['🧗', 'climbing structures and ropes'], ['🌉', 'an elevated skywalk'],
    ['🥬', 'a guest feeding deck'], ['🕳️', 'a cave den for privacy'], ['🌳', 'lush, immersive planting'], ['🎭', 'a keeper-talk amphitheater'],
    ['☀️', 'solar power and recycled water'], ['💲', 'keep it affordable'], ['✨', 'make it world-class'],
  ];
  const st = { s: null, plot: null, brief: '', concepts: null, images: {} };

  A.open = function (s, plotId, brief) {
    st.s = s;
    st.plot = plotId;
    st.brief = brief != null ? brief : st.plot === plotId ? st.brief : '';
    st.concepts = null;
    renderBrief();
  };

  function header(sub) {
    const p = st.s.plots[st.plot];
    return `<div class="m-head arch-head"><span class="m-icon">📐</span><div><small>${U.fmtDate(st.s.day)} · ${esc(ARCH.firm)}</small><h2>Design meeting — ${U.num(p.area)} m² lot</h2>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  }
  function archSays(text) {
    return `<div class="arch-says"><div class="round">${`<img class="portrait md" src="${ZG.Portraits.avatar(ARCH.look)}" alt="">`}<span class="banner">${ARCH.name.split(' ')[0]}</span></div><div class="speech">${text}</div></div>`;
  }

  function renderBrief() {
    const s = st.s;
    const fee = ZG.Design.fee(s);
    const p = s.plots[st.plot];
    const html = `<div class="modal-back"><div class="modal architect">${header()}
      <div class="m-body">
        ${archSays(`Welcome! I’m <b>${ARCH.name}</b>, principal at ${esc(ARCH.firm)}. This lot is about <b>${U.num(p.area)} m²</b>. Tell me what you’re dreaming of — which animals, what landscape, how guests should experience it, any must-have features, and how big the budget is. I’ll come back with <b>three concepts and renderings</b>.`)}
        <textarea id="arch-brief" rows="5" placeholder="e.g. A misty Sumatran rainforest for tigers with a waterfall, a pool they can swim in, and an underwater viewing window. Lots of plants, a keeper-talk amphitheater, and keep it affordable. Call it Tiger Falls.">${esc(st.brief)}</textarea>
        <div class="chips">${CHIPS.map(([i, t]) => `<button class="chip" data-arch-chip="${esc(t)}">${i} ${esc(t)}</button>`).join('')}</div>
        <p class="sub">Design retainer: <b>${U.money(fee)}</b> per meeting · Available for construction: capital ${U.money(s.capital)} + cash ${U.money(s.cash)} + credit ${U.money(ZG.Econ.creditLimit(s))}</p>
      </div>
      <div class="m-choices row2"><button class="choice primary" data-arch="present"><b>🎨 Present three concepts</b><small>Marisol’s team sketches and renders options</small></button><button class="choice" data-close="1"><b>Maybe later</b></button></div>
    </div></div>`;
    ZG.App.showModal(html);
    const ta = document.getElementById('arch-brief');
    if (ta) {
      ta.focus();
      ta.oninput = () => (st.brief = ta.value);
    }
  }

  function renderConcepts() {
    const s = st.s;
    const { parsed, options } = st.concepts;
    const heard = parsed.heard.length ? parsed.heard.join(', ') : 'not much yet — so I made some assumptions';
    const card = (o) => {
      const afford = ZG.Econ.canAfford(s, o.cost, true);
      const img = st.images[o.key];
      return `<div class="concept">
        <div class="render">${img ? `<img src="${img}" alt="Rendering of ${esc(o.name)}">` : '<div class="sketching">✏️ Rendering…</div>'}<span class="opt">Option ${o.key}</span></div>
        <div class="cbody">
          <small class="ctitle">${esc(o.title)}</small>
          <h3>“${esc(o.name)}”</h3>
          <p class="pitch">${esc(o.pitch)}</p>
          <div class="feats">${o.features.map((f) => `<span class="feat" title="${esc(ZG.Design.FEATURES[f].line)}">${ZG.Design.FEATURES[f].icon} ${esc(ZG.Design.FEATURES[f].name)}</span>`).join('') || '<span class="feat">Simple, durable landscaping</span>'}
            ${o.climate !== 'none' ? `<span class="feat">${o.climate === 'chilled' ? '❄️ Chilled building' : '🔥 Heated glasshouse'}</span>` : ''}</div>
          <table class="mini">
            <tr><td>Construction cost</td><td class="${afford ? '' : 'bad'}">${U.money(o.cost)}</td></tr>
            <tr><td>Build time</td><td>~${Math.round(o.days / 30)} months</td></tr>
            <tr><td>Design tier</td><td>${ZG.Habitats.TIERS[o.tier].name}</td></tr>
            <tr><td>Guest appeal</td><td class="${o.appeal >= 0 ? 'good' : 'bad'}">${o.appeal >= 0 ? '+' : ''}${o.appeal}%</td></tr>
            <tr><td>Animal welfare boost</td><td class="good">+${o.welfare}</td></tr>
            <tr><td>Feature upkeep</td><td>${o.upkeep >= 0 ? U.money(o.upkeep) + '/yr' : 'saves ' + U.money(-o.upkeep) + '/yr'}</td></tr>
            ${o.capacity.length ? `<tr><td>Capacity</td><td>${o.capacity.map(esc).join('<br>')}</td></tr>` : ''}
          </table>
          ${o.warnings.map((w) => `<p class="warnbox">⚠️ ${esc(w)}</p>`).join('')}
          <div class="actions">
            <button class="btn primary" data-arch="build" data-key="${o.key}" ${afford ? '' : 'disabled title="Not enough capital, cash and credit"'}>🏗️ Build this design</button>
            <button class="btn" data-arch="save" data-key="${o.key}">📁 Save & fundraise</button>
          </div>
        </div></div>`;
    };
    const html = `<div class="modal-back"><div class="modal architect wide">${header('Three concepts for your review')}
      <div class="m-body">
        ${archSays(`Here’s what I heard: <i>${esc(heard)}</i>. We took that three directions — take a look at the renderings.`)}
        <div class="concepts">${options.map(card).join('')}</div>
      </div>
      <div class="m-choices row2"><button class="choice" data-arch="revise"><b>✏️ Revise the brief</b><small>Tell Marisol what to change</small></button><button class="choice" data-close="1"><b>Close</b></button></div>
    </div></div>`;
    ZG.App.showModal(html);
  }

  function present() {
    const s = st.s;
    const ta = document.getElementById('arch-brief');
    if (ta) st.brief = ta.value;
    if (!st.brief.trim()) {
      ZG.App.toast('Tell the architect a little about your idea first.', true);
      return;
    }
    const fee = ZG.Design.fee(s);
    ZG.Econ.spend(s, 'admin', fee);
    st.concepts = ZG.Design.concepts(s, st.plot, st.brief);
    st.images = {};
    renderConcepts();
    // Render the three concepts one at a time so the UI stays responsive
    const keys = st.concepts.options.map((o) => o.key);
    const next = () => {
      const k = keys.shift();
      if (!k || !st.concepts) return;
      const o = st.concepts.options.find((x) => x.key === k);
      try {
        st.images[k] = ZG.Render.renderDesign(s, o, 640, 380);
      } catch (e) {
        console.error(e);
        st.images[k] = '';
      }
      const box = document.querySelectorAll('.concept .render')[st.concepts.options.indexOf(o)];
      if (box && st.images[k]) box.querySelector('.sketching') && (box.querySelector('.sketching').outerHTML = `<img src="${st.images[k]}" alt="">`);
      setTimeout(next, 40);
    };
    setTimeout(next, 60);
  }

  function choose(key, save) {
    const s = st.s;
    const o = st.concepts.options.find((x) => x.key === key);
    if (!o) return;
    if (save) {
      s.plots[st.plot].savedDesign = o;
      let msg = `Saved “${o.name}”. You can build it from the lot whenever the money is there.`;
      if (ZG.Campaigns.canStart(s) && !ZG.Campaigns.forPlot(s, st.plot)) {
        const r = ZG.Dev.startCampaign(s, o.cost, o.name, { kind: 'plot', id: st.plot });
        if (r.ok) msg += ' A capital campaign has been launched for it.';
      }
      ZG.App.hideModal();
      ZG.App.toast(msg);
      ZG.App.refresh();
      return;
    }
    const r = ZG.Habitats.startBuild(s, st.plot, { name: o.name, biome: o.biome, tier: o.tier, climate: o.climate, features: o.features, brief: st.brief, species: o.species, cost: o.cost, days: o.days });
    ZG.App.toast(r.msg, !r.ok);
    if (r.ok) {
      ZG.Sim.news(s, `📐 ${ARCH.name}’s “${o.name}” (${o.title}) was approved. Construction begins.`, 'good');
      ZG.App.hideModal();
      ZG.App.refresh();
    }
  }

  // Delegated clicks inside the architect modal
  document.addEventListener('click', (e) => {
    if (!st.s) return;
    const chip = e.target.closest('[data-arch-chip]');
    if (chip) {
      const ta = document.getElementById('arch-brief');
      if (ta) {
        const t = chip.dataset.archChip;
        ta.value = (ta.value.trim() ? ta.value.trim().replace(/[.]?$/, ', ') : 'I want ') + t;
        st.brief = ta.value;
        ta.focus();
      }
      return;
    }
    const b = e.target.closest('[data-arch]');
    if (!b || b.disabled) return;
    const a = b.dataset.arch;
    if (a === 'present') present();
    else if (a === 'revise') renderBrief();
    else if (a === 'build') choose(b.dataset.key, false);
    else if (a === 'save') choose(b.dataset.key, true);
  });
})((globalThis.ZG = globalThis.ZG || {}));
