#!/usr/bin/env python3
"""Masque de navigation pour le routage : terre, fonds de moins de 2,5 m et récifs OSM.

Entrées : data/raw/etopo_15s.csv (voir fetch_bathy.py) et docs/data/dangers.geojson (voir fetch_osm.py).
Sortie : docs/data/masque.json  {lat0, lon0, pas, nla, nlo, bits}  bits = base64, ligne par ligne
depuis le sud, bit de poids fort en premier ; 1 = interdit.
"""
import base64
import csv
import io
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, shape
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "etopo_15s.csv"
DANGERS = ROOT / "docs" / "data" / "dangers.geojson"
OUT = ROOT / "docs" / "data" / "masque.json"
SEUIL = -2.5  # m : tirant d'eau de 1,15 m plus une marge


def main():
    rows = list(csv.reader(io.StringIO(RAW.read_text())))[2:]
    lat = np.array([float(r[0]) for r in rows])
    lon = np.array([float(r[1]) for r in rows])
    z = np.array([float(r[2]) if r[2] not in ("", "NaN") else 0.0 for r in rows])
    la, lo = np.unique(lat), np.unique(lon)
    Z = np.zeros((la.size, lo.size))
    Z[np.searchsorted(la, lat), np.searchsorted(lo, lon)] = z
    M = Z > SEUIL
    print("grille", M.shape, "cases interdites par la bathymétrie :", int(M.sum()))

    pas = float(lo[1] - lo[0])
    n = 0
    for f in json.loads(DANGERS.read_text())["features"]:
        g = shape(f["geometry"])
        if g.geom_type == "Point":
            g = g.buffer(pas * 0.6)
        else:
            g = g.buffer(pas * 0.3)
        x0, y0, x1, y1 = g.bounds
        j0, j1 = np.searchsorted(lo, x0) - 1, np.searchsorted(lo, x1) + 1
        i0, i1 = np.searchsorted(la, y0) - 1, np.searchsorted(la, y1) + 1
        pg = prep(g)
        for i in range(max(i0, 0), min(i1, la.size)):
            for j in range(max(j0, 0), min(j1, lo.size)):
                if not M[i, j] and pg.intersects(Point(lo[j], la[i]).buffer(pas / 2, 4)):
                    M[i, j] = True
                    n += 1
    print("cases ajoutées par les récifs et roches :", n)

    bits = np.packbits(M.astype(np.uint8).ravel())
    OUT.write_text(json.dumps({"lat0": round(float(la[0]), 7), "lon0": round(float(lo[0]), 7), "pas": pas,
                               "nla": int(la.size), "nlo": int(lo.size),
                               "bits": base64.b64encode(bits.tobytes()).decode()}))
    print(OUT.name, OUT.stat().st_size // 1024, "Ko")


if __name__ == "__main__":
    main()
