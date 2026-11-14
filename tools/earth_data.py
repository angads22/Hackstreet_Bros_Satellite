"""Rebuild the numbers in data/earth.js from the original NASA and NSIDC files.

Not part of the game (the game needs no build step). Run with Python 3:

  1. Download https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2025_all_countries.zip
  2. Download https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_MM_extent_v4.0.csv
     for MM = 01..12 into one folder.
  3. python3 tools/earth_data.py modis_2025_all_countries.zip path/to/nsidc_folder
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

if __name__ == "__main__":
    fires(sys.argv[1])
    sea_ice(sys.argv[2])
    daylight()
