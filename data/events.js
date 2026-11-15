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
    text: "High over the Earth your counter suddenly reads zero, then starts again lower down. Is it broken, or is something up there so intense it swamps the counter?",
    choices: [
      { label: "Assume it is broken and discard those passes", effect: { science_mult: 0.6 } },
      { label: "Trust the instrument: the silence is data",   effect: {} }
    ]
  },
  {
    id: "spin-wobble",
    objectives: ["weather"],
    title: "A wobbling satellite",
    text: "The spent rocket stage bumped your satellite as it separated, and now it wobbles. Your cloud pictures are smeared.",
    choices: [
      { label: "Live with the smeared data",           effect: { science_mult: 0.6 } },
      { label: "Try to damp the wobble by command",    effect: { fail_chance: 0.3, fails: "instrument" } }
    ]
  },
  {
    id: "xray-flare",
    objectives: ["solar"],
    title: "A great solar flare",
    text: "The Sun has erupted in one of the largest flares ever seen. Your instrument could catch it, but the burst of particles that follows may damage it.",
    choices: [
      { label: "Keep watching through the flare",  effect: { science_mult: 1.3, fail_chance: 0.25, fails: "instrument" } },
      { label: "Protect the instrument and wait",  effect: { lose_months: 1 } }
    ]
  },

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
    title: "A power fault",
    text: "A short in the power system is cutting the power your instruments get.",
    choices: [
      { label: "Switch circuits to clear it", effect: { fail_chance: 0.3, fails: "power" } },
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
    title: "Outgassing",
    text: "Gas from the spacecraft's own materials is settling on the instrument, and its readings are getting worse.",
    choices: [
      { label: "Bake it off with heaters", effect: { lose_months: 1 } },
      { label: "Live with poorer data",     effect: { science_mult: 0.85 } }
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
  },
  {
    id: "calibration-drift",
    title: "Instrument calibration problem",
    text: "An instrument's readings have begun to drift away from the truth. A demonstration is coming, and recalibrating means pausing observations.",
    choices: [
      { label: "Pause and recalibrate",          effect: { lose_months: 1 } },
      { label: "Continue with reduced accuracy", effect: { science_mult: 0.8 } }   // GAME VALUE: to be agreed with the Simulation owner
    ]
  },

  // ------------------------------------------------ more topic events (added November 15: each topic gets its own stories)
  {
    id: "ion-antennas",
    objectives: ["ionosphere"],
    title: "The long antennas",
    text: "Your sounder's antennas, like Alouette's, are 45 metres from tip to tip, rolled up like tape measures. One refuses to unroll all the way, and the echoes come back lopsided.",
    choices: [
      { label: "Command it to extend again, and risk a jam", effect: { fail_chance: 0.3, fails: "instrument" } },
      { label: "Fly with one short antenna",                  effect: { science_mult: 0.75 } }
    ]
  },
  {
    id: "ion-aurora",
    objectives: ["ionosphere"],
    title: "Roar over the auroral zone",
    text: "Over the polar stations the sounder hears a roar of natural radio noise that drowns the echoes. Canadian scientists realise the noise is itself new science.",
    choices: [
      { label: "Ask the stations to record the noise too ($0.3M)", effect: { cost_musd: 0.3, science_mult: 1.15 } },
      { label: "Filter it out and keep only clean echoes",          effect: { science_mult: 0.85 } }
    ]
  },
  {
    id: "ion-blizzard",
    objectives: ["ionosphere"],
    title: "Blizzard at Resolute Bay",
    text: "Resolute Bay, the busiest of the ground stations that listen for your sounder, loses its dish in a blizzard. It heard about one sounding in five.",
    choices: [
      { label: "Lease lines and re-route to Fairbanks ($0.4M)", effect: { cost_musd: 0.4 } },
      { label: "Wait for the dish to be rebuilt",                effect: { lose_months: 1 } }
    ]
  },
  {
    id: "rad-rival",
    objectives: ["radiation"],
    title: "A rival reports the same belts",
    text: "Another satellite's counters report the same strange radiation. You can publish now, on partial data, or wait for a full analysis and risk being second.",
    choices: [
      { label: "Hold a press conference now ($0.5M); more stations volunteer to listen", effect: { cost_musd: 0.5, science_mult: 1.2 } },
      { label: "Wait for the full analysis",                                              effect: {} }
    ]
  },
  {
    id: "rad-belt",
    objectives: ["radiation"],
    title: "The belt is bigger than predicted",
    text: "Your counter's readings keep climbing, past anything the team expected, and its electronics are warming up.",
    choices: [
      { label: "Switch the counter off for the worst passes", effect: { science_mult: 0.7 } },
      { label: "Keep it on: this is the discovery",           effect: { science_mult: 1.3, fail_chance: 0.25, fails: "instrument" } }
    ]
  },
  {
    id: "wx-hurricane",
    objectives: ["weather"],
    title: "A hurricane under the camera",
    text: "A hurricane is crossing the Atlantic right below your orbit. Nobody has ever seen one whole.",
    choices: [
      { label: "Shoot every pass",                         effect: { science_mult: 1.3, fail_chance: 0.2, fails: "computer" } },
      { label: "Keep the usual schedule",                  effect: {} }
    ]
  },
  {
    id: "wx-tape",
    objectives: ["weather"],
    title: "The picture store jams",
    text: "The computer that holds the pictures between ground passes keeps jamming. Without it you can only send pictures live.",
    choices: [
      { label: "Reset it and hope",                        effect: { fail_chance: 0.3, fails: "computer" } },
      { label: "Send live pictures over stations only",    effect: { science_mult: 0.7 } }
    ]
  },
  {
    id: "sol-spots",
    objectives: ["solar"],
    title: "A giant sunspot group",
    text: "A sunspot group bigger than Jupiter rotates into view. A flare may follow within days.",
    choices: [
      { label: "Retarget everything at it ($0.3M of ground time)", effect: { cost_musd: 0.3, science_mult: 1.25 } },
      { label: "Stay on the planned programme",                     effect: {} }
    ]
  },
  {
    id: "fire-smoke",
    objectives: ["wildfire"],
    title: "Smoke over the target",
    text: "A huge fire has thrown a pall of smoke over the region you were watching. Ordinary cameras see only grey.",
    choices: [
      { label: "Wait for clear air",                         effect: { lose_months: 1 } },
      { label: "Keep observing through the smoke",           effect: { science_mult: 0.85 } }
    ]
  },
  {
    id: "ice-edge",
    objectives: ["sea-ice"],
    title: "The ice edge moves",
    text: "A winter storm has broken up the pack. The coast guard asks for an urgent map of the new ice edge.",
    choices: [
      { label: "Retask the satellite to map it now ($0.4M)", effect: { cost_musd: 0.4, science_mult: 1.25 } },
      { label: "Keep to the schedule",                        effect: {} }
    ]
  },
  {
    id: "rare-alignment",
    title: "A rare alignment",
    text: "For a few days the Sun, Moon and your orbit line up in a way that lets you observe more than planned. It needs extra commanding from the ground.",
    choices: [
      { label: "Do it, with extra commands",  effect: { science_mult: 1.3, fail_chance: 0.2, fails: "computer" } },
      { label: "Skip it and stay safe",        effect: {} }
    ]
  }
];
