// scripts/monitor-state.js
// Prints what is asking for a person, using the same rules as the page.
//
// This is the command a scheduled job can run after it has written new data: it
// reads the files, applies js/core.js, and says out loud what a person has to
// do. Nothing here writes, publishes or calls anything.
//
//   node scripts/monitor-state.js
//   node scripts/monitor-state.js --strict   (exit 1 when anything is high)
//   node scripts/monitor-state.js --json     (machine-readable, for a workflow)

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FILES, SEVERITY_LABEL, attentionCounts, deriveAttention, freshness, newestTimestamp } from '../js/core.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const asJson = args.has('--json');

const data = {};
const missing = [];
for (const { key, path: file } of DATA_FILES) {
  try {
    data[key] = JSON.parse(await readFile(path.join(ROOT, file), 'utf8'));
  } catch (error) {
    missing.push({ file, why: error.code === 'ENOENT' ? 'not there' : error.message });
  }
}

const now = Date.now();
const attention = deriveAttention(data, { now });
const counts = attentionCounts(attention);
const asOf = newestTimestamp(data);
const band = freshness(asOf, now);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        as_of: asOf,
        freshness: band.label,
        missing_files: missing,
        counts,
        items: attention
      },
      null,
      2
    )
  );
} else {
  console.log(`Files: ${band.label}${asOf ? ` (newest ${asOf})` : ''}`);
  if (missing.length) {
    console.log('');
    console.log(`${missing.length} of ${DATA_FILES.length} files could not be read:`);
    for (const entry of missing) console.log(`  ${entry.file} — ${entry.why}`);
  }
  console.log('');
  if (!attention.length) {
    console.log('Nothing is asking for a person.');
  } else {
    console.log(`${counts.total} item(s): ${counts.high} high, ${counts.medium} medium, ${counts.low} low.`);
    for (const severity of ['high', 'medium', 'low']) {
      const group = attention.filter((item) => item.severity === severity);
      if (!group.length) continue;
      console.log('');
      console.log(`${SEVERITY_LABEL[severity]}:`);
      for (const item of group) {
        console.log(`  - ${item.area}${item.ref ? ` ${item.ref}` : ''}: ${item.title}`);
        if (item.evidence) console.log(`    seen: ${item.evidence}`);
        if (item.action) console.log(`    do:   ${item.action}`);
      }
    }
  }
}

if (strict && counts.high > 0) {
  console.log('');
  console.log(`${counts.high} high item(s). Exiting 1 because --strict was asked for.`);
  process.exitCode = 1;
}
