// js/ui-campaign.js — owned by Design screens.
// The Campaign hub: year, treasury, topics, the research tree, lessons, missions and save codes.
// Every number comes from getHubInfo(), getResearchTree() or another back-end call; this file
// only formats and draws. It uses the helpers of js/ui-design.js (StarlineUI) and the generic
// tree drawing of js/ui-tree.js (StarlineTree). One shared name: showCampaignHub().
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;   // ui-design.js failed to load; nothing to draw with
  var el = UI.el, num = UI.num, money = UI.money;

  var hub = {
    picked: null,       // research node shown in the detail panel
    buyError: "",       // why the last Buy failed
    exportCode: "",     // text in the Export box
    importError: ""     // why the last Import failed
  };

  function percent(share) { return typeof share === "number" ? Math.round(share * 100) + "%" : "–"; }

  // ---------------------------------------------------------------- topics
  function topicCard(t) {
    var locked = t.available === false;
    return el("div", { class: "card static" + (locked ? " locked" : ""), "data-key": "topic-" + t.id }, [
      el("div", { class: "card-title" }, [el("h3", { text: String(t.name).toUpperCase() }),
        locked ? el("span", { class: "tag bad", text: "LOCKED" }) : null]),
      locked ? el("p", { class: "card-blurb", text: t.locked_reason || "Locked" })
        : UI.bar("KNOWN", percent(t.knowledge), t.knowledge, ""),
      locked ? null : el("p", { class: "nasa-line", text: "Next mission pays about " + money(t.next_payout_estimate_musd) })
    ]);
  }

  // ---------------------------------------------------------------- research tree
  function treeNodes(tree) {
    return UI.list(tree.nodes).map(function (n) {
      return {
        id: n.id, label: n.name, column: n.depth,
        state: n.owned ? "owned" : n.can_buy ? "open" : "locked",
        sub: n.year + " · " + money(n.cost_musd),
        tip: n.owned ? "" : UI.list(n.missing).join(" ")
      };
    });
  }

  function researchDetail(tree) {
    var n = UI.byId(UI.list(tree.nodes), hub.picked);
    if (!n) {
      return el("div", { class: "panel", id: "research-detail", "aria-live": "polite" }, [
        el("h2", { text: "RESEARCH" }),
        el("p", { class: "preview-empty", text: "Pick a box to see what it unlocks and what it needs." })
      ]);
    }
    var missing = UI.list(n.missing);
    return el("div", { class: "panel", id: "research-detail", "aria-live": "polite" }, [
      el("h2", { text: String(n.name).toUpperCase() }),
      UI.facts([["Year", String(n.year)], ["Cost", money(n.cost_musd)],
        UI.list(n.unlocks_names).length ? ["Unlocks", UI.list(n.unlocks_names).join(", ")] : null]),
      n.blurb ? el("p", { class: "card-blurb", text: n.blurb }) : null,
      n.owned ? el("p", { class: "verdict ok", text: "OWNED" }) : null,
      !n.owned && missing.length ? el("ul", { class: "checks" }, missing.map(function (m) {
        return el("li", { class: "check bad" }, [el("span", { text: m }), el("span", { class: "status", text: "NEEDED" })]);
      })) : null,
      n.owned ? null : UI.button(["BUY FOR " + money(n.cost_musd)], function () {
        var r = buyResearch(n.id);
        hub.buyError = r && r.ok ? "" : (r && r.reason) || "That cannot be bought yet.";
        showCampaignHub();
        var again = document.querySelector('[data-key="node-' + n.id + '"]');
        if (again) again.focus();
      }, { primary: true, disabled: !n.can_buy }),
      hub.buyError ? el("p", { class: "part-note", role: "alert", text: hub.buyError }) : null
    ]);
  }

  // ---------------------------------------------------------------- save codes
  function savePanel() {
    var exportBox = el("textarea", { class: "code-box", id: "export-box", readonly: true, rows: "3",
      "aria-label": "Your save code" });
    exportBox.value = hub.exportCode;
    var importBox = el("textarea", { class: "code-box", id: "import-box", rows: "3", "aria-label": "Paste a save code" });
    return el("div", { class: "panel" }, [
      el("h2", { text: "SAVE CODE" }),
      el("div", { class: "save-row" }, [
        el("div", { class: "stack" }, [
          UI.button("EXPORT", function () {
            hub.exportCode = typeof exportSave === "function" ? exportSave() : "";
            exportBox.value = hub.exportCode;
            exportBox.focus();
            exportBox.select();
          }),
          exportBox
        ]),
        el("div", { class: "stack" }, [
          UI.button("IMPORT", function () {
            var r = typeof importSave === "function" ? importSave(importBox.value.trim()) : { ok: false, reason: "Import is not available." };
            hub.importError = r && r.ok ? "" : (r && r.reason) || "That code did not work.";
            if (r && r.ok) { hub.picked = null; hub.exportCode = ""; }
            showCampaignHub();
          }),
          importBox,
          hub.importError ? el("p", { class: "part-note", role: "alert", id: "import-error", text: hub.importError }) : null
        ])
      ])
    ]);
  }

  // ---------------------------------------------------------------- the hub
  function startMission() {
    var d = typeof newCampaignDesign === "function" ? newCampaignDesign() : null;
    if (d) window.showDesignScreen("briefing", d);
  }

  function showCampaignHub() {
    var info = typeof getHubInfo === "function" ? getHubInfo() : null;
    if (!info) { window.showDesignScreen("title"); return; }   // no campaign saved
    UI.leaveMission();
    var tree = typeof getResearchTree === "function" ? getResearchTree() : { nodes: [], edges: [] };
    var objectives = UI.data("OBJECTIVES");
    var missions = UI.list(info.missions);
    UI.setStatus("CAMPAIGN · " + info.year + " · TREASURY " + money(info.treasury_musd));

    var top = info.finished
      ? el("div", { class: "panel" }, [
          el("p", { class: "banner", text: info.won ? "YOU WON THE CAMPAIGN" : "THE CAMPAIGN IS OVER: TIME RAN OUT" }),
          el("p", { text: "Reached " + info.year + " with " + money(info.treasury_musd) + " and " + num(missions.length, 0) + " missions flown." }),
          UI.button("BACK TO THE TITLE", function () { window.showDesignScreen("title"); }, { primary: true })
        ])
      : el("div", { class: "nav-row" }, [
          el("span"),
          UI.button(["START A MISSION", " >"], startMission, { primary: true })
        ]);

    var lessons = UI.list(info.lessons);
    var history = missions.slice(-5).reverse().map(function (m) {
      var o = UI.byId(objectives, m.objective);
      return el("li", null, m.year + ": " + (o ? o.name : m.objective) + " " + UI.starsText(m.stars) + ", paid " + money(m.payout_musd));
    });

    UI.mount("hub", el("section", { class: "screen" }, [
      el("div", { class: "screen-head" }, [el("h1", { text: "CAMPAIGN HUB" })]),
      el("div", { class: "hub-facts" }, [
        el("div", { class: "hub-fact" }, [el("span", { text: "YEAR" }), el("strong", { id: "hub-year", text: String(info.year) })]),
        el("div", { class: "hub-fact" }, [el("span", { text: "TREASURY" }), el("strong", { id: "hub-treasury", text: money(info.treasury_musd) })]),
        el("div", { class: "hub-fact" }, [el("span", { text: "MISSIONS" }), el("strong", { id: "hub-missions", text: num(missions.length, 0) })])
      ]),
      top,
      el("div", { class: "panel" }, [
        el("h2", { text: "TOPICS" }),
        el("div", { class: "grid" }, UI.list(info.topics).map(topicCard))
      ]),
      el("div", { class: "hub-research" }, [
        el("div", { class: "panel" }, [
          el("h2", { text: "RESEARCH TREE" }),
          window.StarlineTree ? window.StarlineTree.draw({
            nodes: treeNodes(tree), edges: UI.list(tree.edges), picked: hub.picked, label: "Research tree",
            onPick: function (id) {
              hub.picked = id;
              hub.buyError = "";
              showCampaignHub();
              var again = document.querySelector('[data-key="node-' + id + '"]');
              if (again) again.focus();
            }
          }) : el("p", { class: "empty", text: "The tree drawing did not load." }),
          el("p", { class: "bar-note", text: "Filled boxes are owned. Bright boxes can be bought now. Dashed boxes still need something." })
        ]),
        researchDetail(tree)
      ]),
      el("div", { class: "hub-lower" }, [
        el("div", { class: "panel" }, [
          el("h2", { text: "LESSONS SHOWN IN FLIGHT" }),
          lessons.length ? el("ul", { class: "log" }, lessons.map(function (l) { return el("li", { class: "good", text: l.name || l.id }); }))
            : el("p", { class: "preview-empty", text: "None yet. Some research needs a lesson first." })
        ]),
        el("div", { class: "panel" }, [
          el("h2", { text: "MISSIONS FLOWN" }),
          history.length ? el("ul", { class: "log" }, history) : el("p", { class: "preview-empty", text: "None yet." })
        ])
      ]),
      savePanel(),
      el("div", null, [UI.button(["< ", "TITLE"], function () { window.showDesignScreen("title"); })])
    ]));
  }

  window.showCampaignHub = showCampaignHub;
})();
