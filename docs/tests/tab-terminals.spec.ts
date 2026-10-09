// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  for (const width of [390, 1280]) {
    test(`tab terminals stay compact at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/helia-ui/code/');
      await page.evaluate(
        (value) => (document.documentElement.dataset.theme = value),
        theme,
      );
      for (const label of ['Install', 'Source']) {
        await page.getByRole('tab', { name: label, exact: true }).click();
        const panel = page.getByRole('tabpanel', { name: label, exact: true });
        const frame = panel.locator('.frame.is-terminal');
        await expect(frame).toBeVisible();
        await expect(frame.locator('.header')).toBeHidden();
        await frame.hover();
        await expect(
          frame.getByRole('button', { name: 'Copy to clipboard' }),
        ).toBeVisible();
        expect(
          await frame
            .locator('pre')
            .evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
        ).not.toBe('0px');
      }
      await page
        .getByRole('tab', { name: 'Configuration', exact: true })
        .click();
      await expect(
        page
          .getByRole('tabpanel', { name: 'Configuration', exact: true })
          .locator('.header'),
      ).toBeVisible();
    });
  }
}
