# Project brief: how this was built, and what to copy for a content project

Written 2026-11-02 by worker `strategy` (`strategy-advisory-001`) at the user's request, verbatim: *"can you give me a
project brief that explains how we have built this dashboard, connected everything through github, created the live
site, the n8n workflows etc. I am building a non trading project that builds content for websites but need to first
build the harness - also mention how we build the harness and how I like to be spoken too with simple responses and
questions"*.

This is advice, not authority. Nothing here changes an assignment, a workflow, a page or a rule. Where I quote a
number it carries the source I read it from, and where I did not verify something today I say so.

> **Filed 2 November 2026 by the coordinator, with the words below unchanged.** Authority stays with the owner. Four
> of its measurements are of the older trading repository, not of these files, so they are not numbers to compare
> against: page sizes (463, 8,978 and 20,229 lines, against 65, 731 and 1,326 here), twenty-one registered workers
> (five projects are registered here), sixteen workflow exports (the export folder here is empty) and a live address
> (this folder has no published URL yet). The harness script sizes it quotes, 139 and 156 lines, are also that
> checkout's; here they are 148 and 76. Parts 6 to 9 are the part written for a project like this one, and several of
> its pieces already exist here: the reply style, the register, five assignments, the clock in GitHub Actions, and a
> strategy that already refuses a draft with no ledger.

---

## How to read this

- Parts 1 to 4 describe what exists: the layers in the order they were built, how the pieces connect, how the live site
  is changed, and the workflows in more detail.
- Part 5 is the harness. That is the part the content project needs, and the part that took the longest here.
- Part 6 maps every harness piece onto a content project, so you can see what to rename and what to leave behind.
- Part 7 records how you have asked to be spoken to. It is a rule file, not a preference note, because it has been
  changed twice and broken twice.
- Part 8 is the list of things that went wrong, because that is the cheapest part to inherit.
- Part 9 is what I would need from you to go further.

## The short version

A static site with no build step, served free by GitHub from `main`, showing data that a workflow writes back into the
same repository. One execution engine (n8n) does the fetching, the thinking and the writing. GitHub is the memory, the
history, the publish mechanism and, since later, the clock. The AI work is organised the way a small studio would
organise it: one coordinator, one desk per worker, a written boundary per desk, a mailbox instead of chat, and a
reviewer who is never the author.

It works because four things are true, and every other rule exists to keep them true:

1. **Nothing is true because a worker said so.** The files are the evidence, and the reviewer reads the files.
2. **Nothing is live because it was merged.** The published bytes are the proof, checked by fetching them.
3. **Nothing is finished until someone other than the author checked it.** Review is a separate session from
   authorship, by rule.
4. **Nothing is changed on a hunch.** A change has to name its evidence, its size of improvement and whether it holds
   over years.

The content project needs the same four rules with different nouns. "Indexed", "converting" and "on brand" instead of
"directional", "profitable" and "validated".

## Part 1 - What was actually built, in layers

### Layer 0: a repository used as memory

The repository is not only code. It carries the project's state, decisions, history and its own instructions for the
next AI session:

- `docs/CURRENT_STATE.md` - what is true today, newest entry first, dated, with the previous objective kept underneath.
  It is long on purpose: it is the audit trail, not a summary.
- `docs/CURRENT_TASK.md` and `docs/ACTIVE_MILESTONE.md` - one immediate task, one active milestone, no more.
- `docs/DECISIONS.md` plus `docs/orchestration/DECISIONS.md` - settled choices and unresolved dependencies.
- `docs/CHANGELOG.md` - what was completed, with detail.
- `docs/SESSION_NOTES.md` - what happened, dated, including what failed.
- `AGENTS.md`, `CODEX_STARTUP.md`, `CODEX.md` - the startup instructions a new session reads before touching anything,
  including the reply format.

Measured on 2026-11-02, and worth keeping because it is the same trap as the data: the working copies of those three
files in the canonical checkout are 530 KB, 435 KB and 590 KB, while the copies published on `main` are 33 KB, 79 KB
and 45 KB. Even the memory files are local-first and published in batches, so a session that reads the working copy is
reading work in progress, and a session that reads the published copy is reading yesterday.

Why this exists: an AI session has no memory between conversations. The repository is the only place a decision can
survive. Written down it can be quoted back and checked; kept in chat it is lost and quietly reinvented.

### Layer 1: the static dashboard

- `index.html` (463 lines), `styles.css` (8,978 lines) and `script.js` (20,229 lines) at the repository root, plus
  self-contained sibling pages. Counted on `main` on 2026-11-02; the canonical checkout holds an older, smaller copy of
  all three, which is why the sizes here come from the served branch.
- No framework, no bundler, no build step. The browser loads the files exactly as they sit in the repository.
- `.nojekyll` stops GitHub Pages running Jekyll over them, so nothing is silently transformed.
- The live address is `https://kevincreedycars-debug.github.io/trading-agent-dashboard/`, served from `main`.
- Nine pages are reachable from the live top bar today: the dashboard itself, North Star Brief, Standing Dashboard,
  Gold, Backtest Flow, Call Map, USD Call Map, USD Logic Dossier, and What moves gold. Each entry is one line of HTML
  in a shared bar.

The choice that made everything else cheap: **the page is the file**. There is no deploy pipeline to debug, no
environment to drift, and "what is live" is answerable by fetching a URL and hashing the bytes.

### Layer 2: data as published artefacts

The dashboard reads JSON files sitting beside it in the repository:

- `data/layer1.json` - each agent's raw directional call. Large because it keeps history: about 630 KB on `main` and
  408 KB in the canonical checkout on the same day, which is the next point in one line.
- `data/layer2.json` - the adjusted and paired calls.
- `data/workflow-control.json` - whether the refresh button is enabled and which webhook it posts to. Holds no secret.
- `data/workflow-status.json` - the last run's outcome, written by the run itself.
- `data/refresh-runtime-profile.json` - measured runtime percentiles, so a normal wait is not reported as a delay.

These files are **published artefacts, not a live feed**. They change when a run commits a new copy to `main`, and the
page is as current as the last commit. One documented consequence cost real confusion: a checkout on a branch holds the
snapshot from when the branch was cut, so it can be weeks old while the site is current. The canonical record shows a
lane branch holding the 7 September refresh while `main` served the 29 September one - 8 agents and one live opportunity
versus 5 agents and an empty list. The rule written afterwards: read live values from `origin/main` or from the
published URL, never from your own checkout.

### Layer 3: n8n as the execution engine

n8n, in the cloud at `silver17.app.n8n.cloud`, runs the pipeline:

- **Collectors** - USD, EUR, Gold, NQ, BTC and GBP, plus an economic-events collector. They write market facts to
  Supabase.
- **Layer 1 agents** - one per asset, each sealed: it may read its own logic document and the newest snapshot, and must
  not read another agent, the dashboard or Layer 2.
- **Layer 2** - the trade-selection agent that reads the layer 1 outputs and the economic events.
- **Dashboard Writer** - commits the refreshed `data/layer1.json` and `data/layer2.json` straight to `main` through the
  n8n GitHub node, with commit messages of a fixed shape.
- **Master Orchestrator** - runs the above in a fixed order.

Sixteen workflow JSON exports are versioned in `exports/` - one master orchestrator, one economic-events collector, six
market collectors, six layer 1 agents, layer 2 and the dashboard writer - with a human-readable document per workflow
expected in `workflows/`. The exports are snapshots and drafts; the live source of execution is n8n itself, and
`docs/LOCAL_WORKFLOW_EXPORTS.md` says so explicitly rather than letting a file in Git imply a deployment.

The Master Orchestrator (`X75RKU34ikiM5RMU`) carries two triggers, verified against the live workspace on 30 September
2026: a manual start, and a webhook `POST master-orchestrator-dashboard-refresh` with `responseMode: onReceived`. That
webhook is what the dashboard's Refresh button calls. A full refresh plus publication measured about five minutes
(started 10:08:41Z, finished 10:13:18Z on 30 September). At that check no workflow in the workspace had a schedule
trigger, so nothing regenerated the calls on a clock. Layer 5 below is how that gap was closed, and it is the best
single design lesson in the project.

### Layer 4: a local test harness for the browser behaviour

The Refresh button is not really a button. It is a state machine trying to answer "did this click lead to a published
refresh", and the page usually cannot prove the link. So it has its own tests:

- `tests/refresh_progress.browser.test.js` - 1,097 lines of Playwright, driving a local HTTP harness that serves the real
  page with mock control, status, runtime-profile and data fixtures. This one is on `main`.
- `tests/refresh_workflow_harness.test.js` - fast fixture and timestamp helpers, no browser. It is in the canonical
  working tree but not on `main` as of 2026-11-02, so it is a local convenience rather than a published gate.
- Eleven modelled states (`sending`, `accepted`, `publishing`, `delayed`, `status_unavailable`, `failed`, `incomplete`,
  `verification_expired`, `association_unverified`, `complete`, `failed_dispatch`), each with a written meaning in
  `docs/REFRESH_WORKFLOW_TESTING.md`, and invariants that are asserted rather than merely documented: accepted never
  implies complete; a newer run without exact linkage is never labelled completed; a terminal state must release the
  local lock.

This is the most portable idea in the project for a content pipeline: **model the waiting states explicitly, and assert
the difference between "sent", "done" and "probably done"**. A content pipeline has exactly the same problem - "draft
submitted" is not "draft live".

### Layer 5: GitHub as the clock, not only the shelf

Two GitHub Actions workflows were added later on `main`. They are worth copying almost verbatim in shape:

- `.github/workflows/master-orchestrator-daily.yml` - wakes hourly at :07 UTC and decides in `America/New_York` whether
  this slot is the day's run: the first slot at or after 07:00, last slot 10:07, and anything arriving at 11:00 or later
  is turned away so an outage at seven cannot start a run at ten at night. It runs at most once a day, sets
  `concurrency` so a queued slot waits instead of cancelling a half-finished run, reads the control file from the served
  branch through the API rather than cloning, posts to the n8n webhook, then polls `data/workflow-status.json` for up to
  fifteen minutes and **fails the job** if the run did not write its own record back, or if what it wrote was not a
  success. It holds read-only permissions, so it cannot collide with anything that publishes. A `dry_run` input prints
  the decision and the guards without calling anything, a `force` input lets a person ask outside the window, and the
  run name carries `dry` or `live` so a dry run can never be mistaken for the day's success.
- `.github/workflows/live-trading-monitor.yml` - every fifteen minutes it reads the published URLs and lets the exit
  code be the alert. Read-only, no credential, writes nothing. Its own comment states the honest limit: GitHub ran it
  about five times a day in practice, so it is a periodic check with hours of resolution, not fifteen-minute alerting.

The lesson: **put the clock outside the engine, in the repository, with guards and a dry-run mode, and make "it ran" a
fact the run has to write down.** An n8n schedule trigger is invisible from Git; a workflow file is reviewable,
diffable and has history.

## Part 2 - How it all connects

One number, followed from end to end, is the clearest description of the system:

1. A collector workflow fetches a market fact and writes a row to Supabase.
2. A sealed layer 1 agent reads its own logic document and the newest snapshot, and writes its one call.
3. Layer 2 reads those calls plus the economic events and writes its adjusted output.
4. The Dashboard Writer turns the outputs into `data/layer1.json` and `data/layer2.json` and commits them to `main`
   through the GitHub node.
5. GitHub Pages serves `main`. The browser loads the page and the JSON. No server, no database call from the page.
6. A person presses Refresh, or a GitHub Action fires at 07:07 New York time, which posts to the n8n webhook, which
   starts the orchestrator, which comes back round to step 1.

Four connection decisions carry the weight, and each one is worth copying:

- **One repository is the single source of truth** - page code, data artefacts, workflow exports, architecture,
  decisions, bugs, logic documents and history. Anything that matters is in Git or it does not exist.
- **The engine writes back into the repository, not into a host.** This is why the site can be free, static and
  trivially recoverable: the publish step is a commit, and a commit can be reviewed, reverted and diffed.
- **Secrets never enter the repository.** Credentials live in the n8n credential store or an encrypted local store
  outside Git; a committed `.githooks/pre-commit` runs `scripts/check-repo-for-secrets.ps1 -Mode staged` and refuses
  the commit, and the same script runs on demand (or in `full` mode) when the hook is not installed. That last clause
  matters: the hook is in the repository, but it only fires in a checkout whose `core.hooksPath` points at `.githooks`,
  and each clone has to set that itself - the canonical checkout did not have it set on 2026-11-02. Exported workflow
  JSON carries credential references, never values, after literal FRED and Finnhub keys were found in export URLs and
  removed.
- **Nothing in the page is allowed to invent state.** The control file says whether the button is enabled; the status
  file says how the last run ended; the runtime profile says what a normal wait looks like. The page renders those or
  says plainly that it cannot.

## Part 3 - How the live site is created and changed

Creating it took very little. Keeping it honest took the rules.

**The creation, step by step:**

1. A public repository with a static root: `index.html` plus `styles.css` and `script.js` beside it.
2. Settings, Pages, source `main`, folder `/` (root). The site is live at
   `https://<owner>.github.io/<repo>/` within a minute or so. Nothing is installed and nothing is paid for.
3. `.nojekyll` at the root so the files are served as written.
4. Data as JSON files in `data/`, loaded by the page with a normal fetch. The page needs to be served rather than
   opened as a file, which the README covers with `python -m http.server 8000`.
5. Each extra page is one more HTML file at the root, plus one line in the shared top bar.

**Changing it later, which is the part that needed discipline:**

- **One writer.** A single publisher changes served files. A worker can build, draft, test and verify in its own
  checkout, but publishing a page is a coordinator production action. The reason is not mistrust: a page change is
  usually several files moving together (page, nav entry, guard, sometimes a linked figure), and a half-applied set is
  worse than no change.
- **The change is described as a set before it is made.** The 4 October publish note for the "What moves gold" page
  lists the source file, the site-root filename, the byte count, the sha256 on disk, the sha256 of the stored blob and
  the exact one-line nav entry. Anyone can rebuild it and compare.
- **Line endings are part of the change.** The repository runs `core.autocrlf=true`, and no `.gitattributes` rule
  covered this page, so the commit stored the LF form. The 4 October note for the "What moves gold" page quotes
  24,628 bytes on disk, 250 CRLF line endings, no bare LF, and a different sha256 for the stored blob - the difference
  in size is exactly those 250 line endings, 24,378 bytes. A publish that quotes one hash and a verification that
  computes the other looks like a failure when nothing is wrong. **If hashing is your proof, decide the line-ending
  rule first.**
  (That page's stored blob is now 26,688 bytes on `main`, so both figures are dated facts, not current ones.) The fix
  since 8 October is a `.gitattributes` that pins `-text` for markdown and for two byte-exact research folders, and
  deliberately leaves `data/*.json` and the page files alone, because those are rewritten on a fifteen-minute cadence
  and must not be renormalised.
- **Verification is a live fetch, not a read of the commit.** The 30 September draft page release was verified as HTTP
  200, the expected byte count, the expected sha256, and the expected nav entry present on the live page - not "the
  commit says so".
- **Acceptance is not deployment.** The recorded vocabulary splits the stages: setup completed, research delivered,
  adjudication completed, empirically validated. A reviewed page is "setup completed". It becomes visible only when a
  publish happens, and a publish is recorded as its own action with its own evidence.
- **A draft is published as a draft.** The "Gold Factor (draft)" page went live with its banner and as-of line intact
  and a nav label saying draft. Publishing rough work honestly is cheaper than publishing it tidy and pretending, and
  it gives the person a real page to react to.

The one weakness, measured in this project rather than guessed: the single writer becomes a queue. On 3 October the
data panel showed a 2 October reading while the refresh was authorised and ready, waiting for the publisher's hand; and
the canonical checkout's `index.html` carried six nav entries while the served page carried four, so guards were
passing against a bar nobody was served. The fixes worth copying: make publishing a cadence (drain whatever is ready
on wake) rather than a fresh decision each time; pre-authorise the lanes that cannot reach production; batch everything
queued against the same file into one change; and make "does the tree match what is published today?" part of
acceptance.

## Part 4 - The n8n workflows in more detail

What exists, and what each part is for:

- **Collectors** (USD, EUR, Gold, NQ, BTC, GBP, plus economic events): fetch the raw facts and store them in Supabase.
- **Layer 1 agents** (one export per asset - USD, EUR, Gold, NQ, BTC, GBP): turn facts into one call per asset, each
  sealed from the others. Which of the six run in the live workspace today was not re-checked for this brief.
- **Layer 2** (one): read all the layer 1 calls, adjust for events and pairing, write the combined view.
- **Dashboard Writer** (one): commit the published JSON to `main`.
- **Master Orchestrator** (one): run the others in a fixed order.

The rules that made this workable, in the project's own words:

1. **The engine is not the memory.** Workflow JSON is exported into `exports/` so a change can be diffed and reviewed,
   and the documents in `workflows/` say what each one does. The exports are explicitly labelled "snapshots and drafts,
   not proof of live workflow configuration".
2. **Every called workflow exposes an execute-sub-workflow trigger.** Manual-only steps inside a production chain are
   avoided, because a chain that needs a human in the middle is not a chain.
3. **Targeted node edits, not whole-workflow rewrites.** Back up before editing, make the smallest change, then run the
   smallest relevant workflow before the full orchestrator.
4. **Record the intent before the change.** "Never change production workflows without recording the intent in
   GitHub" is a stated rule, and `docs/CHANGELOG.md` and `docs/SESSION_NOTES.md` are the record of it.
5. **The dashboard can start a run but holds no secret.** The button posts to a webhook whose address sits in a
   non-secret control file; the webhook itself lives in n8n.
6. **A run reports its own outcome.** The orchestrator's last act is to write `data/workflow-status.json` through its
   GitHub node, and that file is what the page and the GitHub Action read. Without it, "it ran" is only a claim.
7. **The MCP server is a convenience, not the route.** `mcp-n8n/` exists as a small wrapper, but the stable path is the
   n8n API; browser automation was deliberately avoided.

What I did not verify today: the live state of the n8n workspace. The 30 September findings are quoted as of that date,
and the GitHub Actions clock added later sits outside n8n, so it does not prove n8n still has no schedule. One
discrepancy worth naming, because it is the point of the export rule: the daily workflow's own header comment says the
orchestrator drives **eight** layer 1 agents, while `exports/` carries **six**. Both are honest readings of what they
read, and that gap is exactly why a workflow file cannot be treated as the live configuration.

## Part 5 - The harness, which is the part to copy

Everything above is a website and a pipeline. The harness is the machine that lets one person run twenty-one
registered AI workers without the work turning into fiction, and it is the piece a content project should build first.

### 5.1 What it is for

Three rules, in the harness's own words:

1. **A worker's report is evidence, not truth.** The reviewer checks actual diffs, commits, test results and source
   lineage before accepting anything, and "accepted" means the numbers match the files - nothing more.
2. **Acceptance is not integration and not deployment.** Only the coordinator integrates commits and records
   merged or deployed status, and a deployment is only recorded after the live bytes are fetched and hashed.
3. **Review is a separate session from authorship**, so the person who wrote it is never the person who says it is
   good.

### 5.2 The pieces, one line each

- **A register** (`docs/orchestration/projects.json`): one row per worker with an id, a path, a branch, an assignment
  id and a status. Today it holds 21 workers plus the coordinator. The register is the single answer to "who exists".
- **One canonical checkout** (`D:\trading-agent-dashboard-codex`): the shared memory, the mailbox, the coordinator's
  own copy. Everything else is a worktree beside it.
- **One worktree per worker**: its own branch, its own working tree, its own copy of the code. Two workers cannot
  overwrite each other's files because they are not in the same folder. Seventeen of them sit inside the canonical
  checkout at `.local/worktrees/<worker>`, and four older ones sit beside it at
  `D:\trading-agent-dashboard-codex.worktrees\agent-<worker>` - the register holds the absolute path, which is why the
  location can change without breaking anything. Copy the inside-the-repo version; the outside one exists because it
  was built first.
- **One VS Code workspace per worker** under `tools/<worker>-node/`: a `.code-workspace` file that opens the central
  folder read-only for reference and the worktree as writable, plus a `README.md` with the one-time startup message.
  The boundary is cooperative, and the file says so rather than pretending it is enforced.
- **One assignment file per worker** (`docs/orchestration/assignments/<worker>.md`), owned by the coordinator and
  versioned: purpose, first deliverable, read access, write boundary, what is forbidden, how to report, and the rules
  that must not be broken. A worker's scope comes from this file, not from a chat message.
- **A filesystem mailbox** in one physical place, `.local/orchestration`, ignored by Git: `inbox/<worker>/` for
  submissions, `replies/`, `reviews/`, `activity/`, `dispatch/`, `start-task/`, `connections/`.
- **A validated envelope** (`docs/orchestration/templates/submission.json`): the one shape a report may take.
- **A CLI that is only a file transport** (`scripts/coordination.js`, 139 lines): validates the envelope, refuses
  duplicate ids, writes it atomically, returns the exact path. It never executes a worker-supplied command, path or Git
  action, which is why it is safe to run from any window.
- **A monitor** (`scripts/monitor-state.js`, 156 lines): one snapshot of every worker's last reported state, written
  with no model calls, so it can run as often as you like. With the tray app in `tools/project-monitor/` it scans every
  five seconds and alerts on new submissions and replies.
- **A bridge** (`tools/agent-mailbox-bridge/`, a VS Code extension): polls the same mailbox every five seconds and
  wakes an idle worker window by calling Cline's exported `sendMessage`. It never patches the extension, never types,
  never clicks approvals, never retries an ambiguous send, and reports "sent, unconfirmed" rather than success.
- **Gates**: a secret scanner with an on-demand mode and a `pre-commit` hook beside it; local test suites per area
  (`npm test` and focused variants); a repository-hash verifier for generated content; a published-bytes verifier for
  live pages; a live-site monitor in GitHub Actions.

### 5.3 One cycle, end to end

This is the loop, and it is the whole design:

1. The coordinator writes or updates an assignment file: one job, a write boundary, what is off limits, how to report.
2. The bridge sees the assignment is new and wakes that worker's window once. A window that is closed receives nothing,
   and the harness says so instead of assuming it was read.
3. The worker reads its assignment and the canonical state, does the work in its own worktree on its own branch, and
   reports progress to the monitor while it works (start, milestones, at least once a minute, then paused, blocked or
   stopped).
4. The worker files exactly one submission: a JSON envelope in its ignored `tmp/`, submitted through the CLI, which
   validates it and writes an immutable file under `inbox/<worker>/`.
5. The coordinator runs `coordination.js check`, reads the pending envelope, and compares the claims with the actual
   diff, commit, branch and test output. It may not accept a report it has not read, and it may not run commands the
   report suggests.
6. The coordinator writes a reply: a decision, the reason, and the next action towards the current objective. The reply
   is immutable and **bound to the sha256 of the submission it answers**, so a reply cannot drift onto a different
   report.
7. A durable review record goes under `docs/orchestration/reviews/`, and the register status is updated.
8. The worker reads its reply, and either does the requested change under a **new** submission id, or stops.
9. Only the coordinator integrates a scoped commit, and only after the user's authority for anything that reaches
   production.

The single most useful detail in that loop is step 6: **the reply is bound to the hash of the report.** It removes the
whole class of "I thought you said" problems, because the thing being answered is byte-identified.

### 5.4 The envelope, and why every field is there

A submission is refused unless it carries all of this. Each field exists because its absence caused a real problem:

- `worker_id`, `assignment_id`, `submission_id` - all slug-shaped, the worker must exist in the register, and the
  assignment must be **current**. A report against an old assignment cannot masquerade as progress.
- `status` - one of `ready_for_review`, `status_report`, `blocked`. A blocker is filed when it is found, not at the end.
- `worktree` and `branch` - must match the register exactly, unless the report is declaring a blocker. This is what
  catches a worker that has drifted into someone else's folder or branch.
- `base_commit` and `head_commit` - what the change actually sits on.
- `commits`, `changed_files`, `dirty_files` - the shape of the change, so a reviewer can see scope before reading.
- `tests` - must be non-empty: either the command and its result, or an explicit statement of why it was not run. "Not
  run, because this is a notes-only change with no code" is an acceptable and required answer. Silence is not.
- `artifacts` - the exact paths that hold the evidence.
- `blockers` and `questions` - arrays, so a question has somewhere to go other than the middle of a paragraph.
- `production_changes` - a required string that must state what touched live systems, including "none".
- A hard size limit (128 KB) so a submission stays a summary and raw evidence stays in ignored scratch.

### 5.5 What each piece prevents

| Piece | Failure it prevents |
| --- | --- |
| One worktree per worker | Two agents editing the same file and one silently losing |
| Assignment file | Scope creep by chat, and work nobody asked for |
| Envelope validation | Reports that omit tests, branch, commit or production impact |
| Immutable, uniquely named submissions | Overwritten evidence, and two reports colliding |
| Hash-bound replies | A decision attached to the wrong report |
| Separate review session | The author marking their own work good |
| Live-bytes verification | "Merged" being read as "deployed" |
| Heartbeats | A dead agent looking busy, or a busy agent looking dead |
| "Last reported" wording in the monitor | A dashboard implying liveness it cannot see |
| Secret scanner, on demand and in `pre-commit` | A key reaching a public repository - provided the hook is installed |
| The 128 KB envelope limit | A model being fed a whole raw archive |

### 5.6 The build order I would use again

Ten steps, each of which buys something the next step needs. Do not start at the bottom of this list.

1. **One repository, one static page, one JSON file.** Prove you can see a number on a public URL that comes from a
   file you control. This is the whole product in miniature.
2. **Write the state files before the second worker exists.** `CURRENT_STATE`, `DECISIONS`, a startup file. Every
   session ends by updating them. Without this, the harness has nothing to review against.
3. **Make one pipeline run end to end, in the engine.** Input in, output written back to the repository by a commit,
   page updated. No human in the middle. This is the piece people skip and then cannot debug later.
4. **Put the clock outside the engine.** A scheduled job that decides whether it should run, has a dry-run mode, and
   fails loudly if the pipeline did not write its own completion record.
5. **Add one reviewer before you add workers.** The reviewer needs only a mailbox and a rule; a worker without a
   reviewer is a worker whose mistakes become permanent.
6. **Then add exactly one worker**, with its own worktree, workspace and assignment file. Run the full loop once, by
   hand, and read the submission yourself. Only then automate the wake.
7. **Add the envelope validation** before the second worker. Two workers with an unvalidated format will invent two
   formats, and you will be reading prose to find out whether tests ran.
8. **Add the monitor.** A five-second scan of the mailbox with no model calls is cheap, and "who is waiting on whom" is
   the question you will ask most often.
9. **Add the bridge last.** Automatic waking is a convenience on top of a loop that already works. Built earlier, it
   wakes agents into an undefined process, which is worse than manual.
10. **Add the publish gate as a cadence, not a decision.** One writer, a checklist per published change, a live-bytes
    check, and a standing rule that whatever is ready gets published when the writer wakes.

### 5.7 What it costs, honestly

- **Ceremony.** Every handover is a file. A five-minute task has a submission, a reply and a review note. That is the
  point, but it is real, and it is why the smallest items should be pre-authorised rather than queued.
- **A single publisher is a bottleneck.** Measured here: an authorised refresh waited a day for a hand, and a served
  nav bar drifted from the one in the tree while the guards passed.
- **The loop only closes while the windows are open.** A closed worker window receives no wake; a stalled worker stays
  stalled until something happens. The monitor is what tells you it is stalled.
- **It does not make the work good.** It makes the work checkable. A harness full of confident, wrong reports is still
  full of wrong reports - the value is that the reviewer is forced to look at the files.
- **The human is still the source of priority.** The queue is a scheduling device, not an authority. Nothing in the
  harness decides what matters.

## Part 6 - Mapping the harness onto a content project

### 6.1 The rename map

Nothing in the harness is trading-specific. It is renamed like this:

| Here | Yours |
| --- | --- |
| Asset (USD, EUR, Gold) | Topic, channel, or client |
| Layer 1 call | A content brief: one idea, one angle, one source set |
| Layer 2 adjustment | The editorial pass: house voice, cross-links, what it pairs with |
| Collector workflow | Research run: a fetch of the facts that idea depends on |
| Dashboard Writer | Publisher: writes the finished piece into the site folder and commits |
| Master Orchestrator | The daily or weekly content run |
| `data/layer1.json` | `data/queue.json`, `data/published.json` |
| "Directional / profitable / validated" | "Drafted / edited / published", or "on-brand / accurate / live" |
| Sealed layer agent | A writer worker that sees one brief and cannot see the others |
| Refresh button | "Generate today's piece" button, or "start the run" |

The sealing row matters most. **Sealing is what keeps quality up.** In this project each layer 1 agent reads
its own logic document and nothing else, so five agents produce five independent views instead of converging on one
house opinion. In a content project the same trick stops every article sounding like the same article: each writer sees
its brief, its sources and the style guide, and not its siblings' drafts.

### 6.2 What to keep, and what to leave behind

**Keep, close to unchanged:**

- The worktree-per-worker + workspace + assignment-file triad.
- The envelope, the immutable submissions, the hash-bound replies, the review record.
- The three rules: evidence not truth, acceptance is not deployment, reviewer is not author.
- The state files and the startup file that every session reads first.
- The clock outside the engine, with a dry-run mode and a completion record.
- The live-bytes verification after publishing, and the honest label on the monitor ("last reported").
- The secret scanner. A content project will hold an LLM key and possibly a CMS key, and both will end up in a commit
  the first time somebody is in a hurry.

**Leave behind, because it is trading-specific:**

- The collectors, the Supabase schema and the economic-calendar logic.
- The five sealed layer-1 personas and their logic documents. The *pattern* transfers; the prompts do not.
- The refresh progress state machine's exact states. Copy the discipline, rewrite the states for your own waits.
- The numeric guard rails (confidence bands, thresholds). You will need different ones, probably softer.
- Anything that depends on the meaning of a number. Content quality is not measurable the same way, and pretending
  otherwise is how the whole thing starts lying.

### 6.3 The one thing to build that this project did not need

A **content pipeline has a review that cannot be automated away**: does this read well, is it true, is it on-brand. So
add one piece this project never needed - a **claim ledger**. Every factual sentence in a draft is recorded with the
source path and the date it was fetched, and the reviewer checks the ledger, not the prose. That turns "is it accurate"
into "does every claim have a source and is that source still saying it", which is checkable, and it gives you exactly
the same benefit as the published-bytes check: the difference between "the draft was written" and "the draft is right".

### 6.4 What the content pipeline would look like, concretely

Six stages, each of which writes one file that the next stage reads. Nothing is passed in chat.

1. **Idea.** A worker reads the topic list and last month's published index, and writes three candidate briefs to
   `data/queue.json`. Refuses to duplicate anything already published.
2. **Research.** One worker per brief fetches sources and writes a claim ledger beside the brief. It may not write
   prose. This separation is what makes stage 3 checkable.
3. **Draft.** One writer per brief, sealed from the others, writes the piece against the style guide and may only use
   claims that exist in the ledger. A claim with no source line is a blocker, not a creative choice.
4. **Editorial.** One pass that reads all the drafts together, fixes house voice, adds cross-links, and cuts
   repetition. This is the layer 2 analogue, and it is the only stage allowed to see more than one piece.
5. **Human read.** The person reads the edited draft on a real preview URL, with a draft banner. Their answer is a
   decision file, not a chat reply.
6. **Publish.** The single publisher moves it into the site, commits, then fetches the live URL and checks the bytes,
   the title, the date and the nav entry. The published index is updated in the same change.

Then the states, which is the part worth copying from `tests/refresh_progress.browser.test.js`:

`sourced` -> `drafted` -> `edited` -> `approved` -> `publishing` -> `published`. Plus the negative ones that are easy
to forget: `source_stale` (the ledger cites something older than the window), `draft_unlinked` (the draft cannot be tied
to a brief and a ledger), `publish_unverified` (the check after the commit failed), `abandoned` (the person said no).
The invariants to assert are the same shape as here: approved is not published; published requires a fetch; a draft
without a ledger is never approved.

### 6.5 The folder layout to copy

```
<project>/
  index.html, styles.css, script.js      the published site, no build step
  .nojekyll
  data/
    queue.json                           briefs and their state
    published.json                       what is live, with hash and date
    workflow-status.json                 how the last run ended
  content/
    briefs/, drafts/, ledgers/           the raw material, one folder per stage
  docs/
    CURRENT_STATE.md, DECISIONS.md       the memory
    STRATEGY.md                          where this is going
    orchestration/
      AGENT_MANUAL.md                    the rules
      projects.json                      the register
      assignments/<worker>.md            one scope per worker
      templates/submission.json          the envelope
  scripts/
    coordination.js                      the mailbox transport
    monitor-state.js                     the panel
  tests/                                 whatever is checkable, and it should be something
  .github/workflows/                     the clock outside the engine
  exports/, workflows/                   engine snapshots and what they do
  .local/                                mailbox, worktrees, scratch - all ignored
```

The last line is load-bearing. `.local` is ignored by Git, so the mailbox and the worktrees never pollute the
repository, and the repository never becomes the scratch space. Everything a worker produces that matters has to be
moved into a tracked folder deliberately, which is exactly the friction you want.

## Part 7 - How to talk to the person, including the questions

This project got this wrong twice, in the same way both times, so it is worth writing down as a rule rather than a
preference.

### 7.1 The two failure modes

- **Too much.** A reply that answers a question with a page of context, provenance, file paths and numbers. It is all
  true and none of it is read, and the person ends up asking the question again.
- **Too little.** A reply of three words that omits the one thing that changed the decision. The person then cannot
  tell whether the work was done, so they ask again - which looks like the first problem.

Both produce the same outcome: the person has to ask again. So the rule is not "be brief", it is **be brief in the
reply and complete in the file**.

### 7.2 The rule, as written in the project

`docs/strategy/REPLY_STYLE.md` is the file, and it is read at startup, not remembered:

- **Three bullets maximum, about fifty words each.** Plain words. No tables, no hashes, no file paths, no provenance,
  no jargon.
- **Questions come as a short numbered list**, one to two lines each, with a reason or an example attached. Seven at
  most. Every question carries a default, so an unanswered question still moves the work forward.
- **Long evidence, numbers, decisions, open points and provenance live in `docs/strategy/` and the mailbox**, never in
  the reply.
- **If it will not fit, cut it and name the file that holds it.** Naming the file is what makes the cut honest.
- The reply says what changed, what it means for the person, and what happens next - in that order.

The reason this belongs in a file rather than in the person's head: a rule in the startup path is read every session. A
preference in a chat message is read once and then competes with everything else.

### 7.3 Asking a question that can be answered

The pattern that worked, and it is the same pattern as the state machine:

1. **Give the options, not the problem.** "Do you want the draft published under your own name, or as the studio's?"
   Two answers, both usable. Not "how should authorship work?"
2. **Attach a reason to each option**, one short line, so the choice is informed without a briefing.
3. **State the default.** "If you say nothing, I will assume the studio's name, because it is easier to change later."
   A default turns an unanswered question into a decision instead of a stall.
4. **At most seven.** Past that it is not a question, it is a form, and forms get closed.
5. **Never hide a decision inside a question.** If something needs authority, ask for the authority plainly rather than
   presenting it as one of several options.

### 7.4 Where the long version goes

The split that kept both sides honest:

- **The reply to the person**: three bullets, plain words, no file paths.
- **The submission and reply inside the harness**: full detail, hashes, commands, test output, so a reviewer can check
  it months later.
- **The documents** (`CURRENT_STATE`, `DECISIONS`, the briefs and notes): everything the reply left out, filed where it
  can be found by name.

A person should never have to read a submission to find out what happened, and a reviewer should never have to trust a
three-line reply. Same facts, two audiences, two formats, one rule between them: nothing is written twice, and
nothing important is written only in chat.

### 7.5 The two vocabulary rules

Both of these came from the person refusing to decode the worker's shorthand.

- **Use the person's words for the person's things.** "The questions", "the work", "the numbers", "the dashboard". Not
  round, batch, lane, envelope, submission, artifact or provenance. If a process has to be mentioned, say it in one
  plain clause: "I ask the questions a few at a time."
- **Never collapse four different things into the word "done".** The four, in the person's own naming: setup completed
  (the chain is in place, nothing has run), research delivered (a result exists as evidence, not an approval),
  adjudication completed (the position is decided on its own evidence), empirically validated (measured on a named
  sample and window). A reply says which of the four each item is in, and says plainly when an item is none of them yet.

The second rule is the same discipline as the page: **a word that hides a state is how a project starts lying to
itself.** "Done" covers four different situations, so it is banned in status updates here.

## Part 8 - What went wrong, and what fixed it

Nine failures, in the order they matter. Every one of them is a rule in this project now.

1. **The data was stale and the page was confident.** The dashboard showed a reading that was a day old because nothing
   on a clock regenerated it. The fix was not better error handling, it was a scheduler plus a staleness label, and the
   general lesson is that **a fresh-looking page will be trusted long after it stops being true** unless the age is on
   the screen.
2. **"Merged" was read as "live".** A change was considered done at the commit. The fix: a deployment is only recorded
   after the served bytes have been fetched and hashed, and acceptance is recorded as its own stage.
3. **Guards passed against a page nobody was served.** The checkout's nav bar had six entries, the published page had
   four, so a rule about nav entries was being checked against the wrong file. The fix: check the published thing, and
   make "does the tree match what is live" part of acceptance - and remember that a worker's branch copy is stale by
   design, so live values must be read from the served branch or URL.
4. **Two hashes that both looked wrong.** Line-ending conversion made the byte count on disk differ from the byte count
   in the repository, so a correct publish looked broken. The fix: decide the line-ending rule before you use hashes as
   proof, and pin it in `.gitattributes`.
5. **Real API keys inside exported workflow JSON.** The keys sat in export URLs and had reached the repository. The
   fix: keys removed, exports now carry credential references only, a scanner script with a `staged` mode, and a
   `.githooks/pre-commit` to call it. **A public repository and a shared engine are exactly where this happens.** The
   loose end to remember: a committed hook is not an installed hook, so the on-demand scan is the gate you can count on.
6. **Every schedule was invisible.** The n8n triggers could not be seen from Git, so "what runs on a clock" had no
   answer in the repository. The fix: the schedule moved into a workflow file, which is reviewable and diffable.
7. **"It ran" was a claim.** A webhook returning 200 says the request was accepted, not that the run finished. The fix:
   the run must write its own completion record, and the caller fails if that record does not appear.
8. **Almost nobody could tell a dry run from a live run.** The fix was small and worth copying: the run name carries
   `dry` or `live`, and a dry run prints its decision and its guards without calling anything.
9. **The reply style was too dense twice.** A rule in the person's head did not survive a busy session, so it became a
   file read at startup (Part 7).

One failure that has not been fixed, and should be stated: **the monitor can only show what was last reported.** It
cannot see whether a window is alive, whether an agent is working, or whether a report is honest. It is a filing
cabinet with a clock, and the honest wording on it ("last reported") is the only thing keeping it from being read as a
liveness signal.

## Part 9 - What I would need from you to build this for content

Seven questions. Each has a default, so if you would rather not answer, the work still moves.

1. **Where does the finished content live - your own site, an existing platform, or both?** Default: your own static
   site first, because it is free, fast and lets the pipeline prove itself before anything depends on it.
2. **What does "published" mean for you - a live URL, a queued post, or an email sent?** Default: a live URL with a
   fetch check, because it is the only one that can be verified from outside.
3. **Does a person read every piece before it goes live, or only some of them?** Default: every piece at first, with a
   draft banner, and pre-authorised lanes added once you trust a category.
4. **How many separate workers do you want at the start?** Default: one writer and one reviewer. Adding workers is easy
   later; adding the reviewer late is what breaks things.
5. **What engine will run the steps - an automation tool, a script, or your own hands?** Default: script or hands
   first, an automation platform once the sequence is stable.
6. **Which facts must every piece carry a source for?** Default: every number, every date, every attributed quote, and
   anything about a person.
7. **Who is allowed to publish, and how often?** Default: one publisher, draining whatever is ready once a day.

If you answer only two, answer 2 and 6. "What counts as published" and "what must be sourced" decide the rest of the
design, and everything else can be defaulted.

---

*Written 2026-11-02 from the repository as it stands, the orchestration documents, the workflow exports, the tests, the
publish notes and the recorded history. Where a claim comes from a specific date's findings it says so; nothing here is
read from a live system, and the n8n workspace in particular was not inspected for this brief.*
