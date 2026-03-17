---
'@z-torrent/ut-metadata': patch
'@z-torrent/core': patch
---

Refactor ut-metadata package:

- Upgrade bitfield from v4 to v5
- Use ECMAScript private fields (`#field`) instead of `private _field`
- Switch from default export to named exports (`UtMetadata`, `createUtMetadata`)
- Fix TypeScript type errors, use `Uint8Array` instead of `Buffer`
- Update tests to use named imports and correct event types (handshake emits hex strings)
- Update README documentation to clarify that `createUtMetadata` is a factory function
- Update import in `@z-torrent/core` to use named export `createUtMetadata`
