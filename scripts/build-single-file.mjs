/**
 * Bundles the built game into one self-contained HTML page.
 *
 * Useful to hand the game to someone as a single file (or to host it anywhere
 * that only accepts one document): the JS bundle is inlined, so the page has no
 * external requests at all.
 *
 *   npm run build && node scripts/build-single-file.mjs [output.html]
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const out = process.argv[2] ?? join(ROOT, 'quest-single-file.html');

const assets = await readdir(join(DIST, 'assets'));
const bundleName = assets.find((f) => f.endsWith('.js'));
if (!bundleName) throw new Error('no JS bundle in dist/assets — run `npm run build` first');
const bundle = await readFile(join(DIST, 'assets', bundleName), 'utf8');
const html = await readFile(join(DIST, 'index.html'), 'utf8');

// Everything between <body> and </body>, minus the module script tag.
const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script[^>]*><\/script>/g, '')
  .trim();
const styles = html.slice(html.indexOf('<style>'), html.indexOf('</style>') + 8);

// `</script` inside a string literal would close the inline tag early.
const safeBundle = bundle.replace(/<\/script/gi, '<\\/script');

const page = `<title>La Quête des Trois Étoiles</title>
${styles}
${body}
<script type="module">
${safeBundle}
</script>
`;

await writeFile(out, page, 'utf8');
console.log(`${out} — ${(page.length / 1024).toFixed(0)} kB, aucune requête externe`);
