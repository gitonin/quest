import { GAME_HEIGHT, GAME_WIDTH } from './core/config';
import { GameManager } from './gameManager';
import { Renderer } from './gfx/renderer';

/**
 * Entry point: sizes the canvas to the device, boots the game, and keeps the
 * viewport in sync with rotations and browser chrome changes.
 */
function main(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('canvas #game-canvas missing');
  const root = (canvas.parentElement as HTMLElement | null) ?? document.body;

  const renderer = new Renderer(canvas);
  const game = new GameManager(renderer);

  /**
   * Sizes the canvas from its container rather than from `window`: the game may
   * be embedded in an iframe or a side panel, where the window is not the space
   * it actually gets.
   */
  const resize = (): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = root.getBoundingClientRect();
    const vw = Math.max(160, Math.round(box.width) || window.innerWidth);
    const vh = Math.max(120, Math.round(box.height) || window.innerHeight);
    renderer.resize(vw, vh, dpr);
    // Landscape is recommended, not required: the game still renders in
    // portrait, with a small banner instead of a blocking overlay.
    document.body.classList.toggle('portrait-warn', vh > vw);
    game.handleResize();
  };

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(root);
  resize();

  void game.boot().catch((err) => {
    console.error(err);
    const box = document.getElementById('boot-error');
    if (box) {
      box.style.display = 'block';
      box.textContent = `Erreur de démarrage:\n${String(err && (err as Error).stack ? (err as Error).stack : err)}`;
    }
  });

  // Keeps the address bar from stealing taps on iOS.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  console.info(`[quest] internal resolution ${GAME_WIDTH}x${GAME_HEIGHT}`);
}

main();
