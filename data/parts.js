// data/parts.js — owned by Data (yarmee).
//
// Scale: a small satellite of roughly 30–110 kg (ESPA class), the range
// NASA's Small Spacecraft Technology State of the Art report covers.
//
// How to read the numbers:
//   - "SOA p.N" = NASA Small Spacecraft Technology State of the Art 2025,
//     PDF page N: https://www.nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf
//   - "ESTIMATE" = no public figure found; a reasonable value, flagged so a
//     person can replace it. Part prices are almost never published, so every
//     cost_musd is an estimate.
//   - "GAME VALUE" = a balance number with no real-world equivalent
//     (science points). QA tunes these.
//   - data_gb_day for comms = the radio's data rate running all day.
//     The orbit's downlink_mult then cuts it to the real time in contact.
//   - power_draw_w = orbit-average draw, not peak.
//   - lead_months = months between ordering a part and having it delivered (new in 2.0, from the
//     engineers who visited the table). Every value is a GAME VALUE rounded from the ranges in
//     docs/real-world-plan.md (reaction wheels and star trackers about 18 to 52 weeks; space-grade solar
//     cells about 26 to 52 weeks, up to 18 months in the 2025-26 boom). Those web pages are NOT OPENED,
//     NEEDS HUMAN CHECK (see SOURCES.md). It is shown in the part's dossier and changes no timing.
//
// The spacecraft structure, attitude control and wiring are not modelled.

const PARTS = [
  // ======================================================== structure and attitude control
  // The satellite's body and how it points (SPEC.md, "Structure and attitude control").
  {
    id: "explorer-body",
    name: "Explorer-style cylinder",
    category: "structure",
    mass_kg: 1,              // ESTIMATE
    power_draw_w: 0, power_gen_w: 0,
    cost_musd: 0.05,         // GAME VALUE
    data_gb_day: 0, downlink_gb_day: 0, storage_gb: 0, science: 0,
    tags: [], protects: [],
    blurb: "A slim steel tube that is also the rocket's last stage nose: light, cheap and cramped.",
    source: "Explorer 1 was a long thin cylinder carried on top of its final rocket stage (checked by hand by the team). Mass is an ESTIMATE.",
    payload_kg: 10,          // approved field: the most this body carries
    slots: { instrument: 1, power: 2, comms: 1, computer: 2, attitude: 1 },
    build_months: 2,
    lead_months: 2   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "drum-body",
    name: "TIROS-style drum",
    category: "structure",
    mass_kg: 20,             // ESTIMATE
    power_draw_w: 0, power_gen_w: 0,
    cost_musd: 0.5,          // GAME VALUE
    data_gb_day: 0, downlink_gb_day: 0, storage_gb: 0, science: 0,
    tags: [], protects: [],
    blurb: "An 18-sided drum, about a metre across, with solar cells on the outside and room for cameras inside.",
    source: "NASA NSSDCA, TIROS 1: an 18-sided right prism, 107 cm across and 56 cm high. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B Mass is an ESTIMATE.",
    payload_kg: 100,          // approved field: the most this body carries
    slots: { instrument: 2, power: 3, comms: 2, computer: 2, attitude: 1 },
    build_months: 6,
    lead_months: 4   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "smallsat-bus",
    name: "Modern smallsat bus",
    category: "structure",
    mass_kg: 15,             // ESTIMATE
    power_draw_w: 0, power_gen_w: 0,
    cost_musd: 1,            // ESTIMATE
    data_gb_day: 0, downlink_gb_day: 0, storage_gb: 0, science: 0,
    tags: [], protects: [],
    blurb: "An off-the-shelf frame for satellites up to about 180 kg, with standard mounts for everything.",
    source: "Representative of ESPA-class buses listed in NASA's Small Spacecraft Technology State of the Art 2025, Table 2-7 (https://www.nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf). Mass and cost are ESTIMATES.",
    payload_kg: 150,          // approved field: the most this body carries
    slots: { instrument: 2, power: 3, comms: 2, computer: 2, attitude: 2, propulsion: 1 },
    build_months: 4,
    lead_months: 6   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple
  },
  {
    id: "nimbus-bus",
    name: "Nimbus-class bus",
    category: "structure",
    mass_kg: 60,             // ESTIMATE
    power_draw_w: 0, power_gen_w: 0,
    cost_musd: 1.5,          // GAME VALUE
    data_gb_day: 0, downlink_gb_day: 0, storage_gb: 0, science: 0,
    tags: [], protects: [],
    blurb: "A big three-axis platform with room for several instruments and a thruster.",
    source: "Modelled on Nimbus 1 (1964, 374.4 kg, polar orbit; NASA NSSDCA, https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1964-052A). Body mass, payload and slots are ESTIMATES.",
    payload_kg: 300,         // approved field
    slots: { instrument: 3, power: 3, comms: 2, computer: 2, attitude: 2, propulsion: 1 },
    build_months: 8,
    lead_months: 10   // GAME VALUE, no range quoted: a specialised instrument, set above the 18-week low end of the quoted wheels and trackers
  },
  {
    id: "cubesat-12u",
    name: "12U CubeSat frame",
    category: "structure",
    mass_kg: 2,              // ESTIMATE
    power_draw_w: 0, power_gen_w: 0,
    cost_musd: 0.1,          // ESTIMATE
    data_gb_day: 0, downlink_gb_day: 0, storage_gb: 0, science: 0,
    tags: [], protects: [],
    blurb: "A standard box of twelve 10 cm units: cheap, quick and tiny.",
    source: "CubeSat units are 10 cm cubes of about 1 to 1.33 kg each; 12U is one of the standard sizes (NASA CubeSat 101, PDF p.12, https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf). Frame mass is an ESTIMATE; payload is 12 x 1.33 kg plus margin.",
    payload_kg: 22,          // approved field
    slots: { instrument: 1, power: 2, comms: 1, computer: 1, attitude: 1, propulsion: 1 },
    build_months: 3,
    lead_months: 2   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple
  },
  {
    id: "spin-stabilised",
    name: "Spin stabilisation",
    category: "attitude",
    mass_kg: 0.2,            // ESTIMATE
    power_draw_w: 0, power_gen_w: 0,
    cost_musd: 0.02,         // GAME VALUE
    data_gb_day: 0, downlink_gb_day: 0, storage_gb: 0, science: 0,
    tags: ["spin"], protects: [],
    blurb: "Spin it like a top and it keeps its axis. Simple, but cameras see a smeared, turning Earth.",
    source: "Explorer 1 and TIROS 1 were spin-stabilised; TIROS 1 used small solid thrusters to keep 8-12 rpm (NSSDCA, https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B). Mass is an ESTIMATE.",
    build_months: 1,
    lead_months: 1   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "reaction-wheels",
    name: "Reaction wheels",
    category: "attitude",
    mass_kg: 3,              // ESTIMATE
    power_draw_w: 6,         // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.4,          // ESTIMATE
    data_gb_day: 0, downlink_gb_day: 0, storage_gb: 0, science: 0,
    tags: ["three-axis"], protects: [],
    blurb: "Spinning wheels inside the satellite hold it steady and pointed, so cameras get sharp pictures.",
    source: "Small reaction wheels with flight heritage are listed in NASA's Small Spacecraft Technology State of the Art 2025, Table 5-3 (https://www.nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf). Mass, power and cost are ESTIMATES.",
    build_months: 4,
    lead_months: 8   // GAME VALUE rounded from the engineers' quote and the web sources in docs/real-world-plan.md: reaction wheels and star trackers 18 to 52 weeks, middle of the range
  },
  // ======================================================== 1957-1960 era parts
  // The campaign starts with these (SPEC.md, "The 1957 campaign"). Research unlocks the rest.
  // Sources: NASA's Explorer 1 history page (E1), NASA NSSDCA records for Vanguard 2 (V2,
  // https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1959-001A) and TIROS 1 (T1,
  // https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B). Figures the
  // records do not give are ESTIMATE. Era prices are GAME VALUES in the game's money.
  {
    id: "cosmic-ray-counter",
    name: "Geiger counter package",
    category: "instrument",
    mass_kg: 2.3,            // ESTIMATE
    power_draw_w: 0.05,      // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.3,          // GAME VALUE
    data_gb_day: 0.00002,    // ESTIMATE: a few counts a second, sent in real time
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 4,              // GAME VALUE
    tags: ["radiation"],
    protects: [],
    blurb: "James Van Allen's cosmic-ray counter. On Explorer 1 it went strangely quiet high up: the counter was swamped.",
    source: "NASA, Explorer 1 overview: the main instrument was a cosmic-ray detection package designed by James Van Allen. https://www.nasa.gov/history/explorer-1-overview/ Mass and power are ESTIMATES.",
    build_months: 2,          // GAME VALUE: months to build and test
    lead_months: 2   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "cloud-photocell",
    name: "Cloud-cover photocells",
    category: "instrument",
    mass_kg: 3,              // ESTIMATE (the whole Vanguard 2 satellite was 10.75 kg)
    power_draw_w: 0.3,       // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.4,          // GAME VALUE
    data_gb_day: 0.00002,    // ESTIMATE: two photocell readings, sent in real time
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 3,              // GAME VALUE
    tags: ["imaging"],
    protects: [],
    blurb: "Two photocells that measure sunlight reflected from clouds: the first attempt to see weather from orbit.",
    source: "NASA NSSDCA, Vanguard 2 (1959): designed to measure cloud-cover distribution; 10.75 kg sphere. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1959-001A Part mass and power are ESTIMATES.",
    build_months: 3,          // GAME VALUE: months to build and test
    lead_months: 3   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "vidicon-camera",
    name: "Vidicon TV cameras",
    category: "instrument",
    mass_kg: 10,             // ESTIMATE
    power_draw_w: 6,         // ESTIMATE
    power_gen_w: 0,
    cost_musd: 1.5,          // GAME VALUE
    data_gb_day: 0.02,       // ESTIMATE: TV frames
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 6,              // GAME VALUE
    tags: ["imaging"],
    protects: [],
    blurb: "Two small TV cameras, one wide and one narrow. TIROS-1 sent the first television pictures of Earth's clouds.",
    source: "NASA NSSDCA, TIROS 1 (1960): two 1.27 cm vidicon TV cameras, pictures sent live or stored on tape. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B Mass and power are ESTIMATES.",
    build_months: 6,          // GAME VALUE: months to build and test
    lead_months: 6   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "solar-xray-photometer",
    name: "Solar X-ray photometer",
    category: "instrument",
    mass_kg: 4,              // ESTIMATE
    power_draw_w: 0.5,       // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.6,          // GAME VALUE
    data_gb_day: 0.00005,    // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 5,              // GAME VALUE
    tags: ["solar"],
    protects: [],
    blurb: "Watches the Sun's X-ray flares, which only show above the atmosphere. The more active the Sun, the more it sees.",
    source: "Modelled on the US Navy's SOLRAD 1 (1960), the first satellite to observe solar X-rays. NEEDS A CHECKED SOURCE; all numbers are ESTIMATES.",
    build_months: 4,          // GAME VALUE: months to build and test
    lead_months: 6   // GAME VALUE, no range quoted: a specialised instrument, set above the 18-week low end of the quoted wheels and trackers
  },
  {
    id: "mercury-battery",
    name: "Mercury batteries",
    category: "power",
    mass_kg: 2.6,            // ESTIMATE
    power_draw_w: 0,
    power_gen_w: 0,
    cost_musd: 0.05,         // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "Explorer 1's power. No recharging: when they run down, the satellite falls silent.",
    source: "Explorer 1 ran on mercury batteries; its transmitters lasted 31 and 105 days (secondary sources summarising NASA records; NEEDS HUMAN CHECK). Energy and mass are ESTIMATES.",
    battery_wh: 160, // ESTIMATE: about 50 days at an Explorer-sized load (its transmitters lasted 31 and 105 days)
    build_months: 1,          // GAME VALUE: months to build and test
    lead_months: 1   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "silver-zinc-battery",
    name: "Silver-zinc batteries",
    category: "power",
    mass_kg: 51,             // Sputnik 1's batteries (secondary source)
    power_draw_w: 0,
    power_gen_w: 0,
    cost_musd: 0.1,          // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "Sputnik 1's batteries: plenty of energy, but heavy. Sputnik fell silent after about 21 days.",
    source: "Sputnik 1 (83.6 kg) carried three silver-zinc batteries and transmitted for about 21 days (secondary sources; NEEDS HUMAN CHECK). Energy is an ESTIMATE.",
    battery_wh: 1000, // ESTIMATE
    build_months: 1,          // GAME VALUE: months to build and test
    lead_months: 2   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "silicon-cells",
    name: "Early silicon solar cells",
    category: "power",
    mass_kg: 3,              // ESTIMATE
    power_draw_w: 0,
    power_gen_w: 0,          // computed by game.js: 1361 x 0.2 x 0.08 = 21.8 W
    cost_musd: 0.5,          // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "The first satellite solar cells. Vanguard 1's kept transmitting for more than six years.",
    source: "Vanguard 1 (1958) was the first solar-powered satellite; TIROS 1 (1960) carried about 9000 1 x 2 cm silicon cells (NSSDCA, https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B). Lit area and efficiency are ESTIMATES (1950s silicon cells: about 8-10%).",
    panel_area_m2: 0.2,      // ESTIMATE: the share of body-mounted cells facing the Sun at once
    efficiency: 0.08,
    build_months: 3,          // GAME VALUE: months to build and test
    lead_months: 6   // GAME VALUE rounded from the engineers' quote and the web sources in docs/real-world-plan.md: space-grade solar cells 26 to 52 weeks, up to 18 months in the 2025-26 boom, low end for 1950s cells
  },
  {
    id: "nicad-battery",
    name: "Nickel-cadmium batteries",
    category: "power",
    mass_kg: 5,              // ESTIMATE
    power_draw_w: 0,
    power_gen_w: 0,
    cost_musd: 0.1,          // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "Rechargeable batteries: with solar cells they carry the satellite through Earth's shadow.",
    source: "TIROS 1 (1960) carried 21 nickel-cadmium batteries charged by its solar cells (NSSDCA, https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B). Energy and mass are ESTIMATES.",
    battery_wh: 120, // ESTIMATE
    build_months: 2,          // GAME VALUE: months to build and test
    lead_months: 3   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "minitrack-beacon",
    name: "108 MHz Minitrack beacon",
    category: "comms",
    mass_kg: 0.3,            // ESTIMATE
    power_draw_w: 0.06,      // Explorer 1's higher-power transmitter: about 60 mW (secondary source)
    power_gen_w: 0,
    cost_musd: 0.02,         // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0.001,  // ESTIMATE: a few bits a second, all day
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "A tiny radio the ground can track and listen to. Enough for a counter, hopeless for pictures.",
    source: "Explorer 1 and the Vanguards transmitted near 108 MHz for the Minitrack tracking network (secondary sources; NEEDS HUMAN CHECK). Data rate is an ESTIMATE.",
    build_months: 1,          // GAME VALUE: months to build and test
    lead_months: 1   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "vhf-telemetry",
    name: "235 MHz telemetry link",
    category: "comms",
    mass_kg: 3,              // ESTIMATE
    power_draw_w: 5,         // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.3,          // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0.5,    // ESTIMATE: TV pictures to a receiving station
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "A stronger radio that can send TV pictures to the ground.",
    source: "TIROS 1 used 235 MHz telemetry antennas and sent TV pictures to ground stations (NSSDCA, https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B). Rate, mass and power are ESTIMATES.",
    build_months: 3,          // GAME VALUE: months to build and test
    lead_months: 3   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "command-timer",
    name: "Clock and command receiver",
    category: "computer",
    mass_kg: 0.5,            // ESTIMATE
    power_draw_w: 0.02,      // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.02,         // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "Before computers: a clock and a radio receiver that switch things on and off.",
    source: "Early satellites used timers and ground commands rather than computers (TIROS 1 carried a command receiver; NSSDCA). All numbers are ESTIMATES.",
    build_months: 1,          // GAME VALUE: months to build and test
    lead_months: 1   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "tape-recorder",
    name: "Miniature tape recorder",
    category: "computer",
    mass_kg: 1,              // ESTIMATE
    power_draw_w: 0.5,       // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.2,          // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0.001,       // ESTIMATE
    science: 0,
    tags: [],
    protects: [],
    blurb: "Records a whole orbit and plays it back over a station. Explorer 3 carried one to explain Explorer 1's silent counter.",
    source: "Explorer 3 (1958) added a tape recorder, and its data confirmed the radiation belts (secondary sources; NEEDS HUMAN CHECK). All numbers are ESTIMATES.",
    build_months: 2,          // GAME VALUE: months to build and test
    lead_months: 3   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },

  // ---------------------------------------------------------------- instruments
  {
    id: "thermal-imager",
    name: "Thermal infrared imager",
    category: "instrument",
    mass_kg: 18,             // ESTIMATE for a 25 cm aperture infrared telescope
    power_draw_w: 35,        // ESTIMATE, includes the detector cooler
    power_gen_w: 0,
    cost_musd: 2.5,          // ESTIMATE
    data_gb_day: 2,          // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 6,              // GAME VALUE
    tags: ["thermal"],
    protects: [],
    blurb: "Sees heat through smoke, day or night. The best eye for fires, but needs a big lens to see detail from far away.",
    source: "Representative of wildfire thermal smallsats such as OroraTech FOREST (https://science.nasa.gov/earth-science/csda/vendor-ororatech/). Wavelength: long-wave infrared, about 10 micrometres. Mass, power, data and cost are ESTIMATES.",
    aperture_m: 0.25,        // ESTIMATE
    wavelength_m: 0.00001, // 10 micrometres, long-wave infrared (physics)
    build_months: 12,          // GAME VALUE: months to build and test
    lead_months: 9   // GAME VALUE, no range quoted: a specialised instrument, set above the 18-week low end of the quoted wheels and trackers
  },
  {
    id: "sar-radar",
    name: "Synthetic aperture radar",
    category: "instrument",
    mass_kg: 45,             // ESTIMATE: about half of an 85 kg ICEYE satellite
    power_draw_w: 200,       // ESTIMATE orbit average; peak radiated power is 3.2 kW
    power_gen_w: 0,
    cost_musd: 6,            // ESTIMATE
    data_gb_day: 10,         // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 8,              // GAME VALUE
    tags: ["radar"],
    protects: [],
    blurb: "Sees through cloud and polar night. Heavy and power-hungry.",
    source: "ICEYE Gen 2: 85 kg satellite, 9.65 GHz X-band, 3.2 m x 0.4 m antenna, 3.2 kW peak radiated power (https://www.eoportal.org/satellite-missions/iceye-constellation). Payload share of mass, average power, data and cost are ESTIMATES.",
    aperture_m: 3.2,         // ICEYE antenna length. The diffraction formula does not
                             // apply to radar (it builds a much larger synthetic aperture).
    wavelength_m: 0.031, // 9.65 GHz X-band (c / f)
    build_months: 18,          // GAME VALUE: months to build and test
    lead_months: 12   // GAME VALUE, no range quoted: a specialised instrument, set above the 18-week low end of the quoted wheels and trackers, the slowest instrument
  },
  {
    id: "optical-camera",
    name: "Optical camera",
    category: "instrument",
    mass_kg: 8,              // ESTIMATE
    power_draw_w: 20,        // ESTIMATE
    power_gen_w: 0,
    cost_musd: 1,            // ESTIMATE
    data_gb_day: 15,         // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 4,              // GAME VALUE
    tags: ["imaging"],
    protects: [],
    blurb: "Light, cheap and sharp, but blind at night and through cloud, and it makes a lot of data.",
    source: "Representative of Planet's Dove cameras, about 9 cm aperture (https://www.eoportal.org/satellite-missions/planetscope). Wavelength: visible light, 550 nm. Mass, power, data and cost are ESTIMATES.",
    aperture_m: 0.09,
    wavelength_m: 0.00000055, // 550 nm, visible light (physics)
    build_months: 6,          // GAME VALUE: months to build and test
    lead_months: 8   // GAME VALUE, no range quoted: a specialised instrument, set above the 18-week low end of the quoted wheels and trackers
  },

  // ---------------------------------------------------------------------- power
  {
    id: "solar-small",
    name: "Small solar panel",
    category: "power",
    mass_kg: 6.5,            // 183 W / 28 W/kg, SOA p.50
    power_draw_w: 0,
    power_gen_w: 0,          // computed by game.js: 1361 x 0.66 x 0.204 = 183 W
    cost_musd: 0.4,          // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "183 W in full sun. Enough for a camera or a thermal imager, not a radar.",
    source: "Airbus Sparkwing 600x1100 mm 50 V panel: 183 W peak, 28 W/kg. SOA p.50, Table 3-2. Efficiency is the panel-level value, 183 W / (1361 W/m2 x 0.66 m2).",
    panel_area_m2: 0.66,     // 0.6 m x 1.1 m
    efficiency: 0.204, // panel-level: cells (about 30%, SOA p.48) minus gaps and wiring
    build_months: 4,          // GAME VALUE: months to build and test
    lead_months: 9   // GAME VALUE rounded from the engineers' quote and the web sources in docs/real-world-plan.md: space-grade solar cells 26 to 52 weeks, up to 18 months in the 2025-26 boom, about 9 months
  },
  {
    id: "solar-large",
    name: "Large solar panel",
    category: "power",
    mass_kg: 8.1,            // 366 W / 45 W/kg, SOA p.50
    power_draw_w: 0,
    power_gen_w: 0,          // computed by game.js: 1361 x 1.177 x 0.228 = 366 W
    cost_musd: 0.8,          // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "366 W in full sun. Twice the power for barely more mass.",
    source: "Airbus Sparkwing 1070x1100 mm 50 V panel: 366 W peak, 45 W/kg. SOA p.50, Table 3-2. Efficiency is the panel-level value, 366 W / (1361 W/m2 x 1.177 m2).",
    panel_area_m2: 1.177,    // 1.07 m x 1.1 m
    efficiency: 0.228,
    build_months: 5,          // GAME VALUE: months to build and test
    lead_months: 12   // GAME VALUE rounded from the engineers' quote and the web sources in docs/real-world-plan.md: space-grade solar cells 26 to 52 weeks, up to 18 months in the 2025-26 boom, a year for the big array
  },
  {
    id: "battery-28v",
    name: "Li-ion battery",
    category: "power",
    mass_kg: 5.1,            // 560 Wh / 109.8 Wh/kg
    power_draw_w: 0,
    power_gen_w: 0,
    cost_musd: 0.15,         // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "Keeps instruments running in Earth's shadow. Without one, they switch off every night-side pass.",
    source: "Ibeos 28 V Modular Battery: 109.8 Wh/kg, 8 to 30+ Ah. SOA p.61, Table 3-5. A 20 Ah configuration gives 28 V x 20 Ah = 560 Wh.",
    battery_wh: 560,
    build_months: 3,          // GAME VALUE: months to build and test
    lead_months: 4   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple
  },

  // ---------------------------------------------------------------------- comms
  {
    id: "radio-uhf",
    name: "UHF radio",
    category: "comms",
    mass_kg: 0.1,            // 24.5 g radio (SOA p.294) plus a small antenna, ESTIMATE
    power_draw_w: 3,         // ESTIMATE: 1 W transmit power (30 dBm, SOA p.294)
    power_gen_w: 0,
    cost_musd: 0.01,         // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0.41,   // 38.4 kbit/s x 86,400 s
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "Tiny, cheap and reliable. Fine for health reports, hopeless for images.",
    source: "GomSpace NanoCom AX100: up to 38.4 kbit/s, 30 dBm, 24.5 g. SOA p.294, Table 9-3.",
    build_months: 2,          // GAME VALUE: months to build and test
    lead_months: 2   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple
  },
  {
    id: "radio-sband",
    name: "S-band transmitter",
    category: "comms",
    mass_kg: 0.25,           // 70 g transmitter (SOA p.296) plus 150 g patch antenna (SOA p.289)
    power_draw_w: 10,        // ESTIMATE: 2.5 W transmit power (SOA p.296)
    power_gen_w: 0,
    cost_musd: 0.03,         // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 65,     // 6 Mbit/s x 86,400 s = 64.8 GB
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "The workhorse. Enough for a thermal imager, tight for a radar or a busy camera.",
    source: "AAC Clyde Space TX-2400: 6,000 kbit/s, 2.5 W, 70 g. SOA p.296, Table 9-3. Antenna: Anteral S-band patch, 150 g, SOA p.289, Table 9-2.",
    build_months: 3,          // GAME VALUE: months to build and test
    lead_months: 3   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple
  },
  {
    id: "radio-xband",
    name: "X-band transmitter",
    category: "comms",
    mass_kg: 0.8,            // 300 g transmitter (SOA p.298) plus 500 g patch antenna (SOA p.290)
    power_draw_w: 15,        // ESTIMATE: 33 dBm (2 W) transmit power (SOA p.298)
    power_gen_w: 0,
    cost_musd: 0.15,         // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 270,    // 25 Mbit/s x 86,400 s
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "A fast data pipe for image-heavy missions. Heavier and hungrier than S-band.",
    source: "Tethers Unlimited SWIFT-XTX: 25,000 kbit/s, 33 dBm, 300 g. SOA p.298, Table 9-3. Antenna: Anteral 8x8 X-band patch, 500 g, SOA p.290, Table 9-2.",
    build_months: 4,          // GAME VALUE: months to build and test
    lead_months: 5   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple, a little longer than the S-band radio
  },

  // ------------------------------------------------------------------- computer
  {
    id: "obc-basic",
    name: "Basic flight computer",
    category: "computer",
    mass_kg: 0.1,            // ESTIMATE: one 9.6 x 9 cm circuit board
    power_draw_w: 0.4,
    power_gen_w: 0,
    cost_musd: 0.01,         // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 4,           // ESTIMATE
    science: 0,
    tags: [],
    protects: [],
    blurb: "Sips power and runs the spacecraft, but has no radiation hardening.",
    source: "AAC Clyde Space Kryten-M3: ARM Cortex-M3, 0.4 W, 9.59 x 9.02 cm. SOA p.260, Table 8-4. Mass and storage are ESTIMATES.",
    build_months: 2,          // GAME VALUE: months to build and test
    lead_months: 2   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple
  },
  {
    id: "obc-radtol",
    name: "Radiation-tolerant computer",
    category: "computer",
    mass_kg: 0.2,            // ESTIMATE
    power_draw_w: 1.3,
    power_gen_w: 0,
    cost_musd: 0.05,         // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 8,           // ESTIMATE
    science: 0,
    tags: [],
    protects: ["solar-storm"],
    blurb: "A fault-tolerant processor that shrugs off radiation hits.",
    source: "AAC Clyde Space Sirius OBC: fault-tolerant LEON3FT processor, 1.3 W, flown in LEO and on a lunar lander. SOA p.260, Table 8-4. Mass and storage are ESTIMATES.",
    build_months: 4,          // GAME VALUE: months to build and test
    lead_months: 6   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple, radiation-tolerant parts are slower
  },
  {
    id: "obc-payload",
    name: "Payload data computer",
    category: "computer",
    mass_kg: 1.325,
    power_draw_w: 4,
    power_gen_w: 0,
    cost_musd: 0.2,          // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 256,         // ESTIMATE
    science: 0,
    tags: [],
    protects: [],
    blurb: "Big memory and an FPGA to process images on board. Heavier and hungrier.",
    source: "Aerospacelab FPGA-based OBC (Belgium): under 4 W, 1.325 kg, 100 krad radiation tested. SOA p.260, Table 8-4. Storage is an ESTIMATE.",
    build_months: 4,          // GAME VALUE: months to build and test
    lead_months: 5   // GAME VALUE, no range quoted: kept well under the quoted 18 to 52 weeks because the part is simple
  },

  // ----------------------------------------------------------------- propulsion
  {
    id: "prop-green-small",
    name: "Small green thruster pack",
    category: "propulsion",
    mass_kg: 5,              // wet mass, SOA p.127
    power_draw_w: 15,        // maximum, SOA p.127
    power_gen_w: 0,
    cost_musd: 0.5,          // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: ["debris"],
    blurb: "A safe, non-toxic monopropellant. Enough to lower the orbit at end of life for a light satellite.",
    source: "VACCO 3U MiPS, LMP-103S propellant: 4 x 0.1 N, Isp 190 s, total impulse 3.3 kN-s, 5 kg wet, 15 W max. SOA p.127, Table 4-3. Fuel = 3300 / (190 x 9.81) = 1.77 kg.",
    isp_s: 190,
    fuel_kg: 1.77,
    build_months: 6,          // GAME VALUE: months to build and test
    lead_months: 8   // GAME VALUE, no range quoted: thrusters are specialised and slow, set at the top of the quoted 18 to 52 weeks
  },
  {
    id: "prop-green-large",
    name: "Large green thruster pack",
    category: "propulsion",
    mass_kg: 14.7,           // wet mass, SOA p.127
    power_draw_w: 50,        // maximum, SOA p.127
    power_gen_w: 0,
    cost_musd: 1.5,          // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: ["debris"],
    blurb: "Four 1 N thrusters and plenty of fuel. Heavy, but it moves a radar satellite.",
    source: "VACCO 11U MiPS, LMP-103S propellant: 4 x 1 N, Isp 200 s, total impulse 12 kN-s, 14.7 kg wet, 50 W max. SOA p.127, Table 4-3. Fuel = 12000 / (200 x 9.81) = 6.12 kg.",
    isp_s: 200,
    fuel_kg: 6.12,
    build_months: 8,          // GAME VALUE: months to build and test
    lead_months: 12   // GAME VALUE, no range quoted: thrusters are specialised and slow, set at the top of the quoted 18 to 52 weeks
  },
  {
    id: "prop-ion",
    name: "Iodine ion thruster",
    category: "propulsion",
    mass_kg: 2.9,            // wet mass, SOA p.133
    power_draw_w: 70,        // SOA p.133
    power_gen_w: 0,
    cost_musd: 0.8,          // ESTIMATE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],            // too little thrust (1 mN) to dodge debris in time
    blurb: "Ten times more efficient than chemical thrusters, but draws 70 W while it runs.",
    source: "Busek BIT-3 RF ion thruster, iodine: 1.0 mN, Isp 1,960 s, total impulse 31.7 kN-s, 2.9 kg wet, 70 W. SOA p.133, Table 4-9. Fuel = 31700 / (1960 x 9.81) = 1.65 kg.",
    isp_s: 1960,
    fuel_kg: 1.65,
    build_months: 9,          // GAME VALUE: months to build and test
    lead_months: 12   // GAME VALUE, no range quoted: thrusters are specialised and slow, set at the top of the quoted 18 to 52 weeks
  },
  {
    id: "topside-sounder",
    name: "Topside sounder (Alouette 1)",
    category: "instrument",
    mass_kg: 30,            // ESTIMATE
    power_draw_w: 10,      // ESTIMATE
    power_gen_w: 0,
    cost_musd: 2,          // GAME VALUE
    data_gb_day: 0.005,    // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 6,              // GAME VALUE
    tags: ["ionosphere"],
    protects: [],
    blurb: "A radio that sweeps from 0.5 to 11.5 MHz and listens for echoes from the ionosphere below, on antennas 45 m tip to tip. No tape recorder: a sounding counts only if a ground station hears it.",
    source: "CSA, Alouette 1 (1962): swept-frequency topside sounder, Canada's first satellite. https://www.asc-csa.gc.ca/eng/satellites/alouette.asp Mass, power and data are ESTIMATES.",
    build_months: 9,          // GAME VALUE: months to build and test
    lead_months: 8   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short but a specialised instrument
  },
  {
    id: "alouette-2-sounder",
    name: "Improved topside sounder (Alouette 2)",
    category: "instrument",
    mass_kg: 32,            // ESTIMATE
    power_draw_w: 10,      // ESTIMATE
    power_gen_w: 0,
    cost_musd: 2.5,          // GAME VALUE
    data_gb_day: 0.008,    // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 8,              // GAME VALUE
    tags: ["ionosphere"],
    protects: [],
    upgrade: { of: "topside-sounder", year: 1965, cost_musd: 2, cost_sci: 60, requires: [] },   // GAME VALUE costs
    blurb: "Alouette 2 swept from 0.1 to 14.5 MHz, deeper and wider than Alouette 1, and was built from Alouette 1's backup.",
    source: "CSA, Alouette 2 (1965): improved swept-frequency sounder. https://www.asc-csa.gc.ca/eng/satellites/alouette.asp Numbers are ESTIMATES.",
    build_months: 8,          // GAME VALUE: months to build and test
    lead_months: 8   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short but a specialised instrument
  },
  {
    id: "scintillation-counter",
    name: "Scintillation counter (Explorer 4)",
    category: "instrument",
    mass_kg: 3,            // ESTIMATE
    power_draw_w: 0.1,      // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.4,          // GAME VALUE
    data_gb_day: 4e-05,    // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 6,              // GAME VALUE
    tags: ["radiation"],
    protects: ["counter-silence"],
    upgrade: { of: "cosmic-ray-counter", year: 1958, cost_musd: 1, cost_sci: 40, requires: [] },   // GAME VALUE costs
    blurb: "After Explorer 1's counter was swamped, Van Allen's team flew counters built for intense radiation on Explorer 4. They mapped the belts instead of falling silent.",
    source: "NASA NSSDCA, Explorer 4 (1958-005A): scintillation and Geiger counters for high-intensity trapped radiation. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1958-005A Numbers are ESTIMATES.",
    build_months: 3,          // GAME VALUE: months to build and test
    lead_months: 3   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "avcs-camera",
    name: "Advanced vidicon camera system (Nimbus 1)",
    category: "instrument",
    mass_kg: 15,            // ESTIMATE
    power_draw_w: 8,      // ESTIMATE
    power_gen_w: 0,
    cost_musd: 2,          // GAME VALUE
    data_gb_day: 0.04,    // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 8,              // GAME VALUE
    tags: ["imaging"],
    protects: [],
    upgrade: { of: "vidicon-camera", year: 1964, cost_musd: 3, cost_sci: 90, requires: ["three-axis-control"] },   // GAME VALUE costs
    blurb: "Three cameras looking down from a satellite that always faced Earth: Nimbus 1 sent sharper, wider cloud pictures than TIROS ever could.",
    source: "NASA NSSDCA, Nimbus 1 (1964-052A): Advanced Vidicon Camera System. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1964-052A Numbers are ESTIMATES.",
    build_months: 8,          // GAME VALUE: months to build and test
    lead_months: 8   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short but a specialised instrument
  },
  {
    id: "oso-xray-spectrometer",
    name: "X-ray spectrometer (OSO 1)",
    category: "instrument",
    mass_kg: 6,            // ESTIMATE
    power_draw_w: 1,      // ESTIMATE
    power_gen_w: 0,
    cost_musd: 1,          // GAME VALUE
    data_gb_day: 0.0001,    // ESTIMATE
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 7,              // GAME VALUE
    tags: ["solar"],
    protects: [],
    upgrade: { of: "solar-xray-photometer", year: 1962, cost_musd: 2, cost_sci: 70, requires: [] },   // GAME VALUE costs
    blurb: "The first Orbiting Solar Observatory kept its instruments pointed at the Sun and split its X-rays by energy, not just counted them.",
    source: "NASA NSSDCA, OSO 1 (1962-006A): first Orbiting Solar Observatory. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1962-006A Numbers are ESTIMATES.",
    build_months: 6,          // GAME VALUE: months to build and test
    lead_months: 6   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short but a specialised instrument
  },
  {
    id: "pcm-telemetry",
    name: "PCM digital telemetry",
    category: "comms",
    mass_kg: 3,            // ESTIMATE
    power_draw_w: 5,      // ESTIMATE
    power_gen_w: 0,
    cost_musd: 0.5,          // GAME VALUE
    data_gb_day: 0,    // ESTIMATE
    downlink_gb_day: 1.0,
    storage_gb: 0,
    science: 0,              // GAME VALUE
    tags: [],
    protects: [],
    upgrade: { of: "vhf-telemetry", year: 1964, cost_musd: 1, cost_sci: 50, requires: [] },   // GAME VALUE costs
    blurb: "Digital pulse-code telemetry replaced analog tones in the mid-1960s, sending twice the data on the same power.",
    source: "NASA NSSDCA, OGO 1 (1964-054A) used digital PCM telemetry. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1964-054A Numbers are ESTIMATES.",
    build_months: 3,          // GAME VALUE: months to build and test
    lead_months: 3   // GAME VALUE, no range quoted: a 1950s part, ordered from a bench shop; kept short
  },
  {
    id: "n-on-p-cells",
    name: "Radiation-hard n-on-p solar cells",
    category: "power",
    mass_kg: 3,              // ESTIMATE
    power_draw_w: 0,
    power_gen_w: 0,          // computed by game.js: 1361 x 0.2 x 0.10 = 27.2 W
    cost_musd: 0.6,          // GAME VALUE
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: ["solar-storm"],
    upgrade: { of: "silicon-cells", year: 1963, cost_musd: 1.5, cost_sci: 50, requires: [] },   // GAME VALUE costs
    blurb: "In 1962 a high-altitude nuclear test filled the belts with electrons and killed the solar cells of several satellites, Telstar 1 among them. Cells built the other way round, n-on-p, shrugged the radiation off.",
    source: "Starfish Prime (July 1962) damaged satellites including Telstar 1; n-on-p silicon cells were adopted for their radiation resistance. Area and efficiency are ESTIMATES.",
    panel_area_m2: 0.2,      // ESTIMATE
    efficiency: 0.10,        // ESTIMATE
    build_months: 3,          // GAME VALUE: months to build and test
    lead_months: 9   // GAME VALUE rounded from the engineers' quote and the web sources in docs/real-world-plan.md: space-grade solar cells 26 to 52 weeks, up to 18 months in the 2025-26 boom, about 9 months
  }
];
