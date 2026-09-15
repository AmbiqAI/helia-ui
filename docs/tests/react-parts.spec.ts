// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test, type Page } from '@playwright/test';

const base = '/helia-ui';

/*
 * The generated React parts, measured rather than eyeballed. Every assertion
 * here stands for a defect that shipped: the class strings shadcn writes are
 * silent about everything Tailwind's preflight and its stock scales would have
 * supplied, and this package supplies neither by default, so what went wrong
 * went wrong quietly. See AmbiqAI/helia-ui#52 and AmbiqAI/helia-ui#53.
 */

/* A token is a declaration, not a color: `--helia-surface-card-muted` computes
 * to an unresolved `color-mix(...)` string. Painting it on a probe is what
 * turns it into the same `rgb()` form a measured background comes back in. */
const resolveToken = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, token);

/* What the visitor sees behind an element, which is not always the element's
 * own background: a tab segment is transparent and stands on its list. */
const effectiveBackground = (page: Page, selector: string, index = 0) =>
  page.evaluate(
    ([selector, index]) => {
      let node: Element | null =
        document.querySelectorAll(selector)[index as number];
      while (node) {
        const value = getComputedStyle(node).backgroundColor;
        if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent')
          return value;
        node = node.parentElement;
      }
      return 'rgba(0, 0, 0, 0)';
    },
    [selector, index] as const,
  );

const useLightTheme = async (page: Page) => {
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
};

/*
 * The thumb is centered by an inset that has to be equal on both sides in both
 * states, and the travel between the states is the track minus the thumb minus
 * both insets. It sat six pixels outside the track when the UA's button padding
 * was still in force, and the small size stopped two thirds of the way along
 * when `w-6` resolved to the hub's 2rem step rather than Tailwind's 1.5rem.
 */
test('the switch thumb is centered in its track in both states', async ({
  page,
}) => {
  await page.goto(`${base}/react/inputs/`);
  const geometry = () =>
    page.evaluate(() => {
      const root = document.querySelector('[data-slot="switch"]')!;
      const thumb = root.querySelector('[data-slot="switch-thumb"]')!;
      const r = root.getBoundingClientRect();
      const t = thumb.getBoundingClientRect();
      return {
        state: root.getAttribute('data-state'),
        left: t.left - r.left,
        right: r.right - t.right,
        top: t.top - r.top,
        bottom: r.bottom - t.bottom,
        travel: r.width - t.width,
      };
    });

  const first = await geometry();
  await page.locator('[data-slot="switch"]').first().click();
  await page.waitForTimeout(250);
  const second = await geometry();

  expect(second.state).not.toBe(first.state);

  for (const box of [first, second]) {
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(Math.abs(box.top - box.bottom)).toBeLessThanOrEqual(0.5);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeGreaterThanOrEqual(0);
  }

  const [off, on] =
    first.left < second.left ? [first, second] : [second, first];
  expect(off.left).toBeCloseTo(on.right, 1);
  expect(on.left - off.left).toBeCloseTo(off.travel - 2 * off.left, 1);
});

/*
 * An unselected segment draws no surface of its own, so the ground behind it is
 * the list's: the muted card surface. It used to be the UA button face, which
 * is a mid gray in light and a dark one in dark, and read as disabled beside
 * the selected segment.
 */
test('an unselected tab segment stands on the muted card surface', async ({
  page,
}) => {
  await page.goto(`${base}/react/inputs/`);
  await useLightTheme(page);

  const inactive = page.locator(
    '[data-slot="tabs-trigger"][data-state="inactive"]',
  );
  await expect(inactive.first()).toBeVisible();

  const index = await page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="tabs-trigger"]')].findIndex(
      (node) => node.getAttribute('data-state') === 'inactive',
    ),
  );

  expect(
    await effectiveBackground(page, '[data-slot="tabs-trigger"]', index),
  ).toBe(await resolveToken(page, '--helia-surface-card-muted'));

  /* Distinct from the disabled step, which is the same surface at half alpha. */
  expect(
    await inactive.first().evaluate((n) => getComputedStyle(n).opacity),
  ).toBe('1');
});

/*
 * The close button sits on the container's own padding, not on a fixed step of
 * shadcn's: `top-4` against a `p-6` that resolves to the hub's 2rem left it
 * floating a full step inside the corner.
 */
test('the dialog close button sits at the content padding', async ({
  page,
}) => {
  await page.goto(`${base}/react/overlays/`);
  await page.locator('[data-slot="dialog-trigger"]').first().click();
  await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible();

  const offsets = await page.evaluate(() => {
    const content = document.querySelector('[data-slot="dialog-content"]')!;
    /* The corner button, not the one a footer renders: both carry the same
       slot, and only the corner one is a direct child of the content. */
    const close = content.querySelector(
      ':scope > button[data-slot="dialog-close"]',
    ) as HTMLElement;
    const c = content.getBoundingClientRect();
    const x = close.getBoundingClientRect();
    const style = getComputedStyle(content);
    return {
      top: x.top - c.top,
      right: c.right - x.right,
      /* An absolutely positioned child is offset from the padding box, so the
         edge of the container is one border width further out. */
      padTop: parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth),
      padRight:
        parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth),
      width: x.width,
      height: x.height,
      control: (() => {
        const probe = document.createElement('div');
        probe.style.height = 'var(--helia-control-sm)';
        document.body.append(probe);
        const value = parseFloat(getComputedStyle(probe).height);
        probe.remove();
        return value;
      })(),
    };
  });

  expect(offsets.top).toBeCloseTo(offsets.padTop, 1);
  expect(offsets.right).toBeCloseTo(offsets.padRight, 1);
  /* An icon button on the control scale, square, with the icon centered in it. */
  expect(offsets.width).toBeCloseTo(offsets.height, 1);
  expect(offsets.width).toBeCloseTo(offsets.control, 1);
});

/*
 * A shadcn list is an `ol` or a `ul` that expects preflight to have taken its
 * markers away. Without it the breadcrumb numbered itself over its own links.
 */
test('list-based parts carry no markers', async ({ page }) => {
  await page.goto(`${base}/react/navigation/`);

  const lists = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'ol[data-slot], ul[data-slot], menu[data-slot]',
      ),
    ].map((node) => ({
      slot: node.getAttribute('data-slot'),
      marker: getComputedStyle(node).listStyleType,
      padding: getComputedStyle(node).paddingInlineStart,
    })),
  );

  expect(lists.length).toBeGreaterThan(0);
  expect(lists.filter((list) => list.marker !== 'none')).toEqual([]);
  expect(lists.filter((list) => list.padding !== '0px')).toEqual([]);
});

/*
 * The other half of that contract. The reset names the parts that are a list
 * rather than sweeping `[data-slot] *`, because the subtree of a card, a
 * dialog or a tab panel is whatever the author put there: prose written
 * against the UA defaults, which lost its markers and its indent to a reset
 * meant for generated markup.
 */
test('a list an author slotted into a card keeps its markers', async ({
  page,
}) => {
  await page.goto(`${base}/react/navigation/`);

  /* It is inside both of the slots the old subtree form reached through. */
  const list = page.locator(
    '[data-slot="card-content"] [data-slot="tabs-content"] ul[data-consumer-list]',
  );
  await expect(list).toBeVisible();

  const style = await list.evaluate((node) => ({
    marker: getComputedStyle(node).listStyleType,
    padding: getComputedStyle(node).paddingInlineStart,
  }));

  expect(style.marker).toBe('disc');
  expect(style.padding).not.toBe('0px');
});

/*
 * A chart that hydrates into a card with no measurable height renders an empty
 * frame and reports nothing wrong, so the assertion is the drawn surface.
 */
test('every chart card draws a sized chart', async ({ page }) => {
  await page.goto(`${base}/react/data-display/`);

  const charts = page.locator('[data-slot="chart"]');
  await expect(charts.first()).toBeVisible();

  /* One of the charts on this page is a `client:visible` island, so it has to
     be looked at before it can be measured. */
  const total = await charts.count();
  expect(total).toBeGreaterThan(0);
  for (let index = 0; index < total; index += 1) {
    await charts.nth(index).scrollIntoViewIfNeeded();
  }

  /* The surface is drawn by the island and not by the page, so it is waited
     for rather than counted: a loaded runner hydrates long after `load`. */
  for (let index = 0; index < total; index += 1) {
    await expect(charts.nth(index).locator('svg').first()).toBeAttached({
      timeout: 15_000,
    });
  }

  const measure = () =>
    charts.evaluateAll((nodes) =>
      nodes.map((node) => {
        const svg = node.querySelector('svg');
        return svg ? Math.round(svg.getBoundingClientRect().height) : 0;
      }),
    );

  /* Polled because the frame is measured by a resize observer after paint. */
  await expect
    .poll(async () => (await measure()).filter((height) => height <= 0), {
      timeout: 15_000,
    })
    .toEqual([]);
});

/*
 * Recharts reads `--chart-*` and the Plot and ECharts parts read
 * `--helia-chart-*`. While those were two different ramps the same series was
 * a different color in each library on the same page, and nothing failed. The
 * assertion is the painted mark against the token, because the alias is what
 * would go missing and an alias has no other visible effect.
 */
test('a Recharts series is painted the shared chart ramp', async ({ page }) => {
  await page.goto(`${base}/react/data-display/`);

  const bar = page
    .locator('[data-slot="chart"] .recharts-bar-rectangle path')
    .first();
  await expect(bar).toBeAttached({ timeout: 15_000 });

  /* Polled: the fill is `var(--color-latency)`, which resolves through the
     style block the chart writes for its own id after hydration. */
  await expect
    .poll(() => bar.evaluate((node) => getComputedStyle(node).fill), {
      timeout: 15_000,
    })
    .toBe(await resolveToken(page, '--helia-chart-1'));
});

/*
 * The menu drops below its trigger rather than over the heading above it, and
 * the row under the pointer is a color the popover ground is not: they were
 * the same value in light, so nothing appeared to happen on hover.
 */
test('a select menu drops below its trigger and highlights its rows', async ({
  page,
}) => {
  await page.goto(`${base}/react/versioning/`);
  await useLightTheme(page);

  const trigger = page.locator('[data-slot="select-trigger"]').first();
  const triggerBox = (await trigger.boundingBox())!;
  await trigger.click();

  const content = page.locator('[data-slot="select-content"]');
  await expect(content).toBeVisible();

  const contentBox = (await content.boundingBox())!;
  expect(contentBox.y).toBeGreaterThanOrEqual(triggerBox.y);

  const items = page.locator('[data-slot="select-item"]');
  await items.nth(1).hover();
  await page.waitForTimeout(150);

  const highlighted = await items
    .nth(1)
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  const ground = await content.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );

  expect(highlighted).not.toBe(ground);
  expect(highlighted).toBe(await resolveToken(page, '--helia-surface-hover'));
});
