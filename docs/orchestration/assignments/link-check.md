# Assignment — link-check

Owner: `coordinator`. Writes one file: `data/backlinks.json`.

## What it is for

Keep the inventory of paid placements true: what was sold, where it was placed,
and whether the link is still there. A buyer pays for a live link, not for a
report that says it was placed.

## Reads

- `data/backlinks.json` — every placement, its URL, its anchor, its last check.
- `data/sites.json` — whether the host site is reachable at all.

## Writes

`data/backlinks.json`, and nothing else.

## Finished when

- Every placement has a `last_check` from this run with, at minimum, the status
  code and whether the anchor text was found in the body.
- `verified` means: fetched this run, 200, anchor present, and `nofollow` /
  `sponsored` recorded as seen. Nothing else is `verified`.
- `lost` means: fetched this run and the page or the link is gone.
- A placement on a site that cannot be fetched is neither verified nor lost. It
  keeps its state and gains an `unknown` check with the reason.

## Stop and ask when

- A whole site is unreachable. Its links are unknown, and marking them lost would
  charge a refund for an outage.
- A page returns 200 but the anchor is gone. That is a change in what the buyer
  bought, and it may be worth a conversation before a refund.
- A placement has no URL recorded. That is a sales record problem, and a fetch
  cannot invent the page it was sold on.

## Evidence that counts

    GET https://atlas-workshop.example/workbench-height/ → 404, anchor absent
    GET https://verdant-table.example/preserving/ → 401, site-wide, unknown
    placement report says "live"                    not evidence

## The failure this catches

A link sold as live that has been gone for three weeks. The seller finds out from
the buyer, which is the most expensive way to find out.
