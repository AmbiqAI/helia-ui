// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The interactive chart over the same three datasets the Plot layer draws, so
 * the two can be read against each other: the frame is identical and only the
 * behavior is new.
 *
 * Each of the three carries a different interaction rather than all of them at
 * once, because the question the page has to answer is which interaction is
 * worth an island, not what the library can do.
 */
import { ChartInteractive } from '@ambiqai/helia-ui/react/chart-interactive';
import { useState } from 'react';

import {
  buildSeries,
  trafficSeries,
  weightSeries,
} from '../lib/chart-gallery-data';

export default function ChartInteractiveShowcase() {
  const [selected, setSelected] = useState(0);

  return (
    <div data-chart-interactive-demo="" className="not-content grid gap-6">
      <ChartInteractive
        title="Weekly page views"
        subtitle="Page views against week of the quarter, by section"
        caption="Drag the slider or scroll over the plot to narrow the weeks. Synthetic series."
        kind="line"
        data={trafficSeries}
        x="week"
        y="views"
        series="section"
        height={280}
        zoom="slider"
      />
      <ChartInteractive
        title="Build time by stage"
        subtitle="Wall-clock seconds against build stage, by cache profile"
        caption="Hover a stage to compare the profiles; use the legend to drop one."
        kind="bar"
        data={buildSeries}
        x="stage"
        y="seconds"
        series="profile"
        height={260}
      />
      <ChartInteractive
        title="Page weight against performance"
        subtitle="Lighthouse score against transferred kilobytes, by template"
        caption={
          selected > 0
            ? `${selected} pages in the selection.`
            : 'Pick the rectangle in the top right, then drag across the marks.'
        }
        kind="scatter"
        data={weightSeries}
        x="transferKb"
        y="score"
        series="template"
        height={260}
        brush
        onSelect={(rows) => setSelected(rows.length)}
      />
    </div>
  );
}
