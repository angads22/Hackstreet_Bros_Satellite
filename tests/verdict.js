// tests/verdict.js — the Build screen's verdict gauges (js/ui-verdict.js, pure part). Run from the repo root: node tests/verdict.js
// The strip compares numbers the back end gives it; here those come from the real back end (the same comeback, a few designs).
var load = require("./load");
var V = require("../js/ui-verdict.js");
var G = load({ storage: load.memoryStorage() });
var passed = 0, failed = 0;
function check(name, ok, detail) { if (ok) passed++; else failed++; console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : "")); }

// judging
check("1 DATA: nothing is bad, short is thin, enough is ok, an empty design has no verdict",
  V.judgeFloor(0, 100, false) === "bad" && V.judgeFloor(60, 100, false) === "thin" && V.judgeFloor(100, 100, false) === "ok" && V.judgeFloor(0, 100, true) === "none");
check("2 COST: over the cash is bad, within a tenth of it is thin, below is ok",
  V.judgeCeiling(5.1, 5, false, false) === "bad" && V.judgeCeiling(5, 5, false, false) === "thin" && V.judgeCeiling(4.6, 5, false, false) === "thin" && V.judgeCeiling(4, 5, false, false) === "ok");
check("3 TIME: landing on the deadline is already too late (the deadline check's rule)",
  V.judgeCeiling(54, 54, true, false) === "bad" && V.judgeCeiling(53, 54, true, false) === "thin" && V.judgeCeiling(20, 54, true, false) === "ok");
check("4 a missing number gives no verdict", V.judgeFloor(null, 100, false) === "none" && V.judgeCeiling(3, undefined, false, false) === "none");

// gauges from the real back end
var CONTRACT = ["smallsat-bus", "spin-stabilised", "alouette-2-sounder", "solar-small", "mercury-battery", "radio-uhf", "obc-basic", "prop-ion"];
G.newComeback("training", 7);
var k = G.getComeback().contracts.filter(function (c) { return c.topic === "ionosphere"; })[0];
var d = G.newComebackDesign(k.id);
var empty = V.gauges(G, d);
check("5 an empty comeback design: three gauges, none judged", empty && empty.length === 3 && empty.every(function (g) { return g.state === "none"; }));
CONTRACT.forEach(function (id) { G.addPart(d, id); });
var g = V.gauges(G, d), by = {}; g.forEach(function (x) { by[x.id] = x; });
var sci = G.previewScience(d);
check("6 DATA is the back end's science against the contract's points", by.data.have === sci.total && by.data.limit === G.previewPayout(d).contract.min_science, by.data.have + " / " + by.data.limit);
check("7 COST is the back end's cost against the cash", by.cost.limit === G.getComeback().cash_musd && by.cost.have > 0, by.cost.have + " / " + by.cost.limit);
check("8 TIME is flightMonths against the months left", by.time.have === G.flightMonths(d) && by.time.limit === G.getComeback().months_left, by.time.have + " / " + by.time.limit);
check("9 the fill is the share of the limit, between 0 and 1", g.every(function (x) { return x.fill >= 0 && x.fill <= 1; }));
var over = G.newComebackDesign(k.id);
CONTRACT.concat(["sar-radar", "solar-large"]).forEach(function (id) { G.addPart(over, id); });
var og = V.gauges(G, over);
check("10 a design that costs more than the cash is bad on COST", og[1].state === "bad", og[1].have + " > " + og[1].limit);
check("11 no comeback contract, no gauges", V.gauges(G, G.newDesign("0")) === null);
// problems: blockers first
var worst = V.ranked(G, G.newComebackDesign(k.id), ["no-launcher"]);
var firstWarn = worst.map(function (r) { return r.kind; }).indexOf("warn");
check("12 blockers rank before warnings", worst.length > 0 && worst[0].kind === "bad" && (firstWarn === -1 || worst.slice(firstWarn).every(function (r) { return r.kind === "warn"; })));
check("13 every blocker kind has an action word or none (never a number)", ["mass", "power", "empty-power", "budget", "unknown-id"].every(function (id) { return !/\d/.test(V.action(id)); }) && V.action("empty-power") === "ADD ONE" && V.action("unknown-id") === "");
// the stage's state (Easy and Normal): power, no downlink, a part that does not fit the body
var bare = G.newComebackDesign(k.id);
["smallsat-bus", "alouette-2-sounder", "cloud-photocell", "optical-camera"].forEach(function (id) { G.addPart(bare, id); });
var st = V.stateOf(G, bare, G.PARTS), whole = V.stateOf(G, d, G.PARTS);
check("15 stage state: a bare body with three instruments has no power, no downlink and one part too many",
  st.power && st.link && st.crossed.length === 1 && st.crossed[0].id === "optical-camera", JSON.stringify(st));
check("16 stage state: the contract design shows none of it", !whole.power && !whole.link && whole.crossed.length === 0, JSON.stringify(whole));
// the card limit: for every topic a contract can name, at least one instrument that counts is among the first cards of its bin
var tops = {}, hidden = [];
["training", "standard", "expert"].forEach(function (t) {
  for (var seed = 1; seed <= 40; seed++) {
    G.newComeback(t, seed);
    G.getComeback().contracts.forEach(function (c) {
      var dd = G.newComebackDesign(c.id), av = G.getAvailability(dd);
      var inst = G.PARTS.filter(function (p) { return p.category === "instrument" && !(av.parts[p.id] && av.parts[p.id].available === false); });
      var shown = inst.slice(0, V.CARD_LIMIT).filter(function (p) { return (G.getPartFacts(dd, p.id) || {}).counts !== false; });
      tops[c.topic] = true;
      if (!shown.length && hidden.indexOf(c.topic) === -1) hidden.push(c.topic);
    });
  }
});
check("14 card limit: every topic keeps an instrument that counts in the first " + V.CARD_LIMIT + " cards", Object.keys(tops).length >= 5 && hidden.length === 0, Object.keys(tops).join(",") + (hidden.length ? "; hidden for " + hidden.join(",") : ""));
console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
