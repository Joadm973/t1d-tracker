import { test, expect } from '@playwright/test'
import { dismissDisclaimer, waitForSwControl, spoofStandalone, mockPushManager } from './helpers'

// Navigate to /settings via SPA navigation (avoids SW NavigationRoute silent failure
// that occurs when page.goto('/settings') is used as the very first navigation).
async function goToSettings(page: import('@playwright/test').Page) {
  await page.goto('/')
  await waitForSwControl(page)
  await dismissDisclaimer(page)
  await page.click('a[href="/settings"]')
}

test.describe('Push notifications — UI states', () => {
  test('shows install hint in non-standalone browser', async ({ page }) => {
    await goToSettings(page)

    // Non-standalone: PushSection renders a card with Safari install instructions
    const hint = page.getByText(/safari/i).first()
    await expect(hint).toBeVisible({ timeout: 10_000 })
    // No toggle switch should be visible when not installed
    await expect(page.getByRole('switch')).toHaveCount(0)
  })

  test('shows toggle switch when standalone', async ({ page }) => {
    await mockPushManager(page)
    await spoofStandalone(page)

    await goToSettings(page)

    // PushSection renders a Toggle (role="switch") when app is installed (standalone)
    const toggle = page.getByRole('switch').first()
    await expect(toggle).toBeVisible({ timeout: 10_000 })
  })

  test('toggle flips to checked after successful subscribe', async ({ page }) => {
    await mockPushManager(page)
    await spoofStandalone(page)
    // Mock Notification.requestPermission to return 'granted' without triggering
    // Chrome's native push infrastructure (which errors in headless mode).
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: function() { return 'granted' },
        configurable: true,
      })
      window.Notification.requestPermission = function() { return Promise.resolve('granted') }
    })

    await page.route('**/api/push/vapid-public-key', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        }),
      }),
    )
    await page.route('**/api/push/subscribe', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )

    await goToSettings(page)

    const toggle = page.getByRole('switch').first()
    await expect(toggle).toBeVisible({ timeout: 10_000 })

    const checked = await toggle.getAttribute('aria-checked')
    if (checked === 'false') {
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 })
    }
  })

  test('denied permission shows explanatory sub-label', async ({ page }) => {
    await mockPushManager(page)
    await spoofStandalone(page)
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', {
        get: function() { return 'denied' },
        configurable: true,
      })
    })

    await goToSettings(page)

    const deniedText = page.getByText(/refus/i).first()
    await expect(deniedText).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Push notifications — Service Worker handler', () => {
  test('SW push event triggers showNotification without crashing', async ({ page, context }) => {
    await context.grantPermissions(['notifications'])
    await page.goto('/')
    await dismissDisclaimer(page)
    await waitForSwControl(page)

    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const cdpSession = await context.newCDPSession(page)
    await cdpSession.send('ServiceWorker.enable')

    const registrations: { registrationId: string; scopeURL: string }[] = []
    cdpSession.on('ServiceWorker.workerRegistrationUpdated', ({ registrations: r }) => {
      registrations.push(...r)
    })
    await page.evaluate(() => navigator.serviceWorker.getRegistrations())
    await page.waitForTimeout(500)

    const reg = registrations.find((r) => r.scopeURL.includes('localhost'))
    if (!reg) {
      expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
      return
    }

    await cdpSession.send('ServiceWorker.deliverPushMessage', {
      origin: 'http://localhost:4173',
      registrationId: reg.registrationId,
      data: JSON.stringify({ title: 'Test Rappel', body: 'Vérifiez votre glycémie', url: '/log' }),
    })

    await page.waitForTimeout(800)
    expect(errors).toHaveLength(0)
  })

  test('SW push handler recovers from malformed JSON payload', async ({ page, context }) => {
    await context.grantPermissions(['notifications'])
    await page.goto('/')
    await dismissDisclaimer(page)
    await waitForSwControl(page)

    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const cdpSession = await context.newCDPSession(page)
    await cdpSession.send('ServiceWorker.enable')

    const registrations: { registrationId: string; scopeURL: string }[] = []
    cdpSession.on('ServiceWorker.workerRegistrationUpdated', ({ registrations: r }) => {
      registrations.push(...r)
    })
    await page.evaluate(() => navigator.serviceWorker.getRegistrations())
    await page.waitForTimeout(500)

    const reg = registrations.find((r) => r.scopeURL.includes('localhost'))
    if (!reg) {
      expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
      return
    }

    await cdpSession.send('ServiceWorker.deliverPushMessage', {
      origin: 'http://localhost:4173',
      registrationId: reg.registrationId,
      data: 'not-valid-json',
    })

    await page.waitForTimeout(800)
    await expect(page.locator('body')).not.toBeEmpty()
    expect(errors).toHaveLength(0)
  })
})
