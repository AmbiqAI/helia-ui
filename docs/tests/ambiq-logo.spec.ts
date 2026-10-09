// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`official Ambiq artwork in ${theme} mode`, async ({ page }) => {
    await page.goto('/helia-ui/foundations/');
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const tone of ['blue', 'black']) {
      const logo = page.locator(`[data-logo-example="${tone}"] .ambiq-logo`);
      await expect(logo).toBeVisible();
      const style = await logo.evaluate((el) => ({
        color: getComputedStyle(el).color,
        mask: getComputedStyle(el).maskImage,
      }));
      expect(style.color).toBe(
        theme === 'dark'
          ? 'rgb(255, 255, 255)'
          : tone === 'blue'
            ? 'rgb(0, 71, 186)'
            : 'rgb(17, 19, 24)',
      );
      const url = style.mask.match(/url\("?([^"\)]+)"?\)/)?.[1];
      expect(url).toBeTruthy();
      const response = await page.request.get(url!);
      expect(response.ok()).toBeTruthy();
      const svg = await response.text();
      expect(svg).toContain('<svg');
      const rootTag = svg.match(/<svg[^>]*>/)?.[0];
      expect(rootTag).not.toMatch(/\s(?:width|height)=/);
      if (theme === 'dark') expect(style.mask).toContain('ambiq-logo-white');
    }
    const footer = page.locator('.brand-footer .ambiq-logo');
    await expect(footer).toHaveCSS(
      'color',
      theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(0, 71, 186)',
    );
  });
}
