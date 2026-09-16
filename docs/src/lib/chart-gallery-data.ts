// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The one dataset behind every chart in the gallery's Charts section.
 *
 * Each series is long-format -- one row per point, with the series name on the
 * row -- because that is the shape `Chart` takes: `x`, `y` and `series` are
 * keys, so a chart with two lines is one array and not two.
 *
 * Every number here is invented, and the subject is this documentation site
 * rather than any part: a gallery exists to show a chart drawing, and a figure
 * on it would be read as a measurement by someone who did not come for the
 * chart.
 */

export interface TrafficPoint {
  /** Week of the quarter, 1-12. */
  week: number;
  /** Page views that week. */
  views: number;
  /** Which section of the site. */
  section: string;
}

export interface BuildPoint {
  /** Build stage. */
  stage: string;
  /** Wall-clock seconds for the stage. */
  seconds: number;
  /** Which build profile. */
  profile: string;
}

export interface PagePoint {
  /** Week of the quarter, 1-12. */
  week: number;
  /** Pages published to that point. */
  pages: number;
}

export interface WeightPoint {
  /** Transferred bytes, in kilobytes. */
  transferKb: number;
  /** Lighthouse performance score. */
  score: number;
  /** Which page template. */
  template: string;
}

/** Two sections over a quarter. The line chart, and the first of the group. */
export const trafficSeries: TrafficPoint[] = [
  { week: 1, views: 820, section: 'Guides' },
  { week: 2, views: 910, section: 'Guides' },
  { week: 3, views: 1040, section: 'Guides' },
  { week: 4, views: 1180, section: 'Guides' },
  { week: 5, views: 1155, section: 'Guides' },
  { week: 6, views: 1290, section: 'Guides' },
  { week: 7, views: 1425, section: 'Guides' },
  { week: 8, views: 1510, section: 'Guides' },
  { week: 9, views: 1640, section: 'Guides' },
  { week: 10, views: 1725, section: 'Guides' },
  { week: 11, views: 1810, section: 'Guides' },
  { week: 12, views: 1960, section: 'Guides' },
  { week: 1, views: 540, section: 'Reference' },
  { week: 2, views: 585, section: 'Reference' },
  { week: 3, views: 640, section: 'Reference' },
  { week: 4, views: 705, section: 'Reference' },
  { week: 5, views: 760, section: 'Reference' },
  { week: 6, views: 840, section: 'Reference' },
  { week: 7, views: 905, section: 'Reference' },
  { week: 8, views: 1015, section: 'Reference' },
  { week: 9, views: 1120, section: 'Reference' },
  { week: 10, views: 1240, section: 'Reference' },
  { week: 11, views: 1385, section: 'Reference' },
  { week: 12, views: 1540, section: 'Reference' },
];

/** Four stages, two profiles. The grouped bar chart. */
export const buildSeries: BuildPoint[] = [
  { stage: 'Install', seconds: 42, profile: 'Cold' },
  { stage: 'Generate', seconds: 11, profile: 'Cold' },
  { stage: 'Build', seconds: 96, profile: 'Cold' },
  { stage: 'Assert', seconds: 18, profile: 'Cold' },
  { stage: 'Install', seconds: 6, profile: 'Warm' },
  { stage: 'Generate', seconds: 9, profile: 'Warm' },
  { stage: 'Build', seconds: 54, profile: 'Warm' },
  { stage: 'Assert', seconds: 17, profile: 'Warm' },
];

/** One series over the same quarter. The area chart. */
export const pagesSeries: PagePoint[] = [
  { week: 1, pages: 18 },
  { week: 2, pages: 21 },
  { week: 3, pages: 21 },
  { week: 4, pages: 26 },
  { week: 5, pages: 29 },
  { week: 6, pages: 33 },
  { week: 7, pages: 34 },
  { week: 8, pages: 39 },
  { week: 9, pages: 44 },
  { week: 10, pages: 46 },
  { week: 11, pages: 51 },
  { week: 12, pages: 57 },
];

/** Two templates, a measure on both axes. The scatter. */
export const weightSeries: WeightPoint[] = [
  { transferKb: 92, score: 99, template: 'Static' },
  { transferKb: 118, score: 98, template: 'Static' },
  { transferKb: 141, score: 97, template: 'Static' },
  { transferKb: 176, score: 95, template: 'Static' },
  { transferKb: 204, score: 94, template: 'Static' },
  { transferKb: 238, score: 92, template: 'Static' },
  { transferKb: 264, score: 91, template: 'Island' },
  { transferKb: 312, score: 88, template: 'Island' },
  { transferKb: 358, score: 86, template: 'Island' },
  { transferKb: 402, score: 83, template: 'Island' },
  { transferKb: 471, score: 79, template: 'Island' },
  { transferKb: 528, score: 76, template: 'Island' },
];

/*
 * A benchmark-shaped set: many categories with names too long to sit under a
 * bar, three series, and a measure spanning more than a decade. It is the
 * shape the orientation option was written for, so it is the shape the gallery
 * shows it in.
 *
 * The routines are invented and so are the ratios. Nothing here is a
 * measurement of anything, and no routine named below exists.
 */

export interface RoutinePoint {
  /** Invented routine name, long enough to need a horizontal axis. */
  routine: string;
  /** Which code path ran it. */
  path: string;
  /** Times faster than the reference path. */
  speedup: number;
}

const ROUTINES = [
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

const VECTOR_SPEEDUPS = [
  11.8, 4.2, 9.4, 3.1, 6.7, 2.4, 12, 5.3, 8.1, 2.9, 7.4, 3.6, 10.2, 4.8,
];

const SCALAR_SPEEDUPS = [
  1.6, 0.9, 2.1, 1.2, 1.8, 0.8, 2.4, 1.1, 1.9, 1.3, 2.2, 0.95, 1.7, 1.4,
];

/*
 * Three series, written in the order the chart should read them rather than
 * the order they sort in: the fastest path first and the baseline last.
 */
export const routineSpeedups: RoutinePoint[] = ROUTINES.flatMap(
  (routine, index) => [
    { routine, path: 'vector path', speedup: VECTOR_SPEEDUPS[index] },
    { routine, path: 'scalar path', speedup: SCALAR_SPEEDUPS[index] },
    { routine, path: 'reference', speedup: 1 },
  ],
);
