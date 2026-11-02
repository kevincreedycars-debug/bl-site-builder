# Assignment — citation-sweep

Owner: `citation-builder`. Writes one file: `data/eeat.json`.

## What it is for

Make the business legible: one set of name, address and phone details, and a
record of which directories and profiles agree with it, which do not, and which
have not been checked.

## Reads

- `data/eeat.json` — the entity, the sources, the entries, the authors.
- `data/sites.json` — so a citation points at a site that exists and can be read.

## Writes

`data/eeat.json`, and nothing else. Entries are corrected to the entity. The
entity is never edited to match a listing: if a listing says a phone number that
was disconnected in September, the listing is wrong.

## Finished when

- Every source has a state: `verified`, `pending` with an owner and a date,
  `missing`, `mismatch` with the field that differs, or `rejected` with a reason.
- The entity has all of name, address and phone, or the file says which is
  missing and what is blocked on it.
- No entry claims `verified` from a directory that was not fetched this sweep.

## Stop and ask when

- The entity details are incomplete. Fill them once; correcting ten listings to a
  guess is ten more things to fix later.
- A source has changed its rules for editing a listing (a login, a fee, a
  callback). That is a new decision, not a retry.
- Two listings disagree with each other and both look current. Then the business
  details themselves may have changed, and only a person knows.

## Evidence that counts

    Fetched, NAP matched on all three fields      verified
    Fetched, phone differs from the entity        mismatch, with the phone seen
    Directory requires a login to see the listing pending, named, with an owner
    "Should be fine"                              not evidence
