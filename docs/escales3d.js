/* Carte 3D des escales (page Escales) : MapLibre GL, relief AWS Terrarium exagéré, satellite Esri,
   points d'intérêt (data/poi.json), sentiers OSM (data/randos.geojson), route du plan et mouillages.
   MapLibre n'est chargé qu'à la première ouverture de la page. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const ML = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/';
  const CATS = {
    voir: { nom: 'À voir', ico: '👁️', coul: '#5ad6cf' },
    histoire: { nom: 'Histoire et insolite', ico: '📜', coul: '#e2bc6a' },
    rando: { nom: 'Balades et randos', ico: '🥾', coul: '#8bd17c' },
    resto: { nom: 'Restos et bars', ico: '🍽️', coul: '#ff8a65' },
    large: { nom: 'Au large : récifs, épaves', ico: '🐠', coul: '#6aa8ff' }
  };
  let map = null, charge = null, donnees = null, marqueurs = [], actives = new Set(Object.keys(CATS)), en3d = true;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function chargerLib() {
    if (window.maplibregl) return Promise.resolve();
    if (charge) return charge;
    charge = new Promise((ok, ko) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = ML + 'maplibre-gl.min.css'; document.head.appendChild(l);
      const s = document.createElement('script'); s.src = ML + 'maplibre-gl.min.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s);
    });
    return charge;
  }

  // Les tuiles Terrarium contiennent la bathymétrie : on ramène la mer au niveau 0 pour un plan d'eau plat.
  function protocoleRelief() {
    if (protocoleRelief.fait) return; protocoleRelief.fait = true;
    maplibregl.addProtocol('relief', async (params, abort) => {
      const url = params.url.replace('relief://', 'https://');
      const r = await fetch(url, { signal: abort && abort.signal, mode: 'cors' });
      if (!r.ok) throw new Error('tuile ' + r.status);
      const img = await createImageBitmap(await r.blob());
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(img.width, img.height) : Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height), px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] < 128) { px[i] = 128; px[i + 1] = 0; px[i + 2] = 0; } // h = R*256 + G + B/256 - 32768 < 0  ->  0 m
      }
      ctx.putImageData(d, 0, 0);
      const blob = c.convertToBlob ? await c.convertToBlob({ type: 'image/png' }) : await new Promise(ok => c.toBlob(ok, 'image/png'));
      return { data: await blob.arrayBuffer() };
    });
  }

  function webglOk() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  async function init() {
    const box = $('#e3d'); if (!box || map) return;
    if (!webglOk()) { box.innerHTML = '<p class="e3d-msg">Cet appareil ne permet pas d\'afficher la carte en 3D (WebGL indisponible).</p>'; return; }
    box.innerHTML = '<p class="e3d-msg">Chargement de la carte 3D…</p>';
    try {
      await chargerLib();
      donnees = await fetch('data/poi.json').then(r => r.json());
    } catch (e) {
      box.innerHTML = `<p class="e3d-msg">${navigator.onLine ? 'Impossible de charger la carte 3D.' : 'Carte 3D indisponible hors ligne tant qu\'elle n\'a pas été ouverte une première fois avec du réseau.'}</p>`;
      charge = null; return;
    }
    box.innerHTML = '';
    protocoleRelief();
    const ile0 = donnees.iles[0];
    map = new maplibregl.Map({
      container: box,
      style: {
        version: 8,
        sources: {
          sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 18,
            attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' },
          relief: { type: 'raster-dem', tiles: ['relief://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 14, encoding: 'terrarium',
            attribution: 'Relief © Mapzen, AWS Terrain Tiles' }
        },
        layers: [
          { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': 0.1, 'raster-contrast': 0.08 } },
          { id: 'ombrage', type: 'hillshade', source: 'relief', paint: { 'hillshade-exaggeration': 0.25, 'hillshade-shadow-color': '#06111a' } }
        ],
        terrain: { source: 'relief', exaggeration: 1.6 }
      },
      center: [ile0.lon, ile0.lat], zoom: ile0.zoom, pitch: 60, bearing: -15, maxPitch: 80,
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.on('load', () => {
      try { if (map.setSky) map.setSky({ 'sky-color': '#7fb8e6', 'horizon-color': '#cfe6f5', 'fog-color': '#cfe6f5', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.2 }); } catch (e) { }
      ajouterRoute();
      ajouterRandos();
      ajouterMouillages();
      ajouterPoi();
    });
    map.on('error', e => { if (e && e.error && /terrarium/.test(String(e.error.url || ''))) return; });
    barre();
  }

  function ajouterRoute() {
    const nav = window.Nav;
    let legs = nav && nav.plan;
    try { if (!legs) legs = legsCarte(PLANS[cur]); } catch (e) { } // globales du template
    if (!legs) return;
    const lignes = legs.filter(l => l.mer && l.pts && l.pts.length > 1).map(l => l.pts.map(p => [p[1], p[0]]));
    map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lignes } } });
    map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-opacity': 0.85, 'line-dasharray': [2, 2] } });
  }
  async function ajouterRandos() {
    try {
      const g = await fetch('data/randos.geojson').then(r => r.json());
      map.addSource('randos', { type: 'geojson', data: g });
      map.addLayer({ id: 'randos-halo', type: 'line', source: 'randos', paint: { 'line-color': '#06111a', 'line-width': 5, 'line-opacity': 0.5 } });
      map.addLayer({ id: 'randos', type: 'line', source: 'randos', paint: { 'line-color': '#8bd17c', 'line-width': 2.5 } });
      map.on('click', 'randos', e => {
        const p = e.features[0].properties;
        new maplibregl.Popup({ className: 'e3d-pop', maxWidth: '280px' }).setLngLat(e.lngLat)
          .setHTML(`<div class="e3d-cat" style="color:${CATS.rando.coul}">🥾 Sentier (OpenStreetMap)</div><h3>${esc(p.nom)}</h3><p>${String(p.km).replace('.', ',')} km de tracé connu.</p>`).addTo(map);
      });
      map.on('mouseenter', 'randos', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'randos', () => { map.getCanvas().style.cursor = ''; });
      visibiliteRandos();
    } catch (e) { }
  }
  async function ajouterMouillages() {
    try {
      const m = await fetch('data/mouillages.json').then(r => r.json());
      for (const a of m.mouillages) {
        if (a.type === 'secours') continue;
        const el = document.createElement('div'); el.className = 'e3d-ancre'; el.textContent = '⚓'; el.title = a.nom;
        new maplibregl.Marker({ element: el }).setLngLat([a.lon, a.lat])
          .setPopup(new maplibregl.Popup({ className: 'e3d-pop', offset: 12 }).setHTML(`<div class="e3d-cat">⚓ Mouillage</div><h3>${esc(a.nom)}</h3><p>${esc(a.ile)}. Fiche complète dans l'onglet Ancres de la carte marine.</p>`))
          .addTo(map);
      }
    } catch (e) { }
  }
  function ajouterPoi() {
    for (const p of donnees.poi) {
      const c = CATS[p.cat]; if (!c) continue;
      const el = document.createElement('button'); el.type = 'button'; el.className = 'e3d-poi'; el.style.setProperty('--c', c.coul);
      el.innerHTML = `<span aria-hidden="true">${c.ico}</span>`; el.setAttribute('aria-label', `${p.nom}, ${c.nom}`);
      const html = `<div class="e3d-cat" style="color:${c.coul}">${c.ico} ${c.nom} · ${esc(p.ile)}</div><h3>${esc(p.nom)}</h3><p>${esc(p.txt)}</p>`
        + (p.histoire ? `<div class="e3d-hist"><b>L'histoire</b><p>${esc(p.histoire)}</p></div>` : '')
        + (p.attention ? `<p class="e3d-att">${esc(p.attention)}</p>` : '');
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lon, p.lat])
        .setPopup(new maplibregl.Popup({ className: 'e3d-pop', offset: 26, maxWidth: '320px', anchor: 'bottom' }).setHTML(html)).addTo(map);
      // fiche au-dessus du symbole : on descend le symbole dans le bas de la carte pour lui laisser la place
      mk.getPopup().on('open', () => map.easeTo({ center: [p.lon, p.lat], offset: [0, map.getContainer().clientHeight * 0.3], duration: 700 }));
      marqueurs.push({ p, mk, el });
    }
    filtrer();
  }

  function filtrer() {
    for (const { p, el, mk } of marqueurs) {
      const on = actives.has(p.cat);
      el.style.display = on ? '' : 'none';
      if (!on && mk.getPopup().isOpen()) mk.togglePopup();
    }
    visibiliteRandos();
  }
  function visibiliteRandos() {
    if (!map || !map.getLayer('randos')) return;
    const v = actives.has('rando') ? 'visible' : 'none';
    map.setLayoutProperty('randos', 'visibility', v); map.setLayoutProperty('randos-halo', 'visibility', v);
  }

  function barre() {
    $('#e3d-iles').innerHTML = donnees.iles.map((i, k) => `<button type="button" data-i="${k}" class="${k ? '' : 'on'}">${esc(i.nom)}</button>`).join('');
    $('#e3d-cats').innerHTML = Object.entries(CATS).map(([k, c]) => `<button type="button" data-c="${k}" aria-pressed="true" style="--c:${c.coul}"><span aria-hidden="true">${c.ico}</span> ${c.nom}</button>`).join('');
    $('#e3d-iles').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const i = donnees.iles[+b.dataset.i];
      document.querySelectorAll('#e3d-iles button').forEach(x => x.classList.toggle('on', x === b));
      map.flyTo({ center: [i.lon, i.lat], zoom: i.zoom, pitch: en3d ? 60 : 0, bearing: en3d ? (i.cap ?? -15) : 0, duration: 2600, essential: true });
    });
    $('#e3d-cats').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = b.dataset.c;
      actives.has(k) ? actives.delete(k) : actives.add(k);
      b.setAttribute('aria-pressed', actives.has(k));
      filtrer();
    });
    $('#e3d-mode').addEventListener('click', e => {
      en3d = !en3d;
      e.target.textContent = en3d ? 'Vue à plat' : 'Vue 3D';
      map.setTerrain(en3d ? { source: 'relief', exaggeration: 1.6 } : null);
      map.easeTo({ pitch: en3d ? 60 : 0, bearing: en3d ? -15 : 0, duration: 900 });
    });
  }

  function visible() {
    if (!map) init();
    else setTimeout(() => map.resize(), 50);
  }
  window.Escales3D = { visible, get map() { return map; } };
})();
