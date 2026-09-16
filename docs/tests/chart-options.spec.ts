// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The chart options that only a drawing can answer for, starting with whether
 * a category label survived the margin it was given.
 *
 * The unit tests assert the arithmetic that produced these; this asserts the
 * page. A margin computed from a label's length is a guess about type metrics
 * until a browser has set the type.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

const gallery = '/helia-ui/gallery/';

/** The figure under the title, rather than the source beside it. */
function chart(page: Page, title: string): Locator {
  return page
    .locator('figure.helia-chart')
    .filter({ has: page.getByText(title, { exact: true }) });
}

function ticks(figure: Locator, axis: string): Locator {
  return figure.locator(`svg g[data-plot-label="${axis}"] text`);
}

test('a horizontal chart cuts no category label', async ({ page }) => {
  await page.goto(gallery);
  const figure = chart(page, 'Speedup by routine');
  const svg = figure.locator('svg').first();
  const box = await svg.boundingBox();
  expect(box).not.toBeNull();

  const labels = ticks(figure, 'fy-axis tick label');
  await expect(labels).toHaveCount(14);

  for (let index = 0; index < 14; index += 1) {
    const label = labels.nth(index);
    const text = (await label.textContent())?.trim() ?? '';
    expect(text).not.toBe('');
    const bounds = await label.boundingBox();
    expect(bounds, `label ${text} has no box`).not.toBeNull();
    if (!bounds || !box) continue;
    /* A label drawn past the viewport edge is clipped by it, so the assertion
       is containment rather than legibility, which nothing can measure. */
    expect(
      bounds.x,
      `label ${text} starts left of the figure`,
    ).toBeGreaterThanOrEqual(box.x - 0.5);
    expect(
      bounds.x + bounds.width,
      `label ${text} runs past the plot area`,
    ).toBeLessThanOrEqual(box.x + box.width + 0.5);
  }
});

test('a log axis ticks at 1, 2 and 5 through each decade', async ({ page }) => {
  await page.goto(gallery);
  const figure = chart(page, 'Speedup by routine, logarithmic');
  const labels = await ticks(figure, 'x-axis tick label').allTextContents();
  expect(labels.map((one) => one.trim())).toEqual([
    '0.5x',
    '1x',
    '2x',
    '5x',
    '10x',
    '20x',
  ]);
});
