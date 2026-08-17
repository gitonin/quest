import { GAME_HEIGHT, GAME_WIDTH } from '../core/config';
import { DIALOGUES, type DialogueId, type DialogueLine } from '../data/dialogues';
import { font } from '../gfx/font';
import { UI } from '../gfx/palette';
import type { Ctx2D } from '../gfx/renderer';
import { panel } from './widgets';

const CHARS_PER_SECOND = 46;

/**
 * Pixel-art dialogue box with a typewriter reveal.
 *
 * While a dialogue is running the game keeps simulating but the player is
 * locked, which is enough for the short "cutscenes" the design asks for.
 */
export class DialogueBox {
  private lines: DialogueLine[] = [];
  private index = 0;
  private revealed = 0;
  private onDone: (() => void) | null = null;
  active = false;

  start(id: DialogueId, onDone?: () => void): void {
    this.play(DIALOGUES[id], onDone);
  }

  play(lines: DialogueLine[], onDone?: () => void): void {
    this.lines = lines;
    this.index = 0;
    this.revealed = 0;
    this.active = lines.length > 0;
    this.onDone = onDone ?? null;
    if (!this.active) this.onDone?.();
  }

  /** Advance: first completes the reveal, then moves to the next line. */
  advance(): void {
    if (!this.active) return;
    const current = this.lines[this.index];
    if (this.revealed < current.text.length) {
      this.revealed = current.text.length;
      return;
    }
    this.index++;
    this.revealed = 0;
    if (this.index >= this.lines.length) {
      this.active = false;
      const done = this.onDone;
      this.onDone = null;
      done?.();
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    const current = this.lines[this.index];
    this.revealed = Math.min(current.text.length, this.revealed + CHARS_PER_SECOND * dt);
  }

  draw(ctx: Ctx2D): void {
    if (!this.active) return;
    const line = this.lines[this.index];
    const h = 54;
    const y = GAME_HEIGHT - h - 6;
    panel(ctx, 8, y, GAME_WIDTH - 16, h);

    // Speaker tag.
    const tagW = font.measure(line.speaker) + 10;
    ctx.fillStyle = UI.panelLit;
    ctx.fillRect(14, y - 9, tagW, 11);
    ctx.strokeStyle = line.color ?? UI.border;
    ctx.strokeRect(14.5, y - 8.5, tagW - 1, 10);
    font.draw(ctx, line.speaker, 19, y - 7, line.color ?? UI.text);

    const text = line.text.slice(0, Math.floor(this.revealed));
    const wrapped = font.wrap(text, GAME_WIDTH - 40);
    wrapped.slice(0, 3).forEach((l, i) => font.draw(ctx, l, 18, y + 10 + i * 12, UI.text));

    if (this.revealed >= line.text.length) {
      const bob = Math.sin(performance.now() / 200) > 0 ? 0 : 1;
      font.draw(ctx, '▼', GAME_WIDTH - 26, y + h - 14 + bob, UI.border);
    }
  }
}
