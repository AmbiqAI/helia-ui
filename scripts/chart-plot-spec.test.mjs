// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The chart spec's arithmetic, asserted on the options rather than on a
 * drawing: which axis the categories landed on, what a log axis ticks at, and
 * the order the bars run in inside a group.
 *
 * The fixture is shaped like the benchmark chart the options were written for
 * -- many categories with long names, three series, ratios spanning more than
 * a decade -- because every one of these decisions was made in that shape and
 * a three-bar fixture would pass them all without exercising any of them.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chartCategoryMargin,
  chartLegendEntries,
  chartLogTicks,
  chartPlotOptions,
  chartValueLabelsFit,
  chartValueScale,
  formatChartValue,
} from '../chart-plot-spec.ts';

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

/* Deliberately not alphabetical: the series order is the author's and the
   chart has to keep it. */
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

test('log ticks run 1, 2 and 5 through each decade', () => {
  assert.deepEqual(chartLogTicks(0.5, 16), [0.5, 1, 2, 5, 10]);
  assert.deepEqual(chartLogTicks(1, 20), [1, 2, 5, 10, 20]);
});

test('log ticks thin to the decades when there are too many', () => {
  assert.deepEqual(chartLogTicks(1, 100000), [1, 10, 100, 1000, 10000, 100000]);
});

test('a log scale rounds its own ends to the tick sequence', () => {
  const scale = chartValueScale(rows, 'speedup', { type: 'log' }, true);
  assert.equal(scale.type, 'log');
  assert.deepEqual(scale.domain, [0.5, 20]);
  assert.deepEqual(scale.ticks, [0.5, 1, 2, 5, 10, 20]);
  assert.equal(scale.warning, undefined);
});

test('the reader can fix either end of a log axis', () => {
  const scale = chartValueScale(
    rows,
    'speedup',
    { type: 'log', min: 0.8, max: 16 },
    true,
  );
  assert.deepEqual(scale.domain, [0.8, 16]);
  assert.deepEqual(scale.ticks, [1, 2, 5, 10]);
});

test('a log axis over a zero is drawn linear and says why', () => {
  const zeroed = [
    { kernel: 'a', speedup: 0 },
    { kernel: 'b', speedup: 4 },
  ];
  const scale = chartValueScale(zeroed, 'speedup', { type: 'log' }, true);
  assert.equal(scale.type, 'linear');
  assert.match(scale.warning, /above zero/);
});

test('a log axis over a negative value is drawn linear', () => {
  const signed = [
    { kernel: 'a', speedup: -2 },
    { kernel: 'b', speedup: 4 },
  ];
  assert.equal(
    chartValueScale(signed, 'speedup', { type: 'log' }, true).type,
    'linear',
  );
});

test('the bars in a group run in series order, not sorted order', () => {
  const options = chartPlotOptions({ ...base });
  assert.deepEqual(options.x.domain, PATHS);
  assert.deepEqual(options.color.domain, PATHS);
  assert.notDeepEqual(PATHS, [...PATHS].sort());
});

test('the legend names the series in the same order as the bands', () => {
  const options = chartPlotOptions({ ...base });
  const entries = chartLegendEntries(
    { data: rows, series: 'path' },
    'auto',
  ).map((entry) => entry.label);
  assert.deepEqual(entries, options.x.domain);
});

test('a horizontal group takes the same band order', () => {
  const options = chartPlotOptions({ ...base, orientation: 'horizontal' });
  assert.deepEqual(options.y.domain, PATHS);
});

test('an axis title is set only where one was asked for', () => {
  const plain = chartPlotOptions({ ...base });
  assert.equal(plain.y.label, null);
  assert.equal(plain.fx.label, null);

  const titled = chartPlotOptions({
    ...base,
    axis: { valueLabel: 'Speedup', categoryLabel: 'Routine' },
  });
  assert.equal(titled.y.label, 'Speedup');
  assert.equal(titled.fx.label, 'Routine');
  /* The titles are drawn outside the plot area, so the margins have to pay. */
  assert.ok(titled.marginTop > plain.marginTop);
  assert.ok(titled.marginBottom > plain.marginBottom);
});

test('a raised floor anchors the bars on it rather than on zero', () => {
  const options = chartPlotOptions({
    ...base,
    scale: { type: 'log', min: 0.5, max: 16 },
  });
  assert.equal(options.y.type, 'log');
  assert.deepEqual(options.y.domain, [0.5, 16]);
  assert.deepEqual(options.y.ticks, [0.5, 1, 2, 5, 10]);
});

test('value labels are dropped when the bands cannot hold them', () => {
  assert.equal(
    chartValueLabelsFit({
      horizontal: true,
      bands: 42,
      extent: 350,
      longest: 4,
    }),
    false,
  );
  assert.equal(
    chartValueLabelsFit({
      horizontal: true,
      bands: 28,
      extent: 480,
      longest: 4,
    }),
    true,
  );
  assert.equal(
    chartValueLabelsFit({
      horizontal: false,
      bands: 42,
      extent: 846,
      longest: 4,
    }),
    false,
  );
});

test('a value is written with enough decimals to tell two apart', () => {
  assert.equal(formatChartValue(0.82), '0.82');
  assert.equal(formatChartValue(12.25), '12.3');
  assert.equal(formatChartValue(1), '1');
  assert.equal(formatChartValue(1200), '1200');
});
