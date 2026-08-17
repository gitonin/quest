import { RNG } from '../../core/math';
import { KNIGHT, PLANT, PRINCESS, SPACE, UI, VOID, WIZARD } from '../palette';
import { PixelBuf } from '../pixel';
import { clip, FrameStrip, type AnimClip } from '../sprites';

/**
 * Combat and pickup sprites: slashes, projectiles, impacts, items.
 * They are all small and animation-driven, which is what sells the hits.
 */
export interface FxBank {
  slash: AnimClip;
  chargedSlash: AnimClip;
  impact: AnimClip;
  magicHit: AnimClip;
  heal: AnimClip;
  shield: AnimClip;
  poisonCloud: AnimClip;
  bolt: AnimClip;
  frost: AnimClip;
  spit: AnimClip;
  starShard: AnimClip;
  voidBall: AnimClip;
  potion: AnimClip;
  ether: AnimClip;
  key: AnimClip;
  heart: AnimClip;
  orb: AnimClip;
  questItem: AnimClip;
}

function stripOf(frames: PixelBuf[], fps: number, loop = false): AnimClip {
  return clip(new FrameStrip(frames), fps, loop);
}

function slashFrame(i: number, n: number, charged: boolean): PixelBuf {
  const size = charged ? 40 : 30;
  const buf = new PixelBuf(size, size);
  const c = size / 2;
  const t = i / (n - 1);
  const start = -1.1 + t * 1.6;
  const sweep = 1.9;
  const radius = (charged ? 17 : 12) * (0.75 + t * 0.35);
  const color = charged ? KNIGHT.trimLit : KNIGHT.bladeHi;
  for (let s = 0; s <= 24; s++) {
    const ang = start + (s / 24) * sweep;
    const fade = Math.sin((s / 24) * Math.PI);
    const alpha = Math.round(255 * fade * (1 - t * 0.55));
    const x = c + Math.cos(ang) * radius;
    const y = c + Math.sin(ang) * radius;
    buf.set(x, y, color, alpha);
    buf.set(x, y - 1, charged ? KNIGHT.trim : KNIGHT.blade, Math.round(alpha * 0.75));
    if (charged) buf.set(x, y + 1, PRINCESS.gem, Math.round(alpha * 0.5));
  }
  return buf;
}

function impactFrame(i: number, n: number, color: string, hi: string): PixelBuf {
  const buf = new PixelBuf(22, 22);
  const t = i / (n - 1);
  const r = 2 + t * 8;
  const alpha = Math.round(255 * (1 - t));
  buf.ellipseOutline(11, 11, r, r, color, alpha);
  buf.ellipse(11, 11, Math.max(0.5, r - 3), Math.max(0.5, r - 3), hi, Math.round(alpha * 0.8));
  const rng = new RNG(17 + i);
  for (let s = 0; s < 6; s++) {
    const ang = rng.range(0, Math.PI * 2);
    const d = r + rng.range(0, 3);
    buf.set(11 + Math.cos(ang) * d, 11 + Math.sin(ang) * d, hi, alpha);
  }
  return buf;
}

function orbFrame(radius: number, core: string, glow: string, phase: number, trail = 0): PixelBuf {
  const size = Math.ceil(radius * 2) + 8;
  const buf = new PixelBuf(size, size);
  const c = size / 2;
  const r = radius + Math.sin(phase * Math.PI * 2) * 0.6;
  buf.ellipse(c, c, r + 2, r + 2, glow, 90);
  buf.ellipse(c, c, r, r, glow, 210);
  buf.ellipse(c, c, Math.max(0.5, r - 1.5), Math.max(0.5, r - 1.5), core);
  if (trail) {
    for (let i = 1; i <= trail; i++) {
      buf.ellipse(c - i * 2, c, Math.max(0.5, r - i), Math.max(0.5, r - i), glow, 120 - i * 30);
    }
  }
  return buf;
}

export function buildFx(): FxBank {
  const slash = stripOf([0, 1, 2, 3].map((i) => slashFrame(i, 4, false)), 24);
  const chargedSlash = stripOf([0, 1, 2, 3, 4].map((i) => slashFrame(i, 5, true)), 22);
  const impact = stripOf([0, 1, 2, 3].map((i) => impactFrame(i, 4, KNIGHT.bladeHi, '#ffffff')), 20);
  const magicHit = stripOf([0, 1, 2, 3].map((i) => impactFrame(i, 4, PRINCESS.gem, '#e8fbff')), 18);

  const healFrames: PixelBuf[] = [];
  for (let i = 0; i < 6; i++) {
    const buf = new PixelBuf(24, 30);
    const t = i / 5;
    for (let s = 0; s < 5; s++) {
      const y = 26 - t * 22 - s * 3;
      const x = 4 + ((s * 5 + i) % 16);
      const a = Math.round(230 * (1 - t));
      buf.set(x, y, '#8dffb0', a);
      buf.set(x + 1, y - 1, '#ffffff', a);
      buf.set(x - 1, y - 1, '#8dffb0', Math.round(a * 0.6));
    }
    buf.ellipseOutline(12, 22, 9 * (0.5 + t), 4 * (0.5 + t), '#8dffb0', Math.round(160 * (1 - t)));
    healFrames.push(buf);
  }

  const shieldFrames: PixelBuf[] = [];
  for (let i = 0; i < 4; i++) {
    const buf = new PixelBuf(30, 34);
    const a = 130 + i * 20;
    buf.ellipseOutline(15, 17, 12, 15, PRINCESS.gem, a);
    buf.ellipseOutline(15, 17, 10, 13, '#cdefff', Math.round(a * 0.5));
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2 + i * 0.4;
      buf.set(15 + Math.cos(ang) * 12, 17 + Math.sin(ang) * 15, '#ffffff', 220);
    }
    shieldFrames.push(buf);
  }

  const poisonFrames: PixelBuf[] = [];
  for (let i = 0; i < 5; i++) {
    const buf = new PixelBuf(34, 26);
    const rng = new RNG(300 + i);
    for (let s = 0; s < 26; s++) {
      const x = rng.int(2, 32);
      const y = rng.int(2, 24);
      buf.ellipse(x, y, rng.range(1.5, 3.5), rng.range(1, 2.5), PLANT.spit, 90 + rng.int(0, 60));
    }
    poisonFrames.push(buf);
  }

  return {
    slash,
    chargedSlash,
    impact,
    magicHit,
    heal: stripOf(healFrames, 12),
    shield: clip(new FrameStrip(shieldFrames), 8, true),
    poisonCloud: clip(new FrameStrip(poisonFrames), 6, true),
    bolt: clip(
      new FrameStrip([0, 0.25, 0.5, 0.75].map((p) => orbFrame(3.5, '#ffffff', WIZARD.gem, p, 2))),
      14,
      true,
    ),
    frost: clip(
      new FrameStrip([0, 0.25, 0.5, 0.75].map((p) => orbFrame(4, '#e6fbff', '#7fd8ff', p, 1))),
      12,
      true,
    ),
    spit: clip(new FrameStrip([0, 0.5].map((p) => orbFrame(3, '#d8ff9a', PLANT.spit, p))), 10, true),
    starShard: clip(
      new FrameStrip([0, 0.25, 0.5, 0.75].map((p) => orbFrame(3.5, '#ffffff', SPACE.crystal, p, 2))),
      14,
      true,
    ),
    voidBall: clip(
      new FrameStrip([0, 0.25, 0.5, 0.75].map((p) => orbFrame(4.5, VOID.core, VOID.ring4, p, 1))),
      12,
      true,
    ),
    potion: clip(new FrameStrip([potionSprite('#d64550', '#ff8f96')]), 1, true),
    ether: clip(new FrameStrip([potionSprite('#4a9ff5', '#a8d8ff')]), 1, true),
    key: clip(new FrameStrip([keySprite()]), 1, true),
    heart: clip(new FrameStrip([heartSprite()]), 1, true),
    orb: clip(
      new FrameStrip([0, 0.33, 0.66].map((p) => orbFrame(2.5, '#fff6d8', UI.xp, p))),
      8,
      true,
    ),
    questItem: clip(
      new FrameStrip([0, 0.5].map((p) => orbFrame(5, '#fff6d8', '#ffd166', p))),
      4,
      true,
    ),
  };
}

function potionSprite(liquid: string, hi: string): PixelBuf {
  const buf = new PixelBuf(12, 14);
  buf.rect(4, 1, 4, 3, '#8a7a5a');
  buf.rect(4, 0, 4, 1, '#c9a227');
  buf.ellipse(6, 9, 4, 4.5, '#cfd6e8');
  buf.ellipse(6, 10, 3, 3.2, liquid);
  buf.ellipse(4, 9, 1, 1.5, hi);
  buf.outline('#12101c', 200);
  return buf;
}

function keySprite(): PixelBuf {
  const buf = new PixelBuf(12, 12);
  buf.ellipseOutline(4, 4, 3, 3, UI.border);
  buf.hline(5, 10, 5, UI.border);
  buf.vline(9, 5, 8, UI.border);
  buf.vline(7, 5, 7, UI.border);
  buf.outline('#12101c', 190);
  return buf;
}

function heartSprite(): PixelBuf {
  const buf = new PixelBuf(12, 11);
  buf.ellipse(4, 4, 3, 3, UI.hp);
  buf.ellipse(8, 4, 3, 3, UI.hp);
  for (let y = 0; y < 6; y++) buf.hline(1 + y, 10 - y, 5 + y, UI.hp);
  buf.set(3, 3, '#ff9aa2');
  buf.outline('#3a0d12', 210);
  return buf;
}
