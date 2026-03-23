---
'@z-torrent/core': patch
---

Fix browser streaming throughput (“pipeline starvation”):

- Call `#update()` after piece selections are inserted (`#select`) so `selectStreamPieces` / `FileIterator` immediately resumes downloads when the prefetch loop had stalled.
- Call `#update()` from `critical()` so prioritized pieces start fetching right away.
- Fill each wire’s block pipeline in one `#update()` pass by looping `#updateWireWrapper()` until no wire can enqueue another request (fair round-robin preserved).
- Use a shorter `requestIdleCallback` timeout (50ms) on browser platforms so refills are less delayed under main-thread load.
