# HANDOFF.md: back end to Design screens

From Rules, Simulation and Data (Yareem) to Design screens (Angad), November 14, 2026.
`SPEC.md` is still the source of truth; this file only says what changed in the back end since 0.5 beta and what the screens need to do with it, in priority order. Every function named here is in `SPEC.md` ("Functions the front end may call") with its full return shape, and `node tests/api.js` checks the code against that list.

**Rules that still hold:** the front end never does maths (every number comes from a call); `js/game.js` and `js/mission.js` never touch the page; add a line to `CHANGELOG.md` "Unreleased" with every merge that changes what a player sees.

---

## Priority 1: small fixes that judges would notice (about an hour)

| What | Where | Why (judging criterion) |
| --- | --- | --- |
| Say **"fire detections"**, not "fires burned": a MODIS count is one hot pixel on one pass, not one fire. | `js/ui-mission.js`, `realEarthText` | Validity: an overclaim a scientist judge would catch. |
| Debrief heading: use **`d.limiting_name`** ("Power limited this mission") instead of the local `LIMIT_NAMES`. The names are NASA Goddard Mission Design Lab disciplines. | `js/ui-mission.js`, debrief | Relevance: uses a challenge resource visibly. |
| Debrief: show **`d.segments`**, four short lines (launch, space, ground, user segments, from NASA's *Design and Develop Science Missions*). | `js/ui-mission.js`, debrief | Relevance, Presentation. |
| Readiness review: one line **"Time: `getTotals(d).dev_months` months to build"**. | `js/ui-design.js` | The challenge names development time as a resource. |

## Priority 2: structure and attitude bins (the switch-over)

- Replace the hard-coded `CATEGORIES` in `ui-design.js` with **`getCategories()`**: seven bins in order (structure, instrument, power, comms, computer, attitude, propulsion), each with `name`, `sub` and `required`.
- In the **same change**, set `NEW_CATEGORIES_REQUIRED = true` at the top of `js/game.js` (the one line you may edit there; agreed with Rules). From then on every satellite needs a body and an attitude part, and `tests/api.js` already checks the game works that way.
- **Body card:** `getTotals(d).body` gives `{ name, payload_kg, payload_used_kg, slots: { category: { used, max } } }`. Show a payload bar and "2 / 3" slot counts on each bin. New readiness ids: `body-count`, `body-payload`, `body-slots`, `smear-<partId>` (a spinning satellite smears cameras), `too-late` (campaign only). All have hints in `data/hints.js`, and the existing "Fix" links can send all of them to Build.
- **Satellite drawing:** the body could set the drawing's outline (cylinder, drum, box, CubeSat). Nice to have.

*Why:* the challenge names structure and attitude control as spacecraft components (Relevance), and bodies with slots make "every decision has a consequence" visible (Impact).

## Priority 3: eras on tier select (the cheapest big win for replayability)

- **`getEras()`** returns four eras: 1958 International Geophysical Year, 1964 Nimbus, 1999 Earth Observing System, 2026 New Space. Each has `name`, `year`, `blurb`, `real_missions` (ids in `data/missions.js`), `unlocked`, `best_stars` and `topics`.
- Tier select becomes a grid: **era across, tier (maturity level) down**. Locked eras show "Earn 2 stars in the previous era".
- Starting a mission: `design = newDesign(tierId); setEra(design, eraId);`.
- **Greying out:** `getAvailability(design)` gives every part, rocket and topic `{ available, year, reason }`. Grey out a card when `available` is false and print `reason` ("Arrives in 1964"). One call per screen refresh.
- After a mission, `recordResult(m).era_unlocked` is the id of an era it just opened (or null): show a banner.
- Leaving `setEra` out keeps today's behaviour (everything available), so this can ship in steps.

*Why:* the challenge asks for "different difficulty levels, mission types, or scenarios" and "simple and advanced components depending on the difficulty level" (Relevance). Each era is a new puzzle on the same screens (Impact, Creativity), and a demo that opens with Explorer 1 in 1958 and ends in 2026 tells its own story (Presentation).

## Priority 4: campaign hub and research tree (the reusable tree component)

The whole campaign already runs in the back end; it needs two screens.

- **Hub:** `getHubInfo()` gives `year`, `treasury_musd`, `lessons` (best practices shown in flight), `topics` (knowledge bar, next payout, `locked_reason`), `research` and `missions`. Start a flight with `design = newCampaignDesign()` (not `newDesign`); the cost leaves the treasury at launch. Save codes: `exportSave()` and `importSave(code)`.
- **Research tree:** `getResearchTree()` gives `{ nodes, edges }`. Nodes: `id, name, year, depth, cost_musd, blurb, unlocks_names, owned, can_buy, missing`. Edges: `{ from, to }`. Put each node in a column by `depth` (0 to 6), or along a timeline by `year`; draw the edges; buy with `buyResearch(id)` (`{ ok, reason }`). `missing` is plain English ("Show in flight: flew with 10% mass and power margins.").
- **Reusable library:** keep the component generic: it only needs `nodes` with `id`, `depth` or `year`, a label, a state (owned / can buy / locked) and a tooltip, plus `edges`. The same component can draw the era ladder or a body ladder later.
- Debrief in a campaign: also show `payout_musd`, `knowledge_before` to `knowledge_after`, `knowledge_paragraph`, `best_next_topic`; the button returns to the hub.

*Why:* a persistent economy that rewards new knowledge over repetition, and research gated by best practice, is the most original part of the game (Creativity) and its main source of replay (Impact). It is also the largest screen job, so it comes after eras.

---

## Check before every merge

```bash
node tests/api.js
```

The contract test: every function and field the screens use. Also `node tests/formulas.js`, `node tests/campaign.js`, `node tests/balance.js` and `node tests/speed.js`; all pass on `main` today. If a number you need is missing, file a GitHub issue to Rules or Simulation rather than computing it on screen.

---

## Priority 5 (0.7): the lab, the archive and the ionosphere (November 14, evening)

Back end is on `main`; `SPEC.md` "The lab, the archive and open choices" has the design.

- **Lab screen** (reached from the hub): two tabs.
  - **Research (add):** the existing tree. Nodes now carry `cost_sci` next to `cost_musd`; show both ("$4M · 30 science"). `missing` can now say "Needs 30 science points (you have 12)."
  - **Upgrades (replace):** `getLab()` → `{ science_pts, treasury_musd, archive_sci_per_year, upgrades: [{ id, name, of, of_name, year, cost_musd, cost_sci, owned, can_buy, missing, gains, blurb }] }`. One card per upgrade, drawn as "predecessor → successor" (the tree component works: an edge from `of` to `id`). `gains` are ready-made lines ("Science 4 to 6 (better)", "Shrugs off: ..."). Buy with `buyUpgrade(id)` → `{ ok, reason }`.
- **Hub:** show `science_pts` next to the treasury, and "Archive: +N science a year" from `archive_sci_per_year`. After a campaign mission, `recordResult` adds `science_pts_earned`, `archive_sci` and `science_pts`.
- **Build screen:** a replaced part greys out with `reason` "Replaced by …"; an upgrade not yet bought shows "Upgrade in the lab, from …". Nothing else changes: `getAvailability` already carries it.
- **New topic `ionosphere`** (Alouette 1, Canada): it works with the existing screens. `stepMonth().real` can now be `{ soundings, year }` ("Alouette heard 18,000 soundings this month"); the debrief's `real_world.text` already explains the ground stations.
- **Research hints:** on Trade Space and Point Design, `missing` holds a hint instead of the exact lesson. Nothing to change on screen.
