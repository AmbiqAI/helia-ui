// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The `sections` option: the left sidebar carries the current section's pages
 * and nothing else, under the section's name, and the top bar marks the
 * section the page is in. A section that declared `sidebar: false` has no pane
 * at all. On mobile, the header dropdown switches sections. The fixture is the three demo sections under
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
  test('dropdown changes sections and keeps the sidebar scoped', async ({
    page,
  }) => {
    await page.goto(`${fixture}/`);
    const dropdown = page.locator('[data-helia-section-dropdown]');
    await dropdown.locator('summary').click();
    await expect(dropdown.locator('a')).toHaveText([
      'Demo home',
      'Demo guide',
      'Demo reference',
    ]);
    await dropdown
      .getByRole('link', { name: 'Demo guide', exact: true })
      .click();
    await page.locator('[data-helia-sidebar-toggle]').click();
    await expect(heading(page)).toHaveText('Demo guide');
    await expect(entries(page)).toHaveText(['First steps', 'Next steps']);
    await expect(sectionMenu(page)).toHaveCount(0);
  });
  test('disclosure supports keyboard, dismissal and breakpoint changes', async ({
    page,
  }) => {
    await page.goto(`${fixture}/guide/first-steps/`);
    const dropdown = page.locator('[data-helia-section-dropdown]');
    const trigger = dropdown.locator('summary');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(dropdown).toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    await expect(
      dropdown.getByRole('link', { name: 'Demo home', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dropdown).not.toHaveAttribute('open');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(5, 400);
    await expect(dropdown).not.toHaveAttribute('open');
    await trigger.click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(dropdown).toBeHidden();
    await expect(dropdown).not.toHaveAttribute('open');
  });
});
