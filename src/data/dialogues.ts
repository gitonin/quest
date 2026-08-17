/**
 * Dialogue scripts.
 *
 * Short lines only - they are read on a phone, over gameplay. `speaker` picks
 * the portrait colour in the dialogue box.
 */

export interface DialogueLine {
  speaker: string;
  text: string;
  /** Portrait accent colour. */
  color?: string;
}

export type DialogueId =
  | 'intro'
  | 'signStart'
  | 'meetPrincess'
  | 'princessJoined'
  | 'poisonWarning'
  | 'magicTree'
  | 'castleGate'
  | 'meetWizard'
  | 'wizardJoined'
  | 'lockedDoor'
  | 'bossGuardian'
  | 'treasureFound'
  | 'spaceArrival'
  | 'starFound'
  | 'ending';

export const DIALOGUES: Record<DialogueId, DialogueLine[]> = {
  intro: [
    { speaker: 'Chevalier', text: "La forêt a cessé de chanter. L'Arbre Magique doit être malade.", color: '#9a6ce8' },
    { speaker: 'Chevalier', text: 'Je dois le retrouver. Seul, s\'il le faut.', color: '#9a6ce8' },
  ],
  signStart: [{ speaker: 'Panneau', text: "SENTIER DE LA CLAIRIÈRE →  ATTENTION AUX PLANTES", color: '#b08a4e' }],
  meetPrincess: [
    { speaker: 'Princesse', text: 'Attention ! Ces ronces mordent vraiment.', color: '#5b9bf5' },
    { speaker: 'Chevalier', text: 'Vous vous battez bien, pour une princesse.', color: '#9a6ce8' },
    { speaker: 'Princesse', text: "Lyra. Et je cherche l'Arbre Magique, moi aussi.", color: '#5b9bf5' },
    { speaker: 'Princesse', text: 'Ma magie vous soignera. Allons-y ensemble.', color: '#5b9bf5' },
  ],
  princessJoined: [{ speaker: 'Système', text: 'LYRA REJOINT LE GROUPE !', color: '#f0c04a' }],
  poisonWarning: [
    { speaker: 'Lyra', text: "L'air est vicié ici. Ne restez pas dans les marécages.", color: '#5b9bf5' },
  ],
  magicTree: [
    { speaker: 'Arbre Magique', text: 'Vous êtes venus... mais ma lumière a été volée.', color: '#7fd45c' },
    { speaker: 'Arbre Magique', text: 'Un trésor du château maudit garde mon éclat.', color: '#7fd45c' },
    { speaker: 'Chevalier', text: 'Alors nous irons au château.', color: '#9a6ce8' },
  ],
  castleGate: [
    { speaker: 'Lyra', text: 'Les gargouilles nous observent. Restez près de moi.', color: '#5b9bf5' },
  ],
  meetWizard: [
    { speaker: '???', text: 'Baissez-vous !', color: '#c3cad9' },
    { speaker: 'Magicien', text: "Orin, mage errant. Ce château dévore les imprudents.", color: '#c3cad9' },
    { speaker: 'Chevalier', text: 'Nous cherchons le trésor.', color: '#9a6ce8' },
    { speaker: 'Magicien', text: 'Alors mes flammes vous seront utiles.', color: '#c3cad9' },
  ],
  wizardJoined: [{ speaker: 'Système', text: 'ORIN REJOINT LE GROUPE !', color: '#f0c04a' }],
  lockedDoor: [{ speaker: 'Chevalier', text: 'Verrouillée. Il faut une clé.', color: '#9a6ce8' }],
  bossGuardian: [
    { speaker: 'Gardien', text: 'LE TRÉSOR... N\'APPARTIENT... À PERSONNE.', color: '#ffb03a' },
    { speaker: 'Orin', text: 'Il frappe fort mais lentement. Esquivez !', color: '#c3cad9' },
  ],
  treasureFound: [
    { speaker: 'Chevalier', text: "Le trésor... il brille d'une lumière froide.", color: '#9a6ce8' },
    { speaker: 'Orin', text: "Ce n'est pas de l'or. C'est un fragment d'étoile.", color: '#c3cad9' },
    { speaker: 'Lyra', text: "L'Étoile Magique existe donc vraiment.", color: '#5b9bf5' },
    { speaker: 'Orin', text: 'Le fragment ouvre un chemin. Vers le vide.', color: '#c3cad9' },
  ],
  spaceArrival: [
    { speaker: 'Lyra', text: 'Le sol est en verre... et en dessous, les étoiles.', color: '#5b9bf5' },
    { speaker: 'Orin', text: 'Ne tombez pas. Ici, tomber dure très longtemps.', color: '#c3cad9' },
  ],
  starFound: [
    { speaker: 'Chevalier', text: "L'Étoile Magique. Enfin.", color: '#9a6ce8' },
    { speaker: '???', text: 'ELLE EST À MOI.', color: '#b06cf5' },
  ],
  ending: [
    { speaker: 'Lyra', text: "La lumière retourne à l'Arbre Magique.", color: '#5b9bf5' },
    { speaker: 'Orin', text: 'La forêt rechantera dès ce soir.', color: '#c3cad9' },
    { speaker: 'Chevalier', text: 'Alors rentrons. Ensemble.', color: '#9a6ce8' },
    { speaker: 'Système', text: 'FIN — MERCI D\'AVOIR JOUÉ !', color: '#f0c04a' },
  ],
};
