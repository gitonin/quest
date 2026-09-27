# Maquettes

Prototypes de recherche visuelle. Ils ne partagent rien avec le jeu principal :
un fichier, aucune dépendance, ouvrable directement dans un navigateur.

## `maquette.html` — « Le Grain »

Test de rendu pour la direction *macro / maquette* : une créature de quelques
pixels dans un champ de matière, en noir et blanc, avec une seule teinte vive.

### Les règles du rendu

1. **Tout est un grain** : un cube de matière posé dans un volume (x, y, z).
   Il n'existe pas de « décor », seulement de la matière à des profondeurs
   différentes.
2. **Le flou appartient au monde, pas à l'écran.** Chaque grain calcule son
   propre cercle de confusion : net, c'est un carré aligné sur la grille ;
   flou, c'est un disque doux dont la surface grandit et la densité baisse
   d'autant. Aucun post-traitement de flou — c'est ce qui fait lire
   « maquette filmée » plutôt que « filtre appliqué ».
3. **La trame se mérite.** La grille de pixels n'est visible que dans le plan
   de netteté ; elle se dissout ailleurs, exactement comme un grain optique.
4. **La hauteur de l'objectif fait la profondeur.** `CAM_H` étale la
   profondeur à l'écran : trop bas, tous les plans se tassent en une bande.
   C'est le réglage le plus sensible de tout le fichier.
5. **Le rouge est une information, jamais une décoration.** Ici il ne signale
   pas un danger : il appelle. Il pulse, s'ouvre quand on s'approche — la
   netteté se déplace alors sur lui — puis s'élève et s'en va.

### Réglages

En haut du script : `F` (focale), `APERTURE` (violence du flou), `GRAIN`
(taille d'un cube au plan net), `CAM_H` (hauteur de l'objectif), `CHUNK`
(largeur d'un morceau de monde).

### Commandes

Maintenir le doigt / la souris d'un côté pour avancer, ou les flèches.

### Performance

Le rendu est en Canvas 2D, sans WebGL. Les carrés nets sont groupés par
densité pour éviter des milliers de changements d'état ; le fond, le grain
argentique et la vignette sont pré-calculés à chaque redimensionnement.
Mesuré en headless (rendu logiciel, donc plancher bas) : 60 fps en 390x844,
~42 en 844x390, ~31 en 1280x720. Sur un vrai GPU, la marge est bien plus
large.
