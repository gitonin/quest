import { FOLLOW } from '../core/config';
import { damp, dist, facingFromVector } from '../core/math';
import { CHARACTERS, statsAtLevel, type CharacterId } from '../data/characters';
import { SPELLS } from '../data/spells';
import type { AnimBank } from '../gfx/sprites';
import type { Ctx2D } from '../gfx/renderer';
import { availableSpells, castSpell } from '../systems/spells';
import { avoidObstacles, separation, type Trail } from '../systems/follow';
import { Character } from './character';
import type { Entity, EntityKind } from './entity';
import type { Player } from './player';

export type CompanionState = 'follow' | 'idle' | 'combat' | 'lowHealth' | 'boss' | 'down';

const LOW_HEALTH_RATIO = 0.35;

/**
 * AI party member (princess, wizard).
 *
 * Behaviour is a small state machine on top of the shared `Character`: follow
 * the player's trail, fight what threatens the group, back off when hurt, and
 * play safer around bosses. The class deliberately takes its input from the
 * same fields a human player would (facing, move vector, spell casts) so making
 * a companion playable later is only a matter of swapping the controller.
 */
export class Companion extends Character {
  readonly kind: EntityKind = 'companion';
  readonly charId: CharacterId;
  private player: Player;
  private trail: Trail;
  /** Index in the caravan: 1 = right behind the knight. */
  slot: number;
  aiState: CompanionState = 'follow';
  private castCooldowns = new Map<string, number>();
  private globalCastCd = 0;
  private target: Character | null = null;
  private retargetTimer = 0;
  private repositionTimer = 0;
  private strafeDir = 1;
  private baseSpells: string[];
  private pendingCast: { id: string; time: number; tx: number; ty: number; ally: Character | null } | null = null;
  /** Seconds spent far behind the caravan, used as an anti-soft-lock timer. */
  lostTimer = 0;

  constructor(charId: CharacterId, bank: AnimBank, player: Player, trail: Trail, slot: number, level = 1) {
    super(bank, true);
    this.charId = charId;
    this.player = player;
    this.trail = trail;
    this.slot = slot;
    const def = CHARACTERS[charId];
    this.w = def.hitbox.w;
    this.h = def.hitbox.h;
    this.drawOffsetX = -10;
    this.drawOffsetY = -22;
    this.shadowRadius = 6;
    this.baseSpells = charId === 'princess' ? ['lightBolt', 'heal'] : ['fireBolt'];
    this.applyLevel(level);
  }

  applyLevel(level: number): void {
    const stats = statsAtLevel(this.charId, level);
    this.level = level;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    this.maxHp = stats.maxHp;
    this.maxMp = stats.maxMp;
    this.hp = Math.max(1, Math.round(stats.maxHp * (this.hp > 0 ? ratio : 1)));
    this.mp = this.mp > 0 ? Math.min(this.mp, stats.maxMp) : stats.maxMp;
    this.attack = stats.attack;
    this.magic = stats.magic;
    this.defense = stats.defense;
    this.speed = stats.speed;
  }

  gainXp(amount: number): void {
    this.xp += amount;
    // Companions level with the party, a little slower than the knight.
    while (this.xp >= 18 * Math.pow(this.level + 1, 1.7)) {
      this.level++;
      this.applyLevel(this.level);
      this.hp = this.maxHp;
    }
  }

  get spells(): string[] {
    return availableSpells(CHARACTERS[this.charId].unlocks, this.level, this.baseSpells);
  }

  private get followDistance(): number {
    return FOLLOW.spacing * this.slot;
  }

  /**
   * True when the companion has fallen well behind the caravan. Casting roots
   * the caster for the duration of the animation, so a lagging companion skips
   * offensive spells until it has caught up - otherwise it stops every second
   * to shoot and never rejoins the group.
   */
  private get isLagging(): boolean {
    return dist(this.x, this.y, this.player.x, this.player.y) > this.followDistance * 1.8;
  }

  update(dt: number): void {
    this.updateCommon(dt);
    // Companions are never gone for good: they get back up near the player.
    if (this.isDead) {
      this.aiState = 'down';
      if (this.deathTimer > 4) this.revive();
      return;
    }

    this.globalCastCd = Math.max(0, this.globalCastCd - dt);
    this.updatePendingCast(dt);
    for (const [id, cd] of this.castCooldowns) {
      if (cd > 0) this.castCooldowns.set(id, Math.max(0, cd - dt));
    }
    this.retargetTimer -= dt;
    this.repositionTimer -= dt;
    if (this.status.stun.time > 0) return;

    this.decideState();
    switch (this.aiState) {
      case 'combat':
        this.updateCombat(dt);
        break;
      case 'boss':
        this.updateBoss(dt);
        break;
      case 'lowHealth':
        this.updateLowHealth(dt);
        break;
      default:
        this.updateFollow(dt);
        break;
    }
  }

  private revive(): void {
    this.state = 'idle';
    this.aiState = 'follow';
    this.vx = 0;
    this.vy = 0;
    this.hp = Math.round(this.maxHp * 0.5);
    this.deathTimer = 0;
    const spot = this.trail.pointBehind(this.followDistance);
    this.x = spot.x;
    this.y = spot.y;
    this.playState('idle', true);
    this.world.particles.emit('magic', this.x, this.y - 10, 16, { speed: 40, color: '#8dffb0' });
  }

  private decideState(): void {
    if (this.retargetTimer <= 0) {
      this.retargetTimer = 0.25;
      this.target = this.findTarget();
    }
    const lowHp = this.hp / this.maxHp < LOW_HEALTH_RATIO;
    if (this.target && (this.target as unknown as { isBoss?: boolean }).isBoss) {
      this.aiState = 'boss';
      return;
    }
    if (lowHp && this.target) {
      this.aiState = 'lowHealth';
      return;
    }
    if (this.target) {
      this.aiState = 'combat';
      return;
    }
    const spot = this.trail.pointBehind(this.followDistance);
    this.aiState = dist(this.x, this.y, spot.x, spot.y) < 6 ? 'idle' : 'follow';
  }

  private findTarget(): Character | null {
    const def = CHARACTERS[this.charId];
    // Prefer whatever is threatening the knight, then whatever is near us.
    const nearPlayer = this.world.nearest('enemy', this.player.x, this.player.y, def.aggroRadius + 40, (e) =>
      this.world.hasLineOfSight(this.cx, this.cy, e.x, e.y - 6),
    );
    if (nearPlayer) return nearPlayer as Character;
    const nearSelf = this.world.nearest('enemy', this.x, this.y, def.aggroRadius, (e) =>
      this.world.hasLineOfSight(this.cx, this.cy, e.x, e.y - 6),
    );
    return (nearSelf as Character) ?? null;
  }

  /* ------------------------------------------------------------ behaviours */

  private updateFollow(dt: number): void {
    const goal = this.followGoal();
    const d = dist(this.x, this.y, goal.x, goal.y);
    const behind = dist(this.x, this.y, this.player.x, this.player.y);

    if (behind > FOLLOW.teleportDistance) {
      // Last resort: the companion got locked out of the room entirely.
      this.x = goal.x;
      this.y = goal.y;
      this.world.particles.emit('magic', this.x, this.y - 8, 8, { speed: 30 });
      return;
    }

    if (d < 4) {
      this.lostTimer = 0;
      this.brake(dt);
      this.playState('idle');
      // Face the same way as the leader while resting.
      this.facing = this.player.facing;
      return;
    }

    // Lagging companions get a speed bonus that scales with how far behind the
    // caravan they are, so a corner or a fight never loses them for good.
    const urgency = behind > this.followDistance * 3 ? 1.9 : behind > this.followDistance * 1.6 ? 1.35 : 1;
    this.steerTowards(goal.x, goal.y, this.speed * urgency, dt);
    this.playState('walk');

    // Anti-soft-lock: if steering has not closed the gap for a few seconds the
    // companion is wedged somewhere, so it rejoins the trail directly. Rare by
    // design - it is the last resort, not the normal follow behaviour.
    this.lostTimer = behind > FOLLOW.catchUpDistance ? this.lostTimer + dt : 0;
    if (this.lostTimer > 1.8) {
      this.lostTimer = 0;
      const spot = this.trail.pointBehind(this.followDistance);
      this.world.particles.emit('magic', this.x, this.y - 8, 6, { speed: 30 });
      this.x = spot.x;
      this.y = spot.y;
      this.world.particles.emit('magic', this.x, this.y - 8, 8, { speed: 30 });
    }
  }

  /**
   * Next point to walk to: the companion projects itself onto the leader's
   * trail and aims a short step further along it, which makes the party walk in
   * single file over the exact ground the player covered - bridges included.
   */
  private followGoal(): { x: number; y: number } {
    const target = Math.max(0, this.trail.length - this.followDistance);
    const { progress, distance } = this.trail.nearestProgress(this.x, this.y);
    // Too far off the path (knocked back, spawned): head straight back to it.
    if (distance > 48) return this.trail.pointAtProgress(Math.min(target, progress));
    const step = Math.min(target, progress + 18);
    return this.trail.pointAtProgress(step);
  }

  private updateCombat(dt: number): void {
    const target = this.target;
    if (!target || target.isDead) {
      this.updateFollow(dt);
      return;
    }
    const def = CHARACTERS[this.charId];
    const d = dist(this.x, this.y, target.x, target.y);
    const ideal = def.base.attackRange * 0.72;

    // Do not chase the enemy across the level: past the leash, rejoining the
    // caravan always wins over finishing a fight.
    const leash = dist(this.x, this.y, this.player.x, this.player.y);
    if (leash > FOLLOW.catchUpDistance * 0.6) {
      this.updateFollow(dt);
      return;
    }

    if (d > ideal * 1.25) {
      this.steerTowards(target.x, target.y, this.speed, dt);
      this.playState('walk');
    } else if (d < ideal * 0.55) {
      this.steerTowards(this.x * 2 - target.x, this.y * 2 - target.y, this.speed * 0.9, dt);
      this.playState('walk');
    } else {
      if (this.repositionTimer <= 0) {
        this.repositionTimer = 1.2 + Math.random();
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      // Small strafe so ranged companions are not sitting ducks.
      const ang = Math.atan2(target.y - this.y, target.x - this.x) + (Math.PI / 2) * this.strafeDir;
      this.steerTowards(this.x + Math.cos(ang) * 24, this.y + Math.sin(ang) * 24, this.speed * 0.55, dt);
      this.playState('walk');
    }

    this.faceTowards(target.x, target.y);
    this.tryCast(target);
  }

  private updateLowHealth(dt: number): void {
    // Heal if we can, then retreat. Retreating means going back to the caravan
    // on the same trail as usual - a hurt companion must never drift away from
    // the group, which is exactly how they used to get lost.
    if (this.trySpecific('heal', this) || this.trySpecific('greaterHeal', this)) return;
    this.updateFollow(dt);
    const target = this.target;
    if (target && !target.isDead && !this.isLagging) {
      this.faceTowards(target.x, target.y);
      // Ranged only: no trading blows in melee while nearly dead.
      this.tryCast(target, true);
    }
  }

  private updateBoss(dt: number): void {
    const boss = this.target;
    if (!boss || boss.isDead) {
      this.updateFollow(dt);
      return;
    }
    const telegraphing = (boss as unknown as { isTelegraphing?: boolean }).isTelegraphing === true;
    const vulnerable = (boss as unknown as { isVulnerable?: boolean }).isVulnerable !== false;
    const d = dist(this.x, this.y, boss.x, boss.y);
    const safe = CHARACTERS[this.charId].base.attackRange * 0.9;

    if (telegraphing || d < safe * 0.6) {
      // Back away from the wind-up, perpendicular to the boss.
      const ang = Math.atan2(this.y - boss.y, this.x - boss.x) + 0.4 * this.strafeDir;
      this.steerTowards(boss.x + Math.cos(ang) * safe * 1.3, boss.y + Math.sin(ang) * safe * 1.3, this.speed * 1.2, dt);
      this.playState('walk');
    } else if (d > safe * 1.2) {
      this.steerTowards(boss.x, boss.y, this.speed, dt);
      this.playState('walk');
    } else {
      this.brake(dt);
      this.playState('idle');
    }

    this.faceTowards(boss.x, boss.y);
    if (this.hp / this.maxHp < 0.5) {
      if (this.trySpecific('heal', this) || this.trySpecific('greaterHeal', this)) return;
    }
    if (this.player.hp / this.player.maxHp < 0.55) {
      if (this.trySpecific('shield', this.player) || this.trySpecific('heal', this.player)) return;
    }
    if (vulnerable && !telegraphing) this.tryCast(boss);
  }

  /* --------------------------------------------------------------- casting */

  private tryCast(target: Character, rangedOnly = false): void {
    if (this.globalCastCd > 0 || this.state === 'hurt') return;
    if (this.isLagging) return;

    // Support first: a dying knight matters more than damage.
    const ally = this.pickHealTarget();
    if (ally && (this.trySpecific('greaterHeal', ally) || this.trySpecific('heal', ally))) return;
    if (this.player.hp / this.player.maxHp < 0.45 && this.trySpecific('shield', this.player)) return;

    const d = dist(this.x, this.y, target.x, target.y);
    for (const id of [...this.spells].reverse()) {
      const spell = SPELLS[id];
      if (!spell || spell.aiRole === 'heal' || spell.aiRole === 'support') continue;
      if (rangedOnly && spell.shape !== 'projectile') continue;
      if (d > spell.range) continue;
      if ((this.castCooldowns.get(id) ?? 0) > 0) continue;
      if (!this.world.hasLineOfSight(this.cx, this.cy, target.x, target.y - 6)) continue;
      if (this.mp < spell.mpCost) continue;
      this.startCast(id, spell.castTime, target.x, target.y - target.h / 2, null);
      return;
    }
  }

  private pickHealTarget(): Character | null {
    if (!this.spells.includes('heal') && !this.spells.includes('greaterHeal')) return null;
    const candidates: Character[] = [this.player, this];
    for (const e of this.world.entitiesOfKind('companion')) {
      if (e !== this) candidates.push(e as Character);
    }
    let worst: Character | null = null;
    for (const c of candidates) {
      if (c.isDead) continue;
      const ratio = c.hp / c.maxHp;
      if (ratio < 0.6 && (!worst || ratio < worst.hp / worst.maxHp)) worst = c;
    }
    return worst;
  }

  private trySpecific(id: string, ally: Character | null): boolean {
    if (!this.spells.includes(id)) return false;
    const spell = SPELLS[id];
    if (!spell || this.globalCastCd > 0) return false;
    if ((this.castCooldowns.get(id) ?? 0) > 0) return false;
    if (this.mp < spell.mpCost) return false;
    if (ally && ally !== this && dist(this.x, this.y, ally.x, ally.y) > spell.range) return false;
    this.startCast(id, spell.castTime, ally?.x ?? this.x, ally?.y ?? this.y, ally);
    return true;
  }

  private startCast(id: string, castTime: number, tx: number, ty: number, ally: Character | null): void {
    const spell = SPELLS[id];
    this.castCooldowns.set(id, spell.cooldown);
    this.globalCastCd = Math.max(0.5, castTime + 0.35);
    this.playState(spell.aiRole === 'attack' || !spell.aiRole ? 'attack' : 'cast', true);
    this.brakeInstant();
    // Resolved by `updatePendingCast` so pausing the game also pauses the spell.
    this.pendingCast = { id, time: castTime, tx, ty, ally };
  }

  private updatePendingCast(dt: number): void {
    const pending = this.pendingCast;
    if (!pending) return;
    pending.time -= dt;
    if (pending.time > 0) return;
    this.pendingCast = null;
    if (this.isDead) return;
    // Re-aim at a moving target so bolts do not fly at stale positions.
    const target = pending.ally ?? this.target;
    const tx = target && !target.isDead ? target.x : pending.tx;
    const ty = target && !target.isDead ? target.y - target.h / 2 : pending.ty;
    castSpell(pending.id, {
      world: this.world,
      caster: this,
      side: 'hero',
      targetX: tx,
      targetY: ty,
      ally: pending.ally,
    });
  }

  /* -------------------------------------------------------------- steering */

  private steerTowards(tx: number, ty: number, speed: number, dt: number): void {
    const dirX = tx - this.x;
    const dirY = ty - this.y;
    const others = [this.player, ...this.world.entitiesOfKind('companion')] as Array<Entity & { w: number; h: number }>;
    const avoid = avoidObstacles(this, dirX, dirY, 14, (x, y, w, h) => this.world.boxBlocked(x, y, w, h));
    const sep = separation(this, others, 14);

    const vx = avoid.x * speed + sep.x * speed * 0.7;
    const vy = avoid.y * speed + sep.y * speed * 0.7;
    this.vx = damp(this.vx, vx, 16, dt);
    this.vy = damp(this.vy, vy, 16, dt);
    const moved = this.world.moveEntity(this, this.vx * dt * this.speedMultiplier, this.vy * dt * this.speedMultiplier);
    if (moved.hitX) this.vx *= 0.3;
    if (moved.hitY) this.vy *= 0.3;
    if (Math.hypot(this.vx, this.vy) > 6) {
      this.facing = facingFromVector(this.vx, this.vy, this.facing);
    }
  }

  private brake(dt: number): void {
    this.vx = damp(this.vx, 0, 18, dt);
    this.vy = damp(this.vy, 0, 18, dt);
    this.world.moveEntity(this, this.vx * dt, this.vy * dt);
  }

  private brakeInstant(): void {
    this.vx = 0;
    this.vy = 0;
  }

  override draw(ctx: Ctx2D, camX: number, camY: number): void {
    super.draw(ctx, camX, camY);
    if (this.status.shield.time > 0) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#63d8ff';
      ctx.beginPath();
      ctx.ellipse(this.x - camX, this.y - camY - 9, 10, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
