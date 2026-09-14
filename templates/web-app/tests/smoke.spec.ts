// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test, type Locator, type Page } from '@playwright/test';

/* The rate the app starts at; the assertions below are stated against it. */
const DEFAULT_SAMPLE_RATE = 100;
const MAX_SAMPLE_RATE = 250;
const OBSERVE_MS = 2000;
/* Comfortably over the package's longest transition, which the design rules cap at 200ms. */
const THEME_TRANSITION_MS = 400;

interface Stats {
  samples: number;
  chunks: number;
  frames: number;
}

async function readStats(stats: Locator): Promise<Stats> {
  const [samples, chunks, frames] = await Promise.all([
    stats.getAttribute('data-samples'),
    stats.getAttribute('data-chunks'),
    stats.getAttribute('data-frames'),
  ]);
  return {
    samples: Number(samples),
    chunks: Number(chunks),
    frames: Number(frames),
  };
}

async function setTheme(page: Page, label: 'System' | 'Light' | 'Dark') {
  await page.getByTestId('theme-select').click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    label.toLowerCase(),
  );
  // The package's components transition `color`, so the attribute lands before
  // the pixels do. Screenshotting on the attribute alone catches the badge and
  // the select mid-fade and reads as a contrast bug that is not there.
  await page.waitForTimeout(THEME_TRANSITION_MS);
}

test('the simulated source streams into the chart', async ({
  page,
}, testInfo) => {
  await page.goto('/');

  const badge = page.getByTestId('connection-badge');
  await expect(badge).toHaveAttribute('data-state', 'disconnected');
  await expect(page.getByTestId('chart-empty')).toBeVisible();

  await page.getByTestId('connect-button').click();
  await expect(badge).toHaveAttribute('data-state', 'connected');

  // The rendered trace, not just the counters: a path element means Recharts
  // received points and laid them out.
  await expect(
    page.locator('[data-testid="chart-panel"] .recharts-line-curve'),
  ).toBeVisible();

  const stats = page.getByTestId('stream-stats');
  await expect
    .poll(async () => (await readStats(stats)).samples)
    .toBeGreaterThan(0);

  const before = await readStats(stats);
  await page.waitForTimeout(OBSERVE_MS);
  const after = await readStats(stats);

  const seconds = OBSERVE_MS / 1000;
  const observedRate = (after.samples - before.samples) / seconds;
  const observedFps = (after.frames - before.frames) / seconds;

  // The generator holds the requested rate. Slack for timer coalescing.
  expect(observedRate).toBeGreaterThan(DEFAULT_SAMPLE_RATE * 0.8);
  expect(observedRate).toBeLessThan(DEFAULT_SAMPLE_RATE * 1.2);

  // The point of the rAF batching: renders are capped by the display, so the
  // frame count must stay well under the sample count however fast the source
  // runs. A regression that drops the batching shows up here as fps ~= rate.
  expect(observedFps).toBeGreaterThan(5);
  expect(observedFps).toBeLessThan(DEFAULT_SAMPLE_RATE * 0.75);

  /*
   * Now the same measurement at the top of the range. This is the assertion
   * that earns the ring buffer: two and a half times the samples must not buy
   * more renders. If someone replaces the rAF batching with a setState per
   * chunk, the two rates move together and this fails.
   */
  await page.getByRole('slider').press('End');
  await expect(page.getByTestId('sample-rate')).toHaveText('250 Hz');

  const fastBefore = await readStats(stats);
  await page.waitForTimeout(OBSERVE_MS);
  const fastAfter = await readStats(stats);

  const fastRate = (fastAfter.samples - fastBefore.samples) / seconds;
  const fastFps = (fastAfter.frames - fastBefore.frames) / seconds;

  expect(fastRate).toBeGreaterThan(MAX_SAMPLE_RATE * 0.8);
  expect(fastFps).toBeLessThan(fastRate / 2);

  testInfo.annotations.push({
    type: 'stream',
    description: [
      `at ${String(DEFAULT_SAMPLE_RATE)} Hz: ${observedRate.toFixed(1)} samples/s, ${((after.chunks - before.chunks) / seconds).toFixed(1)} chunks/s, ${observedFps.toFixed(1)} chart updates/s`,
      `at ${String(MAX_SAMPLE_RATE)} Hz: ${fastRate.toFixed(1)} samples/s, ${((fastAfter.chunks - fastBefore.chunks) / seconds).toFixed(1)} chunks/s, ${fastFps.toFixed(1)} chart updates/s`,
    ].join(' | '),
  });
});

test('renders at 1280 in both themes', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByTestId('connect-button').click();
  await expect(page.getByTestId('connection-badge')).toHaveAttribute(
    'data-state',
    'connected',
  );
  // Long enough for the window to fill, so the screenshot shows a full trace.
  await page.waitForTimeout(1500);

  await setTheme(page, 'Light');
  await page.screenshot({ path: testInfo.outputPath('app-1280-light.png') });

  await setTheme(page, 'Dark');
  await page.screenshot({ path: testInfo.outputPath('app-1280-dark.png') });
});
