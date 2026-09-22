// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * `header.hub`: the link back to the Dev Hub, at the end of the bar above the
 * collapse point and at the end of the menu below it. This site sets the
 * option; the unconfigured case is asserted at the option, in
 * scripts/header-hub.test.mjs. See AmbiqAI/helia-ui#98.
 */
import { expect, test } from '@playwright/test';

const base = '/helia-ui';
const hub = 'https://ambiqai.github.io/helia-developer-hub/';

test('the bar carries the link, with the family name picked out', async ({
  page,
}) => {
  await page.goto(`${base}/gallery/`);

  const link = page.locator('.helia-site-header__hub');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', hub);
  await expect(link).toHaveText('HELIA DEV HUB');
  await expect(link.locator('svg')).toHaveCount(0);
  const colors = await link.evaluate((node) => ({
    color: getComputedStyle(node).color,
    border: getComputedStyle(node).borderTopColor,
  }));
  expect(colors.color).toBe(colors.border);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the bar gives the link to the menu', async ({ page }) => {
    await page.goto(`${base}/gallery/`);

    /* No room for it beside the name and the button at this width. */
    await expect(page.locator('.helia-site-header__hub')).toBeHidden();

    const menuLink = page.locator('#starlight__sidebar .helia-sidebar-hub');
    await expect(menuLink).toBeHidden();

    await page.locator('[data-helia-sidebar-toggle]').click();
    await expect(menuLink).toBeVisible();
    await expect(menuLink).toHaveAttribute('href', hub);
    await expect(menuLink).toHaveText('HELIA DEV HUB');
  });
});

for (const theme of ['light', 'dark'] as const) {
  test(`desktop hub aligns with navigation in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1218, height: 900 });
    await page.goto('/helia-ui/');
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    const link = page.locator('.helia-site-header__hub');
    const nav = page.locator('.helia-site-header__nav > a').first();
    const box = await link.boundingBox();
    const neighbor = await nav.boundingBox();
    expect(Math.abs(box!.height - neighbor!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.y - neighbor!.y)).toBeLessThanOrEqual(1);
    expect(box!.height).toBeGreaterThanOrEqual(24);
    await page.keyboard.press('Tab');
    await link.focus();
    await expect(link).toHaveCSS('outline-style', 'solid');
  });

  test(`mobile hub retains its larger target in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/helia-ui/');
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    await page.locator('[data-helia-sidebar-toggle]').click();
    const link = page.locator('.helia-sidebar-hub');
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
}
