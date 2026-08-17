import { GAME_HEIGHT, GAME_WIDTH } from '../core/config';
import { RNG } from '../core/math';
import type { Ctx2D } from './renderer';

export type ParticleKind = 'dust' | 'spark' | 'blood' | 'leaf' | 'ember' | 'stardust' | 'magic' | 'poison';

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  sway: number;
}

const POOL_SIZE = 320;

/**
 * Fixed-size particle pool - no allocation during play, which keeps the GC
 * quiet on mobile. Ambient emitters (leaves, embers, stardust) run in screen
 * space; combat bursts run in world space.
 */
export class Particles {
  private pool: Particle[] = [];
  private rng = new RNG(20240517);
  private ambient: ParticleKind | null = null;
  private ambientTimer = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({
        alive: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: '#fff',
        gravity: 0,
        drag: 0,
        sway: 0,
      });
    }
  }

  setAmbient(kind: ParticleKind | null): void {
    this.ambient = kind;
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
  }

  private spawn(): Particle | null {
    for (const p of this.pool) {
      if (!p.alive) return p;
    }
    return null;
  }

  emit(
    kind: ParticleKind,
    x: number,
    y: number,
    count: number,
    opts: { dirX?: number; dirY?: number; speed?: number; spread?: number; color?: string } = {},
  ): void {
    const speed = opts.speed ?? 40;
    const spread = opts.spread ?? Math.PI * 2;
    const baseAngle = opts.dirX !== undefined || opts.dirY !== undefined ? Math.atan2(opts.dirY ?? 0, opts.dirX ?? 0) : 0;
    for (let i = 0; i < count; i++) {
      const p = this.spawn();
      if (!p) return;
      const ang = baseAngle + this.rng.range(-spread / 2, spread / 2);
      const spd = speed * this.rng.range(0.5, 1.3);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.sway = 0;
      p.drag = 2.5;
      p.gravity = 0;
      p.size = 1;
      p.maxLife = 0.4;

      switch (kind) {
        case 'dust':
          p.color = opts.color ?? '#d9c9a0';
          p.maxLife = this.rng.range(0.25, 0.5);
          p.gravity = -8;
          break;
        case 'spark':
          p.color = opts.color ?? '#fff6d8';
          p.maxLife = this.rng.range(0.2, 0.45);
          p.gravity = 60;
          break;
        case 'blood':
          p.color = opts.color ?? '#8c2033';
          p.maxLife = this.rng.range(0.3, 0.6);
          p.gravity = 120;
          break;
        case 'magic':
          p.color = opts.color ?? '#8fe3ff';
          p.maxLife = this.rng.range(0.35, 0.7);
          p.gravity = -20;
          p.drag = 1.5;
          break;
        case 'poison':
          p.color = opts.color ?? '#8fd76a';
          p.maxLife = this.rng.range(0.5, 1);
          p.gravity = -14;
          p.drag = 1.8;
          break;
        default:
          p.color = opts.color ?? '#ffffff';
          break;
      }
      p.life = p.maxLife;
    }
  }

  /** Screen-space ambient emitters keep the world feeling alive while idle. */
  private emitAmbient(dt: number, camX: number, camY: number): void {
    if (!this.ambient) return;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = this.ambient === 'stardust' ? 0.12 : 0.28;

    const p = this.spawn();
    if (!p) return;
    p.alive = true;
    p.x = camX + this.rng.range(-20, GAME_WIDTH + 20);
    p.y = camY + this.rng.range(-20, GAME_HEIGHT + 20);
    p.drag = 0.2;
    p.size = 1;

    if (this.ambient === 'leaf') {
      p.y = camY - 10;
      p.vx = this.rng.range(-16, -4);
      p.vy = this.rng.range(8, 20);
      p.gravity = 6;
      p.sway = this.rng.range(8, 22);
      p.maxLife = this.rng.range(3, 6);
      p.color = this.rng.pick(['#6fd05a', '#39a642', '#f0c04a']);
    } else if (this.ambient === 'ember') {
      p.y = camY + GAME_HEIGHT + 6;
      p.vx = this.rng.range(-6, 6);
      p.vy = this.rng.range(-22, -10);
      p.gravity = -4;
      p.sway = this.rng.range(4, 12);
      p.maxLife = this.rng.range(2, 4);
      p.color = this.rng.pick(['#ffb03a', '#ffe6a1', '#8c2033']);
    } else {
      p.vx = this.rng.range(-8, 8);
      p.vy = this.rng.range(-8, 8);
      p.gravity = 0;
      p.sway = this.rng.range(2, 8);
      p.maxLife = this.rng.range(2, 5);
      p.color = this.rng.pick(['#ffffff', '#a8d4ff', '#b06cf5', '#8fe3ff']);
    }
    p.life = p.maxLife;
  }

  update(dt: number, camX: number, camY: number): void {
    this.emitAmbient(dt, camX, camY);
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += (p.vx + (p.sway ? Math.sin(p.life * 4) * p.sway : 0)) * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: Ctx2D, camX: number, camY: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
