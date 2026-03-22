---
'@z-torrent/utils': patch
'@z-torrent/core': patch
'@z-torrent/browser': patch
---

Fix incorrect `Content-Type` for media in the browser (e.g. Matroska `.mkv`) when `mime/lite` omits `video/x-*` types, which previously fell through to `application/octet-stream` and broke `<video>` with `X-Content-Type-Options: nosniff`.

- **@z-torrent/utils:** Add `@z-torrent/utils/streaming-mime` (`resolveTorrentFileMime`, `normalizeSwResponseContentType`, `streamingMimeFromFileName`) with tests.
- **@z-torrent/core:** Set `File.type` via `resolveTorrentFileMime` on top of `mime/lite`.
- **@z-torrent/browser:** Service worker normalizes `Content-Type` from the request URL path when the header is missing, empty, or `application/octet-stream`, including for streaming responses; bundle the utils module in `sw.min.js`; README note on MIME and `<video>`.
