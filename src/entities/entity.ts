import type { Ctx2D } from '../gfx/renderer';
import type { World } from '../systems/world';

export type EntityKind = 'player' | 'companion' | 'enemy' | 'projectile' | 'pickup' | 'npc' | 'interactive';

/**
 * Base of everything that lives in a level.
 *
 * `x`/`y` are the entity's feet (its ground contact point), which is what the
 * whole game sorts, collides and casts shadows from.
 */
export abstract class Entity {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** Collision box, centred on x and rising h pixels above y. */
  w = 10;
  h = 8;
  alive = true;
  abstract readonly kind: EntityKind;
  world!: World;
  /** Overrides the depth used for y-sorting when set. */
  depthBias = 0;

  get depth(): number {
    return this.y + this.depthBias;
  }

  onSpawn(): void {}
  onDespawn(): void {}

  abstract update(dt: number): void;
  abstract draw(ctx: Ctx2D, camX: number, camY: number): void;

  /** Convenience AABB in world space. */
  get left(): number {
    return this.x - this.w / 2;
  }
  get right(): number {
    return this.x + this.w / 2;
  }
  get top(): number {
    return this.y - this.h;
  }
  get bottom(): number {
    return this.y;
  }
  /** Centre of mass, used for aiming and FX. */
  get cx(): number {
    return this.x;
  }
  get cy(): number {
    return this.y - this.h / 2;
  }
}
