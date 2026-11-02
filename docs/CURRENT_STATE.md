# What is here now

Last checked: 2 November 2026, against the seed files in `data/`.

## Working

| Part | State | Proof |
|---|---|---|
| Page shell, eight views, hash routing | working | `npm test` draws every view from the real files |
| The rules in `js/core.js` | working | 37 tests in `tests/core.test.js` |
| The data files | valid seed data | 9 tests in `tests/data.test.js` |
| Static server | working | `npm run serve` |
| HTTP check | working | `npm run check`, 14 checks |
| Monitor | working | `npm run monitor` prints 38 items from the seed |
| Secret scan | working | `npm run scan`, and it caught a probe file when tested |
| Pre-commit hook | working | ran by hand, passes |
| Harness check | working | `npm run harness`, 9 of 9 checks |
| Run gate | working | `npm run gate` says no, because no engine is connected |
| Scheduled run | unexercised | the workflow has never run on GitHub; the gate logic under it has |

57 tests in total: 37 rules, 9 data, 11 rendering.

What the page shows, from the seed data: five sites, three connected and one
erroring; fourteen content pieces across ten states; twelve paid placements, two
of them lost; four sending domains and eight mailboxes, one of them risky; one
business entity, its sources and six workers; six runs. The attention list comes
to 38 items, 14 of them high.

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

The dashboard is a faithful picture of eleven seed files. It is not yet a
picture of anything real. The distance between those two is one run that
replaces a file: `data/sites.json` written by a connection, not by a fixture.
Until that happens, every number on the page is an example, and the page says so
in the header whenever a file is older than a day.

## Housekeeping

- Line endings are LF in the repository and in the working tree, decided in
  `.gitattributes`, because published hashes are compared byte for byte.
- `tmp/` and `.local/` are ignored and used for scratch. `tmp/smoke.mjs` is such
  a scratch file and is not part of the dashboard.
