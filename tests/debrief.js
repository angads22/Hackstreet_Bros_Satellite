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

console.log(passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
