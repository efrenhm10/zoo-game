# 🦒 Zoo Director

A browser-based **zoo management simulation** inspired by *Planet Zoo* — but focused on the real job of running an American zoo. You won't be clicking to feed every animal. You'll be fighting for budgets, managing the collection with the AZA, keeping up with deferred maintenance, courting donors and sponsors, and making hard calls when an animal gets sick or a hurricane heads your way.

It's a **3D game** that runs in your browser (WebGL via a bundled copy of Three.js). You get an aerial park with rolling terrain, lakes and forest; naturalistic habitats with hills, ponds, rocks and trees; fences and glass houses; animated low-poly animals for all 56 species; crowds of guests; and weather. The interface is modeled on *Planet Zoo 2*: cream tool windows, a green bottom toolbar, and field-guide roundel portraits of every animal. There is no build step and nothing to install.

## ▶️ Play

- **Locally:** open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
  If your browser blocks local files, serve the folder instead, for example with `npx http-server .` or `python3 -m http.server`, then open the URL it prints.
- **GitHub Pages:** go to *Settings → Pages*, deploy from the `main` branch root, then open the published URL.

The game autosaves to your browser every in-game month.

## 🧑‍💼 Create your director

1. **You:** name, age and appearance (skin, hair, outfit, hat).
2. **Education:** school, field of study (Zoology, Veterinary Medicine, Public Administration, Business, Nonprofit Management, Communications, Engineering…), and degree level (none → Associate's → Bachelor's → Master's → Doctorate). A higher degree multiplies your field bonus.
3. **Career background:** the careers you can pick depend on your age. For example, you can't be a former two-term council member at 25. Years of experience strengthen your bonuses. Each background has real **strengths and weaknesses**. A former keeper boosts animal welfare and morale but is weak at fundraising, and a City Budget Director wins budget fights but struggles to cultivate donors. These modifiers change the simulation itself, not just a label.
4. **Choose your zoo:** each zoo has a full profile. It shows annual attendance, operating budget, collection size, staff, members, admission price, public funding, deferred-maintenance backlog, the next AZA inspection, strengths, weaknesses, natural hazards, where the money comes from, and how well *you* fit the job.

## 🏛️ The five zoos

| Zoo | Governance | What makes it hard |
|---|---|---|
| 🌺 **Honolulu Zoo** | City department (Mayor & Council) | Admission changes need a Council ordinance, civil-service hiring, island shipping costs, a looming accreditation inspection, the worst maintenance backlog |
| 🐼 **San Diego Zoo** | Private nonprofit + City Charter levy | Plenty of money, but reputation losses are amplified; wildfire and drought; panda loans |
| 🏛️ **Smithsonian's National Zoo** | Federal (Congress) | Free admission (no ticket revenue), a shutdown risk every October 1, slow federal hiring, a huge backlog |
| 🐘 **Houston Zoo** | Nonprofit under a City management agreement | Hurricanes, floods, heat, grid-failing freezes, EEHV in the elephant herd, contract renewal |
| 🦒 **Cheyenne Mountain Zoo** | Private nonprofit, no tax support | Extreme seasonality, blizzards, wildfire, steep-terrain construction; giraffe herd management |

Figures are gameplay approximations inspired by the real institutions. Animal names are fictional.

## 🗺️ Real surroundings

Each zoo sits in a recreation of its real neighborhood:

| Zoo | What's around it |
|---|---|
| Honolulu | Kapiʻolani Park in Waikīkī: Diamond Head, the beach and the Pacific, hotel towers, Kapahulu homes, the Koʻolau mountains, Kalākaua Ave traffic |
| Houston | Hermann Park: McGovern Lake with pedal boats, the downtown skyline, Texas Medical Center towers, METRORail on Main St, Brays Bayou |
| San Diego | Balboa Park's mesa and canyons: El Prado's Spanish Colonial buildings and the California Tower, Cabrillo Bridge, SR-163, downtown and the bay, eucalyptus and jacaranda |
| National Zoo | The wooded Rock Creek valley and creek, Woodley Park rowhouses on Connecticut Ave, the Washington Monument and Capitol dome on the horizon |
| Cheyenne Mountain | A pine-covered mountainside, the Will Rogers Shrine, the Sky Ride chairlift, the Broadmoor below, and Colorado Springs on the plains |

## 📐 Designing habitats with an architect

Click an available lot and choose **Meet with the architect**. Describe your idea in plain words, for example: *"A misty Sumatran rainforest for tigers with a waterfall, a pool with an underwater viewing tunnel and a keeper-talk amphitheater. Make it world-class. Call it Tiger Falls."* The architect picks out the animals, landscape, features, budget and name you mention, then presents **three rendered concepts**:

- **Your Vision:** what you described.
- **Smart & Affordable:** value-engineered, but it never drops what the animals need.
- **Signature Landmark:** premium, plus a flourish or two.

Each concept shows its cost, build time, guest appeal, welfare boost, upkeep, capacity and warnings (climate, species mixing, panda loans). You can build it or save it and launch a campaign for it. There are 21 features: pools, underwater tunnels, waterfalls, streams, rockwork, climbing structures, caves, mud wallows, bamboo, misting, beaches, skywalks, feeding decks, amphitheaters, aviaries, shade sails, solar power, cultural theming, play zones and more. They're built in 3D and they change animal welfare, guest appeal, upkeep and even income (feeding decks earn money).

## 🎮 What you manage

- **Camera (manage mode).** Drag to pan, right-drag (or Shift+drag) to rotate, scroll to zoom, and use `WASD`/arrows to move and `Q`/`E` to rotate. Click a habitat to manage it.
- **Walk the grounds.** Press `Tab` (or 🚶 Walk) to control your avatar with `WASD`/arrow keys (hold `Shift` to jog), or click where you want to go. Stand at a habitat and press `E` to observe each animal: its name, age and what it's doing right now. You'll also hear from keepers and see guest thought bubbles that reflect the actual simulation ("$40 for tickets?!", "the restrooms are closed again", "a baby giraffe!").
- **Collection & AZA Species Survival Plans.** Animals are on contraception by default. Each February the SSP publishes Breeding & Transfer Plans: breed this pair, send this animal to another zoo, receive a mate, do *not* breed, or hold space for a species. Following them earns AZA standing; unplanned or inbred births cost you. Accredited zoos move animals on breeding loans rather than buying them, so you pay transport and quarantine (60 days in Hawaiʻi).
- **Animal welfare** comes from space, social group size, habitat quality, biome, climate (including heated or chilled buildings) and keeper care. Animals age, get sick, give birth (including maternal rejection and hand-rearing dilemmas), and die.
- **Habitats & construction.** Design new habitats on empty lots (biome, design tier, climate control), renovate worn ones, and improve theming. Public zoos build more slowly because of procurement.
- **Infrastructure & deferred maintenance.** Water mains, power, life-support, the animal hospital, perimeter fence and more all decay. Underfund maintenance and they fail at emergency prices.
- **Money.** Admission and membership pricing, marketing, maintenance, enrichment and conservation budgets; a restricted capital fund alongside operating cash; a credit line with interest; monthly and yearly P&L with charts.
- **Staff.** Seven departments with workload-based requirements, hiring delays (months for city and federal zoos), morale, burnout and layoffs.
- **Fundraising.** Cultivate major-gift prospects and make the ask, run capital campaigns, host galas, apply for grants, and weigh corporate sponsorships against reputational risk (an oil company or a palm-oil brand pays well, but at a cost).
- **Politics.** City budget requests and Council hearings, fee ordinances, elections, federal appropriations and shutdowns, and management-contract renegotiation.
- **Dilemmas and disasters.** More than 50 events, including EEHV, tuberculosis, avian flu, escapes, keeper injuries, lawsuits, activists, viral baby animals, panda diplomacy, hurricanes, tsunamis, wildfires, blizzards, grid failures, recessions, mid-year budget cuts, union settlements, USDA inspections and bequests.
- **Goals and reviews.** Every zoo has five-year goals, a graded annual review each December, and a boss whose confidence decides whether you keep your job.

## 🗂️ Code layout

```
index.html            entry point (classic scripts, works from file://)
css/style.css
js/core/util.js       seeded RNG, formatting, calendar
js/data/              species, zoos, director backgrounds, name pools
js/sim/               simulation (no DOM): animals, staff, infra, habitats,
                      economy, aza, politics, development, events, sim
js/ui/models.js       procedural 3D animals (56 species), people, avatar, trees
js/ui/world3d.js      3D world: terrain, habitats, buildings, agents, cameras, weather
js/ui/settings3d.js   real-world surroundings for each zoo (landmarks, skylines, traffic)
js/ui/architect.js    design meetings with the exhibit architect
js/sim/design.js      habitat features, brief parser and concept generator
js/ui/portraits.js    roundel portraits rendered from the 3D models
js/ui/                panels, creator, app (UI shell)
js/vendor/            three.min.js (r149, MIT)
tools/gallery.html    preview every species model
tools/headless.js     runs the simulation without a browser for balancing
```

Balance-test the simulation headlessly:

```
node tools/headless.js 5            # all zoos, 5 years, random event choices
PLAY=1 node tools/headless.js 5 houston   # accept SSP recs, print ledgers
```
