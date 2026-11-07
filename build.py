#!/usr/bin/env python3
"""Construit le site publié : template.html -> docs/index.html, et copie les photos dans docs/img.

La carte marine vit dans docs/carte.js (Leaflet) et ses données dans docs/data/
(régénérées par data/fetch_osm.py et data/fetch_bathy.py).
"""
import shutil
from pathlib import Path

HERE = Path(__file__).parent
DOCS = HERE / "docs"

html = (HERE / "template.html").read_text(encoding="utf-8")
DOCS.mkdir(exist_ok=True)
(DOCS / "index.html").write_text(html, encoding="utf-8")
(DOCS / "img").mkdir(exist_ok=True)
for f in (HERE / "img").glob("*.jpg"):
    shutil.copy2(f, DOCS / "img" / f.name)
(DOCS / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
(DOCS / ".nojekyll").write_text("")
print("docs/index.html", len(html) // 1024, "Ko")
