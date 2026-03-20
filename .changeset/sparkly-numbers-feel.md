---
'@z-torrent/magnet': minor
'@z-torrent/parse': patch
---

Refactor @z-torrent/magnet package

- Remove default export, export `magnet` object with `decode` and `encode` methods instead
- Fix TypeScript type errors throughout the codebase
- Fix import of `@thaunknown/thirty-two` (use default import)
- Add `xl` property to `MagnetURI` and `MagnetURIEncodeInput` types
- Update README with new API usage examples
- Update `@z-torrent/parse` to use new magnet API

Breaking change: Default export removed. Use `import { magnet } from '@z-torrent/magnet'` instead of `import magnet from '@z-torrent/magnet'`.
