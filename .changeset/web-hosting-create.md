---
'@z-torrent/create': patch
---

Route piece-length calculation through `calcPieceLength` from `@z-torrent/utils` when building torrents from files or streams. That keeps sizing rules aligned with the publish pipeline and other packages instead of duplicating heuristics inside `create`.

Consumers should see identical piece layouts where they also use the shared helper elsewhere; no public API surface change beyond depending on the updated utils behaviour.
