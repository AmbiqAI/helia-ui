// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The site layout declaration. A check runs from an installed copy against a
 * tree it has never seen, so a key it silently ignored, or a path that climbed
 * out of the root, would read as a check that passed.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSiteConfig } from './lib/site-config.mjs';

test('an empty config is every section, empty', () => {
  assert.deepEqual(parseSiteConfig({}), {
    styles: { sources: [], markup: [], shell: [], tokens: [] },
    islands: { pages: [], dirs: [], data: [] },
    spdx: { roots: [] },
    notices: { title: '', scope: '' },
  });
});

test('declared paths are normalized, declared text is kept', () => {
  const config = parseSiteConfig({
    $schema: 'https://example.invalid/helia-ui.schema.json',
    styles: { sources: ['src/components/', './src/styles'] },
    islands: { pages: ['src/pages'], dirs: ['src/components/islands'] },
    notices: { title: 'A HELIA site', scope: 'its runtime dependencies' },
  });
  assert.deepEqual(config.styles.sources, ['src/components', 'src/styles']);
  assert.deepEqual(config.islands.pages, ['src/pages']);
  assert.equal(config.notices.title, 'A HELIA site');
  assert.deepEqual(config.styles.markup, []);
});

const rejects = [
  ['not an object', [], /expected a JSON object/],
  ['an unknown section', { style: {} }, /unknown section 'style'/],
  [
    'an unknown key',
    { styles: { source: [] } },
    /unknown key 'styles\.source'/,
  ],
  ['a section that is not an object', { styles: [] }, /must be an object/],
  ['a path list that is not a list', { spdx: { roots: 'src' } }, /an array/],
  ['an empty path', { spdx: { roots: [' '] } }, /non-empty path strings/],
  [
    'a path that climbs out',
    { spdx: { roots: ['../sibling'] } },
    /must stay inside the root/,
  ],
  [
    'an absolute path',
    { spdx: { roots: ['/etc'] } },
    /must be relative to the root/,
  ],
  [
    'a windows separator',
    { spdx: { roots: ['src\\pages'] } },
    /must use '\/' separators/,
  ],
  ['an empty title', { notices: { title: '' } }, /non-empty string/],
  [
    'a title with no scope',
    { notices: { title: 'A HELIA site' } },
    /both 'title' and 'scope'/,
  ],
];

for (const [what, raw, message] of rejects) {
  test(`rejects ${what}`, () => {
    assert.throws(() => parseSiteConfig(raw), message);
  });
}
