# Real-world elements: research and plan

Written November 15, 2026, after satellite engineers visited the table and said: parts should have a production time; the slowest part sets the schedule; the clock runs back from launch; and lead time matters. Status of this file: **a plan. Nothing here is built, and nothing here adds a data field.** `CLAUDE.md` says new data fields need the user's yes first, so every field below is a question, not a change.

## What the engineers said, in plain words

- **Lead time** is how long you wait between ordering a part and having it on the shelf. It is not the same as build or test time: a reaction wheel may take 4 months to make once the maker starts, but the maker's queue can add months before it starts.
- **The long pole.** The part with the longest lead time sets the earliest date the satellite can be finished. Making every other part faster does not move the date. (Engineers call it the long pole in the tent; a rate-determining step in chemistry.)
- **Working backwards.** A real programme starts from the launch date and counts back: the launch slot is fixed, so the order date for the long-pole part is launch minus test time minus integration minus lead time. Miss it and the satellite misses its launch.

## What the game already does (do not rebuild)

`data/parts.js` gives every part a `build_months`. `devMonths()` in `js/game.js` returns the longest part plus one month per three parts for integration (`dev_months`), and the Readiness screen shows it. A campaign flight costs `dev_months` plus a launch campaign (2 months) on the clock, and contracts expire. So the long-pole rule is already there. What is missing is that the player cannot **see** which part is the long pole, cannot do anything about it (order early, pay for speed, pick a different part), and the launch date never pushes back. That is where most of the teaching value is.

## What the research found

Sources are for the team to check before anything goes in `SOURCES.md`. The figures differ a lot between sources, so the game should use ranges in its own words and say they are rounded.

| Real-world idea | What it means | Evidence (to verify) |
|---|---|---|
| Lead time vs the long pole | The schedule is set by the slowest item. Reaction wheels and star trackers are quoted at roughly 18 to 52 weeks, space-grade solar cells at roughly 26 to 52 weeks and up to about 18 months in the 2025-26 boom. | [Space Nexus, "The schedule is set by the slowest part"](https://spacenexus.us/learn/supply-chain/space-supply-chain-fundamentals/lead-times-and-the-long-pole); [New Space Economy, small-satellite bottlenecks](https://newspaceeconomy.ca/2026/09/26/where-are-the-real-bottlenecks-in-the-small-satellite-supply-chain.md). Commercial explainers, not primary data. |
| Long-lead items ordered early | Programmes order the slow parts before the design is final, at their own risk, and sometimes get an early contract for just those parts. | [Aviation Week, SES long-lead items](https://aviationweek.com/space/satellites/ses-secures-long-lead-items-c-band-clearing-eyes-iris2-milestone) |
| Sole source and buffer stock | One maker for a part means one queue. Teams qualify a second source and hold some stock of the slow parts. | Same Space Nexus page; [Breaking Defense on the supply chain](https://breakingdefense.com/2026/02/the-space-supply-chain-is-getting-stretched-heres-how-it-could-impact-the-pentagons-plans/) |
| Schedule margin | Plans carry spare weeks on the long pole because tests find faults. | General systems-engineering practice (NASA SE Handbook, NASA-SP-2016-6105): to cite. |
| Environmental testing | Vibration, thermal-vacuum and EMC tests take a fixed block of weeks and a failed test sends the satellite back. | NASA GEVS (GSFC-STD-7000): to cite. |
| Mass and cost growth | Mass and cost estimates grow during design; reviews keep a margin that shrinks as the design matures. | NASA SE Handbook and the JPL concept-maturity levels the game already uses for its three levels. |
| Heritage and readiness level | A part that has flown before is trusted more than a new one; engineers call the scale Technology Readiness Level. | NASA TRL definitions: to cite. |
| Rules before launch | Radio licences, debris-disposal plans and imagery licences need approval and take months. | The game already has a debris rule; the others are to cite (ITU, national regulators). |

## Features, in the order I would build them

Each says what the player sees, which fields it needs, who owns it, and the cost. "Back end" is Yareem's files; "screen" is the design screens (Angad).

### Step 1. Show the long pole (no new data, about 2 hours)

- The Readiness screen and the Build bar name the part that sets `dev_months` ("Longest part: synthetic aperture radar, 8 months") and say what swapping it would save ("Without it: 5 months").
- Back end: a function `getSchedule(design)` returning `{ long_pole: part id, long_pole_months, next_months, integration_months, total_months }`, built from the existing `build_months`. No new data field.
- Teaches the engineers' main point with the numbers already in the game. **Do this first.**

### Step 2. Lead time as its own number (one new field: ask)

- New field on each part: `lead_months` (months between order and delivery), separate from `build_months`. A part's time on the critical path becomes `lead_months + build_months` or the two are shown apart (needs a decision).
- The three tiers behave differently: Easy shows one number; Normal shows lead and build; Hard shows neither and lets the player find the long pole by missing a deadline (the help ladder already has this shape).
- Values are GAME VALUES rounded from the sources above; each part gets a one-line `source` note the way every other row does.

### Step 3. Work back from the launch date (rules change: ask)

- A contract has an `expires_month`; a launch slot gives a fixed date. The schedule screen counts backwards: "Order the radar by month 3 or you miss the slot."
- Ordering early costs something real: the part is bought before the design is final, so changing it later wastes the money. That is the long-lead-item risk in one sentence.
- Rules: `launchSlot` per contract or per launcher; a design that cannot finish in time is blocked at Readiness with the long-pole message (the existing `too-late` check, `js/game.js:597`, is the model).

### Step 4. Pay to go faster, or choose another part (cost rule: ask)

- Expedite: pay a share more to cut a part's lead time (real suppliers charge for it). Second source: a cheaper, slower or heavier alternative in the same category (the parts list already has three per category).
- Gives the player a real choice between cash, months and risk, which the debt story already pressures.

### Step 5. Test blocks and schedule margin (rules change)

- Integration and test become a visible block after the long pole: vibration, thermal-vacuum, a re-test if the readiness review fails. A failed review sends the design back a few months, not just to the Build screen.
- A schedule margin the player chooses to keep: more margin, later launch, safer.

### Step 6. Mass and cost growth, heritage and rules (later, smaller)

- Mass and cost estimates carry a margin that shrinks from the Easy level to the Hard level (the game's tiers already use JPL's maturity levels).
- A "flown before" mark on parts with heritage (a new field, `heritage`, sourced from the real mission each part comes from); heritage parts carry less risk and less margin.
- Licences: a radio licence and a debris plan as short checks with a month cost, one line each in the debrief.

## Not now, on purpose

- **Suppliers, countries and travel** (the proposal already in `SPEC.md`) overlaps with lead time. Decide Step 2 first; the supplier idea then becomes "who has the shortest lead time", which is simpler.
- **Launch failures** are planned already; they pair with insurance and test blocks but are a separate piece of work.

## Questions for the user (each is a data-field or rules change)

1. Add `lead_months` to every part (Step 2)? If yes, do lead time and build time add, or does only the longer one count?
2. May the schedule use a fixed launch slot per contract (Step 3)?
3. Should expedite and a second source exist in Part 1 (the tutorial) or only in Part 2?
4. Who checks the lead-time numbers against a real page, as with the other `source` notes?

## How to test it

- Hand-worked cases in `tests/`: a design with a known long pole has the expected `total_months`; swapping the long pole changes it by the right amount; a part list with two equal long poles names both.
- A browser check that the long-pole line is on screen without scrolling at 1366x768 (the measuring harness in `docs/ui-measure` does this).
- A playtest question: after one flight, can a player name the part that set their schedule?
