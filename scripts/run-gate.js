// scripts/run-gate.js
// Decides whether a scheduled run may start, and afterwards whether it finished.
//
// The decision lives here rather than in the workflow file so it can be read and
// run on a laptop: a gate that only exists in YAML is a gate nobody has tested.
//
//   node scripts/run-gate.js
//   node scripts/run-gate.js --force --write-github-output
//   node scripts/run-gate.js --check-completion 2026-11-02T09:10:00Z
//
// The first two print KEY=value lines (for $GITHUB_OUTPUT) and always exit 0:
// "not allowed to run" is a result, not a failure. The third exits 1 when the
// run that was started did not leave a record, which is a failure.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : null;
};

const readJson = async (rel) => JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));
const control = await readJson('data/workflow-control.json');
const status = await readJson('data/workflow-status.json');

// A placeholder is not an engine. The angle brackets in the seed file are the
// whole reason this check exists.
const engineConnected = Boolean(control.webhook_url) && !control.webhook_url.includes('<');
const refreshEnabled = control.refresh_enabled === true;
const forced = flag('--force');
const dispatch = process.env.EVENT_NAME === 'workflow_dispatch' || flag('--dispatch');

// A manual run may ask for a dry run; a scheduled run takes the file's answer.
const askedDryRun = process.env.DRY_RUN === 'true' || flag('--dry-run');
const dryRun = dispatch ? askedDryRun : control.dry_run_only === true;

const asOf = status.finished_at || status.started_at || null;
const ageHours = asOf ? Math.round(((Date.now() - Date.parse(asOf)) / 3600000) * 10) / 10 : null;

let allowed = true;
let reason = 'the control file allows a run';

if (!engineConnected) {
  allowed = false;
  reason = `no engine is connected: ${control.webhook_url} is a placeholder, so there is nothing to start`;
} else if (!refreshEnabled && !forced) {
  allowed = false;
  reason = control.reason || 'the control file says refresh is off';
} else if (!refreshEnabled && forced) {
  reason = 'refresh is off in the control file, but this run was forced';
} else if (dryRun) {
  reason = 'allowed, as a dry run: it may report, and it may not write';
}

const lastRun = status.run_id ? `${status.run_id} (${status.result})` : 'no run recorded';

if (flag('--check-completion')) {
  const started = valueOf('--check-completion');
  console.log(`checking that the run started at ${started || '(nothing given)'} left a record`);
  console.log(`the record says: ${lastRun}, finished ${status.finished_at || 'never'}`);

  const problems = [];
  if (!started) problems.push('no start time was given, so nothing can be compared');
  if (!status.finished_at) problems.push('workflow-status.json has no finished_at, so the run did not finish');
  if (started && status.finished_at && Date.parse(status.finished_at) < Date.parse(started)) {
    problems.push(
      `the record is older than the run (${status.finished_at} < ${started}), so this run did not write it`
    );
  }
  if (status.result && status.result !== 'success') problems.push(`the run recorded itself as ${status.result}`);

  if (problems.length) {
    console.log('');
    console.log('The run did not finish. Treat it as not having happened:');
    for (const problem of problems) console.log(`  - ${problem}`);
    process.exit(1);
  }
  console.log('');
  console.log(`Finished. ${status.run_id} wrote its record at ${status.finished_at}.`);
  process.exit(0);
}

const lines = {
  allowed: String(allowed),
  dry_run: String(dryRun),
  refresh_enabled: String(refreshEnabled),
  engine_connected: String(engineConnected),
  forced: String(forced && !refreshEnabled),
  reason,
  last_run: lastRun,
  last_finished_at: status.finished_at || '',
  last_age_hours: ageHours === null ? '' : String(ageHours)
};

for (const [key, value] of Object.entries(lines)) console.log(`${key}=${value}`);
