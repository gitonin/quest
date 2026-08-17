# Architecture

Moteur maison : **TypeScript + Canvas 2D**, aucune dépendance à l'exécution.
Résolution interne fixe **480×270**, agrandie par un facteur entier vers
l'écran : la grille de pixels reste intacte sur tous les téléphones et le taux
de remplissage reste faible (60 fps mesurés en test headless).

## Découpage

```
src/
  core/        boucle, config, input, caméra, maths + RNG déterministe
  gfx/         renderer, sprites/animations, police bitmap, particules,
               éclairage, parallaxe
    gen/       générateurs de pixel art (héros, monstres, tuiles, décors, FX)
  entities/    Entity → Character → Player / Companion / Enemy
    enemies/   PoisonPlant, FurBall, BlackHole, StoneGuardian, StarDevourer
  systems/     world (collisions, requêtes, tri en profondeur), combat,
               sorts, follow (trace + steering)
  data/        stats personnages, table des ennemis, sorts, objets, dialogues
  levels/      tilemap, outils de peinture, forest / castle / space
  ui/          contrôles tactiles, HUD, dialogues, menus, widgets
  audio/       AudioManager (chiptune WebAudio)
  save/        SaveManager (localStorage, 3 slots + réglages)
  quest/       QuestManager (drapeaux + étapes de quête)
  gameManager.ts  orchestrateur
  main.ts      point d'entrée
```

La règle : **la logique de jeu ne connaît ni l'écran ni le périphérique**.
Le gameplay lit `Input` (jamais le DOM), dessine via `Renderer` (jamais le
canvas d'affichage) et les niveaux pilotent l'histoire par `LevelHooks`, une
interface implémentée par `GameManager`.

## Boucle de jeu

`GameManager.frame` (requestAnimationFrame) fait, dans l'ordre :

1. `audio.update` — le séquenceur planifie les notes à venir ;
2. `input.update` — calcule les fronts montants/descendants ;
3. `step(dt)` — état courant : jeu, transition, ou menu ;
4. `draw()` — fond parallaxe → tuiles → entités triées en Y → particules →
   éclairage → HUD → contrôles tactiles → menus.

La simulation tourne à **pas fixe (1/60 s)** dans un accumulateur, avec au plus
5 rattrapages par image : la physique est identique quelle que soit la
fréquence de l'écran. Le `hitstop` (gel très court à l'impact) se contente de
sauter des pas de simulation, l'UI continue d'animer.

## Rendu et profondeur

Les décors ne sont pas des images de fond : ce sont des **tuiles 16×16**
(couche sol, collisions et effets de terrain) plus des **props** triés en Y
avec les personnages. C'est ce qui permet de passer *derrière* la cime d'un
arbre ou un pilier.

L'éclairage est une couche sombre percée de dégradés radiaux (torches,
cristaux, aura du joueur) composée en `multiply` — assez cheap pour le mobile,
et c'est ce qui donne son ambiance au château.

## Compagnons

Trois briques :

- **Trace** (`systems/follow.ts`) : le joueur laisse des points de passage
  cumulés en distance. Un compagnon se projette sur cette trace
  (`nearestProgress`) et vise un point légèrement plus loin : le groupe marche
  donc *sur le chemin réellement emprunté*, ponts compris.
- **Steering** : `avoidObstacles` sonde des angles croissants quand la route
  est bloquée, `separation` empêche les compagnons de se superposer.
- **Machine à états** : `follow`, `idle`, `combat`, `lowHealth`, `boss`,
  `down`. Les états lisent `isTelegraphing` / `isVulnerable` sur les boss pour
  reculer pendant les charges et frapper pendant les ouvertures.

Filet de sécurité : un compagnon distancé plus de 1,8 s rejoint directement la
trace (petit effet de particules). Rare par construction, mais cela garantit
qu'aucune configuration de décor ne casse la file.

## Ajouter du contenu

| Je veux… | Je touche… |
|---|---|
| un monstre | une ligne dans `data/enemies.ts` + une classe dans `entities/enemies/` (surcharger `think`) |
| un sort | une ligne dans `data/spells.ts` (formes : projectile, burst, self, aura, beam) |
| un objet | une ligne dans `data/items.ts` |
| une zone | une méthode de `Painter` dans le fichier de niveau + une `CameraZone` |
| un dialogue | une entrée dans `data/dialogues.ts` |
| une étape de quête | une étape dans `quest/questManager.ts` + `hooks.setFlag(...)` |

## Tests

`scripts/smoke.mjs` lance le build dans Chromium, joue une session (titre →
forêt → combat → menus → château → espace), échoue sur toute erreur JS et
mesure les fps. `scripts/playthrough.mjs` vérifie les critères de réussite du
cahier des charges (déplacement, combat gagné, rencontre de la princesse,
suivi en file, combat automatique du compagnon, chaîne de quêtes, groupe à 3).
Les captures atterrissent dans `.smoke/`.

Une API de debug est exposée sur `window.__quest` (état, téléportations,
recrutement, soin, liste des ennemis) : elle sert aux tests et à
l'inspection en console, aucun système de jeu n'en dépend.
