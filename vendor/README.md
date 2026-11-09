# vendor/

One file. It is three.js, unmodified.

| what | value |
| --- | --- |
| file | `three.module.js` |
| version | r170 (`three@0.170.0`) |
| taken from | `cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js` |
| licence | MIT, Copyright 2010-2024 Three.js Authors, header kept in the file |
| bytes | 1,314,659 |
| sha256 | `ce1fa418de16a19495a9f72495580e3015d7745c296d3ce0485897f902ddedfb` |
| used by | `js/map3d.js`, imported only when the Map view is opened |

## Why a copy and not a `<script src="https://…">`

- The page must load with no other host answering. `scripts/verify-dashboard.js`
  fails the build when `index.html` names another host, and a page that borrows
  its renderer from a CDN cannot promise that.
- A pinned copy cannot change under the page between two loads. A floating
  version can, and then the same file draws two different pictures.
- It keeps the rule that a file edit is live on the next reload. There is still
  no bundler, no `npm install` and nothing to compile.

What it costs: 1.3 MB in the repository, and one more thing to keep current.

## Updating it

1. Download the new build from the same path, with the new version number.
2. Replace `three.module.js` and update the version, bytes and sha256 above.
3. Run `npm test`, `npm run check` and `npm run scan`.

The scan reads this file line by line like any other. If a line here ever trips
it, the answer is to look at the line, not to add an exclusion.
