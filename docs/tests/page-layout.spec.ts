// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test, type Page } from '@playwright/test';

const gallery = '/helia-ui/gallery/';
const layout = '/helia-ui/layout/';

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

test('every masonry column starts at the same top', async ({ page }) => {
  await page.goto(gallery);

  const masonry = page.locator('[data-example-stage] .helia-masonry').first();
  const frame = (await masonry.boundingBox())!;
  const items = await masonry.locator('> *').all();
  const boxes = await Promise.all(
    items.map(async (item) => (await item.boundingBox())!),
  );
  const gap = await masonry.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).columnGap),
  );

  /* Which column an item landed in is the browser's decision and nothing in
     the markup records it, so the x position is the only handle on it. */
  const columns = new Map<number, { y: number; bottom: number }[]>();
  for (const box of boxes) {
    const x = Math.round(box.x);
    const column = columns.get(x) ?? [];
    column.push({ y: box.y, bottom: box.y + box.height });
    columns.set(x, column);
  }
  expect(columns.size).toBe(3);

  for (const [x, column] of columns) {
    const top = Math.min(...column.map((item) => item.y));
    expect(Math.abs(top - frame.y), `column at ${x}`).toBeLessThanOrEqual(1);
  }

  /* The set ends on the tallest column, and the item that ends it carries no
     trailing gap out of the container. */
  const lowest = Math.max(...boxes.map((box) => box.y + box.height));
  const trailing = frame.y + frame.height - lowest;
  expect(trailing).toBeGreaterThanOrEqual(-1);
  expect(trailing).toBeLessThanOrEqual(gap);
});

test('the masonry item keeps no margin from the page rhythm', async ({
  page,
}) => {
  await page.goto(gallery);

  /* Starlight puts the page rhythm on `* + *` and exempts the first child of
     the DOM, which is the first item of the first column and of no other. The
     examples opt out with `not-content`; dropping it puts the recipe in front
     of the rule a page that forgets the class would hand it. */
  const margins = await page
    .locator('.helia-masonry')
    .last()
    .evaluate((element) => {
      element.classList.remove('not-content');
      return [...element.children].map(
        (child) => getComputedStyle(child).marginBlockStart,
      );
    });

  expect(margins.length).toBeGreaterThan(2);
  expect(margins.filter((margin) => margin !== '0px')).toEqual([]);
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

/* The paint, not the box: the ground a band carries past its own edge is a
   shadow spread, which cannot be measured off the element. One pixel of the
   band's own top padding is ground and nothing else, so every other pixel on
   that line answers whether the ground reached it. */
async function groundLine(page: Page, band: string) {
  const element = page.locator(band).last();
  await element.scrollIntoViewIfNeeded();
  const box = (await element.boundingBox())!;
  const y = Math.round(box.y + 4);
  const pixel = (x: number) =>
    page.screenshot({ clip: { x: Math.round(x), y, width: 1, height: 1 } });
  const ground = await pixel(box.x + box.width / 2);
  const isGround = async (x: number) => (await pixel(x)).equals(ground);
  return { box, isGround };
}

for (const width of [1280, 1440]) {
  test.describe(`at ${width}`, () => {
    test.use({ viewport: { width, height: 960 } });

    test('the band ground fills the frame and stops at the contents', async ({
      page,
    }) => {
      await page.goto(gallery);

      /* The last one is the composition, which is on the page rather than on
         an example stage: a band inside a stage is clipped by the frame the
         example promises, so it is the wrong one to ask about the bleed. */
      const { box, isGround } = await groundLine(page, '.helia-band--muted');
      const frame = (await page.locator('.main-pane').boundingBox())!;
      const toc = (await page
        .locator('.right-sidebar-panel nav')
        .boundingBox())!;
      const viewport = page.viewportSize()!;

      expect(box.x + box.width).toBeLessThan(viewport.width - 2);
      /* The contents column is beside the reading frame, not inside it. */
      expect(box.x + box.width).toBeLessThanOrEqual(toc.x);

      expect(await isGround(frame.x + 1), 'start of the frame').toBe(true);
      expect(
        await isGround(frame.x + frame.width - 2),
        'end of the frame',
      ).toBe(true);
      expect(await isGround(frame.x + frame.width + 2), 'past the frame').toBe(
        false,
      );
      expect(await isGround(toc.x + 2), 'under the contents').toBe(false);
      expect(await isGround(viewport.width - 2), 'at the viewport edge').toBe(
        false,
      );
    });

    test('the editorial band stops at the contents too', async ({ page }) => {
      await page.goto(layout);

      const { box } = await groundLine(page, '.editorial-band--paper');
      const frame = (await page.locator('.main-pane').boundingBox())!;
      const toc = (await page
        .locator('.right-sidebar-panel nav')
        .boundingBox())!;

      expect(box.x).toBe(frame.x);
      expect(box.x + box.width).toBeLessThanOrEqual(toc.x);
    });
  });
}

test.describe('with no contents column', () => {
  /* Under 72rem Starlight reserves nothing beside the reading frame, so the
     frame is the viewport and the ground has to reach its edge. */
  test.use({ viewport: { width: 1100, height: 960 } });

  test('the band ground runs to the viewport edge', async ({ page }) => {
    await page.goto(gallery);

    const { box, isGround } = await groundLine(page, '.helia-band--muted');
    const frame = (await page.locator('.main-pane').boundingBox())!;
    const viewport = page.viewportSize()!;

    expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(await isGround(frame.x + 1), 'start of the frame').toBe(true);
    expect(await isGround(viewport.width - 2), 'at the viewport edge').toBe(
      true,
    );
  });
});

test.describe('at a narrow viewport', () => {
  /* The width the band was found touching the viewport edge at, in
     AmbiqAI/helia-ui#86. The band has bled past the frame and the frame is the
     viewport, so the inner is the only thing left holding the margin. */
  test.use({ viewport: { width: 720, height: 960 } });

  test('band content keeps the reading margin at the viewport edge', async ({
    page,
  }) => {
    await page.goto(gallery);

    const inners = await page.locator('.helia-band__inner').all();
    expect(inners.length).toBeGreaterThan(0);

    for (const [index, inner] of inners.entries()) {
      await inner.scrollIntoViewIfNeeded();
      const first = (await inner.locator('> *').first().boundingBox())!;
      expect(first.x, `band inner ${index}`).toBeGreaterThanOrEqual(16);
    }
  });
});
