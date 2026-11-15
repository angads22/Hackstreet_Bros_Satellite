// data/campaign.js — owned by Data (yarmee). Campaign settings (SPEC.md, "Data format").
// Every value is a GAME VALUE, tuned by simulation, not a real-world figure.
// The era is an open decision (SPEC.md, "Honest audit"): no text may name an era
// the data cannot support; the calendar is read only from start_year.

const CAMPAIGN = {
  start_year: 1957,           // calendar shown on the hub
  years_per_mission: 1,       // the year advances by this after each recorded mission
  end_year: 1969,             // the campaign ends here, or earlier on a win
  repeat_floor_musd: 0.3,     // minimum payout for any finished mission
  win: { topics_known: 3, knowledge: 0.8 },   // win when this many topics (or all, if fewer) reach this share
  grant_musd: 2,              // agency grant after each mission: small, so money still matters
  cap_scales: 3,              // GAME VALUE: a topic's data cap = this x its knowledge_scale (95% known)
  archive_share: 0.1,         // GAME VALUE: each year the archive pays this share of all science banked, as science points
  save_version: 5,            // bump when the saved shape changes (5: a comeback keeps its seed, its buyout and its starting debt); js/mission.js upgrades a version 4 save in place (upgradeCampaign), an older or newer one is ignored

  // Part 2, Ajay's comeback (SPEC.md, "Two game modes"): a mode of this campaign in the present day.
  // Every value is a GAME VALUE, tuned by simulating hundreds of comebacks per difficulty (see CHANGELOG.md): a run is short.
  // A sensible player wins Easy in 2 flights, Normal in 3 and Hard in 4, with a few months to spare; Hard is still won
  // about 9 times in 10 by a sensible player; a careless player (random parts) loses on every difficulty.
  // Launch failure (data/launchers.js failure_chance) can cost a flight, so each deadline got six months (the same simulator:
  // before the failures and the six months, after the failures alone, after both; see CHANGELOG.md).
  comeback: {
    tiers: {                  // per difficulty (tier id): Easy, Normal and Hard
      training: { cash_musd: 5, debt_musd: 22, deadline_months: 42 },   // GAME VALUES (was 36: six months more, for the extra flight a failed launch can cost)
      standard: { cash_musd: 4, debt_musd: 28, deadline_months: 48 },   // GAME VALUES (was 42, same reason)
      expert:   { cash_musd: 3, debt_musd: 34, deadline_months: 54 }    // GAME VALUES (was 48, same reason; and 3 events a flight, from data/tiers.js)
    },
    interest_per_month: 0.005,    // GAME VALUE: the debt grows by this share every month, compounded (about 6% a year)
    launch_campaign_months: 2,    // GAME VALUE: months from a finished satellite to its data reaching the client
    contracts_open: 3,            // GAME VALUE: contracts on offer at a time
    contract_months: 12,          // GAME VALUE: months a contract stays open
    bonus_3_stars: 0.25,          // GAME VALUE: share of the contract price paid on top for a 3-star flight
    buyout_after_flights: 2,      // GAME VALUE: Iron Eclipse offers to buy the company once this many flights are settled and the debt stands
    legend_avg_stars: 2.5,        // GAME VALUE: a win with at least this many stars a flight on average is the "legend" ending
    close_share: 0.1              // GAME VALUE: a win with this share of the deadline or less left is the "close" ending
  }
};
