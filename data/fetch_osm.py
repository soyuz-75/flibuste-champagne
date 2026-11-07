#!/usr/bin/env python3
"""Télécharge depuis OpenStreetMap (API Overpass) les dangers, le balisage, les zones
protégées et les zones de mouillage de la Martinique aux Grenadines.

Sorties dans docs/data/ : dangers.geojson, balisage.geojson, zones.geojson, osm_mouillages.geojson
"""
import json
import subprocess
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon, mapping
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "osm.json"
OUT = ROOT / "docs" / "data"
BBOX = "12.40,-61.80,14.95,-60.70"  # sud, ouest, nord, est

QUERY = f"""[out:json][timeout:240];
(
  nwr["seamark:type"~"^(rock|wreck|obstruction)$"]({BBOX});
  nwr["natural"="reef"]({BBOX});
  node["seamark:type"~"light|buoy|beacon"]({BBOX});
  nwr["seamark:type"~"^(anchorage|anchor_berth|mooring|restricted_area)$"]({BBOX});
  nwr["boundary"="protected_area"]({BBOX});
  nwr["leisure"="nature_reserve"]({BBOX});
  nwr["boundary"="marine_park"]({BBOX});
);
out geom;"""

KEEP = ("name", "seamark:type", "natural", "protect_class", "protection_title", "operator", "website",
        "seamark:rock:water_level", "seamark:wreck:water_level", "seamark:obstruction:water_level",
        "seamark:wreck:category", "seamark:depth", "seamark:restricted_area:restriction",
        "seamark:restricted_area:category", "seamark:anchorage:category")


def fetch():
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        print("requête Overpass…")
        # curl plutôt qu'urllib : le Python de python.org n'a pas les certificats système
        subprocess.run(["curl", "-sS", "--fail", "-m", "300", "-A", "flibuste-champagne-map/1.0",
                        "--data-urlencode", f"data={QUERY}", "-o", str(RAW),
                        "https://overpass-api.de/api/interpreter"], check=True)
    return json.loads(RAW.read_text())["elements"]


def geom(el):
    if el["type"] == "node":
        return Point(el["lon"], el["lat"])
    if el["type"] == "way":
        pts = [(p["lon"], p["lat"]) for p in el.get("geometry", [])]
        if len(pts) < 2:
            return None
        if len(pts) >= 4 and pts[0] == pts[-1]:
            return Polygon(pts)
        return LineString(pts)
    # relation : on reconstitue les polygones à partir des membres "outer"
    lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
             for m in el.get("members", []) if m.get("geometry") and m.get("role") in ("outer", "")
             and len(m["geometry"]) >= 2]
    if not lines:
        return None
    polys = list(polygonize(unary_union(lines)))
    return unary_union(polys) if polys else None


def light_label(t):
    """Caractère du feu, ex. Fl(2)R 6s."""
    ch = t.get("seamark:light:character") or t.get("seamark:light:1:character")
    if not ch:
        return None
    grp = t.get("seamark:light:group") or t.get("seamark:light:1:group")
    col = (t.get("seamark:light:colour") or t.get("seamark:light:1:colour") or "")
    per = t.get("seamark:light:period") or t.get("seamark:light:1:period")
    c = {"white": "W", "red": "R", "green": "G", "yellow": "Y"}.get(col.split(";")[0], "")
    return f"{ch}{f'({grp})' if grp else ''}{c}{f' {per}s' if per else ''}"


def feat(g, props, tol=0.0002):
    if g is None or g.is_empty:
        return None
    if g.geom_type != "Point":
        g = g.simplify(tol)

    def rnd(o):
        if isinstance(o, (list, tuple)):
            return [rnd(x) for x in o]
        return round(o, 5) if isinstance(o, float) else o
    m = mapping(g)
    return {"type": "Feature", "properties": props, "geometry": {"type": m["type"], "coordinates": rnd(m["coordinates"])}}


# zones terrestres ou trop vastes pour une carte de navigation
EXCLURE = ("forest", "forêt", "bois", "morne", "parc naturel régional", "agoa", "biologique", "étang", "galion",
           "grand macabou", "kings hill")
# zone absente d'OpenStreetMap, contour approximatif tracé à la main
TCMP = {"type": "Feature", "properties": {"name": "Tobago Cays Marine Park (contour approximatif)", "kind": "protected",
        "protection_title": "Parc marin : bouées et droits payants, zone des tortues interdite au mouillage"},
        "geometry": {"type": "Polygon", "coordinates": [[[-61.415, 12.668], [-61.33, 12.668], [-61.318, 12.635],
                     [-61.335, 12.608], [-61.415, 12.612], [-61.415, 12.668]]]}}


def main():
    out = {"dangers": [], "balisage": [], "zones": [], "osm_mouillages": []}
    for el in fetch():
        t = el.get("tags", {})
        st = t.get("seamark:type", "")
        props = {k.replace("seamark:", ""): v for k, v in t.items() if k in KEEP}
        props["osm"] = f"{el['type']}/{el['id']}"
        if st in ("rock", "wreck", "obstruction") or t.get("natural") == "reef":
            props["kind"] = st or "reef"
            out["dangers"].append(feat(geom(el), props))
        elif any(k in st for k in ("light", "buoy", "beacon")):
            props["kind"] = st
            lab = light_label(t)
            if lab:
                props["light"] = lab
            for k in ("colour", "shape", "category"):
                v = t.get(f"seamark:{st}:{k}")
                if v:
                    props[k] = v
            out["balisage"].append(feat(geom(el), props))
        elif st in ("anchorage", "anchor_berth", "mooring"):
            props["kind"] = st
            out["osm_mouillages"].append(feat(geom(el), props))
        else:
            props["kind"] = "restricted" if st == "restricted_area" else "protected"
            g = geom(el)
            nom = (t.get("name") or "").lower()
            if any(x in nom for x in EXCLURE):
                continue
            if g is not None and g.geom_type in ("Polygon", "MultiPolygon"):
                out["zones"].append(feat(g, props, 0.0005))
    out["zones"].append(TCMP)
    OUT.mkdir(parents=True, exist_ok=True)
    for k, v in out.items():
        v = [f for f in v if f]
        p = OUT / f"{k}.geojson"
        p.write_text(json.dumps({"type": "FeatureCollection", "features": v}, ensure_ascii=False, separators=(",", ":")))
        print(f"{p.name}: {len(v)} objets, {p.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
