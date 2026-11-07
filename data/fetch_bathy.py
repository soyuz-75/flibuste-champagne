#!/usr/bin/env python3
"""Télécharge la grille ETOPO 2022 15" (NOAA ERDDAP) de la zone et en tire les isobathes.

Sortie : docs/data/isobathes.geojson (lignes, propriété depth en mètres positifs).
"""
import csv
import io
import json
import subprocess
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from shapely.geometry import LineString

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "etopo_15s.csv"
OUT = ROOT / "docs" / "data" / "isobathes.geojson"
S, N, W, E = 12.40, 14.95, -61.80, -60.70
LEVELS = [5, 10, 20, 50, 100, 200, 500, 1000]

URL = ("https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.csv"
       f"?z[({S}):1:({N})][({W}):1:({E})]")


def grid():
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        print("téléchargement", URL)
        subprocess.run(["curl", "-sS", "--fail", "-m", "300", "-g", "-o", str(RAW), URL], check=True)
    rows = list(csv.reader(io.StringIO(RAW.read_text())))[2:]  # en-tête + unités
    lat = np.array([float(r[0]) for r in rows])
    lon = np.array([float(r[1]) for r in rows])
    z = np.array([float(r[2]) if r[2] not in ("", "NaN") else np.nan for r in rows])
    la, lo = np.unique(lat), np.unique(lon)
    Z = np.full((la.size, lo.size), np.nan)
    Z[np.searchsorted(la, lat), np.searchsorted(lo, lon)] = z
    return la, lo, Z


def main():
    la, lo, Z = grid()
    print("grille", Z.shape, "min", np.nanmin(Z), "max", np.nanmax(Z))
    cs = plt.contour(lo, la, Z, levels=sorted(-d for d in LEVELS))
    feats = []
    for level, segs in zip(cs.levels, cs.allsegs):
        depth = int(round(-level))
        tol = 0.0008 if depth <= 20 else 0.0015
        for seg in segs:
            if len(seg) < 4:
                continue
            line = LineString(seg).simplify(tol)
            if line.length < 0.01:  # on écarte les petits îlots de bruit
                continue
            coords = [[round(x, 4), round(y, 4)] for x, y in line.coords]
            feats.append({"type": "Feature", "properties": {"depth": depth},
                          "geometry": {"type": "LineString", "coordinates": coords}})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")))
    print(OUT.name, len(feats), "lignes,", OUT.stat().st_size // 1024, "Ko")


if __name__ == "__main__":
    main()
