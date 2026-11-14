// data/objectives.js — owned by Data (yarmee).
// orbit_fit and real_mission come from SPEC.md ("Content choices" and
// "What this changes"). science_target and orbit_fit are GAME VALUES for QA to tune.
// value_musd, knowledge_scale and requires_research drive the campaign payout (SPEC.md, "Scoring").

const OBJECTIVES = [
  // ======================================================== 1957-1960 era topics
  {
    id: "radiation",
    name: "Radiation around Earth",
    briefing: "It is 1957 and nobody knows what lies just above the atmosphere. Cosmic rays? Something new? Put a counter in orbit and listen to what it hears.",
    wants: ["radiation"],
    science_target: 100,         // GAME VALUE
    orbit_fit: { leo: 1.0, sso: 0.8, geo: 0.5 },   // GAME VALUES: the inner belt starts a few hundred km up
    value_musd: 20,              // GAME VALUE: tuned with a campaign bot (Training wins about 1963,
    knowledge_scale: 150,        // GAME VALUE   Standard about 1969, Expert needs a better player than the bot)
    requires_research: null,     // open from the start, as in 1958
    real_mission: "Explorer 1 and Explorer 3 (1958): James Van Allen's counters found the radiation belts that now bear his name."
  },
  {
    id: "solar",
    name: "Solar activity",
    briefing: "The International Geophysical Year was timed for a peak in the Sun's 11-year cycle. Flares hurl X-rays that never reach the ground. Catch them from orbit, and fly when the Sun is busy.",
    wants: ["solar", "radiation"],
    science_target: 250,         // GAME VALUE: the best 1958 design reaches about 180% (solar maximum)
    orbit_fit: { leo: 1.0, sso: 1.0, geo: 1.0 },   // the Sun is visible from every orbit
    value_musd: 25,              // GAME VALUE
    knowledge_scale: 200,        // GAME VALUE
    requires_research: "solar-physics",
    real_mission: "SOLRAD 1 (1960), launched by the US Navy, made the first observations of the Sun's X-rays from orbit."
  },
  {
    id: "weather",
    name: "First weather pictures",
    briefing: "Forecasters see only what weather stations report, and most of Earth is ocean. A satellite could see every cloud. Prove it can be done.",
    wants: ["imaging"],
    science_target: 120,         // GAME VALUE
    orbit_fit: { leo: 0.8, sso: 1.0, geo: 0.6 },   // GAME VALUES
    value_musd: 25,              // GAME VALUE
    knowledge_scale: 150,        // GAME VALUE
    requires_research: "cloud-photometry",
    real_mission: "Vanguard 2 (1959) tried to measure cloud cover; TIROS-1 (1960) sent the first television pictures of clouds from space."
  },

  {
    id: "wildfire",
    name: "Wildfire monitoring",
    briefing: "Fires are spreading faster and burning longer every year. Firefighters need to know where new fires start, and they need to know quickly. Design a satellite that spots fire heat from orbit and gets that news to the ground.",
    wants: ["thermal", "imaging"],
    science_target: 160,        // GAME VALUE: the best design reaches about 108% (tests/balance.js)
    needs_resolution_m: 2000,   // GOES-R ABI finds fires with 2 km infrared pixels
    // How well each orbit catches fires when it looks (GAME VALUES): GEO watches constantly;
    // a 45-degree LEO drifts through every hour of the day, so it also catches the afternoon
    // fire peak; SSO crosses each place at the same morning hour and misses it (NASA's
    // afternoon Aqua sees more fires than the morning Terra). The game multiplies this by
    // the share of real fires each orbit can see at all (data/earth.js, NASA FIRMS 2025).
    orbit_fit: { leo: 0.85, sso: 0.5, geo: 1.0 },
    value_musd: 28,             // GAME VALUE: money for knowing the topic completely. Tuned so a first
                                // mission pays about 1.5x its cost, a second about breaks even
    knowledge_scale: 300,       // GAME VALUE: science at which the player knows about 63% of it
    requires_research: "thermal-infrared",   // a modern topic, late in the research tree
    real_mission: "NOAA's GOES-R satellites watch fires from geostationary orbit, and OroraTech's FOREST smallsats hunt them from low orbit."
  },
  {
    id: "sea-ice",
    name: "Arctic sea-ice mapping",
    briefing: "Arctic sea ice is shrinking, and ships, scientists and northern communities all need to know where it is. The Arctic is dark for months and often cloudy. Design a satellite that can map the ice anyway.",
    wants: ["radar", "imaging"],  // a camera helps a little, in daylight and clear sky
    science_target: 200,
    orbit_fit: { leo: 0, sso: 1.0, geo: 0 },      // only a polar orbit passes over the Arctic; LEO and GEO cannot see it
    value_musd: 40,             // GAME VALUE: a first radar mission pays about 1.7x its cost
    knowledge_scale: 300,       // GAME VALUE
    requires_research: "synthetic-aperture-radar",   // radar from orbit arrived with Seasat (1978)
    real_mission: "Canada's RADARSAT Constellation Mission maps Arctic ice with radar from a polar orbit."
  }
];
