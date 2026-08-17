import { TILE } from '../core/config';
import type { CameraZone } from '../core/camera';
import { RNG } from '../core/math';
import type { ParticleKind } from '../gfx/particles';
import type { WorldTheme } from '../gfx/background';
import type { MusicTrack } from '../audio/audioManager';
import type { World } from '../systems/world';
import type { TileMap } from './tilemap';
import { Chest, Interactive, Npc } from '../entities/interactive';
import type { AnimBank } from '../gfx/sprites';

/** Callbacks a level uses to drive the story. Implemented by `GameManager`. */
export interface LevelHooks {
  startDialogue(id: string, onDone?: () => void): void;
  setFlag(flag: string): void;
  hasFlag(flag: string): boolean;
  joinPrincess(x: number, y: number): void;
  joinWizard(x: number, y: number): void;
  giveItem(itemId: string, quantity?: number): void;
  hasItem(itemId: string): boolean;
  consumeItem(itemId: string): boolean;
  goToWorld(index: number): void;
  showToast(text: string): void;
  bossMusic(on: boolean): void;
}

export interface LevelBuildResult {
  spawn: { x: number; y: number };
  zones: CameraZone[];
  /** Named respawn points, used by saves and by the death screen. */
  checkpoints: Record<string, { x: number; y: number }>;
}

export interface LevelDef {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  theme: WorldTheme;
  music: MusicTrack;
  ambient: ParticleKind | null;
  lighting: 'forest' | 'castle' | 'space' | 'poison';
  build(world: World, hooks: LevelHooks): LevelBuildResult;
}

/* ------------------------------------------------------------- paint tools */

/** Tile painting helpers shared by the three worlds. */
export class Painter {
  readonly map: TileMap;
  readonly rng: RNG;
  private names: Record<string, number>;

  constructor(map: TileMap, seed: number) {
    this.map = map;
    this.rng = new RNG(seed);
    this.names = map.tileset.byName;
  }

  id(name: string): number {
    const i = this.names[name];
    if (i === undefined) throw new Error(`unknown tile "${name}"`);
    return i;
  }

  fill(name: string): void {
    this.map.fillRect(0, 0, this.map.cols, this.map.rows, this.id(name));
  }

  rect(col: number, row: number, w: number, h: number, name: string): void {
    this.map.fillRect(col, row, w, h, this.id(name));
  }

  /** Fills a rect while randomly mixing several tiles - kills the grid look. */
  scatter(col: number, row: number, w: number, h: number, names: string[], weights?: number[]): void {
    const ids = names.map((n) => this.id(n));
    const acc: number[] = [];
    let total = 0;
    (weights ?? names.map(() => 1)).forEach((weight) => {
      total += weight;
      acc.push(total);
    });
    for (let y = row; y < row + h; y++) {
      for (let x = col; x < col + w; x++) {
        const r = this.rng.next() * total;
        const index = acc.findIndex((a) => r <= a);
        this.map.set(x, y, ids[index < 0 ? 0 : index]);
      }
    }
  }

  /** Thick line of tiles, used for paths, corridors and glass walkways. */
  path(x0: number, y0: number, x1: number, y1: number, width: number, name: string): void {
    const id = this.id(name);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
    const half = Math.floor(width / 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(x0 + (x1 - x0) * t);
      const cy = Math.round(y0 + (y1 - y0) * t);
      for (let dy = -half; dy < width - half; dy++) {
        for (let dx = -half; dx < width - half; dx++) this.map.set(cx + dx, cy + dy, id);
      }
    }
  }

  /** L-shaped connection: horizontal first, then vertical. */
  elbow(x0: number, y0: number, x1: number, y1: number, width: number, name: string): void {
    this.path(x0, y0, x1, y0, width, name);
    this.path(x1, y0, x1, y1, width, name);
  }

  /** Paints a 2x2 block built from `<prefix>_tl/tr/bl/br` quadrant tiles. */
  quad(col: number, row: number, prefix: string): void {
    this.map.set(col, row, this.id(`${prefix}_tl`));
    this.map.set(col + 1, row, this.id(`${prefix}_tr`));
    this.map.set(col, row + 1, this.id(`${prefix}_bl`));
    this.map.set(col + 1, row + 1, this.id(`${prefix}_br`));
  }

  border(name: string, thickness = 2): void {
    const id = this.id(name);
    for (let t = 0; t < thickness; t++) {
      for (let x = 0; x < this.map.cols; x++) {
        this.map.set(x, t, id);
        this.map.set(x, this.map.rows - 1 - t, id);
      }
      for (let y = 0; y < this.map.rows; y++) {
        this.map.set(t, y, id);
        this.map.set(this.map.cols - 1 - t, y, id);
      }
    }
  }

  /** Hollow room: solid walls with a walkable interior. */
  room(col: number, row: number, w: number, h: number, floor: string, wall: string): void {
    this.rect(col, row, w, h, wall);
    this.rect(col + 1, row + 1, w - 2, h - 2, floor);
  }
}

export interface ScatterOptions {
  /** Tile names the props must stay off - paths, bridges, carpets... */
  avoidTiles?: string[];
  /** Minimum distance between two colliding props. */
  spacing?: number;
  /** Extra rejection test in world pixels. */
  avoid?: (x: number, y: number) => boolean;
}

const DEFAULT_AVOID = ['dirt', 'dirt2', 'bridge', 'shallow', 'water', 'carpet', 'stairs'];

/**
 * Scatters scenery inside a rect.
 *
 * Props keep off walkable paths and off each other, so a dense forest never
 * ends up walling the player out of its own trail.
 */
export function scatterProps(
  world: World,
  rng: RNG,
  names: string[],
  col: number,
  row: number,
  w: number,
  h: number,
  count: number,
  opts: ScatterOptions = {},
): void {
  const avoidTiles = opts.avoidTiles ?? DEFAULT_AVOID;
  const spacing = opts.spacing ?? 20;
  const placed: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = (col + rng.range(0, w)) * TILE;
      const y = (row + rng.range(0, h)) * TILE;
      if (world.tilemap.solidAtPx(x, y)) continue;
      if (opts.avoid?.(x, y)) continue;

      // Reject anything sitting on (or right next to) a walkable path.
      let onPath = false;
      for (const [dx, dy] of [
        [0, 0],
        [-10, 0],
        [10, 0],
        [0, -10],
        [0, 10],
      ]) {
        const def = world.tilemap.defAtPx(x + dx, y + dy);
        if (def && avoidTiles.includes(def.name)) {
          onPath = true;
          break;
        }
      }
      if (onPath) continue;

      const name = rng.pick(names);
      const def = world.assets.props[name];
      if (def.collide && placed.some((p) => Math.hypot(p.x - x, p.y - y) < spacing)) continue;
      world.addProp(name, Math.round(x - def.w / 2), Math.round(y - def.anchorY));
      if (def.collide) placed.push({ x, y });
      break;
    }
  }
}

/** Places a prop by its anchor (feet) position. */
export function placeProp(world: World, name: string, x: number, y: number): void {
  const def = world.assets.props[name];
  world.addProp(name, Math.round(x - def.w / 2), Math.round(y - def.anchorY));
}

export function makeChest(world: World, id: string, x: number, y: number, itemId: string, hooks: LevelHooks): Chest {
  const chest = new Chest(id, x, y, itemId, world.assets.props.chest.clip, world.assets.props.chest_open.clip);
  chest.onInteract = () => {
    chest.open();
    hooks.giveItem(itemId);
    hooks.setFlag(`chest.${id}`);
    hooks.showToast(`${chest.itemName} !`);
  };
  if (hooks.hasFlag(`chest.${id}`)) chest.open();
  world.add(chest);
  return chest;
}

export function makeSign(world: World, id: string, x: number, y: number, dialogue: string, hooks: LevelHooks): void {
  placeProp(world, 'sign', x, y);
  const sign = new Interactive(id, x, y);
  sign.prompt = 'LIRE';
  sign.radius = 24;
  sign.onInteract = () => hooks.startDialogue(dialogue);
  world.add(sign);
}

export function makeNpc(world: World, id: string, x: number, y: number, bank: AnimBank, facing = 'down'): Npc {
  const npc = new Npc(id, x, y, bank, facing);
  world.add(npc);
  return npc;
}

/**
 * Invisible trigger volume. Used for zone dialogues, ambushes and the
 * transitions between worlds.
 */
export class TriggerZone extends Interactive {
  constructor(id: string, x: number, y: number, w: number, h: number, onEnter: () => void, once = true) {
    super(id, x, y);
    this.w = w;
    this.h = h;
    this.radius = Math.max(w, h) / 2;
    this.autoTrigger = true;
    this.onInteract = () => {
      if (once) this.used = true;
      onEnter();
    };
  }

  override canInteract(px: number, py: number): boolean {
    if (this.used) return false;
    return Math.abs(px - this.x) <= this.w / 2 && Math.abs(py - this.y) <= this.h / 2;
  }
}
