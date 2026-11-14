// data/objectives.js — owned by Data (yarmee).
// orbit_fit and real_mission come from SPEC.md ("Content choices" and
// "What this changes"). science_target and orbit_fit are GAME VALUES for QA to tune.

const OBJECTIVES = [
  {
    id: "wildfire",
    name: "Wildfire monitoring",
    briefing: "Fires are spreading faster and burning longer every year. Firefighters need to know where new fires start, and they need to know quickly. Design a satellite that spots fire heat from orbit and gets that news to the ground.",
    wants: ["thermal", "imaging"],
    science_target: 150,
    needs_resolution_m: 2000,   // GOES-R ABI finds fires with 2 km infrared pixels
    orbit_fit: { leo: 0.6, sso: 0.8, geo: 1.0 },  // GEO watches constantly; low orbits have gaps
    real_mission: "NOAA's GOES-R satellites watch fires from geostationary orbit, and OroraTech's FOREST smallsats hunt them from low orbit."
  },
  {
    id: "sea-ice",
    name: "Arctic sea-ice mapping",
    briefing: "Arctic sea ice is shrinking, and ships, scientists and northern communities all need to know where it is. The Arctic is dark for months and often cloudy. Design a satellite that can map the ice anyway.",
    wants: ["radar", "imaging"],  // a camera helps a little, in daylight and clear sky
    science_target: 200,
    orbit_fit: { leo: 0.3, sso: 1.0, geo: 0 },    // values from SPEC.md; GEO cannot see the poles
    real_mission: "Canada's RADARSAT Constellation Mission maps Arctic ice with radar from a polar orbit."
  }
];
