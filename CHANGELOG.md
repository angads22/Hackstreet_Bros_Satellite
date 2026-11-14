# Changelog

What each version of the game holds, newest first. `SPEC.md` ("Versions and changelog") has the rules: every merge to `main` that changes what a player sees, or what a back-end function returns, adds a line under "Unreleased".

## Unreleased

Nothing yet.

## 0.5 beta (November 14, 2026)

The first playable build. One mission plays from start to finish in a browser: pick a topic, pick an orbit, build the satellite, pick a rocket, pass the readiness review, fly, and read the debrief. The campaign is built in the back end but has no screens yet, so it cannot be played.

### Added

**Playing a mission**

- **Tier select.** Three tiers (Initial Feasibility, Trade Space, Point Design). Two stars on one unlocks the next, and progress is saved in the browser.
- **Base map.** A pixel map of a space centre is the way between screens. Walk with the arrow keys or WASD and press E to go in, or click a place. A gold route and an objective line point to the next place with work left, and a minimap sits in the header inside each place.
- **Briefing, Orbit, Build, Launch vehicle and Readiness review.**
  - Orbit cards show how well each orbit sees the target, with the share of real fires in view for wildfire.
  - Build has parts bins, a satellite drawing that fills in as systems are added, four resource bars, a live problem list, a science preview, and a preview of what a part would change before you click it.
  - The Readiness review lists every NO GO and warning with a link to the screen that fixes it.
- **Mission.** Runs month by month with pause and fast-forward. Each month shows the real Earth that month (NASA FIRMS fires or NSIDC sea ice). Events stop the clock, and each choice shows its odds.
- **Debrief.** A five-part score and stars, the one thing that limited the mission, one change to try, the comparison with NASA's real data, and the closest real mission to your design. Redesign returns to Build with the same design.
- **Hints.** A short tutorial line and a tip on each screen, following the tier's hint setting.
- **Look.** A 1960s space-race colour scheme and pixel art. Works from phone to desktop, with keyboard and touch.

**Under the screens**

- **Rules.** Eight real formulas (rocket equation, orbital period, solar power, eclipse, battery size, image resolution, data budget, margins) and the readiness checks.
- **Simulation.** The same design always flies the same mission. Scoring is out of 100 with a science target needed for three stars.
- **Content.** 27 parts, 7 rockets, 3 orbits, 5 topics, 10 events and 13 real missions to compare against.
- **Real data.** NASA FIRMS active fires (2025) and the NSIDC Sea Ice Index drive the wildfire and sea-ice missions month by month. SILSO sunspot numbers drive the solar topic.
- **Campaign back end.** Treasury, knowledge per topic, a research tree and save codes exist as functions and pass their tests.
- **Tests.** Formula, simulation, campaign, balance, function-contract and speed tests, plus a red-team sweep, all run with Node.

### Not in this version yet

- **Campaign screens.** No hub, no research screen and no campaign versions of the Briefing and Debrief, so the campaign cannot be played from the browser.
- **Eras.** A single mission offers every part, rocket and topic at once, so 1957 hardware sits beside modern hardware.
- **Hint text.** The hints are a first draft for Story to rewrite.
- **Save codes on screen.** Export and import exist in the back end only.
- **Sources.** The two web fonts are not yet listed in `SOURCES.md`, and most numbers there are not yet marked as checked.
- **Submission pieces.** The demo and the project page.
