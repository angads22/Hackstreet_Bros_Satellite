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
      training: { cash_musd: 6, debt_musd: 30, deadline_months: 60, loan_cap_musd: 20, reputation_goal: 12 },   // GAME VALUES
      standard: { cash_musd: 4, debt_musd: 40, deadline_months: 54, loan_cap_musd: 25, reputation_goal: 20 },   // GAME VALUES
      expert:   { cash_musd: 3, debt_musd: 45, deadline_months: 54, loan_cap_musd: 30, reputation_goal: 28 }    // GAME VALUES (and 3 events a flight, from data/tiers.js)
    },
    // Loans, credit and a name (SPEC.md, "Loans, credit and a name"). All GAME VALUES.
    // What is left of the old 0 to 100 "credit" block: the loan fee, the smallest payment that counts, and the name.
    // The score itself is in `score` below (version 2.1).
    credit: {
      min_payment_musd: 1,        // a payment of at least this counts as an on-time payment
      loan_fee: 0.05,             // share of a loan added to the debt on top of the loan
      reputation_per_star: 2      // reputation gained for each star a flight earns
    },
    // The credit score (version 2.1): a real FICO-style score, 300 to 850, worked out from the run's history (mission.js,
    // creditScore) from the five real factors with their real weights. GAME VALUES, tuned so a sensible player stays GOOD or
    // better and a careless one falls to POOR. Every run starts at `start`; the factors are measured against that day.
    score: {
      min: 300,                   // FICO: the lowest score
      max: 850,                   // FICO: the highest score
      start: 720,                 // Ajay's score on the day the comeback starts (GOOD)
      seize: 500,                 // at or below this, with debt left, the lenders take everything
      // A save from before 2.1 kept `credit` from 0 to 100; it is shown as base + per_point x credit (mission.js, upgradeCampaign).
      legacy_base: 300,
      legacy_per_point: 5.5,
      // The five FICO factors and the weights FICO publishes. They add up to 1.
      weights: { payment: 0.35, owed: 0.30, length: 0.15, new: 0.10, mix: 0.10 },
      // FICO's own bands. `spread` is added to the base monthly interest (a lower band costs more); `cap_share` is the share
      // of the difficulty's loan cap the lenders will lend in that band (POOR: nothing).
      bands: [
        { id: "poor",        name: "POOR",       from: 300, to: 579, spread: 0.015,  cap_share: 0 },
        { id: "fair",        name: "FAIR",       from: 580, to: 669, spread: 0.008,  cap_share: 0.5 },
        { id: "good",        name: "GOOD",       from: 670, to: 739, spread: 0,      cap_share: 1 },
        { id: "very_good",   name: "VERY GOOD",  from: 740, to: 799, spread: -0.001, cap_share: 1.1 },
        { id: "exceptional", name: "EXCEPTIONAL", from: 800, to: 850, spread: -0.002, cap_share: 1.2 }
      ],
      // Payment history: on-time months against late ones. `grace_months` of clean history to begin with; each real payment
      // adds `payment_months` on-time months; every month with the debt above the cash counts late; a lost satellite counts
      // as `lost_months` late months.
      payment: { grace_months: 30, payment_months: 6, lost_months: 15 },
      // Amounts owed: the debt, less `cash_share` of the cash, against the debt Ajay began with plus the loan cap.
      owed: { cash_share: 0.5 },
      // Length of history: the run's months, full at `full_months`.
      length: { full_months: 48 },
      // New credit: loans taken in the last `recent_months`; `full_loans` of them is the worst.
      new: { recent_months: 12, full_loans: 3 }
    },
    // Paying engineers for part information (SPEC.md, "Paying engineers for part information"). A part's information is
    // three groups: sheet (mass, power, data rate), performance (what it measures, science a month) and dossier (its
    // catches, what it fixes and causes, the WHY box, the explainer). Easy knows all three, Normal the sheet, Hard none;
    // the rest is asked of the engineers once per run and part, and paid from the cash. A sensible Normal player asks about
    // the parts they weigh (about 6 to 8 of them): $0.3M to $0.5M of a $4M start. On Hard, where nothing is free, the same
    // care costs about $1M of $3M. All GAME VALUES, in $M.
    info_fee_musd: { sheet: 0.02, performance: 0.04, dossier: 0.04 },
    info_free: {              // the groups each difficulty (tier id) gets without paying
      training: ["sheet", "performance", "dossier"],
      standard: ["sheet"],
      expert: []
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
