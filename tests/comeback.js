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
  var h = G.newComeback(t.id), x = CB.tiers[t.id];
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
check("2 an unknown difficulty starts a Normal comeback", G.newComeback("nonsense").tier === "standard");
check("2 a named orbit is one a rocket reaches for less than the contract pays", (function () {
  var ok = true;
  for (var i = 0; i < 12; i++) {
    G.resetCampaign(); G.newComeback(G.TIERS[i % 3].id);
    G.getComeback().contracts.forEach(function (k) { if (k.orbit && !(G.cheapestRocketTo(k.orbit) < k.price_musd)) ok = false; });
  }
  return ok;
})());

// ---- 3. Today's parts; no research and no lab; standalone designs unaffected.
G.resetCampaign(); G.newComeback("standard");
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
G.resetCampaign(); G.newComeback("standard");
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
var c9 = G.getCampaign(); c9.treasury_musd = G.round(c9.debt_musd + 5, 3); c9.reputation = G.getComeback().reputation_goal; G.saveCampaign(c9);   // a name AND no debt wins
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
G.resetCampaign(); G.newComeback("standard");
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
G.resetCampaign(); G.newComeback("expert");
var k11 = addContract();
var d11 = design(k11.id, "leo", "rideshare", ["cloud-photocell", "solar-small", "radio-uhf", "obc-basic", "spin-stabilised", "explorer-body"]);   // the wrong instrument: no data
var c11 = G.getCampaign(); c11.treasury_musd = G.getTotals(d11).cost_musd; c11.borrowed_musd = 99; G.saveCampaign(c11);   // the lenders have lent all they will
var m11 = fly(d11), r11 = G.recordResult(m11), h11 = G.getComeback();
check("11 no bail-out: an empty treasury stays empty", m11.science === 0 && r11.bailout === false && r11.bailout_musd === 0 && r11.grant_musd === 0 &&
  h11.cash_musd <= 0, "cash " + h11.cash_musd);
check("11 cash that cannot buy any launchable design loses", h11.finished && !h11.won && h11.lost_reason === "cash" && r11.lost_reason === "cash" &&
  r11.comeback_over, "cheapest " + h11.cheapest_launch_musd);
check("11 the ending of a loss by cash", G.getComebackEnding().lost_reason === "cash" && !G.getComebackEnding().won);
G.resetCampaign(); G.newComeback("expert");
var c11b = G.getCampaign(); c11b.treasury_musd = c11b.debt_musd; G.saveCampaign(c11b);
G.recordResult(fly(design(addContract().id, "leo", "rideshare", RAD)));
check("11 no cash loss while the cash covers the debt", !G.getComeback().finished || G.getComeback().won);

// ---- 12. The save survives a reload, and an old save is discarded.
G.resetCampaign(); G.newComeback("training");
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
G.resetCampaign(); G.newComeback("standard");
var cross = design(addContract().id, "leo", "rideshare", RAD);
G.newCampaign("training");
check("13 a comeback design never flies in a 1957 campaign", G.startMission(cross) === null &&
  G.runChecks(cross).blockers.some(function (x) { return x.id === "no-comeback"; }));
var d13b = G.newCampaignDesign();
G.setObjective(d13b, "radiation"); G.setOrbit(d13b, "leo"); G.setLauncher(d13b, "juno-1");
["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer", "explorer-body", "spin-stabilised"].forEach(function (p) { G.addPart(d13b, p); });
var ok13b = G.runChecks(d13b).blockers.length === 0;
G.newComeback("standard");
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
var ALL = G.PARTS.map(function (p) { return p.id; }), locks = [], unended = 0, flights14 = 0, endings = { won: 0, deadline: 0, cash: 0, seized: 0, name: 0 };
for (var run = 0; run < 24; run++) {
  G.resetCampaign(); G.newComeback(G.TIERS[run % 3].id);
  for (var guard = 0; guard < 40 && !G.getComeback().finished; guard++) {
    var h = G.getComeback();
    if (h.debt_musd > 0 && h.cash_musd >= h.debt_musd) { G.payDebt(h.debt_musd); h = G.getComeback(); if (h.finished) break; }
    var flyable = h.contracts.filter(function (k) { var x = cheapestFor(k); return x && x.cost <= h.cash_musd; });
    if (!flyable.length && h.max_borrow_musd > 0) { G.borrow(h.max_borrow_musd); continue; }   // a player short of cash borrows
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
  if (!end14.finished) unended++; else endings[end14.won ? "won" : end14.lost_reason]++;
}
check("14 no soft lock: careless comebacks always end, and a running one can always fly a contract", locks.length === 0 && unended === 0,
  flights14 + " flights; " + JSON.stringify(endings) + (locks.length ? "; " + locks[0] : ""));
check("14 the cash-loss line agrees with a design search", (function () {
  var ok = true;
  for (var i = 0; i < 9; i++) {
    G.resetCampaign(); G.newComeback(G.TIERS[i % 3].id);
    var hh = G.getComeback(), mine = Math.min.apply(null, hh.contracts.map(function (k) { var x = cheapestFor(k); return x ? x.cost : Infinity; }));
    if (!near(hh.cheapest_launch_musd, mine, 1e-6)) ok = false;
  }
  return ok;
})());

// ---- 15. Fast enough for a browser, even before the searches are cached.
var worst15 = 0;
for (var i15 = 0; i15 < 12; i15++) {
  G.resetCampaign(); G.run("cheapestCache = {}");
  var t15 = process.hrtime.bigint(); G.newComeback(G.TIERS[i15 % 3].id); G.getComeback();
  worst15 = Math.max(worst15, Number(process.hrtime.bigint() - t15) / 1e6);
}
var t15b = process.hrtime.bigint(); for (var j15 = 0; j15 < 50; j15++) G.getComeback();
var hub15 = Number(process.hrtime.bigint() - t15b) / 1e6 / 50;
check("15 a new comeback opens in under 100 ms, and the hub refreshes in under 10 ms", worst15 < 100 && hub15 < 10,
  "new " + worst15.toFixed(1) + " ms, hub " + hub15.toFixed(2) + " ms");

// ---- 16. Loans, credit and a name (SPEC.md, "Loans, credit and a name").
G.resetCampaign(); G.newComeback("standard");
var h16 = G.getComeback(), cr16 = G.CAMPAIGN.comeback.credit;
check("16 a new comeback starts at full credit, no name and a loan cap that follows credit",
  h16.credit === cr16.start && h16.reputation === 0 && h16.reputation_goal > 0 && h16.seize_credit === cr16.seize &&
  h16.interest_per_month === h16.base_interest_per_month && h16.max_borrow_musd === G.CAMPAIGN.comeback.tiers.standard.loan_cap_musd, JSON.stringify([h16.credit, h16.max_borrow_musd]));
var bad16 = ["1", NaN, Infinity, -1, 0, null, undefined].map(function (x) { return G.borrow(x); });
check("16 borrow refuses a non-number, a negative and nothing", bad16.every(function (r) { return r.ok === false && r.borrowed_musd === 0 && r.reason; }) &&
  G.getComeback().debt_musd === h16.debt_musd && G.getComeback().cash_musd === h16.cash_musd);
check("16 borrow refuses more than the lenders allow", !G.borrow(h16.max_borrow_musd + 1).ok && /at most/.test(G.borrow(h16.max_borrow_musd + 1).reason));
var b16 = G.borrow(10), h16b = G.getComeback(), fee16 = G.round(10 * cr16.loan_fee, 3);
check("16 a loan adds the cash, adds the loan and its fee to the debt, and lowers credit",
  b16.ok && b16.borrowed_musd === 10 && b16.fee_musd === fee16 && h16b.cash_musd === G.round(h16.cash_musd + 10, 3) &&
  h16b.debt_musd === G.round(h16.debt_musd + 10 + fee16, 3) && h16b.credit === h16.credit - cr16.per_loan && h16b.borrowed_musd === 10, JSON.stringify(b16));
check("16 lower credit means dearer interest and a smaller cap",
  h16b.interest_per_month > h16.interest_per_month && h16b.interest_per_month === G.round(h16.base_interest_per_month + cr16.interest_spread * (100 - h16b.credit) / 100, 5) &&
  h16b.max_borrow_musd < G.round(G.CAMPAIGN.comeback.tiers.standard.loan_cap_musd - 10, 3), h16b.interest_per_month + " / " + h16b.max_borrow_musd);
check("16 the loan is in the log and the ending's timeline", (G.getCampaign().log || []).some(function (e) { return e.kind === "loan" && e.musd === 10 && e.fee_musd === fee16; }) &&
  G.getComebackEnding().timeline.some(function (e) { return /^Borrowed/.test(e.title); }) &&
  G.getComebackEnding().totals.interest_musd === 0, "interest " + G.getComebackEnding().totals.interest_musd);
check("16 the save with a loan exports and imports", (function () {
  var code = G.exportSave(); G.resetCampaign(); var r = G.importSave(code); return r.ok && G.getComeback().borrowed_musd === 10 && G.getComeback().credit === h16b.credit;
})());

// A flight: stars earn credit and a name; months behind cost credit; the debt grows at the dearer rate.
G.resetCampaign(); G.newComeback("standard");
var c17 = G.getCampaign(); c17.credit = 70; G.saveCampaign(c17);   // below the top, so a gain shows
var k17 = addContract(), d17 = design(k17.id, "leo", "rideshare", RAD), debt17 = c17.debt_musd, cash17 = c17.treasury_musd;
var m17 = fly(d17), r17 = G.recordResult(m17), h17 = G.getComeback(), st17 = r17.stars || 0;
var late17 = (h17.debt_musd > h17.cash_musd ? r17.months_used * cr16.per_late_month : 0);
check("16 a flight changes credit by its stars, lost satellites and months behind, and earns reputation by stars",
  r17.credit_change === G.round(st17 * cr16.per_star - (m17.ended_early ? cr16.per_lost_satellite : 0) - late17, 1) &&
  h17.reputation === G.round(st17 * cr16.reputation_per_star, 1) && r17.reputation === h17.reputation,
  JSON.stringify({ stars: st17, change: r17.credit_change, late: late17, rep: h17.reputation }));
G.resetCampaign(); G.newComeback("standard");
var c17b = G.getCampaign(); c17b.credit = 50; G.saveCampaign(c17b);
var debt17b = c17b.debt_musd, k17b = addContract(), r17b = G.recordResult(fly(design(k17b.id, "leo", "rideshare", RAD)));
check("16 a dearer rate (lower credit) grows the debt faster than the base rate",
  G.getCampaign().debt_musd > G.round(debt17b * Math.pow(1 + G.CAMPAIGN.comeback.interest_per_month, r17b.months_used), 3) - 1e-9 &&
  r17b.interest_musd > 0, "interest " + r17b.interest_musd);

// Paying: a real payment earns a little credit; a tiny one does not.
G.resetCampaign(); G.newComeback("training");
var c18 = G.getCampaign(); c18.credit = 60; c18.treasury_musd = 20; G.saveCampaign(c18);
G.payDebt(0.5); var after_small = G.getComeback().credit; G.payDebt(2); var after_real = G.getComeback().credit;
check("16 a payment under the minimum earns no credit; a real payment earns a little", after_small === 60 && after_real === 60 + cr16.per_payment, after_small + " / " + after_real);

// The lenders seize everything at the seize line.
G.resetCampaign(); G.newComeback("expert");
var k19 = addContract(), d19 = design(k19.id, "leo", "rideshare", ["cloud-photocell", "solar-small", "radio-uhf", "obc-basic", "spin-stabilised", "explorer-body"]);   // the wrong instrument: no data, no stars
var c19 = G.getCampaign(); c19.credit = cr16.seize + 0.5; c19.treasury_musd = G.getTotals(d19).cost_musd + 1; G.saveCampaign(c19);
var r19 = G.recordResult(fly(d19));
var h19 = G.getComeback(), e19 = G.getComebackEnding();
check("16 credit at the seize line loses: they take everything", h19.finished && !h19.won && h19.lost_reason === "seized" && h19.cash_musd === 0 &&
  r19.lost_reason === "seized" && e19.lost_reason === "seized" && /take everything/.test(e19.title) && e19.epilogue && !G.borrow(1).ok && !G.payDebt(1).ok,
  JSON.stringify([h19.credit, h19.cash_musd, h19.lost_reason]));
check("16 a loan that would end the game by itself is refused", (function () {
  G.resetCampaign(); G.newComeback("standard"); var c = G.getCampaign(); c.credit = cr16.seize + cr16.per_loan; G.saveCampaign(c);
  var r = G.borrow(1); return !r.ok && /take everything/.test(r.reason) && G.getComeback().max_borrow_musd === 0 && !G.getComeback().finished;
})());

// A name: paying the debt is not enough.
G.resetCampaign(); G.newComeback("training");
var c20 = G.getCampaign(); c20.treasury_musd = c20.debt_musd + 5; c20.reputation = 0; G.saveCampaign(c20);
var p20 = G.payDebt(c20.debt_musd), h20 = G.getComeback();
check("16 the debt at 0 without a name does not win: the comeback goes on", p20.ok && !p20.won && h20.debt_musd === 0 && !h20.finished && !h20.won && h20.reputation_goal > 0);
var c20b = G.getCampaign(); c20b.reputation = h20.reputation_goal; G.saveCampaign(c20b); G.recordResult(fly(design(addContract().id, "leo", "rideshare", RAD)));
check("16 debt at 0 and a name wins", G.getComeback().won && G.getComeback().finished && /name/.test(G.getComebackEnding().headline), JSON.stringify([G.getComeback().won, G.getComeback().reputation]));
G.resetCampaign(); G.newComeback("training");
var c21 = G.getCampaign(); c21.debt_musd = 0; c21.reputation = 0; c21.month = c21.deadline_month - 1; G.saveCampaign(c21);
G.recordResult(fly(design(addContract().id, "leo", "rideshare", RAD)));
var h21 = G.getComeback();
check("16 the deadline with the debt paid and no name loses: nobody knows the name", h21.finished && !h21.won && h21.lost_reason === "name" && G.getComebackEnding().title && /name/.test(G.getComebackEnding().headline),
  JSON.stringify([h21.finished, h21.lost_reason, h21.reputation]));

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
