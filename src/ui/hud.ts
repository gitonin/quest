import { GAME_WIDTH } from '../core/config';
import { CHARACTERS } from '../data/characters';
import { xpForLevel } from '../data/characters';
import { font } from '../gfx/font';
import { UI } from '../gfx/palette';
import type { Ctx2D } from '../gfx/renderer';
import type { Companion } from '../entities/companion';
import type { Player } from '../entities/player';
import type { Enemy } from '../entities/enemy';
import { bar, panel } from './widgets';

interface Toast {
  text: string;
  life: number;
}

/**
 * In-game HUD: the knight's gauges, the party strip, the current objective and
 * the boss bar. Deliberately compact - a phone screen is mostly playfield.
 */
export class Hud {
  private toasts: Toast[] = [];
  objective = '';
  worldTitle = '';

  toast(text: string): void {
    this.toasts.push({ text, life: 2.6 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  update(dt: number): void {
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
  }

  draw(ctx: Ctx2D, player: Player, companions: Companion[], boss: Enemy | null, inventoryCount: number): void {
    // Knight gauges.
    panel(ctx, 4, 4, 116, 34, 0.72);
    font.draw(ctx, `NV ${player.level}`, 9, 8, UI.text);
    font.draw(ctx, `${Math.ceil(player.hp)}/${player.maxHp}`, 60, 8, UI.textDim);
    bar(ctx, 9, 18, 104, 5, player.hp / player.maxHp, UI.hp, UI.hpDark);
    bar(ctx, 9, 26, 104, 3, player.mp / player.maxMp, UI.mp, UI.mpDark);
    const nextXp = xpForLevel(player.level + 1);
    const prevXp = xpForLevel(player.level);
    bar(ctx, 9, 31, 104, 2, (player.xp - prevXp) / Math.max(1, nextXp - prevXp), UI.xp, '#3a2f10');

    // Party strip.
    companions.forEach((c, i) => {
      const y = 42 + i * 16;
      panel(ctx, 4, y, 84, 14, 0.6);
      font.draw(ctx, CHARACTERS[c.charId].shortName, 8, y + 3, c.isDead ? '#6b6383' : UI.text);
      bar(ctx, 46, y + 4, 36, 3, c.hp / c.maxHp, c.isDead ? '#4a2b2f' : UI.hp, UI.hpDark);
      bar(ctx, 46, y + 9, 36, 2, c.mp / c.maxMp, UI.mp, UI.mpDark);
    });

    // Objective + inventory count.
    if (this.objective) {
      const text = this.objective.toUpperCase();
      const w = Math.min(GAME_WIDTH - 130, font.measure(text) + 12);
      panel(ctx, GAME_WIDTH - w - 60, 4, w, 16, 0.55);
      font.draw(ctx, text, GAME_WIDTH - w - 54, 9, UI.textDim);
    }
    if (inventoryCount > 0) {
      font.draw(ctx, `x${inventoryCount}`, GAME_WIDTH - 52, 24, UI.textDim);
    }

    // Boss bar.
    if (boss && !boss.isDead) {
      const w = 220;
      const x = (GAME_WIDTH - w) / 2;
      font.drawCentered(ctx, boss.def.name.toUpperCase(), GAME_WIDTH / 2, 6, UI.text);
      bar(ctx, x, 18, w, 6, boss.hp / boss.maxHp, '#b03247', '#3a0d12');
    }

    // Toasts.
    this.toasts.forEach((t, i) => {
      const alpha = Math.min(1, t.life * 2);
      ctx.globalAlpha = alpha;
      const w = font.measure(t.text) + 16;
      panel(ctx, (GAME_WIDTH - w) / 2, 34 + i * 16, w, 14, 0.8 * alpha);
      font.drawCentered(ctx, t.text, GAME_WIDTH / 2, 38 + i * 16, UI.border);
      ctx.globalAlpha = 1;
    });
  }
}
