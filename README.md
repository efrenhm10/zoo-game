# 🦒 Zoo Director

A browser-based **zoo management simulation** inspired by *Planet Zoo* — but focused on the real job of running an American zoo. You won't be clicking to feed every animal. You'll be fighting for budgets, managing the collection with the AZA, keeping up with deferred maintenance, courting donors and sponsors, and making hard calls when an animal gets sick or a hurricane heads your way.

It's a **3D game** that runs in your browser (WebGL via a bundled copy of Three.js). You get an aerial park with rolling terrain, lakes and forest; naturalistic habitats with hills, ponds, rocks and trees; fences and glass houses; animated low-poly animals for all 56 species; crowds of guests; and weather. The interface is modeled on *Planet Zoo 2*: cream tool windows, a green bottom toolbar, and field-guide roundel portraits of every animal. There is no build step and nothing to install.

## ▶️ Play

- **Locally:** open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
  If your browser blocks local files, serve the folder instead, for example with `npx http-server .` or `python3 -m http.server`, then open the URL it prints.
- **GitHub Pages:** go to *Settings → Pages*, deploy from the `main` branch root, then open the published URL.

The game autosaves to your browser every in-game month.

## 🧑‍💼 Create your director

1. **You:** name, gender, age and appearance (skin, hair, outfit, hat).
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

Figures are gameplay approximations inspired by the real institutions.

**Starting collections follow each zoo's real animals (researched 2025–26):**

- **Honolulu:** elephants Mari and Vaigai, eastern black rhinos, hippos, lions, cheetahs, spotted hyenas, Nile crocodiles, giraffes/zebras/kudu, orangutans, siamangs, a sun bear, Komodo dragon, Galápagos and Aldabra tortoises, and nēnē.
- **San Diego:** giant pandas Yun Chuan and Xin Bao, koalas, gorillas, bonobos, orangutans with siamangs, hippos, African elephants, lions and jaguars in Elephant Odyssey, Sumatran tigers, polar bears, and at Africa Rocks African penguins, Amur leopards and hamadryas baboons.
- **National Zoo:** giant pandas Bao Li and Qing Bao, Amur tigers Vostok and Coba, bison Lucy and Gally, Asian elephants, gorillas, orangutans, lions, cheetahs, red pandas, clouded leopards, sloth bears, Andean bears, sea lions with gray seals, flamingos, and Kids' Farm.
- **Houston:** eight Asian elephants, gorillas, chimpanzees, Masai giraffes with Grant's zebras and ostriches, white rhinos, okapi, pygmy hippos, lions, Malayan tigers, jaguars, Galápagos tortoises, Humboldt penguins, sea lions, orangutans, and alligators.
- **Cheyenne Mountain:** a giant reticulated giraffe herd with Grant's zebras, African elephants, eastern black rhinos, four hippos, African penguins, lions, okapi, grizzlies, moose, Mexican gray wolves, Amur tigers and leopards, snow leopards, gorillas, and Sumatran orangutans.

Famous residents use their real names; other animals get generated names. Each zoo's list is a representative sample of its signature animals, not the full inventory.

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

## 🧍 People you have to keep happy

- **Top 10 donors.** Each has a name, a giving history, a capacity, something they care about (a species, conservation, kids and education, building something, animal welfare) and a personality: likes recognition, very private, hands-on, data-driven, social, or thinking about legacy. Call them, take them to coffee or dinner, give them a behind-the-scenes tour, send impact reports and thank them after every gift. Their December gifts rise and fall with the relationship. Ask for a gift (operating money, the capital fund, conservation, naming rights, the campaign, or a gift in their will) when the relationship is ready. Neglected donors cool off and eventually stop giving.
- **Your partner organization.** This is the Honolulu Zoo Society, Friends of the National Zoo (FONZ), or the endowment committee at the nonprofit zoos. Keep the relationship up with meetings, board presentations and members' nights. You can ask them to cover a cash shortfall, run an emergency appeal, or fund a capital project. Every yes costs goodwill.
- **City Hall.** The mayor and named councilmembers, each with priorities: fiscal hawks, parks champions, animal-welfare advocates, tourism boosters, neighborhood advocates, labor allies and equity advocates. Meetings are free; tours cost a little. Before a budget vote or a fee ordinance, ask each one for their vote and watch the whip count. Council votes are counted member by member. Elections bring in new faces.
- **The state.** The state capitol can fund capital projects in Hawaiʻi, California, Texas (which meets only in odd years) and Colorado. File a request while the session is open, line up key legislators, then hope the Governor signs it rather than vetoing or line-item vetoing it. D.C. has no state, so the National Zoo works Congress's appropriations subcommittees instead.
- **Your board / Smithsonian leadership.** Trustees and executives you can meet one-on-one to shore up confidence in you.

## 🗺️ Growing the zoo

- **Strategic master plan.** Hire planners and choose three priorities: grow the footprint, open a second site, fix what we have, conservation leadership, guest experience, community and education, or financial sustainability. The draft goes out for public comment (hold community meetings, pitch it on air, ask decision-makers for their votes), then the City Council, board or Smithsonian leadership votes. An adopted plan runs for ten years, has goals you can hit for extra confidence, and helps campaigns, grants, state requests and budget asks. Plans can be voted down and revised.
- **Buy land.** Each zoo has a realistic parcel: Honolulu's Kapahulu service yard and old parking lot, San Diego's Park Boulevard canyon, a Rock Creek hillside for the National Zoo, Hermann Park acreage in Houston, or mountainside acreage at Cheyenne Mountain. Buying it adds three large habitat lots that appear at the back of the zoo on the 3D map.
- **Open a second site** (Honolulu, Houston, National Zoo): either a public wildlife park with its own visitors, admissions and running costs, or an off-exhibit conservation and breeding center that raises your AZA standing every month.

## 📺 Media, events and the gift shop

- **Media.** Pick a message (your campaign, the budget fight, an upcoming event, a new baby, damage control after bad news, memberships, a conservation story) and an outlet: morning TV, public radio, talk radio, an op-ed, a livestream or a podcast. Good appearances add campaign momentum and pledges, political pressure, ticket sales or members. Live shows can go badly.
- **Special events.** Book a Sips & Safari 21+ night, Brew at the Zoo, a concert on the lawn, Boo at the Zoo, a Zoo Lights holiday festival, a 5K fun run, a family science night, or a free community day. Turnout depends on reputation, marketing, promotion and the weather on the night. Alcohol brings incidents and liquor-permit politics, and concerts stress animals and annoy the neighbors.
- **Gift shop & merch.** Set pricing (value, standard or premium), choose product lines (plush, apparel, toys, local artisan goods, an eco line, souvenir photos, an online store), upgrade the store, sign a one-year co-branded collaboration with a local brand, and launch limited editions featuring your star animals.

## 🎮 What you manage

- **Camera (manage mode).** Drag to pan, right-drag (or Shift+drag) to rotate, scroll to zoom, and use `WASD`/arrows to move and `Q`/`E` to rotate. Click a habitat to manage it.
- **Walk the grounds.** Press `Tab` (or 🚶 Walk) to control your avatar with `WASD`/arrow keys (hold `Shift` to jog), or click where you want to go. Stand at a habitat and press `E` to observe each animal: its name, age and what it's doing right now. You'll also hear from keepers and see guest thought bubbles that reflect the actual simulation ("$40 for tickets?!", "the restrooms are closed again", "a baby giraffe!").
- **Request animals from the AZA.** Pick a habitat (including one still under construction), a species and how many males and females. You see the odds, the transport cost and the reasons before you send it. Coordinators answer in one to three months: approved, partly approved, waitlisted or declined, with a reason. Every habitat has an **Add animals** section that shows the space used, how many more of each resident species fit, one-click requests (+1♀, +1♂, +2♀, or +6 for flocks) with approval odds, offers you can accept right now, and a button to add a different species. Habitats under construction have "Reserve animals for opening day".
- **Expand a habitat.** Add an adjoining yard and a bigger night house for 30% more space, up to twice per habitat. It takes about three months, and the animals stay on exhibit.
- **Animal hospital.** Click the hospital to see every patient: what they have, how serious it is, whether they're on standard treatment, specialist care or only being monitored, their health and recovery, and days to go. You can start treatment or bring in specialists there, and see quarantine, expecting mothers and newborn checks.
- **Field conservation partners.** In the 🧬 Conservation tab, choose up to three conservation nonprofits (for example a rainforest alliance for orangutans and tigers, a savanna trust for lions and giraffes, or a North American recovery program for wolves, bison and condors). Your field-conservation budget is shared among them. Run projects together: fund ranger teams, send two of your vets to the field, release an animal to the wild, host a conservation day, or run a joint research study. Field reports come back as your support adds up. Partners whose species you hold become signature programs with more impact, and “Round Up for Wildlife” at the registers adds guest donations.
- **Move animals between habitats.** The ↔ Move button on any animal card, or ↔ Move… beside a species in a habitat, opens a window. Pick which individuals move (sex and age shown), then see every habitat rated as a good fit, workable, poor fit or not possible: landscape, room left, species mixing, climate, too many males, group size. Moving costs $1,500 per animal. Animals still in quarantine just change destination.
- **SSP guidance for every animal.** New arrivals (from the exchange, requests or SSP transfers) get their own recommendation: breed with a named unrelated mate, or stay on contraception. Youngsters born at your zoo get guidance as they near maturity. If related animals of opposite sex share a habitat (a mother and her maturing son, say), the SSP flags the inbreeding risk and recommends transferring or moving one of them, and it thanks you when it's fixed. Each animal card shows its current SSP guidance. Births from pairs the SSP told you to keep on contraception don't count toward goals.
- **Collection & AZA Species Survival Plans.** Animals are on contraception by default. Each February the SSP publishes Breeding & Transfer Plans: breed this pair, send this animal to another zoo, receive a mate, do *not* breed, or hold space for a species. Following them earns AZA standing; unplanned or inbred births cost you. Accredited zoos move animals on breeding loans rather than buying them, so you pay transport and quarantine (60 days in Hawaiʻi).
- **Animal welfare** comes from space, social group size, habitat quality, biome, climate (including heated or chilled buildings) and keeper care. Animals age, get sick, give birth (including maternal rejection and hand-rearing dilemmas), and die.
- **Habitat problems, explained.** Any habitat in the red tells you exactly why: worn out, overcrowded, species clash, short on keeper care, wrong landscape, too hot or cold, lonely or too big a group, sick animals, dated theming. The fixes are offered right there, with prices: renovate, hire keepers, restore enrichment, move an animal to a habitat with room, bring in a companion, re-landscape, add a heated or chilled building.
- **Habitats & construction.** Design new habitats on empty lots (biome, design tier, climate control), renovate worn ones, and improve theming. Public zoos build more slowly because of procurement.
- **Infrastructure & deferred maintenance.** Water mains, power, life-support, the animal hospital, perimeter fence and more all decay. Underfund maintenance and they fail at emergency prices.
- **A budget that answers back.** The Budget tab projects the next 12 months line by line. Drag any slider (admission, memberships, marketing, maintenance, enrichment, conservation) and the projected spending, revenue and surplus or deficit update as you drag, with plain-language warnings about the side effects. Cutting marketing, for example, saves money but costs visitors.
- **Rainy-day fund.** Move money into an operating reserve with one-off deposits or a monthly auto-save. It earns interest and raises your boss's confidence (boards want 3 to 6 months of expenses in reserve), but it stays locked except in an emergency: a disaster, breakdown, outbreak, budget cut, shutdown, recession or cash crisis. With auto-cover on, it automatically pays emergency costs that would otherwise push you into debt.
- **Money.** Admission and membership pricing, marketing, maintenance, enrichment and conservation budgets; a restricted capital fund alongside operating cash; a credit line with interest; monthly and yearly P&L with charts.
- **Staff.** Seven departments with workload-based requirements, hiring delays (months for city and federal zoos), morale, burnout and layoffs.
- **Prospecting.** Fundraising → 🌱 Prospects has two pipelines. For **individuals and families**, research new major-gift prospects through wealth screening and board introductions, cultivate them monthly or with personal visits, and ask at three levels with the odds shown. For **corporations**, research local companies (each has a giving budget, an industry, a reputational risk and what they want: brand visibility, community goodwill, employee engagement, a sustainability image, or selling to your guests). Build the relationship with meetings, employee volunteer days and VIP evenings, then pitch a deal: exhibit naming, presenting sponsor of events, vendor/pouring rights, an education or conservation program, or an employee giving partnership. Deals that fit their interest are likelier.
- **Capital campaigns and naming rights.** Run up to three campaigns at once, each tied to a project: a new habitat you designed, a habitat transformation, the land purchase, a second site or the repair backlog. Each campaign comes with lead prospects: wealthy families and foundations, two of your top donors, and corporations, each with an estimated giving capacity. Hold pitch meetings to raise their readiness, then ask. A gift of at least 70% of the goal buys naming rights (the habitat, campus or new grounds carries their name), and a 25% leadership gift names the viewing plaza. Corporate names from risky industries bring backlash. How much local donors can give depends on the city.
- **Fundraising.** Cultivate major-gift prospects and make the ask, run capital campaigns, host galas, apply for grants, and weigh corporate sponsorships against reputational risk (an oil company or a palm-oil brand pays well, but at a cost).
- **Politics.** City budget requests and Council hearings, fee ordinances, state funding requests, elections, federal appropriations and shutdowns, and management-contract renegotiation.
- **Never stuck.** If an event demands money you don't have, you can still pay on emergency credit, at a cost to your boss's confidence. Every event window also has a ☰ Menu button.
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
js/sim/donors.js      top-donor roster and relationships
js/sim/officials.js   mayor, council, legislature, governor, Congress, board; votes
js/sim/partner.js     zoological society / endowment relationship
js/sim/media.js       TV, radio, op-ed and livestream appearances
js/sim/zooevents.js   adult nights, concerts, lights, fun runs, free days
js/sim/merch.js       gift shop pricing, product lines, brand collaborations
js/sim/diagnose.js    why a habitat is struggling and how to fix it
js/sim/requests.js    requesting animals from AZA / SSP coordinators
js/sim/growth.js      strategic master plan, land purchases, second sites
js/sim/reserve.js     rainy-day fund (operating reserve)
js/sim/fieldcons.js   field conservation partners and projects
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
