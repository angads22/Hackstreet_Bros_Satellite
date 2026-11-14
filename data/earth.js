// data/earth.js — owned by Data (yarmee). Real NASA observations of Earth that
// drive the mission month by month. Keyed by objective id. The solar entry holds
// real 1957-1990 sunspot numbers from SILSO, another agency's data, cited below.
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

  solar: {
    source: "SILSO, Royal Observatory of Belgium: monthly mean total sunspot number, version 2 (CC BY-NC 4.0). https://www.sidc.be/SILSO/datafiles",
    // Real monthly sunspot numbers, Jan..Dec, one row per year from 1957. They drive the
    // solar-activity topic and how often solar storms strike in each campaign year.
    // 1957-58 was the strongest solar maximum on record; 1964 the quietest year of the decade.
    sunspots: {
      start_year: 1957,
      monthly: [
        [233.7, 184.5, 222.8, 248.0, 233.0, 284.3, 265.1, 223.7, 334.0, 359.4, 298.6, 339.0],   // 1957
        [286.7, 233.6, 270.0, 277.6, 248.2, 242.9, 271.0, 283.5, 285.1, 256.9, 215.6, 265.7],   // 1958
        [307.7, 202.6, 263.0, 231.3, 243.6, 238.9, 211.9, 282.6, 205.6, 157.7, 175.6, 177.1],   // 1959
        [207.2, 149.9, 144.6, 172.7, 169.3, 156.0, 172.4, 190.0, 180.1, 117.3, 126.9, 121.2],   // 1960
        [82.1, 65.4, 75.2, 86.9, 72.3, 109.5, 99.3, 79.2, 90.1, 53.7, 46.5, 56.9],   // 1961
        [55.1, 71.7, 64.9, 65.9, 61.9, 59.6, 31.4, 31.5, 72.7, 56.1, 38.8, 33.2],   // 1962
        [28.7, 35.2, 24.8, 41.7, 61.1, 51.2, 28.7, 47.5, 55.2, 50.1, 33.7, 21.6],   // 1963
        [22.6, 25.3, 24.1, 12.9, 14.3, 13.5, 4.8, 13.8, 7.0, 9.2, 11.1, 22.1],   // 1964
        [25.4, 20.8, 17.5, 10.2, 34.5, 23.3, 17.3, 13.3, 24.5, 29.1, 22.8, 24.7],   // 1965
        [40.3, 35.3, 36.4, 69.0, 64.2, 67.7, 80.2, 72.6, 71.1, 81.2, 81.0, 99.8],   // 1966
        [157.0, 132.6, 158.3, 98.4, 122.5, 95.4, 129.5, 151.8, 108.7, 125.0, 133.6, 179.0],   // 1967
        [172.5, 158.5, 130.5, 115.0, 180.0, 156.2, 136.2, 154.8, 166.0, 152.5, 121.7, 155.5],   // 1968
        [147.8, 170.5, 192.3, 151.1, 169.9, 150.1, 137.1, 138.8, 129.3, 135.4, 132.4, 138.6],   // 1969
        [157.9, 180.8, 145.7, 155.1, 180.5, 151.3, 159.3, 131.7, 140.8, 122.6, 134.8, 118.2],   // 1970
        [129.2, 111.8, 85.9, 101.6, 81.5, 70.7, 114.7, 87.0, 71.3, 73.4, 89.5, 116.5],   // 1971
        [87.0, 125.3, 113.5, 89.6, 113.9, 124.7, 108.3, 108.9, 90.7, 86.9, 59.2, 64.3],   // 1972
        [61.8, 60.9, 65.4, 81.8, 60.3, 56.1, 33.2, 36.6, 84.1, 43.7, 34.3, 33.3],   // 1973
        [39.4, 37.3, 30.9, 57.5, 56.3, 51.5, 79.1, 47.9, 57.2, 67.2, 35.9, 29.6],   // 1974
        [27.3, 16.7, 16.9, 7.7, 13.1, 16.7, 40.4, 56.7, 20.3, 13.6, 27.9, 11.6],   // 1975
        [11.9, 6.4, 31.5, 27.3, 18.2, 17.9, 2.9, 24.1, 20.0, 29.7, 7.9, 22.3],   // 1976
        [23.8, 33.3, 13.0, 19.0, 27.0, 54.9, 30.6, 43.0, 62.4, 62.1, 41.6, 61.4],   // 1977
        [73.7, 132.6, 108.4, 141.2, 117.1, 134.6, 99.7, 82.4, 195.7, 177.1, 138.5, 173.9],   // 1978
        [235.9, 194.7, 195.3, 143.7, 190.3, 211.7, 225.7, 201.4, 266.9, 263.6, 259.5, 249.6],   // 1979
        [226.1, 219.4, 178.7, 232.2, 254.7, 222.7, 192.9, 191.7, 219.6, 233.3, 209.5, 246.9],   // 1980
        [156.6, 189.9, 196.6, 225.3, 194.7, 131.6, 205.3, 242.5, 245.3, 216.2, 186.0, 195.4],   // 1981
        [149.8, 230.9, 221.1, 170.3, 119.3, 163.7, 139.4, 161.9, 167.4, 134.3, 127.5, 169.0],   // 1982
        [115.5, 73.1, 88.7, 109.6, 132.5, 131.5, 108.9, 96.0, 69.9, 72.5, 45.7, 45.6],   // 1983
        [74.8, 110.2, 116.7, 90.4, 96.9, 65.1, 55.7, 35.0, 22.6, 12.6, 26.5, 21.4],   // 1984
        [17.8, 20.7, 16.9, 20.4, 32.4, 28.3, 39.9, 10.1, 4.3, 22.0, 17.9, 15.8],   // 1985
        [2.8, 27.9, 13.8, 22.4, 16.1, 0.6, 18.1, 9.9, 5.1, 40.1, 15.4, 5.8],   // 1986
        [9.8, 3.4, 17.4, 46.0, 39.1, 18.8, 38.2, 47.9, 42.2, 63.4, 48.8, 29.1],   // 1987
        [70.5, 45.4, 91.2, 108.8, 74.2, 124.3, 131.4, 139.4, 142.7, 156.5, 156.8, 231.2],   // 1988
        [210.1, 208.7, 170.4, 166.3, 195.4, 284.5, 180.5, 232.0, 225.1, 212.2, 238.2, 211.4],   // 1989
        [227.4, 171.8, 191.7, 189.7, 175.2, 153.3, 191.1, 252.1, 169.1, 199.4, 178.8, 197.1],   // 1990
      ]
    }
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
