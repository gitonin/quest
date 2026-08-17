import { CAMERA, GAME_HEIGHT, GAME_WIDTH } from './config';
import { clamp, damp, RNG } from './math';

export interface CameraZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * RPG camera: follows the player with a dead-zone, smooths its motion, clamps to
 * the active camera zone (so a level never shows its own edges) and supports a
 * short trauma-based shake for impacts.
 */
export class Camera {
  x = 0;
  y = 0;
  private targetX = 0;
  private targetY = 0;
  private trauma = 0;
  private rng = new RNG(1337);
  private zone: CameraZone | null = null;
  private zones: CameraZone[] = [];
  shakeX = 0;
  shakeY = 0;

  setZones(zones: CameraZone[]): void {
    this.zones = zones;
    this.zone = zones[0] ?? null;
  }

  /** Picks the zone containing the point; keeps the previous one if none match. */
  updateZone(px: number, py: number): void {
    for (const z of this.zones) {
      if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) {
        this.zone = z;
        return;
      }
    }
  }

  get activeZoneId(): string | null {
    return this.zone?.id ?? null;
  }

  snapTo(px: number, py: number): void {
    this.updateZone(px, py);
    this.targetX = px - GAME_WIDTH / 2;
    this.targetY = py - GAME_HEIGHT / 2;
    this.clampToZone();
    this.x = this.targetX;
    this.y = this.targetY;
  }

  follow(px: number, py: number, dt: number): void {
    this.updateZone(px, py);

    const centerX = this.targetX + GAME_WIDTH / 2;
    const centerY = this.targetY + GAME_HEIGHT / 2;
    const dx = px - centerX;
    const dy = py - centerY;

    if (Math.abs(dx) > CAMERA.deadzoneX) {
      this.targetX += dx - Math.sign(dx) * CAMERA.deadzoneX;
    }
    if (Math.abs(dy) > CAMERA.deadzoneY) {
      this.targetY += dy - Math.sign(dy) * CAMERA.deadzoneY;
    }
    this.clampToZone();

    this.x = damp(this.x, this.targetX, CAMERA.smoothing, dt);
    this.y = damp(this.y, this.targetY, CAMERA.smoothing, dt);

    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - CAMERA.shakeDecay * dt);
      const amount = this.trauma * this.trauma * CAMERA.maxShake;
      this.shakeX = (this.rng.next() * 2 - 1) * amount;
      this.shakeY = (this.rng.next() * 2 - 1) * amount;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  shake(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  /** Rounded, shake-included origin used when drawing the world. */
  get renderX(): number {
    return Math.round(this.x + this.shakeX);
  }

  get renderY(): number {
    return Math.round(this.y + this.shakeY);
  }

  private clampToZone(): void {
    const z = this.zone;
    if (!z) return;
    const maxX = Math.max(z.x, z.x + z.w - GAME_WIDTH);
    const maxY = Math.max(z.y, z.y + z.h - GAME_HEIGHT);
    // When a zone is smaller than the screen we centre on it instead of clamping.
    this.targetX = z.w < GAME_WIDTH ? z.x + (z.w - GAME_WIDTH) / 2 : clamp(this.targetX, z.x, maxX);
    this.targetY = z.h < GAME_HEIGHT ? z.y + (z.h - GAME_HEIGHT) / 2 : clamp(this.targetY, z.y, maxY);
  }
}
