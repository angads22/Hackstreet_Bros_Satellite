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

## State at 10:45 Eastern (branch `claude/pensive-allen-ujtdag` on GitHub, commit `11f1511` or later)

**Done and pushed:**
- Part 2's screens.
- The new **console-style home page**: a full-screen low-poly scene, a drawn GRAVITRON logo, and the two modes as a vertical menu. The user had asked for a better-looking home page.
- The design-screen fixes, merged: the hover preview, phone Build, FIX targets, the readiness forecast, orbit wording, map words and bin text.
- Most back-end fixes: battery-only satellites, save-code validation, a refund after a reload, the lab soft-lock, TRY THIS only suggesting doable things, event text, sunspots, unreachable orbits.
- Part of the mission and debrief fixes: event choice costs, the log and debrief agreeing on the verdict, accessibility, the limiting-factor icons.

Every node test and every browser script passed at `37f5ae0`. The home page passed its own checks at 1280, 390 and 1920, with the art blocked, and with saves.

**In flight when this was written** (local worktrees of the Claude session; lost if not pushed):
- Finishing the mission and debrief fixes: the lift-off countdown, the 3-star celebration, REDESIGN going to the named fix, what the next star needs, 200% zoom, 320 px. See `handoff/notes/findings-frontb.json`.
- Finishing the back end: copy slips and raw numbers in the advice, the scintillation counter's numbers, "Try the next tier", mixed messages. See `handoff/notes/findings-backend.json`.

If those are not on the branch, they are optional polish. Skip them if time is short.

## Still to do, in this order

1. Run everything:
   - every node test in `tests/` (`balance.js` takes about 10 minutes);
   - every script in `handoff/browser-tests` (`node <script>.js <shotsdir>` from outside the repo with `REPO` set; `lowpoly.js` takes the repo path as its first argument);
   - then play both modes end to end at 1280 and 390.
2. **Cut 0.9 beta:**
   - In `CHANGELOG.md`, rename "Unreleased" to "0.9 beta (date)", with a summary and a "Not in this version yet" list, and start a new empty "Unreleased" above it.
   - Set the footer to `GRAVITRON v0.9 beta`, then commit.
   - Change the `SPEC.md` "Current version" line in its own commit straight to `main`. It must stop saying the low-poly art is not in the game, and must describe the two modes.
   - Run `node tests/version.js`.
3. Open a PR from `claude/pensive-allen-ujtdag` to `main` and merge it (the user asked to "finalise the whole game").
4. Ask the user the saved questions in one go:
   - should RESET clear a saved comeback?
   - Yareem's OK on the 0.8 calibration value;
   - rideshare and heavy share one rocket outline;
   - should `handoff/` be deleted now?
   - and the version tags, which the user must push from their own computer: v0.8 at `d4b1cf8`, and v0.9 at the cut.

## Useful facts

- **Browser tests:** they use `handoff/browser-tests/lib.js`, which holds the proof designs (`WALK`) for each Part 1 step and the Part 2 proof designs. `walk-proof.js` proves each Part 1 step is winnable.
- **Saved progress keys:** `smdg-progress-v1` (stars), `smdg-campaign` (the comeback save), `gravitron-walkthrough-v1` (Part 1).
- **Internet:** live NASA and NOAA calls are blocked in cloud sandboxes, so the SNAPSHOT badge is expected there.
- **Bug sweep:** `handoff/notes/findings-all.json` has every finding from the playtest sweep (76, of which 73 were confirmed by a second tester). Findings about other eras, the 1957 campaign or the lab are low priority, because those screens are no longer reachable.
