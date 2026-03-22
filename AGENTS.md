# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

Z-Torrent is a streaming torrent client for Node.js and the browser. This is a TypeScript monorepo using Turborepo and Bun, containing multiple packages for BitTorrent protocol implementation.

## Build/Lint/Test Commands

### Root-level commands (run from project root)

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run all tests across all packages
bun run test

# Run live tests (network-dependent tests)
bun run test-live

# Lint all packages
bun run lint

# Fix lint issues automatically
bun run lint:fix

# Format code with Prettier
bun run format

# Clean all build artifacts
bun run clean
```

### Package-level commands (run from within a package directory)

```bash
# Build a specific package
cd packages/<package-name>
bun run build

# Run tests for a specific package
bun run test

# Run a single test file
bun test test/path/to/test.test.ts

# Example: Run a single test in webtorrent package
cd packages/webtorrent
bun test test/node/client-deselect.test.ts

# Run size limit check
bun run size
```

### Running specific test patterns

```bash
# Run tests matching a pattern
bun test --test-name-pattern="test name here"

# Run tests in a specific directory
bun test test/node/
```

## Code Style Guidelines

### Formatting (Prettier)

- **No semicolons** (`semi: false`)
- **Single quotes** for strings (`singleQuote: true`)
- **Trailing commas** ES5 style (`trailingComma: 'es5'`)
- **Print width** 100 characters (`printWidth: 100`)

### TypeScript Configuration

- **Target**: ES2022
- **Module**: NodeNext with NodeNext resolution
- **Strict mode**: enabled
- **ESM**: This project uses ES modules (`"type": "module"`)

### Import Organization

Order imports as follows, with blank lines between groups:

1. Node.js built-in modules
2. External packages (npm dependencies)
3. Internal workspace packages (`workspace:*`)
4. Relative imports (always include `.js` extension)

```typescript
// 1. Node.js built-ins
import path from 'path'
import { createServer } from 'http'

// 2. External packages
import bencode from 'bencode'
import { Duplex } from 'streamx'

// 3. Workspace packages
import { ZTorrentCore } from 'z-torrent-core'

// 4. Relative imports (note .js extension for ESM)
import { createNodePlatformAdapter } from './platform.js'
import ConnPool from './lib/conn-pool.js'
```

### Naming Conventions

- **Variables and functions**: camelCase
  - `const torrentPieces = []`
  - `function parseTorrent() {}`
- **Classes, types, interfaces**: PascalCase
  - `class Wire extends Duplex {}`
  - `interface ExtendedHandshake {}`
  - `type RequestCallback = (err: Error | null, buffer: Uint8Array | null) => void`
- **Constants**: SCREAMING_SNAKE_CASE
  - `const BITFIELD_GROW = 400000`
  - `const KEEP_ALIVE_TIMEOUT = 55000`
- **Private class members**: Prefix with underscore
  - `this._buffer = []`
  - `this._onHandshake()`
- **File names**: kebab-case for utilities, PascalCase for classes
  - `conn-pool.ts`, `torrent-discovery.ts`

### Error Handling

- Throw `Error` objects with descriptive messages:
  ```typescript
  throw new Error('infoHash and peerId MUST have length 20')
  ```
- Use callbacks with error-first pattern for async operations:
  ```typescript
  function doSomething(cb: (err: Error | null, result?: Data) => void) {
    // ...
  }
  ```
- Use Promises/async-await for modern async code:
  ```typescript
  async function fetchData(): Promise<Data> {
    const result = await someAsyncOp()
    return result
  }
  ```
- Handle errors gracefully and emit appropriate events:
  ```typescript
  if (err) {
    this._debug('Error: %s', err.message)
    this.destroy()
    return
  }
  ```

### Class Structure

- Use class properties with type annotations
- Initialize properties in constructor or use definite assignment
- Use arrow functions for methods used as callbacks to preserve `this`:
  ```typescript
  _onMessage = (buffer: Uint8Array): void => {
    // 'this' is correctly bound
  }
  ```

### Debugging

Use the `debug` package with namespaces **`@z-torrent/<package>:<scope>`** (match the workspace package name after `@z-torrent/`, plus a logical scope for the file or subsystem).

```typescript
import Debug from 'debug'
const debug = Debug('@z-torrent/protocol:wire')

// In methods
this._debug('got handshake i=%s p=%s', infoHash, peerId)
```

In Node.js, enable with e.g. `DEBUG=@z-torrent/core:*` or `DEBUG=@z-torrent/*`. In the browser, use `localStorage.setItem('debug', '@z-torrent/*')`.

### Type Annotations

- Always annotate function parameters and return types
- Use `Uint8Array` instead of `Buffer` where possible for cross-platform compatibility
- Use type imports for types-only imports:
  ```typescript
  import type { Extension } from './types.js'
  ```

### Comments

- Do not add per-file MIT/license banners; full license text lives in each package’s `LICENSE` (and root `LICENSE` where applicable).
- Use JSDoc for public APIs
- Avoid inline comments that explain what code does; prefer self-documenting code

## Monorepo Structure

```
packages/
├── node/                 # Node.js client (@z-torrent/node)
├── browser/              # Browser bundle (@z-torrent/browser)
├── core/                 # Platform-agnostic core (@z-torrent/core)
├── protocol/             # Wire protocol (@z-torrent/protocol)
├── dht/                  # DHT (@z-torrent/dht)
├── tracker/              # Tracker client/server (@z-torrent/tracker)
├── lsd/                  # Local peer discovery (@z-torrent/lsd)
├── discovery/            # Peer discovery (@z-torrent/discovery)
├── parse/                # Parse torrent / magnet (@z-torrent/parse)
├── create/               # Create torrent files (@z-torrent/create)
├── magnet/               # Magnet URI (@z-torrent/magnet)
├── merkle-tree/          # BEP 52 v2 merkle trees (@z-torrent/merkle-tree)
├── ut-metadata/          # Metadata extension (@z-torrent/ut-metadata)
├── ut-pex/               # Peer exchange (@z-torrent/ut-pex)
├── utils/                # Shared utilities (@z-torrent/utils)
├── fixtures/             # Test fixtures (@z-torrent/fixtures)
└── ...                   # Other packages / examples
```

## Testing

- Tests use Bun's built-in test runner
- Import test utilities: `import { test, expect } from 'bun:test'`
- Test files use `.test.ts` suffix
- Use `describe` and `test` for organization:

  ```typescript
  import { test, expect } from 'bun:test'

  test('description of test', () => {
    expect(something).toBe(expected)
  })
  ```

- For async tests, return a Promise or use async/await:
  ```typescript
  test('async operation', async () => {
    const result = await someAsyncOp()
    expect(result).toBeDefined()
  })
  ```
- Use `webtorrent-fixtures` package for test data

## Before Committing

1. Run lint: `bun run lint`
2. Fix any issues: `bun run lint:fix`
3. Run tests: `bun run test`
4. Build: `bun run build`
5. Format code: `bun run format`

## Important Notes

- Always use `.js` extension in import paths for ESM compatibility
- The project uses `uint8-util` for Uint8Array utilities instead of Node's Buffer
- Use `tsdown` for building (configured via package.json scripts)
- Workspace dependencies use `workspace:*` protocol
- Check existing code in similar packages for patterns before implementing new features
