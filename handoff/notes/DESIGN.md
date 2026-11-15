# GRAVITRON: two game modes (design, November 15 2026)

Decided by the user (angads22): the home page offers **only two modes**. Everything else (the era grid, the three levels, the 1957 campaign) leaves the screen; its code stays so nothing else breaks.

## The home page

Low-poly hero (already built), the title, one line, then two mode cards side by side (stacked on a phone):

1. **PART 1 · 1958 — AUSTIN'S FIRST SATELLITE.** "The walkthrough. Three short missions, one idea each." Shows the three steps with their stars. Button: START, or CONTINUE (step N), or PLAY AGAIN when all three are done. A "START HERE" tag while Part 1 is not finished.
2. **PART 2 · TODAY — AJAY'S COMEBACK.** "He owes $40M. Build satellites people will pay for, and pay it back in time." Button: START, or CONTINUE (with cash, debt and months left) if a comeback is saved; NEW COMEBACK (confirm) when one is saved. Always open (a judge with five minutes can go straight in), but Part 1 is recommended.

Nothing else on the page except a quiet RESET PROGRESS link and the save-code import (moved into the Part 2 card's "More" or the hub).

## Part 1: Austin's walkthrough (1958)

Austin Albert, NASA engineer, the world's first satellite project. Three standalone missions in the **igy** era (1958 parts and rockets only), tier **training** (hints on). Each mission:

- has a fixed topic and teaches **one idea**, chosen from what the 1958 data actually supports (verify with the real availability functions, never assume):
  1. **The basics (systems).** Every satellite needs a body, a way to point, an instrument, power, a radio and a computer, and must fit its rocket. Orbit and rocket are preset; the player only builds. Topic: the radiation belts (Explorer 1).
  2. **Power and data.** A battery runs out; data that never reaches the ground earns nothing. The rocket is preset; the player chooses the orbit and builds. Topic chosen from the era's topics so that power and data are the real limits.
  3. **Your mission.** Nothing preset. The player picks orbit, parts and rocket for the topic.
- passes with **1 star or more**. Fewer: the debrief's TRY THIS and REDESIGN, as today. A passed step stays passed; replaying can raise its stars.
- opens with one or two story beats and ends with one closing beat (the STORY block in `js/ui-design.js` holds all text).

After step 3 passes: a short **epilogue** (three or four beats): Austin's next and biggest satellite is lost on the launch pad (as Vanguard TV3 was in December 1957), the programme is cut, rivals call his vision impractical, his notebook goes into a box. Then: "Decades later, his grandson Ajay opens it." with a button straight into Part 2.

Progress for Part 1 is a front-end record in localStorage (`gravitron-walkthrough-v1`: `{ done: { step1: stars, ... } }`). It holds no game numbers, only which steps were passed and their best stars, which come from the debrief.

## Part 2: Ajay's comeback (present day)

**Who Ajay is (tone: a reckless founder, kept light, nothing crude).** Austin's grandson. He borrowed big to start a satellite company, "Albert Orbital", that flopped before it flew anything: he spent the money on a launch party, a logo and an office with a slide. The lenders gave him one chance: pay back $40M before the deadline, or they take the family workshop, the last thing Austin left. He finds Austin's notebook in the workshop.

**Why he builds satellites (the reasons; the story and the contracts use these):**
1. The lenders: pay the debt back before they take the workshop.
2. Austin's name: prove his grandfather's ideas were right, decades late.
3. His own name: prove "Albert Orbital" was not a joke.
4. His mother co-signed the loan with her house.
5. Iron Eclipse, the giant rival, bought his failed company's patents for almost nothing and now laughs at him.
6. Customers with real problems will pay for data, if he can deliver it cheaper than Iron Eclipse:
   - wildfire: an insurer pricing fire risk; a fire service that needs hot spots overnight.
   - sea ice: a shipping line routing through the Arctic; a coast guard planning rescues.
   - weather: farmers' co-operative timing the harvest; an airline avoiding storms.
   - ionosphere: a GPS navigation firm whose positions drift in solar storms; a ham radio league.
   - radiation: a satellite operator protecting its fleet; an airline checking crew doses on polar routes.
   - solar: a power grid operator that lost a transformer to a solar storm.

**The loop.** A campaign variant ("comeback") in the 2026 era (all present-day parts, no research, no lab):

```
Comeback hub (cash, debt, months left, 3 contracts)
  -> pick a contract (it sets the topic) -> the same screens: map, briefing (topic preset), orbit, build, rocket, readiness
  -> launch (costs cash) -> mission -> debrief: contract paid for data returned; months pass
  -> back to the hub: PAY BACK from cash, or take the next contract
Win: debt reaches 0 before the deadline.  Lose: the deadline passes with debt left, or cash can no longer launch anything.
```

- **Cash** (`treasury_musd`) pays for parts and launches. The **budget** check on the readiness review uses the cash in hand (no separate tier budget).
- **Debt** starts at $40M and grows by a small monthly interest (game value), so waiting costs money.
- **Deadline:** 36 months (game value) from the start. Each flight uses months: the design's development time plus a fixed launch campaign (game value). The hub shows months left.
- **Contracts:** three open at a time, generated from the topics (the client and reason lists above live in a data file). Each has a client, one-line reason, topic, sometimes an orbit, a minimum of data, a full price and a month it expires. A flight on that topic is paid **in proportion to the data returned, up to the full price at the minimum**, with a small bonus for 3 stars (all game values). The data cap rule (new data only) still applies: a topic already fully known earns nothing new.
- **Pay back:** from the hub, any amount up to the cash in hand (a PAY ALL button and a few steps). Paying early saves interest.
- **No bail-out** (unlike the 1957 campaign). If cash cannot buy the cheapest launchable design, the comeback is lost.
- **Ending:** a short chronicle like `js/ui-ending.js`: win ("the workshop is yours", Austin's notebook closes), or loss by time or by cash, with what was flown and a TRY AGAIN.

All numbers are back-end values (`js/mission.js`, `data/campaign.js`) returned through new functions; the screens only show them. Tune them by simulation so a sensible player wins in 4 to 7 flights and a careless one loses.

## Back end (new, in the back-end files; all new data fields listed here are approved by the user)

- `data/campaign.js`: `CAMPAIGN.comeback = { start_year: 2026, era: "new-space", tier: "standard", cash_musd, debt_musd, interest_per_month, deadline_months, launch_campaign_months, contracts_open: 3, contract_months, bonus_3_stars }` (game values).
- New data file `data/contracts.js`, one global `CONTRACTS`: `{ topic: [ { client, reason } ... ] }` with the reasons above (two or more per topic).
- `newComeback()`, `getComeback()` (hub info: year, month, months_left, cash, debt, interest, contracts, flights, finished, won, lost_reason), `newComebackDesign(contractId)`, `payDebt(amountMusd)` -> `{ ok, reason }`, `getComebackEnding()`.
- `recordResult` settles a comeback flight (design flag `comeback: true`, `contract` id): pay, months, interest, new contracts, win/lose. It returns the numbers the debrief shows (`contract_paid_musd`, `cash_musd`, `debt_musd`, `months_left`, `comeback_over`, `won`, `lost_reason`).
- Availability for comeback designs: the 2026 era (no research). Budget check: the comeback's cash.
- Tests in `tests/campaign.js` (or a new `tests/comeback.js`): start, pay, interest, deadline loss, cash loss, win, contract payment in proportion, no bail-out, save survives reload.

## Front end (Design screens)

- Title: the two mode cards (above). Remove the era grid, levels and campaign panel from the page.
- Part 1 flow: steps, presets, story beats, progress record, epilogue, "Continue to Part 2".
- Part 2: a comeback hub (in `js/ui-campaign.js` or a new `js/ui-comeback.js`): a debt bar, cash, months left as a countdown, the three contract cards (client, reason, topic, pay, expiry), PAY BACK, and the ending. The debrief (`js/ui-mission.js`) adds the contract result (PAID $X), cash and debt after the flight, and months left.
- The story lines on each screen follow the mode (Austin in Part 1, Ajay and the customer in Part 2).
