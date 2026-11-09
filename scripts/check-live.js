// scripts/check-live.js
// Asks the published site the same questions `npm run check` asks the folder.
//
// `npm run check` proves that the page loads from this machine. This proves that
// it loads from the URL a reader will use, which is a different question: the
// host serves the files over HTTPS, from a subpath, with its own content types,
// and a vendored library that is trusted here must be the same bytes there.
//
//     npm run live
//     npm run live -- https://example.test/some-path/
//
// No dependency, no browser. It reads; it cannot press a button or turn a model.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DATA_FILES } from '../js/core.js';

const DEFAULT_BASE = 'https://kevincreedycars-debug.github.io/bl-site-builder/';
const base = (process.argv[2] || DEFAULT_BASE).replace(/\/*$/, '/');
const get = async (route) => {
  const url = new URL(route.replace(/^\//, ''), base);
  const response = await fetch(url, { redirect: 'follow' });
  return { url: url.href, response, body: await response.text() };
};

const results = [];
const check = async (name, run) => {
  try {
    await run();
    results.push({ name, ok: true });
    console.log(`ok   ${name}`);
  } catch (error) {
    results.push({ name, ok: false, why: error.message });
    console.log(`FAIL ${name}`);
    console.log(`     ${error.message.split('\n').join('\n     ')}`);
  }
};

console.log(`Checking ${base}`);
console.log('');

await check('the page answers, and names its own files', async () => {
  const { response, body } = await get('/');
  assert.equal(response.status, 200);
  assert.match(body, /<div id="app"/);
  assert.match(body, /<script type="module" src="script\.js">/);
  assert.match(body, /<link rel="stylesheet" href="styles\.css"\s*\/?>/);
  assert.match(body, /#\/map/, 'the tab list should link the map');
});

await check('the script is served as a module and imports its own model', async () => {
  const { response, body } = await get('/script.js');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /javascript/);
  assert.match(body, /from '\.\/js\/scene\.js'/);
  assert.match(body, /import\('\.\/js\/map3d\.js'\)/, 'the canvas should be imported only when it is opened');
});

await check('the canvas is served, and reaches for no other host', async () => {
  const { response, body } = await get('/js/map3d.js');
  assert.equal(response.status, 200);
  assert.match(body, /'\.\.\/vendor\/three\.module\.js'/);
  assert.doesNotMatch(body, /from\s+'https?:/);
});

await check('the model is served, and imports the rules and nothing else', async () => {
  const { response, body } = await get('/js/scene.js');
  assert.equal(response.status, 200);
  assert.match(body, /from '\.\/core\.js'/);
  assert.doesNotMatch(body, /import[^;]*three/i);
  assert.doesNotMatch(body, /\b(document|window)\./);
});

await check('the published three.js is the copy this repository recorded', async () => {
  const recorded = await readFile(new URL('../vendor/README.md', import.meta.url), 'utf8');
  const claim = recorded.match(/\|\s*sha256\s*\|\s*`([0-9a-f]{64})`\s*\|/);
  assert.ok(claim, 'vendor/README.md should state a sha256');
  const known = claim[1];

  const response = await fetch(new URL('vendor/three.module.js', base), { redirect: 'follow' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /javascript/, 'a module needs a script content type');
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(bytes).digest('hex');
  assert.equal(actual, known, `published ${actual}, recorded ${known}`);
});

await check('the stylesheet carries the map rules', async () => {
  const { response, body } = await get('/styles.css');
  assert.equal(response.status, 200);
  assert.match(body, /#map-canvas/);
});

await check('every data file answers, parses, and says when it was written', async () => {
  for (const entry of DATA_FILES) {
    const response = await fetch(new URL(entry.path, base), { redirect: 'follow' });
    assert.equal(response.status, 200, `${entry.path} answered ${response.status}`);
    const body = await response.json();
    assert.ok(body._meta && body._meta.as_of, `${entry.path} has no _meta.as_of`);
  }
});

await check('a file that is not there is refused, not invented', async () => {
  const missing = await get('data/not-a-file.json');
  assert.equal(missing.response.status, 404);
});

const failed = results.filter((entry) => !entry.ok);
console.log('');
console.log(`${results.length - failed.length} of ${results.length} checks passed against ${base}`);
if (failed.length) {
  console.log('');
  console.log('The published page is not the page this repository describes:');
  for (const entry of failed) console.log(`  - ${entry.name}: ${entry.why}`);
  process.exitCode = 1;
}
