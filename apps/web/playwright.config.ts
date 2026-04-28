import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'allow',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-pwa',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--ignore-certificate-errors', '--no-sandbox'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
