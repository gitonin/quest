import { COMBAT } from '../core/config';
import { clamp, facingFromVector, type Facing } from '../core/math';
import { Animator, type AnimBank } from '../gfx/sprites';
import type { Ctx2D } from '../gfx/renderer';
import { Entity } from './entity';
import { drawShadow } from '../systems/world';

export type CharState =
  | 'idle'
  | 'walk'
  | 'attack'
  | 'charge'
  | 'charged'
  | 'cast'
  | 'hurt'
  | 'dodge'
  | 'dead';

export interface StatusEffects {
  poison: { time: number; power: number };
  slow: { time: number; power: number };
  stun: { time: number };
  shield: { time: number; amount: number };
}

export interface DamageInfo {
  amount: number;
  fromX: number;
  fromY: number;
  knockback?: number;
  /** Skips the invulnerability window (damage over time). */
  ignoreInvuln?: boolean;
  status?: { kind: 'poison' | 'slow' | 'stun'; duration: number; power?: number };
}

/**
 * Anything with HP that walks and fights: heroes, companions and monsters all
 * derive from this. It owns the state machine, the hit reaction, the status
 * effects and the shared rendering (shadow + blink while invulnerable).
 */
export abstract class Character extends Entity {
  animator: Animator;
  facing: Facing = 'down';
  state: CharState = 'idle';
  level = 1;
  xp = 0;

  hp = 10;
  maxHp = 10;
  mp = 0;
  maxMp = 0;
  attack = 1;
  magic = 0;
  defense = 0;
  speed = 60;

  invuln = 0;
  hurtTimer = 0;
  /** Fractional damage-over-time carried between frames. */
  private dotDebt = 0;
  knockX = 0;
  knockY = 0;
  deathTimer = 0;
  /** Sprite anchor offset relative to the feet. */
  drawOffsetX = -10;
  drawOffsetY = -22;
  shadowRadius = 6;
  /** Direction-less monsters use a single set of clips. */
  directional = true;

  status: StatusEffects = {
    poison: { time: 0, power: 0 },
    slow: { time: 0, power: 0 },
    stun: { time: 0 },
    shield: { time: 0, amount: 0 },
  };

  constructor(bank: AnimBank, directional: boolean) {
    super();
    this.directional = directional;
    this.animator = new Animator(bank, directional ? 'idle_down' : 'idle');
  }

  get isDead(): boolean {
    return this.state === 'dead';
  }

  /** Resolves `<state>_<facing>` with a graceful fallback. */
  protected playState(state: CharState, restart = false): void {
    this.state = state;
    const key = this.directional ? `${state}_${this.facing}` : state;
    if (this.animator.has(key)) this.animator.play(key, restart);
    else if (this.animator.has(state)) this.animator.play(state, restart);
  }

  faceTowards(x: number, y: number): void {
    this.facing = facingFromVector(x - this.x, y - this.y, this.facing);
  }

  get speedMultiplier(): number {
    let m = 1;
    if (this.status.slow.time > 0) m *= 1 - this.status.slow.power;
    const tile = this.world?.tilemap.defAtPx(this.x, this.y);
    if (tile?.drag) m *= tile.drag;
    return m;
  }

  applyDamage(info: DamageInfo): boolean {
    if (this.isDead) return false;
    if (this.invuln > 0 && !info.ignoreInvuln) return false;
    // Damage over time arrives in fractions of a point every frame; it must not
    // go through the "at least 1 damage" floor of a real hit, or a 3 dps swamp
    // would deal 3 damage *per frame*.
    if (info.ignoreInvuln) return this.applyTickDamage(info);

    let amount = Math.max(1, info.amount - this.defense * 0.5);
    if (this.status.shield.time > 0 && this.status.shield.amount > 0) {
      const absorbed = Math.min(this.status.shield.amount, amount);
      this.status.shield.amount -= absorbed;
      amount -= absorbed;
      if (this.status.shield.amount <= 0) this.status.shield.time = 0;
    }
    amount = Math.round(amount);
    if (amount <= 0) return false;

    this.hp = clamp(this.hp - amount, 0, this.maxHp);
    if (!info.ignoreInvuln) {
      this.invuln = COMBAT.invulnerableAfterHit;
      this.hurtTimer = 0.22;
      this.playState('hurt', true);
    }

    const kb = info.knockback ?? 60;
    if (kb > 0) {
      const dx = this.x - info.fromX;
      const dy = this.y - info.fromY;
      const len = Math.hypot(dx, dy) || 1;
      this.knockX += (dx / len) * kb;
      this.knockY += (dy / len) * kb;
    }

    if (info.status) this.applyStatus(info.status);
    this.onDamaged(amount, info);
    if (this.hp <= 0) this.die();
    return true;
  }

  /** Accumulates sub-point damage until it is worth a whole point of HP. */
  private applyTickDamage(info: DamageInfo): boolean {
    this.dotDebt += Math.max(0, info.amount - this.defense * 0.02);
    if (this.dotDebt < 1) return false;
    const whole = Math.floor(this.dotDebt);
    this.dotDebt -= whole;
    this.hp = clamp(this.hp - whole, 0, this.maxHp);
    this.onDamaged(whole, info);
    if (this.hp <= 0) this.die();
    return true;
  }

  applyStatus(status: { kind: 'poison' | 'slow' | 'stun'; duration: number; power?: number }): void {
    switch (status.kind) {
      case 'poison':
        this.status.poison.time = Math.max(this.status.poison.time, status.duration);
        this.status.poison.power = Math.max(this.status.poison.power, status.power ?? 2);
        break;
      case 'slow':
        this.status.slow.time = Math.max(this.status.slow.time, status.duration);
        this.status.slow.power = clamp(status.power ?? 0.4, 0, 0.85);
        break;
      case 'stun':
        this.status.stun.time = Math.max(this.status.stun.time, status.duration);
        break;
    }
  }

  heal(amount: number): number {
    const before = this.hp;
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
    return this.hp - before;
  }

  restoreMp(amount: number): void {
    this.mp = clamp(this.mp + amount, 0, this.maxMp);
  }

  protected onDamaged(_amount: number, _info: DamageInfo): void {}
  protected onDeath(): void {}

  die(): void {
    if (this.isDead) return;
    this.hp = 0;
    this.state = 'dead';
    this.deathTimer = 0;
    this.playState('dead', true);
    const key = this.directional ? `die_${this.facing}` : 'die';
    if (this.animator.has(key)) this.animator.play(key, true);
    else if (this.animator.has('die')) this.animator.play('die', true);
    this.onDeath();
  }

  /** Shared per-frame bookkeeping: timers, statuses, knockback, animation. */
  protected updateCommon(dt: number): void {
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.status.slow.time = Math.max(0, this.status.slow.time - dt);
    this.status.stun.time = Math.max(0, this.status.stun.time - dt);
    this.status.shield.time = Math.max(0, this.status.shield.time - dt);
    if (this.status.shield.time <= 0) this.status.shield.amount = 0;

    if (this.status.poison.time > 0) {
      this.status.poison.time = Math.max(0, this.status.poison.time - dt);
      this.applyDamage({
        amount: this.status.poison.power * dt,
        fromX: this.x,
        fromY: this.y,
        knockback: 0,
        ignoreInvuln: true,
      });
      if (Math.random() < dt * 6) {
        this.world.particles.emit('poison', this.x, this.y - this.h, 1, { speed: 14 });
      }
    }

    // Hazard tiles (poison swamp, void).
    const tile = this.world.tilemap.defAtPx(this.x, this.y);
    if (tile?.hazard) {
      this.applyDamage({
        amount: tile.hazard * dt,
        fromX: this.x,
        fromY: this.y,
        knockback: 0,
        ignoreInvuln: true,
      });
    }

    if (this.knockX !== 0 || this.knockY !== 0) {
      this.world.moveEntity(this, this.knockX * dt, this.knockY * dt);
      const decay = Math.exp(-COMBAT.knockbackDecay * dt);
      this.knockX *= decay;
      this.knockY *= decay;
      if (Math.abs(this.knockX) < 1) this.knockX = 0;
      if (Math.abs(this.knockY) < 1) this.knockY = 0;
    }

    this.animator.update(dt);
    if (this.isDead) this.deathTimer += dt;
  }

  override draw(ctx: Ctx2D, camX: number, camY: number): void {
    const x = this.x - camX;
    const y = this.y - camY;
    if (!this.isDead) drawShadow(ctx, x, y, this.shadowRadius);
    // Blink while invulnerable - the readable 16-bit way to show i-frames.
    if (this.invuln > 0 && this.hurtTimer <= 0 && Math.floor(this.invuln * 20) % 2 === 0) return;
    const flip = this.directional && this.facing === 'left';
    this.animator.draw(ctx, x + this.drawOffsetX, y + this.drawOffsetY, flip);
  }
}
