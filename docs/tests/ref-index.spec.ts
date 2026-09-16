// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

/*
 * The symbol index, exercised as a reader uses it: type, filter, follow.
 *
 * The rows are built at build time, so the first three assertions are also the
 * claim that the island received them: a filter that narrows is a filter over
 * real rows, and a link that carries the symbol's anchor is the reason the
 * index exists at all.
 */

const page_ = '/helia-ui/react/data-display/';

const index = '[data-slot="ref-index"]';
const rows = `${index} [data-slot="ref-index-row"]`;

test('the index renders every row before anything is typed', async ({
  page,
}) => {
  await page.goto(page_);
  await expect(page.locator(rows)).toHaveCount(14);
  await expect(
    page.locator(`${index} [data-slot="ref-index-count"]`),
  ).toHaveText('14 of 14 symbols');
});

test('search text narrows the rows and the count', async ({ page }) => {
  await page.goto(page_);
  const search = page.locator(`${index} [data-slot="ref-index-search"]`);
  await search.fill('depthwise');

  await expect(page.locator(rows)).toHaveCount(2);
  await expect(
    page.locator(`${index} [data-slot="ref-index-count"]`),
  ).toHaveText('2 of 14 symbols');
  await expect(page.locator(rows).first()).toContainText('ex_depthwise_s4');
});

test('a data type chip filters, and two chips in one facet are an or', async ({
  page,
}) => {
  await page.goto(page_);
  const facet = page
    .locator(`${index} [data-slot="ref-index-facet"]`)
    .filter({ hasText: 'Data type' });

  const s8 = facet.getByRole('button', { name: 's8', exact: true });
  await s8.click();
  await expect(s8).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(rows)).toHaveCount(7);

  await facet.getByRole('button', { name: 's4', exact: true }).click();
  await expect(page.locator(rows)).toHaveCount(8);

  /* Across facets the filters are an and: int8 convolution, not int8 or
     convolution. */
  await page
    .locator(`${index} [data-slot="ref-index-facet"]`)
    .filter({ hasText: 'Group' })
    .getByRole('button', { name: 'Convolution', exact: true })
    .click();
  await expect(page.locator(rows)).toHaveCount(3);

  await page.locator(`${index} [data-slot="ref-index-clear"]`).click();
  await expect(page.locator(rows)).toHaveCount(14);
});

test('a row links to the symbol anchor on its generated page', async ({
  page,
}) => {
  await page.goto(page_);
  const link = page.getByRole('link', { name: 'ex_convolve_s8', exact: true });
  await expect(link).toHaveAttribute(
    'href',
    '/helia-ui/reference/api/examplenn/#ex_convolve_s8',
  );
});

test('a contract row opens a detail panel from the keyboard', async ({
  page,
}) => {
  await page.goto(page_);
  const toggle = page.getByRole('button', {
    name: 'Details for ex_convolve_s8',
  });

  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');

  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const detail = page.locator('#ex_convolve_s8-detail');
  await expect(detail).toContainText('ex_convolve_s8_get_buffer_size(dims)');
  await expect(detail).toContainText('Bit-exact against the scalar path.');
});

/*
 * Filtering must not move the page. The scroll frame is fixed, so the heading
 * after the index sits in the same place whether fourteen rows match or none.
 */
test('filtering moves nothing below the index', async ({ page }) => {
  await page.goto(page_);
  const frame = page.locator(index);
  const before = await frame.boundingBox();

  await page.locator(`${index} [data-slot="ref-index-search"]`).fill('zzz');
  await expect(page.locator(rows)).toHaveCount(0);

  const after = await frame.boundingBox();
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
});
