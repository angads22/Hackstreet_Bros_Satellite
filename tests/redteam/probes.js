var L = require("./lib"); var G = L.G;
function hr(t) { console.log("\n==== " + t); }
function brief(r) { return { score: r.score, stars: r.stars, sci: r.science, target: r.science_target, lim: r.limiting, early: r.ended_early,
  bd: r.breakdown, events: r.events.map(function (e) { return e.id + ":" + e.choice + (e.protected ? "(prot)" : "") + (e.failed_part ? "->" + e.failed_part : ""); }) }; }
function fakeMission(d, ev, rand) {
  return { design: d, rand: rand || G.makeRandom(1), month: 5, lifetime_months: 48, science: 0, schedule: [], pending_event: ev,
    events_seen: [], broken: [], lost_months: 0, science_mult: 1, extra_cost_musd: 0, thin_margins: false,
    lost: { data: 0, power: 0, event: 0 }, real: { fires_in_view: 0, fires_reported: 0, months_mapped: 0, dark_months_mapped: 0 },
    ended: false, ended_early: false };
}
var EV = {}; G.EVENTS.forEach(function (e) { EV[e.id] = e; });

hr("1. EVERY part on board, every tier/objective/orbit/launcher");
G.TIERS.forEach(function (t) { G.OBJECTIVES.forEach(function (o) { G.ORBITS.forEach(function (orb) { G.LAUNCHERS.forEach(function (ln) {
  var d = L.design(t.id, o.id, orb.id, ln.id, L.PART_IDS);
  var ck = G.runChecks(d);
  var line = t.id + " " + o.id + " " + orb.id + " " + ln.id + ": ";
  if (ck.blockers.length) { console.log(line + "BLOCKED " + ck.blockers.map(function (b) { return b.id; }).join(",")); return; }
  var s = L.play(d, L.SAFE), r = L.play(d, L.RISKY), b = L.bestPlay(d);
  console.log(line + "safe " + s.score + " (" + s.stars + "*) lim=" + s.limiting + " sci=" + s.science + " | risky " + r.score + " | best " + b.score + " | warns " + ck.warnings.map(function (w) { return w.id; }).join(","));
}); }); }); });
var all = L.design("training", "sea-ice", "sso", "small", L.PART_IDS);
console.log("all-parts totals", JSON.stringify(G.getTotals(all)));
console.log("all-parts preview", JSON.stringify(G.previewScience(all)));
var allr = L.play(all, L.SAFE);
console.log("all-parts debrief (training sea-ice sso small, safe):", JSON.stringify(brief(allr)));
console.log("suggestion:", allr.suggestion, "|", allr.paragraph);

hr("2. Mutating the design mid-mission (mission.design is the live object)");
var d = L.design("training", "wildfire", "leo", "small", ["optical-camera", "solar-small", "radio-uhf", "obc-basic"]);
var base = L.play(JSON.parse(JSON.stringify(d)), L.SAFE);
console.log("honest weak design:", JSON.stringify(brief(base)));
var m = G.startMission(d); G.stepMonth(m);
var extra = ["thermal-imager", "radio-xband", "battery-28v", "solar-large"];
extra.forEach(function (id) { G.addPart(d, id); });
var s, g = 0; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, 0); } while (!m.ended && ++g < 999);
extra.forEach(function (id) { G.removePart(d, id); });
console.log("added parts after launch, removed before debrief:", JSON.stringify(brief(G.getDebrief(m))));
var d2 = L.design("expert", "sea-ice", "sso", "small", ["sar-radar","solar-large","radio-xband","obc-basic","battery-28v","prop-ion"]);
var m2 = G.startMission(d2); var g2 = 0; do { s = G.stepMonth(m2); if (s.event) G.chooseEvent(m2, L.safeIdx(s.event)); } while (!m2.ended && ++g2 < 999);
var before = G.getDebrief(m2).score; G.setLauncher(d2, "rideshare"); var after = G.getDebrief(m2).score;
console.log("expert score before/after switching launcher to rideshare post-flight:", before, after);

hr("3. Protection semantics");
var d3 = L.design("training", "sea-ice", "sso", "small", ["sar-radar","solar-large","radio-xband","obc-radtol","battery-28v","prop-green-large"]);
var f = fakeMission(d3, EV["debris"]);
var o0 = G.chooseEvent(f, 0);
console.log("debris + thruster, SAFE choice 0 ->", JSON.stringify(o0), "extra cost charged:", f.extra_cost_musd);
f = fakeMission(d3, EV["debris"]); var o1 = G.chooseEvent(f, 1);
console.log("debris + thruster, RISKY choice 1 ->", JSON.stringify(o1), "extra cost:", f.extra_cost_musd);
f = fakeMission(d3, EV["solar-storm"]); var o2 = G.chooseEvent(f, 1);
console.log("solar-storm + radtol, RISKY ->", JSON.stringify(o2), "lost months:", f.lost_months);
f = fakeMission(d3, EV["software-bug"], function () { return 0; }); var o3 = G.chooseEvent(f, 0);
console.log("software-bug + radtol (rand=0), risky ->", JSON.stringify(o3), "ended", f.ended);
console.log("protects map:", JSON.stringify(G.PARTS.filter(function (p) { return p.protects.length; }).map(function (p) { return p.id + "->" + p.protects; })));
console.log("events with no protector:", G.EVENTS.filter(function (e) { return !G.PARTS.some(function (p) { return p.protects.indexOf(e.id) !== -1; }); }).map(function (e) { return e.id; }).join(", "));

hr("4. Broken solar panel / battery");
var d4 = L.design("training", "sea-ice", "sso", "small", ["sar-radar","solar-large","radio-xband","obc-basic","battery-28v","prop-ion"]);
console.log("rate intact:", G.scienceRate(d4, [], 5).per_month.toFixed(3), " panel broken:", G.scienceRate(d4, ["solar-large"], 5).per_month.toFixed(3),
  " battery broken:", G.scienceRate(d4, ["battery-28v"], 5).per_month.toFixed(3));
var f4 = fakeMission(d4, EV["stuck-hinge"], function () { return 0; });
console.log("stuck-hinge rock it, rand=0:", JSON.stringify(G.chooseEvent(f4, 0)), "ended:", f4.ended, "broken", f4.broken);
var d4b = L.design("training", "sea-ice", "sso", "small", ["sar-radar","solar-large","solar-small","radio-xband","obc-basic","battery-28v","prop-ion"]);
console.log("two panels draw/gen:", G.getTotals(d4b).power_draw_w, G.getTotals(d4b).power_gen_w, "rate w/ large broken", G.scienceRate(d4b, ["solar-large"], 5).per_month.toFixed(3), "(draw 285 W > small panel 183 W, but no penalty)");

hr("5. Spare parts and dead fields");
var d5 = L.design("training", "sea-ice", "sso", "small", ["sar-radar","solar-large","radio-xband","obc-basic","obc-radtol","battery-28v","prop-ion"]);
console.log("rate with obc-basic broken (spare radtol):", G.scienceRate(d5, ["obc-basic"], 5).per_month.toFixed(3), "vs intact", G.scienceRate(d5, [], 5).per_month.toFixed(3));
var src = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "js") + "/game.js", "utf8") + require("fs").readFileSync(require("path").join(__dirname, "..", "..", "js") + "/mission.js", "utf8");
console.log("storage_gb referenced in logic?", /storage_gb/.test(src));

hr("6. Seed rerolling with a 0.1 kg $0.01M UHF radio");
var core = ["sar-radar","solar-large","radio-xband","obc-basic","battery-28v","prop-ion"];
[core, core.concat(["radio-uhf"]), core.concat(["radio-sband"]), core.concat(["radio-uhf","radio-sband"]), core.concat(["obc-radtol"])].forEach(function (ps) {
  var dd = L.design("expert", "sea-ice", "sso", "small", ps);
  var mm = G.startMission(dd);
  var r = L.play(dd, L.RISKY);
  console.log((ps.slice(6).join("+") || "(core)") + " events: " + mm.schedule.map(function (x) { return "m" + x.month + ":" + x.event.id; }).join(", ") + " | all-risky " + r.score + " " + JSON.stringify(brief(r).events));
});

hr("7. Invalid inputs via the public API");
var d7 = G.newDesign("nonsense"); G.setObjective(d7, "wildfire"); G.setOrbit(d7, "geo"); G.setLauncher(d7, "heavy");
["thermal-imager","optical-camera","solar-large","solar-small","battery-28v","radio-xband","obc-basic","prop-ion"].forEach(function (id) { G.addPart(d7, id); });
console.log("unknown tier -> blockers:", JSON.stringify(G.runChecks(d7).blockers), "budget margin:", G.getTotals(d7).margins.budget);
var m7x = G.startMission(d7); console.log("unknown tier -> events scheduled:", m7x.schedule.length);
console.log("isTierUnlocked('nonsense'):", G.isTierUnlocked("nonsense"));
var d7b = G.newDesign("training"); G.setOrbit(d7b, "mars"); console.log("unknown orbit blockers:", G.runChecks(d7b).blockers.map(function (b) { return b.id; }).join(","));
var d7c = L.design("training", "sea-ice", "sso", "small", core);
var m7 = G.startMission(d7c); var ev;
do { ev = G.stepMonth(m7); } while (!ev.event && !ev.ended);
console.log("chooseEvent index 7 ->", JSON.stringify(G.chooseEvent(m7, 7)));
console.log("chooseEvent with no pending event ->", G.chooseEvent(m7, 0));
var steps = 0; while (!m7.ended && steps < 999) { G.stepMonth(m7); steps++; }
console.log("stepMonth after end ->", JSON.stringify(G.stepMonth(m7)));
var emp = G.newDesign("training"); var me = G.startMission(emp); var q = 0; do { var st = G.stepMonth(me); if (st.event) G.chooseEvent(me, 0); } while (!me.ended && ++q < 999);
var de = G.getDebrief(me); console.log("startMission on an EMPTY design (no orbit/parts): months", me.month, "score", de.score, "stars", de.stars, "lim", de.limiting);
console.log("previewToggle unknown ->", G.previewToggle(G.newDesign(), "nope"), " getPartFacts unknown ->", G.getPartFacts(G.newDesign(), "nope"));
var dd8 = G.newDesign("training"); dd8.parts.push("sar-radar", "sar-radar"); console.log("duplicate pushed directly -> mass", G.getTotals(dd8).mass_kg);

hr("8. recordResult on an unfinished mission");
G.resetProgress();
var d8 = L.design("training", "sea-ice", "sso", "small", core);
var m8 = G.startMission(d8);
for (var k = 0; k < 30; k++) { var st8 = G.stepMonth(m8); if (st8.event) G.chooseEvent(m8, 0); }
console.log("month", m8.month, "of", m8.lifetime_months, "ended?", m8.ended, "-> recordResult", JSON.stringify(G.recordResult(m8)), "standard unlocked:", G.isTierUnlocked("standard"));
G.resetProgress();

hr("9. Choices are free once science is over target");
var d9 = L.design("training", "sea-ice", "sso", "small", core);
console.log("preview", G.previewScience(d9).total, "of", G.previewScience(d9).target);
var mm9 = G.startMission(d9); mm9.schedule = [{ month: 3, event: EV["ground-outage"] }, { month: 4, event: EV["contamination"] }, { month: 5, event: EV["budget-cut"] }, { month: 6, event: EV["stuck-hinge"] }, { month: 7, event: EV["solar-storm"] }, { month: 8, event: EV["software-bug"] }];
var pick = { "ground-outage": 1, "contamination": 1, "budget-cut": 0, "stuck-hinge": 1, "solar-storm": 0, "software-bug": 1 };
var q9 = 0, st9; do { st9 = G.stepMonth(mm9); if (st9.event) G.chooseEvent(mm9, pick[st9.event.id]); } while (!mm9.ended && ++q9 < 999);
console.log("took every science-losing option in 6 events:", JSON.stringify(brief(G.getDebrief(mm9))));

hr("11. Real-world text sanity");
var d11 = L.design("training", "wildfire", "leo", "small", ["optical-camera","solar-small","radio-xband","obc-basic","battery-28v"]);
var r11 = L.play(d11, L.SAFE); console.log("camera-only wildfire LEO:", r11.score, r11.science, "|", r11.real_world.text);
var d11b = L.design("training", "wildfire", "leo", "small", ["thermal-imager","solar-small","radio-xband","obc-basic","battery-28v"]);
var r11b = L.play(d11b, L.SAFE); console.log("thermal-only wildfire LEO:", r11b.score, r11b.science, "|", r11b.real_world.text);
var d11c = L.design("training", "sea-ice", "leo", "small", ["sar-radar","solar-large","radio-xband","radio-sband","obc-basic","battery-28v"]);
var r11c = L.play(d11c, L.SAFE); console.log("radar sea-ice LEO:", r11c.score, r11c.science, r11c.limiting, "|", r11c.real_world.text);
var d11d = L.design("training", "sea-ice", "geo", "heavy", ["sar-radar","solar-large","radio-xband","obc-basic","battery-28v","prop-ion"]);
var r11d = L.play(d11d, L.SAFE); console.log("radar sea-ice GEO (fit 0):", r11d.score, r11d.science, r11d.limiting, "|", r11d.suggestion, "|", r11d.real_world.text);
var d11e = L.design("training", "wildfire", "sso", "small", ["sar-radar","solar-large","radio-xband","obc-basic","battery-28v","prop-ion"]);
var r11e = L.play(d11e, L.SAFE); console.log("radar on wildfire:", r11e.score, r11e.science, r11e.limiting, "|", r11e.real_world.text);

hr("12. Propulsion numbers");
G.ORBITS.forEach(function (orb) {
  ["prop-green-small", "prop-green-large", "prop-ion"].forEach(function (p) {
    [30, 60, 90].forEach(function (dry) {
      // pad mass with a fake: compute with formula directly
      var part = G.getPart(p); var mfull = dry + part.mass_kg;
      console.log(orb.id, p, "spacecraft", mfull.toFixed(1), "kg -> dv", Math.round(G.rocketDeltaV(part.isp_s, mfull, part.fuel_kg)), "need", orb.dv_needed_ms);
    });
  });
});
