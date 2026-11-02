# Decisions

One entry per decision that would cost something to reverse. Each says what was
decided, what it rules out, and what would make it wrong.

## D1 — No build step, no dependency

**Decided:** plain HTML, CSS and ES modules, loaded straight from the folder.

**Rules out:** bundlers, frameworks, a `npm install` before the page works, and
anything that must be compiled to be seen.

**Why:** the page is a picture of files. If looking at a file takes a toolchain,
the picture is never looked at during the moment it matters. It also means the
page can be served by the cheapest possible host, and cannot break because a
package vanished.

**Would be wrong if:** the views grew past what a single module can hold. The
exit is a second module imported by `script.js`, not a bundler.

## D2 — `data/` is the only input, and it is public

**Decided:** every number on the page comes from the ten files in `data/`, and
those files are assumed to be readable by anyone who can reach the page.

**Rules out:** keys, passwords, private URLs, customer names and mailbox
credentials in any data file. It also rules out hiding a real value behind a
placeholder that looks like data.

**Why:** a dashboard that needs a secret backend to explain itself is a dashboard
nobody can check. Treating the files as public makes the rule impossible to
forget.

**Enforced by:** `findSecretKeys` in `js/core.js`, checked in
`tests/data.test.js`, and `scripts/check-repo-for-secrets.ps1` for everything
else in the repository.

## D3 — A missing file is reported, never drawn as zero

**Decided:** when a file will not load, the page names it and says what failed.
Views that would have used it say they cannot.

**Rules out:** the convenient fallback (`items = []`) that turns "no evidence"
into "nothing wrong". That fallback is how a broken pipeline reads as a healthy
one for a week.

**Why:** the difference between "zero lost links" and "we could not check" is the
whole value of the page.

## D4 — Rules live in `js/core.js`, drawing lives in `script.js`

**Decided:** anything that decides a state, a severity or a count is in
`js/core.js` and tested in node. Anything that decides an element is in
`script.js`.

**Rules out:** a threshold written inline in a view, and a rule that only exists
in the browser where it cannot be tested.

**Why:** the rules are the part that can be wrong in a way that costs money. They
must be testable without a browser.

## D5 — Thresholds come from the files

**Decided:** warn and fail limits are read from `data/*.json`, with defaults in
`js/core.js` if a file is silent.

**Rules out:** quietly retuning what counts as a problem by editing code, which
nobody reviews as a policy change.

**Why:** a threshold is an opinion about the business. Opinions belong where they
can be read, dated and argued with.

## D6 — A run that did not write its record did not happen

**Decided:** `data/workflow-status.json` is written by the run itself as its last
step, and a run with no newer record is treated as not having happened.

**Rules out:** claiming success from a scheduler log, a green check mark, or a
job that started and died.

**Why:** the failure this catches is the ordinary one: a job that starts, fails
quietly, and is assumed to have worked because it was scheduled.

## D7 — The Run button is disabled when the control file says so

**Decided:** `data/workflow-control.json` carries `refresh_enabled` and
`dry_run_only`, and the button reflects them. Nothing here connects to an engine
yet, so the button is disabled and the reason is printed next to it.

**Rules out:** a button that looks live and does nothing, which teaches the owner
to distrust the page.

## D8 — Attention items are ranked, and each one can be acted on

**Decided:** every item carries a severity, the evidence it was derived from, and
one next act.

**Rules out:** a red count with no way to find what it counts, and an item that
cannot be closed.

**Why:** a list of problems without next acts is a list that gets ignored after
the second reading.

## D9 — LF everywhere, in the repository and the working tree

**Decided:** `.gitattributes` sets `eol=lf` for text.

**Rules out:** a hash that matches in one place and not the other.

**Why:** publication verification compares hashes of published bytes. A hash is
only evidence if the bytes are the same on both sides.

## D10 — `.example` domains in every fixture

**Decided:** every domain, address and link in the seed data sits on a domain
reserved for examples.

**Rules out:** a fixture address that belongs to a real person, and a link that
points somewhere real by accident.

**Why:** seed data gets copied into tickets, screenshots and documents. It must
be safe in all three.
