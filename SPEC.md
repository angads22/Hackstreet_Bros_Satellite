# Space Mission Design Game: Team Spec

Nov 13, 2026 · @Yareem Al-Eryani

## What we're building

A browser game where the player designs a satellite mission under tight limits, launches it, and learns why it worked or failed. It answers the NASA Space Apps 2026 challenge "Space Mission Design Game".

The core loop takes about five minutes: choose an objective, build the spacecraft, check the margins, launch, read the debrief, redesign. Everything we build serves that loop. One mission that plays start to finish beats three half-built ones.

- **Platform:** plain HTML, CSS and JavaScript. No frameworks, no build step. It runs from a link.
- **Players:** one player first. Pass-and-play roles for up to four come later, if time allows.
- **Scenario:** an Earth-observation satellite with three orbit choices.
- **Give this whole doc to your AI** at the start of every session, so all six assistants build the same game.

## Game progression

A mission is seven screens in a fixed order. Each screen teaches one idea, and the player can go back to any earlier screen before launch.

1. **Briefing.** The player picks a science objective, such as wildfire monitoring or sea-ice mapping. The objective sets a science target and says which instrument types count. *Teaches: decide the goal before the hardware.*
2. **Orbit.** The player picks one of three orbits. Each card states its trade-off in one line: image detail, time in contact with the ground, mission lifetime, and how hard it is to reach. *Teaches: where you fly changes everything else.*
3. **Build.** The player picks parts in five categories: instruments, power, comms, computer and propulsion. Four bars update live: mass, power, budget and data. *Teaches: every part costs something in all four.*
4. **Launch vehicle.** The player picks a rocket. The game checks that the spacecraft's mass fits that rocket for the chosen orbit. *Teaches: a bigger rocket solves mass and eats the budget.*
5. **Readiness review.** A go / no-go list shows every failed check with a one-line reason. Blockers stop the launch. Warnings do not. *Teaches: thin margins are a choice, not an accident.*
6. **Mission.** The simulation runs month by month. Two or three events interrupt it, and the player makes one decision per event. *Teaches: designs get tested by things you did not plan.*
7. **Debrief.** The game shows the score, names the one thing that limited the mission, and suggests one change. A button sends the player back to Build with the same design loaded. *Teaches: iterate.*

### Difficulty tiers

Tiers reuse the same screens and parts. Only the numbers in the data file change, so they cost almost no extra code. Earning two stars unlocks the next tier.

| Tier | Budget | Events per mission | Hints |
| --- | --- | --- | --- |
| 1. Training | Generous | 1 | On, with a short tutorial |
| 2. Standard | Tight | 2 | On request |
| 3. Expert | Tightest | 3 | Off |

Tier 1 is a must-have. Tiers 2 and 3 are the first stretch items, because they add replay value for an hour of work.

Later, each tier will carry its own weights for every calculation, in the style of Plague Inc's difficulty selection, and a fourth Impossible mode is planned. Both are described in `STRETCH.md` and are not part of the first build.

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

Each objective carries one extra field, `orbit_fit`, that multiplies its science by orbit. For example, sea ice uses `{ leo: 0.3, sso: 1.0, geo: 0 }`. These values are starting points to tune.

## Data format

These field names are fixed. Nobody renames or adds a field without the data person agreeing, because the game logic reads them by name. The values below are placeholders, not real specs.

**Parts** in `data/parts.js`, about 15 in total, three per category:

```js
{
  id: "cam-hires",
  name: "High-resolution camera",
  category: "instrument",  // instrument | power | comms | computer | propulsion
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
  source: "https://..."    // a page a human opened and checked
}
```

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
  science_target: 180,
  needs_resolution_m: 2000,       // optional: instruments blurrier than this earn nothing
  orbit_fit: { leo: 0.5, sso: 0.5, geo: 1.0 },  // multiplies science by orbit; 0 = cannot see the target
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

**Debrief text** in `data/debrief.js`: one short paragraph per limiting factor, keyed `mass`, `power`, `budget`, `data`, `event`, `design` and `none`. `design` means nothing ran short but the instruments or orbit did not suit the objective; `none` means the target was reached.

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
| Science returned | 60 | Share of the objective's `science_target` reached |
| Budget left | 15 | Share of the budget unspent |
| Margins | 15 | Mass and power margins of 10% or more |
| Events | 10 | Events survived without losing a part |

One star at 50 points, two at 70, three at 90.

### Debrief

The game works out the single limiting factor: the resource that capped the science, or the event that ended the mission. It shows the matching paragraph from `data/debrief.js` and one concrete suggestion. This screen is the educational point of the whole game, so it gets real writing time.

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

The front end holds one `design` object while the player builds, and one `mission` object after launch. It changes them only through these functions, and reads the data globals (`PARTS`, `ORBITS`, `LAUNCHERS`, `OBJECTIVES`, `TIERS`, `EVENTS`, `DEBRIEF`) only to show names, blurbs and plain field values.

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
                                //   data_returned_gb_day, battery_wh, capacity_kg, budget_musd }
                                // A margin is null until its limit exists (no launcher, no panels).
getOrbitFacts(design)           // { period_min, laps_per_day, eclipse_fraction, eclipse_min, speed_kms,
                                //   resolution_m: { partId: metres or null }, battery_needed_wh }
                                // All null until an orbit is chosen.
getPartFacts(design, partId)    // { power_gen_w, resolution_m, sharp_enough, counts, science_per_month }
                                // Computed numbers for one part card, added or not. null fields = not applicable yet.
previewScience(design)          // { per_month, months, total, target, share, data_share, power_share,
                                //   instruments: [{ id, name, per_month, counts, sharp_enough }] }
                                // Expected science if nothing goes wrong.
runChecks(design)               // { blockers: [{ id, text }], warnings: [{ id, text }] }

// js/mission.js (Simulation)
startMission(design)            // returns a mission; readable fields: month, lifetime_months, science
stepMonth(mission)              // { month, science, event or null, ended }
                                // While an event waits for a choice it returns the same state and does not advance.
chooseEvent(mission, choice)    // choice = index into event.choices. Returns { id, title, label, protected,
                                //   failed_part (part id or null), ended, ended_early }
getDebrief(mission)             // { score, stars, limiting, suggestion, breakdown: { science, budget, margins, events },
                                //   science, science_target, paragraph, real_mission, events, ended_early }
recordResult(mission)           // call once per finished mission; returns { stars, best_stars, unlocked (tier id or null) }
getProgress()                   // { best_stars: { tierId: n }, best_score: { tierId: n } }
isTierUnlocked(tierId)          // true for Training, and for any tier after one with 2+ stars
resetProgress()
```

All of these are live on `main` with real maths. Every one can be tried in the browser console (F12) before any screen exists.

A real server is only needed for an online leaderboard, which is out of scope. If it is ever added, `game.js` moves to it unchanged.

## Player interaction, screen by screen

This section tells the screens exactly what the player does on each screen, which call drives each element, and what to show. The front end never computes a number itself; every number below comes from a call.

### The loop

```
Tier select -> 1 Briefing -> 2 Orbit -> 3 Build -> 4 Launch vehicle -> 5 Readiness --GO--> 6 Mission -> 7 Debrief
                  ^____________ back to any earlier screen, any time before launch ____|                        |
                                                   3 Build  <------------- "Redesign" (same design) ------------|
                                                   1 Briefing <----------- "New mission" (newDesign) ----------|
```

- **One design object.** Create it with `newDesign(tierId)` at tier select. Every screen edits the same object. Going back never clears a choice; if an earlier change breaks a later one (for example a new orbit the chosen rocket cannot reach), the Readiness review reports it.
- **A step bar** across the top shows the seven screens. Before launch, every earlier screen is clickable. From launch on, the bar is locked until the Debrief.
- **The four resource bars** (mass, power, budget, data) appear from Build onward, on Build, Launch vehicle and Readiness. Refresh them after every change with `getTotals(design)`.
- **Hints** follow the tier's `hints` field: `"on"` shows a hint on each screen and a short tutorial on the first visit; `"request"` shows a hint button; `"off"` shows nothing. Story writes the hint text.

### Tier select (before Briefing)

| Element | Source | Behaviour |
| --- | --- | --- |
| One card per tier | `TIERS`: `name`, `budget_musd`, `events` | Locked cards are greyed out with "Earn 2 stars on the previous tier". |
| Lock state | `isTierUnlocked(tier.id)` | Only unlocked cards can be clicked. |
| Best result | `getProgress().best_stars[tier.id]` | Show 0 to 3 stars on the card. |
| Click a card | `design = newDesign(tier.id)` | Go to Briefing. |

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
| Suits the objective? | `objective.orbit_fit[orbit.id]` | 0 shows a red "cannot see the target" badge; under 1 shows "partial view". The card stays clickable: choosing badly is allowed and teaches. |
| Select | `setOrbit(design, id)` | Next is enabled once an orbit is chosen. |

### 3. Build

| Element | Source | Behaviour |
| --- | --- | --- |
| Five columns | `PARTS` grouped by `category`: instrument, power, comms, computer, propulsion | Instrument, power, comms and computer are required; show a marker until each has a part. Propulsion is optional. |
| Part card | Data fields: `name`, `blurb`, `mass_kg`, `power_draw_w`, `cost_musd`, `data_gb_day`, `downlink_gb_day`, `battery_wh` | Show only the fields that are not 0. |
| Computed card numbers | `getPartFacts(design, part.id)` | Solar panels: `power_gen_w`. Instruments: `science_per_month`, `resolution_m`; grey the card out with "does not count" when `counts` is false, and "too blurry from this orbit" when `sharp_enough` is false. |
| Toggle a part | `addPart` / `removePart` | Several parts per category are allowed, one of each part. |
| Four bars | `getTotals(design)` | **Mass**: `mass_kg` against `capacity_kg` (shows "pick a rocket" while 0). **Power**: `power_draw_w` against `power_gen_w`. **Budget**: `cost_musd` against `budget_musd`. **Data**: `data_returned_gb_day` against `data_gb_day`; for data a full bar is good. Amber when a margin is under 10%, red when over the limit. |
| Science preview | `previewScience(design)` | "About `total` of `target` over `months` months", plus a small row per instrument. Shown as an estimate, not a promise. |

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
| Event | `s.event` is not null | Stop the timer. Show `event.title`, `event.text` and one button per `event.choices[i].label`. |
| Player's choice | `out = chooseEvent(mission, i)` | Show one outcome line: "A part on board protected you" if `out.protected`; "`PARTS` name FAILED" if `out.failed_part`; "Mission over" if `out.ended_early`. Then resume the timer. |
| End | `s.ended` or `out.ended` | Go to Debrief. |

### 7. Debrief

| Element | Source | Behaviour |
| --- | --- | --- |
| Save the result | `r = recordResult(mission)`, once | If `r.unlocked`, show a banner: "Standard unlocked". |
| Score and stars | `d = getDebrief(mission)`: `score`, `stars` | Stars at 50, 70 and 90 points. |
| Score breakdown | `d.breakdown`: science (of 60), budget (of 15), margins (of 15), events (of 10) | Four short rows. |
| Science | `d.science` against `d.science_target` | |
| What limited you | `d.limiting` as the heading, then `d.paragraph` | The heading names one factor: mass, power, budget, data, event, design or none. |
| Try this | `d.suggestion` | One concrete change. This is the most important line on the screen. |
| Real-world cousin | `d.real_mission` | One line. |
| Events log | `d.events`: `title`, `label`, `failed_part` | What happened and what the player chose. |
| Buttons | | **Redesign**: back to Build with the same `design`. **New mission**: Briefing with a fresh `newDesign(tier)`. **Change tier**: tier select. |

The same design always replays the same mission (the seed comes from the design), so the player can see exactly what their change did.

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

Yareem holds all three back-end roles. The first build is done: real data, all eight formulas, the seeded simulation, scoring and the debrief, checked by `tests/simulate.js`. These are next, in order within each role. Anything marked *stretch* starts only after the first full playthrough works on screen.

**Data**

Balancing will change most numbers, so the current estimates stand until then. No more sourcing work before balancing.

1. ~~Decide the debrief `design` key and radar resolution~~ Done: `design` key added; radar keeps skipping the resolution check.
2. *Stretch:* propose the data fields for per-tier weights and part variance (see `STRETCH.md`). The data person approves any new field before code uses it.
3. *After balancing, before submission:* one quick pass over the numbers that survived. Spot-check three by hand, mark them Checked in `SOURCES.md`, and label the rest as estimates or game values on the project page.

**Rules (`js/game.js`)**

1. ~~Hand-worked tests for the eight formulas~~ Done (`tests/formulas.js` on the working branch).
2. ~~Science preview for the Build screen~~ Done: `previewScience` and `getPartFacts`.
3. *Stretch:* apply per-tier weights to each calculation once the fields are approved.
4. *Stretch:* seeded per-part variance, so the same part performs slightly differently from mission to mission.

**Simulation (`js/mission.js`)**

1. ~~Tune wildfire~~ Done: a single thermal imager earns 2 stars; 3 stars needs thermal plus camera and a fast radio.
2. ~~Weight events by orbit~~ Done: `orbit_weight` on events.
3. ~~Unlock tiers and save progress~~ Done: `recordResult`, `getProgress`, `isTierUnlocked`.
4. *Stretch:* shareable design codes, which encode the design so a link replays the same mission.
5. *Stretch:* the money-making sub-missions for the Impossible mode in `STRETCH.md`.

**Integration with Design screens**

The back end on `main` supplies everything the section "Player interaction, screen by screen" asks for. Design screens builds against it; any missing number or behaviour goes to Rules or Simulation as a GitHub issue, never as maths in the front end.

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

### Getting started on GitHub

1. The data person creates the repo with `SPEC.md`, `CLAUDE.md`, the folder layout, stub `game.js` and `mission.js`, and placeholder data, then turns on GitHub Pages.
2. The data person adds everyone as a collaborator and adds a `CODEOWNERS` file that maps each path to its owner.
3. Each owner clones the repo, makes a branch, and opens a first PR within the first hour, even if it only replaces one stub.
4. Conflicts should be rare because every file has one owner. The one shared spot is the list of script tags in `index.html`, which the Design screens owner edits on request.

Two technical rules for every AI:

- **No `import` and no `fetch`.** Browsers block both when a page is opened straight from a file. Each data file defines one global, such as `const PARTS = [...]`, loaded with a plain script tag.
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
7. **Sunday 17:00, demo recorded.** The video and project page are drafted from the frozen build.
8. **Sunday 20:00, submit.** That leaves four hours of buffer before the deadline.

## Out of scope

We are not building any of these, even if an AI offers to:

- Online or networked multiplayer
- 3D graphics or animated launches
- Real orbital mechanics or trajectory maths
- Accounts, logins or a server
- More than one destination. Mars and the Moon wait until the Earth mission is finished.

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

**Open question:** does Space Apps 2026 require teams to disclose AI use, and in what form? QA confirms this on the official site at kickoff.
