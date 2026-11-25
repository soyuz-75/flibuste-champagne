#!/usr/bin/env python3
"""Sentiers de randonnée près des escales, depuis OpenStreetMap (Overpass).

Garde les itinéraires de randonnée (relations route=hiking) et les sentiers nommés
(highway=path/footway/track) à moins de 3 km d'une escale. Sortie : docs/data/randos.geojson
"""
import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "randos.json"
OUT = ROOT / "docs" / "data" / "randos.geojson"
BBOX = "12.45,-61.50,14.90,-60.80"

QUERY = f"""[out:json][timeout:240];
(
  relation["route"="hiking"]({BBOX});
  way["highway"~"^(path|footway|track)$"]["name"]({BBOX});
);
out geom;"""


def fetch():
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        print("requête Overpass…")
        subprocess.run(["curl", "-sS", "--fail", "-m", "300", "-A", "flibuste-champagne-map/1.0",
                        "--data-urlencode", f"data={QUERY}", "-o", str(RAW),
                        "https://overpass.kumi.systems/api/interpreter"], check=True)
    return json.loads(RAW.read_text())["elements"]


def km(a, b):
    dy = (a[1] - b[1]) * 111.2
    dx = (a[0] - b[0]) * 111.2 * math.cos(math.radians(a[1]))
    return math.hypot(dx, dy)


def longueur(coords):
    return sum(km(coords[i - 1], coords[i]) for i in range(1, len(coords)))


def main():
    escales = [(m["lon"], m["lat"]) for m in json.loads((ROOT / "docs/data/mouillages.json").read_text())["mouillages"]
               if m.get("type") != "secours"]
    pres = lambda c: min(km(c, e) for e in escales) < 3.0
    feats = []
    for el in fetch():
        t = el.get("tags", {})
        if el["type"] == "relation":
            lignes = [[(round(p["lon"], 5), round(p["lat"], 5)) for p in m["geometry"]]
                      for m in el.get("members", []) if m["type"] == "way" and m.get("geometry")]
            genre = "itineraire"
        else:
            lignes = [[(round(p["lon"], 5), round(p["lat"], 5)) for p in el.get("geometry", [])]]
            genre = "sentier"
        lignes = [l for l in lignes if len(l) >= 2]
        if not lignes or not any(pres(c) for l in lignes for c in l[:: max(1, len(l) // 6)]):
            continue
        lg = sum(longueur(l) for l in lignes)
        if lg < 0.3:
            continue
        feats.append({"type": "Feature",
                      "properties": {"nom": t.get("name") or t.get("ref") or "Sentier", "genre": genre,
                                     "km": round(lg, 1), "difficulte": t.get("sac_scale") or t.get("osmc:symbol") and "" or ""},
                      "geometry": {"type": "MultiLineString", "coordinates": lignes}})
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(feats)} sentiers, {OUT.stat().st_size // 1024} Ko")
    for f in sorted(feats, key=lambda f: -f["properties"]["km"])[:25]:
        p = f["properties"]; c = f["geometry"]["coordinates"][0][0]
        print(f"  {p['genre']:10} {p['km']:5} km  {p['nom']}  ({c[1]:.3f}, {c[0]:.3f})")


if __name__ == "__main__":
    main()
