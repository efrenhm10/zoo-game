// Going on air: TV, radio, op-eds and livestreams. Pick an outlet and a message;
// a good appearance moves donors, voters and ticket buyers. A bad one goes viral.
(function (ZG) {
  const U = ZG.U;
  const MD = (ZG.Media = {});
  const $ = (n) => U.money(n);

  MD.OUTLETS = {
    tv: { icon: '📺', name: 'Morning TV news segment', desc: 'Bring an animal ambassador. Big audience.', reach: 1.0, risk: 0.1 },
    npr: { icon: '📻', name: 'Public radio interview', desc: 'Thoughtful, older audience. Donors listen.', reach: 0.6, risk: 0.04, donors: true },
    talk: { icon: '🎙️', name: 'Talk radio call-in show', desc: 'Hostile callers. High risk, and politicians listen.', reach: 0.85, risk: 0.28, politics: 1.5 },
    oped: { icon: '📰', name: 'Newspaper op-ed', desc: 'You control every word. Small, influential audience.', reach: 0.45, risk: 0.02, politics: 1.2 },
    live: { icon: '📱', name: 'Social media livestream', desc: 'Young audience. Great for events and merch.', reach: 0.75, risk: 0.1, young: true },
    podcast: { icon: '🎧', name: 'Local podcast', desc: 'Long-form, friendly, niche.', reach: 0.35, risk: 0.05 },
  };
  MD.GAP = 21;

  const GAFFES = [
    'On live TV you called the tiger “basically a big house cat.” The clip is everywhere.',
    'A caller asked why ticket prices went up and you said “inflation, I guess?” It did not land.',
    'You got the rhino’s name wrong on air. The keepers have not let it go.',
    'The ambassador animal pooped on the anchor’s desk. Funny, but it buried your message.',
    'You joked about budget cuts “sounding like a skunk problem.” Council staff were not amused.',
    'You mixed up two SSP species on air and an AZA colleague corrected you in the comments.',
  ];

  MD.topics = function (s) {
    const out = [];
    if (s.plan && s.plan.status === 'review') out.push({ id: 'plan', name: 'Pitch your strategic master plan', why: 'Builds public support before the vote.' });
    for (const c of ZG.Campaigns.list(s)) out.push({ id: 'campaign:' + c.id, name: `Pitch the “${c.label}” campaign`, why: 'Boosts campaign momentum, brings in pledges and warms up lead prospects.' });
    const g = s.gov;
    if (g.request || g.feeProposal || (g.stateReq && !g.stateReq.passed)) out.push({ id: 'budget', name: 'Make the case for public funding', why: 'Public pressure on the politicians deciding your budget.' });
    const ev = s.zooEvents && s.zooEvents.booked.find((e) => e.day - s.day <= 45 && e.day >= s.day);
    if (ev) out.push({ id: 'event', name: `Promote ${ZG.ZooEvents.TYPES[ev.type].name}`, why: 'More tickets sold.', ev: ev.id });
    const baby = s.animals.find((a) => a.age < 150 && ZG.SPECIES[a.sp].appeal >= 5);
    if (baby) out.push({ id: 'baby', name: `Introduce ${baby.name} the baby ${ZG.SPECIES[baby.sp].name}`, why: 'Crowds, members and plush sales.' });
    const crisis = s.news.find((n) => n.kind === 'bad' && s.day - n.day <= 20);
    if (crisis) out.push({ id: 'crisis', name: 'Address the recent bad news head-on', why: 'Damage control. Can recover reputation, or make it worse.' });
    if (s.merch && (s.merch.collab || s.merch.drop)) out.push({ id: 'merch', name: 'Show off the new merchandise', why: 'Sells more of the new line.' });
    out.push({ id: 'membership', name: 'Push memberships', why: 'New member households.' });
    out.push({ id: 'conservation', name: 'Tell a conservation success story', why: 'Reputation and AZA goodwill.' });
    return out;
  };

  MD.canUse = (s, id) => s.day - ((s.media && s.media.last[id]) || -999) >= MD.GAP;
  MD.init = (s) => (s.media = { last: {}, history: [] });

  MD.appear = function (s, outletId, topicId) {
    const O = MD.OUTLETS[outletId];
    const topic = MD.topics(s).find((t) => t.id === topicId);
    if (!O || !topic) return { ok: false, msg: 'Pick an outlet and a message.' };
    if (!MD.canUse(s, outletId)) return { ok: false, msg: `You were on that outlet recently. Try after ${U.fmtDate(s.media.last[outletId] + MD.GAP)}.` };
    s.media.last[outletId] = s.day;
    const pro = ZG.pronoun(s);
    const skill = ZG.mod(s, 'media');
    const gaffe = U.rand(s) < O.risk / Math.max(0.5, skill) * (topicId === 'crisis' ? 1.6 : 1);
    const q = gaffe ? -0.6 : U.clamp(U.rf(s, 0.45, 1.15) + (skill - 1) * 0.8, 0.2, 1.5);
    const k = O.reach * q;
    const lines = [];
    const rep = (d) => (s.rep = U.clamp(s.rep + d, 0, 100));
    if (gaffe) {
      lines.push(U.pick(s, GAFFES));
      rep(-2 * O.reach);
      if (O.politics) ZG.Officials.shiftAll(s, s.gov.type === 'federal' ? 'federal' : 'local', -2);
    }
    if (!gaffe) {
      switch (topicId.split(':')[0]) {
        case 'plan': {
          const g = Math.round(6 * k * (O.politics ? 1.2 : 1));
          s.plan.support = U.clamp(s.plan.support + g, 0, 100);
          lines.push(`Public support for the master plan +${g}.`);
          break;
        }
        case 'campaign': {
          const c = ZG.Campaigns.byId(s, topic.id.split(':')[1]);
          if (!c) break;
          for (const L of c.leads) L.ready = Math.min(100, L.ready + Math.round(4 * k));
          c.momentum = Math.min(1.5, (c.momentum || 0) + 0.25 * k);
          const pledges = Math.round((c.goal * 0.004 * k * (O.donors ? 1.6 : 1)) / 1000) * 1000;
          ZG.Econ.earn(s, 'donations', pledges, true);
          c.raised += pledges;
          lines.push(`Listeners pledged ${$(pledges)} on the spot, and the campaign has new momentum.`);
          break;
        }
        case 'budget': {
          const d = Math.round(3 * k * (O.politics || 1));
          if (s.gov.request || s.gov.feeProposal) ZG.Officials.shiftAll(s, s.gov.type === 'federal' ? 'federal' : 'local', d);
          if (s.gov.stateReq) s.gov.stateRel = U.clamp(s.gov.stateRel + d, 0, 100);
          for (const o of s.officials) if (o.trait === 'hawk') o.off -= 1;
          lines.push(`Constituents started calling their representatives about the zoo. Political relationship +${d}. (The budget hawks grumbled.)`);
          break;
        }
        case 'event': {
          const t = topic.ev && s.zooEvents.booked.find((e) => e.id === topic.ev);
          if (t) t.hype = Math.min(1.8, (t.hype || 1) + 0.18 * k * (O.young ? 1.4 : 1));
          lines.push('Ticket sales jumped the next morning.');
          break;
        }
        case 'baby':
          s.novelty = Math.min(1, s.novelty + 0.06 * k);
          s.flags.plushBoost = s.day + 60;
          lines.push('The baby clip got picked up statewide. Expect crowds and plush sales.');
          break;
        case 'crisis':
          rep(2.5 * k);
          lines.push(`${pro.Subj} answered every hard question directly. Viewers came away reassured.`);
          break;
        case 'merch':
          if (s.merch) s.merch.hype = Math.min(0.4, (s.merch.hype || 0) + 0.12 * k * (O.young ? 1.4 : 1));
          lines.push('The gift shop saw a rush the next weekend.');
          break;
        case 'membership': {
          const n = Math.round(s.members * 0.012 * k);
          s.members += n;
          ZG.Econ.earn(s, 'memberships', n * s.policy.memberPrice);
          lines.push(`${U.num(n)} households joined as members.`);
          break;
        }
        case 'conservation':
          rep(1.5 * k);
          s.aza = U.clamp(s.aza + 0.6 * k, 0, 100);
          lines.push('It was a genuinely moving story. Reputation up.');
          break;
      }
      if (O.donors) ZG.Donors.react(s, Math.round(2 * k));
      if (O.young) s.novelty = Math.min(1, s.novelty + 0.02 * k);
      rep(0.5 * k);
    }
    const verdict = gaffe ? 'Rough appearance' : q > 1 ? 'Great appearance' : q > 0.7 ? 'Solid appearance' : 'Forgettable appearance';
    s.media.history.unshift({ day: s.day, outlet: outletId, topic: topicId, verdict });
    if (s.media.history.length > 20) s.media.history.pop();
    ZG.Sim.news(s, `${O.icon} Director ${s.director.name.split(' ').slice(-1)[0]} on ${O.name.toLowerCase()}: ${verdict.toLowerCase()}.`, gaffe ? 'bad' : 'good');
    return { ok: !gaffe, msg: `${O.icon} ${verdict}. ${lines.join(' ')}`, modal: { icon: O.icon, title: verdict, html: `<p><i>${O.name} · “${topic.name}”</i></p><p>${lines.join(' ')}</p>` } };
  };
})((globalThis.ZG = globalThis.ZG || {}));
