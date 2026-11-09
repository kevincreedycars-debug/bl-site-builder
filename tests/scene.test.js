import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { DATA_FILES, deriveAttention, nodeTone } from '../js/core.js';
import { MAP_LAYERS, MAP_LAYOUT, buildPortfolioScene, describeScene } from '../js/scene.js';

const NOW = Date.parse('2026-11-02T09:15:00Z');
const read = (rel) => JSON.parse(fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
const data = Object.fromEntries(DATA_FILES.map((f) => [f.key, read(f.path)]));
const attention = deriveAttention(data, { now: NOW });
const scene = buildPortfolioScene(data, { now: NOW, attention });

const TONES = ['ok', 'low', 'medium', 'high', 'muted', 'accent', 'unknown'];
const byId = (model, id) => model.nodes.find((node) => node.id === id);
const fact = (node, label) => (node.facts.find((entry) => entry.label === label) || {}).value;

// The smallest fixture the map will draw: two sites, one source, nothing else.
const thin = () => ({
  sites: {
    sites: [
      { id: 's1', name: 'One', domain: 'one.example', status: 'connected' },
      { id: 's2', name: 'Two', domain: 'two.example', status: 'connected' }
    ]
  },
  eeat: {
    sources: [{ id: 'g', name: 'Google', requires: 'a listing' }],
    entries: [
      { site_id: 's1', source_id: 'g', state: 'verified', url: 'https://g.example/one', verified_at: '2026-10-01T00:00:00Z' }
    ]
  }
});

test('the map has one object for every row the files hold', () => {
  const siteRows = data.sites.sites;
  const sourceRows = data.eeat.sources;
  const sellers = new Set(siteRows.map((site) => site.id));
  const drawable = data.backlinks.placements.filter((placement) => sellers.has(placement.seller_site_id));

  assert.equal(scene.counts.sites, siteRows.length);
  assert.equal(scene.counts.citations, siteRows.length * sourceRows.length, 'one tick per site and source, even when the cell is empty');
  assert.equal(scene.counts.links, drawable.length, 'only placements whose seller is a known site are drawn');
  assert.equal(scene.counts.domains, data.email.domains.length);
  assert.equal(scene.counts.mailboxes, data.email.mailboxes.length);
  assert.equal(scene.counts.workers, data.workers.workers.length);

  const expected =
    scene.counts.sites +
    scene.counts.citations +
    scene.counts.links +
    scene.counts.domains +
    scene.counts.mailboxes +
    scene.counts.workers +
    1; // the hub
  assert.equal(scene.nodes.length, expected);
});

test('every object names the file it came from, and no fact is a hole', () => {
  const files = new Set(DATA_FILES.map((entry) => entry.path));
  const ids = new Set();

  for (const node of scene.nodes) {
    assert.ok(!ids.has(node.id), `${node.id} is drawn twice`);
    ids.add(node.id);

    assert.ok(files.has(node.source), `${node.id} says it came from "${node.source}", which is not one of the files`);
    for (const key of ['id', 'kind', 'layer', 'label', 'sublabel', 'tone', 'source']) {
      assert.equal(typeof node[key], 'string', `${node.id}.${key} should be a string`);
      assert.doesNotMatch(node[key], /undefined|NaN|\[object Object\]/, `${node.id}.${key} says "${node[key]}"`);
    }
    assert.ok(TONES.includes(node.tone), `${node.id} is painted "${node.tone}", which is not one of the tones`);
    assert.ok(node.facts.length > 0, `${node.id} carries no facts`);

    for (const entry of node.facts) {
      assert.ok(entry.label, `${node.id} has a fact with no label`);
      assert.equal(typeof entry.value, 'string', `${node.id} · ${entry.label} is not a string`);
      assert.doesNotMatch(entry.value, /undefined|NaN|\[object Object\]/, `${node.id} · ${entry.label} says "${entry.value}"`);
    }

    for (const axis of ['x', 'y', 'z']) {
      assert.ok(Number.isFinite(node.position[axis]), `${node.id}.position.${axis} is not a number`);
    }
    assert.ok(Number.isFinite(node.radius) && node.radius > 0, `${node.id} has no size`);
  }
});

test('a number the file does not carry says so, and is never drawn as zero', () => {
  const model = buildPortfolioScene(thin(), { now: NOW });
  const site = byId(model, 'site:s1');

  assert.equal(fact(site, 'Pages published'), 'not recorded');
  assert.equal(fact(site, 'Authority'), 'not recorded');
  assert.equal(fact(site, 'REST latency'), 'not recorded');
  assert.equal(site.radius, 0.55, 'no page count means the smallest sphere, not a sphere of no size');
  assert.ok(
    !site.facts.some((entry) => /^(0|0\.0+)$/.test(entry.value)),
    'a missing number must not be written as 0'
  );
});

test('a file that did not load is named, and its facts are not filled in with zero', () => {
  const model = buildPortfolioScene({ sites: thin().sites }, { now: NOW });

  for (const key of ['workspace', 'content', 'backlinks', 'email', 'eeat', 'workers']) {
    const path = DATA_FILES.find((entry) => entry.key === key).path;
    assert.ok(model.missing.some((line) => line.includes(path)), `${path} did not load, so the map should say so`);
  }
  assert.equal(fact(byId(model, 'hub:studio'), 'Modules'), 'not recorded');
  assert.equal(fact(byId(model, 'site:s1'), 'Rows in the content file'), 'not recorded');
  assert.equal(fact(byId(model, 'site:s1'), 'Citations'), 'no sources loaded');
});

test('a state js/core.js has no tone for is drawn as unknown rather than guessed', () => {
  const model = buildPortfolioScene(
    { sites: { sites: [{ id: 's1', name: 'One', domain: 'one.example', status: 'something-new' }] } },
    { now: NOW }
  );
  const site = byId(model, 'site:s1');
  assert.equal(site.tone, 'unknown');
  assert.notEqual(nodeTone('site', 'something-new'), 'ok');
});

test('height is citation coverage, and a site with none sits lower than one with all', () => {
  const model = buildPortfolioScene(thin(), { now: NOW });
  const full = byId(model, 'site:s1');
  const none = byId(model, 'site:s2');

  assert.ok(full.position.y > none.position.y, 'the covered site should sit above the uncovered one');
  assert.equal(fact(full, 'Citations'), '1 of 1 verified');
  assert.equal(fact(none, 'Citations'), '0 of 1 verified');
});

test('only a high-severity item pulses, and a passing citation check does not', () => {
  const model = buildPortfolioScene(thin(), {
    now: NOW,
    attention: [
      { ref: 's1', severity: 'medium', area: 'eeat', title: 'A listing drifted', detail: 'd', next: 'n' },
      { ref: 's1', severity: 'high', area: 'eeat', title: 'A listing is gone', detail: 'd', next: 'n' },
      { ref: 's2', severity: 'low', area: 'eeat', title: 'A listing is thin', detail: 'd', next: 'n' }
    ]
  });

  const site = byId(model, 'site:s1');
  assert.equal(site.severity, 'high', 'the worst item wins');
  assert.equal(site.attention.length, 2, 'both items are kept for the panel');
  assert.equal(site.pulse, true);

  const verified = byId(model, 'cite:s1:g');
  assert.equal(verified.severity, 'high', 'the tick carries its site\'s item, so the panel can say it');
  assert.equal(verified.pulse, false, 'a passing check is not news, so it does not throb');

  assert.equal(byId(model, 'site:s2').pulse, false, 'a low item is not a pulse');
  assert.equal(byId(model, 'cite:s2:g').pulse, false);
  assert.equal(byId(model, 'hub:studio').pulse, false, 'the hub answers to no ref, so nothing lands on it');
});

test('every connector joins two objects that exist, and none is drawn twice', () => {
  const ids = new Set(scene.nodes.map((node) => node.id));
  const seen = new Set();

  for (const edge of scene.edges) {
    assert.ok(ids.has(edge.from), `${edge.id} starts at nothing`);
    assert.ok(ids.has(edge.to), `${edge.id} ends at nothing`);
    assert.ok(!seen.has(edge.id), `${edge.id} is drawn twice`);
    seen.add(edge.id);
  }
  assert.equal(scene.edges.length, scene.counts.edges);
  assert.ok(scene.edges.some((edge) => edge.kind === 'owns'), 'sites should hang off the hub');
});

test('each switch on the toolbar counts what it actually draws', () => {
  const inLayer = (id) => scene.nodes.filter((node) => node.layer === id).length;

  for (const layer of scene.layers) {
    assert.ok(MAP_LAYERS.some((entry) => entry.id === layer.id), `${layer.id} is not a layer the toolbar knows`);
    assert.equal(typeof layer.note, 'string');
    if (layer.id === 'edges') assert.equal(layer.count, scene.edges.length);
    else if (layer.id === 'email') assert.equal(layer.count, scene.counts.domains + scene.counts.mailboxes);
    else assert.equal(layer.count, inLayer(layer.id), `${layer.id} says ${layer.count}, draws ${inLayer(layer.id)}`);
  }

  for (const node of scene.nodes) {
    assert.ok(
      node.layer === 'hub' || MAP_LAYERS.some((layer) => layer.id === node.layer),
      `${node.id} belongs to "${node.layer}", which cannot be switched off or on`
    );
  }
});

test('distance from the centre is layout, and the legend says so', () => {
  const distance = (node) => Math.hypot(node.position.x, node.position.z);
  for (const node of scene.nodes.filter((entry) => entry.kind === 'site')) {
    assert.ok(Math.abs(distance(node) - MAP_LAYOUT.siteRing) < 0.01, `${node.id} should sit on the site ring`);
  }

  const explained = scene.encoding.find((entry) => entry.mark === 'Distance');
  assert.equal(explained.means, 'layout only');
  for (const mark of ['Size', 'Height', 'Colour', 'Pulse']) {
    assert.ok(scene.encoding.some((entry) => entry.mark === mark), `${mark} should be written down in the legend`);
  }
  assert.ok(scene.encoding.every((entry) => entry.detail.length > 20), 'every mark explains itself in a sentence');
});

test('a placement naming a site nobody has heard of is reported, not drawn', () => {
  const model = buildPortfolioScene(
    {
      sites: { sites: [{ id: 's1', name: 'One', domain: 'one.example', status: 'connected' }] },
      backlinks: {
        placements: [
          { id: 'p1', seller_site_id: 's1', anchor: 'anchor one', state: 'placed', price: 250 },
          { id: 'p2', seller_site_id: 'ghost', anchor: 'anchor two', state: 'placed', price: 250 }
        ]
      }
    },
    { now: NOW }
  );

  assert.ok(byId(model, 'link:p1'), 'a placement on a known site is drawn');
  assert.equal(byId(model, 'link:p2'), undefined, 'a placement on a site nobody has heard of is not drawn');
  assert.ok(model.missing.some((line) => line.includes('ghost')), 'and the reason is said out loud');
});

test('a price is size, so a placement without one is not given a made-up price', () => {
  const model = buildPortfolioScene(
    {
      sites: { sites: [{ id: 's1', name: 'One', domain: 'one.example', status: 'connected' }] },
      backlinks: {
        placements: [
          { id: 'paid', seller_site_id: 's1', anchor: 'paid', state: 'placed', price: 600 },
          { id: 'unpriced', seller_site_id: 's1', anchor: 'unpriced', state: 'placed' }
        ]
      }
    },
    { now: NOW }
  );

  assert.ok(byId(model, 'link:paid').radius > byId(model, 'link:unpriced').radius);
  assert.equal(fact(byId(model, 'link:unpriced'), 'Price'), 'not recorded');
});

test('the same files and the same clock give the same picture', () => {
  const again = buildPortfolioScene(data, { now: NOW, attention });

  assert.deepEqual(again.nodes.map((node) => node.id), scene.nodes.map((node) => node.id));
  assert.deepEqual(again.nodes.map((node) => node.position), scene.nodes.map((node) => node.position));
  assert.deepEqual(again.counts, scene.counts);
  assert.deepEqual(again.missing, scene.missing);
});

test('the picture can be read out loud, for a reader who has no canvas', () => {
  const said = describeScene(scene);

  assert.match(said, /\d+ sites, \d+ links, \d+ citation cells/);
  for (const value of [scene.counts.sites, scene.counts.links, scene.counts.mailboxes, scene.counts.workers]) {
    assert.ok(said.includes(String(value)), `"${said}" should mention ${value}`);
  }
  assert.match(said, /joined by \d+ connectors\.$/);
  assert.equal(describeScene(null), 'The map has not been built.');
});
