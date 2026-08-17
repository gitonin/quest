import { GAME_HEIGHT, GAME_WIDTH } from '../core/config';
import type { Action, Input } from '../core/input';
import { font } from '../gfx/font';
import type { Ctx2D, Renderer } from '../gfx/renderer';

interface TouchButton {
  action: Action;
  x: number;
  y: number;
  r: number;
  label: string;
  color: string;
  /** Touch radius is deliberately larger than the drawn circle. */
  touchR: number;
}

/**
 * On-screen controls.
 *
 * Left thumb: a floating joystick that appears wherever the finger lands.
 * Right thumb: attack (hold to charge), dodge, skill and interact. Every hit
 * area is noticeably bigger than its drawing, which is what makes the game
 * playable on a phone.
 */
export class TouchControls {
  private input: Input;
  private renderer: Renderer;
  private buttons: TouchButton[] = [];
  private stickPointer: number | null = null;
  private stickOrigin = { x: 56, y: 196 };
  private stickPos = { x: 56, y: 196 };
  private stickActive = false;
  private pointerButtons = new Map<number, Action>();
  private stickRadius = 26;
  leftHanded = false;
  visible = true;
  /** Extra taps land here when nothing else consumes them (dialogue advance). */
  onTapAnywhere: (() => void) | null = null;
  private systemButtons: Array<{ id: 'pause' | 'menu'; x: number; y: number; r: number; label: string }> = [];
  onSystemButton: ((id: 'pause' | 'menu') => void) | null = null;
  /** While true every tap is forwarded to the menu layer instead of gameplay. */
  menuMode = false;
  onMenuPointer: ((x: number, y: number) => void) | null = null;

  constructor(input: Input, renderer: Renderer) {
    this.input = input;
    this.renderer = renderer;
    this.layout();
    this.attach(renderer.canvas);
  }

  layout(): void {
    const mirror = (x: number) => (this.leftHanded ? GAME_WIDTH - x : x);
    this.stickOrigin = { x: mirror(56), y: 196 };
    this.stickPos = { ...this.stickOrigin };
    this.buttons = [
      { action: 'attack', x: mirror(420), y: 206, r: 22, touchR: 34, label: 'A', color: '#d64550' },
      { action: 'dodge', x: mirror(382), y: 166, r: 15, touchR: 26, label: 'B', color: '#4a9ff5' },
      { action: 'magic', x: mirror(454), y: 158, r: 15, touchR: 26, label: 'M', color: '#b06cf5' },
      { action: 'interact', x: mirror(374), y: 226, r: 14, touchR: 24, label: 'E', color: '#f0c04a' },
    ];
    this.systemButtons = [
      { id: 'pause', x: GAME_WIDTH - 14, y: 12, r: 9, label: '||' },
      { id: 'menu', x: GAME_WIDTH - 36, y: 12, r: 9, label: 'i' },
    ];
  }

  private attach(canvas: HTMLCanvasElement): void {
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const p = this.renderer.clientToBuffer(e.clientX, e.clientY);
      this.handleDown(e.pointerId, p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      const p = this.renderer.clientToBuffer(e.clientX, e.clientY);
      this.handleMove(e.pointerId, p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      this.handleUp(e.pointerId);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleDown(id: number, x: number, y: number): void {
    if (this.menuMode) {
      this.onMenuPointer?.(x, y);
      return;
    }
    for (const sys of this.systemButtons) {
      if (Math.hypot(x - sys.x, y - sys.y) <= sys.r + 12) {
        this.onSystemButton?.(sys.id);
        return;
      }
    }
    if (this.visible) {
      for (const b of this.buttons) {
        if (Math.hypot(x - b.x, y - b.y) <= b.touchR) {
          this.pointerButtons.set(id, b.action);
          this.input.setTouchAction(b.action, true);
          return;
        }
      }
      // Anything on the movement half becomes the joystick.
      const onStickSide = this.leftHanded ? x > GAME_WIDTH * 0.5 : x < GAME_WIDTH * 0.5;
      if (onStickSide && this.stickPointer === null) {
        this.stickPointer = id;
        this.stickActive = true;
        this.stickOrigin = { x, y };
        this.stickPos = { x, y };
        return;
      }
    }
    this.onTapAnywhere?.();
  }

  private handleMove(id: number, x: number, y: number): void {
    if (this.stickPointer !== id) return;
    const dx = x - this.stickOrigin.x;
    const dy = y - this.stickOrigin.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.stickRadius);
    const nx = len > 0.001 ? (dx / len) * clamped : 0;
    const ny = len > 0.001 ? (dy / len) * clamped : 0;
    this.stickPos = { x: this.stickOrigin.x + nx, y: this.stickOrigin.y + ny };
    // Small dead zone so resting thumbs do not drift.
    const magnitude = clamped / this.stickRadius;
    const scaled = magnitude < 0.18 ? 0 : (magnitude - 0.18) / 0.82;
    this.input.setTouchMove(
      len > 0.001 ? (dx / len) * scaled : 0,
      len > 0.001 ? (dy / len) * scaled : 0,
    );
  }

  private handleUp(id: number): void {
    if (this.stickPointer === id) {
      this.stickPointer = null;
      this.stickActive = false;
      this.stickPos = { ...this.stickOrigin };
      this.input.setTouchMove(0, 0);
    }
    const action = this.pointerButtons.get(id);
    if (action) {
      this.pointerButtons.delete(id);
      this.input.setTouchAction(action, false);
    }
  }

  releaseAll(): void {
    this.stickPointer = null;
    this.stickActive = false;
    this.pointerButtons.clear();
    this.input.releaseAll();
  }

  draw(ctx: Ctx2D, chargeRatio = 0, skillReady = true): void {
    // System buttons are always available, even while the HUD is hidden.
    for (const sys of this.systemButtons) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#141024';
      ctx.beginPath();
      ctx.arc(sys.x, sys.y, sys.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#c9a227';
      ctx.stroke();
      ctx.globalAlpha = 1;
      font.drawCentered(ctx, sys.label, sys.x, sys.y - 4, '#f4f0e4');
    }
    if (!this.visible) return;

    // Joystick.
    const base = this.stickActive ? this.stickOrigin : { x: this.leftHanded ? GAME_WIDTH - 56 : 56, y: 196 };
    ctx.globalAlpha = this.stickActive ? 0.42 : 0.24;
    ctx.strokeStyle = '#f4f0e4';
    ctx.beginPath();
    ctx.arc(base.x, base.y, this.stickRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = this.stickActive ? 0.55 : 0.3;
    ctx.fillStyle = '#f4f0e4';
    ctx.beginPath();
    ctx.arc(this.stickActive ? this.stickPos.x : base.x, this.stickActive ? this.stickPos.y : base.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (const b of this.buttons) {
      const held = this.input.down(b.action);
      ctx.globalAlpha = held ? 0.6 : 0.34;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = held ? 0.95 : 0.6;
      ctx.strokeStyle = '#f4f0e4';
      ctx.stroke();
      ctx.globalAlpha = 1;
      font.drawCentered(ctx, b.label, b.x, b.y - 4, '#f4f0e4');

      if (b.action === 'attack' && chargeRatio > 0.05) {
        ctx.strokeStyle = chargeRatio >= 1 ? '#ffd166' : '#9a6ce8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (b.action === 'magic' && !skillReady) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#07050f';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Used by the pause/inventory screens to know where the safe area ends. */
  get bottomSafeY(): number {
    return GAME_HEIGHT - 60;
  }
}
