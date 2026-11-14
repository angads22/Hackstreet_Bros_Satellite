// js/mission.js — owned by Simulation.
// The month-by-month mission, seeded random events, scoring, stars and the limiting factor.
// This file must never touch the page: no `document`, no HTML.
// It reads the data globals (EVENTS, TIERS, OBJECTIVES, ORBITS, DEBRIEF) and calls these
// game.js functions: getTotals, getScienceRate, getDesignParts, findById.

// ---------- Numbers to tune ----------

const MISSION_REQUIRED_CATEGORIES = ["instrument", "power", "comms", "computer"];

const MISSION_THIN_MARGIN = 0.10;            // a margin under 10% is "thin"
const MISSION_THIN_MARGIN_FAIL_MULT = 1.5;   // thin mass or power margin: fail_chance is multiplied by this
const MISSION_MAX_FAIL_CHANCE = 1;           // ...and capped here

const MISSION_POINTS_SCIENCE = 60;
const MISSION_POINTS_BUDGET = 15;
const MISSION_POINTS_MARGINS = 15;           // half for the mass margin, half for the power margin
const MISSION_POINTS_EVENTS = 10;

const MISSION_STAR_SCORES = [50, 70, 90];    // one, two and three stars

// One concrete suggestion per limiting factor.
const MISSION_SUGGESTIONS = {
  mass: "Swap one part for a lighter one, or pick a bigger launcher, so the mass margin is at least 10%.",
  power: "Add a solar array or a bigger battery so the instruments stay on through the whole orbit.",
  budget: "Trade one expensive part or the launcher for a cheaper one to leave some budget unspent.",
  data: "Add a faster radio, or pick an orbit with more ground contact, so all the data gets down.",
  event: "Add a part that protects against the event that hurt you, and keep mass and power margins above 10%.",
  none: "The science target was reached. Try the same mission with a cheaper design or a harder tier."
};

// Used when the target was missed because no instrument earned any science.
const MISSION_SUGGESTION_NO_SCIENCE =
  "Pick an instrument whose tags match the objective and an orbit that suits it, so it earns science.";

// ---------- Small helpers ----------

// A missing or broken number counts as 0.
function missionNumber(value) {
  return (typeof value === "number" && isFinite(value)) ? value : 0;
}

// Turns a string into a 32-bit whole number (FNV-1a hash).
function missionHashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// The seed comes from the design, so the same design replays the same mission.
function missionDesignSeed(design) {
  const parts = (design.parts || []).slice().sort();
  const text = [design.tier, design.objective, design.orbit, parts.join(","), design.launcher].join("|");
  return missionHashString(text);
}

// Seeded random number from 0 up to (not including) 1. This is the mulberry32 generator.
// Its state is a plain number kept on the mission, so the mission stays plain data.
function missionRandom(mission) {
  mission.rng_state = (mission.rng_state + 0x6D2B79F5) >>> 0;
  let t = mission.rng_state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Random whole number from 0 to count - 1.
function missionRandomIndex(mission, count) {
  return Math.floor(missionRandom(mission) * count);
}

// Takes `count` different items out of `list`, in seeded random order.
function missionPick(mission, list, count) {
  const pool = list.slice();
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(missionRandomIndex(mission, pool.length), 1)[0]);
  }
  return picked;
}

// Part ids that still work: the design's parts minus the failed ones.
function missionWorkingPartIds(mission) {
  const ids = mission.design.parts.slice();
  for (let i = 0; i < mission.failed_parts.length; i++) {
    const at = ids.indexOf(mission.failed_parts[i]);
    if (at !== -1) ids.splice(at, 1);
  }
  return ids;
}

// A copy of the design with the failed parts removed.
function missionWorkingDesign(mission) {
  const d = mission.design;
  return { tier: d.tier, objective: d.objective, orbit: d.orbit, parts: missionWorkingPartIds(mission), launcher: d.launcher };
}

// A margin is thin when it is known and under 10%. Unknown (null) is not thin,
// but it also earns no margin points (see missionMarginIsGood).
function missionMarginIsThin(margin) {
  return typeof margin === "number" && margin < MISSION_THIN_MARGIN;
}

function missionMarginIsGood(margin) {
  return typeof margin === "number" && margin >= MISSION_THIN_MARGIN;
}

// ---------- Events ----------

// How bad a choice is, as a list compared left to right:
// chance of breaking a part, then months lost, then science cut, then extra cost.
function missionChoiceBadness(choice) {
  const effect = (choice && choice.effect) || {};
  const mult = (typeof effect.science_mult === "number") ? effect.science_mult : 1;
  return [
    missionNumber(effect.fail_chance),
    missionNumber(effect.lose_months),
    1 - mult,
    missionNumber(effect.cost_musd)
  ];
}

// The "worst choice" of an event is the one most likely to break a part. If there is a tie
// (or no choice can break a part) the one that loses more months is worse, then the one that
// cuts science more, then the one that costs more. A full tie goes to the earlier choice.
function missionWorstChoiceIndex(event) {
  const choices = event.choices || [];
  let worst = 0;
  for (let i = 1; i < choices.length; i++) {
    const a = missionChoiceBadness(choices[i]);
    const b = missionChoiceBadness(choices[worst]);
    for (let k = 0; k < a.length; k++) {
      if (a[k] > b[k]) { worst = i; break; }
      if (a[k] < b[k]) break;
    }
  }
  return worst;
}

// True if a working part lists this event id in its `protects`.
function missionIsProtected(mission, eventId) {
  const parts = getDesignParts(missionWorkingDesign(mission));
  for (let i = 0; i < parts.length; i++) {
    if ((parts[i].protects || []).indexOf(eventId) !== -1) return true;
  }
  return false;
}

// Decides which events fire and in which months. Returns [{ month, event_id }] sorted by month.
function missionBuildSchedule(mission, tier) {
  const events = (typeof EVENTS !== "undefined" && EVENTS) ? EVENTS : [];
  // Events fire at the end of a month. The last month is left out when possible,
  // so there is always some mission left for the decision to matter.
  const lastMonth = mission.lifetime_months > 1 ? mission.lifetime_months - 1 : mission.lifetime_months;
  let count = tier ? Math.floor(missionNumber(tier.events)) : 0;
  count = Math.max(0, Math.min(count, events.length, lastMonth));
  if (count === 0) return [];

  const months = [];
  for (let m = 1; m <= lastMonth; m++) months.push(m);
  const ids = [];
  for (let i = 0; i < events.length; i++) ids.push(events[i].id);

  const pickedMonths = missionPick(mission, months, count).sort(function (a, b) { return a - b; });
  const pickedIds = missionPick(mission, ids, count);
  const schedule = [];
  for (let i = 0; i < count; i++) schedule.push({ month: pickedMonths[i], event_id: pickedIds[i] });
  return schedule;
}

// ---------- Public functions ----------

// Returns a mission: plain data holding a copy of the design and everything that has happened so far.
function startMission(design) {
  design = design || {};
  const copy = {
    tier: design.tier || null,
    objective: design.objective || null,
    orbit: design.orbit || null,
    parts: (design.parts || []).slice(),
    launcher: design.launcher || null
  };
  const orbit = findById(ORBITS, copy.orbit);
  const tier = findById(TIERS, copy.tier);
  const totals = getTotals(copy) || {};
  const margins = totals.margins || {};
  const rate = getScienceRate(copy) || {};
  const seed = missionDesignSeed(copy);

  const mission = {
    design: copy,
    seed: seed,
    rng_state: seed,
    lifetime_months: orbit ? Math.max(0, Math.floor(missionNumber(orbit.lifetime_months))) : 0,
    month: 0,                 // months flown so far
    science: 0,               // science earned so far
    ideal_science: 0,         // what the launched design would have earned with no events
    science_mult: 1,          // lasting multiplier from event choices
    extra_cost_musd: 0,       // money spent on event choices
    skip_months: 0,           // months still to sit out with no science
    failed_parts: [],         // ids of parts that broke
    schedule: [],
    pending_event: null,      // id of the event waiting for a decision
    events_resolved: 0,
    events_clean: 0,          // events survived without losing a part
    ended: false,
    ended_early: false,
    // Facts about the design as launched, kept for the debrief.
    launch_cost_musd: missionNumber(totals.cost_musd),
    launch_margins: {
      mass: (typeof margins.mass === "number") ? margins.mass : null,
      power: (typeof margins.power === "number") ? margins.power : null,
      budget: (typeof margins.budget === "number") ? margins.budget : null
    },
    launch_rate: {
      science_per_month: missionNumber(rate.science_per_month),
      data_share: (typeof rate.data_share === "number") ? rate.data_share : 1,
      eclipse_mult: (typeof rate.eclipse_mult === "number") ? rate.eclipse_mult : 1,
      counted: (rate.counted_parts || []).length
    }
  };
  mission.schedule = missionBuildSchedule(mission, tier);
  if (mission.lifetime_months === 0) mission.ended = true;
  return mission;
}

// What stepMonth returns. `science` is the total so far; `science_month` is what the last month earned.
function missionStepResult(mission, scienceMonth) {
  return {
    month: mission.month,
    science: mission.science,
    science_month: scienceMonth,
    event: mission.pending_event ? findById(EVENTS, mission.pending_event) : null,
    ended: mission.ended
  };
}

// Flies one month. Returns { month, science, event, ended }.
// If an event is returned, call chooseEvent before the next stepMonth.
function stepMonth(mission) {
  if (!mission) return { month: 0, science: 0, science_month: 0, event: null, ended: true };
  if (mission.ended) return missionStepResult(mission, 0);
  if (mission.pending_event) return missionStepResult(mission, 0);   // waiting for a decision: do not advance
  if (mission.month >= mission.lifetime_months) {
    mission.ended = true;
    return missionStepResult(mission, 0);
  }

  mission.month += 1;
  mission.ideal_science += mission.launch_rate.science_per_month;

  // Science this month, from the parts that still work.
  let earned = 0;
  if (mission.skip_months > 0) {
    mission.skip_months -= 1;          // a lost month still counts against the lifetime
  } else {
    const rate = getScienceRate(missionWorkingDesign(mission)) || {};
    earned = missionNumber(rate.science_per_month) * mission.science_mult;
  }
  mission.science += earned;

  // Does an event fire at the end of this month?
  for (let i = 0; i < mission.schedule.length; i++) {
    const slot = mission.schedule[i];
    if (slot.month === mission.month && findById(EVENTS, slot.event_id)) {
      mission.pending_event = slot.event_id;
    }
  }

  if (!mission.pending_event && mission.month >= mission.lifetime_months) mission.ended = true;
  return missionStepResult(mission, earned);
}

// Applies the player's decision. `choice` is the index into event.choices.
// Returns { text, failed_part, ended }: a plain sentence about what happened and the id of the
// part that broke (or null).
function chooseEvent(mission, choice) {
  const event = (mission && mission.pending_event) ? findById(EVENTS, mission.pending_event) : null;
  if (!event) return { text: "No event is waiting for a decision.", failed_part: null, ended: !mission || mission.ended };
  const choices = event.choices || [];
  if (choices.length > 0 && !choices[choice]) {
    return { text: "That choice does not exist.", failed_part: null, ended: false };   // still waiting
  }
  const effect = (choices[choice] && choices[choice].effect) || {};
  const sentences = [];
  let failedPart = null;

  if (choice === missionWorstChoiceIndex(event) && missionIsProtected(mission, event.id)) {
    // Protection: a part built for this event cancels the whole penalty of the worst choice.
    sentences.push("Your spacecraft was built for this, so the penalty was cancelled.");
  } else {
    const months = Math.floor(missionNumber(effect.lose_months));
    if (months > 0) {
      mission.skip_months += months;
      sentences.push("Science stops for " + months + (months === 1 ? " month." : " months."));
    }
    if (typeof effect.science_mult === "number" && effect.science_mult !== 1) {
      mission.science_mult *= effect.science_mult;
      sentences.push("Science is multiplied by " + effect.science_mult + " for the rest of the mission.");
    }
    if (missionNumber(effect.cost_musd) !== 0) {
      mission.extra_cost_musd += effect.cost_musd;
      sentences.push("The mission cost changed by " + effect.cost_musd + " million dollars.");
    }
    if (missionNumber(effect.fail_chance) > 0 && effect.fails) {
      // Thin mass or power margin: the event hits harder.
      let chance = effect.fail_chance;
      if (missionMarginIsThin(mission.launch_margins.mass) || missionMarginIsThin(mission.launch_margins.power)) {
        chance = Math.min(MISSION_MAX_FAIL_CHANCE, chance * MISSION_THIN_MARGIN_FAIL_MULT);
      }
      const candidates = getDesignParts(missionWorkingDesign(mission)).filter(function (part) {
        return part.category === effect.fails;
      });
      // Always roll the dice, even with nothing to break, so the random sequence stays the same.
      const roll = missionRandom(mission);
      if (candidates.length > 0 && roll < chance) {
        const broken = candidates[missionRandomIndex(mission, candidates.length)];
        failedPart = broken.id;
        mission.failed_parts.push(broken.id);
        sentences.push("The " + (broken.name || broken.id) + " failed.");
        // The mission ends early if a required category has no working part left.
        if (MISSION_REQUIRED_CATEGORIES.indexOf(broken.category) !== -1 && candidates.length === 1) {
          mission.ended = true;
          mission.ended_early = true;
          sentences.push("Without it the mission cannot continue.");
        }
      } else {
        sentences.push("Every part survived.");
      }
    }
  }

  mission.pending_event = null;
  mission.events_resolved += 1;
  if (!failedPart) mission.events_clean += 1;
  if (mission.month >= mission.lifetime_months) mission.ended = true;
  if (sentences.length === 0) sentences.push("Nothing changed.");
  return { text: sentences.join(" "), failed_part: failedPart, ended: mission.ended };
}

// Works out the single limiting factor: mass | power | budget | data | event | none.
// 1. An event ended the mission early                      -> event
// 2. The science target was reached                        -> none
// 3. Events cost more science than data loss and eclipse   -> event
// 4. Data loss or eclipse cut the science                  -> data or power, whichever cut more
// 5. A thin margin, checked in this order                  -> power, mass, budget
// 6. Events cost any science at all                        -> event
// 7. Otherwise the tightest known margin (the resource that stopped you adding more); none if unknown.
function missionFindLimitingFactor(mission, target) {
  if (mission.ended_early) return "event";
  if (target > 0 && mission.science >= target) return "none";

  const rate = mission.launch_rate;
  const margins = mission.launch_margins;
  const eventLoss = mission.ideal_science - mission.science;
  // Science the launched design lost to the data and eclipse limits over the months flown.
  const kept = rate.data_share * rate.eclipse_mult;
  const resourceLoss = kept > 0 ? mission.ideal_science / kept - mission.ideal_science : 0;

  if (eventLoss > 0 && eventLoss > resourceLoss) return "event";
  if (rate.data_share < 1 || rate.eclipse_mult < 1) {
    return rate.data_share <= rate.eclipse_mult ? "data" : "power";
  }
  if (missionMarginIsThin(margins.power)) return "power";
  if (missionMarginIsThin(margins.mass)) return "mass";
  if (missionMarginIsThin(margins.budget)) return "budget";
  if (eventLoss > 0) return "event";

  let tightest = "none";
  const names = ["mass", "power", "budget"];
  for (let i = 0; i < names.length; i++) {
    const m = margins[names[i]];
    if (typeof m === "number" && (tightest === "none" || m < margins[tightest])) tightest = names[i];
  }
  return tightest;
}

// Returns { score, stars, limiting, suggestion } plus breakdown, and text / real_mission when the data has them.
function getDebrief(mission) {
  const objective = findById(OBJECTIVES, mission.design.objective);
  const tier = findById(TIERS, mission.design.tier);
  const target = objective ? missionNumber(objective.science_target) : 0;
  const budget = tier ? missionNumber(tier.budget_musd) : 0;

  // Science: share of the target reached, capped at 1 (0 if there is no target).
  const scienceShare = target > 0 ? Math.min(1, Math.max(0, mission.science / target)) : 0;

  // Budget left: share of the tier budget unspent, counting event costs, never below 0.
  const spent = mission.launch_cost_musd + mission.extra_cost_musd;
  const budgetShare = budget > 0 ? Math.min(1, Math.max(0, (budget - spent) / budget)) : 0;

  // Margins: half for a mass margin of 10% or more, half for power.
  const marginShare = (missionMarginIsGood(mission.launch_margins.mass) ? 0.5 : 0) +
                      (missionMarginIsGood(mission.launch_margins.power) ? 0.5 : 0);

  // Events: share survived without losing a part. Full marks if no event fired.
  const eventShare = mission.events_resolved > 0 ? mission.events_clean / mission.events_resolved : 1;

  // Each part is rounded to a whole number so the four parts add up to the score exactly.
  const breakdown = {
    science: Math.round(MISSION_POINTS_SCIENCE * scienceShare),
    budget: Math.round(MISSION_POINTS_BUDGET * budgetShare),
    margins: Math.round(MISSION_POINTS_MARGINS * marginShare),
    events: Math.round(MISSION_POINTS_EVENTS * eventShare)
  };
  const score = breakdown.science + breakdown.budget + breakdown.margins + breakdown.events;

  let stars = 0;
  for (let i = 0; i < MISSION_STAR_SCORES.length; i++) {
    if (score >= MISSION_STAR_SCORES[i]) stars = i + 1;
  }

  const limiting = missionFindLimitingFactor(mission, target);
  let suggestion = MISSION_SUGGESTIONS[limiting];
  // Target missed with no instrument earning science: say so, whatever the tightest resource was.
  const reached = target > 0 && mission.science >= target;
  if (!reached && limiting !== "event" && mission.launch_rate.counted === 0) suggestion = MISSION_SUGGESTION_NO_SCIENCE;

  const debrief = { score: score, stars: stars, limiting: limiting, suggestion: suggestion, breakdown: breakdown };
  if (typeof DEBRIEF !== "undefined" && DEBRIEF && DEBRIEF[limiting]) debrief.text = DEBRIEF[limiting];
  if (objective && objective.real_mission) debrief.real_mission = objective.real_mission;
  return debrief;
}
