#!/usr/bin/env python3
"""Photos des poissons de la page Pêche, depuis Wikimedia Commons (licences libres).

Pour chaque espèce : image principale de l'article Wikipédia anglais (ou fichier Commons imposé),
vignette de 640 px enregistrée dans docs/img/poissons/<id>.jpg, auteur et licence dans
docs/data/poissons-credits.json (affichés sous chaque photo).
"""
import json
import time
import re
import subprocess
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "img" / "poissons"
CREDITS = ROOT / "docs" / "data" / "poissons-credits.json"
UA = "flibuste-champagne-site/1.0 (site familial, usage non commercial)"

# id (utilisé par peche.js) -> article Wikipédia anglais, ou "File:..." pour imposer une photo Commons
ESPECES = {
    "coryphene": "Mahi-mahi",
    "thazard": "Wahoo",
    "thon-jaune": "Yellowfin tuna",
    "thon-noir": "Blackfin tuna",
    "vivaneau": "Silk snapper",
    "colas": "Yellowtail snapper",
    "poisson-lion": "Red lionfish",
    "langouste": "Caribbean spiny lobster",
    "lambi": "Queen conch",
    "bonite": "Skipjack tuna",
    "thazard-batard": "King mackerel",
    "balaou": "Ballyhoo (fish)",
    "poisson-volant": "Flying fish",
    "marlin": "Atlantic blue marlin",
    "carangue": "Crevalle jack",
    "merou": "Nassau grouper",
    "perroquet": "Stoplight parrotfish",
    "chirurgien": "Acanthurus coeruleus",
    "barracuda": "Great barracuda",
    "seriole": "Greater amberjack",
    "murene": "Green moray",
    "ballon": "Porcupinefish",
    "requin": "Caribbean reef shark",
}
FORCER = {  # id -> "File:Nom.jpg" si la photo de l'article ne convient pas (dessin, bocal, poisson mort…)
    "thazard": "File:Acanthocybium solandri Canary.jpg",
    "thon-jaune": "File:Thunnus albacares 247699300.jpg",
    "thon-noir": "File:Thunnus atlanticus 593037314 (cropped).jpg",
    "vivaneau": "File:Lutjanus vivanus SI3.jpg",
    "bonite": "File:Katsuwonus pelamis Thailand.jpg",
    "thazard-batard": "File:King mackerel ( Scomberomorus cavalla ).jpg",
    "balaou": "File:Hemiramphus brasiliensis 63969255.jpg",
    "poisson-volant": "File:Cheilopogon melanurusPCCA20070623-3956B.jpg",
}


def get(url):
    """curl avec pause et reprises : Wikimedia limite le débit (429, connexion coupée)."""
    for essai in range(6):
        time.sleep(3 + 10 * essai)
        r = subprocess.run(["curl", "-sS", "--fail", "-A", UA, url], capture_output=True)
        if r.returncode == 0:
            return r.stdout
        print(f"    (réseau {r.returncode}, nouvel essai)", flush=True)
    raise RuntimeError("échec : " + url)


def api(base, **p):
    p.update(format="json", formatversion="2")
    return json.loads(get(base + "?" + urllib.parse.urlencode(p)))


def fichier_de(titre):
    r = api("https://en.wikipedia.org/w/api.php", action="query", prop="pageimages", piprop="name", titles=titre, redirects=1)
    page = r["query"]["pages"][0]
    return "File:" + page["pageimage"] if "pageimage" in page else None


def texte(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    credits = json.loads(CREDITS.read_text()) if CREDITS.exists() else {}
    import sys
    seulement = set(sys.argv[1:])
    for id_, titre in ESPECES.items():
        if seulement and id_ not in seulement:
            continue
        if not seulement and id_ in credits and (OUT / f"{id_}.jpg").exists() and credits[id_]["fichier"] == (FORCER.get(id_) or credits[id_]["fichier"]):
            continue
        f = FORCER.get(id_) or fichier_de(titre)
        if not f:
            print(f"  ?? {id_}: pas d'image pour {titre}")
            continue
        r = api("https://commons.wikimedia.org/w/api.php", action="query", prop="imageinfo", titles=f,
                iiprop="url|extmetadata|mime", iiurlwidth=640)
        info = r["query"]["pages"][0]["imageinfo"][0]
        meta = info.get("extmetadata", {})
        url = info.get("thumburl") or info["url"]
        if info.get("mime") == "image/svg+xml" or url.endswith(".svg.png"):
            print(f"  !! {id_}: {f} est un dessin, à remplacer dans FORCER")
        (OUT / f"{id_}.jpg").write_bytes(get(url))
        credits[id_] = {
            "fichier": f,
            "page": info.get("descriptionshorturl") or "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(f.replace(" ", "_")),
            "auteur": texte(meta.get("Artist", {}).get("value"))[:80] or "inconnu",
            "licence": texte(meta.get("LicenseShortName", {}).get("value")) or "?",
        }
        print(f"  {id_:15} {f[:60]:60} {credits[id_]['licence']:14} {credits[id_]['auteur'][:30]}", flush=True)
        CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=1))
    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
