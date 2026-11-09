// js/core.js
// The only place that decides what a state means.
//
// Rules this file exists to keep:
//   1. A word never hides a state. "Published" needs a fetch. "Approved" needs a ledger.
//   2. Nothing is invented. A missing value stays missing and is reported as missing.
//   3. Every attention row names the file it came from, so a person can go and look.
//
// No DOM, no fetch, no clock of its own: every function that needs "now" is given it.
// That is what lets tests/ run the same code the browser runs.

// ---------------------------------------------------------------------------
// Pipeline states
// ---------------------------------------------------------------------------

// The forward path. A piece that is not on this path is in an exception state.
export const PIPELINE_FLOW = [
  'briefed',
  'sourced',
  'drafted',
  'edited',
  'approved',
  'publishing',
  'published'
];

// States that mean "something is wrong", kept separate from "not finished yet".
export const EXCEPTION_STATES = [
  'source_stale',
  'draft_unlinked',
  'publish_unverified',
  'blocked',
  'abandoned'
];

export const PIPELINE_STATES = {
  briefed: {
    label: 'Briefed',
    short: 'Brief',
    tone: 'neutral',
    meaning: 'One idea, one angle, one source set. Nothing researched yet.'
  },
  sourced: {
    label: 'Sourced',
    short: 'Sourced',
    tone: 'info',
    meaning: 'A claim ledger exists and every claim has a source line.'
  },
  drafted: {
    label: 'Drafted',
    short: 'Draft',
    tone: 'info',
    meaning: 'Prose written against the ledger. Not read by anyone else yet.'
  },
  edited: {
    label: 'Edited',
    short: 'Edited',
    tone: 'accent',
    meaning: 'Editorial pass done: house voice, cross-links, repetition cut.'
  },
  approved: {
    label: 'Approved',
    short: 'Approved',
    tone: 'accent',
    meaning: 'A person said yes. Approved is not published and never implies it.'
  },
  publishing: {
    label: 'Publishing',
    short: 'Publishing',
    tone: 'warn',
    meaning: 'Handed to a site module. Nothing is proven until the URL answers.'
  },
  published: {
    label: 'Published',
    short: 'Live',
    tone: 'good',
    meaning: 'The live URL was fetched and matched the expected bytes.'
  },
  source_stale: {
    label: 'Source stale',
    short: 'Stale',
    tone: 'warn',
    meaning: 'A cited source is older than the window. Re-research before approval.'
  },
  draft_unlinked: {
    label: 'Draft unlinked',
    short: 'Unlinked',
    tone: 'bad',
    meaning: 'A draft exists with no ledger behind it, so nothing in it is checkable.'
  },
  publish_unverified: {
    label: 'Publish unverified',
    short: 'Unverified',
    tone: 'bad',
    meaning: 'A commit or plugin call happened. The live page was never confirmed.'
  },
  blocked: {
    label: 'Blocked',
    short: 'Blocked',
    tone: 'bad',
    meaning: 'Cannot move without someone else: a site, a password, a decision.'
  },
  abandoned: {
    label: 'Abandoned',
    short: 'Dropped',
    tone: 'muted',
    meaning: 'The person said no. Terminal, and nothing reopens it silently.'
  }
};

// Allowed moves. Anything not listed here is refused, including every shortcut
// from edited straight to published.
export const TRANSITIONS = {
  briefed: ['sourced', 'blocked', 'abandoned'],
  sourced: ['drafted', 'source_stale', 'blocked', 'abandoned'],
  drafted: ['edited', 'draft_unlinked', 'blocked', 'abandoned'],
  edited: ['approved', 'drafted', 'source_stale', 'abandoned'],
  approved: ['publishing', 'edited', 'abandoned'],
  publishing: ['published', 'publish_unverified', 'approved'],
  published: [],
  source_stale: ['sourced', 'abandoned'],
  draft_unlinked: ['drafted', 'abandoned'],
  publish_unverified: ['publishing', 'published'],
  blocked: ['briefed', 'sourced', 'drafted', 'edited', 'approved', 'abandoned'],
  abandoned: []
};

export function canTransition(from, to) {
  if (!PIPELINE_STATES[from]) {
    return { ok: false, reason: `Unknown state "${from}".` };
  }
  if (!PIPELINE_STATES[to]) {
    return { ok: false, reason: `Unknown state "${to}".` };
  }
  if (from === to) {
    return { ok: false, reason: 'A piece cannot move to the state it is already in.' };
  }
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `"${from}" cannot go to "${to}". Allowed: ${allowed.length ? allowed.join(', ') : 'nothing, it is terminal'}.`
    };
  }
  return { ok: true, reason: `"${from}" to "${to}" is allowed.` };
}

export function isTerminal(state) {
  const moves = TRANSITIONS[state];
  return Array.isArray(moves) && moves.length === 0;
}

export function isException(state) {
  return EXCEPTION_STATES.includes(state);
}

export function isOnPath(state) {
  return PIPELINE_FLOW.includes(state);
}

export function stateInfo(state) {
  return PIPELINE_STATES[state] || {
    label: state || 'Unknown',
    short: state || 'Unknown',
    tone: 'muted',
    meaning: 'This state is not in the pipeline definition. Treat it as unknown.'
  };
}

// ---------------------------------------------------------------------------
// Tones: what a state looks like, decided once
// ---------------------------------------------------------------------------
//
// The map paints from this table, and so could anything else that needs "is
// this good or bad" as a colour. It lives here, with the other rules, because a
// colour is a claim about a state: painting a lost link in the same green as a
// verified one is the same kind of mistake as printing a zero for a missing
// file. A state this table has never heard of is `unknown` — never the nearest
// guess.

export const NODE_TONE = {
  site: { connected: 'ok', pending: 'low', error: 'high', paused: 'medium' },
  worker: { working: 'ok', idle: 'low', blocked: 'high', awaiting_review: 'medium', offline: 'muted' },
  mailbox: { active: 'ok', warming: 'low', paused: 'muted', risky: 'high' },
  citation: { verified: 'ok', pending: 'medium', missing: 'muted', mismatch: 'high', rejected: 'high' },
  link: { verified: 'ok', ordered: 'low', placed: 'low', listed: 'muted', lost: 'high', expired: 'high', refunded: 'low' },
  domain: { clean: 'ok', listed: 'high' },
  run: { success: 'ok', running: 'low', incomplete: 'medium', failed: 'high', verification_expired: 'high' }
};

export function nodeTone(kind, state) {
  const table = NODE_TONE[kind];
  const tone = table && Object.prototype.hasOwnProperty.call(table, state) ? table[state] : null;
  return tone || 'unknown';
}

// ---------------------------------------------------------------------------
// Invariants: the checks a piece has to pass for its own state to be honest
// ---------------------------------------------------------------------------

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
export const SEVERITY_RANK = SEVERITY_ORDER;
export const SEVERITY_LABEL = { high: 'Act now', medium: 'This week', low: 'Watch' };

export const DEFAULT_THRESHOLDS = {
  draft_ageing_days: 5,
  approval_to_publish_days: 2,
  source_window_days: 45,
  publish_verify_minutes: 30,
  recheck_days: 30,
  verify_after_hours: 24
};

export function ageOf(iso, now) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (typeof now === 'number' ? now : Date.now()) - t;
}

function daysAgo(iso, now) {
  const ms = ageOf(iso, now);
  return ms === null ? null : ms / 86400000;
}

// A piece can sit in a state its own fields do not support. That gap is the
// thing worth showing, so it is returned rather than smoothed over.
export function evaluatePiece(piece, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
  const now = options.now || Date.now();
  const state = piece && piece.state;
  const problems = [];
  const add = (code, severity, message, evidence) =>
    problems.push({ code, severity, message, evidence: evidence || '' });

  if (!PIPELINE_STATES[state]) {
    add('unknown_state', 'high', `State "${state}" is not in the pipeline definition.`, 'js/core.js');
  }

  const pastEditing = ['edited', 'approved', 'publishing', 'published'].includes(state);

  if (pastEditing && !piece.ledger_id) {
    add(
      'missing_ledger',
      'high',
      'Past editing with no claim ledger, so no sentence in it can be checked.',
      'ledger_id is null'
    );
  }

  if (pastEditing && piece.claims_total > 0 && piece.claims_sourced < piece.claims_total) {
    add(
      'unsourced_claims',
      'high',
      `${piece.claims_total - piece.claims_sourced} of ${piece.claims_total} claims have no source.`,
      `claims_sourced ${piece.claims_sourced} of ${piece.claims_total}`
    );
  }

  if (state === 'published') {
    if (!piece.live_url || !piece.verified_at) {
      add(
        'published_without_fetch',
        'high',
        'Marked published with no live URL or no verification time.',
        'live_url and verified_at are both required'
      );
    }
    if (!piece.hash_sha256) {
      add(
        'published_without_hash',
        'medium',
        'Published without the hash of the served page, so nobody can prove what went live.',
        'hash_sha256 is null'
      );
    }
  }

  if (state === 'publish_unverified') {
    add(
      'unverified_publish',
      'high',
      'Something was pushed and never confirmed on the live URL.',
      piece.note || 'no note recorded'
    );
  }

  if (state === 'draft_unlinked') {
    add(
      'draft_without_ledger',
      'high',
      'Draft exists with no ledger. It cannot be approved in this state.',
      piece.note || 'ledger_id is null'
    );
  }

  if (state === 'source_stale') {
    add(
      'source_outside_window',
      'medium',
      `A cited source is older than the ${thresholds.source_window_days} day window.`,
      piece.note || 'see the ledger'
    );
  }

  if (state === 'blocked') {
    add(
      'blocked',
      'high',
      'Blocked, and the blocker is not something the writer can clear.',
      piece.note || 'no note recorded'
    );
  }

  if (state === 'drafted') {
    const age = daysAgo(piece.updated, now);
    if (age !== null && age > thresholds.draft_ageing_days) {
      add(
        'draft_ageing',
        'medium',
        `Draft has sat for ${Math.floor(age)} days without an edit.`,
        `updated ${piece.updated}`
      );
    }
  }

  if (state === 'approved') {
    const age = daysAgo(piece.updated, now);
    if (age !== null && age > thresholds.approval_to_publish_days) {
      add(
        'approval_waiting',
        'medium',
        `Approved ${Math.floor(age)} days ago and still not live.`,
        `updated ${piece.updated}`
      );
    }
  }

  if (state === 'publishing') {
    const age = ageOf(piece.updated, now);
    if (age !== null && age > thresholds.publish_verify_minutes * 60000) {
      add(
        'publish_stalled',
        'high',
        'Handed to a site and never came back. Treat as unverified, not as done.',
        `updated ${piece.updated}`
      );
    }
  }

  problems.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { id: piece && piece.id, state, ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Freshness: how old a published file is, said plainly
// ---------------------------------------------------------------------------

export const FRESHNESS_BANDS = { fresh: 6, aging: 24 };

// The newest _meta.as_of across the files that were read. A file that failed to
// load contributes nothing, so this never claims to be newer than its evidence.
export function newestTimestamp(data) {
  let newest = null;
  for (const { key } of DATA_FILES) {
    const meta = data && data[key] && data[key]._meta;
    if (!meta || !meta.as_of) continue;
    if (!newest || String(meta.as_of) > newest) newest = meta.as_of;
  }
  return newest;
}

export function freshness(asOfIso, now = Date.now(), bands = FRESHNESS_BANDS) {
  const ms = ageOf(asOfIso, now);
  if (ms === null) {
    return { level: 'unknown', hours: null, ms: null, label: 'no timestamp' };
  }
  const hours = ms / 3600000;
  let level = 'stale';
  if (hours <= bands.fresh) level = 'fresh';
  else if (hours <= bands.aging) level = 'aging';
  const label = level === 'fresh' ? 'current' : level === 'aging' ? 'getting old' : 'out of date';
  return { level, hours, ms, label };
}

// ---------------------------------------------------------------------------
// Formatters, so a number reads the same everywhere it appears
// ---------------------------------------------------------------------------

export function fmtDuration(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return 'unknown';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}

export function fmtAge(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return 'never';
  return `${fmtDuration(ms)} ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso) {
  if (!iso) return 'not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'not set';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDateTime(iso) {
  if (!iso) return 'not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'not set';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${fmtDate(iso)}, ${hh}:${mm} UTC`;
}

export function fmtNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-GB');
}

export function fmtMoney(n, currency = 'USD') {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '';
  return `${symbol}${Number(n).toLocaleString('en-GB')}`;
}

export function fmtPct(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function pct(part, whole) {
  if (!whole || part === null || part === undefined) return null;
  return Math.round((part / whole) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Attention: what needs a person, computed from the files, never invented
// ---------------------------------------------------------------------------
//
// Every item carries its evidence. A rule that cannot read what it needs
// produces nothing at all, because a missing file is reported once by the
// data-freshness rule, not once per rule that wanted it.

function item(severity, area, title, evidence, action, view, ref) {
  return {
    severity,
    area,
    title,
    evidence: evidence || '',
    action: action || '',
    view: view || 'overview',
    ref: ref || null
  };
}

function listOf(data, key, field) {
  const set = data && data[key];
  if (!set) return [];
  return Array.isArray(set[field]) ? set[field] : [];
}

function siteName(ctx, id) {
  const site = ctx.sites.find((s) => s.id === id);
  return site ? site.name : id;
}

function siteAttention(ctx, out) {
  for (const site of ctx.sites) {
    const failed = (site.checks || []).filter((c) => c.state === 'fail');
    const warned = (site.checks || []).filter((c) => c.state === 'warn');

    if (site.status === 'error') {
      out.push(
        item(
          'high',
          'Sites',
          `${site.name} cannot be reached`,
          failed.map((c) => c.detail).join(' ') || 'No check detail recorded.',
          'Repair the site module, then run the sync again. Until then nothing can be published to it.',
          'sites',
          site.id
        )
      );
    } else if (site.status === 'pending') {
      out.push(
        item(
          'medium',
          'Sites',
          `${site.name} is not connected yet`,
          failed.map((c) => c.detail).join(' ') || 'Setup is incomplete.',
          'Point the domain and install the upload plugin. Queued content cannot move until this is done.',
          'sites',
          site.id
        )
      );
    }

    const syncAge = ageOf(site.last_sync, ctx.now);
    if (site.status === 'connected' && (syncAge === null || syncAge > 2 * 86400000)) {
      out.push(
        item(
          syncAge === null ? 'medium' : 'low',
          'Sites',
          `${site.name} has not been read since ${site.last_sync ? fmtAge(syncAge) : 'never'}`,
          `last_sync is ${site.last_sync || 'null'}`,
          'Run the site sync. A site nobody has read from is a site you are guessing about.',
          'sites',
          site.id
        )
      );
    }

    for (const check of warned) {
      out.push(
        item('low', 'Sites', `${site.name}: ${check.label}`, check.detail, 'Pick it up on the next sync.', 'sites', site.id)
      );
    }
  }
}

function contentAttention(ctx, out) {
  for (const piece of ctx.content) {
    const verdict = evaluatePiece(piece, { thresholds: ctx.thresholds, now: ctx.now });
    for (const problem of verdict.problems) {
      out.push(
        item(
          problem.severity,
          'Content',
          `${piece.title} (${siteName(ctx, piece.site_id)})`,
          `${problem.message} Evidence: ${problem.evidence}`,
          actionForContentProblem(problem.code),
          'content',
          piece.id
        )
      );
    }
  }
}

function actionForContentProblem(code) {
  switch (code) {
    case 'missing_ledger':
    case 'draft_without_ledger':
      return 'Send it back for research. A draft without a ledger cannot be checked, so it cannot be approved.';
    case 'unsourced_claims':
      return 'Source the missing claims or cut them. Unsupported sentences do not go live.';
    case 'published_without_fetch':
      return 'Fetch the live URL and record it, or move the piece back to unverified. Do not leave it reading as live.';
    case 'published_without_hash':
      return 'Hash the served page and record it, so the next person can prove what was published.';
    case 'unverified_publish':
      return 'Fetch the URL now. If it is not there, find out why before doing anything else.';
    case 'source_outside_window':
      return 'Re-research the stale claims, then move it back to sourced.';
    case 'draft_ageing':
      return 'Finish it or drop it. A draft that sits is the most expensive kind of unfinished work.';
    case 'approval_waiting':
      return 'Publish it. Approval that never reaches the site is not progress.';
    case 'publish_stalled':
      return 'Check the site module. A stalled publish is unknown, not done.';
    case 'blocked':
      return 'Clear the blocker named in the note.';
    default:
      return 'Look at the piece and decide.';
  }
}

function linkAttention(ctx, out) {
  for (const link of ctx.links) {
    const name = siteName(ctx, link.seller_site_id);
    const check = link.live_check || {};

    if (link.state === 'lost') {
      out.push(
        item(
          'high',
          'Backlinks',
          `A sold link on ${name} is gone`,
          `${link.anchor} to ${link.target_url}, HTTP ${check.http === null || check.http === undefined ? 'not checked' : check.http}. ${link.note || ''}`.trim(),
          'Replace it or refund it. A lost link is the failure a buyer notices immediately.',
          'backlinks',
          link.id
        )
      );
      continue;
    }

    if (link.state === 'placed') {
      const age = ageOf(link.placed_at, ctx.now);
      if (age !== null && age > ctx.thresholds.verify_after_hours * 3600000) {
        out.push(
          item(
            'medium',
            'Backlinks',
            `Link on ${name} placed and never verified`,
            `${link.anchor}, placed ${fmtAge(age)}.`,
            'Fetch the page and look for the anchor. Placed is what the plugin said, not what the page shows.',
            'backlinks',
            link.id
          )
        );
      }
      continue;
    }

    if (link.state === 'verified') {
      const age = ageOf(link.verified_at, ctx.now);
      if (age !== null && age > ctx.thresholds.recheck_days * 86400000) {
        out.push(
          item(
            'low',
            'Backlinks',
            `Link on ${name} last checked ${fmtAge(age)}`,
            `${link.anchor} to ${link.target_url}.`,
            'Re-check it. Silent removals are common and only a fetch finds them.',
            'backlinks',
            link.id
          )
        );
      }
    }

    if (link.state === 'expired' && check.http === 200) {
      out.push(
        item(
          'low',
          'Backlinks',
          `Expired link on ${name} is still live`,
          `${link.anchor} still returns 200 and nothing is earning on it.`,
          'Renew it or resell the slot.',
          'backlinks',
          link.id
        )
      );
    }
  }
}
function emailAttention(ctx, out) {
  const domains = listOf(ctx.data, 'email', 'domains');
  const mailboxes = listOf(ctx.data, 'email', 'mailboxes');
  const t = ctx.thresholds;

  for (const domain of domains) {
    const inUse = mailboxes.some((m) => m.domain_id === domain.id && m.state !== 'paused');
    if (!inUse) continue;

    const authGaps = ['spf', 'dkim', 'dmarc'].filter((k) => domain[k] !== 'pass');
    if (authGaps.length) {
      out.push(
        item(
          'high',
          'Email',
          `${domain.domain} sends without full authentication`,
          `Not passing: ${authGaps.map((k) => `${k.toUpperCase()} ${domain[k]}`).join(', ')}.`,
          'Fix DNS before sending again. Unauthenticated mail trains receivers to bin the whole domain.',
          'email',
          domain.id
        )
      );
    }

    if ((domain.blacklists || []).length) {
      out.push(
        item(
          'high',
          'Email',
          `${domain.domain} is on a blocklist`,
          `Listed on ${(domain.blacklists || []).join(', ')}.`,
          'Stop sending from it and start the delisting process. Warm a different domain meanwhile.',
          'email',
          domain.id
        )
      );
    }
  }

  for (const mb of mailboxes) {
    const domain = domains.find((d) => d.id === mb.domain_id) || {};
    const lastDay = Array.isArray(mb.sent_7d) && mb.sent_7d.length ? mb.sent_7d[mb.sent_7d.length - 1] : null;
    const breach = lastDay !== null && mb.daily_cap > 0 && lastDay > mb.daily_cap;

    if (mb.state === 'risky') {
      const bits = [];
      if (domain.dkim && domain.dkim !== 'pass') bits.push(`DKIM ${domain.dkim}`);
      if ((domain.blacklists || []).length) bits.push(`domain listed on ${domain.blacklists.join(', ')}`);
      if (mb.bounce_pct > t.bounce_fail_pct) bits.push(`bounce ${fmtPct(mb.bounce_pct, 1)}`);
      if (mb.complaint_pct > t.complaint_warn_pct) bits.push(`complaints ${fmtPct(mb.complaint_pct, 2)}`);
      if (breach) bits.push(`sent ${lastDay} against a cap of ${mb.daily_cap}`);
      out.push(
        item(
          'high',
          'Email',
          `${mb.address} is marked risky`,
          bits.join(', ') || mb.note || 'no detail recorded',
          'Pause it until the cause is fixed. Keep sending and the domain reputation goes with it.',
          'email',
          mb.id
        )
      );
      continue;
    }

    if (mb.state === 'paused') {
      out.push(
        item('low', 'Email', `${mb.address} is paused`, mb.note || 'Paused with no note.', 'Confirm whether that is intended.', 'email', mb.id)
      );
      continue;
    }

    if (mb.bounce_pct > t.bounce_warn_pct) {
      const severe = mb.bounce_pct > t.bounce_fail_pct;
      out.push(
        item(
          severe ? 'high' : 'medium',
          'Email',
          `${mb.address} bounces ${fmtPct(mb.bounce_pct, 1)}`,
          `${mb.sent_7d ? mb.sent_7d.join(', ') : 'no send history'} over the last seven days.`,
          severe
            ? 'Stop and clean the list. Above 5% the domain gets throttled.'
            : 'Clean the list before the rate climbs.',
          'email',
          mb.id
        )
      );
    }

    if (mb.complaint_pct > t.complaint_warn_pct) {
      out.push(
        item(
          'medium',
          'Email',
          `${mb.address} complaints at ${fmtPct(mb.complaint_pct, 2)}`,
          `Threshold is ${fmtPct(t.complaint_warn_pct, 2)}.`,
          'Tighten the targeting. Complaints are what turns a warm domain cold.',
          'email',
          mb.id
        )
      );
    }

    if (breach) {
      out.push(
        item(
          'medium',
          'Email',
          `${mb.address} went over its daily cap`,
          `Sent ${lastDay} against a cap of ${mb.daily_cap}.`,
          'Lower the cap. A warm-up that overshoots is a warm-up that failed.',
          'email',
          mb.id
        )
      );
    }
  }
}

function eeatAttention(ctx, out) {
  const eeat = ctx.data.eeat;
  if (!eeat || !eeat.entity) return;
  const entity = eeat.entity;
  const nap = entity.nap || {};
  const unclear = ['name', 'address', 'phone'].filter((k) => !nap[k] || /to be confirmed/i.test(String(nap[k])));

  if (unclear.length) {
    out.push(
      item(
        'high',
        'EEAT',
        'The business details are not filled in',
        `Missing: ${unclear.join(', ')}. ${entity.note || ''}`.trim(),
        'Fill the name, address and phone once, then every directory entry can be checked against it.',
        'eeat',
        'entity'
      )
    );
  }

  for (const entry of eeat.entries || []) {
    if (entry.state === 'mismatch') {
      out.push(
        item(
          'high',
          'EEAT',
          `A listing for ${siteName(ctx, entry.site_id)} does not match`,
          entry.note || 'Details differ from the record.',
          'Correct the listing and re-verify it. A wrong phone number is worse than no listing.',
          'eeat',
          entry.site_id
        )
      );
    }
  }

  const sources = eeat.sources || [];
  for (const site of ctx.sites) {
    if (site.status !== 'connected') continue;

    const rows = (eeat.entries || []).filter((e) => e.site_id === site.id);
    const verified = rows.filter((r) => r.state === 'verified').length;
    if (sources.length && verified / sources.length < 0.8) {
      out.push(
        item(
          'medium',
          'EEAT',
          `${site.name} has ${verified} of ${sources.length} citations verified`,
          rows
            .filter((r) => r.state !== 'verified')
            .map((r) => `${r.source_id}: ${r.state}`)
            .join(', '),
          'Work the missing ones by weight. Directory first, review platform last.',
          'eeat',
          site.id
        )
      );
    }

    const named = (eeat.authors || []).some((a) => (a.site_ids || []).includes(site.id) && a.bio_state === 'complete');
    if (!named) {
      out.push(
        item(
          'medium',
          'EEAT',
          `${site.name} publishes with no named author`,
          'No author record for this site has both credentials and a profile link.',
          'Add a real named author with credentials and a sameAs link. Cheapest trust signal available.',
          'eeat',
          site.id
        )
      );
    }
  }
}

function runAttention(ctx, out) {
  for (const run of ctx.runs) {
    const kind = run.kind || 'run';

    if (run.state === 'failed') {
      out.push(
        item(
          'high',
          'Runs',
          `The ${kind} on ${fmtDate(run.started)} failed`,
          `${(run.failed_steps || []).join(', ') || 'no step named'}. ${run.notes || ''}`.trim(),
          'Fix the failing step and run it again. Anything it was meant to check is still unchecked.',
          'runs',
          run.id
        )
      );
    } else if (run.state === 'incomplete') {
      out.push(
        item(
          'medium',
          'Runs',
          `The ${kind} on ${fmtDate(run.started)} did not finish`,
          `${(run.failed_steps || []).join(', ') || 'no step named'} were left unchecked and recorded as unknown.`,
          'Re-run the missing part. Unknown is not the same as fine.',
          'runs',
          run.id
        )
      );
    } else if (run.state === 'verification_expired') {
      out.push(
        item(
          'high',
          'Runs',
          `The ${kind} on ${fmtDate(run.started)} never wrote its record`,
          run.wrote_status
            ? 'The run claims to have written a record and there is not one.'
            : 'No completion record exists, so the run is treated as not having happened.',
          'Find out where it stopped before trusting anything that came after it.',
          'runs',
          run.id
        )
      );
    }
  }
}

function harnessAttention(ctx, out) {
  for (const worker of ctx.workers) {
    const reported = ageOf(worker.last_reported, ctx.now);

    if (worker.status === 'blocked') {
      out.push(
        item(
          'medium',
          'Harness',
          `${worker.id} is blocked`,
          worker.current_task || 'No task reported.',
          'Clear the blocker or move the work. A blocked lane produces nothing.',
          'harness',
          worker.id
        )
      );
    }

    if (worker.status === 'awaiting_review' && reported !== null && reported > 12 * 3600000) {
      out.push(
        item(
          'high',
          'Harness',
          `${worker.id} has been waiting ${fmtDuration(reported)} for a review`,
          worker.current_task || 'No task reported.',
          'Review it. The reviewer is the queue everything else waits behind.',
          'harness',
          worker.id
        )
      );
    }

    if (worker.status === 'offline' && reported !== null && reported > 24 * 3600000) {
      out.push(
        item(
          'medium',
          'Harness',
          `Nothing reported from ${worker.id} for ${fmtDuration(reported)}`,
          'This is the last report, not a sign of life. The window may be open and idle, or closed.',
          'Check whether its window is open. Nothing is delivered to a closed window.',
          'harness',
          worker.id
        )
      );
    }
  }
}

function engineAttention(ctx, out) {
  const control = ctx.data.control || {};
  if (control.refresh_enabled === false) {
    out.push(
      item(
        'low',
        'Harness',
        'The run button is switched off',
        control.reason || 'workflow-control.json says refresh_enabled is false.',
        'Nothing is on a clock yet. Expected while the harness is still being built.',
        'runs',
        'control'
      )
    );
  }
}

function dataAttention(ctx, out) {
  for (const name of ctx.dataFiles) {
    const dataset = ctx.data[name];
    if (!dataset) {
      out.push(
        item(
          'high',
          'Data',
          `data/${name}.json did not load`,
          'Anything that should have come from it is missing from this page, which is not the same as being zero.',
          'Find out why it did not load before reading anything here as complete.',
          'overview',
          name
        )
      );
      continue;
    }
    if (!dataset._meta || !dataset._meta.as_of) {
      out.push(
        item(
          'medium',
          'Data',
          `data/${name}.json has no as_of`,
          'A file with no timestamp cannot be aged, so nothing read from it can be called current.',
          'Make the job that writes the file stamp it.',
          'overview',
          name
        )
      );
      continue;
    }
    const band = freshness(dataset._meta.as_of, ctx.now);
    if (band.level === 'aging') {
      out.push(
        item('low', 'Data', `data/${name}.json is ${fmtDuration(band.ms)} old`, band.label, 'Run the job that writes it.', 'overview', name)
      );
    } else if (band.level === 'stale') {
      out.push(
        item(
          'medium',
          'Data',
          `data/${name}.json is ${fmtDuration(band.ms)} old`,
          'Every number on this page that came from that file is that old.',
          'Run the job that writes it, or read the number as history rather than as current.',
          'overview',
          name
        )
      );
    }
  }
}

const RULES = [
  siteAttention,
  contentAttention,
  linkAttention,
  emailAttention,
  eeatAttention,
  runAttention,
  harnessAttention,
  engineAttention,
  dataAttention
];

export function deriveAttention(data, options = {}) {
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...((data.content && data.content.thresholds) || {}),
    ...((data.backlinks && data.backlinks.thresholds) || {}),
    ...((data.email && data.email.thresholds) || {}),
    ...((data.runs && data.runs.thresholds) || {}),
    ...(options.thresholds || {})
  };
  const ctx = {
    now: options.now || Date.now(),
    thresholds,
    data,
    dataFiles: options.dataFiles || ['sites', 'content', 'backlinks', 'email', 'eeat', 'workers', 'runs'],
    sites: listOf(data, 'sites', 'sites'),
    content: listOf(data, 'content', 'pieces'),
    links: listOf(data, 'backlinks', 'placements'),
    workers: listOf(data, 'workers', 'workers'),
    runs: listOf(data, 'runs', 'runs')
  };
  const out = [];
  for (const rule of RULES) rule(ctx, out);
  out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.area.localeCompare(b.area));
  return out;
}

export function attentionCounts(items) {
  return {
    total: items.length,
    high: items.filter((i) => i.severity === 'high').length,
    medium: items.filter((i) => i.severity === 'medium').length,
    low: items.filter((i) => i.severity === 'low').length
  };
}

// ---------------------------------------------------------------------------
// The board: what is where, on the forward path and off it
// ---------------------------------------------------------------------------

export function pipelineBoard(pieces) {
  const byDate = (a, b) => String(b.updated || '').localeCompare(String(a.updated || ''));
  const columns = PIPELINE_FLOW.map((state) => ({
    state,
    info: stateInfo(state),
    items: pieces.filter((p) => p.state === state).sort(byDate)
  }));
  const exceptions = EXCEPTION_STATES.map((state) => ({
    state,
    info: stateInfo(state),
    items: pieces.filter((p) => p.state === state).sort(byDate)
  }));
  return { columns, exceptions };
}

// ---------------------------------------------------------------------------
// Summary numbers. Every one of these is a count of rows in a file, so it can
// be recomputed by hand from the JSON.
// ---------------------------------------------------------------------------

export function summarise(data, options = {}) {
  const now = options.now || Date.now();
  const sites = listOf(data, 'sites', 'sites');
  const pieces = listOf(data, 'content', 'pieces');
  const links = listOf(data, 'backlinks', 'placements');
  const email = data.email || {};
  const eeat = data.eeat || {};
  const workers = listOf(data, 'workers', 'workers');
  const runs = listOf(data, 'runs', 'runs');

  const published = pieces.filter((p) => p.state === 'published');
  const published30d = published.filter((p) => {
    const age = ageOf(p.published_at, now);
    return age !== null && age <= 30 * 86400000;
  });
  const inFlight = pieces.filter((p) => ['briefed', 'sourced', 'drafted', 'edited', 'approved', 'publishing'].includes(p.state));
  const mailboxes = Array.isArray(email.mailboxes) ? email.mailboxes : [];
  const activeMailboxes = mailboxes.filter((m) => m.state === 'active' || m.state === 'warming');
  const entries = Array.isArray(eeat.entries) ? eeat.entries : [];
  const verifiedCitations = entries.filter((e) => e.state === 'verified').length;
  const recentRuns = [...runs].sort((a, b) => String(b.started || '').localeCompare(String(a.started || '')));

  return {
    sites: {
      total: sites.length,
      connected: sites.filter((s) => s.status === 'connected').length,
      problems: sites.filter((s) => s.status !== 'connected').length,
      pagesIndexed: sites.reduce((n, s) => n + ((s.metrics && s.metrics.indexed_pages) || 0), 0),
      pagesPublished: sites.reduce((n, s) => n + ((s.content && s.content.published) || 0), 0)
    },
    content: {
      total: pieces.length,
      inFlight: inFlight.length,
      published: published.length,
      published30d: published30d.length,
      awaitingApproval: pieces.filter((p) => p.state === 'approved').length,
      exceptions: pieces.filter((p) => isException(p.state) && p.state !== 'abandoned').length,
      claimsSourced: pieces.reduce((n, p) => n + (p.claims_sourced || 0), 0),
      claimsTotal: pieces.reduce((n, p) => n + (p.claims_total || 0), 0)
    },
    links: {
      total: links.length,
      live: links.filter((l) => l.state === 'verified').length,
      listed: links.filter((l) => l.state === 'listed').length,
      placedUnverified: links.filter((l) => l.state === 'placed').length,
      lost: links.filter((l) => l.state === 'lost').length,
      expired: links.filter((l) => l.state === 'expired').length,
      listedValue: links.filter((l) => l.state === 'listed').reduce((n, l) => n + (l.price || 0), 0),
      liveValue: links.filter((l) => l.state === 'verified').reduce((n, l) => n + (l.price || 0), 0)
    },
    email: {
      domains: Array.isArray(email.domains) ? email.domains.length : 0,
      mailboxes: mailboxes.length,
      sending: activeMailboxes.length,
      risky: mailboxes.filter((m) => m.state === 'risky').length,
      avgBounce: mailboxes.length
        ? Math.round((mailboxes.reduce((n, m) => n + (m.bounce_pct || 0), 0) / mailboxes.length) * 100) / 100
        : null,
      sent7d: mailboxes.reduce((n, m) => n + (Array.isArray(m.sent_7d) ? m.sent_7d.reduce((a, b) => a + b, 0) : 0), 0)
    },
    eeat: {
      sources: Array.isArray(eeat.sources) ? eeat.sources.length : 0,
      verified: verifiedCitations,
      total: entries.length,
      coverage: entries.length ? Math.round((verifiedCitations / entries.length) * 1000) / 10 : 0,
      mismatches: entries.filter((e) => e.state === 'mismatch').length
    },
    harness: {
      workers: workers.length,
      working: workers.filter((w) => w.status === 'working').length,
      blocked: workers.filter((w) => w.status === 'blocked').length,
      awaitingReview: workers.filter((w) => w.status === 'awaiting_review').length,
      lastRun: recentRuns[0] || null,
      failedRuns: runs.filter((r) => r.state === 'failed' || r.state === 'verification_expired').length
    }
  };
}

// ---------------------------------------------------------------------------
// Citation matrix: one row per site, one column per citation source
// ---------------------------------------------------------------------------

export function citationMatrix(eeat, sites) {
  const sources = (eeat && eeat.sources) || [];
  const entries = (eeat && eeat.entries) || [];
  const find = (siteId, sourceId) => entries.find((e) => e.site_id === siteId && e.source_id === sourceId) || null;

  const rows = (sites || []).map((site) => {
    const cells = sources.map((source) => {
      const entry = find(site.id, source.id);
      return { source, entry, state: entry ? entry.state : 'missing' };
    });
    return {
      site,
      cells,
      verified: cells.filter((c) => c.state === 'verified').length,
      total: sources.length
    };
  });

  return { sources, rows };
}

// ---------------------------------------------------------------------------
// Validation: the page checks its own inputs before drawing anything
// ---------------------------------------------------------------------------

export const DATA_FILES = [
  { key: 'workspace', path: 'data/workspace.json' },
  { key: 'sites', path: 'data/sites.json' },
  { key: 'content', path: 'data/content.json' },
  { key: 'backlinks', path: 'data/backlinks.json' },
  { key: 'email', path: 'data/email.json' },
  { key: 'eeat', path: 'data/eeat.json' },
  { key: 'workers', path: 'data/workers.json' },
  { key: 'runs', path: 'data/runs.json' },
  { key: 'control', path: 'data/workflow-control.json' },
  { key: 'status', path: 'data/workflow-status.json' }
];

export const ENUMS = {
  siteStatus: ['connected', 'pending', 'error', 'paused'],
  checkState: ['pass', 'warn', 'fail', 'unknown'],
  linkState: ['listed', 'ordered', 'placed', 'verified', 'lost', 'expired', 'refunded'],
  mailboxState: ['warming', 'active', 'paused', 'risky'],
  citationState: ['verified', 'pending', 'missing', 'mismatch', 'rejected'],
  workerStatus: ['working', 'idle', 'blocked', 'awaiting_review', 'offline'],
  runState: ['success', 'failed', 'running', 'incomplete', 'verification_expired']
};

const SECRET_KEY = /(^|[_.\-\s])(api[_-]?key|apikey|secret|token|password|passwd|private[_-]?key|bearer)([_.\-\s]|$)/i;

export function findSecretKeys(node, path = '') {
  const found = [];
  if (!node || typeof node !== 'object') return found;
  for (const [k, v] of Object.entries(node)) {
    const next = path ? `${path}.${k}` : k;
    if (SECRET_KEY.test(k)) found.push(next);
    if (v && typeof v === 'object') found.push(...findSecretKeys(v, next));
  }
  return found;
}

export function validateData(data) {
  const errors = [];
  const add = (file, path, message) => errors.push({ file, path, message });
  const rows = (file, key, field) => {
    const set = data[key];
    if (!set) {
      add(file, '', 'file did not load, so nothing that depends on it can be drawn');
      return [];
    }
    const list = set[field];
    if (!Array.isArray(list)) {
      add(file, field, `expected an array at "${field}"`);
      return [];
    }
    const seen = new Set();
    for (const row of list) {
      if (!row || typeof row !== 'object') {
        add(file, field, 'a row is not an object');
        continue;
      }
      if (!row.id) {
        add(file, field, 'a row has no id');
        continue;
      }
      if (seen.has(row.id)) add(file, row.id, 'duplicate id');
      seen.add(row.id);
    }
    return list;
  };
  const enumOf = (file, list, field, allowed) => {
    for (const row of list) {
      if (row[field] === undefined || row[field] === null) continue;
      if (!allowed.includes(row[field])) add(file, `${row.id}.${field}`, `"${row[field]}" is not one of ${allowed.join(', ')}`);
    }
  };

  for (const entry of DATA_FILES) {
    const set = data[entry.key];
    if (!set) {
      add(entry.path, '', 'file missing');
      continue;
    }
    if (!set._meta || !set._meta.as_of) {
      add(entry.path, '_meta.as_of', 'a file with no as_of cannot be aged, so it cannot be trusted');
    } else if (Number.isNaN(Date.parse(set._meta.as_of))) {
      add(entry.path, '_meta.as_of', 'not a readable date');
    }
    for (const key of findSecretKeys(set)) add(entry.path, key, 'looks like a credential; data files are public and are served as written');
  }

  const sites = rows('data/sites.json', 'sites', 'sites');
  const siteIds = new Set(sites.map((s) => s.id));
  enumOf('data/sites.json', sites, 'status', ENUMS.siteStatus);
  for (const site of sites) {
    if (!site.domain) add('data/sites.json', `${site.id}.domain`, 'a site with no domain is not a site');
    if (!Array.isArray(site.checks)) {
      add('data/sites.json', `${site.id}.checks`, 'a site with no checks cannot be called connected');
    } else {
      enumOf('data/sites.json', site.checks, 'state', ENUMS.checkState);
    }
    if (site.status === 'connected' && !site.last_sync) add('data/sites.json', `${site.id}.last_sync`, 'connected with no sync time');
  }

  const pieces = rows('data/content.json', 'content', 'pieces');
  for (const piece of pieces) {
    if (!PIPELINE_STATES[piece.state]) add('data/content.json', `${piece.id}.state`, `"${piece.state}" is not a pipeline state`);
    if (!siteIds.has(piece.site_id)) add('data/content.json', `${piece.id}.site_id`, `"${piece.site_id}" is not a known site`);
    if ((piece.claims_sourced || 0) > (piece.claims_total || 0)) {
      add('data/content.json', `${piece.id}.claims_sourced`, 'more claims sourced than the piece has');
    }
    if (['edited', 'approved', 'publishing', 'published'].includes(piece.state) && !piece.ledger_id) {
      add('data/content.json', `${piece.id}.ledger_id`, `"${piece.state}" with no ledger`);
    }
    if (piece.state === 'published') {
      if (!piece.live_url) add('data/content.json', `${piece.id}.live_url`, 'published with no live URL');
      if (!piece.verified_at) add('data/content.json', `${piece.id}.verified_at`, 'published with no verification time');
      if (!piece.hash_sha256) add('data/content.json', `${piece.id}.hash_sha256`, 'published with no hash of the served page');
    }
    if (piece.state === 'draft_unlinked' && piece.ledger_id) {
      add('data/content.json', `${piece.id}.ledger_id`, 'marked unlinked but a ledger is named');
    }
  }

  const links = rows('data/backlinks.json', 'backlinks', 'placements');
  enumOf('data/backlinks.json', links, 'state', ENUMS.linkState);
  for (const link of links) {
    if (!siteIds.has(link.seller_site_id)) add('data/backlinks.json', `${link.id}.seller_site_id`, 'unknown site');
    if (!link.live_check || typeof link.live_check !== 'object') {
      add('data/backlinks.json', `${link.id}.live_check`, 'no live check block, so nothing was ever looked at');
    }
    if (link.state === 'verified' && !link.verified_at) add('data/backlinks.json', `${link.id}.verified_at`, 'verified with no check time');
    if (!['listed', 'ordered'].includes(link.state) && !link.placed_at) {
      add('data/backlinks.json', `${link.id}.placed_at`, `"${link.state}" with no placement date`);
    }
    if (link.state !== 'listed' && !link.buyer) add('data/backlinks.json', `${link.id}.buyer`, `"${link.state}" with no buyer`);
  }

  const domains = rows('data/email.json', 'email', 'domains');
  const domainIds = new Set(domains.map((d) => d.id));
  const mailboxes = rows('data/email.json', 'email', 'mailboxes');
  enumOf('data/email.json', mailboxes, 'state', ENUMS.mailboxState);
  for (const mb of mailboxes) {
    if (!domainIds.has(mb.domain_id)) add('data/email.json', `${mb.id}.domain_id`, 'unknown sending domain');
    if (!Array.isArray(mb.sent_7d) || mb.sent_7d.length !== 7) {
      add('data/email.json', `${mb.id}.sent_7d`, 'expected seven daily counts, oldest first');
    }
    if (typeof mb.bounce_pct !== 'number') add('data/email.json', `${mb.id}.bounce_pct`, 'bounce rate missing, so reputation cannot be judged');
    if (typeof mb.daily_cap !== 'number') add('data/email.json', `${mb.id}.daily_cap`, 'no cap, so nothing stops it');
    if (Array.isArray(mb.sent_7d) && mb.sent_7d.some((n) => n > mb.daily_cap)) {
      add('data/email.json', `${mb.id}.sent_7d`, 'a day above the cap');
    }
  }
  const mailboxIds = new Set(mailboxes.map((m) => m.id));
  const campaigns = rows('data/email.json', 'email', 'campaigns');
  for (const campaign of campaigns) {
    for (const id of campaign.mailbox_ids || []) {
      if (!mailboxIds.has(id)) add('data/email.json', `${campaign.id}.mailbox_ids`, `"${id}" is not a mailbox`);
    }
    if ((campaign.positive || 0) > (campaign.replies || 0)) {
      add('data/email.json', `${campaign.id}.positive`, 'more positive replies than replies');
    }
  }

  const sources = rows('data/eeat.json', 'eeat', 'sources');
  const sourceIds = new Set(sources.map((s) => s.id));
  if (!Array.isArray(data.eeat && data.eeat.entries)) add('data/eeat.json', 'entries', 'expected an array at "entries"');
  const entries = Array.isArray(data.eeat && data.eeat.entries) ? data.eeat.entries : [];
  const pairs = new Set();
  for (const entry of entries) {
    const key = `${entry.site_id}/${entry.source_id}`;
    if (!siteIds.has(entry.site_id)) add('data/eeat.json', key, 'unknown site');
    if (!sourceIds.has(entry.source_id)) add('data/eeat.json', key, 'unknown citation source');
    if (pairs.has(key)) add('data/eeat.json', key, 'two rows for one site and source');
    pairs.add(key);
    if (!ENUMS.citationState.includes(entry.state)) add('data/eeat.json', key, `"${entry.state}" is not a citation state`);
    if (entry.state === 'verified' && (!entry.url || !entry.verified_at)) {
      add('data/eeat.json', key, 'verified with no listing URL or no check time');
    }
  }
  const authors = rows('data/eeat.json', 'eeat', 'authors');
  for (const author of authors) {
    for (const id of author.site_ids || []) {
      if (!siteIds.has(id)) add('data/eeat.json', `${author.id}.site_ids`, `"${id}" is not a site`);
    }
    if (!['complete', 'partial', 'missing'].includes(author.bio_state)) {
      add('data/eeat.json', `${author.id}.bio_state`, `"${author.bio_state}" is not a bio state`);
    }
  }

  const workers = rows('data/workers.json', 'workers', 'workers');
  enumOf('data/workers.json', workers, 'status', ENUMS.workerStatus);
  for (const worker of workers) {
    if (!worker.last_reported) add('data/workers.json', `${worker.id}.last_reported`, 'no last report, so its state is a guess');
    else if (Number.isNaN(Date.parse(worker.last_reported))) add('data/workers.json', `${worker.id}.last_reported`, 'not a readable date');
    if (!worker.branch) add('data/workers.json', `${worker.id}.branch`, 'no branch, so its work cannot be found');
  }

  const runs = rows('data/runs.json', 'runs', 'runs');
  enumOf('data/runs.json', runs, 'state', ENUMS.runState);
  for (const run of runs) {
    if (['success', 'failed', 'incomplete'].includes(run.state) && !run.finished) {
      add('data/runs.json', `${run.id}.finished`, `"${run.state}" with no finish time`);
    }
    if (run.state === 'success' && run.wrote_status !== true) {
      add('data/runs.json', `${run.id}.wrote_status`, 'success without writing its own record');
    }
  }

  const control = data.control || {};
  if (typeof control.refresh_enabled !== 'boolean') add('data/workflow-control.json', 'refresh_enabled', 'must be true or false, so the page can say which');
  if (!Array.isArray(control.allowed_kinds)) add('data/workflow-control.json', 'allowed_kinds', 'no list of what may be run');
  if (!control.webhook_url) add('data/workflow-control.json', 'webhook_url', 'no endpoint, so the button has nowhere to send');

  const status = data.status || {};
  if (status.wrote_status !== true) add('data/workflow-status.json', 'wrote_status', 'this file only exists to be written by a finished run');
  if (!status.run_id) add('data/workflow-status.json', 'run_id', 'no run named, so nothing can be matched to it');
  if (status.finished_at && status.started_at && Date.parse(status.finished_at) < Date.parse(status.started_at)) {
    add('data/workflow-status.json', 'finished_at', 'finishes before it starts');
  }
  if (status.run_id && data.runs && Array.isArray(data.runs.runs) && !data.runs.runs.some((r) => r.id === status.run_id)) {
    add('data/workflow-status.json', 'run_id', `"${status.run_id}" appears in no run`);
  }

  const unique = [];
  const seen = new Set();
  for (const error of errors) {
    const key = `${error.file}|${error.path}|${error.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(error);
  }

  return { ok: unique.length === 0, errors: unique };
}
