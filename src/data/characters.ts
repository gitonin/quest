/**
 * Character balancing.
 *
 * Everything the designer touches lives here: base stats, per-level growth and
 * the follow distances of the caravan. No gameplay logic, only numbers.
 */

export type CharacterId = 'knight' | 'princess' | 'wizard';

export interface CharacterStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
  attackSpeed: number;
  attackRange: number;
  followDistance: number;
}

export interface GrowthCurve {
  maxHp: number;
  maxMp: number;
  attack: number;
  magic: number;
  defense: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  /** Six-letter name used by the party strip in the HUD. */
  shortName: string;
  base: CharacterStats;
  growth: GrowthCurve;
  /** Spell ids unlocked at the given level. */
  unlocks: Array<{ level: number; spell: string }>;
  /** Radius in which the AI looks for a target. */
  aggroRadius: number;
  hitbox: { w: number; h: number };
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  knight: {
    id: 'knight',
    name: 'Chevalier Noir',
    shortName: 'CHEVAL',
    base: {
      hp: 60,
      maxHp: 60,
      mp: 20,
      maxMp: 20,
      attack: 9,
      magic: 2,
      defense: 5,
      speed: 74,
      attackSpeed: 1,
      attackRange: 22,
      followDistance: 0,
    },
    growth: { maxHp: 8, maxMp: 2, attack: 2, magic: 0.4, defense: 1.2 },
    unlocks: [
      { level: 3, spell: 'whirl' },
      { level: 6, spell: 'shockwave' },
    ],
    aggroRadius: 0,
    hitbox: { w: 10, h: 8 },
  },
  princess: {
    id: 'princess',
    name: 'Princesse Lyra',
    shortName: 'LYRA',
    base: {
      hp: 42,
      maxHp: 42,
      mp: 46,
      maxMp: 46,
      attack: 4,
      magic: 10,
      defense: 3,
      speed: 72,
      attackSpeed: 0.8,
      attackRange: 78,
      followDistance: 22,
    },
    growth: { maxHp: 5, maxMp: 5, attack: 0.6, magic: 2.2, defense: 0.8 },
    unlocks: [
      { level: 2, spell: 'shield' },
      { level: 5, spell: 'greaterHeal' },
    ],
    aggroRadius: 96,
    hitbox: { w: 9, h: 8 },
  },
  wizard: {
    id: 'wizard',
    name: 'Magicien Orin',
    shortName: 'ORIN',
    base: {
      hp: 36,
      maxHp: 36,
      mp: 54,
      maxMp: 54,
      attack: 3,
      magic: 13,
      defense: 2,
      speed: 70,
      attackSpeed: 0.75,
      attackRange: 108,
      followDistance: 22,
    },
    growth: { maxHp: 4, maxMp: 6, attack: 0.4, magic: 2.8, defense: 0.6 },
    unlocks: [
      { level: 3, spell: 'frostNova' },
      { level: 6, spell: 'meteor' },
    ],
    aggroRadius: 130,
    hitbox: { w: 9, h: 8 },
  },
};

/** XP needed to reach the given level (index 0 = level 1). */
export function xpForLevel(level: number): number {
  return Math.round(18 * Math.pow(level, 1.65));
}

export function statsAtLevel(id: CharacterId, level: number): CharacterStats {
  const def = CHARACTERS[id];
  const steps = Math.max(0, level - 1);
  const maxHp = Math.round(def.base.maxHp + def.growth.maxHp * steps);
  const maxMp = Math.round(def.base.maxMp + def.growth.maxMp * steps);
  return {
    ...def.base,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    attack: Math.round((def.base.attack + def.growth.attack * steps) * 10) / 10,
    magic: Math.round((def.base.magic + def.growth.magic * steps) * 10) / 10,
    defense: Math.round((def.base.defense + def.growth.defense * steps) * 10) / 10,
  };
}
