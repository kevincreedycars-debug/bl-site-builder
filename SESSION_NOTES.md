# Session notes

Newest first. Each section is what one session found, did, and left open.

## 9 November 2026 — the map, and a repository to host it from

### What was being done

Adding a ninth view that draws the same ten files as a picture, then publishing
the page so it opens from a URL rather than from a folder on this machine.

### What was found

- The page had no picture at all. Eight views, every one of them a table. Some
  questions — which site is thin, which mailbox is cold, which worker has stopped
  writing — are answered faster by looking than by reading.
- Nothing was hosted. The folder opened only through `npm run serve`, which means
  only on this machine.
- A canvas would be the first thing on the page that a test cannot read, so it
  needed a model the tests can read in its place.

### What was done

- `js/scene.js` builds the model: objects with a position, a size, a tone, the
  file they came from and the facts about them; the connectors between them; the
  layers; the legend; and the list of what did not arrive. No three.js, no DOM,
  no clock, no `Math.random` — the same files give the same picture every time.
- `tests/scene.test.js` (14 tests) checks it without a browser: the counts equal
  the files, every connector names two objects that exist, no number is invented
  when a file is missing, and an unrecognised state is `unknown` rather than a
  guessed colour.
- `js/map3d.js` draws it: drag to turn, wheel or pinch to zoom, arrow keys for
  the same, a press selects. It frees every geometry, material, listener and the
  WebGL context in `dispose()`, holds every pulse still when the reader has asked
  for less motion, and reads its colours from the stylesheet tokens.
- `#/map` repeats every drawn fact three times below the canvas, and the print
  stylesheet drops the canvas and the layer switches rather than the facts.
- three.js r170 is copied into `vendor/` with a sha256 in `vendor/README.md`.
  `npm run check` now fetches the map module and fails on a remote import.
- `DECISIONS.md` D11 records the shape: a model that tests can read, a canvas
  that only draws, and nothing that exists in pixels alone.

### Traps worth remembering

- three.js parses hex, `rgb()` and `hsl()`. A colour token written in `oklch`
  would have drawn white and warned in the console rather than failed. The tokens
  are hex, and `TONE_FALLBACK` carries the same seven values so the canvas is
  right even with no stylesheet to read.
- A `<canvas>` at `height: 100%` inside a parent that has only `min-height`
  collapses to the default 150px. It is positioned with `inset: 0` instead.
- A dynamic `import()` can resolve after the reader has left the view and mount a
  second renderer on the next canvas. `mapToken`, counted up in `teardownMap`, is
  the guard: only the newest mount may draw.
- A WebGL context is a limited resource. Leaving this tab and coming back would
  run the browser out of them, so `dispose()` calls `renderer.forceContextLoss()`
  after `renderer.dispose()`.
- GitHub refuses a push from an OAuth app whose token lacks the `workflow` scope
  when the pushed history contains `.github/workflows/`. The repository exists
  and is empty; the push waits on that scope, and nothing on the page does.
- PowerShell 5.1 `Get-Content` reads a UTF-8 file as ANSI and `Set-Content` writes
  it back with a BOM, so a scripted find-and-replace over one of these files
  double-encodes every em dash. Use the editor, or read and write bytes.

### How to pick this up

    npm test
    npm run check
    npm run harness
    npm run scan

Then open `#/map` and check four things by eye, because no test can: the objects
are spread rather than piled, the labels sit on their objects at every angle, a
layer switch removes its objects and the connectors that touch them, and the
panel fills when an object is pressed. If one of those fails, the failure is in
`js/map3d.js` and in nothing else.

### Open questions

- **Assumption, marked as one:** GitHub Pages serves the `master` branch root,
  and the site is public because the repository is public. Neither was agreed.
  Both are one setting each, and both are reversible.
- **Assumption:** the map stays behind the overview rather than becoming the
  landing view. A picture is a summary and the overview is the words; a reader
  who lands on a sphere has not yet been told what the page is for.
- Should the layer switches be remembered between visits? They reset on every
  route change today, because the hash is the whole address and the switches are
  not in it.

## 2 November 2026 — all eight views, and a gate in front of them

### What was being done

Finishing the dashboard so all eight views draw from the seed files, then putting
a gate in front of the repository so the next change cannot quietly break it.

### What was found

- The rules layer was complete and tested. The rendering layer was not: five of
  the eight views were unwritten when the session started.
- Nothing could be said about the page's state because the tests only covered
  `js/core.js`. A rule can be perfect and the page still be blank.
- There was no way to look at the page locally. `fetch` on `file://` is refused
  by every browser, so opening `index.html` directly shows a page that says the
  data did not load — which is correct, and looks like a bug.
- There was no gate. A file with a syntax error could be committed, and was, in
  the sense that nothing would have stopped it.

### What was done

- Wrote the five missing views and the router. All eight now draw.
- Added `tests/views.test.js`, which is the first test that asks the question
  "does a person see anything", rather than "is the rule right".
- Added a server and an HTTP check. The check fetches the same bytes a browser
  would, so the page's ability to load is now evidence rather than a hope.
- Added a monitor, a credential scan, and a pre-commit hook that runs the tests
  and the scan.
- Moved the "newest file" rule out of the page and into `js/core.js`, so the
  header and the monitor cannot disagree.

### Traps worth remembering

- The editor trims nothing but does cap a single edit at about six thousand
  characters. Long blocks must be written in pieces, and a replacement whose
  anchor is not unique enough silently fails or hits the wrong place.
- Replacing a `test('...', () => {` header line without putting it back leaves a
  file that fails to parse. `node --check` catches it in a second; running the
  file by name catches it too.
- Windows PowerShell 5.1 is not .NET Core: `[System.IO.Path]::GetRelativePath`
  does not exist there.
- `sh` is not on `PATH` in a PowerShell session on this machine, but
  `C:\Program Files\Git\bin\sh.exe` is. That is how the hook was run by hand.

### How to pick this up

    npm test
    npm run check
    npm run monitor

If those three are green, the page is what it says it is. The next useful change
is not on the page: it is the first run that replaces a seed file with a
measured one. Until then everything here is an example.

### Open questions

These were asked earlier and are still open. Nothing below has been decided by
assumption in the code — where a choice had to be made, the code uses the file's
own value or says it does not know.

1. **What counts as published?** A 200 on the URL, a 200 on the URL with the
   body matching the approved draft, or a 200 that the site's own sitemap lists?
   The page currently treats "a fetch returned 200 and the hash matched the
   approved text" as published, because that is what `evaluatePiece` can see.
2. **Which claims must be sourced?** Every factual sentence, every number, or
   only the ones a reader would check? `claims_sourced` is a count today, and a
   count cannot answer this. This is the question that decides whether the
   content pipeline is slow or fast, so it is worth settling before more drafts
   are written.
3. **Who is the seller of record** on a sold link: the site, the studio, or the
   entity? It changes the invoice, the refund wording and the EEAT page.
4. **How long is a link verified for?** A check that passed in March is not a
   pass today. `stale_check_days` exists in the files; the number in it has not
   been agreed.
5. **May a warm-up mailbox ever be paused?** Pausing resets heat in most
   providers, so the answer decides whether "paused" is a state at all or an
   accident.
6. **What must be sourced before approval** — the same question as 2, but at the
   gate rather than in the score. The pipeline refuses a draft with no ledger
   today. Whether a draft with a partial ledger can be approved is undecided.

Questions 1 and 6 are the two that change what the page is allowed to call good.

### What the brief does not settle

`docs/strategy/PROJECT_BRIEF.md` was filed on 2 November. It proposes a default
answer for questions 1 and 2: published means a live URL that answers and whose
text matches the approved draft, and sourced means every number, every date,
every attributed quote and anything about a person. The first is what the code
already does, which is why nothing moved when the brief arrived. The second is
narrower than the assignment file, which asks for a ledger line for every fact.
Neither is adopted, because a default from a worker is advice with a label on
it, not a decision.
