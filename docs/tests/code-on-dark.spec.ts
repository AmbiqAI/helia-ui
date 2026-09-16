// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Code on the surfaces the package pins dark. Expressive Code declares its
 * colors on `:root`, so a block slotted into an inked band inherited the page
 * theme's light frame while the ink around it was already inverted; see
 * AmbiqAI/helia-ui#91. The assertion is made in light mode, which is the only
 * mode where the two can disagree.
 */
import { expect, test } from '@playwright/test';

const base = '/helia-ui';

/* Computed colors come back as `rgb()` unless a `color-mix()` survived to the
   used value, which Chromium reports in its own space. */
const channels = (color: string): [number, number, number] => {
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color);
  if (srgb)
    return [
      Number(srgb[1]) * 255,
      Number(srgb[2]) * 255,
      Number(srgb[3]) * 255,
    ];
  const rgb = /^rgba?\(([^)]+)\)/.exec(color);
  if (!rgb) throw new Error(`unreadable color: ${color}`);
  const [r = 0, g = 0, b = 0] = rgb[1]
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number);
  return [r, g, b];
};

/* WCAG relative luminance and the ratio built on it. */
const luminance = (color: string) =>
  channels(color)
    .map((value) => {
      const part = value / 255;
      return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (total, part, index) => total + [0.2126, 0.7152, 0.0722][index]! * part,
      0,
    );

const ratio = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort(
    (first, second) => second - first,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
};

test('a code block on an inked band stays dark on a light page', async ({
  page,
}) => {
  await page.goto(`${base}/gallery/`);
  /*
   * Set after load: Starlight resolves the stored preference in a blocking
   * head script and writes the attribute itself, so anything set earlier is
   * overwritten on navigation.
   */
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });

  const block = page.locator('.helia-band--contrast .expressive-code').first();
  await expect(block).toBeVisible();

  const measured = await block.evaluate((node) => {
    /* The first painted ancestor, which is what the frame is seen against. */
    const opaqueBehind = (start: Element | null) => {
      for (let el = start; el; el = el.parentElement) {
        const fill = getComputedStyle(el).backgroundColor;
        if (fill && fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent')
          return fill;
      }
      return getComputedStyle(document.documentElement).backgroundColor;
    };

    const pre = node.querySelector('pre');
    if (!pre) return null;
    const frame = getComputedStyle(pre);
    const tokens = [...pre.querySelectorAll('span[style^="--"]')].map(
      (span) => getComputedStyle(span).color,
    );

    return {
      ground: opaqueBehind(document.body),
      frame: frame.backgroundColor,
      inks: [frame.color, ...tokens],
    };
  });

  expect(measured).not.toBeNull();
  const { ground, frame, inks } = measured!;

  /* The page really is in light mode, so the next comparison means something. */
  expect(luminance(ground)).toBeGreaterThan(0.5);
  expect(luminance(frame)).toBeLessThan(luminance(ground));

  expect(inks.length).toBeGreaterThan(1);
  for (const ink of inks) expect(ratio(ink, frame)).toBeGreaterThanOrEqual(4.5);
});
