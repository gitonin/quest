import { GAME_HEIGHT, GAME_WIDTH } from '../core/config';

export type Ctx2D = CanvasRenderingContext2D;

/**
 * Owns the display canvas plus a fixed-size back-buffer.
 *
 * Everything is drawn at 480x270 then blitted with an integer scale, which is
 * what keeps the pixel grid intact on any phone resolution and keeps the fill
 * rate low enough for 60 fps on mid-range hardware.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly buffer: HTMLCanvasElement;
  readonly ctx: Ctx2D;
  private display: Ctx2D;
  scale = 1;
  offsetX = 0;
  offsetY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.display = must(canvas.getContext('2d', { alpha: false }));
    this.buffer = document.createElement('canvas');
    this.buffer.width = GAME_WIDTH;
    this.buffer.height = GAME_HEIGHT;
    this.ctx = must(this.buffer.getContext('2d', { alpha: false }));
    this.ctx.imageSmoothingEnabled = false;
    this.display.imageSmoothingEnabled = false;
  }

  /** Fits the buffer into the viewport, preferring integer scales. */
  resize(viewportWidth: number, viewportHeight: number, dpr: number): void {
    const cssScale = Math.min(viewportWidth / GAME_WIDTH, viewportHeight / GAME_HEIGHT);
    const deviceScale = cssScale * dpr;
    // Snap down to an integer device scale when we are close enough to one,
    // otherwise the pixels shimmer while the camera pans. Never snap *up*:
    // in a small frame that would push the canvas outside its container.
    const integer = Math.floor(deviceScale);
    const useInteger = integer >= 1 && deviceScale - integer < 0.35;
    this.scale = useInteger ? integer : Math.max(0.05, deviceScale);

    const pixelW = Math.round(GAME_WIDTH * this.scale);
    const pixelH = Math.round(GAME_HEIGHT * this.scale);
    this.canvas.width = pixelW;
    this.canvas.height = pixelH;
    this.canvas.style.width = `${pixelW / dpr}px`;
    this.canvas.style.height = `${pixelH / dpr}px`;

    this.display = must(this.canvas.getContext('2d', { alpha: false }));
    this.display.imageSmoothingEnabled = false;
  }

  /**
   * Paints a message straight onto the visible canvas, before any game asset
   * exists. It is the difference between "the canvas never gets drawn to" and
   * "the game loop died": on someone else's phone, both look like black.
   */
  splash(text: string): void {
    const ctx = this.display;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = '#05050c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a227';
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = Math.max(1, this.scale);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    const size = Math.max(10, Math.round(h / 18));
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  clear(color = '#05050c'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  present(): void {
    this.display.imageSmoothingEnabled = false;
    this.display.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
  }

  /** Converts a client-space pointer position into buffer pixels. */
  clientToBuffer(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * GAME_WIDTH,
      y: ((clientY - rect.top) / rect.height) * GAME_HEIGHT,
    };
  }
}

function must<T>(value: T | null): T {
  if (!value) throw new Error('2D canvas context unavailable');
  return value;
}
