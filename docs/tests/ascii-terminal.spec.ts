// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, test } from '@playwright/test';

/* The page that carries several animated transcripts at once. */
const code = '/helia-ui/code/';

const animated = (page: import('@playwright/test').Page) =>
  page.locator('helia-ascii-terminal[data-animate="true"]');

/*
 * The behavior script is inline after the first instance, so every later one is
 * upgraded on its opening tag, before its lines are parsed. A terminal that
 * bound nothing still renders its transcript, which is why these assertions
 * read the state the script writes rather than the text the server sent.
 */
const visibleLines = (terminal: ReturnType<typeof animated>) =>
  terminal.locator('[data-line][data-state="visible"]');

test('every animated transcript on a page is set up', async ({ page }) => {
  await page.goto(code);

  const terminals = animated(page);
  const count = await terminals.count();
  expect(
    count,
    'the page carries more than one animated transcript',
  ).toBeGreaterThan(1);

  for (let index = 0; index < count; index += 1) {
    await expect(terminals.nth(index)).toHaveAttribute('data-ready', 'true');
    expect(
      await terminals
        .nth(index)
        .evaluate((el) => typeof (el as HTMLElement & { play?: unknown }).play),
      `terminal ${index} exposes play()`,
    ).toBe('function');
  }
});

test('the second animated transcript autoplays when it is scrolled into view', async ({
  page,
}) => {
  await page.goto(code);

  const second = animated(page).nth(1);
  await second.scrollIntoViewIfNeeded();

  await expect(second).toHaveAttribute('data-enhanced', 'true');

  const lines = await second.locator('[data-line]').count();
  await expect
    .poll(() => visibleLines(second).count(), { timeout: 20_000 })
    .toBe(lines);
});

test('a later transcript types when its replay control is clicked', async ({
  page,
}) => {
  await page.goto(code);

  /* The one authored with `autoplay={false}`, so any typed state on it came
     from the click rather than from the observer. */
  const manual = animated(page).last();
  await manual.scrollIntoViewIfNeeded();
  await expect(manual.locator('[data-line][data-state]')).toHaveCount(0);

  await manual.locator('[data-replay-button]').click();
  await expect(manual).toHaveAttribute('data-playing', 'true');

  const lines = await manual.locator('[data-line]').count();
  await expect
    .poll(() => visibleLines(manual).count(), { timeout: 20_000 })
    .toBe(lines);
  await expect(manual).not.toHaveAttribute('data-playing', 'true');

  const command = manual.locator('[data-line][data-kind="command"]').first();
  const typed = await command.getAttribute('data-text');
  await expect(command.locator('[data-line-text]')).toHaveText(typed ?? '');
});
