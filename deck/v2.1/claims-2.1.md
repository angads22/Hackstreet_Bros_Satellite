# GRAVITRON deck 2.1: claims, sources and open items

Built from `origin/release/v2.1` at abc4acb (the newest game; `main` was at 919fced, 21 files behind it in the game code). Recorded offline, so the header badge reads SNAPSHOT. The release footer still reads v2.0 until the team cuts the version.

| Slide | Claim | Source |
| --- | --- | --- |
| 1 | Problem, solution, why it matters; three modes on the home page | `SPEC.md` (what we are building); real home page recording (clip `home`); `CHANGELOG.md` Unreleased "Quick mode" |
| 2 | 3,693,555 fire detections (2025); 699,369 Alouette soundings | `data/earth.js` (`detections`, `soundings`) |
| 2 | 4.75M km2 Arctic ice, September 2025 | `data/earth.js` (`sea-ice` extent, September); `SPEC.md` "NASA data in the game" |
| 2 | Low orbit 92%, polar 100%, geostationary 69% of fire detections | `data/earth.js` `orbit_view` (0.921, 1.0, 0.687) |
| 2 | Debrief line: 2025 Sun averaged 123 sunspots a month; 4 to 269 yearly, 1957 to 2025 | Real debrief screen (clip `p2-debrief` details); SILSO via `data/earth.js` |
| 2 | Realism: 8 real formulas (rocket equation, orbital period, solar power, eclipse, battery size, image resolution, data budget, margins); parts, rockets and missions follow real ones (Explorer 1, Vanguard, TIROS) | `CHANGELOG.md` 0.5 "Rules"; `SPEC.md` (bodies ladder modelled on real spacecraft); `features.md`; SOURCES.md rows still marked NEEDS HUMAN CHECK |
| 2 | A battery-only satellite goes silent, "like Sputnik 1 after 21 days" | The game's own debrief text (clip `p1-fail-gif`, a real Part 1 flight, no forced dice); `CHANGELOG.md` 0.9 (Explorer-sized batteries) |
| 2 | 27 events, 14 real missions | `CHANGELOG.md` 0.5 "Rules"; recount: `data/events.js` 27, `data/missions.js` 14 |
| 2 | Live feeds only when online | `js/live-data.js`; `SOURCES.md` |
| 3 | Lead time on every part; the long-pole line; paid part facts on Normal and Hard | `CHANGELOG.md` 2.0 ("The long pole", "Lead time for every part", "Paying engineers"); `docs/real-world-plan.md` |
| 3 | Credit score with five factors; a loan adds cash and debt and lowers the score | `CHANGELOG.md` Unreleased ("Credit is a real credit score"); `SPEC.md` "Loans, credit and a name"; `tests/credit.js` (56 pass) |
| 4 | Part added: tile flies, bars flash with a chip, NO GO count; explainer per part; fewer words; phone layout | `CHANGELOG.md` Unreleased and 1.0 (as cited in the notes); `docs/ui-review.md`; recordings `p1-build`, `phone-*` |
| 5 | Part 1 (1958) and Part 2 stories; SELL or REFUSE after two flights; seven endings; story-so-far journal | `CHANGELOG.md` 1.0, 2.0; `SPEC.md` "Two game modes"; `js/ui-story.js`; screens `p1-story`, `p2-workshop` |
| 6 | Rockets can fail; LOW / MEDIUM / HIGH risk on cards; events show cost; the debrief leads with the verdict and money | `CHANGELOG.md` 2.0, Unreleased; `data/launchers.js`; recordings `p1-launch`, `p2-mission`, `p2-debrief` |
| 7 | 984 checks pass across 17 suites | Run on `release/v2.1`: formulas 16, api 143, campaign 61, comeback 151, credit 56, debrief, info 45, migration 177, online 126, saves 35, speed 6, uib 49, verdict 16, version 8, world 19, clarity 30, perf 11 |
| 7 | SI use: SI wrote much of the code, tests and docs from the team's design and story; numbers labelled sourced, ESTIMATE or GAME VALUE; most sources still need a human check | `SI_USE.md`; `SOURCES.md` ("Tools and other resources"); `SPEC.md` ("Submission checklist": the SI field) |
| 4 | The base map: walk the gold route between seven stops | `CHANGELOG.md` 0.5 "Base map"; clip `map-gif` |
| 5 | Iron Eclipse's offer, SELL or REFUSE, and one of seven endings (SOLD OUT) | `CHANGELOG.md` 1.0; `js/ui-story.js`; clip `offer-gif` (a real run: two flights, then the offer; flights played by the test helper, not by hand) |
| 7 | Also in 2.1: music and sound made in the browser; story journal; saves carry over | `CHANGELOG.md` 2.0 (music, journal, saves); `js/audio.js` |
| 7 | Quick mode: one flight, new job each time, offline | `CHANGELOG.md` Unreleased "Quick mode"; clip `quick-gif` |
| 7 | Leaderboard and duel built but not hosted; next steps | `CHANGELOG.md` "Not in this version yet"; `ONLINE.md` |

## Not claimed
Failure chances, event costs, payouts, fees, debt, credit numbers and lead times as real facts (all game values); balance after loans, failures and fees together (not re-measured); `simulate`, `play`, `balance`, `redteam` were not run on 2.1; the engineers' figures (SOURCES.md still says NEEDS HUMAN CHECK).

## Open items for the team
- SI use: the deck describes it without naming the tool or models (the team's house rule). The form field "Use of Super Intelligence (SI)" and `SI_USE.md` must name them.
- QR code on slide 7: copied from the earlier deck; the team says it works.
- Names: team members' names are left off the deck on purpose. The local event tells minors not to use their own name in the submission, and NASA's guide bars images, audio or likeness of anyone under 18; ages are not known here. NASA's deck tips list member names, so add them back on slides 1 and 7 only if everyone is 18 or over. The characters Austin and Ajay are fiction and stay.
- Picture notes: GIFs play in PowerPoint and Google Slides present mode; the PDF shows the last frame of each. 13 GIFs: home, failing flight, engineers' Build, borrow, part-add, map walk, phone, story, offer and ending, launch, mission, debrief result, Quick mode. Nothing used forced dice.
