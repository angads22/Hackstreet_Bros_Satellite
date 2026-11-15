# GRAVITRON deck (PowerPoint, 0.9 beta): claims, sources and placeholders

Built from `origin/main` at **32b41e9** (version 0.9 beta). Nothing was committed or pushed to the repo for the deck. Counts were recounted from `data/` with `tests/load.js` on that commit; tests were run on it.

| Slide | Claim on the slide | Source in the repo |
| --- | --- | --- |
| 1 | NASA Space Apps 2026 challenge: Space Mission Design Game | `SPEC.md` line 7 |
| 1 | "Design a satellite. Launch it. Learn why." | The game's home page (`shots2/01-home.png`) |
| 1 | Plain HTML, CSS and JavaScript; v0.9 beta | `CLAUDE.md` rules; footer in `index.html`; `CHANGELOG.md` 0.9 beta |
| 1 | Team: `[__]` | Placeholder |
| 2 | Spacecraft design is a chain of trade-offs; every part fixes one problem and creates the next | `SPEC.md` line 787 |
| 2 | Teaches mission design to anyone with a browser, on real NASA and Canadian data | `SPEC.md` line 26 (Impact row); `data/earth.js` (CSA Alouette) |
| 2 | The home-page satellite is drawn from the same parts you build with | `CHANGELOG.md` 0.9 beta, "The rest of the low-poly art is in the game" (the Build bench draws a 3D model of the parts on board) |
| 3 | Seven stops: Mission Control, Tracking Station, Workshop, Rocket Yard, Launch Pad, Mission, Debrief | `shots2/03-map.png`; `SPEC.md` progression; `CHANGELOG.md` 0.5 beta |
| 3 | Walk with arrow keys or click; gold route points to the next stop | `CHANGELOG.md` 0.5 beta "Base map"; `gifs/map.gif` |
| 4 | Parts, four live bars (mass, power, budget, data home); each part flies in | `gifs/build.gif`; `CHANGELOG.md` 0.9 beta "Added" (the bench turns, a part flies in) |
| 4 | Readiness review GO, and NO GO with items that link to their fix | `shots2/06-review.png`, `shots2/06-review-nogo.png`; `CHANGELOG.md` 0.5 beta "Readiness review" |
| 5 | Months tick by; an event stops the clock | `gifs/mission.gif` |
| 5 | Events show what each choice costs; no choice is styled as the answer | `CHANGELOG.md` 0.9 beta "Changed" ("Events show what each choice costs, and no choice is styled as the answer") |
| 5 | The debrief scores the flight and says what limited it | `crops2/debrief.png`; `CHANGELOG.md` 0.6 beta "Debrief" |
| 5 | Real data per month: NASA FIRMS, NSIDC, SILSO, CSA Alouette | `CHANGELOG.md` 0.5 beta "Real data"; `SOURCES.md` rows read "Downloaded and processed" |
| 5 | A low orbit sees 92% of the fire detections, polar all, one geostationary slot 69% | `data/earth.js` `orbit_view` (0.921, 1.0, 0.687); `SPEC.md` line 150 |
| 6 | Part 1, 1958: Austin Albert, NASA engineer, three guided steps | `CHANGELOG.md` 0.9 beta "Part 1"; `shots2/02-intro-austin.png` |
| 6 | Part 2: Ajay opens the notebook and tries again, flying satellites for paying customers to clear a debt | `CHANGELOG.md` 0.9 beta "Part 2"; `shots2/12-intro-notebook.png`; `js/ui-design.js` |
| 6 | Workshop: debt meter, cash, months left, three contracts; Easy, Normal, Hard set cash, debt, deadline | `shots2/13-workshop.png`, `shots2/10-levels.png`; `CHANGELOG.md` 0.9 beta |
| 6 | One short line on every screen from team, partner, customer or notebook | `CHANGELOG.md` Unreleased 0.7-0.8 "The Gravitron story"; every screenshot |
| 7 | 15 data files, one global each | `ls data/*.js` on 32b41e9; `CLAUDE.md` |
| 7 | `js/game.js`, `js/mission.js`, `index.html`, `js/ui-*.js`; no framework, no build step | `index.html`; `CLAUDE.md` |
| 7 | Tests: formulas 16, api 121, campaign 61, comeback 75, debrief 23, saves 32, speed 6, version 8, balance 53 (3 known gaps) | Run with `node tests/<name>.js` on 32b41e9; all passed. `simulate.js`, `play.js`, `redteam` not run |
| 7 | NASA FIRMS 2025: 3,693,555 fire detections; CSA Alouette: 699,369 soundings | `data/earth.js` (`detections`, `soundings`) |
| 7 | Offline from a data snapshot; live feeds only online; phone and keyboard | `CLAUDE.md`; `js/live-data.js`; `shots2/20-phone-home.png`, `shots2/21-phone-build.png` |
| 7 | Done: two modes, low-poly 3D, 22 events | `CHANGELOG.md` 0.9 beta; `data/events.js` (22 after recount) |
| 7 | Next: launch failures; human checks of the sources still open | `CHANGELOG.md` 0.9 beta "Not in this version yet"; `SOURCES.md` (most rows "NEEDS HUMAN CHECK") |
| 7 | Team: Yareem (data), angads22 (UI and UX), others `[__]` | `SPEC.md` "Team roles" (Yareem data, rules, simulation; angads22 design screens) plus the speaking roles agreed on Nov 15 |
| 7 | References: SOURCES.md | `SPEC.md` line 36 |

Also recounted, not on a slide: 41 parts (structure 5, attitude 2, instrument 12, power 8, comms 6, computer 5, propulsion 3), 7 rockets, 3 orbits, 6 topics, 4 eras, 3 tiers, 14 real missions, 17 research nodes.

## Placeholders left

- Slide 1: team name `[__]`.
- Slide 7: two story names and one game-experience name `[__]`.
- No demo link or project-page URL appears; none is in the repo.

## Things to know

- Not claimed: launch failures, "live NASA data", any game value (debt, cash, payouts, interest, the "Science x0.9" and "$1M" on the event), `data/result_master.csv`, unchecked sources.
- GIFs play in PowerPoint and Google Slides; PDF exports show one frame each. The mission animation shows the launch, then months, an event and the debrief.
- The Part 1 flight shown is a real run with an Explorer-style body, spin stabilisation, a cosmic-ray counter, silicon solar cells, a mercury battery, a Minitrack beacon and a command timer.
- The game font draws the numeral 5 like an S ("NO GO. S TO FIX").
- Under-18 rule from the event checklist: if any teammate is under 18, show roles only on slide 7 and in the notes, and do not use their voice or face.
- `SI_USE.md` (AI use) names tools, so nothing from it is in the deck; it belongs in the "Use of Super Intelligence (SI)" form field.
- Screenshots were taken offline (header badge SNAPSHOT) at desktop 1440x900 at 2x and phone 390x844 at 2x; `capture2.js`, `nogo.js`, `tools/make_gifs.py`, `tools/crop2.py` and `gen_deck.js` rebuild everything from any repo path.
