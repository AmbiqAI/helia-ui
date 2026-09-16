// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The `sections` option: the left sidebar carries the current section's pages
 * and nothing else, under the section's name, and the top bar marks the
 * section the page is in. The fixture is the three demo sections under
 * `starlight-plugin/sections/`; everything else on this site is outside them,
 * which is what the last test reads. See AmbiqAI/helia-ui#95.
 */
import { expect, test, type Page } from '@playwright/test';

const base = '/helia-ui';
const fixture = `${base}/starlight-plugin/sections`;

/* The pane's own list, not the row of social and theme controls Starlight puts
   at the foot of it for narrow screens. */
const entries = (page: Page) =>
  page.locator('#starlight__sidebar ul.top-level a');

const heading = (page: Page) =>
  page.locator('#starlight__sidebar [data-helia-sidebar-heading]');

test('a section page carries that section and nothing else', async ({
  page,
}) => {
  await page.goto(`${fixture}/guide/first-steps/`);

  await expect(heading(page)).toHaveText('Demo guide');
  await expect(entries(page)).toHaveText(['First steps', 'Next steps']);
});

test('the top bar marks the section the page is in', async ({ page }) => {
  await page.goto(`${fixture}/guide/first-steps/`);

  const nav = page.locator('.helia-site-header__nav');
  await expect(nav.locator('[aria-current="page"]')).toHaveText(
    'Starlight plugin',
  );
});

test('the landing page shows the home section', async ({ page }) => {
  /* A `template: splash` page, so it has a sidebar at all only because of
     `sidebar: 'always'`: the two options have to hold together. */
  await page.goto(`${fixture}/`);

  await expect(heading(page)).toHaveText('Demo home');
  await expect(entries(page)).toHaveText(['Sections demo', 'Why sections']);
});

test('a generated section lists its pages one level down', async ({ page }) => {
  await page.goto(`${fixture}/reference/widget/`);

  await expect(heading(page)).toHaveText('Demo reference');
  await expect(entries(page)).toHaveText(['Gadget API', 'Widget API']);
  /* One level: an `autogenerate` directory inside a section is the section's
     own list, not a group nested under it. */
  await expect(page.locator('#starlight__sidebar details')).toHaveCount(0);
});

test('a page in no section keeps the site sidebar', async ({ page }) => {
  await page.goto(`${base}/cards/`);

  await expect(heading(page)).toHaveCount(0);
  const labels = await entries(page).allTextContents();
  expect(labels).toContain('Cards');
  expect(labels).toContain('Tokens and scales');
  /* The fixture's sections are appended to this site's sidebar config so
     Starlight resolves them; a page outside them must not see them. */
  expect(labels).not.toContain('First steps');
});
