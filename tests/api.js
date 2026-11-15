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
["cosmic-ray-counter", "silicon-cells", "minitrack-beacon", "command-timer", "explorer-body", "spin-stabilised"].forEach(function (p) { G.addPart(d, p); });
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
         "best_next_topic", "knowledge_paragraph", "closest_mission", "limiting_name", "segments"], "getDebrief");
check("getDebrief.segments has launch, space, ground and user", (db.segments || []).map(function (x) { return x.id; }).join(",") === "launch,space,ground,user");
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
["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer", "explorer-body", "spin-stabilised"].forEach(function (p) { G.addPart(cd, p); });
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
["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer", "explorer-body", "spin-stabilised"].forEach(function (p) { G.addPart(hd, p); });
var hb = G.getHints("build", hd);
has(hb, ["mode", "tutorial", "tips"], "getHints");
check("getHints leads with the design's own problem", /Sputnik|batter/i.test(hb.tips[0] || ""), hb.tips[0]);
check("getHints is silent when the tier says off", G.getHints("build", G.newDesign("expert")).tips.length === 0);
// Every check id the game can raise has a hint.
var ids = {}, src = fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8"), mm, re2 = /(?:block|warn)\("([a-z-]+)/g;
while ((mm = re2.exec(src))) ids[mm[1].replace(/-$/, "")] = true;
var noHint = Object.keys(ids).filter(function (k) { return !G.HINTS.checks[k]; });
check("every readiness check has a hint", noHint.length === 0, noHint.join(", "));

// ---- categories, development time, pointing
var cats = G.getCategories();
check("getCategories lists all seven in order", cats.map(function (c) { return c.id; }).join(",") === "structure,instrument,power,comms,computer,attitude,propulsion");
has(cats[0], ["id", "name", "sub", "required"], "getCategories[]");
check("every part's category is listed", G.PARTS.every(function (p) { return cats.some(function (c) { return c.id === p.category; }); }));
check("every part has build_months", G.PARTS.every(function (p) { return typeof p.build_months === "number"; }));
var td = G.newDesign("training"); G.setObjective(td, "weather"); G.setOrbit(td, "leo"); G.setLauncher(td, "thor-able");
["vidicon-camera", "silicon-cells", "nicad-battery", "vhf-telemetry", "command-timer"].forEach(function (p) { G.addPart(td, p); });
check("dev_months = longest build + 1 per 3 parts", G.getTotals(td).dev_months === 6 + 2, String(G.getTotals(td).dev_months));
G.addPart(td, "drum-body");
G.addPart(td, "reaction-wheels"); var wheels = G.previewScience(td).total;
G.removePart(td, "reaction-wheels"); G.addPart(td, "spin-stabilised"); var spun = G.previewScience(td).total;
check("spin smears the camera (60%), wheels do not", wheels > 0 && Math.abs(spun - 0.6 * wheels) < 0.2, "wheels " + wheels + " / spin " + spun);

// ---- switch-over: once structure and attitude are required
var G2 = require("./load")({ newCategoriesRequired: true });
var sd = G2.newDesign("training"); G2.setObjective(sd, "radiation"); G2.setOrbit(sd, "leo"); G2.setLauncher(sd, "juno-1");
["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"].forEach(function (p) { G2.addPart(sd, p); });
var ids2 = G2.runChecks(sd).blockers.map(function (b) { return b.id; });
check("switch-over: structure and attitude become required", ids2.indexOf("empty-structure") !== -1 && ids2.indexOf("empty-attitude") !== -1, ids2.join(","));
G2.addPart(sd, "explorer-body"); G2.addPart(sd, "spin-stabilised");
check("switch-over: an Explorer 1 design launches with a body and spin", G2.runChecks(sd).blockers.length === 0);
G2.resetCampaign(); G2.newCampaign("training");
check("switch-over: rescue search still finds a design", isFinite(G2.cheapestLaunchCost(G2.getCampaign())), String(G2.cheapestLaunchCost(G2.getCampaign())));

// ---- eras, bodies, research tree
var eras = G.getEras();
check("getEras lists four eras, first open", eras.length === 4 && eras[0].unlocked && !eras[1].unlocked, eras.map(function (e) { return e.id + (e.unlocked ? "+" : "-"); }).join(" "));
has(eras[0], ["id", "name", "year", "blurb", "unlocked", "best_stars", "topics", "real_missions"], "getEras[]");
check("1958 offers only radiation; 2026 offers every topic", eras[0].topics.join(",") === "radiation" && eras[3].topics.length === G.OBJECTIVES.length);
var ed = G.setEra(G.newDesign("training"), "igy");
check("setEra sets era and year", ed.era === "igy" && ed.year === 1958);
check("1958: no TV camera, no Thor-Able; Explorer parts yes",
  !G.isPartAvailable("vidicon-camera", ed) && !G.isLauncherAvailable("thor-able", ed) && G.isPartAvailable("cosmic-ray-counter", ed));
G.setObjective(ed, "weather");
check("an objective from a later era is blocked", G.runChecks(ed).blockers.some(function (b) { return b.id === "objective-locked" && /1959/.test(b.text); }));
check("a design with no era offers everything", G.isPartAvailable("sar-radar", G.newDesign("training")));
var bd = G.newDesign("training"); ["explorer-body", "sar-radar"].forEach(function (p) { G.addPart(bd, p); });
var bt = G.getTotals(bd).body;
has(bt, ["id", "name", "payload_kg", "payload_used_kg", "slots"], "getTotals.body");
var bids = G.runChecks(bd).blockers.map(function (b) { return b.id; });
check("a radar does not fit Explorer's body", bids.indexOf("body-payload") !== -1, bids.join(","));
G.addPart(bd, "drum-body");
check("two bodies are blocked", G.runChecks(bd).blockers.some(function (b) { return b.id === "body-count"; }));
var av = G.getAvailability(ed);
has(av, ["parts", "launchers", "objectives"], "getAvailability");
has(av.parts["vidicon-camera"], ["available", "year", "reason"], "getAvailability.parts[id]");
check("getAvailability explains a 1958 lock", av.parts["vidicon-camera"].available === false && av.parts["vidicon-camera"].reason === "Arrives in 1960",
  JSON.stringify(av.parts["vidicon-camera"]));
var tree = G.getResearchTree();
has(tree, ["nodes", "edges"], "getResearchTree");
has(tree.nodes[0], ["id", "name", "year", "depth", "cost_musd", "blurb", "unlocks_names", "owned", "can_buy", "missing"], "getResearchTree.nodes[]");
check("every tree edge joins two nodes", tree.edges.every(function (e) {
  return tree.nodes.some(function (n) { return n.id === e.from; }) && tree.nodes.some(function (n) { return n.id === e.to; }); }), tree.edges.length + " edges");

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
