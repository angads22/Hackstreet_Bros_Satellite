// data/launchers.js — owned by Data (yarmee).
// Launch prices change often and these pages could not all be opened from the
// build environment, so every source below needs a person to open and confirm it.

const LAUNCHERS = [
  // ---------------------------------------------------------------- 1957-1960 era
  // Capacities are the masses these rockets really flew; prices are GAME VALUES.
  {
    id: "juno-1",
    name: "Juno I",
    cost_musd: 3,
    capacity_kg: { leo: 15, sso: 0, geo: 0 },
    blurb: "A Redstone missile with small solid rockets on top. It put Explorer 1 in orbit.",
    source: "NASA, Explorer 1 overview: launched on a Juno (Redstone first stage with Baby Sergeant upper stages); Explorer 1 was 13.97 kg. https://www.nasa.gov/history/explorer-1-overview/ Capacity rounded up from the flown mass; price is a GAME VALUE."
  },
  {
    id: "vanguard-rocket",
    name: "Vanguard",
    cost_musd: 2.5,
    capacity_kg: { leo: 11, sso: 0, geo: 0 },
    blurb: "The Navy's own satellite rocket. Small and temperamental.",
    source: "NASA NSSDCA, Vanguard 2: a 10.75 kg satellite launched by Vanguard in 1959. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1959-001A Capacity rounded from the flown mass; price is a GAME VALUE."
  },
  {
    id: "thor-able",
    name: "Thor-Able",
    cost_musd: 6,
    capacity_kg: { leo: 130, sso: 0, geo: 0 },
    blurb: "A missile with upper stages: room for a real weather satellite.",
    source: "NASA NSSDCA, TIROS 1: 122.5 kg, launched on a Thor in 1960. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B Capacity rounded from the flown mass; price is a GAME VALUE."
  },
  {
    id: "thor-agena",
    name: "Thor-Agena",
    cost_musd: 9,
    capacity_kg: { leo: 750, sso: 300, geo: 0 },
    blurb: "Thor plus a restartable Agena: the first ride to polar orbit.",
    source: "Thor-Agena launched the first polar-orbiting satellites from 1959. Capacities are ESTIMATES; price is a GAME VALUE. NEEDS A CHECKED SOURCE."
  },

  {
    id: "rideshare",
    name: "Rideshare slot",
    cost_musd: 0.35,
    capacity_kg: { leo: 50, sso: 50, geo: 0 },  // 0 = cannot reach
    blurb: "Cheapest ride, but only 50 kg, and you go where the big rocket goes.",
    source: "SpaceX rideshare to SSO: $350,000 for the first 50 kg (early-2026 pricing, third-party report: https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/). Official page: https://rideshare.spacex.com. LEO slot assumes a Bandwagon mid-inclination flight. NEEDS HUMAN CHECK."
  },
  {
    id: "small",
    name: "Small dedicated launcher",
    cost_musd: 7.5,
    capacity_kg: { leo: 300, sso: 200, geo: 0 },
    blurb: "A rocket just for you: any orbit, up to 200 kg to polar.",
    source: "Rocket Lab Electron: about 200 kg to 500 km SSO, about 300 kg to LEO, about $7.5M per launch (https://www.eoportal.org/other-space-activities/rocket-lab). NEEDS HUMAN CHECK against Rocket Lab's current figures."
  },
  {
    id: "heavy",
    name: "Medium-lift rocket",
    cost_musd: 69.75,
    capacity_kg: { leo: 22800, sso: 15000, geo: 5500 },
    blurb: "The only way to geostationary orbit here. Roomy, and very expensive.",
    source: "SpaceX Falcon 9: $69.75M standard price, 22,800 kg to LEO, 5,500 kg to GTO with booster recovery (https://www.spacex.com/vehicles/falcon-9/ and SpaceX capabilities page). SSO figure is an ESTIMATE. The game treats GTO capacity as reaching GEO and skips the transfer burn. NEEDS HUMAN CHECK."
  }
];
