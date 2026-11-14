// tests/simulate.js — sped-up playthroughs of every buildable design.
// Run from the repo root:  node tests/simulate.js
// Loads the same files as index.html, in the same order, then plays every
// design to the end, always taking the first (safe) choice at each event.
var G = require("./load")();

function byCat(c, era) { return G.PARTS.filter(function (p) { return p.category === c && G.eraOf("parts", p.id) === era; }).map(function (p) { return p.id; }); }
function subsets(list, min) {
  var out = [];
  for (var m = 0; m < (1 << list.length); m++) {
    var s = list.filter(function (_, i) { return m & (1 << i); });
    if (s.length >= min) out.push(s);
  }
  return out;
}
// Each topic is swept with the parts and rockets of its own era.
function space(era) {
  return { I: subsets(byCat("instrument", era), 1), P: subsets(byCat("power", era), 1),
           C: byCat("comms", era).map(function (x) { return [x]; }), K: byCat("computer", era).map(function (x) { return [x]; }),
           R: [[]].concat(byCat("propulsion", era).map(function (x) { return [x]; })),
           L: G.LAUNCHERS.filter(function (l) { return G.eraOf("launchers", l.id) === era; }) };
}
var SPACE = { era: space("era"), modern: space("modern") };

function play(d, choice) {
  var m = G.startMission(d), s, guard = 0;
  do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, choice); } while (!s.ended && ++guard < 500);
  return G.getDebrief(m);
}

var report = {};
G.TIERS.forEach(function (tier) {
  G.OBJECTIVES.forEach(function (obj) {
    var key = tier.id + " / " + obj.id, n = 0, launchable = 0, best = null, stars = [0, 0, 0, 0], byOrbit = {};
    var S = SPACE[G.topicEra(obj.id)], I = S.I, P = S.P, C = S.C, K = S.K, R = S.R;
    G.ORBITS.forEach(function (orb) {
      S.L.forEach(function (ln) {
        I.forEach(function (i) { P.forEach(function (p) { C.forEach(function (c) { K.forEach(function (k) { R.forEach(function (r) {
          var d = G.newDesign(tier.id); G.setObjective(d, obj.id); G.setOrbit(d, orb.id); G.setLauncher(d, ln.id);
          i.concat(p, c, k, r).forEach(function (id) { G.addPart(d, id); });
          n++;
          if (G.runChecks(d).blockers.length) return;
          launchable++;
          var db = play(d, 0);
          stars[db.stars]++;
          if (!byOrbit[orb.id] || db.score > byOrbit[orb.id].score) byOrbit[orb.id] = { score: db.score, parts: d.parts.join(","), launcher: ln.id };
          if (!best || db.score > best.score) best = { score: db.score, stars: db.stars, orbit: orb.id, launcher: ln.id, parts: d.parts.join(","), sci: db.science, lim: db.limiting };
        }); }); }); }); });
      });
    });
    report[key] = { designs: n, launchable: launchable, stars_0123: stars.join("/"), best: best,
      best_per_orbit: Object.keys(byOrbit).map(function (o) { return o + ":" + byOrbit[o].score + " (" + byOrbit[o].launcher + ")"; }).join("  ") };
  });
});
console.log(JSON.stringify(report, null, 1));

// A careless design: everything bolted on, cheapest rocket.
var d = G.newDesign("training"); G.setObjective(d, "wildfire"); G.setOrbit(d, "leo"); G.setLauncher(d, "rideshare");
["optical-camera", "solar-small", "radio-uhf", "obc-basic"].forEach(function (id) { G.addPart(d, id); });
var c = G.runChecks(d);
console.log("\nCareless design (camera + UHF, LEO, rideshare):", JSON.stringify(c.blockers.map(function(b){return b.id;})),
  JSON.stringify(c.warnings.map(function(w){return w.id;})), JSON.stringify(play(d, 0), ["score","stars","limiting","suggestion","science"]));
console.log("Orbit facts LEO/SSO/GEO:", ["leo","sso","geo"].map(function (o) { var x = G.newDesign(); G.setOrbit(x, o); var f = G.getOrbitFacts(x); return o + " " + f.period_min + "min " + f.laps_per_day + "/day ecl " + f.eclipse_fraction; }).join(" | "));
