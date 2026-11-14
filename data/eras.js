// data/eras.js — owned by Data (yarmee). Eras for standalone play (SPEC.md,
// "Progression"). A mission set in an era offers only what existed by `year`
// (each item's year comes from the research record that unlocks it).
// real_missions: ids in data/missions.js to show on the era card.

const ERAS = [
  {
    id: "igy", name: "International Geophysical Year", year: 1958,
    blurb: "The first satellites: a few kilograms, batteries, one counter, and a radio you can barely hear.",
    real_missions: ["explorer-1", "explorer-3"]
  },
  {
    id: "nimbus", name: "Nimbus", year: 1964,
    blurb: "Solar cells, TV cameras and satellites that hold steady: weather from orbit becomes routine.",
    real_missions: ["tiros-1", "solrad-1"]
  },
  {
    id: "eos", name: "Earth Observing System", year: 1999,
    blurb: "Digital radios, computers and thrusters: satellites that watch fires and map ice through cloud.",
    real_missions: ["terra", "seasat"]
  },
  {
    id: "new-space", name: "New Space", year: 2026,
    blurb: "Rideshares, reusable rockets and CubeSats: space is cheap, so the hard part is choosing well.",
    real_missions: ["iceye", "forest", "goes-r"]
  }
];
