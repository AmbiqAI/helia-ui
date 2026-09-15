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
  { path: `${base}/foundations/tokens/`, heading: 'Color tokens' },
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
  {
    path: `${base}/react/charts-candidates/`,
    heading: 'Charting candidates',
  },
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

/* The pages that carry the site's own demonstration markup: the landing with
 * the tables and callouts, and the ones that render the most package parts. A
 * violation on any of them is a violation in a part, not in prose. */
const accessibilityRoutes: { path: string; theme?: 'dark' }[] = [
  { path: `${base}/` },
  { path: `${base}/primitives/` },
  { path: `${base}/cards/` },
  {
    /* The only page carrying a terminal in each of the three tones, so it is
       where a status ink that reads on one backdrop and not another shows. */
    path: `${base}/code/`,
  },
  {
    /* Syntax ink is the one page color the package does not own -- it comes
       from the Shiki theme pair, drawn on the package's card rather than on
       the theme's own editor background -- so the code page is scanned in
       both themes. See AmbiqAI/helia-ui#33. */
    path: `${base}/code/`,
    theme: 'dark',
  },
  {
    /* Every card variant and every transition on one page. A contrast failure
       in an inverted or tinted variant shows up here before it reaches a
       site. */
    path: `${base}/gallery/`,
  },
  {
    /* The palette blocks paint the off-theme ground on the page, so this is
       the one page where a color is read against a surface the theme toggle
       never produces. Four hydrated chart libraries land here as well. */
    path: `${base}/react/charts-candidates/`,
  },
];

for (const { path, theme } of accessibilityRoutes) {
  const label = theme ? `${path} (${theme})` : path;
  test(`${label} has no accessibility violations`, async ({ page }) => {
    /*
     * Scanned as a reduced-motion visitor. The motion scale is 0 for them, so
     * `Reveal` never arms and nothing is part way through a fade while axe
     * measures it — a contrast reading taken mid-transition is of a color
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
    /*
     * Set after load rather than through a color-scheme emulation: Starlight
     * resolves the stored preference in a blocking head script and writes the
     * attribute itself, so anything set earlier is overwritten on navigation.
     */
    if (theme) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
    }
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

/*
 * The two halves of the token tour, asserted where each one is generated or
 * drawn. The color grid is written from `tokens.css`, so the primitive count
 * is the proof that the generator read the file rather than an empty list; the
 * ramp is the proof that every named size has a specimen, which is the one
 * thing a reader cannot check by eye against a table.
 */
test('the token pages render every primitive and every type step', async ({
  page,
}) => {
  await page.goto(`${base}/foundations/tokens/`);

  const primitives = page.locator(
    '[data-token-group="primitives"] [data-token-swatch]',
  );
  expect(await primitives.count()).toBeGreaterThanOrEqual(9);

  /* A ratio with no sample beside it is a number nobody can judge. */
  await expect(page.locator('[data-contrast-row]').first()).toBeVisible();

  /* The table is the package's own accessibility claim, so a pairing that the
     palette drops below AA has to fail here rather than be published as a
     number a reader is left to notice. */
  const ratios = await page
    .locator('[data-contrast-row] .contrast__ratio')
    .evaluateAll((nodes) => nodes.map((node) => parseFloat(node.textContent!)));
  expect(ratios.length).toBeGreaterThan(0);
  expect(ratios.filter((ratio) => !(ratio >= 4.5))).toEqual([]);

  await page.goto(`${base}/foundations/`);

  const sizes = page.locator('[data-type-ramp] [data-type-size]');
  await expect(sizes).toHaveCount(13);

  const named = await sizes.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-type-size')),
  );
  const drawn = await sizes.evaluateAll((nodes) =>
    nodes.map((node) =>
      parseFloat(getComputedStyle(node.querySelector('p') as Element).fontSize),
    ),
  );

  /* Every step resolves to a size of its own, in order, so a token that stopped
     reaching the page shows as a duplicate rather than as a missing row. */
  expect(new Set(named).size).toBe(named.length);
  expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
});

/* The comparison is only a comparison if every candidate is on the page: a
 * missing font import fails as a silently substituted stack, not as an error. */
test('the typeface page renders four candidates', async ({ page }) => {
  await page.goto(`${base}/foundations/typeface-candidates/`);

  const names = page.locator('.candidate__name');
  await expect(names).toHaveCount(4);
  await expect(names).toHaveText(['System stack', 'Roboto', 'Inter', 'Geist']);
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

/*
 * A dial composes tokens rather than being one, and CSS substitutes a custom
 * property at the element that declares it: before the compositions were
 * repeated on the theme-scope hooks these three wrappers rendered three
 * identical cards under three different captions. Shape and ground are the two
 * the knobs move, so three distinct values of each is the assertion.
 */
test('a theme scope re-derives what its dials compose', async ({ page }) => {
  await page.goto(`${base}/gallery/`);

  const scopes = ['knob-square', 'knob-default', 'knob-round'];
  const drawn = [];

  for (const scope of scopes) {
    const card = page
      .locator(`[data-helia-theme="${scope}"] .helia-card`)
      .first();
    await expect(card).toBeVisible();
    drawn.push(
      await card.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          radius: style.borderTopLeftRadius,
          background: style.backgroundColor,
        };
      }),
    );
  }

  expect(new Set(drawn.map((card) => card.radius)).size).toBe(scopes.length);
  expect(new Set(drawn.map((card) => card.background)).size).toBe(
    scopes.length,
  );
});

/*
 * The same assertion on the worked pair, which is the page that claims a site
 * owns its flair as a diff against one file. The badge is the second accent:
 * it is the one dial with no other way to show itself on a card, since no card
 * part draws an accent edge.
 */
test('the two worked themes draw the same cards differently', async ({
  page,
}) => {
  await page.goto(`${base}/foundations/site-theme/`);

  const panel = async (scope: string) => {
    const card = page
      .locator(`.site-theme-example--${scope} .helia-card`)
      .first();
    await expect(card).toBeVisible();
    const shape = await card.evaluate((node) => {
      const style = getComputedStyle(node);
      const panelNode = node.closest('.site-theme-example') as HTMLElement;
      return {
        radius: style.borderTopLeftRadius,
        background: style.backgroundColor,
        /* Where the cards start, which the hero treatment must not move. */
        offset:
          node.getBoundingClientRect().top -
          panelNode.getBoundingClientRect().top,
      };
    });

    const badge = page
      .locator(`.site-theme-example--${scope} .helia-badge--secondary`)
      .first();
    await expect(badge).toBeVisible();
    const ink = await badge.evaluate((node) => getComputedStyle(node).color);

    return { ...shape, ink };
  };

  const hub = await panel('hub');
  const warm = await panel('warm');

  expect(warm.radius).not.toBe(hub.radius);
  expect(warm.background).not.toBe(hub.background);
  expect(warm.ink).not.toBe(hub.ink);
  expect(Math.abs(warm.offset - hub.offset)).toBeLessThanOrEqual(1);
});

/*
 * Expressive Code draws the active editor tab as the first child of the frame
 * header, with no clip between them, so the tab's inline-start corner sits on
 * the frame's own. A tab radius that does not match the frame's therefore
 * paints outside the curve. Read in both themes because the frame radius is a
 * token and the tab used to carry a literal. See AmbiqAI/helia-ui#41.
 */
test('the code frame title tab follows the frame corner', async ({ page }) => {
  await page.goto(`${base}/code/`);

  const frame = page.locator('.frame.has-title:not(.is-terminal)').first();
  await expect(frame).toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);

    const corner = await frame.evaluate((node) => {
      const tab = node.querySelector('.header .title');
      return {
        frame: getComputedStyle(node).borderTopLeftRadius,
        tab: tab ? getComputedStyle(tab).borderTopLeftRadius : null,
      };
    });

    expect(corner.frame, theme).not.toBe('0px');
    expect(corner.tab, theme).toBe(corner.frame);
  }
});

/*
 * A terminal frame with a title draws no tab: the title bar is the header
 * itself, and it is the header that has to hold the corner. The page carries
 * only untitled terminals, so the titled combination is measured on a probe
 * built from the frame the page does carry.
 */
test('a titled terminal frame holds the frame corner', async ({ page }) => {
  await page.goto(`${base}/code/`);

  const frame = page.locator('.frame.is-terminal').first();
  await expect(frame).toBeVisible();

  const corner = await frame.evaluate((node) => {
    const probe = node.cloneNode(true) as HTMLElement;
    probe.classList.add('has-title');
    const header = probe.querySelector('.header') as HTMLElement;
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = 'deploy.sh';
    header.replaceChildren(title);
    node.after(probe);

    const measured = {
      frame: getComputedStyle(probe).borderTopLeftRadius,
      header: getComputedStyle(header).borderTopLeftRadius,
      display: getComputedStyle(header).display,
    };

    probe.remove();
    return measured;
  });

  expect(corner.display).not.toBe('none');
  expect(corner.frame).not.toBe('0px');
  expect(corner.header).toBe(corner.frame);
});

/*
 * The comparison page only compares if every candidate drew every chart: a
 * library that fails to mount leaves its cards standing and the page still
 * looks whole. Four libraries, three charts each, and an SVG in all twelve.
 */
test('every charting candidate draws all three charts', async ({ page }) => {
  await page.goto(`${base}/react/charts-candidates/`);

  const panels = page.locator('[data-chart-candidate]');
  await expect(panels).toHaveCount(12);

  for (const library of ['mui', 'recharts', 'plot', 'echarts']) {
    const drawn = page.locator(
      `[data-chart-library="${library}"] [data-chart-candidate] svg`,
    );
    await expect(drawn.first()).toBeVisible();
    expect(await drawn.count()).toBeGreaterThanOrEqual(3);
  }
});

/*
 * The palette section is the other half of the page and it is entirely Astro:
 * the shipped palette and three candidates, each drawn on both grounds, each
 * ground carrying the line and the bar. Sixteen figures with no island behind
 * any of them, so a count taken from the served HTML is the assertion that the
 * section costs nothing.
 */
test('the palette section draws four palettes on both grounds', async ({
  page,
  request,
}) => {
  const response = await request.get(`${base}/react/charts-candidates/`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html.match(/helia-chart__plot/g) ?? []).toHaveLength(16);

  await page.goto(`${base}/react/charts-candidates/`);
  await expect(page.locator('[data-chart-palette-card]')).toHaveCount(4);
  for (const palette of ['shipped', 'a', 'b', 'c']) {
    for (const ground of ['dark', 'light']) {
      const block = page.locator(
        `[data-chart-palette="${palette}"][data-chart-ground="${ground}"]`,
      );
      await expect(block).toHaveCount(1);
      /* The six steps are set on the block rather than on the document, which
         is the whole mechanism a palette change uses. */
      const first = await block.evaluate((node) =>
        getComputedStyle(node).getPropertyValue('--helia-chart-1').trim(),
      );
      expect(first).toMatch(/^#[0-9a-f]{6}$/);
    }
  }
});

/*
 * The shipped block restates semantic.css so it can be drawn beside the
 * candidates, which is a copy, which is a thing that drifts. Whichever theme
 * the page settles in, the block for that ground has to resolve to exactly
 * what the document resolves to.
 *
 * Read through a probe element rather than by comparing the property strings:
 * `--helia-chart-2` is `var(--helia-ink-primary)` on the document and a literal
 * in the block, and only the computed color puts those two in the same units.
 */
test('the shipped palette block matches the document tokens', async ({
  page,
}) => {
  await page.goto(`${base}/react/charts-candidates/`);

  const mismatches = await page.evaluate(() => {
    const ground =
      document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const block = document.querySelector(
      `[data-chart-palette="shipped"][data-chart-ground="${ground}"]`,
    );
    if (!block) return [`no shipped ${ground} block`];

    const probe = () => {
      const node = document.createElement('span');
      node.style.display = 'none';
      return node;
    };
    const inBlock = block.appendChild(probe());
    const onPage = document.body.appendChild(probe());

    const found: string[] = [];
    for (let step = 1; step <= 6; step += 1) {
      const property = `var(--helia-chart-${step})`;
      inBlock.style.color = property;
      onPage.style.color = property;
      const shipped = getComputedStyle(inBlock).color;
      const document_ = getComputedStyle(onPage).color;
      if (shipped !== document_) {
        found.push(`--helia-chart-${step}: ${shipped} vs ${document_}`);
      }
    }
    inBlock.remove();
    onPage.remove();
    return found;
  });

  expect(mismatches).toEqual([]);
});

/*
 * The claim that decides issue 50: ECharts gives a legend that turns a series
 * off, from options and not from island code. Counting the paths in the figure
 * before and after the click is the only way to assert it without trusting the
 * library's own state.
 */
test('the ECharts legend toggles a series off', async ({ page }) => {
  await page.goto(`${base}/react/charts-candidates/`);

  const panel = page
    .locator('[data-chart-library="echarts"] [data-chart-candidate]')
    .first();
  /* The figure, not a path: a gridline is a horizontal segment with no height,
     which Playwright reads as hidden however well it is drawn. */
  await expect(panel.locator('svg').first()).toBeVisible();
  const paths = panel.locator('svg path');
  /* The entrance animation is the point of the animation column, so the count
     is only stable once it has finished. */
  await page.waitForTimeout(1500);
  const before = await paths.count();
  expect(before).toBeGreaterThan(0);

  await panel.getByText('heliaAOT', { exact: true }).click();
  await expect
    .poll(async () => paths.count(), { timeout: 5000 })
    .not.toBe(before);
});

/*
 * The whole claim of the Astro chart part is that the SVG is in the response.
 * A chart that only appears once the page has run is a chart that got there
 * some other way, so this reads the served HTML rather than the DOM: seven
 * figures across the five examples, four standing alone and three in the group.
 */
const GALLERY_CHARTS = 7;

test('the gallery charts are inline SVG in the served HTML', async ({
  page,
  request,
}) => {
  const response = await request.get(`${base}/gallery/`);
  expect(response.status()).toBe(200);
  const html = await response.text();

  const plots = html.match(/helia-chart__plot/g) ?? [];
  expect(plots).toHaveLength(GALLERY_CHARTS);

  /* The accessible name is set on the SVG element itself, so finding it in the
     response proves the figure and not just its frame was rendered. */
  expect(html).toContain(
    'aria-label="Weekly page views. Page views against week of the quarter, by section"',
  );

  await page.goto(`${base}/gallery/`);
  const drawn = page.locator('.helia-chart__plot svg');
  await expect(drawn).toHaveCount(GALLERY_CHARTS);
  await expect(drawn.first()).toBeVisible();
});

/*
 * The colors are custom properties rather than resolved hues, which is the
 * only reason a figure drawn at build can follow the theme toggle. Reading a
 * series stroke back in both themes is the assertion that they still are.
 */
test('a build-time chart recolors with the theme', async ({ page }) => {
  await page.goto(`${base}/gallery/`);

  const stroke = async () =>
    page.evaluate(() => {
      const line = document.querySelector(
        '.helia-chart__plot svg [data-plot-label="line"] path',
      );
      return line ? getComputedStyle(line).stroke : null;
    });

  const before = await stroke();
  await page.evaluate(() => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
  });
  const after = await stroke();

  expect(before).not.toBeNull();
  expect(after).not.toBe(before);
});

/* The React counterpart mounts and draws, which is the half of the contract the
 * build-time part cannot prove. */
test('the React Plot chart draws on the data display page', async ({
  page,
}) => {
  await page.goto(`${base}/react/data-display/`);

  const drawn = page.locator('[data-chart-plot-demo] .helia-chart__plot svg');
  await expect(drawn).toHaveCount(2);
  await expect(drawn.first()).toBeVisible();
});
