// data/online.js — the online features (SPEC.md, "Online features"): a global leaderboard and a quick 1v1 duel.
// They need a server (server/server.js). The endpoint is empty, so every online feature stays OFF until someone
// sets it. They are also off whenever the page is opened from a file, localhost, a private address or with ?offline=1
// (LiveData.onlineStatus in js/live-data.js). Every number is a GAME VALUE unless a note says otherwise.
const ONLINE = {
  endpoint: "",                 // the server's address, for example "https://gravitron-server.example.com" (no trailing slash)
  leaderboard_size: 20,         // rows shown on the leaderboard
  nickname_max: 16,             // characters
  request_timeout_ms: 6000,     // one request, then "Server not reachable"
  duel_ttl_minutes: 10,         // a room is gone after this long
  poll_ms: 2000,                // how often the duel screen asks the server while it waits
  room_code_length: 4,          // letters
  player_key: "gravitron-player-v1",   // localStorage: { id, nickname }
  // A run's score (getRunScore in js/mission.js): 500 for a win, plus 100 per star earned, plus 10 per month left on a win,
  // plus 5 per point of reputation.
  run_score: { win: 500, per_star: 100, per_month_left: 10, per_reputation: 5 },
  // A duel's flight: the seed picks one of these, so both players get the same topic, orbit, era, tier and cash (the tier's budget).
  // Each is a small modern satellite in low orbit that a cheap rocket lifts (checked in tests/online.js).
  duel_setups: [
    { objective: "radiation", orbit: "leo", era: "new-space", tier: "standard" },
    { objective: "solar",     orbit: "leo", era: "new-space", tier: "standard" },
    { objective: "weather",   orbit: "leo", era: "new-space", tier: "standard" }
  ]
};
