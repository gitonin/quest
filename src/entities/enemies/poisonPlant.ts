import { dist } from '../../core/math';
import { SPELLS } from '../../data/spells';
import { Projectile } from '../projectile';
import type { Character } from '../character';
import { Enemy } from '../enemy';
import type { AnimBank } from '../../gfx/sprites';

/**
 * Rooted ambusher of world 1.
 *
 * Close up it lashes with its tentacles; further away it spits a toxic bolt
 * that leaves poison on the target. It never moves, so it teaches the player to
 * respect attack ranges.
 */
export class PoisonPlant extends Enemy {
  private spitCooldown = 2;

  constructor(bank: AnimBank, world: number, level = 1) {
    super('poisonPlant', bank, world, level);
  }

  protected override think(dt: number): void {
    this.spitCooldown = Math.max(0, this.spitCooldown - dt);
    const target = this.target;
    if (!target) {
      this.playState('idle');
      return;
    }
    const d = dist(this.x, this.y, target.x, target.y);
    this.faceTowards(target.x, target.y);

    if (d <= this.def.attackRange && this.attackCooldown <= 0) {
      this.beginAttack(target);
      return;
    }
    if (d <= this.def.aggroRadius && this.spitCooldown <= 0 && this.world.hasLineOfSight(this.x, this.y - 12, target.x, target.y - 6)) {
      this.spit(target);
      return;
    }
    this.playState('idle');
  }

  private spit(target: Character): void {
    const spell = SPELLS.poisonSpit;
    this.spitCooldown = spell.cooldown;
    this.attackTimer = 0.4;
    this.playState('attack', true);
    this.scheduleHit(0.24, () => {
      if (this.isDead) return;
      this.world.add(
        new Projectile({
          clip: this.world.assets.fx.spit,
          x: this.x,
          y: this.y - 14,
          dirX: target.x - this.x,
          dirY: target.y - 6 - (this.y - 14),
          speed: spell.speed ?? 90,
          damage: this.attack * 0.8,
          range: spell.range,
          target: 'hero',
          status: spell.status,
          color: '#8fd76a',
        }),
      );
      this.world.particles.emit('poison', this.x, this.y - 16, 5, { speed: 30 });
    });
  }

  protected override performAttack(target: Character): void {
    // Tentacle lash: a wide, slightly delayed hit right in front of the bulb.
    const damage = this.attack;
    this.scheduleHit(0.2, () => {
      if (this.isDead || target.isDead) return;
      if (dist(this.x, this.y, target.x, target.y) > this.def.attackRange + 10) return;
      target.applyDamage({
        amount: damage,
        fromX: this.x,
        fromY: this.y,
        knockback: 110,
        status: { kind: 'poison', duration: 2, power: 1.5 },
      });
      this.world.particles.emit('poison', target.x, target.y - 8, 6, { speed: 40 });
      this.world.camera.shake(0.18);
    });
  }
}
