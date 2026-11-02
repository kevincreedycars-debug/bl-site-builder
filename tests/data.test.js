import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { findSecretKeys } from '../js/core.js';

const DIR = new URL('../data/', import.meta.url);
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const raw = Object.fromEntries(FILES.map((f) => [f, fs.readFileSync(new URL(f, DIR), 'utf8')]));
const data = Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));

function walk(node, at = '', out = []) {
  if (typeof node === 'string') out.push({ at, value: node });
  else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${at}[${i}]`, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, at ? `${at}.${k}` : k, out);
  }
  return out;
}

const stringsOf = (file) => walk(data[file], file);

test('every data file is present and parses', () => {
  assert.ok(FILES.length >= 10, `expected the full set of files, found ${FILES.length}`);
  for (const file of FILES) {
    assert.doesNotThrow(() => JSON.parse(raw[file]), `${file} is not valid JSON`);
  }
  for (const expected of ['workspace.json', 'sites.json', 'content.json', 'backlinks.json', 'email.json', 'eeat.json']) {
    assert.ok(FILES.includes(expected), `${expected} is missing`);
  }
});

test('every file says when it was written and where it came from', () => {
  for (const file of FILES) {
    const meta = data[file]._meta;
    assert.ok(meta, `${file} has no _meta`);
    assert.ok(meta.as_of, `${file} has no _meta.as_of`);
    assert.ok(!Number.isNaN(Date.parse(meta.as_of)), `${file} _meta.as_of is not a date: ${meta.as_of}`);
    assert.match(meta.as_of, /Z$/, `${file} _meta.as_of should be UTC`);
    assert.equal(meta.source, 'seed', `${file} should declare itself as seed until real data replaces it`);
    assert.ok(meta.produced_by, `${file} does not name what produced it`);
  }
});

test('files are written with LF endings and a final newline', () => {
  for (const file of FILES) {
    assert.ok(!raw[file].includes('\r'), `${file} contains CRLF`);
    assert.ok(raw[file].endsWith('\n'), `${file} has no trailing newline`);
  }
});

test('every reference points at something that exists', () => {
  const siteIds = new Set(data['sites.json'].sites.map((s) => s.id));
  const sourceIds = new Set(data['eeat.json'].sources.map((s) => s.id));
  const domainIds = new Set(data['email.json'].domains.map((d) => d.id));
  const mailboxIds = new Set(data['email.json'].mailboxes.map((m) => m.id));

  for (const piece of data['content.json'].pieces) {
    assert.ok(siteIds.has(piece.site_id), `piece ${piece.id} points at unknown site ${piece.site_id}`);
  }
  for (const placement of data['backlinks.json'].placements) {
    assert.ok(siteIds.has(placement.seller_site_id), `placement ${placement.id} points at unknown site`);
  }
  for (const entry of data['eeat.json'].entries) {
    assert.ok(siteIds.has(entry.site_id), `citation row points at unknown site ${entry.site_id}`);
    assert.ok(sourceIds.has(entry.source_id), `citation row points at unknown source ${entry.source_id}`);
  }
  for (const author of data['eeat.json'].authors) {
    for (const id of author.site_ids) assert.ok(siteIds.has(id), `author ${author.id} claims unknown site ${id}`);
  }
  for (const mailbox of data['email.json'].mailboxes) {
    assert.ok(domainIds.has(mailbox.domain_id), `mailbox ${mailbox.id} sits on unknown domain`);
  }
  for (const campaign of data['email.json'].campaigns) {
    for (const id of campaign.mailbox_ids) assert.ok(mailboxIds.has(id), `campaign ${campaign.id} uses unknown mailbox ${id}`);
  }
});

test('the status file describes a run that exists', () => {
  const runIds = new Set(data['runs.json'].runs.map((r) => r.id));
  const status = data['workflow-status.json'];
  assert.ok(runIds.has(status.run_id), `${status.run_id} is not in the run log`);
  const run = data['runs.json'].runs.find((r) => r.id === status.run_id);
  assert.equal(run.kind, status.kind, 'the status file and the run log disagree about the kind');
  assert.equal(run.started, status.started_at, 'the status file and the run log disagree about the start');
  for (const worker of data['workers.json'].workers) {
    if (!worker.last_submission) continue;
    assert.ok(!Number.isNaN(Date.parse(worker.last_submission)), `worker ${worker.id} has an unreadable submission time`);
    assert.ok(
      Date.parse(worker.last_submission) <= Date.parse(data['workers.json']._meta.as_of),
      `worker ${worker.id} reports a submission after the file was written`
    );
  }
});

test('nothing in the data is stamped later than the file it sits in', () => {
  const asOf = (file) => Date.parse(data[file]._meta.as_of);
  const stamps = [
    ['content.json', (f) => f.pieces.flatMap((p) => [p.created, p.updated, p.published_at, p.verified_at])],
    ['backlinks.json', (f) => f.placements.flatMap((p) => [p.placed_at, p.verified_at])],
    ['eeat.json', (f) => f.entries.map((e) => e.verified_at)],
    ['runs.json', (f) => f.runs.flatMap((r) => [r.started, r.finished])]
  ];
  for (const [file, pick] of stamps) {
    for (const value of pick(data[file])) {
      if (!value) continue;
      assert.ok(!Number.isNaN(Date.parse(value)), `${file} has an unreadable timestamp: ${value}`);
      assert.ok(Date.parse(value) <= asOf(file), `${file} contains ${value}, which is after its own as_of`);
    }
  }
});

test('every address and every link sits on a domain kept for examples', () => {
  const allowed = new Set(data['eeat.json'].sources.map((s) => new URL(s.url).hostname));
  const notes = [];
  for (const file of FILES) {
    for (const { at, value } of stringsOf(file)) {
      for (const url of value.match(/https?:\/\/[^\s"'<>)]+/g) || []) {
        let host;
        try {
          host = new URL(url).hostname;
        } catch {
          notes.push(`${file} ${at} has an unreadable url: ${url}`);
          continue;
        }
        if (!host.endsWith('.example') && !allowed.has(host)) notes.push(`${file} ${at} points at ${host}`);
      }
      for (const address of value.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || []) {
        if (!address.toLowerCase().endsWith('.example')) notes.push(`${file} ${at} contains a real address: ${address}`);
      }
    }
  }
  for (const site of data['sites.json'].sites) {
    if (!site.domain.endsWith('.example')) notes.push(`site ${site.id} is on ${site.domain}`);
  }
  assert.deepEqual(notes, []);
});

test('no file carries anything shaped like a credential', () => {
  for (const file of FILES) {
    assert.deepEqual(findSecretKeys(data[file]), [], `${file} has a key-shaped field`);
  }
});

test('every id is unique within its own collection', () => {
  const collections = [
    ['sites.json', data['sites.json'].sites],
    ['content.json', data['content.json'].pieces],
    ['backlinks.json', data['backlinks.json'].placements],
    ['email.json', data['email.json'].domains],
    ['email.json', data['email.json'].mailboxes],
    ['email.json', data['email.json'].campaigns],
    ['eeat.json', data['eeat.json'].sources],
    ['eeat.json', data['eeat.json'].authors],
    ['workers.json', data['workers.json'].workers],
    ['runs.json', data['runs.json'].runs]
  ];
  for (const [file, rows] of collections) {
    const ids = rows.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, `${file} has duplicate ids`);
    assert.ok(ids.every(Boolean), `${file} has a row with no id`);
  }
});
