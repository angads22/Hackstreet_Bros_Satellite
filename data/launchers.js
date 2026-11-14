// data/launchers.js — owned by Data (yarmee).
// Launch prices change often and these pages could not all be opened from the
// build environment, so every source below needs a person to open and confirm it.

const LAUNCHERS = [
  {
    id: "rideshare",
    name: "Rideshare slot",
    cost_musd: 0.35,
    capacity_kg: { leo: 50, sso: 50, geo: 0 },  // 0 = cannot reach
    blurb: "The cheapest ride to space, but only for 50 kg, and you go where the big rocket goes.",
    source: "SpaceX rideshare to SSO: $350,000 for the first 50 kg (early-2026 pricing, third-party report: https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/). Official page: https://rideshare.spacex.com. LEO slot assumes a Bandwagon mid-inclination flight. NEEDS HUMAN CHECK."
  },
  {
    id: "small",
    name: "Small dedicated launcher",
    cost_musd: 7.5,
    capacity_kg: { leo: 300, sso: 200, geo: 0 },
    blurb: "A whole rocket just for you: any orbit you like, up to 200 kg to polar orbit.",
    source: "Rocket Lab Electron: about 200 kg to 500 km SSO, about 300 kg to LEO, about $7.5M per launch (https://www.eoportal.org/other-space-activities/rocket-lab). NEEDS HUMAN CHECK against Rocket Lab's current figures."
  },
  {
    id: "heavy",
    name: "Medium-lift rocket",
    cost_musd: 69.75,
    capacity_kg: { leo: 22800, sso: 15000, geo: 5500 },
    blurb: "The only way to geostationary orbit here. Plenty of room, eye-watering price.",
    source: "SpaceX Falcon 9: $69.75M standard price, 22,800 kg to LEO, 5,500 kg to GTO with booster recovery (https://www.spacex.com/vehicles/falcon-9/ and SpaceX capabilities page). SSO figure is an ESTIMATE. The game treats GTO capacity as reaching GEO and skips the transfer burn. NEEDS HUMAN CHECK."
  }
];
