"""Rebuild the numbers in data/earth.js from the original NASA and NSIDC files.

Not part of the game (the game needs no build step). Run with Python 3:

  1. Download https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2025_all_countries.zip
  2. Download https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_MM_extent_v4.0.csv
     for MM = 01..12 into one folder.
  3. Download https://www.sidc.be/SILSO/INFO/snmtotcsv.php (monthly sunspot numbers).
  4. Alouette 1 ionograms: data/result_master.csv (CSA Open Data), already in the repo.
  5. python3 tools/earth_data.py modis_2025_all_countries.zip path/to/nsidc_folder SN_m_tot_V2.0.csv data/result_master.csv
"""
import csv, io, math, os, sys, zipfile

def fires(zip_path):
    z = zipfile.ZipFile(zip_path)
    pts, month = [], [0] * 12
    for name in z.namelist():
        if not name.endswith(".csv"):
            continue
        with z.open(name) as f:
            for row in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
                lat, lon = float(row["latitude"]), float(row["longitude"])
                pts.append((lat, lon))
                month[int(row["acq_date"][5:7]) - 1] += 1
    n = len(pts)

    def geo_view(lon0, max_arc=70):
        cm = math.cos(math.radians(max_arc))
        return sum(1 for la, lo in pts
                   if math.cos(math.radians(la)) * math.cos(math.radians(lo - lon0)) >= cm) / n

    print("detections", n)
    print("monthly_share", [round(m / n, 4) for m in month])
    print("leo (|lat| <= 50)", round(sum(1 for la, _ in pts if abs(la) <= 50) / n, 3))
    print("geo at 0E", round(geo_view(0), 3), " GOES-East 75.2W", round(geo_view(-75.2), 3))
    print("boreal_share (|lat| > 50)", round(sum(1 for la, _ in pts if abs(la) > 50) / n, 3))

def sea_ice(folder):
    now, base = [], []
    for m in range(1, 13):
        with open(os.path.join(folder, "N_%02d_extent_v4.0.csv" % m)) as f:
            rows = [r for r in csv.reader(f)][1:]
        vals = [(int(r[0]), float(r[4])) for r in rows if float(r[4]) > 0]
        now.append(dict(vals)[2025])
        old = [v for y, v in vals if 1981 <= y <= 2010]
        base.append(round(sum(old) / len(old), 2))
    print("extent_mkm2", now)
    print("extent_1981_2010_mkm2", base)

def daylight(lat_deg=75):
    phi, out = math.radians(lat_deg), []
    for day in [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]:
        dec = math.radians(23.44 * math.sin(math.radians(360 / 365 * (284 + day))))
        c = max(-1, min(1, -math.tan(phi) * math.tan(dec)))
        out.append(round(math.degrees(math.acos(c)) / 180, 2))
    print("daylight_share", out)



def sunspots(csv_path, first=1957, last=2025):
    """Monthly mean total sunspot number, version 2, from SILSO
    (https://www.sidc.be/SILSO/INFO/snmtotcsv.php, CC BY-NC 4.0)."""
    rows = {}
    with open(csv_path) as f:
        for r in csv.reader(f, delimiter=";"):
            y, m, v = int(r[0]), int(r[1]), float(r[3])
            if first <= y <= last:
                rows.setdefault(y, [0] * 12)[m - 1] = round(v, 1)
    print("sunspots start_year", first)
    for y in range(first, last + 1):
        print("  ", rows[y], "//", y)


def ionosphere(csv_path, max_lat=50):
    """Alouette 1 ionograms from the CSA (result_master.csv, CSA Open Data portal,
    https://donnees-data.asc-csa.gc.ca/users/OpenData_DonneesOuvertes/pub/Alouette-ISIS/Alouette-1/result/).
    One row per sounding: when it was taken and which ground station received it."""
    from collections import Counter, defaultdict
    by_year, by_month, by_station, st_year = Counter(), Counter(), Counter(), defaultdict(set)
    lat_of, name_of = {}, {}
    with open(csv_path) as f:
        for r in csv.DictReader(f):
            t = r["Timestamp"]
            y, m, code = int(t[:4]), int(t[5:7]), r["Station_Code"]
            by_year[y] += 1
            if 1963 <= y <= 1967:          # full years of operation, for the season
                by_month[m] += 1
            by_station[code] += 1
            st_year[y].add(code)
            la = r["Lat"]
            lat_of[code] = float(la[:-1]) * (1 if la.endswith("N") else -1) if la[-1:] in "NS" else 0.0
            name_of[code] = r["Station_Name"]
    n = sum(by_year.values())
    low = sum(c for k, c in by_station.items() if abs(lat_of[k]) <= max_lat)
    tot_m = sum(by_month.values())
    print("soundings", n, "stations", len(by_station))
    print("soundings_by_year", dict(sorted(by_year.items())))
    print("stations_by_year", {y: len(v) for y, v in sorted(st_year.items())})
    print("monthly_share", [round(by_month[m] / tot_m, 4) for m in range(1, 13)])
    print("orbit_view leo", round(low / n, 3))
    for k, c in by_station.most_common(6):
        print("  station", k, name_of[k], lat_of[k], c)


if __name__ == "__main__":
    fires(sys.argv[1])
    sea_ice(sys.argv[2])
    if len(sys.argv) > 3:
        sunspots(sys.argv[3])
    if len(sys.argv) > 4:
        ionosphere(sys.argv[4])
    daylight()
