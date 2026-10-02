// Habitat design: habitat features, the architect's brief parser, and the
// three concept options presented in a design meeting. No DOM here.
(function (ZG) {
  const U = ZG.U;
  const D = (ZG.Design = {});

  // cost in $ (before zoo cost multiplier), appeal = +share of habitat appeal,
  // welfare = bonus for species that benefit (tags), upkeep $/yr, days = extra build time
  D.FEATURES = {
    bigPool: { name: 'Deep swimming pool', icon: '🏊', cost: 1400000, appeal: 0.05, welfare: 7, tags: ['swim'], upkeep: 40000, days: 30, words: ['pool', 'lake', 'pond', 'swim', 'swimming', 'deep water', 'lagoon'], line: 'a deep, naturalistic pool big enough for real swimming and diving' },
    underwaterView: { name: 'Underwater viewing tunnel', icon: '🔭', cost: 3200000, appeal: 0.18, welfare: 0, tags: [], upkeep: 60000, days: 90, words: ['underwater', 'tunnel', 'below the water', 'aquarium', 'glass tunnel', 'under water'], line: 'an acrylic underwater tunnel so guests watch animals swim overhead', needs: 'bigPool' },
    waterfall: { name: 'Waterfall', icon: '💦', cost: 900000, appeal: 0.06, welfare: 2, tags: ['all'], upkeep: 25000, days: 30, words: ['waterfall', 'cascade', 'falls'], line: 'a rock waterfall that masks city noise and becomes the photo spot' },
    stream: { name: 'Meandering stream', icon: '🏞️', cost: 500000, appeal: 0.03, welfare: 3, tags: ['all'], upkeep: 15000, days: 20, words: ['stream', 'river', 'creek', 'brook'], line: 'a shallow stream winding through the yard' },
    rockwork: { name: 'Rockwork & cliffs', icon: '🪨', cost: 800000, appeal: 0.04, welfare: 5, tags: ['climb', 'mountain', 'cat'], upkeep: 10000, days: 30, words: ['rock', 'rocks', 'rockwork', 'cliff', 'cliffs', 'boulder', 'boulders', 'canyon', 'kopje', 'ledges'], line: 'sculpted rockwork, ledges and basking boulders' },
    climbing: { name: 'Climbing structures', icon: '🧗', cost: 600000, appeal: 0.04, welfare: 8, tags: ['climb'], upkeep: 20000, days: 20, words: ['climb', 'climbing', 'ropes', 'platforms', 'jungle gym', 'hammock', 'hammocks', 'towers', 'poles'], line: 'tall climbing towers, ropes and hammocks for three-dimensional use of space' },
    cave: { name: 'Cave & den', icon: '🕳️', cost: 450000, appeal: 0.02, welfare: 4, tags: ['all'], upkeep: 5000, days: 15, words: ['cave', 'den', 'grotto', 'hideout', 'hiding', 'burrow', 'privacy'], line: 'a cool cave den where animals can retreat from view' },
    mudWallow: { name: 'Mud wallow', icon: '🟤', cost: 150000, appeal: 0.02, welfare: 7, tags: ['wallow'], upkeep: 8000, days: 5, words: ['mud', 'wallow', 'dust bath', 'dust', 'sand bath'], line: 'a mud wallow and dust-bathing area for skin care' },
    bamboo: { name: 'Bamboo groves', icon: '🎋', cost: 120000, appeal: 0.02, welfare: 6, tags: ['bamboo'], upkeep: 20000, days: 5, words: ['bamboo'], line: 'living bamboo groves for browse and cover' },
    lush: { name: 'Lush immersive planting', icon: '🌳', cost: 350000, appeal: 0.04, welfare: 3, tags: ['all'], upkeep: 15000, days: 10, words: ['lush', 'jungle', 'dense', 'immersive planting', 'plants', 'foliage', 'green', 'trees', 'garden', 'natural'], line: 'layered, immersive planting so the barriers disappear' },
    mist: { name: 'Misting system', icon: '☁️', cost: 250000, appeal: 0.03, welfare: 2, tags: ['all'], upkeep: 15000, days: 5, words: ['mist', 'misty', 'fog', 'foggy', 'cloud forest', 'humid'], line: 'misters that roll fog across the habitat on hot days' },
    beach: { name: 'Sandy beach', icon: '🏖️', cost: 300000, appeal: 0.02, welfare: 3, tags: ['swim'], upkeep: 8000, days: 10, words: ['beach', 'sand', 'sandy', 'shore', 'shoreline'], line: 'a sandy beach haul-out along the water' },
    skywalk: { name: 'Elevated skywalk', icon: '🌉', cost: 1300000, appeal: 0.1, welfare: -1, tags: [], upkeep: 25000, days: 60, words: ['skywalk', 'elevated', 'bridge', 'boardwalk', 'canopy walk', 'treetop', 'overlook', 'above'], line: 'an elevated skywalk that lets guests see from treetop height' },
    feedingDeck: { name: 'Guest feeding deck', icon: '🥬', cost: 450000, appeal: 0.08, welfare: -1, tags: [], upkeep: 30000, days: 20, words: ['feed', 'feeding', 'encounter', 'hand-feed', 'deck', 'up close', 'close up'], line: 'a raised encounter deck where guests can feed the animals (and pay for it)', revenue: 0.35 },
    amphitheater: { name: 'Keeper-talk amphitheater', icon: '🎭', cost: 700000, appeal: 0.05, welfare: 0, tags: [], upkeep: 15000, days: 30, words: ['amphitheater', 'amphitheatre', 'keeper talk', 'show', 'presentations', 'seating', 'arena', 'education'], line: 'a shaded amphitheater for keeper talks and training demos' },
    aviary: { name: 'Walk-through aviary netting', icon: '🕸️', cost: 1400000, appeal: 0.06, welfare: 2, tags: ['bird'], upkeep: 30000, days: 40, words: ['aviary', 'netting', 'net', 'walk-through', 'walkthrough', 'free-flight', 'free flight'], line: 'a soaring mesh canopy so birds fly free overhead' },
    shade: { name: 'Shade sails', icon: '⛱️', cost: 180000, appeal: 0.01, welfare: 2, tags: ['all'], upkeep: 5000, days: 5, words: ['shade', 'shaded', 'cool', 'cooling'], line: 'shade sails over the viewing areas and the animals’ favorite spots' },
    solar: { name: 'Solar & water recycling', icon: '☀️', cost: 700000, appeal: 0.01, welfare: 0, tags: [], upkeep: -60000, days: 15, words: ['solar', 'sustainable', 'eco', 'renewable', 'green energy', 'recycled', 'net zero', 'net-zero'], line: 'solar roofs and recycled water that cut the utility bill' },
    ruins: { name: 'Cultural theming', icon: '🛕', cost: 900000, appeal: 0.07, welfare: 1, tags: ['all'], upkeep: 10000, days: 30, words: ['temple', 'ruins', 'village', 'lodge', 'cultural', 'culture', 'story', 'storytelling', 'themed', 'theming', 'hut', 'huts'], line: 'cultural theming — carved stonework, a field station and storytelling' },
    playground: { name: 'Kids’ play zone', icon: '🛝', cost: 250000, appeal: 0.03, welfare: 0, tags: [], upkeep: 10000, days: 10, words: ['kids', 'children', 'playground', 'play area', 'splash pad', 'family', 'families'], line: 'a nature-play zone for kids beside the viewing area' },
  };

  const BIOME_WORDS = {
    tropical: ['tropical', 'rainforest', 'rain forest', 'jungle', 'island', 'hawaii', 'hawaiian', 'asian jungle'],
    forest: ['forest', 'woodland', 'congo', 'cloud forest', 'african forest'],
    savanna: ['savanna', 'savannah', 'plains', 'serengeti', 'grassland', 'safari', 'african plains', 'watering hole', 'kopje'],
    temperate: ['temperate', 'woods', 'meadow', 'pine', 'north american', 'prairie'],
    mountain: ['mountain', 'mountains', 'alpine', 'himalaya', 'himalayan', 'highlands', 'rocky', 'cliffs'],
    wetland: ['wetland', 'marsh', 'swamp', 'bayou', 'everglades', 'river bank', 'lagoon'],
    aquatic: ['ocean', 'coastal', 'coast', 'sea', 'marine', 'rocky shore', 'cove', 'harbor'],
    arctic: ['arctic', 'polar', 'tundra', 'ice', 'icy', 'snow', 'frozen'],
    australian: ['australia', 'australian', 'outback', 'eucalyptus', 'aussie'],
  };
  const TIER_WORDS = {
    premium: ['luxury', 'world-class', 'world class', 'immersive', 'stunning', 'spectacular', 'iconic', 'premium', 'flagship', 'signature', 'best', 'epic', 'amazing', 'no expense', 'big budget'],
    basic: ['cheap', 'budget', 'simple', 'basic', 'affordable', 'low-cost', 'low cost', 'modest', 'inexpensive', 'save money', 'small budget', 'frugal'],
  };
  const ALIASES = {
    lion: 'lion', lions: 'lion', 'big cats': 'lion', tiger: 'tiger', tigers: 'tiger', bear: 'bear', bears: 'bear', apes: 'gorilla', 'great apes': 'gorilla',
    monkey: 'ring_tailed_lemur', monkeys: 'ring_tailed_lemur', chimp: 'chimpanzee', chimps: 'chimpanzee', crocodile: 'alligator', crocodiles: 'alligator', gators: 'alligator',
    penguins: 'african_penguin', penguin: 'african_penguin', otters: 'river_otter', otter: 'river_otter', 'sea lions': 'sea_lion', 'sea lion': 'sea_lion', seals: 'sea_lion',
    wolves: 'mexican_wolf', wolf: 'mexican_wolf', 'wild dogs': 'african_wild_dog', 'painted dogs': 'african_wild_dog', eagles: 'california_condor', condors: 'california_condor', vultures: 'california_condor',
    geese: 'nene', goose: 'nene', nene: 'nene', tortoises: 'galapagos_tortoise', tortoise: 'galapagos_tortoise', turtles: 'galapagos_tortoise', lizards: 'komodo', reptiles: 'komodo', dragons: 'komodo',
    foxes: 'arctic_fox', fox: 'arctic_fox', camels: 'bactrian_camel', camel: 'bactrian_camel', goats: 'alpine_goat', buffalo: 'african_buffalo', panda: 'giant_panda', pandas: 'giant_panda',
    'red pandas': 'red_panda', 'red panda': 'red_panda', birds: 'flamingo', elephant: 'elephant', elephants: 'elephant', rhinos: 'white_rhino', rhino: 'white_rhino', hippos: 'hippo', hippo: 'hippo',
    kangaroos: 'red_kangaroo', roos: 'red_kangaroo', koalas: 'koala', ostriches: 'ostrich', flamingos: 'flamingo', flamingoes: 'flamingo', leopards: 'african_leopard', leopard: 'african_leopard',
    jaguars: 'jaguar', cheetahs: 'cheetah', 'snow leopards': 'snow_leopard', 'snow leopard': 'snow_leopard', 'clouded leopards': 'clouded_leopard', gorillas: 'gorilla', orangutans: 'orangutan',
    lemurs: 'ring_tailed_lemur', sloths: 'sloth', zebras: 'grevys_zebra', zebra: 'grevys_zebra', giraffes: 'giraffe', giraffe: 'giraffe', bison: 'bison', moose: 'moose', okapis: 'okapi',
    alpacas: 'alpaca', llamas: 'alpaca', donkeys: 'donkey', ibex: 'alpine_ibex', warthogs: 'warthog', bongos: 'bongo', 'polar bears': 'polar_bear', 'polar bear': 'polar_bear',
    'grizzly bears': 'grizzly_bear', grizzlies: 'grizzly_bear', 'black bears': 'black_bear', 'sun bears': 'sun_bear', 'andean bears': 'andean_bear', 'mountain lions': 'mountain_lion', cougars: 'mountain_lion', pumas: 'mountain_lion',
    'komodo dragons': 'komodo', 'water monitors': 'water_monitor', 'pygmy hippos': 'pygmy_hippo', 'pygmy hippo': 'pygmy_hippo',
  };
  const PRIMATES = ['gorilla', 'orangutan', 'chimpanzee', 'ring_tailed_lemur', 'sloth', 'red_panda', 'sun_bear', 'clouded_leopard', 'koala', 'andean_bear'];
  const WALLOWERS = ['african_elephant', 'asian_elephant', 'white_rhino', 'hippo', 'pygmy_hippo', 'warthog', 'african_buffalo', 'bison'];
  const CATS = ['lion', 'amur_tiger', 'sumatran_tiger', 'cheetah', 'snow_leopard', 'clouded_leopard', 'mountain_lion', 'african_leopard', 'jaguar'];
  D.tagsFor = function (spId) {
    const sp = ZG.SPECIES[spId];
    const t = ['all'];
    if (ZG.Models && ZG.Models.swims ? ZG.Models.swims(spId) : ['hippo', 'sea_lion', 'river_otter', 'african_penguin', 'polar_bear'].includes(spId)) t.push('swim');
    if (['hippo', 'sea_lion', 'river_otter', 'african_penguin', 'polar_bear', 'jaguar', 'sumatran_tiger', 'amur_tiger', 'pygmy_hippo', 'asian_elephant', 'african_elephant', 'grizzly_bear', 'alligator', 'water_monitor'].includes(spId)) t.push('swim');
    if (PRIMATES.includes(spId)) t.push('climb');
    if (WALLOWERS.includes(spId)) t.push('wallow');
    if (CATS.includes(spId)) t.push('cat');
    if (['giant_panda', 'red_panda'].includes(spId)) t.push('bamboo');
    if (sp.cls === 'bird') t.push('bird');
    if (sp.biomes.includes('mountain')) t.push('mountain');
    return t;
  };

  // ---------- Effects on the simulation ----------
  D.welfareBonus = function (h, spId) {
    if (!h.features || !h.features.length) return 0;
    const tags = D.tagsFor(spId);
    let b = 0;
    for (const f of h.features) {
      const F = D.FEATURES[f];
      if (!F) continue;
      if (F.tags.some((t) => tags.includes(t))) b += F.welfare;
      else if (F.welfare < 0) b += F.welfare;
    }
    const cond = h.condition != null ? h.condition : 100;
    return U.clamp(b * (0.3 + 0.7 * cond / 100), -5, 12);
  };
  D.appealMult = function (h) {
    let a = 0;
    for (const f of h.features || []) a += (D.FEATURES[f] || {}).appeal || 0;
    return 1 + a;
  };
  D.upkeep = function (h) {
    let u = 0;
    for (const f of h.features || []) u += (D.FEATURES[f] || {}).upkeep || 0;
    return u;
  };
  D.featureCost = (s, f) => Math.round(D.FEATURES[f].cost * ZG.zoo(s).costMult * ZG.mod(s, 'construction'));

  // ---------- Brief parsing ----------
  function speciesMatches(text) {
    const found = [];
    let t = ' ' + text.toLowerCase().replace(/[^a-zāēīōūʻ' -]/g, ' ') + ' ';
    const phrases = [];
    for (const id in ZG.SPECIES) {
      const n = ZG.SPECIES[id].name.toLowerCase().replace(/[()]/g, '');
      phrases.push([n, id]);
      phrases.push([n + 's', id]);
    }
    for (const k in ALIASES) phrases.push([k, ALIASES[k]]);
    phrases.sort((a, b) => b[0].length - a[0].length);
    for (const [ph, id] of phrases) {
      const re = new RegExp(`[ ,.]${ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ ,.]`);
      if (re.test(t)) {
        found.push(id);
        t = t.replace(re, ' ');
      }
    }
    return found;
  }

  D.parse = function (s, plot, text) {
    const Z = ZG.zoo(s);
    const low = ' ' + (text || '').toLowerCase() + ' ';
    const heard = [];
    // species
    let species = [];
    for (let id of speciesMatches(low)) {
      if (id === 'elephant') id = s.animals.some((a) => a.sp === 'african_elephant') || Z.id === 'sandiego' || Z.id === 'cheyenne' ? 'african_elephant' : 'asian_elephant';
      if (id === 'tiger') id = Math.max(...Z.climate.hi) > 88 ? 'sumatran_tiger' : 'amur_tiger';
      if (id === 'bear') id = Z.id === 'honolulu' || Z.id === 'houston' ? 'sun_bear' : 'grizzly_bear';
      if (ZG.SPECIES[id] && !species.includes(id)) species.push(id);
    }
    species = species.slice(0, 4);
    species.forEach((id) => heard.push(ZG.SPECIES[id].name + 's'));
    // biome
    let biome = null;
    let best = 0;
    for (const b in BIOME_WORDS) {
      const n = BIOME_WORDS[b].filter((w) => low.includes(w)).length;
      if (n > best) {
        best = n;
        biome = b;
      }
    }
    if (biome) heard.push(ZG.BIOMES[biome].name.toLowerCase());
    if (!biome && species.length) {
      const counts = {};
      for (const id of species) for (const b of ZG.SPECIES[id].biomes) counts[b] = (counts[b] || 0) + 1;
      biome = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    }
    if (!biome) biome = Z.id === 'cheyenne' ? 'mountain' : Z.id === 'honolulu' ? 'tropical' : 'savanna';
    // features
    const features = [];
    for (const f in D.FEATURES) if (D.FEATURES[f].words.some((w) => low.includes(w))) features.push(f);
    features.forEach((f) => heard.push(D.FEATURES[f].name.toLowerCase()));
    if (features.includes('underwaterView') && !features.includes('bigPool')) features.push('bigPool');
    // climate
    let climate = 'none';
    if (/indoor|greenhouse|glass ?house|heated|conservatory|warm house/.test(low)) climate = 'heated';
    if (/chilled|refrigerat|air.?condition|cold room|ice house/.test(low)) climate = 'chilled';
    // tier
    let tier = null;
    if (TIER_WORDS.premium.some((w) => low.includes(w))) tier = 'premium';
    if (TIER_WORDS.basic.some((w) => low.includes(w))) tier = 'basic';
    if (tier) heard.push(tier === 'premium' ? 'a world-class budget' : 'a tight budget');
    // name
    let name = null;
    const m = (text || '').match(/(?:called|named|name it|call it)\s+["“]?([A-Z][\w'’ -]{2,40})/i);
    if (m) name = m[1].replace(/["”.]+$/, '').trim();
    return { species, biome, features, climate, tier, name, heard };
  };

  // Climate control the intended species would need at this zoo
  D.neededClimate = function (s, species) {
    const Z = ZG.zoo(s);
    const hot = Math.max(...Z.climate.hi) + 6, cold = Math.min(...Z.climate.hi) - 22;
    let c = 'none';
    for (const id of species) {
      const sp = ZG.SPECIES[id];
      if (sp.climate[1] < hot - 4) c = 'chilled';
      else if (sp.climate[0] > cold + 18 && c === 'none') c = 'heated';
    }
    return c;
  };

  const NAME_BITS = {
    savanna: ['Savanna', 'Watering Hole', 'Kopje', 'Plains'], forest: ['Forest', 'Canopy', 'Trails'], tropical: ['Rainforest', 'Jungle', 'Falls'],
    temperate: ['Woodlands', 'Hollow', 'Meadow'], mountain: ['Highlands', 'Ridge', 'Peaks'], wetland: ['Wetlands', 'Bayou', 'Marsh'],
    aquatic: ['Shores', 'Cove', 'Coast'], arctic: ['Tundra', 'Ice Coast', 'Polar Plunge'], australian: ['Outback', 'Walkabout', 'Bush'],
  };
  function conceptName(s, parsed, flourish, r) {
    if (parsed.name) return parsed.name;
    const bits = NAME_BITS[parsed.biome];
    const sp = parsed.species[0] ? ZG.SPECIES[parsed.species[0]].name.split(' ').slice(-1)[0] : null;
    const b = bits[Math.floor(r() * bits.length)];
    if (flourish === 'underwaterView') return `${sp || b} Plunge`;
    if (flourish === 'skywalk') return `${b} Skywalk`;
    return sp ? `${sp} ${b}` : `${b} Habitat`;
  }

  function costOf(s, plot, tier, climate, features) {
    let c = ZG.Habitats.buildCost(s, plot, tier, climate);
    for (const f of features) c += D.featureCost(s, f);
    return Math.round(c / 1000) * 1000;
  }
  function daysOf(s, tier, features) {
    const Z = ZG.zoo(s);
    let d = ZG.Habitats.TIERS[tier].days * (Z.governance === 'city' || Z.governance === 'federal' ? 1.25 : 1);
    for (const f of features) d += D.FEATURES[f].days;
    return Math.round(d);
  }

  const SPECIES_ESSENTIALS = (species) => {
    const out = new Set();
    for (const id of species) {
      const tags = D.tagsFor(id);
      if (tags.includes('wallow')) out.add('mudWallow');
      if (tags.includes('bamboo')) out.add('bamboo');
      if (['hippo', 'sea_lion', 'river_otter', 'african_penguin', 'polar_bear', 'pygmy_hippo'].includes(id)) out.add('bigPool');
      if (PRIMATES.includes(id) && !['koala', 'sloth'].includes(id)) out.add('climbing');
      if (ZG.SPECIES[id].cls === 'bird' && id === 'california_condor') out.add('aviary');
      if (ZG.SPECIES[id].biomes.includes('mountain')) out.add('rockwork');
    }
    return [...out];
  };
  const FLOURISH = ['waterfall', 'skywalk', 'underwaterView', 'amphitheater', 'feedingDeck', 'stream', 'lush', 'ruins', 'mist'];

  // Build the three concept options from a brief
  D.concepts = function (s, plotId, text, opts) {
    opts = opts || {};
    const plot = s.plots[plotId];
    const parsed = D.parse(s, plot, text);
    const reno = opts.renovate ? s.habitatsById[opts.renovate] : null;
    if (reno) {
      // Redesigning an existing habitat: keep the current residents unless the brief names others.
      const residents = [...new Set(s.animals.filter((a) => a.hab === reno.id).map((a) => a.sp))];
      if (!parsed.species.length && residents.length) {
        parsed.species = residents.slice(0, 4);
        parsed.heard.unshift(`keep the ${residents.map((id) => ZG.SPECIES[id].name.toLowerCase() + 's').join(' and ')}`);
      }
      if (!BIOME_WORDS[parsed.biome] || !Object.keys(BIOME_WORDS).some((b) => BIOME_WORDS[b].some((w) => (' ' + (text || '').toLowerCase() + ' ').includes(w)))) {
        if (!parsed.species.length || parsed.species.every((id) => ZG.SPECIES[id].biomes.includes(reno.biome))) parsed.biome = reno.biome;
      }
    }
    const r = (() => {
      let t = (text || '').length * 7919 + plotId * 104729 + s.day;
      return () => {
        t = (t * 16807) % 2147483647;
        return (t - 1) / 2147483646;
      };
    })();
    const essentials = SPECIES_ESSENTIALS(parsed.species);
    const need = D.neededClimate(s, parsed.species);
    const climateA = parsed.climate !== 'none' ? parsed.climate : need;
    let featA = [...new Set(parsed.features.concat(essentials))];
    if (featA.length < 2) {
      const extra = parsed.biome === 'tropical' || parsed.biome === 'forest' ? ['lush', 'waterfall'] : parsed.biome === 'savanna' ? ['rockwork', 'shade'] : parsed.biome === 'arctic' || parsed.biome === 'aquatic' ? ['bigPool', 'beach'] : ['rockwork', 'cave'];
      for (const f of extra) if (!featA.includes(f) && featA.length < 3) featA.push(f);
    }
    const tierA = parsed.tier || 'standard';
    // B: value-engineered
    const tierB = tierA === 'premium' ? 'standard' : 'basic';
    let featB = featA.slice().sort((a, b) => D.FEATURES[a].cost - D.FEATURES[b].cost);
    const costA = costOf(s, plot, tierA, climateA, featA);
    while (costOf(s, plot, tierB, climateA, featB) > costA * 0.6) {
      const drop = featB.slice().reverse().find((f) => !essentials.includes(f));
      if (!drop) break;
      featB.splice(featB.indexOf(drop), 1);
    }
    if (featB.includes('underwaterView')) featB.splice(featB.indexOf('underwaterView'), 1);
    // C: signature landmark
    const tierC = 'premium';
    const featC = featA.slice();
    const pool = FLOURISH.filter((f) => !featC.includes(f) && (f !== 'underwaterView' || featC.includes('bigPool') || parsed.species.some((id) => D.tagsFor(id).includes('swim'))));
    let flourish = null;
    for (let i = 0; i < 2 && pool.length; i++) {
      const f = pool.splice(Math.floor(r() * pool.length), 1)[0];
      if (f === 'underwaterView' && !featC.includes('bigPool')) featC.push('bigPool');
      featC.push(f);
      flourish = flourish || f;
    }
    const mk = (key, title, tier, climate, features, pitchIntro, flourishKey) => {
      const cost = costOf(s, plot, tier, climate, features);
      const days = daysOf(s, tier, features);
      const cap = parsed.species.map((id) => `${ZG.SPECIES[id].name}: up to ${Math.max(1, Math.floor(plot.area / ZG.SPECIES[id].space))}`);
      const wel = parsed.species.map((id) => D.welfareBonus({ features }, id));
      const warnings = [];
      if (parsed.species.includes('giant_panda')) warnings.push('Giant pandas require a loan agreement with China (~$1M/yr) — the architect can build for them, but you still need the diplomacy.');
      if (parsed.species.length > 1) {
        const mixes = parsed.species.map((id) => ZG.SPECIES[id].mix);
        if (mixes.some((m) => !m || m !== mixes[0])) warnings.push('These species don’t normally share a yard — the design uses separated sub-yards, but mixing them in one habitat will hurt welfare.');
      }
      if (need !== 'none' && climate === 'none') warnings.push(`Without a ${need} building, ${parsed.species.map((id) => ZG.SPECIES[id].name).join(', ')} will suffer climate stress here.`);
      if (parsed.species.some((id) => !ZG.SPECIES[id].biomes.includes(parsed.biome))) warnings.push(`A ${ZG.BIOMES[parsed.biome].name.toLowerCase()} is not the natural habitat for all of these species.`);
      const lines = features.map((f) => D.FEATURES[f].line);
      const bn = ZG.BIOMES[parsed.biome].name.toLowerCase();
      const pitch = `${pitchIntro} ${/^[aeiou]/.test(bn) ? 'An' : 'A'} ${bn} landscape${parsed.species.length ? ' for ' + parsed.species.map((id) => ZG.SPECIES[id].name.toLowerCase() + 's').join(' and ') : ''}, with ${lines.length ? lines.slice(0, -1).join('; ') + (lines.length > 1 ? '; and ' : '') + lines[lines.length - 1] : 'simple, durable landscaping'}.${climate !== 'none' ? ` A ${climate} indoor building keeps them comfortable year-round.` : ''}`;
      return {
        key, title, name: conceptName(s, parsed, flourishKey, r), tier, climate, features, biome: parsed.biome, species: parsed.species, cost, days,
        appeal: Math.round((D.appealMult({ features }) - 1) * 100 + (ZG.Habitats.TIERS[tier].appeal - 1) * 100),
        welfare: wel.length ? Math.round(wel.reduce((a, b) => a + b, 0) / wel.length) : Math.round(D.welfareBonus({ features }, 'giraffe')),
        upkeep: D.upkeep({ features }), capacity: cap, warnings, pitch, seed: Math.floor(r() * 1e9), plot: plotId, brief: text,
      };
    };
    const out = {
      parsed,
      options: [
        mk('A', 'Your Vision', tierA, climateA, featA, 'Exactly what you described.', featA[0]),
        mk('B', 'Smart & Affordable', tierB, climateA === 'none' ? 'none' : climateA, featB, 'We value-engineered this to stretch your dollars while protecting what matters for the animals.', featB[0]),
        mk('C', 'Signature Landmark', tierC, climateA, [...new Set(featC)], 'Our boldest idea — a destination exhibit people travel to see.', flourish),
      ],
    };
    if (reno) {
      // A redesign reuses utilities and paths, but the old exhibit has to come out first.
      const demo = Math.round(reno.area * 60 * ZG.zoo(s).costMult);
      for (const o of out.options) {
        o.cost = Math.round((o.cost * 0.8 + demo) / 1000) * 1000;
        o.days = Math.round(o.days * 0.8);
        o.renovate = reno.id;
        const n = s.animals.filter((a) => a.hab === reno.id);
        for (const id of [...new Set(n.map((a) => a.sp))]) {
          const cap = Math.floor(reno.area / ZG.SPECIES[id].space);
          const have = n.filter((a) => a.sp === id).length;
          if (have > cap) o.warnings.push(`${have} ${ZG.SPECIES[id].name}s live here but the redesign fits ${cap}.`);
          if (!ZG.SPECIES[id].biomes.includes(o.biome)) o.warnings.push(`The ${ZG.SPECIES[id].name}s living here need ${ZG.SPECIES[id].biomes.map((b) => ZG.BIOMES[b].name).join(' or ')}; move them before it reopens.`);
        }
        if (!out.parsed.name) o.name = reno.name;
      }
    }
    return out;
  };

  D.fee = (s) => Math.round(18000 * Math.sqrt(ZG.zoo(s).infraScale) * ZG.zoo(s).costMult / 1000) * 1000;

  // Default features for the zoo's existing habitats, based on who lives there
  D.defaultsFor = function (s, h) {
    const sps = [...new Set(s.animals.filter((a) => a.hab === h.id).map((a) => a.sp))];
    const f = new Set(SPECIES_ESSENTIALS(sps));
    if (/Plunge|Hippo Trail|Sea Lion|Penguin Beach|Water/.test(h.name) && sps.some((id) => D.tagsFor(id).includes('swim'))) {
      f.add('bigPool');
      f.add('underwaterView');
    }
    if (sps.includes('giraffe') && ZG.zoo(s).giraffeFeed) f.add('feedingDeck');
    if (/Galápagos|Odyssey|Panda|Rift|Gorilla Forest/.test(h.name)) f.add('lush');
    if (/Penguin|Beach|Shores/.test(h.name)) f.add('beach');
    return [...f].filter((x) => D.FEATURES[x]);
  };
})((globalThis.ZG = globalThis.ZG || {}));
