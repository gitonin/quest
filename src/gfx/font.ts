import type { Ctx2D } from './renderer';

interface Atlas {
  canvas: HTMLCanvasElement;
  ctx: Ctx2D;
  /** Cell index per already-rasterised character. */
  slots: Map<string, number>;
  next: number;
}

const COLUMNS = 16;
const ROWS = 16;
const CAPACITY = COLUMNS * ROWS;

/**
 * Bitmap font.
 *
 * Glyphs are rasterised once from a system monospace face and thresholded to
 * 1-bit, which gives crisp pixel letters without hand-drawing 200 glyphs and
 * still covers the full accented French charset.
 *
 * Each colour gets ONE small atlas canvas holding up to 256 glyphs. Handing out
 * a canvas per glyph instead would mean hundreds of canvases, which mobile
 * Safari refuses once its canvas budget is spent - and a refused canvas draws
 * as nothing at all.
 */
export class BitmapFont {
  readonly charW: number;
  readonly charH: number;
  readonly lineHeight: number;
  private size: number;
  private cellW: number;
  private cellH: number;
  private atlases = new Map<string, Atlas>();
  private scratch: HTMLCanvasElement | null = null;
  private scratchCtx: Ctx2D | null = null;

  constructor(size = 8) {
    this.size = size;
    this.charW = Math.round(size * 0.62);
    this.charH = size;
    this.lineHeight = size + 3;
    this.cellW = this.charW;
    this.cellH = this.charH + 2;
  }

  private atlasFor(color: string): Atlas {
    const existing = this.atlases.get(color);
    if (existing) return existing;
    const canvas = document.createElement('canvas');
    canvas.width = this.cellW * COLUMNS;
    canvas.height = this.cellH * ROWS;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable (font atlas)');
    ctx.imageSmoothingEnabled = false;
    const atlas: Atlas = { canvas, ctx, slots: new Map(), next: 0 };
    this.atlases.set(color, atlas);
    return atlas;
  }

  /** Rasterises one character into the atlas and returns its cell index. */
  private slotFor(atlas: Atlas, ch: string, color: string): number {
    const known = atlas.slots.get(ch);
    if (known !== undefined) return known;

    if (!this.scratch) {
      this.scratch = document.createElement('canvas');
      this.scratch.width = this.cellW;
      this.scratch.height = this.cellH;
      this.scratchCtx = this.scratch.getContext('2d');
    }
    const sctx = this.scratchCtx;
    if (!sctx) return 0;

    sctx.clearRect(0, 0, this.cellW, this.cellH);
    sctx.font = `${this.size}px monospace`;
    sctx.textBaseline = 'top';
    sctx.fillStyle = '#ffffff';
    sctx.fillText(ch, 0, 1);

    const img = sctx.getImageData(0, 0, this.cellW, this.cellH);
    const [r, g, b] = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((v) => parseInt(v, 16));
    for (let i = 0; i < img.data.length; i += 4) {
      const on = img.data[i + 3] > 110;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = on ? 255 : 0;
    }

    // Wrap around when full: rare, and reusing a cell is better than growing.
    const slot = atlas.next % CAPACITY;
    atlas.next++;
    atlas.slots.set(ch, slot);
    atlas.ctx.putImageData(img, (slot % COLUMNS) * this.cellW, Math.floor(slot / COLUMNS) * this.cellH);
    return slot;
  }

  measure(text: string): number {
    return text.length * this.charW;
  }

  draw(ctx: Ctx2D, text: string, x: number, y: number, color = '#f4f0e4', shadow = '#07050f'): void {
    const cy = Math.round(y);
    if (shadow) this.drawLayer(ctx, text, Math.round(x) + 1, cy + 1, shadow);
    this.drawLayer(ctx, text, Math.round(x), cy, color);
  }

  private drawLayer(ctx: Ctx2D, text: string, x: number, y: number, color: string): void {
    const atlas = this.atlasFor(color);
    let cx = x;
    for (const ch of text) {
      if (ch !== ' ') {
        const slot = this.slotFor(atlas, ch, color);
        ctx.drawImage(
          atlas.canvas,
          (slot % COLUMNS) * this.cellW,
          Math.floor(slot / COLUMNS) * this.cellH,
          this.cellW,
          this.cellH,
          cx,
          y,
          this.cellW,
          this.cellH,
        );
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
