// data/campaign.js — owned by Data (yarmee). Campaign settings (SPEC.md, "Data format").
// Every value is a GAME VALUE, tuned by simulation, not a real-world figure.
// The era is an open decision (SPEC.md, "Honest audit"): no text may name an era
// the data cannot support; the calendar is read only from start_year.

const CAMPAIGN = {
  start_year: 1957,           // calendar shown on the hub
  years_per_mission: 1,       // the year advances by this after each recorded mission
  end_year: 1969,             // the campaign ends here, or earlier on a win
  repeat_floor_musd: 0.3,     // minimum payout for any finished mission
  win: { topics_known: 3, knowledge: 0.6 },   // win when this many topics (or all, if fewer) reach this share
  grant_musd: 2,              // agency grant after each mission: small, so money still matters
  save_version: 2             // bump when the saved shape changes; an older save is discarded
};
