// js/mission.js — owned by Simulation.
// STUB VERSION: every function returns fake but realistic values so the
// Mission and Debrief screens can be built now. The real simulation from
// SPEC.md replaces these bodies later without changing any function name
// or return shape.
//
// This file must never touch the page: no `document`, no HTML.

// Fake event used by the stub until data/events.js has real ones.
var STUB_EVENT = {
  id: "solar-storm",
  title: "Solar storm",
  text: "A burst of charged particles is heading for the spacecraft. Electronics left running may be damaged.",
  choices: [
    { label: "Shut instruments down", effect: { lose_months: 1 } },
    { label: "Keep observing",        effect: { fail_chance: 0.4, fails: "computer" } }
  ]
};

function startMission(design) {
  return {
    design: design,
    month: 0,
    lifetime_months: 12,
    science: 0,            // science points collected so far
    pending_event: null,   // the event waiting for chooseEvent, if any
    events_seen: [],
    failed_parts: [],
    ended: false
  };
}

// STUB: earns 8 science points a month and fires the fake event in month 4.
function stepMonth(mission) {
  if (mission.ended) {
    return { month: mission.month, science: mission.science, event: null, ended: true };
  }
  mission.month += 1;
  mission.science += 8;
  var event = null;
  if (mission.month === 4) {
    event = STUB_EVENT;
    mission.pending_event = event;
  }
  if (mission.month >= mission.lifetime_months) mission.ended = true;
  return { month: mission.month, science: mission.science, event: event, ended: mission.ended };
}

// STUB: records the choice; picking "Keep observing" loses no part in the stub.
function chooseEvent(mission, choice) {
  if (mission.pending_event) {
    mission.events_seen.push({ id: mission.pending_event.id, choice: choice });
    mission.pending_event = null;
  }
  return mission;
}

// STUB: a fixed two-star result.
function getDebrief(mission) {
  return {
    score: 72,
    stars: 2,
    limiting: "data",
    suggestion: "Add a faster radio: your instruments made more data than you could send down."
  };
}
