/**
 * Headless smoke test.
 *
 * Boots the built game in Chromium, plays a scripted session (new game, walk,
 * fight, reach the princess, open menus) and fails on any console error or
 * uncaught exception. Screenshots land in `.smoke/` for eyeballing the art.
 *
 *   node scripts/smoke.mjs [--keep]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.smoke');
const PORT = 4178;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
};

function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
    const file = join(DIST, path === '/' ? 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    // The optional sprite-sheet manifest is allowed to be absent.
    if (msg.type() === 'error' && !text.includes('manifest.json') && !text.includes('favicon')) {
      errors.push(`console: ${text}`);
    }
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await sleep(1500);
  await page.screenshot({ path: join(OUT, '01-title.png') });

  // Start a new game on slot 1 (title screen slot rect, buffer coords -> css).
  const canvas = await page.$('#game-canvas');
  const box = await canvas.boundingBox();
  const toClient = (bx, by) => ({
    x: box.x + (bx / 480) * box.width,
    y: box.y + (by / 270) * box.height,
  });
  const slot = toClient(240, 118);
  await page.mouse.click(slot.x, slot.y);
  await sleep(2500);
  await page.screenshot({ path: join(OUT, '02-forest.png') });

  const report = async (label) =>
    page.evaluate(() => {
      const g = window.__quest;
      return g ? g.debugState() : null;
    }).then((state) => ({ label, state }));

  // Clear the intro dialogue (each tap first completes the typewriter reveal).
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Space');
    await sleep(180);
  }
  const afterIntro = await page.evaluate(() => window.__quest.debugState());
  if (afterIntro.dialogue) throw new Error('intro dialogue never closed');

  // Walk east towards the deep woods, swinging at anything on the way.
  const press = async (key, ms) => {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
  };
  for (let i = 0; i < 6; i++) {
    await press('ArrowRight', 700);
    await page.keyboard.press('Space');
    await sleep(200);
  }
  await page.screenshot({ path: join(OUT, '03-walk.png') });
  const afterWalk = await page.evaluate(() => window.__quest.debugState());
  if (Math.abs(afterWalk.player.x - afterIntro.player.x) < 40) {
    throw new Error(`player did not move: ${afterIntro.player.x} -> ${afterWalk.player.x}`);
  }

  // Charged attack + dodge.
  await page.keyboard.down('Space');
  await sleep(700);
  await page.keyboard.up('Space');
  await sleep(400);
  await page.keyboard.press('ShiftLeft');
  await sleep(400);
  await page.screenshot({ path: join(OUT, '04-combat.png') });

  // Teleport the party to the princess encounter and let the AI run.
  await page.evaluate(() => window.__quest?.debugTeleport?.('C'));
  await sleep(600);
  await page.evaluate(() => window.__quest?.debugJoinPrincess?.());
  await sleep(1200);
  for (let i = 0; i < 4; i++) {
    await press('ArrowLeft', 500);
    await press('ArrowDown', 400);
  }
  await sleep(600);
  await page.screenshot({ path: join(OUT, '05-companion.png') });
  const partyState = await report('party');

  // Menus.
  await page.keyboard.press('Escape');
  await sleep(400);
  await page.screenshot({ path: join(OUT, '06-pause.png') });
  await page.keyboard.press('Escape');
  await sleep(300);

  // Visit worlds 2 and 3 to make sure both levels build and render.
  await page.evaluate(() => window.__quest?.debugGoToWorld?.(2));
  await sleep(2500);
  await page.screenshot({ path: join(OUT, '07-castle.png') });
  await page.evaluate(() => window.__quest?.debugGoToWorld?.(3));
  await sleep(2500);
  await page.screenshot({ path: join(OUT, '08-space.png') });

  const fps = await page.evaluate(async () => {
    const t0 = performance.now();
    let frames = 0;
    await new Promise((resolve) => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 > 2000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return Math.round((frames / (performance.now() - t0)) * 1000);
  });

  const finalState = await report('final');
  await browser.close();
  server.close();

  console.log('party state:', JSON.stringify(partyState.state));
  console.log('final state:', JSON.stringify(finalState.state));
  console.log('measured fps:', fps);

  if (errors.length > 0) {
    console.error('\nERRORS:\n' + errors.join('\n'));
    process.exit(1);
  }
  if (fps < 45) {
    console.error(`\nFPS too low: ${fps}`);
    process.exit(1);
  }
  console.log('\nsmoke OK — screenshots in .smoke/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
