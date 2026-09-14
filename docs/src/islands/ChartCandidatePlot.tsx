// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Observable Plot drawing the shared dataset.
 *
 * Plot is not a React library: `Plot.plot` builds a detached figure element
 * against a DOM and hands it back, so the island is the adapter -- it owns the
 * node, measures the width Plot cannot infer, and rebuilds on a theme change.
 * It also cannot take a `var()`, which is why it waits for the resolved
 * palette rather than rendering with the custom properties.
 */
import * as Plot from '@observablehq/plot';
import { useEffect, useRef, useState } from 'react';

import {
  accuracyFraming,
  accuracySeries,
  energyFraming,
  energySeries,
  latencyFraming,
  latencySeries,
  seriesLabels,
} from '../lib/chart-data';
import {
  CandidateRow,
  ChartPanel,
  useChartPalette,
  type ChartPalette,
} from './chart-candidate-frame';

type PlotOptions = Parameters<typeof Plot.plot>[0];

const HEIGHT = 208;

const latencyLong = latencySeries.flatMap((point) => [
  {
    inputLength: point.inputLength,
    latency: point.heliaRT,
    runtime: seriesLabels.heliaRT,
  },
  {
    inputLength: point.inputLength,
    latency: point.heliaAOT,
    runtime: seriesLabels.heliaAOT,
  },
]);

const energyLong = energySeries.flatMap((point) => [
  {
    target: point.target,
    energy: point.heliaRT,
    runtime: seriesLabels.heliaRT,
  },
  {
    target: point.target,
    energy: point.baseline,
    runtime: seriesLabels.baseline,
  },
]);

function PlotFigure({ options }: { options: (width: number) => PlotOptions }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = host.current;
    if (!node || width === 0) return;
    const figure = Plot.plot(options(width));
    node.append(figure);
    return () => figure.remove();
  });

  return <div ref={host} className="h-full w-full" />;
}

function frame(palette: ChartPalette, width: number) {
  return {
    width,
    height: HEIGHT,
    style: {
      background: 'transparent',
      color: palette.inkMuted,
      fontFamily: palette.font,
      fontSize: '11px',
    },
  } satisfies PlotOptions;
}

export default function ChartCandidatePlot() {
  const { palette, resolved } = useChartPalette();

  if (!resolved) {
    return (
      <CandidateRow library="plot">
        <ChartPanel framing={latencyFraming} />
        <ChartPanel framing={energyFraming} />
        <ChartPanel framing={accuracyFraming} />
      </CandidateRow>
    );
  }

  /* A fresh mark per figure: Plot marks carry render state, so one shared
     object drawn into three plots is not the same as three of them. */
  const grid = () => Plot.gridY({ stroke: palette.grid, strokeOpacity: 1 });

  return (
    <CandidateRow library="plot">
      <ChartPanel framing={latencyFraming}>
        <PlotFigure
          options={(width) => ({
            ...frame(palette, width),
            marginLeft: 36,
            x: { label: null },
            y: { label: null },
            color: {
              legend: true,
              domain: [seriesLabels.heliaRT, seriesLabels.heliaAOT],
              range: [palette.seriesA, palette.seriesB],
            },
            marks: [
              grid(),
              Plot.line(latencyLong, {
                x: 'inputLength',
                y: 'latency',
                stroke: 'runtime',
                strokeWidth: 2,
                curve: 'monotone-x',
              }),
            ],
          })}
        />
      </ChartPanel>

      <ChartPanel framing={energyFraming}>
        <PlotFigure
          options={(width) => ({
            ...frame(palette, width),
            marginLeft: 36,
            x: { axis: null },
            /* The grouping axis carries the target labels, so the inner axis
               would only repeat the legend. Plot sorts a categorical domain
               unless it is given one, and the other two candidates keep the
               order the data is written in. */
            fx: { label: null, domain: energySeries.map((p) => p.target) },
            y: { label: null },
            color: {
              legend: true,
              domain: [seriesLabels.heliaRT, seriesLabels.baseline],
              range: [palette.seriesA, palette.seriesC],
            },
            marks: [
              grid(),
              Plot.barY(energyLong, {
                x: 'runtime',
                y: 'energy',
                fx: 'target',
                fill: 'runtime',
              }),
              Plot.ruleY([0], { stroke: palette.grid }),
            ],
          })}
        />
      </ChartPanel>

      <ChartPanel framing={accuracyFraming}>
        <PlotFigure
          options={(width) => ({
            ...frame(palette, width),
            marginLeft: 36,
            x: { label: null },
            y: { label: null, domain: [86, 96] },
            color: {
              legend: true,
              domain: [seriesLabels.int8, seriesLabels.fp16],
              range: [palette.seriesA, palette.seriesB],
            },
            marks: [
              grid(),
              Plot.dot(accuracySeries, {
                x: 'sizeMb',
                y: 'accuracy',
                fill: 'precision',
                r: 4,
              }),
            ],
          })}
        />
      </ChartPanel>
    </CandidateRow>
  );
}
