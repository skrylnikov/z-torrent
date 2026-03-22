---
'@z-torrent/core': patch
---

**@z-torrent/core**

- Prefer npm typings: add `@types/debug`, `@types/escape-html`, `@types/mime`, `@types/range-parser`, `@types/streamx`, `@types/unordered-array-remove`; shrink `types/shims.d.ts` to modules without usable `@types` (incl. `run-parallel` / `run-parallel-limit` — DT signatures don’t match this codebase).
- Remove `cross-fetch-ponyfill`; use global `fetch` (Node ≥18 / DOM `lib`).
- Add `src/lib/streamx-pipeline.ts` — runtime `streamx` exports `pipeline`, but `@types/streamx` does not declare it.
- Correct `speed-limiter` shim: `throttle()` returns a `Transform` for `pipeline()`.
- Type fixes around protocol `Wire` vs strict `@types/streamx` stream events (`webconn`, `rarity-map`, `peer`); remove unused private `#hasStartupBitfield`.

**Dependencies**

- Bump `bitfield` to `^5.0.1` in `@z-torrent/core`, `@z-torrent/protocol`, and `@z-torrent/ut-metadata`.

**Repo hygiene**

- Delete root `types/cross-fetch-ponyfill.d.ts`.
- **@z-torrent/dht**: `parseIp` — avoid useless final `offset++` (eslint `no-useless-assignment`).
- **@z-torrent/tracker**: drop redundant `try/catch` rethrow in tests (eslint `no-useless-catch`).
