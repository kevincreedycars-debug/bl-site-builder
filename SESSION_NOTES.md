# Session notes — 2 November 2026

## What was being done

Finishing the dashboard so all eight views draw from the seed files, then putting
a gate in front of the repository so the next change cannot quietly break it.

## What was found

- The rules layer was complete and tested. The rendering layer was not: five of
  the eight views were unwritten when the session started.
- Nothing could be said about the page's state because the tests only covered
  `js/core.js`. A rule can be perfect and the page still be blank.
- There was no way to look at the page locally. `fetch` on `file://` is refused
  by every browser, so opening `index.html` directly shows a page that says the
  data did not load — which is correct, and looks like a bug.
- There was no gate. A file with a syntax error could be committed, and was, in
  the sense that nothing would have stopped it.

## What was done

- Wrote the five missing views and the router. All eight now draw.
- Added `tests/views.test.js`, which is the first test that asks the question
  "does a person see anything", rather than "is the rule right".
- Added a server and an HTTP check. The check fetches the same bytes a browser
  would, so the page's ability to load is now evidence rather than a hope.
- Added a monitor, a credential scan, and a pre-commit hook that runs the tests
  and the scan.
- Moved the "newest file" rule out of the page and into `js/core.js`, so the
  header and the monitor cannot disagree.

## Traps worth remembering

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

## How to pick this up

    npm test
    npm run check
    npm run monitor

If those three are green, the page is what it says it is. The next useful change
is not on the page: it is the first run that replaces a seed file with a
measured one. Until then everything here is an example.

## Open questions

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

## What the brief does not settle

`docs/strategy/PROJECT_BRIEF.md` was filed on 2 November. It proposes a default
answer for questions 1 and 2: published means a live URL that answers and whose
text matches the approved draft, and sourced means every number, every date,
every attributed quote and anything about a person. The first is what the code
already does, which is why nothing moved when the brief arrived. The second is
narrower than the assignment file, which asks for a ledger line for every fact.
Neither is adopted, because a default from a worker is advice with a label on
it, not a decision.
