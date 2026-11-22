#!/usr/bin/env python3
"""Icônes de la web app : docs/icones/icone.svg (+ variante maskable) -> PNG via Chrome sans interface."""
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "icones"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

MOTIF = """<defs><linearGradient id="ver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4d788"/><stop offset="1" stop-color="#8f6f2e"/></linearGradient></defs>
<path fill="#f3eee2" d="M160 34c-34 0-54 22-54 50 0 18 8 31 20 39v12c0 5 4 8 8 8h52c4 0 8-3 8-8v-12c12-8 20-21 20-39 0-28-20-50-54-50z"/>
<g stroke="#07141c" stroke-width="2.5"><path d="M144 126v17M160 126v17M176 126v17"/></g>
<path d="M160 104l-7 12h14z" fill="#07141c"/>
<g stroke="#d9b05a" stroke-width="2.6" fill="url(#ver)">
<path d="M112 76c10-5 30-5 38 0 2 12-2 28-20 28-13 0-22-14-18-28z"/>
<path d="M208 76c-10-5-30-5-38 0-2 12 2 28 20 28 13 0 22-14 18-28z"/></g>
<path d="M150 78c6-3 14-3 20 0M112 76l-10-3M208 76l10-3" stroke="#d9b05a" stroke-width="2.6" fill="none"/>
""" + "".join(f"""<g transform="translate(160 184) rotate({a})">
<path d="M-7-62h14l-2 34c-1 6-3 8-5 8s-4-2-5-8z" fill="#f3eee2"/><path d="M-5.5-52h11l-1.4 23c-1 5-2 6-4 6s-3-1-4-6z" fill="#d9b05a"/>
<rect x="-1" y="-20" width="2" height="40" fill="#f3eee2"/><rect x="-11" y="20" width="22" height="3" rx="1.5" fill="#f3eee2"/></g>""" for a in (62, -62))


def svg(echelle, anneau=True):
    cercle = '<circle cx="256" cy="256" r="226" fill="none" stroke="#d9b05a" stroke-width="6"/>' if anneau else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" fill="#07141c"/>{cercle}
<g transform="translate(256 262) scale({echelle}) translate(-160 -128)">{MOTIF}</g></svg>"""


def rendre(contenu, taille, sortie):
    with tempfile.TemporaryDirectory() as d:
        h = Path(d) / "i.html"
        h.write_text(f'<html><body style="margin:0;background:#07141c">'
                     f'<div style="width:{taille}px;height:{taille}px">{contenu.replace(chr(10), "").replace("width=\"512\" height=\"512\"", f"width=\"{taille}\" height=\"{taille}\"")}</div></body></html>')
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={taille},{taille}",
                        f"--screenshot={sortie}", h.as_uri()], check=True, capture_output=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    normal, masque = svg(1.62), svg(1.3, anneau=False)
    (OUT / "icone.svg").write_text(normal)
    for t in (180, 192, 512):
        rendre(normal, t, OUT / f"icone-{t}.png")
    rendre(masque, 512, OUT / "icone-maskable-512.png")
    print(sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()
