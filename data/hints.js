// data/hints.js — owned by Story (drafted by Data so Training has hints). Rewrite
// the text freely; the keys are fixed by SPEC.md. One sentence per tip.

const HINTS = {
  screens: {
    hub: [
      "Money goes out at launch. Payout comes back for what you learn.",
      "Known topics pay less. Fresh topics pay most.",
      "Some research needs a best practice proven in flight first."
    ],
    briefing: [
      "Decide what to learn before any hardware.",
      "The first instrument type counts fully, the others half."
    ],
    orbit: [
      "Low orbit is cheap, but passes over a station only for minutes.",
      "Every orbit has a shadow. Only a battery works there."
    ],
    build: [
      "Every part costs mass, power, money and data.",
      "Hover a part to see what it changes.",
      "Keep 10% spare in mass and power."
    ],
    launch: [
      "A bigger rocket fixes mass but eats budget.",
      "Some rockets cannot reach your orbit."
    ],
    readiness: [
      "Red stops the launch. Amber is a risk you may accept.",
      "Every accepted warning can find you in orbit."
    ],
    mission: [
      "Each choice shows its real odds.",
      "A spare part keeps the mission alive."
    ],
    debrief: [
      "Read what limited you first: it names the change to make.",
      "Change one thing and fly again."
    ]
  },

  tutorial: {
    hub: "Pick a topic, build, launch, earn.",
    briefing: "Pick what your satellite studies.",
    orbit: "Pick where it flies.",
    build: "Keep the four bars out of red.",
    launch: "Pick a rocket that reaches your orbit.",
    readiness: "Fix every red item, then launch.",
    mission: "When something happens, you decide.",
    debrief: "What you achieved, what held you back, one change to try."
  },

  // One tip per runChecks id (resolution-<partId> uses "resolution").
  checks: {
    "no-objective": "Go back and choose a topic.",
    "no-orbit": "Go back and choose an orbit.",
    "no-launcher": "Choose a rocket. None reaches your orbit? Change orbit.",
    "empty": "Needs a body, instrument, power, radio, computer and attitude control.",
    "launcher-reach": "This rocket cannot reach that orbit. Change rocket or orbit.",
    "mass": "Too heavy: drop a part or pick a bigger rocket.",
    "mass-margin": "Close to the rocket's limit. Keep a reserve.",
    "budget": "Too expensive. A cheaper rocket often saves more than a cheaper instrument.",
    "power": "Parts draw more than the cells make. Add cells or drop a part.",
    "power-margin": "Power is tight. Solar cells weaken with age.",
    "battery": "The battery cannot last the shadow, so instruments switch off there.",
    "battery-only": "No solar cells: like Sputnik 1, it falls silent when the batteries run down.",
    "delta-v": "This orbit needs a thruster, at least to come down safely. Or pick an orbit that needs none.",
    "data": "More data than the radio can send. Faster radio, or fewer data-hungry instruments.",
    "no-match": "No instrument counts for this topic. See the Briefing.",
    "orbit-fit": "From this orbit the satellite cannot see what this topic needs.",
    "resolution": "Too blurry from this orbit. Fly lower or use a bigger lens.",
    "part-locked": "Needs research first.",
    "launcher-locked": "This rocket needs research first.",
    "objective-locked": "This topic needs research first.",
    "smear": "Spinning smears cameras, imagers and radar. Three-axis control holds steady.",
    "body-count": "One body only. Keep the one that fits.",
    "body-payload": "Too heavy for this body. Pick a bigger body or lighter parts.",
    "body-slots": "No room for another part of that kind. A bigger body has more slots.",
    "too-late": "Takes too long to build; it would miss the programme's end. Use quicker parts."
  }
};
