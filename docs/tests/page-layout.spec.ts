// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

const gallery = '/helia-ui/gallery/';

/* The wide layout the two arrangements below are written for. */
test.use({ viewport: { width: 1280, height: 960 } });

test('the page layout section shows each part working', async ({ page }) => {
  await page.goto(gallery);

  await expect(
    page.getByRole('heading', { name: 'Page layout' }),
  ).toBeVisible();

  for (const selector of [
    '.helia-band',
    '.helia-card-grid',
    '.helia-masonry',
    '.helia-mosaic',
  ]) {
    const staged = page.locator(`[data-example-stage] ${selector}`);
    expect(await staged.count(), selector).toBeGreaterThan(0);
  }
});

test('the mosaic feature takes two columns and two rows', async ({ page }) => {
  await page.goto(gallery);

  const mosaic = page.locator('[data-example-stage] .helia-mosaic').first();
  const feature = (await mosaic.locator('> *').first().boundingBox())!;
  const support = (await mosaic.locator('> *').nth(1).boundingBox())!;

  /* Two of the three columns plus the gap between them, against one column.
     The ratio falls short of two on both axes, so the margin is what separates
     a feature from a supporting card that merely ran long. */
  expect(feature.width).toBeGreaterThan(support.width * 1.8);
  expect(feature.height).toBeGreaterThan(support.height * 1.8);
});

test('the band ground runs past the content column to the frame', async ({
  page,
}) => {
  await page.goto(gallery);

  /* The last one is the composition, which is on the page rather than on an
     example stage: a band inside a stage is clipped by the frame the example
     promises, so it is the wrong one to ask about the bleed. */
  const band = page.locator('.helia-band--muted').last();
  await band.scrollIntoViewIfNeeded();
  const box = (await band.boundingBox())!;
  const frame = (await page.locator('.main-pane').boundingBox())!;
  const viewport = page.viewportSize()!;

  /* Sampled in the band's own top padding, which is ground and nothing else. */
  const y = Math.round(box.y + 4);
  const pixel = (x: number) =>
    page.screenshot({ clip: { x, y, width: 1, height: 1 } });

  const [ground, start, end] = await Promise.all([
    pixel(Math.round(box.x + box.width / 2)),
    pixel(Math.round(frame.x + 1)),
    pixel(viewport.width - 2),
  ]);

  /* The paint, not the box: the band's element stops at the content column and
     what carries the ground through the column Starlight reserves beside it is
     a spread that cannot be measured off the element. */
  expect(box.x + box.width).toBeLessThan(viewport.width - 2);
  expect(start.equals(ground), 'no ground at the start of the frame').toBe(
    true,
  );
  expect(end.equals(ground), 'no ground at the viewport edge').toBe(true);
});
