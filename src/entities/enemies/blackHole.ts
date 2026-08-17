import { dist } from '../../core/math';
import { SPELLS } from '../../data/spells';
import type { AnimBank } from '../../gfx/sprites';
import { burst } from '../../systems/combat';
import type { Character } from '../character';
import { Enemy } from '../enemy';
import { Projectile } from '../projectile';
import type { Ctx2D } from '../../gfx/renderer';

const PULL_RADIUS = 92;
const PULL_FORCE = 62;

/**
 * Signature monster of world 3.
 *
 * It never stops spinning, drags the whole party (and their projectiles) into
 * its centre, and vents the stored energy as a burst. Fighting it is about
 * fighting the pull, not just its HP bar.
 */
export class BlackHole extends Enemy {
  private charge = 0;
  private burstCooldown = 3;

  constructor(bank: AnimBank, world: number, level = 1) {
    super('blackHole', bank, world, level);
  }

  protected override think(dt: number): void {
    this.burstCooldown = Math.max(0, this.burstCooldown - dt);
    this.applyGravity(dt);

    const target = this.target;
    if (!target) {
      this.idleWander(dt);
      this.playState('idle');
      return;
    }

    const d = dist(this.x, this.y, target.x, target.y);
    if (d < this.def.attackRange && this.burstCooldown <= 0) {
      this.vent();
      return;
    }
    // Drifts slowly towards the party - it is a hazard, not a chaser.
    this.moveTowards(target.x, target.y, this.speed, dt);
    this.playState(this.charge > 0.5 ? 'walk' : 'idle');
  }

  /** Pulls characters, pickups and projectiles towards the singularity. */
  private applyGravity(dt: number): void {
    this.charge = Math.min(1, this.charge + dt * 0.25);
    for (const entity of this.world.entities) {
      if (entity === this || !entity.alive) continue;
      const d = dist(this.x, this.y, entity.x, entity.y);
      if (d > PULL_RADIUS || d < 1) continue;
      const falloff = 1 - d / PULL_RADIUS;

      if (entity.kind === 'projectile' && entity instanceof Projectile) {
        if (entity.absorbable) entity.applyPull(this.x, this.y, PULL_FORCE * 3 * falloff, dt);
        if (d < 10) entity.alive = false;
        continue;
      }
      if (entity.kind === 'player' || entity.kind === 'companion' || entity.kind === 'pickup') {
        const dx = (this.x - entity.x) / d;
        const dy = (this.y - entity.y) / d;
        this.world.moveEntity(entity, dx * PULL_FORCE * falloff * dt, dy * PULL_FORCE * falloff * dt);
      }
    }
    if (Math.random() < dt * 14) {
      const ang = Math.random() * Math.PI * 2;
      this.world.particles.emit('magic', this.x + Math.cos(ang) * 30, this.y + Math.sin(ang) * 26, 1, {
        dirX: -Math.cos(ang),
        dirY: -Math.sin(ang),
        speed: 55,
        color: '#b06cf5',
      });
    }
  }

  private vent(): void {
    const spell = SPELLS.voidBurst;
    this.burstCooldown = spell.cooldown;
    this.attackTimer = 0.5;
    this.charge = 0;
    this.playState('attack', true);
    this.isTelegraphing = true;
    this.scheduleHit(0.3, () => {
      this.isTelegraphing = false;
      if (this.isDead) return;
      burst(this.world, this.x, this.y - this.h / 2, spell.radius ?? 56, this.attack, 'hero', {
        knockback: 190,
        color: '#b06cf5',
      });
      this.world.camera.shake(0.5);
    });
  }

  protected override performAttack(_target: Character): void {
    // The vent replaces the default melee entirely.
  }

  override draw(ctx: Ctx2D, camX: number, camY: number): void {
    // Event horizon ring so the player can read the pull radius.
    ctx.globalAlpha = 0.16 + this.charge * 0.1;
    ctx.strokeStyle = '#b06cf5';
    ctx.beginPath();
    ctx.ellipse(this.x - camX, this.y - camY - 6, PULL_RADIUS * 0.85, PULL_RADIUS * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    super.draw(ctx, camX, camY);
  }
}
