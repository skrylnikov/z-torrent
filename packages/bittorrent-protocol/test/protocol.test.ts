import { expect, test } from 'bun:test'
import Protocol from 'bittorrent-protocol'

test('Handshake', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.on('handshake', (infoHash: Buffer, peerId: Buffer) => {
      expect(Buffer.from(infoHash, 'hex').length).toBe(20)
      expect(Buffer.from(infoHash, 'hex').toString()).toBe('01234567890123456789')
      expect(Buffer.from(peerId, 'hex').length).toBe(20)
      expect(Buffer.from(peerId, 'hex').toString()).toBe('12345678901234567890')
      resolve()
    })

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))
  })
})

test('Handshake (with string args)', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.on('handshake', (infoHash: Buffer, peerId: Buffer) => {
      expect(Buffer.from(infoHash, 'hex').length).toBe(20)
      expect(Buffer.from(infoHash, 'hex').toString()).toBe('01234567890123456789')
      expect(Buffer.from(peerId, 'hex').length).toBe(20)
      expect(Buffer.from(peerId, 'hex').toString()).toBe('12345678901234567890')
      resolve()
    })

    wire.handshake(
      '3031323334353637383930313233343536373839',
      '3132333435363738393031323334353637383930'
    )
  })
})

test('Asynchronous handshake + extended handshake', () => {
  const eventLog: string[] = []

  return new Promise<void>((resolve, reject) => {
    const wire1 = new Protocol()
    const wire2 = new Protocol()
    wire1.pipe(wire2).pipe(wire1)
    wire1.on('error', (err: Error) => reject(err))
    wire2.on('error', (err: Error) => reject(err))

    wire1.on('handshake', (infoHash: Buffer, peerId: Buffer, extensions: any) => {
      eventLog.push('w1 hs')
      expect(Buffer.from(infoHash, 'hex').toString()).toBe('01234567890123456789')
      expect(Buffer.from(peerId, 'hex').toString()).toBe('12345678901234567890')
      expect(extensions.extended).toBe(true)
    })
    wire1.on('extended', (ext: string, obj: any) => {
      if (ext === 'handshake') {
        eventLog.push('w1 ex')
        expect(obj).toBeTruthy()
      }
    })

    wire2.on('handshake', (infoHash: Buffer, peerId: Buffer, extensions: any) => {
      eventLog.push('w2 hs')
      expect(Buffer.from(infoHash, 'hex').toString()).toBe('01234567890123456789')
      expect(Buffer.from(peerId, 'hex').toString()).toBe('12345678901234567890')
      expect(extensions.extended).toBe(true)

      queueMicrotask(() => {
        wire2.handshake(infoHash, peerId)
      })
    })
    wire2.on('extended', (ext: string, obj: any) => {
      if (ext === 'handshake') {
        eventLog.push('w2 ex')
        expect(obj).toBeTruthy()

        queueMicrotask(() => {
          expect(eventLog).toEqual(['w2 hs', 'w1 hs', 'w1 ex', 'w2 ex'])
          resolve()
        })
      }
    })

    wire1.handshake(
      '3031323334353637383930313233343536373839',
      '3132333435363738393031323334353637383930'
    )
  })
})

test('Unchoke', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)
    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

    expect(wire.amChoking).toBeTruthy()
    expect(wire.peerChoking).toBeTruthy()

    wire.on('unchoke', () => {
      expect(wire.peerChoking).toBeFalsy()
      resolve()
    })

    wire.unchoke()
    expect(wire.amChoking).toBeFalsy()
  })
})

test('Interested', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)
    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

    expect(wire.amInterested).toBeFalsy()
    expect(wire.peerInterested).toBeFalsy()

    wire.on('interested', () => {
      expect(wire.peerInterested).toBeTruthy()
      resolve()
    })

    wire.interested()
    expect(wire.amInterested).toBeTruthy()
  })
})

test('Request a piece', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)
    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

    expect(wire.requests.length).toBe(0)
    expect(wire.peerRequests.length).toBe(0)

    wire.on(
      'request',
      (
        i: number,
        offset: number,
        length: number,
        callback: (err: Error | null, buffer?: Buffer) => void
      ) => {
        expect(wire.requests.length).toBe(1)
        expect(wire.peerRequests.length).toBe(1)
        expect(i).toBe(0)
        expect(offset).toBe(1)
        expect(length).toBe(11)
        callback(null, Buffer.from('hello world'))
      }
    )

    wire.once('unchoke', () => {
      expect(wire.requests.length).toBe(0)
      wire.request(0, 1, 11, (err: Error | null, buffer?: Buffer) => {
        expect(wire.requests.length).toBe(0)
        expect(err).toBeFalsy()
        expect(Buffer.from(buffer!).toString()).toBe('hello world')
        resolve()
      })
      expect(wire.requests.length).toBe(1)
    })

    wire.unchoke()
  })
})

test('No duplicate `have` events for same piece', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.handshake(
      '3031323334353637383930313233343536373839',
      '3132333435363738393031323334353637383930'
    )

    let haveEvents = 0
    wire.on('have', () => {
      haveEvents += 1
    })
    expect(haveEvents).toBe(0)
    expect(!!wire.peerPieces.get(0)).toBe(false)
    wire.have(0)
    queueMicrotask(() => {
      expect(haveEvents).toBe(1)
      expect(!!wire.peerPieces.get(0)).toBe(true)
      wire.have(0)
      queueMicrotask(() => {
        expect(haveEvents).toBe(1)
        expect(!!wire.peerPieces.get(0)).toBe(true)
        resolve()
      })
    })
  })
})

test('Fast Extension: handshake when unsupported', () => {
  return new Promise<void>((resolve, reject) => {
    const wire1 = new Protocol()
    const wire2 = new Protocol()
    wire1.pipe(wire2).pipe(wire1)
    wire1.on('error', (err: Error) => reject(err))
    wire2.on('error', (err: Error) => reject(err))

    wire1.on('handshake', (infoHash: Buffer, peerId: Buffer, extensions: any) => {
      expect(extensions.fast).toBe(false)
      expect(wire1.hasFast).toBe(false)
      expect(wire2.hasFast).toBe(false)
      resolve()
    })

    wire2.on('handshake', (infoHash: Buffer, peerId: Buffer) => {
      expect(true).toBe(true)
      queueMicrotask(() => {
        wire2.handshake(infoHash, peerId, { fast: false })
      })
    })

    wire1.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test('Fast Extension: handshake when supported', () => {
  return new Promise<void>((resolve, reject) => {
    const wire1 = new Protocol()
    const wire2 = new Protocol()
    wire1.pipe(wire2).pipe(wire1)
    wire1.on('error', (err: Error) => reject(err))
    wire2.on('error', (err: Error) => reject(err))

    wire1.on('handshake', (infoHash: Buffer, peerId: Buffer, extensions: any) => {
      expect(extensions.fast).toBe(true)
      expect(wire1.hasFast).toBe(true)
      expect(wire2.hasFast).toBe(true)
      resolve()
    })

    wire2.on('handshake', (infoHash: Buffer, peerId: Buffer) => {
      expect(true).toBe(true)
      queueMicrotask(() => {
        wire2.handshake(infoHash, peerId, { fast: true })
      })
    })

    wire1.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test('Fast Extension: have-all', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.once('handshake', () => {
      expect(wire.hasFast).toBe(true)
      wire.haveAll()
    })

    wire.once('have-all', () => {
      resolve()
    })

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test('Fast Extension: have-none', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.once('handshake', () => {
      expect(wire.hasFast).toBe(true)
      wire.haveNone()
    })

    wire.once('have-none', () => {
      resolve()
    })

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test('Fast Extension: suggest', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.once('handshake', () => {
      expect(wire.hasFast).toBe(true)
      wire.suggest(42)
    })

    wire.once('suggest', (index: number) => {
      expect(index).toBe(42)
      resolve()
    })

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test('Fast Extension: allowed-fast', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.once('handshake', () => {
      expect(wire.hasFast).toBe(true)
      expect(wire.allowedFastSet).toEqual([])
      wire.allowedFast(6)
      expect(wire.allowedFastSet).toEqual([6])
      expect(wire.peerAllowedFastSet).toEqual([])
    })

    wire.on('allowed-fast', (index: number) => {
      expect(index).toBe(6)
      expect(wire.peerAllowedFastSet).toEqual([6])
      resolve()
    })

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test('Fast Extension: reject on choke', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.once('handshake', () => {
      expect(wire.extensions.fast).toBe(true)
      expect(wire.peerExtensions.fast).toBe(true)
      expect(wire.hasFast).toBe(true)
      wire.unchoke()
    })

    wire.once('unchoke', () => {
      expect(wire.requests.length).toBe(0)
      wire.request(0, 2, 22, (err: Error | null) => {
        expect(err).toBeTruthy()
      })
      expect(wire.requests.length).toBe(1)
      expect(wire.peerRequests.length).toBe(0)
    })

    wire.on(
      'request',
      (
        i: number,
        offset: number,
        length: number,
        callback: (err: Error | null, buffer?: Buffer) => void
      ) => {
        expect(wire.peerRequests.length).toBe(1)
        expect(i).toBe(0)
        expect(offset).toBe(2)
        expect(length).toBe(22)

        wire.choke()
        expect(wire.peerRequests.length).toBe(0)
      }
    )

    wire.on('choke', () => {
      expect(wire.requests.length).toBe(1)
    })

    wire.on('reject', () => {
      expect(wire.requests.length).toBe(0)
      resolve()
    })

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test("Fast Extension: don't reject allowed-fast on choke", () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.once('handshake', () => {
      expect(wire.extensions.fast).toBe(true)
      expect(wire.peerExtensions.fast).toBe(true)
      expect(wire.hasFast).toBe(true)
      wire.allowedFast(6)
      wire.unchoke()
    })

    wire.once('unchoke', () => {
      expect(wire.requests.length).toBe(0)
      wire.request(6, 66, 666, (err: Error | null) => {
        if (err) reject(err)
      })
      expect(wire.requests.length).toBe(1)
      expect(wire.peerRequests.length).toBe(0)
    })

    wire.on(
      'request',
      (
        i: number,
        offset: number,
        length: number,
        callback: (err: Error | null, buffer?: Buffer) => void
      ) => {
        expect(wire.peerRequests.length).toBe(1)
        expect(i).toBe(6)
        expect(offset).toBe(66)
        expect(length).toBe(666)

        wire.choke()
        expect(wire.requests.length).toBe(1)
        callback(null, Buffer.alloc(666))
        resolve()
      }
    )

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test('Fast Extension: reject on error', () => {
  return new Promise<void>((resolve, reject) => {
    const wire = new Protocol()
    wire.on('error', (err: Error) => reject(err))
    wire.pipe(wire)

    wire.once('handshake', () => {
      expect(wire.extensions.fast).toBe(true)
      expect(wire.peerExtensions.fast).toBe(true)
      expect(wire.hasFast).toBe(true)
      wire.unchoke()
    })

    wire.once('unchoke', () => {
      expect(wire.requests.length).toBe(0)
      wire.request(6, 66, 666, (err: Error | null) => {
        expect(err).toBeTruthy()
      })
      expect(wire.requests.length).toBe(1)
      expect(wire.peerRequests.length).toBe(0)
    })

    wire.on(
      'request',
      (
        i: number,
        offset: number,
        length: number,
        callback: (err: Error | null, buffer?: Buffer) => void
      ) => {
        expect(wire.peerRequests.length).toBe(1)
        expect(i).toBe(6)
        expect(offset).toBe(66)
        expect(length).toBe(666)
        callback(new Error('cannot satisfy'), undefined)
      }
    )

    wire.on('reject', () => {
      expect(wire.requests.length).toBe(0)
      resolve()
    })

    wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'), {
      fast: true,
    })
  })
})

test('Fast Extension disabled: have-all', () => {
  const wire = new Protocol()
  expect(wire.hasFast).toBe(false)
  expect(() => wire.haveAll()).toThrow()
  wire.on('have-all', () => {
    throw new Error('should not emit')
  })
  return new Promise<void>((resolve) => {
    wire.on('close', () => {
      resolve()
    })
    ;(wire as any)._onHaveAll()
  })
})

test('Fast Extension disabled: have-none', () => {
  const wire = new Protocol()
  expect(wire.hasFast).toBe(false)
  expect(() => wire.haveNone()).toThrow()
  wire.on('have-none', () => {
    throw new Error('should not emit')
  })
  return new Promise<void>((resolve) => {
    wire.on('close', () => {
      resolve()
    })
    ;(wire as any)._onHaveNone()
  })
})

test('Fast Extension disabled: suggest', () => {
  const wire = new Protocol()
  expect(wire.hasFast).toBe(false)
  expect(() => wire.suggest(42)).toThrow()
  wire.on('suggest', () => {
    throw new Error('should not emit')
  })
  return new Promise<void>((resolve) => {
    wire.on('close', () => {
      resolve()
    })
    ;(wire as any)._onSuggest(42)
  })
})

test('Fast Extension disabled: allowed-fast', () => {
  const wire = new Protocol()
  expect(wire.hasFast).toBe(false)
  expect(() => wire.allowedFast(42)).toThrow()
  wire.on('allowed-fast', () => {
    throw new Error('should not emit')
  })
  return new Promise<void>((resolve) => {
    wire.on('close', () => {
      resolve()
    })
    ;(wire as any)._onAllowedFast(42)
  })
})

test('Fast Extension disabled: reject', () => {
  const wire = new Protocol()
  expect(wire.hasFast).toBe(false)
  expect(() => wire.reject(42, 0, 99)).toThrow()
  wire.on('reject', () => {
    throw new Error('should not emit')
  })
  return new Promise<void>((resolve) => {
    wire.on('close', () => {
      resolve()
    })
    ;(wire as any)._onReject(42, 0, 99)
  })
})
