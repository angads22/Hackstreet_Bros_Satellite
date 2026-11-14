// tests/balance.js — balance guarantees from the red-team report (tests/redteam/REPORT.md).
// Run from the repo root:  node tests/balance.js     (about a minute)
// Plays the realistic design space (1-2 instruments, 1-3 power parts, one radio,
// one computer, 0-1 thruster, every orbit and launcher) on every tier, always
// taking the safe choice at events.
var G = require("./load")();
var passed = 0, failed = 0, warned = 0;
function check(name, ok, detail) { if (ok) passed++; else failed++; console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : "")); }
function warn(name, detail) { warned++; console.log("GAP  " + name + (detail ? "  (" + detail + ")" : "")); }

function cat(c) { return G.PARTS.filter(function (p) { return p.category === c; }).map(function (p) { return p.id; }); }
function combos(list, min, max) {
  var out = [];
  for (var m = 1; m < (1 << list.length); m++) {
    var s = list.filter(function (_, i) { return m & (1 << i); });
    if (s.length >= min && s.length <= max) out.push(s);
  }
  return out;
}
var SETS = [];
combos(cat("instrument"), 1, 2).forEach(function (i) { combos(cat("power"), 1, 3).forEach(function (p) {
  cat("comms").forEach(function (c) { cat("computer").forEach(function (k) {
    [null].concat(cat("propulsion")).forEach(function (r) { SETS.push(i.concat(p, [c, k], r ? [r] : [])); });
  }); }); }); });

function safe(ev) { var j = ev.choices.findIndex(function (c) { return !c.fail_chance_now; }); return j < 0 ? 0 : j; }
function play(d) {
  var m = G.startMission(d); if (!m) return null;
  var s; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, safe(s.event)); } while (!m.ended);
  return m;
}

var stats = {}, adviceBad = [], orbitWins = { leo: 0, sso: 0, geo: 0 }, threeBelowTarget = 0, threeSeen = 0;
G.TIERS.forEach(function (t) {
  G.OBJECTIVES.forEach(function (o) {
    var key = t.id + "/" + o.id, best = { score: -1 }, three = 0, bestByOrbit = {};
    G.ORBITS.forEach(function (orb) {
      G.LAUNCHERS.forEach(function (l) {
        SETS.forEach(function (parts) {
          var d = G.newDesign(t.id); G.setObjective(d, o.id); G.setOrbit(d, orb.id); G.setLauncher(d, l.id);
          parts.forEach(function (p) { G.addPart(d, p); });
          if (G.runChecks(d).blockers.length) return;
          var m = play(d), db = G.getDebrief(m);
          if (db.stars === 3) { three++; threeSeen++; if (db.science < db.science_target) threeBelowTarget++; }
          if (db.score > best.score) best = { score: db.score, stars: db.stars, orbit: orb.id };
          if (!bestByOrbit[orb.id] || db.score > bestByOrbit[orb.id]) bestByOrbit[orb.id] = db.score;
          // Advice must never ask for a part that is already fitted.
          d.parts.forEach(function (id) {
            var n = G.getPart(id).name.toLowerCase();
            if (/(add|fit|fly) the /i.test(db.suggestion) && db.suggestion.toLowerCase().indexOf("the " + n) !== -1 &&
                db.suggestion.toLowerCase().indexOf("your " + n) === -1) adviceBad.push(key + " " + d.orbit + ": " + db.suggestion);
          });
          if (m.design === d) adviceBad.push("mission shares the design object");
        });
      });
    });
    stats[key] = { three: three, best: best, byOrbit: bestByOrbit };
    var top = Object.keys(bestByOrbit).sort(function (a, b) { return bestByOrbit[b] - bestByOrbit[a]; })[0];
    Object.keys(bestByOrbit).forEach(function (id) { if (bestByOrbit[id] >= bestByOrbit[top]) orbitWins[id]++; });
  });
});

// 1. Every objective has a design that reaches its science target (preview ceiling).
G.OBJECTIVES.forEach(function (o) {
  var ceiling = 0;
  G.ORBITS.forEach(function (orb) { SETS.forEach(function (parts) {
    var d = { tier: "training", objective: o.id, orbit: orb.id, launcher: "heavy", parts: parts };
    if (G.runChecks(d).blockers.length) return;
    ceiling = Math.max(ceiling, G.previewScience(d).total);
  }); });
  check("1 " + o.id + " target is reachable", ceiling >= o.science_target,
    "best preview " + Math.round(ceiling) + " of " + o.science_target + " = " + Math.round(100 * ceiling / o.science_target) + "%");
});

// 2. Every tier x objective has a 3-star design.
Object.keys(stats).forEach(function (k) {
  check("2 " + k + " has a 3-star design", stats[k].three > 0, stats[k].three + " designs; best " + stats[k].best.score + " in " + stats[k].best.orbit);
});

// 3. No 3-star design misses the science target.
check("3 three stars need the target", threeBelowTarget === 0, threeSeen + " three-star missions, " + threeBelowTarget + " below target");

// 4. Each orbit is the best (or tied best) choice for at least one tier x objective.
Object.keys(orbitWins).forEach(function (id) {
  if (orbitWins[id] > 0) check("4 " + id + " wins at least once", true, orbitWins[id] + " tier x objective");
  else warn("4 " + id + " never wins", "known: its real advantage, minutes-fast detection, is not scored yet (red-team N5)");
});

// 5. Advice never names a part that is already fitted; missions fly a copy.
check("5 advice never asks for a fitted part", adviceBad.length === 0, adviceBad.length ? adviceBad[0] : "");

// 6. A careless design fails.
var c = G.newDesign("training"); G.setObjective(c, "wildfire"); G.setOrbit(c, "leo"); G.setLauncher(c, "rideshare");
["optical-camera", "solar-small", "radio-uhf", "obc-basic"].forEach(function (p) { G.addPart(c, p); });
var dc = G.getDebrief(play(c));
check("6 careless design scores 0 stars", dc.stars === 0, "score " + dc.score);

console.log("\n" + passed + " passed, " + failed + " failed, " + warned + " known gaps");
if (failed) process.exitCode = 1;
