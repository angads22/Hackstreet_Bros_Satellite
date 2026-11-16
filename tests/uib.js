// tests/uib.js — version 2.1, the UI review items' back end: getContractOrder() (contract sort and "best pay") and
// getLedger() (the ledger strip, the interest tick and the deadline cue). Run from the repo root:  node tests/uib.js
var load = require("./load");
var G = load({ storage: load.memoryStorage() });
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-9); }

check("no comeback: getContractOrder is null", G.getContractOrder() === null);
check("no comeback: getLedger is null", G.getLedger() === null);

["training", "standard", "expert"].forEach(function (tier) {
  var seeds = [7, 11, 23];
  seeds.forEach(function (seed) {
    G.newComeback(tier, seed);
    var c = G.getCampaign(), hub = G.getComeback(), hints = G.getTier(tier).hints;
    var order = G.getContractOrder();
    var offered = hub.contracts.map(function (k) { return k.id; });
    var tag = tier + "/" + seed;
    check(tag + ": the order holds every contract once", order.ids.length === offered.length && offered.every(function (id) { return order.ids.indexOf(id) !== -1; }));
    var net = {};
    hub.contracts.forEach(function (k) { var cost = G.cheapestLaunchCost(c, k.topic, k.orbit); net[k.id] = isFinite(cost) ? G.round(k.price_musd - cost, 3) : -Infinity; });
    if (hints === "off") {
      check(tag + " (Hard): original order, no best pay", order.ids.join() === offered.join() && order.best_id === null);
    } else {
      var sorted = order.ids.every(function (id, i) { return i === 0 || net[order.ids[i - 1]] >= net[id]; });
      check(tag + ": sorted by net, price minus the cheapest cost", sorted, order.ids.map(function (id) { return net[id]; }).join(" "));
      if (hints === "request") check(tag + " (Normal): sorted but no best pay", order.best_id === null);
      else {
        var firstNet = net[order.ids[0]];
        check(tag + " (Easy): best pay is the first, and only when it earns", order.best_id === (firstNet > 0 && order.ids.length > 1 ? order.ids[0] : null));
      }
    }
    // A stable order: asking twice gives the same answer, and nothing is stored (the save is untouched).
    var before = JSON.stringify(G.getCampaign());
    check(tag + ": the same order twice, the save untouched", JSON.stringify(G.getContractOrder()) === JSON.stringify(order) && JSON.stringify(G.getCampaign()) === before);
  });
});

// The ledger: the facts of the hub, the interest of the next month, the deadline cue.
G.newComeback("standard", 7);
var L = G.getLedger(), H = G.getComeback();
check("ledger: cash, debt and months left are the hub's", L.cash_musd === H.cash_musd && L.debt_musd === H.debt_musd && L.months_left === H.months_left);
var expect = G.round(G.accrueInterest(H.debt_musd, 1, H.interest_per_month) - H.debt_musd, 3);
check("ledger: interest of the next month = the debt after one month, less the debt", near(L.interest_month_musd, expect) && L.interest_month_musd > 0, String(L.interest_month_musd));
check("ledger: the deadline is not near at the start", L.deadline_near === false);
var c = G.getCampaign();
c.month = Math.ceil(c.deadline_month * 0.8);
G.saveCampaign(c);
check("ledger: the deadline is near with a quarter of the months left", G.getLedger().deadline_near === true && G.getLedger().months_left === c.deadline_month - c.month);
c.month = Math.floor(c.deadline_month * 0.5);
G.saveCampaign(c);
check("ledger: not near at half the months", G.getLedger().deadline_near === false);
G.newComeback("standard", 7);
var paid = G.payDebt(1);
var L2 = G.getLedger();
check("ledger: a payment lowers the debt and the interest tick", paid.ok && L2.debt_musd < L.debt_musd && L2.interest_month_musd < L.interest_month_musd);
c = G.getCampaign(); c.debt_musd = 0; G.saveCampaign(c);
check("ledger: no debt, no interest", G.getLedger().interest_month_musd === 0);

// The pace line: the contract's minimum, and the expected finish on Easy and Normal only.
var RAD = ["scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"];
check("pace line: null without a design", G.getPaceLine(null) === null);
["training", "standard", "expert"].forEach(function (tier) {
  G.newComeback(tier, 7);
  var c = G.getCampaign();
  var k = { id: "t-rad", topic: "radiation", orbit: null, client: "A test client", reason: "It tests things.", min_science: 60, price_musd: 10, bonus_musd: 2.5,
            expires_month: c.month + 12, done: false, text: "A test contract." };
  c.offers = (c.offers || []).concat([k]); G.saveCampaign(c);
  var d = G.newComebackDesign("t-rad");
  G.setOrbit(d, "leo"); G.setLauncher(d, "falcon-1" in {} ? "falcon-1" : G.LAUNCHERS[0].id);
  RAD.forEach(function (p) { G.addPart(d, p); });
  var pl = G.getPaceLine(d), target = G.getObjective("radiation").science_target;
  check(tier + ": the minimum tick is the contract's minimum over the bar's target", pl && near(pl.min_share, Math.min(1, 60 / target), 0.001), JSON.stringify(pl));
  var sci = G.previewScience(d);
  if (G.getTier(tier).hints === "off") check(tier + " (Hard): the minimum only, no expected finish", pl.expected_share === null);
  else check(tier + ": the expected finish is the forecast over the target", pl.expected_share === Math.max(0, Math.min(1, G.round(sci.total / target, 3))) && pl.expected_share > 0, String(pl.expected_share));
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
