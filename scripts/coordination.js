// scripts/coordination.js
// Checks that the register, the assignments, the submission template and the
// data files still agree with each other.
//
// None of these are things a test of the page can see: they are the rules the
// harness is run by. A broken register does not break the dashboard, it breaks
// the next run, which is worse because it happens later and quietly.
//
//   node scripts/coordination.js

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FILES } from '../js/core.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const REGISTER = 'docs/orchestration/projects.json';
const TEMPLATE = 'docs/orchestration/templates/submission.json';
const ASSIGNMENTS = 'docs/orchestration/assignments';

const results = [];
const check = async (name, run) => {
  try {
    const detail = await run();
    results.push({ name, ok: true });
    console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
  } catch (error) {
    results.push({ name, ok: false, why: error.message });
    console.log(`FAIL ${name}`);
    for (const line of String(error.message).split('\n')) console.log(`     ${line}`);
  }
};

const say = (condition, message) => {
  if (!condition) throw new Error(message);
};
const readText = (rel) => readFile(path.join(ROOT, rel), 'utf8');
const readJson = async (rel) => JSON.parse(await readText(rel));

let register = null;
let template = null;

await check('the register parses and carries a date', async () => {
  register = await readJson(REGISTER);
  say(register._meta && register._meta.as_of, 'the register needs _meta.as_of');
  say(Array.isArray(register.projects) && register.projects.length > 0, 'the register has no projects');
  say(Array.isArray(register.kinds) && register.kinds.length > 0, 'the register has no kinds');
  return `${register.projects.length} projects, ${register.kinds.length} kinds, as of ${register._meta.as_of}`;
});

await check('every project says who owns it, what it writes and when it is finished', async () => {
  const problems = [];
  for (const project of register.projects) {
    for (const field of ['id', 'name', 'kind', 'owner', 'writes', 'assignment', 'done_when', 'stops_when']) {
      if (!project[field]) problems.push(`${project.id || '(no id)'} has no ${field}`);
    }
    if (!register.kinds.includes(project.kind)) problems.push(`${project.id} has an unknown kind: ${project.kind}`);
    if (!Array.isArray(project.reads) || project.reads.length === 0) problems.push(`${project.id} does not say what it reads`);
  }
  say(problems.length === 0, problems.join('\n'));
});

await check('one writer per file, and every file it writes is a data file the page reads', async () => {
  const known = new Set(DATA_FILES.map((entry) => entry.path));
  const seen = new Map();
  for (const project of register.projects) {
    if (!known.has(project.writes)) throw new Error(`${project.id} writes ${project.writes}, which the page does not read`);
    if (seen.has(project.writes)) throw new Error(`${seen.get(project.writes)} and ${project.id} both write ${project.writes}`);
    seen.set(project.writes, project.id);
  }
  return `${seen.size} files, one owner each`;
});

await check('every assignment file exists and answers the five questions', async () => {
  const wanted = [
    [/^## What it is for/m, 'what it is for'],
    [/^## (What it )?Reads/m, 'what it reads'],
    [/^## Writes/m, 'what it writes'],
    [/^## Finished when/m, 'when it is finished'],
    [/^## Stop and ask when/m, 'when to stop and ask']
  ];
  const problems = [];
  for (const project of register.projects) {
    let text = '';
    try {
      text = await readText(project.assignment);
    } catch {
      problems.push(`${project.assignment} is not there`);
      continue;
    }
    for (const [pattern, label] of wanted) {
      if (!pattern.test(text)) problems.push(`${project.assignment} does not say ${label}`);
    }
  }
  say(problems.length === 0, problems.join('\n'));
  return `${register.projects.length} assignments`;
});

await check('no assignment is orphaned and none is missing from the register', async () => {
  const files = (await readdir(path.join(ROOT, ASSIGNMENTS))).filter((name) => name.endsWith('.md'));
  const named = new Set(register.projects.map((project) => path.basename(project.assignment)));
  const orphans = files.filter((name) => !named.has(name));
  const absent = [...named].filter((name) => !files.includes(name));
  say(orphans.length === 0, `these assignments belong to no project: ${orphans.join(', ')}`);
  say(absent.length === 0, `these assignments are listed but not written: ${absent.join(', ')}`);
  return `${files.length} files`;
});

await check('the submission template has the shape a submission must have', async () => {
  template = await readJson(TEMPLATE);
  for (const field of ['kind', 'run_id', 'project', 'as_of', 'result', 'evidence', 'changed', 'unknowns']) {
    say(template[field] !== undefined, `the template has no ${field}`);
  }
  say(register.kinds.includes(template.kind), `the template uses an unknown kind: ${template.kind}`);
  say(/^run-\d{4}-\d{2}-\d{2}-[a-z]$/.test(template.run_id), `the template run id does not look like a run id: ${template.run_id}`);
  say(Array.isArray(template.unknowns), 'unknowns must be a list, even when it is empty');
  for (const entry of template.evidence) {
    for (const field of ['ref', 'claim', 'measured', 'saw', 'at']) {
      say(entry[field], `an evidence entry has no ${field}`);
    }
  }
  return `${template.evidence.length} evidence entries, ${template.unknowns.length} unknowns`;
});

await check('the template is an example, not a result', async () => {
  say(/template/i.test((template._meta && template._meta.source) || ''), 'the template should say it is a template');
  say(
    template.result !== 'success' || template.unknowns.length > 0,
    'a submission with no unknowns and a success result is usually a guess'
  );
  return `result: ${template.result}`;
});

await check('every owner in the register is a worker in the data', async () => {
  const workers = await readJson('data/workers.json');
  const ids = new Set((workers.workers || []).map((worker) => worker.id));
  const strangers = register.projects.map((project) => project.owner).filter((owner) => !ids.has(owner));
  say(strangers.length === 0, `these owners are not workers: ${[...new Set(strangers)].join(', ')}`);
  return `${ids.size} workers`;
});

await check('every file the register calls published is there', async () => {
  const missing = [];
  for (const file of register.rules.published_files) {
    try {
      await readText(file);
    } catch {
      missing.push(file);
    }
  }
  say(missing.length === 0, `published but not there: ${missing.join(', ')}`);
  return `${register.rules.published_files.length} files`;
});

const failed = results.filter((entry) => !entry.ok);
console.log('');
console.log(`${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) {
  console.log('');
  console.log('The harness would not hold together as written:');
  for (const entry of failed) console.log(`  - ${entry.name}`);
  process.exitCode = 1;
}
