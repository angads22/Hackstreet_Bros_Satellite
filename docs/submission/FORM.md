# GRAVITRON 2.1: the words for the NASA Space Apps project form

One section per form field, in the form's order. Copy the text inside each box and paste it into the field.
Everything here was checked against the repository for version 2.1 (see `CHECKLIST.md` for how, and for what a person must still do).

- Text in square brackets that starts with `TEAM:` is a blank only a person can fill. Search this file for `[TEAM` before you submit: none may be left in the form.
- The form's field names follow `SPEC.md` ("Submission checklist"): eight fields. If the live form splits or renames one, the section says what to paste where.
- Field length limits are not known (`SPEC.md` says so; `deck/briefs.md` notes 50 to 200 words for the summary). The summary below is 98 words and the description 622.

## 1. Project Name

```text
GRAVITRON: The Gravitronical Odyssey
```

## 2. High-Level Project Summary

```text
GRAVITRON is a browser game for the challenge Space Mission Design Game. You pick a job for a satellite, choose an orbit, parts and a rocket, pass a readiness review, fly the mission month by month and read a debrief that names what limited it. The simulation runs on real records: NASA FIRMS fire detections, the NSIDC Sea Ice Index, sunspot numbers and the Canadian Space Agency's Alouette soundings. Three modes: a guided 1958 story, a comeback against a debt, and one quick flight. It teaches that spacecraft design is a chain of trade-offs, and it plays offline.
```

## 3. Link to Project Demo

A deck of at most 7 slides, or a video of 30 seconds or less. A public link that opens with no login (test it in a private window).

```text
[TEAM: the public link to the 7-slide deck or the 30-second video]
```

## 4. Link to Final Project

The hosted game if there is one (judges can play at once), otherwise the repository. If the form takes one link, use the hosted game and name the repository in the description's last line.

```text
[TEAM: the public address of the hosted game]
```

The repository, as the git remote of this project has it (check that it is public):

```text
https://github.com/angads22/Hackstreet_Bros_Satellite
```

## 5. Detailed Project Description

The headings in capitals are plain text, so they survive a field with no formatting. Each of the five judging criteria has its own heading.

```text
WHAT IT DOES
GRAVITRON is a game about designing a satellite mission under hard limits. Every flight is one loop: pick a science job, one of three orbits, parts (41 in seven groups) and one of seven rockets; pass a go or no-go review; fly month by month through events that ask for a decision; read a debrief that names the one thing that limited the flight and one change to try.

Three modes. Part 1 is a guided 1958 walkthrough: Austin Albert builds a first satellite in three steps. Part 2 is his grandson Ajay's comeback: fly contracts to clear a debt before a deadline, with loans, a credit score from 300 to 850, rockets that can fail, a buyout offer and seven endings. Quick mode is one scored flight. Easy, Normal and Hard hide answers, never facts; on Normal and Hard the player pays engineers for information about a part.

HOW IT WORKS
Eight formulas (rocket equation, orbital period, solar power, eclipse, battery size, image resolution, data budget, margins) decide whether a design can fly. The mission then runs month by month on the real records listed under NASA Data. It is one web page: no install, no account. It plays offline from a data snapshot stored in the game; online, three public feeds add a "right now" line to the debrief.

BENEFITS (IMPACT)
Anyone with a browser can learn why a spacecraft is a chain of trade-offs: each part fixes one problem and creates the next. The debrief ties the result to a real problem, such as wildfire or Arctic sea ice, and to one of 14 real missions.

WHAT IS NEW (CREATIVITY)
History is part of the game: Part 1 flies the parts and rockets of 1958. In Part 2 money is the teacher: margins become cash, interest and a deadline. Two satellite engineers who visited our table said the slowest part sets the schedule, so the game names it (the long pole) and shows every part's lead time. All pictures are drawn by code and all sound is made in the browser.

WHY IT IS SOUND (VALIDITY)
Part figures come from NASA's Small Spacecraft Technology State of the Art report, CubeSat 101 and NSSDCA records; the rest is labelled ESTIMATE or GAME VALUE in the data files. Prices, interest, the credit score and lead times are game values. A fire detection is one hot pixel, not one fire. More than 900 automated checks pass, among them hand-worked tests of the eight formulas.

NASA DATA AT THE CORE (RELEVANCE)
The data is the simulation, not decoration. The NASA FIRMS files for 2025 hold 3,693,555 MODIS fire detections; a low orbit can see 92% of them, a polar orbit all, one geostationary slot 69%. The sea-ice debrief uses the NSIDC Sea Ice Index: 4.75 million square kilometres in September 2025, 26% below the 1981 to 2010 average. SILSO sunspot numbers and the Canadian Space Agency's Alouette-1 soundings drive two more topics.

THE STORY (PRESENTATION)
A notebook ties the modes together: Austin writes it in 1958, Ajay opens it decades later. Screens carry few words and the debrief leads with the verdict.

WHAT WE HOPE TO ACHIEVE
Players who can say why a mission worked or failed. Next: host the server for the global leaderboard and the 1v1 duel. Both are built and tested, but the server is not hosted, so they are off in this submission and whenever the game is run locally.

TOOLS AND LANGUAGES
HTML, CSS and JavaScript, no framework, no build step (Canvas, Web Audio API, browser storage); Node.js for the tests and the optional server; Python for the script that builds the data snapshot; Git and GitHub; an SI coding assistant (see Use of SI).
```

## 6. Use of Super Intelligence (SI)

`SI_USE.md` is the team's record, but it stops on November 15 and lists the screens only, so this text is written from everything the repository shows the SI made. Read the three `TEAM:` blanks: only a person knows the answer.

```text
We used SI heavily and disclose all of it here.

Tool: Claude Code (Anthropic), an SI coding assistant, with the models Claude Opus 5.5 and Claude Fable 5.2, and Claude Haiku 5.5 for sub-tasks. [TEAM: name any other SI tool a teammate used, or delete this bracket]

What the SI made, under the team's direction and review:

1. Code. Most of the game's code: the screens (HTML, CSS and JavaScript), the rules and the simulation, the automated tests, the optional leaderboard and duel server, and the script that builds the data snapshot.

2. Data files. The SI drafted the data files from the sources we list. A number taken from a source names its page; every other number is labelled ESTIMATE or GAME VALUE in the file.

3. Words. The SI drafted or shortened much of the text on screen, the event and debrief lines, and the project documents: the specification, the changelog and the text of this project page. [TEAM: say who wrote the story of Austin and Ajay. The repository records that the team gave the story and the SI put it into the screens]

4. Pictures. No SI image generator was used. Every picture in the game (the satellite, the base, the Earth, the people, the title lettering) is drawn in the browser by JavaScript that the SI wrote. The game contains no image file.

5. Music and sound. No SI music or voice generator was used. All sound is synthesised in the browser by code that the SI wrote; there is no recording and no sample.

6. Research. The SI read sources and proposed figures. Our SOURCES.md file records, row by row, whether a team member opened the page and checked the numbers.

7. Slide deck. The SI built the slide deck from screenshots of the game and facts in the repository, and the team reviewed it.

What people did: chose the challenge and the idea, drew the design mock-up, set the direction of the story, decided the rules and approved every data field, talked with the two satellite engineers who visited our table, checked sources, played the builds and asked for changes. [TEAM: confirm this list and correct it]

NASA branding: no NASA logo, insignia or mission patch appears in the game, and none is placed on anything the SI made.
```

## 7. NASA Data

NASA data and resources, each with how it is used. One entry per line.

```text
NASA FIRMS (Fire Information for Resource Management System), MODIS active-fire detections from Terra and Aqua, all countries, 2025. https://firms.modaps.eosdis.nasa.gov/country/ How used: we downloaded the 2025 files (3,693,555 detections) and reduced them to the share of detections in each month and the share each orbit can see. These numbers drive the wildfire topic and its debrief. A detection is one hot pixel on one pass, not one fire.

NSIDC Sea Ice Index, version 4 (G02135), Arctic monthly extent. NSIDC is a NASA data centre (DAAC); the index is published with NOAA. https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/ How used: the 2025 monthly extent and the 1981 to 2010 average are stored in the game and used by the sea-ice topic and its debrief.

NASA Small Spacecraft Technology State of the Art report. https://www.nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf How used: the figures for the modern parts (solar panels, battery, computers, radios and antennas, propulsion).

NASA CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers (from the challenge's Resources tab). https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf How used: the scale of a small spacecraft and the 10% budget reserve behind the game's margin warning.

NASA NSSDCA Master Catalog: Vanguard 2, TIROS 1, Explorer 4, OSO 1, Nimbus 1 and OGO 1. https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1959-001A (and the other ids). How used: the parts and rockets of the early years (photocells, vidicon cameras, silicon cells, batteries, radio links).

NASA, Explorer 1 overview. https://www.nasa.gov/history/explorer-1-overview/ How used: the Geiger counter part, the Juno I rocket and the radiation topic.

NASA EONET (Earth Observatory Natural Event Tracker). https://eonet.gsfc.nasa.gov/api/v3/events How used: when the player is online, open wildfire and sea-ice events give the debrief a "right now" line. Offline, the game plays from its stored snapshot.

NASA Commercial SmallSat Data Acquisition (CSDA), OroraTech vendor page. https://science.nasa.gov/earth-science/csda/vendor-ororatech/ How used: the thermal imager part and the wildfire story.

GOES-R series (NOAA and NASA). https://www.goes-r.gov/ How used: the real mission named for the wildfire topic and its 2 km resolution need.

NASA Safety Standard 1740.14 (1995), orbital debris guidelines. https://orbitaldebris.jsc.nasa.gov/ How used: in the game, polar orbits need disposal fuel only from 1995.

NASA mission records for the debrief's real-mission comparison (Explorer 1 and 3, Vanguard 2, TIROS-1, SOLRAD 1, SDO, GOES-R, Terra, Seasat). Each record in the game names its source. How used: the debrief compares the player's design with a real mission.

From the challenge's Resources tab, used as references and not as data: Design and Develop Science Missions (NASA), whose four mission segments (launch, space, ground, user) label the debrief. https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf Mission Design Lab (NASA Goddard), whose discipline names label what limited a flight. https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/ Concept Maturity Levels (NASA JPL), which name the three levels Initial Feasibility, Trade Space and Point Design. https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299 A Learning Game About Telescopes (NASA), a design reference only; no code or art was reused. https://science.nasa.gov/mission/webb/game-build-it-yourself/
```

## 8. Space Agency Partner Data and Other References

If the form has one field, paste both boxes, one after the other. If it has a separate References field, the second box goes there.

Space agency partner data and other data:

```text
Canadian Space Agency (CSA), Alouette-1 ionogram data extraction (699,369 soundings, 33 ground stations, 1962 to 1973), CSA Open Data. https://donnees-data.asc-csa.gc.ca/users/OpenData_DonneesOuvertes/pub/Alouette-ISIS/Alouette-1/ and https://github.com/asc-csa/Alouette_extract How used: reduced to the stations a low orbit can reach, the season and the debrief comparison; it drives the ionosphere topic.

CSA, Alouette 1 and 2. https://www.asc-csa.gc.ca/eng/satellites/alouette.asp How used: the topside sounder parts and their real missions (masses are estimates).

CSA, RADARSAT Constellation Mission. https://www.asc-csa.gc.ca/eng/satellites/radarsat/ How used: the real mission named for the sea-ice topic.

CSA, Digital Games and Activities. https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp How used: tone and style reference only.

SILSO, Royal Observatory of Belgium, monthly mean total sunspot number, version 2 (CC BY-NC 4.0). https://www.sidc.be/SILSO/datafiles How used: the monthly numbers from 1957 to 2025 drive the solar topic and the odds of a solar storm.

NOAA Space Weather Prediction Center, observed solar cycle indices. https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json How used: when online, refreshes the sunspot table up to last month.

Natural Resources Canada, Canadian Wildland Fire Information System, satellite hotspots in the last 24 hours (from NASA MODIS and VIIRS). https://cwfis.cfs.nrcan.gc.ca/ How used: when online, a "right now" count of fire detections in the debrief.

ESA eoPortal: ICEYE constellation, PlanetScope and Rocket Lab. https://www.eoportal.org/satellite-missions/iceye-constellation https://www.eoportal.org/satellite-missions/planetscope https://www.eoportal.org/other-space-activities/rocket-lab How used: the radar part, the optical camera's aperture and the small launcher.

Two satellite engineers who visited our table (spoken, not published). How used: the lead time of each part and the idea that the slowest part sets the schedule. The lead times in the game are game values rounded from what they said.
```

Other references (every other outside resource: text, fonts, tools):

```text
SpaceX, Falcon 9. https://www.spacex.com/vehicles/falcon-9/ Used for the medium-lift rocket.

NewSpace Economy, SpaceX rideshare pricing, February 2026 (third party). https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/ Used for the rideshare rocket.

Secondary sources named in the source field of each part in data/parts.js: Starfish Prime (1962) damage to satellite solar cells and n-on-p cells; Explorer 1, Vanguard 1 and Sputnik 1 figures (mass, batteries, transmitters, operating days), checked against NSSDCA.

Mission pages of Planet, ICEYE and OroraTech, named in the source field of each record in data/missions.js. Used for the debrief's real-mission comparison.

Sputnik 1 (it orbited in October 1957 and its radio beeps were heard around the world). [TEAM: the link to the NASA history page that was opened] Used for the opening lines of Part 1. Voss, Austin, Ajay, Priya, Mara and Iron Eclipse are invented.

Fonts: Pixelify Sans, VT323, Courier Prime, Special Elite and Stardos Stencil, Google Fonts families as packaged by Fontsource, version 5.3.0. SIL Open Font License 1.1, except Special Elite (Apache License 2.0). https://fonts.google.com/ and https://fontsource.org/ The font files are stored in the game.

Music and sound: made for this game and synthesised in the browser with the Web Audio API. No recording, sample or library is used.

Claude Code (Anthropic), an SI coding assistant. https://claude.ai/code Used as described under Use of SI.

Node.js (tests and the optional server) and Python (the script that builds the data snapshot).

NASA Space Apps 2026 Judging and Awards Guide and Project Submission Guide. https://www.spaceappschallenge.org Used for the judging criteria and the submission rules.

No third-party code library, image, recorded music or recorded sound is used in the game.
```

## Suggested tags (only if the form asks for them)

```text
game, education, satellite, mission design, earth observation, wildfire, sea ice, open data, browser, javascript
```
