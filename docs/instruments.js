/* Écran Compas : cap de l'appareil, GPS, vent prévu, guidage vers l'étape ou la route optimale. */
(function () {
  'use strict';
  const N = () => window.Nav;
  const R = Math.PI / 180;
  const virg = (x, n = 1) => x.toFixed(n).replace('.', ',');
  const angle = (a, b) => ((a - b) % 360 + 540) % 360 - 180;
  let el = null, ouvert = false, cap = null, capBrut = null, source = null, verrou = null, dernierGps = null, ecoute = false;

  /* ---------- rose du compas ---------- */
  function rose() {
    let g = '';
    for (let d = 0; d < 360; d += 5) {
      const long = d % 30 === 0 ? 16 : d % 10 === 0 ? 10 : 6;
      g += `<line x1="0" y1="-140" x2="0" y2="${-140 + long}" transform="rotate(${d})" class="${d % 30 ? 'gr' : 'gr f'}"/>`;
      if (d % 30 === 0) {
        const lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' }[d] || String(d / 10);
        g += `<text transform="rotate(${d}) translate(0 -108)" class="${lab.length === 1 && isNaN(lab) ? 'card' : 'deg'}">${lab}</text>`;
      }
    }
    return `<svg viewBox="-180 -180 360 360" class="rose" aria-hidden="true">
      <circle r="150" class="fond"/>
      <g id="ins-rose">${g}
        <g id="ins-vent" class="mk-vent"><path d="M0 -150 L-9 -168 L9 -168 Z"/><line x1="0" y1="-150" x2="0" y2="-92"/></g>
        <g id="ins-cog" class="mk-cog"><path d="M0 -142 L-6 -128 L6 -128 Z"/></g>
        <g id="ins-cible" class="mk-cible"><circle cx="0" cy="-146" r="8"/></g>
      </g>
      <path d="M0 -158 L-10 -176 L10 -176 Z" class="lubber"/>
      <path d="M0 -60 L16 40 L0 26 L-16 40 Z" class="bateau-c"/>
      <text y="80" class="cap-txt" id="ins-cap-c">---°</text>
    </svg>`;
  }

  function construire() {
    el = document.createElement('div');
    el.id = 'instruments';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Compas et instruments');
    el.hidden = true;
    el.innerHTML = `
      <div class="ins-h">
        <button type="button" class="ins-b" id="ins-fermer" aria-label="Fermer le compas">✕ Carte</button>
        <span id="ins-src" class="ins-src"></span>
        <button type="button" class="ins-b" id="ins-nuit" aria-pressed="false">Nuit</button>
      </div>
      <div class="ins-c">
        <div class="ins-rose">${rose()}<button type="button" class="btn" id="ins-activer" hidden>Activer le compas de l'appareil</button></div>
        <div class="ins-g">
          <div class="ins-v"><span>Cap compas</span><b id="ins-cap">–</b></div>
          <div class="ins-v"><span>Cap fond</span><b id="ins-cogv">–</b></div>
          <div class="ins-v"><span>Vitesse fond</span><b id="ins-sog">–</b></div>
          <div class="ins-v"><span>Vent prévu</span><b id="ins-tw">–</b><small id="ins-tw2"></small></div>
          <div class="ins-v large"><span id="ins-cible-t">Vers</span><b id="ins-brg">–</b><small id="ins-cible2"></small></div>
          <div class="ins-v large"><span>Position</span><b id="ins-pos" class="pos">GPS en attente…</b><small id="ins-prec"></small></div>
        </div>
      </div>
      <p class="ins-note">Repères sur la rose : <i class="k-cible"></i> destination · <i class="k-cog"></i> cap fond · <i class="k-vent"></i> d'où vient le vent. Le compas d'un téléphone est perturbé par le métal et l'électronique du bord : le compas du bateau fait foi.</p>`;
    document.body.appendChild(el);
    el.querySelector('#ins-fermer').addEventListener('click', fermer);
    el.querySelector('#ins-nuit').addEventListener('click', e => { const on = document.documentElement.classList.toggle('mode-nuit'); e.target.setAttribute('aria-pressed', on); const b = document.querySelector('#btn-nuit'); if (b) b.setAttribute('aria-pressed', on); });
    el.querySelector('#ins-activer').addEventListener('click', demanderPermission);
    document.addEventListener('keydown', e => { if (ouvert && e.key === 'Escape') fermer(); });
  }

  /* ---------- orientation de l'appareil ---------- */
  function orientationEcran() { return (screen.orientation && screen.orientation.angle) || window.orientation || 0; }
  function surOrientation(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading; // iOS : déjà par rapport au nord
    else if (e.absolute && e.alpha != null) h = 360 - e.alpha;
    if (h == null || Number.isNaN(h)) return;
    h = (h + orientationEcran() + 360) % 360;
    capBrut = h;
    // lissage circulaire
    cap = cap == null ? h : (cap + angle(h, cap) * 0.25 + 360) % 360;
    source = 'compas';
    if (el && !el.querySelector('#ins-activer').hidden) el.querySelector('#ins-activer').hidden = true;
    if (ouvert) dessiner();
    if (!emis) { emis = true; requestAnimationFrame(() => { emis = false; document.dispatchEvent(new CustomEvent('nav:cap', { detail: cap })); }); }
  }
  let emis = false;
  // à appeler pendant un geste (clic) : iOS exige la permission à ce moment-là
  async function activerCompas() {
    if (ecoute) return true;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { if (await DeviceOrientationEvent.requestPermission() !== 'granted') return false; } catch (e) { return false; }
    }
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    ecouter(); return true;
  }
  function ecouter() {
    if (ecoute) return;
    ecoute = true;
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', surOrientation);
    else window.addEventListener('deviceorientation', surOrientation);
  }
  async function demanderPermission() {
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r === 'granted') { ecouter(); el.querySelector('#ins-activer').hidden = true; }
      else el.querySelector('#ins-src').textContent = 'Compas refusé : cap fond GPS seulement';
    } catch (e) { el.querySelector('#ins-src').textContent = 'Compas indisponible : cap fond GPS seulement'; }
  }

  /* ---------- cible : prochain point de la route ---------- */
  function cible(pos) {
    const nav = N(), route = window.Routage && window.Routage.route;
    const l = nav.plan[nav.legSel];
    const pts = route || (l && l.mer ? l.pts : null);
    if (!pts || pts.length < 2) return null;
    const nom = route ? 'route optimale' : `étape ${l ? l.titre : ''}`;
    if (!pos) return { nom, pt: pts[pts.length - 1], fin: pts[pts.length - 1] };
    // segment le plus proche, puis on vise sa fin
    let best = 0, bd = Infinity, xte = 0;
    const kx = Math.cos(pos[0] * R);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const ax = (a[1] - pos[1]) * kx, ay = a[0] - pos[0], bx = (b[1] - pos[1]) * kx, by = b[0] - pos[0];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-12;
      const f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2));
      const px = ax + dx * f, py = ay + dy * f, d = Math.hypot(px, py) * 60;
      if (d < bd) { bd = d; best = i; xte = d * Math.sign(ax * dy - ay * dx); }
    }
    // si on est tout près de la fin du segment, on vise le suivant
    if (best < pts.length - 1 && nav.milles(pos, pts[best]) < 0.15) best++;
    return { nom, pt: pts[best], fin: pts[pts.length - 1], xte, reste: nav.milles(pos, pts[best]) + nav.longueur(pts.slice(best)) };
  }

  const ALLURE = twa => twa < 45 ? 'trop près : virer ou moteur' : twa < 70 ? 'près' : twa < 110 ? 'travers' : twa < 150 ? 'largue' : 'vent arrière';

  function dessiner() {
    if (!el || !ouvert) return;
    const nav = N(), g = nav.GPS.pos;
    const set = (id, v) => { const x = el.querySelector(id); if (x) x.innerHTML = v; };
    const capAff = source === 'compas' ? cap : (g && g.cog != null ? g.cog : null);
    set('#ins-src', source === 'compas' ? 'Cap : compas de l\'appareil' : g && g.cog != null ? 'Cap : cap fond GPS (pas de compas)' : 'En attente du cap…');
    el.querySelector('#ins-rose').setAttribute('transform', `rotate(${-(capAff || 0)})`);
    set('#ins-cap', source === 'compas' ? nav.deg3(cap) : '–');
    set('#ins-cap-c', capAff != null ? nav.deg3(capAff) : '---°');
    set('#ins-cogv', g && g.cog != null ? nav.deg3(g.cog) : '–');
    set('#ins-sog', g && g.sog != null ? `${virg(g.sog)}<small> nd</small>` : '–');
    const cog = el.querySelector('#ins-cog');
    cog.style.display = g && g.cog != null ? '' : 'none';
    if (g && g.cog != null) cog.setAttribute('transform', `rotate(${g.cog})`);
    // vent
    const ici = g ? g.ll : nav.map ? [nav.map.getCenter().lat, nav.map.getCenter().lng] : null;
    const c = ici && nav.W.pret ? nav.condAt(ici[0], ici[1], nav.W.t0) : null;
    const vent = el.querySelector('#ins-vent');
    if (c) {
      vent.style.display = ''; vent.setAttribute('transform', `rotate(${c.vdir})`);
      set('#ins-tw', `${Math.round(c.vit)}<small> nd</small> ${nav.cardinal(c.vdir)}`);
      const ref = capAff != null ? capAff : null;
      set('#ins-tw2', ref != null ? `angle au vent ${Math.round(Math.abs(angle(ref, c.vdir)))}° · ${ALLURE(Math.abs(angle(ref, c.vdir)))}` : `rafales ${Math.round(c.raf)} nd`);
    } else { vent.style.display = 'none'; set('#ins-tw', '–'); set('#ins-tw2', nav.W.pret ? '' : 'météo non chargée'); }
    // cible
    const t = cible(g ? g.ll : null), mk = el.querySelector('#ins-cible');
    if (t && g) {
      const brg = nav.cap(g.ll, t.pt), d = nav.milles(g.ll, t.pt);
      mk.style.display = ''; mk.setAttribute('transform', `rotate(${brg})`);
      set('#ins-cible-t', `Vers ${nav.esc(t.nom)}`);
      set('#ins-brg', `${nav.deg3(brg)} <small>${virg(d)} M</small>`);
      const eta = g.sog > 0.5 ? new Date(Date.now() + t.reste / g.sog * 3600e3) : null;
      set('#ins-cible2', `Écart de route ${virg(Math.abs(t.xte), 2)} M ${t.xte > 0.02 ? 'à droite' : t.xte < -0.02 ? 'à gauche' : ''} · reste ${virg(t.reste)} M${eta ? ` · arrivée ${nav.heure(eta)}` : ''}`);
    } else {
      mk.style.display = 'none';
      set('#ins-cible-t', t ? `Vers ${nav.esc(t.nom)}` : 'Vers');
      set('#ins-brg', '–'); set('#ins-cible2', t ? 'Position GPS nécessaire' : 'Choisis une étape en mer');
    }
    if (g) { set('#ins-pos', nav.esc(nav.coordTxt(L.latLng(g.ll[0], g.ll[1]))).replace('  ', '<br>')); set('#ins-prec', `précision ${Math.round(g.prec)} m`); }
  }

  async function garderEcran() {
    try { if ('wakeLock' in navigator && ouvert && document.visibilityState === 'visible') verrou = await navigator.wakeLock.request('screen'); } catch (e) { verrou = null; }
  }

  function ouvrir() {
    if (!el) construire();
    ouvert = true; el.hidden = false; document.body.classList.add('ins-ouvert');
    N().gpsDemarrer('compas');
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      if (!ecoute) el.querySelector('#ins-activer').hidden = false;
    } else ecouter();
    garderEcran();
    dessiner();
    el.querySelector('#ins-fermer').focus();
  }
  function fermer() {
    ouvert = false; el.hidden = true; document.body.classList.remove('ins-ouvert');
    N().gpsArreter('compas');
    if (verrou) { verrou.release().catch(() => {}); verrou = null; }
  }

  document.addEventListener('nav:pos', () => { if (ouvert) dessiner(); });
  document.addEventListener('nav:meteo', () => { if (ouvert) dessiner(); });
  document.addEventListener('visibilitychange', () => { if (ouvert && document.visibilityState === 'visible') garderEcran(); });
  // rafraîchit le guidage même sans nouveau point GPS (compas lissé)
  setInterval(() => { if (ouvert && source !== 'compas') dessiner(); }, 2000);

  window.Instruments = { ouvrir, fermer, activerCompas, cible,
    get cap() { return source === 'compas' ? cap : null; }, get ecoute() { return ecoute; },
    _test: { surOrientation } };
})();
