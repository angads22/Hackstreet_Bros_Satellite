// data/events.js — owned by Story. DRAFT written so the simulation can run;
// Story rewrites the text freely. Allowed effect keys (SPEC.md): lose_months,
// science_mult, cost_musd, fail_chance, fails. `fails` names a part category.
// A part whose `protects` list names an event cancels the riskiest choice's penalty.
// orbit_weight: how likely the event is in each orbit, relative to 1 (GAME VALUES).
// A missing orbit_weight counts as 1 everywhere.

const EVENTS = [
  {
    id: "solar-storm",
    orbit_weight: { leo: 1, sso: 1.5, geo: 2 },   // poles and GEO are less shielded by Earth's magnetic field
    title: "Solar storm",
    text: "The Sun has flung a cloud of charged particles toward Earth. Electronics left running could be scrambled.",
    choices: [
      { label: "Shut instruments down", effect: { lose_months: 1 } },
      { label: "Keep observing",        effect: { fail_chance: 0.4, fails: "computer" } }
    ]
  },
  {
    id: "debris",
    orbit_weight: { leo: 1.5, sso: 2, geo: 0.3 },   // the 700-900 km band is the most crowded
    title: "Debris warning",
    text: "Tracking stations warn that a piece of old rocket will pass within 200 metres. A hit would be catastrophic.",
    choices: [
      { label: "Pay the team to plan a dodge", effect: { cost_musd: 0.3 } },
      { label: "Trust the odds",               effect: { fail_chance: 0.2, fails: "instrument" } }
    ]
  },
  {
    id: "ground-outage",
    title: "Ground station outage",
    text: "A storm has damaged your ground station's dish. Repairs will take weeks.",
    choices: [
      { label: "Rent time on another network", effect: { cost_musd: 0.5 } },
      { label: "Wait for repairs",              effect: { lose_months: 2 } }
    ]
  },
  {
    id: "stuck-hinge",
    title: "Stuck panel hinge",
    text: "A solar panel hinge has jammed partway open, and you are getting less sunlight.",
    choices: [
      { label: "Rock the spacecraft to free it", effect: { fail_chance: 0.3, fails: "power" } },
      { label: "Live with less power",          effect: { science_mult: 0.8 } }
    ]
  },
  {
    id: "software-bug",
    title: "Software bug",
    text: "A bug makes the computer reboot every few days. A fix is ready but has barely been tested.",
    choices: [
      { label: "Upload the fix now",            effect: { fail_chance: 0.2, fails: "computer" } },
      { label: "Test it first in safe mode",    effect: { lose_months: 1 } }
    ]
  },
  {
    id: "contamination",
    title: "Fogged optics",
    text: "Gas from the spacecraft's own materials has fogged the instrument. Images are getting blurry.",
    choices: [
      { label: "Bake it off with heaters", effect: { lose_months: 1 } },
      { label: "Live with blurry data",     effect: { science_mult: 0.85 } }
    ]
  },
  {
    id: "budget-cut",
    title: "Budget cut",
    text: "The agency is short of money and wants your mission to save some.",
    choices: [
      { label: "Shrink the operations team", effect: { science_mult: 0.9 } },
      { label: "Find the money elsewhere",   effect: { cost_musd: 1 } }
    ]
  }
];
