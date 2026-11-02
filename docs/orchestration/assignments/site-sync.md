# Assignment — site-sync

Owner: `site-connector`. Writes one file: `data/sites.json`.

## What it is for

Keep the record of each WordPress site true: is it reachable, does its login
still work, is the theme and plugin set the one that was approved, and when was
any of that last confirmed.

## Reads

- `data/sites.json` — every site, its status, its last check.
- `data/workspace.json` — the module list, so a site with no module slot is
  noticed.

## Writes

`data/sites.json`, and nothing else. Credentials stay in `.env` or `.local/` and
are never written to a file that git carries.

## Finished when

- Every site has a `checks` entry from this run, with `state` and the status code
  that was seen.
- A site marked `connected` was read with an authenticated REST call in this run,
  not remembered from a previous one.
- `_meta.as_of` is newer than the file it replaced.

## Stop and ask when

- A site returns 401 or 403 twice in a row. A wrong password is not a reason to
  keep trying; it is a reason to say the password is wrong.
- A site answers, but the REST shape is not the one expected. Then the site has
  changed in a way nobody described, and guessing at field names writes fiction
  into the file.
- A new site appears that is not in `data/workspace.json`. Adding it is a
  decision about the portfolio, not a sync step.

## Evidence that counts

    HTTP 200 on /wp-json/wp/v2/posts?per_page=1     a working login and a readable site
    HTTP 401                                        the login is refused; say so
    DNS failure                                     the site is not there; say so

"Connected" without a status code from this run is not evidence.
