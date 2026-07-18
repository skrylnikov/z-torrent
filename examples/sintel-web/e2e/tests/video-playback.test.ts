import { test, expect } from '@playwright/test'
import { getE2EState } from '../env'
import { openSintel } from '../helpers'

test.describe('Video playback (live, requires internet)', () => {
  // Don't retry the internet-gated test: if the public swarm is unreachable the
  // metadata wait simply fails again, so retrying only burns time.
  test.describe.configure({ retries: 0 })

  // The Sintel video is a separate, well-known external torrent. The portal
  // streams it from public WebTorrent trackers, so this test needs internet
  // access to those trackers. It will fail (after ~2.5 min) in an offline or
  // firewalled environment — that is expected, not a product regression.
  test('streams the Sintel mp4 via P2P and starts playback', async ({ page }) => {
    test.setTimeout(150_000)
    const { portalUrl } = getE2EState()
    const frame = await openSintel(page, portalUrl)

    await frame.locator('#watchBtn').click()

    // The portal replies with `torrent-added` once metadata arrives from the
    // public swarm; player.ts then points <video> at the SW-served file URL.
    // Sintel is a well-seeded torrent — metadata usually lands in <30s when the
    // public trackers are reachable; 90s gives headroom for WebRTC setup.
    await expect(frame.locator('#videoPlayer')).toHaveAttribute('src', /\/z-torrent\//, {
      timeout: 90_000,
    })

    // Loading overlay is dismissed and the button flips to "Now Playing".
    await expect(frame.locator('#loadingOverlay')).toBeHidden({ timeout: 30_000 })
    await expect(frame.locator('#watchBtn')).toHaveText(/Now Playing/)

    // Confirm media data actually flows (readyState >= 2 == HAVE_CURRENT_DATA).
    await expect
      .poll(
        async () =>
          await frame
            .locator('#videoPlayer')
            .evaluate((v: HTMLVideoElement) => v.readyState),
        { timeout: 45_000, message: 'video readyState >= 2' }
      )
      .toBeGreaterThanOrEqual(2)
  })
})
