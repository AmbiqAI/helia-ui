// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { defineConfig, devices } from '@playwright/test';

/*
 * Not Vite's default preview port. `reuseExistingServer` cannot tell this app
 * from anything else already listening, so a developer with another preview
 * running would have the smoke test assert against that site instead.
 */
const port = 4319;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /*
         * The headless shell, not full Chromium. It is the smaller download,
         * it is what CI has, and nothing here needs a headed browser — a
         * streaming assertion is made from DOM counters, not by watching.
         */
        channel: 'chromium-headless-shell',
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    // The production build, so the test covers what the Pages deploy serves.
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${String(port)} --strictPort`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
