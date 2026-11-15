# Gravitron UI review: easy to read, engaging to use

Written November 15, 2026 on branch `yarmee/vibrant-galileo-gw37wj`. **Basis:** the 0.9 build (Part 1 walkthrough, Part 2 comeback), read from the code, from screenshots of the Build, workshop, debrief and hub screens, and from Angad's `words.js` counts. **The 1.0 build (laptop layout pass, rustic 1958 theme, animated text, mission and debrief fixes) is not on any remote yet, so nothing here was checked against it.** Every proposal is written so that it survives a restyle: it names a job for an area of the screen, not a pixel position. Section 8 lists what to re-check on 1.0.

Inputs filled in for the template:

- **Game:** Gravitron, a satellite mission design game (design, launch, learn why). One loop: pick a contract, build a satellite, pick a rocket, pass a readiness review, watch the mission, read the debrief, repeat.
- **Players:** mixed. Judges and teachers (new, 5 to 15 minutes), students (casual), space fans (expert). **Platform:** a browser on a laptop, plus phones. Mouse or touch; no controller.
- **Constraints:** flat look with rounded corners, few words (the team's top complaint), plain HTML/CSS/JS, no gradients or emoji, no game number typed into screen text (every number comes from a back-end call). Elements that must stay: the four resource bars, the readiness verdict, the debrief's "what limited you", the live-data badge.

---

## 1. Inventory and scoring

Estimates are marked `~` and are my judgement from reading the screens, not measurements. "Check" is how often a player looks at it during a typical minute on that screen. Surprisal is the information content of its changes: **L** = changes rarely or predictably, **H** = changes unpredictably and matters. Fitts attention distance is how far the eye travels from the focal point (the satellite on Build, the Earth on Mission) in screen heights: **near** < 0.3, **mid** 0.3 to 0.7, **far** > 0.7. Words are measured (`words.js`, 1280x800).

### Build screen (about 280 words, the busiest screen)

| Element | Says | Changes | Check | Stakes | Surprisal | Where | Diegesis | Input |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Objective line (header) | what to do next | per screen | ~1 time | low | L | top, mid | non-diegetic | none |
| Hint box (dashed) | the same advice, longer | first visit only | ~0 | low | L | top, full width | non-diegetic | button `?` |
| Team speech line | the same advice, in character | per screen | ~1 | low | L | upper | meta (a face and a line) | none |
| Screen title "3 BUILD" | where you are | per screen | ~0 | low | L | upper left | non-diegetic | none |
| Status line (month, cash, debt) | the stakes | per flight | ~1 | **high** | M | top left, small | non-diegetic | none |
| Minimap and MAP [M] | where you are in the base | per screen | ~0 | low | L | top right | spatial | click |
| Parts bins (7) with "Needed / 1 of 2" | the checklist and slot use | per click | ~6 | high | M | left column | non-diegetic | click |
| Satellite on the bench (3D) | what you built | per click | ~4 | high | M | centre top | **diegetic** | none |
| IF YOU CLICK preview | what this part would change | per hover | ~6 | high | H on Easy | centre, under the satellite | non-diegetic | hover or tap |
| Pay line | "Pays $X of $Y, costs, net" | per click | ~3 | **high** | H | centre, small text | non-diegetic | none |
| Part cards (about 8 to 11 per bin, locked ones last) | choices | per bin | ~8 | high | M | centre, lower | non-diegetic | click |
| Four bars (mass, power, budget, data) + body payload bar | resource state | per click | ~5 | high | M | right column | non-diegetic | none |
| Problems list (NO GO, WARN, "Why", FIX) | blockers | per click | ~4 | **high** | H | right, below bars | non-diegetic | click FIX |
| Science preview (number, per-instrument) | the result you are building | per click | ~3 | high | M | right, bottom | non-diegetic | none |
| Next button "GO TO ROCKET YARD" | proceed | once | 1 | high | L | **bottom right, below the fold at 800 px** | non-diegetic | click |

### Other screens (condensed)

| Screen | Words | What carries the stakes | Weak spots |
| --- | --- | --- | --- |
| Home | 47 | two mode cards | none: a good example |
| Picker | 48 | three level cards (cash, debt, deadline, help) | level meaning is numbers only |
| Workshop | 166 | debt, cash, months left, three contract cards | the three contracts look equal; the best deal is not marked; interest is a number that never visibly moves |
| Base map | 100 | where to go next | adds about 1 second of walking per leg, five legs a flight |
| Rocket Yard | 130 | FITS / TOO SMALL badges | the cost of the rocket is not shown against cash |
| Readiness | 113 | READY or HOLD, forecast, checks, LAUNCH | verdict and LAUNCH are near; good |
| Mission | 119 | month counter, science bar, events | nothing to do between events; science pace against the contract is not visible |
| Debrief | 205 (330 for a contract) | PAID or not, limiting factor, TRY THIS, ledger | eight blocks of text in one reading order |

### Scoring summary

- **Attention budget on Build, by area (my estimate of fixation time):** parts shelf ~30%, satellite ~15%, bars and problems ~25%, preview ~15%, pay line ~5%, **everything else (header, hint, speech, title, minimap) ~10% for about 25% of the words.** The header cluster is the clearest noise: it costs words and is almost never read after the first visit.
- **Effective Hick-Hyman choice count:** a bin shows 8 to 11 cards. About half are usually not available, which the code sorts last (good). The player's real choice count is the available cards, about 4 to 6. Across bins the player faces 7 sequential decisions with no marked order.
- **Fitts, interactive:** part cards are large (about 200x150 px) and the next button is large, but the next button sits at the page bottom, far from the shelf. Bins and cards are near each other (good).
- **Empowerment:** one click on a part changes five places at once (satellite, bar, problems, science, pay line). The player sees *something* changed but cannot see in one glance *what mattered*.

---

## 2. Ranked problems

1. **The decision the player is really making is not shown as one thing.** In Part 2 it is: "will this design meet the contract, can I afford it, and do I have the months?" Those three answers are spread over a small pay line, the budget bar, the problems list and the header. On Hard the forecast is removed on purpose, so the player has to assemble it by hand. *Principles: channel capacity, cognitive load (extraneous), Fitts for attention.*
2. **The stakes are in the smallest text on the screen.** Cash, debt and months left are the reason Part 2 exists, but they live in the header status line, and debt growing with interest never visibly moves. *Principle: surprisal. The highest-stakes information has the weakest signal.*
3. **Three overlapping instructions on every screen** (objective line, hint box, team speech) plus title. After the first visit all four are near-zero surprisal. About 25% of Build's words, for ~10% of attention. *Principle: S/N, extraneous load.*
4. **Build is long.** The shelf, bins, bars and preview compete in three columns; at 800 px high the next button needs a scroll (Angad's laptop pass may already fix this; re-check). *Principle: Fitts (attention form), Gestalt (common region).*
5. **Warnings do not scale with how bad they are.** NO GO, WARN, "battery only" and "over budget" are all rows in the same list, in the same style. A blocker that makes the flight impossible and a note that the margin is thin look alike. *Principle: surprisal, redundancy.*
6. **Nothing to do or learn during a flight.** The mission screen shows a month counter, a science bar and a log, with feedback only at events. The player cannot see whether the science is on pace for the contract. *Principle: empowerment, germane load.*
7. **Debrief is a wall of equal-weight blocks** (205 words, 330 on a contract). The order is right (limit, then TRY THIS) but the verdict (paid in full, in part, or not) and the money change are not first. *Principle: Hick-Hyman ordering, surprisal.*
8. **No audio or motion channel for the few critical events** (HOLD, event dialogue, deadline near, debt interest). Everything is read, so a missed line is a missed event. *Principle: redundancy coding.* (Reduced motion must stay respected.)
9. **The base-map walk is charming for a first flight and a tax on the tenth.** *Principle: expertise, progressive disclosure.*
10. **Part 2 contracts look equal.** Three cards, same layout, same size, no sign of which is cheap to deliver for the pay. The player must compute. *Principle: Hick-Hyman (order the most likely choice first).*

Unsure, and how a playtest settles it: whether problem 1 is real for *new* players (they may not compute net profit at all and just chase 3 stars), whether the walk map really annoys experts, and whether the 3D satellite is read at all while placing parts. Section 6 has tests for these.

---

## 3. New UI spec

Rule for every element: **keep / move / merge / contextual / diegetic / remove**, with the principle. Positions are areas, not coordinates.

| Element | Change | Why |
| --- | --- | --- |
| Objective line, hint box, team speech | **Merge into one line**: the team's speech, shown with the face, containing the one instruction. The objective line is removed; the hint box stays only behind the `?` button. After the first visit to a screen the speech line collapses to its first sentence. | S/N, extraneous load, redundancy off low-value information |
| Screen title ("3 BUILD") | **Remove** as text; the step is already shown by the 5-dot route in the header. Keep it as an accessible heading only. | low surprisal; screen readers still get it |
| Status line (month, cash, debt) | **Move and resize into a persistent ledger strip**, three tiles (CASH, DEBT, MONTHS LEFT), top of every Part 2 screen. A tile flashes and counts for about 0.6 s whenever an action changes it (a part added changes CASH SPENT, a payment changes DEBT, a flight changes MONTHS). In Part 1 the strip shows only what that step uses. | surprisal: the highest-stakes information gets the strongest signal and a fixed place (Gestalt: one region for "my situation"); empowerment: your action visibly moves it |
| Contract verdict | **New, merges the pay line, the forecast and part of the budget bar into one strip** under the satellite with three gauges that each show "this design" against "the need": DATA vs the contract's points, COST vs cash, TIME vs months left. A gauge turns solid red with a cross only when it makes the flight impossible, amber with a triangle when it is thin. On Easy the gauges also say a number; on Hard they show the contract's terms and the player's design, and **the player compares**. | channel capacity (one place, three answers), Fitts for attention (next to the satellite, the focal point), redundancy (colour + shape + word), empowerment (a click moves a gauge). Keeps "hide answers, never facts": the gauges show facts; the *forecast* verdict stays tied to Help level |
| Parts bins | **Keep**; reorder to decision order (instrument, then power, comms, computer, body, attitude, propulsion). Show a single progress count ("4 of 6 needed") beside the satellite instead of "Needed" repeated six times. | Hick-Hyman (logical order lets the player scan), chunking |
| Part cards | **Keep**; show at most 5 or 6 cards per bin by default; cards that cannot be used in this mode are **removed**, not greyed; "show later parts" opens the rest. | Hick-Hyman, S/N (dashed cards are noise when they cannot be used in this mode; verify what Part 2 shows) |
| Hover preview | **Keep** (fixed height); the *change* is the first line, big: "+0.8 kg, +$0.4M, data +20 points", then the Fixes and Causes lines per Help level. | empowerment, Fitts |
| Satellite on the bench | **Make it carry the state (diegetic)**: a panel with too little power glows red at its edge; a part that causes a blocker gets a small cross on the model; an antenna with no downlink shows broken waves. The model is also where the verdict strip lives. | diegesis: the world shows the problem; expert players get it without reading |
| Four bars | **Keep**, smaller, **merged into the verdict strip's footnotes** (mass and power stay as bars; budget and data become gauges above). | merge duplicates |
| Problems list | **Contextual and ranked**: blockers first and big (one line each, cross icon, action word), then warnings; a list of nothing says one line "No problems". | surprisal, redundancy |
| Next button | **Move**: one fixed place, bottom of the viewport on every screen (sticky), labelled with what it does ("TO THE ROCKET YARD"). Disabled with a reason when blocked. | Fitts, consistency (germane load) |
| Base map | **Contextual**: walks are skipped from the second flight of a session (a key or a setting turns them back on). The map stays a button. | expertise, progressive disclosure |
| Workshop contract cards | **Reorder and mark**: sort by net (price minus cheapest known cost) and give the first a small label "best pay" on Easy only. Each card shows price, points needed, months left, and a one-line client reason. | Hick-Hyman, Easy only so Hard still decides |
| Workshop interest | **Make the debt tile tick**: a small "+$0.2M interest" label under it that updates with each flight. | surprisal, honesty (it is real, not artificial urgency) |
| Mission screen | **Add a pace line to the science bar**: a tick showing where the contract's minimum sits and a faint line for the expected finish. Fast-forward and pause stay. Events keep their dialogue (it already shows cost and odds with no "right" answer styled). | empowerment: the player sees if the design is delivering; germane load |
| Debrief | **Reorder**: (1) the verdict stamp and the money change as one big line ("PAID IN PART: +$7.4M, debt $33M"); (2) what limited you; (3) TRY THIS (stays on every level); then everything else folded under "Details". | Hick-Hyman, S/N |
| Audio | **Add three cues**, off by default under reduced motion and mute: a soft tick for HOLD, a low chime for an event, a short rise for a payment. | redundancy coding on the few critical events |
| Accessibility | Keep icon + word + colour for every status; text at least 18 px; touch targets at least 44 px; no information in sound only. | requirement |

### Wireframes (text, 1280x800, Part 2 Normal)

**Build**

```
+-----------------------------------------------------------------------------------------+
| GRAVITRON   [CASH $4.0M +]  [DEBT $40.0M  +$0.2M/mo]  [MONTHS LEFT 54]        [?]  route o-o-O-o-o |
+-----------------------------------------------------------------------------------------+
| (face) "Fit what the contract needs. Start with the instrument."                          |
+-------------+-------------------------------------------------+---------------------------+
| BINS        |   [ 3D satellite: glows red where it is short ] |  PROBLEMS                 |
| > Instrument|                                                 |  x NO COMPUTER   (1 line) |
|   Power     |   VERDICT  DATA [====|--] 86 / 95               |  ! BATTERY ONLY           |
|   Comms     |            COST [==|-----] $3.2M of $4.0M        |  (none else)              |
|   Computer  |            TIME [===|----] 11 of 54 months      |                           |
|   Body      +-------------------------------------------------+  MASS  [=====----] 6.9 kg |
|   Attitude  |  IF YOU CLICK:  +0.8 kg   +$0.4M   data +20     |  POWER [===------] 0/6 W  |
|   Thruster  |  [ part ] [ part ] [ part ]                     |                           |
| 4 of 6      |  [ part ] [ part ]   (later parts: show)        |  SCIENCE  86 / 95 pts     |
+-------------+-------------------------------------------------+---------------------------+
|                                                          [ TO THE ROCKET YARD  > ]  (sticky) |
+-----------------------------------------------------------------------------------------+
```

**Readiness** (unchanged in structure; the verdict is already the right size)

```
+---------------------------------------------+-----------------------------------------+
| ledger strip                                                                              |
+---------------------------------------------+-----------------------------------------+
| [ 3D pad with rocket ]                      |  HOLD  /  READY      (big word + icon)   |
|                                             |  x 1 to fix  (blockers first, 1 line)    |
|                                             |  [ LAUNCH ]   <- directly under verdict  |
+---------------------------------------------+  forecast (Easy, Normal)                 |
                                              |  warnings, folded                         |
```

**Mission**

```
| ledger strip                                                                              |
|  MONTH 14 / 36            [ Earth + orbit, satellite moving ]                             |
|  SCIENCE [=========|--------->]  63 / 95  (tick = contract minimum)       [pause] [ >> ] |
|  log: three lines, newest on top                                                          |
|  (event dialogue replaces the lower half when it happens; choices show cost and odds)     |
```

**Debrief**

```
| ledger strip                                                                              |
|  [ PAID IN PART ]  +$7.4M    debt $33.0M    months left 41      <- the answer first       |
|  LIMITED BY: power   one sentence                                                         |
|  TRY THIS: one sentence                                                                    |
|  [ NEXT CONTRACT > ]                                                                       |
|  > Details (ledger rows, segments, closest real mission, events)  (folded)                 |
```

**By player type (progressive disclosure, no new field: it rides the Help level)**

- **New (Easy, Part 1):** hint line open, verdict gauges with numbers, FIX links, "best pay" mark on contracts, all cues on.
- **Casual (Normal):** hint box on request, gauges with numbers, no FIX links, no "best pay" mark.
- **Expert (Hard):** gauges without numbers, no forecast, odds as bands; the 3D satellite and gauges carry the state; walks skipped; the ledger strip is the only chrome.

---

## 4. Trade-offs and how each was resolved

| Conflict | Resolution |
| --- | --- |
| **Diegetic immersion vs reading speed.** A glowing panel is atmospheric but slower to read than a number. | The satellite carries the *state* (red edge, cross, broken waves) and the gauges carry the *amount*. Both exist; neither is required alone, so the number is never lost. |
| **Minimalism vs new-player clarity.** Fewer words hurt first-time players. | The level's Help setting decides how much stays. Easy keeps the merged speech line, FIX links and "best pay"; Hard drops them. Hints open on the first visit, then fade. |
| **Redundancy vs noise.** Critical facts get three channels; low-value facts must get none. | Only four things get colour + shape + word + sound: HOLD/blocker, an event, a payment, deadline near. Everything else gets one channel. |
| **"Hide answers" vs "make it easy."** Hard removes forecasts, but the gauges are a new aid. | The gauges show *facts* (the contract's need, the design's amount); the *verdict* ("this meets it") is the part removed on Hard. |
| **Engagement without manipulation.** A ticking debt could become artificial urgency. | The interest is real game state and it only changes when a flight advances the calendar. No pulsing, no countdown sound, no loss-framed prompts. |
| **Walk map charm vs latency.** | Charm for flight 1, skipped from flight 2 by default; one key brings it back. |
| **Moving things vs the freeze.** The screens are being rewritten today. | This document gives *jobs and orders*, not layouts. Section 5 splits what is safe before the freeze from what waits. |

---

## 5. What to hand the screen agents, and when

**Safe before the freeze (small, local, low risk):**

1. Merge objective line + hint box + speech into one line, folded after the first visit.
2. A fixed next button at the viewport bottom, labelled with what it does.
3. Reorder the debrief: verdict and money change first, "Details" folded.
4. Remove greyed-out cards that cannot be used in Part 2 (verify first that any show).
5. Make the debt tile show "+interest" after each flight.

**After the submission (new work, needs the 1.0 layout to settle):** the ledger strip with animated tiles, the verdict gauges, the diegetic satellite states, the mission pace line, audio cues, walk-skip, contract sorting and the "best pay" mark.

Needs your or Angad's yes: nothing here adds a data field. The "best pay" mark needs a cheapest-cost estimate from the back end (a function, not a field).

---

## 6. Playtest plan

Eight to twelve players: four who have never seen the game (not on the team, ideally one under 18 with a guardian's consent and no photos), four casual, four who play strategy games. Ten minutes each, screen and voice recorded, with consent. Same laptop, Easy first, then Hard.

| Metric | How | Before (prediction) | After (prediction) |
| --- | --- | --- | --- |
| Time to first launch | clock from "Start" to LAUNCH, Part 2, first flight | ~4 to 6 min | ~3 to 4 min |
| Time to notice an over-budget or impossible design | seconds from the state appearing to the first correct fix or comment | ~20 to 40 s | ~5 to 10 s |
| Decision time at the contract choice | seconds from the workshop appearing to FLY THIS | ~25 s, many choose the first card | ~15 s, more choose by pay |
| Misclicks | clicks on locked, disabled or unrelated elements per flight | ~3 | ~1 |
| Debrief comprehension | after the debrief, ask "were you paid in full, and why not?" | ~50% correct | ~80% correct |
| Debt awareness | after Build, ask "how much do you owe now?" | ~30% right | ~70% right |
| Hard vs Easy | whether Hard players say they were *stuck* or *challenged* | mixed | "challenged" |
| Engagement | the 10-item post-play questionnaire below, 1 to 5 | ~3.4 | ~3.9 |

These predictions are guesses, not data; their purpose is to be checked. Tests that settle the unsure points in section 2: a think-aloud on Build asking "what is your next decision?" (does the player mention profit at all), a five-second look at the 3D satellite with an eye-tracker or a replay of mouse movement (is it read), and a version with walks skipped against one with walks (does the second flight feel faster, and does the first feel less magical).

Questionnaire (1 to 5): I always knew what to do next. I could tell if my design was good enough. I felt my choices mattered. I felt in control. I was absorbed. I lost track of time. Nothing on the screen got in my way. I understood why I was paid what I was paid. I understood the debt. I would play another contract.

---

## 7. Rules I held to

- Nothing is added only because it is available: the gauges replace three existing readouts, not add to them.
- No engagement technique that works against the player (no fake urgency, no misleading prompts, no attention traps).
- Critical information never depends on colour alone or sound alone.
- Where unsure, the section says so and names the test.

## 8. Re-check on 1.0 (not on any remote when this was written)

- The rustic 1958 theme may change Part 1's palette and fonts; check contrast of every status colour and that icons stay.
- The laptop layout pass may already fix problem 4 (the next button below the fold). Re-measure at 1280x800 and 1366x768.
- Animated text may touch the speech line and the debrief; check it honours reduced motion and that it does not delay reading.
- Re-run `handoff/browser-tests/words.js` and compare with the counts in section 1.
