// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const base = '/helia-ui';

/* Every sidebar destination, with the heading that proves the right page
 * answered rather than a redirect or a 404 body served with a 200. */
const routes = [
  { path: `${base}/`, heading: 'helia-ui' },
  { path: `${base}/foundations/`, heading: 'Foundations' },
  { path: `${base}/foundations/site-theme/`, heading: 'Site theme' },
  {
    path: `${base}/foundations/typeface-candidates/`,
    heading: 'Typeface candidates',
  },
  { path: `${base}/gallery/`, heading: 'Gallery' },
  { path: `${base}/starlight-plugin/`, heading: 'Starlight plugin' },
  {
    path: `${base}/migrating-from-mkdocs/`,
    heading: 'Migrating from MkDocs',
  },
  {
    path: `${base}/python-api-reference/`,
    heading: 'Python API reference',
  },
  { path: `${base}/primitives/`, heading: 'Primitives' },
  { path: `${base}/cards/`, heading: 'Cards' },
  { path: `${base}/media/`, heading: 'Media' },
  { path: `${base}/code/`, heading: 'Code' },
  { path: `${base}/callouts/`, heading: 'Callouts' },
  { path: `${base}/disclosure/`, heading: 'Disclosure' },
  { path: `${base}/timeline/`, heading: 'Timeline' },
  { path: `${base}/diagrams/`, heading: 'Diagrams' },
  { path: `${base}/layout/`, heading: 'Layout' },
  {
    path: `${base}/reference/astro-parts/`,
    heading: 'Astro part contracts',
  },
  { path: `${base}/templates/docs-sites/`, heading: 'Docs sites' },
  { path: `${base}/templates/web-apps/`, heading: 'Web apps' },
  { path: `${base}/react/inputs/`, heading: 'Inputs' },
  { path: `${base}/react/form-depth/`, heading: 'Form depth' },
  { path: `${base}/react/overlays/`, heading: 'Overlays' },
  { path: `${base}/react/feedback/`, heading: 'Feedback' },
  { path: `${base}/react/data-display/`, heading: 'Data display' },
  { path: `${base}/react/navigation/`, heading: 'Navigation' },
  { path: `${base}/react/versioning/`, heading: 'Versioning' },
  { path: `${base}/react/cohesion/`, heading: 'Cohesion' },
];

for (const route of routes) {
  test(`${route.path} resolves`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: route.heading }).first(),
    ).toBeVisible();
  });
}

/* The three pages that carry the site's own demonstration markup: the landing
 * with the tables and callouts, and the two that render the most package
 * parts. A violation on any of them is a violation in a part, not in prose. */
const accessibilityRoutes = [
  `${base}/`,
  `${base}/primitives/`,
  `${base}/cards/`,
  /* Every card variant and every transition on one page. A contrast failure
     in an inverted or tinted variant shows up here before it reaches a site. */
  `${base}/gallery/`,
];

for (const path of accessibilityRoutes) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    /*
     * Scanned as a reduced-motion visitor. The motion scale is 0 for them, so
     * `Reveal` never arms and nothing is part way through a fade while axe
     * measures it — a contrast reading taken mid-transition is of a colour
     * that exists for 320ms and belongs to no state the page settles in. It
     * is also the configuration with the widest audience, so it is the one
     * worth asserting.
     */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    /*
     * The generative forms are hidden for the scan. They are absolutely
     * positioned well outside the media frame and clipped by its overflow;
     * axe resolves a background from bounding rects and does not apply the
     * clip, so a label in the card below the media is measured against an
     * accent no visitor ever sees behind it. Hiding the forms rather than
     * excluding the media or relaxing the rule keeps every check on every
     * other element, and the forms are aria-hidden decoration with no text.
     */
    await page.addStyleTag({
      content: '.helia-media__form { display: none; }',
    });
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}

// Starlight's markdown.css gives every non-first sibling inside
// .sl-markdown-content a margin-top of --sl-content-gap-y, exempting only
// descendants of a .not-content element. A grid or flex root that omits the
// class therefore has its own children spaced as if they were prose
// paragraphs, so the first item sits higher than the rest. The root carrying
// not-content is what makes the children exempt.
test('grid and flex children share their top margin', async ({ page }) => {
  const checked = [`${base}/foundations/`, `${base}/cards/`, `${base}/media/`];

  for (const route of checked) {
    await page.goto(route);

    const offenders = await page.evaluate(() => {
      const inline = 'a, strong, em, del, span, input, code, br';
      const proseSibling = `.sl-markdown-content :not(${inline}) + :not(${inline}, :where(.not-content *))`;
      const found: string[] = [];

      const describe = (el: Element) => {
        const cls = (el.getAttribute('class') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 3)
          .join('.');
        return cls
          ? `${el.tagName.toLowerCase()}.${cls}`
          : el.tagName.toLowerCase();
      };

      for (const el of document.querySelectorAll('*')) {
        const { display } = getComputedStyle(el);
        if (!['grid', 'flex', 'inline-grid', 'inline-flex'].includes(display))
          continue;

        const children = [...el.children].filter(
          (child) => getComputedStyle(child).display !== 'none',
        );
        if (children.length < 2) continue;

        const first = getComputedStyle(children[0]).marginTop;
        for (const child of children.slice(1)) {
          const marginTop = getComputedStyle(child).marginTop;
          if (marginTop === first || !child.matches(proseSibling)) continue;
          found.push(
            `${describe(el)} > ${describe(child)}: ${marginTop} vs first child ${first}`,
          );
        }
      }

      return found;
    });

    expect(
      offenders,
      `prose margin leaked into a grid or flex root on ${route}`,
    ).toEqual([]);
  }
});

/* The content-first row is the answer to a card family that cannot count on
 * artwork, so the count is the assertion: six options, none of them relying on
 * an image, and each one a card in its own right rather than a nested figure. */
test('the content-first row renders six cards', async ({ page }) => {
  await page.goto(`${base}/gallery/`);

  await expect(
    page.locator(
      '[data-content-first="comfortable"] [data-example-stage] > .helia-card',
    ),
  ).toHaveCount(6);
});

/*
 * MDX merges a slotted element and the text on the line after it into one
 * paragraph, which drops the slot attribute and leaves the overline inside the
 * heading. The card then reads as one run and the heading's accessible name
 * carries both, so assert the two are separate elements and that the name is
 * the title alone.
 */
test('a card overline stays out of the title', async ({ page }) => {
  await page.goto(`${base}/layout/`);

  const heading = page.getByRole('heading', {
    name: 'Compile the model',
    exact: true,
  });
  await expect(heading).toBeVisible();

  const header = page.locator('.helia-card-header', { has: heading }).first();
  const overline = header.locator('.helia-eyebrow');
  await expect(overline).toHaveText('Step one');

  // The overline is a sibling of the heading, not a descendant of it.
  await expect(heading.locator('.helia-eyebrow')).toHaveCount(0);

  // And it sits above the title rather than beside it.
  const overlineBox = await overline.boundingBox();
  const headingBox = await heading.boundingBox();
  expect(overlineBox && headingBox).toBeTruthy();
  expect(overlineBox!.y + overlineBox!.height).toBeLessThanOrEqual(
    headingBox!.y + 1,
  );
});

/* The comparison is only a comparison if every candidate is on the page: a
 * missing font import fails as a silently substituted stack, not as an error. */
test('the typeface page renders four candidates', async ({ page }) => {
  await page.goto(`${base}/foundations/typeface-candidates/`);

  const names = page.locator('.candidate__name');
  await expect(names).toHaveCount(4);
  await expect(names).toHaveText([
    'System stack (previous default)',
    'Roboto (current default)',
    'Inter',
    'Geist',
  ]);
});

/* The face ships with the package, so a page that never mentions it still has
 * to resolve to it, and the preload has to name the same asset the stylesheet
 * requests rather than a second copy of it. */
test('the brand face is the default sans and is preloaded once', async ({
  page,
}) => {
  await page.goto(`${base}/`);

  const body = await page
    .locator('body')
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(body).toContain('Roboto Variable');

  const preload = page.locator('link[rel="preload"][as="font"]');
  await expect(preload).toHaveCount(1);

  const href = await preload.getAttribute('href');
  expect(href).toContain('roboto-latin-wght-normal');

  const sheets = await page.evaluate(async () => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    const bodies = await Promise.all(
      links.map((link) =>
        fetch((link as HTMLLinkElement).href).then((response) =>
          response.text(),
        ),
      ),
    );
    return bodies.join('\n');
  });
  expect(sheets).toContain(href!);
});

/* Diagrams are rendered at build time, so the SVG is in the HTML with no
 * script involved, and it is painted by the package sheet rather than by
 * mermaid's own baked palette. */
test('mermaid fences render to themed inline SVG', async ({ page }) => {
  await page.goto(`${base}/diagrams/`);

  const diagrams = page.locator(
    '.sl-markdown-content svg[aria-roledescription]',
  );
  await expect(diagrams).toHaveCount(3);

  const kinds = await diagrams.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('aria-roledescription')),
  );
  expect(kinds).toEqual(['flowchart-v2', 'sequence', 'stateDiagram']);

  /* The node fill has to differ between themes, which is what proves the
   * sheet is driving the palette: mermaid's baked style is a fixed hex and
   * would paint both themes the same. */
  const fillFor = async (theme: 'light' | 'dark') => {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    return diagrams
      .first()
      .locator('.node rect, .node polygon, .basic.label-container')
      .first()
      .evaluate((el) => getComputedStyle(el).fill);
  };

  const light = await fillFor('light');
  const dark = await fillFor('dark');
  expect(light).not.toBe('');
  expect(dark).not.toBe(light);
});

/*
 * The cohesion page's claim, measured rather than asserted. The two buttons are
 * drawn by different code -- a recipe class and a generated Tailwind class
 * string -- so a token that stopped reaching one of them shows up here as a
 * step no reviewer would have to spot by eye. Height is compared within a pixel
 * because the two paths round a `min-height` against different box content;
 * radius has to be exact, since both resolve the same token.
 */
test(`${base}/react/cohesion/ draws the button pair the same`, async ({
  page,
}) => {
  await page.goto(`${base}/react/cohesion/`);

  const astro = page.locator('[data-cohesion="astro-button"]');
  const react = page.locator('[data-cohesion="react-button"]');
  await expect(astro).toBeVisible();
  await expect(react).toBeVisible();

  const radius = (locator: typeof astro) =>
    locator.evaluate((node) => getComputedStyle(node).borderRadius);
  expect(await radius(react)).toBe(await radius(astro));

  const height = async (locator: typeof astro) =>
    (await locator.boundingBox())?.height ?? 0;
  expect(Math.abs((await height(react)) - (await height(astro)))).toBeLessThan(
    1,
  );
});
