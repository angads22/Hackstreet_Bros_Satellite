# tests/redteam: gameplay red-team harness

This harness stress-tests the back end (`js/game.js`, `js/mission.js`, `data/`) in Node, with no browser and no screens. It exists so a Claude Code session, or a person, can:

1. read the findings in **`REPORT.md`**,
2. reproduce each one, and
3. check a fix by rerunning the same scripts and comparing the numbers.

Plain Node only (18 or later): no packages, no `npm install`, nothing to build. Each script loads the game through `tests/load.js`, in the same file order as `index.html`, so it always tests the code currently checked out.

## For a Claude Code session picking this up

1. Read `CLAUDE.md` and `SPEC.md` first; they still apply.
   - `js/game.js` is owned by Rules, `js/mission.js` by Simulation and `data/` by Data.
   - New or renamed data fields need the data owner's approval.
   - Do one small task at a time.
2. Read `REPORT.md`. Start with the TL;DR table (findings ranked P0–P3), then §4 "Suggested fixes, in priority order".
3. Before changing anything, run the fast scripts below and confirm you get the numbers quoted in the report.
4. Make one fix, rerun the scripts that cover it (see the table), and check that the numbers moved the way you intended and nothing else broke. Also run `node tests/formulas.js` and `node tests/simulate.js`.
5. Don't commit the `sweep-*.json` files. They are large and are ignored by `.gitignore` in this folder.

## How to run

Run everything from the **repo root**. Every script finds its files relative to itself, so the working folder doesn't matter.

```bash
node tests/redteam/probes.js
```

```bash
node tests/redteam/strategies.js
```

The exhaustive sweep runs in two steps. First the sweep itself, one tier at a time (about 1–2 minutes each; the three can run in parallel):

```bash
node tests/redteam/sweep.js training
```

```bash
node tests/redteam/sweep.js standard
```

```bash
node tests/redteam/sweep.js expert
```

Then the analysis. `analyze.js` needs that tier's sweep file, and `advice.js` needs all three:

```bash
node --max-old-space-size=4096 tests/redteam/analyze.js training
```

```bash
node --max-old-space-size=4096 tests/redteam/advice.js
```

The sweep writes `tests/redteam/sweep-<tier>.json` (about 35–65 MB each). Delete these when you're done.

## What each script does

| Script | Time | What it shows | Report sections |
|---|---|---|---|
| `lib.js` | n/a | Shared helpers. Loads the game and exposes `design`, `play`, `bestPlay`, `SAFE`, `RISKY`, `safeIdx`, `PART_IDS` and `G` (every game global and data table). | all |
| `probes.js` | seconds | Edge cases and exploits:<br>§1 all 15 parts on board<br>§2 editing the design mid-mission<br>§3 how protection works<br>§4 broken panel or battery<br>§5 spares and the dead `storage_gb` field<br>§6 seed reroll with a UHF radio<br>§7 invalid API input<br>§8 `recordResult` on an unfinished mission<br>§9 free choices once over target<br>§11 debrief and real-world text<br>§12 Δv per thruster | L1–L9, B5, B7 |
| `strategies.js` | seconds | 14 named player strategies flown on every tier, with safe, risky, best and worst choice sequences. Prints a markdown table. | §2.4 |
| `sweep.js <tier>` | 1–2 min | Every part subset × orbit × launcher × objective for one tier. Every launchable design is flown with every event-choice sequence. | §2.1–2.2 |
| `analyze.js <tier>` | ~10 s | For each objective: star counts, how often choices matter, limiting factors, 3★ below target, best design per orbit, part popularity, UHF-reroll impact. | B1–B5, B7, L9 |
| `advice.js` | ~1 min | Whether debrief advice can be acted on, the battery cliff, part dominance, science ceilings per orbit, the score ceiling per tier, event odds per orbit. | B1, B3, B6, B7, L6 |

## Checking a fix

`lib.js` makes a one-off check a few lines long:

```js
// save as tests/redteam/check.js, run: node tests/redteam/check.js
var L = require("./lib"), G = L.G;
var d = L.design("standard", "sea-ice", "sso", "small",
  ["sar-radar", "solar-large", "radio-xband", "obc-basic", "prop-ion"]);
console.log(G.runChecks(d));                   // blockers and warnings
console.log(G.previewScience(d).total);        // expected science
var r = L.play(d, L.SAFE);                     // or L.RISKY, or a choice array like [0, 1]
console.log(r.score, r.stars, r.limiting, r.suggestion);
console.log(L.bestPlay(d).score);              // best over every choice sequence
```

These numbers show whether a fix worked. They come from §2 and §3 of the report.

| Finding | Before the fix | After a good fix |
|---|---|---|
| B1 wildfire target | best wildfire preview 172.8 of 180; `limiting` is never `none` for wildfire | some wildfire designs reach `none` |
| B3 sea-ice tiers | `analyze.js standard` / `expert`: 0 sea-ice designs at 3★; max 89 / 86 | at least one 3★ sea-ice design on each tier |
| B4 3★ below target | `analyze.js training`: "3 stars WITHOUT reaching target" is 464 for wildfire, 331 for sea-ice | 0, if the gate is adopted |
| B6 battery cliff | `advice.js`: core 345.6 → 222.2 after adding `obc-radtol` | a small drop, not 36% |
| L1 shared design | `probes.js` §2: 39 → 50 after editing the design mid-flight | stays 39 |
| L2 broken panel | `probes.js` §4: "panel broken" rate 7.200, same as intact | lower than intact |
| L3 protected flag | `probes.js` §3: the safe choice returns `protected: true` and charges $0.3M | `protected: false` on the safe choice |
| L4 `recordResult` | `probes.js` §8: month 30 of 48 records 3★ and unlocks Standard | returns null |
| L5 validation | `probes.js` §7: an unknown tier gives no blockers; an empty design scores 25 | budget blocker / null mission |
| L6 advice | `advice.js`: "lim=power … of which battery already fitted 2060" | 0 |

## Notes

- **Choice policies:** "safe" (`L.SAFE`) picks the option with no `fail_chance`; "risky" (`L.RISKY`) picks the one with a `fail_chance`. `bestPlay` tries every sequence.
- **No randomness:** the game seeds its randomness from the design, so every result here is exactly reproducible. Rerunning after a data change will move the numbers; that's expected.
- **Internals:** `probes.js` builds a few missions by hand to force a specific event. If the shape of the mission object in `mission.js` changes, update `fakeMission` there.
