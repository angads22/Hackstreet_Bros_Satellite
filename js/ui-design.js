// js/ui-design.js — owned by Design screens.
// The shared layout (header, minimap, objective line, hints), the base map that
// players walk around to reach each screen, and the screens before launch:
// the home page (two game modes), Part 1 (Austin's 1958 walkthrough: steps, presets, epilogue),
// 1 Briefing, 2 Orbit, 3 Build, 4 Launch vehicle, 5 Readiness review.
// Every number shown comes from a game.js / mission.js call or a plain data field;
// this file only formats numbers and draws the page.
//
// Everything lives inside one function so no name here can clash with the
// back end's globals. Two names are shared on purpose:
//   showDesignScreen(name, design)  — used by ui-mission.js for Redesign / New mission
//   StarlineUI                      — small drawing helpers ui-mission.js reuses
(function () {
  "use strict";

  // ---------------------------------------------------------------- setup
  var DESIGN_STEPS = ["briefing", "orbit", "build", "launcher", "review"];

  // The Build screen's bins, in display order, come from the back end: getCategories().
  // This list is only the fallback if that function is missing.
  var FALLBACK_CATEGORIES = [
    { id: "instrument", name: "INSTRUMENTS", sub: "What the mission sees", required: true },
    { id: "power",      name: "POWER",       sub: "Panels and batteries",  required: true },
    { id: "comms",      name: "RADIO",       sub: "Send data home",        required: true },
    { id: "computer",   name: "COMPUTER",    sub: "Runs the spacecraft",   required: true },
    { id: "propulsion", name: "PROPULSION",  sub: "Speed change, optional", required: false }
  ];
  function categories() {
    var c = typeof getCategories === "function" ? list(getCategories()) : [];
    return c.length ? c : FALLBACK_CATEGORIES;
  }

  // Shown under the header when the tier's hints are on (or on request).
  var HINTS = {
    title:    "",
    map:      "Tap a place to walk there. Arrow keys or WASD walk; E goes in. The gold route is your next job.",
    briefing: "Pick the goal first. It decides which instruments count.",
    orbit:    "Orbit sets detail, ground contact, lifetime and launch cost.",
    build:    "Every part costs in all four bars. Hover one to preview.",
    launcher: "A bigger rocket fixes mass but eats budget.",
    review:   "Red stops the launch. Amber is a risk.",
    mission:  "Pick one answer per event.",
    debrief:  "Fix the one thing that limited you, then fly again."
  };

  // This file's screen names -> the screen names getHints uses.
  var HINT_KEYS = { hub: "hub", briefing: "briefing", orbit: "orbit", build: "build", launcher: "launch",
                    review: "readiness", mission: "mission", debrief: "debrief" };

  // Where each readiness check is fixed (SPEC: "Where each check is fixed").
  var FIX_SCREEN = {
    "no-objective": "briefing",
    "no-orbit": "orbit", "orbit-fit": "orbit",
    "no-launcher": "launcher", "launcher-reach": "launcher", "mass": "launcher",
    "mass-margin": "launcher", "budget": "launcher"
  };

  // ---------------------------------------------------------------- the base map
  // Each design screen is a place on the map. The map is 200 x 120 units; roads
  // join the nodes below, and the player walks from node to node.
  var PLACES = [
    { id: "briefing", num: 1, name: "MISSION CONTROL",  does: "Pick a job for the satellite" },
    { id: "orbit",    num: 2, name: "TRACKING STATION", does: "Choose where it flies" },
    { id: "build",    num: 3, name: "WORKSHOP",         does: "Build the spacecraft" },
    { id: "launcher", num: 4, name: "ROCKET YARD",      does: "Pick a rocket" },
    { id: "review",   num: 5, name: "LAUNCH PAD",       does: "Readiness review and launch" }
  ];
  var MAP_W = 200, MAP_H = 120;
  var NODES = {
    gate: { x: 10, y: 63 },  j1: { x: 40, y: 63 },  j2: { x: 100, y: 63 }, j3: { x: 160, y: 63 },
    briefing: { x: 40, y: 40 }, orbit: { x: 100, y: 40 }, review: { x: 160, y: 40 },
    build: { x: 40, y: 86 },    launcher: { x: 100, y: 86 }, ground: { x: 160, y: 86 }
  };
  var EDGES = [["gate", "j1"], ["j1", "j2"], ["j2", "j3"], ["j1", "briefing"], ["j1", "build"],
               ["j2", "orbit"], ["j2", "launcher"], ["j3", "review"], ["j3", "ground"]];
  var GO_TEXT = {
    briefing: "Go to Mission Control.",
    orbit:    "Go to the Tracking Station.",
    build:    "Go to the Workshop.",
    launcher: "Go to the Rocket Yard.",
    review:   "Go to the Launch Pad."
  };
  var DO_TEXT = {
    briefing: "Pick a job.",
    orbit:    "Pick an orbit that sees the target.",
    build:    "Fill every required column.",
    launcher: "Pick a rocket that can lift it.",
    review:   "Clear every NO GO, then launch."
  };
  // Part 1, Austin's walkthrough: three standalone missions in the 1958 era, Training tier (hints on).
  // A field set here is preset: that place counts as visited and its cards are read-only for the step.
  // Only ids: every number comes from the back end. 1958 has one topic (radiation) and its rockets reach
  // only low orbit (getAvailability), so every step flies radiation; steps 2 and 3 leave more choices open.
  var WALK_STEPS = [
    { step: 1, era: "igy", tier: "training", objective: "radiation", orbit: "leo", launcher: "juno-1" },
    { step: 2, era: "igy", tier: "training", objective: "radiation", launcher: "vanguard-rocket" },
    { step: 3, era: "igy", tier: "training" }
  ];
  var WALK_KEY = "gravitron-walkthrough-v1";   // { done: { "1": best stars, "2": ..., "3": ... } }, passed steps only
  var WALK_PASS_STARS = 1;                     // a step passes with this many stars or more (the debrief's stars)
  var PRESET_FIELD = { briefing: "objective", orbit: "orbit", launcher: "launcher" };   // screen -> design field

  var WALK_MS = 9;   // milliseconds per map unit walked (0 if the player asks for less motion)
  var KEY_DIRS = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
                   ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };

  var state = {
    design: null,        // the one design object
    screen: "title",
    player: "gate",      // map node the player stands on
    walking: false,      // true while the player arrow is moving
    stepping: false,     // ...and that walk is one arrow-key step
    queued: null,        // one arrow key pressed during a step, played when it ends
    swappedAt: 0,        // when the screen last changed (to drop the 2nd click of a double-click)
    lastClickAt: 0,      // when the last click that was let through started
    walkTimer: null,
    mapNote: "",         // one-off message on the map ("Locked: ...")
    map: null,           // live map elements, while the map is showing
    reached: 0,          // furthest design step visited, as an index into DESIGN_STEPS
    bin: null,           // which parts bin is open on Build (null = the first one)
    binFor: null,        // the design that bin was chosen for (a new design picks its bin again)
    hover: null,         // part id being previewed on Build
    hintOpen: false,
    avail: null,         // getAvailability(design) for the screen being drawn
    seenHint: {},        // screens whose one-line hint has been shown in this page load
    walk: null,          // the walkthrough step being played: { step, design } (matched by the design object itself)
    walkMemory: null,    // the walkthrough record when the browser blocks storage
    change: null,        // { id, kind } of the part click that is about to be drawn (one draw only)
    touch: false,        // last press on a part card was a finger
    armed: false,        // that part was already previewed when the finger went down
    locked: false        // true from launch until the debrief buttons
  };

  // STORY-BEGIN  (everything between these two markers is the story: Story rewrites the text freely)
  // GRAVITRON, "The Gravitronical Odyssey". Two chapters use the same screens, one per game mode:
  //   "austin": Austin Albert, a NASA engineer in 1958 (Part 1, the walkthrough).
  //   "ajay":   Ajay Albert, his grandson, a founder deep in debt (Part 2, the comeback: a design with `comeback`
  //             or `contract`). Any other design follows its tier, as before: the first tier is Austin's.
  //
  // STORY holds ALL the words, so a writer can edit them without reading the code below it.
  //   A line is a string, a list of strings (variants, one is chosen from the design), or
  //   { who: "partner", text: "..." } to change the speaker. { early: line, late: line } picks by tier.
  //   "{name}" at the start of a line becomes an instrument's name. Keep lines to 12 words and 70 characters.
  //
  // How to show a line (the code at the end of this block returns it):
  //   var line = storyLine(key, design, extra);          // "" or { who: "partner", text: "..." }
  //   if (line) { portrait = speakerArt(line.who); name = STORY.speakers[line.who]; text = line.text; }
  // storyLine("intro", design) returns a list of such beats instead, and so do "step-open" (extra: the step number)
  // and "epilogue". Keys: intro, step-open, step-close, epilogue, map, briefing, orbit, build, launcher, review,
  // mission-start, mission-end, debrief, closing, notebook, event-calibration. "closing" on a walkthrough step that
  // passed is that step's close beat. Part 2 adds: why (extra: the number of flights), hub (extra: "start", "paid",
  // "halfway", "late", "loaned", "credit" or "name"), contract (extra: "paid", "part" or "nothing") and ending (extra: "won",
  // "deadline", "cash", "seized" or "name"; a list of beats). Call them with a comeback design, or with { comeback: true } outside the design screens.
  // extra: debrief and closing take the getDebrief result; mission-end takes it too (or the chooseEvent
  // result); notebook takes a screen name ("briefing", "orbit", "build", "launcher", "review",
  // "mission-start") or the getDebrief result; event-calibration takes the choice index (0 or 1).
  //
  // THE ARC (fiction; Voss, Austin, Ajay, Priya and Iron Eclipse are invented, and no line below states a game number).
  //   Part 1: Austin hears Sputnik beep over his workshop, builds three satellites by the rules in his notebook, and
  //   his counter falls silent at altitude (the discovery). His rival Marcus Voss takes the credit, blames him when
  //   the bigger satellite is lost on the pad, leaves to found Iron Eclipse. The notebook goes into a box.
  //   Part 2: Ajay opens the box. His motives arrive as the run goes on: the lenders and the workshop (start), Mum's
  //   house (after-1), Iron Eclipse and the buyout (offer, refused), Austin's last page and his name (after-3),
  //   the stakes restated (final). `why` is read by the number of flights, so it follows the same order.
  //
  // NEW KEYS (read by js/ui-story.js; every beat is { who, text }, one sentence, a scene is at most six beats):
  //   STORY.austin.endings.box = { title, kicker, beats, line }
  //   STORY.ajay.interludes = { start, "after-1", offer, refused, "after-3", final }: lists of beats. `offer` is a list
  //     that also carries .sell, .refuse, .sell_hint and .refuse_hint (the labels and one-line hints of its two buttons).
  //     `start` repeats `intro` (the same six beats); show only one of them.
  //   STORY.ajay.endings = { legend, comeback, close, sold, timeout, broke }, each { title, kicker, beats, line }.
  //   Speakers: team, partner, customer, notebook, rival (Iron Eclipse), mum.
  //   STORY.journal = { title, part1, part2, next, locked }: the STORY SO FAR screen. part1 and part2 are lists of
  //     { id, who, text, when }: one or two short lines each. `when` names the moment that unlocks the entry (js/ui-story.js
  //     decides when it has come: start, step-1, step-2, step-3, offer, refused, sold, after-1, after-3). `next` holds the
  //     few words for what to do now. No game number is written there: the debt and the months come from getComeback().
  var STORY = {
    title: "GRAVITRON",
    subtitle: "The Gravitronical Odyssey",
    speakers: { team: "YOUR TEAM", partner: "YOUR PARTNER", customer: "THE CUSTOMER", notebook: "AUSTIN'S NOTEBOOK",
                rival: "IRON ECLIPSE", mum: "MUM" },

    // The home page: one card per mode. No game numbers here (every number on screen comes from the back end).
    modes: {
      part1: { kicker: "PART 1 · 1958", name: "AUSTIN'S FIRST SATELLITE", pitch: "Three short missions, one idea each.", tag: "START HERE" },
      part2: { kicker: "PART 2 · TODAY", name: "AJAY'S COMEBACK", pitch: "Austin's grandson owes the bank. Sell satellite data, pay it back in time.",
               // The difficulty, in plain words, by tier id (the tier's own name is shown small beside it).
               levels: { training: "EASY", standard: "NORMAL", expert: "HARD" } }
    },

    // ------------------------------------------------ Story 1: Austin Albert, Part 1 (the 1958 walkthrough)
    austin: {
      who: { map: "team", briefing: "team", orbit: "team", build: "team", launcher: "team", review: "team",
             "mission-start": "team", "mission-end": "team", debrief: "team", closing: "notebook",
             notebook: "notebook", "event-calibration": "notebook" },
      // Shown once, before step 1 of the walkthrough, in the same scene as step 1's opening beats: together they stay
      // within six beats. The year is spelled out (no digits in story text).
      intro: [
        { who: "team", text: "October, nineteen fifty-seven. A radio on the bench will not stop beeping." },
        { who: "team", text: "Sputnik, passing over our roof. Someone else got there first." },
        { who: "team", text: "You are Austin Albert, a young rocket engineer. Marcus Voss runs the programme." },
        { who: "team", text: "The money pays for one launch window. Miss it, and we never fly." }
      ],
      // Part 1, the walkthrough: three short missions, one idea each. name is the step's label on the home page;
      // open is shown before the step; close is the debrief's last line once it passes. The opening beats double as the
      // how-to-play hints, so each rule of the notebook says what to do.
      steps: {
        "1": { name: "THE BASICS",
               open: [{ who: "team", text: "Tonight we build. A body, a counter for cosmic rays, power, a radio, a computer." },
                      { who: "notebook", text: "Rule one: no power, no signal. Fit solar cells, or the batteries die." }],
               close: { who: "notebook", text: "It beeps from orbit, and the counter heard something nobody expected." } },
        "2": { name: "POWER AND DATA",
               open: [{ who: "team", text: "Another window, a smaller rocket. This time you choose the orbit, then build." },
                      { who: "notebook", text: "Rule two: every orbit has a night. The cells go dark and the battery carries us." },
                      { who: "notebook", text: "Rule three: data that never comes home proves nothing. Voss will ask for proof." }],
               close: { who: "notebook", text: "It talks through the dark. Voss is reading our data over my shoulder." } },
        "3": { name: "YOUR MISSION",
               open: [{ who: "team", text: "Voss wants a launch for the cameras. The job, orbit, parts and rocket are yours." },
                      { who: "notebook", text: "My name goes on this design. If it fails, it fails on my page." },
                      { who: "team", text: "Listen at the top of the climb. Nobody knows what the counter will say." }],
               close: { who: "notebook", text: "At the top, the counter went silent. Not broken: drowned. Radiation, all round the Earth." } }
      },
      // After step 3 passes (six beats, the last one fixed). Fiction: no real launch is named here.
      epilogue: [
        { who: "team", text: "Voss walks up to the cameras and says the discovery is his." },
        { who: "team", text: "Nineteen sixty. Austin's biggest satellite is lost on the pad, as many early rockets were." },
        { who: "team", text: "Voss tells the board the design was Austin's fault. The programme is cut." },
        { who: "team", text: "Voss leaves with the credit and starts a company. He calls it Iron Eclipse." },
        { who: "notebook", text: "Austin writes one last page, shuts the notebook, and puts it in a box." },
        { who: "notebook", text: "Decades later, his grandson Ajay opens it." }
      ],
      // The ending screen of Part 1, shown after the epilogue: it looks forward, it does not recap.
      endings: {
        box: {
          title: "THE BOX",
          kicker: "AUSTIN'S STORY ENDS HERE",
          beats: [
            { who: "notebook", text: "Every rule he learned is in that book, in his own hand." },
            { who: "notebook", text: "The credit went to Voss. The truth went into a cardboard box." },
            { who: "notebook", text: "The workshop falls quiet. The years pass. The tape on the lid goes yellow." }
          ],
          line: "Someone has to open it."
        }
      },
      map: {
        start: ["Five stops, one mission. Begin at Mission Control.", "Begin at Mission Control. The gold route leads the way."],
        design: ["Follow the gold route. Each stop builds on the last."],
        ready: ["Everything is chosen. Check it at the Launch Pad."]
      },
      briefing: {
        none: ["Decide the goal first. The hardware follows from it.", "Pick the goal before any hardware. Everything follows from it."],
        chosen: ["Goal chosen. It decides which instruments count.", "Goal set. It names the instruments that will count."],
        locked: ["That goal needs research first."]
      },
      orbit: {
        none: ["Where we fly changes everything that follows."],
        "orbit-fit": ["That orbit cannot see what the goal needs."],
        leo: ["Low orbit is sharp and cheap, but ground contact is short.", "Close means sharp, but passes over the ground station are brief."],
        sso: ["Polar orbit passes over every pole, but costs more to reach.", "Polar orbit sees all of Earth. Getting there costs more."],
        geo: ["Geostationary never loses sight of one place, but detail blurs.", "Far away, so detail blurs. But it never loses the ground."]
      },
      build: {
        checks: {
          "no-objective": "Pick a goal first. Everything we build serves it.",
          "no-orbit": "Choose an orbit first. Every number here depends on it.",
          "empty-structure": "Every satellite needs a body to hold its parts.",
          "empty-instrument": "Start with an instrument. It is the reason we fly.",
          "empty-power": "Add power. The instrument, radio and computer all draw on it.",
          "empty-comms": "Add a radio. Data that stays on board is worth nothing.",
          "empty-computer": "Add a computer. Something must run the other parts.",
          "empty-attitude": "Add attitude control so the instrument stays pointed.",
          "body-count": "One satellite, one body. Remove the extra.",
          "body-payload": "That body cannot carry this much. Lighten the load or change body.",
          "body-slots": "That body has no room for another part of that kind.",
          "part-locked": "Research that part before you can fit it.",
          "too-late": "Too slow to build. Choose parts that are quicker to make.",
          budget: "Over budget. Something has to go.",
          power: "Parts draw more than the panels make. Add power or cut load.",
          "delta-v": "This orbit needs fuel to move itself. Add propulsion or cut mass.",
          mass: "Too heavy for the rocket. Cut mass or buy a bigger one.",
          "mass-margin": "Almost no mass to spare. Problems will hit harder.",
          "power-margin": "Power is tight. Solar cells weaken with age.",
          battery: "The battery is too small for Earth's shadow. Instruments go dark.",
          "battery-only": "No solar panel. The battery runs out, then the satellite goes silent.",
          data: "The instrument makes more data than the radio can send home.",
          smear: "A spinning satellite smears its pictures. Hold it steady.",
          "no-match": "None of these instruments counts for your goal.",
          "orbit-fit": "That orbit cannot see what the goal needs.",
          resolution: "That instrument is too blurry from this orbit."
        },
        thinBudget: ["Budget is nearly spent. Keep some back for surprises."],
        uncounted: ["{name}: it adds mass and cost, not science.", "{name}: our goal ignores it. Worth the mass?"],
        good: ["Every part supports the goal. That is a complete mission.", "Instrument, power, radio, computer in balance. A complete mission."]
      },
      launcher: {
        none: ["A bigger rocket carries more. It also costs more."],
        locked: ["That rocket needs research first."],
        reach: ["That rocket cannot reach this orbit. Try another."],
        mass: ["Too heavy for the rocket. Cut mass or buy a bigger one."],
        budget: ["Over budget. A cheaper rocket often saves more than cheaper parts."],
        fits: ["It fits. A bigger rocket would only eat the budget.", "It fits. Take no more rocket than the mission needs."],
        fitsThinMass: ["It fits, barely. Spare mass is what saves a mission."],
        fitsThinBudget: ["It fits, but almost nothing is left in the budget."]
      },
      review: {
        blocked: ["Not ready. Every red line must clear before launch."],
        margins: ["Thin margins are a choice, not an accident."],
        warnings: ["We can go, but every warning is a risk we chose."],
        go: ["Every check is clear. Launch when you are ready.", "All systems go. This is a complete, useful mission."]
      },
      "mission-start": {
        warned: ["We launched with warnings. Let us hope they stay quiet."],
        clean: ["Launched. Now we learn what we did not plan for.", "Launched. The whole world is listening for our signal."]
      },
      "mission-end": {
        lost: ["We lost it in flight. We must learn why."],
        done: ["The flight is over. Let us see what came home."]
      },
      debrief: {
        ended: "We lost it in flight. Find out why before we fly again.",
        mass: { good: "It flew, but the rocket was nearly full. Keep spare mass.", poor: "Mass was the limit. Every kilo asked something of the rocket." },
        power: { good: "It worked, but power was the limit. Everything on board draws it.", poor: "Power ran short. The instrument, radio and computer all draw on it." },
        budget: { good: "It flew, but we spent nearly everything. Keep a reserve.", poor: "Money was the limit. Every part had a price." },
        data: { good: "The radio was the limit. We saw more than we sent home.", poor: "Data was the limit. What never reaches the ground is lost." },
        event: { good: "An event cost us, but we survived it. Keep your margins.", poor: "Something we did not plan hurt us. Margins would have helped." },
        design: { good: "Close, but the hardware and the goal did not quite match.", poor: "The hardware did not match the goal. Start from the goal." },
        none: { good: "Nothing held us back. We met the goal.", poor: "We met the goal, but margins and money cost us stars." }
      },
      closing: {
        success: ["Useful observations came home. Whatever comes next, I will write it down here.", "The data came home and people can use it. I write the lessons down."],
        partial: ["Some observations came home, not enough. I write down what we missed."],
        failure: ["The satellite failed. I write down why, for whoever builds the next one."]
      },
      notebook: {
        briefing: "Everyone should see what the satellite sees, not only its owner.",
        orbit: "Height decides what we see, and how long we can talk.",
        build: "Every part I add costs mass, power and money.",
        launcher: "The rocket sets the limit before the first bolt is turned.",
        "review-margin": "Thin margins feel safe on paper. Space does not read paper.",
        "mission-start": "Launch day. I have never been so sure, or so afraid."
      }
    },

    // ------------------------------------------------ Story 2: Ajay Albert, Part 2 (the comeback)
    // Ajay, Austin's grandson, borrowed a fortune for a company that never flew. The player is Ajay. His partner reads
    // the spreadsheets, the customer is whoever pays for the contract (the briefing names the client), and Austin's
    // notebook (1958) still has advice. A reckless founder, kept light. No game numbers in any line: amounts, months and
    // dates come from the back end and are shown beside the text.
    ajay: {
      who: { map: "partner", briefing: "customer", orbit: "partner", build: "partner", launcher: "partner", review: "partner",
             "mission-start": "partner", "mission-end": "partner", debrief: "partner", closing: "partner",
             notebook: "notebook", "event-calibration": "notebook", why: "partner", hub: "partner", contract: "customer" },
      // Shown once, when a comeback starts (after the difficulty), then the workshop. interludes.start repeats it.
      intro: [
        { who: "partner", text: "Ajay Albert. Last year you borrowed a fortune to start Albert Orbital." },
        { who: "partner", text: "It never flew. The money went on a launch party, a logo and an office with a slide." },
        { who: "partner", text: "The lenders want it back by the deadline, or they take your grandfather's workshop." },
        { who: "notebook", text: "To whoever opens this: build it cheap, build it right, and bring the data home." },
        { who: "customer", text: "Iron Eclipse sells data for a fortune. Bring it cheaper and we will pay." },
        { who: "partner", text: "Pick a contract. Every satellite that delivers pays the debt down." }
      ],
      // The workshop (the hub): why Ajay keeps going, one line, chosen by the number of flights so far. The order is the
      // order of the story: the lenders, Mum, Iron Eclipse, Austin's name, then the lines that repeat.
      why: [
        "The lenders don't want satellites. They want the workshop.",
        "Mum co-signed the loan with her house. No pressure.",
        "Iron Eclipse bought your patents for pocket change. They're laughing.",
        "Grandpa's name belongs on that door. Put it back.",
        "Albert Orbital was a joke. Albert Orbital Two doesn't have to be.",
        "Customers are tired of Iron Eclipse prices. That's your opening."
      ],
      // The workshop's situation lines: before the first flight, after a paid one, under half the debt, and when a
      // quarter of the months or less is left.
      hub: {
        start: "Three contracts on the table. Pick one you can actually deliver.",
        paid: "That one paid. Pay some debt, or fly again while the interest ticks.",
        halfway: "Halfway there. The lenders have stopped calling twice a day.",
        late: "Clock's nearly out. Fly something cheap and sure.",
        loaned: "Cash in hand. The lenders will remember this.",
        credit: "Credit is thin. One more loan could cost everything.",
        name: "Debt's clear. Now fly well and make them say our name."
      },
      // The debrief's last line: what the client says about the data (paid in full, in part, or not at all).
      contract: {
        paid: "Data received. Payment sent. Pleasure doing business.",
        part: "Not everything we asked for. We paid for what arrived.",
        nothing: "Nothing new in that data. We can't pay for it."
      },
      // The ending: won, or lost by time, by cash, by the lenders seizing everything or by never making a name.
      ending: {
        won: [{ who: "partner", text: "Debt paid. The workshop is yours." }, { who: "notebook", text: "Well done, Ajay. Now build the next one." }],
        deadline: [{ who: "partner", text: "The deadline passed. The lenders took the keys." }, { who: "notebook", text: "Failure is a lesson. Try again." }],
        cash: [{ who: "partner", text: "Nothing left to launch with. The lenders took the keys." }, { who: "notebook", text: "Build cheaper. Try again." }],
        seized: [{ who: "partner", text: "Credit gone. The lenders took everything." }, { who: "notebook", text: "Borrow less. Earn their trust first." }],
        name: [{ who: "partner", text: "Debt paid. But nobody knows our name." }, { who: "notebook", text: "A name is earned one good flight at a time." }]
      },
      // Part 2's story scenes. Each interlude is shown once per run, between a debrief and the workshop. See the header
      // for which one comes when and what it reveals. The `offer` carries its buttons (set after this object).
      interludes: {
        start: [],   // filled from `intro` after this object
        "after-1": [
          { who: "mum", text: "Ajay? A man from the bank came to the house today. He was very polite." },
          { who: "mum", text: "I signed that loan with you, love. With the house. Our house." },
          { who: "partner", text: "You did tell her it was safe, right?" },
          { who: "mum", text: "I believe in you. Please don't make me regret it." }
        ],
        offer: [
          { who: "rival", text: "Ajay Albert. Iron Eclipse has been watching your little flights." },
          { who: "rival", text: "We bought your old patents for almost nothing. Now we will clear your whole debt." },
          { who: "rival", text: "In return: the workshop, and your grandfather's notebook. Every page." },
          { who: "partner", text: "Nobody wanted that old notebook until you started winning. Ask yourself why." }
        ],
        refused: [
          { who: "rival", text: "Suit yourself. We will see who owns that workshop at the deadline." },
          { who: "partner", text: "Good. Now you have to actually win. Pick a contract." }
        ],
        "after-3": [
          { who: "notebook", text: "If you reached this page, you have flown farther than I was allowed to." },
          { who: "notebook", text: "My first design was right. Marcus Voss changed it the night before launch." },
          { who: "notebook", text: "I let him. Don't let them bury it. Put my name back on the door." },
          { who: "partner", text: "Voss founded Iron Eclipse. This was never only about the debt, Ajay. It is his name." }
        ],
        final: [
          { who: "partner", text: "Almost there. The workshop, Mum's house and Austin's name ride on one more flight." }
        ]
      },
      // The seven endings are Part 1's `box` (STORY.austin.endings) and these six. Each stands alone: `sold` can come
      // before the last page is found, `legend` can come on Easy before it, and `broke` before Mum has called.
      endings: {
        legend: {
          title: "HIS NAME, RESTORED",
          kicker: "THE DEBT IS PAID. THE WORKSHOP IS YOURS.",
          beats: [
            { who: "partner", text: "The last payment clears. The lenders go quiet. The workshop is yours." },
            { who: "notebook", text: "The last page, folded small: his design was right. Marcus Voss changed it." },
            { who: "mum", text: "Your grandfather would have cried, love. Then he would have asked what is next." },
            { who: "partner", text: "Fresh paint over the workshop door: AUSTIN ALBERT, ROCKET ENGINEER." }
          ],
          line: "Voss took the credit. You took it back."
        },
        comeback: {
          title: "BACK IN BUSINESS",
          kicker: "THE DEBT IS PAID",
          beats: [
            { who: "partner", text: "The last payment clears. The lenders send a very polite letter." },
            { who: "mum", text: "The house is safe, love. Please, no more launch parties." },
            { who: "customer", text: "Another contract? Iron Eclipse is starting to notice you." },
            { who: "notebook", text: "Well done, Ajay. Now build the next one." }
          ],
          line: "The workshop lights stay on. Albert Orbital is open for business."
        },
        close: {
          title: "BY A HAIR",
          kicker: "THE LAST DAY",
          beats: [
            { who: "partner", text: "The last payment lands with hours to spare. The lenders' van is already outside." },
            { who: "mum", text: "I had started packing the kitchen, love. Then your message came." },
            { who: "partner", text: "They drive off empty-handed. The whole street watches from its windows." },
            { who: "notebook", text: "Margins. It is the first thing I wrote and the last thing you learned." }
          ],
          line: "You made it by a hair. Next time, leave more room."
        },
        sold: {
          title: "SOLD OUT",
          kicker: "THE DEBT IS GONE",
          beats: [
            { who: "rival", text: "Debt cleared, as promised. The workshop, the patents and the notebook are ours now." },
            { who: "rival", text: "We will thank your grandfather in the small print. Very small." },
            { who: "mum", text: "You saved the house, love. I know what it cost you." },
            { who: "partner", text: "The van pulls away with the box. You watch until the street is empty." }
          ],
          line: "There was one page at the bottom of the box. Nobody will ever read it."
        },
        timeout: {
          title: "THE KEYS ARE TAKEN",
          kicker: "THE DEADLINE PASSED",
          beats: [
            { who: "partner", text: "The deadline passes. The lenders do not wait for your next launch." },
            { who: "partner", text: "Two men in grey coats change the lock on your grandfather's workshop." },
            { who: "mum", text: "My name is on that loan, love. So is the house. We will manage." },
            { who: "notebook", text: "The calendar never read my notebook either." }
          ],
          line: "The calendar won. Next time, so will you."
        },
        broke: {
          title: "NOTHING LEFT TO LAUNCH",
          kicker: "THE CASH IS GONE",
          beats: [
            { who: "partner", text: "The account is empty. There is no rocket left that you can pay for." },
            { who: "partner", text: "The lenders have a word for this: default. They say it very politely." },
            { who: "mum", text: "My name is on that loan, love, and so is the house. Please don't say sorry." },
            { who: "notebook", text: "Every part costs money and weight. I wrote that on page one." }
          ],
          line: "Build cheaper, build right, and try again."
        }
      },
      map: {
        start: ["Nothing costs money until launch. Try ideas freely."],
        design: ["Test every idea here. After launch, nothing is free."],
        ready: ["All chosen. Check it twice: launch spends the cash."]
      },
      briefing: {
        // A contract design: the client speaks its own reason (data/contracts.js). These are for any other design.
        none: ["Choose what to watch. Then think who will pay for it."],
        locked: ["That topic is not on offer yet."],
        topics: {
          wildfire: "Crews need to know where fires start, while there is still time.",
          "sea-ice": "Ships and northern towns need ice maps through the polar night.",
          radiation: "Satellite builders need to know where the radiation is worst.",
          solar: "Power grids and airlines need warning before a solar flare hits.",
          weather: "Forecasters need cloud pictures from places with no weather stations.",
          ionosphere: "Radio operators need to know when the ionosphere will block them."
        }
      },
      orbit: {
        none: ["The customer pays for data, not for a pretty orbit."],
        "orbit-fit": ["That orbit cannot see the target. Nobody pays for that."],
        leo: ["Low orbit is cheap and sharp. You pay in minutes of contact."],
        sso: ["Polar orbit sees everything. The fuel to come down costs mass."],
        geo: ["Geostationary never looks away. Detail blurs, and launch costs more."]
      },
      build: {
        start: { who: "notebook", text: "Every part costs money and weight. Fit only what the job needs." },
        checks: {
          "no-objective": "No job yet. Without one, nothing here has a purpose.",
          "no-orbit": "No orbit chosen. These numbers will change once you pick one.",
          "empty-structure": "It needs a body. Everything else bolts onto it.",
          "empty-instrument": "Nothing aboard observes anything yet. Start with the instrument.",
          "empty-power": "No power. Every part you add will draw on it.",
          "empty-comms": "No radio. The client pays only for data that reaches us.",
          "empty-computer": "No computer, so nothing runs the other parts.",
          "empty-attitude": "It needs attitude control to point and hold steady.",
          "body-count": "Two bodies. A satellite has one.",
          "body-payload": "That body cannot carry this load. Lighter parts, or a bigger body?",
          "body-slots": "That body has no free slot for another part of that kind.",
          "part-locked": "That part is not on the shelf.",
          "too-late": "It takes too long to build. The window closes before launch.",
          budget: ["Over budget. Which part earns its place?", "The cash does not stretch this far. Something has to go."],
          power: "Parts draw more than the panels make. Something has to give.",
          "delta-v": "Not enough thrust for this orbit. More fuel, or less mass?",
          mass: "Too heavy. Cut mass, or pay for a bigger rocket.",
          "mass-margin": "Almost no spare mass. One surprise could end the mission.",
          "power-margin": "Thin power margin. Panels weaken over the years.",
          battery: "Without a bigger battery, instruments go dark in Earth's shadow.",
          "battery-only": "Batteries only. The satellite will go silent when they run out.",
          data: "It records more than the radio can send. Lost data earns nothing.",
          smear: "Spin smears the images. Steady pointing gets paid.",
          "no-match": "None of these instruments counts for this job.",
          "orbit-fit": "This orbit cannot see the target. No instrument can fix that.",
          resolution: "That instrument is too blurry from here. It will earn nothing."
        },
        thinBudget: ["Almost all the cash is spent. Nothing left for surprises."],
        uncounted: ["{name}: why is it aboard? The job ignores it.", "{name}: does the client pay for that?"],
        good: ["Every part serves the job. That is what cheap means.", "It balances. Nothing here is there for show."]
      },
      launcher: {
        none: ["The cheapest rocket that carries it. We are not made of money."],
        locked: ["That rocket is not on offer."],
        reach: ["It cannot reach this orbit. Another rocket, or another orbit?"],
        mass: ["Too heavy. Cut mass, or pay for a bigger rocket."],
        budget: ["That breaks the bank. Where is the cheapest place to cut?"],
        fits: ["It fits. A bigger rocket would be money spent on nothing."],
        fitsThinMass: ["It fits, but a full rocket leaves no room for surprises."],
        fitsThinBudget: ["It fits. But there is almost no cash left."]
      },
      review: {
        blocked: ["Not ready. Clear every red line before you spend a cent."],
        late: ["It lands after the deadline. Paid or not, the lenders win."],
        margins: ["Thin margins are a choice. Are you choosing them?"],
        warnings: ["A failed launch costs the whole satellite. Check the list."],
        go: ["All clear. Launch spends the cash; the data pays it back."]
      },
      "mission-start": {
        warned: ["You launched with warnings. Fingers crossed."],
        clean: ["Fingers crossed. The data pays only if it reaches the ground."]
      },
      "mission-end": {
        lost: ["We lost it. Let us find out why."],
        done: ["That is the last signal. Let us see what it earned."]
      },
      debrief: {
        ended: "It died early. Expensive lesson. Let us find out why.",
        mass: { good: "It flew, but the rocket was nearly full. Keep a reserve.", poor: "The rocket was too full. Spare mass is cheap insurance." },
        power: { good: "Power was the tightest part. Give it more room next time.", poor: "Power ran short. Every part you add draws on it." },
        budget: { good: "You spent nearly every dollar. It worked, but no cushion.", poor: "The cash ran out of room. Cheap means choosing." },
        data: { good: "The radio was the limit. You saw more than you sent.", poor: "Data decided this one. What never arrives, nobody pays for." },
        event: { good: "An event cost you, but you recovered. Keep those margins.", poor: "Something unplanned broke it. Margins are how you survive that." },
        design: { good: "The hardware nearly matched the job. Close.", poor: "Hardware and job did not match. Start from what the client needs." },
        none: { good: "Nothing held it back. That is how you beat Iron Eclipse.", poor: "Job done, but margins and money cost you stars." }
      },
      // The last line of a debrief for a design with no contract (a contract design uses "contract" above).
      closing: {
        success: ["Data delivered, and nobody overpaid. That is the business."],
        partial: ["Some of the job got done. Next time, all of it."],
        failure: ["The satellite is lost. Write down why, as Austin did."]
      },
      notebook: {
        briefing: "I built what I admired. I never asked who needed it.",
        "orbit-bad": "I chose the orbit I knew. The target should have chosen it.",
        "build-extra": "I loved every instrument. Only some of them served the goal.",
        "build-margin": "I left no margin. Orbit punished me for it.",
        launcher: "We had rocket to spare, so I never counted kilograms.",
        review: "I accepted warnings because we were behind. They found me later.",
        "mission-start": "The night before launch, I wrote: let the data be true.",
        debrief: {
          mass: "A mission with no spare mass has no second chances.",
          power: "Power looked like a detail. It never was.",
          budget: "Money you keep back is a margin too.",
          data: "More measurements are not more information. I learned that late.",
          event: "I never planned for the unplanned. Leave room for it.",
          design: "A fine machine for the wrong question is still a failure.",
          none: "This is the satellite I should have built."
        }
      },
      // The data event "calibration-drift" cannot change by chapter, so this line is added after the choice.
      // The keys are the choice index: 0 = pause and recalibrate, 1 = continue with reduced accuracy.
      "event-calibration": {
        ask: "The first sign of drift is easy to ignore. I ignored it.",
        "0": "A month lost beats a year of doubtful data. I learned late.",
        "1": "I kept collecting through the drift. More readings, less truth."
      }
    }
  };

  // The `offer` interlude carries its two buttons, and `start` is the intro again (one source for the words).
  STORY.ajay.interludes.offer.sell = "SELL";
  STORY.ajay.interludes.offer.refuse = "REFUSE";
  STORY.ajay.interludes.offer.sell_hint = "The whole debt is cleared. The workshop and the notebook are gone.";
  STORY.ajay.interludes.offer.refuse_hint = "The debt stays. The workshop and the notebook stay yours.";
  STORY.ajay.interludes.start = STORY.ajay.intro.map(function (b) { return { who: b.who, text: b.text }; });

  // The journal (STORY SO FAR): what the player has learned so far, one or two short lines per entry. An entry shows
  // as "???" until its moment has come. Same voice as the scenes above; no digits, no money.
  STORY.journal = {
    title: "STORY SO FAR",
    locked: "???",
    part1: [
      { id: "setup", who: "team", when: "start", text: "Sputnik beeps over our roof. Someone else got there first." },
      { id: "rule-1", who: "notebook", when: "step-1", text: "Rule one: no power, no signal. Cells keep it alive." },
      { id: "rule-2", who: "notebook", when: "step-2", text: "Rule two: every orbit has a night. The battery carries us." },
      { id: "rule-3", who: "notebook", when: "step-2", text: "Rule three: data that never comes home proves nothing." },
      { id: "discovery", who: "notebook", when: "step-3", text: "At the top, the counter went silent. Radiation, all round the Earth." },
      { id: "voss", who: "team", when: "step-3", text: "Voss took the credit. Then he blamed Austin for the loss." },
      { id: "box", who: "notebook", when: "step-3", text: "Austin shut the notebook in a box. His grandson opens it." }
    ],
    part2: [
      { id: "lenders", who: "partner", when: "start", text: "The lenders want the debt back, or they take Grandpa's workshop." },
      { id: "mum", who: "mum", when: "after-1", text: "Mum co-signed the loan with the house. Our house." },
      { id: "iron-eclipse", who: "rival", when: "offer", text: "Iron Eclipse bought your patents for almost nothing." },
      { id: "offer", who: "rival", when: "offer", text: "It will clear the debt, for the workshop and the notebook." },
      { id: "refused", who: "partner", when: "refused", text: "You said no. Now you have to win it." },
      { id: "sold", who: "rival", when: "sold", text: "You said yes. The debt is gone. So is the workshop." },
      { id: "last-page", who: "notebook", when: "after-3", text: "His design was right. Voss changed it, then founded Iron Eclipse." }
    ],
    // What to do now, in a few words. Part 1 adds the step's name (from austin.steps) after "next".
    next: {
      part1: "Fly the next step.",
      "part1-done": "Part one is done. On to the comeback.",
      "part2-none": "Start the comeback from the home page.",
      start: "Pick a contract. Fly it.",
      fly: "Fly a contract. Data pays the debt.",
      offer: "Answer Iron Eclipse first.",
      late: "Time is short. Fly something cheap and sure.",
      won: "Debt paid. Play again?",
      sold: "Sold out. Play again for the other road.",
      lost: "The keys are gone. Try again."
    }
  };

  // ---- the code that picks a line (no text below this point) ----
  // Every name here starts with "story" so it cannot clash with the rest of this file.
  // PAL is only used inside speakerArt(): it is defined further down the file than this block.
  var STORY_MAX_CHARS = 70;      // longest screen line
  var STORY_MAX_WORDS = 12;
  // Build lines go: first blocker, then the warnings, then an instrument that does not count, a thin budget and "all good".
  // The data and battery warnings sit on screen in most unfinished builds, so the question about an instrument that
  // does not count is rarely reached. Set this to true to ask it straight after the blockers instead.
  var STORY_ASK_FIRST = false;
  var STORY_THIN = 0.1;          // a margin under 10% is thin (the same limit the back end warns at)
  var STORY_WARNING_ORDER = ["orbit-fit", "no-match", "resolution", "smear", "data", "battery-only", "battery",
                             "power-margin", "mass-margin"];   // which warning the Build line talks about first
  // Checks that belong to the Rocket screen, not Build (as in getHints).
  var STORY_NOT_BUILD = ["no-launcher", "launcher-reach", "launcher-locked", "objective-locked"];

  function storyHas(obj, key) {
    return !!obj && typeof obj === "object" && typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);
  }

  // The chapter follows the mode: "austin" for a walkthrough step (Part 1), "ajay" for a comeback design (Part 2).
  // Any other design follows its tier: "austin" for the first tier or no design, "ajay" for every later tier.
  function storyChapter(design) {
    try {
      if (design && walkStepOf(design)) return "austin";
      if (design && (design.comeback || design.contract)) return "ajay";
      var tiers = data("TIERS");
      if (!design || !tiers.length || !byId(tiers, design.tier)) return "austin";   // an unknown tier plays as the first, as in newDesign
      return design.tier === tiers[0].id ? "austin" : "ajay";
    } catch (e) { return "austin"; }
  }

  // Ajay's growth: "early" in his first tier, "late" after that. Austin is always "early".
  function storyStage(design) {
    try {
      var at = -1;
      data("TIERS").forEach(function (t, i) { if (design && t && t.id === design.tier) at = i; });
      return at >= 2 ? "late" : "early";
    } catch (e) { return "early"; }
  }

  function storyHash(text) {
    var h = 7;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 1000003;
    return h;
  }
  // The variant comes from the screen, the state and the tier, objective and orbit, never from the parts,
  // so the wording does not shuffle every time a part is clicked.
  function storySeed(key, state, design) {
    return [key, state, design && design.tier, design && design.objective, design && design.orbit].join("|");
  }

  // Back-end checks as lists of ids. ok is false when they could not be run.
  function storyChecks(design) {
    var out = { ok: false, blockers: [], warnings: [] };
    try {
      if (typeof runChecks !== "function" || !design || !Array.isArray(design.parts)) return out;
      var r = runChecks(design);
      list(r && r.blockers).forEach(function (b) { if (b && typeof b.id === "string") out.blockers.push(b.id); });
      list(r && r.warnings).forEach(function (w) { if (w && typeof w.id === "string") out.warnings.push(w.id); });
      out.ok = true;
    } catch (e) { out.ok = false; }
    return out;
  }
  // "resolution-vidicon" and "smear-vidicon" are one kind of check each.
  function storyKind(id) {
    if (id.indexOf("resolution-") === 0) return "resolution";
    if (id.indexOf("smear-") === 0) return "smear";
    return id;
  }
  function storyHasCheck(checks, kind) {
    return checks.blockers.concat(checks.warnings).some(function (id) { return storyKind(id) === kind; });
  }

  // First instrument in the design that does not count for the objective, or null.
  function storyUncounted(design) {
    var found = null;
    try {
      list(design && design.parts).forEach(function (id) {
        var p = byId(data("PARTS"), id);
        if (found || !p || p.category !== "instrument" || typeof getPartFacts !== "function") return;
        var f = getPartFacts(design, id);
        if (f && f.counts === false) found = p;
      });
    } catch (e) { found = null; }
    return found;
  }
  // "Improved topside sounder (Alouette 2)" -> "Improved topside sounder"
  function storyShortName(part) {
    var name = part && typeof part.name === "string" ? part.name.replace(/\s*\([^)]*\)/g, "").replace(/^\s+|\s+$/g, "") : "";
    return name || "This instrument";
  }

  // True when this margin (mass, power or budget) is under 10%.
  function storyThin(design, which) {
    try {
      var m = getTotals(design).margins;
      var limit = typeof LOW_MARGIN === "number" ? LOW_MARGIN : STORY_THIN;
      return !!m && typeof m[which] === "number" && m[which] < limit;
    } catch (e) { return false; }
  }

  // Turns a line (string, list, early/late, or { who, text }) into { who, text } or "".
  function storySay(ctx, key, state, line, part) {
    if (line && typeof line === "object" && !Array.isArray(line) && typeof line.text !== "string") {
      line = storyHas(line, ctx.stage) ? line[ctx.stage] : line.early;
    }
    if (Array.isArray(line)) line = line.length ? line[storyHash(storySeed(key, state, ctx.design)) % line.length] : "";
    var who = ctx.c.who[key];
    var text = line;
    if (line && typeof line === "object") { text = line.text; if (line.who) who = line.who; }
    if (typeof text !== "string" || !text || !who) return "";
    if (text.indexOf("{name}") !== -1) {
      var full = text.replace("{name}", function () { return storyShortName(part); });
      var fits = full.length <= STORY_MAX_CHARS && full.split(" ").length <= STORY_MAX_WORDS;
      text = fits ? full : text.replace("{name}", function () { return "This instrument"; });
    }
    return { who: who, text: text };
  }

  function storyMap(ctx) {
    var d = ctx.design;
    var state = !d || !d.objective ? "start" : (d.orbit && d.launcher && list(d.parts).length ? "ready" : "design");
    return storySay(ctx, "map", state, ctx.c.map[state]);
  }

  function storyBriefing(ctx) {
    var d = ctx.design, t = ctx.c.briefing;
    // Part 2: the client of the contract this design flies for says why it pays (data/contracts.js), under its own name.
    var k = d && d.comeback ? contractOf(d) : null;
    if (k && k.reason) return { who: "customer", text: k.reason, name: k.client };
    if (!d || !d.objective) return storySay(ctx, "briefing", "none", t.none);
    if (!byId(data("OBJECTIVES"), d.objective)) return "";
    if (storyHasCheck(storyChecks(d), "objective-locked")) return storySay(ctx, "briefing", "locked", t.locked);
    if (t.topics) return storyHas(t.topics, d.objective) ? storySay(ctx, "briefing", d.objective, t.topics[d.objective]) : "";
    return storySay(ctx, "briefing", "chosen", t.chosen);
  }

  function storyOrbit(ctx) {
    var d = ctx.design, t = ctx.c.orbit;
    if (!d || !d.orbit) return storySay(ctx, "orbit", "none", t.none);
    if (!byId(data("ORBITS"), d.orbit)) return "";
    if (storyHasCheck(storyChecks(d), "orbit-fit")) return storySay(ctx, "orbit", "orbit-fit", t["orbit-fit"]);
    return storyHas(t, d.orbit) ? storySay(ctx, "orbit", d.orbit, t[d.orbit]) : "";
  }

  // Build: the first blocker, the warnings, an instrument that does not count, a thin budget, then "all good".
  function storyBuild(ctx) {
    var d = ctx.design, t = ctx.c.build, checks = storyChecks(d), i, kind;
    if (!checks.ok) return "";
    if (t.start && !list(d.parts).length) return storySay(ctx, "build", "start", t.start);
    for (i = 0; i < checks.blockers.length; i++) {
      if (STORY_NOT_BUILD.indexOf(checks.blockers[i]) !== -1) continue;
      kind = storyKind(checks.blockers[i]);
      if (storyHas(t.checks, kind)) return storySay(ctx, "build", kind, t.checks[kind]);
    }
    var odd = storyUncounted(d);
    if (odd && STORY_ASK_FIRST) return storySay(ctx, "build", "uncounted", t.uncounted, odd);
    for (i = 0; i < STORY_WARNING_ORDER.length; i++) {
      kind = STORY_WARNING_ORDER[i];
      if (storyHasCheck(checks, kind) && storyHas(t.checks, kind)) return storySay(ctx, "build", kind, t.checks[kind]);
    }
    if (odd) return storySay(ctx, "build", "uncounted", t.uncounted, odd);
    if (storyThin(d, "budget")) return storySay(ctx, "build", "thin-budget", t.thinBudget);
    return list(d.parts).length ? storySay(ctx, "build", "good", t.good) : "";
  }

  // Rocket: nothing chosen, cannot reach, too small, over budget, or fits.
  function storyLauncher(ctx) {
    var d = ctx.design, t = ctx.c.launcher;
    if (!d || !d.launcher || !d.orbit) return storySay(ctx, "launcher", "none", t.none);
    if (!byId(data("LAUNCHERS"), d.launcher)) return "";
    var checks = storyChecks(d);
    if (!checks.ok) return "";
    var has = function (id) { return checks.blockers.indexOf(id) !== -1 || checks.warnings.indexOf(id) !== -1; };
    if (has("launcher-locked")) return storySay(ctx, "launcher", "locked", t.locked);
    if (has("launcher-reach")) return storySay(ctx, "launcher", "reach", t.reach);
    if (has("mass")) return storySay(ctx, "launcher", "mass", t.mass);
    if (has("budget")) return storySay(ctx, "launcher", "budget", t.budget);
    if (has("mass-margin")) return storySay(ctx, "launcher", "fits-thin-mass", t.fitsThinMass);
    if (storyThin(d, "budget")) return storySay(ctx, "launcher", "fits-thin-budget", t.fitsThinBudget);
    return storySay(ctx, "launcher", "fits", t.fits);
  }

  // Readiness: blocked, warnings only, or all go.
  function storyReview(ctx) {
    var t = ctx.c.review, checks = storyChecks(ctx.design);
    if (!checks.ok) return "";
    if (checks.blockers.length) return storySay(ctx, "review", "blocked", t.blocked);
    if (t.late && checks.warnings.indexOf("deadline") !== -1) return storySay(ctx, "review", "late", t.late);
    if (checks.warnings.length) {
      var thin = checks.warnings.indexOf("mass-margin") !== -1 || checks.warnings.indexOf("power-margin") !== -1;
      return thin ? storySay(ctx, "review", "margins", t.margins) : storySay(ctx, "review", "warnings", t.warnings);
    }
    return storySay(ctx, "review", "go", t.go);
  }

  function storyMissionStart(ctx) {
    var warned = storyChecks(ctx.design).warnings.length > 0;
    var t = ctx.c["mission-start"];
    return storySay(ctx, "mission-start", warned ? "warned" : "clean", warned ? t.warned : t.clean);
  }

  // extra: the getDebrief result or the chooseEvent result; only ended_early is read.
  function storyMissionEnd(ctx, extra) {
    var lost = !!extra && typeof extra === "object" && !!extra.ended_early;
    var t = ctx.c["mission-end"];
    return storySay(ctx, "mission-end", lost ? "lost" : "done", lost ? t.lost : t.done);
  }

  // Debrief: one line by the limiting factor, and by stars (2 or more is "good").
  function storyDebrief(ctx, extra) {
    if (!extra || typeof extra !== "object") return "";
    var t = ctx.c.debrief;
    if (extra.ended_early) return storySay(ctx, "debrief", "ended", t.ended);
    if (!storyHas(t, extra.limiting) || typeof t[extra.limiting] !== "object") return "";
    var mood = typeof extra.stars === "number" && extra.stars >= 2 ? "good" : "poor";
    return storySay(ctx, "debrief", extra.limiting + "-" + mood, t[extra.limiting][mood]);
  }

  // Closing text: success (2 or 3 stars), partial (1 star) or failure (0 stars or ended early).
  function storyClosing(ctx, extra) {
    if (!extra || typeof extra !== "object") return "";
    var step = walkStepOf(ctx.design);
    if (step && typeof extra.stars === "number" && extra.stars >= WALK_PASS_STARS) return storyStepClose(ctx, step);
    if (!extra.ended_early && typeof extra.stars !== "number") return "";
    var result = extra.ended_early || extra.stars <= 0 ? "failure" : extra.stars === 1 ? "partial" : "success";
    return storySay(ctx, "closing", result, ctx.c.closing[result]);
  }

  // Austin's records: an excerpt tied to the decision on screen, or "" (they are occasional).
  // extra is the screen name, or the getDebrief result for the debrief.
  function storyNotebook(ctx, extra) {
    var d = ctx.design, t = ctx.c.notebook, screen = typeof extra === "string" ? extra : (extra && typeof extra === "object" ? "debrief" : "");
    if (!d) return "";
    var checks = storyChecks(d), line;
    switch (screen) {
      case "briefing":
        line = byId(data("OBJECTIVES"), d.objective) ? t.briefing : "";
        break;
      case "orbit":
        if (!byId(data("ORBITS"), d.orbit)) return "";
        line = storyHasCheck(checks, "orbit-fit") && storyHas(t, "orbit-bad") ? t["orbit-bad"] : t.orbit;
        break;
      case "build":
        if (!list(d.parts).length) return "";
        if (storyUncounted(d) || storyHasCheck(checks, "no-match")) line = t["build-extra"] || t.build;
        else if (storyHasCheck(checks, "mass-margin") || storyHasCheck(checks, "power-margin")) line = t["build-margin"] || t.build;
        else line = t.build;
        break;
      case "launcher":
        line = byId(data("LAUNCHERS"), d.launcher) ? t.launcher : "";
        break;
      case "review":
        if (!checks.ok || checks.blockers.length || !checks.warnings.length) return "";
        line = (storyHasCheck(checks, "mass-margin") || storyHasCheck(checks, "power-margin")) && storyHas(t, "review-margin") ? t["review-margin"] : t.review;
        break;
      case "mission-start":
        line = t["mission-start"];
        break;
      case "debrief":
        line = storyHas(t.debrief, extra.limiting) ? t.debrief[extra.limiting] : "";
        break;
      default:
        return "";
    }
    return storySay(ctx, "notebook", screen, line);
  }

  // The data event "calibration-drift" (data/events.js). Ajay only: he finds the warning in Austin's records.
  function storyEvent(ctx, extra) {
    var t = ctx.c["event-calibration"];
    if (!t) return "";
    var which = extra === 0 || extra === 1 ? String(extra) : "ask";
    return storySay(ctx, "event-calibration", which, t[which]);
  }

  // The walkthrough: a step's opening beats (a list), its closing beat, and the epilogue after step 3.
  function storyBeats(list0) {
    return list(list0).filter(function (b) { return b && typeof b.text === "string" && b.text; })
      .map(function (b) { return { who: b.who || "team", text: b.text }; });
  }
  function storyStep(ctx, step) { return ctx.c.steps && storyHas(ctx.c.steps, String(step)) ? ctx.c.steps[String(step)] : null; }
  function storyStepClose(ctx, step) {
    var s = storyStep(ctx, step);
    return s && s.close && s.close.text ? { who: s.close.who || "notebook", text: s.close.text } : "";
  }

  // Part 2, the workshop: why Ajay keeps going, one line in turn by the number of flights (extra).
  function storyWhy(ctx, flights) {
    var lines = list(ctx.c.why);
    if (!lines.length) return "";
    var n = typeof flights === "number" && flights >= 0 ? Math.floor(flights) : 0;
    return storySay(ctx, "why", String(n), lines[n % lines.length]);
  }

  // storyLine(key, design, extra) -> "" or { who, text }; for "intro", "step-open", "epilogue" and "ending", a list. Never throws.
  function storyLine(key, design, extra) {
    try {
      var chapter = storyChapter(design);
      var ctx = { c: STORY[chapter], design: design || null, stage: storyStage(design) };
      switch (key) {
        case "intro":             return ctx.c.intro.map(function (b) { return { who: b.who, text: b.text }; });
        case "step-open":         return storyBeats((storyStep(ctx, extra) || {}).open);
        case "step-close":        return storyStepClose(ctx, extra);
        case "epilogue":          return storyBeats(ctx.c.epilogue);
        case "map":               return storyMap(ctx);
        case "briefing":          return storyBriefing(ctx);
        case "orbit":             return storyOrbit(ctx);
        case "build":             return storyBuild(ctx);
        case "launcher":          return storyLauncher(ctx);
        case "review":            return storyReview(ctx);
        case "mission-start":     return storyMissionStart(ctx);
        case "mission-end":       return storyMissionEnd(ctx, extra);
        case "debrief":           return storyDebrief(ctx, extra);
        case "closing":           return storyClosing(ctx, extra);
        case "notebook":          return storyNotebook(ctx, extra);
        case "event-calibration": return storyEvent(ctx, extra);
        case "why":               return storyWhy(ctx, extra);
        case "hub":               return storyHas(ctx.c.hub, extra) ? storySay(ctx, "hub", extra, ctx.c.hub[extra]) : "";
        case "contract":          return storyHas(ctx.c.contract, extra) ? storySay(ctx, "contract", extra, ctx.c.contract[extra]) : "";
        case "ending":            return storyBeats(storyHas(ctx.c.ending, extra) ? ctx.c.ending[extra] : []);
        default:                  return "";
      }
    } catch (e) { return key === "intro" || key === "step-open" || key === "epilogue" || key === "ending" ? [] : ""; }
  }

  // speakerArt(who) -> a 16 x 16 pixel portrait (the same size and class as directorArt), or null for an unknown speaker.
  // Four silhouettes: two colleagues, a bun and goggles, a wide-brimmed hat, and a book with no face.
  function speakerArt(who) {
    var P = PAL;
    var rects, label;
    if (who === "team") {
      // Austin's NASA colleagues: one in a white shirt and red tie, one behind in a teal coat.
      label = "Portrait of your NASA team: two colleagues in shirtsleeves";
      rects = [
        [0, 0, 16, 16, P.portrait],
        [10, 3, 5, 2, P.hair], [10, 5, 5, 5, P.skin], [11, 6, 1, 1, P.sky], [13, 6, 1, 1, P.sky], [11, 8, 3, 1, P.mouth],
        [11, 10, 3, 1, P.skin], [9, 11, 7, 5, P.blue], [12, 11, 3, 1, P.ink], [13, 12, 1, 1, P.ink],
        [3, 2, 5, 2, P.sky], [2, 4, 7, 6, P.skin], [2, 3, 1, 3, P.sky], [3, 6, 1, 1, P.sky], [6, 6, 1, 1, P.sky],
        [4, 8, 3, 1, P.mouth], [4, 10, 3, 1, P.skin],
        [0, 11, 10, 5, P.ink], [4, 11, 3, 1, P.muted], [5, 12, 1, 4, P.red]
      ];
    } else if (who === "partner") {
      // The engineering partner: hair in a bun, goggles pushed up, a red work shirt.
      label = "Portrait of your engineering partner, goggles pushed up on the head";
      rects = [
        [0, 0, 16, 16, P.portrait],
        [7, 1, 3, 2, P.hair], [5, 3, 7, 3, P.hair], [4, 4, 1, 4, P.hair], [12, 4, 1, 4, P.hair],
        [5, 5, 2, 1, P.gold], [9, 5, 2, 1, P.gold], [7, 5, 2, 1, P.sky],
        [5, 6, 7, 5, P.skin], [6, 7, 1, 1, P.sky], [10, 7, 1, 1, P.sky], [7, 9, 3, 1, P.mouth],
        [7, 11, 3, 1, P.skin], [2, 12, 13, 4, P.red], [6, 12, 5, 1, P.ink], [1, 13, 2, 3, P.red],
        [12, 13, 2, 2, P.line], [13, 12, 1, 1, P.gold]
      ];
    } else if (who === "customer") {
      // The customer: a wide-brimmed field hat, a gold vest, a radio on the shoulder.
      label = "Portrait of the customer in a field hat and vest";
      rects = [
        [0, 0, 16, 16, P.portrait],
        [5, 1, 6, 3, P.blue], [5, 3, 6, 1, P.gold], [1, 4, 14, 2, P.navy],
        [5, 6, 6, 4, P.skin], [6, 7, 1, 1, P.sky], [9, 7, 1, 1, P.sky], [7, 9, 2, 1, P.mouth],
        [7, 10, 2, 1, P.skin], [3, 11, 10, 5, P.ink], [3, 11, 3, 5, P.gold], [10, 11, 3, 5, P.gold],
        [12, 8, 1, 3, P.muted], [11, 11, 2, 3, P.sky], [11, 12, 1, 1, P.red]
      ];
    } else if (who === "notebook") {
      // Austin's notebook, open: lines of notes on the left, a sketch of a satellite on the right, a pencil.
      label = "Austin's open notebook, with a sketch of a satellite";
      rects = [
        [0, 0, 16, 16, P.portrait],
        [1, 2, 14, 12, P.line], [2, 3, 6, 10, P.ink], [8, 3, 6, 10, P.ink], [7, 3, 2, 10, P.muted],
        [3, 4, 4, 1, P.muted], [3, 6, 3, 1, P.muted], [3, 8, 4, 1, P.muted], [3, 10, 2, 1, P.muted],
        [11, 4, 1, 1, P.gold], [9, 6, 1, 2, P.blue], [12, 6, 1, 2, P.blue], [10, 6, 2, 2, P.navy],
        [9, 10, 1, 1, P.muted], [11, 10, 1, 1, P.muted], [13, 10, 1, 1, P.muted],
        [7, 12, 2, 4, P.red], [10, 14, 5, 1, P.gold], [15, 14, 1, 1, P.red], [9, 14, 1, 1, P.sky]
      ];
    } else return null;
    return art("0 0 16 16", rects, label, "portrait");
  }
  // STORY-END

  // ---------------------------------------------------------------- small helpers
  function list(x) { return Array.isArray(x) ? x : []; }
  function byId(items, id) {
    var found = null;
    list(items).forEach(function (item) { if (item && item.id === id) found = item; });
    return found;
  }
  function data(name) {
    // Reads a data global without throwing if its file is missing.
    // (The data files use `const`, which is not on `window`, hence the typeof checks.)
    switch (name) {
      case "PARTS":      return typeof PARTS !== "undefined" ? list(PARTS) : [];
      case "ORBITS":     return typeof ORBITS !== "undefined" ? list(ORBITS) : [];
      case "LAUNCHERS":  return typeof LAUNCHERS !== "undefined" ? list(LAUNCHERS) : [];
      case "OBJECTIVES": return typeof OBJECTIVES !== "undefined" ? list(OBJECTIVES) : [];
      case "TIERS":      return typeof TIERS !== "undefined" ? list(TIERS) : [];
      case "EVENTS":     return typeof EVENTS !== "undefined" ? list(EVENTS) : [];
      default:           return [];
    }
  }
  function isNum(v) { return typeof v === "number" && isFinite(v); }

  function num(v, places) {
    if (!isNum(v)) return "–";
    return v.toLocaleString("en-US", { maximumFractionDigits: places === undefined ? 1 : places });
  }
  function money(v) { return isNum(v) ? "$" + num(v, v < 1 ? 2 : 1) + "M" : "–"; }
  function signed(v, places) { return (v > 0 ? "+" : "") + num(v, places); }
  // Small values keep two significant figures, so a 1958 radio's 0.06 W does not read as 0 W.
  function fine(v) {
    if (!isNum(v)) return "–";
    var a = Math.abs(v);
    if (a === 0 || a >= 10) return num(v, 0);
    if (a >= 1) return num(v, 1);
    return num(v, Math.min(8, 1 - Math.floor(Math.log(a) / Math.LN10)));
  }
  // A data rate in GB, MB or kB a day, whichever reads best for the larger of the values (unit formatting only).
  function dataUnit(gb) { return !(gb > 0) || gb >= 1 ? ["GB", 1] : gb >= 0.001 ? ["MB", 1000] : ["kB", 1e6]; }
  function dataText(gb, sign) {
    var u = dataUnit(Math.abs(gb));
    return (sign && gb > 0 ? "+" : "") + fine(gb * u[1]) + " " + u[0];
  }
  function starsText(n) {
    n = isNum(n) ? n : 0;
    var s = "";
    for (var i = 0; i < 3; i++) s += i < n ? "★" : "☆";
    return s;
  }

  // Builds an element. `kids` may be strings (as text) or nodes.
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    });
    (Array.isArray(kids) ? kids : [kids]).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  // Draws pixel art from [x, y, w, h, colour] rows. Static art only, never data text.
  function art(viewBox, rects, label, className) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("shape-rendering", "crispEdges");
    if (className) svg.setAttribute("class", className);
    if (label) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label); }
    else svg.setAttribute("aria-hidden", "true");
    rects.forEach(function (r) {
      var rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", r[0]); rect.setAttribute("y", r[1]);
      rect.setAttribute("width", r[2]); rect.setAttribute("height", r[3]);
      if (String(r[4]).indexOf("--") === 0) rect.style.fill = "var(" + r[4] + ")";
      else rect.setAttribute("fill", r[4]);
      if (r[5] !== undefined) rect.setAttribute("opacity", r[5]);
      svg.appendChild(rect);
    });
    return svg;
  }

  // ---- low-poly pictures (js/lowpoly.js and the js/lp-*.js model files). One canvas for one scene, or null when the
  // art is missing or cannot start: every caller keeps working without it. The canvas draws once it is on the page and
  // stops by itself when its screen is replaced. It is not focusable and cannot be dragged, so it adds no tab stop.
  function lowPoly(make, className) {
    try {
      if (typeof LowPoly !== "object" || !LowPoly || typeof LowPoly.view !== "function" || !LowPoly.scenes) return null;
      var wrap = make(LowPoly);
      if (!wrap) return null;
      var canvas = document.createElement("canvas");
      canvas.className = "lp " + (className || "");
      LowPoly.view(canvas, wrap, { drag: false, keys: false, fps: 30 });
      return canvas;
    } catch (e) { return null; }
  }
  // The home page's picture: the low-poly title scene filling the first screen, drifting slowly (still under reduced
  // motion). On a wide screen the satellite is framed right of centre, so the title and the menu sit on open sky; on a
  // tall one it stays centred, between the title and the menu. Its label comes from the scene. Null without the art.
  // HERO_AIM: [share of the half-width to the right, share of the half-height up, camera distance times].
  var HERO_AIM = { wide: [0.4, 0.04, 1.12], tall: [0, 0.17, 1] };
  function titleHero() {
    try {
      if (typeof LowPoly !== "object" || !LowPoly || typeof LowPoly.view !== "function" || !LowPoly.scenes ||
          typeof LowPoly.scenes.title !== "function") return null;
      var wrap = LowPoly.scenes.title({});
      if (!wrap || !wrap.scene || !wrap.scene.camera) return null;
      var cam = wrap.scene.camera, home = { target: (cam.target || [0, 0, 0]).slice(), dist: cam.dist };
      var canvas = document.createElement("canvas");
      canvas.className = "lp lp-hero";
      var ctl = null, ro = null, seen = false, size = "";
      // Frame the satellite for the canvas's shape: the scene's own fit (its field of view), then the camera moved
      // sideways and up so the satellite lands where HERO_AIM puts it. Runs on every resize.
      var aim = function () {
        if (!canvas.isConnected) { if (seen && ro) ro.disconnect(); return; }
        seen = true;
        var w = canvas.clientWidth, h = canvas.clientHeight;
        if (!(w > 0 && h > 0) || size === w + "x" + h) return;
        size = w + "x" + h;
        if (typeof wrap.fit === "function") wrap.fit(w, h);
        var a = w / h >= 1.15 ? HERO_AIM.wide : HERO_AIM.tall, D = Math.PI / 180;
        var yaw = cam.yaw * D, pitch = cam.pitch * D;
        var right = [Math.cos(yaw), 0, -Math.sin(yaw)];
        var up = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
        cam.dist = home.dist * a[2];
        var hh = cam.dist * Math.tan(cam.fov * D / 2), hw = hh * w / h;
        cam.target = home.target.map(function (t, i) { return t - right[i] * a[0] * hw - up[i] * a[1] * hh; });
        if (ctl) ctl.redraw();
      };
      if (typeof ResizeObserver === "function") { ro = new ResizeObserver(aim); ro.observe(canvas); }
      // Sharper than the default budget (the picture fills the screen), and a slower frame rate for a slow drift.
      ctl = LowPoly.view(canvas, wrap, { drag: false, keys: false, fps: 24, maxPixels: 1200000 });
      return canvas;
    } catch (e) { return null; }
  }

  // The home page without the low-poly art: a flat pixel sky with the curve of the Earth along its foot (static art).
  function titleSky() {
    var rects = [], seed = 11, i, y;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (i = 0; i < 90; i++) {
      var r = rnd();
      rects.push([Math.floor(rnd() * 320), Math.floor(rnd() * 150), r < 0.12 ? 2 : 1, 1, r < 0.08 ? "--pal-light" : r < 0.55 ? "--pal-metal" : "--pal-white"]);
    }
    var R = 520, cx = 186, top = 146, cy = top + R, prev = null;
    for (y = top; y < 200; y++) {
      var half = Math.round(Math.sqrt(R * R - (cy - y) * (cy - y))), x0 = cx - half, x1 = cx + half;
      rects.push([x0, y, x1 - x0, 1, "--map-sea"]);
      if (!prev) rects.push([x0, y, x1 - x0, 1, "--map-shore"]);
      else { rects.push([x0, y, prev[0] - x0 + 1, 1, "--map-shore"]); rects.push([prev[1] - 1, y, x1 - prev[1] + 1, 1, "--map-shore"]); }
      prev = [x0, x1];
    }
    [[150, 152, 34, 2], [200, 160, 52, 3], [96, 168, 40, 3], [236, 176, 30, 2], [130, 186, 60, 3], [40, 192, 36, 2]].forEach(function (c) {
      rects.push([c[0], c[1], c[2], c[3], "--map-wave"]);
    });
    var svg = art("0 0 320 200", rects, null, "title-sky");
    svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
    return svg;
  }

  // The GRAVITRON logotype: flat letters drawn as shapes on an 11-unit grid, their corners cut at 45 degrees like the
  // facets of the low-poly art. Drawn, not typed, so it looks the same with or without the web fonts. Static art: the
  // heading holding it carries the text. [width, path]; a hole is a second outline (even-odd fill).
  var LOGO_GLYPHS = {
    G: [6, "M2 0H6V2H2V9H4V6.5H3V4.5H6V9L4 11H2L0 9V2Z"],
    R: [6, "M0 0H4L6 2V4.5L4 6.5L6 11H4L2 6.5V11H0ZM2 2V4.5H4V2Z"],
    A: [6, "M0 11V2L2 0H4L6 2V11H4V7H2V11ZM2 2V5H4V2Z"],
    V: [6, "M0 0H2V6.5L3 8.3L4 6.5V0H6V7L4 11H2L0 7Z"],
    I: [2, "M0 0H2V11H0Z"],
    T: [6, "M0 0H6V2H4V11H2V2H0Z"],
    O: [6, "M2 0H4L6 2V9L4 11H2L0 9V2ZM2 2V9H4V2Z"],
    N: [6, "M0 11V0H2L4 5V0H6V11H4L2 6V11Z"]
  };
  var LOGO_GAP = 1.4;
  // The title as a heading: the drawn logotype when every letter has a shape, else the plain text.
  function logotype(text) {
    var letters = String(text).toUpperCase().split("");
    var h1 = el("h1", { class: "big-title" });
    if (!letters.length || letters.some(function (c) { return !LOGO_GLYPHS[c]; })) { h1.textContent = text; return h1; }
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg"), x = 0;
    letters.forEach(function (c) {
      var g = LOGO_GLYPHS[c], path = document.createElementNS(NS, "path");
      path.setAttribute("d", g[1]);
      path.setAttribute("transform", "translate(" + x + " 0)");
      svg.appendChild(path);
      x += g[0] + LOGO_GAP;
    });
    svg.setAttribute("viewBox", "0 0 " + (x - LOGO_GAP) + " 11");
    svg.setAttribute("class", "logo");
    svg.setAttribute("fill-rule", "evenodd");
    svg.setAttribute("aria-hidden", "true");
    h1.appendChild(el("span", { class: "sr-only", text: text }));
    h1.appendChild(svg);
    return h1;
  }

  // Flat icons: one colour (currentColor), a 16 x 16 grid, drawn here as shapes. They sit beside words and
  // never replace them, so a screen reader or a colour-blind player loses nothing. Static art only.
  var ICONS = {
    mass:       [["path", { d: "M3 14h10l-1.4-7H4.4L3 14Z" }], ["circle", { cx: 8, cy: 4.6, r: 1.7 }]],
    power:      [["path", { d: "M9.2 1.5 3.8 9H8l-1 5.5L12.2 7H8l1.2-5.5Z" }]],
    budget:     [["circle", { cx: 8, cy: 8, r: 6 }], ["circle", { cx: 8, cy: 8, r: 2.4 }]],
    data:       [["ellipse", { cx: 8, cy: 4, rx: 5.5, ry: 2 }], ["path", { d: "M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" }]],
    blocker:    [["circle", { cx: 8, cy: 8, r: 6 }], ["path", { d: "M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" }]],
    warning:    [["path", { d: "M8 2 1.6 13.5h12.8L8 2Z" }], ["path", { d: "M8 6.4v3.2M8 11.7v.1" }]],
    ok:         [["circle", { cx: 8, cy: 8, r: 6 }], ["path", { d: "M5.2 8.2l2 2 3.6-4" }]],
    instrument: [["rect", { x: 2, y: 4.5, width: 12, height: 8.5, rx: 1.5 }], ["circle", { cx: 8, cy: 8.8, r: 2.3 }], ["path", { d: "M5.6 4.5 6.6 3h2.8l1 1.5" }]],
    comms:      [["path", { d: "M8 14V8.2" }], ["circle", { cx: 8, cy: 6.6, r: 1.4 }], ["path", { d: "M4.9 4a4.4 4.4 0 0 0 0 5.2M11.1 4a4.4 4.4 0 0 1 0 5.2" }]],
    computer:   [["rect", { x: 4, y: 4, width: 8, height: 8, rx: 1 }], ["path", { d: "M6.5 2v2M9.5 2v2M6.5 12v2M9.5 12v2M2 6.5h2M2 9.5h2M12 6.5h2M12 9.5h2" }]],
    propulsion: [["path", { d: "M8 1.5c2.2 1.6 3.2 4 3.2 6.8L8 12 4.8 8.3C4.8 5.5 5.8 3.1 8 1.5Z" }], ["path", { d: "M6.8 14l1.2 1 1.2-1" }]],
    structure:  [["path", { d: "M8 1.5 13.5 4.5v7L8 14.5l-5.5-3v-7L8 1.5Z" }], ["path", { d: "M2.5 4.5 8 7.5l5.5-3M8 7.5v7" }]],
    attitude:   [["path", { d: "M13 8a5 5 0 1 1-1.6-3.7" }], ["path", { d: "M13.4 2.4v3h-3" }]]
  };
  ICONS.science = ICONS.instrument;
  ICONS.briefing = [["path", { d: "M3 2h10v13H3z M6 1h4v3H6z M5 7h6 M5 10h6" }]];
  ICONS.orbit = [["path", { d: "M11 8a3 3 0 1 0-6 0 3 3 0 1 0 6 0 M2 12C-2 8 12-2 14 4S4 18 2 12" }]];
  ICONS.build = [["path", { d: "M10 2l-2 3 3 3 3-2c1 4-3 6-5 4l-5 5-3-3 5-5c-2-3 0-6 4-5" }]];
  ICONS.review = [["path", { d: "M3 2h10v13H3z M5 8l2 2 4-5" }]];
  ICONS.map = [["path", { d: "M1 3l4-2 6 2 4-2v12l-4 2-6-2-4 2z M5 1v12 M11 3v12" }]];
  ICONS.design = [["path", { d: "M2 13L12 3l2 2L4 15H2z" }]];
  ICONS.none = [["path", { d: "M2 8l4 4 8-9" }]];
  ICONS.launcher = [["path", { d: "M5 11V5L8 1l3 4v6H5Z M5 8l-3 5h3 M11 8l3 5h-3 M6 14h4" }],
    ["circle", { cx: 8, cy: 6, r: 1.3 }]];
  ICONS.event = ICONS.warning;
  ICONS.cost = ICONS.budget;
  // The six topics (objective ids), for Part 2's contract cards.
  ICONS.radiation = [["circle", { cx: 8, cy: 8, r: 1.6 }], ["ellipse", { cx: 8, cy: 8, rx: 6.3, ry: 2.4, transform: "rotate(30 8 8)" }],
                     ["ellipse", { cx: 8, cy: 8, rx: 6.3, ry: 2.4, transform: "rotate(-30 8 8)" }]];
  ICONS.solar = [["circle", { cx: 8, cy: 8, r: 3 }], ["path", { d: "M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" }]];
  ICONS.weather = [["path", { d: "M4.6 12.8h7a2.6 2.6 0 0 0 .2-5.2 3.9 3.9 0 0 0-7.4-.8 3 3 0 0 0 .2 6Z" }]];
  ICONS.wildfire = [["path", { d: "M8 14.6c-2.9 0-4.6-1.9-4.6-4.4 0-2.7 2.1-4.1 2.7-6.8 1.3 1 1.9 2.5 1.9 3.7.7-.6 1.1-1.7 1.1-2.9 2 1.4 3.6 3.5 3.6 6 0 2.5-1.8 4.4-4.7 4.4Z" }]];
  ICONS["sea-ice"] = [["path", { d: "M8 1.4v13.2M2.3 4.7l11.4 6.6M2.3 11.3l11.4-6.6M6.3 2.6 8 4.2l1.7-1.6M6.3 13.4 8 11.8l1.7 1.6" }]];
  ICONS.ionosphere = [["path", { d: "M3 14.6a5 5 0 0 1 10 0M1.2 9.8a7.6 7.6 0 0 1 13.6 0M4.4 5.4a6 6 0 0 1 7.2 0" }]];
  // A flat icon by name, or null for an unknown name. With a label it is an image; without one it is decoration.
  function icon(name, label, className) {
    var shapes = ICONS[name];
    if (!shapes) return null;
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "icon" + (className ? " " + className : ""));
    if (label) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label); }
    else svg.setAttribute("aria-hidden", "true");
    shapes.forEach(function (s) {
      var node = document.createElementNS(NS, s[0]);
      Object.keys(s[1]).forEach(function (k) { node.setAttribute(k, s[1][k]); });
      svg.appendChild(node);
    });
    return svg;
  }

  // The first sentence of a text, for cards that show one line and keep the rest behind "More".
  function firstSentence(text) {
    var t = String(text || ""), m = /^(.+?[.!?])(\s|$)/.exec(t);
    return m ? m[1] : t;
  }
  function restOf(text) {
    var t = String(text || ""), first = firstSentence(t);
    return t.slice(first.length).replace(/^\s+/, "");
  }
  // Extra words, folded away until asked for (a <details>): reachable by keyboard and screen readers.
  function more(text, label) {
    if (!text) return null;
    return el("details", { class: "more" }, [el("summary", { text: label || "More" }), el("p", { class: "card-blurb", text: text })]);
  }

  function facts(rows) {
    return el("dl", { class: "facts" }, rows.filter(Boolean).map(function (r) {
      return el("div", null, [el("dt", { text: r[0] }), el("dd", { text: r[1] })]);
    }));
  }

  function button(label, onClick, opts) {
    opts = opts || {};
    return el("button", { type: "button", class: "btn" + (opts.primary ? " primary" : "") + (opts.big ? " big" : "") + (opts.quiet ? " quiet" : ""),
      disabled: !!opts.disabled, onclick: onClick, "aria-label": opts.aria, "data-key": opts.key }, label);
  }

  // ---------------------------------------------------------------- pixel art
  // Pixel-art colours are CSS custom properties (see :root in css/style.css), so the
  // colour scheme lives in one place. art() turns a "--name" into var(--name).
  var PAL = { ink: "--pal-white", muted: "--pal-metal", line: "--pal-frame", gold: "--pal-light", cyan: "--pal-glass",
              red: "--pal-red", blue: "--pal-cell", navy: "--pal-cell-dark", sky: "--pal-dark", skin: "--pal-skin",
              hair: "--pal-hair", mouth: "--pal-mouth", portrait: "--pal-portrait", night: "--pal-night" };

  // SAT-BEGIN  (everything between these two markers draws the satellite)
  // satelliteArt(design, change, size) -> an element showing the satellite built so far.
  //   change: optional { id: partId, kind: "add" | "remove" }, the click that just happened.
  //   size:   optional "small" (the Readiness review); the picture is the same, the frame is lighter.
  // The picture is a front view. The body sits in the middle and shows its slots (the dark bays).
  // Solar wings go at the sides, aerials and tall sensors on top, cameras and radar underneath,
  // thrusters at the bottom. A part the body has no room for is set down on the bench below it.
  // Every part has its own little drawing, chosen from its category, tags and fields (satKind).
  // The animation lives in CSS: this function only sets the classes (is-new, is-gone) when it draws.

  var SAT_W = 46, SAT_H = 35;   // the drawing grid: one unit is one art pixel (10 px on the Build bench)

  // Letters used in the pixel maps below. Two colours are lighter or fainter variants: [token, opacity].
  var SAT_COL = {
    w: PAL.ink, m: PAL.muted, d: "--pal-metal-dark", f: PAL.line, k: PAL.sky, p: PAL.portrait,
    g: PAL.gold, G: "--pal-gold-dark", r: PAL.red, b: PAL.blue, n: PAL.navy, c: "--pal-cell-light",
    i: "--pal-ion", o: "--pal-flame", I: ["--pal-ion", 0.55], J: ["--pal-ion", 0.3]
  };

  // Rows of letters -> [x, y, w, 1, colour, opacity?] rects. "." is empty.
  function satPix(rows) {
    var out = [];
    rows.forEach(function (row, y) {
      var x = 0;
      while (x < row.length) {
        var ch = row.charAt(x), c = SAT_COL[ch], x2 = x + 1;
        if (!c) { x++; continue; }
        while (x2 < row.length && row.charAt(x2) === ch) x2++;
        out.push(typeof c === "string" ? [x, y, x2 - x, 1, c] : [x, y, x2 - x, 1, c[0], c[1]]);
        x = x2;
      }
    });
    return out;
  }
  function satSpr(rows) {
    var w = 0;
    rows.forEach(function (r) { if (r.length > w) w = r.length; });
    return { w: w, h: rows.length, r: satPix(rows) };
  }
  function satShift(rects, dx, dy) {
    return rects.map(function (r) { var c = r.slice(); c[0] += dx; c[1] += dy; return c; });
  }
  function satMirror(rects) {   // flip across the middle of the whole drawing
    return rects.map(function (r) { var c = r.slice(); c[0] = SAT_W - r[0] - r[2]; return c; });
  }

  // ---- the art. zone says where it is mounted: bay (inside the body), top, nadir (underneath),
  // tail (the bottom), wing, cells (on the body skin), boom (long aerials from the corners).
  var SAT_KINDS = {
    // computers, batteries and attitude control: 6 x 5, they fill the bays
    clock:   { zone: "bay", rows: [".mmmm.", "mwwkwm", "mwwkkm", "mwwwwm", ".mmmm."] },
    tape:    { zone: "bay", rows: ["dddddd", "dwkdwk", "dwwdww", "dkkkkd", "mmmmmm"] },
    board:   { zone: "bay", rows: ["nnnnnn", "bkkkgb", "bkkkbb", "bgbbrb", "nnnnnn"] },
    shield:  { zone: "bay", rows: ["dddddd", "dgGGgd", "dGkkGd", "dgGGgd", "dddddd"] },
    stack:   { zone: "bay", rows: ["bbbbbb", "bkkbkk", "nnnnnn", "bkkkkb", "rgrgrg"] },
    batM:    { zone: "bay", rows: ["..gg..", "mmmmmm", "mwwwwm", "mwwwwm", "dddddd"] },
    batS:    { zone: "bay", rows: [".g..g.", "wwwwww", "nnnnnn", "wwwwww", "mmmmmm"] },
    batN:    { zone: "bay", rows: ["..gg..", "nnnnnn", "ncnncn", "nnnnnn", "dddddd"] },
    batL:    { zone: "bay", rows: ["r....r", "kkkkkk", "kGGGGk", "kkkkkk", "rrrrrr"] },
    wheels:  { zone: "bay", rows: [".mmm..", "mwkwm.", "mkwkmd", "mwkwm.", ".mmm.."] },
    spin:    { zone: "bay", rows: ["..gggg", ".g..gg", "g.ww.g", "g.ww..", ".ggg.g"] },
    generic: { zone: "bay", rows: ["mmmmmm", "mddddm", "mdmmdm", "mddddm", "mmmmmm"] },
    // aerials on top
    whip:    { zone: "top", rows: [".g.", ".m.", ".m.", ".m.", ".m.", ".m.", ".d.", "ddd"] },
    coil:    { zone: "top", rows: [".m.", "m..", ".m.", "..m", ".m.", "m..", ".d.", "ddd"] },
    dipole:  { zone: "top", rows: ["g.....g", ".m...m.", ".m...m.", "..m.m..", "..mdm..", "..ddd.."] },
    pcm:     { zone: "top", rows: ["g.....g", ".m...m.", "..m.m..", "...m...", ".ddddd.", ".kgkgk.", ".ddddd."] },
    patch:   { zone: "top", rows: ["mmmmmmm", "mgGgGgm", "mGgGgGm", "mgGgGgm", "mmmmmmm", "...d...", "..ddd.."] },
    dish:    { zone: "top", rows: ["...g...", "...m...", "...m...", "m.....m", "mm...mm", ".mmmmm.", "..ddd..", "...d..."] },
    // tall sensors on top
    geiger:  { zone: "top", rows: ["..g..", ".mwm.", ".mkm.", ".mwm.", ".mkm.", ".mwm.", ".ddd.", "ddddd"] },
    scint:   { zone: "top", rows: [".dkd.", ".dkd.", ".dkd.", ".ddd.", "wcccc", "ccccn", "nnnnn"] },
    sun:     { zone: "top", rows: ["G.g.G", ".ggg.", "ggwgg", ".ggg.", "G.g.G", "..d.."] },
    spectro: { zone: "top", rows: ["..g..", ".ggg.", "..g..", "ddddd", "rrgbb", "rrgbb", "ddddd"] },
    // cameras and radar underneath: 6 wide, or 14 wide for the radar
    optical: { zone: "nadir", rows: ["dmmmmd", ".dmmd.", ".dmmd.", ".dmmd.", ".GggG.", "..kk.."] },
    thermal: { zone: "nadir", rows: ["d.dd.d", "dmmmmd", "mrrrrm", "mroorm", "dmmmmd", ".d..d."] },
    camera:  { zone: "nadir", rows: ["mmmmmm", "mkkkkm", "mkggkm", "mkgwkm", "mkkkkm", "dmmmmd"] },
    avcs:    { zone: "nadir", rows: ["mmmmmm", "kggkgg", "kgwkgw", "kggkgg", "mmmmmm", ".dmmd."] },
    photo:   { zone: "nadir", rows: [".gg.gg", "gggggg", "mmmmmm", "dmmmmd"] },
    sar:     { zone: "nadir", rows: ["mmmmmmmmmmmmmm", "mgGgGgGgGgGgGm", "mkkkkkkkkkkkkm", "mgGgGgGgGgGgGm", "dddddddddddddd"] },
    // thrusters at the bottom
    thrustS: { zone: "tail", rows: [".bbb.", ".bcb.", "..d..", ".dmd.", "dmmmd"] },
    thrustL: { zone: "tail", rows: [".bbbbbbb.", "bcbbbbbcb", "..d...d..", ".dmd.dmd.", "dmmmdmmmd"] },
    ion:     { zone: "tail", rows: [".mmmmm.", "mmmmmmm", "iiiiiii", ".IIIII.", "..JJJ.."] },
    // made by code: solar wings (height), cells on the skin (style), long booms (reach, tee)
    wingS:   { zone: "wing", wing: 8 },
    wingL:   { zone: "wing", wing: 11 },
    cellsA:  { zone: "cells", style: 0 },
    cellsB:  { zone: "cells", style: 1 },
    boomA:   { zone: "boom", reach: 12, tee: false },
    boomB:   { zone: "boom", reach: 12, tee: true },
    // a spare body found in the design: kept on the bench
    spare:   { zone: "body", rows: ["mmmmmmmm", "mppkkppm", "mppkkppm", "mmmmmmmm"] }
  };

  // Which art a part gets. By id first; then by tags and fields, so a new part still draws.
  var SAT_ID = {
    "explorer-body": "cylinder", "drum-body": "drum", "smallsat-bus": "box", "nimbus-bus": "nimbus", "cubesat-12u": "cube",
    "spin-stabilised": "spin", "reaction-wheels": "wheels",
    "cosmic-ray-counter": "geiger", "scintillation-counter": "scint", "solar-xray-photometer": "sun", "oso-xray-spectrometer": "spectro",
    "cloud-photocell": "photo", "vidicon-camera": "camera", "avcs-camera": "avcs", "optical-camera": "optical",
    "thermal-imager": "thermal", "sar-radar": "sar", "topside-sounder": "boomA", "alouette-2-sounder": "boomB",
    "mercury-battery": "batM", "silver-zinc-battery": "batS", "nicad-battery": "batN", "battery-28v": "batL",
    "silicon-cells": "cellsA", "n-on-p-cells": "cellsB", "solar-small": "wingS", "solar-large": "wingL",
    "minitrack-beacon": "whip", "vhf-telemetry": "dipole", "pcm-telemetry": "pcm",
    "radio-uhf": "coil", "radio-sband": "patch", "radio-xband": "dish",
    "command-timer": "clock", "tape-recorder": "tape", "obc-basic": "board", "obc-radtol": "shield", "obc-payload": "stack",
    "prop-green-small": "thrustS", "prop-green-large": "thrustL", "prop-ion": "ion"
  };
  function satHas(p, tag) { return list(p.tags).indexOf(tag) !== -1; }
  function satKind(p) {
    if (SAT_ID[p.id]) return SAT_ID[p.id];
    var n = function (v) { return isNum(v) ? v : 0; };
    switch (p.category) {
      case "structure": return n(p.payload_kg) > 0 && n(p.payload_kg) < 30 ? "cube" : "box";
      case "attitude":  return satHas(p, "spin") ? "spin" : "wheels";
      case "instrument":
        if (satHas(p, "radiation")) return "geiger";
        if (satHas(p, "solar")) return "sun";
        if (satHas(p, "ionosphere")) return "boomA";
        if (satHas(p, "radar")) return "sar";
        if (satHas(p, "thermal")) return "thermal";
        return "camera";
      case "power":
        if (n(p.battery_wh) > 0) return n(p.battery_wh) < 110 ? "batM" : n(p.battery_wh) < 300 ? "batN" : n(p.battery_wh) < 800 ? "batL" : "batS";
        return n(p.panel_area_m2) && n(p.panel_area_m2) < 0.5 ? "cellsA" : n(p.panel_area_m2) < 0.9 ? "wingS" : "wingL";
      case "comms":
        return n(p.downlink_gb_day) < 0.05 ? "whip" : n(p.downlink_gb_day) < 5 ? "dipole" : n(p.downlink_gb_day) < 100 ? "patch" : "dish";
      case "computer":
        return n(p.storage_gb) >= 100 ? "stack" : n(p.storage_gb) >= 6 ? "shield" : n(p.storage_gb) >= 2 ? "board" : n(p.storage_gb) > 0 ? "tape" : "clock";
      case "propulsion":
        return n(p.isp_s) > 1000 ? "ion" : n(p.fuel_kg) > 3 ? "thrustL" : "thrustS";
      default: return "generic";
    }
  }

  // ---- code-made art: solar wings, cells on the skin, booms and the bodies
  function satWingRows(h, big) {   // a left-hand wing, 8 wide: frame, cells in pairs, dark seams
    var e = big ? "G" : "m", rows = [e + e + e + e + e + e + e + e];
    for (var y = 1; y < h - 1; y++) {
      var s = e;
      for (var x = 1; x <= 6; x++) {
        var seam = x === 3 || x === 6 || (y - 1) % 3 === 2;
        s += seam ? "n" : ((x - 1) % 3 === 0 && (y - 1) % 3 === 0 ? "c" : "b");
      }
      rows.push(s + e);
    }
    rows.push(rows[0]);
    return rows;
  }
  function satCellRows(w, h, style) {   // style 0: blue silicon; 1: dark radiation-hard with gold wiring
    var rows = [];
    for (var y = 0; y < h; y++) {
      var s = "";
      for (var x = 0; x < w; x++) {
        if (x % 3 === 2) s += style ? "g" : "n";
        else s += style ? (y ? "n" : "b") : (y ? "b" : "c");
      }
      rows.push(s);
    }
    return rows;
  }
  function satCellRects(zones, style) {
    var out = [];
    zones.forEach(function (z) { out = out.concat(satShift(satPix(satCellRows(z[2], z[3], style)), z[0], z[1])); });
    return out;
  }
  function satBoomRects(ax, ay, dy, reach, tee) {   // from the body corner at (ax, ay), leaning outwards
    var r = [], i, ex, ey;
    reach = Math.min(reach, ax + 1);
    for (i = 0; i < reach; i++) r.push([ax - i, ay + dy * Math.floor(i / 2), 1, 1, SAT_COL.m]);
    ex = ax - reach + 1; ey = ay + dy * Math.floor((reach - 1) / 2);
    r.push([ax - 1, dy < 0 ? ay - 1 : ay, 2, 2, SAT_COL.d]);                       // mount
    r.push([ex, ey - (dy < 0 ? 1 : 0), 2, 2, SAT_COL.g]);                            // bead at the tip
    if (tee) r.push([ex + 3, ey - 1, 1, 3, SAT_COL.g], [ex + 6, ey - 1, 1, 3, SAT_COL.g]);   // cross bars
    return r;
  }

  // A body: rows of letters, with extras. The frame has two-row bands top and bottom (the cells go
  // there), side posts, and a dark interior with room for the bays.
  function satFrameRows(w, h, band, side, rivet) {
    var rows = [], y, x, s, inner = "";
    for (x = 0; x < w - 2 * side.length; x++) inner += "p";
    for (y = 0; y < h; y++) {
      s = "";
      if (y < 2 || y >= h - 2) {
        for (x = 0; x < w; x++) s += rivet && x % 4 === 2 && (y === 0 || y === h - 1) ? rivet : band;
      } else s = side + inner + side.split("").reverse().join("");
      rows.push(s);
    }
    return rows;
  }
  function satCut(rows, n) {   // knock n pixels off each corner: a rounded drum
    return rows.map(function (r, y) {
      var c = y < n ? n - y : y >= rows.length - n ? y - (rows.length - n - 1) : 0, a = r.split("");
      for (var i = 0; i < c; i++) { a[i] = "."; a[a.length - 1 - i] = "."; }
      return a.join("");
    });
  }
  var SAT_COLLAR = ["GmmmmmmmmmmmmmmmmmmmmmmmmmmG", "gmkmmkmmkmmkmmkmmkmmkmmkmmg", "GGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
  var SAT_BAYS_3x2 = [[13, 10], [20, 10], [27, 10], [13, 16], [20, 16], [27, 16]];
  // Each body: where it is (x, y, w, h) and its pixels (rows, extra), then where things mount:
  // bays (6 x 5 slots inside), top (aerials and tall sensors rest on y), nadir (a row, or slots,
  // hanging from y), tailY (where the thrusters hang when nothing is under the body), wing (inner edge,
  // middle height and the room up and down), cells (skin bands), booms (corner anchors), pods
  // (spare outside spots for bay items), solid (extra boxes nothing may touch).
  var SAT_BODIES = {
    box: {
      x: 12, y: 8, w: 22, h: 15, rows: satFrameRows(22, 15, "m", "G", "d"), extra: [],
      bays: SAT_BAYS_3x2, top: { x0: 8, x1: 38, y: 8 }, nadir: { x0: 9, x1: 37, y: 23 }, tailY: 23,
      wing: { inner: 8, ym: 15.5, y0: 0, y1: SAT_H }, cells: [[12, 8, 22, 2], [12, 21, 22, 2]],
      booms: [[11, 8, -1], [11, 22, 1]]
    },
    drum: {
      x: 10, y: 8, w: 26, h: 15, rows: satCut(satFrameRows(26, 15, "m", "md", "d"), 2), extra: [],
      bays: SAT_BAYS_3x2, top: { x0: 8, x1: 38, y: 8 }, nadir: { x0: 9, x1: 37, y: 23 }, tailY: 23,
      wing: { inner: 10, ym: 15.5, y0: 0, y1: SAT_H }, cells: [[12, 8, 22, 2], [12, 21, 22, 2]],
      booms: [[9, 8, -1], [9, 22, 1]]
    },
    nimbus: {
      x: 12, y: 8, w: 22, h: 15, rows: satFrameRows(22, 15, "d", "m", "m"), extra: satShift(satPix(SAT_COLLAR), 9, 21),
      bays: SAT_BAYS_3x2, top: { x0: 8, x1: 38, y: 8 }, nadir: { x0: 9, x1: 37, y: 24 }, tailY: 24,
      wing: { inner: 8, ym: 15.5, y0: 0, y1: SAT_H }, cells: [[12, 8, 22, 2], [12, 21, 22, 2]],
      booms: [[11, 8, -1], [8, 24, 1]], solid: [[9, 21, 28, 3]]
    },
    cube: {
      x: 16, y: 8, w: 14, h: 16, rows: satFrameRows(14, 16, "m", "g", "d"), extra: [],
      bays: [[17, 10], [23, 10], [17, 16], [23, 16]], top: { x0: 10, x1: 36, y: 8 }, nadir: { x0: 14, x1: 32, y: 24 }, tailY: 24,
      wing: { inner: 16, ym: 16, y0: 0, y1: SAT_H }, cells: [[16, 8, 14, 2], [16, 22, 14, 2]],
      booms: [[15, 8, -1], [15, 23, 1]]
    },
    cylinder: {
      x: 18, y: 8, w: 10, h: 22, rows: ["...wwww...", "..wwwwww..", ".wwwwwwww."].concat(satFrameRows(10, 19, "w", "d", "m")), extra: [],
      bays: [[20, 13], [20, 18], [20, 23]], pods: [[11, 22], [29, 22]],
      top: { x0: 10, x1: 36, y: 8 }, nadir: { slots: [[11, 28], [29, 28]] }, tailY: 30,
      wing: { inner: 18, ym: 15, y0: 0, y1: SAT_H }, cells: [[18, 11, 10, 2], [18, 28, 10, 2]],
      booms: [[17, 10, -1], [17, 29, 1]]
    }
  };

  // ---- laying the parts out
  function satHit(boxes, taken) {   // do any of these [x, y, w, h] boxes overlap a taken one?
    for (var i = 0; i < boxes.length; i++) {
      var a = boxes[i];
      for (var j = 0; j < taken.length; j++) {
        var b = taken[j];
        if (a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]) return true;
      }
    }
    return false;
  }
  function satBoxes(rects) { return rects.map(function (r) { return [r[0], r[1], r[2], r[3]]; }); }

  // One thing to draw: a part, with its art and (once placed) its rects and boxes.
  function satItem(p) {
    var kind = satKind(p), k = SAT_KINDS[kind] || SAT_KINDS.spare;
    var it = { part: p, kind: kind, k: k, zone: k.zone, rects: [], boxes: [], placed: false };
    if (k.rows) { it.spr = k.spr || (k.spr = satSpr(k.rows)); it.shelf = it.spr; }
    else if (k.wing) { it.spr = k.spr || (k.spr = satSpr(satWingRows(k.wing, k.wing > 10))); it.shelf = it.spr; }
    else if (k.zone === "cells") it.shelf = k.spr || (k.spr = satSpr(satCellRows(8, 2, k.style)));
    else if (k.zone === "boom") it.shelf = k.spr || (k.spr = satSpr(k.tee ? [".....g..g", "mmmmmmmgg", ".....g..g"] : ["mmmmmmmgg"]));
    return it;
  }

  // Places every item on the body (spec), or sets it aside on the bench. Wings and rows are checked
  // against everything already placed, so nothing overlaps.
  function satLayout(spec, items) {
    var taken = [[spec.x, spec.y, spec.w, spec.h]].concat(spec.solid || []), shelf = [];
    var rowOf = { top: [], nadir: [], tail: [], cells: [] };
    var st = { bay: 0, wings: 0, wTop: 0, wBottom: 0, booms: [], nadirBottom: spec.tailY };

    function done(it, rects, boxes, claim) {
      it.rects = rects; it.boxes = boxes; it.placed = true;
      if (claim) taken = taken.concat(boxes);
      return true;
    }
    // A row of things (top, nadir or tail): side by side with a one-pixel gap, centred as a group.
    // Items past the end of the room, or touching something already placed, go to the bench.
    function packRow(list, zone, yOf) {
      var x, kept = list.slice();
      function width() { return kept.reduce(function (a, it) { return a + it.spr.w; }, 0) + Math.max(0, kept.length - 1); }
      while (kept.length && width() > zone.x1 - zone.x0) shelf.push(kept.pop());
      x = Math.round((zone.x0 + zone.x1 - width()) / 2);
      kept.forEach(function (it) {
        var box = [x, yOf(it), it.spr.w, it.spr.h];
        x += it.spr.w + 1;
        if (satHit([box], taken)) shelf.push(it);
        else done(it, satShift(it.spr.r, box[0], box[1]), [box], true);
      });
    }
    function putSlot(it, slots) {
      for (var i = 0; i < slots.length; i++) {
        var box = [slots[i][0], slots[i][1], it.spr.w, it.spr.h];
        if (!satHit([box], taken)) return done(it, satShift(it.spr.r, box[0], box[1]), [box], true);
      }
      return false;
    }
    function place(it) {
      var box, i, y, tries, h, x;
      switch (it.zone) {
        case "bay":
          if (st.bay < spec.bays.length) {
            box = spec.bays[st.bay++];
            return done(it, satShift(it.spr.r, box[0] + Math.floor((6 - it.spr.w) / 2), box[1] + Math.floor((5 - it.spr.h) / 2)), [[box[0], box[1], 6, 5]], false);
          }
          return spec.pods ? putSlot(it, spec.pods) : false;   // a slim body mounts its spare boxes on the outside
        case "top": rowOf.top.push(it); return true;
        case "nadir":
          if (spec.nadir.slots) return putSlot(it, spec.nadir.slots);
          rowOf.nadir.push(it);
          return true;
        case "wing":
          h = it.k.wing; x = spec.wing.inner - 8;
          if (!st.wings) tries = [Math.round(spec.wing.ym - h / 2)];
          else if (st.wings % 2) tries = [st.wBottom + 1, st.wTop - 1 - h];
          else tries = [st.wTop - 1 - h, st.wBottom + 1];
          for (i = 0; i < tries.length; i++) {
            y = tries[i];
            if (y < spec.wing.y0 || y + h > spec.wing.y1) continue;
            var left = satShift(it.spr.r, x, y), strut = spec.x - (x + 8);
            var boxes = [[x, y, 8, h], [SAT_W - x - 8, y, 8, h]];
            if (strut > 0) boxes.push([x + 8, y + Math.floor(h / 2), strut, 2], [spec.x + spec.w, y + Math.floor(h / 2), strut, 2]);
            if (satHit(boxes, taken)) continue;
            if (strut > 0) left.push([x + 8, y + Math.floor(h / 2), strut, 2, SAT_COL.d]);
            st.wTop = st.wings ? Math.min(st.wTop, y) : y;
            st.wBottom = st.wings ? Math.max(st.wBottom, y + h) : y + h;
            st.wings++;
            return done(it, left.concat(satMirror(left)), boxes, true);
          }
          return false;
        case "boom":
          for (i = 0; i < spec.booms.length; i++) {
            if (st.booms[i]) continue;
            var b = spec.booms[i], r = satBoomRects(b[0], b[1], b[2], it.k.reach, it.k.tee);
            r = r.concat(satMirror(r));
            if (satHit(satBoxes(r), taken)) continue;
            st.booms[i] = true;
            return done(it, r, satBoxes(r), true);
          }
          return false;
        case "cells": rowOf.cells.push(it); return true;   // sorted out below, once we know how many
        default: return false;
      }
    }
    // Wings first, biggest in the middle. The tail goes last: it hangs below whatever the nadir row holds.
    var wings = items.filter(function (it) { return it.zone === "wing"; }).sort(function (a, b) { return b.k.wing - a.k.wing; });
    var rest = items.filter(function (it) { return it.zone !== "wing" && it.zone !== "tail"; });
    var tails = items.filter(function (it) { return it.zone === "tail"; });
    wings.concat(rest).forEach(function (it) { if (!place(it)) shelf.push(it); });
    // Cells on the skin: one part covers both bands, two parts share them, a third has no skin left.
    rowOf.cells.forEach(function (it, i) {
      if (i > 1) { shelf.push(it); return; }
      var zones = rowOf.cells.length > 1 ? [spec.cells[i]] : spec.cells;
      done(it, satCellRects(zones, it.k.style), [[zones[0][0], zones[0][1], zones[0][2], zones[0][3]]], false);
    });
    packRow(rowOf.top, spec.top, function (it) { return spec.top.y - it.spr.h; });
    if (spec.nadir.x0 !== undefined) {
      packRow(rowOf.nadir, spec.nadir, function () { return spec.nadir.y; });
      rowOf.nadir.forEach(function (it) { if (it.placed) st.nadirBottom = Math.max(st.nadirBottom, spec.nadir.y + it.spr.h); });
    }
    packRow(tails, { x0: 9, x1: 37 }, function () { return st.nadirBottom; });
    return shelf;
  }

  // Items that found no place are set out in rows on the bench under the satellite.
  function satBench(shelf) {
    var x = 1, y = SAT_H + 2, rowH = 0, planks = [];
    shelf.forEach(function (it) {
      if (x + it.shelf.w > SAT_W - 1 && x > 1) { planks.push(y + rowH); x = 1; y += rowH + 3; rowH = 0; }
      it.rects = satShift(it.shelf.r, x, y); it.boxes = [[x, y, it.shelf.w, it.shelf.h]]; it.placed = true;
      x += it.shelf.w + 2; rowH = Math.max(rowH, it.shelf.h);
    });
    planks.push(y + rowH);
    return { height: y + rowH + 2, planks: planks };
  }

  function satOutline(spec) {   // faint dashes where a body will go
    var r = [], x, y, d = SAT_COL.d, e = spec.x + spec.w, b = spec.y + spec.h;
    for (x = spec.x; x < e; x += 3) r.push([x, spec.y, Math.min(2, e - x), 1, d, 0.6], [x, b - 1, Math.min(2, e - x), 1, d, 0.6]);
    for (y = spec.y + 2; y < b - 1; y += 3) r.push([spec.x, y, 1, Math.min(2, b - 1 - y), d, 0.6], [e - 1, y, 1, Math.min(2, b - 1 - y), d, 0.6]);
    return r;
  }
  function satBodyRects(spec) {
    var r = satShift(satPix(spec.rows), spec.x, spec.y).concat(spec.extra);
    spec.bays.forEach(function (b) { r.push([b[0], b[1], 6, 5, SAT_COL.k]); });   // the empty slots
    return r;
  }

  function satLabel(chosen) {
    if (!chosen.length) return "Pixel drawing of your satellite: nothing on board yet, only a dashed outline.";
    var cats = typeof getCategories === "function" ? list(getCategories()) : [];
    var known = {}, bits = cats.map(function (c) {
      known[c.id] = true;
      var names = chosen.filter(function (p) { return p.category === c.id; }).map(function (p) { return p.name; });
      return names.length ? c.name.toLowerCase() + ": " + names.join(", ") : "";
    });
    var other = chosen.filter(function (p) { return !known[p.category]; }).map(function (p) { return p.name; });
    if (other.length) bits.push("other: " + other.join(", "));
    return "Pixel drawing of your satellite. On board, " + bits.filter(Boolean).join("; ") + ".";
  }

  // The low-poly satellite (LowPoly.scenes.satellite, js/lp-satellite.js) in one canvas, drawn once it is on
  // the page. On the bench it turns slowly (not under reduced motion) and can be dragged round; the next
  // click keeps the angle. "small" is a still pose. null when the 3D art is missing or fails, and
  // satelliteArt then draws the pixel satellite below.
  var satView = null, satLast = null;   // the bench view (for its angle) and the parts it showed last
  function lpSatellite(design, change, size) {
    try {
      if (typeof LowPoly !== "object" || !LowPoly || !LowPoly.scenes || typeof LowPoly.scenes.satellite !== "function" ||
          typeof LowPoly.view !== "function") return null;
      var small = size === "small", ids = list(design && design.parts).slice(), parts = data("PARTS");
      var wrap = LowPoly.scenes.satellite({ parts: ids, data: parts, change: small ? null : change, size: small ? "small" : "bench",
        spin: small ? 0 : 8, yaw: !small && satView ? satView.yaw : undefined, before: satLast });
      if (!wrap || !wrap.scene) return null;
      var canvas = document.createElement("canvas");
      canvas.width = 0; canvas.height = 0;   // nothing is drawn until the canvas is on the page
      canvas.className = "sat lp-sat";
      var view = LowPoly.view(canvas, wrap, { drag: !small, keys: false, fps: 30 });
      if (!small) { satView = view; satLast = ids; }
      // The "+ NAME" tag rises from where the new part settles. It is decoration: the canvas label names every part.
      var tag = null, added = !small && change && change.kind === "add" ? byId(parts, change.id) : null;
      var at = added && wrap.anchor ? wrap.anchor(added.id) : null;
      if (at && isNum(at[0]) && isNum(at[1])) {
        tag = el("div", { class: "sat-tag", "aria-hidden": "true",
          style: "top:" + Math.min(95, Math.max(4, at[1] * 100)).toFixed(1) + "%;--x:" + Math.min(100, Math.max(0, at[0] * 100)).toFixed(1) + "%" },
          [el("span", { text: "+ " + String(added.name).replace(/\s*\(.*?\)/g, "").toUpperCase() })]);
      }
      return el("div", { class: "sat-bench lp-bench" + (small ? " sat-small" : "") }, [canvas, tag]);
    } catch (e) { return null; }
  }

  function satelliteArt(design, change, size) {
    var lp = lpSatellite(design, change, size);
    if (lp) return lp;
    var ids = list(design && design.parts), parts = data("PARTS");
    var chosen = ids.map(function (id) { return byId(parts, id); }).filter(Boolean);
    var added = change && change.kind === "add" ? change.id : null;
    var gone = change && change.kind === "remove" && ids.indexOf(change.id) === -1 ? byId(parts, change.id) : null;
    var bodyPart = null, ghostBody = null, items = [];
    chosen.forEach(function (p) {
      if (p.category === "structure" && !bodyPart) bodyPart = p;
      else items.push(satItem(p));
    });
    if (gone && gone.category === "structure" && !bodyPart) ghostBody = gone;
    var shownBody = bodyPart || ghostBody;
    var spec = SAT_BODIES[bodyPart ? satKind(bodyPart) : "box"] || SAT_BODIES.box;
    var shelf = satLayout(spec, items), bench = shelf.length ? satBench(shelf) : null;
    var height = bench ? bench.height : SAT_H;

    // The ghost of a removed part is laid out as the design was just before the click (with the part
    // last). It never moves anything real, and if it would have sat on the bench it is not drawn.
    var ghost = null;
    if (gone && !ghostBody) {
      var before = [];
      chosen.forEach(function (p) { if (p !== bodyPart) before.push(satItem(p)); });
      ghost = satItem(gone);
      satLayout(spec, before.concat(ghost));
      if (!ghost.placed) ghost = null;
    }

    // Draw order: body, then parts, then the bench. Each part is its own group so CSS can animate it.
    var groups = [];
    if (!bodyPart) groups.push({ cls: "sat-outline", rects: satOutline(ghostBody ? SAT_BODIES[satKind(ghostBody)] || spec : spec) });
    if (shownBody) {
      var bspec = SAT_BODIES[satKind(shownBody)] || SAT_BODIES.box;
      groups.push({ cls: "sat-p sat-body" + (added === shownBody.id ? " is-new" : "") + (ghostBody ? " is-gone" : ""), id: shownBody.id, rects: satBodyRects(bspec) });
    }
    if (ghost) groups.push({ cls: "sat-p is-gone", id: ghost.part.id, rects: ghost.rects });
    items.forEach(function (it) {
      groups.push({ cls: "sat-p" + (it.part.id === added ? " is-new" : ""), id: it.part.id, rects: it.rects });
    });
    if (bench) {
      var planks = bench.planks.map(function (y) { return [0, y, SAT_W, 1, SAT_COL.f]; });
      groups.unshift({ cls: "sat-plank", rects: planks });
    }

    var svg = art("0 0 " + SAT_W + " " + height, [], satLabel(chosen), "sat");
    groups.forEach(function (g, index) {
      var node = document.createElementNS("http://www.w3.org/2000/svg", "g"), tmp = art("0 0 1 1", g.rects, null);
      node.setAttribute("class", g.cls);
      if (g.id) node.setAttribute("data-part", g.id);
      if (size === "small" && g.id) node.style.setProperty("--assembly-delay", Math.min(index * 70, 700) + "ms");
      while (tmp.firstChild) node.appendChild(tmp.firstChild);
      svg.appendChild(node);
    });

    // The "+ NAME" tag rises from where the new part landed. It is decoration: the label says it all.
    var tag = null;
    if (added) {
      var newPart = byId(parts, added), top = null, left = 0, right = SAT_W;
      if (shownBody && shownBody.id === added) { var bs = SAT_BODIES[satKind(shownBody)]; top = bs.y; left = bs.x; right = bs.x + bs.w; }
      items.forEach(function (it) {
        if (it.part.id !== added || !it.boxes.length) return;
        top = Math.min.apply(null, it.boxes.map(function (b) { return b[1]; }));
        left = Math.min.apply(null, it.boxes.map(function (b) { return b[0]; }));
        right = Math.max.apply(null, it.boxes.map(function (b) { return b[0] + b[2]; }));
      });
      if (newPart && top !== null) {
        // The tag sits just above the part and slides along with its position, so it stays in the picture.
        var mid = Math.max(0, Math.min(100, (left + right) / 2 / SAT_W * 100));
        tag = el("div", { class: "sat-tag", "aria-hidden": "true", style: "top:" + Math.min(95, Math.max(top, 4) / height * 100).toFixed(1) + "%;--x:" + mid.toFixed(1) + "%" },
          [el("span", { text: "+ " + String(newPart.name).replace(/\s*\(.*?\)/g, "").toUpperCase() })]);
      }
    }
    return el("div", { class: "sat-bench" + (size === "small" ? " sat-small" : "") }, [svg, tag]);
  }
  // SAT-END

  // A speaker's low-poly bust (LowPoly.scenes.portrait, js/lp-people.js) as an <img class="portrait">, or null.
  // Each face is drawn once, into a canvas off the page at 280 px (sharp at the largest 140 px size), and kept
  // as a picture: the screens are rebuilt on every click and must not draw the faces again each time.
  var FACES = {};
  function lpFace(who) {
    try {
      if (typeof LowPoly !== "object" || !LowPoly || typeof LowPoly.has !== "function" || !LowPoly.has("person", who) ||
          !LowPoly.scenes || typeof LowPoly.scenes.portrait !== "function" || typeof LowPoly.render !== "function") return null;
      var fk = who + "|" + (document.documentElement.dataset.era || "");   // each era's palette draws its own picture
      if (!FACES[fk]) {
        var ps = LowPoly.scenes.portrait({ who: who, aspect: 1 });
        var c = document.createElement("canvas");
        c.width = 280; c.height = 280;
        if (!LowPoly.render(c, ps.scene)) return null;
        FACES[fk] = { src: c.toDataURL("image/png"), alt: ps.label || "Portrait" };
      }
      return el("img", { class: "portrait lp-face", src: FACES[fk].src, alt: FACES[fk].alt, width: 140, height: 140 });
    } catch (e) { return null; }
  }
  // The face for a story speaker: the low-poly bust, else the pixel portrait (speakerArt, in the STORY block),
  // else null (the caller then shows the director).
  var FACE_OF = { rival: "director", mum: "partner" };   // speakers drawn with another speaker's bust
  function speakerFace(who) {
    who = FACE_OF[who] || who;
    return lpFace(who) || (typeof speakerArt === "function" ? speakerArt(who) : null);
  }

  // Mission control, who briefs the player.
  function directorArt() {
    var face = lpFace("director");
    if (face) return face;
    return art("0 0 16 16", [
      [0, 0, 16, 16, PAL.portrait],
      [5, 2, 6, 3, PAL.hair], [4, 3, 1, 4, PAL.hair], [11, 3, 1, 4, PAL.hair],
      [5, 5, 6, 6, PAL.skin], [6, 7, 1, 1, PAL.sky], [9, 7, 1, 1, PAL.sky], [7, 9, 2, 1, PAL.mouth],
      [3, 5, 1, 3, PAL.line], [3, 4, 2, 1, PAL.line], [12, 5, 1, 3, PAL.line], [11, 4, 2, 1, PAL.line],
      [12, 8, 1, 2, PAL.line], [10, 10, 3, 1, PAL.cyan],
      [3, 12, 10, 4, PAL.navy], [6, 12, 4, 4, PAL.ink], [7, 12, 2, 2, PAL.cyan]
    ], "Portrait of the mission director wearing a headset", "portrait");
  }

  // One low-poly scene in a canvas that is drawn once it is on the page (never before, so no wasted frame) and
  // stops by itself when its screen is replaced. Not draggable, no tab stop. {canvas, view, wrap} or null.
  function lpCanvas(make, className) {
    try {
      if (typeof LowPoly !== "object" || !LowPoly || typeof LowPoly.view !== "function" || !LowPoly.scenes) return null;
      var wrap = make(LowPoly);
      if (!wrap || !wrap.scene) return null;
      var canvas = document.createElement("canvas");
      canvas.width = 0; canvas.height = 0;
      canvas.className = "lp " + (className || "");
      return { canvas: canvas, view: LowPoly.view(canvas, wrap, { drag: false, keys: false, fps: 30 }), wrap: wrap };
    } catch (e) { return null; }
  }
  function chosenLauncher() {
    var d = state.design;
    return d && d.launcher ? byId(data("LAUNCHERS"), d.launcher) : null;
  }
  // The design's rocket on the low-poly pad at dusk (LowPoly.scenes.pad, js/lp-pad.js). With no rocket chosen yet,
  // or without the 3D art, the pixel pad below shows a generic one.
  function lpPad(ready) {
    var row = chosenLauncher();
    var lp = row ? lpCanvas(function (L) {
      return typeof L.scenes.pad === "function" ? L.scenes.pad({ launcherId: row.id, launcher: row, ready: !!ready }) : null;
    }, "scene lp-pad") : null;
    return lp ? lp.canvas : null;
  }

  // Rocket on the pad at night.
  function padArt(ready) {
    var lp = lpPad(ready);
    if (lp) return lp;
    var r = [
      [0, 0, 187, 152, PAL.night],
      [14, 12, 1, 1, PAL.ink], [52, 30, 1, 1, PAL.muted], [70, 10, 2, 2, PAL.ink], [110, 22, 1, 1, PAL.ink],
      [146, 40, 1, 1, PAL.muted], [170, 14, 2, 2, PAL.gold], [160, 74, 1, 1, PAL.ink], [30, 66, 1, 1, PAL.ink],
      [22, 20, 14, 14, PAL.ink], [26, 24, 3, 3, PAL.muted], [31, 29, 2, 2, PAL.muted],
      [0, 136, 187, 16, PAL.line], [0, 136, 187, 1, PAL.line], [60, 132, 76, 4, PAL.line],
      [124, 60, 4, 72, PAL.line], [114, 78, 10, 2, PAL.line], [114, 104, 10, 2, PAL.line],
      [125, 56, 2, 2, ready ? PAL.cyan : PAL.red]
    ];
    var rocket = [
      [5, 0, 2, 2, PAL.red], [4, 2, 4, 2, PAL.ink], [3, 4, 6, 16, PAL.ink], [8, 4, 1, 16, PAL.muted],
      [5, 7, 2, 2, PAL.cyan], [3, 12, 6, 1, PAL.red], [1, 17, 2, 5, PAL.red], [9, 17, 2, 5, PAL.red], [4, 20, 4, 2, PAL.line]
    ];
    rocket.forEach(function (q) { r.push([78 + q[0] * 3, 66 + q[1] * 3, q[2] * 3, q[3] * 3, q[4]]); });
    r.push([66, 126, 8, 6, PAL.muted, 0.5], [118, 124, 10, 8, PAL.muted, 0.5]);
    return art("0 0 187 152", r, ready ? "A rocket on the pad, tower light green" : "A rocket on the pad, tower light red", "scene");
  }

  // Small 8x8 icons for the parts bins.
  var BIN_ICONS = {
    instrument: [[0, 2, 8, 5, PAL.ink], [2, 1, 2, 1, PAL.ink], [3, 3, 3, 3, PAL.sky], [4, 4, 1, 1, PAL.cyan]],
    power:      [[0, 1, 8, 6, PAL.blue], [2, 1, 1, 6, PAL.sky], [5, 1, 1, 6, PAL.sky], [0, 4, 8, 1, PAL.sky]],
    comms:      [[3, 4, 2, 4, PAL.muted], [3, 2, 2, 2, PAL.gold], [0, 1, 1, 3, PAL.cyan], [7, 1, 1, 3, PAL.cyan], [1, 0, 1, 1, PAL.cyan], [6, 0, 1, 1, PAL.cyan]],
    computer:   [[1, 1, 6, 6, PAL.sky], [2, 2, 4, 4, PAL.ink], [3, 3, 2, 2, PAL.sky], [0, 2, 1, 1, PAL.muted], [7, 5, 1, 1, PAL.muted]],
    propulsion: [[3, 0, 2, 5, PAL.ink], [2, 4, 1, 2, PAL.red], [5, 4, 1, 2, PAL.red], [3, 6, 2, 2, PAL.gold]],
    structure:  [[1, 1, 6, 6, PAL.muted], [2, 2, 4, 4, PAL.sky], [1, 1, 6, 1, PAL.ink], [1, 6, 6, 1, PAL.line]],
    attitude:   [[3, 3, 2, 2, PAL.ink], [1, 1, 2, 1, PAL.cyan], [1, 1, 1, 2, PAL.cyan], [5, 6, 2, 1, PAL.cyan], [6, 5, 1, 2, PAL.cyan],
                 [5, 1, 1, 1, PAL.gold], [2, 6, 1, 1, PAL.gold]],
    fallback:   [[2, 2, 4, 4, PAL.muted]]
  };

  // ---------------------------------------------------------------- shell: header, objective line, minimap, hints
  function tier() { return state.design ? byId(data("TIERS"), state.design.tier) : null; }
  // How much the screens help before a problem happens (SPEC.md, "Difficulty: how much help"), from the level's
  // existing `hints` value: "on" is full help, "request" some, "off" minimal. Facts (blockers, part numbers, what
  // limited the flight) show on every level; what goes away is the game working out the answer for the player.
  function assist(design) {
    var t = byId(data("TIERS"), (design || state.design || {}).tier);
    return t && t.hints === "off" ? "minimal" : t && t.hints === "request" ? "some" : "full";
  }
  // What the header calls this mission: "PART 1 · STEP 2" for a walkthrough step, else the tier's name.
  function modeName() {
    if (isComebackDesign(state.design)) return "PART 2 · " + comebackLevel(state.design.tier);
    var step = walkStepOf(state.design);
    if (step) return "PART 1 · STEP " + step;
    var t = tier();
    return t ? t.name.toUpperCase() : "";
  }

  // LIVE DATA or SNAPSHOT: which data the game is using. The status comes from getLiveData();
  // js/live-data.js announces a finished fetch with a "livedata" event on window.
  function setDataBadge() {
    var node = document.getElementById("data-badge");
    if (!node) return;
    var live = typeof getLiveData === "function" ? getLiveData() : null;
    if (!live) { node.hidden = true; return; }
    var status = live.status || "snapshot";
    node.hidden = false;
    node.className = "data-badge " + (["live", "partial", "snapshot", "loading"].indexOf(status) !== -1 ? status : "snapshot");
    node.textContent = status === "live" ? "LIVE DATA" : status === "partial" ? "PARTLY LIVE" : status === "loading" ? "CHECKING DATA" : "SNAPSHOT";
    var sources = list(live.sources).map(function (s) { return s.name + ": " + (s.ok ? "live" : "snapshot"); }).join(". ");
    var title = status === "loading" ? "Checking for live NASA and NOAA data. The saved data is used until it answers."
      : status === "snapshot" || !sources ? "Using the saved NASA data. Live open data was not reachable."
      : sources + (live.fetched_at ? ". Fetched " + live.fetched_at.slice(0, 16).replace("T", " ") + " UTC." : "");
    node.title = title;
    node.setAttribute("aria-label", node.textContent + ". " + title);
    node.tabIndex = 0;
  }

  function setStatus(text) {
    var node = document.getElementById("status");
    if (node) node.textContent = text;
  }

  function designStatus() {
    var t = tier();
    if (!t) return "Space Mission Design Game";
    if (isComebackDesign(state.design)) return comebackStatus();
    var totals = getTotals(state.design);
    if (inCampaign()) {
      var info = hubInfo();
      return "CAMPAIGN" + (info ? " · " + info.year : "") + " · SPENT " + money(totals.cost_musd) + " OF " + money(totals.budget_musd) +
        (info && isNum(info.science_pts) ? " · SCIENCE " + num(info.science_pts, 1) : "");
    }
    return modeName() + (state.design.year ? " · " + state.design.year : "") + " · SPENT " + money(totals.cost_musd) + " OF " + money(totals.budget_musd);
  }

  // The header shows the current objective and a minimap (instead of a step bar).
  function setStep(screen) {
    var line = document.getElementById("objective");
    var mini = document.getElementById("minimap");
    var text = "";
    if (screen === "mission") text = "Keep the satellite alive.";
    else if (screen === "debrief") text = "Fix what limited you, then fly again.";
    else if (state.design && screen !== "title" && screen !== "hub" && screen !== "intro") {
      var next = waypoint();
      text = next === screen ? doText(screen) : GO_TEXT[next];
    }
    if (line) {
      while (line.firstChild) line.removeChild(line.firstChild);
      if (text) { line.appendChild(el("span", { class: "objective-key", text: "OBJECTIVE " })); line.appendChild(document.createTextNode(text)); }
      line.hidden = !text;
    }
    if (mini) {
      while (mini.firstChild) mini.removeChild(mini.firstChild);
      var show = !!state.design && DESIGN_STEPS.indexOf(screen) !== -1 && !state.locked;
      mini.hidden = !show;
      if (show) {
        mini.appendChild(mapSvg(true, screen));
        mini.appendChild(el("span", { class: "minimap-key" }, [icon(screen), "MAP [M]"]));
      }
    }
  }

  function setHint(screen) {
    var box = document.getElementById("hint");
    var btn = document.getElementById("help-btn");
    if (!box || !btn) return;
    var mode = tier() ? tier().hints : "on";
    var text = HINTS[screen] || "";
    var tutorial = "";
    // Story's hints come from getHints (data/hints.js): the tutorial line, then the first tip.
    var key = HINT_KEYS[screen];
    if (key && typeof getHints === "function" && (state.design || key === "hub")) {
      var h = getHints(key, state.design);
      mode = h.mode || mode;
      tutorial = h.tutorial || "";
      var lines = [h.tutorial].concat(list(h.tips).slice(0, 1)).filter(Boolean);
      if (lines.length) text = lines.join(" ");
    }
    // Hints "on": just the one tutorial line, only the first time this screen is visited in a page load.
    // The "?" button brings the full hint back. "request": the "?" button only. "off": nothing.
    var first = !state.seenHint[screen];
    btn.hidden = !(text && mode !== "off" && (mode === "request" || !first));
    btn.setAttribute("aria-expanded", state.hintOpen ? "true" : "false");
    var show = !!text && mode !== "off" && (state.hintOpen || (mode === "on" && first));
    box.hidden = !show;
    box.textContent = state.hintOpen ? text : (tutorial || firstSentence(text));
  }

  // body.is-home while the home page is up: it hides the header and the pixel ground strip, and lets the title fill the screen.
  function markHome(screen) { if (document.body) document.body.classList.toggle("is-home", screen === "title"); }

  // The era look (css/style.css, body[data-era]): "1958" in Part 1 (a walkthrough step, or any design set in the igy era),
  // "today" in Part 2 and everywhere else, "home" on the title screen. Set on <body> and on <html>: the low-poly art
  // reads its --lp-* colours from the page, and a picture drawn before it is on the page reads them from <html>.
  // The story beats ("intro") keep the era they were opened with (markEra(name) forces one: the epilogue is 1958).
  function eraOfDesign(d) { return d && (walkStepOf(d) > 0 || d.era === "igy") ? "1958" : "today"; }
  function markEra(screen, forced) {
    var era = forced || (screen === "title" ? "home" : screen === "intro" ? null : eraOfDesign(state.design));
    if (!era || !document.body) return;
    if (document.body.dataset.era !== era) document.body.dataset.era = era;
    if (document.documentElement.dataset.era !== era) document.documentElement.dataset.era = era;
  }

  function mount(screen, node, sayKey) {
    state.screen = screen;
    markHome(screen);
    markEra(screen);
    var app = document.getElementById("app");
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(node);
    setStep(screen);
    setHint(screen);
    if (window.GravMotion) GravMotion.mounted(app, screen, sayKey);   // entry animations only when the screen changes
  }

  // Redraws the current screen and keeps keyboard focus on the same control.
  function redraw() {
    var active = document.activeElement;
    var key = active && active.getAttribute ? active.getAttribute("data-key") : null;
    draw(state.screen);
    if (key) {
      var again = document.querySelector('[data-key="' + key + '"]');
      if (again) again.focus();
    }
  }

  function go(screen, bin) {
    if (screen === "build" && state.design && (state.screen !== "build" || state.binFor !== state.design || bin)) {
      state.bin = entryBin(state.design, bin);
      state.binFor = state.design;
    }
    var i = DESIGN_STEPS.indexOf(screen);
    if (i > state.reached) state.reached = i;
    bumpReached();                         // a preset place counts as visited once the one before it is
    if (i !== -1) state.player = screen;   // you are standing in that building
    stopWalking();
    state.swappedAt = Date.now();
    state.hover = null;
    state.hintOpen = false;
    state.seenHint[state.screen] = true;   // the screen being left: its one-line hint has been shown
    draw(screen);
    var app = document.getElementById("app");
    if (app) app.focus();
    window.scrollTo(0, 0);
    // On short landscape screens, bring the map itself into view.
    var board = document.getElementById("map");
    if (screen === "map" && board && window.innerHeight <= 500) board.scrollIntoView({ block: "start" });
  }

  function draw(screen) {
    markEra(screen === "title" || !state.design ? "title" : screen);   // before the screen's pictures are drawn
    if (screen === "title" || !state.design) return mount("title", drawTitle());
    state.screen = screen;   // set first: the check list reads it while drawing
    setStatus(designStatus());
    if (screen === "map") { mount(screen, drawMap()); return updateMap(true); }
    if (screen === "briefing") return mount(screen, drawBriefing());
    if (screen === "orbit") return mount(screen, drawOrbit());
    if (screen === "build") return mount(screen, drawBuild());
    if (screen === "launcher") return mount(screen, drawLauncher());
    if (screen === "review") return mount(screen, drawReview());
    return mount("title", drawTitle());
  }

  // A screen title only. What used to be a sentence under it is the story line (sayLine) and the hint.
  function head(title) {
    return el("div", { class: "screen-head" }, [el("h1", null, [icon(({"1":"briefing", "2":"orbit", "3":"build", "4":"launcher", "5":"review"})[title.charAt(0)] || "map"), title])]);
  }

  // ---- the story: one short spoken line per screen (STORY block above; "" shows nothing)
  function sayLine(key, extra) {
    return sayElement(typeof storyLine === "function" ? storyLine(key, state.design, extra) : "");
  }
  function sayElement(line) {
    if (!line) return null;
    var who = typeof line === "object" ? line.who : "team", text = typeof line === "object" ? line.text : String(line);
    if (!text) return null;
    var name = typeof line === "object" && line.name ? line.name
      : typeof STORY === "object" && STORY.speakers && STORY.speakers[who] ? STORY.speakers[who] : "";
    var face = speakerFace(who);
    return el("div", { class: "say", role: "note" }, [
      face || directorArt(),
      el("div", { class: "say-text" }, [name ? el("span", { class: "say-name", text: String(name).toUpperCase() }) : null,
        el("p", { text: text })])
    ]);
  }

  // Every place has a way out to the map. CONTINUE walks you to the next place.
  function navRow(nextTo, nextOk) {
    // The button follows the gold route, forwards or back (after a redesign, a FIX link or a new NO GO).
    var gps = waypoint();
    if (nextTo && gps !== state.screen) nextTo = gps;
    var next = byId(PLACES, nextTo);
    return el("div", { class: "nav-row" }, [
      button(["< ", "MAP [M]"], openMap, { aria: "MAP [M]: back to the base map" }),
      next ? button(["GO TO " + next.name, " >"], function () { travel(nextTo); },
        { primary: true, disabled: !nextOk, aria: "Go to " + next.name.toLowerCase() }) : null
    ]);
  }

  // ---------------------------------------------------------------- the four resource bars
  function barClass(m) { return !isNum(m) ? "" : m < 0 ? " bad" : m < 0.1 ? " warn" : ""; }

  function bar(name, right, fill, cls, note, iconName) {
    var pct = isNum(fill) ? Math.max(0, Math.min(1, fill)) * 100 : 0;
    return el("div", { class: "bar" + (cls || "") }, [
      el("div", { class: "bar-top" }, [el("span", { class: "bar-name" }, [iconName ? icon(iconName) : null, name]), el("span", { text: right })]),
      el("div", { class: "bar-track", role: "presentation" }, [el("div", { class: "bar-fill", style: "width: " + pct + "%" })]),
      note ? el("div", { class: "bar-note", text: note }) : null
    ]);
  }

  function resourceBars(design) {
    var t = getTotals(design);
    var m = t.margins || {};
    var massRight = t.capacity_kg ? num(t.mass_kg) + " / " + num(t.capacity_kg, 0) + " KG" : num(t.mass_kg) + " KG";
    var dataLost = t.data_gb_day > t.data_returned_gb_day;
    var du = dataUnit(Math.max(t.data_gb_day || 0, t.data_returned_gb_day || 0));
    // No limit yet: no rocket, no orbit, or a rocket that cannot reach this orbit (its capacity there is 0).
    var rocket = design.launcher ? byId(data("LAUNCHERS"), design.launcher) : null;
    var massNote = t.capacity_kg ? null : !rocket ? "Pick a rocket to see the limit"
      : !design.orbit ? "Pick an orbit to see the limit" : rocket.name + " cannot reach this orbit";
    // Batteries and no panel: a warning, not a fault (runChecks warns "battery-only"). The bar says how long they last.
    var batteryOnly = !(t.power_gen_w > 0) && t.battery_wh > 0 && t.power_draw_w > 0;
    var power = isNum(m.power) ? { fill: 1 - m.power, cls: barClass(m.power), note: null }
      : batteryOnly ? { fill: 1, cls: " warn", note: batteryNote(design) }
      : { fill: t.power_draw_w > 0 ? 1 : 0, cls: t.power_draw_w > 0 ? " bad" : "", note: "Nothing makes power yet" };
    return el("div", { class: "bars" }, [
      bar("MASS", massRight, isNum(m.mass) ? 1 - m.mass : null, barClass(m.mass), massNote, "mass"),
      bar("POWER", fine(t.power_draw_w) + " / " + fine(t.power_gen_w) + " W", power.fill, power.cls, power.note, "power"),
      bar("BUDGET", money(t.cost_musd) + " / " + money(t.budget_musd), isNum(m.budget) ? 1 - m.budget : null, barClass(m.budget), null, "budget"),
      // For data a full bar is good: it is the share of data that reaches the ground.
      bar("DATA HOME", fine(t.data_returned_gb_day * du[1]) + " / " + fine(t.data_gb_day * du[1]) + " " + du[0].toUpperCase() + "/DAY",
          t.data_gb_day > 0 ? t.data_returned_gb_day / t.data_gb_day : 0,
          dataLost ? (t.data_returned_gb_day > 0 ? " warn" : " bad") : "",
          !design.orbit ? "Pick an orbit to see ground contact" : null, "data")
    ]);
  }

  // "Battery only: runs out in about 2.2 months", from previewScience (its months stop when the battery is spent).
  function batteryNote(design) {
    var s = typeof previewScience === "function" ? previewScience(design) : null;
    var orbit = byId(data("ORBITS"), design.orbit);
    if (!s || !orbit || !isNum(s.months) || !(s.months < orbit.lifetime_months)) return "Battery only";
    return "Battery only: runs out in about " + fine(s.months) + " months";
  }

  // A short label for each readiness check; the back end's full sentence stays one tap away ("Why").
  var CHECK_LABELS = {
    "no-objective": "NO JOB CHOSEN", "no-orbit": "NO ORBIT", "no-launcher": "NO ROCKET",
    "launcher-reach": "ROCKET CANNOT REACH", "launcher-locked": "ROCKET LOCKED", "objective-locked": "TOPIC LOCKED", "part-locked": "PART LOCKED",
    "mass": "TOO HEAVY", "budget": "OVER BUDGET", "power": "NOT ENOUGH POWER", "delta-v": "NOT ENOUGH THRUST",
    "body-count": "ONE BODY ONLY", "body-payload": "BODY OVERLOADED", "body-slots": "BODY FULL", "too-late": "TOO LATE",
    "data": "DATA LOST", "battery": "NO SHADOW POWER", "battery-only": "BATTERY ONLY", "no-match": "WRONG INSTRUMENT",
    "orbit-fit": "ORBIT CANNOT SEE IT", "mass-margin": "THIN MASS MARGIN", "power-margin": "THIN POWER MARGIN"
  };
  function checkLabel(c) {
    var id = String(c.id || "");
    if (CHECK_LABELS[id]) return CHECK_LABELS[id];
    if (id.indexOf("empty-") === 0) {
      var cat = byId(categories(), id.slice(6));
      return "NO " + (cat ? cat.name : id.slice(6).toUpperCase());
    }
    if (id.indexOf("resolution-") === 0) return "TOO BLURRY";
    if (id.indexOf("smear-") === 0) return "PICTURES SMEAR";
    return c.text;   // an id this list does not know: the back end's own words
  }

  // The bin a FIX line opens on Build: the empty one for "NO POWER" and the like, else none (Build picks).
  function fixBin(c) {
    var id = String(c && c.id || "");
    return id.indexOf("empty-") === 0 && byId(categories(), id.slice(6)) ? id.slice(6) : null;
  }

  function checkList(design, opts) {
    opts = opts || {};
    var checks = runChecks(design);
    var rows = [];
    checks.blockers.forEach(function (c) {
      if (opts.skip && opts.skip.indexOf(c.id) !== -1) return;
      rows.push({ c: c, kind: "bad", status: "NO GO" });
    });
    checks.warnings.forEach(function (c) { rows.push({ c: c, kind: "warn", status: "WARN" }); });
    if (!rows.length) return opts.short ? el("p", { class: "preview-line fix", text: "No problems right now." }) : null;
    return el("ul", { class: "checks" }, rows.map(function (row) {
      var target = fixPlace(row.c, design);
      var label = checkLabel(row.c);
      return el("li", { class: "check " + row.kind }, [
        el("span", { class: "check-text" }, [icon(row.kind === "bad" ? "blocker" : "warning"), el("strong", { text: label }),
          label !== row.c.text ? el("details", { class: "more why" }, [el("summary", { text: "Why" }), el("span", { text: row.c.text })]) : null]),
        opts.fix && target !== state.screen
          ? el("button", { type: "button", class: "fix", onclick: function () { go(target, fixBin(row.c)); },
              "aria-label": "Fix on the " + target + " screen: " + row.c.text }, "FIX >")
          : el("span", { class: "status", text: row.status })
      ]);
    }));
  }

  // ---------------------------------------------------------------- the home page (two game modes)
  // What a design may use in its era: { parts, launchers, objectives }, each id -> { available, year, reason }.
  // One call per screen refresh. Without eras everything is available.
  function availability(d) {
    var a = typeof getAvailability === "function" && d ? getAvailability(d) : null;
    return a || { parts: {}, launchers: {}, objectives: {} };
  }
  function lockReason(map, id) {
    var x = map ? map[id] : null;
    return x && x.available === false ? (x.reason || "Not available yet") : null;
  }

  // ---- campaign: the same screens between visits to the Campaign hub (js/ui-campaign.js)
  function inCampaign() { return !!(state.design && state.design.campaign); }
  function hubInfo() { return typeof getHubInfo === "function" ? getHubInfo() : null; }

  // "Expected payout $X M, cost $Y M, net $Z M": all three numbers from previewPayout().
  function payoutLine(d) {
    if (isComebackDesign(d)) return comebackPayLine(d);
    if (!d || !d.campaign || typeof previewPayout !== "function") return null;
    var p = previewPayout(d);
    if (!p) return null;
    var line = el("p", { class: "nasa-line payout-line", text: "Expected payout " + money(p.expected_payout_musd) +
      ", cost " + money(p.cost_musd) + ", net " + (p.net_musd < 0 ? "-" : "") + money(Math.abs(p.net_musd)) +
      (p.topic_complete && !(p.new_data > 0) ? ". Nothing new is left to collect here: no reward." : "") });
    var offers = list(p.offers).map(function (o) {
      return el("p", { class: "nasa-line payout-line", text: "Offer: " + o.text + (o.met ? " This design meets it." : " This design falls short of it (" + num(o.min_science, 0) + " points of new data).") });
    });
    return offers.length ? el("div", null, [line].concat(offers)) : line;
  }

  // COMEBACK-BEGIN  ---- Part 2, Ajay's comeback, on the shared screens. A comeback design flies one contract: its topic
  // (and its orbit, when the client names one) is set by the contract; the cash is the budget; the deadline counts.
  // js/ui-comeback.js draws the workshop, the contract cards and the ending; js/ui-mission.js the debrief's money.
  // Every number here comes from getComeback(), previewPayout(), getTotals() or runChecks(), or from LAUNCHERS.
  function isComebackDesign(d) { return !!(d && d.comeback); }
  function comebackInfo() {
    try { return typeof getComeback === "function" ? getComeback() : null; } catch (e) { return null; }
  }
  // The open contract a design flies for (from getComeback().contracts), kept per design object: ids repeat between comebacks.
  var contractMemo = { design: null, k: null };
  function contractOf(d) {
    if (!d || !d.contract) return null;
    if (contractMemo.design !== d) {
      var info = comebackInfo();
      contractMemo = { design: d, k: info ? byId(list(info.contracts), d.contract) : null };
    }
    return contractMemo.k;
  }
  // The header in Part 2: the month against the deadline, the cash and the debt.
  function comebackStatus(info) {
    info = info || comebackInfo();
    if (!info) return "PART 2";
    return "PART 2 · MONTH " + num(info.month, 0) + "/" + num(info.deadline_month, 0) + " · CASH " + money(info.cash_musd) +
      " · DEBT " + money(info.debt_musd);
  }
  function comebackLevel(tierId) {
    var levels = STORY.modes.part2.levels || {};
    return levels[tierId] || "";
  }
  // Set by the contract: the topic always, the orbit when the client names one. The rocket never is.
  function comebackPreset(screen, d) {
    if (screen === "briefing") return !!d.objective;
    if (screen === "orbit") { var k = contractOf(d); return !!(k && k.orbit); }
    return false;
  }
  // The cheapest rocket on offer that lifts this design to its orbit (a plain data choice, like the FITS tag), or null.
  function cheapestRocketFor(d, massKg) {
    if (!d || !d.orbit) return null;
    var avail = availability(d), best = null;
    data("LAUNCHERS").forEach(function (l) {
      var cap = l.capacity_kg ? l.capacity_kg[d.orbit] : null;
      if (lockReason(avail.launchers, l.id) || !isNum(cap) || !(cap > 0) || cap < massKg) return;
      if (!best || l.cost_musd < best.cost_musd) best = l;
    });
    return best;
  }
  // PROFIT, one line: "PROFIT +$6.8M" in the good colour, "PROFIT -$1.2M" in the bad one. The number is the back end's
  // (previewProfit before the flight, flightProfit after it). Null when there is no number yet.
  function profitLine(v, key) {
    if (!isNum(v)) return null;
    var text = (v < 0 ? "-" : "+") + money(Math.abs(v));
    return el("p", { class: "profit " + (v > 0 ? "pos" : v < 0 ? "neg" : "zero"), "data-key": key || "profit-line", "data-musd": String(v) }, [
      el("span", { class: "profit-label", text: "PROFIT" }), " ", el("strong", { class: "profit-amount", text: text })]);
  }
  // Build and Rocket Yard: "PROFIT +$6.8M", then "Pays $X · costs $Y with the cheapest rocket · 3 stars +$B". Before a rocket is
  // chosen, the cost counts the cheapest rocket that lifts it, so the line never shows a profit the launch would eat.
  // Every number is previewProfit()'s (pay, cost, profit) or the contract's own price and bonus.
  function comebackPayLine(d) {
    var p = typeof previewPayout === "function" ? previewPayout(d) : null;
    var k = p && p.contract;
    if (!p || !k) return null;
    var f = typeof previewProfit === "function" ? previewProfit(d) : null;
    if (p.topic_complete && !(p.new_data > 0)) {
      return el("div", { class: "payout", "data-key": "contract-pay" }, [assist(d) === "minimal" ? null : profitLine(f && f.profit_musd),
        el("p", { class: "nasa-line payout-line", text: "Nothing new is left to collect on this topic: the client pays nothing." })]);
    }
    var terms = assist(d) === "minimal";   // Hard: the contract's terms, not a forecast of what this design will earn (no PROFIT line either)
    var cost = f && isNum(f.cost_musd) ? f.cost_musd : null, estimate = !!(f && f.launch_estimated);
    var bits = [terms ? "Pays up to " + money(k.price_musd) + " for " + num(k.min_science, 0) + " points"
        : "Pays " + money(p.expected_payout_musd) + (k.met ? "" : " of " + money(k.price_musd) + " (needs " + num(k.min_science, 0) + " points)"),
      cost !== null ? "costs " + money(cost) + (estimate ? " with the cheapest rocket" : "") : "costs " + money(p.cost_musd) + " + a rocket",
      "3 stars +" + money(k.bonus_musd)];
    return el("div", { class: "payout", "data-key": "contract-pay" }, [terms ? null : profitLine(f && f.profit_musd),
      el("p", { class: "nasa-line payout-line" }, bits.join(" · "))]);
  }
  // Briefing: the contract card (js/ui-comeback.js) and the topic it sets. The topic cannot change here.
  function comebackBriefing(d) {
    var k = contractOf(d), o = byId(data("OBJECTIVES"), d.objective);
    var C = window.StarlineComeback;
    return el("section", { class: "screen" }, [
      head("1 · BRIEFING"),
      sayLine("briefing"),
      presetNote("briefing"),
      k && C ? C.contractCard(k, { brief: true, counts: o ? wantsLine(o) : "" }) : el("p", { class: "part-note", text: "That contract is no longer open." }),
      o ? more(o.briefing, "About this job") : null,
      navRow("orbit", !!d.objective)
    ]);
  }
  // Readiness review: a flight that lands on or after the deadline loses the comeback even if it is paid.
  function comebackDeadline(d, checks) {
    if (!isComebackDesign(d)) return null;
    var w = list(checks.warnings).filter(function (c) { return c.id === "deadline"; })[0];
    return w ? el("div", { class: "deadline-banner", role: "alert", "data-key": "deadline-banner" }, [
      el("strong", null, [icon("warning"), "TOO LATE: IT LANDS AFTER THE DEADLINE"]), el("p", { text: w.text })]) : null;
  }
  function comebackTimeRow(d) {
    var info = comebackInfo();
    if (!info || typeof flightMonths !== "function") return null;
    return ["Time", num(flightMonths(d), 0) + " months (" + num(info.months_left, 0) + " left)"];
  }
  CHECK_LABELS.deadline = "LANDS TOO LATE";
  CHECK_LABELS["no-contract"] = "NO CONTRACT";
  CHECK_LABELS["contract-topic"] = "WRONG TOPIC FOR THE CONTRACT";
  CHECK_LABELS["contract-orbit"] = "WRONG ORBIT FOR THE CONTRACT";
  CHECK_LABELS["comeback-over"] = "THE COMEBACK IS OVER";
  CHECK_LABELS["no-comeback"] = "NO COMEBACK RUNNING";
  FIX_SCREEN["contract-topic"] = "briefing";
  FIX_SCREEN["contract-orbit"] = "orbit";
  // COMEBACK-END

  // ---- Part 1, the walkthrough. The record holds only which steps passed and their best stars (from the debrief).
  function walkConfig(step) { return WALK_STEPS[step - 1] || null; }
  function walkStepOf(design) { return state.walk && design && state.walk.design === design ? state.walk.step : 0; }
  function walkClean(rec) {
    var out = { done: {} };
    var done = rec && typeof rec === "object" && rec.done && typeof rec.done === "object" ? rec.done : {};
    WALK_STEPS.forEach(function (w) {
      var v = done[String(w.step)];
      if (isNum(v) && v >= WALK_PASS_STARS && v <= 3) out.done[String(w.step)] = Math.round(v);
    });
    return out;
  }
  function walkRecord() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(WALK_KEY) : null;
      if (raw) return walkClean(JSON.parse(raw));
    } catch (e) { /* storage blocked or garbage: fall back to memory */ }
    return walkClean(state.walkMemory);
  }
  function walkSave(rec) {
    state.walkMemory = walkClean(rec);
    try { if (window.localStorage) window.localStorage.setItem(WALK_KEY, JSON.stringify(state.walkMemory)); } catch (e) { /* memory copy still works */ }
  }
  function walkForget() {
    state.walkMemory = null;
    try { if (window.localStorage) window.localStorage.removeItem(WALK_KEY); } catch (e) { /* nothing saved */ }
  }
  function walkStars(step) { var v = walkRecord().done[String(step)]; return isNum(v) ? v : null; }
  // The first step not passed yet, or 0 when all three have passed.
  function walkNext() {
    for (var i = 0; i < WALK_STEPS.length; i++) if (walkStars(WALK_STEPS[i].step) === null) return WALK_STEPS[i].step;
    return 0;
  }
  // Called once by the debrief: keeps the best stars of a step that passed. Returns what the debrief shows.
  function walkResult(design, stars) {
    var step = walkStepOf(design);
    if (!step) return null;
    var passed = isNum(stars) && stars >= WALK_PASS_STARS;
    if (passed) {
      var rec = walkRecord();
      rec.done[String(step)] = Math.max(rec.done[String(step)] || 0, stars);
      walkSave(rec);
    }
    var best = walkStars(step);
    // kept: this flight fell short, but the step passed before (a passed step stays passed).
    return { step: step, passed: passed, kept: !passed && best !== null, best_stars: best, last: step === WALK_STEPS.length };
  }

  // A preset choice: set by the step, so its place counts as visited and its cards are read-only.
  function isPreset(screen) {
    if (isComebackDesign(state.design)) return comebackPreset(screen, state.design);
    if (state.design && state.design.duel) return screen === "briefing" || screen === "orbit";   // ONLINE-DUEL: the seed sets the topic and the orbit
    var cfg = walkStepOf(state.design) ? walkConfig(state.walk.step) : null;
    return !!(cfg && PRESET_FIELD[screen] && cfg[PRESET_FIELD[screen]]);
  }
  // A preset place counts as visited as soon as the place before it has been: no place stays locked behind a choice
  // the step already made (the Launch Pad opens once the Workshop has been visited when the rocket is preset).
  function bumpReached() {
    while (state.reached + 1 < DESIGN_STEPS.length && isPreset(DESIGN_STEPS[state.reached + 1])) state.reached++;
  }

  function startWalkStep(step) {
    var cfg = walkConfig(step);
    if (!cfg || typeof newDesign !== "function") return showDesignScreen("title");
    var d = newDesign(cfg.tier);
    if (cfg.era && typeof setEra === "function") setEra(d, cfg.era);
    if (cfg.objective) setObjective(d, cfg.objective);
    if (cfg.orbit) setOrbit(d, cfg.orbit);
    if (cfg.launcher) setLauncher(d, cfg.launcher);
    stopWalking();
    state.walk = { step: step, design: d };
    state.design = d;
    state.locked = false;
    state.reached = 0;
    state.player = "gate";
    state.bin = null;
    bumpReached();
    var beats = (step === 1 ? list(storyLine("intro", d)) : []).concat(list(storyLine("step-open", d, step)));
    var name = walkName(step);
    showBeats(beats, STORY.modes.part1.kicker + " · STEP " + step + (name ? " · " + name : ""), function () { go("map"); });
  }
  function walkName(step) {
    var s = STORY.austin && STORY.austin.steps ? STORY.austin.steps[String(step)] : null;
    return s && s.name ? s.name : "";
  }

  // After step 3: the epilogue, then Part 2 (window.showComebackStart, defined by the Part 2 screens) or home.
  function showEpilogue() {
    var toPart2 = function () {
      if (typeof window.showComebackStart === "function") window.showComebackStart();
      else showDesignScreen("title");
    };
    state.walk = null;
    state.design = null;
    state.locked = false;
    var box = window.StarlineStory && typeof window.StarlineStory.showBox === "function";   // js/ui-story.js: THE BOX ending first
    showBeats(list(storyLine("epilogue", null)), STORY.modes.part1.kicker + " · " + STORY.modes.part1.name,
      box ? function () { window.StarlineStory.showBox(toPart2); } : toPart2,
      { doneLabel: box ? "OPEN THE BOX" : "CONTINUE TO PART 2", skipToEnd: true, home: true, era: "1958" });
  }

  // A few short story beats, one at a time (NEXT, or SKIP), then onDone. An empty list goes straight to onDone.
  // opts: doneLabel (the last button, default START), skipToEnd (SKIP shows the last beat instead of leaving),
  // home (a HOME button beside the last one).
  function showBeats(beats, kicker, onDone, opts) {
    opts = opts || {};
    beats = list(beats).filter(function (b) { return b && b.text; });
    if (!beats.length) return onDone();
    setStatus(modeName() || "Space Mission Design Game");   // not the last mission's score
    var at = 0;
    markEra("intro", opts.era || eraOfDesign(state.design));   // Part 1 step beats: the step's design; Ajay's: no design, today
    function draw1() {
      var last = at >= beats.length - 1;
      mount("intro", el("section", { class: "screen intro" }, [
        el("div", { class: "kicker", text: String(kicker || "").toUpperCase() }),
        el("div", { class: "intro-beats", "aria-live": "polite" }, [sayElement(beats[at])]),
        el("p", { class: "bar-note", text: (at + 1) + " / " + beats.length }),
        el("div", { class: "nav-row" }, [
          last ? (opts.home ? button("HOME", function () { showDesignScreen("title"); }) : null)
            : button("SKIP", function () { if (opts.skipToEnd) { at = beats.length - 1; draw1(); } else onDone(); }, { aria: "Skip the story" }),
          button([last ? (opts.doneLabel || "START") : "NEXT", " >"], function () { if (last) onDone(); else { at++; draw1(); } }, { primary: true })
        ])
      ]), "intro:" + at);
      // Open at the top (the title page may have been scrolled), then focus NEXT without scrolling back down.
      window.scrollTo(0, 0);
      var next = document.querySelector(".intro .btn.primary");
      if (next) next.focus({ preventScroll: true });
    }
    draw1();
  }

  // ---- the home page: the title and two mode cards. Every star comes from the walkthrough record.
  function comebackSaved() {
    try {
      if (typeof getComeback !== "function") return false;
      var c = getComeback();
      return !!c && !c.finished;
    } catch (e) { return false; }
  }

  // A menu entry: the whole panel is its button (the button's hit area covers the panel), so the label, the name and
  // the state read as one choice. lead: the entry to play next, drawn solid.
  function modeEntry(key, M, lead, extra, go) {
    // A click anywhere on the panel presses its button (the stretched hit area of the CSS is not trusted in every
    // browser), except on another button in it (JOURNAL). The button stays the one real control for keyboard and
    // screen readers; a disabled one ("COMING NEXT") does nothing.
    var card = el("div", { class: "mode-card" + (lead ? " lead" : "") + (go && go.disabled ? " off" : ""), "data-key": key, onclick: function (e) {
      var t = e.target;
      if (t && t.closest && t.closest("button, a, .mode-go .btn")) return;
      if (go && !go.disabled) go.click();
    } }, [
      el("div", { class: "mode-top" }, [el("span", { class: "kicker", text: M.kicker }), extra.tag || null]),
      el("h2", { text: M.name }),
      window.StarlineStory ? window.StarlineStory.counter() : null,
      el("div", { class: "mode-foot" }, [extra.state || el("span"),
        // JOURNAL (js/ui-story.js): only when this part has something in it, and absent when that file is.
        window.StarlineStory && window.StarlineStory.journalButton ? window.StarlineStory.journalButton({ part: key === "mode-part1" ? 1 : 2,
          ifAny: true, back: function () { showDesignScreen("title"); }, key: "journal-" + key }) : null,
        el("div", { class: "mode-go" }, [go])])
    ]);
    return card;
  }

  function part1Card(lead) {
    var M = STORY.modes.part1;
    var next = walkNext();
    var started = WALK_STEPS.some(function (w) { return walkStars(w.step) !== null; });
    var label = !next ? "PLAY AGAIN" : started ? "CONTINUE: STEP " + next : "START";
    // The three steps as their stars, numbered; the step's name is for screen readers and the tooltip.
    var steps = el("ol", { class: "mode-steps" }, WALK_STEPS.map(function (w) {
      var stars = walkStars(w.step);
      return el("li", { class: stars === null ? "" : "passed", "data-key": "walk-step-" + w.step, title: walkName(w.step) }, [
        el("span", { class: "mode-step-num", text: String(w.step) }),
        el("span", { class: "mode-step-name sr-only", text: walkName(w.step) }),
        el("span", { class: "stars", text: starsText(stars || 0), "aria-label": stars === null ? "not passed yet" : stars + " of 3 stars" })
      ]);
    }));
    return modeEntry("mode-part1", M, lead, { tag: next ? el("span", { class: "tag warn", text: M.tag }) : null, state: steps },
      button([label, " >"], function () { startWalkStep(next || 1); },
        { primary: true, key: "part1-go", aria: label + ", " + M.kicker + ", " + M.name }));
  }

  function part2Card(lead) {
    var M = STORY.modes.part2;
    var ready = typeof window.showComebackStart === "function";
    var label = !ready ? "COMING NEXT" : comebackSaved() ? "CONTINUE" : "START";
    return modeEntry("mode-part2", M, lead && ready, {},
      button(ready ? [label, " >"] : label, function () { if (typeof window.showComebackStart === "function") window.showComebackStart(); },
        { primary: ready, disabled: !ready, key: "part2-go", aria: label + ", " + M.kicker + ", " + M.name }));
  }

  // The home page, a console title screen: the low-poly scene fills the first screen, the drawn title and one line over
  // its sky, then the two modes as a menu. The entry to play next is solid: Part 1 until its three steps pass, then Part 2.
  function drawTitle() {
    setStatus("Space Mission Design Game");
    state.locked = false;
    state.walk = null;
    var hero = titleHero();
    var part1Next = !!walkNext();
    return el("section", { class: "title" + (hero ? " has-art" : "") }, [
      hero || titleSky(),
      el("div", { class: "title-main" }, [
        logotype(String(STORY.title || "GRAVITRON").toUpperCase()),
        el("p", { class: "tagline", text: "Design a satellite. Launch it. Learn why." }),
        el("nav", { class: "modes", "aria-label": "Game modes" }, [part1Card(part1Next), part2Card(!part1Next)]),
        window.StarlineOnline ? window.StarlineOnline.homeRow() : null   // ONLINE (js/ui-online.js): LEADERBOARD and DUEL, quiet
      ]),
      el("div", { class: "title-foot" }, [button("RESET EVERYTHING", function () {
        if (!window.confirm("Erase everything? Your stars, your Part 1 steps and any comeback in progress will be gone.")) return;
        // Everything the game saves: the stars, the Part 1 record and the comeback (a saved campaign).
        if (typeof resetProgress === "function") resetProgress();
        if (typeof resetCampaign === "function") resetCampaign();
        walkForget();
        if (window.StarlineStory) window.StarlineStory.forget();   // the endings found and the interludes seen
        draw("title");
      }, { quiet: true, key: "reset-progress" })])
    ]);
  }

  // A step that presets this screen's choice: the chosen card becomes a plain card (nothing to click) and the
  // others are greyed out, under one line saying so.
  function presetView(card, chosen) {
    if (chosen) {
      var div = el("div", { class: card.className + " static chosen", "data-key": card.getAttribute("data-key") });
      while (card.firstChild) div.appendChild(card.firstChild);
      return div;
    }
    card.disabled = true;
    card.className += " locked";
    card.removeAttribute("aria-pressed");
    return card;
  }
  function presetNote(screen) {
    return isPreset(screen) ? el("p", { class: "preset-note", text: isComebackDesign(state.design) ? "Set by the contract." : state.design && state.design.duel ? "Set for the duel." : "Set for this step." }) : null;
  }

  // ---------------------------------------------------------------- 1 Briefing
  // What counts for a job: the instrument types, the first in full and the rest at half ("radar · imaging ½").
  function wantsLine(objective) {
    return list(objective.wants).map(function (tag, i) { return tag + (i === 0 ? "" : " ½"); }).join(" · ");
  }

  function drawBriefing() {
    var d = state.design;
    if (isComebackDesign(d)) return comebackBriefing(d);
    var objectives = data("OBJECTIVES");
    var chosen = byId(objectives, d.objective);
    var avail = availability(d);
    var info = inCampaign() ? hubInfo() : null;
    if (info) objectives = objectives.filter(function (o) { return !lockReason(avail.objectives, o.id); });
    var cards = objectives.map(function (o) {
      var locked = lockReason(avail.objectives, o.id);
      var topic = info ? byId(list(info.topics), o.id) : null;
      if (locked) {
        return el("button", { type: "button", class: "card locked", disabled: true, "data-key": "obj-" + o.id }, [
          el("div", { class: "card-title" }, [el("h3", { text: o.name.toUpperCase() }), el("span", { class: "tag bad", text: locked.toUpperCase() })])
        ]);
      }
      var card = el("button", {
        type: "button", class: "card", "aria-pressed": d.objective === o.id ? "true" : "false", "data-key": "obj-" + o.id,
        onclick: function () { setObjective(d, o.id); redraw(); }
      }, [
        el("div", { class: "card-title" }, [el("h3", { text: o.name.toUpperCase() }),
          d.objective === o.id ? el("span", { class: "tag on", text: "CHOSEN" }) : null]),
        facts([["Target", num(o.science_target, 0) + " pts"], ["Counts", wantsLine(o)],
          topic ? ["Pays", money(topic.next_payout_estimate_musd)] : null])
      ]);
      if (isPreset("briefing")) card = presetView(card, d.objective === o.id);
      // The rest of the briefing sits beside the card, not inside it (a button cannot hold a button).
      return el("div", { class: "card-wrap" }, [card, more(o.briefing, "About this job")]);
    });
    // The "½" in a Counts row, said once under the cards (SPEC: the first type counts fully, the others half).
    var half = objectives.some(function (o) { return !lockReason(avail.objectives, o.id) && list(o.wants).length > 1; });
    return el("section", { class: "screen" }, [
      head("1 · BRIEFING"),
      sayLine("briefing"),
      presetNote("briefing"),
      objectives.length ? el("div", { class: "grid" }, cards) : el("p", { class: "empty", text: "No objectives in the data yet." }),
      half ? el("p", { class: "preset-note", text: "½: counts half." }) : null,
      navRow("orbit", !!d.objective)
    ]);
  }

  // ---------------------------------------------------------------- 2 Orbit
  // "In view: 69% of the world's fire detections (NASA FIRMS 2025)": the share comes from getOrbitFacts.
  // (The badge above it is how well the orbit suits the job, which is a different thing.)
  function inViewText(objectiveId, share) {
    var e = typeof EARTH !== "undefined" && EARTH ? EARTH[objectiveId] : null;
    var KINDS = { "wildfire": ["of the world's fire detections", "NASA FIRMS"],
                  "sea-ice": ["of the Arctic sea ice", "NSIDC Sea Ice Index"],
                  "ionosphere": ["of Alouette's soundings", "Canadian Space Agency"] };
    var kind = KINDS[objectiveId] || ["of the target", "NASA data"];
    var src = e && e.source ? " (" + kind[1] + (e.year ? " " + e.year : "") + ")" : "";
    return "In view: " + Math.round(share * 100) + "% " + kind[0] + src;
  }
  // An orbit the chosen rocket cannot reach, or one no rocket on offer can reach (1958): said on the card before the
  // click. A plain data field (the rocket's capacity_kg for that orbit), as on the Launch vehicle screen.
  function reachNote(d, o) {
    var rocket = d.launcher ? byId(data("LAUNCHERS"), d.launcher) : null;
    var cap = rocket && rocket.capacity_kg ? rocket.capacity_kg[o.id] : null;
    if (rocket && !(isNum(cap) && cap > 0)) return el("p", { class: "part-note", text: rocket.name + " cannot reach it" });
    if (!rocket && !anyRocketReaches(d, o.id)) return el("p", { class: "part-note", text: "No rocket yet can reach it" });
    return null;
  }
  function drawOrbit() {
    var d = state.design;
    var objective = byId(data("OBJECTIVES"), d.objective);
    var cards = data("ORBITS").map(function (o) {
      var probe = newDesign(d.tier);
      setObjective(probe, d.objective);
      setOrbit(probe, o.id);
      var f = getOrbitFacts(probe);
      var fit = objective && objective.orbit_fit ? objective.orbit_fit[o.id] : undefined;
      // How well this orbit suits the job (objective.orbit_fit), which is not the share in view printed below it:
      // so the badge says FIT, never VIEW, and the two cannot contradict each other on one card.
      var badge = !isNum(fit) ? null
        : fit === 0 ? el("span", { class: "tag bad", text: "CANNOT SEE TARGET" })
        : fit < 1 ? el("span", { class: "tag warn", text: "PARTIAL FIT" })
        : el("span", { class: "tag good", text: "GOOD FIT" });
      var card = el("button", {
        type: "button", class: "card" + (fit === 0 ? " dim" : ""), "aria-pressed": d.orbit === o.id ? "true" : "false",
        "data-key": "orbit-" + o.id, onclick: function () { setOrbit(d, o.id); redraw(); }
      }, [
        el("div", { class: "card-title" }, [el("h3", { text: o.name.toUpperCase() }), badge]),
        el("p", { class: "card-blurb", text: firstSentence(o.blurb) }),
        facts([
          ["Altitude", num(o.altitude_km, 0) + " km"],
          ["One lap", num(f.period_min) + " min"],
          ["In shadow", num(f.eclipse_min) + " min a lap"],
          ["Lifetime", num(o.lifetime_months, 0) + " months"]
        ]),
        isNum(f.target_in_view) ? el("p", { class: "nasa-line", text: inViewText(d.objective, f.target_in_view) }) : null,
        reachNote(d, o)
      ]);
      return isPreset("orbit") ? presetView(card, d.orbit === o.id) : card;
    });
    return el("section", { class: "screen" }, [
      head("2 · ORBIT"),
      sayLine("orbit"),
      presetNote("orbit"),
      cards.length ? el("div", { class: "grid" }, cards) : el("p", { class: "empty", text: "No orbits in the data yet." }),
      navRow("build", !!d.orbit && !blockedAt(d).orbit)
    ]);
  }

  // ---------------------------------------------------------------- 3 Build
  // WHY: a small flat box for an instrument that adds nothing to the job: what the job wants against what the part is.
  // The words are partWhy()'s (js/mission.js, from the objective's wants and the part's tags); null when the part counts.
  function whyBox(design, partId, withName) {
    var w = typeof partWhy === "function" ? partWhy(design, partId) : null;
    if (!w) return null;
    var p = byId(data("PARTS"), partId);
    return el("p", { class: "part-why", "data-key": "why-" + partId, role: "note" }, [
      el("span", { class: "part-why-chip", text: "WHY?" }), " ", withName && p ? el("strong", { text: p.name + ": " }) : null, w.text]);
  }
  function partStats(p) {
    var bits = [];
    function stat(kind, text) {
      var separator = bits.length ? "· " : "";
      if (bits.length) bits.push(" ");
      bits.push(el("span", { class: "part-stat" }, [separator, icon(kind), text]));
    }
    // A body leads with what it CARRIES (partCard); its own mass is what it WEIGHS.
    if (p.mass_kg) stat("mass", (p.category === "structure" && p.payload_kg ? "WEIGHS " + num(p.mass_kg) + " KG" : num(p.mass_kg) + " kg"));
    if (p.power_draw_w) stat("power", fine(p.power_draw_w) + " W draw");
    if (p.data_gb_day) stat("data", dataText(p.data_gb_day) + "/d made");
    if (p.downlink_gb_day) stat("comms", dataText(p.downlink_gb_day) + "/d sent");
    if (p.battery_wh) stat("power", num(p.battery_wh, 0) + " Wh");
    return bits;
  }

  function partCard(p) {
    var d = state.design;
    var on = list(d.parts).indexOf(p.id) !== -1;
    var locked = lockReason(state.avail ? state.avail.parts : null, p.id);
    if (locked && !on) {
      return el("button", { type: "button", class: "part locked", disabled: true, "data-key": "part-" + p.id }, [
        el("div", { class: "part-head" }, [el("span", { class: "part-name", text: p.name })]),
        el("span", { class: "part-note", text: locked })
      ]);
    }
    var f = getPartFacts(d, p.id) || {};
    var extra = [];
    if (f.power_gen_w) extra.push("+" + num(f.power_gen_w, 0) + " W");
    if (isNum(f.science_per_month)) extra.push("up to " + num(f.science_per_month) + " sci/mo");
    if (isNum(f.resolution_m)) extra.push(num(f.resolution_m) + " m detail");
    var note = f.counts === false ? "Does not count for this objective"
      : f.sharp_enough === false ? "Too blurry from this orbit" : null;
    function preview() { state.hover = p.id; refreshPreview(); }
    var card = el("button", {
      type: "button", class: "part" + (note ? " dim" : ""), "aria-pressed": on ? "true" : "false", "data-key": "part-" + p.id,
      onpointerdown: function (e) {
        // Read before the tap focuses the card (focus also previews).
        state.touch = e.pointerType === "touch";
        state.armed = state.hover === p.id;
      },
      onclick: function () {
        // On touch screens there is no hover: the first tap previews, a second tap toggles.
        if (state.touch && !state.armed) { preview(); state.armed = true; markArmed(card, on); return; }
        state.change = { id: p.id, kind: on ? "remove" : "add" };   // the satellite animates this once
        if (window.GravAudio) GravAudio.sfx(on ? "remove" : "add");   // sound: js/audio.js
        if (on) removePart(d, p.id); else addPart(d, p.id);
        redraw();
      },
      onfocus: preview,
      // Real mouse only: a phone tap also fires mouse enter/leave, which would undo the tap preview.
      // Leaving a card keeps its preview, so the pointer can move onto the preview and scroll it.
      onpointerenter: function (e) { if (e.pointerType === "mouse") preview(); }
    }, [
      el("div", { class: "part-head" }, [el("span", { class: "part-name", text: p.name }), el("span", { class: "part-cost" }, [icon("budget"), money(p.cost_musd)])]),
      p.category === "structure" && p.payload_kg ? el("span", { class: "part-carry", "data-key": "carries-" + p.id }, [icon("mass"), "CARRIES " + num(p.payload_kg, 0) + " KG"]) : null,
      el("span", { class: "part-stats" + (p.category === "structure" && p.payload_kg ? " small" : "") }, partStats(p)),
      extra.length ? el("span", { class: "part-stats" }, extra.reduce(function (bits, text, i) {
        if (i) bits.push(" ");
        bits.push(el("span", { class: "part-stat", text: (i ? "· " : "") + text }));
        return bits;
      }, [])) : null,
      note ? el("span", { class: "part-note", text: note }) : null,
      on ? el("span", { class: "tag on", text: "ON BOARD" }) : null
    ]);
    if (state.touch && state.hover === p.id) markArmed(card, on);
    return card;
  }
  // A finger's first tap on a card: the card says that a second tap adds (or removes) it. One card at a time.
  function markArmed(card, on) {
    Array.prototype.slice.call(document.querySelectorAll(".part.armed")).forEach(function (n) {
      n.classList.remove("armed");
      var old = n.querySelector(".part-tap");
      if (old) old.parentNode.removeChild(old);
    });
    card.classList.add("armed");
    card.appendChild(el("span", { class: "part-tap", text: on ? "TAP AGAIN TO REMOVE" : "TAP AGAIN TO ADD" }));
  }

  // What clicking the hovered part would change (previewToggle). There is one preview box: a redraw moves the box
  // already on the page into the new screen and a hover refills it, so its aria-live text is announced, not replaced.
  function drawPreview() {
    var box = document.getElementById("preview") || el("div", { class: "panel preview", id: "preview", "aria-live": "polite" });
    fillPreview(box);
    return box;
  }
  function refreshPreview() {
    var box = document.getElementById("preview");
    if (box) fillPreview(box);
  }
  function touchScreen() { return !!(window.matchMedia && window.matchMedia("(hover: none)").matches); }

  // The most useful lines first: the change to the bars, then what it fixes and causes; the part's story last.
  function fillPreview(box) {
    while (box.firstChild) box.removeChild(box.firstChild);
    box.scrollTop = 0;
    var touch = state.touch || touchScreen();
    box.appendChild(el("h2", { text: !touch ? "IF YOU CLICK" : state.hover ? "IF YOU TAP AGAIN" : "IF YOU TAP" }));
    var p = state.hover ? byId(data("PARTS"), state.hover) : null;
    var t = p ? previewToggle(state.design, state.hover) : null;
    if (!t) {
      box.appendChild(el("p", { class: "preview-empty", text: (touch ? "Tap" : "Point at") + " a part to see what it would change." }));
      return;
    }
    var dl = t.delta || {};
    var bits = [];
    if (p.category === "structure" && isNum(p.payload_kg) && t.adding) bits.push("carries " + num(p.payload_kg, 0) + " kg");   // the same two numbers as the card: CARRIES, then what it weighs
    if (dl.mass_kg) bits.push((dl.mass_kg > 0 ? "+" : "") + fine(dl.mass_kg) + " kg");
    if (dl.power_draw_w) bits.push((dl.power_draw_w > 0 ? "+" : "") + fine(dl.power_draw_w) + " W draw");
    if (dl.power_gen_w) bits.push((dl.power_gen_w > 0 ? "+" : "") + fine(dl.power_gen_w) + " W made");
    if (dl.cost_musd) bits.push((dl.cost_musd > 0 ? "+" : "-") + money(Math.abs(dl.cost_musd)));
    if (dl.data_returned_gb_day) bits.push("data home " + dataText(dl.data_returned_gb_day, true) + "/day");
    if (dl.delta_v_ms) bits.push(signed(dl.delta_v_ms, 0) + " m/s");
    if (dl.battery_wh) bits.push(signed(dl.battery_wh, 0) + " Wh");
    if (dl.science_total) bits.push("science " + signed(dl.science_total, 0));
    var ch = checkChanges(state.design, state.hover);
    box.appendChild(el("h3", { text: (t.adding ? "ADD " : "REMOVE ") + p.name.toUpperCase() }));
    var why = whyBox(state.design, state.hover);   // the part adds nothing to the job: say why, first
    if (why) box.appendChild(why);
    box.appendChild(el("p", { class: "preview-line", text: bits.length ? bits.join(", ") : "No change to the bars." }));
    if (assist() === "full") {   // above Easy the player works out what a part fixes or breaks
      ch.fixes.forEach(function (x) { box.appendChild(el("p", { class: "preview-line fix", text: "Fixes: " + x.text })); });
      ch.causes.forEach(function (x) { box.appendChild(el("p", { class: "preview-line cause", text: "Causes: " + x.text })); });
    }
    // The part's animated explainer (js/ui-parts.js) tells its story better than the blurb, so it replaces the blurb.
    var story = typeof PartExplainer === "object" && PartExplainer && PartExplainer.has(p.id) ? PartExplainer.element(p.id, { compact: true }) : null;
    if (story) box.insertBefore(story, box.children[why ? 3 : 2] || null);   // under the heading and the WHY box
    else if (p.blurb) box.appendChild(el("p", { class: "preview-line blurb", text: p.blurb }));
  }

  // What a click would fix and cause: runChecks on the design and on a full copy of it with the part toggled (every
  // field kept, so the era's rules still apply). One check id can appear more than once (a BODY FULL line for each
  // kind of part), so lines that share an id are matched by their text. Checks only: every number is the back end's.
  function toggledCopy(d, partId) {
    var a = {};
    Object.keys(d).forEach(function (k) { a[k] = d[k]; });
    a.parts = list(d.parts).slice();
    if (a.parts.indexOf(partId) === -1) addPart(a, partId); else removePart(a, partId);
    return a;
  }
  function checkChanges(d, partId) {
    function all(r) { return list(r.blockers).concat(list(r.warnings)); }
    var before = all(runChecks(d)), after = all(runChecks(toggledCopy(d, partId)));
    // The lines of `from` that `to` no longer has: per id, as many as `to` has fewer, unmatched texts first.
    function gone(from, to) {
      var out = [], seen = {};
      from.forEach(function (c) {
        if (seen[c.id]) return;
        seen[c.id] = true;
        var mine = from.filter(function (x) { return x.id === c.id; });
        var theirs = to.filter(function (x) { return x.id === c.id; }).map(function (x) { return x.text; });
        var n = mine.length - theirs.length;
        if (n <= 0) return;
        var unmatched = mine.filter(function (x) { return theirs.indexOf(x.text) === -1; });
        out = out.concat((unmatched.length >= n ? unmatched : mine).slice(0, n));
      });
      return out;
    }
    return { fixes: gone(before, after), causes: gone(after, before) };
  }

  function sciencePanel(design) {
    var s = previewScience(design);
    var rows = list(s.instruments).map(function (i) {
      return el("div", null, [el("dt", { text: i.name }), el("dd", { text: i.counts === false ? "no" : num(i.per_month) + "/mo" })]);
    });
    return el("div", { class: "panel", title: "An estimate over " + num(s.months, 0) + " months, if nothing goes wrong." }, [
      el("h2", { text: "SCIENCE PREVIEW" }),
      el("p", { class: "science-total", text: num(s.total, 0) + " / " + num(s.target, 0) + " pts" }),
      rows.length ? el("dl", { class: "facts" }, rows) : null
    ].concat(list(s.instruments).map(function (i) { return whyBox(design, i.id, true); })));
  }

  // The satellite's body: what it can carry (payload) against what is fitted. All numbers from getTotals().body.
  function bodyCard(body) {
    if (!body) return null;
    var over = body.payload_used_kg > body.payload_kg;
    return el("div", { class: "body-card" }, [
      el("h2", { class: "divided", text: "BODY: " + String(body.name || "").toUpperCase() }),
      bar("CARRIES", num(body.payload_used_kg) + " / " + num(body.payload_kg, 0) + " KG",
          body.payload_kg > 0 ? body.payload_used_kg / body.payload_kg : 0, over ? " bad" : "")
    ]);
  }

  function drawBuild() {
    var d = state.design;
    var parts = data("PARTS");
    var count = {};
    list(d.parts).forEach(function (id) { var p = byId(parts, id); if (p) count[p.category] = (count[p.category] || 0) + 1; });

    state.avail = availability(d);   // one call per screen refresh; partCard reads it
    var cats = categories();
    // The open bin: the one chosen on the way in (entryBin) or by the player, else the instrument bin, else the first.
    var cat = byId(cats, state.bin) || byId(cats, "instrument") || cats[0];
    var body = getTotals(d).body || null;   // { name, payload_kg, payload_used_kg, slots: { category: { used, max } } } or null
    var bins = el("div", { class: "panel bins" }, [el("h2", { text: "PARTS BINS" })].concat(cats.map(function (c) {
      var n = count[c.id] || 0;
      var need = c.required && !n;
      // With a body fitted, each bin shows how many of its slots are used ("2 / 3 slots", "1 / 1 slot"). A kind of
      // part the body has no slot for says so ("No room on this body", or "2 on board, no room").
      var slot = body && body.slots ? body.slots[c.id] : null;
      var noRoom = !!body && c.id !== "structure" && !(slot && slot.max);
      var over = noRoom ? n > 0 : !!slot && slot.used > slot.max;
      var sub = need ? "Needed" : noRoom ? (n ? n + " on board, no room" : "No room on this body")
        : slot ? slot.used + " / " + slot.max + (slot.max === 1 ? " slot" : " slots") : n ? n + " on board" : c.sub;
      return el("button", {
        type: "button", class: "bin", "aria-pressed": cat.id === c.id ? "true" : "false", "data-key": "bin-" + c.id,
        onclick: function () { state.bin = c.id; state.hover = null; redraw(); showShelf(); }
      }, [
        icon(c.id) || art("0 0 8 8", BIN_ICONS[c.id] || BIN_ICONS.fallback, null),
        el("span", { class: "bin-text" }, [
          el("span", { class: "bin-name", text: c.name }),
          el("span", { class: "bin-sub" + (need || over ? " need" : ""), text: sub })
        ])
      ]);
    })));

    var built = cats.filter(function (c) { return count[c.id]; }).length;
    var chg = state.change; state.change = null;   // the drop-in animation runs on this draw only
    var bench = el("div", { class: "bench" }, [
      el("div", { class: "bench-label" }, [el("strong", { text: "YOUR SATELLITE" }),
        el("span", { text: list(d.parts).length + " parts · " + built + " of " + cats.length + " systems" })]),
      satelliteArt(d, chg)
    ]);

    var overview = el("div", { class: "panel" }, [
      el("h2", { text: "MISSION OVERVIEW" }),
      resourceBars(d),
      bodyCard(body),
      el("h2", { class: "divided", text: "PROBLEMS" }),
      checkList(d, { short: true, skip: ["no-launcher"] })
    ]);

    var shelfParts = parts.filter(function (p) { return p.category === cat.id; });
    // What exists in this era first; what arrives later after it, greyed out.
    shelfParts = shelfParts.filter(function (p) { return !lockReason(state.avail.parts, p.id); })
      .concat(shelfParts.filter(function (p) { return !!lockReason(state.avail.parts, p.id); }));
    var shelf = el("div", { class: "panel" }, [
      el("h2", { text: "AVAILABLE " + cat.name }),
      shelfParts.length ? el("div", { class: "shelf" }, shelfParts.map(partCard))
        : el("p", { class: "empty", text: "No parts in this bin yet." })
    ]);
    // The preview sits on top of the shelf and stays in view while you scroll through the parts (CSS sticky).
    var picker = el("div", { class: "part-picker", id: "part-picker" }, [drawPreview(), shelf]);

    return el("section", { class: "screen" }, [
      head("3 · BUILD"),
      sayLine("build"),
      // On a wide screen the shelf sits under the satellite, and the side panels stay in view while you scroll: you
      // always see what a click did to the bars. On a narrow screen the shelf comes straight after the bins (CSS order).
      el("div", { class: "workshop" }, [bins, el("div", { class: "bench-col" }, [bench, payoutLine(d), picker]),
        el("div", { class: "stack" }, [overview, sciencePanel(d)])]),
      // With the rocket preset (Part 1), the next stop after the Workshop is the Launch Pad.
      navRow(isPreset("launcher") ? "review" : "launcher", true)
    ]);
  }

  // The bin Build opens on: the one a FIX line asked for, else the first required bin still empty (the team's line
  // talks about it), else the one the player had open. Chosen on the way in (go), never on a redraw, so the shelf
  // never changes under the pointer after a click.
  function entryBin(d, wanted) {
    if (wanted) return wanted;
    var have = {};
    list(d.parts).forEach(function (id) { var p = byId(data("PARTS"), id); if (p) have[p.category] = true; });
    var missing = categories().filter(function (c) { return c.required && !have[c.id]; })[0];
    return missing ? missing.id : state.bin;
  }

  // A narrow screen stacks the Build screen: after a bin is picked, bring its parts (and the preview) into view.
  function showShelf() {
    var box = document.getElementById("part-picker");
    if (!box || !(window.matchMedia && window.matchMedia("(max-width: 929px)").matches)) return;
    var top = box.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.5 || top < 0) window.scrollTo(0, window.pageYOffset + top);
  }

  // ---------------------------------------------------------------- launch risk (Part 2)
  // The back end (getLaunchRisk) turns a rocket's failure chance into LOW, MEDIUM or HIGH; the screens only colour it:
  // the existing good, warn and bad. No number is shown. Nothing for Part 1, which never fails at launch.
  var RISK_TAG = { low: ["good", "RISK LOW"], medium: ["warn", "RISK MEDIUM"], high: ["bad", "RISK HIGH"] };
  function riskTag(design, launcherId) {
    if (typeof getLaunchRisk !== "function" || !design || !design.comeback) return null;
    var r = getLaunchRisk({ comeback: design.comeback, campaign: design.campaign, launcher: launcherId });
    var t = r && RISK_TAG[r.level];
    return t ? el("span", { class: "tag risk " + t[0], "data-key": "risk-" + launcherId, text: t[1] }) : null;
  }

  // ---------------------------------------------------------------- 4 Launch vehicle
  function drawLauncher() {
    var d = state.design;
    var totals = getTotals(d);
    var orbit = byId(data("ORBITS"), d.orbit);
    var avail = availability(d);
    var cards = data("LAUNCHERS").map(function (l) {
      var locked = lockReason(avail.launchers, l.id);
      if (locked && d.launcher !== l.id) {
        return el("button", { type: "button", class: "card locked", disabled: true, "data-key": "rocket-" + l.id }, [
          el("div", { class: "card-title" }, [el("h2", { text: l.name.toUpperCase() }), el("span", { class: "tag bad", text: locked.toUpperCase() })])
        ]);
      }
      var cap = orbit && l.capacity_kg ? l.capacity_kg[orbit.id] : null;
      var reach = isNum(cap) && cap > 0;
      var fits = reach && cap >= totals.mass_kg;
      var tag = !orbit ? null
        : !reach ? el("span", { class: "tag bad", text: "CANNOT REACH" })
        : fits ? el("span", { class: "tag good", text: "FITS" })
        : el("span", { class: "tag bad", text: "TOO SMALL" });
      var card = el("button", {
        type: "button", class: "card" + (orbit && !reach ? " locked" : ""), disabled: !!(orbit && !reach),
        "aria-pressed": d.launcher === l.id ? "true" : "false", "data-key": "rocket-" + l.id,
        onclick: function () { setLauncher(d, l.id); redraw(); }
      }, [
        el("div", { class: "card-title" }, [el("h2", { text: l.name.toUpperCase() }), tag]),
        facts([
          ["Price", money(l.cost_musd)],
          orbit ? ["Lifts", reach ? num(cap, 0) + " kg" : "no"] : null
        ]),
        riskTag(d, l.id)
      ]);
      return isPreset("launcher") ? presetView(card, d.launcher === l.id) : card;
    });
    return el("section", { class: "screen" }, [
      head("4 · LAUNCH VEHICLE"),
      sayLine("launcher"),
      presetNote("launcher"),
      el("div", { class: "pad" }, [
        cards.length ? el("div", { class: "grid" }, cards) : el("p", { class: "empty", text: "No rockets in the data yet." }),
        el("div", { class: "panel" }, [el("h2", { text: "MISSION OVERVIEW" }), resourceBars(d), payoutLine(d)])
      ]),
      navRow("review", true)
    ]);
  }

  // ---------------------------------------------------------------- 5 Readiness review (launch control)
  function drawReview() {
    var d = state.design;
    var totalsNow = getTotals(d);
    var checks = runChecks(d);
    var blocked = checks.blockers.length > 0;
    var warned = checks.warnings.length > 0;
    var names = function (ids, items) {
      return list(ids).map(function (id) { var x = byId(items, id); return x ? x.name : id; }).join(", ");
    };
    var objective = byId(data("OBJECTIVES"), d.objective);
    var orbit = byId(data("ORBITS"), d.orbit);
    var rocket = byId(data("LAUNCHERS"), d.launcher);
    // The science this design should bring home if nothing goes wrong, against the job's target (previewScience),
    // shown before the one click that cannot be undone. Short of the target: amber, and the button says ANYWAY.
    var sci = assist(d) !== "minimal" && d.objective && d.orbit && typeof previewScience === "function" ? previewScience(d) : null;
    var short = !!sci && sci.target > 0 && sci.share < 1;
    var forecast = sci && sci.target > 0 ? bar("SCIENCE FORECAST", num(sci.total, 0) + " / " + num(sci.target, 0) + " PTS", sci.share,
      short ? " warn" : "", short ? "Short of the target" : null, "science") : null;
    var launchBtn = button(blocked ? "LAUNCH" : warned || short ? "LAUNCH ANYWAY" : "LAUNCH", launch, { primary: true, big: true, disabled: blocked });
    var control = el("div", { class: "panel launch-control" }, [
      el("span", { class: "countdown-label", text: "LAUNCH STATUS" }),
      el("span", { class: "countdown", text: blocked ? "HOLD" : "READY" }),
      el("p", { class: "verdict " + (blocked ? "bad" : warned || short ? "warn" : "ok"),
        text: blocked ? "NO GO. " + checks.blockers.length + " TO FIX." : warned ? "GO, WITH " + checks.warnings.length + " WARNING" + (checks.warnings.length > 1 ? "S" : "")
          : short ? "GO, SHORT OF TARGET" : "ALL SYSTEMS GO" }),
      comebackDeadline(d, checks),
      d.launcher && riskTag(d, d.launcher) ? el("p", { class: "risk-row" }, [el("span", { class: "countdown-label", text: "ROCKET" }), riskTag(d, d.launcher)]) : null,
      forecast,
      // The one thing to do first: with nothing blocking, LAUNCH comes before the warnings (it was below the fold on a
      // laptop); while something blocks, the NO GO lines and their FIX buttons come first.
      blocked ? null : launchBtn,
      checkList(d, { fix: assist(d) === "full" }),
      facts([
        ["Objective", objective ? objective.name : "not chosen"],
        ["Orbit", orbit ? orbit.name : "not chosen"],
        ["Rocket", rocket ? rocket.name : "not chosen"],
        isComebackDesign(d) ? comebackTimeRow(d) : isNum(totalsNow.dev_months) ? ["Time", num(totalsNow.dev_months, 0) + " months to build"] : null
      ]),
      blocked ? launchBtn : null
    ]);
    return el("section", { class: "screen" }, [
      head("5 · READINESS REVIEW"),
      sayLine("review"),
      el("div", { class: "pad" }, [
        el("div", { class: "stack" }, [padArt(!blocked), satelliteArt(d, null, "small"), el("div", { class: "panel" }, [el("h2", { text: "MISSION OVERVIEW" }), resourceBars(d)])]),
        control
      ]),
      navRow(null)
    ]);
  }

  // ---------------------------------------------------------------- the base map: rules
  function neighbours(id) {
    var out = [];
    EDGES.forEach(function (e) { if (e[0] === id) out.push(e[1]); else if (e[1] === id) out.push(e[0]); });
    return out;
  }

  // Shortest road route between two nodes (breadth-first search over the road graph).
  function route(from, to) {
    var prev = {}, queue = [from], seen = {};
    seen[from] = true;
    while (queue.length) {
      var at = queue.shift();
      if (at === to) break;
      neighbours(at).forEach(function (n) { if (!seen[n]) { seen[n] = true; prev[n] = at; queue.push(n); } });
    }
    if (!seen[to]) return [from];
    var path = [to];
    while (path[0] !== from) path.unshift(prev[path[0]]);
    return path;
  }

  function hasRequiredParts(d) {
    var have = {};
    list(d.parts).forEach(function (id) { var p = byId(data("PARTS"), id); if (p) have[p.category] = true; });
    return categories().every(function (c) { return !c.required || have[c.id]; });
  }

  // Where a NO GO line (or a warning) is fixed. Mass and budget belong to the rocket once one is chosen, and to the
  // parts before that or when the step presets the rocket. An orbit no rocket on offer can reach, or one that needs a
  // thruster when none is on offer (1958), is fixed at the Tracking Station. The route and the FIX links both use this.
  function fixPlace(check, d) {
    var id = String(check && check.id || "");
    if (id === "launcher-reach") return isPreset("launcher") || !anyRocketReaches(d, d.orbit) ? "orbit" : "launcher";
    if (id === "no-launcher" && d.orbit && !anyRocketReaches(d, d.orbit)) return "orbit";
    if (id === "delta-v" && !anyPartOffered(d, "propulsion")) return "orbit";
    if ((id === "mass" || id === "budget" || id === "mass-margin") && (!d.launcher || isPreset("launcher"))) return "build";
    return FIX_SCREEN[id] || "build";
  }
  // Plain data fields only: is any rocket on offer able to reach this orbit at all (capacity above 0)?
  function anyRocketReaches(d, orbitId) {
    var avail = availability(d);
    return data("LAUNCHERS").some(function (l) {
      return !lockReason(avail.launchers, l.id) && !!l.capacity_kg && isNum(l.capacity_kg[orbitId]) && l.capacity_kg[orbitId] > 0;
    });
  }
  function anyPartOffered(d, category) {
    var avail = availability(d);
    return data("PARTS").some(function (p) { return p.category === category && !lockReason(avail.parts, p.id); });
  }

  function blockedAt(d) {
    var at = {};
    runChecks(d).blockers.forEach(function (c) { at[fixPlace(c, d)] = true; });
    return at;
  }

  // The GPS target: the first place with something left to do, judged by runChecks.
  function waypoint() {
    var d = state.design;
    if (!d || !d.objective) return "briefing";
    if (!d.orbit) return "orbit";
    var at = blockedAt(d);
    if (at.orbit) return "orbit";   // an orbit no rocket on offer can reach: nothing later can fix it
    if (!hasRequiredParts(d) || at.build) return "build";
    if (!d.launcher) return "launcher";
    for (var i = 0; i < DESIGN_STEPS.length - 1; i++) if (at[DESIGN_STEPS[i]]) return DESIGN_STEPS[i];
    return "review";
  }

  // The objective line while you stand where the GPS points.
  function doText(screen) {
    var d = state.design;
    if (screen === "orbit" && d.orbit && blockedAt(d).orbit) return "Choose an orbit a rocket can reach.";
    if (screen === "build" && hasRequiredParts(d)) return "Clear the problems marked with a cross under the bars.";
    if (screen === "launcher" && d.launcher && blockedAt(d).launcher) return "Still NO GO: try another rocket, or cut mass or cost at the Workshop.";
    if (screen === "review" && !runChecks(d).blockers.length) return "Launch when ready.";
    return DO_TEXT[screen];
  }

  // A place opens once you have reached the one before it and made the choice it needs.
  function placeOpen(id) {
    var d = state.design, i = DESIGN_STEPS.indexOf(id);
    if (!d || i === -1) return false;
    if (id === "orbit" && !d.objective) return false;
    if (id === "build" && !d.orbit) return false;
    return i <= state.reached + 1;
  }

  function placeDone(id) {
    var d = state.design;
    if (!d) return false;
    var at = blockedAt(d);
    if (id === "briefing") return !!d.objective;
    if (id === "orbit") return !!d.orbit && !at.orbit;
    if (id === "build") return hasRequiredParts(d) && !at.build;
    if (id === "launcher") return !!d.launcher && !at.launcher;
    return false;
  }

  function placeStatus(id) {
    if (!placeOpen(id)) return "locked";
    if (id === waypoint()) return "next";
    return placeDone(id) ? "done" : "open";
  }

  var STATUS_TEXT = { locked: "LOCKED", next: "NEXT", done: "DONE", open: "OPEN" };

  function lockedReason(id) {
    if (id === "orbit" && !state.design.objective) return "Pick a job at Mission Control first.";
    if (id === "build" && !state.design.orbit) return "Choose an orbit at the Tracking Station first.";
    var before = PLACES[DESIGN_STEPS.indexOf(id) - 1];
    return before ? "Visit the " + before.name.toLowerCase() + " first." : "";
  }

  // ---------------------------------------------------------------- the base map: drawing
  function mapRects() {
    var C = { ground: "--map-ground", lot: "--map-lot", road: "--map-road", dash: "--map-dash", sea: "--map-sea",
              wave: "--map-wave", shore: "--map-shore" };
    var r = [
      [0, 0, MAP_W, MAP_H, C.ground],
      // sea along the east coast, with a few waves
      [184, 0, 16, MAP_H, C.sea], [182, 0, 2, MAP_H, C.shore],
      [188, 14, 6, 1, C.wave], [190, 46, 7, 1, C.wave], [187, 78, 6, 1, C.wave], [191, 104, 6, 1, C.wave],
      // building lots
      [20, 8, 40, 30, C.lot], [80, 8, 40, 30, C.lot], [146, 6, 34, 32, C.lot],
      [18, 90, 44, 24, C.lot], [78, 90, 44, 24, C.lot], [144, 90, 34, 24, C.lot],
      // roads: the main road and three side roads
      [0, 60, 182, 7, C.road], [37, 37, 7, 54, C.road], [97, 37, 7, 54, C.road], [157, 37, 7, 54, C.road]
    ];
    for (var x = 2; x < 180; x += 8) r.push([x, 63, 4, 1, C.dash]);
    r.push(
      // main gate: booth and barrier
      [2, 51, 7, 7, PAL.line], [3, 52, 5, 2, PAL.cyan], [9, 57, 10, 1, PAL.gold],
      // Mission Control: long building, window rows, roof aerial
      [24, 14, 32, 22, PAL.muted], [24, 14, 32, 3, PAL.line],
      [27, 20, 4, 3, PAL.cyan], [33, 20, 4, 3, PAL.cyan], [43, 20, 4, 3, PAL.cyan], [49, 20, 4, 3, PAL.cyan],
      [27, 26, 4, 3, PAL.cyan], [33, 26, 4, 3, PAL.cyan], [43, 26, 4, 3, PAL.cyan], [49, 26, 4, 3, PAL.cyan],
      [38, 31, 5, 5, PAL.gold], [50, 8, 1, 6, PAL.ink], [49, 7, 3, 1, PAL.red],
      // Tracking Station: two dishes on a low block
      [84, 28, 32, 8, PAL.line], [86, 14, 10, 2, PAL.ink], [85, 16, 12, 3, PAL.ink], [87, 19, 8, 2, PAL.muted],
      [90, 21, 2, 7, PAL.muted], [104, 10, 12, 2, PAL.ink], [103, 12, 14, 4, PAL.ink], [105, 16, 10, 2, PAL.muted],
      [109, 18, 2, 10, PAL.muted], [98, 31, 5, 5, PAL.gold],
      // Launch Pad: pad, tower, rocket
      [150, 12, 28, 24, C.road], [150, 12, 28, 1, PAL.line], [150, 35, 28, 1, PAL.line],
      [170, 8, 3, 27, PAL.line], [166, 14, 4, 1, PAL.line], [166, 24, 4, 1, PAL.line], [171, 6, 1, 2, PAL.red],
      [160, 9, 4, 3, PAL.red], [159, 12, 6, 20, PAL.ink], [163, 12, 2, 20, PAL.muted], [160, 17, 2, 2, PAL.cyan],
      [157, 28, 2, 5, PAL.red], [165, 28, 2, 5, PAL.red],
      // Workshop: hangar with a striped roof and a big door
      [22, 92, 36, 20, PAL.muted], [22, 92, 36, 2, PAL.ink],
      [22, 96, 36, 1, PAL.line], [22, 100, 36, 1, PAL.line], [32, 104, 16, 8, PAL.line], [33, 105, 14, 7, PAL.gold],
      // Rocket Yard: fence and three rockets of three sizes
      [82, 92, 36, 1, PAL.line], [82, 112, 36, 1, PAL.line], [82, 92, 1, 21, PAL.line], [117, 92, 1, 21, PAL.line],
      [86, 102, 2, 8, PAL.ink], [86, 100, 2, 2, PAL.red],
      [96, 98, 3, 12, PAL.ink], [96, 96, 3, 2, PAL.red],
      [107, 94, 5, 16, PAL.ink], [111, 94, 1, 16, PAL.muted], [107, 92, 5, 2, PAL.red], [105, 106, 2, 4, PAL.red], [112, 106, 2, 4, PAL.red],
      // Ground station: one big dish
      [150, 94, 22, 3, PAL.ink], [148, 97, 26, 4, PAL.ink], [152, 101, 18, 3, PAL.muted], [160, 104, 2, 8, PAL.muted],
      // street lights
      [24, 58, 1, 1, PAL.gold], [70, 58, 1, 1, PAL.gold], [130, 58, 1, 1, PAL.gold], [176, 58, 1, 1, PAL.gold],
      [24, 68, 1, 1, PAL.gold], [70, 68, 1, 1, PAL.gold], [130, 68, 1, 1, PAL.gold], [176, 68, 1, 1, PAL.gold]
    );
    return r;
  }

  function routePoints(path) {
    return path.map(function (id) { return NODES[id].x + "," + NODES[id].y; }).join(" ");
  }

  // The base map in low poly (LowPoly.scenes.base, js/lp-base.js): a canvas under the markers, the gold route and
  // the player, which all keep their places. The scene is built for the canvas's own size, so its project(x, y)
  // is exactly where a marker stands (x / 200 and y / 120 of the map box), and built again when the box changes
  // shape. Once it has drawn, the pixel drawing is hidden (its SVG keeps only the route). Decoration only: the
  // markers carry the meaning. null without the 3D art (the pixel map stays).
  var baseScene = null;   // {key, wrap}: building it takes about 20 ms, so it is kept while the size holds
  function lpBaseMap(board) {
    try {
      if (typeof LowPoly !== "object" || !LowPoly || !LowPoly.scenes || typeof LowPoly.scenes.base !== "function" ||
          typeof LowPoly.view !== "function" || typeof ResizeObserver !== "function") return null;
      var canvas = document.createElement("canvas"), view = null;
      canvas.width = 0; canvas.height = 0;
      canvas.className = "map-lp";
      var ro = new ResizeObserver(function () {
        if (!canvas.isConnected && view) { ro.disconnect(); return; }
        var w = canvas.clientWidth, h = canvas.clientHeight;
        if (!(w > 0 && h > 0)) return;
        try {
          var key = w + "x" + h;
          if (!baseScene || baseScene.key !== key) {
            baseScene = { key: key, wrap: LowPoly.scenes.base({ width: w, height: h, places: PLACES, nodes: NODES, edges: EDGES }) };
          }
          if (view) view.set(baseScene.wrap);
          else view = LowPoly.view(canvas, baseScene.wrap, { drag: false, keys: false, fps: 30 });
          canvas.setAttribute("role", "presentation");   // decoration (the engine labels every canvas it draws)
          if (canvas.width > 0) board.classList.add("lp-on");
        } catch (e) { ro.disconnect(); board.classList.remove("lp-on"); }
      });
      ro.observe(canvas);
      canvas.setAttribute("aria-hidden", "true");
      canvas.setAttribute("role", "presentation");
      return canvas;
    } catch (e) { return null; }
  }
  // The header minimap's picture: the low-poly minimap drawn once and kept (setStep rebuilds the minimap on every
  // redraw). "" when it cannot be drawn: the pixel map is used.
  var miniPicture = null;
  function lpMinimap() {
    if (miniPicture !== null) return miniPicture;
    miniPicture = "";
    try {
      if (typeof LowPoly === "object" && LowPoly && LowPoly.scenes && typeof LowPoly.scenes.minimap === "function") {
        var wrap = LowPoly.scenes.minimap({ width: 340, height: 204, places: PLACES, nodes: NODES, edges: EDGES });
        var c = document.createElement("canvas");
        c.width = 340; c.height = 204;
        if (LowPoly.render(c, wrap.scene)) miniPicture = c.toDataURL("image/png");
      }
    } catch (e) { miniPicture = ""; }
    return miniPicture;
  }

  // The map art. `mini` = the header minimap, with the player and the route drawn in.
  function mapSvg(mini, here) {
    var picture = mini ? lpMinimap() : "";
    var svg = art("0 0 " + MAP_W + " " + MAP_H, picture ? [] : mapRects(),
      mini ? null : "Map of the space centre: Mission Control, the Tracking Station, the Workshop, the Rocket Yard and the Launch Pad, joined by roads",
      mini ? "minimap-art" : "map-art");
    var NS = "http://www.w3.org/2000/svg";
    if (picture) {
      var image = document.createElementNS(NS, "image");
      image.setAttribute("href", picture);
      image.setAttribute("width", MAP_W); image.setAttribute("height", MAP_H);
      image.setAttribute("preserveAspectRatio", "none");
      svg.appendChild(image);
    }
    var line = document.createElementNS(NS, "polyline");
    line.setAttribute("class", "map-route");
    line.setAttribute("fill", "none");
    svg.appendChild(line);
    if (mini) {
      var at = NODES[here] || NODES[state.player] || NODES.gate;
      var next = NODES[waypoint()];
      line.setAttribute("points", routePoints(route(here in NODES ? here : state.player, waypoint())));
      [[next.x - 4, next.y - 4, 8, 8, PAL.gold], [at.x - 3, at.y - 3, 6, 6, PAL.ink], [at.x - 2, at.y - 2, 4, 4, PAL.sky]].forEach(function (q) {
        var rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", q[0]); rect.setAttribute("y", q[1]);
        rect.setAttribute("width", q[2]); rect.setAttribute("height", q[3]);
        rect.style.fill = "var(" + q[4] + ")";   // the PAL names are CSS custom properties (a fill attribute cannot read one)
        svg.appendChild(rect);
      });
    }
    return svg;
  }

  function pct(node) { return { left: (node.x / MAP_W * 100) + "%", top: (node.y / MAP_H * 100) + "%" }; }

  function drawMap() {
    var refs = { markers: {}, legend: {} };
    var board = el("div", { class: "map", id: "map", role: "group", tabindex: "0", "aria-label": "Base map. Arrow keys or WASD to walk, E to go in." });
    refs.svg = mapSvg(false);
    refs.route = refs.svg.querySelector(".map-route");
    var lpMap = lpBaseMap(board);
    if (lpMap) board.appendChild(lpMap);
    board.appendChild(refs.svg);

    refs.edge = {};
    PLACES.forEach(function (p) {
      var at = pct(NODES[p.id]);
      // A marker near the map's left or right edge hangs its name towards the middle, so a phone shows all of it.
      refs.edge[p.id] = NODES[p.id].x < MAP_W * 0.3 ? " edge-l" : NODES[p.id].x > MAP_W * 0.7 ? " edge-r" : "";
      var b = el("button", {
        type: "button", class: "blip" + refs.edge[p.id], "data-key": "blip-" + p.id, style: "left: " + at.left + "; top: " + at.top,
        onclick: function () { walkTo(p.id, true); }
      }, [el("span", { class: "blip-num", text: String(p.num) }), el("span", { class: "blip-name", text: p.name })]);
      refs.markers[p.id] = b;
      board.appendChild(b);
    });
    ["gate", "ground"].forEach(function (id) {
      var at = pct(NODES[id]);
      board.appendChild(el("span", { class: "map-label map-label-" + id, style: "left: " + at.left + "; top: " + at.top,
        text: id === "gate" ? "MAIN GATE" : "GROUND STATION", "aria-hidden": "true" }));
    });

    refs.player = el("div", { class: "player", "aria-hidden": "true" }, [art("0 0 7 7",
      [[3, 0, 1, 1, PAL.ink], [2, 1, 3, 1, PAL.ink], [1, 2, 5, 1, PAL.ink], [0, 3, 7, 2, PAL.ink], [2, 5, 3, 2, PAL.ink],
       [3, 2, 1, 3, PAL.red]], null)]);
    board.appendChild(refs.player);

    refs.promptText = el("span", { class: "map-prompt-text" });
    refs.enter = el("button", { type: "button", class: "btn primary", onclick: act, "data-key": "map-enter" }, "ENTER [E]");
    // Below the map, never on top of it, so it cannot cover a marker. The one instruction on the map is the header's
    // OBJECTIVE line; this box is its button ("GO TO WORKSHOP"), or what the place you stand at is for.
    refs.prompt = el("div", { class: "map-prompt", "aria-live": "polite" }, [refs.promptText, refs.enter]);

    // Names and NEXT / DONE / LOCKED only; why a place is locked is said when you pick it.
    var legend = el("ul", { class: "legend" }, PLACES.map(function (p) {
      var status = el("span", { class: "tag" });
      // No aria-label: the button's name is its visible text, which updateMap keeps current.
      var item = el("li", null, [el("button", {
        type: "button", class: "legend-item", "data-key": "legend-" + p.id, onclick: function () { walkTo(p.id, true); }
      }, [el("span", { class: "blip-num", text: String(p.num) }),
          el("span", { class: "legend-text" }, [el("span", null, [icon(p.id), p.name])]),
          status])]);
      refs.legend[p.id] = { status: status };
      return item;
    }));

    state.map = refs;
    return el("section", { class: "screen" }, [
      head("BASE MAP"),
      sayLine("map"),
      el("div", { class: "map-layout" }, [
        el("div", { class: "stack" }, [board, refs.prompt]),
        el("aside", { class: "panel" }, [
          el("h2", { text: "PLACES" }), legend,
          // The keys, for a keyboard (hidden on a touch screen, where the hint says to tap a place). On the map,
          // M and Esc go back into the place you stand at.
          el("div", { class: "keys-box" }, [el("h2", { class: "divided", text: "KEYS" }),
            el("p", { class: "keys" }, [el("kbd", { text: "WASD" }), " walk ", el("kbd", { text: "E" }), " enter ", el("kbd", { text: "M" }), " back inside"])]),
          // The journal (js/ui-story.js): absent when that file is. Walking stops first so a walk cannot swap the screen under it.
          window.StarlineStory && window.StarlineStory.journalButton ? window.StarlineStory.journalButton({ design: state.design,
            before: stopWalking, back: function () { showDesignScreen("map"); }, key: "map-journal" }) : null,
          el("div", null, [isComebackDesign(state.design)
            ? button("BACK TO THE WORKSHOP", function () { window.showComebackHub(); }, { key: "map-workshop" })
            : inCampaign()
            ? button("BACK TO THE HUB", function () { window.showCampaignHub(); })
            : button("HOME", function () { showDesignScreen("title"); }, { key: "map-home" })])
        ])
      ])
    ]);
  }

  function placePlayer(nodeId, ms, from) {
    var refs = state.map;
    if (!refs) return;
    var to = NODES[nodeId], at = pct(to);
    if (from) {
      var dx = to.x - from.x, dy = to.y - from.y;
      var angle = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 90 : -90) : (dy > 0 ? 180 : 0);
      refs.player.style.setProperty("--face", angle + "deg");
    }
    refs.player.style.transitionDuration = ms + "ms";
    if (ms) void refs.player.offsetWidth;   // commit the start point so the move animates
    refs.player.style.left = at.left;
    refs.player.style.top = at.top;
  }

  // Refreshes markers, route, prompt and legend in place (the map is not redrawn while you walk).
  function updateMap(snap) {
    var refs = state.map;
    if (!refs || state.screen !== "map") return;
    if (snap) placePlayer(state.player, 0);
    var next = waypoint();
    PLACES.forEach(function (p) {
      var st = placeStatus(p.id);
      refs.markers[p.id].className = "blip " + st + refs.edge[p.id] + (state.player === p.id ? " here" : "");
      var line = st === "locked" ? lockedReason(p.id) : p.does + ".";
      refs.markers[p.id].setAttribute("aria-label", p.num + p.name + ", " + STATUS_TEXT[st].toLowerCase() + ". " + line);
      refs.legend[p.id].status.className = "tag " + (st === "next" ? "warn" : st === "done" ? "good" : st === "locked" ? "bad" : "");
      refs.legend[p.id].status.textContent = STATUS_TEXT[st];
    });
    refs.route.setAttribute("points", routePoints(route(state.player, next)));

    var here = byId(PLACES, state.player);
    var openHere = !!here && placeOpen(here.id);
    var canEnter = openHere && !state.walking;
    var text;
    if (state.mapNote) text = state.mapNote;
    else if (state.walking) text = "Walking...";
    else if (openHere) text = here.name + ": " + here.does + ".";
    else if (here) text = here.name + " is locked. " + lockedReason(here.id);
    else text = "";   // at the gate or a crossing: the button says where the gold route goes
    refs.promptText.textContent = text;
    refs.promptText.hidden = !text;
    // Two parts, like the GO TO buttons inside a place: a long name wraps, and the key stays on the right.
    while (refs.enter.firstChild) refs.enter.removeChild(refs.enter.firstChild);
    refs.enter.appendChild(el("span", { text: canEnter ? "ENTER" : "GO TO " + byId(PLACES, next).name }));
    refs.enter.appendChild(el("span", { text: "[E]" }));
    // Never disabled while walking: that would drop keyboard focus to the page.
    refs.enter.disabled = !!here && !openHere && here.id === next;
    setStep("map");
  }

  // The walk across the base is a treat for the first flight; from the second flight of a comeback it is a tax (ui-review.md,
  // problem 9): the player arrives at once. Reduced motion already sets WALK_MS to 0.
  function walkMs() {
    try {
      if (WALK_MS && isComebackDesign(state.design) && typeof getComeback === "function") { var c = getComeback(); if (c && c.flights >= 1) return 0; }
    } catch (e) { /* walk as usual */ }
    return WALK_MS;
  }
  function stopWalking() {
    if (state.walkTimer) clearTimeout(state.walkTimer);
    state.walkTimer = null;
    state.walking = false;
    state.stepping = false;
    state.queued = null;
  }

  // Walks the player along a list of nodes, one road at a time, then calls done().
  function walkPath(path, done) {
    stopWalking();
    state.walking = true;
    state.mapNote = "";
    var i = 1;
    function next() {
      if (i >= path.length || state.screen !== "map") { state.walking = false; state.walkTimer = null; updateMap(); if (done) done(); return; }
      var from = NODES[path[i - 1]], to = NODES[path[i]];
      var ms = (Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) * walkMs();
      state.player = path[i];
      placePlayer(path[i], ms, from);
      i++;
      state.walkTimer = setTimeout(next, ms);
    }
    updateMap();
    next();
  }

  function enterPlace(id) {
    if (!placeOpen(id)) {
      state.mapNote = byId(PLACES, id).name + " is locked. " + lockedReason(id);
      updateMap();
      state.mapNote = "";
      // Arm the double-click guard first: the scroll moves the list under the pointer.
      if (state.map) { state.swappedAt = Date.now(); state.map.prompt.scrollIntoView({ block: "nearest" }); }
      return;
    }
    go(id);
  }

  function walkTo(id, enterOnArrival) {
    if (state.walking) return;
    if (enterOnArrival && !placeOpen(id)) return enterPlace(id);   // say why now, no wasted walk
    walkPath(route(state.player, id), function () { if (enterOnArrival) enterPlace(id); });
  }

  // E / Enter on the map: go into the building you stand at, or follow the route.
  function act() {
    if (state.walking) return;
    var here = byId(PLACES, state.player);
    if (here && placeOpen(here.id)) return go(here.id);
    walkTo(waypoint(), false);
  }

  // Returns true if the key did something (so the page should not scroll).
  function stepToward(dir, repeat) {
    // A held key keeps walking but is never queued, so the arrow stops where you let go.
    if (state.walking) { if (state.stepping && !repeat) state.queued = dir; return true; }
    var at = NODES[state.player], best = null, bestScore = 0.5;
    neighbours(state.player).forEach(function (n) {
      var dx = NODES[n].x - at.x, dy = NODES[n].y - at.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var score = (dx * dir[0] + dy * dir[1]) / len;
      if (score > bestScore) { bestScore = score; best = n; }
    });
    if (!best) return false;
    walkPath([state.player, best], function () {
      var q = state.queued;
      state.stepping = false;
      state.queued = null;
      if (q && state.screen === "map") stepToward(q);
    });
    state.stepping = true;   // after walkPath, which resets it
    return true;
  }

  function openMap() {
    if (state.locked || !state.design) return;
    if (DESIGN_STEPS.indexOf(state.screen) !== -1) state.player = state.screen;
    go("map");
  }

  // CONTINUE: step outside, walk the road to the next place and go in.
  function travel(id) {
    openMap();
    walkTo(id, true);
  }

  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || !state.design || state.locked) return;
    var k = e.key, active = document.activeElement;
    var onMap = state.screen === "map";
    if (onMap && KEY_DIRS[k]) { if (stepToward(KEY_DIRS[k], e.repeat) || e.repeat) e.preventDefault(); return; }
    if (onMap && (k === "m" || k === "M" || k === "Escape")) {
      e.preventDefault();
      if (!e.repeat && !state.walking && placeOpen(state.player)) go(state.player);   // back inside
      return;
    }
    if (onMap && (k === "e" || k === "E")) { e.preventDefault(); return act(); }
    // Enter is left to a focused button; otherwise it acts on the map.
    if (onMap && k === "Enter" && !(active && active.tagName === "BUTTON")) { e.preventDefault(); return act(); }
    if (!onMap && DESIGN_STEPS.indexOf(state.screen) !== -1 && (k === "m" || k === "M" || k === "Escape")) {
      e.preventDefault();
      if (!e.repeat) openMap();
    }
  }

  function launch() {
    if (launchShowing) return;
    if (runChecks(state.design).blockers.length) return;
    if (typeof window.showMissionScreen === "function") {
      state.locked = true;
      var design = state.design;
      launchShow(function () { window.showMissionScreen(design); });
    }
  }

  // The lift-off, about 14 s: T-MINUS 5 counts down to zero over the design's rocket on the low-poly pad (the arms
  // swing clear, the engines start, smoke billows), it lifts off on zero, climbs with the camera following, and leaves
  // the frame. Then the camera pulls up and away over the Earth, the satellite lets go of its spent stage, and the
  // player's OWN satellite (the model the Build bench shows) orbits along the chosen orbit's ring for about 4 s, more
  // than one lap, the status line IN ORBIT with the orbit's name; then done() opens the mission screen. A click or any key skips it (a SKIP button stays on screen the
  // whole time). It only delays the screen change: the design is locked at the click and nothing can change it before
  // done(). With reduced motion, with no rocket chosen or without the 3D art, done() runs at once and nothing is shown.
  // The count is the show's clock, not the game's. The pad scene (js/lp-pad.js) has its own launch clock: 0 on the pad,
  // about 0.4 ignition, 3 lift-off, then the climb. It plays at its natural speed through the count, so lift-off lands
  // on zero; only the climb is a little faster than natural. The finale is the Earth scene (js/lp-earth.js) on the same
  // canvas, driven by this clock: its own time 0 is the end of the climb; the stage lets go at LAUNCH_SEP_S.
  var LAUNCH_COUNT = 5, LAUNCH_TICK_MS = 800, LAUNCH_HOLD_MS = 1000, LAUNCH_LIFTOFF_MS = 2000, LAUNCH_CLIMB_MS = 2600;
  var LAUNCH_SCENE_LIFTOFF = 3, LAUNCH_SCENE_END = 9.8, LAUNCH_FOLLOW_UNTIL = 5, LAUNCH_FOLLOW_EASE = 2;
  var LAUNCH_FINALE_MS = 6000, LAUNCH_LAP_S = 3.4, LAUNCH_ORBIT_AT_MS = 2000;   // the orbit starts 2 s into the finale
  var LAUNCH_PAD_MS = LAUNCH_COUNT * LAUNCH_TICK_MS + LAUNCH_LIFTOFF_MS + LAUNCH_CLIMB_MS, launchShowing = false;
  // What the status line says from each moment (ms into the show). The finale adds ABOVE THE ATMOSPHERE, SEPARATION and
  // IN ORBIT with the orbit's name (data/orbits.js) when it is shown.
  var LAUNCH_STATUS = [[0, "ALL SYSTEMS GO"], [1400, "ENGINES START"], [LAUNCH_COUNT * LAUNCH_TICK_MS, "CLEAR OF THE TOWER"],
    [LAUNCH_COUNT * LAUNCH_TICK_MS + LAUNCH_LIFTOFF_MS, "CLIMBING"]];
  function launchShow(done) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var row = chosenLauncher();
    if (reduce || !row || typeof LowPoly !== "object" || !LowPoly || !LowPoly.scenes || typeof LowPoly.scenes.pad !== "function") return done();
    var finished = false, box = null, timer = null, ticker = null, count = null, status = null, word = null;
    var countMs = LAUNCH_COUNT * LAUNCH_TICK_MS, climbAt = countMs + LAUNCH_LIFTOFF_MS, finaleAt = LAUNCH_PAD_MS;
    // The finale: the player's own satellite in the Earth scene, on the chosen orbit. Without an orbit, the 3D Earth or
    // the satellite model the show ends when the climb does.
    var finale = null, showMs = LAUNCH_PAD_MS, d0 = state.design;
    try {
      var flat = d0 && d0.orbit && typeof LowPoly.scenes.earth === "function" && typeof LowPoly.scenes.satellite === "function" &&
        typeof LowPoly.scenes.satellite.flat === "function" ? LowPoly.scenes.satellite.flat({ parts: list(d0.parts), data: data("PARTS") }) : null;
      if (flat) finale = LowPoly.scenes.earth({ orbitId: d0.orbit, objectiveId: d0.objective, spin: 6, lap: LAUNCH_LAP_S, mesh: flat.mesh, size: 2.3, finale: true });
      if (finale && !finale.orbit) finale = null;
    } catch (e0) { finale = null; }
    if (finale) {
      showMs = LAUNCH_PAD_MS + LAUNCH_FINALE_MS;
      var orb = byId(data("ORBITS"), d0.orbit), orbName = orb && orb.name ? String(orb.name).replace(/\s*\(.*?\)/g, "").toUpperCase() : "";
      LAUNCH_STATUS = LAUNCH_STATUS.slice(0, 4).concat([[finaleAt, "ABOVE THE ATMOSPHERE"], [finaleAt + finale.finale.sep * 1000, "SEPARATION"],
        [finaleAt + LAUNCH_ORBIT_AT_MS, "IN ORBIT" + (orbName ? " · " + orbName : "")]]);
    } else LAUNCH_STATUS = LAUNCH_STATUS.slice(0, 4);
    var now = function () { return window.performance && performance.now ? performance.now() : Date.now(); };
    var start = now();
    function onKeyShow(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key !== "Tab" && e.key !== "Shift" && !e.repeat) finish();
    }
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(ticker);
      document.removeEventListener("keydown", onKeyShow, true);
      if (box && box.parentNode) box.parentNode.removeChild(box);
      launchShowing = false;
      if (window.GravAudio) GravAudio.duck(false);
      done();
    }
    // T-MINUS 00:00:05 ... 01, then 00:00:00 and LIFT-OFF; the status line follows the sequence.
    function showCount() {
      if (!count || !box) return;
      var ms = now() - start;
      var left = Math.max(0, Math.ceil(LAUNCH_COUNT - ms / LAUNCH_TICK_MS));
      var text = "00:00:0" + left;
      if (count.textContent !== text) { count.textContent = text; if (window.GravAudio && left > 0) GravAudio.sfx("tick"); }   // sound: js/audio.js
      var phase = left > 0 ? "count" : ms < climbAt ? "liftoff" : ms < finaleAt || !finale ? "climb" : "orbit";
      if (box.getAttribute("data-phase") !== phase) {
        box.setAttribute("data-phase", phase);
        if (window.GravAudio) GravAudio.sfx(phase === "liftoff" ? "liftoff" : phase === "orbit" ? "orbit" : "");
      }
      var say = "";
      LAUNCH_STATUS.forEach(function (s) { if (ms >= s[0]) say = s[1]; });
      if (status.textContent !== say) status.textContent = say;
      var w = left > 0 ? "T-MINUS" : "LIFT-OFF";
      if (word.textContent !== w) word.textContent = w;
    }
    // The pad scene's clock for a moment of the show: held on the pad for a second, its natural speed through the count
    // (lift-off at zero) and the lift-off, then the climb.
    function sceneAt(ms) {
      if (ms <= LAUNCH_HOLD_MS) return 0;
      if (ms <= countMs) return (ms - LAUNCH_HOLD_MS) / (countMs - LAUNCH_HOLD_MS) * LAUNCH_SCENE_LIFTOFF;
      if (ms <= climbAt) return LAUNCH_SCENE_LIFTOFF + (ms - countMs) / LAUNCH_LIFTOFF_MS * (LAUNCH_FOLLOW_UNTIL - LAUNCH_SCENE_LIFTOFF);
      return LAUNCH_FOLLOW_UNTIL + Math.min(1, (ms - climbAt) / LAUNCH_CLIMB_MS) * (LAUNCH_SCENE_END - LAUNCH_FOLLOW_UNTIL);
    }
    launchShowing = true;
    if (window.GravAudio) GravAudio.duck(true);   // the music steps back for the launch
    timer = setTimeout(finish, showMs);   // armed first: a hidden tab or a drawing error cannot hold the player here
    try {
      var lp = lpCanvas(function (L) { return L.scenes.pad({ launcherId: row.id, launcher: row, ready: true }); }, "lp-launch");
      if (!lp) return finish();
      var cam = lp.wrap.scene.camera, followed = null, swapped = false;
      lp.wrap.setTime(0);
      lp.view.onFrame(function () {
        var ms = now() - start;
        if (finale && ms >= finaleAt) {
          // The same canvas now shows the Earth. The view is given the scene without its update(): this clock drives it.
          if (!swapped) {
            swapped = true;
            lp.view.set({ scene: finale.scene, label: finale.label });
            lp.canvas.classList.add("lp-fadein");
          }
          finale.fit(lp.canvas.clientWidth, lp.canvas.clientHeight);
          finale.pose((ms - finaleAt) / 1000);
          return;
        }
        var T = sceneAt(ms);
        lp.wrap.setTime(T);
        // The scene's camera follows the rocket up. From LAUNCH_FOLLOW_UNTIL it slows to a stop over LAUNCH_FOLLOW_EASE
        // seconds, so the rocket climbs out of the top of the frame instead of staying in it.
        if (T > LAUNCH_FOLLOW_UNTIL && cam.target) {
          if (followed === null) followed = { y: cam.target[1], T: T, v: 0 };
          var tau = Math.min(T - LAUNCH_FOLLOW_UNTIL, LAUNCH_FOLLOW_EASE);
          if (followed.v === 0) followed.v = (cam.target[1] - followed.y) / Math.max(1e-3, T - followed.T);
          cam.target = [cam.target[0], followed.y + followed.v * (tau - tau * tau / (2 * LAUNCH_FOLLOW_EASE)), cam.target[2]];
        } else followed = null;
      });
      word = el("span", { class: "launch-word", text: "T-MINUS" });
      count = el("span", { class: "countdown", "data-key": "launch-count", text: "00:00:0" + LAUNCH_COUNT });
      status = el("p", { class: "launch-status", "data-key": "launch-status", text: LAUNCH_STATUS[0][1] });
      var skip = el("button", { type: "button", class: "btn launch-skip" }, "SKIP");
      box = el("div", { class: "launch-show", role: "dialog", "aria-modal": "true", "data-phase": "count",
        "aria-label": "Countdown and lift-off. Click, or press any key, to skip." }, [
        el("div", { class: "launch-clock", "aria-hidden": "true" }, [word, count]), status,
        lp.canvas, skip]);
      box.addEventListener("click", finish);
      document.addEventListener("keydown", onKeyShow, true);
      document.body.appendChild(box);
      ticker = setInterval(showCount, 50);   // its own timer: the count goes on even if the canvas stops drawing
      state.swappedAt = Date.now();   // the second click of a double click on LAUNCH must not skip it at once
      skip.focus();
    } catch (e) { finish(); }
  }

  // ---------------------------------------------------------------- start-up and shared names
  function showDesignScreen(screenName, design) {
    if (design) state.design = design;
    state.locked = false;
    if (screenName === "title") { state.design = null; state.walk = null; state.reached = 0; state.player = "gate"; }
    var i = DESIGN_STEPS.indexOf(screenName);
    if (i !== -1 && i > state.reached) state.reached = i;
    // A fresh design starts over at the gate; coming back to redesign, every place is open.
    if (design && (screenName === "briefing" || screenName === "map")) { state.reached = 0; state.player = "gate"; bumpReached(); }
    else if (design) state.reached = DESIGN_STEPS.length - 1;
    go(screenName || "briefing");
  }

  window.showDesignScreen = showDesignScreen;
  window.StarlineUI = {
    el: el, art: art, icon: icon, facts: facts, button: button, num: num, money: money, profitLine: profitLine, starsText: starsText,
    byId: byId, data: data, list: list, directorArt: directorArt,
    say: sayLine, more: more, firstSentence: firstSentence,
    storyLine: function (key, design, extra) { return typeof storyLine === "function" ? storyLine(key, design || state.design, extra) : ""; },
    speakerArt: speakerFace,
    story: function () { return STORY; },   // read-only, for js/ui-story.js (interludes and endings)
    speakerName: function (who) { return typeof STORY === "object" && STORY.speakers && STORY.speakers[who] ? STORY.speakers[who] : ""; },
    satelliteArt: satelliteArt,
    lpCanvas: lpCanvas,
    setStep: setStep, setHint: setHint, setStatus: setStatus,
    lock: function () { state.locked = true; },
    bar: bar,
    // Leaving the design and mission screens for the Campaign hub: no design in hand, nothing locked.
    leaveMission: function () { stopWalking(); state.design = null; state.locked = false; state.reached = 0; state.player = "gate"; markEra("hub"); },
    // The era look: era("today") before a screen's pictures are drawn (the Part 2 screens), era() the era of the design in hand.
    era: function (name) { markEra("era", name); },
    assist: assist,
    mount: function (screen, node) {
      state.screen = screen;
      markHome(screen);
      markEra(screen);
      state.swappedAt = Date.now();
      var app = document.getElementById("app");
      while (app.firstChild) app.removeChild(app.firstChild);
      app.appendChild(node);
      setStep(screen);
      setHint(screen);
      if (window.GravMotion) GravMotion.mounted(app, screen);
      app.focus();
      window.scrollTo(0, 0);
    },
    tierName: modeName,
    // Part 1. walkStep(design): the walkthrough step this design is (1 to 3), or 0. walkResult(design, stars): once per
    // debrief, keeps the best stars of a step that passed and returns { step, passed, kept, best_stars, last } (null
    // for any other design; kept: this flight fell short but the step had passed before). startWalkStep(n) starts step n; showEpilogue() follows step 3.
    walkStep: walkStepOf,
    walkStars: walkStars,   // read-only: the best stars of a passed Part 1 step, or null (the journal)
    walkResult: walkResult,
    startWalkStep: startWalkStep,
    showEpilogue: showEpilogue,
    // A few story beats, one at a time, then onDone: showBeats([{ who, text }], kicker, onDone, { doneLabel, skipToEnd, home }).
    showBeats: function (beats, kicker, onDone, opts) { showBeats(beats, kicker, typeof onDone === "function" ? onDone : function () { showDesignScreen("title"); }, opts); },
    home: function () { showDesignScreen("title"); },
    // Part 2: a story line ({ who, text } from storyLine) as the speech box every screen uses; the header line;
    // the plain name of a difficulty ("NORMAL"); the mode cards' words.
    sayEl: sayElement,
    comebackStatus: comebackStatus,
    levelName: comebackLevel,
    modes: STORY.modes
  };

  function start() {
    var help = document.getElementById("help-btn");
    if (help) help.addEventListener("click", function () { state.hintOpen = !state.hintOpen; setHint(state.screen); });
    var mini = document.getElementById("minimap");
    if (mini) mini.addEventListener("click", openMap);
    document.addEventListener("keydown", onKey);
    setDataBadge();
    window.addEventListener("livedata", setDataBadge);
    // A double-click whose first click changed the screen must not also click
    // whatever appeared under the pointer. Later clicks on the new screen are fine.
    document.addEventListener("click", function (e) {
      if (e.detail > 1 && state.lastClickAt <= state.swappedAt && Date.now() - state.swappedAt < 600) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      state.lastClickAt = Date.now();
    }, true);
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) WALK_MS = 0;
    draw("title");
  }

  // perf: index.html defers every script, so this file runs before the later ui-*.js files (ui-comeback.js defines window.showComebackStart).
  // DOMContentLoaded fires after the last deferred script has run: start then. A page that loads this file by hand starts at once.
  if (document.readyState === "loading" || (document.currentScript && document.currentScript.defer)) document.addEventListener("DOMContentLoaded", start);
  else start();
})();
