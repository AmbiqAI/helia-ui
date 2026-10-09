// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { expect, type Page, test } from '@playwright/test';

/* The page that carries several animated transcripts at once. */
const code = '/helia-ui/code/';

/*
 * By caption rather than by position: the page is documentation first, and an
 * example added above one of these would otherwise move the assertions onto a
 * different transcript without failing.
 */
const terminal = (page: Page, title: string) =>
  page.locator('helia-ascii-terminal', {
    has: page.locator('.ascii-terminal__title', {
      hasText: new RegExp(`^${title}$`),
    }),
  });

/*
 * The behavior script is inline after the first instance, so every later one is
 * upgraded on its opening tag, before its lines are parsed. A terminal that
 * bound nothing still renders its transcript, which is why these assertions
 * read the state the script writes rather than the text the server sent.
 */
const played = async (locator: ReturnType<typeof terminal>) => {
  const lines = await locator.locator('[data-line]').count();
  expect(lines).toBeGreaterThan(0);
  await expect
    .poll(() => locator.locator('[data-line][data-state="visible"]').count(), {
      timeout: 20_000,
    })
    .toBe(lines);
};

test('every animated transcript on the page runs through play()', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto(code);

  for (const title of ['First run', 'Doctor', 'Manual start']) {
    const frame = terminal(page, title);
    await expect(frame).toHaveAttribute('data-animate', 'true');
    /* Resolves when the run ends, so the wait is the component's own. */
    await frame.evaluate((el: HTMLElement & { play(): Promise<void> }) =>
      el.play(),
    );
    await played(frame);
  }
});

test('a later transcript autoplays when it is scrolled into view', async ({
  page,
}) => {
  await page.goto(code);

  const doctor = terminal(page, 'Doctor');
  await doctor.scrollIntoViewIfNeeded();

  await expect(doctor).toHaveAttribute('data-enhanced', 'true');
  await played(doctor);
});

test('a later transcript types when its replay control is clicked', async ({
  page,
}) => {
  await page.goto(code);

  /* The one authored with `autoplay={false}`, so any typed state on it came
     from the click rather than from the observer. */
  const manual = terminal(page, 'Manual start');
  await manual.scrollIntoViewIfNeeded();
  await expect(manual.locator('[data-line][data-state]')).toHaveCount(0);

  await manual.locator('[data-replay-button]').click();
  await expect(manual).toHaveAttribute('data-playing', 'true');
  await played(manual);
  await expect(manual).not.toHaveAttribute('data-playing', 'true');

  const command = manual.locator('[data-line][data-kind="command"]').first();
  const typed = await command.getAttribute('data-text');
  await expect(command.locator('[data-line-text]')).toHaveText(typed ?? '');
});

/*
 * A clone carries `data-ready` from the instance it was copied off. Guarding on
 * the attribute made such a copy permanently inert, which is the shape of the
 * workaround a consumer reached for while later instances were broken.
 */
test('a clone of a set-up transcript sets itself up and plays', async ({
  page,
}) => {
  await page.goto(code);

  const doctor = terminal(page, 'Doctor');
  await expect(doctor).toHaveAttribute('data-ready', 'true');

  await doctor.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.dataset.testClone = 'true';
    /* Copied state only; nothing below may pass on what the original ran. */
    delete clone.dataset.enhanced;
    delete clone.dataset.playing;
    for (const line of clone.querySelectorAll<HTMLElement>('[data-line]')) {
      delete line.dataset.state;
    }
    document.body.append(clone);
  });

  const clone = page.locator('helia-ascii-terminal[data-test-clone="true"]');
  await clone.evaluate((el: HTMLElement & { play(): Promise<void> }) =>
    el.play(),
  );
  await played(clone);
});

/*
 * The clipboard is the assertion, not the label: a mode that relabeled the
 * control and still copied the whole transcript would pass a label check.
 */
test('the commands copy mode copies the command lines and nothing else', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(code);

  const install = terminal(page, 'Install the CLI');
  const button = install.locator('[data-copy-button]');
  await expect(button).toHaveAttribute('aria-label', 'Copy commands');
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Commands copied');

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(
    'npm install --global @ambiqai/helia-cli\nhelia --version',
  );
});

test('the transcript copy mode still copies prompts and output', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(code);

  const first = terminal(page, 'First run');
  const button = first.locator('[data-copy-button]');
  await expect(button).toHaveAttribute(
    'aria-label',
    'Copy terminal transcript',
  );
  await button.click();
  await expect(button).toHaveAttribute(
    'aria-label',
    'Terminal transcript copied',
  );

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const transcript = await first.locator('[data-transcript]').textContent();
  expect(copied).toBe(transcript);
  expect(copied.startsWith('$ ')).toBe(true);
});
