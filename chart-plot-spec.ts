// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * The one description of a HELIA chart, shared by the two lanes that draw it.
 *
 * `astro/Chart.astro` runs this at build against a headless DOM and ships the
 * SVG; `react/chart-plot.tsx` runs it in the browser. Neither owns the mapping
 * from `kind` to marks, because a bar that groups one way on a page and another
 * way in an app is two charts, not one part.
 *
 * Nothing here draws a title, a subtitle, a legend or a caption. Plot would set
 * those in its own type at its own size; the part sets them in HTML so they
 * come off the package type scale like every other heading on the page.
 */
import * as Plot from '@observablehq/plot';

export type ChartKind = 'line' | 'area' | 'bar' | 'scatter' | 'dot';
export type ChartDensity = 'default' | 'compact' | 'comfortable';
export type ChartLegend = 'auto' | 'none';

/** One row of the chart's data. Keys are the `x`, `y` and `series` props. */
export type ChartRecord = Record<string, unknown>;

/**
 * The series palette, as custom properties rather than resolved colors: an
 * SVG that carries `var()` follows the theme toggle without being redrawn,
 * which is the only way a chart rendered at build can change with the theme.
 *
 * Six is the ceiling the tokens define, and it is already generous -- past
 * three or four hues a legend becomes something the reader has to memorise.
 */
export const CHART_SERIES_COLORS = [
  'var(--helia-chart-1)',
  'var(--helia-chart-2)',
  'var(--helia-chart-3)',
  'var(--helia-chart-4)',
  'var(--helia-chart-5)',
  'var(--helia-chart-6)',
] as const;

const CHART_GRID = 'var(--helia-chart-grid)';
const CHART_INK = 'var(--helia-chart-ink)';

/*
 * Plot lays a figure out in pixels, so a build-time render has to pick a width
 * before it knows one. The SVG then scales to whatever box it lands in and
 * keeps this aspect ratio, which is why `width` is part of the contract rather
 * than an implementation detail: pick a width near the one the chart is shown
 * at and the type stays the size it was drawn.
 */
export const CHART_WIDTH = 720;
export const CHART_HEIGHT = 260;

/** Margins and tick counts per density step. */
const FRAME = {
  compact: { top: 8, right: 10, bottom: 24, left: 34, ticks: 4, dot: 3 },
  default: { top: 10, right: 12, bottom: 28, left: 42, ticks: 5, dot: 4 },
  comfortable: { top: 14, right: 16, bottom: 34, left: 52, ticks: 6, dot: 5 },
} as const satisfies Record<
  ChartDensity,
  {
    top: number;
    right: number;
    bottom: number;
    left: number;
    ticks: number;
    dot: number;
  }
>;

const STROKE_WIDTH = 2;
const AREA_FILL_OPACITY = 0.16;

export interface ChartSpec {
  kind: ChartKind;
  data: readonly ChartRecord[];
  /** Key on each record for the horizontal position. */
  x: string;
  /** Key on each record for the vertical position. */
  y: string;
  /** Key whose distinct values split the data into series. */
  series?: string;
  height: number;
  width: number;
  density: ChartDensity;
  /** The DOM Plot builds against. Omitted in the browser, where there is one. */
  document?: Document;
}

/**
 * The distinct values of `series`, in the order the data first mentions them.
 * Plot sorts a categorical domain unless it is given one, and a reader who
 * wrote the rows in a deliberate order meant it.
 */
export function chartSeriesNames(
  data: readonly ChartRecord[],
  series: string | undefined,
): string[] {
  if (!series) return [];
  const names: string[] = [];
  for (const row of data) {
    const value = row[series];
    if (value === undefined || value === null) continue;
    const name = String(value);
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** The distinct values of `x`, in data order. The bar band domain. */
function categories(data: readonly ChartRecord[], x: string): string[] {
  const seen: string[] = [];
  for (const row of data) {
    const name = String(row[x]);
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

/**
 * The legend the part renders, or an empty list when there is nothing to name.
 * A chart with one series has a title that already says what the line is.
 */
export function chartLegendEntries(
  spec: Pick<ChartSpec, 'data' | 'series'>,
  legend: ChartLegend,
): { label: string; color: string }[] {
  if (legend === 'none') return [];
  const names = chartSeriesNames(spec.data, spec.series);
  if (names.length < 2) return [];
  return names.map((label, index) => ({
    label,
    color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
  }));
}

function seriesRange(count: number): string[] {
  return CHART_SERIES_COLORS.slice(0, Math.max(count, 1)).map(String);
}

/**
 * The Plot options for a spec. Axes carry ticks and no titles: the subtitle
 * says what is plotted against what, so an axis title would be the same
 * sentence written twice, once in Plot's type and once in ours.
 */
export function chartPlotOptions(spec: ChartSpec): Plot.PlotOptions {
  const { kind, data, x, y, series, height, width, density } = spec;
  const frame = FRAME[density];
  const names = chartSeriesNames(data, series);
  const rows = data as ChartRecord[];

  /* Gridlines run across the measure, because that is the direction a reader
     compares in. Only a scatter has a measure on both axes, so only a scatter
     gets the second set. */
  const marks: Plot.Markish[] = [
    Plot.gridY({ stroke: CHART_GRID, strokeOpacity: 1 }),
  ];
  if (kind === 'scatter') {
    marks.push(Plot.gridX({ stroke: CHART_GRID, strokeOpacity: 1 }));
  }

  const single = CHART_SERIES_COLORS[0];

  if (kind === 'line') {
    marks.push(
      Plot.lineY(rows, {
        x,
        y,
        stroke: series ?? single,
        strokeWidth: STROKE_WIDTH,
        curve: 'monotone-x',
      }),
    );
  } else if (kind === 'area') {
    marks.push(
      Plot.areaY(rows, {
        x,
        y,
        fill: series ?? single,
        fillOpacity: AREA_FILL_OPACITY,
        curve: 'monotone-x',
      }),
      Plot.lineY(rows, {
        x,
        y,
        stroke: series ?? single,
        strokeWidth: STROKE_WIDTH,
        curve: 'monotone-x',
      }),
      Plot.ruleY([0], { stroke: CHART_GRID }),
    );
  } else if (kind === 'bar') {
    /* Grouped bars are a facet per category with the series inside it, which
       is what puts the category labels under the group rather than under every
       bar in it. Without a series there is nothing to group and the band is
       the category itself. */
    marks.push(
      Plot.barY(rows, {
        x: series ?? x,
        y,
        fx: series ? x : undefined,
        fill: series ?? single,
      }),
      Plot.ruleY([0], { stroke: CHART_GRID }),
    );
  } else {
    marks.push(
      Plot.dot(rows, {
        x,
        y,
        fill: series ?? single,
        r: frame.dot,
        stroke: 'none',
      }),
    );
  }

  const grouped = kind === 'bar' && Boolean(series);

  return {
    document: spec.document,
    width,
    height,
    marginTop: frame.top,
    marginRight: frame.right,
    marginBottom: frame.bottom,
    marginLeft: frame.left,
    /* A stable class rather than the hash Plot derives from the style: two
       charts drawn the same way should produce the same markup, so a build is
       reproducible and a diff of the output is readable. */
    className: 'helia-plot',
    style: {
      background: 'transparent',
      color: CHART_INK,
      fontFamily: 'var(--helia-font-sans)',
    },
    x: grouped
      ? { axis: null }
      : {
          label: null,
          ...(kind === 'bar' ? { domain: categories(rows, x) } : {}),
        },
    fx: grouped ? { label: null, domain: categories(rows, x) } : undefined,
    y: { label: null, ticks: frame.ticks, nice: true },
    color: series
      ? { domain: names, range: seriesRange(names.length) }
      : undefined,
    marks,
  } satisfies Plot.PlotOptions & { document?: Document };
}

/*
 * `var()` in a presentation attribute is a CSS declaration by specification,
 * but an inline style is the form every engine has substituted for years, and
 * a chart whose series render black on one browser is not worth the smaller
 * markup. The move is safe because Plot writes no inline styles of its own
 * below the root.
 */
const THEMED_ATTRIBUTES = ['fill', 'stroke', 'color'];

/** Rewrites the `var()` colors Plot set as attributes into inline styles. */
export function inlineChartColors(root: Element): void {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    for (const name of THEMED_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (!value || !value.includes('var(')) continue;
      element.removeAttribute(name);
      const existing = element.getAttribute('style');
      const declaration = `${name}: ${value}`;
      element.setAttribute(
        'style',
        existing ? `${existing};${declaration}` : declaration,
      );
    }
  }
}

/**
 * Names the figure for assistive technology, as one image.
 *
 * A screen reader reading out eleven axis ticks is reading noise, so the whole
 * SVG is a single labeled image and nothing inside it carries ARIA. Plot
 * labels its mark and axis groups, which is a prohibited attribute on a `g`
 * with no role; the labels move to `data-plot-label`, where the stylesheet can
 * still find the gridlines and the accessibility tree cannot see them.
 */
export function labelChartSvg(
  svg: Element,
  title: string,
  subtitle?: string,
): void {
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', subtitle ? `${title}. ${subtitle}` : title);
  for (const element of Array.from(svg.querySelectorAll('[aria-label]'))) {
    const label = element.getAttribute('aria-label');
    element.removeAttribute('aria-label');
    if (label) element.setAttribute('data-plot-label', label);
  }
}
