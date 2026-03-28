---
'@z-torrent/core': patch
---

Add ICE restart on connection failure for WebRTC peers. When `iceConnectionState` transitions to `'failed'`, attempt `restartIce()` before destroying the peer. This improves connection reliability especially in Firefox which is more aggressive about declaring ICE failure.
