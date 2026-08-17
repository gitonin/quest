import { COMBAT } from '../core/config';
import type { Facing } from '../core/math';
import { dist } from '../core/math';
import { FloatingText, OneShotFx } from '../entities/effects';
import type { Character, DamageInfo } from '../entities/character';
import type { Entity } from '../entities/entity';
import type { World } from './world';

export type Side = 'hero' | 'enemy';

const KINDS: Record<Side, Array<Entity['kind']>> = {
  hero: ['player', 'companion'],
  enemy: ['enemy'],
};

export interface SweepOptions {
  damage: number;
  range: number;
  width: number;
  knockback?: number;
  charged?: boolean;
  status?: DamageInfo['status'];
  /** Camera shake + hitstop are scaled by this. */
  weight?: number;
}

/** Rectangle in front of the attacker, in world space. */
export function facingBox(x: number, y: number, facing: Facing, range: number, width: number) {
  switch (facing) {
    case 'up':
      return { x: x - width / 2, y: y - range - 6, w: width, h: range };
    case 'down':
      return { x: x - width / 2, y: y - 6, w: width, h: range };
    case 'left':
      return { x: x - range, y: y - 6 - width / 2, w: range, h: width };
    default:
      return { x, y: y - 6 - width / 2, w: range, h: width };
  }
}

/** Melee swing: hits everything of the opposite side inside the facing box. */
export function meleeSweep(world: World, attacker: Character, target: Side, opts: SweepOptions): number {
  const box = facingBox(attacker.x, attacker.y, attacker.facing, opts.range, opts.width);
  let hits = 0;

  const fx = opts.charged ? world.assets.fx.chargedSlash : world.assets.fx.slash;
  const offset = 16;
  const fxX = attacker.x + (attacker.facing === 'left' ? -offset : attacker.facing === 'right' ? offset : 0);
  const fxY = attacker.y - 10 + (attacker.facing === 'up' ? -offset : attacker.facing === 'down' ? offset : 0);
  world.add(new OneShotFx(fx, fxX, fxY, { flip: attacker.facing === 'left' }));

  for (const kind of KINDS[target]) {
    for (const victim of world.overlapping(box, kind)) {
      const character = victim as Character;
      if (character.isDead) continue;
      const dealt = character.applyDamage({
        amount: opts.damage,
        fromX: attacker.x,
        fromY: attacker.y,
        knockback: opts.knockback ?? (opts.charged ? 150 : 90),
        status: opts.status,
      });
      if (!dealt) continue;
      hits++;
      onHitFeedback(world, character, opts.damage, opts.charged ?? false);
    }
  }

  const weight = opts.weight ?? 1;
  if (hits > 0) {
    world.hitstop = Math.max(world.hitstop, COMBAT.hitstopSeconds * (opts.charged ? 2 : 1) * weight);
    world.camera.shake(opts.charged ? 0.45 : 0.22);
  }
  return hits;
}

/** Radial burst used by spells and boss slams. */
export function burst(
  world: World,
  x: number,
  y: number,
  radius: number,
  damage: number,
  target: Side,
  opts: { knockback?: number; status?: DamageInfo['status']; color?: string } = {},
): number {
  let hits = 0;
  for (const kind of KINDS[target]) {
    for (const entity of world.entitiesOfKind(kind)) {
      const character = entity as Character;
      if (character.isDead) continue;
      if (dist(x, y, character.x, character.y - character.h / 2) > radius) continue;
      const dealt = character.applyDamage({
        amount: damage,
        fromX: x,
        fromY: y,
        knockback: opts.knockback ?? 80,
        status: opts.status,
      });
      if (!dealt) continue;
      hits++;
      onHitFeedback(world, character, damage, false);
    }
  }
  world.particles.emit('magic', x, y, 14, { speed: radius * 2.2, color: opts.color });
  if (hits > 0) world.camera.shake(0.3);
  return hits;
}

function onHitFeedback(world: World, victim: Character, damage: number, charged: boolean): void {
  world.add(new OneShotFx(world.assets.fx.impact, victim.x, victim.y - victim.h - 2));
  world.add(
    new FloatingText(
      `${Math.max(1, Math.round(damage))}`,
      victim.x,
      victim.y - victim.h - 8,
      charged ? '#ffd166' : '#ffffff',
    ),
  );
  world.particles.emit('spark', victim.x, victim.y - victim.h / 2, charged ? 10 : 6, {
    speed: 70,
    color: '#fff6d8',
  });
}

/** Adds the design's damage variance so repeated hits do not feel identical. */
export function rollDamage(base: number): number {
  const spread = base * COMBAT.damageVariance;
  return base - spread + Math.random() * spread * 2;
}
