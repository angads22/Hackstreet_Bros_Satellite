// tests/clarity.js — the Build screen's WHY box (partWhy) and the PROFIT lines (previewProfit, flightProfit).
// Run from the repo root:  node tests/clarity.js
var load = require("./load");
var G = load({ storage: load.memoryStorage() });
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-9); }
function words(t) { return (String(t).match(/\S+/g) || []).length; }

// ---- partWhy: standalone designs
var d = G.newDesign("training");
G.setObjective(d, "wildfire"); G.setOrbit(d, "leo");
var w = G.partWhy(d, "cosmic-ray-counter");
check("why: a radiation counter does not count for wildfire", !!w && w.id === "type", JSON.stringify(w));
check("why: it names what the job wants and what the part reads", !!w && /thermal or imaging/.test(w.text) && /radiation/.test(w.text), w && w.text);
check("why: about 12 words or fewer", !!w && words(w.text) <= 12, w && words(w.text));
check("why: wants come from the objective, tags from the part", !!w && w.wants.join() === G.getObjective("wildfire").wants.join() && w.tags.join() === "radiation");
check("why: null for an instrument that counts", G.partWhy(d, "thermal-imager") === null);
check("why: null for a part that is not an instrument", G.partWhy(d, "solar-small") === null && G.partWhy(d, "explorer-body") === null);
check("why: null for an unknown part, or with no objective", G.partWhy(d, "nope") === null && G.partWhy(G.newDesign("training"), "cosmic-ray-counter") === null);
// It agrees with getPartFacts: it speaks exactly when the part adds nothing for a reason it can name.
var agree = true, odd = [];
G.OBJECTIVES.forEach(function (o) {
  ["leo", "sso", "geo"].forEach(function (orb) {
    var x = G.newDesign("training"); G.setObjective(x, o.id); G.setOrbit(x, orb);
    G.PARTS.forEach(function (p) {
      var f = G.getPartFacts(x, p.id), y = G.partWhy(x, p.id);
      if (f.counts === false && !(y && y.id === "type")) { agree = false; odd.push(o.id + "/" + orb + "/" + p.id); }
      if (f.counts === true && f.sharp_enough !== false && !(o.orbit_fit && o.orbit_fit[orb] === 0) && y !== null) { agree = false; odd.push(o.id + "/" + orb + "/" + p.id + " speaks"); }
    });
  });
});
check("why: speaks for every instrument whose type is not wanted, never for one that counts", agree, odd.slice(0, 3).join(", "));
// Radiation job, Part 1's first step: the counter counts, so no WHY; a camera does not.
var r = G.newDesign("training"); G.setObjective(r, "radiation"); G.setOrbit(r, "leo");
check("why: Part 1's counter counts for radiation (no WHY)", G.partWhy(r, "cosmic-ray-counter") === null);
check("why: a TV camera does not count for radiation", G.partWhy(r, "vidicon-camera") && G.partWhy(r, "vidicon-camera").id === "type");
// An orbit that cannot see the target: the right type adds nothing, and says so.
var ice = G.newDesign("training"); G.setObjective(ice, "sea-ice"); G.setOrbit(ice, "geo");
var ow = G.partWhy(ice, "sar-radar");
check("why: right type in an orbit that cannot see the target", !!ow && ow.id === "orbit" && words(ow.text) <= 12, ow && ow.text);
// Too blurry (no part is blurry in today's data, so tighten the objective in place).
G.getObjective("wildfire").needs_resolution_m = 1;
var bw = G.partWhy(d, "thermal-imager");
check("why: too blurry for the job names both sizes", !!bw && bw.id === "blurry" && /m, the job needs 1 m/.test(bw.text) && words(bw.text) <= 12, bw && bw.text);
G.getObjective("wildfire").needs_resolution_m = 2000;
check("why: the design is not changed", d.parts.length === 0);

// ---- previewProfit and flightProfit: a comeback
check("profit: null for a standalone design and for null", G.previewProfit(G.newDesign("training")) === null && G.previewProfit(null) === null && G.flightProfit(null) === null);
G.resetCampaign();
var h = G.newComeback("standard", 20);
var contract = G.getComeback().contracts[0];
var cd = G.newComebackDesign(contract.id);
check("profit: a comeback design with no parts yet has a profit line", !!G.previewProfit(cd));
var parts = ["cubesat-12u", "spin-stabilised", "scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "obc-basic"];
// Use the contract's own topic: pick instruments that count for it.
var topic = G.getObjective(cd.objective);
var instr = G.PARTS.filter(function (p) { return p.category === "instrument" && G.isPartAvailable(p.id) && p.tags.some(function (t) { return topic.wants.indexOf(t) !== -1; }); })[0];
parts = ["cubesat-12u", "spin-stabilised", instr.id, "solar-small", "mercury-battery", "radio-uhf", "obc-basic"];
G.setOrbit(cd, contract.orbit || "leo");
parts.forEach(function (id) { G.addPart(cd, id); });
var pr = G.previewProfit(cd), pay = G.previewPayout(cd);
check("profit: pay is the contract's expected pay", pr && near(pr.pay_musd, pay.expected_payout_musd), pr && pr.pay_musd + " vs " + pay.expected_payout_musd);
check("profit: no rocket yet, so the cheapest one that lifts it stands in", pr && pr.launch_estimated === true && pr.launcher_id && pr.launch_musd > 0, JSON.stringify(pr));
var mass = G.getTotals(cd).mass_kg;
var cheap = G.LAUNCHERS.filter(function (l) { return G.isLauncherAvailable(l.id, cd) && l.capacity_kg[cd.orbit] >= mass; }).sort(function (a, b) { return a.cost_musd - b.cost_musd; })[0];
check("profit: that rocket really is the cheapest that lifts the design", pr && cheap && pr.launcher_id === cheap.id);
check("profit: profit = pay - parts - rocket", pr && near(pr.profit_musd, G.round(pr.pay_musd - pr.parts_musd - pr.launch_musd, 3)) && near(pr.cost_musd, G.round(pr.parts_musd + pr.launch_musd, 3)));
check("profit: the parts cost is the design's cost without a rocket", pr && near(pr.parts_musd, G.getTotals(cd).cost_musd, 0.001));
G.setLauncher(cd, cheap.id);
var pr2 = G.previewProfit(cd);
check("profit: with a rocket chosen it is the real cost, not an estimate", pr2 && pr2.launch_estimated === false && pr2.launcher_id === cheap.id && near(pr2.cost_musd, G.getTotals(cd).cost_musd, 0.001));
check("profit: the same profit either way", near(pr.profit_musd, pr2.profit_musd, 0.001));
check("profit: it agrees with previewPayout's net", near(pr2.profit_musd, G.previewPayout(cd).net_musd, 0.001));
// A rocket that is too small still costs what it costs.
var tiny = G.newComebackDesign(contract.id); G.setOrbit(tiny, cd.orbit);
check("profit: null cost and profit when no rocket can lift it",
  (function () { var heavy = G.newComebackDesign(contract.id); G.setOrbit(heavy, cd.orbit);
    var old = {}; G.LAUNCHERS.forEach(function (l) { old[l.id] = l.capacity_kg[cd.orbit]; l.capacity_kg[cd.orbit] = 0; });
    parts.forEach(function (id) { G.addPart(heavy, id); });
    var x = G.previewProfit(heavy);
    G.LAUNCHERS.forEach(function (l) { l.capacity_kg[cd.orbit] = old[l.id]; });
    return x && x.launch_musd === null && x.cost_musd === null && x.profit_musd === null && x.pay_musd >= 0; })());

// Fly it: the debrief's profit is what the flight paid, less what it cost.
var outFp, outRes, outCash, outM;
check("flightProfit: null before the result is recorded", (function () {
  var m = G.startMission(cd); if (!m) return false;
  var before = G.flightProfit(m);
  var s; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, 0); } while (!m.ended);
  var cashBefore = G.getComeback().cash_musd + (m.launch_totals.cost_musd);
  var res = G.recordResult(m);
  var fp = G.flightProfit(m);
  outFp = fp; outRes = res; outCash = cashBefore; outM = m;
  return before === null && !!fp; })());
check("flightProfit: paid + bonus - launch - event costs", outFp && near(outFp.profit_musd, G.round(outRes.contract_paid_musd + outRes.contract_bonus_musd - outM.launch_totals.cost_musd - outRes.event_costs_musd, 3)), JSON.stringify(outFp));
check("flightProfit: the launch cost is the rocket and parts at launch", outFp && near(outFp.launch_musd, outM.launch_totals.cost_musd) && near(outFp.launch_musd, pr2.cost_musd, 0.001));
check("flightProfit: it equals the change in cash from before the launch", outFp && near(outRes.cash_musd - outCash, outFp.profit_musd, 0.002), (outRes.cash_musd - outCash) + " vs " + outFp.profit_musd);
check("flightProfit: the same on a second ask", outFp && JSON.stringify(G.flightProfit(outM)) === JSON.stringify(outFp));

// A standalone flight (Part 1) has no profit.
var s1 = G.newDesign("training"); G.setObjective(s1, "radiation"); G.setOrbit(s1, "leo"); G.setLauncher(s1, "juno-1");
["explorer-body", "spin-stabilised", "cosmic-ray-counter", "minitrack-beacon", "command-timer", "silicon-cells"].forEach(function (id) { G.addPart(s1, id); });
var m1 = G.startMission(s1), st; do { st = G.stepMonth(m1); if (st.event) G.chooseEvent(m1, 0); } while (!m1.ended);
G.recordResult(m1);
check("flightProfit: none for a Part 1 flight", G.flightProfit(m1) === null && G.previewProfit(s1) === null);

console.log((failed ? "FAILED " + failed : "PASSED") + " (" + passed + " checks)");
process.exit(failed ? 1 : 0);
