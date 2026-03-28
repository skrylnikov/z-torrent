---
'@z-torrent/tracker': patch
---

Use `WeakMap` for buffering trickle ICE candidates instead of storing them directly on the simple-peer instance. This prevents a name collision with simple-peer's internal `_pendingCandidates` property, which caused a crash ("can't access property forEach") when the answer was received after our code deleted the property.
