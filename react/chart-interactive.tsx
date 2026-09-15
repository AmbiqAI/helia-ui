// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * The interactive chart: the data contract of the `Chart` parts, drawn by
 * Apache ECharts so the reader can hover, zoom, toggle a series and select.
 *
 * Observable Plot stays the static layer. `astro/Chart.astro` ships a figure
 * and no JavaScript at all and `react/chart-plot.tsx` redraws one in the
 * browser; both are cheaper than this. Reach for this part only when an
 * interaction is the point, because it costs an island and a charting library.
 * See AmbiqAI/helia-ui#50.
 *
 * The frame is this file's HTML rather than ECharts': the title, subtitle,
 * legend and caption are the same elements and the same classes the Plot parts
 * use, so the two layers are one figure drawn two ways, and ECharts is handed
 * the plot area alone. The legend has a second reason to be HTML -- a button
 * carries its pressed state to a screen reader and a drawn legend carries
 * nothing -- and ECharts still owns which series are selected, so the toggle
 * is a dispatch rather than a second source of truth.
 *
 * The imports are the tree-shaken entry points rather than the `echarts`
 * barrel, and the canvas renderer is fetched only when it is asked for, so the
 * default island carries the SVG renderer alone.
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
import * as React from 'react';

import {
  chartLegendEntries,
  chartSeriesNames,
  type ChartKind,
  type ChartLegend,
  type ChartRecord,
} from '../chart-plot-spec';
import {
  chartEchartsPaletteKey,
  chartEchartsTheme,
  readChartEchartsPalette,
  HELIA_ECHARTS_THEME,
} from '../chart-echarts-theme';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  BrushComponent,
  DataZoomComponent,
  GridComponent,
  /* Registered even though the drawn legend is switched off: `legendSelect`
     and the option's `selected` map are the legend component's, and the HTML
     toggle goes through them. */
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
  SVGRenderer,
]);

type Option = Parameters<echarts.ECharts['setOption']>[0];

/** Where the reader can move the view. */
export type ChartZoom = 'none' | 'inside' | 'slider';

/** Which of the two renderers draws the plot area. */
export type ChartRenderer = 'svg' | 'canvas';

const CHART_ASPECT = 'var(--helia-chart-aspect, 16 / 9)';
const CHART_MIN_HEIGHT = 'var(--helia-chart-min-height, 10rem)';

/* Outer padding only: `containLabel` measures the ticks, so these do not have
   to be guessed from the longest label. The slider is the one thing that needs
   room reserved for it. */
const GRID = { top: 8, right: 12, bottom: 4, left: 4, containLabel: true };
const ZOOM_SLIDER = {
  type: 'slider',
  height: 14,
  bottom: 6,
  showDetail: false,
};
const ZOOM_SLIDER_ROOM = 30;

export interface ChartInteractiveProps {
  /** The chart's heading. Also the accessible name of the plot area. */
  title: string;
  /** What is plotted against what. Stands in for the axis titles. */
  subtitle?: string;
  /** A note under the chart: provenance, units, a caveat. */
  caption?: string;
  /** Which marks to draw. */
  kind?: ChartKind;
  /** The rows. Every row carries the `x`, `y` and `series` keys. */
  data: readonly ChartRecord[];
  /** Key on each row for the horizontal position. */
  x: string;
  /** Key on each row for the vertical position. */
  y: string;
  /** Key whose distinct values split the rows into series. */
  series?: string;
  /** The height of the plot area, in pixels. Omitted, it follows the aspect. */
  height?: number;
  /** `auto` names the series when there is more than one; `none` never does. */
  legend?: ChartLegend;
  /** Whether the reader can move the view, and with what. */
  zoom?: ChartZoom;
  /** Whether hovering a mark reports its value. */
  tooltip?: boolean;
  /** Whether the reader can drag a rectangle over the marks to select them. */
  brush?: boolean;
  /** Whether marks animate into place. Reduced motion overrides it. */
  animate?: boolean;
  /** Called with the rows inside the brushed rectangle whenever it moves. */
  onSelect?: (rows: readonly ChartRecord[]) => void;
  /** SVG follows the type and the theme; canvas is for very many marks. */
  renderer?: ChartRenderer;
  className?: string;
}

interface Plotted {
  /** Series names, indexed as ECharts indexes its series. */
  names: string[];
  /** The values handed to each series, in ECharts' own shape. */
  values: (number | null)[][] | [number, number][][];
  /** The source row behind each value, at the same two indexes. */
  rows: (ChartRecord | undefined)[][];
  /** The category axis values, empty when the horizontal axis is a measure. */
  categories: string[];
}

interface BrushArea {
  seriesIndex: number;
  dataIndex?: number[];
}

interface BrushSelectedParams {
  batch?: { selected?: BrushArea[] }[];
}

function measure(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function categoriesOf(data: readonly ChartRecord[], x: string): string[] {
  const seen: string[] = [];
  for (const row of data) {
    const value = String(row[x]);
    if (!seen.includes(value)) seen.push(value);
  }
  return seen;
}

/**
 * Splits the rows the way the Plot spec does, then reshapes them for ECharts
 * and keeps the row behind every value so a selection can be reported in the
 * caller's own terms rather than in axis coordinates.
 */
function plotSeries(
  kind: ChartKind,
  data: readonly ChartRecord[],
  x: string,
  y: string,
  series: string | undefined,
): Plotted {
  const found = chartSeriesNames(data, series);
  const groups =
    series && found.length > 0
      ? found.map((name) => ({
          name,
          rows: data.filter((row) => String(row[series]) === name),
        }))
      : [{ name: y, rows: [...data] }];
  const names = groups.map((group) => group.name);

  if (kind === 'scatter' || kind === 'dot') {
    return {
      names,
      categories: [],
      values: groups.map((group) =>
        group.rows.map(
          (row) =>
            [measure(row[x]) ?? 0, measure(row[y]) ?? 0] as [number, number],
        ),
      ),
      rows: groups.map((group) => [...group.rows]),
    };
  }

  /* A category axis indexes by position, so every series has to be padded out
     to the full set of categories or the marks slide left. */
  const categories = categoriesOf(data, x);
  const at = groups.map((group) => {
    const byCategory = new Map<string, ChartRecord>();
    for (const row of group.rows) byCategory.set(String(row[x]), row);
    return categories.map((category) => byCategory.get(category));
  });

  return {
    names,
    categories,
    values: at.map((rows) => rows.map((row) => (row ? measure(row[y]) : null))),
    rows: at,
  };
}

function buildOption({
  kind,
  plotted,
  hidden,
  zoom,
  tooltip,
  brush,
  animate,
}: {
  kind: ChartKind;
  plotted: Plotted;
  hidden: readonly string[];
  zoom: ChartZoom;
  tooltip: boolean;
  brush: boolean;
  animate: boolean;
}): Option {
  const scatter = kind === 'scatter' || kind === 'dot';
  const type = scatter ? 'scatter' : kind === 'bar' ? 'bar' : 'line';

  const option: Record<string, unknown> = {
    animation: animate,
    grid: {
      ...GRID,
      bottom: zoom === 'slider' ? ZOOM_SLIDER_ROOM : GRID.bottom,
    },
    /* Drawn off, selected from. The HTML legend above the plot is the one the
       reader sees; this is only where the selection lives. */
    legend: {
      show: false,
      data: plotted.names,
      selected: Object.fromEntries(
        plotted.names.map((name) => [name, !hidden.includes(name)]),
      ),
    },
    xAxis: scatter
      ? { type: 'value', scale: true }
      : {
          type: 'category',
          data: plotted.categories,
          boundaryGap: kind === 'bar',
        },
    /* A scatter has a measure on both axes, so the vertical one is free to
       start away from zero; a bar read against a floating baseline lies. */
    yAxis: { type: 'value', scale: scatter },
    series: plotted.names.map((name, index) => ({
      name,
      type,
      data: plotted.values[index],
      ...(kind === 'area' ? { areaStyle: {} } : {}),
      ...(scatter ? { symbolSize: 9 } : {}),
      ...(type === 'line'
        ? { emphasis: { lineStyle: { width: 3 } } }
        : { emphasis: { itemStyle: { opacity: 0.8 } } }),
    })),
  };

  if (tooltip) {
    option.tooltip = scatter
      ? { trigger: 'item' }
      : {
          trigger: 'axis',
          axisPointer: { type: kind === 'bar' ? 'shadow' : 'line' },
        };
  }

  if (zoom !== 'none') {
    /* The slider gets the wheel too: the slider says where in the series the
       view is, and the wheel is how anyone actually zooms. */
    option.dataZoom =
      zoom === 'slider'
        ? [{ type: 'inside' }, ZOOM_SLIDER]
        : [{ type: 'inside' }];
  }

  if (brush) {
    option.toolbox = {
      right: 0,
      top: 0,
      feature: { brush: { type: ['rect', 'clear'] } },
    };
    option.brush = {
      xAxisIndex: 0,
      brushMode: 'single',
      throttleType: 'debounce',
    };
  }

  return option as Option;
}

/* Registered once per palette rather than once per chart: `registerTheme` is
   global, so every instance on the page shares the registration and only a
   theme flip has to redo it. */
let registeredPalette: string | null = null;

function registerTheme(node: Element): void {
  const palette = readChartEchartsPalette(node);
  const key = chartEchartsPaletteKey(palette);
  if (key === registeredPalette) return;
  echarts.registerTheme(HELIA_ECHARTS_THEME, chartEchartsTheme(palette));
  registeredPalette = key;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ChartInteractive({
  title,
  subtitle,
  caption,
  kind = 'line',
  data,
  x,
  y,
  series,
  height,
  legend = 'auto',
  zoom = 'none',
  tooltip = true,
  brush = false,
  animate = false,
  onSelect,
  renderer = 'svg',
  className,
}: ChartInteractiveProps) {
  const host = React.useRef<HTMLDivElement | null>(null);
  const [chart, setChart] = React.useState<echarts.ECharts | null>(null);
  const [hidden, setHidden] = React.useState<readonly string[]>([]);
  const [generation, setGeneration] = React.useState(0);

  React.useEffect(() => {
    /* The palette is read, not deferred to `var()`, so a theme flip has to
       re-register the theme and rebuild the instances that were made with the
       old one. */
    const observer = new MutationObserver(() =>
      setGeneration((value) => value + 1),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const node = host.current;
    if (!node) return;
    let instance: echarts.ECharts | null = null;
    let live = true;

    void (async () => {
      if (renderer === 'canvas') {
        const { CanvasRenderer } = await import('echarts/renderers');
        echarts.use([CanvasRenderer]);
      }
      if (!live || !host.current) return;
      registerTheme(host.current);
      instance = echarts.init(host.current, HELIA_ECHARTS_THEME, { renderer });
      setChart(instance);
    })();

    return () => {
      live = false;
      setChart(null);
      instance?.dispose();
    };
  }, [renderer, generation]);

  React.useEffect(() => {
    const node = host.current;
    if (!chart || !node) return;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [chart]);

  const plotted = React.useMemo(
    () => plotSeries(kind, data, x, y, series),
    [kind, data, x, y, series],
  );

  const option = React.useMemo(
    () =>
      buildOption({
        kind,
        plotted,
        hidden,
        zoom,
        tooltip,
        brush,
        animate: animate && !prefersReducedMotion(),
      }),
    [kind, plotted, hidden, zoom, tooltip, brush, animate],
  );

  React.useEffect(() => {
    if (!chart) return;
    /* Not merged: turning an interaction off has to remove its component, and
       a merge would leave the old one drawn. */
    chart.setOption(option, { notMerge: true });
  }, [chart, option]);

  React.useEffect(() => {
    if (!chart || !onSelect) return;
    const handler = (params: unknown) => {
      const batch = (params as BrushSelectedParams).batch?.[0];
      const picked: ChartRecord[] = [];
      for (const area of batch?.selected ?? []) {
        for (const index of area.dataIndex ?? []) {
          const row = plotted.rows[area.seriesIndex]?.[index];
          if (row) picked.push(row);
        }
      }
      onSelect(picked);
    };
    chart.on('brushSelected', handler);
    return () => {
      chart.off('brushSelected', handler);
    };
  }, [chart, onSelect, plotted]);

  const entries = chartLegendEntries({ data, series }, legend);

  return (
    <figure
      className={
        className
          ? `helia-chart not-content ${className}`
          : 'helia-chart not-content'
      }
      data-chart-kind={kind}
      data-chart-interactive=""
    >
      <div className="helia-chart__head">
        <p className="helia-chart__title">{title}</p>
        {subtitle && <p className="helia-chart__subtitle">{subtitle}</p>}
      </div>
      {entries.length > 0 && (
        <ul className="helia-chart__legend">
          {entries.map((entry) => (
            <li key={entry.label}>
              <button
                type="button"
                className="helia-chart__toggle"
                aria-pressed={!hidden.includes(entry.label)}
                onClick={() =>
                  setHidden((names) =>
                    names.includes(entry.label)
                      ? names.filter((name) => name !== entry.label)
                      : [...names, entry.label],
                  )
                }
              >
                <span
                  className="helia-chart__swatch"
                  style={
                    {
                      '--helia-chart-swatch': entry.color,
                    } as React.CSSProperties
                  }
                />
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* ECharts measures its container, so the box has to have a size before
          the island runs or the first draw is zero by zero. */}
      <div
        className="helia-chart__plot"
        ref={host}
        role="img"
        aria-label={subtitle ? `${title}. ${subtitle}` : title}
        style={{
          aspectRatio: CHART_ASPECT,
          minBlockSize: CHART_MIN_HEIGHT,
          blockSize: height ? `${height}px` : undefined,
        }}
      />
      {caption && (
        <figcaption className="helia-chart__caption">{caption}</figcaption>
      )}
    </figure>
  );
}
