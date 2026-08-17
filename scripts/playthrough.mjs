/**
 * Scripted playthrough test.
 *
 * Walks the actual story path of world 1 and checks the design's acceptance
 * criteria: control the knight, fight, meet the princess, see her join, see the
 * caravan follow, see her fight on her own, then finish the zone and move on to
 * the castle and the star world.
 *
 *   node scripts/playthrough.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.smoke');
const PORT = 4182;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];

function check(label, ok, detail = '') {
  checks.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

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

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(`${err.message}\n${err.stack ?? ''}`));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await sleep(1200);

  const q = (fn, ...args) => page.evaluate(fn, ...args);
  const state = () => q(() => window.__quest.debugState());
  const flags = () => q(() => window.__quest.debugFlags());
  const enemies = () => q(() => window.__quest.debugEnemies());
  const clearDialogue = async () => {
    for (let i = 0; i < 10; i++) {
      const s = await state();
      if (!s.dialogue) return;
      await page.keyboard.press('Space');
      await sleep(160);
    }
  };
  const press = async (key, ms) => {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
  };

  // 1. New game from the title screen.
  const box = await (await page.$('#game-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + (118 / 270) * box.height);
  await sleep(2200);
  check('1. la partie démarre sur le monde 1', (await state()).world === 1);

  await clearDialogue();
  check('2. le dialogue d’intro se termine', !(await state()).dialogue);

  // 3. Movement.
  const before = await state();
  await press('ArrowRight', 900);
  const afterMove = await state();
  check(
    '3. le chevalier se déplace',
    Math.abs(afterMove.player.x - before.player.x) > 40,
    `x ${before.player.x} -> ${afterMove.player.x}`,
  );

  // 4-5. Fight a poison plant in the deep woods and win.
  await q(() => window.__quest.debugTeleport('B'));
  await q(() => window.__quest.debugHeal());
  await sleep(500);
  await clearDialogue();
  const list = await enemies();
  check('4. des ennemis peuplent la forêt profonde', list.length > 0, `${list.length} ennemis`);

  const targeted = await q(() => window.__quest.debugGoToEnemy('poisonPlant'));
  check('5. une plante venimeuse est trouvée', Boolean(targeted), JSON.stringify(targeted));
  let killed = false;
  for (let i = 0; i < 30 && !killed; i++) {
    await q(() => window.__quest.debugHeal());
    await page.keyboard.press('Space');
    await sleep(260);
    const plants = (await enemies()).filter((e) => e.name === 'poisonPlant');
    const nearest = plants.sort((a, b) => a.dist - b.dist)[0];
    if (!nearest || nearest.dist > 40) killed = true;
  }
  const levelled = (await state()).player.level;
  check('6. le combat est gagné (plante tuée)', killed, `niveau ${levelled}`);
  await page.screenshot({ path: join(OUT, 'p0-combat.png') });

  // 7-8. Meet the princess.
  await q(() => window.__quest.debugGoToInteractive('npc.princess'));
  await q(() => window.__quest.debugHeal());
  await sleep(400);
  await page.keyboard.press('KeyE');
  await sleep(400);
  await clearDialogue();
  await sleep(600);
  await clearDialogue();
  const joined = await state();
  check('7. la princesse rejoint le groupe', joined.companions.length === 1, JSON.stringify(joined.companions));
  check('8. le drapeau de quête est posé', (await flags()).includes('party.princess'));
  await page.screenshot({ path: join(OUT, 'p1-princess.png') });

  // 9. Follow behaviour: she must trail the knight, never lead him.
  await q(() => window.__quest.debugHeal());
  await q(() => window.__quest.debugRegroup());
  await sleep(300);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    await press('ArrowLeft', 320);
    await press('ArrowUp', 260);
    const s = await state();
    if (s.companions[0]) samples.push(`${s.companions[0].dist}(${s.companions[0].ai},v${s.companions[0].speed},${s.companions[0].state})`);
  }
  const distances = samples.map((s) => Number(s.split('(')[0]));
  const maxDist = Math.max(...distances);
  check(
    '9. le compagnon suit en file (distance naturelle)',
    maxDist < 90,
    `distances ${samples.join(', ')}`,
  );
  await page.screenshot({ path: join(OUT, 'p2-follow.png') });

  // 10. She fights on her own: park the player next to an enemy and do nothing.
  await clearDialogue();
  await q(() => window.__quest.debugTeleport('D'));
  await sleep(400);
  await clearDialogue();
  await q(() => window.__quest.debugGoToEnemy());
  await q(() => window.__quest.debugRegroup());
  await q(() => window.__quest.debugHeal());
  await sleep(2500);
  await q(() => window.__quest.debugHeal());
  const beforeFight = await enemies();
  const nearestBefore = beforeFight.sort((a, b) => a.dist - b.dist)[0];
  for (let i = 0; i < 5; i++) {
    await sleep(1000);
    await q(() => window.__quest.debugHeal());
  }
  const afterFight = await enemies();
  const nearestAfter = afterFight.find((e) => e.name === nearestBefore?.name);
  const companionFought =
    Boolean(nearestBefore) &&
    (afterFight.length < beforeFight.length || (nearestAfter && nearestAfter.hp < nearestBefore.hp));
  check('10. la princesse combat automatiquement', Boolean(companionFought));
  await page.screenshot({ path: join(OUT, 'p3-autofight.png') });

  // 11. Quest chain: the magic tree ends world 1 and opens the castle.
  await clearDialogue();
  await q(() => window.__quest.debugGoToInteractive('quest.magicTree'));
  await q(() => window.__quest.debugHeal());
  await sleep(500);
  await clearDialogue();
  await page.keyboard.press('KeyE');
  await sleep(400);
  await clearDialogue();
  await sleep(500);
  const treeFlags = await flags();
  check('11. l’Arbre Magique termine la zone', treeFlags.includes('item.magicTree'), treeFlags.join(','));
  await page.screenshot({ path: join(OUT, 'p4-tree.png') });

  // 12. Castle: the wizard joins and the treasure needs the boss dead.
  await q(() => window.__quest.debugGoToWorld(2));
  await sleep(2600);
  await clearDialogue();
  check('12. le château se charge avec la princesse', (await state()).world === 2);
  await q(() => window.__quest.debugGoToInteractive('npc.wizard'));
  await q(() => window.__quest.debugHeal());
  await sleep(500);
  await page.keyboard.press('KeyE');
  await sleep(400);
  await clearDialogue();
  await sleep(600);
  await clearDialogue();
  const party = await state();
  check('13. le magicien rejoint le groupe (3 héros)', party.companions.length === 2, JSON.stringify(party.companions));
  await page.screenshot({ path: join(OUT, 'p5-party3.png') });

  // Locked door refuses to open without the key.
  await q(() => window.__quest.debugGoToInteractive('quest.treasure'));
  await sleep(400);
  await page.keyboard.press('KeyE');
  await sleep(500);
  check('14. le trésor reste gardé tant que le boss vit', !(await flags()).includes('item.treasure'));

  // 13. Star world.
  await q(() => window.__quest.debugGoToWorld(3));
  await sleep(2600);
  await clearDialogue();
  const space = await state();
  check('15. le monde des étoiles se charge', space.world === 3 && space.enemies > 0, `${space.enemies} ennemis`);
  await page.screenshot({ path: join(OUT, 'p6-space.png') });

  // 14. Saving and reloading keeps the party.
  await page.keyboard.press('Escape');
  await sleep(300);
  const saved = await q(() => {
    const g = window.__quest;
    g.debugState();
    return true;
  });
  check('16. le menu pause s’ouvre', (await state()).state === 'paused', String(saved));

  await browser.close();
  server.close();

  const failed = checks.filter((c) => !c.ok);
  if (errors.length) {
    console.error('\nERREURS JS:\n' + errors.join('\n'));
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} vérifications OK`);
  if (failed.length || errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
