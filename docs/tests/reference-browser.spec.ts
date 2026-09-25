// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';
const route = '/helia-ui/react/reference-browser/';
test('consumer facets combine with search, reset and paging', async ({
  page,
}) => {
  await page.goto(route);
  const browser = page.getByRole('region', {
    name: 'Find an operation',
    exact: true,
  });
  await expect(browser).toHaveAttribute('data-ready', 'true');
  await expect(browser.locator('tbody tr')).toHaveCount(25);
  await browser.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(browser.locator('tbody tr')).toHaveCount(7);
  await browser
    .getByLabel('Family', { exact: true })
    .selectOption('Arithmetic');
  await browser.getByLabel('Precision', { exact: true }).selectOption('FP16');
  await expect(browser.getByRole('status')).toContainText('5 of 32');
  await browser.getByRole('searchbox').fill('impossible');
  await expect(browser.getByText('No matching operations.')).toBeVisible();
  await browser.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(browser.locator('tbody tr')).toHaveCount(25);
  await browser
    .getByRole('link', { name: 'Operation 01', exact: true })
    .click();
  await expect(page).toHaveURL(/#reference-details$/);
});
test('all rows and links remain usable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(new URL(route, test.info().project.use.baseURL).href);
  await expect(
    page
      .getByRole('region', { name: 'Find an operation', exact: true })
      .locator('tbody tr'),
  ).toHaveCount(32);
  for (const controls of await page
    .locator('.helia-reference-controls')
    .all()) {
    await expect(controls).toBeHidden();
  }
  await expect(
    page
      .getByRole('region', { name: 'Find an empty entry', exact: true })
      .getByRole('button', { name: 'Clear filters' }),
  ).toBeHidden();
  await page.getByRole('link', { name: 'Operation 32', exact: true }).click();
  await expect(page).toHaveURL(/#reference-details$/);
  await context.close();
});
test('Markdown retains every destination and the final restriction', async ({
  request,
}) => {
  const response = await request.get(`${route}index.md`);
  expect(response.ok()).toBeTruthy();
  const text = await response.text();
  for (let index = 1; index <= 32; index++) {
    const name = `Operation ${String(index).padStart(2, '0')}`;
    expect(text).toContain(
      `[${name}](https://ambiqai.github.io/helia-ui/react/reference-browser/#reference-details)`,
    );
  }
  expect(text).toContain('Check shape restrictions');
});
test('prose, callout and code share one content column', async ({ page }) => {
  await page.goto(route);
  const widths = await page.evaluate(() =>
    [
      '.sl-markdown-content > p',
      '.sl-markdown-content > aside',
      '.sl-markdown-content > .expressive-code',
    ].map(
      (selector) =>
        document.querySelector(selector)?.getBoundingClientRect().width,
    ),
  );
  expect(widths[0]).toBeTruthy();
  for (const width of widths.slice(1))
    if (width) expect(Math.abs(width - widths[0]!)).toBeLessThan(2);
});

for (const width of [1440, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`reference controls work by keyboard at ${width} in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const region = page.getByRole('region', {
        name: 'Find an operation',
        exact: true,
      });
      await expect(region).toHaveAttribute('data-ready', 'true');
      const search = region.getByRole('searchbox');
      await search.focus();
      await page.keyboard.type('shape FP16');
      await expect(region.locator('tbody tr')).toHaveCount(5);
      await page.keyboard.press('Tab');
      await expect(region.getByLabel('Family', { exact: true })).toBeFocused();
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(region.getByLabel('Family', { exact: true })).toHaveValue(
        'Arithmetic',
      );
      const clear = region.getByRole('button', {
        name: 'Clear filters',
        exact: true,
      });
      await clear.focus();
      await page.keyboard.press('Enter');
      await expect(search).toHaveValue('');
      await expect(region.getByRole('status')).toContainText('32 of 32');
      await region.getByLabel('Sort by').selectOption('reverse');
      await expect(region.locator('tbody tr').first()).toContainText(
        'Operation 32',
      );
      const next = region.getByRole('button', { name: 'Next', exact: true });
      await next.focus();
      await page.keyboard.press('Enter');
      await expect(region.locator('tbody tr')).toHaveCount(7);
      await expect(region.locator('tbody tr').first()).toContainText(
        'Operation 07',
      );
      await expect(next).toBeDisabled();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });
  }
}

test('consumer group facets override display groups, including empty facets', async ({
  page,
}) => {
  await page.goto(route);
  const region = page.getByRole('region', {
    name: 'Find an overridden entry',
    exact: true,
  });
  await expect(region).toHaveAttribute('data-ready', 'true');
  await region
    .getByLabel('Consumer family', { exact: true })
    .selectOption('Consumer family');
  await expect(region.getByRole('status')).toContainText('1 of 2');
  await expect(
    region.getByRole('link', { name: 'Overridden entry', exact: true }),
  ).toBeVisible();
  await expect(
    region.getByRole('link', { name: 'Excluded entry', exact: true }),
  ).toHaveCount(0);
});
