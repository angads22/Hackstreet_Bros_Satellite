// tests/ledger.js — Part 2's money screens: the contract's net and next month's interest (v1.2, builder C).
// Both are computed return values: they must never reach the save (SPEC.md, "Existing players keep their saves").
// Run from the repo root:  node tests/ledger.js
var load = require("./load");
var store = load.memoryStorage();
var G = load({ storage: store });
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}

["training", "standard", "expert"].forEach(function (tier) {
  var c0 = G.newComeback(tier, 7);
  var h = G.getComeback();
  var cs = h.contracts;
  check(tier + ": three contracts are open", cs.length === G.CAMPAIGN.comeback.contracts_open, "got " + cs.length);

  // The net is the price minus the cheapest launchable design for the contract's topic and orbit (the same search the rest uses).
  var c = G.getCampaign();
  var allOk = cs.every(function (k) {
    var cheapest = G.cheapestLaunchCost(c, k.topic, k.orbit);
    return isFinite(cheapest) ? (k.cheapest_cost_musd === cheapest && Math.abs(k.net_musd - (k.price_musd - cheapest)) < 1e-9)
                              : (k.cheapest_cost_musd === null && k.net_musd === null);
  });
  check(tier + ": net_musd is price minus the cheapest known cost", allOk, cs.map(function (k) { return k.topic + " " + k.net_musd; }).join(", "));
  check(tier + ": a contract that can launch has a number", cs.every(function (k) { return typeof k.net_musd === "number" && typeof k.cheapest_cost_musd === "number"; }));

  // The order is the back end's own: the UI sorts a copy.
  var ids = cs.map(function (k) { return k.id; }).join(",");
  var again = G.getComeback().contracts.map(function (k) { return k.id; }).join(",");
  check(tier + ": the contracts keep their order from call to call", ids === again);

  // Next month's interest: the debt grown by one month minus the debt, rounded like the rest of the money.
  var expect = G.round(G.accrueInterest(h.debt_musd, 1) - h.debt_musd, 3);
  check(tier + ": next_interest_musd is one month of interest", h.next_interest_musd === expect && h.next_interest_musd > 0,
    h.next_interest_musd + " on " + h.debt_musd);
  check(tier + ": next_interest_musd matches the rate", Math.abs(h.next_interest_musd - h.debt_musd * G.CAMPAIGN.comeback.interest_per_month) < 0.0006);

  // Nothing new is saved: the save has no such field, so an old save loads and reads the same.
  var saved = JSON.stringify(G.getCampaign());
  check(tier + ": neither value is in the save", saved.indexOf("net_musd") === -1 && saved.indexOf("cheapest_cost_musd") === -1 && saved.indexOf("next_interest") === -1);
  var G2 = load({ storage: store });
  var h2 = G2.getComeback();
  check(tier + ": a reload gives the same values", h2.next_interest_musd === h.next_interest_musd &&
    JSON.stringify(h2.contracts) === JSON.stringify(h.contracts));
});

// The interest follows the debt: paying some back lowers it; a finished run shows none.
G.newComeback("standard", 7);
var before = G.getComeback();
var pay = Math.min(1, before.safe_pay_max_musd);
if (pay > 0) {
  G.payDebt(pay);
  var after = G.getComeback();
  check("paying back lowers next month's interest", after.next_interest_musd < before.next_interest_musd, before.next_interest_musd + " to " + after.next_interest_musd);
}
var cc = G.getCampaign(); cc.debt_musd = 0; G.saveCampaign(cc);
check("no debt, no interest", G.getComeback().next_interest_musd === 0);

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
