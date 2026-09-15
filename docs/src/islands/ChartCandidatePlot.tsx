// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Observable Plot drawing the shared dataset, hydrated, with everything Plot
 * offers an interactive page.
 *
 * Plot is not a React library: `Plot.plot` builds a detached figure element
 * against a DOM and hands it back, so the island is the adapter -- it owns the
 * node, measures the width Plot cannot infer, and rebuilds on a theme change.
 * It also cannot take a `var()`, which is why it waits for the resolved
 * palette rather than rendering with the custom properties.
 *
 * The row is here to show Plot's ceiling rather than to flatter it. `tip` and
 * `crosshair` are real interaction marks and they cost nothing to add. The
 * legend is the other half of the answer: Plot's own is a static swatch strip,
 * so a legend that toggles a series is React state, a filtered copy of the
 * data and a figure rebuilt from scratch, written here by hand. Plot has no
 * zoom and no selection, and nothing below fakes one.
 */
import * as Plot from '@observablehq/plot';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  accuracyFraming,
  accuracySeries,
  energyFraming,
  energyLong,
  energySeries,
  latencyFraming,
  latencyLong,
  seriesLabels,
  type ChartFraming,
} from '../lib/chart-data';
import {
  CandidateRow,
  ChartPanel,
  useChartPalette,
  type ChartPalette,
} from './chart-candidate-frame';

type PlotOptions = Parameters<typeof Plot.plot>[0];

const HEIGHT = 186;

/**
 * Names the figure as one image and takes the labels off the groups inside it.
 *
 * Plot writes `aria-label` onto the `g` it wraps each mark in, which is a
 * prohibited attribute on an element with no role, and a screen reader reading
 * out "line", "tip" and eleven axis ticks is reading noise in any case. The
 * Astro part does this at build in `labelChartSvg`; a figure built in the
 * browser has to do it too, and the labels move to `data-plot-label` where the
 * stylesheet can still find the gridlines.
 */
function labelFigure(figure: Element, framing: ChartFraming): void {
  const svg = figure.tagName === 'svg' ? figure : figure.querySelector('svg');
  if (!svg) return;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${framing.title}. ${framing.subtitle}`);
  for (const element of Array.from(svg.querySelectorAll('[aria-label]'))) {
    const label = element.getAttribute('aria-label');
    element.removeAttribute('aria-label');
    if (label) element.setAttribute('data-plot-label', label);
  }
}

function PlotFigure({
  framing,
  options,
}: {
  framing: ChartFraming;
  options: (width: number) => PlotOptions;
}) {
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
    labelFigure(figure, framing);
    node.append(figure);
    return () => figure.remove();
  });

  return <div ref={host} className="w-full grow" />;
}

/**
 * The legend, which is also the only way to turn a series off.
 *
 * A button rather than a swatch, because it is a control: the pressed state is
 * what the reader is toggling and assistive technology has to be told so.
 */
function SeriesLegend({
  names,
  colors,
  hidden,
  onToggle,
}: {
  names: readonly string[];
  colors: readonly string[];
  hidden: readonly string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div data-plot-legend="" className="mb-2 flex flex-wrap gap-4">
      {names.map((name, index) => {
        const on = !hidden.includes(name);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(name)}
            className="flex cursor-pointer items-center gap-2 text-xs"
          >
            <span
              aria-hidden="true"
              className="h-1 w-4 shrink-0 rounded-xs"
              style={{ background: on ? colors[index] : 'currentColor' }}
            />
            <span className={on ? undefined : 'line-through opacity-60'}>
              {name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function useSeriesToggle(names: readonly string[]) {
  const [hidden, setHidden] = useState<readonly string[]>([]);
  return {
    hidden,
    visible: names.filter((name) => !hidden.includes(name)),
    toggle: (name: string) =>
      setHidden((current) =>
        current.includes(name)
          ? current.filter((other) => other !== name)
          : [...current, name],
      ),
  };
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

/** The panel body: the legend above, the figure filling what is left. */
function PlotBody({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col">{children}</div>;
}

export default function ChartCandidatePlot() {
  const { palette, resolved } = useChartPalette();
  const latencyNames = [seriesLabels.heliaRT, seriesLabels.heliaAOT];
  const energyNames = [seriesLabels.heliaRT, seriesLabels.baseline];
  const accuracyNames = [seriesLabels.int8, seriesLabels.fp16];
  const latency = useSeriesToggle(latencyNames);
  const energy = useSeriesToggle(energyNames);
  const accuracy = useSeriesToggle(accuracyNames);

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

  const latencyPair = [palette.seriesA, palette.seriesB];
  const energyPair = [palette.seriesA, palette.seriesC];
  const accuracyPair = [palette.seriesA, palette.seriesB];

  const latencyRows = latencyLong.filter((row) =>
    latency.visible.includes(row.runtime),
  );
  const energyRows = energyLong.filter((row) =>
    energy.visible.includes(row.runtime),
  );
  const accuracyRows = accuracySeries.filter((row) =>
    accuracy.visible.includes(seriesLabels[row.precision]),
  );

  return (
    <CandidateRow library="plot">
      <ChartPanel framing={latencyFraming}>
        <PlotBody>
          <SeriesLegend
            names={latencyNames}
            colors={latencyPair}
            hidden={latency.hidden}
            onToggle={latency.toggle}
          />
          <PlotFigure
            framing={latencyFraming}
            options={(width) => ({
              ...frame(palette, width),
              marginLeft: 36,
              x: { label: null },
              y: { label: null },
              color: {
                legend: false,
                domain: latencyNames,
                range: latencyPair,
              },
              marks: [
                grid(),
                Plot.line(latencyRows, {
                  x: 'inputLength',
                  y: 'latency',
                  stroke: 'runtime',
                  strokeWidth: 2,
                  curve: 'monotone-x',
                }),
                Plot.crosshairX(latencyRows, {
                  x: 'inputLength',
                  y: 'latency',
                  color: palette.ink,
                  ruleStrokeOpacity: 0.4,
                }),
                Plot.tip(
                  latencyRows,
                  Plot.pointerX({
                    x: 'inputLength',
                    y: 'latency',
                    stroke: palette.grid,
                    title: (row) =>
                      `${row.runtime}\n${row.latency} ms at ${row.inputLength} tokens`,
                  }),
                ),
              ],
            })}
          />
        </PlotBody>
      </ChartPanel>

      <ChartPanel framing={energyFraming}>
        <PlotBody>
          <SeriesLegend
            names={energyNames}
            colors={energyPair}
            hidden={energy.hidden}
            onToggle={energy.toggle}
          />
          <PlotFigure
            framing={energyFraming}
            options={(width) => ({
              ...frame(palette, width),
              marginLeft: 36,
              x: { axis: null },
              /* The grouping axis carries the target labels, so the inner axis
                 would only repeat the legend. Plot sorts a categorical domain
                 unless it is given one, and the other candidates keep the
                 order the data is written in. */
              fx: {
                label: null,
                domain: energySeries.map((point) => point.target),
              },
              y: { label: null },
              color: { legend: false, domain: energyNames, range: energyPair },
              marks: [
                grid(),
                Plot.barY(energyRows, {
                  x: 'runtime',
                  y: 'energy',
                  fx: 'target',
                  fill: 'runtime',
                }),
                Plot.ruleY([0], { stroke: palette.grid }),
                Plot.tip(
                  energyRows,
                  Plot.pointer({
                    x: 'runtime',
                    y: 'energy',
                    fx: 'target',
                    stroke: palette.grid,
                    title: (row) =>
                      `${row.runtime}\n${row.energy} uJ on ${row.target}`,
                  }),
                ),
              ],
            })}
          />
        </PlotBody>
      </ChartPanel>

      <ChartPanel framing={accuracyFraming}>
        <PlotBody>
          <SeriesLegend
            names={accuracyNames}
            colors={accuracyPair}
            hidden={accuracy.hidden}
            onToggle={accuracy.toggle}
          />
          <PlotFigure
            framing={accuracyFraming}
            options={(width) => ({
              ...frame(palette, width),
              marginLeft: 36,
              x: { label: null },
              y: { label: null, domain: [86, 96] },
              color: {
                legend: false,
                domain: accuracyNames,
                range: accuracyPair,
              },
              marks: [
                grid(),
                Plot.dot(accuracyRows, {
                  x: 'sizeMb',
                  y: 'accuracy',
                  fill: 'precision',
                  r: 4,
                }),
                Plot.crosshair(accuracyRows, {
                  x: 'sizeMb',
                  y: 'accuracy',
                  color: palette.ink,
                  ruleStrokeOpacity: 0.4,
                }),
                Plot.tip(
                  accuracyRows,
                  Plot.pointer({
                    x: 'sizeMb',
                    y: 'accuracy',
                    stroke: palette.grid,
                    title: (row) =>
                      `${row.precision}\n${row.accuracy}% at ${row.sizeMb} MB`,
                  }),
                ),
              ],
            })}
          />
        </PlotBody>
      </ChartPanel>
    </CandidateRow>
  );
}
