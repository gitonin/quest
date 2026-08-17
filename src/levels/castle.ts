import { TILE } from '../core/config';
import { FurBall } from '../entities/enemies/furBall';
import { PoisonPlant } from '../entities/enemies/poisonPlant';
import { StoneGuardian } from '../entities/enemies/bosses';
import { Interactive } from '../entities/interactive';
import type { World } from '../systems/world';
import { placeEnemy } from './forest';
import { TileMap } from './tilemap';
import {
  makeChest,
  makeNpc,
  Painter,
  placeProp,
  TriggerZone,
  type LevelBuildResult,
  type LevelDef,
  type LevelHooks,
} from './level';

const COLS = 92;
const ROWS = 72;
const px = (tile: number) => tile * TILE + TILE / 2;

/**
 * World 2 - The Cursed Castle.
 *
 * A - the gate, B - the jails (locked door + key), C - the great hall where
 * Orin joins, D - the lower dungeon, E - the treasure room and its boss.
 */
export const castleLevel: LevelDef = {
  id: 'castle',
  index: 2,
  title: 'MONDE 2',
  subtitle: 'LE CHÂTEAU MAUDIT',
  theme: 'castle',
  music: 'castle',
  ambient: 'ember',
  lighting: 'castle',

  build(world: World, hooks: LevelHooks): LevelBuildResult {
    const map = new TileMap(COLS, ROWS, world.assets.tiles.castle, world.assets.tiles.castle.byName.wall);
    world.reset(map);
    const p = new Painter(map, 4242);

    // --- rooms ------------------------------------------------------------
    // A: entrance courtyard.
    p.room(4, 4, 30, 22, 'floor', 'wall');
    p.scatter(5, 5, 28, 20, ['floor', 'floor2', 'floor_crack'], [5, 3, 1]);
    p.rect(17, 5, 4, 20, 'carpet');

    // B: jail corridors.
    p.room(36, 4, 22, 12, 'floor', 'wall');
    p.room(36, 18, 22, 14, 'floor2', 'wall');
    p.rect(38, 20, 4, 4, 'grate');
    p.rect(46, 20, 4, 4, 'grate');
    p.rect(52, 20, 4, 4, 'grate');
    p.path(34, 12, 36, 12, 3, 'floor');
    p.path(46, 16, 46, 18, 3, 'floor');

    // C: the great hall.
    p.room(60, 4, 28, 26, 'floor', 'wall');
    p.scatter(61, 5, 26, 24, ['floor', 'floor2'], [4, 3]);
    p.rect(72, 5, 4, 24, 'carpet');
    p.path(58, 12, 60, 12, 3, 'floor');

    // D: lower dungeon, with pits and mist.
    p.room(20, 36, 44, 20, 'floor2', 'wall');
    p.scatter(21, 37, 42, 18, ['floor2', 'floor_crack', 'mist'], [4, 2, 2]);
    p.rect(30, 42, 6, 6, 'pit');
    p.rect(46, 44, 8, 5, 'pit');
    p.path(40, 32, 40, 36, 3, 'stairs');
    p.path(46, 32, 46, 36, 3, 'floor');

    // E: treasure room.
    p.room(60, 44, 28, 24, 'floor', 'wall');
    p.scatter(61, 45, 26, 22, ['floor', 'floor2'], [5, 3]);
    p.rect(72, 45, 4, 22, 'carpet');
    p.path(64, 52, 60, 52, 3, 'floor');

    // Vertical link A -> D so the player can go down early.
    p.path(12, 26, 12, 46, 3, 'stairs');
    p.path(12, 46, 20, 46, 3, 'floor');

    map.rebuildSolidity();

    // --- scenery ----------------------------------------------------------
    for (const [c, r] of [
      [6, 6], [31, 6], [6, 23], [31, 23], [62, 6], [86, 6], [62, 28], [86, 28],
      [62, 46], [86, 46], [62, 66], [86, 66], [22, 38], [61, 38], [22, 54], [61, 54],
    ] as Array<[number, number]>) {
      placeProp(world, 'torch', px(c), px(r));
    }
    for (const [c, r] of [
      [10, 5], [26, 5], [66, 5], [82, 5], [66, 45], [82, 45],
    ] as Array<[number, number]>) {
      placeProp(world, 'banner', px(c), px(r));
    }
    for (const [c, r] of [
      [10, 10], [26, 10], [10, 20], [26, 20], [66, 12], [82, 12], [66, 24], [82, 24],
      [66, 52], [82, 52], [66, 62], [82, 62],
    ] as Array<[number, number]>) {
      placeProp(world, 'pillar', px(c), px(r));
    }
    for (const [c, r] of [[14, 8], [22, 8], [70, 20], [78, 20], [70, 58], [78, 58]] as Array<[number, number]>) {
      placeProp(world, 'statue', px(c), px(r));
    }

    // --- story ------------------------------------------------------------
    const spawn = { x: px(19), y: px(23) };
    world.add(
      new TriggerZone('castle.entered', spawn.x, spawn.y - 20, 90, 90, () => {
        hooks.setFlag('castle.entered');
        hooks.startDialogue('castleGate');
      }),
    );

    // A + B: enemies and the jail key.
    for (const [c, r] of [[12, 12], [26, 16], [20, 20]] as Array<[number, number]>) {
      world.add(placeEnemy(new FurBall(world.assets.furball, 2, 4), px(c), px(r)));
    }
    for (const [c, r] of [[40, 8], [54, 10], [44, 28], [52, 26]] as Array<[number, number]>) {
      world.add(placeEnemy(new PoisonPlant(world.assets.plant, 2, 4), px(c), px(r)));
    }
    for (const [c, r] of [[48, 8], [40, 24]] as Array<[number, number]>) {
      world.add(placeEnemy(new FurBall(world.assets.furball, 2, 5), px(c), px(r)));
    }
    makeChest(world, 'castle.key1', px(54), px(6), 'rustyKey', hooks);
    makeChest(world, 'castle.a1', px(8), px(8), 'potion', hooks);
    makeChest(world, 'castle.b1', px(38), px(30), 'ether', hooks);

    // Locked door between the jails and the great hall.
    const doorX = px(59);
    const doorY = px(12);
    const doorProp = world.addProp('door', Math.round(doorX - 14), Math.round(doorY - 33));
    const doorOpen = hooks.hasFlag('castle.door1');
    if (doorOpen) {
      world.replaceProp(doorProp, 'door_open');
    } else {
      map.fillRect(58, 10, 2, 5, map.tileset.byName.wall);
      map.rebuildSolidity();
    }
    const door = new Interactive('door.hall', doorX, doorY + 8);
    door.prompt = 'OUVRIR';
    door.radius = 26;
    door.used = doorOpen;
    door.onInteract = () => {
      if (!hooks.consumeItem('rustyKey')) {
        hooks.startDialogue('lockedDoor');
        return;
      }
      door.used = true;
      hooks.setFlag('castle.door1');
      world.replaceProp(doorProp, 'door_open');
      map.fillRect(58, 11, 2, 3, map.tileset.byName.floor);
      map.rebuildSolidity();
      hooks.showToast('LA PORTE S’OUVRE');
    };
    world.add(door);

    // C: the wizard.
    if (!hooks.hasFlag('party.wizard')) {
      const orin = makeNpc(world, 'npc.wizard', px(74), px(14), world.assets.wizard, 'down');
      orin.onInteract = () => {
        orin.used = true;
        hooks.startDialogue('meetWizard', () => {
          orin.alive = false;
          hooks.joinWizard(orin.x, orin.y);
          hooks.setFlag('party.wizard');
          hooks.startDialogue('wizardJoined');
        });
      };
    }
    for (const [c, r] of [[64, 20], [84, 20], [74, 26]] as Array<[number, number]>) {
      world.add(placeEnemy(new FurBall(world.assets.furball, 2, 5), px(c), px(r)));
    }
    makeChest(world, 'castle.c1', px(64), px(8), 'potion', hooks);

    // D: lower dungeon.
    for (const [c, r] of [[26, 40], [38, 52], [56, 40], [50, 52], [24, 50]] as Array<[number, number]>) {
      world.add(placeEnemy(new FurBall(world.assets.furball, 2, 6), px(c), px(r)));
    }
    for (const [c, r] of [[34, 38], [44, 54], [60, 50]] as Array<[number, number]>) {
      world.add(placeEnemy(new PoisonPlant(world.assets.plant, 2, 6), px(c), px(r)));
    }
    makeChest(world, 'castle.key2', px(24), px(38), 'ironKey', hooks);
    makeChest(world, 'castle.d1', px(58), px(54), 'potion', hooks);

    // E: the boss and the treasure.
    const gateX = px(63);
    const gateY = px(52);
    if (!hooks.hasFlag('castle.gate2')) {
      map.fillRect(62, 50, 2, 5, map.tileset.byName.wall);
      map.rebuildSolidity();
      const gate = new Interactive('door.treasure', gateX, gateY + 8);
      gate.prompt = 'OUVRIR';
      gate.radius = 26;
      gate.onInteract = () => {
        if (!hooks.consumeItem('ironKey')) {
          hooks.startDialogue('lockedDoor');
          return;
        }
        gate.used = true;
        hooks.setFlag('castle.gate2');
        map.fillRect(62, 51, 2, 3, map.tileset.byName.floor);
        map.rebuildSolidity();
        hooks.showToast('LA SALLE DU TRÉSOR EST OUVERTE');
      };
      world.add(gate);
    }

    const treasureX = px(74);
    const treasureY = px(50);
    const bossDefeated = hooks.hasFlag('castle.bossDefeated');
    if (!bossDefeated) {
      const boss = new StoneGuardian(world.assets.gargoyle, 2, 5);
      boss.x = treasureX;
      boss.y = px(58);
      boss.defeatFlag = 'castle.bossDefeated';
      world.add(boss);
      world.add(
        new TriggerZone('trigger.boss', px(74), px(56), 120, 90, () => {
          hooks.bossMusic(true);
          hooks.startDialogue('bossGuardian');
        }),
      );
    }

    placeProp(world, 'treasure', treasureX, treasureY);
    const treasure = new Interactive('quest.treasure', treasureX, treasureY);
    treasure.prompt = 'OUVRIR';
    treasure.radius = 28;
    treasure.onInteract = () => {
      if (!hooks.hasFlag('castle.bossDefeated')) {
        hooks.showToast('LE GARDIEN VEILLE ENCORE...');
        return;
      }
      treasure.used = true;
      hooks.startDialogue('treasureFound', () => {
        hooks.giveItem('treasure');
        hooks.setFlag('item.treasure');
        world.add(new TriggerZone('exit.space', px(74), px(46), 80, 60, () => hooks.goToWorld(3), false));
        placeProp(world, 'portal', px(74), px(46));
        hooks.showToast('UN PORTAIL S’OUVRE AU NORD');
      });
    };
    if (hooks.hasFlag('item.treasure')) {
      treasure.used = true;
      placeProp(world, 'portal', px(74), px(46));
      world.add(new TriggerZone('exit.space', px(74), px(46), 80, 60, () => hooks.goToWorld(3), false));
    }
    world.add(treasure);

    return {
      spawn,
      checkpoints: {
        A: spawn,
        B: { x: px(46), y: px(14) },
        C: { x: px(74), y: px(20) },
        D: { x: px(40), y: px(40) },
        E: { x: px(74), y: px(64) },
      },
      zones: [
        { id: 'A', x: 0, y: 0, w: 36 * TILE, h: 34 * TILE },
        { id: 'B', x: 32 * TILE, y: 0, w: 30 * TILE, h: 36 * TILE },
        { id: 'C', x: 58 * TILE, y: 0, w: 34 * TILE, h: 34 * TILE },
        { id: 'D', x: 8 * TILE, y: 30 * TILE, w: 58 * TILE, h: 30 * TILE },
        { id: 'E', x: 58 * TILE, y: 40 * TILE, w: 34 * TILE, h: 32 * TILE },
      ],
    };
  },
};

/** Kept for symmetry with the other levels - unused seeds stay deterministic. */
export const CASTLE_COLS = COLS;
export const CASTLE_ROWS = ROWS;
