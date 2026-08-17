import { KNIGHT, PRINCESS, WIZARD } from '../palette';
import { PixelBuf, shade } from '../pixel';
import { clip, FrameStrip, type AnimBank } from '../sprites';
import {
  drawBody,
  drawEyes,
  drawHead,
  finishHero,
  newHeroBuf,
  type BodyStyle,
  type PoseOptions,
  type Side,
} from './humanoid';

const SIDES: Side[] = ['down', 'up', 'side'];
const FACING_OF_SIDE: Record<Side, string[]> = {
  down: ['down'],
  up: ['up'],
  side: ['left', 'right'],
};

type FrameBuilder = (side: Side, t: number, frame: number, total: number) => PixelBuf;

/** Builds `<state>_<facing>` clips from a per-side frame builder. */
function buildBank(
  bank: AnimBank,
  state: string,
  builder: FrameBuilder,
  frames: number,
  fps: number,
  loop: boolean,
): void {
  for (const side of SIDES) {
    const strip = new FrameStrip(
      Array.from({ length: frames }, (_, i) => builder(side, frames === 1 ? 0 : i / frames, i, frames)),
    );
    for (const facing of FACING_OF_SIDE[side]) {
      bank[`${state}_${facing}`] = clip(strip, fps, loop);
    }
  }
}

function pose(side: Side, over: Partial<PoseOptions> = {}): PoseOptions {
  return { side, bob: 0, stride: 0, armSwing: 0, lean: 0, ...over };
}

/* ------------------------------------------------------------------ knight */

const knightStyle: BodyStyle = {
  torsoDark: KNIGHT.steelDark,
  torso: KNIGHT.steel,
  torsoLit: KNIGHT.steelLit,
  legDark: KNIGHT.steelDark,
  leg: KNIGHT.steel,
  boot: KNIGHT.steelDark,
  arm: KNIGHT.steelLit,
  armDark: KNIGHT.steelDark,
  belt: KNIGHT.trim,
  cape: KNIGHT.cloth,
  outline: '#0b0a12',
};

function knightHead(buf: PixelBuf, side: Side, top: number): void {
  const cx = 10;
  // Helmet dome.
  buf.rect(cx - 4, top, 8, 7, KNIGHT.steel);
  buf.rect(cx - 4, top, 2, 7, KNIGHT.steelDark);
  buf.rect(cx + 2, top, 2, 7, KNIGHT.steelLit);
  buf.hline(cx - 4, cx + 3, top, KNIGHT.steelDark);
  // Horns.
  buf.line(cx - 4, top + 1, cx - 6, top - 2, KNIGHT.steelHi);
  buf.line(cx + 3, top + 1, cx + 5, top - 2, KNIGHT.steelHi);
  // Crest.
  buf.vline(cx - 1, top - 2, top, KNIGHT.trim);
  buf.vline(cx, top - 2, top, KNIGHT.trimLit);

  if (side === 'up') {
    buf.rect(cx - 3, top + 2, 6, 3, KNIGHT.steelDark);
    return;
  }
  // Visor slit with the violet glow from the reference art.
  const slitY = top + 3;
  if (side === 'down') {
    buf.rect(cx - 3, slitY, 6, 2, '#100f18');
    buf.set(cx - 2, slitY, KNIGHT.eye);
    buf.set(cx + 1, slitY, KNIGHT.eye);
  } else {
    buf.rect(cx - 1, slitY, 5, 2, '#100f18');
    buf.set(cx + 2, slitY, KNIGHT.eye);
  }
  buf.hline(cx - 3, cx + 3, top + 6, KNIGHT.steelDark);
}

/** Thick rotated blade approximated with parallel lines. */
function drawBlade(
  buf: PixelBuf,
  px: number,
  py: number,
  angle: number,
  length: number,
  bright = false,
): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const tipX = px + dx * length;
  const tipY = py + dy * length;
  buf.line(px + nx, py + ny, tipX + nx, tipY + ny, KNIGHT.bladeDark);
  buf.line(px, py, tipX, tipY, bright ? KNIGHT.bladeHi : KNIGHT.blade);
  buf.line(px - nx, py - ny, tipX - nx * 0.6, tipY - ny * 0.6, KNIGHT.bladeHi);
  // Guard + grip.
  buf.line(px + nx * 2 - dx, py + ny * 2 - dy, px - nx * 2 - dx, py - ny * 2 - dy, KNIGHT.gold);
  buf.line(px - dx * 3, py - dy * 3, px - dx, py - dy, KNIGHT.cloth);
}

function knightFrame(side: Side, opts: {
  bob?: number;
  stride?: number;
  armSwing?: number;
  lean?: number;
  swing?: number | null;
  glow?: number;
  collapse?: number;
}): PixelBuf {
  const buf = newHeroBuf();
  const collapse = opts.collapse ?? 0;
  if (collapse > 0) {
    // Death: the armour folds down into a heap.
    const h = Math.max(2, Math.round(9 * (1 - collapse)));
    buf.rect(4, 22 - h, 12, h, KNIGHT.steel);
    buf.rect(4, 22 - h, 12, 1, KNIGHT.steelLit);
    buf.rect(6, 21, 8, 2, KNIGHT.steelDark);
    if (collapse < 0.7) knightHead(buf, side, 22 - h - 5);
    return finishHero(buf, knightStyle.outline);
  }

  const bob = opts.bob ?? 0;
  drawBody(
    buf,
    knightStyle,
    pose(side, { bob, stride: opts.stride ?? 0, armSwing: opts.armSwing ?? 0, lean: opts.lean ?? 0 }),
  );
  knightHead(buf, side, 5 + bob + (opts.lean ? Math.sign(opts.lean) : 0));

  if (opts.swing !== null && opts.swing !== undefined) {
    const handY = 14 + bob;
    const handX = side === 'up' ? 12 : 13;
    drawBlade(buf, handX, handY, opts.swing, 9, (opts.glow ?? 0) > 0);
  } else {
    // Sheathed sword resting on the back.
    if (side !== 'up') buf.line(6, 13 + bob, 4, 18 + bob, KNIGHT.bladeDark);
  }

  if (opts.glow) {
    const a = Math.round(120 * opts.glow);
    buf.ellipseOutline(10, 14, 8, 9, KNIGHT.trimLit, a);
  }
  return finishHero(buf, knightStyle.outline);
}

export function buildKnightBank(): AnimBank {
  const bank: AnimBank = {};
  const idleBob = [0, 0, -1, 0];
  buildBank(bank, 'idle', (side, _t, i) => knightFrame(side, { bob: idleBob[i], swing: null }), 4, 5, true);

  buildBank(
    bank,
    'walk',
    (side, t) =>
      knightFrame(side, {
        bob: Math.abs(Math.sin(t * Math.PI * 2)) > 0.6 ? -1 : 0,
        stride: Math.sin(t * Math.PI * 2),
        armSwing: Math.sin(t * Math.PI * 2),
        swing: null,
      }),
    6,
    11,
    true,
  );

  // 4-frame slash: wind up behind, sweep forward, follow through, recover.
  const swingAngles = [-2.2, -0.9, 0.35, 0.9];
  const leans = [-2, 0, 2, 1];
  buildBank(
    bank,
    'attack',
    (side, _t, i) => knightFrame(side, { swing: swingAngles[i], lean: leans[i], bob: i === 1 ? -1 : 0 }),
    4,
    16,
    false,
  );

  buildBank(
    bank,
    'charge',
    (side, _t, i) => knightFrame(side, { swing: -2.4, lean: -2, glow: 0.5 + 0.5 * (i % 2) }),
    2,
    8,
    true,
  );

  buildBank(
    bank,
    'charged',
    (side, _t, i) => knightFrame(side, { swing: [-2.4, -0.4, 0.9, 1.4][i], lean: [-3, 1, 3, 2][i], glow: 1 }),
    4,
    14,
    false,
  );

  buildBank(bank, 'hurt', (side) => knightFrame(side, { lean: -2, bob: 1, swing: null }), 1, 6, false);
  buildBank(bank, 'dodge', (side) => knightFrame(side, { bob: 1, stride: 1, lean: 2, swing: null }), 1, 8, false);
  buildBank(bank, 'die', (side, _t, i, n) => knightFrame(side, { collapse: (i + 1) / n }), 4, 7, false);
  return bank;
}

/* ---------------------------------------------------------------- princess */

const princessStyle: BodyStyle = {
  torsoDark: PRINCESS.dressDark,
  torso: PRINCESS.dress,
  torsoLit: PRINCESS.dressHi,
  legDark: PRINCESS.dressDark,
  leg: PRINCESS.dress,
  boot: PRINCESS.trim,
  arm: PRINCESS.skin,
  armDark: PRINCESS.skinDark,
  robe: true,
  robeHem: PRINCESS.dressDark,
  belt: PRINCESS.trim,
  outline: '#161230',
};

function princessHead(buf: PixelBuf, side: Side, top: number): void {
  const cx = 10;
  // Long hair behind the body first.
  buf.rect(cx - 5, top + 1, 10, 12, PRINCESS.hairDark);
  buf.rect(cx - 5, top + 1, 3, 12, PRINCESS.hair);
  buf.rect(cx + 3, top + 1, 2, 11, PRINCESS.hair);
  drawHead(buf, side, top + 1, { skin: PRINCESS.skin, skinDark: PRINCESS.skinDark });
  // Fringe.
  buf.rect(cx - 4, top, 8, 3, PRINCESS.hair);
  buf.hline(cx - 4, cx + 3, top, PRINCESS.hairLit);
  buf.set(cx - 2, top + 2, PRINCESS.hairHi);
  if (side === 'up') buf.rect(cx - 3, top + 1, 6, 6, PRINCESS.hair);
  else drawEyes(buf, side, top + 1, '#2b2242');
  // Crown.
  buf.hline(cx - 3, cx + 2, top - 1, PRINCESS.gold);
  buf.set(cx - 3, top - 2, PRINCESS.gold);
  buf.set(cx, top - 2, PRINCESS.gem);
  buf.set(cx + 2, top - 2, PRINCESS.gold);
}

function princessFrame(side: Side, opts: {
  bob?: number;
  stride?: number;
  armSwing?: number;
  cast?: number;
  heal?: number;
  lean?: number;
  collapse?: number;
}): PixelBuf {
  const buf = newHeroBuf();
  if (opts.collapse) {
    buf.rect(3, 18, 14, 5, PRINCESS.dressDark);
    buf.rect(3, 17, 8, 3, PRINCESS.hair);
    return finishHero(buf, princessStyle.outline);
  }
  const bob = opts.bob ?? 0;
  drawBody(
    buf,
    princessStyle,
    pose(side, { bob, stride: opts.stride ?? 0, armSwing: opts.armSwing ?? 0, lean: opts.lean ?? 0 }),
  );
  princessHead(buf, side, 4 + bob);

  if (opts.cast !== undefined) {
    // Wand raised, orb charging at the tip.
    const wx = side === 'up' ? 6 : 15;
    const wy = 10 + bob;
    buf.line(wx, wy + 5, wx, wy, shade(PRINCESS.gold, -0.2));
    const r = 1 + opts.cast * 2;
    buf.ellipse(wx, wy - 1, r, r, PRINCESS.magic, 230);
    buf.ellipse(wx, wy - 1, r * 0.5, r * 0.5, '#ffffff');
    if (opts.cast > 0.5) {
      buf.ellipseOutline(10, 14, 8 + opts.cast * 2, 9, PRINCESS.gem, 110);
    }
  }
  if (opts.heal !== undefined) {
    const a = Math.round(180 * (1 - opts.heal));
    for (let i = 0; i < 4; i++) {
      const y = 20 - opts.heal * 16 - i * 3;
      buf.set(6 + i * 3, y, '#ffd6e6', a);
      buf.set(7 + i * 3, y - 1, '#ffffff', a);
    }
    buf.ellipseOutline(10, 15, 8, 10, PRINCESS.magic, Math.round(120 * (1 - opts.heal)));
  }
  return finishHero(buf, princessStyle.outline);
}

export function buildPrincessBank(): AnimBank {
  const bank: AnimBank = {};
  const idleBob = [0, -1, 0, 0];
  buildBank(bank, 'idle', (side, _t, i) => princessFrame(side, { bob: idleBob[i] }), 4, 4, true);
  buildBank(
    bank,
    'walk',
    (side, t) =>
      princessFrame(side, {
        bob: Math.sin(t * Math.PI * 2) > 0.5 ? -1 : 0,
        stride: Math.sin(t * Math.PI * 2),
        armSwing: Math.sin(t * Math.PI * 2) * 0.6,
      }),
    6,
    10,
    true,
  );
  buildBank(bank, 'attack', (side, _t, i, n) => princessFrame(side, { cast: (i + 1) / n, lean: i > 1 ? 1 : -1 }), 4, 12, false);
  buildBank(bank, 'cast', (side, _t, i, n) => princessFrame(side, { heal: i / n, bob: -1 }), 5, 10, false);
  buildBank(bank, 'hurt', (side) => princessFrame(side, { lean: -2, bob: 1 }), 1, 6, false);
  buildBank(bank, 'die', (side) => princessFrame(side, { collapse: 1 }), 1, 6, false);
  return bank;
}

/* ------------------------------------------------------------------ wizard */

const wizardStyle: BodyStyle = {
  torsoDark: WIZARD.robeDark,
  torso: WIZARD.robe,
  torsoLit: WIZARD.robeHi,
  legDark: WIZARD.robeDark,
  leg: WIZARD.robe,
  boot: WIZARD.shadow,
  arm: WIZARD.robeHi,
  armDark: WIZARD.robeDark,
  robe: true,
  robeHem: WIZARD.robeDark,
  belt: WIZARD.trim,
  outline: '#171a26',
};

function wizardHat(buf: PixelBuf, side: Side, top: number): void {
  const cx = 10;
  // Face tucked under the brim, exactly like the reference sprite.
  buf.rect(cx - 3, top + 3, 6, 5, WIZARD.skin);
  if (side !== 'up') {
    buf.rect(cx - 3, top + 3, 6, 2, shade(WIZARD.skin, -0.35));
    drawEyes(buf, side, top + 2, '#2a2438');
  }
  // Cone.
  for (let i = 0; i < 7; i++) {
    const w = 1 + i;
    buf.hline(cx - Math.floor(w / 2), cx - Math.floor(w / 2) + w - 1, top - 4 + i, i < 3 ? WIZARD.robeHi : WIZARD.robe);
  }
  // Brim + gold band.
  buf.hline(cx - 5, cx + 4, top + 3, WIZARD.robe);
  buf.hline(cx - 5, cx + 4, top + 2, WIZARD.robeHi);
  buf.hline(cx - 4, cx + 3, top + 1, WIZARD.trim);
  buf.set(cx, top + 1, WIZARD.gem);
}

function wizardFrame(side: Side, opts: {
  bob?: number;
  stride?: number;
  armSwing?: number;
  cast?: number;
  lean?: number;
  collapse?: number;
}): PixelBuf {
  const buf = newHeroBuf();
  if (opts.collapse) {
    buf.rect(3, 18, 14, 5, WIZARD.robeDark);
    buf.rect(5, 16, 10, 3, WIZARD.robe);
    return finishHero(buf, wizardStyle.outline);
  }
  const bob = opts.bob ?? 0;
  drawBody(
    buf,
    wizardStyle,
    pose(side, { bob, stride: opts.stride ?? 0, armSwing: opts.armSwing ?? 0, lean: opts.lean ?? 0 }),
  );
  wizardHat(buf, side, 4 + bob);

  // Staff: always held, glowing while casting.
  const sx = side === 'up' ? 5 : 15;
  const raise = opts.cast ? Math.round(opts.cast * 2) : 0;
  buf.vline(sx, 8 + bob - raise, 21 + bob, WIZARD.staff);
  buf.vline(sx + 1, 9 + bob - raise, 21 + bob, shade(WIZARD.staff, -0.25));
  const gemY = 7 + bob - raise;
  const r = 1 + (opts.cast ?? 0) * 2.5;
  buf.ellipse(sx, gemY, r, r, WIZARD.gem, 235);
  buf.ellipse(sx, gemY, Math.max(0.5, r - 1.4), Math.max(0.5, r - 1.4), '#ffffff');
  if (opts.cast && opts.cast > 0.4) {
    buf.ellipseOutline(sx, gemY, r + 2, r + 2, WIZARD.magic, 130);
    buf.ellipseOutline(10, 15, 9, 10, WIZARD.accent, 90);
  }
  return finishHero(buf, wizardStyle.outline);
}

export function buildWizardBank(): AnimBank {
  const bank: AnimBank = {};
  const idleBob = [0, 0, -1, 0];
  buildBank(bank, 'idle', (side, _t, i) => wizardFrame(side, { bob: idleBob[i] }), 4, 4, true);
  buildBank(
    bank,
    'walk',
    (side, t) =>
      wizardFrame(side, {
        bob: Math.sin(t * Math.PI * 2) > 0.5 ? -1 : 0,
        stride: Math.sin(t * Math.PI * 2),
        armSwing: Math.sin(t * Math.PI * 2) * 0.5,
      }),
    6,
    10,
    true,
  );
  buildBank(bank, 'attack', (side, _t, i, n) => wizardFrame(side, { cast: (i + 1) / n, lean: i > 1 ? 1 : -1 }), 4, 13, false);
  buildBank(bank, 'cast', (side, _t, i, n) => wizardFrame(side, { cast: 1 - i / n, bob: -1 }), 5, 10, false);
  buildBank(bank, 'hurt', (side) => wizardFrame(side, { lean: -2, bob: 1 }), 1, 6, false);
  buildBank(bank, 'die', (side) => wizardFrame(side, { collapse: 1 }), 1, 6, false);
  return bank;
}
