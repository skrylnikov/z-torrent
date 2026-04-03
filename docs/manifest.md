# Z-Torrent Site Manifest — `zt-manifest.json`

## Overview

Every site deployed via z-torrent includes a `zt-manifest.json` file at the root of the torrent. This file describes the site type, routing rules, metadata, and display properties. The portal reads this manifest after loading the torrent to configure rendering behavior.

## Manifest Location

The manifest is always the first file in the torrent's file list at the root level:

```
torrent root/
  zt-manifest.json    <-- manifest
  index.html          <-- entry point
  assets/
    style.css
    app.js
    logo.png
```

## Schema

```typescript
interface ZTManifest {
  /** Manifest format version. Current: 1 */
  version: 1

  /** Site metadata */
  site: {
    /** Display name shown in the portal UI and browser tab */
    name: string

    /** Short description */
    description?: string

    /** Relative path to favicon within the torrent (e.g. "favicon.ico") */
    icon?: string

    /** Relative path to Open Graph image for link previews */
    ogImage?: string

    /** ISO 639-1 language code (e.g. "en", "ru") */
    lang?: string
  }

  /** Site type — determines how the portal handles routing and rendering */
  type: 'static' | 'spa'

  /** Routing configuration */
  routing?: {
    /**
     * Entry point file relative to torrent root.
     * Default: "index.html"
     */
    entry?: string

    /**
     * SPA fallback path. When a requested file is not found in the torrent,
     * serve this file instead (for client-side routing).
     *
     * Only used when type is "spa".
     * Default: "index.html"
     */
    fallback?: string

    /**
     * Custom error pages.
     * Key is the HTTP status code (as string), value is the file path.
     */
    errors?: {
      '404'?: string
    }

    /**
     * Redirect rules. Evaluated in order, first match wins.
     * Useful for moved pages, vanity URLs, etc.
     */
    redirects?: Array<{
      from: string // glob pattern or exact path
      to: string // target path or external URL
      status?: 301 | 302 | 307 | 308
    }>

    /**
     * Custom headers for specific paths.
     * Useful for cache control, CORS on specific assets, etc.
     */
    headers?: Array<{
      match: string // glob pattern
      headers: Record<string, string>
    }>
  }

  /**
   * Files to prioritize downloading first.
   * Portal will start rendering once these are available.
   * If not specified, defaults to entry file + manifest.
   *
   * Glob patterns relative to torrent root.
   */
  priority?: string[]

  /**
   * Framework hint — purely informational.
   * Portal may show this in the status indicator.
   */
  framework?: string

  /**
   * Build tool used — purely informational.
   */
  buildTool?: string

  /**
   * Publish metadata — auto-populated by @z-torrent/publish.
   * Not user-editable.
   */
  _meta?: {
    /** ISO 8601 timestamp of publish */
    publishedAt: string

    /** Version of @z-torrent/publish used */
    publisherVersion: string

    /** Total size in bytes */
    totalSize: number

    /** Number of files */
    fileCount: number
  }
}
```

## Site Types

### `static` — Static Site

Standard multi-page static website. Each URL path maps directly to a file in the torrent.

```
Request: /about         -> about/index.html or about.html
Request: /blog/post-1   -> blog/post-1/index.html or blog/post-1.html
Request: /style.css     -> style.css
```

Path resolution order:

1. Exact file match (`/style.css` -> `style.css`)
2. Directory index (`/about/` -> `about/index.html`)
3. HTML extension (`/about` -> `about.html`)
4. 404 page (from `routing.errors['404']` or default)

### `spa` — Single Page Application

All navigation requests that don't match a file are served the fallback file (typically `index.html`). The SPA's client-side router handles rendering.

```
Request: /              -> index.html
Request: /dashboard     -> index.html (fallback — no matching file)
Request: /assets/app.js -> assets/app.js (exact match — served directly)
Request: /api/data.json -> 404 (or fallback if no static match)
```

Asset requests (CSS, JS, images, fonts) are always served directly — fallback only applies to `document` navigation requests or requests with `Accept: text/html`.

## Examples

### Minimal Static Site

```json
{
  "version": 1,
  "site": {
    "name": "My Website"
  },
  "type": "static"
}
```

### SPA (React/Svelte/Vue)

```json
{
  "version": 1,
  "site": {
    "name": "My App",
    "description": "A modern web application",
    "icon": "favicon.svg",
    "lang": "en"
  },
  "type": "spa",
  "routing": {
    "entry": "index.html",
    "fallback": "index.html",
    "errors": {
      "404": "404.html"
    }
  },
  "priority": ["index.html", "assets/*.css", "assets/*.js"],
  "framework": "svelte"
}
```

### Sintel Demo (First Deploy)

```json
{
  "version": 1,
  "site": {
    "name": "Sintel — Z-Torrent Demo",
    "description": "Sintel short film streaming demo powered by z-torrent",
    "icon": "favicon.ico",
    "ogImage": "og-image.jpg",
    "lang": "en"
  },
  "type": "static",
  "routing": {
    "entry": "index.html"
  },
  "priority": ["index.html", "*.css", "*.js"],
  "framework": "vanilla"
}
```

### Static Site with Redirects

```json
{
  "version": 1,
  "site": {
    "name": "Documentation",
    "lang": "en"
  },
  "type": "static",
  "routing": {
    "redirects": [
      { "from": "/docs", "to": "/docs/getting-started", "status": 301 },
      { "from": "/old-page", "to": "/new-page", "status": 301 }
    ],
    "headers": [
      {
        "match": "assets/**",
        "headers": {
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      }
    ],
    "errors": {
      "404": "404.html"
    }
  }
}
```

## Portal Behavior

### Manifest Loading

1. Torrent starts downloading
2. Portal checks if `zt-manifest.json` exists in the torrent file list
3. If found — prioritize downloading it first (`file.select(7)` — highest priority)
4. Parse manifest, validate against schema
5. If manifest is missing — fall back to defaults:
   ```json
   { "version": 1, "site": { "name": "<infoHash>" }, "type": "static" }
   ```

### Priority Downloads

The `priority` field tells the portal which files to download first. This enables showing the site before all assets are ready:

1. Download `zt-manifest.json` first
2. Download files matching `priority` patterns
3. Once the entry file is ready, render the iframe
4. Remaining files download in the background (rarest-first by default)

If a requested file isn't ready yet (still downloading), the SW should wait for it — not return 404. The portal can show a per-file loading indicator.

### Routing Implementation

The routing logic lives in `ServerBase.onRequest()` and is driven by the manifest:

```typescript
// Pseudocode for file resolution
function resolveFile(path: string, manifest: ZTManifest, files: File[]): File | null {
  // 1. Exact match
  const exact = files.find((f) => f.path === path)
  if (exact) return exact

  // 2. Directory index
  const index = files.find((f) => f.path === `${path}/index.html`)
  if (index) return index

  // 3. HTML extension
  const html = files.find((f) => f.path === `${path}.html`)
  if (html) return html

  // 4. SPA fallback
  if (manifest.type === 'spa' && isNavigationRequest) {
    const fallback = manifest.routing?.fallback ?? 'index.html'
    return files.find((f) => f.path === fallback) ?? null
  }

  return null
}
```

## Config File — `z-torrent.config.json`

This file lives in the developer's project root and is read by `@z-torrent/publish`. It maps to the manifest but also includes publish-specific settings:

```json
{
  "site": {
    "name": "My App",
    "description": "My awesome app",
    "icon": "public/favicon.svg"
  },
  "type": "spa",
  "routing": {
    "fallback": "index.html"
  },
  "publish": {
    "dir": "dist",
    "server": "https://seed.z-torrent.xyz",
    "apiKey": "$ZT_API_KEY",
    "trackers": ["wss://tracker.z-torrent.xyz", "wss://tracker.openwebtorrent.com"],
    "pieceLength": 32768
  }
}
```

The `publish` section is stripped when generating `zt-manifest.json` — it never ends up in the torrent.

Values starting with `$` are resolved from environment variables.

## Validation

The manifest schema should be validated at two points:

1. **At publish time** — `@z-torrent/publish` validates the config and generated manifest before creating the torrent. Errors block the publish.
2. **At load time** — The portal validates the manifest after downloading it from the torrent. Invalid manifests fall back to defaults with a warning in the status indicator.

Validation can use a simple runtime check (no JSON Schema dependency needed):

```typescript
function validateManifest(data: unknown): ZTManifest {
  if (!data || typeof data !== 'object') throw new Error('Invalid manifest')
  const m = data as Record<string, unknown>
  if (m.version !== 1) throw new Error(`Unknown manifest version: ${m.version}`)
  if (!m.site || typeof m.site !== 'object') throw new Error('Missing site field')
  if (!['static', 'spa'].includes(m.type as string)) {
    throw new Error(`Unknown site type: ${m.type}`)
  }
  return data as ZTManifest
}
```
