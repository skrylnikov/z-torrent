/// <reference types="node" />
import { EventEmitter } from 'events'
import bencode from 'bencode'
import Debug from 'debug'
import KBucket from 'k-bucket'
import krpc, { KRpc, KRpcNode, KRpcMessage, KRpcPeer } from 'k-rpc'
import low from 'last-one-wins'
import LRU from 'lru'
import randombytes from 'randombytes'
import records from 'record-cache'
import crypto from 'crypto'

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

class DHT extends EventEmitter {
  _tables: InstanceType<typeof LRU<string, KBucket>>
  _values: InstanceType<typeof LRU<string, TableValue>>
  _peers: ReturnType<typeof records>
  _secrets: [Buffer, Buffer] | null
  _hash: (buf: Buffer) => Buffer
  _hashLength: number
  _rpc: KRpc
  _verify: ((sig: Buffer, data: Buffer, key: Buffer) => boolean) | null
  _host: string | null
  _interval: ReturnType<typeof setInterval>
  _runningBucketCheck: boolean
  _bucketCheckTimeout: ReturnType<typeof setTimeout> | null
  _bucketOutdatedTimeSpan: number

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
      host?: string
      timeBucketOutdated?: number
      bootstrap?: boolean | string[]
      nodeId?: Buffer | string
      id?: Buffer | string
    } = {}
  ) {
    super()

    this._tables = new LRU({
      maxAge: ROTATE_INTERVAL,
      max: opts.maxTables || 1000,
    }) as InstanceType<typeof LRU<string, KBucket>>
    this._values = new LRU({ max: opts.maxValues || 1000 }) as InstanceType<
      typeof LRU<string, TableValue>
    >
    this._peers = records({
      maxAge: opts.maxAge || 0,
      maxSize: opts.maxPeers || 10000,
    })

    this._secrets = null
    this._hash = opts.hash || sha1
    this._hashLength = this._hash(Buffer.from('')).length
    this._rpc = opts.krpc || krpc(Object.assign({ idLength: this._hashLength }, opts))
    this._rpc.on('query', onquery)
    this._rpc.on('node', onnode)
    this._rpc.on('warning', onwarning)
    this._rpc.on('error', onerror)
    this._rpc.on('listening', onlistening)
    this._rotateSecrets()
    this._verify = opts.verify || null
    this._host = opts.host || null
    this._interval = setInterval(rotateSecrets, ROTATE_INTERVAL)
    this._runningBucketCheck = false
    this._bucketCheckTimeout = null
    this._bucketOutdatedTimeSpan = opts.timeBucketOutdated || BUCKET_OUTDATED_TIMESPAN

    this.listening = false
    this.destroyed = false
    this.nodeId = this._rpc.id
    this.nodes = this._rpc.nodes
    this.ready = false

    // ensure only *one* ping it running at the time to avoid infinite async
    // ping recursion, and make the latest one is always ran, but inbetween ones
    // are disregarded
    const onping = low(ping)

    this._rpc.on('ping', (older: KRpcNode[], swap: (node: KRpcNode) => void) => {
      onping({ older, swap }, noop)
    })

    process.nextTick(bootstrap as () => void)

    this._debug('new DHT %s', this.nodeId)

    const self = this

    function ping(opts: PingOptions, cb: (err?: Error | null) => void) {
      const older = opts.older
      const swap = opts.swap

      self._debug('received ping', older)
      self._checkNodes(older, false, (_, deadNode) => {
        if (deadNode) {
          self._debug('swaping dead node with newer', deadNode)
          swap(deadNode)
          return cb()
        }

        self._debug('no node added, all other nodes ok')
        cb()
      })
    }

    function onlistening() {
      self.listening = true
      self._debug('listening %d', (self.address() as any).port)
      self.updateBucketTimestamp()
      self._setBucketCheckInterval()
      self.emit('listening')
    }

    function onquery(query: KRpcMessage, peer: KRpcPeer) {
      self._onquery(query, peer)
    }

    function rotateSecrets() {
      self._rotateSecrets()
    }

    function bootstrap() {
      if (!self.destroyed) self._bootstrap(opts.bootstrap !== false)
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

  _setBucketCheckInterval() {
    const self = this
    const interval = 1 * 60 * 1000 // check age of bucket every minute

    this._runningBucketCheck = true
    queueNext()

    function checkBucket() {
      const diff = Date.now() - self._rpc.nodes.metadata.lastChange

      if (diff < self._bucketOutdatedTimeSpan) return queueNext()

      self._pingAll(() => {
        if (self.destroyed) return

        if (self.nodes.toArray().length < 1) {
          // node is currently isolated,
          // retry with initial bootstrap nodes
          self._bootstrap(true)
        }

        queueNext()
      })
    }

    function queueNext() {
      if (!self._runningBucketCheck || self.destroyed) return
      const nextTimeout = Math.floor(Math.random() * interval + interval / 2)
      self._bucketCheckTimeout = setTimeout(checkBucket, nextTimeout)
    }
  }

  _pingAll(cb: () => void) {
    this._checkAndRemoveNodes(this.nodes.toArray(), cb)
  }

  removeBucketCheckInterval() {
    this._runningBucketCheck = false
    clearTimeout(this._bucketCheckTimeout!)
  }

  updateBucketTimestamp() {
    this._rpc.nodes.metadata.lastChange = Date.now()
  }

  _checkAndRemoveNodes(nodes: KRpcNode[], cb: (err: Error | null, node?: KRpcNode | null) => void) {
    const self = this

    this._checkNodes(nodes, true, (_, node) => {
      if (node && node.id) self.removeNode(node.id)
      cb(null, node)
    })
  }

  _checkNodes(nodes: KRpcNode[], force: boolean, cb: (err: null, node?: KRpcNode | null) => void) {
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

      self._sendPing(current, (err) => {
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
      const old = !!this._rpc.nodes.get(node.id)
      this._rpc.nodes.add(node as KRpcNode)
      if (!old) {
        this.emit('node', node)
        this.updateBucketTimestamp()
      }
      return
    }
    this._sendPing(node as KRpcNode, (_, node) => {
      if (node) self.addNode(node)
    })
  }

  removeNode(id: Buffer | string) {
    this._rpc.nodes.remove(toBuffer(id))
  }

  _sendPing(node: KRpcNode, cb: (err: Error | null, node?: KRpcNode) => void) {
    const self = this
    const expectedId = node.id
    this._rpc.query(
      node,
      { q: 'ping' },
      (err: Error | null, pong?: KRpcMessage, node?: KRpcNode) => {
        if (err) return cb(err)
        if (
          !pong ||
          !pong.r ||
          !pong.r.id ||
          !Buffer.isBuffer(pong.r.id) ||
          pong.r.id.length !== self._hashLength
        ) {
          return cb(new Error('Bad reply'))
        }
        if (Buffer.isBuffer(expectedId) && !expectedId.equals(pong.r.id)) {
          return cb(new Error('Unexpected node id'))
        }

        self.updateBucketTimestamp()
        cb(null, { host: (node?.host || node?.address)!, port: node!.port })
      }
    )
  }

  toJSON(): { nodes: Array<{ host: string; port: number }>; values: any } {
    const self = this
    const values: any = {}
    Object.keys(this._values.cache).forEach((key) => {
      const value = self._values.cache[key].value
      values[key] = {
        v: value.v.toString('hex'),
        id: value.id.toString('hex'),
      }
      if (value.seq != null) values[key].seq = value.seq
      if (value.sig != null) values[key].sig = value.sig.toString('hex')
      if (value.k != null) values[key].k = value.k.toString('hex')
    })
    return {
      nodes: this._rpc.nodes.toArray().map(toNode),
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

    return this._put(opts as PutOpts, cb || noop)
  }

  _put(opts: PutOpts, cb: (err: Error | null, key?: Buffer, n?: number) => void): Buffer {
    const isMutable = !!opts.k
    const v = typeof opts.v === 'string' ? Buffer.from(opts.v) : opts.v
    const key = isMutable
      ? this._hash(opts.salt ? Buffer.concat([opts.k!, opts.salt]) : opts.k!)
      : this._hash(bencode.encode(v) as Buffer)

    const table = this._tables.get(key.toString('hex'))
    if (!table) return this._preput(key, opts, cb)

    const message: any = {
      q: 'put',
      a: {
        id: this._rpc.id,
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
      this._values.set(key.toString('hex'), message.a)
    }

    this._rpc.queryAll(table.closest(key) as any, message, null, (err, n) => {
      if (err) return cb(err, key, n)
      cb(null, key, n)
    })

    return key
  }

  _preput(
    key: Buffer,
    opts: PutOpts,
    cb: (err: Error | null, key?: Buffer, n?: number) => void
  ): Buffer {
    const self = this

    this._closest(
      key,
      {
        q: 'get',
        a: {
          id: this._rpc.id,
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
    const verify = (opts as GetOpts).verify || this._verify
    const hash = this._hash
    let value: GetValueResponse | null = this._values.get(keyBuf.toString('hex')) || null

    if (value && (opts as GetOpts).cache !== false) {
      const tableVal: TableValue = {
        v: value.v,
        id: value.id || this._rpc.id,
        seq: value.seq,
        sig: value.sig,
        k: value.k,
        salt: value.salt,
      }
      value = createGetResponse(this._rpc.id, null, tableVal)
      return process.nextTick(done)
    }

    this._closest(
      keyBuf,
      {
        q: 'get',
        a: {
          id: this._rpc.id,
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
    infoHash = toBuffer(infoHash)
    if (!cb) cb = noop

    const table = this._tables.get(infoHash.toString('hex'))
    if (!table) return this._preannounce(infoHash, port as number, cb)

    if (this._host) {
      const dhtPort = this.listening ? (this.address() as any).port : 0
      this._addPeer({ host: this._host, port: (port as number) || dhtPort }, infoHash, {
        host: this._host,
        port: dhtPort,
      })
    }

    const message = {
      q: 'announce_peer',
      a: {
        id: this._rpc.id,
        token: null as Buffer | null, // queryAll sets this
        info_hash: infoHash,
        port,
        implied_port: port ? 0 : 1,
      },
    }

    this._debug('announce %s %d', infoHash, port)
    this._rpc.queryAll(table.closest(infoHash) as any, message, null, cb)
  }

  _preannounce(infoHash: Buffer, port: number, cb: (err?: Error | null) => void) {
    const self = this

    this.lookup(infoHash, (err) => {
      if (self.destroyed) return cb(new Error('dht is destroyed'))
      if (err) return cb(err)
      self.announce(infoHash, port, cb)
    })
  }

  lookup(infoHash: Buffer | string, cb?: (err?: Error | null) => void): () => void {
    infoHash = toBuffer(infoHash)
    if (!cb) cb = noop
    const self = this
    let aborted = false

    this._debug('lookup %s', infoHash)
    process.nextTick(emit)
    this._closest(
      infoHash,
      {
        q: 'get_peers',
        a: {
          id: this._rpc.id,
          info_hash: infoHash,
        },
      },
      onreply,
      cb
    )

    function emit(values?: Buffer[], from?: KRpcNode) {
      if (!values) values = self._peers.get(infoHash!.toString('hex'), 100)
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
    return this._rpc.address()
  }

  // listen([port], [address], [onlistening])
  listen(...args: any[]) {
    this._rpc.bind(...args)
  }

  destroy(cb?: () => void) {
    if (this.destroyed) {
      if (cb) process.nextTick(cb)
      return
    }
    this.destroyed = true
    const self = this
    clearInterval(this._interval)
    this.removeBucketCheckInterval()
    this._peers.destroy()
    this._debug('destroying')
    this._rpc.destroy(() => {
      self.emit('close')
      if (cb) cb()
    })
  }

  _onquery(query: KRpcMessage, peer: KRpcPeer) {
    if (query.q === undefined || query.q === null) return

    const q = query.q.toString()
    this._debug('received %s query from %s:%d', q, peer.address, peer.port)
    if (!query.a) return

    switch (q) {
      case 'ping':
        return this._rpc.response(peer, query, { id: this._rpc.id })

      case 'find_node':
        return this._onfindnode(query, peer)

      case 'get_peers':
        return this._ongetpeers(query, peer)

      case 'announce_peer':
        return this._onannouncepeer(query, peer)

      case 'get':
        return this._onget(query, peer)

      case 'put':
        return this._onput(query, peer)
    }
  }

  _onfindnode(query: KRpcMessage, peer: KRpcPeer) {
    const target = query.a!.target
    if (!target)
      return this._rpc.error(peer, query, [203, '`find_node` missing required `a.target` field'])

    this.emit('find_node', target)

    const nodes = this._rpc.nodes.closest(target)
    this._rpc.response(peer, query, { id: this._rpc.id }, nodes)
  }

  _ongetpeers(query: KRpcMessage, peer: KRpcPeer) {
    const host = peer.address || peer.host
    const infoHash = query.a!.info_hash
    if (!infoHash)
      return this._rpc.error(peer, query, [203, '`get_peers` missing required `a.info_hash` field'])

    this.emit('get_peers', infoHash)

    const r: any = { id: this._rpc.id, token: this._generateToken(host) }
    const peers = this._peers.get(infoHash.toString('hex'))

    if (peers.length) {
      r.values = peers
      this._rpc.response(peer, query, r)
    } else {
      this._rpc.response(peer, query, r, this._rpc.nodes.closest(infoHash))
    }
  }

  _onannouncepeer(query: KRpcMessage, peer: KRpcPeer) {
    const host = peer.address || peer.host
    const port = query.a!.implied_port ? peer.port : query.a!.port
    if (!port || typeof port !== 'number' || port <= 0 || port > 65535) return
    const infoHash = query.a!.info_hash
    const token = query.a!.token
    if (!infoHash || !token) return

    if (!this._validateToken(host, token)) {
      return this._rpc.error(peer, query, [203, 'cannot `announce_peer` with bad token'])
    }

    this.emit('announce_peer', infoHash, { host, port: peer.port })

    this._addPeer({ host, port }, infoHash, { host, port: peer.port })
    this._rpc.response(peer, query, { id: this._rpc.id })
  }

  _addPeer(
    peer: { host: string; port: number },
    infoHash: Buffer,
    from: { host: string; port: number }
  ) {
    this._peers.add(infoHash.toString('hex'), encodePeer(peer.host, peer.port))
    this.emit('announce', peer, infoHash, from)
  }

  _onget(query: KRpcMessage, peer: KRpcPeer) {
    const host = peer.address || peer.host
    const target = query.a!.target
    if (!target) return
    const token = this._generateToken(host)
    const value = this._values.get(target.toString('hex'))

    this.emit('get', target, value || null)

    if (!value) {
      const nodes = this._rpc.nodes.closest(target)
      this._rpc.response(peer, query, { id: this._rpc.id, token }, nodes)
    } else {
      this._rpc.response(peer, query, createGetResponse(this._rpc.id, token, value))
    }
  }

  _onput(query: KRpcMessage, peer: KRpcPeer) {
    const host = peer.address || peer.host

    const a = query.a
    if (!a) return
    const v = query.a.v
    if (!v) return
    const id = query.a.id
    if (!id) return

    const token = a.token
    if (!token) return

    if (!this._validateToken(host, token)) {
      return this._rpc.error(peer, query, [203, 'cannot `put` with bad token'])
    }
    if (v.length > 1000) {
      return this._rpc.error(peer, query, [205, 'data payload too large'])
    }

    const isMutable = !!(a.k || a.sig)
    if (isMutable && !a.k && !a.sig) return

    const key = isMutable
      ? this._hash(a.salt ? Buffer.concat([a.k, a.salt]) : a.k)
      : this._hash(bencode.encode(v) as Buffer)
    const keyHex = key.toString('hex')

    this.emit('put', key, v)

    if (isMutable) {
      if (!this._verify) return this._rpc.error(peer, query, [400, 'verification not supported'])
      if (!this._verify(a.sig, encodeSigData(a), a.k)) return
      const prev = this._values.get(keyHex)
      if (prev && typeof a.cas === 'number' && prev.seq !== a.cas) {
        return this._rpc.error(peer, query, [301, 'CAS mismatch, re-read and try again'])
      }
      if (prev && typeof prev.seq === 'number' && !(a.seq > prev.seq)) {
        return this._rpc.error(peer, query, [302, 'sequence number less than current'])
      }
      this._values.set(keyHex, {
        v,
        k: a.k,
        salt: a.salt,
        sig: a.sig,
        seq: a.seq,
        id,
      })
    } else {
      this._values.set(keyHex, { v, id })
    }

    this._rpc.response(peer, query, { id: this._rpc.id })
  }

  _bootstrap(populate: boolean) {
    const self = this
    if (!populate) return process.nextTick(ready)

    this._rpc.populate(
      self._rpc.id,
      {
        q: 'find_node',
        a: {
          id: self._rpc.id,
          target: self._rpc.id,
        },
      },
      ready
    )

    function ready() {
      if (self.ready) return

      self._debug('emit ready')
      self.ready = true
      self.emit('ready')
    }
  }

  _closest(
    target: Buffer,
    message: any,
    onmessage: ((message: KRpcMessage, node: KRpcNode) => boolean) | null,
    cb: (err: Error | null, n?: number) => void
  ) {
    const self = this

    const table = new KBucket({
      localNodeId: target,
      numberOfNodesPerKBucket: this._rpc.k,
    })

    this._rpc.closest(target, message, onreply, done)

    function done(err: Error | null, _n?: number) {
      if (err) return cb(err)
      self._tables.set(target.toString('hex'), table)
      self._debug('visited %d nodes', _n)
      cb(null, _n)
    }

    function onreply(message: KRpcMessage, node: KRpcNode): boolean {
      if (!message.r) return true

      if (
        message.r.token &&
        message.r.id &&
        Buffer.isBuffer(message.r.id) &&
        message.r.id.length === self._hashLength
      ) {
        self._debug('found node %s (target: %s)', message.r.id, target)
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

  _debug(format: string, ...args: any[]) {
    if (!debug.enabled) return
    const newArgs: any[] = [].slice.call(args)
    newArgs.unshift(`[${this.nodeId.toString('hex').substring(0, 7)}] ${format}`)
    for (let i = 1; i < newArgs.length; i++) {
      if (Buffer.isBuffer(newArgs[i])) newArgs[i] = newArgs[i].toString('hex')
    }
    debug(...newArgs)
  }

  _validateToken(host: string, token: Buffer): boolean {
    const tokenA = this._generateToken(host, this._secrets![0])
    const tokenB = this._generateToken(host, this._secrets![1])
    return token.equals(tokenA) || token.equals(tokenB)
  }

  _generateToken(host: string, secret?: Buffer): Buffer {
    if (!secret) secret = this._secrets![0]
    return this._hash(Buffer.concat([Buffer.from(host), secret]))
  }

  _rotateSecrets() {
    if (!this._secrets) {
      this._secrets = [randombytes(this._hashLength), randombytes(this._hashLength)]
    } else {
      this._secrets[1] = this._secrets[0]
      this._secrets[0] = randombytes(this._hashLength)
    }
  }
}

function noop() {}

function sha1(buf: Buffer): Buffer {
  return crypto.createHash('sha1').update(buf).digest()
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
      const port = buf[i].readUInt16BE(4)
      if (!port) continue
      peers.push({
        host: parseIp(buf[i], 0),
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

export default DHT

export interface DHTNode {
  id?: Buffer | string
  host: string
  port: number
}

export interface DHTOptions {
  bootstrap?: boolean | string[]
  nodes?: string | string[]
  id?: Buffer | string
  nodeId?: Buffer | string
  host?: string
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
