import { GAME_HEIGHT, GAME_WIDTH } from '../core/config';
import type { Ctx2D } from './renderer';

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: string;
  flicker?: number;
}

/**
 * Cheap pixel-friendly lighting: one darkness layer per frame, punched through
 * with radial gradients, then composited with `multiply`. Only the dark worlds
 * pay for it - the forest just gets a warm colour grade.
 */
export class Lighting {
  private layer: HTMLCanvasElement;
  private lctx: Ctx2D;
  private time = 0;
  ambient = '#000000';
  ambientAlpha = 0;
  tint: string | null = null;
  tintAlpha = 0;

  constructor() {
    this.layer = document.createElement('canvas');
    this.layer.width = GAME_WIDTH;
    this.layer.height = GAME_HEIGHT;
    this.lctx = this.layer.getContext('2d')!;
  }

  configure(preset: 'forest' | 'castle' | 'space' | 'poison'): void {
    switch (preset) {
      case 'forest':
        this.ambient = '#0d2a12';
        this.ambientAlpha = 0.18;
        this.tint = '#ffdd88';
        this.tintAlpha = 0.07;
        break;
      case 'poison':
        this.ambient = '#132a08';
        this.ambientAlpha = 0.42;
        this.tint = '#8fd76a';
        this.tintAlpha = 0.1;
        break;
      case 'castle':
        this.ambient = '#0a0618';
        this.ambientAlpha = 0.62;
        this.tint = '#4a2f6e';
        this.tintAlpha = 0.12;
        break;
      case 'space':
        this.ambient = '#050320';
        this.ambientAlpha = 0.4;
        this.tint = '#2a3fa0';
        this.tintAlpha = 0.1;
        break;
    }
  }

  update(dt: number): void {
    this.time += dt;
  }

  draw(ctx: Ctx2D, lights: LightSource[], camX: number, camY: number): void {
    if (this.tint && this.tintAlpha > 0) {
      ctx.globalAlpha = this.tintAlpha;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = this.tint;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (this.ambientAlpha <= 0) return;

    const l = this.lctx;
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = this.ambient;
    l.globalAlpha = 1;
    l.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    l.globalCompositeOperation = 'destination-out';
    for (const light of lights) {
      const x = light.x - camX;
      const y = light.y - camY;
      const flicker = light.flicker ? 1 + Math.sin(this.time * 11 + x) * light.flicker : 1;
      const r = light.radius * flicker;
      if (x + r < 0 || x - r > GAME_WIDTH || y + r < 0 || y - r > GAME_HEIGHT) continue;
      const grad = l.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.75)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = grad;
      l.beginPath();
      l.arc(x, y, r, 0, Math.PI * 2);
      l.fill();
    }
    l.globalCompositeOperation = 'source-over';

    ctx.globalAlpha = this.ambientAlpha;
    ctx.drawImage(this.layer, 0, 0);
    ctx.globalAlpha = 1;
  }
}
