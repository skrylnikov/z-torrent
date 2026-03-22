<h1 align="center">
  <br>
  Z-Torrent
  <br>
  <br>
</h1>

<h4 align="center">The streaming torrent client. For node.js and the web.</h4>

**Z-Torrent** is a streaming torrent client for **node.js** and the **browser**. It's written completely in JavaScript – the language of the web – so the same code works in both runtimes.

In node.js, this module is a simple torrent client, using TCP and UDP to talk to other torrent clients.

In the browser, Z-Torrent uses **WebRTC** (data channels) for peer-to-peer transport. It can be used **without** browser plugins, extensions, or installations.

To make BitTorrent work over WebRTC (which is the only P2P transport that works on the web) we made some protocol changes. Therefore, a browser-based Z-Torrent client or **"web peer"** can only connect to other clients that support WebTorrent/WebRTC. The programmatic client class is exported as **`ZTorrent`** from `@z-torrent/node` and `@z-torrent/browser`.

### Features

- **Torrent client for node.js & the browser** (same npm package!)
- **Insanely fast**
- Download **multiple torrents** simultaneously, efficiently
- **Pure Javascript** (no native dependencies)
- Exposes files as **streams**
  - Fetches pieces from the network on-demand so seeking is supported (even before torrent is finished)
  - Seamlessly switches between sequential and rarest-first piece selection strategy
- Supports advanced torrent client features
  - **magnet uri** support via **[ut_metadata](https://github.com/webtorrent/ut_metadata)**
  - **peer discovery** via **[dht](https://github.com/webtorrent/bittorrent-dht)**,
    **[tracker](https://github.com/webtorrent/bittorrent-tracker)**,
    **[lsd](https://github.com/webtorrent/bittorrent-lsd)**, and
    **[ut_pex](https://github.com/webtorrent/ut_pex)**
  - **[protocol extension api](https://github.com/webtorrent/bittorrent-protocol#extension-api)**
    for adding new extensions
- **Comprehensive test suite** (runs completely offline, so it's reliable and fast)
- Check all the **[supported BEPs here](packages/webtorrent/docs/bep_support.md)**

#### Browser/WebRTC environment features

- **WebRTC data channels** for lightweight peer-to-peer communication with **no plugins**
- **No silos.** Z-Torrent is a P2P network for the **entire web.** Z-Torrent clients running on one domain can connect to clients on any other domain.
- Stream video torrents into a `<video>` tag (`webm, mkv, mp4, ogv, mov, etc (AV1, H264, HEVC*, VP8, VP9, AAC, FLAC, MP3, OPUS, Vorbis, etc)`)
- Supports Chrome, Firefox, Opera and Safari.

### Install

To install Z-Torrent for use in node or the browser with `import ZTorrent from 'z-torrent'`, run:

```bash
npm install z-torrent
```

### Z-Torrent API Documentation

**[Read the full API Documentation](packages/webtorrent/docs/api.md).**

### Usage

Z-Torrent is a BitTorrent client that works in the browser, using open web standards (no plugins, just HTML5 and WebRTC)! It's easy to get started!

#### In the browser

##### Downloading a file is simple:

```js
import ZTorrent from "z-torrent";

const client = new ZTorrent();
const magnetURI = "...";

client.add(magnetURI, (torrent) => {
  // Got torrent metadata!
  console.log("Client is downloading:", torrent.infoHash);

  for (const file of torrent.files) {
    document.body.append(file.name);
  }
});
```

##### Seeding a file is simple, too:

```js
import dragDrop from "drag-drop";
import ZTorrent from "z-torrent";

const client = new ZTorrent();

// When user drops files on the browser, create a new torrent and start seeding it!
dragDrop("body", (files) => {
  client.seed(files, (torrent) => {
    console.log("Client is seeding:", torrent.infoHash);
  });
});
```

There are more examples in [docs/get-started.md](packages/webtorrent/docs/get-started.md).

##### Webpack

Z-Torrent works with [webpack](https://webpack.js.org/). You can find the webpack config in [scripts/browser.webpack.js](packages/webtorrent/scripts/browser.webpack.js).

Or, you can just use the pre-built version via `import ZTorrent from 'z-torrent/dist/z-torrent.min.js'` and skip the webpack configuration.

#### In Node.js

Z-Torrent also works in node.js, using the _same npm package!_ It's mad science!

### Modules

Most of the active development is happening inside of small npm packages which are used by Z-Torrent.

| Package | Size (brotli) | Dependencies (total) | Dev-dependencies (total) |
|---------|---------------|----------------------|---------------------------|
| addr-to-ip-port | 268 B | 0 | 5 |
| bittorrent-dht | 22.24 KB | 7 | 10 |
| bittorrent-lsd | 7.25 KB | 2 | 5 |
| bittorrent-protocol | 24.6 KB | 7 | 7 |
| bittorrent-tracker | 231 B | 23 | 29 |
| create-torrent | 121 B | 11 | 15 |
| load-ip-set | 16.77 KB | 5 | 4 |
| magnet-uri | 2.31 KB | 3 | 4 |
| parse-torrent | 158 B | 8 | 4 |
| string2compact | 4.81 KB | 2 | 5 |
| torrent-discovery | 101.32 KB | 31 | 9 |
| torrent-piece | 1.04 KB | 1 | 2 |
| ut_metadata | 10.88 KB | 3 | 24 |
| ut_pex | 8.79 KB | 5 | 16 |
| webtorrent-fixtures | 14.95 KB | 9 | 2 |
| z-torrent | 216.48 KB | 63 | 84 |

_Sizes and dependency counts are from `bun run size` and `bun run deps:count`._

#### The Node Way™

> "When applications are done well, they are just the really application-specific, brackish residue that can't be so easily abstracted away. All the nice, reusable components sublimate away onto github and npm where everybody can collaborate to advance the commons." — substack from ["how I write modules"](https://gist.github.com/substack/5075355)

#### Enable debug logs

Debug namespaces follow **`@z-torrent/<package>:<scope>`** (for example `@z-torrent/protocol:wire` for the wire protocol, `@z-torrent/core:torrent` for the torrent engine). Use `*` segments to widen: `@z-torrent/core:*` for all core scopes, or `@z-torrent/*` for every package.

In **node**, set the `DEBUG` environment variable (comma-separated list is supported):

```bash
DEBUG=@z-torrent/protocol:wire z-torrent
DEBUG=@z-torrent/* z-torrent
DEBUG=* z-torrent
```

In the **browser**, enable debug logs by running this in the developer console:

```js
localStorage.setItem('debug', '@z-torrent/core:*')
// or all packages:
localStorage.setItem('debug', '@z-torrent/*')
```

Disable by running this:

```js
localStorage.removeItem('debug')
```

## Acknowledgments

Z-Torrent is a fork of [WebTorrent](https://github.com/webtorrent/webtorrent).

**Original WebTorrent Authors:**

- **Feross Aboukhadijeh** - [feross.org](https://feross.org)
- **WebTorrent, LLC** - [webtorrent.io](https://webtorrent.io)

Special thanks to all the [contributors](packages/webtorrent/AUTHORS.md) who have helped build and maintain the original WebTorrent library.

### License

MIT. Copyright (c) [Feross Aboukhadijeh](https://feross.org) and [WebTorrent, LLC](https://webtorrent.io).
