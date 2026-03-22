/*! @z-torrent/tracker. MIT License. */
import { createTrackerClient } from './client-class.js'
import { HTTPTracker } from './client/http-tracker.js'
import { UDPTracker } from './client/udp-tracker.js'

export const Client = createTrackerClient(HTTPTracker, UDPTracker)
export type Client = InstanceType<typeof Client>

export type { AnnounceOptions, ScrapeOptions, ScrapeResponse } from './client-class.js'
