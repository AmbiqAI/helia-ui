// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { defineConfig } from '@playwright/test';

/* Change with `base` in astro.config.mjs. */
const base = '/PRODUCT-REPO-NAME';
const port = 4325;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
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
      /* The headless shell is the browser these tests need: no UI, and the
       * only Playwright download a docs CI has to pay for. */
      use: { channel: 'chromium-headless-shell' },
    },
  ],
  /*
   * Serves the build rather than running `astro preview`, which can detach
   * from the runner and fail the suite before a test reports. `npm run build`
   * is a separate step: see the README.
   */
  webServer: {
    command: `node scripts/serve-dist.mjs --port ${port} --base ${base}`,
    url: `${origin}${base}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
