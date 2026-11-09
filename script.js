// script.js
// The page. It reads the files in data/, asks js/core.js what they mean, and
// draws the answer. It holds no state of its own beyond what it just read: a
// reload always shows the files as they are now.
//
// Rules kept here:
//   1. Every value is escaped before it reaches the page.
//   2. A file that failed to load is shown as a failure, never as empty.
//   3. Nothing is fetched except the data files themselves.

import {
  DATA_FILES,
  EXCEPTION_STATES,
  PIPELINE_FLOW,
  SEVERITY_LABEL,
  ageOf,
  attentionCounts,
  citationMatrix,
  deriveAttention,
  evaluatePiece,
  fmtAge,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtMoney,
  fmtNumber,
  fmtPct,
  freshness,
  newestTimestamp,
  pct,
  pipelineBoard,
  stateInfo,
  summarise,
  validateData
} from './js/core.js';
import { buildPortfolioScene, describeScene } from './js/scene.js';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const esc = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

const sevClass = (severity) => `pill pill-sev-${severity}`;

function sevPill(severity) {
  return `<span class="${sevClass(severity)}">${esc(SEVERITY_LABEL[severity] || severity)}</span>`;
}

function chip(level, text) {
  return `<span class="chip chip-${esc(level)}">${esc(text)}</span>`;
}

function bar(value, cls = '') {
  const safe = isNum(value) ? Math.max(0, Math.min(1, value)) : 0;
  return `<div class="bar ${cls}" style="--value:${safe.toFixed(3)}"><span></span></div>`;
}

function meter(text, value, cls = '') {
  return `<div class="meter"><span>${text}</span>${bar(value, cls)}</div>`;
}

function table({ caption, head, rows, cls = '' }) {
  if (!rows.length) {
    return `<p class="empty">${esc(caption || 'Nothing in this file')}: no rows.</p>`;
  }
  const headHtml = head
    .map((h) => {
      const label = typeof h === 'string' ? h : h.label;
      const num = typeof h === 'object' && h.num ? ' class="num"' : '';
      return `<th scope="col"${num}>${esc(label)}</th>`;
    })
    .join('');
  const bodyHtml = rows
    .map((row) => {
      const cells = row.cells
        .map((cell) => {
          const c = typeof cell === 'string' ? { t: cell } : cell;
          const parts = [];
          if (c.num) parts.push('num');
          if (c.wrap) parts.push('wrap');
          if (c.cls) parts.push(c.cls);
          const attr = parts.length ? ` class="${parts.join(' ')}"` : '';
          return `<td${attr}>${c.t}</td>`;
        })
        .join('');
      return `<tr${row.cls ? ` class="${row.cls}"` : ''}${row.id ? ` id="${esc(row.id)}"` : ''}>${cells}</tr>`;
    })
    .join('');
  const cap = caption ? `<caption>${esc(caption)}</caption>` : '';
  return `<div class="table-wrap"><table${cls ? ` class="${cls}"` : ''}>${cap}<thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function notice(level, title, body) {
  return `<div class="notice notice-${level}"><h3>${esc(title)}</h3>${body}</div>`;
}

function section(id, title, note, body) {
  return `<section class="section" id="${esc(id)}">
    <div class="section-head"><h2>${esc(title)}</h2>${note ? `<p>${esc(note)}</p>` : ''}</div>
    ${body}
  </section>`;
}

function kpi(label, value, note, tone = '') {
  return `<div class="card kpi${tone ? ` is-${tone}` : ''}">
    <span class="kpi-label">${esc(label)}</span>
    <strong class="kpi-value">${esc(value)}</strong>
    <span class="kpi-note">${esc(note)}</span>
  </div>`;
}

function notSet(value, fallback = 'not set') {
  return value === null || value === undefined || value === '' ? `<span class="sub">${esc(fallback)}</span>` : esc(value);
}


// ---------------------------------------------------------------------------
// Reading the files
// ---------------------------------------------------------------------------

const state = {
  now: Date.now(),
  data: {},
  failed: [],
  view: 'overview',
  focus: null,
  validation: { ok: true, errors: [] },
  attention: [],
  counts: { total: 0, high: 0, medium: 0, low: 0 },
  summary: null
};

async function readFile({ key, path }) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) return { key, path, error: `HTTP ${response.status}` };
    return { key, path, json: await response.json() };
  } catch (error) {
    return { key, path, error: error && error.message ? error.message : 'could not be read' };
  }
}

async function loadAll() {
  const results = await Promise.all(DATA_FILES.map(readFile));
  const data = {};
  const failed = [];
  for (const result of results) {
    if (result.error) failed.push({ key: result.key, path: result.path, why: result.error });
    else data[result.key] = result.json;
  }
  state.data = data;
  state.failed = failed;
  state.now = Date.now();

  let validation = { ok: true, errors: [] };
  try {
    validation = validateData(data);
  } catch (error) {
    validation = {
      ok: false,
      errors: [{ file: 'data/', path: '', message: `validation itself failed: ${error.message}` }]
    };
  }
  state.validation = validation;
  state.attention = deriveAttention(data, { now: state.now });
  state.counts = attentionCounts(state.attention);
  state.summary = summarise(data, { now: state.now });
}

// ---------------------------------------------------------------------------
// Header and footer, which describe the files rather than the business
// ---------------------------------------------------------------------------

function paintShell() {
  const workspace = (state.data.workspace && state.data.workspace.workspace) || {};
  const name = workspace.name || 'Portfolio dashboard';
  document.title = `${name} — operations dashboard`;
  const nameEl = document.getElementById('workspace-name');
  const tagEl = document.getElementById('workspace-tagline');
  if (nameEl) nameEl.textContent = name;
  if (tagEl) {
    tagEl.textContent = workspace.tagline || 'Site portfolio, content pipeline and link inventory';
  }

  const ageEl = document.getElementById('data-age');
  const totalEl = document.getElementById('attention-total');
  const asOf = newestTimestamp(state.data);

  if (ageEl) {
    if (!asOf) {
      ageEl.className = 'chip chip-unknown';
      ageEl.textContent = 'No file carries a timestamp';
    } else {
      const band = freshness(asOf, state.now);
      ageEl.className = `chip chip-${band.level}`;
      ageEl.textContent = `Files ${band.label} · ${fmtDateTime(asOf)}`;
      ageEl.title = `Newest _meta.as_of across the data files is ${fmtDateTime(asOf)}, ${fmtAge(ageOf(asOf, state.now))}.`;
    }
  }

  if (totalEl) {
    totalEl.className = `chip chip-${state.counts.high ? 'high' : state.counts.total ? 'medium' : 'fresh'}`;
    totalEl.textContent = state.counts.total
      ? `${state.counts.total} need attention · ${state.counts.high} now`
      : 'Nothing is asking for a person';
  }

  const footer = document.getElementById('footer-sources');
  if (footer) {
    const bits = DATA_FILES.map(({ key, path }) => {
      const failed = state.failed.find((f) => f.key === key);
      if (failed) return `${path} failed (${failed.why})`;
      const meta = state.data[key] && state.data[key]._meta;
      return `${path} written ${meta && meta.as_of ? fmtDateTime(meta.as_of) : 'without a timestamp'}`;
    });
    footer.textContent = `Files read: ${bits.join(' · ')}`;
  }
}

function loadNotices() {
  const out = [];
  if (state.failed.length) {
    out.push(
      notice(
        'high',
        `${state.failed.length} of ${DATA_FILES.length} data files did not load`,
        `<p>Anything that would have come from them is missing from this page. That is not the same as being empty.</p>
         <ul>${state.failed.map((f) => `<li><code>${esc(f.path)}</code> — ${esc(f.why)}</li>`).join('')}</ul>`
      )
    );
  }
  const errors = state.validation.errors || [];
  if (errors.length) {
    const shown = errors.slice(0, 12);
    out.push(
      notice(
        'medium',
        `${errors.length} problem${errors.length === 1 ? '' : 's'} in the data files`,
        `<p>The page still shows what it read, but these rows fail their own checks. They are fixed at the file, not here.</p>
         <ul>${shown
           .map((e) => `<li><code>${esc(e.file)}</code> <code>${esc(e.path || '(file)')}</code> — ${esc(e.message)}</li>`)
           .join('')}</ul>
         ${errors.length > shown.length ? `<p>${errors.length - shown.length} more not shown.</p>` : ''}`
      )
    );
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const VIEWS = ['overview', 'map', 'sites', 'content', 'backlinks', 'email', 'eeat', 'runs', 'harness'];

function viewLink(entry) {
  const target = VIEWS.includes(entry.view) ? entry.view : 'overview';
  const focus = entry.ref ? `?focus=${encodeURIComponent(entry.ref)}` : '';
  return `#/${target}${focus}`;
}

function attentionList(items, emptyText = 'Nothing in the files is asking for a person.') {
  if (!items.length) return `<p class="empty">${esc(emptyText)}</p>`;
  const rows = items
    .map((entry) => {
      const ref = entry.ref ? `<span class="mono">${esc(entry.ref)}</span>` : '';
      const evidence = entry.evidence ? `<span class="why">${esc(entry.evidence)}</span>` : '';
      const action = entry.action ? `<span class="do">${esc(entry.action)}</span>` : '';
      return `<li class="sev-${esc(entry.severity)}">
        <span class="who">${sevPill(entry.severity)}<span>${esc(entry.area)}</span>${ref}
          <a href="${viewLink(entry)}">open</a></span>
        <span class="title">${esc(entry.title)}</span>
        ${evidence}
        ${action}
      </li>`;
    })
    .join('');
  return `<ul class="attention">${rows}</ul>`;
}

function severityGroups(items) {
  return ['high', 'medium', 'low']
    .map((severity) => ({ severity, items: items.filter((i) => i.severity === severity) }))
    .filter((group) => group.items.length);
}

function attentionBySeverity(items) {
  return severityGroups(items)
    .map((group) =>
      section(
        `attention-${group.severity}`,
        `${SEVERITY_LABEL[group.severity]} — ${group.items.length}`,
        group.severity === 'high'
          ? 'Something a person has to do today.'
          : group.severity === 'medium'
            ? 'Something that becomes a real problem if the week passes.'
            : 'Worth knowing. No action yet.',
        attentionList(group.items)
      )
    )
    .join('');
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function viewOverview() {
  const s = state.summary;
  const content = s.content;
  const links = s.links;
  const eeat = s.eeat;
  const harness = s.harness;
  const email = s.email;

  const kpis = [
    kpi(
      'Sites',
      `${s.sites.connected} of ${s.sites.total} connected`,
      `${s.sites.problems} not answering as they should`,
      s.sites.problems ? 'high' : 'ok'
    ),
    kpi(
      'Content live',
      fmtNumber(content.published),
      `${content.published30d} in the last 30 days · ${content.awaitingApproval} awaiting approval`,
      content.exceptions ? 'medium' : 'ok'
    ),
    kpi(
      'Claims sourced',
      `${fmtNumber(content.claimsSourced)} of ${fmtNumber(content.claimsTotal)}`,
      content.claimsTotal
        ? `${fmtPct(pct(content.claimsSourced, content.claimsTotal), 1)} of every claim has a source line`
        : 'no claims recorded yet',
      content.claimsSourced === content.claimsTotal ? 'ok' : 'medium'
    ),
    kpi(
      'Links live',
      `${links.live} of ${links.total}`,
      `${links.lost} lost · ${links.placedUnverified} awaiting a check · ${links.listed} listed`,
      links.lost ? 'high' : 'ok'
    ),
    kpi(
      'Citations verified',
      `${eeat.verified} of ${eeat.total}`,
      `${fmtPct(eeat.coverage, 1)} of the matrix · ${eeat.mismatches} mismatched`,
      eeat.verified === 0 ? 'high' : eeat.verified < eeat.total ? 'medium' : 'ok'
    ),
    kpi(
      'Email',
      `${email.mailboxes} mailboxes`,
      `${email.risky} risky · ${fmtNumber(email.sent7d)} sent in seven days`,
      email.risky ? 'high' : 'ok'
    ),
    kpi(
      'Last run',
      harness.lastRun ? harness.lastRun.kind : 'no run recorded',
      harness.lastRun
        ? `${harness.lastRun.state} · finished ${fmtAge(ageOf(harness.lastRun.finished, state.now))}`
        : 'the run log is empty',
      harness.failedRuns ? 'medium' : 'ok'
    )
  ].join('');

  const board = pipelineBoard((state.data.content && state.data.content.pieces) || []);
  const strip = [...board.columns, ...board.exceptions]
    .map(
      (col) => `<a class="card kpi${col.items.length ? '' : ' is-ok'}" href="#/content#${encodeURIComponent(col.state)}">
        <span class="kpi-label">${esc(col.info.label)}</span>
        <strong class="kpi-value">${col.items.length}</strong>
        <span class="kpi-note">${esc(col.info.meaning)}</span>
      </a>`
    )
    .join('');

  const files = DATA_FILES.map(({ key, path }) => {
    const failed = state.failed.find((f) => f.key === key);
    if (failed) {
      return `<tr class="row-high"><td><code>${esc(path)}</code></td><td>${chip('high', 'did not load')}</td>
        <td colspan="2">${esc(failed.why)}</td></tr>`;
    }
    const meta = (state.data[key] && state.data[key]._meta) || {};
    const band = freshness(meta.as_of, state.now);
    return `<tr>
      <td><code>${esc(path)}</code></td>
      <td>${chip(band.level, band.label)}</td>
      <td>${esc(fmtDateTime(meta.as_of))}<span class="sub">${esc(meta.source || 'source not stated')}</span></td>
      <td>${esc(meta.produced_by || 'not stated')}</td>
    </tr>`;
  }).join('');

  return `<div class="view-head">
      <h1>What the files say, right now</h1>
      <p>Every figure below is a count of rows in <code>data/</code>, taken when this page was opened
      (${esc(fmtDateTime(new Date(state.now).toISOString()))}). Nothing is remembered from a previous visit.</p>
    </div>
    <div class="grid grid-kpi">${kpis}</div>
    ${section(
      'states',
      'Where the work is',
      'Forward path and exception states, one card per state',
      `<div class="grid grid-kpi">${strip}</div>`
    )}
    ${attentionBySeverity(state.attention)}
    ${section(
      'files',
      'The files this page was built from',
      'A file that is old is shown as old, whatever it says inside',
      `<div class="table-wrap"><table><caption>Freshness is each file's own _meta.as_of measured against the time this page was opened.</caption>
        <thead><tr><th scope="col">File</th><th scope="col">State</th><th scope="col">Written</th><th scope="col">Produced by</th></tr></thead>
        <tbody>${files}</tbody></table></div>`
    )}`;
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

function viewSites() {
  const sites = (state.data.sites && state.data.sites.sites) || [];
  const rows = sites.map((site) => {
    const wp = site.wordpress || {};
    const content = site.content || {};
    const links = site.links || {};
    const metrics = site.metrics || {};
    const citations = site.citations || {};
    const checks = site.checks || [];
    const passing = checks.filter((c) => c.state === 'pass').length;
    const bad = site.status !== 'connected';
    return {
      cls: bad ? 'row-high' : '',
      id: `row-${site.id}`,
      cells: [
        { t: `<strong>${esc(site.name)}</strong><span class="sub">${esc(site.domain)} · ${esc(site.niche)}</span>` },
        {
          t: `${bad ? `<span class="pill pill-bad">${esc(site.status)}</span>` : '<span class="pill pill-ok">connected</span>'}
              <span class="sub">last sync ${esc(fmtAge(ageOf(site.last_sync, state.now)))}</span>`
        },
        {
          t: `${esc(wp.version || '—')}<span class="sub">plugin ${esc(wp.plugin_version || '—')} · REST ${
            wp.rest_ok ? `${fmtNumber(wp.rest_latency_ms)} ms` : 'not answering'
          }</span>`
        },
        {
          t: `${fmtNumber(content.published)} published<span class="sub">${fmtNumber(content.drafted)} drafting · ${fmtNumber(
            content.queued_30d
          )} queued</span>`
        },
        {
          t: `${fmtNumber(links.live)} live<span class="sub">${fmtNumber(links.placed)} placed · ${fmtNumber(links.expired)} expired</span>`
        },
        {
          t: `DR ${fmtNumber(metrics.dr)}<span class="sub">${fmtNumber(metrics.referring_domains)} RDs · spam ${fmtNumber(
            metrics.spam_score
          )}</span>`
        },
        { t: `${fmtNumber(citations.verified)} of ${fmtNumber(citations.expected)}<span class="sub">citations verified</span>` },
        {
          t: `${passing} of ${checks.length} passing<span class="sub">${
            checks.length - passing ? 'see the checks below' : 'every check ran'
          }</span>`
        }
      ]
    };
  });

  const checkRows = sites.flatMap((site) =>
    (site.checks || []).map((check) => ({
      cls: check.state === 'pass' ? '' : 'row-high',
      cells: [
        esc(site.name),
        esc(check.label),
        check.state === 'pass' ? '<span class="pill pill-ok">pass</span>' : `<span class="pill pill-bad">${esc(check.state)}</span>`,
        { t: esc(check.detail), wrap: true }
      ]
    }))
  );

  return `<div class="view-head">
      <h1>Sites</h1>
      <p>Connection is shown as proven by a read that returned data, not by a stored password. The WordPress
      figures come from the plugin read recorded against each site.</p>
    </div>
    ${section(
      'site-table',
      `The portfolio — ${sites.length} site${sites.length === 1 ? '' : 's'}`,
      'One row per site, straight from data/sites.json',
      table({
        caption: 'Sorted as written in the file. A site that is not connected is marked on the left.',
        head: ['Site', 'Status', 'WordPress', 'Content', 'Links', 'Metrics', 'Citations', 'Checks'],
        rows
      })
    )}
    ${section(
      'site-checks',
      'What each check found',
      'These reads sit behind the status column',
      table({ head: ['Site', 'Check', 'Result', 'What it saw'], rows: checkRows })
    )}`;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function pieceLabel(piece) {
  return `<strong>${esc(piece.title)}</strong><span class="sub mono">${esc(piece.id)}${
    piece.target_url ? ` · ${esc(piece.target_url)}` : ''
  }</span>`;
}

function claimsCell(piece) {
  const total = piece.claims_total || 0;
  const sourced = piece.claims_sourced || 0;
  if (!total) return '<span class="sub">no claims recorded</span>';
  const share = sourced / total;
  return `<div class="meter"><span>${sourced} of ${total}</span>${bar(share, share === 1 ? 'is-ok' : 'is-medium')}</div>`;
}

function viewContent() {
  const pieces = (state.data.content && state.data.content.pieces) || [];
  const sites = (state.data.sites && state.data.sites.sites) || [];
  const siteName = (id) => (sites.find((s) => s.id === id) || {}).name || id;
  const board = pipelineBoard(pieces);
  const focus = state.focus;

  const column = (col, isException) => `<div class="col${isException ? ' is-exception' : ''}" id="col-${esc(col.state)}">
      <div class="col-head"><strong>${esc(col.info.label)}</strong><span>${col.items.length}</span></div>
      <p class="col-meaning">${esc(col.info.meaning)}</p>
      <ul>${col.items
        .map(
          (piece) => `<li>${esc(piece.title)}<span class="ref">${esc(piece.id)} · ${esc(
            fmtAge(ageOf(piece.updated, state.now))
          )}</span></li>`
        )
        .join('')}</ul>
      ${col.items.length ? '' : '<p class="empty">nothing here</p>'}
    </div>`;

  const boardHtml = `<div class="board">${board.columns.map((c) => column(c, false)).join('')}${board.exceptions
    .map((c) => column(c, true))
    .join('')}</div>`;

  const flagged = pieces
    .map((piece) => ({ piece, result: evaluatePiece(piece, { now: state.now }) }))
    .filter((entry) => !entry.result.ok);

  const flagRows = flagged.map(({ piece, result }) => ({
    cls: result.problems.some((p) => p.severity === 'high') ? 'row-high' : 'row-medium',
    id: `row-${piece.id}`,
    cells: [
      { t: pieceLabel(piece) },
      esc(siteName(piece.site_id)),
      `<span class="pill">${esc(stateInfo(piece.state).label)}</span>`,
      {
        t: result.problems
          .map((p) => `${sevPill(p.severity)} ${esc(p.message)}<span class="sub mono">${esc(p.code)} · ${esc(p.evidence)}</span>`)
          .join('<br>'),
        wrap: true
      },
      { t: esc(fmtAge(ageOf(piece.updated, state.now))), num: true }
    ]
  }));

  const allRows = pieces.map((piece) => ({
    cls:
      (focus && (focus === piece.id || focus === piece.state)) || (!focus && false)
        ? 'row-focus'
        : piece.state === 'publish_unverified' || piece.state === 'blocked' || piece.state === 'draft_unlinked'
          ? 'row-medium'
          : '',
    id: `row-${piece.id}`,
    cells: [
      { t: pieceLabel(piece) },
      esc(siteName(piece.site_id)),
      `<span class="pill">${esc(stateInfo(piece.state).short)}</span>`,
      { t: claimsCell(piece) },
      piece.ledger_id ? `<span class="mono">${esc(piece.ledger_id)}</span>` : '<span class="sub">no ledger</span>',
      {
        t: piece.live_url
          ? `<a href="${esc(piece.live_url)}" rel="noopener">${esc(
              piece.live_url.replace(/^https?:\/\//, '')
            )}</a><span class="sub">checked ${esc(fmtAge(ageOf(piece.verified_at, state.now)))}</span>`
          : '<span class="sub">nothing live</span>'
      },
      {
        t: `${esc(fmtDuration(ageOf(piece.updated, state.now)))}<span class="sub">updated ${esc(fmtDate(piece.updated))}</span>`,
        num: true
      }
    ]
  }));

  return `<div class="view-head">
      <h1>Content</h1>
      <p>A piece is only <em>published</em> once a fetch of the live URL returned the page and its hash was
      recorded. Every other state says what is still missing, and the checks below run on each row as it is drawn.</p>
    </div>
    ${section(
      'board',
      'The board',
      `${PIPELINE_FLOW.length} states on the forward path, then the ${EXCEPTION_STATES.length} ways a piece can leave it`,
      boardHtml
    )}
    ${section(
      'checks',
      `Rows that fail their own checks — ${flagged.length}`,
      'Computed by js/core.js from each row, not written down anywhere',
      table({
        caption: 'A high row can be corrected only in the file. This page never edits data.',
        head: ['Piece', 'Site', 'State', 'What is wrong', { label: 'Untouched for', num: true }],
        rows: flagRows
      })
    )}
    ${section(
      'pieces',
      `Every piece — ${pieces.length}`,
      'Claims, ledger and the last live check',
      table({
        head: ['Piece', 'Site', 'State', 'Claims sourced', 'Ledger', 'Live URL', { label: 'Untouched for', num: true }],
        rows: allRows
      })
    )}`;
}

// ---------------------------------------------------------------------------
// Backlinks
// ---------------------------------------------------------------------------

const LINK_MEANING = {
  listed: 'On sale, not bought yet.',
  ordered: 'Paid for, nothing placed.',
  placed: 'Placed and not checked, or checked and not found.',
  verified: 'A fetch of the page found the link.',
  lost: 'Was verified once, gone at the last check.',
  expired: 'The host took it down or stopped renewing.',
  refunded: 'Money returned. The link is not the portfolio’s.'
};

function linkStatePill(linkState) {
  const tone = linkState === 'verified' ? 'pill-ok' : linkState === 'lost' || linkState === 'expired' ? 'pill-bad' : 'pill';
  return `<span class="${tone}">${esc(linkState)}</span>`;
}

function viewBacklinks() {
  const placements = (state.data.backlinks && state.data.backlinks.placements) || [];
  const sites = (state.data.sites && state.data.sites.sites) || [];
  const workspace = (state.data.workspace && state.data.workspace.workspace) || {};
  const currency = workspace.currency || 'USD';
  const siteName = (id) => (sites.find((s) => s.id === id) || {}).name || id;
  const focus = state.focus;

  const s = state.summary.links;
  const kpis = [
    kpi('Verified live', `${s.live} of ${s.total}`, 'A fetch found the link on the page', s.live === s.total ? 'ok' : 'medium'),
    kpi('Lost', String(s.lost), 'Verified once, gone at the last check', s.lost ? 'high' : 'ok'),
    kpi('Waiting on a check', String(s.placedUnverified), 'Placed, never fetched since', s.placedUnverified ? 'medium' : 'ok'),
    kpi('Expired', String(s.expired), 'Taken down at the far end', s.expired ? 'high' : 'ok'),
    kpi('Listed', String(s.listed), 'Inventory on sale, not sold', ''),
    kpi(
      'Value live',
      fmtMoney(s.liveValue, currency),
      `${fmtMoney(s.listedValue, currency)} still listed`,
      ''
    )
  ].join('');

  const rows = placements.map((placement) => {
    const check = placement.live_check || {};
    const bad = placement.state === 'lost' || placement.state === 'expired';
    return {
      cls: bad ? 'row-high' : focus === placement.id ? 'row-focus' : '',
      id: `row-${placement.id}`,
      cells: [
        { t: `<span class="mono">${esc(placement.id)}</span><span class="sub">${esc(siteName(placement.seller_site_id))}</span>` },
        {
          t: `${esc(placement.anchor)}<span class="sub"><a href="${esc(placement.target_url)}" rel="noopener">${esc(
            placement.target_url.replace(/^https?:\/\//, '')
          )}</a></span>`,
          wrap: true
        },
        esc(placement.buyer || 'not recorded'),
        { t: fmtMoney(placement.price, currency), num: true },
        { t: linkStatePill(placement.state) },
        { t: esc(fmtDate(placement.placed_at)), num: true },
        {
          t: check.http
            ? `<span class="mono">${esc(check.http)}</span><span class="sub">${esc(fmtAge(ageOf(check.at, state.now)))}</span>`
            : '<span class="sub">never checked</span>',
          num: true
        },
        { t: esc(placement.index_status || 'unknown') }
      ]
    };
  });

  const legend = Object.entries(LINK_MEANING)
    .map(([k, v]) => `<li><span class="pill">${esc(k)}</span> ${esc(v)}</li>`)
    .join('');

  return `<div class="view-head">
      <h1>Backlinks</h1>
      <p>A link counts as live only when a fetch of the page it sits on found it. The check carries its own
      timestamp and HTTP code, so a link marked live can always be re-checked.</p>
    </div>
    <div class="grid grid-kpi">${kpis}</div>
    ${section(
      'placements',
      `Every placement — ${placements.length}`,
      'One row per link, straight from data/backlinks.json',
      table({
        caption: 'Ordered as written in the file. Lost and expired rows are marked on the left.',
        head: ['Placement', 'Anchor and target', 'Buyer', { label: 'Price', num: true }, 'State', { label: 'Placed', num: true }, { label: 'Last check', num: true }, 'Indexed'],
        rows
      })
    )}
    ${section('link-states', 'What the states mean', 'Used here and in the file alike', `<ul class="legend">${legend}</ul>`)}`;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

const DAY_LABELS = ['-6d', '-5d', '-4d', '-3d', '-2d', '-1d', 'today'];

function viewEmail() {
  const email = state.data.email || {};
  const domains = email.domains || [];
  const mailboxes = email.mailboxes || [];
  const campaigns = email.campaigns || [];
  const thresholds = email.thresholds || {};
  const s = state.summary.email;

  const kpis = [
    kpi('Domains', String(domains.length), 'One sending domain per brand', ''),
    kpi('Mailboxes', String(s.mailboxes), `${s.sending} sending · ${s.mailboxes - s.sending} not sending`, ''),
    kpi('Risky', String(s.risky), 'Bounce or complaints above the warning line', s.risky ? 'high' : 'ok'),
    kpi(
      'Average bounce',
      fmtPct(s.avgBounce, 2),
      `Warning at ${fmtPct(thresholds.bounce_warn_pct, 1)}, stop at ${fmtPct(thresholds.bounce_fail_pct, 1)}`,
      ''
    ),
    kpi('Sent in seven days', fmtNumber(s.sent7d), 'Sum of the seven daily counts per mailbox', ''),
    kpi(
      'Replies',
      fmtNumber(campaigns.reduce((n, c) => n + (c.replies || 0), 0)),
      `${fmtNumber(campaigns.reduce((n, c) => n + (c.positive || 0), 0))} positive across ${campaigns.length} campaigns`,
      ''
    )
  ].join('');

  const domainRows = domains.map((domain) => {
    const listed = domain.blacklists || [];
    return {
      cls: listed.length ? 'row-high' : '',
      cells: [
        { t: `<strong>${esc(domain.domain)}</strong><span class="sub mono">${esc(domain.id)}</span>` },
        esc(domain.provider || 'not recorded'),
        domain.spf === 'pass' ? '<span class="pill pill-ok">SPF</span>' : `<span class="pill pill-bad">SPF ${esc(domain.spf)}</span>`,
        domain.dkim === 'pass' ? '<span class="pill pill-ok">DKIM</span>' : `<span class="pill pill-bad">DKIM ${esc(domain.dkim)}</span>`,
        {
          t: `${esc(domain.dmarc_policy || 'no policy')}<span class="sub">${
            domain.dmarc === 'pass' ? 'DMARC passing' : `DMARC ${esc(domain.dmarc)}`
          }</span>`
        },
        listed.length ? `<span class="pill pill-bad">${esc(listed.join(', '))}</span>` : '<span class="sub">none</span>'
      ]
    };
  });

  const mailboxRows = mailboxes.map((mailbox) => {
    const sent = Array.isArray(mailbox.sent_7d) ? mailbox.sent_7d : [];
    const total = sent.reduce((n, v) => n + v, 0);
    const last = sent.length ? sent[sent.length - 1] : 0;
    const capShare = mailbox.daily_cap ? Math.min(1, last / mailbox.daily_cap) : 0;
    const warm = mailbox.warm_target ? Math.min(1, (mailbox.warm_day || 0) / mailbox.warm_target) : 0;
    const overBounce = mailbox.bounce_pct > thresholds.bounce_warn_pct;
    const risky = mailbox.state === 'risky' || overBounce || mailbox.complaint_pct > thresholds.complaint_warn_pct;
    return {
      cls: risky ? 'row-high' : '',
      cells: [
        { t: `<strong>${esc(mailbox.address)}</strong><span class="sub">${esc(mailbox.purpose)}</span>` },
        {
          t: `<span class="pill${
            mailbox.state === 'risky' ? ' pill-bad' : mailbox.state === 'active' ? ' pill-ok' : ''
          }">${esc(mailbox.state)}</span>`
        },
        { t: meter(`day ${mailbox.warm_day} of ${mailbox.warm_target}`, warm, warm === 1 ? 'is-ok' : ''), wrap: true },
        {
          t: meter(
            `${fmtNumber(last)} of ${fmtNumber(mailbox.daily_cap)} today`,
            capShare,
            capShare > 0.95 ? 'is-medium' : ''
          ),
          wrap: true
        },
        {
          t: `${fmtNumber(total)}<span class="sub">${sent.map((v, i) => `${DAY_LABELS[i] || ''} ${v}`).join(' · ')}</span>`,
          num: true
        },
        {
          t: `${fmtPct(mailbox.bounce_pct, 2)}<span class="sub">${
            overBounce ? 'above the warning line' : 'within limits'
          }</span>`,
          num: true
        },
        { t: `${fmtPct(mailbox.complaint_pct, 2)}<span class="sub">complaints</span>`, num: true },
        { t: esc(fmtAge(ageOf(mailbox.last_sent, state.now))), num: true }
      ]
    };
  });

  const campaignRows = campaigns.map((campaign) => ({
    cells: [
      { t: `<strong>${esc(campaign.name)}</strong><span class="sub mono">${esc(campaign.id)}</span>` },
      { t: `<span class="pill">${esc(campaign.state)}</span>` },
      { t: esc((campaign.mailbox_ids || []).join(', ')), wrap: true },
      { t: fmtNumber(campaign.sent), num: true },
      { t: fmtNumber(campaign.replies), num: true },
      {
        t: `${fmtNumber(campaign.positive)}<span class="sub">${fmtPct(pct(campaign.replies, campaign.sent), 1)} replied</span>`,
        num: true
      }
    ]
  }));

  return `<div class="view-head">
      <h1>Email</h1>
      <p>One central sending setup for every site. A mailbox counts as sending only while it is inside its daily
      cap and under the bounce and complaint lines, both of which are read from the file rather than set here.</p>
    </div>
    <div class="grid grid-kpi">${kpis}</div>
    ${section(
      'domains',
      'Domains',
      'Authentication is stated as the receiving side reported it',
      table({ head: ['Domain', 'Provider', 'SPF', 'DKIM', 'DMARC', 'Blacklists'], rows: domainRows })
    )}
    ${section(
      'mailboxes',
      'Mailboxes',
      'Warm-up, daily cap and the seven daily counts as written',
      table({
        head: [
          'Mailbox',
          'State',
          'Warm-up',
          'Today against cap',
          { label: 'Sent in 7d', num: true },
          { label: 'Bounce', num: true },
          { label: 'Complaints', num: true },
          { label: 'Last sent', num: true }
        ],
        rows: mailboxRows
      })
    )}
    ${section(
      'campaigns',
      'Campaigns',
      'Replies are counted by hand and written to the file; nothing on this page sends mail',
      table({
        head: [
          'Campaign',
          'State',
          'Mailboxes',
          { label: 'Sent', num: true },
          { label: 'Replies', num: true },
          { label: 'Positive', num: true }
        ],
        rows: campaignRows
      })
    )}`;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

const RUN_TONE = {
  success: 'pill-ok',
  failed: 'pill-bad',
  incomplete: 'pill-bad',
  verification_expired: 'pill-bad',
  running: ''
};

function runPill(runState) {
  return `<span class="pill ${RUN_TONE[runState] || ''}">${esc(runState)}</span>`;
}

function viewRuns() {
  const runs = (state.data.runs && state.data.runs.runs) || [];
  const status = state.data.status || {};
  const sites = (state.data.sites && state.data.sites.sites) || [];

  const ordered = [...runs].sort((a, b) => String(b.started || '').localeCompare(String(a.started || '')));
  const count = (predicate) => runs.filter(predicate).length;
  const published = runs.reduce((n, r) => n + (r.published || 0), 0);
  const silent = count((r) => r.wrote_status === false);
  const matched = ordered.find((r) => r.id === status.run_id) || null;

  const kpis = [
    kpi('Runs recorded', String(runs.length), 'One row per attempt, failed ones included', ''),
    kpi('Succeeded', String(count((r) => r.state === 'success')), 'Finished and wrote its own record', count((r) => r.state === 'success') === runs.length ? 'ok' : ''),
    kpi(
      'Failed or incomplete',
      String(count((r) => r.state === 'failed' || r.state === 'incomplete' || r.state === 'verification_expired')),
      'A run that stopped early never counts as done',
      count((r) => r.state === 'failed' || r.state === 'incomplete' || r.state === 'verification_expired') ? 'high' : 'ok'
    ),
    kpi('Pieces published by runs', fmtNumber(published), 'Sum of what each run reported publishing', ''),
    kpi(
      'Never wrote a record',
      String(silent),
      'Started and left no status file behind, so it is treated as not run',
      silent ? 'high' : 'ok'
    ),
    kpi(
      'Newest run',
      ordered.length ? ordered[0].kind : 'none',
      ordered.length ? `${ordered[0].state} · started ${fmtAge(ageOf(ordered[0].started, state.now))}` : 'the log is empty',
      ''
    )
  ].join('');

  const rows = ordered.map((run) => ({
    id: `row-${run.id}`,
    cls:
      run.state === 'failed' || run.state === 'verification_expired' || run.wrote_status === false
        ? 'row-high'
        : run.state === 'incomplete'
          ? 'row-medium'
          : '',
    cells: [
      { t: `<span class="mono">${esc(run.id)}</span><span class="sub">${esc(run.kind)}</span>` },
      { t: `<span class="pill">${esc(run.trigger || 'unknown')}</span>` },
      runPill(run.state),
      { t: `${esc(fmtDateTime(run.started))}<span class="sub">${esc(fmtAge(ageOf(run.started, state.now)))} ago</span>`, num: true },
      {
        t: run.finished
          ? `${esc(fmtDuration(ageOf(run.started, run.finished)))}<span class="sub">ended ${esc(fmtDateTime(run.finished))}</span>`
          : '<span class="pill pill-bad">no end time</span>',
        num: true
      },
      {
        t: run.wrote_status ? '<span class="pill pill-ok">wrote it</span>' : '<span class="pill pill-bad">nothing written</span>',
        num: true
      },
      { t: fmtNumber(run.published), num: true },
      {
        t: (run.failed_steps || []).length
          ? (run.failed_steps || []).map((step) => `<span class="pill pill-bad">${esc(step)}</span>`).join(' ')
          : '<span class="sub">none</span>',
        wrap: true
      },
      { t: esc(run.notes || ''), wrap: true }
    ]
  }));

  const statusCard = status.run_id
    ? `<div class="card">
        <dl class="facts">
          <dt>Run written</dt><dd><span class="mono">${esc(status.run_id)}</span> · ${esc(status.kind || 'kind not stated')}</dd>
          <dt>Result</dt><dd>${runPill(status.result || 'unknown')}</dd>
          <dt>Started</dt><dd>${esc(fmtDateTime(status.started_at))}</dd>
          <dt>Finished</dt><dd>${esc(fmtDateTime(status.finished_at))}</dd>
          <dt>In the run log</dt><dd>${
            matched
              ? `${esc(matched.state)} ${matched.finished === status.finished_at ? '· end time agrees' : '· end times differ'}`
              : '<span class="pill pill-bad">this run is not in data/runs.json</span>'
          }</dd>
        </dl>
      </div>`
    : '<p class="empty">data/workflow-status.json names no run.</p>';

  const stepRows = (status.steps || []).map((step) => ({
    cls: step.state === 'success' ? '' : 'row-high',
    cells: [
      { t: `<span class="mono">${esc(step.id)}</span>` },
      runPill(step.state),
      { t: esc(step.detail || ''), wrap: true }
    ]
  }));

  const siteNames = sites.map((site) => site.name).join(', ');

  return `<div class="view-head">
      <h1>Runs</h1>
      <p>A run is finished only when it wrote <code>data/workflow-status.json</code> itself. A webhook that
      answered 200 proves nothing, and a run with no end time is shown as unfinished however it is described.</p>
    </div>
    <div class="grid grid-kpi">${kpis}</div>
    ${section(
      'run-log',
      `Every run — ${ordered.length}`,
      'Newest first, as written in data/runs.json',
      table({
        caption: 'Rows marked on the left either failed or left no record of themselves.',
        head: ['Run', 'Trigger', 'State', { label: 'Started', num: true }, { label: 'Took', num: true }, { label: 'Own record', num: true }, { label: 'Published', num: true }, 'Steps that failed', 'Notes'],
        rows
      })
    )}
    ${section('status', 'What the last run wrote about itself', 'The only file that proves a run happened', statusCard)}
    ${section(
      'steps',
      'Steps in that record',
      siteNames ? `Read against the sites in the portfolio: ${siteNames}` : 'No sites recorded',
      table({ head: ['Step', 'State', 'What it said'], rows: stepRows })
    )}`;
}

// ---------------------------------------------------------------------------
// Citations (EEAT)
// ---------------------------------------------------------------------------

const CITATION_GLYPH = {
  verified: { mark: '✓', word: 'verified' },
  pending: { mark: '…', word: 'pending' },
  submitted: { mark: '…', word: 'submitted' },
  in_review: { mark: '…', word: 'in review' },
  missing: { mark: '·', word: 'not created' },
  mismatch: { mark: '!', word: 'mismatch' },
  rejected: { mark: '×', word: 'rejected' }
};

function citationCell(cell) {
  const glyph = CITATION_GLYPH[cell.state] || { mark: '?', word: cell.state };
  const when = cell.entry && cell.entry.verified_at ? `checked ${fmtAge(ageOf(cell.entry.verified_at, state.now))}` : 'never checked';
  const title = `${cell.source.name}: ${glyph.word}, ${when}`;
  return `<td class="cell cell-${esc(cell.state)}" title="${esc(title)}">
    <span aria-hidden="true">${esc(glyph.mark)}</span><span class="sr-only">${esc(glyph.word)}</span>
  </td>`;
}

function isFilled(value) {
  return !!value && String(value).trim().toLowerCase() !== 'to be confirmed';
}

function viewEeat() {
  const eeat = state.data.eeat || {};
  const entity = eeat.entity || {};
  const nap = entity.nap || {};
  const sources = eeat.sources || [];
  const entries = eeat.entries || [];
  const authors = eeat.authors || [];
  const sites = (state.data.sites && state.data.sites.sites) || [];
  const matrix = citationMatrix(eeat, sites);
  const s = state.summary.eeat;

  const napFields = [
    ['Business name', nap.name],
    ['Address', nap.address],
    ['Phone', nap.phone]
  ];
  const napMissing = napFields.filter(([, value]) => !isFilled(value)).map(([label]) => label);

  const kpis = [
    kpi('Verified', `${s.verified} of ${s.total}`, 'A row counts only once someone read the page', s.verified === 0 ? 'high' : s.verified < s.total ? 'medium' : 'ok'),
    kpi('Coverage', fmtPct(s.coverage, 1), `across ${s.sources} sources and ${matrix.rows.length} sites`, ''),
    kpi('Mismatched', String(s.mismatches), 'The listing exists but says something different', s.mismatches ? 'high' : 'ok'),
    kpi('Business details', napMissing.length ? `${napMissing.length} missing` : 'filled in', napMissing.join(', ') || 'name, address and phone all recorded', napMissing.length ? 'high' : 'ok'),
    kpi('Authors', String(authors.length), `${authors.filter((a) => a.bio_state === 'complete').length} with a full biography`, '')
  ].join('');

  const entityCard = `<div class="card">
      <dl class="facts">
        <dt>Brand</dt><dd>${notSet(entity.brand)}</dd>
        <dt>Legal name</dt><dd>${notSet(entity.legal_name)}</dd>
        <dt>Founder</dt><dd>${notSet(entity.founder)}</dd>
        <dt>Address</dt><dd>${notSet(nap.address)}</dd>
        <dt>Phone</dt><dd>${notSet(nap.phone)}</dd>
        <dt>Profiles</dt><dd>${
          (entity.same_as || []).length ? esc(entity.same_as.join(', ')) : '<span class="sub">none recorded</span>'
        }</dd>
      </dl>
      ${entity.note ? `<p class="notice notice-medium" style="margin:0.8rem 0 0">${esc(entity.note)}</p>` : ''}
    </div>`;

  const head = ['Site', ...matrix.sources.map((source) => source.name), { label: 'Verified', num: true }];
  // citationCell returns a whole <td>, so the matrix body is written by hand.
  const matrixHtml = `<div class="table-wrap"><table class="matrix">
      <caption>One row per site, one column per source. Hover a cell for the state and when it was last checked.</caption>
      <thead><tr>${head
        .map((h) => {
          const label = typeof h === 'string' ? h : h.label;
          return `<th scope="col"${typeof h === 'object' && h.num ? ' class="num"' : ''}>${esc(label)}</th>`;
        })
        .join('')}</tr></thead>
      <tbody>${matrix.rows
        .map(
          (row) => `<tr>
            <td><strong>${esc(row.site.name)}</strong><span class="sub">${esc(row.site.domain)}</span></td>
            ${row.cells.map(citationCell).join('')}
            <td class="num">${row.verified} of ${row.total}</td>
          </tr>`
        )
        .join('')}</tbody></table></div>`;

  const sourceRows = sources.map((source) => ({
    cells: [
      {
        t: `<strong>${esc(source.name)}</strong><span class="sub"><a href="${esc(source.url)}" rel="noopener">${esc(
          source.url.replace(/^https?:\/\//, '')
        )}</a></span>`
      },
      esc(source.type),
      { t: source.cost ? fmtMoney(source.cost) : 'free', num: true },
      { t: esc(source.requires || 'nothing recorded'), wrap: true },
      { t: String(source.weight), num: true }
    ]
  }));

  const entryRows = entries.map((entry) => ({
    cls: entry.state === 'mismatch' || entry.state === 'rejected' ? 'row-high' : '',
    cells: [
      esc((sites.find((site) => site.id === entry.site_id) || {}).name || entry.site_id),
      esc((sources.find((source) => source.id === entry.source_id) || {}).name || entry.source_id),
      {
        t: `<span class="pill${
          entry.state === 'verified' ? ' pill-ok' : entry.state === 'mismatch' || entry.state === 'rejected' ? ' pill-bad' : ''
        }">${esc(entry.state)}</span>`
      },
      entry.url
        ? { t: `<a href="${esc(entry.url)}" rel="noopener">${esc(entry.url.replace(/^https?:\/\//, ''))}</a>`, wrap: true }
        : '<span class="sub">no url recorded</span>',
      { t: entry.verified_at ? esc(fmtAge(ageOf(entry.verified_at, state.now))) : '<span class="sub">never checked</span>', num: true },
      { t: esc(entry.note || ''), wrap: true }
    ]
  }));

  const authorRows = authors.map((author) => ({
    cells: [
      { t: `<strong>${esc(author.name)}</strong><span class="sub mono">${esc(author.id)}</span>` },
      { t: esc(author.credentials || 'nothing recorded'), wrap: true },
      {
        t: `<span class="pill${author.bio_state === 'complete' ? ' pill-ok' : ''}">${esc(author.bio_state || 'unknown')}</span>`
      },
      { t: esc((author.site_ids || []).join(', ')), wrap: true },
      {
        t: (author.same_as || []).length
          ? (author.same_as || []).map((u) => `<a href="${esc(u)}" rel="noopener">${esc(u.replace(/^https?:\/\//, ''))}</a>`).join('<br>')
          : '<span class="sub">none recorded</span>',
        wrap: true
      }
    ]
  }));

  return `<div class="view-head">
      <h1>Citations</h1>
      <p>Who the business says it is, and where that has been confirmed. A cell is filled only when someone read
      the listing and found the details matching, so a missing row is a job, not a zero.</p>
    </div>
    <div class="grid grid-kpi">${kpis}</div>
    ${section('entity', 'The entity the citations describe', 'One record, copied everywhere', entityCard)}
    ${section(
      'matrix',
      'The matrix',
      'A verified cell means somebody read the page; hover for when',
      `<ul class="legend">${Object.entries(CITATION_GLYPH)
        .map(([state, glyph]) => `<li><span class="pill">${esc(glyph.mark)}</span> ${esc(glyph.word)}</li>`)
        .join('')}</ul>${matrixHtml}`
    )}
    ${section(
      'sources',
      `Sources — ${sources.length}`,
      'What each one costs and what it demands',
      table({
        head: ['Source', 'Type', { label: 'Cost', num: true }, 'Needs', { label: 'Weight', num: true }],
        rows: sourceRows
      })
    )}
    ${section(
      'entries',
      `Every row that exists — ${entries.length}`,
      'A row that is not here has not been created yet',
      table({ head: ['Site', 'Source', 'State', 'Where', { label: 'Checked', num: true }, 'Note'], rows: entryRows })
    )}
    ${section(
      'authors',
      'Authors',
      'A byline is only worth something if the person can be found',
      table({ head: ['Author', 'Credentials', 'Biography', 'Sites', 'Profiles'], rows: authorRows })
    )}`;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const WORKER_TONE = {
  working: 'pill-ok',
  idle: '',
  blocked: 'pill-bad',
  awaiting_review: 'pill-sev-medium',
  offline: 'pill-bad'
};

const STALE_WORKER_MS = 24 * 60 * 60 * 1000;

function viewHarness() {
  const workers = (state.data.workers && state.data.workers.workers) || [];
  const control = state.data.control || {};
  const status = state.data.status || {};
  const s = state.summary.harness;

  const staleOf = (worker) => {
    const age = ageOf(worker.last_reported, state.now);
    return age !== null && age > STALE_WORKER_MS;
  };
  const stale = workers.filter(staleOf);

  const kpis = [
    kpi('Workers', String(workers.length), 'One row per lane in the manual', ''),
    kpi('Working', String(s.working), 'Reported work in progress themselves', s.working ? 'ok' : ''),
    kpi('Blocked', String(s.blocked), 'Waiting on something only a person can give', s.blocked ? 'high' : 'ok'),
    kpi('Awaiting review', String(s.awaitingReview), 'A submission is sitting unread', s.awaitingReview ? 'medium' : 'ok'),
    kpi(
      'Silent for a day',
      String(stale.length),
      stale.length ? stale.map((w) => w.id).join(', ') : 'every lane reported within 24 hours',
      stale.length ? 'medium' : 'ok'
    ),
    kpi(
      'Engine',
      control.refresh_enabled ? 'allowed' : 'switched off',
      control.dry_run_only ? 'dry runs only' : 'live runs permitted',
      control.refresh_enabled ? '' : 'medium'
    )
  ].join('');

  const workerRows = workers.map((worker) => ({
    cls: staleOf(worker) ? 'row-medium' : '',
    id: `row-${worker.id}`,
    cells: [
      { t: `<strong>${esc(worker.id)}</strong><span class="sub">${esc(worker.role)}</span>` },
      { t: `<span class="pill ${WORKER_TONE[worker.status] || ''}">${esc(worker.status)}</span>` },
      {
        t: `${esc(fmtAge(ageOf(worker.last_reported, state.now)))}<span class="sub">${
          staleOf(worker) ? 'nothing since then' : esc(fmtDateTime(worker.last_reported))
        }</span>`,
        num: true
      },
      { t: esc(worker.current_task || 'nothing reported'), wrap: true },
      { t: worker.open_questions ? `<span class="pill pill-sev-medium">${worker.open_questions}</span>` : '0', num: true },
      {
        t: worker.last_submission
          ? esc(fmtAge(ageOf(worker.last_submission, state.now)))
          : '<span class="sub">never submitted</span>',
        num: true
      },
      {
        t: `<span class="mono">${esc(worker.branch || 'no branch')}</span><span class="sub">${esc(worker.worktree || '')}</span>`,
        wrap: true
      }
    ]
  }));

  const controlCard = `<div class="card">
      <dl class="facts">
        <dt>Refresh</dt><dd>${
          control.refresh_enabled
            ? '<span class="pill pill-ok">enabled</span>'
            : '<span class="pill pill-bad">switched off in the control file</span>'
        }</dd>
        <dt>Run type</dt><dd>${
          control.dry_run_only ? 'dry runs only, nothing is published' : 'live runs, publishing allowed'
        }</dd>
        <dt>Allowed kinds</dt><dd>${
          (control.allowed_kinds || []).length
            ? (control.allowed_kinds || []).map((kind) => `<span class="pill">${esc(kind)}</span>`).join(' ')
            : '<span class="sub">none listed</span>'
        }</dd>
        <dt>Longest run</dt><dd>${
          control.max_runtime_minutes
            ? `${fmtNumber(control.max_runtime_minutes)} minutes before it is treated as stalled`
            : '<span class="sub">not stated</span>'
        }</dd>
        <dt>Who set it</dt><dd>${notSet(control.updated_by)} <span class="sub">${esc(fmtDateTime(control.updated_at))}</span></dd>
      </dl>
      ${
        control.reason
          ? `<p class="notice ${control.refresh_enabled ? 'notice-low' : 'notice-medium'}" style="margin:0.8rem 0 0">${esc(
              control.reason
            )}</p>`
          : ''
      }
    </div>`;

  const lastRun = status.run_id
    ? `<dl class="facts">
        <dt>Last record</dt><dd><span class="mono">${esc(status.run_id)}</span> · ${esc(status.kind || 'kind not stated')}</dd>
        <dt>Result</dt><dd>${runPill(status.result || 'unknown')}</dd>
        <dt>Finished</dt><dd>${esc(fmtDateTime(status.finished_at))} <span class="sub">${esc(
          fmtAge(ageOf(status.finished_at, state.now))
        )} ago</span></dd>
      </dl>`
    : '<p class="empty">No run has written a record. The run log below is the only other evidence, and it is weaker.</p>';

  return `<div class="view-head">
      <h1>Harness</h1>
      <p>What each lane last reported, and what the control file allows. This page can see a file, never a window,
      so <em>working</em> here means the worker said so at that time, not that it is running now.</p>
    </div>
    <div class="grid grid-kpi">${kpis}</div>
    ${section(
      'lanes',
      `Lanes — ${workers.length}`,
      'As last reported in data/workers.json',
      table({
        caption: 'A lane whose last report is older than a day is marked on the left whatever it claimed.',
        head: ['Lane', 'Status', { label: 'Last reported', num: true }, 'Said it was doing', { label: 'Open questions', num: true }, { label: 'Last submission', num: true }, 'Where'],
        rows: workerRows
      })
    )}
    ${section('control', 'What the control file allows', 'Nothing secret belongs in this file', controlCard)}
    ${section('last-run', 'The last run that finished', 'Read from data/workflow-status.json', lastRun)}`;
}

// ---------------------------------------------------------------------------
// The map
//
// A picture of the same files, for the times a picture is faster than a table.
// It decides nothing: js/scene.js builds the objects, js/map3d.js draws them,
// and every fact on every object is repeated in the tables under the canvas, so
// nothing on this view depends on a graphics card being present.
// ---------------------------------------------------------------------------

let mapController = null;
let mapScene = null;
let mapToken = 0;

// The model calls an object by its kind. A reader is owed the words.
const MAP_KINDS = {
  hub: 'the portfolio itself',
  site: 'a site',
  citation: 'a citation source for a site',
  link: 'a sold link',
  domain: 'a sending domain',
  mailbox: 'a mailbox on a sending domain',
  worker: 'a lane that reported'
};

function mapModel() {
  return buildPortfolioScene(state.data, { now: state.now, attention: state.attention });
}

function mapLayersHtml(model) {
  return `<div class="map-layers" role="group" aria-label="What to draw on the map">
    ${model.layers
      .map(
        (layer) => `<label class="map-toggle">
        <input type="checkbox" data-layer="${esc(layer.id)}"${layer.on ? ' checked' : ''} />
        <span class="map-toggle-name">${esc(layer.label)}</span>
        <span class="sub">${
          layer.count === null ? 'no count in the model' : `${fmtNumber(layer.count)} drawn`
        } · ${esc(layer.note)}</span>
      </label>`
      )
      .join('')}
  </div>`;
}

// Motion is the one thing on this view that a colour cannot say twice, so the
// objects that move are also written out in a line, in the same order.
function mapPulseHtml(model) {
  const asking = model.nodes.filter((node) => node.pulse);
  if (!asking.length) {
    return '<p class="sub">Nothing on the canvas is moving. No file is asking for a person on any object today.</p>';
  }
  const shown = asking.slice(0, 12);
  return `<div class="map-keys" role="group" aria-label="Objects that pulse on the canvas">
    <p class="map-keys-head">${fmtNumber(asking.length)} of these objects pulse, because a file is asking for a person
    on them. Nothing else moves.</p>
    ${shown.map((node) => chip(node.severity || 'low', node.label)).join('')}${
      asking.length > shown.length
        ? `<span class="sub">and ${fmtNumber(asking.length - shown.length)} more, all in the table below</span>`
        : ''
    }
  </div>`;
}

function mapPanelHtml(node) {
  if (!node) {
    return `<h3>Nothing is selected</h3>
      <p>Point at an object on the canvas, or press it, and this panel gives its state and what the file says to do
      next. The tables below hold the same words for every object, one row each.</p>`;
  }
  const facts = node.facts.length
    ? `<dl class="facts">${node.facts.map((fact) => `<dt>${esc(fact.label)}</dt><dd>${esc(fact.value)}</dd>`).join('')}</dl>`
    : '<p class="empty">This object carries no facts of its own.</p>';
  const asking = node.attention.length
    ? `<h4 class="map-asking">Asking for a person</h4>${attentionList(node.attention)}`
    : '<p class="sub">Nothing in the files is asking for this object today.</p>';
  return `<h3>${esc(node.label)}<span class="sub">${esc(node.sublabel)}</span></h3>
    <p class="sub">From <code>${esc(node.source)}</code>${
      node.ref ? ` · <span class="mono">${esc(node.ref)}</span>` : ''
    } · drawn as <span class="mono">${esc(node.tone)}</span></p>
    ${asking}
    ${facts}`;
}

function viewMap() {
  const model = mapModel();
  mapScene = model;
  const missingNote = model.missing.length
    ? notice(
        'medium',
        'Part of the picture is missing',
        `<p>The map drew what arrived. Each of these lines is a file or a row that did not, and none of them
         was filled in with a zero:</p><ul>${model.missing.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>`
      )
    : '';

  const stage = `<div class="map-stage">
      <div class="map-frame">
        <canvas id="map-canvas" tabindex="0" role="img"
          aria-label="${esc(describeScene(model))} The tables below give the same facts as text."></canvas>
        <div class="map-labels" id="map-labels" aria-hidden="true"></div>
        <p class="map-hint">Drag to turn · wheel or pinch to zoom · arrow keys turn · press an object for its state
        and the next act</p>
        <p class="map-status" id="map-status"></p>
      </div>
      <aside class="map-panel" id="map-panel" aria-live="polite">${mapPanelHtml(null)}</aside>
    </div>`;

  const legendRows = model.encoding.map((entry) => ({
    cells: [
      { t: esc(entry.mark) },
      { t: esc(entry.means) },
      { t: esc(entry.detail), wrap: true }
    ]
  }));

  return `<div class="view-head">
      <h1>Map</h1>
      <p>The same files as a picture: ${esc(describeScene(model))} Colour is the state each file records, size is
      pages published, height is citation coverage. Nothing else is encoded, and how far apart two objects sit is
      how the picture was arranged.</p>
    </div>
    ${missingNote}
    ${stage}
    ${mapLayersHtml(model)}
    ${mapPulseHtml(model)}
    ${section(
      'map-legend',
      'Every mark has a meaning',
      'Read this before reading the picture',
      table({ caption: 'What the canvas encodes, and what it refuses to encode.', head: ['Mark', 'Means', 'In full'], rows: legendRows })
    )}
    ${section(
      'map-objects',
      `Every object on the map — ${fmtNumber(model.nodes.length)}`,
      'One row each, in the order the model holds them',
      table({
        caption:
          'Size is the radius the canvas draws, which is pages published: a site with no count in its file keeps the smallest size. A tone of "unknown" means the state is not one js/core.js has a tone for, and is drawn as an outline.',
        head: ['Object', 'What it is', 'Tone', { label: 'Size (radius)', num: true }, 'Source file'],
        rows: model.nodes.map((node) => ({
          cells: [
            {
              t: `<strong>${esc(node.label)}</strong>${node.severity ? ` ${sevPill(node.severity)}` : ''}<span class="sub">${esc(
                node.sublabel
              )}</span>`
            },
            { t: esc(MAP_KINDS[node.kind] || node.kind) },
            { t: `<span class="mono">${esc(node.tone)}</span>` },
            { t: fmtNumber(node.radius), num: true },
            { t: `<code>${esc(node.source)}</code>` }
          ]
        }))
      })
    )}
    ${section(
      'map-facts',
      'Every fact on every object',
      'The same words the panel gives when an object is pressed',
      `<div class="map-facts">${model.nodes
        .map(
          (node) => `<details class="map-fact">
          <summary>${esc(node.label)} <span class="sub">${esc(MAP_KINDS[node.kind] || node.kind)} · ${esc(node.source)}</span></summary>
          <dl class="facts">${node.facts
            .map((fact) => `<dt>${esc(fact.label)}</dt><dd>${esc(fact.value)}</dd>`)
            .join('')}</dl>
          ${
            node.attention.length
              ? attentionList(node.attention)
              : '<p class="empty">Nothing in the files is asking for this object today.</p>'
          }
        </details>`
        )
        .join('')}</div>`
    )}`;
}


function paintMapPanel(node) {
  const panel = document.getElementById('map-panel');
  if (panel) panel.innerHTML = mapPanelHtml(node);
}

function teardownMap() {
  // Any import still in flight belongs to the view being left behind.
  mapToken += 1;
  if (mapController) {
    mapController.dispose();
    mapController = null;
  }
}

function mountMap() {
  const canvas = document.getElementById('map-canvas');
  const overlay = document.getElementById('map-labels');
  const status = document.getElementById('map-status');
  // A document with no canvas stops here. That is not a failure: the tables
  // under where the canvas would be already hold every fact it would draw.
  if (!canvas || typeof canvas.getContext !== 'function') return;

  const token = (mapToken += 1);
  import('./js/map3d.js')
    .then((mod) => {
      // The reader may have moved to another view while three.js was loading,
      // or come back to this one: only the newest mount may draw.
      if (token !== mapToken || !document.getElementById('map-canvas')) return;
      mapController = mod.createMap({
        canvas,
        overlay,
        model: mapScene || mapModel(),
        onHover: (node) => paintMapPanel(node),
        onSelect: (node) => paintMapPanel(node)
      });
      for (const input of document.querySelectorAll('input[data-layer]')) {
        input.addEventListener('change', () => {
          if (mapController) mapController.setLayerVisible(input.dataset.layer, input.checked);
        });
      }
      const counts = mapController.counts;
      if (status) {
        status.textContent = `${fmtNumber(counts.meshes)} objects, ${fmtNumber(counts.labels)} named, ${
          counts.reducedMotion ? 'motion held still because the reader asked for less of it' : `${fmtNumber(counts.pulses)} pulsing`
        }.`;
      }
    })
    .catch((error) => {
      if (token !== mapToken) return;
      const panel = document.getElementById('map-panel');
      if (!panel) return;
      panel.innerHTML = notice(
        'medium',
        'The canvas could not start',
        `<p>This browser drew no canvas, so the picture is missing. Nothing else is: every object, its tone and
         every fact about it are in the tables below the canvas.</p>
         <p><code>${esc(error && error.message ? error.message : String(error))}</code></p>`
      );
    });
}

// ---------------------------------------------------------------------------
// Routing and start-up
//
// A route is #/<view>, optionally with ?focus=<row id> to mark one row, or
// #<element id> to jump inside the view. Nothing is stored between visits: the
// hash is the whole address, so a link can be sent to somebody else.
// ---------------------------------------------------------------------------

const RENDERERS = {
  overview: viewOverview,
  map: viewMap,
  sites: viewSites,
  content: viewContent,
  backlinks: viewBacklinks,
  email: viewEmail,
  eeat: viewEeat,
  runs: viewRuns,
  harness: viewHarness
};

function parseHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw || raw === 'main') return { view: 'overview', focus: null, anchor: null };
  const [pathPart, queryPart] = raw.split('?');
  const [viewPart, anchorPart] = pathPart.replace(/^\//, '').split('#');
  const view = VIEWS.includes(viewPart) ? viewPart : 'overview';
  const params = new URLSearchParams(queryPart || '');
  return { view, focus: params.get('focus') || null, anchor: anchorPart ? decodeURIComponent(anchorPart) : null };
}

function markTabs(view) {
  const tabs = document.querySelectorAll('.tabs a[data-view]');
  for (const tab of tabs) {
    const active = tab.dataset.view === view;
    tab.classList.toggle('is-active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}

function failureCard(error) {
  const message = error && error.message ? error.message : String(error);
  return `${notice(
    'high',
    'This view stopped while drawing itself',
    `<p>The files were read, but something in them did not fit what this view expects. Nothing has been hidden:
     the message is below.</p><p><code>${esc(message)}</code></p>`
  )}<p class="empty">Switch to another section, or correct the file this one reads.</p>`;
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  const route = parseHash(window.location.hash);
  state.view = route.view;
  state.focus = route.focus;
  // Whatever the last view allocated is released before the next one is drawn.
  teardownMap();

  let body;
  try {
    body = RENDERERS[route.view]();
  } catch (error) {
    body = failureCard(error);
  }

  app.innerHTML = `${loadNotices()}<div class="view" id="view-${esc(route.view)}">${body}</div>`;
  markTabs(route.view);
  if (route.view === 'map') mountMap();

  const title = RENDERERS[route.view] ? route.view : 'overview';
  const workspace = (state.data.workspace && state.data.workspace.workspace) || {};
  document.title = `${workspace.name || 'Portfolio dashboard'} — ${title}`;

  if (route.anchor) {
    const target = document.getElementById(route.anchor);
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
      return;
    }
  }

  const main = document.getElementById('main');
  if (main) main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function wireSkipLink() {
  const skip = document.querySelector('a.skip');
  const main = document.getElementById('main');
  if (!skip || !main) return;
  skip.addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
}

async function boot() {
  const app = document.getElementById('app');
  await loadAll();
  paintShell();
  render();
  window.addEventListener('hashchange', render);
  wireSkipLink();
  if (app) app.classList.add('is-ready');
}

boot().catch((error) => {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `${notice(
    'high',
    'The files could not be read at all',
    `<p>Nothing on this page is a number yet, because none of the data files answered.</p>
     <p><code>${esc(error && error.message ? error.message : String(error))}</code></p>
     <p>If the page was opened from disk, the browser may be refusing to read files next to it. Serving the
     folder over HTTP is enough.</p>`
  )}`;
});

