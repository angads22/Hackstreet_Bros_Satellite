// tests/campaign.js — the campaign economy (SPEC.md "Scoring", PLAN.md Phase D).
// Run from the repo root:  node tests/campaign.js
var G = require("./load")();
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

// Seeded random for the random campaigns, so this test is repeatable.
var seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

var FIRE = ["thermal-imager", "solar-small", "battery-28v", "radio-sband", "obc-basic"];
function campaignDesign(obj, orbit, launcher, parts) {
  var d = G.newCampaignDesign();
  G.setObjective(d, obj); G.setOrbit(d, orbit); G.setLauncher(d, launcher);
  parts.forEach(function (p) { G.addPart(d, p); });
  return d;
}
function fly(d, choose) {
  var m = G.startMission(d); if (!m) return null;
  var s; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, choose ? choose(s.event) : 0); } while (!m.ended);
  return m;
}

// 1. Payout curve, hand-worked (SPEC.md worked example): value 20, scale 300, 150 science each time.
//    knowledge(150) = 1 - e^-0.5 = 0.3935 -> $7.87M; then $4.77M, $2.90M, $1.76M.
var fire = G.getObjective("wildfire");
var want = [7.869, 4.773, 2.895, 1.756];
[0, 150, 300, 450].forEach(function (before, i) {
  var p = G.payoutFor({ value_musd: 20, knowledge_scale: 300 }, before, 150).payout_musd;
  check("1 payout curve mission " + (i + 1), near(p, want[i], 0.01), "$" + p + "M, want $" + want[i] + "M");
});

// 2. Diminishing returns, and a fresh topic beats a third repeat.
var p1 = G.payoutFor(fire, 0, 120).payout_musd, p2 = G.payoutFor(fire, 120, 120).payout_musd, p3 = G.payoutFor(fire, 240, 120).payout_musd;
check("2 repeats pay strictly less", p1 > p2 && p2 > p3, p1 + " > " + p2 + " > " + p3);
var fresh = G.payoutFor({ value_musd: fire.value_musd, knowledge_scale: fire.knowledge_scale }, 0, 120).payout_musd;
check("2 a fresh topic pays more than a third repeat", fresh > p3, fresh + " > " + p3);

// 3. Idempotent payout.
G.resetCampaign(); G.newCampaign("training");
var m3 = fly(campaignDesign("wildfire", "sso", "rideshare", FIRE.concat(["prop-green-small"])));
var t0 = G.getCampaign().treasury_musd;
var r1 = G.recordResult(m3), t1 = G.getCampaign().treasury_musd;
var r2 = G.recordResult(m3), t2 = G.getCampaign().treasury_musd;
check("3 recordResult pays once", r1 === r2 && t1 === t2 && t1 !== t0, "treasury " + t0 + " -> " + t1 + " -> " + t2);

// 4. Launch deducts the cost; editing the design afterwards changes nothing.
G.resetCampaign(); G.newCampaign("training");
var d4 = campaignDesign("wildfire", "sso", "rideshare", FIRE.concat(["prop-green-small"]));
var before4 = G.getCampaign().treasury_musd, cost4 = G.getTotals(d4).cost_musd;
var m4 = G.startMission(d4);
check("4 launch deducts the cost", near(G.getCampaign().treasury_musd, before4 - cost4, 0.001), before4 + " - " + cost4);
G.addPart(d4, "sar-radar"); G.addPart(d4, "radio-xband"); G.setLauncher(d4, "heavy");
var s4; do { s4 = G.stepMonth(m4); if (s4.event) G.chooseEvent(m4, 0); } while (!m4.ended);
check("4 the flown design is a copy", m4.design !== d4 && m4.design.parts.length === 6 && m4.design.launcher === "rideshare");
check("4 debrief spent matches the launch", near(G.getDebrief(m4).spent_musd, cost4 + m4.extra_cost_musd, 0.001));

// 5. No soft lock over 200 random campaigns with careless players.
var softlocks = 0, flights = 0, wins = 0, timeouts = 0, bailouts = 0;
var parts = G.PARTS.map(function (p) { return p.id; });
for (var c = 0; c < 200; c++) {
  G.resetCampaign(); G.newCampaign(G.TIERS[c % G.TIERS.length].id);
  for (var guard = 0; guard < 40 && !G.getCampaign().finished; guard++) {
    var hub = G.getHubInfo();
    var topics = hub.topics.filter(function (t) { return t.available; });
    var flew = false;
    for (var tries = 0; tries < 300 && !flew; tries++) {
      var obj = topics[Math.floor(rnd() * topics.length)].id;
      var orb = G.ORBITS[Math.floor(rnd() * 3)].id, lau = G.LAUNCHERS[Math.floor(rnd() * 3)].id;
      var pick = parts.filter(function () { return rnd() < 0.35; });
      var d = campaignDesign(obj, orb, lau, pick);
      if (G.runChecks(d).blockers.length) continue;
      var m = fly(d, function (ev) { return Math.floor(rnd() * ev.choices.length); });
      var r = G.recordResult(m); flights++; flew = true;
      if (r.bailout) bailouts++;
      var after = G.getCampaign();
      if (!after.finished && after.treasury_musd < G.cheapestLaunchCost(after) - 1e-9) softlocks++;
    }
    if (!flew) {   // fall back to the cheapest known design, as a stuck player would
      var cd = campaignDesign("wildfire", "leo", "rideshare", ["optical-camera", "solar-small", "radio-uhf", "obc-basic"]);
      if (G.runChecks(cd).blockers.length) { softlocks++; break; }
      G.recordResult(fly(cd)); flights++;
    }
  }
  if (G.getCampaign().won) wins++; else if (G.getCampaign().finished) timeouts++;
}
check("5 no soft lock in 200 random campaigns", softlocks === 0,
  flights + " flights, " + wins + " wins, " + timeouts + " time-outs, " + bailouts + " bailouts");

// 7. Save codes: round trip; a wrong version is refused and the good save survives.
G.resetCampaign(); G.newCampaign("standard");
G.recordResult(fly(campaignDesign("wildfire", "sso", "rideshare", FIRE.concat(["prop-green-small"]))));
var code = G.exportSave(), t7 = G.getCampaign().treasury_musd;
G.resetCampaign();
check("7 import restores the campaign", G.importSave(code).ok && G.getCampaign().treasury_musd === t7);
var body = JSON.parse(Buffer.from(code.split(".")[1], "base64").toString()); body.v = 99;
var txt = JSON.stringify(body), bad = "SMDG1." + Buffer.from(txt).toString("base64") + "." + G.checksum(txt);
var r7 = G.importSave(bad);
check("7 a code from another version is refused", !r7.ok && G.getCampaign().treasury_musd === t7, r7.reason);
check("7 a damaged code is refused", !G.importSave(code.slice(0, -2)).ok && !G.importSave("not a code").ok);

// 8. Standalone missions are untouched by a saved campaign.
var d8 = G.newDesign("standard"); G.setObjective(d8, "wildfire"); G.setOrbit(d8, "sso"); G.setLauncher(d8, "rideshare");
FIRE.concat(["prop-green-small"]).forEach(function (p) { G.addPart(d8, p); });
var tBefore = G.getCampaign().treasury_musd;
var m8 = fly(d8); G.recordResult(m8);
check("8 standalone uses the tier budget", G.getTotals(d8).budget_musd === G.getTier("standard").budget_musd);
check("8 standalone does not touch the treasury", G.getCampaign().treasury_musd === tBefore);

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
