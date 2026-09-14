// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * MUI X Charts drawing the shared dataset. Deep entry points, not the package
 * root, because the root pulls every chart type into the island's chunk and
 * the page is measuring what each candidate costs.
 */
import { BarChart } from '@mui/x-charts/BarChart';
import { chartsGridClasses } from '@mui/x-charts/ChartsGrid';
import { legendClasses } from '@mui/x-charts/ChartsLegend';
import { LineChart } from '@mui/x-charts/LineChart';
import { ScatterChart } from '@mui/x-charts/ScatterChart';

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

const HEIGHT = 208;
const MARGIN = { top: 8, right: 12, bottom: 0, left: 0 };

/* Axis lines and ticks are redundant next to a horizontal grid, so the chart
   is left with the gridlines, the labels and the data. */
function axis(palette: ChartPalette) {
  return {
    disableLine: true,
    disableTicks: true,
    tickLabelStyle: { fill: palette.inkMuted, fontSize: 11 },
  } as const;
}

function sx(palette: ChartPalette) {
  return {
    [`& .${chartsGridClasses.line}`]: {
      stroke: palette.grid,
      strokeOpacity: 1,
    },
    /* The legend is HTML, and it takes its ink from the MUI theme rather than
       from the element it sits in, so an unthemed chart keeps light-mode text
       on a dark page. */
    [`& .${legendClasses.label}`]: {
      color: palette.ink,
      fontSize: 11,
    },
  };
}

export default function ChartCandidateMui() {
  const { palette } = useChartPalette();
  const frame = {
    height: HEIGHT,
    margin: MARGIN,
    grid: { horizontal: true },
    sx: sx(palette),
  } as const;

  return (
    <CandidateRow library="mui">
      <ChartPanel framing={latencyFraming}>
        <div style={{ color: palette.ink, fontFamily: palette.font }}>
          <LineChart
            {...frame}
            xAxis={[
              {
                ...axis(palette),
                scaleType: 'point',
                data: latencySeries.map((point) => point.inputLength),
              },
            ]}
            yAxis={[axis(palette)]}
            series={[
              {
                data: latencySeries.map((point) => point.heliaRT),
                label: seriesLabels.heliaRT,
                color: palette.seriesA,
                curve: 'monotoneX',
              },
              {
                data: latencySeries.map((point) => point.heliaAOT),
                label: seriesLabels.heliaAOT,
                color: palette.seriesB,
                curve: 'monotoneX',
              },
            ]}
          />
        </div>
      </ChartPanel>

      <ChartPanel framing={energyFraming}>
        <div style={{ color: palette.ink, fontFamily: palette.font }}>
          <BarChart
            {...frame}
            xAxis={[
              {
                ...axis(palette),
                scaleType: 'band',
                data: energySeries.map((point) => point.target),
              },
            ]}
            yAxis={[axis(palette)]}
            borderRadius={3}
            series={[
              {
                data: energySeries.map((point) => point.heliaRT),
                label: seriesLabels.heliaRT,
                color: palette.seriesA,
              },
              {
                data: energySeries.map((point) => point.baseline),
                label: seriesLabels.baseline,
                color: palette.seriesC,
              },
            ]}
          />
        </div>
      </ChartPanel>

      <ChartPanel framing={accuracyFraming}>
        <div style={{ color: palette.ink, fontFamily: palette.font }}>
          <ScatterChart
            {...frame}
            xAxis={[axis(palette)]}
            yAxis={[axis(palette)]}
            series={[
              {
                label: seriesLabels.int8,
                color: palette.seriesA,
                data: accuracySeries
                  .filter((point) => point.precision === 'int8')
                  .map((point) => ({ x: point.sizeMb, y: point.accuracy })),
              },
              {
                label: seriesLabels.fp16,
                color: palette.seriesB,
                data: accuracySeries
                  .filter((point) => point.precision === 'fp16')
                  .map((point) => ({ x: point.sizeMb, y: point.accuracy })),
              },
            ]}
          />
        </div>
      </ChartPanel>
    </CandidateRow>
  );
}
