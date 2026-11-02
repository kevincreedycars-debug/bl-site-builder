// scripts/verify-dashboard.js
// Serves this folder and asks it for its own files, then checks what came back.
//
// The unit tests read the files from disk; this asks the same question over
// HTTP, which is how a browser will ask it. A page that passes here is one that
// can at least load: index.html is present, every data file parses, the script
// and stylesheet are served, and nothing reaches out to another host.

import assert from 'node:assert/strict';
import { startServer } from './serve.js';
import { DATA_FILES } from '../js/core.js';

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

const started = await startServer({ port: 0, quiet: true });
const base = started.url;
const get = (route) => fetch(new URL(route.replace(/^\//, ''), base));

try {
  console.log(`Checking ${base}`);
  console.log('');

  let index = '';
  await check('index.html is served and names its own files', async () => {
    const response = await get('/');
    assert.equal(response.status, 200);
    index = await response.text();
    assert.match(index, /<div id="app"/);
    assert.match(index, /<script type="module" src="script\.js">/);
    assert.match(index, /href="styles\.css"/);
    for (const view of ['overview', 'sites', 'content', 'backlinks', 'email', 'eeat', 'runs', 'harness']) {
      assert.ok(index.includes(`data-view="${view}"`), `the tab list should include ${view}`);
    }
    assert.ok(!/<(script|link)[^>]+(src|href)="https?:\/\//i.test(index), 'the page should not load anything from another host');
  });

  await check('the page script and the stylesheet are served', async () => {
    const script = await get('/script.js');
    assert.equal(script.status, 200);
    const source = await script.text();
    assert.match(source, /^import \{/m);
    assert.ok(source.includes('deriveAttention'), 'the page should use the shared rules');
    assert.ok(source.includes('boot()'), 'the page should start itself');

    const styles = await get('/styles.css');
    assert.equal(styles.status, 200);
    const css = await styles.text();
    assert.ok(css.length > 4000, 'the stylesheet looks truncated');
    assert.match(css, /prefers-color-scheme/);
    assert.match(css, /@media print/);
  });

  for (const { key, path: file } of DATA_FILES) {
    await check(`${file} is served and parses`, async () => {
      const response = await get(`/${file}`);
      assert.equal(response.status, 200, `${file} answered ${response.status}`);
      const body = await response.json();
      assert.ok(body._meta && body._meta.as_of, `${file} should carry _meta.as_of`);
      console.log(`     ${key}: written ${body._meta.as_of} by ${body._meta.produced_by || 'nobody stated'}`);
    });
  }

  await check('a file that is not there is refused, not invented', async () => {
    const missing = await get('/data/not-a-file.json');
    assert.equal(missing.status, 404);
    const dotfile = await get('/.git/config');
    assert.equal(dotfile.status, 404, 'dotfiles should not be served');
  });

  await check('the check itself is honest about the folder it served', async () => {
    const response = await get('/package.json');
    assert.equal(response.status, 200);
    const pkg = await response.json();
    assert.equal(pkg.dependencies && Object.keys(pkg.dependencies).length, 0, 'the page must not need a dependency');
  });
} finally {
  await started.close();
}

const failed = results.filter((entry) => !entry.ok);
console.log('');
console.log(`${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) {
  console.log('');
  console.log('The page is not ready to be shown:');
  for (const entry of failed) console.log(`  - ${entry.name}: ${entry.why}`);
  process.exitCode = 1;
}
