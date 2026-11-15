# Handoff for Codex (November 15 2026, about 08:40 Eastern)

The Claude session building this hit (or is about to hit) its usage limit. This file is everything you need; it does not depend on anything outside the repo. Read `SPEC.md` (the source of truth, especially "Two game modes") and `CLAUDE.md` first, then this.

**Code freeze is Sunday 14:00 Eastern; demo 17:00; submit 20:00** (`SPEC.md`, "Checkpoints").

## The user's instructions you must follow

- The user is **angads22** (Design screens owner). Yareem ("yarmee") owns data, rules and simulation, but the user has approved the work below in his files.
- Commits are authored as angads22. **No co-author or AI trailer lines, no model names** anywhere in commits, PRs or files. No `SI_USE.md` rows "for now".
- Any change to `SPEC.md` goes to `main` straight away **in its own commit**.
- Never write a game number into on-screen text: every amount comes from a back-end function or a data global.
- Flat look with rounded corners: no gradients, glass, shadows or emoji icons. **Few words** ("too complex and too wordy" is the user's top complaint).
- Verify every change by running the game (Playwright + Chromium; run scripts from outside the repo; stray PNGs have landed in the repo root before; check `git status` before every commit).
- "Ask less questions, save for the end, finalise the whole game."

## What the game is now (all of it on branch `claude/pensive-allen-ujtdag` on GitHub, not on `main` yet)

- **Home page:** a low-poly hero and two mode cards. **The user does not like how the home page looks** and asked for it to look better (see "Still to do", 1).
- **Part 1, Austin's first satellite (1958):** a three-step guided walkthrough in the `igy` era, `training` tier. Every step flies radiation: the 1958 data has only that topic. Step 1 has orbit and rocket preset; step 2 has the rocket preset; step 3 is free. Then an epilogue that leads into Part 2. Progress is in localStorage `gravitron-walkthrough-v1`.
- **Part 2, Ajay's comeback (today):**
  - A mode of the existing campaign (`mode: "comeback"`) with a difficulty picker: Easy, Normal or Hard (the three tiers).
  - Cash, a debt with monthly interest, and a deadline in months.
  - Three contracts at a time, from `data/contracts.js`, each with a client and a reason. A flight pays in proportion to the data it returns.
  - PAY BACK, no bail-out, and a won or lost ending.
  - Back end: `newComeback`, `getComeback`, `newComebackDesign`, `payDebt` and `getComebackEnding` in `js/mission.js`, with tests in `tests/comeback.js`.
  - Screens: `js/ui-comeback.js` and the comeback branch of the debrief in `js/ui-mission.js`.
  - Tuned by simulation: on Normal a sensible player wins in 4 to 5 flights, a careless one always loses.
  - The text and tone are in `handoff/notes/AJAY-TEXT.md`. Ajay is a reckless founder, kept light.
- **Low-poly art everywhere:** `js/lowpoly.js` (the renderer) and `js/lp-*.js` (models and scenes) draw:
  - the home hero, the Build-bench satellite (`js/lp-satellite.js`), the speakers' faces, the rocket on the pad with a lift-off when you press LAUNCH, the mission screen's Earth, and the base map and minimap.
  - Each is behind a `typeof LowPoly === "object"` guard with the old pixel art as fallback.
  - `handoff/lowpoly/gallery.html` shows every model.
- **Version:** `main` is at 0.8 beta. The next cut is **0.9 beta**, done at the end (below).

## Work that was in flight when the limit hit

These ran in local git worktrees of the Claude session. **Only what was pushed to `claude/pensive-allen-ujtdag` survives.** Check `git log origin/claude/pensive-allen-ujtdag` and compare with the list below; redo what is missing.

1. **Part 2 screens.** Almost certainly pushed, since it was done when this file was written: the picker, workshop hub, contract flights, debrief money, ending, Ajay's story, and the `comeback.js` browser test. `campaign.js` is retired; `calib`, `live` and `iono` were repointed through Part 2.
2. **Back-end fixes** (were on a local branch `modes/fixbe`). Findings are in `handoff/notes/findings-backend.json`; each has repro, expected, actual and root cause. Redo any that are not on the branch:
   - TRY THIS suggests impossible parts, parts too heavy for the body or rocket, or orbits no rocket reaches. Every suggestion must be something the player can actually do.
   - A battery-only satellite is ended by the first event.
   - Reloading during a flight loses the launch money and the flight.
   - A save code with missing fields is accepted and breaks the game.
   - Copy slips: "The a hurricane", raw numbers like 0.000025, events naming hardware the satellite does not carry, "Try the next tier" on the last tier.
   - The solar topic shows 0 sunspots in 2026.
   - The scintillation counter's promised science is wrong.
3. **Design-screen fixes** (were on a local branch `modes/fixa`). Findings are in `handoff/notes/findings-fronta.json`:
   - the hover preview is cut off, and appears off-screen on a phone;
   - the phone Build screen is a scrolling chore;
   - OVER BUDGET's FIX goes to the wrong place, and FIX for a missing part opens the wrong bin;
   - the readiness review says GO for a weak science forecast (show the forecast);
   - the orbit badge contradicts its own "In view" line;
   - phone overflow on the Launch vehicle screen;
   - map labels cut off, and the map repeats its instruction four times.
4. **Home page redesign:** three design directions, judged on screenshots (see "Still to do", 1).

## Still to do, in this order

1. **Home page that looks good.**
   - Make it a proper game title screen: a full-width low-poly scene (`LowPoly.scenes.title()` in `js/lp-earth.js`) behind a big GRAVITRON logotype, and two large menu buttons, PART 1 · 1958 and PART 2 · TODAY.
   - Show each part's state on its button (Part 1's step stars, Part 2's CONTINUE), with almost no other text, and RESET as a quiet link.
   - It must work at 390 px wide and with `js/lowpoly.js` blocked.
   - Keep the hooks the tests use, and run `handoff/browser-tests/home.js` and `play.js`.
2. **Mission and debrief engagement fixes** (`handoff/notes/findings-frontb.json`, in `js/ui-mission.js`):
   - the T-MINUS never counts (make the lift-off count down);
   - event choices hide the cost of the safe option;
   - a 3-star win feels flat (celebrate it, and make unlock banners buttons);
   - REDESIGN lands on Build with stale guidance;
   - a11y: the pause button's name, fast-forward's on state, the star rating's label;
   - the limiting-factor icon is a pencil for orbit, instrument and attitude;
   - layout at 200% zoom and at 320 px wide.
3. **Merge and test everything:**
   - every browser script in `handoff/browser-tests/`: `node <script>.js [shotsdir]` from outside the repo, with `REPO` set to the repo path;
   - every node test: `node tests/formulas.js`, `api.js`, `campaign.js`, `comeback.js`, `speed.js`, `version.js`, and `balance.js`, which takes about 10 minutes;
   - then play both modes end to end at 1280 and 390 wide.
4. **Cut 0.9 beta:**
   - In `CHANGELOG.md`, rename "Unreleased" to "0.9 beta (date)", with a short summary and a "Not in this version yet" list, and start a new empty "Unreleased" above it.
   - Set the footer in `index.html` to `GRAVITRON v0.9 beta`.
   - Commit that and push it to `main`.
   - Then change the "Current version" line in `SPEC.md`, in its own commit pushed to `main`; it must stop saying the low-poly art is not in the game.
   - Run `node tests/version.js`.
   - The user pushes tags from their own computer, because cloud sessions cannot.
5. Open a PR from `claude/pensive-allen-ujtdag` to `main`, and merge it when green if the user asked for that ("finalise the whole game").
6. **Questions saved for the end** (ask the user once, all together):
   - should RESET also clear a saved comeback?
   - is the 0.8 calibration science value OK with Yareem?
   - rideshare and heavy share one rocket outline (a data decision);
   - should `handoff/` be deleted once everything has landed?

## Useful facts

- **Browser tests:** they use `handoff/browser-tests/lib.js`, which holds the proof designs (`WALK`) for each Part 1 step and the Part 2 proof designs. `walk-proof.js` proves each Part 1 step is winnable.
- **Saved progress keys:** `smdg-progress-v1` (stars), `smdg-campaign` (the comeback save), `gravitron-walkthrough-v1` (Part 1).
- **Internet:** live NASA and NOAA calls are blocked in cloud sandboxes, so the SNAPSHOT badge is expected there.
- **Bug sweep:** `handoff/notes/findings-all.json` has every finding from the playtest sweep (76, of which 73 were confirmed by a second tester). Findings about other eras, the 1957 campaign or the lab are low priority, because those screens are no longer reachable.
