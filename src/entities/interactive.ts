import { dist } from '../core/math';
import { ITEMS } from '../data/items';
import { font } from '../gfx/font';
import { Animator, type AnimBank, type AnimClip } from '../gfx/sprites';
import type { Ctx2D } from '../gfx/renderer';
import { Entity, type EntityKind } from './entity';
import { drawShadow } from '../systems/world';

/**
 * Anything the player can walk up to and press the action button on: chests,
 * signs, doors, NPCs, quest objects. A single class keeps the interaction
 * prompt, the radius test and the "already used" bookkeeping in one place.
 */
export class Interactive extends Entity {
  readonly kind: EntityKind = 'interactive';
  radius = 26;
  prompt = '';
  used = false;
  /** Fires as soon as the player steps inside, without pressing anything. */
  autoTrigger = false;
  /** Stable id so the save file can remember it was used. */
  id: string;
  onInteract: (() => void) | null = null;
  private clip: AnimClip | null = null;
  private animator: Animator | null = null;
  private drawW = 0;
  private drawH = 0;
  showPrompt = false;

  constructor(id: string, x: number, y: number) {
    super();
    this.id = id;
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 10;
  }

  setSprite(clip: AnimClip, anchorY?: number): this {
    this.clip = clip;
    this.animator = new Animator({ main: clip }, 'main');
    this.drawW = clip.strip.frameW;
    this.drawH = anchorY ?? clip.strip.frameH;
    return this;
  }

  canInteract(px: number, py: number): boolean {
    return !this.used && dist(this.x, this.y, px, py) <= this.radius;
  }

  interact(): void {
    if (this.used) return;
    this.onInteract?.();
  }

  update(dt: number): void {
    this.animator?.update(dt);
  }

  draw(ctx: Ctx2D, camX: number, camY: number): void {
    if (this.animator && this.clip) {
      this.animator.draw(ctx, this.x - camX - this.drawW / 2, this.y - camY - this.drawH);
    }
    if (this.showPrompt && !this.used) {
      const y = this.y - camY - this.drawH - 12;
      const bob = Math.sin(performance.now() / 220) * 1.5;
      font.drawCentered(ctx, this.prompt || 'A', this.x - camX, y + bob, '#f4f0e4');
    }
  }
}

/** Chest holding one item, with an open/closed sprite swap. */
export class Chest extends Interactive {
  readonly itemId: string;
  private openClip: AnimClip;

  constructor(id: string, x: number, y: number, itemId: string, closed: AnimClip, open: AnimClip) {
    super(id, x, y);
    this.itemId = itemId;
    this.openClip = open;
    this.prompt = 'OUVRIR';
    this.radius = 24;
    this.setSprite(closed, 17);
  }

  open(): void {
    if (this.used) return;
    this.used = true;
    this.setSprite(this.openClip, 17);
    this.world.particles.emit('spark', this.x, this.y - 12, 16, { speed: 60, color: '#ffe9a8' });
  }

  get itemName(): string {
    return ITEMS[this.itemId]?.name ?? this.itemId;
  }
}

/** Non-hostile character (future ally, villager) standing in the world. */
export class Npc extends Interactive {
  private bankAnimator: Animator;
  private offsetX: number;
  private offsetY: number;

  constructor(id: string, x: number, y: number, bank: AnimBank, facing = 'down') {
    super(id, x, y);
    this.bankAnimator = new Animator(bank, `idle_${facing}`);
    this.offsetX = -10;
    this.offsetY = -22;
    this.prompt = 'PARLER';
    this.radius = 30;
  }

  override update(dt: number): void {
    this.bankAnimator.update(dt);
  }

  override draw(ctx: Ctx2D, camX: number, camY: number): void {
    drawShadow(ctx, this.x - camX, this.y - camY, 6);
    this.bankAnimator.draw(ctx, this.x - camX + this.offsetX, this.y - camY + this.offsetY);
    if (this.showPrompt && !this.used) {
      const bob = Math.sin(performance.now() / 220) * 1.5;
      font.drawCentered(ctx, this.prompt, this.x - camX, this.y - camY - 34 + bob, '#f4f0e4');
    }
  }
}
