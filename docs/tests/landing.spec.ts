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
    const card = page.locator('.helia-card--ink').first();
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

for (const theme of ['light', 'dark'] as const) {
  test(`window transcripts retain copy and decorative framing in ${theme}`, async ({
    page,
  }) => {
    await page.goto('/helia-ui/landing/');
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const terminal = page.locator('.frame-window').first();
    await expect(terminal.locator('.ascii-terminal__lights')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await terminal
      .getByRole('button', { name: 'Copy commands', exact: true })
      .focus();
    const state = await terminal
      .getByRole('button', { name: 'Copy commands', exact: true })
      .evaluate((node) => ({
        outline: getComputedStyle(node).outlineStyle,
        color: getComputedStyle(node).color,
      }));
    expect(state.outline).not.toBe('none');
    expect(state.color).not.toBe('rgba(0, 0, 0, 0)');
    await terminal
      .getByRole('button', { name: 'Copy commands', exact: true })
      .click();
    await expect(terminal.locator('[data-status]')).toContainText(
      'Commands copied',
    );
  });
}

for (const theme of ['light', 'dark']) {
  test(`contrast band owns nested card and button colors in ${theme}`, async ({
    page,
  }) => {
    await page.goto('/helia-ui/landing/');
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const band = page.locator('.helia-band--contrast');
    const primary = band.getByRole('link', {
      name: 'Primary action',
      exact: true,
    });
    await expect(primary).toHaveCSS('color', 'rgb(17, 19, 24)');
    await expect(primary).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await primary.focus();
    expect(
      await primary.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).not.toBe('none');
    await expect(band.getByText('A nested card remains readable.')).toHaveCSS(
      'color',
      'color(srgb 1 1 1 / 0.82)',
    );
  });
}
