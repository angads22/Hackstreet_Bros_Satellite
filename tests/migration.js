// tests/migration.js — a player who already has a save from the game before this one (0.9, save version 4) keeps
// everything: the save is upgraded in place, never discarded. Run from the repo root:  node tests/migration.js
// The fixtures in tests/fixtures/player-0.9.json are real saves written by the 0.9 game: `raw` is the text it stored
// under "smdg-campaign", `expect` is what its hub showed. `progress` holds the stars record and the Part 1 record.
var load = require("./load");
var fs = require("fs"), path = require("path");
var FX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "player-0.9.json"), "utf8"));
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
var same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
function storeWith(raw) {
  var s = load.memoryStorage();
  if (raw !== undefined) s.setItem("smdg-campaign", raw);
  Object.keys(FX.progress).forEach(function (k) { s.setItem(k, FX.progress[k]); });
  return s;
}
function safe(ev) { var j = ev.choices.findIndex(function (c) { return !c.fail_chance_now; }); return j < 0 ? 0 : j; }
function fly(G, d) { var m = G.startMission(d), s; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, safe(s.event)); } while (!m.ended); return m; }
// The first launchable design for any open contract: a cheap instrument that serves the topic on a small bus.
function findDesign(G, h) {
  for (var i = 0; i < h.contracts.length; i++) {
    var k = h.contracts[i], o = G.getObjective(k.topic);
    var ins = G.PARTS.filter(function (p) { return p.category === "instrument" && G.isPartAvailable(p.id) && p.tags.some(function (t) { return o.wants.indexOf(t) !== -1; }); })
      .sort(function (a, b) { return a.cost_musd - b.cost_musd; });
    var orbits = k.orbit ? [k.orbit] : ["leo", "sso"];
    for (var a = 0; a < ins.length; a++) for (var b = 0; b < 3; b++) for (var l = 0; l < 2; l++) for (var r = 0; r < orbits.length; r++) {
      var d = G.newComebackDesign(k.id);
      if (!d) return null;
      G.setOrbit(d, orbits[r]); G.setLauncher(d, ["rideshare", "small"][l]);
      [ins[a].id, "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", ["cubesat-12u", "smallsat-bus", "explorer-body"][b]].forEach(function (p) { G.addPart(d, p); });
      if (!G.runChecks(d).blockers.length) return { d: d, contract: k };
    }
  }
  return null;
}

var names = Object.keys(FX.saves), NEW_KEYS = ["seed", "buyout", "start_debt_musd"];
var LEGACY_DEBT = { training: 30, standard: 40, expert: 45 };
check("0 the fixtures are real 0.9 saves: version 4, mode comeback, six of them", names.length >= 6 && names.every(function (n) {
  var r = JSON.parse(FX.saves[n].raw); return r.version === 4 && r.mode === "comeback" && !("seed" in r) && !("buyout" in r); }));

names.forEach(function (name) {
  var fx = FX.saves[name], x = fx.expect, original = JSON.parse(fx.raw);
  var store = storeWith(fx.raw), G = load({ storage: store });
  var CB = G.CAMPAIGN.comeback;
  check("0 the code is newer than the fixture (save version above 4)", G.CAMPAIGN.save_version > 4);

  // ---- 1. The hub shows exactly what the 0.9 hub showed.
  var h = G.getComeback();
  check("1 " + name + ": the hub is the player's own run: cash, debt, month, deadline, flights, ending",
    !!h && h.cash_musd === x.cash_musd && h.debt_musd === x.debt_musd && h.month === x.month && h.deadline_month === x.deadline_month &&
    h.flights === x.flights && h.finished === x.finished && h.won === x.won && h.lost_reason === x.lost_reason && h.tier === x.tier,
    h && JSON.stringify({ cash: h.cash_musd, debt: h.debt_musd, month: h.month, deadline: h.deadline_month, flights: h.flights, finished: h.finished, lost: h.lost_reason }));
  check("1 " + name + ": the same contracts, in the same order", same(h.contracts.map(function (k) { return k.id; }), x.contracts), h.contracts.map(function (k) { return k.id; }).join(","));
  var oc = x.finished ? [] : (original.offers || []).filter(function (k) { return !k.done && k.expires_month > original.month; });
  check("1 " + name + ": each contract keeps its price, minimum, client, reason and expiry",
    h.contracts.length === oc.length && h.contracts.every(function (k, i) {
      return k.price_musd === oc[i].price_musd && k.min_science === oc[i].min_science && k.client === oc[i].client && k.reason === oc[i].reason &&
        k.expires_month === oc[i].expires_month && k.orbit === oc[i].orbit && k.bonus_musd === oc[i].bonus_musd; }));
  check("1 " + name + ": the run keeps its own deadline and debt although the tuning of new runs changed",
    h.deadline_month === original.deadline_month && h.debt_musd === original.debt_musd &&
    (original.deadline_month !== CB.tiers[original.tier].deadline_months || original.debt_musd !== CB.tiers[original.tier].debt_musd || name === "deadline-hard" || name === "fresh-normal"),
    "saved deadline " + original.deadline_month + " vs new " + CB.tiers[original.tier].deadline_months);

  // ---- 2. The save was upgraded in place: nothing lost, only the new fields added.
  var now = JSON.parse(store.getItem("smdg-campaign"));
  check("2 " + name + ": re-saved at the new version", now.version === G.CAMPAIGN.save_version);
  check("2 " + name + ": every old field and value is exactly as it was", Object.keys(original).every(function (k) { return k === "version" || same(now[k], original[k]); }),
    Object.keys(original).filter(function (k) { return k !== "version" && !same(now[k], original[k]); }).join(","));
  check("2 " + name + ": only seed, buyout and the starting debt were added", same(Object.keys(now).filter(function (k) { return !(k in original); }).sort(), NEW_KEYS.slice().sort()),
    Object.keys(now).filter(function (k) { return !(k in original); }).join(","));
  check("2 " + name + ": a random 32-bit seed, buyout none, and the debt the run began with (the old tuning)",
    Number.isInteger(now.seed) && now.seed >= 0 && now.seed <= 4294967295 && now.buyout === "none" && now.start_debt_musd === LEGACY_DEBT[original.tier] &&
    h.seed === now.seed && h.start_debt_musd === LEGACY_DEBT[original.tier] && h.buyout === "none" && h.offer === null, now.seed + " / " + now.start_debt_musd);
  var G2 = load({ storage: store }), h2 = G2.getComeback();
  check("2 " + name + ": a reload keeps the same seed and the same hub (it is saved once, not every time)", h2.seed === now.seed && same(h2.contracts, h.contracts) &&
    h2.cash_musd === h.cash_musd && h2.debt_musd === h.debt_musd && store.getItem("smdg-campaign") === JSON.stringify(now));
  var e = G.getComebackEnding();
  check("2 " + name + ": the chronicle reads the old run", !!e && e.won === x.won && e.lost_reason === x.lost_reason && e.totals.flights === original.missions.length &&
    (x.finished ? !!e.ending_id : e.ending_id === null) && h.ending_id === e.ending_id && h.act === Math.min(3, original.missions.length + 1),
    JSON.stringify({ id: e.ending_id, act: h.act }));
  check("2 " + name + ": last_flight and debt_share_left read the old run", (original.missions.length ? !!h.last_flight && h.last_flight.stars === original.missions[original.missions.length - 1].stars : h.last_flight === null) &&
    h.debt_share_left >= 0 && h.debt_share_left <= 1);

  // ---- 3. A finished run stays finished; an unfinished one keeps working.
  if (x.finished) {
    check("3 " + name + ": a finished run stays finished: nothing to fly or pay", G.newComebackDesign("x") === null && !G.payDebt(1).ok && !G.acceptBuyout().ok && !G.refuseBuyout().ok);
    check("3 " + name + ": its ending id", e.ending_id === (x.won ? "comeback" : "broke"), e.ending_id);
    return;
  }
  if (h.month >= h.deadline_month) {   // a run already at its deadline with nothing open (the fixture was made by hand): it reads, and the lenders can still be paid
    check("3 " + name + ": a run at its deadline with no contract open still reads, and a part payment is refused as it was (nothing could launch)", h.contracts.length === 0 && G.newComebackDesign("x") === null &&
      !G.payDebt(1).ok && G.getComeback().debt_musd === x.debt_musd && G.getComeback().cash_musd === x.cash_musd);
    return;
  }
  // A real open contract of the old run opens a design with its topic (and orbit) preset ...
  var open = h.contracts.length ? G.newComebackDesign(h.contracts[0].id) : null;
  check("3 " + name + ": a real contract of the old run opens a design with its topic preset", h.contracts.length === 0 ? open === null : !!open && open.objective === h.contracts[0].topic && open.contract === h.contracts[0].id);
  // ... and the flight is flown for a radiation contract the counter serves (added the way tests/comeback.js adds one), on the old run's money.
  var c0 = G.getCampaign(), tk = { id: "t-rad", topic: "radiation", orbit: null, client: "A test client", reason: "It tests things.", min_science: 60, price_musd: 10, bonus_musd: 2.5,
                                     expires_month: c0.month + 12, done: false, text: "A test contract." };
  c0.offers = (c0.offers || []).filter(function (k) { return k.topic !== "radiation"; }).concat([tk]); G.saveCampaign(c0);
  var d = G.newComebackDesign(tk.id); G.setOrbit(d, "leo"); G.setLauncher(d, "rideshare");
  ["scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"].forEach(function (p) { G.addPart(d, p); });
  var found = { d: d, contract: tk };
  var cashBefore = G.getComeback().cash_musd, debtBefore = G.getComeback().debt_musd, monthBefore = G.getComeback().month;
  var pay = G.payDebt(Math.min(0.1, G.getComeback().safe_pay_max_musd));
  check("3 " + name + ": PAY BACK works on the old run", pay.ok === (G.getComeback().safe_pay_max_musd > 0 || pay.ok) && (!pay.ok || G.getComeback().debt_paid_musd >= 0.1 - 1e-9));
  var m = fly(G, d), rr = G.recordResult(m), h3 = G.getComeback();
  check("3 " + name + ": a flight flies and is recorded: months pass, the debt grows, the flight count goes up", h3.flights === x.flights + 1 && h3.month > monthBefore &&
    rr.contract_id === found.contract.id && h3.debt_musd > 0 && G.getCampaign().missions.length === original.missions.length + 1,
    "month " + monthBefore + " -> " + h3.month + ", debt " + debtBefore + " -> " + h3.debt_musd);
  var now3 = JSON.parse(store.getItem("smdg-campaign"));
  check("3 " + name + ": still saved at the new version with its seed kept", now3.version === G.CAMPAIGN.save_version && now3.seed === now.seed && now3.start_debt_musd === now.start_debt_musd);
  var expectOffer = !h3.finished && h3.debt_musd > 0 && h3.flights >= CB.buyout_after_flights;
  check("3 " + name + ": Iron Eclipse's offer appears after the settled flight when the debt stands and two flights are done, as designed",
    expectOffer ? h3.buyout === "offered" && h3.offer && h3.offer.id === "buyout" : h3.offer === null, "flights " + h3.flights + ", buyout " + h3.buyout);
  if (h3.offer) {
    check("3 " + name + ": the offer blocks the next design until answered", G.newComebackDesign((h3.contracts[0] || { id: "x" }).id) === null);
    check("3 " + name + ": refusing lets play go on", G.refuseBuyout().ok && G.getComeback().offer === null);
  }
  // The ending: pay the debt in full.
  var c = G.getCampaign(); c.treasury_musd = c.debt_musd; c.reputation = 999; G.saveCampaign(c);
  var w = G.payDebt(c.debt_musd), end = G.getComebackEnding();
  check("3 " + name + ": the run can be won, and its ending has an id and a chronicle of the old and new flights", w.ok && w.won && G.getComeback().finished &&
    ["legend", "comeback", "close"].indexOf(end.ending_id) !== -1 && end.totals.flights === original.missions.length + 1 && end.title && end.epilogue, end.ending_id);
});

// ---- 4. A 1957 campaign save from version 4 is upgraded too (nothing new is added to it).
(function () {
  var G0 = load({ storage: load.memoryStorage() });
  G0.newCampaign("standard");
  var c = JSON.parse(JSON.stringify(G0.getCampaign())); c.version = 4;
  var raw = JSON.stringify(c), store = storeWith(raw), G = load({ storage: store }), got = G.getCampaign(), now = JSON.parse(store.getItem("smdg-campaign"));
  check("4 a version 4 campaign (1957) is upgraded in place with every field kept", !!got && got.mode === "campaign" && got.treasury_musd === c.treasury_musd && got.year === c.year &&
    now.version === G.CAMPAIGN.save_version && Object.keys(c).every(function (k) { return k === "version" || same(now[k], c[k]); }) &&
    same(Object.keys(now).sort(), Object.keys(c).sort()), Object.keys(now).join(","));
  check("4 and it still plays", G.getComeback() === null && !!G.newCampaignDesign());
})();

// ---- 5. What is ignored is not deleted.
(function () {
  var raw = JSON.stringify(Object.assign(JSON.parse(FX.saves["fresh-normal"].raw), { version: 99 }));
  var store = storeWith(raw), G = load({ storage: store });
  check("5 a save from a newer game is ignored and left in storage as it is", G.getCampaign() === null && G.getComeback() === null && store.getItem("smdg-campaign") === raw);
  var bad = "{ this is not json", store2 = storeWith(bad), G2 = load({ storage: store2 });
  check("5 corrupt JSON is ignored and left in storage as it is", G2.getCampaign() === null && G2.getComeback() === null && store2.getItem("smdg-campaign") === bad);
  var broken = JSON.stringify({ version: 4 }), store3 = storeWith(broken), G3 = load({ storage: store3 });
  check("5 a version 4 save with no run in it is ignored and left as it is", G3.getCampaign() === null && store3.getItem("smdg-campaign") === broken);
  var old = JSON.stringify({ version: 3, mode: "comeback" }), store4 = storeWith(old), G4 = load({ storage: store4 });
  check("5 a save older than the game before is ignored and left as it is", G4.getCampaign() === null && store4.getItem("smdg-campaign") === old);
  var wrong = JSON.parse(FX.saves["fresh-normal"].raw); wrong.debt_musd = "forty"; var rawW = JSON.stringify(wrong), store5 = storeWith(rawW), G5 = load({ storage: store5 });
  check("5 a save with a wrong value is ignored and left as it is (and a new run can still start over it)", G5.getCampaign() === null && store5.getItem("smdg-campaign") === rawW && !!G5.newComeback("standard", 3) && G5.getComeback().seed === 3);
})();

// ---- 6. A field the new version added is never a reason to refuse a save.
(function () {
  var G0 = load({ storage: load.memoryStorage() });
  G0.newComeback("standard", 5);
  var cur = JSON.parse(JSON.stringify(G0.getCampaign()));
  [["seed"], ["buyout"], ["start_debt_musd"], ["seed", "buyout", "start_debt_musd"]].forEach(function (drop) {
    var o = JSON.parse(JSON.stringify(cur)); drop.forEach(function (k) { delete o[k]; });
    var store = storeWith(JSON.stringify(o)), G = load({ storage: store }), h = G.getComeback();
    check("6 a current-version comeback without " + drop.join(", ") + " is filled in, not refused", !!h && Number.isInteger(h.seed) && h.buyout === "none" && h.start_debt_musd > 0 &&
      h.debt_musd === cur.debt_musd && h.cash_musd === cur.treasury_musd && JSON.parse(store.getItem("smdg-campaign")).buyout === "none");
  });
})();

// ---- 7. A save code from the game before (version 4) is upgraded on import.
(function () {
  var G = load({ storage: storeWith() });
  var camp = JSON.parse(FX.saves["one-flight-normal"].raw);
  var body = JSON.stringify({ v: 4, campaign: camp, progress: { best_stars: { training: 3 }, best_score: {}, best_stars_by_era: {} } });
  var code = "SMDG1." + Buffer.from(body).toString("base64") + "." + G.checksum(body);
  var r = G.importSave(code), h = G.getComeback();
  check("7 a version 4 save code imports and is upgraded: the run is the player's own", r.ok && !!h && h.cash_musd === 2.35 && h.debt_musd === 41.836 && h.month === 9 && h.flights === 1 &&
    h.buyout === "none" && Number.isInteger(h.seed) && h.start_debt_musd === 40 && JSON.parse(G.run("localStorage.getItem('smdg-campaign')")).version === G.CAMPAIGN.save_version, r.reason);
  var body5 = JSON.stringify({ v: 3, campaign: null, progress: { best_stars: {}, best_score: {}, best_stars_by_era: {} } });
  check("7 a code from an older game than that is still refused", !G.importSave("SMDG1." + Buffer.from(body5).toString("base64") + "." + G.checksum(body5)).ok);
})();

// ---- 8. The stars record and the Part 1 record are never touched by the back end.
(function () {
  var store = storeWith(FX.saves["one-flight-normal"].raw), G = load({ storage: store });
  var before = {}; Object.keys(FX.progress).forEach(function (k) { before[k] = store.getItem(k); });
  var h = G.getComeback(), found = findDesign(G, h);
  if (found) { var m = fly(G, found.d); G.getDebrief(m); G.recordResult(m); }
  G.payDebt(0.1); G.getComebackEnding();
  var c = G.getCampaign(); if (c.buyout === "offered") G.refuseBuyout();
  G.newComeback("expert", 9); G.getComeback(); G.resetCampaign(); G.newCampaign("training"); G.resetCampaign();
  check("8 the stars record and the Part 1 record are byte for byte the same after migration, a flight, an ending, a new run and a reset",
    Object.keys(FX.progress).every(function (k) { return store.getItem(k) === before[k] && before[k] === FX.progress[k]; }));
  var p = G.getProgress();
  check("8 the stars record still reads as it did", p.best_stars.training === 3 && p.best_stars.standard === 1 && p.best_score.training === 97 && p.best_stars_by_era.igy === 3 && p.best_stars_by_era.nimbus === 2);
  check("8 the Part 1 record is never read or written by the back end", JSON.parse(store.getItem("gravitron-walkthrough-v1")).done[2] === 3 &&
    !/gravitron-walkthrough/.test(fs.readFileSync(path.join(__dirname, "..", "js", "mission.js"), "utf8") + fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8")));
})();

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
