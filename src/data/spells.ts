/**
 * Spell table.
 *
 * `element` and `shape` are consumed by `systems/spells.ts`, so a new spell is
 * usually just a new row here - fire, ice, lightning, poison and gravity are all
 * already wired.
 */

export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'holy' | 'poison' | 'gravity' | 'star';
export type SpellShape = 'projectile' | 'burst' | 'self' | 'aura' | 'beam';

export interface SpellDef {
  id: string;
  name: string;
  shape: SpellShape;
  element: Element;
  mpCost: number;
  /** Multiplier applied to the caster's magic (or attack for physical). */
  power: number;
  cooldown: number;
  /** Projectile speed, or burst radius for `burst`. */
  speed?: number;
  radius?: number;
  range: number;
  /** Seconds of cast animation before the effect fires. */
  castTime: number;
  fx: 'bolt' | 'frost' | 'starShard' | 'voidBall' | 'heal' | 'shield' | 'magicHit' | 'poisonCloud';
  /** Status inflicted on hit. */
  status?: { kind: 'poison' | 'slow' | 'stun'; duration: number; power?: number };
  heal?: number;
  shieldAmount?: number;
  aiRole?: 'attack' | 'heal' | 'support';
}

export const SPELLS: Record<string, SpellDef> = {
  // --- princess -----------------------------------------------------------
  lightBolt: {
    id: 'lightBolt',
    name: 'Éclat de lumière',
    shape: 'projectile',
    element: 'holy',
    mpCost: 4,
    power: 0.9,
    cooldown: 1.6,
    speed: 132,
    range: 100,
    castTime: 0.28,
    fx: 'magicHit',
    aiRole: 'attack',
  },
  heal: {
    id: 'heal',
    name: 'Soin',
    shape: 'self',
    element: 'holy',
    mpCost: 8,
    power: 0,
    cooldown: 7,
    range: 72,
    castTime: 0.45,
    fx: 'heal',
    heal: 16,
    aiRole: 'heal',
  },
  greaterHeal: {
    id: 'greaterHeal',
    name: 'Grand soin',
    shape: 'self',
    element: 'holy',
    mpCost: 14,
    power: 0,
    cooldown: 11,
    range: 80,
    castTime: 0.55,
    fx: 'heal',
    heal: 34,
    aiRole: 'heal',
  },
  shield: {
    id: 'shield',
    name: 'Protection',
    shape: 'aura',
    element: 'holy',
    mpCost: 10,
    power: 0,
    cooldown: 14,
    range: 64,
    castTime: 0.4,
    fx: 'shield',
    shieldAmount: 22,
    aiRole: 'support',
  },

  // --- wizard -------------------------------------------------------------
  fireBolt: {
    id: 'fireBolt',
    name: 'Trait de feu',
    shape: 'projectile',
    element: 'fire',
    mpCost: 5,
    power: 1.05,
    cooldown: 1.5,
    speed: 148,
    range: 130,
    castTime: 0.3,
    fx: 'bolt',
    aiRole: 'attack',
  },
  frostNova: {
    id: 'frostNova',
    name: 'Nova de givre',
    shape: 'burst',
    element: 'ice',
    mpCost: 12,
    power: 1.2,
    cooldown: 6,
    radius: 46,
    range: 92,
    castTime: 0.45,
    fx: 'frost',
    status: { kind: 'slow', duration: 2.5, power: 0.45 },
    aiRole: 'attack',
  },
  meteor: {
    id: 'meteor',
    name: 'Météore',
    shape: 'burst',
    element: 'fire',
    mpCost: 18,
    power: 1.9,
    cooldown: 9,
    radius: 40,
    range: 120,
    castTime: 0.6,
    fx: 'bolt',
    aiRole: 'attack',
  },

  // --- knight -------------------------------------------------------------
  whirl: {
    id: 'whirl',
    name: 'Tourbillon',
    shape: 'burst',
    element: 'physical',
    mpCost: 8,
    power: 1.1,
    cooldown: 4,
    radius: 34,
    range: 0,
    castTime: 0.12,
    fx: 'magicHit',
  },
  shockwave: {
    id: 'shockwave',
    name: 'Onde de choc',
    shape: 'burst',
    element: 'physical',
    mpCost: 14,
    power: 1.6,
    cooldown: 7,
    radius: 52,
    range: 0,
    castTime: 0.2,
    fx: 'magicHit',
    status: { kind: 'stun', duration: 0.8 },
  },

  // --- enemies ------------------------------------------------------------
  poisonSpit: {
    id: 'poisonSpit',
    name: 'Crachat toxique',
    shape: 'projectile',
    element: 'poison',
    mpCost: 0,
    power: 1,
    cooldown: 2.2,
    speed: 92,
    range: 110,
    castTime: 0.25,
    fx: 'poisonCloud',
    status: { kind: 'poison', duration: 3, power: 2 },
  },
  voidPull: {
    id: 'voidPull',
    name: 'Aspiration',
    shape: 'aura',
    element: 'gravity',
    mpCost: 0,
    power: 0.5,
    cooldown: 3,
    radius: 84,
    range: 84,
    castTime: 0.2,
    fx: 'voidBall',
  },
  voidBurst: {
    id: 'voidBurst',
    name: 'Explosion du vide',
    shape: 'burst',
    element: 'gravity',
    mpCost: 0,
    power: 1.3,
    cooldown: 4.5,
    radius: 56,
    range: 60,
    castTime: 0.35,
    fx: 'voidBall',
  },
  starFall: {
    id: 'starFall',
    name: 'Pluie d’étoiles',
    shape: 'burst',
    element: 'star',
    mpCost: 0,
    power: 1.4,
    cooldown: 5,
    radius: 40,
    range: 140,
    castTime: 0.5,
    fx: 'starShard',
  },
};

export const ELEMENT_COLORS: Record<Element, string> = {
  physical: '#f4f0e4',
  fire: '#ff8f3a',
  ice: '#8fd8ff',
  lightning: '#ffe66d',
  holy: '#fff3c4',
  poison: '#8fd76a',
  gravity: '#b06cf5',
  star: '#8fe3ff',
};
