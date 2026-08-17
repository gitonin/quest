import type { Ctx2D } from './renderer';

/**
 * Bitmap font.
 *
 * Glyphs are rasterised once from a system monospace face and then thresholded
 * to 1-bit, which gives crisp pixel letters at any size while still covering the
 * full accented French charset without hand-drawing 200 glyphs.
 */
export class BitmapFont {
  readonly charW: number;
  readonly charH: number;
  readonly lineHeight: number;
  private cache = new Map<string, HTMLCanvasElement>();
  private size: number;

  constructor(size = 8) {
    this.size = size;
    this.charW = Math.round(size * 0.62);
    this.charH = size;
    this.lineHeight = size + 3;
  }

  private glyph(ch: string, color: string): HTMLCanvasElement {
    const key = `${ch}|${color}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const w = this.charW;
    const h = this.charH + 2;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.font = `${this.size}px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, 0, 1);

    // Threshold to 1-bit and recolour.
    const img = ctx.getImageData(0, 0, w, h);
    const [r, g, b] = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((v) => parseInt(v, 16));
    for (let i = 0; i < img.data.length; i += 4) {
      const on = img.data[i + 3] > 110;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = on ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    this.cache.set(key, canvas);
    return canvas;
  }

  measure(text: string): number {
    return text.length * this.charW;
  }

  draw(ctx: Ctx2D, text: string, x: number, y: number, color = '#f4f0e4', shadow = '#07050f'): void {
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const ch of text) {
      if (ch !== ' ') {
        if (shadow) ctx.drawImage(this.glyph(ch, shadow), cx + 1, cy + 1);
        ctx.drawImage(this.glyph(ch, color), cx, cy);
      }
      cx += this.charW;
    }
  }

  drawCentered(ctx: Ctx2D, text: string, cx: number, y: number, color?: string, shadow?: string): void {
    this.draw(ctx, text, cx - this.measure(text) / 2, y, color, shadow);
  }

  /** Greedy word wrap, returns the wrapped lines. */
  wrap(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.measure(candidate) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
}

export const font = new BitmapFont(8);
export const fontBig = new BitmapFont(12);
