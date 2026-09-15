// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Apache ECharts drawing the shared dataset, with the interactions the other
 * three candidates do not have.
 *
 * Two things are being shown here rather than one. The first is the figure:
 * the same three charts, themed through `heliaEchartsTheme`, so the row can be
 * read against the rows above it. The second is what an interactive library
 * costs and gives -- a tooltip on hover, a legend that toggles a series, a
 * zoom on the line, a brush over the scatter -- which none of the others
 * offer without being written by hand.
 *
 * The figure in the HTML is ECharts' own SSR output. `echarts.init(null, ...)`
 * with `ssr: true` lays a chart out with no document at all, so the build can
 * write the SVG into the page and the island's job on mount is to replace a
 * picture with an instance. That replacement is the honest cost of the
 * interactions: the server render is the chart, not the chart's behavior.
 *
 * The imports are the tree-shaking entry points rather than the `echarts`
 * barrel, because the byte figure in the facts table has to be the one a site
 * would actually ship.
 */
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  BrushComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

import {
  accuracyFraming,
  accuracySeries,
  energyFraming,
  energySeries,
  latencyFraming,
  latencySeries,
  seriesLabels,
  type ChartFraming,
} from '../lib/chart-data';
import {
  HELIA_ECHARTS_THEME,
  heliaEchartsTheme,
} from '../lib/chart-echarts-theme';
import { CandidateRow, ChartPanel } from './chart-candidate-frame';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  BrushComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
  SVGRenderer,
]);
echarts.registerTheme(HELIA_ECHARTS_THEME, heliaEchartsTheme);

type Option = Parameters<echarts.ECharts['setOption']>[0];

/* The width the build lays the figure out at. The SVG carries a viewBox and is
   stretched to the panel, so this only has to be close enough that the type
   arrives at the right size; the instance that replaces it measures for real. */
const SSR_WIDTH = 380;
const SSR_HEIGHT = 208;

/* Room under the plot for the zoom slider, and enough on the left for the
   tick labels at this size. */
const GRID = { top: 32, right: 12, bottom: 44, left: 40 };
const GRID_PLAIN = { ...GRID, bottom: 28 };

const legend = { top: 0, left: 0, itemGap: 16 };

const latencyOption: Option = {
  grid: GRID,
  legend,
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: latencySeries.map((point) => String(point.inputLength)),
    boundaryGap: false,
  },
  yAxis: { type: 'value' },
  /* Both, because they answer different questions: the slider says where in
     the series the view is, and the wheel is how anyone actually zooms. */
  dataZoom: [
    { type: 'inside' },
    { type: 'slider', height: 14, bottom: 6, showDetail: false },
  ],
  series: [
    {
      name: seriesLabels.heliaRT,
      type: 'line',
      data: latencySeries.map((point) => point.heliaRT),
      emphasis: { lineStyle: { width: 3 } },
    },
    {
      name: seriesLabels.heliaAOT,
      type: 'line',
      data: latencySeries.map((point) => point.heliaAOT),
      emphasis: { lineStyle: { width: 3 } },
    },
  ],
};

const energyOption: Option = {
  grid: GRID_PLAIN,
  legend,
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  xAxis: { type: 'category', data: energySeries.map((point) => point.target) },
  yAxis: { type: 'value' },
  series: [
    {
      name: seriesLabels.heliaRT,
      type: 'bar',
      data: energySeries.map((point) => point.heliaRT),
    },
    {
      name: seriesLabels.baseline,
      type: 'bar',
      data: energySeries.map((point) => point.baseline),
    },
  ],
};

const accuracyOption: Option = {
  grid: GRID_PLAIN,
  legend,
  tooltip: { trigger: 'item' },
  toolbox: {
    right: 0,
    top: 0,
    feature: { brush: { type: ['rect', 'clear'] } },
  },
  /* Selection, which is the interaction the other three have no answer to at
     all: drag a rectangle and the marks outside it drop back. */
  brush: { xAxisIndex: 0, brushMode: 'single', throttleType: 'debounce' },
  xAxis: { type: 'value', scale: true },
  yAxis: { type: 'value', min: 86, max: 96 },
  series: (['int8', 'fp16'] as const).map((precision) => ({
    name: seriesLabels[precision],
    type: 'scatter' as const,
    symbolSize: 9,
    data: accuracySeries
      .filter((point) => point.precision === precision)
      .map((point) => [point.sizeMb, point.accuracy]),
  })),
};

/**
 * The figure as the build writes it: no document, no animation, and the
 * emitted size swapped for the panel's so the SVG scales to whatever box it
 * lands in.
 */
function serverSvg(option: Option): string {
  if (typeof document !== 'undefined') return '';
  const chart = echarts.init(null, HELIA_ECHARTS_THEME, {
    renderer: 'svg',
    ssr: true,
    width: SSR_WIDTH,
    height: SSR_HEIGHT,
  });
  chart.setOption({ ...option, animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg.replace(
    `<svg width="${SSR_WIDTH}" height="${SSR_HEIGHT}"`,
    '<svg width="100%" height="100%"',
  );
}

function EChartsPanel({
  framing,
  option,
}: {
  framing: ChartFraming;
  option: Option;
}) {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    /* The build's SVG goes first: `init` would otherwise mount the instance
       beside it and the panel would hold two figures. */
    node.replaceChildren();
    const chart = echarts.init(node, HELIA_ECHARTS_THEME, { renderer: 'svg' });
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(node);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return (
    <ChartPanel framing={framing}>
      <div
        ref={host}
        className="h-full w-full"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serverSvg(option) }}
      />
    </ChartPanel>
  );
}

export default function ChartCandidateECharts() {
  return (
    <CandidateRow library="echarts">
      <EChartsPanel framing={latencyFraming} option={latencyOption} />
      <EChartsPanel framing={energyFraming} option={energyOption} />
      <EChartsPanel framing={accuracyFraming} option={accuracyOption} />
    </CandidateRow>
  );
}
