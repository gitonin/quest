import { Animator, type AnimClip } from '../gfx/sprites';
import type { Ctx2D } from '../gfx/renderer';
import { Entity, type EntityKind } from './entity';
import type { Character, DamageInfo } from './character';

export interface ProjectileOptions {
  clip: AnimClip;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  damage: number;
  range: number;
  /** Which side may be hurt by this projectile. */
  target: 'enemy' | 'hero';
  knockback?: number;
  status?: DamageInfo['status'];
  color?: string;
  /** Projectiles from the void can be swallowed by black holes. */
  absorbable?: boolean;
  onHit?: (victim: Character) => void;
}

/**
 * Straight-flying magic bolt or spit. Collides with solid tiles and with any
 * character of the opposite side.
 */
export class Projectile extends Entity {
  readonly kind: EntityKind = 'projectile';
  private animator: Animator;
  private opts: ProjectileOptions;
  private travelled = 0;
  private halfW: number;
  private halfH: number;
  absorbable: boolean;

  constructor(opts: ProjectileOptions) {
    super();
    this.opts = opts;
    this.x = opts.x;
    this.y = opts.y;
    this.w = 6;
    this.h = 6;
    this.depthBias = 6;
    this.absorbable = opts.absorbable ?? true;
    const len = Math.hypot(opts.dirX, opts.dirY) || 1;
    this.vx = (opts.dirX / len) * opts.speed;
    this.vy = (opts.dirY / len) * opts.speed;
    this.animator = new Animator({ main: opts.clip }, 'main');
    this.halfW = opts.clip.strip.frameW / 2;
    this.halfH = opts.clip.strip.frameH / 2;
  }

  /** Black holes bend projectiles towards them instead of blocking them. */
  applyPull(x: number, y: number, strength: number, dt: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    this.vx += (dx / len) * strength * dt;
    this.vy += (dy / len) * strength * dt;
  }

  update(dt: number): void {
    this.animator.update(dt);
    const step = Math.hypot(this.vx, this.vy) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.travelled += step;

    if (this.travelled > this.opts.range) {
      this.alive = false;
      return;
    }
    if (this.world.tilemap.solidAtPx(this.x, this.y)) {
      this.burst();
      return;
    }

    const kinds: Array<Entity['kind']> = this.opts.target === 'enemy' ? ['enemy'] : ['player', 'companion'];
    for (const kind of kinds) {
      const hits = this.world.overlapping({ x: this.x - 4, y: this.y - 6, w: 8, h: 10 }, kind);
      for (const hit of hits) {
        const victim = hit as Character;
        if (victim.isDead) continue;
        const dealt = victim.applyDamage({
          amount: this.opts.damage,
          fromX: this.x,
          fromY: this.y,
          knockback: this.opts.knockback ?? 45,
          status: this.opts.status,
        });
        if (dealt) {
          this.opts.onHit?.(victim);
          this.burst();
          return;
        }
      }
    }
  }

  private burst(): void {
    this.alive = false;
    this.world.particles.emit('magic', this.x, this.y, 6, { speed: 45, color: this.opts.color });
  }

  draw(ctx: Ctx2D, camX: number, camY: number): void {
    this.animator.draw(ctx, this.x - camX - this.halfW, this.y - camY - this.halfH);
  }
}
