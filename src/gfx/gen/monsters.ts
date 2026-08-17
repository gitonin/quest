import { CASTLE, FURBALL, PLANT, SPACE, VOID } from '../palette';
import { PixelBuf, shade } from '../pixel';
import { RNG } from '../../core/math';
import { clip, FrameStrip, type AnimBank } from '../sprites';

/* ---------------------------------------------------------- poison plant */

const PLANT_W = 26;
const PLANT_H = 26;

function plantFrame(opts: { mouth?: number; sway?: number; lash?: number; hurt?: boolean; dead?: number }): PixelBuf {
  const buf = new PixelBuf(PLANT_W, PLANT_H);
  const cx = 13;
  const base = 24;

  if (opts.dead !== undefined) {
    const t = opts.dead;
    const h = Math.max(2, Math.round(10 * (1 - t)));
    buf.ellipse(cx, base - h / 2, 8 - t * 3, h / 2, shade(PLANT.bulbDark, -0.15 * t));
    return outlined(buf);
  }

  // Tentacles: green stalks with the red tips from the reference sheet.
  const rng = new RNG(7);
  const mouthOpen = opts.mouth ?? 0;
  const sway = opts.sway ?? 0;
  const lash = opts.lash ?? 0;
  for (let i = 0; i < 7; i++) {
    const spread = (i - 3) * 3.2;
    const wobble = Math.sin(sway * Math.PI * 2 + i) * 2 + lash * (i % 2 === 0 ? 3 : -3);
    const tipX = cx + spread + wobble;
    const tipY = 8 - Math.abs(spread) * 0.35 - lash * 3 + rng.range(-1, 1);
    buf.line(cx + spread * 0.4, base - 4, tipX, tipY, PLANT.tentacle);
    buf.line(cx + spread * 0.4, base - 5, tipX, tipY - 1, shade(PLANT.tentacle, 0.15));
    buf.set(tipX, tipY - 1, PLANT.tentacleTip);
    buf.set(tipX, tipY - 2, shade(PLANT.tentacleTip, 0.2));
  }

  // Bulb.
  buf.ellipse(cx, base - 7, 8, 7, PLANT.bulb);
  buf.ellipse(cx - 2, base - 9, 5, 4, PLANT.bulbLit);
  buf.ellipse(cx - 3, base - 10, 2, 2, PLANT.bulbHi);
  buf.ellipse(cx + 4, base - 5, 4, 4, PLANT.bulbDark);

  // Mouth: opens downward-forward, teeth on both lips.
  const open = Math.round(1 + mouthOpen * 7);
  const my = base - 8;
  buf.ellipse(cx, my + open / 2, 6, open / 2 + 1, PLANT.mouth);
  buf.ellipse(cx, my + open / 2 + 1, 4, Math.max(0.5, open / 2 - 1), PLANT.mouthDeep);
  for (let i = -4; i <= 4; i += 2) {
    buf.set(cx + i, my - Math.floor(open / 2) + 1, PLANT.tooth);
    buf.set(cx + i, my + Math.ceil(open / 2), PLANT.tooth);
  }

  // Leaves at the base.
  buf.ellipse(cx - 7, base - 2, 5, 2, PLANT.bulbDark);
  buf.ellipse(cx + 7, base - 2, 5, 2, PLANT.bulbDark);
  buf.ellipse(cx, base - 1, 8, 2, shade(PLANT.bulbDark, -0.1));

  if (opts.hurt) whiten(buf, 0.55);
  return outlined(buf);
}

export function buildPoisonPlantBank(): AnimBank {
  const idle = new FrameStrip([
    plantFrame({ mouth: 0.15, sway: 0, lash: 0 }),
    plantFrame({ mouth: 0.25, sway: 0.25, lash: 0 }),
    plantFrame({ mouth: 0.15, sway: 0.5, lash: 0 }),
    plantFrame({ mouth: 0.05, sway: 0.75, lash: 0 }),
  ]);
  const attack = new FrameStrip([
    plantFrame({ mouth: 0.2, sway: 0, lash: -0.4 }),
    plantFrame({ mouth: 0.9, sway: 0.2, lash: 0.2 }),
    plantFrame({ mouth: 1, sway: 0.4, lash: 1 }),
    plantFrame({ mouth: 0.5, sway: 0.6, lash: 0.4 }),
  ]);
  const hurt = new FrameStrip([plantFrame({ mouth: 0.6, sway: 0.3, lash: 0.2, hurt: true })]);
  const die = new FrameStrip([
    plantFrame({ mouth: 1, sway: 0.4, lash: 0.6, hurt: true }),
    plantFrame({ dead: 0.35 }),
    plantFrame({ dead: 0.7 }),
    plantFrame({ dead: 1 }),
  ]);
  return {
    idle: clip(idle, 5, true),
    walk: clip(idle, 6, true),
    attack: clip(attack, 10, false),
    hurt: clip(hurt, 8, false),
    die: clip(die, 7, false),
  };
}

/* -------------------------------------------------------------- fur ball */

const FUR_W = 22;
const FUR_H = 20;

/**
 * The fur ball has no eyes, no nose and no ears - the whole face is one huge
 * mouth, exactly as specified in the design.
 */
function furFrame(opts: { mouth?: number; squash?: number; hurt?: boolean; dead?: number }): PixelBuf {
  const buf = new PixelBuf(FUR_W, FUR_H);
  const cx = 11;
  const base = 18;
  if (opts.dead !== undefined) {
    const t = opts.dead;
    buf.ellipse(cx, base - 2 + t * 2, 8 - t * 2, Math.max(1, 4 - t * 3), shade(FURBALL.furDark, -0.2 * t));
    return outlined(buf);
  }

  const squash = opts.squash ?? 0;
  const rx = 8 + squash;
  const ry = 7 - squash;
  const cy = base - ry;

  buf.ellipse(cx, cy, rx, ry, FURBALL.fur);
  buf.ellipse(cx - 2, cy - 2, rx - 3, ry - 3, FURBALL.furLit);
  buf.ellipse(cx - 3, cy - 3, 2, 2, FURBALL.furHi);
  buf.ellipse(cx + 4, cy + 2, 4, 3, FURBALL.furDark);

  // Shaggy silhouette: spikes of fur all around the body.
  const rng = new RNG(21);
  for (let a = 0; a < 26; a++) {
    const ang = (a / 26) * Math.PI * 2;
    const len = 1 + rng.range(0, 2);
    const x0 = cx + Math.cos(ang) * rx;
    const y0 = cy + Math.sin(ang) * ry;
    buf.line(x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, a % 3 === 0 ? FURBALL.furDark : FURBALL.fur);
  }

  // Mouth.
  const open = opts.mouth ?? 0;
  const mw = 5 + open * 3;
  const mh = 1 + open * 6;
  buf.ellipse(cx, cy + 1, mw, mh / 2 + 1, FURBALL.mouth);
  buf.ellipse(cx, cy + 1 + mh * 0.15, mw - 2, Math.max(0.5, mh / 2 - 1), FURBALL.mouthDeep);
  if (open > 0.4) buf.ellipse(cx, cy + mh / 2, mw - 3, Math.max(0.5, mh / 4), FURBALL.tongue);
  for (let i = -Math.floor(mw) + 1; i <= mw - 1; i += 2) {
    buf.set(cx + i, cy + 1 - Math.floor(mh / 2), FURBALL.tooth);
    buf.set(cx + i, cy + 1 + Math.ceil(mh / 2), FURBALL.tooth);
  }

  if (opts.hurt) whiten(buf, 0.55);
  return outlined(buf);
}

export function buildFurBallBank(): AnimBank {
  const idle = new FrameStrip([
    furFrame({ mouth: 0.2, squash: 0 }),
    furFrame({ mouth: 0.35, squash: -1 }),
    furFrame({ mouth: 0.2, squash: 0 }),
    furFrame({ mouth: 0.1, squash: 1 }),
  ]);
  const walk = new FrameStrip([
    furFrame({ mouth: 0.4, squash: 1.5 }),
    furFrame({ mouth: 0.5, squash: -1.5 }),
    furFrame({ mouth: 0.4, squash: 0 }),
    furFrame({ mouth: 0.55, squash: -1 }),
  ]);
  const attack = new FrameStrip([
    furFrame({ mouth: 0.2, squash: 2 }),
    furFrame({ mouth: 1, squash: -2 }),
    furFrame({ mouth: 0.9, squash: -1 }),
    furFrame({ mouth: 0.3, squash: 1 }),
  ]);
  const hurt = new FrameStrip([furFrame({ mouth: 0.8, squash: 1, hurt: true })]);
  const die = new FrameStrip([
    furFrame({ mouth: 1, squash: -2, hurt: true }),
    furFrame({ dead: 0.4 }),
    furFrame({ dead: 0.8 }),
    furFrame({ dead: 1 }),
  ]);
  return {
    idle: clip(idle, 5, true),
    walk: clip(walk, 12, true),
    attack: clip(attack, 12, false),
    hurt: clip(hurt, 8, false),
    die: clip(die, 8, false),
  };
}

/* ------------------------------------------------------------- black hole */

const VOID_W = 30;
const VOID_H = 30;

function voidFrame(spin: number, opts: { pull?: number; burst?: number; hurt?: boolean; dead?: number }): PixelBuf {
  const buf = new PixelBuf(VOID_W, VOID_H);
  const cx = 15;
  const cy = 15;
  const scale = opts.dead !== undefined ? 1 - opts.dead : 1 + (opts.pull ?? 0) * 0.15;
  if (scale <= 0.05) return buf;

  const rings = [
    { r: 13, color: VOID.ring1, alpha: 90 },
    { r: 11, color: VOID.ring2, alpha: 150 },
    { r: 9, color: VOID.ring3, alpha: 210 },
    { r: 7, color: VOID.ring4, alpha: 240 },
  ];
  // Spiral arms, redrawn every frame at a new phase to sell the rotation.
  for (const ring of rings) {
    const r = ring.r * scale;
    for (let a = 0; a < 64; a++) {
      const base = (a / 64) * Math.PI * 2;
      const swirl = base + spin * Math.PI * 2 + r * 0.28;
      const arm = (Math.sin(swirl * 2) + 1) / 2;
      if (arm < 0.35) continue;
      buf.set(cx + Math.cos(swirl) * r, cy + Math.sin(swirl) * r, ring.color, Math.round(ring.alpha * arm));
    }
  }
  buf.ellipse(cx, cy, 5.5 * scale, 5.5 * scale, VOID.core);
  buf.ellipseOutline(cx, cy, 6.2 * scale, 6.2 * scale, VOID.ring4, 200);

  // Debris caught in the accretion disc.
  const rng = new RNG(99);
  for (let i = 0; i < 6; i++) {
    const ang = rng.range(0, Math.PI * 2) + spin * Math.PI * 2 * 1.7;
    const r = (8 + rng.range(0, 5)) * scale;
    buf.set(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, VOID.debris);
  }
  if (opts.pull) {
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 - spin * Math.PI * 2;
      const r = 14 - (opts.pull * 6) % 6;
      buf.set(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, VOID.spark, 200);
    }
  }
  if (opts.burst) {
    const r = 6 + opts.burst * 9;
    buf.ellipseOutline(cx, cy, r, r, VOID.spark, Math.round(240 * (1 - opts.burst)));
    buf.ellipseOutline(cx, cy, r - 2, r - 2, VOID.ring4, Math.round(200 * (1 - opts.burst)));
  }
  if (opts.hurt) whiten(buf, 0.5);
  return buf;
}

export function buildBlackHoleBank(): AnimBank {
  const spins = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  const idle = new FrameStrip(spins.map((s) => voidFrame(s, {})));
  const walk = new FrameStrip(spins.map((s) => voidFrame(s, { pull: 0.5 })));
  const attack = new FrameStrip([0, 0.25, 0.5, 0.75].map((s, i) => voidFrame(s, { burst: (i + 1) / 4 })));
  const hurt = new FrameStrip([voidFrame(0.3, { hurt: true })]);
  const die = new FrameStrip([0, 0.25, 0.5, 0.75].map((s, i) => voidFrame(s, { dead: (i + 1) / 4 })));
  return {
    idle: clip(idle, 12, true),
    walk: clip(walk, 14, true),
    attack: clip(attack, 10, false),
    hurt: clip(hurt, 8, false),
    die: clip(die, 8, false),
  };
}

/* ---------------------------------------------------------------- bosses */

const GARG_W = 34;
const GARG_H = 36;

/** Castle boss: a stone gargoyle that wakes up in the treasure room. */
function gargoyleFrame(opts: { wings: number; lunge: number; mouth: number; hurt?: boolean; dead?: number }): PixelBuf {
  const buf = new PixelBuf(GARG_W, GARG_H);
  const cx = 17;
  const base = 33;
  if (opts.dead !== undefined) {
    const t = opts.dead;
    const h = Math.max(3, Math.round(16 * (1 - t)));
    buf.rect(cx - 9, base - h, 18, h, shade(CASTLE.stone, -0.2 * t));
    buf.rect(cx - 9, base - h, 18, 2, CASTLE.stoneLit);
    return outlined(buf, '#0a0812');
  }
  const lift = Math.round(opts.lunge * 2);

  // Wings behind the body.
  const spread = 6 + opts.wings * 5;
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x0 = cx + dir * 6;
      const y0 = base - 22 + i * 2;
      buf.line(x0, y0, x0 + dir * spread, y0 - 6 + i * 3 - opts.wings * 3, i % 2 ? CASTLE.stoneLit : CASTLE.stone);
    }
    buf.line(cx + dir * 6, base - 22, cx + dir * spread, base - 28 - opts.wings * 3, CASTLE.stoneHi);
  }

  // Body + limbs.
  buf.ellipse(cx, base - 12 - lift, 8, 9, CASTLE.stone);
  buf.ellipse(cx - 3, base - 15 - lift, 5, 5, CASTLE.stoneLit);
  buf.rect(cx - 9, base - 8 - lift, 4, 8, CASTLE.stoneDark);
  buf.rect(cx + 5, base - 8 - lift, 4, 8, CASTLE.stoneDark);
  buf.rect(cx - 7, base - 3, 5, 3, CASTLE.stoneDark);
  buf.rect(cx + 2, base - 3, 5, 3, CASTLE.stoneDark);

  // Head with horns and a glowing maw.
  const hy = base - 25 - lift;
  buf.ellipse(cx, hy, 6, 5, CASTLE.stone);
  buf.ellipse(cx - 2, hy - 1, 3, 2, CASTLE.stoneHi);
  buf.line(cx - 5, hy - 3, cx - 8, hy - 7, CASTLE.stoneLit);
  buf.line(cx + 5, hy - 3, cx + 8, hy - 7, CASTLE.stoneLit);
  buf.rect(cx - 4, hy + 1, 8, 1 + Math.round(opts.mouth * 3), CASTLE.flame);
  buf.set(cx - 3, hy - 1, CASTLE.flameHi);
  buf.set(cx + 2, hy - 1, CASTLE.flameHi);

  if (opts.hurt) whiten(buf, 0.5);
  return outlined(buf, '#0a0812');
}

export function buildGargoyleBank(): AnimBank {
  const idle = new FrameStrip([
    gargoyleFrame({ wings: 0, lunge: 0, mouth: 0.2 }),
    gargoyleFrame({ wings: 0.3, lunge: 0.3, mouth: 0.3 }),
    gargoyleFrame({ wings: 0.6, lunge: 0.6, mouth: 0.2 }),
    gargoyleFrame({ wings: 0.3, lunge: 0.3, mouth: 0.1 }),
  ]);
  const attack = new FrameStrip([
    gargoyleFrame({ wings: 1, lunge: 1, mouth: 0.4 }),
    gargoyleFrame({ wings: 0.2, lunge: -0.5, mouth: 1 }),
    gargoyleFrame({ wings: 0.1, lunge: -0.2, mouth: 1 }),
    gargoyleFrame({ wings: 0.5, lunge: 0.4, mouth: 0.3 }),
  ]);
  return {
    idle: clip(idle, 5, true),
    walk: clip(idle, 8, true),
    attack: clip(attack, 9, false),
    hurt: clip(new FrameStrip([gargoyleFrame({ wings: 0.4, lunge: 0, mouth: 0.6, hurt: true })]), 8, false),
    die: clip(
      new FrameStrip([0.25, 0.5, 0.75, 1].map((t) => gargoyleFrame({ wings: 0, lunge: 0, mouth: 0, dead: t }))),
      6,
      false,
    ),
  };
}

const DEVOURER_W = 44;
const DEVOURER_H = 44;

/** Final boss: a star-eating void with a crystalline crown. */
function devourerFrame(spin: number, opts: { burst?: number; hurt?: boolean; dead?: number }): PixelBuf {
  const buf = new PixelBuf(DEVOURER_W, DEVOURER_H);
  const cx = 22;
  const cy = 22;
  const scale = opts.dead !== undefined ? 1 - opts.dead * 0.85 : 1;

  for (let ring = 0; ring < 5; ring++) {
    const r = (20 - ring * 3) * scale;
    const color = [VOID.ring1, VOID.ring2, VOID.ring3, VOID.ring4, VOID.spark][ring];
    for (let a = 0; a < 90; a++) {
      const ang = (a / 90) * Math.PI * 2 + spin * Math.PI * 2 + r * 0.22;
      const arm = (Math.sin(ang * 3) + 1) / 2;
      if (arm < 0.3) continue;
      buf.set(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, color, Math.round(200 * arm));
    }
  }
  buf.ellipse(cx, cy, 9 * scale, 9 * scale, VOID.core);
  buf.ellipseOutline(cx, cy, 10 * scale, 10 * scale, SPACE.crystal, 220);

  // Orbiting crystal shards.
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 - spin * Math.PI * 2;
    const r = 16 * scale;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    buf.vline(x, y - 2, y + 2, SPACE.crystal);
    buf.set(x, y - 3, SPACE.crystalHi);
    buf.set(x + 1, y, SPACE.crystalDark);
  }
  if (opts.burst) {
    const r = 12 + opts.burst * 18;
    buf.ellipseOutline(cx, cy, r, r, SPACE.crystalHi, Math.round(220 * (1 - opts.burst)));
  }
  if (opts.hurt) whiten(buf, 0.5);
  return buf;
}

export function buildDevourerBank(): AnimBank {
  const spins = [0, 0.166, 0.333, 0.5, 0.666, 0.833];
  return {
    idle: clip(new FrameStrip(spins.map((s) => devourerFrame(s, {}))), 12, true),
    walk: clip(new FrameStrip(spins.map((s) => devourerFrame(s, {}))), 14, true),
    attack: clip(new FrameStrip(spins.slice(0, 4).map((s, i) => devourerFrame(s, { burst: (i + 1) / 4 }))), 10, false),
    hurt: clip(new FrameStrip([devourerFrame(0.2, { hurt: true })]), 8, false),
    die: clip(new FrameStrip([0.2, 0.4, 0.6, 0.8, 1].map((t, i) => devourerFrame(i * 0.2, { dead: t }))), 6, false),
  };
}

/* --------------------------------------------------------------- helpers */

function outlined(buf: PixelBuf, color = '#0d1208'): PixelBuf {
  buf.outline(color, 220);
  return buf;
}

/** Hit flash: pushes every opaque pixel towards white. */
function whiten(buf: PixelBuf, amount: number): void {
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = d[i] + (255 - d[i]) * amount;
    d[i + 1] = d[i + 1] + (255 - d[i + 1]) * amount;
    d[i + 2] = d[i + 2] + (255 - d[i + 2]) * amount;
  }
}
