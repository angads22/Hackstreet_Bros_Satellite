// data/debrief.js — owned by Story. DRAFT text so the debrief can run; Story rewrites it.
// One paragraph per limiting factor (SPEC.md): mass, power, budget, data, event, design, none, plus the campaign keys saturated and breakthrough. mission.js adds a specific suggestion.

const DEBRIEF = {
  mass: "Your spacecraft was right at the edge of what the rocket could carry. Every kilogram of instrument pushed out a kilogram of something else, and with no margin left, problems in orbit hit hard. Real missions keep a mass reserve for exactly this reason.",
  power: "Your spacecraft ran short of power. Satellites spend part of every orbit in Earth's shadow, and only a battery keeps the instruments running there. Power-hungry instruments like radar need big panels and a big battery.",
  budget: "Money set the limits of this mission. You spent almost all of it, which left no room for a better rocket, a faster radio or a spare. NASA's CubeSat 101 guide tells teams to hold back at least 10% for surprises.",
  data: "Your instruments saw more than the radio could send home. A satellite only talks to the ground while it passes over a station, sometimes just a few minutes per orbit, so anything that does not fit in those minutes is lost. Data is often the hidden limit of a mission.",
  event: "Something you did not plan for ended or crippled the mission. Space is harsh: radiation, debris and plain bad luck all take their toll. Designers protect against the risks they can predict and keep margins for the ones they cannot.",
  design: "Nothing broke and no resource ran short, but the design was aimed at the wrong thing. The instruments or the orbit did not suit the objective, so the spacecraft worked perfectly and still missed the target. Real missions start from the science question, then choose the hardware.",
  saturated: "You already knew most of what this topic can teach, so this mission added little that was new, and the payout was small. Science pays for discovery: a fresh topic would teach you, and pay you, far more.",
  breakthrough: "This was a first real look at the topic, so almost everything you sent home was new. That is why the payout was large. The next mission on the same topic will add less.",
  // Mission Design Lab discipline names for each limiting factor (challenge Resources tab:
  // NASA Goddard Mission Design Lab disciplines: power, propulsion, thermal, structures,
  // avionics, communications, attitude control, software, reliability, cost and risk).
  disciplines: {
    mass: "Structures", power: "Power", budget: "Cost", data: "Communications", event: "Risk",
    orbit: "Orbit and trajectory", instruments: "Science instruments", none: "Nothing"
  },
  none: "Nothing broke, no resource ran short and you hit the science target. This is a design real engineers would be proud of."
};
