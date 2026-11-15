// data/contracts.js — Part 2, Ajay's comeback (SPEC.md, "Two game modes").
// The customers who will pay Albert Orbital for data, by topic (an objective id in
// data/objectives.js). Present-day clients with real problems; each reason is one line.
// js/mission.js turns these into the hub's contracts: the price, the minimum of data,
// the orbit and the month it expires are computed there, not written here.

const CONTRACTS = {
  radiation: [
    { client: "A satellite operator", reason: "Its fleet reboots in the belts. It needs a map." },
    { client: "A long-haul airline", reason: "It checks the dose its crews take on polar routes." },
    { client: "A space station operator", reason: "It must know when to send crew to the storm shelter." },
    { client: "A space insurer", reason: "It prices policies by each orbit's radiation." },
    { client: "A chip maker", reason: "It wants the real dose to test chips, not a model." },
    { client: "A space tourism company", reason: "It must tell passengers the dose past the belts." }
  ],
  solar: [
    { client: "A power grid operator", reason: "A storm burned out a transformer. It wants warning." },
    { client: "A pipeline company", reason: "Storm currents corrode its pipes. It plans repairs by the Sun." },
    { client: "A space weather forecaster", reason: "It sells storm alerts and wants its own eye on the Sun." },
    { client: "A satellite radio broadcaster", reason: "Flares break up its signal. It wants to see them coming." },
    { client: "A mobile network operator", reason: "Storms jam the timing signals its towers use." },
    { client: "An aurora tour company", reason: "It sells aurora trips and wants to know when the Sun puts on a show." }
  ],
  weather: [
    { client: "A farmers' co-operative", reason: "It times the harvest around rain and needs better forecasts." },
    { client: "An airline", reason: "It reroutes flights around storms and wants to see them form." },
    { client: "A solar farm operator", reason: "It sells power a day ahead and must know where clouds will be." },
    { client: "A shipping insurer", reason: "It warns ships of storms where weather stations are few." },
    { client: "A wind farm operator", reason: "It needs the wind a day ahead. Its sensors stop at the coast." },
    { client: "A music festival", reason: "Last summer an unseen storm sent the crowd home." }
  ],
  wildfire: [
    { client: "A home insurer", reason: "It prices fire risk for homes by the forest." },
    { client: "A regional fire service", reason: "It needs hot spots overnight, before the morning patrol." },
    { client: "A power utility", reason: "Its lines cross dry forest. It must see fires early." },
    { client: "A timber company", reason: "It watches for new fires far from any road." },
    { client: "A vineyard co-operative", reason: "Smoke ruins its grapes. It wants fires seen before the wind turns." },
    { client: "A mountain village council", reason: "It wants fires reported at dawn, before evacuation roads fill." }
  ],
  "sea-ice": [
    { client: "A shipping line", reason: "It routes cargo ships through the Arctic and must know where the ice is." },
    { client: "A coast guard", reason: "It plans Arctic rescues and needs ice maps through the polar night." },
    { client: "A northern community council", reason: "Its hunters travel on sea ice and need to know where it is thin." },
    { client: "An Arctic cruise company", reason: "It needs safe routes between floes before selling tickets." },
    { client: "A fishing fleet", reason: "It sails north in spring and needs to know where ice has pulled back." },
    { client: "A polar research station", reason: "Its supply ship waits on the ice. When does the lane open?" }
  ],
  ionosphere: [
    { client: "A GPS navigation firm", reason: "Its positions drift when a storm stirs the ionosphere." },
    { client: "A ham radio league", reason: "Members want to know when the ionosphere will carry signals." },
    { client: "A precision farming company", reason: "Its self-steering tractors lose their place when it shifts." },
    { client: "A shortwave broadcaster", reason: "It bounces programmes off the ionosphere and needs its height." },
    { client: "An airline's radio desk", reason: "Its polar flights lose radio when it stirs. It wants a forecast." },
    { client: "A drone survey firm", reason: "Its drones lose their position fix and land in the field." }
  ]
};
