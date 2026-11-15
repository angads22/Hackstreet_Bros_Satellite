// Part 1 is winnable: Node, the real back end, no browser.
// For each walkthrough step, the proof design in lib.js uses only what exists in 1958 (getAvailability), clears
// every blocker (runChecks) and flies to at least 1 star under every event choice. Also a sweep of every 1958
// design, to show what the steps can and cannot offer. Usage: node walk-proof.js
const path = require('path');
const T = require('./lib');
const repo = process.env.REPO || path.resolve(__dirname, '..', '..');
const G = require(path.join(repo, 'tests', 'load'))();
const { ok, done } = T.checker();
console.log('repo: ' + repo);

function design(x) {
  const d = G.newDesign('training');
  G.setEra(d, 'igy');
  const objective = x.preset.objective || x.objective, orbit = x.preset.orbit || x.orbit, launcher = x.preset.launcher || x.launcher;
  G.setObjective(d, objective); G.setOrbit(d, orbit);
  x.parts.forEach(p => G.addPart(d, p));
  G.setLauncher(d, launcher);
  return d;
}
function fly(d, choice) {
  const m = G.startMission(d);
  if (!m) return null;
  let s, n = 0;
  do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, Math.min(choice, s.event.choices.length - 1)); n++; } while (!s.ended && n < 400);
  return G.getDebrief(m);
}

ok(G.NEW_CATEGORIES_REQUIRED === true, 'body and attitude are required (NEW_CATEGORIES_REQUIRED)');
for (const step of [1, 2, 3]) {
  const x = T.WALK[step];
  const d = design(x);
  const a = G.getAvailability(d);
  const missing = x.parts.filter(p => !a.parts[p].available).concat(a.launchers[d.launcher].available ? [] : [d.launcher])
    .concat(a.objectives[d.objective].available ? [] : [d.objective]);
  ok(missing.length === 0, `step ${step}: every part, the rocket and the topic exist in 1958` + (missing.length ? ': missing ' + missing.join(', ') : ''));
  const c = G.runChecks(d);
  ok(c.blockers.length === 0, `step ${step}: no blockers` + (c.blockers.length ? ': ' + c.blockers.map(b => b.id).join(', ') : '') +
    (c.warnings.length ? ' (warnings: ' + c.warnings.map(w => w.id).join(', ') + ')' : ''));
  for (const choice of [0, 1, 2]) {
    const r = fly(d, choice);
    ok(r && r.stars >= 1, `step ${step}, event choice ${choice}: ${r ? r.stars + ' stars, score ' + r.score + ', limited by ' + r.limiting : 'did not launch'}`);
  }
}
const bo = design({ preset: T.WALK[1].preset, parts: T.BATTERY_ONLY });
const rb = fly(bo, 0);
ok(rb && rb.stars === 0, `battery-only (Explorer 1 as flown) earns no star: ${rb ? rb.stars + ' stars, score ' + rb.score + ', limited by ' + rb.limiting : 'did not launch'}`);

// The sweep: every 1958 design, every orbit and rocket.
const base = G.newDesign('training'); G.setEra(base, 'igy');
const av = G.getAvailability(base);
const parts = Object.keys(av.parts).filter(k => av.parts[k].available);
const rockets = Object.keys(av.launchers).filter(k => av.launchers[k].available);
const topics = Object.keys(av.objectives).filter(k => av.objectives[k].available);
let launchable = 0, passing = 0;
const orbits = {};
for (let mask = 1; mask < (1 << parts.length); mask++) {
  const ps = parts.filter((p, i) => mask & (1 << i));
  for (const orbit of G.ORBITS.map(o => o.id)) for (const l of rockets) {
    const d = G.newDesign('training'); G.setEra(d, 'igy'); G.setObjective(d, 'radiation'); G.setOrbit(d, orbit);
    ps.forEach(p => G.addPart(d, p)); G.setLauncher(d, l);
    if (G.runChecks(d).blockers.length) continue;
    launchable++; orbits[orbit] = true;
    const r = fly(d, 0);
    if (r.stars >= 1) passing++;
  }
}
console.log(`     1958 offers ${topics.length} topic (${topics.join(', ')}), ${rockets.length} rockets (${rockets.join(', ')}), ${parts.length} parts`);
console.log(`     sweep: ${launchable} launchable designs, ${passing} pass with 1 star or more; orbits that can launch: ${Object.keys(orbits).join(', ')}`);
ok(passing > 0, 'the sweep finds passing designs');
done();
