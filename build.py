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

# service worker versionné : la liste des fichiers du site est mise en cache pour le hors-ligne
import json, time
fichiers = sorted(str(f.relative_to(DOCS)) for f in DOCS.rglob("*")
                  if f.is_file() and f.name not in ("sw.js", "robots.txt", ".nojekyll", ".DS_Store"))
sw = (HERE / "sw.js").read_text(encoding="utf-8")
sw = sw.replace("__VERSION__", time.strftime("%Y%m%d-%H%M%S")).replace("__COQUILLE__", json.dumps(fichiers, ensure_ascii=False))
(DOCS / "sw.js").write_text(sw, encoding="utf-8")
print("docs/sw.js", len(fichiers), "fichiers en cache")
print("docs/index.html", len(html) // 1024, "Ko")
