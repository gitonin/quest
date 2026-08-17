import { TILE } from '../core/config';
import { BlackHole } from '../entities/enemies/blackHole';
import { FurBall } from '../entities/enemies/furBall';
import { StarDevourer } from '../entities/enemies/bosses';
import { Interactive } from '../entities/interactive';
import type { World } from '../systems/world';
import { placeEnemy } from './forest';
import { TileMap } from './tilemap';
import {
  makeChest,
  Painter,
  placeProp,
  TriggerZone,
  type LevelBuildResult,
  type LevelDef,
  type LevelHooks,
} from './level';

const COLS = 100;
const ROWS = 80;
const px = (tile: number) => tile * TILE + TILE / 2;

interface Platform {
  col: number;
  row: number;
  w: number;
  h: number;
  rune?: boolean;
}

/**
 * World 3 - The Star World.
 *
 * Everything is void by default; the level is the network of glass platforms
 * and walkways carved into it, exactly like the reference art. Falling is not
 * possible (the void is solid) but black holes drag the party towards the
 * edges, which is where the difficulty comes from.
 */
export const spaceLevel: LevelDef = {
  id: 'space',
  index: 3,
  title: 'MONDE 3',
  subtitle: 'LE MONDE DES ÉTOILES',
  theme: 'space',
  music: 'space',
  ambient: 'stardust',
  lighting: 'space',

  build(world: World, hooks: LevelHooks): LevelBuildResult {
    const map = new TileMap(COLS, ROWS, world.assets.tiles.space, world.assets.tiles.space.byName.void);
    world.reset(map);
    const p = new Painter(map, 90210);

    // --- glass architecture ----------------------------------------------
    const platforms: Platform[] = [
      { col: 6, row: 34, w: 16, h: 14, rune: true }, // arrival
      { col: 26, row: 12, w: 14, h: 12 },
      { col: 26, row: 52, w: 14, h: 12 },
      { col: 44, row: 30, w: 18, h: 16, rune: true }, // crossroads
      { col: 66, row: 10, w: 14, h: 12 },
      { col: 66, row: 56, w: 14, h: 12 },
      { col: 78, row: 32, w: 18, h: 16, rune: true }, // final arena
      { col: 46, row: 4, w: 10, h: 8 },
      { col: 46, row: 66, w: 10, h: 8 },
    ];

    for (const plat of platforms) {
      p.scatter(plat.col, plat.row, plat.w, plat.h, ['glass', 'glass2'], [3, 2]);
      // Golden rails around the rim, with gaps where walkways connect.
      for (let x = plat.col; x < plat.col + plat.w; x++) {
        if (x % 5 !== 0) {
          p.rect(x, plat.row - 1, 1, 1, 'rail');
          p.rect(x, plat.row + plat.h, 1, 1, 'rail');
        }
      }
      for (let y = plat.row; y < plat.row + plat.h; y++) {
        if (y % 5 !== 0) {
          p.rect(plat.col - 1, y, 1, 1, 'rail');
          p.rect(plat.col + plat.w, y, 1, 1, 'rail');
        }
      }
      if (plat.rune) {
        const cx = plat.col + Math.floor(plat.w / 2);
        const cy = plat.row + Math.floor(plat.h / 2);
        p.quad(cx - 1, cy - 1, 'glass_rune');
      }
    }

    // Walkways between platforms - the crossing paths of the reference art.
    const bridges: Array<[number, number, number, number]> = [
      [14, 40, 33, 40],
      [33, 24, 33, 40],
      [33, 18, 52, 18],
      [52, 18, 52, 38],
      [33, 40, 52, 40],
      [33, 40, 33, 58],
      [33, 58, 52, 58],
      [52, 58, 52, 44],
      [52, 38, 73, 30],
      [73, 16, 73, 30],
      [73, 30, 87, 40],
      [52, 44, 73, 62],
      [73, 62, 87, 46],
      [51, 12, 51, 18],
      [51, 62, 51, 70],
    ];
    for (const [x0, y0, x1, y1] of bridges) p.path(x0, y0, x1, y1, 4, 'glass');
    // Stairs where the walkways change height.
    p.rect(52, 26, 4, 3, 'stairs');
    p.rect(52, 48, 4, 3, 'stairs');
    p.rect(73, 24, 4, 3, 'stairs');

    // Teleport pads: shortcut between the arrival platform and the crossroads.
    p.quad(10, 38, 'pad');
    p.quad(50, 36, 'pad');
    map.rebuildSolidity();

    // --- scenery ----------------------------------------------------------
    for (const plat of platforms) {
      const corners: Array<[number, number]> = [
        [plat.col + 1, plat.row + 1],
        [plat.col + plat.w - 2, plat.row + 1],
        [plat.col + 1, plat.row + plat.h - 2],
        [plat.col + plat.w - 2, plat.row + plat.h - 2],
      ];
      corners.forEach(([c, r], i) => placeProp(world, i % 2 ? 'crystal' : 'crystal_tall', px(c), px(r)));
    }

    // --- story ------------------------------------------------------------
    const spawn = { x: px(13), y: px(40) };
    world.add(
      new TriggerZone('space.arrival', spawn.x, spawn.y, 90, 90, () => {
        hooks.startDialogue('spaceArrival');
        hooks.showToast('CHEMINS DE VERRE');
      }),
    );

    // Teleporter pair.
    placeProp(world, 'portal', px(11), px(39));
    placeProp(world, 'portal', px(51), px(37));
    const tp = new Interactive('space.teleport', px(11), px(39));
    tp.prompt = 'ENTRER';
    tp.radius = 22;
    tp.onInteract = () => {
      const player = world.entitiesOfKind('player')[0];
      if (!player) return;
      player.x = px(51);
      player.y = px(38);
      world.particles.emit('magic', player.x, player.y - 10, 20, { speed: 60, color: '#b06cf5' });
      hooks.showToast('TÉLÉPORTATION');
    };
    tp.used = false;
    world.add(tp);

    // Monsters: black holes on the bridges, fur balls on the platforms.
    for (const [c, r] of [
      [33, 30],
      [52, 30],
      [40, 40],
      [52, 50],
      [73, 22],
      [66, 60],
      [80, 40],
    ] as Array<[number, number]>) {
      world.add(placeEnemy(new BlackHole(world.assets.blackhole, 3, 6), px(c), px(r)));
    }
    for (const [c, r] of [
      [30, 16],
      [36, 20],
      [30, 56],
      [36, 60],
      [70, 14],
      [76, 18],
      [70, 60],
      [50, 8],
      [50, 70],
    ] as Array<[number, number]>) {
      world.add(placeEnemy(new FurBall(world.assets.furball, 3, 7), px(c), px(r)));
    }

    makeChest(world, 'space.a1', px(30), px(16), 'ether', hooks);
    makeChest(world, 'space.b1', px(50), px(6), 'potion', hooks);
    makeChest(world, 'space.c1', px(50), px(69), 'ether', hooks);
    makeChest(world, 'space.d1', px(70), px(60), 'potion', hooks);

    world.add(
      new TriggerZone('space.core', px(86), px(40), 120, 120, () => {
        hooks.setFlag('space.reachedCore');
        hooks.showToast("CŒUR DU MONDE DES ÉTOILES");
      }),
    );

    // The star and its guardian.
    const starX = px(87);
    const starY = px(40);
    placeProp(world, 'star', starX, starY);
    const bossDefeated = hooks.hasFlag('space.bossDefeated');
    if (!bossDefeated) {
      const boss = new StarDevourer(world.assets.devourer, 3, 8);
      boss.x = px(90);
      boss.y = px(44);
      boss.defeatFlag = 'space.bossDefeated';
      world.add(boss);
      world.add(
        new TriggerZone('trigger.finalBoss', px(86), px(42), 130, 130, () => {
          hooks.bossMusic(true);
          hooks.startDialogue('starFound');
        }),
      );
    }

    const star = new Interactive('quest.magicStar', starX, starY + 6);
    star.prompt = 'PRENDRE';
    star.radius = 28;
    star.onInteract = () => {
      if (!hooks.hasFlag('space.bossDefeated')) {
        hooks.showToast("LE DÉVOREUR PROTÈGE L'ÉTOILE");
        return;
      }
      star.used = true;
      hooks.giveItem('magicStar');
      hooks.setFlag('item.magicStar');
      hooks.startDialogue('ending', () => hooks.goToWorld(4));
    };
    world.add(star);

    return {
      spawn,
      checkpoints: {
        A: spawn,
        B: { x: px(33), y: px(18) },
        C: { x: px(52), y: px(38) },
        D: { x: px(73), y: px(30) },
        E: { x: px(84), y: px(40) },
      },
      zones: [
        { id: 'A', x: 0, y: 24 * TILE, w: 30 * TILE, h: 34 * TILE },
        { id: 'B', x: 22 * TILE, y: 0, w: 34 * TILE, h: 34 * TILE },
        { id: 'C', x: 22 * TILE, y: 34 * TILE, w: 34 * TILE, h: 40 * TILE },
        { id: 'D', x: 54 * TILE, y: 0, w: 30 * TILE, h: 40 * TILE },
        { id: 'E', x: 62 * TILE, y: 24 * TILE, w: 38 * TILE, h: 42 * TILE },
        { id: 'F', x: 54 * TILE, y: 40 * TILE, w: 34 * TILE, h: 36 * TILE },
      ],
    };
  },
};
