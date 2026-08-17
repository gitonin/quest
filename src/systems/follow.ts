import { FOLLOW } from '../core/config';

interface TrailPoint {
  x: number;
  y: number;
  /** Cumulative distance walked by the leader when this point was recorded. */
  travelled: number;
}

/**
 * Breadcrumb trail left by the player.
 *
 * Companions walk on it a fixed number of pixels behind, which is what makes
 * the caravan follow the leader's actual path - around trees, over bridges -
 * instead of cutting corners or teleporting in front of him.
 */
export class Trail {
  private points: TrailPoint[] = [];
  private travelled = 0;

  reset(x: number, y: number): void {
    this.points = [{ x, y, travelled: 0 }];
    this.travelled = 0;
  }

  get head(): TrailPoint {
    return this.points[this.points.length - 1];
  }

  record(x: number, y: number): void {
    if (this.points.length === 0) {
      this.reset(x, y);
      return;
    }
    const last = this.head;
    const d = Math.hypot(x - last.x, y - last.y);
    if (d < 1.5) return;
    this.travelled += d;
    this.points.push({ x, y, travelled: this.travelled });
    if (this.points.length > FOLLOW.maxTrailPoints) this.points.shift();
  }

  /**
   * Travelled distance of the trail sample closest to a point.
   *
   * Companions use this to know *where on the path they are*, so they can walk
   * the trail itself instead of cutting straight towards the leader through
   * whatever trees happen to be in between.
   */
  nearestProgress(x: number, y: number): { progress: number; distance: number } {
    let bestProgress = this.travelled;
    let bestDist = Infinity;
    for (const point of this.points) {
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestProgress = point.travelled;
      }
    }
    return { progress: bestProgress, distance: bestDist };
  }

  /** Absolute position at a given travelled distance along the trail. */
  pointAtProgress(progress: number): { x: number; y: number } {
    return this.pointBehind(this.travelled - progress);
  }

  /** Position `distance` pixels behind the head, interpolated between samples. */
  pointBehind(distance: number): { x: number; y: number } {
    if (this.points.length === 0) return { x: 0, y: 0 };
    const target = this.travelled - distance;
    const first = this.points[0];
    if (target <= first.travelled) {
      // The trail is shorter than what was asked for (party just spawned, or
      // the leader has not moved yet): extrapolate backwards so the caravan
      // still lines up instead of stacking on a single point.
      const missing = first.travelled - target;
      const next = this.points[1] ?? this.head;
      const dx = first.x - next.x;
      const dy = first.y - next.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) return { x: first.x, y: first.y + missing };
      return { x: first.x + (dx / len) * missing, y: first.y + (dy / len) * missing };
    }

    for (let i = this.points.length - 1; i > 0; i--) {
      const b = this.points[i];
      const a = this.points[i - 1];
      if (b.travelled >= target && a.travelled <= target) {
        const span = b.travelled - a.travelled || 1;
        const t = (target - a.travelled) / span;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    const head = this.head;
    return { x: head.x, y: head.y };
  }

  get length(): number {
    return this.travelled;
  }
}

/**
 * Steering used by every companion: seek the goal, then push away from
 * neighbours and obstacles so they never stack up or grind against a wall.
 */
export interface SteerAgent {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function separation(agent: SteerAgent, others: SteerAgent[], radius: number): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const other of others) {
    if (other === agent) continue;
    const dx = agent.x - other.x;
    const dy = agent.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d > radius || d < 0.001) continue;
    const push = (radius - d) / radius;
    sx += (dx / d) * push;
    sy += (dy / d) * push;
  }
  return { x: sx, y: sy };
}

/**
 * Obstacle avoidance by probing: if the direct path is blocked, try
 * increasingly wide angles left and right and take the first one that is free.
 */
export function avoidObstacles(
  agent: SteerAgent,
  dirX: number,
  dirY: number,
  probe: number,
  blocked: (x: number, y: number, w: number, h: number) => boolean,
): { x: number; y: number } {
  const len = Math.hypot(dirX, dirY);
  if (len < 0.001) return { x: 0, y: 0 };
  const nx = dirX / len;
  const ny = dirY / len;
  if (!blocked(agent.x + nx * probe, agent.y + ny * probe, agent.w, agent.h)) {
    return { x: nx, y: ny };
  }
  for (const angle of [0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tx = nx * cos - ny * sin;
    const ty = nx * sin + ny * cos;
    if (!blocked(agent.x + tx * probe, agent.y + ty * probe, agent.w, agent.h)) {
      return { x: tx, y: ty };
    }
  }
  return { x: -nx, y: -ny };
}
