// Director creation: education and career backgrounds that shape strengths & weaknesses.
// Every modifier key here is read somewhere in the simulation (see ZG.mod()).
(function (ZG) {
  // Modifier keys (1 = neutral for multipliers, 0 = neutral for additive):
  //  welfare (+pts), vet (mult on vet effectiveness), fundraising (mult), sponsors (mult),
  //  politics (+pts to budget/vote odds), construction (cost mult), maintenance (mult on upkeep effect),
  //  guest (+pts satisfaction), marketing (mult), aza (+pts standing/inspections), morale (+pts),
  //  board (+pts starting confidence), crisis (mult on disaster damage), media (mult on PR outcomes),
  //  finance (mult on overhead costs)
  ZG.DIRECTOR = {
    schools: [
      'Cornell University', 'UC Davis', 'Colorado State University', 'Texas A&M University', 'University of Hawaiʻi at Mānoa',
      'Georgetown University', 'The Ohio State University', 'University of Florida', 'University of Michigan', 'Harvard University',
      'San Diego State University', 'University of Houston', 'Oregon State University', 'A community college', 'The school of hard knocks',
    ],
    fields: [
      { id: 'zoology', name: 'Zoology / Animal Biology', mods: { welfare: 3, aza: 3 }, text: '+ animal welfare, + AZA standing' },
      { id: 'vetmed', name: 'Veterinary Medicine', mods: { vet: 1.15, welfare: 2 }, text: '+ vet effectiveness & infant survival' },
      { id: 'conservation', name: 'Conservation Biology / Ecology', mods: { aza: 5, fundraising: 1.03 }, text: '++ AZA standing & SSP relations' },
      { id: 'business', name: 'Business Administration', mods: { finance: 0.95, sponsors: 1.08 }, text: '+ lower overhead, + sponsorship deals' },
      { id: 'publicadmin', name: 'Public Administration / Policy', mods: { politics: 8 }, text: '++ government budget & council votes' },
      { id: 'nonprofit', name: 'Nonprofit Management', mods: { fundraising: 1.12 }, text: '++ donations & major gifts' },
      { id: 'comms', name: 'Communications / Marketing', mods: { marketing: 1.12, media: 1.2 }, text: '++ marketing reach & crisis PR' },
      { id: 'engineering', name: 'Civil Engineering / Architecture', mods: { construction: 0.92, maintenance: 1.1 }, text: '++ cheaper construction, better upkeep' },
      { id: 'hospitality', name: 'Hospitality / Recreation Mgmt', mods: { guest: 4, marketing: 1.04 }, text: '++ guest satisfaction' },
    ],
    levels: [
      { id: 'none', name: 'No degree', mult: 0.3, board: -6, text: 'Scrappy — the board has doubts at first.' },
      { id: 'assoc', name: "Associate's", mult: 0.6, board: -3, text: 'Solid foundation.' },
      { id: 'ba', name: "Bachelor's", mult: 1.0, board: 0, text: 'The standard for the field.' },
      { id: 'ma', name: "Master's / MBA / MPA", mult: 1.35, board: 3, text: 'Stronger field bonus; boards like it.' },
      { id: 'phd', name: 'Doctorate (PhD / DVM)', mult: 1.7, board: 5, aza: 3, text: 'Biggest field bonus and scientific credibility.' },
    ],
    genders: [
      { id: 'woman', name: 'Woman', title: 'Ms.' },
      { id: 'man', name: 'Man', title: 'Mr.' },
      { id: 'nonbinary', name: 'Non-binary', title: 'Mx.' },
    ],
    looks: {
      skin: ['#f6d7c3', '#eac09a', '#d4a17a', '#b07a55', '#8a5a3c', '#5e3b26'],
      hair: ['#1d1a18', '#4a2f1f', '#8a5a2b', '#c9a15a', '#e6d3a3', '#a33b20', '#9a9a9a', '#f2f2f2'],
      hairStyle: ['short', 'long', 'bun', 'curly', 'bald', 'ponytail'],
      outfit: ['#2f6b3f', '#6b4f2f', '#2d4e7a', '#7a2d3b', '#c28b2c', '#4a4a4a', '#5a3b7a', '#e0e0d0'],
      hat: ['none', 'safari', 'cap', 'bucket'],
    },
    // Careers: minAge gates realistic seniority. years adds up to 25% extra on strengths.
    careers: [
      { id: 'keeper', name: 'Head Keeper', minAge: 24, desc: 'Came up scrubbing barns and training elephants. Knows every animal by name.',
        pros: { welfare: 5, morale: 8, aza: 2 }, cons: { fundraising: 0.85, politics: -4 }, strengths: ['Animal welfare', 'Staff morale'], weaknesses: ['Fundraising', 'Politics'] },
      { id: 'curator', name: 'Curator of Mammals', minAge: 32, desc: 'Managed collection plans and SSP transfers at a mid-size AZA zoo.',
        pros: { aza: 7, welfare: 3 }, cons: { marketing: 0.9, finance: 1.04 }, strengths: ['AZA & SSP relations', 'Collection planning'], weaknesses: ['Marketing', 'Budget discipline'] },
      { id: 'vet', name: 'Zoo Veterinarian', minAge: 30, desc: 'A decade of anesthesia, necropsies and 3 a.m. births.',
        pros: { vet: 1.2, welfare: 3 }, cons: { sponsors: 0.85, marketing: 0.92 }, strengths: ['Animal health', 'Infant survival'], weaknesses: ['Corporate sponsors', 'Marketing'] },
      { id: 'field', name: 'Conservation Field Biologist', minAge: 26, desc: 'Radio-collared lions in Kenya and ran a snow-leopard camera-trap project.',
        pros: { aza: 6, fundraising: 1.05, media: 1.1 }, cons: { finance: 1.06, guest: -3 }, strengths: ['Conservation credibility', 'Grant writing'], weaknesses: ['Operations & budgets', 'Guest experience'] },
      { id: 'finance', name: 'Corporate Finance Executive', minAge: 30, desc: 'CFO of a regional hospital system. Spreadsheets are your love language.',
        pros: { finance: 0.9, sponsors: 1.1, board: 5 }, cons: { welfare: -3, morale: -6, aza: -3 }, strengths: ['Lower overhead', 'Board confidence'], weaknesses: ['Animal expertise', 'Staff trust'] },
      { id: 'cityhall', name: 'City Budget Director', minAge: 33, desc: 'Ran the budget office at City Hall. You know where the money hides.',
        pros: { politics: 14, finance: 0.95 }, cons: { fundraising: 0.9, guest: -2 }, strengths: ['Government funding', 'Council votes'], weaknesses: ['Donor cultivation'] },
      { id: 'fundraiser', name: 'Nonprofit Development Director', minAge: 28, desc: 'Closed seven-figure gifts for a children\'s hospital and a symphony.',
        pros: { fundraising: 1.3, sponsors: 1.1 }, cons: { welfare: -2, maintenance: 0.92 }, strengths: ['Major gifts', 'Galas & campaigns'], weaknesses: ['Animal operations', 'Facilities'] },
      { id: 'themepark', name: 'Theme Park Operations VP', minAge: 32, desc: 'Ran a park with 5 million visitors a year. Queues fear you.',
        pros: { guest: 7, marketing: 1.15, sponsors: 1.05 }, cons: { aza: -5, welfare: -2 }, strengths: ['Guest experience', 'Attendance & marketing'], weaknesses: ['AZA credibility', 'Animal welfare'] },
      { id: 'engineer', name: 'Construction Project Manager', minAge: 27, desc: 'Delivered hospitals and stadiums on time and (mostly) on budget.',
        pros: { construction: 0.85, maintenance: 1.2 }, cons: { fundraising: 0.9, media: 0.9 }, strengths: ['Cheaper builds', 'Infrastructure upkeep'], weaknesses: ['Fundraising', 'Public relations'] },
      { id: 'military', name: 'Military Logistics Officer', minAge: 28, desc: 'Moved people and supplies through hurricanes and war zones.',
        pros: { crisis: 0.7, morale: 3, maintenance: 1.08 }, cons: { media: 0.9, fundraising: 0.92 }, strengths: ['Disaster response', 'Operations'], weaknesses: ['Media', 'Donor relations'] },
      { id: 'politician', name: 'Former City Council Member', minAge: 38, desc: 'Two terms on council. Everyone owes you a favor — and some hold grudges.',
        pros: { politics: 18, media: 1.1 }, cons: { aza: -4, board: -3, morale: -3 }, strengths: ['Political capital', 'Media'], weaknesses: ['AZA credibility', 'Staff skepticism'] },
      { id: 'marketing', name: 'Ad Agency Creative Director', minAge: 26, desc: 'Made a talking gecko famous. Now you want to make a hippo famous.',
        pros: { marketing: 1.25, media: 1.25, sponsors: 1.05 }, cons: { aza: -3, finance: 1.04 }, strengths: ['Marketing & viral moments', 'Brand deals'], weaknesses: ['Science credibility', 'Cost control'] },
      { id: 'grad', name: 'Recent Graduate / Zoo Intern', minAge: 22, maxAge: 29, desc: 'Fresh out of school with big ideas and a surprising amount of energy.',
        pros: { morale: 6, marketing: 1.05 }, cons: { board: -10, politics: -6, fundraising: 0.9 }, strengths: ['Energy & staff rapport', 'Fresh ideas'], weaknesses: ['Board confidence', 'Every network you don\'t have yet'] },
    ],
  };

  // Combine education + career + age into one modifier table.
  ZG.buildDirectorMods = function (d) {
    const D = ZG.DIRECTOR;
    const m = { welfare: 0, vet: 1, fundraising: 1, sponsors: 1, politics: 0, construction: 1, maintenance: 1, guest: 0, marketing: 1, aza: 0, morale: 0, board: 0, crisis: 1, media: 1, finance: 1 };
    const add = (src, scale) => {
      for (const k in src) {
        if (!(k in m)) continue;
        const neutral = ['vet', 'fundraising', 'sponsors', 'construction', 'maintenance', 'marketing', 'crisis', 'media', 'finance'].includes(k) ? 1 : 0;
        if (neutral === 1) m[k] *= 1 + (src[k] - 1) * scale;
        else m[k] += src[k] * scale;
      }
    };
    const field = D.fields.find((f) => f.id === d.field);
    const level = D.levels.find((l) => l.id === d.level);
    const career = D.careers.find((c) => c.id === d.career);
    if (field && level) add(field.mods, level.mult);
    if (level) {
      m.board += level.board;
      if (level.aza) m.aza += level.aza;
    }
    if (career) {
      const exp = Math.max(0, Math.min(25, d.age - career.minAge));
      add(career.pros, 1 + exp / 100);
      add(career.cons, 1);
    }
    return m;
  };
  ZG.mod = (s, k) => (s.director && s.director.mods && s.director.mods[k] != null ? s.director.mods[k] : ['vet', 'fundraising', 'sponsors', 'construction', 'maintenance', 'marketing', 'crisis', 'media', 'finance'].includes(k) ? 1 : 0);

  // Pronouns for the director, from the gender chosen at character creation.
  ZG.pronoun = function (s) {
    const g = (s && s.director && s.director.gender) || 'nonbinary';
    if (g === 'woman') return { subj: 'she', obj: 'her', pos: 'her', Subj: 'She', title: 'Ms.' };
    if (g === 'man') return { subj: 'he', obj: 'him', pos: 'his', Subj: 'He', title: 'Mr.' };
    return { subj: 'they', obj: 'them', pos: 'their', Subj: 'They', title: 'Mx.' };
  };
})((globalThis.ZG = globalThis.ZG || {}));
