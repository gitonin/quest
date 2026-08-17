import type { Vec2 } from './math';
import { clamp } from './math';

export type Action = 'attack' | 'dodge' | 'magic' | 'interact' | 'pause' | 'menu';

const ACTIONS: Action[] = ['attack', 'dodge', 'magic', 'interact', 'pause', 'menu'];

interface ButtonState {
  down: boolean;
  pressed: boolean;
  released: boolean;
  heldFor: number;
}

/**
 * Device-agnostic input hub.
 *
 * Two producers write into it - the keyboard listener (desktop testing) and the
 * on-screen touch controls (`ui/TouchControls`). Gameplay code only ever reads
 * from here, so adding a gamepad later means adding one more producer.
 */
export class Input {
  readonly move: Vec2 = { x: 0, y: 0 };

  private keyboardAxis = new Set<'left' | 'right' | 'up' | 'down'>();
  private touchMove: Vec2 = { x: 0, y: 0 };
  private buttons = new Map<Action, ButtonState>();
  private keyboardHeld = new Set<Action>();
  private touchHeld = new Set<Action>();
  /**
   * Actions that went down since the last `update`. A tap can begin and end
   * inside a single frame - on a touch screen and in automated tests alike -
   * and without this latch the press edge would simply never be observed.
   */
  private latched = new Set<Action>();
  private detached: Array<() => void> = [];

  constructor() {
    for (const a of ACTIONS) {
      this.buttons.set(a, { down: false, pressed: false, released: false, heldFor: 0 });
    }
  }

  attachKeyboard(target: Window): void {
    const onDown = (e: KeyboardEvent) => this.handleKey(e, true);
    const onUp = (e: KeyboardEvent) => this.handleKey(e, false);
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    this.detached.push(() => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
    });
  }

  dispose(): void {
    for (const off of this.detached) off();
    this.detached.length = 0;
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    const action = keyToAction(e.code);
    if (action) {
      if (down) {
        this.keyboardHeld.add(action);
        this.latched.add(action);
      } else {
        this.keyboardHeld.delete(action);
      }
      e.preventDefault();
      return;
    }
    const axis = keyToAxis(e.code);
    if (!axis) return;
    e.preventDefault();
    if (down) this.keyboardAxis.add(axis);
    else this.keyboardAxis.delete(axis);
  }

  /** Called by the touch controls every time the joystick moves. */
  setTouchMove(x: number, y: number): void {
    this.touchMove.x = clamp(x, -1, 1);
    this.touchMove.y = clamp(y, -1, 1);
  }

  setTouchAction(action: Action, down: boolean): void {
    if (down) {
      this.touchHeld.add(action);
      this.latched.add(action);
    } else {
      this.touchHeld.delete(action);
    }
  }

  /** Clears everything - used when a menu opens so no button stays stuck down. */
  releaseAll(): void {
    this.touchHeld.clear();
    this.keyboardHeld.clear();
    this.keyboardAxis.clear();
    this.latched.clear();
    this.touchMove.x = this.touchMove.y = 0;
  }

  update(dt: number): void {
    // Touch wins when it is actually being used, otherwise fall back to keys.
    const touchLen = Math.hypot(this.touchMove.x, this.touchMove.y);
    if (touchLen > 0.01) {
      this.move.x = this.touchMove.x;
      this.move.y = this.touchMove.y;
    } else {
      let kx = 0;
      let ky = 0;
      if (this.keyboardAxis.has('left')) kx -= 1;
      if (this.keyboardAxis.has('right')) kx += 1;
      if (this.keyboardAxis.has('up')) ky -= 1;
      if (this.keyboardAxis.has('down')) ky += 1;
      const len = Math.hypot(kx, ky);
      this.move.x = len > 1 ? kx / len : kx;
      this.move.y = len > 1 ? ky / len : ky;
    }

    for (const action of ACTIONS) {
      const state = this.buttons.get(action)!;
      const down = this.keyboardHeld.has(action) || this.touchHeld.has(action) || this.latched.has(action);
      state.pressed = down && !state.down;
      state.released = !down && state.down;
      state.down = down;
      state.heldFor = down ? state.heldFor + dt : 0;
    }
    this.latched.clear();
  }

  down(action: Action): boolean {
    return this.buttons.get(action)!.down;
  }

  pressed(action: Action): boolean {
    return this.buttons.get(action)!.pressed;
  }

  released(action: Action): boolean {
    return this.buttons.get(action)!.released;
  }

  heldFor(action: Action): number {
    return this.buttons.get(action)!.heldFor;
  }

  /** Consumes an edge so two systems cannot both react to the same press. */
  consume(action: Action): void {
    const state = this.buttons.get(action)!;
    state.pressed = false;
    state.released = false;
  }
}

function keyToAction(code: string): Action | null {
  switch (code) {
    case 'Space':
    case 'KeyJ':
      return 'attack';
    case 'ShiftLeft':
    case 'KeyK':
      return 'dodge';
    case 'KeyL':
    case 'KeyF':
      return 'magic';
    case 'KeyE':
    case 'Enter':
      return 'interact';
    case 'Escape':
    case 'KeyP':
      return 'pause';
    case 'KeyI':
    case 'Tab':
      return 'menu';
    default:
      return null;
  }
}

function keyToAxis(code: string): 'left' | 'right' | 'up' | 'down' | null {
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
    case 'KeyQ':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'ArrowUp':
    case 'KeyW':
    case 'KeyZ':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    default:
      return null;
  }
}
