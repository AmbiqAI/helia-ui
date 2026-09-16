// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

const gallery = '/helia-ui/gallery/';

const contrast = '.helia-hero--contrast';
const plain = '.helia-hero:not(.helia-hero--contrast)';

/**
 * The accent as the browser resolves it here, read by painting a probe inside
 * the hero rather than by reading the custom property back. A `color-mix()`
 * serializes one way as a property value and another as a computed color, so
 * comparing the two strings would compare two spellings of the same color.
 */
async function accentOf(
  scope: import('@playwright/test').Locator,
): Promise<string> {
  return scope.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--helia-product-accent)';
    element.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

test('both hero variants render on the gallery', async ({ page }) => {
  await page.goto(gallery);

  await expect(page.locator(contrast)).toHaveCount(1);
  await expect(page.locator(plain)).toHaveCount(1);

  /* The side column is what the two variants differ in: it renders only when
     something was slotted into it, so the plain example must have none. */
  await expect(page.locator(`${contrast} .helia-hero__side`)).toHaveCount(1);
  await expect(page.locator(`${plain} .helia-hero__side`)).toHaveCount(0);

  await expect(page.locator(`${contrast} .helia-hero__aside`)).toBeVisible();
  await expect(page.locator(`${contrast} .helia-hero__media`)).toBeVisible();
});

test('the emphasized word is drawn in the product accent', async ({ page }) => {
  await page.goto(gallery);

  for (const selector of [contrast, plain]) {
    const hero = page.locator(selector);
    const word = hero.locator('.helia-hero__headline em');
    await expect(word).toBeVisible();

    const accent = await accentOf(hero);
    await expect(word).toHaveCSS('color', accent);

    /* An accent that has collapsed onto the headline's own ink is the token
       not resolving, which the equality above would still pass. */
    const headline = await hero
      .locator('.helia-hero__headline')
      .evaluate((element) => getComputedStyle(element).color);
    expect(accent).not.toBe(headline);
  }
});

test('the side column stacks under the lede on a narrow viewport', async ({
  page,
}) => {
  await page.goto(gallery);

  const lede = page.locator(`${contrast} .helia-hero__lede`);
  const side = page.locator(`${contrast} .helia-hero__side`);

  await page.setViewportSize({ width: 1280, height: 900 });
  const wideLede = await lede.boundingBox();
  const wideSide = await side.boundingBox();
  expect(wideLede, 'the lede is laid out').not.toBeNull();
  expect(wideSide, 'the side column is laid out').not.toBeNull();
  expect(wideSide!.x).toBeGreaterThan(wideLede!.x + wideLede!.width - 1);

  await page.setViewportSize({ width: 700, height: 900 });
  const narrowLede = await lede.boundingBox();
  const narrowSide = await side.boundingBox();
  expect(narrowSide!.y).toBeGreaterThanOrEqual(
    narrowLede!.y + narrowLede!.height - 1,
  );
  expect(Math.abs(narrowSide!.x - narrowLede!.x)).toBeLessThanOrEqual(1);
});
