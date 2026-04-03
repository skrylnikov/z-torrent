# Z-Torrent Web Hosting — Architecture

## Overview

Decentralized web hosting platform built on top of z-torrent. Static websites are packaged as torrents, seeded by seed servers and browser peers, and rendered in an iframe inside the z-torrent.xyz portal. All assets (HTML, CSS, JS, images) are served from torrent data via a Service Worker.

## Components

```
+------------------+     publish      +------------------+
|                  | --------------> |                  |
|  @z-torrent/     |   .torrent +    |  seed-server     |
|  publish (CLI)   |   manifest      |  (seed server)   |
|                  |                 |                  |
+------------------+                 +-------+----------+
                                             |
                                             | seeds via WebRTC
                                             | + TCP/uTP
                                             v
+--------------------------------------------------------------------+
|                        z-torrent.xyz (portal)                      |
|                                                                    |
|  +-------------------+    +-----------+    +--------------------+  |
|  |                   |    |           |    |                    |  |
|  |  Portal UI        |    |  ZTorrent |    |  Service Worker    |  |
|  |  (Vite + Svelte)  |    |  Instance |    |  (fetch intercept) |  |
|  |                   |    |           |    |                    |  |
|  +--------+----------+    +-----+-----+    +---------+----------+  |
|           |                     |                    |             |
|           |  iframe src=       |  MessageChannel    |             |
|           |  /z-torrent/       |  (file data)       |             |
|           |  {hash}/...        |                    |             |
|           v                     v                    v             |
|  +------------------------------------------------------------+   |
|  |                                                            |   |
|  |  iframe (fullscreen)                                       |   |
|  |  Torrent site rendered here                                |   |
|  |  All sub-requests intercepted by SW                        |   |
|  |                                                            |   |
|  +------------------------------------------------------------+   |
|                                                                    |
|  [Status Indicator] — floating overlay, z-index above iframe       |
|                                                                    |
+--------------------------------------------------------------------+
```

## Data Flow

### 1. Publish Flow

```
Developer's machine                    Seed Server
      |                                     |
      |  1. z-torrent-publish reads         |
      |     z-torrent.config.json           |
      |                                     |
      |  2. Creates .torrent from           |
      |     build output (dist/)            |
      |                                     |
      |  3. Generates zt-manifest.json      |
      |     and includes it in torrent      |
      |                                     |
      |  4. POST /api/publish               |
      |     {apiKey, .torrent, manifest}     |
      |  ---------------------------------> |
      |                                     |  5. Validates key + limits
      |                                     |  6. Saves .torrent
      |                                     |  7. Starts downloading/seeding
      |                                     |
      |  8. Poll GET /api/status/{hash}     |
      |  ---------------------------------> |
      |                                     |  9. Returns {ready: true}
      |  <--------------------------------- |     when torrent is seeded
      |                                     |
      |  10. Output:                        |
      |      zt://08ada5a7a618...           |
      |      https://z-torrent.xyz/08ada... |
      |                                     |
```

### 2. User Access Flow

```
Browser                        SW                     ZTorrent           Seed/Peers
   |                           |                         |                    |
   |  1. Navigate to           |                         |                    |
   |     z-torrent.xyz/        |                         |                    |
   |     {hash}                |                         |                    |
   |                           |                         |                    |
   |  2. Portal JS loads,      |                         |                    |
   |     registers SW,         |                         |                    |
   |     creates ZTorrent      |                         |                    |
   |                           |                         |                    |
   |  3. client.add(hash) -----|-----------------------> |                    |
   |                           |                         |  4. Connect to     |
   |                           |                         |     WSS trackers   |
   |                           |                         |  ----------------> |
   |                           |                         |                    |
   |                           |                         |  5. Download       |
   |  6. Show progress         |                         |     pieces         |
   |     (loading screen)      |                         |  <---------------> |
   |                           |                         |                    |
   |  7. Read manifest from    |                         |                    |
   |     torrent files         |                         |                    |
   |                           |                         |                    |
   |  8. Set iframe.src =      |                         |                    |
   |     /z-torrent/{hash}/    |                         |                    |
   |     index.html            |                         |                    |
   |                           |                         |                    |
   |  iframe requests:         |                         |                    |
   |  GET /z-torrent/{hash}/   |                         |                    |
   |      index.html           |                         |                    |
   |  -----------------------> |  9. Forward via         |                    |
   |                           |     MessageChannel      |                    |
   |                           |  ---------------------> |                    |
   |                           |                         | 10. Read file      |
   |                           |  <--------------------- |     from store     |
   |                           |     {status, headers,   |                    |
   |  <----------------------- |      body}              |                    |
   |                           |                         |                    |
   |  GET style.css            |  (same flow)            |                    |
   |  GET app.js               |  (same flow)            |                    |
   |  GET logo.png             |  (same flow)            |                    |
   |                           |                         |                    |
```

### 3. Seeding Flow (Browser P2P)

After the portal downloads a torrent, the browser client automatically seeds pieces to other peers. This means popular sites become faster as more users visit them — each visitor becomes a seeder.

```
Visitor A (seeder)  <--- WebRTC --->  Visitor B (new)
         ^                                   ^
         |           WebRTC                  |
         +---------- peer exchange ----------+
         |                                   |
         v                                   v
   WSS Tracker (signaling only)      Seed Server (seed)
```

### 4. Hosted Site ↔ Portal Communication (Host SDK)

Hosted sites running inside the portal iframe can request additional torrents (e.g., video files) from the portal's ZTorrent client. This is done via `@z-torrent/host-sdk`, a lightweight PostMessage-based SDK.

```
sintel-web (iframe)                  web-portal (parent)
───────────────────                  ──────────────────
SDK.add(magnetURI) ──postMessage──► Viewer message handler
                                     │
                                     ▼
                                    client.add(magnetURI)
                                     │ (wait for metadata)
                                     ▼
                   ◄──postMessage── { files: { 'Sintel.mp4': '/z-torrent/<hash>/Sintel.mp4' } }

video.src = url    ──HTTP request──► Service Worker intercepts
                   ◄── stream ───── SW streams from torrent (range requests)
```

The portal's singleton ZTorrent client adds the requested torrent, waits for metadata, then returns a map of `{ filename: fileURL }`. The hosted site can use these URLs directly as `<video src>`, `<img src>`, etc. The SW already handles range requests (HTTP 206) for video streaming, so progressive playback works out of the box.

See `docs/portal.md#host-sdk-integration` for the full PostMessage protocol specification.

## URL Scheme

### Current (v1)

```
zt://{infoHash}                          — native protocol (future)
https://z-torrent.xyz/{infoHash}         — web access (portal)
https://z-torrent.xyz/{infoHash}/page    — deep link to specific page
```

The `infoHash` is a 40-character hex string (SHA-1 of torrent info dict). It uniquely identifies the content — any change to the site produces a new hash.

### Future (v2) — Domain System

TBD. Ideas to explore:

- DNS TXT records pointing to infoHash (like ENS/IPNS)
- On-chain name registry (expensive, complex)
- Centralized name service on z-torrent.xyz (simplest, but centralized)
- DHT-based name resolution (BEP 44 mutable items)

## Existing Code — Required Changes

### `packages/browser/src/lib/worker-server.ts`

The SW fetch handler currently only intercepts URLs containing `z-torrent/` in the path. For web hosting, the URL pattern already works — iframe requests go to `/z-torrent/{hash}/path`. Changes needed:

| Line    | Current                                     | Required Change                                      |
| ------- | ------------------------------------------- | ---------------------------------------------------- |
| 79      | MIME normalization only knows `.mkv`/`.mka` | Add full MIME coverage via `mime/lite` in SW bundle  |
| 104-109 | 5s timeout for non-document streams         | Increase or remove — CSS/JS can take time from swarm |

### `packages/core/src/lib/server-base.ts`

| Line    | Current                                                | Required Change                                                              |
| ------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 158-159 | `Cache-Control: no-cache, no-store`                    | Configurable — `immutable, max-age=31536000` for hosting                     |
| 166-170 | Forces `Content-Disposition: attachment` for documents | Disable in hosting mode — HTML must render inline                            |
| 210     | Restrictive CSP (blocks forms, frames)                 | Relax for hosting mode                                                       |
| 221-223 | Hardcoded 404 for `favicon.ico`                        | Remove — look up in torrent files                                            |
| 260     | Exact file path match only                             | Add directory index resolution (`/` -> `/index.html`)                        |
| N/A     | No SPA support                                         | Add fallback to `index.html` for unmatched paths (configurable via manifest) |

### `packages/core/src/interfaces.ts`

`ServerOptions` needs new fields:

```typescript
interface ServerOptions {
  // ... existing
  hostingMode?: boolean // enable web hosting behavior
  manifest?: ZTManifest // site manifest for routing rules
}
```

## New Components

| Component       | Location                | Type                           | Description                                                          |
| --------------- | ----------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Web Portal      | `examples/web-portal/`  | Vite + Svelte SPA              | Main user-facing site at z-torrent.xyz                               |
| Publish CLI     | `packages/publish/`     | npm package + CLI              | Creates torrents from sites, pushes to seed                          |
| Seed Server API | `examples/seed-server/` | Extension of existing          | REST API for publish/status/stats                                    |
| Host SDK        | `packages/host-sdk/`    | npm package (IIFE bundle)      | PostMessage SDK for hosted sites to request torrents from the portal |
| Sintel Demo     | `examples/sintel-web/`  | Astro app                      | Demo site with torrent-based video streaming via Host SDK            |
| Manifest Schema | `packages/publish/`     | TypeScript types + JSON schema | `zt-manifest.json` format                                            |

## Technology Stack

| Layer                    | Technology               | Reason                                        |
| ------------------------ | ------------------------ | --------------------------------------------- |
| Portal UI                | Vite + Svelte 5          | Lightweight SPA, no framework overhead        |
| Portal hosting           | Static files (Nginx/CDN) | Simple deployment, cacheable                  |
| Torrent client (browser) | `@z-torrent/browser`     | Existing package, WebRTC + SW                 |
| Torrent client (server)  | `@z-torrent/node`        | Existing package, TCP + uTP + WebRTC          |
| Host SDK                 | `@z-torrent/host-sdk`    | PostMessage bridge for hosted sites → portal  |
| Seed server              | Bun + Hono/native HTTP   | Already runs on Bun, lightweight API          |
| Publish CLI              | Bun executable           | Consistent with monorepo tooling              |
| Service Worker           | Existing SW + extensions | Already handles fetch intercept               |
| Peer discovery           | WSS trackers             | Required for browser WebRTC signaling         |
| NAT traversal            | STUN + TURN              | Existing infrastructure at turn.z-torrent.xyz |

## Deployment Topology

```
                    Internet
                       |
          +------------+------------+
          |            |            |
     CDN/Nginx    WSS Tracker   TURN Server
     z-torrent.xyz  tracker.     turn.
          |         z-torrent.   z-torrent.
          |         xyz          xyz
          |            |            |
          v            v            v
   +------+------+  +-+------------+-+
   | Static      |  | Seed Server    |
   | Portal      |  | (seed-         |
   | (HTML/JS/   |  |  server)       |
   | CSS)        |  |                |
   +-------------+  | - Seeds all    |
                    |   published    |
                    |   torrents     |
                    | - REST API     |
                    | - Docker       |
                    +----------------+
```

Multiple seed servers can run independently. Each reads its own API keys and limits from environment variables. The publish CLI can target multiple servers for redundancy.
