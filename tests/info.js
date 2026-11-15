// tests/info.js — paying engineers for part information (SPEC.md, "Paying engineers for part information").
// Run from the repo root:  node tests/info.js
// Part 2 only: Easy knows every group of a part, Normal the sheet, Hard nothing; the rest is bought once per run and
// part from the comeback's cash. Part 1 and standalone designs are always free, and the fact functions are unchanged.
var load = require("./load");
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
var same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
function fresh() { var store = load.memoryStorage(); return { store: store, G: load({ storage: store }) }; }
function cents(x) { return Math.round(x * 1000) / 1000; }
var LEVELS = { easy: "training", normal: "standard", hard: "expert" };
var GROUPS = ["sheet", "performance", "dossier"];
var RAD = ["scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"];

function start(level, seed) {
  var f = fresh();
  f.G.newComeback(LEVELS[level], seed === undefined ? 7 : seed);
  var h = f.G.getComeback();
  f.h = h;
  f.d = f.G.newComebackDesign(h.contracts[0].id);
  return f;
}
function cash(G) { return G.getComeback().cash_musd; }
function known(G, d, part) { return GROUPS.map(function (g) { return G.partInfoKnown(d, part, g); }); }

// ---- 1. The fees are game values in the data, and the free groups are a table per level.
(function () {
  var G = fresh().G, CB = G.CAMPAIGN.comeback, fee = CB.info_fee_musd;
  check("1 info_fee_musd has a positive fee for sheet, performance and dossier", GROUPS.every(function (g) { return typeof fee[g] === "number" && fee[g] > 0; }), JSON.stringify(fee));
  check("1 a fee is small against a flight: each is under a tenth of the Hard start cash", GROUPS.every(function (g) { return fee[g] < CB.tiers.expert.cash_musd / 10; }));
  check("1 the free groups: Easy all three, Normal the sheet, Hard none",
    same(CB.info_free.training, GROUPS) && same(CB.info_free.standard, ["sheet"]) && same(CB.info_free.expert, []));
  check("1 the back end reads the same table", same(G.infoFreeGroups("training"), GROUPS) && same(G.infoFreeGroups("standard"), ["sheet"]) && same(G.infoFreeGroups("expert"), []));
})();

// ---- 2. Easy: everything is free and asking costs nothing.
(function () {
  var f = start("easy"), G = f.G, before = cash(G);
  check("2 Easy: every group of a part is known", same(known(G, f.d, "scintillation-counter"), [true, true, true]));
  var r = G.buyPartInfo(f.d, "scintillation-counter", "performance");
  check("2 Easy: asking is ok, costs nothing and takes no cash", r.ok === true && r.cost_musd === 0 && cash(G) === before, JSON.stringify(r));
  check("2 Easy: the fee shown is 0", G.partInfoFee(f.d, "scintillation-counter", "dossier") === 0);
  check("2 Easy: nothing was saved in info", Object.keys(G.getCampaign().info).length === 0);
})();

// ---- 3. Normal: the sheet is free, performance and dossier are paid.
(function () {
  var f = start("normal"), G = f.G, fee = G.CAMPAIGN.comeback.info_fee_musd, before = cash(G), p = "scintillation-counter";
  check("3 Normal: sheet known, performance and dossier unknown", same(known(G, f.d, p), [true, false, false]));
  check("3 Normal: the fee shown is the group's fee, 0 for the free sheet", G.partInfoFee(f.d, p, "performance") === fee.performance && G.partInfoFee(f.d, p, "dossier") === fee.dossier && G.partInfoFee(f.d, p, "sheet") === 0);
  var r = G.buyPartInfo(f.d, p, "performance");
  check("3 Normal: buying performance returns ok and the fee", r.ok === true && r.reason === null && r.cost_musd === fee.performance, JSON.stringify(r));
  check("3 Normal: the cash dropped by exactly the fee", cash(G) === cents(before - fee.performance), before + " -> " + cash(G));
  check("3 Normal: performance is now known, dossier of that part and performance of another part are not",
    G.partInfoKnown(f.d, p, "performance") && !G.partInfoKnown(f.d, p, "dossier") && !G.partInfoKnown(f.d, "thermal-imager", "performance") && G.findById(G.PARTS, "thermal-imager"));
  var again = G.buyPartInfo(f.d, p, "performance");
  check("3 Normal: asking again is free: once per run", again.ok && again.cost_musd === 0 && cash(G) === cents(before - fee.performance), JSON.stringify(again));
  check("3 Normal: the log keeps one fee, not two", G.getCampaign().log.filter(function (e) { return e.kind === "info"; }).length === 1);
  G.buyPartInfo(f.d, p, "dossier");
  check("3 Normal: the dossier costs its own fee on top", cash(G) === cents(before - fee.performance - fee.dossier) && same(known(G, f.d, p), [true, true, true]));
  check("3 Normal: the save keeps what was bought, as a map of part id to groups", same(G.getCampaign().info[p], ["performance", "dossier"]));
  // A page reload (the same storage, a new load) still knows it, and so does a design made after it.
  var G2 = load({ storage: f.store }), d2 = G2.newComebackDesign(G2.getComeback().contracts[0].id);
  check("3 Normal: it stays known after a reload, and for a new design in the same run", G2.partInfoKnown(d2, p, "performance") && G2.partInfoKnown(d2, p, "dossier"));
})();

// ---- 4. Hard: nothing is free.
(function () {
  var f = start("hard"), G = f.G, fee = G.CAMPAIGN.comeback.info_fee_musd, before = cash(G), p = "mercury-battery";
  check("4 Hard: no group of a part is known", same(known(G, f.d, p), [false, false, false]));
  var r = G.buyPartInfo(f.d, p, "sheet");
  check("4 Hard: even the sheet costs, and is then known", r.ok && r.cost_musd === fee.sheet && G.partInfoKnown(f.d, p, "sheet") && cash(G) === cents(before - fee.sheet));
  check("4 Hard: the other groups are still unknown", !G.partInfoKnown(f.d, p, "performance") && !G.partInfoKnown(f.d, p, "dossier"));
  // A careful player on Hard asks about a whole design: every group of its 7 parts must leave room to build and launch it.
  var f2 = start("hard"), G2 = f2.G, c0 = cash(G2), spent = 0;
  RAD.forEach(function (id) { GROUPS.forEach(function (g) { spent += G2.buyPartInfo(f2.d, id, g).cost_musd; }); });
  G2.setOrbit(f2.d, "leo"); G2.setLauncher(f2.d, "rideshare"); RAD.forEach(function (id) { G2.addPart(f2.d, id); });
  var price = G2.getTotals(f2.d).cost_musd;
  check("4 Hard: all three groups of a 7-part flight cost under a quarter of the start cash", spent > 0 && spent < c0 / 4, "$" + cents(spent) + "M of $" + c0 + "M");
  check("4 Hard: and the cash left still buys that flight", cash(G2) >= price, "cash $" + cash(G2) + "M, flight $" + price + "M");
})();

// ---- 5. Not enough cash: nothing is bought and the reason says so.
(function () {
  var f = start("hard"), G = f.G, c = G.getCampaign();
  c.treasury_musd = 0.03; G.saveCampaign(c);
  var r = G.buyPartInfo(f.d, "radio-uhf", "performance");
  check("5 not enough cash: not ok, a reason that says cash, the fee that would be charged", r.ok === false && /cash/i.test(r.reason) && r.cost_musd === G.CAMPAIGN.comeback.info_fee_musd.performance, JSON.stringify(r));
  check("5 not enough cash: the cash and the info are untouched, the group stays unknown", cash(G) === 0.03 && !G.partInfoKnown(f.d, "radio-uhf", "performance") && Object.keys(G.getCampaign().info).length === 0 &&
    G.getCampaign().log.filter(function (e) { return e.kind === "info"; }).length === 0);
  var ok = G.buyPartInfo(f.d, "radio-uhf", "sheet");
  check("5 a cheaper group still fits what is left", ok.ok && cash(G) === cents(0.03 - G.CAMPAIGN.comeback.info_fee_musd.sheet));
  var c2 = G.getCampaign(); c2.treasury_musd = G.CAMPAIGN.comeback.info_fee_musd.dossier; G.saveCampaign(c2);
  var exact = G.buyPartInfo(f.d, "radio-uhf", "dossier");
  check("5 exactly the fee in cash is enough, and leaves 0", exact.ok && cash(G) === 0);
})();

// ---- 5b. No dead end: a fee that would leave the cash (and the loans still allowed) unable to pay for any launch is refused.
(function () {
  var f = start("hard"), G = f.G, c = G.getCampaign(), k = G.CAMPAIGN.comeback.credit, fee = G.CAMPAIGN.comeback.info_fee_musd;
  c.credit = k.seize + k.per_loan;   // one more loan would put credit on the seize line: no loan helps
  G.saveCampaign(c);
  var h = G.getComeback(), cheapest = h.cheapest_launch_musd;
  check("5b the setup: no loan is allowed and a launch has a price", h.max_borrow_musd === 0 && cheapest > 0, JSON.stringify({ max: h.max_borrow_musd, cheapest: cheapest }));
  c = G.getCampaign(); c.treasury_musd = cents(cheapest + fee.sheet - 0.005); G.saveCampaign(c);
  var r = G.buyPartInfo(f.d, "radio-uhf", "sheet");
  check("5b a fee that leaves less than the cheapest launch (and no loan) is refused, nothing is taken", r.ok === false && /not enough cash/i.test(r.reason) && cash(G) === cents(cheapest + fee.sheet - 0.005) && !G.partInfoKnown(f.d, "radio-uhf", "sheet"), JSON.stringify(r));
  c = G.getCampaign(); c.treasury_musd = cents(cheapest + fee.sheet); G.saveCampaign(c);
  var ok = G.buyPartInfo(f.d, "radio-uhf", "sheet");
  check("5b a fee that leaves exactly the cheapest launch is allowed", ok.ok === true && cash(G) === cents(cheapest), JSON.stringify(ok));
  check("5b the run is still on, not lost", !G.getComeback().finished);
})();

// ---- 6. Part 1, standalone designs and the lab are free; a bad request is refused.
(function () {
  var f = fresh(), G = f.G;
  var d = G.newDesign("standard");
  check("6 a standalone design (no comeback): every group known, asking is free", same(known(G, d, "scintillation-counter"), [true, true, true]) && G.buyPartInfo(d, "scintillation-counter", "dossier").cost_musd === 0);
  var p1 = G.newDesign("training");
  check("6 Part 1 (Initial Feasibility, no comeback): every group known", same(known(G, p1, "scintillation-counter"), [true, true, true]));
  check("6 no design at all: known", G.partInfoKnown(null, "scintillation-counter", "sheet") === true);
  // Even with a Hard comeback saved, a design that is not a comeback design is free.
  var h = start("hard"), G2 = h.G, cb = G2.newDesign("expert"), before = cash(G2);
  check("6 a non-comeback design on a Hard run is still free, and takes no cash", same(known(G2, cb, "radio-uhf"), [true, true, true]) && G2.buyPartInfo(cb, "radio-uhf", "dossier").ok && cash(G2) === before);
  var bad1 = G2.buyPartInfo(h.d, "radio-uhf", "gossip"), bad2 = G2.buyPartInfo(h.d, "no-such-part", "sheet");
  check("6 an unknown group or part is refused, with a reason and no charge", bad1.ok === false && bad1.reason && bad2.ok === false && bad2.reason && cash(G2) === before);
})();

// ---- 7. The fact functions are unchanged: they still return everything, bought or not.
(function () {
  var f = start("hard"), G = f.G, p = "scintillation-counter";
  G.setOrbit(f.d, "leo"); G.addPart(f.d, p);
  var a = JSON.stringify(G.getPartFacts(f.d, p)), why = JSON.stringify(G.partWhy(f.d, p)), checks = JSON.stringify(G.runChecks(f.d));
  G.buyPartInfo(f.d, p, "sheet"); G.buyPartInfo(f.d, p, "performance");
  check("7 getPartFacts and partWhy return the same with or without a purchase", a === JSON.stringify(G.getPartFacts(f.d, p)) && why === JSON.stringify(G.partWhy(f.d, p)));
  var facts = G.getPartFacts(f.d, p);
  check("7 getPartFacts still has the numbers a hidden group would hide", facts && typeof facts.science_per_month === "number" && facts.science_per_month > 0, JSON.stringify(facts));
  check("7 the readiness review is the same too: buying changes the cash, not the checks", checks === JSON.stringify(G.runChecks(f.d)));
})();

// ---- 8. The debrief's ledger: what the engineers cost this flight, and only this flight.
function fly(G, d) {
  var m = G.startMission(d), s; if (!m) return null;
  do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, Math.max(0, s.event.choices.findIndex(function (c) { return !c.fail_chance_now; }))); } while (!m.ended);
  return m;
}
(function () {
  var f = start("normal"), G = f.G, fee = G.CAMPAIGN.comeback.info_fee_musd, d = f.d;
  G.setOrbit(d, "leo"); G.setLauncher(d, "rideshare"); RAD.forEach(function (id) { G.addPart(d, id); });
  G.buyPartInfo(d, "scintillation-counter", "performance"); G.buyPartInfo(d, "scintillation-counter", "dossier"); G.buyPartInfo(d, "mercury-battery", "performance");
  var paid1 = fee.performance * 2 + fee.dossier, cashBefore = cash(G);
  var cf = G.getCampaign();
  check("8 the fees are logged against the flight they were paid for (the next one)", cf.log.filter(function (e) { return e.kind === "info"; }).every(function (e) { return e.flight === 1; }) &&
    G.infoFeesFor(cf, 1) === cents(paid1) && G.infoFeesFor(cf, 2) === 0);
  var m = fly(G, d), r = G.recordResult(m);
  check("8 the first flight's result carries the engineers' fees, and only that flight's", r && r.engineers_musd === cents(paid1), r && String(r.engineers_musd));
  var fp = G.flightProfit(m);
  check("8 the flight's profit counts the engineers as a cost (so it matches the cash ledger)", fp && fp.engineers_musd === cents(paid1) && fp.cost_musd === cents(fp.launch_musd + fp.event_costs_musd + paid1) &&
    fp.profit_musd === cents(fp.paid_musd - fp.cost_musd), JSON.stringify(fp));
  check("8 the fees were paid before launch: the cash before launch already has them out", cashBefore === cents(f.h.cash_musd - paid1));
  // The second flight pays for its own information only.
  var h2 = G.getComeback(); if (h2.offer) G.refuseBuyout();
  var d2 = G.newComebackDesign(G.getComeback().contracts[0].id);
  if (d2) {
    G.setOrbit(d2, "leo"); G.setLauncher(d2, "rideshare"); RAD.forEach(function (id) { G.addPart(d2, id); });
    var c0 = cash(G);
    G.buyPartInfo(d2, "scintillation-counter", "performance");   // already bought in flight 1: free
    G.buyPartInfo(d2, "radio-uhf", "performance");               // new
    check("8 the second flight pays only for what is new", cash(G) === cents(c0 - fee.performance) && G.infoFeesFor(G.getCampaign(), 2) === fee.performance);
  }
})();

// ---- 9. Every new comeback starts with nothing bought.
(function () {
  var f = start("hard"), G = f.G;
  G.buyPartInfo(f.d, "radio-uhf", "sheet");
  G.newComeback("expert", 9);
  var d = G.newComebackDesign(G.getComeback().contracts[0].id);
  check("9 a new comeback forgets what the last one bought", Object.keys(G.getCampaign().info).length === 0 && !G.partInfoKnown(d, "radio-uhf", "sheet"));
})();

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
