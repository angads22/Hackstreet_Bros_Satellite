// data/tiers.js — owned by Data (yarmee).
// Budgets are GAME VALUES sized against the launcher prices: Training can
// afford the $69.75M rocket to geostationary orbit, Standard cannot, and
// Expert leaves almost nothing spare: a radar on the small launcher, with its body and attitude part, just fits.
// QA tunes these.
// hints: "on" (with tutorial) | "request" | "off"
// Names: JPL Concept Maturity Levels 2-4, the stages where a mission concept is shaped
// (challenge Resources tab; NASA "Mission Development 101: CMLs",
// https://science.nasa.gov/wp-content/uploads/2023/11/03-ziemer-mission-development-101-cmls.pdf).
// The ids stay training / standard / expert so saves and unlocks keep working.

const TIERS = [
  { id: "training", name: "Initial Feasibility", budget_musd: 90, events: 1, hints: "on" },
  { id: "standard", name: "Trade Space", budget_musd: 20, events: 2, hints: "request" },
  { id: "expert",   name: "Point Design", budget_musd: 18, events: 3, hints: "off" }
];
