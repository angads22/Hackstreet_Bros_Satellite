# Handoff: GRAVITRON Design screens, November 15 2026

You are taking over from another Claude session that is out of limit. The user is **angads22**. They own the **Design screens**: `index.html`, `css/style.css`, `js/ui-design.js`, `js/ui-mission.js`, `js/ui-tree.js`, `js/ui-campaign.js`. Yareem ("yarmee") owns Data, Rules and Simulation (`data/*`, `js/game.js`, `js/mission.js`, `tests/*`). Do not edit Yareem's files.

This folder (`handoff/`) is not loaded by the game. Delete it when the work in it has landed.

## 0. Read first, in this order

1. `SPEC.md` (the source of truth) and `CLAUDE.md`. Plain HTML, CSS and JS, no frameworks, no build step, no `import`. `fetch` only in `js/live-data.js`. `js/game.js` never touches the page. Do not rename or add data fields without asking. One small task at a time. **Any change to `SPEC.md` goes to `main` straight away, in its own commit.**
2. This file.
3. `handoff/lowpoly/API.md` (the 3D engine), then `handoff/lowpoly/assembler-brief.md` (the next file to write).

Work on branch `claude/pensive-allen-ujtdag` (not `main`). Run `git fetch origin main` and merge `origin/main` into the branch before you start; teammates push spec changes to `main` often. Main was at `986a96c` when this was written.

## 1. Rules the user set (follow exactly)

- Commits are authored as angads22 (git config is already set). **No AI or Claude trailer lines, no PR footer, no `SI_USE.md` row for small work.** Only for *major* work, which the user defined as "a redesign that makes it not vibecoded": the audit fixes and the low-poly redesign. For those, add one `SI_USE.md` row per piece of major work, and a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer. **Never write a model name or ID into a commit, PR, code comment or repo file**; if the user wants a model named in `SI_USE.md`'s footer they will paste it themselves.
- `SI_USE.md` is the one disclosure record. Keep it current.
- Never compute game numbers on the screen. Every number comes from the back end (`getTotals`, `runChecks`, `previewPayout` and so on).
- New code that depends on new art must fall back: `typeof LowPoly === "object"` plus try/catch, so the existing SVG art keeps working if it fails.
- Keep it flat: no gradients, glass or shadows, no emoji as icons. Keep rounded corners. Use real content. Verify every change by running the game with real input, not by reading code.
- Push to the branch only. After pushing, check whether a pull request is open for the branch (`list_pull_requests`); if none is, open a draft. Do not push anything else to `main` except `SPEC.md` commits.

## 2. What the user wants (their words, newest first)

1. "Wait can you do finishing touches and leave the major tasks to the new agent": the previous session is doing only small finishing touches. Check `git log` for commits after the one that adds this folder; read them before you start.
2. Notes from a team meeting: "separate purchasing locations / animate certain processes like assembly shipping n whatnot / More icons to symbolize what the user is interacting with / travel costs money and they should have the thing / certain country's speaclize in differnet parts / hints". The user's answer: do them **all in tandem**, and for the buying idea **write a proposal** (done, below). They also said to leave the stopped audit and the stopped satellite assembler stopped: no relaunching those agent runs.
3. "PS3 low poly": the art style for the satellite, rockets, Earth, people and map. The interface around it is restyled separately as flat and clean.
4. "design looks too vibecoded": they pasted a brief (visual, copy, build and code, security, fake functionality, missing states, broken basics, hygiene, inconsistency, unverified work). The brief is the `BRIEF` constant in `handoff/audit/vibecode-audit.js`. Its fix priority: security, broken functionality, missing states and mobile, accessibility, visual polish, copy.

## 3. State of each stream

### A. Supply chain (suppliers, countries, travel cost): DONE as a proposal, do not build
`SPEC.md` has "Proposal: suppliers, countries and travel (not agreed, do not build yet)", pushed to `main` as `986a96c`. It lists five open questions for the team. Do not build any of it until the user says the team agreed. It adds data fields and rules, which are Yareem's. The Design screens' share (supplier places on the map, a country line on part cards, shipping and assembly animation) waits too.

### B. Icons (small, Design only): partly open
Today only the parts bins have icons, and they are 8x8 pixel art (`BIN_ICONS`, `js/ui-design.js` around line 1362). Teammates also changed `SPEC.md`'s Debrief section: "aim to have minimal wording and utilize icons to illustrate points". Plan: one flat icon set (single colour, `currentColor`, 16x16 grid, drawn as SVG paths in code, no images, no emoji), with a helper `icon(name, label)` exported on `StarlineUI` so `js/ui-mission.js` can use it. Apply to: the check rows (`checkList`, replace the text markers `[X]` and `[!]`; keep an accessible name), the parts bins, the four resource bars (mass, power, budget, data), the five places (map legend, minimap, screen headers), the debrief's limiting factor (mass, power, budget, data, event, design), and the part card stats. Icons must never carry meaning alone: keep the words (screen readers and colour-blind players). Check contrast against both themes.

### C. Animations (small): open
`state.change` already makes the bench satellite drop a part in or slide it out (`.sat-p.is-new`, `.sat-p.is-gone` in `css/style.css`). Still to add: an assembly sequence on entering the Readiness review (parts arrive one by one), and a rollout and launch at the launch pad (`LowPoly.scenes.pad(...).launch()` once the 3D art lands; a CSS version until then). They show numbers the rules already computed and add none. Respect `prefers-reduced-motion` (the existing code does: copy it). Note `SPEC.md` "Out of scope" still lists "3D graphics or animated launches": reword that line in its own `SPEC.md` commit pushed to `main` (the user chose the low-poly art, so the spec must say so). The base-map line (~736, "a pixel map of a space centre") and the other pixel-art lines change in the same way when the art lands.

### D. Low-poly redesign (major): engine and models done, satellite scene and wiring open
Files are in `handoff/lowpoly/js/` (about 308 KB, ES5, one global `LowPoly`, no dependencies): `lowpoly.js` (software rasteriser on a 2D canvas, flat shading), `lp-parts-instruments.js`, `lp-parts-systems.js`, `lp-parts-body.js`, `lp-pad.js` (7 rockets and the launch pad scene), `lp-people.js` (5 busts and `LowPoly.portrait`), `lp-earth.js` (Earth scene, orbits, overlays, `LowPoly.scenes.title()`), `lp-base.js` (base map scene, minimap, a walking person). `API.md` documents all of it. `engine-tests/` are the engine's own numeric and browser tests; their relative paths expect the original `work/engine/` layout, so adjust them (they load `../js/lowpoly.js` equivalents).

Reported budgets: about 1 ms per 600 triangles at 800x600. Every model was reviewed by eye by the previous session and by its author.

**Not done:**
1. `lp-satellite.js`: `LowPoly.scenes.satellite({parts, data, change, size, spin})`. The full specification is `handoff/lowpoly/assembler-brief.md` (it was written for another agent; read it as the spec, with paths now relative to the repo). It needs the drop-in and slide-out animations, a cradle when there is no body, a small fixed pose for the Readiness review, an accessible label, and `scenes.satellite.sample`. Also write `handoff/lowpoly/gallery.html` that shows every model (parts, bodies, rockets, pad, people, Earth for leo, sso and geo, the title scene at 1280x320 and 390x400, the base scene at 900x540, the minimap at 168x101) so you can look at them.
2. A review: look at the gallery and fix what reads badly. Already known: the sun on the launch pad scene looks like a mushroom on a stick; the people busts are over their 150-triangle brief (kept on purpose); the rideshare and heavy rockets share one outline because `data/launchers.js` cites the same vehicle (a data decision, ask Yareem). Check robustness (no throw on an unknown id, a canvas not in the document, reduced motion, hidden tab) and performance on a phone-width page.
3. Integration. **Consult the advisor tool before you wire it into `js/ui-design.js` and again before anything goes to `main`.** Copy the `lp-*.js` files into `js/`, add script tags in `index.html` (`lowpoly.js` first, then the models, then `lp-satellite.js`), add `--lp-*` colour tokens to `css/style.css` (the palette is 39 fixed names, each overridable as `--lp-<name>`), and replace: the bench and Readiness satellite (`satelliteArt`), the launch pad (`padArt`), the portraits (`directorArt`, `speakerArt`), the base map and minimap, the title screen and the mission Earth view. Use the guard pattern from section 1 for every one. The base scene needs `drag:false, keys:false` and `aria-hidden` on its canvas; its `project(x, y)` maps to the existing 200x120 map coordinates, so the walking player, routes and blips keep working.
4. Update the browser tests (section 5), `CHANGELOG.md` (one line under Unreleased), `SI_USE.md` (one row), and `SPEC.md` (own commit to `main`).

### E. Audit and the "vibecoded" restyle (major): not started on the code
A 15-agent audit ran for 26 minutes and was stopped by the user at 7 of 8 finders with nothing verified. Its findings were not saved to disk, so they are gone. **Do not relaunch it without asking the user.** Its script is `handoff/audit/vibecode-audit.js` if the user does want it back. Without it, work through the brief's priority yourself, one small commit each:
1. Security: look for anything injected as HTML (`innerHTML` with game or live data), `javascript:` or unchecked links, the save-code import path (`importSave`), secrets, unsafe `target=_blank` without `rel`.
2. Broken functionality: dead buttons, fake controls, things that look interactive and do nothing.
3. Missing states and mobile: empty, loading, error and offline states; 390 px wide and 200% zoom; touch targets of at least 44 px.
4. Accessibility: contrast, focus visible, names for icon-only controls, keyboard paths, reduced motion.
5. Hygiene: the 93 MB `data/result_master.csv` is unused and still in the repo (ask before deleting it), stray files, console errors, stale comments.
6. Last, the look: flat and clean, one type scale, a smaller set of radii, one button family, fewer boxes, real content. Do this after 1 to 5 and after the 3D art so the screens match it.

### F. The deck (handed to another agent): leave it
The demo is now "at most 7 slides including the title" (teammates removed the video option in `SPEC.md`). An empty Slides artifact exists: https://claude.ai/artifact/VtmUHfNb5BbqenMFGJwzQE ("GRAVITRON: product deck"). Screenshots for it must be retaken after the restyle.

## 4. Things you must know about the code

- `js/ui-design.js` is one IIFE of about 2600 lines. It exports only `showDesignScreen` and `StarlineUI` (`storyLine`, `speakerArt`, `speakerName`, `satelliteArt` and the rest). Marked integration blocks: `// STORY-BEGIN ... // STORY-END` and `// SAT-BEGIN ... // SAT-END`.
- The story: chapters `austin` (first tier, the tutorial) and `ajay` (every later tier). Intro beats: Austin 5, Ajay 6. The Ajay intro says "The mission failed": open question whether the tutorial should always end in a failure.
- `data/events.js` has a `calibration-drift` event whose "continue" choice multiplies science by 0.8 (marked GAME VALUE). It needs Yareem's agreement. Tell the user it is still open.
- Colour tokens are in `:root` in `css/style.css`: role tokens, `--pal-*` art tokens, `--map-*` tokens.
- A canvas must be in the document before `LowPoly.render` or `LowPoly.view`. `LowPoly.view` stops by itself when its canvas leaves the document, pauses when hidden or off screen, and does not auto-spin under reduced motion. Registries are plain objects: use `LowPoly.model(kind, id, opts)` (never throws) rather than indexing them. Launchers are centred on the origin: stand one on the ground at `pos.y = size[1] / 2`. Look faces point along +Z; Earth-looking cameras go on side ports with roll 0, +90 or -90.

## 5. How to test

- Back end (do not edit, run to be sure you broke nothing): `node tests/formulas.js`, `api.js`, `campaign.js`, `balance.js`, `speed.js`. Skip `tests/simulate.js`, it takes over ten minutes.
- Browser: Playwright and Chromium are preinstalled (`require('playwright')` works from any directory). `handoff/browser-tests/` has the scripts the previous session used. Each takes the repo directory and an output directory for screenshots: `node handoff/browser-tests/play.js "$PWD" /tmp/shots`. **Send screenshots outside the repo**; stray PNGs landed in the repo root before and had to be deleted. `play.js` walks the intro, the map and all seven screens at desktop and phone width; `fail.js` a failing mission; `touch.js` two-tap previews; `careless.js` a careless design; `igy.js`, `iono.js`, `live.js`, `campaign.js`, `calib.js` the eras, the ionosphere topic, live data, the campaign hub and the calibration event; `regions.js` the word budgets per screen region; `words.js` the word counts. The progress key is `smdg-progress-v1`; the value that unlocks everything for a test is `{best_stars:{training:3},best_score:{training:97},best_stars_by_era:{igy:3,nimbus:3,eos:3}}`.
- The last full run before this handoff: `fail`, `touch`, `careless`, `igy`, `iono`, `live`, `campaign` all PASSED, and `formulas` 16, `api` 120, `campaign` 35, `balance` 53 (3 known gaps), `speed` 6, all passing.

## 6. How to hand back (required)

The previous session cannot see your work unless you hand it back. Do all three, in this order:

1. Write `handoff/HANDBACK.md` on the branch, commit it, push it. It must contain: what you finished (with commit hashes), what you started and did not finish, what you decided and why, test results (the actual numbers, and anything that fails), anything you could not verify, anything the user or Yareem must decide, and the exact next step.
2. Send a short message to session `session_01V8Q2nhLibbYic8X1ehKSGi` using the `send_message` tool of the `claude-code-remote` server (priority `later`). Ten lines at most: branch, last commit hash, what is done, what is next, and "full detail in handoff/HANDBACK.md". If that tool is not available to you, skip this and rely on the file.
3. End your final reply with the same summary for the user. Do this before you run out of limit: if you are close to it, stop starting new work and write the handback first. The previous session's five-hour limit resets at about 05:50 UTC.
