import { dist } from '../../core/math';
import { SPELLS } from '../../data/spells';
import type { AnimBank } from '../../gfx/sprites';
import { burst } from '../../systems/combat';
import type { Character } from '../character';
import { Enemy } from '../enemy';
import { Projectile } from '../projectile';

/**
 * Boss of world 2 - the stone guardian of the treasure room.
 *
 * Three-phase pattern: telegraphed slam, a dash across the room, and a brief
 * exhausted window where it takes extra damage. `isTelegraphing` /
 * `isVulnerable` are read by the companion AI, which is how the party learns to
 * back off during wind-ups.
 */
export class StoneGuardian extends Enemy {
  private phase = 0;
  private phaseTimer = 1.2;
  private dashX = 0;
  private dashY = 0;

  constructor(bank: AnimBank, world: number, level = 1) {
    super('gargoyle', bank, world, level);
  }

  protected override think(dt: number): void {
    this.phaseTimer -= dt;
    const target = this.target;
    if (!target) {
      this.playState('idle');
      return;
    }
    const d = dist(this.x, this.y, target.x, target.y);
    this.faceTowards(target.x, target.y);

    switch (this.phase) {
      case 0: // approach
        this.isTelegraphing = false;
        this.isVulnerable = true;
        this.moveTowards(target.x, target.y, this.speed, dt);
        this.playState('walk');
        if (d < this.def.attackRange || this.phaseTimer <= 0) this.enterPhase(1, 0.75);
        break;

      case 1: // wind-up
        this.isTelegraphing = true;
        this.playState('attack');
        this.world.particles.emit('ember', this.x, this.y - 10, 1, { speed: 20, color: '#ffb03a' });
        if (this.phaseTimer <= 0) {
          const useDash = this.hp / this.maxHp < 0.6 && d > this.def.attackRange * 1.5;
          if (useDash) {
            const len = Math.hypot(target.x - this.x, target.y - this.y) || 1;
            this.dashX = (target.x - this.x) / len;
            this.dashY = (target.y - this.y) / len;
            this.enterPhase(3, 0.6);
          } else {
            this.slam();
            this.enterPhase(2, 1.4);
          }
        }
        break;

      case 2: // exhausted window
        this.isTelegraphing = false;
        this.isVulnerable = true;
        this.playState('idle');
        if (this.phaseTimer <= 0) this.enterPhase(0, 2.4);
        break;

      case 3: // dash
        this.isTelegraphing = false;
        this.playState('walk');
        {
          const move = this.world.moveEntity(this, this.dashX * 190 * dt, this.dashY * 190 * dt);
          if (dist(this.x, this.y, target.x, target.y) < this.def.attackRange) {
            target.applyDamage({ amount: this.attack, fromX: this.x, fromY: this.y, knockback: 170 });
            this.enterPhase(2, 1.2);
          } else if (move.hitX || move.hitY || this.phaseTimer <= 0) {
            this.enterPhase(2, 1);
          }
        }
        break;
    }
  }

  private enterPhase(phase: number, duration: number): void {
    this.phase = phase;
    this.phaseTimer = duration;
  }

  private slam(): void {
    this.playState('attack', true);
    burst(this.world, this.x, this.y, this.def.attackRange + 18, this.attack, 'hero', {
      knockback: 180,
      color: '#ffb03a',
    });
    this.world.camera.shake(0.7);
    this.world.particles.emit('dust', this.x, this.y, 18, { speed: 90 });
  }

  protected override performAttack(_target: Character): void {}
}

/**
 * Final boss - the star devourer.
 *
 * Alternates a gravity well that drags the party in, a radial star-fall, and
 * homing void shards. Its vulnerable window opens right after the star-fall.
 */
export class StarDevourer extends Enemy {
  private phase = 0;
  private phaseTimer = 1.5;
  private orbit = 0;

  constructor(bank: AnimBank, world: number, level = 1) {
    super('devourer', bank, world, level);
  }

  protected override think(dt: number): void {
    this.phaseTimer -= dt;
    this.orbit += dt;
    const target = this.target;
    if (!target) {
      this.playState('idle');
      return;
    }

    switch (this.phase) {
      case 0: // drift + gravity well
        this.isTelegraphing = false;
        this.isVulnerable = true;
        this.playState('idle');
        this.pull(dt, 70, 46);
        this.moveTowards(target.x, target.y, this.speed * 0.6, dt);
        if (this.phaseTimer <= 0) this.enterPhase(1, 0.8);
        break;

      case 1: // star-fall wind-up
        this.isTelegraphing = true;
        this.isVulnerable = false;
        this.playState('attack');
        this.pull(dt, 120, 60);
        if (this.phaseTimer <= 0) {
          this.starFall();
          this.enterPhase(2, 1.6);
        }
        break;

      case 2: // vulnerable
        this.isTelegraphing = false;
        this.isVulnerable = true;
        this.playState('idle');
        if (this.phaseTimer <= 0) this.enterPhase(3, 2.2);
        break;

      case 3: // shard volley
        this.isTelegraphing = false;
        this.playState('walk');
        if (Math.random() < dt * 4) this.shard(target);
        if (this.phaseTimer <= 0) this.enterPhase(0, 2.6);
        break;
    }
  }

  private enterPhase(phase: number, duration: number): void {
    this.phase = phase;
    this.phaseTimer = duration;
  }

  private pull(dt: number, radius: number, force: number): void {
    for (const kind of ['player', 'companion'] as const) {
      for (const entity of this.world.entitiesOfKind(kind)) {
        const d = dist(this.x, this.y, entity.x, entity.y);
        if (d > radius || d < 2) continue;
        const falloff = 1 - d / radius;
        this.world.moveEntity(
          entity,
          ((this.x - entity.x) / d) * force * falloff * dt,
          ((this.y - entity.y) / d) * force * falloff * dt,
        );
      }
    }
  }

  private starFall(): void {
    const spell = SPELLS.starFall;
    this.world.camera.shake(0.8);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + this.orbit;
      this.scheduleHit(0.08 * i, () => {
        if (this.isDead) return;
        burst(
          this.world,
          this.x + Math.cos(ang) * 46,
          this.y + Math.sin(ang) * 38,
          spell.radius ?? 40,
          this.attack * 0.7,
          'hero',
          { knockback: 120, color: '#8fe3ff' },
        );
      });
    }
  }

  private shard(target: Character): void {
    this.world.add(
      new Projectile({
        clip: this.world.assets.fx.voidBall,
        x: this.x,
        y: this.y - this.h,
        dirX: target.x - this.x,
        dirY: target.y - 8 - (this.y - this.h),
        speed: 118,
        damage: this.attack * 0.65,
        range: 220,
        target: 'hero',
        color: '#b06cf5',
        absorbable: false,
      }),
    );
  }

  protected override performAttack(_target: Character): void {}
}
