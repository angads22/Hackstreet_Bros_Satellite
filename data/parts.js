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
//
// The spacecraft structure, attitude control and wiring are not modelled.

const PARTS = [
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
    wavelength_m: 0.00001    // 10 micrometres, long-wave infrared (physics)
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
    wavelength_m: 0.031      // 9.65 GHz X-band (c / f)
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
    wavelength_m: 0.00000055 // 550 nm, visible light (physics)
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
    efficiency: 0.204        // panel-level: cells (about 30%, SOA p.48) minus gaps and wiring
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
    efficiency: 0.228
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
    battery_wh: 560
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
    source: "GomSpace NanoCom AX100: up to 38.4 kbit/s, 30 dBm, 24.5 g. SOA p.294, Table 9-3."
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
    source: "AAC Clyde Space TX-2400: 6,000 kbit/s, 2.5 W, 70 g. SOA p.296, Table 9-3. Antenna: Anteral S-band patch, 150 g, SOA p.289, Table 9-2."
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
    source: "Tethers Unlimited SWIFT-XTX: 25,000 kbit/s, 33 dBm, 300 g. SOA p.298, Table 9-3. Antenna: Anteral 8x8 X-band patch, 500 g, SOA p.290, Table 9-2."
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
    source: "AAC Clyde Space Kryten-M3: ARM Cortex-M3, 0.4 W, 9.59 x 9.02 cm. SOA p.260, Table 8-4. Mass and storage are ESTIMATES."
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
    source: "AAC Clyde Space Sirius OBC: fault-tolerant LEON3FT processor, 1.3 W, flown in LEO and on a lunar lander. SOA p.260, Table 8-4. Mass and storage are ESTIMATES."
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
    source: "Aerospacelab FPGA-based OBC (Belgium): under 4 W, 1.325 kg, 100 krad radiation tested. SOA p.260, Table 8-4. Storage is an ESTIMATE."
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
    fuel_kg: 1.77
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
    fuel_kg: 6.12
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
    protects: ["debris"],
    blurb: "Ten times more efficient than chemical thrusters, but draws 70 W while it runs.",
    source: "Busek BIT-3 RF ion thruster, iodine: 1.0 mN, Isp 1,960 s, total impulse 31.7 kN-s, 2.9 kg wet, 70 W. SOA p.133, Table 4-9. Fuel = 31700 / (1960 x 9.81) = 1.65 kg.",
    isp_s: 1960,
    fuel_kg: 1.65
  }
];
