// js/ui-ending.js — the end of a campaign: the programme chronicle.
// Every word and number comes from getChronicle() (js/mission.js), which builds the story from what the
// player actually flew and bought, and from the real missions in data/missions.js. This file only draws it.
// Hooked from the Campaign hub: when the campaign has finished, showCampaignHub() calls showChronicle().
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;   // ui-design.js failed to load; nothing to draw with
  var el = UI.el, num = UI.num, money = UI.money;

  var KIND_NAMES = { flight: "FLIGHT", research: "RESEARCH", upgrade: "UPGRADE" };

  function percent(share) { return Math.round((share || 0) * 100) + "%"; }

  function topicRow(t) {
    return el("div", { class: "chron-topic" }, [
      UI.bar(t.name.toUpperCase(), percent(t.knowledge) + " known", t.knowledge, "", t.flights + (t.flights === 1 ? " flight" : " flights") + " · " + UI.starsText(t.best_stars)),
      t.real_mission ? el("p", { class: "chron-real", text: "History: " + t.real_mission }) : null
    ]);
  }

  function entry(e) {
    return el("li", { class: "chron-entry " + e.kind }, [
      el("span", { class: "chron-year", text: String(e.year) }),
      el("div", { class: "chron-body" }, [
        el("div", { class: "chron-title" }, [
          el("span", { class: "chron-kind", text: KIND_NAMES[e.kind] || e.kind.toUpperCase() }),
          e.kind === "flight" ? el("span", { class: "chron-stars", text: UI.starsText(e.stars) }) : null
        ]),
        el("strong", { text: e.title }),
        e.text ? el("p", { text: e.text }) : null
      ])
    ]);
  }

  function showChronicle() {
    var ch = typeof getChronicle === "function" ? getChronicle() : null;
    if (!ch) { window.showDesignScreen("title"); return; }
    UI.leaveMission();
    var t = ch.totals;
    UI.setStatus("CAMPAIGN · " + ch.title.toUpperCase());

    var front = el("div", { class: "panel paper chron-front" }, [
      el("p", { class: "chron-mast", text: "THE SPACE PROGRAMME · " + t.year }),
      el("h1", { class: "chron-rating", text: ch.rating.name.toUpperCase() }),
      el("p", { class: "chron-lede", text: ch.rating.text }),
      el("div", { class: "chron-stats" }, [
        el("div", null, [el("strong", { text: num(t.flights, 0) }), el("span", { text: "FLIGHTS" })]),
        el("div", null, [el("strong", { text: num(t.stars, 0) }), el("span", { text: "STARS" })]),
        el("div", null, [el("strong", { text: num(t.data, 0) }), el("span", { text: "POINTS OF DATA" })]),
        el("div", null, [el("strong", { text: money(t.spent_musd) }), el("span", { text: "SPENT ON FLIGHTS" })]),
        el("div", null, [el("strong", { text: num(t.research, 0) + " + " + num(t.upgrades, 0) }), el("span", { text: "RESEARCH + UPGRADES" })])
      ]),
      ch.epilogue ? el("p", { class: "chron-epilogue", text: ch.epilogue }) : null
    ]);

    UI.mount("ending", el("section", { class: "screen" }, [
      el("div", { class: "screen-head" }, [el("h1", { text: ch.won ? "THE PROGRAMME: COMPLETE" : "THE PROGRAMME: ENDED" })]),
      front,
      el("div", { class: "panel" }, [
        el("h2", { text: "WHAT YOUR SATELLITES LEARNED" }),
        ch.topics.length ? el("div", { class: "chron-topics" }, ch.topics.map(topicRow))
          : el("p", { class: "preview-empty", text: "No data was returned." })
      ]),
      el("div", { class: "panel" }, [
        el("h2", { text: "THE STORY, YEAR BY YEAR" }),
        el("ol", { class: "chron-list" }, ch.timeline.map(entry))
      ]),
      el("div", { class: "nav-row" }, [
        UI.button(["< ", "BACK TO THE TITLE"], function () { window.showDesignScreen("title"); }),
        UI.button(["PLAY ANOTHER PROGRAMME", " >"], function () { window.showDesignScreen("title"); }, { primary: true })
      ])
    ]));
  }

  window.showChronicle = showChronicle;
})();
