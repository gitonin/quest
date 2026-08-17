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
  /** Dialogues asked for while another one is playing wait their turn here. */
  private queue: Array<{ lines: DialogueLine[]; onDone?: () => void }> = [];
  active = false;

  start(id: DialogueId, onDone?: () => void): void {
    this.play(DIALOGUES[id], onDone);
  }

  /**
   * Starts a dialogue, or queues it behind the running one. Queuing matters:
   * a trigger firing mid-conversation must never silently drop the pending
   * callback of the conversation already on screen (that callback is what hands
   * out quest items).
   */
  play(lines: DialogueLine[], onDone?: () => void): void {
    if (lines.length === 0) {
      onDone?.();
      return;
    }
    if (this.active) {
      this.queue.push({ lines, onDone });
      return;
    }
    this.begin(lines, onDone);
  }

  private begin(lines: DialogueLine[], onDone?: () => void): void {
    this.lines = lines;
    this.index = 0;
    this.revealed = 0;
    this.active = true;
    this.onDone = onDone ?? null;
  }

  /** Drops everything, used when a level unloads. */
  clear(): void {
    this.queue.length = 0;
    this.lines = [];
    this.active = false;
    this.onDone = null;
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
    if (this.index < this.lines.length) return;

    this.active = false;
    const done = this.onDone;
    this.onDone = null;
    done?.();
    // The callback may itself have started a dialogue; if not, drain the queue.
    if (!this.active) {
      const next = this.queue.shift();
      if (next) this.begin(next.lines, next.onDone);
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
