// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@ambiqai/helia-ui/react/chart';

/*
 * The worked example behind the charts section of the migration guide.
 *
 * MkDocs carries this series as data attributes on an empty div, which
 * `chart-init.js` reads at load and hands to Plotly. The numbers are the same
 * numbers here; the difference is a typed module the build can see, rendered
 * through the package's Recharts wrapper.
 *
 * The series is illustrative, not measured: it exists to show the shape of the
 * conversion, not to state anything about a part.
 */
const windows = [
  { window: 0, rt: 5.4, aot: 4.9 },
  { window: 1, rt: 5.2, aot: 4.8 },
  { window: 2, rt: 5.6, aot: 4.7 },
  { window: 3, rt: 5.1, aot: 4.9 },
  { window: 4, rt: 5.3, aot: 4.6 },
  { window: 5, rt: 5.2, aot: 4.8 },
];

/*
 * A Plotly `trace.name` and a hand-picked hex per trace become one config
 * entry per series. The color is a token, so the chart follows the theme
 * instead of carrying a palette of its own.
 */
const config = {
  rt: { label: 'heliaRT', color: 'var(--chart-1)' },
  aot: { label: 'heliaAOT', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export default function MkDocsChartMigration() {
  return (
    <ChartContainer config={config}>
      <LineChart data={windows} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="window"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          label={{ value: 'Window', position: 'insideBottom', offset: -4 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={36}
          unit="ms"
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="rt"
          stroke="var(--color-rt)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="aot"
          stroke="var(--color-aot)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
