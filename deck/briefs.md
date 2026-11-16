# GRAVITRON pitch: who says what

Slide numbers follow `deck/GRAVITRON.pptx` as rebuilt for version 2.1: 1 Cover, 2 Why (Impact), 3 The loop (Presentation), 4 Build (Validity), 5 Fly it on real data (Relevance), 6 Three ways to play (Creativity), 7 Proof and limits (Validity, Presentation). Every fact below is in `deck/claims.md` with its proof. Pitch shape from the event: **the problem, the solution, why it is important.** The demo is the 7 slides; a video of 30 seconds or less is the only other form allowed.

## Opening line (whoever opens, slides 1 and 2)

- **Problem:** Spacecraft design is a chain of trade-offs. Every part fixes one problem and creates the next, and few people ever get to try.
- **Solution:** GRAVITRON, a browser game: build a satellite, fly it month by month, read why it worked or failed.
- **Why it matters:** It runs in any browser with no install, offline, on real NASA and Canadian data.

## 1. Data: Yareem (slide 5, and the proof on slide 7)

Say:
- Each topic runs on a real data set: wildfire on NASA FIRMS fire detections (3,693,555 in 2025), sea ice on the NSIDC Sea Ice Index, the Sun on SILSO sunspot numbers, the ionosphere on the Canadian Space Agency's Alouette soundings (699,369). Source: `data/earth.js`, `SOURCES.md`.
- Orbit choice has a real cost in the data: a low orbit sees 92% of the fire detections, a polar orbit all, one geostationary slot 69%.
- 41 parts in 7 bins, 7 rockets, 3 orbits, 6 topics, 27 events, 14 real missions to compare against.
- Eight real formulas, each with a hand-worked test. Over 900 automated checks pass (973 in 16 test files on the 2.1 build).
- On slide 5 the flight is a wildfire contract: the line under the science bar reads "March: 288,836 fire detections worldwide (NASA FIRMS 2025)".
- Be honest: five rows of `SOURCES.md` (the part lead times) still need a human check. Live feeds (NOAA, NASA EONET, CWFIS) work only when online; otherwise it plays from a snapshot.

Do not say: "fires" (say "fire detections"), "live NASA data", a balance figure (not re-measured), any game value (cash, debt, payouts, odds) as fact.

## 2. UI and UX: angads22 (slides 3 and 4)

Say:
- One loop, seven stops: Mission Control (the job), Tracking Station (the orbit), Workshop (build), Rocket Yard (the rocket), Launch Pad (the review), Mission, Debrief. A low-poly base map joins them, with a gold route to the next stop.
- Build: the satellite is drawn from what is on board; three gauges (DATA, COST, TIME) and the bars for mass, power, budget and data home move with every part. The review says GO or NO GO.
- In Part 2 the cash, the debt and the months left sit at the top of every screen.
- Few words: the team's top complaint was "too many words", so events, hints and the debrief were cut to about half (`CHANGELOG.md` 2.0).
- No framework, no build step; reloading the page keeps your place.

Do not say: "works on every phone" (a phone layout for Build is not done).

## 3. Story, part one: [name] (slide 6, Austin)

Say:
- The game is GRAVITRON: The Gravitronical Odyssey. Part 1 is Austin Albert, a NASA engineer building the first satellite in 1958. His chapter is the tutorial: three guided steps.
- One short line on every screen, from your team, your partner, the customer or the notebook.
- Why story: it explains why each step matters before the player has to decide.

## 4. Story, part two: [name] (slide 6, Ajay)

Say:
- Part 2: decades later his grandson Ajay owes the lenders. He opens Austin's notebook and flies satellites for paying customers to clear the debt.
- He can borrow. Credit is a score from 300 to 850; a better band means cheaper interest and a higher loan limit. A rocket can fail at launch.
- Easy, Normal and Hard: the harder, the less help. On Normal and Hard you pay engineers to learn about a part.

Do not say: any cash, debt or interest figure as fact; they are game values.

## 5. Game experience: [name] (slides 5, 6 and 7)

Say:
- You fly month by month with pause and fast forward. An event stops the clock and shows what each choice costs.
- The debrief leads with the verdict and the money, then the one thing that limited the flight and one change to try, and compares the flight with the real record (for example September 2025 Arctic sea ice, 4.75 million km2, 26% below the 1981 to 2010 average).
- Three ways to play: Part 1, Part 2 and Quick mode (one flight from a new job each time, offline).
- The leaderboard and the 1v1 duel are built and tested but no server is hosted, so their buttons read ONLINE OFF. Scores are self-reported. Say this plainly; do not demo them as live.

## Rules to keep (from the event)

- At most 7 slides, in English. The deck must show the team name, the members' names, the challenge, an image of the project, the user experience, and how NASA and space-agency open data make it possible.
- Host the deck at a public link that needs no login, and test it in a private window.
- Under 18: a minor's name, face or voice must not appear. If any teammate is under 18, show roles only on slide 7, and do not narrate a video.
- The use of SI goes in the form field "Use of Super Intelligence (SI)"; copy it from `SI_USE.md`.
- "NASA Data" field: FIRMS, NSIDC. "Space Agency Partner Data and Other References": SILSO, CSA Alouette and the rest of `SOURCES.md`.

## Draft Project Summary (field limit 50 to 200 words; this is about 150)

GRAVITRON: The Gravitronical Odyssey is a browser game for the NASA Space Apps challenge "Space Mission Design Game". The player picks a job for a satellite, an orbit, parts and a rocket, passes a readiness review, flies the mission month by month and reads a debrief that names what limited it. Each topic runs on real data: NASA FIRMS fire detections, the NSIDC Sea Ice Index, SILSO sunspot numbers and the Canadian Space Agency's Alouette soundings. There are three ways to play. In Part 1, Austin Albert builds the first satellite in 1958 and teaches the loop. In Part 2, his grandson Ajay flies satellites for paying customers to clear a debt, with loans, a credit score and rockets that can fail. Quick mode is one flight from a new job each time. It matters because it teaches why spacecraft design is a chain of trade-offs, to anyone with a browser, and it plays offline.
