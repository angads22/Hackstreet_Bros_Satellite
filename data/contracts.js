// data/contracts.js — Part 2, Ajay's comeback (SPEC.md, "Two game modes").
// The customers who will pay Albert Orbital for data, by topic (an objective id in
// data/objectives.js). Present-day clients with real problems; each reason is one line.
// js/mission.js turns these into the hub's contracts: the price, the minimum of data,
// the orbit and the month it expires are computed there, not written here.

const CONTRACTS = {
  radiation: [
    { client: "A satellite operator", reason: "Its fleet keeps rebooting in the radiation belts; it needs a map to fly around." },
    { client: "A long-haul airline", reason: "It checks the radiation dose its crews take on polar routes." },
    { client: "A space station operator", reason: "It needs to know when to send its crew into the storm shelter." },
    { client: "A space insurer", reason: "It prices satellite policies by how much radiation each orbit soaks up." }
  ],
  solar: [
    { client: "A power grid operator", reason: "A solar storm burned out one of its transformers; it wants warning next time." },
    { client: "A pipeline company", reason: "Solar storms drive currents that corrode its pipes; it plans repairs by the Sun." },
    { client: "A space weather forecaster", reason: "It sells storm alerts and wants its own eye on the Sun's X-rays." },
    { client: "A satellite radio broadcaster", reason: "Solar flares break up its signal; it wants to see them coming." }
  ],
  weather: [
    { client: "A farmers' co-operative", reason: "It times the harvest around the rain and needs better forecasts." },
    { client: "An airline", reason: "It reroutes flights around storms and wants to see them forming." },
    { client: "A solar farm operator", reason: "It sells power a day ahead and must know where the clouds will be." },
    { client: "A shipping insurer", reason: "It warns ships of storms far out at sea, where weather stations are few." }
  ],
  wildfire: [
    { client: "A home insurer", reason: "It prices fire risk for homes at the edge of the forest." },
    { client: "A regional fire service", reason: "It needs hot spots overnight, before the morning patrol flies." },
    { client: "A power utility", reason: "Its lines cross dry forest; it must see a fire before the wind spreads it." },
    { client: "A timber company", reason: "It watches its forests for new fires far from any road." }
  ],
  "sea-ice": [
    { client: "A shipping line", reason: "It routes cargo ships through the Arctic and must know where the ice is." },
    { client: "A coast guard", reason: "It plans Arctic rescues and needs ice maps through the polar night." },
    { client: "A northern community council", reason: "Its hunters travel on the sea ice and need to know where it is thin." },
    { client: "An Arctic cruise company", reason: "It needs safe routes between the floes before it sells the tickets." }
  ],
  ionosphere: [
    { client: "A GPS navigation firm", reason: "Its positions drift when a solar storm stirs up the ionosphere." },
    { client: "A ham radio league", reason: "Its members want to know when the ionosphere will carry their signals." },
    { client: "A precision farming company", reason: "Its self-steering tractors lose their place when the ionosphere shifts." },
    { client: "A shortwave broadcaster", reason: "It bounces programmes off the ionosphere and needs to know how high it is." }
  ]
};
