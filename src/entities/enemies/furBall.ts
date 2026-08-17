import { dist } from '../../core/math';
import type { AnimBank } from '../../gfx/sprites';
import type { Character } from '../character';
import { Enemy } from '../enemy';

const CHARGE_WINDUP = 0.35;
const CHARGE_SPEED = 210;
const CHARGE_TIME = 0.45;

/**
 * Fast biter of world 1-2.
 *
 * Loops: creep towards the party, wind up, charge in a straight line, bite,
 * then bounce back to safety. The recoil gives the player a window to punish -
 * that rhythm is the whole point of the encounter.
 */
export class FurBall extends Enemy {
  private windup = 0;
  private charging = 0;
  private chargeX = 0;
  private chargeY = 0;
  private recoil = 0;

  constructor(bank: AnimBank, world: number, level = 1) {
    super('furBall', bank, world, level);
  }

  protected override think(dt: number): void {
    if (this.recoil > 0) {
      this.recoil -= dt;
      this.world.moveEntity(this, this.vx * dt, this.vy * dt);
      this.vx *= 0.9;
      this.vy *= 0.9;
      this.playState('idle');
      return;
    }
    if (this.charging > 0) {
      this.updateCharge(dt);
      return;
    }
    if (this.windup > 0) {
      this.windup -= dt;
      this.playState('attack');
      if (this.windup <= 0) {
        this.charging = CHARGE_TIME;
        const target = this.target;
        if (target) {
          const len = Math.hypot(target.x - this.x, target.y - this.y) || 1;
          this.chargeX = (target.x - this.x) / len;
          this.chargeY = (target.y - this.y) / len;
        }
        this.world.particles.emit('dust', this.x, this.y, 6, { speed: 40 });
      }
      return;
    }

    const target = this.target;
    if (!target) {
      this.idleWander(dt);
      return;
    }
    const d = dist(this.x, this.y, target.x, target.y);
    this.faceTowards(target.x, target.y);
    if (d < this.def.attackRange * 3.2 && this.attackCooldown <= 0) {
      this.windup = CHARGE_WINDUP;
      this.attackCooldown = this.def.attackCooldown;
      this.playState('attack', true);
      return;
    }
    if (d < this.def.aggroRadius) {
      this.moveTowards(target.x, target.y, this.speed, dt);
      this.playState('walk');
    } else {
      this.idleWander(dt);
    }
  }

  private updateCharge(dt: number): void {
    this.charging -= dt;
    this.playState('walk');
    const move = this.world.moveEntity(this, this.chargeX * CHARGE_SPEED * dt, this.chargeY * CHARGE_SPEED * dt);
    if (Math.random() < dt * 20) this.world.particles.emit('dust', this.x, this.y, 1, { speed: 30 });

    const target = this.target;
    if (target && !target.isDead && dist(this.x, this.y, target.x, target.y) < this.def.attackRange) {
      this.bite(target);
      return;
    }
    if (move.hitX || move.hitY || this.charging <= 0) {
      this.endCharge();
    }
  }

  private bite(target: Character): void {
    target.applyDamage({ amount: this.attack, fromX: this.x, fromY: this.y, knockback: 130 });
    this.world.camera.shake(0.22);
    this.world.particles.emit('spark', target.x, target.y - 8, 6, { speed: 60, color: '#fdf6e3' });
    this.endCharge();
  }

  private endCharge(): void {
    this.charging = 0;
    this.recoil = 0.45;
    // Bounce backwards after the bite.
    this.vx = -this.chargeX * 90;
    this.vy = -this.chargeY * 90;
    this.playState('idle', true);
  }
}
