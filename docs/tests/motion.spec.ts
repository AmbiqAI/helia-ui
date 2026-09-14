// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

const base = '/helia-ui';

/* The gallery is the page that carries every named transition at once. */
const gallery = `${base}/gallery/`;

/* The four named transitions in docs/design-system.md "Motion". */
const transitions = [
  '.helia-motion-surface',
  '.helia-motion-lift',
  '.helia-motion-reveal',
  '.helia-motion-cue',
];

const durations = (page: import('@playwright/test').Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) =>
      getComputedStyle(el)
        .transitionDuration.split(',')
        .map((value) => value.trim()),
    );

/*
 * The reduced-motion contract is a single block in semantic.css: the dial goes
 * to 0 and every duration built on it collapses with it. That indirection is
 * what this asserts. A transition written with a literal still runs for a
 * visitor who asked for no movement, and nothing in the stylesheet says so.
 */
test('reduced motion collapses every named transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(gallery);

  for (const selector of transitions) {
    const values = await durations(page, selector);
    expect(values.length).toBeGreaterThan(0);
    expect(values, selector).toEqual(values.map(() => '0s'));
  }
});

/* Without the preference the same durations are non-zero, so the assertion
 * above is about the dial rather than about a page with no transitions. */
test('the lift runs at the base step without the preference', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(gallery);

  expect(await durations(page, '.helia-motion-lift')).toEqual(['0.2s', '0.2s']);
});
