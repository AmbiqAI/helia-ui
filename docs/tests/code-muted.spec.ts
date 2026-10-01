// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`muted code uses the theme surface and preserves copy controls in ${theme}`, async ({
    page,
  }) => {
    await page.goto('/helia-ui/code/');
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const blocks = page.locator('.helia-code-tone-muted');
    await expect(blocks).toHaveCount(3);
    for (const block of await blocks.all()) {
      const colors = await block.evaluate((node) => {
        const probe = document.createElement('span');
        probe.style.backgroundColor = 'var(--helia-surface-card-muted)';
        node.append(probe);
        const expected = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          expected,
          actual: getComputedStyle(node.querySelector('pre')!).backgroundColor,
        };
      });
      expect(colors.actual).toBe(colors.expected);
      await expect(block.locator('button')).toBeVisible();
    }
    await expect(blocks.first()).toContainText('import numpy as np');
    await blocks.first().locator('button').click();
  });
}
