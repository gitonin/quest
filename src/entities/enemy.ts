import { damp, dist, facingFromVector } from '../core/math';
import { ENEMIES, WORLD_SCALING, type EnemyDef, type EnemyId } from '../data/enemies';
import { ITEMS } from '../data/items';
import type { AnimBank } from '../gfx/sprites';
import type { Ctx2D } from '../gfx/renderer';
import { avoidObstacles, separation } from '../systems/follow';
import type { World } from '../systems/world';
import { Character, type DamageInfo } from './character';
import type { Entity, EntityKind } from './entity';
import { Pickup } from './pickup';

export type EnemyState = 'idle' | 'chase' | 'attack' | 'recover' | 'flee';

/**
 * Generic monster.
 *
 * Subclasses only implement `think()` (what to do this frame) and optionally
 * `performAttack()`. Everything else - stats, aggro, knockback, drops, XP,
 * death - is shared, so a new enemy is a data row plus a small class.
 */
export class Enemy extends Character {
  readonly kind: EntityKind = 'enemy';
  readonly def: EnemyDef;
  readonly isBoss: boolean;
  aiState: EnemyState = 'idle';
  protected attackCooldown = 0;
  protected attackTimer = 0;
  protected target: Character | null = null;
  protected retargetTimer = 0;
  protected homeX = 0;
  protected homeY = 0;
  /** Bosses expose these so companions can react to wind-ups. */
  isTelegraphing = false;
  isVulnerable = true;
  xpReward: number;
  /** Quest flag raised when this monster dies (bosses, gate keepers). */
  defeatFlag?: string;

  constructor(id: EnemyId, bank: AnimBank, world: number, level = 1) {
    super(bank, false);
    const def = ENEMIES[id];
    this.def = def;
    this.isBoss = def.isBoss ?? false;
    const scale = WORLD_SCALING[world] ?? WORLD_SCALING[1];
    const levelBonus = 1 + (level - 1) * 0.08;

    this.maxHp = Math.round(def.hp * scale.hp * levelBonus);
    this.hp = this.maxHp;
    this.attack = def.damage * scale.damage * levelBonus;
    this.defense = def.defense;
    this.speed = def.speed * scale.speed;
    this.xpReward = Math.round(def.xp * scale.xp);
    this.w = def.hitbox.w;
    this.h = def.hitbox.h;
    this.drawOffsetX = def.drawOffset.x;
    this.drawOffsetY = def.drawOffset.y;
    this.shadowRadius = def.hitbox.w * 0.5;
    this.level = level;
  }

  /** True once the monster has locked onto someone - drives the boss HUD bar. */
  get isEngaged(): boolean {
    return this.target !== null && !this.target.isDead;
  }

  override onSpawn(): void {
    this.homeX = this.x;
    this.homeY = this.y;
  }

  protected findTarget(): Character | null {
    const player = this.world.entitiesOfKind('player')[0] as Character | undefined;
    let best: Character | null = null;
    let bestD = this.def.aggroRadius;
    for (const candidate of [player, ...this.world.entitiesOfKind('companion')] as Array<Character | undefined>) {
      if (!candidate || candidate.isDead) continue;
      const d = dist(this.x, this.y, candidate.x, candidate.y);
      // Prefer the knight unless a companion is much closer.
      const weighted = candidate.kind === 'player' ? d * 0.75 : d;
      if (weighted < bestD) {
        bestD = weighted;
        best = candidate;
      }
    }
    return best;
  }

  update(dt: number): void {
    this.updateCommon(dt);
    if (this.isDead) {
      if (this.deathTimer > 0.9) this.alive = false;
      return;
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.retargetTimer -= dt;
    if (this.retargetTimer <= 0) {
      this.retargetTimer = 0.3;
      this.target = this.findTarget();
    }
    if (this.status.stun.time > 0) {
      this.playState('idle');
      return;
    }
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this.aiState = 'recover';
      return;
    }
    this.think(dt);
  }

  /** Overridden by each monster. */
  protected think(dt: number): void {
    const target = this.target;
    if (!target) {
      this.idleWander(dt);
      return;
    }
    const d = dist(this.x, this.y, target.x, target.y);
    if (d <= this.def.attackRange && this.attackCooldown <= 0) {
      this.beginAttack(target);
    } else if (d <= this.def.aggroRadius) {
      this.moveTowards(target.x, target.y, this.speed, dt);
      this.playState('walk');
      this.aiState = 'chase';
    } else {
      this.idleWander(dt);
    }
  }

  protected idleWander(dt: number): void {
    this.aiState = 'idle';
    this.vx = damp(this.vx, 0, 8, dt);
    this.vy = damp(this.vy, 0, 8, dt);
    if (Math.abs(this.vx) + Math.abs(this.vy) > 1) this.world.moveEntity(this, this.vx * dt, this.vy * dt);
    this.playState('idle');
  }

  protected beginAttack(target: Character): void {
    this.aiState = 'attack';
    this.attackTimer = 0.42;
    this.attackCooldown = this.def.attackCooldown;
    this.faceTowards(target.x, target.y);
    this.playState('attack', true);
    this.performAttack(target);
  }

  /** Default melee: damage lands with the animation, via a small delay. */
  protected performAttack(target: Character): void {
    const world = this.world;
    const damage = this.attack;
    const range = this.def.attackRange + 8;
    this.scheduleHit(0.22, () => {
      if (this.isDead || target.isDead) return;
      if (dist(this.x, this.y, target.x, target.y) > range) return;
      target.applyDamage({ amount: damage, fromX: this.x, fromY: this.y, knockback: 90 });
      world.camera.shake(0.15);
    });
  }

  private scheduled: Array<{ time: number; fn: () => void }> = [];

  protected scheduleHit(delay: number, fn: () => void): void {
    this.scheduled.push({ time: delay, fn });
  }

  protected override updateCommon(dt: number): void {
    super.updateCommon(dt);
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      this.scheduled[i].time -= dt;
      if (this.scheduled[i].time <= 0) {
        const { fn } = this.scheduled[i];
        this.scheduled.splice(i, 1);
        fn();
      }
    }
  }

  protected moveTowards(tx: number, ty: number, speed: number, dt: number): void {
    if (this.def.rooted) {
      this.faceTowards(tx, ty);
      return;
    }
    const others = this.world.entitiesOfKind('enemy') as Array<Entity & { w: number; h: number }>;
    const avoid = avoidObstacles(this, tx - this.x, ty - this.y, 14, (x, y, w, h) => this.world.boxBlocked(x, y, w, h));
    const sep = separation(this, others, 16);
    const vx = avoid.x * speed + sep.x * speed * 0.8;
    const vy = avoid.y * speed + sep.y * speed * 0.8;
    this.vx = damp(this.vx, vx, 12, dt);
    this.vy = damp(this.vy, vy, 12, dt);
    this.world.moveEntity(this, this.vx * dt * this.speedMultiplier, this.vy * dt * this.speedMultiplier);
    if (Math.hypot(this.vx, this.vy) > 5) this.facing = facingFromVector(this.vx, this.vy, this.facing);
  }

  protected override onDamaged(_amount: number, info: DamageInfo): void {
    this.knockX *= this.def.knockbackResist;
    this.knockY *= this.def.knockbackResist;
    this.world.particles.emit('blood', this.x, this.y - this.h, 4, {
      dirX: this.x - info.fromX,
      dirY: this.y - info.fromY,
      speed: 55,
      color: '#8c2033',
    });
    // Being hit interrupts the wander state and wakes the monster up.
    if (!this.target) this.target = this.findTarget();
  }

  protected override onDeath(): void {
    grantRewards(this.world, this);
    this.world.particles.emit('spark', this.x, this.y - this.h / 2, 12, { speed: 70, color: '#ffe6a1' });
    if (this.isBoss) this.world.camera.shake(0.8);
    this.world.onEnemyDefeated?.(this);
  }

  override draw(ctx: Ctx2D, camX: number, camY: number): void {
    super.draw(ctx, camX, camY);
    if (this.isDead || this.hp >= this.maxHp || this.isBoss) return;
    // Small floating HP bar once the monster has been hurt.
    const w = Math.max(12, this.w + 6);
    const x = Math.round(this.x - camX - w / 2);
    const y = Math.round(this.y - camY - this.h - (this.def.drawOffset.y < -24 ? 20 : 12));
    ctx.fillStyle = '#07050f';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#5c1a22';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#d64550';
    ctx.fillRect(x, y, Math.round((w * this.hp) / this.maxHp), 2);
  }
}

/** XP to the whole party + loot on the ground. */
export function grantRewards(world: World, enemy: Enemy): void {
  const player = world.entitiesOfKind('player')[0] as { gainXp?: (n: number) => void } | undefined;
  player?.gainXp?.(enemy.xpReward);
  for (const companion of world.entitiesOfKind('companion')) {
    (companion as unknown as { gainXp?: (n: number) => void }).gainXp?.(Math.round(enemy.xpReward * 0.8));
  }
  for (const drop of enemy.def.drops ?? []) {
    if (Math.random() > drop.chance) continue;
    const item = ITEMS[drop.item];
    if (!item) continue;
    world.add(new Pickup(item.id, enemy.x + (Math.random() * 12 - 6), enemy.y + (Math.random() * 8 - 4)));
  }
}
