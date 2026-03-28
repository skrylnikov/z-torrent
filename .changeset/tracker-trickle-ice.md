---
'@z-torrent/tracker': patch
---

Enable trickle ICE for faster WebRTC connection establishment in Firefox and other browsers. ICE candidates are now sent incrementally through the tracker instead of waiting for full gathering before signaling. The tracker server now forwards ICE candidate messages between peers. Backward compatible with non-trickle peers via peer reflexive candidate discovery.
