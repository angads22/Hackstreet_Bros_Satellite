// Shared harness: loads the game into Node and offers play helpers.
var G = require(require("path").join(__dirname, "..", "..", "tests", "load.js"))();
var PART_IDS = G.PARTS.map(function (p) { return p.id; });

function design(tier, obj, orbit, launcher, parts) {
  var d = G.newDesign(tier); G.setObjective(d, obj); G.setOrbit(d, orbit); G.setLauncher(d, launcher);
  parts.forEach(function (id) { G.addPart(d, id); });
  return d;
}
// Play with a policy: function(event, idx, mission) -> choice index; or array of choices.
function play(d, policy) {
  var m = G.startMission(d), s, guard = 0, k = 0;
  do {
    s = G.stepMonth(m);
    if (s.event) {
      var c = Array.isArray(policy) ? (policy[k] || 0) : policy(s.event, k, m);
      k++; G.chooseEvent(m, c);
    }
  } while (!m.ended && ++guard < 1000);
  var db = G.getDebrief(m);
  db.mission = m;
  return db;
}
function safeIdx(ev) { // choice with no fail_chance; prefer cheapest-looking
  for (var i = 0; i < ev.choices.length; i++) if (!ev.choices[i].effect.fail_chance) return i;
  return 0;
}
var SAFE = function (ev) { return safeIdx(ev); };
var RISKY = function (ev) {
  for (var i = 0; i < ev.choices.length; i++) if (ev.choices[i].effect.fail_chance) return i;
  return 1;
};
function eventCount(d) { return G.startMission(d).schedule.length; }
function bestPlay(d) { // enumerate all choice sequences
  var n = eventCount(d), best = null;
  for (var mask = 0; mask < (1 << n); mask++) {
    var seq = []; for (var i = 0; i < n; i++) seq.push((mask >> i) & 1);
    var r = play(d, seq);
    if (!best || r.score > best.score) { best = r; best.seq = seq; }
  }
  return best;
}
module.exports = { G: G, PART_IDS: PART_IDS, design: design, play: play, SAFE: SAFE, RISKY: RISKY, bestPlay: bestPlay, safeIdx: safeIdx };
