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
    { client: "A space insurer", reason: "It prices satellite policies by how much radiation each orbit soaks up." },
    { client: "A chip maker", reason: "It tests its chips against the belts and wants the real dose, not a model." },
    { client: "A space tourism company", reason: "It sells rides past the belts and must tell its passengers what dose to expect." }
  ],
  solar: [
    { client: "A power grid operator", reason: "A solar storm burned out one of its transformers; it wants warning next time." },
    { client: "A pipeline company", reason: "Solar storms drive currents that corrode its pipes; it plans repairs by the Sun." },
    { client: "A space weather forecaster", reason: "It sells storm alerts and wants its own eye on the Sun's X-rays." },
    { client: "A satellite radio broadcaster", reason: "Solar flares break up its signal; it wants to see them coming." },
    { client: "A mobile network operator", reason: "Solar storms jam the timing signals its towers lean on; it wants a warning." },
    { client: "An aurora tour company", reason: "It sells northern lights trips and wants to know when the Sun puts on a show." }
  ],
  weather: [
    { client: "A farmers' co-operative", reason: "It times the harvest around the rain and needs better forecasts." },
    { client: "An airline", reason: "It reroutes flights around storms and wants to see them forming." },
    { client: "A solar farm operator", reason: "It sells power a day ahead and must know where the clouds will be." },
    { client: "A shipping insurer", reason: "It warns ships of storms far out at sea, where weather stations are few." },
    { client: "A wind farm operator", reason: "It must know the wind a day ahead, and its sensors stop at the coast." },
    { client: "A music festival", reason: "Last summer a storm nobody saw coming sent the crowd home." }
  ],
  wildfire: [
    { client: "A home insurer", reason: "It prices fire risk for homes at the edge of the forest." },
    { client: "A regional fire service", reason: "It needs hot spots overnight, before the morning patrol flies." },
    { client: "A power utility", reason: "Its lines cross dry forest; it must see a fire before the wind spreads it." },
    { client: "A timber company", reason: "It watches its forests for new fires far from any road." },
    { client: "A vineyard co-operative", reason: "Smoke ruins its grapes; it wants to see fires before the wind turns." },
    { client: "A mountain village council", reason: "It wants fires reported at dawn, before the evacuation roads fill." }
  ],
  "sea-ice": [
    { client: "A shipping line", reason: "It routes cargo ships through the Arctic and must know where the ice is." },
    { client: "A coast guard", reason: "It plans Arctic rescues and needs ice maps through the polar night." },
    { client: "A northern community council", reason: "Its hunters travel on the sea ice and need to know where it is thin." },
    { client: "An Arctic cruise company", reason: "It needs safe routes between the floes before it sells the tickets." },
    { client: "A fishing fleet", reason: "It sails north in spring and needs to know where the ice has pulled back." },
    { client: "A polar research station", reason: "Its supply ship waits on the ice; it wants to know when the lane opens." }
  ],
  ionosphere: [
    { client: "A GPS navigation firm", reason: "Its positions drift when a solar storm stirs up the ionosphere." },
    { client: "A ham radio league", reason: "Its members want to know when the ionosphere will carry their signals." },
    { client: "A precision farming company", reason: "Its self-steering tractors lose their place when the ionosphere shifts." },
    { client: "A shortwave broadcaster", reason: "It bounces programmes off the ionosphere and needs to know how high it is." },
    { client: "An airline's radio desk", reason: "Its polar flights lose radio when the ionosphere stirs; it wants a forecast." },
    { client: "A drone survey firm", reason: "Its drones lose their position fix in the ionosphere and land in the field." }
  ]
};
