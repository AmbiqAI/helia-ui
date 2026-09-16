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
export type ChartOrientation = 'vertical' | 'horizontal';
export type ChartScaleType = 'linear' | 'log';

/**
 * The value axis: the measure, wherever the orientation has put it.
 *
 * `min` and `max` are the reader's, not the data's. Given neither, a linear
 * axis is still anchored at zero and nicely rounded, because a bar read
 * against a floating baseline lies.
 */
export interface ChartScale {
  type: ChartScaleType;
  min?: number;
  max?: number;
}

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

/*
 * Plot lays out at font-size 10 and the stylesheet sets the tick type from
 * `--helia-text-label`, which is larger. The left margin a category label needs
 * is measured at the drawn size rather than Plot's, so a label that fits by
 * this arithmetic fits on the page.
 */
const TICK_CHAR_WIDTH = 6.6;
/** Gap between the longest category label and the plot area. */
const CATEGORY_LABEL_GAP = 12;
/** The share of the width the category labels may take before they are cut. */
const CATEGORY_MARGIN_SHARE = 0.45;
/** Beyond this many, log ticks are thinned to the decades. */
const MAX_LOG_TICKS = 10;
/** The 1, 2, 5 sequence a log axis is read in. */
const LOG_STEPS = [1, 2, 5];

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
  /** Which way the bars run. `horizontal` puts the categories on the y axis. */
  orientation?: ChartOrientation;
  /** The measure's scale. Linear and anchored at zero when unset. */
  scale?: ChartScale;
  /** How a value is written, on a titled or logarithmic axis. */
  valueFormat?: (value: number) => string;
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
 * How a number is written when the spec does not say: enough decimals to tell
 * two neighboring values apart, and none that are only zeros.
 */
export function formatChartValue(value: number): string {
  const size = Math.abs(value);
  const digits = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  const written = value.toFixed(digits);
  return written.includes('.') ? written.replace(/\.?0+$/, '') : written;
}

/** The finite values of `key`, in data order. */
function measures(data: readonly ChartRecord[], key: string): number[] {
  const found: number[] = [];
  for (const row of data) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) found.push(value);
  }
  return found;
}

/* Floating point makes 5e-2 a number with a tail, and a tick labeled
   0.05000000000000001 is worse than any rounding this could hide. */
function exact(value: number): number {
  return Number(value.toPrecision(12));
}

/** The 1, 2 or 5 step at or below `value`, or at or above it. */
function logStep(value: number, direction: 'down' | 'up'): number {
  const decade = Math.pow(10, Math.floor(Math.log10(value)));
  const position = value / decade;
  if (direction === 'down') {
    const step = [...LOG_STEPS].reverse().find((one) => one <= position + 1e-9);
    return exact((step ?? 1) * decade);
  }
  const step = LOG_STEPS.find((one) => one >= position - 1e-9);
  return exact((step ?? 10) * decade);
}

/**
 * The ticks a log axis is read at: 1, 2 and 5 in every decade it spans, thinned
 * to the decades alone once there are more of them than a reader will follow.
 */
export function chartLogTicks(min: number, max: number): number[] {
  if (!(min > 0) || !(max > min)) return [];
  const first = Math.floor(Math.log10(min));
  const last = Math.ceil(Math.log10(max));
  const ticks: number[] = [];
  for (let decade = first; decade <= last; decade += 1) {
    for (const step of LOG_STEPS) {
      const tick = exact(step * Math.pow(10, decade));
      if (tick >= min * (1 - 1e-9) && tick <= max * (1 + 1e-9))
        ticks.push(tick);
    }
  }
  if (ticks.length <= MAX_LOG_TICKS) return ticks;
  return ticks.filter((tick) => {
    const decade = Math.log10(tick);
    return Math.abs(decade - Math.round(decade)) < 1e-9;
  });
}

/** A value scale resolved against the data: what Plot and ECharts both need. */
export interface ChartValueScale {
  type: ChartScaleType;
  /** Set when the reader or the scale type fixed an end of the axis. */
  domain?: [number, number];
  /** The tick values, when the scale type chose them. */
  ticks?: number[];
  /** Why a log axis was refused, for the build log. Set only on a fallback. */
  warning?: string;
}

/**
 * Resolves the value axis.
 *
 * A log scale cannot draw a zero and has no sign, so data that reaches either
 * is drawn linear instead and the caller is told why. Refusing to draw at all
 * would lose a chart over an axis option, and drawing a log axis over a series
 * with a zero in it silently drops the row.
 */
export function chartValueScale(
  data: readonly ChartRecord[],
  key: string,
  scale: ChartScale | undefined,
  zeroBaseline: boolean,
): ChartValueScale {
  const values = measures(data, key);
  const low = values.length > 0 ? Math.min(...values) : 0;
  const high = values.length > 0 ? Math.max(...values) : 1;

  const linear = (warning?: string): ChartValueScale => {
    if (scale?.min === undefined && scale?.max === undefined) {
      return { type: 'linear', ...(warning ? { warning } : {}) };
    }
    const floor = scale.min ?? (zeroBaseline ? Math.min(0, low) : low);
    return {
      type: 'linear',
      domain: [floor, scale.max ?? high],
      ...(warning ? { warning } : {}),
    };
  };

  if (scale?.type !== 'log') return linear();

  const nonPositive = values.some((value) => value <= 0);
  const floor = scale.min ?? (low > 0 ? logStep(low, 'down') : 0);
  if (nonPositive || !(floor > 0)) {
    return linear(
      `chart: a logarithmic ${key} axis needs every value above zero; drawing it linear instead.`,
    );
  }
  const ceiling = scale.max ?? logStep(high, 'up');
  return {
    type: 'log',
    domain: [floor, ceiling],
    ticks: chartLogTicks(floor, ceiling),
  };
}

/**
 * The left margin a horizontal chart's category labels need, from the longest
 * of them. Capped: one runaway label should cost the plot area some of its
 * width, not most of it.
 */
export function chartCategoryMargin(
  labels: readonly string[],
  width: number,
): number {
  const longest = labels.reduce(
    (most, label) => Math.max(most, label.length),
    0,
  );
  const wanted = Math.ceil(longest * TICK_CHAR_WIDTH) + CATEGORY_LABEL_GAP;
  return Math.min(wanted, Math.floor(width * CATEGORY_MARGIN_SHARE));
}

/**
 * The Plot options for a spec. Axes carry ticks and no titles: the subtitle
 * says what is plotted against what, so an axis title would be the same
 * sentence written twice, once in Plot's type and once in ours.
 *
 * `x`, `y` and `series` stay the keys they always were. `orientation` moves the
 * drawing, not the data contract: a horizontal bar chart still names its
 * categories with `x` and its measure with `y`.
 */
export function chartPlotOptions(spec: ChartSpec): Plot.PlotOptions {
  const {
    kind,
    data,
    x,
    y,
    series,
    height,
    width,
    density,
    orientation = 'vertical',
    scale,
    valueFormat,
  } = spec;
  const frame = FRAME[density];
  const names = chartSeriesNames(data, series);
  const rows = data as ChartRecord[];
  const bars = kind === 'bar';
  /* Only bars turn: a line or an area plots a measure against a run, and a run
     that reads bottom to top is a chart nobody asked for. */
  const horizontal = bars && orientation === 'horizontal';
  const grouped = bars && Boolean(series);
  const bands = categories(rows, x);

  const value = chartValueScale(rows, y, scale, bars || kind === 'area');
  /* The build log is where this belongs: the page still draws, and the author
     is the only one who can decide whether linear was acceptable. */
  if (value.warning) console.warn(value.warning);
  const baseline = value.domain ? value.domain[0] : 0;
  /* A bar on a log axis has no zero to stand on, and one on a raised linear
     floor would be drawn from a baseline that is not on the chart. Both start
     at the bottom of the axis instead. */
  const anchored = bars && baseline !== 0;

  const marginLeft = horizontal
    ? chartCategoryMargin(bands, width)
    : frame.left;

  /* Gridlines run across the measure, because that is the direction a reader
     compares in. Only a scatter has a measure on both axes, so only a scatter
     gets the second set. */
  const grid = { stroke: CHART_GRID, strokeOpacity: 1 };
  const marks: Plot.Markish[] = [
    horizontal ? Plot.gridX(grid) : Plot.gridY(grid),
  ];
  if (kind === 'scatter') {
    marks.push(Plot.gridX(grid));
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
       is what puts the category labels beside the group rather than beside
       every bar in it. Without a series there is nothing to group and the band
       is the category itself. */
    const band = series ?? x;
    const facet = series ? x : undefined;
    marks.push(
      horizontal
        ? Plot.barX(rows, {
            y: band,
            fy: facet,
            ...(anchored ? { x1: baseline, x2: y } : { x: y }),
            fill: series ?? single,
          })
        : Plot.barY(rows, {
            x: band,
            fx: facet,
            ...(anchored ? { y1: baseline, y2: y } : { y }),
            fill: series ?? single,
          }),
      horizontal
        ? Plot.ruleX([baseline], { stroke: CHART_GRID })
        : Plot.ruleY([baseline], { stroke: CHART_GRID }),
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

  const innerBand = { axis: null };
  const categoryScale = {
    label: null,
    ...(bars ? { domain: bands } : {}),
  };
  const valueScale = {
    label: null,
    ...(value.type === 'log' ? { type: 'log' as const } : {}),
    ...(value.domain ? { domain: value.domain } : { nice: true }),
    ticks: value.ticks ?? frame.ticks,
    ...(valueFormat ? { tickFormat: valueFormat } : {}),
  };

  return {
    document: spec.document,
    width,
    height,
    marginTop: frame.top,
    marginRight: frame.right,
    marginBottom: frame.bottom,
    marginLeft,
    /* A stable class rather than the hash Plot derives from the style: two
       charts drawn the same way should produce the same markup, so a build is
       reproducible and a diff of the output is readable. */
    className: 'helia-plot',
    style: {
      background: 'transparent',
      color: CHART_INK,
      fontFamily: 'var(--helia-font-sans)',
    },
    x: horizontal ? valueScale : grouped ? innerBand : categoryScale,
    fx: !horizontal && grouped ? categoryScale : undefined,
    y: horizontal ? (grouped ? innerBand : categoryScale) : valueScale,
    fy: horizontal && grouped ? categoryScale : undefined,
    color: series
      ? { domain: names, range: seriesRange(names.length) }
      : undefined,
    marks,
  } satisfies Plot.PlotOptions & { document?: Document };
}

/** The default box a sparkline is laid out in: a control, not a figure. */
export const SPARKLINE_WIDTH = 120;
export const SPARKLINE_HEIGHT = 32;

export type SparklineKind = 'line' | 'area';

const SPARKLINE_STROKE_WIDTH = 1.5;
const SPARKLINE_MARKER_RADIUS = 2.5;
/* Room for the stroke and the end marker, which are drawn on the frame edge
   and would otherwise be halved by it. */
const SPARKLINE_INSET = 3;

export interface SparklineSpec {
  kind: SparklineKind;
  /** The series, in order. The index is the horizontal position. */
  values: readonly number[];
  width: number;
  height: number;
  /** The one series color, as a `var()` so the drawing follows the theme. */
  color: string;
  /** Draws a dot on the last point. */
  marker: boolean;
  /** The DOM Plot builds against. Omitted in the browser, where there is one. */
  document?: Document;
}

/**
 * The Plot options for a sparkline: one series, no axes, no gridlines.
 *
 * The vertical domain is the data's own extent rather than a zero baseline. A
 * sparkline is read for shape and not for level -- it has no axis to read a
 * level off -- and anchoring at zero flattens a series that moves inside a
 * narrow band, which is the series a sparkline is usually there to show.
 */
export function sparklinePlotOptions(spec: SparklineSpec): Plot.PlotOptions {
  const { kind, values, width, height, color, marker } = spec;
  const points = values.map((value, index) => ({ index, value }));
  const min = points.length > 0 ? Math.min(...values) : 0;
  const max = points.length > 0 ? Math.max(...values) : 0;
  /* A flat series has no extent to scale into, so it is given one and draws
     down the middle of the box rather than on its floor. */
  const domain: [number, number] =
    min === max ? [min - 1, max + 1] : [min, max];

  const marks: Plot.Markish[] = [];
  if (kind === 'area') {
    marks.push(
      Plot.areaY(points, {
        x: 'index',
        y: 'value',
        fill: color,
        fillOpacity: AREA_FILL_OPACITY,
        curve: 'monotone-x',
      }),
    );
  }
  marks.push(
    Plot.lineY(points, {
      x: 'index',
      y: 'value',
      stroke: color,
      strokeWidth: SPARKLINE_STROKE_WIDTH,
      curve: 'monotone-x',
    }),
  );
  if (marker && points.length > 0) {
    marks.push(
      Plot.dot([points[points.length - 1]], {
        x: 'index',
        y: 'value',
        fill: color,
        r: SPARKLINE_MARKER_RADIUS,
        stroke: 'none',
      }),
    );
  }

  return {
    document: spec.document,
    width,
    height,
    marginTop: SPARKLINE_INSET,
    marginRight: SPARKLINE_INSET,
    marginBottom: SPARKLINE_INSET,
    marginLeft: SPARKLINE_INSET,
    className: 'helia-sparkline-plot',
    style: { background: 'transparent' },
    x: { axis: null },
    y: { axis: null, domain },
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
