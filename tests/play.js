// tests/play.js — play the whole game as printed text, no screens needed.
// It calls only the functions the screens will call (SPEC.md, "Functions the
// front end may call") plus the data globals, so it doubles as a check that
// the back end gives the screens everything they need.
//
// Scripted (prints all seven screens for one design):
//   node tests/play.js --tier training --objective wildfire --orbit sso \
//     --launcher rideshare --parts thermal-imager,solar-small,battery-28v,radio-sband,obc-basic,prop-green-small \
//     --choices 0,1
// Interactive (answer each screen at the keyboard):
//   node tests/play.js -i
// Options: --choices lists one choice index per event (default 0).
//          --progress shows saved tier progress after the debrief.

var G = require("./load")();
var readline = require("readline");

// ------------------------------------------------------------------ formatting
var W = 64;
function line(ch) { return new Array(W + 1).join(ch || "-"); }
function header(n, title) { console.log("\n" + line("=") + "\n " + n + ". " + title.toUpperCase() + "\n" + line("=")); }
function wrap(text, indent) {
  indent = indent || "   ";
  var words = String(text).split(" "), out = [], cur = indent;
  words.forEach(function (w) {
    if ((cur + w).length > W) { out.push(cur.replace(/\s+$/, "")); cur = indent; }
    cur += w + " ";
  });
  out.push(cur.replace(/\s+$/, ""));
  return out.join("\n");
}
function bar(label, used, cap, unit, moreIsBetter) {
  var width = 24;
  if (!cap) return "   " + pad(label, 8) + "[" + new Array(width + 1).join("?") + "] " + used + " " + unit + " (no limit set yet)";
  var share = used / cap, n = Math.max(0, Math.min(width, Math.round(share * width)));
  var over = moreIsBetter ? (share < 1 ? "  some lost" : "") : share > 1 ? "  OVER!" : share > 0.9 ? "  thin" : "";
  return "   " + pad(label, 8) + "[" + new Array(n + 1).join("#") + new Array(width - n + 1).join(".") + "] " +
    used + " / " + cap + " " + unit + over;
}
function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
function money(x) { return "$" + (Math.round(x * 100) / 100) + "M"; }

// ------------------------------------------------------------------ screens
function showBriefing() {
  header(1, "Briefing");
  G.OBJECTIVES.forEach(function (o) {
    console.log("\n [" + o.id + "] " + o.name + "   (science target " + o.science_target + ")");
    console.log(wrap(o.briefing));
    console.log("   Counts: " + o.wants.join(", ") + " instruments");
  });
}

function showOrbits(design) {
  header(2, "Orbit");
  G.ORBITS.forEach(function (o) {
    var probe = G.newDesign(design.tier); G.setOrbit(probe, o.id);
    var f = G.getOrbitFacts(probe);
    console.log("\n [" + o.id + "] " + o.name + "  " + o.altitude_km + " km");
    console.log(wrap(o.blurb));
    var obj = G.getObjective(design.objective), e = obj && typeof G.EARTH !== "undefined" ? G.EARTH[obj.id] : null;
    if (e && e.orbit_view) console.log("   Can see " + Math.round(e.orbit_view[o.id] * 100) + "% of the world's real fires (NASA FIRMS " + e.year + ").");
    console.log("   One lap every " + f.period_min + " min (" + f.laps_per_day + " a day), " +
      f.eclipse_min + " min in shadow per lap, " + f.speed_kms + " km/s. Lifetime " + o.lifetime_months + " months.");
  });
}

function showBuild(design) {
  header(3, "Build");
  ["instrument", "power", "comms", "computer", "propulsion"].forEach(function (cat) {
    console.log("\n " + cat.toUpperCase());
    G.PARTS.filter(function (p) { return p.category === cat; }).forEach(function (p) {
      var mark = design.parts.indexOf(p.id) !== -1 ? "[x]" : "[ ]";
      var pf = G.getPartFacts(design, p.id);
      var extra = pf.science_per_month !== null ? ", science " + pf.science_per_month + "/mo" +
        (pf.resolution_m ? " at " + pf.resolution_m + " m" : "") + (pf.counts ? "" : " (does not count)") : "";
      var stats = p.mass_kg + " kg, " + (p.power_draw_w ? "-" + p.power_draw_w + " W, " : "") +
        (pf.power_gen_w ? "+" + pf.power_gen_w + " W, " : "") +
        (p.battery_wh ? p.battery_wh + " Wh, " : "") +
        (p.data_gb_day ? p.data_gb_day + " GB/day made, " : "") +
        (p.downlink_gb_day ? p.downlink_gb_day + " GB/day link, " : "") + money(p.cost_musd) + extra;
      console.log("  " + mark + " " + pad(p.id, 18) + stats);
    });
  });
  showBars(design);
  var pv = G.previewScience ? G.previewScience(design) : null;
  if (pv && pv.target) {
    console.log("   Science preview: about " + pv.total + " of " + pv.target + " over " + pv.months + " months" +
      (pv.instruments.length ? " (" + pv.instruments.map(function (i) { return i.name + " " + i.per_month + "/mo"; }).join(", ") + ")" : ""));
  }
}

function showBars(design) {
  var t = G.getTotals(design);
  console.log("\n RESOURCES");
  console.log(bar("Mass", t.mass_kg, t.capacity_kg, "kg"));
  console.log(bar("Power", t.power_draw_w, t.power_gen_w, "W"));
  console.log(bar("Budget", Math.round(t.cost_musd * 100) / 100, t.budget_musd, "$M"));
  console.log(bar("Data", t.data_returned_gb_day, t.data_gb_day, "GB/day returned", true));
  if (t.delta_v_ms) console.log("   Thrust: " + t.delta_v_ms + " m/s of speed change");
}

function showLaunchers(design) {
  header(4, "Launch vehicle");
  var t = G.getTotals(design);
  G.LAUNCHERS.forEach(function (l) {
    var cap = design.orbit ? l.capacity_kg[design.orbit] : null;
    var fit = cap === null ? "" : cap === 0 ? "  cannot reach this orbit" :
      t.mass_kg > cap ? "  too small for " + t.mass_kg + " kg" : "  fits";
    console.log("\n [" + l.id + "] " + l.name + "  " + money(l.cost_musd) +
      (cap !== null ? ", carries " + cap + " kg to this orbit" : "") + fit);
    console.log(wrap(l.blurb));
  });
}

function showReadiness(design) {
  header(5, "Readiness review");
  var c = G.runChecks(design);
  showBars(design);
  console.log("");
  c.blockers.forEach(function (b) { console.log(wrap("NO-GO  " + b.text, "   ")); });
  c.warnings.forEach(function (w) { console.log(wrap("WARN   " + w.text, "   ")); });
  console.log("\n   >>> " + (c.blockers.length ? "NO-GO: fix the blockers above." : "GO FOR LAUNCH") +
    (c.warnings.length ? " (" + c.warnings.length + " warning" + (c.warnings.length > 1 ? "s" : "") + ")" : ""));
  return c.blockers.length === 0;
}

function showDebrief(mission) {
  header(7, "Debrief");
  var d = G.getDebrief(mission);
  var stars = new Array(d.stars + 1).join("*") + new Array(4 - d.stars).join(".");
  console.log("\n   Score " + d.score + " / 100   [" + stars + "]" + (d.ended_early ? "   (mission ended early)" : ""));
  console.log("   Science " + d.science + " / " + d.science_target +
    "   Breakdown: science " + d.breakdown.science + "/50, efficiency " + d.breakdown.efficiency +
    "/15, margins " + d.breakdown.margins + "/15, events " + d.breakdown.events + "/10, novelty " + d.breakdown.novelty + "/10");
  console.log("   Payout $" + d.payout_musd + "M for $" + d.spent_musd + "M spent; knowledge " +
    Math.round(d.knowledge_before * 100) + "% -> " + Math.round(d.knowledge_after * 100) + "%");
  console.log("\n   What limited you: " + d.limiting.toUpperCase());
  console.log(wrap(d.paragraph));
  console.log("\n   Try this: ");
  console.log(wrap(d.suggestion));
  if (d.real_world) { console.log("\n   Against the real Earth (NASA data):"); console.log(wrap(d.real_world.text)); }
  if (d.real_mission) { console.log("\n   Real-world cousin:"); console.log(wrap(d.real_mission)); }
  return d;
}

function showProgress() {
  if (!G.getProgress) return;
  var p = G.getProgress();
  console.log("\n   Progress: " + G.TIERS.map(function (t) {
    return t.name + " " + (G.isTierUnlocked(t.id) ? (p.best_stars[t.id] || 0) + "*" : "locked");
  }).join("   "));
}

// ------------------------------------------------------------------ mission screen
function runMission(design, chooser, done) {
  header(6, "Mission");
  var m = G.startMission(design);
  var t = G.getTotals(design);
  console.log("   " + m.lifetime_months + " months planned. Data home: " + t.data_returned_gb_day + " of " + t.data_gb_day + " GB/day.\n");
  function next() {
    var s = G.stepMonth(m);
    var bar = new Array(Math.min(40, Math.round(s.science / 5)) + 1).join("|");
    var real = !s.real ? "" : s.real.sunspots !== undefined ? "  " + s.month_name.slice(0, 3) + " " + s.year + ": " + s.real.sunspots + " sunspots (SILSO)"
      : s.real.fires !== undefined ? "  " + s.month_name.slice(0, 3) + ": " + s.real.fires.toLocaleString("en-US") + " fire detections"
      : "  " + s.month_name.slice(0, 3) + ": ice " + s.real.ice_extent_mkm2 + "M km2" + (s.real.daylight_share === 0 ? ", polar night" : "");
    console.log("   Month " + pad(s.month, 3) + pad(s.science, 7) + pad(bar, 26) + real);
    if (s.event) {
      console.log("\n   !! " + s.event.title.toUpperCase());
      console.log(wrap(s.event.text, "      "));
      s.event.choices.forEach(function (c, i) {
        console.log("      " + i + ") " + c.label + (c.fail_chance_now ? "  (" + Math.round(c.fail_chance_now * 100) + "% risk)" : ""));
      });
      chooser(s.event, function (i) {
        var rec = G.chooseEvent(m, i);
        console.log("      You chose: " + rec.label +
          (rec.protected ? "  (a part on board protected you)" : "") +
          (rec.failed_part ? "  -> " + G.getPart(rec.failed_part).name + " FAILED" : "") + "\n");
        if (m.ended) { console.log("   Mission over in month " + m.month + "."); return done(m); }
        next();
      });
      return;
    }
    if (s.ended) return done(m);
    next();
  }
  next();
}

// ------------------------------------------------------------------ scripted mode
function arg(name, dflt) {
  var i = process.argv.indexOf("--" + name);
  return i === -1 ? dflt : process.argv[i + 1];
}

function scripted() {
  var d = G.newDesign(arg("tier", "training"));
  showBriefing();
  G.setObjective(d, arg("objective", "wildfire"));
  console.log("\n   > objective: " + d.objective);
  showOrbits(d);
  G.setOrbit(d, arg("orbit", "sso"));
  console.log("\n   > orbit: " + d.orbit);
  arg("parts", "").split(",").filter(Boolean).forEach(function (id) { G.addPart(d, id); });
  showBuild(d);
  showLaunchers(d);
  G.setLauncher(d, arg("launcher", "rideshare"));
  console.log("\n   > launcher: " + d.launcher);
  if (!showReadiness(d)) return;
  var choices = arg("choices", "").split(",").filter(function (x) { return x !== ""; }).map(Number), k = 0;
  runMission(d, function (ev, cb) {
    var c = k < choices.length ? choices[k] : 0; k++;
    cb(c);
  }, function (m) {
    showDebrief(m);
    if (G.recordResult) { G.recordResult(m); if (process.argv.indexOf("--progress") !== -1) showProgress(); }
  });
}

// ------------------------------------------------------------------ interactive mode
function interactive() {
  var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  function ask(q, cb) { rl.question("\n   ? " + q + " ", function (a) { cb(a.trim()); }); }
  function pick(q, list, cb) {
    ask(q + " [" + list.join(" / ") + "]", function (a) {
      if (list.indexOf(a) === -1) { console.log("   Please type one of: " + list.join(", ")); return pick(q, list, cb); }
      cb(a);
    });
  }
  var unlocked = G.TIERS.filter(function (t) { return !G.isTierUnlocked || G.isTierUnlocked(t.id); }).map(function (t) { return t.id; });
  showProgress();
  pick("Tier?", unlocked, function (tier) {
    var d = G.newDesign(tier);
    showBriefing();
    pick("Objective?", G.OBJECTIVES.map(function (o) { return o.id; }), function (obj) {
      G.setObjective(d, obj);
      showOrbits(d);
      pick("Orbit?", G.ORBITS.map(function (o) { return o.id; }), function (orb) {
        G.setOrbit(d, orb);
        build();
      });
    });
    function build() {
      showBuild(d);
      ask("Type a part id to add or remove it, or press Enter when done:", function (a) {
        if (!a) return launch();
        if (!G.getPart(a)) console.log("   No part called '" + a + "'.");
        else if (d.parts.indexOf(a) === -1) G.addPart(d, a); else G.removePart(d, a);
        build();
      });
    }
    function launch() {
      showLaunchers(d);
      pick("Launcher?", G.LAUNCHERS.map(function (l) { return l.id; }), function (l) {
        G.setLauncher(d, l);
        if (!showReadiness(d)) {
          return pick("Go back to", ["build", "launcher"], function (w) { w === "build" ? build() : launch(); });
        }
        ask("Press Enter to launch.", function () {
          runMission(d, function (ev, cb) {
            pick("Your call:", ev.choices.map(function (_, i) { return String(i); }), function (c) { cb(Number(c)); });
          }, function (m) {
            showDebrief(m);
            if (G.recordResult) { G.recordResult(m); showProgress(); }
            pick("Again?", ["redesign", "quit"], function (a) { if (a === "redesign") build(); else rl.close(); });
          });
        });
      });
    }
  });
}

// ------------------------------------------------------------------ campaign mode
// node tests/play.js --campaign      (hub -> seven screens -> payout -> hub, saved between runs in memory)
function showHub() {
  var h = G.getHubInfo();
  header("H", "Campaign hub");
  console.log("   Year " + h.year + "     Treasury $" + h.treasury_musd + "M" + (h.finished ? (h.won ? "     CAMPAIGN WON" : "     CAMPAIGN OVER") : ""));
  console.log("\n TOPICS");
  h.topics.forEach(function (t) {
    var n = Math.round(t.knowledge * 20);
    console.log("  " + pad(t.id, 10) + "[" + new Array(n + 1).join("#") + new Array(21 - n).join(".") + "] " +
      Math.round(t.knowledge * 100) + "% known   next mission pays about $" + t.next_payout_estimate_musd + "M" +
      (t.available ? "" : "   LOCKED: " + t.locked_reason));
  });
  if (h.lessons.length) console.log("\n LESSONS SHOWN IN FLIGHT: " + h.lessons.map(function (l) { return l.name; }).join("; "));
  if (h.research.length) {
    console.log("\n RESEARCH (a timeline of satellite technology)");
    h.research.slice().sort(function (a, b) { return a.depth - b.depth; }).forEach(function (r) {
      console.log("  " + (r.owned ? "[x] " : r.affordable ? "[$] " : "[ ] ") + "col " + r.depth + "  " + pad(r.id, 25) + r.year + "  $" + r.cost_musd + "M  " + r.name +
        "  -> " + r.unlocks_names.join(", "));
      if (!r.owned && r.missing.length) console.log("          " + r.missing.join(" "));
    });
  }
  if (h.missions.length) {
    console.log("\n MISSIONS FLOWN");
    h.missions.forEach(function (m) {
      console.log("   " + m.year + "  " + pad(m.objective, 9) + pad(m.orbit, 4) + " spent $" + m.spent_musd + "M, science " + m.science +
        ", payout $" + m.payout_musd + "M, " + m.stars + " stars");
    });
  }
  return h;
}

function campaign() {
  var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  function ask(q, cb) { rl.question("\n   ? " + q + " ", function (a) { cb(a.trim()); }); }
  function pick(q, list, cb) {
    ask(q + " [" + list.join(" / ") + "]", function (a) {
      if (list.indexOf(a) === -1) { console.log("   Please type one of: " + list.join(", ")); return pick(q, list, cb); }
      cb(a);
    });
  }
  function start() {
    if (G.getCampaign()) return hub();
    pick("New campaign on which tier?", G.TIERS.map(function (t) { return t.id; }), function (t) { G.newCampaign(t); hub(); });
  }
  function hub() {
    var h = showHub();
    var cmds = h.finished ? ["export", "new", "quit"] : ["fly", "buy", "export", "import", "quit"];
    pick("Hub", cmds, function (c) {
      if (c === "quit") return rl.close();
      if (c === "new") { G.resetCampaign(); return start(); }
      if (c === "export") { console.log("\n   Save code:\n   " + G.exportSave()); return hub(); }
      if (c === "import") return ask("Paste a save code:", function (code) { var r = G.importSave(code); console.log("   " + (r.ok ? "Loaded." : r.reason)); hub(); });
      if (c === "buy") return ask("Research id:", function (id) { var r = G.buyResearch(id); console.log("   " + (r.ok ? "Bought." : r.reason)); hub(); });
      fly();
    });
  }
  function fly() {
    var d = G.newCampaignDesign();
    var open = G.OBJECTIVES.filter(function (o) { return G.isObjectiveAvailable(o.id); }).map(function (o) { return o.id; });
    showBriefing();
    pick("Objective?", open, function (obj) {
      G.setObjective(d, obj);
      showOrbits(d);
      pick("Orbit?", G.ORBITS.map(function (o) { return o.id; }), function (orb) { G.setOrbit(d, orb); build(); });
    });
    function build() {
      showBuild(d);
      var pp = G.previewPayout(d);
      console.log("   Expected payout $" + pp.expected_payout_musd + "M, cost $" + pp.cost_musd + "M, net $" + pp.net_musd + "M" +
        "   (knowledge " + Math.round(pp.knowledge_before * 100) + "% -> " + Math.round(pp.knowledge_after * 100) + "%)");
      ask("Type a part id to add or remove it, or press Enter when done:", function (a) {
        if (!a) return launch();
        if (!G.getPart(a)) console.log("   No part called '" + a + "'.");
        else if (!G.isPartAvailable(a)) console.log("   Locked: needs " + G.researchNameFor("parts", a) + ".");
        else if (d.parts.indexOf(a) === -1) G.addPart(d, a); else G.removePart(d, a);
        build();
      });
    }
    function launch() {
      showLaunchers(d);
      pick("Launcher?", G.LAUNCHERS.map(function (l) { return l.id; }), function (l) {
        G.setLauncher(d, l);
        if (!showReadiness(d)) return pick("Go back to", ["build", "launcher", "hub"], function (w) { w === "build" ? build() : w === "launcher" ? launch() : hub(); });
        ask("Press Enter to launch (the cost leaves the treasury now).", function () {
          runMission(d, function (ev, cb) {
            pick("Your call:", ev.choices.map(function (_, i) { return String(i); }), function (c) { cb(Number(c)); });
          }, function (m) {
            var r = G.recordResult(m);
            var db = showDebrief(m);
            if (db.knowledge_paragraph) { console.log(""); console.log(wrap(db.knowledge_paragraph)); }
            console.log("\n   Paid $" + r.payout_musd + "M + grant $" + r.grant_musd + "M" +
              (r.event_costs_musd ? " - event costs $" + r.event_costs_musd + "M" : "") + ". Treasury now $" + r.treasury_musd + "M." +
              (r.bailout ? " Emergency grant: $" + r.bailout_musd + "M." : "") +
              (db.best_next_topic && db.best_next_topic !== m.design.objective ? " Best next topic: " + db.best_next_topic + "." : "") +
              (r.lessons_new && r.lessons_new.length ? "\n   New lessons: " + r.lessons_new.join(", ") + "." : ""));
            ask("Press Enter to return to the hub.", function () { hub(); });
          });
        });
      });
    }
  }
  start();
}

if (process.argv.indexOf("--campaign") !== -1) campaign();
else if (process.argv.indexOf("-i") !== -1 || process.argv.indexOf("--interactive") !== -1) interactive();
else scripted();
