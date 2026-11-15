# GRAVITRON: every feature, for the slideshow

One line per feature, grouped by what a viewer sees. Numbers are from the code on November 15, 2026 (41 parts, 7 rockets, 3 orbits, 6 mission topics, 22 events, 17 research boxes, 14 real missions, 3 levels, 4 eras). A tag says where each one stands: **In** (on the page you play), **Back end** (written and tested, not on a screen), **Planned** (not built). Items from the real-world plan are at the end and are all **Planned**.

## The game in one breath

Design a satellite, pick a rocket, pass a readiness review, watch the mission month by month on real NASA data, read why it did what it did, and try again. Plain HTML, CSS and JavaScript, no framework, works offline, runs on a laptop or a phone.

## Two modes

- **Part 1, Austin's first satellite (1958).** Three guided steps, a story, stars and an epilogue. *In*
- **Part 2, Ajay's comeback.** Pay back a debt before a deadline by flying satellites for paying customers. Easy, Normal and Hard set the cash, the debt and the deadline (JPL's Initial Feasibility, Trade Space, Point Design). *In*

## The story

- **A dramatic opening:** October 1957, a workshop hears Sputnik, one launch window. *In*
- **Story scenes between flights** (the lenders, his mum who co-signed, the rival Iron Eclipse, Austin's last notebook page, a last push). *In*
- **A choice:** Iron Eclipse offers to clear the debt for the workshop, the patents and Austin's notebook. SELL or REFUSE. *In*
- **Seven endings** counted on the home page. *In*
- **Loans, credit and a name:** borrow more cash (with a fee), credit sets the interest and the loan cap, lenders seize at low credit, and to win you also need a reputation. *In (merged today; see the changelog)*
- **Calls for proposals:** customers ask for something specific. *In*

## Build a satellite

- **41 real parts in seven bins:** body, attitude control, instruments, power, radio, computer, extras. *In*
- **A 3D bench:** the satellite is a low-poly model of the parts you fit; a part you add flies in, one you remove slides out. *In*
- **An animated explainer for every part:** a looping drawing, a hook line, what it does, its catch. *In*
- **Live resource bars:** mass, power, budget and data. *In*
- **A science forecast and pay line** before you commit. *In*
- **Part 1 offers 1958 parts only**, so each lesson is the one you meet. *In*
- **Part build time:** each part has `build_months`; the satellite's development time is the longest part plus integration, and it costs months on the clock. *In*

## Pick a rocket and an orbit

- **7 real launchers** with real payload and cost; a rocket can be too small for the satellite. *In*
- **3 orbits** (low Earth, sun-synchronous polar, geostationary) with real consequences: eclipse, drag, how much of the world you see. *In*
- **Debris rule** from 1995: disposal fuel for polar and low orbits. *In*

## Readiness review

- **Eight real formulas:** rocket equation, orbital period, solar power, eclipse, battery size, image resolution, data budget, margins. *In*
- **Blockers and warnings** in plain words, each with a FIX link on Easy. *In*
- **READY or HOLD** and the months it takes to build. *In*

## The mission

- **Month by month on real data:** NASA FIRMS fires (2025), NSIDC sea-ice extent, SILSO sunspot numbers, and the Alouette 1 ionosphere soundings from the CSA. *In*
- **22 events** (some dangers, some chances) that stop the clock and ask you to choose; each choice shows what it costs. *In*
- **A launch that ends in orbit:** a 5-to-0 countdown, ignition, a climb, a stage falling away, then your own satellite deployed. *In*
- **Pause and fast-forward.** *In*

## The debrief

- **Five-part score and 1 to 3 stars** against a science target. *In*
- **The one thing that limited you,** named by the NASA Mission Design Lab discipline (Communications limited this mission). *In*
- **TRY THIS:** one change the design can really use. *In*
- **Four segment lines:** launch, space, ground and user. *In*
- **The closest of 14 real missions** and a comparison with what they measured. *In*
- **A "right now" line** from live NOAA, NASA EONET and CWFIS data when the internet is there. *In*
- **A result moment:** stars land one by one, a PAID or PASSED stamp slams in. *In*

## Difficulty and help

- **Three levels with a help ladder:** Easy shows every hint; Normal drops the hover Fixes and Causes lines and FIX links; Hard also drops the science and pay forecasts and shows event risks as bands. Facts and after-the-fact advice stay at every level. *In (branch, now in the merge)*
- **A help line on each level card** so the player knows what they are choosing. *In*

## Look, sound of the page, and access

- **A console-style home page** with a low-poly Earth and satellite. *In*
- **A rustic 1958 look for Part 1** and a clean modern look for Part 2. *In*
- **Animated text and screens**, all off under reduced motion. *In*
- **Pixel digits (VT323)** so a 5 never reads as an S. *In*
- **A base map** as the way between screens: walk with arrows or WASD, or click. *In*
- **Phone to desktop,** keyboard and touch. *In*
- **A density pass:** shorter header, one instruction per screen, a next button that stays on screen, bigger touch targets on phones. *In (this branch)*
- **Accessibility fixes** for the map and hint box found by axe-core. *In (this branch)*

## Data, honesty and saves

- **Live data badge** (LIVE DATA, PARTLY LIVE, SNAPSHOT) and an offline snapshot, so it always works. *In*
- **Save codes** you can export and import, and saves that upgrade in place. *In*
- **SOURCES.md** lists every number's source. *In (documents)*
- **Tests:** formula, simulation, campaign, balance, saves, migration, speed, plus about 25 browser suites. *In (repo)*
- **A measured UI review** (`docs/ui-review.md`) with a re-runnable measuring harness (`docs/ui-measure`). *In (docs)*

## Built, not on screen

- **The 1957 campaign:** treasury, research tree, upgrades, the archive that keeps paying, a lab screen, eras (1958, 1964, 1999, 2026). *Back end*
- **Era grid and the three levels as a separate choice.** *Back end*

## Planned, from the satellite engineers (`docs/real-world-plan.md`)

- **Show the long pole:** name the part that sets the schedule and what swapping it saves. *Planned (no new data)*
- **Lead time per part**, separate from build time. *Planned (needs a data field)*
- **Work back from the launch date:** order-by dates and a missed slot. *Planned*
- **Expedite or choose a second source.** *Planned*
- **Test blocks and schedule margin.** *Planned*
- **Mass and cost growth, flight heritage, licences.** *Planned*
- **Launch failures.** *Planned*
- **Suppliers, countries and travel** (proposal in `SPEC.md`). *Planned, not agreed*
