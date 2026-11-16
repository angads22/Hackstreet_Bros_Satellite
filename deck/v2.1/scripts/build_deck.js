// build_deck.js: the revised 7-slide GRAVITRON deck (build 2.1). Usage:
//   NODE_PATH=<GRAVITRON-deck>/node_modules VARIANT=full|lite|static OUT=GRAVITRON-2.1.pptx node build_deck.js
const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');
const L = require('./lib_deck.js');
const D = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(D, 'manifest.json'), 'utf8'));
const variant = process.env.VARIANT || 'full';
const OUT = path.join(D, process.env.OUT || ('GRAVITRON-2.1-' + variant + '.pptx'));

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = 'GRAVITRON: The Gravitronical Odyssey';
pres.author = 'Team Hackstreet Bros';
const K = L.make(pres, manifest, path.join(D, 'media'), variant);
const { C, F, W, H, MX, B, T, O, G, Tl } = K;
const slide = () => { const s = pres.addSlide(); s.background = { color: C.bg }; return s; };

// a block: mono label, then one plain sentence
function block(s, label, text, x, y, w, h, size, color) {
  K.label(s, label, x, y, w, color || C.orange, 11);
  K.text(s, [T(text)], x, y + 0.3, w, h - 0.3, size || 15);
}

// ============ 1. COVER ============
{
  const s = slide();
  K.label(s, 'NASA SPACE APPS 2026  ·  SPACE MISSION DESIGN GAME', MX, 0.55, 5.3, C.teal, 10, { charSpacing: 0 });
  s.addText('GRAVITRON', { x: MX, y: 0.9, w: 5.2, h: 1.1, fontFace: F.head, fontSize: 58, bold: true, color: C.orange, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Title' });
  K.text(s, [T('The Gravitronical Odyssey')], MX, 2.02, 5.1, 0.5, 24, { bold: true });
  K.text(s, [G('Design a satellite. Launch it. Learn why.')], MX, 2.6, 5.1, 0.4, 16);
  K.text(s, [O('PROBLEM  '), T('Every part fixes one problem and creates the next.')], MX, 3.3, 5.1, 0.6, 15);
  K.text(s, [O('SOLUTION  '), T('Pick a job, build it, fly it, read why.')], MX, 4.0, 5.1, 0.6, 15);
  K.text(s, [O('WHY IT MATTERS  '), T('Mission design for anyone with a browser, on real NASA and Canadian data.')], MX, 4.7, 5.1, 0.9, 15);
  K.label(s, 'TEAM HACKSTREET BROS', MX, 5.9, 5.1, C.teal, 11);
  K.text(s, [T('Angad  ·  Ajay  ·  Austin  ·  Ryan  ·  Yareem')], MX, 6.2, 5.2, 0.4, 15);
  K.caption(s, 'Version 2.1  ·  a browser game in plain HTML, CSS and JavaScript', MX, 6.85, 5.2);
  const r = K.pic(s, 'home', 5.85, 1.2, 6.95, 4.5, 'The GRAVITRON home page: Part 1, Part 2 and Quick mode over a low-poly Earth', 'left');
  K.caption(s, 'The real home page: three modes over the low-poly Earth.', r.x, r.y + r.h + 0.12, r.w);
  s.addNotes(`OPEN (about 25 seconds). We are Hackstreet Bros, and this is GRAVITRON for the NASA Space Apps challenge Space Mission Design Game. The problem: spacecraft design is a chain of trade-offs, and every part fixes one problem and creates the next. The solution: a browser game where you pick a job, build the satellite, fly it and read why it worked or failed. Why it matters: it teaches mission design to anyone with a browser, on real NASA and Canadian data. The picture is the real home page of version 2.1: Part 1 is Austin's guided 1958 walkthrough, Part 2 is Ajay's comeback, and Quick mode is a one-flight game.

Speaking order: data and rules (Yareem), then UI and UX (Angad), the story (Ryan and Austin), the game experience (Ajay), then proof and what is next.

Sources: SPEC.md (what we are building; how we are judged); CHANGELOG.md, Unreleased and 2.0. The recording was made from the release/v2.1 branch (abc4acb); its footer still reads v2.0 until the team cuts the version. The page header says SNAPSHOT because the recording ran offline.`);
}

// ============ 2. REAL DATA ============
{
  const s = slide();
  K.title(s, 'Real data runs the game');
  K.kicker(s, 'BACKEND  ·  DATA, RULES AND SIMULATION  ·  YAREEM');
  const cards = [
    ['NASA FIRMS', '3,693,555', 'fire detections in 2025'],
    ['NSIDC SEA ICE INDEX', '4.75M km²', 'of Arctic ice, September 2025'],
    ['SILSO SUNSPOTS', 'The real Sun', 'monthly sunspot numbers, 1957 to 2025'],
    ['CSA ALOUETTE (CANADA)', '699,369', 'ionosphere soundings'],
  ];
  cards.forEach((c, i) => {
    const x = MX + i * 3.12, y = 1.55;
    K.panel(s, x, y, 2.95, 1.5, 'Card ' + c[0]);
    K.label(s, c[0], x + 0.15, y + 0.12, 2.7, C.teal, 10);
    K.text(s, [{ text: c[1], options: { bold: true, color: C.text } }], x + 0.15, y + 0.45, 2.7, 0.55, 26);
    K.text(s, [G(c[2])], x + 0.15, y + 1.02, 2.7, 0.4, 12);
  });
  K.label(s, 'SHARE OF 2025 FIRE DETECTIONS EACH ORBIT CAN SEE', MX, 3.3, 6.4, C.orange, 11);
  s.addChart(pres.charts.BAR, [{ name: 'Share seen', labels: ['Low Earth orbit', 'Polar orbit', 'Geostationary'], values: [92, 100, 69] }], {
    x: MX, y: 3.55, w: 6.2, h: 2.5, barDir: 'bar', chartColors: [C.orange], catAxisOrientation: 'maxMin',
    catAxisLabelColor: C.text, catAxisLabelFontFace: F.body, catAxisLabelFontSize: 14, valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 110,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, catAxisLineShow: false, showLegend: false, showValue: true,
    dataLabelColor: C.text, dataLabelFontFace: F.body, dataLabelFontSize: 14, dataLabelFormatCode: '0"%"', dataLabelPosition: 'outEnd', barGapWidthPct: 45,
  });
  K.label(s, 'IN THE DEBRIEF: THE REAL RECORD', 7.15, 3.3, 5.6, C.orange, 11);
  K.pic(s, 'crop-real-earth', 7.15, 3.65, 5.6, 1.5, 'The debrief compares the flight with the real sunspot record', 'left');
  K.caption(s, 'Every debrief sets your flight against the real record.', 7.15, 5.22, 5.6);
  K.panel(s, MX, 6.2, W - 2 * MX, 0.5, 'Rules strip');
  K.text(s, [O('THE RULES  '), T('Hard limits on mass, power, budget and data  ·  8 real formulas  ·  27 events  ·  14 real missions'), ], MX + 0.15, 6.3, W - 2 * MX - 0.3, 0.3, 13, { valign: 'middle' });
  K.caption(s, 'Plays offline from a data snapshot. Live NOAA, NASA EONET and CWFIS feeds add a "right now" line only when online.', MX, 6.82, 10.8);
  K.page(s, 2);
  s.addNotes(`DATA AND RULES (about 35 seconds, Yareem). Real data decides what happens. NASA FIRMS gives 3,693,555 fire detections for 2025; the NSIDC Sea Ice Index gives 4.75 million square kilometres of Arctic ice in September 2025; SILSO sunspot numbers drive solar storms; and the Canadian Space Agency's Alouette soundings, 699,369 of them, drive the ionosphere topic.

Orbit choice has a real cost: a low orbit sees 92 percent of the fire detections, a polar orbit all of them, and one geostationary slot 69 percent. The small picture is a real debrief line: in 2025 the Sun averaged 123 sunspots a month, and yearly averages from 1957 to 2025 ran from 4 to 269.

The rules are hard limits on mass, power, budget and data, eight real formulas with hand-worked tests, 27 random events and 14 real missions to compare with. It plays offline from a snapshot; the live NOAA, NASA EONET and CWFIS feeds only add a "right now" line when online.

Be honest: only FIRMS, NSIDC, SILSO and Alouette are marked downloaded and processed in SOURCES.md. Event odds, payouts and fees are game values, not facts.
Sources: data/earth.js (detections 3693555, soundings 699369, orbit_view 0.921 / 1.0 / 0.687); SOURCES.md; CHANGELOG.md (2.0: 27 events after the five added); the debrief picture is a real 2.1 screen (clips p2-debrief details).`);
}

// ============ 3. ENGINEERS ============
{
  const s = slide();
  K.title(s, 'We asked satellite engineers, then built it');
  K.kicker(s, 'BACKEND  ·  FROM TWO SATELLITE ENGINEERS WHO VISITED OUR TABLE');
  const r = K.pic(s, 'p2-build', MX, 1.5, 7.0, 5.05, 'Part 2 Build: asking the engineers, fitting parts, and the longest-part line', 'left');
  K.caption(s, 'Part 2, Normal: ask the engineers, fit the parts, and Build names the slowest one.', MX, r.y + r.h + 0.1, 7.0);
  const X = 8.2, Wd = 4.6;
  block(s, 'LEAD TIME AND THE LONG POLE', 'Every part shows how long it takes to arrive. The slowest part sets the date, and Build names it.', X, 1.5, Wd, 1.3, 15);
  block(s, 'ASK THE ENGINEERS', 'On Normal and Hard, part facts cost cash. You choose what to learn.', X, 2.85, Wd, 1.1, 15);
  K.label(s, 'BORROW AND CREDIT', X, 4.1, Wd, C.orange, 11);
  const b = K.pic(s, 'p2-borrow', X, 4.42, Wd, 2.2, 'Part 2 workshop: a loan changes cash, debt and the credit score', 'left');
  K.caption(s, 'A loan adds cash, but lowers your score.', X, b.y + b.h + 0.08, Wd);
  K.page(s, 3);
  s.addNotes(`REAL-WORLD RULES (about 40 seconds, Yareem). Two satellite engineers visited our table and told us three things: parts have a lead time, the slowest part sets the schedule, and the clock runs back from the launch date. So in version 2 every part shows how long it takes to arrive, and Build names the long pole: "Longest part: ..., N months. Without it: M months." On Normal and Hard the engineers' facts show "?" until you ask them, for a small fee, so information has a price. The animation is the real Part 2 Build screen: ask the engineers, fit the parts, watch the gauges and the long-pole line.

Money has a price too. The little animation is the workshop: a loan adds cash and debt together, and the credit score drops. In 2.1 credit is a real credit score, 300 to 850, worked out from five weighted factors: payments, debt, history, new loans and mix. The band sets your interest and your loan limit.

Be honest: lead times are rounded game values; the engineers' own figures cannot be checked online and SOURCES.md still says NEEDS HUMAN CHECK. We checked them against Space Nexus ranges. Fees, loan sizes and credit numbers are game values. Counting back from the launch slot and paying to expedite are NOT built yet: that is our next step.
Sources: docs/real-world-plan.md; data/parts.js (lead_months); CHANGELOG.md (2.0 "The long pole", "Lead time for every part", "Paying engineers"; Unreleased "Credit is a real credit score"); SPEC.md ("Loans, credit and a name"); tests/credit.js, tests/info.js.`);
}

// ============ 4. UI AND UX ============
{
  const s = slide();
  K.title(s, 'Design it: every click shows its cost');
  K.kicker(s, 'UI AND UX  ·  ANGAD  ·  SEVEN STOPS, FROM MISSION CONTROL TO DEBRIEF');
  const r = K.pic(s, 'p1-build', MX, 1.5, 7.2, 5.05, 'Part 1 Build: parts fly onto a 3D satellite and the four bars change', 'left');
  K.caption(s, 'Part 1 Build: each part flies onto the 3D satellite, the bars flash, the NO GO count falls.', MX, r.y + r.h + 0.1, 7.4);
  const X = 8.1, Wd = 4.7;
  block(s, 'SEE IT ADDED', 'A tile flies to the satellite. The bars flash and show the change.', X, 1.5, Wd, 1.05, 15);
  block(s, 'FEWER WORDS', 'Short cards and one hint at a time. A WHY box says when a part does not help the job.', X, 2.6, Wd, 1.3, 15);
  block(s, 'WHAT IT DOES', 'Click a part: a looping drawing shows what it does, and its catch.', X, 3.95, Wd, 1.05, 15);
  K.label(s, 'ON A PHONE, TOO', X, 5.05, Wd, C.orange, 11);
  K.pic(s, 'phone-home', X, 5.35, 1.0, 1.75, 'Home page on a phone', 'left');
  K.pic(s, 'phone-build', X + 1.15, 5.35, 1.0, 1.75, 'Build screen on a phone', 'left');
  K.text(s, [G('390 px wide, with touch and keyboard.')], X + 2.45, 5.4, 2.2, 0.8, 13);
  K.page(s, 4);
  s.addNotes(`UI AND UX (about 35 seconds, Angad). The way through the game is one loop of seven stops: Mission Control, Tracking Station, Workshop, Rocket Yard, Launch Pad, Mission and Debrief. Our teammates told us three things about the screens: too many words, show the part being added to the satellite, and say what a part does. So now a tile flies from the card to the 3D satellite, the satellite thumps, the bars that changed flash with a chip such as plus 1 kg, and the NO GO count beside the next button falls as problems are fixed. Cards are short; a WHY box appears only when a part does not help the job; and clicking a part shows a looping drawing of what it does and its catch. The structure card now says what it CARRIES and what it WEIGHS, which fixes the "20 kg but you get 100 kg" confusion.

The phone pictures are the same game at 390 pixels wide with touch (the first tap on a part says TAP AGAIN TO ADD).

Sources: CHANGELOG.md (Unreleased: "Adding a part has a moment of its own on Build", "Build: one count beside the satellite", Changed: "Fewer words", "Clearer Build"; 1.0: "An animated explainer for every part"); docs/ui-review.md; features.md. The GIF is a real recording of Part 1, step 1 on the release/v2.1 branch.`);
}

// ============ 5. STORY ============
{
  const s = slide();
  K.title(s, 'Two parts, one family');
  K.kicker(s, 'STORY  ·  RYAN AND AUSTIN  ·  AUSTIN\'S 1958 AND AJAY\'S TODAY');
  const g = K.pic(s, 'p1-story', MX, 1.5, 6.0, 2.62, 'Part 1 opens in October 1957 with story lines typing in', 'left');
  K.caption(s, 'Part 1 opens in October 1957 and introduces Austin Albert.', MX, g.y + g.h + 0.08, 6.0);
  const c = K.pic(s, 'crop-contracts', MX, 4.5, 6.0, 2.3, 'Part 2 workshop: credit, your name and three client contracts', 'left');
  K.caption(s, 'Part 2: Ajay flies for clients to clear his debt.', MX, c.y + c.h + 0.06, 6.0);
  const X = 7.1, Wd = 5.7;
  block(s, 'PART 1  ·  1958', 'Austin Albert, a young rocket engineer, builds an early satellite. Three short missions, one lesson each.', X, 1.5, Wd, 1.3, 15, C.teal);
  block(s, 'PART 2  ·  TODAY', 'His grandson Ajay owes the lenders. He flies satellites for clients to clear the debt and keep the workshop.', X, 2.9, Wd, 1.4, 15);
  block(s, 'A CHOICE', 'After two flights, Iron Eclipse offers to clear the debt: SELL or REFUSE. Seven endings.', X, 4.4, Wd, 1.3, 15);
  block(s, 'KEEP TRACK', 'A story-so-far journal keeps the plot straight.', X, 5.75, Wd, 0.9, 15);
  K.page(s, 5);
  s.addNotes(`STORY (about 35 seconds, Ryan and Austin). The game is told across two generations. In Part 1, 1958, you are Austin Albert, a young rocket engineer building an early satellite. It is a guided tutorial of three short missions, one idea each; the opening is October 1957, with a radio on the bench that will not stop beeping, and then you meet Austin. Part 1 ends with the satellite lost, the programme cut, and Austin's notebook going into a box.

In Part 2, today, his grandson Ajay owes the lenders for a company that never flew. He flies satellites for three client contracts at a time to clear the debt before the deadline. After two flights Iron Eclipse, the rival, offers to clear the debt for the workshop, the patents and the notebook: SELL or REFUSE. There are seven endings, counted on the home page. A story-so-far journal, which a teammate asked for, keeps the plot straight, and between flights small complications strike: a client leaves, a price moves, a supplier runs late.

Names such as Iron Eclipse and Albert Orbital are story only. The loans and the credit score are on this slide's second picture: your name (reputation) is the second thing you must earn.
Sources: SPEC.md ("Two game modes"); CHANGELOG.md (1.0 "A dramatic story", "A choice and seven endings"; 2.0 "STORY SO FAR, a journal", complications); handoff/notes/AJAY-TEXT.md; js/ui-story.js. Pictures: real 2.1 screens (clips p1-story, p2-workshop contracts).`);
}

// ============ 6. GAME EXPERIENCE ============
{
  const s = slide();
  K.title(s, 'Fly it. It can go wrong. Read why.');
  K.kicker(s, 'GAME EXPERIENCE  ·  AJAY  ·  LAUNCH, MISSION, DEBRIEF');
  const row = [['p1-launch', 4.45, 'LAUNCH', 'Part 1: the whole lift-off, ending IN ORBIT.', 'The lift-off from the pad to orbit'],
               ['p2-mission', 3.75, 'MISSION', 'Part 2: months tick by, then an event stops the clock.', 'Part 2 mission with an event and its choices'],
               ['p2-debrief', 3.75, 'DEBRIEF', 'Part 2: the verdict and the money come first.', 'Part 2 debrief: PAID with the profit']];
  let x = MX;
  row.forEach(r => {
    const m = K.pic(s, r[0], x, 1.5, r[1], 2.75, r[4], 'left');
    K.label(s, r[2], x, 1.5 + m.h + 0.12, r[1], C.orange, 11);
    K.text(s, [G(r[3])], x, 1.5 + m.h + 0.4, r[1], 0.5, 13);
    x += r[1] + 0.2;
  });
  const Wd = 3.95, y = 5.45;
  block(s, 'ROCKETS CAN FAIL', 'Every rocket shows its risk: LOW, MEDIUM or HIGH. A failed launch loses the satellite and its money.', MX, y, Wd, 1.6, 14);
  block(s, 'EVENTS COST SOMETHING', 'An event stops the clock. Each choice shows what it costs.', MX + Wd + 0.2, y, Wd, 1.6, 14);
  block(s, 'THE DEBRIEF TEACHES', 'It names what limited the flight and suggests one change. Redesign, fly again.', MX + 2 * (Wd + 0.2), y, Wd, 1.6, 14);
  K.page(s, 6);
  s.addNotes(`GAME EXPERIENCE (about 40 seconds, Ajay). This is the part of the game where the choices pay off. Launch is a real lift-off cinematic that ends in orbit with your own satellite. Then the mission runs month by month with pause and fast-forward; an event stops the clock and each choice shows what it costs. In Part 2 a rocket can fail: every rocket has a risk, shown on its card as LOW, MEDIUM or HIGH, and a failed launch loses the satellite and its money while the interest keeps running. We were asked for chances of failing and for more challenges in the way; this is where they are.

The debrief teaches. It leads with the verdict and the money, for example PAID and the profit, then names what limited the flight (a mission design discipline such as Power or Communications), then gives one change to try. Fail, read why, fly again: the same Part 1 design with batteries only gets NOT YET and a TRY THIS that says to fit the solar cells. Part 1 is always winnable with 1958 parts; Part 2 asks for a profit.

Be honest: failure chances, event costs, payouts and fees are game values. The pictures are real recordings; none used forced dice.
Sources: CHANGELOG.md (2.0 "a rocket can fail at launch", events; Unreleased "Debrief leads with the verdict and the money"); data/launchers.js; SPEC.md ("Launch failures, complications and the story journal"); js/ui-mission.js. The NOT YET debrief is clips p1-fail.`);
}

// ============ 7. PROOF, TEAM, NEXT ============
{
  const s = slide();
  K.title(s, 'Built, checked, and what comes next');
  K.kicker(s, 'PROOF  ·  TEAM  ·  NEXT');
  const X = MX, Wd = 7.6;
  block(s, 'PROOF', 'Eight real formulas with hand-worked tests. 984 automated checks pass across 17 suites.', X, 1.5, Wd, 1.0, 16, C.teal);
  block(s, 'BUILT TO RUN ANYWHERE', 'Plain HTML, CSS and JavaScript, no build step. It plays offline. Saves carry over between versions.', X, 2.6, Wd, 1.1, 16, C.teal);
  block(s, 'NOT FINISHED', 'The leaderboard and 1v1 duel are built, but our server is not hosted. Next: pay to expedite slow parts and count back from launch.', X, 3.85, Wd, 1.4, 16);
  K.label(s, 'TEAM HACKSTREET BROS', X, 5.35, Wd, C.teal, 11);
  K.text(s, [{ text: 'Yareem, data and rules  ·  Angad, UI and UX', options: { breakLine: true } }, { text: 'Ryan and Austin, story  ·  Ajay, game experience', options: {} }], X, 5.65, Wd, 0.9, 16);
  K.caption(s, 'References: every source is listed in SOURCES.md.', X, 6.62, Wd);
  s.addShape(pres.shapes.RECTANGLE, { x: 9.0, y: 1.5, w: 2.4, h: 2.4, fill: { color: 'FFFFFF' }, line: { color: C.edge, width: 0.75 }, objectName: 'QR frame' });
  s.addImage({ path: path.join(D, 'assets', 'qr.png'), x: 9.1, y: 1.6, w: 2.2, h: 2.2, altText: 'QR code that opens the game', objectName: 'QR code' });
  K.text(s, [{ text: 'Scan to play', options: { bold: true, color: C.text } }], 9.0, 4.0, 2.4, 0.35, 16, { align: 'center' });
  s.addText('Design. Launch. Learn.', { x: 8.3, y: 5.0, w: 4.5, h: 0.8, fontFace: F.head, fontSize: 30, bold: true, color: C.orange, margin: 0, align: 'center', valign: 'middle', isTextBox: true, objectName: 'Closing line' });
  K.page(s, 7);
  s.addNotes(`PROOF, WHAT COMES NEXT, TEAM (about 35 seconds, everyone). Proof: eight real formulas with hand-worked tests, and 984 automated checks pass across 17 suites on the 2.1 build (for example comeback 151, migration 177, online 126, api 143, campaign 61, credit 56). It is plain HTML, CSS and JavaScript with no build step, it plays offline, and players keep their saves between versions (tested against saves from earlier versions).

Not finished, said plainly: the leaderboard and the 1v1 duel are built and tested, but the server is not hosted, so those buttons say ONLINE OFF. Next steps from the engineers' plan: pay to expedite slow parts, count back from the launch slot, test blocks and schedule margin. The balance simulation was not re-measured with loans, launch failures and fees together.

Team: Yareem, data and rules; Angad, UI and UX; Ryan and Austin, story; Ajay, game experience. Every source is in SOURCES.md. The QR code is from the team's earlier deck: open it before presenting to confirm it still lands on the game.
Under-18 rule: if any team member is under 18, show roles only, not names (slides 1 and 7).
Sources: tests run on release/v2.1 (abc4acb) with node tests/<name>.js: formulas, api, campaign, comeback, credit, debrief, info, migration, online, saves, speed, uib, verdict, version, world, clarity, perf. NOT run: simulate, play, balance, redteam. CHANGELOG.md ("Not in this version yet"); ONLINE.md; docs/real-world-plan.md.`);
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  const mb = (fs.statSync(OUT).size / 1048576).toFixed(2);
  console.log('wrote', OUT, mb + ' MB;', K.used.length, 'pictures;', 'variant', variant);
})();
