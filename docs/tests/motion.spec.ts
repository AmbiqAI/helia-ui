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

/*
 * The reveal distance is the one travel the dial multiplies, so the preference
 * has two ways to stop it. This asserts the token itself rather than a
 * transform, because a reveal under the preference never arms and so never
 * carries one.
 */
test('reduced motion zeroes the reveal distance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(gallery);

  const distance = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--helia-motion-reveal-distance')
      .trim(),
  );

  expect(distance).toBe('0px');
});

/*
 * The defect this covers: the rise was 8px over the slow step, which the owner
 * could not see happen. The measurement is on a probe rather than on a reveal
 * in the page, because whether a given section has already arrived depends on
 * where the page happened to lay out when the script ran. The live element
 * still has to be armed by the script, which is the second assertion.
 */
test('an armed reveal starts 20px down', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(gallery);

  await expect(page.locator('helia-reveal').first()).toHaveClass(
    /helia-motion-reveal--armed/,
  );

  const transform = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'helia-motion-reveal helia-motion-reveal--armed';
    document.body.append(probe);
    const value = getComputedStyle(probe).transform;
    probe.remove();
    return value;
  });

  expect(transform).toBe('matrix(1, 0, 0, 1, 0, 20)');
});

/* `stagger` is one wrapper telling one arrival across a grid: each child waits
 * its index times the fast step, and the climb stops at the sixth. */
test('stagger delays each child by one fast step', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(gallery);

  const delays = await page
    .locator('helia-reveal.helia-motion-reveal--stagger')
    .first()
    .evaluate((el) =>
      Array.from(el.children).map(
        (child) => getComputedStyle(child).transitionDelay,
      ),
    );

  expect(delays).toEqual(['0s', '0.12s', '0.24s', '0.36s']);
});

/*
 * Replay is how the entry can be judged without scrolling away and back. The
 * mutation log rather than a poll on the class: the hidden state lasts as long
 * as it takes the section to be looked at again, which on a click that scrolls
 * the button into view can be no time at all.
 */
test('replay re-arms a reveal that has already arrived', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(gallery);

  const stagger = page.locator('helia-reveal.helia-motion-reveal--stagger');
  await stagger.scrollIntoViewIfNeeded();
  await expect(stagger).toHaveClass(/helia-motion-reveal--in/);

  await page.evaluate(() => {
    const el = document.querySelector(
      'helia-reveal.helia-motion-reveal--stagger',
    );
    if (!el) throw new Error('no staggered reveal on the gallery');
    const log: boolean[] = [];
    (window as unknown as { revealLog: boolean[] }).revealLog = log;
    new MutationObserver(() => {
      log.push(el.classList.contains('helia-motion-reveal--in'));
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
  });

  await page.getByRole('button', { name: 'Replay' }).click();

  /* The content went back to hidden, */
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { revealLog: boolean[] }).revealLog,
      ),
    )
    .toContain(false);

  /* and arrives again on the next look. */
  await stagger.scrollIntoViewIfNeeded();
  await expect(stagger).toHaveClass(/helia-motion-reveal--in/);
});
