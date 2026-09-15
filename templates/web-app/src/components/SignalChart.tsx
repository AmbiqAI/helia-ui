// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  type ChartConfig,
} from '@ambiqai/helia-ui/react/chart';

import { WINDOW_SECONDS, type StreamPoint } from '../stream/use-stream';

/*
 * `var(--chart-1)` is the package's ramp, aliased in shadcn.css to the same
 * `--helia-chart-*` series the Plot and ECharts parts draw with, so the trace
 * follows the theme flip without this file knowing a color.
 */
const chartConfig = {
  signal: { label: 'PPG', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/* The simulated waveform is a normalized pulse; a real one needs the ADC range. */
const Y_DOMAIN: [number, number] = [-2, 2];

interface SignalChartProps {
  points: StreamPoint[];
}

export function SignalChart({ points }: SignalChartProps) {
  if (points.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center text-small text-ink-muted"
        data-testid="chart-empty"
      >
        Connect a source to start the trace.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <LineChart
        data={points}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          /* Fixed domain, so new samples slide the trace instead of rescaling
           * the axis every frame — a moving domain reads as a jitter. */
          domain={[-WINDOW_SECONDS, 0]}
          ticks={[-4, -3, -2, -1, 0]}
          tickFormatter={(value: number) => `${value.toFixed(0)}s`}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={Y_DOMAIN}
          width={40}
          tickCount={5}
          tickLine={false}
          axisLine={false}
        />
        {/*
         * Three settings carry the frame budget: no per-point dot (240 extra
         * SVG nodes), no entry animation (Recharts would re-run it on every
         * data change and never finish), and a plain polyline rather than a
         * spline so path generation is linear in point count.
         *
         * No tooltip: hit-testing 240 points on a trace that moves every frame
         * costs more than it tells anyone. Pause the stream to inspect values.
         */}
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--color-signal)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
