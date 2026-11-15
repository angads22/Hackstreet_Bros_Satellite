// tests/saves.js — save codes and the saved game: a code is either refused or leaves a game that plays.
// Run from the repo root:  node tests/saves.js
// 1. Real exports (no campaign; the 1957 campaign fresh, mid-way and finished; Ajay's comeback fresh, mid-way,
//    won and lost) all import again.
// 2. Every field of every export, at every depth, is deleted, set to null and given the wrong type. Each such code
//    is refused without touching the good save, or it imports and the game still plays: the hub, the lab, the
//    research tree, the chronicle, the comeback and its ending, a flight to its debrief, and a fresh export.
// 3. A browser store that already holds a broken save (from before these checks) is ignored, not fatal.
var load = require("./load");
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
var BASIC = ["explorer-body", "spin-stabilised", "cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"];
var RAD = ["scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"];

function flyTo(G, m, choice) { var s, n = 0; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, choice || 0); } while (!s.ended && ++n < 500); return m; }
// One flight in whatever mode the save is in; returns the debrief, or null when nothing could launch.
function oneFlight(G) {
  var c = G.getCampaign(), d;
  if (c && c.mode === "comeback") {
    // A radiation contract the counter can serve, added the way tests/comeback.js adds one.
    if (!c.finished && !(c.offers || []).some(function (x) { return x.id === "t-rad" && !x.done; })) {
      c.offers = (c.offers || []).concat({ id: "t-rad", topic: "radiation", orbit: null, client: "A test client", reason: "It tests things.", min_science: 60,
                      price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: "A test contract." });
      G.saveCampaign(c);
    }
    var cb = G.getComeback(), k = cb && cb.contracts.filter(function (x) { return x.id === "t-rad"; })[0];
    d = k ? G.newComebackDesign(k.id) : null;
    if (d) { if (!d.orbit) G.setOrbit(d, "leo"); G.setObjective(d, k.topic); RAD.forEach(function (p) { G.addPart(d, p); }); G.setLauncher(d, d.orbit === "sso" ? "small" : "rideshare"); }
  } else if (c && !c.finished) {
    d = G.newCampaignDesign(); G.setObjective(d, "radiation"); G.setOrbit(d, "leo"); BASIC.forEach(function (p) { G.addPart(d, p); }); G.setLauncher(d, "juno-1");
  } else {
    d = G.newDesign("training"); G.setEra(d, "igy"); G.setObjective(d, "radiation"); G.setOrbit(d, "leo");
    BASIC.concat(["silicon-cells"]).forEach(function (p) { G.addPart(d, p); }); G.setLauncher(d, "juno-1");
  }
  var m = d ? G.startMission(d) : null;
  if (!m) return null;
  flyTo(G, m, 0); G.recordResult(m);
  return G.getDebrief(m);
}
// Everything the screens read. Throws on a crash; returns the text of the results, to look for NaN.
function smoke(G) {
  var out = [];
  G.TIERS.forEach(function (t) { out.push(G.isTierUnlocked(t.id)); });
  out.push(G.getProgress(), G.getEras(), G.getHubInfo(), G.getLab(), G.getResearchTree(), G.getChronicle(),
           G.getComeback(), G.getComebackEnding(), G.getAvailability(G.newDesign("training")));
  var c = G.getCampaign();
  if (c && c.mode === "campaign") { var r = G.getHubInfo().research[0]; if (r) G.buyResearch(r.id); }
  out.push(oneFlight(G), G.getHubInfo(), G.getComeback(), G.getChronicle(), G.getComebackEnding());
  if (!G.importSave(G.exportSave()).ok) throw new Error("its own export does not import");
  return JSON.stringify(out);
}

// ---- 1. Real exports
var exportsByName = {};
(function () {
  var G = load({ storage: load.memoryStorage() });
  oneFlight(G); exportsByName["no campaign"] = G.exportSave();

  G.newCampaign("training"); exportsByName["1957 fresh"] = G.exportSave();
  for (var i = 0; i < 3; i++) oneFlight(G);
  var lab = G.getLab().upgrades.filter(function (u) { return u.can_buy; })[0]; if (lab) G.buyUpgrade(lab.id);
  var res = G.getHubInfo().research.filter(function (r) { return r.affordable; })[0]; if (res) G.buyResearch(res.id);
  exportsByName["1957 mid-way"] = G.exportSave();
  for (var j = 0; j < 30 && !G.getCampaign().finished; j++) oneFlight(G);
  exportsByName["1957 finished"] = G.exportSave();

  G.newComeback("standard"); exportsByName["comeback fresh"] = G.exportSave();
  var pending = G.newComebackDesign(G.getComeback().contracts[0].id); if (!pending.orbit) G.setOrbit(pending, "leo");
  RAD.forEach(function (p) { G.addPart(pending, p); }); G.setLauncher(pending, "rideshare");
  var live = G.startMission(pending); exportsByName["comeback in flight"] = G.exportSave();
  flyTo(G, live, 0); G.recordResult(live);
  oneFlight(G); oneFlight(G);
  var safe = G.getComeback().safe_pay_max_musd; if (safe > 0.01) G.payDebt(round2(safe / 2));
  exportsByName["comeback mid-way"] = G.exportSave();

  // Won: enough cash to clear the debt, then PAY BACK.
  var c = G.getCampaign(); c.treasury_musd = c.debt_musd + 1; G.saveCampaign(c); G.payDebt(c.debt_musd);
  exportsByName["comeback won"] = G.exportSave();

  // Lost on time: the deadline is one month away when a flight lands.
  G.newComeback("expert"); c = G.getCampaign(); c.month = c.deadline_month - 1; G.makeOffers(c); G.saveCampaign(c); oneFlight(G);
  exportsByName["comeback lost"] = G.exportSave();
  check("1 the exports are real: the comeback was won and lost, and the 1957 campaign finished",
    JSON.parse(body(exportsByName["comeback won"])).campaign.won === true &&
    JSON.parse(body(exportsByName["comeback lost"])).campaign.finished === true &&
    JSON.parse(body(exportsByName["1957 finished"])).campaign.finished === true);
})();
function round2(x) { return Math.round(x * 100) / 100; }
function body(code) { return Buffer.from(code.split(".")[1], "base64").toString("utf8"); }
function encode(G, data) { var b = JSON.stringify(data); return "SMDG1." + G.toBase64(b) + "." + G.checksum(b); }

Object.keys(exportsByName).forEach(function (name) {
  var G = load({ storage: load.memoryStorage() }), err = null, ok;
  try { ok = G.importSave(exportsByName[name]).ok; smoke(G); } catch (e) { err = e.message; }
  check("1 " + name + ": the export imports again and plays", ok && !err, err || "");
});

// ---- 2. Every field: deleted, null, the wrong type
function paths(x, at, out) {
  out = out || [];
  if (x && typeof x === "object") {
    Object.keys(x).forEach(function (k) { var p = at.concat([Array.isArray(x) ? Number(k) : k]); out.push(p); paths(x[k], p, out); });
  }
  return out;
}
function wrongType(v) {
  if (Array.isArray(v)) return {};
  if (v === null) return 5;
  if (typeof v === "object") return [];
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return 1;
  return "yes";
}
function mutate(data, path, how) {
  var copy = JSON.parse(JSON.stringify(data)), parent = copy;
  for (var i = 0; i < path.length - 1; i++) parent = parent[path[i]];
  var key = path[path.length - 1];
  if (how === "delete") { if (Array.isArray(parent)) parent.splice(key, 1); else delete parent[key]; }
  else if (how === "null") parent[key] = null;
  else parent[key] = wrongType(parent[key]);
  return copy;
}
Object.keys(exportsByName).forEach(function (name) {
  var G = load({ storage: load.memoryStorage() });
  var good = exportsByName[name], data = JSON.parse(body(good));
  var tried = 0, refused = 0, accepted = 0, broken = [];
  paths(data, []).forEach(function (path) {
    ["delete", "null", "type"].forEach(function (how) {
      tried++;
      if (!G.importSave(good).ok) { broken.push("the good code stopped importing"); return; }
      var before = G.exportSave();
      var code = encode(G, mutate(data, path, how)), r;
      try { r = G.importSave(code); } catch (e) { broken.push(path.join(".") + " " + how + ": import threw " + e.message); return; }
      if (!r.ok) {
        refused++;
        if (G.exportSave() !== before) broken.push(path.join(".") + " " + how + ": a refused code changed the save");
        return;
      }
      accepted++;
      try {
        var text = smoke(G);
        if (/NaN|undefined/.test(text)) broken.push(path.join(".") + " " + how + ": NaN or undefined on screen");
      } catch (e) { broken.push(path.join(".") + " " + how + ": " + e.message); }
    });
  });
  check("2 " + name + ": every damaged code is refused, or the game still plays", broken.length === 0,
    tried + " codes, " + refused + " refused, " + accepted + " accepted" + (broken.length ? "; " + broken.slice(0, 4).join(" | ") : ""));
});

// The three codes from the bug report.
(function () {
  var G = load({ storage: load.memoryStorage() }), v = G.campaignVersion();
  [{ v: v, campaign: { version: v }, progress: { best_stars: { training: 3 }, best_score: {}, best_stars_by_era: {} } },
   { v: v, campaign: null, progress: { best_stars: null } },
   { v: v, campaign: null, progress: { best_stars: {} } }].forEach(function (data, i) {
    check("2 the reported code " + "abc"[i] + " is refused", !G.importSave(encode(G, data)).ok);
  });
})();

// ---- 3. A broken save already in the browser
(function () {
  var store = load.memoryStorage();
  store.setItem("smdg-progress-v1", JSON.stringify({ best_stars: null }));
  store.setItem("smdg-campaign", JSON.stringify({ version: 4 }));
  var G = load({ storage: store }), err = null;
  try { smoke(G); } catch (e) { err = e.message; }
  check("3 a broken record and a broken campaign in the browser store are ignored, and the game plays", !err && G.getCampaign() === null &&
    G.getProgress().best_stars && G.isTierUnlocked("training"), err || "");
  store.setItem("smdg-progress-v1", JSON.stringify({ best_stars: { training: 3 }, best_score: { training: 97 } }));
  var G2 = load({ storage: store });
  check("3 a record without best_stars_by_era keeps its stars", G2.getProgress().best_stars.training === 3 && G2.isTierUnlocked("standard"));
})();

// ---- 4. A flight lost to a reload or a closed tab gives its money back
(function () {
  var store = load.memoryStorage(), G = load({ storage: store });
  G.newComeback("standard");
  var c = G.getCampaign();
  c.offers = c.offers.concat({ id: "t-rad", topic: "radiation", orbit: null, client: "A test client", reason: "It tests things.", min_science: 60,
                               price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: "A test contract." });
  G.saveCampaign(c);
  var before = G.getComeback();
  // The dearest launchable design the cash allows: afterwards the cash is below the cheapest launch.
  var d = G.newComebackDesign("t-rad"); G.setOrbit(d, "leo");
  ["scintillation-counter", "oso-xray-spectrometer", "solar-small", "battery-28v", "radio-sband", "obc-radtol", "reaction-wheels", "smallsat-bus"].forEach(function (p) { G.addPart(d, p); });
  G.setLauncher(d, "rideshare");
  var m = G.startMission(d);
  var flying = G.getComeback();
  check("4 a comeback launch leaves less cash than the cheapest launch (the dead end in the bug report)",
    m && flying.cash_musd < before.cheapest_launch_musd && flying.flights === 1, "cash " + flying.cash_musd + ", cheapest " + before.cheapest_launch_musd);
  check("4 while the flight is in the air, the same page keeps it paid for", G.getComeback().cash_musd === flying.cash_musd);
  var G2 = load({ storage: store });   // the page is reloaded mid-flight
  var after = G2.getComeback();
  check("4 after a reload mid-flight, the cash and the flight count are as before the launch", after.cash_musd === before.cash_musd &&
    after.flights === 0 && after.month === before.month && after.debt_musd === before.debt_musd, "cash " + after.cash_musd + " of " + before.cash_musd);
  check("4 the contract is still open and the refunded launch is gone from the log", !!G2.newComebackDesign("t-rad") &&
    !(G2.getCampaign().log || []).some(function (e) { return e.kind === "launch"; }));
  var d2 = G2.newComebackDesign("t-rad"); G2.setOrbit(d2, "leo"); RAD.forEach(function (p) { G2.addPart(d2, p); }); G2.setLauncher(d2, "rideshare");
  var m2 = flyTo(G2, G2.startMission(d2), 0), r2 = G2.recordResult(m2);
  var G3 = load({ storage: store });
  check("4 the next flight is G-1, is recorded once, and a reload after it refunds nothing",
    r2 && G3.getComeback().missions.length === 1 && G3.getComeback().missions[0].flight === 1 && G3.getComeback().cash_musd === G2.getComeback().cash_musd &&
    G3.getComebackEnding().timeline[0].title.indexOf("G-1") === 0, G3.getComebackEnding().timeline[0].title);

  // The 1957 campaign: the same, and the chronicle counts one flight and one launch cost.
  var store2 = load.memoryStorage(), H = load({ storage: store2 });
  H.newCampaign("expert");
  var t0 = H.getCampaign().treasury_musd;
  var e = H.newCampaignDesign(); H.setObjective(e, "radiation"); H.setOrbit(e, "leo"); BASIC.forEach(function (p) { H.addPart(e, p); }); H.setLauncher(e, "juno-1");
  var cost = H.getTotals(e).cost_musd;
  H.startMission(e);
  var H2 = load({ storage: store2 });
  check("4 a 1957 campaign gets its launch money back after a reload mid-flight", H2.getCampaign().treasury_musd === t0 && H2.getCampaign().flights === 0,
    H2.getCampaign().treasury_musd + " of " + t0);
  var e2 = H2.newCampaignDesign(); H2.setObjective(e2, "radiation"); H2.setOrbit(e2, "leo"); BASIC.forEach(function (p) { H2.addPart(e2, p); }); H2.setLauncher(e2, "juno-1");
  H2.recordResult(flyTo(H2, H2.startMission(e2), 0));
  var ch = H2.getChronicle();
  check("4 the chronicle then shows flight G-1 and one launch's cost", ch.totals.flights === 1 && ch.totals.spent_musd === H2.round(cost, 1) &&
    ch.timeline.filter(function (x) { return x.kind === "flight"; })[0].text.indexOf("G-1 ") === 0, JSON.stringify(ch.totals));

  // A code exported mid-flight and imported in another page: that page cannot fly it, so the cost comes back.
  var store3 = load.memoryStorage(), K = load({ storage: store3 });
  K.newCampaign("training");
  var k0 = K.getCampaign().treasury_musd;
  var e3 = K.newCampaignDesign(); K.setObjective(e3, "radiation"); K.setOrbit(e3, "leo"); BASIC.forEach(function (p) { K.addPart(e3, p); }); K.setLauncher(e3, "juno-1");
  K.startMission(e3);
  var code = K.exportSave(), K2 = load({ storage: load.memoryStorage() });
  check("4 a code exported mid-flight imports elsewhere with the launch refunded", K2.importSave(code).ok && K2.getCampaign().treasury_musd === k0 &&
    K2.getCampaign().flights === 0);
})();

console.log(passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
