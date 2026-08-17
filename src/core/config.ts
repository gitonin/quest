/**
 * Global tuning constants. Anything a designer may want to tweak without
 * touching gameplay code lives here or in `src/data/`.
 */

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

/** Tiles are 16x16 like the 16-bit consoles this game pays homage to. */
export const TILE = 16;

/** Fixed simulation step (60 Hz). The loop accumulates real time into it. */
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.25;

export const CAMERA = {
  /** Higher = snappier follow. */
  smoothing: 9,
  /** Dead-zone in pixels: the camera ignores tiny player movement. */
  deadzoneX: 18,
  deadzoneY: 12,
  shakeDecay: 7,
  maxShake: 6,
} as const;

export const COMBAT = {
  hitstopSeconds: 0.06,
  invulnerableAfterHit: 0.55,
  knockbackDecay: 12,
  damageVariance: 0.12,
} as const;

export const FOLLOW = {
  /** Distance in pixels between two members of the caravan. */
  spacing: 22,
  /** Positions recorded per second on the leader's trail. */
  trailHz: 60,
  maxTrailPoints: 240,
  /** Beyond this the companion gives up on the trail and walks straight in. */
  catchUpDistance: 96,
  /** Beyond this it is teleported back (last resort, avoids soft-locks). */
  teleportDistance: 240,
} as const;

export const SAVE_KEY_PREFIX = 'quest3stars.slot';
export const SAVE_SLOTS = 3;
export const SETTINGS_KEY = 'quest3stars.settings';
