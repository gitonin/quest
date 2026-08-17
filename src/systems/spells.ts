import { ELEMENT_COLORS, SPELLS, type SpellDef } from '../data/spells';
import type { Character } from '../entities/character';
import { FloatingText, OneShotFx } from '../entities/effects';
import { Projectile } from '../entities/projectile';
import type { FxBank } from '../gfx/gen/fx';
import { burst, rollDamage, type Side } from './combat';
import type { World } from './world';

export interface CastContext {
  world: World;
  caster: Character;
  side: Side;
  targetX: number;
  targetY: number;
  /** Optional ally to heal / shield. */
  ally?: Character | null;
}

/**
 * Central spell resolver.
 *
 * Every caster - hero, companion or monster - goes through `castSpell`, so a
 * new element only needs a row in `data/spells.ts` and, at most, a new FX key.
 */
export function castSpell(id: string, ctx: CastContext): boolean {
  const spell = SPELLS[id];
  if (!spell) return false;
  const { world, caster } = ctx;
  if (caster.mp < spell.mpCost) return false;
  caster.mp -= spell.mpCost;

  const power = spell.element === 'physical' ? caster.attack : caster.magic;
  const damage = rollDamage(power * spell.power);
  const color = ELEMENT_COLORS[spell.element];
  const fxKey = spell.fx as keyof FxBank;

  switch (spell.shape) {
    case 'projectile': {
      const originY = caster.y - caster.h - 4;
      world.add(
        new Projectile({
          clip: world.assets.fx[fxKey],
          x: caster.x,
          y: originY,
          dirX: ctx.targetX - caster.x,
          dirY: ctx.targetY - originY,
          speed: spell.speed ?? 120,
          damage,
          range: spell.range,
          target: ctx.side === 'hero' ? 'enemy' : 'hero',
          status: spell.status,
          color,
        }),
      );
      break;
    }
    case 'burst': {
      const x = spell.range > 0 ? ctx.targetX : caster.x;
      const y = spell.range > 0 ? ctx.targetY : caster.y - caster.h / 2;
      world.add(new OneShotFx(world.assets.fx.magicHit, x, y, { depthBias: 10 }));
      burst(world, x, y, spell.radius ?? 32, damage, ctx.side === 'hero' ? 'enemy' : 'hero', {
        status: spell.status,
        color,
      });
      break;
    }
    case 'self': {
      const target = ctx.ally ?? caster;
      if (spell.heal) {
        const healed = target.heal(spell.heal + caster.magic * 0.6);
        world.add(new OneShotFx(world.assets.fx.heal, target.x, target.y - 4, { depthBias: 12 }));
        world.particles.emit('magic', target.x, target.y - target.h, 10, { speed: 30, color: '#8dffb0' });
        if (healed > 0) {
          world.add(new FloatingText(`+${Math.round(healed)}`, target.x, target.y - target.h - 10, '#8dffb0'));
        }
      }
      break;
    }
    case 'aura': {
      const target = ctx.ally ?? caster;
      if (spell.shieldAmount) {
        target.status.shield.time = 10;
        target.status.shield.amount = spell.shieldAmount + caster.magic;
        world.add(new OneShotFx(world.assets.fx.shield, target.x, target.y - target.h / 2, { depthBias: 12, life: 0.9 }));
      } else {
        // Gravity-style pull auras (used by the black hole).
        burst(world, caster.x, caster.y - caster.h / 2, spell.radius ?? 60, damage, ctx.side === 'hero' ? 'enemy' : 'hero', {
          color,
        });
      }
      break;
    }
    case 'beam': {
      burst(world, ctx.targetX, ctx.targetY, spell.radius ?? 24, damage, ctx.side === 'hero' ? 'enemy' : 'hero', { color });
      break;
    }
  }
  return true;
}

export function spellOf(id: string): SpellDef | undefined {
  return SPELLS[id];
}

/** Spells a character may use at its current level, cheapest role first. */
export function availableSpells(unlocks: Array<{ level: number; spell: string }>, level: number, base: string[]): string[] {
  const list = [...base];
  for (const u of unlocks) {
    if (level >= u.level) list.push(u.spell);
  }
  return list;
}
