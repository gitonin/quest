/**
 * Quest tracking.
 *
 * Each quest is a list of ordered steps with a short objective label shown in
 * the HUD. `flags` doubles as the world state store (doors opened, bosses
 * beaten, chests looted), and the save system just serialises it.
 */

export interface QuestStep {
  id: string;
  label: string;
  /** Flag that completes this step. */
  flag: string;
}

export interface QuestDef {
  id: string;
  title: string;
  steps: QuestStep[];
}

export const QUESTS: QuestDef[] = [
  {
    id: 'forest',
    title: 'La Forêt Magique',
    steps: [
      { id: 'explore', label: 'Explorer la forêt', flag: 'forest.enteredDeepWoods' },
      { id: 'princess', label: 'Retrouver la voyageuse', flag: 'party.princess' },
      { id: 'swamp', label: 'Traverser les marais empoisonnés', flag: 'forest.crossedSwamp' },
      { id: 'tree', label: "Atteindre l'Arbre Magique", flag: 'item.magicTree' },
    ],
  },
  {
    id: 'castle',
    title: 'Le Château Maudit',
    steps: [
      { id: 'enter', label: 'Franchir la porte du château', flag: 'castle.entered' },
      { id: 'key', label: 'Trouver la clé des geôles', flag: 'item.rustyKey' },
      { id: 'wizard', label: 'Rencontrer le mage de la grande salle', flag: 'party.wizard' },
      { id: 'boss', label: 'Vaincre le Gardien de pierre', flag: 'castle.bossDefeated' },
      { id: 'treasure', label: 'Récupérer le Trésor', flag: 'item.treasure' },
    ],
  },
  {
    id: 'space',
    title: 'Le Monde des Étoiles',
    steps: [
      { id: 'paths', label: 'Traverser les chemins de verre', flag: 'space.reachedCore' },
      { id: 'devourer', label: "Vaincre le Dévoreur d'étoiles", flag: 'space.bossDefeated' },
      { id: 'star', label: "Prendre l'Étoile Magique", flag: 'item.magicStar' },
    ],
  },
];

export class QuestManager {
  private flags = new Set<string>();
  listeners: Array<(flag: string) => void> = [];

  setFlag(flag: string): void {
    if (this.flags.has(flag)) return;
    this.flags.add(flag);
    for (const l of this.listeners) l(flag);
  }

  has(flag: string): boolean {
    return this.flags.has(flag);
  }

  clear(): void {
    this.flags.clear();
  }

  serialize(): string[] {
    return [...this.flags];
  }

  load(flags: string[]): void {
    this.flags = new Set(flags);
  }

  questFor(worldIndex: number): QuestDef {
    return QUESTS[Math.min(QUESTS.length - 1, Math.max(0, worldIndex - 1))];
  }

  /** Current objective of a world: the first step still unfinished. */
  currentObjective(worldIndex: number): string {
    const quest = this.questFor(worldIndex);
    for (const step of quest.steps) {
      if (!this.has(step.flag)) return step.label;
    }
    return 'Objectif accompli !';
  }

  progress(worldIndex: number): { done: number; total: number } {
    const quest = this.questFor(worldIndex);
    return {
      done: quest.steps.filter((s) => this.has(s.flag)).length,
      total: quest.steps.length,
    };
  }
}
