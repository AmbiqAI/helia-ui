// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test, type Page } from '@playwright/test';

const base = '/helia-ui';
/* A documentation page and a `template: splash` page: the landing page only
   has a sidebar at all because of `sidebar: 'always'`, so it is the one that
   answers whether the button works where that option put the pane.
   See AmbiqAI/helia-ui#85. */
const routes = [
  { name: 'a documentation page', path: `${base}/gallery/` },
  {
    name: 'a splash landing',
    path: `${base}/starlight-plugin/landing-example/`,
  },
];

/* 900 is between Starlight's sidebar breakpoint (50rem) and the width the
   package gives the pane back (62rem), which is where an open menu locked the
   page against a pane of no width. See AmbiqAI/helia-ui#88. */
const viewports = [
  { name: 'between the two breakpoints', width: 900, height: 800 },
  { name: 'on a phone', width: 375, height: 812 },
];

const scrollTop = (page: Page) => page.evaluate(() => window.scrollTo(0, 0));
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/** How far the document moves when the page is asked to scroll. */
async function wheelBy(page: Page, delta: number) {
  const view = page.viewportSize()!;
  const before = await scrollY(page);
  await page.mouse.move(view.width / 2, view.height / 2);
  await page.mouse.wheel(0, delta);
  /* The wheel is delivered asynchronously and the page may animate the jump. */
  await page.waitForTimeout(250);
  return (await scrollY(page)) - before;
}

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of routes) {
      test.describe(route.name, () => {
        test.beforeEach(async ({ page }) => {
          await page.goto(route.path);
          /* Nothing below means anything on a page that already fits. */
          expect(
            await page.evaluate(
              () => document.documentElement.scrollHeight - window.innerHeight,
            ),
          ).toBeGreaterThan(200);
        });

        test('the button opens the pane and gives the page back', async ({
          page,
        }) => {
          const toggle = page.locator('[data-helia-sidebar-toggle]');
          const pane = page.locator('#starlight__sidebar');

          await expect(toggle).toBeVisible();
          await expect(pane).toBeHidden();
          expect(await wheelBy(page, 400)).toBeGreaterThan(0);

          await scrollTop(page);
          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
          await expect(pane).toBeVisible();
          expect((await pane.boundingBox())!.width).toBeGreaterThan(0);
          expect(await wheelBy(page, 400)).toBe(0);

          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await expect(pane).toBeHidden();
          expect(await wheelBy(page, 400)).toBeGreaterThan(0);
        });

        test('escape closes the pane', async ({ page }) => {
          const toggle = page.locator('[data-helia-sidebar-toggle]');
          const pane = page.locator('#starlight__sidebar');

          await toggle.click();
          await expect(pane).toBeVisible();

          await page.keyboard.press('Escape');
          await expect(pane).toBeHidden();
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await expect(toggle).toBeFocused();
          expect(await wheelBy(page, 400)).toBeGreaterThan(0);
        });

        test('a link in the pane closes it on the way out', async ({
          page,
        }) => {
          const toggle = page.locator('[data-helia-sidebar-toggle]');
          const pane = page.locator('#starlight__sidebar');

          await toggle.click();
          await expect(pane).toBeVisible();

          /* The handler is what is under test, not the browser's navigation:
             the click is stopped at the document, after the handler has had
             it, so the assertions have a page left to run on. */
          await page.evaluate(() =>
            document.addEventListener('click', (event) =>
              event.preventDefault(),
            ),
          );

          await pane.locator('a[href$="/foundations/"]').first().click();
          await expect(pane).toBeHidden();
          await expect(page.locator('body')).not.toHaveAttribute(
            'data-mobile-menu-expanded',
            /.*/,
          );
          expect(await wheelBy(page, 400)).toBeGreaterThan(0);
        });
      });
    }
  });
}
