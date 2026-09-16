// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * The React counterpart of `astro/Chart.astro`: the same props, the same
 * frame, the same marks, drawn in the browser instead of at build.
 *
 * Reach for it where the data is not known at build -- a filter, a live feed,
 * a range the reader picks. Everywhere else the Astro part is the cheaper
 * answer, because it ships no JavaScript at all.
 *
 * Plot is not a React library: `Plot.plot` builds a detached figure against a
 * DOM and hands it back, so this component is the adapter. It owns the node,
 * measures the width Plot cannot infer, and rebuilds the figure when either
 * moves.
 */
import * as React from 'react';
import * as Plot from '@observablehq/plot';

import {
  CHART_HEIGHT,
  CHART_WIDTH,
  chartLegendEntries,
  chartPlotOptions,
  inlineChartColors,
  labelChartSvg,
  type ChartDensity,
  type ChartKind,
  type ChartLegend,
  type ChartOrientation,
  type ChartRecord,
} from '../chart-plot-spec';

export interface ChartPlotProps {
  /** The chart's heading. Also the accessible name of the SVG. */
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
  /** The height, in pixels. */
  height?: number;
  /** The width Plot lays the chart out at until the container has been measured. */
  width?: number;
  /** Moves the margins and the tick count. */
  density?: ChartDensity;
  /** `auto` names the series when there is more than one; `none` never does. */
  legend?: ChartLegend;
  /** Which way the bars run. `horizontal` puts the categories on the y axis. */
  orientation?: ChartOrientation;
  className?: string;
}

export function ChartPlot({
  title,
  subtitle,
  caption,
  kind = 'line',
  data,
  x,
  y,
  series,
  height = CHART_HEIGHT,
  width = CHART_WIDTH,
  density = 'default',
  legend = 'auto',
  orientation = 'vertical',
  className,
}: ChartPlotProps) {
  const host = React.useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = React.useState(0);
  const [generation, setGeneration] = React.useState(0);

  React.useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setMeasured(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    /* The palette is `var()`, so a theme flip recolors the figure without
       help. The rebuild is for the rest of the theme: a scope may carry its
       own face, and Plot sizes its margins from the ticks it measured in the
       face it was built with. */
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
    const figure = Plot.plot(
      chartPlotOptions({
        kind,
        data,
        x,
        y,
        series,
        height,
        width: measured > 0 ? measured : width,
        density,
        orientation,
      }),
    );
    inlineChartColors(figure);
    labelChartSvg(figure, title, subtitle);
    node.replaceChildren(figure);
    return () => figure.remove();
  }, [
    kind,
    data,
    x,
    y,
    series,
    height,
    width,
    density,
    orientation,
    measured,
    generation,
    title,
    subtitle,
  ]);

  const entries = chartLegendEntries({ data, series }, legend);

  return (
    <figure
      className={
        className
          ? `helia-chart not-content ${className}`
          : 'helia-chart not-content'
      }
      data-chart-kind={kind}
    >
      <div className="helia-chart__head">
        <p className="helia-chart__title">{title}</p>
        {subtitle && <p className="helia-chart__subtitle">{subtitle}</p>}
      </div>
      {entries.length > 0 && (
        <ul className="helia-chart__legend">
          {entries.map((entry) => (
            <li key={entry.label}>
              <span
                className="helia-chart__swatch"
                style={
                  {
                    '--helia-chart-swatch': entry.color,
                  } as React.CSSProperties
                }
              />
              {entry.label}
            </li>
          ))}
        </ul>
      )}
      <div className="helia-chart__plot" ref={host} />
      {caption && (
        <figcaption className="helia-chart__caption">{caption}</figcaption>
      )}
    </figure>
  );
}
