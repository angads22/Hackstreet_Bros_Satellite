// data/objectives.js — owned by Data (yarmee).
// orbit_fit and real_mission come from SPEC.md ("Content choices" and
// "What this changes"). science_target and orbit_fit are GAME VALUES for QA to tune.
// value_musd, knowledge_scale and requires_research drive the campaign payout (SPEC.md, "Scoring").

const OBJECTIVES = [
  {
    id: "wildfire",
    name: "Wildfire monitoring",
    briefing: "Fires are spreading faster and burning longer every year. Firefighters need to know where new fires start, and they need to know quickly. Design a satellite that spots fire heat from orbit and gets that news to the ground.",
    wants: ["thermal", "imaging"],
    science_target: 180,
    needs_resolution_m: 2000,   // GOES-R ABI finds fires with 2 km infrared pixels
    // How often each orbit looks (GAME VALUES): GEO watches constantly; SSO crosses each
    // place at the same morning hour, missing the afternoon fire peak; LEO drifts through
    // all hours but passes only a few times a day. The game multiplies this by the share
    // of real fires each orbit can see at all (data/earth.js, NASA FIRMS 2025).
    orbit_fit: { leo: 0.55, sso: 0.5, geo: 1.0 },
    value_musd: 20,             // GAME VALUE: money for knowing the topic completely
    knowledge_scale: 300,       // GAME VALUE: science at which the player knows about 63% of it
    requires_research: null,    // open from the start
    real_mission: "NOAA's GOES-R satellites watch fires from geostationary orbit, and OroraTech's FOREST smallsats hunt them from low orbit."
  },
  {
    id: "sea-ice",
    name: "Arctic sea-ice mapping",
    briefing: "Arctic sea ice is shrinking, and ships, scientists and northern communities all need to know where it is. The Arctic is dark for months and often cloudy. Design a satellite that can map the ice anyway.",
    wants: ["radar", "imaging"],  // a camera helps a little, in daylight and clear sky
    science_target: 200,
    orbit_fit: { leo: 0.3, sso: 1.0, geo: 0 },    // values from SPEC.md; GEO cannot see the poles
    value_musd: 60,             // GAME VALUE
    knowledge_scale: 300,       // GAME VALUE
    requires_research: null,    // Phase E may move this behind a radar laboratory
    real_mission: "Canada's RADARSAT Constellation Mission maps Arctic ice with radar from a polar orbit."
  }
];
