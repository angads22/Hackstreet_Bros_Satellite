// js/game.js — owned by Rules.
// The rules of the game: design totals, the eight formulas from the Math
// model in SPEC.md, orbit facts, and the blockers and warnings shown at the
// readiness review.
//
// This file must never touch the page: no `document`, no HTML.
// It reads the data globals (PARTS, LAUNCHERS, ORBITS, OBJECTIVES, TIERS)
// and copes with any of them being empty or missing.
// A missing number in the data counts as 0 and a missing list as [].

// ---------- Constants (tune here) ----------

const EARTH_MU_M3_S2 = 3.986e14;     // Earth's gravitational parameter, m^3/s^2
const EARTH_RADIUS_M = 6371000;      // Earth's radius, metres
const STANDARD_GRAVITY_MS2 = 9.81;   // g0, m/s^2
const SOLAR_CONSTANT_W_M2 = 1361;    // sunlight at Earth, W/m^2
const DEPTH_OF_DISCHARGE = 0.3;      // share of a battery that may be used
const LOW_MARGIN_WARNING = 0.10;             // margins under this give a warning
const RESOLUTION_FACTOR = 1.22;      // diffraction limit factor, formula 6
const MINUTES_PER_DAY = 1440;
const DEFAULT_TIER_ID = "training";
const REQUIRED_CATEGORIES = ["instrument", "power", "comms", "computer"];

// ---------- Small helpers ----------

// A usable number, or 0 when the field is missing or not a number.
function toNumber(value) {
  return (typeof value === "number" && isFinite(value)) ? value : 0;
}

// A list, or [] when the field is missing.
function toList(value) {
  return Array.isArray(value) ? value : [];
}

// Rounds for display inside check sentences.
function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// The data globals. Each returns [] if its data file is not loaded.
function allParts()      { return (typeof PARTS !== "undefined") ? toList(PARTS) : []; }
function allLaunchers()  { return (typeof LAUNCHERS !== "undefined") ? toList(LAUNCHERS) : []; }
function allOrbits()     { return (typeof ORBITS !== "undefined") ? toList(ORBITS) : []; }
function allObjectives() { return (typeof OBJECTIVES !== "undefined") ? toList(OBJECTIVES) : []; }
function allTiers()      { return (typeof TIERS !== "undefined") ? toList(TIERS) : []; }

// Finds the item with this id in a list. Returns null if there is none.
function findById(list, id) {
  const items = toList(list);
  for (let i = 0; i < items.length; i++) {
    if (items[i] && items[i].id === id) return items[i];
  }
  return null;
}

// The chosen things as full objects, or null when not chosen or not found.
function getDesignOrbit(design)     { return design ? findById(allOrbits(), design.orbit) : null; }
function getDesignLauncher(design)  { return design ? findById(allLaunchers(), design.launcher) : null; }
function getDesignObjective(design) { return design ? findById(allObjectives(), design.objective) : null; }
function getDesignTier(design)      { return design ? findById(allTiers(), design.tier) : null; }

// The design's parts as full objects. Unknown ids are skipped.
function getDesignParts(design) {
  const ids = design ? toList(design.parts) : [];
  const parts = [];
  for (let i = 0; i < ids.length; i++) {
    const part = findById(allParts(), ids[i]);
    if (part) parts.push(part);
  }
  return parts;
}

// Adds up one number field over a list of parts.
function sumField(parts, field) {
  let total = 0;
  for (let i = 0; i < parts.length; i++) total += toNumber(parts[i][field]);
  return total;
}

// The orbit's altitude in metres (the data stores kilometres).
function orbitAltitudeM(orbit) {
  return toNumber(orbit.altitude_km) * 1000;
}

// ---------- Building a design ----------

function newDesign(tierId) {
  const tiers = allTiers();
  const firstTierId = (tiers.length > 0 && tiers[0]) ? tiers[0].id : null;
  return {
    tier: tierId || firstTierId || DEFAULT_TIER_ID,
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
  design.parts = toList(design.parts);
  if (!design.parts.includes(partId)) design.parts.push(partId);
  return design;
}

function removePart(design, partId) {
  design.parts = toList(design.parts).filter(function (id) { return id !== partId; });
  return design;
}

function setLauncher(design, id) {
  design.launcher = id;
  return design;
}

// ---------- The eight formulas ----------

// Formula 1, rocket equation: delta-v in m/s.
// m_full is the total spacecraft mass, m_empty is that minus all fuel.
// With several propulsion parts, Isp is the fuel-weighted average of
// their isp_s, so a big tank counts for more than a small one.
// No propulsion or no fuel gives 0.
function rocketDeltaV(parts) {
  const massFull = sumField(parts, "mass_kg");
  let fuel = 0;
  let ispTimesFuel = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].category !== "propulsion") continue;
    const partFuel = toNumber(parts[i].fuel_kg);
    fuel += partFuel;
    ispTimesFuel += toNumber(parts[i].isp_s) * partFuel;
  }
  const massEmpty = massFull - fuel;
  // massEmpty <= 0 would mean the fuel weighs more than the spacecraft: bad data.
  if (fuel <= 0 || massEmpty <= 0) return 0;
  const isp = ispTimesFuel / fuel;
  return isp * STANDARD_GRAVITY_MS2 * Math.log(massFull / massEmpty);
}

// Formula 2, orbital period in seconds for an altitude in metres.
function orbitPeriodS(altitudeM) {
  const r = EARTH_RADIUS_M + altitudeM;
  return 2 * Math.PI * Math.sqrt(r * r * r / EARTH_MU_M3_S2);
}

// Formula 3, solar panel output in watts in full sun (theta = 0).
function solarPowerW(areaM2, efficiency) {
  return SOLAR_CONSTANT_W_M2 * areaM2 * efficiency;
}

// Formula 4, worst-case share of each lap spent in Earth's shadow.
function eclipseFraction(altitudeM) {
  return Math.asin(EARTH_RADIUS_M / (EARTH_RADIUS_M + altitudeM)) / Math.PI;
}

// Formula 5, battery energy in watt-hours needed to run through one eclipse.
function batteryNeededWh(loadW, eclipseS) {
  return loadW * (eclipseS / 3600) / DEPTH_OF_DISCHARGE;
}

// Formula 6, smallest detail in metres an instrument sees from this altitude.
function imageResolutionM(wavelengthM, altitudeM, apertureM) {
  return RESOLUTION_FACTOR * wavelengthM * altitudeM / apertureM;
}

// Formula 7, data that reaches the ground, GB per day.
function dataReturned(producedGbDay, downlinkGbDay, downlinkMult) {
  return Math.min(producedGbDay, downlinkGbDay * downlinkMult);
}

// Formula 8, margin as a share of capacity. Negative means over capacity.
// Returns null when the capacity is unknown or 0.
function marginOf(capacity, used) {
  if (!(capacity > 0)) return null;
  return (capacity - used) / capacity;
}

// ---------- Per-part numbers ----------

// What one part generates in watts. Solar panels (parts with a panel area
// and an efficiency) are computed by formula 3. Anything else uses its own
// power_gen_w.
function partPowerGenW(part) {
  const area = toNumber(part.panel_area_m2);
  const efficiency = toNumber(part.efficiency);
  if (area > 0 && efficiency > 0) return solarPowerW(area, efficiency);
  return toNumber(part.power_gen_w);
}

// One instrument's resolution in metres from this orbit, or null when the
// part has no aperture or wavelength, or there is no orbit.
function partResolutionM(part, orbit) {
  const aperture = toNumber(part.aperture_m);
  const wavelength = toNumber(part.wavelength_m);
  if (!orbit || aperture <= 0 || wavelength <= 0) return null;
  return imageResolutionM(wavelength, orbitAltitudeM(orbit), aperture);
}

// Facts for one part card, in the design's orbit. The part does not have
// to be in the design yet. Each value is null where it does not apply.
function getPartFacts(design, partId) {
  const part = findById(allParts(), partId);
  const facts = { power_gen_w: null, resolution_m: null };
  if (!part) return facts;
  if (part.category === "power") facts.power_gen_w = partPowerGenW(part);
  if (part.category === "instrument") {
    facts.resolution_m = partResolutionM(part, getDesignOrbit(design));
  }
  return facts;
}

// ---------- Totals ----------

// The launcher's capacity in kg for the chosen orbit.
// Null when launcher or orbit is not chosen. 0 means "cannot reach".
function launchCapacityKg(design) {
  const launcher = getDesignLauncher(design);
  const orbit = getDesignOrbit(design);
  if (!launcher || !orbit) return null;
  const capacities = launcher.capacity_kg || {};
  return toNumber(capacities[orbit.id]);
}

function getTotals(design) {
  const parts = getDesignParts(design);
  const orbit = getDesignOrbit(design);
  const launcher = getDesignLauncher(design);
  const tier = getDesignTier(design);

  const mass = sumField(parts, "mass_kg");
  const powerDraw = sumField(parts, "power_draw_w");
  let powerGen = 0;
  for (let i = 0; i < parts.length; i++) powerGen += partPowerGenW(parts[i]);
  const cost = sumField(parts, "cost_musd") + (launcher ? toNumber(launcher.cost_musd) : 0);
  const dataMade = sumField(parts, "data_gb_day");
  const downlink = sumField(parts, "downlink_gb_day");

  // Capacities for the margins. A null or 0 capacity gives a null margin.
  const massCapacity = launchCapacityKg(design);
  const budget = tier ? toNumber(tier.budget_musd) : null;
  const dataCapacity = orbit ? downlink * toNumber(orbit.downlink_mult) : null;

  return {
    mass_kg: mass,
    power_draw_w: powerDraw,
    power_gen_w: powerGen,
    cost_musd: cost,
    data_gb_day: dataMade,
    downlink_gb_day: downlink,          // raw sum, not multiplied by the orbit
    delta_v_ms: rocketDeltaV(parts),
    margins: {
      mass: marginOf(massCapacity, mass),
      power: marginOf(powerGen, powerDraw),
      budget: marginOf(budget, cost),
      data: marginOf(dataCapacity, dataMade)
    }
  };
}

// ---------- Orbit facts ----------

function getOrbitFacts(design) {
  const orbit = getDesignOrbit(design);
  if (!orbit) {
    return { period_min: null, laps_per_day: null, eclipse_fraction: null };
  }
  const altitudeM = orbitAltitudeM(orbit);
  const periodMin = orbitPeriodS(altitudeM) / 60;
  return {
    period_min: periodMin,
    laps_per_day: MINUTES_PER_DAY / periodMin,
    eclipse_fraction: eclipseFraction(altitudeM)
  };
}

// ---------- Science rate (used by the simulation) ----------

// True if the two tag lists share at least one tag.
function sharesTag(tagsA, tagsB) {
  const a = toList(tagsA);
  const b = toList(tagsB);
  for (let i = 0; i < a.length; i++) {
    if (b.includes(a[i])) return true;
  }
  return false;
}

// Science points per month for this design, and what went into the number.
// Depends only on the design and the data, so it can be called on a copy
// of the design with failed parts removed.
function getScienceRate(design) {
  const parts = getDesignParts(design);
  const orbit = getDesignOrbit(design);
  const objective = getDesignObjective(design);

  // Formula 7: share of the data produced that reaches the ground.
  const dataMade = sumField(parts, "data_gb_day");
  const downlink = sumField(parts, "downlink_gb_day");
  const downlinkMult = orbit ? toNumber(orbit.downlink_mult) : 1;
  let dataShare = 1;
  if (dataMade > 0) {
    dataShare = dataReturned(dataMade, downlink, downlinkMult) / dataMade;
  }

  // Formulas 4 and 5: if the batteries cannot carry the load through the
  // eclipse, the instruments switch off in shadow.
  let eclipseMult = 1;
  if (orbit) {
    const altitudeM = orbitAltitudeM(orbit);
    const fraction = eclipseFraction(altitudeM);
    const eclipseS = fraction * orbitPeriodS(altitudeM);
    const needed = batteryNeededWh(sumField(parts, "power_draw_w"), eclipseS);
    if (sumField(parts, "battery_wh") < needed) eclipseMult = 1 - fraction;
  }

  const rate = {
    science_per_month: 0,
    data_share: dataShare,
    eclipse_mult: eclipseMult,
    counted_parts: []
  };
  if (!orbit || !objective) return rate;

  // How well this orbit suits the objective. 1 if the objective does not say.
  let orbitFit = 1;
  if (objective.orbit_fit && typeof objective.orbit_fit[orbit.id] === "number") {
    orbitFit = objective.orbit_fit[orbit.id];
  }
  const neededResolution = toNumber(objective.needs_resolution_m);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.category !== "instrument") continue;
    if (!sharesTag(part.tags, objective.wants)) continue;
    if (neededResolution > 0) {
      // Formula 6: an instrument that cannot see the needed detail earns nothing.
      const resolution = partResolutionM(part, orbit);
      if (resolution === null || resolution > neededResolution) continue;
    }
    rate.science_per_month += toNumber(part.science) * toNumber(orbit.science_mult) *
      orbitFit * dataShare * eclipseMult;
    rate.counted_parts.push(part.id);
  }
  return rate;
}

// ---------- Readiness review ----------

// How many of the design's parts are in this category.
function countCategory(parts, category) {
  let count = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].category === category) count++;
  }
  return count;
}

function runChecks(design) {
  const blockers = [];
  const warnings = [];
  const parts = getDesignParts(design);
  const totals = getTotals(design);
  const orbit = getDesignOrbit(design);
  const launcher = getDesignLauncher(design);
  const objective = getDesignObjective(design);
  const tier = getDesignTier(design);

  // --- Blockers ---

  if (!objective) {
    blockers.push({ id: "no-objective", text: "No objective chosen. Pick one on the Briefing screen." });
  }
  if (!orbit) {
    blockers.push({ id: "no-orbit", text: "No orbit chosen. Pick one on the Orbit screen." });
  }
  if (!launcher) {
    blockers.push({ id: "no-launcher", text: "No launch vehicle chosen. Pick one on the Launch vehicle screen." });
  }

  for (let i = 0; i < REQUIRED_CATEGORIES.length; i++) {
    const category = REQUIRED_CATEGORIES[i];
    if (countCategory(parts, category) === 0) {
      blockers.push({
        id: "empty-" + category,
        text: "No " + category + " part. The spacecraft needs at least one."
      });
    }
  }

  const capacity = launchCapacityKg(design);
  if (capacity !== null && capacity <= 0) {
    blockers.push({
      id: "unreachable",
      text: "The " + launcher.name + " cannot reach " + orbit.name + ". Pick a bigger rocket or another orbit."
    });
  } else if (capacity !== null && totals.mass_kg > capacity) {
    blockers.push({
      id: "mass",
      text: "The spacecraft is " + roundTo(totals.mass_kg, 1) + " kg but the " + launcher.name +
        " can only lift " + roundTo(capacity, 1) + " kg to " + orbit.name + "."
    });
  }

  if (tier && totals.cost_musd > toNumber(tier.budget_musd)) {
    blockers.push({
      id: "budget",
      text: "The mission costs $" + roundTo(totals.cost_musd, 1) + "M but the budget is $" +
        roundTo(toNumber(tier.budget_musd), 1) + "M."
    });
  }

  if (totals.power_draw_w > totals.power_gen_w) {
    blockers.push({
      id: "power",
      text: "The parts draw " + roundTo(totals.power_draw_w, 1) + " W but the spacecraft only generates " +
        roundTo(totals.power_gen_w, 1) + " W."
    });
  }

  // Formula 1: the spacecraft's own propulsion must cover what the orbit needs.
  const dvNeeded = orbit ? toNumber(orbit.dv_needed_ms) : 0;
  if (dvNeeded > 0 && totals.delta_v_ms < dvNeeded) {
    blockers.push({
      id: "delta-v",
      text: "The propulsion gives " + roundTo(totals.delta_v_ms, 0) + " m/s of speed change but " +
        orbit.name + " needs " + roundTo(dvNeeded, 0) + " m/s."
    });
  }

  // --- Warnings ---
  // A margin below zero is already a blocker, so it does not also warn.

  const massMargin = totals.margins.mass;
  if (massMargin !== null && massMargin >= 0 && massMargin < LOW_MARGIN_WARNING) {
    warnings.push({
      id: "mass-margin",
      text: "Mass margin is only " + roundTo(massMargin * 100, 1) + "%, under " +
        roundTo(LOW_MARGIN_WARNING * 100, 0) + "%. Events will hit harder."
    });
  }

  const powerMargin = totals.margins.power;
  if (powerMargin !== null && powerMargin >= 0 && powerMargin < LOW_MARGIN_WARNING) {
    warnings.push({
      id: "power-margin",
      text: "Power margin is only " + roundTo(powerMargin * 100, 1) + "%, under " +
        roundTo(LOW_MARGIN_WARNING * 100, 0) + "%. Events will hit harder."
    });
  }

  // Formula 7. Before an orbit is chosen, compare with the raw downlink.
  const downlinkMult = orbit ? toNumber(orbit.downlink_mult) : 1;
  const canSend = totals.downlink_gb_day * downlinkMult;
  if (totals.data_gb_day > canSend) {
    warnings.push({
      id: "data",
      text: "Instruments make " + roundTo(totals.data_gb_day, 1) + " GB/day but comms can send down " +
        roundTo(canSend, 1) + ". The excess is lost."
    });
  }

  // Only when there is an objective and at least one instrument to judge.
  if (objective && countCategory(parts, "instrument") > 0) {
    let matches = false;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].category === "instrument" && sharesTag(parts[i].tags, objective.wants)) {
        matches = true;
      }
    }
    if (!matches) {
      warnings.push({
        id: "no-match",
        text: "No instrument matches what " + objective.name + " needs (" +
          toList(objective.wants).join(", ") + "). It will earn no science."
      });
    }
  }

  return { blockers: blockers, warnings: warnings };
}
