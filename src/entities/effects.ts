import { Animator, type AnimClip } from '../gfx/sprites';
import { font } from '../gfx/font';
import type { Ctx2D } from '../gfx/renderer';
import { Entity, type EntityKind } from './entity';

/** One-shot animation (slash, impact, heal burst) that despawns when finished. */
export class OneShotFx extends Entity {
  readonly kind: EntityKind = 'projectile';
  private animator: Animator;
  private offsetX: number;
  private offsetY: number;
  private flip: boolean;
  private life: number;

  constructor(clip: AnimClip, x: number, y: number, opts: { flip?: boolean; depthBias?: number; life?: number } = {}) {
    super();
    this.x = x;
    this.y = y;
    this.w = 0;
    this.h = 0;
    this.animator = new Animator({ main: { ...clip, loop: false } }, 'main');
    this.offsetX = -clip.strip.frameW / 2;
    this.offsetY = -clip.strip.frameH / 2;
    this.flip = opts.flip ?? false;
    this.depthBias = opts.depthBias ?? 4;
    const frames = clip.order ? clip.order.length : clip.strip.count;
    this.life = opts.life ?? frames / clip.fps;
  }

  update(dt: number): void {
    this.animator.update(dt);
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx: Ctx2D, camX: number, camY: number): void {
    this.animator.draw(ctx, this.x - camX + this.offsetX, this.y - camY + this.offsetY, this.flip);
  }
}

/** Damage / heal numbers popping above a target. */
export class FloatingText extends Entity {
  readonly kind: EntityKind = 'projectile';
  private text: string;
  private color: string;
  private life = 0.75;
  private vy0 = -34;

  constructor(text: string, x: number, y: number, color = '#ffffff') {
    super();
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.depthBias = 200;
  }

  update(dt: number): void {
    this.life -= dt;
    this.y += this.vy0 * dt;
    this.vy0 += 60 * dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx: Ctx2D, camX: number, camY: number): void {
    ctx.globalAlpha = Math.min(1, this.life * 3);
    font.drawCentered(ctx, this.text, this.x - camX, this.y - camY, this.color);
    ctx.globalAlpha = 1;
  }
}
