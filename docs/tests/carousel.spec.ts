// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

const gallery = '/helia-ui/gallery/';
const compact = 'showcase-carousel[data-variant="compact"]';

/*
 * Once it overflows, the rail must never rest on a scroll boundary: Safari
 * turns a horizontal gesture that starts on one into history navigation. The
 * give at either end keeps the rests inside the range, and the snap positions
 * bring the rail back to them.
 */
test('an overflowing rail rests inside its give, never on a boundary', async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto(gallery);

  const carousel = page.locator(compact).first();
  const track = carousel.locator('.track');
  await carousel.scrollIntoViewIfNeeded();
  await expect(track).toHaveAttribute('data-give', '');

  const scrollLeft = () => track.evaluate((node) => node.scrollLeft);
  const rest = await scrollLeft();
  expect(rest).toBeGreaterThan(0);
  await expect(
    carousel.getByRole('button', { name: /Previous/ }),
  ).toBeDisabled();

  /* A gesture into the leading give comes back to the first card. */
  await track.evaluate((node) =>
    node.scrollTo({ left: 0, behavior: 'smooth' }),
  );
  await expect.poll(scrollLeft).toBe(rest);

  /* The far rest is the last card flush right, with give still beyond it. */
  await track.evaluate((node) =>
    node.scrollTo({ left: node.scrollWidth, behavior: 'smooth' }),
  );
  await expect(carousel.getByRole('button', { name: /Next/ })).toBeDisabled();
  await expect
    .poll(async () => {
      const before = await scrollLeft();
      await page.waitForTimeout(200);
      return (await scrollLeft()) === before;
    })
    .toBe(true);
  const [end, max] = await track.evaluate((node) => [
    node.scrollLeft,
    node.scrollWidth - node.clientWidth,
  ]);
  expect(end).toBeGreaterThan(rest);
  expect(end).toBeLessThan(max);
});
