// tests/credit.js — the credit score (version 2.1, SPEC.md "Loans, credit and a name"): a real 300 to 850 score worked out from the
// run's history with the five FICO factors. Run from the repo root:  node tests/credit.js
// The score is a pure function of the saved run (log, missions, month, cash, debt), so most of these tests edit a saved run and read it back.
var load = require("./load");
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
var G = load({ storage: load.memoryStorage() });
var S = G.CAMPAIGN.comeback.score, SEIZE = S.seize, CR = G.CAMPAIGN.comeback.credit, T = G.CAMPAIGN.comeback.tiers;
function start(tier, seed) { G.resetCampaign(); return G.newComeback(tier || "standard", seed || 7); }
function edit(fn) { var c = G.getCampaign(); fn(c); G.saveCampaign(c); return G.getComeback(); }
function factor(h, id) { return h.credit_factors.filter(function (f) { return f.id === id; })[0].value; }
function lostSatellite(c) {
  c.missions.push({ id: "m" + c.missions.length, objective: "radiation", orbit: "leo", year: c.year, science: 0, stars: 0, payout_musd: 0, spent_musd: 1,
                    ended_early: true, month: c.month, months: 0 });
}
function band(id) { return S.bands.filter(function (b) { return b.id === id; })[0]; }

// ---- 1. The bands and the weights are FICO's.
check("1 the range is 300 to 850, the start 720 and the seize line 500", S.min === 300 && S.max === 850 && S.start === 720 && S.seize === 500);
check("1 the five bands are FICO's: POOR 300-579, FAIR 580-669, GOOD 670-739, VERY GOOD 740-799, EXCEPTIONAL 800-850",
  S.bands.length === 5 && ["POOR:300:579", "FAIR:580:669", "GOOD:670:739", "VERY GOOD:740:799", "EXCEPTIONAL:800:850"].every(function (x, i) {
    var p = x.split(":"); return S.bands[i].name === p[0] && S.bands[i].from === +p[1] && S.bands[i].to === +p[2]; }));
check("1 the weights are FICO's: payment 35, owed 30, length 15, new 10, mix 10 (they add up to 1)",
  S.weights.payment === 0.35 && S.weights.owed === 0.30 && S.weights.length === 0.15 && S.weights.new === 0.10 && S.weights.mix === 0.10 &&
  Math.abs(S.weights.payment + S.weights.owed + S.weights.length + S.weights.new + S.weights.mix - 1) < 1e-9);
var edges = { 300: "POOR", 579: "POOR", 580: "FAIR", 669: "FAIR", 670: "GOOD", 739: "GOOD", 740: "VERY GOOD", 799: "VERY GOOD", 800: "EXCEPTIONAL", 850: "EXCEPTIONAL" };
check("1 creditBand puts every edge score in its band", Object.keys(edges).every(function (k) { return G.creditBand(+k).name === edges[k]; }));
check("1 a lower band costs more interest and lends less, and POOR lends nothing",
  S.bands.every(function (b, i) { return i === 0 || (b.spread < S.bands[i - 1].spread && b.cap_share > S.bands[i - 1].cap_share); }) && S.bands[0].cap_share === 0 && band("good").spread === 0);

// ---- 2. Every run starts at 720 (GOOD), on every difficulty; the factors are 0 to 1 and weighted.
G.TIERS.forEach(function (t) {
  var h = start(t.id);
  check("2 " + t.id + ": a new comeback starts at exactly 720, GOOD, with five factors from 0 to 1 and their weights",
    h.credit_score === 720 && h.credit_band === "GOOD" && h.credit_band_id === "good" && h.credit_factors.length === 5 &&
    h.credit_factors.every(function (f) { return f.value >= 0 && f.value <= 1 && f.weight === S.weights[f.id]; }) &&
    h.interest_per_month === h.base_interest_per_month && h.max_borrow_musd === T[t.id].loan_cap_musd && !("credit" in G.getCampaign()),
    h.credit_score + " " + h.credit_band);
});
(function () {
  start("standard"); var c = G.getCampaign(), before = JSON.stringify(c);
  var a = G.creditScore(c), b = G.creditScore(c);
  check("2 the score is a pure function of the run: the same twice, and the run is not changed by asking", a === b && JSON.stringify(c) === before && Number.isInteger(a));
})();

// ---- 3. Each factor moves the score the right way.
(function () {
  var h0 = start("standard"), h;
  // Payment history (35%): late months and a lost satellite hurt; a real payment helps.
  h = edit(function (c) { c.month = 12; });   // twelve months with the debt above the cash
  check("3 payment history falls with the months behind (debt above the cash)", factor(h, "payment") < factor(h0, "payment"), factor(h0, "payment") + " -> " + factor(h, "payment"));
  var withLoss = edit(function (c) { lostSatellite(c); });
  check("3 a lost satellite counts against payment history and lowers the score", factor(withLoss, "payment") < factor(h, "payment") && withLoss.credit_score < h.credit_score, h.credit_score + " -> " + withLoss.credit_score);
  h = start("standard"); edit(function (c) { c.month = 12; c.treasury_musd = 20; G.makeOffers(c); }); var behind = G.getComeback();   // (new offers: a launch must stay affordable for a payment)
  var rp = G.payDebt(CR.min_payment_musd), paid = G.getComeback();
  check("3 a real payment raises payment history and the score", rp.ok && factor(paid, "payment") > factor(behind, "payment") && paid.credit_score > behind.credit_score, behind.credit_score + " -> " + paid.credit_score);
  h = start("standard"); edit(function (c) { c.month = 12; c.treasury_musd = 20; G.makeOffers(c); }); behind = G.getComeback(); G.payDebt(CR.min_payment_musd / 2);
  check("3 a payment under the minimum does not count as an on-time payment", G.getCampaign().log.some(function (e) { return e.kind === "payment"; }) && factor(G.getComeback(), "payment") === factor(behind, "payment"));
  // Amounts owed (30%): more debt lowers it, more cash raises it, paying the debt down raises it.
  h0 = start("standard");
  h = edit(function (c) { c.debt_musd = c.debt_musd + 10; });
  check("3 amounts owed: more debt lowers the factor and the score", factor(h, "owed") < factor(h0, "owed") && h.credit_score < h0.credit_score);
  h0 = start("standard"); h = edit(function (c) { c.debt_musd = c.debt_musd - 10; });
  check("3 amounts owed: less debt raises the factor and the score", factor(h, "owed") > factor(h0, "owed") && h.credit_score > h0.credit_score);
  h0 = start("standard"); h = edit(function (c) { c.treasury_musd = c.treasury_musd + 6; });
  check("3 amounts owed: more cash raises the factor", factor(h, "owed") > factor(h0, "owed") && h.credit_score >= h0.credit_score);
  // Length of history (15%): the months of the run (with nothing owed late, so only the length moves).
  h0 = start("standard");
  h = edit(function (c) { c.month = 24; c.treasury_musd = c.debt_musd + 1; });   // cash above debt: not late
  check("3 length of history: more months raise the factor", factor(h, "length") > factor(h0, "length") && factor(h, "length") <= 1 && factor(h, "payment") === 1, factor(h0, "length") + " -> " + factor(h, "length"));
  // New credit (10%): loans taken lately count; an old loan does not.
  h0 = start("standard"); G.borrow(2); h = G.getComeback();
  check("3 new credit: a loan lowers the factor and the score", factor(h, "new") < factor(h0, "new") && h.credit_score < h0.credit_score);
  h = edit(function (c) { c.month = c.month + S.new.recent_months + 1; c.treasury_musd = c.debt_musd + 50; });
  check("3 new credit: a loan older than the window no longer counts", factor(h, "new") === 1, factor(h, "new"));
  h0 = start("standard"); G.borrow(2); var two = (G.borrow(2), G.getComeback());
  check("3 new credit: more loans lower it further", factor(two, "new") < factor(G.getComeback(), "new") + 1e-9 && factor(two, "new") < 1);
  // Credit mix (10%): having borrowed and paid back.
  h0 = start("standard"); edit(function (c) { c.treasury_musd = 20; }); var m0 = G.getComeback(); G.payDebt(5); h = G.getComeback();
  check("3 credit mix: paying back raises the factor", factor(h, "mix") > factor(m0, "mix") && factor(h, "mix") <= 1);
})();

// ---- 4. A loan never raises the score and a payment never lowers it, across many states.
(function () {
  var bad = [];
  [650, 700, 720, 760, 820].forEach(function (startScore) { [0, 6, 18, 40].forEach(function (month) { [0, 1].forEach(function (lost) {
    start("expert"); edit(function (c) { c.credit = startScore; c.month = month; if (lost) lostSatellite(c); c.treasury_musd = 12; });
    var c = G.getCampaign(), now = G.creditScore(c);
    [0.1, 1, 5, 20].forEach(function (a) { if (G.scoreAfterLoan(c, a) > now) bad.push("loan " + a + " at " + startScore + "/" + month + "/" + lost); });
    var before = G.getComeback().credit_score;
    [0.4, 1, 3, 6].forEach(function (p) { var r = G.payDebt(p); if (r.ok) { var after = G.getComeback().credit_score; if (after < before) bad.push("pay " + p + " at " + startScore + "/" + month); before = after; } });
  }); }); });
  check("4 a loan never raises the score and a payment never lowers it (" + bad.length + " violations)", bad.length === 0, bad.slice(0, 3).join("; "));
})();

// ---- 5. The band sets the interest and the loan cap; a loan in POOR is refused.
G.TIERS.forEach(function (t) {
  S.bands.forEach(function (b) {
    var mid = Math.round((b.from + b.to) / 2);
    start(t.id); var h = edit(function (c) { c.credit = mid; });
    var cap = G.round(T[t.id].loan_cap_musd * b.cap_share, 3);
    var ok = h.credit_band_id === b.id && h.interest_per_month === G.round(h.base_interest_per_month + b.spread, 5) && (b.cap_share === 0 ? h.max_borrow_musd === 0 : h.max_borrow_musd > 0 && h.max_borrow_musd <= cap);
    check("5 " + t.id + " at " + mid + " (" + b.name + "): interest is base " + (b.spread >= 0 ? "+" : "") + b.spread + ", loan up to " + h.max_borrow_musd + " of " + cap, ok, h.credit_band_id);
  });
});
(function () {
  start("standard"); var h = edit(function (c) { c.credit = 560; });
  var r = G.borrow(1);
  check("5 a loan in POOR is refused: the lenders lend nothing, and nothing changes", h.credit_band === "POOR" && !r.ok && /POOR/.test(r.reason) && r.borrowed_musd === 0 &&
    G.getComeback().cash_musd === h.cash_musd && G.getComeback().debt_musd === h.debt_musd && G.getComeback().max_borrow_musd === 0);
})();
(function () {
  start("standard"); var h = edit(function (c) { c.credit = 650; });   // FAIR
  var cap = G.round(T.standard.loan_cap_musd * band("fair").cap_share, 3);
  check("5 FAIR lends half the cap", h.credit_band === "FAIR" && h.max_borrow_musd === cap, h.max_borrow_musd + " of " + cap);
  G.run("CAMPAIGN.comeback.score.seize = 640");   // a seize line just under FAIR: the first loan's own drop would reach it
  var r = G.borrow(1), hh = G.getComeback();
  G.run("CAMPAIGN.comeback.score.seize = " + SEIZE);
  check("5 a loan that would drop the score to the seize line is refused (a loan never ends the game by itself)", !r.ok && /take everything/.test(r.reason) && hh.max_borrow_musd === 0 && !hh.finished, r.reason);
})();
(function () {
  // The cap is cut back to the biggest loan that leaves the score above the seize line, and that loan is always allowed.
  var fails = [], cut = 0;
  [0, 8, 30].forEach(function (month) { [570, 600, 630, 660, 700, 780].forEach(function (st) { [-30, 0, 30].forEach(function (seizeShift) { ["training", "standard", "expert"].forEach(function (tier) {
    start(tier); edit(function (c) { c.credit = st; c.month = month; });
    G.run("CAMPAIGN.comeback.score.seize = " + (SEIZE + 90 + seizeShift));   // a higher line, so the cut shows
    var h = G.getComeback(), room = G.round(T[tier].loan_cap_musd * G.creditBand(h.credit_score).cap_share, 3);
    if (h.max_borrow_musd > 0) {
      if (h.max_borrow_musd < room - 1e-9) cut++;
      var r = G.borrow(h.max_borrow_musd);
      if (!r.ok || G.getComeback().credit_score <= SEIZE + 90 + seizeShift) fails.push(tier + "/" + st + "/" + month + ": " + (r.reason || G.getComeback().credit_score));
    }
    G.run("CAMPAIGN.comeback.score.seize = " + SEIZE);
  }); }); }); });
  check("5 borrow(max_borrow_musd) always works when the max is above 0, and leaves the score above the line (" + cut + " cut back)", fails.length === 0 && cut > 0, fails.slice(0, 2).join("; "));
})();

// ---- 6. The seize line: at 500 or below, with debt left, the lenders take everything.
(function () {
  start("expert"); edit(function (c) { c.credit = S.seize - 40; c.treasury_musd = 20; });
  var r = G.payDebt(0.5), h = G.getComeback();
  check("6 a score at the seize line with debt left is a loss: seized, the cash taken", h.finished && !h.won && h.lost_reason === "seized" && h.cash_musd === 0 && h.credit_score <= S.seize, h.credit_score + " " + h.lost_reason);
  start("expert"); edit(function (c) { c.credit = 640; });
  check("6 a score above the line is not seized", !G.getComeback().finished && G.getComeback().seize_score === 500);
})();

// ---- 7. A sensible player stays GOOD or better; a careless one reaches POOR.
var RAD = ["scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"];
function fly(d) { var m = G.startMission(d), s, n = 0; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, Math.max(0, s.event.choices.findIndex(function (x) { return !x.fail_chance_now; }))); } while (!s.ended && ++n < 500); return m; }
function radDesign(h) {
  var c = G.getCampaign(); c.offers = (c.offers || []).filter(function (k) { return k.id !== "t-rad"; }).concat({ id: "t-rad", topic: "radiation", orbit: null, client: "A test client", reason: "It tests things.",
    min_science: 60, price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: "A test contract." });
  G.saveCampaign(c);
  var d = G.newComebackDesign("t-rad"); if (!d) return null;
  if (!d.orbit) G.setOrbit(d, "leo"); G.setLauncher(d, "rideshare"); RAD.forEach(function (p) { G.addPart(d, p); });
  return G.runChecks(d).blockers.length ? null : d;
}
G.TIERS.forEach(function (t) {
  start(t.id, 11); var worst = 1000, flights = 0, why = "";
  for (var i = 0; i < 4 && !G.getComeback().finished; i++) {
    var h = G.getComeback(); if (h.offer) G.refuseBuyout();
    var d = radDesign(h); if (!d || G.getTotals(d).cost_musd > G.getComeback().cash_musd) break;
    var m = fly(d); G.recordResult(m); flights++;
    var after = G.getComeback(); worst = Math.min(worst, after.credit_score); why = after.credit_score + " " + after.credit_band;
  }
  check("7 " + t.id + ": a sensible player (no loans, no lost satellite) stays GOOD or better over " + flights + " flights", flights >= 2 && worst >= 670, "lowest " + worst + ", ends " + why);
});
(function () {
  // A careless player: borrows all the lenders allow, again and again, loses satellites and lets the months pass behind.
  start("standard", 3); var path = [G.getComeback().credit_score];
  for (var i = 0; i < 6; i++) { var m = G.getComeback().max_borrow_musd; if (!(m > 0)) break; G.borrow(m); path.push(G.getComeback().credit_score); }
  [[6, 1.04], [14, 1.1], [24, 1.2]].forEach(function (x) {   // three flights lost, the months passing with the debt growing and nothing paid
    edit(function (c) { lostSatellite(c); c.month = x[0] + 6; c.debt_musd = G.round(c.debt_musd * x[1], 3); });
    path.push(G.getComeback().credit_score);
  });
  var h = G.getComeback();
  check("7 a careless player (maximum loans, lost satellites, months behind) falls to POOR", h.credit_band === "POOR" && h.credit_score < path[0], path.join(" > "));
  check("7 ... and the lenders then refuse a loan", !G.borrow(0.5).ok && G.getComeback().max_borrow_musd === 0 && h.interest_per_month > h.base_interest_per_month, h.interest_per_month);
})();
(function () {
  // A middling player: one loan, paid back, no loss: still not POOR.
  start("standard", 5); G.borrow(5); edit(function (c) { c.treasury_musd = c.treasury_musd + 12; }); G.payDebt(6);
  check("7 one modest loan paid down keeps the score out of POOR", G.getComeback().credit_band_id !== "poor", G.getComeback().credit_score);
})();

// ---- 8. An old save keeps its credit (0 to 100) as the starting point, on the new scale (300 + 5.5 a point). More in tests/migration.js.
(function () {
  var map = function (x) { return Math.round(S.legacy_base + S.legacy_per_point * x); };
  [[100, 850], [77, map(77)], [50, 575], [0, 300]].forEach(function (p) {
    start("standard", 9);
    var c = JSON.parse(JSON.stringify(G.getCampaign())); c.credit = p[0]; c.finished = p[0] === 0; c.won = false;
    var raw = JSON.stringify(c), G2 = load({ storage: (function () { var st = load.memoryStorage(); st.setItem("smdg-campaign", raw); return st; })() }), h = G2.getComeback();
    var want = p[0] === 0 ? 300 : p[1];
    check("8 an old credit of " + p[0] + " is shown as " + want, h.credit_score === want && G2.creditScore(G2.getCampaign()) === want, h.credit_score);
  });
  check("8 the 0 to 100 `credit` is still given, derived from the score", (function () { start("standard"); var h = G.getComeback(); return h.credit === G.round((h.credit_score - 300) / 5.5, 1) && h.credit > 0 && h.credit <= 100; })());
})();

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
