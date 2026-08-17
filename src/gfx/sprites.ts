import type { Ctx2D } from './renderer';
import type { PixelBuf } from './pixel';

/** A horizontal strip of equally sized frames living in one canvas. */
export class FrameStrip {
  readonly canvas: HTMLCanvasElement;
  readonly frameW: number;
  readonly frameH: number;
  readonly count: number;

  constructor(frames: PixelBuf[]) {
    if (frames.length === 0) throw new Error('FrameStrip needs at least one frame');
    this.frameW = frames[0].width;
    this.frameH = frames[0].height;
    this.count = frames.length;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.frameW * this.count;
    this.canvas.height = this.frameH;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    ctx.imageSmoothingEnabled = false;
    frames.forEach((f, i) => ctx.drawImage(f.toCanvas(), i * this.frameW, 0));
  }

  draw(ctx: Ctx2D, index: number, x: number, y: number, flipX = false): void {
    const i = Math.min(this.count - 1, Math.max(0, index | 0));
    if (!flipX) {
      ctx.drawImage(
        this.canvas,
        i * this.frameW,
        0,
        this.frameW,
        this.frameH,
        x | 0,
        y | 0,
        this.frameW,
        this.frameH,
      );
      return;
    }
    ctx.save();
    ctx.translate((x | 0) + this.frameW, y | 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.canvas, i * this.frameW, 0, this.frameW, this.frameH, 0, 0, this.frameW, this.frameH);
    ctx.restore();
  }
}

export interface AnimClip {
  strip: FrameStrip;
  fps: number;
  loop: boolean;
  /** Optional per-frame ordering, defaults to 0..count-1. */
  order?: number[];
}

export type AnimBank = Record<string, AnimClip>;

/**
 * Plays clips from a bank. Keys are `"<state>_<facing>"` (e.g. `walk_left`) with
 * a `<state>` fallback for direction-less creatures.
 */
export class Animator {
  private bank: AnimBank;
  private current = '';
  private time = 0;
  finished = false;

  constructor(bank: AnimBank, initial: string) {
    this.bank = bank;
    this.play(initial, true);
  }

  play(key: string, restart = false): void {
    if (this.current === key && !restart) return;
    if (!this.bank[key]) return;
    this.current = key;
    this.time = 0;
    this.finished = false;
  }

  get key(): string {
    return this.current;
  }

  has(key: string): boolean {
    return Boolean(this.bank[key]);
  }

  update(dt: number): void {
    const clip = this.bank[this.current];
    if (!clip) return;
    const length = clip.order ? clip.order.length : clip.strip.count;
    this.time += dt;
    const total = length / clip.fps;
    if (!clip.loop && this.time >= total) {
      this.time = total - 1e-4;
      this.finished = true;
    }
  }

  /** Normalised progress through the clip, 0..1. */
  get progress(): number {
    const clip = this.bank[this.current];
    if (!clip) return 0;
    const length = clip.order ? clip.order.length : clip.strip.count;
    return Math.min(1, this.time / (length / clip.fps));
  }

  draw(ctx: Ctx2D, x: number, y: number, flipX = false): void {
    const clip = this.bank[this.current];
    if (!clip) return;
    const length = clip.order ? clip.order.length : clip.strip.count;
    let idx = Math.floor(this.time * clip.fps);
    idx = clip.loop ? idx % length : Math.min(idx, length - 1);
    const frame = clip.order ? clip.order[idx] : idx;
    clip.strip.draw(ctx, frame, x, y, flipX);
  }

  get frameSize(): { w: number; h: number } {
    const clip = this.bank[this.current];
    return clip ? { w: clip.strip.frameW, h: clip.strip.frameH } : { w: 0, h: 0 };
  }
}

export function clip(strip: FrameStrip, fps: number, loop = true, order?: number[]): AnimClip {
  return order ? { strip, fps, loop, order } : { strip, fps, loop };
}
