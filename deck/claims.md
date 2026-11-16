# GRAVITRON deck (version 2.1): claims, sources and what a person must still do

The deck is `deck/GRAVITRON.pptx` (7 slides, 16:9, English) with `deck/GRAVITRON-static.pdf` as its static export. It was rebuilt in place for version 2.1 on November 16, 2026: same master, layout, colours and fonts; every picture is a fresh screenshot of the 2.1 game in `deck/img/`. Every number below was recounted or rerun on the 2.1 build (`tests/load.js` for counts, `node tests/<name>.js` for tests).

To rebuild: `REPO=<repo> node deck/tools/capture.js <shots dir>` (run from outside the repo; needs `handoff/browser-tests/lib.js`), `python3 deck/tools/crops.py <shots dir> deck/img`, `python3 deck/tools/build_deck.py deck`, `deck/tools/export.sh deck <scratch dir>`.

## The rules, checked

| Rule (SPEC.md, "How we are judged" and "Checkpoints") | State |
| --- | --- |
| At most 7 slides, title included | 7 |
| In English | Yes |
| Challenge named | Slide 1: Space Mission Design Game |
| Team name and member names | Slide 1: team name (**check it**). Slide 7: two names; **the others are missing, a person must add them** |
| An image of the project, the user experience | Slides 1 and 3 to 6 (2.1 screenshots) |
| How NASA and space-agency open data make it possible | Slide 5; credits point to `SOURCES.md` |
| Use of SI disclosed | Slide 7 points to `SI_USE.md`; the form field is "Use of Super Intelligence (SI)" |
| Nothing overclaims | "Fire detections", never "fires"; money is labelled a game value; online is "built, not hosted yet", scores "self-reported"; no "live NASA data"; no balance figure |
| Public link, no login | **A person must host the deck** (Google Drive, GitHub, OneDrive or Dropbox) and test the link in a private window |

## Where a judge finds each criterion

Each slide carries a small footer, "CRITERION" and the name.

| Criterion | Slide | Headline |
| --- | --- | --- |
| Impact | 2 | Anyone with a browser can design a mission |
| Presentation | 3, 7 | One loop: design, fly, read why |
| Validity | 4, 7 | Every part costs mass, power and money |
| Relevance | 5 | NASA and Canadian data drive the flight |
| Creativity | 6 | Three ways to play, one story |

## Claims

| Slide | Claim on the slide | Proof in the repo |
| --- | --- | --- |
| 1 | NASA Space Apps 2026; challenge: Space Mission Design Game | `SPEC.md` line 7 |
| 1 | "Design a satellite. Launch it. Learn why." | The home page (`deck/img/home.png`) |
| 1 | Plain HTML, CSS and JavaScript; no install; plays offline | The project rules file at the repo root; `index.html`; `data/earth.js` snapshot |
| 1 | Team: Hackstreet Bros | Taken from the repository name. **Not confirmed: check against the team page** |
| 1 | Picture: three mode cards (Part 1, Part 2, Quick mode) | `CHANGELOG.md` Unreleased, "Quick mode"; `deck/img/home.png` |
| 2 | Every part fixes one problem and creates the next | `SPEC.md`, Build section |
| 2 | Build a satellite, fly it, read why it worked or failed | The loop on slide 3 |
| 2 | Runs in any browser, offline, on real NASA and Canadian data | `SPEC.md` line 28 (Impact row); `data/earth.js`; `SOURCES.md` (CSA Alouette) |
| 3 | Seven stops: Mission Control, Tracking Station, Workshop, Rocket Yard, Launch Pad, Mission, Debrief | `SPEC.md`, base map; `deck/img/map.png` |
| 3 | A gold route points to the next stop | `SPEC.md`, base map; visible in the picture |
| 4 | 41 parts, 7 rockets, 3 orbits | Recounted from `data/` with `tests/load.js` (parts by bin: structure 5, attitude 2, instrument 12, power 8, comms 6, computer 5, propulsion 3) |
| 4 | Eight real formulas, each with a hand-worked test | `SPEC.md` line 30; `node tests/formulas.js` (16 checks pass) |
| 4 | Build shows the satellite, three gauges and the live bars | `CHANGELOG.md` Unreleased (gauges DATA, COST, TIME); `deck/img/build.png` |
| 4 | The review says GO or NO GO | `deck/img/review.png` (READY, ALL SYSTEMS GO); `SPEC.md` readiness review |
| 5 | Wildfire: NASA FIRMS. Sea ice: NSIDC Sea Ice Index. Sun: SILSO sunspots. Ionosphere: CSA Alouette | `data/earth.js`; `SOURCES.md` rows read "Downloaded and processed" |
| 5 | A low orbit sees 92% of the 3,693,555 fire detections; a polar orbit sees all | `data/earth.js` `wildfire.detections` (3693555) and `wildfire.orbit_view` (leo 0.921, sso 1) |
| 5 | March: 288,836 fire detections (NASA FIRMS 2025) | `deck/img/mission.png` (the line under the science bar); `data/earth.js` `wildfire.detections` x `monthly_share` for March (3693555 x 0.0782) |
| 5 | The debrief: the verdict, then what limited the flight | `CHANGELOG.md` Unreleased, "Debrief leads with the verdict and the money"; `deck/img/debrief.png` (PAID IN PART, then ATTITUDE CONTROL LIMITED THIS MISSION) |
| 4, 5, 6 | Money shown is a game value | `SPEC.md` line 66 |
| 6 | Part 1, 1958: Austin Albert, NASA engineer, three guided steps | `CHANGELOG.md` 0.9 beta, "Part 1"; the home card shows steps 1 to 3 |
| 6 | Part 2: his grandson Ajay flies satellites for paying customers to clear a debt | `CHANGELOG.md` 0.9 beta, "Part 2"; `deck/img/workshop.png` |
| 6 | Quick mode: one flight, a new job each time | `CHANGELOG.md` Unreleased, "Quick mode" |
| 6 | Loans, a credit score from 300 to 850, rockets that can fail | `CHANGELOG.md` Unreleased (credit score) and 2.0 (launch failures); `node tests/credit.js` (56 pass), `node tests/comeback.js` (151 pass) |
| 6 | Easy, Normal, Hard: the harder, the less help | `SPEC.md`, "Difficulty: how much help"; `CHANGELOG.md` 2.0, "Higher levels give less help" |
| 7 | Over 900 automated checks pass | Run on the 2.1 build, all passing: formulas 16, api 143, campaign 61, comeback 151, debrief 35, migration 177, saves 35, clarity 30, info 45, online 126, world 19, credit 56, verdict 16, uib 49, speed 6, version 8: 973 checks in 16 files |
| 7 | No install; plays from a data snapshot | `data/earth.js`; fetch only in `js/live-data.js` |
| 7 | Leaderboard and 1v1 duel are built, not hosted yet; scores are self-reported | `CHANGELOG.md` 2.0 ("Not in this version yet": the online features need a server); `node tests/online.js` (126 pass); `deck/img/quick.png` shows ONLINE OFF |
| 7 | Five lead-time sources still need a human check | `SOURCES.md` lines 37 to 41 (part lead times and the supply chain) are the five rows marked NEEDS HUMAN CHECK |
| 7 | Built with SI tools, recorded in `SI_USE.md` | `SI_USE.md` |
| 7 | Sources: `SOURCES.md` | `SPEC.md` line 1161 (the References list) |
| 7 | Team: Yareem, data and rules. angads22, screens | `SPEC.md`, "Team roles" |

Also recounted, not on a slide: 6 topics, 27 events, 14 real missions, 3 difficulty levels, 15 data files, 7 endings in each part (the home page shows ENDINGS 0 / 7). September 2025 Arctic sea ice: 4.75 million km2, 26% below the 1981 to 2010 average of 6.41 (`data/earth.js`).

## What changed from the 0.9 deck

- Every picture was from 0.9 (two mode cards, no ledger strip, no gauges, a credit bar out of 100, "v0.9 beta"). All nine are now 2.1 screenshots; the three GIFs are gone, so the deck and its PDF show the same thing.
- Stale facts fixed: "two modes" (three), "22 events" (27), "Next: launch failures" (built in 2.0), "when credit runs out" (credit is a 300 to 850 score), test counts, "v0.9 beta" (no version on a slide; the game's footer is the one place for it).
- Taken off: the balance figure (not re-measured, `CHANGELOG.md` 2.0), the phone pictures and "works on a phone" (a phone layout for Build is not done), the visible `[__]` placeholders, the NO GO picture, the two story-card strips, and the event picture (events are in the notes for slide 5).
- Added: a headline that states the point on every slide, body text at 24pt, a criterion footer, the data set behind each topic, "money is a game value", the online and SI lines.

## For a person to do

- **Slide 1:** confirm the team name.
- **Slide 7:** add the missing member names (story, game experience). If anyone is under 18, show roles only: the event forbids a minor's name, face or voice.
- **Host the deck** at a public link that needs no login and test it in a private window. The project page takes images but not documents.
- **Version:** the screenshots were taken before the footer was bumped; the cover crop leaves the footer out, and the Quick menu picture on slide 7 does not show it.
- **Not verified here:** `tests/balance.js`, `tests/simulate.js` and the browser scripts were not rerun for the deck; the desktop Lighthouse figure in `CHANGELOG.md` 2.0 is not on a slide.
- **Video:** the deck is the demo. A 30-second video is optional and not made; the event recommends the deck when a teammate is under 18.

## Things to know

- Not claimed anywhere: "live NASA data", a live leaderboard or duel, any cash, debt, interest, payout or score as fact, `data/result_master.csv`, unchecked sources.
- The pictures are Part 2 runs on Normal, opened from a file (header badge SNAPSHOT, Quick card ONLINE OFF), at 1440x900 and 2x: a solar contract on slides 3 and 4, a wildfire contract on slide 5 (the topic that runs on NASA FIRMS).
- The mission picture on slide 5 is cropped to the left of the screen so the NASA FIRMS line can be read; the science bar runs on to the right in the game.
- `SI_USE.md` names tools, so the slide only points to it; its content belongs in the form field "Use of Super Intelligence (SI)".
