// data/hints.js — owned by Story (drafted by Data so Training has hints). Rewrite
// the text freely; the keys are fixed by SPEC.md. One sentence per tip.

const HINTS = {
  screens: {
    hub: [
      "Money is spent at launch; the payout comes back for what you learn.",
      "A topic you know well pays less each time. A fresh topic pays the most.",
      "Research needs more than money: some of it asks you to prove a best practice in flight first."
    ],
    briefing: [
      "Decide what you want to learn before you choose any hardware.",
      "Check which instrument types count for the topic: the first type counts fully, the others half."
    ],
    orbit: [
      "Low orbit is close and cheap, but passes over a ground station only a few minutes at a time.",
      "Every orbit spends part of each lap in Earth's shadow, where only a battery keeps instruments running."
    ],
    build: [
      "Every part costs something in all four bars: mass, power, money and data.",
      "Hover over a part to see what it would change before you add it.",
      "Keep at least 10% spare in mass and power: thin margins make every problem worse."
    ],
    launch: [
      "A bigger rocket solves a mass problem but eats the budget.",
      "Check that the rocket can reach your orbit at all: some cannot."
    ],
    readiness: [
      "Red items stop the launch. Amber items are risks you may choose to accept.",
      "Every warning you accept now is a problem that can find you in orbit."
    ],
    mission: [
      "Each choice shows its real odds. A safe choice that costs a month can save the whole mission.",
      "A spare part keeps the mission alive when one fails."
    ],
    debrief: [
      "Read what limited the mission first: it tells you the one change most worth making.",
      "Change one thing and fly again. The same design replays the same luck outside a campaign, so you can see exactly what your change did."
    ]
  },

  tutorial: {
    hub: "This is your space programme. Pick a topic, build a satellite, launch it, and earn money for what it discovers.",
    briefing: "Choose what your satellite will study. Everything else follows from this.",
    orbit: "Choose where it will fly. Each orbit trades detail, contact time and lifetime.",
    build: "Add parts until every required column has one and the four bars stay out of the red.",
    launch: "Choose a rocket that can carry your satellite to its orbit.",
    readiness: "Fix every red item, then launch.",
    mission: "Your satellite is flying. When something happens, you decide what to do.",
    debrief: "Here is what your satellite achieved, what held it back, and the one change to try next."
  },

  // One tip per runChecks id (resolution-<partId> uses "resolution").
  checks: {
    "no-objective": "Go back to the Briefing and choose a topic.",
    "no-orbit": "Go back and choose an orbit.",
    "no-launcher": "Choose a rocket on the next screen. If none reaches your orbit, pick another orbit.",
    "empty": "Every satellite needs a body, an instrument, a power part, a radio, a computer and attitude control.",
    "launcher-reach": "This rocket cannot reach that orbit. Choose another rocket, or another orbit.",
    "mass": "Too heavy for this rocket: drop a part or choose a bigger rocket.",
    "mass-margin": "You are close to the rocket's limit. Real teams keep a reserve for the mass that always creeps in.",
    "budget": "Too expensive: a cheaper rocket often saves more than a cheaper instrument.",
    "power": "Your parts draw more than your solar cells make. Add or enlarge a panel, or drop a power-hungry part.",
    "power-margin": "Power is tight. Solar cells weaken with age, so leave some spare.",
    "battery": "Your battery cannot carry the satellite through Earth's shadow, so instruments switch off there.",
    "battery-only": "No solar cells: like Sputnik 1, your satellite will fall silent when the batteries run down.",
    "delta-v": "This orbit needs the satellite to change its own speed, at least to come down safely at the end. Add a thruster, or pick an orbit that needs none.",
    "data": "Your instruments make more data than your radio can send down. Fit a faster radio or carry fewer data-hungry instruments.",
    "no-match": "None of your instruments counts for this topic. Look at the Briefing to see which types do.",
    "orbit-fit": "From this orbit the satellite cannot see what this topic needs.",
    "resolution": "This instrument is too blurry from this orbit. A lower orbit or a bigger lens would help.",
    "part-locked": "This part needs research first. Open the research list on the hub.",
    "launcher-locked": "This rocket needs research first.",
    "objective-locked": "This topic needs research first.",
    "smear": "A spinning satellite smears cameras, thermal imagers and radar. Three-axis control holds it steady.",
    "body-count": "A satellite has one body. Keep the one that fits your parts.",
    "body-payload": "Your parts are too heavy for this body. Choose a bigger body or lighter parts.",
    "body-slots": "This body has no room for another part of that kind. A bigger body has more slots.",
    "too-late": "This satellite takes too long to build: it would miss the end of the programme. Use parts that are quicker to build."
  }
};
