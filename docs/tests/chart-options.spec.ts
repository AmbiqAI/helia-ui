// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The chart options that only a drawing can answer for: whether a category
 * label survived the margin it was given, what a log axis actually ticked at,
 * whether the bars run in the order the legend claims, and whether the
 * reference rule is on the chart.
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

test('the bars run in the order the legend names them', async ({ page }) => {
  await page.goto(gallery);
  const figure = chart(page, 'Speedup by routine, compact');
  const legend = await figure
    .locator('.helia-chart__legend li')
    .allInnerTexts();
  expect(legend.map((one) => one.trim())).toEqual([
    'vector path',
    'scalar path',
    'reference',
  ]);

  /* The first bar of the first group is the first series, which is the check
     the legend order alone cannot make: both are read from the same list, and
     only the drawing says whether Plot sorted the band behind our back. */
  const swatch = await figure
    .locator('.helia-chart__swatch')
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  const bar = await figure
    .locator('svg g[data-plot-label="bar"] rect')
    .first()
    .evaluate((node) => getComputedStyle(node).fill);
  expect(bar).toBe(swatch);
});

test('a reference rule is drawn, named once, and labeled bars', async ({
  page,
}) => {
  await page.goto(gallery);
  const figure = chart(page, 'Speedup against the reference path');

  const rules = figure.locator('svg g[stroke-dasharray]');
  expect(await rules.count()).toBeGreaterThan(0);

  const named = figure.locator('svg text', { hasText: /^reference$/ });
  await expect(named).toHaveCount(1);

  const axisTitles = await figure
    .locator('svg g[data-plot-label$="-axis label"] text')
    .allTextContents();
  expect(axisTitles.join(' ')).toContain('Times faster than reference');
  expect(axisTitles.join(' ')).toContain('Routine');

  /* Twenty-eight bars, each with its value written past its end. */
  const values = figure.locator('svg g[data-plot-label="text"] text', {
    hasText: /x$/,
  });
  expect(await values.count()).toBeGreaterThanOrEqual(28);
});

for (const width of [1440, 764, 390])
  for (const theme of ['light', 'dark'] as const) {
    test(`standalone charts keep prose spacing at ${width} in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(gallery);
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const plot = page.locator('[data-example="prose-chart"]');
      const gap = await plot.evaluate(
        (node) =>
          node.getBoundingClientRect().top -
          node.previousElementSibling!.getBoundingClientRect().bottom,
      );
      expect(gap).toBeGreaterThanOrEqual(16);
      const group = page.locator('[data-example="prose-chart-group"]');
      expect(
        await group.evaluate((node) =>
          parseFloat(getComputedStyle(node).marginTop),
        ),
      ).toBeGreaterThanOrEqual(16);
      for (const figure of await group.locator('.helia-chart').all()) {
        await expect(figure).toHaveCSS('margin-top', '0px');
      }
    });
  }
