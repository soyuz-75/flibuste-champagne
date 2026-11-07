# Caraibes - site "Flibuste & Champagne"

Site du voyage en catamaran Martinique -> Saint-Vincent-et-les-Grenadines (27 nov. - 7 déc. 2026).
Publié sur GitHub Pages (dépôt public soyuz-75/flibuste-champagne, branche main, dossier docs/) :
https://soyuz-75.github.io/flibuste-champagne/  (noindex + robots.txt, mais public pour qui a le lien).
L'ancien Artifact claude.ai (https://claude.ai/artifact/XYuepLnqEPFhxZEDGY3e4b) n'est plus mis à jour.

- `template.html` : source de la page (CSS, contenu, plans de navigation PLANS/W/K, listes). Ne pas nommer
  une constante globale `L` : elle masquerait Leaflet.
- `docs/carte.js` : carte marine Leaflet (fonds Esri/OSM, OpenSeaMap, calques GeoJSON, météo Open-Meteo
  en direct, fiches de mouillage avec abri calculé, ETA, mesure, position, mode nuit). API `window.Carte`.
- `docs/data/` : `mouillages.json` (fiches écrites à la main, à vérifier) et GeoJSON générés par
  `data/fetch_osm.py` (Overpass) et `data/fetch_bathy.py` (ETOPO 2022, NOAA ERDDAP). Bruts dans `data/raw/` (ignoré).
- `build.py` : template.html -> docs/index.html, copie img/ -> docs/img, robots.txt, .nojekyll.
- Publier : `python3 build.py`, commit, `git push` (Pages se met à jour en 1-2 min).
- Test local : `.claude/launch.json` (python http.server sur docs/, port 8791).
- Les cases à cocher sont en localStorage (propres à chaque appareil).
