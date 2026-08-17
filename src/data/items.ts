/** Item catalogue. Quest items are flagged so the save system keeps them. */

export type ItemKind = 'consumable' | 'key' | 'quest' | 'currency';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** Sprite key inside the FX bank. */
  fx: 'potion' | 'ether' | 'key' | 'heart' | 'orb' | 'questItem';
  description: string;
  /** Consumable effects. */
  healHp?: number;
  healMp?: number;
  stackable?: boolean;
  /** Quest items are persisted for good once collected. */
  persistent?: boolean;
}

export const ITEMS: Record<string, ItemDef> = {
  potion: {
    id: 'potion',
    name: 'Potion de vie',
    kind: 'consumable',
    fx: 'potion',
    description: 'Rend 30 PV au chevalier.',
    healHp: 30,
    stackable: true,
  },
  ether: {
    id: 'ether',
    name: 'Potion de magie',
    kind: 'consumable',
    fx: 'ether',
    description: 'Rend 25 PM à tout le groupe.',
    healMp: 25,
    stackable: true,
  },
  heart: {
    id: 'heart',
    name: 'Cœur',
    kind: 'consumable',
    fx: 'heart',
    description: 'Soigne un peu, ramassé sur le terrain.',
    healHp: 12,
    stackable: true,
  },
  rustyKey: {
    id: 'rustyKey',
    name: 'Clé rouillée',
    kind: 'key',
    fx: 'key',
    description: 'Ouvre les geôles du château maudit.',
    persistent: true,
  },
  ironKey: {
    id: 'ironKey',
    name: 'Clé de fer',
    kind: 'key',
    fx: 'key',
    description: 'Ouvre la porte de la salle du trésor.',
    persistent: true,
  },
  magicTree: {
    id: 'magicTree',
    name: 'Sève de l’Arbre Magique',
    kind: 'quest',
    fx: 'questItem',
    description: "Le cœur vivant de la forêt. Le premier fragment de la quête.",
    persistent: true,
  },
  treasure: {
    id: 'treasure',
    name: 'Trésor du château',
    kind: 'quest',
    fx: 'questItem',
    description: "Un coffre qui révèle l'existence de l'Étoile Magique.",
    persistent: true,
  },
  magicStar: {
    id: 'magicStar',
    name: 'Étoile Magique',
    kind: 'quest',
    fx: 'questItem',
    description: "La lumière au bout du voyage.",
    persistent: true,
  },
};

export const QUEST_ITEMS = ['magicTree', 'treasure', 'magicStar'] as const;
