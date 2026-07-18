import { test, expect } from '@playwright/test'
import { getE2EState } from '../env'
import { openSintel } from '../helpers'

test.describe('Sintel site render (live P2P delivery)', () => {
  test('hero and player shell render in the portal iframe, served from the torrent', async ({
    page,
  }) => {
    const { portalUrl } = getE2EState()
    const frame = await openSintel(page, portalUrl)

    await expect(frame.getByRole('heading', { name: 'Sintel' })).toBeVisible()
    await expect(frame.locator('.badge')).toHaveText('Z-Torrent Host SDK Demo')

    const meta = frame.locator('.meta')
    await expect(meta).toContainText('2010')
    await expect(meta).toContainText('15 min')

    const watchBtn = frame.locator('#watchBtn')
    await expect(watchBtn).toBeVisible()
    await expect(watchBtn).toHaveText(/Watch via P2P/)

    // Player section is hidden until the user clicks Watch.
    await expect(frame.locator('#playerSection')).toBeHidden()
    // The video element exists but has no source yet.
    await expect(frame.locator('#videoPlayer')).toHaveJSProperty('currentSrc', '')

    // External link to Blender.org opens in a new tab.
    await expect(frame.getByRole('link', { name: /Blender.org/ })).toHaveAttribute(
      'target',
      '_blank'
    )
  })
})
