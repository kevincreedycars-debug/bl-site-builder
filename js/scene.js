// js/scene.js
// The map's own rules: which objects exist, where each one sits, and what each
// one is allowed to claim.
//
// No three.js, no DOM, no clock of its own. The same numbers the canvas draws
// are the numbers this file returns, which is what lets tests/ check the map
// without a browser and without a graphics card.
//
// Rules kept here:
//   1. Every object names the file it came from.
//   2. A number a file does not carry stays null and is written as "not
//      recorded". It is never drawn as zero and never borrowed from a neighbour.
//   3. Only size, height and colour carry a meaning, and every meaning is
//      written down in `encoding`. Distance from the centre is layout.

import {
  SEVERITY_RANK,
  ageOf,
  citationMatrix,
  fmtAge,
  fmtDate,
  fmtMoney,
  fmtNumber,
  fmtPct,
  nodeTone
} from './core.js';

// ---------------------------------------------------------------------------
// What can be switched off, and what it is made of
// ---------------------------------------------------------------------------

export const MAP_LAYERS = [
  { id: 'sites', label: 'Sites', note: 'One sphere per site in data/sites.json', on: true },
  { id: 'citations', label: 'Citations', note: 'One tick per site and source in data/eeat.json', on: true },
  { id: 'links', label: 'Links', note: 'One bead per placement in data/backlinks.json', on: true },
  { id: 'email', label: 'Email', note: 'Sending domains and mailboxes in data/email.json', on: true },
  { id: 'workers', label: 'Workers', note: 'One node per lane in data/workers.json', on: true },
  { id: 'edges', label: 'Connectors', note: 'The lines between all of the above', on: true }
];

export const MAP_LAYOUT = {
  hubRadius: 1.15,
  siteRing: 9.6,
  workerRing: 5.8,
  domainRing: 3.6,
  workerHeight: 3.7,
  domainHeight: -1.7,
  citationOrbit: 1,
  linkOrbit: 2.15,
  mailboxOrbit: 1.55
};

const SOURCE = {
  hub: 'data/workspace.json',
  site: 'data/sites.json',
  citation: 'data/eeat.json',
  link: 'data/backlinks.json',
  domain: 'data/email.json',
  mailbox: 'data/email.json',
  worker: 'data/workers.json'
};

// ---------------------------------------------------------------------------
// Small helpers. Positions are rounded so two of them can be compared.
// ---------------------------------------------------------------------------

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const round = (value) => Math.round(value * 1000) / 1000;
const at = (x, y, z) => ({ x: round(x), y: round(y), z: round(z) });

// A point on a ring seen from above, unless the caller gives a height.
function ring(index, count, radius, y = 0, phase = 0) {
  const angle = phase + (count > 0 ? (index / count) * Math.PI * 2 : 0);
  return at(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

// A point on a tilted ring around another point. `slope` squeezes the ring
// against the flat so it still reads as a ring from a low camera.
function orbit(centre, index, count, radius, slope = 0.45, phase = 0) {
  const angle = phase + (count > 0 ? (index / count) * Math.PI * 2 : 0);
  return at(
    centre.x + Math.cos(angle) * radius,
    centre.y + Math.sin(angle) * radius * slope,
    centre.z + Math.sin(angle) * radius
  );
}

function worst(items) {
  let out = null;
  for (const entry of items) {
    if (!entry || !entry.severity) continue;
    if (!out || (SEVERITY_RANK[entry.severity] ?? 9) < (SEVERITY_RANK[out] ?? 9)) out = entry.severity;
  }
  return out;
}

// Written the way the rest of the page writes links: no protocol unless the
// protocol is the thing being said.
const bare = (url) => String(url || '').replace(/^https?:\/\//, '');

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export function buildPortfolioScene(data, options = {}) {
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const attention = Array.isArray(options.attention) ? options.attention : [];
  const source = data || {};
  const missing = [];
  const nodes = [];
  const edges = [];

  const set = (key) => (source[key] && typeof source[key] === 'object' ? source[key] : null);
  const files = [
    ['workspace', 'data/workspace.json'],
    ['sites', 'data/sites.json'],
    ['content', 'data/content.json'],
    ['backlinks', 'data/backlinks.json'],
    ['email', 'data/email.json'],
    ['eeat', 'data/eeat.json'],
    ['workers', 'data/workers.json']
  ];
  for (const [key, path] of files) {
    if (!set(key)) missing.push(`${path} did not load, so nothing that comes from it is on the map.`);
  }

  const workspace = (set('workspace') && set('workspace').workspace) || {};
  const sites = set('sites') && Array.isArray(set('sites').sites) ? set('sites').sites : [];
  const pieces = set('content') && Array.isArray(set('content').pieces) ? set('content').pieces : [];
  const placements = set('backlinks') && Array.isArray(set('backlinks').placements) ? set('backlinks').placements : [];
  const email = set('email') || {};
  const domains = Array.isArray(email.domains) ? email.domains : [];
  const mailboxes = Array.isArray(email.mailboxes) ? email.mailboxes : [];
  const eeat = set('eeat') || {};
  const sources = Array.isArray(eeat.sources) ? eeat.sources : [];
  const workers = set('workers') && Array.isArray(set('workers').workers) ? set('workers').workers : [];
  const modules = set('workspace') && Array.isArray(set('workspace').modules) ? set('workspace').modules : [];
  const currency = workspace.currency || 'USD';

  const attentionFor = (ref) =>
    attention
      .filter((entry) => entry && ref && entry.ref === ref)
      .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));

  const add = (node) => {
    const mine = attentionFor(node.ref);
    const severity = worst(mine);
    const built = {
      ...node,
      facts: node.facts || [],
      attention: mine,
      severity,
      pulse: severity === 'high',
      showLabel: node.showLabel !== false
    };
    nodes.push(built);
    return built;
  };

  const connect = (from, to, kind, tone = 'muted') => {
    const id = `${from}->${to}`;
    if (!edges.some((edge) => edge.id === id)) edges.push({ id, from, to, kind, tone });
  };

  // -- the centre ----------------------------------------------------------
  const hub = add({
    id: 'hub:studio',
    kind: 'hub',
    layer: 'hub',
    label: workspace.name || 'This portfolio',
    sublabel: workspace.tagline || 'Site portfolio, content pipeline and link inventory',
    tone: 'accent',
    radius: MAP_LAYOUT.hubRadius,
    position: at(0, 0, 0),
    ref: null,
    source: SOURCE.hub,
    showLabel: true,
    facts: [
      { label: 'Workspace', value: workspace.id || 'not recorded' },
      {
        label: 'Modules',
        // A file that did not load is not a file with nothing in it.
        value: set('workspace') ? (modules.length ? `${modules.length} recorded` : 'none recorded') : 'not recorded'
      },
      { label: 'Timezone', value: workspace.timezone || 'not recorded' },
      { label: 'Money', value: currency }
    ]
  });


  // -- sites ---------------------------------------------------------------
  // One row per site, one column per citation source. Coverage is the height.
  const matrix = citationMatrix(eeat, sites);
  const siteNodes = [];

  sites.forEach((site, index) => {
    const base = ring(index, sites.length, MAP_LAYOUT.siteRing, 0);
    const row = matrix.rows.find((entry) => entry.site.id === site.id) || null;
    const verified = row ? row.verified : 0;
    const coverage = sources.length ? verified / sources.length : null;
    // Height is coverage. Level means there was nothing to be covered by, and
    // the legend says so rather than implying a middling score.
    const y = base.y + (coverage === null ? 0 : (coverage - 0.5) * 5);

    const published = num(site.content && site.content.published);
    const live = num(site.links && site.links.live);
    const placed = num(site.links && site.links.placed);
    const listed = num(site.links && site.links.listed);
    const median = num(site.links && site.links.median_price);
    const dr = num(site.metrics && site.metrics.dr);
    const latency = num(site.wordpress && site.wordpress.rest_latency_ms);
    const checks = Array.isArray(site.checks) ? site.checks : [];
    const failed = checks.filter((check) => check.state === 'fail');

    const node = add({
      id: `site:${site.id}`,
      kind: 'site',
      layer: 'sites',
      label: site.name || site.id,
      sublabel: site.domain || 'no domain',
      tone: nodeTone('site', site.status),
      // Size is pages published. No count in the file means the smallest
      // sphere, and the panel says the count is missing rather than zero.
      radius: published === null ? 0.55 : round(0.55 + Math.sqrt(published) * 0.055),
      position: at(base.x, y, base.z),
      ref: site.id,
      source: SOURCE.site,
      showLabel: true,
      facts: [
        { label: 'State', value: site.status || 'not recorded' },
        { label: 'Pages published', value: published === null ? 'not recorded' : fmtNumber(published) },
        { label: 'Links live', value: live === null || placed === null ? 'not recorded' : `${fmtNumber(live)} of ${fmtNumber(placed)} placed` },
        { label: 'For sale', value: listed === null ? 'not recorded' : `${fmtNumber(listed)} listed at ${fmtMoney(median, currency)} median` },
        { label: 'Authority', value: dr === null ? 'not recorded' : `DR ${fmtNumber(dr)}` },
        { label: 'REST latency', value: latency === null ? 'not recorded' : `${fmtNumber(latency)} ms` },
        { label: 'Citations', value: sources.length ? `${verified} of ${sources.length} verified` : 'no sources loaded' },
        { label: 'Last sync', value: site.last_sync ? `${fmtAge(ageOf(site.last_sync, now))} (${fmtDate(site.last_sync)})` : 'never' },
        { label: 'Rows in the content file', value: set('content') ? fmtNumber(pieces.filter((piece) => piece.site_id === site.id).length) : 'not recorded' }
      ]
    });

    // A failed check is the sentence a person can act on, so it is kept whole
    // rather than summarised into a count of failures.
    if (failed.length) {
      node.facts.push({
        label: 'What failed',
        value: failed.map((check) => `${check.label}: ${check.detail}`).join(' · ')
      });
    }

    siteNodes.push({ site, node, position: node.position, row });
    connect(hub.id, node.id, 'owns');
  });

  // -- citations: one tick per site and source ----------------------------
  // The ticks sit on a ring around their site, so a gap in the ring is a
  // source that has not been confirmed. The state word is in the panel.
  for (const entry of siteNodes) {
    const cells = entry.row ? entry.row.cells : [];
    sources.forEach((listed, index) => {
      const cell = cells.find((found) => found.source.id === listed.id) || null;
      const state = cell ? cell.state : 'missing';
      const proof = cell && cell.entry ? cell.entry : null;
      const tick = add({
        id: `cite:${entry.site.id}:${listed.id}`,
        kind: 'citation',
        layer: 'citations',
        label: listed.name || listed.id,
        sublabel: `${entry.site.name || entry.site.id} · ${state}`,
        tone: nodeTone('citation', state),
        radius: 0.11,
        position: orbit(
          entry.node.position,
          index,
          sources.length,
          entry.node.radius + MAP_LAYOUT.citationOrbit,
          0.5
        ),
        ref: entry.site.id,
        source: SOURCE.citation,
        showLabel: false,
        facts: [
          { label: 'Site', value: entry.site.name || entry.site.id },
          { label: 'Source', value: listed.name || listed.id },
          { label: 'State', value: state },
          { label: 'Listing', value: proof && proof.url ? bare(proof.url) : 'no url recorded' },
          { label: 'Last checked', value: proof && proof.verified_at ? `${fmtAge(ageOf(proof.verified_at, now))} (${fmtDate(proof.verified_at)})` : 'never checked' },
          { label: 'What the source wants', value: listed.requires || 'nothing recorded' }
        ]
      });
      // A site's citation item is carried by every tick on its ring, but only
      // the ticks that are not confirmed throb: a passing check is not news.
      if (tick.pulse && state === 'verified') tick.pulse = false;
    });
  }

  // -- links: one bead per placement --------------------------------------
  const bySeller = new Map();
  for (const placement of placements) {
    const key = placement.seller_site_id || 'unknown';
    if (!bySeller.has(key)) bySeller.set(key, []);
    bySeller.get(key).push(placement);
  }

  for (const [sellerId, list] of bySeller) {
    const seller = siteNodes.find((entry) => entry.site.id === sellerId) || null;
    if (!seller) {
      // A placement naming a site nobody has heard of is not drawn, and the
      // reason is said out loud instead of being dropped quietly.
      missing.push(`${list.length} placement rows name "${sellerId}", which is not a site in data/sites.json, so they are not on the map.`);
      continue;
    }
    list.forEach((placement, index) => {
      const price = num(placement.price);
      const check = placement.live_check && typeof placement.live_check === 'object' ? placement.live_check : {};
      const bead = add({
        id: `link:${placement.id}`,
        kind: 'link',
        layer: 'links',
        label: placement.anchor || placement.id,
        sublabel: `${seller.site.name || sellerId} · ${placement.state || 'state not recorded'}`,
        tone: nodeTone('link', placement.state),
        radius: price === null ? 0.1 : round(0.1 + Math.min(0.16, price / 1400)),
        position: orbit(seller.node.position, index, list.length, seller.node.radius + MAP_LAYOUT.linkOrbit, 0.25, 0.4),
        ref: placement.id,
        source: SOURCE.link,
        showLabel: false,
        facts: [
          { label: 'Anchor', value: placement.anchor || 'not recorded' },
          { label: 'Points at', value: bare(placement.target_url) || 'not recorded' },
          { label: 'Sold to', value: placement.buyer || 'not recorded' },
          { label: 'Price', value: price === null ? 'not recorded' : fmtMoney(price, currency) },
          { label: 'State', value: placement.state || 'not recorded' },
          { label: 'Placed', value: placement.placed_at ? fmtDate(placement.placed_at) : 'not recorded' },
          { label: 'Last check', value: num(check.http) === null ? 'never checked' : `HTTP ${check.http}, ${fmtAge(ageOf(check.at, now))}` },
          { label: 'Indexed', value: placement.index_status || 'not recorded' }
        ]
      });
      connect(seller.node.id, bead.id, 'sells', bead.tone);
    });
  }


  // -- email: the sending domains, then the mailboxes hanging off them -----
  const domainPositions = new Map();
  domains.forEach((domain, index) => {
    const position = ring(index, domains.length, MAP_LAYOUT.domainRing, MAP_LAYOUT.domainHeight, Math.PI / 6);
    domainPositions.set(domain.id, position);
    const listedOn = Array.isArray(domain.blacklists) ? domain.blacklists : [];
    const mine = mailboxes.filter((mailbox) => mailbox.domain_id === domain.id);
    add({
      id: `domain:${domain.id}`,
      kind: 'domain',
      layer: 'email',
      label: domain.domain || domain.id,
      sublabel: `${domain.provider || 'provider not recorded'} · ${mine.length} mailbox${mine.length === 1 ? '' : 'es'}`,
      tone: nodeTone('domain', listedOn.length ? 'listed' : 'clean'),
      radius: 0.34,
      position,
      ref: domain.id,
      source: SOURCE.domain,
      showLabel: true,
      facts: [
        { label: 'Provider', value: domain.provider || 'not recorded' },
        { label: 'SPF', value: domain.spf || 'not recorded' },
        { label: 'DKIM', value: domain.dkim || 'not recorded' },
        { label: 'DMARC', value: `${domain.dmarc_policy || 'no policy'} (${domain.dmarc || 'not recorded'})` },
        { label: 'Blacklists', value: listedOn.length ? listedOn.join(', ') : 'none recorded' },
        { label: 'Mailboxes', value: `${mine.length}` }
      ]
    });
    connect(hub.id, `domain:${domain.id}`, 'sends');
  });

  for (const entry of siteNodes) {
    const domainId = entry.site.email && entry.site.email.domain_id;
    if (domainId && domainPositions.has(domainId)) {
      connect(entry.node.id, `domain:${domainId}`, 'sends');
    } else if (domainId) {
      missing.push(`${entry.site.name || entry.site.id} names the sending domain "${domainId}", which is not in data/email.json.`);
    }
  }

  mailboxes.forEach((mailbox, index) => {
    const home = domainPositions.get(mailbox.domain_id) || null;
    const siblings = mailboxes.filter((other) => other.domain_id === mailbox.domain_id);
    const slot = siblings.indexOf(mailbox);
    const sent = Array.isArray(mailbox.sent_7d) ? mailbox.sent_7d.filter((value) => typeof value === 'number') : [];
    const today = sent.length ? sent[sent.length - 1] : null;
    const cap = num(mailbox.daily_cap);
    const bounce = num(mailbox.bounce_pct);
    const complaints = num(mailbox.complaint_pct);
    const warmDay = num(mailbox.warm_day);
    const warmTarget = num(mailbox.warm_target);
    const node = add({
      id: `mailbox:${mailbox.id}`,
      kind: 'mailbox',
      layer: 'email',
      label: mailbox.address || mailbox.id,
      sublabel: `${mailbox.state || 'state not recorded'} · ${mailbox.purpose || 'purpose not recorded'}`,
      tone: nodeTone('mailbox', mailbox.state),
      radius: 0.18,
      // A mailbox with no domain in the file is still drawn, further out, so
      // it is visible as the loose end it is.
      position: home
        ? orbit(home, slot < 0 ? index : slot, Math.max(1, siblings.length), MAP_LAYOUT.mailboxOrbit, 0.4)
        : ring(index, Math.max(1, mailboxes.length), MAP_LAYOUT.domainRing + 2.4, MAP_LAYOUT.domainHeight - 1.2),
      ref: mailbox.id,
      source: SOURCE.mailbox,
      showLabel: false,
      facts: [
        { label: 'Address', value: mailbox.address || 'not recorded' },
        { label: 'Sending domain', value: mailbox.domain_id || 'not recorded' },
        { label: 'State', value: mailbox.state || 'not recorded' },
        { label: 'Warm-up', value: warmDay === null || warmTarget === null ? 'not recorded' : `day ${warmDay} of ${warmTarget}` },
        { label: 'Today against cap', value: today === null || cap === null ? 'not recorded' : `${fmtNumber(today)} of ${fmtNumber(cap)}` },
        {
          label: 'Sent in 7 days',
          value: !Array.isArray(mailbox.sent_7d) ? 'not recorded' : sent.length ? fmtNumber(sent.reduce((total, value) => total + value, 0)) : 'no history'
        },
        { label: 'Bounce', value: bounce === null ? 'not recorded' : fmtPct(bounce, 2) },
        { label: 'Complaints', value: complaints === null ? 'not recorded' : fmtPct(complaints, 2) },
        { label: 'Last sent', value: mailbox.last_sent ? `${fmtAge(ageOf(mailbox.last_sent, now))} (${fmtDate(mailbox.last_sent)})` : 'never' }
      ]
    });
    if (home) {
      connect(`domain:${mailbox.domain_id}`, node.id, 'sends');
    } else if (mailbox.domain_id) {
      missing.push(`Mailbox ${mailbox.id} names the sending domain "${mailbox.domain_id}", which is not in data/email.json.`);
    }
  });


  // -- workers: what each lane last reported ------------------------------
  workers.forEach((worker, index) => {
    const reported = ageOf(worker.last_reported, now);
    const openQuestions = num(worker.open_questions);
    const node = add({
      id: `worker:${worker.id}`,
      kind: 'worker',
      layer: 'workers',
      label: worker.id,
      sublabel: worker.role || 'role not recorded',
      tone: nodeTone('worker', worker.status),
      radius: 0.26,
      position: ring(index, workers.length, MAP_LAYOUT.workerRing, MAP_LAYOUT.workerHeight, Math.PI / 6),
      ref: worker.id,
      source: SOURCE.worker,
      showLabel: true,
      facts: [
        { label: 'Role', value: worker.role || 'not recorded' },
        { label: 'Status', value: worker.status || 'not recorded' },
        // "Last reported" is the honest wording. A window cannot be seen from
        // a file, only the time a file was written.
        { label: 'Last reported', value: reported === null ? 'never reported' : `${fmtAge(reported)} (${fmtDate(worker.last_reported)})` },
        { label: 'Doing', value: worker.current_task || 'nothing reported' },
        { label: 'Branch', value: worker.branch || 'not recorded' },
        { label: 'Open questions', value: openQuestions === null ? 'not recorded' : fmtNumber(openQuestions) }
      ]
    });
    connect(hub.id, node.id, 'runs');
  });

  // -- what the map can and cannot draw ----------------------------------
  const seen = new Set(nodes.map((node) => node.id));
  const drawn = edges.filter((edge) => seen.has(edge.from) && seen.has(edge.to));

  const counts = {
    sites: nodes.filter((node) => node.kind === 'site').length,
    citations: nodes.filter((node) => node.kind === 'citation').length,
    links: nodes.filter((node) => node.kind === 'link').length,
    domains: nodes.filter((node) => node.kind === 'domain').length,
    mailboxes: nodes.filter((node) => node.kind === 'mailbox').length,
    workers: nodes.filter((node) => node.kind === 'worker').length,
    edges: drawn.length
  };

  const layerCount = (id) =>
    id === 'email' ? counts.domains + counts.mailboxes : counts[id] === undefined ? null : counts[id];

  return {
    hub,
    nodes,
    edges: drawn,
    layers: MAP_LAYERS.map((layer) => ({ ...layer, count: layerCount(layer.id) })),
    layout: MAP_LAYOUT,
    counts,
    missing,
    // The marks the canvas uses, and what each one is allowed to mean.
    encoding: [
      {
        mark: 'Size',
        means: 'pages published',
        detail: 'A site whose file carries no count keeps the smallest sphere and says "not recorded". It is never read as zero.'
      },
      {
        mark: 'Height',
        means: 'citation coverage',
        detail: sources.length
          ? `Verified citations as a share of the ${sources.length} sources in data/eeat.json. Higher is better covered.`
          : 'No citation sources loaded, so every site sits on one level and the height means nothing today.'
      },
      {
        mark: 'Colour',
        means: 'the state the file records',
        detail: 'Painted by nodeTone in js/core.js: green passed, amber is waiting, red failed or was never confirmed, grey is not in play, dotted is not recognised.'
      },
      {
        mark: 'Pulse',
        means: 'something is asking for a person today',
        detail: 'A high-severity item from deriveAttention. Its evidence and next act are in the panel beside the canvas.'
      },
      {
        mark: 'Distance',
        means: 'layout only',
        detail: 'How far an object sits from the centre is how the picture was arranged. Nothing is encoded in it.'
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// The graph, said in words, for a reader who has no canvas
// ---------------------------------------------------------------------------

export function describeScene(model) {
  if (!model || !model.counts) return 'The map has not been built.';
  const { counts } = model;
  const parts = [
    `${counts.sites} sites`,
    `${counts.links} links`,
    `${counts.citations} citation cells`,
    `${counts.domains} sending domains`,
    `${counts.mailboxes} mailboxes`,
    `${counts.workers} lanes`
  ];
  return `${parts.join(', ')}, joined by ${counts.edges} connectors.`;
}

