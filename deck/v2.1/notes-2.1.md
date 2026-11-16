# GRAVITRON deck 2.1: speaker notes

Built from the release/v2.1 branch (abc4acb). Speaking order: data and rules, UI and UX, story, game experience, then proof, SI use and the close. Team members' names are left off on purpose (see slide 7).


## Slide 1
OPEN (about 25 seconds). We are Hackstreet Bros, and this is GRAVITRON for the NASA Space Apps challenge Space Mission Design Game. The problem: spacecraft design is a chain of trade-offs, and every part fixes one problem and creates the next. The solution: a browser game where you pick a job, build the satellite, fly it and read why it worked or failed. Why it matters: it teaches mission design to anyone with a browser, on real NASA and Canadian data. The picture is the real home page of version 2.1: Part 1 is Austin's guided 1958 walkthrough, Part 2 is Ajay's comeback, and Quick mode is a one-flight game.

Speaking order: data and rules, then UI and UX, the story, the game experience, then proof, SI use and what is next. This deck leaves team members' names off on purpose (see slide 7 notes).

Sources: SPEC.md (what we are building; how we are judged); CHANGELOG.md, Unreleased and 2.0. The recording was made from the release/v2.1 branch (abc4acb); its footer still reads v2.0 until the team cuts the version. The page header says SNAPSHOT because the recording ran offline.


## Slide 2
DATA AND REALISM (about 40 seconds, data and rules lead). Real data decides what happens. NASA FIRMS gives 3,693,555 fire detections for 2025; the NSIDC Sea Ice Index gives 4.75 million square kilometres of Arctic ice in September 2025; SILSO sunspot numbers drive solar storms; and the Canadian Space Agency's Alouette soundings, 699,369 of them, drive the ionosphere topic. Orbit choice has a real cost: a low orbit sees 92 percent of the fire detections, a polar orbit all of them, one geostationary slot 69 percent. Each debrief sets your flight against the real record: in 2025 the Sun averaged 123 sunspots a month, and yearly averages from 1957 to 2025 ran from 4 to 269.

How is it realistic? The rules are eight real formulas with hand-worked tests: the rocket equation, orbital period, solar power, eclipse, battery size, image resolution, data budget and margins. The parts, rockets and missions follow real ones: Explorer 1, Vanguard, TIROS and Nimbus bodies, and 14 real missions to compare your design with. The animation is a real flight: a Part 1 satellite with batteries only, as Explorer 1 flew it, runs its battery down and goes silent, and the debrief says so, like Sputnik 1 after 21 days. The game does not forgive physics.

Be honest: only FIRMS, NSIDC, SILSO and Alouette are marked downloaded and processed in SOURCES.md; many part figures still say NEEDS HUMAN CHECK, and numbers without a source are labelled ESTIMATE or GAME VALUE. Event odds, payouts and fees are game values, not facts. It plays offline; the live feeds only add a "right now" line when online.
Sources: data/earth.js (detections 3693555, soundings 699369, orbit_view 0.921 / 1.0 / 0.687); SOURCES.md; CHANGELOG.md (0.5 "Rules": the eight formulas; 2.0: 27 events); SPEC.md (bodies ladder modelled on real spacecraft); data/missions.js (14); the failing flight is clip p1-fail-gif (Part 1, step 1, batteries only; no forced dice).


## Slide 3
REAL-WORLD RULES (about 40 seconds, data and rules lead). Two satellite engineers visited our table and told us three things: parts have a lead time, the slowest part sets the schedule, and the clock runs back from the launch date. So in version 2 every part shows how long it takes to arrive, and Build names the long pole: "Longest part: ..., N months. Without it: M months." On Normal and Hard the engineers' facts show "?" until you ask them, for a small fee, so information has a price. The animation is the real Part 2 Build screen: ask the engineers, fit the parts, watch the gauges and the long-pole line.

Money has a price too. The little animation is the workshop: a loan adds cash and debt together, and the credit score drops. In 2.1 credit is a real credit score, 300 to 850, worked out from five weighted factors: payments, debt, history, new loans and mix. The band sets your interest and your loan limit.

Be honest: lead times are rounded game values; the engineers' own figures cannot be checked online and SOURCES.md still says NEEDS HUMAN CHECK. We checked them against Space Nexus ranges. Fees, loan sizes and credit numbers are game values. Counting back from the launch slot and paying to expedite are NOT built yet: that is our next step.
Sources: docs/real-world-plan.md; data/parts.js (lead_months); CHANGELOG.md (2.0 "The long pole", "Lead time for every part", "Paying engineers"; Unreleased "Credit is a real credit score"); SPEC.md ("Loans, credit and a name"); tests/credit.js, tests/info.js.


## Slide 4
UI AND UX (about 35 seconds, UI and UX lead). The way through the game is one loop of seven stops: Mission Control, Tracking Station, Workshop, Rocket Yard, Launch Pad, Mission and Debrief. Our teammates told us three things about the screens: too many words, show the part being added to the satellite, and say what a part does. So now a tile flies from the card to the 3D satellite, the satellite thumps, the bars that changed flash with a chip such as plus 1 kg, and the NO GO count beside the next button falls as problems are fixed. Cards are short; a WHY box appears only when a part does not help the job; and clicking a part shows a looping drawing of what it does and its catch. The structure card now says what it CARRIES and what it WEIGHS, which fixes the "20 kg but you get 100 kg" confusion.

The phone pictures are the same game at 390 pixels wide with touch (the first tap on a part says TAP AGAIN TO ADD).

Sources: CHANGELOG.md (Unreleased: "Adding a part has a moment of its own on Build", "Build: one count beside the satellite", Changed: "Fewer words", "Clearer Build"; 1.0: "An animated explainer for every part"); docs/ui-review.md; features.md. The GIF is a real recording of Part 1, step 1 on the release/v2.1 branch.


## Slide 5
STORY (about 35 seconds, story lead). The game is told across two generations. In Part 1, 1958, you are Austin Albert, a young rocket engineer building an early satellite. It is a guided tutorial of three short missions, one idea each; the opening is October 1957, with a radio on the bench that will not stop beeping, and then you meet Austin. Part 1 ends with the satellite lost, the programme cut, and Austin's notebook going into a box.

In Part 2, today, his grandson Ajay owes the lenders for a company that never flew. He flies satellites for three client contracts at a time to clear the debt before the deadline. After two flights Iron Eclipse, the rival, offers to clear the debt for the workshop, the patents and the notebook: SELL or REFUSE. There are seven endings, counted on the home page. A story-so-far journal, which a teammate asked for, keeps the plot straight, and between flights small complications strike: a client leaves, a price moves, a supplier runs late.

Names such as Iron Eclipse and Albert Orbital are story only. The loans and the credit score are on this slide's second picture: your name (reputation) is the second thing you must earn.
Sources: SPEC.md ("Two game modes"); CHANGELOG.md (1.0 "A dramatic story", "A choice and seven endings"; 2.0 "STORY SO FAR, a journal", complications); handoff/notes/AJAY-TEXT.md; js/ui-story.js. Pictures: real 2.1 screens (clips p1-story, p2-workshop contracts).


## Slide 6
GAME EXPERIENCE (about 40 seconds, game experience lead). This is the part of the game where the choices pay off. Launch is a real lift-off cinematic that ends in orbit with your own satellite. Then the mission runs month by month with pause and fast-forward; an event stops the clock and each choice shows what it costs. In Part 2 a rocket can fail: every rocket has a risk, shown on its card as LOW, MEDIUM or HIGH, and a failed launch loses the satellite and its money while the interest keeps running. We were asked for chances of failing and for more challenges in the way; this is where they are.

The debrief teaches. It leads with the verdict and the money, for example PAID and the profit, then names what limited the flight (a mission design discipline such as Power or Communications), then gives one change to try. Fail, read why, fly again: the same Part 1 design with batteries only gets NOT YET and a TRY THIS that says to fit the solar cells. Part 1 is always winnable with 1958 parts; Part 2 asks for a profit.

Be honest: failure chances, event costs, payouts and fees are game values. The pictures are real recordings; none used forced dice.
Sources: CHANGELOG.md (2.0 "a rocket can fail at launch", events; Unreleased "Debrief leads with the verdict and the money"); data/launchers.js; SPEC.md ("Launch failures, complications and the story journal"); js/ui-mission.js. The NOT YET debrief is clips p1-fail.


## Slide 7
PROOF, SI USE, WHAT COMES NEXT, TEAM (about 45 seconds, everyone). Proof: eight real formulas with hand-worked tests, and 984 automated checks pass across 17 suites on the 2.1 build (for example comeback 151, migration 177, online 126, api 143, campaign 61, credit 56). It is plain HTML, CSS and JavaScript with no build step, it plays offline, and players keep their saves between versions.

Use of super intelligence, which the submission form asks about. We worked with an SI assistant throughout. It wrote much of the game code, the tests and the documents, working from the team's design mock-up, directions and story. The team decided what the game is: the design, the story, the rules and what counts as realistic. Every number in the data files carries a source or is labelled ESTIMATE or GAME VALUE, and we say plainly that most sources still need a human check. The tests run on every build. The full record of where an SI worked, and the tools used, is SI_USE.md, and it is listed in SOURCES.md.

Not finished, said plainly: the leaderboard and the 1v1 duel are built and tested, but the server is not hosted, so those buttons say ONLINE OFF. Next steps from the engineers' plan: pay to expedite slow parts, count back from the launch slot, test blocks and schedule margin. The balance simulation was not re-measured with loans, launch failures and fees together. Quick mode, in the picture, is a one-flight game that works offline.

Team: Hackstreet Bros, by role: data and rules, UI and UX, story, game experience. Names are left off on purpose: the local event asks minors not to use their own name in the submission, and NASA's guide bars images, audio or likeness of anyone under 18. NASA's tips for decks list member names, so if everyone is 18 or over, add them back on slides 1 and 7; the NASA team page lists the members either way. The QR code opens the game.
Note for the team: this deck does not name the SI tool or models, by the team's house rule. The form field "Use of Super Intelligence (SI)" and SI_USE.md must name them.
Sources: SPEC.md ("Submission checklist": the SI field; "Two game modes"); SI_USE.md; SOURCES.md ("Tools and other resources"); tests run on release/v2.1 (abc4acb) with node tests/<name>.js: formulas, api, campaign, comeback, credit, debrief, info, migration, online, saves, speed, uib, verdict, version, world, clarity, perf. NOT run: simulate, play, balance, redteam. CHANGELOG.md ("Not in this version yet"); ONLINE.md.
