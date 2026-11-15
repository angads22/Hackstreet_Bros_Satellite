### Scroll depth (page height / viewport height; 1.0 means no scrolling)

| screen | 1920x1080 | 1366x768 | 390x844 |
| --- | --- | --- | --- |
| home | 1 | 1 | 1 |
| part1_build_empty | 1.31 -> 1.23 | 1.77 -> 1.73 | 3.66 -> 2.86 |
| part1_build_full | 1.5 -> 1.02 | 2.04 -> 1.44 | 3.91 -> 2.85 |
| picker | 1 | 1 | 1.16 -> 1.11 |
| workshop | 1.02 -> 1 | 1.43 -> 1.35 | 2.29 -> 2.21 |
| map | 1 | 1.33 -> 1.23 | 1.31 -> 1.13 |
| build_empty | 1.29 -> 1.16 | 1.75 -> 1.63 | 3.47 -> 3.05 |
| build_full | 1.35 -> 1.08 | 1.84 -> 1.46 | 3.09 -> 2.58 |
| rocket | 1 | 1.23 -> 1.16 | 2.17 -> 1.94 |
| readiness | 1.23 -> 1.17 | 1.72 -> 1.64 | 1.96 -> 1.68 |
| mission | 1 | 1 | 1 |
| event | 1 | 1.25 -> 1.15 | 1.61 -> 1.45 |
| debrief | 1.68 -> 1.58 | 2.36 -> 2.22 | 3.37 -> 3.18 |

### Always-visible elements that are NOT on screen without scrolling

| screen | viewport | before | after |
| --- | --- | --- | --- |
| part1_build_empty | 1920x1080 | next button | - |
| part1_build_empty | 1366x768 | part cards, next button | - |
| part1_build_empty | 390x844 | part cards, four bars, next button | part cards, four bars |
| part1_build_full | 1366x768 | part cards, four bars | - |
| part1_build_full | 390x844 | status, part bins, part cards | status, part bins, part cards |
| picker | 390x844 | back | - |
| workshop | 1366x768 | first FLY THIS | - |
| workshop | 390x844 | first FLY THIS | first FLY THIS |
| build_empty | 1920x1080 | science preview, next button | science preview |
| build_empty | 1366x768 | part cards, science preview, next button | science preview |
| build_empty | 390x844 | satellite, part cards, pay line, four bars, science preview, next button | satellite, part cards, pay line, four bars, science preview |
| build_full | 1920x1080 | next button | - |
| build_full | 1366x768 | satellite, next button | satellite |
| build_full | 390x844 | status (cash/debt), part bins, satellite, part cards, pay line | status (cash/debt), part bins, satellite, part cards |
| rocket | 1366x768 | next button | - |
| rocket | 390x844 | next button | - |
| debrief | 1920x1080 | TRY THIS, back/next button | back/next button |
| debrief | 1366x768 | what limited you, TRY THIS, back/next button | what limited you, TRY THIS, back/next button |
| debrief | 390x844 | what limited you, TRY THIS, result / money box, back/next button | verdict stamp, what limited you, TRY THIS, back/next button |

### Task cost (scrolls / clicks / hovers)

| task | 1920x1080 | 1366x768 | 390x844 |
| --- | --- | --- | --- |
| P1 step 1: build the satellite and go on | 1/12/0 -> 0/12/0 | 3/12/0 -> 0/12/0 | 7/12/0 |
| P2: read the contracts and take one | 0/1/0 | 1/1/0 -> 0/1/0 | 2/1/0 |
| P2: build a design and read whether it is good | 3/17/1 -> 1/17/1 | 5/17/1 -> 4/17/1 | 16/17/1 |
| P2: pick the rocket and go on | 0/2/0 | 1/2/0 -> 0/2/0 | 3/2/0 -> 1/2/0 |
| P2: read the readiness verdict and launch | 0/1/0 | 0/1/0 | 0/1/0 |
| P2: answer an event | 0/1/0 | 0/1/0 | 0/1/0 |
| P2: bring the debrief's verdict, limit, advice, money and next button into view | 1/0/0 | 2/0/0 -> 1/0/0 | 3/0/0 -> 2/0/0 |

### Words on screen at scroll 0, and where the first control sits

| screen | 1920x1080 words | 1366x768 words | 390x844 words |
| --- | --- | --- | --- |
| home | 53 | 53 | 53 |
| part1_build_empty | 219 -> 215 | 147 -> 161 | 75 -> 85 |
| part1_build_full | 271 -> 279 | 269 -> 277 | 75 -> 150 |
| picker | 63 | 63 | 61 |
| workshop | 162 | 151 -> 157 | 69 -> 81 |
| map | 92 -> 83 | 79 -> 77 | 58 -> 61 |
| build_empty | 242 -> 253 | 172 -> 198 | 77 -> 78 |
| build_full | 245 -> 262 | 223 -> 257 | 82 |
| rocket | 152 -> 143 | 142 -> 141 | 74 -> 81 |
| readiness | 81 -> 86 | 65 -> 64 | 65 -> 64 |
| mission | 53 -> 48 | 53 -> 48 | 53 -> 48 |
| event | 110 -> 105 | 102 -> 103 | 67 -> 73 |
| debrief | 196 -> 190 | 143 -> 145 | 102 -> 104 |

### Targets under the minimum size (24 px desktop, 44 px touch) and overlaps

| screen | 1920x1080 small targets | 1366x768 small targets | 390x844 small targets | 1920x1080 overlaps | 1366x768 overlaps | 390x844 overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| home | 0 | 0 | 3 | 13 | 13 | 13 |
| part1_build_empty | 0 | 0 | 6 | 0 | 0 | 0 |
| part1_build_full | 0 | 0 | 1 | 0 | 0 | 0 |
| picker | 0 | 0 | 0 | 0 | 0 | 0 |
| workshop | 0 | 0 | 0 | 0 | 0 | 0 |
| map | 0 | 0 | 5 | 5 | 5 | 5 |
| build_empty | 6 -> 0 | 6 -> 0 | 6 | 0 | 0 | 0 |
| build_full | 0 | 0 | 0 | 0 | 0 | 0 |
| rocket | 0 | 0 | 0 | 0 | 0 | 0 |
| readiness | 0 | 0 | 0 | 0 | 0 | 0 |
| mission | 0 | 0 | 0 | 0 | 0 | 0 |
| event | 0 | 0 | 0 | 0 | 0 | 0 |
| debrief | 0 | 0 | 2 -> 0 | 1 | 1 | 2 -> 1 |

Examples of small targets: 1920x1080: summary 22x25; 1366x768: summary 22x25; 390x844: part1-go 97x32; 390x844: part2-go 97x32; 390x844: reset-progress 147x32; 390x844: summary 32x25; 390x844: blip-briefing 32x32; 390x844: blip-orbit 32x32; 390x844: blip-build 32x32; 390x844: blip-launcher 32x32; 390x844: blip-review 32x32; 390x844: summary 22x25

Examples of overlaps (before): 1920x1080 home: lp x big-title; 1920x1080 home: lp x tagline; 1920x1080 home: lp x tag; 1920x1080 home: lp x H2; 1920x1080 map: map-lp x blip-briefing; 1920x1080 map: map-lp x blip-orbit; 1920x1080 map: map-lp x blip-build; 1920x1080 map: map-lp x blip-launcher; 1920x1080 debrief: card-blurb x divided; 1366x768 home: lp x big-title

### Hover, focus and tap behaviour on Build

| check | 1920x1080 | 1366x768 | 390x844 |
| --- | --- | --- | --- |
| hover opens the preview | true | true | n/a (touch) |
| keyboard focus opens it | true | true | n/a |
| first tap previews, does not add | n/a | n/a | false -> true |
| preview fully on screen (while hovering a card) | true | true | true |
| preview share of the viewport height | 0.3 | 0.36 | 0.23 |
| card the player is acting on is covered at the pointer | false | false | false |
| "Why" opens by keyboard | true | true | true |
| "?" opens by keyboard | true | true | true |
| layout shift while hovering and clicking (CLS) | 0 | 0 | 0 |
| title-only tooltips (no keyboard or tap) | 2 data-badge:Using the saved NASA dat | 2 data-badge:Using the saved NASA dat | 2 data-badge:Using the saved NASA dat |

### axe-core violations at 1366x768 (id: nodes)

| screen | before | after |
| --- | --- | --- |
| home | none | none |
| part1_build_empty | label-content-name-mismatch(s):2, region(m):1 | label-content-name-mismatch(s):2, region(m):1 |
| part1_build_full | label-content-name-mismatch(s):2, region(m):1, scrollable-region-focusable(s):1 | label-content-name-mismatch(s):2, region(m):1, scrollable-region-focusable(s):1 |
| picker | none | none |
| workshop | none | none |
| map | label-content-name-mismatch(s):5 | label-content-name-mismatch(s):5 |
| build_empty | label-content-name-mismatch(s):2 | label-content-name-mismatch(s):2 |
| build_full | label-content-name-mismatch(s):2 | label-content-name-mismatch(s):2 |
| rocket | heading-order(m):1, label-content-name-mismatch(s):2 | heading-order(m):1, label-content-name-mismatch(s):2 |
| readiness | label-content-name-mismatch(s):2 | label-content-name-mismatch(s):2 |
| mission | none | none |
| event | none | none |
| debrief | none | none |

Page errors: 0, 0, 0
