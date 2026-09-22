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

for (const theme of ['light', 'dark']) {
  test(`neutral hero keeps its primary action distinct in ${theme}`, async ({
    page,
  }) => {
    await page.goto('/helia-ui/landing/');
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const hero = page.locator('.helia-hero--neutral').first();
    await expect(hero.locator('em')).toHaveCSS('color', 'rgb(255, 255, 255)');
    const action = hero.getByRole('link', { name: 'Get started', exact: true });
    await expect(action).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(action).toHaveCSS('color', 'rgb(17, 19, 24)');
    await page.keyboard.press('Tab');
    await action.focus();
    expect(
      await action.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).not.toBe('none');
  });
}

for (const theme of ['light', 'dark']) {
  test(`workflow ink cards differ from the band in ${theme}`, async ({
    page,
  }) => {
    await page.goto('/helia-ui/landing/');
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const card = page.locator('.helia-band--contrast .helia-card--ink');
    const colors = await card.evaluate((node) => ({
      card: getComputedStyle(node).backgroundColor,
      band: getComputedStyle(node.closest('.helia-band')).backgroundColor,
      border: getComputedStyle(node).borderTopColor,
    }));
    expect(colors.card).not.toBe(colors.band);
    expect(colors.border).not.toBe('rgba(0, 0, 0, 0)');
  });
}

for (const theme of ['light', 'dark']) {
  test(`fixed dark terminal and summary link own readable ink in ${theme}`, async ({
    page,
  }) => {
    await page.goto('/helia-ui/landing/');
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const hero = page.locator('.helia-hero--neutral').last();
    await expect(hero.locator('.ascii-terminal__prompt')).toHaveCSS(
      'color',
      'rgb(245, 246, 247)',
    );
    const link = hero.getByRole('link', { name: 'setup guide' });
    const ink = await hero.evaluate((node) =>
      getComputedStyle(node).getPropertyValue('--helia-ink-primary').trim(),
    );
    expect(
      await link.evaluate((node) => getComputedStyle(node).color),
    ).not.toBe('rgb(0, 0, 238)');
    expect(ink).toBeTruthy();
    await page.keyboard.press('Tab');
    await link.focus();
    expect(
      await link.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).not.toBe('none');
  });
}

for (const theme of ['light', 'dark']) {
  test(`ink band markdown links and authored hero casing in ${theme}`, async ({
    page,
  }) => {
    await page.goto('/helia-ui/landing/');
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const link = page.getByRole('link', { name: 'Compare surface choices' });
    await expect(link).toHaveCSS('color', 'rgb(255, 255, 255)');
    await link.hover();
    await expect(link).toHaveCSS('color', 'rgb(255, 255, 255)');
    await page.keyboard.press('Tab');
    await link.focus();
    await expect(link).toHaveCSS('outline-color', 'rgb(255, 255, 255)');
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).toHaveCSS('outline-width', '2px');
    const eyebrow = page
      .locator('.helia-hero__eyebrow')
      .filter({ hasText: 'heliaAOT' });
    await expect(eyebrow).toHaveText('heliaAOT · Ahead-of-time inference');
    await expect(eyebrow).toHaveCSS('text-transform', 'none');
  });
}
