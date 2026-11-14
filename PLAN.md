# PLAN.md: back-end plan toward the space-race campaign

**Owner:** Yareem (Data, Rules, Simulation). **Scope:** back end only: `data/`, `js/game.js`, `js/mission.js`, `tests/`.
**Long-term target:** `story_change.md` on branch `yarmee/magical-curie-fkw6xt` (the space-race campaign: money and knowledge carry over, and repeating a topic pays less).
**Inputs folded in:** `tests/redteam/REPORT.md` (red-team findings) and the judging criteria in `SPEC.md`.
**Rule:** `SPEC.md` stays the source of truth. Nothing below is built until its `SPEC.md` change is on `main`, in its own commit.

---

## 0. Guardrails

- **Deadline.** Submission closes Sunday 15 Nov, 11:59 p.m.; code freeze Sunday 14:00. The seven screens do not exist yet.
- **The locally judged build is the final build.** There is no "after the hackathon": everything in this plan (Phases 0, 1 and 2) must be on `main` by the code freeze. AI does the bulk of the work; the timeline in section 8 has cut lines in case something slips.
- **Every step keeps `main` playable.** A campaign is optional: with no campaign active, every existing function behaves exactly as today, so Angad's screens keep working at each commit.
- **Tests gate every push:** `node tests/formulas.js`, `node tests/simulate.js`, the red-team sweep, and the new `tests/campaign.js` once it exists.

## 1. Step 0: update `SPEC.md` first (push to `main` alone)

Per `story_change.md` section 8, covering all three phases:

- *What we're building:* the campaign loop (hub, then the seven screens, then back to the hub).
- *Game progression:* the Campaign hub before Briefing; tier select becomes "New campaign".
- *Data format:* `CAMPAIGN`, `RESEARCH`; `value_musd`, `knowledge_scale` and `requires_research` on objectives; `grant_musd` on tiers; the `saturated` and `breakthrough` debrief keys; the optional `objectives` field on events.
- *Scoring:* the new table (step B3 below).
- *Functions:* the new functions and changed return shapes from Phase C, plus `exportSave` and `importSave`.
- *Out of scope:* no rival AI and no online leaderboard.
- *Judging table:* Impact and Creativity gain "a persistent economy that rewards new knowledge over repetition".

## 2. Phase A: fix what the economy would sit on (red-team prerequisites)

One small commit per item, each with a regression check. No data fields change.

| # | Fix | File | Report ref | Check |
| --- | --- | --- | --- | --- |
| A1 | Deep-copy the design in `startMission`; give each mission a unique `id` | `mission.js` | L1 (P0) | Editing the design after launch changes neither the mission nor the debrief |
| A2 | `protected` is true only when protection cancelled a penalty | `mission.js` | L3 | Safe debris dodge with a thruster reports `protected: false` |
| A3 | Power generation is rechecked in flight: science scales by `gen / draw` when working panels fall short; a required "power" part means a working **generator** | `game.js`, `mission.js` | L2 | Breaking the only panel cuts science |
| A4 | Proportional battery: `powerShare = 1 - f * max(0, 1 - battery / need)` | `game.js` | B6 | Adding a 1.3 W computer no longer costs 36% of science |
| A5 | Guards: `startMission` returns null with blockers; unknown tier ids fall back to `training`; `chooseEvent` clamps the index before recording; `recordResult` rejects an unfinished mission and is idempotent (`paid` flag) | both | L4, L5 | Each case has a test |
| A6 | Debrief advice depends on what is fitted: never suggest a part already on board; name the orbit when `orbit_fit` is 0; "largest battery fitted, cut the draw" when relevant | `mission.js` | L6 | The advice audit (`tests/redteam/advice.js`) finds no impossible advice |
| A7 | The real-world fire tally is weighted by instrument match | `mission.js` | L8 | A camera-only design reports half the fires per GB |

## 3. Phase B: data and scoring for the campaign

**B1. New data (all approved in `story_change.md` section 3):**

- `data/campaign.js` (`CAMPAIGN`), with the `start_year`, `years_per_mission`, `end_year`, `repeat_floor_musd`, `win`, `grant_musd` and `save_version` values from section 3.1.
- On objectives: `value_musd`, `knowledge_scale`, and `requires_research: null`.
- On tiers: optional `grant_musd`.
- In `data/debrief.js`: the `saturated` and `breakthrough` keys (draft text; Story rewrites it).
- A script tag for `campaign.js` in `index.html`, after `objectives.js`. This is a data-owner override, as was done for `earth.js`.

**B2. Value tuning from the red-team report** (approved values to confirm, then verified by the sweep):

- Wildfire `science_target` from 180 to about 160 (finding 1: the ceiling is 172.8).
- Sea-ice `orbit_fit.leo` from 0.3 to 0 (finding L7: matches our own blurb and data).
- Ion thruster `protects` drops `"debris"`, because its thrust is too low to dodge (N2, ends its dominance).
- Orbit choice: test raising wildfire `orbit_fit.leo` toward 0.8 and a 36-month LEO lifetime (finding B2). Keep only what the sweep shows makes LEO win something.

**B3. Rescore** (`story_change.md` 5.3): science 50, efficiency 15 (`payout / cost`, full at 1.5), margins 15, events 10, novelty 10. Stars stay at 50, 70 and 90. Outside a campaign, efficiency and novelty use a first-mission payout, so single missions still score sensibly.
`breakdown` gains `efficiency` and `novelty` and drops `budget` (rename approved in `story_change.md`).

## 4. Phase C: campaign state and functions

**C1. State and save** (`mission.js`, next to the progress code): the state shape in `story_change.md` 4.1, saved in `localStorage` under its own key, with an in-memory fallback, all wrapped in try/catch. A save whose `save_version` does not match `CAMPAIGN.save_version` is discarded.

Saves work like a clicker game: one save per browser, plus export and import codes.

- `exportSave()` returns the whole save, including tier progress, as one text code. That's base64 of JSON with a short checksum; length doesn't matter.
- `importSave(code)` checks the version and checksum, then replaces the save and returns `{ ok, reason }`. A bad code never crashes and never overwrites a good save.

**C2. New functions:**

- `newCampaign(tierId)`: starts and saves a campaign; the treasury starts at the tier's `budget_musd`.
- `getCampaign()`, `resetCampaign()`.
- `getHubInfo()`: topics with their knowledge, payout estimate and `locked_reason`. Research is an empty list until Phase 1.
- `previewPayout(design)`: `{ expected_payout_musd, knowledge_before, knowledge_after, novelty, cost_musd, net_musd }`.

**C3. Changed functions:**

- `getTotals` and `runChecks` read the treasury as the budget while a campaign is active.
- `startMission` deducts the cost and saves.
- `recordResult` pays out with `max(value * (k_after - k_before), floor)`, banks the science, adds the grant, advances the year, appends to the mission history, and checks win and time-out. **A failed mission keeps what it sent home**, as in history: Explorer 1's data survived its dead batteries.
- **Event costs and lost months count against everything they affect** (decision 6). An event's `cost_musd` is taken from the treasury, counts in efficiency's cost, and counts against the event points. Lost months reduce science, the payout, novelty and the event points.
- `getDebrief` adds `payout_musd`, `knowledge_before`, `knowledge_after`, `novelty` and `best_next_topic`, and uses the `saturated` or `breakthrough` paragraph when either applies.

**C4. No soft lock:** after each payout, if the treasury cannot buy the cheapest launchable design for any available topic, top it up to that cost and return `bailout: true`.

- Compute that cheapest design in the back end, once per campaign start.
- Method: for each topic and orbit, take the cheapest part in each required category, plus propulsion only when the orbit needs Δv, plus the cheapest launcher that fits. Then confirm it with `runChecks`. Never hard-code the number.

**C5. Seed in campaigns:** the seed (the number that decides all of a mission's "random" luck) also includes the mission number, so flying the same satellite twice faces fresh luck. Outside a campaign, and from an exported code, the same design still replays exactly. This answers the red-team's L9 without breaking single-mission replays.

## 5. Phase D: prove the balance

- **D1. `tests/campaign.js`**, covering `story_change.md` section 7, items 1–5, 7 and 8:
  - The payout curve matches the worked table.
  - Returns diminish on a repeated topic.
  - The payout is idempotent.
  - The snapshot holds after editing the design.
  - No soft lock across 200 random campaigns.
  - A save round trip works.
  - The old tests still pass.
- **D2. `tests/balance.js`**, from the red-team's assertion list:
  - Every objective has a design that reaches its target.
  - Every tier × objective has a 3★ design.
  - Each orbit wins at least one objective × tier (if B2 tuning holds).
  - No suggestion names a part that is already fitted.
  - `mission.design !== design`.
- **D3. Campaign simulation:** greedy and random players over full campaigns. Tune `value_musd`, `knowledge_scale`, `grant_musd` and `repeat_floor_musd` until three things hold:
  - A repeat of the same topic ends near break-even.
  - A fresh topic is clearly profitable.
  - The campaign is winnable before `end_year` on Training.
- **D4. Text player:** add a campaign mode to `tests/play.js` (working branch only), so the whole loop can be played as printed text before the screens exist.

## 6. Phases 1 and 2, also before the freeze

**Phase E: research and unlocks** (`story_change.md` Phase 1).

- `data/research.js` with 6 to 8 records.
- `buyResearch`, plus `isPartAvailable`, `isLauncherAvailable` and `isObjectiveAvailable`.
- The `part-locked`, `launcher-locked` and `objective-locked` blockers.
- The research list in `getHubInfo`.
- Unlock-integrity tests: every id exists, nothing is unlocked twice, there are no cycles.

**Phase F: space-race content** (`story_change.md` Phase 2). Modern parts stay for now (decision 4).

- **New topics:** radiation belts, upper-atmosphere density, a first weather picture, a beacon or time signal. Each gets `value_musd`, `knowledge_scale`, `requires_research`, `orbit_fit` and `real_mission` (Explorer 1, Sputnik, Vanguard 1, TIROS-1).
- **NASA data per topic** in `earth.js`, to keep Relevance high. If no clean data set turns up in time, those numbers are labelled game values.
- **Era events** (a rival's launch, a pad failure, a budget cut), using the `objectives` field on events.

**Red-team ideas, pulled forward only if time remains, in this order:**

1. Show the odds on event choices. This is cheap, and it fixes "choices barely matter".
2. Store-and-forward using `storage_gb`. This makes low orbit and the payload computer useful.
3. Detection latency for geostationary.

The rest (ground-station choice, ageing, mission extension, cloud cover, insurance) stay in `STRETCH.md`.

## 7. Decisions (answered by the data owner)

1. **Seed in campaigns:** include the mission number. In a campaign, each flight gets fresh luck; outside a campaign, exact replays stay.
2. **Failed missions keep the science they sent home.** That is historically accurate: Explorer 1's data outlived its batteries, while Vanguard TV3, which exploded on the pad, returned nothing.
3. **Saves:** one save per browser, plus long export and import codes, clicker-game style.
4. **Parts:** modern parts while testing.
5. **3★ requires reaching `science_target`.** Accepted.
6. **Event costs and lost months count against everything they affect:** science, treasury, efficiency, novelty and the event points.
7. **Tuning values:** done later, with the sweep and the campaign simulation (Phase D).

## 8. Timeline to the freeze (Sunday 14:00)

Times follow the `SPEC.md` checkpoints. Each line ends with what is pushed to `main`.

| By | Work | On `main` |
| --- | --- | --- |
| Sat evening | Step 0: `SPEC.md` for all phases | Spec, alone |
| Sat evening | Phase A fixes (A1 to A7) | One commit each, tests passing |
| Sat night | B1 data, C1 to C5 campaign and saves, B3 rescore with the 3★ gate | Playable campaign through the console and the text player |
| Sun 10:00 | D1 to D3 tests and tuning (B2 values, payout numbers); Tier 1 is winnable and a careless design fails | Balanced Phase 0 |
| Sun 12:00 | Phase E: research and unlocks | Research on the hub |
| Sun 13:30 | Phase F: as many topics and era events as are ready; then the odds on events if time remains | Content |
| Sun 14:00 | Freeze. Final `SPEC.md` check. Bug fixes only after this point | |

**Cut lines, if something slips:**

1. Drop the red-team extras first.
2. Then trim Phase F to two new topics.
3. Then trim Phase E to three research records.

Phase 0 (A to D) is never cut.

**Coordination with Design screens:** each new function lands in `SPEC.md` before it lands in code, so Angad can build the hub, the payout lines and the research list in parallel.
