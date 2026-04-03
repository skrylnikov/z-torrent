# Security

## Threat Model

Z-Torrent Web Hosting serves arbitrary user-published static content to visitors' browsers. The primary security concern is that **published sites run inside an iframe on the same origin** as the portal (`z-torrent.xyz`).

## Current Risks

### Same-Origin XSS (Acceptable for v1)

Published sites load inside an iframe on the portal's origin. A malicious published site could:

- Access the portal's `localStorage`, `sessionStorage`, and `IndexedDB`
- Read cookies set on the portal domain
- Intercept portal page navigation via `window.parent`
- Make API requests to the portal's backend with the visitor's credentials

**Mitigation in v1:**

- The seed server validates torrent content (path traversal, entry file existence, file size limits)
- The publish CLI warns about forbidden file types and root-relative paths
- CSP in hosting mode uses `default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;` which is permissive but prevents the iframe from setting `document.domain` to escape the sandbox
- No sensitive data is stored in the portal's origin-scoped storage (the portal uses `navigator.serviceWorker` and `IndexedDB` with z-torrent-specific database names)

**Acceptable because:**

- The portal does not store user credentials or session tokens
- The only "state" is the torrent client and cached content, which is inherently public (it's P2P)
- The SW intercepts requests to `/z-torrent/` paths; other paths are not intercepted

### Path Traversal in Published Content

A malicious torrent could contain files with `..` in their paths (e.g., `../../etc/passwd`).

**Mitigation:**

- Seed server validates that no torrent file paths contain `..` (since Phase 6.9)
- Publish CLI scans for path traversal during `z-torrent-publish` (since Phase 6.8)

### Malicious Executable Files

A published site could include `.exe`, `.sh`, `.bat`, or other executable files.

**Mitigation:**

- Publish CLI warns when forbidden file types are detected (since Phase 6.8)
- Seed server enforces a 100 MB per-file size limit (since Phase 6.9)
- The browser will not execute these files directly (no `Content-Disposition: attachment` in hosting mode)

### Service Worker Scope Abuse

The SW is registered at scope `/` and intercepts all `/z-torrent/` requests.

**Mitigation:**

- The SW only intercepts URLs containing `z-torrent/`
- Non-`z-torrent/` requests pass through unmodified (`return null`)
- Cache is scoped to the `z-torrent-v1` cache name
- The SW has no access to the portal's DOM or cookies

## Future Security Improvements (v2)

### SharedWorker Isolation

The primary security improvement is to isolate the torrent client in a `SharedWorker` instead of running it in the main thread. This would:

1. **Remove same-origin access**: The iframe's JavaScript cannot reach the `SharedWorker`
2. **Separate storage contexts**: Each torrent could use a separate `IndexedDB` database
3. **Memory isolation**: A malicious site cannot cause OOM in the portal's main thread

### Sandbox Attribute

Add `sandbox="allow-scripts"` to the iframe element. This would:

- Block `window.parent` access
- Block `top` navigation
- Block popups
- Block form submission
- Still allow JavaScript execution (required for most sites)

The trade-off is that some legitimate sites may break if they rely on `postMessage` to the parent or `iframe.contentWindow` access.

### CSP Nonce-Based Policy

Replace the permissive CSP with a nonce-based policy:

```
default-src 'self';
script-src 'nonce-{RANDOM}' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
```

This requires generating a nonce per-request and injecting it into HTML responses (via `<base>` tag injection pipeline).

## Deployment Recommendations

1. **HTTPS only**: The portal and seed server must use HTTPS. WebRTC and the WSS tracker already require encrypted connections.
2. **Subdomain isolation**: Consider serving published sites on a separate subdomain (e.g., `sites.z-torrent.xyz`) to limit cookie scope.
3. **Content scanning**: For public seed servers, consider adding virus/malware scanning of uploaded torrents (ClamAV, etc.).
4. **Rate limiting**: The seed server's API already has per-key rate limiting. Ensure reasonable limits for public deployments.
5. **TTL enforcement**: Use TTL-based auto-expiry of deployments to limit storage abuse.
6. **CORS**: The seed server API uses Bearer token auth. Do not expose the API without authentication.

## Content Integrity

Torrent content is verified by its info hash (SHA-1 for v1, SHA-256 for v2). The BEP 52 Merkle tree extension (used in `@z-torrent/merkle-tree`) provides per-piece integrity verification. This means:

- A malicious peer cannot serve tampered content without the client detecting the hash mismatch
- The info hash uniquely identifies the exact content of the torrent
- The manifest file (`zt-manifest.json`) is included in the torrent and is thus also content-verified
