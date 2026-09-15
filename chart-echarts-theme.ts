// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The ECharts theme, as the object `echarts.registerTheme` takes, built from
 * the chart tokens the Plot parts already draw with.
 *
 * The values are read out of the cascade rather than passed through as `var()`
 * strings. A `var()` survives the SVG renderer, which writes the attribute out
 * untouched, but the canvas renderer parses every color itself and would drop
 * it on the floor. Reading makes one theme serve both renderers, at the price
 * of having to read again when the theme flips, which is what the palette key
 * is for.
 *
 * Reading from the chart's own element rather than the document root is
 * deliberate: a band or a card may carry its own face, and a chart inside one
 * should take that face rather than the page's.
 *
 * `emphasis` states are declared rather than derived. ECharts lightens a color
 * for hover by parsing it, and the tokens are already tuned per theme, so
 * hover moves width and opacity instead of hue.
 */

/** The name the theme is registered under. */
export const HELIA_ECHARTS_THEME = 'helia';

export interface ChartEchartsPalette {
  /** The six series colors, in order. */
  series: string[];
  /** Axis labels and other quiet type. */
  ink: string;
  /** Legend and hover type, a step stronger than `ink`. */
  inkStrong: string;
  /** Gridlines, axis spines and borders. */
  grid: string;
  /** The tooltip and zoom handle fill. */
  surface: string;
  /** The zoom window fill. */
  surfaceMuted: string;
  /** The font stack the chart is set in. */
  font: string;
}

const SERIES_TOKENS = [
  '--helia-chart-1',
  '--helia-chart-2',
  '--helia-chart-3',
  '--helia-chart-4',
  '--helia-chart-5',
  '--helia-chart-6',
];

const AXIS_LABEL_SIZE = 11;
const LEGEND_LABEL_SIZE = 11;
const ZOOM_LABEL_SIZE = 10;

/* Where the value cannot be read -- no document, or a token the consuming site
   has not defined -- the `var()` itself is the answer. It is wrong only for the
   canvas renderer, and a site without the tokens has a bigger problem than its
   charts. */
function token(style: CSSStyleDeclaration | null, name: string): string {
  const value = style?.getPropertyValue(name).trim();
  return value ? value : `var(${name})`;
}

/**
 * Resolves the chart tokens against `node`, or against the document root when
 * none is given. Outside the browser every entry comes back as its `var()`.
 */
export function readChartEchartsPalette(node?: Element): ChartEchartsPalette {
  const target =
    node ?? (typeof document === 'undefined' ? null : document.documentElement);
  const style = target ? getComputedStyle(target) : null;
  return {
    series: SERIES_TOKENS.map((name) => token(style, name)),
    ink: token(style, '--helia-chart-ink'),
    inkStrong: token(style, '--helia-ink-secondary'),
    grid: token(style, '--helia-chart-grid'),
    surface: token(style, '--helia-surface-card'),
    surfaceMuted: token(style, '--helia-surface-card-muted'),
    font: token(style, '--helia-font-sans'),
  };
}

/**
 * A string that changes when any token in the palette changes. Callers compare
 * it to decide whether the registered theme is still the right one.
 */
export function chartEchartsPaletteKey(palette: ChartEchartsPalette): string {
  return [
    ...palette.series,
    palette.ink,
    palette.inkStrong,
    palette.grid,
    palette.surface,
    palette.surfaceMuted,
    palette.font,
  ].join('|');
}

/** Builds the theme object for a palette. */
export function chartEchartsTheme(
  palette: ChartEchartsPalette,
): Record<string, unknown> {
  /* Gridlines run across the measure and the axis spine is the hairline, the
     same two rules the Astro part follows, so a static figure and an
     interactive one read as the same chart. */
  const axis = {
    axisLine: { show: true, lineStyle: { color: palette.grid } },
    axisTick: { show: false },
    axisLabel: {
      color: palette.ink,
      fontSize: AXIS_LABEL_SIZE,
      fontFamily: palette.font,
    },
    splitLine: { show: false },
  };

  return {
    color: palette.series,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: palette.font, color: palette.ink },
    categoryAxis: axis,
    valueAxis: {
      ...axis,
      axisLine: { show: false },
      splitLine: { show: true, lineStyle: { color: palette.grid, width: 1 } },
    },
    legend: {
      textStyle: {
        color: palette.inkStrong,
        fontFamily: palette.font,
        fontSize: LEGEND_LABEL_SIZE,
      },
      inactiveColor: palette.grid,
      itemWidth: 14,
      itemHeight: 3,
      icon: 'roundRect',
    },
    tooltip: {
      backgroundColor: palette.surface,
      borderColor: palette.grid,
      borderWidth: 1,
      textStyle: { color: palette.inkStrong, fontFamily: palette.font },
      axisPointer: {
        lineStyle: { color: palette.grid },
        crossStyle: { color: palette.grid },
      },
    },
    dataZoom: {
      borderColor: palette.grid,
      fillerColor: palette.surfaceMuted,
      handleStyle: { color: palette.surface, borderColor: palette.ink },
      moveHandleStyle: { color: palette.grid },
      textStyle: {
        color: palette.ink,
        fontFamily: palette.font,
        fontSize: ZOOM_LABEL_SIZE,
      },
      dataBackground: {
        lineStyle: { color: palette.grid },
        areaStyle: { color: palette.grid },
      },
    },
    toolbox: {
      iconStyle: { borderColor: palette.ink },
      emphasis: { iconStyle: { borderColor: palette.inkStrong } },
    },
    line: { symbolSize: 6, smooth: true },
    bar: { itemStyle: { borderRadius: 2 } },
  };
}
