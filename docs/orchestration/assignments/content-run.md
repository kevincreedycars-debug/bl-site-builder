# Assignment — content-run

Owner: `content-writer`. Writes one file: `data/content.json`.

## What it is for

Move each piece one honest step along: brief, research, draft, edit, approve,
publish, verify. One step, with the evidence for it.

## Reads

- `data/content.json` — every piece, its state, its ledger, its claims.
- `data/sites.json` — so a piece is not sent to a site that is returning 401.
- `data/eeat.json` — so an authority claim points at a source that exists.

## Writes

`data/content.json`, and nothing else. Publishing to a live site is not in this
assignment; it is the step after approval, and it needs its own evidence.

## Finished when

- Every piece sits in exactly one state, and the state matches the evidence:
  - `drafted` has a body and a ledger, and the ledger may be incomplete.
  - `edited` has a ledger with no unsourced claim left.
  - `approved` has an approver, a date, and a ledger that passed.
  - `published` has a URL that returned 200 and a body that matched the approved
    text, or a stated reason it could not be confirmed.
- A piece not moved has a note saying why it did not move.

## Stop and ask when

- A draft is ready to publish and the site module returns 401. Do not draft
  around a site that cannot be read.
- A claim has no source and no obvious place to find one. That is a research
  problem, and inventing a plausible source is the one failure that cannot be
  undone after publication.
- Two pieces are in the same subject and the same site. That is a cannibalisation
  decision, not a scheduling one.

## Evidence that counts

    claims_sourced 14 of 17        a ledger, counted
    GET <url> → 200, hash matched  a published piece that can be proved
    Plugin reported post id 4071   not evidence of publication on its own
