// data/events.js — owned by Story. DRAFT written so the simulation can run;
// Story rewrites the text freely. Allowed effect keys (SPEC.md): lose_months,
// science_mult, cost_musd, fail_chance, fails. `fails` names a part category.
// A part whose `protects` list names an event cancels the riskiest choice's penalty.
// orbit_weight: how likely the event is in each orbit, relative to 1 (GAME VALUES).
// A missing orbit_weight counts as 1 everywhere.
// objectives: optional list of topic ids; the event then fires only on those missions.
// Text names no part the satellite may not carry (an event can fire on any design for its topic): "your counter",
// "your instrument", "the computer", never a Geiger counter, a tape recorder, a hinged panel or an infrared channel.

const EVENTS = [
  // ------------------------------------------------ era events, tied to one topic each
  {
    id: "counter-silence",
    objectives: ["radiation"],
    title: "The counter goes silent",
    text: "High up, your counter reads zero, then recovers lower down. Broken, or swamped?",
    choices: [
      { label: "Discard those passes", effect: { science_mult: 0.6 } },
      { label: "Trust it: silence is data",   effect: {} }
    ]
  },
  {
    id: "spin-wobble",
    objectives: ["weather"],
    title: "Satellite wobbles",
    text: "The rocket stage bumped you. Your cloud pictures are smeared.",
    choices: [
      { label: "Live with it",           effect: { science_mult: 0.6 } },
      { label: "Damp it by command",    effect: { fail_chance: 0.3, fails: "instrument" } }
    ]
  },
  {
    id: "xray-flare",
    objectives: ["solar"],
    title: "Great solar flare",
    text: "A huge flare. Watching it could damage the instrument.",
    choices: [
      { label: "Keep watching",  effect: { science_mult: 1.3, fail_chance: 0.25, fails: "instrument" } },
      { label: "Protect it",  effect: { lose_months: 1 } }
    ]
  },

  {
    id: "solar-storm",
    orbit_weight: { leo: 1, sso: 1.5, geo: 2 },   // poles and GEO are less shielded by Earth's magnetic field
    title: "Solar storm",
    text: "Charged particles are coming. Running electronics could be scrambled.",
    choices: [
      { label: "Shut down", effect: { lose_months: 1 } },
      { label: "Keep observing",        effect: { fail_chance: 0.4, fails: "computer" } }
    ]
  },
  {
    id: "debris",
    orbit_weight: { leo: 1.5, sso: 2, geo: 0.3 },   // the 700-900 km band is the most crowded
    title: "Debris warning",
    text: "Old rocket debris passes within 200 metres. A hit would be fatal.",
    choices: [
      { label: "Pay for a dodge", effect: { cost_musd: 0.3 } },
      { label: "Trust the odds",               effect: { fail_chance: 0.2, fails: "instrument" } }
    ]
  },
  {
    id: "ground-outage",
    title: "Ground station down",
    text: "A storm wrecked your dish. Repairs take weeks.",
    choices: [
      { label: "Rent another network", effect: { cost_musd: 0.5 } },
      { label: "Wait",              effect: { lose_months: 2 } }
    ]
  },
  {
    id: "stuck-hinge",
    title: "Power fault",
    text: "A short is cutting the power your instruments get.",
    choices: [
      { label: "Switch circuits", effect: { fail_chance: 0.3, fails: "power" } },
      { label: "Live with less",          effect: { science_mult: 0.8 } }
    ]
  },
  {
    id: "software-bug",
    title: "Software bug",
    text: "The computer reboots every few days. The fix is barely tested.",
    choices: [
      { label: "Upload the fix",            effect: { fail_chance: 0.2, fails: "computer" } },
      { label: "Test it first",    effect: { lose_months: 1 } }
    ]
  },
  {
    id: "contamination",
    title: "Outgassing",
    text: "Gas from the craft's own materials is fogging the instrument.",
    choices: [
      { label: "Bake it off", effect: { lose_months: 1 } },
      { label: "Live with it",     effect: { science_mult: 0.85 } }
    ]
  },
  {
    id: "budget-cut",
    title: "Budget cut",
    text: "The agency wants your mission to save money.",
    choices: [
      { label: "Shrink the team", effect: { science_mult: 0.9 } },
      { label: "Find the money",   effect: { cost_musd: 1 } }
    ]
  },
  {
    id: "calibration-drift",
    title: "Calibration drift",
    text: "Readings are drifting. Fixing it means pausing observations.",
    choices: [
      { label: "Pause and fix",          effect: { lose_months: 1 } },
      { label: "Keep going", effect: { science_mult: 0.8 } }   // GAME VALUE: to be agreed with the Simulation owner
    ]
  },

  // ------------------------------------------------ more topic events (added November 15: each topic gets its own stories)
  {
    id: "ion-antennas",
    objectives: ["ionosphere"],
    title: "Stuck antenna",
    text: "A 45 m antenna will not fully unroll. Echoes come back lopsided.",
    choices: [
      { label: "Try again", effect: { fail_chance: 0.3, fails: "instrument" } },
      { label: "Fly one short",                  effect: { science_mult: 0.75 } }
    ]
  },
  {
    id: "ion-aurora",
    objectives: ["ionosphere"],
    title: "Auroral roar",
    text: "Natural radio noise drowns the echoes. It may be science too.",
    choices: [
      { label: "Record the noise", effect: { cost_musd: 0.3, science_mult: 1.15 } },
      { label: "Filter it out",          effect: { science_mult: 0.85 } }
    ]
  },
  {
    id: "ion-blizzard",
    objectives: ["ionosphere"],
    title: "Blizzard at Resolute Bay",
    text: "Your busiest station loses its dish. It heard one sounding in five.",
    choices: [
      { label: "Re-route to Fairbanks", effect: { cost_musd: 0.4 } },
      { label: "Wait for rebuild",                effect: { lose_months: 1 } }
    ]
  },
  {
    id: "rad-rival",
    objectives: ["radiation"],
    title: "A rival sees the belts",
    text: "Another satellite reports the same radiation. Publish now, or verify first?",
    choices: [
      { label: "Publish now", effect: { cost_musd: 0.5, science_mult: 1.2 } },
      { label: "Verify first",                                              effect: {} }
    ]
  },
  {
    id: "rad-belt",
    objectives: ["radiation"],
    title: "Belt bigger than predicted",
    text: "Readings climb past every forecast. The counter is warming up.",
    choices: [
      { label: "Skip worst passes", effect: { science_mult: 0.7 } },
      { label: "Keep it on",           effect: { science_mult: 1.3, fail_chance: 0.25, fails: "instrument" } }
    ]
  },
  {
    id: "wx-hurricane",
    objectives: ["weather"],
    title: "Hurricane under the camera",
    text: "A hurricane sits right under your orbit. Nobody has seen one whole.",
    choices: [
      { label: "Shoot every pass",                         effect: { science_mult: 1.3, fail_chance: 0.2, fails: "computer" } },
      { label: "Usual schedule",                  effect: {} }
    ]
  },
  {
    id: "wx-tape",
    objectives: ["weather"],
    title: "Picture store jams",
    text: "The computer holding pictures keeps jamming. Without it, only live pictures.",
    choices: [
      { label: "Reset and hope",                        effect: { fail_chance: 0.3, fails: "computer" } },
      { label: "Live pictures only",    effect: { science_mult: 0.7 } }
    ]
  },
  {
    id: "sol-spots",
    objectives: ["solar"],
    title: "Giant sunspot group",
    text: "A sunspot bigger than Jupiter turns into view. A flare may follow.",
    choices: [
      { label: "Retarget now", effect: { cost_musd: 0.3, science_mult: 1.25 } },
      { label: "Stay the course",                     effect: {} }
    ]
  },
  {
    id: "fire-smoke",
    objectives: ["wildfire"],
    title: "Smoke over the target",
    text: "Smoke from a huge fire hides the region. Ordinary cameras see grey.",
    choices: [
      { label: "Wait it out",                         effect: { lose_months: 1 } },
      { label: "Observe anyway",           effect: { science_mult: 0.85 } }
    ]
  },
  {
    id: "ice-edge",
    objectives: ["sea-ice"],
    title: "The ice edge moves",
    text: "A storm broke up the pack. The coast guard wants a map now.",
    choices: [
      { label: "Map it now", effect: { cost_musd: 0.4, science_mult: 1.25 } },
      { label: "Keep schedule",                        effect: {} }
    ]
  },
  {
    id: "rare-alignment",
    title: "A rare alignment",
    text: "Sun, Moon and orbit line up for days. Extra commanding needed.",
    choices: [
      { label: "Do it",  effect: { science_mult: 1.3, fail_chance: 0.2, fails: "computer" } },
      { label: "Skip it",        effect: {} }
    ]
  }
];
