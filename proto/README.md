# Maquettes

Prototypes de recherche visuelle. Ils ne partagent rien avec le jeu principal :
un fichier, aucune dépendance, ouvrable directement dans un navigateur.

## `maquette.html` — le test de rendu

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


## `grain.html` — « La Phrase »

Le prototype jouable. Il garde le rendu de la maquette et pose dessus le
système de jeu.

### Le principe : le monde est la partition

Il n'y a pas de piste musicale. Des notes sont **posées dans le décor** — de
petits bâtons plantés dans le sol, visibles — et la créature est la tête de
lecture. Avancer lit la phrase ; reculer la joue à l'envers, non par un tour
de passe-passe mais parce qu'on recroise les mêmes notes dans l'autre sens.
S'arrêter fait silence. La vitesse fait le tempo.

**La profondeur est l'orchestration.** Trois bandes, trois voix :

| Profondeur | Voix | Caractère |
|---|---|---|
| près de l'objectif (`z < -30`) | cloches | aigu, clair, ouvert |
| le plan de la créature (`-12 → 46`) | mélodie | le chant principal |
| le fond (`z > 96`) | basses | grave, lent, réverbéré |

On n'entend que la bande qu'on longe : changer de profondeur, c'est changer
d'instrument. Un passe-bas global se ferme à mesure qu'on s'enfonce — c'est
l'équivalent sonore du flou.

Tout est quantifié sur une pentatonique mineure : rien ne peut sonner faux.
Tous les 1400 pas, la tonique change : le monde module en avançant.

### L'histoire

On est une note échappée d'une phrase. Les créatures en gardent les morceaux
et ne les rendent qu'après un geste : **caresser** pour apaiser, **secouer**
le téléphone pour réveiller, **pencher** l'appareil. Les dialogues ont des
choix qui changent la suite. Trois morceaux recueillis = la phrase.

Les capteurs sont demandés au moment du geste (iOS exige que la demande parte
d'un appui). Sur un ordinateur, frotter l'écran remplace les capteurs : la
demande reste franchissable partout.

### Les surprises

- **la résonance** : un bouquet de tiges qui arpège quand on le traverse ;
- **le passage** : une masse immense qui dérive au fond, sur un grave tenu ;
- **la pluie** : des curiosités rouges qui tombent et sonnent en touchant le sol.

### Commandes

Glisser pour marcher ; le doigt au-dessus de la créature l'enfonce dans la
profondeur, en dessous la ramène vers l'objectif. Flèches au clavier. Les
créatures engagent la conversation d'elles-mêmes quand on s'approche.

### Console

`window.__grain` expose `state()`, `walk(±1)`, `dive(±1)`, `goToCreature()`,
`choose(i)`, `rub(n)`, `fps()` — c'est par là que le prototype est piloté
dans les tests.
