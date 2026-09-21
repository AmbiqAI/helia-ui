// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const page_ = '/helia-ui/block-diagrams/';

test('a diagram is one figure holding nested lists', async ({ page }) => {
  await page.goto(page_);

  const diagram = page.locator('.helia-block-diagram').first();
  await expect(diagram).toBeVisible();
  expect(await diagram.evaluate((node) => node.tagName)).toBe('FIGURE');

  /* The caption is the figure's own, not a paragraph beside it: a diagram
     whose title is not its figcaption loses the name in the accessibility
     tree the moment the page around it is restyled. */
  await expect(diagram.locator('figcaption')).toHaveCount(1);

  const blocks = diagram.locator('.helia-block');
  expect(await blocks.count()).toBe(5);
  for (const block of await blocks.all()) {
    expect(await block.evaluate((node) => node.tagName)).toBe('LI');
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`nesting is nested lists and a stepped ground in ${theme}`, async ({
    page,
  }) => {
    await page.goto(page_);
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);

    const ladder = page.locator('[data-example="ladder"]');
    await expect(
      ladder.locator('.helia-block .helia-block .helia-block').first(),
    ).toBeVisible();

    /* Three levels, three grounds, on a plain untoned unfilled diagram. Two
       levels resolving to the same paint is the nesting going invisible,
       which is the one thing this part is for. */
    const grounds = await ladder.evaluate((root) => {
      const levels = ['.helia-block', '.helia-block .helia-block'];
      const third = '.helia-block .helia-block .helia-block';
      return [...levels, third].map((selector) => {
        const node = root.querySelector(selector);
        return node ? getComputedStyle(node).backgroundColor : '';
      });
    });
    expect(new Set(grounds).size).toBe(grounds.length);
  });

  test(`a tone stops at its own block in ${theme}`, async ({ page }) => {
    await page.goto(page_);
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);

    /* A tone or emphasis is the block's own. Its children start the ladder
       again: same paint on parent and child is the tone leaking. */
    for (const variant of ['accent', 'muted', 'filled']) {
      const parent = page
        .locator(`.helia-block--${variant}`)
        .filter({
          has: page.locator('.helia-block'),
        })
        .first();
      await expect(parent).toBeVisible();
      const [outer, inner] = await parent.evaluate((node) => {
        const child = node.querySelector('.helia-block') as Element;
        const read = (el: Element) => {
          const style = getComputedStyle(el);
          return `${style.backgroundColor} ${style.borderTopColor}`;
        };
        return [read(node), read(child)];
      });
      expect(inner, variant).not.toBe(outer);
      expect(
        inner.endsWith('rgba(0, 0, 0, 0)'),
        `${variant} child has no edge`,
      ).toBe(false);
    }
  });
}

test('a block links from its label and stays a list item', async ({ page }) => {
  await page.goto(page_);

  const link = page.locator('a.helia-block__face').first();
  await expect(link).toBeVisible();

  const owner = link.locator('xpath=..');
  expect(await owner.evaluate((node) => node.tagName)).toBe('LI');
  await expect(owner.locator('> a')).toHaveCount(1);
});

test('the page ships no script of its own', async ({ page }) => {
  await page.goto(page_);

  const inline = await page.locator('.helia-block-diagram script').count();
  expect(inline).toBe(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`the diagrams carry no accessibility violations in ${theme}`, async ({
    page,
  }) => {
    await page.goto(page_);
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);

    const results = await new AxeBuilder({ page })
      .include('.sl-markdown-content')
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
