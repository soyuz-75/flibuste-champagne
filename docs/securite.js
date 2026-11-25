/* Page « Sécurité » : numéros d'urgence, protocoles en mer, message de détresse, consignes par île. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  // num : ce qu'on compose ; tel : lien tel: (vide = pas de lien)
  const NUMEROS = [
    { zone: 'En mer, partout', items: [
      { nom: 'VHF canal 16', det: 'Détresse et sécurité, veillé par les CROSS et les gardes-côtes. Bouton rouge DSC de la VHF : alerte automatique avec la position.', num: 'VHF 16', tel: '' },
      { nom: 'CROSS Antilles-Guyane', det: 'Sauvetage en mer, Fort-de-France. Coordonne aussi les secours jusqu\'aux Grenadines avec les gardes-côtes de Saint-Vincent. Numéro gratuit depuis un téléphone en Martinique.', num: '196', tel: '196' },
      { nom: 'CROSS AG, ligne directe', det: 'À composer depuis un téléphone étranger ou hors de Martinique.', num: '+596 596 70 92 92', tel: '+596596709292' }
    ] },
    { zone: 'Martinique', items: [
      { nom: 'SAMU (urgence médicale)', det: 'Malaise, blessure grave, morsure de serpent. Peut organiser une téléconsultation et une évacuation.', num: '15', tel: '15' },
      { nom: 'Numéro d\'urgence européen', det: 'Marche depuis n\'importe quel téléphone, même sans crédit.', num: '112', tel: '112' },
      { nom: 'Pompiers', det: '', num: '18', tel: '18' },
      { nom: 'Police, gendarmerie', det: '', num: '17', tel: '17' },
      { nom: 'Pharmacie de garde', det: 'Serveur vocal payant.', num: '3237', tel: '3237' },
      { nom: 'Hôpital du Marin (Sud Caraïbe)', det: 'Urgences 24 h sur 24, boulevard Allègre, à côté de la base.', num: '', tel: '' },
      { nom: 'CHU de Martinique (Fort-de-France)', det: 'Hôpital de référence : sérum antivenimeux, réanimation, caisson hyperbare.', num: '', tel: '' }
    ] },
    { zone: 'Saint-Vincent et les Grenadines', items: [
      { nom: 'Police, pompiers, gardes-côtes', det: 'Numéro d\'urgence national (les deux marchent).', num: '911 ou 999', tel: '911' },
      { nom: 'Gardes-côtes de SVG', det: 'Base à Kingstown (Calliaqua) et antenne à Bequia. En mer, d\'abord VHF 16 ou DSC 70.', num: '+1 784 457 4578', tel: '+17844574578' },
      { nom: 'Assistance médicale Kingstown', det: 'Hôpital Milton Cato, le principal du pays. Numéro donné par le gouvernement canadien, à vérifier sur place.', num: '+1 784 456 1955', tel: '+17844561955' },
      { nom: 'Assistance médicale Bequia', det: 'Hôpital de Port Elizabeth. Numéro donné par le gouvernement canadien, à vérifier sur place.', num: '+1 784 458 3294', tel: '+17844583294' },
      { nom: 'Ambassade de France', det: 'L\'ambassade à Castries (Sainte-Lucie) est compétente pour Saint-Vincent : perte de passeport, accident grave, arrestation.', num: '', tel: '' }
    ] }
  ];

  const MAYDAY = [
    ['MAYDAY, MAYDAY, MAYDAY', 'MAYDAY, MAYDAY, MAYDAY'],
    ['Ici catamaran <i>nom du bateau</i>, <i>nom</i>, <i>nom</i>', 'This is catamaran <i>name</i>, <i>name</i>, <i>name</i>'],
    ['MAYDAY catamaran <i>nom</i>', 'MAYDAY catamaran <i>name</i>'],
    ['Position : <i>lire l\'écran GPS ou le compas de ce site</i>', 'My position is <i>latitude, longitude</i>'],
    ['Nature de la détresse : <i>voie d\'eau, feu, homme à la mer, blessé…</i>', 'I am <i>sinking / on fire / man overboard / injured person</i>'],
    ['Assistance demandée : <i>évacuation, remorquage…</i>', 'I require immediate assistance'],
    ['Nombre de personnes à bord : <i>5</i>', '<i>5</i> persons on board'],
    ['Autres infos : <i>radeau, gilets, couleur de la coque</i>', '<i>Life raft, life jackets, white catamaran</i>'],
    ['À vous', 'Over']
  ];

  const PROTOS = [
    { t: 'Homme à la mer', ico: '🛟', urg: true, etapes: [
      'Crier « Un homme à la mer ! » et désigner une personne qui ne quitte <b>jamais</b> la victime des yeux en la pointant du bras.',
      'Lancer immédiatement la bouée fer à cheval et la perche IOR (la nuit, le feu à retournement).',
      'Appuyer sur la touche MOB du GPS ou du traceur pour marquer la position.',
      'Moteurs en marche, rouler le génois, revenir sous le vent de la victime à petite vitesse. Couper le moteur côté victime au dernier moment (hélices !).',
      'Si elle n\'est pas récupérée en une minute ou si on la perd de vue : MAYDAY sur la VHF 16.',
      'Récupération par l\'arrière du catamaran (jupe et échelle de bain). Ensuite, réchauffer, surveiller.'
    ], prevention: 'La nuit et dès qu\'il y a de la mer : gilet automatique avec lampe, longe accrochée à la ligne de vie, jamais seul sur le pont, on urine assis dans les toilettes et pas par-dessus bord.' },
    { t: 'Incendie à bord', ico: '🔥', urg: true, etapes: [
      'Alerter tout le monde, couper le gaz à la bouteille et le coupe-batterie si c\'est électrique.',
      'Extincteur à la base des flammes, couverture anti-feu sur la plaque de cuisson. Jamais d\'eau sur de l\'huile ou de l\'électrique.',
      'Feu moteur : couper le moteur, ne pas ouvrir la trappe en grand, injecter l\'extincteur par une petite ouverture.',
      'Si le feu n\'est pas maîtrisé en deux minutes : MAYDAY, gilets, préparer le radeau et le sac de survie, se mettre au vent du feu.'
    ], prevention: 'Repérer les extincteurs et la couverture anti-feu le premier jour. Fermer le gaz après chaque repas.' },
    { t: 'Voie d\'eau', ico: '💧', urg: true, etapes: [
      'Trouver l\'origine : vanne, presse-étoupe, passe-coque, tuyau, choc. Goûter l\'eau : salée ou douce (réservoir) ?',
      'Mettre les pompes de cale en route, électriques et manuelles.',
      'Boucher : pinoches en bois coniques (une à chaque vanne), coussin, voile, ruban adhésif réparateur.',
      'Si l\'eau monte malgré tout : PAN PAN ou MAYDAY selon la vitesse, gilets, radeau prêt. Un catamaran coule très rarement : rester à bord le plus longtemps possible.'
    ], prevention: 'Ouvrir les cales des deux coques chaque matin. Savoir où sont les vannes et les pinoches.' },
    { t: 'Blessé grave, malaise', ico: '🩺', urg: true, etapes: [
      'Mettre la victime à l\'abri, au calme, en sécurité. Bilan : conscience, respiration, saignement.',
      'Appeler : en mer, VHF 16 ou 196, le CROSS met en relation avec le médecin du centre de consultation médicale maritime (CCMM). À terre en Martinique, le 15 ; à Saint-Vincent, le 911.',
      'Préparer : âge, symptômes, heure de début, traitements, allergies, position et distance du port.',
      'Saignement : comprimer fort. Inconscient qui respire : position latérale de sécurité. Ne respire pas : massage cardiaque, 30 compressions puis 2 insufflations.'
    ], prevention: 'Faire l\'inventaire de la trousse de secours de la base avant de partir, et emporter ses propres médicaments en double.' },
    { t: 'Grain la nuit', ico: '🌧️', urg: false, etapes: [
      'Un grain arrive comme un nuage noir qui masque les étoiles, avec une rafale fraîche juste devant la pluie : 25 à 35 nœuds pendant 10 à 20 minutes.',
      'Réduire <b>avant</b> : prendre un ris dès le coucher du soleil, génois partiellement roulé.',
      'Dans le grain : laisser filer l\'écoute de grand-voile, abattre pour soulager, moteur prêt.',
      'Tout le monde dans le cockpit, attaché. Après : vérifier le gréement et les écoutes.'
    ], prevention: 'Sur un catamaran, on ne dessale pas mais on peut chavirer : on réduit tôt, on ne bloque jamais l\'écoute de grand-voile au taquet en navigation de nuit.' },
    { t: 'Panne moteur dans un canal', ico: '⚙️', urg: false, etapes: [
      'Le second moteur suffit : un catamaran manœuvre sur un seul moteur, plus lentement.',
      'Sans moteur : établir les voiles, s\'éloigner de la côte sous le vent, ne pas se laisser drosser.',
      'Vérifier : filtre à gasoil, prise d\'eau de mer (sargasses !), turbine, bout pris dans l\'hélice.',
      'Près d\'une côte et en dérive : mouiller si le fond le permet (moins de 25 m), puis PAN PAN sur la 16.'
    ], prevention: 'Surveiller l\'eau qui sort à l\'échappement à chaque démarrage, surtout dans les sargasses.' },
    { t: 'Échouage sur un récif', ico: '🪨', urg: false, etapes: [
      'Moteurs au point mort, vérifier que personne n\'est blessé et qu\'il n\'y a pas de voie d\'eau.',
      'Ne pas forcer en marche avant sur le corail. Essayer de reculer doucement par le chemin d\'arrivée.',
      'Alléger, faire gîter le bateau en déplaçant l\'équipage, porter une ancre au large avec l\'annexe.',
      'Bloqué : PAN PAN, prévenir la base Star Voyage, puis les autorités du parc s\'il s\'agit d\'un récif protégé.'
    ], prevention: 'Lire l\'eau avec le soleil dans le dos : bleu foncé profond, turquoise 3 à 6 m, vert clair ou marron = corail. Pas d\'arrivée au mouillage après 16 h dans les récifs.' },
    { t: 'Abandon du navire', ico: '🚣', urg: true, etapes: [
      'Seulement en dernier recours, quand le bateau est vraiment perdu : on monte dans le radeau, on n\'y descend pas.',
      'MAYDAY avant de partir, déclencher la balise de détresse (EPIRB) si le bateau en a une.',
      'Gilets sur tout le monde, vêtements chauds, sac de survie, eau, VHF portable.',
      'Rester attaché au bateau tant qu\'il flotte. Garder le groupe ensemble.'
    ], prevention: 'Le sac de survie, prêt et à portée du cockpit : VHF portable, lampe, fusées, eau, médicaments, copies des papiers, téléphone dans une pochette étanche.' }
  ];

  const ILES = [
    { ile: 'Martinique', pts: [
      'Santé et secours comme en France : 15, 112, carte Vitale acceptée.',
      'Trigonocéphale en randonnée (pas dans les villes ni sur les plages) : chaussures fermées, rester sur les sentiers.',
      'Mancenilliers en bord de plage, notamment aux Anses d\'Arlet et à Sainte-Anne.',
      'Pollution au chlordécone : pêche interdite dans plusieurs baies, dont la baie de Fort-de-France. Ne pas manger le poisson pêché là.',
      'Vols d\'annexes et de moteurs hors-bord : cadenasser l\'annexe au quai et la remonter la nuit.',
      'Baignade : attention aux annexes et jet-skis dans les mouillages, bouée de signalisation pour nager loin du bateau.'
    ] },
    { ile: 'Sainte-Lucie (pas d\'escale)', pts: [
      'On longe l\'île de nuit sans s\'arrêter : rester à plus de 2 milles de la côte, attention aux pêcheurs sans feux.',
      'En cas de problème grave : Rodney Bay ou Marigot Bay sont les abris de secours (fiches dans l\'onglet Ancres de la carte). Il faut alors faire l\'entrée en douane.',
      'Urgences : 911 ou 999, VHF 16.'
    ] },
    { ile: 'Saint-Vincent', pts: [
      'Entrée en douane à Wallilabou : y aller directement, pavillon Q hissé, passeports de tout l\'équipage.',
      'Boat boys : à l\'arrivée, plusieurs barques proposent de prendre l\'amarre à terre. En choisir un seul, convenir du prix avant, payer à la fin.',
      'Des vols et agressions sur des voiliers ont été signalés par le passé sur la côte sous le vent : ne pas laisser le bateau sans personne la nuit, fermer les descentes, annexe remontée et cadenassée.',
      'Volcan de la Soufrière : randonnée longue et engagée, partir tôt avec un guide.',
      'Pas de serpent venimeux à Saint-Vincent et aux Grenadines.'
    ] },
    { ile: 'Bequia', pts: [
      'Île sûre et accueillante. Vols d\'annexes possibles au ponton de Port Elizabeth : cadenas.',
      'Admiralty Bay très fréquentée : attention aux bateaux-taxis et aux annexes la nuit.',
      'Hôpital à Port Elizabeth, antenne des gardes-côtes sur l\'île.'
    ] },
    { ile: 'Mustique', pts: [
      'Île privée, très surveillée. Bouées obligatoires à Britannia Bay (payantes), pas d\'ancre.',
      'Pêche et chasse sous-marine interdites dans les eaux de Mustique.',
      'Clinique sur l\'île ; évacuation sanitaire par avion vers Saint-Vincent ou la Martinique.'
    ] },
    { ile: 'Canouan', pts: [
      'Grand récif barrière sur la côte au vent : ne pas s\'en approcher.',
      'Mouillage de Charlestown rouleur par houle de nord.'
    ] },
    { ile: 'Tobago Cays', pts: [
      'Parc marin : bouées ou mouillage dans les zones autorisées seulement, droit d\'entrée payé aux rangers. Ancre interdite à Petit Tabac.',
      'Pêche interdite dans tout le parc (amende jusqu\'à 10 000 dollars EC et prison).',
      'Fort courant entre les îlots : nager avec palmes, ne pas s\'éloigner seul, bouée de signalisation. Les kitesurfeurs passent vite dans le lagon.',
      'Rangers sur VHF 16 et 68 : ils peuvent aider en cas de problème.'
    ] },
    { ile: 'Mayreau et Union', pts: [
      'Très touchées par l\'ouragan Beryl en juillet 2024 : services, eau, carburant et soins peuvent être limités. Partir avec les réserves pleines.',
      'Entrée du port de Clifton entre les récifs : de jour seulement, en suivant les balises.',
      'Sortie de douane de Saint-Vincent à Clifton (Union) avant de rentrer.'
    ] }
  ];

  const REGLES = [
    ['Avant chaque navigation', 'Météo du jour et de la nuit, briefing sécurité au nouvel arrivant (gilets, extincteurs, vannes, VHF, MOB), cales sèches, niveaux moteur, réservoirs.'],
    ['La nuit', 'Quarts à deux, gilets et longes obligatoires hors du carré, feux de navigation vérifiés, un ris pris au coucher du soleil, réveiller le skipper au moindre doute. Personne ne va à l\'avant seul.'],
    ['Feux et route', 'Rouge à bâbord, vert à tribord, blanc derrière. Un navire montre ses deux feux de côté = il vient droit sur nous. Les cargos vont à 15-20 nœuds : s\'écarter tôt et franchement.'],
    ['Annexe', 'Coupe-circuit au poignet, feu ou lampe la nuit, pas de vitesse dans les mouillages, gilets pour les trajets de nuit. Pas d\'alcool au volant de l\'annexe.'],
    ['Baignade', 'Moteurs coupés, échelle descendue, quelqu\'un à bord, jamais seul en snorkeling, bouée de signalisation dans les zones d\'annexes. Pas de baignade la nuit.'],
    ['Mouillage', 'Bien tenir l\'ancre (test de prise, alarme de mouillage dans l\'onglet Outils de la carte), relever les mouillages voisins, prévoir de partir si le vent tourne.'],
    ['Eau et soleil', 'Deux à trois litres d\'eau par personne et par jour, crème, chapeau, lunettes. La réverbération brûle même à l\'ombre du bimini.']
  ];

  function rendre() {
    const box = $('#sc-numeros'); if (!box || box.dataset.fait) return;
    box.dataset.fait = '1';
    box.innerHTML = NUMEROS.map(z => `<div class="sc-zone"><h3>${z.zone}</h3><div class="sc-nums">${z.items.map(n => `
      <div class="sc-num verre"><div><b>${n.nom}</b>${n.det ? `<small>${n.det}</small>` : ''}</div>
        ${n.num ? (n.tel ? `<a class="sc-appel" href="tel:${n.tel}">${n.num}</a>` : `<span class="sc-appel sans">${n.num}</span>`) : ''}</div>`).join('')}</div></div>`).join('');
    $('#sc-mayday').innerHTML = `<table class="sc-md"><thead><tr><th>En français</th><th>In English</th></tr></thead><tbody>${MAYDAY.map(([f, e]) => `<tr><td>${f}</td><td>${e}</td></tr>`).join('')}</tbody></table>
      <p class="muted">PAN PAN (même forme, « PAN PAN » ×3) pour une urgence sans danger immédiat : panne, blessé léger, avarie. SÉCURITÉ (« Sécurité » ×3) pour avertir les autres d'un danger : objet flottant, bouée dérivante. Lâcher le bouton après « À vous » et écouter.</p>`;
    $('#sc-protos').innerHTML = PROTOS.map(p => `
      <details class="sc-proto verre${p.urg ? ' urg' : ''}"><summary><span aria-hidden="true">${p.ico}</span> ${p.t}</summary>
        <ol>${p.etapes.map(e => `<li>${e}</li>`).join('')}</ol>
        <p class="sc-prev"><b>Pour l'éviter</b> : ${p.prevention}</p></details>`).join('');
    $('#sc-iles').innerHTML = ILES.map(i => `<div class="sc-ile verre"><h3>${i.ile}</h3><ul>${i.pts.map(p => `<li>${p}</li>`).join('')}</ul></div>`).join('');
    $('#sc-regles').innerHTML = REGLES.map(([t, d]) => `<div class="sc-regle"><b>${t}</b><p>${d}</p></div>`).join('');
  }
  window.Securite = { visible: rendre };
})();
