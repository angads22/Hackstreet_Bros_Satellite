# Changelog

What each version of the game holds, newest first. `SPEC.md` ("Versions and changelog") has the rules: every merge to `main` that changes what a player sees, or what a back-end function returns, adds a line under "Unreleased".

## Unreleased

- **Higher levels give less help before a problem.** Normal drops the hover preview's "Fixes" and "Causes" lines and the FIX links; Hard also drops the science forecast and the pay forecast (the contract's terms stay) and shows event risks as bands. Facts, blockers and the debrief's TRY THIS stay on every level. The Part 2 picker says what each level removes.
- **Fewer words.** Events are a short title, one line and one-to-three-word choices; the debrief, hints, briefings, launch checks and client reasons say the same in about half the words.
- **Clearer Build.** A part that adds nothing to the job gets a WHY box (what the job wants against what the part is); Part 2 shows PROFIT (green or red) on Build and first on the debrief; selecting a part shows one line of what it does with its animation; a body leads with what it CARRIES and says what it WEIGHS.
### Added

- **STORY SO FAR, a journal.** A JOURNAL button on the base map, in the Part 2 workshop and on a home card (once something in that part is unlocked) opens a short list of what you have learned: Part 1's 1957 setup, the notebook's three rules as the steps are reached, the discovery, Voss and the box; Part 2's lenders, Mum's house, Iron Eclipse, the offer and what you answered (SELL or REFUSE), and Austin's last page. Each entry has a face and one or two short lines; what you have not found yet is a dim "???". Part 2 adds the debt and the months left from the back end, and what to do next in a few words. BACK or Esc return to where you were. It only reads (nothing is saved by opening it), and a comeback saved by 0.9 shows what it has already passed without replaying a scene.

## 1.0 (November 15, 2026)

The submission build. Two game modes with a dramatic story, a choice and seven endings; runs short enough to replay; every screen animated; an animated explainer for each of the 41 parts; a rustic 1958 look for Part 1 against a modern Part 2; a longer launch. Players who already have progress keep all of it.

### Added

- **A dramatic story.** Part 1 opens in October 1957: a workshop listens to Sputnik beep over the radio and there is one launch window. Austin's notebook gives the rules (power, data, orbit), the third step's launch is the discovery (the counter went silent because the radiation was too strong), and the epilogue closes the box that Ajay opens. In Part 2 Ajay's motives are revealed as the run goes on: the lenders and the workshop, his mum's house, Iron Eclipse, and Austin's last notebook page.
- **A choice and seven endings.** After the second flight, Iron Eclipse offers to clear the debt for the workshop, the patents and Austin's notebook: SELL or REFUSE. The seven endings (THE BOX, HIS NAME RESTORED, BACK IN BUSINESS, BY A HAIR, SOLD OUT, THE KEYS ARE TAKEN, NOTHING LEFT TO LAUNCH) are counted on the home page and on each ending screen ("ENDINGS n / 7"), and each offers PLAY AGAIN at once.
- **Short, replayable runs.** A sensible player wins in about 2 flights on Easy, 3 on Normal and 4 on Hard. Every new comeback has its own seed, so the contracts, clients and reasons differ each run.
- **Existing players keep their saves.** A comeback saved by 0.9 is upgraded in place (cash, debt, months, contracts and flights unchanged); the stars and the Part 1 steps are untouched; a save from a newer game or a corrupt one is ignored and never deleted. Tested against real saves written by 0.9. The page's scripts and styles carry the version, so a returning player's browser never mixes old and new files.
- **A rustic look for Part 1.** Typewriter and stencil type, kraft, rust and olive colours, paper-tape panels, stamp tags and grain, with a faded warm palette on the 3D art. Part 2 stays clean and modern.
- **Animated text.** Story lines type in word by word (with a typewriter cursor in Part 1); screens enter in a stagger; stars land one by one and a PAID or PASSED stamp slams in; changed numbers flash and bars grow. All of it is off under reduced motion, the text is always in the page, and nothing replays on a click.
- **An animated explainer for every part.** Hover, focus or tap any of the 41 parts on Build: a short looping drawing of what it does, a hook line, what it does for your mission, and its catch.
- **A longer launch that ends in orbit.** About fifteen seconds: a 5-to-0 countdown with a status line, ignition, a climb with the camera following and a spent stage falling away, then your own satellite (the one you built) is deployed and flies its orbit round the Earth, with IN ORBIT and the orbit's name. The small Earth on the mission screen keeps the same satellite orbiting for the whole flight, faster in fast-forward and still when paused. SKIP stays on screen and any key skips it.
- **The debrief is a result moment.** A win (3 stars, a Part 1 step passed, a contract PAID) lands its stars one by one, shows the discovery open, and points to what is next; under 3 stars it says what the next star needs; REDESIGN opens the screen where the fix belongs.

### Changed

- **RESET EVERYTHING** (was RESET PROGRESS) clears the stars, Part 1 and a comeback in progress, and says so first.
- **Advice you can follow.** TRY THIS only suggests parts, rockets and orbits the design can use. The scintillation counter's card shows the science it will really deliver. The debrief and chronicle read cleanly ("Goal met, then lost after 34 months", "under 1%", capitals kept on names).
- **The readiness review** says READY or HOLD, and a flight that ends the run says "That was the last flight: see how it ends." Icons share one spacing rule and the Rocket Yard has its own icon (Codex's polish pass).
- The docs say SI, not AI (the submission form's field is Use of Super Intelligence).

### Fixed

- A flight lost early gave its launch money back more than once while it was being recorded.

### Not in this version yet

- The laptop and desktop layout pass (Build, the Readiness review, the map, the Mission and Debrief screens laid out for 1366x768) is built and saved but not merged: it arrives after 4 pm.
- **Launch failures** are planned and not built.
- **Suppliers, countries and travel costs** are a proposal in `SPEC.md`, not agreed.

## 0.9 beta (November 15, 2026)

Two game modes and the whole game in low-poly 3D. Part 1 is Austin's guided 1958 walkthrough; Part 2 is Ajay's comeback, a race to pay back a debt by flying satellites for paying customers. The home page is a console-style title screen, every screen is drawn in faceted low poly, and the bugs a full playtest sweep confirmed are fixed.

### Added

- **A console-style home page.** The low-poly Earth and a satellite fill the first screen behind a drawn GRAVITRON logo; the two modes are a two-item menu, each showing its state (Part 1's step stars, Part 2's CONTINUE). Without the 3D art it falls back to a pixel sky.
- **Part 1, Austin's first satellite (1958).** Three short steps with story beats, stars and an epilogue that leads into Part 2. Tiny power and data values now read in watts and kB a day.
- **Part 2, Ajay's comeback.** Austin's grandson owes the lenders for a company that never flew. Pick Easy, Normal or Hard (the three tiers set the cash, the debt and the deadline), then run the workshop: a debt meter, the cash, and the months left counting down; three contracts on a job board, each from a client with a reason, a price, a 3-star bonus, a minimum of data and sometimes an orbit; PAY BACK in a few safe amounts, or PAY ALL once the cash covers the debt. FLY THIS opens the usual screens with the topic (and the orbit, when the client names one) set by the contract; Build shows what the contract pays and what the flight costs with the cheapest rocket; the Readiness review warns in large type when a flight would land after the deadline. The debrief tells the money story so it adds up (cash before, launch, what the client paid and why, the bonus, event costs, cash now; debt before, interest, debt now) with a PAID stamp and the months left. A win (debt paid) or a loss (out of time, out of cash) ends on a short chronicle with TRY AGAIN. Ajay's story is rewritten for it. `js/ui-comeback.js`; `newComeback`, `getComeback`, `newComebackDesign`, `payDebt`, `getComebackEnding`.
- **The rest of the low-poly art is in the game.** The satellite on the Build bench is a 3D model of the parts on board (it turns slowly, a part you add flies in and a part you remove slides out, and a design with no body sits on an assembly cradle); the speakers are faceted busts; the Readiness review shows your rocket on the pad, and LAUNCH shows its lift-off for a moment (a click or a key skips it); the mission screen shows Earth with your orbit; the base map and the minimap are a low-poly space centre. With reduced motion nothing moves and there is no lift-off; if the 3D art cannot load, the pixel art is used.
- **Eleven new events,** so every topic has its own stories, and some are chances rather than dangers.
- **Every satellite needs a body and an attitude part** (the switch-over, `NEW_CATEGORIES_REQUIRED`, is on).

### Changed

- **Only two modes on the home page.** The era grid, the three levels as a separate choice, the 1957 campaign and its lab leave the page (their code stays). The three levels live on as Part 2's Easy, Normal and Hard.
- **Build:** the IF YOU CLICK preview shows its Fixes and Causes lines and can be scrolled; on a phone the parts sit right under the bins, a bin tap brings them into view and the first tap says TAP AGAIN TO ADD; Build opens on the first empty bin and FIX opens the bin it names.
- **Readiness review:** the science forecast against the target is shown before LAUNCH, and LAUNCH comes before the warnings when nothing blocks.
- **Advice you can follow:** TRY THIS only suggests parts, rockets and orbits the design can actually use (its era, its body's room, rockets that reach the orbit, the contract's orbit).
- **Events** show what each choice costs, and no choice is styled as the answer.
- **Fewer words:** the base map says its instruction once; the bins say "1 / 1 slot".
- **A better opening:** Explorer-sized mercury batteries last about 50 days, as Explorer 1's did.

### Fixed

- A battery-only satellite now flies until its battery is spent instead of ending at the first event.
- A flight lost to a reload or a closed tab gives its launch money back.
- A save code is checked field by field before it is accepted.
- The mission log and the debrief agree with the verdict; the pause button's name follows RESUME; fast-forward looks pressed when on; the limiting-factor icon fits the cause.
- The battery-only POWER bar is amber with how long the battery lasts; small values no longer read 0; the MASS bar says why there is no limit.

### Not in this version yet

- **Launch failures** are planned and not built.
- **Suppliers, countries and travel costs** are a proposal in `SPEC.md`, not agreed.
- The calibration event's 80% science is a game value still to agree with the Simulation owner.

## 0.8 beta (November 15, 2026)

The home page opens on low-poly art: a faceted Earth with a satellite above it, drawn by the game's own small renderer. The home page and the design screens use fewer words and more flat icons, and the Readiness review assembles the satellite part by part.

### Added

- **A low-poly home page.** The title screen opens on a faceted low-poly Earth with a satellite above it, drawn by the game's own small renderer (`js/lowpoly.js`, `js/lp-earth.js`). If the art cannot load or draw, the page works without it.
- **More screen icons and an assembly preview.** Place headers, the map legend, minimap, part statistics and debrief use the shared flat icons. The Readiness satellite assembles part by part; reduced-motion settings show it immediately.
- **Flat icons beside the words.** The parts bins, the four resource bars (mass, power, budget, data) and the problem lists now carry a simple one-colour icon; a blocker shows a cross, a warning a triangle. The words stay next to every icon.

### Changed

- **A simpler home page.** Locked eras are one short card that says LOCKED, locked levels say LOCKED instead of repeating "Earn 2 stars on..." (the rule is the one hint at the top and each card's spoken name), the stars line, the subtitle and the "Choose an era and a level" heading are gone, the campaign buttons show only the treasury, and Reset progress is a quiet link. The visible words on the title fell from 167 to 97.

### Not in this version yet

- **The rest of the low-poly art** (part models, rockets, people, base map, and the satellite on the Build bench) is built but not in the game yet.
- **Launch failures** are planned and not built.
- **Suppliers, countries and travel costs** are a proposal in `SPEC.md`, not agreed.
- The calibration event's 80% science is a game value still to agree with the Simulation owner.

## 0.7 beta (November 15, 2026)

The game is GRAVITRON now: Austin's tutorial and Ajay's chapters tell one story across the levels, and the Build bench draws the satellite from the parts on board. Science points became a second currency, spent in the lab on research and upgrades, and the archive keeps old data paying. The ionosphere arrives as a topic from Canada's Alouette 1 data, each mission type now has a data cap with rewards for new data only, and the design screens use far fewer words.

### Added

- **The Gravitron story.** The game is now GRAVITRON: The Gravitronical Odyssey. The first level is the tutorial, told by Austin Albert (a NASA engineer in the first satellite programme); every later level is told by his grandson Ajay, who runs a small aerospace business on loans and a conditional contract and wants to restore his grandfather's name. Each chapter opens with a few short beats, one at a time (NEXT or SKIP), then one short spoken line on each screen from your team, your partner, the customer or Austin's notebook, and a closing line that depends on the result. The map, briefing, orbit, build, launch, mission and debrief screens all use it. A new event, "Instrument calibration problem" (pause and recalibrate: one month; continue: 80% science), gets a notebook reply in Ajay's chapter. The 80% is a GAME VALUE to agree with the Simulation owner.
- **A drawing for each part on the satellite.** The Build bench draws the satellite from what is on board (body, instruments, solar panels, antennas, thrusters, attitude control) and shows the part you just added dropping in, with its name. The Readiness review shows the same satellite, small.
- **The lab: research adds, upgrades replace.** Science returned is now a currency (`science_pts`). Research costs money *and* science. Six real successor parts can be bought as upgrades, each replacing its predecessor for the rest of the campaign: Explorer 4's scintillation counter (shrugs off the swamped-counter event), OSO 1's X-ray spectrometer, radiation-hard n-on-p solar cells (after Starfish Prime, 1962), Nimbus 1's camera system, PCM digital telemetry and Alouette 2's sounder. `getLab()`, `buyUpgrade(id)`.
- **The archive.** Each campaign year, 10% of all the science banked comes back as science points: old data keeps paying.
- **A Canadian topic: the ionosphere from above,** driven by the CSA's 699,369 digitised Alouette 1 soundings. A low orbit reaches only the stations that heard 42% of them; Alouette flew polar to reach Resolute Bay and College, Alaska. New research "Topside sounding (Alouette)", 1962.
- **The lab screen.** Reached from the Campaign hub, with two tabs. Research (adds): the tree, where each box now costs money and science points ("$2M · 5 science") and says how much science is missing. Upgrades (replace): each upgrade is drawn as the part you have next to its real successor (Explorer 1's Geiger counter to Explorer 4's scintillation counter, and five more), with what gets better and worse in green and red, and a Buy button. The old part then reads "replaced" in the lab and "Replaced by ..." on the Build screen.
- **Science on screen.** The hub and the lab show the science balance next to the treasury, the hub shows the archive's "+N science a year", and the debrief shows the science points a flight earned.
- **The ionosphere topic on screen.** Alouette 1 (1962): the orbit cards show the share of its soundings in view, each month of the mission shows how many soundings Alouette heard, and the debrief compares the flight with the real record and ground stations.

### Changed

- **The core loop: each mission type has a data cap, and rewards are for new data only.** A flight that brings back nothing new earns no money and no science points, and the debrief says to try another type. The hub's topics carry `data_collected`, `data_cap` and `complete`; `previewPayout` and the debrief carry `new_data`.
- **Far fewer words on the design screens** (the team lead's "too many words"). Visible words fell about 40% overall: the briefing 73%, the rocket yard 57%, the debrief 52%, Build 46%. Cards now show a name and the numbers; what a job, an era or a part is about waits behind "About this job" or in the hover preview; each check shows a short label ("TOO HEAVY") with the full sentence behind "Why"; the debrief folds the four segments and the real missions into one line each; the map's controls are key caps; the one-line hint shows only the first time a screen is visited, and the "?" button brings it back.
- **Polar orbits before 1995 need no disposal fuel,** as in history (Alouette 1 and Nimbus 1 reached them on a Thor-Agena); the debris rule dates from 1995.
- **Less hand-holding.** On Trade Space and Point Design, research shows a hint instead of the exact lesson to earn.
- **Saves:** campaign save version 3; older campaign saves start over.

### Not in this version yet

- Structure and attitude are still optional (`NEW_CATEGORIES_REQUIRED` is off in `js/game.js`).
- **Launch failures** are planned and not built.
- **Low-poly 3D art.** The engine and the models (satellite parts, rockets, Earth, people, base map) are built but not in the game yet.
- **Suppliers, countries and travel costs** are a proposal in `SPEC.md`, not agreed.
- The calibration event's 80% science is a game value still to agree with the Simulation owner.

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
