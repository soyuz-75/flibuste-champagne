/* Vue « La Météo » : prévisions Open-Meteo sur 16 jours pour chaque escale et les canaux traversés. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const TZ = 'America/Martinique';
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const virg = (x, n = 1) => x.toFixed(n).replace('.', ',');
  const cardinal = d => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'][Math.round(((d % 360) + 360) % 360 / 22.5) % 16];

  // lieux : point météo (au mouillage), point marin (un peu au large, là où le modèle de vagues a des données)
  const LIEUX = [
    { id: 'marin', nom: 'Le Marin', ile: 'Martinique', ll: [14.463, -60.872], mer: [14.40, -60.88], m: 'marin' },
    { id: 'arl', nom: "Grande Anse d'Arlet", ile: 'Martinique', ll: [14.502, -61.087], mer: [14.50, -61.11], m: 'grandeanse' },
    { id: 'stp', nom: 'Saint-Pierre', ile: 'Martinique', ll: [14.742, -61.18], mer: [14.74, -61.20], m: 'stpierre' },
    { id: 'mit', nom: 'Anse Mitan, Trois-Îlets', ile: 'Martinique', ll: [14.556, -61.056], mer: [14.56, -61.08], m: 'mitan' },
    { id: 'wall', nom: 'Wallilabou', ile: 'Saint-Vincent', ll: [13.25, -61.276], mer: [13.25, -61.30], m: 'wallilabou' },
    { id: 'beq', nom: 'Admiralty Bay, Bequia', ile: 'Grenadines', ll: [13.008, -61.243], mer: [13.00, -61.27], m: 'admiralty' },
    { id: 'mus', nom: 'Britannia Bay, Mustique', ile: 'Grenadines', ll: [12.88, -61.193], mer: [12.88, -61.215], m: 'mustique' },
    { id: 'tob', nom: 'Tobago Cays', ile: 'Grenadines', ll: [12.632, -61.356], mer: [12.63, -61.34], m: 'tobago' },
    { id: 'canalSL', nom: 'Canal de Sainte-Lucie', ile: 'Traversée', ll: [14.25, -61.0], mer: [14.25, -61.0], canal: true },
    { id: 'canalSV', nom: 'Canal de Saint-Vincent', ile: 'Traversée', ll: [13.55, -61.2], mer: [13.55, -61.2], canal: true }
  ];
  const LIEU = Object.fromEntries(LIEUX.map(l => [l.id, l]));
  // lieu de la nuit d'après la colonne « Nuit » des plans
  function lieuNuit(txt) {
    const t = txt.toLowerCase();
    if (t.includes('en mer')) return 'mer';
    if (t.includes('hôtel')) return 'hotel';
    for (const [k, id] of [['wallilabou', 'wall'], ['bequia', 'beq'], ['mustique', 'mus'], ['tobago', 'tob'], ['arlet', 'arl'], ['saint-pierre', 'stp'], ['mitan', 'mit'], ['marin', 'marin']])
      if (t.includes(k)) return id;
    return null;
  }

  const CIEL = c => c == null ? ['', ''] : c === 0 ? ['☀', 'Ciel clair'] : c <= 2 ? ['⛅', 'Éclaircies'] : c === 3 ? ['☁', 'Couvert'] : c <= 48 ? ['🌫', 'Brume'] :
    c <= 57 ? ['🌦', 'Bruine'] : c <= 67 ? ['🌧', 'Pluie'] : c <= 82 ? ['🌦', 'Averses'] : ['⛈', 'Orage'];

  let D = null, mouillages = {}, charge = false, enCours = false;

  async function charger() {
    if (enCours) return;
    enCours = true;
    $('#mt-etat').textContent = 'Chargement des prévisions…';
    const ll = LIEUX.map(l => l.ll), mm = LIEUX.map(l => l.mer);
    const qf = `latitude=${ll.map(x => x[0]).join(',')}&longitude=${ll.map(x => x[1]).join(',')}&timezone=${encodeURIComponent(TZ)}&forecast_days=16&wind_speed_unit=kn`;
    const qm = `latitude=${mm.map(x => x[0]).join(',')}&longitude=${mm.map(x => x[1]).join(',')}&timezone=${encodeURIComponent(TZ)}&forecast_days=16`;
    try {
      const [f, m, mo] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?${qf}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch(`https://marine-api.open-meteo.com/v1/marine?${qm}&daily=wave_height_max,wave_direction_dominant,wave_period_max&hourly=wave_height,wave_direction,sea_surface_temperature`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('data/mouillages.json').then(r => r.json()).catch(() => null)
      ]);
      D = { f, m, maj: Date.now() };
      try { localStorage.setItem('fc-meteo-escales', JSON.stringify(D)); } catch (e) { }
      if (mo) mouillages = Object.fromEntries(mo.mouillages.map(x => [x.id, x]));
      $('#mt-etat').innerHTML = `Prévisions chargées à ${new Date(D.maj).toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })} (heure de Martinique). <button type="button" class="lien-btn" id="mt-maj">Actualiser</button>`;
    } catch (e) {
      try { D = JSON.parse(localStorage.getItem('fc-meteo-escales') || 'null'); } catch (e2) { D = null; }
      if (!Object.keys(mouillages).length) { try { const mo = await fetch('data/mouillages.json').then(r => r.json()); mouillages = Object.fromEntries(mo.mouillages.map(x => [x.id, x])); } catch (e3) { } }
      $('#mt-etat').innerHTML = D ? `Hors ligne : prévisions du ${new Date(D.maj).toLocaleString('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. <button type="button" class="lien-btn" id="mt-maj">Réessayer</button>`
        : 'Prévisions indisponibles (pas de réseau ?). <button type="button" class="lien-btn" id="mt-maj">Réessayer</button>';
    }
    enCours = false; charge = true;
    dessiner();
  }

  /* accès aux données */
  const idx = id => LIEUX.findIndex(l => l.id === id);
  function jour(id, date) { // date 'AAAA-MM-JJ'
    const k = idx(id), f = D.f[k], m = D.m && D.m[k];
    const i = f.daily.time.indexOf(date);
    if (i < 0) return null;
    const md = m && m.daily, j = md ? md.time.indexOf(date) : -1;
    const sst = m && m.hourly && m.hourly.sea_surface_temperature ? m.hourly.sea_surface_temperature[m.hourly.time.indexOf(date + 'T14:00')] : null;
    return {
      code: f.daily.weather_code[i], tmax: f.daily.temperature_2m_max[i], tmin: f.daily.temperature_2m_min[i],
      pluie: f.daily.precipitation_sum[i], proba: f.daily.precipitation_probability_max[i],
      vent: f.daily.wind_speed_10m_max[i], raf: f.daily.wind_gusts_10m_max[i], vdir: f.daily.wind_direction_10m_dominant[i],
      uv: f.daily.uv_index_max[i], lever: f.daily.sunrise[i], coucher: f.daily.sunset[i],
      houle: j >= 0 ? md.wave_height_max[j] : null, hdir: j >= 0 ? md.wave_direction_dominant[j] : null, per: j >= 0 ? md.wave_period_max[j] : null,
      sst, rang: i
    };
  }
  function heureH(id, date, h) { // conditions à une heure donnée
    const k = idx(id), f = D.f[k], m = D.m && D.m[k], key = `${date}T${String(h).padStart(2, '0')}:00`;
    const i = f.hourly.time.indexOf(key);
    if (i < 0) return null;
    const j = m && m.hourly ? m.hourly.time.indexOf(key) : -1;
    return { vit: f.hourly.wind_speed_10m[i], vdir: f.hourly.wind_direction_10m[i], raf: f.hourly.wind_gusts_10m[i],
      houle: j >= 0 && m.hourly.wave_height[j] != null ? m.hourly.wave_height[j] : 0, hdir: j >= 0 ? m.hourly.wave_direction[j] : null };
  }
  function abri(lieu, date) {
    const L0 = LIEU[lieu]; if (!L0 || !L0.m || !window.Nav || !mouillages[L0.m]) return null;
    const c = heureH(lieu, date, 22);
    if (!c || c.vit == null) return null;
    return window.Nav.abri(mouillages[L0.m], c);
  }

  /* programme du plan choisi */
  const iso = d => d.toISOString().slice(0, 10);
  function programme() {
    const pl = PLANS[cur], jours = [];
    const j0 = new Date(Date.UTC(2026, 10, 27));
    jours.push({ date: iso(j0), lib: 'Arrivée, Le Marin', nuit: 'marin', note: 'Vol AF, arrivée 13 h 40. Nuit à bord au ponton.' });
    pl.legs.forEach((l, i) => {
      const d = new Date(Date.UTC(2026, 10, 28 + i));
      const nuit = lieuNuit(l[6]);
      const canaux = nuit === 'mer' ? (l[2] === 'wm' ? ['canalSV', 'canalSL'] : ['canalSL', 'canalSV']) : [];
      jours.push({ date: iso(d), lib: l[1], nuit: nuit === 'hotel' ? 'mit' : nuit, hotel: nuit === 'hotel', mer: nuit === 'mer', canaux, milles: l[3] });
    });
    jours.push({ date: '2026-12-06', lib: 'Hôtel en Martinique', nuit: 'mit', hotel: true, note: 'Hôtel pas encore choisi : prévision des Trois-Îlets.' });
    jours.push({ date: '2026-12-07', lib: 'Vol retour 20 h 35', nuit: null, note: 'Journée libre, aéroport vers 17 h 30.' });
    return jours;
  }

  function cellVent(j) {
    if (!j) return '<td colspan="4" class="muted">Pas encore de prévision</td>';
    const [ic, txt] = CIEL(j.code);
    return `<td><span class="ciel" title="${txt}" aria-label="${txt}">${ic}</span></td>
      <td class="n"><b>${Math.round(j.vent)}</b>–${Math.round(j.raf)} nd <small>${cardinal(j.vdir)}</small></td>
      <td class="n">${j.houle != null ? `${virg(j.houle)} m <small>${cardinal(j.hdir)}${j.per ? ' · ' + Math.round(j.per) + ' s' : ''}</small>` : '–'}</td>
      <td class="n">${j.pluie != null ? `${virg(j.pluie)} mm <small>${j.proba != null ? j.proba + ' %' : ''}</small>` : '–'}</td>`;
  }

  function dessiner() {
    if (!charge) return;
    $('#mt-plans').innerHTML = Object.entries(PLANS).map(([k, p]) => `<button type="button" data-p="${k}" class="${k === cur ? 'on' : ''}" aria-pressed="${k === cur}">Plan ${k}<small>${esc(p.nom)}</small></button>`).join('');
    if (!D) { $('#mt-prog').innerHTML = ''; $('#mt-lieux').innerHTML = ''; return; }
    const auj = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
    const prog = programme();
    const fmt = d => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    let rows = `<thead><tr><th>Jour</th><th>Programme et nuit</th><th>Ciel</th><th>Vent max</th><th>Houle</th><th>Pluie</th><th>Abri de nuit</th></tr></thead><tbody>`;
    for (const p of prog) {
      const lieu = p.mer ? p.canaux[0] : p.nuit || 'marin';
      const j = jour(lieu, p.date);
      const tend = j && j.rang > 7 ? '<span class="tend">tendance</span>' : '';
      let ab = '';
      if (p.mer) {
        const pire = p.canaux.map(c => { const n = heureH(c, p.date, 22), jj = jour(c, p.date); return { c, n, jj }; });
        const alerte = pire.some(x => x.jj && (x.jj.raf > 25 || (x.jj.houle || 0) > 2.5));
        ab = `<span class="chip ${alerte ? 'mauvais' : 'bon'}">${alerte ? 'Canal agité' : 'Traversée maniable'}</span>`;
      } else if (p.hotel) ab = '<span class="muted">à terre</span>';
      else if (p.nuit) {
        const a = abri(p.nuit, p.date);
        ab = a ? `<span class="chip ${a.cls}">${a.txt}</span>` : '<span class="muted">–</span>';
      }
      const nom = p.mer ? `En mer : ${p.canaux.map(c => LIEU[c].nom.replace('Canal de ', 'canal de ')).join(', puis ')}` : p.nuit ? `Nuit : ${LIEU[p.nuit].nom}${p.hotel ? ' (hôtel)' : ''}` : '';
      rows += `<tr class="${p.mer ? 'mer' : ''} ${p.date < auj ? 'passe' : ''}"><td class="jour">${fmt(p.date)}${tend}</td>
        <td><div class="lieu">${esc(p.lib)}</div><small class="muted">${esc(nom)}${p.note ? ' · ' + esc(p.note) : ''}</small></td>
        ${cellVent(j)}<td>${ab}</td></tr>`;
    }
    $('#mt-prog').innerHTML = rows + '</tbody>';

    // fiches par lieu
    const sejours = {};
    prog.forEach(p => { if (p.mer) p.canaux.forEach(c => (sejours[c] = sejours[c] || new Set()).add(p.date)); else if (p.nuit) (sejours[p.nuit] = sejours[p.nuit] || new Set()).add(p.date); });
    const ordre = LIEUX.filter(l => sejours[l.id]).concat(LIEUX.filter(l => !sejours[l.id]));
    $('#mt-lieux').innerHTML = ordre.map(l => {
      const k = idx(l.id), f = D.f[k];
      const j1 = jour(l.id, f.daily.time[0]);
      const sst = j1 && j1.sst != null ? ` · eau ${Math.round(j1.sst)} °C` : '';
      const s = sejours[l.id];
      return `<article class="mt-carte"><h3>${esc(l.nom)}</h3>
        <p class="sous">${esc(l.ile)}${s ? ` · ${l.canal ? 'traversée' : 'escale'} le ${[...s].map(fmt).join(', ')}` : ' · pas au programme de ce plan'}${sst}${j1 ? ` · soleil ${j1.lever.slice(11)}–${j1.coucher.slice(11)}` : ''}</p>
        <div class="bande">${f.daily.time.map((d, i) => {
          const j = jour(l.id, d), [ic, txt] = CIEL(j.code);
          return `<div class="jr ${s && s.has(d) ? 'sejour' : ''} ${i > 7 ? 'tendance' : ''}" title="${txt}${i > 7 ? ', tendance' : ''}">
            <span class="d">${fmt(d)}</span><span class="ciel" aria-label="${txt}">${ic}</span>
            <span class="v">${Math.round(j.vent)}–${Math.round(j.raf)} nd</span><span class="p">${cardinal(j.vdir)}</span>
            <span class="h">${j.houle != null ? virg(j.houle) + ' m' : '–'}</span>
            <span class="p">${j.pluie ? virg(j.pluie) + ' mm' : 'sec'} · ${Math.round(j.tmax)}°</span></div>`;
        }).join('')}</div></article>`;
    }).join('');
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('#mt-plans button'); if (b) { choisirPlan(b.dataset.p); return; }
    if (e.target.id === 'mt-maj') charger();
  });
  document.addEventListener('nav:plan', dessiner);

  window.MeteoEscales = {
    visible() { if (!charge && !enCours) charger(); else dessiner(); }
  };
})();
