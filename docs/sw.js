/* Service worker de Flibuste & Champagne. Source : sw.js à la racine ; build.py le copie dans docs/
   en remplaçant 20261122-164450 et ["carte.js", "data/balisage.geojson", "data/dangers.geojson", "data/isobathes.geojson", "data/masque.json", "data/mouillages.json", "data/osm_mouillages.geojson", "data/zones.geojson", "horsligne.js", "icones/icone-180.png", "icones/icone-192.png", "icones/icone-512.png", "icones/icone-maskable-512.png", "icones/icone.svg", "img/anastasia.jpg", "img/iris.jpg", "img/joseph.jpg", "img/max.jpg", "img/philippe.jpg", "index.html", "instruments.js", "manifest.webmanifest", "meteo.js", "routage.js"] (liste des fichiers du site). */
const VERSION = '20261122-164450';
const COQUILLE = 'fc-coquille-' + VERSION;
const TUILES = 'fc-tuiles';     // gardé d'une version à l'autre (carte hors ligne)
const POLICES = 'fc-polices';
const FICHIERS = ["carte.js", "data/balisage.geojson", "data/dangers.geojson", "data/isobathes.geojson", "data/masque.json", "data/mouillages.json", "data/osm_mouillages.geojson", "data/zones.geojson", "horsligne.js", "icones/icone-180.png", "icones/icone-192.png", "icones/icone-512.png", "icones/icone-maskable-512.png", "icones/icone.svg", "img/anastasia.jpg", "img/iris.jpg", "img/joseph.jpg", "img/max.jpg", "img/philippe.jpg", "index.html", "instruments.js", "manifest.webmanifest", "meteo.js", "routage.js"];
const EXTERNES = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];
const HOTES_TUILES = ['server.arcgisonline.com', 'tiles.openseamap.org', 'tile.openstreetmap.org'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(COQUILLE);
    await c.addAll(['./', ...FICHIERS]);
    await Promise.all(EXTERNES.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('fc-coquille-') && k !== COQUILLE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function reseauDabord(req, delai) {
  const c = await caches.open(COQUILLE);
  try {
    const r = await Promise.race([fetch(req), new Promise((_, ko) => setTimeout(() => ko(new Error('lent')), delai))]);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (e) {
    return (await c.match(req, { ignoreSearch: true })) || (await c.match('./')) || Response.error();
  }
}
async function cacheEtMaj(req, nom) {
  const c = await caches.open(nom);
  const enCache = await c.match(req, { ignoreSearch: false });
  const maj = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
  return enCache || (await maj) || Response.error();
}
async function tuile(req) {
  const c = await caches.open(TUILES);
  const enCache = await c.match(req.url);
  if (enCache) return enCache;
  try {
    const r = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
    if (r.ok) c.put(req.url, r.clone());
    return r;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'Hors ligne' });
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (HOTES_TUILES.includes(u.hostname)) { e.respondWith(tuile(req)); return; }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(cacheEtMaj(req, POLICES)); return; }
  if (u.hostname === 'cdnjs.cloudflare.com') { e.respondWith(cacheEtMaj(req, COQUILLE)); return; }
  if (u.origin !== self.location.origin) return; // Open-Meteo, VesselFinder… : réseau seulement
  // fichiers du site : réseau d'abord (jamais un mélange d'ancienne et de nouvelle version), cache si pas de réseau
  e.respondWith(reseauDabord(req, req.mode === 'navigate' ? 4000 : 3000));
});
