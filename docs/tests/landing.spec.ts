// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`ink card controls retain contrast on ${theme} pages`, async ({
    page,
  }) => {
    await page.goto('/helia-ui/landing/');
    await page.evaluate(
      (value) => (document.documentElement.dataset.theme = value),
      theme,
    );
    const card = page.locator('.helia-card--ink');
    const primary = card.getByRole('link', {
      name: 'Primary action',
      exact: true,
    });
    await expect(primary).toBeVisible();
    const colors = await primary.evaluate((element) => {
      const style = getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor };
    });
    expect(colors.foreground).toBe('rgb(17, 19, 24)');
    expect(colors.background).toBe('rgb(255, 255, 255)');
    await primary.focus();
    expect(
      await primary.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      ),
    ).not.toBe('none');
    const proseLink = card.getByRole('link', { name: 'a prose link' });
    await expect(proseLink).toHaveCSS('color', 'rgb(255, 255, 255)');
  });
}
