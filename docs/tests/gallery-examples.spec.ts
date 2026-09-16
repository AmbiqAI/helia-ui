// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const gallery = '/helia-ui/gallery/';

/*
 * What the page ends with, read off the source rather than written down. The
 * gallery is where an owner goes to choose, so an example that quietly stops
 * rendering is the page failing at its one job -- and a hand-kept number only
 * catches that until the next example is added, at which point it is a floor
 * nobody raises. `Example` renders exactly one stage, unconditionally, so the
 * count of opening tags is the count of stages the page owes.
 */
const source = readFileSync(
  fileURLToPath(new URL('../src/content/docs/gallery.mdx', import.meta.url)),
  'utf8',
);
const EXAMPLES = source.match(/<Example[\s>]/g)?.length ?? 0;

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
  Bars: '.helia-bars',
  Band: '.helia-band',
  BigNumber: '.helia-big-number',
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
  Chart: '.helia-chart',
  ChartGroup: '.helia-chart-group',
  Chip: '.helia-chip',
  /* Expressive Code owns the frame, so the part's root is the wrapper it emits
     rather than a class of the package's own. */
  CodeBlock: '.expressive-code',
  CodeTabs: 'helia-code-tabs',
  DataTable: 'helia-data-table',
  EditorialBand: '.editorial-band',
  Eyebrow: '.helia-eyebrow',
  Hero: '.helia-hero',
  Icon: '.helia-icon',
  IconRow: '.helia-icon-row',
  IconTile: '.helia-icon-tile',
  LinkCard: '.helia-link-card',
  Masonry: '.helia-masonry',
  Media: '.helia-media',
  MediaEmbed: '.media-embed',
  Mosaic: '.helia-mosaic',
  RefMembers: '.helia-ref-members',
  RefNav: '.helia-ref-nav',
  RefParams: '.helia-ref-params',
  RefSection: '.helia-ref-section',
  RefSymbol: '.helia-ref-symbol',
  Reveal: 'helia-reveal',
  SectionHeader: '.section-header',
  ShowcaseCarousel: 'showcase-carousel',
  Sparkline: '.helia-sparkline',
  SplitPanel: '.helia-split-panel',
  Stack: '.helia-stack',
  StatCard: '.helia-stat-card',
  Timeline: '.timeline',
};

test('every example on the gallery carries its source', async ({ page }) => {
  await page.goto(gallery);

  expect(EXAMPLES, 'gallery.mdx names examples').toBeGreaterThan(0);

  const stages = page.locator('[data-example-stage]');
  expect(await stages.count()).toBe(EXAMPLES);

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

test('the rows and panels section renders all three parts', async ({
  page,
}) => {
  await page.goto(gallery);

  await expect(page.locator('.helia-icon-tile').first()).toBeVisible();
  await expect(page.locator('a.helia-icon-row').first()).toBeVisible();
  await expect(page.locator('.helia-split-panel')).toHaveCount(1);

  /* The panel exists for the code slot; an empty one is the example not doing
     the job the section claims for it. */
  await expect(
    page.locator('.helia-split-panel__code helia-code-tabs'),
  ).toHaveCount(1);
});

test('an icon and its word are centered on each other', async ({ page }) => {
  await page.goto(gallery);

  const pair = page.locator('.helia-icon--pair').first();
  await expect(pair).toBeVisible();

  const glyph = await pair.locator('.helia-icon__glyph svg').boundingBox();
  const word = await pair.locator('.helia-icon__text').boundingBox();
  expect(glyph, 'the pair draws a glyph').not.toBeNull();
  expect(word, 'the pair draws its word').not.toBeNull();

  /* The line box of the word against the box of the glyph: an icon that reads
     as riding high beside its label is this number growing. */
  const center = (box: { y: number; height: number }) => box.y + box.height / 2;
  expect(Math.abs(center(glyph!) - center(word!))).toBeLessThanOrEqual(1);
});

test('an icon row is one anchor around its tile and its title', async ({
  page,
}) => {
  await page.goto(gallery);

  const rows = page.locator('a.helia-icon-row');
  expect(await rows.count()).toBeGreaterThan(0);

  const row = rows.first();
  await expect(row.locator('.helia-icon-tile')).toHaveCount(1);
  await expect(row.locator('.helia-icon-row__title')).toHaveCount(1);

  /* An anchor inside the anchor is invalid markup and the production assert
     fails the build on it, so the row is the only link in the row. */
  await expect(row.locator('a')).toHaveCount(0);
});

/*
 * The LinkCard row is the fixture for a part that is handed a region and a part
 * that is not: a caller wrapping a slot in a condition still registers the slot
 * name at compile time, which once left every card without an icon drawing an
 * empty tonal disc and every card without meta an empty line under the title.
 * See AmbiqAI/helia-ui#101.
 */
test('a link card draws a mark and a meta line only when given them', async ({
  page,
}) => {
  await page.goto(gallery);

  const stage = (title: string) =>
    page
      .locator('.example')
      .filter({ has: page.locator('.example__title', { hasText: title }) })
      .locator('[data-example-stage] .helia-link-card');

  const plain = stage('<LinkCard href title>');
  await expect(plain).toHaveCount(1);
  await expect(plain.locator('.helia-card-mark')).toHaveCount(0);
  await expect(plain.locator('.helia-card-header__meta')).toHaveCount(0);

  const both = stage('<Icon slot="icon"> and meta');
  await expect(both).toHaveCount(1);
  await expect(both.locator('.helia-card-mark--icon svg')).toHaveCount(1);
  await expect(both.locator('.helia-card-header__meta')).toHaveText(
    'Astro parts · React parts',
  );
});

/*
 * The Reference section is the claim that one model renders the same reference
 * for every language. Three symbols, three languages, one table: if the C entry
 * loses a column the section has stopped making its point.
 */
test('the reference section renders all three languages from one model', async ({
  page,
}) => {
  await page.goto(`${gallery}#reference`);

  const symbols = page.locator('.helia-ref-symbol');
  await expect(symbols).toHaveCount(3);

  for (const language of ['Python', 'C', 'TypeScript']) {
    await expect(
      page
        .locator('.helia-ref-symbol__language', { hasText: language })
        .first(),
    ).toBeVisible();
  }

  /* The anchor is the symbol's own dotted path, which is what makes a link to
     one symbol survive a regeneration. Attribute form, because a dotted id is
     not a valid CSS id selector. */
  for (const id of ['helia.profiler.profile_model', 'profileModel']) {
    await expect(page.locator(`.helia-ref-symbol[id="${id}"]`)).toHaveCount(1);
  }
});

test('a reference params table carries the four columns', async ({ page }) => {
  await page.goto(`${gallery}#reference`);

  const tables = page.locator('.helia-ref-params table');
  await expect(tables).toHaveCount(3);

  for (let index = 0; index < 3; index += 1) {
    const headers = tables.nth(index).locator('thead th');
    await expect(headers).toHaveText([
      'Name',
      'Type',
      'Default',
      'Description',
    ]);
  }
});
