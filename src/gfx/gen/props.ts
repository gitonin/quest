import { RNG } from '../../core/math';
import { CASTLE, FOREST, PRINCESS, SPACE, UI } from '../palette';
import { PixelBuf, shade } from '../pixel';
import { clip, FrameStrip, type AnimClip } from '../sprites';

/**
 * Scenery objects. Unlike tiles they are y-sorted with the characters, so the
 * heroes walk behind tree canopies and pillars - that is what gives the flat
 * top-down levels their depth.
 */
export interface PropDef {
  clip: AnimClip;
  w: number;
  h: number;
  /** Collision box relative to the prop's top-left, omitted when walkable. */
  collide?: { x: number; y: number; w: number; h: number };
  /** Y used for depth sorting, relative to the top-left. */
  anchorY: number;
  /** Emitted light radius, used by the lighting pass. */
  light?: { x: number; y: number; radius: number; color: string };
}

type PropBank = Record<string, PropDef>;

function single(buf: PixelBuf): AnimClip {
  return clip(new FrameStrip([buf]), 1, true);
}

function animated(frames: PixelBuf[], fps: number): AnimClip {
  return clip(new FrameStrip(frames), fps, true);
}

/* ------------------------------------------------------------------ forest */

function drawTree(w: number, h: number, seed: number, scale: number): PixelBuf {
  const buf = new PixelBuf(w, h);
  const rng = new RNG(seed);
  const cx = Math.floor(w / 2);
  const trunkW = Math.max(4, Math.round(6 * scale));
  const trunkTop = Math.round(h * 0.55);

  // Trunk with root flare.
  buf.rect(cx - trunkW / 2, trunkTop, trunkW, h - trunkTop - 2, FOREST.trunk);
  buf.rect(cx - trunkW / 2, trunkTop, Math.max(1, trunkW / 3), h - trunkTop - 2, FOREST.trunkDark);
  buf.rect(cx + trunkW / 2 - 1, trunkTop, 1, h - trunkTop - 2, FOREST.trunkLit);
  buf.ellipse(cx, h - 3, trunkW, 2.5, FOREST.trunkDark);
  for (let i = 0; i < 4; i++) {
    const y = trunkTop + rng.int(2, h - trunkTop - 4);
    buf.hline(cx - trunkW / 2 + 1, cx + trunkW / 2 - 2, y, FOREST.trunkDark);
  }

  // Canopy: a broad mass of overlapping blobs, lit from the upper left. It has
  // to be wide enough to actually read as foliage above the trunk.
  const blobs = Math.round(9 * scale);
  const canopyY = h * 0.34;
  buf.ellipse(cx, canopyY, w * 0.46, h * 0.3, FOREST.leafDark);
  for (let i = 0; i < blobs; i++) {
    const bx = cx + rng.range(-w * 0.34, w * 0.34);
    const by = canopyY + rng.range(-h * 0.16, h * 0.12);
    const r = rng.range(w * 0.24, w * 0.36);
    buf.ellipse(bx, by, r, r * 0.9, FOREST.leaf);
  }
  for (let i = 0; i < blobs; i++) {
    const bx = cx + rng.range(-w * 0.3, w * 0.16);
    const by = canopyY - h * 0.04 + rng.range(-h * 0.12, h * 0.06);
    const r = rng.range(w * 0.13, w * 0.24);
    buf.ellipse(bx, by, r, r * 0.78, FOREST.leafLit);
  }
  for (let i = 0; i < blobs * 3; i++) {
    buf.set(cx + rng.range(-w * 0.34, w * 0.14), canopyY - h * 0.09 + rng.range(-h * 0.08, h * 0.1), FOREST.leafHi);
  }
  for (let i = 0; i < blobs * 2; i++) {
    buf.set(cx + rng.range(-w * 0.05, w * 0.42), canopyY + h * 0.1 + rng.range(-h * 0.06, h * 0.1), FOREST.leafDark);
  }
  buf.outline('#0d2415', 200);
  return buf;
}

function drawBush(seed: number): PixelBuf {
  const buf = new PixelBuf(22, 18);
  const rng = new RNG(seed);
  for (let i = 0; i < 5; i++) {
    buf.ellipse(4 + rng.range(0, 14), 10 + rng.range(-3, 3), rng.range(4, 6), rng.range(3, 5), FOREST.leaf);
  }
  for (let i = 0; i < 4; i++) {
    buf.ellipse(4 + rng.range(0, 12), 8 + rng.range(-2, 2), rng.range(2, 4), rng.range(2, 3), FOREST.leafLit);
  }
  for (let i = 0; i < 6; i++) buf.set(rng.int(3, 19), rng.int(5, 13), FOREST.leafHi);
  buf.ellipse(11, 16, 8, 1.5, '#00000055', 90);
  buf.outline('#0d2415', 190);
  return buf;
}

function drawRock(seed: number): PixelBuf {
  const buf = new PixelBuf(20, 16);
  const rng = new RNG(seed);
  buf.ellipse(10, 10, 8, 5, FOREST.stone);
  buf.ellipse(8, 8, 5, 3, FOREST.stoneLit);
  buf.ellipse(12, 12, 4, 2.5, FOREST.stoneDark);
  for (let i = 0; i < 6; i++) buf.set(rng.int(3, 17), rng.int(6, 14), FOREST.stoneDark);
  buf.outline('#1c1a16', 190);
  return buf;
}

function drawWaterfall(frame: number): PixelBuf {
  const buf = new PixelBuf(36, 56);
  buf.rect(0, 0, 36, 52, FOREST.water, 220);
  const rng = new RNG(300 + frame * 17);
  for (let i = 0; i < 60; i++) {
    const x = rng.int(1, 35);
    const y = (rng.int(0, 52) + frame * 6) % 52;
    buf.vline(x, y, y + 3, FOREST.waterLit);
  }
  for (let i = 0; i < 22; i++) {
    const x = rng.int(2, 34);
    const y = (rng.int(0, 52) + frame * 9) % 52;
    buf.vline(x, y, y + 5, FOREST.waterHi, 200);
  }
  // Foam at the bottom.
  for (let i = 0; i < 26; i++) {
    buf.set(rng.int(0, 36), 48 + rng.int(0, 8), FOREST.waterHi, 180);
  }
  buf.ellipse(18, 53, 16, 4, FOREST.waterLit, 160);
  return buf;
}

function drawMagicTree(frame: number): PixelBuf {
  const buf = new PixelBuf(72, 92);
  const tree = drawTree(72, 92, 909, 1.15);
  buf.blit(tree, 0, 0);
  const rng = new RNG(11);
  // Golden fruit + a slow pulsing aura.
  for (let i = 0; i < 14; i++) {
    const x = 36 + rng.range(-24, 24);
    const y = 22 + rng.range(-12, 16);
    const a = 180 + Math.round(70 * Math.sin(frame + i));
    buf.set(x, y, FOREST.flowerAlt, a);
    buf.set(x, y - 1, '#fff3c4', a);
  }
  const pulse = 0.5 + 0.5 * Math.sin(frame * 1.2);
  buf.ellipseOutline(36, 30, 30 + pulse * 3, 26 + pulse * 3, '#ffe9a8', Math.round(60 + pulse * 50));
  buf.ellipseOutline(36, 30, 22 + pulse * 2, 19 + pulse * 2, '#fff6d8', Math.round(40 + pulse * 40));
  return buf;
}

/* ------------------------------------------------------------------ castle */

function drawTorch(frame: number): PixelBuf {
  const buf = new PixelBuf(12, 26);
  buf.rect(5, 10, 2, 15, CASTLE.stoneDark);
  buf.rect(4, 8, 4, 3, CASTLE.gold);
  const t = frame / 4;
  const h = 7 + Math.round(Math.sin(t * Math.PI * 2) * 1.5);
  buf.ellipse(6, 6 - h / 4, 3, h / 2, CASTLE.flame, 235);
  buf.ellipse(6, 6 - h / 3, 2, h / 2.6, CASTLE.flameHi);
  buf.ellipse(6, 6 - h / 3, 1, h / 4, CASTLE.flameCore);
  buf.set(6 + (frame % 2 ? 1 : -1), 1, CASTLE.flame, 170);
  return buf;
}

function drawBanner(): PixelBuf {
  const buf = new PixelBuf(16, 34);
  buf.rect(2, 0, 12, 28, CASTLE.banner);
  buf.rect(2, 0, 3, 28, CASTLE.bannerDark);
  buf.rect(11, 0, 3, 28, shade(CASTLE.banner, -0.12));
  buf.hline(1, 14, 0, CASTLE.gold);
  // Ragged bottom edge + a crude skull crest.
  buf.rect(2, 28, 4, 3, CASTLE.banner);
  buf.rect(10, 28, 4, 4, CASTLE.banner);
  buf.ellipse(8, 12, 3, 3.5, CASTLE.gold);
  buf.set(7, 12, CASTLE.bannerDark);
  buf.set(9, 12, CASTLE.bannerDark);
  buf.rect(6, 15, 5, 2, CASTLE.gold);
  buf.outline('#0a0812', 180);
  return buf;
}

function drawPillar(): PixelBuf {
  const buf = new PixelBuf(22, 40);
  buf.rect(4, 4, 14, 32, CASTLE.stone);
  buf.rect(4, 4, 4, 32, CASTLE.stoneLit);
  buf.rect(14, 4, 4, 32, CASTLE.stoneDark);
  buf.rect(1, 0, 20, 5, CASTLE.stoneLit);
  buf.rect(1, 35, 20, 5, CASTLE.stoneLit);
  buf.rect(1, 38, 20, 2, CASTLE.stoneDark);
  for (let y = 8; y < 34; y += 6) buf.hline(5, 16, y, CASTLE.mortar);
  buf.outline('#0a0812', 200);
  return buf;
}

function drawGargoyleStatue(): PixelBuf {
  const buf = new PixelBuf(24, 32);
  buf.rect(3, 24, 18, 8, CASTLE.stoneDark);
  buf.rect(3, 24, 18, 2, CASTLE.stoneLit);
  buf.ellipse(12, 18, 6, 6, CASTLE.stone);
  buf.ellipse(12, 10, 4.5, 4, CASTLE.stone);
  buf.ellipse(10, 9, 2, 1.5, CASTLE.stoneHi);
  buf.line(8, 7, 5, 3, CASTLE.stoneLit);
  buf.line(16, 7, 19, 3, CASTLE.stoneLit);
  buf.set(10, 11, CASTLE.flame);
  buf.set(14, 11, CASTLE.flame);
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      buf.line(12 + dir * 5, 14 + i * 2, 12 + dir * 11, 8 + i * 4, CASTLE.stoneLit);
    }
  }
  buf.outline('#0a0812', 200);
  return buf;
}

function drawDoor(open: boolean): PixelBuf {
  const buf = new PixelBuf(28, 34);
  buf.rect(0, 0, 28, 34, CASTLE.stoneDark);
  buf.rect(2, 2, 24, 32, open ? '#0b0814' : '#4a3520');
  if (!open) {
    for (let x = 4; x < 26; x += 5) buf.vline(x, 3, 33, '#3a2818');
    buf.rect(11, 14, 6, 6, CASTLE.gold);
    buf.set(13, 17, '#000000');
    buf.ellipse(14, 6, 8, 5, '#4a3520');
  }
  buf.outline('#0a0812', 200);
  return buf;
}

/* ------------------------------------------------------------------- space */

function drawCrystal(frame: number, h = 30): PixelBuf {
  const buf = new PixelBuf(18, h + 8);
  const cx = 9;
  const base = h + 4;
  // Base plinth.
  buf.rect(cx - 6, base - 3, 12, 5, SPACE.edgeGold);
  buf.hline(cx - 6, cx + 5, base - 3, SPACE.edgeGoldLit);
  // Faceted shard.
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const w = Math.round(1 + t * 5);
    buf.hline(cx - w, cx + w, base - 4 - y, SPACE.crystal);
    buf.vline(cx - Math.max(0, w - 1), base - 4 - y, base - 4 - y, SPACE.crystalHi);
    if (w > 2) buf.set(cx + w - 1, base - 4 - y, SPACE.crystalDark);
  }
  const pulse = 100 + Math.round(80 * Math.sin((frame / 4) * Math.PI * 2));
  buf.ellipseOutline(cx, base - 4 - h * 0.5, 8, h * 0.55, SPACE.crystalHi, pulse);
  buf.outline('#0a1030', 170);
  return buf;
}

function drawPortal(frame: number): PixelBuf {
  const buf = new PixelBuf(28, 32);
  const cx = 14;
  const cy = 16;
  for (let ring = 0; ring < 4; ring++) {
    const r = 11 - ring * 2.2;
    const color = [SPACE.runeA, SPACE.runeB, SPACE.crystal, SPACE.crystalHi][ring];
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2 + (frame / 6) * Math.PI * 2 * (ring % 2 ? -1 : 1);
      const arm = (Math.sin(ang * 2) + 1) / 2;
      if (arm < 0.3) continue;
      buf.set(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 1.15, color, Math.round(210 * arm));
    }
  }
  buf.ellipse(cx, cy, 4, 4.5, '#0a0620', 220);
  buf.ellipseOutline(cx, cy, 12, 13.5, SPACE.edgeGold, 190);
  return buf;
}

function drawStar(frame: number): PixelBuf {
  const buf = new PixelBuf(32, 32);
  const cx = 16;
  const cy = 16;
  const pulse = 0.6 + 0.4 * Math.sin((frame / 6) * Math.PI * 2);
  for (let r = 12; r > 0; r--) {
    const a = Math.round(18 * (12 - r) * pulse);
    buf.ellipse(cx, cy, r, r, r > 7 ? '#ffe9a8' : '#fffdf0', Math.min(255, a));
  }
  for (let i = 0; i < 4; i++) {
    const len = 14 * pulse;
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    buf.line(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len, '#fff6d8', 190);
  }
  buf.hline(cx - 15, cx + 15, cy, '#fffdf0', Math.round(150 * pulse));
  buf.vline(cx, cy - 15, cy + 15, '#fffdf0', Math.round(150 * pulse));
  return buf;
}

/* ------------------------------------------------------------------ shared */

function drawChest(state: number): PixelBuf {
  const buf = new PixelBuf(20, 18);
  const lidLift = state * 4;
  buf.rect(2, 8, 16, 8, '#7a4a24');
  buf.rect(2, 8, 16, 2, '#a06a34');
  buf.rect(2, 14, 16, 2, '#4a2c17');
  buf.rect(2, 4 - lidLift, 16, 6, '#8a5528');
  buf.ellipse(10, 4 - lidLift, 8, 3, '#a06a34');
  buf.hline(2, 17, 4 - lidLift, '#c99154');
  buf.rect(8, 8 - lidLift, 4, 4, UI.border);
  buf.set(10, 10 - lidLift, '#000000');
  if (state > 0) {
    buf.rect(4, 8, 12, 3, '#ffe9a8', 200);
    buf.rect(6, 6, 8, 3, '#fff6d8', 160);
  }
  buf.outline('#1a1008', 200);
  return buf;
}

function drawSign(): PixelBuf {
  const buf = new PixelBuf(16, 20);
  buf.rect(7, 10, 2, 10, FOREST.trunkDark);
  buf.rect(1, 3, 14, 9, FOREST.trunk);
  buf.rect(1, 3, 14, 2, FOREST.trunkLit);
  buf.hline(3, 12, 7, FOREST.trunkDark);
  buf.hline(3, 10, 9, FOREST.trunkDark);
  buf.outline('#1a1008', 200);
  return buf;
}

/* ------------------------------------------------------------------- bank */

export function buildProps(): PropBank {
  const props: PropBank = {};

  props.tree = {
    clip: single(drawTree(34, 52, 5, 0.9)),
    w: 34,
    h: 52,
    anchorY: 50,
    collide: { x: 12, y: 42, w: 10, h: 8 },
  };
  props.tree_big = {
    clip: single(drawTree(48, 72, 13, 1.1)),
    w: 48,
    h: 72,
    anchorY: 70,
    collide: { x: 17, y: 60, w: 14, h: 10 },
  };
  props.tree_alt = {
    clip: single(drawTree(30, 44, 27, 0.8)),
    w: 30,
    h: 44,
    anchorY: 42,
    collide: { x: 11, y: 35, w: 8, h: 7 },
  };
  props.bush = { clip: single(drawBush(31)), w: 22, h: 18, anchorY: 16, collide: { x: 3, y: 8, w: 16, h: 8 } };
  props.bush_small = { clip: single(drawBush(57)), w: 22, h: 18, anchorY: 16 };
  props.rock = { clip: single(drawRock(63)), w: 20, h: 16, anchorY: 15, collide: { x: 2, y: 6, w: 16, h: 9 } };
  props.sign = { clip: single(drawSign()), w: 16, h: 20, anchorY: 19, collide: { x: 6, y: 14, w: 4, h: 5 } };
  props.waterfall = {
    clip: animated([0, 1, 2, 3].map(drawWaterfall), 10),
    w: 36,
    h: 56,
    anchorY: 8,
  };
  props.magic_tree = {
    clip: animated([0, 1, 2, 3, 4, 5].map(drawMagicTree), 5),
    w: 72,
    h: 92,
    anchorY: 90,
    collide: { x: 28, y: 78, w: 16, h: 12 },
    light: { x: 36, y: 30, radius: 90, color: '#ffe9a8' },
  };

  props.torch = {
    clip: animated([0, 1, 2, 3].map(drawTorch), 10),
    w: 12,
    h: 26,
    anchorY: 25,
    light: { x: 6, y: 6, radius: 62, color: '#ffb03a' },
  };
  props.banner = { clip: single(drawBanner()), w: 16, h: 34, anchorY: 4 };
  props.pillar = {
    clip: single(drawPillar()),
    w: 22,
    h: 40,
    anchorY: 39,
    collide: { x: 3, y: 30, w: 16, h: 9 },
  };
  props.statue = {
    clip: single(drawGargoyleStatue()),
    w: 24,
    h: 32,
    anchorY: 31,
    collide: { x: 3, y: 22, w: 18, h: 9 },
  };
  props.door = { clip: single(drawDoor(false)), w: 28, h: 34, anchorY: 33, collide: { x: 0, y: 20, w: 28, h: 13 } };
  props.door_open = { clip: single(drawDoor(true)), w: 28, h: 34, anchorY: 33 };

  props.crystal = {
    clip: animated([0, 1, 2, 3].map((f) => drawCrystal(f)), 6),
    w: 18,
    h: 38,
    anchorY: 37,
    collide: { x: 3, y: 30, w: 12, h: 7 },
    light: { x: 9, y: 16, radius: 56, color: '#57c8ff' },
  };
  props.crystal_tall = {
    clip: animated([0, 1, 2, 3].map((f) => drawCrystal(f, 44)), 6),
    w: 18,
    h: 52,
    anchorY: 51,
    collide: { x: 3, y: 44, w: 12, h: 7 },
    light: { x: 9, y: 22, radius: 70, color: '#7f9cff' },
  };
  props.portal = {
    clip: animated([0, 1, 2, 3, 4, 5].map(drawPortal), 12),
    w: 28,
    h: 32,
    anchorY: 30,
    light: { x: 14, y: 16, radius: 64, color: '#b06cf5' },
  };
  props.star = {
    clip: animated([0, 1, 2, 3, 4, 5].map(drawStar), 8),
    w: 32,
    h: 32,
    anchorY: 26,
    light: { x: 16, y: 16, radius: 120, color: '#fff3c4' },
  };

  props.chest = { clip: single(drawChest(0)), w: 20, h: 18, anchorY: 17, collide: { x: 2, y: 10, w: 16, h: 7 } };
  props.chest_open = { clip: single(drawChest(1)), w: 20, h: 18, anchorY: 17, collide: { x: 2, y: 10, w: 16, h: 7 } };

  // Treasure of world 2: a chest overflowing with gold.
  const treasure = drawChest(1);
  treasure.ellipse(10, 7, 7, 3, PRINCESS.gold);
  treasure.ellipse(8, 5, 3, 2, '#ffe9a8');
  props.treasure = { clip: single(treasure), w: 20, h: 18, anchorY: 17, light: { x: 10, y: 8, radius: 60, color: '#ffd166' } };

  return props;
}
