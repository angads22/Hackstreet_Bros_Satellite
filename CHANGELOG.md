# Changelog

What each version of the game holds, newest first. `SPEC.md` ("Versions and changelog") has the rules: every merge to `main` that changes what a player sees, or what a back-end function returns, adds a line under "Unreleased".

## Unreleased

### Added

- **Time as a resource.** Every part has a build time, and a satellite's development time (the longest part plus integration) comes back from `getTotals` as `dev_months`. In a campaign, long builds cost years on the calendar, and a satellite that could not be ready before the programme ends is blocked.
- **Structure and attitude control** as part categories: an Explorer-style cylinder, a TIROS-style drum and a modern smallsat bus; spin stabilisation and reaction wheels. A spinning satellite smears cameras, thermal imagers and radar (60% of their science), so the debrief can now say "Attitude control limited this mission". A new 1964 research node, three-axis control (Nimbus 1), unlocks reaction wheels.
- **`getCategories()`** returns the Build screen's part bins in order, with display names and which are required.
- **Debrief:** `limiting_name` (the NASA Mission Design Lab discipline) and `segments` (one line each for the launch, space, ground and user segments).
- **Tier names** from JPL's Concept Maturity Levels: Initial Feasibility, Trade Space, Point Design.

### Not in this version yet

- Structure and attitude are optional until the Build screen has their two bins: Design screens turns on `NEW_CATEGORIES_REQUIRED` in `js/game.js` in the same change (`node tests/api.js` already tests the game with it on).

### Fixed

- **Base map.** The GO TO button now follows the gold route in both directions, so it never points past a NO GO that is fixed at an earlier place.
- **Base map.** Holding an arrow key no longer scrolls the page at a dead end or carries the arrow one road too far.
- **Phones held sideways.** The header no longer sticks to the top and covers the map.
- **Build.** Part prices no longer spill out of their cards when the web fonts fail to load.
- **Orbit.** The NASA line now reads "In view: 92% of the world's fires", so it no longer seems to contradict the "partial view" badge, which is about how often the orbit looks.

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
