# UI review: the story audit

Sunday November 15, 2026. Audit of the story as it stands on `main` (spec `428567b`; the story files are unchanged through `8a6bb4b`). Nothing in the code or the spec was changed by this review: it is a list for a person to act on. File and line references are to `main` at that commit.

Rule for any fix: a change to `SPEC.md` is pushed to `main` at once, in its own commit (`CLAUDE.md`). No data field is added or renamed without asking.

## What passes

- `handoff/browser-tests/story-text.js` (shape, length, no digits, no banned words), `tests/comeback.js` (118), `tests/migration.js` (116) and `tests/saves.js` (35) all pass.
- `handoff/browser-tests/story.js` passes: all seven endings render, are recorded and offer PLAY AGAIN; each scene shows once, also after a reload; missing or broken story records never replay a scene; no console errors.
- So the mechanics work. The problems below are continuity, pacing and sourcing.

## Fix before tonight's deadline

### 1. The win screens contradict the story (text only)

- The back end's `getComebackEnding().epilogue` says Ajay opens "the last page, the one his grandfather never got to fill" (`js/mission.js:2298`).
- Part 1's epilogue says Austin "writes one last page" (`js/ui-design.js:225`), and the `legend` ending shows that page: "his design was right" (`js/ui-design.js:426`).
- `js/ui-story.js:307` prints the epilogue under the story beats, so one screen disagrees with itself. It shows under BACK IN BUSINESS, BY A HAIR and HIS NAME, RESTORED.
- The loss epilogue (`js/mission.js:2306`, "The lenders change the locks") repeats the beat the `timeout` ending already has ("Two men in grey coats change the lock").
- Fix: reword the three epilogue strings in `js/mission.js` (2291, 2298, 2306). No data field changes.

### 2. A player who wins fast never sees the story's payoff

- Austin's last page (`interludes.after-3`) is the only scene that says Voss changed Austin's design and then founded Iron Eclipse. The `legend` ending repeats it; `comeback` and `close` do not.
- `after-3` needs three flights with the run still going, or, on Easy, two flights and under half the debt (`js/ui-story.js:152`). No scene is shown after the flight that ends the run.
- Simulated Easy run, seed 5: won in 2 flights (BACK IN BUSINESS) and saw start, mum, offer and refused only. The reveal never appeared.
- By the CHANGELOG's own tuning (Normal wins in about 3 flights), a Normal win skips it too. That part is inferred from the tuning, not simulated.
- `interludes.final` ("Almost there... one more flight", `js/ui-story.js:153`) fired in 0 of 24 simulated runs. It needs debt under 25% while the cash is still short of it, and PAY ALL ends the run first. "One more flight" can also be untrue, because the player can win by paying with cash.
- A design decision for the story owner. Options: show `after-3` right after `refused`; or add a line about the page to the `comeback` and `close` endings; or both.

### 3. `SPEC.md` no longer matches the shipped story

`CLAUDE.md` says the spec is the source of truth, so one of the two has to move.

| Spec says | Shipped story says |
| --- | --- |
| Austin is a NASA engineer who runs the project (`SPEC.md:143`; the comment at `js/ui-design.js:136` says the same) | A young rocket engineer; Marcus Voss runs the programme (`js/ui-design.js:197`). NASA did not exist in October 1957 |
| His biggest satellite is lost on the pad "as Vanguard TV3 was, December 1957" (`SPEC.md:149`) | "Nineteen sixty" (`js/ui-design.js:222`) |
| Rivals call his vision impractical (`SPEC.md:149`) | Voss blames Austin's design and the programme is cut (`js/ui-design.js:223`) |
| The buyout takes the workshop, the patents and the notebook (`SPEC.md:160`) | The in-game offer names only the workshop and the notebook (`js/ui-design.js:401`), while Iron Eclipse has already "bought your old patents for almost nothing" (`js/ui-design.js:400`). The SOLD OUT ending then says "the patents" again (`js/ui-design.js:458`) |

### 4. The story's one real-world anchor is unchecked

- `SOURCES.md:33` (Sputnik 1, October 1957, beeps heard around the world) reads "NOT OPENED; NEEDS HUMAN CHECK" and has no link. The References field must be complete.
- Already listed in `handoff/CONTINUE.md`, item 2: a person opens a NASA Sputnik history page and fills in the URL.
- The same row lists "Priya" as an invented character. She appears in no line of story text (the partner is "YOUR PARTNER"). Drop her from the row or name her.

### 5. Nothing in the game says the story is fiction

- The debrief and the part cards credit the radiation belts to James Van Allen and Explorer 1 (`data/missions.js:11`, `data/parts.js:145`, `js/part-story.js:48`). Part 1's story has Austin's satellite make the discovery and Voss take the credit.
- Only `SOURCES.md` says this is retold "as fiction". A player or judge sees two accounts of one discovery.
- Fix: one visible line, for example on THE BOX screen or the Part 1 intro: "Austin, Voss, Ajay and Iron Eclipse are invented. Explorer 1 and the radiation belts are real."

## Lower priority

- **BY A HAIR says "hours to spare"** (`js/ui-design.js:447`). The rule allows a tenth of the deadline (`js/mission.js:2151`, `data/campaign.js:34`): up to 3 months left on Easy, 4 on Normal and Hard. The ending screen does not show the deadline, but the workshop did.
- **The buyout fires whatever the player has done.** It is offered after the second flight with debt left (`js/mission.js:2118`). In the six Normal and six Hard simulated runs I printed, 89 to 100% of the debt was still owed when it came, yet the partner says "until you started winning" (`js/ui-design.js:402`).
- **The SELL / REFUSE screen shows the partner's line, not the rival's terms.** `js/ui-story.js:209` takes the last beat of the offer, which is the partner's. The comment above it says "the rival's last line". The terms are only in the button hints.
- **Austin's notebook in Part 2's debriefs confesses mistakes** ("I accepted warnings because we were behind. They found me later", `js/ui-design.js:594`; "I left no margin", line 592). That clashes with "My first design was right. Marcus Voss changed it" (line 410) and with the sure voice of Part 1's rules.
- **Part 1 step 1 lists five parts and leaves out attitude control** (`js/ui-design.js:205`), which is required since the switch-over. The opening beats double as the how-to-play hints.
- **Step 3 says "Voss wants a launch for the cameras"** (`js/ui-design.js:214`). The step is a radiation counter, so "cameras" reads as satellite cameras. The epilogue means press cameras.
- **The airline contract cites crew dose on polar routes** (`data/contracts.js:9`). That dose comes from cosmic rays and solar particles, not the radiation belts the topic measures. A physicist judge could notice.
- **`handoff/notes/AJAY-TEXT.md` is a stale draft** (different intro, names Priya, shorter endings). It is not what ships. It is due to go with the `handoff/` cleanup.

## Not a story finding, but it blocks re-tuning

- `data/campaign.js:17-20` says the comeback numbers were tuned by simulating "hundreds" of comebacks, and the CHANGELOG says a sensible player wins in about 2, 3 and 4 flights. No such script is in the repo, and `handoff/CONTINUE.md` says the simulator was lost with its session.
- A crude search-based player (random designs, best expected profit) won Easy 5 of 8, Normal 1 of 8 and Hard 0 of 8. That says little about a sensible player, so the claim is neither confirmed nor refuted.
- If the story pacing in item 2 is changed, the run lengths it depends on should be re-measured. Rebuild the simulator from `tests/comeback.js` and commit it under `tests/`.

## Names

Iron Eclipse, Albert Orbital and Marcus Voss are invented for the story and stay as they are. A web search on 15 November found no company or person with those names. The nearest are [Eclipse Space](https://payloadspace.com/eclipse-space-unveils-three-satellite-platforms-for-constellations/), [Sierra Space's Eclipse satellite bus](https://businesswire.com/news/home/20240405710567/en/Sierra-Space-Unveils-the-Revolutionary-Eclipse-Satellite-Bus-Line-Introducing-Velocity-Horizon-and-Titan) and the [Firefly and Northrop Grumman Eclipse rocket](https://fireflyspace.com/news/northrop-grumman-invests-50-million-in-firefly-aerospace-to-advance-medium-launch-vehicle-named-eclipse/). No action.

## How the simulation was run

- 8 seeds per difficulty, 24 comebacks, on a copy of the back end loaded the way `tests/load.js` loads it.
- The player picks the best of 300 random designs per open contract (instruments that match the topic, no blockers, best expected pay minus cost), always refuses the buyout so the run continues, and pays back half the safe amount after each flight.
- Scene triggers were replayed from the same rules as `nextInterlude` in `js/ui-story.js` at the start, after each flight and after each payment.
- It is a rough player, not a tuned one. Trust the scene logic it shows, not its win rates.
