// js/game.js — Rules: totals, the eight formulas, blockers and warnings.
//
// This file must never touch the page: no `document`, no HTML.
// Test it from the browser console, for example:
//   var d = newDesign("training"); setOrbit(d, "sso"); addPart(d, "sar-radar"); getTotals(d)

// ------------------------------------------------------------------ constants
var MU = 3.986e14;          // Earth's gravitational parameter, m^3/s^2
var R_EARTH_KM = 6371;      // Earth's radius, km
var G0 = 9.81;              // standard gravity, m/s^2
var SUN_W_M2 = 1361;        // sunlight above the atmosphere, W/m^2
var DOD = 0.3;              // battery depth of discharge (formula 5)
var LOW_MARGIN = 0.10;      // margins under 10% raise a warning
var REQUIRED_CATEGORIES = ["instrument", "power", "comms", "computer"];

// ------------------------------------------------------------------ lookups
function findById(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function getPart(id)      { return findById(PARTS, id); }
function getOrbit(id)     { return findById(ORBITS, id); }
function getLauncher(id)  { return findById(LAUNCHERS, id); }
function getObjective(id) { return findById(OBJECTIVES, id); }
function getTier(id)      { return findById(TIERS, id); }

function designParts(design) {
  return design.parts.map(getPart).filter(function (p) { return p; });
}
function sum(list, fn) {
  var t = 0;
  for (var i = 0; i < list.length; i++) t += fn(list[i]) || 0;
  return t;
}
function round(x, places) {
  var f = Math.pow(10, places || 0);
  return Math.round(x * f) / f;
}

// ------------------------------------------------------------------ design edits
function newDesign(tierId) {
  return {
    tier: tierId || "training",
    objective: null,
    orbit: null,
    parts: [],        // list of part ids
    launcher: null
  };
}
function setObjective(design, id) { design.objective = id; return design; }
function setOrbit(design, id)     { design.orbit = id; return design; }
function setLauncher(design, id)  { design.launcher = id; return design; }
function addPart(design, partId) {
  if (getPart(partId) && design.parts.indexOf(partId) === -1) design.parts.push(partId);
  return design;
}
function removePart(design, partId) {
  design.parts = design.parts.filter(function (id) { return id !== partId; });
  return design;
}

// ------------------------------------------------------------------ the eight formulas

// 1. Rocket equation: dv = Isp g0 ln(m_full / m_empty)
function rocketDeltaV(ispS, mFullKg, fuelKg) {
  if (!ispS || fuelKg <= 0 || mFullKg <= fuelKg) return 0;
  return ispS * G0 * Math.log(mFullKg / (mFullKg - fuelKg));
}

// 2. Orbital speed and period, r = R + h
function orbitRadiusM(altitudeKm) { return (R_EARTH_KM + altitudeKm) * 1000; }
function orbitalSpeedMs(altitudeKm) { return Math.sqrt(MU / orbitRadiusM(altitudeKm)); }
function orbitalPeriodS(altitudeKm) {
  var r = orbitRadiusM(altitudeKm);
  return 2 * Math.PI * Math.sqrt(r * r * r / MU);
}

// 3. Solar power: P = S A eta cos(theta), theta = 0
function solarPowerW(part) {
  if (!part.panel_area_m2 || !part.efficiency) return part.power_gen_w || 0;
  return SUN_W_M2 * part.panel_area_m2 * part.efficiency;
}

// 4. Eclipse fraction: f = (1/pi) asin(R / (R + h))
function eclipseFraction(altitudeKm) {
  return Math.asin(R_EARTH_KM / (R_EARTH_KM + altitudeKm)) / Math.PI;
}

// 5. Battery size: E = P_load t_eclipse / DoD   (Wh, with t in hours)
function batteryNeededWh(loadW, altitudeKm) {
  var eclipseH = eclipseFraction(altitudeKm) * orbitalPeriodS(altitudeKm) / 3600;
  return loadW * eclipseH / DOD;
}

// 6. Image resolution: x = 1.22 lambda h / D. Radar builds a synthetic aperture,
//    so the formula does not apply to it and we return null.
function resolutionM(part, altitudeKm) {
  if (!part.aperture_m || !part.wavelength_m) return null;
  if (part.tags.indexOf("radar") !== -1) return null;
  return 1.22 * part.wavelength_m * altitudeKm * 1000 / part.aperture_m;
}

// 7. Data budget: returned = min(produced, downlink x c)
function dataReturnedGbDay(producedGb, downlinkGb, contactShare) {
  return Math.min(producedGb, downlinkGb * contactShare);
}

// 8. Margin = (capacity - used) / capacity
function margin(capacity, used) {
  if (!capacity) return null;
  return (capacity - used) / capacity;
}

// ------------------------------------------------------------------ totals
function getTotals(design) {
  var parts = designParts(design);
  var orbit = getOrbit(design.orbit);
  var launcher = getLauncher(design.launcher);
  var tier = getTier(design.tier);

  var mass = sum(parts, function (p) { return p.mass_kg; });
  var draw = sum(parts, function (p) { return p.power_draw_w; });
  var gen = sum(parts, function (p) { return p.category === "power" ? solarPowerW(p) : 0; });
  var partsCost = sum(parts, function (p) { return p.cost_musd; });
  var cost = partsCost + (launcher ? launcher.cost_musd : 0);
  var produced = sum(parts, function (p) { return p.data_gb_day; });
  var downlink = sum(parts, function (p) { return p.downlink_gb_day; });
  var batteryWh = sum(parts, function (p) { return p.battery_wh; });

  // Rocket equation with every propulsion part burning together:
  // effective Isp = total impulse / (total fuel x g0).
  var props = parts.filter(function (p) { return p.category === "propulsion"; });
  var fuel = sum(props, function (p) { return p.fuel_kg; });
  var impulse = sum(props, function (p) { return p.fuel_kg * p.isp_s * G0; });
  var ispEff = fuel > 0 ? impulse / (fuel * G0) : 0;
  var deltaV = rocketDeltaV(ispEff, mass, fuel);

  var capacity = (launcher && orbit) ? launcher.capacity_kg[orbit.id] : 0;
  var returned = orbit ? dataReturnedGbDay(produced, downlink, orbit.downlink_mult) : 0;

  return {
    mass_kg: round(mass, 2),
    power_draw_w: round(draw, 1),
    power_gen_w: round(gen, 1),
    cost_musd: round(cost, 3),
    data_gb_day: round(produced, 2),
    downlink_gb_day: round(downlink, 2),
    delta_v_ms: round(deltaV, 0),
    margins: {
      mass: capacity ? round(margin(capacity, mass), 3) : null,
      power: gen ? round(margin(gen, draw), 3) : null,
      budget: tier ? round(margin(tier.budget_musd, cost), 3) : null
    },
    // Extra values so the screens never do maths:
    data_returned_gb_day: round(returned, 2),
    battery_wh: batteryWh,
    capacity_kg: capacity,
    budget_musd: tier ? tier.budget_musd : 0
  };
}

// ------------------------------------------------------------------ orbit facts
function getOrbitFacts(design) {
  var orbit = getOrbit(design.orbit);
  if (!orbit) return { period_min: null, laps_per_day: null, eclipse_fraction: null };
  var h = orbit.altitude_km;
  var periodS = orbitalPeriodS(h);
  var f = eclipseFraction(h);
  var res = {};
  designParts(design).forEach(function (p) {
    if (p.category === "instrument") {
      var x = resolutionM(p, h);
      res[p.id] = x === null ? null : round(x, x < 10 ? 1 : 0);
    }
  });
  return {
    period_min: round(periodS / 60, 1),
    laps_per_day: round(86400 / periodS, 1),
    eclipse_fraction: round(f, 3),
    // Extra values for the orbit and instrument cards:
    eclipse_min: round(f * periodS / 60, 1),
    speed_kms: round(orbitalSpeedMs(h) / 1000, 2),
    resolution_m: res,  // per instrument id; null = radar (formula does not apply)
    battery_needed_wh: round(batteryNeededWh(getTotals(design).power_draw_w, h), 0)
  };
}

// ------------------------------------------------------------------ science rate
// Science per month for a design, before events. mission.js uses this too.
// `brokenIds` lists parts that have failed during a mission.
function scienceRate(design, brokenIds) {
  brokenIds = brokenIds || [];
  var orbit = getOrbit(design.orbit);
  var objective = getObjective(design.objective);
  var result = { per_month: 0, ideal_per_month: 0, data_share: 1, power_share: 1, instruments: [] };
  if (!orbit || !objective) return result;

  var parts = designParts(design).filter(function (p) { return brokenIds.indexOf(p.id) === -1; });
  var h = orbit.altitude_km;
  var fit = objective.orbit_fit ? (objective.orbit_fit[orbit.id] || 0) : 1;

  // Data: science counts in proportion to data returned (formula 7).
  var produced = sum(parts, function (p) { return p.data_gb_day; });
  var downlink = sum(parts, function (p) { return p.downlink_gb_day; });
  var returned = dataReturnedGbDay(produced, downlink, orbit.downlink_mult);
  var dataShare = produced > 0 ? returned / produced : 0;

  // Power: too small a battery switches instruments off in shadow (formula 5).
  var draw = sum(parts, function (p) { return p.power_draw_w; });
  var battery = sum(parts, function (p) { return p.battery_wh; });
  var powerShare = battery >= batteryNeededWh(draw, h) ? 1 : 1 - eclipseFraction(h);

  var ideal = 0;
  parts.forEach(function (p) {
    if (p.category !== "instrument") return;
    var match = 0;   // first wanted tag counts fully, later ones half
    objective.wants.forEach(function (tag, i) {
      if (p.tags.indexOf(tag) !== -1) match = Math.max(match, i === 0 ? 1 : 0.5);
    });
    var x = resolutionM(p, h);
    var sharpEnough = !objective.needs_resolution_m || x === null || x <= objective.needs_resolution_m;
    var pts = p.science * orbit.science_mult * fit * match * (sharpEnough ? 1 : 0);
    result.instruments.push({ id: p.id, match: match, sharp_enough: sharpEnough, points: round(pts, 2) });
    ideal += pts;
  });

  result.ideal_per_month = ideal;
  result.data_share = dataShare;
  result.power_share = powerShare;
  result.per_month = ideal * dataShare * powerShare;
  return result;
}

// ------------------------------------------------------------------ checks
function runChecks(design) {
  var blockers = [];
  var warnings = [];
  var t = getTotals(design);
  var parts = designParts(design);
  var orbit = getOrbit(design.orbit);
  var launcher = getLauncher(design.launcher);
  var objective = getObjective(design.objective);
  var tier = getTier(design.tier);
  function block(id, text) { blockers.push({ id: id, text: text }); }
  function warn(id, text) { warnings.push({ id: id, text: text }); }

  if (!objective) block("no-objective", "Pick a science objective on the Briefing screen.");
  if (!orbit) block("no-orbit", "Pick an orbit.");
  if (!launcher) block("no-launcher", "Pick a launch vehicle.");

  REQUIRED_CATEGORIES.forEach(function (cat) {
    var has = parts.some(function (p) { return p.category === cat; });
    if (!has) block("empty-" + cat, "No " + cat + " part. The spacecraft needs at least one.");
  });

  if (launcher && orbit) {
    if (!t.capacity_kg) {
      block("launcher-reach", launcher.name + " cannot reach " + orbit.name + ".");
    } else if (t.mass_kg > t.capacity_kg) {
      block("mass", "Spacecraft is " + t.mass_kg + " kg but the " + launcher.name +
        " can carry only " + t.capacity_kg + " kg to " + orbit.name + ".");
    } else if (t.margins.mass < LOW_MARGIN) {
      warn("mass-margin", "Mass margin is only " + Math.round(t.margins.mass * 100) +
        "%. Events will hit harder.");
    }
  }

  if (tier && t.cost_musd > tier.budget_musd) {
    block("budget", "Cost is $" + round(t.cost_musd, 2) + "M but the budget is $" + tier.budget_musd + "M.");
  }

  if (t.power_draw_w > t.power_gen_w) {
    block("power", "Parts draw " + t.power_draw_w + " W but the solar panels make only " + t.power_gen_w + " W.");
  } else if (t.power_gen_w > 0 && t.margins.power < LOW_MARGIN) {
    warn("power-margin", "Power margin is only " + Math.round(t.margins.power * 100) +
      "%. Events will hit harder.");
  }

  if (orbit && t.delta_v_ms < orbit.dv_needed_ms) {
    block("delta-v", orbit.name + " needs " + orbit.dv_needed_ms + " m/s of thrust from the spacecraft, but it has only " +
      t.delta_v_ms + " m/s. Add propulsion or cut mass.");
  }

  if (orbit && t.data_gb_day > t.data_returned_gb_day) {
    warn("data", "Instruments make " + t.data_gb_day + " GB a day but only " + t.data_returned_gb_day +
      " GB reaches the ground. The rest is lost.");
  }

  if (orbit && t.power_draw_w > 0) {
    var need = batteryNeededWh(t.power_draw_w, orbit.altitude_km);
    if (t.battery_wh < need) {
      warn("battery", "Riding through Earth's shadow needs a " + Math.round(need) + " Wh battery; you have " +
        t.battery_wh + " Wh. Instruments will switch off in shadow.");
    }
  }

  if (objective) {
    var instruments = parts.filter(function (p) { return p.category === "instrument"; });
    var matches = instruments.some(function (p) {
      return p.tags.some(function (tag) { return objective.wants.indexOf(tag) !== -1; });
    });
    if (instruments.length && !matches) {
      warn("no-match", "No instrument suits " + objective.name + ".");
    }
    if (orbit && objective.orbit_fit && objective.orbit_fit[orbit.id] === 0) {
      warn("orbit-fit", orbit.name + " cannot see what " + objective.name + " needs.");
    }
    if (orbit && objective.needs_resolution_m) {
      instruments.forEach(function (p) {
        var x = resolutionM(p, orbit.altitude_km);
        if (x !== null && x > objective.needs_resolution_m) {
          warn("resolution-" + p.id, p.name + " sees " + Math.round(x) + " m detail from " + orbit.name +
            "; this objective needs " + objective.needs_resolution_m + " m. It will earn no science.");
        }
      });
    }
  }

  return { blockers: blockers, warnings: warnings };
}

// ------------------------------------------------------------------ science preview
// What the Build screen shows before launch: expected science over the whole
// mission if nothing goes wrong. Function name to be confirmed with Design screens.
function previewScience(design) {
  var orbit = getOrbit(design.orbit);
  var objective = getObjective(design.objective);
  var rate = scienceRate(design, []);
  var months = orbit ? orbit.lifetime_months : 0;
  var target = objective ? objective.science_target : 0;
  var total = rate.per_month * months;
  return {
    per_month: round(rate.per_month, 2),
    months: months,
    total: round(total, 1),
    target: target,
    share: target ? round(Math.min(1, total / target), 3) : 0,
    data_share: round(rate.data_share, 3),     // share of data that reaches the ground
    power_share: round(rate.power_share, 3),   // share of time instruments stay on
    instruments: rate.instruments.map(function (i) {
      return { id: i.id, name: getPart(i.id).name, per_month: round(i.points * rate.data_share * rate.power_share, 2),
               counts: i.match > 0, sharp_enough: i.sharp_enough };
    })
  };
}
