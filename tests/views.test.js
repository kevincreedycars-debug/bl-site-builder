// tests/views.test.js
// Every view is drawn once, in Node, against the real files in data/.
//
// There is no browser here and no DOM library, so this file builds the smallest
// page script.js needs: a container, the tab links, a skip link and a fetch that
// reads from disk. What it proves is narrow and useful: each view runs to the
// end, produces the section it promises, and none of them leaks undefined, NaN
// or an unstringified object into the markup.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { DATA_FILES } from '../js/core.js';
import { buildPortfolioScene } from '../js/scene.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function makeElement(id) {
  const classes = new Set();
  return {
    id,
    innerHTML: '',
    textContent: '',
    className: '',
    title: '',
    dataset: {},
    style: {},
    attributes: {},
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, on) => {
        if (on === undefined ? !classes.has(name) : on) classes.add(name);
        else classes.delete(name);
        return classes.has(name);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
    focus() {},
    scrollIntoView() {},
    addEventListener() {}
  };
}

function buildPage(views) {
  const byId = new Map();
  const element = (id) => {
    if (!byId.has(id)) byId.set(id, makeElement(id));
    return byId.get(id);
  };
  const tabs = views.map((view) => {
    const tab = makeElement(`tab-${view}`);
    tab.dataset.view = view;
    return tab;
  });
  const skip = makeElement('skip');

  const document = {
    title: '',
    getElementById: element,
    querySelectorAll: (selector) => (selector === '.tabs a[data-view]' ? tabs : []),
    querySelector: (selector) => (selector === 'a.skip' ? skip : null)
  };

  const window = {
    location: { hash: '' },
    addEventListener() {},
    scrollTo() {}
  };

  return { document, window, element, tabs };
}

// The page asks for its own files by relative path. Serve them from the repo.
async function diskFetch(input) {
  const url = String(input).replace(/^\.\//, '');
  const file = path.join(ROOT, url);
  try {
    const text = await readFile(file, 'utf8');
    return { ok: true, status: 200, url, json: async () => JSON.parse(text), text: async () => text };
  } catch {
    return { ok: false, status: 404, url, json: async () => ({}), text: async () => '' };
  }
}

async function waitFor(check, label, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${label}`);
}

const VIEWS = ['overview', 'map', 'sites', 'content', 'backlinks', 'email', 'eeat', 'runs', 'harness'];

// A phrase that only that view's own body contains, so a fallback to the
// overview cannot pass the check.
const MARKERS = {
  overview: 'The files this page was built from',
  map: 'Every mark has a meaning',
  sites: 'What each check found',
  content: 'Rows that fail their own checks',
  backlinks: 'What the states mean',
  email: 'Today against cap',
  eeat: 'The matrix',
  runs: 'What the last run wrote about itself',
  harness: 'What the control file allows'
};

test('every view draws from the real data files', async (t) => {
  // One page script per view, because the hash is read once at start-up and the
  // query string keeps Node from reusing the previous module instance.
  for (const [index, view] of VIEWS.entries()) {
    await t.test(view, async () => {
      const page = buildPage(VIEWS);
      page.window.location.hash = `#/${view}`;
      globalThis.document = page.document;
      globalThis.window = page.window;
      globalThis.fetch = diskFetch;

      await import(pathToFileURL(path.join(ROOT, 'script.js')).href + `?view=${view}&n=${index}`);

      const app = page.element('app');
      const html = await waitFor(
        () => (app.innerHTML.includes(`id="view-${view}"`) ? app.innerHTML : null),
        `${view} to draw`
      );

      assert.ok(html.includes(MARKERS[view]), `${view} should contain its own section`);
      assert.ok(!html.includes('stopped while drawing itself'), `${view} threw while drawing`);
      assert.ok(!html.includes('could not be read at all'), `${view} could not read the files`);
      assert.ok(!/undefined|NaN|\[object Object\]/.test(html), `${view} leaked a missing or unformatted value`);

      const active = page.tabs.filter((tab) => tab.classList.contains('is-active'));
      assert.equal(active.length, 1, `${view} should mark exactly one tab`);
      assert.equal(active[0].dataset.view, view);
      assert.equal(active[0].attributes['aria-current'], 'page');

      // The header chips and the footer are filled from the same read.
      assert.ok(page.element('data-age').textContent, 'the header should say how old the files are');
      assert.ok(page.element('attention-total').textContent, 'the header should count what needs attention');
      assert.ok(page.element('footer-sources').textContent.includes('data/'), 'the footer should list the files');
    });
  }
});

test('the map view holds a table row for every object the model draws', async () => {
  const page = buildPage(VIEWS);
  page.window.location.hash = '#/map';
  globalThis.document = page.document;
  globalThis.window = page.window;
  globalThis.fetch = diskFetch;

  await import(pathToFileURL(path.join(ROOT, 'script.js')).href + '?view=map-tables');

  const app = page.element('app');
  const html = await waitFor(
    () => (app.innerHTML.includes('id="view-map"') ? app.innerHTML : null),
    'the map view'
  );

  // The model is rebuilt from the same files the page read, so the count is a
  // contract rather than a copy of whatever the view happened to print.
  const files = Object.fromEntries(
    await Promise.all(
      DATA_FILES.map(async (entry) => [entry.key, JSON.parse(await readFile(path.join(ROOT, entry.path), 'utf8'))])
    )
  );
  const model = buildPortfolioScene(files, { now: Date.parse('2026-11-02T09:15:00Z'), attention: [] });
  const count = (needle) => html.split(needle).length - 1;

  assert.match(html, /id="map-canvas"/, 'the canvas should be on the page');
  assert.match(html, /id="map-labels"/, 'the labels should have a layer to sit on');
  assert.match(html, /id="map-panel"/, 'the panel beside the canvas should be on the page');
  assert.equal(count('data-layer="'), model.layers.length, 'one switch per layer');
  assert.equal(count('<details class="map-fact">'), model.nodes.length, 'one fact sheet per object');
  assert.equal(count('<code>data/'), model.nodes.length, 'every row should name its file');

  // Nothing may be drawn that the tables under it cannot say in words.
  for (const line of model.missing) {
    assert.ok(html.includes(line.replace(/&/g, '&amp;').slice(0, 40)), `the map should say: ${line}`);
  }
});

test('an unknown route falls back to the overview rather than an empty page', async () => {
  const page = buildPage(VIEWS);
  page.window.location.hash = '#/does-not-exist';
  globalThis.document = page.document;
  globalThis.window = page.window;
  globalThis.fetch = diskFetch;

  await import(pathToFileURL(path.join(ROOT, 'script.js')).href + '?route=unknown');

  const app = page.element('app');
  const html = await waitFor(
    () => (app.innerHTML.includes('id="view-overview"') ? app.innerHTML : null),
    'the overview'
  );
  assert.ok(html.includes(MARKERS.overview));
});

test('a missing data file is reported, not drawn as zero', async () => {
  const page = buildPage(VIEWS);
  page.window.location.hash = '#/email';
  globalThis.document = page.document;
  globalThis.window = page.window;
  globalThis.fetch = async (input) => {
    if (String(input).includes('email.json')) return { ok: false, status: 404, json: async () => ({}) };
    return diskFetch(input);
  };

  await import(pathToFileURL(path.join(ROOT, 'script.js')).href + '?missing=email');

  const app = page.element('app');
  const html = await waitFor(
    () => (app.innerHTML.includes('id="view-email"') ? app.innerHTML : null),
    'the email view'
  );
  assert.ok(html.includes('data files did not load'), 'the page should say a file did not load');
  assert.ok(html.includes('data/email.json'), 'the page should name the file that failed');
  assert.ok(!html.includes('stopped while drawing itself'), 'a missing file should not stop the view');
});
