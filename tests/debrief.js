// tests/debrief.js — how a mission ends and what the debrief tells the player to try next.
// Run from the repo root:  node tests/debrief.js
// 1. A battery-only satellite flies until its battery is spent; an event ends a mission only when it breaks a part.
// 2. The knowledge paragraph: "first real look" only on a topic's first flight; none in a comeback.
// 3. TRY THIS: always something the player can do with what the design has (Part 1, other eras, Part 2).
// 4. Event text names no hardware the satellite may not carry.
// 5. The readiness review points an orbit no rocket reaches (or no thruster can hold) back to the orbit.
// 6. The solar topic in 2026, after the sunspot record ends: the latest full year, never a made-up 0.
// 7. An instrument card's science figure is what it delivers on this satellite, after the radio's and the power's losses.
var load = require("./load");
var G = load();
var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  (" + detail + ")" : ""));
}
// A standalone design set in an era (Part 1 is the "igy" era on the training tier).
function eraDesign(era, tier, objective, orbit, launcher, parts) {
  var d = G.newDesign(tier); G.setEra(d, era); G.setObjective(d, objective); G.setOrbit(d, orbit);
  parts.forEach(function (p) { G.addPart(d, p); }); G.setLauncher(d, launcher);
  return d;
}
// Flies a mission to the end; `choose(event, index)` picks each event's choice (a number: always that choice).
function fly(d, choose) {
  var m = G.startMission(d), s, n = 0, i = 0;
  if (!m) return null;
  do {
    s = G.stepMonth(m);
    if (s.event) G.chooseEvent(m, typeof choose === "function" ? choose(s.event, i++) : Math.min(choose || 0, s.event.choices.length - 1));
  } while (!s.ended && ++n < 500);
  return m;
}

// ---- 1. Battery-only satellites, and what ends a mission early
// Silver-zinc batteries on the TIROS drum last 11 months: long enough for events. Choices with no effect must change nothing.
var bo = eraDesign("nimbus", "training", "radiation", "leo", "thor-able",
  ["drum-body", "spin-stabilised", "cosmic-ray-counter", "silver-zinc-battery", "minitrack-beacon", "command-timer"]);
var boLife = G.batteryLifeMonths(bo);
[0, 1].forEach(function (choice) {
  var m = fly(bo, choice);
  var broke = m.events_seen.some(function (e) { return e.failed_part; });
  check("1 battery-only, choice " + choice + ": it flies until the battery is spent unless an event breaks a part",
    m.events_seen.length > 0 && (broke ? m.ended_early : !m.ended_early && m.month === m.lifetime_months && m.end_cause === "batteries"),
    "month " + m.month + " of " + m.lifetime_months + ", events " + m.events_seen.map(function (e) { return e.label + (e.failed_part ? " (" + e.failed_part + " failed)" : ""); }).join("; "));
});
// Every battery-only 1958-1964 design that lives long enough for events: no event without a broken part ends it.
var bad1 = [];
["igy", "nimbus"].forEach(function (era) {
  ["training", "standard", "expert"].forEach(function (tier) {
    ["drum-body", "explorer-body"].forEach(function (body) {
      ["mercury-battery", "silver-zinc-battery", "nicad-battery"].forEach(function (bat) {
        ["cosmic-ray-counter", "scintillation-counter"].forEach(function (ins) {
          var d = eraDesign(era, tier, "radiation", "leo", "thor-able", [body, "spin-stabilised", ins, bat, "minitrack-beacon", "command-timer"]);
          if (G.runChecks(d).blockers.length) return;
          [0, 1, 2].forEach(function (choice) {
            var m = fly(d, choice);
            if (m.ended_early && !m.events_seen.some(function (e) { return e.failed_part; })) bad1.push(era + "/" + tier + "/" + body + "/" + bat + "/" + ins + " choice " + choice);
          });
        });
      });
    });
  });
});
check("1 a battery-only satellite is never ended by an event that broke nothing", bad1.length === 0, bad1.slice(0, 3).join("; "));
// A satellite that launched with solar cells still ends when its last cells fail: a battery alone cannot keep it alive.
// The stuck-hinge event is forced at month 2 and its risky choice always fails, so the cells (listed first) break.
function forced(d, eventId, month) {
  var m = G.startMission(d);
  m.schedule = [{ month: month, event: G.EVENTS.filter(function (e) { return e.id === eventId; })[0] }];
  m.rand = function () { return 0; };
  return m;
}
function finish(m, choice) { var st; do { st = G.stepMonth(m); if (st.event) G.chooseEvent(m, choice); } while (!st.ended); return m; }
var cellsDead = finish(forced(eraDesign("igy", "training", "radiation", "leo", "vanguard-rocket",
  ["explorer-body", "spin-stabilised", "scintillation-counter", "silicon-cells", "mercury-battery", "minitrack-beacon", "command-timer"]), "stuck-hinge", 2), 0);
check("1 a satellite whose only solar cells fail ends early, and the end names the part",
  cellsDead.ended_early && cellsDead.end_reason.category === "power" && cellsDead.end_reason.part === "silicon-cells" &&
  cellsDead.broken.indexOf("mercury-battery") === -1, JSON.stringify(cellsDead.end_reason));
// The same event on a battery-only satellite: the battery fails, so the satellite falls silent at once.
var batDead = finish(forced(eraDesign("nimbus", "training", "radiation", "leo", "thor-able",
  ["drum-body", "spin-stabilised", "cosmic-ray-counter", "silver-zinc-battery", "minitrack-beacon", "command-timer"]), "stuck-hinge", 2), 0);
check("1 a battery-only satellite whose battery fails ends early", batDead.ended_early && batDead.end_reason.part === "silver-zinc-battery",
  JSON.stringify(batDead.end_reason));
var batSafe = finish(forced(eraDesign("nimbus", "training", "radiation", "leo", "thor-able",
  ["drum-body", "spin-stabilised", "cosmic-ray-counter", "silver-zinc-battery", "minitrack-beacon", "command-timer"]), "stuck-hinge", 2), 1);
check("1 the safe choice keeps it flying to the end of its battery", !batSafe.ended_early && batSafe.month === batSafe.lifetime_months,
  "month " + batSafe.month + " of " + batSafe.lifetime_months);

// ---- 2. The knowledge paragraph: "first real look" only on the first flight of a topic
(function () {
  var C = load({ storage: load.memoryStorage() });
  C.newCampaign("training");
  var BASIC = ["explorer-body", "spin-stabilised", "cosmic-ray-counter", "mercury-battery", "minitrack-beacon", "command-timer"];
  var texts = [];
  for (var i = 0; i < 3; i++) {
    var d = C.newCampaignDesign(); C.setObjective(d, "radiation"); C.setOrbit(d, "leo");
    BASIC.forEach(function (p) { C.addPart(d, p); }); C.setLauncher(d, "juno-1");
    var m = C.startMission(d), st;
    do { st = C.stepMonth(m); if (st.event) C.chooseEvent(m, 0); } while (!st.ended);
    C.recordResult(m);
    var db = C.getDebrief(m), saved = C.getCampaign().missions[i];
    texts.push({ before: db.knowledge_before, kp: db.knowledge_paragraph, first: saved.first_look });
  }
  check("2 the first flight of a topic is its first real look", texts[0].kp === C.DEBRIEF.breakthrough && texts[0].first, JSON.stringify(texts[0]));
  check("2 the second and third flights are not called a first look", texts.slice(1).every(function (t) { return t.kp !== C.DEBRIEF.breakthrough && !t.first; }),
    JSON.stringify(texts.slice(1)));
  check("2 the first-look paragraph makes no claim about the payout's size", !/large/.test(C.DEBRIEF.breakthrough));
})();
// A comeback client pays by the contract, not by the knowledge curve: neither paragraph applies there.
var CB = load({ storage: load.memoryStorage() });
CB.newComeback("standard");
// A test contract, added to the open ones the way tests/comeback.js does.
function cbContract(fields) {
  var c = CB.getCampaign();
  var k = Object.assign({ id: "t-rad", topic: "radiation", orbit: null, client: "A test client", reason: "It tests things.",
                          min_science: 60, price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: "A test contract." }, fields || {});
  c.offers = (c.offers || []).filter(function (x) { return x.id !== k.id; }).concat([k]);
  CB.saveCampaign(c);
  return k;
}
function cbDesign(k, orbit, launcher, parts) {
  var d = CB.newComebackDesign(k.id); CB.setOrbit(d, orbit); CB.setLauncher(d, launcher);
  parts.forEach(function (p) { CB.addPart(d, p); });
  return d;
}
var RAD = ["scintillation-counter", "solar-small", "mercury-battery", "radio-uhf", "command-timer", "spin-stabilised", "cubesat-12u"];
(function () {
  var m = CB.startMission(cbDesign(cbContract(), "leo", "rideshare", RAD)), st;
  do { st = CB.stepMonth(m); if (st.event) CB.chooseEvent(m, 0); } while (!st.ended);
  CB.recordResult(m);
  var db = CB.getDebrief(m);
  check("2 a comeback flight gets no first-look or saturated paragraph", db.knowledge_before === 0 && db.knowledge_paragraph === "", JSON.stringify(db.knowledge_paragraph));
})();

// ---- 3. TRY THIS is always something the player can do with what this design has
// The change the advice asks for (limitingFactor's `change`) is applied to the flown design, and the result must clear
// every blocker the change itself could cause (locks for the era or the research, the body, the rocket, power, thrust)
// on the money this flight had at launch. The text is checked too.
var IGNORE = ["budget", "no-contract", "contract-topic", "contract-orbit", "comeback-over", "no-comeback", "too-late"];
function adviceOf(g, m) {
  var t = m.launch_totals, o = g.getObjective(m.design.objective);
  return g.limitingFactor(m, t, Math.min(1, m.science / (o ? o.science_target : 100)));
}
function adviceProblems(g, m, lim, label) {
  var out = [], d = m.design, ch = lim.change, text = lim.suggestion;
  if (/\bThe (a|an|the) /i.test(text)) out.push("article: " + text);
  if (/\d\.\d{4,}/.test(text)) out.push("raw number: " + text);
  if (/next tier/i.test(text) && (d.year || d.campaign)) out.push("next tier: " + text);
  if (/research/i.test(text) && !(d.campaign && !d.comeback)) out.push("research outside the 1957 campaign: " + text);
  if (/undefined|NaN|null/.test(text)) out.push("broken text: " + text);
  d.parts.forEach(function (id) {   // never ask for a part already on board (tests/balance.js has the same rule)
    var n = g.getPart(id).name.toLowerCase(), t = text.toLowerCase();
    if (/(add|fit|fly) the /i.test(text) && t.indexOf("the " + n) !== -1 && t.indexOf("your " + n) === -1) out.push("fitted part asked for: " + text);
  });
  if (!ch) return out.map(function (x) { return label + ": " + x; });
  if (ch.launcher && d.year && !d.campaign) out.push("a standalone (Part 1) flight told to change its rocket: " + text);
  if (ch.orbit && m.contract && m.contract.orbit) out.push("a contract's orbit suggested away: " + text);
  var v = g.variantOf(d, ch), blockers = g.runChecks(v).blockers.filter(function (b) { return IGNORE.indexOf(b.id) === -1; });
  if (blockers.length) out.push("the change cannot launch (" + blockers.map(function (b) { return b.id; }).join(",") + "): " + text);
  var budget = m.launch_totals.budget_musd;
  if (budget !== null && g.getTotals(v).cost_musd > budget + 1e-9) out.push("the change costs more than this flight had: " + text);
  var av = g.getAvailability(v);
  (ch.add || []).forEach(function (id) { if (!av.parts[id].available) out.push(id + " is not available: " + text); });
  if (ch.part && text.toLowerCase().indexOf(g.getPart(ch.part).name.toLowerCase()) === -1) out.push("the text does not name " + ch.part + ": " + text);
  if (ch.orbit && text.toLowerCase().indexOf(g.getOrbit(ch.orbit).name.toLowerCase()) === -1) out.push("the text does not name the orbit: " + text);
  if (ch.thruster && text.toLowerCase().indexOf(g.getPart(ch.thruster).name.toLowerCase()) === -1) out.push("the text does not name the thruster: " + text);
  return out.map(function (x) { return label + ": " + x; });
}
// Every string the back end returns for a flight (getDebrief, and recordResult's result when given): readable
// sentences and numbers. No doubled article ("The a hurricane"), no raw number ("0.000025 of 0.00004 GB"), no
// proper noun lower-cased ("arctic sea-ice", "sun-synchronous"), no "0%" beside an amount that is not 0.
function textProblems(obj, label) {
  var out = [];
  (function walk(v, at) {
    if (typeof v === "string") {
      if (/\b(?:the|a|an) (?:a|an|the)\b/i.test(v)) out.push(at + " article: " + v);
      if (/\d\.\d{4,}|\b0\.0\d{3,}/.test(v)) out.push(at + " raw number: " + v);
      if (/\b(?:arctic|sun-synchronous)\b/.test(v)) out.push(at + " lower-cased name: " + v);
      if (/\b0\.0*[1-9][\d.]* ?[kMGT]?B\b[^.]*\(0%\)|\b[1-9][\d.]* ?[kMGT]?B\b[^.]*\(0%\)/.test(v)) out.push(at + " 0% of something: " + v);
      if (/undefined|NaN|\bnull\b|Infinity/.test(v)) out.push(at + " broken text: " + v);
    } else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { walk(v[k], at + "." + k); });
  })(obj, "");
  return out.map(function (x) { return label + ": " + x; });
}
// Part 1: every launchable 1958 design, on each rocket, under each event choice; steps 1 and 2 preset the rocket.
(function () {
  var base = G.newDesign("training"); G.setEra(base, "igy");
  var av = G.getAvailability(base);
  var parts = Object.keys(av.parts).filter(function (k) { return av.parts[k].available; });
  var rockets = Object.keys(av.launchers).filter(function (k) { return av.launchers[k].available; });
  var problems = [], flights = 0, kinds = {};
  for (var mask = 1; mask < (1 << parts.length); mask++) {
    var ps = parts.filter(function (p, i) { return mask & (1 << i); });
    G.ORBITS.forEach(function (orb) { rockets.forEach(function (l) {
      var d = eraDesign("igy", "training", "radiation", orb.id, l, ps);
      if (G.runChecks(d).blockers.length) return;
      [0, 1, 2].forEach(function (choice) {
        var m = fly(d, choice), lim = adviceOf(G, m);
        flights++; kinds[lim.key] = (kinds[lim.key] || 0) + 1;
        problems = problems.concat(adviceProblems(G, m, lim, ps.join("+") + " " + l + " choice " + choice),
                                   textProblems(G.getDebrief(m), ps.join("+") + " " + l + " choice " + choice));
        if (lim.suggestion !== G.getDebrief(m).suggestion) problems.push("getDebrief and limitingFactor disagree");
      });
    }); });
  }
  check("3 Part 1: TRY THIS on every launchable 1958 flight can be done in 1958, with the rocket it flew", problems.length === 0 && flights >= 90,
    flights + " flights, limited by " + JSON.stringify(kinds) + (problems.length ? "; " + problems.length + " problems: " + problems.slice(0, 3).join(" | ") : ""));
})();
// The bug reports' flights: no 1990 radio, no 1965 computer, no 51 kg battery in a 10 kg body.
(function () {
  var a = fly(eraDesign("igy", "training", "radiation", "leo", "vanguard-rocket",
    ["explorer-body", "spin-stabilised", "scintillation-counter", "silicon-cells", "minitrack-beacon", "command-timer"]), 1);
  var la = adviceOf(G, a);
  check("3 the data advice in 1958 names a change that exists in 1958 and readable units", !/X-band|0\.0000/.test(la.suggestion) && /kB/.test(la.suggestion) &&
    adviceProblems(G, a, la, "").length === 0, la.suggestion);
  var b = fly(eraDesign("igy", "training", "radiation", "leo", "vanguard-rocket",
    ["explorer-body", "spin-stabilised", "cosmic-ray-counter", "silicon-cells", "minitrack-beacon", "command-timer"]), 0);
  var lb = adviceOf(G, b);
  check("3 the eclipse advice fits the Explorer body and the 1958 rocket", lb.key === "power" && !/silver-zinc/.test(lb.suggestion) &&
    lb.change && adviceProblems(G, b, lb, "").length === 0, lb.suggestion);
})();
// The bug report's flights (flight-06): an event that ends the mission is named as written, and data in readable units.
(function () {
  var hur = fly(eraDesign("nimbus", "expert", "weather", "leo", "thor-able",
    ["nimbus-bus", "reaction-wheels", "vidicon-camera", "n-on-p-cells", "nicad-battery", "vhf-telemetry", "tape-recorder"]), 0);
  var ion = fly(eraDesign("nimbus", "expert", "ionosphere", "leo", "thor-agena",
    ["drum-body", "spin-stabilised", "topside-sounder", "n-on-p-cells", "mercury-battery", "pcm-telemetry", "tape-recorder"]), 0);
  var fire = fly(eraDesign("new-space", "expert", "wildfire", "leo", "rideshare",
    ["cubesat-12u", "spin-stabilised", "optical-camera", "solar-small", "radio-uhf", "obc-basic"]), 0);
  var dh = G.getDebrief(hur), di = G.getDebrief(ion), df = G.getDebrief(fire);
  check("3 an event that ends a flight is named as written, never 'The a hurricane' or 'The the long antennas'",
    hur.ended_early && ion.ended_early && dh.suggestion.indexOf(hur.end_reason.title + ":") === 0 && di.suggestion.indexOf(ion.end_reason.title + ":") === 0 &&
    textProblems([dh, di], "").length === 0, dh.suggestion + " | " + di.suggestion);
  var ground = df.segments.filter(function (x) { return x.id === "ground"; })[0].text;
  check("3 a sliver of data reaching the ground reads 'under 1%' in readable units, not 0% or 0.01025 GB",
    /MB of the 15 GB/.test(df.suggestion) && /under 1%/.test(ground) && textProblems(df, "").length === 0, df.suggestion + " | " + ground);
})();
// The other eras (standalone): random designs, random choices. Nothing from a later year, nothing that cannot launch.
(function () {
  var seed = 99;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var problems = [], flights = 0;
  ["nimbus", "eos", "new-space"].forEach(function (era) {
    var base = G.newDesign("training"); G.setEra(base, era);
    var av = G.getAvailability(base);
    var parts = Object.keys(av.parts).filter(function (k) { return av.parts[k].available; });
    var rockets = Object.keys(av.launchers).filter(function (k) { return av.launchers[k].available; });
    var topics = Object.keys(av.objectives).filter(function (k) { return av.objectives[k].available; });
    for (var n = 0; n < 4000 && flights < 600 * (["nimbus", "eos", "new-space"].indexOf(era) + 1); n++) {
      var byCat = {};
      parts.forEach(function (p) { var c = G.getPart(p).category; (byCat[c] = byCat[c] || []).push(p); });
      var ps = [];
      Object.keys(byCat).forEach(function (c) { if (c !== "propulsion" || rnd() < 0.3) ps.push(byCat[c][Math.floor(rnd() * byCat[c].length)]); });
      if (rnd() < 0.5) ps.push(parts[Math.floor(rnd() * parts.length)]);
      var tier = G.TIERS[Math.floor(rnd() * 3)].id;
      var d = eraDesign(era, tier, topics[Math.floor(rnd() * topics.length)], G.ORBITS[Math.floor(rnd() * 3)].id, rockets[Math.floor(rnd() * rockets.length)], ps);
      if (G.runChecks(d).blockers.length) continue;
      var m = fly(d, function (ev) { return Math.floor(rnd() * ev.choices.length); });
      flights++;
      problems = problems.concat(adviceProblems(G, m, adviceOf(G, m), era + " " + d.objective + " " + d.orbit + " " + d.launcher),
                                 textProblems(G.getDebrief(m), era + " " + d.objective + " " + d.orbit + " " + d.launcher));
    }
  });
  check("3 other eras: TRY THIS can be done in the design's own era", problems.length === 0 && flights > 300,
    flights + " flights" + (problems.length ? "; " + problems.length + " problems: " + problems.slice(0, 3).join(" | ") : ""));
})();
// Part 2: comeback flights for contracts with and without a named orbit. The topic and a named orbit stay as the client set them.
(function () {
  var seed = 7;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var problems = [], flights = 0, named = 0;
  var all = G.PARTS.map(function (p) { return p.id; });
  for (var n = 0; n < 3000 && flights < 500; n++) {
    var g = CB;
    if (n % 25 === 0) g.newComeback(G.TIERS[n % 3].id);
    var c = g.getCampaign();
    if (c.finished) { g.newComeback(G.TIERS[n % 3].id); c = g.getCampaign(); }
    c.treasury_musd = 60; c.deadline_month = c.month + 600;   // room to fly many designs (the cash is the budget)
    var topics = ["radiation", "solar", "weather", "wildfire", "sea-ice", "ionosphere"], topic = topics[Math.floor(rnd() * topics.length)];
    var orbits = topic === "sea-ice" ? ["sso"] : topic === "ionosphere" ? ["leo", "sso"] : ["leo", "sso", "geo"];
    var k = { id: "t-" + n, topic: topic, orbit: rnd() < 0.5 ? orbits[Math.floor(rnd() * orbits.length)] : null, client: "A test client", reason: "It tests things.",
              min_science: 60, price_musd: 10, bonus_musd: 2.5, expires_month: c.month + 12, done: false, text: "A test contract." };
    c.offers = (c.offers || []).concat([k]);
    g.saveCampaign(c);
    var d = g.newComebackDesign(k.id);
    if (!d.orbit) g.setOrbit(d, orbits[Math.floor(rnd() * orbits.length)]);
    var byCat = {};
    all.forEach(function (p) { if (g.isPartAvailable(p, d)) { var cat = g.getPart(p).category; (byCat[cat] = byCat[cat] || []).push(p); } });
    Object.keys(byCat).forEach(function (cat) { if (cat !== "propulsion" || rnd() < 0.5) g.addPart(d, byCat[cat][Math.floor(rnd() * byCat[cat].length)]); });
    if (rnd() < 0.5) g.addPart(d, all[Math.floor(rnd() * all.length)]);
    g.setLauncher(d, ["rideshare", "small", "heavy", "thor-agena"][Math.floor(rnd() * 4)]);
    if (g.runChecks(d).blockers.length) continue;
    var m = g.startMission(d), st;
    do { st = g.stepMonth(m); if (st.event) g.chooseEvent(m, Math.floor(rnd() * st.event.choices.length)); } while (!st.ended);
    var rec = g.recordResult(m);   // the debrief reads the advice after the flight is recorded, as the screen does
    flights++; if (k.orbit) named++;
    var lim = adviceOf(g, m);
    problems = problems.concat(adviceProblems(g, m, lim, topic + "/" + (k.orbit || "any") + " " + d.orbit + " " + d.launcher),
                               textProblems([g.getDebrief(m), rec, g.getComeback(), g.getComebackEnding()], topic + "/" + (k.orbit || "any") + " " + d.orbit));
  }
  check("3 Part 2: TRY THIS for a comeback flight can be done, keeps the contract's topic and named orbit, and never says research",
    problems.length === 0 && flights > 200 && named > 50, flights + " flights, " + named + " with a named orbit" +
    (problems.length ? "; " + problems.length + " problems: " + problems.slice(0, 3).join(" | ") : ""));
})();
// The last tier, and Part 1 (an era design): no "next tier".
(function () {
  var m = fly(eraDesign("new-space", "expert", "weather", "leo", "thor-able",
    ["nimbus-bus", "reaction-wheels", "avcs-camera", "solar-small", "radio-sband", "obc-radtol", "prop-green-small"]), 0);
  var lim = adviceOf(G, m);
  check("3 a target reached on the last tier does not send the player to a next tier", lim.key === "none" && !/next tier/.test(lim.suggestion), lim.suggestion);
})();

// ---- 4. Event text names no hardware the satellite may not carry: an event can fire on any design for its topic
// (a Geiger counter or a scintillation counter, solar cells or batteries alone, a tape recorder or none).
(function () {
  var named = /Geiger|scintillation|recorder|photometer|spectrometer|hinge|panel|infrared|optics|images|spins/i, bad = [];
  G.EVENTS.forEach(function (e) {
    [e.title, e.text].concat(e.choices.map(function (c) { return c.label; })).forEach(function (t) { if (named.test(t)) bad.push(e.id + ": " + t); });
  });
  check("4 no event text names a part the satellite may not carry", bad.length === 0, bad.slice(0, 3).join(" | "));
})();
// ---- 5. The readiness review sends an orbit nothing can fly back to the orbit, not to an impossible fix
(function () {
  function igy(orbit, launcher) {
    var x = G.newDesign("training"); G.setEra(x, "igy"); G.setObjective(x, "radiation"); G.setOrbit(x, orbit);
    ["explorer-body", "spin-stabilised", "scintillation-counter", "mercury-battery", "silicon-cells", "minitrack-beacon", "command-timer"].forEach(function (p) { G.addPart(x, p); });
    if (launcher) G.setLauncher(x, launcher);
    return G.runChecks(x).blockers;
  }
  function text(list, id) { var b = list.filter(function (x) { return x.id === id; })[0]; return b ? b.text : ""; }
  var sso = igy("sso"), ssoV = igy("sso", "vanguard-rocket"), geo = igy("geo", "juno-1");
  check("5 1958, polar orbit: no rocket reaches it, so the review says to pick another orbit",
    /pick another orbit/.test(text(sso, "no-launcher")) && /pick another orbit/.test(text(ssoV, "launcher-reach")), text(sso, "no-launcher"));
  check("5 1958, geostationary: no thruster exists, so the review does not say to add one",
    /pick another orbit/.test(text(geo, "delta-v")) && !/Add propulsion/.test(text(geo, "delta-v")), text(geo, "delta-v"));
  var m = G.newDesign("training"); G.setEra(m, "new-space"); G.setObjective(m, "radiation"); G.setOrbit(m, "geo");
  ["smallsat-bus", "reaction-wheels", "scintillation-counter", "solar-small", "radio-sband", "obc-basic"].forEach(function (p) { G.addPart(m, p); });
  G.setLauncher(m, "small");
  var mb = G.runChecks(m).blockers;
  check("5 2026: a rocket that exists can reach it, and a thruster fits, so those fixes stay", /pick another rocket/.test(text(mb, "launcher-reach")) &&
    /Add propulsion/.test(text(mb, "delta-v")), text(mb, "launcher-reach") + " / " + text(mb, "delta-v"));
})();
// ---- 6. The solar topic after the sunspot record ends (2026): the latest full year is quoted, never a made-up 0
(function () {
  var rec = G.EARTH.solar.sunspots, last = rec.start_year + rec.monthly.length - 1;
  var m = fly(eraDesign("new-space", "training", "solar", "leo", "thor-agena",
    ["smallsat-bus", "reaction-wheels", "oso-xray-spectrometer", "solar-xray-photometer", "solar-small", "battery-28v", "radio-sband", "obc-radtol"]), 0);
  var rw = G.getDebrief(m).real_world;
  check("6 a 2026 solar flight quotes the latest full year of sunspots, not 0", m.start_year > last && rw.sunspots > 0 &&
    rw.text.indexOf("In " + last + ", the latest full year on record") === 0 && !/averaged 0 /.test(rw.text), rw.text.slice(0, 90));
  var months = [], s0 = G.startMission(m.design), st;
  do { st = G.stepMonth(s0); if (st.event) G.chooseEvent(s0, 0); months.push(st.real); } while (!st.ended);
  check("6 its mission months make no sunspot claim for years with no data", months.every(function (r) { return r === null || r.sunspots > 0; }));
  var m58 = fly(eraDesign("nimbus", "training", "solar", "leo", "thor-agena",
    ["drum-body", "spin-stabilised", "oso-xray-spectrometer", "n-on-p-cells", "nicad-battery", "pcm-telemetry", "tape-recorder"]), 0);
  check("6 a 1964 solar flight still quotes its own year", G.getDebrief(m58).real_world.text.indexOf("In 1964 the Sun averaged") === 0, G.getDebrief(m58).real_world.text.slice(0, 60));
})();
// ---- 7. An instrument card's science figure is what the part delivers on this satellite (engage-12)
// The 1958 report: the scintillation counter's card read 6 sci/mo against the Geiger counter's 4, but on the only 1958
// radio it delivered 3.8 a month, less than the Geiger. The card now counts the radio's and the power's losses.
(function () {
  var rest = ["explorer-body", "spin-stabilised", "mercury-battery", "silicon-cells", "minitrack-beacon", "command-timer"];
  var d = eraDesign("igy", "training", "radiation", "leo", "vanguard-rocket", rest);
  var scint = G.getPartFacts(d, "scintillation-counter").science_per_month, geiger = G.getPartFacts(d, "cosmic-ray-counter").science_per_month;
  check("7 on the 1958 beacon, the scintillation counter's card reads below the Geiger counter's, as the flights earn", scint < geiger, scint + " against " + geiger);
  // An event-free flight earns the card's figure each month.
  var withScint = eraDesign("igy", "training", "radiation", "leo", "vanguard-rocket", rest.concat(["scintillation-counter"]));
  var m = G.startMission(withScint); m.schedule = []; finish(m, 0);
  check("7 an event-free flight earns the card's figure each month", Math.abs(m.science / m.month - G.getPartFacts(withScint, "scintillation-counter").science_per_month) < 0.05,
    G.round(m.science / m.month, 2) + " a month against the card's " + G.getPartFacts(withScint, "scintillation-counter").science_per_month);
  // Before the radio and the power are chosen, the card does not read 0.
  var bare = eraDesign("igy", "training", "radiation", "leo", "vanguard-rocket", ["explorer-body"]);
  check("7 with no radio or power chosen yet, an instrument's card still reads its rate", G.getPartFacts(bare, "scintillation-counter").science_per_month > 0 &&
    G.getPartFacts(bare, "cosmic-ray-counter").science_per_month > 0);
  // Every era: the fitted instruments' cards add up to the Build screen's science a month.
  var off = [];
  [["igy", "radiation", "leo", "juno-1", ["explorer-body", "spin-stabilised", "cosmic-ray-counter", "scintillation-counter", "silicon-cells", "mercury-battery", "minitrack-beacon", "command-timer"]],
   ["nimbus", "weather", "leo", "thor-able", ["nimbus-bus", "reaction-wheels", "vidicon-camera", "n-on-p-cells", "nicad-battery", "vhf-telemetry", "tape-recorder"]],
   ["new-space", "wildfire", "leo", "rideshare", ["cubesat-12u", "spin-stabilised", "optical-camera", "solar-small", "radio-uhf", "obc-basic"]],
   ["new-space", "weather", "leo", "thor-able", ["nimbus-bus", "reaction-wheels", "avcs-camera", "solar-small", "radio-sband", "obc-radtol", "prop-green-small"]]
  ].forEach(function (x) {
    var dd = eraDesign(x[0], "training", x[1], x[2], x[3], x[4]);
    var sum = dd.parts.reduce(function (t, id) { var f = G.getPartFacts(dd, id); return t + (f.science_per_month || 0); }, 0);
    if (Math.abs(sum - G.previewScience(dd).per_month) > 0.05) off.push(x[0] + "/" + x[1] + ": cards " + G.round(sum, 2) + ", build " + G.previewScience(dd).per_month);
  });
  check("7 the fitted instruments' cards add up to the Build screen's science a month", off.length === 0, off.join(" | "));
})();

console.log(passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
