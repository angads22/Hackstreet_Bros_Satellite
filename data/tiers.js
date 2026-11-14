// data/tiers.js — owned by Data (yarmee).
// Budgets are GAME VALUES sized against the launcher prices: Training can
// afford the $69.75M rocket to geostationary orbit, Standard cannot, and
// Expert leaves almost nothing spare: a radar on the small launcher just fits.
// QA tunes these.
// hints: "on" (with tutorial) | "request" | "off"

const TIERS = [
  { id: "training", name: "Training", budget_musd: 90, events: 1, hints: "on" },
  { id: "standard", name: "Standard", budget_musd: 20, events: 2, hints: "request" },
  { id: "expert",   name: "Expert",   budget_musd: 16, events: 3, hints: "off" }
];
