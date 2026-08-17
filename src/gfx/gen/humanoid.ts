import { PixelBuf, shade } from '../pixel';

/**
 * Shared humanoid builder for the three heroes.
 *
 * Every hero frame is 20x24 with the feet resting on y=22, which keeps their
 * silhouettes consistent and small against the 16px world tiles - the same
 * proportion the reference sheet uses.
 */

export const HERO_W = 20;
export const HERO_H = 24;
export const HERO_FEET_Y = 22;

export type Side = 'down' | 'up' | 'side';

export interface BodyStyle {
  torsoDark: string;
  torso: string;
  torsoLit: string;
  legDark: string;
  leg: string;
  boot: string;
  arm: string;
  armDark: string;
  /** Long robe/dress: hides the legs and flares out at the bottom. */
  robe?: boolean;
  robeHem?: string;
  belt?: string;
  cape?: string;
  outline: string;
}

export interface PoseOptions {
  side: Side;
  /** -1..1 vertical body offset for breathing / walking bob. */
  bob: number;
  /** -1..1 stride, 0 = feet together. */
  stride: number;
  /** -1..1 arm swing. */
  armSwing: number;
  /** Extra forward lean in pixels (attack anticipation). */
  lean: number;
}

export function newHeroBuf(): PixelBuf {
  return new PixelBuf(HERO_W, HERO_H);
}

/** Draws torso, arms and legs. Heads and weapons are added by each hero. */
export function drawBody(buf: PixelBuf, style: BodyStyle, pose: PoseOptions): void {
  const cx = 10;
  const top = 12 + pose.bob;
  const lean = pose.lean;

  if (style.cape && pose.side !== 'down') {
    const capeX = pose.side === 'side' ? cx - 4 + lean : cx - 4;
    buf.rect(capeX, top - 1, 8, 9, style.cape);
    buf.rect(capeX + 1, top + 7, 6, 2, shade(style.cape, -0.15));
  }

  // Legs (or robe hem).
  if (style.robe) {
    const hem = style.robeHem ?? style.torso;
    for (let y = 0; y < 11; y++) {
      const w = 6 + Math.floor(y * 0.6);
      const yy = top + 1 + y;
      if (yy > HERO_FEET_Y) break;
      buf.hline(cx - Math.floor(w / 2) + lean, cx - Math.floor(w / 2) + w - 1 + lean, yy, y > 7 ? hem : style.torso);
    }
    // Hem shading + a hint of feet peeking out when walking.
    buf.hline(cx - 5 + lean, cx + 4 + lean, HERO_FEET_Y, shade(hem, -0.25));
    if (pose.stride !== 0) {
      buf.rect(cx - 3 + Math.round(pose.stride * 2) + lean, HERO_FEET_Y - 1, 2, 2, style.boot);
    }
  } else {
    const legTop = top + 6;
    const strideL = Math.round(pose.stride * 2);
    const strideR = -strideL;
    drawLeg(buf, cx - 3 + strideL + lean, legTop, style, Math.abs(strideL));
    drawLeg(buf, cx + 1 + strideR + lean, legTop, style, Math.abs(strideR));
  }

  // Torso.
  const torsoTop = top;
  buf.rect(cx - 4 + lean, torsoTop, 8, 7, style.torso);
  buf.rect(cx - 4 + lean, torsoTop, 2, 7, style.torsoDark);
  buf.rect(cx + 2 + lean, torsoTop, 2, 7, style.torsoLit);
  if (style.belt) buf.hline(cx - 4 + lean, cx + 3 + lean, torsoTop + 5, style.belt);

  // Arms.
  const swing = Math.round(pose.armSwing * 2);
  if (pose.side === 'side') {
    buf.rect(cx - 1 + lean + swing, torsoTop + 1, 3, 5, style.arm);
    buf.rect(cx - 1 + lean + swing, torsoTop + 1, 1, 5, style.armDark);
  } else {
    buf.rect(cx - 6 + lean, torsoTop + 1 + swing, 2, 5, style.armDark);
    buf.rect(cx + 4 + lean, torsoTop + 1 - swing, 2, 5, style.arm);
  }
}

function drawLeg(buf: PixelBuf, x: number, y: number, style: BodyStyle, lift: number): void {
  const h = 5 - Math.min(1, lift);
  buf.rect(x, y, 3, h, style.leg);
  buf.rect(x, y, 1, h, style.legDark);
  buf.rect(x, y + h, 3, 2, style.boot);
}

/** Generic head block used as the base for helmets, hair and hats. */
export function drawHead(
  buf: PixelBuf,
  side: Side,
  top: number,
  colors: { skin: string; skinDark: string },
): void {
  const cx = 10;
  buf.rect(cx - 3, top, 6, 6, colors.skin);
  buf.rect(cx - 3, top, 1, 6, colors.skinDark);
  if (side === 'side') {
    buf.rect(cx - 2, top, 5, 6, colors.skin);
    buf.rect(cx + 2, top + 2, 1, 2, colors.skinDark);
  }
}

export function drawEyes(buf: PixelBuf, side: Side, top: number, color: string): void {
  const cx = 10;
  if (side === 'up') return;
  if (side === 'down') {
    buf.set(cx - 2, top + 3, color);
    buf.set(cx + 1, top + 3, color);
  } else {
    buf.set(cx + 1, top + 3, color);
  }
}

/** Final pass applied to every hero frame so they read against busy scenery. */
export function finishHero(buf: PixelBuf, outline: string): PixelBuf {
  buf.outline(outline, 210);
  return buf;
}
