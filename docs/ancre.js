/* Alarme de mouillage : position de l'ancre, test de prise en marche arrière, surveillance du cercle d'évitage
   avec alarme sonore. GPS partagé via Nav.gpsDemarrer('ancre'). État gardé dans localStorage « fc-ancre ». */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const N = () => window.Nav;
  const BATEAU = 12, MARGE = 8; // longueur de l'Excess 11 (m) et marge GPS (m)
  const CLE = 'fc-ancre';
  const m = (a, b) => N().milles(a, b) * 1852;
  const virg = (x, n = 0) => x.toFixed(n).replace('.', ',');

  let st = { pos: null, chaine: 30, veille: false };
  let couche = null, mkAncre = null, cercle = null, trace = null, point = null, puce = null;
  let hors = 0, dernierFix = 0, alarme = null, silenceJusqua = 0, verrou = null, test = null, gpsPris = false, audio = null;

  const rayon = () => st.chaine + BATEAU + MARGE;
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify({ pos: st.pos, chaine: st.chaine, veille: st.veille })); } catch (e) { } }
  function charger() { try { const o = JSON.parse(localStorage.getItem(CLE) || 'null'); if (o) Object.assign(st, o); } catch (e) { } }

  function gps(on) {
    if (on && !gpsPris) { gpsPris = N().gpsDemarrer('ancre'); }
    if (!on && gpsPris) { N().gpsArreter('ancre'); gpsPris = false; }
    return gpsPris;
  }
  const besoinGps = () => st.veille || !!test;

  /* ---------- carte ---------- */
  function dessiner() {
    const map = N().map; if (!map) return;
    if (!couche) couche = L.layerGroup().addTo(map);
    if (!st.pos) { couche.clearLayers(); mkAncre = cercle = trace = point = null; majPuce(); return; }
    if (!mkAncre) {
      mkAncre = L.marker(st.pos, { draggable: true, zIndexOffset: 900, title: 'Ancre (glisser pour corriger)',
        icon: L.divIcon({ className: 'ico-ancre-m', html: '⚓', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(couche);
      mkAncre.on('dragend', () => { const ll = mkAncre.getLatLng(); st.pos = [ll.lat, ll.lng]; sauver(); dessiner(); maj(); });
      cercle = L.circle(st.pos, { radius: rayon(), color: '#5ad6cf', weight: 2, fillOpacity: 0.08, dashArray: '6 6', interactive: false }).addTo(couche);
      trace = L.polyline([], { color: '#f2c94c', weight: 2, opacity: 0.8, interactive: false }).addTo(couche);
    }
    mkAncre.setLatLng(st.pos); cercle.setLatLng(st.pos); cercle.setRadius(rayon());
    cercle.setStyle({ color: alarme ? '#ff5a4f' : '#5ad6cf' });
    majPuce();
  }
  function majPuce() {
    const map = N().map; if (!map) return;
    if (!puce) {
      puce = document.createElement('button'); puce.type = 'button'; puce.className = 'an-puce'; puce.hidden = true;
      puce.addEventListener('click', () => { N().activerOnglet('outils'); document.getElementById('an-titre').scrollIntoView({ block: 'start' }); });
      map.getContainer().parentElement.appendChild(puce);
    }
    const g = N().GPS.pos;
    puce.hidden = !st.pos;
    if (!st.pos) return;
    const d = g ? m(g.ll, st.pos) : null;
    puce.classList.toggle('alerte', !!alarme); puce.classList.toggle('veille', st.veille);
    puce.innerHTML = `⚓ ${d != null ? `${Math.round(d)} m` : '…'} / ${rayon()} m${st.veille ? ' · surveillance' : ''}`;
  }

  /* ---------- affichage du panneau ---------- */
  function maj() {
    if (!$('#an')) return;
    const g = N().GPS.pos, d = g && st.pos ? m(g.ll, st.pos) : null;
    $('#an-ch').value = st.chaine; $('#an-ch-v').textContent = `${st.chaine} m`;
    $('#an-calc').textContent = `Cercle d'alarme : ${rayon()} m (chaîne ${st.chaine} m + bateau ${BATEAU} m + marge GPS ${MARGE} m). Mouiller 4 à 5 fois la profondeur : par 6 m de fond, 25 à 30 m de chaîne.`;
    $('#an-mes').hidden = !st.pos;
    $('#an-d').textContent = d != null ? `${Math.round(d)} m` : '–';
    $('#an-d').classList.toggle('rouge', d != null && d > rayon());
    $('#an-r').textContent = `${rayon()} m`;
    $('#an-p').textContent = g ? `±${Math.round(g.prec)} m` : (besoinGps() ? 'recherche…' : '–');
    $('#an-poser').textContent = st.pos ? '⚓ Remarquer l\'ancre ici' : '⚓ Marquer l\'ancre ici';
    $('#an-veille').textContent = st.veille ? 'Arrêter la surveillance' : 'Activer la surveillance';
    $('#an-veille').setAttribute('aria-pressed', st.veille);
    $('#an-lever').hidden = !st.pos;
    $('#an-etat').innerHTML = !st.pos ? 'Marque l\'ancre au moment où elle touche le fond, teste la prise en marche arrière, puis active la surveillance : le téléphone sonne si le bateau sort du cercle.'
      : st.veille ? `<b class="ok">Surveillance active.</b> Alarme si le bateau sort du cercle de ${rayon()} m. Garde l'écran allumé.`
      : 'Ancre marquée. Tu peux la déplacer sur la carte en la faisant glisser.';
    dessiner();
  }

  /* ---------- actions ---------- */
  async function poser() {
    if (!gps(true)) { $('#an-etat').textContent = 'La géolocalisation n\'est pas disponible sur cet appareil.'; return; }
    $('#an-etat').textContent = 'Recherche de la position GPS…';
    const g = await fixFrais(15000);
    if (!g) { $('#an-etat').textContent = 'Pas de position GPS : réessaie à l\'extérieur, écran allumé.'; if (!besoinGps()) gps(false); return; }
    st.pos = g.ll.slice(); sauver();
    if (trace) trace.setLatLngs([]);
    if (!besoinGps()) gps(false);
    dessiner(); maj();
    const map = N().map; if (map) map.setView(st.pos, Math.max(map.getZoom(), 16));
  }
  // attend un point GPS récent (moins de 10 s)
  function fixFrais(delai) {
    return new Promise(res => {
      const g = N().GPS.pos;
      if (g && Date.now() - (g.t || 0) < 10000) return res(g);
      const f = e => { document.removeEventListener('nav:pos', f); clearTimeout(t); res(e.detail); };
      const t = setTimeout(() => { document.removeEventListener('nav:pos', f); res(null); }, delai);
      document.addEventListener('nav:pos', f);
    });
  }

  function lancerTest() {
    if (test) { finTest(true); return; }
    if (!gps(true)) return;
    debloquerSon();
    test = { t0: Date.now(), pts: [], ref: st.pos ? st.pos.slice() : null, minuteur: null };
    $('#an-test').textContent = 'Arrêter le test';
    $('#an-barre').hidden = false; $('#an-verdict').hidden = false;
    $('#an-verdict').className = 'an-verdict'; $('#an-verdict').textContent = 'Recule doucement au moteur (environ 1 500 tr/min), chaîne tendue…';
    test.minuteur = setInterval(() => {
      const f = Math.min(1, (Date.now() - test.t0) / 60000);
      $('#an-barre').firstElementChild.style.width = (f * 100) + '%';
      if (f >= 1) finTest(false);
    }, 500);
    gardeEcran(true);
  }
  function surTest(g) {
    if (!test) return;
    if (!test.ref) test.ref = g.ll.slice();
    test.pts.push({ t: (Date.now() - test.t0) / 1000, d: m(g.ll, test.ref), prec: g.prec });
    const d = test.pts[test.pts.length - 1].d;
    $('#an-verdict').textContent = `En cours : ${Math.round(d)} m ${st.pos ? 'de l\'ancre' : 'du point de départ'}, ${g.sog != null ? virg(g.sog, 1) + ' nd' : '…'}.`;
  }
  // verdict : sur les 30 dernières secondes, le bateau doit être immobile, chaîne tendue
  function finTest(interrompu) {
    clearInterval(test.minuteur);
    const pts = test.pts, fin = pts.length ? pts[pts.length - 1].t : 0;
    const der = pts.filter(p => p.t >= fin - 30);
    let txt, cls;
    if (der.length < 4) { txt = 'Pas assez de points GPS pour conclure : refaire le test, écran allumé.'; cls = ''; }
    else {
      const n = der.length, mt = der.reduce((s, p) => s + p.t, 0) / n, md = der.reduce((s, p) => s + p.d, 0) / n;
      const pente = der.reduce((s, p) => s + (p.t - mt) * (p.d - md), 0) / (der.reduce((s, p) => s + (p.t - mt) ** 2, 0) || 1); // m/s
      const ecart = Math.max(...der.map(p => p.d)) - Math.min(...der.map(p => p.d));
      const prec = der.reduce((s, p) => s + p.prec, 0) / n;
      if (pente > 0.12) { txt = `L'ancre dérape : le bateau recule encore de ${virg(pente * 60)} m par minute. Relever et mouiller à nouveau, avec plus de chaîne ou ailleurs.`; cls = 'ko'; }
      else if (ecart <= Math.max(5, prec * 0.8)) { txt = `L'ancre a crocheté : le bateau ne bouge plus (moins de ${Math.max(1, Math.round(ecart))} m sur 30 secondes). Tu peux activer la surveillance.`; cls = 'ok'; }
      else { txt = `Incertain : le bateau bouge encore de ${Math.round(ecart)} m (précision GPS ±${Math.round(prec)} m). Prolonger la marche arrière et refaire le test.`; cls = 'moyen'; }
    }
    if (interrompu && cls !== 'ko') txt = 'Test arrêté. ' + txt;
    $('#an-verdict').textContent = txt; $('#an-verdict').className = 'an-verdict ' + cls;
    $('#an-test').textContent = 'Tester la prise (marche arrière, 60 s)';
    $('#an-barre').hidden = true;
    test = null;
    if (!besoinGps()) { gps(false); gardeEcran(false); }
  }

  function veille(on) {
    if (on && !st.pos) { $('#an-etat').innerHTML = '<span class="alerte-i">Marque d\'abord la position de l\'ancre.</span>'; return; }
    st.veille = on; hors = 0; silenceJusqua = 0; sauver();
    if (on) { gps(true); debloquerSon(); dernierFix = Date.now(); gardeEcran(true); }
    else { couperAlarme(); if (!besoinGps()) gps(false); gardeEcran(false); }
    dessiner(); maj();
  }
  function lever() {
    if (st.veille) veille(false);
    st.pos = null; sauver(); if (trace) trace.setLatLngs([]);
    $('#an-verdict').hidden = true;
    dessiner(); maj();
  }

  /* ---------- surveillance ---------- */
  function surPos(e) {
    const g = e.detail; if (!g) return;
    surTest(g);
    if (!st.pos) return;
    dernierFix = Date.now();
    if (couche && (st.veille || test)) {
      if (!point) point = L.circleMarker(g.ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#0a84ff', fillOpacity: 1, interactive: false }).addTo(couche);
      point.setLatLng(g.ll);
    }
    if (trace && (st.veille || test)) { trace.addLatLng(g.ll); const ll = trace.getLatLngs(); if (ll.length > 2000) trace.setLatLngs(ll.slice(-1500)); }
    if (st.veille) {
      const d = m(g.ll, st.pos);
      // on ne compte que les points nettement hors du cercle, précision GPS déduite
      if (d - Math.min(g.prec, 30) > rayon()) hors++; else { hors = 0; if (alarme && alarme.type === 'gps') couperAlarme(); }
      if (hors >= 3) declencher('chasse', d);
    }
    maj();
  }
  setInterval(() => {
    if (st.veille && Date.now() - dernierFix > 120000) declencher('gps');
  }, 5000);

  function declencher(type, d) {
    if (Date.now() < silenceJusqua) return;
    const dejaLa = !!alarme;
    alarme = { type };
    let el = $('#an-alarme');
    if (!el) {
      el = document.createElement('div'); el.id = 'an-alarme'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
      el.innerHTML = `<div class="an-al-c"><div class="an-al-i" aria-hidden="true">⚓</div><h2 id="an-al-t"></h2><p id="an-al-d"></p>
        <div class="an-al-b"><button type="button" id="an-al-voir">Voir sur la carte</button><button type="button" id="an-al-5">Silence 5 min</button><button type="button" id="an-al-stop">Arrêter la surveillance</button></div></div>`;
      document.body.appendChild(el);
      el.querySelector('#an-al-5').addEventListener('click', () => { silenceJusqua = Date.now() + 300000; couperAlarme(); });
      el.querySelector('#an-al-stop').addEventListener('click', () => veille(false));
      el.querySelector('#an-al-voir').addEventListener('click', () => {
        couperSon(); el.hidden = true;
        const map = N().map, g = N().GPS.pos;
        if (typeof window.show === 'function') window.show('route');
        if (map && st.pos) map.fitBounds(L.latLngBounds([st.pos, g ? g.ll : st.pos]).pad(0.6), { maxZoom: 17 });
      });
    }
    el.hidden = false; el.dataset.type = type;
    el.querySelector('#an-al-t').textContent = type === 'gps' ? 'GPS perdu' : 'L\'ancre chasse !';
    el.querySelector('#an-al-d').textContent = type === 'gps' ? 'Plus de position GPS depuis 2 minutes : l\'alarme ne peut plus surveiller le bateau. Vérifie le mouillage à vue.'
      : `Le bateau est à ${Math.round(d)} m de l'ancre, au-delà du cercle de ${rayon()} m. Vérifie le mouillage, moteurs prêts.`;
    if (!dejaLa) son(type === 'gps' ? 0.5 : 1);
    if (navigator.vibrate) navigator.vibrate([600, 300, 600, 300, 600]);
    dessiner();
  }
  function couperSon() { if (audio && audio.osc) { try { audio.osc.stop(); } catch (e) { } audio.osc = null; clearInterval(audio.bip); } if (navigator.vibrate) navigator.vibrate(0); }
  function couperAlarme() { couperSon(); alarme = null; hors = 0; const el = $('#an-alarme'); if (el) el.hidden = true; dessiner(); }

  /* ---------- son : sirène WebAudio (débloquée pendant un toucher) ---------- */
  function debloquerSon() {
    try {
      if (!audio) audio = { ctx: new (window.AudioContext || window.webkitAudioContext)() };
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
    } catch (e) { audio = null; }
  }
  function son(volume) {
    if (!audio) return;
    try {
      couperSon();
      const ctx = audio.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square'; gain.gain.value = 0.35 * volume;
      osc.connect(gain).connect(ctx.destination); osc.start();
      let haut = false;
      audio.bip = setInterval(() => { haut = !haut; osc.frequency.setValueAtTime(haut ? 1320 : 880, ctx.currentTime); }, 350);
      audio.osc = osc;
    } catch (e) { }
  }

  async function gardeEcran(on) {
    try {
      if (on && !verrou && 'wakeLock' in navigator && document.visibilityState === 'visible') { verrou = await navigator.wakeLock.request('screen'); verrou.addEventListener('release', () => { verrou = null; }); }
      if (!on && verrou && !st.veille && !test) { await verrou.release(); verrou = null; }
    } catch (e) { verrou = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (st.veille || test)) gardeEcran(true); });
  // tout toucher réarme le son (iOS suspend l'audio sans geste)
  document.addEventListener('pointerdown', () => { if (st.veille && audio && audio.ctx.state === 'suspended') audio.ctx.resume(); }, { passive: true });

  /* ---------- démarrage ---------- */
  function init() {
    if (!$('#an') || !N()) return false;
    charger();
    $('#an-poser').addEventListener('click', poser);
    $('#an-test').addEventListener('click', lancerTest);
    $('#an-veille').addEventListener('click', () => veille(!st.veille));
    $('#an-lever').addEventListener('click', () => { if (confirm('Effacer la position de l\'ancre et arrêter la surveillance ?')) lever(); });
    $('#an-ch').addEventListener('input', e => { st.chaine = +e.target.value; sauver(); dessiner(); maj(); });
    document.addEventListener('nav:pos', surPos);
    dessiner(); maj();
    if (st.veille) { // reprise après réouverture de l'app : GPS relancé, le son attend un toucher
      gps(true); dernierFix = Date.now(); gardeEcran(true);
      $('#an-etat').innerHTML = '<b class="ok">Surveillance reprise.</b> <span class="alerte-i">Touche l\'écran une fois pour réarmer l\'alarme sonore.</span>';
      document.addEventListener('pointerdown', debloquerSon, { once: true });
    }
    return true;
  }
  // la surveillance marche sans la carte ; le dessin apparaît quand la carte est créée
  const essai = setInterval(() => { if (init()) clearInterval(essai); }, 300);
  const attenteCarte = setInterval(() => { if (N() && N().map) { clearInterval(attenteCarte); dessiner(); } }, 1000);

  window.Ancre = { get etat() { return { ...st, rayon: rayon(), alarme: alarme && alarme.type }; }, _test: { declencher, couperAlarme } };
})();
