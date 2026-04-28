import { test, expect } from '@playwright/test'
import { dismissDisclaimer, waitForSwActivated } from './helpers'

test.describe('Service Worker', () => {
  test('registers and reaches activated state', async ({ page }) => {
    await page.goto('/')
    await waitForSwActivated(page)

    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return reg.active?.state ?? null
    })
    expect(state).toBe('activated')
  })

  test('controls the page after activation (clients.claim)', async ({ page }) => {
    await page.goto('/')
    await waitForSwActivated(page)
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 8_000 })

    const scriptURL = await page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? '',
    )
    expect(scriptURL).toContain('sw.js')
  })

  test('precaches assets from the app shell', async ({ page }) => {
    await page.goto('/')
    await dismissDisclaimer(page)
    await waitForSwActivated(page)
    await page.waitForTimeout(400)

    const cachedURLs = await page.evaluate(async () => {
      const keys = await caches.keys()
      const all: string[] = []
      for (const k of keys) {
        const c = await caches.open(k)
        const reqs = await c.keys()
        all.push(...reqs.map((r) => r.url))
      }
      return all
    })

    expect(cachedURLs.some((u) => u.startsWith('http://localhost:4173'))).toBe(true)
  })

  test('cache persists across SPA navigation', async ({ page }) => {
    await page.goto('/')
    await dismissDisclaimer(page)
    await waitForSwActivated(page)
    await page.goto('/log')

    const cacheCount = await page.evaluate(async () => (await caches.keys()).length)
    expect(cacheCount).toBeGreaterThan(0)
  })
})
