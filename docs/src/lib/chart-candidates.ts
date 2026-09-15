// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * What is known about each charting candidate, as opposed to what is visible
 * on the page.
 *
 * License and version are the installed package's own, read from
 * node_modules; the byte figure is the island's share of the built page,
 * summed from the dist chunks the page loads for that island and reported
 * minified rather than compressed, because it is the parse cost that differs
 * between these four. Re-measure with `npm run docs:build` and
 * `scripts/measure-island-bytes.mjs`. Both move with the pinned range, so they
 * are stated next to the version they were taken from.
 *
 * The interaction column is a claim about the library, not about the island:
 * `native` means the library does it from options or props, `byHand` means the
 * island writes it, and `none` means neither the library nor a reasonable
 * amount of island code gets there. Every entry was checked against the
 * installed package's own type declarations rather than its marketing.
 */

export type InteractionKey =
  'tooltip' | 'zoom' | 'legendToggle' | 'selection' | 'animation' | 'streaming';

export type InteractionSupport = 'native' | 'byHand' | 'none';

export interface InteractionFact {
  support: InteractionSupport;
  /** The API that does it, or what stands in the way. */
  note: string;
}

export interface ChartCandidate {
  id: string;
  /** How the library is referred to in prose. */
  name: string;
  /** The specifier the island imports. */
  pkg: string;
  version: string;
  license: string;
  /** Minified JavaScript the page loads for this island, in bytes. */
  bytes: number;
  /** What the server render contains. */
  serverRender: string;
  /** What it takes to put the library in the site's colors and type. */
  theming: string;
  interactions: Record<InteractionKey, InteractionFact>;
}

/** The interaction columns, in the order the table prints them. */
export const interactionKeys: {
  key: InteractionKey;
  label: string;
  /** What the column is asking, since several of these names are overloaded. */
  question: string;
}[] = [
  {
    key: 'tooltip',
    label: 'Tooltip',
    question: 'A value readout that follows the pointer.',
  },
  {
    key: 'zoom',
    label: 'Zoom',
    question: 'Narrowing the domain by wheel, drag or slider.',
  },
  {
    key: 'legendToggle',
    label: 'Legend toggle',
    question: 'Clicking a legend entry removes that series.',
  },
  {
    key: 'selection',
    label: 'Selection',
    question: 'Dragging over marks selects them and reports which.',
  },
  {
    key: 'animation',
    label: 'Animation',
    question: 'Marks are drawn in rather than appearing.',
  },
  {
    key: 'streaming',
    label: 'Streaming',
    question: 'Appending points without rebuilding the chart.',
  },
];

/** How the table prints a support level. */
export const interactionLabels: Record<InteractionSupport, string> = {
  native: 'Native',
  byHand: 'By hand',
  none: 'No',
};

export const candidates: ChartCandidate[] = [
  {
    id: 'mui',
    name: 'MUI X Charts',
    pkg: '@mui/x-charts',
    version: '9.13.0',
    license: 'MIT',
    bytes: 498035,
    serverRender:
      'In part. The surface and the legend are in the HTML; the marks wait to be measured.',
    theming:
      'Colors are props, gridlines need an sx rule, and the rest is MUI theme defaults.',
    interactions: {
      tooltip: { support: 'native', note: 'ChartsTooltip, on by default.' },
      zoom: {
        support: 'none',
        note: 'Not in the community package: the zoom plugin is x-charts-pro.',
      },
      legendToggle: {
        support: 'native',
        note: 'hiddenItems and onHiddenItemsChange on the chart.',
      },
      selection: {
        support: 'none',
        note: 'The brush gestures and overlay are internals with no public props.',
      },
      animation: { support: 'native', note: 'On unless skipAnimation is set.' },
      streaming: {
        support: 'byHand',
        note: 'Re-render with new series; there is no append.',
      },
    },
  },
  {
    id: 'recharts',
    name: 'Recharts',
    pkg: 'recharts',
    version: '3.8.0',
    license: 'MIT',
    bytes: 408895,
    serverRender:
      'No. ResponsiveContainer has nothing to measure, so the HTML holds an empty container.',
    theming:
      'Every color is a prop on the element that draws it, and there is no theme to override.',
    interactions: {
      tooltip: { support: 'native', note: 'The Tooltip element.' },
      zoom: {
        support: 'native',
        note: 'The Brush element gives a range slider under the plot.',
      },
      legendToggle: {
        support: 'byHand',
        note: "Legend onClick plus the series' own hide prop, held in state.",
      },
      selection: {
        support: 'none',
        note: 'Brush narrows the domain; it does not report a set of marks.',
      },
      animation: {
        support: 'native',
        note: 'isAnimationActive, on by default.',
      },
      streaming: {
        support: 'byHand',
        note: 'New data prop; the animation replays each time.',
      },
    },
  },
  {
    id: 'plot',
    name: 'Observable Plot',
    pkg: '@observablehq/plot',
    version: '0.6.17',
    license: 'ISC',
    bytes: 312330,
    serverRender:
      'No. Plot.plot builds against a document, so the island is client only.',
    theming: 'One color scale and one style object per figure.',
    interactions: {
      tooltip: {
        support: 'native',
        note: 'The tip mark under a pointer transform, and crosshair.',
      },
      zoom: {
        support: 'none',
        note: 'No zoom, and no interaction to build on.',
      },
      legendToggle: {
        support: 'byHand',
        note: 'Plot legends are static swatches, so the island filters the data and rebuilds.',
      },
      selection: {
        support: 'none',
        note: 'The pointer transform picks one mark, never a set.',
      },
      animation: {
        support: 'none',
        note: 'A figure is built and appended; there is nothing to animate.',
      },
      streaming: {
        support: 'byHand',
        note: 'Rebuild the whole figure and swap the node.',
      },
    },
  },
  {
    id: 'echarts',
    name: 'Apache ECharts',
    pkg: 'echarts',
    version: '6.1.0',
    license: 'Apache-2.0',
    bytes: 668335,
    serverRender:
      'Yes. echarts.init(null, ...) with ssr lays the figure out with no document, so the SVG is in the HTML; the island then replaces it with a live instance, and the interactions arrive with that.',
    theming:
      'A JSON theme registered once. Every value in it is a var(), so the SVG follows the theme toggle.',
    interactions: {
      tooltip: {
        support: 'native',
        note: 'tooltip, on the item or the axis.',
      },
      zoom: {
        support: 'native',
        note: 'dataZoom, as a slider under the plot or on the wheel.',
      },
      legendToggle: {
        support: 'native',
        note: 'The legend toggles the series it names.',
      },
      selection: {
        support: 'native',
        note: 'brush returns the selected marks as an event.',
      },
      animation: {
        support: 'native',
        note: 'On by default, and configurable.',
      },
      streaming: {
        support: 'native',
        note: 'appendData adds points without a rebuild.',
      },
    },
  },
];

/** Bytes as the table prints them. */
export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024).toLocaleString('en-GB')} KB`;
}
