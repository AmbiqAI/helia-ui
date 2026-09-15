// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The ECharts theme, as the JSON object `echarts.registerTheme` takes.
 *
 * Every value in it is a `var()` rather than a color, which is the whole
 * reason the candidate can be server-rendered at all: the SVG that goes into
 * the HTML carries the custom properties, so it is already in the reader's
 * theme before any JavaScript runs and it follows the theme toggle afterwards
 * without being redrawn. The SVG renderer is what makes that work -- the
 * canvas renderer parses colors itself and would drop a `var()` on the floor.
 *
 * The font is the token rather than a stack written out here, so the charts
 * are set in whatever the site's `--helia-font-sans` resolves to.
 *
 * `emphasis` states are declared rather than derived for the same reason:
 * ECharts lightens a color for hover by parsing it, which a `var()` defeats,
 * so hover moves opacity and width instead of hue.
 */

const SERIES = [
  'var(--helia-chart-1)',
  'var(--helia-chart-2)',
  'var(--helia-chart-3)',
  'var(--helia-chart-4)',
  'var(--helia-chart-5)',
  'var(--helia-chart-6)',
];

const INK = 'var(--helia-chart-ink)';
const INK_STRONG = 'var(--helia-ink-secondary)';
const GRID = 'var(--helia-chart-grid)';
const SURFACE = 'var(--helia-surface-card)';
const FONT = 'var(--helia-font-sans)';

/* Gridlines are horizontal only and the axis spine is the hairline, the same
   two rules the Astro part follows, so the candidates differ by library and
   not by frame. */
const axis = {
  axisLine: { show: true, lineStyle: { color: GRID } },
  axisTick: { show: false },
  axisLabel: { color: INK, fontSize: 11, fontFamily: FONT },
  splitLine: { show: false },
};

export const HELIA_ECHARTS_THEME = 'helia';

export const heliaEchartsTheme = {
  color: SERIES,
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FONT, color: INK },
  categoryAxis: axis,
  valueAxis: {
    ...axis,
    axisLine: { show: false },
    splitLine: { show: true, lineStyle: { color: GRID, width: 1 } },
  },
  legend: {
    textStyle: { color: INK_STRONG, fontFamily: FONT, fontSize: 11 },
    inactiveColor: GRID,
    itemWidth: 14,
    itemHeight: 3,
    icon: 'roundRect',
  },
  tooltip: {
    backgroundColor: SURFACE,
    borderColor: GRID,
    borderWidth: 1,
    textStyle: { color: 'var(--helia-ink-primary)', fontFamily: FONT },
    axisPointer: { lineStyle: { color: GRID }, crossStyle: { color: GRID } },
  },
  dataZoom: {
    borderColor: GRID,
    fillerColor: 'var(--helia-surface-card-muted)',
    handleStyle: { color: SURFACE, borderColor: INK },
    moveHandleStyle: { color: GRID },
    textStyle: { color: INK, fontFamily: FONT, fontSize: 10 },
    dataBackground: {
      lineStyle: { color: GRID },
      areaStyle: { color: GRID },
    },
  },
  toolbox: {
    iconStyle: { borderColor: INK },
    emphasis: { iconStyle: { borderColor: INK_STRONG } },
  },
  line: { symbolSize: 6, smooth: true },
  bar: { itemStyle: { borderRadius: 2 } },
} as const;
