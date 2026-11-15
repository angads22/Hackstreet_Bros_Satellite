// data/debrief.js — owned by Story. DRAFT text so the debrief can run; Story rewrites it.
// One paragraph per limiting factor (SPEC.md): mass, power, budget, data, event, design, none, plus the campaign keys saturated and breakthrough. mission.js adds a specific suggestion.

const DEBRIEF = {
  mass: "The rocket was nearly full, so every problem hit harder. Real missions keep a mass reserve.",
  power: "You ran short of power. In Earth's shadow, only a battery keeps instruments on.",
  budget: "Money set the limit. NASA's CubeSat 101 advises holding back at least 10%.",
  data: "The instruments saw more than the radio could send. Data that misses a ground pass is lost.",
  event: "Something unplanned crippled the mission. Guard against what you can predict; keep margin for the rest.",
  design: "Nothing broke, but the design aimed at the wrong thing. Start from the science question.",
  saturated: "You already knew most of this topic, so the payout was small. A fresh topic pays more.",
  breakthrough: "First real look at this topic, so all of it was new. The next flight adds less, and pays less.",
  // Mission Design Lab discipline names for each limiting factor (challenge Resources tab:
  // NASA Goddard Mission Design Lab disciplines: power, propulsion, thermal, structures,
  // avionics, communications, attitude control, software, reliability, cost and risk).
  disciplines: {
    mass: "Structures", power: "Power", budget: "Cost", data: "Communications", event: "Risk",
    orbit: "Orbit and trajectory", instruments: "Science instruments", attitude: "Attitude control", none: "Nothing"
  },
  none: "Nothing broke, no resource ran short, and you hit the target."
};
