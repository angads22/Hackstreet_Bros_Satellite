// data/objectives.js — owned by Data (yarmee).
// orbit_fit and real_mission come from SPEC.md ("Content choices" and
// "What this changes"). science_target and orbit_fit are GAME VALUES for QA to tune.
// value_musd, knowledge_scale and requires_research drive the campaign payout (SPEC.md, "Scoring").

const OBJECTIVES = [
  // ======================================================== 1957-1960 era topics
  {
    id: "radiation",
    name: "Radiation around Earth",
    briefing: "1957. Nobody knows what lies above the atmosphere. Put a counter in orbit and listen.",
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
    briefing: "The International Geophysical Year was timed for a solar peak. Flares send X-rays that never reach the ground. Catch them from orbit.",
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
    briefing: "Forecasters see only what stations report, and most of Earth is ocean. A satellite could see every cloud.",
    wants: ["imaging"],
    science_target: 100,         // GAME VALUE: TV cameras alone (as on TIROS-1) or cameras plus photocells
    orbit_fit: { leo: 0.8, sso: 1.0, geo: 0.6 },   // both reach it: more than one way to succeed
    value_musd: 25,              // GAME VALUE
    knowledge_scale: 150,        // GAME VALUE
    requires_research: "cloud-photometry",
    real_mission: "Vanguard 2 (1959) tried to measure cloud cover; TIROS-1 (1960) sent the first television pictures of clouds from space."
  },

  {
    id: "wildfire",
    name: "Wildfire monitoring",
    briefing: "Fires spread faster every year. Spot fire heat from orbit and get the news down fast.",
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
    briefing: "Arctic ice is shrinking and ships need to know where it is. It is dark for months and often cloudy.",
    wants: ["radar", "imaging"],  // a camera helps a little, in daylight and clear sky
    science_target: 200,
    orbit_fit: { leo: 0, sso: 1.0, geo: 0 },      // only a polar orbit passes over the Arctic; LEO and GEO cannot see it
    value_musd: 40,             // GAME VALUE: a first radar mission pays about 1.7x its cost
    knowledge_scale: 300,       // GAME VALUE
    requires_research: "synthetic-aperture-radar",   // radar from orbit arrived with Seasat (1978)
    real_mission: "Canada's RADARSAT Constellation Mission maps Arctic ice with radar from a polar orbit."
  },
  {
    id: "ionosphere",
    name: "The ionosphere from above",
    briefing: "1962. Nobody has seen the ionosphere's top side. Fly a radio sounder above it and listen for echoes.",
    wants: ["ionosphere"],
    science_target: 120,         // GAME VALUE
    orbit_fit: { leo: 1.0, sso: 1.0, geo: 0 },   // a sounder must fly just above the ionosphere
    value_musd: 30,              // GAME VALUE
    knowledge_scale: 180,        // GAME VALUE
    requires_research: "topside-sounding",
    real_mission: "Alouette 1 (1962, Canada): the first satellite built by a country other than the USSR or the US. Built to last a year, it sounded the ionosphere for ten."
  }
];
