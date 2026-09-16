// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The `sections` option: the left sidebar carries the current section's pages
 * and nothing else, under the section's name, and the top bar marks the
 * section the page is in. A section that declared `sidebar: false` has no pane
 * at all, and below the bar's collapse point the menu button carries every
 * section instead of the bar. The fixture is the three demo sections under
 * `starlight-plugin/sections/`; everything else on this site is outside them,
 * which is what the last wide-screen test reads.
 * See AmbiqAI/helia-ui#95 and AmbiqAI/helia-ui#97.
 */
import { expect, test, type Page } from '@playwright/test';

const base = '/helia-ui';
const fixture = `${base}/starlight-plugin/sections`;

/* The pane's own list at desktop width, not the section list beside it and not
   the row of social and theme controls Starlight puts at the foot of the pane
   for narrow screens. */
const entries = (page: Page) =>
  page.locator(
    '#starlight__sidebar [data-helia-sidebar-scoped] ul.top-level a',
  );

const heading = (page: Page) =>
  page.locator('#starlight__sidebar [data-helia-sidebar-heading]');

/** Every section, as the narrow-width menu lists them. */
const sectionMenu = (page: Page) =>
  page.locator('#starlight__sidebar [data-helia-sidebar-sections]');

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

test('a section with no pages has no pane and no column', async ({ page }) => {
  /* The fixture's landing page: `template: splash` under `sidebar: 'always'`,
     which `sidebar: false` on the section overrides. */
  await page.goto(`${fixture}/`);

  await expect(page.locator('#starlight__sidebar')).toBeHidden();

  const frame = page.viewportSize()!.width;
  const content = (await page.locator('.main-pane').boundingBox())!.width;
  /* The column is gone rather than empty: what it held is the content's, up to
     the scrollbar the viewport measurement includes. */
  expect(content).toBeGreaterThan(frame - 20);
});

test('a generated section lists its pages one level down', async ({ page }) => {
  await page.goto(`${fixture}/reference/widget/`);

  await expect(heading(page)).toHaveText('Demo reference');
  await expect(entries(page)).toHaveText(['Gadget API', 'Widget API']);
  /* One level: an `autogenerate` directory inside a section is the section's
     own list, not a group nested under it. */
  await expect(page.locator('[data-helia-sidebar-scoped] details')).toHaveCount(
    0,
  );
});

test('a page in no section keeps the site sidebar', async ({ page }) => {
  await page.goto(`${base}/cards/`);

  await expect(heading(page)).toHaveCount(0);
  await expect(sectionMenu(page)).toHaveCount(0);
  const labels = await entries(page).allTextContents();
  expect(labels).toContain('Cards');
  expect(labels).toContain('Tokens and scales');
  /* The fixture's sections are appended to this site's sidebar config so
     Starlight resolves them; a page outside them must not see them. */
  expect(labels).not.toContain('First steps');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the menu button opens the list of sections', async ({ page }) => {
    await page.goto(`${fixture}/`);

    await page.locator('[data-helia-sidebar-toggle]').click();
    const menu = sectionMenu(page);
    await expect(menu).toBeVisible();

    /* Every section, whether or not it has a pane of its own: the bar's links
       are gone at this width, so this is the only way to the rest of the
       site. */
    await expect(menu.locator('> ul > li')).toHaveCount(3);
    await expect(menu.locator('a[aria-current="page"]')).toHaveText(
      'Demo home',
    );
    await expect(menu.locator('summary')).toHaveText([
      'Demo guide',
      'Demo reference',
    ]);

    /* Expandable, with the section's pages under it. */
    await expect(menu.getByRole('link', { name: 'First steps' })).toBeHidden();
    await menu.locator('summary', { hasText: 'Demo guide' }).click();
    await expect(menu.getByRole('link', { name: 'First steps' })).toBeVisible();
  });

  test('the section pane gives way to the section list', async ({ page }) => {
    await page.goto(`${fixture}/guide/first-steps/`);

    await page.locator('[data-helia-sidebar-toggle]').click();
    await expect(sectionMenu(page)).toBeVisible();
    /* One navigation at a time: the section-scoped pane is the wide-screen
       one, and it is not drawn under the list of every section. */
    await expect(heading(page)).toBeHidden();
    await expect(entries(page).first()).toBeHidden();
    /* The current section opens with the page it is on marked. */
    await expect(
      sectionMenu(page).locator('a[aria-current="page"]'),
    ).toHaveText('First steps');
  });
});
