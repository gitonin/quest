import { TILE } from '../../core/config';
import { RNG } from '../../core/math';
import { CASTLE, FOREST, SPACE } from '../palette';
import { PixelBuf, shade } from '../pixel';
import { clip, FrameStrip, type AnimClip } from '../sprites';

export interface TileDef {
  name: string;
  /** Blocks movement. */
  solid: boolean;
  /** Deals damage over time (poison swamp, void, lava...). */
  hazard?: number;
  /** Slows the walker down (deep grass, water shallows). */
  drag?: number;
  /** Frame indices inside the sheet; more than one means an animated tile. */
  frames: number[];
  fps: number;
}

export interface TileSet {
  strip: FrameStrip;
  defs: TileDef[];
  byName: Record<string, number>;
  clips: AnimClip[];
}

class TileBuilder {
  private frames: PixelBuf[] = [];
  private defs: TileDef[] = [];

  add(
    name: string,
    draw: (buf: PixelBuf, frame: number) => void,
    opts: { solid?: boolean; hazard?: number; drag?: number; frames?: number; fps?: number } = {},
  ): void {
    const count = opts.frames ?? 1;
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      const buf = new PixelBuf(TILE, TILE);
      draw(buf, i);
      indices.push(this.frames.length);
      this.frames.push(buf);
    }
    this.defs.push({
      name,
      solid: opts.solid ?? false,
      hazard: opts.hazard,
      drag: opts.drag,
      frames: indices,
      fps: opts.fps ?? 6,
    });
  }

  build(): TileSet {
    const strip = new FrameStrip(this.frames);
    const byName: Record<string, number> = {};
    this.defs.forEach((d, i) => (byName[d.name] = i));
    const clips = this.defs.map((d) => clip(strip, d.fps, true, d.frames));
    return { strip, defs: this.defs, byName, clips };
  }
}

/** Noise speckles used everywhere to break up flat 16x16 fills. */
function speckle(buf: PixelBuf, seed: number, color: string, count: number, alpha = 255): void {
  const rng = new RNG(seed);
  for (let i = 0; i < count; i++) {
    buf.set(rng.int(0, TILE), rng.int(0, TILE), color, alpha);
  }
}

/* ------------------------------------------------------------------ forest */

export function buildForestTiles(): TileSet {
  const b = new TileBuilder();

  const grass = (seed: number) => (buf: PixelBuf) => {
    buf.rect(0, 0, TILE, TILE, FOREST.grass);
    const rng = new RNG(seed);
    for (let i = 0; i < 22; i++) {
      const x = rng.int(0, TILE);
      const y = rng.int(0, TILE);
      buf.set(x, y, FOREST.grassDark);
      if (rng.chance(0.5)) buf.set(x, y - 1, FOREST.grassLit);
    }
    for (let i = 0; i < 6; i++) {
      const x = rng.int(1, TILE - 1);
      const y = rng.int(2, TILE - 1);
      buf.vline(x, y - 2, y, FOREST.grassHi);
    }
  };
  b.add('grass', grass(11));
  b.add('grass2', grass(23));
  b.add('grass3', grass(37));
  b.add('grass_flower', (buf) => {
    grass(41)(buf);
    const rng = new RNG(5);
    for (let i = 0; i < 4; i++) {
      const x = rng.int(2, TILE - 2);
      const y = rng.int(2, TILE - 2);
      const c = rng.chance(0.5) ? FOREST.flower : FOREST.flowerAlt;
      buf.set(x, y, c);
      buf.set(x - 1, y, shade(c, -0.2));
      buf.set(x, y - 1, shade(c, 0.2));
    }
  });
  b.add('tall_grass', (buf) => {
    grass(53)(buf);
    const rng = new RNG(61);
    for (let i = 0; i < 14; i++) {
      const x = rng.int(0, TILE);
      const y = rng.int(4, TILE);
      buf.vline(x, y - 4, y, FOREST.leaf);
      buf.set(x, y - 5, FOREST.leafLit);
    }
  }, { drag: 0.65 });

  b.add('dirt', (buf) => {
    buf.rect(0, 0, TILE, TILE, FOREST.dirt);
    speckle(buf, 71, FOREST.dirtDark, 26);
    speckle(buf, 73, FOREST.dirtLit, 18);
  });
  b.add('dirt2', (buf) => {
    buf.rect(0, 0, TILE, TILE, FOREST.dirt);
    speckle(buf, 79, FOREST.dirtDark, 34);
    speckle(buf, 83, FOREST.dirtLit, 10);
    buf.ellipse(5, 9, 2, 1.5, FOREST.stone);
    buf.ellipse(12, 4, 1.5, 1, FOREST.stoneLit);
  });

  b.add(
    'water',
    (buf, f) => {
      buf.rect(0, 0, TILE, TILE, FOREST.water);
      buf.rect(0, 0, TILE, 3, FOREST.waterDark);
      const rng = new RNG(101 + f);
      for (let i = 0; i < 10; i++) buf.set(rng.int(0, TILE), rng.int(0, TILE), FOREST.waterLit);
      for (let i = 0; i < 3; i++) {
        const x = rng.int(1, TILE - 3);
        const y = rng.int(1, TILE - 1);
        buf.hline(x, x + 2, y, FOREST.waterHi);
      }
    },
    { solid: true, frames: 4, fps: 5 },
  );
  b.add(
    'shallow',
    (buf, f) => {
      buf.rect(0, 0, TILE, TILE, shade(FOREST.water, 0.15));
      const rng = new RNG(131 + f * 7);
      for (let i = 0; i < 14; i++) buf.set(rng.int(0, TILE), rng.int(0, TILE), FOREST.waterLit);
      speckle(buf, 137, FOREST.dirtLit, 6, 160);
    },
    { drag: 0.55, frames: 3, fps: 4 },
  );

  b.add('bridge', (buf) => {
    buf.rect(0, 0, TILE, TILE, FOREST.trunk);
    for (let y = 0; y < TILE; y += 4) {
      buf.hline(0, TILE - 1, y, FOREST.trunkDark);
      buf.hline(0, TILE - 1, y + 1, FOREST.trunkLit);
    }
    buf.vline(1, 0, TILE - 1, FOREST.trunkDark);
    buf.vline(TILE - 2, 0, TILE - 1, FOREST.trunkDark);
  });

  b.add('rockwall', (buf) => {
    buf.rect(0, 0, TILE, TILE, FOREST.stone);
    buf.rect(0, 0, TILE, 4, FOREST.stoneLit);
    speckle(buf, 149, FOREST.stoneDark, 30);
    buf.hline(0, TILE - 1, TILE - 1, FOREST.stoneDark);
    buf.hline(0, TILE - 1, 7, FOREST.stoneDark);
    buf.vline(6, 8, TILE - 1, FOREST.stoneDark);
  }, { solid: true });

  b.add('ruins', (buf) => {
    buf.rect(0, 0, TILE, TILE, FOREST.stone);
    speckle(buf, 151, FOREST.stoneDark, 22);
    speckle(buf, 157, FOREST.leafDark, 12);
    buf.hline(0, TILE - 1, 5, FOREST.stoneDark);
    buf.hline(0, TILE - 1, 11, FOREST.stoneDark);
  }, { solid: true });

  b.add('poison', (buf, f) => {
    buf.rect(0, 0, TILE, TILE, '#2e4a1c');
    const rng = new RNG(163 + f * 11);
    for (let i = 0; i < 18; i++) buf.set(rng.int(0, TILE), rng.int(0, TILE), '#4d7a24');
    for (let i = 0; i < 5; i++) {
      const x = rng.int(1, TILE - 2);
      const y = rng.int(1, TILE - 2);
      buf.ellipseOutline(x, y, 2, 1.5, '#8fd76a', 190);
    }
  }, { hazard: 6, drag: 0.7, frames: 4, fps: 4 });

  b.add('leaves_dark', (buf) => {
    buf.rect(0, 0, TILE, TILE, FOREST.leafDark);
    speckle(buf, 167, FOREST.leaf, 30);
    speckle(buf, 173, FOREST.leafLit, 12);
  }, { solid: true });

  return b.build();
}

/* ------------------------------------------------------------------ castle */

export function buildCastleTiles(): TileSet {
  const b = new TileBuilder();

  const flag = (buf: PixelBuf, seed: number) => {
    buf.rect(0, 0, TILE, TILE, CASTLE.floor);
    const rng = new RNG(seed);
    buf.hline(0, TILE - 1, 0, CASTLE.mortar);
    buf.vline(0, 0, TILE - 1, CASTLE.mortar);
    buf.hline(1, TILE - 1, 7, CASTLE.mortar);
    buf.vline(8, 8, TILE - 1, CASTLE.mortar);
    for (let i = 0; i < 16; i++) buf.set(rng.int(1, TILE), rng.int(1, TILE), CASTLE.floorDark);
    for (let i = 0; i < 8; i++) buf.set(rng.int(1, TILE), rng.int(1, TILE), CASTLE.floorLit);
  };
  b.add('floor', (buf) => flag(buf, 3));
  b.add('floor2', (buf) => flag(buf, 17));
  b.add('floor_crack', (buf) => {
    flag(buf, 29);
    buf.line(2, 3, 11, 13, CASTLE.mortar);
    buf.line(11, 13, 14, 10, CASTLE.mortar);
  });

  b.add('carpet', (buf) => {
    buf.rect(0, 0, TILE, TILE, CASTLE.carpet);
    buf.vline(0, 0, TILE - 1, CASTLE.carpetDark);
    buf.vline(TILE - 1, 0, TILE - 1, CASTLE.carpetDark);
    buf.vline(2, 0, TILE - 1, CASTLE.carpetLit);
    buf.vline(TILE - 3, 0, TILE - 1, CASTLE.carpetLit);
    speckle(buf, 31, CASTLE.carpetDark, 10);
    buf.set(7, 4, CASTLE.gold);
    buf.set(8, 11, CASTLE.gold);
  });

  b.add('wall', (buf) => {
    buf.rect(0, 0, TILE, TILE, CASTLE.stone);
    // Two staggered courses of blocks.
    buf.hline(0, TILE - 1, 0, CASTLE.mortar);
    buf.hline(0, TILE - 1, 8, CASTLE.mortar);
    buf.vline(0, 1, 7, CASTLE.mortar);
    buf.vline(8, 9, TILE - 1, CASTLE.mortar);
    buf.hline(1, TILE - 1, 1, CASTLE.stoneLit);
    buf.hline(1, 7, 9, CASTLE.stoneLit);
    buf.hline(9, TILE - 1, 9, CASTLE.stoneLit);
    speckle(buf, 37, CASTLE.stoneDark, 20);
    speckle(buf, 41, CASTLE.stoneHi, 8);
  }, { solid: true });

  b.add('wall_top', (buf) => {
    buf.rect(0, 0, TILE, TILE, CASTLE.stoneLit);
    buf.hline(0, TILE - 1, 0, CASTLE.stoneHi);
    buf.hline(0, TILE - 1, TILE - 1, CASTLE.stoneDark);
    speckle(buf, 43, CASTLE.stone, 22);
  }, { solid: true });

  b.add('stairs', (buf) => {
    buf.rect(0, 0, TILE, TILE, CASTLE.floor);
    for (let y = 0; y < TILE; y += 4) {
      buf.hline(0, TILE - 1, y, CASTLE.stoneHi);
      buf.hline(0, TILE - 1, y + 1, CASTLE.stoneDark);
    }
  });

  b.add('pit', (buf, f) => {
    buf.rect(0, 0, TILE, TILE, CASTLE.voidPit);
    const rng = new RNG(47 + f * 3);
    for (let i = 0; i < 6; i++) {
      buf.set(rng.int(0, TILE), rng.int(0, TILE), CASTLE.mist, 140);
    }
  }, { solid: true, frames: 3, fps: 3 });

  b.add('mist', (buf, f) => {
    buf.rect(0, 0, TILE, TILE, CASTLE.floorDark);
    const rng = new RNG(53 + f * 5);
    for (let i = 0; i < 20; i++) buf.set(rng.int(0, TILE), rng.int(0, TILE), CASTLE.mist, 120);
  }, { drag: 0.8, frames: 3, fps: 3 });

  b.add('grate', (buf) => {
    buf.rect(0, 0, TILE, TILE, CASTLE.floorDark);
    for (let x = 1; x < TILE; x += 3) buf.vline(x, 0, TILE - 1, CASTLE.stoneDark);
    for (let y = 1; y < TILE; y += 5) buf.hline(0, TILE - 1, y, CASTLE.stoneDark);
  }, { solid: true });

  return b.build();
}

/* ------------------------------------------------------------------- space */

export function buildSpaceTiles(): TileSet {
  const b = new TileBuilder();

  // The void is drawn by the parallax starfield, so this tile stays empty.
  b.add('void', (buf) => buf.rect(0, 0, TILE, TILE, '#00000000', 0), { solid: true });

  const glass = (seed: number, tintHi: string) => (buf: PixelBuf, f: number) => {
    // Deliberately translucent: the parallax starfield has to show through the
    // walkways, which is what sells "floating glass" instead of "blue floor".
    buf.rect(0, 0, TILE, TILE, SPACE.glass, 96);
    buf.rect(0, 0, TILE, 1, SPACE.glassHi, 170);
    buf.rect(0, 0, 1, TILE, SPACE.glassHi, 130);
    buf.rect(0, TILE - 1, TILE, 1, SPACE.glassDark, 170);
    const rng = new RNG(seed + f * 13);
    for (let i = 0; i < 6; i++) {
      buf.set(rng.int(1, TILE - 1), rng.int(1, TILE - 1), tintHi, 120 + rng.int(0, 100));
    }
    // Travelling sheen so the walkways feel alive.
    const sx = (f * 4) % TILE;
    buf.line(sx, TILE - 1, sx + 6, 0, SPACE.glassLit, 70);
  };
  b.add('glass', glass(211, SPACE.glassHi), { frames: 4, fps: 4 });
  b.add('glass2', glass(223, SPACE.runeB), { frames: 4, fps: 4 });

  // Runes and teleport pads span 2x2 tiles: each quadrant draws its slice of
  // one big circle centred on the shared corner.
  const quadrants: Array<[string, number, number]> = [
    ['tl', TILE, TILE],
    ['tr', 0, TILE],
    ['bl', TILE, 0],
    ['br', 0, 0],
  ];
  for (const [suffix, ox, oy] of quadrants) {
    b.add(
      `glass_rune_${suffix}`,
      (buf, f) => {
        glass(227, SPACE.runeA)(buf, f);
        const phase = f / 4;
        for (const [radius, color] of [
          [13, SPACE.runeA],
          [10.5, SPACE.runeB],
          [6.5, SPACE.crystal],
        ] as Array<[number, string]>) {
          buf.ellipseOutline(ox, oy, radius, radius, color, 200);
          // Ticks around the ring so it reads as an engraved glyph.
          for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2 + phase * Math.PI;
            buf.set(ox + Math.cos(ang) * (radius + 1.5), oy + Math.sin(ang) * (radius + 1.5), SPACE.crystalHi, 190);
          }
        }
      },
      { frames: 4, fps: 4 },
    );
    b.add(
      `pad_${suffix}`,
      (buf, f) => {
        buf.ellipse(ox, oy, 15, 15, SPACE.glass, 150);
        buf.ellipseOutline(ox, oy, 15, 15, SPACE.edgeGold, 230);
        buf.ellipseOutline(ox, oy, 12, 12, SPACE.edgeGoldLit, 150);
        const r = 3 + ((f * 3) % 10);
        buf.ellipseOutline(ox, oy, r, r, SPACE.crystal, 220 - r * 14);
      },
      { frames: 4, fps: 6 },
    );
  }

  b.add('rail', (buf) => {
    buf.rect(0, 6, TILE, 4, SPACE.edgeGold);
    buf.hline(0, TILE - 1, 6, SPACE.edgeGoldLit);
    buf.hline(0, TILE - 1, 9, shade(SPACE.edgeGold, -0.3));
    buf.vline(3, 2, 13, SPACE.edgeGold);
    buf.vline(12, 2, 13, SPACE.edgeGold);
  }, { solid: true });

  b.add('stairs', (buf) => {
    for (let y = 0; y < TILE; y += 4) {
      buf.rect(0, y, TILE, 3, SPACE.glassLit, 175);
      buf.hline(0, TILE - 1, y, SPACE.glassHi, 200);
    }
  });

  return b.build();
}
