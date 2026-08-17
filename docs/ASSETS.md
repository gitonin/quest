# Assets

## État actuel

Aucune image n'était présente dans le dépôt au démarrage du projet. Tout le
pixel art est donc **généré par le code** au lancement (~40 ms), à partir de la
direction artistique de référence : armure sombre à liserés violets pour le
chevalier, chevelure bleue pour la princesse, cape et chapeau pointu argentés
pour le magicien, forêt très verte, château de pierre sombre aux torches, monde
de verre translucide dans l'espace.

Conséquence : le jeu pèse ~150 ko, se charge instantanément et n'a aucun asset
binaire à gérer.

### Où est dessiné quoi

| Fichier | Contenu |
|---|---|
| `src/gfx/palette.ts` | toutes les couleurs, groupées par sujet |
| `src/gfx/pixel.ts` | surface de dessin 1 pixel = 1 pixel (lignes, ellipses, tramage, contour automatique) |
| `src/gfx/gen/humanoid.ts` | corps partagé des trois héros (torse, bras, jambes, robe, cape) |
| `src/gfx/gen/heroes.ts` | têtes, armes, et toutes les animations des héros |
| `src/gfx/gen/monsters.ts` | plante venimeuse, boule de poil, trou noir, gargouille, dévoreur |
| `src/gfx/gen/tiles.ts` | tuiles 16×16 des trois mondes (dont tuiles animées) |
| `src/gfx/gen/props.ts` | arbres, buissons, cascade, torches, bannières, piliers, cristaux, portails, coffres |
| `src/gfx/gen/fx.ts` | tranchants, impacts, projectiles, soins, boucliers, objets au sol |
| `src/gfx/background.ts` | starfield parallaxe, planètes, galaxies, comètes |

Les animations sont image par image : `idle`, `walk`, `attack`, `charge`,
`charged`, `cast`, `hurt`, `dodge`, `die`, déclinées en `down` / `up` / `side`
(le côté gauche est le miroir du droit).

## Remplacer par de vraies sprite sheets

Le chargeur préfère toujours un vrai PNG s'il en trouve un. Déposez vos fichiers
dans `public/assets/` et décrivez-les dans `public/assets/manifest.json` :

```json
{
  "sheets": [
    {
      "bank": "knight",
      "image": "knight.png",
      "frameW": 20,
      "frameH": 24,
      "clips": {
        "idle_down":  { "row": 0, "from": 0, "count": 4, "fps": 5,  "loop": true },
        "walk_down":  { "row": 1, "from": 0, "count": 6, "fps": 11, "loop": true },
        "attack_down":{ "row": 2, "from": 0, "count": 4, "fps": 16, "loop": false }
      }
    }
  ]
}
```

- `bank` : `knight`, `princess`, `wizard`, `plant`, `furball`, `blackhole`,
  `gargoyle`, `devourer`.
- `clips` : clés `<état>_<direction>` pour les héros (`down`, `up`, `left`,
  `right`), simple `<état>` pour les monstres sans direction.
- `row` / `from` / `count` découpent une grille régulière de `frameW × frameH`.

Toute banque absente du manifeste continue d'utiliser l'art généré : la
migration peut donc se faire personnage par personnage. Les banques réellement
chargées depuis le disque sont listées dans la console au démarrage.

### Conseils de découpe

Les sprites générés sont calibrés ainsi ; garder ces gabarits évite de retoucher
les décalages de dessin (`drawOffset` dans `data/enemies.ts`, `drawOffsetX/Y`
sur les personnages) :

| Sujet | Taille de frame | Pieds |
|---|---|---|
| héros | 20 × 24 | y = 22 |
| plante venimeuse | 26 × 26 | y = 24 |
| boule de poil | 22 × 20 | y = 18 |
| trou noir | 30 × 30 | centre |
| gargouille (boss) | 34 × 36 | y = 33 |
| dévoreur (boss) | 44 × 44 | centre |

## Audio

Aucun asset audio non plus : musiques (forêt, château, espace, boss, victoire)
et bruitages sont synthétisés en WebAudio (`src/audio/audioManager.ts`) dans un
style chiptune. L'API publique est volontairement agnostique
(`playMusic('forest')`, `playSfx('sword')`) : passer à de vrais fichiers revient
à réimplémenter ces deux méthodes, sans toucher au reste du jeu.
