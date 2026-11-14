// tests/speed.js — the back end must never freeze a browser. Run: node tests/speed.js
// Budgets are generous (a slow school laptop is several times slower than this test
// machine); a failure means something became far slower than it should be.
var G = require("./load")();
var passed = 0, failed = 0;
function time(label, budgetMs, fn, n) {
  n = n || 1; fn();                                   // warm up
  var t0 = process.hrtime.bigint();
  for (var i = 0; i < n; i++) fn();
  var ms = Number(process.hrtime.bigint() - t0) / 1e6 / n, ok = ms <= budgetMs;
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + label + ": " + ms.toFixed(2) + " ms (budget " + budgetMs + " ms)");
}
G.resetCampaign(); G.newCampaign("training");
var c = G.getCampaign(); c.research = G.RESEARCH.map(function (r) { return r.id; }); c.treasury_musd = 500; G.saveCampaign(c);
var d = G.newCampaignDesign(); G.setObjective(d, "sea-ice"); G.setOrbit(d, "sso"); G.setLauncher(d, "small");
["sar-radar", "solar-large", "battery-28v", "radio-xband", "obc-basic", "prop-green-large"].forEach(function (p) { G.addPart(d, p); });

// The search caches by research owned; a dummy id gives a fresh (uncached) search each call.
var fresh = 0;
time("rescue-grant search, everything unlocked", 50, function () {
  var cc = G.getCampaign(); cc.research = cc.research.filter(function (r) { return r.indexOf("zz") !== 0; }).concat(["zz" + (fresh++)]);
  G.cheapestLaunchCost(cc);
}, 5);
time("Build screen refresh: totals, checks, preview, payout", 10, function () {
  G.getTotals(d); G.runChecks(d); G.previewScience(d); G.previewPayout(d);
}, 100);
time("hover previews for every part card", 50, function () { G.PARTS.forEach(function (p) { G.previewToggle(d, p.id); }); }, 10);
time("hub refresh", 10, function () { G.getHubInfo(); }, 50);
time("a whole mission, launch to debrief and record", 100, function () {
  var m = G.startMission(d), s;
  do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, 0); } while (!m.ended);
  G.getDebrief(m); G.recordResult(m);
  var cc = G.getCampaign(); cc.treasury_musd = 500; cc.finished = false; G.saveCampaign(cc);
}, 10);
time("export and import a save", 20, function () { G.importSave(G.exportSave()); }, 20);
console.log(passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
