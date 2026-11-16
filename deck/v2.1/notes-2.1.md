# GRAVITRON deck 2.1: speaker notes

Built from the release/v2.1 branch (abc4acb). Speaking order: data and rules (Yareem), UI and UX (Angad), story (Ryan and Austin), game experience (Ajay), then proof and the close.


## Slide 1
OPEN (about 25 seconds). We are Hackstreet Bros, and this is GRAVITRON for the NASA Space Apps challenge Space Mission Design Game. The problem: spacecraft design is a chain of trade-offs, and every part fixes one problem and creates the next. The solution: a browser game where you pick a job, build the satellite, fly it and read why it worked or failed. Why it matters: it teaches mission design to anyone with a browser, on real NASA and Canadian data. The picture is the real home page of version 2.1: Part 1 is Austin's guided 1958 walkthrough, Part 2 is Ajay's comeback, and Quick mode is a one-flight game.

Speaking order: data and rules (Yareem), then UI and UX (Angad), the story (Ryan and Austin), the game experience (Ajay), then proof and what is next.

Sources: SPEC.md (what we are building; how we are judged); CHANGELOG.md, Unreleased and 2.0. The recording was made from the release/v2.1 branch (abc4acb); its footer still reads v2.0 until the team cuts the version. The page header says SNAPSHOT because the recording ran offline.


## Slide 2
DATA AND RULES (about 35 seconds, Yareem). Real data decides what happens. NASA FIRMS gives 3,693,555 fire detections for 2025; the NSIDC Sea Ice Index gives 4.75 million square kilometres of Arctic ice in September 2025; SILSO sunspot numbers drive solar storms; and the Canadian Space Agency's Alouette soundings, 699,369 of them, drive the ionosphere topic.

Orbit choice has a real cost: a low orbit sees 92 percent of the fire detections, a polar orbit all of them, and one geostationary slot 69 percent. The small picture is a real debrief line: in 2025 the Sun averaged 123 sunspots a month, and yearly averages from 1957 to 2025 ran from 4 to 269.

The rules are hard limits on mass, power, budget and data, eight real formulas with hand-worked tests, 27 random events and 14 real missions to compare with. It plays offline from a snapshot; the live NOAA, NASA EONET and CWFIS feeds only add a "right now" line when online.

Be honest: only FIRMS, NSIDC, SILSO and Alouette are marked downloaded and processed in SOURCES.md. Event odds, payouts and fees are game values, not facts.
Sources: data/earth.js (detections 3693555, soundings 699369, orbit_view 0.921 / 1.0 / 0.687); SOURCES.md; CHANGELOG.md (2.0: 27 events after the five added); the debrief picture is a real 2.1 screen (clips p2-debrief details).


## Slide 3
REAL-WORLD RULES (about 40 seconds, Yareem). Two satellite engineers visited our table and told us three things: parts have a lead time, the slowest part sets the schedule, and the clock runs back from the launch date. So in version 2 every part shows how long it takes to arrive, and Build names the long pole: "Longest part: ..., N months. Without it: M months." On Normal and Hard the engineers' facts show "?" until you ask them, for a small fee, so information has a price. The animation is the real Part 2 Build screen: ask the engineers, fit the parts, watch the gauges and the long-pole line.

Money has a price too. The little animation is the workshop: a loan adds cash and debt together, and the credit score drops. In 2.1 credit is a real credit score, 300 to 850, worked out from five weighted factors: payments, debt, history, new loans and mix. The band sets your interest and your loan limit.

Be honest: lead times are rounded game values; the engineers' own figures cannot be checked online and SOURCES.md still says NEEDS HUMAN CHECK. We checked them against Space Nexus ranges. Fees, loan sizes and credit numbers are game values. Counting back from the launch slot and paying to expedite are NOT built yet: that is our next step.
Sources: docs/real-world-plan.md; data/parts.js (lead_months); CHANGELOG.md (2.0 "The long pole", "Lead time for every part", "Paying engineers"; Unreleased "Credit is a real credit score"); SPEC.md ("Loans, credit and a name"); tests/credit.js, tests/info.js.


## Slide 4
UI AND UX (about 35 seconds, Angad). The way through the game is one loop of seven stops: Mission Control, Tracking Station, Workshop, Rocket Yard, Launch Pad, Mission and Debrief. Our teammates told us three things about the screens: too many words, show the part being added to the satellite, and say what a part does. So now a tile flies from the card to the 3D satellite, the satellite thumps, the bars that changed flash with a chip such as plus 1 kg, and the NO GO count beside the next button falls as problems are fixed. Cards are short; a WHY box appears only when a part does not help the job; and clicking a part shows a looping drawing of what it does and its catch. The structure card now says what it CARRIES and what it WEIGHS, which fixes the "20 kg but you get 100 kg" confusion.

The phone pictures are the same game at 390 pixels wide with touch (the first tap on a part says TAP AGAIN TO ADD).

Sources: CHANGELOG.md (Unreleased: "Adding a part has a moment of its own on Build", "Build: one count beside the satellite", Changed: "Fewer words", "Clearer Build"; 1.0: "An animated explainer for every part"); docs/ui-review.md; features.md. The GIF is a real recording of Part 1, step 1 on the release/v2.1 branch.


## Slide 5
STORY (about 35 seconds, Ryan and Austin). The game is told across two generations. In Part 1, 1958, you are Austin Albert, a young rocket engineer building an early satellite. It is a guided tutorial of three short missions, one idea each; the opening is October 1957, with a radio on the bench that will not stop beeping, and then you meet Austin. Part 1 ends with the satellite lost, the programme cut, and Austin's notebook going into a box.

In Part 2, today, his grandson Ajay owes the lenders for a company that never flew. He flies satellites for three client contracts at a time to clear the debt before the deadline. After two flights Iron Eclipse, the rival, offers to clear the debt for the workshop, the patents and the notebook: SELL or REFUSE. There are seven endings, counted on the home page. A story-so-far journal, which a teammate asked for, keeps the plot straight, and between flights small complications strike: a client leaves, a price moves, a supplier runs late.

Names such as Iron Eclipse and Albert Orbital are story only. The loans and the credit score are on this slide's second picture: your name (reputation) is the second thing you must earn.
Sources: SPEC.md ("Two game modes"); CHANGELOG.md (1.0 "A dramatic story", "A choice and seven endings"; 2.0 "STORY SO FAR, a journal", complications); handoff/notes/AJAY-TEXT.md; js/ui-story.js. Pictures: real 2.1 screens (clips p1-story, p2-workshop contracts).


## Slide 6
GAME EXPERIENCE (about 40 seconds, Ajay). This is the part of the game where the choices pay off. Launch is a real lift-off cinematic that ends in orbit with your own satellite. Then the mission runs month by month with pause and fast-forward; an event stops the clock and each choice shows what it costs. In Part 2 a rocket can fail: every rocket has a risk, shown on its card as LOW, MEDIUM or HIGH, and a failed launch loses the satellite and its money while the interest keeps running. We were asked for chances of failing and for more challenges in the way; this is where they are.

The debrief teaches. It leads with the verdict and the money, for example PAID and the profit, then names what limited the flight (a mission design discipline such as Power or Communications), then gives one change to try. Fail, read why, fly again: the same Part 1 design with batteries only gets NOT YET and a TRY THIS that says to fit the solar cells. Part 1 is always winnable with 1958 parts; Part 2 asks for a profit.

Be honest: failure chances, event costs, payouts and fees are game values. The pictures are real recordings; none used forced dice.
Sources: CHANGELOG.md (2.0 "a rocket can fail at launch", events; Unreleased "Debrief leads with the verdict and the money"); data/launchers.js; SPEC.md ("Launch failures, complications and the story journal"); js/ui-mission.js. The NOT YET debrief is clips p1-fail.


## Slide 7
PROOF, WHAT COMES NEXT, TEAM (about 35 seconds, everyone). Proof: eight real formulas with hand-worked tests, and 984 automated checks pass across 17 suites on the 2.1 build (for example comeback 151, migration 177, online 126, api 143, campaign 61, credit 56). It is plain HTML, CSS and JavaScript with no build step, it plays offline, and players keep their saves between versions (tested against saves from earlier versions).

Not finished, said plainly: the leaderboard and the 1v1 duel are built and tested, but the server is not hosted, so those buttons say ONLINE OFF. Next steps from the engineers' plan: pay to expedite slow parts, count back from the launch slot, test blocks and schedule margin. The balance simulation was not re-measured with loans, launch failures and fees together.

Team: Yareem, data and rules; Angad, UI and UX; Ryan and Austin, story; Ajay, game experience. Every source is in SOURCES.md. The QR code is from the team's earlier deck: open it before presenting to confirm it still lands on the game.
Under-18 rule: if any team member is under 18, show roles only, not names (slides 1 and 7).
Sources: tests run on release/v2.1 (abc4acb) with node tests/<name>.js: formulas, api, campaign, comeback, credit, debrief, info, migration, online, saves, speed, uib, verdict, version, world, clarity, perf. NOT run: simulate, play, balance, redteam. CHANGELOG.md ("Not in this version yet"); ONLINE.md; docs/real-world-plan.md.
