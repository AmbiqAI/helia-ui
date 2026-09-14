// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

const gallery = '/helia-ui/gallery/';

/* What the page ends with. The gallery is where an owner goes to choose, so an
 * example that quietly stops rendering is the page failing at its one job. */
const EXAMPLES = 70;

/*
 * The root element each part renders. An example's source is a prop rather than
 * something read back off the slot, so this comparison is what stops the two
 * from drifting: every part the source names has to be on the stage beside it.
 * A part missing from the table fails the last assertion rather than passing
 * unchecked.
 */
const PART_ROOTS: Record<string, string> = {
  AccordionGroup: '.accordion-group',
  AsciiTerminal: 'helia-ascii-terminal',
  Badge: '.helia-badge',
  Band: '.helia-band',
  Button: '.helia-button',
  Callout: '.helia-callout',
  Card: '.helia-card',
  CardActions: '.helia-card-actions',
  CardContent: '.helia-card-content',
  CardGrid: '.helia-card-grid',
  CardHeader: '.helia-card-header',
  CardList: '.helia-card-list',
  CardMedia: '.helia-card-media',
  CardQuote: '.helia-card-quote',
  Chip: '.helia-chip',
  CodeTabs: 'helia-code-tabs',
  DataTable: 'helia-data-table',
  EditorialBand: '.editorial-band',
  Eyebrow: '.helia-eyebrow',
  Icon: '.helia-icon',
  LinkCard: '.helia-link-card',
  Masonry: '.helia-masonry',
  Media: '.helia-media',
  MediaEmbed: '.media-embed',
  Mosaic: '.helia-mosaic',
  Reveal: 'helia-reveal',
  SectionHeader: '.section-header',
  ShowcaseCarousel: 'showcase-carousel',
  StatCard: '.helia-stat-card',
  Timeline: '.timeline',
};

test('every example on the gallery carries its source', async ({ page }) => {
  await page.goto(gallery);

  const stages = page.locator('[data-example-stage]');
  expect(await stages.count()).toBeGreaterThanOrEqual(EXAMPLES);

  /* One disclosure per stage: an example with no source is half an example. */
  const sources = page.locator('details.example__source');
  expect(await sources.count()).toBe(await stages.count());
});

test('opening an example reveals the code block', async ({ page }) => {
  await page.goto(gallery);

  const source = page.locator('details.example__source').first();
  const code = source.locator('pre');

  /* Collapsed is the resting state: the preview is the page, the source is the
     answer to a question about it. */
  await expect(code).toBeHidden();
  await source.getByText('Show code').click();
  await expect(code).toBeVisible();
  await expect(code).not.toBeEmpty();
});

test('an example renders the parts its source names', async ({ page }) => {
  await page.goto(gallery);

  const stages = await page.locator('[data-example-stage]').all();
  expect(stages.length).toBeGreaterThan(0);

  const missing: string[] = [];
  const untabled: string[] = [];

  for (const stage of stages) {
    const attribute = (await stage.getAttribute('data-example-tags')) ?? '';
    const tags = attribute.split(' ').filter(Boolean);
    expect(tags.length).toBeGreaterThan(0);

    for (const tag of tags) {
      const selector = PART_ROOTS[tag];
      if (!selector) {
        untabled.push(tag);
        continue;
      }
      if ((await stage.locator(selector).count()) === 0) {
        missing.push(`${tag} (${selector})`);
      }
    }
  }

  expect(untabled, 'a part with no root in PART_ROOTS').toEqual([]);
  expect(missing, 'named in an example source but not on its stage').toEqual(
    [],
  );
});
