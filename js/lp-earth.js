/*
 * lp-earth.js : LowPoly scenes "earth" (Earth with an orbit) and "title" (title-screen hero).
 * Plain ES5. Load after lowpoly.js. Reads data/orbits.js (ORBITS, for altitude_km) when it is
 * loaded and works without it. Creates no globals: it only adds LowPoly.scenes.earth and .title.
 *
 * LowPoly.scenes.earth(opts) -> { scene, update(t, dt), label, orbit, fit(w, h), pose(time), meshes }
 *   opts.orbitId      "leo" (500 km, 45 degrees), "sso" (700 km, 98 degrees), "geo" (35,786 km, over
 *                     0 degrees longitude). Anything else, or nothing: Earth alone, with no ring.
 *   opts.objectiveId  optional overlay on the globe: "wildfire" (fires), "sea-ice" (winter ice cap),
 *                     "ionosphere" (ground stations), "weather" (clouds), "solar" (the Sun),
 *                     "radiation" (the radiation belts). Any other value: no overlay.
 *   opts.spin         degrees per second the Earth turns (default 5). The satellite keeps its pace
 *                     relative to the Earth (LEO about 6 laps per Earth turn, GEO exactly 1), so
 *                     spin 0 holds the whole scene still. Under prefers-reduced-motion it holds still.
 *   Heights use a compressed (logarithmic) scale, so LEO is a low ring and GEO is clearly farther
 *   out but nowhere near its true 6.6 Earth radii; the label says so.
 *   Extras: orbit = {id, altitude_km, inclination_deg, radius, laps_per_turn} (null without an orbit);
 *   fit(w, h) re-frames the camera for a canvas of that CSS size (the default framing suits any
 *   canvas from square to very wide, e.g. 390x400 and 1280x320; call it for taller canvases);
 *   pose(time) sets the scene to that many seconds of animation and returns the wrapper;
 *   meshes = {globe, ring, satellite, overlay} (read-only, for thumbnails and tests).
 *
 * LowPoly.scenes.title(opts) -> { scene, update(t, dt), label, fit(w, h), meshes }
 *   Earth low in the frame, a satellite in the foreground, a slow camera drift and stars.
 *   opts.mesh   optional satellite mesh (body frame: nadir -Y) shown instead of the built-in one.
 *   opts.drift  false holds the camera still (default true). Reduced motion also holds it still.
 *   The drift is applied as small increments to the camera, so a drag by the player is kept, but
 *   update() holds the camera within 45 degrees of yaw and -8 to +40 degrees of pitch from its start
 *   (outside that the eye would go inside the Earth or behind the part that is built), and hides
 *   the horizon air band once the camera is turned well away from where that band was drawn.
 *   fit(w, h) opens the field of view for canvases taller than wide. meshes = {globe, clouds, air,
 *   backing, satellite}. Only the part of Earth the camera can see is built (about 500 triangles),
 *   with a coarse sea-blue ball behind it in case the player drags far round.
 */
(function () {
  'use strict';
  var L = (typeof LowPoly !== 'undefined') ? LowPoly : null;
  if (!L || !L.scenes) return;

  var DEG = Math.PI / 180;

  // --------------------------------------------------------------------- small vector helpers
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vscl(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function vlen(a) { return Math.sqrt(vdot(a, a)); }
  function vnorm(a) { var l = vlen(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0]; }
  function wrap180(a) { a = (a + 180) % 360; if (a < 0) a += 360; return a - 180; }

  // Longitude east is +X, latitude north is +Y, (0, 0) is +Z: the face you see at camera yaw 0.
  function geo(lon, lat) {
    var cl = Math.cos(lat * DEG);
    return [cl * Math.sin(lon * DEG), Math.sin(lat * DEG), cl * Math.cos(lon * DEG)];
  }
  function lonlat(p) {
    var l = vlen(p) || 1;
    return [Math.atan2(p[0], p[2]) / DEG, Math.asin(clamp(p[1] / l, -1, 1)) / DEG];
  }

  // Rotation matrices as row-major 9 numbers.
  function mmul(A, B) {
    var R = [], i, j;
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return R;
  }
  function mapply(M, p) {
    return [M[0] * p[0] + M[1] * p[1] + M[2] * p[2], M[3] * p[0] + M[4] * p[1] + M[5] * p[2], M[6] * p[0] + M[7] * p[1] + M[8] * p[2]];
  }
  function rotY(a) { var c = Math.cos(a * DEG), s = Math.sin(a * DEG); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function rotZ(a) { var c = Math.cos(a * DEG), s = Math.sin(a * DEG); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
  // Euler angles [rx, ry, rz] (degrees, LowPoly order: X then Y then Z about world axes) for the
  // rotation whose columns are the images of the body axes X, Y, Z.
  function eulerFromAxes(X, Y, Z) {
    var m00 = X[0], m10 = X[1], m20 = X[2], m01 = Y[0], m11 = Y[1], m21 = Y[2], m22 = Z[2];
    if (Math.abs(m20) < 0.99999) {
      return [Math.atan2(m21, m22) / DEG, Math.asin(-m20) / DEG, Math.atan2(m10, m00) / DEG];
    }
    return [0, (m20 < 0 ? 90 : -90), Math.atan2(-m01, m11) / DEG];
  }

  var mql = null, mqlTried = false;
  function reducedMotion() {
    if (!mqlTried) {
      mqlTried = true;
      try { mql = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { mql = null; }
    }
    return !!(mql && mql.matches);
  }

  // A triangle whose front faces away from 'ref' (a point inside the solid it belongs to).
  function triOut(a, b, c, col, ref, e) {
    var n = vcross(vsub(b, a), vsub(c, a));
    var cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (vdot(n, vsub(cen, ref)) < 0) { var t = b; b = c; c = t; }
    return { v: [a.slice(), b.slice(), c.slice()], c: col, e: e ? 1 : 0 };
  }

  // ===================================================================== the land mask
  // Coarse coastlines as [lon, lat, lon, lat, ...]. A face is classified from its centroid and
  // three more points, so detail finer than about 8 degrees does not matter.
  var LAND = [
    // North America (Hudson Bay is left out by the coastline)
    [-168, 66, -163, 70, -156, 71.5, -141, 70, -128, 70.5, -115, 68.5, -105, 68, -95, 69, -88, 68.5, -82, 66,
      -86, 63, -94, 59, -92, 57, -82, 55, -79, 52, -78, 60, -73, 62, -64, 60, -61, 56, -56, 52, -59, 48,
      -53, 47, -60, 45.5, -66, 44.5, -70, 42, -74, 40.5, -76, 37, -76, 35, -81, 31.5, -80, 27, -80.5, 25,
      -82, 26.5, -83, 29.5, -86, 30.3, -89, 30.2, -94, 29.6, -97, 27.5, -97.5, 22, -95, 18.5, -91, 19,
      -90.5, 21, -87, 21.5, -88, 16, -84, 15.5, -83.5, 11, -81, 8.5, -77.5, 8, -80, 7.3, -83, 8.2, -86, 11,
      -88, 13.3, -92, 14.5, -95, 16, -98, 16.5, -102, 18, -105.5, 20.5, -105.5, 22.5, -110, 23, -112.5, 27,
      -115, 30, -117, 32.5, -120.5, 34.5, -122.5, 37.5, -124, 40.5, -124, 46, -124.5, 48.5, -127, 50.5,
      -130.5, 54.5, -135, 58, -140, 60, -146, 61, -152, 60, -154, 58, -158, 56.5, -162, 55, -158, 58.5,
      -162, 59.5, -165, 61.5, -166, 63.5, -161, 64.5],
    // Arctic Canada and Baffin Island
    [-125, 71.5, -122, 74, -116, 76.5, -104, 78.5, -92, 81, -75, 83, -62, 82, -72, 79, -78, 76.5, -68, 73.5,
      -62, 67, -64, 63, -72, 62.5, -78, 64.5, -73, 67.5, -80, 70, -88, 70.5, -96, 71, -105, 70, -116, 70.5],
    // South America
    [-77, 8.5, -75, 11, -71.5, 12.5, -66, 10.6, -61, 10.5, -57, 6, -52, 5, -50, 1.5, -48, -1, -44, -2.5,
      -39, -3, -35, -5.5, -35, -9, -39, -13.5, -39, -18, -41, -22, -44, -23, -48, -26, -49, -29, -53, -33.5,
      -57, -35.5, -58, -38.5, -62, -39, -65, -41, -64, -43, -67, -46, -66, -48, -69, -51, -68.5, -53, -66, -55,
      -71, -55.5, -75, -52, -75, -47, -73.5, -43, -73.5, -38, -71.5, -30, -70.5, -23, -70.5, -18.5, -75, -15.5,
      -76.5, -13, -79.5, -8, -81, -5.5, -80, -2.5, -80, 0, -78.5, 2, -77.5, 4, -77.5, 7],
    // Africa
    [-17, 21, -17.5, 14.7, -16.5, 12.5, -13.5, 9.5, -11, 7, -7.5, 4.5, -2, 5, 2, 6.3, 5, 5.5, 6.5, 4.3, 9, 4,
      9.7, 2, 9, -1, 11.5, -3.5, 12.5, -6, 13.5, -11, 12, -15, 11.8, -18, 14.5, -23, 15.5, -27.5, 17, -30.5,
      18.4, -34.2, 20, -34.8, 25, -34, 28, -33, 31, -29.8, 32.8, -26, 35.5, -24, 35.5, -21, 34.8, -19.5,
      37, -17.5, 40.5, -15, 40.5, -10.5, 39.3, -6.5, 39.5, -4.5, 41, -2, 43.5, 1, 46.5, 4, 49, 7.5, 51.2, 11.8,
      48, 11.2, 44, 10.5, 43.3, 11.8, 41.5, 14, 39.5, 15.5, 38.5, 18, 37.2, 21, 36.5, 23, 35.5, 24.5, 34, 27,
      32.6, 29.9, 32.3, 31.3, 29, 30.9, 25, 31.6, 20, 32, 19.5, 30.5, 15.5, 31.5, 11, 33.2, 10.3, 36.9, 9, 37.2,
      3, 36.8, -1, 35.5, -5.5, 35.9, -6.8, 34, -9.7, 30.5, -11.5, 28, -13.2, 27.4, -14.5, 26, -16.5, 23.5],
    // Eurasia: Atlantic and Arctic coasts eastward, the Pacific south, then west along the Indian
    // Ocean, Arabia, the Levant and the north shore of the Mediterranean. Longitudes past 180 wrap.
    [-9, 43, -1.8, 43.4, -1.2, 46, -4.5, 48, -1.5, 48.8, 2, 51, 4.5, 52.5, 8, 53.6, 8.5, 55.5, 8.2, 57,
      10.5, 57.6, 11, 59, 8, 58, 5.5, 58.5, 5, 61.5, 7, 63, 12, 65.5, 15, 68.5, 19, 70, 24, 71, 30, 70.3,
      33, 69.3, 41, 67.5, 44, 66.5, 44, 68.5, 53, 68.5, 60, 69.5, 66, 69, 69, 72.8, 73, 72, 80, 72.5, 87, 75,
      99, 76.8, 104, 77.7, 113, 74, 120, 73, 129, 72, 140, 72.5, 150, 71.5, 160, 69.8, 170, 70, 180, 69,
      190, 66, 182, 64.5, 179, 62.5, 174, 61.5, 170, 60, 163, 57.5, 162, 55, 160, 53, 156.7, 51, 156, 57,
      160, 61.5, 155, 59.5, 150, 59.5, 143, 59.3, 138, 55.5, 137, 54, 141, 52.5, 140.5, 48.5, 138, 46,
      135, 43.5, 131.5, 42.7, 129.7, 41, 129.4, 36, 126.5, 34.5, 126.4, 37.5, 125, 39.5, 121.5, 40.9,
      118, 39, 119, 37.3, 122.5, 37.2, 120.5, 34.5, 121.8, 31, 121.8, 28.5, 119.6, 25.6, 117, 23.6,
      113.5, 22.3, 110.5, 21, 108, 21.5, 106.5, 20, 106.6, 17.5, 108.8, 15.5, 109.3, 12.5, 107, 10.5,
      105, 8.6, 104.7, 10.5, 103, 11.3, 100.9, 13.4, 100, 12.2, 99.3, 10, 100.2, 8, 101.2, 6.8, 102.3, 6.1,
      103.4, 4.2, 104.2, 1.5, 103.4, 1.3, 101.3, 2.8, 100.3, 5, 98.6, 8.2, 98.3, 10.5, 97.7, 13, 97.6, 16.5,
      94.3, 16, 94.4, 19, 92.2, 21, 91.5, 22.6, 90, 21.8, 88.3, 21.6, 86.9, 20.8, 86.5, 19.9, 84.7, 19,
      82.3, 16.6, 80.3, 15.6, 80.2, 13, 79.8, 10.3, 78.2, 8.6, 77.5, 8.1, 76.4, 9.5, 75.3, 12, 74, 15.5,
      72.8, 19.5, 72.6, 21.4, 70.5, 20.7, 69, 22.3, 68.3, 23.6, 66.6, 25.4, 64, 25.3, 61.6, 25.2, 58.8, 25.6,
      57.3, 25.9, 56.3, 27.2, 54.5, 26.7, 51.5, 27.9, 50.2, 30, 48.6, 30.1, 48.4, 28.4, 49.6, 26.9, 50.6, 25.5,
      51.6, 24.2, 54.2, 24.3, 56.3, 26.2, 56.4, 24.8, 58.6, 23.6, 59.8, 22.4, 58.5, 20.5, 57.8, 19, 56.7, 17.9,
      55, 17, 52.2, 15.6, 48.7, 14, 45, 12.8, 43.4, 12.7, 42.8, 15, 42.6, 16.5, 41.1, 19, 39.2, 21.4,
      38.6, 23.5, 37.4, 24.6, 36.5, 26.3, 35.2, 28.1, 34.9, 29.5, 34.3, 31.3, 34.9, 32.8, 35.7, 34.8, 36, 36.8,
      34.5, 36.7, 32.5, 36.1, 30.6, 36.6, 28.3, 36.8, 27.2, 37.9, 26.5, 39.4, 26.3, 40.6, 24, 40.8, 22.9, 40.4,
      23.9, 38.2, 22.9, 36.5, 21.6, 37, 20.2, 39.6, 19.4, 41.8, 16, 43.5, 13.7, 45.6, 12.3, 45.2, 12.4, 44.2,
      13.8, 42.6, 16, 41.5, 18.5, 40.1, 16.6, 38.5, 15.7, 38, 15.8, 40, 14, 40.8, 12, 41.9, 10.5, 43, 8.7, 44.4,
      7.5, 43.8, 5, 43.3, 3.2, 43.1, 3.2, 41.9, 2, 41.3, 0.5, 40.5, -0.3, 39.4, -0.7, 37.6, -2.1, 36.7,
      -4.4, 36.7, -5.6, 36, -6.3, 36.8, -8.9, 37, -9.5, 38.8, -8.8, 42.5],
    // Great Britain, Ireland, Iceland
    [-5.7, 50, 1.4, 51.2, 1.7, 52.7, 0, 53.5, -1.6, 55.6, -2, 57.6, -3.1, 58.6, -5, 58.6, -6.2, 57.5, -5.6, 56.5,
      -4.9, 55, -3.1, 54.6, -3.3, 53.4, -4.6, 53.3, -4.3, 52.3, -5.2, 51.7, -3.2, 51.4, -4.2, 51.2],
    [-6, 52, -6, 54.5, -7.5, 55.3, -10, 54.2, -10.2, 51.6, -8, 51.6],
    [-24, 65.5, -22, 66.4, -16, 66.5, -13.5, 65.2, -18.7, 63.4, -22.7, 63.8],
    // Novaya Zemlya
    [52, 71.4, 55, 75, 60, 76.4, 68, 76.9, 61, 75, 57, 73.5, 55, 72.5, 54, 70.8],
    // Japan
    [130, 31, 131.5, 34, 133, 35.5, 135.5, 35.7, 136.8, 37.3, 139.5, 38.5, 140, 40.5, 140, 41.5, 140.2, 42.5,
      141.5, 45.4, 145.5, 43.3, 143.5, 42, 141.8, 42.6, 141.5, 40.5, 142, 39.5, 140.9, 36.8, 139.8, 35,
      138.8, 34.7, 137, 34.6, 135.2, 33.8, 133, 33.5, 132, 32.8, 131.3, 31.3],
    // Philippines, Borneo, Sumatra, Java, New Guinea
    [120, 18.5, 122.2, 18.5, 124.3, 12.5, 126.3, 7.5, 125.5, 6, 122, 7, 123, 10, 121.5, 13.5, 120, 14.7],
    [109, 1.5, 111, 2.5, 113.5, 4, 116, 6.8, 117.7, 5.9, 119, 4.9, 118, 1, 117.5, -0.8, 116.4, -3.8, 114.5, -3.7,
      111, -3, 110, -1.5],
    [95.3, 5.5, 97.5, 5.2, 100.4, 2.1, 103.7, -1, 106, -3.2, 105.8, -5.8, 104.5, -5.9, 102.3, -4, 100.3, -0.8,
      98.6, 1.7, 96, 3.7],
    [105.2, -6.8, 106, -5.9, 110.4, -6.9, 114.5, -7.8, 114.4, -8.7, 110, -8.2, 106.5, -7.4],
    [131, -1.2, 134.2, -0.9, 137.8, -1.5, 141, -2.6, 145.8, -5, 147.5, -6.2, 150, -10.4, 146.4, -8.9, 144, -7.6,
      142.6, -9.4, 141, -9.1, 138.8, -8.3, 137.8, -5.3, 134.3, -4, 132.7, -4, 132, -2.8],
    // Australia, Tasmania, New Zealand
    [113.4, -22, 114.1, -26.5, 115, -29.5, 115, -33.6, 117.8, -35.1, 121.9, -33.9, 124, -33, 126, -32.3,
      129, -31.6, 131.2, -31.5, 134, -32.7, 135.6, -34.8, 137.7, -32.7, 137.8, -35.6, 139.6, -36.8, 140.6, -38,
      143.5, -38.8, 146.4, -39.1, 147.9, -37.9, 149.9, -37.5, 150.8, -34.6, 152.5, -32.4, 153.6, -28.6,
      153.2, -25.3, 150.8, -22.5, 148.8, -20.3, 146.3, -18.9, 145.3, -15, 143.6, -14.2, 142.5, -10.7,
      141.6, -13.7, 141.6, -16.5, 140.8, -17.4, 139.3, -17.4, 137, -15.9, 135.9, -14.7, 136.8, -12.2,
      133.5, -11.5, 131, -12.2, 129.4, -14.9, 127.7, -14.1, 125.6, -14.5, 123.5, -17.2, 122.2, -18.2,
      121, -19.6, 118.8, -20.3, 116.7, -20.6, 114.6, -21.8],
    [144.6, -40.7, 148.3, -40.9, 148, -43.2, 146.6, -43.6, 145.2, -42.2],
    [172.7, -34.4, 174.8, -36.8, 178.5, -37.7, 177, -39.4, 175, -41.6, 174.6, -39.8, 173.8, -39.2, 174.5, -37],
    [172.7, -40.5, 174.3, -41.7, 173, -43.8, 171.2, -44.5, 169, -46.6, 166.5, -46, 168.2, -44, 171.4, -41.8],
    // Madagascar, Sri Lanka, Cuba
    [43.3, -22, 44.4, -25.2, 47.1, -25, 49.6, -17.1, 50.4, -15.5, 49.3, -12, 48, -13.6, 46.3, -15.8, 44.2, -17.4, 44, -20],
    [79.8, 6, 80, 9.6, 81.9, 7.5, 81.7, 6.4, 80.6, 5.9],
    [-85, 21.9, -80, 23.1, -74.2, 20.2, -77.7, 19.9, -82, 22.6]
  ];
  // Inland seas cut out of the land.
  var SEAS = [
    [27.5, 42.5, 28.5, 44.5, 30, 46, 31.5, 46.7, 33.5, 46, 35, 45.3, 37.5, 47, 39.5, 47, 38, 45, 41.5, 42, 38, 41,
      34, 42, 31, 41.2, 29, 41.2],                                                        // Black Sea
    [47, 44.5, 47.5, 46.5, 49.5, 46.5, 53, 45, 52.6, 42, 54, 40, 53.5, 37.2, 49, 37.5, 49.5, 40.3],   // Caspian
    [10, 54.5, 14, 54, 19, 54.5, 21, 56.5, 24, 59.4, 30, 60, 24.5, 60.5, 21.5, 61, 21.5, 63.5, 25.5, 65,
      22.5, 66, 17.5, 62.5, 17.5, 61, 19, 59.5, 16.5, 57, 14.5, 56, 12.5, 56]               // Baltic
  ];
  // Land under an ice sheet.
  var ICE_LAND = [
    [-73, 78, -66, 81, -55, 82.5, -35, 83.5, -20, 82, -18, 77, -20, 73, -22, 70, -27, 68.5, -32, 68, -38, 66,
      -42, 63, -44, 60, -49, 61.5, -52, 64.5, -54, 67, -54, 70, -56, 72.5, -61, 76, -68, 76.5]   // Greenland
  ];
  // Deserts as ellipses [lon, lat, half-width, half-height] in degrees.
  var DESERTS = [
    [-3, 22, 15, 7.5], [20, 24, 15, 7], [46, 22, 10, 7], [62, 29, 9, 4.5], [60, 42, 8, 4], [93, 41, 17, 5],
    [128, -25, 14, 7], [20, -24, 6, 6], [-111, 31, 7, 6]
  ];
  // Ice edges as latitude every 30 degrees of longitude from -180. Arctic sea ice (a typical year and
  // late winter) and the Antarctic coast with its ice shelves and sea ice.
  var ICE_N_YEAR = [73, 73, 74, 72, 71, 74, 78, 79, 77, 76, 75, 73, 73];
  var ICE_N_WINTER = [62, 66, 67, 56, 58, 65, 72, 73, 70, 70, 67, 58, 62];
  var ICE_S_EDGE = [-75, -72, -71, -70, -63, -68, -68, -67, -65, -64, -64, -66, -75];
  function edgeAt(tab, lon) {
    var x = (wrap180(lon) + 180) / 30, i = Math.min(11, Math.floor(x)), f = x - i;
    return tab[i] + (tab[i + 1] - tab[i]) * f;
  }

  function inPoly(P, x, y) {
    var inside = false, n = P.length / 2, i, j;
    for (i = 0, j = n - 1; i < n; j = i++) {
      var xi = P[2 * i], yi = P[2 * i + 1], xj = P[2 * j], yj = P[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inList(list, lon, lat) {
    for (var k = 0; k < list.length; k++) {
      var P = list[k];
      if (inPoly(P, lon, lat) || inPoly(P, lon + 360, lat) || inPoly(P, lon - 360, lat)) return true;
    }
    return false;
  }
  // 'sea', 'land', 'sand' or 'ice' at a point. winter: the Arctic sea ice of late winter.
  function surfaceAt(lon, lat, winter) {
    if (lat <= edgeAt(ICE_S_EDGE, lon) || lat >= 80) return 'ice';
    if (inList(ICE_LAND, lon, lat)) return 'ice';
    var land = inList(LAND, lon, lat) && !inList(SEAS, lon, lat);
    if (!land) return lat >= edgeAt(winter ? ICE_N_WINTER : ICE_N_YEAR, lon) ? 'ice' : 'sea';
    if (lat >= 76) return 'ice';
    for (var k = 0; k < DESERTS.length; k++) {
      var d = DESERTS[k], dx = wrap180(lon - d[0]) / d[2], dy = (lat - d[1]) / d[3];
      if (dx * dx + dy * dy <= 1) return 'sand';
    }
    return 'land';
  }

  // ===================================================================== the globe
  // Geodesic sphere of frequency n (20 n^2 faces), with a vertex on each pole, vertices shared
  // between faces (so a wobble never opens a crack) and faces counter-clockwise from outside.
  function geodesic(n) {
    var s5 = Math.sqrt(5), hgt = 1 / s5, rad = 2 / s5, I = [[0, 1, 0]], i, j, k;
    for (i = 0; i < 5; i++) I.push([rad * Math.cos(i * 2 * Math.PI / 5), hgt, -rad * Math.sin(i * 2 * Math.PI / 5)]);
    for (i = 0; i < 5; i++) I.push([rad * Math.cos((i + 0.5) * 2 * Math.PI / 5), -hgt, -rad * Math.sin((i + 0.5) * 2 * Math.PI / 5)]);
    I.push([0, -1, 0]);
    var IF = [];
    for (i = 0; i < 5; i++) {
      j = (i + 1) % 5;
      IF.push([0, 1 + i, 1 + j], [1 + i, 6 + i, 1 + j], [6 + i, 6 + j, 1 + j], [11, 6 + j, 6 + i]);
    }
    var V = [], index = {}, F = [];
    function vid(p) {
      p = vnorm(p);
      var key = Math.round(p[0] * 1e6) + ',' + Math.round(p[1] * 1e6) + ',' + Math.round(p[2] * 1e6);
      if (index[key] === undefined) { index[key] = V.length; V.push(p); }
      return index[key];
    }
    for (k = 0; k < IF.length; k++) {
      var A = I[IF[k][0]], B = I[IF[k][1]], C = I[IF[k][2]], grid = [];
      for (i = 0; i <= n; i++) {
        grid[i] = [];
        for (j = 0; j <= n - i; j++) {
          var wa = (n - i - j) / n, wb = i / n, wc = j / n;
          grid[i][j] = vid([A[0] * wa + B[0] * wb + C[0] * wc, A[1] * wa + B[1] * wb + C[1] * wc, A[2] * wa + B[2] * wb + C[2] * wc]);
        }
      }
      for (i = 0; i < n; i++) {
        for (j = 0; j < n - i; j++) {
          F.push([grid[i][j], grid[i + 1][j], grid[i][j + 1]]);
          if (i + j < n - 1) F.push([grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]);
        }
      }
    }
    return { V: V, F: F };
  }

  // Ten sample points spread over a triangle (barycentric weights).
  var SAMPLES = (function () {
    var out = [], a, b;
    for (a = 0; a <= 3; a++) for (b = 0; b <= 3 - a; b++) out.push([(a + 1 / 3) / 4, (b + 1 / 3) / 4, 1 - (a + b + 2 / 3) / 4]);
    return out;
  })();
  // A wobbly geodesic globe whose faces are coloured from the land mask (majority of ten sample
  // points, the centroid breaks ties). o: {n, wobble, seed, winter, gridTurn (rotation of the grid),
  // keep(centroidDir) optional filter, place(p) optional final transform of every vertex}. Radius about 1.
  function buildGlobe(o) {
    var G = geodesic(o.n), V = G.V, F = G.F, k, rnd = L.rng(o.seed || 1);
    // turn the grid off the poles so the ice caps do not come out as five-pointed stars
    if (o.gridTurn) for (k = 0; k < V.length; k++) V[k] = mapply(o.gridTurn, V[k]);
    if (o.wobble) {
      for (k = 0; k < V.length; k++) {
        var w = o.wobble, p = V[k];
        V[k] = vscl(vadd(p, [(rnd() - 0.5) * w, (rnd() - 0.5) * w, (rnd() - 0.5) * w]), 1 + (rnd() - 0.5) * w);
      }
    }
    function cls(p) { var g = lonlat(p); return surfaceAt(g[0], g[1], !!o.winter); }
    var tris = [];
    for (k = 0; k < F.length; k++) {
      var a = V[F[k][0]], b = V[F[k][1]], c = V[F[k][2]];
      var cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      if (o.keep && !o.keep(vnorm(cen))) continue;
      var s = [cls(cen)], j;
      for (j = 0; j < SAMPLES.length; j++) {
        var w = SAMPLES[j];
        s.push(cls([a[0] * w[0] + b[0] * w[1] + c[0] * w[2], a[1] * w[0] + b[1] * w[1] + c[1] * w[2], a[2] * w[0] + b[2] * w[1] + c[2] * w[2]]));
      }
      var votes = {}, best = s[0], bestN = 0;
      for (j = 0; j < s.length; j++) votes[s[j]] = (votes[s[j]] || 0) + 1;
      for (j in votes) if (votes.hasOwnProperty(j) && votes[j] > bestN) { best = j; bestN = votes[j]; }
      if (votes[s[0]] === bestN) best = s[0];
      var pa = o.place ? o.place(a) : a, pb = o.place ? o.place(b) : b, pc = o.place ? o.place(c) : c;
      tris.push({ v: [pa.slice(), pb.slice(), pc.slice()], c: best, e: 0 });
    }
    return { tris: tris };
  }


  // Grid rotation that fits the land mask best (searched offline over 486 rotations: 9 % fewer
  // mismatched samples than a grid with a vertex on each pole, and no five-pointed ice caps).
  var GRID_TURN = mmul(rotZ(12), L.rotationMatrix(8, 60, 0));
  var globeCache = {};
  function orbitGlobe(winter) {
    var key = winter ? 'winter' : 'year';
    if (!globeCache[key]) globeCache[key] = buildGlobe({ n: 5, wobble: 0.03, seed: 5, winter: winter, gridTurn: GRID_TURN });
    return globeCache[key];
  }

  // ===================================================================== orbits
  // What data/orbits.js does not hold: the tilt of each ring and where it sits in the picture.
  // raan turns the ring about the polar axis (degrees, relative to the camera's default yaw),
  // u0 is where the satellite starts on its ring, earth0 the longitude facing the camera at the start.
  var ORBIT_LOOK = {
    leo: { inc: 45, alt: 500, raan: -60, u0: -8, earth0: 10 },
    sso: { inc: 98, alt: 700, raan: 62, u0: 62, earth0: -20 },
    geo: { inc: 0, alt: 35786, raan: 0, u0: 0, earth0: 40 }
  };
  var CAM_YAW = 20, CAM_PITCH = 18, CAM_FOV = 35;

  // Heights on a compressed scale: 1.1 + 0.3 ln(1 + h / 700 km) Earth radii. LEO 1.26, SSO 1.31,
  // GEO 2.29 (the true radii are 1.08, 1.11 and 6.6).
  function displayRadius(altKm) { return 1.1 + 0.3 * Math.log(1 + Math.max(0, altKm) / 700); }
  // Laps per Earth turn, compressed the same way: (sidereal day / period)^0.66. LEO about 6, GEO 1.
  function lapsPerTurn(altKm) {
    var r = 6371 + Math.max(0, altKm), T = 2 * Math.PI * Math.sqrt(r * r * r / 398600.4418);
    return Math.pow(86164.1 / T, 0.66);
  }
  function geoLongitude() {
    try {
      if (typeof EARTH !== 'undefined' && EARTH && EARTH.wildfire && typeof EARTH.wildfire.geo_longitude === 'number') return EARTH.wildfire.geo_longitude;
    } catch (e) { /* no data */ }
    return 0;
  }
  function findOrbit(id) {
    if (typeof id !== 'string' || !id) return null;
    var rec = null, list = null, i;
    try { list = (typeof ORBITS !== 'undefined') ? ORBITS : null; } catch (e) { list = null; }
    if (list && list.length) for (i = 0; i < list.length; i++) if (list[i] && list[i].id === id) { rec = list[i]; break; }
    var look = Object.prototype.hasOwnProperty.call(ORBIT_LOOK, id) ? ORBIT_LOOK[id] : null;
    var alt = (rec && typeof rec.altitude_km === 'number' && rec.altitude_km > 0) ? rec.altitude_km : (look ? look.alt : null);
    if (alt === null) return null;
    var laps = lapsPerTurn(alt), inc = look ? look.inc : 30;
    return {
      id: id, name: (rec && typeof rec.name === 'string') ? rec.name : id, altitude_km: alt, inclination_deg: inc,
      radius: displayRadius(alt), laps_per_turn: laps, geostationary: Math.abs(laps - 1) < 0.01 && inc < 1,
      raan: CAM_YAW + (look ? look.raan : 0), u0: look ? look.u0 : 45, earth0: look ? look.earth0 : 10
    };
  }
  function eq(u) { return [Math.sin(u * DEG), 0, Math.cos(u * DEG)]; }
  // Position and body axes of a satellite at angle u along its ring: body -Y points at Earth's
  // centre (nadir), -Z along the motion (aft is +Z), X along the orbit's normal (the panels).
  function orbitPose(o, u) {
    var M = mmul(rotY(o.raan), rotZ(o.inclination_deg));
    var r = mapply(M, eq(u)), v = mapply(M, [Math.cos(u * DEG), 0, -Math.sin(u * DEG)]), h = mapply(M, [0, 1, 0]);
    return { pos: vscl(r, o.radius), X: vscl(h, -1), Y: r, Z: vscl(v, -1) };
  }
  // The orbit as a ring of short emissive dashes, each a thin three-sided tube.
  function ringMesh(o, w, dashes, col) {
    var M = mmul(rotY(o.raan), rotZ(o.inclination_deg)), nrm = mapply(M, [0, 1, 0]), tris = [], k, j;
    for (k = 0; k < dashes; k++) {
      var u0 = k * 360 / dashes, u1 = (k + 0.55) * 360 / dashes, um = (u0 + u1) / 2;
      var p0 = mapply(M, vscl(eq(u0), o.radius)), p1 = mapply(M, vscl(eq(u1), o.radius));
      var radial = mapply(M, eq(um)), mid = vscl(vadd(p0, p1), 0.5), A = [], B = [];
      for (j = 0; j < 3; j++) {
        var a = (90 + 120 * j) * DEG, off = vadd(vscl(radial, Math.cos(a) * w), vscl(nrm, Math.sin(a) * w));
        A.push(vadd(p0, off)); B.push(vadd(p1, off));
      }
      for (j = 0; j < 3; j++) {
        var j2 = (j + 1) % 3;
        tris.push(triOut(A[j], A[j2], B[j2], col, mid, 1));
        tris.push(triOut(A[j], B[j2], B[j], col, mid, 1));
      }
    }
    return { tris: tris };
  }

  // The small satellite that rides the ring: a gold box on a boom (body frame: nadir -Y, boom along
  // X) and, as a separate item, two panels that turn about X to face the Sun. About 2.3 units across.
  var proxyCache = null;
  function proxyMeshes() {
    if (proxyCache) return proxyCache;
    var panel = L.box(0.8, 0.035, 0.44, 'cellEdge');
    proxyCache = {
      body: L.merge([
        L.box(0.5, 0.56, 0.5, 'gold'),
        L.move(L.box(0.3, 0.08, 0.3, 'silver'), 0, 0.31, 0),
        L.box(1.1, 0.05, 0.05, 'silver'),
        L.move(L.box(0.18, 0.1, 0.18, 'graphite'), 0, -0.33, 0)
      ]),
      wings: L.merge([L.move(panel, -0.75, 0, 0), L.move(panel, 0.75, 0, 0)])
    };
    return proxyCache;
  }
  // Body axes turned about X so the panel faces (+-Y) look at the Sun as well as they can.
  function sunTrack(P, S) {
    var sp = vsub(S, vscl(P.X, vdot(S, P.X)));
    var b = Math.atan2(vdot(sp, P.Z), vdot(sp, P.Y)), cb = Math.cos(b), sb = Math.sin(b);
    return { X: P.X, Y: vadd(vscl(P.Y, cb), vscl(P.Z, sb)), Z: vsub(vscl(P.Z, cb), vscl(P.Y, sb)) };
  }

  // ===================================================================== objective overlays
  var FIRES = [[-121, 39], [-114, 57], [-58, -9], [-3, 10], [21, 7], [25, -12], [100, 19], [124, 58], [133, -15]];
  // Ground stations that heard Alouette 1 the most (data/earth.js names them; longitudes added here).
  var STATIONS = [[-94.8, 74.7], [-147.8, 64.9], [-75.7, 45.4], [-57.9, -51.7], [-0.7, 51.4]];
  // Cloud banks [lon, lat, size, heading (0 = lying east-west, positive turns toward north-east)]:
  // the tropical band and the storm tracks of both hemispheres.
  var CLOUDS = [[-150, 6, 1.0, 5], [-95, 8, 0.9, -5], [-30, 5, 1.0, 0], [25, 2, 0.9, 5], [95, 4, 1.0, -5],
    [155, 8, 0.9, 0], [-160, 44, 1.2, 25], [-45, 48, 1.2, 30], [10, 55, 1.0, 20], [80, 50, 1.1, 25],
    [140, 45, 1.1, 30], [-115, -44, 1.2, -25], [-20, -46, 1.2, -30], [70, -48, 1.2, -20], [150, -44, 1.1, -30]];

  // A mesh authored pointing along +Y, stood on the globe at lon/lat with +Y along the outward normal.
  function onGlobe(mesh, lon, lat, r, roll) {
    var n = geo(lon, lat);
    return L.place(mesh, { pos: vscl(n, r), normal: n, roll: roll || 0 });
  }
  // A mesh authored lying in XZ (facing +Y) laid on the globe at lon/lat with its X axis along
  // 'heading' (0 = east, 90 = north), bent to follow the curve at radius r (+ its own Y).
  function onGlobeFlat(mesh, lon, lat, r, heading) {
    var n = geo(lon, lat), east = [Math.cos(lon * DEG), 0, -Math.sin(lon * DEG)], north = vcross(n, east);
    var h = heading * DEG, a = vadd(vscl(east, Math.cos(h)), vscl(north, Math.sin(h))), c = vcross(a, n);
    return { tris: mesh.tris.map(function (t) {
      return { v: t.v.map(function (p) { return vscl(vnorm(vadd(n, vadd(vscl(a, p[0]), vscl(c, p[2])))), r + p[1]); }), c: t.c, e: t.e };
    }) };
  }
  // A cloud bank: three flat ovals at slightly different heights, stretched along 'heading'.
  function cloudBank(c, r, i) {
    var s = c[2], rnd = L.rng(101 + i);
    var a = L.scale(L.disc(0.1 * s, 7, 'cloud'), 1.9, 1, 0.8);
    var b = L.move(L.scale(L.disc(0.07 * s, 6, 'cloud'), 1.6, 1, 0.9), (0.1 + 0.06 * rnd()) * s, 0.006, (0.04 + 0.03 * rnd()) * s);
    var d = L.move(L.scale(L.disc(0.06 * s, 6, 'cloud'), 1.5, 1, 0.8), -(0.11 + 0.05 * rnd()) * s, 0.003, -(0.02 + 0.03 * rnd()) * s);
    return onGlobeFlat(L.merge([a, b, d]), c[0], c[1], r, c[3]);
  }
  function overlayMesh(kind) {
    var parts = [], i;
    if (kind === 'wildfire') {
      var flame = L.emit(L.base(L.cone(0.034, 0.09, 5, 'orange')));
      for (i = 0; i < FIRES.length; i++) parts.push(onGlobe(flame, FIRES[i][0], FIRES[i][1], 0.995, i * 23));
    } else if (kind === 'ionosphere') {
      var dish = L.merge([L.base(L.cylinder(0.012, 0.012, 0.05, 4, 'white', { capTop: false, capBottom: false })),
        L.move(L.emit(L.cylinder(0.05, 0.016, 0.03, 6, 'glowCool')), 0, 0.06, 0)]);
      for (i = 0; i < STATIONS.length; i++) parts.push(onGlobe(dish, STATIONS[i][0], STATIONS[i][1], 0.995, 0));
    } else if (kind === 'weather') {
      for (i = 0; i < CLOUDS.length; i++) parts.push(cloudBank(CLOUDS[i], 1.03, i));
    }
    return parts.length ? L.merge(parts) : null;
  }
  // The Sun for the solar topic: a faceted emissive ball in the upper left of the default view.
  function sunPlacement(rFit) {
    var yaw = CAM_YAW * DEG, p = CAM_PITCH * DEG;
    var right = [Math.cos(yaw), 0, -Math.sin(yaw)], up = [-Math.sin(p) * Math.sin(yaw), Math.cos(p), -Math.sin(p) * Math.cos(yaw)];
    var back = [Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p)];
    return vadd(vadd(vscl(right, -0.92 * rFit), vscl(up, 0.74 * rFit)), vscl(back, 0.35 * rFit));
  }
  // A radiation belt as a swarm of small emissive specks trapped between the dipole field lines
  // r = L cos^2(lat) for L from Lin to Lout, within latMax of the equator.
  function beltMesh(Lin, Lout, latMax, count, size, col, seed) {
    var rnd = L.rng(seed), parts = [], k, speck = L.emit(L.cone(size, size * 1.4, 3, col));
    for (k = 0; k < count; k++) {
      // latitudes bunch toward the equator, where the belts are thickest
      var Ls = Lin + (Lout - Lin) * rnd(), lat = (rnd() + rnd() + rnd() - 1.5) / 1.5 * latMax * DEG, lon = rnd() * 360;
      var r = Ls * Math.cos(lat) * Math.cos(lat), n = vscl(geo(lon, lat / DEG), 1);
      parts.push(L.place(speck, { pos: vscl(n, r), normal: [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], roll: rnd() * 360 }));
    }
    return L.merge(parts);
  }

  function fmtKm(v) { var s = String(Math.round(v)); return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var OBJECTIVE_NOTE = {
    wildfire: ' Orange flames mark fires burning on the ground.',
    'sea-ice': ' The Arctic wears its late-winter sea ice.',
    ionosphere: ' Blue lights mark the ground stations that listened to Alouette 1.',
    weather: ' Clouds drift over the surface.',
    solar: ' The Sun shines from the upper left.',
    radiation: ' Orange and yellow specks are particles trapped in the radiation belts by Earth\'s magnetic field.'
  };
  function earthLabel(o, objectiveId) {
    var s;
    if (!o) s = 'Earth turning slowly in space.';
    else if (o.id === 'leo') s = 'Earth with a satellite in low Earth orbit, ' + fmtKm(o.altitude_km) + ' km up, on a ring tilted 45 degrees to the equator, so it never passes over the poles. Height not to scale.';
    else if (o.id === 'sso') s = 'Earth with a satellite in a sun-synchronous polar orbit, ' + fmtKm(o.altitude_km) + ' km up, on a ring tilted 98 degrees that passes over both poles. Height not to scale.';
    else if (o.geostationary) s = 'Earth with a satellite in geostationary orbit, ' + fmtKm(o.altitude_km) + ' km above the equator, turning with Earth so it hovers over one spot. Not to scale: the ring is drawn much closer than it really is. At true scale it would be 6.6 times as wide as Earth.';
    else s = 'Earth with a satellite in ' + o.name + ', ' + fmtKm(o.altitude_km) + ' km up. Height not to scale.';
    if (typeof objectiveId === 'string' && Object.prototype.hasOwnProperty.call(OBJECTIVE_NOTE, objectiveId)) s += OBJECTIVE_NOTE[objectiveId];
    return s;
  }
  function fitDist(rFit, fov, aspect) {
    return rFit / Math.sin(Math.atan(Math.tan(fov * DEG / 2) * Math.min(1, aspect)));
  }

  // ===================================================================== scene: earth
  L.scenes.earth = function (opts) {
    opts = opts || {};
    var orbit = findOrbit(opts.orbitId);
    var objective = typeof opts.objectiveId === 'string' ? opts.objectiveId : '';
    var spin = num(opts.spin, 5);
    var winter = objective === 'sea-ice';
    var globe = orbitGlobe(winter);
    var rFit = orbit ? orbit.radius * 1.13 : 1.12;
    var belts = null;
    if (objective === 'radiation') {
      // inner belt about 1,900 to 6,400 km up, outer belt about 13,000 to 32,000 km (compressed scale);
      // the outer one only when the view reaches that far out anyway
      var outer = !orbit || orbit.radius > 1.8;
      rFit = Math.max(rFit, (outer ? displayRadius(32000) : displayRadius(6400)) * 1.06);
      var parts = [beltMesh(displayRadius(1900), displayRadius(6400), 34, 64, 0.011 * rFit, 'orange', 3)];
      if (outer) parts.push(beltMesh(displayRadius(13000), displayRadius(32000), 40, 72, 0.011 * rFit, 'yellow', 4));
      belts = L.merge(parts);
    }
    var cloudy = objective === 'weather';
    var overlay = overlayMesh(objective);
    var theta0 = CAM_YAW - (orbit ? orbit.earth0 : 10);
    var items = [], earthItem = { mesh: globe, pos: [0, 0, 0], rot: [0, theta0, 0], scale: 1 };
    items.push(earthItem);
    var overlayItem = overlay ? { mesh: overlay, pos: [0, 0, 0], rot: [0, theta0, 0], scale: 1 } : null;
    if (overlayItem) items.push(overlayItem);
    var ring = null, sat = null, wings = null, proxyScale = 0;
    var light = { dir: vnorm([-0.55, 0.45, 0.7]), key: '#d8c9a6', ambient: '#4f5d78' };
    if (objective === 'solar') {
      var sunPos = sunPlacement(rFit);
      items.push({ mesh: L.emit(L.sphere(0.11 * rFit, 1, 'glow')), pos: sunPos });
      light.dir = vnorm(sunPos);
    }
    if (orbit) {
      ring = ringMesh(orbit, 0.009 * rFit, 44, 'glowCool');
      items.push({ mesh: ring, pos: [0, 0, 0] });
      proxyScale = 0.26 * rFit / 1.13 / 2.3;
      sat = { mesh: proxyMeshes().body, pos: [0, 0, 0], rot: [0, 0, 0], scale: proxyScale };
      wings = { mesh: proxyMeshes().wings, pos: [0, 0, 0], rot: [0, 0, 0], scale: proxyScale };
      items.push(sat, wings);
    }
    var beltItem = belts ? { mesh: belts, pos: [0, 0, 0], rot: [0, 0, 0] } : null;
    if (beltItem) items.push(beltItem);
    var label = earthLabel(orbit, objective);
    var scene = {
      items: items,
      camera: { yaw: CAM_YAW, pitch: CAM_PITCH, fov: CAM_FOV, target: [0, 0, 0], dist: fitDist(rFit, CAM_FOV, 0.9) },
      light: light,
      background: { color: 'space', stars: true, seed: 7 },
      label: label
    };
    var time = 0;
    function pose(tm) {
      time = num(tm, 0);
      var th = theta0 + spin * time;
      earthItem.rot = [0, th, 0];
      if (overlayItem) overlayItem.rot = [0, th + (cloudy ? 0.25 * spin * time : 0), 0];
      if (beltItem) beltItem.rot = [0, -0.4 * spin * time, 0];   // trapped particles drift around Earth
      if (orbit) {
        var u = orbit.geostationary ? th + geoLongitude() : orbit.u0 + spin * orbit.laps_per_turn * time;
        var P = orbitPose(orbit, u), W = sunTrack(P, light.dir);
        sat.pos = P.pos; wings.pos = P.pos;
        sat.rot = eulerFromAxes(P.X, P.Y, P.Z);
        wings.rot = eulerFromAxes(W.X, W.Y, W.Z);
      }
      return wrapper;
    }
    function update(t, dt) {
      if (spin === 0 || reducedMotion()) return false;
      var step = num(dt, 0);
      if (!(step > 0)) return false;
      pose(time + Math.min(step, 0.25));
      return true;
    }
    function fit(w, h) {
      var aspect = (w > 0 && h > 0) ? w / h : 1;
      scene.camera.dist = fitDist(rFit, scene.camera.fov || CAM_FOV, Math.min(0.9, aspect * 0.95));
      return wrapper;
    }
    var wrapper = {
      scene: scene, update: update, label: label, pose: pose, fit: fit,
      orbit: orbit ? { id: orbit.id, altitude_km: orbit.altitude_km, inclination_deg: orbit.inclination_deg, radius: orbit.radius, laps_per_turn: orbit.laps_per_turn } : null,
      meshes: { globe: globe, ring: ring, satellite: orbit ? L.merge([proxyMeshes().body, proxyMeshes().wings]) : null, overlay: overlay || belts }
    };
    pose(0);
    return wrapper;
  };

  // ===================================================================== scene: title
  // The hero satellite (body frame: nadir -Y, aft +Z, wings along X): a gold bus with a white
  // radiator, two wings of two panels with cell grids, a dish on the top deck and a camera barrel
  // looking down at Earth.
  var heroCache = null;
  function quadZ(x0, y0, x1, y1, z, c, back) {
    return back ? L.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], c) : L.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], c);
  }
  function heroSatellite() {
    if (heroCache) return heroCache;
    var p = [], k, sgn;
    p.push(L.box(1.1, 1.3, 1.1, 'gold'));
    p.push(L.move(L.box(1.18, 0.1, 1.18, 'white'), 0, 0.7, 0));
    p.push(L.move(L.box(1.16, 0.08, 1.16, 'graphite'), 0, -0.69, 0));
    p.push(quadZ(-0.4, -0.48, 0.4, 0.46, 0.551, 'white'));                 // radiator on the aft face
    p.push(quadZ(-0.4, -0.06, 0.4, -0.02, 0.552, 'silver'));
    p.push(quadZ(-0.4, 0.22, 0.4, 0.26, 0.552, 'silver'));
    p.push(quadZ(0.24, -0.4, 0.32, -0.32, 0.553, 'glow'));                 // status light
    p[p.length - 1] = L.emit(p[p.length - 1]);
    for (sgn = -1; sgn <= 1; sgn += 2) {
      p.push(L.move(L.box(0.56, 0.07, 0.07, 'silver'), sgn * 0.83, 0.1, 0));   // yoke
      for (k = 0; k < 2; k++) {
        var cx = sgn * (1.62 + k * 1.04);
        p.push(L.move(L.box(1.0, 0.92, 0.05, 'cellEdge'), cx, 0.1, 0));
        p.push(L.move(quadZ(-0.46, -0.42, 0.46, 0.42, 0.026, 'cell'), cx, 0.1, 0));
        p.push(L.move(quadZ(-0.168, -0.42, -0.142, 0.42, 0.027, 'cellEdge'), cx, 0.1, 0));
        p.push(L.move(quadZ(0.142, -0.42, 0.168, 0.42, 0.027, 'cellEdge'), cx, 0.1, 0));
        p.push(L.move(quadZ(-0.46, -0.013, 0.46, 0.013, 0.028, 'cellEdge'), cx, 0.1, 0));
        p.push(L.move(quadZ(-0.46, -0.42, 0.46, 0.42, -0.026, 'cell', true), cx, 0.1, 0));
      }
    }
    // dish on a short mast, looking up and aft
    var dish = L.merge([
      L.lathe([[0, 0], [0.24, 0.045], [0.44, 0.15]], 9, 'white', true),
      L.move(L.cylinder(0.012, 0.012, 0.32, 3, 'silver', { capTop: false, capBottom: false }), 0, 0.16, 0),
      L.move(L.cone(0.05, 0.08, 4, 'graphite'), 0, 0.33, 0)
    ]);
    p.push(L.move(L.cylinder(0.04, 0.04, 0.3, 4, 'silver', { capTop: false, capBottom: false }), 0.22, 0.9, -0.2));
    p.push(L.move(L.rotate(dish, 50, 0, 0), 0.22, 1.05, -0.2));
    p.push(L.move(L.box(0.18, 0.16, 0.18, 'black'), -0.36, 0.83, 0.3));      // star tracker
    // camera barrel on the nadir deck
    p.push(L.move(L.cylinder(0.2, 0.22, 0.34, 6, 'metalDark'), 0, -0.9, 0));
    p.push(L.move(L.rotate(L.disc(0.15, 6, 'black'), 180, 0, 0), 0, -1.072, 0));
    heroCache = L.merge(p);
    return heroCache;
  }

  function camEye(cam) {
    var y = cam.yaw * DEG, pt = cam.pitch * DEG, t = cam.target;
    return [t[0] + cam.dist * Math.sin(y) * Math.cos(pt), t[1] + cam.dist * Math.sin(pt), t[2] + cam.dist * Math.cos(y) * Math.cos(pt)];
  }
  // Satellite axes: zenith away from Earth's centre, aft turned 'turn' degrees from the camera.
  function heroAxes(C, T, E, turn) {
    var Y = vnorm(vsub(T, C)), toCam = vsub(E, T);
    var Z0 = vnorm(vsub(toCam, vscl(Y, vdot(toCam, Y)))), X0 = vcross(Y, Z0), a = turn * DEG;
    var Z = vadd(vscl(Z0, Math.cos(a)), vscl(X0, Math.sin(a)));
    return { X: vcross(Y, Z), Y: Y, Z: Z };
  }

  // Title layout: Earth radius, camera, apparent radius of the Earth (degrees), where its top edge
  // sits below the centre of the picture (share of the half-height), the point under the camera
  // (off West Africa) and the heading up the picture, and how far the satellite is turned.
  var TITLE = { RE: 40, fov: 28, yaw: 34, pitch: 4, dist: 15, ty: -0.45, appR: 55, limb: 0.45, lon: -22, lat: 16, heading: 35, turn: -38 };
  // How far the title camera may be turned from its start (degrees).
  var YAW_WINDOW = [-45, 45], PITCH_WINDOW = [-8, 30];
  var titleCache = null;
  function titleWorld() {
    if (titleCache) return titleCache;
    var o = TITLE, RE = o.RE;
    var cam = { yaw: o.yaw, pitch: o.pitch, dist: o.dist, target: [0, o.ty || 0, 0], fov: o.fov };
    var E = camEye(cam), view = vnorm(vsub(cam.target, E)), horiz = vnorm([view[0], 0, view[2]]);
    var viewEl = Math.asin(clamp(view[1], -1, 1)), angR = o.appR * DEG;
    var cEl = viewEl - o.limb * o.fov / 2 * DEG - angR, dEC = RE / Math.sin(angR);
    var C = vadd(E, vscl(vadd(vscl(horiz, Math.cos(cEl)), [0, Math.sin(cEl), 0]), dEC));
    // Earth frame at the point under the camera (lon, lat), turned so 'heading' points up the picture.
    var s = vnorm(vsub(E, C)), f = vnorm(vsub(horiz, vscl(s, vdot(horiz, s)))), w = vcross(f, s);
    var lam = o.lon * DEG, phi = o.lat * DEG, hd = o.heading * DEG;
    var ue = geo(o.lon, o.lat), northE = [-Math.sin(phi) * Math.sin(lam), Math.cos(phi), -Math.sin(phi) * Math.cos(lam)];
    var eastE = [Math.cos(lam), 0, -Math.sin(lam)];
    var fe = vadd(vscl(northE, Math.cos(hd)), vscl(eastE, Math.sin(hd))), we = vcross(fe, ue);
    var R = [], i, j, Wc = [f, s, w], Ec = [fe, ue, we];
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) R[i * 3 + j] = Wc[0][i] * Ec[0][j] + Wc[1][i] * Ec[1][j] + Wc[2][i] * Ec[2][j];
    function toWorld(p) { return vadd(C, vscl(mapply(R, p), RE)); }
    var cosFov = Math.cos(60 * DEG);
    function keep(d) {
      var dw = mapply(R, d), pw = vadd(C, vscl(dw, RE)), toEye = vnorm(vsub(E, pw));
      return vdot(dw, toEye) > -0.08 && vdot(vscl(toEye, -1), view) > cosFov;
    }
    // the finest geodesic whose visible part stays within the Earth budget
    var G8 = geodesic(8), kept = 0, k;
    for (k = 0; k < G8.F.length; k++) {
      var a = G8.V[G8.F[k][0]], b = G8.V[G8.F[k][1]], c = G8.V[G8.F[k][2]];
      if (keep(vnorm(vadd(vadd(a, b), c)))) kept++;
    }
    var n = Math.max(6, Math.min(30, Math.floor(8 * Math.sqrt(520 / Math.max(1, kept)))));
    var globe = buildGlobe({ n: n, wobble: 0.0035, seed: 9, keep: keep, place: toWorld });
    while (globe.tris.length > 560 && n > 6) { n--; globe = buildGlobe({ n: n, wobble: 0.0035, seed: 9, keep: keep, place: toWorld }); }
    // clouds over the part you can see
    var rnd = L.rng(23), clouds = [], tries = 0;
    while (clouds.length < 14 && tries++ < 400) {
      var lon = o.lon + (rnd() - 0.5) * 120, lat = o.lat + (rnd() - 0.2) * 70;
      if (lat > 70 || lat < -60 || !keep(geo(lon, lat))) continue;
      var bank = cloudBank([lon, lat, 0.15 + rnd() * 0.12, (rnd() - 0.5) * 40], 1.004, 200 + clouds.length);
      clouds.push({ tris: bank.tris.map(function (t) { return { v: t.v.map(toWorld), c: t.c, e: t.e }; }) });
    }
    // a thin band of air along the horizon: an annulus in the plane of the limb seen from the camera
    var ax = vnorm(vsub(E, C)), dist = vlen(vsub(E, C)), Pc = vadd(C, vscl(ax, RE * RE / dist));
    var rho = RE * Math.sqrt(1 - (RE * RE) / (dist * dist)), u0 = vnorm(vsub([0, 1, 0], vscl(ax, ax[1]))), v0 = vcross(ax, u0);
    var air = [], behind = vsub(Pc, ax), seg = 36;
    for (k = 0; k < seg; k++) {
      var p0 = (-105 + 210 * k / seg) * DEG, p1 = (-105 + 210 * (k + 1) / seg) * DEG;
      var d0 = vadd(vscl(u0, Math.cos(p0)), vscl(v0, Math.sin(p0))), d1 = vadd(vscl(u0, Math.cos(p1)), vscl(v0, Math.sin(p1)));
      var i0 = vadd(Pc, vscl(d0, rho * 0.99)), i1 = vadd(Pc, vscl(d1, rho * 0.99)), o0 = vadd(Pc, vscl(d0, rho * 1.018)), o1 = vadd(Pc, vscl(d1, rho * 1.018));
      air.push(triOut(i0, o0, o1, 'sky', behind, 0), triOut(i0, o1, i1, 'sky', behind, 0));
    }
    var out = {
      cam: cam, E: E, C: C, globe: globe, n: n, clouds: clouds.length ? L.merge(clouds) : { tris: [] }, air: { tris: air },
      backing: L.move(L.sphere(RE * 0.985, 1, 'sea'), C[0], C[1], C[2]), turn: o.turn
    };
    titleCache = out;
    return out;
  }

  L.scenes.title = function (opts) {
    opts = opts || {};
    var W = titleWorld(), T = [0, 0, 0];
    var satMesh = (opts.mesh && opts.mesh.tris && opts.mesh.tris.length) ? opts.mesh : heroSatellite();
    var sat = { mesh: satMesh, pos: T, rot: [0, 0, 0] };
    var light = { dir: vnorm([-0.5, 0.55, 0.68]), key: '#dccdaa', ambient: '#46536b' };
    var airItem = { mesh: W.air, hidden: false };
    var label = 'A satellite in orbit high above Earth, its solar wings spread, with the curve of the planet and its clouds below and stars beyond.';
    var scene = {
      items: [{ mesh: W.backing }, airItem, { mesh: W.globe }, { mesh: W.clouds }, sat],
      camera: { yaw: W.cam.yaw, pitch: W.cam.pitch, dist: W.cam.dist, target: W.cam.target.slice(), fov: W.cam.fov },
      light: light,
      background: { color: 'space', stars: true, seed: 11 },
      label: label
    };
    var drift = opts.drift !== false, time = 0, lastYaw = 0, lastPitch = 0;
    function poseSat(tm) {
      var ax = heroAxes(W.C, T, W.E, W.turn + 7 * Math.sin(tm * 2 * Math.PI / 41));
      sat.rot = eulerFromAxes(ax.X, ax.Y, ax.Z);
    }
    poseSat(0);
    // Keep the camera where the scene was built to be seen (a deep drag down would put the eye
    // inside the Earth, a wide one behind the visible part of it). Runs before each draw, so a drag
    // or arrow key is held at the edge of this window too.
    function hold() {
      var cam = scene.camera, y = clamp(num(cam.yaw, TITLE.yaw), TITLE.yaw + YAW_WINDOW[0], TITLE.yaw + YAW_WINDOW[1]);
      var pt = clamp(num(cam.pitch, TITLE.pitch), TITLE.pitch + PITCH_WINDOW[0], TITLE.pitch + PITCH_WINDOW[1]);
      // the air band is drawn for the limb seen from near the start; tipped well away it would float
      var airOff = Math.abs(pt - TITLE.pitch) > 12 || Math.abs(y - TITLE.yaw) > 30, changed = airOff !== airItem.hidden;
      airItem.hidden = airOff;
      if (y === cam.yaw && pt === cam.pitch) return changed;
      cam.yaw = y; cam.pitch = pt;
      return true;
    }
    function update(t, dt) {
      var held = hold();
      if (!drift || reducedMotion()) return held;
      var step = num(dt, 0);
      if (!(step > 0)) return held;
      time += Math.min(step, 0.25);
      // camera drift as increments, so a drag by the player is kept
      var y = 6 * Math.sin(time * 2 * Math.PI / 47), pt = 1.6 * Math.sin(time * 2 * Math.PI / 29);
      scene.camera.yaw += y - lastYaw; scene.camera.pitch += pt - lastPitch;
      lastYaw = y; lastPitch = pt;
      hold();
      poseSat(time);
      return true;
    }
    function fit(w, h) {
      var aspect = (w > 0 && h > 0) ? w / h : 1, base = TITLE.fov;
      // narrower than square: open the field of view so the wings still fit across
      scene.camera.fov = aspect >= 0.95 ? base : 2 * Math.atan(Math.tan(base * DEG / 2) * 0.95 / aspect) / DEG;
      return wrapper;
    }
    var wrapper = { scene: scene, update: update, label: label, fit: fit, meshes: { globe: W.globe, clouds: W.clouds, air: W.air, backing: W.backing, satellite: satMesh } };
    return wrapper;
  };
})();
