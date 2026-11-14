// data/earth.js — owned by Data (yarmee). Real NASA observations of Earth that
// drive the mission month by month. Keyed by objective id.
// Rebuild with tools/earth_data.py (instructions inside).

const EARTH = {
  start_month: 0,   // missions start in January (0 = Jan ... 11 = Dec)

  wildfire: {
    source: "NASA FIRMS, MODIS (Terra and Aqua) active-fire detections, all countries, 2025. https://firms.modaps.eosdis.nasa.gov/country/",
    year: 2025,
    detections: 3693555,
    // Share of the year's detections in each month, Jan..Dec. Peak: August.
    monthly_share: [0.0947, 0.0685, 0.0782, 0.0562, 0.0600, 0.0713, 0.1144, 0.1509, 0.1076, 0.0859, 0.0579, 0.0546],
    // Share of the year's detections each orbit can see at all.
    //   leo: fires at or below 50 degrees latitude (a 500 km orbit at about 45 degrees inclination)
    //   sso: every latitude
    //   geo: fires within 70 degrees of arc of 0 degrees longitude, Meteosat's slot over Africa and Europe
    //        (for comparison, GOES-East over the Americas would see only 23.9%)
    orbit_view: { leo: 0.921, sso: 1.0, geo: 0.687 },
    boreal_share: 0.079,   // fires north or south of 50 degrees, mostly May to August
    geo_longitude: 0
  },

  "sea-ice": {
    source: "NSIDC Sea Ice Index, version 4 (G02135), Arctic monthly extent. https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/",
    year: 2025,
    // Arctic sea-ice extent, million km2, Jan..Dec 2025, and the 1981-2010 average for each month.
    extent_mkm2:           [13.11, 13.75, 14.12, 13.83, 12.49, 10.40, 7.66, 5.39, 4.75, 6.32, 8.77, 11.22],
    extent_1981_2010_mkm2: [14.42, 15.30, 15.43, 14.69, 13.29, 11.76, 9.47, 7.20, 6.41, 8.35, 10.70, 12.84],
    // Share of each day the Sun is above the horizon at 75 degrees north, mid-month.
    // Physics, not data: from the Sun's declination. 0 = polar night.
    daylight_share: [0.0, 0.16, 0.44, 0.71, 1.0, 1.0, 1.0, 0.87, 0.55, 0.28, 0.0, 0.0]
  }
};
