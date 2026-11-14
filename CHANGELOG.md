# Changelog

What each version of the game holds, newest first. `SPEC.md` ("Versions and changelog") has the rules: every merge to `main` that changes what a player sees, or what a back-end function returns, adds a line under "Unreleased".

## Unreleased

### Added

- **The lab: research adds, upgrades replace.** Science returned is now a currency (`science_pts`). Research costs money *and* science. Six real successor parts can be bought as upgrades, each replacing its predecessor for the rest of the campaign: Explorer 4's scintillation counter (shrugs off the swamped-counter event), OSO 1's X-ray spectrometer, radiation-hard n-on-p solar cells (after Starfish Prime, 1962), Nimbus 1's camera system, PCM digital telemetry and Alouette 2's sounder. `getLab()`, `buyUpgrade(id)`.
- **The archive.** Each campaign year, 10% of all the science banked comes back as science points: old data keeps paying.
- **A Canadian topic: the ionosphere from above,** driven by the CSA's 699,369 digitised Alouette 1 soundings. A low orbit reaches only the stations that heard 42% of them; Alouette flew polar to reach Resolute Bay and College, Alaska. New research "Topside sounding (Alouette)", 1962.

### Changed

- **Polar orbits before 1995 need no disposal fuel,** as in history (Alouette 1 and Nimbus 1 reached them on a Thor-Agena); the debris rule dates from 1995.
- **Less hand-holding.** On Trade Space and Point Design, research shows a hint instead of the exact lesson to earn.
- **Saves:** campaign save version 3; older campaign saves start over.

## 0.6 beta (November 14, 2026)

The campaign can be played from the title screen, and a standalone mission can be set in any of four eras. The satellite now has a body and a way of pointing, and the debrief names the discipline that limited the mission. The Gravitron story, part-by-part satellite art and launch failures are not built yet.

### Added

- **Live open data.** When the internet is there, the game calls NOAA's sunspot record, NASA EONET and Canada's CWFIS fire hotspots (`js/live-data.js`), and the debrief adds a "right now" line (`real_world.now`). `getLiveData()` gives the LIVE DATA / SNAPSHOT status for a badge. Offline, everything plays from the snapshot as before. The built-in sunspot table now runs 1957-2025, so the 1999 and 2026 eras fly under the real Sun.
- **LIVE DATA / SNAPSHOT badge.** The header says which data the game is using: LIVE DATA when all the live calls worked, PARTLY LIVE when some did, SNAPSHOT when none did (hover for the sources and when they were fetched). When live data arrives, the debrief adds a "RIGHT NOW" line under the comparison with the real Earth.
- **Time as a resource.** Every part has a build time, and a satellite's development time (the longest part plus integration) comes back from `getTotals` as `dev_months`. In a campaign, long builds cost years on the calendar, and a satellite that could not be ready before the programme ends is blocked.
- **Structure and attitude control** as part categories: an Explorer-style cylinder, a TIROS-style drum and a modern smallsat bus; spin stabilisation and reaction wheels. A spinning satellite smears cameras, thermal imagers and radar (60% of their science), so the debrief can now say "Attitude control limited this mission". A new 1964 research node, three-axis control (Nimbus 1), unlocks reaction wheels.
- **`getCategories()`** returns the Build screen's part bins in order, with display names and which are required.
- **Debrief:** `limiting_name` (the NASA Mission Design Lab discipline) and `segments` (one line each for the launch, space, ground and user segments).
- **Tier names** from JPL's Concept Maturity Levels: Initial Feasibility, Trade Space, Point Design.
- **Eras for standalone play** (back end; the screen is the era grid on tier select, below): 1958 International Geophysical Year, 1964 Nimbus, 1999 Earth Observing System, 2026 New Space. A mission set in an era offers only the parts, rockets and topics that existed by then; two stars in an era opens the next. `getEras()`, `setEra(design, eraId)`, `getAvailability(design)`; `recordResult` returns `era_unlocked`. The solar topic uses the real sunspot count for the era's year.
- **Satellite bodies** with a payload limit and slots per part type: Explorer-style cylinder, TIROS-style drum, Nimbus-class bus, modern smallsat bus, 12U CubeSat frame. Readiness checks for too heavy, too many parts of a kind, and more than one body. `getTotals` returns `body`.
- **`getResearchTree()`**: nodes and edges for a research-tree screen.
- **Build screen.** Seven parts bins, in the back end's order: the satellite's body (structure) and how it points (attitude) join the five that were there. With a body fitted, each bin shows how many of its slots are used ("2 / 3 slots"), and a body card shows the payload carried against what the body can hold. The two new bins stay optional until the switch-over.
- **Tier select: eras.** A grid with the four eras across (1958, 1964, 1999, 2026) and the three levels down. The first era is open; two stars in an era opens the next. A mission is set in its era: topics, parts and rockets that did not exist yet are greyed out with when they arrive ("Arrives in 1964"), the header shows the year, and the debrief announces a newly opened era.
- **Campaign.** The campaign can now be played. The title screen starts or continues one; the Campaign hub shows the year, the treasury, how much is known about each topic and what its next mission would pay, the lessons shown in flight, the missions flown, and save codes to export and import. In a campaign the Briefing lists only open topics with their payout, Build and Launch vehicle show the expected payout against the cost, locked parts say which research they need, and the debrief shows the payout, the knowledge gained, new lessons and the way back to the hub.
- **Research tree.** The hub draws the research tree: boxes in columns by depth joined by their prerequisites, filled when owned and bright when they can be bought. Picking a box shows what it unlocks and what it still needs, with a Buy button. The drawing is a separate, reusable piece (`js/ui-tree.js`) that only needs nodes and edges.

### Changed

- **Wording.** The Mission screen and the orbit cards say "fire detections", not "fires": a satellite detection is one hot pixel on one pass, not one fire.
- **Debrief.** The heading names the NASA Mission Design Lab discipline that limited the mission ("Communications limited this mission"), and four short lines sum up the launch, space, ground and user segments.
- **Readiness review.** Shows how many months the satellite takes to build.

### Fixed

- **Base map.** The GO TO button now follows the gold route in both directions, so it never points past a NO GO that is fixed at an earlier place.
- **Base map.** Holding an arrow key no longer scrolls the page at a dead end or carries the arrow one road too far.
- **Phones held sideways.** The header no longer sticks to the top and covers the map.
- **Build.** Part prices no longer spill out of their cards when the web fonts fail to load.
- **Orbit.** The NASA line now reads "In view: 92% of the world's fire detections", so it no longer seems to contradict the "partial view" badge, which is about how often the orbit looks.

### Not in this version yet

- Structure and attitude are still optional. The Build screen now has their two bins, but turning on `NEW_CATEGORIES_REQUIRED` in `js/game.js` makes the tests that load the game without the option fail (their sample satellites have no body), so the switch waits for `tests/load.js` to set the flag from its option.
- **Story, art and risk.** The Gravitron story, a drawing for each part on the satellite, fewer words per screen and launch failures are planned and not built.

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
