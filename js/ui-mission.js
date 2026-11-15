// js/ui-mission.js — owned by Story.
// 6 Mission and 7 Debrief (for a Part 1 walkthrough step, the step result and NEXT STEP / TRY AGAIN; for a Part 2
// contract, what it paid and what the flight did to the cash, the debt and the clock). Uses the drawing helpers from ui-design.js
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
    // Part 2: the cash and the debt before the launch is paid, for the debrief's money story.
    var before = design.comeback && typeof getComeback === "function" ? getComeback() : null;
    var mission = startMission(design);
    var objective = UI.byId(UI.data("OBJECTIVES"), design.objective);
    run = { design: design, mission: mission, objective: objective, timer: null, paused: false, fast: false, waiting: false, nodes: {}, before: before };
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

    // A small low-poly Earth with this orbit beside the month (LowPoly.scenes.earth); nothing without the 3D art.
    var earth = UI.lpCanvas ? UI.lpCanvas(function (L) {
      return typeof L.scenes.earth === "function" ? L.scenes.earth({ orbitId: design.orbit, objectiveId: design.objective, spin: 5 }) : null;
    }, "mission-earth") : null;

    UI.mount("mission", el("section", { class: "screen" }, [
      el("div", { class: "screen-head" }, [el("h1", { text: "6 · MISSION" })]),
      UI.say ? UI.say("mission-start", null) : null,
      el("div", { class: "mission-head" }, [
        // The month and the Earth stay on one line: on a narrow phone the Earth gets smaller instead of wrapping.
        el("div", { class: "month-row" }, [el("div", { class: "stack" }, [n.month, n.of]), earth ? earth.canvas : null]),
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
    // Part 2: the header keeps the comeback's own clock, cash and debt (the satellite's month is on the screen).
    if (run.design.comeback && UI.comebackStatus) { UI.setStatus(UI.comebackStatus()); return; }
    UI.setStatus(UI.tierName() + " · MONTH " + num(m.month, 0) + "/" + num(m.lifetime_months, 0));
  }

  function log(text, kind) {
    var item = el("li", { class: kind || "", text: text });
    run.nodes.log.insertBefore(item, run.nodes.log.firstChild);
  }

  function stopTimer() { if (run && run.timer) { clearTimeout(run.timer); run.timer = null; } }

  function schedule() {
    if (run.finishing) return;   // the mission is over: nothing may cancel the walk to the debrief
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
  // Wildfire: "August: 557,357 fire detections worldwide (NASA FIRMS 2025)". A detection is one
  // hot pixel on one satellite pass, not one fire, so the screens never say "fires burned".
  // Sea ice:  "January: 13.1 million km2 of Arctic ice, polar night (NSIDC 2025)".
  function realEarthText(s) {
    var r = s.real;
    if (!r || !s.month_name) return "";
    if (typeof r.fires === "number") {
      return s.month_name + ": " + num(r.fires, 0) + " fire detections worldwide (NASA FIRMS " + r.year + ")";
    }
    if (typeof r.ice_extent_mkm2 === "number") {
      return s.month_name + ": " + num(r.ice_extent_mkm2, 1) + " million km\u00b2 of Arctic ice" +
        (r.daylight_share === 0 ? ", polar night" : "") + " (NSIDC " + r.year + ")";
    }
    if (typeof r.soundings === "number") {
      return s.month_name + ": Alouette heard " + num(r.soundings, 0) + " soundings (Canadian Space Agency)";
    }
    if (typeof r.sunspots === "number") {
      return s.month_name + (s.year ? " " + s.year : "") + ": sunspot number " + num(r.sunspots, 0) + " (SILSO)";
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
    run.choices = UI.list(event.choices);
    // Each choice shows what it costs in a few words, from the event data and the back end's odds right now
    // (fail_chance_now: protection and thin margins included). None is styled as the answer.
    var choices = run.choices.map(function (c, i) {
      return UI.button([el("span", { text: c.label }), el("span", { class: "odds", text: choiceCost(c) })],
        function () { answer(i); });
    });
    // Who speaks is whoever opened the mission (the story's speaker); the plain director when there is no story.
    var opener = UI.storyLine ? UI.storyLine("mission-start", run.design) : "";
    var who = opener && opener.who ? opener.who : "";
    var face = who && UI.speakerArt ? UI.speakerArt(who) : null;
    var speaker = who && UI.speakerName ? UI.speakerName(who) : "";
    // The calibration event also gets a line from Austin's notebook, for Ajay only (the story layer says "" otherwise).
    var extra = event.id === "calibration-drift" && UI.storyLine ? UI.storyLine("event-calibration", run.design, "ask") : "";
    var title = el("h2", { id: "event-title", tabindex: "-1", text: event.title.toUpperCase() });
    var dialog = el("div", { class: "dialogue", role: "alertdialog", "aria-labelledby": "event-title", "aria-describedby": "event-text" }, [
      face || UI.directorArt(),
      el("div", { class: "stack" }, [
        el("div", { class: "speaker" }, [title, el("span", { text: speaker ? speaker.toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); }) : "Mission director" })]),
        el("p", { class: "speech", id: "event-text", text: event.text }),
        extra && extra.text ? el("p", { class: "speech note", text: (extra.who && UI.speakerName && UI.speakerName(extra.who) ? UI.speakerName(extra.who) + ": " : "") + extra.text }) : null,
        el("div", { class: "choices" }, choices)
      ])
    ]);
    box.appendChild(dialog);
    // The event comes into view from its heading down (at 200% zoom, focusing the first button scrolled the heading
    // off the top), and focus goes to the heading: it names the dialog and leaves every choice equal.
    var tall = dialog.getBoundingClientRect().height > window.innerHeight * 0.8;
    if (dialog.scrollIntoView) dialog.scrollIntoView({ block: tall ? "start" : "nearest" });
    try { title.focus({ preventScroll: true }); } catch (e) { title.focus(); }
  }

  // "Lose 1 month", "Science ×0.6 from now on", "Costs $0.30M", "20% chance of losing the computer", or "No cost".
  // A part that protects against the event cancels everything the risky choice would do, its upside too (chooseEvent).
  function costBits(c, withRisk) {
    var e = c.effect || {}, bits = [];
    if (withRisk && c.fail_chance_now > 0 && e.fails) bits.push(Math.round(c.fail_chance_now * 100) + "% chance of losing " + (FAIL_NAMES[e.fails] || e.fails));
    if (e.lose_months) bits.push("lose " + num(e.lose_months, 0) + " month" + (e.lose_months === 1 ? "" : "s"));
    if (e.science_mult) bits.push("science \u00d7" + e.science_mult + " from now on");
    if (e.cost_musd && !/\$/.test(c.label || "")) bits.push("costs " + UI.money(e.cost_musd));
    return bits;
  }
  function protectedChoice(c) { var e = c.effect || {}; return !!(e.fail_chance && e.fails && !(c.fail_chance_now > 0)); }
  function sentence(bits) { var t = bits.join(", "); return t.charAt(0).toUpperCase() + t.slice(1); }
  function choiceCost(c) {
    if (protectedChoice(c)) return "Protected: no effect";
    var bits = costBits(c, true);
    return bits.length ? sentence(bits) : "No cost";
  }

  function answer(i) {
    var out = chooseEvent(run.mission, i);
    var box = run.nodes.event;
    while (box.firstChild) box.removeChild(box.firstChild);
    // What the choice did, beside it in the log: its costs, "nothing broke" after a risk that passed, or "no cost".
    var c = run.choices && run.choices[out.choice] ? run.choices[out.choice] : null;
    var did = c && !out.protected ? costBits(c, false) : [];
    if (c && !out.protected && c.effect && c.effect.fail_chance && !out.failed_part) did.push("nothing broke");
    log((out.title || "Event") + ": " + (out.label || "") + (did.length ? " (" + did.join(", ") + ")" : c && !out.protected && !out.failed_part ? " (no cost)" : ""), "");
    if (out.id === "calibration-drift" || /calibration/i.test(out.title || "")) {   // the story's reply to the choice (Ajay only; "" otherwise)
      var reply = UI.storyLine ? UI.storyLine("event-calibration", run.design, i) : "";
      if (reply && reply.text) log((reply.who && UI.speakerName && UI.speakerName(reply.who) ? UI.speakerName(reply.who) + ": " : "") + reply.text, "");
    }
    if (out.protected) log("A part on board protected you.", "good");
    if (out.failed_part) {
      var p = UI.byId(UI.data("PARTS"), out.failed_part);
      log((p ? p.name : out.failed_part) + " FAILED.", "bad");
    }
    if (out.ended_early) log("Mission over.", "bad");   // a normal last month ends in finish(), not as a loss
    run.waiting = false;
    if (out.ended) { finish(); return; }
    schedule();
    run.nodes.pause.focus();
  }

  function togglePause() {
    if (run.finishing) return;
    run.paused = !run.paused;
    run.nodes.pause.textContent = run.paused ? "RESUME" : "PAUSE";
    // The name follows the label, so "Resume" finds it by voice and a screen reader says what it will do.
    run.nodes.pause.setAttribute("aria-label", run.paused ? "Resume the mission" : "Pause the mission");
    schedule();
  }

  function toggleFast() {
    if (run.finishing) return;
    run.fast = !run.fast;
    run.nodes.fastBtn.setAttribute("aria-pressed", run.fast ? "true" : "false");
    schedule();
  }

  function finish() {
    stopTimer();
    if (run.finishing) return;
    run.finishing = true;
    run.nodes.pause.disabled = true;
    run.nodes.fastBtn.disabled = true;
    // The last line agrees with the debrief: an early end already said "Mission over."; a flight with no star did not
    // complete anything. getDebrief only reads the finished mission (the debrief calls it again).
    var d = typeof getDebrief === "function" ? getDebrief(run.mission) : null;
    if (!(d && d.ended_early)) {
      if (d && d.stars > 0) log("Signal ends. Mission complete.", "good");
      else log("Signal ends. Too little came home.", "bad");
    }
    var done = run;
    run.timer = setTimeout(function () { showDebrief(done); }, END_PAUSE_MS);
  }

  // ---------------------------------------------------------------- 7 Debrief (the ledger)
  function showDebrief(done) {
    var comeback = !!done.design.comeback;
    var landed = comeback && typeof getComeback === "function" ? getComeback() : null;   // after the launch, before the pay
    var result = recordResult(done.mission);       // once per finished mission
    var d = getDebrief(done.mission);
    // Part 1: a walkthrough step passes with the stars the debrief gives (the record keeps the best). null otherwise.
    var walk = UI.walkResult ? UI.walkResult(done.design, d.stars) : null;
    var b = d.breakdown || {};
    UI.setStatus(comeback && UI.comebackStatus ? UI.comebackStatus() : UI.tierName() + " · SCORE " + num(d.score, 0));
    var outcome = comeback ? contractOutcome(done, result) : null;

    function row(label, sub, value, of) {
      return el("div", { class: "row" }, [
        el("div", { class: "row-label", title: sub }, [el("span", { text: label }), /^\d/.test(sub) ? el("span", { text: sub }) : null]),
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
        starStamp(d.stars)
      ]),
      nextStarLine(d, PARTS_OF_SCORE)
    ].concat(rows).concat([
      el("div", { class: "total" }, [el("span", { text: "SCORE" }), el("span", { text: num(d.score, 0) })])
    ]));

    var events = UI.list(d.events).map(function (e) {
      var p = e.failed_part ? UI.byId(UI.data("PARTS"), e.failed_part) : null;
      return el("li", { class: p ? "bad" : e.protected ? "good" : "" },
        e.title + ": " + e.label + (p ? " (" + p.name + " failed)" : e.protected ? " (protected)" : ""));
    });

    // A standalone flight that opened a tier or an era: a button that starts a mission there (none in Part 1 or 2).
    var unlocks = !walk && !done.design.campaign && !comeback && result ? unlockButtons(done, result) : null;
    // A win (3 stars, a Part 1 step passed, or a Part 2 contract PAID in full): the result moment above the report
    // shows the stars landing and the real discovery, open, so the side panel does not repeat it.
    var win = d.stars >= 3 || !!(walk && walk.passed) || outcome === "paid";
    var side = el("div", { class: "panel limit" }, [
      comeback ? comebackBlock(done, d, result, landed, outcome) : null,
      walk ? el("p", { class: "banner walk-result" + (walk.passed ? "" : " info"), role: "status",
        text: walk.kept ? "NOT THIS TIME: STEP " + walk.step + " STAYS PASSED" : "STEP " + walk.step + (walk.passed ? " PASSED" : ": NOT YET") }) : null,
      // Tiers and eras are no longer chosen on the home page, so a walkthrough step does not announce them. A standalone
      // flight that opens one gets a button that starts it (unlockButtons, under the advice).
      el("h2", null, [UI.icon(limitIcon(d)) || UI.icon(d.limiting), limitingHeading(d)]),
      d.paragraph ? el("p", { text: d.paragraph }) : null,
      el("p", { class: "try", text: "TRY THIS: " + d.suggestion }),
      campaignBlock(done.design, d, result),
      d.real_world && d.real_world.text ? el("div", { class: "nasa-box" }, [
        el("h2", { text: "AGAINST THE REAL EARTH" }), el("p", { text: d.real_world.text }), rightNowLine(d)]) : null,
      segmentRows(d),
      win && closestMoment(d) ? (d.real_mission ? UI.more(d.real_mission, "A real mission like this") : null) : closestLine(d),
      events.length ? el("h2", { class: "divided", text: "WHAT HAPPENED" }) : null,
      events.length ? el("ul", { class: "log" }, events) : null,
      walk ? walkButtons(walk, done.design)
      : comeback ? comebackButtons(result)
      : done.design.campaign
        ? el("div", { class: "choices" }, [
            UI.button([result && result.campaign_over ? "THE STORY OF YOUR PROGRAMME" : "BACK TO THE HUB", " >"], function () { window.showCampaignHub(); }, { primary: true }),
            // A fresh launch of the same satellite, paid for again.
            result && result.campaign_over ? null : UI.button("REBUILD THIS SATELLITE", function () {
              var again = rebuildDesign(done.design);
              if (again) window.showDesignScreen("build", again); else window.showCampaignHub();
            })
          ])
        : unlocks ? el("div", { class: "stack" }, [unlocks, standaloneButtons(done, false)]) : standaloneButtons(done, true)
    ]);

    UI.mount("debrief", el("section", { class: "screen" }, [
      el("div", { class: "screen-head" }, [el("h1", { text: "7 · DEBRIEF" })]),
      teamLine(done.design, d),
      win ? winMoment(d) : null,
      el("div", { class: "ledger" }, [paper, side]),
      comeback ? contractLine(done, outcome) : UI.say ? UI.say("closing", storyView(d)) : null
    ]));
    // A passed step points on, not back at "what limited you".
    if (walk && walk.passed) objectiveLine(walk.last ? "On to the epilogue." : "On to the next step.");
    run = null;
  }

  // Standalone flights (not reached from the home page): REDESIGN, NEW MISSION, HOME. REDESIGN leads unless a tier or
  // an era just opened, whose button leads instead.
  function standaloneButtons(done, lead) {
    return el("div", { class: "choices" }, [
      UI.button(lead ? ["REDESIGN", " >"] : "REDESIGN", function () { window.showDesignScreen("build", done.design); }, { primary: lead }),
      UI.button("NEW MISSION", function () { window.showDesignScreen("map", freshDesign(done.design)); }),
      UI.button("HOME", function () { window.showDesignScreen("title"); })
    ]);
  }

  // ---- One verdict everywhere. The story's lines read ended_early and the stars; a flight lost after it earned a star
  // was not a failure, so its closing line goes by the stars, and one lost after it met its goal says so.
  function storyView(d) {
    if (!d || !d.ended_early || !(d.stars > 0)) return d;
    var copy = {};
    Object.keys(d).forEach(function (k) { copy[k] = d[k]; });
    copy.ended_early = false;
    return copy;
  }
  function teamLine(design, d) {
    if (d && d.ended_early && d.stars > 0 && d.science >= d.science_target && UI.storyLine && UI.sayEl) {
      var line = UI.storyLine("debrief", design, d);   // who speaks in this chapter
      if (line && line.who) return UI.sayEl({ who: line.who, text: "Goal met before we lost it." });
    }
    return UI.say ? UI.say("debrief", d) : null;
  }

  // ---- The stars. The stamp is one image named "N of 3 stars"; its filled stars land one by one, like Part 2's PAID stamp.
  function starStamp(stars) {
    var glyphs = UI.starsText(stars).split("").map(function (g, i) {
      return el("span", { class: "stamp-star" + (i < stars ? " on" : ""), style: "--i: " + i, text: g });
    });
    return el("span", { class: "stamp" + (stars > 0 ? " pass" : ""), role: "img", "aria-label": stars + " of 3 stars" }, glyphs);
  }
  // Fewer than 3 stars: what the next star needs, in words (no number on screen). Two stars short of the science target:
  // the third needs the target, whatever the score. Otherwise the score row with the most points still to win.
  var NEXT_STAR = ["First star", "Second star", "Third star"];
  var ROW_WORDS = { science: "more science returned", efficiency: "better value for money", budget: "more of the budget left",
                    margins: "wider mass and power margins", events: "safer event choices", novelty: "more new science" };
  function nextStarLine(d, partsOfScore) {
    if (!(d.stars >= 0 && d.stars < 3)) return null;
    var b = d.breakdown || {}, most = null, room = 0;
    Object.keys(b).forEach(function (k) {
      var max = partsOfScore[k] && partsOfScore[k][1];
      if (ROW_WORDS[k] && typeof max === "number" && max - b[k] > room + 1e-9) { room = max - b[k]; most = k; }
    });
    var need = d.stars === 2 && d.science < d.science_target ? "reach the science target" : most ? ROW_WORDS[most] : "";
    return need ? el("p", { class: "next-star", "data-key": "next-star", text: NEXT_STAR[d.stars] + ": " + need + "." }) : null;
  }
  // The result moment of a win: big stars (the ones earned land one by one), then the real mission yours is closest
  // to, open (its discovery is the reward). The stamp in the report already names the stars, so these are hidden.
  function winMoment(d) {
    var stars = el("div", { class: "win-stars", "aria-hidden": "true" }, UI.starsText(d.stars).split("").map(function (g, i) {
      return el("span", { class: "stamp-star" + (i < d.stars ? " on" : ""), style: "--i: " + i, text: g });
    }));
    return el("div", { class: "win-moment", "data-key": "win-moment" }, [stars, closestMoment(d)]);
  }
  function closestMoment(d) {
    var c = d.closest_mission;
    if (!c || !c.name || !c.blurb) return null;
    var shared = UI.list(c.shared).join("; ");
    return el("div", { class: "win-discovery" }, [
      el("h2", { text: "LIKE " + String(c.name).toUpperCase() + " (" + [c.year, c.agency].filter(Boolean).join(", ") + ")" }),
      el("p", { text: c.blurb + (shared ? " Like yours: " + shared + "." : "") })
    ]);
  }
  // A tier or an era this flight opened, as a button that starts a new design there.
  function unlockButtons(done, result) {
    var btns = [];
    if (result.unlocked) btns.push(UI.button(["PLAY " + tierLabel(result.unlocked), " >"], function () {
      var d = newDesign(result.unlocked);
      if (done.design.era && typeof setEra === "function") setEra(d, done.design.era);
      window.showDesignScreen("map", d);
    }, { primary: btns.length === 0, key: "play-tier" }));
    if (result.era_unlocked) btns.push(UI.button(["PLAY " + eraLabel(result.era_unlocked), " >"], function () {
      var d = newDesign(done.design.tier);
      if (typeof setEra === "function") setEra(d, result.era_unlocked);
      window.showDesignScreen("map", d);
    }, { primary: btns.length === 0, key: "play-era" }));
    return btns.length ? el("div", { class: "unlocks" }, btns) : null;
  }
  function objectiveLine(text) {
    var line = document.getElementById("objective");
    if (!line) return;
    line.textContent = "OBJECTIVE: " + text;
    line.hidden = false;
  }

  // ---- Part 2: a contract flight. The money story adds up: the cash before the launch, the launch, what the client
  // paid (and the 3-star bonus), the event costs, then the cash now; the debt before, the interest, then the debt now.
  // Every number is from recordResult(), getComeback() (just before the launch, and just before recordResult) or the
  // mission (its launch cost, and the contract's terms copied at launch: the contract itself is closed by now).
  function contractOutcome(done, result) {
    var paid = result && result.contract_paid_musd > 0 ? result.contract_paid_musd : 0;
    var k = done.mission.contract || {};
    if (!paid) return "nothing";
    return paid >= k.price_musd || done.mission.science >= k.min_science ? "paid" : "part";
  }
  function cents(v) { return Math.round((v || 0) * 100) / 100; }
  function ledgerMoney(v, sign) {
    return (sign ? (v < 0 ? "-" : "+") : "") + "$" + num(Math.abs(v), 2) + "M";
  }
  // Rows [label, musd], then the total. Shown to the cent; if rounding to cents would make the column not add up, the
  // largest row takes the cent, so what is on screen always sums to the total shown.
  function ledger(id, rows, totalLabel, total) {
    rows = rows.filter(Boolean);
    var shown = rows.map(function (r) { return cents(r[1]); });
    var diff = cents(cents(total) - shown.reduce(function (a, v) { return a + v; }, 0));
    if (diff !== 0 && rows.length) {
      var big = 0;
      rows.forEach(function (r, i) { if (Math.abs(r[1]) > Math.abs(rows[big][1])) big = i; });
      shown[big] = cents(shown[big] + diff);
    }
    return el("div", { class: "cb-ledger", "data-key": id }, rows.map(function (r, i) {
      return el("div", { class: "cb-row", "data-musd": String(r[1]) }, [el("span", { text: r[0] }),
        el("span", { class: "cb-amount", text: ledgerMoney(shown[i], i > 0) })]);
    }).concat([el("div", { class: "cb-row cb-total", "data-musd": String(total) }, [el("span", { text: totalLabel }),
      el("span", { class: "cb-amount", text: ledgerMoney(cents(total), false) })])]));
  }
  function comebackBlock(done, d, result, landed, outcome) {
    if (!result || typeof result.cash_musd !== "number") return null;
    var before = done.before || null;
    var k = done.mission.contract || {};
    var launch = done.mission.launch_totals ? done.mission.launch_totals.cost_musd : 0;
    var paid = result.contract_paid_musd || 0, bonus = result.contract_bonus_musd || 0;
    var stamp = outcome === "paid" ? "PAID" : outcome === "part" ? "PAID IN PART" : "NOT PAID";
    var why = outcome !== "nothing" ? null
      : result.nothing_new ? (d.knowledge_paragraph || "No new data: this topic is already known.")
      : "No data came home, so there was nothing to pay for.";
    var C = window.StarlineComeback;
    var cashBefore = before ? before.cash_musd : null, debtBefore = before ? before.debt_musd : null;
    return el("div", { class: "nasa-box cb-result " + outcome, "data-key": "contract-result" }, [
      el("div", { class: "cb-result-top" }, [
        el("span", { class: "cb-stamp " + (outcome === "nothing" ? "fail" : "pass"), role: "status", text: stamp }),
        el("span", { class: "cb-client", text: k.client || "" })
      ]),
      why ? el("p", { class: "part-note", text: why }) : null,
      result.comeback_over ? el("p", { class: "banner", role: "alert",
        text: result.lost_reason === "cash" ? "OUT OF CASH: THE COMEBACK IS OVER" : "THE DEADLINE HAS PASSED: THE COMEBACK IS OVER" }) : null,
      typeof cashBefore === "number" ? ledger("cash-ledger", [
        ["CASH BEFORE LAUNCH", cashBefore],
        ["LAUNCH", -launch],
        [outcome === "part" ? "PAID (" + num(done.mission.science, 0) + " OF " + num(k.min_science, 0) + " POINTS)" : "CONTRACT PAID", paid],
        bonus > 0 ? ["3-STAR BONUS", bonus] : null,
        result.event_costs_musd > 0 ? ["EVENT COSTS", -result.event_costs_musd] : null
      ], "CASH NOW", result.cash_musd) : null,
      typeof debtBefore === "number" ? ledger("debt-ledger", [
        ["DEBT BEFORE", debtBefore],
        ["INTEREST, " + num(result.months_used, 0) + " MONTHS", result.interest_musd]
      ], "DEBT NOW", result.debt_musd) : null,
      C && landed ? C.meter({ debt: result.debt_musd, cash: result.cash_musd, start: landed.start_debt_musd },
        { debt: landed.debt_musd, cash: landed.cash_musd }, "Debt " + UI.money(result.debt_musd) + ", cash " + UI.money(result.cash_musd)) : null,
      el("p", { class: "cb-months", "data-key": "months-left" }, [el("strong", { text: num(result.months_left, 0) }), " MONTHS LEFT"])
    ]);
  }
  function comebackButtons(result) {
    var over = result && result.comeback_over;
    return el("div", { class: "choices" }, [over
      ? UI.button(["SEE THE ENDING", " >"], function () { window.showComebackEnding(); }, { primary: true, key: "debrief-ending" })
      : UI.button(["BACK TO THE WORKSHOP", " >"], function () { window.showComebackHub(); }, { primary: true, key: "debrief-workshop" })]);
  }
  // The client's last word, under its own name.
  function contractLine(done, outcome) {
    var line = UI.storyLine ? UI.storyLine("contract", done.design, outcome) : "";
    if (!line || !UI.sayEl) return null;
    var k = done.mission.contract || {};
    return UI.sayEl({ who: line.who, text: line.text, name: k.client ? String(k.client).toUpperCase() : "" });
  }

  // Part 1: NEXT STEP (or, after step 3, the epilogue) once the step passes; TRY AGAIN (the same design on Build) if not.
  function walkButtons(walk, design) {
    var redesign = function () { window.showDesignScreen("build", design); };
    var home = function () { window.showDesignScreen("title"); };
    var next = function (primary) {
      return walk.last
        ? UI.button(primary ? ["EPILOGUE", " >"] : "EPILOGUE", function () { UI.showEpilogue(); }, { primary: primary, key: "walk-next" })
        : UI.button(primary ? ["NEXT STEP", " >"] : "NEXT STEP", function () { UI.startWalkStep(walk.step + 1); }, { primary: primary, key: "walk-next" });
    };
    if (!walk.passed) {
      // Never passed: TRY AGAIN only. Passed before (a replay that fell short): the next step stays open.
      return el("div", { class: "choices" }, [
        UI.button(["TRY AGAIN", " >"], redesign, { primary: true, key: "walk-retry" }),
        walk.kept ? next(false) : null,
        UI.button("HOME", home, { key: "walk-home" })
      ]);
    }
    return el("div", { class: "choices" }, [
      next(true),
      UI.button("REDESIGN", redesign, { key: "walk-redesign" }),
      UI.button("HOME", home, { key: "walk-home" })
    ]);
  }

  // "POWER LIMITED THIS MISSION": the name is a NASA Mission Design Lab discipline from the back end.
  function limitingHeading(d) {
    var name = d.limiting_name || LIMIT_NAMES[d.limiting] || String(d.limiting || "");
    return (name + " limited this mission").toUpperCase();
  }

  // The icon beside that heading: the discipline's own (orbit, instrument, attitude) when the back end names one, else
  // the limiting key's. getDebrief gives the discipline only by name, so the name is looked up in DEBRIEF.disciplines.
  var DISCIPLINE_ICONS = { orbit: "orbit", instruments: "instrument", attitude: "attitude" };
  function limitIcon(d) {
    var names = typeof DEBRIEF !== "undefined" && DEBRIEF && DEBRIEF.disciplines ? DEBRIEF.disciplines : {};
    var key = Object.keys(names).filter(function (k) { return names[k] === d.limiting_name; })[0];
    return DISCIPLINE_ICONS[key] || d.limiting;
  }

  // The four mission segments (launch, space, ground, user), one short line each.
  function segmentRows(d) {
    var rows = UI.list(d.segments).filter(function (s) { return s && s.text; });
    if (!rows.length) return null;
    return el("details", { class: "more segments" }, [el("summary", { text: "The four segments" }),
      el("dl", { class: "facts wide" }, rows.map(function (s) {
        return el("div", null, [el("dt", { text: s.name || s.id }), el("dd", { text: s.text })]);
      }))]);
  }

  // "Right now": today's open data, when the live calls worked (real_world.now). Not repeated if it is the whole summary.
  function rightNowLine(d) {
    var rw = d.real_world;
    if (!rw || !rw.now || rw.now === rw.text) return null;
    return el("p", { class: "nasa-line right-now" }, [el("strong", { text: "RIGHT NOW: " }), rw.now]);
  }

  // "Closest real mission: Explorer 1 (1958, NASA / JPL). ... Like yours: same orbit; battery power."
  // The closest real mission and the real-world cousin, folded into one "More" (one line until opened).
  function closestLine(d) {
    var c = d.closest_mission;
    if (!c || !c.name) return d.real_mission ? UI.more(d.real_mission, "A real mission like this") : null;
    var shared = UI.list(c.shared).join("; ");
    var body = [el("p", { class: "card-blurb", text: (c.blurb || "") + (shared ? " Like yours: " + shared + "." : "") })];
    if (d.real_mission) body.push(el("p", { class: "card-blurb", text: d.real_mission }));
    return el("details", { class: "more" }, [el("summary", { text: "Closest real mission: " + c.name + " (" + [c.year, c.agency].filter(Boolean).join(", ") + ")" })].concat(body));
  }


  // ---- campaign: what the flight paid and taught. Every number is from recordResult() or getDebrief().
  function campaignBlock(design, d, result) {
    if (!design.campaign || design.comeback || !result) return null;   // a comeback flight has comebackBlock instead
    var objectives = UI.data("OBJECTIVES");
    var next = d.best_next_topic && d.best_next_topic !== design.objective ? UI.byId(objectives, d.best_next_topic) : null;
    var lessonNames = typeof LESSONS !== "undefined" && LESSONS ? LESSONS : {};
    var lessons = UI.list(result.lessons_new).map(function (id) { return lessonNames[id] || id; });
    var before = typeof result.knowledge_before === "number" ? result.knowledge_before : d.knowledge_before;
    var after = typeof result.knowledge_after === "number" ? result.knowledge_after : d.knowledge_after;
    var pct = function (x) { return Math.max(0, Math.min(1, x || 0)) * 100 + "%"; };
    return el("div", { class: "nasa-box payout-box" }, [
      el("h2", { text: "PAYOUT " + UI.money(result.payout_musd) }),
      result.nothing_new ? el("p", { class: "banner", role: "alert", text: "NO REWARD: ALREADY COLLECTED. TRY ANOTHER TYPE." }) : null,
      el("div", { class: "bar" }, [
        el("div", { class: "bar-top" }, [el("span", { text: "KNOWLEDGE OF THIS TOPIC" }),
          el("span", { text: Math.round((before || 0) * 100) + "% to " + Math.round((after || 0) * 100) + "%" })]),
        // Two fills: what was known before, then what this mission added.
        el("div", { class: "bar-track two", role: "presentation" }, [
          el("div", { class: "bar-fill", style: "width: " + pct(before) }),
          el("div", { class: "bar-fill gain", style: "width: " + pct((after || 0) - (before || 0)) })
        ])
      ]),
      d.knowledge_paragraph ? el("p", { text: d.knowledge_paragraph }) : null,
      UI.list(result.offers_claimed).length ? el("div", { class: "offers-claimed" }, UI.list(result.offers_claimed).map(function (o) {
        return el("p", { class: "banner info", text: "OFFER MET: " + o.client + " paid " + UI.money(o.bonus_musd) + " and " + UI.num(o.bonus_sci, 0) + " science." });
      })) : null,
      next ? el("p", { class: "nasa-line", text: "Try a new topic: " + next.name + "." }) : null,
      lessons.length ? el("p", { class: "nasa-line", text: "Shown in flight: " + lessons.join("; ") + "." }) : null,
      result.bailout ? el("p", { class: "part-note", text: "An emergency grant of " + UI.money(result.bailout_musd) + " topped up the treasury." }) : null,
      typeof result.science_pts_earned === "number"
        ? el("p", { class: "nasa-line science-earned", text: "Science points: +" + UI.num(result.science_pts_earned, 1) +
            (result.archive_sci ? ", +" + UI.num(result.archive_sci, 1) + " from the archive" : "") +
            (typeof result.science_pts === "number" ? ", now " + UI.num(result.science_pts, 1) : "") }) : null,
      el("p", { class: "bar-note", text: "Treasury now " + UI.money(result.treasury_musd) + ", year " + result.year + "." })
    ]);
  }

  // The same satellite again as a new campaign design (a fresh launch, paid again).
  function rebuildDesign(old) {
    var d = typeof newCampaignDesign === "function" ? newCampaignDesign() : null;
    if (!d) return null;
    if (old.objective) setObjective(d, old.objective);
    if (old.orbit) setOrbit(d, old.orbit);
    UI.list(old.parts).forEach(function (id) { addPart(d, id); });
    if (old.launcher) setLauncher(d, old.launcher);
    return d;
  }

  // A new design on the same tier and in the same era as the one just flown.
  function freshDesign(old) {
    var d = newDesign(old.tier);
    if (old.era && typeof setEra === "function") setEra(d, old.era);
    return d;
  }

  function eraLabel(id) {
    var eras = typeof getEras === "function" ? UI.list(getEras()) : [];
    var e = UI.byId(eras, id);
    return e ? String(e.name).toUpperCase() + " (" + e.year + ")" : String(id).toUpperCase();
  }

  function tierLabel(id) {
    var t = UI.byId(UI.data("TIERS"), id);
    return t ? t.name.toUpperCase() : String(id).toUpperCase();
  }

  window.showMissionScreen = showMissionScreen;
})();
