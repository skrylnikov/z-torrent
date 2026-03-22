import { createTrackerClient } from './client-class.js'
import { HTTPTracker, UDPTracker } from './client/tracker-import.browser.js'

export const Client = createTrackerClient(HTTPTracker, UDPTracker)
export type Client = InstanceType<typeof Client>

export type { AnnounceOptions, ScrapeOptions, ScrapeResponse } from './client-class.js'
