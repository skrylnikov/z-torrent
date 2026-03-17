---
'@z-torrent/ut-pex': patch
'@z-torrent/core': patch
---

Refactor ut-pex package:

- Switch from default export to named export (`UtPex`)
- Use ECMAScript private fields (`#field`) instead of `private _field`
- Use `Uint8Array` instead of `Buffer` for cross-platform compatibility
- Extract types to separate `types.ts` file
- Export type definitions (`PEXFlags`, `DecodedPEXFlags`, `PEXMessage`, `Wire`, `PeerEntry`)
- Update README documentation
