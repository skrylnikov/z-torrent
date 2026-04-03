# Challenges, Risks & Missing Pieces

## Critical Challenges

### 1. Memory Pressure in Browser

**Problem:** The browser package uses `MemoryChunkStore` — all torrent data lives in RAM. A 10MB website means 10MB of JavaScript heap. A 50MB site with images can crash mobile browsers.

**Impact:** High. Directly limits maximum site size.

**Mitigation:**

- Use IndexedDB-backed store (`idb-chunk-store`) for persistence and memory relief
- Set hard limit on site sizes for browser viewing (e.g., 50MB)
- Lazy file loading — only keep frequently accessed pieces in memory, evict old ones
- The `priority` field in the manifest helps: download critical files first, lazy-load the rest

**Implementation effort:** Medium. Need to integrate or build an IndexedDB store adapter that implements the `ChunkStore` interface.

### 2. First Load Latency

**Problem:** Before the site renders, the browser must:

1. Load the portal JS (~200KB+ gzipped for ZTorrent bundle)
2. Register the Service Worker (cold start delay)
3. Connect to WSS trackers (WebSocket handshake)
4. Find peers (tracker announce round-trip)
5. WebRTC handshake with peers (ICE gathering, STUN/TURN)
6. Download torrent metadata (if using magnet hash only)
7. Download the entry HTML file + critical CSS/JS

Total cold start: **5-15 seconds** in optimistic conditions, potentially 30+ seconds if peers are slow.

**Mitigation:**

- **Web seed / HTTP fallback**: Seed server can also serve files via HTTP as a web seed. ZTorrent supports `urlList` in torrents — the client downloads from HTTP in parallel with BitTorrent peers. This gives near-instant loading for the first visitor.
- **Prefetch manifest**: Portal can fetch `zt-manifest.json` from the seed server's HTTP endpoint while the torrent connects — show site name and loading UI immediately.
- **SW warm cache**: Cache the portal bundle and SW aggressively — subsequent visits skip steps 1-2.
- **Piece prioritization**: Download HTML/CSS/JS first, images later. The manifest's `priority` field enables this.

**Implementation effort:** Low-Medium. Web seed support exists in `@z-torrent/core`. Need to include the seed server's HTTP URL in the torrent's `urlList`.

### 3. Service Worker Lifecycle

**Problem:** Service Workers have a complex lifecycle:

- First visit: SW isn't active yet — fetch events aren't intercepted until page reload or `clients.claim()`
- The existing SW calls `skipWaiting()` + `clients.claim()` on install/activate, which helps
- But if the SW is updated (portal redeploy), there's a window where old SW serves stale responses

**Impact:** Medium. Users might see a broken loading state on first visit if SW isn't ready.

**Current mitigation:** The existing code already handles this well:

- `skipWaiting()` in install handler
- `clients.claim()` in activate handler
- Portal waits for `navigator.serviceWorker.ready` before creating ZTorrent

**Remaining risk:** If the user navigates directly to `z-torrent.xyz/{hash}` and the SW isn't registered yet, the portal needs to handle this gracefully — show loading, register SW, then proceed.

### 4. Relative vs Absolute Paths in Torrent Sites

**Problem:** Sites might use different path strategies:

- Relative paths: `./style.css`, `../images/logo.png` — work correctly in iframe under `/z-torrent/{hash}/`
- Root-relative paths: `/style.css` — this resolves to `z-torrent.xyz/style.css`, NOT `z-torrent.xyz/z-torrent/{hash}/style.css`
- Absolute URLs: `https://cdn.example.com/style.css` — external, not in torrent

**Impact:** High. Root-relative paths are very common in SPAs (Vite, webpack default output).

**Mitigation options:**

1. **Rewrite at publish time**: `@z-torrent/publish` rewrites all `/` paths to relative paths in HTML/CSS/JS before creating the torrent.
   - Pro: Clean, one-time cost
   - Con: Complex — need HTML/CSS/JS parsing, can break dynamic paths

2. **`<base>` tag injection**: SW injects `<base href="/z-torrent/{hash}/">` into HTML responses.
   - Pro: Simple, handles most cases
   - Con: Can conflict with SPAs that set their own `<base>`, doesn't fix CSS `url(/path)` or JS `fetch('/api')`

3. **SW path rewriting**: SW intercepts requests from the iframe and rewrites root-relative paths to include the hash prefix.
   - Pro: Transparent to the site, handles all request types
   - Con: Performance overhead, complex to implement correctly

4. **Build tool config**: Documentation advises developers to use relative paths or configure `base` in their build tool (Vite `base: './'`, webpack `publicPath: './'`).
   - Pro: Zero runtime cost, proper solution
   - Con: Requires developer action, not automatic

**Recommended approach:** Combination of #3 and #4.

- Recommend `base: './'` in publish docs
- SW rewrites root-relative paths as a safety net
- `<base>` tag injection as an additional fallback

### 5. XSS / Security

**Problem:** We're running arbitrary HTML/JS from torrents inside an iframe on the same origin as the portal. Malicious torrent sites could:

- Access `parent.window` (same origin = no restrictions)
- Steal ZTorrent API keys or tokens
- Manipulate the portal's DOM
- Access other data on `z-torrent.xyz` origin (cookies, localStorage, etc.)

**Impact:** Critical if not addressed.

**Mitigation:**

1. **iframe sandbox**: `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups">`
   - Problem: `allow-same-origin` is needed for SW to work, but it negates most sandbox protections
   - This is inherently contradictory — SW requires same origin, sandbox requires different origin

2. **Separate origin for content**: Serve torrent sites from a different subdomain:
   - Portal: `z-torrent.xyz`
   - Content: `{hash}.sites.z-torrent.xyz` or `content.z-torrent.xyz`
   - SW scope covers the content subdomain
   - iframe cross-origin isolation provides security
   - **Problem:** SW must run on the content origin, but the ZTorrent instance runs on the portal origin. SW can't communicate cross-origin with the portal page.

3. **Separate SW per content origin**: Each content origin registers its own SW that communicates with the portal via `BroadcastChannel` or `postMessage`.
   - Very complex architecture

4. **Accept the risk with CSP**: Use strict CSP on the portal page to limit what iframe content can do:

   ```
   Content-Security-Policy: frame-src 'self'; script-src 'self'
   ```

   - Not a full solution — scripts in same-origin iframe bypass CSP

5. **SharedWorker approach**: Move ZTorrent instance to a SharedWorker. The SW communicates with the SharedWorker instead of the main page. This allows the iframe to be truly sandboxed.
   - SharedWorker runs the torrent client
   - SW forwards requests to SharedWorker via `BroadcastChannel`
   - Portal page and iframe are separate — iframe can be sandboxed
   - **Problem:** SharedWorker browser support is incomplete (no Safari support until Safari 18.4 / March 2025)

**Recommended approach for v1:** Accept the risk. Document it clearly. The iframe is same-origin, which means torrent sites can access the portal's JS context. This is the same trust model as IPFS gateway sites. For v1, this is acceptable because:

- Users navigate to sites they choose to visit
- The seed server validates content at publish time (basic checks)
- No sensitive data is stored on the portal origin

**Future improvement:** Migrate to SharedWorker + sandboxed iframe when browser support is sufficient, or use a separate content origin with a dedicated SW.

---

## Medium Challenges

### 6. Missing MIME Types in Service Worker

**Problem:** `worker-server.ts` line 79 calls `normalizeSwResponseContentType()` which only knows `.mkv` and `.mka`. For web hosting, incorrect MIME types mean:

- CSS files not applied (need `text/css`)
- JS files not executed (need `application/javascript`)
- Images not rendered (need `image/png`, etc.)
- WOFF2 fonts not loaded

**Impact:** High — sites will appear broken.

**Fix:** The BrowserServer already calls `serveFile()` which sets Content-Type from `file.type` (which uses `mime/lite`). The SW's `normalizeSwResponseContentType` only overrides when Content-Type is missing/generic. So the fix is to ensure `BrowserServer` always returns the correct Content-Type in the response headers sent via MessageChannel.

**Verification needed:** Check that `file.type` is correctly set for all common web extensions. `mime/lite` has good coverage but may miss some (`.wasm`, `.avif`, `.webm`, etc.).

### 7. Torrent Updates / Versioning

**Problem:** Any change to the site content changes the infoHash. There's no concept of "update" — each publish creates a new, unrelated torrent.

**Impact:** Medium. Users bookmark URLs with hashes — those become stale on updates.

**Mitigation (future):**

- **Version chain in manifest**: Add `previousVersion: "<old infoHash>"` to manifest. Portal can show "newer version available" notification.
- **DNS/name system**: Map a human-readable name to the latest infoHash. This is the domain system mentioned in the architecture doc.
- **DHT mutable items (BEP 44)**: Store latest infoHash under a public key in the DHT. Update without centralized infrastructure.

**For v1:** Accept that URLs are immutable. Each deploy gets a new URL. This is the IPFS model.

### 8. Large File Handling in Publish

**Problem:** `createTorrent()` reads all files into memory for hashing. For large sites (100MB+), this can exhaust Node.js memory.

**Impact:** Medium. Most static sites are <10MB, but sites with media assets could be larger.

**Mitigation:** `@z-torrent/create` already uses streaming hashing via `block-iterator`. The actual bottleneck would be in the seed server's upload endpoint, not the torrent creation. Use multipart streaming on the server side.

### 9. Browser Peer Discovery Reliability

**Problem:** Browser peers can only discover each other through WSS trackers. If all configured trackers are down, no peers can be found.

**Current trackers:**

- `wss://tracker.z-torrent.xyz` — own infrastructure
- `wss://tracker.openwebtorrent.com` — third-party
- `wss://tracker.webtorrent.dev` — third-party

**Impact:** Medium. If tracker.z-torrent.xyz goes down and third-party trackers change APIs or shut down, the entire system breaks for new visitors (existing peers can still share data if connected).

**Mitigation:**

- Run multiple tracker instances
- Use PEX (Peer Exchange) — peers share peer lists with each other, reducing tracker dependency
- Add more public trackers as fallback
- The seed server is always a peer — it connects via WSS trackers too, ensuring at least one source

### 10. Concurrent Request Handling in SW

**Problem:** When a page loads in the iframe, the browser makes many concurrent requests (HTML + CSS + JS + images + fonts). Each request goes through the MessageChannel pipeline:

1. SW sends message to portal page
2. Portal page looks up file in ZTorrent
3. Portal streams data back through port

If 20 requests fire simultaneously, the portal's single-threaded JS handles them sequentially.

**Impact:** Medium. Loading might feel slower than traditional hosting.

**Mitigation:**

- Small files (< 64KB) can be sent as complete body (not streamed), reducing round-trips
- The portal can handle multiple MessageChannel ports concurrently (it already does — each request gets its own `MessageChannel`)
- Cache responses in SW using Cache API for repeat requests (torrent content is immutable)
- Prioritize document/stylesheet/script requests over image/font

### 11. Torrent-in-Torrent Streaming (Host SDK)

**Problem:** A site hosted inside the portal iframe (itself loaded from a torrent) may want to stream content from a different torrent — e.g., a movie site that plays a video file. The hosted site has no direct access to the portal's ZTorrent client; it runs in an iframe with no torrent client of its own.

**Impact:** Medium. This is needed for interactive demos (e.g., Sintel site streaming Sintel.mp4).

**Mitigation:**

- **Host SDK (`@z-torrent/host-sdk`)**: A lightweight PostMessage-based SDK that hosted sites use to communicate with the parent portal. The SDK sends a `z-torrent:add-torrent` message; the portal adds the torrent to its singleton client and returns file URLs back to the iframe.
- **URL-based streaming**: Once the portal responds with file URLs (`/z-torrent/<hash>/<path>`), the iframe uses them directly as `<video src>`, `<img src>`, etc. The SW intercepts these requests and streams data from the torrent.
- **Range requests**: `ServerBase.serveFile` already handles HTTP 206 partial content, which is required for video seeking. No additional work needed.
- **Piece prioritization**: The ZTorrent client automatically prioritizes pieces needed for playback. For video, the browser requests sequential byte ranges, which maps well to torrent piece downloading.

**Remaining concerns:**

- Adding a large video torrent increases memory and bandwidth usage in the portal's single ZTorrent client
- The portal should set reasonable limits on what torrents hosted sites can request (size, count)
- SDK message validation — the portal should verify message origin to prevent abuse

---

## Low Challenges

### 12. No SEO

**Problem:** Search engines can't index torrent-hosted sites. The content is only available after JavaScript execution + SW registration + torrent download.

**Impact:** Low for v1. Decentralized hosting is not primarily about SEO.

**Future:** Seed server could serve HTML directly for crawler User-Agents (like SSR/prerender services do).

### 13. No Analytics

**Problem:** Standard analytics (Google Analytics, Plausible) work fine inside the iframe — scripts execute normally. But the portal itself has no visibility into which sites are popular.

**Impact:** Low.

**Mitigation:** The seed server's `upload` event tracking provides basic metrics (how much was uploaded = how many visitors requested data). More detailed analytics can be added to the portal JS (track `loadTorrent` calls).

### 14. Mobile Performance

**Problem:** WebRTC on mobile browsers consumes battery and bandwidth. MemoryChunkStore uses RAM that's limited on phones.

**Impact:** Low-Medium.

**Mitigation:**

- Limit active peer connections on mobile (`maxConns: 5`)
- Use web seed (HTTP fallback from seed server) as primary source on mobile, P2P as bonus
- Consider IndexedDB store to reduce memory pressure

### 15. CORS for Fonts and APIs

**Problem:** Fonts in torrent sites need CORS headers. `@font-face` with `url('/fonts/Inter.woff2')` loaded through the SW might fail without `Access-Control-Allow-Origin`.

**Impact:** Low — fonts are common, but the SW serves from same origin so CORS is not technically an issue.

**Fix:** Ensure SW responses include `Access-Control-Allow-Origin: *` for font files (or all files). The existing `ServerBase` already sets CORS headers.

---

## What Was Missing From The Original Spec

### 1. Web Seeds (HTTP Fallback)

**Critical addition.** Without web seeds, the first visitor to a new site waits for the full torrent download via BitTorrent protocol. With web seeds, the seed server also serves files via HTTP — the ZTorrent client downloads from both HTTP and BitTorrent simultaneously.

The `urlList` field in torrents already supports this. `@z-torrent/publish` should add the seed server's HTTP URL to the torrent's `urlList` when creating the torrent.

```json
{
  "urlList": [
    "https://seed.z-torrent.xyz/downloads/08ada5a.../",
    "https://seed2.z-torrent.xyz/downloads/08ada5a.../"
  ]
}
```

This gives instant loading for the first visitor while still benefiting from P2P for popular sites.

### 2. Caching in Service Worker

Torrent content is **immutable** (content-addressed by hash). The SW should cache responses in the Cache API:

```typescript
// In worker-server.ts
const CACHE_NAME = 'z-torrent-sites-v1'

async function handleFetch(event) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(event.request)
  if (cached) return cached

  const response = await serve(event)
  if (response.ok) {
    cache.put(event.request, response.clone())
  }
  return response
}
```

This means:

- First load: fetch from torrent (slow)
- Second load: instant from cache
- Cache never invalidates (content-addressed = immutable)
- Different hashes = different cache entries = no stale content

### 3. Offline Support

Combined with SW caching, torrent sites become **fully offline-capable** after the first visit. The Cache API persists across browser sessions. This is a major feature for free — just implement SW caching.

### 4. Progressive Loading UX

The portal should show content as it becomes available:

- Skeleton / loading placeholder while HTML downloads
- Inline the first HTML response as soon as it's ready (don't wait for all assets)
- CSS/JS load progressively — the browser's natural loading behavior handles this in the iframe
- Show a subtle "loading assets" indicator for remaining files

### 5. Error Recovery

What happens when:

- A piece fails verification? ZTorrent re-requests from another peer
- All peers disconnect? Show "No peers available, retrying..." in loading screen
- Seed server is down? Try web seeds, fall back to P2P only
- SW crashes? Page reload re-registers SW
- Browser tab is backgrounded? Throttle connections, pause non-critical downloads

### 6. torrent content validation at publish time

The publish CLI should validate:

- Entry file exists (`index.html` or configured entry)
- No files exceed individual size limits
- No forbidden file types (`.exe`, `.bat`, etc. — configurable)
- Total size within limits
- Valid HTML in entry file (optional, warn-only)
- No references to external scripts from suspicious origins (optional, warn-only)

---

## Implementation Order

Recommended phase order for development:

### Phase 1: Core Infrastructure

1. Modify `server-base.ts` — hosting mode (remove forced download, fix caching, relax CSP, directory index)
2. Modify `worker-server.ts` — increase timeouts, improve MIME handling
3. Create manifest types in `packages/publish/src/types.ts`

### Phase 2: Publish CLI

4. Create `packages/publish/` package scaffolding
5. Implement config loading + manifest generation
6. Implement torrent creation wrapper
7. CLI entry point with dry-run mode

### Phase 3: Seed Server API

8. Add API routes to `examples/seed-server/`
9. SQLite storage for deployments
10. API key validation + rate limiting
11. TTL cleanup job
12. Health check endpoint

### Phase 4: Web Portal

13. Create `examples/web-portal/` with Vite + Svelte
14. Landing page component
15. Torrent loader logic
16. Viewer component (iframe)
17. Status indicator + panel
18. Loading screen with progress

### Phase 5: Integration & Demo

19. Create Sintel demo site (`examples/sintel-web/`)
20. Publish Sintel demo via CLI
21. End-to-end test: publish -> seed server -> portal -> view
22. Docker setup for seed server with API

### Phase 6: Polish

23. SW caching for immutable content
24. Web seed integration (HTTP fallback)
25. Path rewriting for root-relative paths
26. Error recovery and retry logic
27. Mobile optimizations

---

## Feasibility Assessment

**Can this all be implemented? Yes.**

The existing z-torrent codebase provides 80% of what's needed:

- Browser torrent client with SW-based file serving: **done**
- Torrent creation from files: **done**
- Node.js seeder with WebRTC: **done**
- Docker deployment: **done**
- WSS tracker infrastructure: **done**
- STUN/TURN infrastructure: **done**

What needs to be **built new:**

- `server-base.ts` hosting mode modifications (~100 lines changed)
- `@z-torrent/publish` package (~500 lines)
- Seed server API extension (~800 lines)
- Web portal (~1500 lines including Svelte components)
- Sintel demo site (~200 lines)

**Total estimated new code: ~3000 lines.** This is a medium-sized project, feasible for one developer in 2-4 weeks.

The biggest architectural risk is the **same-origin security issue** (challenge #5). For v1, this is acceptable with documentation. For production use with untrusted content, the SharedWorker + separate origin approach should be pursued.
