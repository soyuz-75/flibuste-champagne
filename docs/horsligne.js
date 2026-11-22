/* Carte hors ligne : précharge dans le cache « fc-tuiles » (lu par sw.js) les tuiles de la zone de navigation. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const CACHE = 'fc-tuiles';
  const ESRI = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/`;
  const ZONE = { s: 12.4, n: 14.95, o: -61.8, e: -60.7 };
  const virg = (x, n = 0) => x.toFixed(n).replace('.', ',');

  const tx = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
  const ty = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
  function boite(set, s, n, o, e, z) {
    for (let x = tx(o, z); x <= tx(e, z); x++) for (let y = ty(n, z); y <= ty(s, z); y++) set.add(`${z}/${x}/${y}`);
  }
  function autour(set, lat, lon, rayonMilles, z) {
    const dl = rayonMilles / 60, dlo = dl / Math.cos(lat * Math.PI / 180);
    boite(set, lat - dl, lat + dl, lon - dlo, lon + dlo, z);
  }

  // liste des tuiles : [url, poids estimé en Ko]
  let liste = null;
  async function calculer() {
    if (liste) return liste;
    const relief = new Set(), sat = new Set(), sat2 = new Set(), balises = new Set();
    for (let z = 7; z <= 10; z++) boite(relief, ZONE.s, ZONE.n, ZONE.o, ZONE.e, z); // la carte réutilise z10 jusqu'au zoom 11
    // couloir de 3 milles autour de toutes les routes des plans (constante W du site)
    const routes = typeof W === 'object' ? Object.values(W) : [];
    for (const pts of routes) for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      const d = Math.hypot((b[0] - a[0]) * 60, (b[1] - a[1]) * 60 * Math.cos(a[0] * Math.PI / 180));
      const n = Math.max(1, Math.ceil(d / 0.5));
      for (let k = 0; k <= n; k++) {
        const la = a[0] + (b[0] - a[0]) * k / n, lo = a[1] + (b[1] - a[1]) * k / n;
        for (const z of [12, 13]) autour(sat, la, lo, 3, z);
        for (const z of [9, 10, 11, 12, 13]) autour(balises, la, lo, 3, z);
      }
    }
    try {
      const m = await fetch('data/mouillages.json').then(r => r.json());
      for (const a of m.mouillages) {
        for (const z of [14, 15]) autour(sat2, a.lat, a.lon, 1.5, z);
        autour(sat2, a.lat, a.lon, 0.6, 16);
        for (const z of [12, 13]) autour(sat, a.lat, a.lon, 2, z);
        for (const z of [12, 13]) autour(balises, a.lat, a.lon, 2, z);
      }
    } catch (e) { /* hors ligne : on se contente des couloirs */ }
    const yx = k => { const [z, x, y] = k.split('/'); return `${z}/${y}/${x}`; };
    liste = [];
    for (const k of relief) { liste.push([ESRI('Ocean/World_Ocean_Base') + yx(k), 9]); liste.push([ESRI('Ocean/World_Ocean_Reference') + yx(k), 1.5]); }
    for (const k of new Set([...sat, ...sat2])) liste.push([ESRI('World_Imagery') + yx(k), 24]);
    for (const k of balises) liste.push([`https://tiles.openseamap.org/seamark/${k}.png`, 0.6]);
    return liste;
  }

  let annuler = false, actif = false;
  const mo = ko => ko >= 1024 ? `${virg(ko / 1024)} Mo` : `${Math.round(ko)} Ko`;

  async function etat() {
    const box = $('#hl-etat'); if (!box) return;
    const l = await calculer();
    let deja = 0;
    try { const c = await caches.open(CACHE); deja = (await c.keys()).length; } catch (e) { }
    const ko = l.reduce((s, x) => s + x[1], 0);
    let place = '';
    try { const e = await navigator.storage.estimate(); place = ` Espace utilisé par le site : ${mo(e.usage / 1024)}.`; } catch (e) { }
    box.innerHTML = `${l.length} tuiles à télécharger, environ ${mo(ko)} : relief marin de toute la zone, satellite le long des routes et en détail autour des 23 mouillages, balisage OpenSeaMap. ${deja ? `${deja} tuiles déjà gardées sur cet appareil.` : 'Aucune tuile gardée pour l\'instant.'}${place}`;
  }

  async function telecharger() {
    if (actif) { annuler = true; return; }
    if (!('caches' in window)) { $('#hl-etat').textContent = 'Ce navigateur ne permet pas de garder la carte hors ligne.'; return; }
    actif = true; annuler = false;
    const btn = $('#hl-go'); btn.textContent = 'Arrêter le téléchargement';
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { }
    const l = await calculer(), c = await caches.open(CACHE);
    const total = l.length;
    let fait = 0, nouv = 0, echec = 0, i = 0;
    const barre = $('#hl-barre'); barre.hidden = false;
    const maj = () => { barre.firstElementChild.style.width = (fait / total * 100).toFixed(1) + '%'; $('#hl-prog').textContent = `${fait} / ${total} tuiles${echec ? `, ${echec} en échec` : ''}`; };
    const ouvrier = async () => {
      while (!annuler && i < total) {
        const [url] = l[i++];
        try {
          if (!(await c.match(url))) {
            const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (r.ok) { await c.put(url, r); nouv++; } else echec++;
          }
        } catch (e) { echec++; }
        fait++;
        if (fait % 10 === 0 || fait === total) maj();
      }
    };
    await Promise.all(Array.from({ length: 6 }, ouvrier));
    maj();
    actif = false; btn.textContent = 'Télécharger la carte pour le hors-ligne';
    $('#hl-prog').textContent = annuler ? `Arrêté : ${fait} tuiles sur ${total} vérifiées (${nouv} nouvelles). Relance pour reprendre là où ça s'est arrêté.`
      : `Terminé : ${nouv} nouvelles tuiles${echec ? `, ${echec} en échec (relance pour réessayer)` : ''}. La carte est prête pour le mode avion.`;
    etat();
  }

  async function supprimer() {
    if (actif) return;
    if (!confirm('Supprimer toutes les tuiles de carte gardées sur cet appareil ?')) return;
    await caches.delete(CACHE);
    $('#hl-prog').textContent = 'Carte hors ligne supprimée.';
    $('#hl-barre').hidden = true;
    etat();
  }

  document.addEventListener('click', e => {
    if (e.target.id === 'hl-go') telecharger();
    if (e.target.id === 'hl-suppr') supprimer();
    if (e.target.closest && e.target.closest('.ong[data-o="outils"]')) etat();
  });
  window.HorsLigne = { calculer, etat };
})();
