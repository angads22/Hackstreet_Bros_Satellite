// data/parts.js — owned by Data.
// PLACEHOLDER VALUES. Not real specs. Each number needs a checked source before it stays.

const PARTS = [
  {
    id: "thermal-basic",
    name: "Thermal imager",
    category: "instrument",
    mass_kg: 25,
    power_draw_w: 60,
    power_gen_w: 0,
    cost_musd: 18,
    data_gb_day: 12,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 6,
    tags: ["thermal"],
    protects: [],
    blurb: "Sees heat through smoke, but images are coarse.",
    source: "TODO: placeholder, needs a checked source",
    aperture_m: 0.1,
    wavelength_m: 0.00001
  },
  {
    id: "solar-small",
    name: "Small solar array",
    category: "power",
    mass_kg: 8,
    power_draw_w: 0,
    power_gen_w: 0,          // computed by game.js from panel_area_m2 and efficiency
    cost_musd: 4,
    data_gb_day: 0,
    downlink_gb_day: 0,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "Light and cheap, but only enough for a modest payload.",
    source: "TODO: placeholder, needs a checked source",
    panel_area_m2: 0.5,
    efficiency: 0.28
  },
  {
    id: "radio-sband",
    name: "S-band radio",
    category: "comms",
    mass_kg: 3,
    power_draw_w: 15,
    power_gen_w: 0,
    cost_musd: 2,
    data_gb_day: 0,
    downlink_gb_day: 10,
    storage_gb: 0,
    science: 0,
    tags: [],
    protects: [],
    blurb: "Reliable and simple, with a narrow data pipe.",
    source: "TODO: placeholder, needs a checked source"
  }
];
