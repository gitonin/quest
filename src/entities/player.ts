import type { Input } from '../core/input';
import { clamp, damp, facingFromVector } from '../core/math';
import { CHARACTERS, statsAtLevel, xpForLevel } from '../data/characters';
import type { AnimBank } from '../gfx/sprites';
import type { Ctx2D } from '../gfx/renderer';
import { availableSpells, castSpell } from '../systems/spells';
import { meleeSweep, rollDamage } from '../systems/combat';
import { Character } from './character';
import type { EntityKind } from './entity';
import { FloatingText } from './effects';

const CHARGE_TIME = 0.42;
const DODGE_TIME = 0.26;
const DODGE_SPEED = 210;
const DODGE_COOLDOWN = 0.55;
const ATTACK_TIME = 0.3;
const COMBO_WINDOW = 0.45;

export type PlayerEvents = {
  onLevelUp?: (level: number) => void;
  onInteract?: () => void;
  onDeath?: () => void;
};

/**
 * The Black Knight - the only directly controlled character.
 *
 * Movement is deliberately snappy (fast acceleration, quick stop) because the
 * game has to feel good through a virtual joystick: light attack, hold to
 * charge, dodge with i-frames, and a skill button wired to the spell system.
 */
export class Player extends Character {
  readonly kind: EntityKind = 'player';
  private input: Input;
  private attackTimer = 0;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;
  private chargeTime = 0;
  private comboTimer = 0;
  private comboStep = 0;
  private skillCooldown = 0;
  private wasCharging = false;
  events: PlayerEvents = {};
  /** Set while a cutscene or menu owns the character. */
  cutsceneLock = false;

  constructor(bank: AnimBank, input: Input, level = 1) {
    super(bank, true);
    this.input = input;
    this.w = CHARACTERS.knight.hitbox.w;
    this.h = CHARACTERS.knight.hitbox.h;
    this.drawOffsetX = -10;
    this.drawOffsetY = -22;
    this.shadowRadius = 6;
    this.applyLevel(level);
  }

  applyLevel(level: number): void {
    const stats = statsAtLevel('knight', level);
    this.level = level;
    const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    this.maxHp = stats.maxHp;
    this.maxMp = stats.maxMp;
    this.hp = Math.round(stats.maxHp * (this.hp > 0 ? hpRatio : 1));
    this.mp = Math.min(this.maxMp, this.mp || stats.maxMp);
    this.attack = stats.attack;
    this.magic = stats.magic;
    this.defense = stats.defense;
    this.speed = stats.speed;
  }

  gainXp(amount: number): void {
    this.xp += amount;
    this.world.add(new FloatingText(`+${amount} XP`, this.x, this.y - this.h - 16, '#f0c04a'));
    while (this.xp >= xpForLevel(this.level + 1)) {
      this.level++;
      this.applyLevel(this.level);
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      this.world.particles.emit('magic', this.x, this.y - 8, 24, { speed: 60, color: '#ffd166' });
      this.world.add(new FloatingText('NIVEAU +', this.x, this.y - this.h - 24, '#ffd166'));
      this.events.onLevelUp?.(this.level);
    }
  }

  get skills(): string[] {
    return availableSpells(CHARACTERS.knight.unlocks, this.level, []);
  }

  get isBusy(): boolean {
    return this.attackTimer > 0 || this.dodgeTimer > 0 || this.state === 'hurt';
  }

  get chargeRatio(): number {
    return clamp(this.chargeTime / CHARGE_TIME, 0, 1);
  }

  get skillCooldownRatio(): number {
    return this.skillCooldown > 0 ? clamp(this.skillCooldown / 4, 0, 1) : 0;
  }

  update(dt: number): void {
    this.updateCommon(dt);
    if (this.isDead) return;

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.skillCooldown = Math.max(0, this.skillCooldown - dt);
    if (this.comboTimer <= 0) this.comboStep = 0;

    if (this.cutsceneLock) {
      this.vx = damp(this.vx, 0, 14, dt);
      this.vy = damp(this.vy, 0, 14, dt);
      this.world.moveEntity(this, this.vx * dt, this.vy * dt);
      if (Math.hypot(this.vx, this.vy) < 4 && this.state !== 'hurt') this.playState('idle');
      return;
    }

    if (this.dodgeTimer > 0) {
      this.updateDodge(dt);
      return;
    }
    if (this.status.stun.time > 0) {
      this.playState('idle');
      return;
    }

    this.handleAttackInput(dt);
    this.handleSkillInput();
    this.handleMovement(dt);
  }

  private handleMovement(dt: number): void {
    const move = this.input.move;
    const moving = Math.hypot(move.x, move.y) > 0.15;

    if (this.attackTimer > 0) {
      // Attacks root the knight briefly - readable, and it makes dodging matter.
      this.vx = damp(this.vx, 0, 18, dt);
      this.vy = damp(this.vy, 0, 18, dt);
    } else {
      const speed = this.speed * this.speedMultiplier;
      const targetX = moving ? move.x * speed : 0;
      const targetY = moving ? move.y * speed : 0;
      const accel = moving ? 22 : 26;
      this.vx = damp(this.vx, targetX, accel, dt);
      this.vy = damp(this.vy, targetY, accel, dt);
      if (moving) this.facing = facingFromVector(move.x, move.y, this.facing);
    }

    this.world.moveEntity(this, this.vx * dt, this.vy * dt);

    if (this.attackTimer <= 0 && this.hurtTimer <= 0) {
      const speedNow = Math.hypot(this.vx, this.vy);
      if (speedNow > 8) {
        this.playState('walk');
        if (Math.random() < dt * 6) {
          this.world.particles.emit('dust', this.x, this.y, 1, { speed: 12 });
        }
      } else {
        this.playState('idle');
      }
    }
  }

  private handleAttackInput(dt: number): void {
    const held = this.input.down('attack');
    if (held && this.attackTimer <= 0) {
      this.chargeTime += dt;
      this.wasCharging = true;
      if (this.chargeRatio >= 1) {
        this.playState('charge');
        if (Math.random() < dt * 12) {
          this.world.particles.emit('magic', this.x, this.y - 12, 1, { speed: 26, color: '#9a6ce8' });
        }
      }
    }

    if (this.input.released('attack') && this.wasCharging) {
      const charged = this.chargeRatio >= 1;
      this.wasCharging = false;
      this.chargeTime = 0;
      if (this.attackTimer <= 0) this.swing(charged);
      this.input.consume('attack');
    }
  }

  private swing(charged: boolean): void {
    this.attackTimer = charged ? ATTACK_TIME * 1.35 : ATTACK_TIME;
    this.comboTimer = COMBO_WINDOW;
    this.comboStep = (this.comboStep + 1) % 3;
    this.playState(charged ? 'charged' : 'attack', true);

    const base = charged ? this.attack * 2.1 : this.attack * (1 + this.comboStep * 0.08);
    meleeSweep(this.world, this, 'enemy', {
      damage: rollDamage(base),
      range: charged ? 30 : 24,
      width: charged ? 34 : 24,
      charged,
      knockback: charged ? 170 : 95,
    });
    this.world.particles.emit('dust', this.x, this.y, 3, { speed: 26 });
  }

  private handleSkillInput(): void {
    if (!this.input.pressed('magic')) return;
    this.input.consume('magic');
    if (this.skillCooldown > 0) return;
    const skills = this.skills;
    if (skills.length === 0) {
      this.world.add(new FloatingText('...', this.x, this.y - this.h - 10, '#a9a3bd'));
      return;
    }
    // Strongest unlocked skill the knight can currently pay for.
    for (const id of [...skills].reverse()) {
      if (
        castSpell(id, {
          world: this.world,
          caster: this,
          side: 'hero',
          targetX: this.x,
          targetY: this.y - this.h / 2,
        })
      ) {
        this.skillCooldown = 4;
        this.attackTimer = 0.28;
        this.playState('charged', true);
        this.world.camera.shake(0.35);
        return;
      }
    }
    this.world.add(new FloatingText('PM !', this.x, this.y - this.h - 10, '#4a9ff5'));
  }

  private updateDodge(dt: number): void {
    this.dodgeTimer -= dt;
    this.invuln = Math.max(this.invuln, this.dodgeTimer + 0.08);
    this.world.moveEntity(this, this.vx * dt, this.vy * dt);
    this.vx = damp(this.vx, 0, 6, dt);
    this.vy = damp(this.vy, 0, 6, dt);
    if (Math.random() < dt * 30) this.world.particles.emit('dust', this.x, this.y, 2, { speed: 20 });
    if (this.dodgeTimer <= 0) this.playState('idle');
  }

  tryDodge(): boolean {
    if (this.dodgeCooldown > 0 || this.dodgeTimer > 0 || this.isDead || this.cutsceneLock) return false;
    const move = this.input.move;
    let dx = move.x;
    let dy = move.y;
    if (Math.hypot(dx, dy) < 0.15) {
      dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0;
      dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * DODGE_SPEED;
    this.vy = (dy / len) * DODGE_SPEED;
    this.dodgeTimer = DODGE_TIME;
    this.dodgeCooldown = DODGE_COOLDOWN;
    this.attackTimer = 0;
    this.chargeTime = 0;
    this.playState('dodge', true);
    this.world.particles.emit('dust', this.x, this.y, 6, { speed: 40 });
    return true;
  }

  protected override onDeath(): void {
    this.events.onDeath?.();
  }

  override draw(ctx: Ctx2D, camX: number, camY: number): void {
    super.draw(ctx, camX, camY);
    // Charge tell: a small violet arc under the knight.
    if (this.chargeRatio > 0.15 && this.chargeRatio < 1) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#9a6ce8';
      ctx.beginPath();
      ctx.arc(this.x - camX, this.y - camY - 2, 10, -Math.PI, -Math.PI + Math.PI * this.chargeRatio);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.status.shield.time > 0) {
      ctx.globalAlpha = 0.4 + Math.sin(performance.now() / 120) * 0.1;
      ctx.strokeStyle = '#63d8ff';
      ctx.beginPath();
      ctx.ellipse(this.x - camX, this.y - camY - 10, 11, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
