# Changes

Newest first. One entry per working session that changed something a reader can
see or run.

## 2 November 2026 — the brief, filed and checked

**Added**

- `docs/strategy/PROJECT_BRIEF.md`: the project brief written by the `strategy`
  worker, kept in its own words. Parts 1 to 5 describe the older trading
  repository; parts 6 to 9 are written for a project like this one.
- A note at the top of it, written by the coordinator and kept apart from the
  text, listing the four measurements in it that belong to that other repository
  rather than to these files: the page sizes, the number of registered workers,
  the workflow exports, and a live address. Without the note, a reader would
  compare a 20,229-line page against a 1,326-line one and conclude something is
  missing.
- `content/README.md`: the three stage folders, what goes in each, and the rule
  that separates them.

**Changed**

- `SESSION_NOTES.md` records what the brief proposes for the two open questions,
  and why neither is adopted yet.

**Notes**

- Nothing in the page, the data or the rules moved. The brief is advice, and it
  is filed as advice.

## 2 November 2026 — the page draws all eight views, and there is a gate

**Added**

- The eight views: overview, sites, content, backlinks, email, EEAT, runs and
  harness. Each draws from `data/` and each says what it is for before it says
  anything else.
- Hash routing, so a view can be linked and reloaded: `#/content` and so on.
  An unknown route falls back to the overview rather than to an empty page.
- `tests/views.test.js`: a small DOM and a disk-backed `fetch` draw every view
  and check the result. No `undefined`, no `NaN`, no `[object Object]`, one
  active tab, header chips filled. A missing file must be named, not drawn as
  zero.
- `scripts/serve.js`: a static server with no dependency. Refuses dotfiles and
  refuses to serve outside the folder.
- `scripts/verify-dashboard.js`: serves the folder and fetches its own files
  over HTTP, which is the only way to show the page can actually load. 14
  checks, all passing.
- `scripts/monitor-state.js`: what is asking for a person, printed. `--strict`
  exits 1 on anything high, `--json` for a workflow.
- `scripts/check-repo-for-secrets.ps1` and `.githooks/pre-commit`: tests plus a
  credential net, before anything is committed.
- `newestTimestamp` in `js/core.js`, so the header date and the monitor agree on
  what "the files are current" means.
- The harness, in writing: `AGENTS.md`, `STRATEGY.md`, `DECISIONS.md`,
  `docs/CURRENT_STATE.md`, `docs/strategy/REPLY_STYLE.md`, and under
  `docs/orchestration/` the register, the manual, five assignments and the
  submission template.
- `scripts/coordination.js`: the register, the assignments, the template and the
  workers still agree. 9 checks.
- `scripts/run-gate.js`: may a scheduled run start, and did the last one finish.
  The second question is the one that matters; it refuses a run whose record is
  older than the run.
- `.github/workflows/content-run-daily.yml`: daily at 06:10 UTC, with `dry_run`
  and `force` inputs, and a completion-record check that fails the job when no
  newer record appears.

**Fixed**

- A skipped header line in `tests/core.test.js` left one test with no opening
  line, so the whole file was a syntax error. It was caught by running the
  pre-commit hook by hand, which is the first thing that ran the file after the
  edit. Run the file by name after editing tests, not only the suite.
- `[System.IO.Path]::GetRelativePath` does not exist in Windows PowerShell 5.1.
  The scan now trims the root off the path instead.

**Notes**

- 57 tests pass. `npm run check` passes 14 of 14. `npm run scan` is clean on 26
  files.
- The Run button is still disabled, on purpose, and the page says why.
