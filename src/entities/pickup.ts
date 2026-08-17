import { ITEMS } from '../data/items';
import { Animator } from '../gfx/sprites';
import type { Ctx2D } from '../gfx/renderer';
import { Entity, type EntityKind } from './entity';

/** Item lying on the ground. Walk over it to collect it. */
export class Pickup extends Entity {
  readonly kind: EntityKind = 'pickup';
  readonly itemId: string;
  private animator: Animator | null = null;
  private bob = 0;
  private life = 26;
  private spawnPop = 0.35;

  constructor(itemId: string, x: number, y: number) {
    super();
    this.itemId = itemId;
    this.x = x;
    this.y = y;
    this.w = 10;
    this.h = 10;
  }

  override onSpawn(): void {
    const item = ITEMS[this.itemId];
    const clip = this.world.assets.fx[item?.fx ?? 'orb'];
    this.animator = new Animator({ main: clip }, 'main');
  }

  update(dt: number): void {
    this.animator?.update(dt);
    this.bob += dt * 4;
    this.spawnPop = Math.max(0, this.spawnPop - dt);
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx: Ctx2D, camX: number, camY: number): void {
    if (!this.animator) return;
    const { w, h } = this.animator.frameSize;
    const lift = Math.sin(this.bob) * 1.5 + this.spawnPop * 14;
    ctx.globalAlpha = this.life < 4 && Math.floor(this.life * 8) % 2 === 0 ? 0.35 : 1;
    this.animator.draw(ctx, this.x - camX - w / 2, this.y - camY - h - lift);
    ctx.globalAlpha = 1;
  }
}
