// Every part subset x orbit x launcher x tier x objective. For launchable designs,
// play every event-choice sequence. Writes one compact row per launchable design.
var L = require("./lib"); var G = L.G; var fs = require("fs");
var tierId = process.argv[2];
var rows = [];
G.OBJECTIVES.forEach(function (o) {
  G.ORBITS.forEach(function (orb) { G.LAUNCHERS.forEach(function (ln) {
    for (var m = 1; m < 32768; m++) {
      var parts = L.PART_IDS.filter(function (_, i) { return m & (1 << i); });
      var d = L.design(tierId, o.id, orb.id, ln.id, parts);
      var ck = G.runChecks(d);
      if (ck.blockers.length) continue;
      var sched = G.startMission(d).schedule.map(function (s) { return s.event; });
      var n = sched.length, all = [];
      for (var mask = 0; mask < (1 << n); mask++) {
        var seq = []; for (var i = 0; i < n; i++) seq.push((mask >> i) & 1);
        var r = L.play(d, seq);
        all.push({ seq: seq.join(""), score: r.score, stars: r.stars, sci: r.science, lim: r.limiting, early: r.ended_early,
                   failed: r.events.filter(function (e) { return e.failed_part; }).map(function (e) { return e.failed_part; }) });
      }
      var safeSeq = sched.map(L.safeIdx).join("");
      var riskySeq = sched.map(function (ev) { return L.RISKY(ev); }).join("");
      var safe = all.filter(function (a) { return a.seq === safeSeq; })[0];
      var risky = all.filter(function (a) { return a.seq === riskySeq; })[0];
      var best = all.reduce(function (a, b) { return b.score > a.score ? b : a; });
      var worst = all.reduce(function (a, b) { return b.score < a.score ? b : a; });
      var t = G.getTotals(d), pv = G.previewScience(d);
      rows.push({ o: o.id, orb: orb.id, ln: ln.id, mask: m, np: parts.length, cost: t.cost_musd, mass: t.mass_kg,
        mm: t.margins.mass, pm: t.margins.power, prev: pv.total, warns: ck.warnings.map(function (w) { return w.id; }),
        events: sched.map(function (e) { return e.id; }), safe: safe, risky: risky, best: best, worst: worst });
    }
  }); });
});
fs.writeFileSync(require("path").join(__dirname, "sweep-" + tierId + ".json"), JSON.stringify(rows));
console.log(tierId, rows.length);
