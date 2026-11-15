# Continuation notes (Sunday November 15, about 12:20 Eastern). Read with `handoff/CODEX-HANDOFF.md` for the standing rules.

## State
- **`main` is version 1.0** (code `9584cc1`, spec `428567b`). Tested before the merge: every node test (`formulas` 16, `api` 121, `campaign` 61, `comeback` 118, `speed` 6, `debrief` 35, `migration` 116, `saves` 35) and all 25 browser scripts in `handoff/browser-tests`. After the merge `home`, `smoke`, `play` and `existing-player` pass on `main`.
- **The v1.0 tag could not be pushed from the cloud session** (git hangs up on tag pushes). The user pushes it from their own computer: `git fetch origin && git tag v1.0 9584cc1 && git push origin v1.0` (and v0.5 `753fb36`, v0.6 `dc6b30b`, v0.7 `88bdfab`, v0.8 `d4b1cf8`, v0.9 `db161d2` if still missing).
- Existing players keep their saves (in-place migration, tested against real 0.9 saves). Script and style links in `index.html` carry `?v=1.0`: **bump that query string with every release**, or a returning browser can mix old and new files.

## Things a person must check or fix
1. **`SOURCES.md` was damaged by Yareem's commit `c7a6b6f`**: a find-and-replace turned "no" into "Yes" inside words and URLs (NOAA became YesAA, ionosphere, Juno, north, Economy, Technology, "No third-party code" and more). It was repaired by a mechanical word-by-word fix in the merge `8ba91ed`, keeping his checked statuses. Yareem should glance at it and never run that replace again; the file feeds the submission form's References field.
2. **The Sputnik row in `SOURCES.md` has no link**: the writing agents could not open any NASA page. A person opens a NASA Sputnik history page and fills the URL. No other real-history fact was added to the story.
3. The submission deck is with another agent (not this session). Do not touch it.

## Work in flight when this was written
- **Part-adding effects** (branch `modes/add-fx`, worktree `/tmp/gw/add-fx`, not pushed): a chip flies from the clicked part card to the satellite, a dock pulse, "+N KG" chips on bars that changed, PAYLOAD jumps when a body is fitted. When it lands, merge it by cherry-picking its commits onto a branch from `main`; strip any commit trailers first (the rule is no AI trailers and no model names in commits).
- **Layout pass for laptops** (saved, not merged): `modes/ux-a2` (Build) and `modes/ux-b` (Mission, Debrief, Part 2 screens), both WIP commits with trailers to strip; at 1366x768 Build's satellite is large and locked parts are folded into "N arrive later". Re-run every test after merging.

## The user's suggestions (to do next, in this order)
1. **Fewer words** everywhere ("people won't really read it"); keep the colour coding, which works. Events especially.
2. **Show the part being added to the satellite when bought**: in flight (see add-fx above).
3. **Chances of failing + more challenges in the way**: launch failure per rocket (a risk shown on the rocket cards and the readiness review, colour-coded, few words; Part 2 only, Part 1 stays a safe tutorial), more mid-mission events, and a few complications between flights in Part 2. Re-tune the comeback with the simulator (`/tmp/.../scratchpad/story/be/sim/` is lost with the session: rebuild from `tests/comeback.js`) so a sensible player still wins in about 2, 3 and 4 flights.
4. **A "story so far" screen** (a journal: what has been revealed, Austin's notebook pages, what Ajay is fighting for), reachable from the map and the workshop; entries unlock as scenes are seen (`gravitron-seen-v1`, the Part 1 record).
5. **An info box on a part that does not count for the job** ("WHY?": what the job wants against what the part is), data-driven from the objective's `wants` and the part's `tags`.
6. **Write the profit clearly**: a PROFIT line on Build in Part 2 (expected pay minus cost, coloured) and in the debrief.
7. **Selecting a part explains what it does** (the part explainers show on hover; make them show on select too), and **make the structure card clear**: it says 20 kg but carries 100 kg: lead with "CARRIES 100 KG" (the body's `payload_kg`) and show its own mass as "weighs".
8. One line of the user's list was cut off ("Change the ...") and is unknown.
Done already: the X-ray photometer's unfinished blurb; the story; the part explainers.

## After everything lands
Delete `handoff/` as the user asked: first `git mv handoff/browser-tests tests/browser` (fix paths in any script header), move `handoff/lowpoly/API.md`, `gallery.html`, `parts-gallery.html` and `engine-tests/` to `docs/lowpoly/`, then delete the rest (including this file) in its own commit.
