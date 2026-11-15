// tests/campaign.js — the campaign economy (SPEC.md "Scoring", PLAN.md Phase D).
// Run from the repo root:  node tests/campaign.js
var G = require("./load")();
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

// Seeded random for the random campaigns, so this test is repeatable.
var seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

var FIRE = ["thermal-imager", "solar-small", "battery-28v", "radio-sband", "obc-basic"];   // standalone only (research-locked in a campaign)
var ERA = ["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer", "explorer-body", "spin-stabilised"];    // Explorer 1, open from the start
function campaignDesign(obj, orbit, launcher, parts) {
  var d = G.newCampaignDesign();
  G.setObjective(d, obj); G.setOrbit(d, orbit); G.setLauncher(d, launcher);
  parts.forEach(function (p) { G.addPart(d, p); });
  // Every satellite needs a body and an attitude part: add the first that fits, unless the test chose its own.
  function has(cat) { return d.parts.some(function (id) { return G.getPart(id).category === cat; }); }
  if (!has("attitude") && G.isPartAvailable("spin-stabilised", d)) G.addPart(d, "spin-stabilised");
  if (!has("structure")) {
    G.PARTS.filter(function (p) { return p.category === "structure" && G.isPartAvailable(p.id, d); })
      .sort(function (a, b) { return a.payload_kg - b.payload_kg; })
      .some(function (b) {
        G.addPart(d, b.id);
        if (!G.runChecks(d).blockers.some(function (x) { return /^body-/.test(x.id); })) return true;
        G.removePart(d, b.id); return false;
      });
  }
  return d;
}
function fly(d, choose) {
  var m = G.startMission(d); if (!m) return null;
  var s; do { s = G.stepMonth(m); if (s.event) G.chooseEvent(m, choose ? choose(s.event) : 0); } while (!m.ended);
  return m;
}

// 1. Payout curve, hand-worked (SPEC.md worked example): value 20, scale 300, 150 science each time.
//    knowledge(150) = 1 - e^-0.5 = 0.3935 -> $7.87M; then $4.77M, $2.90M, $1.76M.
var fire = G.getObjective("wildfire");
var want = [7.869, 4.773, 2.895, 1.756];
[0, 150, 300, 450].forEach(function (before, i) {
  var p = G.payoutFor({ value_musd: 20, knowledge_scale: 300 }, before, 150).payout_musd;
  check("1 payout curve mission " + (i + 1), near(p, want[i], 0.01), "$" + p + "M, want $" + want[i] + "M");
});

// 2. Diminishing returns, and a fresh topic beats a third repeat.
var p1 = G.payoutFor(fire, 0, 120).payout_musd, p2 = G.payoutFor(fire, 120, 120).payout_musd, p3 = G.payoutFor(fire, 240, 120).payout_musd;
check("2 repeats pay strictly less", p1 > p2 && p2 > p3, p1 + " > " + p2 + " > " + p3);
var fresh = G.payoutFor({ value_musd: fire.value_musd, knowledge_scale: fire.knowledge_scale }, 0, 120).payout_musd;
check("2 a fresh topic pays more than a third repeat", fresh > p3, fresh + " > " + p3);

// 3. Idempotent payout.
G.resetCampaign(); G.newCampaign("training");
var m3 = fly(campaignDesign("radiation", "leo", "juno-1", ERA));
var t0 = G.getCampaign().treasury_musd;
var r1 = G.recordResult(m3), t1 = G.getCampaign().treasury_musd;
var r2 = G.recordResult(m3), t2 = G.getCampaign().treasury_musd;
check("3 recordResult pays once", r1 === r2 && t1 === t2 && t1 !== t0, "treasury " + t0 + " -> " + t1 + " -> " + t2);

// 4. Launch deducts the cost; editing the design afterwards changes nothing.
G.resetCampaign(); G.newCampaign("training");
var d4 = campaignDesign("radiation", "leo", "juno-1", ERA);
var before4 = G.getCampaign().treasury_musd, cost4 = G.getTotals(d4).cost_musd;
var m4 = G.startMission(d4);
check("4 launch deducts the cost", near(G.getCampaign().treasury_musd, before4 - cost4, 0.001), before4 + " - " + cost4);
G.addPart(d4, "silver-zinc-battery"); G.addPart(d4, "radio-xband"); G.setLauncher(d4, "vanguard-rocket");
var s4; do { s4 = G.stepMonth(m4); if (s4.event) G.chooseEvent(m4, 0); } while (!m4.ended);
check("4 the flown design is a copy", m4.design !== d4 && m4.design.parts.length === d4.parts.length - 2 && m4.design.launcher === "juno-1");
check("4 debrief spent matches the launch", near(G.getDebrief(m4).spent_musd, cost4 + m4.extra_cost_musd, 0.001));

// 5. No soft lock over 200 random campaigns with careless players.
var softlocks = 0, flights = 0, wins = 0, timeouts = 0, bailouts = 0;
var parts = G.PARTS.map(function (p) { return p.id; });
for (var c = 0; c < 200; c++) {
  G.resetCampaign(); G.newCampaign(G.TIERS[c % G.TIERS.length].id);
  for (var guard = 0; guard < 40 && !G.getCampaign().finished; guard++) {
    var hub = G.getHubInfo();
    var topics = hub.topics.filter(function (t) { return t.available; });
    var flew = false;
    for (var tries = 0; tries < 300 && !flew; tries++) {
      var obj = topics[Math.floor(rnd() * topics.length)].id;
      var orb = G.ORBITS[Math.floor(rnd() * 3)].id, lau = G.LAUNCHERS[Math.floor(rnd() * 3)].id;
      var pick = parts.filter(function () { return rnd() < 0.35; });
      var d = campaignDesign(obj, orb, lau, pick);
      if (G.runChecks(d).blockers.length) continue;
      var m = fly(d, function (ev) { return Math.floor(rnd() * ev.choices.length); });
      var r = G.recordResult(m); flights++; flew = true;
      if (r.bailout) bailouts++;
      var after = G.getCampaign();
      if (!after.finished && after.treasury_musd < G.cheapestLaunchCost(after) - 1e-9) softlocks++;
    }
    if (!flew) {   // fall back to the cheapest known design, as a stuck player would
      var cd = campaignDesign("radiation", "leo", "vanguard-rocket", ERA);
      if (G.runChecks(cd).blockers.length) { softlocks++; break; }
      G.recordResult(fly(cd)); flights++;
    }
  }
  if (G.getCampaign().won) wins++; else if (G.getCampaign().finished) timeouts++;
}
check("5 no soft lock in 200 random campaigns", softlocks === 0,
  flights + " flights, " + wins + " wins, " + timeouts + " time-outs, " + bailouts + " bailouts");

// 7. Save codes: round trip; a wrong version is refused and the good save survives.
G.resetCampaign(); G.newCampaign("standard");
G.recordResult(fly(campaignDesign("radiation", "leo", "juno-1", ERA)));
var code = G.exportSave(), t7 = G.getCampaign().treasury_musd;
G.resetCampaign();
check("7 import restores the campaign", G.importSave(code).ok && G.getCampaign().treasury_musd === t7);
var body = JSON.parse(Buffer.from(code.split(".")[1], "base64").toString()); body.v = 99;
var txt = JSON.stringify(body), bad = "SMDG1." + Buffer.from(txt).toString("base64") + "." + G.checksum(txt);
var r7 = G.importSave(bad);
check("7 a code from another version is refused", !r7.ok && G.getCampaign().treasury_musd === t7, r7.reason);
check("7 a damaged code is refused", !G.importSave(code.slice(0, -2)).ok && !G.importSave("not a code").ok);

// 6. Research tree integrity: every id exists, nothing unlocked twice, no cycles, valid lessons and topics.
var bad6 = [], seen6 = {};
G.RESEARCH.forEach(function (r) {
  var u = r.unlocks || {};
  (u.parts || []).forEach(function (id) { if (!G.getPart(id)) bad6.push("part " + id); if (seen6[id]) bad6.push("twice " + id); seen6[id] = 1; });
  (u.launchers || []).forEach(function (id) { if (!G.getLauncher(id)) bad6.push("launcher " + id); if (seen6[id]) bad6.push("twice " + id); seen6[id] = 1; });
  (u.objectives || []).forEach(function (id) { if (!G.getObjective(id)) bad6.push("objective " + id); });
  (r.requires || []).forEach(function (q) { if (!G.researchById(q)) bad6.push("requires " + q); });
  (r.requires_lessons || []).forEach(function (l) { if (!G.LESSONS[l]) bad6.push("lesson " + l); });
  Object.keys(r.requires_knowledge || {}).forEach(function (t) { if (!G.getObjective(t)) bad6.push("topic " + t); });
  function reach(id, path) { if (path.indexOf(id) !== -1) { bad6.push("cycle " + path.concat(id).join(">")); return; }
    var x = G.researchById(id); (x && x.requires || []).forEach(function (q) { reach(q, path.concat(id)); }); }
  reach(r.id, []);
});
G.OBJECTIVES.forEach(function (o) { if (o.requires_research && !G.researchById(o.requires_research)) bad6.push("objective research " + o.requires_research); });
check("6 research tree integrity", bad6.length === 0, bad6.slice(0, 3).join("; "));

// 6b. Locks, lessons and knowledge gates work.
G.resetCampaign(); G.newCampaign("training");
var lockedDesign = campaignDesign("wildfire", "sso", "rideshare", FIRE.concat(["prop-green-small"]));
var lockIds = G.runChecks(lockedDesign).blockers.map(function (b) { return b.id; });
check("6 locked topic, parts and launcher block a campaign launch",
  lockIds.indexOf("objective-locked") !== -1 && lockIds.indexOf("part-locked") !== -1 && lockIds.indexOf("launcher-locked") !== -1, lockIds.join(","));
var cells = G.buyResearch("solar-cells");
check("6 research needs its lesson first", !cells.ok && /fall silent/.test(cells.reason), cells.reason);
var r6 = G.recordResult(fly(campaignDesign("radiation", "leo", "juno-1", ERA)));
check("6 a battery-only satellite teaches batteries_ran_out", r6.lessons_new.indexOf("batteries_ran_out") !== -1, r6.lessons_new.join(","));
G.recordResult(fly(campaignDesign("radiation", "leo", "juno-1", ERA)));   // research also costs science points: fly again
var r6b = G.buyResearch("solar-cells");
check("6 then the research can be bought", r6b.ok, r6b.reason + " sci=" + G.getCampaign().science_pts);
var tape = G.buyResearch("tape-recorder");
check("6 knowledge gate: data from earlier satellites is needed", !tape.ok && /radiation/i.test(tape.reason), tape.reason);
var hub6 = G.getHubInfo().research.filter(function (r) { return r.id === "television"; })[0];
check("6 hub explains what is missing and what a node unlocks", hub6.missing.length > 0 && hub6.unlocks_names.length > 0 && hub6.depth === 2,
  "depth " + hub6.depth + "; " + hub6.missing.join(" ") + " -> " + hub6.unlocks_names.join(", "));

// 9. Eras: two stars in an era opens the next, and the result says so.
G.resetProgress();
var e9 = G.setEra(G.newDesign("training"), "igy");
G.setObjective(e9, "radiation"); G.setOrbit(e9, "leo"); G.setLauncher(e9, "juno-1");
["cosmic-ray-counter", "silicon-cells", "minitrack-beacon", "command-timer", "explorer-body", "spin-stabilised"].forEach(function (p) { G.addPart(e9, p); });
var m9 = fly(e9, function (ev) { var j = ev.choices.findIndex(function (c) { return !c.fail_chance_now; }); return j < 0 ? 0 : j; });
var r9 = G.recordResult(m9);
check("9 a good 1958 mission opens the Nimbus era", r9.stars >= 2 && r9.era_unlocked === "nimbus" && G.getEras()[1].unlocked,
  r9.stars + " stars, era_unlocked " + r9.era_unlocked);
check("9 the 1958 solar cycle is used for a 1958 mission", m9.start_year === 1958);

// 8. Standalone missions are untouched by a saved campaign.
var d8 = G.newDesign("standard"); G.setObjective(d8, "wildfire"); G.setOrbit(d8, "sso"); G.setLauncher(d8, "rideshare");
FIRE.concat(["prop-green-small"]).forEach(function (p) { G.addPart(d8, p); });
var tBefore = G.getCampaign().treasury_musd;
var m8 = fly(d8); G.recordResult(m8);
check("8 standalone uses the tier budget", G.getTotals(d8).budget_musd === G.getTier("standard").budget_musd);
check("8 standalone does not touch the treasury", G.getCampaign().treasury_musd === tBefore);

// 10. The lab: upgrades replace their predecessor; research and upgrades cost money and science.
G.resetCampaign(); G.newCampaign("training");
var c9 = G.getCampaign();
var lab = G.getLab();
check("10 getLab lists every upgrade with its predecessor", lab.upgrades.length === G.PARTS.filter(function (p) { return p.upgrade; }).length &&
  lab.upgrades.every(function (u) { return u.of && u.of_name && u.gains.length; }));
check("10 an upgrade waits for its year", !G.buyUpgrade("scintillation-counter").ok);
c9.year = 1958; c9.science_pts = 100; G.saveCampaign(c9);
var t9 = G.getCampaign().treasury_musd, b9 = G.buyUpgrade("scintillation-counter");
check("10 then it can be bought", b9.ok, b9.reason);
var c9b = G.getCampaign();
check("10 it costs money and science", c9b.treasury_musd < t9 && c9b.science_pts === 100 - G.getPart("scintillation-counter").upgrade.cost_sci);
var d9 = G.newCampaignDesign(), av9 = G.getAvailability(d9).parts;
check("10 the successor replaces its predecessor", av9["scintillation-counter"].available && !av9["cosmic-ray-counter"].available &&
  /Replaced by/.test(av9["cosmic-ray-counter"].reason), av9["cosmic-ray-counter"].reason);
check("10 an upgrade needs its predecessor first", !G.buyUpgrade("avcs-camera").ok);
var d9s = G.setEra(G.newDesign("training"), "nimbus");
check("10 outside a campaign both stay on offer from their years",
  G.isPartAvailable("cosmic-ray-counter", d9s) && G.isPartAvailable("scintillation-counter", d9s) && !G.isPartAvailable("alouette-2-sounder", d9s));
var r9 = G.RESEARCH.filter(function (r) { return r.id === "solar-cells"; })[0];
var c9c = G.getCampaign(); c9c.lessons = ["batteries_ran_out"]; c9c.science_pts = 0; G.saveCampaign(c9c);
var rb9 = G.buyResearch("solar-cells");
check("10 research needs science points too", !rb9.ok && /science points/.test(rb9.reason), rb9.reason);
var c9d = G.getCampaign(); c9d.science_pts = r9.cost_sci; G.saveCampaign(c9d);
check("10 and spends them", G.buyResearch("solar-cells").ok && G.getCampaign().science_pts === 0);
var c9e = G.getCampaign(); c9e.tier = "expert"; G.saveCampaign(c9e);
var hidden = G.getHubInfo().research.filter(function (r) { return r.id === "topside-sounding"; })[0].missing.join(" ");
check("10 above Initial Feasibility, lesson conditions are hints", hidden.indexOf("Show in flight") === -1 && /scientists/.test(hidden), hidden);

// 11. The core loop: each topic has a data cap; a flight with nothing new earns no reward.
G.resetCampaign(); G.newCampaign("training");
var rad = G.getObjective("radiation"), cap11 = rad.knowledge_scale * G.CAMPAIGN.cap_scales;
var t11 = G.getHubInfo().topics.filter(function (t) { return t.id === "radiation"; })[0];
check("11 the hub shows data collected against the cap", t11.data_cap === cap11 && t11.data_collected === 0 && !t11.complete);
var half = G.payoutFor(rad, cap11 - 10, 50);
check("11 only data under the cap is new", half.new_data === 10 && half.topic_complete && half.payout_musd > 0);
var none = G.payoutFor(rad, cap11, 50);
check("11 nothing new pays nothing", none.new_data === 0 && none.payout_musd === 0 && none.nothing_new);
var c11 = G.getCampaign(); c11.knowledge_science.radiation = cap11; c11.research = ["solar-cells"]; G.saveCampaign(c11);
var sci11 = G.getCampaign().science_pts;
var m11 = fly(campaignDesign("radiation", "leo", "juno-1", ["cosmic-ray-counter", "silicon-cells", "mercury-battery", "minitrack-beacon", "command-timer"]));
var d11 = G.getDebrief(m11), r11 = G.recordResult(m11);
check("11 a flight on a finished topic earns no money and no science points",
  m11.science > 0 && d11.nothing_new && d11.payout_musd === 0 && r11.science_pts_earned === 0 && r11.nothing_new, "science " + m11.science + " payout " + d11.payout_musd);
check("11 and the hub marks the topic complete", G.getHubInfo().topics.filter(function (t) { return t.id === "radiation"; })[0].complete);
check("11 the grant still arrives, so the programme can fly again", r11.grant_musd > 0 && G.getCampaign().treasury_musd >= G.cheapestLaunchCost(G.getCampaign()));

// 12. The chronicle tells the player's own story.
G.resetCampaign();
check("12 no campaign, no chronicle", G.getChronicle() === null);
G.newCampaign("training");
var f12 = fly(campaignDesign("radiation", "leo", "vanguard-rocket", ["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"]));
G.recordResult(f12);
var c12 = G.getCampaign(); c12.science_pts = 50; G.saveCampaign(c12);
G.buyResearch("solar-cells");
G.recordResult(fly(campaignDesign("radiation", "leo", "vanguard-rocket", ["cosmic-ray-counter", "mercury-battery", "silicon-cells", "minitrack-beacon", "command-timer"])));
var ch12 = G.getChronicle();
check("12 the chronicle lists flights and research in year order",
  ch12.timeline.length === 3 && ch12.timeline[0].kind === "flight" && ch12.timeline.some(function (e) { return e.kind === "research"; }) &&
  ch12.timeline.every(function (e, i, a) { return i === 0 || a[i - 1].year <= e.year; }), ch12.timeline.map(function (e) { return e.year + e.kind; }).join(" "));
check("12 it names the topics flown and what history says", ch12.topics.length === 1 && ch12.topics[0].id === "radiation" && /Explorer/.test(ch12.topics[0].real_mission));
check("12 every flight has a headline and its real twin", ch12.timeline.filter(function (e) { return e.kind === "flight"; }).every(function (e) { return e.title && /real twin/.test(e.text); }));
check("12 an unfinished campaign has no epilogue yet", ch12.finished === false && ch12.epilogue === null && ch12.rating.name);
var c12b = G.getCampaign(); c12b.finished = true; c12b.won = true; c12b.knowledge_science.radiation = 450; c12b.knowledge_science.solar = 500; c12b.knowledge_science.weather = 450; c12b.knowledge_science.ionosphere = 450; G.saveCampaign(c12b);
var ch12b = G.getChronicle();
check("12 a won campaign with broad knowledge rates highest", ch12b.won && ch12b.rating.id === "architects" && /^By /.test(ch12b.epilogue), ch12b.rating.id);
var c12c = G.getCampaign(); delete c12c.log; c12c.missions.forEach(function (m) { delete m.real; delete m.flight; }); G.saveCampaign(c12c);
check("12 a save without the newer fields still works", G.getChronicle().timeline.length >= 2);

// 13. Yearly offers: customers ask for a topic (sometimes from an orbit) and pay a bonus.
G.resetCampaign(); G.newCampaign("training");
var h13 = G.getHubInfo();
check("13 a new campaign opens an offer for each open topic, up to two", h13.offers.length === 1 && h13.offers.every(function (o) {
  return G.isObjectiveAvailable(o.topic) && o.min_science > 0 && o.bonus_musd > 0 && o.bonus_sci > 0 && o.year_to > h13.year && /wants/.test(o.text); }),
  h13.offers.map(function (o) { return o.topic; }).join(","));
var c13 = G.getCampaign();
c13.offers = [
  { id: "t-any", topic: "radiation", orbit: null, min_science: 5, bonus_musd: 4, bonus_sci: 20, year_from: c13.year, year_to: c13.year + 2, client: "a test", done: false, text: "a test wants radiation data" },
  { id: "t-sso", topic: "radiation", orbit: "sso", min_science: 5, bonus_musd: 9, bonus_sci: 90, year_from: c13.year, year_to: c13.year + 2, client: "a test", done: false, text: "a test wants radiation data from a polar orbit" }
];
G.saveCampaign(c13);
var d13 = campaignDesign("radiation", "leo", "vanguard-rocket", ["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"]);
var pp13 = G.previewPayout(d13);
check("13 the Build screen's preview names the offer this flight would meet", pp13.offers.length === 1 && pp13.offers[0].met === true, JSON.stringify(pp13.offers));
var t13 = G.getCampaign().treasury_musd, sp13 = G.getCampaign().science_pts, m13 = fly(d13), cost13 = G.getTotals(d13).cost_musd;
var r13 = G.recordResult(m13), c13b = G.getCampaign();
check("13 a flight that meets an offer claims the bonus in money and science", r13.offers_claimed.length === 1 && r13.offers_claimed[0].bonus_musd === 4 &&
  near(r13.science_pts - sp13, r13.science_pts_earned + 20 + r13.archive_sci, 0.2), JSON.stringify(r13.offers_claimed));
check("13 an offer for another orbit is left open", c13b.offers.filter(function (o) { return o.id === "t-sso" && !o.done; }).length === 1);
check("13 an offer is claimed once", c13b.offers.filter(function (o) { return o.id === "t-any"; })[0].done === true);
var c13c = G.getCampaign(); c13c.offers.forEach(function (o) { o.year_to = c13c.year - 1; }); G.saveCampaign(c13c);
G.recordResult(fly(campaignDesign("radiation", "leo", "vanguard-rocket", ["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"])));
check("13 expired offers are replaced by new ones", G.getHubInfo().offers.length >= 1 && G.getHubInfo().offers.every(function (o) { return o.year_to >= G.getHubInfo().year; }));
var c13d = G.getCampaign(); delete c13d.offers; G.saveCampaign(c13d);
check("13 a save without offers still works", Array.isArray(G.getHubInfo().offers));

// 13b. Offers follow the core loop: a topic at its cap gets no offers, and a flight with no new data claims nothing.
var c13e = G.getCampaign();
c13e.knowledge_science.radiation = G.getObjective("radiation").knowledge_scale * G.CAMPAIGN.cap_scales; c13e.offers = [
  { id: "t-cap", topic: "radiation", orbit: null, min_science: 5, bonus_musd: 4, bonus_sci: 20, year_from: c13e.year, year_to: c13e.year + 2, client: "a test", done: false, text: "a test wants radiation data" }];
G.saveCampaign(c13e);
var dcap = campaignDesign("radiation", "leo", "vanguard-rocket", ["cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"]);
check("13 the preview says the offer is not met when nothing would be new", G.previewPayout(dcap).offers.every(function (o) { return o.met === false; }));
var rcap = G.recordResult(fly(dcap));
check("13 a flight with no new data claims no offer", rcap.nothing_new && rcap.offers_claimed.length === 0 && G.getCampaign().offers.some(function (o) { return o.id === "t-cap" && !o.done; }));
check("13 a topic at its cap gets no new offers", G.getHubInfo().offers.every(function (o) { return o.topic !== "radiation" || o.id === "t-cap"; }));

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
