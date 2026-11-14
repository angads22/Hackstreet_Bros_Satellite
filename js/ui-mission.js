// js/ui-mission.js — owned by Story.
// 6 Mission and 7 Debrief. Uses the drawing helpers from ui-design.js
// (StarlineUI) and only the mission.js calls listed in SPEC.md.
// Everything lives inside one function so no name here can clash with
// the back end's globals. One name is shared: showMissionScreen(design).
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;   // ui-design.js failed to load; nothing to draw with
  var el = UI.el, num = UI.num;

  var TICK_MS = 300;       // one month per tick
  var FAST_MS = 60;        // fast-forward
  var END_PAUSE_MS = 900;  // pause on the last month before the debrief

  var LIMIT_NAMES = {
    mass: "MASS", power: "POWER", budget: "BUDGET", data: "DATA",
    event: "AN EVENT", design: "THE DESIGN", none: "NOTHING"
  };

  var run = null;   // { design, mission, objective, timer, paused, fast, waiting, nodes }

  // ---------------------------------------------------------------- 6 Mission
  function showMissionScreen(design) {
    stopTimer();
    var mission = startMission(design);
    var objective = UI.byId(UI.data("OBJECTIVES"), design.objective);
    run = { design: design, mission: mission, objective: objective, timer: null, paused: false, fast: false, waiting: false, nodes: {} };
    UI.lock();

    var n = run.nodes;
    n.month = el("span", { class: "month", text: "MONTH 0" });
    n.of = el("span", { class: "countdown-label", text: "of " + num(mission.lifetime_months, 0) });
    n.fill = el("div", { class: "bar-fill" });
    n.sciText = el("span", { text: "0 / " + num(objective ? objective.science_target : 0, 0) });
    n.real = el("p", { class: "nasa-line", "aria-live": "off" });
    n.log = el("ol", { class: "log", "aria-live": "polite" });
    n.event = el("div", { class: "stack" });
    n.pause = UI.button("PAUSE", togglePause, { aria: "Pause the mission" });
    n.fastBtn = UI.button(">>", toggleFast, { aria: "Fast forward" });
    n.fastBtn.setAttribute("aria-pressed", "false");

    UI.mount("mission", el("section", { class: "screen" }, [
      el("div", { class: "screen-head" }, [
        el("h1", { text: "6 · MISSION" }),
        el("p", { text: "Your satellite is flying. Each tick is one month." })
      ]),
      el("div", { class: "mission-head" }, [
        el("div", { class: "stack" }, [n.month, n.of]),
        el("div", { class: "controls" }, [n.pause, n.fastBtn])
      ]),
      el("div", { class: "panel" }, [
        el("div", { class: "bar" }, [
          el("div", { class: "bar-top" }, [el("span", { text: "SCIENCE" }), n.sciText]),
          el("div", { class: "bar-track", role: "presentation" }, [n.fill])
        ]),
        n.real
      ]),
      n.event,
      el("div", { class: "panel" }, [el("h2", { text: "MISSION LOG" }), n.log])
    ]));
    status();
    log("Launch. " + (objective ? objective.name : "Mission") + " begins.", "good");
    schedule();
  }

  function status() {
    var m = run.mission;
    UI.setStatus(UI.tierName() + " · MONTH " + num(m.month, 0) + "/" + num(m.lifetime_months, 0));
  }

  function log(text, kind) {
    var item = el("li", { class: kind || "", text: text });
    run.nodes.log.insertBefore(item, run.nodes.log.firstChild);
  }

  function stopTimer() { if (run && run.timer) { clearTimeout(run.timer); run.timer = null; } }

  function schedule() {
    stopTimer();
    if (run.paused || run.waiting) return;
    run.timer = setTimeout(tick, run.fast ? FAST_MS : TICK_MS);
  }

  function showProgress(s) {
    var target = run.objective ? run.objective.science_target : 0;
    run.nodes.month.textContent = "MONTH " + num(s.month, 0);
    run.nodes.sciText.textContent = num(s.science, 0) + " / " + num(target, 0);
    // Bar width only; the score itself comes from getDebrief.
    run.nodes.fill.style.width = (target > 0 ? Math.min(1, s.science / target) * 100 : 0) + "%";
    run.nodes.real.textContent = realEarthText(s);
    status();
  }

  // The real Earth this month, from NASA data the back end returns with each step.
  // Wildfire: "August: 557,357 fires burned (NASA FIRMS 2025)".
  // Sea ice:  "January: 13.1 million km2 of Arctic ice, polar night (NSIDC 2025)".
  function realEarthText(s) {
    var r = s.real;
    if (!r || !s.month_name) return "";
    if (typeof r.fires === "number") {
      return s.month_name + ": " + num(r.fires, 0) + " fires burned on Earth (NASA FIRMS " + r.year + ")";
    }
    if (typeof r.ice_extent_mkm2 === "number") {
      return s.month_name + ": " + num(r.ice_extent_mkm2, 1) + " million km\u00b2 of Arctic ice" +
        (r.daylight_share === 0 ? ", polar night" : "") + " (NSIDC " + r.year + ")";
    }
    return "";
  }

  var FAIL_NAMES = { instrument: "an instrument", power: "a power part", comms: "the radio",
                     computer: "the computer", propulsion: "the thruster" };

  function tick() {
    if (!run) return;
    var s = stepMonth(run.mission);
    showProgress(s);
    if (s.event) { askEvent(s.event); return; }
    if (s.ended) { finish(); return; }
    schedule();
  }

  function askEvent(event) {
    run.waiting = true;
    stopTimer();
    var box = run.nodes.event;
    while (box.firstChild) box.removeChild(box.firstChild);
    var choices = UI.list(event.choices).map(function (c, i) {
      // Each choice shows its odds right now (fail_chance_now), protection and thin margins included.
      var risk = c.fail_chance_now > 0 && c.effect && c.effect.fails
        ? Math.round(c.fail_chance_now * 100) + "% chance of losing " + (FAIL_NAMES[c.effect.fails] || c.effect.fails) : null;
      return UI.button(risk ? [el("span", { text: c.label }), el("span", { class: "odds", text: risk })] : c.label,
        function () { answer(i); }, { primary: i === 0 });
    });
    box.appendChild(el("div", { class: "dialogue", role: "alertdialog", "aria-labelledby": "event-title" }, [
      UI.directorArt(),
      el("div", { class: "stack" }, [
        el("div", { class: "speaker" }, [el("h2", { id: "event-title", text: event.title.toUpperCase() }), el("span", { text: "Mission director" })]),
        el("p", { class: "speech", text: event.text }),
        el("div", { class: "choices" }, choices)
      ])
    ]));
    if (choices[0]) choices[0].focus();
  }

  function answer(i) {
    var out = chooseEvent(run.mission, i);
    var box = run.nodes.event;
    while (box.firstChild) box.removeChild(box.firstChild);
    log((out.title || "Event") + ": " + (out.label || ""), "");
    if (out.protected) log("A part on board protected you.", "good");
    if (out.failed_part) {
      var p = UI.byId(UI.data("PARTS"), out.failed_part);
      log((p ? p.name : out.failed_part) + " FAILED.", "bad");
    }
    if (out.ended_early || out.ended) log("Mission over.", "bad");
    run.waiting = false;
    if (out.ended) { finish(); return; }
    schedule();
    run.nodes.pause.focus();
  }

  function togglePause() {
    run.paused = !run.paused;
    run.nodes.pause.textContent = run.paused ? "RESUME" : "PAUSE";
    schedule();
  }

  function toggleFast() {
    run.fast = !run.fast;
    run.nodes.fastBtn.setAttribute("aria-pressed", run.fast ? "true" : "false");
    schedule();
  }

  function finish() {
    stopTimer();
    log("Signal ends. Mission complete.", "good");
    var done = run;
    run.timer = setTimeout(function () { showDebrief(done); }, END_PAUSE_MS);
  }

  // ---------------------------------------------------------------- 7 Debrief (the ledger)
  function showDebrief(done) {
    var result = recordResult(done.mission);       // once per finished mission
    var d = getDebrief(done.mission);
    var b = d.breakdown || {};
    UI.setStatus(UI.tierName() + " · SCORE " + num(d.score, 0));

    function row(label, sub, value, of) {
      return el("div", { class: "row" }, [
        el("div", { class: "row-label" }, [el("span", { text: label }), el("span", { text: sub })]),
        el("span", { class: "row-value", text: num(value) + (of ? " / " + of : "") })
      ]);
    }

    // One row per part of the score, in the back end's order; unknown parts still show.
    var PARTS_OF_SCORE = {
      science:    ["SCIENCE RETURNED", 50, num(d.science, 0) + " of " + num(d.science_target, 0) + " points"],
      efficiency: ["VALUE FOR MONEY", 15, "Science paid back for what you spent"],
      budget:     ["BUDGET LEFT", 15, "Share of the budget unspent"],
      margins:    ["MARGINS", 15, "Mass and power margins of 10% or more"],
      events:     ["EVENTS", 10, "Events survived without losing a part"],
      novelty:    ["NEW SCIENCE", 10, "How much of it nobody knew before"]
    };
    var rows = Object.keys(b).map(function (k) {
      var info = PARTS_OF_SCORE[k] || [k.toUpperCase(), null, ""];
      return row(info[0], info[2], b[k], info[1]);
    });

    var paper = el("div", { class: "panel paper" }, [
      el("div", { class: "ledger-head" }, [
        el("h1", { text: "MISSION REPORT" }),
        el("span", { class: "stamp" + (d.stars > 0 ? " pass" : ""), text: UI.starsText(d.stars), "aria-label": d.stars + " of 3 stars" })
      ])
    ].concat(rows).concat([
      el("div", { class: "total" }, [el("span", { text: "SCORE" }), el("span", { text: num(d.score, 0) })])
    ]));

    var events = UI.list(d.events).map(function (e) {
      var p = e.failed_part ? UI.byId(UI.data("PARTS"), e.failed_part) : null;
      return el("li", { class: p ? "bad" : e.protected ? "good" : "" },
        e.title + ": " + e.label + (p ? " (" + p.name + " failed)" : e.protected ? " (protected)" : ""));
    });

    var side = el("div", { class: "panel limit" }, [
      result && result.unlocked ? el("p", { class: "banner", text: tierLabel(result.unlocked) + " UNLOCKED" }) : null,
      el("h2", { text: "WHAT LIMITED YOU: " + (LIMIT_NAMES[d.limiting] || String(d.limiting || "").toUpperCase()) }),
      d.paragraph ? el("p", { text: d.paragraph }) : null,
      el("p", { class: "try", text: "TRY THIS: " + d.suggestion }),
      d.real_world && d.real_world.text ? el("div", { class: "nasa-box" }, [
        el("h2", { text: "AGAINST THE REAL EARTH" }), el("p", { text: d.real_world.text })]) : null,
      closestLine(d),
      d.real_mission ? el("p", { class: "bar-note", text: "Real-world cousin: " + d.real_mission }) : null,
      events.length ? el("h2", { class: "divided", text: "WHAT HAPPENED" }) : null,
      events.length ? el("ul", { class: "log" }, events) : null,
      el("div", { class: "choices" }, [
        UI.button(["REDESIGN", " >"], function () { window.showDesignScreen("build", done.design); }, { primary: true }),
        UI.button("NEW MISSION", function () { window.showDesignScreen("map", newDesign(done.design.tier)); }),
        UI.button("CHANGE TIER", function () { window.showDesignScreen("title"); })
      ])
    ]);

    UI.mount("debrief", el("section", { class: "screen" }, [
      el("div", { class: "screen-head" }, [el("h1", { text: "7 · DEBRIEF" }),
        el("p", { text: "The same design always flies the same mission, so you can see exactly what your change did." })]),
      el("div", { class: "ledger" }, [paper, side])
    ]));
    run = null;
  }

  // "Closest real mission: Explorer 1 (1958, NASA / JPL). ... Like yours: same orbit; battery power."
  function closestLine(d) {
    var c = d.closest_mission;
    if (!c || !c.name) return null;
    var shared = UI.list(c.shared).join("; ");
    return el("p", { class: "nasa-line", text: "Closest real mission: " + c.name +
      " (" + [c.year, c.agency].filter(Boolean).join(", ") + "). " + (c.blurb || "") +
      (shared ? " Like yours: " + shared + "." : "") });
  }

  function tierLabel(id) {
    var t = UI.byId(UI.data("TIERS"), id);
    return t ? t.name.toUpperCase() : String(id).toUpperCase();
  }

  window.showMissionScreen = showMissionScreen;
})();
