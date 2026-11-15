// tests/comeback.js — Part 2, Ajay's comeback: a mode of the campaign (SPEC.md, "Two game modes").
// Run from the repo root:  node tests/comeback.js
// The game runs against a localStorage that keeps only text (tests/load.js), so a change that is not
// saved fails here as it would in a browser, and a second load with the same storage is a page reload.
var load = require("./load");
var store = load.memoryStorage();
var G = load({ storage: store });
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-9); }
var CB = G.CAMPAIGN.comeback;
// Every comeback below starts from a fixed seed, so a run is the same on every machine (the seed tests are in section 16).
function NC(tier, seed) { return G.newComeback(tier, seed === undefined ? 7 : seed); }

// A radiation counter on a 12U CubeSat: cheap, quick, and well above a radiation contract's minimum.
var RAD = ["scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"];
// A test contract, added to the open ones the way tests/campaign.js adds offers.
function addContract(fields) {
  var c = G.getCampaign();
  var k = Object.assign({ id: "t-rad", topic: "radiation", orbit: null, client: "A test client", reason: "It tests things.",
                          min_science: 60, price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: "A test contract." }, fields || {});
  c.offers = (c.offers || []).filter(function (x) { return x.id !== k.id; }).concat([k]);
  G.saveCampaign(c);
  return k;
}
function design(contractId, orbit, launcher, parts) {
  if (G.getComeback() && G.getComeback().offer) G.refuseBuyout();   // Iron Eclipse's offer waits after the second flight (section 17)
  var d = G.newComebackDesign(contractId);
  if (!d) return null;
  G.setOrbit(d, orbit); G.setLauncher(d, launcher);
  parts.forEach(function (p) { G.addPart(d, p); });
  return d;
}
function safe(ev) { var j = ev.choices.findIndex(function (c) { return !c.fail_chance_now; }); return j < 0 ? 0 : j; }
function fly(d) {
  var m = G.startMission(d); if (!m) return null;
  var s; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, safe(s.event)); } while (!m.ended);
  return m;
}
function interestFor(debt, months) { for (var i = 0; i < months; i++) debt = G.round(debt * (1 + CB.interest_per_month), 3); return debt; }

// ---- 1. Data: contracts for every topic; the config has every difficulty.
var badReasons = [];
G.OBJECTIVES.forEach(function (o) {
  var list = G.CONTRACTS[o.id] || [];
  if (list.length < 3) badReasons.push(o.id + " has " + list.length);
  list.forEach(function (k) { if (!k.client || !k.reason || k.reason.length >= 90) badReasons.push(o.id + ": " + k.reason); });
});
check("1 every topic has three or more clients, each with a one-line reason", badReasons.length === 0, badReasons.join("; "));
check("1 every difficulty has its cash, debt and deadline", G.TIERS.every(function (t) {
  var x = CB.tiers[t.id]; return x && x.cash_musd > 0 && x.debt_musd > 0 && x.deadline_months > 0; }));

// ---- 2. Start, per difficulty.
G.TIERS.forEach(function (t) {
  G.resetCampaign();
  var h = NC(t.id), x = CB.tiers[t.id];
  check("2 " + t.id + ": a new comeback starts with its cash, debt and deadline",
    h && h.mode === "comeback" && h.tier === t.id && h.tier_name === t.name && h.cash_musd === x.cash_musd && h.debt_musd === x.debt_musd &&
    h.start_debt_musd === x.debt_musd && h.deadline_month === x.deadline_months && h.month === 0 && h.months_left === x.deadline_months &&
    h.year === G.getEra("new-space").year && !h.finished && !h.won && h.lost_reason === null && h.flights === 0 && h.debt_paid_musd === 0,
    JSON.stringify({ cash: h.cash_musd, debt: h.debt_musd, deadline: h.deadline_month, year: h.year }));
  var topics = h.contracts.map(function (k) { return k.topic; });
  check("2 " + t.id + ": " + CB.contracts_open + " contracts, never two for one topic, each with every field",
    h.contracts.length === CB.contracts_open && topics.every(function (x, i) { return topics.indexOf(x) === i; }) &&
    h.contracts.every(function (k) {
      return ["id", "client", "reason", "topic", "topic_name", "orbit", "orbit_name", "min_science", "price_musd", "bonus_musd",
              "expires_month", "months_left", "text"].every(function (f) { return f in k; }) &&
        k.price_musd > 0 && k.min_science > 0 && near(k.bonus_musd, G.round(k.price_musd * CB.bonus_3_stars, 1)) &&
        k.expires_month === CB.contract_months && k.months_left === CB.contract_months;
    }), topics.join(","));
});
G.resetCampaign();
check("2 an unknown difficulty starts a Normal comeback", NC("nonsense").tier === "standard");
check("2 a named orbit is one a rocket reaches for less than the contract pays", (function () {
  var ok = true;
  for (var i = 0; i < 12; i++) {
    G.resetCampaign(); NC(G.TIERS[i % 3].id, i + 1);
    G.getComeback().contracts.forEach(function (k) { if (k.orbit && !(G.cheapestRocketTo(k.orbit) < k.price_musd)) ok = false; });
  }
  return ok;
})());

// ---- 3. Today's parts; no research and no lab; standalone designs unaffected.
G.resetCampaign(); NC("standard");
var k3 = addContract();
var d3 = G.newComebackDesign(k3.id);
check("3 a comeback design flies for its contract, with the topic preset", d3.campaign && d3.comeback && d3.contract === k3.id && d3.objective === "radiation");
var av = G.getAvailability(d3);
var replaced = G.PARTS.filter(function (p) { return G.PARTS.some(function (q) { return q.upgrade && q.upgrade.of === p.id; }); }).map(function (p) { return p.id; });
var notAvailable = G.PARTS.filter(function (p) { return !av.parts[p.id].available; }).map(function (p) { return p.id; });
check("3 every part of today is on the shelf; the 1950s originals show as replaced by their successors",
  notAvailable.slice().sort().join() === replaced.slice().sort().join() &&
  notAvailable.every(function (id) { return /^Replaced by /.test(av.parts[id].reason); }) &&
  ["thermal-imager", "sar-radar", "cubesat-12u", "radio-xband", "prop-ion", "scintillation-counter", "alouette-2-sounder"].every(function (id) { return av.parts[id].available; }),
  notAvailable.join(","));
check("3 every rocket and every topic is open", G.LAUNCHERS.every(function (l) { return av.launchers[l.id].available; }) &&
  G.OBJECTIVES.every(function (o) { return av.objectives[o.id].available; }));
check("3 there is no lab: research and upgrades are refused", !G.buyResearch("solar-cells").ok && !G.buyUpgrade("avcs-camera").ok &&
  /no lab/.test(G.buyResearch("heavy-lift").reason));
var s3 = G.setEra(G.newDesign("standard"), "igy");
check("3 a standalone design is unaffected: its era still decides", !G.isPartAvailable("thermal-imager", s3) && G.isPartAvailable("cosmic-ray-counter", s3) &&
  G.getTotals(s3).budget_musd === G.getTier("standard").budget_musd);
var s3b = G.newDesign("standard"); G.setObjective(s3b, "radiation"); G.setOrbit(s3b, "leo"); G.setLauncher(s3b, "rideshare");
RAD.forEach(function (p) { G.addPart(s3b, p); });
var ids3 = G.runChecks(s3b).blockers.concat(G.runChecks(s3b).warnings).map(function (x) { return x.id; });
check("3 a standalone design has no comeback checks", ["no-contract", "no-comeback", "contract-topic", "contract-orbit", "deadline", "too-late"].every(function (id) {
  return ids3.indexOf(id) === -1; }) && G.runChecks(s3b).blockers.length === 0, ids3.join(","));

// ---- 4. The budget is the cash, and the launch is paid from it.
var d4 = design(k3.id, "leo", "rideshare", RAD);
var t4 = G.getTotals(d4), cash4 = G.getCampaign().treasury_musd;
check("4 the readiness budget is the cash", t4.budget_musd === cash4 && G.runChecks(d4).blockers.length === 0, "budget " + t4.budget_musd);
var big = design(k3.id, "leo", "heavy", RAD);
var bb = G.runChecks(big).blockers.filter(function (x) { return x.id === "budget"; })[0];
check("4 a design dearer than the cash is blocked", !!bb && /you have \$/.test(bb.text), bb && bb.text);
var pp4 = G.previewPayout(d4);
check("4 the Build screen's payout line is the contract's pay", pp4.contract && pp4.contract.id === k3.id && pp4.expected_payout_musd === k3.price_musd &&
  near(pp4.net_musd, G.round(k3.price_musd - t4.cost_musd, 3)) && pp4.contract.met === true, JSON.stringify(pp4.contract));
var m4 = G.startMission(d4);
check("4 the launch is paid from the cash", near(G.getCampaign().treasury_musd, G.round(cash4 - t4.cost_musd, 3)));
var s4; do { s4 = G.stepMonth(m4); if (s4.event) G.chooseEvent(m4, safe(s4.event)); } while (!m4.ended);
var debt4 = G.getCampaign().debt_musd, month4 = G.getCampaign().month, cashBefore4 = G.getCampaign().treasury_musd;
var db4 = G.getDebrief(m4), r4 = G.recordResult(m4), c4 = G.getCampaign();

// ---- 5. Pay, bonus, months and interest for one flight.
var share4 = Math.min(1, m4.science / k3.min_science), paid4 = G.round(k3.price_musd * share4, 3), bonus4 = db4.stars === 3 ? k3.bonus_musd : 0;
check("5 the flight is paid in proportion to its data, up to the full price", r4.contract_id === k3.id && r4.contract_paid_musd === paid4 && m4.science > 0,
  "science " + m4.science + ", paid " + r4.contract_paid_musd);
check("5 the 3-star bonus follows the stars", r4.contract_bonus_musd === bonus4 && r4.payout_musd === G.round(paid4 + bonus4, 3),
  db4.stars + " stars, bonus " + r4.contract_bonus_musd);
check("5 the debrief shows the same money", db4.payout_musd === r4.payout_musd && db4.contract_paid_musd === paid4 && db4.contract_bonus_musd === bonus4);
var db4b = G.getDebrief(m4);   // the screens call recordResult first, then getDebrief: the money must not change
check("5 the debrief after recordResult still shows the contract's money", db4b.payout_musd === r4.payout_musd &&
  db4b.contract_paid_musd === paid4 && db4b.contract_bonus_musd === bonus4 && /paid \$/.test(db4b.segments[3].text), db4b.segments[3].text);
check("5 cash: pay plus bonus, less event costs; no grant", near(c4.treasury_musd, G.round(G.round(cashBefore4 + paid4 + bonus4, 3) - m4.extra_cost_musd, 3)) &&
  r4.cash_musd === c4.treasury_musd && r4.treasury_musd === c4.treasury_musd && r4.grant_musd === 0);
var used4 = G.devMonths(m4.design) + CB.launch_campaign_months;
check("5 months used = development time + launch campaign", r4.months_used === used4 && c4.month === month4 + used4 &&
  r4.months_left === c4.deadline_month - c4.month, used4 + " months");
check("5 the debt grows by the monthly interest, compounded", c4.debt_musd === interestFor(debt4, used4) && r4.debt_musd === c4.debt_musd &&
  r4.interest_musd === G.round(c4.debt_musd - debt4, 3) && r4.interest_musd > 0, debt4 + " -> " + c4.debt_musd);
check("5 recordResult pays once", G.recordResult(m4) === r4 && G.getCampaign().treasury_musd === c4.treasury_musd);
check("5 the year follows the months", c4.year === G.getEra("new-space").year + Math.floor(c4.month / 12));
var last4 = c4.missions[c4.missions.length - 1];
check("5 the flight is saved with its month and contract", last4.month === c4.month && last4.contract === k3.id && last4.payout_musd === r4.payout_musd);

var kHigh = addContract({ id: "t-high", min_science: 1000, price_musd: 10, bonus_musd: 2.5 });
var mHigh = fly(design(kHigh.id, "leo", "rideshare", RAD)), dHigh = G.getDebrief(mHigh), rHigh = G.recordResult(mHigh);
check("5 less data than the minimum pays in proportion: price x science / minimum", rHigh.contract_paid_musd > 0 && rHigh.contract_paid_musd < kHigh.price_musd &&
  rHigh.contract_paid_musd === G.round(kHigh.price_musd * mHigh.science / kHigh.min_science, 3) && rHigh.contract_bonus_musd === (dHigh.stars === 3 ? 2.5 : 0),
  G.round(mHigh.science, 1) + " of " + kHigh.min_science + " points paid $" + rHigh.contract_paid_musd + "M of $" + kHigh.price_musd + "M");
var kT = { topic: "radiation", orbit: null, min_science: 100, price_musd: 10, bonus_musd: 2.5 }, dT = { objective: "radiation", orbit: "leo" };
var p2 = G.contractPay(kT, dT, 50, 50, 2), p3 = G.contractPay(kT, dT, 150, 150, 3), p0 = G.contractPay(kT, dT, 150, 0, 3);
check("5 the bonus needs 3 stars and some pay; half the minimum pays half", p2.paid_musd === 5 && p2.bonus_musd === 0 && p3.paid_musd === 10 &&
  p3.bonus_musd === 2.5 && p0.paid_musd === 0 && p0.bonus_musd === 0 &&
  G.contractPay(kT, { objective: "weather", orbit: "leo" }, 150, 150, 3).paid_musd === 0 &&
  G.contractPay(Object.assign({}, kT, { orbit: "sso" }), dT, 150, 150, 3).paid_musd === 0);

// ---- 6. Contracts: the flown one closes, the rest refill to three; expired ones go.
var h6 = G.getComeback();
check("6 the flown contract closes and the list refills", h6.contracts.length === CB.contracts_open && h6.contracts.every(function (k) { return k.id !== k3.id; }) &&
  G.getCampaign().offers.some(function (k) { return k.id === k3.id && k.done; }));
check("6 contracts come only from topics with new data left, one per topic", h6.contracts.every(function (k) {
  return (G.getCampaign().knowledge_science[k.topic] || 0) < G.dataCap(G.getObjective(k.topic)); }) &&
  h6.contracts.map(function (k) { return k.topic; }).every(function (x, i, a) { return a.indexOf(x) === i; }));
check("6 a contract's months left count down to its expiry", h6.contracts.every(function (k) { return k.months_left === k.expires_month - h6.month && k.months_left > 0; }));
var keep = h6.contracts[0], gone = h6.contracts[1];
var c6 = G.getCampaign();
c6.offers.forEach(function (k) { if (k.id === gone.id) k.expires_month = c6.month + 1; });
G.saveCampaign(c6);
var k6 = addContract({ id: "t-rad-2" });
var r6 = G.recordResult(fly(design(k6.id, "leo", "rideshare", RAD)));
var ids6 = G.getComeback().contracts.map(function (k) { return k.id; });
check("6 a contract past its month expires", ids6.indexOf(gone.id) === -1 && !G.getCampaign().offers.some(function (k) { return k.id === gone.id; }), ids6.join(","));
check("6 an open contract that has not expired stays", keep.expires_month > G.getCampaign().month ? ids6.indexOf(keep.id) !== -1 : ids6.indexOf(keep.id) === -1);
check("6 and the list is full again", ids6.length === CB.contracts_open);

// ---- 7. Contract checks at the readiness review.
var k7 = addContract({ id: "t-sso", orbit: "sso" });
var d7 = G.newComebackDesign(k7.id);
check("7 a contract that names an orbit presets it", d7.orbit === "sso");
G.setOrbit(d7, "leo"); G.setLauncher(d7, "rideshare"); RAD.forEach(function (p) { G.addPart(d7, p); });
var b7 = G.runChecks(d7).blockers.map(function (x) { return x.id; });
G.setObjective(d7, "weather");
var b7b = G.runChecks(d7).blockers.map(function (x) { return x.id; });
check("7 another orbit or topic than the contract's is blocked", b7.indexOf("contract-orbit") !== -1 && b7b.indexOf("contract-topic") !== -1, b7.concat(b7b).join(","));
var loose = G.newCampaignDesign();
check("7 a comeback design without a contract is blocked", loose.comeback && G.runChecks(loose).blockers.some(function (x) { return x.id === "no-contract"; }));
var again = design(k6.id, "leo", "rideshare", RAD);
check("7 a contract already flown cannot be flown again", again === null && G.newComebackDesign("no-such-contract") === null);
var c7 = G.getCampaign(); var month7 = c7.month; c7.month = c7.deadline_month - 1; G.saveCampaign(c7);
var d7c = design(addContract({ id: "t-late" }).id, "leo", "rideshare", RAD);
var w7 = G.runChecks(d7c).warnings.filter(function (x) { return x.id === "deadline"; })[0];
check("7 a flight that would land on or after the deadline is warned about, not blocked", !!w7 && G.runChecks(d7c).blockers.length === 0, w7 && w7.text);
c7 = G.getCampaign(); c7.month = month7;
c7.offers = c7.offers.filter(function (k) { return k.id.indexOf("t-") !== 0 || k.done; });   // put the test contracts away
G.saveCampaign(c7);
var d7d = design(addContract({ id: "t-early" }).id, "leo", "rideshare", RAD);
check("7 with time left there is no deadline warning", G.runChecks(d7d).warnings.every(function (x) { return x.id !== "deadline"; }));

// ---- 8. The new-data rule: a topic already fully known pays nothing.
var c8 = G.getCampaign(); c8.knowledge_science.radiation = G.dataCap(G.getObjective("radiation")); G.saveCampaign(c8);
var cash8 = G.getCampaign().treasury_musd, d8 = d7d, cost8 = G.getTotals(d8).cost_musd;
check("8 the preview says a known topic pays nothing", G.previewPayout(d8).expected_payout_musd === 0 && G.previewPayout(d8).contract.met === false);
var m8 = fly(d8), r8 = G.recordResult(m8);
check("8 a flight with no new data is paid nothing, not even the bonus", m8.science > 0 && r8.nothing_new && r8.contract_paid_musd === 0 &&
  r8.contract_bonus_musd === 0 && near(G.getCampaign().treasury_musd, G.round(G.round(cash8 - cost8, 3) - m8.extra_cost_musd, 3)), "science " + m8.science);
check("8 and the known topic gets no new contracts", G.getComeback().contracts.every(function (k) { return k.topic !== "radiation"; }));

// ---- 9. Paying back: the limits, and a win.
G.resetCampaign(); NC("standard");
var h9 = G.getComeback();
check("9 safe_pay_max keeps the cheapest launch for an open contract", h9.cheapest_launch_musd > 0 &&
  near(h9.safe_pay_max_musd, Math.max(0, G.round(h9.cash_musd - h9.cheapest_launch_musd, 3))) && h9.safe_pay_max_musd < h9.cash_musd,
  "cash " + h9.cash_musd + ", cheapest " + h9.cheapest_launch_musd + ", safe " + h9.safe_pay_max_musd);
var refusals = ["1", NaN, Infinity, -1, 0, null, undefined].map(function (x) { return G.payDebt(x); });
check("9 payDebt refuses a non-number, a negative and nothing", refusals.every(function (r) { return r.ok === false && r.paid_musd === 0 && r.reason; }) &&
  G.getComeback().cash_musd === h9.cash_musd && G.getComeback().debt_musd === h9.debt_musd);
var tiny = G.payDebt(0.0004);
check("9 payDebt refuses an amount that rounds to nothing", !tiny.ok && G.getComeback().debt_paid_musd === 0 && !(G.getCampaign().log || []).length, tiny.reason);
var tooMuch = G.payDebt(h9.cash_musd + 1);
check("9 payDebt refuses more than the cash", !tooMuch.ok && /only/.test(tooMuch.reason), tooMuch.reason);
var unsafe = G.payDebt(G.round(h9.safe_pay_max_musd + 0.01, 3));
check("9 payDebt refuses a part payment that would leave too little to launch", !unsafe.ok && /at most/.test(unsafe.reason), unsafe.reason);
var p9 = G.payDebt(1);
var h9b = G.getComeback();
check("9 a payment moves cash to the debt", p9.ok && p9.paid_musd === 1 && p9.cash_musd === G.round(h9.cash_musd - 1, 3) &&
  p9.debt_musd === G.round(h9.debt_musd - 1, 3) && !p9.won && h9b.debt_paid_musd === 1 && h9b.cash_musd === p9.cash_musd);
var c9 = G.getCampaign(); c9.treasury_musd = G.round(c9.debt_musd + 5, 3); G.saveCampaign(c9);
var all9 = G.payDebt(c9.debt_musd + 3);
var h9c = G.getComeback();
check("9 paying the whole debt wins at once (and more than the debt pays only the debt)", all9.ok && all9.won && all9.debt_musd === 0 &&
  all9.paid_musd === c9.debt_musd && near(all9.cash_musd, 5, 1e-6) && h9c.finished && h9c.won && h9c.lost_reason === null && h9c.contracts.length === 0);
check("9 after the win nothing more can be paid or flown", !G.payDebt(1).ok && G.newComebackDesign(h9.contracts[0].id) === null);
var e9 = G.getComebackEnding();
check("9 the ending of a win", e9.won && e9.lost_reason === null && e9.title && e9.headline && e9.text && e9.epilogue &&
  e9.totals.paid_musd === G.round(1 + c9.debt_musd, 3) && near(e9.totals.interest_musd, 0, 1e-6) &&
  e9.timeline.length === 2 && e9.timeline.every(function (x) { return "month" in x && x.title && x.text; }), JSON.stringify(e9.totals));

// ---- 10. Losing on time.
G.resetCampaign(); NC("standard");
var c10 = G.getCampaign(); c10.month = c10.deadline_month - 2; G.saveCampaign(c10);
var k10 = addContract();
var r10 = G.recordResult(fly(design(k10.id, "leo", "rideshare", RAD)));
var h10 = G.getComeback();
check("10 the deadline passing with debt left loses", r10.comeback_over && !r10.won && r10.lost_reason === "deadline" && h10.finished && !h10.won &&
  h10.lost_reason === "deadline" && h10.months_left === 0 && h10.debt_musd > 0, "month " + h10.month + " of " + h10.deadline_month);
var e10 = G.getComebackEnding();
check("10 the ending of a loss by time", !e10.won && e10.lost_reason === "deadline" && e10.epilogue && e10.timeline.length === 1 && e10.totals.flights === 1 &&
  e10.totals.earned_musd === r10.payout_musd && near(e10.totals.interest_musd, G.round(h10.debt_musd - h10.start_debt_musd, 3), 1e-6));
check("10 a finished comeback flies nothing more", G.newComebackDesign(k10.id) === null && !G.payDebt(1).ok);

// ---- 11. Losing on cash, and no bail-out.
G.resetCampaign(); NC("expert");
var k11 = addContract();
var d11 = design(k11.id, "leo", "rideshare", ["cloud-photocell", "solar-small", "radio-uhf", "obc-basic", "spin-stabilised", "explorer-body"]);   // the wrong instrument: no data
var c11 = G.getCampaign(); c11.treasury_musd = G.getTotals(d11).cost_musd; G.saveCampaign(c11);
var m11 = fly(d11), r11 = G.recordResult(m11), h11 = G.getComeback();
check("11 no bail-out: an empty treasury stays empty", m11.science === 0 && r11.bailout === false && r11.bailout_musd === 0 && r11.grant_musd === 0 &&
  h11.cash_musd <= 0, "cash " + h11.cash_musd);
check("11 cash that cannot buy any launchable design loses", h11.finished && !h11.won && h11.lost_reason === "cash" && r11.lost_reason === "cash" &&
  r11.comeback_over, "cheapest " + h11.cheapest_launch_musd);
check("11 the ending of a loss by cash", G.getComebackEnding().lost_reason === "cash" && !G.getComebackEnding().won);
G.resetCampaign(); NC("expert");
var c11b = G.getCampaign(); c11b.treasury_musd = c11b.debt_musd; G.saveCampaign(c11b);
G.recordResult(fly(design(addContract().id, "leo", "rideshare", RAD)));
check("11 no cash loss while the cash covers the debt", !G.getComeback().finished || G.getComeback().won);

// ---- 12. The save survives a reload, and an old save is discarded.
G.resetCampaign(); NC("training");
var k12 = addContract();
G.recordResult(fly(design(k12.id, "leo", "rideshare", RAD)));
G.payDebt(G.round(Math.min(1, G.getComeback().safe_pay_max_musd), 3));
var before12 = JSON.stringify(G.getComeback()), ending12 = JSON.stringify(G.getComebackEnding());
var G2 = load({ storage: store });   // a fresh page with the same browser storage
check("12 the comeback survives a reload", JSON.stringify(G2.getComeback()) === before12 && JSON.stringify(G2.getComebackEnding()) === ending12,
  before12.slice(0, 120));
var code = G.exportSave();
G.resetCampaign();
check("12 a save code restores the comeback", G.importSave(code).ok && JSON.stringify(G.getComeback()) === before12);
var old = JSON.parse(store.getItem("smdg-campaign")); old.version = 3; delete old.mode; store.setItem("smdg-campaign", JSON.stringify(old));
var G3 = load({ storage: store });
check("12 an old save (version 3) is discarded", G3.getCampaign() === null && G3.getComeback() === null && G3.CAMPAIGN.save_version > 3);

// ---- 13. The 1957 campaign is unchanged, and the two modes never mix.
G.resetCampaign();
var c13 = G.newCampaign("training");
check("13 a 1957 campaign is mode campaign, with no comeback", c13.mode === "campaign" && c13.year === G.CAMPAIGN.start_year && G.getComeback() === null &&
  G.getComebackEnding() === null && G.newComebackDesign("t-rad") === null && !G.payDebt(1).ok);
var d13 = G.newCampaignDesign();
G.setObjective(d13, "radiation"); G.setOrbit(d13, "leo"); G.setLauncher(d13, "juno-1");
["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer", "explorer-body", "spin-stabilised"].forEach(function (p) { G.addPart(d13, p); });
var b13 = G.runChecks(d13);
check("13 a 1957 design has no comeback checks and launches", !d13.comeback && b13.blockers.length === 0 &&
  b13.warnings.every(function (x) { return x.id !== "deadline"; }), b13.blockers.map(function (x) { return x.id; }).join(","));
var r13 = G.recordResult(fly(d13));
check("13 a 1957 flight is paid by the knowledge curve and the grant, with no comeback fields",
  r13.grant_musd === G.CAMPAIGN.grant_musd && typeof r13.payout_musd === "number" && !("contract_id" in r13) && !("debt_musd" in r13) &&
  G.getCampaign().year === G.CAMPAIGN.start_year + 1 && !("month" in G.getCampaign()) && !("debt_musd" in G.getCampaign()));
check("13 the 1957 lab still works", G.getLab().upgrades.length > 0 && G.buyResearch("no-such").reason === "No such research.");
G.resetCampaign(); NC("standard");
var cross = design(addContract().id, "leo", "rideshare", RAD);
G.newCampaign("training");
check("13 a comeback design never flies in a 1957 campaign", G.startMission(cross) === null &&
  G.runChecks(cross).blockers.some(function (x) { return x.id === "no-comeback"; }));
var d13b = G.newCampaignDesign();
G.setObjective(d13b, "radiation"); G.setOrbit(d13b, "leo"); G.setLauncher(d13b, "juno-1");
["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer", "explorer-body", "spin-stabilised"].forEach(function (p) { G.addPart(d13b, p); });
var ok13b = G.runChecks(d13b).blockers.length === 0;
NC("standard");
check("13 a 1957 design that could launch never flies in a comeback", ok13b && G.startMission(d13b) === null &&
  G.runChecks(d13b).blockers.some(function (x) { return x.id === "no-contract"; }));

// ---- 14. No soft lock: careless players (random parts, random choices) always reach an ending, and while a
// comeback runs with less cash than debt there is always a contract it can afford to fly. The check builds
// that design itself (one part per category, cheapest first), so it does not trust cheapestLaunchCost.
var seed14 = 4242;
function rnd14() { seed14 = (seed14 * 1103515245 + 12345) & 0x7fffffff; return seed14 / 0x7fffffff; }
var cheapMemo = {};
function cheapestFor(k) {
  var key = k.topic + "/" + k.orbit;
  if (key in cheapMemo) return cheapMemo[key];
  function av(cat) { return G.PARTS.filter(function (p) { return p.category === cat && G.isPartAvailable(p.id); }).sort(function (a, b) { return a.cost_musd - b.cost_musd; }); }
  var o = G.getObjective(k.topic), best = null, bestCost = Infinity, L = G.LAUNCHERS.slice().sort(function (a, b) { return a.cost_musd - b.cost_musd; });
  var orbits = k.orbit ? [k.orbit] : G.ORBITS.filter(function (x) { return !o.orbit_fit || o.orbit_fit[x.id]; }).map(function (x) { return x.id; });
  orbits.forEach(function (orb) { av("instrument").filter(function (p) { return p.tags.some(function (t) { return o.wants.indexOf(t) !== -1; }); }).forEach(function (i) {
    av("power").forEach(function (pw) { av("comms").forEach(function (cm) { av("computer").forEach(function (cp) { [null].concat(av("propulsion")).forEach(function (pr) {
      av("structure").forEach(function (b) {
        var parts = [i, pw, cm, cp, b, G.getPart("spin-stabilised")].concat(pr ? [pr] : []);
        var pc = parts.reduce(function (t, p) { return t + p.cost_musd; }, 0);
        for (var li = 0; li < L.length && pc + L[li].cost_musd < bestCost; li++) {
          var d = { tier: "standard", objective: k.topic, orbit: orb, launcher: L[li].id, parts: parts.map(function (p) { return p.id; }) };
          if (G.runChecks(d).blockers.length || !(G.scienceRate(d, []).per_month > 0)) continue;
          best = d; bestCost = pc + L[li].cost_musd; break;
        }
      });
    }); }); }); });
  }); });
  return (cheapMemo[key] = best ? { orbit: best.orbit, launcher: best.launcher, parts: best.parts, cost: G.round(bestCost, 3) } : null);
}
var ALL = G.PARTS.map(function (p) { return p.id; }), locks = [], unended = 0, flights14 = 0, endings = {};
for (var run = 0; run < 24; run++) {
  G.resetCampaign(); NC(G.TIERS[run % 3].id, run + 1);
  for (var guard = 0; guard < 40 && !G.getComeback().finished; guard++) {
    var h = G.getComeback();
    if (h.offer) { if (rnd14() < 0.3) G.acceptBuyout(); else G.refuseBuyout(); continue; }   // a careless player answers by chance
    if (h.cash_musd >= h.debt_musd) { G.payDebt(h.debt_musd); break; }
    var flyable = h.contracts.filter(function (k) { var x = cheapestFor(k); return x && x.cost <= h.cash_musd; });
    if (!flyable.length) { locks.push("month " + h.month + ", cash " + h.cash_musd + ", contracts " + h.contracts.map(function (k) { return k.topic; })); break; }
    if (rnd14() < 0.3 && h.safe_pay_max_musd > 0.1) G.payDebt(G.round(rnd14() * h.safe_pay_max_musd, 1));
    h = G.getComeback();
    var k14 = h.contracts[Math.floor(rnd14() * h.contracts.length)], d14 = null;
    for (var tries = 0; tries < 200 && !d14; tries++) {
      var x = G.newComebackDesign(k14.id);
      if (!x.orbit) G.setOrbit(x, G.ORBITS[Math.floor(rnd14() * 3)].id);
      G.setLauncher(x, G.LAUNCHERS[Math.floor(rnd14() * G.LAUNCHERS.length)].id);
      ALL.filter(function () { return rnd14() < 0.3; }).forEach(function (p) { G.addPart(x, p); });
      if (!x.parts.some(function (id) { return G.getPart(id).category === "attitude"; })) G.addPart(x, "spin-stabilised");
      if (!x.parts.some(function (id) { return G.getPart(id).category === "structure"; })) G.addPart(x, "smallsat-bus");
      if (!G.runChecks(x).blockers.length) d14 = x;
    }
    if (!d14) {   // a stuck player copies the cheapest design that flies for some open contract
      var f14 = G.getComeback().contracts.filter(function (k) { var c = cheapestFor(k); return c && c.cost <= G.getComeback().cash_musd; })[0];
      var cd = f14 && cheapestFor(f14);
      d14 = cd ? design(f14.id, cd.orbit, cd.launcher, cd.parts) : null;
    }
    var m14 = d14 && G.startMission(d14);
    if (!m14) { locks.push("could not launch at month " + h.month + ": " + JSON.stringify(d14 && G.runChecks(d14).blockers)); break; }
    var s14; do { s14 = G.stepMonth(m14); if (s14.event) G.chooseEvent(m14, Math.floor(rnd14() * s14.event.choices.length)); } while (!m14.ended);
    G.recordResult(m14); flights14++;
  }
  var end14 = G.getComeback();
  if (!end14.finished) unended++; else endings[end14.ending_id] = (endings[end14.ending_id] || 0) + 1;
}
check("14 no soft lock: careless comebacks always end, and a running one can always fly a contract", locks.length === 0 && unended === 0,
  flights14 + " flights; " + JSON.stringify(endings) + (locks.length ? "; " + locks[0] : ""));
check("14 the cash-loss line agrees with a design search", (function () {
  var ok = true;
  for (var i = 0; i < 9; i++) {
    G.resetCampaign(); NC(G.TIERS[i % 3].id, i + 1);
    var hh = G.getComeback(), mine = Math.min.apply(null, hh.contracts.map(function (k) { var x = cheapestFor(k); return x ? x.cost : Infinity; }));
    if (!near(hh.cheapest_launch_musd, mine, 1e-6)) ok = false;
  }
  return ok;
})());

// ---- 15. Fast enough for a browser, even before the searches are cached.
var worst15 = 0;
for (var i15 = 0; i15 < 12; i15++) {
  G.resetCampaign(); G.run("cheapestCache = {}");
  var t15 = process.hrtime.bigint(); NC(G.TIERS[i15 % 3].id, i15 + 1); G.getComeback();
  worst15 = Math.max(worst15, Number(process.hrtime.bigint() - t15) / 1e6);
}
var t15b = process.hrtime.bigint(); for (var j15 = 0; j15 < 50; j15++) G.getComeback();
var hub15 = Number(process.hrtime.bigint() - t15b) / 1e6 / 50;
check("15 a new comeback opens in under 100 ms, and the hub refreshes in under 10 ms", worst15 < 100 && hub15 < 10,
  "new " + worst15.toFixed(1) + " ms, hub " + hub15.toFixed(2) + " ms");

// ---- 16. The run's seed: the same seed plays the same run, a new seed plays differently.
function sketch(h) { return h.contracts.map(function (k) { return [k.id, k.topic, k.orbit, k.client, k.reason, k.price_musd].join("|"); }).join(";"); }
G.resetCampaign();
var seedA = NC("standard", 12345), seedA2 = (G.resetCampaign(), NC("standard", 12345)), seedB = (G.resetCampaign(), NC("standard", 54321));
check("16 newComeback(tier, seed) keeps the seed, in the hub and in the save", seedA.seed === 12345 && seedB.seed === 54321 && G.getCampaign().seed === 54321 &&
  G.getCampaign().buyout === "none" && Number.isInteger(seedB.seed));
check("16 the same seed deals the same contracts (clients, reasons, topics, orbits)", sketch(seedA) === sketch(seedA2), sketch(seedA).slice(0, 100));
check("16 a different seed deals different contracts", sketch(seedA) !== sketch(seedB));
var variety = { clients: {}, topics: {}, orbits: {}, reasons: {}, sets: {} };
for (var sd = 1; sd <= 60; sd++) {
  G.resetCampaign();
  var hh = NC(G.TIERS[sd % 3].id, sd * 7919);
  variety.sets[hh.contracts.map(function (k) { return k.topic + ":" + k.client + ":" + k.orbit; }).join(",")] = 1;
  hh.contracts.forEach(function (k) { variety.clients[k.client] = 1; variety.topics[k.topic] = 1; variety.orbits[k.orbit || "none"] = 1; variety.reasons[k.reason] = 1; });
}
check("16 sixty seeds give sixty different first hands, every topic, several orbits and many clients and reasons",
  Object.keys(variety.sets).length >= 58 && Object.keys(variety.topics).length === G.OBJECTIVES.length && Object.keys(variety.orbits).length >= 3 &&
  Object.keys(variety.clients).length >= 20 && Object.keys(variety.reasons).length >= 20,
  Object.keys(variety.sets).length + " hands, " + Object.keys(variety.clients).length + " clients, " + Object.keys(variety.orbits).join("/"));
var afterA = [], afterA2 = [];
[afterA, afterA2].forEach(function (out) {
  G.resetCampaign(); NC("standard", 99);
  var kk = addContract({ id: "t-seed" });
  G.recordResult(fly(design(kk.id, "leo", "rideshare", RAD)));
  out.push(sketch(G.getComeback()));
});
check("16 the later contracts, after a flight, are the same for the same seed", afterA[0] === afterA2[0]);
var u1 = (G.resetCampaign(), NC("standard", undefined)), u2 = (G.resetCampaign(), G.newComeback("standard")), u3 = (G.resetCampaign(), G.newComeback("standard"));
check("16 with no seed a random one is drawn (a whole 32-bit number), and the runs differ", [u2, u3].every(function (h) { return Number.isInteger(h.seed) && h.seed >= 0 && h.seed <= 4294967295; }) &&
  (u2.seed !== u3.seed || sketch(u2) !== sketch(u3)), u2.seed + " " + u3.seed);
check("16 a seed that is not a whole number is made one", (G.resetCampaign(), G.newComeback("standard", -7.9)).seed === 7 && (G.resetCampaign(), G.newComeback("standard", 4294967296 + 5)).seed === 5 &&
  Number.isInteger((G.resetCampaign(), G.newComeback("standard", NaN)).seed) && Number.isInteger((G.resetCampaign(), G.newComeback("standard", "abc")).seed));

// ---- 17. getComeback() for the story screens, the buyout offer, accept and refuse.
function flyOne() {   // one real flight on a test contract; returns the recorded result
  var kk = addContract({ id: "t-story-" + G.getCampaign().missions.length });
  var d = design(kk.id, "leo", "rideshare", RAD);
  return G.recordResult(fly(d));
}
G.resetCampaign(); NC("standard", 21);
var h17 = G.getComeback();
check("17 a fresh comeback: act 1, no last flight, the whole debt left, no offer, not ended", h17.act === 1 && h17.last_flight === null && h17.debt_share_left === 1 &&
  h17.buyout === "none" && h17.offer === null && h17.ending_id === null && h17.seed === 21);
var r17 = flyOne(), h17b = G.getComeback(), lf = h17b.last_flight, m17 = G.getCampaign().missions[0];
check("17 after one settled flight: act 2, last_flight says what happened, no offer yet", h17b.act === 2 && h17b.offer === null && h17b.buyout === "none" && !!lf &&
  lf.stars === m17.stars && lf.paid_musd === m17.payout_musd && lf.new_data === m17.new_data && lf.ended_early === m17.ended_early &&
  lf.topic === "radiation" && lf.topic_name === G.getObjective("radiation").name &&
  ["stars", "paid_musd", "new_data", "ended_early", "topic", "topic_name"].every(function (f) { return f in lf; }) && Object.keys(lf).length === 6, JSON.stringify(lf));
check("17 debt_share_left is the debt over the starting debt, 0..1, two decimals", h17b.debt_share_left > 0 && h17b.debt_share_left <= 1 &&
  h17b.debt_share_left === G.round(Math.min(1, h17b.debt_musd / h17b.start_debt_musd), 2));
var r17b = flyOne(), h17c = G.getComeback();
check("17 after the second settled flight the debt stands: act 3 and Iron Eclipse's offer is open", h17c.act === 3 && h17c.buyout === "offered" && h17c.offer && h17c.offer.id === "buyout" &&
  Object.keys(h17c.offer).length === 1 && !h17c.finished && h17c.ending_id === null && G.getCampaign().buyout === "offered", JSON.stringify(h17c.offer));
check("17 the open offer blocks the next design until it is answered", G.newComebackDesign(h17c.contracts[0].id) === null);
var stale = (function () { var c = G.getCampaign(), keep = c.buyout; c.buyout = "none"; G.saveCampaign(c);
  var d = G.newComebackDesign(h17c.contracts[0].id); G.setOrbit(d, "leo"); G.setLauncher(d, "rideshare"); RAD.forEach(function (p) { G.addPart(d, p); });
  c = G.getCampaign(); c.buyout = keep; G.saveCampaign(c); return d; })();
check("17 and a design made before the offer cannot launch while it is open", G.startMission(stale) === null && G.runChecks(stale).blockers.some(function (x) { return x.id === "buyout-open"; }));
check("17 the offer survives a reload", (function () { var G2 = load({ storage: store }); var h = G2.getComeback(); return h.offer && h.offer.id === "buyout" && h.buyout === "offered" && h.seed === 21; })());
var ref = G.refuseBuyout(), h17d = G.getComeback();
check("17 refuseBuyout: ok, the offer closes for good, play goes on", ref.ok && ref.reason === null && Object.keys(ref).length === 2 && h17d.buyout === "refused" && h17d.offer === null && !h17d.finished &&
  G.newComebackDesign(h17d.contracts[0].id) !== null);
check("17 a refused offer cannot be answered again, accepted or refused", !G.refuseBuyout().ok && !G.acceptBuyout().ok && G.getComeback().buyout === "refused" && !G.getComeback().finished);
flyOne(); flyOne();
check("17 a refused offer is never made again", G.getComeback().buyout === "refused" && G.getComeback().offer === null);
G.resetCampaign(); NC("expert", 22);
check("17 nothing to answer before the offer: accept and refuse are refused", !G.acceptBuyout().ok && !G.refuseBuyout().ok && /offering/.test(G.acceptBuyout().reason) && !G.getComeback().finished);
flyOne(); flyOne();
check("17 the offer is made on the second flight on every difficulty",
  G.getComeback().offer !== null && [["training", 31], ["standard", 32]].every(function (t) {
    G.resetCampaign(); NC(t[0], t[1]); flyOne(); var before = G.getComeback().offer; flyOne(); var after = G.getComeback();
    return before === null && (after.finished ? after.won : after.offer !== null); }));
G.resetCampaign(); NC("standard", 23); flyOne(); flyOne();
var acc = G.acceptBuyout(), h17e = G.getComeback(), e17 = G.getComebackEnding();
check("17 acceptBuyout: ok, the comeback ends, not won, not lost, sold", acc.ok && acc.reason === null && Object.keys(acc).length === 2 && h17e.finished && !h17e.won &&
  h17e.lost_reason === null && h17e.ending_id === "sold" && h17e.buyout === "accepted" && h17e.offer === null, JSON.stringify(h17e.ending_id));
check("17 after the sale nothing more can be flown, paid or answered", G.newComebackDesign("x") === null && !G.payDebt(1).ok && !G.acceptBuyout().ok && !G.refuseBuyout().ok);
check("17 the sold ending has its chronicle", e17.ending_id === "sold" && !e17.won && e17.lost_reason === null && e17.title && e17.headline && e17.text && e17.epilogue &&
  e17.totals.flights === 2 && e17.timeline.length === 2, e17.title);
check("17 the sale survives a reload", (function () { var G2 = load({ storage: store }); return G2.getComeback().ending_id === "sold" && G2.getComebackEnding().ending_id === "sold"; })());
G.resetCampaign(); NC("standard", 24);
check("17 an offer is not made on the first flight, nor to a debt that is paid", (function () {
  flyOne(); var c = G.getCampaign(), a = c.buyout; c.treasury_musd = c.debt_musd; G.saveCampaign(c); G.payDebt(c.debt_musd);
  return a === "none" && G.getComeback().won && G.getComeback().offer === null; })());

// ---- 18. Every ending id.
function finish(seed, tier, setup) {   // a comeback with two real flights, shaped by setup(c), then won by paying the debt
  G.resetCampaign(); NC(tier || "standard", seed); flyOne(); flyOne();
  var c = G.getCampaign(); setup && setup(c); G.saveCampaign(c);
  if (G.getComeback().offer) G.refuseBuyout();
  c = G.getCampaign(); c.treasury_musd = c.debt_musd; G.saveCampaign(c);
  G.payDebt(c.debt_musd);
  return G.getComeback();
}
var ids = {};
ids.legend = finish(41, "standard", function (c) { c.missions.forEach(function (m) { m.stars = 3; }); c.month = 20; }); var e18a = G.getComebackEnding();
check("18 legend: a win averaging 2.5 stars a flight or more", ids.legend.won && ids.legend.finished && ids.legend.ending_id === "legend" && e18a.ending_id === "legend" && e18a.won, ids.legend.ending_id);
ids.comeback = finish(42, "standard", function (c) { c.missions.forEach(function (m) { m.stars = 2; }); c.month = 20; });
check("18 comeback: a win below that, with time to spare", ids.comeback.ending_id === "comeback" && G.getComebackEnding().ending_id === "comeback");
ids.close = finish(43, "standard", function (c) { c.missions.forEach(function (m) { m.stars = 2; }); c.month = c.deadline_month - 3; });
check("18 close: a win with a tenth of the deadline or less left", ids.close.ending_id === "close" && ids.close.months_left <= 0.1 * ids.close.deadline_month && G.getComebackEnding().ending_id === "close", "months left " + ids.close.months_left);
var edge = finish(44, "standard", function (c) { c.missions.forEach(function (m) { m.stars = 2; }); c.month = c.deadline_month - Math.floor(CB.close_share * c.deadline_month); });
var edge2 = finish(45, "standard", function (c) { c.missions.forEach(function (m) { m.stars = 2; }); c.month = c.deadline_month - Math.floor(CB.close_share * c.deadline_month) - 1; });
check("18 the close line is a tenth of the deadline, to the month", edge.ending_id === "close" && edge2.ending_id === "comeback", edge.months_left + " and " + edge2.months_left + " months left of " + edge.deadline_month);
var edgeStars = finish(46, "standard", function (c) { c.missions[0].stars = 3; c.missions[1].stars = 2; c.month = 20; });
var edgeStars2 = finish(47, "standard", function (c) { c.missions[0].stars = 3; c.missions[1].stars = 1; c.month = 20; });
check("18 legend is 2.5 stars a flight exactly, not less", edgeStars.ending_id === "legend" && edgeStars2.ending_id === "comeback");
var both = finish(48, "standard", function (c) { c.missions.forEach(function (m) { m.stars = 3; }); c.month = c.deadline_month - 1; });
check("18 a legend that also won with no time left is still a legend", both.ending_id === "legend");
G.resetCampaign(); NC("standard", 49); flyOne(); flyOne(); G.acceptBuyout();
check("18 sold: the buyout accepted", G.getComeback().ending_id === "sold" && G.getComebackEnding().ending_id === "sold");
G.resetCampaign(); NC("standard", 50);
var c18 = G.getCampaign(); c18.month = c18.deadline_month - 2; G.saveCampaign(c18);
G.recordResult(fly(design(addContract().id, "leo", "rideshare", RAD)));
check("18 timeout: the deadline passes with debt left", G.getComeback().ending_id === "timeout" && G.getComebackEnding().ending_id === "timeout" && G.getComeback().lost_reason === "deadline");
G.resetCampaign(); NC("expert", 51);
var k18 = addContract(), d18 = design(k18.id, "leo", "rideshare", ["cloud-photocell", "solar-small", "radio-uhf", "obc-basic", "spin-stabilised", "explorer-body"]);
c18 = G.getCampaign(); c18.treasury_musd = G.getTotals(d18).cost_musd; G.saveCampaign(c18);
G.recordResult(fly(d18));
check("18 broke: no cash left to launch anything", G.getComeback().ending_id === "broke" && G.getComebackEnding().ending_id === "broke" && G.getComeback().lost_reason === "cash");
G.resetCampaign(); NC("standard", 52);
check("18 a running comeback has no ending id, in the hub or the chronicle", G.getComeback().ending_id === null && G.getComebackEnding().ending_id === null);

// ---- 19. Old saves are discarded; the 1957 campaign and standalone designs are unchanged.
G.resetCampaign(); NC("standard", 61);
var cur = JSON.parse(store.getItem("smdg-campaign"));
check("19 the save version went up for the seed and the buyout", G.CAMPAIGN.save_version >= 5 && cur.version === G.CAMPAIGN.save_version && cur.seed === 61 && cur.buyout === "none");
[["a version 4 comeback (the game before) is upgraded in place, not discarded", function (o) { o.version = 4; delete o.seed; delete o.buyout; delete o.start_debt_musd; }, true],
 ["a comeback with no seed is filled in, not refused", function (o) { delete o.seed; }, true],
 ["a comeback with no buyout is filled in, not refused", function (o) { delete o.buyout; }, true],
 ["a comeback with a buyout that is not one is ignored", function (o) { o.buyout = "maybe"; }, false],
 ["a comeback with a seed that is not a number is ignored", function (o) { o.seed = "7"; }, false]].forEach(function (t) {
  var o = JSON.parse(JSON.stringify(cur)); t[1](o); store.setItem("smdg-campaign", JSON.stringify(o));
  var G4 = load({ storage: store }), h4 = G4.getComeback();
  check("19 " + t[0], t[2] ? !!h4 && h4.debt_musd === cur.debt_musd && h4.cash_musd === cur.treasury_musd && h4.buyout === "none" && Number.isInteger(h4.seed) &&
    JSON.parse(store.getItem("smdg-campaign")).version === G4.CAMPAIGN.save_version : G4.getCampaign() === null && G4.getComeback() === null);
});
store.setItem("smdg-campaign", JSON.stringify(cur));
G.resetCampaign();
var c19 = G.newCampaign("training");
check("19 a 1957 campaign has no seed and no buyout, and still starts as before", c19.mode === "campaign" && !("seed" in c19) && !("buyout" in c19) && G.getComeback() === null &&
  c19.year === G.CAMPAIGN.start_year && c19.treasury_musd === G.getTier("training").budget_musd && !G.acceptBuyout().ok && !G.refuseBuyout().ok);
check("19 a 1957 save code round-trips", (function () { var code = G.exportSave(); G.resetCampaign(); return G.importSave(code).ok && G.getCampaign().mode === "campaign"; })());
G.resetCampaign(); NC("standard", 62);
var code19 = G.exportSave(); G.resetCampaign();
check("19 a comeback save code keeps its seed and its offer", G.importSave(code19).ok && G.getComeback().seed === 62 && G.getComeback().buyout === "none");

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
