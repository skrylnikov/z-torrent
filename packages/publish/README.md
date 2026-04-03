# @z-torrent/publish

CLI and library to publish static sites as BitTorrent payloads with `zt-manifest.json`.

## Requirements

- **Node.js 18+** (ESM, `node:util` `parseArgs`, dynamic `import()` for config modules)
- **Bun** also works as a runtime for `src/*.ts` during development.

Config files `z-torrent.config.ts` are loaded via dynamic `import()`. With Node, use `.json`, `.js`, or `.mjs` unless you use a TypeScript-aware runner; **Bun** natively resolves `.ts` configs.

## CLI

After building the package:

```bash
cd packages/publish && bun run build
# or from repo root: bun run build --filter=@z-torrent/publish
node dist/cli.js --help
```

Published installs expose the `z-torrent-publish` binary (runs with Node via the `#!/usr/bin/env node` shebang in `dist/cli.js`).

## Library

```typescript
import { publish, loadConfig } from '@z-torrent/publish'
```

## Options

- `--dry-run` — compute info hash and manifest without writing `.torrent` or `zt-manifest.json` to the output path; no manifest is left in the site directory (staging uses a temp copy).

See `--help` on the CLI for the full option list.
