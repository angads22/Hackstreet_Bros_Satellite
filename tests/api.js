// tests/api.js — the contract between the back end and the screens (SPEC.md,
// "Functions the front end may call"). Run from the repo root:  node tests/api.js
// 1. Every function named in that SPEC.md block must exist in the code.
// 2. Every documented return field must be present, for standalone and campaign play.
// 3. Every data global the screens may read must exist.
// If this fails, the screens would break: fix the code or the spec before merging.
var fs = require("fs"), path = require("path");
var G = require("./load")();
var passed = 0, failed = 0;
function check(name, ok, detail) { if (ok) passed++; else failed++; if (!ok || process.argv.indexOf("-v") !== -1) console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : "")); }
function has(obj, keys, label) {
  if (!obj || typeof obj !== "object") return check(label + " returns an object", false, String(obj));
  var missing = keys.filter(function (k) { return !(k in obj); });
  check(label + " has " + keys.join(", "), missing.length === 0, missing.length ? "missing " + missing.join(", ") : "");
}

// ---- 1. functions named in SPEC.md exist
var spec = fs.readFileSync(path.join(__dirname, "..", "SPEC.md"), "utf8");
var a = spec.indexOf("### Functions the front end may call"), b = spec.indexOf("## Player interaction");
var block = spec.slice(a, b);
var code = block.slice(block.indexOf("```javascript"), block.indexOf("```", block.indexOf("```javascript") + 5));
var names = [];
code.split("\n").forEach(function (line) {
  if (/^\s*\/\//.test(line)) return;
  var re = /([A-Za-z_]\w*)\(/g, m, head = line.split("//")[0];
  while ((m = re.exec(head))) names.push(m[1]);
});
check("SPEC.md lists functions", names.length >= 30, names.length + " found");
names.forEach(function (n) { check("function " + n + " exists", typeof G[n] === "function"); });

// ---- 3. data globals named in SPEC.md exist
var globals = (block.match(/data globals \(([^)]*)\)/) || ["", ""])[1].match(/`([A-Z_]+)`/g) || [];
check("SPEC.md lists data globals", globals.length >= 7, globals.join(" "));
globals.forEach(function (g) { g = g.replace(/`/g, ""); check("global " + g + " exists", G[g] !== undefined); });

// ---- 2. return shapes, standalone
var T = ["mass_kg", "power_draw_w", "power_gen_w", "cost_musd", "data_gb_day", "downlink_gb_day", "delta_v_ms",
         "margins", "data_returned_gb_day", "battery_wh", "capacity_kg", "budget_musd"];
var d = G.newDesign("training");
has(d, ["tier", "objective", "orbit", "parts", "launcher"], "newDesign");
has(G.getTotals(d), T, "getTotals (empty design)");
has(G.getOrbitFacts(d), ["period_min", "laps_per_day", "eclipse_fraction"], "getOrbitFacts (no orbit)");
G.setObjective(d, "radiation"); G.setOrbit(d, "leo"); G.setLauncher(d, "juno-1");
["cosmic-ray-counter", "silicon-cells", "minitrack-beacon", "command-timer"].forEach(function (p) { G.addPart(d, p); });
has(G.getTotals(d).margins, ["mass", "power", "budget"], "getTotals.margins");
has(G.getOrbitFacts(d), ["period_min", "laps_per_day", "eclipse_fraction", "eclipse_min", "speed_kms", "resolution_m",
                         "battery_needed_wh", "target_in_view"], "getOrbitFacts");
has(G.getPartFacts(d, "cosmic-ray-counter"), ["power_gen_w", "resolution_m", "sharp_enough", "counts", "science_per_month"], "getPartFacts");
var ps = G.previewScience(d);
has(ps, ["per_month", "months", "total", "target", "share", "data_share", "power_share", "instruments"], "previewScience");
has(ps.instruments[0], ["id", "name", "per_month", "counts", "sharp_enough"], "previewScience.instruments[]");
var pt = G.previewToggle(d, "mercury-battery");
has(pt, ["adding", "before", "after", "delta", "fixes", "causes"], "previewToggle");
has(pt.delta, ["mass_kg", "power_draw_w", "power_gen_w", "cost_musd", "data_gb_day", "data_returned_gb_day",
               "delta_v_ms", "battery_wh", "science_total"], "previewToggle.delta");
var rc = G.runChecks(d);
has(rc, ["blockers", "warnings"], "runChecks");
check("runChecks: the sample design can launch", rc.blockers.length === 0, rc.blockers.map(function (x) { return x.id; }).join(","));

var m = G.startMission(d);
has(m, ["month", "lifetime_months", "science"], "startMission");
var s, stepKeys = null, evKeys = null, outcome = null;
do {
  s = G.stepMonth(m);
  if (!stepKeys) { stepKeys = true; has(s, ["month", "science", "event", "ended", "calendar_month", "month_name", "year", "real"], "stepMonth"); }
  if (s.event) {
    if (!evKeys) { evKeys = true; has(s.event, ["id", "title", "text", "choices"], "stepMonth.event");
      has(s.event.choices[0], ["label", "fail_chance_now"], "stepMonth.event.choices[]"); }
    outcome = G.chooseEvent(m, 0);
  }
} while (!m.ended);
if (outcome) has(outcome, ["id", "title", "label", "protected", "failed_part", "ended", "ended_early"], "chooseEvent");
var db = G.getDebrief(m);
has(db, ["score", "stars", "limiting", "suggestion", "breakdown", "science", "science_target", "paragraph", "real_mission",
         "events", "ended_early", "real_world", "payout_musd", "knowledge_before", "knowledge_after", "novelty",
         "best_next_topic", "knowledge_paragraph", "closest_mission"], "getDebrief");
has(db.closest_mission, ["id", "name", "year", "agency", "blurb", "shared"], "getDebrief.closest_mission");
has(db.breakdown, ["science", "efficiency", "margins", "events", "novelty"], "getDebrief.breakdown");
var rr = G.recordResult(m);
has(rr, ["stars", "best_stars", "unlocked"], "recordResult");
has(G.getProgress(), ["best_stars", "best_score"], "getProgress");
check("isTierUnlocked returns a boolean", typeof G.isTierUnlocked("training") === "boolean");

// ---- 2. return shapes, campaign
G.resetCampaign();
has(G.newCampaign("standard"), ["tier", "year", "treasury_musd", "knowledge_science", "research", "lessons", "missions", "finished", "won"], "newCampaign");
var cd = G.newCampaignDesign();
check("newCampaignDesign marks the design", cd && cd.campaign === true);
G.setObjective(cd, "radiation"); G.setOrbit(cd, "leo"); G.setLauncher(cd, "juno-1");
["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"].forEach(function (p) { G.addPart(cd, p); });
has(G.previewPayout(cd), ["expected_payout_musd", "knowledge_before", "knowledge_after", "novelty", "cost_musd", "net_musd"], "previewPayout");
var hub = G.getHubInfo();
has(hub, ["year", "treasury_musd", "lessons", "topics", "research", "missions", "finished", "won"], "getHubInfo");
has(hub.topics[0], ["id", "name", "available", "knowledge", "science_so_far", "next_payout_estimate_musd", "locked_reason"], "getHubInfo.topics[]");
has(hub.research[0], ["id", "name", "year", "depth", "cost_musd", "blurb", "owned", "affordable", "requires_met", "missing", "unlocks_names"], "getHubInfo.research[]");
has(G.buyResearch("solar-cells"), ["ok", "reason"], "buyResearch");
["isPartAvailable", "isLauncherAvailable", "isObjectiveAvailable"].forEach(function (f) {
  check(f + " returns a boolean", typeof G[f]("sar-radar") === "boolean");
});
var cm = G.startMission(cd);
do { s = G.stepMonth(cm); if (s.event) G.chooseEvent(cm, 0); } while (!cm.ended);
has(G.recordResult(cm), ["stars", "best_stars", "unlocked", "payout_musd", "knowledge_before", "knowledge_after", "novelty",
                          "treasury_musd", "year", "bailout", "campaign_over", "won", "lessons_new"], "recordResult (campaign)");
check("exportSave returns a string", typeof G.exportSave() === "string");
has(G.importSave("not a code"), ["ok", "reason"], "importSave");

// ---- hints
var hd = G.newDesign("training"); G.setObjective(hd, "radiation"); G.setOrbit(hd, "leo");
["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"].forEach(function (p) { G.addPart(hd, p); });
var hb = G.getHints("build", hd);
has(hb, ["mode", "tutorial", "tips"], "getHints");
check("getHints leads with the design's own problem", /Sputnik|batter/i.test(hb.tips[0] || ""), hb.tips[0]);
check("getHints is silent when the tier says off", G.getHints("build", G.newDesign("expert")).tips.length === 0);
// Every check id the game can raise has a hint.
var ids = {}, src = fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8"), mm, re2 = /(?:block|warn)\("([a-z-]+)/g;
while ((mm = re2.exec(src))) ids[mm[1].replace(/-$/, "")] = true;
var noHint = Object.keys(ids).filter(function (k) { return !G.HINTS.checks[k]; });
check("every readiness check has a hint", noHint.length === 0, noHint.join(", "));

// ---- robustness: bad input never throws
var threw = [];
[["getTotals", [G.newDesign()]], ["runChecks", [G.newDesign()]], ["previewScience", [G.newDesign()]],
 ["getOrbitFacts", [G.newDesign()]], ["previewToggle", [G.newDesign(), "no-such-part"]], ["getPartFacts", [G.newDesign(), "no-such-part"]],
 ["startMission", [null]], ["stepMonth", [cm]], ["stepMonth", [null]], ["chooseEvent", [null, 0]], ["getDebrief", [null]], ["chooseEvent", [cm, 99]], ["recordResult", [null]], ["buyResearch", ["nope"]],
 ["importSave", [""]], ["newDesign", ["nonsense"]], ["getHints", ["nowhere", null]], ["getHints", ["build", null]]].forEach(function (c) {
  try { G[c[0]].apply(null, c[1]); } catch (e) { threw.push(c[0] + ": " + e.message); }
});
check("bad input never throws", threw.length === 0, threw.join("; "));

console.log(passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
