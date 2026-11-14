// js/mission.js — Simulation: the month-by-month mission, seeded events,
// scoring, stars and the limiting factor. Uses helpers from game.js.
//
// This file must never touch the page: no `document`, no HTML.
// Console test:
//   var m = startMission(d); var s; do { s = stepMonth(m); if (s.event) chooseEvent(m, 0); } while (!s.ended); getDebrief(m)

var THIN_MARGIN_RISK = 1.5;   // fail chances x1.5 when mass or power margin is under 10%

// ------------------------------------------------------------------ seeded random
// The seed comes from the design, so the same design replays the same mission.
function designSeed(design) {
  var key = [design.tier, design.objective, design.orbit, design.launcher]
    .concat(design.parts.slice().sort()).join("|");
  var h = 2166136261;                       // FNV-1a hash
  for (var i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRandom(seed) {                 // mulberry32
  var a = seed;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Index of a random event, weighted by its orbit_weight for this orbit.
function pickWeighted(pool, orbitId, rand, year) {
  var sn = sunspots(year, null);
  var weights = pool.map(function (e) {
    var w = (e.orbit_weight && orbitId && e.orbit_weight[orbitId] !== undefined) ? e.orbit_weight[orbitId] : 1;
    // Solar storms follow the real solar cycle (SILSO): common in 1958, rare in 1964.
    if (e.id === "solar-storm" && sn !== null) w *= solarActivityFactor(sn);
    return w;
  });
  var total = weights.reduce(function (a, b) { return a + b; }, 0), r = rand() * total;
  for (var i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

// ------------------------------------------------------------------ mission
var missionCounter = 0;

// A copy of the design as it was at launch. Later edits to the player's design
// never change a mission that has already flown.
function copyDesign(design) {
  var copy = { tier: design.tier, objective: design.objective, orbit: design.orbit,
               launcher: design.launcher, parts: design.parts.slice() };
  if (design.campaign) copy.campaign = true;
  return copy;
}

// Returns null if the design still has blockers: nothing launches past the readiness review.
function startMission(design) {
  if (!design || runChecks(design).blockers.length) return null;
  var launchTotals = getTotals(design);   // before any money moves
  design = copyDesign(design);
  missionCounter += 1;

  // Campaign: pay at launch, count the flight, and give each flight fresh luck.
  var flight = 0, scienceBefore = 0;
  var startYear = typeof CAMPAIGN !== "undefined" ? CAMPAIGN.start_year : null;
  if (design.campaign) {
    var c = getCampaign();
    if (!c || c.finished) return null;
    startYear = c.year;
    c.treasury_musd = round(c.treasury_musd - launchTotals.cost_musd, 3);
    c.flights = (c.flights || 0) + 1;
    flight = c.flights;
    scienceBefore = c.knowledge_science[design.objective] || 0;
    saveCampaign(c);
  }

  var orbit = getOrbit(design.orbit);
  var tier = getTier(design.tier);
  var lifetime = orbit ? orbit.lifetime_months : 12;
  // Battery-only satellites fall silent when the battery is spent (Sputnik 1: about 21 days).
  var batteryMonths = batteryLifeMonths(design);
  var batteryLimited = batteryMonths !== null && batteryMonths < lifetime;
  if (batteryLimited) lifetime = Math.max(1, Math.round(batteryMonths));
  var seed = designSeed(design);
  if (flight) seed = (seed ^ Math.imul(flight, 2654435761)) >>> 0;
  var rand = makeRandom(seed);

  // Pick distinct events and distinct months (never month 1 or the last month).
  // Events tied to topics (the optional `objectives` field) fire only on those missions.
  var pool = EVENTS.filter(function (e) { return !e.objectives || e.objectives.indexOf(design.objective) !== -1; });
  var count = Math.min(tier ? tier.events : 1, pool.length, Math.max(0, lifetime - 2));
  var schedule = [];
  var usedMonths = {};
  for (var i = 0; i < count; i++) {
    var ev = pool.splice(pickWeighted(pool, orbit ? orbit.id : null, rand, startYear), 1)[0];
    var month;
    do { month = 2 + Math.floor(rand() * (lifetime - 2)); } while (usedMonths[month]);
    usedMonths[month] = true;
    schedule.push({ month: month, event: ev });
  }
  schedule.sort(function (a, b) { return a.month - b.month; });

  var totals = launchTotals;
  var thin = (totals.margins.mass !== null && totals.margins.mass < LOW_MARGIN) ||
             (totals.margins.power !== null && totals.margins.power < LOW_MARGIN);

  return {
    id: "m" + missionCounter + "-" + seed.toString(36),
    design: design,           // the copy taken at launch
    launch_totals: launchTotals,
    campaign_flight: flight,  // 0 = standalone mission
    science_before: scienceBefore,   // campaign: science already banked on this topic at launch
    rand: rand,
    month: 0,
    lifetime_months: lifetime,
    battery_limited: batteryLimited,   // true: the mission ends when the battery runs down
    start_year: startYear,
    science: 0,
    schedule: schedule,
    pending_event: null,
    events_seen: [],          // { id, title, choice, label, protected, failed_part }
    broken: [],               // ids of parts that have failed
    lost_months: 0,           // months still to skip because of events
    months_lost_total: 0,     // every month an event cost, for the score
    science_mult: 1,          // product of event science_mult effects
    extra_cost_musd: 0,       // costs added by events
    thin_margins: thin,
    // Bookkeeping for the debrief:
    lost: { data: 0, power: 0, event: 0 },
    // Real-world tally against NASA data (data/earth.js):
    real: { fires_in_view: 0, fires_reported: 0, months_mapped: 0, dark_months_mapped: 0 },
    ended: false,
    ended_early: false,
    end_reason: null,
    recorded: null            // the result of recordResult, once called
  };
}

function isProtected(design, eventId) {
  return designParts(design).some(function (p) { return p.protects.indexOf(eventId) !== -1; });
}

// A required category with no working parts ends the mission.
function missingRequired(mission) {
  var working = designParts(mission.design).filter(function (p) {
    return mission.broken.indexOf(p.id) === -1;
  });
  for (var i = 0; i < REQUIRED_CATEGORIES.length; i++) {
    var cat = REQUIRED_CATEGORIES[i];
    if (!working.some(function (p) { return p.category === cat; })) return cat;
  }
  // A battery alone cannot keep a spacecraft alive: it needs a working generator.
  if (!working.some(function (p) { return p.category === "power" && solarPowerW(p) > 0; })) return "power";
  return null;
}

// The event as the screen shows it: each choice carries its real odds right now
// (fail_chance_now), including the thin-margin penalty and any protection on board.
function eventWithOdds(mission, event) {
  if (!event) return null;
  var prot = isProtected(mission.design, event.id);
  return {
    id: event.id, title: event.title, text: event.text,
    choices: event.choices.map(function (c) {
      var fc = (c.effect && c.effect.fail_chance) || 0;
      var now = prot ? 0 : Math.min(0.9, fc * (mission.thin_margins ? THIN_MARGIN_RISK : 1));
      return { label: c.label, effect: c.effect, fail_chance_now: round(now, 2) };
    })
  };
}

function stepMonth(mission) {
  if (!mission) return null;
  if (mission.ended || mission.pending_event) {
    return { month: mission.month, science: round(mission.science, 1),
             event: eventWithOdds(mission, mission.pending_event), ended: mission.ended };
  }
  mission.month += 1;
  var cal = calendarMonth(mission.month);

  // Earn this month's science, unless an event cost us the month.
  var year = mission.start_year === null ? null : mission.start_year + Math.floor((mission.month - 1) / 12);
  var rate = scienceRate(mission.design, mission.broken, cal, year);
  var observing = mission.lost_months === 0;
  tallyRealWorld(mission, rate, cal, observing);
  if (!observing) {
    mission.lost_months -= 1;
    mission.lost.event += rate.per_month * mission.science_mult;
  } else {
    var earned = rate.per_month * mission.science_mult;
    mission.science += earned;
    mission.lost.data += rate.ideal_per_month * (1 - rate.data_share) * mission.science_mult;
    mission.lost.power += rate.ideal_per_month * rate.data_share * (1 - rate.power_share) * mission.science_mult;
  }

  var event = null;
  for (var i = 0; i < mission.schedule.length; i++) {
    if (mission.schedule[i].month === mission.month) event = mission.schedule[i].event;
  }
  if (event) mission.pending_event = event;

  if (!event && mission.month >= mission.lifetime_months) {
    mission.ended = true;
    if (mission.battery_limited) mission.end_cause = "batteries";
  }
  return { month: mission.month, science: round(mission.science, 1), event: eventWithOdds(mission, event), ended: mission.ended,
           calendar_month: cal, month_name: MONTH_NAMES[cal], year: year,
           real: realThisMonth(mission.design.objective, cal, year) };
}

// ------------------------------------------------------------------ real NASA data
var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
                   "August", "September", "October", "November", "December"];

// Mission month 1 is January of the data year (EARTH.start_month), then it cycles.
function calendarMonth(missionMonth) {
  var start = (typeof EARTH !== "undefined" && EARTH.start_month) ? EARTH.start_month : 0;
  return (start + missionMonth - 1) % 12;
}

// What the real Earth looked like this calendar month, for the Mission screen.
function realThisMonth(objectiveId, cal, year) {
  var e = earthFor(objectiveId);
  if (!e) return null;
  if (e.sunspots) {
    var sn = sunspots(year, cal);
    return sn === null ? null : { sunspots: sn, year: year };
  }
  if (e.monthly_share) {
    return { fires: Math.round(e.detections * e.monthly_share[cal]), year: e.year };
  }
  if (e.extent_mkm2) {
    return { ice_extent_mkm2: e.extent_mkm2[cal], ice_average_mkm2: e.extent_1981_2010_mkm2[cal],
             daylight_share: e.daylight_share[cal], year: e.year };
  }
  return null;
}

function tallyRealWorld(mission, rate, cal, observing) {
  var e = earthFor(mission.design.objective);
  if (!e) return;
  var useful = rate.instruments.some(function (i) { return i.points > 0; });
  // How well the best working instrument suits the topic: a camera counts fires
  // at half the rate of a thermal imager (it cannot see through smoke or at night).
  var match = rate.instruments.reduce(function (m, i) { return i.points > 0 ? Math.max(m, i.match) : m; }, 0);
  var quality = rate.data_share * rate.power_share * mission.science_mult * match;
  if (e.monthly_share) {
    var view = e.orbit_view ? (e.orbit_view[mission.design.orbit] || 0) : 1;
    var objective = getObjective(mission.design.objective);
    var looks = objective.orbit_fit ? (objective.orbit_fit[mission.design.orbit] || 0) : 1;  // how often it looks
    var fires = e.detections * e.monthly_share[cal];   // this month's real detections
    mission.real.fires_in_view += fires * view;
    if (observing && useful) mission.real.fires_reported += fires * view * looks * quality;
  }
  if (e.extent_mkm2 && observing && useful) {
    mission.real.months_mapped += 1;
    if (e.daylight_share[cal] === 0) mission.real.dark_months_mapped += 1;
  }
}

// One-paragraph comparison with the real Earth for the Debrief screen.
function realWorldSummary(mission) {
  var e = earthFor(mission.design.objective);
  if (!e) return null;
  if (e.sunspots && mission.start_year !== null) {
    var y0 = mission.start_year, sn0 = sunspots(y0, null), all = [];
    e.sunspots.monthly.forEach(function (row) { all.push(mean(row)); });
    var peak = Math.max.apply(null, all), quiet = Math.min.apply(null, all);
    return {
      year: y0, sunspots: round(sn0, 0),
      text: "In " + y0 + " the Sun averaged " + Math.round(sn0) + " sunspots a month (SILSO, Royal Observatory of Belgium). " +
        "Between " + e.sunspots.start_year + " and " + (e.sunspots.start_year + all.length - 1) + " the yearly average ran from " +
        Math.round(quiet) + " to " + Math.round(peak) + ": the Sun has an 11-year cycle, so when you fly decides how much there is to see. " +
        "The International Geophysical Year was timed for the 1957-58 maximum, the strongest on record."
    };
  }
  if (e.monthly_share) {
    var years = mission.month / 12;
    var seen = mission.real.fires_in_view, reported = mission.real.fires_reported;
    var view = e.orbit_view ? (e.orbit_view[mission.design.orbit] || 0) : 1;
    return {
      fires_per_year: e.detections,
      share_in_view: view,
      fires_reported: Math.round(reported),
      share_reported: seen > 0 ? round(reported / (e.detections * years), 3) : 0,
      text: "In " + e.year + ", NASA's MODIS instruments made " + e.detections.toLocaleString("en-US") +
        " active-fire detections worldwide. From this orbit your satellite could see " + Math.round(view * 100) +
        "% of them. Over " + mission.month + " months it would have reported about " +
        Math.round(reported).toLocaleString("en-US") + " fire detections, " +
        Math.round(100 * reported / (e.detections * Math.max(years, 1 / 12))) + "% of all those NASA recorded."
    };
  }
  if (e.extent_mkm2) {
    var sep = 8, drop = Math.round(100 * (1 - e.extent_mkm2[sep] / e.extent_1981_2010_mkm2[sep]));
    var dark = e.daylight_share.filter(function (x) { return x === 0; }).length;
    return {
      september_extent_mkm2: e.extent_mkm2[sep],
      september_drop_share: drop / 100,
      months_mapped: mission.real.months_mapped,
      dark_months_mapped: mission.real.dark_months_mapped,
      text: "In September " + e.year + ", Arctic sea ice shrank to " + e.extent_mkm2[sep] +
        " million km2, " + drop + "% below the 1981-2010 average (NSIDC). " +
        (mission.real.months_mapped === 0
          ? "Your satellite never mapped the ice."
          : "Your satellite mapped the ice in " + mission.real.months_mapped + " of " + mission.month + " months, " +
            (mission.real.dark_months_mapped
              ? "including " + mission.real.dark_months_mapped + " months of polar night, when only radar can see."
              : "but none in the " + dark + " months of polar night each year, when only radar can see."))
    };
  }
  return null;
}

// `choice` is the index of the chosen option in event.choices.
// Returns what happened: { id, title, choice, label, protected, failed_part,
// ended, ended_early }. failed_part is a part id or null.
function chooseEvent(mission, choice) {
  if (!mission) return null;
  var event = mission.pending_event;
  if (!event) return null;
  // An index outside the list counts as the first choice, and is recorded as such.
  if (typeof choice !== "number" || !event.choices[choice]) choice = 0;
  var picked = event.choices[choice];
  var effect = picked.effect || {};
  var prot = isProtected(mission.design, event.id);

  // Protection cancels the penalty of the riskiest choice (the one with a fail_chance).
  var riskiest = !!(prot && effect.fail_chance);
  var record = { id: event.id, title: event.title, choice: choice, label: picked.label,
                 protected: riskiest, failed_part: null };   // true only when protection applied

  if (!riskiest) {
    if (effect.lose_months) { mission.lost_months += effect.lose_months; mission.months_lost_total += effect.lose_months; }
    if (effect.science_mult) mission.science_mult *= effect.science_mult;
    if (effect.cost_musd) mission.extra_cost_musd += effect.cost_musd;
  }
  if (effect.fail_chance && effect.fails && !riskiest) {
    var chance = effect.fail_chance * (mission.thin_margins ? THIN_MARGIN_RISK : 1);
    if (mission.rand() < Math.min(chance, 0.9)) {
      var victims = designParts(mission.design).filter(function (p) {
        return p.category === effect.fails && mission.broken.indexOf(p.id) === -1;
      });
      if (victims.length) {
        var victim = victims[Math.floor(mission.rand() * victims.length)];
        mission.broken.push(victim.id);
        record.failed_part = victim.id;
      }
    }
  }
  mission.events_seen.push(record);
  mission.pending_event = null;

  var missing = missingRequired(mission);
  if (missing) {
    // Count the science we will now never collect as lost to the event.
    var rate = scienceRate(mission.design, []);
    mission.lost.event += rate.per_month * mission.science_mult * (mission.lifetime_months - mission.month);
    mission.ended = true;
    mission.ended_early = true;
    mission.end_reason = { event: event.id, title: event.title, category: missing };
  } else if (mission.month >= mission.lifetime_months) {
    mission.ended = true;
    if (mission.battery_limited) mission.end_cause = "batteries";
  }
  return { id: record.id, title: record.title, choice: record.choice, label: record.label,
           protected: record.protected, failed_part: record.failed_part,
           ended: mission.ended, ended_early: mission.ended_early };
}

// ------------------------------------------------------------------ debrief
// Score (SPEC.md "Scoring"): science 50, efficiency 15, margins 15, events 10,
// novelty 10. Three stars also need the science target. Lost months and event
// costs count against everything they affect.
var EVENT_PENALTY = { part: 4, month: 1, per_musd: 2 };   // points off the 10 event points

function getDebrief(mission) {
  if (!mission) return null;
  var design = mission.design;
  var objective = getObjective(design.objective);
  var totals = mission.launch_totals || getTotals(design);
  var target = objective ? objective.science_target : 100;

  var k = knowledgeResult(mission);
  var spent = totals.cost_musd + mission.extra_cost_musd;
  var scienceShare = Math.min(1, mission.science / target);
  var efficiency = spent > 0 ? Math.min(1, (k.payout_musd / spent) / 1.5) : 0;
  var massOk = totals.margins.mass !== null && totals.margins.mass >= LOW_MARGIN;
  var powerOk = totals.margins.power !== null && totals.margins.power >= LOW_MARGIN;
  var partsLost = mission.events_seen.filter(function (e) { return e.failed_part; }).length;
  var eventPoints = Math.max(0, 10 - EVENT_PENALTY.part * partsLost - EVENT_PENALTY.month * mission.months_lost_total -
                                EVENT_PENALTY.per_musd * mission.extra_cost_musd);

  var parts = {
    science: round(50 * scienceShare, 1),
    efficiency: round(15 * efficiency, 1),
    margins: (massOk ? 7.5 : 0) + (powerOk ? 7.5 : 0),
    events: round(eventPoints, 1),
    novelty: round(10 * k.novelty, 1)
  };
  var score = Math.round(parts.science + parts.efficiency + parts.margins + parts.events + parts.novelty);
  var stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;
  if (stars === 3 && mission.science < target) stars = 2;   // 3 stars need the target

  var lim = limitingFactor(mission, totals, scienceShare);
  var kp = "";
  if (mission.campaign_flight) {
    if (k.novelty < 0.15) kp = DEBRIEF.saturated || "";
    else if (k.novelty > 0.6 && k.knowledge_before < 0.2) kp = DEBRIEF.breakthrough || "";
  }
  return {
    score: score,
    stars: stars,
    limiting: lim.key,
    suggestion: lim.suggestion,
    // Extra values for the debrief screen:
    breakdown: parts,
    science: round(mission.science, 1),
    science_target: target,
    paragraph: DEBRIEF[lim.key] || "",
    real_mission: objective ? objective.real_mission : "",
    real_world: realWorldSummary(mission),
    events: mission.events_seen,
    ended_early: mission.ended_early,
    payout_musd: k.payout_musd,
    knowledge_before: k.knowledge_before,
    knowledge_after: k.knowledge_after,
    novelty: k.novelty,
    spent_musd: round(spent, 3),
    best_next_topic: mission.campaign_flight ? bestNextTopic(design.objective) : null,
    knowledge_paragraph: kp
  };
}

// ------------------------------------------------------------------ knowledge and payout
// knowledge(S) = 1 - exp(-S / knowledge_scale): the share of a topic the player knows
// after S science points. A model of diminishing returns, not a measured fact.
function knowledgeOf(objective, S) {
  if (!objective || !objective.knowledge_scale) return 0;
  return 1 - Math.exp(-S / objective.knowledge_scale);
}

// Payout for sending home `science` points on a topic where `before` points were already known.
function payoutFor(objective, before, science) {
  var floor = typeof CAMPAIGN !== "undefined" ? CAMPAIGN.repeat_floor_musd : 0;
  var kb = knowledgeOf(objective, before), ka = knowledgeOf(objective, before + science);
  var gain = ka - kb;
  var first = knowledgeOf(objective, science);         // what a first mission would have gained
  var value = objective && objective.value_musd ? objective.value_musd : 0;
  return {
    payout_musd: round(Math.max(value * gain, science > 0 ? floor : 0), 3),
    knowledge_before: round(kb, 3),
    knowledge_after: round(ka, 3),
    novelty: first > 0 ? round(Math.min(1, gain / first), 3) : 0
  };
}

// Without a campaign, a mission is scored as the first one on its topic.
function knowledgeResult(mission) {
  var objective = getObjective(mission.design.objective);
  return payoutFor(objective, mission.campaign_flight ? mission.science_before : 0, mission.science);
}

// The open topic that would pay the most for a typical mission (its science target).
function bestNextTopic(currentId) {
  var c = getCampaign();
  if (!c) return null;
  var best = null, bestPay = -1;
  OBJECTIVES.forEach(function (o) {
    if (!isObjectiveAvailable(o.id)) return;
    var pay = payoutFor(o, c.knowledge_science[o.id] || 0, o.science_target).payout_musd;
    if (pay > bestPay) { bestPay = pay; best = o.id; }
  });
  return best;
}

// The single thing that most limited the mission, and one concrete change.
// Every suggestion must be something the player can actually do: never a part
// that is already fitted, and the orbit is named when the orbit is the problem.
function limitingFactor(mission, totals, scienceShare) {
  var design = mission.design;
  var fitted = function (id) { return design.parts.indexOf(id) !== -1; };
  var objective = getObjective(design.objective);
  var orbit = getOrbit(design.orbit);

  if (mission.ended_early) {
    var r = mission.end_reason;
    var guard = PARTS.filter(function (p) { return p.protects.indexOf(r.event) !== -1 && !fitted(p.id); })[0];
    return { key: "event", suggestion: "The " + r.title.toLowerCase() + " knocked out your only working " + r.category +
      " part. " + (guard ? "Fly the " + guard.name.toLowerCase() + ", which guards against it, or carry a spare."
                         : "Carry a spare " + r.category + " part, or pick the safer option next time.") };
  }

  // A battery-only satellite that fell silent: the history lesson that leads to solar cells.
  if (mission.end_cause === "batteries" && scienceShare < 1) {
    var cells = PARTS.filter(function (p) { return p.category === "power" && solarPowerW(p) > 0 && isPartAvailable(p.id); })[0];
    return { key: "power", suggestion: "Your batteries ran down after " + mission.month + " month" + (mission.month > 1 ? "s" : "") +
      " and the satellite fell silent, as Sputnik 1 did after 21 days. " +
      (cells ? "Fit the " + cells.name.toLowerCase() + " so the Sun keeps it running." : "Solar cells would keep it running: research them.") };
  }

  // An orbit that cannot see the target at all comes before everything else.
  if (objective && orbit && objective.orbit_fit && objective.orbit_fit[orbit.id] === 0) {
    var better = bestOrbitFor(objective);
    return { key: "design", suggestion: "From " + orbit.name.toLowerCase() + " the spacecraft cannot see what " +
      objective.name.toLowerCase() + " needs. Fly in " + better.name.toLowerCase() + " instead." };
  }

  var lost = mission.lost;
  var biggest = Math.max(lost.data, lost.power, lost.event);
  var potential = mission.science + lost.data + lost.power + lost.event;
  if (biggest > 0.05 * potential && scienceShare < 1) {
    if (biggest === lost.data) {
      var fastest = PARTS.filter(function (p) { return p.category === "comms"; })
        .sort(function (a, b) { return b.downlink_gb_day - a.downlink_gb_day; })[0];
      var head = "Only " + totals.data_returned_gb_day + " of " + totals.data_gb_day + " GB a day reached the ground. ";
      return { key: "data", suggestion: head + (fitted(fastest.id)
        ? "Your " + fastest.name + " is already the fastest radio, so fly an orbit with longer ground contact, or carry fewer data-hungry instruments."
        : "Fit the " + fastest.name + ", or fly an orbit with longer ground contact.") };
    }
    if (biggest === lost.power) {
      var battery = PARTS.filter(function (p) { return p.battery_wh; })
        .sort(function (a, b) { return b.battery_wh - a.battery_wh; })[0];
      var short = totals.power_gen_w < totals.power_draw_w;
      if (short) {
        return { key: "power", suggestion: "Your panels make " + totals.power_gen_w + " W but the parts draw " +
          totals.power_draw_w + " W. Add or enlarge a solar panel, or cut the draw." };
      }
      return { key: "power", suggestion: battery && !fitted(battery.id)
        ? "Your instruments switched off in Earth's shadow. Add the " + battery.name.toLowerCase() + " to carry them through the eclipse."
        : "Your battery is the largest available but still too small for a " + totals.power_draw_w +
          " W spacecraft in shadow. Cut the draw: drop an instrument, or choose lighter-drawing parts." };
    }
    return { key: "event", suggestion: "Events cost you months of observing. Protective parts, or the safer choice, keep the mission running." };
  }

  if (scienceShare < 1) {
    if (totals.margins.budget !== null && totals.margins.budget < LOW_MARGIN) {
      return { key: "budget", suggestion: "You spent " + Math.round((1 - totals.margins.budget) * 100) +
        "% of the budget. A cheaper rocket, such as a rideshare, frees money for better instruments." };
    }
    if (totals.margins.mass !== null && totals.margins.mass < LOW_MARGIN) {
      return { key: "mass", suggestion: "The rocket was nearly full. A bigger launcher or lighter parts would give you room." };
    }
    var rate = scienceRate(design, []);
    var weak = rate.instruments.filter(function (i) { return i.match === 0 || !i.sharp_enough; });
    if (weak.length) {
      return { key: "design", suggestion: "Some instruments earned nothing: wrong type for this objective, or too blurry from this orbit. Swap them for ones that suit it." };
    }
    // A wanted instrument type nobody carries is the cheapest way to more science.
    var carried = designParts(design).filter(function (p) { return p.category === "instrument"; })
      .reduce(function (tags, p) { return tags.concat(p.tags); }, []);
    var missingTag = objective ? objective.wants.filter(function (t) { return carried.indexOf(t) === -1; })[0] : null;
    var extra = missingTag ? PARTS.filter(function (p) { return p.category === "instrument" && p.tags.indexOf(missingTag) !== -1; })[0] : null;
    if (extra) {
      return { key: "design", suggestion: "Nothing ran short, but one instrument was not enough. Add the " +
        extra.name.toLowerCase() + " as well; this objective counts it too." };
    }
    var best = bestOrbitFor(objective);
    return { key: "design", suggestion: best.id !== design.orbit
      ? "Nothing ran short, but the science fell below target. " + best.name + " suits this objective better."
      : "Nothing ran short, and this is already the best orbit for this objective. A longer-lived or sharper design is the only way up." };
  }
  return { key: "none", suggestion: "Target reached. Try the next tier, or reach it on a smaller budget." };
}

// The orbit where instruments earn the most for this objective: science
// multiplier x how often it looks x share of real targets in view.
function bestOrbitFor(objective) {
  var e = objective ? earthFor(objective.id) : null;
  return ORBITS.slice().sort(function (a, b) {
    function value(o) {
      var fit = objective && objective.orbit_fit ? (objective.orbit_fit[o.id] || 0) : 1;
      var view = e && e.orbit_view && e.orbit_view[o.id] !== undefined ? e.orbit_view[o.id] : 1;
      return o.science_mult * fit * view * o.lifetime_months;
    }
    return value(b) - value(a);
  })[0];
}

// ------------------------------------------------------------------ progress
// Two stars on a tier unlocks the next one (SPEC.md, "Difficulty tiers").
// Saved in localStorage when the browser allows it; otherwise kept in memory
// for this visit only, so the game still runs in a private window or in Node.
var PROGRESS_KEY = "smdg-progress-v1";
var memoryProgress = null;

function emptyProgress() { return { best_stars: {}, best_score: {} }; }

function getProgress() {
  try {
    if (typeof localStorage !== "undefined") {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) { /* storage blocked: fall through to memory */ }
  return memoryProgress || emptyProgress();
}

function saveProgress(p) {
  memoryProgress = p;
  try { if (typeof localStorage !== "undefined") localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }
  catch (e) { /* storage blocked: memory copy still works */ }
}

function isTierUnlocked(tierId) {
  var i = TIERS.map(function (t) { return t.id; }).indexOf(tierId);
  if (i <= 0) return i === 0;
  return (getProgress().best_stars[TIERS[i - 1].id] || 0) >= 2;
}

// Call once when a mission ends. Returns { stars, best_stars, unlocked }
// where `unlocked` is the id of a tier this result just opened, or null.
function recordResult(mission) {
  if (!mission || !mission.ended) return null;           // only finished missions count
  if (mission.recorded) return mission.recorded;         // a second call changes nothing
  var tierId = mission.design.tier;
  var d = getDebrief(mission);
  var p = getProgress();
  var i = TIERS.map(function (t) { return t.id; }).indexOf(tierId);
  var nextId = TIERS[i + 1] ? TIERS[i + 1].id : null;
  var wasLocked = nextId ? !isTierUnlocked(nextId) : false;
  p.best_stars[tierId] = Math.max(p.best_stars[tierId] || 0, d.stars);
  p.best_score[tierId] = Math.max(p.best_score[tierId] || 0, d.score);
  saveProgress(p);
  mission.recorded = { stars: d.stars, best_stars: p.best_stars[tierId],
                       unlocked: nextId && wasLocked && isTierUnlocked(nextId) ? nextId : null };
  if (mission.campaign_flight) settleCampaign(mission, d, mission.recorded);
  return mission.recorded;
}

function resetProgress() { saveProgress(emptyProgress()); }

// ------------------------------------------------------------------ campaign
// One saved campaign per browser (SPEC.md, "Scoring" and "Functions"). Saved in
// localStorage when allowed, otherwise in memory; a save from another version is discarded.
var CAMPAIGN_KEY = "smdg-campaign";
var memoryCampaign = null;
var cheapestCache = {};

function campaignVersion() { return typeof CAMPAIGN !== "undefined" ? CAMPAIGN.save_version : 1; }

function getCampaign() {
  var c = null;
  try {
    if (typeof localStorage !== "undefined") {
      var raw = localStorage.getItem(CAMPAIGN_KEY);
      if (raw) c = JSON.parse(raw);
    }
  } catch (e) { c = null; }
  if (!c) c = memoryCampaign;
  if (!c || c.version !== campaignVersion()) return null;
  return c;
}

function saveCampaign(c) {
  memoryCampaign = c;
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(c)); }
  catch (e) { /* storage blocked: memory copy still works */ }
}

function resetCampaign() {
  memoryCampaign = null;
  try { if (typeof localStorage !== "undefined") localStorage.removeItem(CAMPAIGN_KEY); } catch (e) {}
}

function newCampaign(tierId) {
  var tier = getTier(tierId) || TIERS[0];
  var knowledge = {};
  OBJECTIVES.forEach(function (o) { knowledge[o.id] = 0; });
  var c = {
    version: campaignVersion(),
    tier: tier.id,
    year: typeof CAMPAIGN !== "undefined" ? CAMPAIGN.start_year : 0,
    treasury_musd: tier.budget_musd,
    knowledge_science: knowledge,
    research: [],
    lessons: [],
    missions: [],
    flights: 0,
    finished: false,
    won: false
  };
  saveCampaign(c);
  return c;
}

function newCampaignDesign() {
  var c = getCampaign();
  if (!c || c.finished) return null;
  var d = newDesign(c.tier);
  d.campaign = true;
  return d;
}

function grantFor(c) {
  var tier = getTier(c.tier);
  if (tier && tier.grant_musd !== undefined) return tier.grant_musd;
  return typeof CAMPAIGN !== "undefined" ? CAMPAIGN.grant_musd : 0;
}

// The cheapest design that can launch for any open topic, found by search (never a
// hard-coded number). Used to prevent soft locks. Parts are tried in price order and a
// branch stops as soon as it cannot beat the best design found, so it stays fast
// (a few milliseconds) even with every part unlocked. Battery-only designs count.
function cheapestLaunchCost(c) {
  var key = c.research.slice().sort().join(",");
  if (cheapestCache[key] !== undefined) return cheapestCache[key];
  function byCost(list) { return list.slice().sort(function (a, b) { return a.cost_musd - b.cost_musd; }); }
  function avail(cat) { return byCost(PARTS.filter(function (p) { return p.category === cat && isPartAvailable(p.id); })); }
  var power = avail("power"), comms = avail("comms"), comp = avail("computer"), prop = [null].concat(avail("propulsion"));
  var launchers = byCost(LAUNCHERS.filter(function (l) { return isLauncherAvailable(l.id); }));
  var best = Infinity;
  OBJECTIVES.forEach(function (o) {
    if (!isObjectiveAvailable(o.id)) return;
    var ins = avail("instrument").filter(function (p) {
      return p.tags.some(function (t) { return o.wants.indexOf(t) !== -1; });
    });
    ORBITS.forEach(function (orb) {
      if (o.orbit_fit && !o.orbit_fit[orb.id]) return;
      for (var a = 0; a < ins.length; a++) {
        var c1 = ins[a].cost_musd; if (c1 >= best) break;
        for (var b = 0; b < power.length; b++) {
          var c2 = c1 + power[b].cost_musd; if (c2 >= best) break;
          for (var e = 0; e < comms.length; e++) {
            var c3 = c2 + comms[e].cost_musd; if (c3 >= best) break;
            for (var f = 0; f < comp.length; f++) {
              var c4 = c3 + comp[f].cost_musd; if (c4 >= best) break;
              for (var g = 0; g < prop.length; g++) {
                var c5 = c4 + (prop[g] ? prop[g].cost_musd : 0); if (c5 >= best) continue;
                for (var h = 0; h < launchers.length; h++) {
                  var cost = c5 + launchers[h].cost_musd; if (cost >= best) break;
                  var d = { tier: c.tier, objective: o.id, orbit: orb.id, launcher: launchers[h].id,
                            parts: [ins[a].id, power[b].id, comms[e].id, comp[f].id].concat(prop[g] ? [prop[g].id] : []) };
                  var blockers = runChecks(d).blockers.filter(function (x) { return x.id !== "budget"; });
                  if (!blockers.length && scienceRate(d, []).per_month > 0) { best = cost; break; }
                }
              }
            }
          }
        }
      }
    });
  });
  best = round(best, 3);
  cheapestCache[key] = best;
  return best;
}

// Called once from recordResult for a campaign mission.
function settleCampaign(mission, debrief, result) {
  var c = getCampaign();
  if (!c) return;
  var obj = mission.design.objective;
  var grant = grantFor(c);
  c.knowledge_science[obj] = (c.knowledge_science[obj] || 0) + mission.science;
  c.treasury_musd = round(c.treasury_musd + debrief.payout_musd + grant - mission.extra_cost_musd, 3);
  var yearFlown = c.year;
  c.year += typeof CAMPAIGN !== "undefined" ? CAMPAIGN.years_per_mission : 1;
  var newLessons = lessonsFrom(mission, debrief, c).filter(function (l) { return c.lessons.indexOf(l) === -1; });
  c.lessons = c.lessons.concat(newLessons);
  c.missions.push({ id: mission.id, year: yearFlown, objective: obj, orbit: mission.design.orbit,
                    spent_musd: debrief.spent_musd, science: round(mission.science, 1),
                    payout_musd: debrief.payout_musd, stars: debrief.stars });

  // Win: enough topics known well enough (every topic, if there are fewer).
  var win = typeof CAMPAIGN !== "undefined" ? CAMPAIGN.win : { topics_known: 3, knowledge: 0.6 };
  var needed = Math.min(win.topics_known, OBJECTIVES.length);
  var known = OBJECTIVES.filter(function (o) { return knowledgeOf(o, c.knowledge_science[o.id] || 0) >= win.knowledge; }).length;
  if (known >= needed) { c.finished = true; c.won = true; }
  else if (typeof CAMPAIGN !== "undefined" && c.year >= CAMPAIGN.end_year) { c.finished = true; }

  // Never soft-locked: top the treasury up to the cheapest launchable design.
  var bailout = 0;
  if (!c.finished) {
    var cheapest = cheapestLaunchCost(c);
    if (isFinite(cheapest) && c.treasury_musd < cheapest) {
      bailout = round(cheapest - c.treasury_musd, 3);
      c.treasury_musd = round(cheapest, 3);
    }
  }
  saveCampaign(c);

  result.payout_musd = debrief.payout_musd;
  result.grant_musd = grant;
  result.event_costs_musd = round(mission.extra_cost_musd, 3);
  result.knowledge_before = debrief.knowledge_before;
  result.knowledge_after = debrief.knowledge_after;
  result.novelty = debrief.novelty;
  result.treasury_musd = c.treasury_musd;
  result.year = c.year;
  result.bailout = bailout > 0;
  result.bailout_musd = bailout;
  result.campaign_over = c.finished;
  result.won = c.won;
  result.lessons_new = newLessons;
}

function getHubInfo() {
  var c = getCampaign();
  if (!c) return null;
  return {
    year: c.year,
    treasury_musd: c.treasury_musd,
    topics: OBJECTIVES.map(function (o) {
      var S = c.knowledge_science[o.id] || 0;
      var open = isObjectiveAvailable(o.id);
      return {
        id: o.id, name: o.name, available: open,
        knowledge: round(knowledgeOf(o, S), 3),
        science_so_far: round(S, 1),
        next_payout_estimate_musd: payoutFor(o, S, o.science_target).payout_musd,
        locked_reason: open ? null : "Needs " + researchNameFor("objectives", o.id)
      };
    }),
    lessons: c.lessons.map(function (id) { return { id: id, name: LESSONS[id] || id }; }),
    research: (typeof RESEARCH === "undefined" ? [] : RESEARCH).map(function (r) {
      var owned = c.research.indexOf(r.id) !== -1;
      var missing = researchMissing(r, c);
      var met = missing.filter(function (m) { return m.kind !== "money"; }).length === 0;
      return { id: r.id, name: r.name, year: r.year, depth: researchDepth(r.id), cost_musd: r.cost_musd, blurb: r.blurb,
               owned: owned, requires: r.requires || [], requires_met: met, affordable: !owned && missing.length === 0,
               missing: owned ? [] : missing.map(function (m) { return m.text; }), unlocks_names: unlockNames(r) };
    }),
    missions: c.missions,
    finished: c.finished,
    won: c.won
  };
}

function buyResearch(id) {
  var c = getCampaign();
  if (!c) return { ok: false, reason: "No campaign is running." };
  if (c.finished) return { ok: false, reason: "The campaign is over." };
  var r = typeof RESEARCH === "undefined" ? null : RESEARCH.filter(function (x) { return x.id === id; })[0];
  if (!r) return { ok: false, reason: "No such research." };
  if (c.research.indexOf(id) !== -1) return { ok: false, reason: "Already owned." };
  var missing = researchMissing(r, c);
  if (missing.length) return { ok: false, reason: missing.map(function (m) { return m.text; }).join(" ") };
  c.treasury_musd = round(c.treasury_musd - r.cost_musd, 3);
  c.research.push(id);
  saveCampaign(c);
  return { ok: true, reason: null };
}

// What a design would earn if it flies as planned (for the Build screen).
function previewPayout(design) {
  var objective = getObjective(design.objective);
  var c = design.campaign ? getCampaign() : null;
  var before = c ? (c.knowledge_science[design.objective] || 0) : 0;
  var cost = getTotals(design).cost_musd;
  var k = payoutFor(objective, before, previewScience(design).total);
  return { expected_payout_musd: k.payout_musd, knowledge_before: k.knowledge_before,
           knowledge_after: k.knowledge_after, novelty: k.novelty,
           cost_musd: cost, net_musd: round(k.payout_musd - cost, 3) };
}

// ------------------------------------------------------------------ save codes
// One save per browser, plus export and import codes (clicker-game style).
// Code: "SMDG1." + base64(JSON) + "." + checksum. Length does not matter.
function checksum(text) {
  var h = 2166136261;
  for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function toBase64(text) { return btoa(unescape(encodeURIComponent(text))); }
function fromBase64(b64) { return decodeURIComponent(escape(atob(b64))); }

function exportSave() {
  var body = JSON.stringify({ v: campaignVersion(), campaign: getCampaign(), progress: getProgress() });
  return "SMDG1." + toBase64(body) + "." + checksum(body);
}

function importSave(code) {
  try {
    var parts = String(code || "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "SMDG1") return { ok: false, reason: "That is not a save code." };
    var body = fromBase64(parts[1]);
    if (checksum(body) !== parts[2]) return { ok: false, reason: "The code is damaged or incomplete." };
    var data = JSON.parse(body);
    if (data.v !== campaignVersion()) return { ok: false, reason: "The code is from another version of the game." };
    if (data.campaign && data.campaign.version !== campaignVersion()) return { ok: false, reason: "The campaign is from another version." };
    if (!data.progress || typeof data.progress.best_stars !== "object") return { ok: false, reason: "The code has no progress in it." };
    saveProgress(data.progress);
    if (data.campaign) { saveCampaign(data.campaign); cheapestCache = {}; } else resetCampaign();
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: "The code could not be read." };
  }
}

// ------------------------------------------------------------------ research tree and lessons
// Best practices the player must show in flight before some research opens (SPEC.md, "Lessons").
var LESSONS = {
  margins: "Flew with 10% mass and power margins",
  all_data: "Sent home all the data its instruments made",
  three_stars: "Earned 3 stars",
  storm_survived: "Met a solar storm and lost no part",
  "protected": "A part on board cancelled an event's penalty",
  spare: "Carried a spare in a required category",
  batteries_ran_out: "Watched a satellite fall silent when its batteries ran down",
  new_topic: "Flew on a second topic"
};

// The lessons one recorded mission demonstrates.
function lessonsFrom(mission, debrief, c) {
  var out = [], t = mission.launch_totals;
  if (t.margins.mass !== null && t.margins.mass >= LOW_MARGIN && t.margins.power !== null && t.margins.power >= LOW_MARGIN) out.push("margins");
  if (t.data_gb_day > 0 && t.data_returned_gb_day >= t.data_gb_day) out.push("all_data");
  if (debrief.stars === 3) out.push("three_stars");
  if (mission.events_seen.some(function (e) { return e.id === "solar-storm" && !e.failed_part; })) out.push("storm_survived");
  if (mission.events_seen.some(function (e) { return e.protected; })) out.push("protected");
  var counts = {};
  designParts(mission.design).forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
  if (REQUIRED_CATEGORIES.some(function (cat) { return (counts[cat] || 0) >= 2; })) out.push("spare");
  if (mission.end_cause === "batteries") out.push("batteries_ran_out");
  var topics = {};
  c.missions.forEach(function (m) { topics[m.objective] = true; });
  topics[mission.design.objective] = true;
  if (Object.keys(topics).length >= 2) out.push("new_topic");
  return out;
}

function researchById(id) {
  return typeof RESEARCH === "undefined" ? null : RESEARCH.filter(function (r) { return r.id === id; })[0] || null;
}

// What still stands between the player and this research, as { kind, text } items.
function researchMissing(r, c) {
  var out = [];
  (r.requires || []).forEach(function (q) {
    if (c.research.indexOf(q) === -1) { var rq = researchById(q); out.push({ kind: "research", text: "Needs " + (rq ? rq.name : q) + "." }); }
  });
  (r.requires_lessons || []).forEach(function (l) {
    if (c.lessons.indexOf(l) === -1) out.push({ kind: "lesson", text: "Show in flight: " + (LESSONS[l] || l) + "." });
  });
  var rk = r.requires_knowledge || {};
  Object.keys(rk).forEach(function (topic) {
    var o = getObjective(topic), k = knowledgeOf(o, c.knowledge_science[topic] || 0);
    if (k < rk[topic]) out.push({ kind: "knowledge", text: "Know " + Math.round(rk[topic] * 100) + "% of the topic " +
      (o ? o.name : topic) + " (now " + Math.round(k * 100) + "%)." });
  });
  if (c.treasury_musd < r.cost_musd) out.push({ kind: "money", text: "Costs $" + r.cost_musd + "M." });
  return out;
}

// Longest chain of prerequisites, so a tree screen can put each node in a column.
function researchDepth(id, seen) {
  seen = seen || {};
  if (seen[id]) return 0;            // guards against a cycle in the data
  seen[id] = true;
  var r = researchById(id);
  if (!r || !(r.requires || []).length) return 0;
  return 1 + Math.max.apply(null, r.requires.map(function (q) { return researchDepth(q, Object.assign({}, seen)); }));
}

function unlockNames(r) {
  var u = r.unlocks || {}, out = [];
  (u.parts || []).forEach(function (id) { var p = getPart(id); out.push(p ? p.name : id); });
  (u.launchers || []).forEach(function (id) { var l = getLauncher(id); out.push(l ? l.name : id); });
  (u.objectives || []).forEach(function (id) { var o = getObjective(id); out.push(o ? "Topic: " + o.name : id); });
  OBJECTIVES.forEach(function (o) { if (o.requires_research === r.id) out.push("Topic: " + o.name); });
  return out;
}
