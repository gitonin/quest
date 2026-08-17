import { GAME_HEIGHT, GAME_WIDTH } from '../core/config';
import { dist2, rectsOverlap } from '../core/math';
import type { Camera } from '../core/camera';
import type { Entity } from '../entities/entity';
import type { Particles } from '../gfx/particles';
import type { LightSource } from '../gfx/lighting';
import type { Ctx2D } from '../gfx/renderer';
import type { PropDef } from '../gfx/gen/props';
import type { Assets } from '../gfx/assets';
import type { TileMap } from '../levels/tilemap';
import { Animator } from '../gfx/sprites';

export interface PlacedProp {
  def: PropDef;
  name: string;
  x: number;
  y: number;
  animator: Animator;
  /** Props can be swapped at runtime (a door opening, a chest emptying). */
  hidden?: boolean;
}

export interface HitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Runtime container for one level: the tilemap, the static props and every
 * live entity. It also owns the queries the AI and combat systems need
 * (nearest enemy, line of sight, collision-aware movement).
 */
export class World {
  tilemap!: TileMap;
  props: PlacedProp[] = [];
  entities: Entity[] = [];
  particles!: Particles;
  camera!: Camera;
  assets!: Assets;
  /** Seconds of frozen simulation left after a heavy hit. */
  hitstop = 0;
  /** Set by the game manager to hear about defeated monsters (quest flags). */
  onEnemyDefeated: ((enemy: { defeatFlag?: string; isBoss: boolean; x: number; y: number }) => void) | null = null;
  private pendingAdd: Entity[] = [];

  reset(tilemap: TileMap): void {
    this.tilemap = tilemap;
    this.props = [];
    this.entities = [];
    this.pendingAdd = [];
    this.hitstop = 0;
  }

  add<T extends Entity>(entity: T): T {
    entity.world = this;
    this.pendingAdd.push(entity);
    return entity;
  }

  addProp(name: string, x: number, y: number): PlacedProp {
    const def = this.assets.props[name];
    if (!def) throw new Error(`unknown prop "${name}"`);
    const placed: PlacedProp = { def, name, x, y, animator: new Animator({ main: def.clip }, 'main') };
    this.props.push(placed);
    return placed;
  }

  replaceProp(prop: PlacedProp, name: string): void {
    const def = this.assets.props[name];
    if (!def) return;
    prop.def = def;
    prop.name = name;
    prop.animator = new Animator({ main: def.clip }, 'main');
  }

  flush(): void {
    for (const e of this.pendingAdd) {
      this.entities.push(e);
      e.onSpawn();
    }
    this.pendingAdd.length = 0;
    this.entities = this.entities.filter((e) => {
      if (e.alive) return true;
      e.onDespawn();
      return false;
    });
  }

  update(dt: number): void {
    this.tilemap.update(dt);
    for (const prop of this.props) prop.animator.update(dt);
    for (const e of this.entities) e.update(dt);
    this.flush();
  }

  /* ------------------------------------------------------------- queries */

  /** True when the box overlaps a solid tile or a solid prop. */
  boxBlocked(x: number, y: number, w: number, h: number): boolean {
    if (this.tilemap.boxCollides(x, y, w, h)) return true;
    const bx = x - w / 2;
    const by = y - h;
    for (const prop of this.props) {
      const c = prop.def.collide;
      if (!c || prop.hidden) continue;
      if (rectsOverlap(bx, by, w, h, prop.x + c.x, prop.y + c.y, c.w, c.h)) return true;
    }
    return false;
  }

  /**
   * Axis-separated movement: try X, then Y, so sliding along a wall feels
   * smooth instead of sticking in corners.
   */
  moveEntity(entity: Entity, dx: number, dy: number): { hitX: boolean; hitY: boolean } {
    const result = { hitX: false, hitY: false };
    if (dx !== 0) {
      const nx = entity.x + dx;
      if (!this.boxBlocked(nx, entity.y, entity.w, entity.h)) {
        entity.x = nx;
      } else {
        // Step in pixel increments so fast entities still hug the wall.
        const step = Math.sign(dx);
        let moved = 0;
        while (Math.abs(moved) < Math.abs(dx) && !this.boxBlocked(entity.x + step, entity.y, entity.w, entity.h)) {
          entity.x += step;
          moved += step;
        }
        result.hitX = true;
      }
    }
    if (dy !== 0) {
      const ny = entity.y + dy;
      if (!this.boxBlocked(entity.x, ny, entity.w, entity.h)) {
        entity.y = ny;
      } else {
        const step = Math.sign(dy);
        let moved = 0;
        while (Math.abs(moved) < Math.abs(dy) && !this.boxBlocked(entity.x, entity.y + step, entity.w, entity.h)) {
          entity.y += step;
          moved += step;
        }
        result.hitY = true;
      }
    }
    return result;
  }

  /** Straight-line visibility used by the companions to avoid shooting walls. */
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.tilemap.solidAtPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  entitiesOfKind(kind: Entity['kind']): Entity[] {
    return this.entities.filter((e) => e.kind === kind && e.alive);
  }

  nearest(kind: Entity['kind'], x: number, y: number, maxDist: number, filter?: (e: Entity) => boolean): Entity | null {
    let best: Entity | null = null;
    let bestD = maxDist * maxDist;
    for (const e of this.entities) {
      if (e.kind !== kind || !e.alive) continue;
      if (filter && !filter(e)) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  overlapping(box: HitBox, kind: Entity['kind']): Entity[] {
    const out: Entity[] = [];
    for (const e of this.entities) {
      if (e.kind !== kind || !e.alive) continue;
      if (rectsOverlap(box.x, box.y, box.w, box.h, e.left, e.top, e.w, e.h)) out.push(e);
    }
    return out;
  }

  /* ------------------------------------------------------------ rendering */

  collectLights(): LightSource[] {
    const lights: LightSource[] = [];
    const camX = this.camera.renderX;
    const camY = this.camera.renderY;
    for (const prop of this.props) {
      const l = prop.def.light;
      if (!l || prop.hidden) continue;
      const x = prop.x + l.x;
      const y = prop.y + l.y;
      if (x < camX - 120 || x > camX + GAME_WIDTH + 120 || y < camY - 120 || y > camY + GAME_HEIGHT + 120) continue;
      lights.push({ x, y, radius: l.radius, color: l.color, flicker: prop.name === 'torch' ? 0.08 : 0.03 });
    }
    return lights;
  }

  /** Y-sorted pass over props and entities so everything overlaps correctly. */
  drawSorted(ctx: Ctx2D, camX: number, camY: number): void {
    type Drawable = { depth: number; draw: () => void };
    const list: Drawable[] = [];

    for (const prop of this.props) {
      if (prop.hidden) continue;
      const { def } = prop;
      if (
        prop.x + def.w < camX - 32 ||
        prop.x > camX + GAME_WIDTH + 32 ||
        prop.y + def.h < camY - 32 ||
        prop.y > camY + GAME_HEIGHT + 32
      ) {
        continue;
      }
      list.push({
        depth: prop.y + def.anchorY,
        draw: () => prop.animator.draw(ctx, prop.x - camX, prop.y - camY),
      });
    }

    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e.x < camX - 64 || e.x > camX + GAME_WIDTH + 64 || e.y < camY - 80 || e.y > camY + GAME_HEIGHT + 80) {
        continue;
      }
      list.push({ depth: e.depth, draw: () => e.draw(ctx, camX, camY) });
    }

    list.sort((a, b) => a.depth - b.depth);
    for (const item of list) item.draw();
  }
}

/** Soft blob shadow shared by every character. */
export function drawShadow(ctx: Ctx2D, x: number, y: number, radius: number, alpha = 0.35): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), radius, Math.max(1, radius * 0.42), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
