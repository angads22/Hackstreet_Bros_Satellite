// data/research.js — owned by Data (yarmee). The research tree is a timeline of
// satellite technology (SPEC.md, "The 1957 campaign"). Anything not unlocked here is
// available from the start. year = when the technology really arrived (history only:
// buying it earlier is allowed). cost_musd and cost_sci (science points) are GAME VALUES.
// requires: research ids; requires_lessons: best practices shown in flight (SPEC.md,
// "Lessons"); requires_knowledge: what earlier satellites must already have learned.

const RESEARCH = [
  {
    id: "solar-cells", name: "Silicon solar cells", year: 1958, cost_musd: 2, cost_sci: 5,
    requires: [], requires_lessons: ["batteries_ran_out"], requires_knowledge: {},
    unlocks: { parts: ["silicon-cells"], launchers: [], objectives: [] },
    blurb: "Sputnik fell silent in 21 days; Vanguard 1's solar cells kept talking for six years. Watch a battery die first."
  },
  {
    id: "tape-recorder", name: "Tape recorders", year: 1958, cost_musd: 1.5, cost_sci: 5,
    requires: [], requires_lessons: [], requires_knowledge: { radiation: 0.2 },
    unlocks: { parts: ["tape-recorder"], launchers: [], objectives: [] },
    blurb: "Explorer 1's counter went silent high up. Explorer 3 recorded whole orbits to find out why: the radiation belts."
  },
  {
    id: "rechargeable-batteries", name: "Rechargeable batteries", year: 1959, cost_musd: 1.5, cost_sci: 10,
    requires: ["solar-cells"], requires_lessons: [], requires_knowledge: {},
    unlocks: { parts: ["nicad-battery"], launchers: [], objectives: [] },
    blurb: "Solar cells charge nickel-cadmium batteries in sunlight, so the satellite keeps working in Earth's shadow."
  },
  {
    id: "cloud-photometry", name: "Cloud photometry", year: 1959, cost_musd: 3, cost_sci: 15,
    requires: ["solar-cells"], requires_lessons: ["margins"], requires_knowledge: {},
    unlocks: { parts: ["cloud-photocell"], launchers: [], objectives: [] },
    blurb: "Vanguard 2 measured sunlight reflected by clouds. Opens the weather topic. Fly with healthy margins first."
  },
  {
    id: "solar-physics", name: "Solar X-ray astronomy", year: 1960, cost_musd: 3, cost_sci: 25,
    requires: ["tape-recorder"], requires_lessons: [], requires_knowledge: { radiation: 0.4 },
    unlocks: { parts: ["solar-xray-photometer"], launchers: [], objectives: [] },
    blurb: "What drives the radiation you found? The Sun. SOLRAD 1 saw its X-rays in 1960. Opens the solar topic."
  },
  {
    id: "thor-rockets", name: "Thor-Able rocket", year: 1959, cost_musd: 5, cost_sci: 10,
    requires: ["solar-cells"], requires_lessons: ["all_data"], requires_knowledge: {},
    unlocks: { parts: [], launchers: ["thor-able", "thor-agena"], objectives: [] },
    blurb: "Missiles become launchers: room for 100 kg and more. Prove you can get all your data home first."
  },
  {
    id: "television", name: "Television from orbit", year: 1960, cost_musd: 5, cost_sci: 80,
    requires: ["cloud-photometry", "thor-rockets"], requires_lessons: [], requires_knowledge: { weather: 0.3 },
    unlocks: { parts: ["vidicon-camera", "vhf-telemetry", "drum-body"], launchers: [], objectives: [] },
    blurb: "TIROS-1 sent the first TV pictures of clouds. Needs what your photocells learned about weather."
  },
  {
    id: "three-axis-control", name: "Three-axis control", year: 1964, cost_musd: 5, cost_sci: 120,
    requires: ["television"], requires_lessons: [], requires_knowledge: { weather: 0.4 },
    unlocks: { parts: ["reaction-wheels", "nimbus-bus"], launchers: [], objectives: [] },
    blurb: "TIROS spun, so its cameras saw a tumbling Earth. Nimbus 1 (1964) held steady and pointed straight down."
  },
  {
    id: "integrated-circuits", name: "On-board computers", year: 1965, cost_musd: 6, cost_sci: 150,
    requires: ["television"], requires_lessons: ["storm_survived"], requires_knowledge: { solar: 0.3 },
    unlocks: { parts: ["obc-basic", "obc-radtol", "obc-payload"], launchers: [], objectives: [] },
    blurb: "Integrated circuits put a computer on board. You must understand the Sun's storms to harden it."
  },
  {
    id: "modern-power", name: "Modern solar arrays and batteries", year: 1995, cost_musd: 8, cost_sci: 250,
    requires: ["integrated-circuits", "rechargeable-batteries"], requires_lessons: ["spare"], requires_knowledge: {},
    unlocks: { parts: ["solar-small", "solar-large", "battery-28v", "smallsat-bus"], launchers: [], objectives: [] },
    blurb: "Multi-junction cells and lithium-ion batteries: ten times the power per kilogram. Fly a spare first."
  },
  {
    id: "modern-radio", name: "Digital radios", year: 1990, cost_musd: 7, cost_sci: 200,
    requires: ["integrated-circuits"], requires_lessons: [], requires_knowledge: {},
    unlocks: { parts: ["radio-uhf", "radio-sband", "radio-xband"], launchers: [], objectives: [] },
    blurb: "From a few bits a second to millions: S-band and X-band radios."
  },
  {
    id: "spacecraft-propulsion", name: "Spacecraft thrusters", year: 1998, cost_musd: 6, cost_sci: 250,
    requires: ["modern-power"], requires_lessons: [], requires_knowledge: {},
    unlocks: { parts: ["prop-green-small", "prop-green-large", "prop-ion"], launchers: [], objectives: [] },
    blurb: "Small thrusters to change orbit and come down safely at the end. Deep Space 1 flew the first ion engine in 1998."
  },
  {
    id: "thermal-infrared", name: "Thermal infrared imaging", year: 1999, cost_musd: 10, cost_sci: 300,
    requires: ["modern-power", "television"], requires_lessons: ["three_stars"], requires_knowledge: { weather: 0.5 },
    unlocks: { parts: ["thermal-imager", "optical-camera"], launchers: [], objectives: [] },
    blurb: "Terra's MODIS (1999) watches fires from orbit. Opens the wildfire topic."
  },
  {
    id: "synthetic-aperture-radar", name: "Imaging radar", year: 1978, cost_musd: 12, cost_sci: 350,
    requires: ["modern-power", "modern-radio"], requires_lessons: ["new_topic"], requires_knowledge: { weather: 0.6 },
    unlocks: { parts: ["sar-radar"], launchers: [], objectives: [] },
    blurb: "Seasat (1978) imaged the ocean through cloud and darkness. Opens the sea-ice topic."
  },
  {
    id: "commercial-launch", name: "Commercial small launchers", year: 2018, cost_musd: 8, cost_sci: 250,
    requires: ["modern-radio"], requires_lessons: [], requires_knowledge: {},
    unlocks: { parts: ["cubesat-12u"], launchers: ["rideshare", "small"], objectives: [] },
    blurb: "Rideshares and small dedicated rockets make orbit cheap."
  },
  {
    id: "heavy-lift", name: "Reusable medium-lift rockets", year: 2010, cost_musd: 10, cost_sci: 300,
    requires: ["commercial-launch"], requires_lessons: [], requires_knowledge: {},
    unlocks: { parts: [], launchers: ["heavy"], objectives: [] },
    blurb: "Big rockets that can reach geostationary orbit."
  },
  {
    id: "topside-sounding", name: "Topside sounding (Alouette)", year: 1962, cost_musd: 4, cost_sci: 30,
    requires: ["thor-rockets", "solar-cells"], requires_lessons: ["all_data"], requires_knowledge: {},
    unlocks: { parts: ["topside-sounder"], launchers: [], objectives: [] },
    blurb: "Canada's Defence Research Telecommunications Establishment proposed sounding the ionosphere from above. Alouette 1 flew in 1962. Opens the ionosphere topic."
  }
];
