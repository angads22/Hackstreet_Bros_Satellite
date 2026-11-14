// js/ui-design.js — owned by Design screens.
// Briefing, Orbit, Build, Launch vehicle and Readiness review screens,
// plus the step navigation and the four resource bars.
//
// Rule: this file never does maths. Every number comes from game.js
// (getTotals, getOrbitFacts, runChecks, getPartFacts) or straight from a
// data field. This file only formats numbers and draws them.

// ---------- Settings ----------

// The five design screens, in order.
var DESIGN_SCREENS = ["briefing", "orbit", "build", "launcher", "review"];

// Part categories on the Build screen, in order.
var PART_CATEGORIES = [
  { id: "instrument", title: "Instruments", word: "instrument" },
  { id: "power",      title: "Power",       word: "power" },
  { id: "comms",      title: "Comms",       word: "comms" },
  { id: "computer",   title: "Computer",    word: "computer" },
  { id: "propulsion", title: "Propulsion",  word: "propulsion" }
];

// A bar turns the warning colour when its margin is under this.
var LOW_MARGIN = 0.10;

var DASH = "–";

// ---------- State ----------

var currentDesign = null;         // the design being edited
var currentScreen = "briefing";   // which design screen is showing
var launchMessage = "";           // shown under the Launch button

// ---------- Data access (safe when a data file is empty or missing) ----------

function listOrEmpty(list) {
  return Array.isArray(list) ? list : [];
}

function getObjectiveList() {
  return typeof OBJECTIVES !== "undefined" ? listOrEmpty(OBJECTIVES) : [];
}

function getOrbitList() {
  return typeof ORBITS !== "undefined" ? listOrEmpty(ORBITS) : [];
}

function getPartList() {
  return typeof PARTS !== "undefined" ? listOrEmpty(PARTS) : [];
}

function getLauncherList() {
  return typeof LAUNCHERS !== "undefined" ? listOrEmpty(LAUNCHERS) : [];
}

function getTierList() {
  return typeof TIERS !== "undefined" ? listOrEmpty(TIERS) : [];
}

// Find an item by id in a list. Returns null if it is not there.
function lookUp(list, id) {
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === id) return list[i];
  }
  return null;
}

function getDesign() {
  if (!currentDesign) currentDesign = newDesign();
  if (!Array.isArray(currentDesign.parts)) currentDesign.parts = [];
  return currentDesign;
}

// ---------- Formatting ----------

function isNumber(value) {
  return typeof value === "number" && isFinite(value);
}

// 1234.56 -> "1,235" (or "1,234.6" with decimals = 1). Not a number -> dash.
function formatNumber(value, decimals) {
  if (!isNumber(value)) return DASH;
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals || 0 });
}

function formatKg(value) { return formatNumber(value, 1) + " kg"; }
function formatWatts(value) { return formatNumber(value, 0) + " W"; }
function formatCost(value) { return "$" + formatNumber(value, 1) + "M"; }
function formatGbDay(value) { return formatNumber(value, 1) + " GB/day"; }

// A share such as 0.39 shown as "39%".
function formatPercent(share) {
  if (!isNumber(share)) return DASH;
  return formatNumber(share * 100, 0) + "%";
}

// ---------- Small DOM helpers ----------

function makeElement(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function clearElement(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// A friendly note for an empty list.
function makeEmptyNote(text) {
  return makeElement("p", "empty-note", text);
}

// One "label: value" line inside a card.
function addFact(listNode, label, value) {
  var row = makeElement("span", "fact");
  row.appendChild(makeElement("span", "fact-label", label));
  row.appendChild(makeElement("span", "fact-value", value));
  listNode.appendChild(row);
}

// A card the player can click. The whole card is one real <button>.
// options: { key, title, blurb, selected, selectedWord, onClick }
function makeCard(options) {
  var card = makeElement("button", "card");
  card.type = "button";
  card.setAttribute("data-key", options.key);
  card.setAttribute("aria-pressed", options.selected ? "true" : "false");
  if (options.selected) card.className = "card is-selected";

  var head = makeElement("span", "card-head");
  head.appendChild(makeElement("span", "card-title", options.title || "Unnamed"));
  if (options.selected) {
    head.appendChild(makeElement("span", "card-badge", options.selectedWord || "Selected"));
  }
  card.appendChild(head);

  if (options.blurb) card.appendChild(makeElement("span", "card-blurb", options.blurb));

  var facts = makeElement("span", "card-facts");
  card.appendChild(facts);
  card.factsNode = facts;

  card.addEventListener("click", options.onClick);
  return card;
}

// ---------- Step navigation ----------

function updateSteps() {
  var steps = document.querySelectorAll("#steps .step");
  for (var i = 0; i < steps.length; i++) {
    if (steps[i].getAttribute("data-screen") === currentScreen) {
      steps[i].setAttribute("aria-current", "step");
    } else {
      steps[i].removeAttribute("aria-current");
    }
  }
}

function setUpSteps() {
  var buttons = document.querySelectorAll("#steps button.step");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function (event) {
      goToScreen(event.currentTarget.getAttribute("data-screen"));
    });
  }
}

// ---------- Resource bars ----------

// margin: a number from getTotals(design).margins, or null/undefined for "not known yet".
function setBar(name, valueText, margin) {
  var bar = document.getElementById("bar-" + name);
  if (!bar) return;
  var fill = bar.querySelector(".bar-fill");
  var marginNode = bar.querySelector(".bar-margin");
  var valueNode = bar.querySelector(".bar-value");
  var known = isNumber(margin);

  // The bar's fill is 1 - margin, kept between empty and full.
  var share = known ? 1 - margin : 0;
  if (share < 0) share = 0;
  if (share > 1) share = 1;
  fill.style.width = (share * 100) + "%";

  var state = "";
  var marginText = DASH;
  if (known && margin < 0) {
    state = " is-error";
    marginText = "Over by " + formatPercent(-margin);
  } else if (known && margin < LOW_MARGIN) {
    state = " is-warn";
    marginText = formatPercent(margin) + " margin, thin";
  } else if (known) {
    marginText = formatPercent(margin) + " margin";
  }
  bar.className = "bar" + state;
  marginNode.textContent = marginText;
  valueNode.textContent = valueText;
}

function updateBars() {
  var design = getDesign();
  var totals = getTotals(design) || {};
  var margins = totals.margins || {};

  // Mass: used, and the launcher's capacity for the chosen orbit if both are picked.
  var massText = formatKg(totals.mass_kg);
  var launcher = lookUp(getLauncherList(), design.launcher);
  if (launcher && launcher.capacity_kg && design.orbit && isNumber(launcher.capacity_kg[design.orbit])) {
    massText += " of " + formatKg(launcher.capacity_kg[design.orbit]);
  }
  setBar("mass", massText, margins.mass);

  setBar("power", formatWatts(totals.power_draw_w) + " used of " + formatWatts(totals.power_gen_w) + " made", margins.power);

  // Budget: spent, and the tier's budget if the tier is in the data.
  var budgetText = formatCost(totals.cost_musd);
  var tier = lookUp(getTierList(), design.tier);
  if (tier && isNumber(tier.budget_musd)) budgetText += " of " + formatCost(tier.budget_musd);
  setBar("budget", budgetText, margins.budget);

  setBar("data", formatGbDay(totals.data_gb_day) + " made, radio " + formatGbDay(totals.downlink_gb_day), margins.data);

  var tierLabel = document.getElementById("tier-label");
  if (tierLabel) tierLabel.textContent = tier ? "Tier: " + (tier.name || tier.id) : "";
}

// ---------- Screen: Briefing ----------

function renderBriefing(app, design) {
  addScreenHeading(app, "Briefing", "Pick a science objective. Decide the goal before the hardware.");
  var objectives = getObjectiveList();
  if (objectives.length === 0) {
    app.appendChild(makeEmptyNote("No objectives in the data yet. You can still carry on to the next screen."));
    return;
  }
  var grid = makeElement("div", "card-grid");
  objectives.forEach(function (objective) {
    var card = makeCard({
      key: "objective:" + objective.id,
      title: objective.name,
      blurb: objective.briefing,
      selected: design.objective === objective.id,
      onClick: function () {
        setObjective(design, objective.id);
        render();
      }
    });
    if (isNumber(objective.science_target)) {
      addFact(card.factsNode, "Science target", formatNumber(objective.science_target, 0) + " points");
    }
    var wants = listOrEmpty(objective.wants);
    if (wants.length > 0) addFact(card.factsNode, "Instruments that count", wants.join(", "));
    if (isNumber(objective.needs_resolution_m)) {
      addFact(card.factsNode, "Needs detail of", formatNumber(objective.needs_resolution_m, 1) + " m or finer");
    }
    grid.appendChild(card);
  });
  app.appendChild(grid);
}

// ---------- Screen: Orbit ----------

// Orbit facts for one orbit card: ask game.js about a copy of the design flying in that orbit.
function getFactsForOrbit(design, orbitId) {
  var copy = {
    tier: design.tier,
    objective: design.objective,
    orbit: orbitId,
    parts: design.parts.slice(),
    launcher: design.launcher
  };
  return getOrbitFacts(copy) || {};
}

function renderOrbit(app, design) {
  addScreenHeading(app, "Orbit", "Pick an orbit. Where you fly changes everything else.");
  var orbits = getOrbitList();
  if (orbits.length === 0) {
    app.appendChild(makeEmptyNote("No orbits in the data yet. You can still carry on to the next screen."));
    return;
  }
  var grid = makeElement("div", "card-grid");
  orbits.forEach(function (orbit) {
    var card = makeCard({
      key: "orbit:" + orbit.id,
      title: orbit.name,
      blurb: orbit.blurb,
      selected: design.orbit === orbit.id,
      onClick: function () {
        setOrbit(design, orbit.id);
        render();
      }
    });
    var facts = getFactsForOrbit(design, orbit.id);
    if (isNumber(orbit.altitude_km)) addFact(card.factsNode, "Altitude", formatNumber(orbit.altitude_km, 0) + " km");
    addFact(card.factsNode, "One lap takes", isNumber(facts.period_min) ? formatNumber(facts.period_min, 1) + " min" : DASH);
    addFact(card.factsNode, "Laps per day", formatNumber(facts.laps_per_day, 1));
    if (isNumber(facts.eclipse_fraction)) {
      addFact(card.factsNode, "Time in shadow", "up to " + formatPercent(facts.eclipse_fraction) + " of each lap");
    }
    if (isNumber(orbit.downlink_mult)) addFact(card.factsNode, "Ground contact", formatPercent(orbit.downlink_mult) + " of the day");
    if (isNumber(orbit.lifetime_months)) addFact(card.factsNode, "Mission lifetime", formatNumber(orbit.lifetime_months, 0) + " months");
    grid.appendChild(card);
  });
  app.appendChild(grid);
}

// ---------- Screen: Build ----------

function makePartCard(design, part) {
  var added = design.parts.indexOf(part.id) !== -1;
  var card = makeCard({
    key: "part:" + part.id,
    title: part.name,
    blurb: part.blurb,
    selected: added,
    selectedWord: "Added",
    onClick: function () {
      if (added) {
        removePart(design, part.id);
      } else {
        addPart(design, part.id);
      }
      render();
    }
  });
  var list = card.factsNode;

  // Values game.js works out for this part in the chosen orbit (not in the stub).
  var partFacts = {};
  if (typeof getPartFacts === "function") partFacts = getPartFacts(design, part.id) || {};

  addFact(list, "Mass", formatKg(part.mass_kg));
  if (part.power_draw_w > 0 || part.category !== "power") addFact(list, "Power draw", formatWatts(part.power_draw_w));
  if (isNumber(partFacts.power_gen_w) && partFacts.power_gen_w > 0) {
    addFact(list, "Power made", formatWatts(partFacts.power_gen_w));
  } else if (part.power_gen_w > 0) {
    addFact(list, "Power made", formatWatts(part.power_gen_w));
  }
  addFact(list, "Cost", formatCost(part.cost_musd));
  if (part.data_gb_day > 0) addFact(list, "Data made", formatGbDay(part.data_gb_day));
  if (part.downlink_gb_day > 0) addFact(list, "Downlink", formatGbDay(part.downlink_gb_day));
  if (part.storage_gb > 0) addFact(list, "Storage", formatNumber(part.storage_gb, 0) + " GB");
  if (part.battery_wh > 0) addFact(list, "Battery", formatNumber(part.battery_wh, 0) + " Wh");
  if (part.fuel_kg > 0) addFact(list, "Fuel", formatKg(part.fuel_kg));
  if (part.science > 0) addFact(list, "Science", formatNumber(part.science, 1) + " points a month");
  if (isNumber(partFacts.resolution_m)) {
    addFact(list, "Smallest detail", formatNumber(partFacts.resolution_m, 1) + " m from this orbit");
  }
  var tags = listOrEmpty(part.tags);
  if (tags.length > 0) addFact(list, "Type", tags.join(", "));
  return card;
}

function renderBuild(app, design) {
  addScreenHeading(app, "Build", "Pick parts in five categories. Every part costs something in all four bars.");
  var parts = getPartList();
  if (parts.length === 0) {
    app.appendChild(makeEmptyNote("No parts in the data yet. You can still carry on to the next screen."));
    return;
  }
  PART_CATEGORIES.forEach(function (category) {
    var section = makeElement("section", "part-group");
    var inCategory = parts.filter(function (part) { return part && part.category === category.id; });
    var picked = inCategory.filter(function (part) { return design.parts.indexOf(part.id) !== -1; });

    var heading = makeElement("h3", "group-title", category.title);
    heading.appendChild(makeElement("span", "group-count", picked.length + " added"));
    section.appendChild(heading);

    if (inCategory.length === 0) {
      section.appendChild(makeEmptyNote("No " + category.word + " parts in the data yet."));
    } else {
      var grid = makeElement("div", "card-grid");
      inCategory.forEach(function (part) {
        grid.appendChild(makePartCard(design, part));
      });
      section.appendChild(grid);
    }
    app.appendChild(section);
  });
}

// ---------- Screen: Launch vehicle ----------

function renderLauncher(app, design) {
  addScreenHeading(app, "Launch vehicle", "Pick a rocket. A bigger rocket solves mass and eats the budget.");
  var launchers = getLauncherList();
  if (launchers.length === 0) {
    app.appendChild(makeEmptyNote("No launch vehicles in the data yet. You can still carry on to the next screen."));
    return;
  }
  var orbits = getOrbitList();
  var chosenOrbit = lookUp(orbits, design.orbit);
  if (!chosenOrbit) {
    app.appendChild(makeElement("p", "note", "No orbit chosen yet, so each card lists what the rocket can lift to every orbit."));
  }

  var grid = makeElement("div", "card-grid");
  launchers.forEach(function (launcher) {
    var card = makeCard({
      key: "launcher:" + launcher.id,
      title: launcher.name,
      blurb: launcher.blurb,
      selected: design.launcher === launcher.id,
      onClick: function () {
        setLauncher(design, launcher.id);
        render();
      }
    });
    var capacity = launcher.capacity_kg || {};
    addFact(card.factsNode, "Cost", formatCost(launcher.cost_musd));
    if (chosenOrbit) {
      addFact(card.factsNode, "Lifts to " + (chosenOrbit.name || chosenOrbit.id), formatCapacity(capacity[chosenOrbit.id]));
    } else {
      orbits.forEach(function (orbit) {
        addFact(card.factsNode, "Lifts to " + (orbit.name || orbit.id), formatCapacity(capacity[orbit.id]));
      });
    }
    grid.appendChild(card);
  });
  app.appendChild(grid);
}

// A capacity of 0 (or none listed) means the rocket cannot reach that orbit.
function formatCapacity(value) {
  if (!isNumber(value) || value <= 0) return "Cannot reach";
  return formatKg(value);
}

// ---------- Screen: Readiness review ----------

function addSummaryRow(listNode, label, value) {
  listNode.appendChild(makeElement("dt", "", label));
  listNode.appendChild(makeElement("dd", value ? "" : "is-missing", value || "Not chosen yet"));
}

function nameOf(list, id) {
  var item = lookUp(list, id);
  if (item) return item.name || item.id;
  return "";
}

function addCheckItems(listNode, checks, kind, label) {
  checks.forEach(function (check) {
    var item = makeElement("li", "check check-" + kind);
    item.appendChild(makeElement("span", "check-tag", label));
    item.appendChild(makeElement("span", "check-text", check && check.text ? check.text : "Check failed."));
    listNode.appendChild(item);
  });
}

function renderReview(app, design) {
  addScreenHeading(app, "Readiness review", "Go or no-go. Blockers stop the launch. Warnings do not, but they cost points.");

  // What is on the pad.
  var summary = makeElement("dl", "summary");
  addSummaryRow(summary, "Objective", nameOf(getObjectiveList(), design.objective));
  addSummaryRow(summary, "Orbit", nameOf(getOrbitList(), design.orbit));
  var partNames = design.parts.map(function (id) { return nameOf(getPartList(), id) || id; });
  addSummaryRow(summary, "Parts", partNames.join(", "));
  addSummaryRow(summary, "Launch vehicle", nameOf(getLauncherList(), design.launcher));
  app.appendChild(summary);

  var checks = runChecks(design) || {};
  var blockers = listOrEmpty(checks.blockers);
  var warnings = listOrEmpty(checks.warnings);
  var canLaunch = blockers.length === 0;

  var verdictText = "Go for launch.";
  if (!canLaunch) {
    verdictText = "No go. " + blockers.length + (blockers.length === 1 ? " blocker" : " blockers") + " to fix.";
  } else if (warnings.length > 0) {
    verdictText = "Go for launch, with " + warnings.length + (warnings.length === 1 ? " warning." : " warnings.");
  }
  app.appendChild(makeElement("p", canLaunch ? "verdict verdict-go" : "verdict verdict-nogo", verdictText));

  var list = makeElement("ul", "check-list");
  addCheckItems(list, blockers, "blocker", "No go");
  addCheckItems(list, warnings, "warning", "Warning");
  if (blockers.length === 0 && warnings.length === 0) {
    var allClear = makeElement("li", "check check-go");
    allClear.appendChild(makeElement("span", "check-tag", "Go"));
    allClear.appendChild(makeElement("span", "check-text", "Every check passed."));
    list.appendChild(allClear);
  }
  app.appendChild(list);

  return canLaunch;
}

// Hand the design over to the Mission screen (js/ui-mission.js), if it exists.
function launchMission() {
  if (typeof showMissionScreen === "function") {
    launchMessage = "";
    showMissionScreen(getDesign());
    return;
  }
  launchMessage = "Mission screen not built yet. Your design is ready and waiting on the pad.";
  render();
}

// ---------- Shared screen parts ----------

function addScreenHeading(app, title, lesson) {
  var heading = makeElement("h2", "screen-title", title);
  heading.id = "screen-title";
  heading.tabIndex = -1;
  app.appendChild(heading);
  app.appendChild(makeElement("p", "screen-lesson", lesson));
}

// Back and Next buttons. On the review screen, Next becomes Launch.
function addScreenButtons(app, canLaunch) {
  var index = DESIGN_SCREENS.indexOf(currentScreen);
  var row = makeElement("div", "screen-buttons");

  var back = makeElement("button", "button", "Back");
  back.type = "button";
  back.setAttribute("data-key", "nav:back");
  if (index === 0) {
    back.disabled = true;
  } else {
    back.addEventListener("click", function () { goToScreen(DESIGN_SCREENS[index - 1]); });
  }
  row.appendChild(back);

  if (currentScreen === "review") {
    var launch = makeElement("button", "button button-primary", "Launch");
    launch.type = "button";
    launch.id = "launch-button";
    launch.setAttribute("data-key", "nav:launch");
    launch.disabled = !canLaunch;
    launch.addEventListener("click", launchMission);
    row.appendChild(launch);
  } else {
    var next = makeElement("button", "button button-primary", "Next");
    next.type = "button";
    next.setAttribute("data-key", "nav:next");
    next.addEventListener("click", function () { goToScreen(DESIGN_SCREENS[index + 1]); });
    row.appendChild(next);
  }
  app.appendChild(row);

  if (currentScreen === "review") {
    var message = makeElement("p", "launch-message", canLaunch ? launchMessage : "Fix the blockers above to unlock Launch.");
    message.id = "launch-message";
    message.setAttribute("role", "status");
    app.appendChild(message);
  }
}

// ---------- Drawing and navigation ----------

// Redraw the current screen, the step navigation and the four bars.
function render() {
  var app = document.getElementById("app");
  if (!app) return;
  var design = getDesign();

  // Remember which card or button had keyboard focus, to give it back after the redraw.
  var active = document.activeElement;
  var focusKey = active && active.getAttribute ? active.getAttribute("data-key") : null;

  clearElement(app);
  var canLaunch = false;
  if (currentScreen === "briefing") renderBriefing(app, design);
  if (currentScreen === "orbit") renderOrbit(app, design);
  if (currentScreen === "build") renderBuild(app, design);
  if (currentScreen === "launcher") renderLauncher(app, design);
  if (currentScreen === "review") canLaunch = renderReview(app, design);
  addScreenButtons(app, canLaunch);

  updateSteps();
  updateBars();

  if (focusKey) {
    var keyed = app.querySelectorAll("[data-key]");
    for (var i = 0; i < keyed.length; i++) {
      if (keyed[i].getAttribute("data-key") === focusKey && !keyed[i].disabled) {
        keyed[i].focus();
        break;
      }
    }
  }
}

// Move to another design screen after a click.
function goToScreen(screenName) {
  if (DESIGN_SCREENS.indexOf(screenName) === -1) return;
  currentScreen = screenName;
  launchMessage = "";
  render();
  window.scrollTo(0, 0);
  var heading = document.getElementById("screen-title");
  if (heading) heading.focus();
}

// Public: show one design screen. `design` is optional and replaces the current one,
// so the Debrief can send the player back to Build with the same design loaded.
// screenName: briefing | orbit | build | launcher | review
function showDesignScreen(screenName, design) {
  if (design) currentDesign = design;
  currentScreen = DESIGN_SCREENS.indexOf(screenName) === -1 ? "briefing" : screenName;
  launchMessage = "";
  render();
  window.scrollTo(0, 0);
}

// Start on the Briefing screen as soon as this file loads.
setUpSteps();
showDesignScreen("briefing");
