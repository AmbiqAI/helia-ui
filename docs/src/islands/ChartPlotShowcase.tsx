// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The React chart, drawing the gallery's synthetic dataset.
 *
 * The same two charts are on the gallery as Astro parts, from the same module,
 * so what this page shows is the client renderer rather than a second design:
 * side by side they should be indistinguishable except that this one resizes
 * with the column.
 */
import { ChartPlot } from '@ambiqai/helia-ui/react/chart-plot';

import { buildSeries, trafficSeries } from '../lib/chart-gallery-data';

export default function ChartPlotShowcase() {
  return (
    <div data-chart-plot-demo="" className="not-content grid gap-6">
      <ChartPlot
        title="Weekly page views"
        subtitle="Page views against week of the quarter, by section"
        caption="Synthetic series. Nothing here is a measurement of any part."
        kind="line"
        data={trafficSeries}
        x="week"
        y="views"
        series="section"
        height={280}
      />
      <ChartPlot
        title="Build time by stage"
        subtitle="Wall-clock seconds against build stage, by cache profile"
        kind="bar"
        data={buildSeries}
        x="stage"
        y="seconds"
        series="profile"
        height={260}
      />
    </div>
  );
}
