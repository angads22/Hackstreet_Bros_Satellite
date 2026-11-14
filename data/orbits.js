// data/orbits.js — owned by Data (yarmee).
//
// altitude_km: textbook values. 35,786 km is the altitude where the orbital
//   period equals one sidereal day (check it with formula 2 in SPEC.md).
// downlink_mult: share of the day in contact with the ground. ESTIMATES from
//   geometry, assuming one ground station:
//     LEO, mid-latitude station: about 4 passes of about 9 min a day, so 36 / 1440 = 0.025
//     SSO, polar station (such as Svalbard): about 10 passes of about 10 min, so 100 / 1440 = 0.07
//     GEO: always in view, so 1.0
// dv_needed_ms: the speed change the spacecraft must supply itself.
//   ROUGH PLACEHOLDERS, as SPEC.md allows:
//     LEO 500 km: none, because drag brings the satellite down within a few years
//     SSO 700 km: about 80 m/s to lower perigee to about 400 km so it re-enters within 5 years
//     GEO: about 50 m/s a year of station-keeping for 5 years, plus about 10 m/s to the graveyard orbit
// science_mult and lifetime_months: GAME VALUES.

const ORBITS = [
  {
    id: "leo",
    name: "Low Earth orbit",
    science_mult: 1.0,
    downlink_mult: 0.025,
    lifetime_months: 36,      // GAME VALUE: drag brings a 500 km smallsat down in a few years
    blurb: "Close and sharp, and the cheapest to reach. Short ground passes, and it never flies over the poles.",
    altitude_km: 500,
    dv_needed_ms: 0
  },
  {
    id: "sso",
    name: "Sun-synchronous polar orbit",
    science_mult: 0.9,
    downlink_mult: 0.07,
    lifetime_months: 48,
    blurb: "Passes over every part of Earth, poles included, at the same local time each day. Since 1995 you must also bring fuel to come down at the end.",
    altitude_km: 700,
    dv_needed_ms: 80
  },
  {
    id: "geo",
    name: "Geostationary orbit",
    science_mult: 0.4,
    downlink_mult: 1.0,
    lifetime_months: 60,
    blurb: "Hovers over one spot, always in contact, always watching. But it is 70 times farther away than low orbit, so details blur.",
    altitude_km: 35786,
    dv_needed_ms: 260
  }
];
