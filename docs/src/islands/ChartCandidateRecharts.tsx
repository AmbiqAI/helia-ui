// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Recharts drawing the shared dataset. The primitives are used directly rather
 * than through the package's shadcn chart wrapper, so the comparison is
 * between the three libraries and not between one library and a wrapper.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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

const MARGIN = { top: 8, right: 12, bottom: 0, left: -18 };

/* Recharts restarts its entry animation every time the container is
   re-measured, which on this page means a panel is empty whenever the page is
   resized or captured. The comparison is of what the libraries draw, not of
   how they arrive. */
const ANIMATED = false;

/* ResponsiveContainer measures its parent, which a server render has nothing
   to do with: this is the size the first client frame is drawn at, before the
   observer fires, and it is also what keeps the server render from warning
   once per chart. */
const INITIAL_DIMENSION = { width: 360, height: 208 };

function tick(palette: ChartPalette) {
  return { fill: palette.inkMuted, fontSize: 11 };
}

function legend(palette: ChartPalette) {
  return { fontSize: 11, color: palette.inkMuted };
}

function tooltip(palette: ChartPalette) {
  return {
    background: palette.grid,
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    color: palette.ink,
  };
}

export default function ChartCandidateRecharts() {
  const { palette } = useChartPalette();

  return (
    <CandidateRow library="recharts">
      <ChartPanel framing={latencyFraming}>
        <div
          className="h-full w-full"
          style={{ color: palette.ink, fontFamily: palette.font }}
        >
          <ResponsiveContainer initialDimension={INITIAL_DIMENSION}>
            <LineChart data={latencySeries} margin={MARGIN}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis
                dataKey="inputLength"
                tickLine={false}
                axisLine={false}
                tick={tick(palette)}
              />
              <YAxis tickLine={false} axisLine={false} tick={tick(palette)} />
              <Tooltip contentStyle={tooltip(palette)} />
              <Legend wrapperStyle={legend(palette)} />
              <Line
                isAnimationActive={ANIMATED}
                type="monotone"
                dataKey="heliaRT"
                name={seriesLabels.heliaRT}
                stroke={palette.seriesA}
                strokeWidth={2}
                dot={false}
              />
              <Line
                isAnimationActive={ANIMATED}
                type="monotone"
                dataKey="heliaAOT"
                name={seriesLabels.heliaAOT}
                stroke={palette.seriesB}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel framing={energyFraming}>
        <div
          className="h-full w-full"
          style={{ color: palette.ink, fontFamily: palette.font }}
        >
          <ResponsiveContainer initialDimension={INITIAL_DIMENSION}>
            <BarChart data={energySeries} margin={MARGIN}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis
                dataKey="target"
                tickLine={false}
                axisLine={false}
                tick={tick(palette)}
              />
              <YAxis tickLine={false} axisLine={false} tick={tick(palette)} />
              <Tooltip
                cursor={{ fill: palette.grid, fillOpacity: 0.4 }}
                contentStyle={tooltip(palette)}
              />
              <Legend wrapperStyle={legend(palette)} />
              <Bar
                isAnimationActive={ANIMATED}
                dataKey="heliaRT"
                name={seriesLabels.heliaRT}
                fill={palette.seriesA}
                radius={3}
              />
              <Bar
                isAnimationActive={ANIMATED}
                dataKey="baseline"
                name={seriesLabels.baseline}
                fill={palette.seriesC}
                radius={3}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel framing={accuracyFraming}>
        <div
          className="h-full w-full"
          style={{ color: palette.ink, fontFamily: palette.font }}
        >
          <ResponsiveContainer initialDimension={INITIAL_DIMENSION}>
            <ScatterChart margin={MARGIN}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis
                type="number"
                dataKey="sizeMb"
                tickLine={false}
                axisLine={false}
                tick={tick(palette)}
              />
              <YAxis
                type="number"
                dataKey="accuracy"
                domain={[86, 96]}
                tickLine={false}
                axisLine={false}
                tick={tick(palette)}
              />
              <Tooltip contentStyle={tooltip(palette)} />
              <Legend wrapperStyle={legend(palette)} />
              <Scatter
                isAnimationActive={ANIMATED}
                name={seriesLabels.int8}
                fill={palette.seriesA}
                data={accuracySeries.filter(
                  (point) => point.precision === 'int8',
                )}
              />
              <Scatter
                isAnimationActive={ANIMATED}
                name={seriesLabels.fp16}
                fill={palette.seriesB}
                data={accuracySeries.filter(
                  (point) => point.precision === 'fp16',
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>
    </CandidateRow>
  );
}
