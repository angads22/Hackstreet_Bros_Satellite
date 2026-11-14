// js/game.js — owned by Rules.
// STUB VERSION: every function returns fake but realistic values so the
// screens can be built now. The real formulas from SPEC.md replace these
// bodies later without changing any function name or return shape.
//
// This file must never touch the page: no `document`, no HTML.

function newDesign(tierId) {
  return {
    tier: tierId || "training",
    objective: null,
    orbit: null,
    parts: [],        // list of part ids
    launcher: null
  };
}

function setObjective(design, id) {
  design.objective = id;
  return design;
}

function setOrbit(design, id) {
  design.orbit = id;
  return design;
}

function addPart(design, partId) {
  if (!design.parts.includes(partId)) design.parts.push(partId);
  return design;
}

function removePart(design, partId) {
  design.parts = design.parts.filter(function (id) { return id !== partId; });
  return design;
}

function setLauncher(design, id) {
  design.launcher = id;
  return design;
}

// STUB: fixed fake totals.
function getTotals(design) {
  return {
    mass_kg: 180,
    power_draw_w: 210,
    power_gen_w: 260,
    cost_musd: 64,
    data_gb_day: 30,
    downlink_gb_day: 24,
    delta_v_ms: 140,
    margins: { mass: 0.10, power: 0.19, budget: 0.20 }
  };
}

// STUB: fixed fake values, roughly right for a 500 km orbit.
function getOrbitFacts(design) {
  return {
    period_min: 94.6,
    laps_per_day: 15.2,
    eclipse_fraction: 0.39
  };
}

// STUB: one fake blocker and one fake warning so both lists can be drawn.
function runChecks(design) {
  return {
    blockers: [
      { id: "empty-computer", text: "No computer part. The spacecraft needs at least one." }
    ],
    warnings: [
      { id: "data", text: "Instruments make 30 GB/day but comms can send down 24. The excess is lost." }
    ]
  };
}
