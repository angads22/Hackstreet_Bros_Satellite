// js/ui-campaign.js — owned by Design screens.
// The Campaign hub (year, money, science, topics, lessons, missions, save codes) and the Lab
// (the research tree, and upgrades that replace a part with its real successor).
// Every number comes from getHubInfo(), getResearchTree(), getLab() or another back-end call;
// this file only formats and draws. It uses the helpers of js/ui-design.js (StarlineUI) and the
// generic tree drawing of js/ui-tree.js (StarlineTree).
// Shared names: showCampaignHub() and showLab().
(function () {
  "use strict";

  var UI = window.StarlineUI;
  if (!UI) return;   // ui-design.js failed to load; nothing to draw with
  var el = UI.el, num = UI.num, money = UI.money;

  var hub = {
    tab: "research",    // which tab the Lab shows: "research" or "upgrades"
    picked: null,       // research node shown in the detail panel
    pickedUp: null,     // upgrade shown in the detail panel
    buyError: "",       // why the last Buy failed
    exportCode: "",     // text in the Export box
    importError: ""     // why the last Import failed
  };

  function percent(share) { return typeof share === "number" ? Math.round(share * 100) + "%" : "–"; }
  function science(v) { return num(v, 1); }
  // "$2M · 5 science": what a research node or an upgrade costs in both currencies.
  function costText(x) { return money(x.cost_musd) + " · " + science(x.cost_sci || 0) + " science"; }

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

  // The money and science balances, shown on the hub and the lab.
  function balances(info) {
    return el("div", { class: "hub-facts" }, [
      el("div", { class: "hub-fact" }, [el("span", { text: "YEAR" }), el("strong", { id: "hub-year", text: String(info.year) })]),
      el("div", { class: "hub-fact" }, [el("span", { text: "TREASURY" }), el("strong", { id: "hub-treasury", text: money(info.treasury_musd) })]),
      el("div", { class: "hub-fact" }, [el("span", { text: "SCIENCE" }), el("strong", { id: "hub-science", text: science(info.science_pts) })]),
      el("div", { class: "hub-fact" }, [el("span", { text: "MISSIONS" }), el("strong", { id: "hub-missions", text: num(UI.list(info.missions).length, 0) })])
    ]);
  }

  function setCampaignStatus(info) {
    UI.setStatus("CAMPAIGN · " + info.year + " · TREASURY " + money(info.treasury_musd) + " · SCIENCE " + science(info.science_pts));
  }

  // ---------------------------------------------------------------- the lab: research (adds)
  function treeNodes(tree) {
    return UI.list(tree.nodes).map(function (n) {
      return {
        id: n.id, label: n.name, column: n.depth,
        state: n.owned ? "owned" : n.can_buy ? "open" : "locked",
        sub: n.year + " · " + money(n.cost_musd) + " · " + science(n.cost_sci || 0) + " sci",
        tip: n.owned ? "" : UI.list(n.missing).join(" ")
      };
    });
  }

  function emptyDetail(title, text, id) {
    return el("div", { class: "panel", id: id, "aria-live": "polite" }, [
      el("h2", { text: title }), el("p", { class: "preview-empty", text: text })
    ]);
  }

  function missingList(list) {
    return list.length ? el("ul", { class: "checks" }, list.map(function (m) {
      return el("li", { class: "check bad" }, [el("span", { text: m }), el("span", { class: "status", text: "NEEDED" })]);
    })) : null;
  }

  function buyButton(x, label, buy, focusKey) {
    return UI.button([label + " " + money(x.cost_musd) + " + " + science(x.cost_sci || 0) + " SCIENCE"], function () {
      var r = buy(x.id);
      hub.buyError = r && r.ok ? "" : (r && r.reason) || "That cannot be bought yet.";
      showLab();
      var again = document.querySelector('[data-key="' + focusKey + x.id + '"]');
      if (again) again.focus();
    }, { primary: true, disabled: !x.can_buy });
  }

  function researchDetail(tree) {
    var n = UI.byId(UI.list(tree.nodes), hub.picked);
    if (!n) return emptyDetail("RESEARCH", "Pick a box to see what it unlocks and what it needs.", "research-detail");
    return el("div", { class: "panel", id: "research-detail", "aria-live": "polite" }, [
      el("h2", { text: String(n.name).toUpperCase() }),
      UI.facts([["Year", String(n.year)], ["Cost", costText(n)],
        UI.list(n.unlocks_names).length ? ["Unlocks", UI.list(n.unlocks_names).join(", ")] : null]),
      n.blurb ? el("details", { class: "more" }, [el("summary", { text: "Why it matters" }), el("p", { class: "card-blurb", text: n.blurb })]) : null,
      n.owned ? el("p", { class: "verdict ok", text: "OWNED" }) : null,
      n.owned ? null : missingList(UI.list(n.missing)),
      n.owned ? null : buyButton(n, "BUY FOR", buyResearch, "node-"),
      hub.buyError ? el("p", { class: "part-note", role: "alert", text: hub.buyError }) : null
    ]);
  }

  // ---------------------------------------------------------------- the lab: upgrades (replace)
  // Upgrades are drawn with the same tree component: a part on the left, its successor on the right.
  function upgradeTree(lab) {
    var ups = UI.list(lab.upgrades), isSuccessor = {}, column = {}, nodes = [], byPart = {}, edges = [];
    ups.forEach(function (u) { isSuccessor[u.id] = u; });
    function colOf(id) {
      if (column[id] !== undefined) return column[id];
      column[id] = isSuccessor[id] ? colOf(isSuccessor[id].of) + 1 : 0;
      return column[id];
    }
    ups.forEach(function (u) {
      edges.push({ from: u.of, to: u.id });
      if (!byPart[u.of]) byPart[u.of] = u;
      if (!isSuccessor[u.of] && !nodes.some(function (n) { return n.id === u.of; })) {
        nodes.push({ id: u.of, label: u.of_name, column: colOf(u.of), state: u.owned ? "locked" : "owned",
          sub: u.owned ? "replaced" : "in use", tip: "" });
      }
      nodes.push({ id: u.id, label: u.name, column: colOf(u.id), state: u.owned ? "owned" : u.can_buy ? "open" : "locked",
        sub: u.year + " · " + money(u.cost_musd) + " · " + science(u.cost_sci || 0) + " sci",
        tip: u.owned ? "" : UI.list(u.missing).join(" ") });
    });
    return { nodes: nodes, edges: edges, byPart: byPart };
  }

  function upgradeDetail(lab, built) {
    var id = hub.pickedUp;
    var u = UI.byId(UI.list(lab.upgrades), id) || (id && built.byPart[id]) || null;
    if (!u) return emptyDetail("UPGRADES", "Pick a box to see what changes. An upgrade replaces the old part for the rest of the campaign.", "upgrade-detail");
    var gains = UI.list(u.gains).map(function (g) {
      var kind = /\(better\)/.test(g) ? "good" : /\(worse\)/.test(g) ? "bad" : "";
      return el("li", { class: kind, text: g });
    });
    return el("div", { class: "panel", id: "upgrade-detail", "aria-live": "polite" }, [
      el("h2", { text: String(u.name).toUpperCase() }),
      el("p", { class: "nasa-line", text: "Replaces " + u.of_name }),
      UI.facts([["Year", String(u.year)], ["Cost", costText(u)]]),
      gains.length ? el("ul", { class: "log gains" }, gains) : null,
      u.blurb ? el("details", { class: "more" }, [el("summary", { text: "Why it matters" }), el("p", { class: "card-blurb", text: u.blurb })]) : null,
      u.owned ? el("p", { class: "verdict ok", text: "OWNED: IT REPLACES " + String(u.of_name).toUpperCase() }) : null,
      u.owned ? null : missingList(UI.list(u.missing)),
      u.owned ? null : buyButton(u, "UPGRADE FOR", buyUpgrade, "node-"),
      hub.buyError ? el("p", { class: "part-note", role: "alert", text: hub.buyError }) : null
    ]);
  }

  function showLab() {
    var info = typeof getHubInfo === "function" ? getHubInfo() : null;
    if (!info) { window.showDesignScreen("title"); return; }   // no campaign saved
    UI.leaveMission();
    setCampaignStatus(info);
    var lab = typeof getLab === "function" ? getLab() : null;
    var tab = hub.tab === "upgrades" && lab ? "upgrades" : "research";

    function tabButton(id, label) {
      return el("button", { type: "button", class: "tab" + (tab === id ? " on" : ""), "data-key": "tab-" + id, "aria-pressed": tab === id ? "true" : "false",
        onclick: function () { hub.tab = id; hub.buyError = ""; showLab(); var again = document.querySelector('[data-key="tab-' + id + '"]'); if (again) again.focus(); } }, label);
    }

    var body;
    if (tab === "research") {
      var tree = typeof getResearchTree === "function" ? getResearchTree() : { nodes: [], edges: [] };
      body = el("div", { class: "hub-research" }, [
        el("div", { class: "panel" }, [
          window.StarlineTree ? window.StarlineTree.draw({
            nodes: treeNodes(tree), edges: UI.list(tree.edges), picked: hub.picked, label: "Research tree",
            onPick: function (id) { hub.picked = id; hub.buyError = ""; showLab(); var again = document.querySelector('[data-key="node-' + id + '"]'); if (again) again.focus(); }
          }) : el("p", { class: "empty", text: "The tree drawing did not load." }),
          el("p", { class: "bar-note", text: "Filled: owned. Bright: can be bought now. Dashed: still needs something." })
        ]),
        researchDetail(tree)
      ]);
    } else {
      var built = upgradeTree(lab);
      body = el("div", { class: "hub-research" }, [
        el("div", { class: "panel" }, [
          built.nodes.length ? window.StarlineTree.draw({
            nodes: built.nodes, edges: built.edges, picked: hub.pickedUp, label: "Upgrades",
            onPick: function (id) { hub.pickedUp = id; hub.buyError = ""; showLab(); var again = document.querySelector('[data-key="node-' + id + '"]'); if (again) again.focus(); }
          }) : el("p", { class: "empty", text: "No upgrades in the data." }),
          el("p", { class: "bar-note", text: "Left: the part you have. Right: its successor. Buying it replaces the old part." })
        ]),
        upgradeDetail(lab, built)
      ]);
    }

    UI.mount("lab", el("section", { class: "screen" }, [
      el("div", { class: "screen-head" }, [el("h1", { text: "THE LAB" })]),
      balances(info),
      el("div", { class: "tabs", role: "group", "aria-label": "Lab sections" }, [
        tabButton("research", "RESEARCH: ADDS"), lab ? tabButton("upgrades", "UPGRADES: REPLACE") : null]),
      body,
      el("div", null, [UI.button(["< ", "BACK TO THE HUB"], function () { showCampaignHub(); })])
    ]));
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
            if (r && r.ok) { hub.picked = null; hub.pickedUp = null; hub.exportCode = ""; }
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

  // How many things could be bought right now (counting what the back end marks can_buy).
  function buyableCount() {
    var tree = typeof getResearchTree === "function" ? getResearchTree() : { nodes: [] };
    var lab = typeof getLab === "function" ? getLab() : null;
    var research = UI.list(tree.nodes).filter(function (n) { return n.can_buy; }).length;
    var upgrades = lab ? UI.list(lab.upgrades).filter(function (u) { return u.can_buy; }).length : 0;
    return { research: research, upgrades: upgrades };
  }

  function showCampaignHub() {
    var info = typeof getHubInfo === "function" ? getHubInfo() : null;
    if (!info) { window.showDesignScreen("title"); return; }   // no campaign saved
    UI.leaveMission();
    var objectives = UI.data("OBJECTIVES");
    var missions = UI.list(info.missions);
    setCampaignStatus(info);

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
    var buy = buyableCount();

    UI.mount("hub", el("section", { class: "screen" }, [
      el("div", { class: "screen-head" }, [el("h1", { text: "CAMPAIGN HUB" })]),
      balances(info),
      info.archive_sci_per_year > 0
        ? el("p", { class: "nasa-line", id: "hub-archive", text: "Archive: +" + science(info.archive_sci_per_year) + " science a year" }) : null,
      top,
      el("div", { class: "panel" }, [
        el("h2", { text: "TOPICS" }),
        el("div", { class: "grid" }, UI.list(info.topics).map(topicCard))
      ]),
      el("div", { class: "panel" }, [
        el("h2", { text: "THE LAB" }),
        el("p", { class: "nasa-line", id: "lab-summary", text: buy.research + " research and " + buy.upgrades + " upgrades can be bought now." }),
        UI.button(["OPEN THE LAB", " >"], function () { showLab(); }, { primary: !info.finished })
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
  window.showLab = showLab;
})();
