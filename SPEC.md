# Space Mission Design Game: Team Spec

Nov 13, 2026 · @Yareem Al-Eryani

## What we're building

A browser game where the player designs a satellite mission under tight limits, launches it, and learns why it worked or failed. It answers the NASA Space Apps 2026 challenge "Space Mission Design Game".

The core loop takes about five minutes: choose an objective, build the spacecraft, check the margins, launch, read the debrief, redesign. Everything we build serves that loop. One mission that plays start to finish beats three half-built ones.

KEY: At least one data set from the resources provided under the challenge has to be used. There are no data-sets in the resource tab, so resources will be used for other purposes.

Missions sit inside a **campaign**. The player runs their own space programme: nobody tells them what to measure. Money and knowledge carry from one satellite to the next, money is spent at launch, and the payout is for **new** knowledge, so repeating a topic pays less each time. Sometimes the best move is a fresh topic rather than a better satellite for the same one. A single mission must still play on its own, with no campaign, at every commit.

- **Platform:** plain HTML, CSS and JavaScript. No frameworks, no build step. It runs from a link.
- **Players:** one player first. Pass-and-play roles for up to four come later, if time allows.
- **Scenario:** a campaign of Earth-observation missions, with three orbit choices, two topics at the start and more opened by research.
- **Give this whole doc to your AI** at the start of every session, so all six assistants build the same game.

## How we are judged

Source: the official NASA Space Apps 2026 Judging & Awards Guide (Nov 13, 2026). Every judge scores five criteria from 1 to 5, with equal weight. Submission closes **Sunday, November 15 at 11:59 p.m. local time**.

| Criterion | What a 5 looks like | Where we stand | What we change |
| --- | --- | --- | --- |
| **Impact** | A significant problem, a large audience, inspiring | Teaches mission design to anyone with a browser; wildfire and sea ice are real, current problems | The debrief ties each result to the real problem; the campaign teaches that science is paid for by what is *new* ("you pay to learn") |
| **Creativity** | Original, improves on existing ideas | Adds what the NASA telescope game lacks: hard limits, random events and a debrief explaining *why* | Missions played against real NASA observations, inside a persistent economy that rewards new knowledge over repetition; no comparable game does either |
| **Validity** | Scientifically sound, feasible, usable | Eight real formulas with hand-worked tests; parts from NASA's Small Spacecraft State of the Art report | Put the formula tests on `main` and cite them on the project page; one sourcing pass before submission (Data task 3) |
| **Relevance** | NASA data is a **core component**, not an add-on | Was the weakest; now NASA FIRMS and NSIDC data drive the simulation | Done: see "NASA data in the game" below |
| **Presentation** | Clear, engaging story; the demo and the whole project are judged | No QA owner yet, so no one owns the demo | Assign the demo now; script it around the core loop: build, fail, read the debrief, fix, succeed |

**Hard requirements for global judging** (from the same guide):

- Every team member registered for the same Local Event and listed on the team page; at most six members.
- A demo: **at most 7 slides** including the title. Everything in English.
- Every external resource (code, text, images, data, even open source) listed in the **References** field. `SOURCES.md` becomes that list, so it must be complete, including the AI tools used.
- No copyrighted material we lack permission to use.

**Global awards worth aiming at:** Best Use of Data (real NASA data driving the game), Best Mission Concept (plausible concept and design), Best Storytelling (the debrief), Most Inspirational.

### Honest audit (Saturday evening)

What a strict judge would mark down today, and what we do about it. Recheck this list at every checkpoint.

| Risk | Criterion | Fix |
| --- | --- | --- |
| **The era contradicts itself.** The campaign story began in 1957, but the game uses 2025 NASA data, modern parts and 2025 prices. | Validity | **Decided: the campaign starts in the 1957 space race.** Three rules keep it honest. (1) **The research tree is the history:** the player starts with sourced 1957-58 parts (for example Explorer 1's batteries and Vanguard's first silicon solar cells, from NASA's NSSDCA catalogue) and research unlocks technology in roughly the order it really arrived, ending with today's parts. (2) **Modern observations are never passed off as 1957 measurements:** today's NASA data appears as "what today's satellites see", and era data sets (other agencies are fine) are used when they are real, cited and licensed. (3) Every era number has a source or is labelled a game value. |
| **Wording overclaims.** A MODIS detection is a hot pixel, not a fire. | Validity | All text says "fire detections". |
| **The economy's numbers are invented.** | Validity | `value_musd`, `knowledge_scale`, grants and research costs are labelled game values. The knowledge curve is described as a model of diminishing returns, not a fact. |
| **No screens yet; the campaign adds a hub.** A half-built interface hurts usability and the demo. | Validity, Presentation | A single mission plays without a campaign at every commit. Research (Phase E) and new content (Phase F) start only once the seven screens and the hub play end to end. |
| **The economy could bury the lesson.** | Impact | The debrief leads with what limited the mission and one concrete change; the payout comes second. |
| **Event choices barely matter** (red team B5). | Creativity, Impact | Done: 3 stars need the science target (0 of 327 three-star missions below it); lost months and event costs count against everything they affect; each choice shows its odds (`fail_chance_now`). |
| **With two topics, winning forces repeats.** *(Fixed by the 1957 content: five topics, win on three.)* The win needs every topic known to 60%, so a player must fly wildfire about four times, earning 1 star each as novelty falls. | Impact, Creativity | Content, not tuning: Phase F topics give the player somewhere new to go. If Phase F slips, lower `win.knowledge` for two topics. |
| **Orbit choice is solved** (polar orbit wins both objectives, red team B2). | Creativity | Retuned: low orbit now wins wildfire on every tier and polar orbit wins sea ice (`tests/balance.js`). **Still open:** geostationary wins nothing, because its real advantage, minutes-fast fire detection, is not scored yet (red team N5). |
| **New topics without NASA data would weaken Relevance.** | Relevance | Phase F topics are chosen by what NASA data we can actually download (for example NASA Ozone Watch), not by era. Any topic without real data is labelled as game values. |

### The 1957 campaign: content plan

The campaign opens in the International Geophysical Year. The player starts with sourced 1957-58 technology and buys their way forward through research, in roughly the order history did it.

- **Era topics** (open at the start or early in the tree): *radiation belts* (Explorer 1 and 3 found the Van Allen belts in 1958), *solar activity* (the IGY was timed for the solar maximum), and *first weather pictures* (Vanguard 2 in 1959, TIROS-1 in 1960).
- **Modern topics** stay, locked behind late research: wildfire (thermal infrared) and sea ice (synthetic aperture radar, first flown on Seasat in 1978).
- **Era parts and rockets** are new rows in the existing formats: a Geiger-counter package, mercury and silver-zinc batteries, Vanguard's first silicon solar cells, a 108 MHz Minitrack beacon, a vidicon TV camera with tape recorder, and the Juno I, Vanguard and Thor launchers. Numbers come from NASA NSSDCA records, NASA history pages and other cited sources; anything else is labelled ESTIMATE or GAME VALUE.
- **Real era data:** monthly sunspot numbers from SILSO (Royal Observatory of Belgium, CC BY-NC 4.0) for 1957 onward. They drive the solar-activity topic month by month and how often solar storms strike in each campaign year: 1957-58 was the strongest solar maximum on record, 1964 the quietest year.
- **Modern NASA data** (FIRMS, NSIDC) stays for the modern topics, always framed as what today's satellites see.

Research ends at today's parts, so the tree itself is a timeline of satellite technology.

### Challenge text: what we cover and what is still open

From the official challenge text (Details tab, saved 2026-11-14). Covered: objective before engineering; consequences across mass, power, budget and data; launch vehicle, orbit and mass compatibility; instruments with mass, power, cost, data and science; plain-language orbit trade-offs; why a mission succeeded or failed; scoring for science, efficiency and decisions; difficulty levels; random events; redesign and rerun; save codes; real-mission comparison; tutorials and hints.

Open, in order of weight in the challenge text:

1. **Team play for up to four**, with roles that pull against each other. It is in the Objectives, not only the extras. Proposed: pass-and-play, one subsystem per player, a goal per role, and a readiness review everyone signs. Needs a data file for roles: data owner to approve.
2. **Time as a resource** (development time, not only lifetime). Proposed: a build time per part, shown on the readiness review and advancing the campaign calendar. Needs a new part field: data owner to approve.
3. **Structure and attitude control** are named components but are not parts yet. Proposed: two new part categories with one or two simple parts each. Changes the data format: data owner to approve.
4. **"No single perfect solution."** Checked by `tests/balance.js`: at least two different designs earn three stars for every objective.

### Progression: eras, bodies and the research tree (approved)

One rule drives progression in both modes: **every part, body, rocket and topic has the year it really arrived**, taken from the research record that unlocks it (anything no research unlocks dates from 1957).

**1. Eras (standalone play).** A standalone mission is set in an era, and only what existed by that year is offered. Eras live in `data/eras.js`: one global, `ERAS`.

```js
{ id: "igy", name: "International Geophysical Year", year: 1958,
  blurb: "One line for the era card.", real_missions: ["explorer-1", "vanguard-1"] }
```

| Era | Year | What it offers | Topics |
| --- | --- | --- | --- |
| International Geophysical Year | 1958 | Explorer's cylinder, Geiger counter, batteries, first silicon cells, beacon; Juno and Vanguard rockets | Radiation |
| Nimbus | 1964 | Adds TV cameras, the TIROS drum, three-axis control, the Nimbus bus, Thor rockets | Radiation, solar, weather |
| Earth Observing System | 1999 | Adds modern power, radios, computers, thrusters, radar and thermal imaging (still launched on Thor-Agena) | All five |
| New Space | 2026 | Everything, including rideshares, small launchers, reusable rockets and the 12U CubeSat | All five |

The first era is open; **two stars in an era opens the next** (on any tier). Tiers stay as they are (Concept Maturity Levels), so tier select becomes a grid: era across, maturity down. A design with no era (`year` null) offers everything, so the current screens keep working. The solar topic uses the real sunspot numbers for the era's year: 1958 is the strongest maximum on record, 1964 nearly quiet.

**2. Bodies.** Structure parts (bodies) gain two approved fields: `payload_kg`, the most the body can carry, and `slots`, how many parts of each category fit (`{ instrument: 1, power: 2, ... }`; a missing category means none). One body per satellite. The ladder, each modelled on a real spacecraft:

| Body | Year | Payload | Instruments | Propulsion | Model |
| --- | --- | --- | --- | --- | --- |
| Explorer-style cylinder | 1957 | 10 kg | 1 | none | Explorer 1 |
| TIROS-style drum | 1960 | 100 kg | 2 | none | TIROS-1 |
| Nimbus-class bus | 1964 | 300 kg | 3 | 1 | Nimbus 1 |
| Modern smallsat bus | 1995 | 150 kg | 2 | 1 | ESPA-class buses |
| 12U CubeSat frame | 2018 | 22 kg | 1 | 1 | CubeSat 101 |

Readiness checks (only when a body is fitted, which becomes always once the switch-over is on): `body-count` (more than one body), `body-payload` (parts heavier than the body carries), `body-slots` (more parts of a category than it has slots).

**3. Campaign research tree.** Research unlocks bodies as well as parts. `getResearchTree()` returns `{ nodes, edges }` so a reusable tree component can draw it without knowing the rules: nodes carry `id, name, year, depth, cost_musd, blurb, unlocks_names, owned, can_buy, missing`; edges are `{ from, to }` prerequisites.

### Why these choices (against the judging criteria)

| Criterion | What the progression adds | Risk and answer |
| --- | --- | --- |
| **Impact** | The same five-minute loop teaches something new in each era: how a 10 kg battery satellite became a 150 kg radar platform. Replay is the lesson. | Too much content for one sitting: the first era has one topic and a handful of parts, so a newcomer is never swamped. |
| **Creativity** | Progression is history: the era grid, bodies from real spacecraft, research gated by best practice, and the real solar cycle. No comparable game ties its tech tree to dates. | — |
| **Validity** | Every era item is dated by the real mission that introduced it; bodies are modelled on real spacecraft; `tests/balance.js` checks each era can be won. | Some dates are simplified (old rockets stay available later): the eras say "what existed by", not "what was in use". |
| **Relevance** | The challenge asks for "different difficulty levels, mission types, or scenarios" and "simple and advanced components depending on the difficulty level". Eras are both, and they rest on NASA's own mission history (NSSDCA). | — |
| **Presentation** | A 30-second demo can open in 1958 with Explorer 1 and close in 2026, which is a story in itself. The screens need only an era picker and slot counts on the body. | The research-tree screen is the biggest new screen; it is only needed for the campaign, so eras come first. |

### The core loop (approved November 15)

```
Start poor (small budget, basic parts)
  -> Plan a mission (pick type and gear) -> Launch (costs money) -> Collect data (each type has a cap)
  -> New data?  no:  no reward (already collected) -> try another type
                yes: earn money and science points -> research in the lab (unlock parts, approaches) -> next mission
```

- **Each mission type has a data cap:** `CAMPAIGN.cap_scales` (3) times the topic's `knowledge_scale`. A flight's **new data** is its science, cut off at what is left under the cap.
- **Rewards are for new data only.** Money pays for the knowledge the new data adds (the same diminishing curve as before), and science points equal the new data. A flight that brings back nothing new earns **no reward**: no payout (the repeat floor is gone for it) and no science points. The annual grant and the rescue grant still arrive, so the programme can always fly again.
- The hub shows each topic as `data_collected` of `data_cap`, and marks it `complete` at the cap. The Build screen's payout preview and the debrief say how much of a flight's data would be new, and name another type to try (`best_next_topic`).

### The lab, the archive and open choices (0.7, approved November 14)

Playtest verdict: the campaign was one corridor (fly, get paid, buy the next node) with too much hand-holding, and science points paid for nothing. 0.7 makes it an incremental and simulator hybrid: every launch is still a hard design puzzle (simulator), and what the programme learns keeps piling up between launches (incremental).

- **Two currencies.** Money (`treasury_musd`) builds and launches satellites and comes from grants and payouts, as before. **Science** (`science_pts`) is the data your satellites return: every flight adds its science to it. Real research costs both, so a programme needs good data *and* funding.
- **The lab: research adds, upgrades replace.**
  - **Research (add):** the research tree, each node now costing `cost_musd` *and* `cost_sci`. It adds new parts, rockets and topics. Lessons still gate it (the history lesson stays).
  - **Upgrade (replace):** a part with an `upgrade` field is the real successor of another part: Explorer 1's Geiger counter becomes Explorer 4's scintillation counter, TIROS's vidicon becomes Nimbus's AVCS camera, Alouette 1's sounder becomes ISIS-1's. Buying an upgrade replaces the predecessor everywhere in the campaign: the old card shows "Replaced by ...". An upgrade can only be bought when its predecessor is available and the calendar has reached its year. Outside a campaign, both stay on offer from their years.
- **The archive: data keeps paying.** Every campaign year, scientists re-analyse what the programme has already returned: `science_pts` grows by `archive_share` of all the science banked so far, so every flight keeps feeding the lab. (Not a satellite living longer: the mission simulation already flies each satellite until its orbit decays or its batteries die.) Real: Alouette 1's ionograms were nearly lost, then digitised by the CSA from 2017 and are being studied again.
- **Less hand-holding.** On Trade Space and Point Design, a research node's lesson condition is hidden behind a hint ("A review board wants proof of engineering discipline") until the lesson is earned. Initial Feasibility keeps the exact wording.
- **A Canadian topic from Canadian data: the ionosphere.** Alouette 1 (1962), the first satellite built by a country other than the USSR or the US, sounded the ionosphere from above. The CSA's digitised Alouette 1 ionograms (699,369 soundings received by 33 ground stations, 1962-1973; `data/result_master.csv`, CSA Open Data) drive the topic: which ground stations a low orbit can reach, and the season. The sounder had no tape recorder, so only soundings heard by a ground station count; the debrief compares the player's satellite with Alouette's real record.
- **Calls for proposals (if time):** each campaign year the hub offers two seeded calls (for example "IGY: radiation data by 1959, bonus $12M"), drawn from `data/calls.js`. Taking one is optional.
- **Chronicle headline:** the debrief adds `headline`, a newspaper-style line built from the mission, its real data and the year, for the hub's history and the ending.

New data fields (approved): parts `upgrade: { of, year, cost_musd, cost_sci, requires: [research ids] }`; research `cost_sci`; `CAMPAIGN.archive_share`, `CAMPAIGN.save_version` 3; an `ionosphere` entry in `data/earth.js` (`source`, `soundings`, `stations`, `soundings_by_year`, `stations_by_year`, `monthly_share`, `orbit_view`, `top_stations`); a new objective `ionosphere`, research `topside-sounding`, parts `topside-sounder`, `isis-sounder` and other successor parts. Campaign state adds `science_pts` and `upgrades`.

### NASA data in the game

To move Relevance from add-on to core, two small real data sets drive the mission, one per objective. Each is a dozen monthly numbers, stored in a data file like everything else. That file is the offline snapshot; live calls (below) refresh it when the internet is there.

- **Wildfire: NASA FIRMS** (Fire Information for Resource Management System) active-fire detections from VIIRS, by month and by latitude band, for the last full year. Each mission month earns science in proportion to real fire activity that month, and the boreal share shows why low orbit misses northern fires. The debrief reports how many real detections the player's design would have caught.
- **Sea ice: NSIDC Sea Ice Index** (a NASA DAAC), Arctic extent by month, plus polar-night months. The optical camera earns nothing in the dark months while radar keeps working, so the player sees *why* sea-ice missions fly radar.

**Built and on `main`.** `data/earth.js` holds the real numbers, `tools/earth_data.py` rebuilds them from the original downloads, and both sources are in `SOURCES.md`. What the data showed:

- NASA MODIS made **3,693,555 active-fire detections in 2025** (a detection is one hot pixel on one pass, not one distinct fire); August was the peak month (15%), 75% were in the tropics and 7.9% north or south of 50 degrees.
- A low orbit can see 92% of them, a polar orbit all of them, and one geostationary satellite only one side of Earth: 69% from Meteosat's slot over Africa and Europe, just 24% from GOES-East over the Americas. The game places geostationary at 0 degrees.
- Arctic ice fell to **4.75 million km2 in September 2025, 26% below the 1981-2010 average**. At 75 degrees north the Sun never rises in November, December and January, so a camera maps nothing for three months a year; radar keeps working.

## Game progression

A mission is seven screens in a fixed order. Each screen teaches one idea, and the player can go back to any earlier screen before launch.

In a campaign, the seven screens sit between visits to the **Campaign hub**, which shows the year, the treasury, how much the player knows about each topic, and the research list. Starting a new campaign replaces tier select: the tier sets the campaign's starting treasury and its events. A mission with no campaign still starts from tier select, exactly as below.

1. **Briefing.** The player picks a science objective, such as wildfire monitoring or sea-ice mapping. The objective sets a science target and says which instrument types count. *Teaches: decide the goal before the hardware.*
2. **Orbit.** The player picks one of three orbits. Each card states its trade-off in one line: image detail, time in contact with the ground, mission lifetime, and how hard it is to reach. *Teaches: where you fly changes everything else.*
3. **Build.** The player picks parts in five categories: instruments, power, comms, computer and propulsion. Four bars update live: mass, power, budget and data. *Teaches: every part costs something in all four.*
4. **Launch vehicle.** The player picks a rocket. The game checks that the spacecraft's mass fits that rocket for the chosen orbit. *Teaches: a bigger rocket solves mass and eats the budget.*
5. **Readiness review.** A go / no-go list shows every failed check with a one-line reason. Blockers stop the launch. Warnings do not. *Teaches: thin margins are a choice, not an accident.*
6. **Mission.** The simulation runs month by month. Two or three events interrupt it, and the player makes one decision per event. *Teaches: designs get tested by things you did not plan.*
7. **Debrief.** The game shows the score, names the one thing that limited the mission, and suggests one change. A button sends the player back to Build with the same design loaded. *Teaches: iterate.*

**The four mission segments** (Resources tab: NASA's *Design and Develop Science Missions*) label the screens and the debrief: the Launch vehicle screen is the **launch segment**; Build is the **space segment** (spacecraft and instruments); the data budget and downlink are the **ground segment**; the science returned is the **user segment**. The debrief gives one line per segment.

### Difficulty tiers

Tiers reuse the same screens and parts. Only the numbers in the data file change, so they cost almost no extra code. Earning two stars unlocks the next tier.

| Tier (`id`) | Name shown | Budget | Events per mission | Hints |
| --- | --- | --- | --- | --- |
| 1 (`training`) | Initial Feasibility | Generous | 1 | On, with a short tutorial |
| 2 (`standard`) | Trade Space | Tight | 2 | On request |
| 3 (`expert`) | Point Design | Tightest | 3 | Off |

The names are JPL's Concept Maturity Levels 2, 3 and 4, the stages where a real mission concept is shaped, which is exactly what the game simulates (Resources tab: "Concept Maturity Levels"; NASA "Mission Development 101: CMLs"). CML 1, "Cocktail Napkin", is free for a tutorial. The ids stay `training`, `standard` and `expert` so saves and unlocks keep working.

Tier 1 is a must-have. Tiers 2 and 3 are the first stretch items, because they add replay value for an hour of work.

Later, each tier will carry its own weights for every calculation, in the style of Plague Inc's difficulty selection, and a fourth Impossible mode is planned. Both are described in `STRETCH.md` and are not part of the first build.

### Proposal: suppliers, countries and travel (not agreed, do not build yet)

From the team's notes of November 15. Nothing here is in the code or the data. It adds data fields and a cost to the rules, so it needs a yes from the data owner, the rules owner and the Design screens owner before anyone builds it. The questions at the end are the ones to settle first.

The idea, in the team's words: separate places to buy parts; countries that specialise in different parts; travel that costs money; processes such as assembly and shipping shown as animations.

- **Suppliers.** Parts are not all bought in one shop. Each supplier is a place on the base map, in a country, that stocks the parts that country really made or flew. Canada's topside sounders (Alouette 1 and 2) are the data's own example; the data owner fills in the rest with sourced rows.
- **Travel costs money.** Visiting a supplier costs budget (and, if the team wants it, months). The player pays for a trip when they take it, so a design that needs parts from three countries is dearer than one bought at home. A part is bought once per mission, and only on a visit.
- **Having the part.** A part that has not been bought is not on the shelf. The bench only offers parts the player owns, so "I have the thing" is a real state, not a label.
- **Shipping and assembly.** A bought part arrives after a shipping time, and the Workshop assembles the parts on board. Both are animated on the Design screens. The animations only show numbers the rules already computed; they add none.
- **Tier 1 stays simple.** The first tier has every part at the home supplier and no trips, so the tutorial is no harder than today.

Sketch of what it would need (names open, none agreed):

| Where | Change |
|---|---|
| `data/parts.js` | one new field per part, `origin`, the id of its supplier's country |
| `data/suppliers.js` | one new global, `SUPPLIERS`: `{ id, country, name, trip_cost_musd, trip_months, source }`; trip costs are GAME VALUEs |
| `js/mission.js` | `visitSupplier(id)` returning `{ ok, reason }`; `getTotals` gains `travel_musd` and `travel_months` |
| `js/ui-design.js` | supplier places on the base map, a country line on each part card, the shipping and assembly animations |

Questions to settle first:

1. Must the player own a part before fitting it (the bench only shows what was bought), or is travel only a cost on a design that uses a far supplier's parts?
2. Do trips cost months as well as money?
3. Is a part bought for good in a campaign, or once per mission?
4. Who sources each part's country? Every row needs a page a human opened, like `source`.
5. Settled: the Out of scope list now allows the faceted low-poly art and short animations (assembly, shipping, launch), as long as they only show numbers the rules computed.

## Content choices

Two objectives, three orbits and three instruments, chosen so that different designs win different missions.

| Objective | Needs | Best orbit |
| --- | --- | --- |
| Wildfire monitoring | Thermal imager, frequent looks | A real choice: geostationary watches constantly but coarsely, low orbit is sharp but has gaps |
| Arctic sea-ice mapping | Radar, which sees through cloud and polar night but draws a lot of power | Polar orbit only, because geostationary satellites see the poles poorly |

| Orbit | Altitude | Trade-off |
| --- | --- | --- |
| Low Earth orbit, `leo` | About 500 km | Cheapest to reach and sharp images, but short ground contact and no polar coverage |
| Sun-synchronous polar, `sso` | About 700 km | Covers the whole Earth including the poles, but costs more to reach |
| Geostationary, `geo` | 35,786 km | Constant view and constant contact, but coarse detail and an expensive launch |

The three instruments are a thermal imager (tag `thermal`), a radar (tag `radar`) and an optical camera (tag `imaging`). The camera only partly helps either objective, so it is the tempting wrong choice.

Each objective carries one extra field, `orbit_fit`, that multiplies its science by orbit. For example, sea ice uses `{ leo: 0, sso: 1.0, geo: 0 }`: only a polar orbit passes over the Arctic. These values are starting points to tune.

## Data format

These field names are fixed. Nobody renames or adds a field without the data person agreeing, because the game logic reads them by name. The values below are placeholders, not real specs.

**Parts** in `data/parts.js`, about 15 in total, three per category:

```js
{
  id: "cam-hires",
  name: "High-resolution camera",
  category: "instrument",  // instrument | power | comms | computer | propulsion | structure | attitude
  mass_kg: 40,
  power_draw_w: 120,       // 0 for power parts
  power_gen_w: 0,          // only power parts generate
  cost_musd: 25,
  data_gb_day: 30,         // data an instrument produces
  downlink_gb_day: 0,      // only comms parts
  storage_gb: 0,           // only computer parts
  science: 8,              // science points per month, instruments only
  tags: ["imaging"],       // which objectives it counts toward
  protects: [],            // event ids this part defends against
  blurb: "Sharp images, but heavy and data-hungry.",
  source: "https://...",   // a page a human opened and checked
  build_months: 6          // approved: months to build and test this part (time as a resource)
}
```

**Structure and attitude control** (approved by the data owner; the challenge names both as spacecraft components). Two more part categories in the same format:

- **`structure`**: the satellite's body. Mass and cost, like any part.
- **`attitude`**: how the satellite points. Its `tags` say how: `"spin"` (spin-stabilised, as Explorer 1 and TIROS-1 were) or `"three-axis"` (held steady, from Nimbus 1 in 1964). Cameras, thermal imagers and radar on a spinning satellite smear their pictures: their science counts at 60%.

**Switch-over.** While the Build screen has bins for only the first five categories, the two new ones are optional and a design without them behaves exactly as before. `game.js` holds the switch, `NEW_CATEGORIES_REQUIRED`; Design screens turns it on in the same change that adds the two bins. The list of categories, with display names and whether each is required, comes from `getCategories()`, so the screens need not hard-code it.

**Time as a resource** (the challenge names development time and operating lifetime). Development time = the longest `build_months` among the parts, plus one month of integration and testing for every three parts. `getTotals` returns it as `dev_months`. In a campaign the calendar moves on by the development time (at least one year per mission), so a complex satellite costs years the programme may not have; a design that could not launch before `end_year` is blocked (`too-late`). Explorer 1 was built in about three months.

**Launch vehicles** in `data/launchers.js`, three in total:

```js
{
  id: "small",
  name: "Small launcher",
  cost_musd: 10,
  capacity_kg: { leo: 300, sso: 200, geo: 0 },  // 0 = cannot reach
  blurb: "Cheap, but only for light spacecraft.",
  source: "https://..."
}
```

**Orbits** in `data/orbits.js`, three in total:

```js
{
  id: "leo",               // leo | sso | geo
  name: "Low Earth orbit",
  science_mult: 1.0,       // multiplies instrument science
  downlink_mult: 0.6,      // share of the day in contact with the ground
  lifetime_months: 12,
  blurb: "Close and detailed, but short passes over the ground station."
}
```

**Objectives** in `data/objectives.js`:

```js
{
  id: "wildfire",
  name: "Wildfire monitoring",
  briefing: "Two or three sentences the player reads first.",
  wants: ["thermal", "imaging"],  // instrument tags that count; the first counts fully, later ones half
  science_target: 160,
  needs_resolution_m: 2000,       // optional: instruments blurrier than this earn nothing
  orbit_fit: { leo: 0.85, sso: 0.5, geo: 1.0 }, // how well each orbit catches the target when it looks; 0 = cannot see it.
                                  // For wildfire, what each orbit can see at all comes from data/earth.js.
  real_mission: "One line naming a real mission with a similar design."
}
```

**Events** in `data/events.js`, six to eight in total:

```js
{
  id: "solar-storm",
  orbit_weight: { leo: 1, sso: 1.5, geo: 2 },  // optional: how likely in each orbit; missing = 1
  title: "Solar storm",
  text: "What happens, in two sentences.",
  choices: [
    { label: "Shut instruments down", effect: { lose_months: 1 } },
    { label: "Keep observing",        effect: { fail_chance: 0.4, fails: "computer" } }
  ]
}
```

Allowed effect keys are `lose_months`, `science_mult`, `cost_musd`, `fail_chance` and `fails`. A part whose `protects` list names the event cancels the worst choice's penalty.

**Tiers** in `data/tiers.js`: `{ id, name, budget_musd, events, hints }`. `hints` is `"on"` (hints plus a short tutorial), `"request"` (a hint button) or `"off"`.

**Earth data** in `data/earth.js`: one global, `EARTH`, keyed by objective id, plus `start_month` (missions start in January). Wildfire: `detections`, `monthly_share` (12 values), `orbit_view` ({ leo, sso, geo }, share of real fires each orbit can see). Sea ice: `extent_mkm2` and `extent_1981_2010_mkm2` (12 values each), `daylight_share` (12 values, 0 = polar night). Each entry names its `source` and `year`. The game multiplies an instrument's science by `orbit_view`, by the month's share of fires (averaging 1 over the year), and, for cameras on sea ice, by `daylight_share`.

**Campaign settings** in `data/campaign.js`: one global, `CAMPAIGN`. All values are game values.

```js
const CAMPAIGN = {
  start_year: 1957,           // calendar shown on the hub (era: see "Honest audit")
  years_per_mission: 1,       // the year advances by this after each recorded mission
  end_year: 1969,             // the campaign ends here, or earlier on a win
  repeat_floor_musd: 0.3,     // minimum payout for any finished mission
  win: { topics_known: 3, knowledge: 0.6 },   // win when this many topics reach this knowledge share
  grant_musd: 1,              // agency grant added to the treasury after each mission
  save_version: 1             // bump when the saved shape changes; an older save is discarded
};
```

**Campaign fields on every objective** in `data/objectives.js`:

| Field | Type | Meaning |
| --- | --- | --- |
| `value_musd` | number | Total money for knowing the topic completely. Game value. |
| `knowledge_scale` | number | Science points at which the player knows about 63% of the topic. Game value. |
| `requires_research` | string or `null` | Research id that must be bought before the topic is offered. `null` = available from the start. |

`science_target` keeps its meaning: the per-mission star target, not the knowledge ceiling.

**Research** in `data/research.js`: one global, `RESEARCH`, six to eight records. Anything not named in any research record is available from the start, so `parts.js` and `launchers.js` gain no fields.

```js
{
  id: "radar-lab",
  name: "Radar laboratory",
  cost_musd: 6,
  requires: [],                   // research ids that must be bought first
  unlocks: { parts: ["sar-radar"], launchers: [], objectives: ["sea-ice"] },
  blurb: "One line the hub shows."
}
```

**Research fields** (approved by the data owner), in addition to the record above:

| Field | Type | Meaning |
| --- | --- | --- |
| `year` | number | When this technology really arrived. Shown on the node as history ("1958: Vanguard 1"); buying it earlier is allowed. |
| `requires_lessons` | array of lesson ids | Best practices the player must have **shown in flight** before buying. The back end detects them from the campaign's mission history. |
| `requires_knowledge` | object, topic id to share | Data from earlier satellites: how much the player must already know about a topic (for example `{ "radiation": 0.3 }`), just as Explorer 3 followed up Explorer 1's puzzling data. |

**Lessons** (fixed ids, detected by `js/mission.js` when a campaign mission is recorded):

| Id | Earned when a recorded mission... |
| --- | --- |
| `margins` | flew with mass and power margins of 10% or more |
| `all_data` | sent home all the data its instruments made |
| `three_stars` | earned 3 stars |
| `storm_survived` | met a solar storm and lost no part |
| `protected` | had a part on board cancel an event's penalty |
| `spare` | carried two or more parts in a required category |
| `batteries_ran_out` | ended because its batteries ran down (the lesson that leads to solar cells) |
| `new_topic` | flew on a second topic |

**Battery-only satellites.** A spacecraft with a battery and no solar panel may launch, as Sputnik 1 and Explorer 1 did. It runs until the battery is spent (battery energy divided by power draw), then the mission ends: Sputnik 1 fell silent after about 21 days, Vanguard 1's solar-powered transmitter ran for more than six years. The readiness review shows this as a warning, not a blocker.

**Real missions** in `data/missions.js` (approved by the data owner): one global, `MISSIONS`, about a dozen real satellites the debrief can compare the player's design with, from Explorer 1 to RADARSAT. Like the NASA telescope game's results screen, but matched on the actual design.

```js
{
  id: "explorer-1", name: "Explorer 1", year: 1958, agency: "NASA / JPL",
  objective: "radiation",          // the topic it served
  orbit: "leo",                    // nearest of the game's three orbits
  tags: ["radiation"],             // its instrument types, as in parts.js
  mass_kg: 13.97,
  power: "battery",                // "battery" (no solar cells) or "solar"
  blurb: "One line on what it did.",
  source: "A page a person opened."
}
```

Matching: same topic first, then the same orbit, shared instrument types, the same kind of power, and the nearest mass (by ratio). The debrief names the closest mission and says what the two designs share.

**Hints** in `data/hints.js` (approved by the data owner): one global, `HINTS`. Draft text for Story to rewrite freely; the keys are fixed.

```js
const HINTS = {
  screens: { hub: [...], briefing: [...], orbit: [...], build: [...], launch: [...],
             readiness: [...], mission: [...], debrief: [...] },   // general tips, one sentence each
  tutorial: { hub: "...", briefing: "...", ... },                  // one first-visit line per screen
  checks: { "battery-only": "...", "power": "...", ... }           // a tip for each runChecks id
};
```

**Tier field:** `grant_musd`, optional, overrides `CAMPAIGN.grant_musd` for that tier. In a campaign, `budget_musd` is the **starting treasury**.

**Event field:** `objectives`, an optional array of objective ids. If present, the event fires only on missions for those topics.

**Debrief text** in `data/debrief.js`: one short paragraph per limiting factor, keyed `mass`, `power`, `budget`, `data`, `event`, `design` and `none`, plus two campaign keys: `saturated` (this mission's knowledge gain was under 15% of a first mission's on the topic) and `breakthrough` (over 60%: a first look at a new topic). One more key, `disciplines` (approved by the data owner), maps each limiting factor to the name NASA Goddard's Mission Design Lab uses for that discipline (Resources tab: "Mission Design Lab"): mass to Structures, power to Power, data to Communications, budget to Cost, event to Risk; a wrong orbit to Orbit and trajectory and a wrong instrument to Science instruments. `design` means nothing ran short but the instruments or orbit did not suit the objective; `none` means the target was reached.

Radar skips the resolution check (formula 6), because radar builds a synthetic aperture far larger than its antenna. This stays unless radar resolution starts to matter in play.

The Math model section below adds a few fields to parts, orbits and objectives. Solar panels leave `power_gen_w` at 0, because the game computes it.

## Game rules

Checks and formulas live in `js/game.js`, owned by Rules. The simulation, events and scoring live in `js/mission.js`, owned by Simulation. Every number here is a starting value for QA to tune.

### Checks at the readiness review

**Blockers** stop the launch:

- Total mass is over the launcher's `capacity_kg` for the chosen orbit.
- Total cost of parts plus launcher is over the tier's budget.
- Total `power_draw_w` is over total `power_gen_w`.
- A category is empty. The spacecraft needs at least one instrument, power, comms and computer part.

**Warnings** let the launch go ahead and cost points:

- Mass or power margin is under 10%. Events then hit harder.
- Instruments make more data per day than the comms can send down. The excess is lost.
- No instrument matches the objective's `wants` tags.

### Simulation

1. The mission runs one month per step, for the orbit's `lifetime_months`.
2. Each month, every working instrument earns `science` times the orbit's `science_mult`.
3. Data returned is the smaller of data produced and `downlink_gb_day` times `downlink_mult`. Science only counts in proportion to data returned.
4. Events fire at random months, as many as the tier allows. The random seed comes from the design, so the same design replays the same mission.
5. The mission ends at the end of its lifetime, or early if a required part fails.

### Scoring

| Part of the score | Points | How it is earned |
| --- | --- | --- |
| Science returned | 50 | Share of the objective's `science_target` reached |
| Efficiency | 15 | Payout divided by everything spent (design, launch and event costs); full points at 1.5 |
| Margins | 15 | Mass and power margins of 10% or more |
| Events | 10 | Lost for each part lost, each month lost and each event cost paid |
| Novelty | 10 | This mission's knowledge gain as a share of what a first mission on the topic would earn |

One star at 50 points, two at 70, three at 90. **Three stars also need the science target reached.** Lost months and event costs count against everything they affect: science, treasury, efficiency, novelty and the event points. Without a campaign, efficiency and novelty are scored as if it were the first mission on the topic.

**Payout** (campaign only), for the science `S` a mission actually sent home (a failed mission keeps what it sent before failing):

```
knowledge(S) = 1 - exp(-S / knowledge_scale)
payout       = max(value_musd * (knowledge(S_after) - knowledge(S_before)), repeat_floor_musd)
```

**Ends:** a win when `win.topics_known` topics (or every topic, if fewer exist) reach `win.knowledge`; a time-out at `end_year`. The game never soft-locks: if the treasury cannot afford the cheapest launchable design for any open topic, an emergency grant tops it up and the debrief says so.

### Debrief

The game works out the single limiting factor: the resource that capped the science, or the event that ended the mission. It shows the matching paragraph from `data/debrief.js` and one concrete suggestion. This screen is the educational point of the whole game, so it gets real writing time, aim to have minimal wording and utilize icons to illustrate points.

## Math model

Eight one-line formulas make the numbers behave like a real mission, with no trajectory simulation. All of them run in `js/game.js`. Formulas 1, 3, 7 and 8 drive the four resource bars and are must-haves. Formulas 2, 4, 5 and 6 make the three orbits feel different and go in after the first full playthrough.

Constants: Earth's gravitational parameter μ = 3.986 × 10^14 m³/s², Earth's radius R = 6371 km, standard gravity g₀ = 9.81 m/s², sunlight S = 1361 W/m².

**1. Rocket equation.** Can the spacecraft's own propulsion supply the speed change its orbit needs?

```latex
\Delta v = I_{sp}\, g_0 \ln\frac{m_{full}}{m_{empty}}
```

`m_full` is the total spacecraft mass. `m_empty` is that mass minus `fuel_kg`. Launch is blocked if Δv is below the orbit's `dv_needed_ms`. Every kilogram of instruments lowers Δv.

**2. Orbital speed and period.** How fast the satellite moves and how often it comes around.

```latex
v = \sqrt{\mu / r}, \qquad T = 2\pi\sqrt{r^3 / \mu}, \qquad r = R + h
```

`h` is the orbit's `altitude_km` in metres. The orbit card shows the period and laps per day. A period of 24 hours gives the geostationary altitude.

**3. Solar power.** What a panel generates in full sun.

```latex
P = S\, A\, \eta \cos\theta
```

`A` is `panel_area_m2` and η is `efficiency`. The game uses θ = 0 and fills in `power_gen_w` for solar panels from this.

**4. Eclipse fraction.** The worst-case share of each lap spent in Earth's shadow.

```latex
f = \frac{1}{\pi}\arcsin\frac{R}{R + h}
```

Eclipse time per lap is `f` times the period from formula 2.

**5. Battery size.** The energy needed to run through the eclipse.

```latex
E = \frac{P_{load}\; t_{eclipse}}{DoD}
```

`P_load` is total `power_draw_w` and `DoD` is the depth of discharge, fixed at 0.3. If total `battery_wh` is below E, instruments switch off in shadow and science is multiplied by (1 − f).

**6. Image resolution.** The smallest detail an instrument can see from its orbit.

```latex
x = 1.22\,\frac{\lambda\, h}{D}
```

λ is `wavelength_m` and D is `aperture_m`. The instrument card shows the resolution in metres for the chosen orbit. An objective can set `needs_resolution_m`, and instruments that miss it earn no science.

**7. Data budget.** What actually reaches the ground.

```latex
D_{returned} = \min\left(D_{produced},\; D_{downlink} \cdot c\right)
```

`D_produced` is the sum of `data_gb_day`, `D_downlink` is the sum of `downlink_gb_day`, and `c` is the orbit's `downlink_mult`.

**8. Margins.** Used for mass, power and budget at the readiness review.

```latex
margin = \frac{capacity - used}{capacity}
```

### Fields the math adds to the data format

| File | Part type | New fields |
| --- | --- | --- |
| `parts.js` | propulsion | `isp_s`, `fuel_kg` |
| `parts.js` | power, solar panels | `panel_area_m2`, `efficiency` |
| `parts.js` | power, batteries | `battery_wh` |
| `parts.js` | instrument | `aperture_m`, `wavelength_m` |
| `orbits.js` | every orbit | `altitude_km`, `dv_needed_ms` |
| `objectives.js` | every objective | `needs_resolution_m`, optional |

The data person needs a checked source for each of these, the same as every other number. `dv_needed_ms` is the hardest to source and can start as a rough placeholder marked as one.

### Live open data (calls made when the game opens)

The snapshot in `data/earth.js` always works, offline and from a file. When the internet is there, `js/live-data.js` calls three free, keyless open-data services that allow browser calls, and the game says which it is using: **LIVE DATA** or **SNAPSHOT**.

| Service | Agency | What it changes |
| --- | --- | --- |
| [Solar cycle indices](https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json) (monthly sunspot number, SILSO version 2, 1749 to last month) | NOAA Space Weather Prediction Center | Replaces the sunspot table, so the 1999 and 2026 eras fly under the real Sun of that year, and the current month is in the 2026 era. |
| [EONET](https://eonet.gsfc.nasa.gov/api/v3/events) (Earth Observatory Natural Event Tracker) | NASA | "Right now" lines in the debrief: open wildfire and sea-ice events, with names and dates. |
| [CWFIS hotspots, last 24 hours](https://cwfis.cfs.nrcan.gc.ca/) (Canadian Wildland Fire Information System; the hotspots come from NASA MODIS and VIIRS) | Natural Resources Canada | "Right now" line for the wildfire topic: satellite fire detections over North America in the last day. |

Rules:

- **Science never waits for the network.** `game.js` and `mission.js` read `EARTH` as before; `live-data.js` only overwrites the sunspot table and adds `EARTH.live`. A call that fails or takes over 8 seconds is skipped, and the snapshot stays.
- **The tests never call the network.** `tests/load.js` does not load `live-data.js`, so every seed gives the same mission.
- **No keys in the code.** Every service above is free and needs no key. A service that needs a key (NASA FIRMS, Meteomatics) stays a rebuild input for `tools/earth_data.py`, never a call from the page.
- `EARTH.live` = `{ status: "live" | "partial" | "snapshot", fetched_at, sources: [{ id, name, ok }], sunspots_through, wildfire_now, sea_ice_now }`. The front end reads it only through `getLiveData()`.

## Data sources

The official Resources tab lists eight NASA resources and one CSA resource. They are design references and documents, not raw data sets, so they shape how the game works and where part numbers come from.

| Resource | Agency | How we use it |
| --- | --- | --- |
| [A Learning Game About Telescopes](https://science.nasa.gov/mission/webb/game-build-it-yourself/) | NASA | Closest existing game to ours. Play it before building, then make sure ours differs (see below). |
| [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) | NASA | Best source of realistic small-satellite numbers for `parts.js`: mass, power, comms, launch. |
| [Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf?emrc=a454cf) | NASA | Its four mission segments frame the game: launch (rocket screen), space (build screen), ground (downlink), user (science score). |
| [Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) | NASA | Its list of spacecraft disciplines (power, propulsion, comms, and so on) backs our part categories and the stretch roles. |
| [Concept Maturity Levels](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299) | NASA JPL | Names for the three difficulty tiers, and a line in the pitch on how real concepts mature. |
| [NASA Mission Viz](https://nasa.github.io/mission-viz/) | NASA | Visual reference for orbits. Not embedded. |
| [General Mission Analysis Tool](https://software.nasa.gov/software/GSC-19468-1) | NASA | Out of scope: too heavy for 48 hours. Cite it as where real mission designers go next. |
| [Visualize a Space Mission Using VR](https://www.spaceappschallenge.org/2023/challenges/visualize-a-space-mission-using-virtual-reality/) | NASA | A 2023 challenge. Background only. |
| [Digital Games and Activities](https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp) | CSA | Tone and style reference for educational games. Credit CSA on the project page. |

### What this changes

- **Study the telescope game first.** It already does objective-first design, choices that lock out incompatible options, three levels, and a results screen naming similar real missions. Ours must add what it lacks: hard limits on mass, power and budget, random events, and a debrief explaining why the mission fell short.
- **Borrow its best idea.** Our debrief also names a real mission with a similar design, which needs one `real_mission` line per objective in `objectives.js`.
- **CubeSat 101 is the data person's first read.** It is the main source for part numbers.
- **Fire and sea-ice data are not on the official list.** NASA FIRMS and CSA RADARSAT can still inspire the two objectives' stories, but they are outside sources. Each needs its own row in `SOURCES.md`, and we follow that site's data-use rules.

`SOURCES.md` holds one row per resource used: name, agency, link, and which file or screen uses it. QA copies it into the project page.

### Using these with AI

Everyone on the team works through AI, and an AI will confidently summarise a document it has never read.

| Resource | Who reads it | How to give it to the AI |
| --- | --- | --- |
| CubeSat 101 | Data | Download the PDF and attach it. Ask for each number with its page number. |
| Design and Develop Science Missions | Story | Download the PDF and attach it. Ask for the four segments and their terms in plain words. |
| Mission Design Lab | Story, QA | Copy the page's text and paste it in. Ask for a list of failure types to turn into events. |
| Concept Maturity Levels | Story | Paste the abstract. Only needed if the tiers get renamed. |
| A Learning Game About Telescopes | Design screens, QA | A person plays it for ten minutes. An AI cannot, and the comparison matters for judging. |
| CSA Digital Games and Activities | QA | A person skims it for tone and a Canadian angle. |

- **Never prompt from a link or a title alone.** The AI will invent the contents. Attach the file or paste the text every time.
- **Spot-check three numbers by hand.** The data person opens the PDF at the cited page for any three values before they go into `parts.js`.
- **Skip GMAT, Mission Viz and the 2023 VR challenge in the build.** They are background for QA, not inputs to the game.

## Front end and back end

There is no server: the whole game runs in the player's browser. "Back end" here means the logic layer in `js/game.js`, and "front end" means everything the player sees. The two only talk through the functions listed below.

|  | Front end | Back end |
| --- | --- | --- |
| Files | `index.html`, `css/`, `js/ui-design.js`, `js/ui-mission.js` | `js/game.js`, `js/mission.js`, everything in `data/` |
| Owners | Design screens, Story | Rules, Simulation, Data |
| Runs | Drawing the seven screens | All eight formulas (`game.js`) |
|  | Handling clicks and navigation | Totals for mass, power, cost and data (`game.js`) |
|  | Showing the four resource bars | Blockers and warnings (`game.js`) |
|  | Showing blurbs, briefings, events and debrief text | The month-by-month simulation and seeded random events (`mission.js`) |
|  | Formatting numbers and units | Scoring, stars and the limiting factor (`mission.js`) |
|  | Hints and the tutorial | Saving progress and design codes (`mission.js`) |

Two rules keep the layers apart:

- **The front end never does maths.** It asks the back end for a number and displays it.
- **The back end never touches the page.** `game.js` contains no `document` or HTML code, so its owners can test it in the browser console before any screen exists.

### Functions the front end may call

The front end holds one `design` object while the player builds, and one `mission` object after launch. It changes them only through these functions, and reads the data globals (`PARTS`, `ORBITS`, `LAUNCHERS`, `OBJECTIVES`, `TIERS`, `EVENTS`, `DEBRIEF`, `CAMPAIGN`, `RESEARCH`, `EARTH`) only to show names, blurbs and plain field values. Every mission function returns `null`, never an error, when given `null` (for example after `startMission` refused a launch). `node tests/api.js` checks this whole block against the code.

```javascript
// js/game.js (Rules)
newDesign(tierId)               // returns an empty design: { tier, objective, orbit, parts: [], launcher }
setObjective(design, id)
setOrbit(design, id)
addPart(design, partId)         // ignores unknown ids and duplicates
removePart(design, partId)
setLauncher(design, id)
getTotals(design)               // { mass_kg, power_draw_w, power_gen_w, cost_musd, data_gb_day,
                                //   downlink_gb_day, delta_v_ms, margins: { mass, power, budget },
                                //   data_returned_gb_day, battery_wh, capacity_kg, budget_musd, dev_months,
                                //   body: { id, name, payload_kg, payload_used_kg, slots: { category: { used, max } } } or null }
getCategories()                 // [{ id, name, sub, required }] in display order: the Build screen's bins
getEras()                       // [{ id, name, year, blurb, real_missions, unlocked, best_stars, topics: [objective ids open in that era] }]
getAvailability(design)         // { parts: { id: { available, year, reason } }, launchers: {...}, objectives: {...} }
                                // One call per screen refresh: grey out a card when available is false and show reason
                                // ("Arrives in 1964", or "Needs research: Television from orbit" in a campaign).
setEra(design, eraId)           // sets design.era and design.year; only what existed by then is offered
getResearchTree()               // { nodes: [{ id, name, year, depth, cost_musd, cost_sci, blurb, unlocks_names, owned, can_buy,
                                //   missing }], edges: [{ from, to }] }; owned and can_buy are false outside a campaign
                                // A margin is null until its limit exists (no launcher, no panels).
getOrbitFacts(design)           // { period_min, laps_per_day, eclipse_fraction, eclipse_min, speed_kms,
                                //   resolution_m: { partId: metres or null }, battery_needed_wh,
                                //   target_in_view (share of the objective's real targets in view, or null) }
                                // All null until an orbit is chosen.
getPartFacts(design, partId)    // { power_gen_w, resolution_m, sharp_enough, counts, science_per_month }
                                // Computed numbers for one part card, added or not. null fields = not applicable yet.
previewScience(design)          // { per_month, months, total, target, share, data_share, power_share,
                                //   instruments: [{ id, name, per_month, counts, sharp_enough }] }
                                // Expected science if nothing goes wrong.
previewToggle(design, partId)   // { adding, before, after, delta, fixes: [{ id, text }], causes: [{ id, text }] }
                                // Hover preview: what clicking this part would change. Does not change the design.
                                // before/after/delta hold mass_kg, power_draw_w, power_gen_w, cost_musd, data_gb_day,
                                // data_returned_gb_day, delta_v_ms, battery_wh, science_total.
runChecks(design)               // { blockers: [{ id, text }], warnings: [{ id, text }] }

// js/mission.js (Simulation)
startMission(design)            // returns a mission; readable fields: month, lifetime_months, science
stepMonth(mission)              // { month, science, event or null, ended, calendar_month (0-11), month_name, year,
                                //   real: { fires, year } or { ice_extent_mkm2, ice_average_mkm2, daylight_share, year }
                                //   or { sunspots, year } or null }
                                // While an event waits for a choice it returns the same state and does not advance.
chooseEvent(mission, choice)    // choice = index into event.choices. Returns { id, title, label, protected,
                                //   failed_part (part id or null), ended, ended_early }
getDebrief(mission)             // { score, stars, limiting, suggestion, breakdown: { science, efficiency, margins, events, novelty },
                                //   science, science_target, paragraph, real_mission, events, ended_early,
                                //   real_world: { text, ...numbers } comparing the mission with NASA data, or null,
                                //   closest_mission: { id, name, year, agency, blurb, shared: [plain-English reasons] } or null,
                                //   limiting_name: the Mission Design Lab discipline, for example "Power" or "Cost",
                                //   segments: [{ id: "launch" | "space" | "ground" | "user", name, text }] one line each }
recordResult(mission)           // call once per finished mission; returns { stars, best_stars, unlocked (tier id or null),
                                //   era_unlocked (era id or null) }
getProgress()                   // { best_stars: { tierId: n }, best_score: { tierId: n } }
isTierUnlocked(tierId)          // true for Training, and for any tier after one with 2+ stars
resetProgress()

// js/mission.js (Simulation): campaign and saves. Without a campaign, nothing above changes.
newCampaign(tierId)             // starts and saves a campaign; treasury = tier.budget_musd; replaces any save
newCampaignDesign()             // an empty design that belongs to the campaign (budget = treasury, cost paid at launch);
                                // null if there is no campaign or it has finished. newDesign() stays a standalone mission.
getCampaign()                   // the saved state, or null
resetCampaign()
getHubInfo()                    // { year, treasury_musd, science_pts, archive_sci_per_year,
                                //   (each topic also has data_collected, data_cap and complete: nothing new is left to collect)
                                //   lessons: [ids earned], topics: [{ id, name, available, knowledge,
                                //   science_so_far, next_payout_estimate_musd, locked_reason }],
                                //   research: [{ id, name, year, depth, cost_musd, cost_sci, blurb, owned, affordable, requires_met,
                                //   missing: [plain-English reasons it cannot be bought yet], unlocks_names: [...] }],
                                //   missions, finished, won }
                                // depth = longest chain of prerequisites, so a tree screen can place each node in a column.
buyResearch(id)                 // { ok, reason }; spends cost_musd and cost_sci
getLab()                        // { science_pts, treasury_musd, upgrades: [{ id, name, of, of_name, year, cost_musd, cost_sci,
                                //   owned, can_buy, missing: [plain-English reasons], gains: [plain-English differences],
                                //   blurb }] } or null outside a campaign. Research stays in getResearchTree().
buyUpgrade(id)                  // { ok, reason }; the successor replaces its predecessor for the rest of the campaign
isPartAvailable(id, design), isLauncherAvailable(id, design), isObjectiveAvailable(id, design)
                                // false when locked by research (campaign) or not yet invented in the design's era
previewPayout(design)           // { expected_payout_musd, knowledge_before, knowledge_after, novelty, cost_musd, net_musd,
                                //   new_data, data_left, topic_complete }  new_data = science points this flight would earn
getHints(screen, design)        // { mode: "on" | "request" | "off", tutorial, tips: [...] }  screen = "hub", "briefing",
                                // "orbit", "build", "launch", "readiness", "mission" or "debrief". tips lead with advice
                                // for the design's current problems (from runChecks), then general tips. mode comes from
                                // the tier's hints field: "off" returns no tips. design may be null.
getLiveData()                   // { status: "live" | "partial" | "snapshot", fetched_at, sources: [{ id, name, ok }], sunspots_through,
                                //   wildfire_now: { text, events, hotspots_24h } or null, sea_ice_now: { text, events } or null }
                                // For the LIVE DATA / SNAPSHOT badge. The debrief's real_world.now holds the same "right now" text.
exportSave()                    // the whole save (campaign and tier progress) as one text code; may be long
importSave(code)                // { ok, reason }; a bad code never crashes and never overwrites a good save
```

Changes in a campaign:

- `getTotals` and `runChecks` use the treasury as the budget.
- `runChecks` adds `part-locked`, `launcher-locked` and `objective-locked` blockers.
- `startMission` returns null if there are blockers, takes a copy of the design (later edits never change a flown mission), and deducts the cost from the treasury.
- `stepMonth`'s `event` carries each choice's real odds: `choices[i].fail_chance_now`, which includes the thin-margin penalty.
- `recordResult` rejects an unfinished mission and pays only once. It also returns `{ payout_musd, knowledge_before, knowledge_after, novelty, treasury_musd, year, bailout, campaign_over, won, lessons_new }` (`lessons_new`: lesson ids first earned on this mission).
- `getDebrief` always returns `payout_musd`, `knowledge_before`, `knowledge_after`, `novelty`, `best_next_topic` and `knowledge_paragraph` (without a campaign they describe a first mission on the topic, and `best_next_topic` is null); in a campaign `knowledge_paragraph` holds the `saturated` or `breakthrough` text when it applies.
- Campaign rules apply only to designs from `newCampaignDesign()`. A design from `newDesign()` is always a standalone mission, even while a campaign is saved.
- The seed: without a campaign, the same design replays the same mission exactly. In a campaign, the mission number is added, so each flight has fresh luck.

All of these are live on `main` with real maths. Every one can be tried in the browser console (F12) before any screen exists.

A real server is only needed for an online leaderboard, which is out of scope. If it is ever added, `game.js` moves to it unchanged.

## Player interaction, screen by screen

This section tells the screens exactly what the player does on each screen, which call drives each element, and what to show. The front end never computes a number itself; every number below comes from a call.

### The loop

```
New campaign / Continue -> Campaign hub -> 1 Briefing ... 7 Debrief -> back to the Campaign hub
                           (or, with no campaign:)
Tier select -> Base map -> 1 Briefing -> 2 Orbit -> 3 Build -> 4 Launch vehicle -> 5 Readiness --GO--> 6 Mission -> 7 Debrief
                  ^____ the map is the way between places, any time before launch ____|                         |
                                                   3 Build  <------------- "Redesign" (same design) ------------|
                                                   Base map <------------- "New mission" (newDesign) -----------|
```

- **One design object.** Create it with `newDesign(tierId)` at tier select. Every screen edits the same object. Going back never clears a choice; if an earlier change breaks a later one (for example a new orbit the chosen rocket cannot reach), the Readiness review reports it.
- **A base map** is the hub between the five design screens (Design screens owns it, in `js/ui-design.js`). It is a map of a space centre, drawn low-poly (`LowPoly.scenes.base`, with the older flat SVG map as the fallback), with one numbered place per screen: 1 Mission Control (Briefing), 2 Tracking Station (Orbit), 3 Workshop (Build), 4 Rocket Yard (Launch vehicle), 5 Launch Pad (Readiness). The player walks between places with the arrow keys or WASD and presses E to go in, or clicks a place and walks there. Each place is marked next, done, open or locked; Mission Control is open from the start, the Tracking Station opens once a job is picked, the Workshop once an orbit is chosen, and each later place once the one before it has been visited; every place already visited stays open before launch. A gold route and an "OBJECTIVE" line point to the next place with work left, judged from `runChecks` (for example back to the Workshop while a NO GO there remains). Inside a place, the header shows the objective and a minimap; M, Esc or a click on the minimap opens the map, and "GO TO <place>" walks to the place the gold route points at, which can be an earlier one. From launch on, the map is locked until the Debrief.
- **The four resource bars** (mass, power, budget, data) appear from Build onward, on Build, Launch vehicle and Readiness. Refresh them after every change with `getTotals(design)`.
- **Hints** follow the tier's `hints` field: `"on"` shows a hint on each screen and a short tutorial on the first visit; `"request"` shows a hint button; `"off"` shows nothing. Call `getHints(screen, design)`; the text lives in `data/hints.js`.

### Campaign hub (campaign only, outside the base map)

| Element | Source | Behaviour |
| --- | --- | --- |
| Year and treasury | `getHubInfo()`: `year`, `treasury_musd` | Always visible. |
| One card per topic | `topics[]`: `name`, `knowledge` as a bar, `next_payout_estimate_musd` | Locked topics show `locked_reason` ("Needs Radar laboratory"). |
| Research list | `research[]`: `name`, `cost_musd`, `blurb`, `owned`, `affordable` | A Buy button calls `buyResearch(id)`, then the hub refreshes. |
| Start a mission | `design = newCampaignDesign()` | Opens Briefing. |
| Save codes | `exportSave()`, `importSave(code)` | An "Export" box to copy from; an "Import" box with an error line on failure. |
| Ending | `finished`, `won` | A win or time-out summary instead of the start button. |

**Campaign additions to the seven screens:**

- **Briefing** shows only available topics, each with its expected payout.
- **Build and Launch vehicle** grey out locked parts and rockets with "Research needed: name". The budget bar's limit is the treasury. A line from `previewPayout(design)` reads: "Expected payout $X M, cost $Y M, net $Z M".
- **Mission** shows each event choice's odds from `fail_chance_now`, for example "40% chance of losing the computer".
- **Debrief** keeps the limiting factor and the "Try this" line **first**, then shows the payout, knowledge before and after as a bar, the `saturated` or `breakthrough` paragraph, and a "try a new topic" line from `best_next_topic`. "Redesign" becomes "Rebuild this satellite" (a fresh launch, paid again), and a new button returns to the hub.

### Tier select (before Briefing)

| Element | Source | Behaviour |
| --- | --- | --- |
| Hero picture | `LowPoly.scenes.title` (`js/lp-earth.js`) | A low-poly Earth with a satellite above the cards. If it cannot draw, the page works without it. |
| One card per tier | `TIERS`: `name`, `budget_musd`, `events` | Locked cards are greyed out and say only LOCKED; the rule ("Earn 2 stars on the previous tier") is the screen's one hint and the card's accessible name, not text repeated on every card. |
| Lock state | `isTierUnlocked(tier.id)` | Only unlocked cards can be clicked. |
| Best result | `getProgress().best_stars[tier.id]` | Show 0 to 3 stars on the card. |
| Click a card | `design = newDesign(tier.id)` | Go to the base map, standing at the main gate, with Mission Control (Briefing) next. |

### 1. Briefing

| Element | Source | Behaviour |
| --- | --- | --- |
| One card per objective | `OBJECTIVES`: `name`, `briefing`, `science_target` | Click to select; the chosen card is highlighted. |
| "What counts" line | `objective.wants`, shown as instrument names from `PARTS` with matching `tags` | The first type counts fully, the others half. |
| Select | `setObjective(design, id)` | Next is enabled once an objective is chosen. |

### 2. Orbit

| Element | Source | Behaviour |
| --- | --- | --- |
| One card per orbit | `ORBITS`: `name`, `altitude_km`, `blurb`, `lifetime_months` | Click to select. |
| Card facts | `getOrbitFacts(probe)`, where `probe` is a fresh `newDesign` with `setOrbit(probe, orbit.id)` | Show `period_min`, `laps_per_day`, `eclipse_min`. |
| Real targets in view | `getOrbitFacts(probe).target_in_view` | Wildfire: "Sees 69% of the world's fires (NASA FIRMS 2025)". Hidden when null. |
| Suits the objective? | `objective.orbit_fit[orbit.id]` | 0 shows a red "cannot see the target" badge; under 1 shows "partial view". The card stays clickable: choosing badly is allowed and teaches. |
| Select | `setOrbit(design, id)` | Next is enabled once an orbit is chosen. |

### 3. Build

Building is a chain of trade-offs: each part fixes one problem and creates the next, and the bars make that chain visible. The player clicks part cards to add or remove them.

**Rules of building**

- **Click to toggle.** Clicking a card adds the part; clicking it again removes it. No drag and drop.
- **Several parts per category, one of each part.** Two instruments, or a spare computer, are allowed and useful. The same part cannot be added twice.
- **Four categories are required:** instrument, power, comms and computer. Propulsion is optional, but polar and geostationary orbits need its speed change.
- **Bad choices are allowed.** Nothing is disabled on this screen. A part that does not suit the objective or orbit is greyed out with its reason, but stays clickable; the player learns from the result.
- **Problems show up here, live.** Under the bars, list `runChecks(design)` blockers and warnings as they change, so the player does not discover them only at the Readiness review.
- **Orbit comes first.** Resolution, ground contact and the speed change needed all depend on the orbit, so part cards show different numbers in different orbits. The launcher comes after, so the mass bar shows "pick a rocket" until then.

**How the categories depend on each other**

| Category | Gives | Costs elsewhere |
| --- | --- | --- |
| Instrument | Science, if its type suits the objective and it is sharp enough from this orbit | Power, data, mass, the most money |
| Power: solar panels | Power in sunlight | Mass |
| Power: battery | Keeps instruments on in Earth's shadow; without one, science drops by roughly a third | Mass |
| Comms | Sends data home. The radio's rate is cut to the orbit's contact time (2.5% of the day in low orbit, 7% polar, 100% geostationary), and science counts only for data that arrives | Power, mass |
| Computer | Runs the spacecraft. The radiation-tolerant one survives solar storms; a second computer is a spare | Power |
| Propulsion | Speed change: 0 m/s needed in low orbit, 80 polar, 260 geostationary. Any thruster also dodges debris | Mass and power. The heavier the spacecraft, the less speed change the same fuel gives |

**Screen elements**

| Element | Source | Behaviour |
| --- | --- | --- |
| Five columns | `PARTS` grouped by `category`: instrument, power, comms, computer, propulsion | Mark each required column until it has a part. |
| Part card | Data fields: `name`, `blurb`, `mass_kg`, `power_draw_w`, `cost_musd`, `data_gb_day`, `downlink_gb_day`, `battery_wh` | Show only fields that are not 0. Selected cards are highlighted. |
| Computed card numbers | `getPartFacts(design, part.id)` | Solar panels: `power_gen_w`. Instruments: `science_per_month` and `resolution_m`. Grey out with "does not count for this objective" when `counts` is false, or "too blurry from this orbit" when `sharp_enough` is false. |
| Hover preview | `previewToggle(design, part.id)` on hover (on touch screens, a first tap shows it and a second tap toggles) | Show the change before clicking: each non-zero `delta` as "+0.8 kg, +15 W, +$0.15M, data home +5.45 GB/day, science +188", and one line each for `fixes` (green, "Fixes: ...") and `causes` (red, "Causes: ..."). If `adding` is false, title it "Remove". The design does not change until the click. |
| Click | `addPart` / `removePart`, then refresh bars, preview and checks | |
| Four bars | `getTotals(design)` | **Mass**: `mass_kg` against `capacity_kg` ("pick a rocket" while 0). **Power**: `power_draw_w` against `power_gen_w`. **Budget**: `cost_musd` against `budget_musd`. **Data**: `data_returned_gb_day` against `data_gb_day`; for data a full bar is good. Amber when a margin is under 10%, red when over the limit. |
| Live problems | `runChecks(design)` | Blockers in red and warnings in amber, under the bars. Ignore `no-launcher` here; it belongs to the next screen. |
| Science preview | `previewScience(design)` | "About `total` of `target` over `months` months", with a small row per instrument. An estimate, not a promise. |

**Example: sea ice in polar orbit, Standard tier.** These are the real numbers the back end returns after each click; the screen should make this story readable.

| Player does | Mass kg | Power W (draw / made) | Budget $M | Data GB/day (home / made) | Science (preview / 200) | Still blocking |
| --- | --- | --- | --- | --- | --- | --- |
| Adds the radar | 45 | 200 / 0 | 6 | 0 / 10 | 0 | no power, comms, computer |
| Adds the large solar panel | 53 | 200 / 365 | 6.8 | 0 / 10 | 0 | no comms, computer |
| Adds the S-band radio | 53 | 210 / 365 | 6.8 | 4.55 / 10 | 101 | no computer; data warning |
| Adds the basic computer | 53 | 210 / 365 | 6.8 | 4.55 / 10 | 101 | not enough speed change |
| Adds the battery | 59 | 210 / 365 | 7.0 | 4.55 / 10 | 157 | not enough speed change |
| Swaps S-band for X-band | 59 | 215 / 365 | 7.1 | 10 / 10 | 346 | not enough speed change |
| Adds the small green thruster | 64 | 230 / 365 | 7.6 | 10 / 10 | 346 | 52 of 80 m/s, still short |
| Swaps to the large thruster | 74 | 265 / 365 | 8.6 | 10 / 10 | 346 | needs a launcher (next screen) |
| On Launch vehicle, picks the rideshare | 74 / 50 | | 9.0 | | | too heavy |
| Picks the small launcher instead | 74 / 200 | | 16.1 / 20 | | | ready to launch |

### 4. Launch vehicle

| Element | Source | Behaviour |
| --- | --- | --- |
| One card per rocket | `LAUNCHERS`: `name`, `cost_musd`, `blurb` | Click to select. |
| Capacity to this orbit | `launcher.capacity_kg[design.orbit]` | 0: card disabled, "cannot reach this orbit". Below `getTotals(design).mass_kg`: red "too small". Otherwise "fits". |
| Select | `setLauncher(design, id)` | Bars refresh: the mass bar now has a limit and the budget bar includes the rocket. |

### 5. Readiness review

| Element | Source | Behaviour |
| --- | --- | --- |
| Go / no-go list | `runChecks(design)` | Blockers in red, warnings in amber, each with its `text`. Each line has a "Fix" link to the screen in the table below. |
| Launch button | `blockers.length === 0` | Disabled while there are blockers. With warnings only, it reads "Launch anyway". |
| Launch | `mission = startMission(design)` | Go to Mission. |

Where each check is fixed:

| Check `id` | Go to |
| --- | --- |
| `no-objective` | 1 Briefing |
| `no-orbit`, `orbit-fit` | 2 Orbit |
| `empty-instrument`, `empty-power`, `empty-comms`, `empty-computer`, `power`, `power-margin`, `delta-v`, `data`, `battery`, `no-match`, `resolution-<partId>` | 3 Build |
| `no-launcher`, `launcher-reach`, `mass`, `mass-margin`, `budget` | 4 Launch vehicle (mass and budget can also be fixed on Build) |

### 6. Mission

| Element | Source | Behaviour |
| --- | --- | --- |
| Month ticker | `s = stepMonth(mission)` on a timer, about 300 ms per month | Show "Month `s.month` of `mission.lifetime_months`". A pause button stops the timer; a fast-forward button shortens it. |
| Science bar | `s.science` against the objective's `science_target` | Fills toward the target; it may pass it. |
| The real Earth this month | `s.month_name`, `s.real` | Wildfire: "August: 557,357 fires burned (NASA FIRMS 2025)". Sea ice: "January: 13.1 million km2 of ice, polar night". This is where the player sees NASA data at work. |
| Event | `s.event` is not null | Stop the timer. Show `event.title`, `event.text` and one button per `event.choices[i].label`. |
| Player's choice | `out = chooseEvent(mission, i)` | Show one outcome line: "A part on board protected you" if `out.protected`; "`PARTS` name FAILED" if `out.failed_part`; "Mission over" if `out.ended_early`. Then resume the timer. |
| End | `s.ended` or `out.ended` | Go to Debrief. |

### 7. Debrief

| Element | Source | Behaviour |
| --- | --- | --- |
| Save the result | `r = recordResult(mission)`, once | If `r.unlocked`, show a banner: "Standard unlocked". |
| Score and stars | `d = getDebrief(mission)`: `score`, `stars` | Stars at 50, 70 and 90 points. |
| Score breakdown | `d.breakdown`: science (of 50), efficiency (of 15), margins (of 15), events (of 10), novelty (of 10) | Five short rows. |
| Science | `d.science` against `d.science_target` | |
| What limited you | `d.limiting_name` as the heading ("Power limited this mission"), then `d.paragraph` | `d.limiting` stays the stable key for code. |
| The four segments | `d.segments` | One short line each for launch, space, ground and user. |
| Try this | `d.suggestion` | One concrete change. This is the most important line on the screen. |
| Against the real Earth | `d.real_world.text` | The paragraph comparing the mission with NASA data, for example how many of 2025's real fires the design would have reported. Show it prominently: it is our strongest link to NASA data. |
| Your design's real twin | `d.closest_mission` | "Your design is closest to TIROS-1 (1960, NASA)", then its `shared` reasons ("both carried TV cameras", "both flew in low orbit") and its `blurb`. |
| Real-world cousin | `d.real_mission` | One line. |
| Events log | `d.events`: `title`, `label`, `failed_part` | What happened and what the player chose. |
| Buttons | | **Redesign**: back to Build with the same `design`. **New mission**: the base map with a fresh `newDesign(tier)`, Mission Control next. **Change tier**: tier select. |

Without a campaign, the same design always replays the same mission (the seed comes from the design), so the player can see exactly what their change did. In a campaign each flight has fresh luck.

## Team roles

Each person owns one aspect of the game and the files that go with it. The data person owns the data and sets up the repo first, so everyone else can build against it within the first half hour.

| Aspect | Owner | AI | Owns | Job |
| --- | --- | --- | --- | --- |
| Data | Yareem | Fable (or equal) | `data/parts.js`, `launchers.js`, `orbits.js`, `objectives.js`, `tiers.js`, `SOURCES.md` | Real numbers with checked sources and the data format. Sets up the starting repo with stub functions. Approves any change to a data field. |
| Rules | Yareem | Opus | `js/game.js` | Totals, the eight formulas, blockers and warnings, orbit facts. |
| Simulation | Yareem | Opus | `js/mission.js` | The month-by-month mission, random events and their effects, scoring, stars and the limiting factor. |
| Design screens | angads22 | Fable (or equal) | `index.html`, `css/`, `js/ui-design.js` | Briefing, Orbit, Build, Launch vehicle and Readiness review, the four resource bars, and the shared layout. |
| Story | (name) | Opus | `js/ui-mission.js`, `data/events.js`, `data/debrief.js` | The Mission and Debrief screens, the event and debrief writing, and tutorial hints. |
| QA | (name) | Opus | `tests/`, `README.md`, project page, demo video | Plays every merged build, files issues, requests tuning, keeps the record of AI use, and submits. |

Owners change only their own files. Anything else goes through a GitHub issue to that file's owner.

### Current tasks: Data, Rules and Simulation

Yareem holds all three back-end roles. The full ordered plan, with the timeline and cut lines, is `PLAN.md`. In short, all before the Sunday 14:00 freeze:

1. **Phase A.** Red-team bug fixes: copy the design at launch, honest `protected`, in-flight power, a proportional battery, input guards, advice that matches the design, "fire detections" wording.
2. **Phases B and C.** Campaign data, campaign state and saves, payout, the new scoring with the 3-star gate, and odds on event choices.
3. **Phase D.** `tests/campaign.js` and `tests/balance.js`, then tuning with the red-team sweep and a campaign simulation.
4. **Phase E.** Research and unlocks, once the seven screens and the hub play end to end.
5. **Phase F.** New topics chosen by available NASA data, plus era events.

**Judging (all roles):** the demo is a video of 30 seconds or less, or at most 7 slides; `SOURCES.md` is the References list; the tests are on `main` as validity evidence: `node tests/formulas.js` (the eight formulas), `node tests/campaign.js` (the economy and research tree), `node tests/balance.js` (balance guarantees), `node tests/api.js` (the contract with the screens), `node tests/speed.js` (nothing freezes a browser), plus the red-team harness in `tests/redteam/`.

**Status (Saturday night):** Phases A to F are on `main`. The 1957 campaign plays end to end in text (`node tests/play.js --campaign` on the working branch): 3 era topics plus 2 modern ones, 27 parts, 7 rockets and a 15-node research tree from 1958 solar cells to reusable rockets. A greedy campaign bot wins Training around 1963 and Standard around 1969, and times out on Expert, so a thoughtful player has room to do better. Known gaps, reported by `tests/balance.js` rather than hidden: the 1957 era flies low orbit only, as in history (polar orbits need thrusters from modern research); geostationary never wins, because fast fire detection is not scored yet (red team N5).

## Workflow

&#91;embedded content: how the six aspects connect · data to logic to screens to main\]

### Working rules

Data feeds both logic files, each logic file feeds its own screens, and everything meets on `main`, which QA plays and reports back on.

### Working rules

- **`main` always runs.** It deploys to GitHub Pages on every merge. A merge that breaks the game is reverted first and fixed second.
- **One branch per task.** Name it after the aspect, such as `rules/eclipse` or `story/solar-storm`, and keep it to a few hours of work.
- **Small pull requests.** Each PR says what changed and confirms you played one full mission with it.
- **Review by owner.** A `CODEOWNERS` file requests the owner of every touched file automatically. A PR that touches only your own files needs a quick look from anyone.
- **Data format changes go through the data person.** A new or renamed field needs the data person's approval, because three other aspects read it.
- **Issues are the to-do list.** QA files bugs and tuning requests as GitHub issues labelled by aspect, and owners close them.
- **Stubs first.** Every owner builds against the stub functions and placeholder data from the start, rather than waiting on anyone.

### Versions and changelog

The game carries a version number, and `CHANGELOG.md` at the top of the repo records what each version holds. Both live in version control, so anyone can see what a given build can and cannot do.

- **Current version: 0.8 beta.** A single mission plays from tier select to Debrief in the browser, in four eras, and the campaign plays from the title screen: hub, lab (research and upgrades), archive, payouts and save codes. The Gravitron story, per-part satellite art, fewer words, flat icons and a low-poly home page are in. Launch failures and the rest of the low-poly art are not in the game yet. `CHANGELOG.md` lists what is in and what is still missing.
- **Numbering.** `0.x beta` until we submit; **1.0 is the build we submit** at the code freeze. Raise the second number when a missing piece lands (for example the campaign hub makes 0.6).
- **Every merge to `main` that changes what a player sees, or what a back-end function returns, adds one line to the "Unreleased" section of `CHANGELOG.md`**, in the same commit or pull request. Write it for a teammate or a judge: what changed, not how. Use the headings Added, Changed, Fixed and "Not in this version yet".
- **Cutting a version.** Rename "Unreleased" to the version and date, start a new empty "Unreleased", update the version line in the footer of `index.html` (the one place the game shows it), and tag that commit `vX.Y`. Whoever merges the last piece cuts the version, after telling the team. Then run `node tests/version.js`: it fails when the footer, the "Current version" line above and the newest heading in `CHANGELOG.md` disagree, and warns when the tag is missing. Cloud AI sessions cannot push tags, so push the tag from a computer (`git push origin vX.Y`).
- **`SPEC.md` is still the source of truth for what the game should do.** The changelog only records what a version actually does.

### Getting started on GitHub

1. The data person creates the repo with `SPEC.md`, `CLAUDE.md`, the folder layout, stub `game.js` and `mission.js`, and placeholder data, then turns on GitHub Pages.
2. The data person adds everyone as a collaborator and adds a `CODEOWNERS` file that maps each path to its owner.
3. Each owner clones the repo, makes a branch, and opens a first PR within the first hour, even if it only replaces one stub.
4. Conflicts should be rare because every file has one owner. The one shared spot is the list of script tags in `index.html`, which the Design screens owner edits on request.

Two technical rules for every AI:

- **No `import`.** Browsers block it when a page is opened straight from a file. Each data file defines one global, such as `const PARTS = [...]`, loaded with a plain script tag.
- **`fetch` only in `js/live-data.js`,** only to services that allow browser calls, and always with the snapshot as the fallback ("Live open data"). The game must still work from a file with no internet.
- **Check the console before sending.** One missing comma in a data file breaks the whole game. Open the game, press F12, and confirm there is no red text.

### Before the clock starts

- [ ] Put a name on every role
- [ ] Create the repo with empty files in the agreed layout
- [ ] Everyone reads this spec and saves it for their AI
- [ ] QA confirms the AI disclosure rule and that everyone is registered on the team

### Checkpoints

Times are local. Submissions open Saturday at 9:00 AM and close Sunday at 11:59 PM.

1. **Saturday 9:00, kickoff.** Roles confirmed. Everyone starts on their own files.
2. **Saturday 12:00, skeleton.** All seven screens exist and click through on fake data. The first eight real parts are in.
3. **Saturday 16:00, rules work.** Blockers and warnings fire correctly on real data. All parts, rockets and orbits are in.
4. **Saturday 20:00, first full playthrough.** One mission runs from Briefing to Debrief. Anything in the must-haves that still fails is simplified or cut tonight.
5. **Sunday 10:00, balanced.** QA confirms Tier 1 is winnable and a careless design fails. Debrief text is final.
6. **Sunday 14:00, code freeze.** Bug fixes only from here.
7. **Sunday 17:00, demo recorded.** A video of 30 seconds or less, or at most 7 slides, in English, plus the project page and the References list, all from the frozen build.
8. **Sunday 20:00, submit.** That leaves four hours of buffer before the deadline.

## Out of scope

We are not building any of these, even if an AI offers to:

- Online or networked multiplayer
- A real-time 3D game engine, a physics simulation of launches, or models and art imported from elsewhere. The art is faceted, flat-shaded low-poly drawn by our own small renderer from code (`js/lowpoly.js` and the `js/lp-*.js` model files); launches and assembly may be shown with it in short animations, never simulated with it.
- Real orbital mechanics or trajectory maths
- Accounts, logins or a server
- More than one destination. Mars and the Moon wait until the Earth mission is finished.
- A rival AI space programme, and any online leaderboard. The campaign save stays in the browser, with export and import codes.

**Stretch list, in order**, started only after the first full playthrough works:

1. Tiers 2 and 3
2. Pass-and-play roles for up to four players, one subsystem each
3. Shareable design codes
4. A local leaderboard
5. A second objective with its own events

## Rules for working with AI

Six assistants will drift apart unless everyone prompts the same way.

- **Paste this spec first.** Every new AI session starts with this whole doc.
- **Ask for one file or one function at a time.** Never ask for "the game".
- **No frameworks, libraries or build tools** unless the whole team agrees.
- **Never let the AI rename a field** in the data format. If it wants a new field, ask the data person.
- **Check every number.** AI invents believable spacecraft specs. A value goes in only with a source link that a person opened.
- **Play before you push.** Open the game and finish one mission with your change in it.
- **New ideas go in `STRETCH.md`**, not into the code.
- **Keep a record of AI use.** QA writes down which tools made what, for the submission.

Starter prompt for teammates:

```
You are helping build a browser game for NASA Space Apps 2026.
The full team spec is pasted below. Follow it exactly.
My role is: <role>. I own only these files: <files>.
Use plain HTML, CSS and JavaScript with no libraries.
Do not rename or add data fields. Do not add features outside the spec.
Today I need: <one specific task>.

<paste the spec here>
```

**Open question:** does Space Apps 2026 require teams to disclose AI use, and in what form? The Judging & Awards Guide does not say; it does require every external resource to be listed in the References field. Until QA confirms otherwise, we list the AI tools used there too.
