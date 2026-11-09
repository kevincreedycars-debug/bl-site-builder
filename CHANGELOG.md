# Changes

Newest first. One entry per working session that changed something a reader can
see or run.

## 9 November 2026 — a map view, and a repository to host it from

**Added**

- A ninth view, `#/map`: the same ten files drawn as one picture. A sphere per
  site, a tick per citation cell, a bead per sold link, a node per sending
  domain and mailbox, a lane per worker, and connectors between them. Colour is
  the state the file records, size is pages published, height is citation
  coverage. Nothing else is encoded, and the distance between two objects is how
  the picture was arranged rather than a measurement.
- `js/scene.js`, the model. It turns the loaded files into objects, connectors,
  layers, an encoding legend and a list of what did not arrive. No three.js, no
  DOM and no clock, so `tests/scene.test.js` checks the whole picture in Node.
- `js/map3d.js`, the canvas. Geometry, camera and colour only; it frees
  everything in `dispose()`, holds still when the reader asks for less motion,
  and takes its colours from the stylesheet tokens.
- One row per object, one legend row per mark, and one `<details>` per object
  below the canvas. The canvas and its layer switches are left out of the print
  stylesheet, so paper loses the picture and no facts.
- `vendor/three.module.js` (r170) and `vendor/README.md`: the version, the byte
  count and the sha256 of the copy. `npm run check` now fails if the map imports
  anything from another host.

**Changed**

- `npm test` is 75 tests: 14 for the model, 2 for the canvas, and one that
  compares the rendered tables against the model built from the same files.
- `npm run check` fetches `#/map` and the map module over HTTP, so a broken
  import is found before a browser finds it.
- `DECISIONS.md` D11: the map is a view of a model, and three.js is copied in.

**Notes**

- The repository now exists at `github.com/kevincreedycars-debug/bl-site-builder`
  and the work is committed. The first push waits on a token scope: the history
  contains `.github/workflows/content-run-daily.yml`, and an OAuth app may not
  create that file without the `workflow` scope. Nothing on the page depends on
  the wait.

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
