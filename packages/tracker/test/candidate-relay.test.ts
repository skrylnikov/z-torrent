import { test, expect } from 'bun:test'
import { hex2bin, bin2hex } from 'uint8-util'
import { Server } from '../src/index.js'

type WS = any

const INFO_HASH_HEX = '4cb67059ed6bd08362da625b3ae77f6f4a075705'
const PEER_ID1_HEX = '3031323334353637383930313233343536373839'
const PEER_ID2_HEX = '3132333435363738393031323334353637383930'
const OFFER_ID_HEX = '6162636465666768696a6b6c6d6e6f7071727374757677'

let _WS: any
async function getWS() {
  if (!_WS) _WS = (await import('ws')).default
  return _WS
}

function createServer(cb: (server: any, port: number) => void): void {
  const server = new Server({ ws: true, http: false, udp: false })
  server.on('error', (err: Error) => {
    throw err
  })
  server.on('warning', () => {})
  server.listen(0, () => {
    const port = server.ws.address().port
    cb(server, port)
  })
}

async function wsConnect(port: number): Promise<WS> {
  const WS = await getWS()
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://127.0.0.1:${port}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function wsMessage(ws: WS): Promise<any> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: any) => {
      ws.removeListener('message', onMessage)
      ws.removeListener('error', onError)
      try {
        resolve(JSON.parse(data.toString()))
      } catch (err) {
        reject(err)
      }
    }
    const onError = (err: Error) => {
      ws.removeListener('message', onMessage)
      ws.removeListener('error', onError)
      reject(err)
    }
    ws.on('message', onMessage)
    ws.on('error', onError)
  })
}

test('ws server forwards ICE candidate between peers', async () => {
  let server!: any
  let ws1!: WS
  let ws2!: WS

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('test timeout')), 10000)

    createServer((srv, port) => {
      server = srv

      Promise.all([wsConnect(port), wsConnect(port)])
        .then(async ([w1, w2]) => {
          ws1 = w1
          ws2 = w2

          const infoHashBin = hex2bin(INFO_HASH_HEX)
          const peerId1Bin = hex2bin(PEER_ID1_HEX)
          const peerId2Bin = hex2bin(PEER_ID2_HEX)

          w1.send(
            JSON.stringify({
              action: 'announce',
              info_hash: infoHashBin,
              peer_id: peerId1Bin,
            })
          )

          const response1 = await wsMessage(w1)
          expect(response1.action).toBe('announce')
          expect(response1.complete).toBe(0)
          expect(response1.incomplete).toBe(1)

          w2.send(
            JSON.stringify({
              action: 'announce',
              info_hash: infoHashBin,
              peer_id: peerId2Bin,
            })
          )

          const response2 = await wsMessage(w2)
          expect(response2.action).toBe('announce')

          w2.send(
            JSON.stringify({
              action: 'announce',
              info_hash: infoHashBin,
              peer_id: peerId2Bin,
              to_peer_id: peerId1Bin,
              offer_id: hex2bin(OFFER_ID_HEX),
              candidate: {
                candidate: 'candidate:1 1 udp 2130706431 192.168.1.1 12345 typ host',
                sdpMid: '0',
                sdpMLineIndex: 0,
              },
            })
          )

          const candidateMsg = await wsMessage(w1)
          expect(candidateMsg.action).toBe('announce')
          expect(candidateMsg.candidate).toBeDefined()
          expect(candidateMsg.candidate.candidate).toContain('192.168.1.1')
          expect(bin2hex(candidateMsg.peer_id)).toBe(PEER_ID2_HEX)
          expect(bin2hex(candidateMsg.offer_id)).toBe(OFFER_ID_HEX)

          clearTimeout(timeout)
          resolve()
        })
        .catch(reject)
    })
  })

  ws1.close()
  ws2.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('ws server does not send announce response for candidate-only messages', async () => {
  let server!: any
  let ws1!: WS

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('test timeout')), 10000)

    createServer((srv, port) => {
      server = srv

      wsConnect(port)
        .then(async (w1) => {
          ws1 = w1

          w1.send(
            JSON.stringify({
              action: 'announce',
              info_hash: hex2bin(INFO_HASH_HEX),
              peer_id: hex2bin(PEER_ID1_HEX),
              to_peer_id: hex2bin(PEER_ID2_HEX),
              offer_id: hex2bin(OFFER_ID_HEX),
              candidate: {
                candidate: 'candidate:1 1 udp 2130706431 192.168.1.1 12345 typ host',
                sdpMid: '0',
                sdpMLineIndex: 0,
              },
            })
          )

          let receivedResponse = false
          setTimeout(() => {
            expect(receivedResponse).toBe(false)
            clearTimeout(timeout)
            resolve()
          }, 500)

          w1.on('message', (data: any) => {
            const parsed = JSON.parse(data.toString())
            if (
              parsed.action === 'announce' &&
              !parsed.candidate &&
              !parsed.offer &&
              !parsed.answer
            ) {
              receivedResponse = true
            }
          })
        })
        .catch(reject)
    })
  })

  ws1.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})
