# What is here now

Last checked: 9 November 2026, against the seed files in `data/`.

## Working

| Part | State | Proof |
|---|---|---|
| Page shell, nine views, hash routing | working | `npm test` draws every view from the real files |
| The rules in `js/core.js` | working | 37 tests in `tests/core.test.js` |
| The data files | valid seed data | 9 tests in `tests/data.test.js` |
| The map's model in `js/scene.js` | working | 14 tests in `tests/scene.test.js` |
| The map's canvas in `js/map3d.js` | working, unlooked at | 2 tests in `tests/map3d.test.js`; the picture itself needs an eye |
| Every view survives a missing file | working | 13 tests in `tests/views.test.js`, one of them the map's tables |
| Static server | working | `npm run serve` |
| HTTP check | working | `npm run check`, 15 checks |
| Published site | working | `npm run live`, 8 checks against the URL below |
| Monitor | working | `npm run monitor` prints 44 items from the seed |
| Secret scan | working | `npm run scan`, and it caught a probe file when tested |
| Pre-commit hook | working | ran by hand, passes |
| Harness check | working | `npm run harness`, 9 of 9 checks |
| Run gate | working | `npm run gate` says no, because no engine is connected |
| Scheduled run | unexercised | the workflow has never run on GitHub; the gate logic under it has |

75 tests in total: 37 rules, 9 data, 13 views, 14 model, 2 canvas.

Published at `kevincreedycars-debug.github.io/bl-site-builder`, GitHub Pages,
`master`, folder root. A push is live within about a minute.

What the page shows, from the seed data: five sites, three connected and one
erroring; fourteen content pieces across ten states; twelve paid placements, two
of them lost; four sending domains and eight mailboxes, one of them risky; one
business entity, its sources, twenty-five citation entries and six workers; six
runs. The attention list comes to 44 items, 15 of them high. The map draws the
same files as 66 objects across six layers.

## Not built

- **No engine.** `data/workflow-control.json` says `refresh_enabled: false` and
  `dry_run_only: true`, and the reason field says why. The Run button renders
  disabled because it is disabled, not to look cautious.
- **No live connection to any site.** `data/sites.json` records the shape of a
  REST check; nothing performs one. The seed marks Verdant Table as returning
  401 and that is a fixture, not a measurement.
- **No sender.** `data/email.json` describes domains and mailboxes. No SMTP
  login exists here, and none should.
- **No scheduled job that writes data.** The workflow file under
  `.github/workflows/` can start a run and check that the run wrote its record.
  It cannot produce content.
- **No authentication on the page.** Which is why nothing secret may be in it.

## The gap that matters

The dashboard is a faithful picture of ten seed files. It is not yet a picture of
anything real. The distance between those two is one run that replaces a file:
`data/sites.json` written by a connection, not by a fixture. Until that happens,
every number on the page is an example, and the page says so in the header
whenever a file is older than a day.

## Housekeeping

- Line endings are LF in the repository and in the working tree, decided in
  `.gitattributes`, because published hashes are compared byte for byte.
- `tmp/` and `.local/` are ignored and used for scratch. `tmp/smoke.mjs` is such
  a scratch file and is not part of the dashboard.
