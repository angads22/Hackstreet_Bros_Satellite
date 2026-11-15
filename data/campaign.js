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
  save_version: 4,            // bump when the saved shape changes; an older save is discarded

  // Part 2, Ajay's comeback (SPEC.md, "Two game modes"): a mode of this campaign in the present day.
  // Every value is a GAME VALUE, tuned by simulating hundreds of comebacks per difficulty: a sensible
  // player wins Normal in 4 or 5 flights with a few months to spare, Hard about 4 times in 5, Easy always;
  // a careless player (random parts) loses on every difficulty.
  comeback: {
    tiers: {                  // per difficulty (tier id): Easy, Normal and Hard
      training: { cash_musd: 6, debt_musd: 30, deadline_months: 60, loan_cap_musd: 20, reputation_goal: 12 },   // GAME VALUES
      standard: { cash_musd: 4, debt_musd: 40, deadline_months: 54, loan_cap_musd: 25, reputation_goal: 20 },   // GAME VALUES
      expert:   { cash_musd: 3, debt_musd: 45, deadline_months: 54, loan_cap_musd: 30, reputation_goal: 28 }    // GAME VALUES (and 3 events a flight, from data/tiers.js)
    },
    // Loans, credit and a name (SPEC.md, "Loans, credit and a name"). All GAME VALUES.
    credit: {
      start: 100,                 // credit runs 0 to 100
      seize: 20,                  // at or below this the lenders take everything and the comeback is lost
      per_loan: 8,                // credit lost for each loan
      per_late_month: 0.5,        // credit lost for each month that passes with the debt above the cash
      per_lost_satellite: 10,     // credit lost when a satellite is lost before its mission ends
      per_star: 2,                // credit gained for each star a flight earns
      per_payment: 1,             // credit gained for a payment of at least min_payment_musd
      min_payment_musd: 1,
      loan_fee: 0.05,             // share of a loan added to the debt on top of the loan
      interest_spread: 0.02,      // extra monthly interest at zero credit; it scales with the credit lost
      reputation_per_star: 2      // reputation gained for each star a flight earns
    },
    interest_per_month: 0.005,    // GAME VALUE: the debt grows by this share every month, compounded (about 6% a year)
    launch_campaign_months: 2,    // GAME VALUE: months from a finished satellite to its data reaching the client
    contracts_open: 3,            // GAME VALUE: contracts on offer at a time
    contract_months: 12,          // GAME VALUE: months a contract stays open
    bonus_3_stars: 0.25           // GAME VALUE: share of the contract price paid on top for a 3-star flight
  }
};
