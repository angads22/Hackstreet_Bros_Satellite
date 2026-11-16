// tests/sim.js — is Part 2 (Ajay's comeback) still winnable and fair? A seeded simulator on the real back end.
// Run from the repo root:  node tests/sim.js            (40 seeds per level and player, a few minutes)
//                          node tests/sim.js --quick    (10 seeds)
// Options: --seeds N, --level training|standard|expert, --player sensible|careless|expert, --trace (one line per flight).
// It is a measuring tool, not a pass/fail test: it prints a table and always exits 0. The table and what it means are in
// handoff/notes/v21-balance.md. Rockets fail at their real chances here (load({ realRockets: true })).
//
// Three players, each playing only through the functions the screens call:
//   SENSIBLE  for each open contract tries a few dozen designs from parts that fit the topic and the body, and flies the one
//             that earns most a month (expected pay less cost and interest, plus the stars a name needs). Never flies a
//             HIGH risk rocket or a design that lands after the deadline. On Normal and Hard pays the engineers for every
//             group it does not know of the parts it flies, and for the performance of the other instruments it weighed.
//             Makes one payment before each flight with the cash the flight does not need; borrows only the gap.
//   EXPERT    the same player, searching a few hundred designs per contract.
//   CARELESS  a random contract, random parts (any design with no blocker), random event choices, never asks the
//             engineers, borrows whenever short and sometimes for no reason, pays the debt only when the cash covers it all.
// Every player refuses Iron Eclipse's offer. The players forecast stars from the debrief's own scoring rule (a player
// learns it from the first debrief); they never look at the dice.
var load = require("./load");
var G = load({ realRockets: true });   // no storage: the save is kept in memory, which is several times faster (tests/comeback.js covers saving)
var CB = G.CAMPAIGN.comeback;

var args = process.argv.slice(2);
function opt(name) { var i = args.indexOf(name); return i === -1 ? null : args[i + 1]; }
var QUICK = args.indexOf("--quick") !== -1, TRACE = args.indexOf("--trace") !== -1;
// For tuning: --set tiers.standard.debt_musd=36 changes a value of CAMPAIGN.comeback for this run only (repeat it for more).
var SETS = args.filter(function (a, i) { return args[i - 1] === "--set" && /^[\w.]+=-?[\d.]+$/.test(a); });
SETS.forEach(function (a) { G.run("CAMPAIGN.comeback." + a.replace("=", " = ") + ";"); });
var SEEDS = opt("--seeds") ? Math.max(1, parseInt(opt("--seeds"), 10)) : QUICK ? 10 : 40;
var LEVELS = G.TIERS.map(function (t) { return t.id; }).filter(function (id) { return !opt("--level") || opt("--level") === id; });
var PLAYERS = ["sensible", "expert", "careless"].filter(function (p) { return !opt("--player") || opt("--player") === p; });
var SEARCH = { sensible: 36, expert: 300 };      // designs tried per open contract
var RESERVE = 0.3;                               // $M kept back for what an event may cost
var STAR_WORTH = 2;                              // $M a star is worth to a player whose name is still short
var EVENT_POINTS = 8;                            // of 10: what a careful player expects to keep through the events

// A seeded random source for the players (mulberry32), so the table is the same on every machine.
function rng(seed) {
  var a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pick(list, rnd) { return list[Math.floor(rnd() * list.length)]; }
function median(list) { if (!list.length) return null; var s = list.slice().sort(function (a, b) { return a - b; }); return s[Math.floor((s.length - 1) / 2)]; }

function shelf(cat) { return G.PARTS.filter(function (p) { return p.category === cat && G.isPartAvailable(p.id); }); }
var SHELF = null;
function shelves() {
  return SHELF || (SHELF = { instrument: shelf("instrument"), power: shelf("power"), comms: shelf("comms"), computer: shelf("computer"),
                             attitude: shelf("attitude"), structure: shelf("structure"), propulsion: shelf("propulsion"),
                             launchers: G.LAUNCHERS.filter(function (l) { return G.isLauncherAvailable(l.id); }).sort(function (a, b) { return a.cost_musd - b.cost_musd; }) });
}
function fitsBody(body, parts) {
  var load = 0, n = {};
  parts.forEach(function (p) { load += p.mass_kg; n[p.category] = (n[p.category] || 0) + 1; });
  if (G.round(load, 2) > (body.payload_kg || 0) + 1e-6) return false;
  return Object.keys(n).every(function (cat) { return ((body.slots || {})[cat] || 0) >= n[cat]; });
}
function safe(ev) { var j = ev.choices.findIndex(function (c) { return !c.fail_chance_now; }); return j < 0 ? 0 : j; }

// The stars a careful player expects from a design: the debrief's own rule (js/mission.js, getDebrief) with nothing lost
// to luck but EVENT_POINTS.
function expectedStars(d, camp) {
  var ps = G.previewScience(d), t = G.getTotals(d), obj = G.getObjective(d.objective);
  var k = G.payoutFor(obj, camp.knowledge_science[d.objective] || 0, ps.total);
  var eff = t.cost_musd > 0 ? Math.min(1, (k.payout_musd / t.cost_musd) / 1.5) : 0;
  var score = 50 * ps.share + 15 * eff + (t.margins.mass !== null && t.margins.mass >= G.LOW_MARGIN ? 7.5 : 0) +
              (t.margins.power !== null && t.margins.power >= G.LOW_MARGIN ? 7.5 : 0) + EVENT_POINTS + 10 * k.novelty;
  return score >= 90 && ps.total >= ps.target ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;
}

// One random design for a contract from parts that fit its topic and its body, on the cheapest rocket that is not HIGH risk.
function draft(k, rnd) {
  var S = shelves(), o = G.getObjective(k.topic);
  var ins = S.instrument.filter(function (p) { return p.tags.some(function (t) { return o.wants.indexOf(t) !== -1; }); });
  var orbits = k.orbit ? [k.orbit] : G.ORBITS.filter(function (x) { return !o.orbit_fit || o.orbit_fit[x.id]; }).map(function (x) { return x.id; });
  if (!ins.length || !orbits.length) return null;
  var parts = [pick(ins, rnd)];
  if (ins.length > 1 && rnd() < 0.35) { var second = pick(ins, rnd); if (second !== parts[0]) parts.push(second); }
  var pw = pick(S.power, rnd); parts.push(pw);
  if (rnd() < 0.4) { var pw2 = pick(S.power, rnd); if (pw2 !== pw) parts.push(pw2); }
  parts.push(pick(S.comms, rnd), pick(S.computer, rnd), pick(S.attitude, rnd));
  if (rnd() < 0.2) parts.push(pick(S.propulsion, rnd));
  var body = pick(S.structure, rnd);
  if (!fitsBody(body, parts)) return null;
  parts.push(body);
  var d = G.newComebackDesign(k.id);
  if (!d) return null;
  if (!d.orbit) G.setOrbit(d, pick(orbits, rnd));
  parts.forEach(function (p) { G.addPart(d, p.id); });
  var mass = parts.reduce(function (t, p) { return t + p.mass_kg; }, 0);
  for (var i = 0; i < S.launchers.length; i++) {
    var l = S.launchers[i], cap = (l.capacity_kg || {})[d.orbit] || 0;
    if (!cap || G.round(mass, 2) > cap + 1e-6) continue;
    G.setLauncher(d, l.id);
    if (G.getLaunchRisk(d).level === "high") continue;
    return d;
  }
  return null;
}

// The cheapest plain design that flies for an open contract (one fitting instrument, the cheapest radio, computer and
// pointing, every power source and body tried): what a player with almost no cash is left with. Null when none can be paid for.
function cheapDesign(h) {
  var S = shelves(), best = null;
  function byCost(list) { return list.slice().sort(function (a, b) { return a.cost_musd - b.cost_musd; }); }
  var comms = byCost(S.comms), comps = byCost(S.computer), atts = byCost(S.attitude);
  h.contracts.forEach(function (k) {
    var o = G.getObjective(k.topic);
    var orbits = k.orbit ? [k.orbit] : G.ORBITS.filter(function (x) { return !o.orbit_fit || o.orbit_fit[x.id]; }).map(function (x) { return x.id; });
    S.instrument.filter(function (p) { return p.tags.some(function (t) { return o.wants.indexOf(t) !== -1; }); }).forEach(function (ins) {
      S.power.forEach(function (pw) { S.structure.forEach(function (body) { orbits.forEach(function (orb) {
        atts.forEach(function (att) { comms.forEach(function (cm) { comps.forEach(function (cp) {
          var parts = [ins, pw, cm, cp, att];
          var mass = parts.concat([body]).reduce(function (t, p) { return t + p.mass_kg; }, 0);
          var l = S.launchers.filter(function (x) { var cap = (x.capacity_kg || {})[orb] || 0; return cap && G.round(mass, 2) <= cap + 1e-6; })[0];
          if (!l) return;
          var cost = G.round(parts.concat([body]).reduce(function (t, p) { return t + p.cost_musd; }, 0) + l.cost_musd, 3);
          if (best && cost >= best.cost || cost > h.cash_musd + h.max_borrow_musd || !fitsBody(body, parts)) return;
          var d = G.newComebackDesign(k.id);
          if (!d) return;
          G.setOrbit(d, orb); G.setLauncher(d, l.id);
          parts.concat([body]).forEach(function (p) { G.addPart(d, p.id); });
          if (G.runChecks(d).blockers.some(function (b) { return b.id !== "budget"; }) || !(G.scienceRate(d, []).per_month > 0)) return;
          best = { d: d, k: k, cost: cost, pay: G.previewProfit(d).pay_musd, stars: expectedStars(d, G.getCampaign()), months: G.flightMonths(d) };
        }); }); });
      }); }); });
    });
  });
  return best;
}

// The best of `tries` designs per open contract that the cash and the lenders can pay for.
function chooseDesign(h, camp, tries, rnd, late) {
  var best = null, left = h.months_left, nameShort = h.reputation < h.reputation_goal;
  var need = Math.max(0, Math.ceil((h.reputation_goal - h.reputation) / CB.credit.reputation_per_star));
  h.contracts.forEach(function (k) {
    var seen = {}, valid = 0;
    for (var i = 0; i < tries * 8 && valid < tries; i++) {
      var d = draft(k, rnd);
      if (!d) continue;
      var key = d.orbit + "|" + d.launcher + "|" + d.parts.slice().sort().join(",");
      if (seen[key]) continue;
      seen[key] = true;
      if (G.runChecks(d).blockers.some(function (b) { return b.id !== "budget"; })) continue;
      var months = G.flightMonths(d);
      if (months >= left && !late) continue;                          // it would land after the deadline
      var pr = G.previewProfit(d);
      if (!pr || pr.cost_musd === null || pr.cost_musd > h.cash_musd + h.max_borrow_musd - 0.2) continue;
      valid++;
      var chance = G.getLaunchRisk(d).chance, stars = expectedStars(d, camp);
      var pay = pr.pay_musd + (stars === 3 ? k.bonus_musd : 0);       // 3 stars earn the bonus
      var profit = pay * (1 - chance) - pr.cost_musd - h.debt_musd * h.interest_per_month * months;
      var value = h.debt_musd > 0 ? (profit + STAR_WORTH * Math.min(stars, need)) / months
                                  : stars / months + profit / 1000;        // the debt is paid: only the name is missing
      if (!nameShort) value = profit / months;
      if (!best || value > best.value) best = { d: d, k: k, value: value, cost: pr.cost_musd, pay: pr.pay_musd, stars: stars, months: months };
    }
  });
  return best;
}

// Normal and Hard: the engineers are paid for what a careful player reads before flying a part.
function askEngineers(best, rnd) {
  var o = G.getObjective(best.d.objective);
  best.d.parts.forEach(function (id) { G.INFO_GROUPS.forEach(function (g) { G.buyPartInfo(best.d, id, g); }); });
  shelves().instrument.filter(function (p) { return best.d.parts.indexOf(p.id) === -1 && p.tags.some(function (t) { return o.wants.indexOf(t) !== -1; }); })
    .slice(0, 2).forEach(function (p) { G.buyPartInfo(best.d, p.id, "performance"); });
}

function fly(d, choose) {
  var m = G.startMission(d);
  if (!m) return null;
  var s; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, choose(s.event)); } while (!m.ended);
  G.recordResult(m);
  return m;
}
function traceFlight(label, best) {
  if (!TRACE) return;
  var h = G.getComeback(), last = h.missions[h.missions.length - 1] || {};
  console.log("    " + label + " flight " + h.flights + ": " + last.objective + " " + last.orbit + ", cost " + (best ? best.cost : "?") + ", plan pay " + (best ? best.pay : "?") +
    " stars " + (best ? best.stars : "?") + " -> paid " + last.payout_musd + ", " + last.stars + " stars; month " + h.month + "/" + h.deadline_month +
    ", cash " + h.cash_musd + ", debt " + h.debt_musd + ", name " + h.reputation + "/" + h.reputation_goal + ", score " + h.credit_score);
}

function playCareful(tries, rnd) {
  for (var guard = 0; guard < 40; guard++) {
    var h = G.getComeback();
    if (h.finished) return;
    if (h.offer) { G.refuseBuyout(); continue; }
    var nameShort = h.reputation < h.reputation_goal;
    if (h.debt_musd > 0 && h.cash_musd >= h.debt_musd && !nameShort) { G.payDebt(h.debt_musd); continue; }   // the win
    // Nothing lands in time: it flies anyway, and the game ends the run. Nothing it can pay for: the cheapest plain design.
    var best = chooseDesign(h, G.getCampaign(), tries, rnd) || chooseDesign(h, G.getCampaign(), tries, rnd, true) || cheapDesign(h);
    if (!best) {
      if (h.debt_musd > 0 && h.cash_musd >= h.debt_musd) { G.payDebt(h.debt_musd); continue; }
      if (h.max_borrow_musd > 0.5) { G.borrow(h.max_borrow_musd); continue; }
      return;                                                         // nothing it can fly: the game ends it, or the run counts as stuck
    }
    askEngineers(best, rnd);
    h = G.getComeback();
    var cost = G.getTotals(best.d).cost_musd, spare = G.round(h.cash_musd - cost - RESERVE, 1);
    if (h.cash_musd < cost) G.borrow(Math.min(h.max_borrow_musd, G.round(cost - h.cash_musd + RESERVE, 3)));
    else if (h.debt_musd > 0 && spare >= CB.credit.min_payment_musd) {   // one payment a flight, with the cash the flight does not need
      G.payDebt(spare >= h.debt_musd ? h.debt_musd : Math.min(spare, h.safe_pay_max_musd));
      if (G.getComeback().finished) return;
    }
    if (!fly(best.d, safe)) { if (TRACE) console.log("    could not launch: " + JSON.stringify(G.runChecks(best.d).blockers.map(function (b) { return b.id; }))); return; }
    traceFlight("careful", best);
  }
}

function playCareless(rnd) {
  var ALL = G.PARTS.filter(function (p) { return G.isPartAvailable(p.id); }).map(function (p) { return p.id; });
  var L = G.LAUNCHERS.filter(function (l) { return G.isLauncherAvailable(l.id); });
  for (var guard = 0; guard < 60; guard++) {
    var h = G.getComeback();
    if (h.finished) return;
    if (h.offer) { G.refuseBuyout(); continue; }
    if (h.debt_musd > 0 && h.cash_musd >= h.debt_musd) { G.payDebt(h.debt_musd); continue; }
    if (rnd() < 0.2 && h.max_borrow_musd > 1) { G.borrow(G.round(rnd() * h.max_borrow_musd, 1) || 1); h = G.getComeback(); if (h.finished) return; }   // borrows freely
    var k = pick(h.contracts, rnd), d = null, o = G.getObjective(k.topic);
    for (var tries = 0; tries < 200 && !d; tries++) {
      var x = G.newComebackDesign(k.id);
      if (!x) break;
      if (!x.orbit) G.setOrbit(x, pick(G.ORBITS, rnd).id);
      G.setLauncher(x, pick(L, rnd).id);
      ALL.forEach(function (p) { if (rnd() < 0.25) G.addPart(x, p); });
      if (!x.parts.some(function (id) { return G.getPart(id).category === "attitude"; })) G.addPart(x, pick(shelves().attitude, rnd).id);
      if (!x.parts.some(function (id) { return G.getPart(id).category === "structure"; })) G.addPart(x, pick(shelves().structure, rnd).id);
      var blockers = G.runChecks(x).blockers.filter(function (b) { return b.id !== "budget"; });
      if (!blockers.length && G.getTotals(x).cost_musd <= h.cash_musd + h.max_borrow_musd) d = x;
    }
    var best = null;
    if (!d) {                                                         // stuck: copies the cheapest plain design that flies
      best = cheapDesign(h);
      d = best ? best.d : null;
    }
    if (!d) { if (h.max_borrow_musd > 0) { G.borrow(h.max_borrow_musd); continue; } return; }
    var cost = G.getTotals(d).cost_musd;
    if (h.cash_musd < cost) G.borrow(Math.min(h.max_borrow_musd, G.round(cost - h.cash_musd + 0.1 + rnd() * 3, 1)));
    if (G.getComeback().finished) return;
    if (!fly(d, function (ev) { return Math.floor(rnd() * ev.choices.length); })) return;
    traceFlight("careless", best || { cost: cost });
  }
}

function runOne(level, player, seed) {
  G.resetCampaign();
  G.newComeback(level, seed);
  var rnd = rng(seed * 7919 + LEVELS.indexOf(level) * 104729 + ["sensible", "expert", "careless"].indexOf(player) * 15485863 + 11);
  if (TRACE) console.log("  " + level + " " + player + " seed " + seed);
  if (player === "careless") playCareless(rnd); else playCareful(SEARCH[player], rnd);
  var h = G.getComeback();
  var end = h.won ? "won" : !h.finished ? "stuck" : h.lost_reason || "sold";
  if (TRACE) console.log("    => " + end + " after " + h.flights + " flights, month " + h.month + ", score " + h.credit_score + ", name " + h.reputation + "/" + h.reputation_goal + ", debt " + h.debt_musd + ", cash " + h.cash_musd);
  return { end: end, flights: h.flights, score: h.credit_score, month: h.month };
}

function pad(x, n) { x = String(x); while (x.length < n) x += " "; return x; }
var t0 = Date.now(), rows = [];
LEVELS.forEach(function (level) {
  PLAYERS.forEach(function (player) {
    var ends = { won: 0, deadline: 0, cash: 0, seized: 0, name: 0, stuck: 0, sold: 0 }, winFlights = [], scores = [], winMonths = [];
    for (var seed = 1; seed <= SEEDS; seed++) {
      var r = runOne(level, player, seed);
      ends[r.end]++; scores.push(r.score);
      if (r.end === "won") { winFlights.push(r.flights); winMonths.push(r.month); }
    }
    rows.push({ level: level, player: player, win: Math.round(100 * ends.won / SEEDS), flights: median(winFlights), months: median(winMonths), ends: ends, score: median(scores) });
  });
});
var NAMES = { training: "Easy", standard: "Normal", expert: "Hard" };
console.log("\nAjay's comeback, " + SEEDS + " seeds per level and player (rockets fail at their real chances)\n");
console.log(pad("level", 8) + pad("player", 10) + pad("win %", 7) + pad("flights", 9) + pad("months", 8) + pad("deadline", 10) + pad("cash", 6) + pad("seized", 8) + pad("name", 6) + pad("stuck", 7) + "score");
rows.forEach(function (r) {
  console.log(pad(NAMES[r.level] || r.level, 8) + pad(r.player, 10) + pad(r.win, 7) + pad(r.flights === null ? "-" : r.flights, 9) + pad(r.months === null ? "-" : r.months, 8) +
    pad(r.ends.deadline, 10) + pad(r.ends.cash, 6) + pad(r.ends.seized, 8) + pad(r.ends.name, 6) + pad(r.ends.stuck, 7) + r.score);
});
console.log("\nwin %: runs won. flights, months: the median to a win. deadline, cash, seized, name: how the lost runs ended. score: the median credit score at the end.");
console.log("Took " + Math.round((Date.now() - t0) / 1000) + " s.");
