import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests of the examples app in a real browser (`npm run e2e`). They use the locally installed
 * Chrome, run once with normal motion and once with reduced motion, and start the examples app on port
 * 4300 (an already running server there is reused).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4300',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1400, height: 900 },
  },
  projects: [
    { name: 'motion', use: { contextOptions: { reducedMotion: 'no-preference' } } },
    { name: 'reduced-motion', use: { contextOptions: { reducedMotion: 'reduce' } } },
  ],
  webServer: {
    command: 'npx ng serve examples --port 4300 --no-hmr',
    url: 'http://localhost:4300',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
