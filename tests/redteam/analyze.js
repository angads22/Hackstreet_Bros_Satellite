var L = require("./lib"); var G = L.G; var fs = require("fs");
var tier = process.argv[2];
var rows = JSON.parse(fs.readFileSync(require("path").join(__dirname, "sweep-" + tier + ".json"), "utf8"));
var IDS = L.PART_IDS;
function parts(mask) { return IDS.filter(function (_, i) { return mask & (1 << i); }); }
function hist(list, f) { var h = {}; list.forEach(function (r) { var k = f(r); h[k] = (h[k] || 0) + 1; }); return h; }
function pctOf(n, d) { return d ? (100 * n / d).toFixed(1) + "%" : "-"; }
var UHF = 1 << IDS.indexOf("radio-uhf");

console.log("######## TIER " + tier + " (budget " + G.TIERS.filter(function (t) { return t.id === tier; })[0].budget_musd + ")");
G.OBJECTIVES.forEach(function (o) {
  var R = rows.filter(function (r) { return r.o === o.id; });
  console.log("\n=== " + o.id + "  launchable designs: " + R.length);
  console.log(" stars (always-safe):", JSON.stringify(hist(R, function (r) { return r.safe.stars; })));
  console.log(" stars (always-risky):", JSON.stringify(hist(R, function (r) { return r.risky.stars; })));
  console.log(" stars (best sequence):", JSON.stringify(hist(R, function (r) { return r.best.stars; })));
  console.log(" stars (worst sequence):", JSON.stringify(hist(R, function (r) { return r.worst.stars; })));
  var bestBeatsSafe = R.filter(function (r) { return r.best.score > r.safe.score; });
  var riskyBeatsSafe = R.filter(function (r) { return r.risky.score > r.safe.score; });
  var choicesIrrelevant = R.filter(function (r) { return r.best.score === r.worst.score; });
  var starsDiffer = R.filter(function (r) { return r.best.stars !== r.worst.stars; });
  console.log(" choices: best>safe in " + pctOf(bestBeatsSafe.length, R.length) + ", risky>safe in " + pctOf(riskyBeatsSafe.length, R.length) +
    ", choices change nothing in " + pctOf(choicesIrrelevant.length, R.length) + ", choices change stars in " + pctOf(starsDiffer.length, R.length));
  console.log(" limiting (safe):", JSON.stringify(hist(R, function (r) { return r.safe.lim; })));
  console.log(" ended early (safe):", R.filter(function (r) { return r.safe.early; }).length, " (worst):", R.filter(function (r) { return r.worst.early; }).length);
  // 3 stars without hitting target
  var sneaky = R.filter(function (r) { return r.safe.stars === 3 && r.safe.sci < G.getObjective(o.id).science_target; });
  console.log(" 3 stars WITHOUT reaching target (safe):", sneaky.length, sneaky.length ? "e.g. " + JSON.stringify({ orb: sneaky[0].orb, ln: sneaky[0].ln, parts: parts(sneaky[0].mask), sci: sneaky[0].safe.sci, score: sneaky[0].safe.score }) : "");
  var twoNoTarget = R.filter(function (r) { return r.safe.stars >= 2 && r.safe.sci < G.getObjective(o.id).science_target; });
  console.log(" 2+ stars without reaching target (safe):", twoNoTarget.length);
  // Zero science high score
  var zero = R.filter(function (r) { return r.safe.sci === 0; });
  var zmax = zero.reduce(function (a, b) { return !a || b.safe.score > a.safe.score ? b : a; }, null);
  if (zmax) console.log(" zero-science designs: " + zero.length + ", best score " + zmax.safe.score + " (" + zmax.orb + "/" + zmax.ln + " " + parts(zmax.mask).join(",") + ")");
  // Per orbit
  G.ORBITS.forEach(function (orb) {
    var Ro = R.filter(function (r) { return r.orb === orb.id; });
    if (!Ro.length) { console.log(" [" + orb.id + "] no launchable design"); return; }
    var top = Ro.reduce(function (a, b) { return b.best.score > a.best.score || (b.best.score === a.best.score && b.cost < a.cost) ? b : a; });
    var topSafe = Ro.reduce(function (a, b) { return b.safe.score > a.safe.score || (b.safe.score === a.safe.score && b.cost < a.cost) ? b : a; });
    var two = Ro.filter(function (r) { return r.safe.stars >= 2; }), three = Ro.filter(function (r) { return r.safe.stars === 3; });
    var cheap2 = two.reduce(function (a, b) { return !a || b.cost < a.cost ? b : a; }, null);
    var min3 = three.reduce(function (a, b) { return !a || b.np < a.np || (b.np === a.np && b.cost < a.cost) ? b : a; }, null);
    var maxSci = Ro.reduce(function (a, b) { return b.prev > a.prev ? b : a; });
    console.log(" [" + orb.id + "] launchable " + Ro.length + ", 2+* safe " + two.length + " (" + pctOf(two.length, Ro.length) + "), 3* safe " + three.length +
      " | best-safe " + topSafe.safe.score + " " + topSafe.ln + " $" + topSafe.cost + " " + parts(topSafe.mask).join(",") +
      " | best-any-seq " + top.best.score + " seq " + top.best.seq);
    if (cheap2) console.log("     cheapest 2*: $" + cheap2.cost + " " + cheap2.ln + " " + parts(cheap2.mask).join(",") + " score " + cheap2.safe.score);
    if (min3) console.log("     fewest-part 3*: " + min3.np + " parts $" + min3.cost + " " + min3.ln + " " + parts(min3.mask).join(",") + " score " + min3.safe.score);
    console.log("     max preview science " + maxSci.prev + " with " + parts(maxSci.mask).join(","));
  });
  // Part frequency in 3-star vs all launchable designs
  var three = R.filter(function (r) { return r.safe.stars === 3; });
  var top200 = R.slice().sort(function (a, b) { return b.safe.score - a.safe.score || a.cost - b.cost; }).slice(0, 200);
  var freq = IDS.map(function (id, i) {
    var bit = 1 << i;
    return id + " " + pctOf(R.filter(function (r) { return r.mask & bit; }).length, R.length) + "/" + pctOf(three.filter(function (r) { return r.mask & bit; }).length, three.length) + "/" + pctOf(top200.filter(function (r) { return r.mask & bit; }).length, 200);
  });
  console.log(" part share (all launchable / 3-star / top-200):\n   " + freq.join("\n   "));
  // Luck: adding a UHF radio (0.1 kg, $0.01M) — how often does it change stars?
  var byKey = {}; R.forEach(function (r) { byKey[r.orb + r.ln + r.mask] = r; });
  var pairs = 0, changed = 0, up = 0, bigSwing = 0;
  R.forEach(function (r) {
    if (r.mask & UHF) return;
    var twin = byKey[r.orb + r.ln + (r.mask | UHF)];
    if (!twin) return;
    pairs++;
    if (twin.safe.stars !== r.safe.stars) changed++;
    if (twin.safe.stars > r.safe.stars) up++;
    if (Math.abs(twin.safe.score - r.safe.score) >= 10) bigSwing++;
  });
  console.log(" UHF-radio reroll: " + pairs + " pairs, stars change in " + pctOf(changed, pairs) + " (up in " + pctOf(up, pairs) + "), score swings >=10 in " + pctOf(bigSwing, pairs));
  // Max score and the 100 ceiling
  var max = R.reduce(function (a, b) { return b.best.score > a.best.score ? b : a; });
  console.log(" MAX score any seq: " + max.best.score + " (" + max.orb + "/" + max.ln + " $" + max.cost + " " + parts(max.mask).join(",") + ")");
  // Warnings present in 3-star designs
  console.log(" warnings among 3-star designs:", JSON.stringify(hist([].concat.apply([], three.map(function (r) { return r.warns.length ? r.warns : ["(none)"]; })), function (w) { return w.replace(/^resolution-.*/, "resolution"); })));
});
