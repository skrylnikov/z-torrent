import { writable } from 'svelte/store'
import type { TorrentState } from '../lib/torrent-loader.js'
import { INITIAL_STATE } from '../lib/torrent-loader.js'

export const torrentState = writable<TorrentState>({ ...INITIAL_STATE })
