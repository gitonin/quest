/**
 * Enemy balancing table.
 *
 * Adding a monster = one entry here + one behaviour class in
 * `entities/enemies/`. The generic `Enemy` base handles HP, knockback, drops,
 * hit reactions and death, so behaviours stay small.
 */

export type EnemyId = 'poisonPlant' | 'furBall' | 'blackHole' | 'gargoyle' | 'devourer';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  /** Sprite bank key inside `Assets`. */
  bank: 'plant' | 'furball' | 'blackhole' | 'gargoyle' | 'devourer';
  hp: number;
  damage: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  xp: number;
  /** Detection radius. */
  aggroRadius: number;
  /** Physical collision box, centred on the entity's feet. */
  hitbox: { w: number; h: number };
  /** Rendering offset from the feet position to the sprite's top-left. */
  drawOffset: { x: number; y: number };
  knockbackResist: number;
  isBoss?: boolean;
  /** Never moves (rooted plants). */
  rooted?: boolean;
  /** Loot table: item id -> probability. */
  drops?: Array<{ item: string; chance: number }>;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  poisonPlant: {
    id: 'poisonPlant',
    name: 'Plante venimeuse',
    bank: 'plant',
    hp: 26,
    damage: 5,
    defense: 2,
    speed: 0,
    attackRange: 26,
    attackCooldown: 1.9,
    xp: 12,
    aggroRadius: 80,
    hitbox: { w: 16, h: 10 },
    drawOffset: { x: -13, y: -24 },
    knockbackResist: 1,
    rooted: true,
    drops: [
      { item: 'potion', chance: 0.28 },
      { item: 'ether', chance: 0.12 },
    ],
  },
  furBall: {
    id: 'furBall',
    name: 'Boule de poil',
    bank: 'furball',
    hp: 34,
    damage: 6,
    defense: 3,
    speed: 62,
    attackRange: 16,
    attackCooldown: 1.4,
    xp: 16,
    aggroRadius: 120,
    hitbox: { w: 14, h: 9 },
    drawOffset: { x: -11, y: -18 },
    knockbackResist: 0.35,
    drops: [
      { item: 'potion', chance: 0.3 },
      { item: 'ether', chance: 0.15 },
    ],
  },
  blackHole: {
    id: 'blackHole',
    name: 'Trou noir',
    bank: 'blackhole',
    hp: 52,
    damage: 11,
    defense: 5,
    speed: 34,
    attackRange: 54,
    attackCooldown: 2.6,
    xp: 30,
    aggroRadius: 168,
    hitbox: { w: 16, h: 14 },
    drawOffset: { x: -15, y: -22 },
    knockbackResist: 0.85,
    drops: [
      { item: 'ether', chance: 0.4 },
      { item: 'potion', chance: 0.25 },
    ],
  },
  gargoyle: {
    id: 'gargoyle',
    name: 'Gardien de pierre',
    bank: 'gargoyle',
    hp: 220,
    damage: 14,
    defense: 8,
    speed: 52,
    attackRange: 30,
    attackCooldown: 2.1,
    xp: 160,
    aggroRadius: 260,
    hitbox: { w: 22, h: 14 },
    drawOffset: { x: -17, y: -34 },
    knockbackResist: 0.9,
    isBoss: true,
  },
  devourer: {
    id: 'devourer',
    name: "Dévoreur d'étoiles",
    bank: 'devourer',
    hp: 340,
    damage: 17,
    defense: 10,
    speed: 42,
    attackRange: 70,
    attackCooldown: 2.3,
    xp: 320,
    aggroRadius: 320,
    hitbox: { w: 26, h: 20 },
    drawOffset: { x: -22, y: -30 },
    knockbackResist: 1,
    isBoss: true,
  },
};

/** Per-world difficulty ramp: forest is a tutorial, space should hurt. */
export const WORLD_SCALING: Record<number, { hp: number; damage: number; speed: number; xp: number }> = {
  1: { hp: 1, damage: 1, speed: 1, xp: 1 },
  2: { hp: 1.45, damage: 1.35, speed: 1.1, xp: 1.4 },
  3: { hp: 1.95, damage: 1.7, speed: 1.22, xp: 1.9 },
};
