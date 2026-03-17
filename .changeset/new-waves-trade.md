---
'@z-torrent/ut-metadata': patch
---

Refactor ut-metadata package:

- Upgrade bitfield from v4 to v5
- Use ECMAScript private fields (`#field`) instead of `private _field`
- Switch from default export to named exports (`UtMetadata`, `createUtMetadata`)
- Fix TypeScript type errors, use `Uint8Array` instead of `Buffer`
- Update tests to use named imports and test public behavior
- Update README documentation
