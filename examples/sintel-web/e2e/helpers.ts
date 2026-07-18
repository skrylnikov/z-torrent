import type { Page, FrameLocator } from '@playwright/test'

/**
 * Navigates to the portal URL and waits until the published sintel-web site has
 * been delivered into the portal's <iframe> (service worker registered + site
 * torrent resolved from the local seed). Returns a FrameLocator scoped to the
 * site iframe so tests can drive the player UI directly.
 */
export async function openSintel(
  page: Page,
  portalUrl: string,
  timeout = 60_000
): Promise<FrameLocator> {
  await page.goto(portalUrl)
  return waitForSiteFrame(page, timeout)
}

/**
 * Waits for the portal's site <iframe> to render the sintel-web hero heading.
 * This is the primary readiness gate: it implies the service worker is active
 * and the site torrent has been streamed from the local seed server.
 */
export async function waitForSiteFrame(page: Page, timeout = 60_000): Promise<FrameLocator> {
  const frame = page.frameLocator('iframe')
  await frame.getByRole('heading', { name: 'Sintel' }).waitFor({ state: 'visible', timeout })
  return frame
}
