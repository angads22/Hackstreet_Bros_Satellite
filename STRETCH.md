# Stretch ideas

New ideas go here, not into the code. See the stretch list in SPEC.md for the agreed order.
Nothing in this file is built until the first full playthrough works on screen.

## 1. Difficulty weights, Plague Inc style

In Plague Inc, a difficulty level does more than change one number. It quietly tilts every rule of the world against you. We do the same: each tier carries a set of weights, and every calculation in `js/game.js` and `js/mission.js` multiplies by its weight. The screens and parts stay the same.

| Weight | What it multiplies | Training | Standard | Expert | Impossible |
| --- | --- | --- | --- | --- | --- |
| Part cost | every `cost_musd` of a part | 0.8 | 1.0 | 1.2 | 1.5 |
| Launch cost | the launcher's `cost_musd` | 0.8 | 1.0 | 1.1 | 1.5 |
| Science target | the objective's `science_target` | 0.8 | 1.0 | 1.2 | 1.6 |
| Ground contact | the orbit's `downlink_mult` | 1.2 | 1.0 | 0.9 | 0.7 |
| Failure chance | every event's `fail_chance` | 0.5 | 1.0 | 1.3 | 2.0 |
| Thin-margin penalty | the extra risk when a margin is under 10% | 1.2 | 1.5 | 2.0 | 3.0 |
| Part variance | spread in how well each part performs (section 2) | 0% | 5% | 15% | 40% |
| Ageing | yearly loss of solar and battery output | 0% | 2% | 3% | 5% |

All numbers are placeholders for QA to tune. The tier select screen shows a short line per tier, as Plague Inc does ("Casual: the world barely notices"), and could show the weights themselves.

**Data format proposal (needs the data person's approval):** one new field on each tier,
`weights: { part_cost, launch_cost, science_target, downlink, fail_chance, thin_margin, variance, ageing }`.
Rules reads it in `game.js` and Simulation in `mission.js`. A missing weight counts as 1, or 0 for variance and ageing, so today's tiers keep working unchanged.

## 2. Part variance and real-world conditions

Real parts do not perform to the datasheet. In the weighted tiers, each part rolls an effectiveness at mission start from the design's seed, so a replay of the same design still gives the same result. With a 40% spread, the "same" radio might deliver 60% to 140% of its rated data.

Real conditions worth researching (Data task 5 in SPEC.md, each needs a source):

- **Early failures.** Many smallsats fail in their first weeks ("infant mortality"). This could be a higher failure chance in the first three months.
- **Solar cycle.** Radiation and solar storms peak every 11 years, so solar storms could come more often near solar maximum.
- **South Atlantic Anomaly.** Low and polar orbits fly through a radiation hot spot, while geostationary orbit sits in the outer radiation belt.
- **Cloud cover.** Optical cameras lose most images to cloud; about two thirds of Earth is cloudy at any moment. Radar and thermal are affected less.
- **Solar cell and battery ageing.** Output drops every year from radiation damage and charge cycles.
- **Ground station weather.** Rain fades X-band and Ka-band links more than S-band.
- **Atmospheric drag.** At solar maximum the upper atmosphere swells, so low orbits decay faster and lifetime shrinks.

## 3. Impossible mode

A fourth tier, unlocked by three stars on Expert. The weights in section 1 are at their harshest, every part rolls a 40% variance, and the budget is impossibly low: about $3M, which does not even buy a radar. The only way through is to turn the money you have into more money **before** building.

### Funding strategies

Before the Briefing screen, the player picks one or two strategies. Each is a gamble with a different shape, and all are seeded from the design so replays stay fair.

| Strategy | How it works | Risk |
| --- | --- | --- |
| **Launch-day wager** | Bet part of the budget on a fast game of chance before launch: double or nothing, or long odds for a big payout. | Pure gambling. Can leave you with nothing. |
| **Host a payload** | Carry another company's instrument. Paid up front, but it takes mass, power and data from your own mission. | Steady cash; weakens your design. |
| **Sell imagery** | Sign a contract to deliver commercial images. Earns money per GB returned, competing with your science data. | Pays only if your downlink holds up. |
| **Technology demonstration** | An agency pays you to fly an untested part. | Big cash, but that part has a high failure chance. |
| **Crowdfunding** | Run an outreach campaign; the amount raised is random. The Planetary Society's LightSail 2 raised over $1.24M on Kickstarter (CubeSat 101, PDF p.21). | Random payout; costs a little time. |
| **Investors** | Take money now, give up a share of your final score. | Certain cash, guaranteed score penalty. |
| **Skip insurance** | Insurance normally costs a share of the launch price. Skip it and keep the money, but a launch failure ends the run. | Rare but total loss. |
| **Sub-missions** | Short side contracts during the mission, such as imaging a disaster zone or relaying another satellite's data, chosen like events. | Paid in orbit; costs science time. |

### Open questions

- One strategy or two? Two makes for more interesting combinations, but is harder to balance.
- Is the wager a mini-game on screen (Design screens) or one decision with a seeded roll (Simulation)? One decision is far cheaper to build.
- Does money earned in orbit count toward the 15 "budget left" points, or get a score line of its own?
- New data files likely needed: `data/strategies.js` and perhaps `data/submissions.js`. These are new data fields, so the data person must approve them.

## 4. Research labs

Some research could build a **lab** rather than unlock a part: a lasting facility that changes the rules for every later mission. Each lab is a real institution of the era, which keeps the history lesson going.

| Lab | Real model | Effect |
| --- | --- | --- |
| Tracking network | Minitrack (1958), later NASA's Deep Space Network | Raises every orbit's ground contact (`downlink_mult`) |
| Environmental test chamber | Goddard's vacuum chambers | Lowers every `fail_chance` (testing before flight finds faults) |
| Data centre | NSSDC (1966), now NSSDCA | Raises science from data already returned (better analysis) |
| Mission control | Goddard (1959) | One free "safe" choice per mission |

**Needs:** a `lab` object on research records (`{ effect, amount }`), approved by the data owner, and lab effects applied in `game.js` and `mission.js`. A lab is a long-term choice against buying a new part, which adds strategy without adding screens.

## 5. Difficulty and replayability

The content is small, so practice is the hook: the player learns by flying again.

- **Weighted tiers** (section 1) give each tier a different feel, not just a smaller budget.
- **Different paths through the research tree.** Because research is gated by lessons and knowledge, two campaigns can reach modern parts by different routes.
- **Fresh luck per flight** (done): the same design faces different events in a campaign.
- **Historical challenge mode:** "beat history". For each era topic, match or beat the real mission's year and cost, for example reaching radiation-belt knowledge before Explorer 3's March 1958.
- **Daily seed:** everyone gets the same events today, to compare scores (local only; no server).
- **Medals for best practices:** the lesson ids double as achievements on the hub, so practising good engineering is visible.
