/* Page « Pêche & faune » : poissons à manger ou à éviter, règles de pêche, animaux dangereux en mer et à terre. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  // note : 1 à 5 (goût) ; cig : risque de ciguatera (0 nul, 1 faible, 2 réel, 3 élevé)
  const POISSONS = [
    { g: 'top', nom: 'Dorade coryphène', aussi: 'mahi-mahi, dorado ; « dorad » en créole', note: 5, cig: 0,
      ou: 'À la traîne au large, souvent sous les sargasses et les objets flottants. Le poisson roi des traversées.',
      cuisine: 'Ceviche citron vert et piment, grillée, en blaff. Chair blanche, ferme et douce.',
      attention: 'Se gâte vite : saigner, vider et mettre au frais tout de suite.' },
    { g: 'top', nom: 'Thazard', aussi: 'wahoo ; « tazar »', note: 5, cig: 0,
      ou: 'Traîne rapide (8 à 12 nœuds) le long des tombants. Mâchoires coupantes : bas de ligne en acier.',
      cuisine: 'En tranches grillées, en carpaccio, en court-bouillon.',
      attention: 'Dents redoutables : ne jamais mettre les doigts dans la gueule, même mort.' },
    { g: 'top', nom: 'Thon jaune', aussi: 'albacore, yellowfin', note: 5, cig: 0,
      ou: 'Chasses d\'oiseaux au large, à la traîne. Plus fréquent côté Atlantique et entre les îles.',
      cuisine: 'Sashimi, tataki, mi-cuit. Le meilleur poisson cru de la croisière.',
      attention: 'Gros spécimens très combatifs : prévoir gants et gaffe.' },
    { g: 'top', nom: 'Thon noir', aussi: 'thon à nageoires noires, blackfin', note: 4, cig: 0,
      ou: 'Le thon le plus courant à la traîne dans les canaux.', cuisine: 'Comme le thon jaune, chair plus foncée.', attention: '' },
    { g: 'top', nom: 'Vivaneau rouge', aussi: 'sarde, red snapper, « vivano »', note: 5, cig: 1,
      ou: 'Pêche de fond par 50 à 150 m, surtout chez les pêcheurs. Excellent à acheter.',
      cuisine: 'Entier au four ou en court-bouillon à la créole.',
      attention: 'Les très gros vivaneaux de récif (« dog snapper », sarde dents-de-chien) peuvent être ciguatériques.' },
    { g: 'top', nom: 'Colas', aussi: 'vivaneau queue jaune, yellowtail snapper', note: 4, cig: 1,
      ou: 'Récifs, à la ligne au crépuscule. Souvent proposé par les pêcheurs.', cuisine: 'Frit entier, grillé.', attention: '' },
    { g: 'top', nom: 'Poisson-lion', aussi: 'rascasse volante, lionfish', note: 5, cig: 0,
      ou: 'Espèce invasive venue du Pacifique : la manger aide le récif. Vendue dans certains restaurants.',
      cuisine: 'Chair blanche très fine, en beignets ou en ceviche.',
      attention: 'Épines venimeuses (dos, ventre, anale) : douleur intense. Couper les épines aux ciseaux avant de le manipuler. Le venin ne passe pas dans la chair.' },
    { g: 'top', nom: 'Langouste', aussi: 'lobster', note: 5, cig: 0,
      ou: 'Proposée par les pêcheurs et au barbecue des Tobago Cays.',
      cuisine: 'Grillée au beurre aillé, en barbecue sur la plage.',
      attention: 'Ne jamais acheter une femelle grainée (œufs orange sous la queue), une petite langouste ou une langouste hors saison : c\'est illégal et c\'est ce qui vide les fonds. À Saint-Vincent, saison fermée du 1er mai au 31 août (à confirmer sur place).' },
    { g: 'top', nom: 'Lambi', aussi: 'strombe géant, conch', note: 4, cig: 0,
      ou: 'Herbiers. En Martinique, pêche fermée du 1er janvier au 30 juin, 3 par jour et par pêcheur de loisir le reste de l\'année, débarqués entiers dans leur coquille.',
      cuisine: 'Fricassée de lambi, colombo, accras. À attendrir longuement.',
      attention: 'Espèce surpêchée : acheter des adultes (coquille à lèvre épaisse et évasée).' },
    { g: 'bon', nom: 'Bonite', aussi: 'thonine, skipjack', note: 3, cig: 0, ou: 'Très courante à la traîne.', cuisine: 'Grillée, en rillettes, en court-bouillon. Saigner tout de suite.', attention: '' },
    { g: 'bon', nom: 'Thazard bâtard', aussi: 'maquereau royal, king mackerel, « kingfish »', note: 4, cig: 2, ou: 'Traîne près des côtes.', cuisine: 'En tranches grillées.', attention: 'Les gros (plus de 10 kg) peuvent porter la ciguatera. Préférer les moyens.' },
    { g: 'bon', nom: 'Coulirou et balaou', aussi: 'bigeye scad, ballyhoo', note: 3, cig: 0, ou: 'Petits poissons de surface pêchés par les locaux, vendus en lot. Servent aussi d\'appât.', cuisine: 'Frits croustillants.', attention: '' },
    { g: 'bon', nom: 'Poisson volant', aussi: 'flying fish', note: 3, cig: 0, ou: 'Souvent tombé sur le pont au matin après la nuit en mer !', cuisine: 'Frit, en sandwich « flying fish » à Bequia et à la Barbade.', attention: '' },
    { g: 'bon', nom: 'Marlin et voilier', aussi: 'marlin bleu, sailfish', note: 3, cig: 0, ou: 'Gros poissons de pêche sportive au large.', cuisine: 'Fumé.', attention: 'À relâcher : poissons magnifiques et menacés, et dangereux à embarquer (rostre).' },
    { g: 'moyen', nom: 'Carangue', aussi: 'jack, « karang »', note: 3, cig: 2, ou: 'Partout, très combative.', cuisine: 'Petite, grillée ou en court-bouillon.', attention: 'Petites carangues (moins de 2 kg) seulement. Les grosses carangues noires et jaunes sont parmi les premières causes de ciguatera aux Antilles.' },
    { g: 'moyen', nom: 'Mérou', aussi: 'vieille, grouper', note: 4, cig: 2, ou: 'Récifs et tombants.', cuisine: 'Excellente chair.', attention: 'Les gros mérous sont à risque de ciguatera et plusieurs espèces sont protégées. Ne pas chasser.' },
    { g: 'moyen', nom: 'Poisson perroquet', aussi: 'parrotfish, « kakatwa »', note: 2, cig: 1, ou: 'Vendu sur les marchés.', cuisine: 'Chair molle, en court-bouillon.', attention: 'Il broute les algues et fabrique le sable blanc des plages : mieux vaut le laisser au récif.' },
    { g: 'moyen', nom: 'Chirurgien', aussi: 'surgeonfish, doctorfish', note: 2, cig: 1, ou: 'Récifs.', cuisine: 'Moyen.', attention: 'Lame coupante de chaque côté de la queue.' },
    { g: 'eviter', nom: 'Barracuda', aussi: 'bécune, « bekin »', note: 3, cig: 3, ou: 'Mord souvent à la traîne près des côtes.', cuisine: '–',
      attention: 'À relâcher, même petit. C\'est le poisson le plus souvent responsable de ciguatera aux Antilles ; il est interdit à la vente en Guadeloupe pour cette raison.' },
    { g: 'eviter', nom: 'Sériole', aussi: 'amberjack, « coronado »', note: 3, cig: 3, ou: 'Tombants et épaves.', cuisine: '–', attention: 'Les grosses sérioles sont très souvent ciguatériques. À relâcher.' },
    { g: 'eviter', nom: 'Murène', aussi: 'moray eel', note: 2, cig: 3, ou: 'Trous du récif.', cuisine: '–', attention: 'Ciguatera fréquente et morsure sérieuse. Ne pas toucher.' },
    { g: 'eviter', nom: 'Poisson-ballon, poisson-coffre', aussi: 'puffer, boxfish, « tété »', note: 0, cig: 3, ou: 'Récifs.', cuisine: '–', attention: 'Toxiques (tétrodotoxine pour les poissons-ballons) : jamais dans l\'assiette.' },
    { g: 'eviter', nom: 'Requins', aussi: '', note: 0, cig: 2, ou: '', cuisine: '–', attention: 'Protégés ou menacés, et à risque de ciguatera. À relâcher en coupant le bas de ligne.' }
  ];
  const GROUPES = [['top', 'Les meilleurs'], ['bon', 'Bons'], ['moyen', 'Avec précaution'], ['eviter', 'À relâcher']];
  const CIG = ['aucun risque connu', 'risque faible', 'risque réel si gros', 'risque élevé'];

  const MER = [
    { nom: 'Oursins diadème', ico: '🦔', ou: 'Partout sur les fonds rocheux et au pied des quais, souvent là où on pose le pied pour sortir de l\'eau.',
      fait: 'Ne pas creuser pour retirer les épines cassées en profondeur. Eau chaude 15 à 30 minutes contre la douleur, désinfecter. Les petites épines violettes se résorbent en quelques jours. Médecin si une articulation est touchée ou si ça s\'infecte.' },
    { nom: 'Poisson-lion, rascasses et poisson-scorpion', ico: '🐟', ou: 'Immobiles et camouflés au récif, sous les surplombs.',
      fait: 'Douleur très vive. Plonger la zone dans l\'eau aussi chaude que supportable (environ 45 °C, sans se brûler) 30 à 90 minutes : la chaleur détruit le venin. Retirer les débris d\'épine, désinfecter. Appeler les secours si malaise, gonflement important ou douleur qui ne cède pas.' },
    { nom: 'Corail de feu', ico: '🪸', ou: 'Corail jaune-brun aux bouts blancs, en lames ou en branches, souvent en eau peu profonde.',
      fait: 'Brûlure en quelques minutes. Rincer à l\'eau de mer (pas d\'eau douce), retirer les fragments avec du ruban adhésif, vinaigre ou eau chaude, crème apaisante. Ne pas gratter.' },
    { nom: 'Physalie (galère portugaise)', ico: '🎈', ou: 'Flotteur bleu violet poussé par l\'alizé, filaments de plusieurs mètres. Échouées sur les plages exposées au vent.',
      fait: 'Sortir de l\'eau, retirer les filaments avec une pince ou un gant, rincer à l\'eau de mer, puis eau chaude. Les secours si gêne respiratoire ou malaise : piqûre parfois grave. Même échouée, elle pique.' },
    { nom: 'Cuboméduses', ico: '🪼', ou: 'Petites méduses transparentes en cloche, parfois en essaims la nuit près des feux de mouillage, quelques jours après la pleine lune.',
      fait: 'Vinaigre sur les traces pendant 30 secondes pour neutraliser les filaments, puis les retirer, puis eau chaude. Éviter de nager la nuit sous la lampe du bateau.' },
    { nom: 'Raie pastenague', ico: '🌊', ou: 'Enfouie dans le sable des plages et des lagons (Tobago Cays, Salt Whistle).',
      fait: 'Avancer en traînant les pieds dans le sable pour la faire fuir. Piqûre : eau chaude, nettoyer, puis médecin (débris de dard, infection).' },
    { nom: 'Murène, barracuda, requins', ico: '🦈', ou: 'Récifs et tombants.',
      fait: 'Pas de danger si on ne les provoque pas : ne pas mettre la main dans les trous, ne pas nourrir les poissons, pas de bijoux brillants dans l\'eau trouble, ne pas nager avec du poisson pêché. Morsure : comprimer, secours.' },
    { nom: 'Vers de feu', ico: '🐛', ou: 'Vers poilus orange sous les pierres et sur le corail.', fait: 'Soies urticantes : ruban adhésif pour les retirer, vinaigre, crème.' },
    { nom: 'Sargasses échouées', ico: '🌿', ou: 'Algues brunes en bancs. En se décomposant sur la côte, elles dégagent du sulfure d\'hydrogène (odeur d\'œuf pourri).',
      fait: 'Ne pas mouiller sous le vent d\'un rivage couvert d\'algues pourrissantes, aérer, s\'éloigner en cas de maux de tête, nausées ou gêne respiratoire. Elles bloquent aussi les prises d\'eau moteur : surveiller la température et l\'eau à l\'échappement.' },
    { nom: 'Soleil et déshydratation', ico: '☀️', ou: 'Partout, surtout en annexe et en snorkeling.',
      fait: 'T-shirt anti-UV pour nager, chapeau, crème minérale respectueuse du récif, 2 à 3 litres d\'eau par jour et par personne. Insolation : ombre, refroidir, faire boire, secours si confusion.' }
  ];
  const TERRE = [
    { nom: 'Trigonocéphale (fer-de-lance)', ico: '🐍', ou: '<b>Martinique et Sainte-Lucie seulement</b> : aucun serpent venimeux à Saint-Vincent ni aux Grenadines. Vit dans les zones de végétation dense, les champs, les ravines, rarement sur les plages. Plus actif la nuit et au crépuscule.',
      fait: 'Prévention : chaussures fermées et pantalon en randonnée, rester sur les sentiers, lampe la nuit, ne pas mettre les mains dans les fourrés. Morsure : <b>appeler le 15</b> immédiatement, mettre la personne au repos et la rassurer, immobiliser le membre, retirer bagues et montre, marquer au stylo le bord du gonflement avec l\'heure. Pas de garrot, pas d\'aspiration, pas d\'incision, pas de glace. Le sérum spécifique (Bothrofav) est au CHU de Martinique et marche d\'autant mieux qu\'il est donné tôt.' },
    { nom: 'Mancenillier', ico: '🍏', ou: 'Arbre de bord de plage aux petites pommes vertes, partout dans les îles. Souvent marqué d\'un anneau rouge ou d\'un panneau, mais pas toujours.',
      fait: 'Ne pas manger le fruit (brûlures graves de la bouche et de la gorge), ne pas s\'abriter dessous quand il pleut (la sève diluée dans l\'eau brûle la peau), ne pas le toucher, ne pas brûler son bois (fumée toxique pour les yeux). Contact : rincer abondamment à l\'eau, ne pas se frotter les yeux, médecin si les yeux sont touchés.' },
    { nom: 'Scolopendre', ico: '🐜', ou: 'Grand mille-pattes brun-rouge, sous les pierres, dans les chaussures, parfois à bord le long des amarres à quai.',
      fait: 'Morsure très douloureuse mais rarement grave. Eau chaude, antalgique, désinfecter. Secouer chaussures et serviettes laissées à terre.' },
    { nom: 'Moustiques', ico: '🦟', ou: 'Dengue, chikungunya et Zika circulent aux Antilles. Plus nombreux au crépuscule, près des mangroves et des eaux douces.',
      fait: 'Répulsif efficace (DEET, icaridine), manches longues le soir, moustiquaires aux hublots, mouiller loin de la mangrove. Fièvre, courbatures, maux de tête : médecin, et pas d\'aspirine ni d\'ibuprofène avant avis (risque hémorragique de la dengue).' },
    { nom: 'Guêpes et pois-gratté', ico: '🐝', ou: 'Nids de guêpes sous les toits et les branches basses ; « pois-gratté » : liane aux gousses velues qui démangent terriblement.',
      fait: 'Antihistaminique si allergie connue (et trousse adaptée). Démangeaisons : rincer, ruban adhésif pour retirer les poils.' },
    { nom: 'Noix de coco qui tombent', ico: '🥥', ou: 'Sous les cocotiers des plages.', fait: 'Ne pas poser la serviette ni l\'annexe juste dessous. Sérieusement.' },
    { nom: 'Chiens errants', ico: '🐕', ou: 'Dans certains villages.', fait: 'Ne pas courir, ne pas les nourrir. Morsure : laver 15 minutes à l\'eau et au savon, puis médecin.' }
  ];

  function etoiles(n) { return n ? '★'.repeat(n) + '<span class="vide">' + '★'.repeat(5 - n) + '</span>' : '<span class="vide">★★★★★</span>'; }

  function rendre() {
    const box = $('#pc-poissons'); if (!box || box.dataset.fait) return;
    box.dataset.fait = '1';
    box.innerHTML = GROUPES.map(([g, titre]) => `
      <h3 class="pc-g pc-${g}">${titre}</h3>
      <div class="pc-grille">${POISSONS.filter(p => p.g === g).map(p => `
        <article class="pc-carte verre">
          <header><h4>${p.nom}</h4><span class="pc-note" aria-label="goût ${p.note} sur 5">${etoiles(p.note)}</span></header>
          ${p.aussi ? `<p class="pc-aussi">${p.aussi}</p>` : ''}
          <p class="pc-cig c${p.cig}">Ciguatera : ${CIG[p.cig]}</p>
          ${p.ou ? `<p>${p.ou}</p>` : ''}
          ${p.cuisine && p.cuisine !== '–' ? `<p><b>En cuisine</b> : ${p.cuisine}</p>` : ''}
          ${p.attention ? `<p class="pc-att">${p.attention}</p>` : ''}
        </article>`).join('')}</div>`).join('');
    const danger = (l, id) => { $(id).innerHTML = l.map(d => `
      <article class="pc-danger verre"><h4><span aria-hidden="true">${d.ico}</span> ${d.nom}</h4><p>${d.ou}</p><p class="pc-fait"><b>Que faire</b> : ${d.fait}</p></article>`).join(''); };
    danger(MER, '#pc-mer'); danger(TERRE, '#pc-terre');
  }
  window.Peche = { visible: rendre };
})();
