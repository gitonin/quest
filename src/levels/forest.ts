import { TILE } from '../core/config';
import { PoisonPlant } from '../entities/enemies/poisonPlant';
import { FurBall } from '../entities/enemies/furBall';
import { Interactive } from '../entities/interactive';
import type { World } from '../systems/world';
import { TileMap } from './tilemap';
import {
  makeChest,
  makeNpc,
  makeSign,
  Painter,
  placeProp,
  scatterProps,
  TriggerZone,
  type LevelBuildResult,
  type LevelDef,
  type LevelHooks,
} from './level';

const COLS = 100;
const ROWS = 78;

const px = (tile: number) => tile * TILE + TILE / 2;

/**
 * World 1 - The Magic Forest.
 *
 * Five zones carved out of a solid canopy: the tutorial clearing (A), the deep
 * woods with its river and secrets (B), the glade where Lyra joins (C), the
 * poisoned marsh (D) and the sanctuary of the Magic Tree (E).
 */
export const forestLevel: LevelDef = {
  id: 'forest',
  index: 1,
  title: 'MONDE 1',
  subtitle: 'LA FORÊT MAGIQUE',
  theme: 'forest',
  music: 'forest',
  ambient: 'leaf',
  lighting: 'forest',

  build(world: World, hooks: LevelHooks): LevelBuildResult {
    const map = new TileMap(COLS, ROWS, world.assets.tiles.forest, world.assets.tiles.forest.byName.leaves_dark);
    world.reset(map);
    const p = new Painter(map, 1789);
    const rng = p.rng;

    // --- ground -----------------------------------------------------------
    // Zone A: starting clearing.
    p.scatter(4, 4, 28, 24, ['grass', 'grass2', 'grass3', 'grass_flower'], [4, 3, 3, 2]);
    // Zone B: deep woods.
    p.scatter(34, 3, 38, 28, ['grass', 'grass2', 'grass3', 'tall_grass'], [4, 3, 3, 2]);
    // Zone C: glade.
    p.scatter(70, 18, 26, 26, ['grass', 'grass_flower', 'grass2', 'grass3'], [4, 3, 2, 2]);
    // Zone D: marsh.
    p.scatter(18, 36, 44, 24, ['grass', 'grass2', 'tall_grass'], [3, 3, 3]);
    // Zone E: sanctuary.
    p.scatter(58, 50, 38, 26, ['grass', 'grass_flower', 'grass2'], [4, 3, 3]);

    // Connecting trails.
    p.path(16, 16, 34, 16, 4, 'dirt');
    p.elbow(46, 16, 78, 30, 4, 'dirt');
    p.elbow(80, 40, 40, 46, 4, 'dirt');
    p.elbow(40, 52, 74, 60, 4, 'dirt');
    p.path(10, 10, 16, 16, 3, 'dirt2');

    // River across zone B with a wooden bridge on the trail.
    p.path(40, 3, 40, 30, 3, 'water');
    p.path(40, 3, 46, 12, 3, 'water');
    p.rect(39, 15, 3, 3, 'bridge');
    p.rect(38, 14, 5, 1, 'shallow');
    p.rect(38, 18, 5, 1, 'shallow');

    // Poison pools in the marsh.
    for (let i = 0; i < 7; i++) {
      const cx = rng.int(22, 58);
      const cy = rng.int(40, 57);
      p.path(cx, cy, cx + rng.int(-4, 5), cy + rng.int(-3, 4), rng.int(3, 6), 'poison');
    }
    // Keep the trail through the marsh walkable.
    p.elbow(80, 40, 40, 46, 3, 'dirt');
    p.elbow(40, 52, 74, 60, 3, 'dirt');

    // Ruins guarding the sanctuary + a small secret alcove in zone B.
    p.rect(70, 56, 14, 2, 'ruins');
    p.rect(70, 56, 2, 10, 'ruins');
    p.rect(82, 56, 2, 10, 'ruins');
    p.rect(74, 56, 6, 2, 'grass');
    p.scatter(72, 58, 10, 12, ['grass_flower', 'grass', 'grass3'], [3, 3, 2]);
    p.scatter(58, 6, 6, 6, ['grass', 'grass_flower'], [3, 2]);
    p.path(56, 9, 50, 12, 2, 'dirt2');
    p.rect(4, 26, 6, 8, 'rockwall');

    map.rebuildSolidity();

    // --- scenery ----------------------------------------------------------
    const treeNames = ['tree', 'tree_alt', 'tree_big'];
    // Dense tree line hugging the canopy so the walls read as forest, not as a
    // box, then clutter inside each clearing.
    for (let row = 2; row < ROWS - 2; row++) {
      for (let col = 2; col < COLS - 2; col++) {
        if (map.solidAtPx(px(col), px(row))) continue;
        const nearWall =
          map.solidAtPx(px(col + 1), px(row)) ||
          map.solidAtPx(px(col - 1), px(row)) ||
          map.solidAtPx(px(col), px(row + 1)) ||
          map.solidAtPx(px(col), px(row - 1));
        const tile = map.defAtPx(px(col), px(row));
        const walkway = tile ? ['dirt', 'dirt2', 'bridge', 'shallow', 'water'].includes(tile.name) : false;
        if (nearWall && !walkway && rng.chance(0.55)) {
          placeProp(world, rng.pick(treeNames), px(col), px(row) + 6);
        }
      }
    }
    const scatter = (names: string[], c: number, r: number, w: number, h: number, n: number) =>
      scatterProps(world, rng, names, c, r, w, h, n, { spacing: 22 });

    scatter(['tree', 'tree_alt', 'bush', 'bush_small', 'rock'], 4, 4, 28, 24, 54);
    scatter(['tree', 'tree_big', 'tree_alt', 'bush', 'rock'], 34, 3, 38, 28, 96);
    scatter(['tree_alt', 'bush', 'bush_small', 'rock'], 70, 18, 26, 26, 60);
    scatter(['bush', 'bush_small', 'rock', 'tree_alt'], 18, 36, 44, 24, 76);
    scatter(['tree', 'tree_alt', 'bush_small', 'rock'], 58, 50, 38, 26, 70);
    placeProp(world, 'waterfall', px(40), px(6));
    placeProp(world, 'tree_big', px(76), px(24));
    placeProp(world, 'tree_big', px(86), px(34));

    // --- story ------------------------------------------------------------
    const spawn = { x: px(10), y: px(12) };
    makeSign(world, 'sign.start', px(15), px(15), 'signStart', hooks);

    if (!hooks.hasFlag('forest.intro')) {
      world.add(
        new TriggerZone('trigger.intro', spawn.x, spawn.y, 60, 60, () => {
          hooks.setFlag('forest.intro');
          hooks.startDialogue('intro');
        }),
      );
    }
    world.add(
      new TriggerZone('trigger.deepwoods', px(35), px(16), 40, 120, () => {
        hooks.setFlag('forest.enteredDeepWoods');
        hooks.showToast('FORÊT PROFONDE');
      }),
    );

    // Zone B: first real fight + a hidden chest behind the river.
    world.add(placeEnemy(new PoisonPlant(world.assets.plant, 1), px(37), px(22)));
    world.add(placeEnemy(new PoisonPlant(world.assets.plant, 1), px(50), px(10)));
    world.add(placeEnemy(new FurBall(world.assets.furball, 1), px(52), px(20)));
    world.add(placeEnemy(new FurBall(world.assets.furball, 1), px(60), px(14)));
    makeChest(world, 'forest.secret1', px(60), px(8), 'potion', hooks);
    makeChest(world, 'forest.b1', px(44), px(26), 'ether', hooks);

    // Zone C: the meeting with the princess.
    if (!hooks.hasFlag('party.princess')) {
      const plantGuard = placeEnemy(new PoisonPlant(world.assets.plant, 1), px(80), px(30));
      world.add(plantGuard);
      const lyra = makeNpc(world, 'npc.princess', px(84), px(34), world.assets.princess, 'down');
      lyra.prompt = 'PARLER';
      lyra.onInteract = () => {
        lyra.used = true;
        hooks.startDialogue('meetPrincess', () => {
          lyra.alive = false;
          hooks.joinPrincess(lyra.x, lyra.y);
          hooks.setFlag('party.princess');
          hooks.startDialogue('princessJoined');
        });
      };
    }
    world.add(placeEnemy(new FurBall(world.assets.furball, 1, 2), px(76), px(40)));
    makeChest(world, 'forest.c1', px(90), px(22), 'potion', hooks);

    // Zone D: the poisoned marsh.
    world.add(
      new TriggerZone('trigger.swamp', px(58), px(44), 90, 90, () => {
        hooks.startDialogue('poisonWarning');
        hooks.showToast('MARAIS EMPOISONNÉS');
      }),
    );
    for (const [c, r] of [
      [50, 44],
      [42, 50],
      [34, 46],
      [28, 52],
      [46, 56],
    ] as Array<[number, number]>) {
      world.add(placeEnemy(new PoisonPlant(world.assets.plant, 1, 2), px(c), px(r)));
    }
    world.add(placeEnemy(new FurBall(world.assets.furball, 1, 2), px(36), px(54)));
    makeChest(world, 'forest.d1', px(24), px(40), 'ether', hooks);
    world.add(
      new TriggerZone('trigger.swampDone', px(60), px(58), 80, 60, () => hooks.setFlag('forest.crossedSwamp')),
    );

    // Zone E: the sanctuary.
    for (const [c, r] of [
      [66, 62],
      [88, 62],
      [78, 68],
    ] as Array<[number, number]>) {
      world.add(placeEnemy(new FurBall(world.assets.furball, 1, 3), px(c), px(r)));
    }
    world.add(placeEnemy(new PoisonPlant(world.assets.plant, 1, 3), px(72), px(66)));

    const treeX = px(78);
    const treeY = px(64);
    placeProp(world, 'magic_tree', treeX, treeY);
    const tree = new Interactive('quest.magicTree', treeX, treeY - 4);
    tree.prompt = 'TOUCHER';
    tree.radius = 34;
    tree.onInteract = () => {
      tree.used = true;
      hooks.startDialogue('magicTree', () => {
        hooks.giveItem('magicTree');
        hooks.setFlag('item.magicTree');
        hooks.showToast('SÈVE DE L’ARBRE MAGIQUE');
        world.add(
          new TriggerZone('exit.castle', px(94), px(64), 70, 90, () => hooks.goToWorld(2), false),
        );
        hooks.showToast('UN PASSAGE S’OUVRE À L’EST');
      });
    };
    if (hooks.hasFlag('item.magicTree')) {
      tree.used = true;
      world.add(new TriggerZone('exit.castle', px(94), px(64), 70, 90, () => hooks.goToWorld(2), false));
    }
    world.add(tree);
    placeProp(world, 'portal', px(94), px(64));

    return {
      spawn,
      checkpoints: {
        A: spawn,
        B: { x: px(38), y: px(16) },
        C: { x: px(80), y: px(34) },
        D: { x: px(56), y: px(46) },
        E: { x: px(72), y: px(62) },
      },
      zones: [
        { id: 'A', x: 0, y: 0, w: 34 * TILE, h: 34 * TILE },
        { id: 'B', x: 32 * TILE, y: 0, w: 42 * TILE, h: 34 * TILE },
        { id: 'C', x: 66 * TILE, y: 14 * TILE, w: 34 * TILE, h: 34 * TILE },
        { id: 'D', x: 14 * TILE, y: 32 * TILE, w: 52 * TILE, h: 32 * TILE },
        { id: 'E', x: 54 * TILE, y: 46 * TILE, w: 46 * TILE, h: 32 * TILE },
      ],
    };
  },
};

/** Snaps a spawned monster onto walkable ground. */
function placeEnemy<T extends { x: number; y: number }>(enemy: T, x: number, y: number): T {
  enemy.x = x;
  enemy.y = y;
  return enemy;
}

export { placeEnemy };
