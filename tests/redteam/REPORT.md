# Red-team report: gameplay and back-end logic

**Code tested:** `main` at `ca7e993`. I ran the sweep on `yarmee/vibrant-galileo-gw37wj` at `cd963d3`, whose `js/` and `data/` are byte-identical to `main` (the only difference is `tests/play.js`).
**Files under test:** `js/game.js`, `js/mission.js`, all of `data/`. This report changes none of them.
**Harness:** this folder (`tests/redteam/`). **Start with `README.md`** for how to run it.
**Audience:** the main Claude Code session. Read `SPEC.md` and `CLAUDE.md` first. File ownership and the data-field approval rule still apply to any fix below.

---

## TL;DR: the 12 findings that matter most

| # | Sev | Finding | Where |
|---|---|---|---|
| 1 | P0 | **The wildfire science target can't be reached.** The ceiling over every part set and orbit is 172.8 of 180, so wildfire never gets "target reached" and the debrief's best advice ("try another orbit") is wrong. | `data/objectives.js:11` |
| 2 | P0 | **A mission reads the live `design` object.** Editing parts or the launcher after launch changes both the running mission and the debrief. Adding parts after launch and removing them before the debrief turned a 0★ into a 1★. | `js/mission.js:68` |
| 3 | P0 | **Sea-ice 3★ can't be reached on Standard (max 89) or Expert (max 86).** Wildfire 3★ can be reached on every tier. The budget part of the score caps radar builds, so which objective is "harder" flips depending on the tier. | `mission.js:285`, `data/tiers.js` |
| 4 | P1 | **The orbit choice is already solved: SSO wins both objectives.** No LEO design ever reaches 2★ for either objective. GEO wildfire tops out at 72 and only fits the Training budget. The spec's "real choice" for wildfire doesn't exist. | `data/orbits.js`, `data/objectives.js` |
| 5 | P1 | **3★ is possible without hitting the science target.** It happens in every 3★ wildfire design, and the 15-part "kitchen sink" sea-ice build gets 3★ at 92% of target. 40 of the 100 points are nearly free. | `mission.js:288-295` |
| 6 | P1 | **Event choices rarely matter.** They change the star rating in only 0.6–10.6% of launchable designs. Once science passes the target, every science-losing option costs nothing: I took 6 bad options in one mission and still scored 97/3★. | `mission.js:225-273`, scoring |
| 7 | P1 | **The battery is an all-or-nothing cliff, and only one battery exists.** Adding a 1.3 W computer to the spec's own sea-ice design cuts science by 36% (345.6 → 222.2). Any radar plus second instrument is power-limited for good, and the debrief still says "Add a battery". | `game.js:244` |
| 8 | P1 | **A broken solar panel has no effect.** Power generation is never re-checked in flight, so a battery alone keeps the satellite running at full science. The risky choice on "Stuck panel hinge" is free when the panel is the part that breaks. | `game.js:223-262`, `mission.js:96` |
| 9 | P1 | **`protected: true` is reported even when the player chose the safe option and paid for it.** For example, a debris dodge charges $0.3M and still says "a part on board protected you". | `mission.js:230-232` |
| 10 | P2 | **The debrief advice is often impossible or wrong.** It says "Add a battery" when the battery is already fitted (2,060 Training designs), "Fit X-band" when X-band is already fitted (25,622), "Try an orbit that suits the objective better" on the best orbit, and "Add the optical camera" for sea-ice in GEO, where nothing can see the Arctic. | `mission.js:319-366` |
| 11 | P2 | **Dominated parts.** The payload computer is strictly worse than the basic one (`storage_gb` is never read anywhere in the logic). The ion thruster beats the large green pack on mass, cost and impulse, and the small one on mass and impulse. The UHF radio is useless as a radio and mainly works as a free seed reroll. | `data/parts.js` |
| 12 | P2 | **The API accepts bad input.** `recordResult` takes an unfinished mission (3★ and a Standard unlock at month 30 of 48). `startMission` runs an empty design. An unknown tier id skips the budget blocker. `chooseEvent(m, 7)` applies option 0 but records option 7. | `mission.js`, `game.js:302` |

---

## 1. Method

- **Harness:** `tests/redteam/` loads the game into Node through `tests/load.js`, the same file order as `index.html`, and calls only the public functions plus a few internals for the probes.
- **Exhaustive sweep (`sweep.js`):** I tried all 32,767 non-empty part subsets (one of each of the 15 parts) × 3 orbits × 3 launchers × 2 objectives × 3 tiers, which is **1,769,418 designs**. Every design with no blockers (**227,088 launchable**) was flown with **every possible event-choice sequence** (2, 4 or 8 sequences, depending on the tier), giving about 1.1 million missions in total. For each design I recorded the always-safe, always-risky, best and worst sequences.
- **Probes (`probes.js`):**
  - All 15 parts on board, for every tier, objective, orbit and launcher.
  - Editing the design mid-mission.
  - How protection works.
  - Broken parts.
  - Seed rerolls.
  - Invalid API input.
  - Recording an unfinished mission.
  - Free choices after the target is passed.
  - Debrief text.
- **Named strategies (`strategies.js`):** 14 player archetypes (below), each flown on all three tiers.
- **Advice audit (`advice.js`):** checks whether each debrief suggestion can actually be acted on. It also covers the battery cliff, part dominance, science ceilings per orbit, and event odds.

"Safe" means the choice with no `fail_chance`; "risky" means the choice that has one. In the results, a star count is shown as ★.

## 2. Headline numbers

### 2.1 Star distribution over every launchable design (always-safe choices)

| Tier / objective | Launchable | 0★ | 1★ | 2★ | 3★ | Max score (best choices) | Choices change the stars in |
|---|---|---|---|---|---|---|---|
| Training / wildfire | 60,837 | 43,205 | 14,082 | 3,086 | 464 | 97 | 3.1% |
| Training / sea-ice | 60,837 | 53,257 | 2,769 | 2,974 | 1,837 | 98 | 1.3% |
| Standard / wildfire | 30,211 | 23,611 | 4,890 | 1,671 | 39 | 94 | 5.5% |
| Standard / sea-ice | 30,211 | 27,590 | 626 | 1,995 | **0** | **89** | 1.9% |
| Expert / wildfire | 22,496 | 17,332 | 4,064 | 1,080 | 20 | 92 | 10.6% |
| Expert / sea-ice | 22,496 | 22,258 | 88 | 150 | **0** | **86** | 0.6% |

Good news: a careless design does fail. Most launchable designs score 0★, which meets the checkpoint-5 goal in `SPEC.md`, and no mission ends early under safe choices.

### 2.2 Best always-safe score by orbit (Training / Standard / Expert)

| Objective | LEO | SSO | GEO |
|---|---|---|---|
| Wildfire | 64 / 61 / 60 (never 2★) | **97 / 93 / 91** | 72 / blocked / blocked (heavy rocket only) |
| Sea-ice | 52 / 43 / 39 (never 2★) | **98 / 89 / 86** | 28 / blocked / blocked |

### 2.3 Science ceiling (best part set, ignoring every other limit)

| Objective (target) | LEO | SSO | GEO |
|---|---|---|---|
| Wildfire (180) | 72.9 | **172.8** | 131.9 |
| Sea-ice (200) | 48.3 | 365.2 | 0 |

### 2.4 Named strategies

Each cell gives the always-safe score, then the limiting factor, then [worst–best] over all choice sequences when the choices made any difference.

| Objective | Strategy | Orbit / launcher | Training | Standard | Expert | Cost, mass, preview |
|---|---|---|---|---|---|---|
| wildfire | Minimalist (thermal, cheapest of everything, LEO) | leo/rideshare | 40 (0★) data | 37 (0★) data [37–38] | 37 (0★) data [31–37] | $3.27M, 24.7 kg, 0.2 |
| wildfire | The spec's 2★ recipe (thermal + S-band) | sso/rideshare | 77 (2★) design [77–83] | 79 (2★) design [76–79] | 71 (2★) design [62–73] | $3.94M, 35.0 kg, 129.6 |
| wildfire | Optimiser's pick: thermal + camera + X-band + ion | sso/rideshare | 95 (3★) design **[37–95]** | 92 (3★) [88–92] | 86 (2★) event [30–91] | $5.36M, 41.4 kg, 172.8 |
| wildfire | Bunker: optimiser + spare rad-tol computer + both radios | sso/rideshare | 97 (3★) [93–97] | 88 (2★) [85–90] | 87 (2★) [85–88] | $5.84M, 43.5 kg, 172.8 |
| wildfire | GEO stare (the spec's "real choice") | geo/heavy | 72 (2★) [70–72] | blocked: budget | blocked: budget | $74.76M, 41.4 kg, 131.9 |
| wildfire | Camera trap (camera only) | sso/rideshare | 54 (1★) | 51 (1★) | 50 (1★) | $2.86M, 23.4 kg, 43.2 |
| wildfire | Kitchen sink (all 15 parts) | sso/small | 69 (1★) power | blocked: budget | blocked: budget | $21.6M, 116 kg, 96.6 |
| sea-ice | The spec's walkthrough design | sso/small | 97 (3★) none | 88 (2★) none | blocked: budget ($16.11M > $16M) | $16.11M, 73.8 kg, 345.6 |
| sea-ice | Optimiser's pick: **no battery**, ion thruster | sso/small | 97 (3★) none [97–98] | 88 (2★) [88–89] | 86 (2★) [67–86] | $15.26M, 56.9 kg, 222.2 |
| sea-ice | Camera trap (camera only) | sso/rideshare | 53 (1★) | 51 (1★) | 49 (0★) | $2.86M, 23.4 kg, 43.3 |
| sea-ice | Radar in LEO (the LEO blurb says "never over the poles") | leo/small | 52 (1★) data | 42 (0★) | 38 (0★) | $14.64M, 59.4 kg, 48.2 |
| sea-ice | Radar + camera | sso/small | 92 (3★) **power** | 81 (2★) power | blocked: budget | $16.81M, 76.5 kg, 189 |
| sea-ice | **Kitchen sink (all 15 parts)** | sso/small | **91 (3★)** power [91–96] | blocked: budget | blocked: budget | $21.6M, 116 kg, 217.4 |
| sea-ice | Kitchen sink on the medium-lift rocket | sso/heavy | 86 (2★) none | blocked | blocked | $83.85M, 116 kg, 217.4 |

**All 15 parts on board** (`probes.js` §1): only the rideshare blocks it (mass, 116 kg vs 50 kg), along with the small rocket to GEO (it can't reach) and the Standard and Expert budgets ($21.6M). On Training it launches in every other combination, and **sea-ice SSO on the small rocket gets 3★ (91 safe, 96 risky)**, even though it is power-limited and short of the target. A kitchen-sink build should not earn 3★.

---

## 3. Findings in detail

### 3.1 Balance

**B1. The wildfire target is unreachable (P0).** The ceiling is SSO 172.8 with thermal + camera + battery + X-band. No design can reach 180, so the `none` debrief ("target reached") never appears for wildfire in any of the 113,544 launchable wildfire designs. The best designs get the `design` result with the suggestion "Try an orbit that suits the objective better", even though they are already on the best orbit.

- *Fix (data owner):* set `science_target` to about 160, or raise `orbit_fit.sso` from 0.5 to about 0.55, or raise thermal `science` from 6 to 7. Then rerun `sweep.js` and confirm that `none` appears and that the best design lands around 105–110% of the target.

**B2. SSO wins both objectives (P1).** LEO never reaches 2★ for either objective. LEO's 24-month lifetime, against 48 for SSO, and its 2.5% contact time outweigh its sharper images and free launch. GEO wildfire tops out at 72 and needs the $69.75M rocket, so only Training can afford it.

- *Fix ideas:*
  - Give LEO a 36-month lifetime, or raise its `science_mult` to 1.2 to reflect the sharper view.
  - For wildfire, raise `orbit_fit.leo` to about 0.8. The data comment itself says LEO "drifts through all hours", which catches the afternoon fire peak.
  - Give GEO a timeliness bonus (see N5) rather than more raw science.

**B3. Sea-ice can't reach 3★ on Standard or Expert (P0 for progression).** The cheapest radar build costs $15.26M: the radar needs the $7.5M small rocket, because it can't fit on the 50 kg rideshare. The budget points are `15 × unspent share`, so Standard gives only 3.6 of them and Expert 0.7, which caps the scores at 89 and 86. Wildfire's $5.36M build keeps 10–14 budget points on every tier. The difficulty therefore depends on the objective, not the tier.

- *Fix:* score the budget like the margins, with full 15 points at 10% or more unspent and a linear scale below that. Or raise Standard and Expert budgets to about 22 and 18. Also, the spec's walkthrough design ($16.11M) is blocked on Expert by $0.11M. That's fine if intended, but the tier comment says a radar "just fits".

**B4. 3★ without reaching the science target (P1).** Every 3★ wildfire design (464 on Training) and 331 sea-ice designs get 3★ below target. A zero-science design still scores up to 40. *Fix:* gate 3★ on `science >= science_target`, or move points from budget to science.

**B5. Event choices are nearly decorative (P1).**

- Choices change nothing at all in 12–78% of designs, and change the star rating in 0.6–10.6%.
- Science is capped at 100% of target in the score, so once a design overshoots, every `lose_months` or `science_mult` option is free. In the demo (`probes.js` §9) I took six science-losing options and still scored 97/3★.
- A protecting part makes the risky option strictly better (`riskiest` cancels its penalty), so the decision disappears.
- The swing is lopsided: on Training the optimiser's wildfire build goes from 95 to **37** if you pick "Keep observing" in the single solar storm with only one computer. That is one click with no odds shown.

*Fixes:* see N3 (over-target bonus) and N6 (show the odds). Also make lost months and extra costs count against the score even above target.

**B6. The battery cliff (P1).** At `game.js:244`, `powerShare` is either 1 or `1 − eclipseFraction`. There is only one battery (560 Wh), which sets a hard ceiling on draw: **282 W in LEO, 286 W in SSO, 145 W in GEO**.

- The spec's sea-ice design draws 285.4 W, 0.6 W under the SSO ceiling. Adding the 1.3 W rad-tol computer drops its preview from 345.6 to **222.2**.
- The battery is optional for sea-ice 3★: the top design has none, and the `battery` warning appears on 1,757 of 1,837 Training sea-ice 3★ designs.
- Every radar design with a second instrument is power-limited for good, yet the debrief tells it to "Add a battery".

*Fix:* make it proportional, `powerShare = 1 − f × max(0, 1 − battery / need)`, and add a large battery part. Adding a part is a data change and needs the data owner. Battery need also counts the ion thruster's 70 W as continuous, which is debatable.

**B7. Dominated parts (P2).**

- `obc-payload` (1.325 kg, $0.2M, 4 W) does nothing that `obc-basic` (0.1 kg, $0.01M, 0.4 W) doesn't, because `storage_gb` is never read.
- `prop-ion` gives 31.7 kN·s against 12.0 for the large green pack, at 2.9 kg vs 14.7 and $0.8M vs $1.5M. The only cost is 70 W against 50 W. In the top 200 designs it shows up 68–95% of the time; the green packs are mostly filler.
- `radio-uhf` returns 0.01–0.03 GB/day after contact time in LEO and SSO, which is meaningless as a radio, but it is the cheapest way to reroll the seed (L9).
- Small and large solar panels cost the same per watt. The large one is simply better per kilogram, which is fine.

*Fixes:* see N1 (storage) and N2 (only impulsive thrusters can dodge debris).

**B8. GEO eclipse model (P3).** The worst-case eclipse is applied on every orbit. In reality GEO is in shadow only on about 90 days a year near the equinoxes. The impact is small: science ×0.952, plus the 145 W battery ceiling.

### 3.2 Logic bugs

**L1. The mission shares the design object (P0).** `startMission` stores `design: design` (`mission.js:68`). `stepMonth` reads `scienceRate(mission.design)` every month, and `getDebrief` recomputes totals from it.

- Repro (`probes.js` §2): a weak LEO wildfire build scores 39 (0★) honestly. I added thermal, X-band, battery and a large panel after month 1, then removed them before the debrief: **50 (1★)**. The launch checks never ran on the parts that actually flew.
- Changing the launcher after the flight changed the Expert score from 86 to 85.
- The spec's Debrief has a **Redesign** button that returns to Build "with the same design". Any later `getDebrief` or `recordResult` call on the old mission will report the new design.
- *Fix:* `design: JSON.parse(JSON.stringify(design))` in `startMission`, or freeze a copy there.

**L2. Power generation is never re-checked in flight (P1).** `scienceRate` uses only battery and draw. `missingRequired` counts the battery as a "power" part.

- Breaking the only solar panel while a battery survives leaves science at 7.200/month, unchanged.
- With two panels drawing 285 W, losing the large panel leaves 183 W generated and still no penalty.
- *Fix:* in `scienceRate`, compute `gen` from the working parts. If `draw > gen`, scale science by `gen / draw` or switch instruments off. In `missingRequired`, require a working generator, not just any power part.

**L3. Misleading `protected` flag (P1).** `protected: prot` is set whenever a guarding part is aboard, whichever option was picked. With a thruster on board, the debris safe option charges $0.3M and still returns `protected: true`, and the spec tells the UI to say "A part on board protected you". *Fix:* `protected: !!(prot && effect.fail_chance)`.

**L4. `recordResult` doesn't check that the mission ended (P2).** At month 30 of 48 it returned 3★ and `unlocked: "standard"`. *Fix:* return null unless `mission.ended`, and set a `mission.recorded` flag so it can't be counted twice.

**L5. Input validation (P2).**

- `startMission(newDesign())`, with no orbit and no parts, runs 12 months and scores 25.
- `newDesign("nonsense")` gives `getTier` null, so the budget blocker is skipped (`game.js:302`), the budget margin is null and one event is scheduled.
- `chooseEvent(m, 7)` falls back to option 0 but records `choice: 7`.
- *Fixes:* `startMission` should return null when `runChecks(design).blockers.length` is nonzero, `newDesign` should default unknown tiers to `training`, and `chooseEvent` should clamp the index before recording it.

**L6. Debrief advice can't always be acted on (P2).** Counts are from Training:

| Limiting factor | Advice given | Wrong when | Designs |
|---|---|---|---|
| `power` | "Add a battery big enough…" | the only battery is already fitted | 2,060 of 15,354 |
| `data` | "Fit a faster radio, such as X-band, or…" | X-band is already fitted | 25,622 of 63,579 (the orbit half of the advice still holds) |
| `design` (no missing tag) | "Try an orbit that suits the objective better" | already on SSO, the best orbit (every top wildfire build) | all top wildfire |
| `design` (sea-ice GEO, `orbit_fit` 0) | "Add the optical camera as well" | nothing on GEO can see the Arctic; the advice should name the orbit | 6,353 GEO sea-ice designs end on `design`. Only radar + camera with no thermal is told to change orbit; radar-only is told to add a camera, camera-only to add radar, and anything with thermal gets "some instruments earned nothing" |

There's also awkward real-world text for zero months mapped: "mapped the ice in 0 of 60 months, but none in the 3 months of polar night". *Fix:* check `orbit_fit === 0` first, and make each suggestion depend on what's actually fitted (for example, "your battery is the largest available; cut the draw instead").

**L7. LEO sea-ice contradicts its own data (P2).** The LEO blurb and the `earth.js` comment say a 45° LEO "never flies over the poles", yet `orbit_fit.leo` is 0.3. The debrief then says a LEO radar "mapped the ice in 23 of 24 months, including 6 months of polar night". *Fix (data owner):* `orbit_fit.leo: 0`, or reword the blurb to cover a high-inclination LEO.

**L8. The fire count ignores the instrument (P3).** `tallyRealWorld` scales fires reported by data and power quality only. A camera-only satellite "reports" fires at the same rate per returned GB as a thermal imager, even though it only counts half for science and can't see through smoke or at night. *Fix:* weight the tally by the instrument's match (`match`, 1 or 0.5).

**L9. The seed can be rerolled, and outcomes are known in advance (P3).** The seed hashes tier, objective, orbit, launcher and parts, so adding a 0.1 kg, $0.01M UHF radio gives a completely different event schedule (`probes.js` §6). The measured impact is small: the star rating changes in 0.2–4.8% of designs. The bigger problem is that fail rolls are deterministic too. One replay tells the player exactly which risky choices will succeed, so the "risk" can be learned and the lesson about risk is lost. *Fix:* keep the event schedule seeded by the design, but seed the fail rolls with `design seed + attempt counter`.

**L10. Minor items.**

- `budget-cut` "Find the money elsewhere" can push spending over the tier budget after launch. It's harmless, because the budget share is clamped to 0.
- The Training tier has only one event, so the whole risk lesson rests on one click.

### 3.3 What already works well

- The formulas match the spec's sea-ice walkthrough table exactly (74 kg, 265/365 W, 346 science, $16.1M).
- Every blocker fires as specified. I found no way to launch past a blocker through the public API, apart from the unknown-tier hole (L5).
- The seeded simulation is fully deterministic, and the outcome doesn't depend on part order (the parts are sorted before hashing).
- `stepMonth` after the end is safe and doesn't advance. `chooseEvent` with nothing pending returns null.
- Real-data integration: the sea-ice polar-night logic correctly zeroes the camera in dark months, and radar keeps working.
- Spare parts cancel failures in a realistic way: a second computer survives a computer failure. That's a good lesson, so keep it.

---

## 4. Suggested fixes, in priority order

Respect `CLAUDE.md`: `js/game.js` is owned by Rules, `js/mission.js` by Simulation, and `data/*` by Data. New or renamed data fields need the data owner's approval. All three back-end roles are currently held by Yareem.

1. **Copy the design in `startMission`** (L1). One line.
2. **Make the wildfire target reachable** (B1). Data change, then rerun the sweep.
3. **Rescore the budget** so sea-ice 3★ is possible on every tier (B3): full points at a margin of 10% or more.
4. **Gate 3★ on reaching the target** (B4), or reweight science.
5. **Fix in-flight power** (L2) and **make the battery proportional** (B6).
6. **Report `protected` only when it applied** (L3).
7. **Make the debrief advice depend on what's fitted** (L6).
8. **Guard `recordResult`, `startMission`, `newDesign` and `chooseEvent`** (L4, L5).
9. **Rebalance the orbits** so LEO and GEO can win something (B2). Data tuning.
10. **Make the events matter** (B5): a bonus for science over the target, and costs that always count.
11. **Separate the fail-roll seed from the design seed** (L9).

Add these regression assertions to `tests/simulate.js` (owned by QA). `tests/redteam/sweep.js` already computes everything they need:

- Every objective has at least one design reaching `science_target`.
- Every tier × objective has a 3★ design.
- No 3★ design is below target, if B4 is adopted.
- Each orbit wins at least one objective × tier, if B2 is adopted.
- `getDebrief(...).suggestion` never recommends a part that is already fitted.
- `startMission` returns a mission whose `design` is not `===` the input.

---

## 5. New game elements worth considering

Ranked by teaching value against build cost. All of them fit the spec's "numbers in data, logic in game.js" model. The ones that need new data fields need the data owner's approval.

- **N1. Store-and-forward data:** use `storage_gb`. Data not sent down today queues up to the storage limit and goes down on later passes. This makes the payload computer meaningful, rescues LEO, and teaches a real design driver: storage against downlink.
- **N2. Only impulsive thrusters can dodge debris:** green packs protect against `debris`; the ion thruster doesn't, because its thrust is too low to dodge in time. That's real physics, and it ends the ion thruster's dominance with no new fields: just edit its `protects` list.
- **N3. Bonus for science over the target**, up to 110–120%. Overbuilding stops being wasted, and science-losing choices cost something again.
- **N4. A larger battery part, or allow two batteries**, plus a proportional eclipse model, so radar plus a second instrument is a solvable puzzle.
- **N5. Detection-latency score for wildfire:** GEO sees a new fire within minutes, while LEO and SSO need hours between passes. Report "median time to detect" from real FIRMS timing. This makes GEO the spec's "real choice" and strengthens the NASA-data story for judging.
- **N6. Show the odds on each event:** "40% chance (60% with thin margins) of losing a computer", and in the debrief, "replay this mission 100 times" (Monte Carlo) to show the spread. This teaches risk properly and fixes the problem that seeded outcomes can be known in advance (L9).
- **N7. Ground-station choice:** a mid-latitude station against a polar station such as Svalbard, at extra cost, sets `downlink_mult`. It's a cheap new lever, and real missions make exactly this trade.
- **N8. Ageing:** solar panels lose about 2.5% a year, so power margins matter on 48- and 60-month missions. Ties into the margins lesson.
- **N9. Mission extension from spare Δv:** leftover fuel adds months of life, which rewards propulsion margin instead of making it dead weight.
- **N10. Cloud cover from NASA MODIS** for the optical camera, as monthly cloud fraction over boreal forests and the Arctic. More NASA data, and a real reason the camera is "the tempting wrong choice".
- **N11. Insurance as an event-phase option:** pay before launch to refund lost months. It teaches risk transfer.

---

## 6. Reproducing this

See `README.md` in this folder for the full instructions. In short, with Node 18 or later, from the repo root:

```bash
node tests/redteam/probes.js          # exploits and edge cases (seconds)
node tests/redteam/strategies.js      # named strategies × tiers (seconds)
node tests/redteam/sweep.js training  # also: standard, expert (about 1–2 minutes each; the three can run in parallel)
node --max-old-space-size=4096 tests/redteam/analyze.js training   # needs the matching sweep-*.json
node --max-old-space-size=4096 tests/redteam/advice.js             # needs all three sweep files
```

`lib.js` exposes `design(tier, objective, orbit, launcher, parts)`, `play(design, policy | choiceArray)`, `bestPlay(design)`, `SAFE` and `RISKY`, which are handy for checking any fix.
