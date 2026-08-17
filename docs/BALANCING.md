# Équilibrage

Tout se règle par des données : aucun de ces réglages ne demande de toucher au
gameplay.

## Personnages — `src/data/characters.ts`

```ts
knight: { hp, maxHp, mp, attack, magic, defense, speed, attackSpeed, attackRange }
growth: { maxHp, maxMp, attack, magic, defense }   // gain par niveau
unlocks: [{ level, spell }]                        // compétences débloquées
aggroRadius, followDistance, hitbox
```

`xpForLevel(n) = 18 × n^1.65`. Les compagnons progressent un peu plus lentement
que le chevalier et se relèvent 4 s après être tombés.

## Ennemis — `src/data/enemies.ts`

Chaque monstre expose `hp`, `damage`, `defense`, `speed`, `attackRange`,
`attackCooldown`, `xp`, plus `aggroRadius`, `knockbackResist` et sa table de
butin.

La difficulté monte par monde via `WORLD_SCALING` :

| Monde | PV | Dégâts | Vitesse | XP |
|---|---|---|---|---|
| 1 — Forêt | ×1 | ×1 | ×1 | ×1 |
| 2 — Château | ×1,45 | ×1,35 | ×1,10 | ×1,4 |
| 3 — Espace | ×1,95 | ×1,70 | ×1,22 | ×1,9 |

Chaque monstre posé dans un niveau reçoit aussi un « niveau » local
(`new FurBall(bank, world, level)`) qui ajoute +8 % par cran : c'est le bouton
pour durcir une zone précise sans toucher à l'espèce.

## Combat — `src/core/config.ts`

```ts
COMBAT.hitstopSeconds        // gel à l'impact
COMBAT.invulnerableAfterHit  // fenêtre d'invincibilité après un coup reçu
COMBAT.knockbackDecay
COMBAT.damageVariance        // ±12 % sur chaque coup
CAMERA.smoothing / deadzone / maxShake
FOLLOW.spacing               // distance entre deux membres de la file
FOLLOW.catchUpDistance       // au-delà : bonus de vitesse
FOLLOW.teleportDistance      // au-delà : rattachement direct à la trace
```

Le chevalier : attaque légère à `ATTACK_TIME = 0,3 s`, attaque chargée à
`CHARGE_TIME = 0,42 s` de maintien pour ×2,1 dégâts, esquive de 0,26 s avec
invincibilité et 0,55 s de récupération (`src/entities/player.ts`).

## Sorts — `src/data/spells.ts`

`power` multiplie la magie (ou l'attaque pour les sorts physiques) ; `mpCost`,
`cooldown`, `range`, `castTime` et `status` (poison / ralentissement /
étourdissement) complètent la fiche. Les compagnons choisissent le sort le plus
puissant disponible et à portée, en donnant toujours la priorité aux soins
quand un allié passe sous 60 % de PV.

## Terrain — `src/gfx/gen/tiles.ts`

Une tuile peut porter `hazard` (dégâts par seconde, ex. marais empoisonnés :
3 dps) et `drag` (facteur de vitesse, ex. hautes herbes : 0,65).
