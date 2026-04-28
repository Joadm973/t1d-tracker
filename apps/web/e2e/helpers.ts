import type { Page } from '@playwright/test'

/** Dismiss the first-launch disclaimer modal.
 *  Uses a JS-level click to avoid Framer Motion animation stability issues.
 */
export async function dismissDisclaimer(page: Page) {
  const btn = page.getByRole('button', { name: /j.ai compris/i })
  const visible = await btn.isVisible({ timeout: 3_000 }).catch(() => false)
  if (!visible) return
  // Bypass Playwright stability check — Framer Motion enter animation makes the
  // button position unstable, causing infinite "not stable" retries.
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach((b) => {
      if (/compris/i.test(b.textContent ?? '')) b.click()
    })
  })
  // Wait until the modal is fully unmounted (Framer Motion spring exit animation).
  // While the overlay (fixed inset-0 z-50) is still animating it intercepts all clicks.
  await page.waitForFunction(
    () => !Array.from(document.querySelectorAll('button')).some(
      (b) => /compris/i.test(b.textContent ?? ''),
    ),
    { timeout: 5_000 },
  )
}

/** Wait until the SW has activated AND called clients.claim() (controls the page). */
export async function waitForSwControl(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10_000 })
}

/** Wait for the SW to fully reach 'activated' state (past 'activating'). */
export async function waitForSwActivated(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    const sw = reg.active
    if (!sw || sw.state === 'activated') return
    await new Promise<void>((resolve) => {
      sw.addEventListener('statechange', function handler() {
        if (sw.state === 'activated') {
          sw.removeEventListener('statechange', handler)
          resolve()
        }
      })
    })
  })
}

/**
 * Mock pushManager.getSubscription() and pushManager.subscribe() so tests
 * don't depend on the real browser push service (which hangs in Playwright).
 * Must be called before page.goto() so the initScript is installed first.
 */
export async function mockPushManager(page: Page) {
  await page.addInitScript(() => {
    var fakeSub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/FAKE_TOKEN_FOR_PLAYWRIGHT',
      expirationTime: null,
      options: { applicationServerKey: null, userVisibleOnly: true },
      getKey: function() { return new ArrayBuffer(0) },
      toJSON: function() {
        return {
          endpoint: 'https://fcm.googleapis.com/fcm/send/FAKE_TOKEN_FOR_PLAYWRIGHT',
          expirationTime: null,
          keys: { p256dh: 'BAAFakeKey', auth: 'FakeAuth' },
        }
      },
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true },
      unsubscribe: function() { return Promise.resolve(true) },
    }

    // Patch PushManager prototype directly so any pushManager instance uses mocks.
    // This must run before page scripts, which is guaranteed by addInitScript.
    try {
      if (typeof PushManager !== 'undefined') {
        PushManager.prototype.getSubscription = function() { return Promise.resolve(null) }
        PushManager.prototype.subscribe = function() { return Promise.resolve(fakeSub) }
        PushManager.prototype.permissionState = function() { return Promise.resolve('granted') }
      }
    } catch(_e) {
      // PushManager not available or non-configurable — fall through to ready-based patch
    }

    // Also patch via navigator.serviceWorker.ready for defence-in-depth.
    // ServiceWorkerContainer is not a global — use Object.getPrototypeOf instead.
    var swProto = Object.getPrototypeOf(navigator.serviceWorker)
    var descriptor = Object.getOwnPropertyDescriptor(swProto, 'ready')
    if (!descriptor || !descriptor.get) return

    Object.defineProperty(navigator.serviceWorker, 'ready', {
      get: function() {
        return descriptor.get.call(this).then(function(reg) {
          if (reg.__pushMocked) return reg
          reg.__pushMocked = true
          try {
            reg.pushManager.getSubscription = function() { return Promise.resolve(null) }
            reg.pushManager.subscribe = function() { return Promise.resolve(fakeSub) }
          } catch(_e) {
            // ignore — prototype already patched above
          }
          return reg
        })
      },
      configurable: true,
    })
  })
}

/** Override matchMedia so detectInstalled() returns true (simulates standalone PWA). */
export async function spoofStandalone(page: Page) {
  await page.addInitScript(() => {
    var _orig = window.matchMedia.bind(window)
    window.matchMedia = function(query) {
      if (query === '(display-mode: standalone)') {
        var mql = _orig(query)
        return {
          matches: true,
          media: mql.media,
          onchange: mql.onchange,
          addListener: mql.addListener.bind(mql),
          removeListener: mql.removeListener.bind(mql),
          addEventListener: mql.addEventListener.bind(mql),
          removeEventListener: mql.removeEventListener.bind(mql),
          dispatchEvent: mql.dispatchEvent.bind(mql),
        }
      }
      return _orig(query)
    }
  })
}
