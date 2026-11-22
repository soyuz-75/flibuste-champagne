/* Carte marine de Flibuste & Champagne : Leaflet + données OSM/ETOPO + météo Open-Meteo en direct. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const TZ = 'America/Martinique';
  const heure = d => d.toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const jourHeure = d => d.toLocaleString('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- géodésie ---------- */
  const R = Math.PI / 180;
  const milles = (a, b) => L.latLng(a).distanceTo(L.latLng(b)) / 1852;
  function cap(a, b) {
    const [la1, lo1] = a.map(x => x * R), [la2, lo2] = b.map(x => x * R);
    const y = Math.sin(lo2 - lo1) * Math.cos(la2);
    const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
    return (Math.atan2(y, x) / R + 360) % 360;
  }
  const longueur = pts => pts.slice(1).reduce((s, p, i) => s + milles(pts[i], p), 0);
  function dm(v, pos, neg) {
    const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
    return `${d}°${m.toFixed(3).padStart(6, '0')}′ ${v >= 0 ? pos : neg}`;
  }
  const coordTxt = ll => `${dm(ll.lat, 'N', 'S')}  ${dm(ll.lng, 'E', 'W')}`;
  const deg3 = d => String(Math.round(d) % 360).padStart(3, '0') + '°';
  const cardinal = d => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'][Math.round(((d % 360) + 360) % 360 / 22.5) % 16];

  /* Lever et coucher du soleil (algorithme NOAA simplifié), en Date UTC */
  function soleil(date, lat, lon) {
    const y = date.getUTCFullYear(), mo = date.getUTCMonth(), dd = date.getUTCDate();
    const jour = (Date.UTC(y, mo, dd) - Date.UTC(y, 0, 0)) / 864e5;
    const g = 2 * Math.PI / 365 * (jour - 1 + 0.5);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = Math.acos(Math.cos(90.833 * R) / (Math.cos(lat * R) * Math.cos(dec)) - Math.tan(lat * R) * Math.tan(dec)) / R;
    const midi = 720 - 4 * lon - eq;
    const base = Date.UTC(y, mo, dd);
    return { lever: new Date(base + (midi - 4 * ha) * 6e4), coucher: new Date(base + (midi + 4 * ha) * 6e4) };
  }

  /* ---------- état ---------- */
  let map, routeLayer, mesureLayer, bateau, wx, particules;
  let plan = [], legSel = 0, onLeg = () => {};
  let mouillages = [], marqueurs = {}, ficheId = null;
  let mesure = { actif: false, pts: [] };
  const etaPrefs = { vitesse: 6.5 };

  /* ---------- styles ---------- */
  const isoCouleur = d => d <= 5 ? '#d1495b' : d <= 10 ? '#ed8b3a' : d <= 20 ? '#1f78b4' : d <= 100 ? '#4a9fd8' : '#8cc3ea';
  const KIND = {
    reef: 'Récif', wreck: 'Épave', rock: 'Roche', obstruction: 'Obstruction',
    buoy_lateral: 'Bouée latérale', buoy_cardinal: 'Bouée cardinale', buoy_isolated_danger: 'Bouée de danger isolé',
    buoy_safe_water: 'Bouée d\'eaux saines', buoy_special_purpose: 'Bouée spéciale', beacon_lateral: 'Balise latérale',
    beacon_cardinal: 'Balise cardinale', beacon_isolated_danger: 'Balise de danger isolé', beacon_special_purpose: 'Balise spéciale',
    light_major: 'Feu principal', light_minor: 'Feu secondaire', light: 'Feu', anchorage: 'Zone de mouillage', mooring: 'Bouée de mouillage', anchor_berth: 'Poste de mouillage'
  };
  const NIVEAU = { submerged: 'toujours immergée', awash: 'à fleur d\'eau', dry: 'émergée', covers: 'couvre et découvre', always_dry: 'émergée' };
  const COULEUR = { red: '#d62728', green: '#2ca02c', yellow: '#f1c40f', black: '#1b1b1b', white: '#f3eee2', orange: '#f39c12' };
  const RESTR = { no_anchoring: 'Mouillage interdit', no_entry: 'Accès interdit', no_fishing: 'Pêche interdite', restricted_entry: 'Accès réglementé' };

  const ancre = (cls) => L.divIcon({
    className: 'ico-ancre ' + cls, iconSize: [26, 26], iconAnchor: [13, 13],
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M12 5.5v12M8.5 8.5h7M6.5 13a5.5 5.5 0 0 0 11 0" fill="none" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="5" r="1.6" fill="none" stroke-width="1.5"/></svg>'
  });
  const symEpave = L.divIcon({ className: 'ico-danger', iconSize: [18, 18], iconAnchor: [9, 9],
    html: '<svg viewBox="0 0 20 20"><path d="M2 10h16M6 6v8M10 4v12M14 6v8" stroke="#b03a2e" stroke-width="1.8" fill="none"/></svg>' });
  const symRoche = L.divIcon({ className: 'ico-danger', iconSize: [16, 16], iconAnchor: [8, 8],
    html: '<svg viewBox="0 0 20 20"><path d="M10 2v16M2 10h16M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="#b03a2e" stroke-width="1.8"/></svg>' });

  /* ---------- statut d'abri ---------- */
  function dansSecteur(dir, s) { const [a, b] = s; return a <= b ? dir >= a && dir <= b : dir >= a || dir <= b; }
  function ecart(dir, s) {
    if (dansSecteur(dir, s)) return 0;
    const d = x => Math.min(Math.abs(dir - x), 360 - Math.abs(dir - x));
    return Math.min(d(s[0]), d(s[1]));
  }
  function abri(m, cond) {
    if (!cond) return { cls: 'na', txt: 'Météo non chargée' };
    const sect = m.expose || [];
    const ev = sect.length ? Math.min(...sect.map(s => ecart(cond.vdir, s))) : 999;
    const eh = sect.length && cond.hdir != null ? Math.min(...sect.map(s => ecart(cond.hdir, s))) : 999;
    if ((ev === 0 && cond.vit >= 8) || (eh === 0 && cond.houle >= 1)) return { cls: 'mauvais', txt: 'Exposé' };
    if ((ev < 25 && cond.vit >= 12) || (eh < 25 && cond.houle >= 0.8) || cond.raf >= 30) return { cls: 'moyen', txt: 'Moyen' };
    return { cls: 'bon', txt: 'Bon abri' };
  }

  /* ---------- météo : grille Open-Meteo ---------- */
  const G = { lat0: 12.3, lat1: 15.1, dlat: 0.2, lon0: -62.0, lon1: -60.5, dlon: 0.15 };
  G.nla = Math.round((G.lat1 - G.lat0) / G.dlat) + 1; G.nlo = Math.round((G.lon1 - G.lon0) / G.dlon) + 1; G.np = G.nla * G.nlo;
  const W = { pret: false, t: 0, heures: [], maj: null, U: null, V: null, RAF: null, HS: null, HD: null, CU: null, CV: null, mode: 'vent' };

  async function chargerMeteo() {
    const etat = $('#wx-etat');
    const la = [], lo = [];
    for (let i = 0; i < G.nla; i++) for (let j = 0; j < G.nlo; j++) { la.push((G.lat0 + i * G.dlat).toFixed(2)); lo.push((G.lon0 + j * G.dlon).toFixed(2)); }
    const q = `latitude=${la.join(',')}&longitude=${lo.join(',')}&timezone=${encodeURIComponent(TZ)}`;
    etat.textContent = 'Chargement de la météo…';
    try {
      const [f, m] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?${q}&forecast_days=10&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&forecast_days=8&hourly=wave_height,wave_direction,ocean_current_velocity,ocean_current_direction`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      ]);
      const brut = { f: f.map(x => x.hourly), m: m.map(x => x.hourly), maj: Date.now() };
      try { localStorage.setItem('fc-meteo', JSON.stringify(brut)); } catch (e) { /* stockage plein : tant pis */ }
      installer(brut, false);
    } catch (e) {
      let cache = null;
      try { cache = JSON.parse(localStorage.getItem('fc-meteo') || 'null'); } catch (e2) { }
      if (cache) { installer(cache, true); }
      else etat.innerHTML = 'Météo indisponible (pas de réseau ?). <button type="button" class="lien-btn" id="wx-retry">Réessayer</button>';
    }
  }

  function installer(brut, depuisCache) {
    const h0 = brut.f[0];
    W.heures = h0.time.map(s => new Date(s + '-04:00'));
    const nt = W.heures.length, N = nt * G.np;
    const A = () => new Float32Array(N).fill(NaN);
    W.U = A(); W.V = A(); W.RAF = A(); W.HS = A(); W.HD = A(); W.CU = A(); W.CV = A();
    for (let k = 0; k < G.np; k++) {
      const f = brut.f[k], m = brut.m[k];
      for (let t = 0; t < nt; t++) {
        const i = t * G.np + k;
        const s = f.wind_speed_10m[t], d = f.wind_direction_10m[t];
        if (s != null && d != null) { const a = (d + 180) * R; W.U[i] = s * Math.sin(a); W.V[i] = s * Math.cos(a); }
        if (f.wind_gusts_10m[t] != null) W.RAF[i] = f.wind_gusts_10m[t];
        if (m && m.wave_height && m.wave_height[t] != null && m.wave_direction[t] != null) { W.HS[i] = m.wave_height[t]; W.HD[i] = m.wave_direction[t]; }
        if (m && m.ocean_current_velocity && m.ocean_current_velocity[t] != null && m.ocean_current_direction[t] != null) {
          const c = m.ocean_current_velocity[t] / 1.852, a = m.ocean_current_direction[t] * R; // direction vers laquelle porte le courant
          W.CU[i] = c * Math.sin(a); W.CV[i] = c * Math.cos(a);
        }
      }
    }
    W.maj = new Date(brut.maj);
    const now = Date.now();
    let t0 = W.heures.findIndex(d => d.getTime() + 3600e3 > now);
    if (t0 < 0) t0 = 0;
    W.t0 = t0; W.t = t0; W.pret = true;
    const sl = $('#wx-temps'); sl.min = t0; sl.max = Math.min(nt - 1, t0 + 168); sl.value = t0;
    $('#wx-etat').innerHTML = depuisCache
      ? `Hors ligne : prévision du ${jourHeure(W.maj)}. <button type="button" class="lien-btn" id="wx-retry">Actualiser</button>`
      : `Prévision Open-Meteo chargée à ${heure(W.maj)}. <button type="button" class="lien-btn" id="wx-retry">Actualiser</button>`;
    majTemps();
    document.dispatchEvent(new CustomEvent('nav:meteo'));
  }

  function interp(arr, t, lat, lon) {
    if (!W.pret || lat < G.lat0 - 0.1 || lat > G.lat1 + 0.1 || lon < G.lon0 - 0.08 || lon > G.lon1 + 0.08) return NaN;
    const fi = Math.min(Math.max((lat - G.lat0) / G.dlat, 0), G.nla - 1.0001), fj = Math.min(Math.max((lon - G.lon0) / G.dlon, 0), G.nlo - 1.0001);
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, o = t * G.np;
    const c = [[i, j, (1 - a) * (1 - b)], [i, j + 1, (1 - a) * b], [i + 1, j, a * (1 - b)], [i + 1, j + 1, a * b]];
    let s = 0, w = 0;
    for (const [ii, jj, ww] of c) { const v = arr[o + ii * G.nlo + jj]; if (!Number.isNaN(v)) { s += v * ww; w += ww; } }
    return w > 0.15 ? s / w : NaN;
  }
  function condAt(lat, lon, t = W.t) {
    if (!W.pret) return null;
    const u = interp(W.U, t, lat, lon), v = interp(W.V, t, lat, lon);
    if (Number.isNaN(u)) return null;
    const hs = interp(W.HS, t, lat, lon);
    // la direction de houle s'interpole mal : on prend le point de grille le plus proche
    const k = Math.round((lat - G.lat0) / G.dlat) * G.nlo + Math.round((lon - G.lon0) / G.dlon);
    const hd = W.HD[t * G.np + Math.max(0, Math.min(G.np - 1, k))];
    return { vit: Math.hypot(u, v), vdir: (Math.atan2(u, v) / R + 180 + 360) % 360, raf: interp(W.RAF, t, lat, lon),
      houle: Number.isNaN(hs) ? 0 : hs, hdir: Number.isNaN(hd) ? null : hd,
      cour: Math.hypot(interp(W.CU, t, lat, lon) || 0, interp(W.CV, t, lat, lon) || 0) };
  }

  /* rampes de couleurs */
  const RAMPE = {
    vent: [[0, '#2b6cb0'], [8, '#2ab3a6'], [12, '#7cc35b'], [16, '#f2c94c'], [20, '#f2994a'], [25, '#eb5757'], [32, '#9b51e0']],
    houle: [[0, '#2b6cb0'], [0.5, '#2ab3a6'], [1, '#7cc35b'], [1.5, '#f2c94c'], [2, '#f2994a'], [3, '#eb5757'], [4, '#9b51e0']],
    courant: [[0, '#2b6cb0'], [0.3, '#2ab3a6'], [0.6, '#7cc35b'], [1, '#f2c94c'], [1.5, '#f2994a'], [2, '#eb5757']]
  };
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  function couleur(mode, v) {
    const r = RAMPE[mode];
    if (v <= r[0][0]) return r[0][1];
    for (let i = 1; i < r.length; i++) if (v < r[i][0]) {
      const f = (v - r[i - 1][0]) / (r[i][0] - r[i - 1][0]), a = hex(r[i - 1][1]), b = hex(r[i][1]);
      return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(',')})`;
    }
    return r[r.length - 1][1];
  }

  /* Calque canvas : fond coloré + flèches */
  const WxLayer = L.Layer.extend({
    onAdd(m) {
      this._m = m;
      this._c = L.DomUtil.create('canvas', 'wx-canvas leaflet-zoom-hide');
      m.getPanes().overlayPane.appendChild(this._c);
      m.on('moveend zoomend resize', this.redessiner, this);
      this.redessiner();
    },
    onRemove(m) { m.off('moveend zoomend resize', this.redessiner, this); this._c.remove(); },
    redessiner() {
      const m = this._m, c = this._c, sz = m.getSize();
      c.width = sz.x; c.height = sz.y; c.style.width = sz.x + 'px'; c.style.height = sz.y + 'px';
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      const g = c.getContext('2d'); g.clearRect(0, 0, sz.x, sz.y);
      if (!W.pret) return;
      const mode = W.mode, t = W.t, pas = 12;
      const val = (lat, lon) => {
        if (mode === 'vent') { const u = interp(W.U, t, lat, lon), v = interp(W.V, t, lat, lon); return [Math.hypot(u, v), u, v]; }
        if (mode === 'courant') { const u = interp(W.CU, t, lat, lon), v = interp(W.CV, t, lat, lon); return [Math.hypot(u, v), u, v]; }
        const h = interp(W.HS, t, lat, lon); return [h, NaN, NaN];
      };
      g.globalAlpha = 0.36;
      if (m.getZoom() < 12) for (let y = 0; y < sz.y; y += pas) for (let x = 0; x < sz.x; x += pas) {
        const ll = m.containerPointToLatLng([x + pas / 2, y + pas / 2]);
        const [v] = val(ll.lat, ll.lng);
        if (Number.isNaN(v)) continue;
        g.fillStyle = couleur(mode, v); g.fillRect(x, y, pas, pas);
      }
      g.globalAlpha = 1;
      const z = m.getZoom(), esp = z >= 13 ? 150 : z >= 11 ? 96 : 64;
      g.lineCap = 'round';
      for (let y = esp / 2; y < sz.y; y += esp) for (let x = esp / 2; x < sz.x; x += esp) {
        const ll = m.containerPointToLatLng([x, y]);
        let [v, u, w] = val(ll.lat, ll.lng);
        if (Number.isNaN(v)) continue;
        if (mode === 'houle') {
          const k = Math.round((ll.lat - G.lat0) / G.dlat) * G.nlo + Math.round((ll.lng - G.lon0) / G.dlon);
          const d = W.HD[t * G.np + Math.max(0, Math.min(G.np - 1, k))];
          if (Number.isNaN(d)) continue;
          const a = (d + 180) * R; u = Math.sin(a); w = Math.cos(a);
        }
        const n = Math.hypot(u, w) || 1, dx = u / n, dy = -w / n, L1 = 15;
        g.strokeStyle = '#0b1a22'; g.lineWidth = 4; fleche(g, x, y, dx, dy, L1);
        g.strokeStyle = '#f3eee2'; g.lineWidth = 1.8; fleche(g, x, y, dx, dy, L1);
        g.font = '600 11px Jost, system-ui, sans-serif'; g.fillStyle = '#f3eee2'; g.strokeStyle = '#0b1a22'; g.lineWidth = 3;
        const lab = mode === 'vent' ? String(Math.round(v)) : v.toFixed(1).replace('.', ',');
        g.strokeText(lab, x + 10, y + 16); g.fillText(lab, x + 10, y + 16);
      }
    }
  });
  function fleche(g, x, y, dx, dy, l) {
    const x0 = x - dx * l / 2, y0 = y - dy * l / 2, x1 = x + dx * l / 2, y1 = y + dy * l / 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
    g.moveTo(x1, y1); g.lineTo(x1 - dx * 6 - dy * 4, y1 - dy * 6 + dx * 4);
    g.moveTo(x1, y1); g.lineTo(x1 - dx * 6 + dy * 4, y1 - dy * 6 - dx * 4);
    g.stroke();
  }

  /* Particules de vent animées */
  const Particules = L.Layer.extend({
    onAdd(m) {
      this._m = m; this._c = L.DomUtil.create('canvas', 'wx-part leaflet-zoom-hide');
      m.getPanes().overlayPane.appendChild(this._c);
      m.on('movestart', this.stop, this); m.on('moveend resize', this.go, this);
      this.go();
    },
    onRemove(m) { this.stop(); m.off('movestart', this.stop, this); m.off('moveend resize', this.go, this); this._c.remove(); },
    stop() { cancelAnimationFrame(this._raf); this._raf = null; if (this._c) this._c.getContext('2d').clearRect(0, 0, this._c.width, this._c.height); },
    go() {
      this.stop();
      const m = this._m, c = this._c, sz = m.getSize();
      c.width = sz.x; c.height = sz.y; c.style.width = sz.x + 'px'; c.style.height = sz.y + 'px';
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      if (!W.pret || W.mode !== 'vent') return;
      const g = c.getContext('2d'), n = Math.min(900, Math.round(sz.x * sz.y / 900));
      const P = Array.from({ length: n }, () => ({ x: Math.random() * sz.x, y: Math.random() * sz.y, a: Math.random() * 80 }));
      const pas = () => {
        if (document.hidden || !document.body.contains(c) || c.offsetParent === null) { this._raf = requestAnimationFrame(pas); return; }
        g.globalCompositeOperation = 'destination-in'; g.fillStyle = 'rgba(0,0,0,0.9)'; g.fillRect(0, 0, sz.x, sz.y);
        g.globalCompositeOperation = 'source-over'; g.strokeStyle = 'rgba(243,238,226,0.75)'; g.lineWidth = 1.1; g.beginPath();
        for (const p of P) {
          const ll = m.containerPointToLatLng([p.x, p.y]);
          const u = interp(W.U, W.t, ll.lat, ll.lng), v = interp(W.V, W.t, ll.lat, ll.lng);
          if (Number.isNaN(u) || p.a++ > 90) { p.x = Math.random() * sz.x; p.y = Math.random() * sz.y; p.a = 0; continue; }
          const nx = p.x + u * 0.09, ny = p.y - v * 0.09;
          g.moveTo(p.x, p.y); g.lineTo(nx, ny); p.x = nx; p.y = ny;
          if (nx < 0 || ny < 0 || nx > sz.x || ny > sz.y) { p.x = Math.random() * sz.x; p.y = Math.random() * sz.y; p.a = 0; }
        }
        g.stroke();
        this._raf = requestAnimationFrame(pas);
      };
      this._raf = requestAnimationFrame(pas);
    }
  });

  function majTemps() {
    if (!W.pret) return;
    W.t = +$('#wx-temps').value;
    const d = W.heures[W.t];
    $('#wx-heure').textContent = (W.t === W.t0 ? `Maintenant (${jourHeure(d)})` : jourHeure(d)) + ', heure de Martinique';
    if (map.hasLayer(wx)) wx.redessiner();
    if (map.hasLayer(particules)) particules.go();
    legende();
    for (const m of mouillages) peindreMarqueur(m);
    if (ficheId) fiche(ficheId, false);
  }
  function legende() {
    const r = RAMPE[W.mode], u = { vent: 'nœuds', houle: 'm', courant: 'nœuds' }[W.mode];
    $('#wx-legende').innerHTML = r.map(([s, c]) => `<span><i style="background:${c}"></i>${String(s).replace('.', ',')}</span>`).join('') + `<em>${u}</em>`;
  }

  /* Prévision ponctuelle (48 h) */
  async function prevPoint(ll) {
    const box = $('#wx-point');
    box.innerHTML = `<p class="muted">Prévision pour ${esc(coordTxt(ll))}…</p>`;
    activerOnglet('meteo');
    const q = `latitude=${ll.lat.toFixed(3)}&longitude=${ll.lng.toFixed(3)}&timezone=${encodeURIComponent(TZ)}&forecast_days=3`;
    try {
      const [f, m] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?${q}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation&daily=sunrise,sunset&wind_speed_unit=kn`).then(r => r.json()),
        fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity`).then(r => r.json()).catch(() => null)
      ]);
      const now = Date.now(), T = f.hourly.time.map(s => new Date(s + '-04:00'));
      let i0 = T.findIndex(d => d.getTime() + 3600e3 > now); if (i0 < 0) i0 = 0;
      const idx = Array.from({ length: 48 }, (_, k) => i0 + k).filter(i => i < T.length);
      const vit = idx.map(i => f.hourly.wind_speed_10m[i]), raf = idx.map(i => f.hourly.wind_gusts_10m[i]);
      const hs = m && m.hourly ? idx.map(i => m.hourly.wave_height[i]) : [];
      const cur = idx[0];
      const graph = (series, max, unite) => {
        const w = 300, h = 70, n = idx.length;
        const pts = s => s.map((v, k) => v == null ? null : `${(k / (n - 1) * w).toFixed(1)},${(h - v / max * h).toFixed(1)}`).filter(Boolean).join(' ');
        const nuits = idx.map((i, k) => { const hh = +T[i].toLocaleString('fr-FR', { timeZone: TZ, hour: '2-digit', hour12: false }); return hh < 6 || hh >= 18 ? `<rect x="${(k / (n - 1) * w).toFixed(1)}" y="0" width="${(w / (n - 1)).toFixed(1)}" height="${h}" class="nuit"/>` : ''; }).join('');
        return `<svg viewBox="0 0 ${w} ${h + 14}" class="mini">${nuits}${series.map((s, j) => `<polyline points="${pts(s.v)}" class="${s.c}"/>`).join('')}
          <text x="0" y="${h + 12}">maintenant</text><text x="${w / 2}" y="${h + 12}" text-anchor="middle">+24 h</text><text x="${w}" y="${h + 12}" text-anchor="end">+48 h</text>
          <text x="${w}" y="10" text-anchor="end">${max} ${unite}</text></svg>`;
      };
      const maxV = Math.max(20, Math.ceil(Math.max(...raf.filter(x => x != null)) / 5) * 5);
      const maxH = Math.max(2, Math.ceil(Math.max(0, ...hs.filter(x => x != null))));
      const sr = f.daily ? `Soleil : lever ${f.daily.sunrise[0].slice(11)}, coucher ${f.daily.sunset[0].slice(11)}` : '';
      box.innerHTML = `<h4>Ici : ${esc(coordTxt(ll))}</h4>
        <p><b>${Math.round(vit[0])} nd</b> du ${cardinal(f.hourly.wind_direction_10m[cur])} (${deg3(f.hourly.wind_direction_10m[cur])}), rafales ${Math.round(raf[0])} nd${hs.length && hs[0] != null ? ` · houle <b>${hs[0].toFixed(1).replace('.', ',')} m</b> du ${cardinal(m.hourly.wave_direction[cur])}, ${Math.round(m.hourly.wave_period[cur])} s` : ''}${m && m.hourly && m.hourly.ocean_current_velocity[cur] != null ? ` · courant ${(m.hourly.ocean_current_velocity[cur] / 1.852).toFixed(1).replace('.', ',')} nd` : ''}</p>
        <div class="mini-t">Vent et rafales (nœuds), nuits en grisé</div>${graph([{ v: vit, c: 'l-vent' }, { v: raf, c: 'l-raf' }], maxV, 'nd')}
        ${hs.length ? `<div class="mini-t">Houle (m)</div>${graph([{ v: hs, c: 'l-houle' }], maxH, 'm')}` : '<p class="muted">Pas de donnée de houle ici (trop près de la terre).</p>'}
        <p class="muted">${sr}. <a href="https://www.windy.com/?${ll.lat.toFixed(3)},${ll.lng.toFixed(3)},11" target="_blank" rel="noopener">Voir sur Windy</a></p>`;
    } catch (e) {
      box.innerHTML = '<p class="muted">Prévision indisponible : pas de réseau ?</p>';
    }
  }

  /* ---------- mouillages ---------- */
  function peindreMarqueur(m) {
    const mk = marqueurs[m.id]; if (!mk) return;
    const st = m.type === 'secours' ? { cls: 'secours' } : abri(m, condAt(m.lat, m.lon));
    mk.setIcon(ancre(st.cls + (ficheId === m.id ? ' sel' : '')));
  }
  function fiche(id, centrer = true) {
    const m = mouillages.find(x => x.id === id); if (!m) return;
    const prev = ficheId; ficheId = id;
    if (prev && prev !== id) peindreMarqueur(mouillages.find(x => x.id === prev));
    peindreMarqueur(m);
    const c = condAt(m.lat, m.lon), st = m.type === 'secours' ? { cls: 'secours', txt: 'Abri de secours' } : abri(m, c);
    const sect = (m.expose || []).map(([a, b]) => `${cardinal(a)} à ${cardinal(b)}`).join(', ');
    $('#fiche').innerHTML = `<article class="fiche">
      <div class="fiche-h"><div><span class="muted">${esc(m.ile)}</span><h3>${esc(m.nom)}</h3></div><span class="chip ${st.cls}">${st.txt}</span></div>
      ${c ? `<p class="cond">À ${esc(jourHeure(W.heures[W.t]))} : vent ${Math.round(c.vit)} nd du ${cardinal(c.vdir)}, rafales ${Math.round(c.raf)} nd${c.houle ? `, houle ${c.houle.toFixed(1).replace('.', ',')} m${c.hdir != null ? ' du ' + cardinal(c.hdir) : ''}` : ''}.</p>` : ''}
      <dl>
        <div><dt>Profondeur</dt><dd>${esc(m.prof)}</dd></div>
        ${m.fond ? `<div><dt>Fond</dt><dd>${esc(m.fond)}</dd></div>` : ''}
        <div><dt>Exposé à</dt><dd>${sect || 'Peu exposé'}</dd></div>
        <div><dt>Bouées</dt><dd>${esc(m.bouees)}</dd></div>
        <div><dt>Port d'entrée</dt><dd>${esc(m.entree)}</dd></div>
        <div><dt>Services</dt><dd>${esc(m.services)}</dd></div>
        ${m.dangers ? `<div><dt>Dangers</dt><dd>${esc(m.dangers)}</dd></div>` : ''}
        ${m.notes ? `<div><dt>À savoir</dt><dd>${esc(m.notes)}</dd></div>` : ''}
        <div><dt>Position</dt><dd>${esc(coordTxt(L.latLng(m.lat, m.lon)))}</dd></div>
      </dl>
      <p class="muted">Fiche indicative : à confirmer avec le guide de croisière et la carte officielle.</p>
    </article>`;
    activerOnglet('mouillages');
    if (centrer) map.setView([m.lat, m.lon], Math.max(map.getZoom(), 13));
  }
  function listeMouillages() {
    const iles = [...new Set(mouillages.map(m => m.ile))];
    $('#liste-mouillages').innerHTML = iles.map(i => `<div class="grp"><h4>${esc(i)}</h4>${mouillages.filter(m => m.ile === i).map(m =>
      `<button type="button" class="m-btn" data-m="${m.id}">${esc(m.nom)}</button>`).join('')}</div>`).join('');
  }

  /* ---------- route et ETA ---------- */
  function dessinerRoute() {
    routeLayer.clearLayers();
    plan.forEach((l, i) => {
      if (!l.mer) return;
      const on = i === legSel;
      const pl = L.polyline(l.pts, { pane: 'route', color: on ? '#d9b05a' : (l.retour ? '#39c6c0' : '#ef6a4c'), weight: on ? 4 : 2.2, opacity: on ? 1 : 0.75, dashArray: on ? null : '7 6' });
      pl.on('click', () => onLeg(i));
      pl.bindTooltip(`${l.date} · ${l.titre}`, { sticky: true });
      routeLayer.addLayer(pl);
    });
  }
  function eta() {
    const l = plan[legSel], box = $('#eta');
    if (!l || !l.mer) { box.innerHTML = '<p class="muted">Étape à terre : rien à calculer.</p>'; return; }
    const d = longueur(l.pts);
    const dep = l.depart;
    const arr = new Date(dep.getTime() + d / etaPrefs.vitesse * 3600e3);
    const fin = l.pts[l.pts.length - 1], sArr = soleil(new Date(arr.getTime() - 4 * 3600e3), fin[0], fin[1]);
    const nuit = arr < new Date(sArr.lever.getTime() + 15 * 6e4) || arr > new Date(sArr.coucher.getTime() - 30 * 6e4);
    const cDep = cap(l.pts[0], l.pts[1]);
    box.innerHTML = `<div class="eta-g">
      <label>Vitesse moyenne<select id="eta-v">${[5, 6.5, 8].map(v => `<option value="${v}"${v === etaPrefs.vitesse ? ' selected' : ''}>${String(v).replace('.', ',')} nœuds</option>`).join('')}</select></label>
      <label>Départ<input type="time" id="eta-h" value="${heure(dep)}"></label></div>
      <p>Route tracée : <b>${d.toFixed(1).replace('.', ',')} milles</b>, cap initial ${deg3(cDep)}.</p>
      <p>Arrivée estimée : <b>${jourHeure(arr)}</b>. Soleil sur place : lever ${heure(sArr.lever)}, coucher ${heure(sArr.coucher)}.</p>
      ${nuit ? '<p class="alerte">Arrivée de nuit : décaler le départ ou réduire la vitesse pour arriver après le lever du jour.</p>' : '<p class="ok">Arrivée de jour.</p>'}`;
  }

  /* ---------- outils ---------- */
  function majMesure() {
    mesureLayer.clearLayers();
    const p = mesure.pts;
    if (!p.length) { $('#mesure-res').textContent = mesure.actif ? 'Touche la carte pour poser les points.' : ''; return; }
    L.polyline(p, { color: '#f2c94c', weight: 2.5, dashArray: '4 4', pane: 'route' }).addTo(mesureLayer);
    p.forEach(x => L.circleMarker(x, { radius: 4, color: '#0b1a22', fillColor: '#f2c94c', fillOpacity: 1, weight: 1.5, pane: 'route' }).addTo(mesureLayer));
    let tot = 0;
    for (let i = 1; i < p.length; i++) {
      const d = milles(p[i - 1], p[i]); tot += d;
      L.marker([(p[i - 1][0] + p[i][0]) / 2, (p[i - 1][1] + p[i][1]) / 2], { pane: 'route', interactive: false,
        icon: L.divIcon({ className: 'mes-lab', html: `${d.toFixed(1).replace('.', ',')} M · ${deg3(cap(p[i - 1], p[i]))}`, iconSize: null }) }).addTo(mesureLayer);
    }
    $('#mesure-res').innerHTML = p.length > 1 ? `Total : <b>${tot.toFixed(1).replace('.', ',')} milles</b>, soit ${(tot / etaPrefs.vitesse).toFixed(1).replace('.', ',')} h à ${String(etaPrefs.vitesse).replace('.', ',')} nœuds.` : 'Pose le point suivant.';
  }

  /* GPS partagé : la carte et le compas écoutent le même suivi (événement nav:pos) */
  const GPS = { suivi: null, derniere: null, pos: null, demandeurs: new Set() };
  function gpsDemarrer(qui) {
    GPS.demandeurs.add(qui);
    if (GPS.suivi != null) return true;
    if (!navigator.geolocation) return false;
    GPS.suivi = navigator.geolocation.watchPosition(p => {
      const ll = [p.coords.latitude, p.coords.longitude], der = GPS.derniere;
      let cog = p.coords.heading, sog = p.coords.speed != null ? p.coords.speed * 1.94384 : null;
      if ((cog == null || Number.isNaN(cog)) && der && milles(der.ll, ll) > 0.005) cog = cap(der.ll, ll);
      if (sog == null && der && p.timestamp > der.t) sog = milles(der.ll, ll) / ((p.timestamp - der.t) / 3600e3);
      if (cog != null && Number.isNaN(cog)) cog = null;
      if (sog != null && !isFinite(sog)) sog = null;
      GPS.derniere = { ll, t: p.timestamp };
      GPS.pos = { ll, cog, sog, prec: p.coords.accuracy, t: p.timestamp };
      document.dispatchEvent(new CustomEvent('nav:pos', { detail: GPS.pos }));
    }, e => document.dispatchEvent(new CustomEvent('nav:pos-err', { detail: e.code })),
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
    return true;
  }
  function gpsArreter(qui) {
    GPS.demandeurs.delete(qui);
    if (GPS.demandeurs.size || GPS.suivi == null) return;
    navigator.geolocation.clearWatch(GPS.suivi); GPS.suivi = null; GPS.pos = null; GPS.derniere = null;
  }
  let carteSuit = false, premiere = true;
  function position() {
    const res = $('#pos-res');
    if (carteSuit) {
      carteSuit = false; gpsArreter('carte'); $('#btn-pos').textContent = 'Afficher ma position'; res.textContent = '';
      if (bateau) { bateau.remove(); bateau = null; } return;
    }
    if (!gpsDemarrer('carte')) { res.textContent = 'La géolocalisation n\'est pas disponible sur cet appareil.'; return; }
    carteSuit = true; premiere = true;
    res.textContent = 'Recherche du GPS…';
    $('#btn-pos').textContent = 'Arrêter le suivi';
    if (GPS.pos) majBateau(GPS.pos);
  }
  function majBateau(p) {
    if (!carteSuit || !map) return;
    const { ll, cog, sog } = p;
    const ico = L.divIcon({ className: 'ico-bateau', iconSize: [28, 28], iconAnchor: [14, 14],
      html: `<svg viewBox="0 0 28 28" style="transform:rotate(${cog || 0}deg)"><path d="M14 2l7 22-7-5-7 5z"/></svg>` });
    if (!bateau) bateau = L.marker(ll, { icon: ico, zIndexOffset: 1000 }).addTo(map); else { bateau.setLatLng(ll); bateau.setIcon(ico); }
    if (premiere) { map.setView(ll, Math.max(map.getZoom(), 12)); premiere = false; }
    $('#pos-res').innerHTML = `${esc(coordTxt(L.latLng(ll[0], ll[1])))}<br>Vitesse fond <b>${sog != null ? sog.toFixed(1).replace('.', ',') : '–'} nd</b> · cap fond <b>${cog != null ? deg3(cog) : '–'}</b> · précision ${Math.round(p.prec)} m`;
  }
  document.addEventListener('nav:pos', e => majBateau(e.detail));
  document.addEventListener('nav:pos-err', e => { if (carteSuit) $('#pos-res').textContent = e.detail === 1 ? 'Accès à la position refusé dans le navigateur.' : 'Position indisponible pour le moment.'; });

  /* ---------- bateaux autour : carte AIS VesselFinder ---------- */
  function bateaux() {
    const box = $('#ais-cadre'); if (!box) return;
    const choix = $('#ais-centre').value, z = +$('#ais-zoom').value;
    let c;
    if (choix === 'gps' && GPS.pos) c = GPS.pos.ll;
    else if (choix === 'etape' && plan[legSel]) { const p = plan[legSel].pts; c = p[p.length - 1]; }
    else c = map ? [map.getCenter().lat, map.getCenter().lng] : [13.75, -61.1];
    const h = Math.max(400, Math.round(box.clientWidth * 1.15));
    const ra = encodeURIComponent(location.href.split('#')[0]);
    box.innerHTML = `<iframe title="Carte AIS VesselFinder" loading="lazy" style="width:100%;height:${h}px;border:0" src="https://www.vesselfinder.com/aismap?zoom=${z}&lat=${c[0].toFixed(4)}&lon=${c[1].toFixed(4)}&width=100%25&height=${h}&names=true&track=false&fleet=false&fleet_name=false&fleet_hide_old_positions=false&clicktoact=false&store_pos=false&ra=${ra}"></iframe>`;
    $('#ais-liens').innerHTML = `<a href="https://www.marinetraffic.com/fr/ais/home/centerx:${c[1].toFixed(3)}/centery:${c[0].toFixed(3)}/zoom:${z}" target="_blank" rel="noopener">Ouvrir MarineTraffic ici</a> · <a href="https://www.vesselfinder.com/?p=1&lat=${c[0].toFixed(4)}&lon=${c[1].toFixed(4)}&zoom=${z}" target="_blank" rel="noopener">Ouvrir VesselFinder ici</a>`;
    if (choix === 'gps' && !GPS.pos) $('#ais-liens').insertAdjacentHTML('afterbegin', '<span class="alerte" style="display:block;margin-bottom:6px">Position GPS pas encore connue : carte centrée sur la vue actuelle.</span>');
  }

  function activerOnglet(n) {
    document.querySelectorAll('.ong').forEach(b => { const on = b.dataset.o === n; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('.pan').forEach(p => { p.hidden = p.dataset.o !== n; });
    if (n === 'bateaux' && !$('#ais-cadre iframe')) bateaux();
  }

  /* ---------- initialisation ---------- */
  function init() {
    map = L.map('carte', { zoomControl: true, preferCanvas: false, minZoom: 7, maxZoom: 17, maxBounds: [[11.5, -62.8], [15.8, -59.7]] }).setView([13.75, -61.1], 9);
    ['zones', 'iso', 'dangers', 'route'].forEach((p, i) => { map.createPane(p).style.zIndex = 405 + i * 5; });
    map.getPane('route').style.zIndex = 640;
    const esri = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
    const ATT_E = 'Tuiles © Esri, GEBCO, NOAA, Garmin, DeLorme';
    const bases = {
      'Relief marin, satellite de près': L.layerGroup([
        L.tileLayer(esri('Ocean/World_Ocean_Base'), { maxNativeZoom: 10, maxZoom: 11, attribution: ATT_E }),
        L.tileLayer(esri('Ocean/World_Ocean_Reference'), { maxNativeZoom: 10, maxZoom: 11 }),
        L.tileLayer(esri('World_Imagery'), { minZoom: 12, maxZoom: 17, attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' })]),
      'Satellite': L.tileLayer(esri('World_Imagery'), { maxNativeZoom: 18, maxZoom: 17, attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' }),
      'Plan OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© contributeurs OpenStreetMap' })
    };
    bases['Relief marin, satellite de près'].addTo(map);
    const seamarks = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 17, minZoom: 9, attribution: 'Balisage © OpenSeaMap' });

    const iso = L.layerGroup(), dangers = L.layerGroup(), balisage = L.layerGroup(), zones = L.layerGroup(), osmM = L.layerGroup(), mouil = L.layerGroup();
    routeLayer = L.layerGroup().addTo(map); mesureLayer = L.layerGroup().addTo(map);
    wx = new WxLayer(); particules = new Particules();

    const charger = n => fetch(`data/${n}`).then(r => r.json());
    charger('isobathes.geojson').then(g => L.geoJSON(g, { pane: 'iso',
      style: f => ({ color: isoCouleur(f.properties.depth), weight: f.properties.depth <= 10 ? 1.6 : 1, opacity: 0.9, dashArray: f.properties.depth <= 5 ? '4 3' : null }),
      onEachFeature: (f, l) => l.bindTooltip(`Isobathe ${f.properties.depth} m`, { sticky: true }) }).addTo(iso));
    charger('dangers.geojson').then(g => L.geoJSON(g, { pane: 'dangers',
      style: () => ({ color: '#b03a2e', weight: 1.2, fillColor: '#e4572e', fillOpacity: 0.28, dashArray: '3 2' }),
      pointToLayer: (f, ll) => L.marker(ll, { icon: f.properties.kind === 'wreck' ? symEpave : symRoche, pane: 'dangers' }),
      onEachFeature: (f, l) => {
        const p = f.properties, niv = p['rock:water_level'] || p['wreck:water_level'] || p['obstruction:water_level'];
        l.bindPopup(`<b>${KIND[p.kind] || 'Danger'}${p.name ? ' : ' + esc(p.name) : ''}</b>${niv ? `<br>${NIVEAU[niv] || esc(niv)}` : ''}${p.depth ? `<br>Profondeur ${esc(p.depth)} m` : ''}<br><span class="muted">Source OpenStreetMap, à recouper sur la carte officielle.</span>`);
      } }).addTo(dangers));
    charger('balisage.geojson').then(g => L.geoJSON(g, {
      pointToLayer: (f, ll) => {
        const p = f.properties, col = COULEUR[(p.colour || '').split(';')[0]] || '#f3eee2', feu = p.kind.startsWith('light');
        return feu ? L.circleMarker(ll, { radius: 4, color: '#0b1a22', weight: 1.2, fillColor: '#f2c94c', fillOpacity: 1 })
          : L.circleMarker(ll, { radius: 4.5, color: '#0b1a22', weight: 1.2, fillColor: col, fillOpacity: 1 });
      },
      onEachFeature: (f, l) => { const p = f.properties; l.bindPopup(`<b>${KIND[p.kind] || 'Marque'}${p.name ? ' : ' + esc(p.name) : ''}</b>${p.light ? `<br>Feu ${esc(p.light)}` : ''}${p.category ? `<br>${esc(p.category)}` : ''}`); }
    }).addTo(balisage));
    charger('zones.geojson').then(g => L.geoJSON(g, { pane: 'zones',
      style: f => {
        const p = f.properties, vaste = /parc naturel marin/i.test(p.name || '');
        if (p.kind === 'restricted') return { color: '#c0392b', weight: 1.5, fillColor: '#c0392b', fillOpacity: 0.18, dashArray: '5 4' };
        return { color: '#2a9d8f', weight: vaste ? 1 : 1.6, fillColor: '#2a9d8f', fillOpacity: vaste ? 0 : 0.14, dashArray: vaste ? '2 6' : '6 4', interactive: !vaste };
      },
      onEachFeature: (f, l) => { const p = f.properties; l.bindPopup(`<b>${esc(p.name || RESTR[p['restricted_area:restriction']] || 'Zone réglementée')}</b>${p.protection_title ? `<br>${esc(p.protection_title)}` : ''}${p['restricted_area:restriction'] ? `<br>${RESTR[p['restricted_area:restriction']] || esc(p['restricted_area:restriction'])}` : ''}`); }
    }).addTo(zones));
    charger('osm_mouillages.geojson').then(g => L.geoJSON(g, {
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 3, color: '#0b1a22', weight: 1, fillColor: '#9fb7bf', fillOpacity: 1 }),
      style: () => ({ color: '#9fb7bf', weight: 1, fillOpacity: 0.1 }),
      onEachFeature: (f, l) => l.bindPopup(`<b>${KIND[f.properties.kind] || 'Mouillage'}${f.properties.name ? ' : ' + esc(f.properties.name) : ''}</b><br><span class="muted">Signalé dans OpenStreetMap.</span>`)
    }).addTo(osmM));
    charger('mouillages.json').then(d => {
      mouillages = d.mouillages;
      for (const m of mouillages) {
        const mk = L.marker([m.lat, m.lon], { icon: ancre(m.type === 'secours' ? 'secours' : 'na'), title: m.nom, riseOnHover: true });
        mk.on('click', () => fiche(m.id, false));
        mk.bindTooltip(m.nom, { direction: 'top', offset: [0, -12] });
        marqueurs[m.id] = mk; mouil.addLayer(mk);
      }
      listeMouillages();
      if (W.pret) majTemps();
    });

    [iso, dangers, balisage, zones, mouil].forEach(l => l.addTo(map));
    L.control.layers(bases, {
      'Mouillages (fiches)': mouil, 'Isobathes': iso, 'Dangers': dangers, 'Balisage et feux': balisage,
      'Balisage OpenSeaMap': seamarks, 'Zones protégées et interdites': zones, 'Mouillages et bouées OSM': osmM,
      'Météo : couleurs et flèches': wx, 'Météo : vent animé': particules
    }, { collapsed: true, position: 'topright' }).addTo(map);
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
    const Compas = L.Control.extend({ options: { position: 'topleft' }, onAdd() {
      const b = L.DomUtil.create('button', 'btn-compas leaflet-bar');
      b.type = 'button'; b.title = 'Compas et instruments'; b.setAttribute('aria-label', 'Ouvrir le compas');
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 4l3 8-3 8-3-8z"/></svg>';
      L.DomEvent.disableClickPropagation(b); L.DomEvent.on(b, 'click', () => window.Instruments && window.Instruments.ouvrir());
      return b; } });
    new Compas().addTo(map);

    map.on('mousemove', e => { $('#coord').textContent = coordTxt(e.latlng); });
    map.on('move', () => { if (!matchMedia('(hover: hover)').matches) $('#coord').textContent = coordTxt(map.getCenter()); });
    map.on('click', e => {
      if (mesure.actif) { mesure.pts.push([e.latlng.lat, e.latlng.lng]); majMesure(); return; }
      L.popup().setLatLng(e.latlng).setContent(`<b>${esc(coordTxt(e.latlng))}</b><br><button type="button" class="lien-btn" id="pp-meteo">Prévision 48 h ici</button>`).openOn(map);
      setTimeout(() => { const b = $('#pp-meteo'); if (b) b.onclick = () => { map.closePopup(); prevPoint(e.latlng); }; });
    });

    // panneau
    document.querySelectorAll('.ong').forEach(b => b.addEventListener('click', () => activerOnglet(b.dataset.o)));
    $('#liste-mouillages').addEventListener('click', e => { const b = e.target.closest('.m-btn'); if (b) fiche(b.dataset.m); });
    $('#wx-temps').addEventListener('input', majTemps);
    $('#wx-mode').addEventListener('change', e => { W.mode = e.target.value; if (!map.hasLayer(wx)) wx.addTo(map); majTemps(); });
    $('#wx-etat').addEventListener('click', e => { if (e.target.id === 'wx-retry') chargerMeteo(); });
    $('#eta').addEventListener('change', e => {
      if (e.target.id === 'eta-v') { etaPrefs.vitesse = +e.target.value; eta(); majMesure(); }
      if (e.target.id === 'eta-h') { const [h, mi] = e.target.value.split(':').map(Number); const l = plan[legSel]; const d = new Date(l.depart); d.setUTCHours(h + 4, mi); l.depart = d; eta(); }
    });
    $('#btn-pos').addEventListener('click', position);
    $('#btn-compas2').addEventListener('click', () => window.Instruments && window.Instruments.ouvrir());
    $('#ais-centre').addEventListener('change', bateaux);
    $('#ais-zoom').addEventListener('change', bateaux);
    $('#ais-maj').addEventListener('click', bateaux);
    $('#btn-mesure').addEventListener('click', () => {
      mesure.actif = !mesure.actif;
      $('#btn-mesure').textContent = mesure.actif ? 'Terminer la mesure' : 'Mesurer distance et cap';
      $('#carte').classList.toggle('mesure', mesure.actif); majMesure();
    });
    $('#btn-effacer').addEventListener('click', () => { mesure.pts = []; majMesure(); });
    $('#btn-nuit').addEventListener('click', () => { const on = document.documentElement.classList.toggle('mode-nuit'); $('#btn-nuit').setAttribute('aria-pressed', on); });
    $('#btn-ret').addEventListener('click', () => { const on = $('#reticule').hidden; $('#reticule').hidden = !on; $('#btn-ret').setAttribute('aria-pressed', on); });

    wx.addTo(map);
    if (!reduit) particules.addTo(map);
    legende();
    chargerMeteo();
  }

  window.Carte = {
    visible() {
      if (map) { map.invalidateSize(); return; }
      init(); dessinerRoute();
      if (plan.length) window.Carte.etape(legSel);
    },
    plan(legs, sel, cb) { plan = legs; onLeg = cb; legSel = sel; if (map) { dessinerRoute(); } eta(); },
    etape(i) {
      legSel = i;
      document.dispatchEvent(new CustomEvent('nav:etape', { detail: i }));
      if (!map) { eta(); return; }
      dessinerRoute(); eta();
      const l = plan[i];
      if (l && l.pts.length > 1) map.fitBounds(L.latLngBounds(l.pts), { padding: [40, 40], maxZoom: 12 });
      else if (l) map.setView(l.pts[0], 12);
    }
  };
  window.Nav = {
    R, TZ, esc, heure, jourHeure, milles, cap, longueur, cardinal, deg3, coordTxt, dm, soleil, abri, interp, condAt,
    W, G, GPS, gpsDemarrer, gpsArreter, activerOnglet,
    get map() { return map; }, get plan() { return plan; }, get legSel() { return legSel; },
    get mouillages() { return mouillages; }
  };
})();
