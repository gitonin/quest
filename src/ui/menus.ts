import { GAME_HEIGHT, GAME_WIDTH } from '../core/config';
import { ITEMS } from '../data/items';
import { font, fontBig } from '../gfx/font';
import { UI } from '../gfx/palette';
import type { Ctx2D } from '../gfx/renderer';
import { formatPlayTime, type SaveData, type Settings } from '../save/saveManager';
import { drawButton, hitTest, panel, type ButtonRect } from './widgets';

export interface MenuItem {
  id: string;
  label: string;
  rect: ButtonRect;
}

/**
 * All full-screen menus (title, slots, pause, inventory, settings).
 *
 * They share one hit-testing model: each screen builds a list of rects, the
 * pointer layer calls `hit(x, y)` and gets an id back. Touch targets are padded
 * by default in `hitTest`.
 */
export class Menus {
  private items: MenuItem[] = [];

  hit(x: number, y: number): string | null {
    for (const item of this.items) {
      if (hitTest(item.rect, x, y, 8)) return item.id;
    }
    return null;
  }

  private reset(): void {
    this.items = [];
  }

  private add(id: string, label: string, rect: ButtonRect): MenuItem {
    const item = { id, label, rect };
    this.items.push(item);
    return item;
  }

  drawTitle(ctx: Ctx2D, slots: Array<SaveData | null>, time: number): void {
    this.reset();
    ctx.fillStyle = '#07050f';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Starfield backdrop so the title screen already sets the tone.
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % GAME_WIDTH;
      const y = (i * 53) % (GAME_HEIGHT - 40);
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.6 + i));
      ctx.globalAlpha = twinkle * 0.8;
      ctx.fillStyle = i % 7 === 0 ? '#b06cf5' : '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    fontBig.drawCentered(ctx, 'LA QUÊTE DES', GAME_WIDTH / 2, 42, '#c9a227');
    fontBig.drawCentered(ctx, 'TROIS ÉTOILES', GAME_WIDTH / 2, 58, '#f4f0e4');
    font.drawCentered(ctx, 'UN ACTION-RPG 16 BITS', GAME_WIDTH / 2, 78, UI.textDim);

    slots.forEach((slot, i) => {
      const rect = { x: GAME_WIDTH / 2 - 110, y: 104 + i * 34, w: 220, h: 28 };
      this.add(`slot${i}`, '', rect);
      panel(ctx, rect.x, rect.y, rect.w, rect.h, 0.85);
      if (slot) {
        font.draw(ctx, `SLOT ${i + 1}`, rect.x + 10, rect.y + 6, UI.text);
        font.draw(ctx, `MONDE ${slot.world}`, rect.x + 74, rect.y + 6, UI.border);
        font.draw(ctx, `NV ${slot.knight.level}`, rect.x + 150, rect.y + 6, UI.textDim);
        font.draw(ctx, `TEMPS ${formatPlayTime(slot.playTime)}`, rect.x + 10, rect.y + 17, UI.textDim);
        const eraseRect = { x: rect.x + rect.w - 26, y: rect.y + 14, w: 20, h: 10 };
        this.add(`erase${i}`, '', eraseRect);
        font.draw(ctx, 'EFF.', eraseRect.x, eraseRect.y + 1, '#d64550');
      } else {
        font.draw(ctx, `SLOT ${i + 1} — NOUVELLE PARTIE`, rect.x + 10, rect.y + 10, UI.textDim);
      }
    });

    font.drawCentered(ctx, 'TOUCHEZ UN SLOT POUR JOUER', GAME_WIDTH / 2, GAME_HEIGHT - 22, UI.textDim);
  }

  drawPause(ctx: Ctx2D, world: string, objective: string): void {
    this.reset();
    dim(ctx);
    panel(ctx, GAME_WIDTH / 2 - 90, 40, 180, 172);
    fontBig.drawCentered(ctx, 'PAUSE', GAME_WIDTH / 2, 52, UI.border);
    font.drawCentered(ctx, world.toUpperCase(), GAME_WIDTH / 2, 72, UI.textDim);
    const lines = font.wrap(objective.toUpperCase(), 150);
    lines.slice(0, 2).forEach((l, i) => font.drawCentered(ctx, l, GAME_WIDTH / 2, 84 + i * 10, UI.text));

    const options: Array<[string, string]> = [
      ['resume', 'REPRENDRE'],
      ['inventory', 'INVENTAIRE'],
      ['settings', 'PARAMÈTRES'],
      ['save', 'SAUVEGARDER'],
      ['title', 'MENU PRINCIPAL'],
    ];
    options.forEach(([id, label], i) => {
      const rect = { x: GAME_WIDTH / 2 - 74, y: 106 + i * 20, w: 148, h: 17 };
      this.add(id, label, rect);
      drawButton(ctx, rect, label, false);
    });
  }

  drawInventory(ctx: Ctx2D, inventory: Record<string, number>, quests: string[]): void {
    this.reset();
    dim(ctx);
    panel(ctx, 30, 24, GAME_WIDTH - 60, GAME_HEIGHT - 60);
    fontBig.drawCentered(ctx, 'INVENTAIRE', GAME_WIDTH / 2, 32, UI.border);

    const entries = Object.entries(inventory).filter(([, n]) => n > 0);
    if (entries.length === 0) font.draw(ctx, 'AUCUN OBJET', 46, 56, UI.textDim);
    entries.slice(0, 8).forEach(([id, count], i) => {
      const item = ITEMS[id];
      const y = 52 + i * 16;
      const rect = { x: 42, y, w: 180, h: 14 };
      if (item?.kind === 'consumable') this.add(`use:${id}`, '', rect);
      font.draw(ctx, `${item?.name ?? id}`, 46, y + 3, UI.text);
      font.draw(ctx, `x${count}`, 196, y + 3, UI.textDim);
      if (item?.kind === 'consumable') font.draw(ctx, 'UTILISER', 232, y + 3, UI.border);
    });

    font.draw(ctx, 'QUÊTE', GAME_WIDTH - 170, 52, UI.border);
    quests.slice(0, 8).forEach((line, i) => {
      font.draw(ctx, line, GAME_WIDTH - 170, 66 + i * 11, UI.textDim);
    });

    const close = { x: GAME_WIDTH / 2 - 40, y: GAME_HEIGHT - 44, w: 80, h: 18 };
    this.add('close', 'FERMER', close);
    drawButton(ctx, close, 'FERMER', false);
  }

  drawSettings(ctx: Ctx2D, settings: Settings): void {
    this.reset();
    dim(ctx);
    panel(ctx, 60, 30, GAME_WIDTH - 120, GAME_HEIGHT - 70);
    fontBig.drawCentered(ctx, 'PARAMÈTRES', GAME_WIDTH / 2, 38, UI.border);

    const rows: Array<[string, string, string]> = [
      ['music', 'MUSIQUE', `${Math.round(settings.musicVolume * 100)}%`],
      ['sfx', 'EFFETS', `${Math.round(settings.sfxVolume * 100)}%`],
      ['shake', 'SECOUSSES', settings.screenShake ? 'OUI' : 'NON'],
      ['hand', 'GAUCHER', settings.leftHanded ? 'OUI' : 'NON'],
    ];
    rows.forEach(([id, label, value], i) => {
      const y = 62 + i * 24;
      font.draw(ctx, label, 80, y + 4, UI.text);
      const minus = { x: 250, y, w: 20, h: 16 };
      const plus = { x: 320, y, w: 20, h: 16 };
      this.add(`${id}:down`, '-', minus);
      this.add(`${id}:up`, '+', plus);
      drawButton(ctx, minus, '-', false);
      drawButton(ctx, plus, '+', false);
      font.drawCentered(ctx, value, 295, y + 4, UI.border);
    });

    const close = { x: GAME_WIDTH / 2 - 40, y: GAME_HEIGHT - 48, w: 80, h: 18 };
    this.add('close', 'FERMER', close);
    drawButton(ctx, close, 'FERMER', false);
  }

  drawGameOver(ctx: Ctx2D): void {
    this.reset();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#12060a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.globalAlpha = 1;
    fontBig.drawCentered(ctx, 'VOUS ÊTES TOMBÉ', GAME_WIDTH / 2, 90, '#d64550');
    const retry = { x: GAME_WIDTH / 2 - 70, y: 130, w: 140, h: 20 };
    const title = { x: GAME_WIDTH / 2 - 70, y: 158, w: 140, h: 20 };
    this.add('retry', 'REPRENDRE', retry);
    this.add('title', 'MENU PRINCIPAL', title);
    drawButton(ctx, retry, 'REPRENDRE', true);
    drawButton(ctx, title, 'MENU PRINCIPAL', false);
  }

  drawEnding(ctx: Ctx2D, time: number, stats: { level: number; playTime: number }): void {
    this.reset();
    ctx.fillStyle = '#05030f';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 120; i++) {
      const x = (i * 61) % GAME_WIDTH;
      const y = (i * 37 + Math.floor(time * 8)) % GAME_HEIGHT;
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(time + i));
      ctx.fillStyle = i % 5 === 0 ? '#ffd166' : '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
    fontBig.drawCentered(ctx, "L'ÉTOILE MAGIQUE EST SAUVE", GAME_WIDTH / 2, 80, '#ffd166');
    font.drawCentered(ctx, `NIVEAU FINAL ${stats.level}`, GAME_WIDTH / 2, 108, UI.text);
    font.drawCentered(ctx, `TEMPS ${formatPlayTime(stats.playTime)}`, GAME_WIDTH / 2, 122, UI.text);
    const back = { x: GAME_WIDTH / 2 - 70, y: 156, w: 140, h: 20 };
    this.add('title', 'MENU PRINCIPAL', back);
    drawButton(ctx, back, 'MENU PRINCIPAL', true);
  }

  drawWorldCard(ctx: Ctx2D, title: string, subtitle: string, alpha: number): void {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#05050c';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    font.drawCentered(ctx, title, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 16, UI.border);
    fontBig.drawCentered(ctx, subtitle, GAME_WIDTH / 2, GAME_HEIGHT / 2, UI.text);
    ctx.globalAlpha = 1;
  }
}

function dim(ctx: Ctx2D): void {
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = '#05050c';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.globalAlpha = 1;
}
