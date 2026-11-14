// data/missions.js — owned by Data (yarmee). Real satellites the debrief compares the
// player's design with (SPEC.md, "Real missions"). orbit = nearest of the game's three
// orbits. Every record needs a person to open its source before submission; values
// that came from secondary sources are marked NEEDS HUMAN CHECK.

const MISSIONS = [
  // ------------------------------------------------------------------ 1957-1960
  {
    id: "explorer-1", name: "Explorer 1", year: 1958, agency: "US Army / JPL",
    objective: "radiation", orbit: "leo", tags: ["radiation"], mass_kg: 13.97, power: "battery",
    blurb: "America's first satellite. Its cosmic-ray counter went silent high up, and James Van Allen realised it was swamped: the radiation belts.",
    source: "Explorer 1 facts (13.97 kg, cosmic-ray package, battery power) checked by hand by the team; NASA's former Explorer 1 overview page now redirects to https://science.nasa.gov/mission/explorer-1/ and no longer gives the mass."
  },
  {
    id: "explorer-3", name: "Explorer 3", year: 1958, agency: "US Army / JPL",
    objective: "radiation", orbit: "leo", tags: ["radiation"], mass_kg: 14.1, power: "battery",
    blurb: "Carried a tape recorder to capture whole orbits, and confirmed that Explorer 1 had found belts of trapped radiation.",
    source: "NASA NSSDCA record 1958-003A. Mass NEEDS HUMAN CHECK."
  },
  {
    id: "vanguard-2", name: "Vanguard 2", year: 1959, agency: "US Navy",
    objective: "weather", orbit: "leo", tags: ["imaging"], mass_kg: 10.75, power: "battery",
    blurb: "The first cloud-cover satellite. A bump from its spent rocket stage set it wobbling and spoiled most of its pictures.",
    source: "NASA NSSDCA: https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1959-001A"
  },
  {
    id: "tiros-1", name: "TIROS-1", year: 1960, agency: "NASA",
    objective: "weather", orbit: "leo", tags: ["imaging"], mass_kg: 122.5, power: "solar",
    blurb: "The first weather satellite: two TV cameras, about 9000 solar cells, and the first television pictures of clouds from space.",
    source: "NASA NSSDCA: https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B"
  },
  {
    id: "solrad-1", name: "SOLRAD 1", year: 1960, agency: "US Navy (NRL)",
    objective: "solar", orbit: "leo", tags: ["solar"], mass_kg: 19, power: "solar",
    blurb: "The first satellite to watch the Sun's X-rays, which never reach the ground.",
    source: "NASA NSSDCA record 1960-007B. Mass NEEDS HUMAN CHECK."
  },
  // ------------------------------------------------------------------ modern
  {
    id: "sdo", name: "Solar Dynamics Observatory", year: 2010, agency: "NASA",
    objective: "solar", orbit: "geo", tags: ["solar"], mass_kg: 3100, power: "solar",
    blurb: "Watches the whole Sun nonstop from a geosynchronous orbit, sending down more than a terabyte a day.",
    source: "NASA SDO mission page: https://science.nasa.gov/mission/sdo/ Mass NEEDS HUMAN CHECK."
  },
  {
    id: "goes-r", name: "GOES-16 (GOES-R series)", year: 2016, agency: "NOAA / NASA",
    objective: "wildfire", orbit: "geo", tags: ["thermal", "imaging"], mass_kg: 5192, power: "solar",
    blurb: "Stares at the Americas from geostationary orbit and spots new fires within minutes, with 2 km infrared pixels.",
    source: "GOES-R series: https://www.goes-r.gov/ Mass NEEDS HUMAN CHECK."
  },
  {
    id: "terra", name: "Terra (MODIS)", year: 1999, agency: "NASA",
    objective: "wildfire", orbit: "sso", tags: ["thermal", "imaging"], mass_kg: 5190, power: "solar",
    blurb: "Its MODIS instrument made the fire detections in this game's NASA data, crossing each place every morning.",
    source: "NASA Terra mission page: https://terra.nasa.gov/ Mass NEEDS HUMAN CHECK."
  },
  {
    id: "forest", name: "OroraTech FOREST", year: 2022, agency: "OroraTech",
    objective: "wildfire", orbit: "sso", tags: ["thermal"], mass_kg: 10, power: "solar",
    blurb: "Shoebox-sized satellites with thermal cameras, built to hunt wildfires in the afternoon gaps the big satellites miss.",
    source: "NASA CSDA vendor page: https://science.nasa.gov/earth-science/csda/vendor-ororatech/ Mass is an ESTIMATE."
  },
  {
    id: "planetscope", name: "PlanetScope (Dove)", year: 2016, agency: "Planet",
    objective: "weather", orbit: "sso", tags: ["imaging"], mass_kg: 5, power: "solar",
    blurb: "Hundreds of small camera satellites that photograph all of Earth's land every day.",
    source: "eoPortal, PlanetScope: https://www.eoportal.org/satellite-missions/planetscope Mass NEEDS HUMAN CHECK."
  },
  {
    id: "seasat", name: "Seasat", year: 1978, agency: "NASA / JPL",
    objective: "sea-ice", orbit: "sso", tags: ["radar"], mass_kg: 2290, power: "solar",
    blurb: "The first imaging radar in orbit. It saw the ocean and sea ice through cloud and darkness, and lasted 106 days.",
    source: "NASA JPL Seasat mission page. Mass and lifetime NEED HUMAN CHECK."
  },
  {
    id: "radarsat-rcm", name: "RADARSAT Constellation", year: 2019, agency: "CSA",
    objective: "sea-ice", orbit: "sso", tags: ["radar"], mass_kg: 1430, power: "solar",
    blurb: "Three Canadian radar satellites that map Arctic ice for ships and northern communities.",
    source: "Canadian Space Agency: https://www.asc-csa.gc.ca/eng/satellites/radarsat/ Mass NEEDS HUMAN CHECK."
  },
  {
    id: "iceye", name: "ICEYE", year: 2018, agency: "ICEYE",
    objective: "sea-ice", orbit: "sso", tags: ["radar"], mass_kg: 85, power: "solar",
    blurb: "Microwave-oven-sized radar satellites: what once took two tonnes now takes 85 kg.",
    source: "eoPortal, ICEYE constellation: https://www.eoportal.org/satellite-missions/iceye-constellation"
  },
  {
    id: "alouette-1", name: "Alouette 1", year: 1962, agency: "Canada (DRTE) / NASA launch",
    objective: "ionosphere", orbit: "sso", tags: ["ionosphere"], mass_kg: 145, power: "solar",
    blurb: "Canada's first satellite, launched on a Thor-Agena into an 80-degree orbit. Designed for one year, it sent ionograms for ten, heard by 33 ground stations from Resolute Bay to the Falklands.",
    source: "CSA, Alouette 1: https://www.asc-csa.gc.ca/eng/satellites/alouette.asp ; ionogram counts from the CSA's Alouette-1 data extraction (result_master.csv). Mass 145 kg NEEDS HUMAN CHECK."
  }
];
