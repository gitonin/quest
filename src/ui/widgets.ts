import { font } from '../gfx/font';
import { UI } from '../gfx/palette';
import type { Ctx2D } from '../gfx/renderer';

/** Classic double-border RPG panel. */
export function panel(ctx: Ctx2D, x: number, y: number, w: number, h: number, alpha = 0.92): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = UI.panel;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = UI.borderDark;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = UI.border;
  ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
}

export function bar(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
  back: string,
): void {
  ctx.fillStyle = '#07050f';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.round(w * Math.min(1, Math.max(0, ratio)))), h);
  // Glossy top line, the 16-bit staple.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, Math.round(w * Math.min(1, Math.max(0, ratio))), 1);
  ctx.globalAlpha = 1;
}

export interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawButton(ctx: Ctx2D, rect: ButtonRect, label: string, selected: boolean): void {
  panel(ctx, rect.x, rect.y, rect.w, rect.h, selected ? 0.95 : 0.8);
  if (selected) {
    ctx.strokeStyle = UI.text;
    ctx.strokeRect(rect.x + 4.5, rect.y + 4.5, rect.w - 9, rect.h - 9);
  }
  font.drawCentered(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 - 4, selected ? UI.text : UI.textDim);
}

export function hitTest(rect: ButtonRect, x: number, y: number, padding = 6): boolean {
  return (
    x >= rect.x - padding && x <= rect.x + rect.w + padding && y >= rect.y - padding && y <= rect.y + rect.h + padding
  );
}
