// tests/debrief.js — how a mission ends and what the debrief tells the player to try next.
// Run from the repo root:  node tests/debrief.js
// 1. A battery-only satellite flies until its battery is spent; an event ends a mission only when it breaks a part.
var load = require("./load");
var G = load();
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
// A standalone design set in an era (Part 1 is the "igy" era on the training tier).
function eraDesign(era, tier, objective, orbit, launcher, parts) {
  var d = G.newDesign(tier); G.setEra(d, era); G.setObjective(d, objective); G.setOrbit(d, orbit);
  parts.forEach(function (p) { G.addPart(d, p); }); G.setLauncher(d, launcher);
  return d;
}
// Flies a mission to the end; `choose(event, index)` picks each event's choice (a number: always that choice).
function fly(d, choose) {
  var m = G.startMission(d), s, n = 0, i = 0;
  if (!m) return null;
  do {
    s = G.stepMonth(m);
    if (s.event) G.chooseEvent(m, typeof choose === "function" ? choose(s.event, i++) : Math.min(choose || 0, s.event.choices.length - 1));
  } while (!s.ended && ++n < 500);
  return m;
}

// ---- 1. Battery-only satellites, and what ends a mission early
// Silver-zinc batteries on the TIROS drum last 11 months: long enough for events. Choices with no effect must change nothing.
var bo = eraDesign("nimbus", "training", "radiation", "leo", "thor-able",
  ["drum-body", "spin-stabilised", "cosmic-ray-counter", "silver-zinc-battery", "minitrack-beacon", "command-timer"]);
var boLife = G.batteryLifeMonths(bo);
[0, 1].forEach(function (choice) {
  var m = fly(bo, choice);
  var broke = m.events_seen.some(function (e) { return e.failed_part; });
  check("1 battery-only, choice " + choice + ": it flies until the battery is spent unless an event breaks a part",
    m.events_seen.length > 0 && (broke ? m.ended_early : !m.ended_early && m.month === m.lifetime_months && m.end_cause === "batteries"),
    "month " + m.month + " of " + m.lifetime_months + ", events " + m.events_seen.map(function (e) { return e.label + (e.failed_part ? " (" + e.failed_part + " failed)" : ""); }).join("; "));
});
// Every battery-only 1958-1964 design that lives long enough for events: no event without a broken part ends it.
var bad1 = [];
["igy", "nimbus"].forEach(function (era) {
  ["training", "standard", "expert"].forEach(function (tier) {
    ["drum-body", "explorer-body"].forEach(function (body) {
      ["mercury-battery", "silver-zinc-battery", "nicad-battery"].forEach(function (bat) {
        ["cosmic-ray-counter", "scintillation-counter"].forEach(function (ins) {
          var d = eraDesign(era, tier, "radiation", "leo", "thor-able", [body, "spin-stabilised", ins, bat, "minitrack-beacon", "command-timer"]);
          if (G.runChecks(d).blockers.length) return;
          [0, 1, 2].forEach(function (choice) {
            var m = fly(d, choice);
            if (m.ended_early && !m.events_seen.some(function (e) { return e.failed_part; })) bad1.push(era + "/" + tier + "/" + body + "/" + bat + "/" + ins + " choice " + choice);
          });
        });
      });
    });
  });
});
check("1 a battery-only satellite is never ended by an event that broke nothing", bad1.length === 0, bad1.slice(0, 3).join("; "));
// A satellite that launched with solar cells still ends when its last cells fail: a battery alone cannot keep it alive.
// The stuck-hinge event is forced at month 2 and its risky choice always fails, so the cells (listed first) break.
function forced(d, eventId, month) {
  var m = G.startMission(d);
  m.schedule = [{ month: month, event: G.EVENTS.filter(function (e) { return e.id === eventId; })[0] }];
  m.rand = function () { return 0; };
  return m;
}
function finish(m, choice) { var st; do { st = G.stepMonth(m); if (st.event) G.chooseEvent(m, choice); } while (!st.ended); return m; }
var cellsDead = finish(forced(eraDesign("igy", "training", "radiation", "leo", "vanguard-rocket",
  ["explorer-body", "spin-stabilised", "scintillation-counter", "silicon-cells", "mercury-battery", "minitrack-beacon", "command-timer"]), "stuck-hinge", 2), 0);
check("1 a satellite whose only solar cells fail ends early, and the end names the part",
  cellsDead.ended_early && cellsDead.end_reason.category === "power" && cellsDead.end_reason.part === "silicon-cells" &&
  cellsDead.broken.indexOf("mercury-battery") === -1, JSON.stringify(cellsDead.end_reason));
// The same event on a battery-only satellite: the battery fails, so the satellite falls silent at once.
var batDead = finish(forced(eraDesign("nimbus", "training", "radiation", "leo", "thor-able",
  ["drum-body", "spin-stabilised", "cosmic-ray-counter", "silver-zinc-battery", "minitrack-beacon", "command-timer"]), "stuck-hinge", 2), 0);
check("1 a battery-only satellite whose battery fails ends early", batDead.ended_early && batDead.end_reason.part === "silver-zinc-battery",
  JSON.stringify(batDead.end_reason));
var batSafe = finish(forced(eraDesign("nimbus", "training", "radiation", "leo", "thor-able",
  ["drum-body", "spin-stabilised", "cosmic-ray-counter", "silver-zinc-battery", "minitrack-beacon", "command-timer"]), "stuck-hinge", 2), 1);
check("1 the safe choice keeps it flying to the end of its battery", !batSafe.ended_early && batSafe.month === batSafe.lifetime_months,
  "month " + batSafe.month + " of " + batSafe.lifetime_months);

// ---- 2. The knowledge paragraph: "first real look" only on the first flight of a topic
(function () {
  var C = load({ storage: load.memoryStorage() });
  C.newCampaign("training");
  var BASIC = ["explorer-body", "spin-stabilised", "cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"];
  var texts = [];
  for (var i = 0; i < 3; i++) {
    var d = C.newCampaignDesign(); C.setObjective(d, "radiation"); C.setOrbit(d, "leo");
    BASIC.forEach(function (p) { C.addPart(d, p); }); C.setLauncher(d, "juno-1");
    var m = C.startMission(d), st;
    do { st = C.stepMonth(m); if (st.event) C.chooseEvent(m, 0); } while (!st.ended);
    C.recordResult(m);
    var db = C.getDebrief(m), saved = C.getCampaign().missions[i];
    texts.push({ before: db.knowledge_before, kp: db.knowledge_paragraph, first: saved.first_look });
  }
  check("2 the first flight of a topic is its first real look", texts[0].kp === C.DEBRIEF.breakthrough && texts[0].first, JSON.stringify(texts[0]));
  check("2 the second and third flights are not called a first look", texts.slice(1).every(function (t) { return t.kp !== C.DEBRIEF.breakthrough && !t.first; }),
    JSON.stringify(texts.slice(1)));
  check("2 the first-look paragraph makes no claim about the payout's size", !/large/.test(C.DEBRIEF.breakthrough));
})();
// A comeback client pays by the contract, not by the knowledge curve: neither paragraph applies there.
var CB = load({ storage: load.memoryStorage() });
CB.newComeback("standard");
// A test contract, added to the open ones the way tests/comeback.js does.
function cbContract(fields) {
  var c = CB.getCampaign();
  var k = Object.assign({ id: "t-rad", topic: "radiation", orbit: null, client: "A test client", reason: "It tests things.",
                          min_science: 60, price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: "A test contract." }, fields || {});
  c.offers = (c.offers || []).filter(function (x) { return x.id !== k.id; }).concat([k]);
  CB.saveCampaign(c);
  return k;
}
function cbDesign(k, orbit, launcher, parts) {
  var d = CB.newComebackDesign(k.id); CB.setOrbit(d, orbit); CB.setLauncher(d, launcher);
  parts.forEach(function (p) { CB.addPart(d, p); });
  return d;
}
var RAD = ["scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"];
(function () {
  var m = CB.startMission(cbDesign(cbContract(), "leo", "rideshare", RAD)), st;
  do { st = CB.stepMonth(m); if (st.event) CB.chooseEvent(m, 0); } while (!st.ended);
  CB.recordResult(m);
  var db = CB.getDebrief(m);
  check("2 a comeback flight gets no first-look or saturated paragraph", db.knowledge_before === 0 && db.knowledge_paragraph === "", JSON.stringify(db.knowledge_paragraph));
})();

console.log(passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
