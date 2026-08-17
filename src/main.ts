import { GAME_HEIGHT, GAME_WIDTH } from './core/config';
import { GameManager } from './gameManager';
import { Renderer } from './gfx/renderer';

/**
 * Entry point: sizes the canvas to the space it is given, boots the game, and
 * surfaces any failure as readable on-screen text.
 *
 * A game that fails silently just looks like a black rectangle, which is
 * impossible to diagnose on someone else's phone - so every failure path here
 * ends in visible DOM text, never in a blank canvas.
 */
function main(): void {
  const status = document.getElementById('boot-error');

  const report = (title: string, detail: string): void => {
    if (!status) return;
    status.style.display = 'block';
    status.textContent = `${title}\n${detail}`;
  };

  window.addEventListener('error', (e) => {
    report('Erreur JavaScript', `${e.message}\n${e.filename ?? ''}:${e.lineno ?? 0}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    report('Promesse rejetée', String((e.reason as Error)?.stack ?? e.reason));
  });

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    report('Démarrage impossible', 'canvas #game-canvas introuvable');
    return;
  }
  const root = (canvas.parentElement as HTMLElement | null) ?? document.body;

  let renderer: Renderer;
  let game: GameManager;
  try {
    renderer = new Renderer(canvas);
    game = new GameManager(renderer);
  } catch (err) {
    report('Démarrage impossible', String((err as Error)?.stack ?? err));
    return;
  }

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
  // Visible proof that the canvas itself works, before a single sprite exists.
  renderer.splash('CHARGEMENT…');

  try {
    game.boot((step) => {
      if (status) {
        status.style.display = 'block';
        status.textContent = `Chargement — ${step}…`;
      }
    });
    if (status) {
      status.style.display = 'none';
      status.textContent = '';
    }
  } catch (err) {
    report('Erreur de démarrage', String((err as Error)?.stack ?? err));
    return;
  }

  // Keeps the address bar from stealing taps on iOS.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  console.info(`[quest] internal resolution ${GAME_WIDTH}x${GAME_HEIGHT}`);
}

main();
