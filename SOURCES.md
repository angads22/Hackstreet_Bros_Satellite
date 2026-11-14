# Sources

One row per resource used. QA copies this into the project page.
"Checked" means a team member opened the page and confirmed the numbers. Every row starts unchecked.

| Name | Agency / publisher | Link | Used in | Checked |
| --- | --- | --- | --- | --- |
| CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers | NASA | https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf | Spacecraft scale (smallsat = under 300 kg, PDF p.12); 10% budget reserve (PDF p.21) supports the 10% margin warning | No |
| Small Spacecraft Technology State of the Art, 2025 edition | NASA | https://www.nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf | `data/parts.js`: solar panels (p.48, p.50), battery (p.61), computers (p.260), radios and antennas (p.289, 290, 294, 296, 298), propulsion (p.127, p.133) | No |
| ICEYE constellation (eoPortal) | ESA eoPortal | https://www.eoportal.org/satellite-missions/iceye-constellation | `data/parts.js`: radar mass, frequency, antenna size | No |
| PlanetScope (eoPortal) | ESA eoPortal | https://www.eoportal.org/satellite-missions/planetscope | `data/parts.js`: optical camera aperture | No |
| OroraTech vendor page (CSDA) | NASA | https://science.nasa.gov/earth-science/csda/vendor-ororatech/ | `data/parts.js`: thermal imager; `data/objectives.js`: wildfire story (outside source, not on the official list) | No |
| Rocket Lab (eoPortal) | ESA eoPortal | https://www.eoportal.org/other-space-activities/rocket-lab | `data/launchers.js`: small launcher | No |
| SpaceX rideshare pricing, Feb 2026 | NewSpace Economy (third party) | https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/ | `data/launchers.js`: rideshare | No |
| Falcon 9 | SpaceX | https://www.spacex.com/vehicles/falcon-9/ | `data/launchers.js`: medium-lift rocket | No |
| RADARSAT Constellation Mission | CSA | https://www.asc-csa.gc.ca/eng/satellites/radarsat/ | `data/objectives.js`: sea-ice real mission (outside source) | No |
| GOES-R series | NOAA / NASA | https://www.goes-r.gov/ | `data/objectives.js`: wildfire real mission and 2 km resolution need (outside source) | No |
| NASA FIRMS, MODIS active-fire detections, all countries, 2025 | NASA | https://firms.modaps.eosdis.nasa.gov/country/ | `data/earth.js`: monthly fire counts, share of fires each orbit can see (built by `tools/earth_data.py`) | Downloaded and processed |
| NSIDC Sea Ice Index, version 4 (G02135), Arctic monthly extent | NSIDC (NASA DAAC) / NOAA | https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/ | `data/earth.js`: 2025 monthly extent and 1981-2010 average | Downloaded and processed |
| NSSDCA Master Catalog: Vanguard 2 (1959-001A) and TIROS 1 (1960-002B) | NASA | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1959-001A and ?id=1960-002B | `data/parts.js` era parts (photocells, vidicon cameras, silicon cells, NiCd batteries, 235 MHz link), `data/launchers.js` (Vanguard, Thor-Able) | Opened by the AI; NEEDS HUMAN CHECK |
| Explorer 1 overview | NASA | https://www.nasa.gov/history/explorer-1-overview/ | `data/parts.js` (Geiger counter package), `data/launchers.js` (Juno I), `data/objectives.js` (radiation topic) | Opened by the AI; NEEDS HUMAN CHECK |
| SILSO monthly mean total sunspot number, version 2 | Royal Observatory of Belgium (CC BY-NC 4.0) | https://www.sidc.be/SILSO/datafiles | `data/earth.js` solar entry (1957-2025), drives the solar topic and solar-storm odds (built by `tools/earth_data.py`) | Downloaded and processed |
| Solar cycle indices (observed monthly sunspot number, SILSO v2) | NOAA Space Weather Prediction Center | https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json | `js/live-data.js`: live refresh of the sunspot table up to last month | Called live; checked against the SILSO file (same values) |
| EONET, Earth Observatory Natural Event Tracker (wildfires, sea and lake ice) | NASA | https://eonet.gsfc.nasa.gov/api/v3/events | `js/live-data.js`: "right now" lines in the debrief | Called live |
| Canadian Wildland Fire Information System, satellite hotspots in the last 24 hours | Natural Resources Canada (from NASA MODIS and VIIRS) | https://cwfis.cfs.nrcan.gc.ca/ | `js/live-data.js`: "right now" fire-detection count in the debrief | Called live |
| Explorer 1, Vanguard 1 and Sputnik 1 figures (mass, batteries, transmitters, operating days) | Secondary sources found by web search | see `data/parts.js` source fields | Era battery and beacon parts | NEEDS HUMAN CHECK against NSSDCA |
| Real missions for the debrief comparison (Explorer 1 and 3, Vanguard 2, TIROS-1, SOLRAD 1, SDO, GOES-R, Terra, FOREST, PlanetScope, Seasat, RADARSAT Constellation, ICEYE) | NASA, NOAA, CSA, Planet, ICEYE, OroraTech | see the `source` field of each record in `data/missions.js` | Debrief "your design's real twin" | NEEDS HUMAN CHECK (masses marked) |

## Tools and other resources

The submission form's References field must list every external resource, including code, text, images and data, even if open source. Paste this file into that field.

| Name | Type | Link | Used for |
| --- | --- | --- | --- |
| Claude (Anthropic), via Claude Code | AI assistant | https://claude.ai/code | Drafting data files, game logic (`js/game.js`, `js/mission.js`), tests and spec text. Sourced numbers cite their page; the rest are labelled ESTIMATE or GAME VALUE in the data files |
| NASA Space Apps 2026 Judging & Awards Guide | Rules | https://www.spaceappschallenge.org | Judging criteria and submission requirements (SPEC.md, "How we are judged") |
| A Learning Game About Telescopes | NASA | https://science.nasa.gov/mission/webb/game-build-it-yourself/ | Design reference only; no code or art reused |
| Digital Games and Activities | CSA | https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp | Tone and style reference only |

No third-party code libraries, fonts, images or music are used. Teammates add any other AI tools they used (QA keeps the record).
