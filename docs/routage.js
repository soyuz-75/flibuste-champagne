/* Routage météo par isochrones pour un Excess 11 (polaire approchée). S'appuie sur window.Nav (carte.js). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const N = () => window.Nav;
  const R = Math.PI / 180;
  const virg = (x, n = 1) => x.toFixed(n).replace('.', ',');

  /* ---------- polaire approchée d'un Excess 11 (nœuds), voiles d'origine, ris pris à 25 nœuds ---------- */
  const TWS = [6, 8, 10, 12, 14, 16, 20, 25, 30];
  const TWA = [40, 45, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
  const POL = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [3.2, 4.2, 5.0, 5.6, 6.0, 6.3, 6.5, 6.3, 5.8],
    [3.8, 4.8, 5.7, 6.3, 6.8, 7.1, 7.3, 7.0, 6.4],
    [4.3, 5.4, 6.3, 6.9, 7.4, 7.7, 8.0, 7.6, 7.0],
    [4.8, 6.0, 6.9, 7.6, 8.1, 8.5, 8.9, 8.6, 8.0],
    [5.0, 6.3, 7.2, 8.0, 8.6, 9.0, 9.6, 9.4, 8.8],
    [5.0, 6.3, 7.3, 8.2, 8.9, 9.4, 10.1, 10.0, 9.4],
    [4.8, 6.1, 7.1, 8.0, 8.8, 9.3, 10.1, 10.2, 9.6],
    [4.3, 5.6, 6.6, 7.5, 8.3, 8.9, 9.8, 10.2, 9.8],
    [3.7, 4.9, 5.9, 6.8, 7.6, 8.2, 9.2, 9.8, 9.6],
    [3.3, 4.4, 5.3, 6.1, 6.9, 7.5, 8.6, 9.3, 9.2],
    [3.0, 4.0, 4.9, 5.7, 6.4, 7.0, 8.1, 8.9, 8.9]];
  function bord(tab, x) { // indice et fraction dans un tableau croissant
    if (x <= tab[0]) return [0, 0];
    for (let i = 1; i < tab.length; i++) if (x <= tab[i]) return [i - 1, (x - tab[i - 1]) / (tab[i] - tab[i - 1])];
    return [tab.length - 2, 1];
  }
  function polaire(tws, twa) {
    if (twa < 40) return 0;
    let fac = 1;
    if (tws < 6) { fac = tws / 6; tws = 6; }
    if (tws > 30) { fac = Math.max(0.5, 1 - (tws - 30) * 0.05); tws = 30; }
    const [i, a] = bord(TWA, twa), [j, b] = bord(TWS, tws);
    const v = POL[i][j] * (1 - a) * (1 - b) + POL[i][j + 1] * (1 - a) * b + POL[i + 1][j] * a * (1 - b) + POL[i + 1][j + 1] * a * b;
    return v * fac;
  }

  /* ---------- masque terre / hauts-fonds / récifs ---------- */
  let masque = null;
  const chargeMasque = fetch('data/masque.json').then(r => r.json()).then(d => {
    const bin = atob(d.bits), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    // marge de sécurité : on interdit aussi les cases à moins de MARGE cases (~450 m chacune) d'un obstacle
    const MARGE = 2, n = d.nla * d.nlo, brut = new Uint8Array(n), dil = new Uint8Array(n);
    for (let k = 0; k < n; k++) brut[k] = (u[k >> 3] >> (7 - (k & 7))) & 1;
    for (let i = 0; i < d.nla; i++) for (let j = 0; j < d.nlo; j++) {
      if (!brut[i * d.nlo + j]) continue;
      for (let di = -MARGE; di <= MARGE; di++) for (let dj = -MARGE; dj <= MARGE; dj++) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < d.nla && jj < d.nlo && di * di + dj * dj <= MARGE * MARGE + 1) dil[ii * d.nlo + jj] = 1;
      }
    }
    masque = { ...d, dil };
  }).catch(() => { masque = null; });
  function bloque(lat, lon) {
    if (!masque) return false;
    const i = Math.round((lat - masque.lat0) / masque.pas), j = Math.round((lon - masque.lon0) / masque.pas);
    if (i < 0 || j < 0 || i >= masque.nla || j >= masque.nlo) return false;
    return masque.dil[i * masque.nlo + j];
  }
  function libre(a, b) {
    const d = N().milles(a, b), n = Math.max(1, Math.ceil(d * 1852 / 150));
    for (let s = 1; s <= n; s++) { const f = s / n; if (bloque(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)) return false; }
    return true;
  }

  /* ---------- vent et courant à un instant quelconque ---------- */
  const CLIM = { tws: 16, twd: 75 }; // alizé moyen de fin novembre
  function meteo(lat, lon, ms, etat) {
    const { W, interp } = N();
    let u = NaN, v = NaN, cu = 0, cv = 0;
    if (W.pret) {
      const h = (ms - W.heures[0].getTime()) / 3600e3;
      if (h >= 0 && h < W.heures.length - 1) {
        const t0 = Math.floor(h), f = h - t0;
        const lerp = arr => { const a = interp(arr, t0, lat, lon), b = interp(arr, t0 + 1, lat, lon); return Number.isNaN(b) ? a : a + (b - a) * f; };
        u = lerp(W.U); v = lerp(W.V);
        const x = lerp(W.CU), y = lerp(W.CV);
        if (!Number.isNaN(x) && !Number.isNaN(y)) { cu = x; cv = y; }
      }
    }
    if (Number.isNaN(u) || Number.isNaN(v)) {
      etat.clim = true;
      const a = (CLIM.twd + 180) * R; u = CLIM.tws * Math.sin(a); v = CLIM.tws * Math.cos(a);
    }
    return { tws: Math.hypot(u, v), twd: (Math.atan2(u, v) / R + 180 + 360) % 360, cu, cv };
  }
  const angle = (a, b) => { let d = ((a - b) % 360 + 540) % 360 - 180; return d; }; // a - b dans ]-180,180]
  function avance(p, capDeg, dist) { // dist en milles, déplacement local plat (suffisant pour 2-3 milles)
    const dlat = dist * Math.cos(capDeg * R) / 60, dlon = dist * Math.sin(capDeg * R) / (60 * Math.cos(p[0] * R));
    return [p[0] + dlat, p[1] + dlon];
  }
  function vitesse(m, capDeg, prefs) {
    const twa = Math.abs(angle(capDeg, m.twd));
    let v = polaire(m.tws, twa) * prefs.rendement, moteur = false;
    if (prefs.moteur && v < prefs.seuil) {
      let vm = prefs.vMoteur;
      if (twa < 60) vm *= Math.max(0.55, 1 - 0.015 * Math.max(0, m.tws - 10)); // moteur face au vent et au clapot
      if (vm > v) { v = vm; moteur = true; }
    }
    // vitesse fond = surface + courant
    const vx = v * Math.sin(capDeg * R) + m.cu, vy = v * Math.cos(capDeg * R) + m.cv;
    return { v, moteur, twa, sog: Math.hypot(vx, vy), cog: (Math.atan2(vx, vy) / R + 360) % 360 };
  }

  /* ---------- isochrones ---------- */
  const DT = 20 / 60, PAS_CAP = 5, SECTEUR = 3, MAX_H = 36;
  function calculer(A, B, depart, prefs, progres) {
    const { milles, cap } = N();
    const etat = { clim: false };
    const t0 = depart.getTime();
    let front = [{ p: A, t: t0, parent: null }];
    const isos = [];
    let arrivee = null;
    const nmax = Math.round(MAX_H / DT);
    return new Promise(res => {
      let k = 0;
      const etape = () => {
        const secteurs = new Map();
        for (const n of front) {
          const m = meteo(n.p[0], n.p[1], n.t, etat);
          const vers = cap(n.p, B), dB = milles(n.p, B);
          // arrivée possible depuis ce point ?
          const s = vitesse(m, vers, prefs);
          if (s.v > 0.3 && s.sog > 0.3 && dB <= s.sog * DT && libre(n.p, B)) {
            const t = n.t + dB / s.sog * 3600e3;
            if (!arrivee || t < arrivee.t) arrivee = { p: B, t, parent: n, ...s, capS: vers, tws: m.tws, twd: m.twd };
          }
          for (let h = 0; h < 360; h += PAS_CAP) {
            if (Math.abs(angle(h, vers)) > 115) continue;
            const s2 = vitesse(m, h, prefs);
            if (s2.v < 0.3 || s2.sog < 0.3) continue;
            const q = avance(n.p, s2.cog, s2.sog * DT);
            if (!libre(n.p, q)) continue;
            const dA = milles(A, q), sec = Math.round(cap(A, q) / SECTEUR);
            // on garde le point le plus proche de l'arrivée dans chaque secteur, à départ égal le plus avancé
            const score = milles(q, B) - dA * 0.05;
            const prev = secteurs.get(sec);
            if (!prev || score < prev.score) secteurs.set(sec, { p: q, t: n.t + DT * 3600e3, parent: n, score, ...s2, capS: h, tws: m.tws, twd: m.twd });
          }
        }
        k++;
        if (arrivee || !secteurs.size || k >= nmax) {
          res({ arrivee, isos, etat, bloque: !secteurs.size && !arrivee });
          return;
        }
        // élagage supplémentaire : on écarte les points nettement plus loin de l'arrivée que le meilleur
        let front2 = [...secteurs.values()];
        const best = Math.min(...front2.map(x => x.score));
        front2 = front2.filter(x => x.score < best + 25);
        front = front2;
        if (k % 3 === 0) isos.push(front.map(x => x.p).sort((a, b) => cap(A, a) - cap(A, b)));
        progres(k / nmax, front.length);
        setTimeout(etape, 0);
      };
      etape();
    });
  }

  /* simulation de la route tracée à la main, pour comparer */
  function simulerTracee(pts, depart, prefs) {
    const { milles, cap } = N();
    const etat = { clim: false };
    let t = depart.getTime();
    for (let i = 1; i < pts.length; i++) {
      let p = pts[i - 1];
      const c = cap(p, pts[i]);
      let reste = milles(p, pts[i]);
      while (reste > 0.01) {
        const m = meteo(p[0], p[1], t, etat);
        const s = vitesse(m, c, { ...prefs, moteur: true, seuil: Math.max(prefs.seuil, 0.1) });
        const sog = Math.max(1, s.sog), d = Math.min(reste, sog * DT);
        p = avance(p, c, d); reste -= d; t += d / sog * 3600e3;
      }
    }
    return new Date(t);
  }

  /* ---------- interface ---------- */
  let calque = null, derniere = null, enCours = false;
  const prefs = { rendement: 0.8, moteur: true, seuil: 4, vMoteur: 6 };
  const ALLURE = twa => twa < 50 ? 'près serré' : twa < 70 ? 'près' : twa < 110 ? 'travers' : twa < 150 ? 'largue' : 'vent arrière';

  function ui() {
    const box = $('#routage'); if (!box) return;
    const l = N() && N().plan[N().legSel];
    if (!l || !l.mer) { box.innerHTML = ''; effacer(); return; }
    box.innerHTML = `<h4>Route optimale selon le vent</h4>
      <div class="eta-g">
        <label>Rendement de l'équipage<select id="rt-rend">${[0.7, 0.8, 0.9, 1].map(v => `<option value="${v}"${v === prefs.rendement ? ' selected' : ''}>${Math.round(v * 100)} % de la polaire</option>`).join('')}</select></label>
        <label>Moteur sous<select id="rt-seuil">${[0, 3, 4, 5].map(v => `<option value="${v}"${v === (prefs.moteur ? prefs.seuil : 0) ? ' selected' : ''}>${v ? v + ' nœuds à la voile' : 'jamais (voile seule)'}</option>`).join('')}</select></label>
      </div>
      <button type="button" class="btn" id="rt-go">Calculer la route optimale</button>
      <div id="rt-res" class="rt-res"><p class="muted">Le calcul utilise la prévision de vent heure par heure, le courant et une polaire approchée d'Excess 11. Il passe à au moins un demi-mille environ de la terre, des fonds de moins de 2,5 m et des récifs connus.</p></div>`;
    if (derniere && derniere.leg === l) afficher(derniere);
    else effacer();
  }
  function effacer() { if (calque) { calque.remove(); calque = null; } derniere = null; }

  async function lancer() {
    if (enCours) return;
    const nav = N(), l = nav.plan[nav.legSel];
    if (!l || !l.mer || !nav.map) return;
    enCours = true;
    const res = $('#rt-res'), go = $('#rt-go');
    go.disabled = true; res.innerHTML = '<div class="barre"><i style="width:0"></i></div><p class="muted" id="rt-prog">Calcul en cours…</p>';
    await chargeMasque;
    const pts = l.pts;
    // départ et arrivée en eau libre : on garde les approches tracées à la main
    let i0 = pts.findIndex(p => !bloque(p[0], p[1])), j0 = pts.length - 1;
    while (j0 > 0 && bloque(pts[j0][0], pts[j0][1])) j0--;
    if (i0 < 0 || i0 >= j0) { i0 = 0; j0 = pts.length - 1; }
    const debut = pts.slice(0, i0 + 1), fin = pts.slice(j0);
    const app = p => p.length > 1 ? nav.longueur(p) : 0;
    const depart = new Date(l.depart.getTime() + app(debut) / 5 * 3600e3); // sortie au moteur à 5 nœuds
    const t1 = performance.now();
    const r = await calculer(pts[i0], pts[j0], depart, prefs, (f, n) => {
      const b = $('#rt-res .barre i'); if (b) b.style.width = Math.round(f * 100) + '%';
      const pr = $('#rt-prog'); if (pr) pr.textContent = `Calcul en cours… ${n} routes explorées`;
    });
    enCours = false; go.disabled = false;
    if (!r.arrivee) {
      res.innerHTML = `<p class="alerte">${r.bloque ? 'Pas de passage trouvé en eau libre entre le départ et l\'arrivée.' : 'Arrivée non atteinte en 36 heures avec ce vent : la route tracée au moteur reste la solution.'}</p>`;
      return;
    }
    // reconstitution du chemin
    const chemin = [];
    for (let n = r.arrivee; n; n = n.parent) chemin.unshift(n);
    const tFin = r.arrivee.t + app(fin) / 5 * 3600e3;
    const tracee = simulerTracee(pts, l.depart, prefs);
    derniere = { leg: l, chemin, debut, fin, isos: r.isos, depart: l.depart, arrivee: new Date(tFin), tracee, clim: r.etat.clim, ms: Math.round(performance.now() - t1) };
    afficher(derniere);
  }

  function troncons(chemin) {
    const out = [];
    for (let i = 1; i < chemin.length; i++) {
      const n = chemin[i], last = out[out.length - 1];
      const seg = { de: chemin[i - 1], a: n, prem: n, cap: n.capS, twa: n.twa, v: n.v, moteur: n.moteur };
      if (last && Math.abs(angle(seg.cap, last.cap)) < 12 && seg.moteur === last.moteur) { last.a = n; last.n++; last.vSum += n.v; last.twaSum += n.twa; }
      else out.push({ ...seg, n: 1, vSum: n.v, twaSum: n.twa });
    }
    return out;
  }

  function afficher(d) {
    const nav = N(), { jourHeure, heure, deg3, milles } = nav;
    if (calque) calque.remove();
    calque = L.layerGroup().addTo(nav.map);
    d.isos.forEach(iso => L.polyline(iso, { pane: 'route', color: '#cdb8ff', weight: 1, opacity: 0.35, interactive: false }).addTo(calque));
    const ligne = [...d.debut.slice(0, -1), ...d.chemin.map(n => n.p), ...d.fin.slice(1)];
    d.ligne = ligne;
    L.polyline(ligne, { pane: 'route', color: '#1b0f2e', weight: 7, opacity: 0.6, interactive: false }).addTo(calque);
    L.polyline(ligne, { pane: 'route', color: '#b388ff', weight: 3.5 }).bindTooltip('Route optimale calculée', { sticky: true }).addTo(calque);
    const tr = troncons(d.chemin);
    let virements = 0, empannages = 0, hMoteur = 0;
    tr.forEach((s, i) => {
      if (s.moteur) hMoteur += s.n * DT;
      if (i === 0) return;
      const p = tr[i - 1];
      if (s.moteur || p.moteur) return;
      // changement d'amure : le vent passe de l'autre côté
      const ca = angle(p.cap, p.a.twd), cb = angle(s.cap, s.prem.twd);
      if (Math.sign(ca) !== Math.sign(cb)) {
        const type = (s.twaSum / s.n + p.twaSum / p.n) / 2 < 90 ? 'virement' : 'empannage';
        type === 'virement' ? virements++ : empannages++;
        L.circleMarker(s.de.p, { pane: 'route', radius: 5, color: '#1b0f2e', weight: 1.5, fillColor: '#ffd166', fillOpacity: 1 })
          .bindTooltip(`${type === 'virement' ? 'Virement' : 'Empannage'} vers ${heure(new Date(s.de.t))}`).addTo(calque);
      }
    });
    const dur = (d.arrivee - d.depart) / 3600e3, durT = (d.tracee - d.depart) / 3600e3;
    const dist = nav.longueur(ligne);
    const fin = ligne[ligne.length - 1], s = nav.soleil(new Date(d.arrivee.getTime() - 4 * 3600e3), fin[0], fin[1]);
    const nuit = d.arrivee < s.lever || d.arrivee > s.coucher;
    const gain = durT - dur;
    $('#rt-res').innerHTML = `
      ${d.clim ? '<p class="alerte">Prévision pas encore disponible pour tout ou partie de cette étape : calcul fait avec l\'alizé moyen de fin novembre (16 nœuds de l\'ENE). Recalcule dans les jours qui précèdent.</p>' : ''}
      <p>Durée <b>${virg(dur)} h</b> pour ${virg(dist)} milles, arrivée <b>${jourHeure(d.arrivee)}</b>${nuit ? ' <span class="alerte-i">de nuit</span>' : ''}.</p>
      <p class="muted">Route tracée à la main, au moteur quand il faut remonter : ${virg(durT)} h. ${gain > 0.2 ? `Gain : ${virg(gain)} h.` : gain < -0.2 ? 'La route tracée est aussi bonne ici.' : 'Écart négligeable.'}</p>
      <p>${virements} virement${virements > 1 ? 's' : ''}, ${empannages} empannage${empannages > 1 ? 's' : ''}${hMoteur > 0 ? `, environ ${virg(hMoteur)} h au moteur` : ', tout à la voile'}.</p>
      <div class="scroll"><table class="rt-t"><thead><tr><th>Heure</th><th>Cap</th><th>Vent</th><th>Allure</th><th>Vit.</th></tr></thead><tbody>
      ${tr.map(s => `<tr><td class="n">${heure(new Date(s.de.t))}</td><td class="n">${deg3(s.cap)}</td><td class="n">${Math.round(s.prem.tws)} nd</td><td>${s.moteur ? 'moteur' : ALLURE(s.twaSum / s.n)} ${s.moteur ? '' : `<small>${Math.round(s.twaSum / s.n)}°</small>`}</td><td class="n">${virg(s.vSum / s.n)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="muted">Calculé en ${virg(d.ms / 1000)} s. Polaire approchée, sans tenir compte de l'état de la mer : prévoir de la marge, surtout au près dans les canaux. <button type="button" class="lien-btn" id="rt-eff">Effacer la route</button></p>`;
  }

  document.addEventListener('nav:etape', () => setTimeout(ui));
  document.addEventListener('change', e => {
    if (e.target.id === 'rt-rend') prefs.rendement = +e.target.value;
    if (e.target.id === 'rt-seuil') { const v = +e.target.value; prefs.moteur = v > 0; prefs.seuil = v || 0; }
  });
  document.addEventListener('click', e => {
    if (e.target.id === 'rt-go') lancer();
    if (e.target.id === 'rt-eff') { effacer(); ui(); }
  });

  window.Routage = {
    get route() { const n = N(); return derniere && derniere.ligne && derniere.leg === n.plan[n.legSel] ? derniere.ligne : null; },
    polaire, bloque, ui
  };
})();
