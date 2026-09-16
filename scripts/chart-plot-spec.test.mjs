// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The chart spec's arithmetic, asserted on the options rather than on a
 * drawing: which axis the categories landed on, and how much room their labels
 * were given.
 *
 * The fixture is shaped like the benchmark chart the options were written for
 * -- many categories with long names, three series, ratios spanning more than
 * a decade -- because every one of these decisions was made in that shape and
 * a three-bar fixture would pass them all without exercising any of them.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chartCategoryMargin, chartPlotOptions } from '../chart-plot-spec.ts';

const KERNELS = [
  'packing_rescale_s8',
  'packing_rescale_s16',
  'window_fold_s8',
  'window_fold_s16',
  'stride_gather_s8',
  'stride_gather_s16',
  'accumulate_wide_s8',
  'accumulate_wide_s16',
  'saturate_narrow_s8',
  'saturate_narrow_s16',
  'transpose_block_s8',
  'transpose_block_s16',
  'reduce_rows_s8',
  'reduce_rows_s16',
];

/* Deliberately not alphabetical: the series order is the author's. */
const PATHS = ['vector path', 'scalar path', 'baseline'];

const rows = KERNELS.flatMap((kernel, index) =>
  PATHS.map((path, seat) => ({
    kernel,
    path,
    speedup: seat === 2 ? 1 : 0.8 + ((index * 3 + seat * 5) % 12),
  })),
);

const base = {
  kind: 'bar',
  data: rows,
  x: 'kernel',
  y: 'speedup',
  series: 'path',
  width: 900,
  height: 640,
  density: 'default',
};

test('a vertical bar chart keeps the categories on the horizontal axis', () => {
  const options = chartPlotOptions({ ...base });
  assert.deepEqual(options.fx.domain, KERNELS);
  assert.equal(options.fy, undefined);
  assert.equal(options.y.label, null);
  assert.equal(options.marginLeft, 42);
});

test('horizontal moves the categories to the vertical axis', () => {
  const options = chartPlotOptions({ ...base, orientation: 'horizontal' });
  assert.deepEqual(options.fy.domain, KERNELS);
  assert.equal(options.fx, undefined);
  /* The measure is on x now, so that is the axis carrying the ticks. */
  assert.equal(options.x.nice, true);
});

test('a horizontal chart takes its left margin from the longest label', () => {
  const options = chartPlotOptions({ ...base, orientation: 'horizontal' });
  const longest = KERNELS.reduce((most, one) => Math.max(most, one.length), 0);
  assert.equal(options.marginLeft, chartCategoryMargin(KERNELS, 900));
  assert.ok(options.marginLeft > longest * 6);
});

test('one runaway label cannot take most of the width', () => {
  assert.equal(chartCategoryMargin(['x'.repeat(400)], 900), 405);
});

test('orientation moves the bars only', () => {
  const options = chartPlotOptions({
    ...base,
    kind: 'line',
    orientation: 'horizontal',
  });
  assert.deepEqual(options.fx, undefined);
  assert.deepEqual(options.fy, undefined);
  assert.equal(options.x.label, null);
});
