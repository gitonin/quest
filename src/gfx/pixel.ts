/**
 * Tiny pixel-art drawing surface.
 *
 * All generated art goes through this class so every sprite in the game shares
 * the same "one pixel is one pixel" discipline: no anti-aliasing, no sub-pixel
 * coordinates, and dithering helpers for the 16-bit look.
 */
export class PixelBuf {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    // Dimensions are always whole pixels - callers often derive them from
    // floating-point radii, and a fractional size desyncs the backing buffer
    // from the ImageData created in `toCanvas`.
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.data = new Uint8ClampedArray(this.width * this.height * 4);
  }

  clone(): PixelBuf {
    const copy = new PixelBuf(this.width, this.height);
    copy.data.set(this.data);
    return copy;
  }

  set(x: number, y: number, color: string, alpha = 255): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b] = parseHex(color);
    const i = (y * this.width + x) * 4;
    if (alpha >= 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
      return;
    }
    // Simple source-over blend, enough for glows and shadows.
    const a = alpha / 255;
    const dstA = this.data[i + 3] / 255;
    const outA = a + dstA * (1 - a);
    if (outA <= 0) return;
    this.data[i] = (r * a + this.data[i] * dstA * (1 - a)) / outA;
    this.data[i + 1] = (g * a + this.data[i + 1] * dstA * (1 - a)) / outA;
    this.data[i + 2] = (b * a + this.data[i + 2] * dstA * (1 - a)) / outA;
    this.data[i + 3] = outA * 255;
  }

  get(x: number, y: number): [number, number, number, number] {
    const i = ((y | 0) * this.width + (x | 0)) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  isOpaque(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.data[((y | 0) * this.width + (x | 0)) * 4 + 3] > 32;
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 255): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color, alpha);
    }
  }

  outlineRect(x: number, y: number, w: number, h: number, color: string): void {
    this.hline(x, x + w - 1, y, color);
    this.hline(x, x + w - 1, y + h - 1, color);
    this.vline(x, y, y + h - 1, color);
    this.vline(x + w - 1, y, y + h - 1, color);
  }

  hline(x0: number, x1: number, y: number, color: string, alpha = 255): void {
    const [a, b] = x0 <= x1 ? [x0, x1] : [x1, x0];
    for (let x = a; x <= b; x++) this.set(x, y, color, alpha);
  }

  vline(x: number, y0: number, y1: number, color: string, alpha = 255): void {
    const [a, b] = y0 <= y1 ? [y0, y1] : [y1, y0];
    for (let y = a; y <= b; y++) this.set(x, y, color, alpha);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, alpha = 255): void {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, color, alpha);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, alpha = 255): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, color, alpha);
      }
    }
  }

  ellipseOutline(cx: number, cy: number, rx: number, ry: number, color: string, alpha = 255): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d <= 1 && d > 0.55) this.set(x, y, color, alpha);
      }
    }
  }

  /** Checkerboard fill - the classic 16-bit way to fake an extra shade. */
  dither(x: number, y: number, w: number, h: number, color: string, phase = 0): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if ((xx + yy + phase) % 2 === 0) this.set(xx, yy, color);
      }
    }
  }

  /** Draws a 1px darker border around every opaque cluster. */
  outline(color: string, alpha = 255): void {
    const snapshot = this.clone();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (snapshot.isOpaque(x, y)) continue;
        if (
          snapshot.isOpaque(x - 1, y) ||
          snapshot.isOpaque(x + 1, y) ||
          snapshot.isOpaque(x, y - 1) ||
          snapshot.isOpaque(x, y + 1)
        ) {
          this.set(x, y, color, alpha);
        }
      }
    }
  }

  /** Copies another buffer at an offset, honouring transparency. */
  blit(src: PixelBuf, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const [r, g, b, a] = src.get(x, y);
        if (a === 0) continue;
        const tx = flipX ? dx + (src.width - 1 - x) : dx + x;
        this.setRGBA(tx, dy + y, r, g, b, a);
      }
    }
  }

  setRGBA(x: number, y: number, r: number, g: number, b: number, a: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    if (a >= 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
      return;
    }
    const sa = a / 255;
    const dstA = this.data[i + 3] / 255;
    const outA = sa + dstA * (1 - sa);
    if (outA <= 0) return;
    this.data[i] = (r * sa + this.data[i] * dstA * (1 - sa)) / outA;
    this.data[i + 1] = (g * sa + this.data[i + 1] * dstA * (1 - sa)) / outA;
    this.data[i + 2] = (b * sa + this.data[i + 2] * dstA * (1 - sa)) / outA;
    this.data[i + 3] = outA * 255;
  }

  /** Shifts the whole buffer, used for cheap bob/recoil animation frames. */
  shifted(dx: number, dy: number): PixelBuf {
    const out = new PixelBuf(this.width, this.height);
    out.blit(this, dx, dy);
    return out;
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    const img = ctx.createImageData(this.width, this.height);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}

const hexCache = new Map<string, [number, number, number]>();

export function parseHex(hex: string): [number, number, number] {
  const cached = hexCache.get(hex);
  if (cached) return cached;
  const v = parseInt(hex.slice(1), 16);
  const rgb: [number, number, number] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  hexCache.set(hex, rgb);
  return rgb;
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

export function shade(color: string, amount: number): string {
  return amount >= 0 ? mix(color, '#ffffff', amount) : mix(color, '#000000', -amount);
}
