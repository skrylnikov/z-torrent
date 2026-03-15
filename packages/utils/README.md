# @z-torrent/utils

Utility functions for Z-Torrent - a collection of helpers for BitTorrent protocol implementation.

## Install

```bash
npm install @z-torrent/utils
```

## API

### IPSet

Efficient AVL-tree based data structure for storing and querying IP ranges. Supports both IPv4 and IPv6.

```js
import { IPSet } from '@z-torrent/utils'

// Create from array of ranges
const ipSet = new IPSet([
  { start: '192.168.1.1', end: '192.168.1.100' },
  { start: '10.0.0.0', end: '10.0.0.255' },
])

// Add CIDR notation
ipSet.add('192.168.0.0/24')

// Add single IP
ipSet.add('8.8.8.8')

// Add range
ipSet.add('172.16.0.1', '172.16.0.50')

// Check if IP is in the set
ipSet.contains('192.168.1.50') // true
ipSet.contains('1.1.1.1') // false

// IPv6 support
ipSet.add('2001:db8::/32')
ipSet.contains('2001:db8::1') // true
```

### loadIPSet

Load IP sets from a file, URL, or array. Supports plain text and gzip-compressed files.

```js
import { loadIPSet } from '@z-torrent/utils'

// From array
const ipSet = await loadIPSet([{ start: '192.168.1.1', end: '192.168.1.100' }])

// From file
const ipSet = await loadIPSet('/path/to/blocklist.txt')

// From gzip file
const ipSet = await loadIPSet('/path/to/blocklist.txt.gz')

// From URL
const ipSet = await loadIPSet('https://example.com/blocklist.txt', {
  headers: { 'User-Agent': 'z-torrent' },
})

// Callback style
loadIPSet('/path/to/blocklist.txt', (err, ipSet) => {
  if (err) throw err
  console.log(ipSet.contains('192.168.1.1'))
})
```

Supported file formats:

```
# Comments are ignored
192.168.1.1-192.168.1.100
10.0.0.0/24
172.16.0.1
```

### Netmask

Parse and manipulate IP network blocks (IPv4 and IPv6).

```js
import { Netmask, ip2long, long2ip } from '@z-torrent/utils'

const block = new Netmask('192.168.1.0/24')

block.base // '192.168.1.0'
block.mask // '255.255.255.0'
block.bitmask // 24
block.hostmask // '0.0.0.255'
block.size // 256
block.first // '192.168.1.1'
block.last // '192.168.1.254'
block.broadcast // '192.168.1.255'

// Check if IP is in the block
block.contains('192.168.1.100') // true
block.contains('10.0.0.1') // false

// Iterate over all IPs
block.forEach((ip, long, index) => {
  console.log(ip)
})

// Get next block
const next = block.next()
next.toString() // '192.168.2.0/24'

// IPv6 support
const ipv6Block = new Netmask('2001:db8::/32')

// Convert IP to numeric value
const num = ip2long('192.168.1.1') // 3232235777
const ip = long2ip(3232235777) // '192.168.1.1'
```

### string-compact

Convert between string and compact binary formats for peer addresses (used in tracker responses).

```js
import {
  string2compact,
  compact2string,
  compact2stringMulti,
  compact2stringMulti6,
} from '@z-torrent/utils/string-compact'

// IPv4: string to compact (6 bytes)
const compact = string2compact('192.168.1.1:6881')
// Uint8Array [192, 168, 1, 1, 0x1A, 0xE1]

// Multiple addresses
const multi = string2compact(['192.168.1.1:6881', '10.0.0.1:6882'])

// Compact to string
const addr = compact2string(compact) // '192.168.1.1:6881'

// Parse multiple IPv4 addresses (6 bytes each)
const addrs = compact2stringMulti(buffer)

// Parse multiple IPv6 addresses (18 bytes each)
const addrs6 = compact2stringMulti6(buffer)

// IPv6 support (18 bytes)
const compact6 = string2compact('[2001:db8::1]:6881')
const addr6 = compact2string(compact6) // '[2001:db8::1]:6881'
```

### addrToIPPort

Parse address string into IP and port components.

```js
import { addrToIPPort } from '@z-torrent/utils/addr-ip-port'

const [ip, port] = addrToIPPort('192.168.1.1:6881')
// ip = '192.168.1.1', port = 6881

const [ip6, port6] = addrToIPPort('[2001:db8::1]:6881')
// ip6 = '2001:db8::1', port6 = 6881
```

### Piece

Manage torrent piece data with block-level operations.

```js
import { Piece } from '@z-torrent/utils/piece'

const piece = new Piece(16384) // 16KB piece

piece.length // 16384
piece.missing // 16384 (bytes not yet received)
Piece.BLOCK_LENGTH // 16384 (16KB, default block size)

// Reserve a block for downloading
const blockIndex = piece.reserve() // returns -1 if no blocks available

// Get block info
piece.chunkLength(blockIndex) // block size in bytes
piece.chunkOffset(blockIndex) // byte offset in piece

// Store received data
piece.set(blockIndex, data, peer)

// Cancel a reservation
piece.cancel(blockIndex)

// When all blocks received, flush to get complete piece
if (piece.missing === 0) {
  const completePiece = piece.flush()
}
```

### once

Ensure a function is only called once.

```js
import { once } from '@z-torrent/utils'

const fn = once((value) => {
  console.log('Called with:', value)
  return value * 2
})

fn(5) // logs: "Called with: 5", returns 10
fn(10) // returns 10 (no log, cached result)
fn(20) // returns 10 (cached result)
```

## License

MIT
