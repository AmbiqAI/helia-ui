// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { defineConfig, devices } from '@playwright/test';

/* One above the hub's, so both suites can hold a preview server at once. */
const port = 4323;
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
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: `${origin}/helia-ui/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
