import type { AnimBank } from './sprites';
import { clip, FrameStrip } from './sprites';
import { buildKnightBank, buildPrincessBank, buildWizardBank } from './gen/heroes';
import {
  buildBlackHoleBank,
  buildDevourerBank,
  buildFurBallBank,
  buildGargoyleBank,
  buildPoisonPlantBank,
} from './gen/monsters';
import { buildCastleTiles, buildForestTiles, buildSpaceTiles, type TileSet } from './gen/tiles';
import { buildProps } from './gen/props';
import { buildFx, type FxBank } from './gen/fx';
import { PixelBuf } from './pixel';

export interface Assets {
  knight: AnimBank;
  princess: AnimBank;
  wizard: AnimBank;
  plant: AnimBank;
  furball: AnimBank;
  blackhole: AnimBank;
  gargoyle: AnimBank;
  devourer: AnimBank;
  tiles: { forest: TileSet; castle: TileSet; space: TileSet };
  props: ReturnType<typeof buildProps>;
  fx: FxBank;
  /** Names of banks that came from real PNG sheets instead of the generator. */
  overridden: string[];
}

/**
 * Optional external sprite sheets.
 *
 * The whole game ships with procedurally generated art so it runs with zero
 * binary assets, but dropping `assets/manifest.json` next to real PNG sheets
 * swaps any bank over without touching gameplay code:
 *
 * ```json
 * {
 *   "sheets": [{
 *     "bank": "knight",
 *     "image": "knight.png",
 *     "frameW": 20, "frameH": 24,
 *     "clips": { "idle_down": { "row": 0, "from": 0, "count": 4, "fps": 5, "loop": true } }
 *   }]
 * }
 * ```
 */
interface SheetManifest {
  sheets: Array<{
    bank: string;
    image: string;
    frameW: number;
    frameH: number;
    clips: Record<string, { row: number; from: number; count: number; fps: number; loop?: boolean }>;
  }>;
}

const OVERRIDABLE = [
  'knight',
  'princess',
  'wizard',
  'plant',
  'furball',
  'blackhole',
  'gargoyle',
  'devourer',
] as const;

export async function loadAssets(): Promise<Assets> {
  const assets: Assets = {
    knight: buildKnightBank(),
    princess: buildPrincessBank(),
    wizard: buildWizardBank(),
    plant: buildPoisonPlantBank(),
    furball: buildFurBallBank(),
    blackhole: buildBlackHoleBank(),
    gargoyle: buildGargoyleBank(),
    devourer: buildDevourerBank(),
    tiles: {
      forest: buildForestTiles(),
      castle: buildCastleTiles(),
      space: buildSpaceTiles(),
    },
    props: buildProps(),
    fx: buildFx(),
    overridden: [],
  };

  try {
    const manifest = await fetchManifest();
    if (manifest) await applyManifest(assets, manifest);
  } catch (err) {
    console.warn('[assets] sheet override skipped:', err);
  }

  return assets;
}

async function fetchManifest(): Promise<SheetManifest | null> {
  const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
  if (!res.ok) return null;
  return (await res.json()) as SheetManifest;
}

async function applyManifest(assets: Assets, manifest: SheetManifest): Promise<void> {
  for (const sheet of manifest.sheets) {
    if (!(OVERRIDABLE as readonly string[]).includes(sheet.bank)) {
      console.warn(`[assets] unknown bank "${sheet.bank}"`);
      continue;
    }
    const img = await loadImage(`assets/${sheet.image}`);
    const bank: AnimBank = {};
    for (const [key, def] of Object.entries(sheet.clips)) {
      const frames: PixelBuf[] = [];
      for (let i = 0; i < def.count; i++) {
        frames.push(cutFrame(img, (def.from + i) * sheet.frameW, def.row * sheet.frameH, sheet.frameW, sheet.frameH));
      }
      bank[key] = clip(new FrameStrip(frames), def.fps, def.loop ?? true);
    }
    (assets as unknown as Record<string, AnimBank>)[sheet.bank] = bank;
    assets.overridden.push(sheet.bank);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${src}`));
    img.src = src;
  });
}

function cutFrame(img: HTMLImageElement, sx: number, sy: number, w: number, h: number): PixelBuf {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const buf = new PixelBuf(w, h);
  buf.data.set(data.data);
  return buf;
}
