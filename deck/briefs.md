# GRAVITRON pitch: who says what

Slide numbers follow the PowerPoint deck built on main at 32b41e9 (version 0.9 beta): 1 Cover, 2 Why GRAVITRON, 3 One loop, 4 Design the spacecraft, 5 Fly it, 6 Two parts one story, 7 The code and the proof. Every fact below is from the repo (file named) and the recount on that commit. Pitch shape from the event slides: **the problem, the solution, why it is important.** Keep to 30 seconds of video or 7 slides.

## Opening line (whoever opens)

- **Problem:** Spacecraft design is a chain of trade-offs, but most people only meet it as a finished rocket. Every part fixes one problem and creates the next (`SPEC.md` line 787).
- **Solution:** GRAVITRON, a browser game where you pick a job for a satellite, build it, pass a readiness review, fly it month by month and read why it worked or failed.
- **Why it matters:** It teaches mission design to anyone with a browser, using real NASA and Canadian data (`SPEC.md` line 26).

## 1. Data: Yareem (slide 5 and the real-science half of slide 7)

Say:
- The sim runs on real data: NASA FIRMS 2025 fire detections (3,693,555 of them), the NSIDC Sea Ice Index, SILSO sunspot numbers, and Canada's Alouette soundings (699,369) from the CSA. Canadian data is encouraged by the event, and we use it. Source: `data/earth.js`, `SOURCES.md`.
- Orbit choice has a real cost in the data: a low orbit sees 92% of the fire detections, a polar orbit all, one geostationary slot 69% (`data/earth.js`, `orbit_view`).
- 41 parts in 7 bins, 7 rockets, 3 orbits, 6 topics, 22 events, 14 real missions to compare against (`data/`, recounted on 0.9 beta).
- Eight real formulas, each with a hand-worked test; tests on main: formulas 16, api 121, campaign 61, comeback 75, debrief 23, saves 32, speed 6, version 8, balance 53 (3 known gaps).
- Be honest: only FIRMS, NSIDC, SILSO and Alouette are marked downloaded and processed in `SOURCES.md`. Live feeds (NOAA, NASA EONET, CWFIS) work only when online; otherwise it plays from a snapshot.

Do not say: "live NASA data", anything about `data/result_master.csv`, any game value (payouts, odds) as fact.

## 2. UI and UX: you (slides 3 and 4)

Say:
- One loop, seven stops: Mission Control (briefing), Tracking Station (orbit), Workshop (build), Rocket Yard (rocket), Launch Pad (readiness review), Mission, Debrief. A low-poly base map is the way between them, with a gold route to the next stop. The home page is a console-style menu with two modes.
- Build screen: parts bins, the satellite drawn from what is on board, four live bars (mass, power, budget, data home), a problem list and a science preview.
- Orbit cards say whether each orbit can see the target. The readiness review shows GO or NO GO with a link to the screen that fixes each item.
- We cut the words on the design screens by about 40% after the team said "too many words" (`CHANGELOG.md`, Unreleased, "Changed"). Detail waits behind "About this job" or a hover.
- Works with keyboard and touch, from a phone to a desktop; no framework, no build step.

## 3. Story, part one: [__] (slide 6, Austin)

Say:
- The game is GRAVITRON: The Gravitronical Odyssey. Part 1 is Austin Albert, a NASA engineer who leads the first satellite project. His chapter is the tutorial, set in the 1958 International Geophysical Year.
- Each chapter opens with a few short beats (NEXT or SKIP), then one short line on every screen from your team, your partner, the customer or the notebook, and a closing line that depends on the result (`CHANGELOG.md`, Unreleased, "The Gravitron story").
- Why story: it explains why each step matters before the player has to decide.

## 4. Story, part two: [__] (slide 6, Ajay)

Say:
- Part 2: decades later his grandson Ajay owes the lenders for a company that never flew. He opens Austin's notebook ("build it cheap, build it right, and bring the data home") and flies satellites for paying customers to clear the debt.
- The workshop shows a debt meter, the cash and the months left, with three contracts to pick from. Easy, Normal or Hard set the cash, the debt and the deadline.
- Part 1 is the 1958 tutorial in three guided steps; the epilogue leads into Part 2 (`CHANGELOG.md` 0.9 beta).

Do not say: the 0.8 calibration value or other game values as fact.

## 5. Game experience: [__] (slide 5 and the hub on slide 6)

Say:
- You fly the mission month by month with pause and fast forward. Events stop the clock and show what each choice costs; no choice is styled as the answer.
- The debrief gives a score out of 100 with stars, names the one thing that limited the mission, suggests one change to try, and compares the flight with the real record (for example September 2025 Arctic sea ice, 4.75 million km2, 26% below the 1981-2010 average).
- Redesign returns to Build with the same design, so the player sees what their change did. The same design always replays the same mission; in a campaign each flight has fresh luck.
- Part 2 is a race against a debt: cash, interest and a deadline in months, so every design choice costs real money. Easy, Normal and Hard change the cash, the debt and the deadline. (The old campaign hub and lab are off the home page; their code stays.)
- No single perfect solution: `tests/balance.js` checks that at least two different designs earn three stars per topic.

## Under-18 rule (from the event checklist)

Minors under 18 must not use their own name, face or voice in the submission, and the event recommends the 7-slide deck over the 30-second video. If any teammate is under 18, remove their name from slide 7 and the notes (say roles only), and do not narrate a video in your own voice. The game screenshots show only pixel characters.

## Draft Project Summary (field limit 50 to 200 words; this is about 135)

GRAVITRON: The Gravitronical Odyssey is a browser game for the NASA Space Apps challenge "Space Mission Design Game". The player picks a job for a satellite, an orbit, parts and a rocket, passes a readiness review, flies the mission month by month and reads a debrief that names what limited it. The simulation runs on real data: NASA FIRMS fire detections, the NSIDC Sea Ice Index, SILSO sunspot numbers and the Canadian Space Agency's Alouette soundings. A story ties it together: Austin Albert, a NASA engineer, tells the tutorial, and his grandson Ajay tells every later level. A campaign carries money and knowledge from one satellite to the next. It matters because it teaches why spacecraft design is a chain of trade-offs, to anyone with a browser, and it plays offline.
