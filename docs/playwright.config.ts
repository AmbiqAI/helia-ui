// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { defineConfig, devices } from '@playwright/test';

/* Change with `base` in astro.config.mjs. */
const base = '/helia-ui';
/* One above the hub's, so both suites can hold a server at once. */
const port = 4327;
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
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /*
   * Serves the build rather than running `astro preview`, which treats
   * `--port` as a hint and moves to a free one when it is busy: the suite then
   * times out on `url`, or drives whatever else holds the port. The static
   * server fails loudly on a busy port instead. `npm run build` stays a
   * separate step, the order CI runs.
   */
  webServer: {
    command: `node ../scripts/serve-dist.mjs --dist dist --base ${base} --port ${port}`,
    url: `${origin}${base}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
