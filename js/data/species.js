// Species database. Numbers are gameplay approximations of real husbandry:
// space = m² needed per animal, care = keeper workload per animal,
// food = annual diet + routine vet supplies ($), fert = daily conception odds
// once a compatible pair is together, appeal = guest draw per individual.
(function (ZG) {
  const S = (ZG.SPECIES = {});
  function sp(id, o) {
    S[id] = Object.assign(
      {
        id,
        program: 'none',
        breeds: true,
        litter: [1, 1],
        fert: 1 / 150,
        infantSurv: 0.82,
        danger: 0,
        vetRisk: 1,
        mix: null,
        size: 24,
        rejectRisk: 0.06,
        heavy: 0,
        diseases: [],
        behaviors: ['resting in the shade', 'exploring', 'foraging'],
      },
      o
    );
  }

  sp('african_elephant', { name: 'African Elephant', sci: 'Loxodonta africana', emoji: '🐘', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['savanna'], climate: [28, 100], space: 1150, group: [3, 8], life: 45, mature: 10, gestation: 660, interbirth: 1460,
    fert: 1 / 420, care: 0.9, food: 34000, appeal: 10, danger: 3, transport: 95000, size: 36, heavy: 3, infantSurv: 0.8,
    diseases: ['Foot abscess', 'Tuberculosis-positive trunk wash', 'Arthritis flare'],
    behaviors: ['dust-bathing', 'rumbling to the herd', 'wallowing in the mud', 'browsing acacia', 'playing with a log', 'splashing in the pool'] });
  sp('asian_elephant', { name: 'Asian Elephant', sci: 'Elephas maximus', emoji: '🐘', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['forest', 'tropical'], climate: [38, 100], space: 1100, group: [3, 8], life: 48, mature: 9, gestation: 650, interbirth: 1460,
    fert: 1 / 420, care: 0.9, food: 32000, appeal: 10, danger: 3, transport: 95000, size: 36, heavy: 3, infantSurv: 0.8,
    diseases: ['EEHV (elephant herpesvirus)', 'Foot abscess', 'Tuberculosis-positive trunk wash'],
    behaviors: ['bathing in the pool', 'dust-bathing', 'solving a puzzle feeder', 'napping standing up', 'chirping to her calf'] });
  sp('giraffe', { name: 'Reticulated Giraffe', sci: 'Giraffa reticulata', emoji: '🦒', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['savanna'], climate: [38, 100], space: 330, group: [3, 16], life: 25, mature: 4, gestation: 450, interbirth: 540,
    fert: 1 / 110, care: 0.25, food: 9000, appeal: 7, danger: 1, transport: 45000, size: 32, mix: 'plains', heavy: 1,
    diseases: ['Hoof overgrowth', 'Gastrointestinal illness', 'Capture myopathy scare'],
    behaviors: ['browsing high branches', 'necking playfully', 'peering over the fence', 'ruminating'] });
  sp('grevys_zebra', { name: "Grévy's Zebra", sci: 'Equus grevyi', emoji: '🦓', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['savanna'], climate: [34, 102], space: 260, group: [3, 10], life: 22, mature: 3, gestation: 395, interbirth: 450,
    fert: 1 / 110, care: 0.15, food: 4200, appeal: 4, danger: 1, transport: 22000, size: 26, mix: 'plains',
    behaviors: ['grazing', 'rolling in the dust', 'squabbling', 'grooming a herd-mate'] });
  sp('white_rhino', { name: 'Southern White Rhino', sci: 'Ceratotherium simum', emoji: '🦏', cls: 'mammal', iucn: 'NT', program: 'SSP',
    biomes: ['savanna'], climate: [34, 100], space: 700, group: [2, 6], life: 40, mature: 6, gestation: 490, interbirth: 900,
    fert: 1 / 260, care: 0.4, food: 12000, appeal: 8, danger: 2, transport: 60000, size: 32, mix: 'plains', heavy: 2,
    behaviors: ['grazing', 'wallowing', 'napping in the mud', 'scent-marking'] });
  sp('hippo', { name: 'Hippopotamus', sci: 'Hippopotamus amphibius', emoji: '🦛', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['wetland'], climate: [45, 102], space: 650, group: [2, 5], life: 45, mature: 7, gestation: 240, interbirth: 700,
    fert: 1 / 200, care: 0.45, food: 11000, appeal: 8, danger: 3, transport: 55000, size: 32, heavy: 2,
    behaviors: ['submerged with only eyes showing', 'yawning enormously', 'eating a whole pumpkin', 'splashing'] });
  sp('pygmy_hippo', { name: 'Pygmy Hippo', sci: 'Choeropsis liberiensis', emoji: '🦛', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['forest', 'tropical', 'wetland'], climate: [55, 100], space: 180, group: [1, 2], life: 40, mature: 4, gestation: 190,
    interbirth: 400, fert: 1 / 180, care: 0.2, food: 5000, appeal: 7, danger: 1, transport: 25000, size: 24,
    behaviors: ['snoozing in the pool', 'nibbling greens', 'wiggling its tail', 'being sassy to a keeper'] });
  sp('lion', { name: 'African Lion', sci: 'Panthera leo', emoji: '🦁', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['savanna'], climate: [28, 104], space: 300, group: [2, 6], life: 17, mature: 3, gestation: 110, litter: [1, 4],
    interbirth: 600, fert: 1 / 90, care: 0.3, food: 9500, appeal: 8, danger: 3, transport: 16000, size: 28, infantSurv: 0.78,
    rejectRisk: 0.12, diseases: ['Chronic kidney disease', 'Dental fracture', 'Laceration from pride-mate'],
    behaviors: ['sleeping on the warm rock', 'roaring at dusk', 'stalking a boomer ball', 'grooming'] });
  sp('amur_tiger', { name: 'Amur Tiger', sci: 'Panthera tigris altaica', emoji: '🐅', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['temperate', 'mountain'], climate: [-5, 86], space: 350, group: [1, 3], life: 16, mature: 3, gestation: 105,
    litter: [1, 4], interbirth: 700, fert: 1 / 120, care: 0.3, food: 10000, appeal: 9, danger: 3, transport: 16000, size: 30,
    rejectRisk: 0.15, diseases: ['Chronic kidney disease', 'Dental fracture', 'Arthritis flare'],
    behaviors: ['pacing the ridge', 'swimming', 'chuffing', 'rolling in straw'] });
  sp('sumatran_tiger', { name: 'Sumatran Tiger', sci: 'Panthera tigris sondaica', emoji: '🐅', cls: 'mammal', iucn: 'CR', program: 'SSP',
    biomes: ['tropical', 'forest'], climate: [45, 102], space: 320, group: [1, 3], life: 16, mature: 3, gestation: 105,
    litter: [1, 3], interbirth: 700, fert: 1 / 120, care: 0.3, food: 9000, appeal: 9, danger: 3, transport: 16000, size: 30,
    rejectRisk: 0.15, diseases: ['Chronic kidney disease', 'Dental fracture'],
    behaviors: ['swimming in the stream', 'napping on a platform', 'stalking the keeper door', 'chuffing'] });
  sp('cheetah', { name: 'Cheetah', sci: 'Acinonyx jubatus', emoji: '🐆', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['savanna'], climate: [34, 104], space: 350, group: [1, 4], life: 12, mature: 2, gestation: 93, litter: [2, 5],
    interbirth: 500, fert: 1 / 260, care: 0.3, food: 8000, appeal: 7, danger: 2, transport: 14000, size: 26, rejectRisk: 0.2,
    infantSurv: 0.7, diseases: ['Gastritis (Helicobacter)', 'Chronic kidney disease'],
    behaviors: ['sprinting after a lure', 'surveying from a termite mound', 'purring', 'napping'] });
  sp('snow_leopard', { name: 'Snow Leopard', sci: 'Panthera uncia', emoji: '🐆', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['mountain'], climate: [-25, 80], space: 220, group: [1, 2], life: 17, mature: 3, gestation: 100, litter: [1, 3],
    interbirth: 700, fert: 1 / 140, care: 0.25, food: 7000, appeal: 7, danger: 2, transport: 12000, size: 24, rejectRisk: 0.12,
    behaviors: ['perched on a high rock', 'wrapping its tail around its nose', 'stalking along a ledge'] });
  sp('clouded_leopard', { name: 'Clouded Leopard', sci: 'Neofelis nebulosa', emoji: '🐆', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['forest', 'tropical'], climate: [45, 96], space: 140, group: [1, 2], life: 15, mature: 2, gestation: 90, litter: [1, 3],
    interbirth: 600, fert: 1 / 220, care: 0.2, food: 6000, appeal: 6, danger: 2, transport: 12000, size: 22, rejectRisk: 0.3,
    behaviors: ['climbing upside down', 'napping on a branch', 'watching birds'] });
  sp('mountain_lion', { name: 'Mountain Lion', sci: 'Puma concolor', emoji: '🐆', cls: 'mammal', iucn: 'LC', breeds: false,
    biomes: ['mountain', 'temperate'], climate: [-10, 96], space: 220, group: [1, 3], life: 15, mature: 2, gestation: 92,
    care: 0.2, food: 6000, appeal: 5, danger: 3, transport: 5000, size: 26,
    behaviors: ['perched on the rocks', 'grooming its sibling', 'watching the guests intently'] });
  sp('gorilla', { name: 'Western Lowland Gorilla', sci: 'Gorilla gorilla gorilla', emoji: '🦍', cls: 'mammal', iucn: 'CR',
    program: 'SSP', biomes: ['forest', 'tropical'], climate: [52, 100], space: 260, group: [3, 8], life: 38, mature: 10,
    gestation: 257, interbirth: 1400, fert: 1 / 300, care: 0.4, food: 6500, appeal: 9, danger: 2, transport: 30000, size: 30,
    rejectRisk: 0.15, diseases: ['Cardiac disease (fibrosing cardiomyopathy)', 'Respiratory virus (human-transmitted)', 'Dental abscess'],
    behaviors: ['chest-beating', 'building a nest', 'the silverback keeping watch', 'playing chase', 'sorting browse'] });
  sp('orangutan', { name: 'Bornean Orangutan', sci: 'Pongo pygmaeus', emoji: '🦧', cls: 'mammal', iucn: 'CR', program: 'SSP',
    biomes: ['forest', 'tropical'], climate: [55, 100], space: 220, group: [2, 5], life: 42, mature: 12, gestation: 245,
    interbirth: 2400, fert: 1 / 420, care: 0.35, food: 5500, appeal: 8, danger: 2, transport: 28000, size: 28, rejectRisk: 0.2,
    diseases: ['Air sacculitis', 'Respiratory virus (human-transmitted)', 'Cardiac disease'],
    behaviors: ['swinging across the ropes', 'wearing a burlap sack as a hat', 'painting', 'using a stick tool'] });
  sp('chimpanzee', { name: 'Chimpanzee', sci: 'Pan troglodytes', emoji: '🐒', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['forest', 'tropical'], climate: [50, 100], space: 200, group: [4, 12], life: 42, mature: 11, gestation: 230,
    interbirth: 1600, fert: 1 / 300, care: 0.35, food: 5000, appeal: 7, danger: 3, transport: 25000, size: 24, rejectRisk: 0.15,
    diseases: ['Respiratory virus (human-transmitted)', 'Cardiac disease', 'Bite wounds from a dominance fight'],
    behaviors: ['termite-fishing at the mound', 'pant-hooting', 'grooming in a circle', 'a dominance display'] });
  sp('ring_tailed_lemur', { name: 'Ring-tailed Lemur', sci: 'Lemur catta', emoji: '🐒', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['tropical', 'forest'], climate: [45, 100], space: 50, group: [4, 12], life: 20, mature: 2.5, gestation: 135,
    litter: [1, 2], interbirth: 365, fert: 1 / 90, care: 0.06, food: 900, appeal: 3.5, transport: 4000, size: 18,
    behaviors: ['sunbathing like yoga', 'stink-fighting', 'leaping between perches'] });
  sp('giant_panda', { name: 'Giant Panda', sci: 'Ailuropoda melanoleuca', emoji: '🐼', cls: 'mammal', iucn: 'VU', program: 'Loan',
    biomes: ['forest', 'temperate'], climate: [15, 84], space: 350, group: [1, 2], life: 26, mature: 5, gestation: 135, litter: [1, 2],
    interbirth: 730, fert: 1 / 1400, care: 0.5, food: 70000, appeal: 14, danger: 1, transport: 150000, size: 30, infantSurv: 0.7,
    diseases: ['Mucoid stool episode', 'Pseudopregnancy complications'],
    behaviors: ['eating bamboo (for the 14th hour)', 'rolling down the hill', 'napping in a tree fork'] });
  sp('red_panda', { name: 'Red Panda', sci: 'Ailurus fulgens', emoji: '🦝', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['temperate', 'mountain', 'forest'], climate: [-5, 78], space: 50, group: [1, 2], life: 13, mature: 2, gestation: 130,
    litter: [1, 3], interbirth: 365, fert: 1 / 100, care: 0.08, food: 3200, appeal: 5, transport: 5000, size: 18, infantSurv: 0.7,
    behaviors: ['curled up in a tree', 'eating bamboo shoots', 'standing up to look big'] });
  sp('grizzly_bear', { name: 'Grizzly Bear', sci: 'Ursus arctos horribilis', emoji: '🐻', cls: 'mammal', iucn: 'LC', breeds: false,
    biomes: ['mountain', 'temperate'], climate: [-30, 86], space: 350, group: [1, 3], life: 28, mature: 5, gestation: 220,
    care: 0.3, food: 8500, appeal: 7, danger: 3, transport: 12000, size: 30,
    behaviors: ['fishing for trout in the stream', 'digging', 'scratching on a tree', 'dozing'] });
  sp('sun_bear', { name: 'Sun Bear', sci: 'Helarctos malayanus', emoji: '🐻', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['tropical', 'forest'], climate: [55, 100], space: 180, group: [1, 3], life: 25, mature: 4, gestation: 100, litter: [1, 2],
    interbirth: 500, fert: 1 / 200, care: 0.25, food: 5000, appeal: 5, danger: 2, transport: 12000, size: 24,
    behaviors: ['licking honey from a log', 'climbing', 'standing on hind legs'] });
  sp('andean_bear', { name: 'Andean Bear', sci: 'Tremarctos ornatus', emoji: '🐻', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['forest', 'mountain'], climate: [28, 90], space: 220, group: [1, 2], life: 25, mature: 4, gestation: 200, litter: [1, 2],
    interbirth: 700, fert: 1 / 250, care: 0.25, food: 5000, appeal: 6, danger: 2, transport: 12000, size: 26,
    behaviors: ['climbing', 'eating avocados', 'napping in a hammock'] });
  sp('polar_bear', { name: 'Polar Bear', sci: 'Ursus maritimus', emoji: '🐻‍❄️', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['arctic'], climate: [-40, 70], space: 550, group: [1, 3], life: 26, mature: 5, gestation: 230, litter: [1, 2],
    interbirth: 1100, fert: 1 / 500, care: 0.45, food: 15000, appeal: 11, danger: 3, transport: 60000, size: 32, infantSurv: 0.6,
    behaviors: ['swimming past the underwater window', 'playing with an ice block', 'sleeping sprawled out'] });
  sp('koala', { name: 'Koala', sci: 'Phascolarctos cinereus', emoji: '🐨', cls: 'mammal', iucn: 'VU', program: 'SSP',
    biomes: ['australian'], climate: [42, 92], space: 35, group: [2, 10], life: 13, mature: 3, gestation: 35, interbirth: 365,
    fert: 1 / 150, care: 0.2, food: 12500, appeal: 6, transport: 20000, size: 20,
    diseases: ['Chlamydia', 'Koala retrovirus-linked lymphoma'],
    behaviors: ['asleep in a eucalyptus fork', 'chewing eucalyptus', 'bellowing'] });
  sp('red_kangaroo', { name: 'Red Kangaroo', sci: 'Osphranter rufus', emoji: '🦘', cls: 'mammal', iucn: 'LC',
    biomes: ['australian', 'savanna'], climate: [30, 105], space: 160, group: [3, 12], life: 18, mature: 2, gestation: 33,
    interbirth: 300, fert: 1 / 80, care: 0.08, food: 1600, appeal: 4, transport: 6000, size: 24,
    behaviors: ['lounging on its side', 'boxing', 'a joey peeking out of the pouch'] });
  sp('komodo', { name: 'Komodo Dragon', sci: 'Varanus komodoensis', emoji: '🦎', cls: 'reptile', iucn: 'EN', program: 'SSP',
    biomes: ['tropical'], climate: [68, 106], space: 70, group: [1, 2], life: 30, mature: 7, gestation: 240, litter: [3, 10],
    interbirth: 730, fert: 1 / 250, care: 0.15, food: 3000, appeal: 7, danger: 2, transport: 20000, size: 24, infantSurv: 0.75,
    diseases: ['Stomatitis', 'Respiratory infection'],
    behaviors: ['basking under the heat lamp', 'flicking its tongue', 'patrolling'] });
  sp('galapagos_tortoise', { name: 'Galápagos Tortoise', sci: 'Chelonoidis niger', emoji: '🐢', cls: 'reptile', iucn: 'VU',
    program: 'SSP', biomes: ['tropical', 'savanna'], climate: [60, 102], space: 130, group: [2, 8], life: 120, mature: 25,
    gestation: 200, litter: [3, 10], interbirth: 730, fert: 1 / 200, care: 0.08, food: 2200, appeal: 5, transport: 10000,
    size: 24, infantSurv: 0.7, diseases: ['Respiratory infection', 'Shell rot'],
    behaviors: ['getting a neck scratch', 'wallowing in the mud', 'munching hibiscus', 'not moving at all'] });
  sp('alligator', { name: 'American Alligator', sci: 'Alligator mississippiensis', emoji: '🐊', cls: 'reptile', iucn: 'LC',
    breeds: false, biomes: ['wetland'], climate: [55, 104], space: 90, group: [2, 8], life: 50, mature: 10, gestation: 65,
    care: 0.05, food: 1100, appeal: 4, danger: 3, transport: 3000, size: 26,
    behaviors: ['floating like a log', 'basking with mouth open', 'bellowing'] });
  sp('flamingo', { name: 'American Flamingo', sci: 'Phoenicopterus ruber', emoji: '🦩', cls: 'bird', iucn: 'LC', program: 'SSP',
    biomes: ['wetland'], climate: [35, 104], space: 14, group: [15, 45], life: 40, mature: 5, gestation: 30, interbirth: 365,
    fert: 1 / 120, care: 0.02, food: 450, appeal: 0.55, transport: 1500, size: 16, mix: 'birds',
    diseases: ['Bumblefoot', 'Avian tuberculosis'], behaviors: ['marching in a group display', 'standing on one leg', 'filter-feeding'] });
  sp('african_penguin', { name: 'African Penguin', sci: 'Spheniscus demersus', emoji: '🐧', cls: 'bird', iucn: 'CR', program: 'SSP',
    biomes: ['aquatic'], climate: [38, 88], space: 10, group: [12, 40], life: 20, mature: 4, gestation: 40, litter: [1, 2],
    interbirth: 365, fert: 1 / 100, care: 0.03, food: 950, appeal: 0.8, transport: 2000, size: 16,
    diseases: ['Avian malaria', 'Bumblefoot', 'Aspergillosis'], behaviors: ['porpoising through the pool', 'braying like a donkey', 'preening'] });
  sp('nene', { name: 'Nēnē (Hawaiian Goose)', sci: 'Branta sandvicensis', emoji: '🪿', cls: 'bird', iucn: 'VU', program: 'SSP',
    biomes: ['wetland', 'tropical'], climate: [45, 96], space: 25, group: [4, 20], life: 25, mature: 2, gestation: 30, litter: [2, 5],
    interbirth: 365, fert: 1 / 90, care: 0.03, food: 400, appeal: 0.9, transport: 1500, size: 16, mix: 'birds',
    behaviors: ['grazing on the lawn', 'honking softly', 'guarding goslings'] });
  sp('california_condor', { name: 'California Condor', sci: 'Gymnogyps californianus', emoji: '🦅', cls: 'bird', iucn: 'CR',
    program: 'SSP', biomes: ['mountain'], climate: [28, 98], space: 55, group: [2, 6], life: 50, mature: 6, gestation: 57,
    interbirth: 365, fert: 1 / 160, care: 0.1, food: 2600, appeal: 3, transport: 5000, size: 22,
    diseases: ['Lead toxicosis (wild-release bird)'], behaviors: ['sunning with wings spread', 'soaring the flight cage'] });
  sp('mexican_wolf', { name: 'Mexican Gray Wolf', sci: 'Canis lupus baileyi', emoji: '🐺', cls: 'mammal', iucn: 'EN', program: 'SSP',
    biomes: ['mountain', 'temperate'], climate: [-20, 92], space: 220, group: [3, 8], life: 14, mature: 2, gestation: 63,
    litter: [3, 7], interbirth: 365, fert: 1 / 110, care: 0.12, food: 3600, appeal: 5, danger: 2, transport: 5000, size: 24,
    behaviors: ['howling with the pack', 'trotting the fence line', 'napping in a pile'] });
  sp('moose', { name: 'Moose', sci: 'Alces alces', emoji: '🫎', cls: 'mammal', iucn: 'LC', breeds: false, biomes: ['mountain', 'temperate'],
    climate: [-40, 75], space: 350, group: [1, 3], life: 18, mature: 3, gestation: 240, care: 0.25, food: 8000, appeal: 6,
    danger: 2, transport: 15000, size: 32, behaviors: ['standing in the pond', 'browsing willow', 'lying in the snow'] });
  sp('bison', { name: 'American Bison', sci: 'Bison bison', emoji: '🦬', cls: 'mammal', iucn: 'NT', biomes: ['temperate'],
    climate: [-30, 100], space: 500, group: [3, 12], life: 20, mature: 3, gestation: 285, interbirth: 365, fert: 1 / 120,
    care: 0.12, food: 3200, appeal: 4, danger: 2, transport: 10000, size: 30, heavy: 1,
    behaviors: ['wallowing in a dust bowl', 'grazing', 'shedding a winter coat'] });
  sp('sea_lion', { name: 'California Sea Lion', sci: 'Zalophus californianus', emoji: '🦭', cls: 'mammal', iucn: 'LC', breeds: false,
    biomes: ['aquatic'], climate: [38, 96], space: 70, group: [3, 10], life: 25, mature: 5, gestation: 330, care: 0.2, food: 7500,
    appeal: 7, transport: 15000, size: 24, diseases: ['Eye cataracts', 'Domoic acid aftereffects'],
    behaviors: ['barking', 'zooming past the window', 'training session with a keeper', 'hauled out sunbathing'] });
  sp('river_otter', { name: 'North American River Otter', sci: 'Lontra canadensis', emoji: '🦦', cls: 'mammal', iucn: 'LC',
    breeds: false, biomes: ['aquatic', 'wetland', 'temperate'], climate: [15, 96], space: 50, group: [2, 4], life: 16, mature: 2,
    gestation: 60, care: 0.1, food: 3000, appeal: 6, transport: 4000, size: 18,
    behaviors: ['juggling a pebble', 'sliding down the bank', 'eating fish on its back'] });
  sp('sloth', { name: "Linnaeus's Two-toed Sloth", sci: 'Choloepus didactylus', emoji: '🦥', cls: 'mammal', iucn: 'LC',
    biomes: ['tropical'], climate: [65, 96], space: 35, group: [1, 3], life: 30, mature: 3, gestation: 330, interbirth: 500,
    fert: 1 / 150, care: 0.05, food: 1000, appeal: 5, transport: 4000, size: 20, behaviors: ['hanging very still', 'slowly eating a green bean'] });
  sp('bongo', { name: 'Eastern Bongo', sci: 'Tragelaphus eurycerus isaaci', emoji: '🦌', cls: 'mammal', iucn: 'CR', program: 'SSP',
    biomes: ['forest', 'savanna'], climate: [40, 100], space: 250, group: [2, 6], life: 20, mature: 2.5, gestation: 285,
    interbirth: 400, fert: 1 / 120, care: 0.15, food: 4000, appeal: 4, danger: 1, transport: 15000, size: 26, mix: 'plains',
    behaviors: ['browsing', 'hiding in the thicket', 'licking a salt block'] });
  sp('warthog', { name: 'Common Warthog', sci: 'Phacochoerus africanus', emoji: '🐗', cls: 'mammal', iucn: 'LC', biomes: ['savanna'],
    climate: [45, 104], space: 120, group: [2, 5], life: 15, mature: 2, gestation: 170, litter: [2, 4], interbirth: 365,
    fert: 1 / 100, care: 0.07, food: 1500, appeal: 3, transport: 4000, size: 20, mix: 'plains',
    behaviors: ['kneeling to graze', 'running with its tail straight up', 'mud-wallowing'] });

  ZG.BIOMES = {
    savanna: { name: 'African Savanna', ground: '#d9c27e', dark: '#b89a52', deco: ['🌳', '🪨'] },
    forest: { name: 'Rainforest / Forest', ground: '#5f8f4e', dark: '#3f6b35', deco: ['🌳', '🌲', '🌿'] },
    tropical: { name: 'Tropical', ground: '#7db35c', dark: '#4f8a3a', deco: ['🌴', '🌺', '🌿'] },
    temperate: { name: 'Temperate Woodland', ground: '#8aa860', dark: '#667f45', deco: ['🌲', '🍂', '🪨'] },
    mountain: { name: 'Mountain / Rocky', ground: '#a3a08f', dark: '#77756a', deco: ['🪨', '🌲', '⛰️'] },
    wetland: { name: 'Wetland', ground: '#79a88b', dark: '#4d7f63', deco: ['🌾', '🪷'] },
    aquatic: { name: 'Aquatic / Coastal', ground: '#e3d7b0', dark: '#bfae7b', deco: ['🪨', '🐚'] },
    arctic: { name: 'Arctic', ground: '#e8f1f5', dark: '#b8cfd9', deco: ['🧊', '🪨'] },
    australian: { name: 'Australian Outback', ground: '#d99a5e', dark: '#b0703a', deco: ['🌳', '🪨'] },
  };

  ZG.GENERIC_ILLNESS = {
    mammal: ['Gastrointestinal illness', 'Dental abscess', 'Respiratory infection', 'Arthritis flare', 'Kidney disease', 'Suspicious mass (possible cancer)', 'Laceration'],
    bird: ['Aspergillosis', 'Bumblefoot', 'Respiratory infection', 'Egg binding'],
    reptile: ['Respiratory infection', 'Stomatitis', 'Parasite load', 'Egg binding'],
  };
})((globalThis.ZG = globalThis.ZG || {}));
