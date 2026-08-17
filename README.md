# La Quête des Trois Étoiles

Action-RPG 2D original, pensé pour le mobile, dans l'esprit des grands RPG
d'action 16 bits des années 90.

**CHEVALIER SEUL → RENCONTRE PRINCESSE → GROUPE À 2 → RENCONTRE MAGICIEN →
GROUPE À 3 → CHÂTEAU → TRÉSOR → ESPACE → ÉTOILE MAGIQUE.**

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173 (ouvrez-le depuis votre téléphone
                 # sur le même Wi-Fi : l'adresse réseau est affichée)
npm run build    # build de production dans dist/
npm run preview  # sert le build
npm test         # build + tests headless (Chromium)
```

Le jeu se joue en **paysage**. Sur téléphone : joystick flottant à gauche,
boutons **A** (attaque, maintenir = attaque chargée), **B** (esquive),
**M** (magie) et **E** (interaction) à droite. Au clavier :
flèches/ZQSD, `Espace` attaque, `Maj` esquive, `F` magie, `E` interaction,
`Échap` pause, `I` inventaire.

## Ce qui est jouable

| | |
|---|---|
| **Monde 1 — La Forêt Magique** | 5 zones : clairière d'apprentissage, forêt profonde et sa rivière, clairière de la rencontre avec Lyra, marais empoisonnés, sanctuaire de l'Arbre Magique |
| **Monde 2 — Le Château Maudit** | entrée, geôles (clé + porte verrouillée), grande salle où Orin rejoint le groupe, donjon inférieur, salle du trésor et son Gardien de pierre |
| **Monde 3 — Le Monde des Étoiles** | plateformes de verre translucide reliées par des passerelles, téléporteurs, trous noirs, et le Dévoreur d'étoiles qui garde l'Étoile Magique |

Systèmes : combat temps réel (attaque, attaque chargée, esquive avec
invincibilité, sorts), compagnons IA en file indienne, progression XP/niveaux
pour les trois héros, objets et coffres, quêtes à étapes, dialogues, courtes
cinématiques, sauvegarde locale sur 3 emplacements, HUD et menus rétro,
musique et bruitages chiptune générés à la volée.

## Les héros

| | Rôle | Compétences |
|---|---|---|
| **Chevalier Noir** | seul personnage contrôlé | attaque rapide, attaque chargée, esquive, tourbillon, onde de choc |
| **Princesse Lyra** | compagnon IA (monde 1) | soin, protection, éclat de lumière à distance |
| **Magicien Orin** | compagnon IA (monde 2) | trait de feu, nova de givre, météore |

Les compagnons suivent le chevalier en file indienne sur sa propre trace,
combattent seuls, se replient quand ils sont blessés et prennent leurs
distances face aux attaques chargées des boss.

## Monstres

**Plante venimeuse** (enracinée, fouet de tentacules et crachat toxique),
**Boule de poil** (aucun œil, aucun nez, aucune oreille : une énorme bouche —
elle charge, mord, recule), **Trou noir** (rotation permanente, aspire héros,
objets et projectiles, puis relâche l'énergie accumulée).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — organisation du code, boucle de jeu, systèmes
- [`docs/ASSETS.md`](docs/ASSETS.md) — pipeline graphique et remplacement par de vraies sprite sheets
- [`docs/BALANCING.md`](docs/BALANCING.md) — où régler l'équilibrage

## Note sur les assets

Le dépôt ne contenait aucune image au démarrage du projet : les visuels de
référence (sprite sheet des personnages, décors forêt/château/espace) n'ont
jamais été versionnés. Tout le pixel art est donc **généré par le code** à
partir de cette direction artistique — ce qui garde le jeu à ~150 ko, sans
aucun asset binaire à charger.

Si les vraies sprite sheets sont ajoutées plus tard, elles remplacent l'art
généré **sans toucher au gameplay** : déposez les PNG dans `public/assets/` et
décrivez-les dans `public/assets/manifest.json` (format documenté dans
[`docs/ASSETS.md`](docs/ASSETS.md)).
