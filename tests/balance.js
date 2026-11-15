// tests/balance.js — balance guarantees from the red-team report (tests/redteam/REPORT.md).
// Run from the repo root:  node tests/balance.js     (about a minute)
// Plays the realistic design space (1-2 instruments, 1-3 power parts, one radio,
// one computer, 0-1 thruster, every orbit and launcher) on every tier, always
// taking the safe choice at events.
var G = require("./load")();
var passed = 0, failed = 0, warned = 0;
function check(name, ok, detail) { if (ok) passed++; else failed++; console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : "")); }
function warn(name, detail) { warned++; console.log("GAP  " + name + (detail ? "  (" + detail + ")" : "")); }

// Each topic is swept with the parts and rockets of its own era (SPEC.md, "The 1957 campaign").
function cat(c, era) { return G.PARTS.filter(function (p) { return p.category === c && G.eraOf("parts", p.id) === era; }).map(function (p) { return p.id; }); }
function combos(list, min, max) {
  var out = [];
  for (var m = 1; m < (1 << list.length); m++) {
    var s = list.filter(function (_, i) { return m & (1 << i); });
    if (s.length >= min && s.length <= max) out.push(s);
  }
  return out;
}
function setsFor(era) {
  var out = [];
  combos(cat("instrument", era), 1, 2).forEach(function (i) { combos(cat("power", era), 1, 3).forEach(function (p) {
    cat("comms", era).forEach(function (c) { cat("computer", era).forEach(function (k) {
      [null].concat(cat("propulsion", era)).forEach(function (r) { out.push(i.concat(p, [c, k], r ? [r] : [])); });
    }); }); }); });
  return out;
}
var SETS_BY_ERA = { era: setsFor("era"), modern: setsFor("modern") };
function launchersFor(era) { return G.LAUNCHERS.filter(function (l) { return G.eraOf("launchers", l.id) === era; }); }

function safe(ev) { var j = ev.choices.findIndex(function (c) { return !c.fail_chance_now; }); return j < 0 ? 0 : j; }
function play(d) {
  var m = G.startMission(d); if (!m) return null;
  var s; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, safe(s.event)); } while (!m.ended);
  return m;
}

var stats = {}, adviceBad = [], threeBelowTarget = 0, threeSeen = 0, threeDesigns = {}, winners = {};
var orbitWins = { era: { leo: 0, sso: 0, geo: 0 }, modern: { leo: 0, sso: 0, geo: 0 } };
G.TIERS.forEach(function (t) {
  G.OBJECTIVES.forEach(function (o) {
    var key = t.id + "/" + o.id, best = { score: -1 }, three = 0, bestByOrbit = {};
    var era = G.topicEra(o.id), SETS = SETS_BY_ERA[era];
    // Every satellite needs a body and an attitude part (the switch-over is on): try each attitude
    // part of the era, with the smallest body that carries the load.
    // Modern topics may also use the older bodies and attitude parts.
    var ATT = cat("attitude", "era").concat(era === "modern" ? cat("attitude", "modern") : []),
        BODIES = G.PARTS.filter(function (p) { return p.category === "structure" && (era === "modern" || G.eraOf("parts", p.id) === era); })
      .sort(function (a, b) { return a.payload_kg - b.payload_kg; }).map(function (p) { return p.id; });
    G.ORBITS.forEach(function (orb) {
      launchersFor(era).forEach(function (l) {
        SETS.forEach(function (parts0) { ATT.forEach(function (att) {
          var parts = parts0.concat([att]);
          var d = G.newDesign(t.id); G.setObjective(d, o.id); G.setOrbit(d, orb.id); G.setLauncher(d, l.id);
          parts.forEach(function (p) { G.addPart(d, p); });
          var fitted = BODIES.some(function (b) {
            G.addPart(d, b);
            if (!G.runChecks(d).blockers.some(function (x) { return /^body-/.test(x.id); })) return true;
            G.removePart(d, b); return false;
          });
          if (!fitted) return;
          if (G.runChecks(d).blockers.length) return;
          var m = play(d), db = G.getDebrief(m);
          if (db.stars === 3) {
            if (t.id === "training") (winners[o.id] = winners[o.id] || []).push({ orbit: orb.id, launcher: l.id,
              parts: d.parts.filter(function (p) { var c = G.getPart(p).category; return c !== "structure" && c !== "attitude"; }) });
            three++; threeSeen++; if (db.science < db.science_target) threeBelowTarget++;
            // Distinct ways to succeed: a different orbit or different instruments (a bigger rocket alone does not count).
            var inst = d.parts.filter(function (p) { return G.getPart(p).category === "instrument"; }).sort().join("+");
            (threeDesigns[o.id] = threeDesigns[o.id] || {})[orb.id + "/" + inst] = true;
          }
          if (db.score > best.score) best = { score: db.score, stars: db.stars, orbit: orb.id };
          if (!bestByOrbit[orb.id] || db.score > bestByOrbit[orb.id]) bestByOrbit[orb.id] = db.score;
          // Advice must never ask for a part that is already fitted.
          d.parts.forEach(function (id) {
            var n = G.getPart(id).name.toLowerCase();
            if (/(add|fit|fly) the /i.test(db.suggestion) && db.suggestion.toLowerCase().indexOf("the " + n) !== -1 &&
                db.suggestion.toLowerCase().indexOf("your " + n) === -1) adviceBad.push(key + " " + d.orbit + ": " + db.suggestion);
          });
          if (m.design === d) adviceBad.push("mission shares the design object");
        }); });
      });
    });
    stats[key] = { three: three, best: best, byOrbit: bestByOrbit };
    var top = Object.keys(bestByOrbit).sort(function (a, b) { return bestByOrbit[b] - bestByOrbit[a]; })[0];
    Object.keys(bestByOrbit).forEach(function (id) { if (bestByOrbit[id] >= bestByOrbit[top]) orbitWins[era][id]++; });
  });
});

// 1. Every objective has a design that reaches its science target (preview ceiling).
G.OBJECTIVES.forEach(function (o) {
  var ceiling = 0, era = G.topicEra(o.id);
  var big = era === "era" ? "nimbus-bus" : "smallsat-bus";   // the largest body of the era, so the load always fits
  G.ORBITS.forEach(function (orb) { SETS_BY_ERA[era].forEach(function (parts) { cat("attitude", "era").forEach(function (att) {
    var d = { tier: "training", objective: o.id, orbit: orb.id, launcher: era === "era" ? "thor-agena" : "heavy", parts: parts.concat([att, big]) };
    if (G.runChecks(d).blockers.length) return;
    ceiling = Math.max(ceiling, G.previewScience(d).total);
  }); }); });
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
// The 1957 era is low orbit only, as in history: polar orbits need thrusters, which
// come with modern research. So the orbit check is made within each era.
var WHY = {
  "era/sso": "standalone missions use today's rules: since 1995 a polar orbit needs fuel to come down. In an era before 1995 a Thor-Agena reaches it without (Alouette 1, Nimbus 1; see 7)",
  "era/geo": "historical: no 1950s rocket could reach geostationary orbit (first: Syncom 2, 1963)",
  "modern/geo": "its real advantage, minutes-fast fire detection, is not scored yet (red-team N5)"
};
["era", "modern"].forEach(function (era) {
  Object.keys(orbitWins[era]).forEach(function (id) {
    var k = era + "/" + id;
    if (orbitWins[era][id] > 0) check("4 " + k + " wins at least once", true, orbitWins[era][id] + " tier x objective");
    else if (WHY[k]) warn("4 " + k + " never wins", WHY[k]);
    else check("4 " + k + " wins at least once", false, "no tier x objective");
  });
});

// 4b. "There is rarely a single perfect solution" (challenge text): every objective has at
// least two genuinely different 3-star designs (different orbit or instruments).
G.OBJECTIVES.forEach(function (o) {
  var ways = Object.keys(threeDesigns[o.id] || {});
  check("4b " + o.id + " has more than one way to 3 stars", ways.length >= 2, ways.length + " ways, e.g. " + ways.slice(0, 3).join(", "));
});

// 7. Eras, with the switch-over on (body and attitude required): every topic open in an
// era can earn 3 stars using only what existed that year. Starts from the 3-star designs
// above, keeps those whose parts existed, then tries every era rocket, body and attitude part.
var G2 = require("./load")({ newCategoriesRequired: true });
G2.ERAS.forEach(function (era) {
  G2.getEras().filter(function (e) { return e.id === era.id; })[0].topics.forEach(function (topic) {
    var ok = null;
    // Before 1995 a polar orbit needs no disposal fuel, so also try each winner without its thruster.
    var tries = [];
    (winners[topic] || []).forEach(function (w) {
      tries.push(w);
      var noProp = w.parts.filter(function (p) { return G2.getPart(p).category !== "propulsion"; });
      if (noProp.length < w.parts.length) tries.push({ orbit: w.orbit, parts: noProp });
    });
    tries.some(function (w) {
      var probe = G2.setEra(G2.newDesign("training"), era.id);
      if (!w.parts.every(function (p) { return G2.isPartAvailable(p, probe); })) return false;
      var bodies = G2.PARTS.filter(function (p) { return p.category === "structure" && G2.isPartAvailable(p.id, probe); });
      var atts = G2.PARTS.filter(function (p) { return p.category === "attitude" && G2.isPartAvailable(p.id, probe); });
      var rockets = G2.LAUNCHERS.filter(function (l) { return G2.isLauncherAvailable(l.id, probe); });
      return bodies.some(function (b) { return atts.some(function (a) { return rockets.some(function (l) {
        var d = G2.setEra(G2.newDesign("training"), era.id);
        G2.setObjective(d, topic); G2.setOrbit(d, w.orbit); G2.setLauncher(d, l.id);
        w.parts.concat([b.id, a.id]).forEach(function (p) { G2.addPart(d, p); });
        if (G2.runChecks(d).blockers.length) return false;
        var m = G2.startMission(d), s;
        do { s = G2.stepMonth(m); if (s.event) G2.chooseEvent(m, safe2(s.event)); } while (!m.ended);
        if (G2.getDebrief(m).stars === 3) { ok = w.orbit + "/" + l.id + "/" + b.id + "/" + a.id; return true; }
        return false;
      }); }); });
    });
    // Fallback: a small search over the era's own parts (the sweep above uses every part).
    if (!ok) ok = eraSearch(era, topic);
    var label = "7 " + era.year + " " + era.name + ": " + topic + " can earn 3 stars with that era's parts";
    // Historical: 1964 was the quietest year of the solar cycle (SILSO), so solar science is scarce.
    if (!ok && topic === "solar" && G2.sunspots(era.year, null) < 50) warn(label, "historical: the Sun averaged " + Math.round(G2.sunspots(era.year, null)) + " sunspots in " + era.year + "; 2 stars is the honest best");
    else check(label, !!ok, ok || "no design found");
  });
});
function eraSearch(era, topic) {
  var probe = G2.setEra(G2.newDesign("training"), era.id), ob = G2.getObjective(topic);
  function av(cat, f) { return G2.PARTS.filter(function (p) { return p.category === cat && G2.isPartAvailable(p.id, probe) && (!f || f(p)); }); }
  var ins = av("instrument", function (p) { return p.tags.some(function (t) { return ob.wants.indexOf(t) !== -1; }); });
  var gens = av("power", function (p) { return p.panel_area_m2; }), bats = [null].concat(av("power", function (p) { return p.battery_wh; }));
  var comms = av("comms"), comps = av("computer"), bodies = av("structure"), atts = av("attitude");
  var rockets = G2.LAUNCHERS.filter(function (l) { return G2.isLauncherAvailable(l.id, probe); });
  var found = null;
  G2.ORBITS.some(function (o) { return ins.some(function (i) { return gens.some(function (g) { return bats.some(function (b) {
    return comms.some(function (c) { return comps.some(function (k) { return bodies.some(function (bo) { return atts.some(function (a) {
      return rockets.some(function (l) {
        var d = G2.setEra(G2.newDesign("training"), era.id);
        G2.setObjective(d, topic); G2.setOrbit(d, o.id); G2.setLauncher(d, l.id);
        [i.id, g.id, c.id, k.id, bo.id, a.id].concat(b ? [b.id] : []).forEach(function (p) { G2.addPart(d, p); });
        if (G2.runChecks(d).blockers.length || G2.previewScience(d).total < ob.science_target) return false;
        var m = G2.startMission(d), s;
        do { s = G2.stepMonth(m); if (s.event) G2.chooseEvent(m, safe2(s.event)); } while (!m.ended);
        if (G2.getDebrief(m).stars === 3) { found = o.id + "/" + l.id + "/" + bo.id + "/" + a.id + "/" + i.id; return true; }
        return false;
      }); }); }); }); }); }); }); }); });
  return found;
}
function safe2(ev) { var j = ev.choices.findIndex(function (c) { return !c.fail_chance_now; }); return j < 0 ? 0 : j; }

// 5. Advice never names a part that is already fitted; missions fly a copy.
check("5 advice never asks for a fitted part", adviceBad.length === 0, adviceBad.length ? adviceBad[0] : "");

// 6. A careless design fails.
var c = G.newDesign("training"); G.setObjective(c, "wildfire"); G.setOrbit(c, "leo"); G.setLauncher(c, "rideshare");
["optical-camera", "solar-small", "radio-uhf", "obc-basic", "smallsat-bus", "spin-stabilised"].forEach(function (p) { G.addPart(c, p); });
var dc = G.getDebrief(play(c));
check("6 careless design scores 0 stars", dc.stars === 0, "score " + dc.score);

console.log("\n" + passed + " passed, " + failed + " failed, " + warned + " known gaps");
if (failed) process.exitCode = 1;
