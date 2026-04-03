---
'@z-torrent/tracker': patch
---

Use `WeakMap` for buffering trickle ICE candidates instead of storing them directly on the simple-peer instance. This prevents a name collision with simple-peer's internal `_pendingCandidates` property, which caused a crash ("can't access property forEach") when the answer was received after our code deleted the property.

The WebSocket tracker client also picks up related hardening and behaviour tweaks from the same workstream (connection lifecycle, announcements, tests) so WSS-based discovery stays reliable alongside the hosting and portal work.
