# Caraibes - site "Flibuste & Champagne"

Site du voyage en catamaran Martinique -> Saint-Vincent-et-les-Grenadines (27 nov. - 7 déc. 2026).
Publié sur GitHub Pages (dépôt public soyuz-75/flibuste-champagne, branche main, dossier docs/) :
https://soyuz-75.github.io/flibuste-champagne/  (noindex + robots.txt, mais public pour qui a le lien).
L'ancien Artifact claude.ai (https://claude.ai/artifact/XYuepLnqEPFhxZEDGY3e4b) n'est plus mis à jour.

- `template.html` : source de la page (CSS, contenu, plans de navigation PLANS/W/K, listes). Ne pas nommer
  une constante globale `L` : elle masquerait Leaflet.
- `docs/carte.js` : carte marine Leaflet (fonds Esri/OSM, OpenSeaMap, calques GeoJSON, météo Open-Meteo
  en direct, fiches de mouillage avec abri calculé, ETA, mesure, position, mode nuit). API `window.Carte`.
- `docs/routage.js` : routage météo par isochrones (polaire approchée Excess 11, masque `data/masque.json`
  avec marge ~0,5 mille, alizé climatologique au-delà de la prévision). API `window.Routage`.
- `docs/instruments.js` : écran Compas plein écran (orientation de l'appareil, GPS partagé via `Nav.gpsDemarrer`). 
- `docs/meteo.js` : vue « La Météo » (Open-Meteo 16 jours, 8 escales + 2 canaux, abri de nuit à 22 h).
- carte.js expose `window.Nav` (fonctions et données partagées) et émet `nav:meteo`, `nav:pos`, `nav:etape`, `nav:plan`.
- `docs/data/` : `mouillages.json` (fiches écrites à la main, à vérifier) et GeoJSON générés par
  `data/fetch_osm.py` (Overpass), `data/fetch_bathy.py` (ETOPO 2022, NOAA ERDDAP) et `data/build_masque.py`. Bruts dans `data/raw/` (ignoré).
- `build.py` : template.html -> docs/index.html, copie img/ -> docs/img, robots.txt, .nojekyll, et
  `sw.js` (racine) -> `docs/sw.js` en remplaçant __VERSION__ (date du build) et __COQUILLE__ (fichiers de docs/).
  Toujours relancer build.py après avoir ajouté un fichier dans docs/, sinon il manque au hors-ligne.
- Web app iPhone : `docs/manifest.webmanifest`, icônes `docs/icones/` (régénérer : `python3 data/build_icones.py`),
  service worker (fichiers du site réseau d'abord, tuiles en cache `fc-tuiles` gardé entre versions).
- `docs/horsligne.js` : bouton « Télécharger la carte pour le hors-ligne » (onglet Outils), ~2 200 tuiles.
- Plein écran de la carte : bouton sous le compas, tiroir en bas sur mobile (carte.js, `pleinEcran`, `tiroir`).
- Publier : `python3 build.py`, commit, `git push` (Pages se met à jour en 1-2 min).
- Test local : `.claude/launch.json` (python http.server sur docs/, port 8791).
- Les cases à cocher sont en localStorage (propres à chaque appareil).
