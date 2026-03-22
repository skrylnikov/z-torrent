import { EventEmitter } from 'eventemitter3'
import bencode from 'bencode'

import Debug from 'debug'
import KBucket from 'k-bucket'
import krpc, {
  type KRpc,
  type KRpcNode,
  type KRpcMessage,
  type KRpcPeer,
} from 'k-rpc'
import low from 'last-one-wins'
import { LRUCache } from 'lru-cache'
import records from 'record-cache'
import { randomBytes } from 'uint8-util'
import sha1Hash from 'sync-sha1/rawSha1.js'

const debug = Debug('bittorrent-dht')

const ROTATE_INTERVAL = 5 * 60 * 1000 // rotate secrets every 5 minutes
const BUCKET_OUTDATED_TIMESPAN = 15 * 60 * 1000 // check nodes in bucket in 15 minutes old buckets

interface PingOptions {
  older: KRpcNode[]
  swap: (node: KRpcNode) => void
}

interface TableValue {
  v: Buffer
  id: Buffer
  seq?: number
  sig?: Buffer
  k?: Buffer
  salt?: Buffer
}

interface PutOpts {
  v: Buffer | string
  k?: Buffer
  seq?: number
  sign?: (data: Buffer) => Buffer
  sig?: Buffer
  salt?: Buffer
  cas?: number
}

interface GetOpts {
  verify?: (sig: Buffer, data: Buffer, key: Buffer) => boolean
  salt?: Buffer
  cache?: boolean
}

interface GetValueResponse {
  v: Buffer
  id?: Buffer
  token?: Buffer
  k?: Buffer
  sig?: Buffer
  seq?: number
  salt?: Buffer
}

export class DHT extends EventEmitter {
  #tables: LRUCache<string, KBucket>
  #values: LRUCache<string, TableValue>
  #peers: ReturnType<typeof records>
  #secrets: [Buffer, Buffer] | null
  #hash: (buf: Buffer) => Buffer
  #hashLength: number
  #rpc: KRpc
  #verify: ((sig: Buffer, data: Buffer, key: Buffer) => boolean) | null
  #host: string | false | null
  #interval: ReturnType<typeof setInterval>
  #runningBucketCheck: boolean
  #bucketCheckTimeout: ReturnType<typeof setTimeout> | null
  #bucketOutdatedTimeSpan: number

  listening: boolean
  destroyed: boolean
  nodeId: Buffer
  nodes: KRpc['nodes']
  ready: boolean

  constructor(
    opts: {
      maxTables?: number
      maxValues?: number
      maxAge?: number
      maxPeers?: number
      hash?: (buf: Buffer) => Buffer
      krpc?: KRpc
      verify?: (sig: Buffer, data: Buffer, key: Buffer) => boolean
      host?: string | false | null
      timeBucketOutdated?: number
      bootstrap?: boolean | string | string[]
      nodes?: string | string[] | KRpcNode[]
      nodeId?: Buffer | string
      id?: Buffer | string
    } = {}
  ) {
    super()

    // Bootstrap ноды: router.bittorrent.com и router.utorrent.com перестали отвечать в 2024
    if (opts.bootstrap !== false && !opts.bootstrap) {
      opts.bootstrap = [
        'dht.transmissionbt.com:6881',
        'dht.libtorrent.org:25401',
        'router.bitcomet.com:6881',
        // 'router.bittorrent.com:6881',
        // 'router.utorrent.com:6881',
      ]
    }

    this.#tables = new LRUCache<string, KBucket>({
      max: opts.maxTables || 1000,
      ttl: ROTATE_INTERVAL,
      ttlAutopurge: true,
    })
    this.#values = new LRUCache<string, TableValue>({
      max: opts.maxValues || 1000,
    })
    this.#peers = records({
      maxAge: opts.maxAge || 0,
      maxSize: opts.maxPeers || 10000,
    })

    this.#secrets = null
    this.#hash = opts.hash || sha1
    this.#hashLength = this.#hash(Buffer.from('')).length
    this.#rpc =
      opts.krpc ||
      krpc(
        Object.assign(
          {
            idLength: this.#hashLength,
            timeout: 2000, // Увеличено с 2s — bootstrap ноды часто отвечают медленно
          },
          opts
        )
      )
    this.#rpc.on('query', onquery)
    this.#rpc.on('node', onnode)
    this.#rpc.on('warning', onwarning)
    this.#rpc.on('error', onerror)
    this.#rpc.on('listening', onlistening)
    this.#rotateSecrets()
    this.#verify = opts.verify || null
    this.#host = opts.host ?? null
    this.#interval = setInterval(rotateSecrets, ROTATE_INTERVAL)
    this.#runningBucketCheck = false
    this.#bucketCheckTimeout = null
    this.#bucketOutdatedTimeSpan = opts.timeBucketOutdated || BUCKET_OUTDATED_TIMESPAN

    this.listening = false
    this.destroyed = false
    this.nodeId = this.#rpc.id
    this.nodes = this.#rpc.nodes
    this.ready = false

    // ensure only *one* ping it running at the time to avoid infinite async
    // ping recursion, and make the latest one is always ran, but inbetween ones
    // are disregarded
    const onping = low(ping)

    this.#rpc.on('ping', (older: KRpcNode[], swap: (node: KRpcNode) => void) => {
      onping({ older, swap }, noop)
    })

    queueMicrotask(bootstrap as () => void)

    this.#debug('new DHT %s', this.nodeId)

    const self = this

    function ping(opts: PingOptions, cb: (err?: Error | null) => void) {
      const older = opts.older
      const swap = opts.swap

      self.#debug('received ping', older)
      self.#checkNodes(older, false, (_, deadNode) => {
        if (deadNode) {
          self.#debug('swaping dead node with newer', deadNode)
          swap(deadNode)
          return cb()
        }

        self.#debug('no node added, all other nodes ok')
        cb()
      })
    }

    function onlistening() {
      self.listening = true
      self.#debug('listening %d', (self.address() as any).port)
      self.updateBucketTimestamp()
      self.#setBucketCheckInterval()
      self.emit('listening')
    }

    function onquery(query: KRpcMessage, peer: KRpcPeer) {
      self.#onquery(query, peer)
    }

    function rotateSecrets() {
      self.#rotateSecrets()
    }

    function bootstrap() {
      if (!self.destroyed) self.#bootstrap(opts.bootstrap !== false)
    }

    function onwarning(err: Error) {
      self.emit('warning', err)
    }

    function onerror(err: Error) {
      self.emit('error', err)
    }

    function onnode(node: KRpcNode) {
      self.emit('node', node)
    }
  }

  #setBucketCheckInterval() {
    const self = this
    const interval = 1 * 60 * 1000 // check age of bucket every minute

    this.#runningBucketCheck = true
    queueNext()

    function checkBucket() {
      const diff = Date.now() - self.#rpc.nodes.metadata.lastChange

      if (diff < self.#bucketOutdatedTimeSpan) return queueNext()

      self.#pingAll(() => {
        if (self.destroyed) return

        if (self.nodes.toArray().length < 1) {
          // node is currently isolated,
          // retry with initial bootstrap nodes
          self.#bootstrap(true)
        }

        queueNext()
      })
    }

    function queueNext() {
      if (!self.#runningBucketCheck || self.destroyed) return
      const nextTimeout = Math.floor(Math.random() * interval + interval / 2)
      self.#bucketCheckTimeout = setTimeout(checkBucket, nextTimeout)
    }
  }

  #pingAll(cb: () => void) {
    this.#checkAndRemoveNodes(this.nodes.toArray(), cb)
  }

  removeBucketCheckInterval() {
    this.#runningBucketCheck = false
    clearTimeout(this.#bucketCheckTimeout!)
  }

  updateBucketTimestamp() {
    this.#rpc.nodes.metadata.lastChange = Date.now()
  }

  #checkAndRemoveNodes(nodes: KRpcNode[], cb: (err: Error | null, node?: KRpcNode | null) => void) {
    const self = this

    this.#checkNodes(nodes, true, (_, node) => {
      if (node && node.id) self.removeNode(node.id)
      cb(null, node)
    })
  }

  #checkNodes(nodes: KRpcNode[], force: boolean, cb: (err: null, node?: KRpcNode | null) => void) {
    const self = this

    test([...nodes])

    function test(acc: KRpcNode[]) {
      let current: KRpcNode | null = null

      while (acc.length) {
        current = acc.pop()!
        if (!current.id || force) break
        if (Date.now() - (current.seen || 0) > 10000) break // not pinged within 10s
        current = null
      }

      if (!current) return cb(null)

      self.#sendPing(current, (err) => {
        if (!err) {
          self.updateBucketTimestamp()
          return test(acc)
        }
        cb(null, current)
      })
    }
  }

  addNode(node: DHTNode) {
    const self = this
    if (node.id) {
      node.id = toBuffer(node.id)
      const old = !!this.#rpc.nodes.get(node.id)
      this.#rpc.nodes.add(node as KRpcNode)
      if (!old) {
        this.emit('node', node)
        this.updateBucketTimestamp()
      }
      return
    }
    this.#sendPing(node as KRpcNode, (_, node) => {
      if (node) self.addNode(node)
    })
  }

  removeNode(id: Buffer | string) {
    this.#rpc.nodes.remove(toBuffer(id))
  }

  #sendPing(node: KRpcNode, cb: (err: Error | null, node?: KRpcNode) => void) {
    const self = this
    const expectedId = node.id
    this.#rpc.query(
      node,
      { q: 'ping' },
      (err: Error | null, pong?: KRpcMessage, node?: KRpcNode) => {
        if (err) return cb(err)
        if (
          !pong ||
          !pong.r ||
          !pong.r.id ||
          !Buffer.isBuffer(pong.r.id) ||
          pong.r.id.length !== self.#hashLength
        ) {
          return cb(new Error('Bad reply'))
        }
        if (Buffer.isBuffer(expectedId) && !expectedId.equals(pong.r.id)) {
          return cb(new Error('Unexpected node id'))
        }

        self.updateBucketTimestamp()
        cb(null, {
          id: pong.r.id,
          host: (node?.host || node?.address)!,
          port: node!.port,
        })
      }
    )
  }

  toJSON(): { nodes: Array<{ host: string; port: number }>; values: any } {
    const values: any = {}
    this.#values.forEach((value, key) => {
      values[key] = {
        v: value.v.toString('hex'),
        id: value.id.toString('hex'),
      }
      if (value.seq != null) values[key].seq = value.seq
      if (value.sig != null) values[key].sig = value.sig.toString('hex')
      if (value.k != null) values[key].k = value.k.toString('hex')
    })
    return {
      nodes: this.#rpc.nodes.toArray().map(toNode),
      values,
    }
  }

  put(
    opts: PutOpts | Buffer | string,
    cb?: (err: Error | null, key?: Buffer, n?: number) => void
  ): Buffer {
    if (Buffer.isBuffer(opts) || typeof opts === 'string') opts = { v: opts }
    const isMutable = !!(opts as PutOpts).k
    if ((opts as PutOpts).v === undefined) {
      throw new Error('opts.v not given')
    }
    if ((opts as PutOpts).v.length >= 1000) {
      throw new Error('v must be less than 1000 bytes in put()')
    }
    if (
      isMutable &&
      (opts as PutOpts).cas !== undefined &&
      typeof (opts as PutOpts).cas !== 'number'
    ) {
      throw new Error('opts.cas must be an integer if provided')
    }
    if (isMutable && (opts as PutOpts).k!.length !== 32) {
      throw new Error('opts.k ed25519 public key must be 32 bytes')
    }
    if (
      isMutable &&
      typeof (opts as PutOpts).sign !== 'function' &&
      !Buffer.isBuffer((opts as PutOpts).sig)
    ) {
      throw new Error('opts.sign function or options.sig signature is required for mutable put')
    }
    if (isMutable && (opts as PutOpts).salt && (opts as PutOpts).salt!.length > 64) {
      throw new Error('opts.salt is > 64 bytes long')
    }
    if (isMutable && (opts as PutOpts).seq === undefined) {
      throw new Error('opts.seq not provided for a mutable update')
    }
    if (isMutable && typeof (opts as PutOpts).seq !== 'number') {
      throw new Error('opts.seq not an integer')
    }

    return this.#put(opts as PutOpts, cb || noop)
  }

  #put(opts: PutOpts, cb: (err: Error | null, key?: Buffer, n?: number) => void): Buffer {
    const isMutable = !!opts.k
    const v = typeof opts.v === 'string' ? Buffer.from(opts.v) : opts.v
    const key = isMutable
      ? this.#hash(opts.salt ? Buffer.concat([opts.k!, opts.salt]) : opts.k!)
      : this.#hash(bencode.encode(v) as Buffer)

    const table = this.#tables.get(key.toString('hex'))
    if (!table) return this.#preput(key, opts, cb)

    const message: any = {
      q: 'put',
      a: {
        id: this.#rpc.id,
        token: null as Buffer | null, // queryAll sets this
        v,
      },
    }

    if (isMutable) {
      if (typeof opts.cas === 'number') message.a.cas = opts.cas
      if (opts.salt) message.a.salt = opts.salt
      message.a.k = opts.k
      message.a.seq = opts.seq
      if (typeof opts.sign === 'function') message.a.sig = opts.sign(encodeSigData(message.a))
      else if (Buffer.isBuffer(opts.sig)) message.a.sig = opts.sig
    } else {
      this.#values.set(key.toString('hex'), message.a)
    }

    this.#rpc.queryAll(table.closest(key) as any, message, null, (err, n) => {
      if (err) return cb(err, key, n)
      cb(null, key, n)
    })

    return key
  }

  #preput(
    key: Buffer,
    opts: PutOpts,
    cb: (err: Error | null, key?: Buffer, n?: number) => void
  ): Buffer {
    const self = this

    this.#closest(
      key,
      {
        q: 'get',
        a: {
          id: this.#rpc.id,
          target: key,
        },
      },
      null,
      (err, _n?) => {
        if (err) return cb(err)
        self.put(opts, cb)
      }
    )

    return key
  }

  get(
    key: Buffer | string,
    opts?: GetOpts | ((err: Error | null, value: GetValueResponse | null) => void),
    cb?: (err: Error | null, value: GetValueResponse | null) => void
  ): void {
    const keyBuf = toBuffer(key)
    if (typeof opts === 'function') {
      cb = opts
      opts = undefined
    }

    if (!opts) opts = {}
    const verify = (opts as GetOpts).verify || this.#verify
    const hash = this.#hash
    let value: GetValueResponse | null = this.#values.get(keyBuf.toString('hex')) || null

    if (value && (opts as GetOpts).cache !== false) {
      const tableVal: TableValue = {
        v: value.v,
        id: value.id || this.#rpc.id,
        seq: value.seq,
        sig: value.sig,
        k: value.k,
        salt: value.salt,
      }
      value = createGetResponse(this.#rpc.id, null, tableVal)
      return queueMicrotask(done)
    }

    this.#closest(
      keyBuf,
      {
        q: 'get',
        a: {
          id: this.#rpc.id,
          target: keyBuf,
        },
      },
      onreply,
      done
    )

    function done(err: Error | null) {
      if (err) return cb!(err, null)
      cb!(null, value)
    }

    function onreply(message: KRpcMessage): boolean {
      const r = message.r
      if (!r || !r.v) return true

      const isMutable = r.k || r.sig

      if ((opts as GetOpts).salt) r.salt = Buffer.from((opts as GetOpts).salt!)

      if (isMutable) {
        if (!verify || !r.sig || !r.k) return true
        if (!verify!(r.sig, encodeSigData(r), r.k)) return true
        if (
          hash(r.salt ? Buffer.concat([r.k as Buffer, r.salt as Buffer]) : (r.k as Buffer)).equals(
            keyBuf as Uint8Array
          )
        ) {
          if (!value || r.seq > (value?.seq ?? -1)) value = r
        }
      } else {
        if (hash(bencode.encode(r.v) as Buffer).equals(keyBuf as Uint8Array)) {
          value = r
          return false
        }
      }

      return true
    }
  }

  announce(
    infoHash: Buffer | string,
    port: number | (() => void),
    cb?: (err?: Error | null) => void
  ): void {
    if (typeof port === 'function') return this.announce(infoHash, 0, port)
    infoHash = normalizeDhtInfoHash(toBuffer(infoHash))
    if (!cb) cb = noop

    const table = this.#tables.get(infoHash.toString('hex'))
    if (!table) return this.#preannounce(infoHash, port as number, cb)

    if (this.#host) {
      const dhtPort = this.listening ? (this.address() as any).port : 0
      this.#addPeer({ host: this.#host, port: (port as number) || dhtPort }, infoHash, {
        host: this.#host,
        port: dhtPort,
      })
    }

    const message = {
      q: 'announce_peer',
      a: {
        id: this.#rpc.id,
        token: null as Buffer | null, // queryAll sets this
        info_hash: infoHash,
        port,
        implied_port: port ? 0 : 1,
      },
    }

    this.#debug('announce %s %d', infoHash, port)
    this.#rpc.queryAll(table.closest(infoHash) as any, message, null, cb)
  }

  #preannounce(infoHash: Buffer, port: number, cb: (err?: Error | null) => void) {
    const self = this

    this.lookup(infoHash, (err) => {
      if (self.destroyed) return cb(new Error('dht is destroyed'))
      if (err) return cb(err)
      self.announce(infoHash, port, cb)
    })
  }

  /** Drop cached get_peers routing state for this info hash (e.g. when removing a torrent). */
  removeTorrentRoutingTable(infoHash: Buffer | Uint8Array | string): void {
    this.#tables.delete(normalizeDhtInfoHash(toBuffer(infoHash)).toString('hex'))
  }

  lookup(infoHash: Buffer | string, cb?: (err?: Error | null) => void): () => void {
    infoHash = normalizeDhtInfoHash(toBuffer(infoHash))
    if (!cb) cb = noop
    const self = this
    let aborted = false

    this.#debug('lookup %s', infoHash)
    queueMicrotask(emit)
    this.#closest(
      infoHash,
      {
        q: 'get_peers',
        a: {
          id: this.#rpc.id,
          info_hash: infoHash,
        },
      },
      onreply,
      cb
    )

    function emit(values?: Buffer[], from?: KRpcNode) {
      if (!values) values = self.#peers.get(infoHash!.toString('hex'), 100)
      const peers = decodePeers(values)
      for (let i = 0; i < peers.length; i++) {
        self.emit('peer', peers[i], infoHash, from || null)
      }
    }

    function onreply(message: KRpcMessage, node: KRpcNode): boolean {
      if (aborted) return false
      if (message.r && message.r.values) emit(message.r.values, node)
      return true
    }

    return function abort() {
      aborted = true
    }
  }

  address(): { port: number; address: string; family: string } {
    return this.#rpc.address()
  }

  // listen([port], [address], [onlistening])
  listen(...args: any[]) {
    this.#rpc.bind(...args)
  }

  destroy(cb?: () => void) {
    if (this.destroyed) {
      if (cb) queueMicrotask(cb)
      return
    }
    this.destroyed = true
    const self = this
    clearInterval(this.#interval)
    this.removeBucketCheckInterval()
    this.#peers.destroy()
    this.#debug('destroying')
    this.#rpc.destroy(() => {
      self.emit('close')
      if (cb) cb()
    })
  }

  #onquery(query: KRpcMessage, peer: KRpcPeer) {
    if (query.q === undefined || query.q === null) return

    const q = query.q.toString()
    this.#debug('received %s query from %s:%d', q, peer.address, peer.port)
    if (!query.a) return

    switch (q) {
      case 'ping':
        return this.#rpc.response(peer, query, { id: this.#rpc.id })

      case 'find_node':
        return this.#onfindnode(query, peer)

      case 'get_peers':
        return this.#ongetpeers(query, peer)

      case 'announce_peer':
        return this.#onannouncepeer(query, peer)

      case 'get':
        return this.#onget(query, peer)

      case 'put':
        return this.#onput(query, peer)
    }
  }

  #onfindnode(query: KRpcMessage, peer: KRpcPeer) {
    const target = query.a!.target
    if (!target)
      return this.#rpc.error(peer, query, [203, '`find_node` missing required `a.target` field'])

    this.emit('find_node', target)

    const nodes = this.#rpc.nodes.closest(target)
    this.#rpc.response(peer, query, { id: this.#rpc.id }, nodes)
  }

  #ongetpeers(query: KRpcMessage, peer: KRpcPeer) {
    const host = peer.address || peer.host
    const infoHash = query.a!.info_hash
    if (!infoHash)
      return this.#rpc.error(peer, query, [203, '`get_peers` missing required `a.info_hash` field'])

    this.emit('get_peers', infoHash)

    const r: any = { id: this.#rpc.id, token: this.#generateToken(host) }
    const peers = this.#peers.get(infoHash.toString('hex'))

    if (peers.length) {
      r.values = peers
      this.#rpc.response(peer, query, r)
    } else {
      this.#rpc.response(peer, query, r, this.#rpc.nodes.closest(infoHash))
    }
  }

  #onannouncepeer(query: KRpcMessage, peer: KRpcPeer) {
    const host = peer.address || peer.host
    const port = query.a!.implied_port ? peer.port : query.a!.port
    if (!port || typeof port !== 'number' || port <= 0 || port > 65535) return
    const infoHash = query.a!.info_hash
    const token = query.a!.token
    if (!infoHash || !token) return

    if (!this.#validateToken(host, token)) {
      return this.#rpc.error(peer, query, [203, 'cannot `announce_peer` with bad token'])
    }

    this.emit('announce_peer', infoHash, { host, port: peer.port })

    this.#addPeer({ host, port }, infoHash, { host, port: peer.port })
    this.#rpc.response(peer, query, { id: this.#rpc.id })
  }

  #addPeer(
    peer: { host: string; port: number },
    infoHash: Buffer,
    from: { host: string; port: number }
  ) {
    this.#peers.add(infoHash.toString('hex'), encodePeer(peer.host, peer.port))
    this.emit('announce', peer, infoHash, from)
  }

  #onget(query: KRpcMessage, peer: KRpcPeer) {
    const host = peer.address || peer.host
    const target = query.a!.target
    if (!target) return
    const token = this.#generateToken(host)
    const value = this.#values.get(target.toString('hex'))

    this.emit('get', target, value || null)

    if (!value) {
      const nodes = this.#rpc.nodes.closest(target)
      this.#rpc.response(peer, query, { id: this.#rpc.id, token }, nodes)
    } else {
      this.#rpc.response(peer, query, createGetResponse(this.#rpc.id, token, value))
    }
  }

  #onput(query: KRpcMessage, peer: KRpcPeer) {
    const host = peer.address || peer.host

    const a = query.a
    if (!a) return
    const v = query.a.v
    if (!v) return
    const id = query.a.id
    if (!id) return

    const token = a.token
    if (!token) return

    if (!this.#validateToken(host, token)) {
      return this.#rpc.error(peer, query, [203, 'cannot `put` with bad token'])
    }
    if (v.length > 1000) {
      return this.#rpc.error(peer, query, [205, 'data payload too large'])
    }

    const isMutable = !!(a.k || a.sig)
    if (isMutable && !a.k && !a.sig) return

    const key = isMutable
      ? this.#hash(a.salt ? Buffer.concat([a.k, a.salt]) : a.k)
      : this.#hash(bencode.encode(v) as Buffer)
    const keyHex = key.toString('hex')

    this.emit('put', key, v)

    if (isMutable) {
      if (!this.#verify) return this.#rpc.error(peer, query, [400, 'verification not supported'])
      if (!this.#verify(a.sig, encodeSigData(a), a.k)) return
      const prev = this.#values.get(keyHex)
      if (prev && typeof a.cas === 'number' && prev.seq !== a.cas) {
        return this.#rpc.error(peer, query, [301, 'CAS mismatch, re-read and try again'])
      }
      if (prev && typeof prev.seq === 'number' && !(a.seq > prev.seq)) {
        return this.#rpc.error(peer, query, [302, 'sequence number less than current'])
      }
      this.#values.set(keyHex, {
        v,
        k: a.k,
        salt: a.salt,
        sig: a.sig,
        seq: a.seq,
        id,
      })
    } else {
      this.#values.set(keyHex, { v, id })
    }

    this.#rpc.response(peer, query, { id: this.#rpc.id })
  }

  #bootstrap(populate: boolean) {
    const self = this
    if (!populate) return queueMicrotask(ready)

    this.#rpc.populate(
      self.#rpc.id,
      {
        q: 'find_node',
        a: {
          id: self.#rpc.id,
          target: self.#rpc.id,
        },
      },
      ready
    )

    function ready() {
      if (self.ready) return

      self.#debug('emit ready')
      self.ready = true
      self.emit('ready')
    }
  }

  #closest(
    target: Buffer,
    message: any,
    onmessage: ((message: KRpcMessage, node: KRpcNode) => boolean) | null,
    cb: (err: Error | null, n?: number) => void
  ) {
    const self = this

    const table = new KBucket({
      localNodeId: target,
      numberOfNodesPerKBucket: this.#rpc.k,
    })

    this.#rpc.closest(target, message, onreply, done)

    function done(err: Error | null, _n?: number) {
      if (err) return cb(err)
      self.#tables.set(target.toString('hex'), table)
      self.#debug('visited %d nodes', _n)
      cb(null, _n)
    }

    function onreply(message: KRpcMessage, node: KRpcNode): boolean {
      if (!message.r) return true

      if (
        message.r.token &&
        message.r.id &&
        Buffer.isBuffer(message.r.id) &&
        message.r.id.length === self.#hashLength
      ) {
        self.#debug('found node %s (target: %s)', message.r.id, target)
        table.add({
          id: message.r.id,
          host: node.host || node.address!,
          port: node.port,
          token: message.r.token,
        })
      }

      if (!onmessage) return true
      return onmessage(message, node)
    }
  }

  #debug(format: string, ...args: any[]) {
    if (!debug.enabled) return
    const newArgs: any[] = [].slice.call(args)
    newArgs.unshift(`[${this.nodeId.toString('hex').substring(0, 7)}] ${format}`)
    for (let i = 1; i < newArgs.length; i++) {
      if (Buffer.isBuffer(newArgs[i])) newArgs[i] = newArgs[i].toString('hex')
    }
    ;(debug as (...a: unknown[]) => void)(...newArgs)
  }

  #validateToken(host: string, token: Buffer): boolean {
    const tokenA = this.#generateToken(host, this.#secrets![0])
    const tokenB = this.#generateToken(host, this.#secrets![1])
    return token.equals(tokenA) || token.equals(tokenB)
  }

  #generateToken(host: string, secret?: Buffer): Buffer {
    if (!secret) secret = this.#secrets![0]
    return this.#hash(Buffer.concat([Buffer.from(host), secret]))
  }

  #rotateSecrets() {
    if (!this.#secrets) {
      this.#secrets = [
        Buffer.from(randomBytes(this.#hashLength)),
        Buffer.from(randomBytes(this.#hashLength)),
      ]
    } else {
      this.#secrets[1] = this.#secrets[0]
      this.#secrets[0] = Buffer.from(randomBytes(this.#hashLength))
    }
  }
}

function noop() {}

function sha1(buf: Buffer | Uint8Array): Buffer {
  return Buffer.from(sha1Hash(buf instanceof Uint8Array ? buf : new Uint8Array(buf)))
}

function createGetResponse(
  id: Buffer,
  token: Buffer | null | undefined,
  value: TableValue
): GetValueResponse {
  const r: GetValueResponse = { id, token: token || undefined, v: value.v }
  if (value.sig) {
    r.sig = value.sig
    r.k = value.k
    if (typeof value.seq === 'number') r.seq = value.seq
  }
  return r
}

function encodePeer(host: string, port: number): Buffer {
  const buf = Buffer.allocUnsafe(6)
  const ip = host.split('.')
  for (let i = 0; i < 4; i++) buf[i] = parseInt(ip[i] || '0', 10)
  buf.writeUInt16BE(port, 4)
  return buf
}

function decodePeers(buf: Buffer[]): Array<{ host: string; port: number }> {
  const peers: Array<{ host: string; port: number }> = []

  try {
    for (let i = 0; i < buf.length; i++) {
      const peerBuf = buf[i]
      if (!peerBuf) continue
      const port = peerBuf.readUInt16BE(4)
      if (!port) continue
      peers.push({
        host: parseIp(peerBuf, 0),
        port,
      })
    }
  } catch (err) {
    // do nothing
  }

  return peers
}

function parseIp(buf: Buffer, offset: number): string {
  return `${buf[offset++]}.${buf[offset++]}.${buf[offset++]}.${buf[offset++]}`
}

function encodeSigData(msg: any): Buffer {
  const ref: any = { seq: msg.seq || 0, v: msg.v }
  if (msg.salt) ref.salt = msg.salt
  return bencode.encode(ref).slice(1, -1) as Buffer
}

function toNode(node: KRpcNode): { host: string; port: number } {
  return {
    host: node.host!,
    port: node.port!,
  }
}

function toBuffer(str: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(str)) return str
  if (ArrayBuffer.isView(str)) return Buffer.from(str.buffer, str.byteOffset, str.byteLength)
  if (typeof str === 'string') return Buffer.from(str, 'hex')
  throw new Error('Pass a buffer or a string')
}

/** BEP 52: DHT uses 20-byte info_hash; truncate full SHA-256 if 32 bytes are passed. */
function normalizeDhtInfoHash(buf: Buffer): Buffer {
  if (buf.length === 32) return buf.subarray(0, 20)
  return buf
}

export interface DHTNode {
  id?: Buffer | string
  host: string
  port: number
}

export interface DHTOptions {
  bootstrap?: boolean | string | string[]
  nodes?: string | string[] | DHTNode[]
  id?: Buffer | string
  nodeId?: Buffer | string
  host?: string | false | null
  maxTables?: number
  maxValues?: number
  maxPeers?: number
  maxAge?: number
  hash?: (buf: Buffer) => Buffer
  verify?: (sig: Buffer, data: Buffer, key: Buffer) => boolean
  krpc?: any
  timeBucketOutdated?: number
  concurrency?: number
  backgroundConcurrency?: number
  k?: number
}

export interface DHTPeer {
  host: string
  port: number
}

export interface PutOptions {
  v: Buffer | string
  k?: Buffer
  seq?: number
  sign?: (data: Buffer) => Buffer
  sig?: Buffer
  salt?: Buffer
  cas?: number
}

export interface GetOptions {
  verify?: (sig: Buffer, data: Buffer, key: Buffer) => boolean
  salt?: Buffer
  cache?: boolean
}

export interface GetValue {
  v: Buffer
  id?: Buffer
  k?: Buffer
  sig?: Buffer
  seq?: number
  salt?: Buffer
  token?: Buffer
}
