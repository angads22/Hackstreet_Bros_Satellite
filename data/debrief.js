// data/debrief.js — owned by Story. DRAFT text so the debrief can run; Story rewrites it.
// One paragraph per limiting factor (SPEC.md). mission.js adds a specific suggestion.

const DEBRIEF = {
  mass: "Your spacecraft was right at the edge of what the rocket could carry. Every kilogram of instrument pushed out a kilogram of something else, and with no margin left, problems in orbit hit hard. Real missions keep a mass reserve for exactly this reason.",
  power: "Your spacecraft ran short of power. Satellites spend part of every orbit in Earth's shadow, and only a battery keeps the instruments running there. Power-hungry instruments like radar need big panels and a big battery.",
  budget: "Money set the limits of this mission. You spent almost all of it, which left no room for a better rocket, a faster radio or a spare. NASA's CubeSat 101 guide tells teams to hold back at least 10% for surprises.",
  data: "Your instruments saw more than the radio could send home. A satellite only talks to the ground while it passes over a station, sometimes just a few minutes per orbit, so anything that does not fit in those minutes is lost. Data is often the hidden limit of a mission.",
  event: "Something you did not plan for ended or crippled the mission. Space is harsh: radiation, debris and plain bad luck all take their toll. Designers protect against the risks they can predict and keep margins for the ones they cannot.",
  none: "Nothing broke and no resource ran short. If you hit the target, well done: this is a design real engineers would be proud of. If you missed it, the design was aimed at the wrong thing. Check whether your instrument and your orbit really suit the objective."
};
