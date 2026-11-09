# AGENTS.md

Everything a person or an agent needs before touching this repository.

## What this is

A dashboard for a portfolio of WordPress sites that sell links and publish
content. It shows six things in one place: the sites, the content pipeline, the
link inventory, the sending mailboxes, the citation work, and the record of the
runs that produced it.

The page is one static folder. There is no build step, no bundler and no
dependency. `index.html` loads `script.js`, which imports `js/core.js`, which
holds every rule worth testing. `data/*.json` is the only input.

    index.html        the shell: header, tab list, one empty container
    script.js         what draws each view and moves between them
    js/core.js        the rules: state machine, attention, summaries, checks
    js/scene.js       the map's model: which objects exist and what they claim
    js/map3d.js       the canvas: three.js geometry, camera, labels
    vendor/           three.js r170, copied in, with its sha256 in README.md
    styles.css        one stylesheet, light and dark, print included
    data/*.json       the evidence. Ten files, each with _meta.as_of
    tests/            what runs in node. Nothing else runs in CI
    scripts/          serve, check, monitor, scan. No dependencies either

## The five rules

1. **The files are the truth.** Every number on the page comes from a file in
   `data/`. Nothing is invented, estimated in place, or remembered in a
   variable that has no file behind it.
2. **A missing file is said out loud.** If a file will not load, the page says
   which one and why. It never draws a zero in its place, because a zero looks
   like a fact.
3. **Nothing published may contain a secret.** `data/` is served to whoever can
   reach the page. Keys live in `.env` or `.local/`, both ignored.
4. **Say the state, then the next act.** "Verdant Table returns 401" then "ask
   the host to fix it". Never a status word on its own: "in progress" tells a
   reader nothing they can act on.
5. **No build step is a feature.** A file edit is live on the next reload. If a
   change needs a tool to become visible, the change is in the wrong place.

## How to run it

    npm test        the node tests. 75 of them, about a third of a second
    npm run check   serves the folder and fetches its own files over HTTP
    npm run serve   a local server on http://127.0.0.1:4173
    npm run live    asks the published site the same questions as npm run check
    npm run harness the register, the assignments and the template still agree
    npm run gate    may a scheduled run start, and did the last one finish
    npm run monitor what is asking for a person, from the files as they are
    npm run scan    a coarse net for anything shaped like a credential

`npm test` is the gate. `npm run check` is the proof that the page can actually
load, which the tests cannot show because they build their own DOM. `npm run
live` asks the same questions of the published site, and checks that the
three.js it serves is the copy `vendor/README.md` records. It is not part of the
gate because it needs a network.

## Where it is published

    https://kevincreedycars-debug.github.io/bl-site-builder/

GitHub Pages, from the `master` branch, at the root of the folder. A push to
`master` is live within about a minute, which is the same promise as a reload
here: no build, nothing to deploy. `npm run live` after a push says whether the
published files are the ones this folder holds.

## Before a commit

    npm test
    npm run check
    npm run harness
    npm run scan

The hook in `.githooks/pre-commit` runs the tests and the scan for you once it is
enabled with `git config core.hooksPath .githooks`. `SKIP_HOOKS=1` skips it.

## How to change a view

- A rule that decides something (is this late? is this lost?) belongs in
  `js/core.js`, with a test in `tests/core.test.js`.
- A rule about what the map draws (which objects exist, how big, how high, what
  each one may claim) belongs in `js/scene.js`, with a test in
  `tests/scene.test.js`. `js/map3d.js` chooses geometry and colour only, and
  every fact it draws is repeated in the tables under the canvas.
- A rule that only decides how something looks belongs in `script.js`.
- Every view must survive a file it was not written for: no `undefined`, no
  `NaN`, no `[object Object]`, and `tests/views.test.js` checks exactly that.
- New data field? Add it to `validateData` in `js/core.js` and to a seed file at
  the same time, so the page and the test fail together rather than drifting.

## Writing

Short sentences. Plain words. A number always has a unit and a time. Links are
written as `domain.com/page`, not as a URL with a protocol unless the protocol is
the point. The reply style for messages to the owner is in
`docs/strategy/REPLY_STYLE.md`; the register of what is decided and why is in
`DECISIONS.md`.

## Open questions

`SESSION_NOTES.md` ends with the questions that are still open. Do not answer
them by guessing: write down the assumption you made, and mark it as one.
