import { test, expect } from '@playwright/test'
import { getE2EState } from '../env'
import { openSintel } from '../helpers'

test.describe('Watch flow (live)', () => {
  test('clicking Watch reveals the player and kicks off torrent loading', async ({ page }) => {
    const { portalUrl } = getE2EState()
    const frame = await openSintel(page, portalUrl)

    const watchBtn = frame.locator('#watchBtn')
    await watchBtn.click()

    // startStreaming() applies all of these synchronously before awaiting host.add().
    await expect(frame.locator('#playerSection')).toBeVisible()
    await expect(frame.locator('#loadingOverlay')).toBeVisible()
    await expect(watchBtn).toBeDisabled()
    await expect(watchBtn).toHaveText(/Loading/)
    // Initial loading copy is set explicitly before any portal response.
    await expect(frame.locator('#loadingText')).toHaveText('Loading torrent metadata...')

    // The video element gains controls but no src until the portal resolves the torrent.
    await expect(frame.locator('#videoPlayer')).toHaveJSProperty('currentSrc', '')
  })
})
