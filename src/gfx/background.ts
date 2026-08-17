import { GAME_HEIGHT, GAME_WIDTH } from '../core/config';
import { RNG } from '../core/math';
import { CASTLE, SPACE } from './palette';
import { PixelBuf } from './pixel';
import type { Ctx2D } from './renderer';

export type WorldTheme = 'forest' | 'castle' | 'space';

/**
 * Parallax backdrop drawn under the tilemap.
 *
 * The space world is the one that really uses it: three star layers scrolling at
 * different rates plus planets, galaxies and comets straight out of the
 * reference art. Forest and castle only need a tinted base since their tiles
 * cover the screen.
 */
export class Background {
  private theme: WorldTheme = 'forest';
  private starLayers: HTMLCanvasElement[] = [];
  private bodies: Array<{ canvas: HTMLCanvasElement; x: number; y: number; depth: number }> = [];
  private comets: Array<{ x: number; y: number; vx: number; vy: number; len: number; color: string }> = [];
  private time = 0;

  setTheme(theme: WorldTheme, worldW: number, worldH: number): void {
    this.theme = theme;
    this.starLayers = [];
    this.bodies = [];
    this.comets = [];
    if (theme !== 'space') return;

    const rng = new RNG(4242);
    this.starLayers = [makeStarField(rng, 90, 0.55), makeStarField(rng, 55, 0.8), makeStarField(rng, 26, 1)];

    const palettes: Array<[string, string, string]> = [
      ['#7a3b2e', '#c96a44', '#f0a26a'],
      ['#2f6b4a', '#4aa36a', '#8fd7a0'],
      ['#3b3f8c', '#6a5fd0', '#a48ef5'],
      ['#4a2f6b', '#8a5fd0', '#d0a8f5'],
    ];
    for (let i = 0; i < 5; i++) {
      const r = rng.range(14, 34);
      this.bodies.push({
        canvas: makePlanet(rng, r, rng.pick(palettes), rng.chance(0.35)).toCanvas(),
        x: rng.range(0, worldW),
        y: rng.range(0, worldH),
        depth: rng.range(0.12, 0.3),
      });
    }
    for (let i = 0; i < 3; i++) {
      this.bodies.push({
        canvas: makeGalaxy(rng, rng.range(26, 44)).toCanvas(),
        x: rng.range(0, worldW),
        y: rng.range(0, worldH),
        depth: rng.range(0.06, 0.14),
      });
    }
    for (let i = 0; i < 4; i++) {
      this.comets.push({
        x: rng.range(0, GAME_WIDTH),
        y: rng.range(0, GAME_HEIGHT),
        vx: rng.range(-46, -18),
        vy: rng.range(10, 26),
        len: rng.range(8, 20),
        color: rng.pick(['#8fe3ff', '#ffd166', '#b06cf5', '#8dffb0']),
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const c of this.comets) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < -30 || c.y > GAME_HEIGHT + 30) {
        c.x = GAME_WIDTH + 20;
        c.y = -20 + Math.random() * GAME_HEIGHT * 0.6;
      }
    }
  }

  draw(ctx: Ctx2D, camX: number, camY: number): void {
    if (this.theme === 'forest') {
      ctx.fillStyle = '#0f2a16';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      return;
    }
    if (this.theme === 'castle') {
      ctx.fillStyle = '#0c0916';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      // Slow purple mist bands.
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = CASTLE.mist;
      for (let i = 0; i < 3; i++) {
        const y = ((this.time * (6 + i * 4) + i * 90) % (GAME_HEIGHT + 60)) - 30;
        ctx.fillRect(0, y, GAME_WIDTH, 10 + i * 4);
      }
      ctx.globalAlpha = 1;
      return;
    }

    ctx.fillStyle = SPACE.voidDeep;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const depths = [0.08, 0.18, 0.34];
    this.starLayers.forEach((layer, i) => {
      const d = depths[i];
      const ox = -((camX * d) % layer.width);
      const oy = -((camY * d) % layer.height);
      for (let x = ox - layer.width; x < GAME_WIDTH; x += layer.width) {
        for (let y = oy - layer.height; y < GAME_HEIGHT; y += layer.height) {
          ctx.drawImage(layer, Math.round(x), Math.round(y));
        }
      }
    });

    for (const body of this.bodies) {
      const x = Math.round(body.x - camX * body.depth);
      const y = Math.round(body.y - camY * body.depth);
      if (x < -body.canvas.width || x > GAME_WIDTH || y < -body.canvas.height || y > GAME_HEIGHT) continue;
      ctx.drawImage(body.canvas, x, y);
    }

    for (const c of this.comets) {
      ctx.strokeStyle = c.color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(Math.round(c.x), Math.round(c.y));
      ctx.lineTo(Math.round(c.x + c.len), Math.round(c.y - c.len * 0.5));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(c.x), Math.round(c.y), 1, 1);
    }
  }
}

function makeStarField(rng: RNG, count: number, brightness: number): HTMLCanvasElement {
  const size = 160;
  const buf = new PixelBuf(size, size);
  for (let i = 0; i < count; i++) {
    const x = rng.int(0, size);
    const y = rng.int(0, size);
    const a = Math.round(rng.range(90, 255) * brightness);
    buf.set(x, y, '#ffffff', a);
    if (rng.chance(0.12)) {
      buf.set(x + 1, y, '#a8d4ff', Math.round(a * 0.5));
      buf.set(x - 1, y, '#a8d4ff', Math.round(a * 0.5));
      buf.set(x, y + 1, '#a8d4ff', Math.round(a * 0.5));
      buf.set(x, y - 1, '#a8d4ff', Math.round(a * 0.5));
    }
  }
  return buf.toCanvas();
}

function makePlanet(rng: RNG, r: number, colors: [string, string, string], ringed: boolean): PixelBuf {
  const pad = ringed ? Math.round(r * 1.9) : r + 2;
  const size = pad * 2;
  const buf = new PixelBuf(size, size);
  const c = size / 2;
  buf.ellipse(c, c, r, r, colors[1]);
  // Bands + craters.
  for (let i = 0; i < 14; i++) {
    const bx = c + rng.range(-r, r) * 0.7;
    const by = c + rng.range(-r, r) * 0.7;
    buf.ellipse(bx, by, rng.range(2, r * 0.4), rng.range(1.5, r * 0.25), rng.chance(0.5) ? colors[0] : colors[2]);
  }
  // Terminator shading.
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      if (x + y > r * 0.5) buf.set(c + x, c + y, '#000010', 90);
      if (x + y < -r * 0.8) buf.set(c + x, c + y, '#ffffff', 40);
    }
  }
  if (ringed) {
    for (let a = 0; a < 220; a++) {
      const ang = (a / 220) * Math.PI * 2;
      for (const rr of [r * 1.5, r * 1.65, r * 1.8]) {
        const x = c + Math.cos(ang) * rr;
        const y = c + Math.sin(ang) * rr * 0.3;
        if (Math.sin(ang) > 0 && Math.hypot(x - c, y - c) < r) continue;
        buf.set(x, y, colors[2], 170);
      }
    }
  }
  return buf;
}

function makeGalaxy(rng: RNG, r: number): PixelBuf {
  const size = r * 2 + 4;
  const buf = new PixelBuf(size, size);
  const c = size / 2;
  for (let arm = 0; arm < 2; arm++) {
    for (let t = 0; t < 120; t++) {
      const p = t / 120;
      const ang = p * Math.PI * 3 + arm * Math.PI;
      const rad = p * r;
      const x = c + Math.cos(ang) * rad;
      const y = c + Math.sin(ang) * rad * 0.55;
      const color = p < 0.35 ? '#ffe9f5' : p < 0.7 ? '#b06cf5' : '#4a5fd0';
      buf.set(x, y, color, Math.round(220 * (1 - p * 0.6)));
      if (rng.chance(0.4)) buf.set(x + rng.int(-1, 2), y + rng.int(-1, 2), color, 110);
    }
  }
  buf.ellipse(c, c, 3, 2.5, '#fff6d8', 230);
  buf.ellipse(c, c, 5, 4, '#ffe9a8', 70);
  return buf;
}
