# Agent manual

How work moves through the harness: who may do what, what an assignment contains,
and what a submission has to prove before it counts.

## The pieces

    docs/orchestration/projects.json          the register: what exists, who owns it
    docs/orchestration/assignments/*.md       one file per kind of work
    docs/orchestration/templates/submission.json   what comes back
    data/workers.json                         who is working, on what, since when
    data/runs.json                            what ran, and how it ended
    data/workflow-status.json                 written by a run, as its last act

`scripts/coordination.js` reads the register, the assignments, the template and
the data files, and says whether they agree. Run it after editing any of them:

    node scripts/coordination.js

## The five kinds of work

| Kind | Owner | May write | Must not |
|---|---|---|---|
| `site-sync` | site-connector | `data/sites.json` | store a password anywhere |
| `content-run` | content-writer | `data/content.json` | publish, or approve its own draft |
| `link-check` | coordinator | `data/backlinks.json` | mark a link verified without a live fetch |
| `citation-sweep` | citation-builder | `data/eeat.json` | edit the entity details to match a listing |
| `email-warmup` | email-ops | `data/email.json` | send from an unauthenticated domain |

The direction of the last row matters: the entity is the truth and the listings
are corrected to it, never the other way round. If a listing disagrees, the
listing is wrong until a person says otherwise.

## What an assignment says

Every assignment file must state, in this order:

1. **What it is for** — one sentence, in plain words.
2. **What it reads** — the files, and which fields.
3. **What it may write** — one file. An assignment that writes two files is two
   assignments.
4. **When it is finished** — the evidence, not the activity. "Every placement has
   a fetch result newer than the last check", not "links checked".
5. **When it must stop and ask** — the conditions where guessing would be worse
   than waiting.

## What a submission must contain

The shape is in `templates/submission.json`. In substance:

- `kind` — one of the five above.
- `run_id` — unique, and it must appear in `data/runs.json` once the run ends.
- `as_of` — when the data was true, not when the submission was written.
- `evidence` — for each claim, what was measured and what came back. "Checked"
  is not evidence. `HTTP 200, anchor text matched` is.
- `changed` — the files written, and for each one what changed.
- `unknowns` — what could not be determined, said out loud. An empty list is a
  claim, and a claim that is usually false.
- `money` — anything with a refund or a charge attached, named.

A submission with no `unknowns` and no evidence is rejected before it is read.

## House rules every agent follows

1. Read the file before writing it. The data files are the only truth, and they
   are edited by other people.
2. Never invent a value to fill a gap. Write the gap down in `unknowns`.
3. Never write a credential into a file that git carries.
4. Never mark work finished on the strength of an intention. If the fetch did not
   happen, the field stays as it was.
5. One file per run, one run per record. A run that writes no record did not run.

## How a run is judged

    started     a run record exists with started_at, and the record is newer than
                the data it was meant to refresh
    finished    data/workflow-status.json names the same run_id and says success
    useful      the files it wrote have a newer _meta.as_of than the _meta.as_of
                they replaced
    honest      the unknowns list is not empty when something was unreachable

A run that finished but wrote nothing newer has not refreshed anything. That is
the failure the status file exists to catch.
