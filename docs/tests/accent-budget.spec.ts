// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The parts the accent budget is spent through: the inked tile, the accented
 * unit glyph, the accented layer of a stack, and the accented bar. Each one is
 * asserted against the accent the page itself resolves rather than against a
 * color written here, because the token is a `color-mix()` that moves with the
 * theme and with the product scope; a literal would be a second copy of the
 * derivation. See AmbiqAI/helia-ui#99.
 */
import { expect, test } from '@playwright/test';

const base = '/helia-ui';

/*
 * Each test resolves the accent with a probe element in the scope it is
 * asserting, rather than reading the custom property back: the computed value
 * of an unregistered property is its substituted text -- the `color-mix()`
 * call -- and not a color.
 */

test('the inked tile draws its link in the accent', async ({ page }) => {
  await page.goto(`${base}/gallery/`);

  const card = page.locator('.helia-card--ink').first();
  await expect(card).toBeVisible();

  const measured = await card.evaluate((node) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--helia-product-accent)';
    node.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();

    const link = node.querySelector('.helia-card-header__link');
    const eyebrow = node.querySelector('.helia-eyebrow');
    return {
      accent,
      ground: getComputedStyle(node).backgroundColor,
      link: link ? getComputedStyle(link).color : null,
      eyebrow: eyebrow ? getComputedStyle(eyebrow).color : null,
    };
  });

  expect(measured.link).toBe(measured.accent);
  expect(measured.eyebrow).toBe(measured.accent);

  /* The ground is the inked one rather than a card that kept its paper. */
  const [r = 0, g = 0, b = 0] = /rgba?\(([^)]+)\)/
    .exec(measured.ground)![1]
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number);
  expect((r + g + b) / 3).toBeLessThan(64);
});

test("the accented figure's unit glyph is the accent", async ({ page }) => {
  await page.goto(`${base}/gallery/`);

  const unit = page.locator('.helia-big-number .unit--accent').first();
  await expect(unit).toBeVisible();

  const measured = await unit.evaluate((node) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--helia-product-accent)';
    node.parentElement!.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();

    const figure = node.closest('.helia-big-number')!;
    const value = figure.querySelector('.value')!;
    return {
      accent,
      unit: getComputedStyle(node).color,
      value: getComputedStyle(value).color,
    };
  });

  expect(measured.unit).toBe(measured.accent);
  /* Only the glyph: the figure it qualifies stays ink. */
  expect(measured.value).not.toBe(measured.accent);
});

test('the accented layer of a stack carries the accent rule', async ({
  page,
}) => {
  await page.goto(`${base}/gallery/`);

  const stack = page.locator('.helia-stack').first();
  await expect(stack).toBeVisible();

  const accented = stack.locator('.helia-stack__layer--accent');
  /* One layer, which is the whole of what the budget allows a diagram. */
  await expect(accented).toHaveCount(1);

  const measured = await accented.evaluate((node) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--helia-product-accent)';
    node.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();

    const style = getComputedStyle(node);
    const plain = node.parentElement!.querySelector(
      '.helia-stack__layer:not(.helia-stack__layer--accent)',
    )!;

    return {
      accent,
      rule: style.borderTopColor,
      width: style.borderTopWidth,
      plainRule: getComputedStyle(plain).borderTopColor,
    };
  });

  expect(measured.rule).toBe(measured.accent);
  expect(measured.plainRule).not.toBe(measured.accent);
  expect(Number.parseFloat(measured.width)).toBeGreaterThan(0);
});

test('bar fills are proportional to value over max', async ({ page }) => {
  await page.goto(`${base}/gallery/`);

  const bars = page.locator('.helia-bars').first();
  await expect(bars).toBeVisible();

  /* The gallery example: 12, 3.3 and 1 against a scale of 12. */
  const expected = [1, 3.3 / 12, 1 / 12];

  const measured = await bars.evaluate((node) =>
    [...node.querySelectorAll('.helia-bars__row')].map((row) => ({
      track: row.querySelector('.helia-bars__track')!.getBoundingClientRect()
        .width,
      fill: row.querySelector('.helia-bars__fill')!.getBoundingClientRect()
        .width,
    })),
  );

  expect(measured).toHaveLength(expected.length);
  measured.forEach((row, index) => {
    expect(row.track).toBeGreaterThan(0);
    expect(row.fill / row.track).toBeCloseTo(expected[index]!, 2);
  });
});

/* The accent on a bar is the same color the rest of the budget is spent in. */
test('the accented bar is drawn in the accent', async ({ page }) => {
  await page.goto(`${base}/gallery/`);

  const bars = page.locator('.helia-bars').first();
  await expect(bars).toBeVisible();

  const accented = bars.locator('.helia-bars__fill--accent');
  await expect(accented).toHaveCount(1);

  const measured = await accented.evaluate((node) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--helia-product-accent)';
    node.parentElement!.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return { accent, fill: getComputedStyle(node).backgroundColor };
  });

  expect(measured.fill).toBe(measured.accent);
});
