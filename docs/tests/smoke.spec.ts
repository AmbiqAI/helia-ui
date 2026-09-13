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
  { path: `${base}/starlight-plugin/`, heading: 'Starlight plugin' },
  { path: `${base}/primitives/`, heading: 'Primitives' },
  { path: `${base}/cards/`, heading: 'Cards' },
  { path: `${base}/media/`, heading: 'Media' },
  { path: `${base}/code/`, heading: 'Code' },
  { path: `${base}/callouts/`, heading: 'Callouts' },
  { path: `${base}/disclosure/`, heading: 'Disclosure' },
  { path: `${base}/timeline/`, heading: 'Timeline' },
  { path: `${base}/layout/`, heading: 'Layout' },
  { path: `${base}/react/inputs/`, heading: 'Inputs' },
  { path: `${base}/react/form-depth/`, heading: 'Form depth' },
  { path: `${base}/react/overlays/`, heading: 'Overlays' },
  { path: `${base}/react/feedback/`, heading: 'Feedback' },
  { path: `${base}/react/data-display/`, heading: 'Data display' },
  { path: `${base}/react/navigation/`, heading: 'Navigation' },
  { path: `${base}/react/versioning/`, heading: 'Versioning' },
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
];

for (const path of accessibilityRoutes) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
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
