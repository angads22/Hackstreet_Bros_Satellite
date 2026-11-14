# story_change.md: space-race campaign

**Audience:** the main Claude Code session. Read `SPEC.md` and `CLAUDE.md` first.
**Author of the request:** the data person (Yareem). Every new data field named in this file is **approved by the data person** as of this document, so the "ask before adding fields" rule is satisfied for exactly the fields listed here and no others.
**Status:** a proposal for the main session to implement, in small tasks, in the order given under "Phases". Nothing here has been built.
**Rule reminder:** the change to `SPEC.md` (section "What changes in SPEC.md") goes to `main` immediately, in its own commit, before any code.

---

## 1. The story and the loop change

**Story:** you are an engineer in the first space race. Nobody has told you what to measure. You work out the missions yourself: what is worth learning, what to build to learn it, and which rocket can carry it. Money and knowledge carry from one satellite to the next.

**Loop today:** one mission per run. Objective, orbit, build, launch, debrief, and then the budget resets from the tier.

**Loop proposed:** the player runs a **campaign**. Each mission is the same seven screens, but they sit inside a persistent game state:

```
Campaign hub  ->  1 Briefing (pick a topic)  ->  2 Orbit  ->  3 Build  ->  4 Launch vehicle
              ->  5 Readiness  ->  6 Mission  ->  7 Debrief (payout)  ->  back to the Campaign hub
```

What persists between missions:

1. **Treasury** (money). Missions spend it at launch and earn it back as a payout.
2. **Knowledge per topic** (data). A ledger of how much the player already knows about each topic.
3. **Unlocks** (parts, launchers, topics) bought with money through a small research list.
4. **The year.** Each mission moves the calendar on, so the story has a clock.

**The economic rule you asked for:** repeating a topic pays less each time, because the payout is for **new** knowledge. Sometimes the best move is a fresh topic rather than a better satellite for the same one.

---

## 2. The payout formula (the heart of the change)

Each topic has a knowledge curve that saturates:

```
knowledge(S) = 1 - exp(-S / knowledge_scale)        S = total science returned on this topic so far
payout       = value_musd * ( knowledge(S_after) - knowledge(S_before) )
payout       = max(payout, repeat_floor_musd)       a small floor so repetition never pays exactly zero
```

`S` is the science the mission actually returned (`mission.science`), not the preview. A mission that ends early still banks the science gathered so far.

**Worked example** (placeholder numbers, to be tuned by simulation): wildfire has `value_musd: 20`, `knowledge_scale: 300`. A design that returns 150 science each time:

| Mission | S before | S after | Knowledge gained | Payout |
| --- | --- | --- | --- | --- |
| 1 | 0 | 150 | 0.393 | $7.9M |
| 2 | 150 | 300 | 0.239 | $4.8M |
| 3 | 300 | 450 | 0.145 | $2.9M |
| 4 | 450 | 600 | 0.088 | $1.8M |

Sea ice (`value_musd: 60`, `knowledge_scale: 300`) returning 150 pays $23.6M on its first mission, so after a second wildfire mission the player should switch topic. A **better** satellite on the same topic still earns more than a repeat of the old one, because it adds more science, but each extra point is worth less than the last. That is the "improve the data pull or go somewhere new" trade-off.

The debrief and the Campaign hub must show this clearly (see section 6).

---

## 3. Data changes (all approved)

### 3.1 New file: `data/campaign.js` (one global, `CAMPAIGN`)

Loaded with a plain script tag in `index.html`, after `objectives.js`. Owned by Data.

```js
const CAMPAIGN = {
  start_year: 1957,           // calendar shown on the hub
  years_per_mission: 1,       // the year advances by this after each recorded mission
  end_year: 1969,             // the campaign ends here, or earlier on a win
  repeat_floor_musd: 0.3,     // minimum payout for any finished mission
  win: { topics_known: 3, knowledge: 0.6 },   // win when this many topics reach this knowledge share
  grant_musd: 4,              // annual agency grant added to the treasury per mission (anti soft-lock)
  save_version: 1             // bump when the saved shape changes; an old save is discarded
};
```

All values are placeholders marked as game values.

### 3.2 New fields on every record in `data/objectives.js`

| Field | Type | Meaning |
| --- | --- | --- |
| `value_musd` | number | Total money for knowing the topic completely. Feeds the payout formula. |
| `knowledge_scale` | number | Science points at which the player knows about 63% of the topic. |
| `requires_research` | string or `null` | Research id that must be bought before this topic is offered. `null` = available from the start. |

Existing fields (`science_target`, `orbit_fit`, `wants`, `needs_resolution_m`, `real_mission`) stay unchanged. `science_target` keeps its meaning: it is the per-mission star target. It is **not** the knowledge ceiling.

Starting values to tune (cost of the cheapest working design in brackets, from the red-team report):

| Topic | `value_musd` | `knowledge_scale` | Cheapest design |
| --- | --- | --- | --- |
| `wildfire` | 20 | 300 | about $5.4M |
| `sea-ice` | 60 | 300 | about $15.3M |

### 3.3 New file: `data/research.js` (one global, `RESEARCH`)

Owned by Data. This is how parts, launchers and topics unlock **without adding any field to `parts.js` or `launchers.js`**: anything not named in any research record is available from the start.

```js
{
  id: "radar-lab",
  name: "Radar laboratory",
  cost_musd: 6,
  requires: [],                   // research ids that must be bought first
  unlocks: { parts: ["radar-sar"], launchers: [], objectives: ["sea-ice"] },
  blurb: "One line the hub shows."
}
```

Six to eight records is enough. Suggested shape: a cheap tier that opens the first radio and a second instrument, a middle tier for larger rockets and the radar, and an upper tier for high orbits.

**Open check for the data person:** the unlock lists reference ids in `parts.js`, `launchers.js` and `objectives.js`. The tests (section 7) must fail if an id does not exist.

### 3.4 New field on every record in `data/tiers.js`

| Field | Type | Meaning |
| --- | --- | --- |
| `grant_musd` | number | Per-mission agency grant for this tier. Overrides `CAMPAIGN.grant_musd` if present. Optional. |

`budget_musd` is **reused unchanged** as the **starting treasury** of a new campaign on that tier. `events`, `hints` and the unlock rule for tiers stay as they are. Tiers now mean "campaign difficulty", chosen when a campaign starts.

### 3.5 Additions to `data/debrief.js`

Two new keys, each one short paragraph. Story writes the text; the keys are fixed here.

| Key | Used when |
| --- | --- |
| `saturated` | The mission's knowledge gain was under 15% of what a first mission on the topic would have earned. Explains diminishing returns and points at a fresh topic. |
| `breakthrough` | The mission's knowledge gain was over 60% (a first look at a new topic). |

The existing seven keys are unchanged.

### 3.6 Optional field on `data/events.js`

| Field | Type | Meaning |
| --- | --- | --- |
| `objectives` | array of ids, optional | If present, the event can fire only on a mission with one of these topics. Missing = any topic. |

This is only needed for topic-specific events. Skip it in Phase 0 and 1.

### 3.7 New content, later phase (data only, no new fields)

The space-race theme needs more topics than two. These are content records, added in the existing formats:

- **New objectives**: for example radiation belts, upper-atmosphere density, a first weather picture, and a beacon/time-signal topic. Each needs `value_musd`, `knowledge_scale`, `requires_research`, an `orbit_fit` and a `real_mission` (Explorer 1, Sputnik, Vanguard 1, TIROS-1 are the natural cousins).
- **New parts** with checked sources: a Geiger counter, a simple beacon transmitter, early silicon solar cells and similar. Every value needs a link a human opened (CubeSat 101 does not cover them).
- **Real NASA data for each new topic** in `data/earth.js`, to keep Relevance high. If no clean public data set can be found in time, mark the topic's numbers as game values rather than inventing a source.
- Two or three era events (a rival's launch, a pad failure, a budget cut).

This is the most expensive part of the story and the part most likely to miss the deadline. See "Phases".

---

## 4. Back-end changes (`js/game.js` and `js/mission.js`)

`js/game.js` still never touches the page. All new functions go through the same front end / back end contract: the screens call them and display what comes back, and never do the maths.

### 4.1 Campaign state (new, in `js/mission.js` beside the progress code)

Saved in `localStorage` under its own key (like `getProgress`), with an in-memory fallback, wrapped in try/catch, and discarded if `save_version` does not match `CAMPAIGN.save_version`.

```js
{
  tier: "training",
  year: 1957,
  treasury_musd: 90,
  knowledge_science: { wildfire: 0, "sea-ice": 0 },   // S per topic
  research: [],                                        // bought research ids
  missions: [ { id, year, objective, orbit, spent_musd, science, payout_musd, stars } ],
  finished: false, won: false
}
```

### 4.2 New functions

```js
// js/mission.js
newCampaign(tierId)         // starts and saves a campaign; treasury = tier.budget_musd; replaces any save
getCampaign()               // the saved state, or null
resetCampaign()
getHubInfo()                // { year, treasury_musd, topics: [{ id, name, available, knowledge (0..1), science_so_far,
                            //   next_payout_estimate_musd, locked_reason }], research: [{ id, name, cost_musd, owned,
                            //   affordable, requires_met, blurb }], can_afford_cheapest_design, finished, won }
buyResearch(id)             // spends money, records the unlock; returns { ok, reason }
isPartAvailable(partId)     // false only if a research record unlocks it and it is not owned
isLauncherAvailable(id)
isObjectiveAvailable(id)
previewPayout(design)       // { expected_payout_musd, knowledge_before, knowledge_after, novelty (gain / first-mission gain),
                            //   cost_musd, net_musd }  uses previewScience(design).total
```

### 4.3 Changes to existing functions

| Function | Change |
| --- | --- |
| `newDesign(tierId)` | In a campaign, the design's budget is the **treasury**, not `tier.budget_musd`. Without a campaign (tests, console) it falls back to the tier. |
| `getTotals(design)` | `budget_musd` and the budget margin read the treasury when a campaign is active. |
| `runChecks(design)` | Add blockers `part-locked`, `launcher-locked` and `objective-locked`. The "budget" blocker compares against the treasury. Keep the existing ids unchanged. |
| `startMission(design)` | **Deduct the design's cost from the treasury at launch** and save. Take a **deep copy** of the design (see 5.1). Store a unique mission `id`. |
| `recordResult(mission)` | **Must be idempotent** (a `paid` flag, so a second call returns the first result and pays nothing). Rejects an unfinished mission. Computes the payout from the formula in section 2, adds `science` to the topic, adds the payout and the grant to the treasury, advances the year, appends to `missions`, and checks the win/loss conditions. Returns the old `{ stars, best_stars, unlocked }` plus `{ payout_musd, knowledge_before, knowledge_after, novelty, treasury_musd, year, campaign_over, won }`. |
| `getDebrief(mission)` | Adds `payout_musd`, `knowledge_before`, `knowledge_after`, `novelty`, `best_next_topic` (an available topic id with the highest `next_payout_estimate_musd`, or `null`), and sets `paragraph` from `saturated` or `breakthrough` when they apply, in addition to the limiting factor text. |
| Scoring | See 5.3. |
| `designSeed(design)` | In a campaign, include the mission number so that repeating an identical design does not replay an identical mission. A design code outside a campaign still replays exactly. **Decision flagged for the data person:** this overrides the SPEC line "the same design always replays the same mission" in campaign mode only. |

### 4.4 End conditions

- **Win:** at least `CAMPAIGN.win.topics_known` topics at `knowledge >= CAMPAIGN.win.knowledge`.
- **Time out:** the year reaches `CAMPAIGN.end_year`.
- **Never soft-locked:** if, after a payout and grant, the treasury cannot afford the cheapest launchable design for any available topic, add an emergency grant that tops it up to that cost and flag `bailout: true` in the result. The debrief says so. Compute the cheapest launchable design in the back end; do not hard-code a number.

---

## 5. Prerequisite bug fixes (from `tests/redteam/REPORT.md`)

The economy sits on top of these. They must be done first, or the money can be exploited.

### 5.1 Snapshot the design at launch (P0, report finding 2)

`startMission` currently keeps a reference to the live `design`. Editing parts after launch changes the running mission and the debrief, which would let a player change what they paid for after the money has left the treasury. Deep-copy it.

### 5.2 `recordResult` and the API guards (P1/P2, finding 12)

- Reject unfinished missions and empty designs in `startMission`.
- Reject unknown tier ids rather than skipping the budget blocker.
- Validate `chooseEvent` indexes.
- Fixes `protected: true` being reported when the safe choice was taken (finding 9).

### 5.3 Rescore for the campaign

The "budget left" 15 points make no sense when money carries over and is meant to be spent. Proposed new split (placeholder, for QA to tune):

| Part | Points | How |
| --- | --- | --- |
| Science returned | 50 | Share of `science_target`, as now |
| Efficiency | 15 | `payout / cost`, capped at 1.0 at a ratio of 1.5 |
| Margins | 15 | Unchanged |
| Events | 10 | Unchanged |
| Novelty | 10 | The knowledge gained, as a share of the first-mission gain |

This also removes the cap that stops sea ice reaching 3 stars on Standard and Expert (finding 3). Stars stay at 50, 70 and 90.

`getDebrief().breakdown` gains `efficiency` and `novelty` and loses `budget`. **That is a rename, and the data person approves it here.**

### 5.4 Tune values that block the campaign (data person, after the code)

- Wildfire `science_target` is unreachable at 180 (ceiling 172.8). Set it to about 160.
- Make orbit choice a real one (finding 4): raise `orbit_fit.leo` for wildfire and consider a longer LEO lifetime. A campaign with one solved orbit teaches nothing.
- Fix debrief advice that suggests parts already fitted (finding 10).

---

## 6. What the front end must show (for the Design screens and Story owners)

None of this is maths on the front end. Every number comes from a call above.

- **Campaign hub (new first screen after "New campaign" or "Continue"):**
  - Year and treasury.
  - One card per topic: name, a knowledge bar (`knowledge`), the payout estimate for another mission, and "locked: needs <research>" when unavailable.
  - The research list with cost, an affordable state and a Buy button (`buyResearch`).
  - A button to start a mission (opens Briefing).
  - If `finished`, the ending (won or timed out) with a summary.
- **Briefing:** shows only available topics, with the expected payout from `getHubInfo`, so choosing a topic is an economic choice.
- **Build and Launch vehicle:** locked parts and launchers appear greyed out with "Research needed: <name>". The budget bar's limit is the treasury. A small line from `previewPayout(design)`: "Expected payout $X M, cost $Y M, net $Z M".
- **Debrief:** payout, knowledge before and after as a bar, the novelty figure, the `saturated` or `breakthrough` paragraph, a "try a new topic" line using `best_next_topic`, and a button back to the hub. The existing "Redesign" button stays, but mid-campaign it is labelled "Rebuild this satellite", and costs a fresh launch.
- **Tier select** moves to "New campaign".
- **Step bar:** unchanged for the seven screens. The hub sits outside it.

Say clearly in the pitch and the debrief that **money is spent at launch and a failed mission still banks the science it gathered**. That is the lesson: you are paying to learn.

---

## 7. Tests (Data and Rules own `tests/`; QA runs them)

Add `tests/campaign.js`, runnable with `node tests/campaign.js`, using `tests/load.js`:

1. **Payout curve:** hand-worked values from the table in section 2 match to 0.01.
2. **Diminishing returns:** the same science on the same topic pays strictly less each time; a fresh topic with equal `value_musd` pays more than a third repeat.
3. **Idempotent payout:** `recordResult` twice pays once.
4. **Launch deducts cost, snapshot holds:** editing the design after `startMission` changes neither the mission nor the payout.
5. **No soft lock:** over 200 randomly played campaigns the treasury is never below the cheapest launchable design after a bailout.
6. **Unlock integrity:** every id in `RESEARCH.unlocks` exists in its data file; no part is unlocked by two research records; every `requires` id exists; the research graph has no cycle.
7. **Save round trip:** a save with a wrong `save_version` is discarded, not crashed on.
8. **Existing tests** (`formulas.js`, `simulate.js`, the red-team sweep) still pass with no campaign active.

Re-run `tests/redteam/sweep.js` after the rescoring, and again after tuning, to confirm that 3 stars is reachable on every tier and that star outcomes do not collapse.

---

## 8. What changes in `SPEC.md`

Pushed to `main` first, in its own commit. Sections to change:

- **What we're building / Scenario:** replace "an Earth-observation satellite with three orbit choices" with the space-race campaign, and describe the loop in section 1 above.
- **Game progression:** add the Campaign hub ahead of the seven screens. Tier select becomes "New campaign".
- **Data format:** add `CAMPAIGN`, `RESEARCH`, the three objective fields, the tier field, the two debrief keys and the optional event field, exactly as in section 3.
- **Scoring table:** replace with the table in 5.3.
- **Functions the front end may call:** add the new functions in 4.2 and the changed return shapes in 4.3.
- **Out of scope:** keep "no accounts, no server" (the save is local). Add: "no rival AI and no online leaderboard in the campaign".
- **Judging table:** the Impact and Creativity rows gain "a persistent economy that rewards new knowledge over repetition, which no comparable game does".
- **Team roles / current tasks:** add the tasks in the phases below.

---

## 9. Phases (what to build, in order)

The deadline is Sunday 15 Nov, 11:59 p.m., with a code freeze at 14:00. The seven screens do not exist yet. Build in this order, and stop at the end of whichever phase fits.

**Phase 0: carry-over economy, no new content.** The smallest version that tells the story.
1. Section 5.1 and 5.2 fixes.
2. `data/campaign.js`, the three objective fields, `grant_musd` on tiers.
3. Campaign state, `newCampaign`, `getCampaign`, `getHubInfo` (topics only), payout in `recordResult`, treasury deduction in `startMission`, `previewPayout`.
4. Rescore (5.3) and the tuning in 5.4.
5. `tests/campaign.js`, items 1 to 5, 7 and 8.
6. Debrief fields and the `saturated` and `breakthrough` keys.

Two topics, wildfire and sea ice, are enough to show the rule: after wildfire pays less on its second run, sea ice is the better move.

**Phase 1: research and unlocks.**
`data/research.js`, `buyResearch`, the `is...Available` functions, the three `*-locked` blockers, test item 6, and the research list on the hub.

**Phase 2: space-race content.**
New topics, parts, events and NASA data per section 3.7, plus the `objectives` field on events. This needs sourced numbers, so it is the part to cut first. If cut, the pitch can name it as the roadmap.

Nothing in Phase 1 or 2 should start until the Phase 0 campaign has been played start to finish with real screens.

---

## 10. Open decisions for the data person

1. **Seed in campaigns:** include the mission number (recommended, section 4.3), or keep exact replays?
2. **Does the failed mission keep its science?** Proposed yes (see section 6). Alternative: a failed mission pays a fraction.
3. **One save or several?** Proposed a single save slot.
4. **Time:** is the 1957 to 1969 framing worth the risk that the modern parts, sourced from CubeSat 101, do not fit the era? Recommended: keep the modern parts for Phase 0 and 1, and keep the early-era names and parts for Phase 2 only.
5. **Payout scale:** the numbers in section 3.2 are guesses. A simulation over campaigns should set them so that a competent player ends near break-even on a repeated topic and clearly profitable on a new one.
