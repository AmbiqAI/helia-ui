// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ambiqai/helia-ui/react/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@ambiqai/helia-ui/react/chart';

const comparisonData = [
  { engine: 'heliaRT', latency: 5.2 },
  { engine: 'heliaAOT', latency: 4.8 },
  { engine: 'TFLM', latency: 7.9 },
];

const footprintData = [
  { id: 'heliaRT', ram: 196, latency: 5.2 },
  { id: 'heliaAOT', ram: 184, latency: 4.8 },
  { id: 'TFLM', ram: 212, latency: 7.9 },
  { id: 'CMSIS-NN', ram: 204, latency: 6.7 },
  { id: 'Reference C', ram: 176, latency: 12.4 },
];

const latencyConfig = {
  latency: { label: 'Latency', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const footprintConfig = {
  latency: { label: 'Runtime', color: 'var(--chart-2)' },
} satisfies ChartConfig;

interface Props {
  animate?: boolean;
}

export default function ChartShowcase({ animate = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [motionReady, setMotionReady] = useState(!animate);

  useEffect(() => {
    if (!animate || motionReady) return;
    const node = containerRef.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMotionReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setMotionReady(true);
        observer.disconnect();
      },
      { rootMargin: '160px 0px', threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [animate, motionReady]);

  return (
    <div
      ref={containerRef}
      data-chart-motion-ready={motionReady ? 'true' : 'false'}
      className="not-content grid gap-3 md:grid-cols-2"
    >
      <Card>
        <CardHeader>
          <CardTitle>Runtime latency</CardTitle>
          <CardDescription>
            Median milliseconds per inference · lower is better
          </CardDescription>
        </CardHeader>
        <CardContent>
          {motionReady ? (
            <ChartContainer config={latencyConfig}>
              <BarChart data={comparisonData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="engine" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 9.25]} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="latency" fill="var(--color-latency)" radius={5}>
                  <LabelList
                    dataKey="latency"
                    position="top"
                    formatter={(value) => `${String(value)} ms`}
                    className="fill-foreground"
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <div aria-hidden="true" className="aspect-video" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memory and latency</CardTitle>
          <CardDescription>
            Runtime footprint tradeoff · lower-left is better
          </CardDescription>
        </CardHeader>
        <CardContent>
          {motionReady ? (
            <ChartContainer config={footprintConfig}>
              <ScatterChart accessibilityLayer>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="ram"
                  name="Peak RAM"
                  unit=" KB"
                  domain={[168, 220]}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="latency"
                  name="Latency"
                  unit=" ms"
                  domain={[4, 13]}
                  tickLine={false}
                  axisLine={false}
                />
                <ZAxis range={[80, 80]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Scatter data={footprintData} fill="var(--color-latency)" />
              </ScatterChart>
            </ChartContainer>
          ) : (
            <div aria-hidden="true" className="aspect-video" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
