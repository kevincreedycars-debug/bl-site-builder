import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  PIPELINE_FLOW,
  PIPELINE_STATES,
  EXCEPTION_STATES,
  canTransition,
  isTerminal,
  isException,
  isOnPath,
  stateInfo,
  evaluatePiece,
  freshness,
  newestTimestamp,
  ageOf,
  fmtAge,
  fmtDuration,
  fmtDate,
  fmtDateTime,
  fmtNumber,
  fmtMoney,
  fmtPct,
  pct,
  deriveAttention,
  attentionCounts,
  pipelineBoard,
  summarise,
  citationMatrix,
  validateData,
  findSecretKeys,
  DATA_FILES
} from '../js/core.js';

const NOW = Date.parse('2026-11-02T09:15:00Z');
const read = (rel) => JSON.parse(fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
const data = Object.fromEntries(DATA_FILES.map((f) => [f.key, read(f.path)]));
const pieceById = (id) => data.content.pieces.find((p) => p.id === id);
const codes = (result) => result.problems.map((p) => p.code);

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

test('every state on the forward path is defined in the state table', () => {
  for (const state of PIPELINE_FLOW) {
    assert.ok(PIPELINE_STATES[state], `${state} has no entry in PIPELINE_STATES`);
    assert.ok(stateInfo(state).label);
    assert.ok(stateInfo(state).meaning);
  }
  assert.equal(PIPELINE_FLOW.length, 7);
  assert.equal(EXCEPTION_STATES.length, 5);
});

test('the forward path is walkable and nothing is skipped', () => {
  for (let i = 0; i < PIPELINE_FLOW.length - 1; i += 1) {
    const move = canTransition(PIPELINE_FLOW[i], PIPELINE_FLOW[i + 1]);
    assert.equal(move.ok, true, `${PIPELINE_FLOW[i]} should reach ${PIPELINE_FLOW[i + 1]}: ${move.reason}`);
  }
});

test('an edited piece cannot jump straight to published', () => {
  const move = canTransition('edited', 'published');
  assert.equal(move.ok, false);
  assert.match(move.reason, /approved/);
  assert.equal(canTransition('drafted', 'published').ok, false);
  assert.equal(canTransition('sourced', 'published').ok, false);
  assert.equal(canTransition('approved', 'published').ok, false, 'approved means ready, not published');
  assert.equal(canTransition('approved', 'publishing').ok, true);
  assert.equal(canTransition('publishing', 'published').ok, true);
});

test('a piece cannot stay put, and unknown states are refused both ways', () => {
  assert.equal(canTransition('drafted', 'drafted').ok, false);
  assert.equal(canTransition('nowhere', 'sourced').ok, false);
  assert.equal(canTransition('drafted', 'nowhere').ok, false);
});

test('published and abandoned are terminal', () => {
  assert.equal(isTerminal('published'), true);
  assert.equal(isTerminal('abandoned'), true);
  assert.equal(isTerminal('drafted'), false);
  assert.equal(
    canTransition('published', 'edited').ok,
    false,
    'a published piece is corrected by a new piece, not by moving this one back'
  );
});

test('exception states are off the path but not terminal', () => {
  for (const state of EXCEPTION_STATES) {
    assert.equal(isException(state), true);
    assert.equal(isOnPath(state), false, `${state} should not be on the forward path`);
    assert.ok(PIPELINE_STATES[state].meaning, `${state} has no plain-language meaning`);
  }
  assert.equal(isException('published'), false);
  assert.equal(isOnPath('published'), true);
  assert.equal(canTransition('blocked', 'drafted').ok, true, 'a cleared blocker returns to the work');
});

// ---------------------------------------------------------------------------
// Invariants per piece
// ---------------------------------------------------------------------------

test('a published piece with a ledger, a fetch and a hash passes its own checks', () => {
  const result = evaluatePiece(pieceById('c-1041'), { now: NOW });
  assert.equal(result.ok, true, `unexpected problems: ${codes(result).join(', ')}`);
  assert.deepEqual(result.problems, []);
});

test('an edited piece with unsourced claims is caught before approval', () => {
  const result = evaluatePiece(pieceById('c-1044'), { now: NOW });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('unsourced_claims'));
});

test('past editing with no ledger is refused', () => {
  const piece = { ...pieceById('c-1044'), ledger_id: null, claims_sourced: 17 };
  assert.ok(codes(evaluatePiece(piece, { now: NOW })).includes('missing_ledger'));
});

test('published without a hash or without a fetch is flagged', () => {
  const noHash = evaluatePiece({ ...pieceById('c-1041'), hash_sha256: null }, { now: NOW });
  assert.ok(codes(noHash).includes('published_without_hash'));

  const noFetch = evaluatePiece({ ...pieceById('c-1041'), live_url: null, verified_at: null }, { now: NOW });
  assert.ok(codes(noFetch).includes('published_without_fetch'));
});

test('each exception state carries the problem that put it there', () => {
  const expected = {
    'c-1043': 'unverified_publish',
    'c-1049': 'source_outside_window',
    'c-1051': 'blocked',
    'c-1052': 'draft_without_ledger'
  };
  for (const [id, code] of Object.entries(expected)) {
    const result = evaluatePiece(pieceById(id), { now: NOW });
    assert.ok(codes(result).includes(code), `${id} should report ${code}, got ${codes(result).join(', ')}`);
  }
});

test('a draft ages against the threshold, not against the wall clock', () => {
  const piece = pieceById('c-1046');
  assert.ok(codes(evaluatePiece(piece, { now: NOW })).includes('draft_ageing'));
  const earlier = Date.parse('2026-10-28T09:00:00Z');
  assert.ok(!codes(evaluatePiece(piece, { now: earlier })).includes('draft_ageing'));
  const relaxed = evaluatePiece(piece, { now: NOW, thresholds: { draft_ageing_days: 30 } });
  assert.ok(!codes(relaxed).includes('draft_ageing'));
});

test('an approved piece left too long is flagged, and an unknown state never passes', () => {
  const later = Date.parse('2026-11-04T09:15:00Z');
  assert.ok(codes(evaluatePiece(pieceById('c-1047'), { now: later })).includes('approval_waiting'));
  assert.ok(!codes(evaluatePiece(pieceById('c-1047'), { now: NOW })).includes('approval_waiting'));
  const odd = evaluatePiece({ ...pieceById('c-1047'), state: 'nearly-there' }, { now: NOW });
  assert.equal(odd.ok, false);
  assert.ok(codes(odd).includes('unknown_state'));
});

// ---------------------------------------------------------------------------
// Freshness and formatting
// ---------------------------------------------------------------------------

test('freshness bands are read from the age of the file', () => {
  const asOf = '2026-11-02T09:15:00Z';
  assert.equal(freshness(asOf, NOW).level, 'fresh');
  assert.equal(freshness(asOf, NOW + 12 * 3600000).level, 'aging');
  assert.equal(freshness(asOf, NOW + 40 * 3600000).level, 'stale');
  assert.equal(freshness(null, NOW).level, 'unknown');
  assert.equal(freshness('not a date', NOW).level, 'unknown');
  assert.equal(ageOf(null, NOW), null);
});

test('the newest timestamp is evidence, not a promise: a missing file adds nothing', () => {
  assert.equal(newestTimestamp(data), '2026-11-02T09:15:00Z');
  assert.equal(newestTimestamp({}), null);
  assert.equal(newestTimestamp({ content: { pieces: [] } }), null, 'a file with no _meta cannot date the page');
  const older = { content: { _meta: { as_of: '2026-10-01T00:00:00Z' } } };
  const newer = { email: { _meta: { as_of: '2026-11-01T00:00:00Z' } } };
  assert.equal(newestTimestamp({ content: older.content, email: newer.email }), '2026-11-01T00:00:00Z');
});

test('the same number reads the same way everywhere', () => {
  assert.equal(fmtDuration(39 * 3600000), '39h');
  assert.equal(fmtAge(39 * 3600000), '39h ago');
  assert.equal(fmtAge(null), 'never');
  assert.equal(fmtDate('2026-11-02T08:40:00Z'), '2 Nov 2026');
  assert.equal(fmtDateTime('2026-11-02T08:40:00Z'), '2 Nov 2026, 08:40 UTC');
  assert.equal(fmtNumber(1234), '1,234');
  assert.equal(fmtNumber(null), '—');
  assert.equal(fmtMoney(1234), '$1,234');
  assert.equal(fmtPct(7.4, 1), '7.4%');
  assert.equal(pct(1, 4), 25);
  assert.equal(pct(1, 0), null, 'a share of nothing is unknown, not zero');
});

  assert.equal(isException('published'), false);
  assert.equal(isOnPath('published'), true);
// ---------------------------------------------------------------------------
// Attention: the thing the page is actually for
// ---------------------------------------------------------------------------

const items = deriveAttention(data, { now: NOW });
const find = (predicate) => items.find(predicate);

test('attention is built from the files and every item can be acted on', () => {
  assert.ok(items.length > 0);
  for (const entry of items) {
    assert.ok(['high', 'medium', 'low'].includes(entry.severity), `bad severity ${entry.severity}`);
    assert.ok(entry.area, 'every item names an area');
    assert.ok(entry.title && entry.title.length > 8, `thin title: ${entry.title}`);
    assert.ok(entry.evidence, `no evidence for: ${entry.title}`);
    assert.ok(entry.action, `no next step for: ${entry.title}`);
    assert.ok(entry.view, `no view for: ${entry.title}`);
  }
});

test('the worst things come first', () => {
  const rank = { high: 0, medium: 1, low: 2 };
  for (let i = 1; i < items.length; i += 1) {
    assert.ok(
      rank[items[i - 1].severity] <= rank[items[i].severity],
      `${items[i - 1].severity} was listed before ${items[i].severity}`
    );
  }
  const counts = attentionCounts(items);
  assert.equal(counts.total, items.length);
  assert.equal(counts.high + counts.medium + counts.low, counts.total);
  assert.ok(counts.high > 0, 'the seed data is meant to contain real problems');
});

test('a sold link that returns 404 is a high item with the code that was seen', () => {
  const lost = find((i) => i.ref === 'b-1003');
  assert.ok(lost, 'b-1003 is 404 and must appear');
  assert.equal(lost.severity, 'high');
  assert.match(lost.evidence, /404/);
  assert.equal(lost.view, 'backlinks');
});

test('an unreachable site is reported once, with the failed check named', () => {
  const site = find((i) => i.view === 'sites' && i.ref === 'site-verdant');
  assert.ok(site);
  assert.equal(site.severity, 'high');
  assert.match(site.evidence, /401/);
});

test('a run that never wrote its record is treated as not having run', () => {
  const run = find((i) => i.ref === 'run-2026-10-31-a');
  assert.ok(run);
  assert.equal(run.severity, 'high');
  assert.match(run.evidence, /no completion record|not hav/i);
});

test('a failed and an unfinished run are reported differently', () => {
  const failed = find((i) => i.ref === 'run-2026-11-01-a');
  const partial = find((i) => i.ref === 'run-2026-11-01-b');
  assert.equal(failed.severity, 'high');
  assert.equal(partial.severity, 'medium');
  assert.match(partial.evidence, /unknown/);
});

test('the entity with no name, address or phone is the top EEAT item', () => {
  const nap = find((i) => i.area === 'EEAT' && i.ref === 'entity');
  assert.ok(nap);
  assert.equal(nap.severity, 'high');
  assert.match(nap.title, /details/i);
});

test('a worker that has gone quiet is described as a last report, not as online', () => {
  const quiet = find((i) => i.ref === 'reviewer');
  assert.ok(quiet);
  assert.match(quiet.evidence, /window/i, 'the wording must not imply the window is open');
});

test('the run button being off is stated plainly and ranked low', () => {
  const control = find((i) => i.view === 'runs' && i.ref === 'control');
  assert.ok(control);
  assert.equal(control.severity, 'low');
});

test('thresholds come from the files, and can be tightened or relaxed', () => {
  assert.ok(find((i) => i.ref === 'b-1005'), 'a 43 day old check is past the 30 day recheck');
  const relaxed = deriveAttention(data, { now: NOW, thresholds: { recheck_days: 60 } });
  assert.ok(!relaxed.some((i) => i.ref === 'b-1005'), 'with a 60 day window it is no longer due');
});

test('an empty workspace reports every missing file, and does not invent problems from them', () => {
  const missing = deriveAttention({}, { now: NOW });
  assert.equal(missing.length, 7, 'one item per file that should have been there');
  for (const entry of missing) {
    assert.equal(entry.severity, 'high');
    assert.equal(entry.area, 'Data');
    assert.match(entry.title, /did not load/);
  }
  assert.ok(missing.some((i) => i.ref === 'runs'));
});

test('a missing file is reported rather than silently skipped', () => {
  const partial = { ...data };
  delete partial.runs;
  const found = validateData(partial);
  assert.equal(found.ok, false);
  assert.ok(found.errors.some((e) => /data\/runs\.json/.test(e.file)), 'the missing file must be named');
});

// ---------------------------------------------------------------------------
// Board, numbers and matrix
// ---------------------------------------------------------------------------

test('every piece sits in exactly one column', () => {
  const board = pipelineBoard(data.content.pieces);
  const placed = [...board.columns, ...board.exceptions].reduce((n, col) => n + col.items.length, 0);
  assert.equal(placed, data.content.pieces.length);
  assert.equal(board.columns.length, PIPELINE_FLOW.length);
  assert.equal(board.exceptions.length, EXCEPTION_STATES.length);

  const published = board.columns.find((c) => c.state === 'published');
  assert.equal(published.items.length, 4);
  const unverified = board.exceptions.find((c) => c.state === 'publish_unverified');
  assert.equal(unverified.items.length, 1);
});

test('the summary counts rows, and nothing else', () => {
  const s = summarise(data, { now: NOW });
  assert.equal(s.sites.total, 5);
  assert.equal(s.sites.connected, 3);
  assert.equal(s.sites.problems, 2);
  assert.equal(s.content.total, data.content.pieces.length);
  assert.equal(s.content.published, 4);
  assert.equal(s.content.published30d, 4);
  assert.equal(s.content.claimsSourced, 144);
  assert.equal(s.content.claimsTotal, 159);
  assert.equal(s.links.total, 12);
  assert.equal(s.links.live, 6);
  assert.equal(s.links.lost + s.links.placedUnverified + s.links.listed + s.links.expired + s.links.live, s.links.total);
  assert.equal(s.email.mailboxes, 8);
  assert.equal(s.email.risky, 1);
  assert.equal(s.eeat.verified, 11);
  assert.equal(s.eeat.total, 25);
  assert.equal(s.harness.workers, 6);
  assert.equal(s.harness.lastRun.id, 'run-2026-11-02-b', 'the newest run is the one started at 08:40');
});

test('the citation matrix has one row per site and one cell per source', () => {
  const matrix = citationMatrix(data.eeat, data.sites.sites);
  assert.equal(matrix.rows.length, data.sites.sites.length);
  assert.equal(matrix.sources.length, 6);
  for (const row of matrix.rows) {
    assert.equal(row.cells.length, matrix.sources.length);
    assert.equal(row.verified, row.cells.filter((c) => c.state === 'verified').length);
  }
  const summit = matrix.rows.find((r) => r.site.id === 'site-summit');
  assert.equal(summit.verified, 5);
  const verdant = matrix.rows.find((r) => r.site.id === 'site-verdant');
  assert.equal(verdant.verified, 0);
  assert.ok(verdant.cells.some((c) => c.state === 'mismatch'));
});

// ---------------------------------------------------------------------------
// Validation of the inputs themselves
// ---------------------------------------------------------------------------

const clone = () => JSON.parse(JSON.stringify(data));

test('the seed files pass their own validation', () => {
  const report = validateData(data);
  assert.equal(report.ok, true, `unexpected: ${report.errors.map((e) => `${e.file} ${e.path}`).join('; ')}`);
  assert.deepEqual(report.errors, []);
});

test('a published piece with no hash is refused by validation', () => {
  const broken = clone();
  broken.content.pieces[0].hash_sha256 = null;
  const report = validateData(broken);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((e) => /hash_sha256/.test(e.path)));
});

test('an unknown state, an unknown site and a duplicate id are all refused', () => {
  const broken = clone();
  broken.content.pieces[0].state = 'nearly-live';
  broken.content.pieces[1].site_id = 'site-atlantis';
  broken.content.pieces.push({ ...broken.content.pieces[2] });
  const report = validateData(broken);
  assert.equal(report.ok, false);
  const paths = report.errors.map((e) => e.path);
  const messages = report.errors.map((e) => e.message).join(' | ');
  assert.ok(paths.some((p) => /state/.test(p)), 'the bad state must be located');
  assert.match(messages, /site-atlantis/, 'the unknown site must be named');
  assert.ok(report.errors.some((e) => /duplicate id/.test(e.message)));
});

test('a control file with a non-boolean switch or a missing endpoint is refused', () => {
  const broken = clone();
  broken.control.refresh_enabled = 'yes';
  broken.control.webhook_url = '';
  const report = validateData(broken);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((e) => e.path === 'refresh_enabled'));
  assert.ok(report.errors.some((e) => e.path === 'webhook_url'));
});

test('a mailbox spending above its own cap is refused', () => {
  const broken = clone();
  broken.email.mailboxes[0].daily_cap = 1;
  const report = validateData(broken);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((e) => /sent_7d/.test(e.path)));
});

test('nothing in the data looks like a credential', () => {
  for (const f of DATA_FILES) {
    assert.deepEqual(findSecretKeys(data[f.key]), [], `${f.path} contains something key-like`);
  }
  assert.deepEqual(findSecretKeys({ api_key: 'x' }), ['api_key']);
  assert.deepEqual(findSecretKeys({ nested: { access_token: 'x' } }), ['nested.access_token']);
  assert.deepEqual(findSecretKeys({ tokenish: 'a value, not a key name' }), []);
});

