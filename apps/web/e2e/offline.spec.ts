import { test, expect } from '@playwright/test'
import { dismissDisclaimer, waitForSwControl } from './helpers'

test.describe('Offline mode', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.setOffline(false)
    await page.goto('/')
    await dismissDisclaimer(page)
    await waitForSwControl(page)
    await page.waitForTimeout(400)
  })

  test('dashboard renders from SW cache when offline', async ({ page, context }) => {
    await context.setOffline(true)
    // Navigation fallback serves cached index.html; React re-renders from cache
    await page.reload({ waitUntil: 'commit' })

    const nav = page.locator('nav')
    await expect(nav.first()).toBeVisible({ timeout: 10_000 })
  })

  test('can navigate to /log offline via SPA routing', async ({ page, context }) => {
    await context.setOffline(true)
    // SPA navigation: clicking a link triggers React Router — no network request needed
    await page.click('a[href="/log"]')

    // Tab buttons on the Log page (they're <button> not role="tab")
    const glucoseBtn = page.getByRole('button', { name: /glycémie/i })
    await expect(glucoseBtn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('can navigate to /history offline via SPA routing', async ({ page, context }) => {
    await context.setOffline(true)
    await page.click('a[href="/history"]')

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('IndexedDB entry persists after offline', async ({ page, context }) => {
    // Submit a glucose reading while online
    await page.click('a[href="/log"]')
    // The glucose input has no htmlFor, so use the placeholder value
    const input = page.getByPlaceholder('120')
    await input.fill('110')
    await page.getByRole('button', { name: /enregistrer/i }).click()
    await page.waitForURL('/')

    await context.setOffline(true)
    const count = await page.evaluate(async () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('t1d-tracker')
        req.onsuccess = () => {
          const cnt = req.result.transaction('glucoseReadings', 'readonly')
            .objectStore('glucoseReadings').count()
          cnt.onsuccess = () => resolve(cnt.result)
          cnt.onerror = () => resolve(0)
        }
        req.onerror = () => resolve(0)
      }),
    )
    expect(count).toBeGreaterThan(0)
  })
})
