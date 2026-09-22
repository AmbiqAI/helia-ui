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
  await page.goto(`http://127.0.0.1:4327${route}`);
  await expect(page.locator('.helia-reference-browser tbody tr')).toHaveCount(
    32,
  );
  await expect(page.locator('.helia-reference-controls')).toBeHidden();
  await page.getByRole('link', { name: 'Operation 32', exact: true }).click();
  await expect(page).toHaveURL(/#reference-details$/);
  await context.close();
});
test('Markdown retains the final entry and its restriction', async ({
  request,
}) => {
  const response = await request.get(`${route}index.md`);
  expect(response.ok()).toBeTruthy();
  const text = await response.text();
  expect(text).toContain('Operation 32');
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
