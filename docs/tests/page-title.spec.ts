// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

const heroPage = '/helia-ui/starlight-plugin/hero-page/';
const docPage = '/helia-ui/starlight-plugin/';

test('a page that opts out has the hero headline as its only h1', async ({
  page,
}) => {
  await page.goto(heroPage);

  const headings = page.locator('h1');
  await expect(headings).toHaveCount(1);
  await expect(headings).toHaveClass(/helia-hero__headline/);
});

test('the skip link still lands at the top of the content', async ({
  page,
}) => {
  await page.goto(heroPage);

  const anchor = page.locator('#_top');
  await expect(anchor).toHaveCount(1);
  await expect(page.locator('a.sl-skip-link')).toHaveAttribute('href', '#_top');

  await page.keyboard.press('Tab');
  await expect(page.locator('a.sl-skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(anchor).toBeFocused();

  /* Ahead of the content rather than past it: the next stop is the hero's
     first action, not something in the shell behind it. */
  await page.keyboard.press('Tab');
  await expect(page.locator('.helia-hero__actions a').first()).toBeFocused();
});

test('a page that does not opt out keeps the Starlight title', async ({
  page,
}) => {
  await page.goto(docPage);

  const heading = page.locator('h1#_top');
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText('Starlight plugin');
});
