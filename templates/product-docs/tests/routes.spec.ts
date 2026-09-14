// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

/* Change with `base` in astro.config.mjs. */
const BASE = '/PRODUCT-REPO-NAME';

/*
 * The sidebar fragment `helia-ui-mkdocs-convert --sidebar` writes from the
 * MkDocs nav. That nav is the contract a migrating site has to keep: until the
 * deploy switch it is what readers have bookmarked. It is read here rather
 * than transcribed, so a nav entry that gained no page fails as a test instead
 * of silently 404ing after the switch.
 */
const FRAGMENT = new URL('../src/generated/docs-sidebar.json', import.meta.url);

type SidebarEntry = {
  label: string;
  slug?: string;
  link?: string;
  items?: SidebarEntry[];
};

/* The pages this template ships, for a site that has no MkDocs nav to convert. */
const TEMPLATE_ROUTES = [
  '',
  'install',
  'guides',
  'reference',
  'how-to/first-measurement',
];

function routes(): string[] {
  const slugs: string[] = [];
  if (existsSync(fileURLToPath(FRAGMENT))) {
    const walk = (entries: SidebarEntry[]): void => {
      for (const entry of entries) {
        if (entry.items) walk(entry.items);
        else if (entry.slug !== undefined) slugs.push(entry.slug);
      }
    };
    walk(
      JSON.parse(
        readFileSync(fileURLToPath(FRAGMENT), 'utf8'),
      ) as SidebarEntry[],
    );
  }
  const all = slugs.length > 0 ? slugs : TEMPLATE_ROUTES;
  return [
    ...new Set(all.map((slug) => `${BASE}/${slug ? `${slug}/` : ''}`)),
  ].sort();
}

const ROUTES = routes();

test('the nav names at least one route', () => {
  expect(ROUTES.length).toBeGreaterThan(0);
});

for (const route of ROUTES) {
  test(`nav route ${route} is served`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status(), `${route} did not return 200`).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
  });
}
