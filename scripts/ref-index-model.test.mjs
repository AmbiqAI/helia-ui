// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The index's contract: what a row is, which facets come out of a model on
 * their own, what an overlay is allowed to add, and the one thing the index
 * shares with the renderer -- the anchor a row links to.
 *
 * The model below is written out rather than built by a helper, in the same
 * spirit as the renderer's test: these assertions exist to say what an index
 * looks like as data.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildRefIndex,
  dtypesFromName,
  refIndexFacets,
  refIndexHref,
} from '../ref-index-model.ts';
import { buildIndex } from './lib/reference-render.mjs';

const symbol = (name, overrides = {}) => ({
  id: name,
  name,
  kind: 'function',
  language: 'c',
  signature: `void ${name}(void)`,
  summary: `Summary for ${name}.`,
  description: '',
  params: [],
  returns: [],
  raises: [],
  examples: [],
  source: { path: 'Include/arm_nnfunctions.h', line: 10 },
  members: [],
  ...overrides,
});

const MODEL = {
  name: 'heliaCORE',
  language: 'c',
  modules: [
    {
      path: 'heliaCORE',
      name: 'heliaCORE',
      summary: 'The library.',
      description: '',
      symbols: [
        symbol('arm_convolve_s8'),
        symbol('arm_convolve_fp16', {
          source: { path: 'Include/arm_nnfunctions_flt.h', line: 22 },
        }),
        symbol('arm_relu_s16'),
        symbol('arm_q7_to_q15'),
        symbol('arm_nn_types', {
          kind: 'struct',
          members: [symbol('dims', { kind: 'attribute' })],
        }),
      ],
      submodules: [
        {
          path: 'heliaCORE.NN Support',
          name: 'NN Support',
          summary: 'Helpers.',
          description: '',
          symbols: [
            symbol('arm_convolve_wrapper_s8', {
              source: { path: 'Include/arm_nnsupportfunctions.h', line: 4 },
            }),
          ],
          submodules: [],
        },
      ],
    },
  ],
};

const GROUPS = [
  {
    id: 'convolution',
    label: 'Convolution',
    patterns: ['^arm_convolve'],
  },
  { id: 'activation', label: 'Activation', patterns: ['^arm_relu'] },
];

test('a row projects the symbol, its module, its group and its anchor', () => {
  const rows = buildRefIndex(MODEL, {
    base: '/ns-cmsis-nn/',
    groups: GROUPS,
  });

  const row = rows.find((entry) => entry.name === 'arm_convolve_s8');
  assert.deepEqual(row, {
    id: 'arm_convolve_s8',
    name: 'arm_convolve_s8',
    kind: 'function',
    module: 'heliaCORE',
    group: 'Convolution',
    href: '/ns-cmsis-nn/reference/api/heliacore/#arm_convolve_s8',
    summary: 'Summary for arm_convolve_s8.',
    facets: {
      group: ['Convolution'],
      dtypes: ['s8'],
      headers: ['arm_nnfunctions.h'],
    },
  });
});

test('rows are sorted by name and default to functions alone', () => {
  const rows = buildRefIndex(MODEL);
  assert.deepEqual(
    rows.map((row) => row.name),
    [
      'arm_convolve_fp16',
      'arm_convolve_s8',
      'arm_convolve_wrapper_s8',
      'arm_q7_to_q15',
      'arm_relu_s16',
    ],
  );
});

test('kinds and members are opt-in', () => {
  const rows = buildRefIndex(MODEL, {
    kinds: ['struct', 'attribute'],
    includeMembers: true,
  });
  assert.deepEqual(
    rows.map((row) => row.name),
    ['arm_nn_types', 'dims'],
  );
});

test('a symbol no group matches falls to the ungrouped label', () => {
  const rows = buildRefIndex(MODEL, { groups: GROUPS, ungrouped: 'Support' });
  const row = rows.find((entry) => entry.name === 'arm_q7_to_q15');
  assert.equal(row.group, 'Support');
  assert.deepEqual(row.facets.group, ['Support']);
});

test('with no group config there is no group facet', () => {
  const rows = buildRefIndex(MODEL);
  assert.equal(rows[0].group, 'Other');
  assert.equal(rows[0].facets.group, undefined);
});

test('the data type comes off the name, aliased and deduplicated', () => {
  const dtypes = (name) => dtypesFromName({ symbol: { name }, module: {} });
  assert.deepEqual(dtypes('arm_convolve_s8'), ['s8']);
  assert.deepEqual(dtypes('arm_convolve_fp16'), ['f16']);
  assert.deepEqual(dtypes('arm_q7_to_q15'), ['q7', 'q15']);
  assert.deepEqual(dtypes('arm_convolve_s8_s8'), ['s8']);
  assert.deepEqual(dtypes('arm_softmax'), []);
  /* `_s8x4` is a packing, not a type: a suffix ends at the word. */
  assert.deepEqual(dtypes('arm_nn_read_s8x4'), []);
});

test('the header facet is the declaring file, not the module', () => {
  const rows = buildRefIndex(MODEL);
  const row = rows.find((entry) => entry.name === 'arm_convolve_wrapper_s8');
  assert.deepEqual(row.facets.headers, ['arm_nnsupportfunctions.h']);
  assert.equal(row.module, 'heliaCORE.NN Support');
});

test('an extractor can be added, replaced, or dropped', () => {
  const rows = buildRefIndex(MODEL, {
    facets: {
      headers: null,
      kinds: ({ symbol: sym }) => [sym.kind],
    },
  });
  assert.equal(rows[0].facets.headers, undefined);
  assert.deepEqual(rows[0].facets.kinds, ['function']);
});

test('the overlay adds facet values and contract fields by symbol name', () => {
  const rows = buildRefIndex(MODEL, {
    groups: GROUPS,
    overlay: {
      symbols: {
        arm_convolve_s8: {
          facets: { paths: ['helium', 'dsp'] },
          prerequisites: ['Call the wrapper to size the scratch buffer.'],
          bufferSize: 'arm_convolve_s8_get_buffer_size(dims)',
          tolerances: 'Bit-exact against the reference kernel.',
        },
        arm_relu_s16: { notes: 'In place.' },
      },
    },
  });

  const convolve = rows.find((row) => row.name === 'arm_convolve_s8');
  assert.deepEqual(convolve.facets.paths, ['helium', 'dsp']);
  assert.deepEqual(convolve.contract, {
    prerequisites: ['Call the wrapper to size the scratch buffer.'],
    bufferSize: 'arm_convolve_s8_get_buffer_size(dims)',
    tolerances: 'Bit-exact against the reference kernel.',
  });

  const relu = rows.find((row) => row.name === 'arm_relu_s16');
  assert.deepEqual(relu.contract, { notes: 'In place.' });

  const uncovered = rows.find((row) => row.name === 'arm_q7_to_q15');
  assert.equal(uncovered.contract, undefined);
  assert.equal(uncovered.facets.paths, undefined);
});

test('an overlay entry replaces the derived values for the facet it names', () => {
  const rows = buildRefIndex(MODEL, {
    overlay: { arm_convolve_s8: { facets: { dtypes: ['s8', 's4'] } } },
  });
  const row = rows.find((entry) => entry.name === 'arm_convolve_s8');
  assert.deepEqual(row.facets.dtypes, ['s8', 's4']);
});

test('facets are derived from the rows, ordered, and never empty', () => {
  const rows = buildRefIndex(MODEL, {
    groups: GROUPS,
    overlay: { arm_convolve_s8: { facets: { paths: ['helium'] } } },
  });

  assert.deepEqual(refIndexFacets(rows), [
    {
      id: 'group',
      label: 'Group',
      values: ['Activation', 'Convolution', 'Other'],
    },
    {
      id: 'dtypes',
      label: 'Data type',
      values: ['f16', 'q7', 'q15', 's8', 's16'],
    },
    { id: 'paths', label: 'Path', values: ['helium'] },
    {
      id: 'headers',
      label: 'Header',
      values: [
        'arm_nnfunctions_flt.h',
        'arm_nnfunctions.h',
        'arm_nnsupportfunctions.h',
      ],
    },
  ]);

  /* No manifest, no path control. */
  assert.deepEqual(
    refIndexFacets(buildRefIndex(MODEL)).map((facet) => facet.id),
    ['dtypes', 'headers'],
  );
});

test('a caller can relabel a facet', () => {
  const rows = buildRefIndex(MODEL);
  const facets = refIndexFacets(rows, { dtypes: 'Precision' });
  assert.equal(
    facets.find((facet) => facet.id === 'dtypes').label,
    'Precision',
  );
});

/*
 * The one duplication in this file is the route: the renderer writes the pages
 * and this writes links into them, and they are two copies of one rule. If they
 * ever disagree the index links nowhere, silently, so the agreement is asserted
 * over a model whose module paths exercise the slugging -- a space, mixed case
 * and a dotted path.
 */
test('every row links where the renderer put the symbol', () => {
  const options = { base: '/ns-cmsis-nn/', routePrefix: 'reference/api' };
  const index = buildIndex(MODEL, { ...options, base: '/ns-cmsis-nn/' });
  for (const row of buildRefIndex(MODEL, {
    ...options,
    kinds: [],
    includeMembers: true,
  })) {
    assert.equal(row.href, index.url(row.id), `${row.name} links elsewhere`);
  }
});

test('the base path is normalized the way the renderer normalizes it', () => {
  assert.equal(
    refIndexHref('a.b', 'sym', { base: 'site' }),
    '/site/reference/api/a/b/#sym',
  );
  assert.equal(refIndexHref('a.b', 'sym', {}), '/reference/api/a/b/#sym');
  assert.equal(
    refIndexHref('a', 'sym', { base: '/x/', routePrefix: 'api' }),
    '/x/api/a/#sym',
  );
});
